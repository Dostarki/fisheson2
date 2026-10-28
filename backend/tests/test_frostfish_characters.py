# Frostfish 7-character market regression: config prices/hourly, locked mothership (423), admin lockedCharacters, /api/characters
import os
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
IDS = ['rod', 'net', 'boat', 'yacht', 'sub', 'flagship', 'mothership']
DEFAULT_PRICES = {'rod': 1.0, 'net': 10.0, 'boat': 50.0, 'yacht': 100.0, 'sub': 200.0, 'flagship': 400.0, 'mothership': 1000.0}
MULT = {'yacht': 3, 'sub': 5, 'flagship': 10, 'mothership': 20}


@pytest.fixture(scope='module', autouse=True)
def _serialize_shared_settings():
    # Both admin-mutating modules share one preview backend; hold a file lock so xdist workers never race on settings.
    import fcntl
    with open('/tmp/frostfish-admin-tests.lock', 'w') as fh:
        fcntl.flock(fh, fcntl.LOCK_EX)
        yield
        fcntl.flock(fh, fcntl.LOCK_UN)


@pytest.fixture(scope='module')
def player():
    ch = requests.post(f'{API}/auth/challenge', json={'address': ADDR, 'chainId': 4663}, headers=ORIGIN, timeout=20).json()
    sig = Account.sign_message(encode_defunct(text=ch['message']), private_key=KEY).signature.hex()
    sig = sig if sig.startswith('0x') else '0x' + sig
    r = requests.post(f'{API}/auth/verify', json={'address': ADDR, 'chainId': 4663, 'nonce': ch['nonce'], 'message': ch['message'], 'signature': sig}, headers=ORIGIN, timeout=20)
    assert r.status_code == 200, r.text
    return {'Authorization': f"Bearer {r.json()['token']}"}


@pytest.fixture(scope='module')
def admin():
    r = requests.post(f'{API}/admin/login', json={'password': ADMIN_PW}, timeout=20)
    assert r.status_code == 200, r.text
    h = {'Authorization': f"Bearer {r.json()['token']}"}
    yield h
    # restore defaults
    requests.put(f'{API}/admin/settings', json=body_from(requests.get(f'{API}/admin/settings', headers=h, timeout=30).json(), prices=DEFAULT_PRICES, lockedCharacters=['mothership']), headers=h, timeout=40)


def body_from(cur, **over):
    b = {'tokenAddress': cur['tokenAddress'], 'treasuryAddress': cur['treasuryAddress'], 'curveAddress': cur['curveAddress'],
         'launchpadUrl': cur['launchpadUrl'], 'prices': dict(cur['prices']), 'tokenUsdOverride': None, 'entryFeeEnabled': False,
         'entryFeeUsd': 5, 'betaEnabled': False, 'nftGateEnabled': False, 'lockedCharacters': cur['lockedCharacters']}
    b.update(over)
    return b


def quote(player, cid):
    return requests.post(f'{API}/purchase/quote', json={'character': cid}, headers=player, timeout=30)


# Public config
def test_config_seven_characters():
    d = requests.get(f'{API}/config', timeout=30).json()
    assert d['prices'] == DEFAULT_PRICES
    for cid, m in MULT.items():
        assert abs(d['hourlyUsd'][cid] - m * 50 / 48) < 1e-6
    for cid in ('rod', 'net', 'boat'):
        assert abs(d['hourlyUsd'][cid] - DEFAULT_PRICES[cid] / 48) < 1e-6
    assert d['lockedCharacters'] == ['mothership']


# Purchase quotes
def test_quote_locked_and_yacht(player):
    r = quote(player, 'mothership')
    assert r.status_code == 423 and 'not available yet' in r.json()['detail']
    y = quote(player, 'yacht')
    assert y.status_code == 200, y.text
    assert y.json()['priceUsd'] == 100 and y.json()['character'] == 'yacht'
    for cid in ('sub', 'flagship'):
        assert quote(player, cid).status_code == 200
    assert quote(player, 'whale').status_code == 422


