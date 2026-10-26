# SPDX-License-Identifier: AGPL-3.0-only
# Copyright (c) 2026 ScorePrep contributors
"""Local desktop worker. Results and logs stay in a caller-owned job directory."""
import argparse
import contextlib
import json
import math
from pathlib import Path
import shutil
import sys
import time
import xml.etree.ElementTree as ET
import zipfile

# The desktop launches Python in isolated mode; only bundled worker code is added.
sys.path.insert(0, str(Path(__file__).resolve().parent))
from engine import VerifiedEngine, REVISION, MODELS, digest


def deny_network():
    """The local worker has no download/service dependency, including fallbacks."""
    import socket
    attempts = []

    def denied(*args, **kwargs):
        attempts.append(True)
        raise OSError("Network access is disabled for local recognition")

    class OfflineSocket(socket.socket):
        connect = denied
        connect_ex = denied

    socket.socket = OfflineSocket
    socket.create_connection = denied
    socket.getaddrinfo = denied
    return attempts


def source_geometry(layout_path, width, height):
    if layout_path.suffix.lower() == ".omr":
        with zipfile.ZipFile(layout_path) as archive:
            sheets = [n for n in archive.namelist()
                      if n.startswith("sheet#") and n.endswith(".xml")]
            if len(sheets) != 1:
                raise ValueError("A page needs its own one-sheet recognition layout")
            root = ET.fromstring(archive.read(sheets[0]))
    else:
        root = ET.parse(layout_path).getroot()
    picture = root.find("picture")
    sx, sy = float(picture.get("width")) / width, float(picture.get("height")) / height
    tops, spacings = [], []
    for staff in root.iter("staff"):
        lines = staff.findall("./lines/line")
        if len(lines) != 5:
            continue
        points = [[(float(p.get("x")) / sx, float(p.get("y")) / sy)
                   for p in line.findall("point")] for line in lines]
        spacings.append((points[-1][0][1] - points[0][0][1]) / 4)
        tops.append(dict(points=points[0], thickness=float(lines[0].get("thickness")) / sy))
    if not spacings:
        raise ValueError("Source layout contains no measured five-line staff")
    return spacings, tops


def render_pages(source, output):
    from PIL import Image, ImageOps
    entries = []

    def save(image):
        name = f"page-{len(entries) + 1:04d}.png"
        width, height = image.size
        if width * height > 32_000_000:
            raise ValueError("Page raster exceeds the supported 32-megapixel size")
        image.convert("RGB").save(output / name)
        entries.append(dict(file=name, width=width, height=height,
                            sha256=digest(output / name)))

    if source.suffix.lower() == ".pdf":
        import pypdfium2 as pdfium
        pdf = pdfium.PdfDocument(source)
        try:
            if not 1 <= len(pdf) <= 20:
                raise ValueError("Import a PDF containing 1 to 20 pages")
            for page in pdf:
                try:
                    bitmap = page.render(scale=300 / 72)
                    try:
                        save(bitmap.to_pil())
                    finally:
                        bitmap.close()
                finally:
                    page.close()
        finally:
            pdf.close()
    else:
        with Image.open(source) as image:
            save(ImageOps.exif_transpose(image))
    return entries


