import XCTest

final class PracticePlaybackUITests: XCTestCase {
    override func tearDown() {
        XCUIDevice.shared.orientation = .portrait
        super.tearDown()
    }

    func testSilentPracticeAutomaticallyAdvancesThroughEveryOwnedArea() throws {
        let app = launchExercise("practice-automatic-advance")
        app.buttons["open-practice"].tap()
        let current = app.staticTexts["practice-current"]
        wait(current, contains: "Pickup and bar 1")
        app.buttons["practice-options"].tap()
        app.buttons["practice-count-in-bars"].tap()
        app.buttons["None"].tap()
        app.buttons["close-practice-options"].tap()
        XCTAssertTrue(app.buttons["practice-speed"].label.contains("100%"))
        app.buttons["practice-sound"].tap()
        XCTAssertEqual(app.buttons["practice-sound"].label, "Silent")

        // The actual Play event lies between these runner-clock samples. No
        // navigation, pause, speed or loop commands occur during this take.
        let playBegan = ProcessInfo.processInfo.systemUptime
        app.buttons["practice-play-pause"].tap()
        let playReturned = ProcessInfo.processInfo.systemUptime
        wait(app.staticTexts["practice-phase"], contains: "Playing")
        wait(current, contains: "Pickup and bar 1")
        wait(app.staticTexts["practice-upcoming"], contains: "Bar 2")
        capture("practice-automatic-area-1")

        wait(current, contains: "Current: Bar 2", timeout: 8)
        let area2 = ProcessInfo.processInfo.systemUptime
        assertBoundary(area2, expected: 5, playBegan: playBegan, playReturned: playReturned)
        wait(app.staticTexts["practice-upcoming"], contains: "Bars 3–4")
        capture("practice-automatic-area-2")

        wait(current, contains: "Bars 3–4", timeout: 7)
        let area3 = ProcessInfo.processInfo.systemUptime
        assertBoundary(area3, expected: 9, playBegan: playBegan, playReturned: playReturned)
        XCTAssertFalse(app.buttons["practice-next"].isEnabled)
        capture("practice-automatic-area-3")
        wait(app.staticTexts["practice-phase"], contains: "Finished", timeout: 7)
        let end = ProcessInfo.processInfo.systemUptime
        assertBoundary(end, expected: 13, playBegan: playBegan, playReturned: playReturned)

        let receipt: [String: Any] = [
            "mode": "native-ui-silent-automatic-advance", "countInBars": 0, "speed": 1,
            "expectedBoundariesSeconds": [5, 9, 13],
            "playCommandDurationSeconds": playReturned - playBegan,
            "observedSecondsSincePlayBegan": [area2 - playBegan, area3 - playBegan, end - playBegan],
            "observedSecondsSincePlayReturned": [area2 - playReturned, area3 - playReturned, end - playReturned],
            "uiPollingAllowanceSeconds": 1.25
        ]
        let attachment = XCTAttachment(data: try JSONSerialization.data(withJSONObject: receipt, options: [.prettyPrinted, .sortedKeys]),
            uniformTypeIdentifier: "public.json")
        attachment.name = "practice-automatic-advance-timing"
        attachment.lifetime = .keepAlways
        add(attachment)
    }

    func testManualNavigationInterruptsCountInAndPlaybackAndReachesEnd() {
        let app = launchExercise("practice-navigation")
        PracticeUITestActions.landscape(app)
        app.buttons["open-practice"].tap()
        let current = app.staticTexts["practice-current"]
        wait(current, contains: "Pickup and bar 1")
        wait(app.staticTexts["practice-upcoming"], contains: "Bar 2")
        capture("practice-playback-landscape")
        app.buttons["practice-options"].tap()
        app.buttons["practice-count-in-bars"].tap()
        app.buttons["4"].tap()
        app.buttons["close-practice-options"].tap()
        app.buttons["practice-sound"].tap()
        app.buttons["practice-play-pause"].tap()
        wait(app.staticTexts["practice-phase"], contains: "Count-in")
        waitValue(app.otherElements["practice-pulse"], contains: "Count-in")
        app.buttons["practice-next"].tap()
        wait(current, contains: "Bar 2")
        wait(app.staticTexts["practice-phase"], contains: "Paused")
        waitValue(app.otherElements["practice-pulse"], contains: "Inactive")
        app.buttons["practice-play-pause"].tap()
        wait(app.staticTexts["practice-phase"], contains: "Playing")
        waitValue(app.otherElements["practice-pulse"], contains: "Beat")
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
        app.buttons["close-original-pages"].tap()
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
        let addPass = app.buttons["add-preparation-pass"]
        PracticeUITestActions.reveal(addPass, in: app.collectionViews["preparation-order-controls"])
        addPass.tap()
        PracticeUITestActions.sectionChoice(in: app, label: "Score").tap()
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

        app.buttons["practice-speed"].tap()
        app.buttons["200%"].tap()
        XCTAssertTrue(app.buttons["practice-speed"].label.contains("200%"))
        app.buttons["practice-sound"].tap()
        XCTAssertEqual(app.buttons["practice-sound"].label, "Silent")
        app.buttons["practice-play-pause"].tap()
        let phase = app.staticTexts["practice-phase"]
        wait(phase, contains: "Playing")
        wait(current, contains: "Pass 2, area 4 of 6")

        // Resume the paused A occurrence: no count-in or navigation commands
        // intervene while the 6.5-second loop advances and wraps at 200%.
        wait(current, contains: "Current: Bar 2, Pass 2, area 5 of 6", timeout: 5)
        XCTAssertEqual(phase.label, "Playing")
        wait(current, contains: "Current: Bars 3–4 · 6/8, Pass 2, area 6 of 6", timeout: 4)
        XCTAssertEqual(phase.label, "Playing")
        wait(current, contains: "Pass 2, area 4 of 6", timeout: 4)
        XCTAssertEqual(phase.label, "Playing")
        wait(app.staticTexts["practice-upcoming"], contains: "Pass 2, area 5 of 6")
        capture("practice-automatic-loop-wrap")
        app.buttons["practice-play-pause"].tap()
        wait(phase, contains: "Paused")
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
        PracticeUITestActions.openExercise(in: app)
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

    private func waitValue(_ element: XCUIElement, contains text: String) {
        let expectation = XCTNSPredicateExpectation(predicate: NSPredicate(format: "value CONTAINS %@", text), object: element)
        XCTAssertEqual(XCTWaiter.wait(for: [expectation], timeout: 5), .completed)
    }

    private func assertBoundary(_ observed: Double, expected: Double, playBegan: Double, playReturned: Double) {
        // UI polling is not sample-accurate audio evidence. Bracket the Play
        // action and allow observation latency, while rejecting early changes.
        XCTAssertGreaterThanOrEqual(observed - playBegan, expected - 0.15)
        XCTAssertLessThanOrEqual(observed - playReturned, expected + 1.25)
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
