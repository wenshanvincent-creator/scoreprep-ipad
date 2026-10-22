import XCTest
import VerovioToolkit
@testable import RecognitionHarness

final class RecognitionContractTests: XCTestCase {
    func testActualHomrPianoVoicesKeepFourNotesPerStaffPerMeasure() throws {
        let url = try XCTUnwrap(Bundle(for: Self.self).url(forResource: "homr-observed", withExtension: "musicxml"))
        let resources = try XCTUnwrap(VerovioResources.bundle.url(forResource: "data", withExtension: nil))
        let toolkit = VerovioToolkit(resources.path)
        XCTAssertTrue(toolkit.setOptions("{\"inputFrom\":\"\(VerovioRenderer.musicXMLInputFormat)\"}"))
        XCTAssertTrue(toolkit.loadData(try String(contentsOf: url)))
        let counter = StaffNoteCounter()
        let parser = XMLParser(data: Data(toolkit.getMEI("{}").utf8))
        parser.delegate = counter
        XCTAssertTrue(parser.parse())
        // A direct-import regression put notes into the bass voice and made them
        // overlap. This checks the actual musical staff assignment after import.
        XCTAssertEqual(counter.staffCounts.count, 16)
        XCTAssertEqual(counter.staffCounts, Array(repeating: 4, count: 16))
    }

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

private final class StaffNoteCounter: NSObject, XMLParserDelegate {
    var staffCounts: [Int] = []
    private var inStaff = false
    func parser(_ parser: XMLParser, didStartElement elementName: String, namespaceURI: String?,
                qualifiedName qName: String?, attributes attributeDict: [String: String]) {
        if elementName == "staff" { inStaff = true; staffCounts.append(0) }
        if elementName == "note", inStaff { staffCounts[staffCounts.count - 1] += 1 }
    }
    func parser(_ parser: XMLParser, didEndElement elementName: String, namespaceURI: String?, qualifiedName qName: String?) {
        if elementName == "staff" { inStaff = false }
    }
}
