"""Process entrypoint for the dedicated queue worker service."""

from __future__ import annotations

from db.runtime import initialize_database
from services.queue.worker import OutboundJobWorker, load_worker_settings


def main() -> None:
    initialize_database()
    worker = OutboundJobWorker(settings=load_worker_settings())
    worker.run_forever()


if __name__ == "__main__":
    main()
