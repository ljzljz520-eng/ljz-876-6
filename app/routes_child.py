"""Child-facing gameplay routes."""
from __future__ import annotations

import json

from flask import Blueprint, abort, g, jsonify, redirect, render_template, request, url_for

from .auth import role_required
from .db import get_db
from .levels import LEVELS, evaluate_attempt, get_level, public_level

bp = Blueprint("child", __name__, url_prefix="/child")


def child_progress(db, child_id: int) -> dict[int, dict]:
    rows = db.execute(
        """SELECT level_id,
                  MAX(CASE WHEN success = 1 THEN stars ELSE 0 END) AS best_stars,
                  SUM(CASE WHEN success = 1 THEN 1 ELSE 0 END) AS successes,
                  COUNT(*) AS attempts,
                  MAX(created_at) AS last_played_at
             FROM attempts
            WHERE child_id = ?
            GROUP BY level_id""",
        (child_id,),
    ).fetchall()
    return {row["level_id"]: dict(row) for row in rows}


def completed_before(progress: dict[int, dict], level_id: int) -> bool:
    return bool(progress.get(level_id, {}).get("successes"))


def assigned_levels(db, child_id: int) -> set[int]:
    rows = db.execute(
        """SELECT DISTINCT a.level_id
             FROM assignments a
             JOIN class_members cm ON cm.class_id = a.class_id
            WHERE cm.child_id = ?""",
        (child_id,),
    ).fetchall()
    return {row["level_id"] for row in rows}


def current_assignment(db, child_id: int, level_id: int):
    return db.execute(
        """SELECT a.*, c.name AS class_name
             FROM assignments a
             JOIN classes c ON c.id = a.class_id
             JOIN class_members cm ON cm.class_id = a.class_id
            WHERE cm.child_id = ? AND a.level_id = ?
            ORDER BY a.created_at DESC
            LIMIT 1""",
        (child_id, level_id),
    ).fetchone()


@bp.route("/")
@role_required("child")
def home():
    db = get_db()
    progress = child_progress(db, g.user["id"])
    assignments = db.execute(
        """SELECT a.*, c.name AS class_name,
                  CASE WHEN EXISTS(
                      SELECT 1 FROM attempts att
                      WHERE att.child_id = ? AND att.level_id = a.level_id AND att.success = 1
                  ) THEN 1 ELSE 0 END AS done
             FROM assignments a
             JOIN classes c ON c.id = a.class_id
             JOIN class_members cm ON cm.class_id = a.class_id
            WHERE cm.child_id = ?
            ORDER BY a.created_at DESC""",
        (g.user["id"], g.user["id"]),
    ).fetchall()
    classes = db.execute(
        """SELECT c.* FROM classes c
             JOIN class_members cm ON cm.class_id = c.id
            WHERE cm.child_id = ?""",
        (g.user["id"],),
    ).fetchall()
    total_stars = sum(row["best_stars"] or 0 for row in progress.values())
    return render_template(
        "child_home.html",
        levels=[public_level(level) for level in LEVELS],
        progress=progress,
        assignments=assignments,
        classes=classes,
        total_stars=total_stars,
        assigned=assigned_levels(db, g.user["id"]),
    )


@bp.route("/join-class", methods=("POST",))
@role_required("child")
def join_class():
    code = request.form.get("join_code", "").strip().upper()
    db = get_db()
    classroom = db.execute("SELECT * FROM classes WHERE join_code = ?", (code,)).fetchone()
    if classroom is None:
        abort(404, description="没有找到这个班级码，请让老师再确认一次。")
    try:
        db.execute(
            "INSERT INTO class_members (class_id, child_id) VALUES (?, ?)",
            (classroom["id"], g.user["id"]),
        )
        db.commit()
    except Exception:
        # UNIQUE(class_id, child_id): joining twice is harmless.
        db.rollback()
    return redirect(url_for("child.home"))


def _level_is_open(level_id: int, progress: dict[int, dict], assigned: set[int]) -> bool:
    if level_id in assigned:
        return True
    if level_id <= 1:
        return True
    return completed_before(progress, level_id - 1)


@bp.route("/levels/<int:level_id>")
@role_required("child")
def play(level_id: int):
    level = get_level(level_id)
    if level is None:
        abort(404)
    db = get_db()
    progress = child_progress(db, g.user["id"])
    assigned = assigned_levels(db, g.user["id"])
    if not _level_is_open(level_id, progress, assigned):
        abort(403, description="先完成上一关，就能解锁这一关啦。")

    assignment = current_assignment(db, g.user["id"], level_id)
    if assignment:
        db.execute(
            "INSERT OR IGNORE INTO assignment_views (child_id, assignment_id) VALUES (?, ?)",
            (g.user["id"], assignment["id"]),
        )
        db.commit()

    previous_success = bool(progress.get(level_id, {}).get("successes"))
    client_level = dict(level)
    client_level.pop("variants", None)
    # For mystery scenarios the browser must not know star locations in advance.
    if client_level.get("mystery_stars"):
        client_level["world"] = dict(level["world"])
        client_level["world"]["stars"] = []
    return render_template(
        "play.html",
        level=level,
        level_json=json.dumps(client_level, ensure_ascii=False),
        previous_best=progress.get(level_id, {}).get("best_stars", 0),
        assignment=assignment,
        previous_success=previous_success,
    )


@bp.route("/api/levels/<int:level_id>/run", methods=("POST",))
@role_required("child")
def run_level(level_id: int):
    level = get_level(level_id)
    if level is None:
        abort(404)
    db = get_db()
    progress = child_progress(db, g.user["id"])
    assigned = assigned_levels(db, g.user["id"])
    if not _level_is_open(level_id, progress, assigned):
        abort(403, description="先完成上一关，再挑战这个关卡。")

    payload = request.get_json(silent=True) or {}
    blocks = payload.get("blocks")
    variant_key = payload.get("variant_key") or ""
    result = evaluate_attempt(blocks, level, variant_key or None)

    db.execute(
        """INSERT INTO attempts
           (child_id, level_id, variant_key, success, stars, steps, block_count,
            category, concepts_used, missing_concepts)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
        (
            g.user["id"], level_id, variant_key,
            1 if result["success"] else 0, result["stars"], result["steps"],
            result["block_count"], result["failure_category"],
            ",".join(result.get("concepts_used", [])),
            ",".join(result.get("missing_concepts", [])),
        ),
    )
    db.commit()

    # Return animation/feedback data only. Do not return a canonical answer.
    return jsonify(result)
