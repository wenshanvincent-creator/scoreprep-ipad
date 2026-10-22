# ScorePrep implementation plan

Updated 22 October 2026. The native foundation passed its first macOS build
and iPad simulator smoke test; see [build evidence](BUILD_STATUS.md).
The automatic engineering goal is active. This document is the current scope.

## Product promise

**Your score. Your tempo. Your markings.**

Prepare readable music from your own PDF or photo and keep your hands on the
instrument. The flagship direction is **Follow Me**: the displayed original
score follows the musician's actual position. The dependable reader uses
confirmed timing and a metronome. The first Follow Me trial uses classical
chroma features and online dynamic time warping, without model training.

Keep the ScorePrep name and repository. The supplied ScoreVoice proposal
strengthens the hands-free workflow, small command vocabulary and eventual
MusicXML interoperability. Adding OMR, notation correction, re-engraving and
audio following as prerequisites would expand the first release substantially.
Develop alignment from a known structured score first, independently of OMR.

## First usable engineering preview

1. Import a PDF, JPEG or PNG and reopen it from an offline local library.
2. Manually define complete musical systems and adjust their boundaries.
   Include both piano staves, ledger lines, dynamics, lyrics and markings.
3. Read at an appropriate size in portrait or landscape, with upcoming context.
4. Confirm meter, tempo pulse, BPM and performed beats. Apply common settings,
   then correct pickups, shortened bars and explicit changes.
5. Start a count-in and practise with a continuous audio or silent metronome.
   A shared clock advances system focus at the confirmed musical boundaries.
6. Change practice speed, loop whole systems, or navigate manually. Manual
   navigation pauses playback and makes the resume point visible.
7. Reopen with originals, crops and timing intact and playback stopped.

Use three focused surfaces: Library, Prepare and Perform. Keep source order
initially. Existing section/occurrence contracts remain available; an advanced
arrangement editor is a follow-up rather than a prerequisite.

## Follow Me trial, starting now

Use one owned short MusicXML melody with a known note/beat map and explicit
links from beats to displayed systems. Convert the reference into chroma
frames, extract corresponding features from causal audio chunks, update an
online DTW path and publish position estimates. MIDI is event data: render it
to audio or convert its notes into compatible reference features.

Start with small generated audio fixtures with different timing, harmonics
and noise. That validates the pipeline, not microphone reliability. Then use
a real recording of the same passage and finally live iPad audio. Retain this
approach if it meets the declared demo gate. Do not investigate alternative
followers merely to add options.

Process only audio available at each update. A whole-recording DTW result
cannot establish live following. Log source timestamps, estimated beats,
system transitions and uncertainty. Test pauses, written rests, sustained notes
and tempo changes separately. Silence alone is not a score position. Hold the
display when uncertain; never silently switch to fixed-speed scrolling. Users
can select metronome mode explicitly.

First demonstration: one declared instrument/part, a short known passage,
moderate tempo changes and a deliberate pause. Arbitrary repeats, polyphonic
piano, ensembles and every imported photo are outside this first demo.
MusicXML alone does not identify measure positions on an unrelated scan;
source-image anchors must be confirmed.

## Hands-free commands

Expose native controls named Start practice, Pause, Next line, Previous line
and Restart loop. Check Apple's built-in Voice Control before adding an
app-owned recognizer. Apple documents offline operation after an initial
download. Reliability while instruments play still needs device testing.

If app-owned commands become necessary, start with a small, explicitly enabled
rehearsal vocabulary. Offline Speech support depends on device and language.

## Follow-up releases

- Native Pencil annotations, prepared PDF export, richer arrangement, tested
  pedals and image cleanup after the basic reading flow works.
- MusicXML import linked to original pages, reviewed OMR conversion and
  correction UI. Keep the original visible for musical verification.
- Same-pitch clef conversion and semantic reflow after structured notation is
  trustworthy; no silent transposition or octave shift.
- Broader audio following, ambiguous repeats/recovery and ensemble sync after
  the narrow Follow Me trial succeeds.

Original source images and markings remain authoritative. Review actual code,
weights and distribution terms before adding an OMR engine. No model execution
on the development PC; later model work uses a suitable server. The present
small signal-processing trial uses no model.

## Delivery and evidence

Reader/Preparation owns import, crop persistence and layout. Metronome/Practice
owns transport and controls. Integration connects Perform and owns the bounded
Follow Me experiment. Every UI workstream follows [UI_SKILLS.md](UI_SKILLS.md),
writes its plan before coding and inspects native screenshots. Keep iPadOS 18
and the verified toolchain.

The engineering preview needs passing macOS CI, an import/prepare/perform
smoke flow, portrait/landscape screenshots, persistent crops/timing and a
reproducible demo. Focused checks cover coordinates, pulse conventions,
pickups, count-in, pause/seek/speed/loops and stale audio scheduling.

For Follow Me, publish fixtures, causal replay traces and an error report.
A synthetic pass is a prototype result. A promotion claiming live following
needs a real-instrument demonstration and declared setup. Hardware audio/display
alignment, Voice Control, musician usability and signed TestFlight installation
remain separate checks. App Store distribution remains the destination.

## Primary references

- [Chroma and online alignment reference implementation](https://github.com/pymatchmaker/matchmaker).
- [CQT/DTW score-following report](https://arxiv.org/abs/2205.03247).
- [Apple Voice Control](https://support.apple.com/en-ie/guide/ipad/ipad4b6c9ee4/ipados).
- [Apple on-device Speech capability](https://developer.apple.com/documentation/speech/sfspeechrecognizer/supportsondevicerecognition).
- [homr limitations](https://github.com/liebharc/homr) and [license notes](https://github.com/liebharc/homr/blob/main/LICENSE_FAQ.md).

Related behavior is advertised by [Newzik](https://support.newzik.com/en/support/solutions/articles/77000495892),
[Metronaut](https://community.metronautapp.com/hc/en-us/articles/360022170040-Sheet-music-tools-in-Metronaut-Modes-feedback-and-score-settings)
and [SheetScroll](https://sheetscroll.com/). These are vendor descriptions, not
hands-on validation. Our direction is an open-source implementation with
editable preparation and reproducible evidence; musician validation remains.
