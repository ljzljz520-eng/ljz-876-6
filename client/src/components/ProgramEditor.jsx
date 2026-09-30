import React, { useEffect, useRef, useState } from 'react';
import { newBlock } from './BlockPalette.jsx';

// 在树中找到目标容器并插入
function insertInto(nodes, containerId, slot, block) {
  for (const n of nodes) {
    if (n.id === containerId) {
      n[slot] = [...(n[slot] || []), block];
      return true;
    }
    if (n.type === 'repeat') {
      if (insertInto(n.children || [], containerId, slot, block)) return true;
    }
    if (n.type === 'if') {
      if (insertInto(n.then || [], containerId, slot, block)) return true;
      if (insertInto(n.else || [], containerId, slot, block)) return true;
    }
  }
  return false;
}

// 深拷贝程序并为新积木生成 id
function withIds(nodes) {
  return nodes.map((n) => {
    const copy = { ...n, id: n.id || crypto.randomUUID() };
    if (n.type === 'repeat') copy.children = withIds(n.children || []);
    if (n.type === 'if') {
      copy.then = withIds(n.then || []);
      copy.else = withIds(n.else || []);
    }
    return copy;
  });
}

const COND_LABELS = {
  wallAhead: '前面是墙',
  wallLeft: '左边是墙',
  wallRight: '右边是墙',
  pathAhead: '前面有路',
};

function DeleteBtn({ onClick }) {
  return <button className="del-x" onClick={(e) => { e.stopPropagation(); onClick(); }} title="删除这块积木">×</button>;
}

