"""Real CPU OCR regression on the owned printed exercise, not note assignment."""
from pathlib import Path
import unittest
import xml.etree.ElementTree as ET

import cv2
import numpy as np
from glyphs import GlyphReader


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


if __name__ == "__main__":
    unittest.main()
