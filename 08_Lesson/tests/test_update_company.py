import json
from API.YouGileAPI import YouGileAPI
from API.config import LOGIN, PASSWORD, COMPANY_ID


def test_update_company():
    """Тест: обновление компании"""
    api = credentials(LOGIN, PASSWORD, COMPANY_ID)

    try:
        api.authenticate()
        updated = api.update_company(
            name="Обновлённое название",
            description="Новое описание",
            is_active=True
        )
        print("\nОбновлённые данные:")
        print(json.dumps(updated, indent=2, ensure_ascii=False))
    except Exception as e:
        print(f"\n❌ Ошибка: {e}")