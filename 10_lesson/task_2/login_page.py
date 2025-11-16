import allure
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC

@allure.title
@allure.description
@allure.feature
@allure.severity
class LoginPage:

    @allure.step (f"Ожидание работы 10 сек {driver}")
    def __init__(self, driver):
        self.driver = driver
        self.wait = WebDriverWait(driver, 10)

    @allure.step (f"Ввод имени в поле логина {ID}, {username}")
    def enter_username(self, username):
        """
        Ввести имя пользователя в поле логина.

        Args:
            username (str): Имя пользователя
        """
        locator = (By.ID, "user-name")
        element = self.wait.until(EC.element_to_be_clickable(locator))
        element.clear()  # Очистка поля
        element.send_keys(username)

    @allure.step (f"Ввод пароля в поле ввода {ID}:{password}")
    def enter_password(self, password):

        """Ввести пароль в поле ввода.

        Args:
            password (str): Пароль
        """
        locator = (By.ID, "password")
        element = self.wait.until(EC.element_to_be_clickable(locator))
        element.clear()  # Очистка поля
        element.send_keys(password)

    @allure.step (f"Нажатие кнопки входа {ID}:{button}")
    def click_login(self):
        """
        Нажать кнопку входа в систему.
        """
        locator = (By.ID, "login-button")
        button = self.wait.until(EC.element_to_be_clickable(locator))
        button.click()