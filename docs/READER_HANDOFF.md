# Reader integration handoff

## Entry points

`LibraryView()` remains the app entry view. `ScoreLibrary.importOriginal(from:)`
is async and copies a PDF/JPEG/PNG before security-scoped access ends. It saves
only a relative `sourceFilename` using the existing ScoreProject JSON. Existing
`importPDF(from:)` delegates to it and is now async. No shared models changed.

`ScoreReader` receives the project, original URL and existing timing callback,
plus `onCropSaved`, `onRename`, and `onDelete`. Its optional
`onReviewRequested: (UUID, Int) -> Void` passes project ID and zero-based source
page index to integration. Inject this callback from LibraryView when composing
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
The selected project is restored with SceneStorage; reading-area position starts
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
are retained as XCTest attachments inside Smoke.xcresult. Export with the verified
Xcode's `xcresulttool export attachments --path build/Smoke.xcresult --output-path
build/reader-attachments` when reviewing CI artifacts. Actual evidence is recorded
in READER_BUILD_STATUS.md after CI; the foundation's older smoke evidence alone
does not validate this change.
