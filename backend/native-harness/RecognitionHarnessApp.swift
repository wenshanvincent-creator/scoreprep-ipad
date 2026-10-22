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

    var body: some View {
        NavigationStack {
            Group {
                if pages.isEmpty {
                    ContentUnavailableView("Recognition evidence", systemImage: "music.note", description: Text(message))
                } else {
                    RecognizedScoreView(pages: pages)
                        .frame(maxWidth: ProcessInfo.processInfo.arguments.contains("--narrow") ? 480 : .infinity)
                }
            }
            .navigationTitle(ProcessInfo.processInfo.arguments.contains("--fixture") ? "Fixture engraving" : "OMR notation review")
            .navigationBarTitleDisplayMode(.inline)
        }
        .task {
            do {
                if ProcessInfo.processInfo.arguments.contains("--fixture") {
                    guard let url = Bundle.main.url(forResource: "recognition-study", withExtension: "musicxml") else {
                        throw CocoaError(.fileNoSuchFile)
                    }
                    pages = [RecognitionPage(sourcePageIndex: 0, state: .succeeded,
                                             musicXML: try String(contentsOf: url), reviewRequired: true)]
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
