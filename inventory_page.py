import allure
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC



@allure.feature("Каталог товаров")
class InventoryPage:
    """Страница каталога товаров (Saucedemo)."""

    def __init__(self, driver):
        self.driver = driver
        self.wait = WebDriverWait(driver, 10)

    @allure.step("Добавление в корзину: рюкзак Sauce Labs Backpack")
    def add_backpack(self):
        """Добавить рюкзак в корзину."""
        locator = (By.ID, "add-to-cart-sauce-labs-backpack")
        button = self.wait.until(EC.element_to_be_clickable(locator))
        button.click()

    @allure.step("Добавление в корзину: футболка Sauce Labs Bolt T‑Shirt")
    def add_bolt_tshirt(self):
        """Добавить футболку в корзину."""
        locator = (By.ID, "add-to-cart-sauce-labs-bolt-t-shirt")
        button = self.wait.until(EC.element_to_be_clickable(locator))
        button.click()

    @allure.step("Добавление в корзину: комбинезон Sauce Labs Onesie")
    def add_onesie(self):
        """Добавить комбинезон в корзину."""
        locator = (By.ID, "add-to-cart-sauce-labs-onesie")
        button = self.wait.until(EC.element_to_be_clickable(locator))
        button.click()

    @allure.step("Переход в корзину")
    def go_to_cart(self):
        """Нажать на иконку корзины для перехода к оформлению заказа."""
        locator = (By.CLASS_NAME, "shopping_cart_link")
        link = self.driver.find_element(*locator)
        link.click()
