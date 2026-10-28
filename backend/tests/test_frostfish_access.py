# Frostfish game access: admin entry-fee/beta settings, beta CSV import/list/remove/clear, SIWE beta gate, entry-fee gate (402), entry quote/confirm, whitelist bypass
import os
import secrets
import pytest
import requests
from eth_account import Account
from eth_account.messages import encode_defunct

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/') or open('/app/frontend/.env').read().split('REACT_APP_BACKEND_URL=')[1].split('\n')[0].strip().rstrip('/')
H = {'Origin': BASE_URL, 'Content-Type': 'application/json'}
TEST_KEY = 'e719d708568092b905a4eae3f9b793d8de36691e87515321ae3cd48807d49d65'
TEST_ADDR = '0x91b02ECb55671655eEb68E98F9c231296B4C16Ae'
ADMIN_PW = os.environ.get('ADMIN_PASSWORD', 'Frostfish-Admin-2026')


def siwe(acct):
    ch = requests.post(f'{BASE_URL}/api/auth/challenge', json={'address': acct.address, 'chainId': 4663}, headers=H).json()
    sig = Account.sign_message(encode_defunct(text=ch['message']), acct.key).signature.hex()
    sig = sig if sig.startswith('0x') else '0x' + sig
    return requests.post(f'{BASE_URL}/api/auth/verify', headers=H, json={
        'address': acct.address, 'chainId': 4663, 'nonce': ch['nonce'], 'message': ch['message'], 'signature': sig})


def auth(tok):
    return {'Authorization': f'Bearer {tok}', 'Content-Type': 'application/json'}


@pytest.fixture(scope='module')
def admin():
    r = requests.post(f'{BASE_URL}/api/admin/login', json={'password': ADMIN_PW})
    assert r.status_code == 200, r.text
    return {'Authorization': f"Bearer {r.json()['token']}"}


@pytest.fixture(scope='module')
def base_settings(admin):
    s = requests.get(f'{BASE_URL}/api/admin/settings', headers=admin).json()
    body = {k: s[k] for k in ('tokenAddress', 'treasuryAddress', 'curveAddress', 'launchpadUrl', 'prices', 'tokenUsdOverride')}
    yield body
    # restore: open game
    requests.put(f'{BASE_URL}/api/admin/settings', headers=admin, json={**body, 'entryFeeEnabled': False, 'entryFeeUsd': 5.0, 'betaEnabled': False})
    requests.delete(f'{BASE_URL}/api/admin/beta', headers=admin)


def put(admin, base, **kw):
    return requests.put(f'{BASE_URL}/api/admin/settings', headers=admin, json={**base, **kw})


def imp(admin, text, name='t.csv'):
    return requests.post(f'{BASE_URL}/api/admin/beta/import', headers=admin, files={'file': (name, text.encode(), 'text/csv')})


# Admin settings shape
def test_admin_settings_fields(admin, base_settings):
    s = requests.get(f'{BASE_URL}/api/admin/settings', headers=admin).json()
    for k in ('entryFeeEnabled', 'entryFeeUsd', 'betaEnabled', 'betaCount'):
        assert k in s
    assert isinstance(s['betaCount'], int)


# Save fee settings + /api/config reflects; 0 fee rejected
def test_put_settings_fee(admin, base_settings):
    r = put(admin, base_settings, entryFeeEnabled=True, entryFeeUsd=2.5, betaEnabled=False)
    assert r.status_code == 200, r.text
    assert r.json()['entryFeeEnabled'] is True and r.json()['entryFeeUsd'] == 2.5
    c = requests.get(f'{BASE_URL}/api/config').json()
    assert c['entryFeeEnabled'] is True and c['entryFeeUsd'] == 2.5 and c['betaEnabled'] is False
    r = put(admin, base_settings, entryFeeEnabled=True, entryFeeUsd=0, betaEnabled=False)
    assert r.status_code == 422
    r = put(admin, base_settings, entryFeeEnabled=True, entryFeeUsd=-1, betaEnabled=False)
    assert r.status_code == 422
    put(admin, base_settings, entryFeeEnabled=False, entryFeeUsd=2.5, betaEnabled=False)


