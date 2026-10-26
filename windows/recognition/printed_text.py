# SPDX-License-Identifier: MIT
"""Unrestricted glyph cross-check using the existing pinned Audiveris OCR assets."""
import ctypes as C
import hashlib
import os
from pathlib import Path
import zipfile

JARS = {
    "leptonica-1.87.0-1.5.13-windows-x86_64.jar": "4fb35ee744b02c259a60c0836ff0989e769acfc73457c8feb3a551335baf19b6",
    "tesseract-5.5.2-1.5.13-windows-x86_64.jar": "f4746470eff676936cdf8050338b077e3c125b24223b96da211b756217a71810",
}
DLLS = {"libgcc_s_seh-1.dll", "libgomp-1.dll", "libleptonica-6.dll",
        "libstdc++-6.dll", "libwinpthread-1.dll", "libtesseract55.dll"}
ENGLISH_SHA256 = "daa0c97d651c19fba3b25e81317cd697e9908c8208090c94c3905381c23fc047"


class PrintedTextReader:
    def __init__(self, runtime: Path, cache: Path):
        for file, expected in [(runtime / "app" / n, h) for n, h in JARS.items()] + [
                (runtime / "eng.traineddata", ENGLISH_SHA256)]:
            with file.open("rb") as stream:
                if hashlib.file_digest(stream, "sha256").hexdigest() != expected:
                    raise ValueError("Bundled unrestricted text OCR asset SHA-256 mismatch")
        cache.mkdir(exist_ok=True)
        extracted = set()
        for name in JARS:
            with zipfile.ZipFile(runtime / "app" / name) as archive:
                for entry in archive.namelist():
                    basename = Path(entry).name
                    if basename in DLLS and "/windows-x86_64/" in entry:
                        (cache / basename).write_bytes(archive.read(entry))
                        extracted.add(basename)
        if extracted != DLLS:
            raise ValueError("Bundled unrestricted text OCR libraries are incomplete")
        os.environ["OMP_THREAD_LIMIT"] = "2"
        self.directory = os.add_dll_directory(str(cache.resolve()))
        self.dll = C.CDLL(str((cache / "libtesseract55.dll").resolve()))

        def bind(name, result, args):
            f = getattr(self.dll, name)
            f.restype, f.argtypes = result, args
            return f

        p, s, i = C.c_void_p, C.c_char_p, C.c_int
        create = bind("TessBaseAPICreate", p, [])
        init = bind("TessBaseAPIInit2", i, [p, s, s, i])
        self.mode = bind("TessBaseAPISetPageSegMode", None, [p, i])
        self.set_image = bind("TessBaseAPISetImage", None, [p, p, i, i, i, i])
        self.text = bind("TessBaseAPIGetUTF8Text", p, [p])
        self.free = bind("TessDeleteText", None, [p])
        self.confidence = bind("TessBaseAPIMeanTextConf", i, [p])
        self.delete = bind("TessBaseAPIDelete", None, [p])
        self.api = create()
        if init(self.api, str(runtime.resolve()).encode("utf-8"), b"eng", 1):
            self.close()
            raise RuntimeError("Bundled unrestricted text OCR could not initialize")

    def read(self, image, glyphs, scale):
        import cv2
        import numpy as np
        from glyphs import glyph_crop
        if scale > 1:
            image = cv2.resize(image, (round(image.shape[1] * scale), round(image.shape[0] * scale)),
                               interpolation=cv2.INTER_LANCZOS4)
        gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
        _, labels = cv2.connectedComponents((gray < 160).astype("uint8"), 8)
        results = []
        for g in glyphs:
            crop = glyph_crop(gray, labels, g, scale)
            if crop is None:
                results.append([])
                continue
            h, w = crop.shape
            padding = round(h * .4)
            crop = np.ascontiguousarray(cv2.copyMakeBorder(crop, padding, padding, padding, padding,
                                                         cv2.BORDER_CONSTANT, value=255))
            readings = []
            for psm in (10, 13):
                self.mode(self.api, psm)
                self.set_image(self.api, crop.ctypes.data, crop.shape[1], crop.shape[0], 1, crop.shape[1])
                text = self.text(self.api)
                try:
                    value = C.string_at(text).decode("utf-8").strip() if text else ""
                    readings.append(dict(psm=psm, text=value, confidence=self.confidence(self.api)))
                finally:
                    if text:
                        self.free(text)
            results.append(readings)
        return results

    def close(self):
        self.delete(self.api)
        self.directory.close()
