# Shared practice transport

The v0.1 native reader composes this transport after the verified V1 gate.
It implements tempo-guided practice over confirmed musical timing.

ScoreCore owns a pure PracticeTransport over TimelineCompiler's confirmed route.
It contains no timer, device API or audio engine. One native controller owns
it and pass seconds from a single monotonic host clock to both visual snapshots
and audio-event scheduling. hostTime(forElapsed:after:) is the matching audio mapping.
Reference seconds preserve logical musical position when speed changes.

That mapping accepts only current/future events while the transport is running,
and does not extrapolate historical event times after a speed change or accept
events after the passage ends. The native controller must cancel queued audio
and start a new scheduling generation on start, pause/resume, speed, seek,
stop or loop edits. Event identity includes that generation and monotonically
elapsed take time; span ID plus beat position alone would incorrectly suppress
later A-B cycles. None of these commands may leave an old completion callback
in control of a newer take.

A take has an entry position and reference elapsed time including count-in.
Count-in holds the selected system in view and does not consume score beats.
For a pickup beginning on beat four of 4/4, one count-in bar counts beats one,
two and three, then enters on four; two count-in bars add a complete preceding
bar. Compound meter uses the explicitly confirmed tempo pulse unit.

Pause freezes elapsed time; resume reanchors that same position. Speed changes
fold elapsed time once, then apply the new rate. Neither action restarts a bar.
System-level loops use occurrence IDs, so repeated source systems remain
distinct. Loop endpoints are half-open in score time and can wrap several times
between observations without drift. Upcoming context points to A at B's end.
Manual navigation pauses immediately; choosing a system outside A-B disarms the
loop. Editing loop boundaries pauses until the musician resumes explicitly.

PracticeController schedules pulse buffers from this host mapping and supplies
the current/upcoming reader. The native timing editor confirms pickups and full
segment arrays; the practice controls expose count-in, speed, loops and manual
interruption. System notifications pause playback. Native audio and interface
evidence are recorded in [PRACTICE_VERIFICATION.md](PRACTICE_VERIFICATION.md).

## Preparation save contract

ScorePreparation is the editable systems/sections/reading-order value for the
native preparation sheet. The editor explicitly changes area order and route
membership together; no rectangle-based musical order is inferred. Applying
the draft validates page indexes against the verified original page count,
normalized bounds and stable identities/references. It preserves the latest
timing for an unchanged source area and clears timing for new or changed areas.
Unconfirmed areas remain readable and cannot compile into automatic playback
when included in the practice route.

ScoreLibrary.savePreparation(projectID:draft:) applies that draft to the latest
project and saves it atomically. The draft excludes source filenames, pending
jobs and recognized editions, so a preparation sheet cannot overwrite later
recognition work. The reader exposes this draft through its multi-area and
reading-order preparation sheet, with explicit Save and Cancel actions.

ScoreLibrary.updateTiming(projectID:systemID:segments:) validates and atomically
saves the full timing array, including pickups and meter/tempo changes. The
single-segment overload delegates to it. The native editor retains every saved
segment, including fractional performed beats and starting bar phases.

## Native build feedback

The app CI first emits ScoreCore for the iPad simulator SDK and type-checks
the native reader/practice Swift sources. This catches interface and SDK errors
before compiling the larger notation dependency. It excludes the app root,
library composition and Verovio review/rendering views; the normal Xcode build
and runtime checks still cover those. This early check proves compilation only,
not audio output, persistence or visual acceptance.
