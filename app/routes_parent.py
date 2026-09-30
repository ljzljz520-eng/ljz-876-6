"""Parent-facing progress routes.

These views intentionally expose progress, stars and time spent, but never a
level's standard/correct program or a child's submitted block code.
"""
from __future__ import annotations

from flask import Blueprint, abort, g, redirect, render_template, request, url_for

from .auth import role_required
from .db import get_db
from .levels import CONCEPT_LABELS, LEVELS, LEVEL_BY_ID

bp = Blueprint("parent", __name__, url_prefix="/parent")


def linked_children(db, parent_id: int):
    return db.execute(
        """SELECT u.* FROM users u
             JOIN families f ON f.child_id = u.id
            WHERE f.parent_id = ?
            ORDER BY f.created_at DESC""",
        (parent_id,),
    ).fetchall()


def get_linked_child(db, parent_id: int, child_id: int):
    return db.execute(
        """SELECT u.* FROM users u
             JOIN families f ON f.child_id = u.id
            WHERE f.parent_id = ? AND u.id = ?""",
        (parent_id, child_id),
    ).fetchone()


@bp.route("/")
@role_required("parent")
def home():
    db = get_db()
    children = linked_children(db, g.user["id"])
    child_cards = []
    for child in children:
        progress_rows = db.execute(
            """SELECT level_id,
                      MAX(CASE WHEN success = 1 THEN stars ELSE 0 END) AS best_stars,
                      COUNT(*) AS attempts,
                      MAX(created_at) AS last_active
                 FROM attempts WHERE child_id = ?
                GROUP BY level_id""",
            (child["id"],),
        ).fetchall()
        completed = sum(1 for row in progress_rows if row["best_stars"] > 0)
        stars = sum(row["best_stars"] for row in progress_rows)
        attempts = sum(row["attempts"] for row in progress_rows)
        last_active = max((row["last_active"] for row in progress_rows), default=None)
        summary = {
            "completed": completed,
            "attempts": attempts,
            "stars": stars,
            "last_active": last_active,
        }
        child_cards.append({"child": child, "summary": summary})
    return render_template("parent_home.html", children=child_cards)


@bp.route("/link", methods=("POST",))
@role_required("parent")
def link_child():
    code = request.form.get("family_code", "").strip().upper()
    db = get_db()
    child = db.execute(
        "SELECT * FROM users WHERE role = 'child' AND family_code = ?", (code,)
    ).fetchone()
    if child is None:
        abort(404, description="家庭连接码不正确。")
    existing = db.execute(
        "SELECT 1 FROM families WHERE parent_id = ? AND child_id = ?",
        (g.user["id"], child["id"]),
    ).fetchone()
    if existing:
        return redirect(url_for("parent.progress", child_id=child["id"]))
    db.execute(
        "INSERT INTO families (parent_id, child_id) VALUES (?, ?)",
        (g.user["id"], child["id"]),
    )
    db.commit()
    return redirect(url_for("parent.progress", child_id=child["id"]))


@bp.route("/children/<int:child_id>")
@role_required("parent")
def progress(child_id: int):
    db = get_db()
    child = get_linked_child(db, g.user["id"], child_id)
    if child is None:
        abort(404, description="还没有连接这个孩子。")

    level_rows = db.execute(
        """SELECT level_id,
                  MAX(CASE WHEN success = 1 THEN stars ELSE 0 END) AS best_stars,
                  SUM(CASE WHEN success = 1 THEN 1 ELSE 0 END) AS successes,
                  COUNT(*) AS attempts,
                  MAX(created_at) AS last_played_at
             FROM attempts WHERE child_id = ?
            GROUP BY level_id""",
        (child_id,),
    ).fetchall()
    by_level = {row["level_id"]: dict(row) for row in level_rows}

    items = []
    total_stars = 0
    completed = 0
    for level in LEVELS:
        row = by_level.get(level["id"], {})
        stars = row.get("best_stars") or 0
        total_stars += stars
        if row.get("successes"):
            completed += 1
        items.append({
            "level": {
                "id": level["id"],
                "title": level["title"],
                "concept": level["concept"],
                "concept_label": CONCEPT_LABELS[level["concept"]],
                "project": level["project"],
            },
            "best_stars": stars,
            "attempts": row.get("attempts", 0),
            "successes": row.get("successes", 0),
            "last_played_at": row.get("last_played_at"),
            "status": "completed" if row.get("successes") else (
                "started" if row.get("attempts") else "not_started"),
        })

    concept_rows = db.execute(
        """SELECT l.level_id, MAX(CASE WHEN l.success = 1 THEN l.stars ELSE 0 END) stars
             FROM attempts l WHERE l.child_id = ? GROUP BY l.level_id""",
        (child_id,),
    ).fetchall()
    concept_best = {row["level_id"]: row["stars"] for row in concept_rows}
    concept_progress = []
    for concept in ["sequence", "turns", "repeat", "nested_loop",
                    "condition", "while", "project", "integrated"]:
        related = [level["id"] for level in LEVELS if concept in level["concepts"]]
        if not related:
            continue
        earned = sum(concept_best.get(level_id, 0) for level_id in related)
        possible = 3 * len(related)
        concept_progress.append({
            "key": concept,
            "label": CONCEPT_LABELS[concept],
            "earned": earned,
            "possible": possible,
            "percent": round(earned / possible * 100) if possible else 0,
        })

    assignment_rows = db.execute(
        """SELECT a.title, a.due_date, c.name AS class_name,
                  EXISTS(SELECT 1 FROM attempts att
                          WHERE att.child_id = cm2.child_id AND att.level_id = a.level_id
                            AND att.success = 1) AS done
             FROM class_members cm2
             JOIN classes c ON c.id = cm2.class_id
             JOIN assignments a ON a.class_id = c.id
            WHERE cm2.child_id = ?
            ORDER BY a.created_at DESC""",
        (child_id,),
    ).fetchall()

    return render_template(
        "parent_progress.html",
        child=child,
        items=items,
        concepts=concept_progress,
        assignments=assignment_rows,
        completed=completed,
        total_levels=len(LEVELS),
        total_stars=total_stars,
        max_stars=len(LEVELS) * 3,
    )
