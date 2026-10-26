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
