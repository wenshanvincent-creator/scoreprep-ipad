import XCTest
@testable import ScoreCore

final class PracticeTransportTests: XCTestCase {
    func testCountInDoesNotConsumeMusicAndLineBoundariesStayHalfOpen() throws {
        var transport = PracticeTransport(timeline: try route([common(), common()]))
        try transport.start(at: 10, countInBars: 1)
        let leadIn = transport.snapshot(at: 12)
        XCTAssertEqual(leadIn.phase, .countingIn)
        XCTAssertEqual(leadIn.referencePosition, 0)
        XCTAssertEqual(leadIn.currentSpanIndex, 0)
        XCTAssertEqual(leadIn.upcomingSpanIndex, 1)
        XCTAssertEqual(leadIn.countInRemaining, 1, accuracy: 0.000_001)
        XCTAssertEqual(transport.snapshot(at: 13).phase, .playing)
        XCTAssertEqual(transport.snapshot(at: 16).currentSpanIndex, 1)
        let finished = transport.snapshot(at: 19)
        XCTAssertEqual(finished.phase, .finished)
        XCTAssertNil(finished.upcomingSpanIndex)
    }

    func testPickupCountInEntersOnBeatFourThenReachesTheNextDownbeat() throws {
        let pickup = TimingSegment(quarterBeats: 1, meter: .init(numerator: 4, denominator: 4),
                                   tempo: .init(bpm: 60), startingBarPhase: 3)
        let fullBar = TimingSegment(quarterBeats: 4, meter: pickup.meter, tempo: pickup.tempo)
        var transport = PracticeTransport(timeline: try route([pickup, fullBar]))
        try transport.start(at: 0, countInBars: 1)
        XCTAssertEqual(transport.countInDuration, 3, accuracy: 0.000_001)
        XCTAssertEqual(transport.snapshot(at: 3).currentSpanIndex, 0)
        XCTAssertEqual(transport.snapshot(at: 3).referencePosition, 0)
        XCTAssertEqual(transport.snapshot(at: 4).currentSpanIndex, 1)
        transport.stop()
        try transport.start(at: 10, countInBars: 2)
        XCTAssertEqual(transport.countInDuration, 7, accuracy: 0.000_001)
    }

    func testCompoundCountInUsesTheExplicitDottedQuarterPulse() throws {
        let segment = TimingSegment(quarterBeats: 3, meter: .init(numerator: 6, denominator: 8),
                                    tempo: .init(bpm: 60, pulse: .dottedQuarter))
        var transport = PracticeTransport(timeline: try route([segment, segment]))
        try transport.start(at: 0, countInBars: 1)
        XCTAssertEqual(transport.countInDuration, 2, accuracy: 0.000_001)
        XCTAssertEqual(transport.snapshot(at: 2).phase, .playing)
        XCTAssertEqual(transport.snapshot(at: 4).currentSpanIndex, 1)
    }

    func testPauseSpeedAndAudioHostMappingPreserveTheSameMusicalPosition() throws {
        var transport = PracticeTransport(timeline: try route([common(), common()]))
        try transport.start(at: 10, countInBars: 0)
        try transport.setSpeed(0.5, at: 11)
        XCTAssertEqual(transport.snapshot(at: 11).referencePosition, 1, accuracy: 0.000_001)
        XCTAssertEqual(transport.snapshot(at: 13).referencePosition, 2, accuracy: 0.000_001)
        transport.pause(at: 13)
        XCTAssertEqual(transport.snapshot(at: 99).referencePosition, 2, accuracy: 0.000_001)
        XCTAssertNil(transport.hostTime(forElapsed: 3, after: 99))
        transport.resume(at: 100)
        XCTAssertEqual(try XCTUnwrap(transport.hostTime(forElapsed: 3, after: 100)), 102, accuracy: 0.000_001)
        XCTAssertEqual(transport.snapshot(at: 103).referencePosition, 3.5, accuracy: 0.000_001)
        XCTAssertEqual(transport.snapshot(at: 103).currentSpanIndex, 1)
    }

    func testLoopWrapsAcrossSeveralCyclesAndManualNavigationDisarmsIt() throws {
        let timeline = try route([common(), common(), common()])
        var transport = PracticeTransport(timeline: timeline)
        try transport.setLoop(.init(firstSpanID: timeline.spans[1].id,
                                    lastSpanID: timeline.spans[2].id), at: 0)
        try transport.start(at: 0, countInBars: 0)
        XCTAssertEqual(transport.snapshot(at: 3).currentSpanIndex, 2)
        XCTAssertEqual(transport.snapshot(at: 3).upcomingSpanIndex, 1)
        XCTAssertEqual(transport.snapshot(at: 6).referencePosition, 3, accuracy: 0.000_001)
        XCTAssertEqual(transport.snapshot(at: 18).referencePosition, 3, accuracy: 0.000_001)
        try transport.seek(to: timeline.spans[0].id, at: 19)
        XCTAssertEqual(transport.snapshot(at: 200).phase, .paused)
        XCTAssertEqual(transport.snapshot(at: 200).referencePosition, 0)
        XCTAssertNil(transport.loop)
    }

