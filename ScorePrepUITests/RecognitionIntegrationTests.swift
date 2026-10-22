import XCTest

final class RecognitionIntegrationTests: XCTestCase {
    override func tearDown() {
        XCUIDevice.shared.orientation = .portrait
        super.tearDown()
    }

    func testRecordedOMRCanBeRejectedAndReopenedOffline() {
        let app = XCUIApplication()
        app.launchArguments = [
            "--smoke-test", "--reader-test-id", "recognition-replay", "--reader-reset",
            "--recognition-replay"
        ]
        app.launch()
        XCTAssertTrue(app.navigationBars["Recorded OMR trial"].waitForExistence(timeout: 20))
        app.buttons["review-score"].tap()
        XCTAssertTrue(app.staticTexts["notationPageCaption"].waitForExistence(timeout: 20))
        XCTAssertTrue(app.webViews.firstMatch.waitForExistence(timeout: 10))
        XCTAssertTrue(app.buttons["accept-recognized-page"].exists)
        capture(app, "integrated-recognition-portrait")
        XCUIDevice.shared.orientation = .landscapeLeft
        let landscape = XCTNSPredicateExpectation(predicate: NSPredicate { _, _ in
            app.frame.width > app.frame.height
        }, object: app)
        XCTAssertEqual(XCTWaiter.wait(for: [landscape], timeout: 10), .completed)
        XCTAssertTrue(app.staticTexts["notationPageCaption"].waitForExistence(timeout: 10))
        capture(app, "integrated-recognition-landscape")
        app.buttons["accept-recognized-page"].tap()
        XCTAssertTrue(app.staticTexts["Page 1 reviewed"].waitForExistence(timeout: 5))
        app.buttons["Review again"].tap()
        app.buttons["reject-recognized-page"].tap()
        XCTAssertTrue(app.staticTexts["Use the original for page 1"].waitForExistence(timeout: 5))
        capture(app, "integrated-recognition-rejected")
        app.terminate()
        app.launchArguments = ["--smoke-test", "--reader-test-id", "recognition-replay"]
        app.launch()
        XCTAssertTrue(app.navigationBars["Recorded OMR trial"].waitForExistence(timeout: 20))
        app.buttons["review-score"].tap()
        XCTAssertTrue(app.staticTexts["Use the original for page 1"].waitForExistence(timeout: 10))
        XCTAssertTrue(app.buttons["reject-recognized-page"].isEnabled == false)
        capture(app, "integrated-recognition-offline-reopen")
    }

    func testWorkerConnectionRejectsHTTPAndPersistsInKeychain() {
        let app = XCUIApplication()
        app.launchArguments = ["--smoke-test", "--reader-test-id", "worker-settings", "--reader-reset"]
        app.launch()
        XCTAssertTrue(app.buttons["review-score"].waitForExistence(timeout: 15))
        app.buttons["review-score"].tap()
        app.buttons["worker-connection"].tap()
        let address = app.textFields["recognition-worker-address"]
        XCTAssertTrue(address.waitForExistence(timeout: 5))
        address.tap()
        address.typeText("http://worker.example")
        let token = app.secureTextFields["recognition-worker-token"]
        token.tap()
        token.typeText("fixture-token")
        app.buttons["save-recognition-connection"].tap()
        XCTAssertTrue(app.alerts["Could not update the connection"].waitForExistence(timeout: 5))
        app.alerts.buttons["OK"].tap()
        address.tap()
        let oldValue = address.value as? String ?? ""
        address.typeText(String(repeating: XCUIKeyboardKey.delete.rawValue, count: oldValue.count))
        address.typeText("https://worker.example")
        app.buttons["save-recognition-connection"].tap()
        XCTAssertTrue(app.buttons["recognize-original"].waitForExistence(timeout: 5))
        app.terminate()
        app.launchArguments = ["--smoke-test", "--reader-test-id", "worker-settings"]
        app.launch()
        XCTAssertTrue(app.buttons["review-score"].waitForExistence(timeout: 15))
        app.buttons["review-score"].tap()
        app.buttons["worker-connection"].tap()
        XCTAssertEqual(app.textFields["recognition-worker-address"].value as? String, "https://worker.example")
        app.buttons["Remove connection"].tap()
        XCTAssertTrue(app.buttons["Connect recognition worker"].waitForExistence(timeout: 5))
    }

    private func capture(_ app: XCUIApplication, _ name: String) {
        let screenshot = XCUIScreen.main.screenshot()
        let attachment = XCTAttachment(screenshot: screenshot)
        attachment.name = name
        attachment.lifetime = .keepAlways
        add(attachment)
        #if targetEnvironment(simulator)
        let root = URL(fileURLWithPath: #filePath).deletingLastPathComponent().deletingLastPathComponent()
        do {
            try screenshot.pngRepresentation.write(
                to: root.appendingPathComponent("build/\(name).png"), options: .atomic
            )
        } catch { XCTFail("Could not export native screenshot: \(error)") }
        #endif
    }
}
