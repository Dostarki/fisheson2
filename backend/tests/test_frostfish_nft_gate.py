# Frostfish OpenSea NFT holder gate: resolve, settings toggle, /api/config betaNft, holder check, delete, SIWE beta message
import os
import time
import pytest
import requests
from eth_account import Account
from eth_account.messages import encode_defunct

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/') or open('/app/frontend/.env').read().split('REACT_APP_BACKEND_URL=')[1].split('\n')[0].strip().rstrip('/')
H = {'Origin': BASE_URL, 'Content-Type': 'application/json'}
TEST_KEY = 'e719d708568092b905a4eae3f9b793d8de36691e87515321ae3cd48807d49d65'
TEST_ADDR = '0x91b02ECb55671655eEb68E98F9c231296B4C16Ae'
ADMIN_PW = os.environ.get('ADMIN_PASSWORD', 'Frostfish-Admin-2026')
PUDGY = 'https://opensea.io/collection/pudgypenguins'
PUDGY_CONTRACT = '0xBd3531dA5CF5857e7CfAA92426877b022e612cf8'


def holder():
    r = requests.post('https://ethereum-rpc.publicnode.com', json={'jsonrpc': '2.0', 'id': 1, 'method': 'eth_call', 'params': [
        {'to': PUDGY_CONTRACT, 'data': '0x6352211e' + '0' * 63 + '1'}, 'latest']}, timeout=15)
    return '0x' + r.json()['result'][-40:]


def siwe(key):
    acct = Account.from_key(key)
    ch = requests.post(f'{BASE_URL}/api/auth/challenge', json={'address': acct.address, 'chainId': 4663}, headers=H).json()
    sig = Account.sign_message(encode_defunct(text=ch['message']), acct.key).signature.hex()
    sig = sig if sig.startswith('0x') else '0x' + sig
    return requests.post(f'{BASE_URL}/api/auth/verify', headers=H, json={
        'address': acct.address, 'chainId': 4663, 'nonce': ch['nonce'], 'message': ch['message'], 'signature': sig})


@pytest.fixture(scope='module')
def admin():
    r = requests.post(f'{BASE_URL}/api/admin/login', json={'password': ADMIN_PW})
    assert r.status_code == 200, r.text
    return {'Authorization': f"Bearer {r.json()['token']}"}


@pytest.fixture(scope='module')
def base(admin):
    s = requests.get(f'{BASE_URL}/api/admin/settings', headers=admin).json()
    body = {k: s[k] for k in ('tokenAddress', 'treasuryAddress', 'curveAddress', 'launchpadUrl', 'prices', 'tokenUsdOverride')}
    requests.delete(f'{BASE_URL}/api/admin/beta', headers=admin)
    yield body
    requests.put(f'{BASE_URL}/api/admin/settings', headers=admin, json={**body, 'entryFeeEnabled': False, 'entryFeeUsd': 5.0, 'betaEnabled': False, 'nftGateEnabled': False})
    requests.delete(f'{BASE_URL}/api/admin/nft', headers=admin)
    requests.delete(f'{BASE_URL}/api/admin/beta', headers=admin)


def put(admin, base, **kw):
    return requests.put(f'{BASE_URL}/api/admin/settings', headers=admin, json={**base, 'entryFeeEnabled': False, 'entryFeeUsd': 5.0, **kw})


def resolve(admin, url):
    r = requests.post(f'{BASE_URL}/api/admin/nft/resolve', headers=admin, json={'url': url}, timeout=60)
    if r.status_code in (400, 429) and 'could not find' not in r.text.lower():
        time.sleep(2)
        r = requests.post(f'{BASE_URL}/api/admin/nft/resolve', headers=admin, json={'url': url}, timeout=60)
    return r


# Auth required on nft endpoints
def test_nft_requires_admin():
    assert requests.post(f'{BASE_URL}/api/admin/nft/resolve', json={'url': PUDGY}).status_code == 401
    assert requests.delete(f'{BASE_URL}/api/admin/nft').status_code == 401
    assert requests.post(f'{BASE_URL}/api/admin/nft/check', json={'address': TEST_ADDR}).status_code == 401


