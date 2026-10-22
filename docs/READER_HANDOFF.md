# Reader integration handoff

## Entry points

`LibraryView()` remains the app entry view and accepts optional
`onReviewRequested: (UUID, Int) -> Void`. `ScoreLibrary.importOriginal(from:)`
is async and copies a PDF/JPEG/PNG before security-scoped access ends. It saves
only a relative `sourceFilename` using the existing ScoreProject JSON. Existing
`importPDF(from:)` delegates to it and is now async. No shared models changed.

`ScoreReader` receives the project, original URL and existing timing callback,
plus `onCropSaved`, `onRename`, and `onDelete`. Its optional
`onReviewRequested: (UUID, Int) -> Void` passes project ID and zero-based source
page index to integration. Inject this callback into LibraryView when composing
the actual recognition/review destination. Without it, Review displays the full
original page and an explicit "No clean edition yet" state.

Integration owns recognized-edition persistence, job progress, MusicXML and
Verovio presentation. Crop is an original-reading rectangle, never recognition
output. Recognition should consume the unchanged original source in page order.
Images use an in-memory PDFKit display bridge; the on-disk bytes remain JPEG/PNG.
Deletion currently removes the project and original; integration must also remove
any edition assets it creates, under the same project deletion operation.

## Preparation and lifecycle

The library keeps its existing ObservableObject. No composition, Audio, Core,
Recognition, project.yml or workflow changes are required for this slice.
A new install receives the owned sample; an intentionally emptied library stays
empty after reopening. Missing/malformed originals and JSON errors are visible.
Rename/delete are available from the source reader menu and library context menu.
The selected project is restored with AppStorage across cold launches; reading-area position starts
at the first area on reopening. Crops save on existing SourceSystem IDs and clear
confirmed timing if changed. They do not alter sections or original bytes.

## Native verification

`ScorePrepUITests/ReaderPreparationTests.swift` is discovered by the existing
UI-test target. No project/workflow additions are needed. It uses DEBUG-only
ReaderFixtures and isolated test libraries, importing actual generated PDF/image
bytes through ScoreLibrary, comparing copied bytes, deleting the external input,
then testing navigation/reopen/rename/crop/delete and malformed-image errors.
This bypasses external Files-provider selection, not the import implementation.
The real Files picker, cloud-provider access, hardware and Photos picker remain
separate coverage. All fixtures derive from the repository's owned SampleScore.

Portrait, landscape, crop/review, image, rotated-PDF and large-text screenshots
are exported to build/*.png on the simulator host by the test helper, and
retained as XCTest attachments inside Smoke.xcresult. Export with the verified
Xcode's `xcresulttool export attachments --path build/Smoke.xcresult --output-path
build/reader-attachments` when reviewing CI artifacts. Actual evidence is recorded
in READER_BUILD_STATUS.md after CI; the foundation's older smoke evidence alone
does not validate this change.

## Commits after the first integration pickup

If integration already contains 910ca1c, take these reader fixes in order:

- 6a4ddad: persist last-opened project across cold launches. Native run
  [39761259309](https://github.com/wenshanvincent-creator/scoreprep-ipad/actions/runs/39761259309)
  passed all 12 core and 5 UI tests, including PDF/JPEG/PNG reopen and crop/delete.
- c6895cc: keep the missing-clean-edition state above the long original page;
  wait for landscape geometry and export full-screen native captures.
- 17a471b: pin the original crop preview above independently scrolling edge
  controls, so the selected musical area remains visible during adjustment.

The last two changes address issues found by inspecting native screenshots.
See READER_BUILD_STATUS.md for the final checked commit and captures.

Recognition persistence must update the same ScoreLibrary project snapshot used
by reader actions. Saving an edition through an independent ProjectStore while
leaving the reader's in-memory project stale would let the next rename/crop save
overwrite that edition. Integration owns injecting the shared library instance
or adding the corresponding library mutation when composing the review flow.
