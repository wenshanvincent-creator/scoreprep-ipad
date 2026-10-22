import Foundation
import XCTest
@testable import ScoreCore

final class TimelineTests: XCTestCase {
    func testFourBarsOfCommonTimeAtEightyLastTwelveSeconds() throws {
        let segment = regular(bars: 4, numerator: 4, bpm: 80)
        try segment.validate()
        XCTAssertEqual(segment.duration, 12, accuracy: 0.000_001)
    }

    func testTripleMeterUsesItsActualBarLength() {
        XCTAssertEqual(regular(bars: 4, numerator: 3, bpm: 90).duration, 8)
    }

    func testCompoundMeterUsesAnExplicitDottedQuarterPulse() {
        let segment = TimingSegment(
            quarterBeats: 6,
            meter: TimeSignature(numerator: 6, denominator: 8),
            tempo: ReferenceTempo(bpm: 60, pulse: .dottedQuarter)
        )
        XCTAssertEqual(segment.duration, 4)
    }

    func testPickupKeepsItsShortDurationAndBarPhase() throws {
        let pickup = TimingSegment(
            quarterBeats: 1,
            meter: TimeSignature(numerator: 4, denominator: 4),
            tempo: ReferenceTempo(bpm: 80),
            startingBarPhase: 3
        )
        try pickup.validate()
        XCTAssertEqual(pickup.duration, 0.75)
    }

    func testTempoChangesAreSummedWithinTheSameSystem() throws {
        let first = regular(bars: 4, numerator: 4, bpm: 80)
        let second = regular(bars: 1, numerator: 4, bpm: 120)
        let project = fixture(timing: [first, second])
        XCTAssertEqual(try TimelineCompiler.compile(project).duration, 14)
    }

    func testRepeatedSectionRetainsSourceIdentityAndDistinctOccurrence() throws {
        var project = fixture(timing: [regular(bars: 4, numerator: 4, bpm: 80)])
        project.readingOrder.append(SectionOccurrence(sectionID: project.sections[0].id))
        let timeline = try TimelineCompiler.compile(project)
        XCTAssertEqual(timeline.duration, 24)
        XCTAssertEqual(timeline.spans[0].systemID, timeline.spans[1].systemID)
        XCTAssertNotEqual(timeline.spans[0].id, timeline.spans[1].id)
        XCTAssertEqual(timeline.span(at: 12)?.id, timeline.spans[1].id)
        XCTAssertNil(timeline.span(at: 24))
    }

    func testUnconfirmedImportCannotReceiveInventedPlaybackTiming() {
        let project = fixture(timing: nil)
        XCTAssertThrowsError(try TimelineCompiler.compile(project)) {
            XCTAssertEqual($0 as? TimingError, .unconfirmedTiming(project.systems[0].id))
        }
    }

    func testMissingSectionReportsBrokenRoute() {
        var project = fixture(timing: [regular(bars: 1, numerator: 4, bpm: 80)])
        let missingID = UUID()
        project.readingOrder = [SectionOccurrence(sectionID: missingID)]
        XCTAssertThrowsError(try TimelineCompiler.compile(project)) {
            XCTAssertEqual($0 as? TimingError, .missingSection(missingID))
        }
    }

    func testInvalidTempoAndMeterAreRejectedAtTimingBoundary() {
        var segment = regular(bars: 1, numerator: 4, bpm: 0)
        XCTAssertThrowsError(try segment.validate()) {
            XCTAssertEqual($0 as? TimingError, .invalidTempo)
        }
        segment.tempo.bpm = 80
        segment.meter.denominator = 3
        XCTAssertThrowsError(try segment.validate()) {
            XCTAssertEqual($0 as? TimingError, .invalidMeter)
        }
    }

    func testProjectStorageRoundTripPreservesTimingAndRouteIDs() throws {
        let project = fixture(timing: [regular(bars: 4, numerator: 4, bpm: 80)])
        let restored = try JSONDecoder().decode(
            ScoreProject.self, from: JSONEncoder().encode(project)
        )
        XCTAssertEqual(restored, project)
        XCTAssertEqual(try TimelineCompiler.compile(restored).duration, 12)
    }

    private func regular(bars: Int, numerator: Int, bpm: Double) -> TimingSegment {
        TimingSegment(
            quarterBeats: Double(bars * numerator),
            meter: TimeSignature(numerator: numerator, denominator: 4),
            tempo: ReferenceTempo(bpm: bpm)
        )
    }

    private func fixture(timing: [TimingSegment]?) -> ScoreProject {
        let system = SourceSystem(
            pageIndex: 0, bounds: .fullPage, label: "Line 1", timing: timing
        )
        let section = ScoreSection(name: "A", systemIDs: [system.id])
        return ScoreProject(
            title: "Study", sourceFilename: "study.pdf", systems: [system],
            sections: [section],
            readingOrder: [SectionOccurrence(sectionID: section.id)]
        )
    }
}
