# Windows 0.3 verification

26 October 2026, Windows x64. This workstream changes Windows only; no native
Apple or existing remote-worker inference code was changed.

- TypeScript/build: passed with the sandboxed renderer and local workers.
- Musical/audio checks: 8 focused cases across cello clef/pitch/source fingerings,
  a real OMR fingering-3 regression, pickup/compound tempo/repeat expansion,
  low cello harmonics, calibration, slow/paused/repeated input and piano chords.
- Native Electron image import: actual bundled Audiveris CPU inference opened an
  8-bar, 64-note owned piano score automatically. Source SHA-256 stayed identical.
  The window's bar click, synthesis, tuner opening, 800px reflow and saved offline
  restart passed. Network requests were blocked for the renderer restart check.
- Native Electron two-page PDF: both pages recognized into 16 measures; exact PDF
  bytes preserved. Multiple exported movements are joined automatically in order.
- Synthetic cello PCM through desktop capture: low C2 cents, reference-tone input
  release, minimize/resume, closed/late capture, device loss and denied permission
  passed. One earlier run was interrupted immediately after capture; the targeted
  diagnostic rerun passed. No product error was hidden or converted to success.
- Synthetic performance through desktop capture: the saved owned two-staff score
  followed the incoming notes, waited during a three-second silence and reset on
  a measure click; stopping released the captured tracks.
- Owned printed cello inference: actual CPU run exited 0 in 31.35s. 16 pitches and
  tenor/bass clefs were correct; two source fingering 3s were confused with tuplets.
  The constrained repair and recommendations now reproduce all 16 source pitches,
  durations and final fingerings. See tests/fixtures/README.md and music.test.ts.

Screenshots and traces are local generated artifacts under windows/test-results;
they are excluded from source publication. The runtime preparation script records
pinned MSI/OCR/source hashes and a per-JAR inventory. Private scores, worker keys,
local inference state and local machine paths are excluded from the build inputs.

The recognizer is not guaranteed error-free on arbitrary printed music. Structural
checks catch some failures, not every wrong pitch or missing symbol. The follower
uses a short forward matching window and explicit clicked anchors; arbitrary
backward recovery and ensemble source separation are not implemented. Recommended
wind fingering diagrams are not implemented. Piano/string recommendations use
rules and do not establish professional fingering quality.

A physical cello/microphone rehearsal still requires Vincent's test. Synthetic
PCM acceptance is not evidence of acoustic room, bow-noise or hardware behavior.
The current installer verification receipt is added after the final packaged run.
