/* The nameplate on the set: `PGD · PORTABLE GAMING DEVICE` over the `PGD-01 · <phosphor>` line. An app that frames the
   console can put its own name or logo there (the `nameplate` embed command, the `nameplate` prop on <PGDConsole>);
   without one the set keeps the PGD plate. `readPlate` is the pure part (unit-tested); `applyPlate` writes the page. */
import type { PGDNameplate } from '../../react/index';

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

const clean = (v: unknown, max: number) => typeof v === 'string' ? v.replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, max) : '';

/** What a nameplate command or prop asks for, checked: a string is the plate's name; null or nothing usable is the PGD
    plate. Throws on an image address the set won't show, so the page hears about it. */
export function readPlate(p: unknown): Plate {
  if (p == null || p === '') return PGD_PLATE;
  const o: PGDNameplate = typeof p === 'string' ? { text: p } : typeof p === 'object' ? p as PGDNameplate : {};
  let image: string | null = null;
  if (o.image != null && o.image !== '') {
    if (typeof o.image !== 'string' || !IMAGE.test(o.image.trim())) throw new Error('nameplate image must be an http(s) address, a path or a data:image URL');
    image = o.image.trim();
  }
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

/** Put a plate on the set. Text only through textContent; the image through an <img> the badge already has. If the
    image fails to load (a 404, bad data) and this plate is still the one on the set, it falls back (`withoutImage`)
    and `onImageError` hears why. */
export function applyPlate(plate: Plate, doc: Document = document, onImageError?: (error: string) => void){
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
  // the second line keeps its phosphor name (setMode writes it): swap just the model code in front
  const line = doc.getElementById('plate');
  if (line && line.textContent) { const i = line.textContent.indexOf(' · '); if (i >= 0) line.textContent = plate.model + line.textContent.slice(i); }
}
