"""Teacher-facing class, assignment and learning-difficulty analytics."""
from __future__ import annotations

from collections import defaultdict

from flask import Blueprint, abort, flash, g, redirect, render_template, request, url_for

from .auth import generate_class_code, role_required
from .db import get_db
from .levels import CONCEPT_LABELS, LEVELS, LEVEL_BY_ID, public_level

bp = Blueprint("teacher", __name__, url_prefix="/teacher")

CATEGORY_LABELS = {
    "invalid_program": "积木结构/积木选择",
    "hit_wall": "撞墙或走出地图",
    "collect_empty": "在没有星星的位置收集",
    "infinite_loop": "循环无法结束",
    "missed_star": "遗漏星星",
    "not_at_goal": "未到达能量站",
    "missing_concept": "未使用目标概念",
    "finished": "未完成",
}

CATEGORY_TIPS = {
    "hit_wall": "可安排“先走手指路线”活动，再引入前方有路/有墙条件。",
    "infinite_loop": "用红绿灯/停止线演示循环出口，检查「直到」内部是否能靠近目标。",
    "missed_star": "让学生在地图上先标记星星，再逐步检查路线覆盖情况。",
    "not_at_goal": "提醒孩子程序最后仍需停在蓝色能量站。",
    "invalid_program": "演示如何把积木嵌入循环/条件卡槽，并检查本关可用积木。",
    "collect_empty": "区分“当前格子有星星”和“执行收集动作”。",
}


def owned_class(db, class_id: int):
    classroom = db.execute(
        "SELECT * FROM classes WHERE id = ? AND teacher_id = ?",
        (class_id, g.user["id"]),
    ).fetchone()
    if classroom is None:
        abort(404)
    return classroom


def owned_assignment(db, assignment_id: int):
    row = db.execute(
        """SELECT a.*, c.name AS class_name, c.teacher_id
             FROM assignments a JOIN classes c ON c.id = a.class_id
            WHERE a.id = ? AND c.teacher_id = ?""",
        (assignment_id, g.user["id"]),
    ).fetchone()
    if row is None:
        abort(404)
    return row


@bp.route("/")
@role_required("teacher")
def home():
    db = get_db()
    classes = db.execute(
        """SELECT c.*, COUNT(cm.id) AS student_count
             FROM classes c LEFT JOIN class_members cm ON cm.class_id = c.id
            WHERE c.teacher_id = ?
            GROUP BY c.id ORDER BY c.created_at DESC""",
        (g.user["id"],),
    ).fetchall()
    return render_template("teacher_home.html", classes=classes)


@bp.route("/classes", methods=("POST",))
@role_required("teacher")
def create_class():
    name = request.form.get("name", "").strip() or f"{g.user['name']}的班级"
    db = get_db()
    code = generate_class_code()
    cursor = db.execute(
        "INSERT INTO classes (teacher_id, name, join_code) VALUES (?, ?, ?)",
        (g.user["id"], name, code),
    )
    db.commit()
    return redirect(url_for("teacher.class_detail", class_id=cursor.lastrowid))


@bp.route("/classes/<int:class_id>")
@role_required("teacher")
def class_detail(class_id: int):
    db = get_db()
    classroom = owned_class(db, class_id)
    students = db.execute(
        """SELECT u.* FROM users u
             JOIN class_members cm ON cm.child_id = u.id
            WHERE cm.class_id = ? ORDER BY u.name""",
        (class_id,),
    ).fetchall()
    assignments = db.execute(
        """SELECT a.*,
                  (SELECT COUNT(*) FROM class_members cm WHERE cm.class_id = a.class_id) AS roster_count,
                  (SELECT COUNT(DISTINCT att.child_id)
                     FROM attempts att
                     JOIN class_members cm ON cm.child_id = att.child_id
                    WHERE cm.class_id = a.class_id AND att.level_id = a.level_id
                      AND att.success = 1) AS completed_count
             FROM assignments a
            WHERE a.class_id = ?
            ORDER BY a.created_at DESC""",
        (class_id,),
    ).fetchall()
    # Class concept summary across every level attempted by members.
    attempts = db.execute(
        """SELECT att.* FROM attempts att
             JOIN class_members cm ON cm.child_id = att.child_id
            WHERE cm.class_id = ?
            ORDER BY att.created_at DESC""",
        (class_id,),
    ).fetchall()
    concept_summary = build_concept_summary(attempts, [s["id"] for s in students])
    return render_template(
        "teacher_class.html",
        classroom=classroom,
        students=students,
        assignments=assignments,
        levels=[public_level(level) for level in LEVELS],
        concept_summary=concept_summary,
    )


@bp.route("/classes/<int:class_id>/assignments", methods=("POST",))
@role_required("teacher")
def create_assignment(class_id: int):
    db = get_db()
    classroom = owned_class(db, class_id)
    level_id = int(request.form.get("level_id", 0))
    note = request.form.get("note", "").strip()
    due_date = request.form.get("due_date", "")
    level = LEVEL_BY_ID.get(level_id)
    if level is None:
        abort(400, description="请选择一个关卡。")
    title = request.form.get("title", "").strip() or level["title"]
    try:
        db.execute(
            """INSERT INTO assignments (class_id, level_id, title, due_date, note)
               VALUES (?, ?, ?, ?, ?)""",
            (class_id, level_id, title, due_date, note),
        )
        db.commit()
    except Exception:
        # A class/level unique constraint means the assignment already exists.
        db.rollback()
        flash("这个班级已经布置过该关卡。", "error")
    return redirect(url_for("teacher.class_detail", class_id=class_id))


