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


def create_access_token(subject_user_id: str, token_version: int = 0) -> str:
    expire_ts = int(time.time()) + settings.access_token_expire_minutes * 60
    payload = {"sub": subject_user_id, "exp": expire_ts, "tv": int(token_version or 0)}
    return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)


def decode_access_token(token: str) -> tuple[str, int]:
    """Возвращает (user_id, token_version). Токены без `tv` (выданы до введения версий) — версия 0."""
    try:
        payload = jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_algorithm])
        sub = payload.get("sub")
        if not isinstance(sub, str) or not sub:
            raise JWTError("missing sub")
        version = payload.get("tv", 0)
        if isinstance(version, bool) or not isinstance(version, int):
            raise JWTError("bad tv")
        return sub, version
    except JWTError as e:
        raise ValueError(str(e)) from e
