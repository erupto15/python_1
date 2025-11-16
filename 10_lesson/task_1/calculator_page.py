import allure 
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC

@allure.title
@allure.description
@allure.feature
@allure.severity
class CalculatorPage:

    allure.step ("Ожидание работы 60 сек") 
    def __init__(self, driver):
        self.driver = driver
        self.wait = WebDriverWait(driver, 60) # ожидание до 60 сек
        # локаторы элементов
        self.delay_input = (By.ID, "delay")
        self.button_7 = (By.XPATH, "//span[text()='7']")
        self.button_plus = (By.XPATH, "//span[text()='+']")
        self.button_8 = (By.XPATH, "//span[text()='8']")
        self.button_equals = (By.XPATH, "//span[text()='=']")
        self.result_screen = (By.CLASS_NAME, "screen")
        

    allure.step ("Ожидание работы функции") 
    def set_delay (self, seconds):
        element = self.driver.find_element(*self.delay_input)
        element.clear()
        element.send_keys(str(seconds))
        
    allure.step ("Нажатие кнопки 7") 
    def click_seven(self):
        # Нажатие кнопки 7
        self.driver.find_element(*self.button_7).click()
    
    allure.step ("Нажатие кнопки +") 
    def click_plus(self):
        # нажатие кнопки плюс
        self.driver.find_element(*self.button_plus).click()

    allure.step ("Нажатие кнопки 8") 
    def click_eight(self):
        # Нажатие кнопки 8
        self.driver.find_element(*self.button_8).click()

    allure.step ("Нажать кнопку =") 
    def click_equals(self):
        # Нажатие кнопки
        self.driver.find_element(*self.button_equals).click()

    allure.step ("Получение результата") 
    def get_result(self):
        """Получение результата с ожиданием""" 
        self.wait.until(
            EC.text_to_be_present_in_element(self.result_screen, "15")
        )
        return self.driver.find_element(*self.result_screen).text