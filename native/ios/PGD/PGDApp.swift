import SwiftUI

/// The PGD console as an iOS app. This first build is the set with a test pattern on the tube;
/// the engine core, the CRT pass and the games follow (GAM-35, GAM-36, GAM-37).
@main
struct PGDApp: App {
    var body: some Scene {
        WindowGroup {
            ConsoleView()
        }
    }
}
