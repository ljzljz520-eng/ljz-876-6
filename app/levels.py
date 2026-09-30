"""Built-in level catalogue and deterministic robot simulator.

Levels are puzzle/world definitions, not "standard answer scripts".  A child's
block program is evaluated by simulating whether it completes the goal; many
different programs can pass.  Parent-facing code never needs program details.
"""
from __future__ import annotations

from copy import deepcopy
from typing import Any

DIRECTIONS = ("north", "east", "south", "west")
DELTA = {
    "north": (0, -1),
    "east": (1, 0),
    "south": (0, 1),
    "west": (-1, 0),
}

CONCEPT_LABELS = {
    "sequence": "顺序指令",
    "turns": "方向与转弯",
    "repeat": "循环",
    "nested_loop": "嵌套循环",
    "condition": "条件判断",
    "while": "直到循环",
    "project": "小项目",
    "integrated": "综合应用",
}

_SPIRAL_WALLS = [(0, 1)]


def _spiral_world() -> dict[str, Any]:
    return {
        "width": 5,
        "height": 5,
        "start": {"x": 0, "y": 0, "direction": "east"},
        "goal": {"x": 2, "y": 2},
        "stars": [],
        "walls": [[x, y] for x, y in _SPIRAL_WALLS],
    }


def _world(width: int, height: int, start: tuple[int, int, str], goal: tuple[int, int],
           stars: list[tuple[int, int]] | None = None,
           walls: list[tuple[int, int]] | None = None) -> dict[str, Any]:
    return {
        "width": width,
        "height": height,
        "start": {"x": start[0], "y": start[1], "direction": start[2]},
        "goal": {"x": goal[0], "y": goal[1]},
        "stars": [[x, y] for x, y in (stars or [])],
        "walls": [[x, y] for x, y in (walls or [])],
    }


