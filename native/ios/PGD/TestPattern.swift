/// The tube's picture until the engine core is linked: a frame, the console's name in its 3 × 5
/// pixel letters, and a bar of all four palette indices.
enum TestPattern {
    static let width = 160
    static let height = 120

    static func make(width: Int = width, height: Int = height) -> IndexPicture {
        var p = IndexPicture(width: width, height: height)
        // Frame.
        p.fillRect(x: 2, y: 2, w: width - 4, h: 1, index: 1)
        p.fillRect(x: 2, y: height - 3, w: width - 4, h: 1, index: 1)
        p.fillRect(x: 2, y: 2, w: 1, h: height - 4, index: 1)
        p.fillRect(x: width - 3, y: 2, w: 1, h: height - 4, index: 1)
        // Corner checks.
        for (cx, cy) in [(6, 6), (width - 14, 6), (6, height - 14), (width - 14, height - 14)] {
            for i in 0..<4 {
                for j in 0..<4 where (i + j) % 2 == 0 {
                    p.fillRect(x: cx + i * 2, y: cy + j * 2, w: 2, h: 2, index: 2)
                }
            }
        }
        text(&p, "PGD-01", centreX: width / 2, y: height / 2 - 26, scale: 4, index: 3)
        text(&p, "NO DISK", centreX: width / 2, y: height / 2 + 2, scale: 2, index: 2)
        // A bar of the four indices.
        let barW = 16, barX = width / 2 - barW * 2, barY = height - 30
        for i in 0..<4 {
            p.fillRect(x: barX + i * barW, y: barY, w: barW, h: 8, index: UInt8(i))
        }
        p.fillRect(x: barX - 1, y: barY - 1, w: barW * 4 + 2, h: 1, index: 1)
        p.fillRect(x: barX - 1, y: barY + 8, w: barW * 4 + 2, h: 1, index: 1)
        return p
    }

    static let glyphs: [Character: [String]] = [
        "P": ["111", "101", "111", "100", "100"],
        "G": ["111", "100", "101", "101", "111"],
        "D": ["110", "101", "101", "101", "110"],
        "-": ["000", "000", "111", "000", "000"],
        "0": ["111", "101", "101", "101", "111"],
        "1": ["010", "110", "010", "010", "111"],
        "N": ["110", "101", "101", "101", "101"],
        "O": ["111", "101", "101", "101", "111"],
        "I": ["111", "010", "010", "010", "111"],
        "S": ["111", "100", "111", "001", "111"],
        "K": ["101", "101", "110", "101", "101"],
        " ": ["000", "000", "000", "000", "000"],
    ]

    /// Width in pixels of a line of 3 × 5 letters, one blank column between them.
    static func textWidth(_ s: String, scale: Int) -> Int {
        s.isEmpty ? 0 : (s.count * 4 - 1) * scale
    }

    static func text(_ p: inout IndexPicture, _ s: String, centreX: Int, y: Int, scale: Int, index: UInt8) {
        var x = centreX - textWidth(s, scale: scale) / 2
        for ch in s {
            if let rows = glyphs[ch] {
                for (row, bits) in rows.enumerated() {
                    for (col, bit) in bits.enumerated() where bit == "1" {
                        p.fillRect(x: x + col * scale, y: y + row * scale, w: scale, h: scale, index: index)
                    }
                }
            }
            x += 4 * scale
        }
    }
}
