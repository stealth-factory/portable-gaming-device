/* The phosphor palettes shared by the web console and headless disk hosts. */
export const CGA_ROLES = { bg:0, dirt:2, ds1:0, ds2:1, core:0, spawn:1, gemDark:0, gem:1, gemHi:3, bagDark:0, bag:3, bagBand:2, gold:3, goldDark:2, goldHi:1,
  cart:3, cartShade:1, window:2, lamp:3, drill:1, drillLine:0, track:2, wheel:3, grub:1, grubBelly:3, borer:2, borerBelly:3, horn:3, eye:3, pupil:0,
  scared:3, scaredBelly:1, scaredFlash:2, sun:3, sunRay:1, spark:3, sparkTrail:1, text:3, textDim:1, hud:1 };
export const MONO_ROLES = { bg:0, dirt:1, ds1:0, ds2:2, core:0, spawn:1, gemDark:0, gem:2, gemHi:3, bagDark:0, bag:2, bagBand:1, gold:3, goldDark:1, goldHi:2,
  cart:3, cartShade:2, window:1, lamp:3, drill:2, drillLine:0, track:1, wheel:2, grub:2, grubBelly:3, borer:3, borerBelly:2, horn:3, eye:3, pupil:0,
  scared:1, scaredBelly:2, scaredFlash:3, sun:3, sunRay:2, spark:3, sparkTrail:2, text:3, textDim:2, hud:2 };
/* half: seconds for the phosphor glow to halve after the beam moves on. bezel: highlight, body, shadow, plate ink, unlit glass */
export type PhosphorMode = {
  name: string; pal: string[]; roles: Record<string, number>;
  phos: number; phos2: number; half: number; bloom: number; mask: boolean; sweep?: number; bezel: string[];
};
export const MODES: Record<string, PhosphorMode> = {
  greenP1:  { name:'GREEN P1', pal:['#140e09','#0f5a1d','#2fbf4b','#b2ffbd'], roles:MONO_ROLES, phos:3, phos2:2, half:0.045, bloom:0.36, mask:false,
              bezel:['#43473f','#2c2f2a','#1d1f1b','#8f978a','#1a120c'] },
  greenP39: { name:'LONG GREEN P39', pal:['#120c08','#0b4416','#33e05a','#c6ffd0'], roles:MONO_ROLES, phos:3, phos2:2, half:0.17, bloom:0.44, mask:false,
              bezel:['#3a3f3a','#252925','#171a17','#86907f','#180f0a'] },
  /* the radar tube: a fast blue-white flash where the beam writes, then a long yellow-green afterglow. sweep: the beam is visible, top to bottom */
  radarP7:  { name:'RADAR P7', pal:['#0b0d0b','#3d5a0e','#a9d22c','#e4f1ff'], roles:MONO_ROLES, phos:2, phos2:3, half:0.32, bloom:0.46, mask:false, sweep:2.4,
              bezel:['#3b3f40','#26292a','#181a1b','#8c949a','#0e100f'] },
  amberP3:  { name:'AMBER P3', pal:['#170d07','#6b3900','#de8c12','#ffd890'], roles:MONO_ROLES, phos:3, phos2:2, half:0.065, bloom:0.4, mask:false,
              bezel:['#403a33','#2a2622','#1b1815','#9a8f80','#1c120b'] },
  whiteP4:  { name:'PAPER WHITE P4', pal:['#15100c','#3a404e','#9aa3b6','#eef2ff'], roles:MONO_ROLES, phos:3, phos2:2, half:0.02, bloom:0.28, mask:false,
              bezel:['#e3dcc8','#cfc6b0','#a9a08a','#5a5446','#1b140f'] },
  cga1:     { name:'CGA COLOUR 1', pal:['#140e0a','#55ffff','#ff55ff','#ffffff'], roles:CGA_ROLES, phos:1, phos2:2, half:0.012, bloom:0.3, mask:true,
              bezel:['#ddd4bd','#c9bfa6','#a39a82','#574f40','#1a120d'] },
  cga0:     { name:'CGA COLOUR 0', pal:['#140e0a','#55ff55','#ff5555','#ffff55'], roles:CGA_ROLES, phos:1, phos2:3, half:0.012, bloom:0.3, mask:true,
              bezel:['#ddd4bd','#c9bfa6','#a39a82','#574f40','#1a120d'] },
};
export const MODE_ORDER = Object.keys(MODES);
export const LEGACY: Record<string, string> = { green:'greenP1', amber:'amberP3', white:'whiteP4' };
