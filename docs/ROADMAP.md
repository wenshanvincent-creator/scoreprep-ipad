# Roadmap

The current scope is [MVP_PLAN.md](MVP_PLAN.md). The flagship direction is
Follow Me: retain the original score and follow the musician's playing.

## M0 — native foundation, passed

PDF import, local projects, source rendering, confirmed musical timing,
reading-order compilation and a one-bar click preview. Ten core tests and one
native UI smoke test passed; see [BUILD_STATUS.md](BUILD_STATUS.md).

## M1 — dependable rehearsal preview

- PDF/JPEG/PNG import and local reopen.
- Manual complete-system crops and readable portrait/landscape layouts.
- Timing with explicit pulse units, performed beats and pickup handling.
- Continuous shared audio/visual clock and automatic next-system focus.
- Count-in, practice speed, whole-system loops and manual pause/navigation.
- Accessible controls for an initial system Voice Control check.

## Follow Me experiment — starting now

Try causal chroma/online-DTW alignment against a known MusicXML/MIDI reference.
No model training. Prove small streaming fixtures, then a real recording and
a live iPad passage. Keep this approach if it meets its demo gate. Hold position
when uncertain rather than forcing a page turn.

## M2 — performer beta

Physical-iPad synchronization/readability checks, Pencil notes, prepared PDF
export, richer arrangement, tested pedals and Voice Control. Signing and
TestFlight need device/account setup. Simulator success and signed installation
are separate results.

## M3 — structured scores and wider following

Link structured scores to source pages; add reviewed OMR/correction and
same-pitch clef conversion. Expand Follow Me to cases supported by evidence,
then consider ensemble synchronization.

No release date is promised for acoustic following. The first reader can ship
independently. App Store distribution remains the destination; enrollment and
review timing are separate dependencies.
