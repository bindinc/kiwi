"""Queue processing exception hierarchy."""


class RetryableJobError(RuntimeError):
    """Temporary error: the job should be retried later."""


class NonRetryableJobError(RuntimeError):
    """Permanent error: the job should move to dead-letter."""
