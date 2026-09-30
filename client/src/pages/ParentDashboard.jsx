import React, { useEffect, useState } from 'react';
import { api } from '../api.js';

const CONCEPT_EMOJI = { sequence: '👣', loops: '🔁', conditions: '🔀', project: '🏆' };

export default function ParentDashboard() {
  const [children, setChildren] = useState([]);
  const [selected, setSelected] = useState(0);
  const [loading, setLoading] = useState(true);
  const [linkName, setLinkName] = useState('');
  const [msg, setMsg] = useState('');

  const load = () => {
    setLoading(true);
    api('/parent/children').then((data) => {
      setChildren(data);
      setLoading(false);
    }).catch(() => setLoading(false));
  };
  useEffect(load, []);

  const link = async () => {
    setMsg('');
    try {
      await api('/parent/link', { method: 'POST', body: JSON.stringify({ childUsername: linkName }) });
      setLinkName('');
      setMsg('✅ 已成功关联孩子');
      load();
    } catch (e) {
      setMsg('❌ ' + e.message);
    }
  };

  if (loading) return <div className="page">加载中…</div>;

  const child = children[selected];

  return (
    <div className="page">
      <h1 className="page-title">👪 孩子的学习进度</h1>
      <p className="page-sub">关注孩子的成长轨迹，陪 TA 一起进步</p>

      <div className="privacy-note">
        🔒 隐私保护：这里只展示学习进度、星级与概念掌握情况，<b>不会显示题目的标准答案和孩子的具体程序</b>，
        鼓励孩子独立思考。
      </div>

      <div className="form-row">
        <input
          value={linkName}
          onChange={(e) => setLinkName(e.target.value)}
          placeholder="输入孩子的用户名以关联"
          onKeyDown={(e) => e.key === 'Enter' && link()}
        />
        <button className="btn-primary" style={{ width: 'auto', padding: '0 22px', margin: 0 }} onClick={link}>
          ➕ 关联孩子
        </button>
      </div>
      {msg && <p style={{ fontSize: 13 }}>{msg}</p>}

      {children.length === 0 ? (
        <div className="empty-state">
          <div className="big">🧸</div>
          <p>还没有关联孩子。输入孩子的用户名（孩子注册时使用的登录名）即可查看 TA 的进度。</p>
        </div>
      ) : (
        <>
          <div className="child-tabs">
            {children.map((c, i) => (
              <button key={c.id} className={`child-tab ${i === selected ? 'active' : ''}`} onClick={() => setSelected(i)}>
                {c.name}
              </button>
            ))}
          </div>

          {child && (
            <>
              <div className="dash-grid">
                <div className="stat-card">
                  <div className="num">{child.clearedLevels}<span style={{ fontSize: 16, color: '#8e94a8' }}>/{child.totalLevels}</span></div>
                  <div className="lbl">已通关关卡</div>
                </div>
                <div className="stat-card">
                  <div className="num" style={{ color: '#f9a825' }}>⭐ {child.totalStars}</div>
                  <div className="lbl">累计获得星星（满分 {child.totalLevels * 3}）</div>
                </div>
                <div className="stat-card">
                  <div className="num">{child.totalAttempts}</div>
                  <div className="lbl">累计练习次数（成功 {child.totalAttempts - child.failedAttempts} 次 / 未成功 {child.failedAttempts} 次）</div>
                </div>
                <div className="stat-card">
                  <div className="num" style={{ color: child.failedAttempts > 10 ? '#e17055' : '#00b894' }}>
                    {child.totalAttempts ? Math.round(((child.totalAttempts - child.failedAttempts) / child.totalAttempts) * 100) : 0}%
                  </div>
                  <div className="lbl">挑战成功率</div>
                </div>
              </div>

              <h2 style={{ fontSize: 17, marginTop: 26 }}>📊 概念掌握情况</h2>
              <div className="dash-grid">
                {child.concepts.map((c) => (
                  <div className="stat-card" key={c.concept}>
                    <div className="concept-header">
                      <strong>{c.emoji} {c.name}</strong>
                      <span style={{ fontSize: 13, color: '#8e94a8' }}>{c.stars}/{c.max} ⭐</span>
                    </div>
                    <div className="progress-bar">
                      <div className="progress-fill" style={{ width: `${c.percent}%` }} />
                    </div>
                    <div className="lbl" style={{ marginTop: 6 }}>
                      {c.percent >= 80 ? '🌟 掌握得非常好'
                        : c.percent >= 40 ? '💪 正在进步中'
                        : '🌱 刚刚开始，多鼓励 TA 练习'}
                    </div>
                  </div>
                ))}
              </div>

              <h2 style={{ fontSize: 17, marginTop: 26 }}>📖 关卡进度明细</h2>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr><th>关卡</th><th>概念</th><th>状态</th><th>最佳星级</th><th>尝试次数</th><th>最近练习</th></tr>
                  </thead>
                  <tbody>
                    {child.levels.map((l) => (
                      <tr key={l.levelId}>
                        <td>{l.title}</td>
                        <td>{CONCEPT_EMOJI[l.concept] || ''} </td>
                        <td>
                          {l.done ? <span className="pill pill-green">已通关</span> : <span className="pill pill-yellow">挑战中</span>}
                        </td>
                        <td>
                          {[1, 2, 3].map((i) => (
                            <span key={i} className={i <= l.bestStars ? 'star-on' : 'star-off'}>★</span>
                          ))}
                        </td>
                        <td>{l.tries}</td>
                        <td style={{ color: '#8e94a8' }}>{l.lastTryAt || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
