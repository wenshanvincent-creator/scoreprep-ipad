# ScorePrep phased build plan

Updated 22 October 2026. Automatic engineering goal: active.
Current phase: **V1 — import, recognize, clean display, manual swipe**.

## Product direction

Your score. Your tempo. Your markings.

The eventual flagship is Follow Me: play at your own pace and the score
follows. Complete V1 before implementing voice commands or score following.
Keep the native iPad app and existing repository.

Wrap existing tools: **homr** is the current OMR integration after the first
oemer trials failed musical review; **Verovio** renders MusicXML.
The later following trial uses classical chroma/online DTW. No custom
model training, replacement notation engraver or comparison of follower options.

## V1 — current work

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

## V2 — voice, after V1

Use Apple's Speech framework with forced on-device recognition and capability
checks. Explicit permissions, touch fallback, visible activation, a small
distinct command vocabulary and rehearsal-noise checks are required.
See VOICE_REQUIREMENTS.md. No voice implementation or microphone permission now.

## V3 — tempo-guided practice

Keep the existing quarter-beat timeline and one-bar preview. After V1, add a
continuous shared audio/display clock, count-in, speed, whole-system loops and
automatic line advancement. Confirm performed beats; do not infer them from
pixel spacing.

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
