"""Admin-editable economy settings plus live token pricing (bonding curve × ETH/USD)."""
import re
import time
from datetime import datetime, timezone

import httpx
from eth_utils import is_address, to_checksum_address

import chain

DEFAULTS = {
    'token_address': '0x098e9efbf4d65cbfc27130c1bf8a09b007659dbf',
    'curve_address': '0x138b88dc58ecce34002d7ed4bdcaacb2e14353e9',
    'treasury_address': '0x603a26e0745aE579ad0F931307a386ddC3DD096F',
    'launchpad_url': 'https://ponsfamily.com/launchpad/0x098e9efbf4d65cbfc27130c1bf8a09b007659dbf',
    'prices': {'rod': 1.0, 'net': 10.0, 'boat': 50.0, 'yacht': 100.0, 'sub': 200.0, 'flagship': 400.0, 'mothership': 1000.0},
    'locked_characters': ['mothership'],
    'token_usd_override': None,
    'entry_fee_enabled': False,
    'entry_fee_usd': 5.0,
    'beta_enabled': False,
    'nft_gate_enabled': False,
    'nft_gate': None,
}
PAYBACK_HOURS = 48
_cache = {'settings': None, 'settings_at': 0, 'price': None, 'price_at': 0, 'eth_usd': None, 'eth_usd_at': 0,
          'meta': {}, 'pons': None, 'pons_at': 0, 'supply': None, 'supply_at': 0}
PONS_RE = {
    'curve': re.compile(r'curve\\?":\\?"(0x[0-9a-fA-F]{40})'),
    'token': re.compile(r'explorerAddress\\?":\\?"(0x[0-9a-fA-F]{40})'),
    'price_usd': re.compile(r'priceUsd\\?":([0-9.eE+-]+)'),
    'quote_usd': re.compile(r'quoteUsd\\?":([0-9.eE+-]+)'),
    'symbol': re.compile(r'symbol\\?":\\?"([A-Za-z0-9_$.-]{1,20})'),
    'pool': re.compile(r'pool\\?":\\?"(0x[0-9a-fA-F]{40})'),
}


async def get_settings(db, fresh=False):
    if not fresh and _cache['settings'] and time.time() - _cache['settings_at'] < 10:
        return _cache['settings']
    doc = await db.settings.find_one({'_id': 'economy'}, {'_id': 0}) or {}
    settings = {**DEFAULTS, **doc, 'prices': {**DEFAULTS['prices'], **doc.get('prices', {})}}
    _cache.update(settings=settings, settings_at=time.time())
    return settings


async def save_settings(db, update):
    await db.settings.update_one({'_id': 'economy'}, {'$set': {**update, 'updated_at': datetime.now(timezone.utc).isoformat()}}, upsert=True)
    _cache.update(settings=None, price=None, meta={})
    return await get_settings(db, fresh=True)


async def fetch_pons_page(url):
    async with httpx.AsyncClient(timeout=15, follow_redirects=True, headers={'User-Agent': 'Mozilla/5.0 Frostfish'}) as client:
        res = await client.get(url)
    res.raise_for_status()
    html = res.text
    out = {}
    for key, rx in PONS_RE.items():
        m = rx.search(html)
        if m:
            out[key] = m.group(1)
    for key in ('price_usd', 'quote_usd'):
        if key in out:
            out[key] = float(out[key])
    return out


def launchpad_url_for(token):
    return f'https://ponsfamily.com/launchpad/{token.lower()}'


async def resolve_launchpad(url_or_address):
    text = url_or_address.strip()
    m = re.search(r'0x[0-9a-fA-F]{40}', text)
    if not m:
        raise ValueError('Paste a Ponsfamily launchpad link or a token contract address.')
    token = to_checksum_address(m.group(0))
    url = text if text.startswith('http') else launchpad_url_for(token)
    page = await fetch_pons_page(url)
    info = {'token_address': token, 'launchpad_url': launchpad_url_for(token), 'curve_address': page.get('curve'),
            'symbol': page.get('symbol'), 'price_usd': page.get('price_usd'), 'pool_address': page.get('pool')}
    if info['curve_address']:
        info['curve_address'] = to_checksum_address(info['curve_address'])
    return info


