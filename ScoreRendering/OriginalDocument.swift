import ImageIO
import PDFKit
import UniformTypeIdentifiers
import UIKit

/// Images remain byte-for-byte originals on disk; PDFKit is only the display bridge.
enum OriginalDocument {
    static func open(_ url: URL) throws -> PDFDocument {
        if url.pathExtension.lowercased() == "pdf" {
            guard let document = PDFDocument(url: url), !document.isLocked,
                  document.pageCount > 0 else { throw LibraryError.unreadablePDF }
            guard document.pageCount <= 20 else { throw LibraryError.tooManyPages }
            return document
        }
        guard let source = CGImageSourceCreateWithURL(url as CFURL, nil),
              let type = CGImageSourceGetType(source),
              [UTType.jpeg.identifier, UTType.png.identifier].contains(type as String),
              let properties = CGImageSourceCopyPropertiesAtIndex(source, 0, nil)
                as? [CFString: Any],
              let width = properties[kCGImagePropertyPixelWidth] as? Int,
              let height = properties[kCGImagePropertyPixelHeight] as? Int else {
            throw LibraryError.unreadableImage
        }
        guard Double(width) * Double(height) <= 40_000_000 else {
            throw LibraryError.imageTooLarge
        }
        guard let image = UIImage(contentsOfFile: url.path),
              let page = PDFPage(image: image) else { throw LibraryError.unreadableImage }
        let document = PDFDocument()
        document.insert(page, at: 0)
        return document
    }
}
