import AVFoundation
import Darwin
import ScoreCore
import UIKit
import XCTest
@testable import ScorePrep

final class PracticeAudioTests: XCTestCase {
    @MainActor
    func testControllerCancelsGenerationsAndResumesTheSameCountInPosition() throws {
        let clock = TestHostClock(10)
        let output = TestClickOutput()
        let controller = PracticeController(timeline: try timeline(), output: output, hostNow: { clock.now })
        defer { controller.stop() }
        controller.play(countInBars: 1)
        let first = try XCTUnwrap(output.queued.first)
        XCTAssertEqual(first.hostTime, 10.06, accuracy: 1e-9)
        XCTAssertNil(controller.currentPulse) // The common startup anchor is still in the future.
        clock.now = 11.56
        controller.refresh()
        XCTAssertEqual(controller.snapshot.elapsed, 1.5, accuracy: 1e-9)
        XCTAssertEqual(try XCTUnwrap(controller.currentPulse).progress, 0.5, accuracy: 1e-9)
        controller.pause()
        XCTAssertTrue(output.queued.isEmpty)
        XCTAssertEqual(controller.snapshot.phase, .paused)
        let stopped = controller.snapshot
        clock.now = 50
        controller.refresh()
        XCTAssertEqual(controller.snapshot, stopped)
        controller.resume()
        clock.now = 50.4
        controller.refresh()
        let resumed = try XCTUnwrap(output.queued.first)
        XCTAssertEqual(resumed.pulse.elapsed, 2)
        XCTAssertEqual(resumed.hostTime, 50.56, accuracy: 1e-9)
        XCTAssertNotEqual(first.id.generation, resumed.id.generation)
        let position = controller.snapshot.referencePosition
        controller.setSpeed(2)
        XCTAssertEqual(controller.snapshot.referencePosition, position)
        XCTAssertTrue(output.queued.allSatisfy { $0.id.generation != resumed.id.generation })
        XCTAssertEqual(try XCTUnwrap(output.queued.first).hostTime, 50.54, accuracy: 1e-9)
        controller.setLoop(.init(firstSpanID: controller.timeline.spans[0].id,
                                 lastSpanID: controller.timeline.spans[1].id))
        XCTAssertNotNil(controller.loop)
        XCTAssertEqual(controller.snapshot.phase, .paused)
        controller.seek(to: controller.timeline.spans[2].id)
        XCTAssertEqual(controller.currentSpan.id, controller.timeline.spans[2].id)
        XCTAssertEqual(controller.snapshot.phase, .paused)
        XCTAssertTrue(output.queued.isEmpty)
        XCTAssertNil(controller.loop)
        controller.setAudible(false)
        controller.resume()
        clock.now += 0.25
        controller.refresh()
        XCTAssertFalse(controller.isAudible)
        XCTAssertNotNil(controller.currentPulse)
        XCTAssertTrue(output.queued.isEmpty)
        clock.now += 2
        controller.refresh()
        XCTAssertEqual(controller.snapshot.phase, .finished)
        XCTAssertNil(controller.upcomingSpan)
        XCTAssertNil(controller.currentPulse)
    }

    @MainActor
    func testSystemEventsPauseWithoutAutomaticResumeAndAudioErrorsRetainManualReading() throws {
        let clock = TestHostClock(10)
        let output = TestClickOutput()
        let controller = PracticeController(timeline: try timeline(), output: output, hostNow: { clock.now })
        defer { controller.stop() }
        controller.play(countInBars: 0)
        clock.now = 10.2
        NotificationCenter.default.post(name: AVAudioSession.interruptionNotification, object: nil,
            userInfo: [AVAudioSessionInterruptionTypeKey: AVAudioSession.InterruptionType.began.rawValue])
        XCTAssertEqual(controller.snapshot.phase, .paused)
        XCTAssertEqual(controller.pauseReason, .interruption)
        XCTAssertTrue(output.queued.isEmpty)
        NotificationCenter.default.post(name: AVAudioSession.interruptionNotification, object: nil,
            userInfo: [AVAudioSessionInterruptionTypeKey: AVAudioSession.InterruptionType.ended.rawValue,
                       AVAudioSessionInterruptionOptionKey: AVAudioSession.InterruptionOptions.shouldResume.rawValue])
        XCTAssertEqual(controller.snapshot.phase, .paused)
        controller.resume()
        clock.now += 0.2
        NotificationCenter.default.post(name: AVAudioSession.routeChangeNotification, object: nil,
            userInfo: [AVAudioSessionRouteChangeReasonKey: AVAudioSession.RouteChangeReason.oldDeviceUnavailable.rawValue])
        XCTAssertEqual(controller.pauseReason, .outputChanged)
        XCTAssertTrue(output.queued.isEmpty)
        controller.resume()
        clock.now += 0.2
        NotificationCenter.default.post(name: UIApplication.didEnterBackgroundNotification, object: nil)
        XCTAssertEqual(controller.snapshot.phase, .paused)
        XCTAssertEqual(controller.pauseReason, .background)
        XCTAssertTrue(output.queued.isEmpty)
        output.preparationError = PracticeAudioError.noOutput
        controller.resume()
        XCTAssertNotNil(controller.errorMessage)
        XCTAssertEqual(controller.snapshot.phase, .paused)
        controller.seek(to: controller.timeline.spans[1].id)
        XCTAssertEqual(controller.currentSpan.id, controller.timeline.spans[1].id)
        controller.setAudible(false)
        controller.resume()
        XCTAssertEqual(controller.snapshot.phase, .playing)
        XCTAssertNil(controller.errorMessage)
    }

