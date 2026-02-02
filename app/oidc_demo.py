"""
Flask-OIDC applicatie om te controleren of de ingelogde gebruiker
de rol 'bink8s.app.kiwi.admin' heeft binnen de applicatie 'bink8s-kiwi'.

Gebruiker: bdeijk01@rtvmedia.org (Entra ID)
"""

from flask import Flask, g, session, redirect, url_for, jsonify, Response
from flask_oidc import OpenIDConnect
from flask_session import Session
import json
import os
import base64
import requests
from urllib.parse import urlparse
from werkzeug.middleware.proxy_fix import ProxyFix

APP_DIR = os.path.dirname(os.path.abspath(__file__))
DEFAULT_CLIENT_SECRETS = os.path.join(APP_DIR, 'client_secrets.json')


def decode_jwt_payload(token):
    """Decode the payload of a JWT token without verification (for debugging)."""
    try:
        # JWT format: header.payload.signature
        parts = token.split('.')
        if len(parts) != 3:
            return None
        
        # Decode the payload (second part)
        payload = parts[1]
        # Add padding if needed
        padding = 4 - len(payload) % 4
        if padding != 4:
            payload += '=' * padding
        
        decoded = base64.urlsafe_b64decode(payload)
        return json.loads(decoded)
    except Exception as e:
        return {'decode_error': str(e)}

def get_redirect_uri_from_secrets(path):
    try:
        with open(path, 'r', encoding='utf-8') as handle:
            data = json.load(handle)
    except (OSError, json.JSONDecodeError):
        return None

    redirect_uris = data.get('web', {}).get('redirect_uris', [])
    if not isinstance(redirect_uris, list) or not redirect_uris:
        return None
    return redirect_uris[0]


def get_callback_route(redirect_uri):
    if not redirect_uri:
        return None
    parsed = urlparse(redirect_uri)
    path = parsed.path or '/'
    if not path.startswith('/'):
        path = '/' + path
    return path


def normalize_base_path(value):
    if not value or value == '/':
        return ''
    value = value.strip()
    if not value.startswith('/'):
        value = '/' + value
    return value.rstrip('/')


app = Flask(__name__)
app.wsgi_app = ProxyFix(app.wsgi_app, x_for=1, x_proto=1, x_host=1, x_prefix=1)
client_secrets_path = os.environ.get('OIDC_CLIENT_SECRETS', DEFAULT_CLIENT_SECRETS)
redirect_uri = get_redirect_uri_from_secrets(client_secrets_path)
callback_route = get_callback_route(redirect_uri)
session_type = os.environ.get('SESSION_TYPE', 'filesystem')
session_dir = os.environ.get('SESSION_FILE_DIR', '/tmp/flask_session')
app.config.update({
    'SECRET_KEY': os.environ.get('FLASK_SECRET_KEY', 'development-secret-key-change-in-production'),
    'OIDC_CLIENT_SECRETS': client_secrets_path,
    'OIDC_SCOPES': 'openid email profile User.Read',  # User.Read voor profile picture
    'OIDC_USER_INFO_ENABLED': True,
    'SESSION_TYPE': session_type,
    'SESSION_FILE_DIR': session_dir,
    'SESSION_PERMANENT': False,
    'SESSION_USE_SIGNER': True,
})
if redirect_uri:
    app.config['OIDC_OVERWRITE_REDIRECT_URI'] = redirect_uri
if callback_route:
    app.config['OIDC_CALLBACK_ROUTE'] = callback_route
if session_type == 'filesystem':
    os.makedirs(session_dir, exist_ok=True)

Session(app)

BASE_PATH = normalize_base_path(os.environ.get('APP_BASE_PATH', ''))

oidc = OpenIDConnect(app, prefix=BASE_PATH or None)


