import { decode, loadShim } from '../../native/shim/decode.mjs';

const CELL = 24;
const DIRS = { up: { dx: 0, dy: -1 }, down: { dx: 0, dy: 1 }, left: { dx: -1, dy: 0 }, right: { dx: 1, dy: 0 } };
const SLOTS = ['fire', 'boost', 'fireL', 'fireR', 'pad1', 'pad2', 'pad3', 'pad4', 'pad5', 'pad6'];

/** Parse the JSON boundary once, before any disk code runs. */
export function parseScript(value) {
  object(value, 'script');
  keys(value, ['frames', 'seed', 'grid', 'palette', 'events'], 'script');
  const frames = integer(value.frames ?? 360, 1, 36000, 'frames');
  const seed = integer(value.seed ?? 1, 0, 0xffffffff, 'seed');
  const grid = value.grid ?? { w: 15, h: 10 };
  object(grid, 'grid'); keys(grid, ['w', 'h'], 'grid');
  integer(grid.w, 10, 17, 'grid.w'); integer(grid.h, 7, 22, 'grid.h');
  const palette = value.palette ?? 'greenP1';
  if (typeof palette !== 'string') throw new Error('palette must be a mode name');
  const events = value.events ?? [];
  if (!Array.isArray(events)) throw new Error('events must be an array');
  let previous = -1;
  for (const event of events) {
    object(event, 'event'); keys(event, ['frame', 'held', 'stickDir', 'buttons', 'press', 'tap'], 'event');
    integer(event.frame, 0, frames - 1, 'event.frame');
    if (event.frame < previous) throw new Error('events must be ordered by frame');
    previous = event.frame;
    if (event.held !== undefined && (!Array.isArray(event.held) || event.held.some(d => !Object.hasOwn(DIRS, d)) || new Set(event.held).size !== event.held.length)) throw new Error('held must contain distinct directions, newest last');
    if (event.stickDir !== undefined && event.stickDir !== null && !Object.hasOwn(DIRS, event.stickDir)) throw new Error('stickDir must be a direction or null');
    if (event.buttons !== undefined) {
      object(event.buttons, 'buttons'); keys(event.buttons, SLOTS, 'buttons');
      if (Object.values(event.buttons).some(v => typeof v !== 'boolean')) throw new Error('button values must be booleans');
    }
    if (event.press !== undefined && (!Array.isArray(event.press) || event.press.some(id => !SLOTS.includes(id)))) throw new Error('press must contain button slot names');
    if (event.tap !== undefined) {
      object(event.tap, 'tap'); keys(event.tap, ['held', 'x'], 'tap');
      if (typeof event.tap.held !== 'boolean' || !Number.isFinite(event.tap.x) || event.tap.x < 0 || event.tap.x >= grid.w * CELL) throw new Error('tap needs held and an x within the tube');
    }
  }
  return { frames, seed, grid, palette, events };
}
function object(value, name) { if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${name} must be an object`); }
function keys(value, allowed, name) { for (const key of Object.keys(value)) if (!allowed.includes(key)) throw new Error(`Unknown ${name} field: ${key}`); }
function integer(value, min, max, name) { if (!Number.isInteger(value) || value < min || value > max) throw new Error(`${name} must be an integer from ${min} to ${max}`); return value; }

/**
 * The disk's api and frame loop come from the contract shim the apps run (native/shim/shim.js), so every recorded
 * command has been through its command buffer and back. Pass `shim` to use the PGDShim loaded in the disk's own realm.
 */
export function makeHost({ disk, script, palette, measurePixelText, shim = loadShim() }) {
  const host = shim.createShim({ disk, grid: script.grid, palette, measurePixelText });
  return {
    api: host.api,
    takeCommands: () => decode(host.take()),
    state: host.state,
    input: host.input,
    step: host.step,
  };
}
