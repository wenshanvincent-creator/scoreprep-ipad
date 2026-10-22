import Foundation

public struct PracticePulse: Equatable, Sendable {
    /// Reference-speed elapsed take time, including count-in and loop cycles.
    public let elapsed: Double
    public let spanIndex: Int
    public let isCountIn: Bool
    public let isDownbeat: Bool
    /// One-based denominator beat (1 and 4 for dotted-quarter pulses in 6/8).
    public let beatInBar: Double
}

public struct PracticePulseDisplay: Equatable, Sendable {
    public let pulse: PracticePulse
    /// 0 at this pulse, approaching 1 at the next; sampled from the transport.
    public let progress: Double
}

/// A continuous explicit-pulse coordinate, projected through each region's
/// tempo onto elapsed take time. Bar lines affect accents, never the BPM grid.
public struct PracticePulsePlanner: Sendable {
    private struct Region: Sendable {
        let start: Double
        let end: Double
        let pulseStart: Double
        let spanIndex: Int
        let segment: TimingSegment
        var secondsPerPulse: Double { 60 / segment.tempo.bpm }
    }

    private let timeline: CompiledTimeline
    private let regions: [Region]
    private let longestPulse: Double
    private static let tolerance = 1e-9

    public init(timeline: CompiledTimeline) {
        self.timeline = timeline
        var regions: [Region] = []
        var pulseStart = 0.0
        for (index, span) in timeline.spans.enumerated() {
            var start = span.start
            for (segmentIndex, segment) in span.segments.enumerated() {
                let end = segmentIndex == span.segments.count - 1 ? span.end : start + segment.duration
                regions.append(Region(start: start, end: end,
                                      pulseStart: pulseStart, spanIndex: index, segment: segment))
                start = end
                pulseStart += segment.quarterBeats / segment.tempo.pulse.quarterBeats
            }
        }
        self.regions = regions
        longestPulse = regions.map(\.secondsPerPulse).max()!
    }

    /// The transport must use the same compiled timeline as this planner.
    /// Queries are half-open. Pulse phase continues through tempo/unit changes
    /// and A-B cycles; startingBarPhase seeds each new take's entrance/accent.
    public func pulses(for transport: PracticeTransport, in range: Range<Double>) -> [PracticePulse] {
        guard !range.isEmpty else { return [] }
        let entry = transport.entryReferencePosition
        let lead = transport.countInDuration
        let entryRegion = region(at: entry)
        let entryOffset = (entry - entryRegion.start) / entryRegion.secondsPerPulse
        let entryPhase = (entryRegion.segment.startingBarPhase
            + entryOffset * entryRegion.segment.tempo.pulse.quarterBeats)
            .truncatingRemainder(dividingBy: entryRegion.segment.meter.quarterBeatsPerBar)
        let origin = lead > 0 ? lead / entryRegion.secondsPerPulse
            : entryPhase / entryRegion.segment.tempo.pulse.quarterBeats
        let entryPulse = coordinate(at: entry)
        var result: [PracticePulse] = []

        if lead > 0, range.lowerBound < lead {
            let count = Int(ceil(origin))
            for number in 0..<count {
                let elapsed = Double(number) * entryRegion.secondsPerPulse
                // Equivalent duration formulas can differ by an ulp. An
                // entrance pulse belongs to music, never also to count-in.
                if elapsed < lead - Self.tolerance, range.contains(elapsed) {
                    result.append(makePulse(elapsed: elapsed, region: entryRegion,
                                            quarterPhase: Double(number) * entryRegion.segment.tempo.pulse.quarterBeats,
                                            isCountIn: true))
                }
            }
        }

        let loopRange: Range<Double>? = transport.loop.map { loop in
            let first = timeline.spans.first { $0.id == loop.firstSpanID }!
            let last = timeline.spans.first { $0.id == loop.lastSpanID }!
            return first.start..<last.end
        }
        let firstEnd = loopRange?.upperBound ?? timeline.duration
        appendMusic(from: entry, to: firstEnd, elapsedStart: lead, pulseStart: origin,
                    in: range, into: &result)

        if let loopRange {
            let duration = loopRange.upperBound - loopRange.lowerBound
            let repeatsAt = lead + firstEnd - entry
            let loopPulses = coordinate(at: loopRange.upperBound) - coordinate(at: loopRange.lowerBound)
            let repeatsPulse = origin + coordinate(at: firstEnd) - entryPulse
            let firstCycle = max(0, Int(floor((range.lowerBound - repeatsAt) / duration)))
            let lastCycle = Int(ceil((range.upperBound - repeatsAt) / duration))
            if firstCycle < lastCycle {
                for cycle in firstCycle..<lastCycle {
                    appendMusic(from: loopRange.lowerBound, to: loopRange.upperBound,
                                elapsedStart: repeatsAt + Double(cycle) * duration,
                                pulseStart: repeatsPulse + Double(cycle) * loopPulses,
                                in: range, into: &result)
                }
            }
        }
        return result.sorted { $0.elapsed < $1.elapsed }
    }

