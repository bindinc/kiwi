"""Process entrypoint for the dedicated queue worker service."""

from __future__ import annotations

from db.runtime import initialize_database
from services.queue.handlers import build_default_handlers
from services.queue.worker import OutboundJobWorker, load_worker_settings


def main() -> None:
    initialize_database()
    worker = OutboundJobWorker(
        settings=load_worker_settings(),
        handlers=build_default_handlers(),
    )
    worker.run_forever()


if __name__ == "__main__":
    main()
