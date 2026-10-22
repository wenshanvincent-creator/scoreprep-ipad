import Foundation

public enum PreparationError: Error, Equatable, LocalizedError {
    case noReadingAreas, invalidBounds, invalidPage, duplicateIdentity
    case missingSystem, missingSection, emptyRoute

    public var errorDescription: String? {
        switch self {
        case .noReadingAreas: return "Keep at least one reading area in this score."
        case .invalidBounds: return "Keep the reading area inside the original page."
        case .invalidPage: return "A reading area refers to a page outside the original."
        case .duplicateIdentity: return "A reading area or reading occurrence is duplicated."
        case .missingSystem: return "The reading order refers to a removed reading area."
        case .missingSection: return "The reading order refers to a removed section."
        case .emptyRoute: return "Include at least one reading area in the practice order."
        }
    }
}

/// An editable preparation draft. It deliberately excludes original-file and
/// recognition metadata so saving a sheet cannot overwrite newer recognition work.
public struct ScorePreparation: Equatable, Sendable {
    public var systems: [SourceSystem]
    public var sections: [ScoreSection]
    public var readingOrder: [SectionOccurrence]

    public init(project: ScoreProject) {
        systems = project.systems
        sections = project.sections
        readingOrder = project.readingOrder
    }

    /// Apply against the latest project, with the original's verified page count.
    /// Timing is preserved from that latest project only for unchanged source areas.
    public func applying(to project: ScoreProject, sourcePageCount: Int) throws -> ScoreProject {
        guard !systems.isEmpty else { throw PreparationError.noReadingAreas }
        guard Set(systems.map(\.id)).count == systems.count,
              Set(sections.map(\.id)).count == sections.count,
              Set(readingOrder.map(\.id)).count == readingOrder.count else {
            throw PreparationError.duplicateIdentity
        }
        for system in systems {
            guard system.pageIndex >= 0, system.pageIndex < sourcePageCount else {
                throw PreparationError.invalidPage
            }
            let bounds = system.bounds
            guard [bounds.x, bounds.y, bounds.width, bounds.height].allSatisfy(\.isFinite),
                  bounds.x >= 0, bounds.y >= 0, bounds.width >= 0.05, bounds.height >= 0.05,
                  bounds.x + bounds.width <= 1.000001,
                  bounds.y + bounds.height <= 1.000001 else {
                throw PreparationError.invalidBounds
            }
        }
        let ids = Set(systems.map(\.id))
        guard sections.allSatisfy({ $0.systemIDs.allSatisfy(ids.contains) }) else {
            throw PreparationError.missingSystem
        }
        let sectionIDs = Set(sections.map(\.id))
        guard readingOrder.allSatisfy({ sectionIDs.contains($0.sectionID) }) else {
            throw PreparationError.missingSection
        }
        guard readingOrder.contains(where: { occurrence in
            sections.contains { $0.id == occurrence.sectionID && !$0.systemIDs.isEmpty }
        }) else { throw PreparationError.emptyRoute }

        var result = project
        result.systems = systems.map { draft in
            var area = draft
            let saved = project.systems.first { $0.id == draft.id }
            area.timing = saved.flatMap {
                $0.pageIndex == draft.pageIndex && $0.bounds == draft.bounds ? $0.timing : nil
            }
            return area
        }
        result.sections = sections
        result.readingOrder = readingOrder
        return result
    }
}
