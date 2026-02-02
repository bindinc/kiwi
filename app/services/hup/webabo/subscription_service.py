"""WebAbo subscription management service.

This module provides functionality to interact with the WebAbo REST API for managing
user subscriptions. It includes methods for creating and retrieving subscriptions,
as well as validation of subscription data.

Classes:
    SubscriptionService: Handles all subscription-related API interactions.
"""
import json
import logging
import re
import requests

from .client import WebAboClient
from app.utils.logging_config import redact_sensitive_data

class SubscriptionService(WebAboClient):
    """WebAbo subscription management service.

    This class provides methods to interact with the WebAbo REST API for managing
    subscriptions. It handles creation, validation, and retrieval of subscription
    data.

    Inherits from:
        WebAboClient: Provides common API interaction functionality.
    """

    def validate_subscription_data(self, subscription_data):
        """Validate the required fields and format of subscription data.

        Args:
            subscription_data (dict): The subscription data to validate containing:
                - validFrom (str): Start date of subscription
                - validUntil (str): End date of subscription
                - variantCode (str): Subscription variant identifier
                - offerDetails (dict): Details of the subscription offer
                - payment (dict): Payment information including IBAN
                - userId (str): Unique identifier of the user

        Raises:
            ValueError: If required fields are missing or IBAN format is invalid
        """
        required_fields = [
            'validFrom',
            'validUntil',
            'variantCode',
            'offerDetails',
            'payment',
            'userId'
        ]
        for field in required_fields:
            if not subscription_data.get(field):
                raise ValueError(f"Missing required field: {field}")
        if not re.match(r'^NL\d{2}[A-Z]{4}\d{10}$', subscription_data['payment']['swiftIBAN']):
            raise ValueError("Invalid IBAN format")

    def create_subscription(self, json_subscription):
        """Create a new subscription in WebAbo.

        Args:
            json_subscription (dict): Complete subscription data in JSON format.
                Must contain all required fields as specified in validate_subscription_data.

        Returns:
            tuple: (bool, dict) Tuple containing:
                - Success status (True/False)
                - Response data or error message

        Raises:
            requests.exceptions.HTTPError: If the API request fails with non-400 status
        """
        url_subscription = f"{self.base_url}/subscriptions"

        logging.info("Creating subscription")
        
        # Only log redacted subscription data at DEBUG level
        if logging.getLogger().isEnabledFor(logging.DEBUG):
            redacted_data = redact_sensitive_data(json_subscription)
            logging.debug(
                "Subscription data (redacted): \n%s",
                json.dumps(redacted_data, indent=4)
            )

        try:
            response = self.session.post(
                url_subscription,
                json=json_subscription
            )
            response_json = response.json()

            if response.status_code == 400 and 'message' in response_json:
                # For errors, no need to redact as we only log the error message
                logging.error("Subscription creation failed: %s", 
                              response_json.get('message', 'Unknown error'))
                return False, response_json

            response.raise_for_status()
            
            # Log success with minimal information
            if 'id' in response_json:
                logging.info("Subscription created successfully with ID: %s for user: %s", 
                             response_json.get('id'), json_subscription.get('userId'))
            else:
                logging.info("Subscription created successfully for user: %s", 
                             json_subscription.get('userId'))
                
            return True, response_json

        except requests.exceptions.HTTPError as e:
            logging.error("Error creating subscription: %s", e)
            self.webabo_error_handler(response_json)
            raise requests.exceptions.HTTPError("Error creating subscription") from e

    def get_subscriptions(self, userid):
        """Retrieve subscriptions for a specific user from WebAbo.

        Args:
            userid (str): The unique identifier of the user.

        Returns:
            dict: List of subscriptions associated with the user.

        Raises:
            requests.exceptions.HTTPError: If the API request fails
        """
        url = f"{self.base_url}/subscriptions/{str(userid)}"
        try:
            response = self.session.get(url)
            response.raise_for_status()
        except requests.exceptions.HTTPError as e:
            logging.error("Error getting subscriptions: %s", e)
            self.webabo_error_handler(response.json())
            raise requests.exceptions.HTTPError("Error getting subscriptions") from e

        return response.json()

    def get_subscriptions_start_dates(self, product_code, variant_code):
        """Retrieve start dates of subscriptions based on product and variant code.

        Args:
            product_code (str): The product code for the subscription.
            variant_code (str): The variant code for the subscription.

        Returns:
            dict: Start dates of subscriptions associated with the product and variant.

        Raises:
            requests.exceptions.HTTPError: If the API request fails
        """
        url = f"{self.base_url}/subscriptions/start-dates?productCode={product_code}&variantCode={variant_code}"
        try:
            # Ensure we have the latest token in the headers
            self.update_auth_header()

            response = self.session.get(url)
            response.raise_for_status()

        except requests.exceptions.HTTPError as e:
            logging.error("Error getting subscription start dates: %s", e)
            self.webabo_error_handler(response.json())
            raise requests.exceptions.HTTPError("Error getting subscription start dates") from e

        logging.info("Subscription start dates for product code %s with variant code %s: %s", product_code, variant_code, response.json())

        return response.json()