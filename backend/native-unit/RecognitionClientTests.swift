import XCTest
@testable import RecognitionHarness

final class RecognitionClientTests: XCTestCase {
    func testUnauthorizedWorkerErrorRemainsVisible() async throws {
        ContractURLProtocol.response = (401, Data("Invalid worker credential".utf8))
        let client = makeClient()
        do {
            _ = try await client.job(id: "00000000-0000-0000-0000-000000000001")
            XCTFail("Unauthorized worker must not return success")
        } catch RecognitionClientError.server(let status, let detail) {
            XCTAssertEqual(status, 401)
            XCTAssertEqual(detail, "Invalid worker credential")
        }
    }

    func testOutOfOrderOrMissingSuccessfulPagesAreRejected() async throws {
        for page in [#"{"sourcePageIndex":2,"state":"succeeded","musicXML":"<score/>"}"#,
                     #"{"sourcePageIndex":0,"state":"succeeded"}"#] {
            let json = """
            {"schemaVersion":1,"id":"00000000-0000-0000-0000-000000000001","state":"succeeded",
             "completedPages":1,"engineRevision":"test-contract","originalSHA256":"fixture",
             "pages":[\(page)]}
            """
            ContractURLProtocol.response = (200, Data(json.utf8))
            do {
                _ = try await makeClient().job(id: "00000000-0000-0000-0000-000000000001")
                XCTFail("Invalid page provenance or incomplete result must not appear successful")
            } catch RecognitionClientError.invalidJob { }
        }
    }

    private func makeClient() -> RecognitionClient {
        let config = URLSessionConfiguration.ephemeral
        config.protocolClasses = [ContractURLProtocol.self]
        return RecognitionClient(baseURL: URL(string: "https://worker.invalid")!, bearerToken: "test-only",
                                 session: URLSession(configuration: config))
    }
}

private final class ContractURLProtocol: URLProtocol {
    static var response: (Int, Data) = (500, Data())
    override class func canInit(with request: URLRequest) -> Bool { true }
    override class func canonicalRequest(for request: URLRequest) -> URLRequest { request }
    override func startLoading() {
        let (status, data) = Self.response
        client?.urlProtocol(self, didReceive: HTTPURLResponse(url: request.url!, statusCode: status,
                                                            httpVersion: nil, headerFields: nil)!,
                            cacheStoragePolicy: .notAllowed)
        client?.urlProtocol(self, didLoad: data)
        client?.urlProtocolDidFinishLoading(self)
    }
    override func stopLoading() {}
}
