import os
import subprocess
import tempfile
import unittest
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[1]
SCRIPT_PATH = REPO_ROOT / "scripts" / "compose-prereqs.sh"


def run_preflight(project_root: Path) -> subprocess.CompletedProcess:
    env = os.environ.copy()
    env["COMPOSE_PROJECT_ROOT"] = str(project_root)
    return subprocess.run(
        [str(SCRIPT_PATH)],
        env=env,
        capture_output=True,
        text=True,
        check=False,
    )


class ComposePreflightTests(unittest.TestCase):
    def test_fails_when_client_secrets_file_is_missing(self):
        with tempfile.TemporaryDirectory() as tmp:
            project_root = Path(tmp)
            result = run_preflight(project_root)

            self.assertNotEqual(result.returncode, 0)
            self.assertIn("Missing required file", result.stderr)
            self.assertIn("client_secrets.example.json", result.stderr)

    def test_fails_when_client_secrets_path_is_directory(self):
        with tempfile.TemporaryDirectory() as tmp:
            project_root = Path(tmp)
            (project_root / "client_secrets.json").mkdir()

            result = run_preflight(project_root)

            self.assertNotEqual(result.returncode, 0)
            self.assertIn("Expected a file but found a directory", result.stderr)

    def test_fails_when_client_secrets_file_is_empty(self):
        with tempfile.TemporaryDirectory() as tmp:
            project_root = Path(tmp)
            (project_root / "client_secrets.json").write_text("", encoding="utf-8")

            result = run_preflight(project_root)

            self.assertNotEqual(result.returncode, 0)
            self.assertIn("File is empty", result.stderr)

    def test_passes_when_client_secrets_file_is_non_empty(self):
        with tempfile.TemporaryDirectory() as tmp:
            project_root = Path(tmp)
            (project_root / "client_secrets.json").write_text("{}", encoding="utf-8")

            result = run_preflight(project_root)

            self.assertEqual(result.returncode, 0)
            self.assertIn("Compose prerequisites OK", result.stdout)


if __name__ == "__main__":
    unittest.main()
