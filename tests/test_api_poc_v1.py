import os
import sys
import unittest

from flask import Flask

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "app")))

from blueprints.api import api_v1_bp, register_api_blueprint  # noqa: E402
from blueprints.api.bootstrap import bootstrap_bp  # noqa: E402
from blueprints.api.call_queue import call_queue_bp  # noqa: E402
from blueprints.api.call_session import call_session_bp  # noqa: E402
from blueprints.api.catalog import catalog_bp  # noqa: E402
from blueprints.api.customers import customers_bp  # noqa: E402
from blueprints.api.debug import debug_bp  # noqa: E402
from blueprints.api.me import me_bp  # noqa: E402
from blueprints.api.status import status_bp  # noqa: E402
from blueprints.api.subscriptions import subscriptions_bp  # noqa: E402
from blueprints.api.workflows import workflows_bp  # noqa: E402


register_api_blueprint(status_bp)
register_api_blueprint(me_bp)
register_api_blueprint(bootstrap_bp)
register_api_blueprint(debug_bp)
register_api_blueprint(catalog_bp)
register_api_blueprint(customers_bp)
register_api_blueprint(subscriptions_bp)
register_api_blueprint(workflows_bp)
register_api_blueprint(call_queue_bp)
register_api_blueprint(call_session_bp)


