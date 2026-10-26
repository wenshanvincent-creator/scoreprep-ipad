# Complementary recognition components

The development desktop now runs this worker automatically during PDF/image
import. The installed application has not yet been replaced: full source-score
accuracy and packaged/installed acceptance remain required.

`electron/recognition-pipeline.ts` rasterizes every page into a common PNG frame,
runs Audiveris for independent source geometry, and runs the bounded homr worker
for note recognition. Measured small-staff rejection triggers the validated
resize/contrast view for source geometry. The neural model continues to see the
canonical page, not that contrast view. Source/model hashes are checked before
combining observations. Per-page editions are reconciled before MusicXML pages
are joined; a structurally permitted partial final bar cannot hide an unresolved
source-backed tuplet conflict.

`worker.py` is a separate CLI with `pages`, `binarize`, `recognize`, `fingerings` and `compare`
operations. It writes atomic result JSON plus local logs, preserves input bytes,
loads only verified CPU assets, disables Python network connections and records
attempts. The desktop invokes the bundled interpreter in isolated UTF-8 mode
without writing bytecode. No interpreter, Java installation, server or key is
required from the end user. The source app's queue owns and cancels each child
process tree; incomplete work is requeued after restart.

`glyphs.py` reads isolated printed components with the RapidOCR 3.7.0 PaddleOCR
recognition model. It verifies model SHA-256 before loading, uses two CPU threads,
and excludes nearby stems/dots from each glyph crop. It returns source-coordinate
observations, not inferred fingering assignments. Text role, note ownership,
brackets and existing source marks must be checked before inserting or masking
any observation. A printed numeral is not automatically a fingering.

Upstream `imgpos` comments are approximate attention locations. Their Y coordinate
can land near a stem or fingering rather than the head. A nearest-point association
produced missed and incorrect assignments even when all owned glyph texts were
correct. Association needs the source staff grid and pitch, and source head
positions for horizontal alignment; it is not implemented by `GlyphReader`.

`src/core/source-marks.ts` implements that association using the source clef and
staff grid, with ordered one-to-one head registration for single melodic voices.
Only a pairing shared by every optimal registration becomes source-head
evidence. Existing printed fingerings are retained; competing digits and
ambiguous ownership are reported. A numeral supporting an existing tuplet is
protected. Actual owned homr output plus glyph observations restores all 16
original printed fingerings on their correct notes without changing musical
events or generating recommendations.

`src/core/fingering-rows.ts` establishes a numeric fingering role before asking
for a restricted-alphabet rereading. Every independently matched head in a
complete source beam group must own one similarly sized numeral, with two
recognizable finger digits including 0/1. Supported model/source tuplet numerals
remain protected. Wind parts do not use this role restriction.

For those eligible rows only, the glyph worker sums single-character CTC paths
over digits 0–5. Receipts retain the original unrestricted reading, conditional
posterior, absolute character-sequence likelihood and blank likelihood. Adoption
requires a conditional posterior of at least .9 and absolute likelihood of at
least .01; these filters are not whole-score accuracy probabilities. An original
numeral is never changed merely because it resembles 8. Unresolved eligible
rows produce a specific source-fingering error rather than dropping their marks.

The owned 36-note study supplies actual source layout and OCR evidence, including
true triplets, quintuplets and an octuplet. A deliberately corrupted observation
of its printed 3 is recovered from the original pixels; all 12 fingerings and
musical events match its independently authored source. A real printed octuplet
8 fails the absolute-evidence gate. Missing rows/beam links and tuplet membership
also prevent a role-restricted reading. This is a controlled observation-error
regression, separate from the private page's actual old-font confusion.

`src/core/source-ornaments.ts` checks a second actual inference in which only
confirmed source fingering glyphs were removed. It accepts trill removal only at
those masked occurrences, with unchanged musical events/context and the same
independently detected source head in both results. An owned reference with two
genuine trills plus fingerings and one fingering alone preserves both real trills,
removes only the false extra trill and restores all three source fingerings.
Changed pitches/rhythm or ambiguous physical ownership cause abstention.

