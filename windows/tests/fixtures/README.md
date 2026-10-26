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
