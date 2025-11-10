import pytest
from sqlalchemy import text
from config.database import data_base


def test_insert_users():
    """Тест: добавление нового студента"""
    db_api = data_base() 
    # SQL-запрос на добавление
    insert_query = text("""
        INSERT INTO users (user_id, user_email, subject_id) 
        VALUES ('75', 'annapiunova@mail.ru', '3')
        RETURNING user_id;
    """)

    try:
        result = db_api.execute_query(insert_query)
        print(result)

        # Проверяем, что запрос вернул результат
        assert result is not None, "Запрос не вернул результат"

        # Проверяем, что вернулась ровно одна строка
        assert len(result) == 1, "Должно быть возвращено 1 значение (user_id)"

        user_id = result[0][0]
        print(user_id)

        # Проверяем, что ID — положительное число
        assert user_id > 0, "ID студента должен быть положительным числом"

        print(f"Студент добавлен, ID: {user_id}")

    finally:
        # Закрываем соединение после теста (даже если тест упал)
        if db_api.engine:
            db_api.engine.dispose()
        
    
   