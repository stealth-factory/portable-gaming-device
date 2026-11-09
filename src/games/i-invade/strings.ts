/* I Invade's words for the page (the pixel font on the tube stays English). */
import type { Strings } from '../types';

const kb = (k: string) => `<kbd>${k}</kbd>`;

export const strings: Strings = {
  en: {
    iiName: 'I Invade',
    iiHow: "For once you're the invaders. Your fleet hangs over the planet and sinks a step every few seconds; you can't stop it, but you can steer it left and right. The fleet has three bomb bays, lit along its underside: the left-hand column, the column nearest the middle and the right-hand column. The three fire buttons (◀, ▼ and ▶) drop a bomb from the left, middle or right bay, one in the air at a time. Below, the defenders' tanks patrol behind their pillboxes and shoot up at you, and every shot that lands costs you an alien. Knock out every tank to win the wave, or keep enough of the fleet alive to touch down on their row for a landing bonus. BOOST calls in the UFO: it crosses the sky and drops a heavy bomb, which smashes straight through walls, on the first tank it passes over. It takes a while to come back. The tanks get quicker, sharper and more numerous each wave, and learn to dodge your bombs.",
    ii1: 'Tank', ii1v: '100, plus 50 each wave',
    ii2: 'Touchdown', ii2v: '20 for every alien that lands',
    ii3: 'Extra fleet', ii3v: 'every 2,000',
    iik1: 'Steer the fleet', iik1v: `${kb('←')} ${kb('→')}, ${kb('A')} ${kb('D')} or the stick`,
    iik2: 'Drop a bomb', iik2v: `${kb('Z')} or ◀ from the left bay, ${kb('Space')} or ▼ (or tap the screen) from the middle, ${kb('V')} or ▶ from the right`,
    iik3: 'Call the UFO', iik3v: `${kb('Shift')} or UFO (back in about 14 s)`,
    iiCred: "A tribute to the fixed-screen alien shooters of the late 1970s, played from the other side. The fleet, tanks, art, sound and code here are original.",
    iiOver: 'REPELLED', iiAgain: 'INVADE AGAIN',
    bomb: 'BOMB', ufo: 'UFO', bayL: '◀', bayM: '▼', bayR: '▶',
  },
  'zh-hant': {
    iiName: 'I Invade 我來侵略',
    iiHow: '這次輪到你當侵略者。你的艦隊懸在星球上空，每隔幾秒就下降一級；你無法讓它停下，但可以左右操控。艦隊底下有三個彈艙，會亮起：最左一列、最靠近中間的一列和最右一列。三個發射鍵（◀、▼、▶）分別從左、中、右彈艙投下炸彈，畫面上一次只能有一枚。下面的防衛坦克在碉堡後巡邏，向上射擊你，每中一發你就少一個外星人。摧毀所有坦克即可贏得這一波；或者保住足夠的艦隊降落到坦克那一排，可獲得降落獎分。按 BOOST 召喚飛碟：它會橫越天空，在經過的第一輛坦克上方投下一枚重型炸彈，能直接穿透城牆，之後要等一段時間才能再用。坦克每一波都會更快、更準、更多，還會學會閃避你的炸彈。',
    ii1: '坦克', ii1v: '100 分，每一波再加 50',
    ii2: '降落', ii2v: '每個降落的外星人 20 分',
    ii3: '額外艦隊', ii3v: '每 2,000 分',
    iik1: '操控艦隊', iik1v: `${kb('←')} ${kb('→')}、${kb('A')} ${kb('D')} 或搖桿`,
    iik2: '投彈', iik2v: `${kb('Z')} 或 ◀ 從左彈艙，${kb('空白鍵')}或 ▼（或輕觸畫面）從中間，${kb('V')} 或 ▶ 從右彈艙`,
    iik3: '召喚飛碟', iik3v: `${kb('Shift')} 或 UFO（約 14 秒後再用）`,
    iiCred: '向 1970 年代末的固定畫面外星射擊遊戲致敬，只是換個角度來玩；艦隊、坦克、美術、聲音和程式碼均為原創。',
    iiOver: '被擊退了', iiAgain: '再侵略一次',
    bomb: '投彈', ufo: '飛碟', bayL: '◀', bayM: '▼', bayR: '▶',
  },
  'zh-hans': {
    iiName: 'I Invade 我来侵略',
    iiHow: '这次轮到你当侵略者。你的舰队悬在星球上空，每隔几秒就下降一级；你无法让它停下，但可以左右操控。舰队底下有三个弹舱，会亮起：最左一列、最靠近中间的一列和最右一列。三个发射键（◀、▼、▶）分别从左、中、右弹舱投下炸弹，画面上一次只能有一枚。下面的防卫坦克在碉堡后巡逻，向上射击你，每中一发你就少一个外星人。摧毁所有坦克即可赢得这一波；或者保住足够的舰队降落到坦克那一排，可获得降落奖分。按 BOOST 召唤飞碟：它会横越天空，在经过的第一辆坦克上方投下一枚重型炸弹，能直接穿透城墙，之后要等一段时间才能再用。坦克每一波都会更快、更准、更多，还会学会闪避你的炸弹。',
    ii1: '坦克', ii1v: '100 分，每一波再加 50',
    ii2: '降落', ii2v: '每个降落的外星人 20 分',
    ii3: '额外舰队', ii3v: '每 2,000 分',
    iik1: '操控舰队', iik1v: `${kb('←')} ${kb('→')}、${kb('A')} ${kb('D')} 或摇杆`,
    iik2: '投弹', iik2v: `${kb('Z')} 或 ◀ 从左弹舱，${kb('空格键')}或 ▼（或轻触画面）从中间，${kb('V')} 或 ▶ 从右弹舱`,
    iik3: '召唤飞碟', iik3v: `${kb('Shift')} 或 UFO（约 14 秒后再用）`,
    iiCred: '向 1970 年代末的固定画面外星射击游戏致敬，只是换个角度来玩；舰队、坦克、美术、声音和代码均为原创。',
    iiOver: '被击退了', iiAgain: '再侵略一次',
    bomb: '投弹', ufo: '飞碟', bayL: '◀', bayM: '▼', bayR: '▶',
  },
};
