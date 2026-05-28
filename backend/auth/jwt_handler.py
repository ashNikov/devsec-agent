from jose import JWTError, jwt
from datetime import datetime, timedelta
import os

ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 43200

def _get_secret_key() -> str:
    """Always read from environment — never cache at import time."""
    return os.environ.get("JWT_SECRET_KEY", "changeme-use-secret-manager-in-prod")

def create_access_token(data: dict) -> str:
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, _get_secret_key(), algorithm=ALGORITHM)

def verify_access_token(token: str) -> dict | None:
    try:
        payload = jwt.decode(token, _get_secret_key(), algorithms=[ALGORITHM])
        return payload
    except JWTError:
        return None
