import asyncio
import hashlib
import os
import secrets
from datetime import datetime, timedelta, timezone
from pathlib import Path
from urllib.parse import urlsplit

from dotenv import dotenv_values
from eth_account import Account
from eth_account.messages import encode_defunct
from eth_utils import is_address, to_checksum_address
from fastapi import Depends, FastAPI, Header, HTTPException
from pydantic import BaseModel, ConfigDict, Field
from pymongo.errors import DuplicateKeyError
from starlette.middleware.cors import CORSMiddleware

import access
import chain  # noqa: E402  (db loads .env first)
import pricing
from admin import ensure_indexes as admin_indexes, router as admin_router
from db import client, db  # noqa: F401
from game import CHARACTERS, PAYBACK_HOURS, VERSION, advance, grant, hourly_rates, initial_state, now_iso, public_state
from villagers import RESIDENTS

# The platform may inject its own APP_URL; the one in backend/.env is honoured too.
_app_urls = ','.join([os.environ['APP_URL'], dotenv_values(Path(__file__).parent / '.env').get('APP_URL') or ''])
ALLOWED_ORIGINS = {u.strip().rstrip('/') for u in _app_urls.split(',') if u.strip()}
CHAIN_ID = int(os.environ['ROBINHOOD_CHAIN_ID'])
NONCE_TTL = timedelta(minutes=5)
SESSION_TTL = timedelta(hours=24)
QUOTE_TTL = timedelta(minutes=10)
MIN_CLAIM_USD = 0.05
WRONG_CHAIN = f'Switch to Robinhood Chain Mainnet (chain {CHAIN_ID}) to sign in.'

app = FastAPI(title='Frostfish')
app.add_middleware(CORSMiddleware, allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
                   allow_credentials=False, allow_methods=['GET', 'POST', 'PUT', 'DELETE'], allow_headers=['Content-Type', 'Authorization'])
app.include_router(admin_router)


class ChallengeRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    address: str = Field(min_length=42, max_length=42)
    chain_id: int = Field(alias='chainId', gt=0)


class VerifyRequest(ChallengeRequest):
    nonce: str = Field(min_length=16, max_length=64)
    message: str = Field(max_length=2000)
    signature: str = Field(min_length=130, max_length=132)


class UsernameRequest(BaseModel):
    username: str = Field(min_length=3, max_length=16, pattern=r'^[A-Za-z0-9_]+$')


class QuoteRequest(BaseModel):
    character: str = Field(max_length=20)


class ConfirmRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    quote_id: str = Field(alias='quoteId', min_length=10, max_length=80)
    tx_hash: str = Field(alias='txHash', min_length=66, max_length=66, pattern=r'^0x[0-9a-fA-F]{64}$')


def utcnow():
    return datetime.now(timezone.utc).replace(tzinfo=None)


def iso(dt):
    return dt.replace(tzinfo=timezone.utc).isoformat(timespec='seconds').replace('+00:00', 'Z')


def token_hash(token):
    return hashlib.sha256(token.encode()).hexdigest()


def check_request(origin, address, chain_id):
    if not origin or origin.rstrip('/') not in ALLOWED_ORIGINS:
        raise HTTPException(403, 'Sign-in is only allowed from the Frostfish app domain.')
    if not is_address(address):
        raise HTTPException(422, 'A valid EVM wallet address is required.')
    if chain_id != CHAIN_ID:
        raise HTTPException(400, WRONG_CHAIN)
    return to_checksum_address(address), origin.rstrip('/')


def siwe_message(app_url, address, nonce, issued_at, expires_at):
    return (
        f'{urlsplit(app_url).netloc} wants you to sign in with your Ethereum account:\n'
        f'{address}\n\n'
        'Sign in to Frostfish. This is NOT a transaction: it costs no gas, moves no funds '
        'and grants no token approvals.\n\n'
        f'URI: {app_url}\nVersion: 1\nChain ID: {CHAIN_ID}\nNonce: {nonce}\n'
        f'Issued At: {iso(issued_at)}\nExpiration Time: {iso(expires_at)}'
    )


