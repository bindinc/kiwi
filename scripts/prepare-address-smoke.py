#!/usr/bin/env python3
"""Prepare public fixtures for isolated address tests; never load real credentials."""
import json
import pathlib
import subprocess

root = pathlib.Path(__file__).resolve().parents[1]
output = pathlib.Path('/tmp/sc-200162-smoke')
output.mkdir(exist_ok=True)
for source, target in [
    ('infra/docker/oidc/client_secrets.fallback.json', 'oidc-fixture.json'),
    ('infra/docker/oidc/realm-kiwi-local.json', 'realm-fixture.json'),
]:
    public_fixture = subprocess.check_output(['git', 'show', 'HEAD:' + source], cwd=root, text=True)
    data = json.loads(public_fixture.replace(':8443', ':9443'))
    if target == 'oidc-fixture.json':
        data['postnl'] = {'api_key': '<api-key>'}
        data['hup'] = {
            'webabo_base_url': 'https://webabo.invalid',
            'hup_oidc_token': 'https://identity.invalid/token',
            'credentials': {'test': {'username': 'test', 'password': '<password>', 'client_search': False}},
        }
    (output / target).write_text(json.dumps(data, indent=2))
(output / 'services_dev.yaml').write_text('''services:
    address.http_client:
        class: Symfony\\Contracts\\HttpClient\\HttpClientInterface
        factory: [App\\Tests\\Support\\AddressSmokeHttpClientFactory, create]
    address.smoke_session_factory:
        alias: session.factory
        public: true
''')
(output / 'compose.yaml').write_text('''services:
    fallback-oidc:
        environment:
            KC_HOSTNAME: https://bdc.rtvmedia.org.local:9443/kiwi-oidc
        volumes:
            - /tmp/sc-200162-smoke/realm-fixture.json:/opt/keycloak/data/import/realm-kiwi-local.json:ro
    app:
        environment:
            WEBABO_OFFER_SYNC_ON_START: '0'
        volumes:
            - /tmp/sc-200162-smoke/oidc-fixture.json:/app/infra/docker/oidc/client_secrets.fallback.json:ro
            - /tmp/sc-200162-smoke/services_dev.yaml:/app/config/services_dev.yaml:ro
''')
print('Prepared public test fixtures in /tmp/sc-200162-smoke')
