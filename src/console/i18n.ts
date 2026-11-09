/* Every string the page uses, in English, Traditional Chinese and Simplified Chinese.
   The base table is the console's and Tunnel Raider's; the console's extras (strings.ts) and each disk's own strings
   are merged over it. No side effects beyond building the table, so React islands can import it too. */
import type { Lang } from '../games/types';
import { CONSOLE_STRINGS } from './strings';
import { DISKS } from '../games/registry';

export const kb = (k: string) => `<kbd>${k}</kbd>`;
export const I18N: Record<string, any> = {
  en: {
    tag: 'Tunnel through the mine, scoop up emeralds and drop sacks of gold on the grubs.',
    rotate: 'Turn your phone sideways for the full-screen console layout.',
    stick: 'DRAG TO STEER', spark: 'FIRE', manTitle: 'Operating Instructions', model: 'Model TR-83 · 12″ phosphor monitor', secScore: 'Scoring', secMonitor: 'The monitor', src: 'Source code', boost: 'BOOST', k9: 'Speed boost', k9v: `${kb('Shift')} or ${kb('B')}`, manual: 'Instructions', manualHide: 'Fold away', exitFull: 'Exit full screen',
    howH: 'How it plays', ctlH: 'Controls',
    r1: 'Emerald', r2: 'Eight emeralds in quick succession', r3: 'Gold from a sack that fell two or more cells',
    r4: 'Grub crushed by a sack or hit by a spark', r5: 'Rockjaw (from level 4): two hits from sparks or sacks, three from level 7',
    r6: 'Sunstone (appears once every grub has arrived)', r7: 'Grubs rammed while the sunstone glows', r8: 'Spare drill cart', r8v: 'every 20,000', r9: 'Dig out every block of earth on a level, before it ends', r9v: '+1 cart',
    howNote: 'Grubs keep to tunnels. Horned borers chew straight through the earth towards you. Each level the grubs get cannier: they wander less, turn into borers sooner and stay borers longer. From level 3, borers shove sacks sideways and will line one up over your cart if they can. From level 4, banded rockjaws arrive that always dig their own tunnels; the pips over their heads show how many more hits they can take. A falling sack crushes you too, so never linger beneath one. Everything starts slow: the grubs quicken every level and so does your cart, but in an open tunnel they never outrun you. BOOST gives your cart a short burst of speed; its meter refills in about seven seconds.',
    k1: 'Move and dig', k1v: `${kb('←')} ${kb('↑')} ${kb('→')} ${kb('↓')} or ${kb('WASD')}`,
    k2: 'Throw a spark', k2v: `${kb('Space')} or ${kb('Z')}`,
    k3: 'Pause', k3v: `${kb('P')} or ${kb('Esc')}`,
    k4: 'Phosphor dial', k4v: `Drag, click, scroll or ${kb('C')}`,
    k5: 'Sound on / off', k6: 'Full screen', k6v: `${kb('F')} or the FULL switch`, k7: 'Start', k8: 'Power', k8v: 'POWER switch · RESET reboots',
    ctlNote: "Monochrome monitors glowed in one phosphor colour, and each phosphor faded at its own rate: long-afterglow green leaves smears behind anything that moves, and the P7 radar tube shows its beam sweeping down, flashing blue-white as it writes and fading to yellow-green behind. The CGA themes use the two four-colour palettes of IBM's 1981 Color Graphics Adapter, seen through a colour tube's stripe mask. This set is old: every turn of the dial degausses the tube, the magnetised colour patches creep back over a few seconds, and you'll spot faint burn-in, dust and the odd picture tear. Switch GLOW off for a clean picture. A tribute to Windmill Software's <i>Digger</i> (1983); characters, art, sound and code here are original.",
    titleText: 'ARROWS TO DIG · SPACE FOR A SPARK<br>CLEAR EVERY EMERALD OR EVERY GRUB', start: 'START',
    paused: 'PAUSED', pausedText: 'PRESS P OR ESC TO CARRY ON', resume: 'RESUME',
    over: 'CAVE-IN', overText: (n: number, s: number) => `LEVEL ${n} · ${s} POINTS`, again: 'DIG AGAIN',
    netOff: 'OFFLINE · THE GAME KEEPS RUNNING', netOn: 'BACK ONLINE', ready: 'SAVED FOR OFFLINE PLAY', update: 'NEW VERSION READY', restart: 'RESTART', install: 'Install app',
  },
  'zh-hant': {
    tag: '在礦坑裏挖隧道，收集綠寶石，再把金袋推下去壓扁蟲子。',
    rotate: '把手機橫放，即可使用全螢幕遊戲機版面。',
    stick: '拖動操控', spark: '發射', manTitle: '操作說明書', model: '型號 TR-83 · 12 吋螢光顯示器', secScore: '計分', secMonitor: '關於顯示器', src: '原始碼', boost: '加速', k9: '加速衝刺', k9v: `${kb('Shift')} 或 ${kb('B')}`, manual: '操作說明', manualHide: '收起說明', exitFull: '離開全螢幕',
    howH: '玩法', ctlH: '操作',
    r1: '綠寶石', r2: '快速連續收集八顆綠寶石', r3: '金袋跌落兩格或以上後散出的金子',
    r4: '被金袋壓扁或被火花擊中的蟲子', r5: '岩顎蟲（第 4 關起）：要擊中兩次，第 7 關起要三次',
    r6: '太陽石（所有蟲子出場後才出現）', r7: '太陽石發光期間撞倒的蟲子', r8: '後備鑽車', r8v: '每 20,000 分', r9: '在關卡結束前挖光所有泥土', r9v: '+1 部鑽車',
    howNote: '蟲子只會沿隧道走。長角的鑽地蟲會直接鑽穿泥土向你衝來。每過一關，蟲子都會更狡猾：少了亂走，更快變成鑽地蟲，而且維持得更久。第 3 關起，鑽地蟲會把金袋橫推，有機會更會故意把金袋推到你的鑽車正上方。第 4 關起會出現有條紋的岩顎蟲，牠們總是自己挖隧道，頭上的小點表示還要擊中多少次。跌落的金袋同樣會壓扁你，千萬別在金袋下逗留。一開始一切都很慢：每過一關，蟲子和你的鑽車都會加快，但在已挖好的隧道裏，蟲子永遠追不上你。BOOST（加速）會令鑽車短暫加速，能量約七秒後補滿。',
    k1: '移動及挖掘', k1v: `${kb('←')} ${kb('↑')} ${kb('→')} ${kb('↓')} 或 ${kb('WASD')}`,
    k2: '發射火花', k2v: `${kb('空白鍵')} 或 ${kb('Z')}`,
    k3: '暫停', k3v: `${kb('P')} 或 ${kb('Esc')}`,
    k4: '螢光粉旋鈕', k4v: `拖動、點按、滾動或按 ${kb('C')}`,
    k5: '開關聲音', k6: '全螢幕', k6v: `${kb('F')} 或 FULL 開關`, k7: '開始', k8: '電源', k8v: 'POWER 開關 · RESET 重新開機',
    ctlNote: '單色顯示器只會發出一種螢光粉的顏色，而每種螢光粉的餘暉長短不一：長餘暉綠色會在移動物件後面拖出殘影；P7 雷達顯像管則可以看到電子束由上而下掃描，掃過時閃出藍白色，之後慢慢褪成黃綠色。CGA 主題用的是 IBM 1981 年 Color Graphics Adapter 的兩組四色調色盤，並透過彩色顯像管的條紋遮罩呈現。這部電視機已經很舊：每次轉動旋鈕都會消磁，磁化色斑幾秒後會慢慢回來，你亦會看到淡淡的烙印、灰塵和偶爾的畫面撕裂。關掉 GLOW 便可看到乾淨的畫面。本作向 Windmill Software 的《Digger》（1983）致敬；角色、美術、聲音和程式碼均為原創。',
    titleText: '方向鍵挖掘 · 空白鍵發射火花<br>清除所有綠寶石或所有蟲子即可過關', start: '開始',
    paused: '已暫停', pausedText: '按 P 或 Esc 繼續', resume: '繼續',
    over: '坍塌了！', overText: (n: number, s: number) => `第 ${n} 關 · ${s} 分`, again: '再挖一次',
    netOff: '離線中 · 遊戲照常運作', netOn: '已恢復連線', ready: '已儲存，可離線遊玩', update: '新版本已準備好', restart: '重新啟動', install: '安裝應用程式',
  },
  'zh-hans': {
    tag: '在矿坑里挖隧道，收集绿宝石，再把金袋推下去压扁虫子。',
    rotate: '把手机横放，即可使用全屏游戏机版面。',
    stick: '拖动操控', spark: '发射', manTitle: '操作说明书', model: '型号 TR-83 · 12 英寸荧光显示器', secScore: '计分', secMonitor: '关于显示器', src: '源代码', boost: '加速', k9: '加速冲刺', k9v: `${kb('Shift')} 或 ${kb('B')}`, manual: '操作说明', manualHide: '收起说明', exitFull: '离开全屏',
    howH: '玩法', ctlH: '操作',
    r1: '绿宝石', r2: '快速连续收集八颗绿宝石', r3: '金袋跌落两格或以上后散出的金子',
    r4: '被金袋压扁或被火花击中的虫子', r5: '岩颚虫（第 4 关起）：要击中两次，第 7 关起要三次',
    r6: '太阳石（所有虫子出场后才出现）', r7: '太阳石发光期间撞倒的虫子', r8: '后备钻车', r8v: '每 20,000 分', r9: '在关卡结束前挖光所有泥土', r9v: '+1 部钻车',
    howNote: '虫子只会沿隧道走。长角的钻地虫会直接钻穿泥土向你冲来。每过一关，虫子都会更狡猾：少了乱走，更快变成钻地虫，而且维持得更久。第 3 关起，钻地虫会把金袋横推，有机会更会故意把金袋推到你的钻车正上方。第 4 关起会出现有条纹的岩颚虫，它们总是自己挖隧道，头上的小点表示还要击中多少次。跌落的金袋同样会压扁你，千万别在金袋下逗留。一开始一切都很慢：每过一关，虫子和你的钻车都会加快，但在已挖好的隧道里，虫子永远追不上你。BOOST（加速）会让钻车短暂加速，能量约七秒后补满。',
    k1: '移动及挖掘', k1v: `${kb('←')} ${kb('↑')} ${kb('→')} ${kb('↓')} 或 ${kb('WASD')}`,
    k2: '发射火花', k2v: `${kb('空格键')} 或 ${kb('Z')}`,
    k3: '暂停', k3v: `${kb('P')} 或 ${kb('Esc')}`,
    k4: '荧光粉旋钮', k4v: `拖动、点按、滚动或按 ${kb('C')}`,
    k5: '开关声音', k6: '全屏', k6v: `${kb('F')} 或 FULL 开关`, k7: '开始', k8: '电源', k8v: 'POWER 开关 · RESET 重新启动',
    ctlNote: '单色显示器只会发出一种荧光粉的颜色，而每种荧光粉的余晖长短不一：长余晖绿色会在移动对象后面拖出残影；P7 雷达显像管则可以看到电子束由上而下扫描，扫过时闪出蓝白色，之后慢慢褪成黄绿色。CGA 主题用的是 IBM 1981 年 Color Graphics Adapter 的两组四色调色板，并通过彩色显像管的条纹遮罩呈现。这部电视机已经很旧：每次转动旋钮都会消磁，磁化色斑几秒后会慢慢回来，你也会看到淡淡的烙印、灰尘和偶尔的画面撕裂。关掉 GLOW 便可看到干净的画面。本作向 Windmill Software 的《Digger》（1983）致敬；角色、美术、声音和代码均为原创。',
    titleText: '方向键挖掘 · 空格键发射火花<br>清除所有绿宝石或所有虫子即可过关', start: '开始',
    paused: '已暂停', pausedText: '按 P 或 Esc 继续', resume: '继续',
    over: '坍塌了！', overText: (n: number, s: number) => `第 ${n} 关 · ${s} 分`, again: '再挖一次',
    netOff: '离线中 · 游戏照常运行', netOn: '已恢复连接', ready: '已保存，可离线游玩', update: '新版本已准备好', restart: '重新启动', install: '安装应用',
  },
};
export const LANGS = Object.keys(I18N);
export const LANG_ALIAS: Record<string, string> = { zh: 'zh-hant', 'zh-hk': 'zh-hant', 'zh-tw': 'zh-hant', 'zh-mo': 'zh-hant', 'zh-cn': 'zh-hans', 'zh-sg': 'zh-hans' };
export const hashLang = (): string | null => {
  const h = location.hash.slice(1).toLowerCase();
  return LANG_ALIAS[h] || (LANGS.includes(h) ? h : null);
};
const isLang = (l: string): l is Lang => l === 'en' || l === 'zh-hant' || l === 'zh-hans';
for (const l of Object.keys(I18N)) {
  if (!isLang(l)) continue;
  // the monitor note's last sentence is Tunnel Raider's credit: it moves to that game's instructions
  const note = I18N[l].ctlNote, m = /(A tribute to .*$|本作向.*$)/.exec(note);
  if (m) { I18N[l].trCred = m[1]; I18N[l].ctlNote = note.slice(0, m.index).trim(); }
  Object.assign(I18N[l], CONSOLE_STRINGS[l]);
  for (const d of DISKS) if (d.strings && d.strings[l]) Object.assign(I18N[l], d.strings[l]);
}
