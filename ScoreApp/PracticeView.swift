import PDFKit
import ScoreCore
import SwiftUI
import UIKit

struct PracticeView: View {
    let project: ScoreProject
    let document: PDFDocument
    @StateObject private var controller: PracticeController
    @State private var countInBars = 1
    @State private var optionsPresented = false
    @State private var originalPresented = false
    @Environment(\.dismiss) private var dismiss
    @Environment(\.scenePhase) private var scenePhase

    init(project: ScoreProject, document: PDFDocument, timeline: CompiledTimeline) {
        self.project = project
        self.document = document
        _controller = StateObject(wrappedValue: PracticeController(timeline: timeline))
    }

    var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                PracticeStatusView(controller: controller)
                PracticeMusicSurface(document: document,
                    current: presentation(controller.currentSpan, index: controller.snapshot.currentSpanIndex),
                    upcoming: controller.upcomingSpan.map {
                        presentation($0, index: controller.snapshot.upcomingSpanIndex!)
                    })
                    .equatable()
                    .simultaneousGesture(DragGesture(minimumDistance: 48).onEnded { value in
                        guard abs(value.translation.width) > abs(value.translation.height) * 1.5 else { return }
                        if value.translation.width < 0 { next() } else { previous() }
                    })
            }
            .background(Color(uiColor: .systemGroupedBackground))
            .safeAreaInset(edge: .bottom, spacing: 0) {
                PracticeControls(controller: controller, countInBars: countInBars,
                    onPrevious: previous, onNext: next, previousAvailable: previousIndex != nil)
            }
            .navigationTitle(project.title)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Done") { controller.pause(); dismiss() }
                        .accessibilityIdentifier("leave-practice")
                }
                ToolbarItemGroup(placement: .primaryAction) {
                    Button("Original pages", systemImage: "doc") {
                        if controller.snapshot.isRunning { controller.pause() }
                        originalPresented = true
                    }.accessibilityIdentifier("practice-original")
                    Button("Practice options", systemImage: "slider.horizontal.3") {
                        if controller.snapshot.isRunning { controller.pause() }
                        optionsPresented = true
                    }.accessibilityIdentifier("practice-options")
                }
            }
            .sheet(isPresented: $optionsPresented) {
                PracticeOptionsView(controller: controller, project: project, countInBars: $countInBars)
            }
            .sheet(isPresented: $originalPresented) {
                OriginalPagesView(document: document, initialPageIndex:
                    project.systems.first { $0.id == controller.currentSpan.systemID }!.pageIndex)
            }
        }
        .onAppear {
            controller.refresh()
            UIApplication.shared.isIdleTimerDisabled = scenePhase == .active
        }
        .onChange(of: scenePhase) { _, phase in
            UIApplication.shared.isIdleTimerDisabled = phase == .active
        }
        .onDisappear {
            controller.pause()
            UIApplication.shared.isIdleTimerDisabled = false
        }
    }

    private var previousIndex: Int? {
        let index = controller.snapshot.currentSpanIndex
        if let loop = controller.loop,
           controller.currentSpan.id == loop.firstSpanID {
            return controller.timeline.spans.firstIndex { $0.id == loop.lastSpanID }
        }
        return index > 0 ? index - 1 : nil
    }

    private func previous() {
        if let index = previousIndex { controller.seek(to: controller.timeline.spans[index].id) }
    }

    private func next() {
        if let next = controller.upcomingSpan { controller.seek(to: next.id) }
    }

    private func presentation(_ span: TimelineSpan, index: Int) -> PracticeAreaPresentation {
        let area = project.systems.first { $0.id == span.systemID }!
        let pass = project.readingOrder.firstIndex { $0.id == span.occurrenceID }! + 1
        return PracticeAreaPresentation(area: area,
            occurrence: "Pass \(pass), area \(index + 1) of \(controller.timeline.spans.count)")
    }
}

