/* ROCKETX's words for the leaflet (the pixel font on the tube stays English). */
import type { Strings } from '../types';

const kb = (k: string) => `<kbd>${k}</kbd>`;

export const strings: Strings = {
  en: {
    rxName: 'ROCKETX',
    rxHow: 'An inbound rocket is coming down over the pad. Burn the main engine to slow it, turn it with the side thrusters, and level it with attitude hold. Touch down on the pad slowly, upright and in the middle, and you land. Miss the pad, come in too fast or tilted, and you lose a rocket.',
    rxS1: 'A landing', rxS1v: 'Fuel left, a centred touchdown and a gentle one. Worth more each level',
    rxS2: 'Each level', rxS2v: 'Comes in faster, the pad narrows and the wind picks up',
    rxK1: 'Main engine', rxK1v: `FIRE, ${kb('Space')}, ${kb('Z')} or ${kb('X')}, or hold the screen. Burns fuel`,
    rxK2: 'Side thrusters', rxK2v: `${kb('←')} ${kb('→')}, ${kb('A')} ${kb('D')} or the stick left and right. Turns the rocket`,
    rxK3: 'LEVEL', rxK3v: `BOOST, ${kb('Shift')} or ${kb('B')}. Holds the rocket upright, using a little fuel`,
    rxCred: 'A tribute to the early days of rocket landings, where one thrust and a steady hand brought a booster home. The rocket, the pad, the art, the sound and the code here are original.',
    rxOver: 'OUT OF ROCKETS', rxAgain: 'FLY AGAIN',
    rxBurn: 'BURN', rxLevel: 'LEVEL',
  },
  'zh-hant': {
    rxName: 'ROCKETX',
    rxHow: '一枚來襲的火箭正朝發射台降落。開主引擎減速，用側推進器轉向，再用姿態保持把它扶正。慢慢、直立、在正中央降到發射台上，就算著陸成功。落偏、太快或歪斜，就損失一枚火箭。',
    rxS1: '著陸一次', rxS1v: '剩餘燃料、降在正中央、降得平穩，每關的分數都更高',
    rxS2: '每一關', rxS2v: '來得更快，發射台更窄，風也更大',
    rxK1: '主引擎', rxK1v: `FIRE、${kb('空白鍵')}、${kb('Z')} 或 ${kb('X')}，或按住畫面。會消耗燃料`,
    rxK2: '側推進器', rxK2v: `${kb('←')} ${kb('→')}、${kb('A')} ${kb('D')} 或搖桿左右。讓火箭轉向`,
    rxK3: 'LEVEL', rxK3v: `BOOST、${kb('Shift')} 或 ${kb('B')}。讓火箭保持直立，耗用少量燃料`,
    rxCred: '向早期火箭回收的歲月致敬：一次推力、一雙穩定的手，把助推器帶回家。這裡的火箭、發射台、美術、聲音和程式碼均為原創。',
    rxOver: '火箭用完了', rxAgain: '再飛一次',
    rxBurn: '點火', rxLevel: '扶正',
  },
  'zh-hans': {
    rxName: 'ROCKETX',
    rxHow: '一枚来袭的火箭正朝发射台降落。开主引擎减速，用侧推进器转向，再用姿态保持把它扶正。慢慢、直立、在正中央降到发射台上，就算着陆成功。落偏、太快或歪斜，就损失一枚火箭。',
    rxS1: '着陆一次', rxS1v: '剩余燃料、降在正中央、降得平稳，每关的分数都更高',
    rxS2: '每一关', rxS2v: '来得更快，发射台更窄，风也更大',
    rxK1: '主引擎', rxK1v: `FIRE、${kb('空格键')}、${kb('Z')} 或 ${kb('X')}，或按住画面。会消耗燃料`,
    rxK2: '侧推进器', rxK2v: `${kb('←')} ${kb('→')}、${kb('A')} ${kb('D')} 或摇杆左右。让火箭转向`,
    rxK3: 'LEVEL', rxK3v: `BOOST、${kb('Shift')} 或 ${kb('B')}。让火箭保持直立，耗用少量燃料`,
    rxCred: '向早期火箭回收的岁月致敬：一次推力、一双稳定的手，把助推器带回家。这里的火箭、发射台、美术、声音和代码均为原创。',
    rxOver: '火箭用完了', rxAgain: '再飞一次',
    rxBurn: '点火', rxLevel: '扶正',
  },
};
