import express from 'express';
import cors from 'cors';
import crypto from 'crypto';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
import db from './db.js';
import { LEVELS, getLevel, CONCEPT_INFO } from './levels.js';
import { validate, starsFor } from './engine.js';
import { hashPassword, verifyPassword, signToken, authRequired, roleRequired } from './auth.js';

const app = express();
app.use(cors());
app.use(express.json({ limit: '256kb' }));

// 对孩子可见的关卡信息（绝不包含任何参考解/判定细节）
function publicLevel(lv) {
  return {
    id: lv.id,
    chapter: lv.chapter,
    order: lv.order,
    title: lv.title,
    concept: lv.concept,
    conceptName: CONCEPT_INFO[lv.concept]?.name || lv.concept,
    brief: lv.brief,
    hint: lv.hint,
    allowed: lv.allowed,
    par3: lv.par3,
    par2: lv.par2,
    world: lv.world,
  };
}

/* ---------------- 认证 ---------------- */
app.post('/api/auth/register', (req, res) => {
  const { username, password, role, displayName, classCode, parentCode } = req.body || {};
  if (!username || !password || !role || !displayName) {
    return res.status(400).json({ error: '请填写完整的注册信息' });
  }
  if (!['student', 'parent', 'teacher'].includes(role)) {
    return res.status(400).json({ error: '未知的账号类型' });
  }
  if (String(password).length < 4) {
    return res.status(400).json({ error: '密码至少 4 位' });
  }

  const exists = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
  if (exists) return res.status(409).json({ error: '用户名已被占用' });

  const tx = db.transaction(() => {
    const info = db.prepare(
      'INSERT INTO users (username, password_hash, role, display_name) VALUES (?,?,?,?)',
    ).run(username, hashPassword(password), role, displayName);
    const userId = info.lastInsertRowid;

    if (role === 'student' && classCode) {
      const cls = db.prepare('SELECT id FROM classes WHERE invite_code = ?').get(classCode.trim());
      if (!cls) throw Object.assign(new Error('班级邀请码不正确'), { status: 400 });
      db.prepare('INSERT OR IGNORE INTO class_members (class_id, student_id) VALUES (?,?)')
        .run(cls.id, userId);
    }
    if (role === 'parent' && parentCode) {
      // 家长可用孩子的用户名直接关联（家长不需要知道孩子密码）
      const child = db.prepare("SELECT id FROM users WHERE username = ? AND role = 'student'").get(parentCode.trim());
      if (!child) throw Object.assign(new Error('孩子用户名不存在'), { status: 400 });
      db.prepare('INSERT OR IGNORE INTO parent_links (parent_id, student_id) VALUES (?,?)')
        .run(userId, child.id);
    }
    return userId;
  });

  try {
    const userId = tx();
    const user = { id: userId, role, display_name: displayName };
    res.json({ token: signToken(user), user: { id: userId, role, username, displayName } });
  } catch (e) {
    res.status(e.status || 500).json({ error: e.message || '注册失败' });
  }
});

app.post('/api/auth/login', (req, res) => {
  const { username, password } = req.body || {};
  const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username || '');
  if (!user || !verifyPassword(password || '', user.password_hash)) {
    return res.status(401).json({ error: '用户名或密码不正确' });
  }
  res.json({
    token: signToken(user),
    user: { id: user.id, role: user.role, username: user.username, displayName: user.display_name },
  });
});

app.get('/api/me', authRequired, (req, res) => {
  const u = db.prepare('SELECT id, username, role, display_name FROM users WHERE id = ?').get(req.user.id);
  if (!u) return res.status(404).json({ error: '用户不存在' });
  res.json({ id: u.id, role: u.role, username: u.username, displayName: u.display_name });
});