function BlockNode({ node, onChange, onDelete, selectedSlot, onSelectSlot }) {
  if (node.type === 'move') {
    return (
      <span className="block-chip b-move">
        ⬆️ 向前走 <DeleteBtn onClick={onDelete} />
      </span>
    );
  }
  if (node.type === 'turn') {
    const left = node.value === 'left';
    return (
      <span className={`block-chip b-turn`}>
        {left ? '↪️ 向左转' : '↩️ 向右转'} <DeleteBtn onClick={onDelete} />
      </span>
    );
  }
  if (node.type === 'repeat') {
    return (
      <div className="container-block b-repeat">
        <div className="block-row" style={{ margin: 0 }}>
          <span>🔁 重复</span>
          <input
            className="times-input" type="number" min={1} max={60} value={node.times}
            onChange={(e) => onChange({ ...node, times: Math.max(1, Math.min(60, Number(e.target.value) || 1)) })}
          />
          <span>次</span>
          <DeleteBtn onClick={onDelete} />
        </div>
        <div
          className={`inner drop-inner ${selectedSlot?.containerId === node.id && selectedSlot.slot === 'children' ? 'slot-selected' : ''}`}
          data-drop-id={node.id}
          data-drop-slot="children"
          onClick={(e) => { e.stopPropagation(); onSelectSlot({ containerId: node.id, slot: 'children' }); }}
        >
          {node.children.length === 0 && <span style={{ opacity: .85, fontSize: 12 }}>点这里选中后，再点左边积木即可放入…</span>}
          {node.children.map((child, i) => (
            <BlockNode
              key={child.id}
              node={child}
              selectedSlot={selectedSlot}
              onSelectSlot={onSelectSlot}
              onChange={(updated) => {
                const next = [...node.children];
                next[i] = updated;
                onChange({ ...node, children: next });
              }}
              onDelete={() => onChange({ ...node, children: node.children.filter((_, j) => j !== i) })}
            />
          ))}
        </div>
      </div>
    );
  }
  // if
  return (
    <div className="container-block b-if">
      <div className="block-row" style={{ margin: 0 }}>
        <span>🔀 如果</span>
        <select
          className="cond-select"
          value={node.cond}
          onChange={(e) => onChange({ ...node, cond: e.target.value })}
        >
          {Object.entries(COND_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
        <DeleteBtn onClick={onDelete} />
      </div>
      <div className="branch-label">那么：</div>
      <div
        className={`inner drop-inner ${selectedSlot?.containerId === node.id && selectedSlot.slot === 'then' ? 'slot-selected' : ''}`}
        data-drop-id={node.id} data-drop-slot="then"
        onClick={(e) => { e.stopPropagation(); onSelectSlot({ containerId: node.id, slot: 'then' }); }}
      >
        {node.then.length === 0 && <span style={{ opacity: .85, fontSize: 12 }}>点这里选中，放“是”时执行的积木…</span>}
        {node.then.map((child, i) => (
          <BlockNode
            key={child.id}
            node={child}
            onChange={(updated) => {
              const next = [...node.then]; next[i] = updated;
              onChange({ ...node, then: next });
            }}
            onDelete={() => onChange({ ...node, then: node.then.filter((_, j) => j !== i) })}
          />
        ))}
      </div>
      <div className="branch-label">否则：</div>
      <div
        className={`inner drop-inner ${selectedSlot?.containerId === node.id && selectedSlot.slot === 'else' ? 'slot-selected' : ''}`}
        data-drop-id={node.id} data-drop-slot="else"
        onClick={(e) => { e.stopPropagation(); onSelectSlot({ containerId: node.id, slot: 'else' }); }}
      >
        {node.else.length === 0 && <span style={{ opacity: .85, fontSize: 12 }}>点这里选中，放“否”时执行的积木…</span>}
        {node.else.map((child, i) => (
          <BlockNode
            key={child.id}
            node={child}
            onChange={(updated) => {
              const next = [...node.else]; next[i] = updated;
              onChange({ ...node, else: next });
            }}
            onDelete={() => onChange({ ...node, else: node.else.filter((_, j) => j !== i) })}
          />
        ))}
      </div>
    </div>
  );
}

export default function ProgramEditor({ value, onChange, disabled }) {
  const rootRef = useRef(null);
  // 当前“点击加入”的目标槽位：{ containerId, slot } 或 null（根级）
  const [selectedSlot, setSelectedSlot] = useState(null);


  function insertBlockAtSlot(programNodes, block) {
    if (!selectedSlot) return [...programNodes, block];
    const copy = withIds(programNodes);
    const ok = insertInto(copy, selectedSlot.containerId, selectedSlot.slot, block);
    return ok ? copy : [...programNodes, block];
  }

  useEffect(() => {
    const onQuick = (e) => {
      if (disabled) return;
      const block = newBlock(e.detail.type);
      if (selectedSlot) onChange(insertBlockAtSlot(value, block));
      else onChange([...value, block]);
    };
    window.addEventListener('quick-add-block', onQuick);
    return () => window.removeEventListener('quick-add-block', onQuick);
  }, [value, onChange, disabled, selectedSlot]);

  const onDrop = (e) => {
    e.preventDefault();
    const newType = e.dataTransfer.getData('text/new-block');
    if (!newType || disabled) return;
    const block = newBlock(newType);
    const copy = withIds(value);
    const targetEl = e.target.closest('[data-drop-id]');
    let next;
    if (targetEl) {
      const cid = targetEl.getAttribute('data-drop-id');
      const slot = targetEl.getAttribute('data-drop-slot');
      if (insertInto(copy, cid, slot, block)) next = copy;
      else next = [...copy, block];
    } else {
      next = [...copy, block];
    }
    onChange(next);
  };

  return (
    <>
    <div className="target-hint">
      {selectedSlot ? '🎯 已选中容器：点击左边积木会放进去（点程序区空白处取消）' : '提示：点击循环/条件积木的内部区域，可以把新积木放进去'}
    </div>
    <div
      ref={rootRef}
      className="script-area"
      onClick={(e) => { if (e.target === e.currentTarget) setSelectedSlot(null); }}
      onDragOver={(e) => { e.preventDefault(); e.currentTarget.classList.add('drag-over'); }}
      onDragLeave={(e) => { if (e.target === e.currentTarget) e.currentTarget.classList.remove('drag-over'); }}
      onDrop={(e) => { e.currentTarget.classList.remove('drag-over'); onDrop(e); }}
    >
      {value.length === 0
        ? <div className="script-empty">🧩 把左边的积木拖到这里，再点击内部区域放入循环里…<br />（也可以直接点击积木添加到选中的位置）</div>
        : value.map((node, i) => (
          <BlockNode
            key={node.id}
            node={node}
            selectedSlot={selectedSlot}
            onSelectSlot={setSelectedSlot}
            onChange={(updated) => {
              const next = [...value]; next[i] = updated; onChange(next);
            }}
            onDelete={() => onChange(value.filter((_, j) => j !== i))}
          />
        ))}
    </div>
    </>
  );
}
