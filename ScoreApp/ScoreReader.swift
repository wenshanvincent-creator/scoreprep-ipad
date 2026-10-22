import PDFKit
import ScoreCore
import SwiftUI

struct ScoreReader: View {
    let project: ScoreProject
    let sourceURL: URL
    let onTimingSaved: (UUID, [TimingSegment]) throws -> Void
    let onPreparationSaved: (ScorePreparation) throws -> Void
    let onCropSaved: (UUID, NormalizedRect) throws -> Void
    let onRename: () -> Void
    let onDelete: () -> Void
    /// Integration supplies its own recognition/review destination for this source page.
    var onReviewRequested: ((UUID, Int) -> Void)? = nil
    @State private var document: PDFDocument?
    @State private var loadingError: String?
    @State private var currentID: UUID?
    @State private var sheet: ReaderSheet?
    @State private var practiceRequest: ReaderPracticeRequest?
    @State private var practiceError: String?
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    private var currentIndex: Int {
        project.systems.firstIndex(where: { $0.id == currentID }) ?? 0
    }
    private var current: SourceSystem? { project.systems.first(where: { $0.id == currentID }) }

    var body: some View {
        Group {
            if let document {
                TabView(selection: $currentID) {
                    ForEach(project.systems) { system in
                        OriginalReadingArea(document: document, system: system)
                            .tag(Optional(system.id))
                    }
                }
                .tabViewStyle(.page(indexDisplayMode: .never))
                .background(Color(uiColor: .systemGroupedBackground))
                .safeAreaInset(edge: .bottom, spacing: 0) { navigation }
            } else if let loadingError {
                ContentUnavailableView("Could not open the original", systemImage: "doc",
                    description: Text(loadingError))
            } else { ProgressView("Opening original…") }
        }
        .navigationTitle(project.title)
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItemGroup(placement: .primaryAction) {
                Button("Practice", systemImage: "play.rectangle", action: openPractice)
                    .labelStyle(.iconOnly).disabled(document == nil)
                    .accessibilityIdentifier("open-practice")
                if let current {
                    Button("Timing", systemImage: "metronome") { sheet = .timing(current) }
                        .labelStyle(.iconOnly)
                        .accessibilityIdentifier("edit-timing-\(currentIndex)")
                }
                Button("Review", systemImage: "doc.text.magnifyingglass") {
                    if let current {
                        if let onReviewRequested { onReviewRequested(project.id, current.pageIndex) }
                        else { sheet = .review(current) }
                    }
                }.disabled(current == nil).accessibilityIdentifier("review-score")
                Menu {
                    if document != nil {
                        Button("Reading areas and order", systemImage: "rectangle.split.3x1") {
                            sheet = .preparation(current?.pageIndex ?? 0)
                        }.accessibilityIdentifier("prepare-score")
                        Button("View original pages", systemImage: "doc") {
                            sheet = .original(current?.pageIndex ?? 0)
                        }.accessibilityIdentifier("view-original-pages")
                    }
                    if let current {
                        Button("Adjust reading area", systemImage: "crop") { sheet = .crop(current) }
                    }
                    Divider()
                    Button("Rename", systemImage: "pencil", action: onRename)
                    Button("Delete", systemImage: "trash", role: .destructive, action: onDelete)
                } label: { Label("Score options", systemImage: "ellipsis.circle") }
                .accessibilityIdentifier("score-options")
            }
        }
        .task(id: sourceURL) {
            do {
                document = try OriginalDocument.open(sourceURL)
                if currentID == nil { currentID = project.systems.first?.id }
            } catch { loadingError = error.localizedDescription }
        }
        .onChange(of: project.systems.map(\.id)) { _, ids in
            if currentID.map({ ids.contains($0) }) != true { currentID = ids.first }
        }
        .onChange(of: ScorePreparation(project: project)) { _, _ in
            if practiceRequest != nil {
                practiceRequest = nil
                practiceError = "The preparation changed. Open practice again to use its updated order and timing."
            }
        }
        .fullScreenCover(item: $practiceRequest) { request in
            if let document {
                PracticeView(project: request.project, document: document, timeline: request.timeline)
            }
        }
        .alert("Practice needs preparation", isPresented: Binding(
            get: { practiceError != nil }, set: { if !$0 { practiceError = nil } }
        )) { Button("OK") {} } message: { Text(practiceError ?? "") }
        .sheet(item: $sheet) { destination in
            switch destination {
            case .preparation(let pageIndex):
                if let document {
                    ScorePreparationEditor(project: project, document: document,
                        initialPageIndex: pageIndex, onSave: onPreparationSaved)
                }
            case .original(let pageIndex):
                if let document { OriginalPagesView(document: document, initialPageIndex: pageIndex) }
            case .timing(let system):
                TimingEditor(system: system) { try onTimingSaved(system.id, $0) }
            case .crop(let system):
                if let page = document?.page(at: system.pageIndex) {
                    ReadingAreaEditor(page: page, system: system) { try onCropSaved(system.id, $0) }
                }
            case .review(let system):
                if let page = document?.page(at: system.pageIndex) {
                    OriginalReviewView(page: page, pageNumber: system.pageIndex + 1)
                }
            }
        }
    }

    private var navigation: some View {
        HStack(spacing: 12) {
            Button { move(-1) } label: {
                Label("Previous", systemImage: "chevron.left").labelStyle(.iconOnly)
                    .frame(minWidth: 44, minHeight: 44)
            }.disabled(currentIndex == 0).accessibilityIdentifier("previous-area")
            Spacer(minLength: 0)
            VStack(spacing: 2) {
                Text(current?.label ?? "Original").font(.headline)
                    .accessibilityIdentifier("system-label-\(currentIndex)")
                Text("\(currentIndex + 1) of \(project.systems.count) · Original")
                    .font(.caption).foregroundStyle(.secondary).monospacedDigit()
                    .accessibilityIdentifier("reader-position")
                if let timing = current?.timing {
                    Text(timing.reduce(0) { $0 + $1.duration }
                        .formatted(.number.precision(.fractionLength(1))) + " s")
                        .font(.caption).foregroundStyle(.secondary).monospacedDigit()
                        .accessibilityIdentifier("system-duration-\(currentIndex)")
                }
            }
            Spacer(minLength: 0)
            Button { move(1) } label: {
                Label("Next", systemImage: "chevron.right").labelStyle(.iconOnly)
                    .frame(minWidth: 44, minHeight: 44)
            }.disabled(currentIndex >= project.systems.count - 1)
                .accessibilityIdentifier("next-area")
        }
        .padding(.horizontal).padding(.vertical, 6).background(.bar)
    }

    private func openPractice() {
        do {
            practiceRequest = ReaderPracticeRequest(project: project,
                timeline: try TimelineCompiler.compile(project))
        } catch TimingError.unconfirmedTiming(let id) {
            let area = project.systems.first { $0.id == id }
            practiceError = "Confirm timing for \(area?.label ?? "this reading area") before practice. Manual reading remains available."
        } catch { practiceError = error.localizedDescription }
    }

    private func move(_ delta: Int) {
        let index = currentIndex + delta
        guard project.systems.indices.contains(index) else { return }
        if reduceMotion { currentID = project.systems[index].id }
        else { withAnimation { currentID = project.systems[index].id } }
    }
}