def test_characters_endpoint(player):
    assert requests.get(f'{API}/characters', timeout=20).status_code == 401
    r = requests.get(f'{API}/characters', headers=player, timeout=20)
    assert r.status_code == 200
    data = r.json()
    items = data if isinstance(data, list) else data.get('characters', data)
    print('characters payload type', type(data).__name__, str(data)[:300])
    ids = [c['id'] for c in items]
    assert ids == IDS
    for c in items:
        assert 'vessel' in c and 'mult' in c


# Admin settings
def test_admin_settings_view(admin):
    d = requests.get(f'{API}/admin/settings', headers=admin, timeout=30).json()
    assert set(d['prices']) == set(IDS)
    assert set(d['hourlyUsd']) == set(IDS)
    assert d['lockedCharacters'] == ['mothership']
    assert [c['id'] for c in d['characters']] == IDS


def test_admin_unlock_and_relock(admin, player):
    cur = requests.get(f'{API}/admin/settings', headers=admin, timeout=30).json()
    r = requests.put(f'{API}/admin/settings', json=body_from(cur, lockedCharacters=[]), headers=admin, timeout=40)
    assert r.status_code == 200, r.text
    assert r.json()['lockedCharacters'] == []
    assert requests.get(f'{API}/config', timeout=30).json()['lockedCharacters'] == []
    m = quote(player, 'mothership')
    assert m.status_code == 200, m.text
    assert m.json()['priceUsd'] == 1000
    r2 = requests.put(f'{API}/admin/settings', json=body_from(cur, prices={**DEFAULT_PRICES, 'yacht': 150}, lockedCharacters=['mothership']), headers=admin, timeout=40)
    assert r2.status_code == 200, r2.text
    cfg = requests.get(f'{API}/config', timeout=30).json()
    assert cfg['prices']['yacht'] == 150
    assert abs(cfg['hourlyUsd']['yacht'] - 3 * 50 / 48) < 1e-6
    assert cfg['lockedCharacters'] == ['mothership']
    assert quote(player, 'mothership').status_code == 423
    y = quote(player, 'yacht')
    assert y.status_code == 200 and y.json()['priceUsd'] == 150


def test_admin_partial_prices_and_bogus_lock(admin):
    cur = requests.get(f'{API}/admin/settings', headers=admin, timeout=30).json()
    r = requests.put(f'{API}/admin/settings', json=body_from(cur, prices={'rod': 1, 'net': 10, 'boat': 50}), headers=admin, timeout=40)
    assert r.status_code == 200, r.text
    assert set(r.json()['prices']) == set(IDS)
    assert r.json()['prices']['flagship'] == cur['prices']['flagship']
    bad = requests.put(f'{API}/admin/settings', json=body_from(cur, lockedCharacters=['bogus']), headers=admin, timeout=40)
    assert bad.status_code == 422
    # restore
    ok = requests.put(f'{API}/admin/settings', json=body_from(cur, prices=DEFAULT_PRICES, lockedCharacters=['mothership']), headers=admin, timeout=40)
    assert ok.status_code == 200
    cfg = requests.get(f'{API}/config', timeout=30).json()
    assert cfg['prices'] == DEFAULT_PRICES and cfg['lockedCharacters'] == ['mothership']


def test_admin_omitted_locked_keeps_current(admin):
    cur = requests.get(f'{API}/admin/settings', headers=admin, timeout=30).json()
    b = body_from(cur)
    b.pop('lockedCharacters')
    r = requests.put(f'{API}/admin/settings', json=b, headers=admin, timeout=40)
    assert r.status_code == 200 and r.json()['lockedCharacters'] == ['mothership']


def test_config_market_cap_live():
    cfg = requests.get(f'{API}/config', timeout=30).json()
    assert cfg['totalSupply'] > 0 and cfg['marketCapUsd'] > 0
    assert cfg['marketCapUsd'] == pytest.approx(cfg['totalSupply'] * cfg['tokenUsd'], rel=1e-6)


def test_admin_market_cap(admin):
    s = requests.get(f'{API}/admin/settings', headers=admin, timeout=30).json()
    assert s['marketCap']['market_cap_usd'] > 0 and s['marketCap']['total_supply'] > 0
