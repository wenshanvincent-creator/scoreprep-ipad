import PDFKit
import ScoreCore
import SwiftUI

struct RecognitionReviewView: View {
    @ObservedObject private var library: ScoreLibrary
    private let projectID: UUID
    @StateObject private var session: RecognitionSession
    @State private var sourcePageIndex: Int
    @State private var original: PDFDocument?
    @State private var pages: [RecognitionPage] = []
    @State private var edition = Edition.original
    @State private var showingConnection = false
    @Environment(\.dismiss) private var dismiss
    @Environment(\.scenePhase) private var scenePhase

    // The review destination seeds its own source-page selection once.
    init(library: ScoreLibrary, projectID: UUID, sourcePageIndex: Int) {
        self.library = library
        self.projectID = projectID
        _sourcePageIndex = State(initialValue: sourcePageIndex)
        _session = StateObject(wrappedValue: RecognitionSession(library: library, projectID: projectID))
    }

    private enum Edition: String, CaseIterable {
        case original = "Original", clean = "Clean edition"
    }

    private var project: ScoreProject? { library.projects.first(where: { $0.id == projectID }) }
    private var savedPage: RecognizedSourcePage? {
        project?.recognizedEdition?.pages.first(where: { $0.sourcePageIndex == sourcePageIndex })
    }