# CSV import: any column, case-insensitive dedupe, replace, 422 without addresses
def test_beta_import_replace(admin, base_settings):
    a1, a2, a3 = (Account.create().address for _ in range(3))
    csv = f"name,wallet,note\nbob,{a1},x\nann,{a2.lower()},{a1.upper().replace('0X', '0x')}\n,,{a2}\n"
    r = imp(admin, csv)
    assert r.status_code == 200, r.text
    d = r.json()
    assert d['imported'] == 2 and d['count'] == 2
    assert {w['address'].lower() for w in d['wallets']} == {a1.lower(), a2.lower()}
    r = imp(admin, 'no,addresses\nhere,0x123\n')
    assert r.status_code == 422
    assert requests.get(f'{BASE_URL}/api/admin/beta', headers=admin).json()['count'] == 2
    r = imp(admin, f'w\n{a3}\n')
    assert r.status_code == 200 and r.json()['count'] == 1
    lst = requests.get(f'{BASE_URL}/api/admin/beta', headers=admin).json()
    assert [w['address'].lower() for w in lst['wallets']] == [a3.lower()]
    assert requests.get(f'{BASE_URL}/api/admin/settings', headers=admin).json()['betaCount'] == 1


# Remove one / 404 / clear all
def test_beta_remove_and_clear(admin, base_settings):
    a1, a2 = Account.create().address, Account.create().address
    imp(admin, f'{a1}\n{a2}\n')
    r = requests.delete(f'{BASE_URL}/api/admin/beta/{a1.lower()}', headers=admin)
    assert r.status_code == 200 and r.json()['count'] == 1
    r = requests.delete(f'{BASE_URL}/api/admin/beta/{a1}', headers=admin)
    assert r.status_code == 404
    r = requests.delete(f'{BASE_URL}/api/admin/beta/notanaddress', headers=admin)
    assert r.status_code == 422
    r = requests.delete(f'{BASE_URL}/api/admin/beta', headers=admin)
    assert r.status_code == 200 and r.json()['count'] == 0


# Admin endpoints need auth
def test_beta_requires_admin():
    assert requests.get(f'{BASE_URL}/api/admin/beta').status_code == 401
    assert requests.delete(f'{BASE_URL}/api/admin/beta').status_code == 401
    assert requests.post(f'{BASE_URL}/api/admin/beta/import', files={'file': ('a.csv', b'x')}).status_code == 401


# Beta gate blocks non-listed wallet, allows after import
def test_beta_gate(admin, base_settings):
    acct = Account.from_key(TEST_KEY)
    requests.delete(f'{BASE_URL}/api/admin/beta', headers=admin)
    put(admin, base_settings, entryFeeEnabled=False, entryFeeUsd=5, betaEnabled=True)
    r = siwe(acct)
    assert r.status_code == 403
    assert 'closed beta' in r.json()['detail']
    imp(admin, f'wallet\n{TEST_ADDR}\n')
    r = siwe(acct)
    assert r.status_code == 200 and r.json()['token']
    put(admin, base_settings, entryFeeEnabled=False, entryFeeUsd=5, betaEnabled=False)
    requests.delete(f'{BASE_URL}/api/admin/beta', headers=admin)


