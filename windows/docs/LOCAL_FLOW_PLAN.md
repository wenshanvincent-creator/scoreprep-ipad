# Local score workflow — agreed 26 October 2026

Vincent authorized local CPU inference, including on this development PC.
Windows is the delivery target; existing Apple code and remote worker stay intact.

## Product contract

Import printed PDF, scan or phone photo → automatic recognition → a readable,
reflowed digital score. No hand-written score support. No manual system cropping,
meter/BPM/duration entry, recognition-review gate, server URL or access-token UI.
Keep the source bytes internally for retry/provenance, without a comparison screen.

Notation retains pitches, durations, rests, keys, meters, ties, articulations,
dynamics, repeats, tempo instructions and existing fingerings as supported by the
recognizer. Preserve actual sounding pitches when changing clefs. Cello displays
bass clef throughout. Recommended fingerings prefer low positions and few shifts;
source fingerings win. Instruments use their own tuning/notation/fingering rules.
Single instruments include multiple staves and simultaneous notes, e.g. piano.
Do not fabricate annotations or fingering outside a validated instrument rule.

Offer optional synthesized demonstration, tuning and silent microphone following.
Following advances with the performer rather than a fixed playback clock and
waits through a pause. Users can scroll back and click a measure to restart.
Do not implement automatic arbitrary backwards relocation as a requirement.
After installation and runtime provisioning, all these functions work offline.

Clear common printed notation should normally work directly. Image-quality
failures identify an actual visible defect. Recognition/software failures are
reported separately; do not ask for a clearer picture to conceal unsupported
notation or parser failures. Automatic structural validation does not claim
infallible recognition. Never fabricate success to complete the workflow.

## Implementation sequence and ownership

1. Validate a pinned Windows-local recognizer against owned image and multipage
   PDF input. The previous homr engine documents missing musical symbols, so a
   Windows-capable engine covering fingering/clefs must be evaluated concretely.
2. Persist a whole-document MusicXML edition and recognition state in the main
   process. Package the recognizer/runtime as separate resources, not a public
   service and not renderer Node access. One bounded background task at a time.
3. Compile canonical note/measure occurrences from MusicXML; one quarter-note
   convention across playback, repeat order, note IDs and score following.
4. Engrave via Verovio. Reflow to viewport and selected score size; keep spacious
   staff spacing, readable fingering and clickable measures. Reuse existing white,
   gray, ink and rehearsal-blue palette and Windows/CJK UI fonts. Score dominates.
5. Add local audio synthesis and a classical audio-feature score follower. Keep
   tuning, demonstration and live-follow input/output lifecycle explicit.
6. Inspect actual Windows UI, test owned-score import to playable score and
   offline reopen, measure real inference time/memory, and separate synthesized
   alignment tests from a real cello rehearsal. Ship an installable build.

## UI direction

Library: compact import control and score list. Main pane: recognition progress
while processing; reflowed score when complete. Toolbar: instrument, score size,
fingering display, tune, listen/demo and follow. Practice: music fills the window;
small transport and current following status. User can freely browse and select a
measure. No welcome slogans, explanatory card grids or secondary metadata labels.
Errors stay attached to the affected score with an appropriate retry action.

Important risks to verify: tenor-to-bass clef pitch preservation, source fingering
precedence, multi-voice durations, repeated measure identities, unsupported jump
instructions, slow/paused live input, microphone cleanup, local process failures,
and runtime availability in the installed application.
