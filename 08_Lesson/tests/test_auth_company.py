import json
from API.YouGileAPI import YouGileAPI
from API.config import LOGIN, PASSWORD, COMPANY_ID


def test_auth_and_info():
    """Тест: аутентификация + получение информации о компании"""
    api = Config(LOGIN, PASSWORD, COMPANY_ID)

    try:
        api.authenticate()
        if api.check_auth():
            company = api.get_company()
            print("\nИнформация о компании:")
            print(json.dumps(company, indent=2, ensure_ascii=False))
    except Exception as e:
        print(f"\n❌ Ошибка: {e}")