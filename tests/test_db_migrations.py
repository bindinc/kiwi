import os
import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "app")))

from db.errors import MigrationChecksumError  # noqa: E402
from db.migrations import build_migration_plan, discover_migration_scripts  # noqa: E402


class MigrationPlanTests(unittest.TestCase):
    def _create_migration(self, directory: Path, filename: str, sql: str) -> None:
        (directory / filename).write_text(sql, encoding="utf-8")

    def test_build_plan_applies_only_missing_scripts(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            migrations_dir = Path(temp_dir)
            self._create_migration(migrations_dir, "001_init.sql", "CREATE TABLE one(id INT);")
            self._create_migration(migrations_dir, "002_more.sql", "CREATE TABLE two(id INT);")

            scripts = discover_migration_scripts(migrations_dir)
            applied = {scripts[0].version: scripts[0].checksum}

            plan = build_migration_plan(scripts, applied)

            self.assertEqual(plan.already_applied, ("001",))
            self.assertEqual(len(plan.to_apply), 1)
            self.assertEqual(plan.to_apply[0].version, "002")

    def test_checksum_mismatch_raises(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            migrations_dir = Path(temp_dir)
            self._create_migration(migrations_dir, "001_init.sql", "CREATE TABLE one(id INT);")
            scripts = discover_migration_scripts(migrations_dir)

            with self.assertRaises(MigrationChecksumError):
                build_migration_plan(scripts, {"001": "wrong-checksum"})


if __name__ == "__main__":
    unittest.main()
