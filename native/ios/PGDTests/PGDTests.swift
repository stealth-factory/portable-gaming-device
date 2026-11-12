import XCTest
@testable import PGD

final class PGDTests: XCTestCase {
    func testPatternUsesEveryIndexAndNothingElse() {
        let p = TestPattern.make()
        XCTAssertEqual(p.width, TestPattern.width)
        XCTAssertEqual(p.height, TestPattern.height)
        XCTAssertEqual(p.pixels.count, p.width * p.height)
        XCTAssertEqual(Set(p.pixels), [0, 1, 2, 3])
    }

    func testFillRectClipsToThePicture() {
        var p = IndexPicture(width: 4, height: 3)
        p.fillRect(x: -2, y: 2, w: 10, h: 10, index: 7)
        XCTAssertEqual(p.pixels, [0, 0, 0, 0, 0, 0, 0, 0, 3, 3, 3, 3])
    }

    func testPaletteLookup() {
        var p = IndexPicture(width: 2, height: 1)
        p.fillRect(x: 1, y: 0, w: 1, h: 1, index: 3)
        XCTAssertEqual(p.rgba(.greenP1), [20, 14, 9, 255, 178, 255, 189, 255])
        XCTAssertNotNil(p.image(.greenP1))
    }

    func testLayoutFollowsTheWebRule() {
        XCTAssertEqual(SetLayout.pick(CGSize(width: 874, height: 402)), .console)
        XCTAssertEqual(SetLayout.pick(CGSize(width: 402, height: 874)), .phonePortrait)
        XCTAssertEqual(SetLayout.pick(CGSize(width: 744, height: 1133)), .tabletPortrait)
        XCTAssertEqual(SetLayout.pick(CGSize(width: 500, height: 500)), .phonePortrait)
    }
}