LEVELS: list[dict[str, Any]] = [
    {
        "id": 1,
        "slug": "first-steps",
        "title": "1. 机器人的第一步",
        "concept": "sequence",
        "concepts": ["sequence"],
        "summary": "把前进积木按顺序接起来，帮小机器人到达能量站。",
        "story": "小机器人刚醒来，它面前有一条直直的小路。拖入三个「前进一步」，再按下运行吧！",
        "allowed_blocks": ["move"],
        "max_blocks": 8,
        "target_blocks": 3,
        "par_steps": 3,
        "required_concepts": [],
        "project": False,
        "world": _world(5, 3, (0, 1, "east"), (3, 1)),
        "hints": ["数一数小机器人和能量站之间有几个格子。", "每个「前进一步」积木只会走一格。"],
        "teacher_tip": "确认学生理解指令从上到下依次执行。",
    },
    {
        "id": 2,
        "slug": "turn-at-orchard",
        "title": "2. 果园转弯",
        "concept": "turns",
        "concepts": ["turns", "sequence"],
        "summary": "小路转弯了，练习左转、右转和前进。",
        "story": "果园东边的路被花丛围住，需要先向东走，再转向南，最后到达能量站。",
        "allowed_blocks": ["move", "turn_left", "turn_right"],
        "max_blocks": 12,
        "target_blocks": 4,
        "par_steps": 4,
        "required_concepts": [],
        "project": False,
        "world": _world(5, 4, (0, 0, "east"), (1, 2)),
        "hints": ["面朝东方时，右转会朝向南方。", "先转弯，再继续前进。"],
        "teacher_tip": "用桌面方向卡帮助学生区分左转和右转。",
    },
    {
        "id": 3,
        "slug": "rainbow-bridge",
        "title": "3. 彩虹桥循环",
        "concept": "repeat",
        "concepts": ["repeat", "sequence"],
        "summary": "重复多次的动作可以放进「重复 N 次」积木。",
        "story": "彩虹桥很长，一格一格拖积木太累啦。试试把「前进一步」放进重复积木里！",
        "allowed_blocks": ["move", "turn_left", "turn_right", "repeat"],
        "max_blocks": 12,
        "target_blocks": 2,
        "par_steps": 6,
        "required_concepts": ["repeat"],
        "project": False,
        "world": _world(8, 3, (0, 1, "east"), (6, 1)),
        "hints": ["一共需要前进 6 次。", "把一个前进积木包进「重复 6 次」，比拖 6 个前进更简洁。"],
        "teacher_tip": "比较长程序和循环程序的积木数量，引出“重复模式”。",
    },
    {
        "id": 4,
        "slug": "star-trail",
        "title": "4. 星光小路",
        "concept": "repeat",
        "concepts": ["repeat", "sequence"],
        "summary": "在循环里收集每一颗能量星。",
        "story": "每走一格前都有一颗能量星。让循环帮你反复“收集、前进”。",
        "allowed_blocks": ["move", "collect", "turn_left", "turn_right", "repeat"],
        "max_blocks": 14,
        "target_blocks": 3,
        "par_steps": 10,
        "required_concepts": ["repeat"],
        "project": False,
        "world": _world(7, 3, (0, 1, "east"), (5, 1),
                       stars=[(0, 1), (1, 1), (2, 1), (3, 1), (4, 1)]),
        "hints": ["起始格子上也有一颗星。", "循环体可以先「收集星星」，再「前进一步」。"],
        "teacher_tip": "强调循环体内部的顺序也很重要。",
    },
    {
        "id": 5,
        "slug": "zigzag-meadow",
        "title": "5. 蜿蜒草甸",
        "concept": "nested_loop",
        "concepts": ["nested_loop", "repeat", "turns"],
        "summary": "把一排重复动作放进另一层重复模式中，练习嵌套循环。",
        "story": "草甸的小路一行一行来回延伸。每一行都有“连续前进”的重复模式，可以用内层循环表示。",
        "allowed_blocks": ["move", "collect", "turn_left", "turn_right", "repeat"],
        "max_blocks": 30,
        "target_blocks": 10,
        "par_steps": 35,
        "required_concepts": ["repeat"],
        "project": False,
        "world": _world(
            5, 5, (0, 0, "east"), (0, 0),
            stars=[
                (0, 0), (1, 0), (2, 0), (3, 0), (4, 0),
                (4, 1), (4, 2), (4, 3), (4, 4),
                (3, 4), (2, 4), (1, 4), (0, 4),
                (0, 3), (0, 2), (0, 1),
            ],
        ),
        "hints": [
            "小机器人要沿着方形花园巡逻一周，最后回到出发的能量舱。",
            "每一边都重复“收集星星、前进一步”。",
            "一整套“走一边、转弯”也会重复 4 次，可以使用外层循环。",
        ],
        "teacher_tip": "让学生先识别内层重复，再识别包裹四条边的外层重复。",
    },
    {
        "id": 6,
        "slug": "mysterious-corridor",
        "title": "6. 神秘走廊",
        "concept": "condition",
        "concepts": ["condition", "while", "repeat"],
        "summary": "星星随机出现，学会用条件判断决定是否收集。",
        "story": "走廊里的能量星位置每次都可能不同。用「如果脚下有星星」让机器人自己判断要不要收集！",
        "allowed_blocks": ["move", "collect", "if_star", "repeat", "until_goal"],
        "max_blocks": 16,
        "target_blocks": 5,
        "par_steps": 8,
        "required_concepts": ["condition", "while"],
        "project": False,
        "mystery_stars": True,
        "world": _world(6, 1, (0, 0, "east"), (5, 0), stars=[(1, 0), (3, 0), (4, 0)]),
        "variants": {
            "sparkle_a": {"stars": [[1, 0], [3, 0], [4, 0]]},
            "sparkle_b": {"stars": [[2, 0], [4, 0]]},
            "sparkle_c": {"stars": [[1, 0], [2, 0], [3, 0]]},
            "sparkle_d": {"stars": [[2, 0], [3, 0], [4, 0]]},
        },
        "hints": [
            "「直到到达能量站」会在到达目标时自动停止。",
            "每次移动前，先用条件积木看看前面有没有星星。",
            "不要把收集动作写死；星星的位置可能变化。",
        ],
        "teacher_tip": "让学生多次重试并观察布局变化，理解条件处理不确定情况。",
    },
    {
        "id": 7,
        "slug": "spiral-maze",
        "title": "7. 旋转迷宫",
        "concept": "condition",
        "concepts": ["condition", "while", "turns"],
        "summary": "前方可能是路也可能是墙，用条件判断选择动作。",
        "story": "迷宫像螺旋一样弯弯绕绕。小机器人需要不断检查：有路就前进，有墙就转弯。",
        "allowed_blocks": ["move", "turn_left", "turn_right", "if_path", "if_wall", "until_goal"],
        "max_blocks": 18,
        "target_blocks": 5,
        "par_steps": 34,
        "required_concepts": ["condition", "while"],
        "project": False,
        "world": _spiral_world(),
        "hints": [
            "「如果前方有路」里面放前进。",
            "「如果前方有墙」里面放转弯。",
            "保持程序短小，让循环不断重新检查前方。",
        ],
        "teacher_tip": "重点不是背路线，而是让学生解释机器人每一步如何根据传感器做决定。",
    },
    {
        "id": 8,
        "slug": "star-garden-project",
        "title": "8. 小项目：星光花园",
        "concept": "project",
        "concepts": ["project", "repeat", "sequence", "turns"],
        "summary": "开放式小项目：自己规划路线，至少使用一次循环收集星光。",
        "story": "欢迎来到星光花园！请设计一条路线收集全部能量星，并到达蓝色能量站。老师和家长只看你的成果，不替你写答案。",
        "allowed_blocks": ["move", "collect", "turn_left", "turn_right", "repeat",
                           "until_goal", "if_star", "if_path", "if_wall"],
        "max_blocks": 40,
        "target_blocks": 6,
        "par_steps": 9,
        "required_concepts": ["repeat"],
        "project": True,
        "world": _world(5, 2, (0, 0, "east"), (4, 0),
                       stars=[(0, 0), (1, 0), (2, 0), (3, 0), (4, 0)]),
        "hints": ["先在纸上画路线，再找重复动作。", "收集完星星后，记得去能量站。"],
        "teacher_tip": "关注路线规划表达，允许多种正确程序。",
    },
    {
        "id": 9,
        "slug": "capstone-rescue",
        "title": "9. 综合挑战：螺旋救援",
        "concept": "integrated",
        "concepts": ["integrated", "condition", "while", "repeat"],
        "summary": "综合使用循环和条件，穿越迷宫并救援能量星。",
        "story": "最终挑战！螺旋迷宫里散落着能量星。让机器人一边判断道路，一边自动收集，直到中心能量站。",
        "allowed_blocks": ["move", "collect", "turn_left", "turn_right", "if_star",
                           "if_path", "if_wall", "until_goal", "repeat"],
        "max_blocks": 25,
        "target_blocks": 7,
        "par_steps": 24,
        "required_concepts": ["condition", "while"],
        "project": True,
        "world": _world(
            5, 5, (0, 0, "east"), (2, 2),
            stars=[(2, 0), (4, 2), (2, 4), (0, 0)],
            walls=_spiral_world()["walls"],
        ),
        "hints": [
            "可以在循环开头检查当前格子有没有星星。",
            "有路就前进，有墙就换方向。",
            "到达中心能量站时程序应自动结束。",
        ],
        "teacher_tip": "这是总结性评价；请学生演示并讲解每个条件的作用。",
    },
]

