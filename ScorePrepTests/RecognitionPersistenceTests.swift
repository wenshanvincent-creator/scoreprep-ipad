import Foundation
import ScoreCore
import XCTest
@testable import ScorePrep

final class RecognitionPersistenceTests: XCTestCase {
    @MainActor
    func testActualResultRetainsOriginalAndReviewOnReopen() async throws {
        let (store, library) = try makeLibrary()
        let (source, job) = try recordedResult()
        let projectID = try await library.importOriginal(from: source)
        try record(job, for: projectID, in: library)
        try library.saveRecognition(projectID: projectID, job: job)
        try library.setRecognitionReview(projectID: projectID, sourcePageIndex: 0, state: .rejected)
        try library.rename(projectID: projectID, title: "My rehearsal")
        let systemID = try XCTUnwrap(library.projects.first(where: { $0.id == projectID })?.systems.first?.id)
        try library.updateCrop(projectID: projectID, systemID: systemID,
                               bounds: .init(x: 0, y: 0, width: 1, height: 0.5))
        var preparation = ScorePreparation(project: try XCTUnwrap(
            library.projects.first(where: { $0.id == projectID })
        ))
        let second = SourceSystem(pageIndex: 0, bounds: .init(x: 0, y: 0.5, width: 1, height: 0.5),
                                  label: "Second system")
        preparation.systems.append(second)
        preparation.sections[0].systemIDs.append(second.id)
        try library.savePreparation(projectID: projectID, draft: preparation)
        let timing = [
            TimingSegment(quarterBeats: 1, meter: .init(numerator: 4, denominator: 4),
                          tempo: .init(bpm: 60), startingBarPhase: 3),
            TimingSegment(quarterBeats: 3, meter: .init(numerator: 3, denominator: 4),
                          tempo: .init(bpm: 90))
        ]
        try library.updateTiming(projectID: projectID, systemID: second.id, segments: timing)
        var invalid = timing
        invalid[1].quarterBeats = 0
        XCTAssertThrowsError(try library.updateTiming(
            projectID: projectID, systemID: second.id, segments: invalid
        ))

        let reopened = ScoreLibrary(store: store)
        let project = try XCTUnwrap(reopened.projects.first(where: { $0.id == projectID }))
        XCTAssertEqual(project.recognizedEdition?.pages.first?.reviewState, .rejected)
        XCTAssertEqual(project.recognizedEdition?.engine, "homr@\(job.engineRevision)")
        XCTAssertEqual(project.title, "My rehearsal")
        XCTAssertEqual(project.systems.first?.bounds.height, 0.5)
        XCTAssertEqual(project.systems.count, 2)
        XCTAssertEqual(project.sections.first?.systemIDs.last, second.id)
        XCTAssertEqual(project.systems.last?.timing, timing)
        XCTAssertNil(project.pendingRecognition)
        let url = try XCTUnwrap(reopened.sourceURL(for: project))
        XCTAssertEqual(ScoreLibrary.sourceHash(try Data(contentsOf: url)), job.originalSHA256)
        XCTAssertEqual(try reopened.recognitionPages(projectID: projectID).first?.musicXML, job.pages[0].musicXML)
    }

    @MainActor
    func testResultForAnotherOriginalCannotAttachToProject() async throws {
        let (store, library) = try makeLibrary()
        let (_, job) = try recordedResult()
        let otherSource = store.directory.appendingPathComponent("other.pdf")
        let bytes = SampleScore.pdfData()
        try bytes.write(to: otherSource)
        let projectID = try await library.importOriginal(from: otherSource)
        XCTAssertThrowsError(try library.recordRecognition(
            projectID: projectID, job: job, workerURL: URL(string: "https://worker.example")!,
            originalSHA256: ScoreLibrary.sourceHash(bytes)
        ))
        let project = try XCTUnwrap(library.projects.first(where: { $0.id == projectID }))
        XCTAssertNil(project.recognizedEdition)
        XCTAssertNil(project.pendingRecognition)
        let saved = try XCTUnwrap(library.sourceURL(for: project))
        XCTAssertEqual(try Data(contentsOf: saved), bytes)
    }

    @MainActor
    func testFailedReplacementKeepsPreviousEditionAndDecision() async throws {
        let (_, library) = try makeLibrary()
        let (source, job) = try recordedResult()
        let projectID = try await library.importOriginal(from: source)
        try record(job, for: projectID, in: library)
        try library.saveRecognition(projectID: projectID, job: job)
        try library.setRecognitionReview(projectID: projectID, sourcePageIndex: 0, state: .accepted)
        let editionID = library.projects.first(where: { $0.id == projectID })?.recognizedEdition?.id

        let jobURL = try XCTUnwrap(Bundle.main.url(
            forResource: "job", withExtension: "json", subdirectory: "RecognitionReplay"
        ))
        var failed = try XCTUnwrap(JSONSerialization.jsonObject(with: Data(contentsOf: jobURL)) as? [String: Any])
        failed["state"] = "failed"
        failed["completedPages"] = 0
        failed["pages"] = [["sourcePageIndex": 0, "state": "failed", "error": "fixture failure"]]
        let failedJob = try JSONDecoder().decode(
            RecognitionJob.self, from: JSONSerialization.data(withJSONObject: failed)
        )
        try record(failedJob, for: projectID, in: library)
        XCTAssertThrowsError(try library.saveRecognition(projectID: projectID, job: failedJob))
        let project = try XCTUnwrap(library.projects.first(where: { $0.id == projectID }))
        XCTAssertEqual(project.recognizedEdition?.id, editionID)
        XCTAssertEqual(project.recognizedEdition?.pages.first?.reviewState, .accepted)
    }

    @MainActor
    private func makeLibrary() throws -> (ProjectStore, ScoreLibrary) {
        let directory = FileManager.default.temporaryDirectory.appendingPathComponent("recognition-tests-\(UUID())")
        let store = try ProjectStore(directory: directory)
        addTeardownBlock { try FileManager.default.removeItem(at: directory) }
        return (store, ScoreLibrary(store: store))
    }

    private func recordedResult() throws -> (URL, RecognitionJob) {
        let source = try XCTUnwrap(Bundle.main.url(
            forResource: "original", withExtension: "png", subdirectory: "RecognitionReplay"
        ))
        let result = try XCTUnwrap(Bundle.main.url(
            forResource: "job", withExtension: "json", subdirectory: "RecognitionReplay"
        ))
        return (source, try JSONDecoder().decode(RecognitionJob.self, from: Data(contentsOf: result)))
    }

    @MainActor
    private func record(_ job: RecognitionJob, for projectID: UUID, in library: ScoreLibrary) throws {
        try library.recordRecognition(
            projectID: projectID, job: job, workerURL: URL(string: "https://worker.example")!,
            originalSHA256: job.originalSHA256
        )
    }
}
