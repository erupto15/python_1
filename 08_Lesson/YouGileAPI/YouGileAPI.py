import requests
from .config import BASE_URL, AUTH_URL, COMPANY_INFO_URL



# === КЛАСС ДЛЯ РАБОТЫ С API ===
class YouGileAPI:
    def __init__(self, login: str, password: str, company_id: str):
        self.login = login
        self.password = password
        self.company_id = company_id
        self.base_url = BASE_URL
        self.api_key = None



    def authenticate(self) -> None:
        """Получаем API‑ключ"""
        payload = {
            "login": self.login,
            "password": self.password,
            "companyId": self.company_id
        }
        headers = {"Content-Type": "application/json"}



        try:
            response = requests.post(AUTH_URL, json=payload, headers=headers)
            if response.status_code in (200, 201):
                self.api_key = response.json()["key"]
                print("✅ Аутентификация успешна. API‑ключ получен.")
            else:
                raise Exception(f"Ошибка аутентификации: {response.status_code} {response.text}")
        except Exception as e:
            raise Exception(f"Сетевая ошибка: {e}")



    def check_auth(self) -> bool:
        """Проверяем наличие API‑ключа"""
        return self.api_key is not None



    def get_company(self) -> dict:
        """Получаем данные компании по ID"""
        if not self.api_key:
            raise Exception("API‑ключ не получен. Вызовите authenticate() сначала.")



        headers = {"Authorization": self.api_key}
        response = requests.get(COMPANY_INFO_URL, headers=headers)



        if response.status_code == 200:
            return response.json()
        else:
            raise Exception(f"Ошибка получения компании: {response.status_code} {response.text}")



    def add_project(self, title: str, description: str = "") -> dict:
        """Добавляем проект в компанию"""
        if not self.api_key:
            raise Exception("API‑ключ не получен. Вызовите authenticate() сначала.")



        url = f"{self.base_url}/companies/{self.company_id}/projects"
        headers = {
            "Authorization": self.api_key,
            "Content-Type": "application/json"
        }
        payload = {"title": title, "description": description}



        response = requests.post(url, json=payload, headers=headers)



        if response.status_code == 201:
            data = response.json()
            print(f"✅ Проект создан! ID: {data['id']}")
            return data
        else:
            raise Exception(f"Ошибка создания проекта: {response.status_code} {response.text}")



    def update_company(self, name=None, description=None, is_active=None) -> dict:
        """Обновляем компанию (частично)"""
        if not self.api_key:
            raise Exception("API‑ключ не получен. Вызовите authenticate() сначала.")



        url = f"{self.base_url}/companies/{self.company_id}"
        headers = {
            "Authorization": self.api_key,
            "Content-Type": "application/json"
        }



        payload = {}
        if name is not None:
            payload["name"] = name
        if description is not None:
            payload["description"] = description
        if is_active is not None:
            payload["is_active"] = is_active



        response = requests.patch(url, json=payload, headers=headers)



        if response.status_code == 200:
            print("✅ Компания обновлена успешно.")
            return response.json()
        else:
            raise Exception(f"Ошибка обновления: {response.status_code} {response.text}")