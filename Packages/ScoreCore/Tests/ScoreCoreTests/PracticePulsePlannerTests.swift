import XCTest
@testable import ScoreCore

final class PracticePulsePlannerTests: XCTestCase {
    func testOwnedPickupAndCompoundExerciseHasOnePulseAtEachBoundary() throws {
        let timeline = try route([
            [segment(5, phase: 3)], [segment(4)],
            [TimingSegment(quarterBeats: 6, meter: .init(numerator: 6, denominator: 8),
                           tempo: .init(bpm: 60, pulse: .dottedQuarter))]
        ])
        var transport = PracticeTransport(timeline: timeline)
        try transport.start(at: 10, countInBars: 1)
        let pulses = PracticePulsePlanner(timeline: timeline).pulses(for: transport, in: 0..<17)
        XCTAssertEqual(pulses.map(\.elapsed), (0..<16).map(Double.init))
        XCTAssertEqual(pulses.filter(\.isCountIn).map(\.elapsed), [0, 1, 2])
        XCTAssertEqual(pulses.filter(\.isDownbeat).map(\.elapsed), [0, 4, 8, 12, 14])
        XCTAssertEqual(pulses.map(\.spanIndex), Array(repeating: 0, count: 8)
                        + Array(repeating: 1, count: 4) + Array(repeating: 2, count: 4))
        XCTAssertEqual(transport.snapshot(at: 18).currentSpanIndex, 1)
        XCTAssertEqual(transport.snapshot(at: 22).currentSpanIndex, 2)
        XCTAssertEqual(transport.snapshot(at: 26).phase, .finished)
    }

    func testTempoAndPulseChangesInsideOneSystemKeepTheBoundaryHalfOpen() throws {
        let timeline = try route([[
            segment(2, bpm: 120),
            TimingSegment(quarterBeats: 3, meter: .init(numerator: 6, denominator: 8),
                          tempo: .init(bpm: 60, pulse: .dottedQuarter))
        ]])
        var transport = PracticeTransport(timeline: timeline)
        try transport.start(at: 0, countInBars: 0)
        let pulses = PracticePulsePlanner(timeline: timeline).pulses(for: transport, in: 0..<4)
        XCTAssertEqual(pulses.map(\.elapsed), [0, 0.5, 1, 2])
        XCTAssertEqual(pulses.map(\.isDownbeat), [true, false, true, false])
        XCTAssertEqual(transport.snapshot(at: 3).phase, .finished)
    }

    func testCompoundPickupCountsOnlyTheMissingExplicitPulse() throws {
        let pickup = TimingSegment(quarterBeats: 1.5, meter: .init(numerator: 6, denominator: 8),
                                   tempo: .init(bpm: 60, pulse: .dottedQuarter), startingBarPhase: 1.5)
        let bar = TimingSegment(quarterBeats: 3, meter: pickup.meter, tempo: pickup.tempo)
        let timeline = try route([[pickup], [bar]])
        var transport = PracticeTransport(timeline: timeline)
        try transport.start(at: 0, countInBars: 1)
        let pulses = PracticePulsePlanner(timeline: timeline).pulses(for: transport, in: 0..<5)
        XCTAssertEqual(pulses.map(\.elapsed), [0, 1, 2, 3])
        XCTAssertEqual(pulses.map(\.isCountIn), [true, false, false, false])
        XCTAssertEqual(pulses.map(\.isDownbeat), [true, false, true, false])
    }

    func testNonBinaryTempoCannotDuplicateTheCountInEntrance() throws {
        let timeline = try route([[segment(5, bpm: 110, phase: 3)]])
        var transport = PracticeTransport(timeline: timeline)
        try transport.start(at: 0, countInBars: 1)
        let pulses = PracticePulsePlanner(timeline: timeline).pulses(for: transport, in: 0..<2)
        XCTAssertEqual(pulses.filter(\.isCountIn).count, 3)
        let entrance = try XCTUnwrap(pulses.first { !$0.isCountIn })
        XCTAssertEqual(entrance.elapsed, 180 / 110, accuracy: 1e-9)
        XCTAssertEqual(pulses.filter { abs($0.elapsed - entrance.elapsed) < 1e-9 }.count, 1)
    }

    func testNonDividingPulseStaysSteadyAcrossBarsCountInSystemsAndLoopWraps() throws {
        let bar = TimingSegment(quarterBeats: 4, meter: .init(numerator: 4, denominator: 4),
                                tempo: .init(bpm: 60, pulse: .dottedQuarter))
        let timeline = try route([[bar], [bar]])
        let planner = PracticePulsePlanner(timeline: timeline)
        var transport = PracticeTransport(timeline: timeline)
        try transport.start(at: 0, countInBars: 1)
        let withCountIn = planner.pulses(for: transport, in: 0..<8)
        XCTAssertEqual(withCountIn.map(\.elapsed).count, 8)
        for (pulse, expected) in zip(withCountIn, 0..<8) {
            XCTAssertEqual(pulse.elapsed, Double(expected), accuracy: 1e-9)
        }
        XCTAssertEqual(withCountIn.filter(\.isCountIn).count, 3)
        // The entrance at 8/3 seconds is between pulses; it must not insert
        // a short interval or change the confirmed bar's duration.
        XCTAssertEqual(transport.countInDuration, 8 / 3, accuracy: 1e-9)
        XCTAssertEqual(timeline.duration, 16 / 3, accuracy: 1e-9)
        transport.stop()
        try transport.setLoop(.init(firstSpanID: timeline.spans[0].id, lastSpanID: timeline.spans[0].id), at: 10)
        try transport.start(at: 10, countInBars: 0)
        let looped = planner.pulses(for: transport, in: 0..<8.1)
        XCTAssertEqual(looped.count, 9)
        for (pulse, expected) in zip(looped, 0..<9) {
            XCTAssertEqual(pulse.elapsed, Double(expected), accuracy: 1e-9)
        }
    }

