import XCTest

final class RecognitionRenderingUITests: XCTestCase {
    @MainActor
    func testActualOMRNotationAndManualNavigation() throws {
        let app = XCUIApplication()
        app.launch()
        XCTAssertTrue(app.otherElements["recognizedNotation"].waitForExistence(timeout: 90))
        XCUIDevice.shared.orientation = .portrait
        capture("recognition-portrait")
        XCUIDevice.shared.orientation = .landscapeLeft
        capture("recognition-landscape")
        let size = app.steppers["notationSize"]
        XCTAssertTrue(size.waitForExistence(timeout: 10))
        for _ in 0..<7 { size.buttons["Increment"].tap() }
        let next = app.buttons["Next notation page"]
        let enabled = NSPredicate(format: "enabled == true")
        expectation(for: enabled, evaluatedWith: next)
        waitForExpectations(timeout: 60)
        next.tap()
        let previous = app.buttons["Previous notation page"]
        XCTAssertTrue(previous.isEnabled)
        previous.tap()
        app.otherElements["recognizedNotation"].swipeLeft()
        XCTAssertTrue(previous.isEnabled)
        capture("recognition-large-notation")
    }

    @MainActor
    func testNarrowAndLargeTextFixtureEngraving() throws {
        let app = XCUIApplication()
        app.launchArguments = ["--fixture", "--narrow", "-UIPreferredContentSizeCategoryName", "UICTContentSizeCategoryAccessibilityXXXL"]
        app.launch()
        XCTAssertTrue(app.otherElements["recognizedNotation"].waitForExistence(timeout: 90))
        XCUIDevice.shared.orientation = .portrait
        capture("fixture-narrow-accessibility-text")
        XCTAssertTrue(app.steppers["notationSize"].exists)
        XCTAssertTrue(app.buttons["Next notation page"].exists)
    }

    @MainActor
    private func capture(_ name: String) {
        // Allow WebKit's SVG presentation after native engraving has completed.
        let screenshot = XCUIScreen.main.screenshot()
        let attachment = XCTAttachment(screenshot: screenshot)
        attachment.name = name
        attachment.lifetime = .keepAlways
        add(attachment)
        let output = ProcessInfo.processInfo.environment["RECOGNITION_SCREENSHOT_DIR"]
        if let output {
            try? screenshot.pngRepresentation.write(to: URL(fileURLWithPath: output).appendingPathComponent(name + ".png"))
        }
    }
}