/* ---------------- 题库 ---------------- */
app.get('/api/levels', authRequired, (req, res) => {
  const studentId = req.user.role === 'student' ? req.user.id : null;
  const best = studentId
    ? db.prepare(`
        SELECT level_id, MAX(stars) AS stars, MAX(CASE WHEN success THEN 1 ELSE 0 END) AS done
        FROM attempts WHERE student_id = ? GROUP BY level_id`).all(studentId)
    : [];
  const bestMap = Object.fromEntries(best.map((b) => [b.level_id, b]));
  res.json(LEVELS.map(publicLevel).map((lv) => ({
    ...lv,
    bestStars: bestMap[lv.id]?.stars || 0,
    done: !!bestMap[lv.id]?.done,
  })));
});

app.get('/api/levels/:id', authRequired, (req, res) => {
  const lv = getLevel(req.params.id);
  if (!lv) return res.status(404).json({ error: '关卡不存在' });
  res.json(publicLevel(lv));
});

/* ---------------- 提交判题（服务端权威判定） ---------------- */
app.post('/api/attempts', authRequired, roleRequired('student'), (req, res) => {
  const { levelId, program, classId } = req.body || {};
  const lv = getLevel(levelId);
  if (!lv) return res.status(404).json({ error: '关卡不存在' });
  if (!Array.isArray(program)) return res.status(400).json({ error: '程序格式不正确' });

  // 仅允许该关卡开放的积木类型
  const allowed = new Set(lv.allowed);
  const checkNodes = (nodes) => nodes.every((n) => {
    if (!n || typeof n !== 'object') return false;
    if (!allowed.has(n.type)) return false;
    if (n.type === 'repeat') {
      const t = Number(n.times);
      if (!Number.isInteger(t) || t < 1 || t > 60) return false;
      return Array.isArray(n.children) && checkNodes(n.children);
    }
    if (n.type === 'if') {
      if (!['wallAhead', 'wallLeft', 'wallRight', 'pathAhead'].includes(n.cond)) return false;
      return Array.isArray(n.then) && Array.isArray(n.else) &&
        checkNodes(n.then) && checkNodes(n.else);
    }
    if (n.type === 'turn') return n.value === 'left' || n.value === 'right';
    return n.type === 'move';
  });
  if (!checkNodes(program)) return res.status(400).json({ error: '包含本关不能使用的积木' });

  const result = validate(lv.world, program);
  const stars = result.success ? starsFor(lv, result.blockCount) : 0;

  let linkedClassId = null;
  if (classId) {
    const member = db.prepare(
      'SELECT 1 FROM class_members WHERE class_id = ? AND student_id = ?',
    ).get(classId, req.user.id);
    if (member) linkedClassId = classId;
  }

  db.prepare(`
    INSERT INTO attempts (student_id, level_id, class_id, success, stars, block_count, fail_reason)
    VALUES (?,?,?,?,?,?,?)`
  ).run(req.user.id, levelId, linkedClassId, result.success ? 1 : 0, stars, result.blockCount, result.failReason || null);

  res.json({
    success: result.success,
    stars,
    blockCount: result.blockCount,
    moves: result.moves,
    failReason: result.failReason,
  });
});

// 孩子：我的闯关记录（只返回自己的星级/进度，不含任何答案）
app.get('/api/my/progress', authRequired, roleRequired('student'), (req, res) => {
  const rows = db.prepare(`
    SELECT level_id,
           MAX(stars) AS best_stars,
           SUM(CASE WHEN success THEN 1 ELSE 0 END) AS clears,
           COUNT(*) AS tries,
           MAX(CASE WHEN success THEN created_at ELSE NULL END) AS cleared_at
    FROM attempts WHERE student_id = ? GROUP BY level_id`
  ).all(req.user.id);
  res.json(rows);
});

/* ---------------- 家长视角：只看学习进度，不看标准答案 ---------------- */
app.post('/api/parent/link', authRequired, roleRequired('parent'), (req, res) => {
  const child = db.prepare("SELECT id, display_name FROM users WHERE username = ? AND role = 'student'")
    .get(String(req.body?.childUsername || '').trim());
  if (!child) return res.status(404).json({ error: '孩子用户名不存在' });
  db.prepare('INSERT OR IGNORE INTO parent_links (parent_id, student_id) VALUES (?,?)')
    .run(req.user.id, child.id);
  res.json({ ok: true, childName: child.display_name });
});

