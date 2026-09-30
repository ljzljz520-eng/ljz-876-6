import React, { useEffect, useMemo, useState } from 'react';
import { api } from '../api.js';
import { simulate } from '../engine.js';
import BlockPalette from '../components/BlockPalette.jsx';
import ProgramEditor from '../components/ProgramEditor.jsx';
import WorldGrid from '../components/WorldGrid.jsx';
import { praiseFor, failMsgFor } from '../feedback.js';

// 去掉客户端临时 id，提交给服务端判题
function stripIds(nodes) {
  return nodes.map((n) => {
    const o = { type: n.type };
    if (n.type === 'turn') o.value = n.value;
    if (n.type === 'repeat') { o.times = n.times; o.children = stripIds(n.children || []); }
    if (n.type === 'if') {
      o.cond = n.cond;
      o.then = stripIds(n.then || []);
      o.else = stripIds(n.else || []);
    }
    return o;
  });
}

function countBlocks(nodes) {
  let n = 0;
  for (const node of nodes) {
    n += 1;
    if (node.type === 'repeat') n += countBlocks(node.children || []);
    if (node.type === 'if') {
      n += countBlocks(node.then || []);
      n += countBlocks(node.else || []);
    }
  }
  return n;
}

export default function PlayPage({ levelId, navigate }) {
  const [level, setLevel] = useState(null);
  const [program, setProgram] = useState([]);
  const [frames, setFrames] = useState(null);
  const [playing, setPlaying] = useState(false);
  const [result, setResult] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    setError('');
    setResult(null);
    setPlaying(false);
    setProgram([]);
    api(`/levels/${levelId}`).then((lv) => {
      setLevel(lv);
      const startFrame = {
        x: lv.world.start.x, y: lv.world.start.y, dir: lv.world.start.dir,
        visited: [`${lv.world.start.x},${lv.world.start.y}`],
        goalsLeft: lv.world.goals || [],
        action: 'start',
      };
      setFrames([startFrame]);
    }).catch((e) => setError(e.message));
  }, [levelId]);

  const blockCount = useMemo(() => countBlocks(program), [program]);

  // 本地仿真：运行动画
  const run = () => {
    if (!level) return;
    setResult(null);
    const sim = simulate(level.world, program);
    setFrames(sim.frames);
    setPlaying(true);
  };

  // 动画播完后，把结果提交给服务端（服务端重新判题，不信任客户端）
  const onAnimDone = async () => {
    setPlaying(false);
    if (!level || program.length === 0) {
      setResult({ success: false, stars: 0, failReason: 'empty', local: true });
      return;
    }
    setSubmitting(true);
    try {
      const serverResult = await api('/attempts', {
        method: 'POST',
        body: JSON.stringify({ levelId, program: stripIds(program) }),
      });
      setResult(serverResult);
    } catch (e) {
      setResult({ success: false, stars: 0, failReason: '', local: true, error: e.message });
    } finally {
      setSubmitting(false);
    }
  };

  const reset = () => {
    if (!level) return;
    setPlaying(false);
    setResult(null);
    setFrames([{
      x: level.world.start.x, y: level.world.start.y, dir: level.world.start.dir,
      visited: [`${level.world.start.x},${level.world.start.y}`],
      goalsLeft: level.world.goals || [],
      action: 'start',
    }]);
  };

  if (error) return <div className="page"><div className="empty-state">😵 {error}</div></div>;
  if (!level || !frames) return <div className="page">加载关卡中…</div>;

  return (
    <div className="page">
      <div className="play-header">
        <button className="back" onClick={() => navigate('home')}>← 返回地图</button>
        <h2>第 {level.chapter} 章 · {level.title}</h2>
        <span className="pill pill-blue">{level.conceptName}</span>
      </div>

      <div className="play-layout">
        <div>
          <div className="play-brief">
            <b>任务：</b>{level.brief}
            <details className="hint-box">
              <summary>💡 卡住了？点我看小提示（家长看不到答案哦）</summary>
              {level.hint}
            </details>
          </div>

          <div className="panel">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <strong>🧩 积木箱</strong>
              <span style={{ fontSize: 13, color: '#8e94a8' }}>
                当前积木 {blockCount} 块 · ⭐⭐⭐ ≤ {level.par3} 块 · ⭐⭐ ≤ {level.par2} 块
              </span>
            </div>
            <BlockPalette allowed={level.allowed} disabled={playing} />
            <ProgramEditor value={program} onChange={setProgram} disabled={playing} />
            <div className="run-controls">
              <button className="btn-run" onClick={run} disabled={playing || submitting}>
                {playing ? '🏃 运行中…' : '▶️ 运 行'}
              </button>
              <button className="btn-reset" onClick={reset} disabled={playing}>↺ 重置</button>
            </div>
          </div>
        </div>

        <div>
          <div className="panel">
            <WorldGrid world={level.world} frames={frames} playing={playing} onFinish={onAnimDone} />
            <div style={{ marginTop: 12, display: 'flex', gap: 8, justifyContent: 'center', fontSize: 13, color: '#8e94a8' }}>
              <span>🤖 机器人</span><span>⭐ 要收集</span><span>🚩 终点</span>
            </div>
            {submitting && <p style={{ textAlign: 'center', color: '#8e94a8', margin: '10px 0 0' }}>正在判定…</p>}
          </div>
        </div>
      </div>

      {result && <ResultModal result={result} level={level} onRetry={reset}
        onNext={() => navigate('play', { levelId: nextLevelId(level.id) })}
        hasNext={!!nextLevelId(level.id)}
      />}
    </div>
  );
}

const LEVEL_ORDER = ['seq-1','seq-2','seq-3','loop-1','loop-2','loop-3','cond-1','cond-2','proj-1','proj-2'];
function nextLevelId(id) {
  const i = LEVEL_ORDER.indexOf(id);
  return i >= 0 && i < LEVEL_ORDER.length - 1 ? LEVEL_ORDER[i + 1] : null;
}

function ResultModal({ result, level, onRetry, onNext, hasNext }) {
  const success = result.success;
  const stars = result.stars || 0;
  return (
    <div className="result-overlay">
      <div className="result-card">
        <div className="result-emoji">{success ? (stars === 3 ? '🏆' : '🎉') : '🤔'}</div>
        <div className="result-stars">
          {[1, 2, 3].map((i) => (
            <span key={i} className={i <= stars ? 'star-on' : 'star-off'}>★</span>
          ))}
        </div>
        <div className="result-title">{success ? (stars === 3 ? '三星通关！' : '通关成功！') : '差一点点！'}</div>
        <div className="result-msg">
          {success ? praiseFor(stars) : failMsgFor(result.failReason)}
          {result.error && <><br />{result.error}</>}
        </div>
        <div className="result-actions">
          <button style={{ background: '#eef0f8' }} onClick={onRetry}>↺ 再试一次</button>
          {success && hasNext && (
            <button style={{ background: 'linear-gradient(135deg,#6c5ce7,#8e7bff)', color: '#fff' }} onClick={onNext}>
              下一关 →
            </button>
          )}
          {success && !hasNext && (
            <button style={{ background: 'linear-gradient(135deg,#00b894,#00cec9)', color: '#fff' }} onClick={onRetry}>
              🌟 你通关了全部关卡！
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
