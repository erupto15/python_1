import pytest
import allure
from selenium import webdriver
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.common.by import By
from login_page import LoginPage
from inventory_page import InventoryPage
from cart_page import CartPage
from checkout_page import CheckoutPage


@pytest.fixture(scope="class")
def driver():
    """Фикстура: создаёт и настраивает WebDriver, закрывает после тестов."""
    driver = webdriver.Chrome()
    driver.get("https://www.saucedemo.com/")
    wait = WebDriverWait(driver, 10)
    
    yield driver, wait  # Передаём driver и wait в тестовый класс
    
    driver.quit()  # Закрываем браузер после всех тестов класса



@allure.feature("Shop Flow")
@allure.severity(allure.severity_level.CRITICAL)
@pytest.mark.usefixtures("driver")
class TestShopFlow:
    """Тест-класс для проверки полного потока покупки на saucedemo.com."""

    @allure.title("Проверка потока покупки: авторизация → добавление товаров → оформление заказа")
    @allure.description("Полный сценарий: вход в систему, добавление 3 товаров в корзину, заполнение данных и проверка итоговой суммы.")
    def test_purchase_flow(self, driver):
        driver, wait = driver  # Получаем driver и wait из фикстуры

        # 1. Авторизация
        with allure.step("Авторизация с учётными данными standard_user / secret_sauce"):
            login_page = LoginPage(driver)
            login_page.enter_username("standard_user")
            login_page.enter_password("secret_sauce")
            login_page.click_login()

        # Проверка успешной авторизации
        with allure.step("Проверка перехода на страницу инвентаря после входа"):
            wait.until(EC.url_contains("inventory"))
            assert "inventory" in driver.current_url, "Не удалось войти в систему"

        # 2. Добавление товаров
        with allure.step("Добавление в корзину: рюкзак, футболка, комбинезон"):
            inventory_page = InventoryPage(driver)
            inventory_page.add_backpack()
            inventory_page.add_bolt_tshirt()
            inventory_page.add_onesie()

        # 3. Переход в корзину и проверка товаров
        with allure.step("Переход в корзину и проверка количества товаров"):
            inventory_page.go_to_cart()
            cart_items = driver.find_elements(By.CLASS_NAME, "cart_item")
            assert len(cart_items) == 3, "В корзине должно быть 3 товара"

        # 4. Checkout
        with allure.step("Начало оформления заказа (кнопка Checkout)"):
            cart_page = CartPage(driver)
            cart_page.click_checkout()

        # 5. Заполнение формы
        with allure.step("Заполнение персональных данных: Иван Иванов, 12345"):
            checkout_page = CheckoutPage(driver)
            checkout_page.fill_personal_info(
                first_name="Иван",
                last_name="Иванов",
                zip_code="12345"
            )
            checkout_page.click_continue()

        # 6. Проверка итоговой суммы
        with allure.step("Проверка итоговой суммы заказа"):
            total_price = checkout_page.get_total_price()
            expected_total = "$58.29"
            assert total_price == expected_total, \
                f"Ожидаемая сумма: {expected_total}, фактическая: {total_price}"
