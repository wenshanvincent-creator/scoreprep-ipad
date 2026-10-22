import XCTest
@testable import ScoreCore

final class ScorePreparationTests: XCTestCase {
    func testSplitPageKeepsOriginalAndRecognitionButRequiresNewTiming() throws {
        var project = makeProject()
        project.recognizedEdition = RecognizedEdition(engine: "owned-test", pages: [
            RecognizedSourcePage(sourcePageIndex: 0, musicXMLFilename: "page-0.musicxml")
        ])
        let originalID = project.systems[0].id
        var draft = ScorePreparation(project: project)
        draft.systems[0].bounds = .init(x: 0, y: 0, width: 1, height: 0.45)
        let second = SourceSystem(pageIndex: 0, bounds: .init(x: 0, y: 0.5, width: 1, height: 0.45),
                                  label: "Second system", timing: project.systems[0].timing)
        draft.systems.append(second)
        draft.sections[0].systemIDs.append(second.id)
        let saved = try draft.applying(to: project, sourcePageCount: 1)
        XCTAssertEqual(saved.sourceFilename, project.sourceFilename)
        XCTAssertEqual(saved.recognizedEdition, project.recognizedEdition)
        XCTAssertEqual(saved.systems[0].id, originalID)
        XCTAssertTrue(saved.systems.allSatisfy { $0.timing == nil })
        XCTAssertThrowsError(try TimelineCompiler.compile(saved))
    }

    func testUnchangedAreaUsesLatestTimingAndDoesNotOverwriteNewRecognition() throws {
        var latest = makeProject()
        var draft = ScorePreparation(project: latest)
        draft.systems[0].label = "Entrance"
        latest.systems[0].timing = [TimingSegment(
            quarterBeats: 1, meter: .init(numerator: 4, denominator: 4),
            tempo: .init(bpm: 60), startingBarPhase: 3
        )]
        latest.pendingRecognition = PendingRecognition(
            jobID: "owned-job", workerURL: URL(string: "https://worker.example")!, originalSHA256: "owned-hash"
        )
        let saved = try draft.applying(to: latest, sourcePageCount: 1)
        XCTAssertEqual(saved.systems[0].timing, latest.systems[0].timing)
        XCTAssertEqual(saved.systems[0].label, "Entrance")
        XCTAssertEqual(saved.pendingRecognition, latest.pendingRecognition)
    }

    func testExplicitAreaOrderPreservesRepeatedSectionOccurrences() throws {
        var project = makeProject()
        let second = SourceSystem(pageIndex: 0, bounds: .fullPage, label: "B", timing: project.systems[0].timing)
        project.systems.append(second)
        project.sections[0].systemIDs.append(second.id)
        project.readingOrder.append(SectionOccurrence(sectionID: project.sections[0].id))
        var draft = ScorePreparation(project: project)
        draft.systems.reverse()
        draft.sections[0].systemIDs.reverse()
        let saved = try draft.applying(to: project, sourcePageCount: 1)
        let timeline = try TimelineCompiler.compile(saved)
        XCTAssertEqual(timeline.spans.map(\.systemID), [second.id, project.systems[0].id,
                                                       second.id, project.systems[0].id])
        XCTAssertEqual(saved.readingOrder.map(\.id), project.readingOrder.map(\.id))
        XCTAssertNotEqual(timeline.spans[0].id, timeline.spans[2].id)
    }

    func testRemovedAreaMustBeRemovedFromItsExplicitRouteInTheSameSave() throws {
        var project = makeProject()
        let removed = SourceSystem(pageIndex: 0, bounds: .fullPage, label: "B")
        project.systems.append(removed)
        project.sections[0].systemIDs.append(removed.id)
        var draft = ScorePreparation(project: project)
        draft.systems.removeLast()
        XCTAssertThrowsError(try draft.applying(to: project, sourcePageCount: 1)) { error in
            XCTAssertEqual(error as? PreparationError, .missingSystem)
        }
        draft.sections[0].systemIDs.removeAll { $0 == removed.id }
        let saved = try draft.applying(to: project, sourcePageCount: 1)
        XCTAssertEqual(try TimelineCompiler.compile(saved).spans.count, 1)
    }

    func testInvalidCropPageAndDuplicateIdentityCannotEnterSavedPreparation() throws {
        let project = makeProject()
        var draft = ScorePreparation(project: project)
        draft.systems[0].bounds.height = 1.5
        XCTAssertThrowsError(try draft.applying(to: project, sourcePageCount: 1))
        draft = ScorePreparation(project: project)
        draft.systems[0].pageIndex = 1
        XCTAssertThrowsError(try draft.applying(to: project, sourcePageCount: 1))
        draft = ScorePreparation(project: project)
        draft.systems.append(draft.systems[0])
        XCTAssertThrowsError(try draft.applying(to: project, sourcePageCount: 1))
    }

    private func makeProject() -> ScoreProject {
        let area = SourceSystem(pageIndex: 0, bounds: .fullPage, label: "A", timing: [
            TimingSegment(quarterBeats: 4, meter: .init(numerator: 4, denominator: 4), tempo: .init(bpm: 80))
        ])
        let section = ScoreSection(name: "Score", systemIDs: [area.id])
        return ScoreProject(title: "Owned exercise", sourceFilename: "owned.pdf", systems: [area],
                            sections: [section], readingOrder: [SectionOccurrence(sectionID: section.id)])
    }
}
