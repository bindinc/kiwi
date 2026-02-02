"""Handle extended user data operations for the WebAbo service.

This module provides functionality for creating and retrieving extended data
through the WebAbo API service interface.
"""
import json
import logging
import requests

from .client import WebAboClient
from app.utils.logging_config import redact_sensitive_data

class ExtendedDataService(WebAboClient):
    """Handle extended data-related operations in WebAbo.

    This class provides methods for creating and retrieving extended user data
    through the WebAbo API endpoints.
    """

    def create_ext_data(self, json_ext_data):
        """Create a new extended data item in WebAbo.

        Args:
            json_ext_data (dict): Extended User data in JSON format.

        Returns:
            dict: Response from the API containing created user data.

        Raises:
            requests.exceptions.HTTPError: If user creation fails.
        """
        url_users = f"{self.base_url}/extended-data"

        logging.info("Creating/updating extended data")
        
        # Only log detailed data at DEBUG level with redaction
        if logging.getLogger().isEnabledFor(logging.DEBUG):
            redacted_data = redact_sensitive_data(json_ext_data)
            logging.debug(
                "Extended data (redacted): \n%s",
                json.dumps(redacted_data, indent=4)
            )

        # TODO: TEMPORARY - Remove this mock when API is fixed
        use_mock = True  # Set to False when API is fixed
        if use_mock:
            logging.warning("Using mock response for extended data creation")
            mock_response = {
                "id": "mock-id-12345",
                "status": "success", 
                "data": json_ext_data
            }
            logging.info("Mock extended data created with ID: mock-id-12345")
            return mock_response

        response_json = {}

        try:
            response = self.session.post(
                url_users,
                json=json_ext_data
            )

            response_json = response.json()
            response.raise_for_status()

        except requests.exceptions.HTTPError as e:
            logging.error("Error creating extended data: %s", e)
            self.webabo_error_handler(response_json)
            raise requests.exceptions.HTTPError("Error creating extended data") from e

        # Log success with minimal information
        if 'id' in response_json:
            logging.info("Extended data created successfully with ID: %s", response_json['id'])
        else:
            logging.info("Extended data created successfully")

        return response_json
