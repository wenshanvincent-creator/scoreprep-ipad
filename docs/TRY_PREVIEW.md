# Try the native preview

This is a source-build preview for iPhone and iPad. There is no TestFlight
invitation yet. Use the ScorePrep scheme with Xcode 26.0.1 for iPhone/release
preparation, or Xcode 16.4 and an iOS 18.5 iPad simulator for the existing iPad
regression setup, with the project generated from project.yml.
See the repository README for the build steps, including the pinned Verovio
source preparation before generating the Xcode project.

For a signed beta, follow [TestFlight setup](TESTFLIGHT_SETUP.md). Developer
enrollment and signing are pending; an unsigned archive cannot be installed.

## Local original reading

1. Open the included Practice study.
2. Move between reading areas with a horizontal swipe or the bottom arrows.
3. Open the score menu and choose Adjust reading area. Keep the complete
   musical system inside the outline, then save.
4. Import a PDF, JPEG or PNG through Import score. Close and reopen the app;
   the original and saved reading areas remain in its local library.

These source-reading actions need no recognition worker. Cropping changes the
displayed area, not the original bytes or the notes.

## Tempo-guided practice

Choose **Open practice exercise** in the library. The owned
**Pickup and pulse** exercise has three prepared areas, a beat-four pickup,
4/4 and 6/8. Choose **Practice** to see current/upcoming notation with sound
or silent beats, automatic line changes, speed, count-in and A–B loops.
Follow [the practice walkthrough](PRACTICE_DEMO.md) for expected timings and
preparing your own import. Its accepted native checks and captures are recorded
in [PRACTICE_VERIFICATION.md](PRACTICE_VERIFICATION.md).

## Recorded cloud-result walkthrough

For a reproducible demonstration without provisioning a worker, use a Debug
build. In Xcode's ScorePrep scheme, add these launch arguments:

```text
--smoke-test
--reader-test-id walkthrough
--reader-reset
--recognition-replay
```

The app imports its owned printed exercise and the untouched result of an
actual remote homr run. Open Review, compare Original and Clean edition,
adjust the notation size, and use the arrows or swipe to change rendered pages.
Accept page records your review; Review again lets you revisit it; Use original
records a rejection and returns to the source.

To check offline reopening, stop the app, remove --reader-reset and
--recognition-replay, keep the same --reader-test-id walkthrough argument,
then run again. No network request or model inference occurs in this replay.
Its source and result receipts are in Fixtures/RecognitionReplay/README.md.

The trial matches the exercise's 64 pitch/onset/duration events, key and meter.
The final barline style differs, and title recognition is disabled. Broader
photograph/score accuracy has not been established.

## A new conversion through your worker

Provision the private HTTPS service described in backend/README.md. In Review,
open Worker connection, save its address and access token, then choose
Recognize original. The settings are stored in Keychain. Initial conversion
uses the network; saved editions open locally afterward.

Recognition currently accepts up to eight pages and 20 MiB. The local source
reader supports up to twenty pages. Stop waiting stops local polling; a saved
job can be resumed. It does not cancel inference already running on the server.
No production endpoint is included in this repository.

## Demonstration boundary

Record what is actually on screen. Label the recorded-result mode as such.
The recognition walkthrough demonstrates V1. Tempo-guided movement has its
own practice walkthrough; voice commands and Follow Me remain later phases.
Current native checks and
inspected captures belong in BUILD_STATUS.md and the workstream evidence files.
