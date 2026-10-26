"""Actual bundled unrestricted OCR: owned digits, true numeral and literal letter."""
from pathlib import Path
import json
import unittest
import cv2
import numpy as np
from PIL import Image, ImageDraw, ImageFont
from printed_text import PrintedTextReader, JARS


class PrintedTextTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.root = Path(__file__).resolve().parents[1]
        cls.cache = cls.root / '.test-data' / 'printed-text-tests'
        cls.cache.mkdir(exist_ok=True)
        cls.reader = PrintedTextReader(cls.root / '.runtime' / 'extracted' / 'Audiveris', cls.cache / 'native')

    @classmethod
    def tearDownClass(cls):
        cls.reader.close()

    def test_real_three_eight_and_letter_remain_distinct_without_whitelisting(self):
        f = self.root / 'tests' / 'fixtures'
        receipt = json.loads((f / 'fingering-unrestricted-text.json').read_text(encoding='utf-8'))
        image = cv2.imread(str(f / 'fingering-roles-study.png'))
        original = image.copy()
        readings = self.reader.read(image, [receipt['glyphs']['three'], receipt['glyphs']['eight']], receipt['resizeScale'])
        self.assertTrue(all(r['text'] == '3' and r['confidence'] >= 90 for r in readings[0]))
        self.assertTrue(all(r['text'] == '8' for r in readings[1]))
        self.assertTrue(np.array_equal(image, original))
        letter = Image.new('RGB', (64, 64), 'white')
        ImageDraw.Draw(letter).text((15, 10), 'A', font=ImageFont.load_default(size=32), fill='black')
        image = cv2.cvtColor(np.array(letter), cv2.COLOR_RGB2BGR)
        _, _, stats, _ = cv2.connectedComponentsWithStats((cv2.cvtColor(image, cv2.COLOR_BGR2GRAY) < 160).astype('uint8'), 8)
        x, y, w, h, _ = stats[1]
        readings = self.reader.read(image, [dict(x=int(x), y=int(y), width=int(w), height=int(h))], 1)
        self.assertTrue(all(r['text'] == 'A' and r['confidence'] >= 90 for r in readings[0]))

    def test_changed_bundled_asset_fails_before_native_loading(self):
        fake = self.cache / 'changed-runtime'
        (fake / 'app').mkdir(exist_ok=True, parents=True)
        (fake / 'app' / next(iter(JARS))).write_bytes(b'changed asset')
        with self.assertRaisesRegex(ValueError, 'SHA-256 mismatch'):
            PrintedTextReader(fake, self.cache / 'must-not-load')


if __name__ == '__main__':
    unittest.main()
