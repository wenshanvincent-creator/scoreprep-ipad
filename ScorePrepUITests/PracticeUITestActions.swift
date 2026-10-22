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
        let practice = app.buttons["open-practice"]
        let readerReady = XCTNSPredicateExpectation(predicate: NSPredicate { _, _ in
            practice.exists && practice.isHittable
        }, object: practice)
        XCTAssertEqual(XCTWaiter.wait(for: [readerReady], timeout: 10), .completed)
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
        var searchDirection = direction
        var sawTarget = false
        for _ in 0..<10 {
            let viewport = form.frame.insetBy(dx: 0, dy: 12)
            let maxDrag = min(120, viewport.height * 0.25)
            var distance = maxDrag
            if element.exists {
                let target = element.frame
                sawTarget = viewport.intersects(target)
                // SwiftUI Menu.isHittable is false for visible rows on this
                // SDK (rdar://59288308). Callers still tap normally and assert
                // the resulting action; this helper only establishes visibility.
                if viewport.contains(target) { return }
                if target.maxY > viewport.maxY {
                    searchDirection = .later
                    distance = min(maxDrag, max(32, target.maxY - viewport.maxY + 12))
                } else if target.minY < viewport.minY {
                    searchDirection = .earlier
                    distance = min(maxDrag, max(32, viewport.minY - target.minY + 12))
                }
            } else if sawTarget {
                // A target lost immediately after a drag was passed. Search
                // back toward it instead of continuing to the form's end.
                searchDirection = searchDirection == .later ? .earlier : .later
                sawTarget = false
            }
            let offset = searchDirection == .later ? -distance : distance
            // The inset Form gutter scrolls without touching text or sliders.
            let start = form.coordinate(withNormalizedOffset: CGVector(dx: 0.01, dy: 0.5))
            let end = start.withOffset(CGVector(dx: 0, dy: offset))
            start.press(forDuration: 0.05, thenDragTo: end, withVelocity: .slow, thenHoldForDuration: 0.2)
        }
        XCTFail("Could not reveal \(element.debugDescription) inside the form", file: file, line: line)
    }

    static func sectionChoice(in app: XCUIApplication, label: String) -> XCUIElement {
        let choice = app.buttons[label]
        XCTAssertTrue(choice.waitForExistence(timeout: 5))
        XCTAssertEqual(choice.label, label)
        XCTAssertTrue(choice.isHittable)
        return choice
    }
}
