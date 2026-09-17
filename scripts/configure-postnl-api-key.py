#!/usr/bin/env python3
"""Interactively update Kiwi's existing SOPS secret; never deploy or print secrets."""
import argparse
import base64
import copy
import getpass
import json
import os
from pathlib import Path
import re
import resource
import shutil
import subprocess
import sys
import tempfile
import warnings


class ConfigurationError(Exception):
    pass


def sops(*args, value=None):
    result = subprocess.run(
        ['sops', *map(str, args)], input=value, capture_output=True, check=False,
    )
    if result.returncode:
        # SOPS diagnostics can contain decrypted values (including MAC errors).
        stages = {'--decrypt': 'decrypt/verify', 'set': 'update', 'filestatus': 'check encryption'}
        stage = 'check SOPS support' if '--help' in args else stages.get(args[0], 'operation')
        raise ConfigurationError(
            f'SOPS failed during {stage} (exit {result.returncode}); no file was replaced. '
            'Check your local decryption access. For the documented age identity, use '
            '--age-key-file ~/age.agekey or export SOPS_AGE_KEY_FILE=~/age.agekey. '
            'Raw diagnostics are hidden to protect secrets.'
        )
    return result.stdout


def configure_age_identity(path):
    if path is None:
        return
    path = path.expanduser().absolute()
    if not path.is_file() or not os.access(path, os.R_OK):
        raise ConfigurationError('The selected age identity file is missing or unreadable.')
    # Only SOPS reads this file. Keep the private identity out of this process.
    os.environ['SOPS_AGE_KEY_FILE'] = str(path)


def update_document(document, key):
    updated = copy.deepcopy(document)
    if updated.get('kind') != 'Secret' or updated.get('metadata', {}).get('name') != 'kiwi-oidc-client':
        raise ConfigurationError('Expected the existing kiwi-oidc-client Kubernetes Secret.')
    field = 'client_secrets.json'
    sections = [name for name in ('data', 'stringData') if field in updated.get(name, {})]
    if len(sections) != 1:
        raise ConfigurationError('Expected exactly one client_secrets.json entry.')
    section = sections[0]
    value = updated[section][field]
    if section == 'data':
        value = base64.b64decode(value, validate=True).decode('utf-8')
    config = json.loads(value)
    if not isinstance(config, dict) or not isinstance(config.get('postnl', {}), dict):
        raise ConfigurationError('Invalid client configuration structure.')
    config.setdefault('postnl', {})['api_key'] = key
    value = json.dumps(config, indent=2, ensure_ascii=False) + '\n'
    if section == 'data':
        value = base64.b64encode(value.encode()).decode('ascii')
    updated[section][field] = value
    return updated, section, value


def configure(target, key):
    if target.is_symlink() or not target.is_file():
        raise ConfigurationError('Select an existing, regular SOPS file (no symlinks).')
    original = target.read_bytes()
    # Only ciphertext is written to disk. Failures preserve the original.
    with tempfile.TemporaryDirectory(prefix='.postnl-', dir=target.parent) as directory:
        staged = Path(directory) / target.name
        staged.write_bytes(original)
        staged.chmod(0o600)
        status = json.loads(sops('filestatus', staged))
        if not status.get('encrypted'):
            raise ConfigurationError('The selected file is not SOPS encrypted.')
        document = json.loads(sops('--decrypt', '--output-type', 'json', staged))
        expected, section, value = update_document(document, key)
        sops('set', '--value-stdin', staged, f'["{section}"]["client_secrets.json"]',
             value=json.dumps(value).encode())
        actual = json.loads(sops('--decrypt', '--output-type', 'json', staged))
        if actual != expected:
            raise ConfigurationError('Verification failed; the original file was preserved.')
        ciphertext = staged.read_bytes()
        encrypted_field = re.search(rb'^\s*[\'\"]?client_secrets\.json[\'\"]?:\s*ENC\[AES256_GCM,', ciphertext, re.MULTILINE)
        if not encrypted_field or value.encode() in ciphertext or key.encode() in ciphertext:
            raise ConfigurationError('Encryption check failed; the original file was preserved.')
        if target.read_bytes() != original:
            raise ConfigurationError('The target changed during entry; refusing to overwrite it.')
        os.replace(staged, target)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('secret_file', type=Path, help='Existing oidc-client-secrets.sops.yaml in your GitOps worktree')
    parser.add_argument('--age-key-file', type=Path, help='Local age identity path; otherwise retain existing SOPS configuration')
    args = parser.parse_args()
    resource.setrlimit(resource.RLIMIT_CORE, (0, 0))
    os.umask(0o077)
    try:
        configure_age_identity(args.age_key_file)
        if not sys.stdin.isatty() or not sys.stderr.isatty():
            raise ConfigurationError('Run interactively in a local terminal; piped key input is disabled.')
        if not shutil.which('sops'):
            raise ConfigurationError('Install SOPS with set --value-stdin support (tested with 3.11).')
        if b'--value-stdin' not in sops('set', '--help'):
            raise ConfigurationError('Upgrade SOPS: set --value-stdin is required.')
        print(f'Encrypted target: {args.secret_file.absolute()}')
        print('Only postnl.api_key will change. No commit, push or cluster update is performed.')
        with warnings.catch_warnings():
            warnings.simplefilter('error', getpass.GetPassWarning)
            key = getpass.getpass('PostNL API key (hidden): ')
            confirmation = getpass.getpass('Repeat PostNL API key (hidden): ')
        if not key or key != key.strip() or any(char.isspace() for char in key):
            raise ConfigurationError('The API key must be nonempty and contain no whitespace.')
        if key != confirmation:
            raise ConfigurationError('The entries differ; nothing was changed.')
        configure(args.secret_file.absolute(), key)
        print('PostNL key saved encrypted and verified. Existing configuration preserved.')
        print('Commit and deployment remain separate steps in the approved GitOps workflow.')
        return 0
    except ConfigurationError as error:
        print(str(error), file=sys.stderr)
    except (KeyboardInterrupt, EOFError):
        print('\nCancelled; no completed update.', file=sys.stderr)
    except Exception:
        # Never include parser errors or tracebacks containing decrypted configuration.
        print('Configuration failed; secret-bearing diagnostics were suppressed.', file=sys.stderr)
    return 1


if __name__ == '__main__':
    sys.exit(main())
