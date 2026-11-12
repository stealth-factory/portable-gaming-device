import SwiftUI

extension RGB {
    var color: Color { Color(red: Double(r) / 255, green: Double(g) / 255, blue: Double(b) / 255) }
}

/// The set: the tube in its bezel, the nameplate, and POWER. A first cut of the web layouts;
/// the stick, FIRE row, switches and dial follow with the engine (GAM-37).
struct ConsoleView: View {
    @State private var powered = true
    private let phosphor = Phosphor.greenP1
    private let picture = TestPattern.make()

    private var version: String {
        Bundle.main.object(forInfoDictionaryKey: "CFBundleShortVersionString") as? String ?? ""
    }

    var body: some View {
        GeometryReader { geo in
            let layout = SetLayout.pick(geo.size)
            ZStack {
                LinearGradient(
                    colors: [phosphor.bezel[0].color, phosphor.bezel[1].color, phosphor.bezel[2].color],
                    startPoint: .top, endPoint: .bottom)
                .ignoresSafeArea()

                if layout == .console {
                    HStack(spacing: 24) {
                        tube
                        panel(layout)
                            .frame(maxWidth: 220)
                    }
                    .padding(20)
                } else {
                    VStack(spacing: 24) {
                        tube
                        panel(layout)
                        Spacer(minLength: 0)
                    }
                    .padding(20)
                }
            }
        }
        .preferredColorScheme(.dark)
        .statusBarHidden(true)
        .persistentSystemOverlays(.hidden)
    }

    private var tube: some View {
        ZStack {
            phosphor.bezel[4].color
            if let image = picture.image(phosphor) {
                Image(decorative: image, scale: 1)
                    .resizable()
                    .interpolation(.none)
                    .overlay(Scanlines().allowsHitTesting(false))
                    .overlay(
                        RadialGradient(
                            colors: [.clear, .black.opacity(0.55)],
                            center: .center, startRadius: 40, endRadius: 420)
                        .allowsHitTesting(false))
                    // Power-off collapse: the picture folds to a line, then goes.
                    .scaleEffect(x: powered ? 1 : 0.9, y: powered ? 1 : 0.004)
                    .opacity(powered ? 1 : 0)
                    .animation(.easeIn(duration: 0.25), value: powered)
            }
        }
        .aspectRatio(CGFloat(TestPattern.width) / CGFloat(TestPattern.height), contentMode: .fit)
        .clipShape(RoundedRectangle(cornerRadius: 28, style: .continuous))
        .padding(14)
        .background(
            RoundedRectangle(cornerRadius: 36, style: .continuous)
                .fill(Color(red: 13 / 255, green: 11 / 255, blue: 8 / 255)))
        .accessibilityElement()
        .accessibilityLabel("Screen")
        .accessibilityValue(powered ? "Test pattern" : "Off")
    }

    private func panel(_ layout: SetLayout) -> some View {
        VStack(spacing: 16) {
            HStack(spacing: 6) {
                Text("PGD")
                    .font(.system(size: 22, weight: .black, design: .monospaced))
                if layout != .phonePortrait {
                    Text("· PORTABLE GAMING DEVICE")
                        .font(.system(size: 13, weight: .bold, design: .monospaced))
                        .lineLimit(1)
                        .minimumScaleFactor(0.6)
                }
            }
            .foregroundStyle(Color(red: 31 / 255, green: 29 / 255, blue: 25 / 255))
            .padding(.horizontal, 14)
            .padding(.vertical, 8)
            .background(
                RoundedRectangle(cornerRadius: 6)
                    .fill(LinearGradient(
                        colors: [Color(red: 0.93, green: 0.91, blue: 0.87), Color(red: 0.55, green: 0.54, blue: 0.5)],
                        startPoint: .top, endPoint: .bottom)))
            .accessibilityElement(children: .combine)

            Text("PGD-01 · \(phosphor.name)")
                .font(.system(size: 11, weight: .semibold, design: .monospaced))
                .foregroundStyle(phosphor.bezel[3].color)
            if !version.isEmpty {
                Text("v\(version)")
                    .font(.system(size: 10, design: .monospaced))
                    .foregroundStyle(phosphor.bezel[3].color.opacity(0.7))
            }

            Button {
                powered.toggle()
            } label: {
                VStack(spacing: 6) {
                    Circle()
                        .fill(powered ? phosphor.colours[3].color : phosphor.bezel[2].color)
                        .frame(width: 10, height: 10)
                        .shadow(color: powered ? phosphor.colours[2].color : .clear, radius: 6)
                    Text("POWER")
                        .font(.system(size: 12, weight: .bold, design: .monospaced))
                        .foregroundStyle(.white.opacity(0.9))
                        .padding(.horizontal, 18)
                        .padding(.vertical, 10)
                        .background(
                            RoundedRectangle(cornerRadius: 8)
                                .fill(Color(red: 0.71, green: 0.16, blue: 0.13)))
                }
            }
            .buttonStyle(.plain)
            .sensoryFeedback(.impact(weight: .light), trigger: powered)
            .accessibilityLabel("Power")
            .accessibilityValue(powered ? "On" : "Off")
        }
    }
}

/// Dark lines across the picture, like the web's scanline pass at its default strength.
private struct Scanlines: View {
    var body: some View {
        Canvas { ctx, size in
            var y: CGFloat = 0
            while y < size.height {
                ctx.fill(Path(CGRect(x: 0, y: y, width: size.width, height: 1)), with: .color(.black.opacity(0.28)))
                y += 3
            }
        }
    }
}

#Preview {
    ConsoleView()
}
