# Shared practice transport

Prepared separately from the V1 integration checkout. V1 must pass before this
transport is composed into the native reader. This is the v0.1 practice
foundation, not voice or audio following.

ScoreCore owns a pure PracticeTransport over TimelineCompiler's confirmed route.
It contains no timer, device API or audio engine. One native controller will own
it and pass seconds from a single monotonic host clock to both visual snapshots
and audio-event scheduling. hostTime(forElapsed:) is the matching audio mapping.
Reference seconds preserve logical musical position when speed changes.

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

The remaining native work is required: schedule pulse buffers from this host
mapping, add the pulse planner and current/upcoming reader, confirm pickups in
the timing editor, wire count-in/speed/loops and manual interruption, handle
actual audio interruptions, and inspect simulator evidence. A pure transport
test does not establish audible synchronization or complete the preview.