# Entry fee gate: entry_required, 402 on gated endpoints, quote, confirm
def test_entry_fee_gate(admin, base_settings):
    put(admin, base_settings, entryFeeEnabled=True, entryFeeUsd=3, betaEnabled=False)
    acct = Account.create()
    r = siwe(acct)
    assert r.status_code == 200, r.text
    g = r.json()['game']
    assert g['entry_required'] is True and g['entry_paid'] is False and g['entry_fee_usd'] == 3
    tok = r.json()['token']
    g = requests.get(f'{BASE_URL}/api/game', headers=auth(tok)).json()
    assert g['entry_required'] is True
    pq = requests.post(f'{BASE_URL}/api/purchase/quote', headers=auth(tok), json={'character': list(base_settings['prices'])[0]})
    assert pq.status_code == 402, pq.text
    un = requests.post(f'{BASE_URL}/api/profile/username', headers=auth(tok), json={'username': 'T_' + secrets.token_hex(4)})
    assert un.status_code == 402, un.text
    cl = requests.post(f'{BASE_URL}/api/claim', headers=auth(tok), json={})
    print('claim status', cl.status_code, cl.text[:200])
    assert cl.status_code in (402, 422, 503)
    q = requests.post(f'{BASE_URL}/api/entry/quote', headers=auth(tok))
    if q.status_code == 503:
        pytest.skip('ETH/USD unavailable: ' + q.text)
    assert q.status_code == 200, q.text
    qd = q.json()
    for k in ('quoteId', 'feeUsd', 'ethUsd', 'amountWei', 'amountEth', 'treasuryAddress', 'chainId'):
        assert k in qd
    assert qd['chainId'] == 4663 and qd['feeUsd'] == 3 and int(qd['amountWei']) > 0
    assert qd['treasuryAddress'].lower() == base_settings['treasuryAddress'].lower()
    txh = '0x' + secrets.token_hex(32)
    c = requests.post(f'{BASE_URL}/api/entry/confirm', headers=auth(tok), json={'quoteId': 'nonexistent_quote_123', 'txHash': txh})
    assert c.status_code == 404
    c = requests.post(f'{BASE_URL}/api/entry/confirm', headers=auth(tok), json={'quoteId': qd['quoteId'], 'txHash': 'bad'})
    assert c.status_code == 422
    c = requests.post(f'{BASE_URL}/api/entry/confirm', headers=auth(tok), json={'quoteId': qd['quoteId'], 'txHash': txh})
    print('confirm', c.status_code, c.text[:200])
    assert c.status_code in (200, 400, 503)
    if c.status_code == 200:
        assert c.json()['status'] == 'pending'
    g = requests.get(f'{BASE_URL}/api/game', headers=auth(tok)).json()
    assert g['entry_paid'] is False and g['entry_required'] is True
    # disable fee -> open again
    put(admin, base_settings, entryFeeEnabled=False, entryFeeUsd=3, betaEnabled=False)
    g = requests.get(f'{BASE_URL}/api/game', headers=auth(tok)).json()
    assert g['entry_required'] is False
    assert requests.post(f'{BASE_URL}/api/entry/quote', headers=auth(tok)).status_code == 409
    un = requests.post(f'{BASE_URL}/api/profile/username', headers=auth(tok), json={'username': 'T_' + secrets.token_hex(4)})
    assert un.status_code == 200, un.text
    assert requests.get(f'{BASE_URL}/api/leaderboard', headers=auth(tok)).status_code == 200


# Whitelisted wallet skips fee when beta+fee both on
def test_whitelist_bypass(admin, base_settings):
    acct = Account.from_key(TEST_KEY)
    imp(admin, f'{TEST_ADDR}\n')
    put(admin, base_settings, entryFeeEnabled=True, entryFeeUsd=2, betaEnabled=True)
    r = siwe(acct)
    assert r.status_code == 200, r.text
    assert r.json()['game']['entry_required'] is False
    tok = r.json()['token']
    assert requests.get(f'{BASE_URL}/api/game', headers=auth(tok)).json()['entry_required'] is False
    assert requests.post(f'{BASE_URL}/api/entry/quote', headers=auth(tok)).status_code == 409
    # non-listed wallet blocked at login entirely
    assert siwe(Account.create()).status_code == 403
    # fee on, beta off -> listed wallet must pay (beta list not active)
    put(admin, base_settings, entryFeeEnabled=True, entryFeeUsd=2, betaEnabled=False)
    assert requests.get(f'{BASE_URL}/api/game', headers=auth(tok)).json()['entry_required'] is True
    put(admin, base_settings, entryFeeEnabled=False, entryFeeUsd=5, betaEnabled=False)
    requests.delete(f'{BASE_URL}/api/admin/beta', headers=admin)