An optional `top_staff_lines` argument to `GlyphReader.read` accepts source-scale
polylines as `{"points": [[x, y], ...], "thickness": pixels}`. A separate OCR copy
removes only this upper staff edge to uncover touching digits. New observations
must end at that edge, pass a stricter score threshold and not overlap a glyph
already read from the original. The music recognizer still receives its original
input. Removing all five lines was rejected because it created stem fragments
that looked like digits. An actual model test preserves all 16 original digits
after synthetic contact on one printed 1, with no duplicate and unchanged input
pixels.

`src/core/source-rhythm.ts` resolves a malformed equal-note tuplet only when
every note has a distinct source head and stem in the same complete physical
beam group, the image supports an associated fingering 0 or 1, and no remaining
numeral or detected tuplet contradicts it. It does not use meter fullness.
Original owned MusicXML, independently rendered source positions and actual
Audiveris/OCR observations verify recovery of a deliberately introduced four-note
3:2 error while preserving real triplets, quintuplets and nine source fingerings.

`src/core/source-accidentals.ts` recovers an accidental anticipated from the next
occurrence of a pitch. It requires two literal source signs linked to distinct
heads, the preceding model pitch agreeing with its printed sign, exactly three
source occurrences between the signs, and a shared physical source measure.
An existing explicit accidental, tie, missing sign or unresolved source symbol
prevents this correction. The controlled owned reference covers carried naturals,
octave-specific alterations and a bar reset. This fixes the verified early-flat
error on the private page without changing any note's timing.

The existing `src/core/layout-evidence.ts` reconciles a model clef using detected
source clefs and spatially matched independent noteheads. It does not use a chosen
instrument, expected note count or hardcoded measures. At least six distinct
head anchors must support the same interpretation, with at least 90% agreement
among matched anchors; these are evidence filters, not accuracy probabilities.
Missing/contradictory geometry causes abstention. Ordinary source tenor-to-bass
clef changes remain intact.

## Evaluation environment

