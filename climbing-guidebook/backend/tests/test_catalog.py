from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from app.main import app

# --- публичное чтение ---------------------------------------------------------------------


@pytest.mark.parametrize(
    "path",
    [
        "/api/areas",
        "/api/sectors",
        "/api/routes",
        "/api/boulders",
        "/api/map-features",
        "/api/photos",
        "/api/catalog/manifest",
        "/api/catalog/bundle",
    ],
)
def test_anonymous_can_read_lists(client, path):
    resp = client.get(path)
    assert resp.status_code == 200, resp.text


def test_anonymous_can_read_created_entities(client, catalog):
    area, sector = catalog["area"], catalog["sector"]
    route, boulder = catalog["route"], catalog["boulder"]
    assert client.get(f"/api/areas/{area['id']}").json()["name"] == area["name"]
    assert client.get(f"/api/sectors/{sector['id']}").json()["area_id"] == area["id"]
    assert [s["id"] for s in client.get(f"/api/areas/{area['id']}/sectors").json()] == [sector["id"]]
    assert client.get(f"/api/routes/{route['id']}").json()["grade"] == "6a"
    assert client.get(f"/api/boulders/{boulder['id']}").json()["name"] == "Боулдер 1"
    assert [r["id"] for r in client.get("/api/routes", params={"sector_id": sector["id"]}).json()] == [route["id"]]
    assert [b["id"] for b in client.get("/api/boulders", params={"sector_id": sector["id"]}).json()] == [boulder["id"]]


@pytest.mark.parametrize(
    "path", ["/api/areas/999999", "/api/sectors/999999", "/api/routes/999999", "/api/boulders/999999"]
)
def test_missing_entities_are_404(client, path):
    assert client.get(path).status_code == 404


def test_sectors_of_missing_area_is_404(client):
    assert client.get("/api/areas/999999/sectors").status_code == 404


# --- права на запись ----------------------------------------------------------------------


def _write_requests(catalog):
    area, sector = catalog["area"], catalog["sector"]
    route, boulder = catalog["route"], catalog["boulder"]
    ids = {"sector_id": sector["id"], "area_id": area["id"]}
    return [
        ("post", "/api/areas", {"name": "Хак"}),
        ("patch", f"/api/areas/{area['id']}", {"name": "Хак"}),
        ("delete", f"/api/areas/{area['id']}", None),
        ("post", f"/api/areas/{area['id']}/sectors", {"name": "Хак"}),
        ("patch", f"/api/sectors/{sector['id']}", {"name": "Хак"}),
        ("delete", f"/api/sectors/{sector['id']}", None),
        ("post", "/api/routes", {**ids, "name": "Хак", "grade": "5a"}),
        ("patch", f"/api/routes/{route['id']}", {"name": "Хак"}),
        ("delete", f"/api/routes/{route['id']}", None),
        ("post", "/api/routes/reorder", {"ordered_ids": [route["id"]]}),
        ("post", "/api/boulders", {**ids, "name": "Хак", "grade": "5a"}),
        ("patch", f"/api/boulders/{boulder['id']}", {"name": "Хак"}),
        ("delete", f"/api/boulders/{boulder['id']}", None),
        ("post", "/api/map-features", {"feature_type": "parking", "geometry": {"type": "Point", "coordinates": [0, 0]}}),
        ("post", "/api/photos", {"climb_type": "route", "route_id": route["id"], "image_url": "/x.jpg"}),
    ]


def _send(client, method, path, body, headers=None):
    kwargs = {"headers": headers or {}}
    if body is not None:
        kwargs["json"] = body
    return client.request(method.upper(), path, **kwargs)


def test_anonymous_writes_are_401(client, catalog):
    for method, path, body in _write_requests(catalog):
        resp = _send(client, method, path, body)
        assert resp.status_code == 401, f"{method} {path}: {resp.status_code}"


def test_regular_user_writes_are_403(client, catalog, user):
    for method, path, body in _write_requests(catalog):
        resp = _send(client, method, path, body, headers=user.headers)
        assert resp.status_code == 403, f"{method} {path}: {resp.status_code} {resp.text}"
    # Ничего не изменилось.
    assert client.get(f"/api/areas/{catalog['area']['id']}").json()["name"] == catalog["area"]["name"]
    assert client.get(f"/api/routes/{catalog['route']['id']}").status_code == 200