async def current_session(authorization: str | None = Header(default=None)):
    if not authorization or not authorization.startswith('Bearer '):
        raise HTTPException(401, 'Wallet sign-in is required.')
    session = await db.wallet_sessions.find_one(
        {'token_hash': token_hash(authorization[7:]), 'expires_at': {'$gt': utcnow()}}, {'_id': 0})
    if not session:
        raise HTTPException(401, 'Your wallet session has expired. Please sign in again.')
    return session


async def economy():
    settings = await pricing.get_settings(db)
    meta = await pricing.token_meta(settings)
    return settings, meta


async def price_or_503(settings):
    try:
        return await pricing.token_price(settings)
    except Exception as e:
        raise HTTPException(503, str(e)) from None


async def view(state):
    settings = await pricing.get_settings(db)
    return {**public_state(state), 'entry_paid': bool(state.get('entry_paid')),
            'entry_required': await access.needs_entry(settings, state), 'entry_fee_usd': settings['entry_fee_usd']}


async def require_entry(session):
    settings = await pricing.get_settings(db)
    if not settings.get('entry_fee_enabled'):
        return
    state = await db.games.find_one({'session_id': session['session_id']}, {'_id': 0, 'entry_paid': 1, 'wallet_address': 1})
    if state and await access.needs_entry(settings, state):
        raise HTTPException(402, f'Pay the ${settings["entry_fee_usd"]:g} entry fee to unlock the island.')


@app.get('/api/health')
async def health():
    await db.command('ping')
    return {'status': 'ok', 'game': 'Frostfish', 'chainId': CHAIN_ID}


@app.get('/api/config')
async def config():
    settings, meta = await economy()
    price = None
    try:
        price = await pricing.token_price(settings)
    except Exception:
        pass
    cap = await pricing.market_cap(settings)
    return {'chainId': CHAIN_ID, 'tokenAddress': settings['token_address'], 'treasuryAddress': settings['treasury_address'],
            'launchpadUrl': settings['launchpad_url'], 'symbol': meta['symbol'], 'decimals': meta['decimals'],
            'prices': settings['prices'], 'paybackHours': PAYBACK_HOURS,
            'hourlyUsd': hourly_rates(settings['prices']), 'lockedCharacters': settings.get('locked_characters', []),
            'tokenUsd': price['token_usd'] if price else None, 'ethUsd': price['eth_usd'] if price else None,
            'marketCapUsd': cap['market_cap_usd'] if cap else None, 'totalSupply': cap['total_supply'] if cap else None,
            'priceSource': price['source'] if price else None, 'priceUpdatedAt': price['updated_at'] if price else None,
            'claimEnabled': bool(os.environ.get('TREASURY_PRIVATE_KEY')), 'minClaimUsd': MIN_CLAIM_USD,
            'entryFeeEnabled': bool(settings.get('entry_fee_enabled')), 'entryFeeUsd': settings.get('entry_fee_usd'),
            'betaEnabled': bool(settings.get('beta_enabled')),
            'betaNft': ({'name': settings['nft_gate']['name'], 'url': settings['nft_gate']['opensea_url'], 'image': settings['nft_gate'].get('image_url'), 'chain': settings['nft_gate']['chain_label']}
                        if settings.get('beta_enabled') and access.nft_gate_active(settings) else None)}


@app.post('/api/auth/challenge')
async def auth_challenge(request: ChallengeRequest, origin: str | None = Header(default=None)):
    address, app_url = check_request(origin, request.address, request.chain_id)
    issued_at = utcnow()
    expires_at = issued_at + NONCE_TTL
    nonce = secrets.token_hex(16)
    message = siwe_message(app_url, address, nonce, issued_at, expires_at)
    await db.wallet_challenges.insert_one({'nonce': nonce, 'address': address.lower(), 'chain_id': CHAIN_ID,
                                           'domain': urlsplit(app_url).netloc, 'message': message, 'expires_at': expires_at})
    return {'nonce': nonce, 'message': message, 'expiresAt': iso(expires_at)}


