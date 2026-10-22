# ScorePrep

Your score. Your practice tempo. Hands-free line changes.

ScorePrep is a native iPad reader and practice app. Import a PDF, JPEG or PNG,
prepare complete musical systems, and keep current and upcoming music visible
while the metronome advances the score at your chosen practice tempo. Your
original notation and existing markings stay intact.

![Native iPad practice: current and upcoming music](docs/assets/practice-automatic-area-2.png)

This is an actual simulator capture from the verified automatic-advancement
take. See the [practice evidence](docs/PRACTICE_VERIFICATION.md) for its source,
timing record and captured audio.

## Current milestone

The v0.1 practice preview passed its native engineering gate on 22 October
2026. It includes multiple reading areas, explicit sections and repeat
order, confirmed timing arrays, pickup-aware count-in, audible or silent beats,
practice speed, system-level A–B loops, and immediate manual pause/navigation.
Native checks verified the complete preparation/save/cancel workflow,
automatic line changes, a 200% repeat, large-text controls, manual interruption,
timing cold reopen and captured metronome output.

Try **Open practice exercise** in the library, then **Practice**. The included
owned exercise has a pickup, 4/4 and 6/8. Follow the
[practice walkthrough](docs/PRACTICE_DEMO.md) to reproduce its 13-second passage
or prepare your own import. Source reading and practice work offline without
an account or microphone permission.

The separate [V1 recognition checkpoint](docs/V1_NATIVE_VERIFICATION.md) passed
its engineering gate on 22 October 2026. It wraps a remote homr worker and
native Verovio engraving, with per-source-page review and saved MusicXML for
offline reopening. A real cloud trial matched 64 note events, key and meter
on one owned eight-bar exercise; its final barline differs. See
[recognition evidence](docs/RECOGNITION_BUILD_STATUS.md) and the
[recognition walkthrough](docs/TRY_PREVIEW.md). New conversions require your
private authenticated HTTPS worker; none is preconfigured. Connection settings
use Keychain. [Worker setup](backend/README.md) describes deployment.

The larger direction is **Follow Me: play at your own pace, and the score
follows**. Voice and classical chroma/online-DTW following are later phases.
The current mode follows confirmed timing, not live microphone input. Read
the [implementation plan](docs/MVP_PLAN.md),
[roadmap](docs/ROADMAP.md) and [promotion brief](docs/PROMOTION_BRIEF.md).
Physical-iPad rehearsal, Apple signing, TestFlight and App Store distribution
remain separate gates. The [first foundation build](docs/BUILD_STATUS.md)
records the earlier starting point.

## Build on macOS

Verified toolchain: Xcode 16.4 with its command-line tools and XcodeGen.
The deployment target is iPadOS 18; CI uses an iOS 18.5 iPad simulator.

    brew install xcodegen
    python3 tools/prepare_verovio.py
    xcodegen generate
    open ScorePrep.xcodeproj

Choose an iPad simulator and run the ScorePrep scheme. Simulator builds do not
need an Apple Developer membership. Signing and device distribution are
separate setup steps.

GitHub Actions generates the project, runs Core checks, builds the native app,
and runs persistence, audio and UI checks. It exports logs, native screenshots,
audio and timing receipts. Exact accepted sources and run results belong in
the verification notes linked above.

## Run core tests

    swift test --package-path Packages/ScoreCore

The core package has no UI or third-party dependencies. It represents source
systems, reading occurrences, musical timing and compiled playback spans.

## Timing

Timing is entered or confirmed by the musician. Four bars of 4/4 at a
quarter-note tempo of 80 BPM take 12 seconds; two bars of 6/8 at a
dotted-quarter tempo of 60 BPM take 4 seconds. The app does not infer rhythm
from the horizontal spacing of printed notes.

One continuous transport drives the audible/silent beat, count-in and system
focus. Pausing or changing speed preserves musical position. Manual navigation
pauses immediately. The separate timing editor also offers a one-bar preview.

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
