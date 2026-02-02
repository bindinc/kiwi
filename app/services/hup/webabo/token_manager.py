"""This module contains classes for managing access tokens.

Classes:
- ConfigurationManager: A class for retrieving environment variable settings.
- TokenRequester: A class for requesting access tokens from the API.
- TokenStorage: A class for storing and managing access tokens.
- logging: A class for logging token-related messages.
- AccessTokenManager: A class for managing access tokens.

Functions:
- get_setting(key): Get the value of the environment variable with the given key.
- request_token(grant_type, client_secret, url, username=None, password=None,
                refresh_token=None): Request an access token from the API.
- update_tokens(response_json): Update the stored access tokens with the provided response JSON.
- is_token_valid(): Check if the access token is still valid.
- is_refresh_token_valid(): Check if the refresh token is still valid.
- log(message): Log the given message.
- get_access_token(): Get the access token, refreshing it if necessary.
- refresh_access_token(): Refresh the access token using the refresh token.
"""

import os
import time
import base64
import logging
from dataclasses import dataclass
import requests

from dotenv import load_dotenv

load_dotenv()


class ConfigurationManager:
    """A class for retrieving configuration settings."""
    
    # Dictionary to store configuration values
    _config = {}
    
    @classmethod
    def set_config(cls, config_dict=None, **kwargs):
        """Set configuration values from dictionary or keyword arguments.
        
        Args:
            config_dict (dict, optional): Dictionary containing configuration values
            **kwargs: Configuration values as keyword arguments
        """
        if config_dict:
            cls._config.update(config_dict)
        if kwargs:
            cls._config.update(kwargs)
    
    @classmethod
    def get_setting(cls, key):
        """Get a configuration value by key.
        
        First checks internal configuration dictionary,
        then falls back to environment variables if not found.
        
        Args:
            key (str): The configuration key to retrieve
            
        Returns:
            The configuration value or None if not found
        """
        # First check internal config dictionary
        if key in cls._config:
            return cls._config[key]
        # Fall back to environment variables
        return os.getenv(key)

@dataclass
class TokenRequestData:
    """
    Data class representing the data required for a token request.

    Attributes:
        grant_type (str): The type of grant being requested.
        client_secret (str): The client secret for authentication.
        url (str): The URL to which the token request is sent.
        username (str, optional): The username for authentication.
        password (str, optional): The password for authentication.
        refresh_token (str, optional): The refresh token for obtaining 
            a new access token, if applicable. Defaults to None.
    """
    grant_type: str
    client_secret: str
    url: str
    username: str
    password: str
    refresh_token: str = None


class TokenRequester:
    """A class for requesting access tokens from the API."""

    @staticmethod
    def request_token(request_data: TokenRequestData):
        """Request an access token from the API.
        
        Args:
            request_data (TokenRequestData): Data object containing all required
                authentication information for the token request.
                
        Returns:
            dict: JSON response containing the access token and related information.
        """
        client_secret_encoded = base64.b64encode(request_data.client_secret.encode()).decode()
        headers = {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Authorization': f'Basic {client_secret_encoded}',
            'Accept': '*/*'
        }
        data = {'grant_type': request_data.grant_type}
        if request_data.grant_type == 'password':
            data.update({
                'username': request_data.username,
                'password': request_data.password
            })
        elif request_data.grant_type == 'refresh_token' and request_data.refresh_token:
            data['refresh_token'] = request_data.refresh_token
        response = requests.post(request_data.url,
                                 headers=headers,
                                 data=data,
                                 timeout=10)
        return response.json()

