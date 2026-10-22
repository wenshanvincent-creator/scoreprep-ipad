import SwiftUI
import WebKit

public struct RecognizedScoreView: View {
    public let pages: [RecognitionPage]
    public let initialSourcePageIndex: Int
    public let onSourcePageChanged: ((Int) -> Void)?
    @State private var rendered: [RenderedNotationPage] = []
    @State private var selection = 0
    @State private var scale = 45
    @State private var failure: String?
    @State private var isRendering = false
    @State private var renderer = VerovioRenderer()
    @State private var hasRendered = false

    /// initialSourcePageIndex seeds the first layout only; later layouts preserve the visible source.
    public init(pages: [RecognitionPage], initialSourcePageIndex: Int = 0,
                onSourcePageChanged: ((Int) -> Void)? = nil) {
        self.pages = pages
        self.initialSourcePageIndex = initialSourcePageIndex
        self.onSourcePageChanged = onSourcePageChanged
    }

    public var body: some View {
        VStack(spacing: 0) {
            ViewThatFits(in: .horizontal) {
                HStack { pageCaption; Spacer(); sizeControl; navigationControls }
                VStack(alignment: .leading) {
                    pageCaption
                    HStack { sizeControl; Spacer(); navigationControls }
                }
            }
            .padding(.horizontal)
            .padding(.vertical, 8)
            .background(Color(uiColor: .secondarySystemBackground))

            GeometryReader { geometry in
                let request = RenderRequest(pages: pages, width: Int(geometry.size.width),
                                            height: Int(geometry.size.height), scale: scale)
                ZStack {
                    Color.white
                    if let failure {
                        ContentUnavailableView("Notation could not be displayed", systemImage: "music.note",
                                               description: Text(failure))
                            .foregroundStyle(Color(red: 0.094, green: 0.141, blue: 0.173))
                    } else if !rendered.isEmpty {
                        TabView(selection: $selection) {
                            ForEach(rendered) { page in
                                NotationSVGView(svg: page.svg)
                                    .accessibilityLabel("Source page \(page.sourcePageIndex + 1), notation page \(page.renderedPageIndex + 1)")
                                    .tag(rendered.firstIndex(where: { $0.id == page.id })!)
                            }
                        }
                        .tabViewStyle(.page(indexDisplayMode: .never))
                        .accessibilityIdentifier("recognizedNotation")
                    }
                    if isRendering { ProgressView("Laying out notation…").padding().background(.background) }
                }
                .task(id: request) {
                    guard request.width > 100, request.height > 100 else { return }
                    isRendering = true
                    failure = nil
                    // Keep the same source page visible when a size/rotation changes pagination.
                    let sourceIndex = hasRendered ? visibleSourcePageIndex : initialSourcePageIndex
                    do {
                        let output = try await renderer.render(pages: request.pages,
                                                               width: Double(request.width),
                                                               height: Double(request.height), scale: request.scale)
                        try Task.checkCancellation()
                        rendered = output
                        selection = output.firstIndex(where: { $0.sourcePageIndex == sourceIndex }) ?? 0
                        hasRendered = true
                        isRendering = false
                    } catch is CancellationError {
                        // The replacement task owns the current progress state.
                    } catch {
                        guard !Task.isCancelled else { return }
                        rendered = []
                        failure = error.localizedDescription
                        isRendering = false
                    }
                }
            }
        }
        .tint(Color(red: 0.157, green: 0.369, blue: 0.475))
        .onChange(of: visibleSourcePageIndex) { _, index in
            if let index { onSourcePageChanged?(index) }
        }
    }

    private var visibleSourcePageIndex: Int? {
        rendered.indices.contains(selection) ? rendered[selection].sourcePageIndex : nil
    }

    private var pageCaption: some View {
        VStack(alignment: .leading, spacing: 2) {
            if rendered.indices.contains(selection) {
                let page = rendered[selection]
                Text("Source page \(page.sourcePageIndex + 1) · \(selection + 1) of \(rendered.count)")
                    .font(.headline)
                    .accessibilityIdentifier("notationPageCaption")
                if page.reviewRequired {
                    Text("Check notes and rhythm against the original.").font(.subheadline).foregroundStyle(.secondary)
                }
            } else {
                Text("Recognized notation").font(.headline)
            }
        }
        .fixedSize(horizontal: false, vertical: true)
    }

    private var sizeControl: some View {
        HStack(spacing: 4) {
            Text("Size").font(.body)
                .accessibilityValue("\(Int(Double(scale) / 45 * 100)) percent")
                .accessibilityIdentifier("notationSizeValue")
            Button { scale -= 5 } label: {
                Image(systemName: "minus").frame(minWidth: 44, minHeight: 44)
            }
            .accessibilityLabel("Smaller notation")
            .accessibilityIdentifier("decreaseNotationSize")
            .disabled(scale <= 30 || isRendering)
            Button { scale += 5 } label: {
                Image(systemName: "plus").frame(minWidth: 44, minHeight: 44)
            }
            .accessibilityLabel("Larger notation")
            .accessibilityIdentifier("increaseNotationSize")
            .disabled(scale >= 80 || isRendering)
        }
        .fixedSize()
        .buttonStyle(.bordered)
    }

    private var navigationControls: some View {
        HStack(spacing: 4) {
            Button { selection -= 1 } label: {
                Image(systemName: "chevron.left").frame(minWidth: 44, minHeight: 44)
            }
            .accessibilityLabel("Previous notation page")
            .disabled(selection <= 0 || isRendering)
            Button { selection += 1 } label: {
                Image(systemName: "chevron.right").frame(minWidth: 44, minHeight: 44)
            }
            .accessibilityLabel("Next notation page")
            .disabled(selection >= rendered.count - 1 || isRendering)
        }
    }
}

private struct RenderRequest: Equatable {
    let pages: [RecognitionPage]
    let width: Int
    let height: Int
    let scale: Int
}

/// WebKit only displays SVG produced by the native toolkit; no network or JavaScript.
private struct NotationSVGView: UIViewRepresentable {
    let svg: String

    func makeUIView(context: Context) -> WKWebView {
        let configuration = WKWebViewConfiguration()
        configuration.websiteDataStore = .nonPersistent()
        configuration.defaultWebpagePreferences.allowsContentJavaScript = false
        let view = WKWebView(frame: .zero, configuration: configuration)
        view.scrollView.isScrollEnabled = false
        view.isOpaque = true
        view.backgroundColor = .white
        return view
    }

    func updateUIView(_ view: WKWebView, context: Context) {
        guard context.coordinator.svg != svg else { return }
        context.coordinator.svg = svg
        view.loadHTMLString("""
        <!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1">
        <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; img-src data:">
        <style>html,body{margin:0;background:white;width:100%;height:100%;overflow:hidden}svg{width:100%;height:100%;display:block}</style>
        </head><body>\(svg)</body></html>
        """, baseURL: nil)
    }

    func makeCoordinator() -> Coordinator { Coordinator() }
    final class Coordinator { var svg: String? }
}
