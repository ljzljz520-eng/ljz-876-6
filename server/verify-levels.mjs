import { LEVELS } from './src/levels.js';
import { validate } from './src/engine.js';

const M = () => ({ type: 'move' });
const R = () => ({ type: 'turn', value: 'right' });
const L = () => ({ type: 'turn', value: 'left' });
const REP = (times, ...children) => ({ type: 'repeat', times, children });
const IF = (cond, then, els = []) => ({ type: 'if', cond, then, else: els });
const WALLFOLLOW = (n = 25) => [REP(n, IF('wallAhead', [R()], [M()])), L(), M()];
const WALLFOLLOW6 = (n = 24) => [REP(n, IF('wallAhead', [R()], [M()])), R(), M(), M(), M(), L(), M(), M()];

const solutions = {
  'seq-1': [M(), M()],
  'seq-2': [M(), M(), R(), M(), M()],
  'seq-3': [M(), R(), M(), M(), L(), M(), L(), M(), R(), M(), R(), M()],
  'loop-1': [REP(6, M())],
  'loop-2': [REP(4, M(), M(), R())],
  'loop-3': [REP(7, M())],
  'cond-1': WALLFOLLOW(25),
  'cond-2': WALLFOLLOW6(24),
  'proj-1': WALLFOLLOW6(24),
  'proj-2': WALLFOLLOW(25),
};

// 错误程序应当失败
const failing = {
  'seq-1': [[M()], [R(), M()], []],
  'loop-1': [REP(5, M())],
  'cond-2': [REP(31, M())],
};

let ok = true;
for (const level of LEVELS) {
  const sol = solutions[level.id];
  const res = validate(level.world, sol);
  const count = res.blockCount;
  const stars = count <= level.par3 ? 3 : count <= level.par2 ? 2 : 1;
  const tag = res.success ? (stars === 3 ? 'PASS 3★' : `PASS ${stars}★`) : 'FAIL';
  if (!res.success || stars !== 3) ok = false;
  console.log(`${tag.padEnd(8)} ${level.id.padEnd(8)} blocks=${count} moves=${res.moves} ${level.title}`);
  for (const bad of failing[level.id] || []) {
    const r2 = validate(level.world, bad);
    if (r2.success) { console.log(`  !! 错误程序竟通过: ${JSON.stringify(bad).slice(0, 60)}`); ok = false; }
  }
}
console.log(ok ? '\n所有参考解均达成 3 星 ✅' : '\n有关卡未达成预期 ❌');
process.exit(ok ? 0 : 1);
