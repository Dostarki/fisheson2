# Frostfish SIWE wallet auth + per-wallet game state regression tests
import os
import pytest
import requests
from eth_account import Account
from eth_account.messages import encode_defunct

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/') or open('/app/frontend/.env').read().split('REACT_APP_BACKEND_URL=')[1].split('\n')[0].rstrip('/')
ORIGIN = BASE_URL
H = {'Origin': ORIGIN, 'Content-Type': 'application/json'}


def challenge(acct, chain=4663, origin=ORIGIN):
    return requests.post(f'{BASE_URL}/api/auth/challenge', json={'address': acct.address, 'chainId': chain},
                         headers={'Origin': origin} if origin else {})


def sign(acct, msg):
    sig = Account.sign_message(encode_defunct(text=msg), acct.key).signature.hex()
    return sig if sig.startswith('0x') else '0x' + sig


def verify(acct, ch, signature=None, message=None, chain=4663):
    return requests.post(f'{BASE_URL}/api/auth/verify', headers=H, json={
        'address': acct.address, 'chainId': chain, 'nonce': ch['nonce'],
        'message': message or ch['message'], 'signature': signature or sign(acct, ch['message'])})


def login(acct):
    ch = challenge(acct).json()
    r = verify(acct, ch)
    assert r.status_code == 200, r.text
    return r.json()


# Health
def test_health():
    r = requests.get(f'{BASE_URL}/api/health')
    assert r.status_code == 200
    d = r.json()
    assert d['status'] == 'ok' and d['chainId'] == 4663


# Protected endpoints + removed endpoints
@pytest.mark.parametrize('method,path', [('get', '/api/game'), ('post', '/api/game/action'),
                                         ('get', '/api/leaderboard'), ('get', '/api/characters'), ('get', '/api/auth/me')])
def test_protected_require_token(method, path):
    r = getattr(requests, method)(f'{BASE_URL}{path}', json={'type': 'buy', 'character': 'rod'} if method == 'post' else None)
    assert r.status_code == 401


def test_bad_token_401():
    r = requests.get(f'{BASE_URL}/api/game', headers={'Authorization': 'Bearer garbage'})
    assert r.status_code == 401


@pytest.mark.parametrize('method,path', [('post', '/api/sessions'), ('get', '/api/sessions'),
                                         ('get', '/api/early-access/stats'), ('post', '/api/early-access/join'),
                                         ('get', '/api/early-access/participants'), ('get', '/api/early-access/me')])
def test_removed_endpoints(method, path):
    r = getattr(requests, method)(f'{BASE_URL}{path}', json={})
    assert r.status_code in (404, 405), f'{path} -> {r.status_code}'


# Challenge validation
def test_challenge_missing_origin():
    # requests never sends Origin by default
    r = requests.post(f'{BASE_URL}/api/auth/challenge', json={'address': Account.create().address, 'chainId': 4663})
    assert r.status_code == 403


def test_challenge_foreign_origin():
    assert challenge(Account.create(), origin='https://evil.example.com').status_code == 403


def test_challenge_wrong_chain():
    assert challenge(Account.create(), chain=1).status_code == 400


def test_challenge_invalid_address():
    r = requests.post(f'{BASE_URL}/api/auth/challenge', headers=H, json={'address': '0x' + 'zz' * 20, 'chainId': 4663})
    assert r.status_code == 422


def test_challenge_message_contents():
    acct = Account.create()
    r = challenge(acct)
    assert r.status_code == 200
    d = r.json()
    m = d['message']
    assert 'Chain ID: 4663' in m
    assert m.startswith('frostfish-emerge.preview.emergentagent.com wants you to sign in')
    assert f"Nonce: {d['nonce']}" in m
    assert 'Expiration Time:' in m and 'NOT a transaction' in m
    assert acct.address in m


# Verify
def test_verify_success_and_replay():
    acct = Account.create()
    ch = challenge(acct).json()
    r = verify(acct, ch)
    assert r.status_code == 200
    d = r.json()
    assert isinstance(d['token'], str) and d['address'] == acct.address.lower() and 'game' in d
    assert verify(acct, ch).status_code == 401  # replay


def test_verify_other_key():
    acct, other = Account.create(), Account.create()
    ch = challenge(acct).json()
    assert verify(acct, ch, signature=sign(other, ch['message'])).status_code == 401


def test_verify_tampered_message():
    acct = Account.create()
    ch = challenge(acct).json()
    tampered = ch['message'].replace('Chain ID: 4663', 'Chain ID: 1')
    assert verify(acct, ch, message=tampered, signature=sign(acct, tampered)).status_code == 401


def test_verify_wrong_chain():
    acct = Account.create()
    ch = challenge(acct).json()
    assert verify(acct, ch, chain=1).status_code == 400


def test_verify_address_mismatch_with_challenge():
    acct, other = Account.create(), Account.create()
    ch = challenge(acct).json()
    r = requests.post(f'{BASE_URL}/api/auth/verify', headers=H, json={
        'address': other.address, 'chainId': 4663, 'nonce': ch['nonce'], 'message': ch['message'],
        'signature': sign(other, ch['message'])})
    assert r.status_code == 401


# Authenticated flow + persistence + logout
def test_full_flow():
    acct = Account.create()
    d = login(acct)
    auth = {'Authorization': f"Bearer {d['token']}"}
    me = requests.get(f'{BASE_URL}/api/auth/me', headers=auth).json()
    assert me['address'] == acct.address.lower() and me['chainId'] == 4663
    g = requests.get(f'{BASE_URL}/api/game', headers=auth).json()
    bal = g['balance']
    chars = requests.get(f'{BASE_URL}/api/characters', headers=auth)
    assert chars.status_code == 200 and len(chars.json()) > 0
    r = requests.post(f'{BASE_URL}/api/game/action', headers=auth, json={'type': 'buy', 'character': 'rod'})
    assert r.status_code == 200, r.text
    g2 = r.json()
    assert abs((bal - g2['balance']) - 10) < 0.01, (bal, g2['balance'])
    assert len(g2['workers']) == 1
    lb = requests.get(f'{BASE_URL}/api/leaderboard', headers=auth)
    assert lb.status_code == 200 and lb.json()['you'] is not None
    # re-login same wallet => same state
    d2 = login(acct)
    assert len(d2['game']['workers']) == 1 and d2['game']['name'] == g2['name']
    # logout
    assert requests.post(f'{BASE_URL}/api/auth/logout', headers=auth).json()['ok'] is True
    assert requests.get(f'{BASE_URL}/api/game', headers=auth).status_code == 401
    # second token still valid
    assert requests.get(f'{BASE_URL}/api/game', headers={'Authorization': f"Bearer {d2['token']}"}).status_code == 200


def test_unknown_action_and_bad_character():
    d = login(Account.create())
    auth = {'Authorization': f"Bearer {d['token']}"}
    assert requests.post(f'{BASE_URL}/api/game/action', headers=auth, json={'type': 'hack'}).status_code == 422
    r = requests.post(f'{BASE_URL}/api/game/action', headers=auth, json={'type': 'buy', 'character': 'nope'})
    assert r.status_code in (400, 422)