def get_user_roles():
    """
    Haal de rollen van de ingelogde gebruiker op uit de OIDC token claims.
    Microsoft Entra ID stuurt app roles in de 'roles' claim van de ID token.
    """
    roles = []
    
    # Methode 1: Probeer roles uit de ID token te halen (waar Entra ID ze plaatst)
    if 'oidc_auth_token' in session:
        token_data = session['oidc_auth_token']
        # Token data kan een dict zijn met 'id_token' of direct claims bevatten
        if isinstance(token_data, dict):
            # Check of er een id_token is die we kunnen decoderen
            if 'id_token' in token_data:
                id_token_claims = decode_jwt_payload(token_data['id_token'])
                if id_token_claims:
                    roles = id_token_claims.get('roles', [])
            # Of misschien zijn de claims al geëxtraheerd
            if not roles:
                roles = token_data.get('roles', [])
    
    # Methode 2: Probeer roles uit de session profile te halen (backup)
    if not roles and 'oidc_auth_profile' in session:
        profile = session['oidc_auth_profile']
        roles = profile.get('roles', [])
    
    return roles


def get_all_token_info():
    """
    Haal alle beschikbare token informatie op voor debugging.
    """
    info = {
        'session_keys': list(session.keys()),
        'oidc_auth_profile': session.get('oidc_auth_profile'),
        'oidc_auth_token': None,
        'id_token_decoded': None,
        'access_token_decoded': None,
    }
    
    if 'oidc_auth_token' in session:
        token_data = session['oidc_auth_token']
        # Maak een kopie zonder gevoelige tokens zelf te tonen (alleen structuur)
        if isinstance(token_data, dict):
            info['oidc_auth_token'] = {
                'keys': list(token_data.keys()),
                'token_type': token_data.get('token_type'),
                'expires_in': token_data.get('expires_in'),
                'scope': token_data.get('scope'),
                'has_id_token': 'id_token' in token_data,
                'has_access_token': 'access_token' in token_data,
            }
            
            # Decodeer de ID token voor debugging
            if 'id_token' in token_data:
                info['id_token_decoded'] = decode_jwt_payload(token_data['id_token'])
            
            # Decodeer de access token voor debugging
            if 'access_token' in token_data:
                info['access_token_decoded'] = decode_jwt_payload(token_data['access_token'])
        else:
            info['oidc_auth_token'] = {'raw_type': str(type(token_data))}
    
    return info


def has_role(role_name):
    """Controleer of de gebruiker een specifieke rol heeft."""
    roles = get_user_roles()
    return role_name in roles


def get_profile_picture_base64():
    """
    Haal de profielfoto op van Microsoft Graph API en return als base64 data URL.
    Returns None als de foto niet beschikbaar is.
    """
    if 'oidc_auth_token' not in session:
        return None
    
    token_data = session['oidc_auth_token']
    if not isinstance(token_data, dict) or 'access_token' not in token_data:
        return None
    
    access_token = token_data['access_token']
    
    try:
        response = requests.get(
            'https://graph.microsoft.com/v1.0/me/photo/$value',
            headers={'Authorization': f'Bearer {access_token}'},
            timeout=5
        )
        if response.status_code == 200:
            # Convert to base64 data URL
            content_type = response.headers.get('Content-Type', 'image/jpeg')
            photo_base64 = base64.b64encode(response.content).decode('utf-8')
            return f'data:{content_type};base64,{photo_base64}'
    except Exception as e:
        print(f"Kon profielfoto niet ophalen: {e}")
    
    return None


# De rol die we controleren
REQUIRED_ROLE = 'bink8s.app.kiwi.admin'


@app.route(f"{BASE_PATH}/")
def index():
    """Homepage met login status en rol check."""
    if oidc.user_loggedin:
        return redirect(url_for('check_role'))
    login_url = url_for('oidc_auth.login', next=url_for('check_role'))
    return f'''
    <html>
    <head>
        <title>OIDC Role Check - bink8s-kiwi</title>
        <style>
            body {{ font-family: Arial, sans-serif; max-width: 800px; margin: 50px auto; padding: 20px; }}
            .btn {{ padding: 10px 20px; background: #0078d4; color: white; text-decoration: none; border-radius: 5px; }}
            .btn:hover {{ background: #106ebe; }}
        </style>
    </head>
    <body>
        <h1>OIDC Role Check</h1>
        <p>Applicatie: <strong>bink8s-kiwi</strong></p>
        <p>Rol om te controleren: <code>bink8s.app.kiwi.admin</code></p>
        <hr>
        <p>Je bent nog niet ingelogd.</p>
        <a class="btn" href="{login_url}">Inloggen met Microsoft Entra ID</a>
    </body>
    </html>
    '''


