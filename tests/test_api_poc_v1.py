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
from blueprints.api.swagger import swagger_bp  # noqa: E402
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
register_api_blueprint(swagger_bp)


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

    def test_catalog_endpoints(self):
        self._authenticate()

        werfsleutels_response = self.client.get("/api/v1/catalog/werfsleutels?query=avro&limit=5")
        self.assertEqual(werfsleutels_response.status_code, 200)
        werfsleutels_payload = werfsleutels_response.get_json()
        self.assertGreater(len(werfsleutels_payload["items"]), 0)

        barcode = werfsleutels_payload["items"][0]["barcode"]
        barcode_response = self.client.get(f"/api/v1/catalog/werfsleutels?barcode={barcode}&limit=5")
        self.assertEqual(barcode_response.status_code, 200)
        self.assertGreaterEqual(barcode_response.get_json()["total"], 1)

        articles_response = self.client.get(
            "/api/v1/catalog/articles?query=bundel&magazine=Avrobode&popular=true&tab=popular&limit=3"
        )
        self.assertEqual(articles_response.status_code, 200)
        articles_payload = articles_response.get_json()
        self.assertGreater(len(articles_payload["items"]), 0)

        article_id = int(articles_payload["items"][0]["id"])
        article_response = self.client.get(f"/api/v1/catalog/articles/{article_id}")
        self.assertEqual(article_response.status_code, 200)
        self.assertEqual(article_response.get_json()["id"], article_id)

        missing_article_response = self.client.get("/api/v1/catalog/articles/999999")
        self.assertEqual(missing_article_response.status_code, 404)

        quote_response = self.client.post(
            "/api/v1/catalog/article-order-quote",
            json={
                "items": [
                    {"articleId": article_id, "quantity": 2},
                ],
                "couponCode": "WELKOM10",
            },
        )
        self.assertEqual(quote_response.status_code, 200)
        quote_payload = quote_response.get_json()
        self.assertTrue(quote_payload["coupon"]["valid"])
        self.assertLessEqual(quote_payload["total"], quote_payload["subtotal"])

        invalid_coupon_response = self.client.post(
            "/api/v1/catalog/article-order-quote",
            json={
                "items": [{"articleId": article_id, "quantity": 1}],
                "couponCode": "NOT-A-COUPON",
            },
        )
        self.assertEqual(invalid_coupon_response.status_code, 200)
        self.assertFalse(invalid_coupon_response.get_json()["coupon"]["valid"])

        winback_response = self.client.get("/api/v1/catalog/winback-offers?reason=delivery")
        self.assertEqual(winback_response.status_code, 200)
        self.assertGreaterEqual(len(winback_response.get_json()["items"]), 1)

        delivery_response = self.client.get("/api/v1/catalog/delivery-calendar?year=2026&month=2")
        self.assertEqual(delivery_response.status_code, 200)
        delivery_payload = delivery_response.get_json()
        self.assertEqual(delivery_payload["month"], 2)
        self.assertIn("recommendedDate", delivery_payload)

        invalid_month_response = self.client.get("/api/v1/catalog/delivery-calendar?year=2026&month=13")
        self.assertEqual(invalid_month_response.status_code, 400)

        disposition_response = self.client.get("/api/v1/catalog/disposition-options")
        self.assertEqual(disposition_response.status_code, 200)
        self.assertIn("general", disposition_response.get_json()["categories"])

        services_response = self.client.get("/api/v1/catalog/service-numbers")
        self.assertEqual(services_response.status_code, 200)
        self.assertIn("ALGEMEEN", services_response.get_json()["serviceNumbers"])

    def test_customer_resource_endpoints(self):
        self._authenticate()

        customers_response = self.client.get("/api/v1/customers?postalCode=1012AB&houseNumber=42&page=1&pageSize=5")
        self.assertEqual(customers_response.status_code, 200)
        customers_payload = customers_response.get_json()
        self.assertGreaterEqual(customers_payload["total"], 1)
        customer_id = int(customers_payload["items"][0]["id"])

        created_response = self.client.post(
            "/api/v1/customers",
            json={
                "salutation": "Mevr.",
                "firstName": "Eva",
                "middleName": "",
                "lastName": "Testers",
                "postalCode": "1111AA",
                "houseNumber": "1",
                "address": "Teststraat 1",
                "city": "Testdam",
                "email": "eva.testers@example.org",
                "phone": "0611122233",
            },
        )
        self.assertEqual(created_response.status_code, 201)
        created_customer_id = int(created_response.get_json()["id"])

        read_customer_response = self.client.get(f"/api/v1/customers/{created_customer_id}")
        self.assertEqual(read_customer_response.status_code, 200)
        self.assertEqual(read_customer_response.get_json()["id"], created_customer_id)

        update_customer_response = self.client.patch(
            f"/api/v1/customers/{created_customer_id}",
            json={"city": "Zwolle", "phone": "0699999999"},
        )
        self.assertEqual(update_customer_response.status_code, 200)
        self.assertEqual(update_customer_response.get_json()["city"], "Zwolle")

        customer_state_response = self.client.get("/api/v1/customers/state")
        self.assertEqual(customer_state_response.status_code, 200)
        customer_state_payload = customer_state_response.get_json()
        self.assertIn("customers", customer_state_payload)

        write_state_response = self.client.put(
            "/api/v1/customers/state",
            json={"customers": customer_state_payload["customers"]},
        )
        self.assertEqual(write_state_response.status_code, 200)
        self.assertGreaterEqual(write_state_response.get_json()["count"], 1)

        read_history_response = self.client.get(f"/api/v1/customers/{customer_id}/contact-history?page=1&pageSize=2")
        self.assertEqual(read_history_response.status_code, 200)
        history_payload = read_history_response.get_json()
        self.assertEqual(history_payload["pageSize"], 2)

        create_history_response = self.client.post(
            f"/api/v1/customers/{customer_id}/contact-history",
            json={"type": "Test", "description": "Handmatig testcontactmoment"},
        )
        self.assertEqual(create_history_response.status_code, 201)
        self.assertEqual(create_history_response.get_json()["type"], "Test")

        delivery_remarks_response = self.client.put(
            f"/api/v1/customers/{customer_id}/delivery-remarks",
            json={"default": "Graag achterom bezorgen", "updatedBy": "Unit Test"},
        )
        self.assertEqual(delivery_remarks_response.status_code, 200)
        self.assertEqual(
            delivery_remarks_response.get_json()["deliveryRemarks"]["default"],
            "Graag achterom bezorgen",
        )

        complaint_response = self.client.post(
            f"/api/v1/customers/{customer_id}/editorial-complaints",
            json={
                "magazine": "Avrobode",
                "type": "klacht",
                "category": "inhoud",
                "description": "Artikel bevatte een fout",
                "edition": "2026-W02",
                "followup": True,
            },
        )
        self.assertEqual(complaint_response.status_code, 201)
        self.assertIn("entry", complaint_response.get_json())

        article_orders_response = self.client.get(f"/api/v1/customers/{customer_id}/article-orders")
        self.assertEqual(article_orders_response.status_code, 200)
        self.assertIn("items", article_orders_response.get_json())

    def test_subscription_endpoints(self):
        self._authenticate()

        update_response = self.client.patch(
            "/api/v1/customers/1/subscriptions/1",
            json={"status": "active", "duration": "2-jaar"},
        )
        self.assertEqual(update_response.status_code, 200)
        self.assertEqual(update_response.get_json()["subscription"]["duration"], "2-jaar")

        resend_response = self.client.post(
            "/api/v1/customers/1/subscriptions/1/resend",
            json={"reason": "damaged"},
        )
        self.assertEqual(resend_response.status_code, 200)
        self.assertIn("entry", resend_response.get_json())

        winback_accept_response = self.client.post(
            "/api/v1/customers/1/subscriptions/1/winback",
            json={"result": "accepted", "offer": {"title": "Speciale deal"}},
        )
        self.assertEqual(winback_accept_response.status_code, 200)
        self.assertEqual(winback_accept_response.get_json()["status"], "retained")

        winback_decline_response = self.client.post(
            "/api/v1/customers/1/subscriptions/5/winback",
            json={"result": "declined"},
        )
        self.assertEqual(winback_decline_response.status_code, 200)
        self.assertEqual(winback_decline_response.get_json()["status"], "cancelled")

        customer_after_decline_response = self.client.get("/api/v1/customers/1")
        self.assertEqual(customer_after_decline_response.status_code, 200)
        remaining_subscriptions = customer_after_decline_response.get_json()["subscriptions"]
        self.assertFalse(any(int(subscription["id"]) == 5 for subscription in remaining_subscriptions))

        deceased_response = self.client.post(
            "/api/v1/customers/4/subscriptions/deceased-actions",
            json={
                "actions": [
                    {
                        "subscriptionId": 6,
                        "action": "transfer",
                        "transferData": {
                            "name": "Test Erfgenaam",
                            "postalCode": "9999ZZ",
                            "houseNumber": "2",
                        },
                    },
                    {
                        "subscriptionId": 7,
                        "action": "refund",
                        "refundData": {
                            "email": "nabestaande@example.org",
                            "notes": "Graag bevestigen per e-mail",
                        },
                    },
                ]
            },
        )
        self.assertEqual(deceased_response.status_code, 200)
        processed = deceased_response.get_json()["processed"]
        self.assertEqual(len(processed), 2)

        restitution_transfer_response = self.client.post(
            "/api/v1/customers/2/subscriptions/3/restitution-transfer",
            json={
                "transferData": {
                    "name": "Nieuwe Ontvanger",
                    "postalCode": "2222BB",
                    "houseNumber": "4",
                }
            },
        )
        self.assertEqual(restitution_transfer_response.status_code, 200)
        self.assertEqual(restitution_transfer_response.get_json()["subscription"]["status"], "transferred")

    def test_workflow_endpoints(self):
        self._authenticate()

        article_response = self.client.get("/api/v1/catalog/articles?popular=true&limit=1")
        self.assertEqual(article_response.status_code, 200)
        article_id = int(article_response.get_json()["items"][0]["id"])

        existing_customer_signup = self.client.post(
            "/api/v1/workflows/subscription-signup",
            json={
                "customerId": 2,
                "subscription": {
                    "magazine": "Avrobode",
                    "duration": "1-jaar",
                    "durationLabel": "1 jaar",
                    "startDate": "2026-03-01",
                },
                "contactEntry": {"type": "Nieuw abonnement", "description": "Aangemaakt in unit test"},
            },
        )
        self.assertEqual(existing_customer_signup.status_code, 201)
        self.assertFalse(existing_customer_signup.get_json()["createdCustomer"])

        new_customer_signup = self.client.post(
            "/api/v1/workflows/subscription-signup",
            json={
                "customer": {
                    "salutation": "Dhr.",
                    "firstName": "Workflow",
                    "middleName": "",
                    "lastName": "Nieuw",
                    "postalCode": "1234ZZ",
                    "houseNumber": "7",
                    "address": "Workflowlaan 7",
                    "city": "Api City",
                    "email": "workflow.nieuw@example.org",
                    "phone": "0600000000",
                },
                "subscription": {
                    "magazine": "Mikrogids",
                    "duration": "2-jaar",
                    "startDate": "2026-04-01",
                },
            },
        )
        self.assertEqual(new_customer_signup.status_code, 201)
        self.assertTrue(new_customer_signup.get_json()["createdCustomer"])

        existing_customer_order = self.client.post(
            "/api/v1/workflows/article-order",
            json={
                "customerId": 1,
                "order": {
                    "desiredDeliveryDate": "2026-03-15",
                    "paymentMethod": "iDEAL",
                    "couponCode": "VIP10",
                    "items": [{"articleId": article_id, "quantity": 2}],
                },
                "contactEntry": {"type": "Artikel bestelling", "description": "Bestelling voor bestaande klant"},
            },
        )
        self.assertEqual(existing_customer_order.status_code, 201)
        self.assertFalse(existing_customer_order.get_json()["createdCustomer"])

        new_customer_order = self.client.post(
            "/api/v1/workflows/article-order",
            json={
                "customer": {
                    "salutation": "Mevr.",
                    "firstName": "Order",
                    "middleName": "",
                    "lastName": "Nieuw",
                    "postalCode": "4444DD",
                    "houseNumber": "12",
                    "address": "Orderstraat 12",
                    "city": "Orderdam",
                    "email": "order.nieuw@example.org",
                    "phone": "0677777777",
                },
                "order": {
                    "desiredDeliveryDate": "2026-03-20",
                    "paymentMethod": "iDEAL",
                    "items": [{"articleId": article_id, "quantity": 1}],
                },
            },
        )
        self.assertEqual(new_customer_order.status_code, 201)
        self.assertTrue(new_customer_order.get_json()["createdCustomer"])

    def test_call_queue_and_session_endpoints(self):
        self._authenticate()

        read_queue_response = self.client.get("/api/v1/call-queue")
        self.assertEqual(read_queue_response.status_code, 200)
        self.assertIn("queue", read_queue_response.get_json())

        empty_accept_response = self.client.post("/api/v1/call-queue/accept-next", json={})
        self.assertEqual(empty_accept_response.status_code, 400)
        self.assertEqual(empty_accept_response.get_json()["error"]["code"], "queue_empty")

        write_queue_response = self.client.put(
            "/api/v1/call-queue",
            json={
                "enabled": True,
                "queue": [
                    {
                        "id": "queue_test",
                        "callerType": "known",
                        "customerId": 1,
                        "customerName": "J. de Vries",
                        "serviceNumber": "AVROBODE",
                        "waitTime": 12,
                        "priority": 1,
                    }
                ],
                "currentPosition": 0,
                "autoAdvance": True,
            },
        )
        self.assertEqual(write_queue_response.status_code, 200)
        self.assertEqual(len(write_queue_response.get_json()["queue"]), 1)

        accept_response = self.client.post("/api/v1/call-queue/accept-next", json={})
        self.assertEqual(accept_response.status_code, 200)
        accepted_payload = accept_response.get_json()
        self.assertTrue(accepted_payload["call_session"]["active"])

        read_call_session_response = self.client.get("/api/v1/call-session")
        self.assertEqual(read_call_session_response.status_code, 200)
        self.assertTrue(read_call_session_response.get_json()["call_session"]["active"])

        hold_response = self.client.post("/api/v1/call-session/hold", json={})
        self.assertEqual(hold_response.status_code, 200)
        self.assertTrue(hold_response.get_json()["onHold"])

        resume_response = self.client.post("/api/v1/call-session/resume", json={})
        self.assertEqual(resume_response.status_code, 200)
        self.assertFalse(resume_response.get_json()["onHold"])

        write_call_session_response = self.client.put(
            "/api/v1/call-session",
            json={"recordingActive": True},
        )
        self.assertEqual(write_call_session_response.status_code, 200)
        self.assertTrue(write_call_session_response.get_json()["recordingActive"])

        end_response = self.client.post("/api/v1/call-session/end", json={"forcedByCustomer": False})
        self.assertEqual(end_response.status_code, 200)
        self.assertFalse(end_response.get_json()["call_session"]["active"])
        self.assertIsNotNone(end_response.get_json()["last_call_session"])

        disposition_response = self.client.post(
            "/api/v1/call-session/disposition",
            json={
                "category": "general",
                "outcome": "info_provided",
                "notes": "Geholpen in endpoint test",
                "followUpRequired": True,
                "followUpDate": "2026-04-10",
                "followUpNotes": "Controleer status",
            },
        )
        self.assertEqual(disposition_response.status_code, 200)
        self.assertEqual(disposition_response.get_json()["status"], "saved")

        start_debug_response = self.client.post(
            "/api/v1/call-session/start-debug",
            json={
                "callerType": "known",
                "customerId": 2,
                "customerName": "M. Jansen",
                "serviceNumber": "MIKROGIDS",
                "waitTime": 5,
            },
        )
        self.assertEqual(start_debug_response.status_code, 200)
        self.assertTrue(start_debug_response.get_json()["active"])

        identify_response = self.client.post("/api/v1/call-session/identify-caller", json={"customerId": 2})
        self.assertEqual(identify_response.status_code, 200)
        self.assertEqual(identify_response.get_json()["callerType"], "identified")

        debug_generate_response = self.client.post(
            "/api/v1/call-queue/debug-generate",
            json={"queueSize": 3, "queueMix": "balanced"},
        )
        self.assertEqual(debug_generate_response.status_code, 200)
        self.assertEqual(len(debug_generate_response.get_json()["queue"]), 3)

        clear_queue_response = self.client.delete("/api/v1/call-queue")
        self.assertEqual(clear_queue_response.status_code, 200)
        self.assertEqual(clear_queue_response.get_json()["queue"], [])

    def test_debug_reset_endpoint(self):
        self._authenticate()

        seed_queue_response = self.client.post(
            "/api/v1/call-queue/debug-generate",
            json={"queueSize": 2, "queueMix": "all_known"},
        )
        self.assertEqual(seed_queue_response.status_code, 200)
        self.assertGreaterEqual(len(seed_queue_response.get_json()["queue"]), 1)

        reset_response = self.client.post("/api/v1/debug/reset-poc-state", json={})
        self.assertEqual(reset_response.status_code, 200)
        reset_payload = reset_response.get_json()
        self.assertEqual(reset_payload["status"], "ok")
        self.assertFalse(reset_payload["call_queue"]["enabled"])
        self.assertFalse(reset_payload["call_session"]["active"])

    def test_swagger_endpoints(self):
        self._authenticate()

        document_response = self.client.get("/api/v1/swagger.json")
        self.assertEqual(document_response.status_code, 200)

        document = document_response.get_json()
        self.assertEqual(document["openapi"], "3.0.3")
        self.assertIn("/api/v1/customers", document["paths"])
        self.assertIn("/api/v1/call-session/disposition", document["paths"])
        self.assertIn("/api/v1/status", document["paths"])
        self.assertIn("get", document["paths"]["/api/v1/status"])
        self.assertNotIn("head", document["paths"]["/api/v1/status"])
        self.assertIn("cookieAuth", document["components"]["securitySchemes"])

        customers_get = document["paths"]["/api/v1/customers"]["get"]
        self.assertEqual(customers_get["security"], [{"cookieAuth": []}])

        status_get = document["paths"]["/api/v1/status"]["get"]
        self.assertNotIn("security", status_get)

        ui_response = self.client.get("/api/v1/swagger")
        self.assertEqual(ui_response.status_code, 200)
        self.assertIn("SwaggerUIBundle", ui_response.get_data(as_text=True))


if __name__ == "__main__":
    unittest.main()
