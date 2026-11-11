/* The boot screen's text, kept free of the canvas and audio so it can be tested on its own. */
/** The DOS prompt, as AUTOEXEC.BAT's `PROMPT $P$G` sets it. */
export const PROMPT = 'A:\\>';
/** What the boot screen shows `t` seconds in: the BIOS lines, DOS starting, then MENU typed at the prompt.
    Returns the lines and when the command is entered (the menu starts loading then). */
export function bootScript(t: number, warm: boolean){
  const lines: string[] = [], typeAt = warm ? 0.3 : 1.55, cps = 0.08, cmd = 'MENU';
  lines.push('PGD-01 GAMING DEVICE   BIOS 1.0');
  if (!warm && t > 0.2) { const k = Math.min(640, Math.floor((t - 0.2) / 0.6 * 40) * 16); lines.push(`MEMORY TEST  ${String(k).padStart(3, ' ')}K${t > 0.82 ? '  OK' : ''}`); }
  if (!warm && t > 1.0) lines.push('DRIVE A:  360K FLOPPY');
  if (!warm && t > 1.15) lines.push('');
  // a warm boot (Ctrl+Alt+Del) skips the memory test and goes straight to the disk
  if (t > (warm ? 0.12 : 1.2)) lines.push('STARTING PGD-DOS...');
  if (t > (warm ? 0.22 : 1.4)) lines.push('');
  if (t > typeAt) lines.push(PROMPT + cmd.slice(0, Math.max(0, Math.floor((t - typeAt - 0.12) / cps))));
  return { lines, enterAt: typeAt + 0.12 + cmd.length * cps + 0.1 };
}
