import PDFKit
import ScoreCore
import SwiftUI

struct ReadingAreaEditor: View {
    let page: PDFPage
    let system: SourceSystem
    let onSave: (NormalizedRect) throws -> Void
    @Environment(\.dismiss) private var dismiss
    @State private var crop: NormalizedRect
    @State private var errorMessage: String?

    init(page: PDFPage, system: SourceSystem,
         onSave: @escaping (NormalizedRect) throws -> Void) {
        self.page = page
        self.system = system
        self.onSave = onSave
        // A sheet starts from the saved area; edits are local until Save.
        _crop = State(initialValue: system.bounds)
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 20) {
                    Text("Keep both piano staves, clefs and markings inside the blue outline.")
                        .foregroundStyle(.secondary)
                    SourcePageSurface(page: page)
                        .overlay {
                            GeometryReader { geometry in
                                Rectangle().stroke(.tint, lineWidth: 3)
                                    .frame(width: geometry.size.width * crop.width,
                                           height: geometry.size.height * crop.height)
                                    .offset(x: geometry.size.width * crop.x,
                                            y: geometry.size.height * crop.y)
                            }.accessibilityHidden(true)
                        }
                    cropControls
                    Button("Use full page") { crop = .fullPage }
                        .accessibilityIdentifier("reset-reading-area")
                    Text("The original stays unchanged. Adjusting an area clears its confirmed timing.")
                        .font(.footnote).foregroundStyle(.secondary)
                }.padding(20)
            }
            .background(Color(uiColor: .systemGroupedBackground))
            .navigationTitle("Reading area")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() } }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Save area") {
                        do { try onSave(crop); dismiss() }
                        catch { errorMessage = error.localizedDescription }
                    }.accessibilityIdentifier("save-reading-area")
                }
            }
            .alert("Could not save this area", isPresented: Binding(
                get: { errorMessage != nil }, set: { if !$0 { errorMessage = nil } }
            )) { Button("OK") {} } message: { Text(errorMessage ?? "") }
        }
    }

    private var cropControls: some View {
        VStack(alignment: .leading, spacing: 16) {
            edge("Top", value: Binding(get: { crop.y }, set: {
                let bottom = crop.y + crop.height
                crop.y = $0
                crop.height = bottom - $0
            }), range: 0...(crop.y + crop.height - 0.05))
            edge("Bottom", value: Binding(get: { crop.y + crop.height }, set: {
                crop.height = $0 - crop.y
            }), range: (crop.y + 0.05)...1)
            edge("Left", value: Binding(get: { crop.x }, set: {
                let right = crop.x + crop.width
                crop.x = $0
                crop.width = right - $0
            }), range: 0...(crop.x + crop.width - 0.05))
            edge("Right", value: Binding(get: { crop.x + crop.width }, set: {
                crop.width = $0 - crop.x
            }), range: (crop.x + 0.05)...1)
        }
    }

    private func edge(_ label: String, value: Binding<Double>, range: ClosedRange<Double>) -> some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(label).font(.subheadline)
            Slider(value: value, in: range)
                .accessibilityLabel("\(label) edge")
                .accessibilityValue("\(Int((value.wrappedValue * 100).rounded())) percent")
                .accessibilityIdentifier("crop-\(label.lowercased())")
        }
    }
}

struct OriginalReviewView: View {
    let page: PDFPage
    let pageNumber: Int
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 16) {
                    Text("No clean edition yet").font(.headline)
                    Text("Keep reading the original. A recognized edition needs to be created and reviewed before comparison is available.")
                        .foregroundStyle(.secondary)
                    Label("Original · Page \(pageNumber)", systemImage: "doc")
                        .font(.headline)
                    SourcePageSurface(page: page)
                }.padding(20)
            }
            .background(Color(uiColor: .systemGroupedBackground))
            .navigationTitle("Review score")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar { ToolbarItem(placement: .confirmationAction) { Button("Done") { dismiss() } } }
        }
    }
}
