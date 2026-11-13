/* Reef Run's words for the leaflet (the pixel font on the tube stays English). */
import type { Strings } from '../types';

const kb = (k: string) => `<kbd>${k}</kbd>`;

export const strings: Strings = {
  en: {
    rrName: 'Reef Run',
    rrHow: 'Your fish swims forward on its own. Press for an upward kick; without one the fish sinks. Slip through the openings in the coral and the rock. Touch either, or the surface, or the seabed, and the swim is over. The current quickens as you pass openings, and the openings draw in.',
    rrS1: 'Passing an opening', rrS1v: '1',
    rrS2: 'The current', rrS2v: 'Quicker as the score climbs, and the openings tighten',
    rrK1: 'Kick', rrK1v: `FIRE, ${kb('Space')}, ${kb('Z')} or ${kb('X')}, or tap the screen. One kick per press`,
    rrK2: 'Kick with the stick', rrK2v: `${kb('↑')}, ${kb('W')} or the stick up`,
    rrK3: 'BOOST', rrK3v: 'Stays dark on this disk',
    rrCred: 'A tribute to the one-button gap games of 2013, where one press lifts you and gravity does the rest. The fish, the reef, the art, the sound and the code here are original.',
    rrOver: 'SNAGGED', rrAgain: 'SWIM AGAIN',
    rrKick: 'KICK',
  },
  'zh-hant': {
    rrName: 'Reef Run 穿礁',
    rrHow: '魚會自己向前游。按一下就向上踢水，不按就往下沉。從珊瑚和岩石的缺口穿過去。碰到珊瑚、岩石、水面或海底，這一游就結束。每過一個缺口，水流就更快，缺口也更窄。',
    rrS1: '穿過一個缺口', rrS1v: '1',
    rrS2: '水流', rrS2v: '分數越高越快，缺口越窄',
    rrK1: '踢水', rrK1v: `FIRE、${kb('空白鍵')}、${kb('Z')} 或 ${kb('X')}，或輕觸畫面。按一下踢一下`,
    rrK2: '用搖桿踢水', rrK2v: `${kb('↑')}、${kb('W')} 或搖桿向上`,
    rrK3: 'BOOST', rrK3v: '這隻磁碟沒有作用',
    rrCred: '向 2013 年那種按一下就抬起、放手就下沉的過關遊戲致敬。魚、礁石、美術、聲音和程式碼均為原創。',
    rrOver: '卡住了', rrAgain: '再游一次',
    rrKick: '踢水',
  },
  'zh-hans': {
    rrName: 'Reef Run 穿礁',
    rrHow: '鱼会自己向前游。按一下就向上踢水，不按就往下沉。从珊瑚和岩石的缺口穿过去。碰到珊瑚、岩石、水面或海底，这一游就结束。每过一个缺口，水流就更快，缺口也更窄。',
    rrS1: '穿过一个缺口', rrS1v: '1',
    rrS2: '水流', rrS2v: '分数越高越快，缺口越窄',
    rrK1: '踢水', rrK1v: `FIRE、${kb('空格键')}、${kb('Z')} 或 ${kb('X')}，或轻触画面。按一下踢一下`,
    rrK2: '用摇杆踢水', rrK2v: `${kb('↑')}、${kb('W')} 或摇杆向上`,
    rrK3: 'BOOST', rrK3v: '这张磁盘没有作用',
    rrCred: '向 2013 年那种按一下就抬起、放手就下沉的过关游戏致敬。鱼、礁石、美术、声音和代码均为原创。',
    rrOver: '卡住了', rrAgain: '再游一次',
    rrKick: '踢水',
  },
};
