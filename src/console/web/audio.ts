/* The web console's sound: PC-speaker square waves and the floppy drive, over Web Audio (GAM-39).

   Every sound goes out through one gain node, so hush() can cut whatever is still ringing or already
   scheduled (the drive, a game's effects) by dropping it; the next sound makes a fresh one.
   Nothing here runs until a sound is asked for: the context is made on the first user gesture. */

export let ac: AudioContext | null = null, muted = false;
export function setMuted(v: boolean){ muted = v; }

export function ensureAudio(){
  if (!ac) { try { const Ctx = window.AudioContext || (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext; ac = Ctx ? new Ctx() : null; } catch (e) { ac = null; } }
  if (ac && ac.state === 'suspended') ac.resume().catch(()=>{});
}

let outNode: GainNode | null = null;
export function out(){ if (!outNode) { outNode = ac!.createGain(); outNode.connect(ac!.destination); } return outNode; }
/** The master gain as it stands, for the browser checks (`__gg.audioOut`); null after hush() until the next sound. */
export const audioOut = () => outNode;
export function hush(){
  if (!outNode) return;
  const b = outNode; outNode = null;
  try { b.gain.cancelScheduledValues(0); b.gain.value = 0; b.disconnect(); } catch (_) {}
}

export function tone(f: number, dur: number, vol = 0.045, slide = 0, delay = 0){
  if (!ac || muted) return;
  const t0 = ac.currentTime + delay, o = ac.createOscillator(), g = ac.createGain();
  o.type = 'square'; o.frequency.setValueAtTime(f, t0);
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(40, f + slide), t0 + dur);
  g.gain.setValueAtTime(vol, t0); g.gain.setValueAtTime(vol, t0 + dur * 0.85); g.gain.linearRampToValueAtTime(0.0001, t0 + dur);
  o.connect(g).connect(out()); o.start(t0); o.stop(t0 + dur + 0.02);
}

/* ---------- the floppy drive: white noise, filtered into a motor's rumble and the head's clicks ---------- */
let noiseBuf: AudioBuffer | null = null;
export function noise(){
  if (!noiseBuf) { noiseBuf = ac!.createBuffer(1, ac!.sampleRate, ac!.sampleRate); const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; }
  const s = ac!.createBufferSource(); s.buffer = noiseBuf; s.loop = true; return s;
}
/** One head click at audio time `t`. */
export function headClick(t: number, vol = 0.22, freq = 2600){
  const s = noise(), f = ac!.createBiquadFilter(), g = ac!.createGain();
  f.type = 'bandpass'; f.frequency.value = freq; f.Q.value = 2.5;
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.018);
  s.connect(f).connect(g).connect(out()); s.start(t, Math.random()); s.stop(t + 0.03);
}
/** One head click `delay` seconds from now (the Platform's `click`). */
export function click(delay: number, vol?: number, freq?: number){
  if (!ac || muted) return;
  headClick(ac.currentTime + delay, vol, freq);
}
/** The drive motor for `dur` seconds from `start` seconds from now: a low filtered rumble with a hum underneath. */
export function motor(start: number, dur: number){
  if (!ac || muted || dur <= 0) return;
  const t0 = ac.currentTime + start, end = t0 + dur;
  const m = noise(), lp = ac.createBiquadFilter(), mg = ac.createGain(), hum = ac.createOscillator(), hg = ac.createGain();
  lp.type = 'lowpass'; lp.frequency.value = 220;
  const up = Math.min(0.25, dur * 0.15), down = Math.min(0.35, dur * 0.15);
  mg.gain.setValueAtTime(0.0001, t0); mg.gain.exponentialRampToValueAtTime(0.16, t0 + up);
  mg.gain.setValueAtTime(0.16, end - down); mg.gain.exponentialRampToValueAtTime(0.0001, end);
  hum.type = 'sawtooth'; hum.frequency.setValueAtTime(40, t0); hum.frequency.linearRampToValueAtTime(75, t0 + Math.min(0.4, dur * 0.2));
  hg.gain.setValueAtTime(0.0001, t0); hg.gain.exponentialRampToValueAtTime(0.012, t0 + up);
  hg.gain.setValueAtTime(0.012, end - down); hg.gain.exponentialRampToValueAtTime(0.0001, end);
  m.connect(lp).connect(mg).connect(out()); hum.connect(hg).connect(out());
  m.start(t0); m.stop(end + 0.05); hum.start(t0); hum.stop(end + 0.05);
}
