import CoreGraphics
import Foundation

/// A low-res picture of palette indices 0 to 3, row-major, one byte per pixel: what native/core's
/// rasteriser draws into and what the CRT pass will read.
struct IndexPicture: Equatable, Sendable {
    let width: Int
    let height: Int
    private(set) var pixels: [UInt8]

    init(width: Int, height: Int, fill: UInt8 = 0) {
        self.width = max(0, width)
        self.height = max(0, height)
        pixels = Array(repeating: fill & 3, count: self.width * self.height)
    }

    subscript(x: Int, y: Int) -> UInt8 {
        pixels[y * width + x]
    }

    /// Fill a rectangle with one index, clipped to the picture.
    mutating func fillRect(x: Int, y: Int, w: Int, h: Int, index: UInt8) {
        let x0 = max(0, x), y0 = max(0, y)
        let x1 = min(width, x + w), y1 = min(height, y + h)
        guard x0 < x1, y0 < y1 else { return }
        for row in y0..<y1 {
            for col in x0..<x1 {
                pixels[row * width + col] = index & 3
            }
        }
    }

    /// The picture through a palette, as RGBA bytes.
    func rgba(_ palette: Phosphor) -> [UInt8] {
        var out = [UInt8](repeating: 255, count: pixels.count * 4)
        for (i, index) in pixels.enumerated() {
            let c = palette.colours[Int(index & 3)]
            out[i * 4] = c.r
            out[i * 4 + 1] = c.g
            out[i * 4 + 2] = c.b
        }
        return out
    }

    /// The picture through a palette, as an image to scale up without smoothing.
    func image(_ palette: Phosphor) -> CGImage? {
        guard width > 0, height > 0,
              let provider = CGDataProvider(data: Data(rgba(palette)) as CFData) else { return nil }
        return CGImage(
            width: width, height: height, bitsPerComponent: 8, bitsPerPixel: 32, bytesPerRow: width * 4,
            space: CGColorSpaceCreateDeviceRGB(),
            bitmapInfo: CGBitmapInfo(rawValue: CGImageAlphaInfo.noneSkipLast.rawValue),
            provider: provider, decode: nil, shouldInterpolate: false, intent: .defaultIntent)
    }
}

struct RGB: Equatable, Sendable {
    let r: UInt8, g: UInt8, b: UInt8
    init(_ r: UInt8, _ g: UInt8, _ b: UInt8) { self.r = r; self.g = g; self.b = b }
}

/// A phosphor mode's four colours and the set's bezel colours. Values from native/core/include/pgd/palettes.hpp
/// (generated from src/kit/platform/palettes.ts); the app reads the core's table once it links the core.
struct Phosphor: Sendable {
    let name: String
    let colours: [RGB]
    /// Highlight, body, shadow, plate ink, unlit glass.
    let bezel: [RGB]

    static let greenP1 = Phosphor(
        name: "GREEN P1",
        colours: [RGB(20, 14, 9), RGB(15, 90, 29), RGB(47, 191, 75), RGB(178, 255, 189)],
        bezel: [RGB(67, 71, 63), RGB(44, 47, 42), RGB(29, 31, 27), RGB(143, 151, 138), RGB(26, 18, 12)])
}
