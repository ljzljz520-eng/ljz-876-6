import pytest

from app import create_app
from app.db import get_db
from app.levels import LEVEL_BY_ID


@pytest.fixture()
def app(tmp_path):
    app = create_app({
        "TESTING": True,
        "DATABASE": str(tmp_path / "test.sqlite3"),
        "SECRET_KEY": "test",
        "WTF_CSRF_ENABLED": False,
    })
    yield app


@pytest.fixture()
def client(app):
    return app.test_client()


def register(client, role, name, username, password="secret123", grade=""):
    return client.post("/register", data={
        "role": role, "name": name, "username": username,
        "password": password, "grade": grade,
    }, follow_redirects=True)


def test_public_landing_page(client):
    response = client.get("/")
    assert response.status_code == 200
    assert "星光编程闯关" in response.get_data(as_text=True)


def test_child_unlocks_levels_and_run_records_attempt(client, app):
    register(client, "child", "小星", "kid1")
    response = client.get("/child/")
    assert "我的编程地图" in response.get_data(as_text=True)

    run = client.post("/child/api/levels/1/run", json={"blocks": [{"type": "move"}] * 3})
    data = run.get_json()
    assert run.status_code == 200
    assert data["success"] is True
    assert data["stars"] == 3

    with app.app_context():
        row = get_db().execute("SELECT * FROM attempts").fetchone()
        assert row["success"] == 1 and row["stars"] == 3
        assert row["block_count"] == 3

    level2 = client.get("/child/levels/2")
    assert level2.status_code == 200


def test_failed_attempt_returns_encouragement_without_canonical_program(client):
    register(client, "child", "小豆", "kid2")
    response = client.post("/child/api/levels/1/run", json={"blocks": [
        {"type": "move"}
    ]})
    data = response.get_json()
    assert data["success"] is False
    assert data["stars"] == 0
    assert "再试一次" in data["feedback"]
    # Server never returns a list representing the canonical solution.
    assert "answer" not in data
    assert "solution" not in data


def test_parent_linking_and_privacy_boundaries(client, app):
    register(client, "child", "小果", "kid3")
    with client.session_transaction() as session:
        child_id = session["user_id"]
    client.post("/logout")

    register(client, "parent", "果爸", "parent1")
    with app.app_context():
        code = get_db().execute(
            "SELECT family_code FROM users WHERE id = ?", (child_id,)
        ).fetchone()["family_code"]

    response = client.post("/parent/link", data={"family_code": code}, follow_redirects=True)
    html = response.get_data(as_text=True)
    assert "小果" in html
    assert "学习进度" in html
    assert "🔒" in html
    # Parent progress page does not expose block/program JSON or failure answers.
    assert "allowed_blocks" not in html
    assert "failure_message" not in html
    # Parent cannot access child play page/API.
    assert client.get("/child/").status_code == 403
    assert client.get("/child/levels/1").status_code == 403


def test_teacher_assignment_class_analytics_and_role_isolation(client, app):
    register(client, "teacher", "王老师", "teacher1")
    response = client.post("/teacher/classes", data={"name": "编程一班"}, follow_redirects=True)
    html = response.get_data(as_text=True)
    assert "编程一班" in html
    with app.app_context():
        classroom = get_db().execute("SELECT * FROM classes").fetchone()
        class_id = classroom["id"]
        join_code = classroom["join_code"]

    # Teacher assigns conditional level 6.
    response = client.post(
        f"/teacher/classes/{class_id}/assignments",
        data={"level_id": 6, "due_date": "2026-10-10", "note": "注意条件判断"},
        follow_redirects=True,
    )
    assert "神秘走廊" in response.get_data(as_text=True)
    with app.app_context():
        assignment_id = get_db().execute("SELECT id FROM assignments").fetchone()["id"]

    client.post("/logout")
    register(client, "child", "小困", "kid4")
    client.post("/child/join-class", data={"join_code": join_code}, follow_redirects=True)
    # Repeated unsuccessful attempts create a "stuck concept" signal.
    for _ in range(3):
        client.post("/child/api/levels/6/run", json={"blocks": [{"type": "move"}] * 5})

    class_page = client.get("/teacher/").status_code
    assert class_page == 403
    client.post("/logout")

    client.post("/login", data={"username": "teacher1", "password": "secret123"})
    assignment_page = client.get(f"/teacher/assignments/{assignment_id}")
    text = assignment_page.get_data(as_text=True)
    assert assignment_page.status_code == 200
    assert "小困" in text
    assert "连续多次未通关" in text
    assert "条件判断" in text
    # Teacher cannot access child or parent dashboards.
    assert client.get("/child/").status_code == 403
    assert client.get("/parent/").status_code == 403


def test_child_cannot_submit_a_locked_level(client):
    register(client, "child", "小锁", "kid7")
    response = client.post("/child/api/levels/3/run", json={"blocks": [
        {"type": "repeat", "times": 6, "children": [{"type": "move"}]}
    ]})
    assert response.status_code == 403


def test_mystery_level_does_not_send_star_positions_to_browser(client, app):
    register(client, "teacher", "赵老师", "teacher3")
    client.post("/teacher/classes", data={"name": "条件班"})
    with app.app_context():
        classroom = get_db().execute(
            "SELECT * FROM classes WHERE teacher_id = (SELECT id FROM users WHERE username = 'teacher3')"
        ).fetchone()
        class_id, join_code = classroom["id"], classroom["join_code"]
    client.post(f"/teacher/classes/{class_id}/assignments", data={"level_id": 6})
    client.post("/logout")

    register(client, "child", "小秘", "kid6")
    client.post("/child/join-class", data={"join_code": join_code})
    html = client.get("/child/levels/6").get_data(as_text=True)
    assert "mystery_stars" in html
    assert "sparkle_a" not in html
    assert "variants" not in html
    assert "[[1, 0]" not in html


def test_assignment_unlocks_level_for_child(client, app):
    register(client, "teacher", "李老师", "teacher2")
    client.post("/teacher/classes", data={"name": "二班"})
    with app.app_context():
        row = get_db().execute("SELECT * FROM classes").fetchone()
        class_id, code = row["id"], row["join_code"]
    client.post(f"/teacher/classes/{class_id}/assignments",
                data={"level_id": 7})
    client.post("/logout")

    register(client, "child", "小跳", "kid5")
    client.post("/child/join-class", data={"join_code": code})
    response = client.get("/child/levels/7")
    assert response.status_code == 200
    assert "旋转迷宫" in response.get_data(as_text=True)
