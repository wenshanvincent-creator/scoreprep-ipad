# Owned cello recognition regression

`cello-study.musicxml` is an original ScorePrep four-bar cello exercise, containing
tenor-to-bass clef change and printed fingerings. `cello-study.png` is rendered
from that source with the pinned Verovio distribution.

`cello-audiveris.musicxml` is actual Audiveris 5.11.0 Windows CPU inference output
from this image, with only local source-file metadata removed. The run exited 0
in 31.35 seconds on 26 October 2026. All 16 pitches and both clefs were recognized.
The classifier read two printed fingering 3s as triplets, producing two incomplete
4/4 bars, and omitted open-string zero markings. The regression test checks the
bounded metrical/geometric disambiguation, unchanged valid triplets, preservation
of recognized source fingerings, and the final recommended fingering/pitch/timing
sequence against the source. It is a specific regression, not a general accuracy
benchmark or a physical cello recording.

`cello-homr.musicxml` is actual pinned homr CPU output from the same owned image
with upstream tuplet cleanup disabled. It matched all 16 pitch/onset/duration
events in 13.62 seconds, including tenor and bass clefs; it omitted all printed
fingerings. Source coordinates are retained as upstream `imgpos` comments.

`cello-layout.xml` retains the original image dimensions, staff-line points,
clef glyphs and notehead bounds/grades from the actual Audiveris `.omr` archive
for that owned image. Other project data was omitted; the geometry was not edited.
It is an extraction for the independent layout reader, not a complete Audiveris
project. It contains no private score or local source path.

The layout tests use these independent actual outputs to retain a legitimate
tenor-to-bass change, recover a deliberately introduced treble-clef error and
its note displacement, and abstain when source anchors are insufficient. The
private dense-page result is checked separately and is not a repository fixture.

`cello-glyphs.json` contains actual RapidOCR glyph observations from the owned
PNG using the pinned reader in `recognition/glyphs.py`. All 16 printed digits
were read correctly after connected-component isolation, alongside other
non-fingering text observations. The file retains source/model hashes and image
coordinates so association checks can distinguish glyph recognition from correct
note ownership. It is not an already accepted fingering list.

`dense-tuplet-study.musicxml` is a second original exercise: sixteen beamed
sixteenth notes, a true quarter-note triplet and an eighth-note quintuplet,
28 pitched events and nine printed fingerings in three 4/4 bars. Its PNG was
rendered with Verovio 6.3.0 (`pageWidth=2400`, `scale=100`, encoded system breaks,
`minLastJustification=0`). The source XML's `imgpos` comments come directly from
the original renderer's notehead bounding boxes in that PNG. They are independent
source coordinates, **not** homr output. No candidate transcription supplied the
reference notes or positions.

`dense-tuplet-layout.xml` extracts actual Audiveris 5.11.0 CPU inference from this
PNG: image dimensions, three staffs, 28 heads, clefs, detected tuplets and original
head/stem/beam relations. `dense-tuplet-glyphs.json` is actual pinned glyph-reader
output, including the nine fingerings, tuplet numerals and unrelated text. These
were not filtered into an accepted answer. Private paths and unrelated project
metadata were omitted from the layout extraction.

The rhythm regression deliberately inserts a four-note 3:2 error into the first
bar's source XML and removes printed fingerings to model their omission. Source
geometry and actual OCR must restore every event and fingering to the independent
reference while leaving both genuine tuplets intact. This controlled corruption
tests the recovery decision; it does not claim homr produced that error on this
owned image. Additional checks preserve unexplained numerals and reject an
incomplete physical beam group.
