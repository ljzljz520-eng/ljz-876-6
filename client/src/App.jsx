import React, { useEffect, useState, useCallback } from 'react';
import { authApi, getToken, setToken } from './api.js';
import AuthPage from './pages/AuthPage.jsx';
import LevelMap from './pages/LevelMap.jsx';
import PlayPage from './pages/PlayPage.jsx';
import ParentDashboard from './pages/ParentDashboard.jsx';
import TeacherDashboard from './pages/TeacherDashboard.jsx';
import ClassDetail from './pages/ClassDetail.jsx';

export default function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [route, setRoute] = useState({ name: 'home' });

  const navigate = useCallback((name, params = {}) => setRoute({ name, ...params }), []);

  useEffect(() => {
    if (!getToken()) { setLoading(false); return; }
    authApi.me()
      .then(setUser)
      .catch(() => setToken(null))
      .finally(() => setLoading(false));
  }, []);

  const handleLogin = (data) => {
    setToken(data.token);
    setUser(data.user);
    setRoute({ name: 'home' });
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    setRoute({ name: 'home' });
  };

  if (loading) {
    return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', fontSize: 22 }}>🚀 加载中…</div>;
  }
  if (!user) return <AuthPage onLogin={handleLogin} />;

  const home = () => setRoute({ name: 'home' });

  return (
    <div>
      <div className="topbar">
        <div className="brand" onClick={home}>🤖 编程闯关乐园</div>
        <div className="spacer" />
        <div className="user-info">
          <span className="role-badge">
            {user.role === 'student' ? '🧒 小学员' : user.role === 'parent' ? '👪 家长' : '🧑‍🏫 老师'}
          </span>
          <span>{user.displayName}</span>
          <button className="btn-ghost" onClick={logout}>退出</button>
        </div>
      </div>

      {route.name === 'home' && user.role === 'student' && <LevelMap user={user} navigate={navigate} />}
      {route.name === 'home' && user.role === 'parent' && <ParentDashboard />}
      {route.name === 'home' && user.role === 'teacher' && <TeacherDashboard navigate={navigate} />}
      {route.name === 'play' && <PlayPage levelId={route.levelId} user={user} navigate={navigate} />}
      {route.name === 'class' && user.role === 'teacher' && <ClassDetail classId={route.classId} navigate={navigate} />}
    </div>
  );
}
