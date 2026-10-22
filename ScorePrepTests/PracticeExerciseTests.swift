import Foundation
import ScoreCore
import XCTest
@testable import ScorePrep

final class PracticeExerciseTests: XCTestCase {
    @MainActor
    func testOwnedExerciseImportsAndReopensWithItsConfirmedPickupAndPulse() async throws {
        let directory = FileManager.default.temporaryDirectory.appendingPathComponent("practice-exercise-\(UUID())")
        let store = try ProjectStore(directory: directory)
        addTeardownBlock { try FileManager.default.removeItem(at: directory) }
        let library = ScoreLibrary(store: store)
        let id = try await PracticeExercise.install(into: library)
        let reopened = ScoreLibrary(store: store)
        let project = try XCTUnwrap(reopened.projects.first { $0.id == id })
        let source = try XCTUnwrap(reopened.sourceURL(for: project))
        XCTAssertEqual(ScoreLibrary.sourceHash(try Data(contentsOf: source)),
                       "a67697668a131e07accebea323d0ab54f9f895111f19d63efe6d0c7884b7822a")
        let timeline = try TimelineCompiler.compile(project)
        XCTAssertEqual(timeline.spans.count, 3)
        XCTAssertEqual(timeline.duration, 13, accuracy: 0.000_001)
        XCTAssertEqual(timeline.spans[0].segments[0].startingBarPhase, 3)
        XCTAssertEqual(timeline.spans[2].segments[0].tempo.pulse, .dottedQuarter)
        var transport = PracticeTransport(timeline: timeline)
        try transport.start(at: 0, countInBars: 1)
        XCTAssertEqual(transport.countInDuration, 3, accuracy: 0.000_001)
        XCTAssertEqual(transport.snapshot(at: 8).currentSpanIndex, 1)
        XCTAssertEqual(transport.snapshot(at: 12).currentSpanIndex, 2)
        XCTAssertEqual(transport.snapshot(at: 16).phase, .finished)
    }
}