LEVEL_BY_ID = {level["id"]: level for level in LEVELS}
ALLOWED_BLOCK_TYPES = {
    "move", "turn_left", "turn_right", "collect",
    "repeat", "until_goal", "if_star", "if_path", "if_wall",
}
MAX_RUNTIME_STEPS = 300
MAX_BLOCKS = 80


def public_level(level: dict[str, Any]) -> dict[str, Any]:
    """Safe level metadata for maps/lists (does not expose any answer script)."""
    return {
        "id": level["id"],
        "slug": level["slug"],
        "title": level["title"],
        "concept": level["concept"],
        "concept_label": CONCEPT_LABELS.get(level["concept"], level["concept"]),
        "summary": level["summary"],
        "project": level["project"],
    }


def get_level(level_id: int) -> dict[str, Any] | None:
    level = LEVEL_BY_ID.get(level_id)
    return deepcopy(level) if level else None


def scenario_for_variant(level: dict[str, Any], variant_key: str | None) -> dict[str, Any]:
    scenario = deepcopy(level["world"])
    variants = level.get("variants", {})
    if variant_key and variant_key in variants:
        for key, value in variants[variant_key].items():
            scenario[key] = value
    return scenario


def validate_program(blocks: Any, level: dict[str, Any]) -> str | None:
    if not isinstance(blocks, list):
        return "程序必须是积木列表。"
    allowed = set(level["allowed_blocks"])

    def walk(items: Any, depth: int = 0) -> str | None:
        if not isinstance(items, list):
            return "积木结构不正确。"
        if depth > 5:
            return "积木嵌套层数太深啦。"
        for block in items:
            if not isinstance(block, dict):
                return "有一块积木格式不正确。"
            block_type = block.get("type")
            if block_type not in ALLOWED_BLOCK_TYPES:
                return "发现未知积木。"
            if block_type not in allowed:
                return f"本关不能使用「{block_type}」积木。"
            if block_type == "repeat":
                times = block.get("times")
                if not isinstance(times, int) or times < 1 or times > 20:
                    return "重复次数需要在 1 到 20 之间。"
                error = walk(block.get("children"), depth + 1)
                if error:
                    return error
            elif block_type in {"until_goal", "if_star", "if_path", "if_wall"}:
                error = walk(block.get("children"), depth + 1)
                if error:
                    return error
        return None

    error = walk(blocks)
    if error:
        return error

    def count(items: list[dict[str, Any]]) -> int:
        total = 0
        for block in items:
            total += 1
            if "children" in block:
                total += count(block.get("children") or [])
        return total

    total = count(blocks)
    if total == 0:
        return "先拖入一些积木吧。"
    if total > min(level["max_blocks"], MAX_BLOCKS):
        return f"本关最多使用 {level['max_blocks']} 块积木。"
    return None


