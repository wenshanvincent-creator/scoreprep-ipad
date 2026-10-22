import Foundation
import ScoreCore
import XCTest
@testable import ScorePrep

final class PreparationEditingTests: XCTestCase {
    func testExplicitPageMoveUpdatesSectionReferencesAndRetainsRepeatIdentities() throws {
        var project = makeProject()
        let first = project.systems[0], second = project.systems[1]
        project.readingOrder.append(SectionOccurrence(sectionID: project.sections[0].id))
        let occurrences = project.readingOrder.map(\.id)
        var draft = ScorePreparation(project: project)
        PreparationEditing.moveArea(second.id, by: -1, in: &draft)
        let saved = try draft.applying(to: project, sourcePageCount: 1)
        XCTAssertEqual(saved.systems.map(\.id), [second.id, first.id])
        XCTAssertEqual(saved.sections[0].systemIDs, [second.id, first.id])
        XCTAssertEqual(saved.readingOrder.map(\.id), occurrences)
        let timeline = try TimelineCompiler.compile(saved)
        XCTAssertEqual(timeline.spans.map(\.systemID), [second.id, first.id, second.id, first.id])
        XCTAssertNotEqual(timeline.spans[0].id, timeline.spans[2].id)
    }

    func testAddRemoveAndCropDraftKeepsUnaffectedAreasAndRemovesEveryReference() throws {
        let project = makeProject()
        var draft = ScorePreparation(project: project)
        let id = PreparationEditing.addArea(to: &draft, page: 0, sectionID: project.sections[0].id)
        XCTAssertEqual(draft.sections[0].systemIDs.last, id)
        XCTAssertNil(draft.systems.first { $0.id == id }?.timing)
        PreparationEditing.setBounds(.init(x: 0, y: 0, width: 1, height: 0.25),
            areaID: project.systems[0].id, in: &draft)
        let saved = try draft.applying(to: project, sourcePageCount: 1)
        XCTAssertNil(saved.systems[0].timing)
        XCTAssertEqual(saved.systems[1].timing, project.systems[1].timing)
        PreparationEditing.removeArea(id, from: &draft)
        XCTAssertFalse(draft.sections.contains { $0.systemIDs.contains(id) })
        XCTAssertEqual(draft.systems.map(\.id), project.systems.map(\.id))
        XCTAssertEqual(draft.readingOrder.map(\.id), project.readingOrder.map(\.id))
    }

    func testTimingInputRoundTripRetainsFractionalPickupAndEveryTempoSegment() throws {
        let expected = [
            TimingSegment(quarterBeats: 1.25, meter: .init(numerator: 4, denominator: 4),
                tempo: .init(bpm: 60.5), startingBarPhase: 3.5),
            TimingSegment(quarterBeats: 4.5, meter: .init(numerator: 6, denominator: 8),
                tempo: .init(bpm: 96.25, pulse: .dottedQuarter), startingBarPhase: 0.25)
        ]
        let inputs = expected.map(TimingSegmentInput.init)
        XCTAssertEqual(try inputs.map { try $0.segment() }, expected)
        var invalid = inputs[0]
        invalid.quarterBeats = "1.25oops"
        XCTAssertThrowsError(try invalid.segment())
        invalid.quarterBeats = "1.25"
        invalid.startingBarPhase = "4"
        XCTAssertThrowsError(try invalid.segment())
    }

    @MainActor
    func testEditorDraftAndFullTimingArrayUseRealAtomicStoreAndColdReopen() throws {
        let directory = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
        defer { try? FileManager.default.removeItem(at: directory) }
        let store = try ProjectStore(directory: directory)
        let library = ScoreLibrary(store: store)
        let project = try XCTUnwrap(library.projects.first)
        let original = try Data(contentsOf: try XCTUnwrap(library.sourceURL(for: project)))
        var draft = ScorePreparation(project: project)
        let areaID = PreparationEditing.addArea(to: &draft, page: 0, sectionID: project.sections[0].id)
        PreparationEditing.moveArea(areaID, by: -1, in: &draft)
        draft.readingOrder.append(SectionOccurrence(sectionID: draft.sections[0].id))
        try library.savePreparation(projectID: project.id, draft: draft)
        let segments = [
            TimingSegment(quarterBeats: 1.25, meter: .init(numerator: 4, denominator: 4),
                tempo: .init(bpm: 60), startingBarPhase: 3.5),
            TimingSegment(quarterBeats: 4.5, meter: .init(numerator: 6, denominator: 8),
                tempo: .init(bpm: 96, pulse: .dottedQuarter))
        ]
        try library.updateTiming(projectID: project.id, systemID: areaID, segments: segments)
        let reopened = ScoreLibrary(store: store)
        let saved = try XCTUnwrap(reopened.projects.first { $0.id == project.id })
        XCTAssertEqual(saved.systems.map(\.id), draft.systems.map(\.id))
        XCTAssertEqual(saved.sections, draft.sections)
        XCTAssertEqual(saved.readingOrder.map(\.id), draft.readingOrder.map(\.id))
        XCTAssertEqual(saved.systems.first { $0.id == areaID }?.timing, segments)
        XCTAssertEqual(try Data(contentsOf: try XCTUnwrap(reopened.sourceURL(for: saved))), original)
    }

    private func makeProject() -> ScoreProject {
        let timing = [TimingSegment(quarterBeats: 4, meter: .init(numerator: 4, denominator: 4),
            tempo: .init(bpm: 60))]
        // Deliberately opposite geometric order: moving is an explicit musical operation.
        let areas = [SourceSystem(pageIndex: 0, bounds: .init(x: 0, y: 0.5, width: 1, height: 0.4),
                                 label: "A", timing: timing),
                     SourceSystem(pageIndex: 0, bounds: .init(x: 0, y: 0, width: 1, height: 0.4),
                                 label: "B", timing: timing)]
        let section = ScoreSection(name: "Study", systemIDs: areas.map(\.id))
        return ScoreProject(title: "Owned test", sourceFilename: "owned.pdf", systems: areas,
            sections: [section], readingOrder: [SectionOccurrence(sectionID: section.id)])
    }
}