    public func display(for transport: PracticeTransport, elapsed: Double) -> PracticePulseDisplay? {
        let lower = max(0, elapsed - longestPulse - Self.tolerance)
        let upper = elapsed + longestPulse + Self.tolerance
        let nearby = pulses(for: transport, in: lower..<upper)
        guard let index = nearby.lastIndex(where: { $0.elapsed <= elapsed }) else { return nil }
        let current = nearby[index]
        let next = index + 1 < nearby.count ? nearby[index + 1].elapsed : current.elapsed + longestPulse
        return PracticePulseDisplay(pulse: current, progress: min(1, (elapsed - current.elapsed) / (next - current.elapsed)))
    }

    private func region(at position: Double) -> Region {
        regions.first { position >= $0.start && position < $0.end } ?? regions.last!
    }

    private func coordinate(at position: Double) -> Double {
        let region = region(at: position)
        return region.pulseStart + (position - region.start) / region.secondsPerPulse
    }

    private func appendMusic(from start: Double, to end: Double, elapsedStart: Double, pulseStart: Double,
                             in range: Range<Double>, into result: inout [PracticePulse]) {
        let coordinateStart = coordinate(at: start)
        for region in regions where region.start < end && region.end > start {
            let lower = max(start, region.start)
            let upper = min(end, region.end)
            let elapsed = elapsedStart + lower - start
            guard elapsed < range.upperBound, elapsed + upper - lower > range.lowerBound else { continue }
            let first = pulseStart + coordinate(at: lower) - coordinateStart
            let last = first + (upper - lower) / region.secondsPerPulse
            let firstNumber = Int(ceil(first - Self.tolerance))
            let lastNumber = Int(ceil(last - Self.tolerance))
            guard firstNumber < lastNumber else { continue }
            for number in firstNumber..<lastNumber {
                let offset = max(0, Double(number) - first) * region.secondsPerPulse
                let time = elapsed + offset
                if range.contains(time) {
                    let quarterPhase = region.segment.startingBarPhase
                        + ((lower - region.start) + offset) / region.secondsPerPulse
                        * region.segment.tempo.pulse.quarterBeats
                    result.append(makePulse(elapsed: time, region: region,
                                            quarterPhase: quarterPhase, isCountIn: false))
                }
            }
        }
    }

    private func makePulse(elapsed: Double, region: Region, quarterPhase: Double, isCountIn: Bool) -> PracticePulse {
        let bar = region.segment.meter.quarterBeatsPerBar
        let phase = quarterPhase.truncatingRemainder(dividingBy: bar)
        let downbeat = min(phase, bar - phase) < Self.tolerance
        return PracticePulse(elapsed: elapsed, spanIndex: region.spanIndex, isCountIn: isCountIn,
                             isDownbeat: downbeat,
                             beatInBar: downbeat ? 1 : 1 + phase * Double(region.segment.meter.denominator) / 4)
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
