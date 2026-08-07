import allure
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC



@allure.feature("Авторизация")
class LoginPage:
    """Страница входа в систему (Saucedemo)."""

    def __init__(self, driver):
        self.driver = driver
        self.wait = WebDriverWait(driver, 10)

    @allure.step("Ввод имени пользователя в поле логина")
    def enter_username(self, username: str):
        """
        Ввести имя пользователя в поле логина.

        Args:
            username (str): Имя пользователя
        """
        locator = (By.ID, "user-name")
        element = self.wait.until(EC.element_to_be_clickable(locator))
        element.clear()
        element.send_keys(username)

    @allure.step("Ввод пароля в поле ввода")
    def enter_password(self, password: str):
        """
        Ввести пароль в поле ввода.

        Args:
            password (str): Пароль
        """
        locator = (By.ID, "password")
        element = self.wait.until(EC.element_to_be_clickable(locator))
        element.clear()
        element.send_keys(password)

    @allure.step("Нажатие кнопки входа")
    def click_login(self):
        """
        Нажать кнопку входа в систему.
        """
        locator = (By.ID, "login-button")
        button = self.wait.until(EC.element_to_be_clickable(locator))
        button.click()
