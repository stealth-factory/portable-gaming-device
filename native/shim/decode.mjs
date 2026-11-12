// Reads the shim's command buffer (native/shim/README.md) back into stream-format-1 commands, the arrays
// tools/conformance writes. The conformance runner draws through the shim and this decoder, so its recorded
// streams prove that the buffer carries everything a disk drew. Node only; the apps decode in C++.
import { readFileSync } from 'node:fs';
import { runInThisContext } from 'node:vm';

const SOURCE = readFileSync(new URL('./shim.js', import.meta.url), 'utf8');

/** Load the shim into this realm (or another, given a vm context's runner) and return its PGDShim. */
export function loadShim(run = code => runInThisContext(code, { filename: 'native/shim/shim.js' })) {
  return run(`${SOURCE}\nPGDShim;`);
}

const { VERSION, OPS, TAG } = loadShim();
export { VERSION, OPS, TAG };

/** One frame of the buffer, { version, ops, strings, blobs }, as an array of [name, ...args] commands. */
export function decode(frame) {
  if (frame.version !== VERSION) throw new Error(`Unknown command buffer version ${frame.version}`);
  const { ops, strings, blobs } = frame, out = [];
  let at = 0;
  const arg = () => {
    const tag = ops[at++], value = ops[at++];
    switch (tag) {
      case TAG.number: return value;
      case TAG.boolean: return value === 1;
      case TAG.string: return strings[value];
      case TAG.null: return null;
      case TAG.undefined: return undefined;
      case TAG.json: return JSON.parse(strings[value]);
      case TAG.blob: return Buffer.from(blobs[value]).toString('base64');
      default: throw new Error(`Unknown argument tag ${tag} at ${at - 2}`);
    }
  };
  while (at < ops.length) {
    const op = ops[at++], name = OPS[op], count = ops[at++];
    if (!name) throw new Error(`Unknown opcode ${op} at ${at - 2}`);
    const command = [name];
    for (let i = 0; i < count; i++) command.push(arg());
    out.push(command);
  }
  return out;
}
