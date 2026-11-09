/* Invader Force's sprites: original pixel art, drawn in colour roles so every phosphor theme works.
   '#' is the sprite's colour; anything else is see-through. Two frames each for the march. */
import type { Sprite } from '../../kit/play/types';

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

/** A castle wall with merlons and a gate, rebuilt every wave and bitten away by shots, bombs and blasts. */
export const CASTLE: Sprite = [
  '##..##..##..##..##',
  '##..##..##..##..##',
  '##################',
  '##################',
  '##################',
  '##################',
  '##################',
  '##################',
  '##################',
  '######......######',
  '######......######',
  '######......######',
];
/** A spare cannon in the top bar. */
export const MINI: Sprite = ['...#...', '..###..', '#######', '#.#.#.#'];
