import Foundation

public struct NormalizedRect: Codable, Equatable, Sendable {
    public var x: Double
    public var y: Double
    public var width: Double
    public var height: Double

    public init(x: Double, y: Double, width: Double, height: Double) {
        self.x = x
        self.y = y
        self.width = width
        self.height = height
    }

    public static let fullPage = Self(x: 0, y: 0, width: 1, height: 1)
}

public struct SourceSystem: Codable, Equatable, Identifiable, Sendable {
    public var id: UUID
    public var pageIndex: Int
    public var bounds: NormalizedRect
    public var label: String
    public var timing: [TimingSegment]?

    public init(
        id: UUID = UUID(), pageIndex: Int, bounds: NormalizedRect,
        label: String, timing: [TimingSegment]? = nil
    ) {
        self.id = id
        self.pageIndex = pageIndex
        self.bounds = bounds
        self.label = label
        self.timing = timing
    }
}

public struct ScoreSection: Codable, Equatable, Identifiable, Sendable {
    public var id: UUID
    public var name: String
    public var systemIDs: [UUID]

    public init(id: UUID = UUID(), name: String, systemIDs: [UUID]) {
        self.id = id
        self.name = name
        self.systemIDs = systemIDs
    }
}

public struct SectionOccurrence: Codable, Equatable, Identifiable, Sendable {
    public var id: UUID
    public var sectionID: UUID

    public init(id: UUID = UUID(), sectionID: UUID) {
        self.id = id
        self.sectionID = sectionID
    }
}

public struct ScoreProject: Codable, Equatable, Identifiable, Sendable {
    public var id: UUID
    public var title: String
    public var sourceFilename: String
    public var systems: [SourceSystem]
    public var sections: [ScoreSection]
    public var readingOrder: [SectionOccurrence]

    public init(
        id: UUID = UUID(), title: String, sourceFilename: String,
        systems: [SourceSystem], sections: [ScoreSection],
        readingOrder: [SectionOccurrence]
    ) {
        self.id = id
        self.title = title
        self.sourceFilename = sourceFilename
        self.systems = systems
        self.sections = sections
        self.readingOrder = readingOrder
    }
}
