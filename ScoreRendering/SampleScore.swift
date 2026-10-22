import ScoreCore
import UIKit

enum SampleScore {
    private static let size = CGSize(width: 595, height: 842)
    private static let staffTops: [CGFloat] = [176, 376, 576]

    static func project() -> ScoreProject {
        let timing = TimingSegment(
            quarterBeats: 16,
            meter: TimeSignature(numerator: 4, denominator: 4),
            tempo: ReferenceTempo(bpm: 80)
        )
        let systems = staffTops.enumerated().map { index, top in
            SourceSystem(
                pageIndex: 0,
                bounds: NormalizedRect(
                    x: 0.05, y: Double((top - 48) / size.height),
                    width: 0.90, height: Double(116 / size.height)
                ),
                label: "Line \(index + 1)", timing: [timing]
            )
        }
        let section = ScoreSection(name: "Study", systemIDs: systems.map(\.id))
        return ScoreProject(
            title: "Practice study", sourceFilename: "practice-study.pdf",
            systems: systems, sections: [section],
            readingOrder: [SectionOccurrence(sectionID: section.id)]
        )
    }

    static func pdfData() -> Data {
        let renderer = UIGraphicsPDFRenderer(bounds: CGRect(origin: .zero, size: size))
        return renderer.pdfData { rendererContext in
            rendererContext.beginPage()
            let context = rendererContext.cgContext
            UIColor.black.setFill()
            UIColor.black.setStroke()
            draw("Practice study", at: CGPoint(x: 44, y: 42), size: 27, weight: .semibold)
            draw("Original exercise for ScorePrep", at: CGPoint(x: 44, y: 82), size: 13)
            draw("Quarter note = 80", at: CGPoint(x: 390, y: 87), size: 13)
            for (systemIndex, top) in staffTops.enumerated() {
                draw("\(systemIndex * 4 + 1)", at: CGPoint(x: 44, y: top - 35), size: 12)
                context.setLineWidth(0.7)
                for line in 0..<5 {
                    context.move(to: CGPoint(x: 44, y: top + CGFloat(line) * 9))
                    context.addLine(to: CGPoint(x: 554, y: top + CGFloat(line) * 9))
                }
                context.strokePath()
                draw("𝄞", at: CGPoint(x: 49, y: top - 26), size: 57)
                draw("4", at: CGPoint(x: 99, y: top - 1), size: 19, weight: .semibold)
                draw("4", at: CGPoint(x: 99, y: top + 17), size: 19, weight: .semibold)
                for bar in 0..<4 {
                    let left = CGFloat(124 + bar * 107)
                    for note in 0..<4 {
                        let x = left + 13 + CGFloat(note) * 23
                        let step = (note + bar + systemIndex) % 5
                        let y = top + 31.5 - CGFloat(step) * 4.5
                        context.fillEllipse(in: CGRect(x: x - 5, y: y - 3.5, width: 10, height: 7))
                        context.setLineWidth(1)
                        context.move(to: CGPoint(x: x + 4, y: y))
                        context.addLine(to: CGPoint(x: x + 4, y: y - 28))
                        context.strokePath()
                    }
                    let barX = CGFloat(124 + (bar + 1) * 107)
                    context.move(to: CGPoint(x: barX, y: top))
                    context.addLine(to: CGPoint(x: barX, y: top + 36))
                    context.strokePath()
                }
            }
        }
    }

    private static func draw(
        _ text: String, at point: CGPoint, size: CGFloat,
        weight: UIFont.Weight = .regular
    ) {
        (text as NSString).draw(
            at: point,
            withAttributes: [
                .font: UIFont.systemFont(ofSize: size, weight: weight),
                .foregroundColor: UIColor.black
            ]
        )
    }
}
