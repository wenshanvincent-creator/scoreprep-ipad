#if DEBUG
import Foundation
import SwiftUI

enum RecognitionReplayFixture {
    @MainActor
    static func installIfRequested(into library: ScoreLibrary, selection: Binding<UUID?>) async {
        guard ProcessInfo.processInfo.arguments.contains("--recognition-replay") else { return }
        do {
            if let existing = library.projects.first(where: { $0.title == "Recorded OMR trial" }) {
                selection.wrappedValue = existing.id
                return
            }
            guard let original = Bundle.main.url(
                forResource: "original", withExtension: "png", subdirectory: "RecognitionReplay"
            ), let result = Bundle.main.url(
                forResource: "job", withExtension: "json", subdirectory: "RecognitionReplay"
            ) else {
                throw NSError(domain: "ScorePrep.Fixture", code: 1, userInfo: [
                    NSLocalizedDescriptionKey: "The recorded OMR fixture is missing from this test build."
                ])
            }
            let job = try JSONDecoder().decode(RecognitionJob.self, from: Data(contentsOf: result))
            let projectID = try await library.importOriginal(from: original)
            try library.rename(projectID: projectID, title: "Recorded OMR trial")
            try library.recordRecognition(
                projectID: projectID, job: job, workerURL: URL(string: "https://fixture.scoreprep.invalid")!,
                originalSHA256: ScoreLibrary.sourceHash(Data(contentsOf: original))
            )
            try library.saveRecognition(projectID: projectID, job: job)
            selection.wrappedValue = projectID
        } catch {
            library.errorMessage = error.localizedDescription
        }
    }
}
#endif
