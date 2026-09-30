// 闯关题库：顺序逻辑 → 循环 → 条件 → 小项目挑战
// concepts: sequence(顺序), loops(循环), conditions(条件), project(综合项目)
export const CONCEPT_INFO = {
  sequence: { name: '顺序逻辑', emoji: '👣' },
  loops: { name: '循环', emoji: '🔁' },
  conditions: { name: '条件判断', emoji: '🔀' },
  project: { name: '小项目', emoji: '🏆' },
};

// 根据一条不交叉的路径自动生成“单格宽走廊”墙体
function corridorWalls(path) {
  const onPath = new Set(path.map(([x, y]) => `${x},${y}`));
  const DX = [0, 1, 0, -1], DY = [-1, 0, 1, 0];
  const EDGE = ['up', 'right', 'down', 'left'];
  const W = [];
  for (const [x, y] of path) {
    for (let d = 0; d < 4; d++) {
      const nx = x + DX[d], ny = y + DY[d];
      if (!onPath.has(`${nx},${ny}`)) W.push({ x, y, edge: EDGE[d] });
    }
  }
  return W;
}

// 6x6 顺时针内旋螺旋（墙跟规则走到 (1,4)，最后左转一步到终点 (2,4)）
function spiralWalls() {
  const path = [];
  const seg = (x1, y1, x2, y2) => {
    if (x1 === x2) for (let y = Math.min(y1, y2); y <= Math.max(y1, y2); y++) path.push([x1, y]);
    else for (let x = Math.min(x1, x2); x <= Math.max(x1, x2); x++) path.push([x, y1]);
  };
  seg(1, 1, 1, 0); seg(1, 0, 5, 0); seg(5, 0, 5, 5);
  seg(5, 5, 0, 5); seg(0, 5, 0, 1); seg(0, 1, 3, 1);
  seg(3, 1, 3, 4); seg(3, 4, 1, 4);
  const seen = new Set();
  const uniq = path.filter(([x, y]) => { const k = `${x},${y}`; if (seen.has(k)) return false; seen.add(k); return true; });
  return corridorWalls(uniq);
}

// 5x5 顺时针内旋螺旋（墙跟规则走到 (2,3)，最后左转一步到终点）
function clockwiseSpiralWalls() {
  const path = [];
  const seg = (x1, y1, x2, y2) => {
    if (x1 === x2) for (let y = Math.min(y1, y2); y <= Math.max(y1, y2); y++) path.push([x1, y]);
    else for (let x = Math.min(x1, x2); x <= Math.max(x1, x2); x++) path.push([x, y1]);
  };
  seg(1, 1, 1, 0); seg(1, 0, 4, 0); seg(4, 0, 4, 4);
  seg(4, 4, 0, 4); seg(0, 4, 0, 1); seg(0, 1, 2, 1);
  seg(2, 1, 2, 3); seg(2, 3, 3, 3);
  const seen = new Set();
  const uniq = path.filter(([x, y]) => { const k = `${x},${y}`; if (seen.has(k)) return false; seen.add(k); return true; });
  return corridorWalls(uniq);
}


