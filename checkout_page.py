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
        first_name_field = self.driver.find_element(By.ID, "first-name")
        first_name_field.clear()
        first_name_field.send_keys(first_name)

        # Заполняем поле "Фамилия"
        last_name_field = self.driver.find_element(By.ID, "last-name")
        last_name_field.clear()
        last_name_field.send_keys(last_name)

        # Заполняем поле "Почтовый индекс"
        zip_code_field = self.driver.find_element(By.ID, "postal-code")
        zip_code_field.clear()
        zip_code_field.send_keys(zip_code)

        # Логируем введённые данные в отчёт Allure
        allure.attach(
            f"Имя: {first_name}\n"
            f"Фамилия: {last_name}\n"
            f"Почтовый индекс: {zip_code}",
            name="Введённые персональные данные",
            attachment_type=allure.attachment_type.TEXT
        )

    @allure.step("Нажатие кнопки «Продолжить»")
    def click_continue(self):
        """Нажать кнопку «Продолжить» для перехода к подтверждению заказа."""
        locator = (By.ID, "continue")
        button = self.wait.until(EC.element_to_be_clickable(locator))
        button.click()

    @allure.step("Получение итоговой суммы заказа")
    def get_total_price(self) -> str:
        """
        Получить итоговую сумму заказа.

        Returns:
            str: Итоговая сумма (например, "$58.29")
        """
        locator = (By.CLASS_NAME, "summary_total_label")
        price_element = self.wait.until(EC.visibility_of_element_located(locator))
        return price_element.text
