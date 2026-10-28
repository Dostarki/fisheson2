# Frostfish token economy regression: config, SIWE auth, game, purchase quote/confirm, claims, admin
import os
import subprocess
import pytest
import requests
from eth_account import Account
from eth_account.messages import encode_defunct

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')
if not BASE_URL:
    for line in open('/app/frontend/.env'):
        if line.startswith('REACT_APP_BACKEND_URL='):
            BASE_URL = line.split('=', 1)[1].strip().rstrip('/')
API = f'{BASE_URL}/api'
KEY = 'e719d708568092b905a4eae3f9b793d8de36691e87515321ae3cd48807d49d65'
ADDR = Account.from_key(KEY).address
ORIGIN = {'Origin': BASE_URL}
ADMIN_PW = os.environ.get('ADMIN_PASSWORD', 'Frostfish-Admin-2026')
TOKEN = '0x098e9efbf4d65cbfc27130c1bf8a09b007659dbf'
TREASURY = '0x603a26e0745aE579ad0F931307a386ddC3DD096F'
CURVE = '0x138B88Dc58eCCE34002d7Ed4bDcaAcB2e14353e9'
FOREIGN_TX = '0x6406ec1af1827381be3468cf5c6af1169a4c635b0e0fafc8dcf20a80960ee528'


@pytest.fixture(scope='module', autouse=True)
def _serialize_shared_settings():
    # Both admin-mutating modules share one preview backend; hold a file lock so xdist workers never race on settings.
    import fcntl
    with open('/tmp/frostfish-admin-tests.lock', 'w') as fh:
        fcntl.flock(fh, fcntl.LOCK_EX)
        yield
        fcntl.flock(fh, fcntl.LOCK_UN)


def challenge(chain_id=4663, headers=ORIGIN):
    return requests.post(f'{API}/auth/challenge', json={'address': ADDR, 'chainId': chain_id}, headers=headers, timeout=20)


def verify_body(ch):
    sig = Account.sign_message(encode_defunct(text=ch['message']), private_key=KEY).signature.hex()
    sig = sig if sig.startswith('0x') else '0x' + sig
    return {'address': ADDR, 'chainId': 4663, 'nonce': ch['nonce'], 'message': ch['message'], 'signature': sig}


@pytest.fixture(scope='module')
def player():
    ch = challenge().json()
    r = requests.post(f'{API}/auth/verify', json=verify_body(ch), headers=ORIGIN, timeout=20)
    assert r.status_code == 200, r.text
    return {'Authorization': f"Bearer {r.json()['token']}"}


@pytest.fixture(scope='module')
def admin():
    r = requests.post(f'{API}/admin/login', json={'password': ADMIN_PW}, timeout=20)
    assert r.status_code == 200, r.text
    return {'Authorization': f"Bearer {r.json()['token']}"}


# Health & public config
def test_health():
    r = requests.get(f'{API}/health', timeout=20)
    assert r.status_code == 200 and r.json()['status'] == 'ok'


def test_config():
    d = requests.get(f'{API}/config', timeout=30).json()
    assert d['tokenAddress'].lower() == TOKEN
    assert d['treasuryAddress'].lower() == TREASURY.lower()
    assert d['symbol'] == 'FISHESRH' and d['decimals'] == 18
    assert d['prices'] == {'rod': 1.0, 'net': 10.0, 'boat': 50.0, 'yacht': 100.0, 'sub': 200.0, 'flagship': 400.0, 'mothership': 1000.0}
    assert abs(d['hourlyUsd']['rod'] - 1 / 48) < 1e-6
    assert abs(d['hourlyUsd']['yacht'] - 3 * 50 / 48) < 1e-6 and abs(d['hourlyUsd']['mothership'] - 20 * 50 / 48) < 1e-6
    assert d['lockedCharacters'] == ['mothership']
    assert d['tokenUsd'] and d['tokenUsd'] > 0
    assert d['priceSource'] == 'bonding-curve'
    assert d['claimEnabled'] is False
    print('tokenUsd', d['tokenUsd'], d['priceSource'])


# SIWE auth
def test_siwe_verify_and_nonce_reuse():
    ch = challenge().json()
    body = verify_body(ch)
    r = requests.post(f'{API}/auth/verify', json=body, headers=ORIGIN, timeout=20)
    assert r.status_code == 200
    g = r.json()['game']
    for k in ('claimable_usd', 'earned_usd', 'hourly_usd', 'invested_usd', 'workers'):
        assert k in g
    assert isinstance(g['workers'], list)
    r2 = requests.post(f'{API}/auth/verify', json=body, headers=ORIGIN, timeout=20)
    assert r2.status_code == 401


def test_challenge_missing_origin():
    assert challenge(headers={}).status_code == 403


def test_challenge_wrong_chain():
    assert challenge(chain_id=1).status_code == 400


def test_verify_bad_signature():
    ch = challenge().json()
    body = verify_body(ch)
    other = Account.create()
    sig = Account.sign_message(encode_defunct(text=ch['message']), private_key=other.key).signature.hex()
    body['signature'] = sig if sig.startswith('0x') else '0x' + sig
    assert requests.post(f'{API}/auth/verify', json=body, headers=ORIGIN, timeout=20).status_code == 401


