import ScoreCore
import SwiftUI

/// Draws the controller's sampled pulse; this view has no clock or beat mapping.
struct PracticePulseIndicator: View {
    let display: PracticePulseDisplay?
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    var body: some View {
        HStack(spacing: 8) {
            ZStack {
                Circle().stroke(.secondary.opacity(0.25), lineWidth: 3)
                if let display {
                    if !reduceMotion {
                        Circle().trim(from: 0, to: display.progress)
                            .stroke(accent, style: StrokeStyle(lineWidth: 3, lineCap: .round))
                            .rotationEffect(.degrees(-90))
                    }
                    if display.pulse.isDownbeat {
                        Circle().fill(accent).padding(7)
                    } else {
                        Circle().stroke(accent, lineWidth: 2).padding(7)
                    }
                }
            }
            .frame(width: 28, height: 28).accessibilityHidden(true)
            Text(beatLabel).font(.subheadline).monospacedDigit()
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("Metronome beat")
        .accessibilityValue(accessibilityValue)
        .accessibilityIdentifier("practice-pulse")
    }

    private var accent: Color {
        display?.pulse.isDownbeat == true
            ? Color(red: 0.835, green: 0.608, blue: 0.176) : .accentColor
    }

    private var beatLabel: String {
        guard let display else { return "Beat —" }
        return "Beat \(display.pulse.beatInBar.formatted(.number.precision(.fractionLength(0...3))))"
    }

    private var accessibilityValue: String {
        guard let display else { return "Inactive" }
        let prefix = display.pulse.isCountIn ? "Count-in, " : ""
        return prefix + beatLabel + (display.pulse.isDownbeat ? ", downbeat" : "")
    }
}
