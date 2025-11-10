import pytest
from sqlalchemy import text
from config.database import data_base


def insert_user():
    """Тест: добавление нового студента"""
    db_api = data_base() 
    # ID пользователя для обновления (предполагается, что он уже существует)
    target_user_id = 755
    target_email_id = 'xxxrnr123@mail.ru'
    subject_id = 4 

    # SQL-запрос на добавление
    insert_query = text(f"""
    INSERT INTO users (user_id, user_email, subject_id) 
    VALUES ('{target_user_id}', '{target_email_id}', '{subject_id}')
    RETURNING user_id;
    """)
    try:
        result = db_api.execute_query(insert_query)
        print(result)
    except Exception as e:
        print(f"Ошибка при создании тесьового пользователя: {e}")
        raise
    return target_user_id
    
    
def test_delete_user():
    """Тест: удаление пользователя"""
    db_api = data_base()
    target_user_id = insert_user()

    try:
        # SQL-запрос на удаление с параметризацией
        delete_query = text(
            "DELETE FROM users "
            "WHERE user_id = :user_id "
            "RETURNING user_id, user_email, subject_id;"
        )

        result = db_api.execute_query(
            delete_query,
            {'user_id': target_user_id}
        )

        # Проверяем, что запрос вернул результат
        assert result is not None, "Запрос не вернул результат"
        print(result)
        assert len(result) == 1, "Должно быть удалено 1 значение"

        deleted_user = result[0]
        deleted_user_id = deleted_user[0]
        deleted_email = deleted_user[1]
        #deleted_subject_id = deleted_user[2]

        assert deleted_user_id == target_user_id, (
            f"ID пользователя должен быть {target_user_id}, получено {deleted_user_id}"
        )

        print(f"Пользователь удалён: ID={deleted_user_id}, email={deleted_email}")

    except Exception as e:
        pytest.fail(f"Ошибка при удалении пользователя: {e}")

    finally:
        if db_api.engine:
            db_api.engine.dispose()