app.get('/api/parent/children', authRequired, roleRequired('parent'), (req, res) => {
  const children = db.prepare(`
    SELECT u.id, u.display_name AS name, u.username
    FROM parent_links pl JOIN users u ON u.id = pl.student_id
    WHERE pl.parent_id = ?`).all(req.user.id);

  const result = children.map((c) => {
    const summary = db.prepare(`
      SELECT
        COUNT(DISTINCT CASE WHEN success THEN level_id END) AS cleared_levels,
        COALESCE(SUM(stars), 0) AS total_stars,
        COUNT(*) AS total_attempts,
        SUM(CASE WHEN NOT success THEN 1 ELSE 0 END) AS failed_attempts
      FROM attempts WHERE student_id = ?`).get(c.id);

    const byConcept = db.prepare(`
      SELECT a.fail_reason, a.level_id, COUNT(*) AS n
      FROM attempts a
      JOIN (SELECT 1)
      WHERE a.student_id = ? AND a.success = 0
      GROUP BY a.level_id, a.fail_reason`).all(c.id);

    // 概念掌握度：基于每个概念下已获星星 / 可获星星
    const conceptRows = LEVELS.map((lv) => {
      const best = db.prepare(
        'SELECT MAX(stars) AS s FROM attempts WHERE student_id = ? AND level_id = ?',
      ).get(c.id, lv.id);
      return { concept: lv.concept, stars: best.s || 0 };
    });
    const conceptMap = {};
    for (const r of conceptRows) {
      conceptMap[r.concept] = conceptMap[r.concept] || { stars: 0, max: 0 };
      conceptMap[r.concept].stars += r.stars;
      conceptMap[r.concept].max += 3;
    }
    const concepts = Object.entries(conceptMap).map(([key, v]) => ({
      concept: key,
      name: CONCEPT_INFO[key]?.name || key,
      emoji: CONCEPT_INFO[key]?.emoji || '',
      stars: v.stars,
      max: v.max,
      percent: Math.round((v.stars / v.max) * 100),
    }));

    const levels = db.prepare(`
      SELECT level_id,
                     MAX(stars) AS best_stars,
                     MAX(CASE WHEN success THEN 1 ELSE 0 END) AS done,
                     COUNT(*) AS tries,
                     MAX(created_at) AS last_try_at
              FROM attempts WHERE student_id = ? GROUP BY level_id`).all(c.id)
      .map((r) => ({
        levelId: r.level_id,
        title: getLevel(r.level_id)?.title || r.level_id,
        concept: getLevel(r.level_id)?.concept,
        bestStars: r.best_stars,
        done: !!r.done,
        tries: r.tries,
        lastTryAt: r.last_try_at,
      }));

    return {
      id: c.id, name: c.name, username: c.username,
      clearedLevels: summary.cleared_levels,
      totalLevels: LEVELS.length,
      totalStars: summary.total_stars,
      totalAttempts: summary.total_attempts,
      failedAttempts: summary.failed_attempts,
      concepts,
      levels,
    };
  });

  res.json(result);
});

/* ---------------- 老师视角：班级、布置关卡、学情分析 ---------------- */
app.post('/api/teacher/classes', authRequired, roleRequired('teacher'), (req, res) => {
  const name = String(req.body?.name || '').trim();
  if (!name) return res.status(400).json({ error: '请填写班级名称' });
  let code;
  for (let i = 0; i < 5; i++) {
    code = crypto.randomBytes(4).toString('hex').toUpperCase();
    const dup = db.prepare('SELECT 1 FROM classes WHERE invite_code = ?').get(code);
    if (!dup) break;
  }
  const info = db.prepare('INSERT INTO classes (name, teacher_id, invite_code) VALUES (?,?,?)')
    .run(name, req.user.id, code);
  res.json({ id: info.lastInsertRowid, name, inviteCode: code });
});

