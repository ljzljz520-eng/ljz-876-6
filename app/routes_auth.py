"""Registration, login and role-aware landing page."""
from __future__ import annotations

from flask import (
    Blueprint, flash, g, redirect, render_template, request, session, url_for,
)

from .auth import generate_family_code, hash_password, verify_password
from .db import get_db

bp = Blueprint("auth", __name__)


@bp.route("/")
def index():
    if g.user:
        return redirect(url_for(f"{g.user['role']}.home"))
    return render_template("index.html")


@bp.route("/register", methods=("GET", "POST"))
def register():
    if request.method == "POST":
        role = request.form.get("role", "child")
        name = request.form.get("name", "").strip()
        username = request.form.get("username", "").strip().lower()
        password = request.form.get("password", "")
        grade = request.form.get("grade", "").strip()

        error = None
        if role not in {"child", "parent", "teacher"}:
            error = "请选择一个身份。"
        elif not name or not username or not password:
            error = "昵称、账号和密码都要填写。"
        elif len(username) < 3 or not username.replace("_", "").isalnum():
            error = "账号至少 3 位，只能包含字母、数字或下划线。"
        elif len(password) < 6:
            error = "密码至少需要 6 位。"

        db = get_db()
        if error is None and db.execute("SELECT 1 FROM users WHERE username = ?", (username,)).fetchone():
            error = "这个账号已经被使用啦。"

        if error is None:
            family_code = generate_family_code() if role == "child" else None
            cursor = db.execute(
                """INSERT INTO users (role, name, username, password_hash, grade, family_code)
                   VALUES (?, ?, ?, ?, ?, ?)""",
                (role, name, username, hash_password(password), grade, family_code),
            )
            db.commit()
            session.clear()
            session["user_id"] = cursor.lastrowid
            if role == "child":
                flash("注册成功！你的家庭连接码已在首页显示，请交给家长。", "success")
            else:
                flash("注册成功，欢迎来到少儿编程闯关题库！", "success")
            return redirect(url_for(f"{role}.home"))
        flash(error, "error")

    return render_template("register.html", role=request.args.get("role", "child"))


@bp.route("/login", methods=("GET", "POST"))
def login():
    if request.method == "POST":
        username = request.form.get("username", "").strip().lower()
        password = request.form.get("password", "")
        user = get_db().execute("SELECT * FROM users WHERE username = ?", (username,)).fetchone()
        if user is None or not verify_password(user["password_hash"], password):
            flash("账号或密码不正确。", "error")
        else:
            session.clear()
            session["user_id"] = user["id"]
            return redirect(url_for(f"{user['role']}.home"))
    return render_template("login.html")


@bp.route("/logout", methods=("POST",))
def logout():
    session.clear()
    return redirect(url_for("auth.index"))
