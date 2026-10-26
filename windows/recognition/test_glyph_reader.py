"""Real CPU OCR regression on the owned printed exercise, not note assignment."""
from pathlib import Path
import unittest
import xml.etree.ElementTree as ET
import json

import cv2
import numpy as np
from glyphs import GlyphReader, confirmed_shape_evidence


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
        recovered = [g for g in row if g.get("view") == "top-staff-line-separated"]
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
        self.assertEqual(readings[0]["shape"]["text"], "3")
        self.assertTrue(confirmed_shape_evidence(readings[0]["shape"], "3"))
        self.assertFalse(confirmed_shape_evidence(readings[1]["shape"], readings[1]["shape"]["text"]))
        self.assertTrue(all(p["glyph"]["x"] != three["x"] for p in readings[0]["shape"]["exemplars"]))
        self.assertTrue(np.array_equal(image, original))


if __name__ == "__main__":
    unittest.main()
