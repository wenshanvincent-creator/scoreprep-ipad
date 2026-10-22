# Actual homr result

[Cloud run 39763157075](https://github.com/wenshanvincent-creator/scoreprep-ipad/actions/runs/39763157075),
commit 9338725d160b565d191961e815a81f3f7cebf3aa, worker job
f6df126f-bac3-4297-b107-493a4645711b. Real CPU ONNX inference took approximately
10 seconds after setup, on a GitHub-hosted Ubuntu runner. All three downloaded
model archives matched upstream-published SHA-256 values.

The original is the same owned printed eight-bar exercise used in both failed
oemer trials. MusicXML contains **64/64 matching pitch/onset/duration events**,
eight measures, C-major key, 4/4 meter and no inserted rests. The comparison
normalizes MusicXML backup/forward timing rather than comparing XML note order.
quality-report.json preserves the expected and actual events and comparison
scope. job.json and homr-observed.musicxml are untouched worker output. This
one simple printed fixture does not establish broader photo/PDF accuracy.

The original output uses interleaved piano voices. Verovio 6.3's direct importer
misassigned some of those notes across voices, causing visible overlap. The
component now explicitly uses **Verovio's own musicxml-hum importer**, which
retains four quarter notes per staff per bar on this actual output. No MusicXML
notes, timings or pitches are modified by the wrapper. Raw data remains here.

The page remains reviewRequired=true until a musician accepts it. Upstream
training-data license limitations are recorded independently of this prototype
success in backend/notices/PROVENANCE.md. No model ran on the development PC.