# --- админский CRUD -----------------------------------------------------------------------


def test_admin_creates_area_with_owner_and_ignores_created_by(client, admin_headers, user):
    resp = client.post(
        "/api/areas",
        json={"name": "Новый район", "description": "Описание", "created_by": user.id},
        headers=admin_headers,
    )
    assert resp.status_code == 201
    area = resp.json()
    me = client.get("/api/auth/me", headers=admin_headers).json()
    assert area["created_by"] == me["id"]
    assert area["deleted_at"] is None
    assert area["id"] in [a["id"] for a in client.get("/api/areas").json()]


def test_admin_updates_area_and_sector(client, admin_headers, catalog):
    area_id, sector_id = catalog["area"]["id"], catalog["sector"]["id"]
    resp = client.patch(f"/api/areas/{area_id}", json={"season": "Весна"}, headers=admin_headers)
    assert resp.status_code == 200
    assert resp.json()["season"] == "Весна"
    assert resp.json()["name"] == catalog["area"]["name"]

    resp = client.patch(
        f"/api/sectors/{sector_id}", json={"name": "Сектор Б", "latitude": 44.0}, headers=admin_headers
    )
    assert resp.status_code == 200
    assert client.get(f"/api/sectors/{sector_id}").json()["name"] == "Сектор Б"


def test_admin_updates_route_and_boulder(client, admin_headers, catalog):
    route_id, boulder_id = catalog["route"]["id"], catalog["boulder"]["id"]
    resp = client.patch(
        f"/api/routes/{route_id}", json={"grade": "6b+", "bolts": 9, "rating": 2.5}, headers=admin_headers
    )
    assert resp.status_code == 200, resp.text
    body = client.get(f"/api/routes/{route_id}").json()
    assert (body["grade"], body["bolts"], body["rating"]) == ("6b+", 9, 2.5)

    resp = client.patch(f"/api/boulders/{boulder_id}", json={"height_m": 4.5}, headers=admin_headers)
    assert resp.status_code == 200
    assert client.get(f"/api/boulders/{boulder_id}").json()["height_m"] == 4.5


def test_route_sort_order_is_auto_incremented_and_reorderable(client, admin_headers, catalog):
    ids = {"sector_id": catalog["sector"]["id"], "area_id": catalog["area"]["id"]}
    first = catalog["route"]
    second = client.post("/api/routes", json={**ids, "name": "Трасса 2", "grade": "6b"}, headers=admin_headers).json()
    third = client.post("/api/routes", json={**ids, "name": "Трасса 3", "grade": "6c"}, headers=admin_headers).json()
    assert first["sort_order"] < second["sort_order"] < third["sort_order"]

    new_order = [third["id"], first["id"], second["id"]]
    resp = client.post("/api/routes/reorder", json={"ordered_ids": new_order}, headers=admin_headers)
    assert resp.status_code == 200
    assert [r["id"] for r in resp.json()] == new_order
    listed = client.get("/api/routes", params={"sector_id": ids["sector_id"]}).json()
    assert [r["id"] for r in listed] == new_order

    missing = client.post("/api/routes/reorder", json={"ordered_ids": [first["id"], 999999]}, headers=admin_headers)
    assert missing.status_code == 404
    empty = client.post("/api/routes/reorder", json={"ordered_ids": []}, headers=admin_headers)
    assert empty.status_code == 422


def test_route_requires_sector_from_same_area(client, admin_headers, catalog):
    other_area = client.post("/api/areas", json={"name": "Другой район"}, headers=admin_headers).json()
    resp = client.post(
        "/api/routes",
        json={"sector_id": catalog["sector"]["id"], "area_id": other_area["id"], "name": "X", "grade": "5a"},
        headers=admin_headers,
    )
    assert resp.status_code == 400
    resp = client.patch(
        f"/api/boulders/{catalog['boulder']['id']}", json={"area_id": other_area["id"]}, headers=admin_headers
    )
    assert resp.status_code == 400


