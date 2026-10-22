import SwiftUI

@main
struct RecognitionHarnessApp: App {
    var body: some Scene {
        WindowGroup {
            HarnessContent()
                .preferredColorScheme(.light)
        }
    }
}

private struct HarnessContent: View {
    @State private var pages: [RecognitionPage] = []
    @State private var message = "Loading recognition evidence"
    @State private var visibleSource: Int?

    var body: some View {
        NavigationStack {
            Group {
                if pages.isEmpty {
                    ContentUnavailableView("Recognition evidence", systemImage: "music.note", description: Text(message))
                } else {
                    RecognizedScoreView(pages: pages,
                                        initialSourcePageIndex: ProcessInfo.processInfo.arguments.contains("--source-link") ? 7 : 0,
                                        onSourcePageChanged: { visibleSource = $0 })
                        .frame(maxWidth: ProcessInfo.processInfo.arguments.contains("--narrow") ? 480 : .infinity)
                }
            }
            .navigationTitle(ProcessInfo.processInfo.arguments.contains("--fixture") ? "Fixture engraving" : "OMR notation review")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                if ProcessInfo.processInfo.arguments.contains("--source-link"), let visibleSource {
                    Text("Linked source \(visibleSource + 1)")
                        .accessibilityIdentifier("linkedSource")
                }
            }
        }
        .task {
            do {
                if ProcessInfo.processInfo.arguments.contains("--fixture") {
                    guard let url = Bundle.main.url(forResource: "recognition-study", withExtension: "musicxml") else {
                        throw CocoaError(.fileNoSuchFile)
                    }
                    let xml = try String(contentsOf: url)
                    let indexes = ProcessInfo.processInfo.arguments.contains("--source-link") ? [2, 7] : [0]
                    // Explicit synthetic UI fixture: verifies source linkage, not multi-page OMR.
                    pages = indexes.map { RecognitionPage(sourcePageIndex: $0, state: .succeeded,
                                                           musicXML: xml, reviewRequired: true) }
                } else {
                    guard let url = Bundle.main.url(forResource: "job", withExtension: "json") else {
                        throw CocoaError(.fileNoSuchFile)
                    }
                    let job = try JSONDecoder().decode(RecognitionJob.self, from: Data(contentsOf: url))
                    guard job.state == .succeeded else { throw RecognitionClientError.failed(job) }
                    pages = job.pages
                }
            } catch { message = error.localizedDescription }
        }
    }
}
