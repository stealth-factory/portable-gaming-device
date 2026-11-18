/* The on-screen D-pad's logic, without the DOM (GAM-112). The joystick's well has a small switch with three settings:
   STICK, the floating thumb-stick (stick.ts); D-PAD, a fixed cross with four directions, like a handheld's; and 8-WAY,
   the same cross where pressing between two arms holds both.

   Unlike the stick, the cross does not move: the direction comes from where the finger is against the cross's centre,
   anywhere in the well, so a thumb can roll from arm to arm without lifting. A small dead spot in the middle holds
   nothing. Four directions use the stick's axis hysteresis; eight turn each axis on past about 24° from the other and
   off below about 18°, so a thumb resting near a boundary does not flicker.

   `dirs` holds one direction, or two on an 8-way diagonal; `dir` (the first of them) is the stronger axis, and stays
   the one already held while that is still held, so a game that reads one direction sees no jitter. */
import { BIAS, type Dir } from './stick';

export type PadMode = 'stick' | 'dpad' | 'dpad8';
/** The switch's settings in the order a press steps through them. */
export const PAD_MODES: readonly PadMode[] = ['stick', 'dpad', 'dpad8'];
export const isPadMode = (v: unknown): v is PadMode => typeof v === 'string' && (PAD_MODES as readonly string[]).includes(v);
export const nextPadMode = (m: PadMode): PadMode => PAD_MODES[(PAD_MODES.indexOf(m) + 1) % PAD_MODES.length];

/** The dead spot's radius in the middle of the cross, and how far the cross tilts toward the finger at most (px). */
export const PAD_DEAD = 10, PAD_TILT = 6;
/** A second axis turns on past ON times the first, and off below OFF times it (tan 24°, tan 18°). */
export const DIAG_ON = 0.45, DIAG_OFF = 0.32;

export interface DPadView {
  id: number | null;
  /** The primary direction, or null in the dead spot. */
  dir: Dir | null;
  /** Every direction held: none, one, or two on an 8-way diagonal (the primary first). */
  dirs: Dir[];
  /** How far the cross tilts toward the finger, for the picture. */
  tx: number; ty: number;
}

export class DPad {
  id: number | null = null;
  dirs: Dir[] = [];
  tx = 0; ty = 0;
  private cx = 0; private cy = 0;
  private axis: 'h' | 'v' | null = null;

  constructor(public eight = false) {}

  get dir(): Dir | null { return this.dirs[0] ?? null; }
  get active(): boolean { return this.id !== null; }

  /** A finger lands; (cx, cy) is the cross's centre on the page. It always takes over from any finger before it. */
  down(id: number, cx: number, cy: number, x: number, y: number): DPadView {
    this.reset();
    this.id = id; this.cx = cx; this.cy = cy;
    return this.move(id, x, y);
  }

  /** The finger moves. Other fingers are ignored. */
  move(id: number, x: number, y: number): DPadView {
    if (id !== this.id) return this.view();
    const dx = x - this.cx, dy = y - this.cy, dist = Math.hypot(dx, dy);
    if (dist < PAD_DEAD) { this.axis = null; this.dirs = []; this.tx = this.ty = 0; return this.view(); }
    const ax = Math.abs(dx), ay = Math.abs(dy);
    const h: Dir = dx > 0 ? 'right' : 'left', v: Dir = dy > 0 ? 'down' : 'up';
    if (!this.eight) {
      if (this.axis === 'h' && ay > ax * BIAS) this.axis = 'v';
      else if (this.axis === 'v' && ax > ay * BIAS) this.axis = 'h';
      else if (!this.axis) this.axis = ax >= ay ? 'h' : 'v';
      this.dirs = [this.axis === 'h' ? h : v];
    } else {
      const hOn = ax > ay * (this.dirs.includes(h) ? DIAG_OFF : DIAG_ON);
      const vOn = ay > ax * (this.dirs.includes(v) ? DIAG_OFF : DIAG_ON);
      const prev = this.dirs[0];
      let first: Dir, second: Dir | null = null;
      if (hOn && vOn) {
        first = prev === h || prev === v ? prev : ax >= ay ? h : v;
        second = first === h ? v : h;
      } else first = hOn ? h : v;
      this.dirs = second ? [first, second] : [first];
      this.axis = first === h ? 'h' : 'v';
    }
    // the cross tilts toward the held arm(s), never further than PAD_TILT
    const hx = this.dirs.includes('left') ? -1 : this.dirs.includes('right') ? 1 : 0;
    const vy = this.dirs.includes('up') ? -1 : this.dirs.includes('down') ? 1 : 0;
    const k = hx && vy ? Math.SQRT1_2 : 1;
    this.tx = hx * k * PAD_TILT; this.ty = vy * k * PAD_TILT;
    return this.view();
  }

  /** The finger lifts or is cancelled. Returns true if that was the pad's finger and it let go. */
  up(id: number): boolean {
    if (id !== this.id) return false;
    this.reset();
    return true;
  }

  /** Let go, whatever happened to the finger. */
  reset(): void { this.id = null; this.axis = null; this.dirs = []; this.tx = this.ty = 0; }

  view(): DPadView { return { id: this.id, dir: this.dir, dirs: [...this.dirs], tx: this.tx, ty: this.ty }; }
}
