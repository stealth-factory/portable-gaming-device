import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

// Every job runs on GitHub's standard hosted runners, which are free for a
// public repository (GAM-70): no self-hosted Macs, no paid larger runners
// (`-large`, `-xlarge`, custom names) and no runner picked by a variable or
// expression, which could quietly point a job back at either.
const WORKFLOWS = join(
  dirname(fileURLToPath(import.meta.url)),
  "../../.github/workflows",
);

// The Mac labels are listed, not patterned: a new image (xcode-28, macos-27)
// is a deliberate change here and in AGENTS.md, not something a typo or a
// guessed version slips through.
const MAC = new Set([
  "xcode-27", // Apple silicon, macOS 27 + Xcode 27: anything that builds the iOS app
  "macos-26", // other Apple silicon jobs
  "macos-26-intel", // Intel jobs
]);
const UBUNTU = /^ubuntu-(latest|\d\d\.\d\d)(-arm)?$/;
const standard = (label: string) => MAC.has(label) || UBUNTU.test(label);

/** The runner labels each job names, as written. */
function runnerLabels(src: string): { line: number; label: string }[] {
  const out: { line: number; label: string }[] = [];
  const lines = src.split("\n");
  lines.forEach((text, i) => {
    const m = /^\s*runs-on:\s*(.*?)\s*(#.*)?$/.exec(text);
    if (!m) return;
    let value = m[1];
    if (value === "") {
      // A block list: `- label` lines underneath. Blank and comment-only
      // lines inside the list are skipped, not the end. Anything else first
      // (a `group:`/`labels:` mapping, which picks a runner group) is
      // recorded as written, so it fails rather than passing with no labels.
      let found = false;
      for (let j = i + 1; j < lines.length; j++) {
        if (/^\s*(#.*)?$/.test(lines[j])) continue;
        const item = /^\s*-\s*(.+?)\s*(#.*)?$/.exec(lines[j]);
        if (!item) {
          if (!found) out.push({ line: j + 1, label: lines[j].trim() });
          break;
        }
        found = true;
        out.push({ line: j + 1, label: item[1] });
      }
      return;
    }
    if (value.startsWith("[") && value.endsWith("]")) {
      for (const part of value.slice(1, -1).split(","))
        out.push({ line: i + 1, label: part.trim() });
      return;
    }
    out.push({ line: i + 1, label: value });
  });
  return out.map(({ line, label }) => ({
    line,
    label: label.replace(/^['"]|['"]$/g, ""),
  }));
}

const files = readdirSync(WORKFLOWS).filter((f) => /\.ya?ml$/.test(f));

describe("workflow runners", () => {
  it("finds the workflows", () => {
    expect(files.length).toBeGreaterThan(0);
  });

  it.each(files)("%s runs only on standard GitHub-hosted runners", (file) => {
    const labels = runnerLabels(readFileSync(join(WORKFLOWS, file), "utf8"));
    const bad = labels
      .filter(({ label }) => !standard(label))
      .map(({ line, label }) => `${file}:${line} runs-on ${label}`);
    expect(
      bad,
      "use ubuntu-*, xcode-27, macos-26 or macos-26-intel (GAM-70)",
    ).toEqual([]);
  });

  it("reads the label forms jobs use", () => {
    const src = [
      "jobs:",
      "  a:",
      "    runs-on: xcode-27",
      "  b:",
      "    runs-on: ['self-hosted', macOS]",
      "  c:",
      "    runs-on:",
      "      - macos-26-intel",
      "      - xcode-27-xlarge",
      "  e:",
      "    runs-on:",
      "      # the Mac runner",
      "",
      "      - self-hosted",
      "      - macOS",
      "  f:",
      "    runs-on:",
      "      group: mac-runners",
      "      labels: self-hosted",
      "  d:",
      "    runs-on: ${{ fromJSON(vars.MACOS_RUNS_ON || '\"xcode-27\"') }}",
    ].join("\n");
    const labels = runnerLabels(src).map((l) => l.label);
    expect(labels).toEqual([
      "xcode-27",
      "self-hosted",
      "macOS",
      "macos-26-intel",
      "xcode-27-xlarge",
      "self-hosted",
      "macOS",
      "group: mac-runners",
      "${{ fromJSON(vars.MACOS_RUNS_ON || '\"xcode-27\"') }}",
    ]);
    expect(labels.map(standard)).toEqual([
      true,
      false,
      false,
      true,
      false,
      false,
      false,
      false,
      false,
    ]);
  });

  it("allows only the listed Mac labels", () => {
    for (const l of [
      "xcode-27",
      "macos-26",
      "macos-26-intel",
      "ubuntu-24.04",
      "ubuntu-latest",
    ])
      expect(standard(l), l).toBe(true);
    for (const l of [
      "macos-latest",
      "macos-15",
      "macos-99",
      "macos-99-intel",
      "xcode-99",
      "xcode-27-xlarge",
      "macos-26-large",
      "macos-26-xlarge",
    ])
      expect(standard(l), l).toBe(false);
  });
});