@app.route(f"{BASE_PATH}/check-role")
@oidc.require_login
def check_role():
    """Controleer of de ingelogde gebruiker de vereiste rol heeft."""
    profile = session.get('oidc_auth_profile', {})
    email = profile.get('email', profile.get('preferred_username', 'Onbekend'))
    name = profile.get('name', email)
    roles = get_user_roles()
    has_admin_role = REQUIRED_ROLE in roles
    
    # Haal profielfoto op
    profile_picture = get_profile_picture_base64()
    profile_picture_html = f'<img src="{profile_picture}" alt="Profielfoto" class="profile-picture">' if profile_picture else '<div class="profile-picture profile-placeholder">👤</div>'
    
    # Haal alle token info op voor debugging
    token_info = get_all_token_info()
    
    # Status kleuren en iconen
    status_color = '#107c10' if has_admin_role else '#d13438'
    status_icon = 'OK' if has_admin_role else 'Failed:'
    status_text = 'JA - Je hebt toegang!' if has_admin_role else 'NEE - Je hebt deze rol niet'
    
    roles_html = '<ul>' + ''.join(f'<li><code>{role}</code></li>' for role in roles) + '</ul>' if roles else '<em>Geen rollen gevonden in token</em>'
    
    # Maak een mooie weergave van de token info
    id_token_html = '<pre>' + json.dumps(token_info.get('id_token_decoded'), indent=2, default=str) + '</pre>' if token_info.get('id_token_decoded') else '<em>Geen ID token gevonden</em>'
    access_token_html = '<pre>' + json.dumps(token_info.get('access_token_decoded'), indent=2, default=str) + '</pre>' if token_info.get('access_token_decoded') else '<em>Geen access token gevonden</em>'
    session_keys_html = '<code>' + ', '.join(token_info.get('session_keys', [])) + '</code>'
    token_structure_html = '<pre>' + json.dumps(token_info.get('oidc_auth_token'), indent=2, default=str) + '</pre>' if token_info.get('oidc_auth_token') else '<em>Geen token data</em>'
    
    api_roles_url = url_for('api_roles')
    logout_url = url_for('oidc_auth.logout', next=url_for('index'))
    return f'''
    <html>
    <head>
        <title>Role Check Resultaat - bink8s-kiwi</title>
        <style>
            body {{ font-family: Arial, sans-serif; max-width: 1000px; margin: 50px auto; padding: 20px; }}
            .status {{ padding: 20px; border-radius: 10px; margin: 20px 0; }}
            .status.success {{ background: #dff6dd; border: 2px solid #107c10; }}
            .status.failure {{ background: #fde7e9; border: 2px solid #d13438; }}
            code {{ background: #f4f4f4; padding: 2px 6px; border-radius: 3px; }}
            pre {{ background: #1e1e1e; color: #d4d4d4; padding: 15px; border-radius: 5px; overflow-x: auto; font-size: 12px; max-height: 400px; overflow-y: auto; }}
            .btn {{ padding: 10px 20px; background: #0078d4; color: white; text-decoration: none; border-radius: 5px; display: inline-block; margin: 5px; }}
            .btn:hover {{ background: #106ebe; }}
            .btn.logout {{ background: #605e5c; }}
            .info {{ background: #f4f4f4; padding: 15px; border-radius: 5px; margin: 10px 0; }}
            .profile-picture {{ width: 80px; height: 80px; border-radius: 50%; object-fit: cover; border: 3px solid #0078d4; }}
            .profile-placeholder {{ background: #e1e1e1; display: flex; align-items: center; justify-content: center; font-size: 40px; }}
            .user-header {{ display: flex; align-items: center; gap: 20px; }}
            .user-details {{ flex: 1; }}
            .debug {{ background: #fff3cd; padding: 15px; border-radius: 5px; margin: 10px 0; border: 1px solid #ffc107; }}
            h2 {{ color: #323130; }}
            h3 {{ color: #605e5c; margin-top: 15px; }}
            .highlight {{ background: #fff3cd; padding: 2px 6px; border-radius: 3px; }}
        </style>
    </head>
    <body>
        <h1>OIDC Role Check Resultaat</h1>
        
        <div class="info">
            <div class="user-header">
                {profile_picture_html}
                <div class="user-details">
                    <h2 style="margin-top: 0;">Ingelogde Gebruiker</h2>
                    <p><strong>Naam:</strong> {name}</p>
                    <p><strong>Email:</strong> {email}</p>
                </div>
            </div>
        </div>
        
        <div class="status {'success' if has_admin_role else 'failure'}">
            <h2>{status_icon} Rol Check: <code>{REQUIRED_ROLE}</code></h2>
            <p style="font-size: 1.2em; color: {status_color};"><strong>{status_text}</strong></p>
        </div>
        
        <div class="info">
            <h2>Alle Rollen Gevonden</h2>
            {roles_html}
        </div>
        
        <hr>
        <h1>Complete Token Debug Informatie</h1>
        
        <div class="debug">
            <h2>Session Keys</h2>
            <p>{session_keys_html}</p>
        </div>
        
        <div class="debug">
            <h2>ID Token (Decoded) - <span class="highlight">Hier moeten de roles staan!</span></h2>
            <p><em>Microsoft Entra ID plaatst app roles in de ID token onder de 'roles' claim.</em></p>
            {id_token_html}
        </div>
        
        <div class="debug">
            <h2>Access Token (Decoded)</h2>
            {access_token_html}
        </div>
        
        <div class="debug">
            <h2>Token Data Structuur</h2>
            {token_structure_html}
        </div>
        
        <div class="info">
            <h2>UserInfo Profile (van /userinfo endpoint)</h2>
            <p><em>Let op: Microsoft's userinfo endpoint bevat GEEN app roles!</em></p>
            <pre>{json.dumps(profile, indent=2, default=str)}</pre>
        </div>
        
        <hr>
        <a class="btn" href="{api_roles_url}">Bekijk Roles als JSON</a>
        <a class="btn logout" href="{logout_url}">Uitloggen</a>
    </body>
    </html>
    '''