app.get('/api/teacher/classes', authRequired, roleRequired('teacher'), (req, res) => {
  const classes = db.prepare(`
    SELECT c.id, c.name, c.invite_code AS inviteCode,
           (SELECT COUNT(*) FROM class_members cm WHERE cm.class_id = c.id) AS studentCount
    FROM classes c WHERE c.teacher_id = ? ORDER BY c.created_at DESC`).all(req.user.id);
  res.json(classes);
});

app.post('/api/teacher/classes/:id/assign', authRequired, roleRequired('teacher'), (req, res) => {
  const cls = db.prepare('SELECT * FROM classes WHERE id = ? AND teacher_id = ?')
    .get(req.params.id, req.user.id);
  if (!cls) return res.status(404).json({ error: '班级不存在' });

  const levelIds = Array.isArray(req.body?.levelIds)
    ? req.body.levelIds
    : (req.body?.levelId ? [req.body.levelId] : []);
  const dueAt = req.body?.dueAt || null;

  const insert = db.prepare(`
    INSERT OR IGNORE INTO assignments (class_id, level_id, title, concept, due_at)
    VALUES (?,?,?,?,?)`);
  const tx = db.transaction(() => {
    for (const lid of levelIds) {
      const lv = getLevel(lid);
      if (lv) insert.run(cls.id, lv.id, lv.title, lv.concept, dueAt);
    }
  });
  tx();
  res.json({ ok: true, assigned: levelIds.length });
});

app.get('/api/teacher/classes/:id', authRequired, roleRequired('teacher'), (req, res) => {
  const cls = db.prepare('SELECT id, name, invite_code AS inviteCode FROM classes WHERE id = ? AND teacher_id = ?')
    .get(req.params.id, req.user.id);
  if (!cls) return res.status(404).json({ error: '班级不存在' });

  const assignments = db.prepare(`
    SELECT a.id, a.level_id AS levelId, a.title, a.concept, a.due_at AS dueAt,
           (SELECT COUNT(*) FROM class_members) AS dummy
    FROM assignments a WHERE a.class_id = ? ORDER BY a.created_at DESC`).all(cls.id);

  const students = db.prepare(`
    SELECT u.id, u.display_name AS name, u.username
    FROM class_members cm JOIN users u ON u.id = cm.student_id
    WHERE cm.class_id = ? ORDER BY u.display_name`).all(cls.id);

  // 每个布置关卡：完成人数、平均星级、人均尝试次数
  const assignmentStats = assignments.map((a) => {
    const stats = db.prepare(`
      SELECT
        COUNT(DISTINCT CASE WHEN s.success THEN s.student_id END) AS completed,
        AVG(CASE WHEN s.success THEN s.stars END) AS avg_stars,
        COUNT(s.id) AS attempts
      FROM (
        SELECT student_id, success, stars, id,
               ROW_NUMBER() OVER (PARTITION BY student_id ORDER BY created_at DESC) rn
        FROM attempts WHERE level_id = ? AND class_id = ?
      ) s WHERE s.rn = 1
    `).get(a.levelId, cls.id);

    // 按失败原因聚合（老师可以看到“哪个概念/关卡把学生卡住了”）
    const stuck = db.prepare(`
      SELECT fail_reason AS reason, COUNT(*) AS count
      FROM attempts
      WHERE class_id = ? AND level_id = ? AND success = 0
      GROUP BY fail_reason ORDER BY count DESC`).all(cls.id, a.levelId);

    return {
      ...a,
      studentCount: students.length,
      completed: stats.completed || 0,
      avgStars: stats.avg_stars ? Number(stats.avg_stars.toFixed(1)) : 0,
      attempts: stats.attempts || 0,
      stuck,
    };
  });

  // 概念维度：卡住次数、平均星级、未开始人数
  const conceptOverview = Object.keys(CONCEPT_INFO).map((concept) => {
    const conceptLevelIds = LEVELS.filter((l) => l.concept === concept).map((l) => l.id);
    const ph = conceptLevelIds.map(() => '?').join(',');
    const failCount = db.prepare(`
      SELECT COUNT(*) AS n FROM attempts
      WHERE class_id = ? AND success = 0 AND level_id IN (${ph})`
    ).get(cls.id, ...conceptLevelIds).n;
    const successes = db.prepare(`
      SELECT COUNT(*) AS n FROM (
        SELECT DISTINCT student_id, level_id FROM attempts
        WHERE class_id = ? AND success = 1 AND level_id IN (${ph})
      )`).get(cls.id, ...conceptLevelIds).n;
    const avgStarsRow = db.prepare(`
      SELECT AVG(stars) AS a FROM (
        SELECT student_id, level_id, MAX(stars) AS stars
        FROM attempts WHERE class_id = ? AND level_id IN (${ph})
        GROUP BY student_id, level_id
      )`).get(cls.id, ...conceptLevelIds);
    return {
      concept,
      name: CONCEPT_INFO[concept].name,
      emoji: CONCEPT_INFO[concept].emoji,
      failures: failCount,
      clears: successes,
      avgStars: avgStarsRow.a ? Number(avgStarsRow.a.toFixed(2)) : 0,
      assigned: assignments.some((a) => a.concept === concept),
    };
  }).filter((c) => c.assigned || c.failures > 0 || c.clears > 0);

  // 学生明细
  const studentDetails = students.map((st) => {
    const rows = db.prepare(`
      SELECT level_id, MAX(stars) AS stars, MAX(CASE WHEN success THEN 1 ELSE 0 END) AS done,
             COUNT(*) AS tries
      FROM attempts WHERE class_id = ? AND student_id = ? GROUP BY level_id`
    ).all(cls.id, st.id);
    const map = Object.fromEntries(rows.map((r) => [r.level_id, r]));
    const assignedProgress = assignments.map((a) => ({
      levelId: a.levelId,
      title: a.title,
      stars: map[a.levelId]?.stars || 0,
      done: !!map[a.levelId]?.done,
      tries: map[a.levelId]?.tries || 0,
      // 卡住信号：尝试 >=3 次仍未通关
      stuck: (map[a.levelId]?.tries || 0) >= 3 && !map[a.levelId]?.done,
    }));
    const stuckCount = assignedProgress.filter((p) => p.stuck).length;
    return {
      id: st.id, name: st.name, username: st.username,
      stars: assignedProgress.reduce((s, p) => s + p.stars, 0),
      completed: assignedProgress.filter((p) => p.done).length,
      totalAssigned: assignments.length,
      stuckCount,
      progress: assignedProgress,
    };
  });

  res.json({
    ...cls,
    assignments: assignmentStats,
    conceptOverview,
    students: studentDetails,
  });
});

