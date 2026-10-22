import Combine
import Foundation
import PDFKit
import ScoreCore

enum LibraryError: LocalizedError {
    case unreadablePDF
    case tooManyPages
    case unavailableStorage
    case missingProject
    case missingSystem

    var errorDescription: String? {
        switch self {
        case .unreadablePDF: return "Choose a readable PDF that does not require a password."
        case .tooManyPages: return "Import a score with 20 pages or fewer."
        case .unavailableStorage: return "The score library could not be opened."
        case .missingProject: return "This score is no longer in the library."
        case .missingSystem: return "This musical line is no longer in the score."
        }
    }
}

struct ProjectStore {
    let directory: URL

    init() throws {
        let base = try FileManager.default.url(
            for: .applicationSupportDirectory, in: .userDomainMask,
            appropriateFor: nil, create: true
        )
        let name = ProcessInfo.processInfo.arguments.contains("--smoke-test")
            ? "ScorePrep-Smoke" : "ScorePrep"
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

    init() {
        do {
            let openedStore = try ProjectStore()
            store = openedStore
            projects = try openedStore.load()
            if projects.isEmpty {
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
    func importPDF(from url: URL) throws -> UUID {
        guard let store else { throw LibraryError.unavailableStorage }
        let scoped = url.startAccessingSecurityScopedResource()
        defer { if scoped { url.stopAccessingSecurityScopedResource() } }
        guard let document = PDFDocument(url: url), !document.isLocked,
              document.pageCount > 0 else {
            throw LibraryError.unreadablePDF
        }
        guard document.pageCount <= 20 else { throw LibraryError.tooManyPages }

        let systems = (0..<document.pageCount).map {
            SourceSystem(
                pageIndex: $0, bounds: .fullPage,
                label: "Page \($0 + 1)"
            )
        }
        let section = ScoreSection(name: "Score", systemIDs: systems.map(\.id))
        let project = ScoreProject(
            title: url.deletingPathExtension().lastPathComponent,
            sourceFilename: "\(UUID().uuidString).pdf",
            systems: systems, sections: [section],
            readingOrder: [SectionOccurrence(sectionID: section.id)]
        )
        try FileManager.default.copyItem(at: url, to: store.sourceURL(for: project))
        var updated = projects
        updated.append(project)
        try store.save(updated)
        projects = updated
        return project.id
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
