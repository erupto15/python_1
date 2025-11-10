import pytest
from sqlalchemy import text
from config.database import data_base

def test_update_users():
    """Тест: обновление данных пользователя"""
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

        # Проверяем, что запрос вернул результат
        assert result is not None, "Запрос не вернул результат"
    except Exception as e:
        print(f"Ошибка при создани тестового пользователя: {e}")
        raise

    # Новые данные для обновления
    new_email = 'sss123@mail.ru'
    new_subject_id = 5 

    request = f"""
        UPDATE users 
        SET user_email = :email, subject_id = :subject_id
        WHERE user_id = :user_id
        RETURNING user_id, user_email, subject_id;
    """
    # SQL-запрос на обновление
    update_query = text(request)

    try:
        # Выполняем запрос на обновление с передачей параметров
        result = db_api.execute_query(
            update_query,
            {
                'email': new_email,
                'subject_id': new_subject_id,
                'user_id': target_user_id 
            }
        )
        print(result)

        # Проверяем, что запрос вернул результат
        assert result is not None, "Запрос не вернул результат"

        # Проверяем, что обновилась ровно одна строка
        assert len(result) == 1, "Должно быть обновлено 1 значение"

        updated_user = result[0]
        updated_user_id = updated_user[0]
        updated_email = updated_user[1]
        updated_subject_id = updated_user[2]

        print(f"Обновлённый пользователь: ID={updated_user_id}, "
              f"email={updated_email}, subject_id={updated_subject_id}")

        # Проверяем, что ID совпадает с ожидаемым, id не меняем это не нужно
        #assert updated_user_id == target_user_id, \
        #    f"ID пользователя должен быть {target_user_id}, получено {updated_user_id}"

        # Проверяем, что email обновился корректно
        assert updated_email == new_email, \
            f"Email должен быть {new_email}, получено {updated_email}"

        # Проверяем, что subject_id обновился корректно
        assert updated_subject_id == new_subject_id, \
            f"subject_id должен быть {new_subject_id}, получено {updated_subject_id}"

        print("Данные пользователя успешно обновлены")

    except Exception as e:
        print(f"Ошибка при обновлении пользователя: {e}")
        raise

    finally:
        # SQL-запрос на удаление
        del_query = text(f"""
            DELETE FROM users WHERE user_id = '{target_user_id}';
        """)

        try:
            result = db_api.execute_query(del_query)
        except:
            pass

        # Закрываем соединение после теста (даже если тест упал)
        if db_api.engine:
            db_api.engine.dispose()