@pytest.mark.parametrize(
    ("override", "status"),
    [
        ({"area_id": 999999}, 404),
        ({"sector_id": 999999}, 404),
        ({"rating": 3.5}, 422),
        ({"rating": -1}, 422),
        ({"grade": "x" * 33}, 422),
        ({"name": None}, 422),
    ],
)
def test_route_create_validation(client, admin_headers, catalog, override, status):
    payload = {
        "sector_id": catalog["sector"]["id"],
        "area_id": catalog["area"]["id"],
        "name": "Валидация",
        "grade": "6a",
        **override,
    }
    assert client.post("/api/routes", json=payload, headers=admin_headers).status_code == status


def test_create_sector_in_missing_area_is_404(client, admin_headers):
    assert client.post("/api/areas/999999/sectors", json={"name": "X"}, headers=admin_headers).status_code == 404


def test_admin_rating_creates_display_rating(client, admin_headers, catalog):
    ids = {"sector_id": catalog["sector"]["id"], "area_id": catalog["area"]["id"]}
    resp = client.post(
        "/api/routes", json={**ids, "name": "Звёздная", "grade": "7a", "rating": 2}, headers=admin_headers
    )
    assert resp.status_code == 201
    assert resp.json()["rating"] == 2


def test_delete_route_is_soft(client, admin_headers, catalog):
    route_id, sector_id = catalog["route"]["id"], catalog["sector"]["id"]
    assert client.delete(f"/api/routes/{route_id}", headers=admin_headers).status_code == 204
    assert client.get(f"/api/routes/{route_id}").status_code == 404
    assert route_id not in [r["id"] for r in client.get("/api/routes", params={"sector_id": sector_id}).json()]
    with_deleted = client.get("/api/routes", params={"sector_id": sector_id, "include_deleted": True}).json()
    deleted = [r for r in with_deleted if r["id"] == route_id]
    assert deleted and deleted[0]["deleted_at"] is not None
    # Повторное удаление — 404.
    assert client.delete(f"/api/routes/{route_id}", headers=admin_headers).status_code == 404
    assert client.patch(f"/api/routes/{route_id}", json={"name": "X"}, headers=admin_headers).status_code == 404


def test_delete_boulder_is_soft(client, admin_headers, catalog):
    boulder_id = catalog["boulder"]["id"]
    assert client.delete(f"/api/boulders/{boulder_id}", headers=admin_headers).status_code == 204
    assert client.get(f"/api/boulders/{boulder_id}").status_code == 404
    assert boulder_id not in [b["id"] for b in client.get("/api/boulders").json()]


def test_delete_area_cascades_soft_delete(client, admin_headers, catalog):
    area_id, sector_id = catalog["area"]["id"], catalog["sector"]["id"]
    route_id, boulder_id = catalog["route"]["id"], catalog["boulder"]["id"]
    assert client.delete(f"/api/areas/{area_id}", headers=admin_headers).status_code == 204

    assert client.get(f"/api/areas/{area_id}").status_code == 404
    assert client.get(f"/api/sectors/{sector_id}").status_code == 404
    assert client.get(f"/api/routes/{route_id}").status_code == 404
    assert client.get(f"/api/boulders/{boulder_id}").status_code == 404
    assert area_id not in [a["id"] for a in client.get("/api/areas").json()]
    assert area_id in [a["id"] for a in client.get("/api/areas", params={"include_deleted": True}).json()]

    bundle = client.get("/api/catalog/bundle").json()
    assert area_id not in [a["id"] for a in bundle["areas"]]
    assert route_id not in [r["id"] for r in bundle["routes"]]

    # В удалённый район нельзя добавить сектор или трассу.
    assert client.post(f"/api/areas/{area_id}/sectors", json={"name": "X"}, headers=admin_headers).status_code == 404
    resp = client.post(
        "/api/routes",
        json={"sector_id": sector_id, "area_id": area_id, "name": "X", "grade": "5a"},
        headers=admin_headers,
    )
    assert resp.status_code == 404


def test_delete_sector_cascades_soft_delete(client, admin_headers, catalog):
    sector_id = catalog["sector"]["id"]
    assert client.delete(f"/api/sectors/{sector_id}", headers=admin_headers).status_code == 204
    assert client.get(f"/api/routes/{catalog['route']['id']}").status_code == 404
    assert client.get(f"/api/boulders/{catalog['boulder']['id']}").status_code == 404
    assert client.get(f"/api/areas/{catalog['area']['id']}").status_code == 200
    assert sector_id not in [s["id"] for s in client.get("/api/sectors").json()]