The isolated Windows Python 3.12.14 environment was verified with the exact
packages in `requirements.txt`. Install that complete list using `--no-deps`.
RapidOCR requests `opencv-python` while homr requests its headless counterpart;
this worker intentionally installs only `opencv-python-headless==4.13.0.92`.
Both provide `cv2`, and the upstream
[installation guidance](https://pypi.org/project/opencv-python-headless/)
requires selecting one variant. No OpenCV GUI is used. This choice was checked
with actual homr and glyph inference, not just an import check.

The owned 16-note score matched all reference pitch/onset/duration events in
this environment. A full dense-page baseline reproduced the three raw timing
failures and the known clef error observed in the earlier environment. The
experiments retain raw model output and leave upstream metrical tuplet cleanup
disabled.

The glyph model is distributed in the pinned RapidOCR wheel as
`models/ch_PP-OCRv4_rec_infer.onnx`, SHA-256
`48fc40f24f6d2a207a2b1091d3437eb3cc3eb6b676dc3ef9c37384005483683b`.
RapidOCR uses [Apache-2.0](https://github.com/RapidAI/RapidOCR/blob/main/LICENSE).
Glyph OCR also examines copies with the top staff line separated. Only continuous
vertical ink survives the line strip. Interlocking disconnected strokes can form
one candidate; strong original glyphs and ambiguous pairings are preserved.
Recorded ink masks retain the measured source components without painting new
ink. These view candidates require verification even when their
initial OCR confidence is high; staff fragments cannot hide an original numeral.
The original image and music-model input remain unchanged.

Source stem rows or a sparse numeric line with at least three already assigned,
same-size digits on the same staff establish a fingering context. Context must
include 0/1 and two distinct digits. Extra strong heads, unmatched stems, chords,
supported tuplets and strong literal letters prevent a constrained interpretation.
Existing source-supported rhythm corrections can resolve mark roles first; the
final edition is rebuilt and checked after the mark readings. Unresolved digits can be
compared with already assigned digits on the same page. This uses two distinct
exemplar glyphs, preserved aspect ratios, bounded pixel error and separation
from competing digits. Exemplars are chosen before adopting any new readings;
no model is trained and no page templates are retained. Shape evidence keeps its
own distances and source rectangles; it never substitutes a fabricated OCR
probability. True tuplet numerals remain protected before this stage. The owned
negative control also queries a genuine 8 directly and rejects its pixel match.
For a digit intersected by the measured staff band, a separate shape comparison
can exclude that band. At least 60% of the normalized comparison must remain;
the winning digit must agree with the full comparison and meet the same two
exemplar, error and separation gates. Missing strokes are never reconstructed.
Standalone weak digits can only be verified as the same digit. Faint strokes
require agreement at both contrast thresholds, with absolute CTC evidence.
Remaining contextual ambiguities use two unrestricted Tesseract readings from
the existing hashed Audiveris assets. Their native confidence values are retained;
there is no character whitelist, server, download or model training. Controls
retain genuine 8 and literal A. Masks, alternative heads and numeric context are
recorded alongside adopted readings for inspection.
Homr and its three model assets retain the provenance recorded in
[`backend/notices/PROVENANCE.md`](../../backend/notices/PROVENANCE.md).
The private desktop candidate now bundles the runtime and complete source/license
notices. Final quality gates and installed replacement remain required.

## Portable build runtime

The developer prepares an isolated Python **3.12.14** environment with the exact
requirements above (`uv venv --python 3.12.14` and `uv pip install --no-deps -r
recognition/requirements.txt`). In that environment, `python -m homr.main --gpu
no --no-title --init` downloads the three CPU assets. This is a build step; the
desktop worker never downloads them. The packager verifies the Git revision,
dependency versions and final asset hashes.

Run `python recognition/package_runtime.py --python-home PYTHON_BASE
--site-packages VERIFIED_SITE_PACKAGES .runtime/neural` with that environment's
interpreter. `PYTHON_BASE` is its `sys.base_prefix`. This makes a fresh portable
runtime from an allowlist, omitting virtual-environment launchers/configuration,
bytecode, tests and developer caches. Its receipt contains relative file paths
and hashes. It does not copy a development checkout or any score/library data.

`npm run runtime` verifies the portable files, synchronizes the worker source and
includes the pinned upstream source archive and full license/FAQ/build notices.
The archive SHA-256 is
`23c81d6783c995866c256dba403bfa374639aeb20df64b738a0fc0034d160315`.
`npm run package` bundles this runtime alongside Audiveris. See NOTICE.md for the
worker's AGPL scope and the upstream model-permission caveat.

Developer checks from `windows/`:

```powershell
node --import tsx --test tests/layout-evidence.test.ts tests/source-marks.test.ts tests/source-rhythm.test.ts tests/source-accidentals.test.ts
node --import tsx scripts/inspect-recognition.ts INPUT NEW_OUTPUT --layout PAGE.omr --source-size WIDTHxHEIGHT --glyphs OBSERVATIONS.json
# In the pinned evaluation environment; runs the real glyph model on owned data:
python recognition/test_glyph_reader.py
python recognition/test_printed_text.py
```

The supplied dimensions are those of the source raster used by homr. This
developer interface is not an application setup screen. The desktop import flow
derives these dimensions and verifies common source provenance automatically.
The inspection report lists partial measures separately: a permitted pickup or
partial final measure is a structural allowance, not evidence of correct rhythm.

`src/core/voices.ts` serializes eligible interleaved MusicXML voice/staff lanes
before direct engraving. The engraver otherwise misinterpreted the piano model's
short backups, despite the explicit input note times being correct. Actual model
output now matches the independently authored reference's 64 rendered note
onsets/ends, 32 attack groups and 32 quarters. A genuine chord and printed
fingerings also survive serialization. Timed mid-bar controls and cross-staff
voices retain their input order; no pitches, durations or missing beats are added.