@app.route(f"{BASE_PATH}/api/roles")
@oidc.require_login
def api_roles():
    """API endpoint dat de rollen als JSON teruggeeft."""
    profile = session.get('oidc_auth_profile', {})
    roles = get_user_roles()
    token_info = get_all_token_info()
    
    return jsonify({
        'user': {
            'email': profile.get('email', profile.get('preferred_username')),
            'name': profile.get('name'),
            'sub': profile.get('sub'),
        },
        'roles': roles,
        'role_check': {
            'required_role': REQUIRED_ROLE,
            'has_role': REQUIRED_ROLE in roles
        },
        'debug': {
            'session_keys': token_info.get('session_keys'),
            'token_structure': token_info.get('oidc_auth_token'),
            'id_token_decoded': token_info.get('id_token_decoded'),
            'access_token_decoded': token_info.get('access_token_decoded'),
            'userinfo_profile': profile
        }
    })


if __name__ == '__main__':
    print("=" * 60)
    print("OIDC Role Check voor bink8s-kiwi")
    print("=" * 60)
    print(f"Rol om te controleren: {REQUIRED_ROLE}")
    if BASE_PATH:
        print(f"Base path: {BASE_PATH}")
    print()
    print("Zorg ervoor dat je client_secrets.json hebt geconfigureerd!")
    host = os.environ.get('FLASK_HOST', '0.0.0.0')
    port = int(os.environ.get('PORT', '5000'))
    debug = os.environ.get('FLASK_DEBUG', '').lower() in ('1', 'true', 'yes')
    local_path = f"{BASE_PATH}/" if BASE_PATH else '/'
    print(f"Start de app en ga naar: http://localhost:{port}{local_path}")
    print("=" * 60)
    
    app.run(debug=debug, host=host, port=port)