class TokenStorage:
    """A class for storing and managing access tokens."""

    oauth_tokens = {}

    @classmethod
    def update_tokens(cls, response_json):
        """Update the stored access tokens with the provided response JSON.
        
        Args:
            response_json (dict): Response from OAuth service containing 
                token information including access_token, expires_in, 
                refresh_token, and refresh_expires_in.
        """
        cls.oauth_tokens['TOKEN_REQUEST_TIME'] = int(time.time())
        cls.oauth_tokens['ACCESS_TOKEN'] = response_json['access_token']
        cls.oauth_tokens['EXPIRES_IN'] = response_json['expires_in']
        cls.oauth_tokens['REFRESH_EXPIRES_IN'] = response_json['refresh_expires_in']
        cls.oauth_tokens['REFRESH_TOKEN'] = response_json['refresh_token']

    @classmethod
    def is_token_valid(cls):
        """Check if the access token is still valid.
        
        Returns:
            bool: True if the access token hasn't expired, False otherwise.
        """
        current_time = int(time.time())
        if 'TOKEN_REQUEST_TIME' in cls.oauth_tokens and 'EXPIRES_IN' in cls.oauth_tokens:
            elapsed_time = current_time - cls.oauth_tokens['TOKEN_REQUEST_TIME']
            return elapsed_time < cls.oauth_tokens['EXPIRES_IN']
        return False

    @classmethod
    def is_refresh_token_valid(cls):
        """Check if the refresh token is still valid.
        
        Returns:
            bool: True if the refresh token hasn't expired, False otherwise.
        """
        current_time = int(time.time())
        if 'TOKEN_REQUEST_TIME' in cls.oauth_tokens and 'REFRESH_EXPIRES_IN' in cls.oauth_tokens:
            elapsed_time = current_time - cls.oauth_tokens['TOKEN_REQUEST_TIME']
            return elapsed_time < cls.oauth_tokens['REFRESH_EXPIRES_IN']
        return False

class AccessTokenManager:
    """A class for managing access tokens."""

    def __init__(self):
        self.url = ConfigurationManager.get_setting('API_TOKEN_URL')
        self.client_secret = ConfigurationManager.get_setting('API_CLIENT_SECRET')
        self.username = ConfigurationManager.get_setting('API_USERNAME')
        self.password = ConfigurationManager.get_setting('API_PASSWORD')
        logging.info('username: %s', self.username)
        logging.info('client_secret: %s', self.client_secret)
                     

    def get_access_token(self):
        """Get the access token, refreshing it if necessary.
        
        This method checks if the current access token is valid and either:
        - Returns the current token if it's still valid
        - Refreshes using the refresh token if available and valid
        - Obtains a completely new token if both the access and refresh tokens are invalid
        
        Returns:
            None: The token is stored in TokenStorage.oauth_tokens['ACCESS_TOKEN']
        """
        if not TokenStorage.is_token_valid():
            if TokenStorage.is_refresh_token_valid():
                logging.info('Access token expired but refresh token is '
                                'still valid. Refreshing access token.')
                self.refresh_access_token()
            else:
                logging.info('Obtaining new access token.')
                request_data = TokenRequestData(
                    grant_type='password',
                    client_secret=self.client_secret,
                    url=self.url,
                    username=self.username,
                    password=self.password
                )
                response_json = TokenRequester.request_token(request_data)
                TokenStorage.update_tokens(response_json)
                logging.info('Token obtained successfully')
        else:
            logging.info('Access token is still valid.')

    def refresh_access_token(self):
        """Refresh the access token using the refresh token.
        
        Uses the stored refresh token to request a new access token from the
        authentication service without requiring username/password credentials.
        
        Returns:
            None: The refreshed token is stored in TokenStorage.oauth_tokens['ACCESS_TOKEN']
        """
        refresh_token = TokenStorage.oauth_tokens.get('REFRESH_TOKEN')
        request_data = TokenRequestData(
            grant_type='refresh_token',
            client_secret=self.client_secret,
            username=self.username,
            password=self.password,
            url=self.url,
            refresh_token=refresh_token
        )
        response_json = TokenRequester.request_token(request_data)
        TokenStorage.update_tokens(response_json)
        logging.info('Token refreshed successfully')
