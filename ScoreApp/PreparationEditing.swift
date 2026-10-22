import Foundation
import ScoreCore

/// UI draft operations. Persistence and validation stay in ScorePreparation.
enum PreparationEditing {
    static func addArea(to draft: inout ScorePreparation, page: Int, sectionID: UUID) -> UUID {
        let number = draft.systems.filter { $0.pageIndex == page }.count + 1
        let area = SourceSystem(pageIndex: page, bounds: .fullPage, label: "Area \(number)")
        let insertion = draft.systems.lastIndex { $0.pageIndex == page }.map { $0 + 1 }
            ?? draft.systems.endIndex
        draft.systems.insert(area, at: insertion)
        if let index = draft.sections.firstIndex(where: { $0.id == sectionID }) {
            draft.sections[index].systemIDs.append(area.id)
        }
        return area.id
    }

    static func removeArea(_ id: UUID, from draft: inout ScorePreparation) {
        draft.systems.removeAll { $0.id == id }
        for index in draft.sections.indices {
            draft.sections[index].systemIDs.removeAll { $0 == id }
        }
    }

    static func setBounds(_ bounds: NormalizedRect, areaID: UUID, in draft: inout ScorePreparation) {
        guard let index = draft.systems.firstIndex(where: { $0.id == areaID }) else { return }
        if draft.systems[index].bounds != bounds {
            draft.systems[index].bounds = bounds
            draft.systems[index].timing = nil
        }
    }

    /// Page catalog/manual browsing order only. Musical section order and
    /// repeated memberships are changed explicitly in the reading-order editor.
    static func moveArea(_ id: UUID, by delta: Int, in draft: inout ScorePreparation) {
        guard let area = draft.systems.first(where: { $0.id == id }) else { return }
        let slots = draft.systems.indices.filter { draft.systems[$0].pageIndex == area.pageIndex }
        var areas = slots.map { draft.systems[$0] }
        guard let index = areas.firstIndex(where: { $0.id == id }),
              areas.indices.contains(index + delta) else { return }
        areas.swapAt(index, index + delta)
        for (slot, value) in zip(slots, areas) { draft.systems[slot] = value }

    }

    static func removeSection(_ id: UUID, from draft: inout ScorePreparation) {
        draft.sections.removeAll { $0.id == id }
        draft.readingOrder.removeAll { $0.sectionID == id }
    }
}

/// Memberships can repeat the same source ID; each editable list row still
/// needs its own identity for native move/delete operations within this sheet.
struct PreparationMember: Identifiable {
    let id = UUID()
    let systemID: UUID
}

struct TimingSegmentInput: Identifiable, Equatable {
    let id = UUID()
    var quarterBeats: String
    var startingBeatInBar: String
    private let original: TimingSegment
    private let originalStartingBeat: String
    var numerator: String
    var denominator: String
    var bpm: String
    var pulse: BeatUnit

    init(_ segment: TimingSegment) {
        quarterBeats = String(segment.quarterBeats)
        original = segment
        let beat = String(1 + segment.startingBarPhase * Double(segment.meter.denominator) / 4)
        originalStartingBeat = beat
        startingBeatInBar = beat
        numerator = String(segment.meter.numerator)
        denominator = String(segment.meter.denominator)
        bpm = String(segment.tempo.bpm)
        pulse = segment.tempo.pulse
    }

    func segment() throws -> TimingSegment {
        guard let numerator = Int(numerator.trimmingCharacters(in: .whitespacesAndNewlines)),
              let denominator = Int(denominator.trimmingCharacters(in: .whitespacesAndNewlines)) else {
            throw TimingError.invalidMeter
        }
        // Preserve untouched Core phase exactly, including values whose one-based
        // display conversion cannot round-trip through binary floating point.
        let phase: Double
        if startingBeatInBar == originalStartingBeat, denominator == original.meter.denominator {
            phase = original.startingBarPhase
        } else {
            phase = try (number(startingBeatInBar, field: "starting beat") - 1) * 4 / Double(denominator)
        }
        let value = try TimingSegment(
            quarterBeats: number(quarterBeats, field: "duration"),
            meter: TimeSignature(numerator: numerator, denominator: denominator),
            tempo: ReferenceTempo(bpm: number(bpm, field: "BPM"), pulse: pulse),
            startingBarPhase: phase
        )
        try value.validate()
        return value
    }

    private func number(_ text: String, field: String) throws -> Double {
        let normalized = text.trimmingCharacters(in: .whitespacesAndNewlines)
            .replacingOccurrences(of: Locale.current.decimalSeparator ?? ".", with: ".")
        guard let value = Double(normalized), value.isFinite else {
            throw TimingInputError.invalidNumber(field)
        }
        return value
    }
}

enum TimingInputError: LocalizedError {
    case invalidNumber(String)
    var errorDescription: String? {
        switch self {
        case .invalidNumber(let field): return "Enter a valid number for \(field)."
        }
    }
}
