"""Real CPU OCR regression on the owned printed exercise, not note assignment."""
from pathlib import Path
import unittest
import xml.etree.ElementTree as ET

import cv2
import numpy as np
from glyphs import GlyphReader


class PrintedGlyphTest(unittest.TestCase):
    def test_digits_stay_separate_from_stems_and_input_pixels_survive(self):
        fixtures = Path(__file__).resolve().parents[1] / "tests" / "fixtures"
        image = cv2.imread(str(fixtures / "cello-study.png"))
        original = image.copy()
        result = GlyphReader().read(image, [27])
        # This row was annotated on the original owned PNG, independently of OCR.
        # It contains the source fingering row; title and staff text lie outside it.
        printed_row = sorted((g for g in result["glyphs"] if 200 <= g["y"] <= 260),
                             key=lambda g: g["x"])
        reference = ET.parse(fixtures / "cello-study.musicxml").getroot()
        expected = [n.text for n in reference.findall(".//technical/fingering")]
        self.assertEqual([g["text"] for g in printed_row], expected)
        self.assertTrue(all(g["score"] >= 0.85 for g in printed_row))
        self.assertTrue(np.array_equal(image, original))


if __name__ == "__main__":
    unittest.main()
