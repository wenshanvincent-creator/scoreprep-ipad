import Foundation

public enum BeatUnit: String, Codable, CaseIterable, Sendable {
    case quarter
    case eighth
    case dottedQuarter

    public var quarterBeats: Double {
        switch self {
        case .quarter: return 1
        case .eighth: return 0.5
        case .dottedQuarter: return 1.5
        }
    }

    public var label: String {
        switch self {
        case .quarter: return "Quarter note"
        case .eighth: return "Eighth note"
        case .dottedQuarter: return "Dotted quarter"
        }
    }
}

public struct TimeSignature: Codable, Equatable, Sendable {
    public var numerator: Int
    public var denominator: Int

    public init(numerator: Int, denominator: Int) {
        self.numerator = numerator
        self.denominator = denominator
    }

    public var quarterBeatsPerBar: Double {
        Double(numerator) * 4 / Double(denominator)
    }
}

public struct ReferenceTempo: Codable, Equatable, Sendable {
    public var bpm: Double
    public var pulse: BeatUnit

    public init(bpm: Double, pulse: BeatUnit = .quarter) {
        self.bpm = bpm
        self.pulse = pulse
    }
}

public struct TimingSegment: Codable, Equatable, Sendable {
    public var quarterBeats: Double
    public var meter: TimeSignature
    public var tempo: ReferenceTempo
    public var startingBarPhase: Double

    public init(
        quarterBeats: Double, meter: TimeSignature,
        tempo: ReferenceTempo, startingBarPhase: Double = 0
    ) {
        self.quarterBeats = quarterBeats
        self.meter = meter
        self.tempo = tempo
        self.startingBarPhase = startingBarPhase
    }

    public var duration: Double {
        quarterBeats / tempo.pulse.quarterBeats * 60 / tempo.bpm
    }

    public func validate() throws {
        guard meter.numerator > 0, meter.denominator > 0,
              meter.denominator.nonzeroBitCount == 1 else {
            throw TimingError.invalidMeter
        }
        guard tempo.bpm.isFinite, tempo.bpm > 0 else {
            throw TimingError.invalidTempo
        }
        guard quarterBeats.isFinite, quarterBeats > 0 else {
            throw TimingError.invalidDuration
        }
        guard startingBarPhase.isFinite, startingBarPhase >= 0,
              startingBarPhase < meter.quarterBeatsPerBar else {
            throw TimingError.invalidBarPhase
        }
        guard duration.isFinite else { throw TimingError.invalidDuration }
    }
}

public enum TimingError: Error, Equatable, LocalizedError {
    case invalidMeter
    case invalidTempo
    case invalidDuration
    case invalidBarPhase
    case emptyReadingOrder
    case missingSection(UUID)
    case missingSystem(UUID)
    case unconfirmedTiming(UUID)

    public var errorDescription: String? {
        switch self {
        case .invalidMeter: return "Enter a positive meter with a power-of-two denominator."
        case .invalidTempo: return "Enter a tempo greater than zero."
        case .invalidDuration: return "Enter a performed beat count greater than zero."
        case .invalidBarPhase: return "The starting beat must be within the bar."
        case .emptyReadingOrder: return "Add a section to the reading order."
        case .missingSection: return "A section in the reading order is missing."
        case .missingSystem: return "A section refers to a missing musical line."
        case .unconfirmedTiming: return "Confirm timing for each line before automatic playback."
        }
    }
}