    @MainActor
    func testLiveMixerPCMMatchesHostScheduledClicksAndPauseCancelsPendingSound() async throws {
        let output = RecordingClickOutput()
        let now = { AVAudioTime.seconds(forHostTime: mach_absolute_time()) }
        let controller = PracticeController(timeline: try timeline(), output: output, hostNow: now)
        defer { controller.stop() }
        controller.setSpeed(2)
        controller.play(countInBars: 1)
        if let error = controller.errorMessage {
            attachJSON(["mode": "live-device-rendering-unavailable", "error": error], name: "practice-live-audio-limitation")
            throw XCTSkip("Live simulator output unavailable: \(error). Offline rendering is checked separately.")
        }
        let firstGeneration = try XCTUnwrap(output.events.first?.id.generation)
        try await Task.sleep(nanoseconds: 2_400_000_000)
        let pausedAt = now()
        let pending = output.events.filter { $0.id.generation == firstGeneration && $0.hostTime > pausedAt + 0.03 }
        controller.pause()
        let cursor = controller.snapshot.referencePosition
        XCTAssertFalse(pending.isEmpty, "The cancellation check needs an actually queued future click")
        try await Task.sleep(nanoseconds: 700_000_000)
        controller.refresh()
        XCTAssertEqual(controller.snapshot.referencePosition, cursor, accuracy: 1e-9)
        let resumedAt = now()
        controller.resume()
        let deadline = now() + 10
        while controller.snapshot.phase != .finished, now() < deadline {
            try await Task.sleep(nanoseconds: 50_000_000)
            controller.refresh()
        }
        XCTAssertNil(controller.errorMessage)
        XCTAssertEqual(controller.snapshot.phase, .finished)
        let chunks = output.recording.chunks()
        guard !chunks.isEmpty, chunks.allSatisfy({ $0.hostTime != nil }) else {
            attachJSON(["mode": "live-device-rendering-unavailable", "chunks": chunks.count,
                        "validHostTimestamps": chunks.filter { $0.hostTime != nil }.count], name: "practice-live-audio-limitation")
            throw XCTSkip("Simulator mixer supplied no host-timestamped PCM. Offline rendering is checked separately.")
        }
        let onsets = chunks.flatMap { chunk -> [Double] in
            let start = chunk.hostTime!
            return chunk.samples.enumerated().compactMap { abs($0.element) > 0.02 ? start + Double($0.offset) / chunk.rate : nil }
        }.sorted().reduce(into: [Double]()) { result, time in
            if result.last.map({ time - $0 > 0.08 }) ?? true { result.append(time) }
        }
        let expected = output.events.filter { $0.id.generation != firstGeneration || $0.hostTime < pausedAt }
        attachJSON([
            "mode": "simulator-live-mixer-output", "speed": 2, "countInBars": 1,
            "pausedAtHostSeconds": pausedAt, "resumedAtHostSeconds": resumedAt,
            "pendingCanceledHostSeconds": pending.map(\.hostTime), "observedOnsetHostSeconds": onsets,
            "scheduled": output.events.map { ["generation": $0.id.generation, "elapsed": $0.pulse.elapsed,
                                              "hostSeconds": $0.hostTime, "countIn": $0.pulse.isCountIn] as [String: Any] },
            "boundary": "App mixer PCM and host scheduling; no microphone, speaker, Bluetooth or musician proof."
        ], name: "practice-live-mixer-receipt")
        attachWAV(chunks, name: "practice-live-mixer-with-pause")
        XCTAssertEqual(expected.count, 16)
        XCTAssertEqual(onsets.count, expected.count)
        for (observed, event) in zip(onsets, expected) {
            XCTAssertEqual(observed, event.hostTime, accuracy: 0.04,
                           "Mixer onset differs from the shared host-clock event")
        }
        XCTAssertTrue(onsets.allSatisfy { $0 < pausedAt + 0.05 || $0 >= resumedAt },
                      "Cleared lookahead events must not sound during the pause")
    }

