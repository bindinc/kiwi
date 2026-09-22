from pathlib import Path
import shutil
import subprocess
import tempfile
import unittest


class AppEntrypointTests(unittest.TestCase):
    def setUp(self):
        self.workspace = tempfile.TemporaryDirectory()
        self.addCleanup(self.workspace.cleanup)
        self.root = Path(self.workspace.name)
        (self.root / 'scripts').mkdir()
        (self.root / 'vendor').mkdir()
        (self.root / 'vendor/autoload.php').touch()
        (self.root / 'bin').mkdir()
        shutil.copyfile(
            Path(__file__).parents[2] / 'scripts/app-entrypoint.sh',
            self.root / 'scripts/app-entrypoint.sh',
        )
        # Isolate startup behavior from real OIDC configuration and services.
        (self.root / 'scripts/resolve-oidc-mode.sh').write_text(
            "printf 'OIDC_MODE=external\\nOIDC_CLIENT_SECRETS_PATH=/unused\\n'\n"
        )
        self.command('php', 'printf "php %s\\n" "$*" >> "$STARTUP_EVENTS"\n'
                     'exit "$MIGRATION_EXIT_CODE"\n')
        self.command('frankenphp', 'printf "server\\n" >> "$STARTUP_EVENTS"\n')

    def command(self, name, script):
        path = self.root / 'bin' / name
        path.write_text('#!/bin/sh\n' + script)
        path.chmod(0o755)

    def run_startup(self, app_env, migration_exit_code):
        events = self.root / 'events'
        events.write_text('')
        result = subprocess.run(
            ['/bin/sh', str(self.root / 'scripts/app-entrypoint.sh')],
            cwd=self.root,
            env={
                'PATH': f'{self.root / "bin"}:/usr/bin:/bin',
                'APP_ENV': app_env,
                'TEAMS_PRESENCE_SYNC_ENABLED': 'false',
                'SESSION_BOOTSTRAP_ON_START': '0',
                'WEBABO_OFFER_SYNC_ON_START': '0',
                'STARTUP_EVENTS': str(events),
                'MIGRATION_EXIT_CODE': str(migration_exit_code),
            },
            capture_output=True, text=True, timeout=10,
        )
        return result, events.read_text().splitlines()

    def test_every_start_migrates_before_serving_in_dev_and_prod(self):
        for app_env in ['dev', 'prod']:
            for restart in range(2):
                with self.subTest(app_env=app_env, restart=restart):
                    result, events = self.run_startup(app_env, 0)
                    self.assertEqual(result.returncode, 0, result.stderr)
                    self.assertEqual(events, [
                        'php bin/console app:outbox-sessions:migrate --no-interaction',
                        'server',
                    ])

    def test_failed_migration_never_starts_server(self):
        for app_env in ['dev', 'prod']:
            with self.subTest(app_env=app_env):
                result, events = self.run_startup(app_env, 7)
                self.assertEqual(result.returncode, 7, result.stderr)
                self.assertEqual(events, [
                    'php bin/console app:outbox-sessions:migrate --no-interaction',
                ])