async def eth_usd(settings):
    if _cache['eth_usd'] and time.time() - _cache['eth_usd_at'] < 60:
        return _cache['eth_usd']
    value = None
    try:
        async with httpx.AsyncClient(timeout=8) as client:
            res = await client.get('https://api.coingecko.com/api/v3/simple/price', params={'ids': 'ethereum', 'vs_currencies': 'usd'})
        value = float(res.json()['ethereum']['usd'])
    except Exception:
        try:
            page = await pons_cached(settings)
            value = page.get('quote_usd')
        except Exception:
            value = None
    if value:
        _cache.update(eth_usd=value, eth_usd_at=time.time())
        return value
    if _cache['eth_usd']:
        return _cache['eth_usd']
    raise RuntimeError('ETH/USD price is unavailable right now.')


async def pons_cached(settings):
    if _cache['pons'] and time.time() - _cache['pons_at'] < 120:
        return _cache['pons']
    page = await fetch_pons_page(settings['launchpad_url'])
    _cache.update(pons=page, pons_at=time.time())
    return page


async def token_meta(settings):
    token = settings['token_address']
    meta = _cache['meta']
    if meta.get('token') != token:
        try:
            decimals = await chain.erc20_decimals(token)
        except Exception:
            decimals = 18
        try:
            symbol = await chain.erc20_symbol(token)
        except Exception:
            symbol = 'TOKEN'
        meta = {'token': token, 'decimals': int(decimals), 'symbol': symbol}
        _cache['meta'] = meta
    return meta


async def token_price(settings):
    """USD per token. Admin override > bonding curve × ETH/USD > Ponsfamily page price."""
    if _cache['price'] and time.time() - _cache['price_at'] < 20 and _cache['price']['token'] == settings['token_address']:
        return _cache['price']
    override = settings.get('token_usd_override')
    if override:
        price = {'token_usd': float(override), 'eth_usd': None, 'token_eth': None, 'source': 'manual'}
    else:
        price = None
        curve = settings.get('curve_address')
        if curve and not await chain.curve_graduated(curve):
            try:
                quote, tokens = await chain.curve_reserves(curve)
                meta = await token_meta(settings)
                token_eth = (quote / 1e18) / (tokens / 10 ** meta['decimals'])
                usd = await eth_usd(settings)
                price = {'token_usd': token_eth * usd, 'eth_usd': usd, 'token_eth': token_eth, 'source': 'bonding-curve'}
            except Exception:
                price = None
        if not price:
            page = await pons_cached(settings)
            if not page.get('price_usd'):
                raise RuntimeError('Token price is unavailable right now. Please try again shortly.')
            price = {'token_usd': page['price_usd'], 'eth_usd': page.get('quote_usd'), 'token_eth': None, 'source': 'ponsfamily'}
    if price['token_usd'] <= 0:
        raise RuntimeError('Token price is unavailable right now. Please try again shortly.')
    price.update(token=settings['token_address'], updated_at=datetime.now(timezone.utc).isoformat())
    _cache.update(price=price, price_at=time.time())
    return price


async def total_supply(settings):
    token = settings['token_address']
    cached = _cache['supply']
    if cached and cached['token'] == token and time.time() - _cache['supply_at'] < 60:
        return cached['value']
    meta = await token_meta(settings)
    value = (await chain.erc20_total_supply(token)) / 10 ** meta['decimals']
    _cache.update(supply={'token': token, 'value': value}, supply_at=time.time())
    return value


async def market_cap(settings):
    """Live market cap in USD: total supply × token price. Returns None when either is unavailable."""
    try:
        price = await token_price(settings)
        supply = await total_supply(settings)
    except Exception:
        return None
    return {'market_cap_usd': supply * price['token_usd'], 'total_supply': supply, 'token_usd': price['token_usd'],
            'source': price['source'], 'updated_at': price['updated_at']}


def tokens_for_usd(usd, token_usd, decimals):
    return int(round(usd / token_usd * 10 ** decimals))


def validate_address(value, label):
    if not value or not is_address(value):
        raise ValueError(f'{label} must be a valid EVM address.')
    return to_checksum_address(value)
