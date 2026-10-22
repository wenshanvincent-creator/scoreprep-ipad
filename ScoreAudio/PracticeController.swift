import AVFoundation
import Combine
import ScoreCore
import UIKit

public enum PracticePauseReason: Equatable, Sendable {
    case interruption, outputChanged, audioConfigurationChanged, background, mediaServicesReset

    public var message: String {
        switch self {
        case .interruption: return "Practice paused for an audio interruption. Resume when ready."
        case .outputChanged: return "The audio output changed. Check the output, then resume when ready."
        case .audioConfigurationChanged: return "The audio configuration changed. Resume when ready."
        case .background: return "Practice paused when the app moved to the background."
        case .mediaServicesReset: return "The audio service restarted. Resume when ready."
        }
    }
}

/// One host-clock transport drives occurrence focus and scheduled native clicks.
/// The view observes this object; it does not maintain another playback timer.
@MainActor
public final class PracticeController: ObservableObject {
    public let timeline: CompiledTimeline
    @Published public private(set) var snapshot: PracticeSnapshot
    @Published public private(set) var isAudible = true
    @Published public private(set) var errorMessage: String?
    @Published public private(set) var pauseReason: PracticePauseReason?

    public var currentSpan: TimelineSpan { timeline.spans[snapshot.currentSpanIndex] }
    public var upcomingSpan: TimelineSpan? { snapshot.upcomingSpanIndex.map { timeline.spans[$0] } }
    public var speed: Double { transport.speed }
    public var loop: PracticeLoop? { transport.loop }

    private var transport: PracticeTransport
    private let planner: PracticePulsePlanner
    private var schedule = PracticePulseSchedule()
    private let output: PracticeClickOutput
    private let hostNow: () -> Double
    private var updates: Task<Void, Never>?
    private var observers: [NSObjectProtocol] = []

    public convenience init(timeline: CompiledTimeline) {
        self.init(timeline: timeline, output: NativePracticeClickOutput(), hostNow: {
            AVAudioTime.seconds(forHostTime: mach_absolute_time())
        })
    }

    init(timeline: CompiledTimeline, output: PracticeClickOutput, hostNow: @escaping () -> Double) {
        self.timeline = timeline
        transport = PracticeTransport(timeline: timeline)
        planner = PracticePulsePlanner(timeline: timeline)
        snapshot = transport.snapshot(at: hostNow())
        self.output = output
        self.hostNow = hostNow
        observeSystemEvents()
    }

    deinit {
        updates?.cancel()
        for observer in observers { NotificationCenter.default.removeObserver(observer) }
    }

    /// Starts a new take at the cursor (or the beginning after finishing).
    /// Resume preserves an existing take and never adds a new count-in.
    public func play(countInBars: Int = 1) {
        let now = hostNow()
        var next = transport
        do {
            try next.start(at: now, countInBars: countInBars)
            next.pause(at: now)
            transport = next
            cancelQueuedPlayback()
            beginRunning()
        } catch { errorMessage = error.localizedDescription }
    }

    public func pause() {
        transport.pause(at: hostNow())
        cancelQueuedPlayback()
        pauseReason = nil
        publish()
    }

    public func resume() {
        guard snapshot.phase == .paused else { return }
        cancelQueuedPlayback()
        beginRunning()
    }

    public func stop() {
        transport.stop()
        cancelQueuedPlayback()
        pauseReason = nil
        publish()
    }

    public func setSpeed(_ value: Double) {
        let now = hostNow()
        let wasRunning = transport.snapshot(at: now).isRunning
        var next = transport
        do {
            try next.setSpeed(value, at: now)
            if wasRunning { next.pause(at: now) }
            transport = next
            cancelQueuedPlayback()
            if wasRunning { beginRunning() } else { publish() }
        } catch { errorMessage = error.localizedDescription }
    }

    public func setAudible(_ value: Bool) {
        guard value != isAudible else { return }
        let now = hostNow()
        let wasRunning = transport.snapshot(at: now).isRunning
        if wasRunning { transport.pause(at: now) }
        cancelQueuedPlayback()
        isAudible = value
        if wasRunning { beginRunning() } else { publish() }
    }

