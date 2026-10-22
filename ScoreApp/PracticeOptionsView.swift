import ScoreCore
import SwiftUI

struct PracticeOptionsView: View {
    @ObservedObject var controller: PracticeController
    let project: ScoreProject
    @Binding var countInBars: Int
    @State private var firstSpanID: String
    @State private var lastSpanID: String
    @Environment(\.dismiss) private var dismiss

    init(controller: PracticeController, project: ScoreProject, countInBars: Binding<Int>) {
        self.controller = controller
        self.project = project
        _countInBars = countInBars
        _firstSpanID = State(initialValue: controller.loop?.firstSpanID ?? controller.currentSpan.id)
        _lastSpanID = State(initialValue: controller.loop?.lastSpanID ?? controller.timeline.spans.last!.id)
    }

    var body: some View {
        NavigationStack {
            Form {
                Section("Practice") {
                    Picker("Speed", selection: Binding(get: { controller.speed }, set: { controller.setSpeed($0) })) {
                        ForEach([0.25, 0.5, 0.75, 1.0, 1.25, 1.5, 2.0], id: \.self) { speed in
                            Text("\(Int(speed * 100))%").tag(speed)
                        }
                    }.accessibilityIdentifier("practice-options-speed")
                    Toggle("Audible clicks", isOn: Binding(get: { controller.isAudible }, set: { controller.setAudible($0) }))
                        .accessibilityIdentifier("practice-options-sound")
                }
                Section("Count-in for the next take") {
                    Picker("Count-in bars", selection: $countInBars) {
                        ForEach(0...4, id: \.self) { bars in
                            Text(bars == 0 ? "None" : "\(bars)").tag(bars)
                        }
                    }.accessibilityIdentifier("practice-count-in-bars")
                    Text("The count-in ends at the confirmed entrance phase. Resume continues without adding a new count-in.")
                        .font(.footnote).foregroundStyle(.secondary)
                }
                Section("System A–B loop") {
                    Picker("A · First system", selection: $firstSpanID) {
                        ForEach(controller.timeline.spans) { span in Text(label(span)).tag(span.id) }
                    }.accessibilityIdentifier("practice-loop-a")
                    Picker("B · Last system", selection: $lastSpanID) {
                        ForEach(controller.timeline.spans) { span in Text(label(span)).tag(span.id) }
                    }.accessibilityIdentifier("practice-loop-b")
                    Button("Use A–B loop") {
                        controller.dismissError()
                        controller.setLoop(PracticeLoop(firstSpanID: firstSpanID, lastSpanID: lastSpanID))
                        if controller.errorMessage == nil { dismiss() }
                    }.accessibilityIdentifier("practice-apply-loop")
                    if controller.loop != nil {
                        Button("Turn loop off") { controller.setLoop(nil); dismiss() }
                            .accessibilityIdentifier("practice-clear-loop")
                    }
                    Text("Both systems are included. Changing the loop pauses practice; Resume starts when you are ready.")
                        .font(.footnote).foregroundStyle(.secondary)
                }
                if let error = controller.errorMessage {
                    Section { Text(error).foregroundStyle(.red) }
                }
            }
            .navigationTitle("Practice options")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar { ToolbarItem(placement: .confirmationAction) { Button("Done") { dismiss() } } }
        }
    }

    private func label(_ span: TimelineSpan) -> String {
        let index = controller.timeline.spans.firstIndex { $0.id == span.id }! + 1
        let pass = project.readingOrder.firstIndex { $0.id == span.occurrenceID }! + 1
        let area = project.systems.first { $0.id == span.systemID }!
        return "\(index). \(area.label) · Pass \(pass)"
    }
}
