"""Read isolated printed glyphs for later source-mark association.

These are text observations, not yet fingerings. Musical role and note ownership
must be checked against the staff layout before a mark is inserted or masked.
"""
import hashlib
import importlib.metadata
from pathlib import Path
import statistics

REC_MODEL = "ch_PP-OCRv4_rec_infer.onnx"
REC_SHA256 = "48fc40f24f6d2a207a2b1091d3437eb3cc3eb6b676dc3ef9c37384005483683b"


class GlyphReader:
    def __init__(self):
        if importlib.metadata.version("rapidocr") != "3.7.0":
            raise RuntimeError("The glyph reader requires pinned RapidOCR 3.7.0")
        import rapidocr
        from rapidocr.ch_ppocr_rec import TextRecognizer
        from rapidocr.utils.parse_parameters import ParseParams
        root = Path(rapidocr.__file__).parent
        model = root / "models" / REC_MODEL
        with model.open("rb") as stream:
            if hashlib.file_digest(stream, "sha256").hexdigest() != REC_SHA256:
                raise RuntimeError("Printed-glyph OCR model SHA-256 mismatch")
        config = ParseParams.load(root / "config.yaml")
        config.Rec.engine_cfg = config.EngineConfig.onnxruntime
        config.Rec.engine_cfg.intra_op_num_threads = 2
        config.Rec.engine_cfg.inter_op_num_threads = 1
        config.Rec.model_path = str(model)
        config.Rec.font_path = None
        config.Rec.rec_batch_num = 8
        self.recognizer = TextRecognizer(config.Rec)

    def read(self, image, staff_spacings):
        import cv2
        import numpy as np
        from rapidocr.ch_ppocr_rec.typings import TextRecInput
        if not staff_spacings or min(staff_spacings) <= 0:
            raise ValueError("Glyph recognition needs measured source staff spacing")
        cv2.setNumThreads(2)
        scale = min(3, max(1, 24 / statistics.median(staff_spacings)))
        if scale > 1:
            image = cv2.resize(image, (round(image.shape[1] * scale), round(image.shape[0] * scale)),
                               interpolation=cv2.INTER_LANCZOS4)
        gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
        count, labels, stats, _ = cv2.connectedComponentsWithStats((gray < 160).astype("uint8"), 8)
        low, high = min(staff_spacings) * scale, max(staff_spacings) * scale
        crops, observations = [], []
        for index in range(1, count):
            x, y, width, height, area = map(int, stats[index])
            if not (0.65 * low <= height <= 1.7 * high and
                    0.08 * low <= width <= 1.3 * high and
                    0.08 <= width / height <= 1.3 and
                    0.12 <= area / (width * height) <= 0.8):
                continue
            glyph = image[y:y + height, x:x + width].copy()
            # Padding a raw crop also includes nearby stems/dots. Only retain
            # this connected component so an isolated 3 does not become "3.".
            glyph[labels[y:y + height, x:x + width] != index] = 255
            padding = round(height * 0.35)
            crops.append(cv2.copyMakeBorder(glyph, padding, padding, padding, padding,
                                           cv2.BORDER_CONSTANT, value=(255, 255, 255)))
            observations.append(dict(x=x / scale, y=y / scale, width=width / scale,
                                     height=height / scale))
        if crops:
            result = self.recognizer(TextRecInput(img=crops))
            for observation, text, score in zip(observations, result.txts, result.scores, strict=True):
                observation.update(text=text, score=float(score))
        return dict(model=REC_MODEL, modelSHA256=REC_SHA256, resizeScale=scale, glyphs=observations)


if __name__ == "__main__":
    import argparse
    import json
    import time
    import cv2
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("image", type=Path)
    parser.add_argument("spacing", type=float, help="Measured source staff spacing")
    parser.add_argument("output", type=Path)
    args = parser.parse_args()
    source = args.image.read_bytes()
    import numpy as np
    image = cv2.imdecode(np.frombuffer(source, dtype="uint8"), cv2.IMREAD_COLOR)
    if image is None:
        raise ValueError("Cannot read the source raster")
    started = time.monotonic()
    result = GlyphReader().read(image, [args.spacing])
    result.update(sourceSHA256=hashlib.sha256(source).hexdigest(),
                  seconds=round(time.monotonic() - started, 2))
    args.output.write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps(dict(glyphs=len(result["glyphs"]), seconds=result["seconds"])))
