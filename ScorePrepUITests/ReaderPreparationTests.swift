import XCTest

final class ReaderPreparationTests: XCTestCase {
    override func tearDown() {
        XCUIDevice.shared.orientation = .portrait
        super.tearDown()
    }

    func testManualNavigationAndPortraitLandscapeEvidence() {
        let app = launch("navigation")
        XCTAssertTrue(app.staticTexts["Line 1"].waitForExistence(timeout: 15))
        XCTAssertFalse(app.buttons["previous-area"].isEnabled)
        capture(app, "reader-portrait")
        app.buttons["next-area"].tap()
        XCTAssertTrue(app.staticTexts["Line 2"].waitForExistence(timeout: 5))
        app.swipeLeft()
        XCTAssertTrue(app.staticTexts["Line 3"].waitForExistence(timeout: 5))
        XCTAssertFalse(app.buttons["next-area"].isEnabled)
        app.buttons["previous-area"].tap()
        XCTAssertTrue(app.staticTexts["Line 2"].waitForExistence(timeout: 5))
        XCUIDevice.shared.orientation = .landscapeLeft
        XCTAssertTrue(app.buttons["next-area"].waitForExistence(timeout: 5))
        capture(app, "reader-landscape")
        app.buttons["review-score"].tap()
        XCTAssertTrue(app.staticTexts["No clean edition yet"].waitForExistence(timeout: 5))
        capture(app, "reader-original-review")
    }

    func testPDFImportRenameCropReopenAndDelete() {
        let app = launch("pdf", fixture: "pdf")
        XCTAssertTrue(app.staticTexts["Page 1"].waitForExistence(timeout: 15))
        app.buttons["next-area"].tap()
        XCTAssertTrue(app.staticTexts["Page 2"].waitForExistence(timeout: 5))
        XCTAssertFalse(app.buttons["next-area"].isEnabled)
        app.buttons["previous-area"].tap()
        app.buttons["score-options"].tap()
        app.buttons["Rename"].tap()
        let field = app.alerts.textFields.firstMatch
        XCTAssertTrue(field.waitForExistence(timeout: 5))
        field.tap()
        // Clear using the known field value, independent of keyboard selection menus.
        let existing = field.value as? String ?? ""
        field.typeText(String(repeating: XCUIKeyboardKey.delete.rawValue, count: existing.count))
        field.typeText("Evening practice")
        app.alerts.buttons["Save"].tap()
        app.buttons["score-options"].tap()
        app.buttons["Adjust reading area"].tap()
        let top = app.sliders["crop-top"]
        // Full-page preview may place controls below the fold in portrait.
        app.swipeUp()
        XCTAssertTrue(top.waitForExistence(timeout: 5))
        top.adjust(toNormalizedSliderPosition: 0.2)
        let savedValue = top.value as? String
        app.buttons["save-reading-area"].tap()
        app.terminate()
        app.launchArguments = ["--smoke-test", "--reader-test-id", "pdf"]
        app.launch()
        XCTAssertTrue(app.navigationBars["Evening practice"].waitForExistence(timeout: 15))
        app.buttons["score-options"].tap()
        app.buttons["Adjust reading area"].tap()
        app.swipeUp()
        XCTAssertEqual(app.sliders["crop-top"].value as? String, savedValue)
        capture(app, "reader-crop-persistence")
        app.buttons["Cancel"].tap()
        app.buttons["score-options"].tap()
        app.buttons["Delete"].tap()
        app.buttons["Delete score"].tap()
        app.terminate()
        app.launch()
        XCTAssertFalse(app.navigationBars["Evening practice"].exists)
    }

    func testPNGAndJPEGImportAndMalformedInput() {
        for format in ["png", "jpg"] {
            let app = launch(format, fixture: format)
            XCTAssertTrue(app.staticTexts["Page 1"].waitForExistence(timeout: 15))
            XCTAssertFalse(app.buttons["next-area"].isEnabled)
            app.terminate()
            app.launchArguments = ["--smoke-test", "--reader-test-id", format]
            app.launch()
            XCTAssertTrue(app.staticTexts["Page 1"].waitForExistence(timeout: 15))
            capture(app, "reader-\(format)-reopened")
            app.terminate()
        }
        let invalid = launch("invalid", fixture: "png-invalid")
        XCTAssertTrue(invalid.alerts["Could not update the library"].waitForExistence(timeout: 15))
        XCTAssertTrue(invalid.staticTexts["Choose a readable JPEG or PNG image."].exists)
    }

    func testRotatedPDFAndLargeTextEvidence() {
        let app = launch("rotated", fixture: "rotated")
        XCTAssertTrue(app.staticTexts["Page 1"].waitForExistence(timeout: 15))
        capture(app, "reader-rotated-original")
        app.terminate()
        app.launchArguments = ["--smoke-test", "--reader-test-id", "large-text", "--reader-reset",
            "-UIPreferredContentSizeCategoryName", "UICTContentSizeCategoryAccessibilityXXXL"]
        app.launch()
        XCTAssertTrue(app.buttons["next-area"].waitForExistence(timeout: 15))
        capture(app, "reader-large-text")
        XCTAssertTrue(app.buttons["next-area"].isHittable)
        app.buttons["next-area"].tap()
        XCTAssertTrue(app.staticTexts["Line 2"].waitForExistence(timeout: 5))
    }

    private func launch(_ name: String, fixture: String? = nil) -> XCUIApplication {
        let app = XCUIApplication()
        app.launchArguments = ["--smoke-test", "--reader-test-id", name, "--reader-reset"]
        if let fixture { app.launchArguments += ["--reader-fixture", fixture] }
        app.launch()
        return app
    }

    private func capture(_ app: XCUIApplication, _ name: String) {
        let screenshot = app.screenshot()
        let attachment = XCTAttachment(screenshot: screenshot)
        attachment.name = name
        attachment.lifetime = .keepAlways
        add(attachment)
        #if targetEnvironment(simulator)
        // The existing workflow uploads build/*.png. Export on the macOS
        // simulator host as well as retaining the xcresult attachment.
        let root = URL(fileURLWithPath: #filePath).deletingLastPathComponent().deletingLastPathComponent()
        do {
            try screenshot.pngRepresentation.write(
                to: root.appendingPathComponent("build/\(name).png"), options: .atomic)
        } catch { XCTFail("Could not export native screenshot: \(error)") }
        #endif
    }
}
