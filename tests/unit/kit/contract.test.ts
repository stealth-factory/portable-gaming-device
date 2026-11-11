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
  'window', 'document', 'navigator', 'localStorage', 'sessionStorage', 'location',
  'setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'setImmediate', 'clearImmediate',
  'requestAnimationFrame', 'cancelAnimationFrame', 'requestIdleCallback', 'cancelIdleCallback',
  'fetch', 'performance', 'Date',
];
const cases: [string, string, string | null][] = [
  ...forbiddenNames.flatMap(name => [
    [`direct ${name}`, `void ${name};`, `banned global ${name}`],
    [`aliased globalThis ${name}`, `const env = globalThis; env.${name};`, `banned global ${name}`],
  ] satisfies [string, string, string | null][]),
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
  ['cast escape', '(api.g as any).stroke();', 'Screen2D has no stroke'],
  ['unknown computed member', 'const name = "stroke"; api.g[name]();', 'Screen2D has no computed member'],
  ['portable drawing', 'const surface = api.g; surface.fillStyle = api.col("window"); surface.fillRect(0, 0, 1, 1); Math.random();', null],
  ['prose and local names', '// document, fetch and Date are not available\nconst labels = { document: "window Date", window: "navigator" }; const env = labels; void env.document; const location = 1; void location;', null],
] satisfies [string, string, string | null][];
const virtualFiles = new Map(cases.map(([name, code], index) => [
  join(ROOT, `tests/unit/kit/contract-case-${index}.ts`),
  `import type { ConsoleAPI } from '../../../src/games/types';\ndeclare const api: ConsoleAPI;\n${code}\nexport {}; // ${name}`,
]));
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
  it.each(files.map(path => [relative(ROOT, path), path]))('%s uses only portable globals and Screen2D members', (_name, path) => {
    expect(contractViolations(sourceOf(path), checker)).toEqual([]);
  });
  it.each(cases.map(([name, _code, expected], index) => [name, index, expected] satisfies [string, number, string | null]))('checks %s', (_name, index, expected) => {
    const failures = contractViolations(sourceOf([...virtualFiles.keys()][index]), checker);
    if (expected === null) expect(failures).toEqual([]);
    else expect(failures.join('\n')).toContain(expected);
  });
});
