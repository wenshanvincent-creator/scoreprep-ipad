import Foundation

public struct TimelineSpan: Equatable, Identifiable, Sendable {
    public let occurrenceID: UUID
    public let systemOffset: Int
    public let systemID: UUID
    public let start: Double
    public let duration: Double
    public let segments: [TimingSegment]

    public var id: String { "\(occurrenceID.uuidString)/\(systemOffset)" }
    public var end: Double { start + duration }
}

public struct CompiledTimeline: Equatable, Sendable {
    public let spans: [TimelineSpan]
    public var duration: Double { spans.last?.end ?? 0 }

    public func span(at seconds: Double) -> TimelineSpan? {
        spans.first { seconds >= $0.start && seconds < $0.end }
    }
}

public enum TimelineCompiler {
    public static func compile(_ project: ScoreProject) throws -> CompiledTimeline {
        guard !project.readingOrder.isEmpty else {
            throw TimingError.emptyReadingOrder
        }
        let systems = Dictionary(uniqueKeysWithValues: project.systems.map { ($0.id, $0) })
        let sections = Dictionary(uniqueKeysWithValues: project.sections.map { ($0.id, $0) })
        var spans: [TimelineSpan] = []
        var position = 0.0

        for occurrence in project.readingOrder {
            guard let section = sections[occurrence.sectionID] else {
                throw TimingError.missingSection(occurrence.sectionID)
            }
            for (offset, systemID) in section.systemIDs.enumerated() {
                guard let system = systems[systemID] else {
                    throw TimingError.missingSystem(systemID)
                }
                guard let segments = system.timing, !segments.isEmpty else {
                    throw TimingError.unconfirmedTiming(systemID)
                }
                for segment in segments { try segment.validate() }
                let duration = segments.reduce(0) { $0 + $1.duration }
                spans.append(TimelineSpan(
                    occurrenceID: occurrence.id, systemOffset: offset,
                    systemID: systemID, start: position, duration: duration,
                    segments: segments
                ))
                position += duration
            }
        }
        guard !spans.isEmpty else { throw TimingError.emptyReadingOrder }
        return CompiledTimeline(spans: spans)
    }
}
