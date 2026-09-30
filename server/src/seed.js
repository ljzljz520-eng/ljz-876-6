// 初始化演示数据：学生 / 家长 / 老师 + 班级 + 布置 + 一批真实提交记录
import db from './db.js';
import { LEVELS } from './levels.js';
import { validate, starsFor } from './engine.js';
import { hashPassword } from './auth.js';

function reset() {
  db.exec(`
    DELETE FROM attempts; DELETE FROM assignments; DELETE FROM class_members;
    DELETE FROM classes; DELETE FROM parent_links; DELETE FROM users;
    DELETE FROM sqlite_sequence;
  `);
}

function addUser(username, role, name) {
  const info = db.prepare(
    'INSERT INTO users (username, password_hash, role, display_name) VALUES (?,?,?,?)',
  ).run(username, hashPassword('1234'), role, name);
  return info.lastInsertRowid;
}

const kid = (type, value = 1, children = []) => {
  if (type === 'move') return { type: 'move' };
  if (type === 'turn') return { type: 'turn', value };
  if (type === 'repeat') return { type: 'repeat', times: value, children };
  return { type: 'if', cond: value, then: children[0] || [], else: children[1] || [] };
};

function submit(studentId, levelId, program, classId = null) {
  const lv = LEVELS.find((l) => l.id === levelId);
  const r = validate(lv.world, program);
  const stars = r.success ? starsFor(lv, r.blockCount) : 0;
  db.prepare(`
    INSERT INTO attempts (student_id, level_id, class_id, success, stars, block_count, fail_reason)
    VALUES (?,?,?,?,?,?,?)`
  ).run(studentId, levelId, classId, r.success ? 1 : 0, stars, r.blockCount, r.failReason || null);
  return r;
}

reset();

// 老师 + 班级
const teacher = addUser('teacher', 'teacher', '王老师');
const code = 'KID2026';
db.prepare('INSERT INTO classes (name, teacher_id, invite_code) VALUES (?,?,?)')
  .run('三年级编程一班', teacher, code);
const classId = db.prepare('SELECT id FROM classes WHERE invite_code = ?').get(code).id;

// 三个学生
const s1 = addUser('xiaoming', 'student', '小明');
const s2 = addUser('xiaohong', 'student', '小红');
const s3 = addUser('xiaogang', 'student', '小刚');
for (const id of [s1, s2, s3]) {
  db.prepare('INSERT INTO class_members (class_id, student_id) VALUES (?,?)').run(classId, id);
}

// 家长（关联小明、小红）
const parent = addUser('mama', 'parent', '小明妈妈');
db.prepare('INSERT INTO parent_links (parent_id, student_id) VALUES (?,?)').run(parent, s1);
db.prepare('INSERT INTO parent_links (parent_id, student_id) VALUES (?,?)').run(parent, s2);

// 布置前 8 关
const assignStmt = db.prepare(
  'INSERT INTO assignments (class_id, level_id, title, concept, due_at) VALUES (?,?,?,?,?)',
);
for (const lv of LEVELS.slice(0, 8)) {
  assignStmt.run(classId, lv.id, lv.title, lv.concept, '2026-10-15 18:00');
}

// ---- 小明：前 3 关三星，循环关 2 星，条件关卡了 ----
submit(s1, 'seq-1', [kid('move'), kid('move')], classId);
submit(s1, 'seq-2', [kid('move'), kid('move'), kid('turn', 'right'), kid('move'), kid('move')], classId);
submit(s1, 'seq-3', [
  kid('move'), kid('turn', 'right'), kid('move'), kid('move'), kid('turn', 'left'),
  kid('move'), kid('move'), kid('turn', 'right'), kid('move'),
], classId);
submit(s1, 'loop-1', [kid('repeat', 6, [kid('move')])], classId);
submit(s1, 'loop-2', [kid('repeat', 4, [kid('move'), kid('move'), kid('turn', 'right')])], classId);
// 条件关反复撞墙
for (let i = 0; i < 4; i++) {
  submit(s1, 'cond-1', [kid('repeat', 6, [kid('move')])], classId);
}

// ---- 小红：进度更快，条件关 3 星，但在大迷宫尝试多次 ----
submit(s2, 'seq-1', [kid('move'), kid('move')], classId);
submit(s2, 'seq-2', [kid('move'), kid('move'), kid('turn', 'right'), kid('move'), kid('move')], classId);
submit(s2, 'seq-3', [
  kid('move'), kid('turn', 'right'), kid('move'), kid('move'), kid('turn', 'left'),
  kid('move'), kid('move'), kid('turn', 'right'), kid('move'),
], classId);
submit(s2, 'loop-1', [kid('repeat', 6, [kid('move')])], classId);
submit(s2, 'loop-2', [kid('repeat', 4, [kid('move'), kid('move'), kid('turn', 'right')])], classId);
submit(s2, 'loop-3', [kid('repeat', 7, [kid('move')])], classId);
submit(s2, 'cond-1', [
  kid('repeat', 21, [kid('if', 'wallAhead', [[kid('turn', 'right')]], [[kid('move')]])]),
  kid('turn', 'left'), kid('move'),
], classId);
for (let i = 0; i < 3; i++) {
  submit(s2, 'cond-2', [kid('repeat', 10, [kid('if', 'wallAhead', [[kid('turn', 'right')]], [[kid('move')]])])], classId);
}

// ---- 小刚：刚入门，第二关未收集星星（notFinish / goals） ----
submit(s3, 'seq-1', [kid('move'), kid('move')], classId);
submit(s3, 'seq-2', [kid('turn', 'right'), kid('move')], classId);
submit(s3, 'seq-2', [kid('move'), kid('turn', 'right'), kid('move')], classId);

console.log('✅ 演示数据已创建');
console.log('   老师: teacher / 1234   班级邀请码: KID2026');
console.log('   家长: mama / 1234');
console.log('   学生: xiaoming / xiaohong / xiaogang  密码均为 1234');
