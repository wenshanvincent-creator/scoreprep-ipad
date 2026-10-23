import XCTest
import UIKit

/// Covers the compact navigation path and controls that can disappear on phones.
final class IPhoneCompatibilityTests: XCTestCase {
    override func tearDown() {
        XCUIDevice.shared.orientation = .portrait
        super.tearDown()
    }

    func testPhoneLibraryPreparationAndPracticeAcrossSizes() throws {
        try XCTSkipIf(UIDevice.current.userInterfaceIdiom != .phone, "Phone layout gate runs in the iPhone job")
        let app = XCUIApplication()
        app.launchArguments = ["--reader-test-id", "iphone-navigation", "--reader-reset"]
        app.launch()
        let exercise = app.buttons["open-practice-exercise"]
        XCTAssertTrue(exercise.waitForExistence(timeout: 15))
        XCTAssertTrue(exercise.isHittable)
        exercise.tap()
        let practice = app.buttons["open-practice"]
        ready(practice)
        capture("iphone-reader-portrait")
        app.buttons["score-options"].tap()
        app.buttons["prepare-score"].tap()
        ready(app.buttons["save-preparation"])
        capture("iphone-preparation-portrait")
        app.buttons["cancel-preparation"].tap()
        practice.tap()
        ready(app.buttons["practice-play-pause"])
        assertTransport(app)
        capture("iphone-practice-portrait")
        app.buttons["practice-play-pause"].tap()
        app.buttons["practice-play-pause"].tap()
        XCTAssertTrue(app.staticTexts["practice-phase"].label.contains("Paused"))
        PracticeUITestActions.landscape(app)
        assertTransport(app)
        let notation = app.otherElements["practice-current-notation"]
        XCTAssertTrue(notation.waitForExistence(timeout: 5))
        let musicViewport = app.scrollViews["practice-music"].frame
        XCTAssertGreaterThan(notation.frame.height, 0)
        XCTAssertTrue(musicViewport.contains(notation.frame),
            "The complete current staff must fit above the landscape transport")
        capture("iphone-practice-landscape")
        app.buttons["practice-next"].tap()
        XCTAssertTrue(app.staticTexts["practice-current"].label.contains("Bar 2"))
        app.buttons["practice-options"].tap()
        ready(app.buttons["close-practice-options"])
        app.buttons["close-practice-options"].tap()
        app.buttons["leave-practice"].tap()
        ready(practice)
    }

    func testPhoneAccessibilityTransportRemainsReachable() throws {
        try XCTSkipIf(UIDevice.current.userInterfaceIdiom != .phone, "Phone layout gate runs in the iPhone job")
        let app = XCUIApplication()
        app.launchArguments = ["--reader-test-id", "iphone-accessibility", "--reader-reset",
            "-UIPreferredContentSizeCategoryName", "UICTContentSizeCategoryAccessibilityXXXL"]
        app.launch()
        ready(app.buttons["open-practice-exercise"])
        app.buttons["open-practice-exercise"].tap()
        ready(app.buttons["open-practice"])
        app.buttons["open-practice"].tap()
        ready(app.buttons["practice-play-pause"])
        assertTransport(app)
        capture("iphone-practice-large-text")
        app.buttons["practice-options"].tap()
        ready(app.buttons["close-practice-options"])
        capture("iphone-options-large-text")
    }

    private func assertTransport(_ app: XCUIApplication) {
        for id in ["practice-play-pause", "practice-stop", "practice-next", "practice-options"] {
            XCTAssertTrue(app.buttons[id].isHittable, "\(id) must be reachable on iPhone")
        }
    }

    private func ready(_ element: XCUIElement) {
        let expectation = XCTNSPredicateExpectation(predicate: NSPredicate { _, _ in
            element.exists && element.isHittable
        }, object: nil)
        XCTAssertEqual(XCTWaiter.wait(for: [expectation], timeout: 15), .completed)
    }

    private func capture(_ name: String) {
        let attachment = XCTAttachment(screenshot: XCUIScreen.main.screenshot())
        attachment.name = name
        attachment.lifetime = .keepAlways
        add(attachment)
    }
}
