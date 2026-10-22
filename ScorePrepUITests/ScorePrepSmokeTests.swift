import XCTest

final class ScorePrepSmokeTests: XCTestCase {
    func testSamplePDFAndTimingEditorOpenOnIPad() throws {
        let app = XCUIApplication()
        app.launchArguments = ["--smoke-test"]
        app.launch()
        XCTAssertTrue(app.staticTexts["Line 1"].waitForExistence(timeout: 15))
        XCTAssertTrue(app.staticTexts["system-duration-0"].label.contains("12"))
        let screenshot = XCTAttachment(screenshot: app.screenshot())
        screenshot.name = "ScorePrep iPad reader"
        screenshot.lifetime = .keepAlways
        add(screenshot)
        app.buttons["edit-timing-0"].tap()
        XCTAssertTrue(app.buttons["save-timing"].waitForExistence(timeout: 5))
    }
}