def _ahead(state: dict[str, Any], scenario: dict[str, Any]) -> tuple[int, int] | None:
    dx, dy = DELTA[state["direction"]]
    x, y = state["x"] + dx, state["y"] + dy
    if not (0 <= x < scenario["width"] and 0 <= y < scenario["height"]):
        return None
    if [x, y] in scenario.get("walls", []):
        return None
    return x, y


def _has_star_at(x: int, y: int, remaining: set[tuple[int, int]]) -> bool:
    return (x, y) in remaining


def simulate(blocks: list[dict[str, Any]], scenario: dict[str, Any]) -> dict[str, Any]:
    start = scenario["start"]
    all_stars = {tuple(star) for star in scenario.get("stars", [])}
    state = {
        "x": start["x"],
        "y": start["y"],
        "direction": start["direction"],
        "remaining_stars": set(all_stars),
        "collected": 0,
        "steps": 0,
        "events": [{
            "type": "start",
            "x": start["x"],
            "y": start["y"],
            "direction": start["direction"],
        }],
        "concepts_used": set(),
        "condition_checks": 0,
    }

    def log(event_type: str, **extra: Any) -> None:
        event = {"type": event_type, "x": state["x"], "y": state["y"],
                 "direction": state["direction"], "step": state["steps"]}
        event.update(extra)
        state["events"].append(event)

    def execute(block: dict[str, Any]) -> str | None:
        block_type = block["type"]
        children = block.get("children") or []

        if block_type == "move":
            state["steps"] += 1
            target = _ahead(state, scenario)
            if target is None:
                log("blocked")
                return "哎呀，小机器人撞到墙或走出地图了。"
            state["x"], state["y"] = target
            log("move")
        elif block_type == "turn_left":
            state["steps"] += 1
            index = (DIRECTIONS.index(state["direction"]) - 1) % 4
            state["direction"] = DIRECTIONS[index]
            log("turn")
        elif block_type == "turn_right":
            state["steps"] += 1
            index = (DIRECTIONS.index(state["direction"]) + 1) % 4
            state["direction"] = DIRECTIONS[index]
            log("turn")
        elif block_type == "collect":
            state["steps"] += 1
            pos = (state["x"], state["y"])
            if pos not in state["remaining_stars"]:
                log("collect_empty")
                return "这里没有能量星，先观察星星在哪里。"
            state["remaining_stars"].remove(pos)
            state["collected"] += 1
            log("collect")
        elif block_type == "repeat":
            state["concepts_used"].add("repeat")
            if any(isinstance(child, dict) and child.get("type") == "repeat" for child in children):
                state["concepts_used"].add("nested_loop")
            for _ in range(block["times"]):
                for child in children:
                    error = execute(child)
                    if error:
                        return error
                    if state["steps"] > MAX_RUNTIME_STEPS:
                        return "程序运行太久了，检查循环是否能结束。"
        elif block_type == "until_goal":
            state["concepts_used"].add("while")
            guard = 0
            while (state["x"], state["y"]) != (scenario["goal"]["x"], scenario["goal"]["y"]):
                guard += 1
                if guard > MAX_RUNTIME_STEPS:
                    return "「直到」循环一直停不下来，检查什么时候才能到能量站。"
                for child in children:
                    error = execute(child)
                    if error:
                        return error
                    if (state["x"], state["y"]) == (scenario["goal"]["x"], scenario["goal"]["y"]):
                        break
        elif block_type in {"if_star", "if_path", "if_wall"}:
            state["concepts_used"].add("condition")
            state["condition_checks"] += 1
            ahead = _ahead(state, scenario)
            condition = False
            if block_type == "if_star":
                condition = _has_star_at(state["x"], state["y"], state["remaining_stars"])
            elif block_type == "if_path":
                condition = ahead is not None
            else:  # if_wall
                condition = ahead is None
            log("condition", result=condition, sensor=block_type)
            if condition:
                for child in children:
                    error = execute(child)
                    if error:
                        return error
        else:
            return f"不能执行积木：{block_type}"

        if state["steps"] > MAX_RUNTIME_STEPS:
            return "程序运行太久了，检查循环是否能结束。"
        return None

    failure = None
    for block in blocks:
        failure = execute(block)
        if failure:
            break

    goal = scenario["goal"]
    at_goal = (state["x"], state["y"]) == (goal["x"], goal["y"])
    all_collected = not state["remaining_stars"]
    success = failure is None and at_goal and all_collected

    if not failure and not at_goal:
        failure = "程序结束了，但小机器人还没有到达能量站。"
        log("not_at_goal")
    elif not failure and not all_collected:
        failure = f"还有 {len(state['remaining_stars'])} 颗能量星没有收集。"
        log("stars_left", count=len(state["remaining_stars"]))

    if success:
        log("goal")

    return {
        "success": success,
        "failure_message": failure,
        "events": state["events"],
        "steps": state["steps"],
        "collected": state["collected"],
        "total_stars": len(all_stars),
        "final": {"x": state["x"], "y": state["y"], "direction": state["direction"]},
        "concepts_used": sorted(state["concepts_used"]),
        "condition_checks": state["condition_checks"],
    }


