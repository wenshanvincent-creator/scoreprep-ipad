# ScorePrep

Your score, prepared for your performance.

ScorePrep is an early native iPad app for turning existing sheet music into a
comfortable reading edition. Import a PDF or image, keep its original, and
review a clean edition before using it in rehearsal.

The flagship direction is **Follow Me: play at your own pace, and the score
follows**. Current work is V1: import, recognize, clean display and manual
swipe. Voice and chroma/online-DTW following come after that gate. See the
[implementation plan](docs/MVP_PLAN.md) and
[promotion brief](docs/PROMOTION_BRIEF.md) for scope and demonstration gates.

## Current milestone

V1 integration is under review. It includes PDF/JPEG/PNG import, local originals,
manual reading and crop preparation, a private remote homr worker, native
Verovio engraving, per-source-page acceptance/rejection, and saved MusicXML
that can be reopened offline. Recognition settings use Keychain; no worker
is preconfigured. See [worker setup](backend/README.md).

The actual homr cloud trial matched all 64 note events, key and meter on one
owned eight-bar exercise. [Recognition evidence](docs/RECOGNITION_BUILD_STATUS.md)
records the input, raw result and limitations. Native integration checks and
screenshot review remain release gates; this is not an App Store or TestFlight
release.

Use the [preview walkthrough](docs/TRY_PREVIEW.md) for original reading, the
recorded cloud-result demo, or a new conversion through your own worker.

The [first macOS/iPad simulator foundation build passed](docs/BUILD_STATUS.md).
Continuous metronome/line advancement, voice commands, live audio following,
Pencil and export are later phases. Physical-device and audio validation remain
separate.

## Build on macOS

Requirements: a recent Xcode with the iOS 18 SDK or newer, its command-line
tools, and XcodeGen. The deployment target is iPadOS 18.

    brew install xcodegen
    python3 tools/prepare_verovio.py
    xcodegen generate
    open ScorePrep.xcodeproj

Choose an iPad simulator and run the ScorePrep scheme. Simulator builds do not
need an Apple Developer membership. Signing and device distribution are
separate setup steps.

The GitHub Actions workflow generates the project, runs the core tests, builds
and smoke-tests the iPad app, and saves build logs and a simulator screenshot.
Its actual result is available in Actions; the presence of the workflow does
not establish a passing build.

## Run core tests

    swift test --package-path Packages/ScoreCore

The core package has no UI or third-party dependencies. It represents source
systems, reading occurrences, musical timing and compiled playback spans.

## Timing

Timing is entered or confirmed by the musician. Four bars of 4/4 at a
quarter-note tempo of 80 BPM take 12 seconds; two bars of 6/8 at a
dotted-quarter tempo of 60 BPM take 4 seconds. The app does not infer rhythm
from the horizontal spacing of printed notes.

The existing foundation includes timing editing, a beat timeline and a short
audible tempo preview. Continuous metronome synchronization will use a shared
audio/display clock after V1 passes. Live microphone following is a later phase.

## Contribute

Read [the architecture](docs/ARCHITECTURE.md),
[the roadmap](docs/ROADMAP.md) and
[the workstream guide](docs/WORKSTREAMS.md) before taking a task.
Use a separate branch/worktree for parallel work. Include only owned or
redistributable test scores; imported user scores stay out of the repository.

The sample exercise is original content. Local source reading and saved
recognized editions need no account or microphone permission. A DEBUG replay
uses a recorded cloud result to exercise the native review flow without
running a model or contacting a server.

New recognition requires your authenticated HTTPS worker. No real model runs
on the development PC. Cloud/server inference and dependency permissions are
documented separately from the native reader.

## License

ScorePrep's original code is MIT. Dependencies retain their own licenses.
Verovio's LGPL/GPL license texts are retained under backend/notices; homr/oemer code,
model provenance and distribution questions are documented in
[the dependency notes](backend/notices/PROVENANCE.md).
Apple SDKs are provided by the development environment.
