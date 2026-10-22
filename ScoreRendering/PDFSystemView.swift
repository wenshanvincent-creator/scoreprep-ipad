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
        guard let page, let context = UIGraphicsGetCurrentContext() else { return }
        let media = page.bounds(for: .mediaBox)
        let source = CGRect(
            x: media.minX + crop.x * media.width,
            y: media.minY + (1 - crop.y - crop.height) * media.height,
            width: crop.width * media.width,
            height: crop.height * media.height
        )
        context.saveGState()
        context.clip(to: bounds)
        context.translateBy(x: 0, y: bounds.height)
        context.scaleBy(x: bounds.width / source.width, y: -bounds.height / source.height)
        context.translateBy(x: -source.minX, y: -source.minY)
        page.draw(with: .mediaBox, to: context)
        context.restoreGState()
    }
}
