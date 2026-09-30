import React, { useEffect, useMemo, useRef, useState } from 'react';
import { DIRS } from '../engine.js';

const CELL = 52;

function wallEdgesFor(world) {
  // 合并相邻两格声明的同一条墙，输出每格需要渲染的边
  const map = {};
  const add = (x, y, edge) => {
    map[`${x},${y},${edge}`] = true;
  };
  for (const w of world.walls || []) add(w.x, w.y, w.edge);
  // 出界边
  for (let y = 0; y < world.rows; y++) {
    for (let x = 0; x < world.cols; x++) {
      if (y === 0) add(x, y, 'up');
      if (y === world.rows - 1) add(x, y, 'down');
      if (x === 0) add(x, y, 'left');
      if (x === world.cols - 1) add(x, y, 'right');
    }
  }
  return map;
}

export default function WorldGrid({ world, frames, playing, speed = 320, onFinish }) {
  const edges = useMemo(() => wallEdgesFor(world), [world]);
  const [idx, setIdx] = useState(0);
  const timer = useRef(null);
  const finishRef = useRef(onFinish);
  finishRef.current = onFinish;

  useEffect(() => { setIdx(0); }, [frames]);

  useEffect(() => {
    if (!playing) return undefined;
    if (idx >= frames.length - 1) {
      finishRef.current?.();
      return undefined;
    }
    timer.current = setTimeout(() => setIdx((i) => i + 1), speed);
    return () => clearTimeout(timer.current);
  }, [playing, idx, frames.length, speed]);

  // 非播放状态直接显示最后一帧（判题结果）
  const frame = playing ? frames[Math.min(idx, frames.length - 1)] : frames[frames.length - 1];
  const visitedSet = new Set(frame.visited || []);
  const goalsLeftSet = new Set(frame.goalsLeft || []);
  const crashed = frame.action === 'crash';


  return (
    <div className="grid-wrap">
      <div
        className="grid"
        style={{
          gridTemplateColumns: `repeat(${world.cols}, ${CELL}px)`,
          gridTemplateRows: `repeat(${world.rows}, ${CELL}px)`,
          width: world.cols * CELL,
          height: world.rows * CELL,
        }}
      >
        {Array.from({ length: world.rows }, (_, y) =>
          Array.from({ length: world.cols }, (_, x) => {
            const key = `${x},${y}`;
            return (
              <div key={key} className={`cell ${visitedSet.has(key) ? 'visited-cell' : ''}`}>
                {['up', 'down', 'left', 'right'].map((edge) =>
                  edges[`${x},${y},${edge}`] ? <span key={edge} className={`wall wall-${edge}`} /> : null,
                )}
                {world.goals?.some((g) => g.x === x && g.y === y) && goalsLeftSet.has(key) && (
                  <span className="cell-goal">⭐</span>
                )}
                {world.finish?.x === x && world.finish?.y === y && (
                  <span className="cell-finish">🚩</span>
                )}
              </div>
            );
          }),
        )}
        <div style={{
          position: 'absolute', top: 4, left: 4,
          width: CELL - 8, height: CELL - 8,
          transform: `translate(${frame.x * CELL}px, ${frame.y * CELL}px)`,
          transition: 'transform .28s ease',
          zIndex: 8,
        }}>
          <div
            className={`robot ${crashed ? 'crashed' : ''}`}
            style={{ position: 'static', width: '100%', height: '100%', transform: `rotate(${frame.dir * 90}deg)` }}
          >
            <span style={{ display: 'inline-block', transform: `rotate(${-frame.dir * 90}deg)` }}>🤖</span>
          </div>
        </div>
      </div>
    </div>
  );
}
