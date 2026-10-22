import XCTest
@testable import RecognitionHarness

final class RecognitionContractTests: XCTestCase {
    func testVerovioActuallyEngravesAndRejectsMissingPage() async throws {
        let renderer = VerovioRenderer()
        let url = try XCTUnwrap(Bundle(for: Self.self).url(forResource: "recognition-study", withExtension: "musicxml"))
        let xml = try String(contentsOf: url)
        let pages = try await renderer.render(pages: [RecognitionPage(sourcePageIndex: 2, state: .succeeded, musicXML: xml)],
                                              width: 800, height: 900, scale: 45)
        XCTAssertFalse(pages.isEmpty)
        XCTAssertTrue(pages[0].svg.contains("note"))
        XCTAssertEqual(pages[0].sourcePageIndex, 2)
        do {
            _ = try await renderer.render(pages: [RecognitionPage(sourcePageIndex: 2, state: .failed)],
                                          width: 800, height: 900, scale: 45)
            XCTFail("A missing page must not render as success")
        } catch is NotationRenderError { }
    }
}
