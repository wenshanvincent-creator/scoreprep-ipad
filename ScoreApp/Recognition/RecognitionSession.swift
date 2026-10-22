import Combine
import Foundation
import ScoreCore

enum RecognitionIntegrationError: LocalizedError {
    case wrongOriginal, incompleteResult, missingPage, noConnection, differentWorker
    case recognitionLimit

    var errorDescription: String? {
        switch self {
        case .wrongOriginal:
            return "This recognition result does not match the saved original. The original has not been replaced."
        case .incompleteResult:
            return "Recognition has not produced notation for every source page."
        case .missingPage:
            return "This source page is no longer in the recognized edition."
        case .noConnection:
            return "Connect a private recognition worker before converting this score."
        case .differentWorker:
            return "Reconnect to the worker that owns this pending job, or start a new conversion."
        case .recognitionLimit:
            return "Recognition supports up to eight pages and 20 MiB. You can still read this original locally."
        }
    }
}

@MainActor
final class RecognitionSession: ObservableObject {
    @Published private(set) var configuration: RecognitionWorkerConfiguration?
    @Published private(set) var job: RecognitionJob?
    @Published private(set) var isWaiting = false
    @Published var errorMessage: String?
    private let library: ScoreLibrary
    private let projectID: UUID
    private let configurationStore = RecognitionWorkerConfigurationStore()
    private var task: Task<Void, Never>?
    private var waitingID: UUID?

    init(library: ScoreLibrary, projectID: UUID) {
        self.library = library
        self.projectID = projectID
        do { configuration = try configurationStore.load() }
        catch { errorMessage = error.localizedDescription }
    }

    func saveConnection(_ value: RecognitionWorkerConfiguration) throws {
        try configurationStore.save(value)
        configuration = value
    }

    func removeConnection() throws {
        try configurationStore.remove()
        configuration = nil
    }

    func recognize() {
        run { session in
            guard let configuration = session.configuration else {
                throw RecognitionIntegrationError.noConnection
            }
            guard let project = session.project,
                  let url = session.library.sourceURL(for: project) else {
                throw LibraryError.missingProject
            }
            let data = try Data(contentsOf: url)
            guard data.count <= 20 * 1024 * 1024,
                  try OriginalDocument.open(url).pageCount <= 8 else {
                throw RecognitionIntegrationError.recognitionLimit
            }
            let mediaType: String
            switch url.pathExtension.lowercased() {
            case "pdf": mediaType = "application/pdf"
            case "png": mediaType = "image/png"
            default: mediaType = "image/jpeg"
            }
            let client = RecognitionClient(
                baseURL: configuration.baseURL, bearerToken: configuration.bearerToken
            )
            let submitted = try await client.submit(document: data, mediaType: mediaType)
            try Task.checkCancellation()
            try session.library.recordRecognition(
                projectID: session.projectID, job: submitted,
                workerURL: configuration.baseURL, originalSHA256: ScoreLibrary.sourceHash(data)
            )
            session.job = submitted
            return (client, submitted.id)
        }
    }

    func resume() {
        run { session in
            guard let configuration = session.configuration else {
                throw RecognitionIntegrationError.noConnection
            }
            guard let pending = session.project?.pendingRecognition else {
                throw RecognitionIntegrationError.incompleteResult
            }
            guard configuration.baseURL == pending.workerURL else {
                throw RecognitionIntegrationError.differentWorker
            }
            return (RecognitionClient(
                baseURL: configuration.baseURL, bearerToken: configuration.bearerToken
            ), pending.jobID)
        }
    }

    func stopWaiting() {
        waitingID = nil
        task?.cancel()
        task = nil
        isWaiting = false
    }

    private var project: ScoreCore.ScoreProject? {
        library.projects.first(where: { $0.id == projectID })
    }

    private func run(
        prepare: @escaping @MainActor (RecognitionSession) async throws -> (RecognitionClient, String)
    ) {
        guard !isWaiting else { return }
        errorMessage = nil
        let id = UUID()
        waitingID = id
        isWaiting = true
        task = Task { [weak self] in
            guard let self else { return }
            defer {
                if waitingID == id {
                    isWaiting = false
                    task = nil
                }
            }
            do {
                let (client, jobID) = try await prepare(self)
                try Task.checkCancellation()
                let result = try await client.waitForResult(id: jobID) { [weak self] update in
                    await self?.receive(update, waitingID: id)
                }
                try Task.checkCancellation()
                guard waitingID == id else { return }
                try library.saveRecognition(projectID: projectID, job: result)
                job = result
            } catch is CancellationError {
                // Stop waiting retains the saved job reference for an explicit resume.
            } catch {
                guard waitingID == id else { return }
                if case RecognitionClientError.failed(let failed) = error { job = failed }
                errorMessage = error.localizedDescription
            }
        }
    }

    private func receive(_ update: RecognitionJob, waitingID id: UUID) {
        guard waitingID == id else { return }
        job = update
    }
}
