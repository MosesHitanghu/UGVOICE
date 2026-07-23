"""Password hashing helpers backed by bcrypt.

Stored passwords are bcrypt hashes (see ``users.password``). Never store or
compare plaintext passwords directly.
"""

import bcrypt


# bcrypt only uses the first 72 bytes of the input; longer passwords are
# truncated to that length before hashing/verifying so both sides agree.
_MAX_BCRYPT_BYTES = 72


def _encode(password: str) -> bytes:
    return password.encode("utf-8")[:_MAX_BCRYPT_BYTES]


def hash_password(plain_password: str) -> str:
    """Hash a plaintext password and return the bcrypt hash as a string."""
    return bcrypt.hashpw(_encode(plain_password), bcrypt.gensalt()).decode("utf-8")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Return True when the plaintext matches the stored bcrypt hash."""
    if not plain_password or not hashed_password:
        return False
    try:
        return bcrypt.checkpw(_encode(plain_password), hashed_password.encode("utf-8"))
    except (ValueError, TypeError):
        # Raised when the stored value is not a valid bcrypt hash.
        return False


def is_bcrypt_hash(value: str) -> bool:
    """Return True when the value looks like a bcrypt hash (already hashed)."""
    return isinstance(value, str) and value.startswith(("$2a$", "$2b$", "$2y$"))
