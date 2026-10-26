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
Final installer: 229,188,149 bytes, SHA-256
`ca3ce70a35187c5d70060d580a2f307fe6f3b355bd85c19ed9cd47fba051686d`.
The silent per-user installation returned exit 0. Its app.asar SHA-256 matched the
audited packaged archive (`69fb48f5b2b6fddeeaf06eb2d4eb0fd77e7932bf06c1a96649108e8507eadc8a`).

A new profile in the installed 0.3.0 application then completed actual CPU
recognition of its built-in cello image, produced all 16 expected pitches,
durations and final fingerings, rendered every clef as bass, preserved exact
source bytes, opened the cello tuner and exercised demonstration controls.
Closing and reopening with HTTP/HTTPS renderer requests blocked loaded the saved
edition without another recognition run. This complete installed check took
32.35 seconds. The local receipt and native screenshots are in `.test-data/`.
No external Java, Python, server URL or key was used by the installed program.


## 0.3.1 image preprocessing work

A reported 1000x1335 image was rejected at SCALE with measured staff spacing of
8 px; the pinned engine threshold is 11 px. Four deterministic preparations were
run locally: 2x smooth resize, 2x gray/unsharp, 3x smooth resize, 3x nearest neighbor.
Each passed the scale gate, but none produced a reliably playable whole score.
Sharpening reduced the number of full metrical bars. The smooth 3x version retained
one part and 25 bars, while still failing note-duration validation. The supplied
score and all derived music/image data remain local and are not repository assets.

The client now automatically performs one bounded resize for this measured failure,
keeps separate run output folders and the original bytes, and reports the actual
failure stage. Closing the application cancels the active tree and prevents the
recovery run from starting. Source and metadata are staged together before library
publication so polling cannot observe an incomplete import directory.

The automatic recovery flow passed an actual Windows Electron import test on an
owned cello image reduced to 800 px width: measured low staff spacing triggered
one resize, the 16 expected pitches/onsets/durations matched the original study,
notation opened automatically and original input bytes were unchanged. The test
also polls the library during import, covering the atomic publication regression.

The same recovery test then passed against the installed packaged 0.3.1 executable,
using an isolated profile and its bundled recognizer. Version, source preservation,
16 musical events, preprocessing receipt and the actual displayed score were
checked. An initial screenshot attempt timed out while the window was unfocused;
focusing the window before capture resolved it. Existing user library data and
the recognition runtime were retained during the local application-code update.
The published 0.3.0 installer has not been replaced.

The subsequent [local engine comparison](experiments/LOCAL_OMR.md) records the
dense-page Audiveris threshold and homr CPU trials, raw-versus-postprocessed
tuplet behavior, owned-score event/fingering comparison and actual SVG inspection.
The alternate engine remains experimental and is not installed in the client.

## Engraving completion during recognition optimization

Pitch-only chromatic MusicXML now receives missing visible accidentals, respecting
key signatures, octaves, chronological voices, separate staves, existing signs and
cross-bar ties. Unbeamed instrumental passages receive metrical beam groups;
explicit source beams, true tuplets and original fingerings remain intact.
No note pitches or durations are rewritten by this display step.

Four targeted engraving checks passed, including actual Verovio glyphs and beam
groups, alongside the five existing music/following checks and the Windows build.
Re-rendering the private dense candidate produced 121 visible accidentals and
100 beam groups, replacing its 400 isolated flags. All 400 pitch/duration/type
events were unchanged. This proves a display improvement, not full recognition
accuracy: the subsequent source comparison exposed an incorrect treble-clef
interpretation in candidate bars 21–22. The installed version is unchanged while
the broader recognition goal continues.

## Independent layout recovery

The new layout reader recovered the private dense candidate's incorrect G2 clef
interpretation as F4, with the corresponding diatonic displacement in 32 notes.
Twenty-one distinct matched source heads supported that displacement; it was not
inferred from the selected cello profile. The recovered SVG was visually checked.
Four layout tests pass against owned actual homr output and extracted Audiveris
geometry, retaining the legitimate tenor-to-bass change, recovering an introduced
treble error, preserving already correct pitches and abstaining with weak anchors.

The raw dense candidate still fails bar 8 after this repair: note-duration
validation has not been relaxed. An explicit inspection option records source
layout hashes, corrections and unresolved conflicts before the usual checks.

An isolated Python 3.12.14 environment with exact dependency pins reproduced the
owned 16-event result and the dense raw baseline. A controlled experiment masked
40 nearby high-score digit-0/1 glyphs in a derived image; raw timing failures
increased from three to five, so that preprocessing is not enabled. Originals
remained unchanged. The separate glyph reader correctly read all 16 printed
digits in the owned fixture; association with note heads and dense-page 3/8
ambiguities remain work in progress. No installed application upgrade has occurred.

## Complementary desktop candidate

The development client now automatically combines per-page homr recognition and
Audiveris source geometry with glyph/fingering, clef, accidental, ornament and
source-supported rhythm recovery. Python 3.12.14, the exact inference dependencies,
models and full source/license notices are bundled. A 2468-file neural inventory
matched after packaging. Isolated interpreter launches use bundled imports, and
the worker disables Python network access; packaged tests also removed external
Python/Java from PATH and blocked renderer HTTP/HTTPS and Java download proxies.

The final private unpacked candidate passed four actual Electron import checks
in 6.2 minutes total: an owned piano image, an owned two-page PDF, the 800-pixel
owned cello image and the owned trill/fingering reference. The image opens tuning,
demo controls and manual measure return, then reopens its saved edition offline.
The PDF opens all 16 measures automatically. Original bytes remain unchanged.
Both piano results match independent source events and actual rendered note
onsets/ends: 64 events/32 groups/32 quarters and 128/64/64 respectively. The small
cello result preserves all 16 notes and their exact original fingerings. The
ornament result preserves two genuine trills and three printed finger-4 marks,
removing only the false extra trill. Actual score screenshots were inspected.

Screenshot inspection during the preceding candidate run had exposed incorrect
piano engraving/timing from interleaved short MusicXML backups. Voice/staff
serialization fixes this without changing pitches, durations or genuine chords;
two actual-renderer regressions cover the independent reference and added true
chord/source fingerings. A real transient Windows file lock also exposed EPERM
during metadata replacement. Bounded waiting for this specific error now passes
a real file-handle check, while persistent failures still propagate. The 33 music,
engraving/audio/source-evidence checks, this lock check and the Windows build pass.

This is candidate evidence. The reported dense page's old-font numeral ambiguity,
remaining malformed final tuplet and complete independent reference comparison
remain unfinished. The installed 0.3.1 and published 0.3.0 preview remain unchanged;
no upgrade or real cello rehearsal acceptance is claimed here.
