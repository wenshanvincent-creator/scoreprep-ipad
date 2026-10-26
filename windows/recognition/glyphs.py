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


def confirmed_shape_evidence(evidence, digit):
    if not evidence or evidence["method"] != "same-page-shape" or evidence["text"] != digit:
        return False
    examples = evidence["exemplars"]
    return (evidence["error"] <= .03 and evidence["nextError"] - evidence["error"] >= .01 and
            len(examples) == 2 and all(p["digit"] == digit and p["score"] >= .85 for p in examples) and
            len({(p["glyph"]["x"], p["glyph"]["y"]) for p in examples}) == 2)


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

    def read_fingering_rows(self, image, rows, scale, prototypes=()):
        """CTC single-character likelihoods, conditioned on an established role.

        The caller must establish complete physical fingering rows first. Keep
        the unconstrained observations and absolute likelihoods in the receipt;
        a conditional posterior alone cannot turn arbitrary marks into digits.
        """
        import cv2
        import numpy as np
        import unicodedata
        cv2.setNumThreads(2)
        if scale > 1:
            image = cv2.resize(image, (round(image.shape[1] * scale), round(image.shape[0] * scale)),
                               interpolation=cv2.INTER_LANCZOS4)
        gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
        _, labels = cv2.connectedComponents((gray < 160).astype("uint8"), 8)

        def glyph_shape(g):
            x, y, width, height = [round(g[k] * scale) for k in ("x", "y", "width", "height")]
            component = labels[y:y + height, x:x + width]
            counts = np.bincount(component.flatten())
            if len(counts) <= 1:
                return None
            ink = (component == counts[1:].argmax() + 1).astype("uint8")
            width = round(width * 40 / height)
            if not 0 < width <= 64:
                return None
            ink = cv2.resize(ink, (width, 40), interpolation=cv2.INTER_NEAREST)
            canvas = np.zeros((48, 64), dtype="float32")
            left = (64 - width) // 2
            canvas[4:44, left:left + width] = ink
            return cv2.GaussianBlur(canvas, (5, 5), 1)

        # Exemplars come only from independently assigned source fingerings on
        # this page, before any of these readings are adopted. No weights or
        # score-specific templates are trained, downloaded or retained.
        shapes = []
        seen = set()
        for p in prototypes:
            g = p["glyph"]
            key = tuple(g[k] for k in ("x", "y", "width", "height"))
            if p["digit"] not in "012345" or len(p["digit"]) != 1 or p["score"] < .85 or key in seen:
                continue
            shape = glyph_shape(g)
            if shape is not None:
                shapes.append((p, shape))
                seen.add(key)

        def compare_shape(g):
            target = glyph_shape(g)
            if target is None:
                return None
            by_digit = {}
            for p, shape in shapes:
                if p["glyph"] == {k: g[k] for k in ("x", "y", "width", "height")}:
                    continue
                if min(g["height"], p["glyph"]["height"]) / max(g["height"], p["glyph"]["height"]) < .75:
                    continue
                error = min(float(np.mean((target - np.roll(np.roll(shape, dy, 0), dx, 1)) ** 2))
                            for dy in (-2, 0, 2) for dx in (-2, 0, 2))
                by_digit.setdefault(p["digit"], []).append(dict(p, error=error))
            classes = []
            for digit, examples in by_digit.items():
                if len(examples) < 2:
                    continue
                examples.sort(key=lambda p: p["error"])
                classes.append((sum(p["error"] for p in examples[:2]) / 2, digit, examples[:2]))
            if len(classes) < 3:
                return None
            classes.sort(key=lambda p: p[0])
            error, digit, examples = classes[0]
            return dict(method="same-page-shape", text=digit, error=error,
                        nextError=classes[1][0], exemplars=examples)

        crops, requests = [], []
        for row_index, row in enumerate(rows):
            for mark_index, mark in enumerate(row["marks"]):
                g = mark["glyph"]
                if len(g["text"]) == 1 and g["text"] in "012345" and g["score"] >= .85:
                    continue
                x, y, width, height = [round(g[k] * scale) for k in ("x", "y", "width", "height")]
                component = labels[y:y + height, x:x + width]
                counts = np.bincount(component.flatten())
                if len(counts) <= 1:
                    continue
                index = counts[1:].argmax() + 1
                crop = image[y:y + height, x:x + width].copy()
                crop[component != index] = 255
                padding = round(height * .35)
                crops.append(cv2.copyMakeBorder(crop, padding, padding, padding, padding,
                                                cv2.BORDER_CONSTANT, value=(255, 255, 255)))
                requests.append((row_index, mark_index))
        indices = {str(i): [] for i in range(6)}
        for index, char in enumerate(self.recognizer.postprocess_op.character):
            canonical = unicodedata.normalize("NFKC", char)
            if canonical in indices:
                indices[canonical].append(index)

        def likelihood(probabilities, index):
            # CTC states: initial blank, one character, trailing blank. Sum all
            # alignments for exactly that character rather than one best frame.
            state = np.array([0., -np.inf, -np.inf])
            for p in np.log(np.maximum(probabilities, 1e-45)):
                state = np.array([state[0] + p[0],
                                  np.logaddexp(state[0], state[1]) + p[index],
                                  np.logaddexp(state[1], state[2]) + p[0]])
            return np.logaddexp(state[1], state[2])

        result = []
        for start in range(0, len(crops), 8):
            batch = np.stack([self.recognizer.resize_norm_img(c, 320 / 48)
                              for c in crops[start:start + 8]]).astype("float32")
            for offset, probabilities in enumerate(self.recognizer.session(batch)):
                scores = {digit: np.logaddexp.reduce([likelihood(probabilities, i) for i in ids])
                          for digit, ids in indices.items()}
                blank = np.log(np.maximum(probabilities[:, 0], 1e-45)).sum()
                normalizer = np.logaddexp.reduce(list(scores.values()))
                best = max(scores, key=scores.get)
                row, mark = requests[start + offset]
                reading = dict(row=row, mark=mark, text=best,
                               conditionalScore=float(np.exp(scores[best] - normalizer)),
                               likelihood=float(np.exp(scores[best])),
                               blankLikelihood=float(np.exp(blank)))
                shape = compare_shape(rows[row]["marks"][mark]["glyph"])
                if shape:
                    reading["shape"] = shape
                result.append(reading)
        return result

    def read(self, image, staff_spacings, top_staff_lines=()):
        import cv2
        if not staff_spacings or min(staff_spacings) <= 0:
            raise ValueError("Glyph recognition needs measured source staff spacing")
        cv2.setNumThreads(2)
        scale = min(3, max(1, 24 / statistics.median(staff_spacings)))
        if scale > 1:
            image = cv2.resize(image, (round(image.shape[1] * scale), round(image.shape[0] * scale)),
                               interpolation=cv2.INTER_LANCZOS4)
        observations = self._read_view(image, staff_spacings, scale)
        if top_staff_lines:
            import numpy as np
            separated = image.copy()
            crossings = image.copy()
            original_gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
            for line in top_staff_lines:
                points = np.rint(np.asarray(line["points"]) * scale).astype("int32")
                cv2.polylines(separated, [points], False, (255, 255, 255),
                              max(1, round(line["thickness"] * scale + 2)))
                radius = round(line["thickness"] * scale / 2 + 2)
                for a, b in zip(points, points[1:]):
                    for x in range(max(0, a[0]), min(image.shape[1], b[0] + 1)):
                        y = round(a[1] + (b[1] - a[1]) * (x - a[0]) / max(1, b[0] - a[0]))
                        low, high = y - radius, y + radius + 1
                        if low < 2 or high + 2 > image.shape[0]:
                            continue
                        # A printed digit may cross the line. Erasing the entire
                        # strip cuts its stem into two unrecognizable fragments.
                        # Keep original ink only where it continues on both sides.
                        if not (original_gray[low - 2:low, x].min() < 160 and
                                original_gray[high:high + 2, x].min() < 160):
                            crossings[low:high, x] = 255
            spacing = statistics.median(staff_spacings)
            candidates = [(g, "top-staff-line-separated")
                          for g in self._read_view(separated, staff_spacings, scale)]
            candidates.extend((g, "top-staff-line-crossing-preserved")
                              for g in self._read_view(crossings, staff_spacings, scale))
            for candidate, view in candidates:
                if (len(candidate["text"]) != 1 or candidate["text"] not in "012345" or
                        candidate["score"] < 0.95):
                    continue
                x = candidate["x"] + candidate["width"] / 2
                bottom = candidate["y"] + candidate["height"]
                # Only recover a glyph ending at the upper edge of a staff.
                # Splitting all five lines creates stem fragments resembling 1s.
                touching = False
                for line in top_staff_lines:
                    points = line["points"]
                    if not points[0][0] <= x <= points[-1][0]:
                        continue
                    for a, b in zip(points, points[1:]):
                        if a[0] <= x <= b[0]:
                            y = a[1] + (b[1] - a[1]) * (x - a[0]) / (b[0] - a[0])
                            depth = 0.75 if view.endswith("crossing-preserved") else 0.5
                            touching = candidate["y"] < y and abs(bottom - y) <= spacing * depth
                            break
                    if touching:
                        break
                if not touching:
                    continue

                def same_component(original):
                    right = min(original["x"] + original["width"],
                                candidate["x"] + candidate["width"])
                    low = min(original["y"] + original["height"], bottom)
                    intersection = (max(0, right - max(original["x"], candidate["x"])) *
                                    max(0, low - max(original["y"], candidate["y"])))
                    smaller = min(original["width"] * original["height"],
                                  candidate["width"] * candidate["height"])
                    return intersection / smaller >= 0.5
                if not any(same_component(original) for original in observations):
                    candidate["view"] = view
                    observations.append(candidate)
        return dict(model=REC_MODEL, modelSHA256=REC_SHA256, resizeScale=scale, glyphs=observations)

    def _read_view(self, image, staff_spacings, scale):
        import cv2
        import numpy as np
        from rapidocr.ch_ppocr_rec.typings import TextRecInput
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
        return observations


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
