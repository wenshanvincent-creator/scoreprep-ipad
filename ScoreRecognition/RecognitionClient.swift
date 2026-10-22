import Foundation

public enum RecognitionState: String, Codable, Sendable {
    case queued, running, succeeded, failed, skipped
}

public struct RecognitionPage: Codable, Equatable, Sendable, Identifiable {
    public var id: Int { sourcePageIndex }
    public let sourcePageIndex: Int // Zero-based position in the original document.
    public let state: RecognitionState
    public let musicXML: String?
    public let reviewRequired: Bool?
    public let musicXMLSHA256: String?
    public let error: String?

    public init(sourcePageIndex: Int, state: RecognitionState, musicXML: String? = nil,
                reviewRequired: Bool? = nil, musicXMLSHA256: String? = nil, error: String? = nil) {
        self.sourcePageIndex = sourcePageIndex
        self.state = state
        self.musicXML = musicXML
        self.reviewRequired = reviewRequired
        self.musicXMLSHA256 = musicXMLSHA256
        self.error = error
    }
}

public struct RecognitionJob: Codable, Equatable, Sendable, Identifiable {
    public let schemaVersion: Int
    public let id: String
    public let state: RecognitionState
    public let completedPages: Int
    public let engineRevision: String
    public let originalSHA256: String
    public let pages: [RecognitionPage]
    public let error: String?
}

public enum RecognitionClientError: LocalizedError {
    case invalidResponse, invalidJob(String), server(Int, String), failed(RecognitionJob)

    public var errorDescription: String? {
        switch self {
        case .invalidResponse: return "The recognition worker returned an invalid response."
        case .invalidJob(let reason): return "Invalid recognition result: \(reason)"
        case .server(let code, let detail): return "Recognition worker (\(code)): \(detail)"
        case .failed(let job): return job.error ?? "Recognition failed. Open the original score to review it."
        }
    }
}

/// Inject a private HTTPS endpoint and credential obtained by the app's account/settings layer.
/// Keep the credential in Keychain, never inside a score project or public app resource.
public struct RecognitionClient: Sendable {
    public let baseURL: URL
    private let bearerToken: String
    private let session: URLSession

    public init(baseURL: URL, bearerToken: String, session: URLSession = .shared) {
        self.baseURL = baseURL
        self.bearerToken = bearerToken
        self.session = session
    }

    public func submit(document: Data, mediaType: String) async throws -> RecognitionJob {
        struct Submission: Encodable { let mediaType: String; let contentBase64: String }
        var request = makeRequest(path: "v1/jobs")
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try JSONEncoder().encode(Submission(mediaType: mediaType,
                                                              contentBase64: document.base64EncodedString()))
        return try await send(request)
    }

    public func job(id: String) async throws -> RecognitionJob {
        guard UUID(uuidString: id) != nil else { throw RecognitionClientError.invalidJob("invalid job ID") }
        return try await send(makeRequest(path: "v1/jobs/\(id)"))
    }

    /// Cancellation stops polling. It does not pretend to cancel a remote inference already running.
    /// A transient network error is thrown; the caller can resume using the saved job ID.
    public func waitForResult(id: String, timeout: Duration = .seconds(1800),
                              progress: @Sendable (RecognitionJob) async -> Void) async throws -> RecognitionJob {
        let clock = ContinuousClock()
        let deadline = clock.now.advanced(by: timeout)
        while clock.now < deadline {
            try Task.checkCancellation()
            let value = try await job(id: id)
            await progress(value)
            switch value.state {
            case .succeeded: return value
            case .failed, .skipped: throw RecognitionClientError.failed(value)
            case .queued, .running: try await Task.sleep(for: .seconds(2))
            }
        }
        throw URLError(.timedOut)
    }

    private func makeRequest(path: String) -> URLRequest {
        var request = URLRequest(url: baseURL.appending(path: path))
        request.timeoutInterval = 120
        request.setValue("Bearer \(bearerToken)", forHTTPHeaderField: "Authorization")
        return request
    }

    private func send(_ request: URLRequest) async throws -> RecognitionJob {
        let (data, response) = try await session.data(for: request)
        guard let http = response as? HTTPURLResponse else { throw RecognitionClientError.invalidResponse }
        guard (200..<300).contains(http.statusCode) else {
            throw RecognitionClientError.server(http.statusCode, String(decoding: data, as: UTF8.self))
        }
        let value = try JSONDecoder().decode(RecognitionJob.self, from: data)
        guard value.schemaVersion == 1, !value.pages.isEmpty,
              value.pages.map(\.sourcePageIndex) == Array(0..<value.pages.count),
              value.completedPages == value.pages.filter({ $0.state == .succeeded }).count else {
            throw RecognitionClientError.invalidJob("page order or progress does not match schema v1")
        }
        if value.state == .succeeded {
            guard value.pages.allSatisfy({ $0.state == .succeeded && !($0.musicXML ?? "").isEmpty }) else {
                throw RecognitionClientError.invalidJob("successful job is missing a page's MusicXML")
            }
        }
        return value
    }
}