struct PracticeAreaPresentation: Equatable {
    let area: SourceSystem
    let occurrence: String
}

/// Focus changes redraw notation; 30 Hz clock snapshots do not redraw PDFs.
private struct PracticeMusicSurface: View, Equatable {
    let document: PDFDocument
    let current: PracticeAreaPresentation
    let upcoming: PracticeAreaPresentation?

    static func == (lhs: Self, rhs: Self) -> Bool {
        lhs.document === rhs.document && lhs.current == rhs.current && lhs.upcoming == rhs.upcoming
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 24) {
                area(current, heading: "Current", active: true)
                if let upcoming { area(upcoming, heading: "Up next", active: false) }
                else { Text("End of passage").font(.headline).foregroundStyle(.secondary) }
            }.padding(16)
        }.accessibilityIdentifier("practice-music")
    }

    private func area(_ value: PracticeAreaPresentation, heading: String, active: Bool) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack(alignment: .firstTextBaseline) {
                Text("\(heading): \(value.area.label)").font(.headline)
                    .accessibilityIdentifier(active ? "practice-current" : "practice-upcoming")
                    .accessibilityLabel("\(heading): \(value.area.label), \(value.occurrence)")
                Spacer(minLength: 8)
                Text(value.occurrence).font(.caption).foregroundStyle(.secondary).accessibilityHidden(true)
            }
            if let page = document.page(at: value.area.pageIndex) {
                SourcePageSurface(page: page, crop: value.area.bounds)
            }
        }
        .padding(.leading, active ? 10 : 0)
        .overlay(alignment: .leading) {
            if active { Rectangle().fill(Color(red: 0.835, green: 0.608, blue: 0.176)).frame(width: 3) }
        }
    }
}

private struct PracticeStatusView: View {
    @ObservedObject var controller: PracticeController
    @Environment(\.dynamicTypeSize) private var dynamicTypeSize

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            let layout = dynamicTypeSize.isAccessibilitySize
                ? AnyLayout(VStackLayout(alignment: .leading)) : AnyLayout(HStackLayout())
            layout {
                Text(phaseLabel).font(.subheadline).monospacedDigit()
                    .accessibilityIdentifier("practice-phase")
                PracticePulseIndicator(display: controller.currentPulse)
                if !dynamicTypeSize.isAccessibilitySize { Spacer() }
                Text(controller.isAudible ? "Original · Sound on" : "Original · Silent")
                    .font(.caption).foregroundStyle(.secondary)
                if controller.loop != nil {
                    Text("A–B loop").font(.caption.bold()).accessibilityIdentifier("practice-loop-status")
                }
            }
            if let reason = controller.pauseReason {
                Text(reason.message).font(.footnote).foregroundStyle(.secondary)
                    .accessibilityIdentifier("practice-pause-reason")
            }
            if let error = controller.errorMessage {
                HStack(alignment: .top) {
                    Text(error).font(.footnote).foregroundStyle(.red)
                    Button("Dismiss error") { controller.dismissError() }
                }.accessibilityIdentifier("practice-error")
            }
        }.padding(.horizontal, 16).padding(.vertical, 8)
    }

    private var phaseLabel: String {
        switch controller.snapshot.phase {
        case .ready: return "Ready"
        case .countingIn:
            return "Count-in: \(controller.snapshot.countInRemaining.formatted(.number.precision(.fractionLength(1)))) s"
        case .playing: return "Playing"
        case .paused: return "Paused"
        case .finished: return "Finished"
        }
    }
}

private struct PracticeControls: View {
    @ObservedObject var controller: PracticeController
    let countInBars: Int
    let onPrevious: () -> Void
    let onNext: () -> Void
    let previousAvailable: Bool
    @State private var choosingSpeed = false
    @Environment(\.dynamicTypeSize) private var dynamicTypeSize
    @Environment(\.horizontalSizeClass) private var horizontalSizeClass

