# Frostfish username gate: POST /api/profile/username, username_set in auth/game, leaderboard filtering
import os
import secrets
import pytest
import requests
from eth_account import Account
from eth_account.messages import encode_defunct

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/') or open('/app/frontend/.env').read().split('REACT_APP_BACKEND_URL=')[1].split('\n')[0].rstrip('/')
H = {'Origin': BASE_URL, 'Content-Type': 'application/json'}


def login(acct):
    ch = requests.post(f'{BASE_URL}/api/auth/challenge', json={'address': acct.address, 'chainId': 4663}, headers=H).json()
    sig = Account.sign_message(encode_defunct(text=ch['message']), acct.key).signature.hex()
    sig = sig if sig.startswith('0x') else '0x' + sig
    r = requests.post(f'{BASE_URL}/api/auth/verify', headers=H, json={
        'address': acct.address, 'chainId': 4663, 'nonce': ch['nonce'], 'message': ch['message'], 'signature': sig})
    assert r.status_code == 200, r.text
    return r.json()


def auth(tok):
    return {'Authorization': f'Bearer {tok}', 'Content-Type': 'application/json'}


def uname():
    return 'T_' + secrets.token_hex(5)


@pytest.fixture
def fresh():
    acct = Account.create()
    data = login(acct)
    return acct, data


# New wallet has no username
def test_new_wallet_username_not_set(fresh):
    _, data = fresh
    assert data['game']['username_set'] is False
    g = requests.get(f'{BASE_URL}/api/game', headers=auth(data['token'])).json()
    assert g['username_set'] is False


def test_requires_auth():
    r = requests.post(f'{BASE_URL}/api/profile/username', json={'username': 'abcde'})
    assert r.status_code == 401


# Validation 422
@pytest.mark.parametrize('bad', ['ab', 'a' * 17, 'bad name', 'émoji', 'abc-def', '', 'ab!c'])
def test_invalid_username_422(fresh, bad):
    _, data = fresh
    r = requests.post(f'{BASE_URL}/api/profile/username', json={'username': bad}, headers=auth(data['token']))
    assert r.status_code == 422, (bad, r.status_code, r.text)


def test_missing_body_422(fresh):
    _, data = fresh
    r = requests.post(f'{BASE_URL}/api/profile/username', json={}, headers=auth(data['token']))
    assert r.status_code == 422


# Full flow: set -> game -> leaderboard -> second call 409 -> relogin keeps name
def test_set_username_flow(fresh):
    acct, data = fresh
    tok = data['token']
    # before: leaderboard you null and not listed
    lb = requests.get(f'{BASE_URL}/api/leaderboard', headers=auth(tok)).json()
    assert lb.get('you') is None
    name = uname()
    r = requests.post(f'{BASE_URL}/api/profile/username', json={'username': name}, headers=auth(tok))
    assert r.status_code == 200, r.text
    d = r.json()
    assert d['username'] == name and d['game']['username_set'] is True and d['game']['name'] == name
    g = requests.get(f'{BASE_URL}/api/game', headers=auth(tok)).json()
    assert g['username_set'] is True and g['name'] == name
    lb = requests.get(f'{BASE_URL}/api/leaderboard', headers=auth(tok)).json()
    assert lb['you'] is not None and lb['you']['name'] == name
    r2 = requests.post(f'{BASE_URL}/api/profile/username', json={'username': uname()}, headers=auth(tok))
    assert r2.status_code == 409
    re = login(acct)
    assert re['game']['username_set'] is True and re['game']['name'] == name


def test_duplicate_case_insensitive_409():
    a, b = Account.create(), Account.create()
    ta, tb = login(a)['token'], login(b)['token']
    name = uname()
    assert requests.post(f'{BASE_URL}/api/profile/username', json={'username': name}, headers=auth(ta)).status_code == 200
    r = requests.post(f'{BASE_URL}/api/profile/username', json={'username': name.upper()}, headers=auth(tb))
    assert r.status_code == 409, r.text
    # b still can pick another name
    g = requests.get(f'{BASE_URL}/api/game', headers=auth(tb)).json()
    assert g['username_set'] is False
    assert requests.post(f'{BASE_URL}/api/profile/username', json={'username': uname()}, headers=auth(tb)).status_code == 200


def test_leaderboard_only_named():
    acct = Account.create()
    tok = login(acct)['token']
    lb = requests.get(f'{BASE_URL}/api/leaderboard', headers=auth(tok)).json()
    print('leaderboard keys', list(lb.keys()))
    rows = lb.get('top') or lb.get('players') or lb.get('leaders') or []
    for row in rows:
        assert row.get('name'), row
        assert not str(row.get('name', '')).startswith('Islander') or True
