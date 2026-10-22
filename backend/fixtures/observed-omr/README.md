# Actual cloud result, 22 October 2026

This is **actual oemer output**, not a fixture response pretending to be OMR.

- Workflow: [39759659441](https://github.com/wenshanvincent-creator/scoreprep-ipad/actions/runs/39759659441)
- Branch commit: 6b3a2c04185a99cc80e92145f3c68eed34ec40db.
- Worker job: 16ea4bd6-f4eb-4806-8584-f6e4ec5b908c.
- Input: printed PNG generated from the adjacent original recognition-study.musicxml.
- Engine: dbe2a933d630d0f74805d717960eb259473f5978, ONNX on GitHub-hosted Ubuntu CPU.
- Elapsed from job creation log to completion: approximately 351 seconds.
- Original bytes/raster/logs and comparison data: workflow artifact recognition-actual-omr.
- job.json is the unedited result payload; recognized.musicxml is its unedited XML.

The original has eight measures and 64 pitched quarter notes. The output has
eight measures, 55 pitched notes and nine rest elements. Visual/XML review found
an erroneous one-sharp key signature, missing 4/4 time signature, a wrong first
bass pitch, missing notes, inserted rests and altered note placement/timing.
Several F naturals became F sharps. The terminal double barline was not retained.
The engine also emits a default tempo of 90; this is not a confirmed performance
tempo. No timing in this output should be treated as verified practice metadata.

The notation is renderable, but remains **unreviewed**, with reviewRequired=true.
No musical errors have been silently corrected. The original score is the
authority for comparison. The original/recognized images are retained under
docs/recognition-assets; white paper was used when displaying transparent
render exports. This single printed input does not establish photo or
multi-page recognition accuracy.