@app.post('/api/auth/verify')
async def auth_verify(request: VerifyRequest, origin: str | None = Header(default=None)):
    address, app_url = check_request(origin, request.address, request.chain_id)
    # Atomic delete makes every nonce single-use, even if verification fails afterwards.
    challenge = await db.wallet_challenges.find_one_and_delete({'nonce': request.nonce})
    if not challenge or challenge['expires_at'] <= utcnow():
        raise HTTPException(401, 'That sign-in request expired or was already used. Please try again.')
    if (challenge['address'] != address.lower() or challenge['chain_id'] != CHAIN_ID
            or challenge['domain'] != urlsplit(app_url).netloc or challenge['message'] != request.message):
        raise HTTPException(401, 'The sign-in request does not match this wallet, domain or network.')
    try:
        recovered = Account.recover_message(encode_defunct(text=challenge['message']), signature=request.signature)
    except Exception:
        raise HTTPException(401, 'The wallet signature could not be verified.') from None
    if recovered.lower() != address.lower():
        raise HTTPException(401, 'The signature was made by a different wallet.')

    wallet_address = address.lower()
    settings = await pricing.get_settings(db)
    try:
        beta_ok = await access.beta_access(settings, wallet_address)
    except Exception:
        raise HTTPException(503, 'Could not verify NFT ownership right now. Please try again in a moment.') from None
    if beta_ok is None:
        raise HTTPException(403, access.beta_closed_message(settings))
    now = utcnow()
    await db.wallets.update_one({'address': wallet_address}, {
        '$set': {'checksum_address': address, 'chain_id': CHAIN_ID, 'last_login_at': now},
        '$setOnInsert': {'first_login_at': now}, '$inc': {'login_count': 1}}, upsert=True)
    wallet = await db.wallets.find_one({'address': wallet_address}, {'_id': 0, 'username': 1, 'entry_paid_at': 1})
    game = await db.games.find_one({'wallet_address': wallet_address}, {'_id': 0})
    if game:
        sid = game['session_id']
        if game.get('version') != VERSION:
            game = {**initial_state(sid), 'session_id': sid, 'wallet_address': wallet_address}
            await db.games.replace_one({'session_id': sid}, game.copy())
        patch = {}
        if wallet.get('username') and not game.get('username_set'):
            patch.update(name=wallet['username'], username_set=True)
        if wallet.get('entry_paid_at') and not game.get('entry_paid'):
            patch.update(entry_paid=True)
        if patch:
            game = {**game, **patch}
            await db.games.update_one({'session_id': sid}, {'$set': patch})
    else:
        sid = hashlib.sha256(secrets.token_urlsafe(40).encode()).hexdigest()
        game = {**initial_state(sid), 'session_id': sid, 'wallet_address': wallet_address, 'entry_paid': bool(wallet.get('entry_paid_at'))}
        await db.games.insert_one(game.copy())
    token = secrets.token_urlsafe(40)
    expires_at = utcnow() + SESSION_TTL
    await db.wallet_sessions.insert_one({'token_hash': token_hash(token), 'session_id': sid,
                                         'wallet_address': wallet_address, 'chain_id': CHAIN_ID,
                                         'expires_at': expires_at})
    return {'token': token, 'address': wallet_address, 'expiresAt': iso(expires_at), 'game': await view(game)}


@app.get('/api/auth/me')
async def auth_me(session=Depends(current_session)):
    return {'address': session['wallet_address'], 'chainId': session['chain_id'], 'expiresAt': iso(session['expires_at'])}


@app.post('/api/auth/logout')
async def auth_logout(authorization: str | None = Header(default=None)):
    if authorization and authorization.startswith('Bearer '):
        await db.wallet_sessions.delete_one({'token_hash': token_hash(authorization[7:])})
    return {'ok': True}


@app.get('/api/characters')
async def characters(_=Depends(current_session)):
    return list(CHARACTERS.values())


@app.get('/api/village')
async def village():
    return {'villagers': RESIDENTS}


