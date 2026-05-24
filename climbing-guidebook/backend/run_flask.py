#!/usr/bin/env python3
"""Запуск Flask с инициализацией БД: python run_flask.py"""

from flask_app import create_app, init_database

app = create_app()

if __name__ == "__main__":
    init_database()
    app.run(host="0.0.0.0", port=8001, debug=True)
