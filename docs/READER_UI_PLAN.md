# Reader UI plan

## Main action and visual direction
Open a PDF/JPEG/PNG, keep its original bytes locally, and read it by manual
swipe or explicit Previous/Next. Notation owns the broad paper surface;
preparation lives in sheets. No recognition result is fabricated.

Palette: paper #FFFFFF, workspace #F2F4F6, ink #18242C, action #285E79,
secondary #63717B. Native San Francisco semantic text styles for controls;
source typography remains untouched. Use semantic system surfaces for chrome.

Wide window: `[ Library | title / Review / reading-area menu ]`
             `[         |             source music          ]`
             `[         | Previous     area/page      Next  ]`
Narrow window: native collapsed library navigation, full-width score and
compact icon navigation with spoken labels. A vertical scroll surface lets a
full page remain readable in landscape; horizontal swipe changes reading area.

## Ownership and behavior
Keep ScoreLibrary's existing ObservableObject and ScoreCore project contract.
Copy before security-scoped access ends. PDF stays PDF; JPEG/PNG stays the
original image. An in-memory PDFPage bridges images to the existing renderer.
Library owns import progress/errors, title/delete and persisted crop changes.
Reader owns only the current area, open document, and presented sheet.
Crop editing previews normalized top-left coordinates on the original page,
keeps both piano staves/markings under explicit user control, and clears timing
when its meaning changes. Reset restores a full-page view; original bytes never
change. Existing timing editor stays available under preparation.

A Review entry displays the full original page and explicitly reports missing
clean output. Integration can inject a project/page review callback and own the
recognition progress/results contract. No new shared recognition model here.

## Accessibility and evidence
44-point navigation targets, semantic text, named controls, no forced animation;
respect Reduce Motion. Keep selection stable across resizing. Check native
portrait, landscape, large text and narrow-window behavior where CI allows.
Add proportionate native tests for import/reopen/delete, source preservation,
crop persistence and navigation boundaries, using generated owned fixtures.
Windows cannot compile UIKit: use existing cloud macOS CI and inspect its native
screenshots. Simulator evidence does not establish physical-device validation.

## Plan review
The existing source and PDFKit bridge match this task. Reuse them instead of
adding a dashboard, decorative card system, custom engraver, or new state
architecture. Photos-library import is deferred: Files already accepts photos
without introducing a second acquisition/persistence path during this slice.

## API references checked for this implementation

- [Apple fileImporter](https://developer.apple.com/documentation/swiftui/view/fileimporter(ispresented:allowedcontenttypes:oncompletion:)):
  start and balance security-scoped access; copy while access is held.
- [Apple NavigationSplitView](https://developer.apple.com/documentation/swiftui/navigationsplitview):
  native compact-column behavior rather than orientation-specific navigation.
- [Apple PDF drawing transforms](https://developer.apple.com/library/archive/documentation/GraphicsImaging/Conceptual/drawingwithquartz2d/dq_pdf/dq_pdf.html):
  map media-box origins and PDF rotation before applying displayed-page crops.

Use only the repository's verified iPadOS 18/Xcode 16.4 API surface.
