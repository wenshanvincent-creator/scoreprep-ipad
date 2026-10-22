# Recognition fixture

`recognition-study.musicxml` is an original eight-bar piano exercise generated
by recognition_fixture.py for ScorePrep, released under this repository's MIT
license. Both hands play four quarter notes per 4/4 measure, C major, treble
and bass clefs, 64 notes total. It contains no imported/private score content.
The cloud smoke renders it through pinned Verovio to create a printed PNG,
then submits that PNG to the real oemer CLI through the worker job API.
The handwritten fixture generator is not an OMR result. Actual results are
kept separately in cloud artifacts and documented in the build-status report.
