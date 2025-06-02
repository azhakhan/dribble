import os
import base64
from typing import Optional
from cryptography.fernet import Fernet
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC


class PasswordEncryption:
    """
    A class to handle password encryption and decryption using Fernet symmetric encryption.

    The encryption key is derived from a secret provided via environment variable
    using PBKDF2 key derivation function for additional security.
    """

    def __init__(self):
        self._fernet: Optional[Fernet] = None
        self._initialize_encryption()

    def _initialize_encryption(self) -> None:
        """
        Initialize the Fernet encryption instance using a key derived from environment variable.

        Raises:
            ValueError: If ENCRYPTION_SECRET environment variable is not set
            Exception: If there's an error initializing the encryption
        """
        secret = os.getenv("ENCRYPTION_SECRET")
        if not secret:
            raise ValueError(
                "ENCRYPTION_SECRET environment variable must be set. "
                "Generate a secure secret using: python -c 'import secrets; print(secrets.token_urlsafe(32))'"
            )

        try:
            # Use a fixed salt for key derivation (in production, consider using a configurable salt)
            salt = b"dribble_password_salt"  # 26 bytes

            # Derive a key from the secret using PBKDF2
            kdf = PBKDF2HMAC(
                algorithm=hashes.SHA256(),
                length=32,
                salt=salt,
                iterations=100000,  # OWASP recommended minimum
            )
            key = base64.urlsafe_b64encode(kdf.derive(secret.encode()))
            self._fernet = Fernet(key)

        except Exception as e:
            raise Exception(f"Failed to initialize password encryption: {str(e)}") from e

    def encrypt_password(self, password: str) -> str:
        """
        Encrypt a plain text password.

        Args:
            password: The plain text password to encrypt

        Returns:
            The encrypted password as a base64-encoded string

        Raises:
            ValueError: If password is empty or None
            Exception: If encryption fails
        """
        if not password:
            raise ValueError("Password cannot be empty or None")

        if not self._fernet:
            raise Exception("Encryption not initialized")

        try:
            encrypted_bytes = self._fernet.encrypt(password.encode("utf-8"))
            return base64.urlsafe_b64encode(encrypted_bytes).decode("utf-8")
        except Exception as e:
            raise Exception(f"Failed to encrypt password: {str(e)}") from e

    def decrypt_password(self, encrypted_password: str) -> str:
        """
        Decrypt an encrypted password.

        Args:
            encrypted_password: The encrypted password as a base64-encoded string

        Returns:
            The decrypted plain text password

        Raises:
            ValueError: If encrypted_password is empty or None
            Exception: If decryption fails
        """
        if not encrypted_password:
            raise ValueError("Encrypted password cannot be empty or None")

        if not self._fernet:
            raise Exception("Encryption not initialized")

        try:
            encrypted_bytes = base64.urlsafe_b64decode(encrypted_password.encode("utf-8"))
            decrypted_bytes = self._fernet.decrypt(encrypted_bytes)
            return decrypted_bytes.decode("utf-8")
        except Exception as e:
            raise Exception(f"Failed to decrypt password: {str(e)}") from e

    def verify_password(self, plain_password: str, encrypted_password: str) -> bool:
        """
        Verify if a plain text password matches an encrypted password.

        Args:
            plain_password: The plain text password to verify
            encrypted_password: The encrypted password to compare against

        Returns:
            True if passwords match, False otherwise
        """
        try:
            decrypted = self.decrypt_password(encrypted_password)
            return plain_password == decrypted
        except Exception:
            return False


# Global instance for easy access
_password_encryption = PasswordEncryption()


def encrypt_password(password: str) -> str:
    """
    Convenience function to encrypt a password.

    Args:
        password: The plain text password to encrypt

    Returns:
        The encrypted password as a base64-encoded string
    """
    return _password_encryption.encrypt_password(password)


def decrypt_password(encrypted_password: str) -> str:
    """
    Convenience function to decrypt a password.

    Args:
        encrypted_password: The encrypted password as a base64-encoded string

    Returns:
        The decrypted plain text password
    """
    return _password_encryption.decrypt_password(encrypted_password)


def verify_password(plain_password: str, encrypted_password: str) -> bool:
    """
    Convenience function to verify if a plain text password matches an encrypted password.

    Args:
        plain_password: The plain text password to verify
        encrypted_password: The encrypted password to compare against

    Returns:
        True if passwords match, False otherwise
    """
    return _password_encryption.verify_password(plain_password, encrypted_password)
