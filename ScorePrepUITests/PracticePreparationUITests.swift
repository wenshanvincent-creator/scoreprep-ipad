import XCTest

final class PracticePreparationUITests: XCTestCase {
    override func tearDown() {
        XCUIDevice.shared.orientation = .portrait
        super.tearDown()
    }

    func testMultiAreaRouteSaveCancelAndOriginalAccessOnOwnedExercise() {
        let app = launch("practice-areas")
        PracticeUITestActions.openExercise(in: app)
        PracticeUITestActions.landscape(app)
        openPreparation(app)
        capture("practice-preparation-landscape")
        let areaControls = app.collectionViews["preparation-area-controls"]
        let addArea = app.buttons["add-preparation-area"]
        PracticeUITestActions.reveal(addArea, in: areaControls)
        addArea.tap()
        PracticeUITestActions.sectionChoice(in: app, label: "Add to Score").tap()
        let name = app.textFields["preparation-area-name"]
        PracticeUITestActions.reveal(name, in: areaControls)
        replace(name, with: "Ending", in: areaControls)
        let hideKeyboard = app.keyboards.buttons["Hide keyboard"]
        if hideKeyboard.exists { hideKeyboard.tap() }
        let endingActions = app.buttons["preparation-area-actions-3"]
        PracticeUITestActions.reveal(endingActions, in: areaControls, toward: .earlier)
        endingActions.tap()
        app.buttons["Move earlier"].tap()
        app.segmentedControls["preparation-mode"].buttons["Reading order"].tap()
        let addPass = app.buttons["add-preparation-pass"]
        PracticeUITestActions.reveal(addPass, in: app.collectionViews["preparation-order-controls"])
        addPass.tap()
        PracticeUITestActions.sectionChoice(in: app, label: "Score").tap()
        PracticeUITestActions.reveal(app.staticTexts["preparation-pass-1"],
            in: app.collectionViews["preparation-order-controls"], toward: .earlier)
        XCTAssertTrue(app.staticTexts["preparation-pass-1"].waitForExistence(timeout: 5))
        capture("practice-reading-order-repeat")
        app.buttons["save-preparation"].tap()
        app.terminate()
        app.launchArguments = ["--smoke-test", "--reader-test-id", "practice-areas"]
        app.launch()
        openPreparation(app)
        app.segmentedControls["preparation-mode"].buttons["Reading order"].tap()
        PracticeUITestActions.reveal(app.staticTexts["preparation-pass-1"],
            in: app.collectionViews["preparation-order-controls"])
        XCTAssertTrue(app.staticTexts["preparation-pass-1"].waitForExistence(timeout: 5))
        app.segmentedControls["preparation-mode"].buttons["Areas"].tap()
        let removeActions = app.buttons["preparation-area-actions-2"]
        PracticeUITestActions.reveal(removeActions, in: areaControls)
        removeActions.tap()
        app.buttons["Remove area"].tap()
        app.buttons["Remove area"].tap()
        let areaRemoved = XCTNSPredicateExpectation(predicate: NSPredicate { _, _ in
            app.buttons["select-preparation-area-2"].label.contains("Bars 3–4")
        }, object: app)
        XCTAssertEqual(XCTWaiter.wait(for: [areaRemoved], timeout: 5), .completed)
        app.buttons["cancel-preparation"].tap()
        openPreparation(app)
        PracticeUITestActions.reveal(app.buttons["select-preparation-area-3"], in: areaControls)
        XCTAssertTrue(app.buttons["select-preparation-area-3"].waitForExistence(timeout: 5))
        XCUIDevice.shared.orientation = .portrait
        let portrait = XCTNSPredicateExpectation(predicate: NSPredicate { _, _ in
            app.frame.height > app.frame.width
        }, object: app)
        XCTAssertEqual(XCTWaiter.wait(for: [portrait], timeout: 10), .completed)
        capture("practice-preparation-portrait")
        app.buttons["cancel-preparation"].tap()
        app.buttons["score-options"].tap()
        app.buttons["view-original-pages"].tap()
        XCTAssertTrue(app.navigationBars["Original score"].waitForExistence(timeout: 5))
    }

    func testFractionalPickupAndMultipleTimingSegmentsSurviveColdReopen() {
        let app = launch("practice-timing")
        XCTAssertTrue(app.buttons["edit-timing-0"].waitForExistence(timeout: 15))
        app.buttons["edit-timing-0"].tap()
        let fields = app.collectionViews["timing-fields"]
        replace(app.textFields["timing-beats-0"], with: "1.25", in: fields)
        replace(app.textFields["timing-start-beat-0"], with: "4.5", in: fields)
        replace(app.textFields["timing-bpm-0"], with: "60", in: fields)
        let add = app.buttons["add-timing-segment"]
        PracticeUITestActions.reveal(add, in: fields)
        add.tap()
        let secondBeats = app.textFields["timing-beats-1"]
        replace(secondBeats, with: "4.5", in: fields)
        replace(app.textFields["timing-start-beat-1"], with: "1.5", in: fields)
        replace(app.textFields["timing-numerator-1"], with: "6", in: fields)
        replace(app.textFields["timing-denominator-1"], with: "8", in: fields)
        replace(app.textFields["timing-bpm-1"], with: "96", in: fields)
        let pulse = app.buttons["timing-pulse-1"]
        PracticeUITestActions.reveal(pulse, in: fields)
        pulse.tap()
        app.buttons["Dotted quarter"].tap()
        capture("practice-multiple-timing-segments")
        app.buttons["save-timing"].tap()
        app.terminate()
        app.launchArguments = ["--smoke-test", "--reader-test-id", "practice-timing"]
        app.launch()
        XCTAssertTrue(app.buttons["edit-timing-0"].waitForExistence(timeout: 15))
        app.buttons["edit-timing-0"].tap()
        XCTAssertEqual(app.textFields["timing-beats-0"].value as? String, "1.25")
        XCTAssertEqual(app.textFields["timing-start-beat-0"].value as? String, "4.5")
        PracticeUITestActions.reveal(app.textFields["timing-beats-1"], in: fields)
        XCTAssertEqual(app.textFields["timing-beats-1"].value as? String, "4.5")
        PracticeUITestActions.reveal(app.textFields["timing-start-beat-1"], in: fields)
        XCTAssertEqual(app.textFields["timing-start-beat-1"].value as? String, "1.5")
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

    private func replace(_ field: XCUIElement, with text: String, in form: XCUIElement) {
        PracticeUITestActions.reveal(field, in: form)
        XCTAssertTrue(field.waitForExistence(timeout: 5))
        let previous = field.value as? String ?? ""
        field.tap()
        field.typeText(String(repeating: XCUIKeyboardKey.delete.rawValue, count: previous.count) + text)
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
