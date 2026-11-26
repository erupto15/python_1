import time

import bcrypt
from jose import JWTError, jwt

from app.config import settings


_BCRYPT_MAX_BYTES = 72


def _bcrypt_input(plain: str) -> bytes:
    # bcrypt>=5 падает на паролях длиннее 72 байт; старые версии молча обрезали — сохраняем то же поведение.
    return plain.encode("utf-8")[:_BCRYPT_MAX_BYTES]


def hash_password(plain: str) -> str:
    return bcrypt.hashpw(_bcrypt_input(plain), bcrypt.gensalt()).decode("ascii")


def verify_password(plain: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(_bcrypt_input(plain), hashed.encode("ascii"))
    except ValueError:
        return False


def create_access_token(subject_user_id: str) -> str:
    expire_ts = int(time.time()) + settings.access_token_expire_minutes * 60
    payload = {"sub": subject_user_id, "exp": expire_ts}
    return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)


def decode_access_token(token: str) -> str:
    try:
        payload = jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_algorithm])
        sub = payload.get("sub")
        if not isinstance(sub, str) or not sub:
            raise JWTError("missing sub")
        return sub
    except JWTError as e:
        raise ValueError(str(e)) from e
