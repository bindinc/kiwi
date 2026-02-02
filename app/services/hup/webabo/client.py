""" Base module providing service functionality for WebAbo REST API interactions.

This module contains the base service class that handles authentication,
session management, and error handling for WebAbo REST API communications.
"""
import json
import logging
import urllib3
from urllib3.util.retry import Retry
from requests.adapters import HTTPAdapter
import requests
from typing import Dict, Optional, Any

from .token_manager import ConfigurationManager, AccessTokenManager, TokenStorage, TokenRequestData, TokenRequester

class WebAboClient:
    """ client service class implementing common WebAbo REST API functionality.
    
    This class provides core functionality for WebAbo services including:
    - Authentication token management
    - SSL verification configuration
    - Session management with retry strategies
    - Basic error handling
    """
    # Store shared token manager to ensure only one token manager exists
    _token_manager: Optional[AccessTokenManager] = None

    def __init__(self, config=None):
        """Initialize the WebAbo client with configuration and set up the session.
        
        This method handles:
        - Setting up the configuration manager
        - Initializing the token manager
        - Configuring SSL verification settings
        - Creating a session with retry strategy
        - Setting up request headers and authentication
        
        Args:
            config (dict, optional): Configuration dictionary containing API settings.
                If not provided, will use existing configuration or environment variables.
        """
        # Initialize the AccessTokenManager if not already initialized
        if config:
            ConfigurationManager.set_config(config)
        
        # Use the shared token manager or create a new one if necessary
        if WebAboClient._token_manager is None:
            WebAboClient._token_manager = AccessTokenManager()
        
        self.token_manager = WebAboClient._token_manager
        self.token_manager.get_access_token()

        # Disable SSL warnings when Abel has no HTTPS for the Ingress
        self.verify_ssl = ConfigurationManager.get_setting('API_VERIFY_SSL')
        self.verify_ssl = self.verify_ssl == 'true'
        if not self.verify_ssl:
            urllib3.disable_warnings()

        self.base_url = ConfigurationManager.get_setting('API_URL')

        # Create session with retry strategy
        self.session = requests.Session()

        # Set basic WebAbo Rest API headers (without token)
        self.session.headers.update({
            'Accept': '*/*',
            'Content-Type': 'application/json',
        })
        
        # Update Authorization header with current token
        self.update_auth_header()

        # Set the base version of the API to verify the server version
        api_version = ConfigurationManager.get_setting('API_VERSION')
        self.base_version = f"WebaboRest/{api_version}"

        retry_strategy = Retry(
            total=3,
            status_forcelist=[429, 500, 502, 503, 504],
            allowed_methods=["HEAD", "GET", "POST", "PUT", "DELETE", "OPTIONS", "TRACE"]
        )
        self.session.verify = self.verify_ssl
        adapter = HTTPAdapter(max_retries=retry_strategy)
        self.session.mount('https://', adapter)
        self.session.mount('http://', adapter)

    def update_auth_header(self):
        """Update the session's Authorization header with the current access token.
        
        This ensures that the latest token is used for all requests, especially
        after token refreshes.
        """
        # Ensure we have a valid token
        self.token_manager.get_access_token()
        # Update the Authorization header with the current token
        self.session.headers.update({
            'Authorization': f'Bearer {TokenStorage.oauth_tokens["ACCESS_TOKEN"]}'
        })

    def webabo_error_handler(self, response_json):
        """ Handle error responses from the WebAbo API.
        
        Args:
            response_json (dict): JSON response from the WebAbo API containing
                error details and server version information.

        Logs:
            - INFO: When server version matches client version
            - ERROR: When version mismatch occurs or for full error response
        """
        # Check for version mismatch
        if str(response_json['server']) == str(self.base_version):
            logging.info(
                "The version of the server (%s) matches the version of the "
                "client (%s)",
                response_json['server'],
                self.base_version
            )
        else:
            logging.error(
              "The version of the server (%s) does not match the version "
              "that the client expected (%s)",
              response_json['server'],
              self.base_version
            )

        # Full error response
        logging.error("Response: %s", json.dumps(response_json, indent=4))
