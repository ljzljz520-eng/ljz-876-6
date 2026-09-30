import React, { useEffect, useState } from 'react';
import { api } from '../api.js';

export default function LevelMap({ user, navigate }) {
  const [levels, setLevels] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [error, setError] = useState('');
  const [starsTotal, setStarsTotal] = useState(0);

  useEffect(() => {
    api('/levels').then(setLevels).catch((e) => setError(e.message));
    api('/my/assignments').then(setAssignments).catch(() => {});
  }, []);

  const assignedIds = new Set(assignments.map((a) => a.levelId));
  const totalStars = levels.reduce((s, l) => s + (l.bestStars || 0), 0);
  const maxStars = levels.length * 3;
  const chapters = [1, 2, 3, 4];
  const chapterTitles = {
    1: '第一章 · 顺序逻辑：一步一步来',
    2: '第二章 · 循环：重复的魔法',
    3: '第三章 · 条件判断：学会做选择',
    4: '第四章 · 小项目挑战：综合大冒险',
  };

  return (
    <div className="page">
      <h1 className="page-title">你好，{user.displayName}！选择一个关卡开始冒险吧 🗺️</h1>
      <p className="page-sub">
        已收集 <b style={{ color: '#f9a825' }}>{totalStars}</b> / {maxStars} 颗星 ·
        完成 {levels.filter((l) => l.done).length} / {levels.length} 关
        {assignments.length > 0 && <> · 老师布置了 {assignments.length} 个关卡 📋</>}
      </p>

      {error && <div className="error-msg">{error}</div>}

      {chapters.map((ch) => (
        <div className="chapter-section" key={ch}>
          <div className="chapter-head">
            <div className="num">{ch}</div>
            <h2>{chapterTitles[ch]}</h2>
          </div>
          <div className="level-grid">
            {levels.filter((l) => l.chapter === ch).map((lv) => (
              <div
                key={lv.id}
                className={`level-card ${assignedIds.has(lv.id) ? 'assigned' : ''}`}
                onClick={() => navigate('play', { levelId: lv.id })}
              >
                {assignedIds.has(lv.id) && <span className="assignment-dot">📋 老师布置</span>}
                <div className="lc-top">
                  <span className="lc-order">第 {lv.order} 关</span>
                  <span className="tag">{lv.conceptName}</span>
                </div>
                <h3>{lv.title}</h3>
                <div className="stars">
                  {[1, 2, 3].map((i) => (
                    <span key={i} className={i <= lv.bestStars ? 'star-on' : 'star-off'}>★</span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
