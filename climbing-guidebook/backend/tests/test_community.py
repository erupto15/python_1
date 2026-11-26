from __future__ import annotations

import pytest

from conftest import register_user

# --- комментарии --------------------------------------------------------------------------


def _comment(client, headers, **payload):
    return client.post("/api/comments", json=payload, headers=headers)


def test_comment_create_requires_auth(client, catalog):
    resp = client.post(
        "/api/comments", json={"climb_type": "route", "route_id": catalog["route"]["id"], "body": "Привет"}
    )
    assert resp.status_code == 401


def test_comment_lifecycle_on_route(client, catalog, user, other_user):
    route_id = catalog["route"]["id"]
    assert client.get(f"/api/comments/by-route/{route_id}").json() == []

    resp = _comment(client, user.headers, climb_type="route", route_id=route_id, body="Отличная трасса")
    assert resp.status_code == 201, resp.text
    comment = resp.json()
    assert comment["user_id"] == user.id
    assert comment["author_name"] == "Обычный пользователь"
    assert comment["boulder_id"] is None

    listed = client.get(f"/api/comments/by-route/{route_id}").json()
    assert [c["id"] for c in listed] == [comment["id"]]
    assert listed[0]["author_name"] == "Обычный пользователь"

    # Чужой пользователь не может править и удалять.
    cid = comment["id"]
    assert client.patch(f"/api/comments/{cid}", json={"body": "взлом"}, headers=other_user.headers).status_code == 403
    assert client.delete(f"/api/comments/{cid}", headers=other_user.headers).status_code == 403

    edited = client.patch(f"/api/comments/{cid}", json={"body": "Исправлено"}, headers=user.headers)
    assert edited.status_code == 200
    assert edited.json()["body"] == "Исправлено"

    assert client.delete(f"/api/comments/{cid}", headers=user.headers).status_code == 204
    assert client.get(f"/api/comments/by-route/{route_id}").json() == []
    assert client.patch(f"/api/comments/{cid}", json={"body": "x"}, headers=user.headers).status_code == 404
    assert client.delete(f"/api/comments/{cid}", headers=user.headers).status_code == 404


def test_comment_on_boulder_with_attachment(client, catalog, user):
    boulder_id = catalog["boulder"]["id"]
    resp = _comment(
        client,
        user.headers,
        climb_type="boulder",
        boulder_id=boulder_id,
        body="Фото",
        attachments=[{"media_kind": "image", "file_url": "/uploads/images/a.jpg", "mime_type": "image/jpeg"}],
    )
    assert resp.status_code == 201, resp.text
    listed = client.get(f"/api/comments/by-boulder/{boulder_id}").json()
    assert len(listed) == 1
    assert listed[0]["attachments"][0]["file_url"] == "/uploads/images/a.jpg"


@pytest.mark.parametrize(
    ("payload_fn", "status"),
    [
        (lambda c: {"climb_type": "route", "boulder_id": c["boulder"]["id"], "body": "x"}, 400),
        (lambda c: {"climb_type": "route", "route_id": c["route"]["id"], "boulder_id": c["boulder"]["id"], "body": "x"}, 400),
        (lambda c: {"climb_type": "boulder", "route_id": c["route"]["id"], "body": "x"}, 400),
        (lambda c: {"climb_type": "route", "route_id": 999999, "body": "x"}, 404),
        (lambda c: {"climb_type": "boulder", "boulder_id": 999999, "body": "x"}, 404),
        (lambda c: {"climb_type": "photo", "route_id": c["route"]["id"], "body": "x"}, 422),
        (lambda c: {"climb_type": "route", "route_id": c["route"]["id"]}, 422),
    ],
)
def test_comment_validation(client, catalog, user, payload_fn, status):
    resp = client.post("/api/comments", json=payload_fn(catalog), headers=user.headers)
    assert resp.status_code == status, resp.text


def test_comments_of_missing_climb_are_404(client):
    assert client.get("/api/comments/by-route/999999").status_code == 404
    assert client.get("/api/comments/by-boulder/999999").status_code == 404


def test_comments_hidden_after_route_deleted(client, catalog, user, admin_headers):
    route_id = catalog["route"]["id"]
    _comment(client, user.headers, climb_type="route", route_id=route_id, body="x")
    client.delete(f"/api/routes/{route_id}", headers=admin_headers)
    assert client.get(f"/api/comments/by-route/{route_id}").status_code == 404
    resp = _comment(client, user.headers, climb_type="route", route_id=route_id, body="y")
    assert resp.status_code == 404


