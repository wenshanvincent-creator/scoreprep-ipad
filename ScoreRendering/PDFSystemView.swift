import PDFKit
import ScoreCore
import SwiftUI

struct PDFSystemView: UIViewRepresentable {
    let page: PDFPage
    let crop: NormalizedRect

    func makeUIView(context: Context) -> PDFCropCanvas {
        let view = PDFCropCanvas()
        view.backgroundColor = .white
        view.isAccessibilityElement = true
        return view
    }

    func updateUIView(_ view: PDFCropCanvas, context: Context) {
        view.page = page
        view.crop = crop
        view.setNeedsDisplay()
    }
}

final class PDFCropCanvas: UIView {
    var page: PDFPage?
    var crop = NormalizedRect.fullPage

    override func draw(_ rect: CGRect) {
        guard let page, let reference = page.pageRef,
              let context = UIGraphicsGetCurrentContext() else { return }
        let size = SourcePageGeometry.displaySize(of: page)
        let source = CGRect(
            x: crop.x * size.width, y: crop.y * size.height,
            width: crop.width * size.width, height: crop.height * size.height
        )
        context.saveGState()
        context.clip(to: bounds)
        context.scaleBy(x: bounds.width / source.width, y: bounds.height / source.height)
        context.translateBy(x: -source.minX, y: -source.minY)
        // Crop coordinates describe the displayed, rotated page from its top-left.
        context.translateBy(x: 0, y: size.height)
        context.scaleBy(x: 1, y: -1)
        context.concatenate(reference.getDrawingTransform(
            .mediaBox, rect: CGRect(origin: .zero, size: size),
            rotate: Int32(page.rotation) - reference.rotationAngle,
            preserveAspectRatio: true
        ))
        context.drawPDFPage(reference)
        // PDF annotation appearances (including ink) remain on the original.
        for annotation in page.annotations where annotation.shouldDisplay {
            annotation.draw(with: .mediaBox, in: context)
        }
        context.restoreGState()
    }
}

enum SourcePageGeometry {
    static func displaySize(of page: PDFPage) -> CGSize {
        let media = page.pageRef?.getBoxRect(.mediaBox) ?? page.bounds(for: .mediaBox)
        return page.rotation % 180 == 0 ? media.size
            : CGSize(width: media.height, height: media.width)
    }
}
