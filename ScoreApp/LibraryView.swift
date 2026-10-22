import ScoreCore
import SwiftUI
import UniformTypeIdentifiers

struct LibraryView: View {
    @StateObject private var library = ScoreLibrary()
    @State private var selection: UUID?
    @State private var importing = false

    var body: some View {
        NavigationSplitView {
            List(library.projects, selection: $selection) { project in
                Label {
                    VStack(alignment: .leading, spacing: 4) {
                        Text(project.title).font(.headline)
                        Text("\(project.systems.count) reading areas")
                            .font(.subheadline)
                            .foregroundStyle(.secondary)
                    }
                    .padding(.vertical, 6)
                } icon: {
                    Image(systemName: "music.note.list")
                }
                .tag(project.id)
            }
            .navigationTitle("ScorePrep")
            .toolbar {
                Button("Import PDF", systemImage: "plus") { importing = true }
                    .accessibilityIdentifier("import-pdf")
            }
        } detail: {
            if let project = library.projects.first(where: { $0.id == selection }),
               let sourceURL = library.sourceURL(for: project) {
                ScoreReader(project: project, sourceURL: sourceURL) { systemID, segment in
                    try library.updateTiming(
                        projectID: project.id, systemID: systemID, segment: segment
                    )
                }
                .id(project.id)
            } else {
                ContentUnavailableView(
                    "Choose a score",
                    systemImage: "music.note.list",
                    description: Text("Open a score from your library or import a PDF.")
                )
            }
        }
        .onChange(of: library.projects.map(\.id), initial: true) { _, ids in
            if selection == nil { selection = ids.first }
        }
        .fileImporter(
            isPresented: $importing, allowedContentTypes: [.pdf],
            allowsMultipleSelection: false
        ) { result in
            do {
                if let url = try result.get().first {
                    selection = try library.importPDF(from: url)
                }
            } catch {
                library.errorMessage = error.localizedDescription
            }
        }
        .alert(
            "Could not open the score",
            isPresented: Binding(
                get: { library.errorMessage != nil },
                set: { if !$0 { library.errorMessage = nil } }
            )
        ) {
            Button("OK") { library.errorMessage = nil }
        } message: {
            Text(library.errorMessage ?? "")
        }
    }
}