    @MainActor
    func testNativeOfflineClickRenderingAndQueuedCancellation() throws {
        let engine = AVAudioEngine()
        let player = AVAudioPlayerNode()
        engine.attach(player)
        let format = try XCTUnwrap(AVAudioFormat(standardFormatWithSampleRate: 44_100, channels: 1))
        engine.connect(player, to: engine.mainMixerNode, format: format)
        try engine.enableManualRenderingMode(.offline, format: format, maximumFrameCount: 512)
        let regular = try NativePracticeClickOutput.makeClick(format: format, downbeat: false)
        let accent = try NativePracticeClickOutput.makeClick(format: format, downbeat: true)
        for (index, sample) in [0, 11_025, 22_050].enumerated() {
            player.scheduleBuffer(index == 0 ? accent : regular,
                                  at: AVAudioTime(sampleTime: AVAudioFramePosition(sample), atRate: format.sampleRate),
                                  options: [], completionHandler: nil)
        }
        try engine.start()
        player.play()
        defer { player.stop(); engine.stop() }
        let buffer = try XCTUnwrap(AVAudioPCMBuffer(pcmFormat: format, frameCapacity: 512))
        var samples: [Float] = []
        func render(until end: AVAudioFramePosition) throws {
            while engine.manualRenderingSampleTime < end {
                let count = AVAudioFrameCount(min(512, end - engine.manualRenderingSampleTime))
                let status = try engine.renderOffline(count, to: buffer)
                guard status == .success else {
                    XCTFail("Offline audio rendering returned \(status)")
                    throw PracticeAudioError.engineStopped
                }
                let channel = try XCTUnwrap(buffer.floatChannelData?[0])
                samples.append(contentsOf: UnsafeBufferPointer(start: channel, count: Int(buffer.frameLength)))
            }
        }
        try render(until: 15_435) // 0.35 s: the first two clicks have rendered.
        player.stop()             // The third click at 0.5 s is still queued.
        try render(until: 33_075)
        let onsets = samples.enumerated().filter { abs($0.element) > 0.02 }.map { Double($0.offset) / 44_100 }
            .reduce(into: [Double]()) { result, time in
                if result.last.map({ time - $0 > 0.08 }) ?? true { result.append(time) }
            }
        attachJSON(["mode": "native-offline-rendering", "onsetSeconds": onsets,
                    "stopSeconds": 0.35, "canceledClickSeconds": 0.5,
                    "boundary": "Native PCM and stop cancellation; offline sample time is not live host-clock evidence."],
                   name: "practice-offline-receipt")
        attachWAV([CapturedAudioChunk(hostTime: 0, rate: 44_100, samples: samples)], name: "practice-offline-cancellation")
        XCTAssertEqual(onsets.count, 2)
        XCTAssertEqual(try XCTUnwrap(onsets.first), 0, accuracy: 0.005)
        XCTAssertEqual(try XCTUnwrap(onsets.last), 0.25, accuracy: 0.005)
        XCTAssertTrue(samples.dropFirst(15_435).allSatisfy { abs($0) < 0.001 })
    }

    private func timeline() throws -> CompiledTimeline {
        let segments = [
            TimingSegment(quarterBeats: 5, meter: .init(numerator: 4, denominator: 4),
                          tempo: .init(bpm: 60), startingBarPhase: 3),
            TimingSegment(quarterBeats: 4, meter: .init(numerator: 4, denominator: 4), tempo: .init(bpm: 60)),
            TimingSegment(quarterBeats: 6, meter: .init(numerator: 6, denominator: 8),
                          tempo: .init(bpm: 60, pulse: .dottedQuarter))
        ]
        let systems = segments.enumerated().map {
            SourceSystem(pageIndex: 0, bounds: .fullPage, label: "Owned line \($0.offset + 1)", timing: [$0.element])
        }
        let section = ScoreSection(name: "Pickup and pulse", systemIDs: systems.map(\.id))
        return try TimelineCompiler.compile(ScoreProject(title: "Pickup and pulse", sourceFilename: "owned.png",
            systems: systems, sections: [section], readingOrder: [SectionOccurrence(sectionID: section.id)]))
    }

