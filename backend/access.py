"""Game access: closed-beta wallet whitelist, OpenSea NFT holder gate and one-time entry fee (native ETH → treasury)."""
import asyncio
import os
import re
import time
from datetime import datetime, timezone

import httpx
from eth_utils import to_checksum_address

import chain
from db import db

ADDRESS_RE = re.compile(r'0x[0-9a-fA-F]{40}')
OPENSEA_API = 'https://api.opensea.io/api/v2'
COLLECTION_RE = re.compile(r'opensea\.io/(?:[a-z]{2}/)?collection/([A-Za-z0-9_-]+)')
ASSET_RE = re.compile(r'opensea\.io/(?:[a-z]{2}/)?(?:assets|item)/([a-z_]+)/(0x[0-9a-fA-F]{40})(?:/(\d+))?')
CHAIN_RPCS = {
    'ethereum': 'https://ethereum-rpc.publicnode.com', 'matic': 'https://polygon-bor-rpc.publicnode.com',
    'base': 'https://mainnet.base.org', 'arbitrum': 'https://arb1.arbitrum.io/rpc', 'arbitrum_nova': 'https://nova.arbitrum.io/rpc',
    'optimism': 'https://mainnet.optimism.io', 'avalanche': 'https://api.avax.network/ext/bc/C/rpc', 'bsc': 'https://bsc-dataseed.binance.org',
    'zora': 'https://rpc.zora.energy', 'blast': 'https://rpc.blast.io', 'ape_chain': 'https://rpc.apechain.com',
    'abstract': 'https://api.mainnet.abs.xyz', 'ronin': 'https://api.roninchain.com/rpc', 'shape': 'https://mainnet.shape.network',
    'soneium': 'https://rpc.soneium.org', 'unichain': 'https://mainnet.unichain.org', 'b3': 'https://mainnet-rpc.b3.fun',
    'bera_chain': 'https://rpc.berachain.com', 'sei': 'https://evm-rpc.sei-apis.com', 'monad': 'https://rpc.monad.xyz',
    'robinhood': os.environ.get('ROBINHOOD_RPC_URL'),
}
CHAIN_LABELS = {'ethereum': 'Ethereum', 'matic': 'Polygon', 'bsc': 'BNB Chain', 'ape_chain': 'ApeChain', 'bera_chain': 'Berachain',
                'arbitrum_nova': 'Arbitrum Nova', 'robinhood': 'Robinhood Chain'}
_nft_cache = {}
NFT_CACHE_SECONDS = 300


def chain_label(slug):
    return CHAIN_LABELS.get(slug) or slug.replace('_', ' ').title()


async def whitelisted(address):
    return await db.beta_wallets.find_one({'address': address.lower()}, {'_id': 1}) is not None


def nft_gate_active(settings):
    return bool(settings.get('nft_gate_enabled') and settings.get('nft_gate'))


async def beta_access(settings, address):
    """How this wallet gets past the beta gate: 'open' (beta off), 'list', 'nft' or None (blocked)."""
    if not settings.get('beta_enabled'):
        return 'open'
    if await whitelisted(address):
        return 'list'
    if nft_gate_active(settings) and await holds_nft(settings['nft_gate'], address):
        return 'nft'
    return None


def beta_closed_message(settings):
    if nft_gate_active(settings):
        return f"Frostfish is in closed beta. This wallet is not on the beta list and does not hold a {settings['nft_gate']['name']} NFT."
    return 'Frostfish is in closed beta. This wallet is not on the beta list.'


async def needs_entry(settings, state):
    """True when the player still has to pay the entry fee. Beta-listed wallets and NFT holders enter free while the beta list is active."""
    if not settings.get('entry_fee_enabled') or state.get('entry_paid'):
        return False
    if settings.get('beta_enabled'):
        try:
            if await beta_access(settings, state['wallet_address']) in ('list', 'nft'):
                return False
        except Exception:
            return False
    return True


async def opensea(path):
    async with httpx.AsyncClient(timeout=15, headers={'Accept': 'application/json', 'User-Agent': 'Mozilla/5.0 Frostfish'}) as client:
        res = await client.get(f'{OPENSEA_API}{path}')
        if res.status_code == 429 or res.status_code >= 500:
            await asyncio.sleep(1.2)
            res = await client.get(f'{OPENSEA_API}{path}')
    if res.status_code in (400, 404):
        raise ValueError('OpenSea could not find that collection or item. Check the link.')
    res.raise_for_status()
    return res.json()


