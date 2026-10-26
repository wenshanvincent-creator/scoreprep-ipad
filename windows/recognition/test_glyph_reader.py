"""Real CPU OCR regression on the owned printed exercise, not note assignment."""
from pathlib import Path
import unittest
import xml.etree.ElementTree as ET
import json

import cv2
import numpy as np
from glyphs import GlyphReader, confirmed_shape_evidence, glyph_crop, ink_runs


class PrintedGlyphTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.reader = GlyphReader()

    def test_digits_stay_separate_from_stems_and_input_pixels_survive(self):
        fixtures = Path(__file__).resolve().parents[1] / "tests" / "fixtures"
        image = cv2.imread(str(fixtures / "cello-study.png"))
        original = image.copy()
        result = self.reader.read(image, [27])
        # This row was annotated on the original owned PNG, independently of OCR.
        # It contains the source fingering row; title and staff text lie outside it.
        printed_row = sorted((g for g in result["glyphs"] if 200 <= g["y"] <= 260),
                             key=lambda g: g["x"])
        reference = ET.parse(fixtures / "cello-study.musicxml").getroot()
        expected = [n.text for n in reference.findall(".//technical/fingering")]
        self.assertEqual([g["text"] for g in printed_row], expected)
        self.assertTrue(all(g["score"] >= 0.85 for g in printed_row))
        self.assertTrue(np.array_equal(image, original))

    def test_fingering_touching_a_staff_edge_is_recovered_without_duplicate_glyphs(self):
        fixtures = Path(__file__).resolve().parents[1] / "tests" / "fixtures"
        image = cv2.imread(str(fixtures / "cello-study.png"))
        # Synthetic contact on a real owned printed 1, preserving the source file.
        cv2.line(image, (650, 248), (725, 248), (0, 0, 0), 1)
        original = image.copy()
        result = self.reader.read(image, [27], [dict(points=[(650, 248), (725, 248)], thickness=1)])
        row = sorted((g for g in result["glyphs"] if 200 <= g["y"] <= 260), key=lambda g: g["x"])
        expected = [n.text for n in ET.parse(fixtures / "cello-study.musicxml").findall(".//technical/fingering")]
        self.assertEqual([g["text"] for g in row], expected)
        recovered = [g for g in row if g.get("view") in
                     ("top-staff-line-separated", "top-staff-line-crossing-preserved")]
        self.assertEqual(len(recovered), 1)
        self.assertEqual(recovered[0]["text"], "1")
        self.assertTrue(np.array_equal(image, original))

    def test_role_conditioning_keeps_absolute_evidence_and_does_not_force_a_true_eight(self):
        fixtures = Path(__file__).resolve().parents[1] / "tests" / "fixtures"
        image = cv2.imread(str(fixtures / "fingering-roles-study.png"))
        original = image.copy()
        observed = json.loads((fixtures / "fingering-roles-glyphs.json").read_text(encoding="utf-8"))
        three = next(g.copy() for g in observed["glyphs"] if g["text"] == "3" and g["y"] < 160)
        # A controlled observation error; the original owned pixels still show 3.
        three.update(text="8", score=.95)
        eight = json.loads((fixtures / "fingering-roles-true-eight.json").read_text(encoding="utf-8"))["glyph"]
        rows = [{"marks": [{"glyph": three}]}, {"marks": [{"glyph": eight}]}]
        result = self.reader.read_fingering_rows(image, rows, observed["resizeScale"])
        self.assertEqual(result[0]["text"], "3")
        self.assertGreater(result[0]["conditionalScore"], .9)
        self.assertGreater(result[0]["likelihood"], .01)
        self.assertLess(result[1]["likelihood"], .01)
        self.assertEqual(len(result[1]["contrastReadings"]), 2)
        self.assertTrue(all(r["likelihood"] < .01 for r in result[1]["contrastReadings"]))
        self.assertTrue(np.array_equal(image, original))

    def test_digit_crossing_staff_line_keeps_its_stem_and_remains_one_glyph(self):
        fixtures = Path(__file__).resolve().parents[1] / "tests" / "fixtures"
        image = cv2.imread(str(fixtures / "cello-study.png"))
        # The same owned printed 1 now crosses the line through its middle.
        # A strip erasure splits it; preserving the vertical crossing must keep it.
        cv2.line(image, (650, 235), (725, 235), (0, 0, 0), 1)
        original = image.copy()
        result = self.reader.read(image, [27], [dict(points=[(650, 235), (725, 235)], thickness=1)])
        row = sorted((g for g in result["glyphs"] if 200 <= g["y"] <= 260), key=lambda g: g["x"])
        expected = [n.text for n in ET.parse(fixtures / "cello-study.musicxml").findall(".//technical/fingering")]
        self.assertEqual([g["text"] for g in row], expected)
        restored = [g for g in row if g.get("view") == "top-staff-line-crossing-preserved"]
        self.assertEqual(len(restored), 1)
        self.assertEqual(restored[0]["text"], "1")
        self.assertTrue(np.array_equal(image, original))

    def test_same_page_shapes_exclude_the_target_and_reject_a_genuine_eight(self):
        fixtures = Path(__file__).resolve().parents[1] / "tests" / "fixtures"
        image = cv2.imread(str(fixtures / "fingering-roles-study.png"))
        original = image.copy()
        observed = json.loads((fixtures / "fingering-roles-glyphs.json").read_text(encoding="utf-8"))
        evidence = json.loads((fixtures / "fingering-roles-shape.json").read_text(encoding="utf-8"))
        three = next(g.copy() for g in observed["glyphs"] if g["text"] == "3" and g["y"] < 160)
        three.update(text="8", score=.95)
        eight = json.loads((fixtures / "fingering-roles-true-eight.json").read_text(encoding="utf-8"))["glyph"]
        rows = [{"marks": [{"glyph": three}]}, {"marks": [{"glyph": eight}]}]
        readings = self.reader.read_fingering_rows(image, rows, observed["resizeScale"], evidence["prototypes"])
        json.dumps(readings)  # The actual desktop worker writes these receipts as JSON.
        self.assertEqual(readings[0]["shape"]["text"], "3")
        self.assertTrue(confirmed_shape_evidence(readings[0]["shape"], "3"))
        self.assertFalse(confirmed_shape_evidence(readings[1]["shape"], readings[1]["shape"]["text"]))
        self.assertTrue(all(p["glyph"]["x"] != three["x"] for p in readings[0]["shape"]["exemplars"]))
        self.assertTrue(np.array_equal(image, original))

    def test_two_contrast_views_recover_faded_ink_without_changing_source_pixels(self):
        fixtures = Path(__file__).resolve().parents[1] / "tests" / "fixtures"
        evidence = json.loads((fixtures / "fingering-faint-zero.json").read_text(encoding="utf-8"))
        image = cv2.imread(str(fixtures / "fingering-roles-study.png"))
        g = evidence["glyph"].copy()
        x, y, w, h = [round(g[k]) for k in ("x", "y", "width", "height")]
        region = image[y + round(h * (1 - evidence["fadeBottomFraction"])):y + h, x:x + w]
        region[cv2.cvtColor(region, cv2.COLOR_BGR2GRAY) < 160] = evidence["inkGray"]
        original = image.copy()
        g.update(text="n", score=.2)
        result = self.reader.read_fingering_rows(image, [{"marks": [{"glyph": g}]}], evidence["resizeScale"])[0]
        self.assertLess(result["likelihood"], .01)
        self.assertEqual([r["threshold"] for r in result["contrastReadings"]], [190, 220])
        self.assertTrue(all(r["text"] == "0" and r["conditionalScore"] >= .9 and r["likelihood"] >= .01
                            for r in result["contrastReadings"]))
        self.assertTrue(np.array_equal(image, original))

    def test_measured_staff_occlusion_compares_only_retained_owned_zero_strokes(self):
        fixtures = Path(__file__).resolve().parents[1] / "tests" / "fixtures"
        image = cv2.imread(str(fixtures / "cello-study.png"))
        observed = json.loads((fixtures / "cello-glyphs.json").read_text(encoding="utf-8"))
        glyphs = [g for g in observed["glyphs"] if 200 < g["y"] < 260]
        target = next(g.copy() for g in glyphs if g["text"] == "0")
        x, y, w, h = [round(target[k]) for k in ("x", "y", "width", "height")]
        gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
        _, labels = cv2.connectedComponents((gray < 160).astype('uint8'), 8)
        component = labels[y:y + h, x:x + w]
        counts = np.bincount(component.flatten())
        ink = component == counts[1:].argmax() + 1
        band = np.zeros((h, w), dtype='uint8')
        band[h // 2 - 2:h // 2 + 3] = 1
        image[y:y + h, x:x + w][band.astype(bool)] = 0
        original = image.copy()
        target.update(text='n', score=.2, inkScale=1,
                      inkRuns=ink_runs(ink & ~band.astype(bool)), occludedRuns=ink_runs(band))
        prototypes = [dict(digit=g['text'], score=g['score'],
                           glyph={k: g[k] for k in ('x', 'y', 'width', 'height')})
                      for g in glyphs if g['x'] != x and g['text'] in '012345']
        reading = self.reader.read_fingering_rows(image, [{'marks': [{'glyph': target}]}], 1, prototypes)[0]
        self.assertEqual(reading['shape']['text'], '0')
        partial = reading['partialShape']
        self.assertTrue(partial['ignoredStaffBand'])
        self.assertTrue(confirmed_shape_evidence(partial, '0'))
        self.assertLess(partial['visibleFraction'], 1)
        self.assertTrue(np.array_equal(image, original))
        json.dumps(reading)

    def test_interlocking_fragments_retain_both_strokes_as_a_proposal(self):
        from types import SimpleNamespace
        fixtures = Path(__file__).resolve().parents[1] / "tests" / "fixtures"
        observed = json.loads((fixtures / "cello-glyphs.json").read_text(encoding="utf-8"))
        g = next(g for g in observed["glyphs"] if g["text"] == "4" and 200 < g["y"] < 260)
        image = cv2.imread(str(fixtures / "cello-study.png"))
        x, y, w, h = [round(g[k]) for k in ("x", "y", "width", "height")]
        patch = image[y:y + h, x:x + w].copy()
        yy, xx = np.indices((h, w))
        # Owned stress variant: one slightly larger printed 4 with a thin break.
        # Low part-confidence is controlled; the union and rereading use real ink.
        patch[np.abs(yy - (h * .5 - .3 * (xx - w / 2))) < .65] = 255
        patch = cv2.resize(patch, (round(w * 1.2), round(h * 1.2)), interpolation=cv2.INTER_NEAREST)
        image[y:y + h, x:x + w] = 255
        image[y:y + patch.shape[0], x:x + patch.shape[1]] = patch
        original = image.copy()
        recognizer = self.reader.recognizer
        calls = 0

        def recognize(inputs):
            nonlocal calls
            result = recognizer(inputs)
            calls += 1
            return SimpleNamespace(txts=result.txts, scores=[.2] * len(result.scores)) if calls == 1 else result

        self.reader.recognizer = recognize
        try:
            result = self.reader.read(image, [27])
        finally:
            self.reader.recognizer = recognizer
        joined = next(v for v in result["glyphs"] if v.get("view") == "interlocking-components" and 200 < v["y"] < 260)
        self.assertTrue(joined["proposalOnly"])
        self.assertEqual(len(joined["parts"]), 2)
        gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
        _, labels = cv2.connectedComponents((gray < 160).astype("uint8"), 8)
        crop = glyph_crop(image, labels, joined, 1)
        gx, gy, gw, gh = [round(joined[k]) for k in ("x", "y", "width", "height")]
        self.assertTrue(np.all(crop >= image[gy:gy + gh, gx:gx + gw]))
        readings = self.reader.read_fingering_rows(image, [{"marks": [{"glyph": joined}]}], 1)
        self.assertEqual(readings[0]["text"], "4")
        self.assertGreater(readings[0]["conditionalScore"], .9)
        self.assertGreater(readings[0]["likelihood"], .01)
        self.assertTrue(np.array_equal(image, original))
        json.dumps(result)


if __name__ == "__main__":
    unittest.main()