    func testPausingAndChangingSpeedDuringCountInKeepsTheEntrance() throws {
        var transport = PracticeTransport(timeline: try route([common(), common()]))
        try transport.start(at: 0, countInBars: 1)
        transport.pause(at: 1)
        try transport.setSpeed(2, at: 50)
        XCTAssertEqual(transport.snapshot(at: 99).referencePosition, 0)
        XCTAssertEqual(transport.snapshot(at: 99).countInRemaining, 1, accuracy: 0.000_001)
        transport.resume(at: 100)
        XCTAssertEqual(try XCTUnwrap(transport.hostTime(forElapsed: 3, after: 100)), 101, accuracy: 0.000_001)
        XCTAssertEqual(transport.snapshot(at: 101).phase, .playing)
        XCTAssertEqual(transport.snapshot(at: 101).referencePosition, 0)
        XCTAssertEqual(transport.snapshot(at: 102).referencePosition, 2, accuracy: 0.000_001)
    }

    func testLoopIdentifiesOccurrencesOfARepeatedSourceSeparately() throws {
        let segment = common()
        let system = SourceSystem(pageIndex: 0, bounds: .fullPage, label: "A", timing: [segment])
        let section = ScoreSection(name: "Repeat", systemIDs: [system.id])
        let project = ScoreProject(title: "Repeat", sourceFilename: "owned.pdf", systems: [system],
                                   sections: [section], readingOrder: [
                                    SectionOccurrence(sectionID: section.id),
                                    SectionOccurrence(sectionID: section.id)
                                   ])
        let timeline = try TimelineCompiler.compile(project)
        var transport = PracticeTransport(timeline: timeline)
        try transport.setLoop(.init(firstSpanID: timeline.spans[1].id,
                                    lastSpanID: timeline.spans[1].id), at: 0)
        try transport.start(at: 0, countInBars: 0)
        XCTAssertEqual(transport.snapshot(at: 6).currentSpanIndex, 1)
        XCTAssertEqual(transport.snapshot(at: 6).upcomingSpanIndex, 1)
    }

    func testAudioMappingRejectsHistoryAndEventsAfterThePassageEnds() throws {
        var transport = PracticeTransport(timeline: try route([common(), common()]))
        try transport.start(at: 0, countInBars: 0)
        try transport.setSpeed(0.5, at: 1)
        XCTAssertNil(transport.hostTime(forElapsed: 0.5, after: 1))
        XCTAssertEqual(try XCTUnwrap(transport.hostTime(forElapsed: 2, after: 1)), 3, accuracy: 0.000_001)
        XCTAssertNil(transport.hostTime(forElapsed: 7, after: 1))
        XCTAssertEqual(transport.snapshot(at: 11).phase, .finished)
        XCTAssertNil(transport.hostTime(forElapsed: 6, after: 11))
    }

    func testInvalidControlsCannotChangeTheRunningPosition() throws {
        let timeline = try route([common(), common()])
        var transport = PracticeTransport(timeline: timeline)
        try transport.start(at: 0, countInBars: 0)
        XCTAssertThrowsError(try transport.setSpeed(0, at: 1))
        XCTAssertThrowsError(try transport.setSpeed(.nan, at: 1))
        XCTAssertThrowsError(try transport.setLoop(.init(firstSpanID: timeline.spans[1].id,
                                                       lastSpanID: timeline.spans[0].id), at: 1))
        XCTAssertThrowsError(try transport.start(at: 1, countInBars: -1))
        XCTAssertEqual(transport.snapshot(at: 2).referencePosition, 2, accuracy: 0.000_001)
        XCTAssertEqual(transport.snapshot(at: 2).phase, .playing)
    }

    private func common() -> TimingSegment {
        TimingSegment(quarterBeats: 4, meter: .init(numerator: 4, denominator: 4),
                      tempo: .init(bpm: 80))
    }

    private func route(_ segments: [TimingSegment]) throws -> CompiledTimeline {
        let systems = segments.enumerated().map {
            SourceSystem(pageIndex: 0, bounds: .fullPage, label: "Line \($0.offset + 1)", timing: [$0.element])
        }
        let section = ScoreSection(name: "Score", systemIDs: systems.map(\.id))
        return try TimelineCompiler.compile(ScoreProject(
            title: "Owned exercise", sourceFilename: "owned.pdf", systems: systems,
            sections: [section], readingOrder: [SectionOccurrence(sectionID: section.id)]
        ))
    }
}