# Game & leaderboard
def test_game_auth(player):
    assert requests.get(f'{API}/game', timeout=20).status_code == 401
    r = requests.get(f'{API}/game', headers=player, timeout=20)
    assert r.status_code == 200 and 'claimable_usd' in r.json()


def test_leaderboard(player):
    r = requests.get(f'{API}/leaderboard', headers=player, timeout=20)
    assert r.status_code == 200
    for e in r.json()['entries']:
        assert isinstance(e['rewards'], (int, float))


# Purchase quote / confirm
def test_quote_and_confirm(player):
    r = requests.post(f'{API}/purchase/quote', json={'character': 'rod'}, headers=player, timeout=30)
    assert r.status_code == 200, r.text
    q = r.json()
    assert q['priceUsd'] == 1 and q['symbol'] == 'FISHESRH'
    assert q['treasuryAddress'].lower() == TREASURY.lower()
    assert isinstance(q['amount'], str) and int(q['amount']) > 0
    assert abs(q['amountTokens'] - 1 / q['tokenUsd']) / q['amountTokens'] < 1e-6
    pend = requests.post(f'{API}/purchase/confirm', json={'quoteId': q['quoteId'], 'txHash': '0x' + 'ab' * 32}, headers=player, timeout=30)
    assert pend.status_code == 200 and pend.json()['status'] == 'pending'
    foreign = requests.post(f'{API}/purchase/confirm', json={'quoteId': q['quoteId'], 'txHash': FOREIGN_TX}, headers=player, timeout=30)
    assert foreign.status_code == 400 and 'not a token transfer from your wallet' in foreign.json()['detail']


def test_quote_invalid_character(player):
    assert requests.post(f'{API}/purchase/quote', json={'character': 'whale'}, headers=player, timeout=20).status_code == 422


def test_confirm_unknown_quote(player):
    r = requests.post(f'{API}/purchase/confirm', json={'quoteId': 'unknownquote123', 'txHash': '0x' + 'cd' * 32}, headers=player, timeout=20)
    assert r.status_code == 404


def test_confirm_malformed_hash(player):
    r = requests.post(f'{API}/purchase/confirm', json={'quoteId': 'unknownquote123', 'txHash': '0x1234'}, headers=player, timeout=20)
    assert r.status_code == 422


# Claims (disabled)
def test_claim_disabled(player):
    r = requests.post(f'{API}/claim', headers=player, timeout=20)
    assert r.status_code == 503 and 'Claims are not enabled yet' in r.json()['detail']
    c = requests.get(f'{API}/claims', headers=player, timeout=20)
    assert c.status_code == 200 and c.json() == {'claims': []}


# Admin
def test_admin_wrong_password():
    assert requests.post(f'{API}/admin/login', json={'password': 'nope'}, timeout=20).status_code == 401


def test_admin_settings_auth(admin):
    assert requests.get(f'{API}/admin/settings', timeout=20).status_code == 401
    r = requests.get(f'{API}/admin/settings', headers=admin, timeout=30)
    assert r.status_code == 200
    d = r.json()
    assert d['price'] and d['price']['token_usd'] > 0
    assert 'treasuryTokenBalance' in d and d['curveAddress'].lower() == CURVE.lower()


def test_admin_resolve(admin):
    r = requests.post(f'{API}/admin/resolve', json={'url': f'https://ponsfamily.com/launchpad/{TOKEN}'}, headers=admin, timeout=40)
    assert r.status_code == 200, r.text
    d = r.json()
    assert d['token_address'].lower() == TOKEN and d['curve_address'] == CURVE and d['symbol'] == 'FISHESRH'


def test_admin_put_settings(admin):
    cur = requests.get(f'{API}/admin/settings', headers=admin, timeout=30).json()
    body = {'tokenAddress': cur['tokenAddress'], 'treasuryAddress': cur['treasuryAddress'], 'curveAddress': cur['curveAddress'],
            'launchpadUrl': cur['launchpadUrl'], 'prices': {'rod': 1, 'net': 10, 'boat': 50}, 'tokenUsdOverride': None}
    bad = {**body, 'treasuryAddress': '0x123'}
    assert requests.put(f'{API}/admin/settings', json=bad, headers=admin, timeout=30).status_code == 422
    bad2 = {**body, 'prices': {'rod': 0, 'net': 10, 'boat': 50}}
    assert requests.put(f'{API}/admin/settings', json=bad2, headers=admin, timeout=30).status_code == 422
    ok = requests.put(f'{API}/admin/settings', json=body, headers=admin, timeout=40)
    assert ok.status_code == 200 and ok.json()['prices']['rod'] == 1.0 and ok.json()['prices']['yacht'] == 100.0
    cfg = requests.get(f'{API}/config', timeout=30).json()
    assert cfg['prices']['boat'] == 50.0 and cfg['prices']['flagship'] == 400.0
    assert cfg['tokenAddress'].lower() == TOKEN


def test_admin_stats(admin):
    r = requests.get(f'{API}/admin/stats', headers=admin, timeout=20)
    assert r.status_code == 200
    d = r.json()
    assert isinstance(d['wallets'], int) and isinstance(d['purchases'], list) and 'purchaseCount' in d
