import allure 
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC


@allure.title
@allure.description
@allure.feature
@allure.severity
class CartPage:

    allure.step (f"Запуск работы, ожидание 10 сек {driver}")
    def __init__(self, driver):
        self.driver = driver
        self.wait = WebDriverWait(driver, 10)

    @allure.step(f"Получение данных {ID}, {checkout}")
    def click_checkout(self):
        locator = (By.ID, "checkout")
        button = self.wait.until(EC.element_to_be_clickable(locator))
        button.click()

    @allure.step (f"Проверка корзины {CLASS_NAME}, {cart_item}") 
    def get_cart_items(self):
        # Для проверки содержимого корзины (опционально)
        locator = (By.CLASS_NAME, "cart_item")
        return self.driver.find_elements(*locator)

    @allure.step (f"ПОлучение кол-ва товаров в корзине {cart_items}")
    def get_cart_count(self):
        # Получить количество товаров в корзине. Возвращает целое число
        items = self.get_cart_items()
        return len(items)

    @allure.step (f"Проверка пустой корзины {wait}, {CLASS_NAME}, {cart_item}")
    def is_empty(self):
        """
        Проверить, пуста ли корзина.
        Возвращает True, если товаров нет.
        """
        try:
            self.wait.until(EC.invisibility_of_element_located((By.CLASS_NAME, "cart_item")))
            return True
        except:
            return len(self.get_cart_items()) == 0
