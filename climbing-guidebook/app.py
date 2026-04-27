from flask import Flask, request, jsonify, render_template_string
from datetime import datetime
import json
import os
import uuid

    try:
        with open(DATA_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
            data = json.load(f)
    except (json.JSONDecodeError, OSError):
        return []

    normalized = []
    for route in data:
        if not isinstance(route, dict):
            continue
        normalized.append({
            "id": route.get("id") or str(uuid.uuid4()),
            "name": route.get("name") or "Без названия",
            "difficulty": route.get("difficulty") or "Не указана",
            "image": route.get("image", ""),
            "points": route.get("points", []),
            "created_at": route.get("created_at") or datetime.utcnow().isoformat(),
        })
    return normalized


routes = load_routes()


def save_data():
    with open(DATA_FILE, "w", encoding="utf-8") as f:
        json.dump(routes, f, ensure_ascii=False)
        json.dump(routes, f, ensure_ascii=False, indent=2)


HTML = """
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Го Лазать!</title>
<style>
body { font-family: Arial, sans-serif; }
canvas { border:1px solid black; margin-top:10px; max-width: 100%; }
button { margin:5px; padding:10px; }
:root {
    --bg: #f4efe6;
    --panel: #fffaf2;
    --text: #1f2933;
    --muted: #5f6c7b;
    --accent: #d86f45;
    --accent-dark: #a94d2c;
    --line: #e1d4c4;
    --hold: #d64545;
    --start: #2f9e44;
    --top: #2b6ee7;
    --shadow: 0 18px 48px rgba(71, 52, 28, 0.12);
}

* { box-sizing: border-box; }

body {
    margin: 0;
    font-family: Arial, sans-serif;
    background:
        radial-gradient(circle at top left, rgba(216,111,69,0.16), transparent 28%),
        linear-gradient(180deg, #f8f3ea 0%, var(--bg) 100%);
    color: var(--text);
}

.page {
    width: min(1180px, calc(100% - 32px));
    margin: 0 auto;
    padding: 32px 0 48px;
}

.hero {
    display: flex;
    justify-content: space-between;
    gap: 24px;
    align-items: flex-start;
    margin-bottom: 24px;
}

.hero h1 {
    margin: 0 0 8px;
    font-size: clamp(32px, 5vw, 48px);
}

.hero p {
    margin: 0;
    color: var(--muted);
    max-width: 720px;
    line-height: 1.5;
}

.badge {
    border: 1px solid var(--line);
    background: rgba(255,255,255,0.7);
    padding: 10px 14px;
    border-radius: 999px;
    font-size: 14px;
    white-space: nowrap;
}

.layout {
    display: grid;
    grid-template-columns: minmax(320px, 1.2fr) minmax(280px, 0.8fr);
    gap: 24px;
    align-items: start;
}

.panel {
    background: var(--panel);
    border: 1px solid var(--line);
    border-radius: 24px;
    padding: 20px;
    box-shadow: var(--shadow);
}

.section-title {
    margin: 0 0 6px;
    font-size: 22px;
}

.section-subtitle {
    margin: 0 0 18px;
    color: var(--muted);
}

.field-grid {
    display: grid;
    grid-template-columns: 1fr 180px;
    gap: 12px;
    margin-bottom: 14px;
}

.field {
    display: flex;
    flex-direction: column;
    gap: 6px;
}

.field label {
    font-size: 14px;
    color: var(--muted);
}

.field input,
.field select {
    width: 100%;
    padding: 12px 14px;
    border-radius: 14px;
    border: 1px solid var(--line);
    background: #fff;
    font-size: 15px;
}

.upload-row {
    display: flex;
    gap: 12px;
    flex-wrap: wrap;
    margin-bottom: 18px;
}

.file-input {
    flex: 1;
    min-width: 220px;
    padding: 12px;
    border: 1px dashed var(--line);
    border-radius: 16px;
    background: #fff;
}

.toolbar {
    display: flex;
    gap: 10px;
    flex-wrap: wrap;
    margin-bottom: 14px;
}

button {
    border: none;
    border-radius: 14px;
    padding: 11px 16px;
    font-size: 15px;
    cursor: pointer;
    transition: transform 0.15s ease, opacity 0.15s ease, background 0.15s ease;
}

button:hover { transform: translateY(-1px); }

.mode-button {
    background: #efe4d7;
    color: var(--text);
}

.mode-button.active {
    color: white;
}

.mode-button[data-mode="start"].active { background: var(--start); }
.mode-button[data-mode="hold"].active { background: var(--hold); }
.mode-button[data-mode="top"].active { background: var(--top); }

.secondary-button {
    background: #e8dfd2;
    color: var(--text);
}

.primary-button {
    background: var(--accent);
    color: white;
}

.primary-button:hover { background: var(--accent-dark); }

.status-row {
    display: flex;
    justify-content: space-between;
    gap: 12px;
    flex-wrap: wrap;
    align-items: center;
    margin: 8px 0 14px;
    color: var(--muted);
    font-size: 14px;
}

.counts {
    display: flex;
    gap: 10px;
    flex-wrap: wrap;
}

.pill {
    padding: 8px 10px;
    border-radius: 999px;
    background: #fff;
    border: 1px solid var(--line);
}

.canvas-wrap {
    overflow: auto;
    background: #fff;
    border-radius: 20px;
    border: 1px solid var(--line);
    padding: 10px;
}

canvas {
    display: block;
    border-radius: 14px;
    max-width: 100%;
}

.save-row {
    margin-top: 16px;
    display: flex;
    gap: 10px;
    flex-wrap: wrap;
}

.route-list {
    display: grid;
    gap: 14px;
}

.route-card {
    background: white;
    border: 1px solid var(--line);
    border-radius: 18px;
    overflow: hidden;
}

.route-card img {
    display: block;
    width: 100%;
    aspect-ratio: 4 / 3;
    object-fit: cover;
    background: #eadfce;
}

.route-body {
    padding: 14px;
}

.route-top {
    display: flex;
    justify-content: space-between;
    gap: 12px;
    align-items: start;
    margin-bottom: 8px;
}

.route-name {
    margin: 0;
    font-size: 18px;
}

.difficulty {
    padding: 6px 10px;
    border-radius: 999px;
    background: #f8eadf;
    color: var(--accent-dark);
    font-size: 13px;
    white-space: nowrap;
}

.route-meta {
    color: var(--muted);
    font-size: 14px;
    line-height: 1.5;
    margin-bottom: 12px;
}

.delete-button {
    background: #fbe1e1;
    color: #9f2f2f;
    width: 100%;
}

.empty-state {
    border: 1px dashed var(--line);
    border-radius: 18px;
    padding: 18px;
    color: var(--muted);
    background: rgba(255,255,255,0.55);
}

@media (max-width: 900px) {
    .layout,
    .field-grid {
        grid-template-columns: 1fr;
    }

    .hero {
        flex-direction: column;
    }
}
</style>
</head>
<body>
<div class="page">
    <div class="hero">
        <div>
            <h1>Го Лазать!</h1>
            <p>Загрузи фото скалодрома, отметь старт, зацепки и топ, а потом сохрани трассу с названием и сложностью. Все сохранённые линии будут сразу доступны ниже.</p>
        </div>
        <div class="badge" id="activeModeBadge">Режим: Зацепка</div>
    </div>

<h1>🧗 Го Лазать!</h1>
    <div class="layout">
        <section class="panel">
            <h2 class="section-title">Новая трасса</h2>
            <p class="section-subtitle">Сначала выбери фото, затем расставь точки и сохрани маршрут.</p>

<input type="file" id="fileInput" accept="image/*"><br>
            <div class="field-grid">
                <div class="field">
                    <label for="routeName">Название трассы</label>
                    <input id="routeName" type="text" placeholder="Например, Левая плита">
                </div>
                <div class="field">
                    <label for="routeDifficulty">Сложность</label>
                    <select id="routeDifficulty">
                        <option value="Не указана">Не указана</option>
                        <option value="5a">5a</option>
                        <option value="5b">5b</option>
                        <option value="5c">5c</option>
                        <option value="6a">6a</option>
                        <option value="6a+">6a+</option>
                        <option value="6b">6b</option>
                        <option value="6b+">6b+</option>
                        <option value="6c">6c</option>
                        <option value="6c+">6c+</option>
                        <option value="7a">7a</option>
                        <option value="7a+">7a+</option>
                        <option value="7b">7b</option>
                    </select>
                </div>
            </div>

            <div class="upload-row">
                <input class="file-input" type="file" id="fileInput" accept="image/*">
                <button class="secondary-button" onclick="resetEditor()">Очистить разметку</button>
            </div>

<button onclick="setMode('start')">🟢 Старт</button>
<button onclick="setMode('hold')">🔴 Зацепка</button>
<button onclick="setMode('top')">🔵 Топ</button>
<button onclick="undo()">↩️ Отменить</button>
            <div class="toolbar">
                <button class="mode-button" data-mode="start" onclick="setMode('start')">🟢 Старт</button>
                <button class="mode-button" data-mode="hold" onclick="setMode('hold')">🔴 Зацепка</button>
                <button class="mode-button" data-mode="top" onclick="setMode('top')">🔵 Топ</button>
                <button class="secondary-button" onclick="undo()">↩️ Отменить</button>
            </div>

<br>
            <div class="status-row">
                <div id="statusText">Фото ещё не загружено</div>
                <div class="counts">
                    <div class="pill" id="countStart">Старт: 0</div>
                    <div class="pill" id="countHold">Зацепки: 0</div>
                    <div class="pill" id="countTop">Топ: 0</div>
                </div>
            </div>

<canvas id="canvas"></canvas><br>
            <div class="canvas-wrap">
                <canvas id="canvas"></canvas>
            </div>

<button onclick="saveRoute()">💾 Сохранить трассу</button>
            <div class="save-row">
                <button class="primary-button" onclick="saveRoute()">💾 Сохранить трассу</button>
            </div>
        </section>

<h2>Сохранённые трассы</h2>
<div id="routes"></div>
        <section class="panel">
            <h2 class="section-title">Сохранённые трассы</h2>
            <p class="section-subtitle">Здесь можно быстро просмотреть все маршруты и удалить лишние.</p>
            <div id="routes" class="route-list"></div>
        </section>
    </div>
</div>

<script>
let canvas = document.getElementById("canvas");
let points = [];
let currentImage = "";
let mode = "hold";
const modeNames = {
    start: "Старт",
    hold: "Зацепка",
    top: "Топ"
};

function setMode(m){
    mode = m;
    updateToolbar();
}

document.getElementById("fileInput").addEventListener("change", function(e){
        currentImage = data.filename;
        img.src = data.url;
        points = [];
        updateStatus("Фото загружено. Можно размечать трассу.");
        updateCounters();
    });
});


function redraw(){
    ctx.clearRect(0,0,canvas.width,canvas.height);
    ctx.drawImage(img,0,0);
    if (img.src) {
        ctx.drawImage(img,0,0);
    }
    points.forEach(drawPoint);
}

canvas.addEventListener("click", function(e){
    if (!currentImage) {
        alert("Сначала загрузи фото.");
        return;
    }

    let rect = canvas.getBoundingClientRect();
    let x = e.clientX - rect.left;
    let y = e.clientY - rect.top;

    points.push({x,y,type:mode});
    drawPoint({x,y,type:mode});
    updateCounters();
});

function undo(){
    points.pop();
    redraw();
    updateCounters();
}

function resetEditor(){
    points = [];
    currentImage = "";
    img.src = "";
    canvas.width = 0;
    canvas.height = 0;
    document.getElementById("fileInput").value = "";
    document.getElementById("routeName").value = "";
    document.getElementById("routeDifficulty").value = "Не указана";
    updateStatus("Редактор очищен. Загрузи новое фото.");
    updateCounters();
}

function saveRoute(){
    let name = document.getElementById("routeName").value.trim();
    let difficulty = document.getElementById("routeDifficulty").value;

    if (!currentImage || points.length === 0){
        alert("Добавь фото и точки!");
        return;
    }

    if (!name) {
        alert("Добавь название трассы.");
        return;
    }

    fetch("/save_route", {
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body: JSON.stringify({
            name: name,
            difficulty: difficulty,
            image: currentImage,
            points: points
        })
    }).then(()=>{
        alert("Сохранено!");
        resetEditor();
        loadRoutes();
    });
}
        let div = document.getElementById("routes");
        div.innerHTML = "";

        if (data.length === 0) {
            div.innerHTML = '<div class="empty-state">Пока нет сохранённых трасс. Добавь первую разметку слева.</div>';
            return;
        }

        data.forEach(r => {
            let el = document.createElement("div");
            el.className = "route-card";
            el.innerHTML = `
                <img src="${r.url}" width="200"><br>
                точек: ${r.points.length}
                <hr>
                <img src="${r.url}" alt="${r.name}">
                <div class="route-body">
                    <div class="route-top">
                        <h3 class="route-name">${r.name}</h3>
                        <div class="difficulty">${r.difficulty}</div>
                    </div>
                    <div class="route-meta">
                        Точек: ${r.points.length}<br>
                        Создано: ${formatDate(r.created_at)}
                    </div>
                    <button class="delete-button" onclick="deleteRoute('${r.id}')">Удалить трассу</button>
                </div>
            `;
            div.appendChild(el);
        });
    });
}

function deleteRoute(routeId){
    if (!confirm("Удалить эту трассу?")) return;

    fetch(`/routes/${routeId}`, { method: "DELETE" })
    .then(res => {
        if (!res.ok) {
            throw new Error("delete failed");
        }
        loadRoutes();
    })
    .catch(() => alert("Не удалось удалить трассу."));
}

function updateToolbar(){
    document.querySelectorAll(".mode-button").forEach(button => {
        button.classList.toggle("active", button.dataset.mode === mode);
    });
    document.getElementById("activeModeBadge").textContent = `Режим: ${modeNames[mode]}`;
}

function updateCounters(){
    let starts = points.filter(p => p.type === "start").length;
    let holds = points.filter(p => p.type === "hold").length;
    let tops = points.filter(p => p.type === "top").length;

    document.getElementById("countStart").textContent = `Старт: ${starts}`;
    document.getElementById("countHold").textContent = `Зацепки: ${holds}`;
    document.getElementById("countTop").textContent = `Топ: ${tops}`;
}

function updateStatus(text){
    document.getElementById("statusText").textContent = text;
}

function formatDate(value){
    if (!value) return "неизвестно";
    return new Date(value).toLocaleString("ru-RU");
}

updateToolbar();
updateCounters();
loadRoutes();
</script>

    if not data:
        return "bad request", 400

    routes.append(data)
    name = str(data.get("name", "")).strip()
    difficulty = str(data.get("difficulty", "Не указана")).strip() or "Не указана"
    image = data.get("image")
    points = data.get("points")

    if not name or not image or not isinstance(points, list) or not points:
        return jsonify({"error": "invalid route"}), 400

    routes.append({
        "id": str(uuid.uuid4()),
        "name": name,
        "difficulty": difficulty,
        "image": image,
        "points": points,
        "created_at": data.get("created_at") or datetime.utcnow().isoformat(),
    })
    save_data()
    return "ok"

    result = []
    for r in routes:
        result.append({
            "id": r.get("id", ""),
            "name": r.get("name", "Без названия"),
            "difficulty": r.get("difficulty", "Не указана"),
            "url": f"/static/uploads/{r['image']}",
            "points": r["points"],
            "created_at": r.get("created_at"),
        })
    return jsonify(result)


@app.route("/routes/<route_id>", methods=["DELETE"])
def delete_route(route_id):
    global routes

    route_to_delete = next((route for route in routes if route.get("id") == route_id), None)
    if route_to_delete is None:
        return jsonify({"error": "not found"}), 404

    routes = [route for route in routes if route.get("id") != route_id]
    save_data()

    image_name = route_to_delete.get("image")
    if image_name and not any(route.get("image") == image_name for route in routes):
        image_path = os.path.join(UPLOAD_FOLDER, image_name)
        try:
            if os.path.exists(image_path):
                os.remove(image_path)
        except OSError:
            pass

    return jsonify({"status": "deleted"})


if __name__ == "__main__":
    app.run(host="127.0.0.1", port=5000, debug=False)