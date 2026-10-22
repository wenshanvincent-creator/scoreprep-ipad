import ScoreCore
import SwiftUI

struct TimingEditor: View {
    let system: SourceSystem
    let onSave: ([TimingSegment]) throws -> Void
    @Environment(\.dismiss) private var dismiss
    @StateObject private var preview = TempoPreview()
    @State private var inputs: [TimingSegmentInput]
    @State private var errorMessage: String?

    init(system: SourceSystem, onSave: @escaping ([TimingSegment]) throws -> Void) {
        self.system = system
        self.onSave = onSave
        // Intentional one-time sheet draft; saving preserves the whole array.
        let segments = system.timing ?? [TimingSegment(
            quarterBeats: 16, meter: TimeSignature(numerator: 4, denominator: 4),
            tempo: ReferenceTempo(bpm: 80))]
        _inputs = State(initialValue: segments.map(TimingSegmentInput.init))
    }

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    Text("Confirm the played duration of each part, including rests and held notes. Add a segment at each change of tempo or time signature.")
                        .font(.footnote).foregroundStyle(.secondary)
                }
                ForEach($inputs) { $input in
                    let index = inputs.firstIndex { $0.id == input.id }!
                    Section("Segment \(index + 1)") {
                        TimingSegmentFields(input: $input, index: index)
                        segmentActions(input, index: index)
                    }
                }
                Section {
                    Button("Add timing segment", systemImage: "plus") {
                        inputs.append(TimingSegmentInput(TimingSegment(
                            quarterBeats: 4, meter: TimeSignature(numerator: 4, denominator: 4),
                            tempo: ReferenceTempo(bpm: 80))))
                    }.accessibilityIdentifier("add-timing-segment")
                    if preview.isPlaying {
                        Button("Stop preview", systemImage: "stop.fill") { preview.stop() }
                    }
                }
                Section("Calculated duration") {
                    if let segments = try? inputs.map({ try $0.segment() }) {
                        Text(segments.reduce(0) { $0 + $1.duration }
                            .formatted(.number.precision(.fractionLength(2))) + " seconds")
                            .font(.system(.title2, design: .rounded))
                            .accessibilityIdentifier("timing-total-duration")
                    } else {
                        Text("Complete every segment to calculate the duration.")
                            .foregroundStyle(.secondary)
                    }
                }
            }
            .navigationTitle("\(system.label) timing")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() } }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Save timing") {
                        do {
                            try onSave(inputs.map { try $0.segment() })
                            dismiss()
                        } catch { errorMessage = error.localizedDescription }
                    }.accessibilityIdentifier("save-timing")
                }
            }
            .alert("Could not use this timing", isPresented: Binding(
                get: { errorMessage != nil }, set: { if !$0 { errorMessage = nil } }
            )) { Button("OK") {} } message: { Text(errorMessage ?? "") }
        }
        .onChange(of: inputs) { _, _ in preview.stop() }
        .onDisappear { preview.stop() }
    }

    private func segmentActions(_ input: TimingSegmentInput, index: Int) -> some View {
        Menu("Segment actions", systemImage: "ellipsis.circle") {
            Button("Preview one bar", systemImage: "speaker.wave.2") {
                do {
                    let value = try input.segment()
                    try preview.play(meter: value.meter, tempo: value.tempo)
                } catch { errorMessage = error.localizedDescription }
            }
            Button("Move earlier", systemImage: "arrow.up") { inputs.swapAt(index, index - 1) }
                .disabled(index == 0)
            Button("Move later", systemImage: "arrow.down") { inputs.swapAt(index, index + 1) }
                .disabled(index == inputs.count - 1)
            Button("Remove segment", systemImage: "trash", role: .destructive) {
                inputs.removeAll { $0.id == input.id }
            }.disabled(inputs.count == 1)
        }.accessibilityIdentifier("timing-actions-\(index)")
    }
}

private struct TimingSegmentFields: View {
    @Binding var input: TimingSegmentInput
    let index: Int
    @Environment(\.dynamicTypeSize) private var dynamicTypeSize

    var body: some View {
        TimingNumberField(title: "Duration (quarter-note beats)", text: $input.quarterBeats,
            identifier: "timing-beats-\(index)")
        TimingNumberField(title: "Starting beat in bar", text: $input.startingBeatInBar,
            identifier: "timing-start-beat-\(index)")
        Text("Count from 1 using the written beat value: quarter notes in 4/4, eighth notes in 6/8. For an entrance on beat four, enter 4. Fractional beats are allowed.")
            .font(.footnote).foregroundStyle(.secondary)
        let layout = dynamicTypeSize.isAccessibilitySize
            ? AnyLayout(VStackLayout(alignment: .leading)) : AnyLayout(HStackLayout())
        layout {
            TimingNumberField(title: "Time signature top", text: $input.numerator,
                identifier: "timing-numerator-\(index)")
            TimingNumberField(title: "Time signature bottom", text: $input.denominator,
                identifier: "timing-denominator-\(index)")
        }
        TimingNumberField(title: "BPM", text: $input.bpm, identifier: "timing-bpm-\(index)")
        Picker("Tempo pulse", selection: $input.pulse) {
            ForEach(BeatUnit.allCases, id: \.self) { unit in Text(unit.label).tag(unit) }
        }.accessibilityIdentifier("timing-pulse-\(index)")
    }
}

private struct TimingNumberField: View {
    let title: String
    @Binding var text: String
    let identifier: String
    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(title).font(.subheadline)
            TextField(title, text: $text)
                .keyboardType(.decimalPad).textFieldStyle(.roundedBorder)
                .accessibilityLabel(title).accessibilityIdentifier(identifier)
        }
    }
}
