import Combine
import CryptoKit
import Foundation
import PDFKit
import ScoreCore

enum LibraryError: LocalizedError {
    case unreadablePDF
    case tooManyPages
    case unavailableStorage
    case missingProject
    case missingSystem
    case unreadableImage
    case imageTooLarge
    case emptyTitle
    case invalidCrop

    var errorDescription: String? {
        switch self {
        case .unreadablePDF: return "Choose a readable PDF that does not require a password."
        case .tooManyPages: return "Import a score with 20 pages or fewer."
        case .unavailableStorage: return "The score library could not be opened."
        case .missingProject: return "This score is no longer in the library."
        case .missingSystem: return "This musical line is no longer in the score."
        case .unreadableImage: return "Choose a readable JPEG or PNG image."
        case .imageTooLarge: return "Choose an image with 40 megapixels or fewer."
        case .emptyTitle: return "Enter a title for this score."
        case .invalidCrop: return "Keep the reading area inside the original page."
        }
    }
}

struct ProjectStore {
    let directory: URL

    init(directory: URL) throws {
        self.directory = directory
        try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
    }

    init() throws {
        let base = try FileManager.default.url(
            for: .applicationSupportDirectory, in: .userDomainMask,
            appropriateFor: nil, create: true
        )
        var name = ProcessInfo.processInfo.arguments.contains("--smoke-test")
            ? "ScorePrep-Smoke" : "ScorePrep"
        #if DEBUG
        let arguments = ProcessInfo.processInfo.arguments
        if let flag = arguments.firstIndex(of: "--reader-test-id"),
           arguments.indices.contains(flag + 1) {
            let id = arguments[flag + 1]
            guard !id.isEmpty, id.allSatisfy({ $0.isASCII && ($0.isLetter || $0.isNumber || $0 == "-") })
            else { throw LibraryError.unavailableStorage }
            name = "ScorePrep-ReaderTests-\(id)"
            let testDirectory = base.appendingPathComponent(name, isDirectory: true)
            if arguments.contains("--reader-reset"),
               FileManager.default.fileExists(atPath: testDirectory.path) {
                try FileManager.default.removeItem(at: testDirectory)
            }
        }
        #endif
        directory = base.appendingPathComponent(name, isDirectory: true)
        try FileManager.default.createDirectory(
            at: directory, withIntermediateDirectories: true
        )
    }

    func load() throws -> [ScoreProject] {
        let url = directory.appendingPathComponent("library.json")
        guard FileManager.default.fileExists(atPath: url.path) else { return [] }
        return try JSONDecoder().decode([ScoreProject].self, from: Data(contentsOf: url))
    }

    func save(_ projects: [ScoreProject]) throws {
        let data = try JSONEncoder().encode(projects)
        try data.write(
            to: directory.appendingPathComponent("library.json"), options: .atomic
        )
    }

    func sourceURL(for project: ScoreProject) -> URL {
        directory.appendingPathComponent(project.sourceFilename)
    }
}

@MainActor
final class ScoreLibrary: ObservableObject {
    @Published private(set) var projects: [ScoreProject] = []
    @Published var errorMessage: String?
    private var store: ProjectStore?

