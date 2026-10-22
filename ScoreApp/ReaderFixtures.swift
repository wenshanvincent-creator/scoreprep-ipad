#if DEBUG
import PDFKit
import ScoreCore
import SwiftUI
import UIKit

/// Only generated, redistributable content. UI tests enter the real import path
/// without depending on the external Files provider's simulator state.
enum ReaderFixtures {
    @MainActor
    static func importRequestedFixture(into library: ScoreLibrary, selection: Binding<UUID?>) async {
        let arguments = ProcessInfo.processInfo.arguments
        guard let flag = arguments.firstIndex(of: "--reader-fixture"),
              arguments.indices.contains(flag + 1) else { return }
        do {
            let format = arguments[flag + 1]
            let url = FileManager.default.temporaryDirectory
                .appendingPathComponent("Reader exercise.\(format == "rotated" ? "pdf" : format)")
            let document = PDFDocument(data: SampleScore.pdfData())!
            let data: Data
            switch format {
            case "pdf":
                document.insert(document.page(at: 0)!.copy() as! PDFPage, at: 1)
                data = document.dataRepresentation()!
            case "rotated":
                let page = document.page(at: 0)!
                page.rotation = 90
                data = document.dataRepresentation()!
            case "png", "jpg":
                let image = document.page(at: 0)!.thumbnail(
                    of: CGSize(width: 595, height: 842), for: .mediaBox)
                data = format == "png" ? image.pngData()! : image.jpegData(compressionQuality: 0.9)!
            default:
                data = Data("This is not a score".utf8)
            }
            try data.write(to: url, options: .atomic)
            let id = try await library.importOriginal(from: url)
            let project = library.projects.first { $0.id == id }!
            let stored = try Data(contentsOf: library.sourceURL(for: project)!)
            guard stored == data else { throw CocoaError(.fileReadCorruptFile) }
            // Removing the external input proves reopen uses the app-owned copy.
            try FileManager.default.removeItem(at: url)
            selection.wrappedValue = id
        } catch { library.errorMessage = error.localizedDescription }
    }
}
#endif