    var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                if let project {
                    header
                    if edition == .clean, !pages.isEmpty {
                        RecognizedScoreView(
                            pages: pages, initialSourcePageIndex: sourcePageIndex,
                            onSourcePageChanged: { index in
                                sourcePageIndex = index
                                if savedPage?.reviewState == .rejected { edition = .original }
                            }
                        )
                    } else if let page = original?.page(at: sourcePageIndex) {
                        ScrollView {
                            SourcePageSurface(page: page).padding(20)
                        }
                        .background(Color(uiColor: .systemGroupedBackground))
                    } else {
                        ContentUnavailableView("Original is unavailable", systemImage: "doc")
                    }
                    if project.recognizedEdition != nil { reviewControls }
                    conversionControls
                } else {
                    ContentUnavailableView("Score is no longer in the library", systemImage: "doc")
                }
            }
            .navigationTitle(project?.title ?? "Review score")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Done") { dismiss() }
                }
                ToolbarItem(placement: .primaryAction) {
                    Button("Worker connection", systemImage: "network") { showingConnection = true }
                        .disabled(session.isWaiting)
                        .accessibilityIdentifier("worker-connection")
                }
            }
            .sheet(isPresented: $showingConnection) {
                RecognitionConnectionView(
                    configuration: session.configuration,
                    onSave: session.saveConnection, onRemove: session.removeConnection
                )
            }
            .task(id: project?.sourceFilename) {
                do {
                    if let project, let url = library.sourceURL(for: project) {
                        original = try OriginalDocument.open(url)
                    }
                } catch { session.errorMessage = error.localizedDescription }
            }
            .task(id: project?.recognizedEdition) {
                do {
                    pages = try library.recognitionPages(projectID: projectID)
                    if !pages.isEmpty, edition == .original,
                       savedPage?.reviewState != .rejected { edition = .clean }
                } catch { session.errorMessage = error.localizedDescription }
            }
            .onChange(of: scenePhase) { _, phase in
                if phase != .active { session.stopWaiting() }
            }
            .onDisappear { session.stopWaiting() }
            .alert("Recognition could not finish", isPresented: Binding(
                get: { session.errorMessage != nil },
                set: { if !$0 { session.errorMessage = nil } }
            )) {
                Button("OK") { session.errorMessage = nil }
            } message: {
                Text(session.errorMessage ?? "")
            }
        }
    }

    private var header: some View {
        ViewThatFits(in: .horizontal) {
            HStack(spacing: 20) { sourceCaption; Spacer(); editionPicker }
            VStack(alignment: .leading, spacing: 12) { sourceCaption; editionPicker }
        }
        .padding()
        .background(.bar)
        .buttonStyle(.bordered)
        .controlSize(.large)
    }

    private var sourceCaption: some View {
        HStack(spacing: 8) {
            if edition == .original {
                Button { sourcePageIndex -= 1 } label: {
                    Image(systemName: "chevron.left").frame(minWidth: 44, minHeight: 44)
                }
                .accessibilityLabel("Previous source page")
                .disabled(sourcePageIndex == 0)
            }
            Text("Original · Page \(sourcePageIndex + 1)")
                .font(.headline)
                .accessibilityIdentifier("review-source-page")
            if edition == .original {
                Button { sourcePageIndex += 1 } label: {
                    Image(systemName: "chevron.right").frame(minWidth: 44, minHeight: 44)
                }
                .accessibilityLabel("Next source page")
                .disabled(sourcePageIndex + 1 >= (original?.pageCount ?? 0))
            }
        }
    }

    private var editionPicker: some View {
        Picker("Score view", selection: $edition) {
            ForEach(Edition.allCases, id: \.self) { value in
                Text(value.rawValue).tag(value)
            }
        }
        .pickerStyle(.segmented)
        .disabled(pages.isEmpty)
        .accessibilityIdentifier("review-edition-picker")
    }

    private var reviewControls: some View {
        VStack(alignment: .leading, spacing: 8) {
            switch savedPage?.reviewState {
            case .accepted:
                Label("Page \(sourcePageIndex + 1) reviewed", systemImage: "checkmark.circle")
            case .rejected:
                Label("Use the original for page \(sourcePageIndex + 1)", systemImage: "doc")
            case .unreviewed, .none:
                Text("Check notes and rhythm against the original before accepting this page.")
                    .font(.subheadline)
            }
            ViewThatFits(in: .horizontal) {
                HStack { reviewButtons }
                VStack(alignment: .leading) { reviewButtons }
            }
        }
        .padding()
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(.bar)
        .buttonStyle(.bordered)
        .controlSize(.large)
    }

    @ViewBuilder private var reviewButtons: some View {
        Button("Accept page", systemImage: "checkmark") { saveReview(.accepted) }
            .disabled(savedPage == nil || savedPage?.reviewState == .accepted)
            .accessibilityIdentifier("accept-recognized-page")
        Button("Use original", systemImage: "doc") {
            saveReview(.rejected)
            edition = .original
        }
        .disabled(savedPage == nil || savedPage?.reviewState == .rejected)
        .accessibilityIdentifier("reject-recognized-page")
        if savedPage?.reviewState != .unreviewed {
            Button("Review again") { saveReview(.unreviewed) }
        }
    }

    private var conversionControls: some View {
        VStack(alignment: .leading, spacing: 8) {
            if session.isWaiting {
                if let job = session.job {
                    ProgressView(value: Double(job.completedPages), total: Double(job.pages.count))
                    Text("Recognized \(job.completedPages) of \(job.pages.count) source pages")
                } else {
                    ProgressView("Sending the original to your worker…")
                }
                Button("Stop waiting") { session.stopWaiting() }
                Text("The worker may continue. A saved job can be resumed from this score.")
                    .font(.footnote).foregroundStyle(.secondary)
            } else {
                if pages.isEmpty {
                    Text("No clean edition yet").font(.headline)
                    Text("Create an edition from the original, then check the recognized notation.")
                        .foregroundStyle(.secondary)
                }
                if session.configuration == nil {
                    Button("Connect recognition worker") { showingConnection = true }
                } else {
                    ViewThatFits(in: .horizontal) {
                        HStack { recognitionButtons }
                        VStack(alignment: .leading) { recognitionButtons }
                    }
                }
            }
        }
        .padding()
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(.bar)
        .buttonStyle(.bordered)
        .controlSize(.large)
    }

    @ViewBuilder private var recognitionButtons: some View {
        if project?.pendingRecognition != nil, session.job?.state != .failed {
            Button("Resume recognition", systemImage: "arrow.clockwise") { session.resume() }
                .buttonStyle(.borderedProminent)
                .accessibilityIdentifier("resume-recognition")
        }
        Button(
            project?.pendingRecognition != nil ? "Start new conversion"
                : (pages.isEmpty ? "Recognize original" : "Recognize again"),
            systemImage: "sparkle.magnifyingglass"
        ) {
            session.recognize()
        }
        .accessibilityIdentifier("recognize-original")
    }

    private func saveReview(_ state: RecognitionReviewState) {
        do {
            try library.setRecognitionReview(
                projectID: projectID, sourcePageIndex: sourcePageIndex, state: state
            )
        } catch { session.errorMessage = error.localizedDescription }
    }
}

struct SourceReviewRequest: Identifiable {
    let projectID: UUID
    let sourcePageIndex: Int
    var id: String { "\(projectID):\(sourcePageIndex)" }
}
