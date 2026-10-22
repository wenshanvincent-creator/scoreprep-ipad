import ScoreCore
import SwiftUI

struct TimingEditor: View {
    let system: SourceSystem
    let onSave: (TimingSegment) throws -> Void
    @Environment(\.dismiss) private var dismiss
    @StateObject private var preview = TempoPreview()
    @State private var bars: Int
    @State private var numerator: Int
    @State private var denominator: Int
    @State private var bpm: Double
    @State private var pulse: BeatUnit
    @State private var errorMessage: String?

    init(system: SourceSystem, onSave: @escaping (TimingSegment) throws -> Void) {
        self.system = system
        self.onSave = onSave
        let existing = system.timing?.first
        let meter = existing?.meter ?? TimeSignature(numerator: 4, denominator: 4)
        _numerator = State(initialValue: meter.numerator)
        _denominator = State(initialValue: meter.denominator)
        _bpm = State(initialValue: existing?.tempo.bpm ?? 80)
        _pulse = State(initialValue: existing?.tempo.pulse ?? .quarter)
        _bars = State(initialValue: max(
            1, Int(((existing?.quarterBeats ?? 16) / meter.quarterBeatsPerBar).rounded())
        ))
    }

    private var segment: TimingSegment {
        let meter = TimeSignature(numerator: numerator, denominator: denominator)
        return TimingSegment(
            quarterBeats: Double(bars) * meter.quarterBeatsPerBar,
            meter: meter, tempo: ReferenceTempo(bpm: bpm, pulse: pulse)
        )
    }

    var body: some View {
        NavigationStack {
            Form {
                Section("Bars in this reading area") {
                    Stepper("Bars: \(bars)", value: $bars, in: 1...64)
                    Text("Count the bars in the displayed area before saving.")
                        .font(.footnote)
                        .foregroundStyle(.secondary)
                }
                Section("Time signature") {
                    Stepper("Beats: \(numerator)", value: $numerator, in: 1...16)
                    Picker("Beat denominator", selection: $denominator) {
                        ForEach([2, 4, 8, 16], id: \.self) { value in
                            Text("\(value)").tag(value)
                        }
                    }
                }
                Section("Tempo") {
                    Stepper(
                        "BPM: \(Int(bpm))",
                        value: $bpm, in: 20...240, step: 1
                    )
                    Picker("Tempo beat", selection: $pulse) {
                        ForEach(BeatUnit.allCases, id: \.self) { unit in
                            Text(unit.label).tag(unit)
                        }
                    }
                    Button(
                        preview.isPlaying ? "Stop preview" : "Preview one bar",
                        systemImage: preview.isPlaying ? "stop.fill" : "speaker.wave.2"
                    ) {
                        do {
                            if preview.isPlaying {
                                preview.stop()
                            } else {
                                try preview.play(meter: segment.meter, tempo: segment.tempo)
                            }
                        } catch {
                            errorMessage = error.localizedDescription
                        }
                    }
                }
                Section("Calculated duration") {
                    Text(segment.duration.formatted(.number.precision(.fractionLength(1))) + " seconds")
                        .font(.system(.title2, design: .rounded))
                    Text("Rests and held notes count toward the line's duration.")
                        .foregroundStyle(.secondary)
                }
            }
            .navigationTitle("\(system.label) timing")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Save timing") {
                        do {
                            try onSave(segment)
                            dismiss()
                        } catch {
                            errorMessage = error.localizedDescription
                        }
                    }
                    .accessibilityIdentifier("save-timing")
                }
            }
            .alert(
                "Could not use this timing",
                isPresented: Binding(
                    get: { errorMessage != nil },
                    set: { if !$0 { errorMessage = nil } }
                )
            ) {
                Button("OK") { errorMessage = nil }
            } message: {
                Text(errorMessage ?? "")
            }
        }
        .onDisappear { preview.stop() }
    }
}
