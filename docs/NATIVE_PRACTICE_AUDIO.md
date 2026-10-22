# Native practice audio

PracticeController and PracticeClickOutput implement these constraints for
the v0.1 preview. The API choices were checked against Apple's documentation
on 22 October 2026. Keep Xcode 16.4 and iPadOS 18. Native results, captured
audio and device boundaries are recorded in
[PRACTICE_VERIFICATION.md](PRACTICE_VERIFICATION.md).

## One clock

The native controller owns one PracticeTransport. Feed it seconds converted
from mach_absolute_time through AVAudioTime.seconds(forHostTime:). Convert
the transport's future host-time mappings back with hostTime(forSeconds:).
AVAudioTime describes both the host clock and sample-time representations;
the controller must not mix wall-clock dates or a separately accumulated timer
into the musical position. [Apple: AVAudioTime](https://developer.apple.com/documentation/avfaudio/avaudiotime).

Display refresh samples this transport. A scheduling wake-up only fills a short
lookahead window; it does not advance a beat counter or decide when to move a
line. Audible and silent modes keep the same passage position. Any startup
lead time must use the same anchor for displayed position and click scheduling.

Use the existing iOS 8+ scheduleBuffer(_:at:options:completionHandler:) API,
not the newer atTime overload requiring iOS 27. Pass explicit event times;
a nil time can concatenate playback after a preceding command. A completion
can also arrive when a player stops, so completion is not evidence that a
musical beat was heard. [Apple: buffer scheduling](https://developer.apple.com/documentation/avfaudio/avaudioplayernode/schedulebuffer(_:at:options:completionhandler:)).

For device rendering, a host-only AVAudioTime is valid when its sample-time
representation is invalid. Match click-buffer channel count and sample rate
to the player format and connect through the engine mixer. Do not derive a
new musical clock from the player's sample-time zero.
[Apple: player timeline and scheduling](https://developer.apple.com/documentation/avfaudio/avaudioplayernode).

## Commands and cancellation

Pause, manual seek, stop, speed and loop changes cancel the old scheduling
generation before publishing the resulting position. player.stop() clears
scheduled events, including an event already playing, and resets player sample
time. The transport retains the musical position separately. Pause or stop the
engine when audio is no longer needed. A later resume explicitly prepares a
new generation from the preserved transport position.
[Apple: stop](https://developer.apple.com/documentation/avfaudio/avaudioplayernode/stop()).

The pulse planner uses each segment's explicit meter, tempo pulse, performed
quarter-beat count and starting bar phase. Count-in precedes rather than
consumes passage beats. For the confirmed beat-four pickup, a one-bar count-in
sounds beats one, two and three before the entrance. A 6/8 dotted-quarter pulse
has two pulses per bar. Segment and loop boundaries remain half-open, with no
duplicate boundary click and no extra click at the final endpoint.

Events are identified by scheduling generation and monotonically elapsed take
time. A repeated source or A-B cycle must not disappear because an earlier
cycle used the same system ID and beat. Fill only current/future events using
hostTime(forElapsed:after:); never replay missed historical beats in a burst.
No completion callback may mutate a newer take.

## Interruptions

Use the interruptionNotification API available to iPadOS 18, inspect its type
and pause the shared transport when an interruption begins. Keep the UI in that
paused position until the musician explicitly resumes. The current Apple guide
also describes iOS 27 lifecycle notifications; they are outside this deployment
target. [Apple: interruptions](https://developer.apple.com/documentation/avfaudio/handling-audio-interruptions).

Observe routeChangeNotification and pause when the selected output disappears.
Apple specifically calls for pausing after headphone disconnection. Observe
engine configuration changes as well; rebuild the output format before the
next explicit resume. No microphone permission is needed for metronome output.
[Apple: route changes](https://developer.apple.com/documentation/avfaudio/responding-to-audio-route-changes).

## Required evidence

Target pulse-planning regressions for pickup and compound meter, segment tempo
changes, count-in, pause/resume, speed and repeated loop cycles. Verify that
manual interruption clears scheduled events and stale callbacks cannot restart
playback. Exercise the composed native practice screen with current/upcoming
music, count-in and automatic advancement; inspect portrait and landscape.
Record what simulator audio scheduling actually established. Output latency,
Bluetooth behavior and playing against a real instrument still need a physical
iPad and musician; documentation and pure clock checks do not establish them.
