// 编程闯关仿真引擎：在网格世界里执行积木程序
// 方向 dir: 0=上(北), 1=右(东), 2=下(南), 3=左(西)
export const DIRS = [
  { dx: 0, dy: -1, name: 'up' },
  { dx: 1, dy: 0, name: 'right' },
  { dx: 0, dy: 1, name: 'down' },
  { dx: -1, dy: 0, name: 'left' },
];

// 统计积木块数（容器积木自身也算一块）
export function blockCount(node) {
  if (!node) return 0;
  if (Array.isArray(node)) return node.reduce((s, n) => s + blockCount(n), 0);
  let n = 1;
  if (node.type === 'repeat') n += blockCount(node.children || []);
  else if (node.type === 'if') {
    n += blockCount(node.then || []);
    n += blockCount(node.else || []);
  }
  return n;
}

export function normalizeProgram(program) {
  if (Array.isArray(program)) return program;
  if (program && typeof program === 'object') return [program];
  return [];
}

function wallSet(world) {
  const s = new Set();
  for (const w of world.walls || []) s.add(`${w.x},${w.y},${w.edge}`);
  return s;
}

function inside(world, x, y) {
  return x >= 0 && y >= 0 && x < world.cols && y < world.rows;
}

// 检查某格某方向是否有墙（出界也算墙）
export function isWall(world, walls, x, y, dir) {
  if (!inside(world, x, y)) return true;
  const edge = DIRS[dir].name;
  if (walls.has(`${x},${y},${edge}`)) return true;
  const nx = x + DIRS[dir].dx;
  const ny = y + DIRS[dir].dy;
  if (!inside(world, nx, ny)) return true;
  const opposite = DIRS[(dir + 2) % 4].name;
  return walls.has(`${nx},${ny},${opposite}`);
}

function checkCond(cond, world, walls, x, y, dir) {
  switch (cond) {
    case 'wallAhead': return isWall(world, walls, x, y, dir);
    case 'wallLeft': return isWall(world, walls, x, y, (dir + 3) % 4);
    case 'wallRight': return isWall(world, walls, x, y, (dir + 1) % 4);
    case 'pathAhead': return !isWall(world, walls, x, y, dir);
    default: return false;
  }
}

/**
 * 执行程序，产出每一帧（供前端动画播放），同时给出最终结果。
 * 只要机器人在移动后到达终点且收集完所有星星，立即判胜（更适合小朋友）。
 */
export function simulate(world, programInput) {
  const program = normalizeProgram(programInput);
  const walls = wallSet(world);
  const goalKey = (g) => `${g.x},${g.y}`;
  const remainingGoals = new Set((world.goals || []).map(goalKey));

  let x = world.start.x;
  let y = world.start.y;
  let dir = world.start.dir;
  const visited = new Set([`${x},${y}`]);

  const frames = [{
    x, y, dir,
    visited: [...visited],
    goalsLeft: [...remainingGoals],
    action: 'start',
  }];

  const state = {
    crashed: false,
    reason: '',
    moves: 0,
    actions: 0,
    iterations: 0,
    won: false,
  };

  const MAX_ACTIONS = world.maxSteps || 300;
  const MAX_ITER = 800;

  function reachedGoal() {
    const atFinish = world.finish && x === world.finish.x && y === world.finish.y;
    // moves>0：避免“巡逻回起点”类关卡在第 0 帧直接判胜
    return atFinish && remainingGoals.size === 0 && state.moves > 0;
  }

  function snapshot(action) {
    frames.push({
      x, y, dir,
      visited: [...visited],
      goalsLeft: [...remainingGoals],
      action,
    });
  }

  function execList(list) {
    for (const node of list) {
      if (state.crashed || state.won) return;
      if (state.actions > MAX_ACTIONS || state.iterations > MAX_ITER) {
        state.crashed = true;
        state.reason = 'programTooLong';
        return;
      }
      state.actions += 1;

      if (node.type === 'move') {
        if (isWall(world, walls, x, y, dir)) {
          state.crashed = true;
          state.reason = 'wall';
          snapshot('crash');
          return;
        }
        x += DIRS[dir].dx;
        y += DIRS[dir].dy;
        state.moves += 1;
        visited.add(`${x},${y}`);
        remainingGoals.delete(`${x},${y}`);
        snapshot('move');
        if (reachedGoal()) { state.won = true; return; }
      } else if (node.type === 'turn') {
        dir = (dir + (node.value === 'left' ? 3 : 1)) % 4;
        snapshot('turn');
      } else if (node.type === 'repeat') {
        const times = Math.max(0, Math.min(60, Number(node.times) || 0));
        for (let i = 0; i < times; i++) {
          state.iterations += 1;
          if (state.iterations > MAX_ITER) break;
          execList(node.children || []);
          if (state.crashed || state.won) return;
        }
      } else if (node.type === 'if') {
        const yes = checkCond(node.cond, world, walls, x, y, dir);
        execList(yes ? (node.then || []) : (node.else || []));
      }
    }
  }

  if (program.length === 0) {
    state.crashed = true;
    state.reason = 'empty';
  } else {
    execList(program);
  }
  if (state.reason === 'programTooLong') snapshot('crash');

  let failReason = '';
  if (state.crashed) failReason = state.reason;
  else if (!state.won) {
    failReason = remainingGoals.size > 0 ? 'goals' : 'notFinish';
  }

  return {
    frames,
    success: state.won,
    crashed: state.crashed,
    failReason,
    moves: state.moves,
    blockCount: blockCount(program),
    finalPos: { x, y, dir },
  };
}

// 服务端判题
export function validate(world, program) {
  const r = simulate(world, program);
  return {
    success: r.success,
    crashed: r.crashed,
    failReason: r.failReason,
    moves: r.moves,
    blockCount: r.blockCount,
  };
}

export function starsFor(level, count) {
  if (count <= level.par3) return 3;
  if (count <= level.par2) return 2;
  return 1;
}
