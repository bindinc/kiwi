import base64
import importlib.util
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

spec = importlib.util.spec_from_file_location('configure_postnl', Path(__file__).parents[2] / 'scripts/configure-postnl-api-key.py')
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


class ConfigurationTests(unittest.TestCase):
    def document(self, section='stringData'):
        config = {'web': {'client_id': 'fixture'}, 'hup': {'credentials': ['fixture']}, 'postnl': {'other': True}}
        value = json.dumps(config)
        if section == 'data':
            value = base64.b64encode(value.encode()).decode()
        return {'kind': 'Secret', 'metadata': {'name': 'kiwi-oidc-client'}, section: {'client_secrets.json': value, 'other': 'fixture'}}

    def test_preserves_other_configuration_in_both_formats(self):
        for section in ('data', 'stringData'):
            with self.subTest(section=section):
                original = self.document(section)
                updated, selected, value = module.update_document(original, 'synthetic-test-value')
                self.assertEqual(selected, section)
                if section == 'data':
                    value = base64.b64decode(value).decode()
                config = json.loads(value)
                self.assertEqual(config['web'], {'client_id': 'fixture'})
                self.assertEqual(config['hup'], {'credentials': ['fixture']})
                self.assertEqual(config['postnl'], {'other': True, 'api_key': 'synthetic-test-value'})
                self.assertEqual(updated[section]['other'], 'fixture')
                self.assertEqual(original, self.document(section))

    def test_rejects_wrong_secret_and_duplicate_fields(self):
        document = self.document()
        document['metadata']['name'] = 'different'
        with self.assertRaises(module.ConfigurationError):
            module.update_document(document, 'synthetic')
        document = self.document()
        document['data'] = self.document('data')['data']
        with self.assertRaises(module.ConfigurationError):
            module.update_document(document, 'synthetic')

    def run_configure(self, failure=None):
        document = self.document()
        updated, _, value = module.update_document(document, 'synthetic-test-value')
        decrypts = 0
        with tempfile.TemporaryDirectory() as directory:
            target = Path(directory) / 'fixture.sops.yaml'
            target.write_bytes(b'original-fixture-ciphertext')

            def fake_sops(*args, value=None):
                nonlocal decrypts
                if args[0] == 'filestatus':
                    return b'{"encrypted":true}'
                if args[0] == '--decrypt':
                    decrypts += 1
                    result = document if decrypts == 1 or failure == 'verification' else updated
                    return json.dumps(result).encode()
                self.assertEqual(args[:2], ('set', '--value-stdin'))
                self.assertNotIn('synthetic-test-value', str(args))
                self.assertIn('synthetic-test-value', json.loads(value))
                if failure == 'sops':
                    raise module.ConfigurationError('Synthetic SOPS failure')
                Path(args[2]).write_bytes(b'client_secrets.json: ENC[AES256_GCM,synthetic]')
                if failure == 'concurrent':
                    target.write_bytes(b'concurrent-edit')
                return b''

            with patch.object(module, 'sops', side_effect=fake_sops):
                if failure:
                    with self.assertRaises(module.ConfigurationError):
                        module.configure(target, 'synthetic-test-value')
                    expected = b'concurrent-edit' if failure == 'concurrent' else b'original-fixture-ciphertext'
                else:
                    module.configure(target, 'synthetic-test-value')
                    expected = b'client_secrets.json: ENC[AES256_GCM,synthetic]'
                self.assertEqual(target.read_bytes(), expected)
                self.assertEqual(list(Path(directory).iterdir()), [target])

    def test_atomic_update_using_stdin(self):
        self.run_configure()

    def test_failures_preserve_original_and_remove_temporary_files(self):
        for failure in ('sops', 'verification', 'concurrent'):
            with self.subTest(failure=failure):
                self.run_configure(failure)

    def test_sops_diagnostics_are_not_exposed(self):
        with patch.object(module.subprocess, 'run') as run:
            run.return_value.returncode = 1
            run.return_value.stderr = b'synthetic-sensitive-diagnostic'
            with self.assertRaises(module.ConfigurationError) as error:
                module.sops('set')
            self.assertNotIn('synthetic-sensitive-diagnostic', str(error.exception))


if __name__ == '__main__':
    unittest.main()
