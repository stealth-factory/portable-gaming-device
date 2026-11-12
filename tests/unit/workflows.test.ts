import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

// Every job runs on GitHub's standard hosted runners, which are free for a
// public repository (GAM-70): no self-hosted Macs, no paid larger runners
// (`-large`, `-xlarge`, custom names) and no runner picked by a variable or
// expression, which could quietly point a job back at either.
const WORKFLOWS = join(dirname(fileURLToPath(import.meta.url)), '../../.github/workflows');

const STANDARD = [
  /^ubuntu-(latest|\d\d\.\d\d)(-arm)?$/,
  /^macos-(latest|\d+)$/, // Apple silicon
  /^macos-\d+-intel$/, // Intel
  /^xcode-\d+$/, // Apple silicon, the Xcode image
];

/** The runner labels each job names, as written. */
function runnerLabels(src: string): { line: number; label: string }[] {
  const out: { line: number; label: string }[] = [];
  const lines = src.split('\n');
  lines.forEach((text, i) => {
    const m = /^\s*runs-on:\s*(.*?)\s*(#.*)?$/.exec(text);
    if (!m) return;
    let value = m[1];
    if (value === '') {
      // A block list: `- label` lines underneath.
      for (let j = i + 1; j < lines.length; j++) {
        const item = /^\s*-\s*(.+?)\s*(#.*)?$/.exec(lines[j]);
        if (!item) break;
        out.push({ line: j + 1, label: item[1] });
      }
      return;
    }
    if (value.startsWith('[') && value.endsWith(']')) {
      for (const part of value.slice(1, -1).split(',')) out.push({ line: i + 1, label: part.trim() });
      return;
    }
    out.push({ line: i + 1, label: value });
  });
  return out.map(({ line, label }) => ({ line, label: label.replace(/^['"]|['"]$/g, '') }));
}

const files = readdirSync(WORKFLOWS).filter(f => /\.ya?ml$/.test(f));

describe('workflow runners', () => {
  it('finds the workflows', () => {
    expect(files.length).toBeGreaterThan(0);
  });

  it.each(files)('%s runs only on standard GitHub-hosted runners', file => {
    const labels = runnerLabels(readFileSync(join(WORKFLOWS, file), 'utf8'));
    const bad = labels
      .filter(({ label }) => !STANDARD.some(re => re.test(label)))
      .map(({ line, label }) => `${file}:${line} runs-on ${label}`);
    expect(bad, 'use ubuntu-*, macos-<n>, macos-<n>-intel or xcode-<n> (GAM-70)').toEqual([]);
  });

  it('reads the label forms jobs use', () => {
    const src = [
      'jobs:',
      '  a:',
      '    runs-on: xcode-27',
      '  b:',
      "    runs-on: ['self-hosted', macOS]",
      '  c:',
      '    runs-on:',
      '      - macos-26-intel',
      '      - xcode-27-xlarge',
      '  d:',
      "    runs-on: ${{ fromJSON(vars.MACOS_RUNS_ON || '\"xcode-27\"') }}",
    ].join('\n');
    const labels = runnerLabels(src).map(l => l.label);
    expect(labels).toEqual([
      'xcode-27',
      'self-hosted',
      'macOS',
      'macos-26-intel',
      'xcode-27-xlarge',
      "${{ fromJSON(vars.MACOS_RUNS_ON || '\"xcode-27\"') }}",
    ]);
    const ok = (l: string) => STANDARD.some(re => re.test(l));
    expect(labels.map(ok)).toEqual([true, false, false, true, false, false]);
  });
});
