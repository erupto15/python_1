import json
from config import LOGIN, PASSWORD, COMPANY_ID
from YouGileAPI import YouGileAPI


def test_update_company():
    """Тест: обновление компании"""
    api = YouGileAPI(LOGIN, PASSWORD, COMPANY_ID)

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
