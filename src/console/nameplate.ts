/* The nameplate on the set: `PGD · PORTABLE GAMING DEVICE` over the `PGD-01 · <phosphor>` line. An app that frames the
   console can put its own name or logo there (the `nameplate` embed command, the `nameplate` prop on <PGDConsole>);
   without one the set keeps the PGD plate. `readPlate` is the pure part (unit-tested); `applyPlate` writes the page. */
import type { PGDNameplate } from '../../react/index';
import { setBrand, cabinetStamp, fullName, PGD_BRAND, type Brand } from './brand';

export const DEFAULT_MODEL = 'PGD-01';

/** A plate after the checks: what the set shows. */
export interface Plate {
  text: string;
  rest: string;
  image: string | null;
  alt: string;
  model: string;
}

export const PGD_PLATE: Plate = { text: 'PGD', rest: ' · PORTABLE GAMING DEVICE', image: null, alt: '', model: DEFAULT_MODEL };

const LIMITS = { text: 24, rest: 48, alt: 80, model: 16 };
/** Images the plate may show: web addresses, paths on the console's own site, and raster or SVG data URLs. */
const IMAGE = /^(https?:\/\/|\/(?!\/)|\.\.?\/|data:image\/(png|jpeg|gif|webp|avif|svg\+xml)[;,])/i;

/** The whole address must parse too (an `https://` with no host passes the pattern but isn't an address). */
const parses = (s: string) => {
  try { const u = new URL(s, 'https://console.invalid/'); return u.protocol === 'data:' || (/^https?:$/.test(u.protocol) && !!u.hostname); }
  catch (_) { return false; }
};

/** An image address the set will show (checked as above), null for none, or a throw for one it won't. */
export function imageAddress(v: unknown, what = 'nameplate image'): string | null {
  if (v == null || v === '') return null;
  if (typeof v !== 'string' || !IMAGE.test(v.trim()) || !parses(v.trim())) throw new Error(`${what} must be an http(s) address, a path or a data:image URL`);
  return v.trim();
}

export const clean = (v: unknown, max: number) => typeof v === 'string' ? v.replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, max) : '';

/** What a nameplate command or prop asks for, checked: a string is the plate's name; null or nothing usable is the PGD
    plate. Throws on an image address the set won't show, so the page hears about it. */
export function readPlate(p: unknown): Plate {
  if (p == null || p === '') return PGD_PLATE;
  const o: PGDNameplate = typeof p === 'string' ? { text: p } : typeof p === 'object' ? p as PGDNameplate : {};
  const image = imageAddress(o.image);
  const text = clean(o.text, LIMITS.text), rest = clean(o.rest, LIMITS.rest);
  const model = clean(o.model, LIMITS.model) || DEFAULT_MODEL;
  if (!text && !image) return { ...PGD_PLATE, model };
  // the long part reads as a continuation, as the PGD plate's ` · PORTABLE GAMING DEVICE` does
  return { text, rest: rest ? ` · ${rest.replace(/^[·\s]+/, '')}` : '', image, alt: clean(o.alt, LIMITS.alt) || text, model };
}

let current: Plate = PGD_PLATE;
/** The model code on the plate's second line (`PGD-01` unless the page set another). */
export const plateModel = () => current.model;

/** What the set shows when a plate's logo won't load: its text if it has some, otherwise the PGD plate (keeping the model). */
export const withoutImage = (plate: Plate): Plate => plate.text ? { ...plate, image: null } : { ...PGD_PLATE, model: plate.model };

/** The console's name a plate gives it (brand.ts): the plate's text and model, or for a logo with no text, its alt
    text. The BIOS, the disk menu, the cabinet stamp and the leaflet use it. */
export function plateBrand(plate: Plate): Brand {
  if (plate === PGD_PLATE) return PGD_BRAND;
  const name = (plate.text || plate.alt).toUpperCase() || PGD_BRAND.name;
  const long = name === PGD_BRAND.name && !plate.text ? PGD_BRAND.long : plate.rest.replace(/^[·\s]+/, '').toUpperCase();
  return { name, long, model: plate.model };
}

/** Put a plate on the set. Text only through textContent; the image through an <img> the badge already has. If the
    image fails to load (a 404, bad data) and this plate is still the one on the set, it falls back (`withoutImage`)
    and `onImageError` hears why. */
export function applyPlate(plate: Plate, doc: Document = document, onImageError?: (error: string) => void){
  const before = current;
  current = plate;
  const name = doc.getElementById('np-name'), logo = doc.getElementById('np-logo') as HTMLImageElement | null;
  if (name) {
    name.textContent = plate.text;
    const rest = doc.createElement('span');
    rest.className = 'np-rest';
    rest.textContent = plate.rest;
    if (plate.rest) name.append(rest);
    name.hidden = !!plate.image;
  }
  if (logo) {
    logo.onerror = null;
    if (plate.image) {
      // an image load fails later, after the command: only the plate that asked for it may fall back
      logo.onerror = () => {
        if (current !== plate) return;
        applyPlate(withoutImage(plate), doc);
        onImageError?.('nameplate image did not load');
      };
      logo.src = plate.image; logo.alt = plate.alt; logo.hidden = false;
    }
    else { logo.removeAttribute('src'); logo.alt = ''; logo.hidden = true; }
  }
  // the second line keeps its phosphor name (setMode writes it as `<model> · <phosphor>`): swap just the model code in
  // front, cutting the one that was there by its length, so a model with a dot of its own can't leave anything behind
  const line = doc.getElementById('plate'), was = `${before.model} · `;
  if (line && line.textContent?.startsWith(was)) line.textContent = `${plate.model} · ${line.textContent.slice(was.length)}`;
  // the console's name everywhere else: the tube (through brand.ts), the cabinet stamp and the screen's label
  const b = plateBrand(plate);
  setBrand(b);
  const stamp = doc.getElementById('emboss'), cv = doc.getElementById('cv');
  if (stamp) stamp.textContent = cabinetStamp(b);
  if (cv) cv.setAttribute('aria-label', `${fullName(b)} screen`);
}
