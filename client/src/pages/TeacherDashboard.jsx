import React, { useEffect, useState } from 'react';
import { api } from '../api.js';

export default function TeacherDashboard({ navigate }) {
  const [classes, setClasses] = useState([]);
  const [name, setName] = useState('');
  const [error, setError] = useState('');

  const load = () => api('/teacher/classes').then(setClasses).catch((e) => setError(e.message));
  useEffect(() => { load(); }, []);

  const create = async () => {
    setError('');
    if (!name.trim()) { setError('请填写班级名称'); return; }
    try {
      await api('/teacher/classes', { method: 'POST', body: JSON.stringify({ name }) });
      setName('');
      load();
    } catch (e) { setError(e.message); }
  };

  return (
    <div className="page">
      <h1 className="page-title">🧑‍🏫 我的班级</h1>
      <p className="page-sub">创建班级、布置闯关关卡，随时了解学生在哪些概念上需要帮助</p>

      <div className="panel" style={{ marginBottom: 22 }}>
        <div className="form-row" style={{ marginBottom: 0 }}>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="新班级名称，例如：三年级编程二班"
            onKeyDown={(e) => e.key === 'Enter' && create()} />
          <button className="btn-primary" style={{ width: 'auto', padding: '0 26px', margin: 0 }} onClick={create}>
            ➕ 创建班级
          </button>
        </div>
        {error && <div className="error-msg" style={{ marginTop: 10 }}>{error}</div>}
      </div>

      {classes.length === 0 ? (
        <div className="empty-state">
          <div className="big">🏫</div>
          <p>还没有班级，创建一个并把邀请码发给学生吧！</p>
        </div>
      ) : (
        <div className="level-grid">
          {classes.map((c) => (
            <div key={c.id} className="level-card card-link" onClick={() => navigate('class', { classId: c.id })}>
              <div className="lc-top">
                <span className="lc-order">班级</span>
                <span className="tag">{c.studentCount} 名学生</span>
              </div>
              <h3>{c.name}</h3>
              <div style={{ marginTop: 12, fontSize: 13, color: '#8e94a8' }}>
                邀请码：<b style={{ color: '#6c5ce7', fontSize: 16, letterSpacing: 2 }}>{c.inviteCode}</b>
              </div>
              <div style={{ marginTop: 8, fontSize: 13 }}>点击查看学情与布置关卡 →</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
