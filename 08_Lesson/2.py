import requests
import unittest

# Конфигурация
LOGIN = "shevchenko.vlad98@mail.ru"
PASSWORD = "skalolaz123"
COMPANY_ID = "45404059-6993-4709-a893-9b10bd6a8403"
BASE_URL = "https://api.yougile.com/api-v2"

# URLs
AUTH_URL = f"{BASE_URL}/auth/keys"
COMPANY_INFO_URL = f"{BASE_URL}/companies/{COMPANY_ID}"
UPDATE_COMPANY_URL = f"{BASE_URL}/companies/{COMPANY_ID}"


class TestYougileAPI(unittest.TestCase):

    def setUp(self):
        """Настройка теста — аутентификация и сохранение ключа"""
        # Получаем API-ключ
        self.api_key = self.authenticate()

    def authenticate(self):
        """Метод для аутентификации и получения API-ключа"""
        auth_data = {
            'login': LOGIN,
            'password': PASSWORD
        }

        response = requests.post(AUTH_URL, data=auth_data)

        if response.status_code != 200:
            self.fail(f"Аутентификация не удалась! Статус код: {response.status_code}")

        auth_response = response.json()
        api_key = auth_response.get('key')

        if not api_key:
            self.fail("Не удалось получить API ключ!")

        return api_key

    def get_company_info(self):
        """Метод для получения информации о компании"""
        headers = {
            'Authorization': f'Bearer {self.api_key}'
        }

        response = requests.get(COMPANY_INFO_URL, headers=headers)

        if response.status_code != 200:
            self.fail(f"Не удалось получить информацию о компании! Статус код: {response.status_code}")

        return response.json()

    def update_company_info(self, updated_data):
        """Метод для обновления информации о компании"""
        headers = {
            'Authorization': f'Bearer {self.api_key}',
            'Content-Type': 'application/json'
        }

        response = requests.put(UPDATE_COMPANY_URL, json=updated_data, headers=headers)

        if response.status_code != 200:
            self.fail(f"Не удалось обновить информацию о компании! Статус код: {response.status_code}")

        return response.json()

    def test_auth_company(self):
        """Тест для получения информации о компании"""
        company_data = self.get_company_info()

        # Проверяем, что данные компании содержат нужную информацию
        self.assertEqual(company_data.get('id'), COMPANY_ID,
                         f"Ожидался ID компании {COMPANY_ID}, но получен {company_data.get('id')}")
        self.assertIn('name', company_data, "Компания не содержит поле 'name'!")
        self.assertIn('status', company_data, "Компания не содержит поле 'status'!")

    def test_update_company(self):
        """Тест для обновления данных компании"""
        updated_data = {
            'name': 'Обновленное название компании',
            'status': 'active',  # Статус может быть "active" или другой в зависимости от API
            'description': 'Обновленное описание компании для теста'
        }

        company_data = self.update_company_info(updated_data)

        # Проверяем, что данные компании обновились
        self.assertEqual(company_data.get('name'), updated_data['name'], "Название компании не обновилось!")
        self.assertEqual(company_data.get('status'), updated_data['status'], "Статус компании не обновился!")
        self.assertEqual(company_data.get('description'), updated_data['description'],
                         "Описание компании не обновилось!")


if __name__ == "__main__":
    unittest.main()
