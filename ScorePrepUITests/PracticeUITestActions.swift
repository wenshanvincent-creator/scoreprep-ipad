import XCTest

enum PracticeUITestActions {
    enum SearchDirection { case earlier, later }

    static func openExercise(in app: XCUIApplication) {
        XCTAssertTrue(app.buttons["score-options"].waitForExistence(timeout: 15))
        let exercise = app.buttons["open-practice-exercise"]
        if !exercise.isHittable {
            let sidebar = app.buttons["ToggleSidebar"]
            XCTAssertTrue(sidebar.waitForExistence(timeout: 5))
            sidebar.tap()
        }
        XCTAssertTrue(exercise.waitForExistence(timeout: 5))
        XCTAssertTrue(exercise.isHittable)
        exercise.tap()
        XCTAssertTrue(app.navigationBars["Pickup and pulse"].waitForExistence(timeout: 15))
        let hideSidebar = app.buttons.matching(NSPredicate(format: "identifier == %@ AND label == %@",
            "ToggleSidebar", "Hide Sidebar")).firstMatch
        if hideSidebar.exists { hideSidebar.tap() }
    }

    static func landscape(_ app: XCUIApplication) {
        XCUIDevice.shared.orientation = .landscapeLeft
        let expectation = XCTNSPredicateExpectation(predicate: NSPredicate { _, _ in
            app.frame.width > app.frame.height
        }, object: app)
        XCTAssertEqual(XCTWaiter.wait(for: [expectation], timeout: 10), .completed)
    }

    static func reveal(_ element: XCUIElement, in form: XCUIElement,
                       toward direction: SearchDirection = .later,
                       file: StaticString = #filePath, line: UInt = #line) {
        XCTAssertTrue(form.waitForExistence(timeout: 5), file: file, line: line)
        for _ in 0..<10 {
            // isHittable alone accepts a partly clipped Form row. Keep the
            // entire target inside its actual scrolling viewport before tap.
            if element.exists && element.isHittable,
               form.frame.insetBy(dx: 0, dy: 12).contains(element.frame) { return }
            switch direction {
            case .later: form.swipeUp(velocity: .slow)
            case .earlier: form.swipeDown(velocity: .slow)
            }
        }
        XCTFail("Could not reveal \(element.debugDescription) inside the form", file: file, line: line)
    }

    static func sectionChoice(in app: XCUIApplication, prefix: String, label: String) -> XCUIElement {
        let choice = app.buttons.matching(NSPredicate(format: "identifier BEGINSWITH %@", prefix)).firstMatch
        XCTAssertTrue(choice.waitForExistence(timeout: 5))
        XCTAssertEqual(choice.label, label)
        XCTAssertTrue(choice.isHittable)
        return choice
    }
}
