import allure
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC



@allure.feature("Корзина")
class CartPage:
    """Страница корзины (Saucedemo)."""

    def __init__(self, driver):
        self.driver = driver
        self.wait = WebDriverWait(driver, 10)

    @allure.step("Переход к оформлению заказа (кнопка Checkout)")
    def click_checkout(self):
        """
        Нажать кнопку перехода к оформлению заказа.
        """
        locator = (By.ID, "checkout")
        button = self.wait.until(EC.element_to_be_clickable(locator))
        button.click()

    @allure.step("Получение списка товаров в корзине")
    def get_cart_items(self):
        """
        Получить список элементов товаров в корзине.

        Returns:
            list: Список WebElement товаров в корзине
        """
        locator = (By.CLASS_NAME, "cart_item")
        return self.driver.find_elements(*locator)

    @allure.step("Получение количества товаров в корзине")
    def get_cart_count(self) -> int:
        """
        Получить количество товаров в корзине.

        Returns:
            int: Количество товаров
        """
        items = self.get_cart_items()
        return len(items)

    @allure.step("Проверка, пуста ли корзина")
    def is_empty(self) -> bool:
        """
        Проверить, пуста ли корзина.

        Returns:
            bool: True, если корзина пуста, False — если есть товары
        """
        try:
            # Проверяем, что элементы товаров не видны (полностью отсутствуют или скрыты)
            self.wait.until(
                EC.invisibility_of_element_located((By.CLASS_NAME, "cart_item"))
            )
            return True
        except:
            # Если ожидание провалилось, проверяем количество элементов напрямую
            return len(self.get_cart_items()) == 0
