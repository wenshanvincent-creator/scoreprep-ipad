import ScoreCore
import SwiftUI
import UniformTypeIdentifiers

struct LibraryView: View {
    var onReviewRequested: ((UUID, Int) -> Void)? = nil
    @StateObject private var library = ScoreLibrary()
    @SceneStorage("reader.selectedProject") private var selectedProject = ""
    @State private var importing = false
    @State private var isImporting = false
    @State private var renaming: ScoreProject?
    @State private var deleting: ScoreProject?
    @State private var title = ""
    @State private var compactColumn: NavigationSplitViewColumn = .detail
    @State private var reviewRequest: SourceReviewRequest?

    private var selection: Binding<UUID?> {
        Binding(get: { UUID(uuidString: selectedProject) }, set: {
            selectedProject = $0?.uuidString ?? ""
        })
    }

    var body: some View {
        NavigationSplitView(preferredCompactColumn: $compactColumn) {
            List(library.projects, selection: selection) { project in
                NavigationLink(value: project.id) {
                    Label {
                        VStack(alignment: .leading, spacing: 4) {
                            Text(project.title).font(.headline)
                            Text("\(project.systems.count) reading areas · Original")
                                .font(.subheadline).foregroundStyle(.secondary)
                        }.padding(.vertical, 6)
                    } icon: { Image(systemName: "music.note.list") }
                }
                .contextMenu {
                    Button("Rename", systemImage: "pencil") { beginRename(project) }
                    Button("Delete", systemImage: "trash", role: .destructive) { deleting = project }
                }
            }
            .overlay {
                if library.projects.isEmpty {
                    ContentUnavailableView("Your scores", systemImage: "music.note.list",
                        description: Text("Import a PDF, JPEG or PNG to start reading."))
                }
            }
            .navigationTitle("ScorePrep")
            .navigationSplitViewColumnWidth(min: 240, ideal: 280, max: 340)
            .toolbar {
                Button("Import score", systemImage: "plus") { importing = true }
                    .disabled(isImporting).accessibilityIdentifier("import-pdf")
            }
        } detail: {
            if let project = library.projects.first(where: { $0.id == selection.wrappedValue }),
               let sourceURL = library.sourceURL(for: project) {
                ScoreReader(project: project, sourceURL: sourceURL,
                    onTimingSaved: { systemID, segment in
                        try library.updateTiming(projectID: project.id, systemID: systemID, segment: segment)
                    }, onCropSaved: { systemID, bounds in
                        try library.updateCrop(projectID: project.id, systemID: systemID, bounds: bounds)
                    }, onRename: { beginRename(project) }, onDelete: { deleting = project },
                    onReviewRequested: { projectID, pageIndex in
                        if let onReviewRequested { onReviewRequested(projectID, pageIndex) }
                        else {
                            reviewRequest = SourceReviewRequest(
                                projectID: projectID, sourcePageIndex: pageIndex
                            )
                        }
                    })
                    .id(project.id)
            } else {
                ContentUnavailableView {
                    Label("Choose a score", systemImage: "music.note.list")
                } description: {
                    Text("Open your library or import a PDF, JPEG or PNG.")
                } actions: {
                    Button("Import score") { importing = true }.buttonStyle(.borderedProminent)
                }
            }
        }
        .onChange(of: library.projects.map(\.id), initial: true) { _, ids in
            if selection.wrappedValue.map({ ids.contains($0) }) != true {
                selection.wrappedValue = ids.first
            }
        }
        .fullScreenCover(item: $reviewRequest) { request in
            RecognitionReviewView(
                library: library, projectID: request.projectID,
                sourcePageIndex: request.sourcePageIndex
            )
        }
        .overlay {
            if isImporting {
                ProgressView("Importing original…").padding(24)
                    .background(.regularMaterial, in: RoundedRectangle(cornerRadius: 12))
            }
        }
        .fileImporter(isPresented: $importing,
            allowedContentTypes: [.pdf, .jpeg, .png], allowsMultipleSelection: false) { result in
            Task {
                do {
                    if let url = try result.get().first {
                        isImporting = true
                        defer { isImporting = false }
                        selection.wrappedValue = try await library.importOriginal(from: url)
                        compactColumn = .detail
                    }
                } catch { library.errorMessage = error.localizedDescription }
            }
        }
        .alert("Rename score", isPresented: Binding(
            get: { renaming != nil }, set: { if !$0 { renaming = nil } }
        )) {
            TextField("Title", text: $title)
            Button("Cancel", role: .cancel) {}
            Button("Save") {
                if let project = renaming {
                    perform { try library.rename(projectID: project.id, title: title) }
                }
            }
        }
        .confirmationDialog("Delete this score and its local original?",
            isPresented: Binding(get: { deleting != nil }, set: { if !$0 { deleting = nil } }),
            titleVisibility: .visible) {
            Button("Delete score", role: .destructive) {
                if let project = deleting { perform { try library.delete(projectID: project.id) } }
            }
        }
        .alert("Could not update the library", isPresented: Binding(
            get: { library.errorMessage != nil }, set: { if !$0 { library.errorMessage = nil } }
        )) {
            Button("OK") { library.errorMessage = nil }
        } message: { Text(library.errorMessage ?? "") }
        #if DEBUG
        .task {
            await ReaderFixtures.importRequestedFixture(into: library, selection: selection)
            await RecognitionReplayFixture.installIfRequested(into: library, selection: selection)
        }
        #endif
    }

    private func beginRename(_ project: ScoreProject) {
        title = project.title
        renaming = project
    }

    private func perform(_ action: () throws -> Void) {
        do { try action() } catch { library.errorMessage = error.localizedDescription }
    }
}
