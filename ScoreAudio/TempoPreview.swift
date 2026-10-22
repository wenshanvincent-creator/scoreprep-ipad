import AVFoundation
import Combine
import ScoreCore

@MainActor
final class TempoPreview: ObservableObject {
    @Published private(set) var isPlaying = false
    private let engine = AVAudioEngine()
    private let player = AVAudioPlayerNode()
    private var playbackID = UUID()

    init() {
        engine.attach(player)
    }

    func play(meter: TimeSignature, tempo: ReferenceTempo) throws {
        let segment = TimingSegment(
            quarterBeats: meter.quarterBeatsPerBar, meter: meter, tempo: tempo
        )
        try segment.validate()
        stop()
        try AVAudioSession.sharedInstance().setCategory(
            .playback, mode: .default, options: [.mixWithOthers]
        )
        try AVAudioSession.sharedInstance().setActive(true)

        let sampleRate = 44_100.0
        let frameCount = AVAudioFrameCount(ceil(segment.duration * sampleRate))
        guard let format = AVAudioFormat(
            standardFormatWithSampleRate: sampleRate, channels: 1
        ), let buffer = AVAudioPCMBuffer(
            pcmFormat: format, frameCapacity: frameCount
        ), let samples = buffer.floatChannelData?[0] else {
            throw PreviewError.couldNotCreateBuffer
        }
        buffer.frameLength = frameCount
        for index in 0..<Int(frameCount) { samples[index] = 0 }
        let pulseSeconds = 60 / tempo.bpm
        let pulseCount = Int(ceil(meter.quarterBeatsPerBar / tempo.pulse.quarterBeats))
        let clickFrames = Int(sampleRate * 0.025)
        for pulse in 0..<pulseCount {
            let start = Int(Double(pulse) * pulseSeconds * sampleRate)
            let frequency = pulse == 0 ? 1_200.0 : 850.0
            for frame in 0..<clickFrames where start + frame < Int(frameCount) {
                let time = Double(frame) / sampleRate
                samples[start + frame] += Float(
                    sin(2 * .pi * frequency * time) * exp(-time * 180) * 0.35
                )
            }
        }
        engine.disconnectNodeOutput(player)
        engine.connect(player, to: engine.mainMixerNode, format: format)
        try engine.start()
        let id = UUID()
        playbackID = id
        player.scheduleBuffer(buffer, completionCallbackType: .dataPlayedBack) {
            [weak self] _ in
            Task { @MainActor in
                if self?.playbackID == id { self?.stop() }
            }
        }
        isPlaying = true
        player.play()
    }

    func stop() {
        playbackID = UUID()
        player.stop()
        engine.stop()
        isPlaying = false
    }

    private enum PreviewError: LocalizedError {
        case couldNotCreateBuffer
        var errorDescription: String? { "The tempo preview could not be prepared." }
    }
}
