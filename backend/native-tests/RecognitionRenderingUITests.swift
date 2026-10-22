import XCTest

final class RecognitionRenderingUITests: XCTestCase {
    @MainActor
    func testActualOMRNotationAndManualNavigation() throws {
        let app = XCUIApplication()
        app.launch()
        XCTAssertTrue(app.webViews.firstMatch.waitForExistence(timeout: 90))
        XCUIDevice.shared.orientation = .portrait
        capture("recognition-portrait")
        XCUIDevice.shared.orientation = .landscapeLeft
        capture("recognition-landscape")
        let size = app.buttons["increaseNotationSize"]
        XCTAssertTrue(size.waitForExistence(timeout: 10))
        for _ in 0..<7 { size.tap() }
        let next = app.buttons["Next notation page"]
        let enabled = NSPredicate(format: "enabled == true")
        expectation(for: enabled, evaluatedWith: next)
        waitForExpectations(timeout: 60)
        next.tap()
        let previous = app.buttons["Previous notation page"]
        XCTAssertTrue(previous.isEnabled)
        previous.tap()
        app.webViews.firstMatch.swipeLeft()
        XCTAssertTrue(previous.isEnabled)
        capture("recognition-large-notation")
    }

    @MainActor
    func testNarrowAndLargeTextFixtureEngraving() throws {
        let app = XCUIApplication()
        app.launchArguments = ["--fixture", "--narrow", "-UIPreferredContentSizeCategoryName", "UICTContentSizeCategoryAccessibilityXXXL"]
        app.launch()
        XCTAssertTrue(app.webViews.firstMatch.waitForExistence(timeout: 90))
        XCUIDevice.shared.orientation = .portrait
        capture("fixture-narrow-accessibility-text")
        XCTAssertTrue(app.buttons["increaseNotationSize"].exists)
        XCTAssertTrue(app.buttons["Next notation page"].exists)
    }

    @MainActor
    func testInitialSourceAndVisibleSourceCallback() throws {
        let app = XCUIApplication()
        app.launchArguments = ["--fixture", "--source-link"]
        app.launch()
        let source = app.staticTexts["linkedSource"]
        XCTAssertTrue(source.waitForExistence(timeout: 90))
        XCTAssertEqual(source.label, "Linked source 8")
        app.buttons["increaseNotationSize"].tap()
        XCUIDevice.shared.orientation = .portrait
        XCTAssertEqual(source.label, "Linked source 8")
        app.buttons["Previous notation page"].tap()
        XCTAssertEqual(source.label, "Linked source 3")
    }

    @MainActor
    private func capture(_ name: String) {
        // Allow WebKit's SVG presentation after native engraving has completed.
        Thread.sleep(forTimeInterval: 2)
        let screenshot = XCUIScreen.main.screenshot()
        let attachment = XCTAttachment(screenshot: screenshot)
        attachment.name = name
        attachment.lifetime = .keepAlways
        add(attachment)
    }
}
