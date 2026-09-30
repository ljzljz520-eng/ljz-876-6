import React, { useState } from 'react';
import { authApi } from '../api.js';

const ROLES = [
  { key: 'student', label: '🧒 我是学生', emoji: '🧒' },
  { key: 'parent', label: '👪 家长' },
  { key: 'teacher', label: '🧑‍🏫 老师' },
];

export default function AuthPage({ onLogin }) {
  const [mode, setMode] = useState('login');
  const [role, setRole] = useState('student');
  const [form, setForm] = useState({
    username: '', password: '', displayName: '', classCode: '', parentCode: '',
  });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const submit = async () => {
    setError('');
    if (!form.username || !form.password) { setError('请输入用户名和密码'); return; }
    if (mode === 'register' && !form.displayName) { setError('请填写昵称/姓名'); return; }
    setBusy(true);
    try {
      if (mode === 'login') {
        const data = await authApi.login(form.username, form.password);
        onLogin(data);
      } else {
        const data = await authApi.register({ role, ...form });
        onLogin(data);
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="auth-wrap">
      <div className="auth-card">
        <div className="auth-logo">🤖🌟</div>
        <h1>编程闯关乐园</h1>
        <p className="sub">拖一拖积木，帮小机器人闯过重重关卡！</p>

        <div className="role-tabs">
          {ROLES.map((r) => (
            <button
              key={r.key}
              className={`role-tab ${role === r.key ? 'active' : ''}`}
              onClick={() => setRole(r.key)}
            >
              {r.label}
            </button>
          ))}
        </div>

        {error && <div className="error-msg">{error}</div>}

        {mode === 'register' && (
          <div className="field">
            <label>{role === 'student' ? '学生昵称' : role === 'parent' ? '家长称呼' : '老师姓名'}</label>
            <input value={form.displayName} onChange={set('displayName')}
              placeholder={role === 'student' ? '例如：小明' : role === 'parent' ? '例如：小明妈妈' : '例如：王老师'} />
          </div>
        )}
        <div className="field">
          <label>用户名</label>
          <input value={form.username} onChange={set('username')} placeholder="登录时使用" autoComplete="username" />
        </div>
        <div className="field">
          <label>密码</label>
          <input type="password" value={form.password} onChange={set('password')} placeholder="至少 4 位" autoComplete="current-password" />
        </div>

        {mode === 'register' && role === 'student' && (
          <div className="field">
            <label>班级邀请码（选填，老师会提供）</label>
            <input value={form.classCode} onChange={set('classCode')} placeholder="例如：KID2026" />
          </div>
        )}
        {mode === 'register' && role === 'parent' && (
          <div className="field">
            <label>关联孩子的用户名（选填，稍后也可添加）</label>
            <input value={form.parentCode} onChange={set('parentCode')} placeholder="孩子登录用的用户名" />
          </div>
        )}

        <button className="btn-primary" disabled={busy} onClick={submit}>
          {busy ? '请稍候…' : mode === 'login' ? '登 录' : '注 册'}
        </button>

        <div className="auth-switch">
          {mode === 'login' ? (
            <>还没有账号？<a onClick={() => { setMode('register'); setError(''); }}>立即注册</a></>
          ) : (
            <>已有账号？<a onClick={() => { setMode('login'); setError(''); }}>去登录</a></>
          )}
        </div>
        {mode === 'login' && (
          <p className="sub" style={{ marginTop: 18, fontSize: 12 }}>
            演示账号：xiaoming / mama / teacher，密码 1234
          </p>
        )}
      </div>
    </div>
  );
}
