import os
import sys
import unittest
from unittest import mock

from flask import Flask

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "app")))

from blueprints.api import api_v1_bp, register_api_blueprint  # noqa: E402
from blueprints.customers.api import customers_api_bp  # noqa: E402


class CustomersApiTests(unittest.TestCase):
    def setUp(self):
        app = Flask(__name__)
        register_api_blueprint(customers_api_bp)
        app.register_blueprint(api_v1_bp)
        self.client = app.test_client()

    def test_search_maps_all_supported_filters(self):
        with mock.patch("blueprints.customers.api._customer_service") as customer_service:
            customer_service.search.return_value = {
                "items": [],
                "page": {"number": 2, "size": 30, "totalElements": 0, "totalPages": 0},
            }

            response = self.client.get(
                "/api/v1/customers/search"
                "?name=Doe"
                "&firstname=Jane"
                "&postcode=1234AB"
                "&houseno=10"
                "&phone=0612345678"
                "&email=jane@example.org"
                "&city=Amsterdam"
                "&page=2"
                "&pagesize=30"
                "&exactmatch=true"
            )

        self.assertEqual(response.status_code, 200)
        customer_service.search.assert_called_once_with(
            {
                "name": "Doe",
                "firstname": "Jane",
                "postcode": "1234AB",
                "houseno": "10",
                "phone": "0612345678",
                "email": "jane@example.org",
                "city": "Amsterdam",
                "page": 2,
                "pagesize": 30,
                "exactmatch": True,
            }
        )


if __name__ == "__main__":
    unittest.main()
