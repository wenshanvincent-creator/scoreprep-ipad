# ScorePrep phased build plan

Updated 22 October 2026. Automatic engineering goal: active.
Current phase: **V2 — tempo-guided practice, completing v0.1**.
V1 passed its engineering gate at 276418b; see V1_NATIVE_VERIFICATION.md.

## Product direction

Your score. Your tempo. Your markings.

The eventual flagship is Follow Me: play at your own pace and the score
follows. Complete V1 before implementing voice commands or score following.
Keep the native iPad app and existing repository.

Wrap existing tools: **homr** is the current OMR integration after the first
oemer trials failed musical review; **Verovio** renders MusicXML.
The later following trial uses classical chroma/online DTW. No custom
model training, replacement notation engraver or comparison of follower options.

## Changes adopted from the ScoreVoice proposal

Keep its native Swift/SwiftUI platform, existing-engine OMR, MusicXML interchange,
Verovio engraving and the first rendering/manual-navigation gate. Preserve the
original alongside recognition so a musician can review or reject an imperfect
edition and reopen saved work offline.

Tempo-guided practice stays before voice because it is part of the existing
v0.1 goal. Voice is the next bounded experiment; microphone following follows
that. Full note correction, annotation transfer across re-engraving and ensemble
sync remain later work. An uncertain follower must hold position visibly;
silently substituting a fixed timer would misrepresent following behavior.

## V1 — verified engineering checkpoint

1. Import PDF, JPEG or PNG into an app-owned library.
2. Use the existing OMR engine on a remote worker to produce MusicXML per source
   page, preserving original assets and page order.
3. Render recognized notation with Verovio at an adjustable reading size.
4. Show progress and actual recognition errors. Offer original/recognized
   comparison and an explicit review state.
5. Read with manual swipe and previous/next controls in portrait and landscape.
6. Reopen original and recognized editions locally. Completed editions work
   offline; initial server recognition needs a connection.

Original handwriting stays in the source view. It is not automatically
transferred onto re-engraved staves. Recognition output needs musical review.
Users can reject a page and retain the original. Full note editing, automatic
clef conversion and semantic annotation transfer are later tasks.

No real models run on the development PC. Run OMR on a suitable cloud/server
worker with a pinned engine and an owned fixture. A mock response is not OMR
evidence. A container recipe is not a deployed service. Do not buy hosting or
publish an unauthenticated production endpoint.

## V1 completion gate

- An actual PDF/photo passes through the existing OMR engine.
- Its MusicXML renders through Verovio inside the native iPad app.
- Manual navigation, original comparison and local reopen work.
- Inspect native portrait/landscape screenshots and compare notation with the
  source fixture; record observed recognition errors.
- Relevant macOS build and integration checks pass.
- Record the actual worker/endpoint and any remaining deployment, device,
  signing or account dependency. Do not mark an incomplete flow complete.

## V2 — tempo-guided practice, completing the v0.1 engineering goal

The automatic engineering goal remains open after V1. Its practice requirements
are part of the native v0.1 preview, not optional roadmap replacements. The
existing one-bar audible preview is only a foundation for this work.

1. Let the musician define multiple complete-system reading areas on one source
   page, arrange them in reading order, and preserve original notation and bytes.
   The current crop editor adjusts an existing area; it does not yet create
   several areas per imported page.
2. Show the current system with upcoming-system context in portrait and
   landscape. A single cropped system with an otherwise empty screen does not
   meet this requirement.
3. Confirm meter, tempo pulse unit, BPM and performed quarter-note beats for
   each system, including pickup/bar phase. Do not infer duration from pixel
   spacing or start automatic movement with unconfirmed timing.
4. Use one continuous musical clock for audible or silent metronome, count-in,
   current-system focus and automatic line advancement. Derive visual position
   and scheduled audio from the same timeline; separate repeating timers do not
   establish synchronization.
5. Preserve logical musical position when changing practice speed, pausing,
   resuming or navigating manually. Manual pause/navigation must take effect
   immediately. Count-in precedes the passage without consuming its beats.
6. Provide system-level A-B loops and coherent boundaries at the end of a
   passage. Reading occurrences remain distinct when the same source system
   appears more than once.

Completion needs targeted timing/transport and persistence checks, a composed
native demonstration, and inspected portrait/landscape captures showing the
current and upcoming music. Confirm pickup behavior, explicit compound-meter
pulse units, speed changes, looping and manual interruption. State separately
which audio behavior was checked in a simulator and which still needs a real
iPad and musician. Keep these requirements when updating later milestones.

## V3 — voice, the next bounded experiment

After the v0.1 practice preview, use Apple's Speech framework with forced
on-device recognition and capability checks. Explicit permissions, touch
operation, visible activation, a small distinct command vocabulary and
rehearsal-noise checks are required. See VOICE_REQUIREMENTS.md. No voice
implementation or microphone permission is part of the current V1 gate.

## V4 — Follow Me

Try classical chroma features and causal online DTW against a known reference
derived from MusicXML/MIDI. No training. Start with one short passage and
confirmed links from beats to displayed systems. Keep this approach if it
passes its demo gate; do not explore alternatives just to compare them.

MIDI is event data: synthesize reference audio or derive compatible features.
A whole-recording DTW result is not live following evidence. Test held notes,
rests, pauses and tempo changes. Hold position when uncertain; do not silently
switch to a fixed timer. Expand repeats, instruments and polyphony only after
a narrow real-recording/live-iPad demonstration.

## Larger product

Pencil notes, reviewed same-pitch clef conversion, richer arrangements, PDF
export, tested pedals and ensemble sync follow the core phases.

Both UI chats follow UI_SKILLS.md before interface code. Keep iPadOS 18 and
the verified toolchain. App Store distribution remains the destination.
Physical-iPad validation, signing, enrollment and TestFlight are separate gates.

## Sources already checked

- [oemer](https://github.com/BreezeWhite/oemer).
- [Verovio](https://github.com/rism-digital/verovio).
- [Apple Speech capability](https://developer.apple.com/documentation/speech/sfspeechrecognizer/supportsondevicerecognition).
- [Chroma/online alignment reference](https://github.com/pymatchmaker/matchmaker).
