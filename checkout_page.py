import allure
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC



@allure.feature("Оформление заказа")
class CheckoutPage:
    """Страница оформления заказа (Saucedemo)."""

    def __init__(self, driver):
        self.driver = driver
        self.wait = WebDriverWait(driver, 10)

    @allure.step("Заполнение персональных данных")
    def fill_personal_info(self, first_name: str, last_name: str, zip_code: str):
        """
        Заполнить форму персональными данными.

        Args:
            first_name (str): Имя
            last_name (str): Фамилия
            zip_code (str): Почтовый индекс
        """
        # Заполняем поле "Имя"
        first_name_field = self.driver.find_element(By.ID,
