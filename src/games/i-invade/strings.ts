/* I Invade's words for the page (the pixel font on the tube stays English). */
import type { Strings } from '../types';

const kb = (k: string) => `<kbd>${k}</kbd>`;

export const strings: Strings = {
  en: {
    iiName: 'I Invade',
    iiHow: "Invader Force the other way round: this time you are the invaders. Steer your whole fleet of 55 left and right and bomb the earthlings' tanks from the bomb bay, the column in the middle of your fleet (it's marked, with a sight line to the ground; up to three bombs in the air at once, more on later waves). Push into one side of the screen and the fleet drops a row closer to the ground; it needs the other side for the next drop, and it creeps down on its own too. The tanks only ever hold the stretch of ground your bay can reach. Each has three lives and shoots back, one shell at a time, and every alien it hits is gone for good: you have no spare fleet. Push up for a cluster bomb, which bursts into three above their walls (about 7 s to reload; a shell can shoot it down). Call in a UFO to fly across and rain bombs on them (about 12 s to recharge, and their shells can bring it down). Hitting tanks charges the meteor shower, slowly on its own too: once the bar under your score is full, pull down. Destroy every tank, or land the fleet on the ground, to win the wave. The earthlings send one tank at first, then a team of three, then six, and they get quicker to dodge and to shoot; your fleet starts lower each wave.",
    ii1: 'Hit a tank', ii2: 'Destroy a tank (its last life)', ii3: 'Touchdown: land the fleet', ii3v: '500 + 20 per alien left',
    ii4: 'Every tank destroyed', ii4v: '20 per alien left', ii5: 'Spare fleet', ii5v: 'none: lose them all and the invasion is over',
    iik1: 'Steer the fleet', iik1v: `${kb('←')} ${kb('→')}, ${kb('A')} ${kb('D')} or the stick (push into a side to drop a row, then the other side)`,
    iik2: 'Drop a bomb', iik2v: `${kb('Space')} or BOMB, or tap the screen`,
    iik5: 'Cluster bomb', iik5v: `${kb('↑')}, ${kb('W')} or push the stick up (about 7 s to reload)`,
    iik3: 'UFO strike', iik3v: `${kb('Shift')} or UFO (recharges in about 12 s)`,
    iik4: 'Meteor shower', iik4v: `${kb('↓')}, ${kb('S')} or pull the stick down, once the bar is full`,
    iiCred: "A role-reversed tribute to Taito's Space Invaders (1978), built on this console's own Invader Force. The aliens, tanks, art, sound and code here are original.",
    iiOver: 'REPELLED', iiAgain: 'INVADE AGAIN',
    iiBomb: 'BOMB', iiUfo: 'UFO',
  },
  'zh-hant': {
    iiName: 'I Invade 我來侵略',
    iiHow: '《外星侵略軍》反過來玩：這次你是侵略者。左右操控整支 55 人的艦隊，從投彈艙（艦隊中間那一列，有標記和瞄準線直到地面；最多同時三枚炸彈在空中，之後的波數更多）向地球人的坦克投彈。把艦隊推到畫面一邊，就會向地面推進一排；下一次推進要推到另一邊，艦隊也會自己慢慢下降。坦克只會守在投彈艙搆得到的那段地面。每部坦克有三條命，會一發一發地還擊，被擊中的外星人就永遠消失：你沒有後備艦隊。往上推可投下集束炸彈，會在他們的城牆上方炸開成三枚（約 7 秒重新裝填；砲彈可以把它擊落）。可以召喚飛碟橫越天空投下炸彈（約 12 秒回復，他們的砲彈也能把它打下來）。擊中坦克會為流星雨充能，它也會自己慢慢充能：分數下方的能量條充滿後，把搖桿往下拉。消滅所有坦克，或讓艦隊登陸地面，就能贏下這一波。地球人起初只派一部坦克，之後是三部一隊，再到六部，而且閃避和射擊都會越來越快；你的艦隊每一波也會從更低的位置出發。',
    ii1: '擊中坦克', ii2: '摧毀坦克（最後一條命）', ii3: '登陸：艦隊降落地面', ii3v: '500 + 每個剩下的外星人 20',
    ii4: '摧毀所有坦克', ii4v: '每個剩下的外星人 20', ii5: '後備艦隊', ii5v: '沒有：全軍覆沒侵略就結束',
    iik1: '操控艦隊', iik1v: `${kb('←')} ${kb('→')}、${kb('A')} ${kb('D')} 或搖桿（推到一邊就下降一排，下一次要推另一邊）`,
    iik2: '投彈', iik2v: `${kb('空白鍵')}或 BOMB，或輕觸畫面`,
    iik5: '集束炸彈', iik5v: `${kb('↑')}、${kb('W')} 或把搖桿往上推（約 7 秒重新裝填）`,
    iik3: '飛碟空襲', iik3v: `${kb('Shift')} 或 UFO（約 12 秒回復）`,
    iik4: '流星雨', iik4v: `能量條充滿後按 ${kb('↓')}、${kb('S')} 或把搖桿往下拉`,
    iiCred: '向 Taito 的《太空侵略者》（Space Invaders，1978）致敬的角色反轉版，以本機的《外星侵略軍》為基礎；外星人、坦克、美術、聲音和程式碼均為原創。',
    iiOver: '被擊退了', iiAgain: '再次侵略',
    iiBomb: '投彈', iiUfo: '飛碟',
  },
  'zh-hans': {
    iiName: 'I Invade 我来侵略',
    iiHow: '《外星侵略军》反过来玩：这次你是侵略者。左右操控整支 55 人的舰队，从投弹舱（舰队中间那一列，有标记和瞄准线直到地面；最多同时三枚炸弹在空中，之后的波数更多）向地球人的坦克投弹。把舰队推到画面一边，就会向地面推进一排；下一次推进要推到另一边，舰队也会自己慢慢下降。坦克只会守在投弹舱够得到的那段地面。每辆坦克有三条命，会一发一发地还击，被击中的外星人就永远消失：你没有后备舰队。往上推可投下集束炸弹，会在他们的城墙上方炸开成三枚（约 7 秒重新装填；炮弹可以把它击落）。可以召唤飞碟横越天空投下炸弹（约 12 秒恢复，他们的炮弹也能把它打下来）。击中坦克会为流星雨充能，它也会自己慢慢充能：分数下方的能量条充满后，把摇杆往下拉。消灭所有坦克，或让舰队登陆地面，就能赢下这一波。地球人起初只派一辆坦克，之后是三辆一队，再到六辆，而且闪避和射击都会越来越快；你的舰队每一波也会从更低的位置出发。',
    ii1: '击中坦克', ii2: '摧毁坦克（最后一条命）', ii3: '登陆：舰队降落地面', ii3v: '500 + 每个剩下的外星人 20',
    ii4: '摧毁所有坦克', ii4v: '每个剩下的外星人 20', ii5: '后备舰队', ii5v: '没有：全军覆没侵略就结束',
    iik1: '操控舰队', iik1v: `${kb('←')} ${kb('→')}、${kb('A')} ${kb('D')} 或摇杆（推到一边就下降一排，下一次要推另一边）`,
    iik2: '投弹', iik2v: `${kb('空格键')}或 BOMB，或轻触画面`,
    iik5: '集束炸弹', iik5v: `${kb('↑')}、${kb('W')} 或把摇杆往上推（约 7 秒重新装填）`,
    iik3: '飞碟空袭', iik3v: `${kb('Shift')} 或 UFO（约 12 秒恢复）`,
    iik4: '流星雨', iik4v: `能量条充满后按 ${kb('↓')}、${kb('S')} 或把摇杆往下拉`,
    iiCred: '向 Taito 的《太空侵略者》（Space Invaders，1978）致敬的角色反转版，以本机的《外星侵略军》为基础；外星人、坦克、美术、声音和代码均为原创。',
    iiOver: '被击退了', iiAgain: '再次侵略',
    iiBomb: '投弹', iiUfo: '飞碟',
  },
};
