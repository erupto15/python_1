import requests
import unittest

# Конфигурация
LOGIN = "shevchenko.vlad98@mail.ru"
PASSWORD = "skalolaz123"
COMPANY_ID = "45404059-6993-4709-a893-9b10bd6a8403"
BASE_URL = "https://api.yougile.com/api-v2"

# URLs
AUTH_URL = f"{BASE_URL}/auth/keys"
ADD_PROJECT_URL = f"{BASE_URL}/projects"  # URL для добавления нового проекта


class TestYougileAPI(unittest.TestCase):

    def setUp(self):
        """Настройка теста — аутентификация и сохранение ключа"""
        # Запрос на аутентификацию
        auth_data = {
            'login': LOGIN,
            'password': PASSWORD
        }

        response = requests.post(AUTH_URL, data=auth_data)

        self.assertEqual(response.status_code, 200, "Аутентификация не удалась!")

        # Извлекаем API ключ из ответа
        auth_response = response.json()
        self.api_key = auth_response.get('key')
        self.assertIsNotNone(self.api_key, "API ключ не получен!")

    def add_project(self, project_name, project_description):
        """Метод для добавления нового проекта"""
        headers = {
            'Authorization': f'Bearer {self.api_key}',
            'Content-Type': 'application/json'
        }

        # Данные нового проекта
        project_data = {
            'name': project_name,
            'description': project_description,
            'company_id': COMPANY_ID
        }

        response = requests.post(ADD_PROJECT_URL, json=project_data, headers=headers)

        return response

    def test_add_project(self):
        """Тест для добавления нового проекта"""
        project_name = "Новый проект"
        project_description = "Описание нового проекта для тестирования."

        # Добавляем проект
        response = self.add_project(project_name, project_description)

        self.assertEqual(response.status_code, 201, "Проект не был добавлен!")

        # Проверим, что проект был добавлен и содержит нужную информацию
        project_data = response.json()

        self.assertEqual(project_data.get('name'), project_name, "Название проекта не совпадает!")
        self.assertEqual(project_data.get('description'), project_description, "Описание проекта не совпадает!")
        self.assertEqual(project_data.get('company_id'), COMPANY_ID, "ID компании не совпадает!")


if __name__ == "__main__":
    unittest.main()
