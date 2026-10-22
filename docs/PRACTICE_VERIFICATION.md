# Native practice verification

Status: integrated practice acceptance is in progress. V1 is already verified
and merged; see [its evidence](V1_NATIVE_VERIFICATION.md).

## Recorded checkpoints

| Source | Check | Result |
| --- | --- | --- |
| 691006355ca1ee11d9b26985fbec0f89c17603c6 | [Native foundation run](https://github.com/wenshanvincent-creator/scoreprep-ipad/actions/runs/39784018833) | Passed: 27 Core, 4 native and 7 UI tests. Includes the owned practice exercise's actual import, source hash, cold reopen and compiled pickup/compound timing. This predates the complete practice UI and audio tests. |
| bc3c8b1b298b2c187d61faca8b7f2af7a4f83d39 | [Recognition and engraving](https://github.com/wenshanvincent-creator/scoreprep-ipad/actions/runs/39788035897) | Passed: real cloud homr trial plus 5 native contract and 3 rendering UI tests. |
| bc3c8b1b298b2c187d61faca8b7f2af7a4f83d39 | [Integrated practice candidate](https://github.com/wenshanvincent-creator/scoreprep-ipad/actions/runs/39788035850) | 34 Core and 13 native tests passed, including live mixer capture. Existing 7 UI checks passed; 6 new practice UI tests failed around sidebar/menu navigation, ambiguous Done buttons and offscreen fields. Full practice acceptance remains open. |

The integrated checkout also includes 058b7d4's focused final-pulse display
correction. Its new regression and the resulting source still need validation.
No acceptance claim depends on the existence of tests alone.

## Captured audio at bc3c8b1

The actual native live-mixer test passed without a skip on the iPad Pro
11-inch (M4), iOS 18.5 simulator under Xcode 16.4. Its exported
[receipt](assets/practice-live-mixer-receipt.json) and
[mono WAV](assets/practice-live-mixer-with-pause.wav) were retrieved from
artifact 12430113624 and inspected. The receipt uses the owned PNG's exact
SHA-256, two-times speed and one count-in bar. Sixteen expected click onsets
were captured; one already queued future click was canceled, with no onset
during the pause. The test compares live mixer host timestamps with scheduled
events using 40 milliseconds of tolerance. This is app-mixer evidence, not
physical speaker latency.

A separate [offline rendering receipt](assets/practice-offline-receipt.json)
records clicks at approximately 0 and 0.25 seconds; the queued 0.5-second click
did not render after stop at 0.35 seconds. It is not a substitute for the live
host-clock capture above.

The native landscape practice capture was inspected: current and upcoming
complete grand staffs and bottom controls fit. Remaining portrait/large-text,
timing and automatic-advance captures await the corrected UI run.

## Evidence to inspect

- Preparation save/cancel and cold reopen, explicit repeat order, fractional
  pickup and complete multi-segment timing arrays.
- Current/upcoming source systems in native portrait, landscape and large text.
- A silent uninterrupted take advancing at 5 and 9 seconds, ending at 13;
  exported UI timing is an observation with polling tolerance.
- Count-in/manual interruption, visible silent beats, resume/end/stop,
  occurrence-qualified A–B wrapping and original-page access.
- Native controller cancellation, speed/position preservation and interruption
  handling. The live mixer test exports WAV/JSON and compares observed onsets
  with host-scheduled events, including a paused interval with a queued click.
- A separate offline engine-rendering receipt checks generated click PCM and
  canceled queued audio. Offline sample-time evidence is distinct from live
  host-clock capture; a skipped live test must remain visible as a limitation.

## Device and distribution follow-ups

Cloud simulator checks do not establish physical speaker or Bluetooth latency,
venue behavior, real-instrument usability or an App Store installation. The
release still needs Mac/Xcode access for a signed device build, Apple signing
and distribution setup, and a physical iPad/musician rehearsal. No account purchase,
production recognition service, TestFlight upload or App Store submission has
been performed by this milestone.

The preview's practice mode follows confirmed timing at the chosen speed. It
does not listen to a performance. Voice and classical chroma/online-DTW score
following remain subsequent phases.
