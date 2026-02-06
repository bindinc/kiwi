"""Retry delay policy for outbound jobs."""

from __future__ import annotations

from dataclasses import dataclass


DEFAULT_DELAYS_SECONDS = (5, 15, 45, 135, 300, 900, 1800, 3600)


@dataclass(frozen=True)
class RetryPolicy:
    """Maps attempt number to the next retry delay."""

    delays_seconds: tuple[int, ...] = DEFAULT_DELAYS_SECONDS

    def next_delay_seconds(self, attempt_no: int) -> int | None:
        if attempt_no < 1:
            return self.delays_seconds[0]

        if attempt_no > len(self.delays_seconds):
            return None

        return self.delays_seconds[attempt_no - 1]