def evaluate_attempt(blocks: list[dict[str, Any]], level: dict[str, Any],
                     variant_key: str | None = None) -> dict[str, Any]:
    error = validate_program(blocks, level)
    if error:
        return {
            "success": False,
            "failure_message": error,
            "failure_category": "invalid_program",
            "category": "invalid_program",
            "stars": 0,
            "steps": 0,
            "block_count": 0,
            "events": [],
            "concepts_used": [],
            "feedback": "积木还没有准备好，再检查一下吧。",
        }

    scenario = scenario_for_variant(level, variant_key)
    result = simulate(blocks, scenario)

    def count(items: list[dict[str, Any]]) -> int:
        return sum(1 + (count(item.get("children") or []) if item.get("children") else 0)
                   for item in items)

    block_count = count(blocks)
    stars = 0
    if result["success"]:
        stars = 1
        if result["steps"] <= level["par_steps"]:
            stars += 1
        compact = block_count <= level["target_blocks"]
        required = set(level.get("required_concepts", []))
        used = set(result["concepts_used"])
        if compact and required.issubset(used):
            stars += 1

    missing = set(level.get("required_concepts", [])) - set(result["concepts_used"])
    category = "finished"
    message = result["failure_message"] or ""
    if result["success"]:
        category = "success"
    elif "撞到墙" in message or "走出地图" in message:
        category = "hit_wall"
    elif "没有能量星" in message:
        category = "collect_empty"
    elif "运行太久" in message or "停不下来" in message:
        category = "infinite_loop"
    elif "能量星" in message:
        category = "missed_star"
    elif "能量站" in message:
        category = "not_at_goal"
    elif missing:
        category = "missing_concept"
    if missing and result["success"]:
        category = "success"

    if stars == 3:
        feedback = "三星通关！你的程序又短又聪明，逻辑非常清晰。"
    elif stars == 2:
        feedback = "两星达成，任务完成得很棒！试试用更少的积木冲三星。"
    elif stars == 1:
        feedback = "通关啦！敢于尝试就是胜利，再看看有没有重复动作可以简化。"
    elif category == "hit_wall":
        feedback = "没关系，机器人碰到墙了。调整方向或加一个条件判断，再试一次！"
    elif category == "missed_star":
        feedback = "差一点点！检查路线上有没有漏掉的能量星。"
    elif category == "infinite_loop":
        feedback = "循环需要一个停止条件。想想机器人什么时候应该停下来。"
    elif category == "missing_concept":
        feedback = "任务完成了，但本关希望你练习新的概念，按提示再优化吧。"
    else:
        feedback = "别灰心，好程序都是改出来的。根据提示再试一次吧！"

    result.update({
        "stars": stars,
        "block_count": block_count,
        "failure_category": category,
        "category": category,
        "missing_concepts": sorted(missing),
        "feedback": feedback,
    })
    return result