    init(store providedStore: ProjectStore? = nil) {
        do {
            let openedStore = try providedStore ?? ProjectStore()
            store = openedStore
            projects = try openedStore.load()
            if !FileManager.default.fileExists(
                atPath: openedStore.directory.appendingPathComponent("library.json").path
            ) {
                let sample = SampleScore.project()
                try SampleScore.pdfData().write(
                    to: openedStore.sourceURL(for: sample), options: .atomic
                )
                try openedStore.save([sample])
                projects = [sample]
            }
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    func sourceURL(for project: ScoreProject) -> URL? {
        store?.sourceURL(for: project)
    }

    @discardableResult
    func importPDF(from url: URL) async throws -> UUID {
        try await importOriginal(from: url)
    }

    @discardableResult
    func importOriginal(from url: URL) async throws -> UUID {
        guard let store else { throw LibraryError.unavailableStorage }
        let project = try await Task.detached(priority: .userInitiated) {
            try Self.prepareOriginal(url, store: store)
        }.value
        var updated = projects
        updated.append(project)
        do {
            try store.save(updated)
        } catch {
            // The copy is unreferenced if metadata could not be committed.
            try FileManager.default.removeItem(at: store.sourceURL(for: project))
            throw error
        }
        projects = updated
        return project.id
    }

    private nonisolated static func prepareOriginal(_ url: URL, store: ProjectStore) throws -> ScoreProject {
        let scoped = url.startAccessingSecurityScopedResource()
        defer { if scoped { url.stopAccessingSecurityScopedResource() } }
        let document = try OriginalDocument.open(url)

        let systems = (0..<document.pageCount).map {
            SourceSystem(
                pageIndex: $0, bounds: .fullPage,
                label: "Page \($0 + 1)"
            )
        }
        let section = ScoreSection(name: "Score", systemIDs: systems.map(\.id))
        let project = ScoreProject(
            title: url.deletingPathExtension().lastPathComponent,
            sourceFilename: "\(UUID().uuidString).\(url.pathExtension.lowercased())",
            systems: systems, sections: [section],
            readingOrder: [SectionOccurrence(sectionID: section.id)]
        )
        try FileManager.default.copyItem(at: url, to: store.sourceURL(for: project))
        return project
    }

    func rename(projectID: UUID, title: String) throws {
        let title = title.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !title.isEmpty else { throw LibraryError.emptyTitle }
        try update(projectID: projectID) { $0.title = title }
    }

    func delete(projectID: UUID) throws {
        guard let store else { throw LibraryError.unavailableStorage }
        guard let project = projects.first(where: { $0.id == projectID }) else {
            throw LibraryError.missingProject
        }
        let updated = projects.filter { $0.id != projectID }
        // Persist removal first so a failed metadata write cannot lose an original.
        try store.save(updated)
        projects = updated
        let editions = store.directory.appendingPathComponent("recognized-\(project.id)", isDirectory: true)
        if FileManager.default.fileExists(atPath: editions.path) {
            try FileManager.default.removeItem(at: editions)
        }
        let source = store.sourceURL(for: project)
        if FileManager.default.fileExists(atPath: source.path) {
            try FileManager.default.removeItem(at: source)
        }
    }

    func recordRecognition(
        projectID: UUID, job: RecognitionJob, workerURL: URL, originalSHA256: String
    ) throws {
        guard job.originalSHA256 == originalSHA256 else {
            throw RecognitionIntegrationError.wrongOriginal
        }
        try update(projectID: projectID) {
            $0.pendingRecognition = PendingRecognition(
                jobID: job.id, workerURL: workerURL, originalSHA256: originalSHA256
            )
        }
    }

    func saveRecognition(projectID: UUID, job: RecognitionJob) throws {
        guard let store else { throw LibraryError.unavailableStorage }
        guard let index = projects.firstIndex(where: { $0.id == projectID }) else {
            throw LibraryError.missingProject
        }
        guard let pending = projects[index].pendingRecognition,
              pending.jobID == job.id, pending.originalSHA256 == job.originalSHA256 else {
            throw RecognitionIntegrationError.wrongOriginal
        }
        guard job.state == .succeeded, !job.pages.isEmpty,
              job.pages.map(\.sourcePageIndex) == Array(0..<job.pages.count),
              job.pages.allSatisfy({ $0.state == .succeeded && !($0.musicXML ?? "").isEmpty }) else {
            throw RecognitionIntegrationError.incompleteResult
        }
        let source = try Data(contentsOf: store.sourceURL(for: projects[index]))
        guard Self.sourceHash(source) == pending.originalSHA256 else {
            throw RecognitionIntegrationError.wrongOriginal
        }
        let editionID = UUID()
        let relativeDirectory = "recognized-\(projectID)/\(editionID)"
        let directory = store.directory.appendingPathComponent(relativeDirectory, isDirectory: true)
        try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
        do {
            let pages = try job.pages.map { page in
                let name = "page-\(page.sourcePageIndex).musicxml"
                // The successful-result guard above establishes a nonempty XML payload.
                try Data(page.musicXML!.utf8).write(
                    to: directory.appendingPathComponent(name), options: .atomic
                )
                return RecognizedSourcePage(
                    sourcePageIndex: page.sourcePageIndex,
                    musicXMLFilename: "\(relativeDirectory)/\(name)"
                )
            }
            var updated = projects
            updated[index].recognizedEdition = RecognizedEdition(
                id: editionID, engine: "oemer@\(job.engineRevision)", pages: pages
            )
            updated[index].pendingRecognition = nil
            try store.save(updated)
            projects = updated
        } catch let saveError {
            do {
                try FileManager.default.removeItem(at: directory)
            } catch let cleanupError {
                throw NSError(domain: "ScorePrep.Recognition", code: 1, userInfo: [
                    NSLocalizedDescriptionKey: "\(saveError.localizedDescription) Unfinished notation files could not be removed: \(cleanupError.localizedDescription)"
                ])
            }
            throw saveError
        }
    }

    func recognitionPages(projectID: UUID) throws -> [RecognitionPage] {
        guard let store else { throw LibraryError.unavailableStorage }
        guard let project = projects.first(where: { $0.id == projectID }) else {
            throw LibraryError.missingProject
        }
        guard let edition = project.recognizedEdition else { return [] }
        return try edition.pages.map { page in
            RecognitionPage(
                sourcePageIndex: page.sourcePageIndex, state: .succeeded,
                musicXML: try String(
                    contentsOf: store.directory.appendingPathComponent(page.musicXMLFilename),
                    encoding: .utf8
                ),
                reviewRequired: page.reviewState != .accepted
            )
        }
    }

    func setRecognitionReview(
        projectID: UUID, sourcePageIndex: Int, state: RecognitionReviewState
    ) throws {
        try update(projectID: projectID) { project in
            guard let index = project.recognizedEdition?.pages.firstIndex(
                where: { $0.sourcePageIndex == sourcePageIndex }
            ) else { throw RecognitionIntegrationError.missingPage }
            project.recognizedEdition?.pages[index].reviewState = state
        }
    }

    nonisolated static func sourceHash(_ data: Data) -> String {
        SHA256.hash(data: data).map { String(format: "%02x", $0) }.joined()
    }

    func updateCrop(projectID: UUID, systemID: UUID, bounds: NormalizedRect) throws {
        guard [bounds.x, bounds.y, bounds.width, bounds.height].allSatisfy(\.isFinite),
              bounds.x >= 0, bounds.y >= 0, bounds.width >= 0.05, bounds.height >= 0.05,
              bounds.x + bounds.width <= 1.000001,
              bounds.y + bounds.height <= 1.000001 else { throw LibraryError.invalidCrop }
        try update(projectID: projectID) { project in
            guard let index = project.systems.firstIndex(where: { $0.id == systemID }) else {
                throw LibraryError.missingSystem
            }
            if project.systems[index].bounds != bounds {
                project.systems[index].bounds = bounds
                project.systems[index].timing = nil
            }
        }
    }

    private func update(projectID: UUID, edit: (inout ScoreProject) throws -> Void) throws {
        guard let store else { throw LibraryError.unavailableStorage }
        guard let index = projects.firstIndex(where: { $0.id == projectID }) else {
            throw LibraryError.missingProject
        }
        var updated = projects
        try edit(&updated[index])
        try store.save(updated)
        projects = updated
    }

    func updateTiming(
        projectID: UUID, systemID: UUID, segment: TimingSegment
    ) throws {
        try segment.validate()
        guard let store else { throw LibraryError.unavailableStorage }
        guard let projectIndex = projects.firstIndex(where: { $0.id == projectID }) else {
            throw LibraryError.missingProject
        }
        guard let systemIndex = projects[projectIndex].systems.firstIndex(
            where: { $0.id == systemID }
        ) else { throw LibraryError.missingSystem }
        var updated = projects
        updated[projectIndex].systems[systemIndex].timing = [segment]
        try store.save(updated)
        projects = updated
    }
}