# DELETE clears; enabling gate without collection 422; check 422 without gate
def test_delete_and_enable_without_gate(admin, base):
    r = requests.delete(f'{BASE_URL}/api/admin/nft', headers=admin)
    assert r.status_code == 200
    assert r.json()['nftGate'] is None and r.json()['nftGateEnabled'] is False
    r = put(admin, base, betaEnabled=True, nftGateEnabled=True)
    assert r.status_code == 422, r.text
    assert 'OpenSea' in r.json()['detail']
    r = requests.post(f'{BASE_URL}/api/admin/nft/check', headers=admin, json={'address': TEST_ADDR})
    assert r.status_code == 422


# Resolve bad links
def test_resolve_bad_links(admin, base):
    r = resolve(admin, 'https://google.com/x')
    assert r.status_code == 422 and 'OpenSea' in r.json()['detail']
    r = resolve(admin, 'https://opensea.io/collection/this-slug-does-not-exist-xyz-123')
    assert r.status_code in (400, 422), r.text
    assert 'application/json' in r.headers.get('content-type', '')
    assert isinstance(r.json()['detail'], str) and '<html' not in r.text.lower()


# Resolve Pudgy Penguins + persistence
def test_resolve_pudgy(admin, base):
    r = resolve(admin, PUDGY)
    assert r.status_code == 200, r.text
    g = r.json()['nftGate']
    assert g['name'] == 'Pudgy Penguins'
    assert g['chain'] == 'ethereum'
    assert g['contract'] == PUDGY_CONTRACT
    assert g['standard'] == 'erc721'
    assert g['image_url'] and g['image_url'].startswith('http')
    assert g['total_supply'] == 8888
    assert g['rpc_supported'] is True
    s = requests.get(f'{BASE_URL}/api/admin/settings', headers=admin).json()
    assert s['nftGate']['contract'] == PUDGY_CONTRACT and s['nftGateEnabled'] is False


# Holder check
def test_nft_check(admin, base):
    r = requests.post(f'{BASE_URL}/api/admin/nft/check', headers=admin, json={'address': TEST_ADDR})
    assert r.status_code == 200, r.text
    assert r.json()['holds'] is False and r.json()['collection'] == 'Pudgy Penguins'
    h = holder()
    r = requests.post(f'{BASE_URL}/api/admin/nft/check', headers=admin, json={'address': h})
    assert r.status_code == 200, r.text
    assert r.json()['holds'] is True
    r = requests.post(f'{BASE_URL}/api/admin/nft/check', headers=admin, json={'address': '0x' + 'z' * 40})
    assert r.status_code == 422


# config betaNft visibility matrix
def test_config_beta_nft(admin, base):
    assert put(admin, base, betaEnabled=False, nftGateEnabled=True).status_code == 200
    assert requests.get(f'{BASE_URL}/api/config').json()['betaNft'] is None
    assert put(admin, base, betaEnabled=True, nftGateEnabled=False).status_code == 200
    assert requests.get(f'{BASE_URL}/api/config').json()['betaNft'] is None
    r = put(admin, base, betaEnabled=True, nftGateEnabled=True)
    assert r.status_code == 200 and r.json()['nftGateEnabled'] is True
    n = requests.get(f'{BASE_URL}/api/config').json()['betaNft']
    assert n['name'] == 'Pudgy Penguins' and n['url'] == PUDGY and n['chain'] == 'Ethereum' and n['image']


# SIWE 403 messages with / without NFT gate
def test_siwe_beta_messages(admin, base):
    put(admin, base, betaEnabled=True, nftGateEnabled=True)
    time.sleep(11)  # verify uses 10s settings cache
    r = siwe(TEST_KEY)
    assert r.status_code == 403, r.text
    d = r.json()['detail']
    assert 'beta list' in d and 'does not hold a Pudgy Penguins NFT' in d
    put(admin, base, betaEnabled=True, nftGateEnabled=False)
    time.sleep(11)
    r = siwe(TEST_KEY)
    assert r.status_code == 403
    assert r.json()['detail'] == 'Frostfish is in closed beta. This wallet is not on the beta list.'


# DELETE clears gate and disables toggle
def test_delete_clears(admin, base):
    put(admin, base, betaEnabled=True, nftGateEnabled=True)
    r = requests.delete(f'{BASE_URL}/api/admin/nft', headers=admin)
    assert r.status_code == 200 and r.json()['nftGate'] is None and r.json()['nftGateEnabled'] is False
    s = requests.get(f'{BASE_URL}/api/admin/settings', headers=admin).json()
    assert s['nftGate'] is None and s['nftGateEnabled'] is False
    assert requests.get(f'{BASE_URL}/api/config').json()['betaNft'] is None
