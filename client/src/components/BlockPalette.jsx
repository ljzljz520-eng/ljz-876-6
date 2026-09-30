import React from 'react';

export const BLOCK_TYPES = {
  move: { label: '⬆️ 向前走', cls: 'b-move' },
  turn: { label: '↩️ 向右转', cls: 'b-turn' },
  repeat: { label: '🔁 重复', cls: 'b-repeat' },
  if: { label: '🔀 如果', cls: 'b-if' },
};

// 从托盘发起拖拽
export function newBlock(type) {
  if (type === 'move') return { id: crypto.randomUUID(), type: 'move' };
  if (type === 'turn') return { id: crypto.randomUUID(), type: 'turn', value: 'right' };
  if (type === 'repeat') {
    return {
      id: crypto.randomUUID(), type: 'repeat', times: 3,
      children: [],
    };
  }
  return {
    id: crypto.randomUUID(), type: 'if', cond: 'wallAhead',
    then: [], else: [],
  };
}

export default function BlockPalette({ allowed, disabled }) {
  const items = [
    ['move', 'move'],
    ['turn', 'turn'],
    ['repeat', 'repeat'],
    ['if', 'if'],
  ].filter(([, a]) => allowed.includes(a));

  const onDragStart = (e, type) => {
    e.dataTransfer.setData('text/new-block', type);
    e.dataTransfer.effectAllowed = 'copy';
  };

  return (
    <div className="palette">
      {items.map(([type]) => (
        <div
          key={type}
          className={`palette-block ${BLOCK_TYPES[type].cls}`}
          draggable={!disabled}
          onDragStart={(e) => onDragStart(e, type)}
          onClick={() => {
            // 点击也可以添加（触屏友好）：通过自定义事件交给编辑器
            if (!disabled) window.dispatchEvent(new CustomEvent('quick-add-block', { detail: { type } }));
          }}
          title="拖到下面的程序区，或点击直接添加"
        >
          {BLOCK_TYPES[type].label}
        </div>
      ))}
    </div>
  );
}
