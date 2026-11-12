import CoreGraphics

/// The web console's layouts, picked from the window's size with the web's rule (never the device model),
/// so the iPhone Duo's fold and iPad Split View are just size changes.
enum SetLayout: String, Sendable {
    case console
    case tabletPortrait = "tablet-portrait"
    case phonePortrait = "phone-portrait"

    static func pick(_ size: CGSize) -> SetLayout {
        if size.width > size.height { return .console }
        return min(size.width, size.height) >= 700 ? .tabletPortrait : .phonePortrait
    }
}
