"""Authentication helpers and simple role-based access control."""
from __future__ import annotations

import functools
import secrets

from flask import abort, g, redirect, session, url_for
from werkzeug.security import check_password_hash, generate_password_hash

from .db import get_db


def generate_family_code() -> str:
    return "F" + secrets.token_hex(3).upper()


def generate_class_code() -> str:
    return secrets.token_hex(3).upper()


def hash_password(password: str) -> str:
    return generate_password_hash(password)


def verify_password(password_hash: str, password: str) -> bool:
    return check_password_hash(password_hash, password)


def load_logged_in_user() -> None:
    user_id = session.get("user_id")
    g.user = None
    if user_id:
        g.user = get_db().execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone()


def login_required(view):
    @functools.wraps(view)
    def wrapped_view(**kwargs):
        if g.user is None:
            return redirect(url_for("auth.login", next=request_path()))
        return view(**kwargs)
    return wrapped_view


def role_required(*roles: str):
    def decorator(view):
        @functools.wraps(view)
        def wrapped_view(**kwargs):
            if g.user is None:
                return redirect(url_for("auth.login", next=request_path()))
            if g.user["role"] not in roles:
                abort(403)
            return view(**kwargs)
        return wrapped_view
    return decorator


def request_path() -> str:
    from flask import request
    return request.path