private struct ReaderPracticeRequest: Identifiable {
    let id = UUID()
    let project: ScoreProject
    let timeline: CompiledTimeline
}

private enum ReaderSheet: Identifiable {
    case timing(SourceSystem), crop(SourceSystem), review(SourceSystem)
    case preparation(Int), original(Int)
    var id: String {
        switch self {
        case .preparation(let page): return "preparation-\(page)"
        case .original(let page): return "original-\(page)"
        case .timing(let s): return "timing-\(s.id)"
        case .crop(let s): return "crop-\(s.id)"
        case .review(let s): return "review-\(s.id)"
        }
    }
}

private struct OriginalReadingArea: View {
    let document: PDFDocument
    let system: SourceSystem
    var body: some View {
        if let page = document.page(at: system.pageIndex) {
            ScrollView(.vertical) {
                SourcePageSurface(page: page, crop: system.bounds).padding(16)
            }
        } else {
            ContentUnavailableView("Source page is missing", systemImage: "doc.badge.ellipsis",
                description: Text("Page \(system.pageIndex + 1) is unavailable in the original."))
        }
    }
}

struct SourcePageSurface: View {
    let page: PDFPage
    var crop = NormalizedRect.fullPage
    var body: some View {
        let size = SourcePageGeometry.displaySize(of: page)
        PDFSystemView(page: page, crop: crop)
            .aspectRatio(size.width * crop.width / (size.height * crop.height), contentMode: .fit)
            .background(.white).accessibilityLabel("Original score notation")
    }
}
