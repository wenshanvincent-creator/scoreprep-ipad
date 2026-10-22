import PDFKit
import ScoreCore
import SwiftUI

struct ScoreReader: View {
    let project: ScoreProject
    let sourceURL: URL
    let onTimingSaved: (UUID, TimingSegment) throws -> Void
    @State private var document: PDFDocument?
    @State private var loadingError: String?
    @State private var editingSystem: SourceSystem?

    var body: some View {
        Group {
            if let document {
                ScrollView {
                    LazyVStack(alignment: .leading, spacing: 32) {
                        ForEach(Array(project.systems.enumerated()), id: \.element.id) {
                            index, system in
                            VStack(alignment: .leading, spacing: 10) {
                                HStack {
                                    Text(system.label)
                                        .font(.headline)
                                        .accessibilityIdentifier("system-label-\(index)")
                                    Spacer()
                                    if let timing = system.timing {
                                        Text(durationLabel(timing))
                                            .monospacedDigit()
                                            .foregroundStyle(.secondary)
                                            .accessibilityIdentifier("system-duration-\(index)")
                                    }
                                    Button("Timing", systemImage: "metronome") {
                                        editingSystem = system
                                    }
                                    .accessibilityIdentifier("edit-timing-\(index)")
                                }
                                if let page = document.page(at: system.pageIndex) {
                                    let pageBounds = page.bounds(for: .mediaBox)
                                    let aspect = pageBounds.width * system.bounds.width
                                        / (pageBounds.height * system.bounds.height)
                                    PDFSystemView(page: page, crop: system.bounds)
                                        .aspectRatio(aspect, contentMode: .fit)
                                        .background(.white)
                                        .accessibilityLabel("Source music, \(system.label)")
                                }
                            }
                        }
                    }
                    .padding(28)
                }
                .background(Color(red: 0.949, green: 0.957, blue: 0.965))
            } else if let loadingError {
                ContentUnavailableView(
                    "Could not read this PDF",
                    systemImage: "doc",
                    description: Text(loadingError)
                )
            } else {
                ProgressView("Opening score")
            }
        }
        .navigationTitle(project.title)
        .navigationBarTitleDisplayMode(.inline)
        .task(id: sourceURL) {
            if let loaded = PDFDocument(url: sourceURL), !loaded.isLocked {
                document = loaded
                loadingError = nil
            } else {
                loadingError = LibraryError.unreadablePDF.localizedDescription
            }
        }
        .sheet(item: $editingSystem) { system in
            TimingEditor(system: system) { segment in
                try onTimingSaved(system.id, segment)
            }
        }
    }

    private func durationLabel(_ segments: [TimingSegment]) -> String {
        let duration = segments.reduce(0) { $0 + $1.duration }
        return duration.formatted(.number.precision(.fractionLength(1))) + " s"
    }
}
