import { describe, expect, it } from 'vitest';
import { readdirSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import { contractViolations, SCREEN_MEMBERS } from './contract-check';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../../..');
const walk = (dir: string): string[] => readdirSync(dir).flatMap(name => {
  const path = join(dir, name);
  return statSync(path).isDirectory() ? walk(path) : path.endsWith('.ts') ? [path] : [];
});
// registry.ts belongs to the browser host: its lazy imports are not part of a game disk.
const files = [...walk(join(ROOT, 'src/games')).filter(f => f !== join(ROOT, 'src/games/registry.ts')), ...walk(join(ROOT, 'src/kit/play'))];
const forbiddenNames = [
  'window', 'self', 'document', 'navigator', 'localStorage', 'sessionStorage', 'location',
  'setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'setImmediate', 'clearImmediate',
  'requestAnimationFrame', 'cancelAnimationFrame', 'requestIdleCallback', 'cancelIdleCallback',
  'fetch', 'performance', 'Date',
];
const cases: [string, string, string | null][] = [
  ...forbiddenNames.flatMap(name => [
    [`direct ${name}`, `void ${name};`, `banned global ${name}`],
    [`aliased globalThis ${name}`, `const env = globalThis; env.${name};`, `banned global ${name}`],
  ] satisfies [string, string, string | null][]),
  ['browser constructor alias', 'const Audio = globalThis.AudioContext; new Audio();', 'banned global AudioContext'],
  ['computed browser constructor', 'const env = globalThis; new env["Image"]();', 'banned global Image'],
  ['destructured browser constructor', 'const { XMLHttpRequest: Request } = globalThis; new Request();', 'banned global XMLHttpRequest'],
  ['other browser constructor', 'new WebSocket("wss://example.test/");', 'banned global WebSocket'],
  ['shim helpers', 'atob("AA=="); btoa("a"); console.log("debug");', null],
  ['standard constructors', 'new Map(); new Uint8Array(4); Math.random();', null],
  ['audio constructor', 'new AudioContext();', 'banned global AudioContext'],
  ['image constructor', 'new Image();', 'banned global Image'],
  ['request constructor', 'new XMLHttpRequest();', 'banned global XMLHttpRequest'],
  ['default global parameter', 'function load({ fetch: request } = globalThis) { request("/"); }', 'banned global fetch'],
  ['typed global parameter binding', 'function load({ fetch: request }: typeof globalThis) { request("/"); }', 'banned global fetch'],
  ['drawing parameter binding', 'function draw({ stroke }: import("../../../src/games/types").Screen2D) { stroke(); }', 'Screen2D has no stroke'],
  ['local parameter binding', 'function position({ location: x }: { location: number }) { return x; }', null],
  ['shorthand global', 'const env = { document }; env.document.createElement("canvas");', 'banned global document'],
  ['shorthand timer', 'const env = { setTimeout }; env.setTimeout(() => {}, 1);', 'banned global setTimeout'],
  ['browser self', 'self.document;', 'banned global document'],
  ['browser self alias', 'const env = self; env.fetch("/game");', 'banned global fetch'],
  ['ordinary g object', 'const state = { g: { score: 1 } }; state.g.score++;', null],
  ['ordinary g number', 'const colour = { g: 128 }; colour.g.toFixed(0);', null],
  ['ordinary destructured g', 'const { g: channel } = { g: 128 }; channel.toFixed(0);', null],
  ['direct global', 'document.createElement("canvas");', 'banned global document'],
  ['global alias', 'const dom = document; dom.createElement("canvas");', 'banned global document'],
  ['global property', 'globalThis.document;', 'banned global document'],
  ['global computed property', 'globalThis["Date"].now();', 'banned global Date'],
  ['global destructuring', 'const { fetch: request } = globalThis;', 'banned global fetch'],
  ['aliased global destructuring', 'const env = globalThis; const { document: dom } = env;', 'banned global document'],
  ['typed global parameter', 'function probe(env: typeof globalThis) { env.navigator; }', 'banned global navigator'],
  ['chained global alias', 'const env = globalThis; const other = env; other.performance;', 'banned global performance'],
  ['cast global alias', 'const env = globalThis; (env as any)["sessionStorage"];', 'banned global sessionStorage'],
  ['computed global member', 'const env = globalThis; declare const key: string; env[key];', 'banned global computed member'],
  ['timer', 'setTimeout(() => {}, 1);', 'banned global setTimeout'],
  ['dynamic import', 'import("./anything");', 'banned dynamic import()'],
  ['direct canvas member', 'api.g.drawImage(null, 0, 0);', 'Screen2D has no drawImage'],
  ['aliased canvas member', 'const surface = api.g; surface.stroke();', 'Screen2D has no stroke'],
  ['destructured canvas', 'const { g: surface } = api; surface.canvas;', 'Screen2D has no canvas'],
  ['computed canvas member', 'api.g["getImageData"]();', 'Screen2D has no getImageData'],
  ['destructured member', 'const { strokeRect } = api.g;', 'Screen2D has no strokeRect'],
  ['cast API escape', '(api as any).g.stroke();', 'Screen2D has no stroke'],
  ['aliased cast API', 'const borrowed = api as any; borrowed["g"].stroke();', 'Screen2D has no stroke'],
  ['destructured cast API', 'const { g: surface } = api as any; surface.stroke();', 'Screen2D has no stroke'],
  ['local shorthand', 'const document = 1; const labels = { document }; void labels.document;', null],
  ['cast escape', '(api.g as any).stroke();', 'Screen2D has no stroke'],
  ['unknown computed member', 'const name = "stroke"; api.g[name]();', 'Screen2D has no computed member'],
  ['portable drawing', 'const surface = api.g; surface.fillStyle = api.col("window"); surface.fillRect(0, 0, 1, 1); Math.random();', null],
  ['prose and local names', '// document, fetch and Date are not available\nconst labels = { document: "window Date", window: "navigator" }; const env = labels; void env.document; const location = 1; void location;', null],
] satisfies [string, string, string | null][];
const virtualFiles = new Map(cases.map(([name, code], index) => [
  join(ROOT, `tests/unit/kit/contract-case-${index}.ts`),
  `import type { ConsoleAPI } from '../../../src/games/types';\ndeclare const api: ConsoleAPI;\n${code}\nexport {}; // ${name}`,
]));
// An independent v1 shape catches changed parameter, return and property types as well as added members.
const frozenSurface = `
interface FrozenScreen2D {
  fillStyle: string;
  fillRect(x: number, y: number, w: number, h: number): void;
  beginPath(): void;
  rect(x: number, y: number, w: number, h: number): void;
  moveTo(x: number, y: number): void;
  lineTo(x: number, y: number): void;
  arc(x: number, y: number, radius: number, startAngle: number, endAngle: number, counterclockwise?: boolean): void;
  arcTo(x1: number, y1: number, x2: number, y2: number, radius: number): void;
  closePath(): void;
  fill(): void;
  clip(): void;
  save(): void;
  restore(): void;
  translate(x: number, y: number): void;
  rotate(angle: number): void;
  scale(x: number, y: number): void;
  setTransform(a: number, b: number, c: number, d: number, e: number, f: number): void;
  font: string;
  measureText(s: string): { width: number };
}
type Equal<A, B> = (<T>() => T extends A ? 1 : 2) extends (<T>() => T extends B ? 1 : 2) ? true : false;
`;
const surfaceCases: [string, string, boolean][] = [
  ['matches the v1 signatures', 'Screen2D', true],
  ['rejects browser-only colour types', "Omit<Screen2D, 'fillStyle'> & { fillStyle: CanvasGradient }", false],
  ['rejects changed drawing arguments', "Omit<Screen2D, 'fillRect'> & { fillRect(x: string, y: number, w: number, h: number): void }", false],
  ['rejects changed measurement results', "Omit<Screen2D, 'measureText'> & { measureText(s: string): TextMetrics }", false],
];
for (const [index, [_name, candidate]] of surfaceCases.entries()) {
  virtualFiles.set(join(ROOT, `tests/unit/kit/surface-case-${index}.ts`), `
    import type { Screen2D } from '../../../src/games/types';
    ${frozenSurface}
    declare const matches: Equal<${candidate}, FrozenScreen2D>;
    const portable: true = matches;
  `);
}
const config = ts.readConfigFile(join(ROOT, 'tsconfig.json'), ts.sys.readFile);
const { options } = ts.parseJsonConfigFileContent(config.config, ts.sys, ROOT);
const host = ts.createCompilerHost(options);
const readFile = host.readFile.bind(host), fileExists = host.fileExists.bind(host);
host.readFile = path => virtualFiles.get(path) ?? readFile(path);
host.fileExists = path => virtualFiles.has(path) || fileExists(path);
const program = ts.createProgram([...files, ...virtualFiles.keys()], options, host);
const checker = program.getTypeChecker();
const sourceOf = (path: string) => {
  const source = program.getSourceFile(path);
  if (!source) throw new Error(`Missing contract source ${relative(ROOT, path)}`);
  return source;
};

describe('disk contract v1', () => {
  it('keeps Screen2D limited to the frozen drawing surface', () => {
    const source = sourceOf(join(ROOT, 'src/games/types.ts'));
    const declaration = source.statements.find(s => ts.isInterfaceDeclaration(s) && s.name.text === 'Screen2D');
    if (!declaration || !ts.isInterfaceDeclaration(declaration)) throw new Error('Screen2D is missing');
    expect(declaration.heritageClauses).toBeUndefined();
    expect(declaration.members.map(m => m.name?.getText(source)).sort()).toEqual([...SCREEN_MEMBERS].sort());
  });
  it.each(surfaceCases.map(([name, _candidate, valid], index) => [name, index, valid] satisfies [string, number, boolean]))('%s', (_name, index, valid) => {
    const diagnostics = program.getSemanticDiagnostics(sourceOf(join(ROOT, `tests/unit/kit/surface-case-${index}.ts`)));
    expect(diagnostics.length === 0).toBe(valid);
  });
  it.each(files.map(path => [relative(ROOT, path), path]))('%s uses only portable globals and Screen2D members', (_name, path) => {
    expect(contractViolations(sourceOf(path), checker)).toEqual([]);
  });
  it.each(cases.map(([name, _code, expected], index) => [name, index, expected] satisfies [string, number, string | null]))('checks %s', (_name, index, expected) => {
    const failures = contractViolations(sourceOf([...virtualFiles.keys()][index]), checker);
    if (expected === null) expect(failures).toEqual([]);
    else expect(failures.join('\n')).toContain(expected);
  });
});
