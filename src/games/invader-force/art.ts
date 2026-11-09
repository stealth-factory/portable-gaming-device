/* Invader Force's sprites: original pixel art, drawn in colour roles so every phosphor theme works.
   '#' is the sprite's colour; anything else is see-through. Two frames each for the march. */
import type { ConsoleAPI, Role } from '../types';

let api: ConsoleAPI;
/** Point the sprites at the console's drawing API before drawing. */
export function useApi(a: ConsoleAPI){ api = a; }

type Sprite = string[];

/** Top row, 30 points: a one-eyed jelly, tentacles swaying. */
export const JELLY: Sprite[] = [[
  '...#####...',
  '.#########.',
  '###..#..###',
  '###.....###',
  '.#########.',
  '..#.#.#.#..',
  '.#..#.#..#.',
  '#...#.#...#',
], [
  '...#####...',
  '.#########.',
  '###..#..###',
  '###.....###',
  '.#########.',
  '..#.#.#.#..',
  '..#.#.#.#..',
  '.#.#...#.#.',
]];
/** Middle rows, 20 points: a shelled beetle with six legs scuttling. */
export const BEETLE: Sprite[] = [[
  '...#####...',
  '..#######..',
  '.##.###.##.',
  '.#########.',
  '#####.#####',
  '.#.#...#.#.',
  '#..#...#..#',
  '...........',
], [
  '...#####...',
  '..#######..',
  '.##.###.##.',
  '.#########.',
  '#####.#####',
  '#.#.....#.#',
  '.#.#...#.#.',
  '...........',
]];
/** Bottom rows, 10 points: a visored drone, thrusters flickering. */
export const DRONE: Sprite[] = [[
  '....###....',
  '..#######..',
  '.##.....##.',
  '###########',
  '##.#####.##',
  '#..#...#..#',
  '...#...#...',
  '...........',
], [
  '....###....',
  '..#######..',
  '.##.....##.',
  '###########',
  '##.#####.##',
  '#.#.....#.#',
  '..#.....#..',
  '.#.......#.',
]];
/** Your cannon: a domed turret on treads with a long barrel. */
export const CANNON: Sprite = [
  '......#......',
  '......#......',
  '.....###.....',
  '...#######...',
  '.###########.',
  '#############',
  '#.#.#.#.#.#.#',
];
/** The mystery saucer. */
export const SAUCER: Sprite = [
  '......####......',
  '....########....',
  '..############..',
  '.##.##.##.##.##.',
  '################',
  '..###......###..',
];
/** A hit: a burst of shards. */
export const BURST: Sprite = [
  '#...#...#..',
  '.#..#..#...',
  '..#...#..#.',
  '##.......##',
  '..#...#..#.',
  '.#..#..#...',
  '#...#...#..',
];

/** A weapon capsule's shell, and the mark inside it (5 × 3, drawn at +2, +2) for each weapon. */
export const CAPSULE: Sprite = [
  '.#######.',
  '#.......#',
  '#.......#',
  '#.......#',
  '#.......#',
  '#.......#',
  '.#######.',
];
export const CAPSULE_MARK: Record<string, Sprite> = {
  twin:   ['.#.#.', '.#.#.', '.#.#.'],
  spread: ['#.#.#', '.###.', '..#..'],
  rapid:  ['#..#.', '.#..#', '#..#.'],
  pierce: ['...##', '.###.', '##...'],
  speed:  ['..#..', '.###.', '#.#.#'],
  nuke:   ['#.#.#', '.###.', '#.#.#'],
};
/** A capsule going off: a wide ring of shards. */
export const BLAST: Sprite = [
  '....#...#...#....',
  '..#...#...#...#..',
  '.#..#.......#..#.',
  '#..#...#.#...#..#',
  '..#..#.....#..#..',
  '#...#...#...#...#',
  '..#..#.....#..#..',
  '#..#...#.#...#..#',
  '.#..#.......#..#.',
  '..#...#...#...#..',
  '....#...#...#....',
];

export function sprite(s: Sprite, x: number, y: number, role: Role){
  const g = api.g; g.fillStyle = api.col(role);
  const x0 = Math.round(x), y0 = Math.round(y);
  for (let r = 0; r < s.length; r++) {
    const row = s[r];
    for (let c = 0; c < row.length; c++) if (row[c] === '#') g.fillRect(x0 + c, y0 + r, 1, 1);
  }
}
export const spriteW = (s: Sprite) => s[0].length;
export const spriteH = (s: Sprite) => s.length;
