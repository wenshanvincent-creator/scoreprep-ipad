import PDFKit
import SwiftUI

struct OriginalPagesView: View {
    let document: PDFDocument
    @State private var pageIndex: Int
    @Environment(\.dismiss) private var dismiss

    init(document: PDFDocument, initialPageIndex: Int) {
        self.document = document
        _pageIndex = State(initialValue: initialPageIndex)
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                if let page = document.page(at: pageIndex) {
                    SourcePageSurface(page: page).padding(16)
                }
            }
            .background(Color(uiColor: .systemGroupedBackground))
            .safeAreaInset(edge: .bottom) {
                Picker("Original page", selection: $pageIndex) {
                    ForEach(0..<document.pageCount, id: \.self) { page in
                        Text("Page \(page + 1) of \(document.pageCount)").tag(page)
                    }
                }.padding().background(.bar).accessibilityIdentifier("original-page-picker")
            }
            .navigationTitle("Original score")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button("Done") { dismiss() }.accessibilityIdentifier("close-original-pages")
                }
            }
        }.presentationSizing(.page)
    }
}
