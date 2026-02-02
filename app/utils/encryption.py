"""Encryption utility module.

This module provides functions to encrypt and decrypt data using a secret key.
It uses the `itsdangerous` library for secure serialization and deserialization.
"""

import hmac
import hashlib
import base64
import json
import logging
from itsdangerous import URLSafeSerializer
from flask import current_app

class Encryption:
    @staticmethod
    def encrypt(data, secret_key=None):
        """Encrypt data using a secret key.

        Args:
            data: The data to encrypt (can be any serializable type).
            secret_key (str, optional): The secret key to use. Defaults to app's SECRET_KEY.

        Returns:
            str: Encrypted data string.
        """
        if secret_key is None:
            secret_key = current_app.config['SECRET_KEY']
        serializer = URLSafeSerializer(secret_key)
        return serializer.dumps(data)

    @staticmethod
    def decrypt(data, secret_key=None):
        """Decrypt data using a secret key.

        Args:
            data (str): The encrypted data to decrypt.
            secret_key (str, optional): The secret key to use. Defaults to app's SECRET_KEY.

        Returns:
            The decrypted data in its original type.
        """
        if secret_key is None:
            secret_key = current_app.config['SECRET_KEY']
        serializer = URLSafeSerializer(secret_key)
        return serializer.loads(data)
    
    @staticmethod
    def encryptUrlData(data: str, secret_key=None) -> tuple[str, str]:
        """Encrypt URL data using a secret key.

        Args:
            data (str): The string data to encrypt.
            secret_key (str, optional): The secret key to use. Defaults to app's SECRET_KEY.

        Returns:
            tuple[str, str]: A tuple containing (base64_encoded_data, signature)
        """
        if secret_key is None:
            secret_key = current_app.config['SECRET_KEY']
            logging.debug(f"Secret key: {secret_key}")

        try:
            # Encode the string as UTF-16LE bytes (SQL Server uses NVARCHAR which is UTF-16LE)
            data_bytes = data.encode('utf-16le')
            
            # Encode the bytes as Base64
            base64_data = base64.urlsafe_b64encode(data_bytes).decode('ascii')
            
            # Remove padding to match URL-safe format
            base64_data = base64_data.rstrip('=')
            
            # Generate signature matching SQL Server's approach
            # Concatenate data with secret key
            message = data + secret_key
            
            # Convert to UTF-16LE bytes
            message_bytes = message.encode('utf-16le')
            
            # Calculate SHA-256 hash
            hash_obj = hashlib.sha256(message_bytes)
            
            # Get uppercase hex digest to match SQL Server format
            signature = hash_obj.hexdigest().upper()
            
            logging.debug(f"Generated Base64 data: {base64_data}")
            logging.debug(f"Generated signature: {signature}")
            
            return base64_data, signature
        except Exception as e:
            logging.error(f"Error during URL data encryption: {e}", exc_info=True)
            return None, None
    
    @staticmethod
    def decryptUrlData(base64_data=None, received_sig=None, secret_key=None) -> str:
        """Decrypt URL data using a secret key.

        Args:
            base64_data (str): The base64 encoded data to decrypt.
            received_sig (str): The signature to validate against.
            secret_key (str, optional): The secret key to use. Defaults to app's SECRET_KEY.

        Returns:
            str: The decrypted data or None if validation fails.
        """
        if not base64_data or not received_sig:
            logging.error("Missing 'base64_data' or 'received_sig' parameter in request.")
            return None

        if secret_key is None:
            secret_key = current_app.config['SECRET_KEY']
            logging.debug(f"Secret key: {secret_key}")

        data_string = None
        try:
            missing_padding = len(base64_data) % 4
            if missing_padding:
                base64_data += '=' * (4 - missing_padding)

            # Decode Base64 string to bytes
            decoded_bytes = base64.urlsafe_b64decode(base64_data)
            
            # The data is already UTF-16LE encoded from SQL Server
            # SQL Server: CONVERT(VARBINARY(MAX), @SecretData, 65001)
            data_string = decoded_bytes.decode('utf-16le')
            logging.debug(f"Decoded data string: {data_string}")
        except (base64.Error, UnicodeDecodeError) as e:
            logging.warning(f"Base64/UTF-16LE decoding failed for data '{base64_data}': {e}")
            return None
        except Exception as e:  # Catch unexpected errors during decoding
            logging.error(f"Unexpected error during decoding: {e}", exc_info=True)
            return None

        try:
            # Match SQL Server implementation exactly
            # SQL: SET @Message = @SecretData + @SecretKey;
            # SQL Server uses NVARCHAR which is UTF-16LE encoding
            message = data_string + secret_key
            
            # In SQL Server: HASHBYTES('SHA2_256', @Message)
            # @Message is NVARCHAR, so it's already UTF-16LE
            message_bytes = message.encode('utf-16le')
            
            # Calculate SHA-256 hash
            hash_obj = hashlib.sha256(message_bytes)
            
            # SQL: CONVERT(NVARCHAR(64), HASHBYTES('SHA2_256', @Message), 2)
            # Style parameter '2' in SQL Server means convert to lowercase hex
            expected_sig = hash_obj.hexdigest().upper()  # SQL Server actually returns uppercase
            
            logging.debug(f"Received Sig: {received_sig}, Expected Sig: {expected_sig}")

            # Securely compare the received signature with the expected signature (timing-attack safe)
            if hmac.compare_digest(received_sig.upper(), expected_sig):  # Case-insensitive compare
                # Signature is valid!
                logging.info(f"Valid signature received for data: {data_string}")
                return data_string
            else:
                # Signature is invalid! Request denied.
                logging.warning(f"Invalid signature received. Expected '{expected_sig}', got '{received_sig}'")
                return None

        except Exception as e:
            # Catch unexpected errors during validation/processing
            logging.error(f"An error occurred during validation/processing: {e}", exc_info=True)
            return None