    func testSilentDisplayUsesCountInAndCompoundPulsePhaseFromTheSameTake() throws {
        let bar = TimingSegment(quarterBeats: 3, meter: .init(numerator: 6, denominator: 8),
                                tempo: .init(bpm: 60, pulse: .dottedQuarter))
        let timeline = try route([[bar]])
        var transport = PracticeTransport(timeline: timeline)
        try transport.start(at: 10, countInBars: 1)
        let planner = PracticePulsePlanner(timeline: timeline)
        let countIn = try XCTUnwrap(planner.display(for: transport, elapsed: 1.25))
        XCTAssertTrue(countIn.pulse.isCountIn)
        XCTAssertEqual(countIn.pulse.beatInBar, 4)
        XCTAssertEqual(countIn.progress, 0.25, accuracy: 1e-9)
        let music = try XCTUnwrap(planner.display(for: transport, elapsed: 2.5))
        XCTAssertFalse(music.pulse.isCountIn)
        XCTAssertTrue(music.pulse.isDownbeat)
        XCTAssertEqual(music.progress, 0.5, accuracy: 1e-9)
    }

    func testFinalDisplayUsesTerminalTempoAndTheRemainingPulseFraction() throws {
        let timeline = try route([[segment(1, bpm: 30), segment(2, bpm: 120)]])
        var transport = PracticeTransport(timeline: timeline)
        try transport.start(at: 0, countInBars: 0)
        let planner = PracticePulsePlanner(timeline: timeline)
        let final = try XCTUnwrap(planner.display(for: transport, elapsed: 2.75))
        XCTAssertEqual(final.pulse.elapsed, 2.5)
        XCTAssertEqual(final.progress, 0.5, accuracy: 1e-9)
        XCTAssertEqual(planner.pulses(for: transport, in: 0..<4).map(\.elapsed), [0, 2, 2.5])

        // The last onset can precede the final tempo change. Continue its
        // remaining fraction at the terminal tempo, rather than restarting it.
        let short = try route([[segment(0.5, bpm: 30), segment(0.25, bpm: 120)]])
        var shortTransport = PracticeTransport(timeline: short)
        try shortTransport.start(at: 0, countInBars: 0)
        let shortPlanner = PracticePulsePlanner(timeline: short)
        let crossing = try XCTUnwrap(shortPlanner.display(for: shortTransport, elapsed: 1.0625))
        XCTAssertEqual(crossing.pulse.elapsed, 0)
        XCTAssertEqual(crossing.progress, 0.85, accuracy: 1e-9)
        XCTAssertEqual(shortPlanner.pulses(for: shortTransport, in: 0..<2).map(\.elapsed), [0])
    }

    func testRepeatedLoopEventsHaveDistinctElapsedIdentitiesAndMissedPulsesAreNotReplayed() throws {
        let timeline = try route([[segment(1)]])
        var transport = PracticeTransport(timeline: timeline)
        try transport.setLoop(.init(firstSpanID: timeline.spans[0].id, lastSpanID: timeline.spans[0].id), at: 10)
        try transport.start(at: 10, countInBars: 0)
        let planner = PracticePulsePlanner(timeline: timeline)
        var schedule = PracticePulseSchedule()
        schedule.reset(at: 0)
        let first = schedule.upcoming(transport: transport, planner: planner, at: 10, lookahead: 2.5)
        XCTAssertEqual(first.map(\.pulse.elapsed), [0, 1, 2])
        XCTAssertEqual(Set(first.map(\.id)).count, 3)
        XCTAssertTrue(schedule.upcoming(transport: transport, planner: planner, at: 10.1, lookahead: 0.25).isEmpty)
        let afterStall = schedule.upcoming(transport: transport, planner: planner, at: 13.4, lookahead: 0.8)
        XCTAssertEqual(afterStall.map(\.pulse.elapsed), [4])
        XCTAssertEqual(afterStall[0].hostTime, 14, accuracy: 1e-9)
        transport.pause(at: 13.4)
        XCTAssertTrue(schedule.upcoming(transport: transport, planner: planner, at: 19, lookahead: 1).isEmpty)
        try transport.setSpeed(2, at: 19)
        transport.resume(at: 20)
        schedule.reset(at: transport.snapshot(at: 20).elapsed)
        let resumed = schedule.upcoming(transport: transport, planner: planner, at: 20, lookahead: 0.4)
        XCTAssertEqual(resumed.map(\.pulse.elapsed), [4])
        XCTAssertEqual(resumed[0].hostTime, 20.3, accuracy: 1e-9)
        XCTAssertNotEqual(resumed[0].id, afterStall[0].id)
    }

    private func segment(_ quarters: Double, bpm: Double = 60, phase: Double = 0) -> TimingSegment {
        TimingSegment(quarterBeats: quarters, meter: .init(numerator: 4, denominator: 4),
                      tempo: .init(bpm: bpm), startingBarPhase: phase)
    }

    private func route(_ timing: [[TimingSegment]]) throws -> CompiledTimeline {
        let systems = timing.enumerated().map {
            SourceSystem(pageIndex: 0, bounds: .fullPage, label: "Line \($0.offset + 1)", timing: $0.element)
        }
        let section = ScoreSection(name: "Owned exercise", systemIDs: systems.map(\.id))
        return try TimelineCompiler.compile(ScoreProject(title: "Pulse regression", sourceFilename: "owned.png",
            systems: systems, sections: [section], readingOrder: [SectionOccurrence(sectionID: section.id)]))
    }
}
