import Foundation

public enum PracticePhase: Equatable, Sendable {
    case ready, countingIn, playing, paused, finished
}

public struct PracticeLoop: Equatable, Sendable {
    public let firstSpanID: String
    public let lastSpanID: String

    public init(firstSpanID: String, lastSpanID: String) {
        self.firstSpanID = firstSpanID
        self.lastSpanID = lastSpanID
    }
}

public struct PracticeSnapshot: Equatable, Sendable {
    public let phase: PracticePhase
    /// Position in the compiled score at reference speed, excluding count-in.
    public let referencePosition: Double
    /// Reference-speed elapsed time for this take, including count-in and loops.
    public let elapsed: Double
    public let currentSpanIndex: Int
    public let upcomingSpanIndex: Int?
    public let countInRemaining: Double

    public var isRunning: Bool { phase == .playing || phase == .countingIn }
}

public enum PracticeError: Error, Equatable, LocalizedError {
    case invalidSpeed, invalidCountIn, unknownSpan(String), invalidLoopOrder

    public var errorDescription: String? {
        switch self {
        case .invalidSpeed: return "Choose a practice speed greater than zero."
        case .invalidCountIn: return "Choose zero to four count-in bars."
        case .unknownSpan: return "This reading occurrence is no longer in the practice route."
        case .invalidLoopOrder: return "The loop ending must follow its beginning."
        }
    }
}

/// A clock mapping, not a repeating timer. Native audio and display callers pass
/// seconds from the same monotonic host clock and use the same elapsed axis.
public struct PracticeTransport: Sendable {
    public let timeline: CompiledTimeline
    public private(set) var speed = 1.0
    public private(set) var loop: PracticeLoop?
    public private(set) var countInDuration = 0.0

    private enum Activity: Equatable, Sendable { case ready, running, paused }
    private var activity = Activity.ready
    private var entryPosition = 0.0
    private var anchorElapsed = 0.0
    private var anchorHostTime = 0.0
    private var loopIndices: ClosedRange<Int>?

    /// TimelineCompiler supplies a nonempty route with confirmed valid timing.
    public init(timeline: CompiledTimeline) { self.timeline = timeline }

    public func snapshot(at hostTime: Double) -> PracticeSnapshot {
        let elapsed = elapsed(at: hostTime)
        let remaining = max(0, countInDuration - elapsed)
        let progress = entryPosition + max(0, elapsed - countInDuration)
        let position: Double
        if let bounds = loopBounds, progress >= bounds.upperBound {
            position = bounds.lowerBound + (progress - bounds.lowerBound)
                .truncatingRemainder(dividingBy: bounds.upperBound - bounds.lowerBound)
        } else {
            position = min(progress, timeline.duration)
        }
        let index = timeline.spans.firstIndex {
            position >= $0.start && position < $0.end
        } ?? timeline.spans.count - 1
        let phase: PracticePhase
        if loop == nil, position >= timeline.duration {
            phase = .finished
        } else {
            switch activity {
            case .ready: phase = .ready
            case .paused: phase = .paused
            case .running: phase = remaining > 0 ? .countingIn : .playing
            }
        }
        let upcoming: Int?
        if phase == .finished {
            upcoming = nil
        } else if let indices = loopIndices, index == indices.upperBound {
            upcoming = indices.lowerBound
        } else {
            upcoming = index + 1 < timeline.spans.count ? index + 1 : nil
        }
        return PracticeSnapshot(
            phase: phase, referencePosition: position, elapsed: elapsed,
            currentSpanIndex: index, upcomingSpanIndex: upcoming,
            countInRemaining: remaining / speed
        )
    }

    public mutating func start(at hostTime: Double, countInBars: Int) throws {
        guard (0...4).contains(countInBars) else { throw PracticeError.invalidCountIn }
        let previous = snapshot(at: hostTime)
        entryPosition = previous.phase == .finished ? (loopBounds?.lowerBound ?? 0)
            : previous.referencePosition
        countInDuration = leadIn(bars: countInBars, at: entryPosition)
        anchorElapsed = 0
        anchorHostTime = hostTime
        activity = .running
    }

