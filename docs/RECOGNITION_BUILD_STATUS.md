# Recognition and notation build evidence

Updated 22 October 2026. V1 recognition/rendering workstream; full app import,
comparison, persistence and reopen are integration-owned.

## Active path

The two oemer trials failed musical quality. The targeted second run disabled
deskew for a verified horizontal generated page and still had only 40/64 exact
pitch/onset/duration events, 55 pitched notes plus 7 rests, one-sharp key and no
meter. Raw result: backend/fixtures/observed-oemer-straight, job
1483125d-fbf4-425b-87b3-b01f8ebe45b7, workflow 39761660770. This justified the
authorized move to homr, now pinned at ab369ac54277afab582afa4725441f7cbba76593.
The actual [homr cloud trial 39763157075](https://github.com/wenshanvincent-creator/scoreprep-ipad/actions/runs/39763157075)
completed successfully: job f6df126f-bac3-4297-b107-493a4645711b, approximately
10 seconds of remote CPU recognition after setup. On this one owned exercise,
all 64 pitch/onset/duration events match, key is C major, meter is 4/4, all eight
measures remain and there are no inserted rests. Raw output and comparison:
backend/fixtures/observed-homr. This is a narrow prototype result, not a claim
about arbitrary photos or scores.
The client contract remains the same and includes optional engineName metadata.

## First actual recognition trial

[Workflow 39759659441](https://github.com/wenshanvincent-creator/scoreprep-ipad/actions/runs/39759659441)
at branch commit 6b3a2c04185a99cc80e92145f3c68eed34ec40db completed an actual
printed PNG → authenticated worker API → oemer ONNX CLI → per-page MusicXML
trial on GitHub-hosted Ubuntu CPU. Worker job
16ea4bd6-f4eb-4806-8584-f6e4ec5b908c took approximately 351 seconds, excluding
installation. The worker API ran in process for this bounded trial; the actual
engine was a subprocess with real model inference. No public endpoint was
deployed. No model was run on the development PC.

Original exercise and untouched job/XML/model receipts are in
backend/fixtures/observed-omr. The upstream source and ONNX hashes are pinned;
dependency notices and unresolved model-data permission questions are in
backend/notices/PROVENANCE.md.

| Review item | Original | Observed recognition |
| --- | --- | --- |
| Measures | 8 | 8 |
| Note elements | 64 pitched quarter notes | 55 pitched notes and 9 rests |
| Key | C major, no sharps | One-sharp key; F naturals become F sharps |
| Time signature | 4/4 | Missing |
| First bass note | C3 | D3 |
| Other differences | Both hands have four quarters per bar | Missing notes, inserted rests and changed onset placement; first-measure treble notes shifted one quarter beat; final double barline missing |

The successful job state means that MusicXML was produced, not that its musical
content has been accepted. Every output page requires review. The fixture event comparison found 41/64
exact pitch/onset/duration events; this single-input figure is not a general
accuracy benchmark. The pinned oemer MusicXML serializer does not emit a time
signature, so disabling deskew cannot by itself recover the missing meter. These errors are
retained without correction. The exercise is original MIT-licensed content;
this is one printed input, with no accuracy claim for photographs or arbitrary
multi-page scores. PDF page-order rasterization has a separate boundary test.

![Original eight-bar exercise](recognition-assets/original-study.png)
![Actual recognized notation](recognition-assets/recognized-study.png)

## Native engraving and interactions

The first Xcode 16.4 full-app build and existing app smoke passed at 6b3a2c0.
Native Verovio engraving and missing-page rejection passed as a dedicated unit
test. Initial UI screenshots were retrieved and inspected; they showed native
notation, but the UI automation used incorrect control-type assumptions and
failed to locate them. The fixture and actual OMR image captures are distinct.

Visual review also caught a real import issue: Verovio's direct importer puts
interleaved homr notes into the wrong voice. The component now selects the
library's built-in musicxml-hum route; it does not modify MusicXML note content.
A targeted native regression checks four notes per staff per measure on the
actual homr output. Native UI verification after these fixes is in progress.
The independent workflow builds the
native Verovio Swift package at revision 425dd7b6ba26edcecbe345c10b15586d095743d9
(version-6.3.0) with Xcode 16.4, iPadOS 18 deployment target. The harness consumes
the actual job's MusicXML, separate from explicitly labeled fixture-only renders.
Updated portrait/landscape screenshots and manual-page/size checks must be inspected
before this section can be marked complete. A constrained 480-point component
and accessibility text configuration exercise narrow layouts; this does not
establish system Stage Manager behavior.

## Checks and remaining integration

Five worker boundary tests passed locally without any model invocation:
authorization/input failure, byte-identical original retention, actual PDF
rasterization order/dimensions, ordered partial-failure results and interrupted
job state. Stubbed subprocess checks are contract evidence only.

Minimal integration steps:

1. Configure an authenticated private HTTPS worker and a Keychain credential.
2. Submit original bytes through RecognitionClient, save the returned job ID,
   and display real completed-page progress or the preserved failure.
3. Save each MusicXML separately with sourcePageIndex; map it to the shared
   RecognizedEdition/RecognizedSourcePage persistence model as unreviewed.
4. Present RecognizedScoreView(pages:initialSourcePageIndex:onSourcePageChanged:)
   and keep original comparison and accept/reject controls aligned with its
   visible source index. Reconstruct successful page values from saved XML
   for offline reopen.
5. Verify the full import → recognize → original comparison → review → reopen
   flow in integration. Physical iPad validation and signed distribution have
   not been performed by this workstream.

The Docker recipe and private service settings are supplied in backend/README.md;
a container recipe is not evidence of a deployed endpoint. Model/data permission
resolution is needed before commercial release. No voice, following, metronome,
training or alternative-engine comparison is included.
