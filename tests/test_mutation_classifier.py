import os
import sys
import unittest

import requests

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "app")))

from services.mutations.classifier import classify_http_status, classify_request_exception  # noqa: E402


class MutationClassifierTests(unittest.TestCase):
    def test_transient_http_status_is_retryable(self):
        outcome = classify_http_status(503, "Service unavailable")
        self.assertFalse(outcome.success)
        self.assertTrue(outcome.retryable)
        self.assertEqual(outcome.failure_class, "transient")

    def test_permanent_http_status_is_not_retryable(self):
        outcome = classify_http_status(400, "Bad request")
        self.assertFalse(outcome.success)
        self.assertFalse(outcome.retryable)
        self.assertEqual(outcome.failure_class, "permanent")

    def test_timeout_exception_is_retryable(self):
        outcome = classify_request_exception(requests.exceptions.Timeout("timeout"))
        self.assertFalse(outcome.success)
        self.assertTrue(outcome.retryable)
        self.assertEqual(outcome.failure_class, "transient")


if __name__ == "__main__":
    unittest.main()
