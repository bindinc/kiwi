"""Configure centralized logging for the application.

This module provides functionality to set up consistent logging across all application
modules with both file and console output.
"""
import logging
import json
import re
import copy

def configure_logging(filename='formService.log', level=logging.INFO):
    """Set up application-wide logging configuration.

    Configures both file and console logging handlers with consistent formatting.
    Removes any existing handlers before setting up new ones to avoid duplication.

    Args:
        filename (str): Path to the log file where messages will be written.
            Defaults to 'formService.log'.
        level (int): Logging level to use (e.g., logging.INFO, logging.DEBUG).
            Defaults to logging.INFO.

    Returns:
        None
    """
    # Clear any existing handlers
    for handler in logging.root.handlers[:]:
        logging.root.removeHandler(handler)

    # Configure file logging
    logging.basicConfig(
        filename=filename,
        level=level,
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
        datefmt='%Y-%m-%d %H:%M:%S'
    )

    # Add console handler
    console_handler = logging.StreamHandler()
    console_handler.setLevel(level)
    formatter = logging.Formatter(
        '%(asctime)s - %(name)s - %(levelname)s - %(message)s'
    )
    console_handler.setFormatter(formatter)
    logging.getLogger().addHandler(console_handler)

def redact_sensitive_data(data, sensitive_fields=None):
    """Redact sensitive data for logging purposes.
    
    Args:
        data (dict): The data dictionary to redact sensitive fields from
        sensitive_fields (list, optional): List of field names to redact. 
            Defaults to common sensitive fields if None.
            
    Returns:
        dict: Copy of data with sensitive fields redacted
    """
    if sensitive_fields is None:
        sensitive_fields = [
            'swiftIBAN', 'iban', 'email', 'telNumber', 'phone', 
            'mobile', 'initial', 'firstname', 'middlename', 'lastname',
            'street', 'houseno', 'housenoExt', 'zipcode', 'city',
            'birthday', 'accountHolder'
        ]
    
    # Create a deep copy to avoid modifying the original
    if isinstance(data, dict):
        redacted = copy.deepcopy(data)
        
        # Recursively process all keys in dictionary
        for key, value in redacted.items():
            if isinstance(value, dict):
                redacted[key] = redact_sensitive_data(value, sensitive_fields)
            elif isinstance(value, list):
                redacted[key] = [
                    redact_sensitive_data(item, sensitive_fields) if isinstance(item, dict) 
                    else item for item in value
                ]
            elif key in sensitive_fields and value:
                if isinstance(value, str):
                    if key == 'email' and '@' in value:
                        # Show only first character and domain for emails
                        username, domain = value.split('@', 1)
                        redacted[key] = f"{username[0]}{'*' * (len(username) - 1)}@{domain}"
                    elif key in ['swiftIBAN', 'iban'] and len(value) > 8:
                        # For IBANs, keep country code and last 4 digits
                        redacted[key] = f"{value[:2]}{'*' * (len(value) - 6)}{value[-4:]}"
                    elif key in ['telNumber', 'phone'] and len(value) > 4:
                        # For phone numbers, keep last 2 digits
                        redacted[key] = f"{'*' * (len(value) - 2)}{value[-2:]}"
                    else:
                        # For other values, show first character and mask the rest
                        if len(value) > 0:
                            redacted[key] = f"{value[0]}{'*' * (len(value) - 1)}"
                        else:
                            redacted[key] = value
        
        return redacted
    
    # If the input is not a dict, return it unchanged
    return data
