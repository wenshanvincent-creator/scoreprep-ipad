# Complementary recognition components

These components are under development. They are not yet part of the installed
Windows application. The release goal includes full recognition and installed
application verification; these modules alone do not satisfy it.

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
Homr and its three model assets retain the provenance recorded in
[`backend/notices/PROVENANCE.md`](../../backend/notices/PROVENANCE.md).
Bundled runtime, complete source/license notices and offline installation
verification remain required before distribution.

Developer checks from `windows/`:

```powershell
node --import tsx --test tests/layout-evidence.test.ts
node --import tsx scripts/inspect-recognition.ts INPUT NEW_OUTPUT --layout PAGE.omr --source-size WIDTHxHEIGHT
# In the pinned evaluation environment; runs the real glyph model on owned data:
python recognition/test_glyph_reader.py
```

The supplied dimensions are those of the source raster used by homr. This
developer interface is not an application setup screen. The final import flow
must derive dimensions and enforce common source provenance automatically.
