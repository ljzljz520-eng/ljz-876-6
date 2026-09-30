import React, { useEffect, useState, useCallback } from 'react';
import { api } from '../api.js';

const REASON_LABELS = {
  wall: '撞到墙（路线/转向错误）',
  goals: '漏收星星',
  notFinish: '没走到终点',
  empty: '程序为空',
  programTooLong: '循环设置过大',
};

const CONCEPT_NAME = { sequence: '顺序逻辑', loops: '循环', conditions: '条件判断', project: '小项目' };

const CONCEPT_COLORS = {
  sequence: { bg: '#e8f3ff', fg: '#0984e3' },
  loops: { bg: '#fff3e6', fg: '#e17055' },
  conditions: { bg: '#fde9f4', fg: '#d63384' },
  project: { bg: '#e8faf3', fg: '#00b894' },
};

export default function ClassDetail({ classId, navigate }) {
  const [data, setData] = useState(null);
  const [levels, setLevels] = useState([]);
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');
  const [selected, setSelected] = useState(() => new Set());
  const [dueAt, setDueAt] = useState('');
  const [tab, setTab] = useState('overview');

  const load = useCallback(() => {
    api(`/teacher/classes/${classId}`).then(setData).catch((e) => setError(e.message));
    api('/levels').then(setLevels).catch(() => {});
  }, [classId]);

  useEffect(load, [classId]);

  const toggle = (id) => {
    const next = new Set(selected);
    next.has(id) ? next.delete(id) : next.add(id);
    setSelected(next);
  };

  const assign = async () => {
    setError(''); setMsg('');
    if (selected.size === 0) { setError('请先勾选要布置的关卡'); return; }
    try {
      await api(`/teacher/classes/${classId}/assign`, {
        method: 'POST',
        body: JSON.stringify({ levelIds: [...selected], dueAt: dueAt || null }),
      });
      setMsg(`✅ 已布置 ${selected.size} 个关卡`);
      setSelected(new Set());
      load();
    } catch (e) { setError(e.message); }
  };

  if (error && !data) return <div className="page"><div className="empty-state">😵 {error}</div></div>;
  if (!data) return <div className="page">加载中…</div>;

  const assignedIds = new Set(data.assignments.map((a) => a.levelId));
  const chapters = [1, 2, 3, 4];
  const chapterTitles = {
    1: '第一章 · 顺序逻辑', 2: '第二章 · 循环', 3: '第三章 · 条件判断', 4: '第四章 · 小项目',
  };

  return (
    <div className="page">
      <button className="btn-ghost" style={{ marginBottom: 12 }} onClick={() => navigate('home')}>← 返回班级列表</button>
      <h1 className="page-title">{data.name}</h1>
      <p className="page-sub">
        邀请码 <b style={{ color: '#6c5ce7' }}>{data.inviteCode}</b> · 共 {data.students.length} 名学生
      </p>

      <div className="child-tabs">
        <button className={`child-tab ${tab === 'overview' ? 'active' : ''}`} onClick={() => setTab('overview')}>📊 学情概览</button>
        <button className={`child-tab ${tab === 'assign' ? 'active' : ''}`} onClick={() => setTab('assign')}>📋 布置关卡</button>
        <button className={`child-tab ${tab === 'students' ? 'active' : ''}`} onClick={() => setTab('students')}>🧒 学生明细</button>
      </div>

      {error && <div className="error-msg">{error}</div>}
      {msg && <div className="privacy-note" style={{ background: '#e8faf3', borderColor: '#b7e8d4', color: '#007a55' }}>{msg}</div>}

      {tab === 'overview' && (
        <>
          <h2 style={{ fontSize: 17 }}>🚦 哪些概念把学生卡住了？</h2>
          <div className="dash-grid">
            {data.conceptOverview.map((c) => {
              const hot = c.failures >= 5;
              const warm = c.failures >= 2;
              return (
                <div className="stat-card" key={c.concept} style={{
                  borderTop: `4px solid ${hot ? '#e17055' : warm ? '#fdcb6e' : '#00b894'}`,
                }}>
                  <div className="concept-header">
                    <strong style={{ fontSize: 16 }}>{c.emoji} {c.name}</strong>
                    {hot && <span className="pill pill-red">需重点讲解</span>}
                    {warm && !hot && <span className="pill pill-yellow">有点卡</span>}
                    {!warm && <span className="pill pill-green">较顺畅</span>}
                  </div>
                  <div style={{ marginTop: 12, fontSize: 14, lineHeight: 2 }}>
                    失败尝试：<b className={hot ? 'heat-high' : warm ? 'heat-mid' : 'heat-ok'}>{c.failures}</b> 次<br />
                    已通关人次：<b>{c.clears}</b><br />
                    通关平均星级：<b>{c.avgStars} ★</b>
                  </div>
                </div>
              );
            })}
            {data.conceptOverview.length === 0 && (
              <div className="empty-state" style={{ gridColumn: '1/-1' }}>
                <div className="big">📝</div>
                <p>还没有学生开始练习。先去“布置关卡”吧！</p>
              </div>
            )}
          </div>

          <h2 style={{ fontSize: 17, marginTop: 28 }}>📋 已布置关卡完成情况</h2>
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>关卡</th><th>概念</th><th>完成</th><th>平均星</th><th>总尝试</th><th>主要卡点</th></tr>
              </thead>
              <tbody>
                {data.assignments.map((a) => (
                  <tr key={a.id}>
                    <td><b>{a.title}</b></td>
                    <td>
                      <span className="pill" style={{
                        background: CONCEPT_COLORS[a.concept]?.bg || '#f0f1f8',
                        color: CONCEPT_COLORS[a.concept]?.fg || '#666',
                      }}>{CONCEPT_NAME[a.concept]}</span>
                    </td>
                    <td>{a.completed}/{a.studentCount}</td>
                    <td className={a.avgStars < 1.5 ? 'heat-high' : ''}>{a.avgStars} ★</td>
                    <td>{a.attempts}</td>
                    <td>
                      {a.stuck.length === 0 ? <span style={{ color: '#8e94a8' }}>—</span> : a.stuck.map((s) => (
                        <span key={s.reason} className="pill pill-red" style={{ marginRight: 6 }}>
                          {REASON_LABELS[s.reason] || s.reason} ×{s.count}
                        </span>
                      ))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {tab === 'assign' && (
        <>
          <div className="panel" style={{ marginBottom: 16, display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
            <label style={{ fontSize: 14, fontWeight: 600 }}>截止时间（选填）：</label>
            <input type="datetime-local" value={dueAt} onChange={(e) => setDueAt(e.target.value)}
              style={{ padding: '9px 12px', border: '2px solid #e7e9f5', borderRadius: 10 }} />
            <span style={{ flex: 1 }} />
            <span style={{ fontSize: 14, color: '#8e94a8' }}>已选 {selected.size} 关</span>
            <button className="btn-primary" style={{ width: 'auto', padding: '10px 24px', margin: 0 }} onClick={assign}>
              📨 布置给全班
            </button>
          </div>

          {chapters.map((ch) => (
            <div className="chapter-section" key={ch}>
              <div className="chapter-head"><div className="num">{ch}</div><h2>{chapterTitles[ch]}</h2></div>
              <div className="level-grid">
                {levels.filter((l) => l.chapter === ch).map((lv) => {
                  const isAssigned = assignedIds.has(lv.id);
                  const isSel = selected.has(lv.id);
                  return (
                    <div key={lv.id} className="level-card"
                      style={{ borderColor: isSel ? '#6c5ce7' : isAssigned ? '#b7e8d4' : 'transparent', opacity: isAssigned && !isSel ? 0.75 : 1 }}
                      onClick={() => !isAssigned && toggle(lv.id)}>
                      <div className="lc-top">
                        <span className="lc-order">第 {lv.order} 关</span>
                        {isAssigned
                          ? <span className="pill pill-green">已布置</span>
                          : <span className="pill" style={{ background: CONCEPT_COLORS[lv.concept]?.bg, color: CONCEPT_COLORS[lv.concept]?.fg }}>{lv.conceptName}</span>}
                      </div>
                      <h3>{lv.title}</h3>
                      <div style={{ fontSize: 12, color: '#8e94a8', marginTop: 6, lineHeight: 1.5 }}>
                        三星 ≤{lv.par3} 块积木 · 二星 ≤{lv.par2} 块
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </>
      )}

      {tab === 'students' && (
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>学生</th><th>已完成布置</th><th>累计星</th><th>卡住关卡</th><th>逐关进度</th></tr>
            </thead>
            <tbody>
              {data.students.map((s) => (
                <tr key={s.id}>
                  <td><b>{s.name}</b><br /><span style={{ color: '#8e94a8', fontSize: 12 }}>{s.username}</span></td>
                  <td>{s.completed}/{s.totalAssigned}</td>
                  <td>⭐ {s.stars}</td>
                  <td>
                    {s.stuckCount > 0
                      ? <span className="pill pill-red">{s.stuckCount} 关卡住（尝试≥3次未通关）</span>
                      : <span className="pill pill-green">状态良好</span>}
                  </td>
                  <td style={{ maxWidth: 360 }}>
                    {s.progress.map((p) => (
                      <span key={p.levelId} title={`${p.title}：尝试${p.tries}次`}
                        style={{ display: 'inline-block', width: 12, height: 12, borderRadius: 3, margin: 2,
                          background: p.stuck ? '#e17055' : p.done ? '#00b894' : p.tries > 0 ? '#fdcb6e' : '#dde1ef' }} />
                    ))}
                    <div style={{ fontSize: 11, color: '#8e94a8', marginTop: 4 }}>
                      绿=通关 黄=尝试中 红=卡住 灰=未开始
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