def test_comment_parent_must_exist(client, catalog, user):
    resp = _comment(
        client, user.headers, climb_type="route", route_id=catalog["route"]["id"], body="ответ", parent_id=999999
    )
    assert resp.status_code == 404
    assert resp.json()["detail"] == "Комментарий, на который вы отвечаете, не найден"


def test_comment_reply_to_existing_parent(client, catalog, user, other_user):
    route_id = catalog["route"]["id"]
    parent = _comment(client, user.headers, climb_type="route", route_id=route_id, body="вопрос").json()
    reply = _comment(
        client, other_user.headers, climb_type="route", route_id=route_id, body="ответ", parent_id=parent["id"]
    )
    assert reply.status_code == 201, reply.text
    assert reply.json()["parent_id"] == parent["id"]


def test_comment_parent_must_be_on_same_climb(client, catalog, user):
    parent = _comment(client, user.headers, climb_type="route", route_id=catalog["route"]["id"], body="q").json()
    resp = _comment(
        client,
        user.headers,
        climb_type="boulder",
        boulder_id=catalog["boulder"]["id"],
        body="ответ",
        parent_id=parent["id"],
    )
    assert resp.status_code == 422
    assert "той же трассе" in resp.json()["detail"]


def test_comment_parent_must_not_be_deleted(client, catalog, user):
    route_id = catalog["route"]["id"]
    parent = _comment(client, user.headers, climb_type="route", route_id=route_id, body="q").json()
    assert client.delete(f"/api/comments/{parent['id']}", headers=user.headers).status_code == 204
    resp = _comment(client, user.headers, climb_type="route", route_id=route_id, body="a", parent_id=parent["id"])
    assert resp.status_code == 404


@pytest.mark.parametrize("body", ["", "   ", "\n\t "])
def test_comment_body_must_not_be_blank(client, catalog, user, body):
    resp = _comment(client, user.headers, climb_type="route", route_id=catalog["route"]["id"], body=body)
    assert resp.status_code == 422
    assert resp.json()["detail"] == "Комментарий не может быть пустым"


def test_comment_body_is_stripped_and_blank_edit_rejected(client, catalog, user):
    resp = _comment(client, user.headers, climb_type="route", route_id=catalog["route"]["id"], body="  Привет \n")
    assert resp.status_code == 201
    assert resp.json()["body"] == "Привет"
    cid = resp.json()["id"]
    assert client.patch(f"/api/comments/{cid}", json={"body": "  "}, headers=user.headers).status_code == 422


# --- пролазы ------------------------------------------------------------------------------


def _ascent(client, headers, **payload):
    return client.post("/api/ascents", json=payload, headers=headers)


def test_ascent_requires_auth(client, catalog):
    resp = client.post("/api/ascents", json={"climb_type": "route", "route_id": catalog["route"]["id"]})
    assert resp.status_code == 401
    assert client.get("/api/me/ascents").status_code == 401
    assert client.get("/api/me/ascents/summary").status_code == 401


@pytest.mark.parametrize(
    ("style", "tries", "expected_style", "expected_tries"),
    [
        (None, 1, "redpoint", 2),
        ("redpoint", 5, "redpoint", 5),
        ("flash", 7, "flash", 1),
        ("ONSIGHT", 3, "onsight", 1),
    ],
)
def test_route_send_styles_normalize_tries(client, catalog, user, style, tries, expected_style, expected_tries):
    resp = _ascent(
        client, user.headers, climb_type="route", route_id=catalog["route"]["id"], ascent_style=style, tries=tries
    )
    assert resp.status_code == 201, resp.text
    body = resp.json()
    assert (body["status"], body["ascent_style"], body["tries"]) == ("send", expected_style, expected_tries)


@pytest.mark.parametrize(
    ("payload_fn", "status"),
    [
        (lambda c: {"climb_type": "boulder", "boulder_id": c["boulder"]["id"], "ascent_style": "onsight"}, 400),
        (lambda c: {"climb_type": "route", "route_id": c["route"]["id"], "status": "attempt", "ascent_style": "flash"}, 400),
        (lambda c: {"climb_type": "route", "route_id": c["route"]["id"], "ascent_style": "dyno"}, 422),
        (lambda c: {"climb_type": "route", "route_id": c["route"]["id"], "tries": 0}, 422),
        (lambda c: {"climb_type": "route", "route_id": c["route"]["id"], "stars": 4}, 422),
        (lambda c: {"climb_type": "route"}, 400),
        (lambda c: {"climb_type": "route", "route_id": 999999}, 404),
        (lambda c: {"climb_type": "boulder", "boulder_id": 999999}, 404),
    ],
)
def test_ascent_validation(client, catalog, user, payload_fn, status):
    assert _ascent(client, user.headers, **payload_fn(catalog)).status_code == status


