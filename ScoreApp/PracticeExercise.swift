import Foundation
import ScoreCore

/// Preset timing belongs only to this composed exercise, never an imported score.
enum PracticeExercise {
    @MainActor
    static func install(into library: ScoreLibrary) async throws -> UUID {
        guard let source = Bundle.main.url(
            forResource: "pickup-and-pulse", withExtension: "png", subdirectory: "Practice"
        ) else { throw CocoaError(.fileNoSuchFile) }
        let projectID = try await library.importOriginal(from: source)
        guard let project = library.projects.first(where: { $0.id == projectID }) else {
            throw LibraryError.missingProject
        }
        var draft = ScorePreparation(project: project)
        let areas = [
            SourceSystem(id: project.systems[0].id, pageIndex: 0,
                         bounds: .init(x: 0.02, y: 0.10, width: 0.96, height: 0.25),
                         label: "Pickup and bar 1"),
            SourceSystem(pageIndex: 0,
                         bounds: .init(x: 0.02, y: 0.38, width: 0.96, height: 0.26),
                         label: "Bar 2"),
            SourceSystem(pageIndex: 0,
                         bounds: .init(x: 0.02, y: 0.66, width: 0.96, height: 0.27),
                         label: "Bars 3–4 · 6/8")
        ]
        draft.systems = areas
        draft.sections[0].systemIDs = areas.map(\.id)
        try library.savePreparation(projectID: projectID, draft: draft)
        let segments = [
            TimingSegment(quarterBeats: 5, meter: .init(numerator: 4, denominator: 4),
                          tempo: .init(bpm: 60), startingBarPhase: 3),
            TimingSegment(quarterBeats: 4, meter: .init(numerator: 4, denominator: 4),
                          tempo: .init(bpm: 60)),
            TimingSegment(quarterBeats: 6, meter: .init(numerator: 6, denominator: 8),
                          tempo: .init(bpm: 60, pulse: .dottedQuarter))
        ]
        for (area, timing) in zip(areas, segments) {
            try library.updateTiming(projectID: projectID, systemID: area.id, segments: [timing])
        }
        try library.rename(projectID: projectID, title: "Pickup and pulse")
        return projectID
    }
}
