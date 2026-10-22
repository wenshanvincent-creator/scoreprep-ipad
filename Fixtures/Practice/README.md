# Pickup and pulse

An original ScorePrep piano exercise, composed for the practice preview. The
MusicXML and printed PNG are redistributable under this repository's license.
No third-party score or OMR inference was used. This is a demonstration input,
not a recording of the app running.

The printed page has three complete grand-staff systems. Keep each pair of
staves, its clefs, tempo text and meter inside its reading area. The courtesy
6/8 at the end of the second system announces the following meter change.

| Reading area | Printed measures | Meter | Tempo pulse / BPM | Performed quarter beats | Starting bar phase | Duration at 100% |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | Pickup 0 and bar 1 | 4/4 | Quarter / 60 | 5 | 3 (enter on beat four) | 5 seconds |
| 2 | Bar 2 | 4/4 | Quarter / 60 | 4 | 0 | 4 seconds |
| 3 | Bars 3 and 4 | 6/8 | Dotted quarter / 60 | 6 | 0 | 4 seconds |

One count-in bar before area 1 counts beats one, two and three, then the pickup
enters on four. The music lasts 13 seconds; the count-in adds 3 seconds at 100%.
Area changes occur 8 and 12 seconds after starting that take, with the final
endpoint at 16 seconds. The third area has two dotted-quarter pulses per bar.
System-level A-B over areas 1 and 2 repeats 9 seconds of music per cycle;
count-in happens once before the take. Pauses and speed changes preserve
musical position rather than restarting a bar.

These are reference values for confirmation and verification. Imported scores
do not receive guessed durations. The composed practice UI, actual scheduling
and native walkthrough still require their own evidence.

## Recreate the printed input

`python tools/make_practice_fixture.py` recreates MusicXML using only Python's
standard library. With Verovio 6.3.0 installed, add
`--svg build/practice-fixture.svg` to engrave it. The SVG uses encoded system
breaks, quarter-note divisions of two and the options recorded in that script.
The committed PNG was rasterized from that SVG with sharp 0.35.5 at density 144,
flattened over white. Its dimensions are 2100 by 1390 pixels. Musical glyphs
come from Verovio; the tempo is written as text to avoid an external SMuFL font
dependency in the printed image.

Independent source inspection confirmed per-staff quarter-beat lengths of
1, 4, 4, 3 and 3 across the five measures. Both staffs agree. The latest PNG was
visually inspected for complete staves, notes, beams, meters and tempo labels.

- MusicXML SHA-256: cad47836c2b3f97a9f1b4d53a130cb05ca54ccb97265d8dd9ba38dc56b89a7c3
- PNG SHA-256: a67697668a131e07accebea323d0ab54f9f895111f19d63efe6d0c7884b7822a
