import Foundation
import XCTest
@testable import ScoreCore

final class RecognitionStorageTests: XCTestCase {
    func testLibraryWrittenBeforeRecognitionStillOpens() throws {
        let data = Data("""
        [{
          "id": "C433A711-E182-4645-B838-16EE01277860",
          "title": "Original study",
          "sourceFilename": "study.pdf",
          "systems": [], "sections": [], "readingOrder": []
        }]
        """.utf8)
        let projects = try JSONDecoder().decode([ScoreProject].self, from: data)
        XCTAssertEqual(projects.count, 1)
        XCTAssertEqual(projects[0].title, "Original study")
        XCTAssertEqual(projects[0].sourceFilename, "study.pdf")
        XCTAssertNil(projects[0].recognizedEdition)
        XCTAssertNil(projects[0].pendingRecognition)
    }

    func testPendingJobCanResumeFromSavedLibraryWithoutCredentials() throws {
        let pending = PendingRecognition(
            jobID: "6E3544F9-6046-44A5-B9A9-C50FE68EE96A",
            workerURL: URL(string: "https://worker.example")!, originalSHA256: "fixture-hash"
        )
        let project = ScoreProject(
            title: "Pending study", sourceFilename: "original.png", systems: [],
            sections: [], readingOrder: [], pendingRecognition: pending
        )
        let restored = try JSONDecoder().decode(
            [ScoreProject].self, from: JSONEncoder().encode([project])
        )
        XCTAssertEqual(restored[0].pendingRecognition, pending)
        XCTAssertNil(restored[0].recognizedEdition)
    }

    func testSavedEditionPreservesPageOrderAndIndividualReviewDecisions() throws {
        let edition = RecognizedEdition(
            engine: "oemer-fixture-version", createdAt: Date(timeIntervalSince1970: 100),
            pages: [
                RecognizedSourcePage(sourcePageIndex: 0, musicXMLFilename: "first.musicxml"),
                RecognizedSourcePage(
                    sourcePageIndex: 1, musicXMLFilename: "second.musicxml",
                    reviewState: .accepted
                ),
                RecognizedSourcePage(
                    sourcePageIndex: 2, musicXMLFilename: "third.musicxml",
                    reviewState: .rejected
                )
            ]
        )
        let project = ScoreProject(
            title: "Review study", sourceFilename: "original.pdf", systems: [],
            sections: [], readingOrder: [], recognizedEdition: edition
        )
        let restored = try JSONDecoder().decode(
            ScoreProject.self, from: JSONEncoder().encode(project)
        )
        XCTAssertEqual(restored.recognizedEdition, edition)
        XCTAssertEqual(restored.sourceFilename, "original.pdf")
    }
}