def test_ascent_summary_list_and_send_counts(client, catalog, user):
    route_id, boulder_id = catalog["route"]["id"], catalog["boulder"]["id"]
    assert _ascent(client, user.headers, climb_type="route", route_id=route_id, status="attempt").status_code == 201
    assert _ascent(client, user.headers, climb_type="boulder", boulder_id=boulder_id, status="attempt").status_code == 201
    summary = client.get("/api/me/ascents/summary", headers=user.headers).json()
    assert summary["attempted_route_ids"] == [route_id]
    assert summary["attempted_boulder_ids"] == [boulder_id]
    assert summary["sent_route_ids"] == []

    assert _ascent(client, user.headers, climb_type="route", route_id=route_id, ascent_style="flash").status_code == 201
    summary = client.get("/api/me/ascents/summary", headers=user.headers).json()
    assert summary["sent_route_ids"] == [route_id]
    assert summary["attempted_route_ids"] == []

    mine = client.get("/api/me/ascents", headers=user.headers).json()
    assert len(mine) == 3
    route_rows = [a for a in mine if a["route_id"] == route_id]
    assert route_rows[0]["climb_name"] == "Трасса 1"
    assert route_rows[0]["climb_grade"] == "6a"
    assert catalog["area"]["name"] in route_rows[0]["structure_label"]
    sends = client.get("/api/me/ascents", params={"status": "send"}, headers=user.headers).json()
    assert [a["ascent_style"] for a in sends] == ["flash"]

    assert client.get(f"/api/routes/{route_id}").json()["send_count"] == 0  # detail без счётчика
    listed = client.get("/api/routes", params={"sector_id": catalog["sector"]["id"]}).json()
    assert listed[0]["send_count"] == 1


def test_delete_ascent_only_own(client, catalog, user, other_user):
    ascent = _ascent(client, user.headers, climb_type="route", route_id=catalog["route"]["id"]).json()
    assert client.delete(f"/api/ascents/{ascent['id']}", headers=other_user.headers).status_code == 404
    assert client.delete(f"/api/ascents/{ascent['id']}", headers=user.headers).status_code == 204
    assert client.get("/api/me/ascents", headers=user.headers).json() == []
    assert client.delete(f"/api/ascents/{ascent['id']}", headers=user.headers).status_code == 404


def test_deleting_route_purges_ascents(client, catalog, user, admin_headers):
    route_id = catalog["route"]["id"]
    _ascent(client, user.headers, climb_type="route", route_id=route_id)
    client.delete(f"/api/routes/{route_id}", headers=admin_headers)
    assert client.get("/api/me/ascents", headers=user.headers).json() == []
    assert client.get("/api/me/ascents/summary", headers=user.headers).json()["sent_route_ids"] == []


# --- оценки, лайки, статистика ------------------------------------------------------------


def test_rating_upsert_stats_and_delete(client, catalog, user, other_user):
    route_id = catalog["route"]["id"]
    resp = client.put(
        "/api/ratings",
        json={"climb_type": "route", "route_id": route_id, "stars": 3, "felt_grade": "6a+"},
        headers=user.headers,
    )
    assert resp.status_code == 200, resp.text
    first_id = resp.json()["id"]
    # Повторная оценка обновляет ту же запись.
    resp = client.put(
        "/api/ratings", json={"climb_type": "route", "route_id": route_id, "stars": 1}, headers=user.headers
    )
    assert resp.json()["id"] == first_id
    assert resp.json()["stars"] == 1
    assert resp.json()["felt_grade"] == "6a+"
    client.put("/api/ratings", json={"climb_type": "route", "route_id": route_id, "stars": 3}, headers=other_user.headers)

    stats = client.get(
        "/api/climbs/stats", params={"climb_type": "route", "route_id": route_id}, headers=user.headers
    ).json()
    assert stats["ratings_count"] == 2
    assert stats["avg_stars"] == 2.0
    assert stats["my_stars"] == 1
    assert stats["felt_grades"] == ["6a+"]

    resp = client.delete("/api/ratings", params={"climb_type": "route", "route_id": route_id}, headers=user.headers)
    assert resp.status_code == 204
    stats = client.get("/api/climbs/stats", params={"climb_type": "route", "route_id": route_id}).json()
    assert stats["ratings_count"] == 1
    assert stats["avg_stars"] == 3.0
    assert stats["my_stars"] is None


