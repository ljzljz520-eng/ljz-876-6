(() => {
  const layout = document.querySelector(".play-layout");
  const level = JSON.parse(layout.dataset.level);
  const levelId = Number(layout.dataset.levelId);
  const palette = document.getElementById("palette");
  const programEl = document.getElementById("program");
  const blockCountEl = document.getElementById("block-count");
  const feedbackEl = document.getElementById("feedback");
  const gridEl = document.getElementById("grid");
  const statsEl = document.getElementById("run-stats");
  const variantLabel = document.getElementById("variant-label");

  const BLOCK_INFO = {
    move: { label: "⬆ 前进一步", className: "move" },
    turn_left: { label: "↪ 左转", className: "turn_left" },
    turn_right: { label: "↩ 右转", className: "turn_right" },
    collect: { label: "⭐ 收集星星", className: "collect" },
    repeat: { label: "重复", className: "repeat", times: 4, suffix: "次" },
    until_goal: { label: "直到到达能量站", className: "until_goal" },
    if_star: { label: "如果脚下有星星", className: "if_star" },
    if_path: { label: "如果前方有路", className: "if_path" },
    if_wall: { label: "如果前方有墙", className: "if_wall" },
  };
  const CONTAINER_TYPES = new Set(["repeat", "until_goal", "if_star", "if_path", "if_wall"]);

  let variantKey = "";
  let currentScenario = null;
  let runToken = 0;

  function makeBlock(type) {
    const block = { id: `${Date.now()}-${Math.random().toString(16).slice(2)}`, type };
    if (type === "repeat") block.times = 4;
    if (CONTAINER_TYPES.has(type)) block.children = [];
    return block;
  }

  function countBlocks(blocks) {
    return blocks.reduce((sum, block) => {
      return sum + 1 + (block.children ? countBlocks(block.children) : 0);
    }, 0);
  }

  function getProgram() {
    return [...programEl.querySelectorAll(":scope > .program-list > .placed-block")]
      .map(serializeBlock)
      .filter(Boolean);
  }

  function serializeBlock(el) {
    const type = el.dataset.type;
    const block = { type };
    if (type === "repeat") block.times = Number(el.querySelector(":scope > .block-head .times-input")?.value || 4);
    if (CONTAINER_TYPES.has(type)) {
      block.children = [...el.querySelectorAll(":scope > .child-slot > .program-list > .placed-block")]
        .map(serializeBlock).filter(Boolean);
    }
    return block;
  }

  function findBlock(blocks, id) {
    for (const block of blocks) {
      if (block.id === id) return block;
      if (block.children) {
        const found = findBlock(block.children, id);
        if (found) return found;
      }
    }
    return null;
  }

  function removeBlockById(blocks, id) {
    const index = blocks.findIndex(block => block.id === id);
    if (index >= 0) {
      blocks.splice(index, 1);
      return true;
    }
    return blocks.some(block => block.children && removeBlockById(block.children, id));
  }

  function renderPalette() {
    palette.innerHTML = "";
    level.allowed_blocks.forEach(type => {
      const info = BLOCK_INFO[type];
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = `block ${info.className}`;
      btn.draggable = true;
      btn.dataset.newType = type;
      btn.textContent = info.label + (type === "repeat" ? " 4 次" : "");
      btn.addEventListener("dragstart", event => {
        event.dataTransfer.setData("application/x-new-block", type);
        event.dataTransfer.effectAllowed = "copy";
      });
      btn.addEventListener("click", () => appendAtEnd(makeBlock(type)));
      palette.appendChild(btn);
    });
  }

  function appendAtEnd(block) {
    const list = programEl.querySelector(":scope > .program-list");
    const blocks = getProgram();
    blocks.push(block);
    renderProgram(blocks);
  }

  function createBlockElement(block) {
    const info = BLOCK_INFO[block.type];
    const wrap = document.createElement("div");
    wrap.className = `placed-block ${info.className}`;
    wrap.draggable = true;
    wrap.dataset.id = block.id;
    wrap.dataset.type = block.type;

    const head = document.createElement("div");
    head.className = "block-head";
    if (block.type === "repeat") {
      head.append(document.createTextNode("重复 "));
      const input = document.createElement("input");
      input.type = "number";
      input.min = "1";
      input.max = "20";
      input.value = block.times || 4;
      input.className = "times-input";
      input.setAttribute("aria-label", "重复次数");
      input.addEventListener("click", event => event.stopPropagation());
      input.addEventListener("input", updateCount);
      head.append(input, document.createTextNode(" 次"));
    } else {
      head.textContent = info.label;
    }
    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "remove";
    remove.textContent = "×";
    remove.title = "删除积木";
    remove.addEventListener("click", () => {
      const blocks = getProgram();
      removeBlockById(blocks, block.id);
      renderProgram(blocks);
    });
    head.appendChild(remove);
    wrap.appendChild(head);

    wrap.addEventListener("dragstart", event => {
      event.dataTransfer.setData("application/x-existing-block", block.id);
      event.dataTransfer.effectAllowed = "move";
    });

    if (CONTAINER_TYPES.has(block.type)) {
      const slot = document.createElement("div");
      slot.className = "child-slot";
      slot.dataset.zone = "child";
      slot.dataset.ownerId = block.id;
      const list = document.createElement("div");
      list.className = "program-list";
      slot.appendChild(list);
      attachDropZone(slot);
      wrap.appendChild(slot);
      block.children.forEach(child => list.appendChild(createBlockElement(child)));
      renderEmptyHint(list);
    }
    return wrap;
  }

  function renderEmptyHint(list) {
    list.querySelectorAll(":scope > .empty-slot").forEach(el => el.remove());
    if (!list.children.length) {
      const hint = document.createElement("div");
      hint.className = "empty-slot";
      hint.textContent = "把积木放到这里";
      list.appendChild(hint);
    }
  }

  function renderProgram(blocks) {
    programEl.innerHTML = "";
    const list = document.createElement("div");
    list.className = "program-list";
    blocks.forEach(block => list.appendChild(createBlockElement(block)));
    programEl.appendChild(list);
    attachDropZone(programEl);
    renderEmptyHint(list);
    updateCount();
  }

  function updateCount() {
    const count = countBlocks(getProgram());
    blockCountEl.textContent = count;
    blockCountEl.style.color = count > level.max_blocks ? "#d64545" : "";
  }

  function attachDropZone(zone) {
    zone.addEventListener("dragover", event => {
      event.preventDefault();
      zone.classList.add("drag-over");
    });
    zone.addEventListener("dragleave", () => zone.classList.remove("drag-over"));
    zone.addEventListener("drop", event => {
      event.preventDefault();
      event.stopPropagation();
      zone.classList.remove("drag-over");
      const newType = event.dataTransfer.getData("application/x-new-block");
      const existingId = event.dataTransfer.getData("application/x-existing-block");
      const blocks = getProgram();
      let moving = null;
      if (existingId) {
        const flat = getFlat(blocks);
        moving = flat.find(block => block.id === existingId);
      }
      // Prevent dropping a block into itself or its own descendants.
      if (moving && zone.closest(`.placed-block[data-id="${moving.id}"]`)) return;

      if (existingId) removeBlockById(blocks, existingId);
      const block = newType ? makeBlock(newType) : moving;
      if (!block) return;

      if (zone.dataset.zone === "child") {
        const owner = findBlock(blocks, zone.dataset.ownerId);
        if (owner) owner.children.push(block);
      } else {
        blocks.push(block);
      }
      renderProgram(blocks);
    });
  }

  function getFlat(blocks) {
    return blocks.flatMap(block => [block, ...(block.children ? getFlat(block.children) : [])]);
  }

  function chooseVariant() {
    if (level.mystery_stars) {
      const keys = ["sparkle_a", "sparkle_b", "sparkle_c", "sparkle_d"];
      const storedKey = sessionStorage.getItem(`variant-${levelId}`);
      variantKey = storedKey && keys.includes(storedKey)
        ? storedKey
        : keys[Math.floor(Math.random() * keys.length)];
      sessionStorage.setItem(`variant-${levelId}`, variantKey);
      currentScenario = structuredClone(level.world);
      variantLabel.textContent = "星星藏起来了：请使用条件判断";
      return;
    }
    variantKey = "";
    currentScenario = level.world;
  }

  function renderMap(state) {
    gridEl.innerHTML = "";
    const scenario = currentScenario;
    gridEl.style.gridTemplateColumns = `repeat(${scenario.width}, 1fr)`;
    const stars = new Set((state?.stars ?? scenario.stars).map(star => star.join(",")));
    for (let y = 0; y < scenario.height; y++) {
      for (let x = 0; x < scenario.width; x++) {
        const cell = document.createElement("div");
        cell.className = "cell";
        cell.dataset.x = x;
        cell.dataset.y = y;
        const wall = scenario.walls.some(w => w[0] === x && w[1] === y);
        const isGoal = scenario.goal.x === x && scenario.goal.y === y;
        const hasStar = stars.has(`${x},${y}`);
        const hiddenStar = level.mystery_stars
          && !wall
          && !(isGoal)
          && !state?.collectedPositions?.has(`${x},${y}`);
        const collectedStar = state?.collectedPositions?.has(`${x},${y}`);
        if (wall) cell.classList.add("wall");
        if (isGoal) {
          cell.classList.add("goal");
          cell.innerHTML = "<span>🏁</span>";
        }
        if (hasStar) {
          cell.classList.add("star-cell");
          const star = document.createElement("span");
          star.textContent = "⭐";
          cell.appendChild(star);
        }
        if (hiddenStar) {
          cell.classList.add("mystery-cell");
          const question = document.createElement("span");
          question.className = "mystery-mark";
          question.textContent = "❓";
          cell.appendChild(question);
        }
        if (collectedStar) {
          const star = document.createElement("span");
          star.textContent = "✨";
          cell.appendChild(star);
        }
        const robotHere = state && state.x === x && state.y === y;
        if (robotHere) {
          cell.classList.add("robot");
          const robot = document.createElement("span");
          robot.className = "robot-token";
          robot.textContent = "🤖";
          robot.style.transform = `rotate(${rotation(state.direction)}deg)`;
          cell.appendChild(robot);
        }
        gridEl.appendChild(cell);
      }
    }
  }

  function rotation(direction) {
    return { east: 0, south: 90, west: 180, north: 270 }[direction] || 0;
  }

  function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async function animate(events) {
    const token = runToken;
    const scenario = currentScenario;
    let state = {
      ...scenario.start,
      stars: scenario.stars.map(star => [...star]),
      collectedPositions: new Set(),
    };
    renderMap(state);
    await sleep(220);
    for (const event of events) {
      if (token !== runToken) return;
      Object.assign(state, { x: event.x, y: event.y, direction: event.direction });
      if (event.type === "collect") {
        state.stars = state.stars.filter(star => !(star[0] === event.x && star[1] === event.y));
        state.collectedPositions.add(`${event.x},${event.y}`);
      }
      if (event.type === "condition" && event.result) {
        const cell = gridEl.querySelector(`[data-x="${event.x}"][data-y="${event.y}"]`);
        cell?.classList.add("path-on");
      }
      renderMap(state);
      if (["move", "turn", "collect", "blocked"].includes(event.type)) {
        statsEl.textContent = `执行中：第 ${event.step} 步`;
        await sleep(event.type === "blocked" ? 520 : 300);
      }
    }
    return state;
  }

  function showFeedback(result) {
    feedbackEl.classList.add("show");
    feedbackEl.classList.toggle("success", result.success);
    feedbackEl.classList.toggle("fail", !result.success);
    const starsHtml = result.stars ? `<div class="big-stars">${"★".repeat(result.stars)}${"☆".repeat(3 - result.stars)}</div>` : "";
    const detail = result.success
      ? `用了 ${result.steps} 步、${result.block_count} 块积木。`
      : result.failure_message;
    feedbackEl.innerHTML = `${starsHtml}<h2>${result.success ? "太棒了！" : "再试一次"}</h2><p>${result.feedback}</p><p>${detail}</p>`;
    feedbackEl.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }

  document.getElementById("reset-btn").addEventListener("click", () => {
    renderProgram([]);
    feedbackEl.classList.remove("show");
    runToken++;
    chooseVariant();
    renderMap(currentScenario.start);
    statsEl.textContent = "准备运行";
  });

  document.getElementById("run-btn").addEventListener("click", async () => {
    const blocks = getProgram();
    feedbackEl.classList.remove("show");
    if (!blocks.length) {
      feedbackEl.className = "feedback show fail";
      feedbackEl.innerHTML = "<p>先把积木拖进程序区吧！</p>";
      return;
    }
    const runBtn = document.getElementById("run-btn");
    runBtn.disabled = true;
    runBtn.textContent = "运行中...";
    try {
      const fetchOptions = {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ blocks, variant_key: variantKey }),
      };
      const response = await fetch(`/child/api/levels/${levelId}/run`, fetchOptions);
      if (response.redirected) {
        window.location.href = response.url;
        return;
      }
      if (!response.ok) throw new Error("网络或服务器错误");
      const result = await response.json();
      await animate(result.events || []);
      showFeedback(result);
      statsEl.textContent = result.success
        ? `成功！${result.steps} 步 / ${result.block_count} 块 / ${result.stars} 星`
        : `未通过：${result.failure_message}`;
      if (result.success) sessionStorage.removeItem(`variant-${levelId}`);
    } catch (error) {
      feedbackEl.className = "feedback show fail";
      feedbackEl.textContent = "运行失败，请稍后再试。";
    } finally {
      runBtn.disabled = false;
      runBtn.textContent = "▶ 运行程序";
    }
  });

  renderPalette();
  renderProgram([]);
  chooseVariant();
  renderMap(currentScenario.start);
})();
