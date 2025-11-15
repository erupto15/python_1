import allure
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC


@allure.title
@allure.description
@allure.feature
@allure.severity
class InventoryPage:

    @allure.step (f"Ожидание 10 сек {wait}")
    def __init__(self, driver):
        self.driver = driver
        self.wait = WebDriverWait(driver, 10)

    @allure.step (f"Добавить товар {add_backpack}")
    def add_backpack(self):
        locator = (By.ID, "add-to-cart-sauce-labs-backpack")
        button = self.wait.until(EC.element_to_be_clickable(locator))
        button.click()
    
    @allure.step (f"Добавить товар {add_bolt_tshirt}")
    def add_bolt_tshirt(self):
        locator = (By.ID, "add-to-cart-sauce-labs-bolt-t-shirt")
        button = self.wait.until(EC.element_to_be_clickable(locator))
        button.click()

    @allure.step (f"Добавление карты {add_to_cart}")
    def add_onesie(self):
        locator = (By.ID, "add-to-cart-sauce-labs-onesie")
        button = self.wait.until(EC.element_to_be_clickable(locator))
        button.click()

    @allure.step (f"Применение карты {shoping_cart}")
    def go_to_cart(self):
        locator = (By.CLASS_NAME, "shopping_cart_link")
        link = self.driver.find_element(*locator)
        link.click()