@bp.route("/assignments/<int:assignment_id>")
@role_required("teacher")
def assignment_detail(assignment_id: int):
    db = get_db()
    assignment = owned_assignment(db, assignment_id)
    level = LEVEL_BY_ID[assignment["level_id"]]
    students = db.execute(
        """SELECT u.* FROM users u
             JOIN class_members cm ON cm.child_id = u.id
            WHERE cm.class_id = ? ORDER BY u.name""",
        (assignment["class_id"],),
    ).fetchall()

    student_rows = []
    failure_buckets = defaultdict(int)
    for student in students:
        rows = db.execute(
            """SELECT * FROM attempts WHERE child_id = ? AND level_id = ?
                ORDER BY created_at DESC""",
            (student["id"], assignment["level_id"]),
        ).fetchall()
        successes = [row for row in rows if row["success"]]
        best = successes[0] if successes else None
        latest = rows[0] if rows else None
        for row in rows[:10]:
            if not row["success"]:
                failure_buckets[row["category"]] += 1
        student_rows.append({
            "student": student,
            "attempts": len(rows),
            "successes": len(successes),
            "best": best,
            "latest": latest,
            "stuck": len(rows) >= 3 and not successes,
        })

    all_attempts = [row for student in students for row in db.execute(
        "SELECT * FROM attempts WHERE child_id = ? AND level_id = ?",
        (student["id"], assignment["level_id"]),
    ).fetchall()]
    concept_summary = build_concept_summary(all_attempts, [s["id"] for s in students])
    blocked_students = [row for row in student_rows if row["stuck"]]
    category_stats = [
        {
            "key": key,
            "label": CATEGORY_LABELS.get(key, key),
            "count": count,
            "tip": CATEGORY_TIPS.get(key, ""),
        }
        for key, count in sorted(failure_buckets.items(), key=lambda item: -item[1])
    ]
    return render_template(
        "teacher_assignment.html",
        assignment=assignment,
        level=level,
        students=student_rows,
        blocked_students=blocked_students,
        category_stats=category_stats,
        concept_summary=concept_summary,
        concept_label=CONCEPT_LABELS[level["concept"]],
    )


def build_concept_summary(attempts, student_ids: list[int]) -> list[dict]:
    """Aggregate attempts to identify concepts where learners are getting stuck.

    Teachers see aggregate signals and student initials/names, not answer code.
    """
    stats = defaultdict(lambda: {
        "attempts": 0, "failures": 0, "students": set(),
        "successful_students": set(), "stuck_students": set(),
        "categories": defaultdict(int),
    })
    attempts_by_student_level = defaultdict(list)

    for attempt in attempts:
        level = LEVEL_BY_ID.get(attempt["level_id"])
        if not level:
            continue
        concept = level["concept"]
        bucket = stats[concept]
        bucket["attempts"] += 1
        bucket["students"].add(attempt["child_id"])
        attempts_by_student_level[(attempt["child_id"], concept)].append(attempt)
        if attempt["success"]:
            bucket["successful_students"].add(attempt["child_id"])
        else:
            bucket["failures"] += 1
            bucket["categories"][attempt["category"]] += 1

    for (child_id, concept), rows in attempts_by_student_level.items():
        failures = sum(1 for row in rows if not row["success"])
        has_success = any(row["success"] for row in rows)
        # Repeated failure before (or without) success is a useful intervention signal.
        if failures >= 2 and not has_success:
            stats[concept]["stuck_students"].add(child_id)

    result = []
    id_to_name = {}
    if student_ids:
        db = get_db()
        for row in db.execute(
            f"SELECT id, name FROM users WHERE id IN ({','.join('?' for _ in student_ids)})",
            student_ids,
        ).fetchall():
            id_to_name[row["id"]] = row["name"]

    for concept, data in stats.items():
        attempts_count = data["attempts"]
        failure_rate = round(data["failures"] / attempts_count * 100) if attempts_count else 0
        stuck_names = sorted(id_to_name.get(sid, f"学生{sid}")
                             for sid in data["stuck_students"])
        result.append({
            "concept": concept,
            "label": CONCEPT_LABELS.get(concept, concept),
            "attempts": attempts_count,
            "failures": data["failures"],
            "failure_rate": failure_rate,
            "students_count": len(data["students"]),
            "successful_count": len(data["successful_students"]),
            "stuck_names": stuck_names,
            "stuck_count": len(stuck_names),
            "top_categories": sorted(data["categories"].items(), key=lambda item: -item[1])[:3],
            "tip": level_tip_for_concept(concept),
            "priority": (len(stuck_names) * 10 + failure_rate),
        })
    result.sort(key=lambda item: (-item["priority"], item["concept"]))
    return result


def level_tip_for_concept(concept: str) -> str:
    tips = {
        "sequence": "用实物卡片演示从上到下执行。",
        "turns": "结合东南西北转盘，让孩子先预测方向再运行。",
        "repeat": "让孩子圈出重复动作，再把动作包进循环积木。",
        "nested_loop": "先找内层重复，再找外层重复；鼓励用语言描述“每轮做什么”。",
        "condition": "用“如果……就……”造句，把传感器结果和动作对应起来。",
        "while": "重点讨论停止条件，避免循环无法结束。",
        "project": "先画计划再搭建，允许不同路线和方案。",
        "integrated": "让学生分步讲解：循环、条件、收集和到达目标分别在哪里。",
    }
    return tips.get(concept, "建议让学生先口头描述思路，再修改程序。")
