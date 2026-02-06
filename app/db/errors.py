"""Database layer exceptions."""


class MigrationChecksumError(RuntimeError):
    """Raised when an already applied migration script was modified."""