    /// Uses TimelineSpan.id, not SourceSystem.id. Seeking always pauses.
    public func seek(to spanID: String) {
        var next = transport
        do {
            try next.seek(to: spanID, at: hostNow())
            transport = next
            cancelQueuedPlayback()
            pauseReason = nil
            publish()
        } catch { errorMessage = error.localizedDescription }
    }

    /// Inclusive first/last occurrence boundaries. Changing A-B always pauses.
    public func setLoop(_ value: PracticeLoop?) {
        var next = transport
        do {
            try next.setLoop(value, at: hostNow())
            transport = next
            cancelQueuedPlayback()
            pauseReason = nil
            publish()
        } catch { errorMessage = error.localizedDescription }
    }

    public func dismissError() { errorMessage = nil }

    /// Samples the shared clock; useful immediately before a view consumes focus.
    /// A short wakeup also calls this while running, without accumulating time.
    public func refresh() {
        let now = hostNow()
        snapshot = transport.snapshot(at: now)
        if snapshot.phase == .finished {
            transport.pause(at: now)
            cancelQueuedPlayback()
            return
        }
        guard snapshot.isRunning, isAudible else { return }
        do {
            for event in schedule.upcoming(transport: transport, planner: planner, at: now, lookahead: 0.25) {
                try output.schedule(event)
            }
        } catch { failAudio(error) }
    }

    private func beginRunning() {
        errorMessage = nil
        pauseReason = nil
        do {
            if isAudible { try output.prepare() }
            // Preparation finishes before establishing the common anchor. This
            // lead belongs to that anchor, not to an independent display delay.
            transport.resume(at: hostNow() + (isAudible ? 0.06 : 0))
            schedule.reset(at: transport.snapshot(at: hostNow()).elapsed)
            refresh()
            guard snapshot.isRunning else { return }
            updates = Task { @MainActor [weak self] in
                while !Task.isCancelled {
                    do { try await Task.sleep(nanoseconds: 33_333_333) } catch { return }
                    guard !Task.isCancelled, let self else { return }
                    self.refresh()
                }
            }
        } catch { failAudio(error) }
    }

    private func cancelQueuedPlayback() {
        updates?.cancel()
        updates = nil
        schedule.reset(at: transport.snapshot(at: hostNow()).elapsed)
        output.stop()
    }

    private func publish() { snapshot = transport.snapshot(at: hostNow()) }

    private func failAudio(_ error: Error) {
        transport.pause(at: hostNow())
        cancelQueuedPlayback()
        errorMessage = error.localizedDescription
        publish()
    }

    func suspend(for reason: PracticePauseReason) {
        guard transport.snapshot(at: hostNow()).isRunning else { return }
        transport.pause(at: hostNow())
        cancelQueuedPlayback()
        pauseReason = reason
        publish()
    }

    private func observeSystemEvents() {
        observe(AVAudioSession.interruptionNotification) { controller, notification in
            if let raw = notification.userInfo?[AVAudioSessionInterruptionTypeKey] as? UInt,
               AVAudioSession.InterruptionType(rawValue: raw) == .began {
                controller.suspend(for: .interruption)
            }
            // End/shouldResume is deliberately not an automatic resume command.
        }
        observe(AVAudioSession.routeChangeNotification) { controller, notification in
            if let raw = notification.userInfo?[AVAudioSessionRouteChangeReasonKey] as? UInt,
               AVAudioSession.RouteChangeReason(rawValue: raw) == .oldDeviceUnavailable {
                controller.suspend(for: .outputChanged)
            }
        }
        observe(.AVAudioEngineConfigurationChange) { controller, notification in
            if let engine = controller.output.engine, notification.object as AnyObject? === engine {
                controller.suspend(for: .audioConfigurationChanged)
            }
        }
        observe(AVAudioSession.mediaServicesWereResetNotification) { controller, _ in
            controller.suspend(for: .mediaServicesReset)
        }
        observe(UIApplication.didEnterBackgroundNotification) { controller, _ in
            controller.suspend(for: .background)
        }
    }

    private func observe(_ name: Notification.Name,
                         handler: @escaping @MainActor (PracticeController, Notification) -> Void) {
        observers.append(NotificationCenter.default.addObserver(forName: name, object: nil, queue: .main) {
            [weak self] notification in
            MainActor.assumeIsolated {
                if let self { handler(self, notification) }
            }
        })
    }
}
