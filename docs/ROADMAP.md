# Roadmap

Current phase and completion criteria: [MVP_PLAN.md](MVP_PLAN.md).

## Foundation — passed

Native PDF library, source rendering, confirmed timing, route compilation and
one-bar click preview. Ten core tests and one native UI smoke test passed;
see BUILD_STATUS.md.

## V1 — engineering gate passed

PDF/photo import → remote existing OMR → MusicXML → Verovio display → manual
swipe. Include progress/errors, original comparison, local reopen and actual
native portrait/landscape evidence. Verified at 276418b; see
V1_NATIVE_VERIFICATION.md for the actual worker/replay and device boundaries.

## V2 — tempo-guided practice, engineering gate passed

The v0.1 preview provides multiple complete-system reading
areas, current/upcoming music, confirmed performed beats including pickups,
continuous metronome, beat-driven line changes, count-in, speed, A-B loops
and immediate manual interruption. Its integrated native gate passed at
a60b347; see [PRACTICE_VERIFICATION.md](PRACTICE_VERIFICATION.md).

## V3 — voice, next bounded experiment

Opt-in Apple Speech with forced on-device recognition, capability checks,
explicit permissions, touch operation and instrument-noise testing.

## V4 — Follow Me

Classical chroma/causal online DTW against the structured reference. Try this
approach first and retain it if it works. No custom training.

## Larger product

Pencil, same-pitch clef conversion, arrangement/export, pedals and ensemble sync.
Signed-device, physical validation and App Store review remain separate gates.
