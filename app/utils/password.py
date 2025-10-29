import os
from logging import getLogger

log = getLogger('uvicorn')


def password_exists() -> bool:
    return os.path.exists('password.txt')


def get_password() -> str | None:
    try:
        with open('password.txt', 'rt') as f:
            return f.read()
    except FileNotFoundError:
        return None