async def mutate(sid, apply=None):
    for _ in range(8):
        state = await db.games.find_one({'session_id': sid}, {'_id': 0})
        if not state:
            raise HTTPException(401, 'Your island could not be found. Please sign in again.')
        revision = state['revision']
        if state.get('version') != VERSION:
            keep = {k: state[k] for k in ('name', 'username_set') if state.get('username_set')}
            if state.get('entry_paid'):
                keep['entry_paid'] = True
            state = {**initial_state(sid), **keep, 'session_id': sid, 'wallet_address': state['wallet_address']}
        advance(state)
        if apply:
            apply(state)
        state['revision'] = revision + 1
        result = await db.games.replace_one({'session_id': sid, 'revision': revision}, state.copy())
        if result.modified_count:
            return await view(state)
    raise HTTPException(409, 'The island is busy. Please try again.')


@app.get('/api/game')
async def get_game(session=Depends(current_session)):
    return await mutate(session['session_id'])


@app.post('/api/profile/username')
async def set_username(body: UsernameRequest, session=Depends(current_session)):
    await require_entry(session)
    wallet_address = session['wallet_address']
    current = await db.wallets.find_one({'address': wallet_address}, {'_id': 0, 'username': 1})
    if current and current.get('username'):
        raise HTTPException(409, 'You already chose a username.')
    try:
        result = await db.wallets.update_one({'address': wallet_address, 'username': {'$exists': False}}, {
            '$set': {'username': body.username, 'username_lower': body.username.lower(), 'username_set_at': utcnow()}})
    except DuplicateKeyError:
        raise HTTPException(409, 'That username is taken. Try another one.') from None
    if not result.matched_count:
        raise HTTPException(409, 'You already chose a username.')
    await db.games.update_one({'session_id': session['session_id']}, {'$set': {'name': body.username, 'username_set': True}})
    return {'username': body.username, 'game': await mutate(session['session_id'])}


@app.post('/api/entry/quote')
async def entry_quote(session=Depends(current_session)):
    settings = await pricing.get_settings(db)
    state = await db.games.find_one({'session_id': session['session_id']}, {'_id': 0, 'entry_paid': 1, 'wallet_address': 1})
    if not state or not await access.needs_entry(settings, state):
        raise HTTPException(409, 'Entry is already unlocked for this wallet.')
    try:
        eth_usd = await pricing.eth_usd(settings)
    except Exception as e:
        raise HTTPException(503, str(e)) from None
    fee_usd = float(settings['entry_fee_usd'])
    amount_wei = int(round(fee_usd / eth_usd * 1e18))
    quote_id = secrets.token_urlsafe(24)
    expires_at = utcnow() + QUOTE_TTL
    await db.entry_quotes.insert_one({
        'quote_id': quote_id, 'session_id': session['session_id'], 'wallet_address': session['wallet_address'],
        'fee_usd': fee_usd, 'eth_usd': eth_usd, 'amount_wei': str(amount_wei),
        'treasury_address': settings['treasury_address'].lower(), 'created_at': utcnow(), 'expires_at': expires_at})
    return {'quoteId': quote_id, 'feeUsd': fee_usd, 'ethUsd': eth_usd, 'amountWei': str(amount_wei), 'amountEth': amount_wei / 1e18,
            'treasuryAddress': settings['treasury_address'], 'chainId': CHAIN_ID, 'expiresAt': iso(expires_at)}


