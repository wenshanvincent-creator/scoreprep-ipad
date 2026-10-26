import { test } from 'node:test';
import assert from 'node:assert/strict';
import { recognitionError } from '../electron/recognition-error';

test('actual low-resolution rejection reports the detected staff spacing', () => {
  const log =
    'With a too low interline value of 3 pixels,\n either this sheet contains no multi-line staves,\n or the picture resolution is too low (try 300 DPI).';
  assert.match(recognitionError(1, log), /3 像素/);
  assert.match(recognitionError(1, log), /原始 PDF/);
});

test('an unrelated engine failure does not blame a clear source image', () => {
  assert.doesNotMatch(recognitionError(1, 'Failed to load a native library'), /分辨率|清晰|换用/);
});
