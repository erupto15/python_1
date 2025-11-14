import allure 
import unittest
from selenium import webdriver
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.common.by import By
from login_page import LoginPage
from inventory_page import InventoryPage
from cart_page import CartPage
from checkout_page import CheckoutPage


@allure.title
@allure.description
@allure.feature 
@allure.severity
class TestShopFlow(unittest.TestCase):

    allure.step ("Ожидание загрузки 10 сек {wait}")
    def setUp(self):
        self.driver = webdriver.Chrome()
        self.driver.get("https://www.saucedemo.com/")
        self.wait = WebDriverWait(self.driver, 10)

    def tearDown(self):
        self.driver.quit()

    allure.step ("Авторизация {LoginPage}, {username}, {password}")
    allure.step ("Проверка авторизации {wait}")
    allure.step ("Добавление товаров {InventoryPage}, {add_backpack}, {add_bolt_tshirt}, {add_oneside}") 
    allure.step ("Корзина товаров {cart_items}, {CLASS_NAME}")
    allure.step ("Итог суммы {Cardpage}")
    allure.step ("Заполнение данных {first_name}, {last_name}, {zip_code} ")
    allure.step ("Проверка итоговой суммыn {total_price}") 
    def test_purchase_flow(self):
        # 1. Авторизация
        login_page = LoginPage(self.driver)
        login_page.enter_username("standard_user")
        login_page.enter_password("secret_sauce")
        login_page.click_login()

        # Проверка успешной авторизации
        self.wait.until(EC.url_contains("inventory"))
        self.assertTrue("inventory" in self.driver.current_url, "Не удалось войти в систему")

        # 2. Добавление товаров
        inventory_page = InventoryPage(self.driver)
        inventory_page.add_backpack()
        inventory_page.add_bolt_tshirt()
        inventory_page.add_onesie()

        # 3. Переход в корзину и проверка товаров
        inventory_page.go_to_cart()
        cart_items = self.driver.find_elements(By.CLASS_NAME, "cart_item")
        self.assertEqual(len(cart_items), 3, "В корзине должно быть 3 товара")

        # 4. Checkout
        cart_page = CartPage(self.driver)
        cart_page.click_checkout()

        # 5. Заполнение формы
        checkout_page = CheckoutPage(self.driver)
        checkout_page.fill_personal_info(
            first_name="Иван",
            last_name="Иванов",
            zip_code="12345"
        )
        checkout_page.click_continue()

        # 6. Проверка итоговой суммы
        total_price = checkout_page.get_total_price()
        expected_total = "$58.29"

        self.assertEqual(
            total_price,
            expected_total,
            f"Ожидаемая сумма: {expected_total}, фактическая: {total_price}"
        )


if __name__ == "__main__":
    unittest.main()