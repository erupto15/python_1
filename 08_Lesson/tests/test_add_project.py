import json
from API.YouGileAPI import YouGileAPI
from API.Config import LOGIN, PASSWORD, COMPANY_ID




def test_add_project():
    """Тест: добавление проекта"""
    api = YouGileAPI(LOGIN, PASSWORD, COMPANY_ID)



    try:
        api.authenticate()
        project = api.add_project("Тест‑проект", "Описание теста")
        print("\nСозданный проект:")
        print(json.dumps(project, indent=2, ensure_ascii=False))
    except Exception as e:
        print(f"\n❌ Ошибка: {e}")