class PocApiV1Tests(unittest.TestCase):
    def setUp(self):
        app = Flask(__name__)
        app.secret_key = "test-secret"
        app.register_blueprint(api_v1_bp)
        self.client = app.test_client()

    def _authenticate(self, roles=None):
        allowed_roles = roles or ["bink8s.app.kiwi.user"]
        with self.client.session_transaction() as session_data:
            session_data["oidc_auth_profile"] = {
                "name": "Test User",
                "email": "test@example.org",
                "roles": allowed_roles,
            }

    def test_status_is_public(self):
        response = self.client.get("/api/v1/status")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.get_json()["status"], "ok")

    def test_guard_returns_401_without_authentication(self):
        response = self.client.get("/api/v1/bootstrap")
        self.assertEqual(response.status_code, 401)
        payload = response.get_json()
        self.assertEqual(payload["error"]["code"], "unauthorized")

    def test_guard_returns_403_for_disallowed_role(self):
        self._authenticate(["no.access.role"])
        response = self.client.get("/api/v1/bootstrap")
        self.assertEqual(response.status_code, 403)
        payload = response.get_json()
        self.assertEqual(payload["error"]["code"], "forbidden")

    def test_me_and_bootstrap_return_authenticated_context(self):
        self._authenticate()

        me_response = self.client.get("/api/v1/me")
        self.assertEqual(me_response.status_code, 200)
        me_payload = me_response.get_json()
        self.assertIn("identity", me_payload)
        self.assertEqual(me_payload["identity"]["email"], "test@example.org")

        bootstrap_response = self.client.get("/api/v1/bootstrap")
        self.assertEqual(bootstrap_response.status_code, 200)
        bootstrap_payload = bootstrap_response.get_json()
        self.assertIn("customers", bootstrap_payload)
        self.assertIn("call_queue", bootstrap_payload)
        self.assertIn("catalog", bootstrap_payload)
        self.assertGreaterEqual(len(bootstrap_payload["customers"]), 1)

    def test_subscription_signup_and_customer_mutations(self):
        self._authenticate()

        customers_response = self.client.get("/api/v1/customers")
        self.assertEqual(customers_response.status_code, 200)
        existing_customer_id = customers_response.get_json()["items"][0]["id"]

        signup_response = self.client.post(
            "/api/v1/workflows/subscription-signup",
            json={
                "customerId": existing_customer_id,
                "subscription": {
                    "magazine": "Avrobode",
                    "duration": "1-jaar",
                    "durationLabel": "1 jaar (52 nummers)",
                    "startDate": "2026-01-10",
                    "status": "active",
                },
                "contactEntry": {
                    "type": "Extra abonnement",
                    "description": "Test: extra abonnement toegevoegd.",
                },
            },
        )
        self.assertEqual(signup_response.status_code, 201)
        signup_payload = signup_response.get_json()
        self.assertEqual(signup_payload["customer"]["id"], existing_customer_id)
        self.assertEqual(signup_payload["subscription"]["magazine"], "Avrobode")

        patch_response = self.client.patch(
            f"/api/v1/customers/{existing_customer_id}",
            json={"city": "Zwolle"},
        )
        self.assertEqual(patch_response.status_code, 200)
        self.assertEqual(patch_response.get_json()["city"], "Zwolle")

        remarks_response = self.client.put(
            f"/api/v1/customers/{existing_customer_id}/delivery-remarks",
            json={"default": "Test opmerking", "updatedBy": "Unit Test"},
        )
        self.assertEqual(remarks_response.status_code, 200)
        self.assertEqual(remarks_response.get_json()["deliveryRemarks"]["default"], "Test opmerking")

    def test_article_order_queue_and_call_flow(self):
        self._authenticate()

        article_response = self.client.get("/api/v1/catalog/articles?popular=true&limit=1")
        self.assertEqual(article_response.status_code, 200)
        article = article_response.get_json()["items"][0]

        order_response = self.client.post(
            "/api/v1/workflows/article-order",
            json={
                "customer": {
                    "salutation": "Dhr.",
                    "firstName": "Order",
                    "middleName": "",
                    "lastName": "Tester",
                    "birthday": "1980-01-01",
                    "postalCode": "1234AB",
                    "houseNumber": "10",
                    "address": "Teststraat 10",
                    "city": "Teststad",
                    "email": "order@test.example",
                    "phone": "0612345678",
                },
                "order": {
                    "desiredDeliveryDate": "2026-02-20",
                    "paymentMethod": "iDEAL",
                    "items": [{"articleId": article["id"], "quantity": 2}],
                },
                "contactEntry": {
                    "type": "Artikel bestelling",
                    "description": "Test order geplaatst",
                },
            },
        )
        self.assertEqual(order_response.status_code, 201)
        order_payload = order_response.get_json()
        self.assertTrue(order_payload["createdCustomer"])
        self.assertEqual(order_payload["order"]["items"][0]["articleId"], article["id"])

        generate_queue_response = self.client.post(
            "/api/v1/call-queue/debug-generate",
            json={"queueSize": 2, "queueMix": "all_known"},
        )
        self.assertEqual(generate_queue_response.status_code, 200)
        self.assertEqual(len(generate_queue_response.get_json()["queue"]), 2)

        accept_response = self.client.post("/api/v1/call-queue/accept-next", json={})
        self.assertEqual(accept_response.status_code, 200)
        accepted = accept_response.get_json()["accepted"]
        self.assertIsNotNone(accepted["customerId"])

        hold_response = self.client.post("/api/v1/call-session/hold", json={})
        self.assertEqual(hold_response.status_code, 200)
        self.assertTrue(hold_response.get_json()["onHold"])

        resume_response = self.client.post("/api/v1/call-session/resume", json={})
        self.assertEqual(resume_response.status_code, 200)
        self.assertFalse(resume_response.get_json()["onHold"])

        end_response = self.client.post("/api/v1/call-session/end", json={"forcedByCustomer": True})
        self.assertEqual(end_response.status_code, 200)
        last_call = end_response.get_json()["last_call_session"]
        self.assertEqual(last_call["customerId"], accepted["customerId"])

        disposition_response = self.client.post(
            "/api/v1/call-session/disposition",
            json={"category": "general", "outcome": "info_provided", "notes": "Handled in test"},
        )
        self.assertEqual(disposition_response.status_code, 200)
        self.assertEqual(disposition_response.get_json()["status"], "saved")


if __name__ == "__main__":
    unittest.main()
