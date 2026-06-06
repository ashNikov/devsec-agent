"""
Token encryption/decryption using AES-256 (Fernet).
Tokens are encrypted before storing in DB and decrypted when retrieved.
"""
import os
import base64
from cryptography.fernet import Fernet
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC

def _get_fernet() -> Fernet:
    key = os.getenv("TOKEN_ENCRYPTION_KEY", "") or os.getenv("JWT_SECRET_KEY", "agentsec-default-key-change-in-prod")
    kdf = PBKDF2HMAC(algorithm=hashes.SHA256(), length=32, salt=b"agentsec-salt-v1", iterations=100000)
    derived = base64.urlsafe_b64encode(kdf.derive(key.encode()))
    return Fernet(derived)

def encrypt_token(token: str) -> str:
    if not token:
        return token
    try:
        return _get_fernet().encrypt(token.encode()).decode()
    except Exception:
        return token

def decrypt_token(encrypted: str) -> str:
    if not encrypted:
        return encrypted
    try:
        return _get_fernet().decrypt(encrypted.encode()).decode()
    except Exception:
        return encrypted