// 学生：我被布置的关卡
app.get('/api/my/assignments', authRequired, roleRequired('student'), (req, res) => {
  const rows = db.prepare(`
    SELECT c.id AS class_id, c.name AS class_name, a.level_id AS levelId,
           a.title, a.concept, a.due_at AS dueAt,
           (SELECT MAX(stars) FROM attempts at2
             WHERE at2.student_id = cm.student_id AND at2.level_id = a.level_id) AS best_stars,
           (SELECT MAX(CASE WHEN success THEN 1 ELSE 0 END) FROM attempts at2
             WHERE at2.student_id = cm.student_id AND at2.level_id = a.level_id) AS done
    FROM class_members cm
    JOIN classes c ON c.id = cm.class_id
    JOIN assignments a ON a.class_id = c.id
    WHERE cm.student_id = ?
    ORDER BY c.name, a.level_id`).all(req.user.id);
  res.json(rows);
});

app.get('/api/health', (req, res) => res.json({ ok: true }));

// 生产模式：托管前端构建产物
const distDir = path.join(__dirname, '..', '..', 'client', 'dist');
if (fs.existsSync(distDir)) {
  app.use(express.static(distDir));
  app.get(/^(?!\/api).*/, (req, res) => res.sendFile(path.join(distDir, 'index.html')));
}

const PORT = process.env.PORT || 4000;
if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => console.log(`🚀 KidCode Quest API running on http://localhost:${PORT}`));
}

export default app;
