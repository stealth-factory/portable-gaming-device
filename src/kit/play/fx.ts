/* Effects that run down on their own: explosion sprites, floating text (points, a pickup's name) and
   rings racing out from a blast. Update them in every mode, so nothing sticks over the banners. */
import { drawSprite } from './sprite';
import type { ConsoleAPI, Role, RoleOf, Sprite } from './types';

type Burst = { kind: 'burst'; x: number; y: number; t: number; art: Sprite; role: RoleOf };
type Pop = { kind: 'pop'; x: number; y: number; t: number; text: string; role: Role };
type Ring = { kind: 'ring'; x: number; y: number; t: number; secs: number; r: number; role: Role; dots: number };
type Item = Burst | Pop | Ring;

export interface PopOpts {
  /** How long it shows (s). Default 0.8. */
  secs?: number;
  /** Colour role. Default 'gold'. */
  role?: Role;
  /** Lift it `step` px for every pop still showing below `y − within`, so labels stack instead of overlapping. */
  stack?: { step: number; within: number };
}

export interface Fx {
  /** An explosion sprite for `secs`. `role` may be a function of the time left, for a blink;
      by default it blinks between 'spark' and 'gold' twelve times a second. */
  burst(x: number, y: number, secs: number, art: Sprite, role?: RoleOf): void;
  /** Floating text at (x, y). Returns the y it was placed at (after stacking). */
  pop(text: string, x: number, y: number, opts?: PopOpts): number;
  /** A ring of `dots` dots racing out to radius `r` over `secs`. */
  ring(x: number, y: number, r: number, secs: number, role?: Role, dots?: number): void;
  update(dt: number): void;
  /** Rings first, then bursts and pops in the order they were made. */
  draw(): void;
  clear(): void;
  readonly count: number;
}

const blinkSparkGold = (t: number): Role => (Math.floor(t * 12) % 2 ? 'spark' : 'gold');

export function makeFx(api: ConsoleAPI): Fx {
  let items: Item[] = [];
  return {
    burst(x, y, secs, art, role = blinkSparkGold){ items.push({ kind: 'burst', x, y, t: secs, art, role }); },
    pop(text, x, y, opts = {}){
      const { secs = 0.8, role = 'gold', stack } = opts;
      if (stack) y -= stack.step * items.filter(i => i.kind === 'pop' && i.y > y - stack.within).length;
      items.push({ kind: 'pop', x, y, t: secs, text, role });
      return y;
    },
    ring(x, y, r, secs, role = 'gold', dots = 28){ items.push({ kind: 'ring', x, y, t: secs, secs, r, role, dots }); },
    update(dt){
      for (const i of items) i.t -= dt;
      items = items.filter(i => i.t > 0);
    },
    draw(){
      const g = api.g;
      for (const i of items) {
        if (i.kind !== 'ring') continue;
        const r = i.r * Math.sqrt(1 - i.t / i.secs);
        g.fillStyle = api.col(i.role);
        for (let k = 0; k < i.dots; k++) {
          const a = k / i.dots * Math.PI * 2;
          g.fillRect(Math.round(i.x + Math.cos(a) * r), Math.round(i.y + Math.sin(a) * r), 1, 1);
        }
      }
      for (const i of items) {
        if (i.kind === 'pop') api.txt(i.text, i.x, i.y, i.role);
        else if (i.kind === 'burst') drawSprite(api, i.art, i.x, i.y, typeof i.role === 'function' ? i.role(i.t) : i.role);
      }
    },
    clear(){ items = []; },
    get count(){ return items.length; },
  };
}