@app.post('/api/entry/confirm')
async def entry_confirm(body: ConfirmRequest, session=Depends(current_session)):
    tx_hash = body.tx_hash.lower()
    existing = await db.entry_payments.find_one({'tx_hash': tx_hash}, {'_id': 0})
    if existing:
        if existing['session_id'] != session['session_id']:
            raise HTTPException(409, 'This transaction was already used.')
        return {'status': 'confirmed', 'game': await mutate(session['session_id'])}
    quote = await db.entry_quotes.find_one({'quote_id': body.quote_id, 'session_id': session['session_id']}, {'_id': 0})
    if not quote:
        raise HTTPException(404, 'Entry quote not found. Start the payment again.')
    try:
        rcpt = await chain.receipt(tx_hash)
        tx = await chain.transaction(tx_hash) if rcpt else None
    except Exception:
        raise HTTPException(503, 'Robinhood Chain RPC is unreachable. Please retry in a moment.') from None
    if not rcpt or not tx:
        return {'status': 'pending'}
    if int(rcpt.get('status', '0x0'), 16) != 1:
        raise HTTPException(400, 'The ETH transfer failed on-chain.')
    if (rcpt.get('from') or '').lower() != quote['wallet_address'] or (rcpt.get('to') or '').lower() != quote['treasury_address']:
        raise HTTPException(400, 'This transaction is not an ETH transfer from your wallet to the treasury.')
    paid = int(tx.get('value', '0x0'), 16)
    needed = int(quote['amount_wei'])
    if paid < needed * 98 // 100:
        raise HTTPException(400, 'The ETH amount is lower than the quoted entry fee.')
    payment = {'tx_hash': tx_hash, 'quote_id': quote['quote_id'], 'session_id': session['session_id'],
               'wallet_address': quote['wallet_address'], 'fee_usd': quote['fee_usd'], 'eth_usd': quote['eth_usd'],
               'amount_wei': str(paid), 'amount_eth': paid / 1e18, 'block_number': int(rcpt['blockNumber'], 16), 'created_at': utcnow()}
    try:
        await db.entry_payments.insert_one(payment.copy())
    except Exception:
        raise HTTPException(409, 'This transaction was already used.') from None
    await db.wallets.update_one({'address': quote['wallet_address']}, {'$set': {'entry_paid_at': utcnow(), 'entry_tx_hash': tx_hash}})
    await db.entry_quotes.delete_one({'quote_id': quote['quote_id']})

    def unlock(state):
        state['entry_paid'] = True
        state['events'].insert(0, {'text': f"Entry ticket paid · ${quote['fee_usd']:g}", 'kind': 'crew', 'at': now_iso()})

    return {'status': 'confirmed', 'game': await mutate(session['session_id'], unlock)}


@app.post('/api/purchase/quote')
async def purchase_quote(body: QuoteRequest, session=Depends(current_session)):
    if body.character not in CHARACTERS:
        raise HTTPException(422, 'Choose a valid fisherman.')
    await require_entry(session)
    settings, meta = await economy()
    if body.character in settings.get('locked_characters', []):
        raise HTTPException(423, f'{CHARACTERS[body.character]["name"]} is not available yet.')
    price = await price_or_503(settings)
    price_usd = settings['prices'][body.character]
    hourly_usd = hourly_rates(settings['prices'])[body.character]
    amount = pricing.tokens_for_usd(price_usd, price['token_usd'], meta['decimals'])
    quote_id = secrets.token_urlsafe(24)
    expires_at = utcnow() + QUOTE_TTL
    await db.purchase_quotes.insert_one({
        'quote_id': quote_id, 'session_id': session['session_id'], 'wallet_address': session['wallet_address'],
        'character': body.character, 'price_usd': price_usd, 'hourly_usd': hourly_usd, 'token_usd': price['token_usd'], 'amount': str(amount),
        'token_address': settings['token_address'].lower(), 'treasury_address': settings['treasury_address'].lower(),
        'decimals': meta['decimals'], 'created_at': utcnow(), 'expires_at': expires_at})
    return {'quoteId': quote_id, 'character': body.character, 'priceUsd': price_usd, 'tokenUsd': price['token_usd'],
            'amount': str(amount), 'amountTokens': amount / 10 ** meta['decimals'], 'decimals': meta['decimals'],
            'symbol': meta['symbol'], 'tokenAddress': settings['token_address'], 'treasuryAddress': settings['treasury_address'],
            'chainId': CHAIN_ID, 'expiresAt': iso(expires_at)}


