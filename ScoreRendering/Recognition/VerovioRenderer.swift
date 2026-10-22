import Foundation
import VerovioToolkit

public struct RenderedNotationPage: Identifiable, Sendable {
    public var id: String { "\(sourcePageIndex):\(renderedPageIndex)" }
    public let sourcePageIndex: Int
    public let renderedPageIndex: Int
    public let svg: String
    public let reviewRequired: Bool
}

public enum NotationRenderError: LocalizedError {
    case invalidInput(String), engraving(String)
    public var errorDescription: String? {
        switch self {
        case .invalidInput(let detail), .engraving(let detail): return detail
        }
    }
}

/// Serializes the native toolkit off the UI thread. This is engraving, not ML inference.
public actor VerovioRenderer {
    // The direct MusicXML importer caches a layer across adjacent voice changes.
    // Verovio's built-in Humdrum route preserves homr's interleaved piano voices.
    static let musicXMLInputFormat = "musicxml-hum"
    public init() {}

    public func render(pages: [RecognitionPage], width: Double, height: Double,
                       scale: Int) throws -> [RenderedNotationPage] {
        guard !pages.isEmpty, pages.map(\.sourcePageIndex) == pages.map(\.sourcePageIndex).sorted(),
              Set(pages.map(\.sourcePageIndex)).count == pages.count,
              pages.allSatisfy({ $0.sourcePageIndex >= 0 }),
              width > 100, height > 100, (30...80).contains(scale) else {
            throw NotationRenderError.invalidInput("The recognized edition has invalid pages or reading dimensions.")
        }
        guard let resources = VerovioResources.bundle.url(forResource: "data", withExtension: nil) else {
            throw NotationRenderError.engraving("Verovio notation resources are missing.")
        }
        var result: [RenderedNotationPage] = []
        for page in pages {
            try Task.checkCancellation()
            guard page.state == .succeeded, let xml = page.musicXML, !xml.isEmpty else {
                throw NotationRenderError.invalidInput("Source page \(page.sourcePageIndex + 1) has no recognized notation.")
            }
            let toolkit = VerovioToolkit(resources.path)
            let options: [String: Any] = [
                "inputFrom": Self.musicXMLInputFormat, "scale": scale,
                "pageWidth": Int(width * 100 / Double(scale)),
                "pageHeight": Int(height * 100 / Double(scale)),
                "pageMarginTop": 40, "pageMarginBottom": 40,
                "pageMarginLeft": 35, "pageMarginRight": 35,
                "breaks": "auto", "header": "none", "footer": "none",
                "svgViewBox": true
            ]
            let json = String(decoding: try JSONSerialization.data(withJSONObject: options), as: UTF8.self)
            guard toolkit.setOptions(json), toolkit.loadData(xml), toolkit.getPageCount() > 0 else {
                throw NotationRenderError.engraving("Source page \(page.sourcePageIndex + 1): \(toolkit.getLog())")
            }
            for number in 1...toolkit.getPageCount() {
                let svg = toolkit.renderToSVG(number, false)
                guard svg.contains("<svg") else {
                    throw NotationRenderError.engraving("Verovio could not draw source page \(page.sourcePageIndex + 1).")
                }
                result.append(RenderedNotationPage(sourcePageIndex: page.sourcePageIndex,
                                                    renderedPageIndex: number - 1, svg: svg,
                                                    reviewRequired: page.reviewRequired ?? true))
            }
        }
        return result
    }
}