    private func attachJSON(_ value: [String: Any], name: String) {
        do {
            let attachment = XCTAttachment(data: try JSONSerialization.data(withJSONObject: value, options: [.prettyPrinted, .sortedKeys]),
                                           uniformTypeIdentifier: "public.json")
            attachment.name = name
            attachment.lifetime = .keepAlways
            add(attachment)
        } catch { XCTFail("Could not export audio evidence: \(error)") }
    }

    private func attachWAV(_ chunks: [CapturedAudioChunk], name: String) {
        guard let first = chunks.first, let start = first.hostTime,
              let last = chunks.last, let end = last.hostTime else { return }
        let rate = first.rate
        guard chunks.allSatisfy({ $0.rate == rate }) else { XCTFail("Audio sample rate changed during capture"); return }
        let frames = Int(ceil((end - start) * rate)) + last.samples.count
        var pcm = [Int16](repeating: 0, count: frames)
        for chunk in chunks {
            guard let time = chunk.hostTime else { continue }
            let offset = Int(((time - start) * rate).rounded())
            for (index, value) in chunk.samples.enumerated() where offset + index >= 0 && offset + index < frames {
                pcm[offset + index] = Int16(max(-1, min(1, value)) * 32_767)
            }
        }
        var data = Data()
        func word<T: FixedWidthInteger>(_ value: T) {
            var little = value.littleEndian
            withUnsafeBytes(of: &little) { data.append(contentsOf: $0) }
        }
        data.append(contentsOf: "RIFF".utf8); word(UInt32(36 + pcm.count * 2))
        data.append(contentsOf: "WAVEfmt ".utf8); word(UInt32(16)); word(UInt16(1)); word(UInt16(1))
        word(UInt32(rate)); word(UInt32(rate * 2)); word(UInt16(2)); word(UInt16(16))
        data.append(contentsOf: "data".utf8); word(UInt32(pcm.count * 2))
        for sample in pcm { word(sample) }
        let attachment = XCTAttachment(data: data, uniformTypeIdentifier: "com.microsoft.waveform-audio")
        attachment.name = name
        attachment.lifetime = .keepAlways
        add(attachment)
    }
}

private final class TestHostClock {
    var now: Double
    init(_ now: Double) { self.now = now }
}

@MainActor
private final class TestClickOutput: PracticeClickOutput {
    var engine: AVAudioEngine? { nil }
    var queued: [ScheduledPracticePulse] = []
    var preparationError: Error?
    func prepare() throws { if let preparationError { throw preparationError } }
    func schedule(_ event: ScheduledPracticePulse) { queued.append(event) }
    func stop() { queued.removeAll() }
}

private struct CapturedAudioChunk {
    let hostTime: Double?
    let rate: Double
    let samples: [Float]
}

private final class MixerRecording: @unchecked Sendable {
    private let lock = NSLock()
    private var captured: [CapturedAudioChunk] = []

    func append(_ buffer: AVAudioPCMBuffer, at time: AVAudioTime) {
        guard let channel = buffer.floatChannelData?[0] else { return }
        let samples = (0..<Int(buffer.frameLength)).map { channel[$0 * buffer.stride] }
        let chunk = CapturedAudioChunk(hostTime: time.isHostTimeValid ? AVAudioTime.seconds(forHostTime: time.hostTime) : nil,
                                       rate: buffer.format.sampleRate, samples: samples)
        lock.lock()
        captured.append(chunk)
        lock.unlock()
    }

    func chunks() -> [CapturedAudioChunk] {
        lock.lock()
        defer { lock.unlock() }
        return captured.sorted { ($0.hostTime ?? 0) < ($1.hostTime ?? 0) }
    }
}

@MainActor
private final class RecordingClickOutput: PracticeClickOutput {
    private let native = NativePracticeClickOutput()
    let recording = MixerRecording()
    var events: [ScheduledPracticePulse] = []
    var engine: AVAudioEngine? { native.engine }

    func prepare() throws {
        try native.prepare()
        let recording = recording
        native.engine!.mainMixerNode.installTap(onBus: 0, bufferSize: 256, format: nil) { buffer, time in
            recording.append(buffer, at: time)
        }
    }

    func schedule(_ event: ScheduledPracticePulse) throws {
        try native.schedule(event)
        events.append(event)
    }

    func stop() {
        native.engine?.mainMixerNode.removeTap(onBus: 0)
        native.stop()
    }
}