    public mutating func pause(at hostTime: Double) {
        anchorElapsed = elapsed(at: hostTime)
        anchorHostTime = hostTime
        activity = .paused
    }

    public mutating func resume(at hostTime: Double) {
        guard activity == .paused else { return }
        anchorHostTime = hostTime
        activity = .running
    }

    public mutating func stop() {
        entryPosition = loopBounds?.lowerBound ?? 0
        anchorElapsed = 0
        countInDuration = 0
        activity = .ready
    }

    public mutating func setSpeed(_ value: Double, at hostTime: Double) throws {
        guard value.isFinite, value > 0 else { throw PracticeError.invalidSpeed }
        anchorElapsed = elapsed(at: hostTime)
        anchorHostTime = hostTime
        speed = value
    }

    /// Manual navigation pauses immediately. Moving outside A-B disarms that loop.
    public mutating func seek(to spanID: String, at hostTime: Double) throws {
        guard let index = timeline.spans.firstIndex(where: { $0.id == spanID }) else {
            throw PracticeError.unknownSpan(spanID)
        }
        if let indices = loopIndices, !indices.contains(index) {
            loop = nil
            loopIndices = nil
        }
        moveCursor(to: timeline.spans[index].start, at: hostTime)
    }

    /// Changing loop boundaries pauses; resuming is an explicit musician action.
    public mutating func setLoop(_ value: PracticeLoop?, at hostTime: Double) throws {
        let position = snapshot(at: hostTime).referencePosition
        if let value {
            guard let first = timeline.spans.firstIndex(where: { $0.id == value.firstSpanID }) else {
                throw PracticeError.unknownSpan(value.firstSpanID)
            }
            guard let last = timeline.spans.firstIndex(where: { $0.id == value.lastSpanID }) else {
                throw PracticeError.unknownSpan(value.lastSpanID)
            }
            guard first <= last else { throw PracticeError.invalidLoopOrder }
            loopIndices = first...last
            loop = value
        } else {
            loop = nil
            loopIndices = nil
        }
        let cursor = loopBounds.map { $0.contains(position) ? position : $0.lowerBound } ?? position
        moveCursor(to: cursor, at: hostTime)
    }

    /// Audio events use this mapping rather than deriving a second clock.
    public func hostTime(forElapsed elapsed: Double) -> Double? {
        guard activity == .running else { return nil }
        return anchorHostTime + (elapsed - anchorElapsed) / speed
    }

    private func elapsed(at hostTime: Double) -> Double {
        activity == .running
            ? anchorElapsed + max(0, hostTime - anchorHostTime) * speed
            : anchorElapsed
    }

    private var loopBounds: Range<Double>? {
        loopIndices.map {
            timeline.spans[$0.lowerBound].start..<timeline.spans[$0.upperBound].end
        }
    }

    private mutating func moveCursor(to position: Double, at hostTime: Double) {
        entryPosition = position
        anchorElapsed = 0
        anchorHostTime = hostTime
        countInDuration = 0
        activity = .paused
    }

    private func leadIn(bars: Int, at position: Double) -> Double {
        guard bars > 0 else { return 0 }
        let span = timeline.spans.first { position >= $0.start && position < $0.end }
            ?? timeline.spans[0]
        var offset = position - span.start
        for segment in span.segments {
            if offset < segment.duration {
                let quarterOffset = offset * segment.tempo.bpm / 60 * segment.tempo.pulse.quarterBeats
                let phase = (segment.startingBarPhase + quarterOffset)
                    .truncatingRemainder(dividingBy: segment.meter.quarterBeatsPerBar)
                // Count from beat one into a pickup; an extra bar adds a full bar.
                let quarters = Double(bars - 1) * segment.meter.quarterBeatsPerBar
                    + (phase == 0 ? segment.meter.quarterBeatsPerBar : phase)
                return quarters / segment.tempo.pulse.quarterBeats * 60 / segment.tempo.bpm
            }
            offset -= segment.duration
        }
        return 0
    }
}
