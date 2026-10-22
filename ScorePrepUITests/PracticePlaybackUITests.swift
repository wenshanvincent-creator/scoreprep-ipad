import XCTest

final class PracticePlaybackUITests: XCTestCase {
    override func tearDown() {
        XCUIDevice.shared.orientation = .portrait
        super.tearDown()
    }

    func testManualNavigationInterruptsCountInAndPlaybackAndReachesEnd() {
        XCUIDevice.shared.orientation = .landscapeLeft
        let app = launchExercise("practice-navigation")
        app.buttons["open-practice"].tap()
        let current = app.staticTexts["practice-current"]
        wait(current, contains: "Pickup and bar 1")
        wait(app.staticTexts["practice-upcoming"], contains: "Bar 2")
        capture("practice-playback-landscape")
        app.buttons["practice-options"].tap()
        app.buttons["practice-count-in-bars"].tap()
        app.buttons["4"].tap()
        app.buttons["Done"].tap()
        app.buttons["practice-sound"].tap()
        app.buttons["practice-play-pause"].tap()
        wait(app.staticTexts["practice-phase"], contains: "Count-in")
        app.buttons["practice-next"].tap()
        wait(current, contains: "Bar 2")
        wait(app.staticTexts["practice-phase"], contains: "Paused")
        app.buttons["practice-play-pause"].tap()
        wait(app.staticTexts["practice-phase"], contains: "Playing")
        app.buttons["practice-next"].tap()
        wait(current, contains: "Bars 3–4")
        wait(app.staticTexts["practice-phase"], contains: "Paused")
        XCTAssertFalse(app.buttons["practice-next"].isEnabled)
        app.buttons["practice-play-pause"].tap()
        wait(app.staticTexts["practice-phase"], contains: "Finished", timeout: 8)
        app.buttons["practice-stop"].tap()
        wait(current, contains: "Pickup and bar 1")
        wait(app.staticTexts["practice-phase"], contains: "Ready")
        XCUIDevice.shared.orientation = .portrait
        waitForPortrait(app)
        capture("practice-playback-portrait")
        app.buttons["practice-original"].tap()
        XCTAssertTrue(app.navigationBars["Original score"].waitForExistence(timeout: 5))
        app.buttons["Done"].tap()
        app.buttons["leave-practice"].tap()
        XCTAssertTrue(app.buttons["open-practice"].waitForExistence(timeout: 5))
        app.buttons["open-practice"].tap()
        wait(app.staticTexts["practice-phase"], contains: "Ready")
    }

    func testLoopUsesPerformedOccurrencesAndWrapsToRepeatedSource() {
        let app = launchExercise("practice-repeat-loop")
        app.buttons["score-options"].tap()
        app.buttons["prepare-score"].tap()
        app.segmentedControls["preparation-mode"].buttons["Reading order"].tap()
        app.buttons["add-preparation-pass"].tap()
        app.buttons["Score"].tap()
        app.buttons["save-preparation"].tap()
        app.buttons["open-practice"].tap()
        XCTAssertTrue(app.buttons["practice-options"].waitForExistence(timeout: 5))
        app.buttons["practice-options"].tap()
        app.buttons["practice-loop-a"].tap()
        app.buttons["4. Pickup and bar 1 · Pass 2"].tap()
        app.buttons["practice-apply-loop"].tap()
        let current = app.staticTexts["practice-current"]
        wait(current, contains: "Pass 2, area 4 of 6")
        XCTAssertTrue(app.staticTexts["practice-loop-status"].exists)
        app.buttons["practice-next"].tap()
        wait(current, contains: "Bar 2")
        app.buttons["practice-next"].tap()
        wait(current, contains: "Bars 3–4")
        wait(app.staticTexts["practice-upcoming"], contains: "Pass 2, area 4 of 6")
        capture("practice-repeat-loop")
        app.buttons["practice-next"].tap()
        wait(current, contains: "Pass 2, area 4 of 6")
        wait(app.staticTexts["practice-phase"], contains: "Paused")
    }

    func testLargeTextControlsRemainReachableAndUntimedScoreStaysReadable() {
        let app = launchExercise("practice-large-text", largeText: true)
        app.buttons["open-practice"].tap()
        XCTAssertTrue(app.buttons["practice-next"].waitForExistence(timeout: 5))
        for id in ["practice-play-pause", "practice-stop", "practice-next", "practice-options"] {
            XCTAssertTrue(app.buttons[id].isHittable, "\(id) must remain reachable")
        }
        capture("practice-playback-large-text")
        app.buttons["practice-next"].tap()
        wait(app.staticTexts["practice-current"], contains: "Bar 2")
        app.terminate()
        app.launchArguments = ["--smoke-test", "--reader-test-id", "practice-untimed", "--reader-reset",
            "--reader-fixture", "png"]
        app.launch()
        XCTAssertTrue(app.buttons["open-practice"].waitForExistence(timeout: 15))
        app.buttons["open-practice"].tap()
        XCTAssertTrue(app.alerts["Practice needs preparation"].waitForExistence(timeout: 5))
        app.alerts.buttons["OK"].tap()
        XCTAssertTrue(app.buttons["edit-timing-0"].isHittable)
        XCTAssertTrue(app.staticTexts["Page 1"].exists)
    }

    private func launchExercise(_ id: String, largeText: Bool = false) -> XCUIApplication {
        let app = XCUIApplication()
        app.launchArguments = ["--smoke-test", "--reader-test-id", id, "--reader-reset"]
        if largeText {
            app.launchArguments += ["-UIPreferredContentSizeCategoryName", "UICTContentSizeCategoryAccessibilityXXXL"]
        }
        app.launch()
        XCTAssertTrue(app.buttons["open-practice-exercise"].waitForExistence(timeout: 15))
        app.buttons["open-practice-exercise"].tap()
        XCTAssertTrue(app.navigationBars["Pickup and pulse"].waitForExistence(timeout: 15))
        return app
    }

    private func wait(_ element: XCUIElement, contains text: String, timeout: TimeInterval = 5) {
        let expectation = XCTNSPredicateExpectation(predicate: NSPredicate(format: "label CONTAINS %@", text), object: element)
        XCTAssertEqual(XCTWaiter.wait(for: [expectation], timeout: timeout), .completed)
    }

    private func waitForPortrait(_ app: XCUIApplication) {
        let expectation = XCTNSPredicateExpectation(predicate: NSPredicate { _, _ in app.frame.height > app.frame.width }, object: app)
        XCTAssertEqual(XCTWaiter.wait(for: [expectation], timeout: 10), .completed)
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
