# Recognition and clean-score UI plan

Scope: a reusable recognition client and native-hosted Verovio reader for V1.
The integration chat owns library, original comparison and persistence.

## Reading action and hierarchy

The musician opens recognized notation, adjusts its size, and turns pages.
White notation paper occupies the full remaining canvas; a compact native
control strip gives source-page identity, rendered-page count, previous/next
and a labeled size control. Review status is explicit. Recognition progress
uses completed source pages, never invented model percentages. Failures retain
the job and source page identity and show the actual worker error.

Palette follows DESIGN.md: paper #FFFFFF, surround #F2F4F6, ink #18242C,
action #285E79, secondary #63717B. San Francisco semantic fonts for controls;
Verovio's notation fonts for music. No decorative cards, gradients or motion.

Wide:   [source page / review]        [size] [previous] [next]
        |                 notation paper                  |
Narrow: [source page / review]
        |                 notation paper                  |
        [size]                         [previous] [next]

## Ownership and adaptation

RecognitionClient is an injected network boundary. Job/result values are
Codable and retain zero-based sourcePageIndex. A caller owns saved editions
and review decisions. The reader owns only its current rendered page and
reading-size setting; a changed edition replaces its renderer input.
The Verovio toolkit paginates each MusicXML source page separately; rendered
pages keep both source and local page identity. Never concatenate XML files.
Render sizing comes from available view geometry, including split windows.
Manual swipe and accessible buttons provide equivalent navigation. Rotation
and size changes reflow and clamp the selected rendered page.

## Accessibility and evidence

Use semantic control text, 44-point minimum buttons, labeled reading size,
VoiceOver source/page labels and scalable status/error text. Score remains
black on white in either interface appearance. No automatic animation;
Reduce Motion needs no substitute transition. Native portrait, landscape,
narrow window and larger-text captures will be inspected on an iPad simulator.
Physical-device behavior remains unverified until tested on an actual iPad.

## Design review before implementation

The identifiable surface is the printed musical passage itself. Controls serve
reading, page provenance and review. This follows the pinned music-stand brief
and native iPad conventions; no marketing typography or dashboard treatment.
Only iPadOS 18 APIs built with Xcode 16.4 are in scope. A dedicated harness can
validate this component without changing the shared app entry point.