@pytest.mark.parametrize("stars", [0, 4])
def test_rating_stars_range(client, catalog, user, stars):
    resp = client.put(
        "/api/ratings", json={"climb_type": "route", "route_id": catalog["route"]["id"], "stars": stars},
        headers=user.headers,
    )
    assert resp.status_code == 422


def test_rating_requires_auth(client, catalog):
    resp = client.put("/api/ratings", json={"climb_type": "route", "route_id": catalog["route"]["id"], "stars": 2})
    assert resp.status_code == 401


def test_send_with_stars_creates_rating(client, catalog, user):
    route_id = catalog["route"]["id"]
    _ascent(client, user.headers, climb_type="route", route_id=route_id, stars=2, felt_grade="6b")
    stats = client.get(
        "/api/climbs/stats", params={"climb_type": "route", "route_id": route_id}, headers=user.headers
    ).json()
    assert stats["send_count"] == 1
    assert stats["my_status"] == "send"
    assert stats["my_stars"] == 2
    assert stats["my_felt_grade"] == "6b"
    assert stats["recent_sends"][0]["user_display_name"] == "Обычный пользователь"


def test_like_toggle_and_list(client, catalog, user, other_user):
    boulder_id = catalog["boulder"]["id"]
    payload = {"climb_type": "boulder", "boulder_id": boulder_id}
    assert client.put("/api/likes", json=payload, headers=user.headers).json() == {"liked": True}
    assert client.put("/api/likes", json=payload, headers=other_user.headers).json() == {"liked": True}
    assert client.get("/api/likes", headers=user.headers).json() == [
        {"climb_type": "boulder", "route_id": None, "boulder_id": boulder_id}
    ]
    stats = client.get(
        "/api/climbs/stats", params={"climb_type": "boulder", "boulder_id": boulder_id}, headers=user.headers
    ).json()
    assert stats["like_count"] == 2 and stats["liked"] is True

    assert client.put("/api/likes", json=payload, headers=user.headers).json() == {"liked": False}
    assert client.get("/api/likes", headers=user.headers).json() == []
    anon = client.get("/api/climbs/stats", params={"climb_type": "boulder", "boulder_id": boulder_id}).json()
    assert anon["like_count"] == 1 and anon["liked"] is False


def test_likes_require_auth(client, catalog):
    assert client.get("/api/likes").status_code == 401
    resp = client.put("/api/likes", json={"climb_type": "route", "route_id": catalog["route"]["id"]})
    assert resp.status_code == 401


def test_stats_for_missing_climb(client):
    assert client.get("/api/climbs/stats", params={"climb_type": "route", "route_id": 999999}).status_code == 404
    assert client.get("/api/climbs/stats", params={"climb_type": "route"}).status_code == 400


# --- рейтинг и профиль -------------------------------------------------------------------


def test_leaderboard_includes_sender_and_my_rank(client, catalog):
    climber = register_user(client, display_name="Лидер")
    _ascent(client, climber.headers, climb_type="route", route_id=catalog["route"]["id"], ascent_style="onsight")
    board = client.get("/api/ranking/leaderboard", headers=climber.headers)
    assert board.status_code == 200
    body = board.json()
    row = next(r for r in body["rows"] if r["user_id"] == climber.id)
    assert row["display_name"] == "Лидер"
    assert row["route_points"] > 0
    assert body["my_rank"] == row["rank"]
    anon = client.get("/api/ranking/leaderboard").json()
    assert anon["my_rank"] is None


@pytest.mark.parametrize("params", [{"top": 0}, {"top": 21}, {"months": 0}, {"months": 37}])
def test_leaderboard_query_bounds(client, params):
    assert client.get("/api/ranking/leaderboard", params=params).status_code == 422


def test_profile_counts(client, catalog, user):
    _ascent(client, user.headers, climb_type="route", route_id=catalog["route"]["id"], ascent_style="flash")
    _ascent(client, user.headers, climb_type="boulder", boulder_id=catalog["boulder"]["id"], status="attempt")
    client.put(
        "/api/ratings", json={"climb_type": "boulder", "boulder_id": catalog["boulder"]["id"], "stars": 2},
        headers=user.headers,
    )
    mine = client.get("/api/users/me/profile", headers=user.headers)
    assert mine.status_code == 200
    body = mine.json()
    assert (body["sends_count"], body["styles_count"], body["ratings_count"]) == (1, 1, 1)
    public = client.get(f"/api/users/{user.id}/profile").json()
    assert public["sends_count"] == 1
    assert "email" not in public
    assert client.get("/api/users/me/profile").status_code == 401
