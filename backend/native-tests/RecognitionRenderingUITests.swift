import XCTest

final class RecognitionRenderingUITests: XCTestCase {
    override func setUpWithError() throws {
        continueAfterFailure = false
    }

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
        let sizeValue = app.staticTexts["notationSizeValue"]
        let smaller = app.buttons["decreaseNotationSize"]
        for scale in stride(from: 50, through: 80, by: 5) {
            // A tap during native engraving is ignored because this control is
            // disabled. Verify each accepted change before requesting the next.
            wait(for: NSPredicate(format: "enabled == true"), on: size)
            size.tap()
            wait(for: NSPredicate(format: "value == %@", "\(Int(Double(scale) / 45 * 100)) percent"), on: sizeValue)
            wait(for: NSPredicate(format: "enabled == true"), on: smaller)
        }
        XCTAssertFalse(size.isEnabled, "The largest notation size must have been reached")
        let next = app.buttons["Next notation page"]
        wait(for: NSPredicate(format: "enabled == true"), on: next)
        let caption = app.staticTexts["notationPageCaption"]
        let firstPage = caption.label
        capture("recognition-large-notation")
        next.tap()
        let previous = app.buttons["Previous notation page"]
        wait(for: NSPredicate(format: "enabled == true"), on: previous)
        let secondPage = caption.label
        XCTAssertNotEqual(secondPage, firstPage)
        previous.tap()
        wait(for: NSPredicate(format: "label == %@", firstPage), on: caption)
        app.webViews.firstMatch.swipeLeft()
        wait(for: NSPredicate(format: "enabled == true"), on: previous)
        wait(for: NSPredicate(format: "label == %@", secondPage), on: caption)
        capture("recognition-manual-page-two")
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
        XCUIDevice.shared.orientation = .landscapeLeft
        app.launch()
        let source = app.staticTexts["linkedSource"]
        XCTAssertTrue(source.waitForExistence(timeout: 90))
        XCTAssertEqual(source.label, "Linked source 8")
        let larger = app.buttons["increaseNotationSize"]
        let previous = app.buttons["Previous notation page"]
        wait(for: NSPredicate(format: "enabled == true"), on: larger)
        larger.tap()
        wait(for: NSPredicate(format: "value == %@", "111 percent"), on: app.staticTexts["notationSizeValue"])
        wait(for: NSPredicate(format: "enabled == true"), on: previous)
        XCTAssertEqual(source.label, "Linked source 8")
        XCUIDevice.shared.orientation = .portrait
        // The source label stays visible during asynchronous reflow. App idle
        // does not mean that the disabled navigation button can accept a tap.
        wait(for: NSPredicate(format: "enabled == true"), on: previous)
        XCTAssertEqual(source.label, "Linked source 8")
        previous.tap()
        wait(for: NSPredicate(format: "label == %@", "Linked source 3"), on: source)
        XCTAssertEqual(source.label, "Linked source 3")
        capture("fixture-source-link-after-navigation")
    }

    @MainActor
    private func wait(for predicate: NSPredicate, on element: XCUIElement,
                      file: StaticString = #filePath, line: UInt = #line) {
        let condition = XCTNSPredicateExpectation(predicate: predicate, object: element)
        XCTAssertEqual(XCTWaiter.wait(for: [condition], timeout: 60), .completed,
                       "Timed out waiting for \(predicate) on \(element)", file: file, line: line)
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
