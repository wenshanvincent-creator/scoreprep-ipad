import XCTest

final class PracticePreparationUITests: XCTestCase {
    override func tearDown() {
        XCUIDevice.shared.orientation = .portrait
        super.tearDown()
    }

    func testMultiAreaRouteSaveCancelAndOriginalAccessOnOwnedExercise() {
        XCUIDevice.shared.orientation = .landscapeLeft
        let app = launch("practice-areas")
        let exercise = app.buttons["open-practice-exercise"]
        XCTAssertTrue(exercise.waitForExistence(timeout: 15))
        exercise.tap()
        XCTAssertTrue(app.buttons["next-area"].waitForExistence(timeout: 10))
        openPreparation(app)
        capture("practice-preparation-landscape")
        app.buttons["add-preparation-area"].tap()
        app.buttons["Add to Score"].tap()
        let name = app.textFields["preparation-area-name"]
        reveal(name, in: app)
        replace(name, with: "Ending")
        app.buttons["preparation-area-actions-3"].tap()
        app.buttons["Move earlier"].tap()
        app.segmentedControls["preparation-mode"].buttons["Reading order"].tap()
        app.buttons["add-preparation-pass"].tap()
        app.buttons["Score"].tap()
        XCTAssertTrue(app.staticTexts["preparation-pass-1"].waitForExistence(timeout: 5))
        capture("practice-reading-order-repeat")
        app.buttons["save-preparation"].tap()
        app.terminate()
        app.launchArguments = ["--smoke-test", "--reader-test-id", "practice-areas"]
        app.launch()
        openPreparation(app)
        app.segmentedControls["preparation-mode"].buttons["Reading order"].tap()
        XCTAssertTrue(app.staticTexts["preparation-pass-1"].waitForExistence(timeout: 5))
        app.segmentedControls["preparation-mode"].buttons["Areas"].tap()
        app.buttons["preparation-area-actions-2"].tap()
        app.buttons["Remove area"].tap()
        app.buttons["Remove area"].tap()
        app.buttons["Cancel"].tap()
        openPreparation(app)
        XCTAssertTrue(app.buttons["select-preparation-area-3"].waitForExistence(timeout: 5))
        XCUIDevice.shared.orientation = .portrait
        let portrait = XCTNSPredicateExpectation(predicate: NSPredicate { _, _ in
            app.frame.height > app.frame.width
        }, object: app)
        XCTAssertEqual(XCTWaiter.wait(for: [portrait], timeout: 10), .completed)
        capture("practice-preparation-portrait")
        app.buttons["Cancel"].tap()
        app.buttons["score-options"].tap()
        app.buttons["view-original-pages"].tap()
        XCTAssertTrue(app.navigationBars["Original score"].waitForExistence(timeout: 5))
    }

    func testFractionalPickupAndMultipleTimingSegmentsSurviveColdReopen() {
        let app = launch("practice-timing")
        XCTAssertTrue(app.buttons["edit-timing-0"].waitForExistence(timeout: 15))
        app.buttons["edit-timing-0"].tap()
        replace(app.textFields["timing-beats-0"], with: "1.25")
        replace(app.textFields["timing-phase-0"], with: "3.5")
        replace(app.textFields["timing-bpm-0"], with: "60")
        let add = app.buttons["add-timing-segment"]
        reveal(add, in: app)
        add.tap()
        let secondBeats = app.textFields["timing-beats-1"]
        reveal(secondBeats, in: app)
        replace(secondBeats, with: "4.5")
        replace(app.textFields["timing-phase-1"], with: "0.25")
        replace(app.textFields["timing-numerator-1"], with: "6")
        replace(app.textFields["timing-denominator-1"], with: "8")
        replace(app.textFields["timing-bpm-1"], with: "96")
        let pulse = app.buttons["timing-pulse-1"]
        reveal(pulse, in: app)
        pulse.tap()
        app.buttons["Dotted quarter"].tap()
        capture("practice-multiple-timing-segments")
        app.buttons["save-timing"].tap()
        app.terminate()
        app.launchArguments = ["--smoke-test", "--reader-test-id", "practice-timing"]
        app.launch()
        app.buttons["edit-timing-0"].tap()
        XCTAssertEqual(app.textFields["timing-beats-0"].value as? String, "1.25")
        XCTAssertEqual(app.textFields["timing-phase-0"].value as? String, "3.5")
        reveal(app.textFields["timing-beats-1"], in: app)
        XCTAssertEqual(app.textFields["timing-beats-1"].value as? String, "4.5")
        XCTAssertEqual(app.textFields["timing-phase-1"].value as? String, "0.25")
        capture("practice-timing-reopened")
    }

    private func openPreparation(_ app: XCUIApplication) {
        XCTAssertTrue(app.buttons["score-options"].waitForExistence(timeout: 10))
        app.buttons["score-options"].tap()
        app.buttons["prepare-score"].tap()
        XCTAssertTrue(app.buttons["save-preparation"].waitForExistence(timeout: 5))
    }

    private func launch(_ id: String) -> XCUIApplication {
        let app = XCUIApplication()
        app.launchArguments = ["--smoke-test", "--reader-test-id", id, "--reader-reset"]
        app.launch()
        return app
    }

    private func replace(_ field: XCUIElement, with text: String) {
        XCTAssertTrue(field.waitForExistence(timeout: 5))
        let previous = field.value as? String ?? ""
        field.tap()
        field.typeText(String(repeating: XCUIKeyboardKey.delete.rawValue, count: previous.count) + text)
    }

    private func reveal(_ element: XCUIElement, in app: XCUIApplication) {
        for _ in 0..<10 {
            if element.exists && element.isHittable { return }
            app.swipeUp()
        }
        XCTAssertTrue(element.isHittable)
    }

    private func capture(_ name: String) {
        let screenshot = XCUIScreen.main.screenshot()
        let attachment = XCTAttachment(screenshot: screenshot)
        attachment.name = name
        attachment.lifetime = .keepAlways
        add(attachment)
        #if targetEnvironment(simulator)
        let root = URL(fileURLWithPath: #filePath).deletingLastPathComponent().deletingLastPathComponent()
        do { try screenshot.pngRepresentation.write(to: root.appendingPathComponent("build/\(name).png")) }
        catch { XCTFail("Could not export native screenshot: \(error)") }
        #endif
    }
}