export const LEVELS = [
  // ---------- 第一章：顺序 ----------
  {
    id: 'seq-1',
    chapter: 1,
    order: 1,
    title: '迈出第一步',
    concept: 'sequence',
    brief: '小机器人在起点，向前走 2 格就能到达小旗子。拖两块“向前走”积木，点“运行”试试吧！',
    hint: '把两块【向前走】积木从上到下拼起来，程序会按顺序一块一块执行。',
    allowed: ['move', 'turn'],
    par3: 2, par2: 2,
    world: {
      cols: 5, rows: 3,
      start: { x: 1, y: 1, dir: 1 },
      finish: { x: 3, y: 1 },
      goals: [], walls: [],
    },
  },
  {
    id: 'seq-2',
    chapter: 1,
    order: 2,
    title: '拐弯到达',
    concept: 'sequence',
    brief: '旗子在小路的拐角后面。先一直向前走，到拐角处右转，注意别撞墙哦。',
    hint: '先放 2 块【向前走】，再放【向右转弯】，最后再放 2 块【向前走】。',
    allowed: ['move', 'turn'],
    par3: 5, par2: 5,
    world: {
      cols: 5, rows: 5,
      start: { x: 1, y: 3, dir: 0 },
      finish: { x: 3, y: 1 },
      goals: [],
      walls: [
        { x: 1, y: 3, edge: 'left' }, { x: 1, y: 3, edge: 'down' }, { x: 1, y: 3, edge: 'right' },
        { x: 1, y: 2, edge: 'left' }, { x: 1, y: 2, edge: 'right' },
        { x: 1, y: 1, edge: 'left' }, { x: 1, y: 1, edge: 'up' },
        { x: 2, y: 1, edge: 'up' }, { x: 2, y: 1, edge: 'down' },
        { x: 3, y: 1, edge: 'up' }, { x: 3, y: 1, edge: 'right' }, { x: 3, y: 1, edge: 'down' },
      ],
    },
  },
  {
    id: 'seq-3',
    chapter: 1,
    order: 3,
    title: '收集星星',
    concept: 'sequence',
    brief: '弯弯曲曲的小路尽头有一面小旗子，路上还有一颗小星星。经过星星就能收集它，小心别撞到墙！',
    hint: '一共 12 块积木。跟着路走：先向前再右转；走两格后左转；然后左转、右转、右转，每次转弯之间放向前走。',
    allowed: ['move', 'turn'],
    par3: 12, par2: 12,
    world: {
      cols: 5, rows: 5,
      start: { x: 1, y: 3, dir: 0 },
      finish: { x: 3, y: 0 },
      goals: [{ x: 2, y: 2 }],
      walls: [
        { x: 1, y: 3, edge: 'down' }, { x: 1, y: 3, edge: 'left' }, { x: 1, y: 3, edge: 'right' },
        { x: 1, y: 2, edge: 'up' }, { x: 1, y: 2, edge: 'left' },
        { x: 2, y: 2, edge: 'up' }, { x: 2, y: 2, edge: 'down' },
        { x: 3, y: 2, edge: 'right' }, { x: 3, y: 2, edge: 'down' },
        { x: 3, y: 1, edge: 'up' }, { x: 3, y: 1, edge: 'right' },
        { x: 2, y: 1, edge: 'left' }, { x: 2, y: 1, edge: 'down' },
        { x: 2, y: 0, edge: 'up' }, { x: 2, y: 0, edge: 'left' },
        { x: 3, y: 0, edge: 'up' }, { x: 3, y: 0, edge: 'right' }, { x: 3, y: 0, edge: 'down' },
      ],
    },
  },

  // ---------- 第二章：循环 ----------
  {
    id: 'loop-1',
    chapter: 2,
    order: 4,
    title: '重复的魔法',
    concept: 'loops',
    brief: '旗子在 6 格外！一块一块拼太累了。用一块“重复 N 次”积木，里面放“向前走”，3 星需要更少的积木哦。',
    hint: '把【向前走】放进【重复 6 次】里面，整块只算 2 块积木！',
    allowed: ['move', 'turn', 'repeat'],
    par3: 2, par2: 6,
    world: {
      cols: 8, rows: 3,
      start: { x: 0, y: 1, dir: 1 },
      finish: { x: 6, y: 1 },
      goals: [], walls: [],
    },
  },
  {
    id: 'loop-2',
    chapter: 2,
    order: 5,
    title: '正方形巡逻',
    concept: 'loops',
    brief: '沿着正方形小路绕一圈，回到小旗子那里。想想哪一组动作重复了 4 次？',
    hint: '“向前走两步，再右转”这个组合重复 4 次，就是一个正方形。',
    allowed: ['move', 'turn', 'repeat'],
    par3: 4, par2: 12,
    world: {
      cols: 5, rows: 5,
      start: { x: 1, y: 1, dir: 1 },
      finish: { x: 1, y: 1 },
      goals: [],
      walls: [
        // 单格宽正方形环道 (1,1)→(3,1)→(3,3)→(1,3)→(1,1)
        { x: 1, y: 1, edge: 'up' }, { x: 1, y: 1, edge: 'left' },
        { x: 2, y: 1, edge: 'up' }, { x: 2, y: 1, edge: 'down' },
        { x: 3, y: 1, edge: 'up' }, { x: 3, y: 1, edge: 'right' },
        { x: 3, y: 2, edge: 'right' }, { x: 3, y: 2, edge: 'left' },
        { x: 3, y: 3, edge: 'right' }, { x: 3, y: 3, edge: 'down' },
        { x: 2, y: 3, edge: 'down' }, { x: 2, y: 3, edge: 'up' },
        { x: 1, y: 3, edge: 'down' }, { x: 1, y: 3, edge: 'left' },
        { x: 1, y: 2, edge: 'left' }, { x: 1, y: 2, edge: 'right' },
      ],
    },
  },
  {
    id: 'loop-3',
    chapter: 2,
    order: 6,
    title: '星光大道',
    concept: 'loops',
    brief: '长直道上有 3 颗星星，全部收集后到达尽头的旗子。用循环拿到 3 星吧！',
    hint: '路一共 7 格：【重复 7 次：向前走】只要 2 块积木，就能经过所有星星。',
    allowed: ['move', 'turn', 'repeat'],
    par3: 2, par2: 8,
    world: {
      cols: 9, rows: 3,
      start: { x: 0, y: 1, dir: 1 },
      finish: { x: 7, y: 1 },
      goals: [{ x: 2, y: 1 }, { x: 4, y: 1 }, { x: 6, y: 1 }],
      walls: [
        { x: 0, y: 1, edge: 'left' }, { x: 7, y: 1, edge: 'right' },
        ...Array.from({ length: 9 }, (_, c) => [
          { x: c, y: 0, edge: 'down' },
          { x: c, y: 2, edge: 'up' },
        ]).flat(),
      ],
    },
  },

  // ---------- 第三章：条件 ----------
  {
    id: 'cond-1',
    chapter: 3,
    order: 7,
    title: '撞到墙怎么办',
    concept: 'conditions',
    brief: '路在前方被墙挡住了！用“如果 前面是墙”积木做判断：是墙就转弯，不是墙就继续走。',
    hint: '把【如果前面是墙 → 右转 / 否则 → 向前走】放进【重复 25 次】，程序会自动走完大螺旋；最后再补一块【左转】和【向前走】进入终点。',
    allowed: ['move', 'turn', 'repeat', 'if'],
    par3: 6, par2: 20,
    world: {
      cols: 5, rows: 5,
      start: { x: 1, y: 1, dir: 0 },
      finish: { x: 3, y: 3 },
      goals: [],
      walls: clockwiseSpiralWalls(),
    },
  },
  {
    id: 'cond-2',
    chapter: 3,
    order: 8,
    title: '走迷宫',
    concept: 'conditions',
    brief: '弯弯曲曲的迷宫！写一个“会自己找路”的程序：重复很多次——前面是墙就右转，否则一直走。',
    hint: '【重复 25 次】里放【如果前面是墙 → 右转 / 否则 → 向前走】自动走完外圈；外卷走完后，从里圈入口接着拼：两向前、右转、三向前、右转、再向前。',
    allowed: ['move', 'turn', 'repeat', 'if'],
    par3: 11, par2: 30,
    world: {
      cols: 6, rows: 6,
      start: { x: 1, y: 1, dir: 0 },
      finish: { x: 2, y: 4 },
      goals: [],
      walls: spiralWalls(),
    },
  },

  // ---------- 第四章：小项目 ----------
  {
    id: 'proj-1',
    chapter: 4,
    order: 9,
    title: '小小邮递员',
    concept: 'project',
    brief: '项目挑战！你是小小邮递员，要把路上的信件（星星）全部送到，最后到达邮局（旗子）。综合运用循环和条件，规划最省积木的路线吧！',
    hint: '先用【重复 24 次】的“墙跟判断”走完外圈收齐大部分信件，再手动拼出里圈路线（右转、三向前、左转、两向前）到邮局。',
    allowed: ['move', 'turn', 'repeat', 'if'],
    par3: 11, par2: 30,
    world: {
      cols: 6, rows: 6,
      start: { x: 1, y: 1, dir: 0 },
      finish: { x: 2, y: 4 },
      goals: [
        { x: 3, y: 0 }, { x: 5, y: 3 },
        { x: 1, y: 5 }, { x: 0, y: 2 }, { x: 1, y: 4 },
      ],
      walls: spiralWalls(),
    },
  },
  {
    id: 'proj-2',
    chapter: 4,
    order: 10,
    title: '城市探险家',
    concept: 'project',
    brief: '终极项目！城市道路层层叠叠，收集 4 枚探险家徽章，找到终点的奖杯。这次的迷宫更长，转弯更多，你能让机器人自己走完全程吗？',
    hint: '先用【重复 25 次】的“墙跟判断”走完螺旋，再补【左转】【向前走】拿到奖杯。',
    allowed: ['move', 'turn', 'repeat', 'if'],
    par3: 6, par2: 20,
    world: {
      cols: 5, rows: 5,
      start: { x: 1, y: 1, dir: 0 },
      finish: { x: 3, y: 3 },
      goals: [
        { x: 3, y: 0 }, { x: 4, y: 3 },
        { x: 0, y: 3 }, { x: 2, y: 1 },
      ],
      walls: clockwiseSpiralWalls(),
    },
  },
];

export function getLevel(id) {
  return LEVELS.find((l) => l.id === id) || null;
}
