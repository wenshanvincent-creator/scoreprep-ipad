import Foundation
import XCTest
@testable import ScorePrep

final class RecognitionClientTests: XCTestCase {
    func testSubmissionKeepsSlashRichTwentyMiBWithinWorkerBodyLimit() throws {
        let document = Data(repeating: 0xff, count: 20 * 1024 * 1024)
        let client = RecognitionClient(baseURL: URL(string: "https://worker.example")!,
                                       bearerToken: "test-only")
        let request = try client.makeSubmissionRequest(document: document, mediaType: "image/png")
        let body = try XCTUnwrap(request.httpBody)
        XCTAssertEqual(request.httpMethod, "POST")
        XCTAssertEqual(request.url?.path, "/v1/jobs")
        XCTAssertEqual(request.value(forHTTPHeaderField: "Content-Type"), "application/json")
        XCTAssertEqual(request.value(forHTTPHeaderField: "Authorization"), "Bearer test-only")
        XCTAssertLessThanOrEqual(body.count, 20 * 1024 * 1024 * 4 / 3 + 4096)
        XCTAssertLessThan(body.count, 28 * 1024 * 1024)
        XCTAssertFalse(String(decoding: body, as: UTF8.self).contains("\\/"))
        let payload = try XCTUnwrap(JSONSerialization.jsonObject(with: body) as? [String: String])
        XCTAssertEqual(payload["mediaType"], "image/png")
        XCTAssertEqual(Data(base64Encoded: try XCTUnwrap(payload["contentBase64"])), document)
    }
}