def recognize_page(source, output, layout_path, masks_path):
    engine = VerifiedEngine()
    import cv2
    import numpy as np
    image = cv2.imdecode(np.frombuffer(source.read_bytes(), dtype="uint8"), cv2.IMREAD_COLOR)
    if image is None:
        raise ValueError("Cannot decode the page raster")
    result = dict(revision=REVISION, models=MODELS,
                  width=image.shape[1], height=image.shape[0])
    if not masks_path:
        copied = output / "page.png"
        shutil.copyfile(source, copied)
        result["musicXML"] = engine.recognize(copied).name
    if layout_path:
        from glyphs import GlyphReader
        spacings, tops = source_geometry(layout_path, image.shape[1], image.shape[0])
        observations = GlyphReader().read(image, spacings, tops)
        observations["sourceSHA256"] = digest(source)
        (output / "glyphs.json").write_text(json.dumps(observations, ensure_ascii=False), encoding="utf-8")
        result.update(glyphs="glyphs.json", layoutSHA256=digest(layout_path))
    if masks_path:
        mask_data = json.loads(masks_path.read_text(encoding="utf-8"))
        if mask_data["sourceSHA256"] != digest(source):
            raise ValueError("Fingering mask source does not match this page")
        masked = image.copy()
        for mark in mask_data["fingerings"]:
            if mark["digit"] not in "012345" or len(mark["digit"]) != 1 or mark["score"] < 0.85:
                raise ValueError("Mask needs a confirmed source fingering")
            g = mark["glyph"]
            if not (g["width"] > 0 and g["height"] > 0 and g["x"] >= 0 and g["y"] >= 0
                    and g["x"] + g["width"] <= image.shape[1]
                    and g["y"] + g["height"] <= image.shape[0]):
                raise ValueError("Fingering mask is outside the page raster")
            x0, y0 = max(0, math.floor(g["x"]) - 1), max(0, math.floor(g["y"]) - 1)
            x1 = min(image.shape[1], math.ceil(g["x"] + g["width"]) + 1)
            y1 = min(image.shape[0], math.ceil(g["y"] + g["height"]) + 1)
            masked[y0:y1, x0:x1] = 255
        comparison = output / "fingering-comparison.png"
        if not cv2.imwrite(str(comparison), masked):
            raise OSError("Cannot save fingering comparison raster")
        comparison_xml = engine.recognize(comparison)
        result.update(comparisonXML=comparison_xml.name,
                      comparisonSHA256=digest(comparison),
                      maskedFingerings=mask_data["fingerings"])
    return result


def binarize_layout(source, output):
    import cv2
    import numpy as np
    cv2.setNumThreads(2)
    image = cv2.imdecode(np.frombuffer(source.read_bytes(), dtype="uint8"), cv2.IMREAD_GRAYSCALE)
    if image is None:
        raise ValueError("Cannot decode the layout raster")
    binary = cv2.threshold(image, 160, 255, cv2.THRESH_BINARY)[1]
    if not cv2.imwrite(str(output / "binary.png"), binary):
        raise OSError("Cannot save the layout contrast view")
    return dict(file="binary.png", width=image.shape[1], height=image.shape[0],
                method="grayscale-threshold-160", sha256=digest(output / "binary.png"))


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("mode", choices=["pages", "binarize", "recognize", "compare"])
    parser.add_argument("source", type=Path)
    parser.add_argument("output", type=Path)
    parser.add_argument("--layout", type=Path)
    parser.add_argument("--masks", type=Path)
    args = parser.parse_args()
    if (args.mode == "compare") != bool(args.masks):
        parser.error("Only comparison recognition requires --masks")
    source = args.source.resolve(strict=True)
    args.output.mkdir(parents=True, exist_ok=False)
    output = args.output.resolve()
    started, source_hash = time.monotonic(), digest(source)
    attempts = deny_network()
    result = dict(state="running", mode=args.mode, sourceSHA256=source_hash, network="disabled")
    code = 0
    with (output / "worker.log").open("w", encoding="utf-8", buffering=1) as log:
        try:
            with contextlib.redirect_stdout(log), contextlib.redirect_stderr(log):
                if args.mode == "pages":
                    result["pages"] = render_pages(source, output)
                elif args.mode == "binarize":
                    result.update(binarize_layout(source, output))
                else:
                    result.update(recognize_page(source, output, args.layout, args.masks))
            result["state"] = "finished"
        except Exception as error:
            import traceback
            traceback.print_exc(file=log)
            result.update(state="failed", error=str(error))
            code = 1
    result.update(seconds=round(time.monotonic() - started, 2), sourceUnchanged=digest(source) == source_hash,
                  networkAttempts=len(attempts))
    if not result["sourceUnchanged"]:
        result.update(state="failed", error="The source file changed during recognition")
        code = 1
    temporary = output / "result.json.tmp"
    temporary.write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")
    temporary.replace(output / "result.json")
    print(json.dumps(result, ensure_ascii=False))
    raise SystemExit(code)


if __name__ == "__main__":
    main()
