import Foundation

public enum RecognitionReviewState: String, Codable, Equatable, Sendable {
    case unreviewed
    case accepted
    case rejected
}

/// A remote job can be resumed without placing its access token in score JSON.
public struct PendingRecognition: Codable, Equatable, Sendable {
    public var jobID: String
    public var workerURL: URL
    public var originalSHA256: String

    public init(jobID: String, workerURL: URL, originalSHA256: String) {
        self.jobID = jobID
        self.workerURL = workerURL
        self.originalSHA256 = originalSHA256
    }
}

/// A saved MusicXML artifact, kept separate from its original source page.
public struct RecognizedSourcePage: Codable, Equatable, Identifiable, Sendable {
    public var sourcePageIndex: Int
    public var musicXMLFilename: String
    public var reviewState: RecognitionReviewState

    public var id: Int { sourcePageIndex }

    public init(
        sourcePageIndex: Int, musicXMLFilename: String,
        reviewState: RecognitionReviewState = .unreviewed
    ) {
        self.sourcePageIndex = sourcePageIndex
        self.musicXMLFilename = musicXMLFilename
        self.reviewState = reviewState
    }
}

public struct RecognizedEdition: Codable, Equatable, Identifiable, Sendable {
    public var id: UUID
    public var engine: String
    public var createdAt: Date
    public var pages: [RecognizedSourcePage]

    public init(
        id: UUID = UUID(), engine: String, createdAt: Date = Date(),
        pages: [RecognizedSourcePage]
    ) {
        self.id = id
        self.engine = engine
        self.createdAt = createdAt
        self.pages = pages
    }
}