async def resolve_opensea(url):
    """Collection or item link → contract, chain, standard, name, image."""
    text = url.strip()
    slug = contract = chain_slug = token_id = col = None
    m = ASSET_RE.search(text)
    if m:
        chain_slug, contract, token_id = m.group(1), m.group(2), m.group(3)
    else:
        m = COLLECTION_RE.search(text)
        if not m:
            raise ValueError('Paste an OpenSea collection link (opensea.io/collection/…) or an item link (opensea.io/item/<chain>/<contract>/<id>).')
        slug = m.group(1)
    if slug:
        col = await opensea(f'/collections/{slug}')
        contracts = col.get('contracts') or []
        if not contracts:
            raise ValueError('That OpenSea collection has no on-chain contract (not supported).')
        chain_slug, contract = contracts[0]['chain'], contracts[0]['address']
    info = await opensea(f'/chain/{chain_slug}/contract/{contract}')
    slug = slug or info.get('collection')
    if col is None:
        col = (await opensea(f'/collections/{slug}')) if slug else {}
    gate = {'url': text, 'slug': slug, 'name': col.get('name') or info.get('name') or slug or 'NFT', 'image_url': col.get('image_url'),
            'chain': chain_slug, 'chain_label': chain_label(chain_slug), 'contract': to_checksum_address(contract), 'token_id': token_id,
            'standard': (info.get('contract_standard') or 'erc721').lower(), 'total_supply': col.get('total_supply'),
            'opensea_url': f'https://opensea.io/collection/{slug}' if slug else text, 'rpc_supported': bool(CHAIN_RPCS.get(chain_slug)),
            'resolved_at': datetime.now(timezone.utc).isoformat(timespec='seconds')}
    if gate['standard'] == 'erc1155' and not token_id:
        gate['warning'] = 'ERC-1155 collection: paste an item link (with token id) so a specific token can be checked.'
    elif not gate['rpc_supported']:
        gate['warning'] = f'Ownership checks on {gate["chain_label"]} are not supported yet.'
    return gate


async def holds_nft(gate, address, fresh=False):
    key = (address.lower(), gate['contract'].lower(), gate.get('token_id'))
    hit = _nft_cache.get(key)
    if hit and not fresh and time.time() - hit[1] < NFT_CACHE_SECONDS:
        return hit[0]
    rpc_url = CHAIN_RPCS.get(gate['chain'])
    if not rpc_url:
        return False
    owner = to_checksum_address(address)
    try:
        if gate.get('standard') == 'erc1155' and gate.get('token_id'):
            balance = (await chain.call(gate['contract'], 'balanceOf(address,uint256)', ('address', 'uint256'), (owner, int(gate['token_id'])), url=rpc_url))[0]
        else:
            balance = (await chain.call(gate['contract'], 'balanceOf(address)', ('address',), (owner,), url=rpc_url))[0]
    except Exception:
        if hit:
            return hit[0]
        raise
    result = balance > 0
    _nft_cache[key] = (result, time.time())
    return result


def parse_wallets(text):
    """Every EVM address found in the CSV (any column), de-duplicated, order preserved."""
    seen, out = set(), []
    for line in text.splitlines():
        for match in ADDRESS_RE.findall(line):
            low = match.lower()
            if low not in seen:
                seen.add(low)
                out.append(to_checksum_address(match))
    return out


async def replace_whitelist(addresses, source):
    now = datetime.now(timezone.utc).replace(tzinfo=None)
    await db.beta_wallets.delete_many({})
    if addresses:
        await db.beta_wallets.insert_many([{'address': a.lower(), 'checksum_address': a, 'added_at': now, 'source': source} for a in addresses])
    return len(addresses)


async def whitelist_view(limit=2000):
    docs = await db.beta_wallets.find({}, {'_id': 0, 'checksum_address': 1, 'added_at': 1, 'source': 1}).sort('added_at', -1).limit(limit).to_list(limit)
    return {'count': await db.beta_wallets.count_documents({}),
            'wallets': [{'address': d['checksum_address'], 'addedAt': d['added_at'].replace(tzinfo=timezone.utc).isoformat(timespec='seconds'), 'source': d.get('source')} for d in docs]}
