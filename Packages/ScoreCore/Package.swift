// swift-tools-version: 5.10
import PackageDescription

let package = Package(
    name: "ScoreCore",
    platforms: [.iOS("18.0"), .macOS(.v13)],
    products: [.library(name: "ScoreCore", targets: ["ScoreCore"])],
    targets: [
        .target(name: "ScoreCore"),
        .testTarget(name: "ScoreCoreTests", dependencies: ["ScoreCore"])
    ]
)