def test_area_summaries_strip_inline_images(client, admin_headers):
    area = client.post(
        "/api/areas", json={"name": "С картинкой", "image_url": "data:image/png;base64,AAAA"}, headers=admin_headers
    ).json()
    full = {a["id"]: a for a in client.get("/api/areas").json()}
    short = {a["id"]: a for a in client.get("/api/areas", params={"summaries": True}).json()}
    assert full[area["id"]]["image_url"].startswith("data:")
    assert short[area["id"]]["image_url"] == ""


# --- манифест / bundle / health -------------------------------------------------------------


def test_catalog_manifest_version_changes_on_write(client, admin_headers):
    before = client.get("/api/catalog/manifest").json()
    created = client.post("/api/areas", json={"name": "Манифест"}, headers=admin_headers).json()
    after = client.get("/api/catalog/manifest").json()
    assert after["counts"]["areas"] == before["counts"]["areas"] + 1
    assert after["version"] != before["version"]
    bundle = client.get("/api/catalog/bundle").json()
    assert created["id"] in [a["id"] for a in bundle["areas"]]
    assert bundle["manifest"]["counts"]["areas"] == after["counts"]["areas"]


def test_health_counts_follow_catalog(client, admin_headers, catalog):
    before = client.get("/health").json()["catalog_counts"]
    ids = {"sector_id": catalog["sector"]["id"], "area_id": catalog["area"]["id"]}
    client.post("/api/routes", json={**ids, "name": "Ещё одна", "grade": "5c"}, headers=admin_headers)
    after = client.get("/health").json()["catalog_counts"]
    assert after["routes"] == before["routes"] + 1


# --- PATCH: null для обязательных полей и сброс рейтинга -----------------------------------


@pytest.mark.parametrize(
    ("path_key", "body"),
    [
        ("area", {"name": None}),
        ("sector", {"name": None}),
        ("route", {"grade": None}),
        ("route", {"name": None, "description": "x"}),
        ("route", {"sort_order": None}),
        ("boulder", {"grade": None}),
        ("boulder", {"sector_id": None}),
    ],
)
def test_patch_with_null_required_field_is_rejected(admin_headers, catalog, path_key, body):
    paths = {
        "area": f"/api/areas/{catalog['area']['id']}",
        "sector": f"/api/sectors/{catalog['sector']['id']}",
        "route": f"/api/routes/{catalog['route']['id']}",
        "boulder": f"/api/boulders/{catalog['boulder']['id']}",
    }
    raw = TestClient(app, raise_server_exceptions=False)
    resp = raw.patch(paths[path_key], json=body, headers=admin_headers)
    assert resp.status_code == 422, resp.status_code
    assert "не может быть пустым" in resp.json()["detail"]


def test_patch_null_optional_field_clears_it(client, admin_headers, catalog):
    route_id = catalog["route"]["id"]
    client.patch(f"/api/routes/{route_id}", json={"description": "Описание"}, headers=admin_headers)
    resp = client.patch(f"/api/routes/{route_id}", json={"description": None}, headers=admin_headers)
    assert resp.status_code == 200
    assert resp.json()["description"] is None


@pytest.mark.parametrize("kind", ["routes", "boulders"])
def test_climb_rating_can_be_cleared(client, admin_headers, catalog, kind):
    climb_id = catalog["route" if kind == "routes" else "boulder"]["id"]
    set_resp = client.patch(f"/api/{kind}/{climb_id}", json={"rating": 2}, headers=admin_headers)
    assert set_resp.json()["rating"] == 2

    # Ключа нет — рейтинг не трогаем.
    kept = client.patch(f"/api/{kind}/{climb_id}", json={"name": "Новое имя"}, headers=admin_headers)
    assert kept.json()["rating"] == 2

    resp = client.patch(f"/api/{kind}/{climb_id}", json={"rating": None}, headers=admin_headers)
    assert resp.status_code == 200
    assert resp.json()["rating"] is None
    assert client.get(f"/api/{kind}/{climb_id}").json()["rating"] is None
