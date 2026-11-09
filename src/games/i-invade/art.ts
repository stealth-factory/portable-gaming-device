/* I Invade's sprites: original pixel art, drawn in colour roles so every phosphor theme works.
   '#' is the sprite's colour; anything else is see-through. The fleet's sprites have two frames for the march. */
import type { Sprite } from '../../kit/play/types';

/** Top row: the commander, a crowned eye on stalks. */
export const CROWN: Sprite[] = [[
  '.#...#...#.',
  '.##.###.##.',
  '..#######..',
  '.###...###.',
  '.##.###.##.',
  '..#######..',
  '..#..#..#..',
  '.#...#...#.',
], [
  '.#...#...#.',
  '.##.###.##.',
  '..#######..',
  '.###...###.',
  '.##.###.##.',
  '..#######..',
  '...#.#.#...',
  '..#..#..#..',
]];
/** Middle rows: a horned puffer, fins beating. */
export const PUFFER: Sprite[] = [[
  '#.........#',
  '.#.#####.#.',
  '..#######..',
  '.##.###.##.',
  '###########',
  '.#########.',
  '#..#...#..#',
  '...........',
], [
  '.#.......#.',
  '.#.#####.#.',
  '..#######..',
  '.##.###.##.',
  '###########',
  '.#########.',
  '.#.#...#.#.',
  '...........',
]];
/** Bottom rows: a pod with a hatch, the fleet's bombers. */
export const POD: Sprite[] = [[
  '...#####...',
  '.#########.',
  '##.#.#.#.##',
  '###########',
  '.##.....##.',
  '..#.###.#..',
  '.#.......#.',
  '...........',
], [
  '...#####...',
  '.#########.',
  '##.#.#.#.##',
  '###########',
  '.##.....##.',
  '..#.###.#..',
  '..#.....#..',
  '...........',
]];
/** The defenders' tank: a boxy hull on road wheels, gun pointing up at you. */
export const TANK: Sprite = [
  '......#......',
  '......#......',
  '....#####....',
  '..#########..',
  '#############',
  '##.##.##.##.#',
  '.###########.',
];
/** Your UFO, called in on BOOST. */
export const UFO: Sprite = [
  '.....######.....',
  '...##########...',
  '.##.##.##.##.##.',
  '################',
  '..#..#....#..#..',
];
/** A blast: rubble flying. */
export const BLAST: Sprite = [
  '..#...#...#..',
  '#...#...#...#',
  '..##.....##..',
  '.#..#.#.#..#.',
  '..##.....##..',
  '#...#...#...#',
  '..#...#...#..',
];

/** The defenders' pillbox: a rounded roof with a firing slit. Rebuilt every wave, bitten away by bombs and shots. */
export const PILLBOX: Sprite = [
  '...############...',
  '.################.',
  '##################',
  '#######....#######',
  '##################',
  '##################',
  '##################',
  '##################',
  '##################',
  '##################',
];
/** A spare fleet in the top bar. */
export const MINI: Sprite = ['.#####.', '###.###', '#######', '.#.#.#.'];
