# Practice controller — reader contract

`ScoreAudio/PracticeController.swift` defines one `@MainActor` public
`PracticeController: ObservableObject`. Construct it once per compiled route
with `PracticeController(timeline: compiledTimeline)` and retain it with
`@StateObject`; child views use `@ObservedObject`. Compile only confirmed
timing. Recreate the controller after preparation changes the route/timing.

## Read-only UI state

| Property | Meaning |
| --- | --- |
| `timeline: CompiledTimeline` | The immutable occurrence route. |
| `snapshot: PracticeSnapshot` (`@Published`) | Authoritative phase, reference position, cumulative take elapsed time, current/upcoming indices and count-in seconds remaining. |
| `currentSpan: TimelineSpan` | Current occurrence; its `systemID` selects the source crop. |
| `upcomingSpan: TimelineSpan?` | Upcoming occurrence, including the A-B wrap; nil at the end. |
| `speed: Double` | Reference-speed multiplier, initially 1. |
| `isAudible: Bool` (`@Published`) | Selected sound mode, initially true; silent mode uses the same transport. |
| `loop: PracticeLoop?` | Inclusive first/last span IDs. |
| `errorMessage: String?` (`@Published`) | Actual invalid-command or audio error to display. |
| `pauseReason: PracticePauseReason?` (`@Published`) | System interruption/output/configuration/background/reset; display its `message`. |

`snapshot.phase` is `.ready`, `.countingIn`, `.playing`, `.paused` or
`.finished`; `snapshot.isRunning` covers counting-in/playing. Display the
count-in remaining value as seconds, not as a guessed beat number.
Current/upcoming are occurrence identities, not merely source system IDs.
Repeated sections can share a source while having distinct `TimelineSpan.id`.

## Commands (all synchronous, on the main actor)

```swift
func play(countInBars: Int = 1) // New take at cursor; after end, starts again.
func pause()                   // Exact current logical position; clears queued sound.
func resume()                  // Paused take only; no additional count-in.
func stop()                    // Ready at loop A, or route beginning.
func setSpeed(_ value: Double) // Positive finite multiplier; preserves position.
func setAudible(_ value: Bool) // Preserves position and running/paused intent.
func seek(to spanID: String)   // Always pauses; outside A-B disarms the loop.
func setLoop(_ value: PracticeLoop?) // Always pauses; normalizes cursor into A-B.
func dismissError()
func refresh()                 // Samples the shared host clock, never adds a tick.
```

Use `pause()` when the practice screen disappears. The controller handles app
background and native audio interruption/output loss itself. Resume after any
such event is explicit, including when the system says audio may resume.
Show both error and pause reason when present. Audio failures pause playback;
manual seeking/reading remains available, as does choosing silent mode and
explicitly resuming. Invalid controls surface their error without corrupting
the existing transport.

The controller owns its refresh/lookahead wakeup. Views must not accumulate
elapsed seconds or advance occurrence indices independently. A 60 ms audio
startup lead uses the same transport anchor for display and clicks; silent
playback needs no audio engine. Buffer completion callbacks do not drive state.

## Implementation and validation boundary

The pure `PracticePulsePlanner` and `PracticePulseSchedule` live in ScoreCore;
the only transport extension is an internal read-only take-origin property.
Every queue-invalidating command starts a new generation; event identity is
generation plus cumulative elapsed take time, so A-B cycles remain distinct.
Buffers match the current native output sample rate/channel count and use
host-only `AVAudioTime` timestamps. No microphone permission or following code.

This first API commit has not yet been compiled on macOS or scheduled in a
simulator. Root owns project/test composition and the next native run. New
targeted pure and native controller tests follow this interface commit.
Generated PCM or scheduled buffers will establish their stated boundaries;
heard output, Bluetooth latency and musician timing still require an iPad.

The iPadOS 18-compatible API choices follow Apple's
[host-clock representation](https://developer.apple.com/documentation/avfaudio/avaudiotime),
[explicit buffer scheduling](https://developer.apple.com/documentation/avfaudio/avaudioplayernode/schedulebuffer(_:at:options:completionhandler:)),
[clearing queued playback](https://developer.apple.com/documentation/avfaudio/avaudioplayernode/stop()),
[legacy interruption notification](https://developer.apple.com/documentation/avfaudio/handling-audio-interruptions)
and [output route changes](https://developer.apple.com/documentation/avfaudio/responding-to-audio-route-changes).
