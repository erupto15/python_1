from sqlalchemy import create_engine
from sqlalchemy.exc import SQLAlchemyError


class SQLAPI:
    def __init__(self, user: str, password: str, host: str, data_base_name: str, port: int = 5433):
        self.user = user
        self.password = password
        self.host = host
        self.data_base_name = data_base_name
        self.port = port
        self.api_key = None
        self.engine = None

    def connect(self):
        """Создаёт движок SQLAlchemy и проверяет подключение."""
        try:
            # Формируем строку подключения
            # db_connection_string = "postgresql://postgres:12345@localhost:5432/PostgreSQL"
#db = create_engine(db_connection_string)
            db_connection_string = "postgresql://" + self.user + ":" + self.password + "@" + self.host + ":" + str(self.port) + "/" + self.data_base_name 
          
            
            self.engine = create_engine(db_connection_string)
            
            # Проверяем подключение
            with self.engine.connect() as conn:
                print("Подключение к БД успешно установлено!")
            return True
        except SQLAlchemyError as e:
            print(f"Ошибка подключения к БД: {e}")
            return False

    def execute_query(self, query: str, params: dict = None):
        """Выполняет SQL-запрос и возвращает результаты."""
        if not self.engine:
            print("Нет подключения к БД. Сначала вызовите connect().")
            return None

        try:
            with self.engine.connect() as conn:
                if params is not None:
                    # Если параметры переданы — используем их
                    result = conn.execute(query, params)
                else:
                    # Если параметров нет — выполняем запрос без них
                    result = conn.execute(query)
                return result.fetchall()
        except SQLAlchemyError as e:
            print(f"Ошибка выполнения запроса: {e}")
            return None


def data_base():
    """Функция для инициализации подключения."""
    user = "postgres"
    password = "12345"  
    host = "localhost"
    data_base_name = "postgres"  
    port = 5433  

    # Создаём экземпляр API
    db_api = SQLAPI(user, password, host, data_base_name, port)
    
    # Устанавливаем соединение
    if db_api.connect():
        # Пример запроса
        result = db_api.execute_query("SELECT version();")
        if result:
            print("Версия PostgreSQL:", result[0][0])
    
    return db_api

# Запуск
if __name__ == "__main__":
    db = data_base()
