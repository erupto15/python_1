import json
from config import LOGIN, PASSWORD, COMPANY_ID
from YouGileAPI import YouGileAPI


def test_auth_and_info():
    """Тест: аутентификация + получение информации о компании"""
    api = YouGileAPI(LOGIN, PASSWORD, COMPANY_ID)

    try:
        api.authenticate()
        if api.check_auth():
            company = api.get_company()
            print("\nИнформация о компании:")
            print(json.dumps(company, indent=2, ensure_ascii=False))
    except Exception as e:
        print(f"\n❌ Ошибка: {e}")
