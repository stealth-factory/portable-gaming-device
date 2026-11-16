/* The console's name, wherever the machine says it: the BIOS banner, `STARTING PGD-DOS...`, the disk menu header,
   the cabinet stamp under the tube, the burnt-in title, the leaflet's model line. PGD by default; an app that frames
   the console renames it through its nameplate (`text` and `model`, src/console/nameplate.ts sets it here).
   DOM-free, so the console program (boot.ts, the launcher) can read it in the native apps too. */

export interface Brand {
  /** The short name, upper case: `PGD`, or the nameplate's text. */
  name: string;
  /** The longer name after it: `PORTABLE GAMING DEVICE`, the nameplate's `rest`, or empty. */
  long: string;
  /** The model code: `PGD-01`, or the nameplate's `model`. */
  model: string;
}

export const PGD_BRAND: Brand = { name: 'PGD', long: 'PORTABLE GAMING DEVICE', model: 'PGD-01' };

let current: Brand = PGD_BRAND;
const subs = new Set<(b: Brand) => void>();
export const brand = () => current;
/** Change the name; listeners (the burnt-in title, the leaflet) hear about it. */
export function setBrand(b: Brand){
  if (b.name === current.name && b.long === current.long && b.model === current.model) return;
  current = b; subs.forEach(f => f(b));
}
export function onBrand(fn: (b: Brand) => void){ subs.add(fn); return () => { subs.delete(fn); }; }

const isPGD = (b: Brand) => b.name === PGD_BRAND.name;

/** The first line of the boot screen: `PGD-01 GAMING DEVICE   BIOS 1.0`, or `<MODEL> <NAME>   BIOS 1.0`. */
export const biosLine = (b: Brand = current) => `${b.model} ${isPGD(b) ? 'GAMING DEVICE' : b.name}   BIOS 1.0`;
/** The operating system the boot starts: `PGD-DOS`, or the name's letters and digits (up to 8) and `-DOS`. */
export const dosName = (b: Brand = current) => `${b.name.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8) || PGD_BRAND.name}-DOS`;
/** The disk menu's header: `PGD-01 PORTABLE GAMING DEVICE`, or the model, the name and the longer name. */
export const menuTitle = (b: Brand = current) => isPGD(b) ? `${b.model} ${PGD_BRAND.long}` : [b.model, b.name, b.long].filter(Boolean).join(' ');
/** The stamp moulded into the cabinet under the tube. */
export const cabinetStamp = (b: Brand = current) => `${b.model} · 12″ PHOSPHOR MONITOR`;
/** The console's full name in words, for labels and the leaflet: `PGD-01 Portable Gaming Device`, or `<MODEL> <NAME>`. */
export const fullName = (b: Brand = current) => isPGD(b) ? `${b.model} Portable Gaming Device` : `${b.model} ${b.name}`;
