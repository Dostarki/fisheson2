"""Minimal JSON-RPC client for Robinhood Chain (no web3.py dependency)."""
import os
from pathlib import Path

import httpx
from dotenv import load_dotenv
from eth_abi import decode, encode
from eth_account import Account
from eth_utils import keccak, to_checksum_address

load_dotenv(Path(__file__).parent / '.env')
RPC_URL = os.environ['ROBINHOOD_RPC_URL']
CHAIN_ID = int(os.environ['ROBINHOOD_CHAIN_ID'])
TRANSFER_TOPIC = '0x' + keccak(text='Transfer(address,address,uint256)').hex()


def selector(sig):
    return keccak(text=sig)[:4]


async def rpc(method, params, url=RPC_URL):
    async with httpx.AsyncClient(timeout=15) as client:
        res = await client.post(url, json={'jsonrpc': '2.0', 'id': 1, 'method': method, 'params': params})
    data = res.json()
    if 'error' in data:
        raise RuntimeError(data['error'].get('message', 'RPC error'))
    return data['result']


async def call(to, sig, types=(), args=(), out_types=('uint256',), url=RPC_URL):
    data = '0x' + (selector(sig) + (encode(list(types), list(args)) if types else b'')).hex()
    raw = await rpc('eth_call', [{'to': to, 'data': data}, 'latest'], url)
    if raw in (None, '0x'):
        raise RuntimeError(f'Empty response from {sig}')
    return decode(list(out_types), bytes.fromhex(raw[2:]))


async def erc20_decimals(token):
    return (await call(token, 'decimals()', out_types=('uint8',)))[0]


async def erc20_symbol(token):
    return (await call(token, 'symbol()', out_types=('string',)))[0]


async def erc20_total_supply(token):
    return (await call(token, 'totalSupply()'))[0]


async def erc20_balance(token, owner):
    return (await call(token, 'balanceOf(address)', ('address',), (owner,)))[0]


async def eth_balance(address):
    return int(await rpc('eth_getBalance', [address, 'latest']), 16)


async def curve_reserves(curve):
    quote, tokens = await call(curve, 'getReserves()', out_types=('uint256', 'uint256'))
    return quote, tokens


async def curve_graduated(curve):
    try:
        return (await call(curve, 'graduated()', out_types=('bool',)))[0]
    except Exception:
        return False


async def receipt(tx_hash):
    return await rpc('eth_getTransactionReceipt', [tx_hash])


async def transaction(tx_hash):
    return await rpc('eth_getTransactionByHash', [tx_hash])


def transfer_logs(rcpt, token):
    """Yield (from, to, value) for every ERC-20 Transfer of `token` in the receipt."""
    for log in rcpt.get('logs', []):
        if log['address'].lower() != token.lower() or not log['topics'] or log['topics'][0].lower() != TRANSFER_TOPIC:
            continue
        if len(log['topics']) < 3:
            continue
        yield ('0x' + log['topics'][1][-40:]).lower(), ('0x' + log['topics'][2][-40:]).lower(), int(log['data'], 16)


async def send_erc20(token, private_key, to, amount):
    """Sign and broadcast transfer(to, amount) from the key's account. Returns tx hash."""
    account = Account.from_key(private_key)
    data = '0x' + (selector('transfer(address,uint256)') + encode(['address', 'uint256'], [to_checksum_address(to), amount])).hex()
    nonce = int(await rpc('eth_getTransactionCount', [account.address, 'pending']), 16)
    gas_price = int(int(await rpc('eth_gasPrice', []), 16) * 1.25) + 1
    try:
        gas = int(int(await rpc('eth_estimateGas', [{'from': account.address, 'to': token, 'data': data}]), 16) * 1.3)
    except Exception:
        gas = 120_000
    tx = {'to': to_checksum_address(token), 'value': 0, 'data': data, 'nonce': nonce, 'gas': gas,
          'gasPrice': gas_price, 'chainId': CHAIN_ID}
    signed = account.sign_transaction(tx)
    raw = signed.raw_transaction.hex()
    return await rpc('eth_sendRawTransaction', [raw if raw.startswith('0x') else '0x' + raw])


def treasury_signer_address(private_key):
    return Account.from_key(private_key).address
