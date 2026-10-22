import Foundation

public struct PracticePulse: Equatable, Sendable {
    /// Reference-speed elapsed take time, including count-in and loop cycles.
    public let elapsed: Double
    public let spanIndex: Int
    public let isCountIn: Bool
    public let isDownbeat: Bool
}

/// Explicit meter/pulse grids, projected onto the transport's elapsed axis.
/// Queries are half-open, so adjoining lookahead windows share no event.
public struct PracticePulsePlanner: Sendable {
    private struct ReferencePulse: Sendable {
        let position: Double
        let spanIndex: Int
        let isDownbeat: Bool
    }

    private let timeline: CompiledTimeline
    private let music: [ReferencePulse]

    public init(timeline: CompiledTimeline) {
        self.timeline = timeline
        var pulses: [ReferencePulse] = []
        for (index, span) in timeline.spans.enumerated() {
            var position = span.start
            for segment in span.segments {
                let secondsPerQuarter = segment.duration / segment.quarterBeats
                for pulse in Self.grid(quarters: segment.quarterBeats, phase: segment.startingBarPhase,
                                       meter: segment.meter, unit: segment.tempo.pulse) {
                    pulses.append(ReferencePulse(position: position + pulse.quarters * secondsPerQuarter,
                                                 spanIndex: index, isDownbeat: pulse.isDownbeat))
                }
                position += segment.duration
            }
        }
        music = pulses
    }

    /// The transport must use the same compiled timeline as this planner.
    public func pulses(for transport: PracticeTransport, in range: Range<Double>) -> [PracticePulse] {
        guard !range.isEmpty else { return [] }
        let entry = transport.entryReferencePosition
        let lead = transport.countInDuration
        var result: [PracticePulse] = []

        if lead > 0, range.lowerBound < lead {
            let index = timeline.spans.firstIndex { entry >= $0.start && entry < $0.end }!
            let span = timeline.spans[index]
            var offset = entry - span.start
            for segment in span.segments {
                if offset < segment.duration {
                    let secondsPerQuarter = segment.duration / segment.quarterBeats
                    for pulse in Self.grid(quarters: lead / secondsPerQuarter, phase: 0,
                                           meter: segment.meter, unit: segment.tempo.pulse) {
                        let elapsed = pulse.quarters * secondsPerQuarter
                        if elapsed < lead, range.contains(elapsed) {
                            result.append(PracticePulse(elapsed: elapsed, spanIndex: index,
                                                        isCountIn: true, isDownbeat: pulse.isDownbeat))
                        }
                    }
                    break
                }
                offset -= segment.duration
            }
        }

        let loopRange: Range<Double>? = transport.loop.map { loop in
            let first = timeline.spans.first { $0.id == loop.firstSpanID }!
            let last = timeline.spans.first { $0.id == loop.lastSpanID }!
            return first.start..<last.end
        }
        let firstEnd = loopRange?.upperBound ?? timeline.duration
        for pulse in music where pulse.position >= entry && pulse.position < firstEnd {
            let elapsed = lead + pulse.position - entry
            if range.contains(elapsed) {
                result.append(PracticePulse(elapsed: elapsed, spanIndex: pulse.spanIndex,
                                            isCountIn: false, isDownbeat: pulse.isDownbeat))
            }
        }

        if let loopRange {
            let duration = loopRange.upperBound - loopRange.lowerBound
            let repeatsAt = lead + firstEnd - entry
            let firstCycle = max(0, Int(floor((range.lowerBound - repeatsAt) / duration)))
            let lastCycle = Int(ceil((range.upperBound - repeatsAt) / duration))
            if firstCycle < lastCycle {
                for cycle in firstCycle..<lastCycle {
                    for pulse in music where loopRange.contains(pulse.position) {
                        let elapsed = repeatsAt + Double(cycle) * duration + pulse.position - loopRange.lowerBound
                        if range.contains(elapsed) {
                            result.append(PracticePulse(elapsed: elapsed, spanIndex: pulse.spanIndex,
                                                        isCountIn: false, isDownbeat: pulse.isDownbeat))
                        }
                    }
                }
            }
        }
        return result.sorted { $0.elapsed < $1.elapsed }
    }

    private static func grid(quarters: Double, phase: Double, meter: TimeSignature,
                             unit: BeatUnit) -> [(quarters: Double, isDownbeat: Bool)] {
        let bar = meter.quarterBeatsPerBar
        let bars = Int(ceil((phase + quarters) / bar))
        let pulsesPerBar = Int(ceil(bar / unit.quarterBeats))
        var result: [(Double, Bool)] = []
        for barIndex in 0..<bars {
            for pulse in 0..<pulsesPerBar {
                let quarter = Double(barIndex) * bar + Double(pulse) * unit.quarterBeats - phase
                if quarter >= 0, quarter < quarters { result.append((quarter, pulse == 0)) }
            }
        }
        return result
    }
}

public struct PracticePulseID: Hashable, Sendable {
    public let generation: UInt64
    public let elapsed: Double
}

public struct ScheduledPracticePulse: Equatable, Identifiable, Sendable {
    public let id: PracticePulseID
    public let pulse: PracticePulse
    /// Seconds on the same monotonic host clock passed to PracticeTransport.
    public let hostTime: Double
}

/// Lookahead bookkeeping only. Wakeups never advance musical time.
public struct PracticePulseSchedule: Sendable {
    public private(set) var generation: UInt64 = 0
    private var scheduledUntil = 0.0

    public init() {}

    /// Every command that invalidates queued audio begins a new generation.
    public mutating func reset(at elapsed: Double) {
        generation += 1
        scheduledUntil = elapsed
    }

    public mutating func upcoming(transport: PracticeTransport, planner: PracticePulsePlanner,
                                  at hostTime: Double, lookahead: Double) -> [ScheduledPracticePulse] {
        let current = transport.snapshot(at: hostTime)
        guard current.isRunning else { return [] }
        let end = current.elapsed + lookahead * transport.speed
        let start = max(current.elapsed, scheduledUntil)
        guard end > start else { return [] }
        scheduledUntil = end
        return planner.pulses(for: transport, in: start..<end).compactMap { pulse in
            guard let time = transport.hostTime(forElapsed: pulse.elapsed, after: hostTime) else { return nil }
            return ScheduledPracticePulse(id: PracticePulseID(generation: generation, elapsed: pulse.elapsed),
                                           pulse: pulse, hostTime: time)
        }
    }
}