    var body: some View {
        Group {
            if dynamicTypeSize.isAccessibilitySize {
                Grid(horizontalSpacing: 20, verticalSpacing: 8) {
                    GridRow { previousButton; playbackButton }
                    GridRow { stopButton; nextButton }
                }.frame(maxWidth: .infinity)
            } else {
                let stacked = horizontalSizeClass == .compact || dynamicTypeSize > .large
                let layout = stacked ? AnyLayout(VStackLayout(spacing: 8)) : AnyLayout(HStackLayout())
                layout {
                    navigation
                    if !stacked { Spacer() }
                    HStack { speedButton; soundButton }
                }
            }
        }
        .frame(maxWidth: .infinity)
        .padding(.horizontal, 16).padding(.vertical, 8).background(.bar)
    }

    private var navigation: some View {
        HStack(spacing: 12) { previousButton; playbackButton; stopButton; nextButton }
    }

    private var previousButton: some View {
        Button(action: onPrevious) {
            Label("Previous", systemImage: "chevron.left").labelStyle(.iconOnly)
                .frame(minWidth: 44, minHeight: 44).contentShape(Rectangle())
        }
        .disabled(!previousAvailable).accessibilityIdentifier("practice-previous")
        .accessibilityHint("Pauses practice and moves to the previous reading occurrence.")
    }

    private var nextButton: some View {
        Button(action: onNext) {
            Label("Next", systemImage: "chevron.right").labelStyle(.iconOnly)
                .frame(minWidth: 44, minHeight: 44).contentShape(Rectangle())
        }
        .disabled(controller.upcomingSpan == nil).accessibilityIdentifier("practice-next")
        .accessibilityHint("Pauses practice and moves to the next reading occurrence.")
    }

    private var playbackButton: some View {
        Button(action: playOrPause) {
            let title = controller.snapshot.isRunning ? "Pause" :
                (controller.snapshot.phase == .paused ? "Resume" : "Play")
            let icon = controller.snapshot.isRunning ? "pause.fill" : "play.fill"
            Group {
                if dynamicTypeSize.isAccessibilitySize { Label(title, systemImage: icon).labelStyle(.iconOnly) }
                else { Label(title, systemImage: icon).fixedSize(horizontal: true, vertical: false) }
            }.frame(minWidth: 44, minHeight: 44).contentShape(Rectangle())
        }
        .buttonStyle(.borderedProminent).accessibilityIdentifier("practice-play-pause")
    }

    private var stopButton: some View {
        Button { controller.stop() } label: {
            Label("Stop", systemImage: "stop.fill").labelStyle(.iconOnly)
                .frame(minWidth: 44, minHeight: 44).contentShape(Rectangle())
        }
        .accessibilityIdentifier("practice-stop")
    }

    private var speedButton: some View {
        Button { choosingSpeed = true } label: {
            Label("Speed \(Int((controller.speed * 100).rounded()))%", systemImage: "speedometer")
                .frame(minHeight: 44).contentShape(Rectangle())
        }.accessibilityIdentifier("practice-speed")
        .confirmationDialog("Practice speed", isPresented: $choosingSpeed, titleVisibility: .visible) {
            ForEach([0.25, 0.5, 0.75, 1.0, 1.25, 1.5, 2.0], id: \.self) { speed in
                Button("\(Int(speed * 100))%") { controller.setSpeed(speed) }
            }
        }
    }

    private var soundButton: some View {
        Button {
            controller.setAudible(!controller.isAudible)
        } label: {
            Label(controller.isAudible ? "Sound on" : "Silent",
                systemImage: controller.isAudible ? "speaker.wave.2" : "speaker.slash")
                .frame(minHeight: 44).contentShape(Rectangle())
        }.accessibilityIdentifier("practice-sound")
    }

    private func playOrPause() {
        if controller.snapshot.isRunning { controller.pause() }
        else if controller.snapshot.phase == .paused { controller.resume() }
        else { controller.play(countInBars: countInBars) }
    }
}
