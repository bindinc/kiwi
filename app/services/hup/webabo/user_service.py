"""Handle user data operations for the WebAbo service.

This module provides functionality for creating and retrieving user data
through the WebAbo API service interface.
"""
import json
import logging
import requests

from .client import WebAboClient
from app.utils.logging_config import redact_sensitive_data

class UserService(WebAboClient):
    """Handle user-related operations in WebAbo.

    This class provides methods for creating and retrieving user data
    through the WebAbo API endpoints.
    """

    def create_user(self, json_user):
        """Create a new user in WebAbo.

        Args:
            json_user (dict): User data in JSON format.

        Returns:
            dict: Response from the API containing created user data.

        Raises:
            requests.exceptions.HTTPError: If user creation fails.
        """
        url_users = f"{self.base_url}/users"

        logging.info("Creating/updating user")
        
        # Only log redacted user data and only at DEBUG level
        if logging.getLogger().isEnabledFor(logging.DEBUG):
            redacted_data = redact_sensitive_data(json_user)
            logging.debug(
                "User data (redacted): \n%s",
                json.dumps(redacted_data, indent=4)
            )

        response_json = {}

        try:
            response = self.session.post(
                url_users,
                json=json_user
            )

            response_json = response.json()
            response.raise_for_status()

        except requests.exceptions.HTTPError as e:
            logging.error("Error creating user: %s", e)
            self.webabo_error_handler(response_json)
            raise requests.exceptions.HTTPError("Error creating user") from e

        # Log success with minimal information
        if 'userId' in response_json:
            logging.info("User created successfully with ID: %s", response_json['userId'])
        else:
            logging.info("User created successfully")

        return response_json


    def get_user(self, userid):
        """Retrieve user information from WebAbo.

        Args:
            userid (str): Unique identifier of the user.

        Returns:
            dict: User data in JSON format.

        Raises:
            requests.exceptions.HTTPError: If user retrieval fails.
        """
        url_verify_user = f"{self.base_url}/users/{userid}"
        try:
            response = self.session.get(url_verify_user)
            response.raise_for_status()
        except requests.exceptions.HTTPError as e:
            logging.error("Error getting user: %s", e)
            self.webabo_error_handler(response.json())
            raise requests.exceptions.HTTPError("Error getting user") from e

        return response.json()