@app.post('/api/purchase/confirm')
async def purchase_confirm(body: ConfirmRequest, session=Depends(current_session)):
    tx_hash = body.tx_hash.lower()
    existing = await db.purchases.find_one({'tx_hash': tx_hash}, {'_id': 0})
    if existing:
        if existing['session_id'] != session['session_id']:
            raise HTTPException(409, 'This transaction was already used.')
        return {'status': 'confirmed', 'purchase': existing, 'game': await mutate(session['session_id'])}
    quote = await db.purchase_quotes.find_one({'quote_id': body.quote_id, 'session_id': session['session_id']}, {'_id': 0})
    if not quote:
        raise HTTPException(404, 'Purchase quote not found. Start the purchase again.')
    if quote['character'] in (await pricing.get_settings(db)).get('locked_characters', []):
        raise HTTPException(423, f'{CHARACTERS[quote["character"]]["name"]} is not available yet.')
    try:
        rcpt = await chain.receipt(tx_hash)
    except Exception:
        raise HTTPException(503, 'Robinhood Chain RPC is unreachable. Please retry in a moment.') from None
    if not rcpt:
        return {'status': 'pending'}
    if int(rcpt.get('status', '0x0'), 16) != 1:
        raise HTTPException(400, 'The token transfer failed on-chain.')
    if (rcpt.get('to') or '').lower() != quote['token_address'] or (rcpt.get('from') or '').lower() != quote['wallet_address']:
        raise HTTPException(400, 'This transaction is not a token transfer from your wallet.')
    needed = int(quote['amount'])
    paid = sum(v for f, t, v in chain.transfer_logs(rcpt, quote['token_address'])
               if f == quote['wallet_address'] and t == quote['treasury_address'])
    if paid < needed * 98 // 100:
        raise HTTPException(400, 'The transfer amount is lower than the quoted price.')
    purchase = {'tx_hash': tx_hash, 'quote_id': quote['quote_id'], 'session_id': session['session_id'],
                'wallet_address': quote['wallet_address'], 'character': quote['character'], 'price_usd': quote['price_usd'],
                'token_usd': quote['token_usd'], 'amount': str(paid), 'amount_tokens': paid / 10 ** quote['decimals'],
                'block_number': int(rcpt['blockNumber'], 16), 'created_at': utcnow()}
    try:
        await db.purchases.insert_one(purchase.copy())
    except Exception:
        raise HTTPException(409, 'This transaction was already used.') from None
    uid = {}
    game = await mutate(session['session_id'], lambda s: uid.update(uid=grant(s, quote['character'], quote['price_usd'], tx_hash, quote.get('hourly_usd'))))
    await db.purchases.update_one({'tx_hash': tx_hash}, {'$set': {'worker_uid': uid.get('uid')}})
    await db.purchase_quotes.delete_one({'quote_id': quote['quote_id']})
    purchase['worker_uid'] = uid.get('uid')
    purchase['created_at'] = iso(purchase['created_at'])
    return {'status': 'confirmed', 'purchase': purchase, 'game': game}


@app.post('/api/claim')
async def claim(session=Depends(current_session)):
    key = os.environ.get('TREASURY_PRIVATE_KEY')
    if not key:
        raise HTTPException(503, 'Claims are not enabled yet. The treasury signer has not been configured.')
    settings, meta = await economy()
    price = await price_or_503(settings)
    sid = session['session_id']
    await require_entry(session)
    if await db.claims.find_one({'session_id': sid, 'status': 'pending'}):
        raise HTTPException(409, 'A claim is already being processed.')
    taken = {}

    def take(state):
        taken['micro'] = state['balance_micro']
        if state['balance_micro'] < MIN_CLAIM_USD * 1_000_000:
            raise HTTPException(400, f'You need at least ${MIN_CLAIM_USD:.2f} in earnings to claim.')
        state['balance_micro'] = 0
        state['claimed_micro'] = state.get('claimed_micro', 0) + taken['micro']

    game = await mutate(sid, take)
    usd = taken['micro'] / 1_000_000
    amount = pricing.tokens_for_usd(usd, price['token_usd'], meta['decimals'])
    claim_doc = {'claim_id': secrets.token_urlsafe(16), 'session_id': sid, 'wallet_address': session['wallet_address'],
                 'usd': usd, 'token_usd': price['token_usd'], 'amount': str(amount), 'amount_tokens': amount / 10 ** meta['decimals'],
                 'status': 'pending', 'created_at': utcnow()}
    await db.claims.insert_one(claim_doc.copy())
    try:
        balance = await chain.erc20_balance(settings['token_address'], settings['treasury_address'])
        if balance < amount:
            raise RuntimeError('The treasury does not hold enough tokens right now. Please try again later.')
        tx_hash = await chain.send_erc20(settings['token_address'], key, session['wallet_address'], amount)
    except Exception as e:
        def restore(state):
            state['balance_micro'] += taken['micro']
            state['claimed_micro'] = max(0, state.get('claimed_micro', 0) - taken['micro'])
        game = await mutate(sid, restore)
        await db.claims.update_one({'claim_id': claim_doc['claim_id']}, {'$set': {'status': 'failed', 'error': str(e)[:300]}})
        raise HTTPException(400, f'Claim failed: {str(e)[:200]}') from None
    await db.claims.update_one({'claim_id': claim_doc['claim_id']}, {'$set': {'status': 'sent', 'tx_hash': tx_hash}})
    return {'txHash': tx_hash, 'usd': usd, 'amountTokens': amount / 10 ** meta['decimals'], 'symbol': meta['symbol'], 'game': game}


