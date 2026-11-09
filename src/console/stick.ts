/* The floating thumb-stick's logic, without the DOM.
   The stick centres wherever the thumb lands, follows it past the rim, and snaps to four directions with a dead zone
   and hysteresis so diagonal wobble doesn't flicker.

   It follows one finger at a time. Browsers sometimes drop that finger without telling the pad (it slides off the edge
   of the pad or the screen, a system edge gesture takes it, pointer capture is lost), so the stick must never wait on a
   release to take the next touch: a new finger on the pad always takes over, and core.ts also lets go on any sign the
   finger has gone (lostpointercapture, a page-wide pointerup, no touches left on the pad, blur, a hidden page). */

export type Dir = 'up' | 'down' | 'left' | 'right';

export const RIM = 46, DEAD = 12, BIAS = 1.35;

export interface StickView {
  /** Which finger the stick follows, or null when it is centred. */
  id: number | null;
  dir: Dir | null;
  /** Where the base sits (page coordinates) and how far the knob is pushed from it. */
  ox: number; oy: number; dx: number; dy: number;
}

export class Stick {
  id: number | null = null;
  dir: Dir | null = null;
  ox = 0; oy = 0; dx = 0; dy = 0;
  private axis: 'h' | 'v' | null = null;

  /** A finger lands on the pad. It always takes over, even if the stick still thinks another finger is down. */
  down(id: number, x: number, y: number): StickView {
    this.reset();
    this.id = id; this.ox = x; this.oy = y;
    return this.move(id, x, y);
  }

  /** The finger moves. Other fingers are ignored. */
  move(id: number, x: number, y: number): StickView {
    if (id !== this.id) return this.view();
    let dx = x - this.ox, dy = y - this.oy;
    const dist = Math.hypot(dx, dy);
    if (dist > RIM) { const k = (dist - RIM) / dist; this.ox += dx * k; this.oy += dy * k; dx -= dx * k; dy -= dy * k; }
    this.dx = dx; this.dy = dy;
    if (dist < DEAD) { this.axis = null; this.dir = null; return this.view(); }
    const ax = Math.abs(dx), ay = Math.abs(dy);
    if (this.axis === 'h' && ay > ax * BIAS) this.axis = 'v';
    else if (this.axis === 'v' && ax > ay * BIAS) this.axis = 'h';
    else if (!this.axis) this.axis = ax >= ay ? 'h' : 'v';
    this.dir = this.axis === 'h' ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up');
    return this.view();
  }

  /** The finger lifts or is cancelled. Returns true if that was the stick's finger and it let go. */
  up(id: number): boolean {
    if (id !== this.id) return false;
    this.reset();
    return true;
  }

  /** Centre the stick and forget the finger, whatever happened to it. */
  reset(): void {
    this.id = null; this.axis = null; this.dir = null; this.dx = 0; this.dy = 0;
  }

  get active(): boolean { return this.id !== null; }

  view(): StickView { return { id: this.id, dir: this.dir, ox: this.ox, oy: this.oy, dx: this.dx, dy: this.dy }; }
}
