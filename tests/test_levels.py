from app.levels import LEVEL_BY_ID, evaluate_attempt


def rep(times, *children):
    return {"type": "repeat", "times": times, "children": list(children)}


def until(*children):
    return {"type": "until_goal", "children": list(children)}


def cond(kind, *children):
    return {"type": kind, "children": list(children)}


def b(kind):
    return {"type": kind}


def test_level_1_sequence_three_stars():
    result = evaluate_attempt([b("move")] * 3, LEVEL_BY_ID[1])
    assert result["success"] is True
    assert result["stars"] == 3


def test_level_2_turns():
    program = [b("move"), b("turn_right"), b("move"), b("move")]
    result = evaluate_attempt(program, LEVEL_BY_ID[2])
    assert result["success"]
    assert result["stars"] == 3


def test_level_3_repeat_required_for_third_star():
    result = evaluate_attempt([rep(6, b("move"))], LEVEL_BY_ID[3])
    assert result["success"]
    assert result["stars"] == 3
    assert "repeat" in result["concepts_used"]


def test_level_4_star_repeat():
    result = evaluate_attempt([rep(5, b("collect"), b("move"))], LEVEL_BY_ID[4])
    assert result["success"]
    assert result["stars"] == 3


def test_level_5_nested_loop():
    edge = rep(4, b("move"), b("collect"))
    program = [
        b("collect"),
        rep(3, edge, b("turn_right")),
        rep(3, b("move"), b("collect")), b("move"),
    ]
    result = evaluate_attempt(program, LEVEL_BY_ID[5])
    assert result["success"], result["failure_message"]
    assert result["stars"] == 3
    assert "nested_loop" in result["concepts_used"]


def test_level_6_conditional_works_for_every_variant():
    for key in ("sparkle_a", "sparkle_b", "sparkle_c", "sparkle_d"):
        program = [until(cond("if_star", b("collect")), b("move"))]
        result = evaluate_attempt(program, LEVEL_BY_ID[6], key)
        assert result["success"], (key, result["failure_message"])
        assert result["stars"] == 3, (key, result["stars"], result["steps"], result["block_count"])
        assert {"condition", "while"} <= set(result["concepts_used"])


def test_level_7_condition_while_spiral():
    program = [until(cond("if_path", b("move")), cond("if_wall", b("turn_right")))]
    result = evaluate_attempt(program, LEVEL_BY_ID[7])
    assert result["success"], result["failure_message"]
    assert result["stars"] == 3
    assert result["steps"] == 20


def test_level_8_project_has_a_loop_solution():
    program = [
        b("collect"), rep(4, b("move"), b("collect")),
    ]
    result = evaluate_attempt(program, LEVEL_BY_ID[8])
    assert result["success"], result["failure_message"]
    assert result["stars"] == 3
    assert result["steps"] <= LEVEL_BY_ID[8]["par_steps"]
    assert result["block_count"] <= LEVEL_BY_ID[8]["target_blocks"]


def test_level_9_integrated_capstone():
    program = [
        until(
            cond("if_star", b("collect")),
            cond("if_path", b("move")),
            cond("if_wall", b("turn_right")),
        )
    ]
    result = evaluate_attempt(program, LEVEL_BY_ID[9])
    assert result["success"], result["failure_message"]
    assert result["stars"] == 3, (result["stars"], result["steps"], result["block_count"])


def test_invalid_program_is_rejected():
    result = evaluate_attempt([], LEVEL_BY_ID[1])
    assert result["success"] is False
    assert result["stars"] == 0
    assert result["category"] == "invalid_program"


def test_wall_collision_gives_encouraging_category():
    result = evaluate_attempt([b("move")] * 5, LEVEL_BY_ID[1])
    assert not result["success"]
    assert result["category"] == "hit_wall"