@app.get('/api/claims')
async def claims(session=Depends(current_session)):
    docs = await db.claims.find({'session_id': session['session_id']}, {'_id': 0}).sort('created_at', -1).limit(20).to_list(20)
    for d in docs:
        d['created_at'] = iso(d['created_at'])
    return {'claims': docs}


@app.get('/api/leaderboard')
async def leaderboard(session=Depends(current_session)):
    sid = session['session_id']
    docs = await db.games.find({'version': VERSION, 'username_set': True}, {'_id': 0, 'name': 1, 'total_earned_micro': 1, 'workers': 1, 'session_id': 1}) \
        .sort([('total_earned_micro', -1), ('session_id', 1)]).limit(10).to_list(10)
    entries = [{'rank': i + 1, 'name': d['name'], 'rewards': d['total_earned_micro'] / 1_000_000,
                'workers': len(d['workers']), 'you': d['session_id'] == sid} for i, d in enumerate(docs)]
    you = None
    me = await db.games.find_one({'session_id': sid, 'version': VERSION}, {'_id': 0, 'name': 1, 'username_set': 1, 'session_id': 1, 'total_earned_micro': 1, 'workers': 1})
    if me and me.get('username_set'):
        rank = await db.games.count_documents({'version': VERSION, 'username_set': True, '$or': [
            {'total_earned_micro': {'$gt': me['total_earned_micro']}},
            {'total_earned_micro': me['total_earned_micro'], 'session_id': {'$lt': sid}}]}) + 1
        you = {'rank': rank, 'name': me['name'], 'rewards': me['total_earned_micro'] / 1_000_000, 'workers': len(me['workers'])}
    return {'entries': entries, 'you': you}


@app.on_event('startup')
async def indexes():
    await db.games.delete_many({'wallet_address': {'$exists': False}})
    await db.games.create_index('session_id', unique=True)
    await db.games.create_index('wallet_address', unique=True, sparse=True)
    await db.games.create_index([('total_earned_micro', -1)])
    await db.wallets.create_index('address', unique=True)
    await db.wallets.create_index('username_lower', unique=True, partialFilterExpression={'username_lower': {'$type': 'string'}})
    await db.wallet_challenges.create_index('nonce', unique=True)
    await db.wallet_challenges.create_index('expires_at', expireAfterSeconds=0)
    await db.wallet_sessions.create_index('token_hash', unique=True)
    await db.wallet_sessions.create_index('expires_at', expireAfterSeconds=0)
    await db.purchase_quotes.create_index('quote_id', unique=True)
    await db.purchase_quotes.create_index('created_at', expireAfterSeconds=7200)
    await db.purchases.create_index('tx_hash', unique=True)
    await db.purchases.create_index('wallet_address')
    await db.claims.create_index('claim_id', unique=True)
    await db.claims.create_index([('session_id', 1), ('status', 1)])
    await db.entry_quotes.create_index('quote_id', unique=True)
    await db.entry_quotes.create_index('created_at', expireAfterSeconds=7200)
    await db.entry_payments.create_index('tx_hash', unique=True)
    await db.entry_payments.create_index('wallet_address')
    await admin_indexes()
    asyncio.create_task(warm_price())


async def warm_price():
    try:
        settings = await pricing.get_settings(db)
        await pricing.token_price(settings)
    except Exception:
        pass


@app.on_event('shutdown')
async def shutdown():
    client.close()
