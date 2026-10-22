import AVFoundation
import ScoreCore

@MainActor
protocol PracticeClickOutput: AnyObject {
    var engine: AVAudioEngine? { get }
    func prepare() throws
    func schedule(_ event: ScheduledPracticePulse) throws
    func stop()
}

enum PracticeAudioError: LocalizedError {
    case noOutput, bufferUnavailable, engineStopped

    var errorDescription: String? {
        switch self {
        case .noOutput: return "No audio output is available. You can continue reading or use silent practice."
        case .bufferUnavailable: return "The metronome sound could not be prepared."
        case .engineStopped: return "Audio output stopped. Resume when an output is available, or use silent practice."
        }
    }
}

@MainActor
final class NativePracticeClickOutput: PracticeClickOutput {
    private(set) var engine: AVAudioEngine?
    private var player: AVAudioPlayerNode?
    private var regular: AVAudioPCMBuffer?
    private var downbeat: AVAudioPCMBuffer?

    deinit {
        player?.stop()
        engine?.stop()
    }

    func prepare() throws {
        let session = AVAudioSession.sharedInstance()
        try session.setCategory(.playback, mode: .default, options: [.mixWithOthers])
        try session.setActive(true)
        let engine = AVAudioEngine()
        let player = AVAudioPlayerNode()
        self.engine = engine
        self.player = player
        engine.attach(player)
        let output = engine.outputNode.outputFormat(forBus: 0)
        guard output.sampleRate > 0, output.channelCount > 0,
              let format = AVAudioFormat(standardFormatWithSampleRate: output.sampleRate,
                                         channels: output.channelCount) else {
            throw PracticeAudioError.noOutput
        }
        regular = try Self.makeClick(format: format, downbeat: false)
        downbeat = try Self.makeClick(format: format, downbeat: true)
        engine.connect(player, to: engine.mainMixerNode, format: format)
        engine.prepare()
        try engine.start()
        player.play()
    }

    func schedule(_ event: ScheduledPracticePulse) throws {
        guard let engine, engine.isRunning, let player, player.isPlaying else {
            throw PracticeAudioError.engineStopped
        }
        guard let buffer = event.pulse.isDownbeat ? downbeat : regular else {
            throw PracticeAudioError.bufferUnavailable
        }
        // A main-thread stall must not turn already missed beats into a burst.
        guard event.hostTime >= AVAudioTime.seconds(forHostTime: mach_absolute_time()) else { return }
        // Host-only AVAudioTime: no player sample-time clock and no nil-time
        // concatenation. No completion callback can alter a later generation.
        player.scheduleBuffer(buffer, at: AVAudioTime(hostTime: AVAudioTime.hostTime(forSeconds: event.hostTime)),
                              options: [], completionHandler: nil)
    }

    func stop() {
        player?.stop()
        engine?.stop()
        player = nil
        engine = nil
        regular = nil
        downbeat = nil
    }

    static func makeClick(format: AVAudioFormat, downbeat: Bool) throws -> AVAudioPCMBuffer {
        let frames = AVAudioFrameCount(ceil(format.sampleRate * 0.025))
        guard let buffer = AVAudioPCMBuffer(pcmFormat: format, frameCapacity: frames),
              let channels = buffer.floatChannelData else { throw PracticeAudioError.bufferUnavailable }
        buffer.frameLength = frames
        let frequency = downbeat ? 1_200.0 : 850.0
        for frame in 0..<Int(frames) {
            let time = Double(frame) / format.sampleRate
            let sample = Float(sin(2 * .pi * frequency * time) * exp(-time * 180) * 0.35)
            for channel in 0..<Int(format.channelCount) { channels[channel][frame] = sample }
        }
        return buffer
    }
}
