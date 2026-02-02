"""Handle user address validation and searching in WebAbo system."""
import json
import logging
import os
import re
import sqlite3

from app.utils.address_formatter import format_street_name, is_valid_houseno, normalize_houseno
from .client import WebAboClient

class AddressService(WebAboClient):
    """Handle address data operations including validation and searching.

    Provides methods to search addresses using either a database or API backend,
    and validates provided address information.
    """

    def find_address_db(self, data):
        """Search for an address in the SQLite database.

        Args:
            data: Dictionary containing address search criteria with
                 'zipcode' and 'houseno' keys.

        Returns:
            dict: Matched address data containing zipcode, street and city,
                 or None if no match found.
        """
        db_file = os.environ.get('DB_BAG', None)
        if not os.path.exists(db_file):
            logging.error("Database file %s not found", db_file)
            return None

        conn = sqlite3.connect(db_file)
        c = conn.cursor()

        # Split house number into numeric part and letter part
        zipcode = data['zipcode'].strip().upper()
        houseno_value = normalize_houseno(data.get('houseno', ''))

        if not is_valid_houseno(houseno_value):
            logging.error('Invalid houseno provided: %s', data.get('houseno'))
            return None

        house_number_match = re.match(r'([0-9]+)([A-Z]?)', houseno_value)
        number, letter = house_number_match.groups()

        query = (
            "SELECT postcode as zipcode, "
            "huisnummer || huisletter as houseno, "
            "toevoeging as housenoExt, "
            "straat as street, "
            "UPPER(woonplaats) as city "
            "FROM adressen "
            "WHERE postcode=? AND huisnummer=? AND (huisletter=? OR (huisletter IS NULL AND ?=''))"
        )
        c.execute(query, (zipcode, number, letter, letter))
        result = c.fetchone()
        conn.close()

        if result:
            return {
                "zipcode": result[0].strip().upper() if isinstance(result[0], str) else result[0],
                "street": format_street_name(result[3]) if result[3] else '',
                "city": result[4],
            }
        else:
            logging.info("No address found for the provided data")
            return None


    def find_address_api(self, data):
        """Search for an address using the REST API.

        Args:
            data: Dictionary containing address search criteria.

        Returns:
            dict: Matched address data containing zipcode, street and city,
                 or None if no match found.
        """
        find_address_url = f"{self.base_url}/addresses/search/?limit=1"
        logging.info("Find address url: %s", find_address_url)
        logging.info("data %s", data)
        response_find_address = self.session.post(
            find_address_url,
            json=data
        )
        response_find_address.raise_for_status()
        find_address_data = response_find_address.json()

        if find_address_data and isinstance(find_address_data, list) and len(find_address_data) > 0:
            address = find_address_data[0]
            return {
                "zipcode": address['zipcode'].strip().upper(),
                "street": format_street_name(address['streetName']),
                "city": address['city'],
            }
        else:
            logging.error("No address data found")
            return None


    def validate_address(self, data):
        """Validate provided address details against known good addresses.

        Args:
            data: Dictionary containing address details to validate with
                 zipcode, street, and city.

        Returns:
            dict: Validated address data if found, None otherwise.
        """
        logging.info("data %s", data)

        response = self.search_addresses(data)

        if response:
            logging.info("Address details retrieved")
            logging.info("Address details: \n%s", json.dumps(response, indent=4))
            # Check if the address is valid on zipcode, street, city
            # case insensitive and without leading/trailing spaces
            if (data['zipcode'].strip().lower() == response['zipcode'].strip().lower() and
                data['street'].strip().lower() == response['street'].strip().lower() and
                data['city'].strip().lower() == response['city'].strip().lower()):
                logging.info("Address is valid")

        else:
            logging.info("Address not found in the database")
        return response


    def search_addresses(self, data):
        """Search for address details using configured backend method.

        Uses either database or API backend based on API_ADDRESS_FIND_METHOD
        environment variable.

        Args:
            data: Dictionary containing address search criteria.

        Returns:
            dict: Matched address data if found, None otherwise.
        """
        logging.info("data %s", data)

        zipcode_value = data.get('zipcode', '')
        houseno_value = normalize_houseno(data.get('houseno', ''))

        if not zipcode_value or not houseno_value:
            logging.error('Zipcode and houseno are required for address lookup')
            return None

        if not is_valid_houseno(houseno_value):
            raise ValueError('Ongeldig huisnummerformaat')

        search_payload = dict(data)
        search_payload['zipcode'] = zipcode_value.strip().upper()
        search_payload['houseno'] = houseno_value

        # default to api if not set
        if os.environ['API_ADDRESS_FIND_METHOD']=='DB':
            response = self.find_address_db(search_payload)
        else:
            response = self.find_address_api(search_payload)

        if response:
            logging.info("Address details retrieved")
            logging.info("Address details: \n%s", json.dumps(response, indent=4))
        else:
            logging.info("Address not found in the database")
        return response
