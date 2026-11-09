import { describe, it, expect } from 'vitest';
import { DEFAULTS, isScoreKey, scoreKeys } from '../../src/console/settings';
import { I18N, LANGS } from '../../src/console/i18n';

describe('settings reset', () => {
  it('puts the set back to green P1, SOUND and GLOW on, HOLD and FULL off, in English', () => {
    expect(DEFAULTS).toEqual({ mode: 'greenP1', fx: true, sound: true, hold: false, full: false, lang: 'en' });
  });
  it('clears only the scores and the saved name, including the standalone Tunnel Raider\'s', () => {
    const keys = ['gg-best-tunnel', 'gg-board-invader-force', 'gg-best-dino', 'gg-name', 'eb-best', 'tr-board', 'tr-name',
      'eb-mode', 'eb-fx', 'tr-lang', 'gg-something', 'gg-board-', 'other'];
    expect(scoreKeys(keys)).toEqual(['gg-best-tunnel', 'gg-board-invader-force', 'gg-best-dino', 'gg-name', 'eb-best', 'tr-board', 'tr-name']);
    expect(isScoreKey('eb-mode')).toBe(false);
  });
  it('has its words in every language', () => {
    for (const l of LANGS) for (const k of ['setH', 'setReset', 'setResetQ', 'setResetYes', 'setResetDone', 'setScores', 'setScoresQ', 'setScoresYes', 'setScoresDone', 'setNo'])
      expect(I18N[l][k], `${l}.${k}`).toBeTruthy();
  });
});
