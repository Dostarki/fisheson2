"""Server-authoritative economy. Fishermen are bought with real tokens; earnings accrue in USD and pay back in 48h."""
import time
from datetime import datetime, timezone
from villagers import advance_villagers, initial_villagers, public_villagers

VERSION = 3
PAYBACK_HOURS = 48
REST = 120
CHARACTERS = {
    'rod': {'id': 'rod', 'name': 'The Angler', 'role': 'Rod fisherman', 'limit': 20, 'capacity': 5, 'fish_time': 3.0, 'walk': 9.0, 'rest': REST, 'vessel': None, 'mult': None},
    'net': {'id': 'net', 'name': 'The Netter', 'role': 'Net fisherman', 'limit': 100, 'capacity': 10, 'fish_time': 1.2, 'walk': 10.0, 'rest': REST, 'vessel': None, 'mult': None},
    'boat': {'id': 'boat', 'name': 'The Captain', 'role': 'Boat fisherman', 'limit': 200, 'capacity': 20, 'fish_time': 0.8, 'walk': 10.0, 'rest': REST, 'vessel': 'boat', 'mult': None},
    'yacht': {'id': 'yacht', 'name': 'The Yachtsman', 'role': 'Yacht fisherman', 'limit': 400, 'capacity': 40, 'fish_time': 0.5, 'walk': 12.0, 'rest': 60, 'vessel': 'yacht', 'mult': 3},
    'sub': {'id': 'sub', 'name': 'The Submariner', 'role': 'Submarine fisherman', 'limit': 600, 'capacity': 60, 'fish_time': 0.4, 'walk': 12.0, 'rest': 30, 'vessel': 'sub', 'mult': 5},
    'flagship': {'id': 'flagship', 'name': 'The Admiral', 'role': 'Flagship fisherman', 'limit': 1000, 'capacity': 100, 'fish_time': 0.3, 'walk': 14.0, 'rest': 30, 'vessel': 'flagship', 'mult': 10},
    'mothership': {'id': 'mothership', 'name': 'The Legend', 'role': 'Mothership fisherman', 'limit': 2000, 'capacity': 200, 'fish_time': 0.2, 'walk': 14.0, 'rest': 30, 'vessel': 'mothership', 'mult': 20},
}
DEFAULT_LOCKED = ['mothership']


def hourly_rates(prices):
    """USD/hour per character: Captain-multiple characters scale off the Captain's rate, others pay back in 48h."""
    captain = prices['boat'] / PAYBACK_HOURS
    return {cid: (captain * c['mult'] if c['mult'] else prices[cid] / PAYBACK_HOURS) for cid, c in CHARACTERS.items()}


def hourly_of(w):
    return w.get('hourly_usd') or w['price_usd'] / PAYBACK_HOURS


def cycle(c):
    trip = c['capacity'] * c['fish_time'] + 2 * c['walk']
    trips = c['limit'] // c['capacity']
    work = trip * trips
    return trip, trips, work, work + c['rest']


for _c in CHARACTERS.values():
    _c['cycle_seconds'] = cycle(_c)[3]


def fish_value_usd(c, hourly_usd):
    return hourly_usd * 24 * c['cycle_seconds'] / (86400 * c['limit'])


def phase(c, elapsed):
    trip, trips, work, total = cycle(c)
    cycles, r = divmod(elapsed, total)
    if r >= work:
        return {'status': 'Sleeping', 'energy': round((r - work) / c['rest'] * 100), 'bucket': 0,
                'rest_left': round(total - r), 'session_caught': c['limit'], 'cycles': int(cycles)}
    i, te = divmod(r, trip)
    fishing = c['capacity'] * c['fish_time']
    bucket = min(c['capacity'], int(te // c['fish_time']))
    caught = int(i) * c['capacity'] + bucket
    energy = 100 - (int(i) * c['capacity'] + min(c['capacity'], te / c['fish_time'])) / c['limit'] * 100
    status = 'Fishing' if te < fishing else 'Delivering' if te < fishing + c['walk'] else 'Returning'
    if status == 'Returning':
        bucket = 0
    return {'status': status, 'energy': round(energy), 'bucket': bucket, 'rest_left': 0,
            'session_caught': caught, 'cycles': int(cycles)}


def delivered_trips(c, elapsed):
    trip, trips, work, total = cycle(c)
    cycles, r = divmod(elapsed, total)
    arrive = c['capacity'] * c['fish_time'] + c['walk']
    done = 0 if r < arrive else min(trips, int((r - arrive) // trip) + 1)
    return int(cycles) * trips + done


def now_iso():
    return datetime.now(timezone.utc).isoformat()


def initial_state(sid):
    return {'version': VERSION, 'name': f"Islander #{sid[:4].upper()}", 'workers': [],
            'balance_micro': 0, 'total_earned_micro': 0, 'claimed_micro': 0,
            'fish_sold': 0, 'fish_caught': 0, 'market_stock': 0, 'events': [], 'revision': 0, 'next_uid': 1,
            'last_tick': time.time(), 'created_at': now_iso(), 'villagers': initial_villagers(),
            'customers_served': 0, 'simulation_time': 0.0, 'next_sale_at': 0.0}


def advance(state):
    now = time.time()
    delta = min(8, max(0, now - state['last_tick']))
    state['last_tick'] = now
    for w in state['workers']:
        c = CHARACTERS[w['character']]
        w['elapsed'] += delta
        done = delivered_trips(c, w['elapsed'])
        if done > w['delivered']:
            fish = (done - w['delivered']) * c['capacity']
            earn = round(fish * fish_value_usd(c, hourly_of(w)) * 1_000_000)
            w['delivered'] = done
            w['sold'] += fish
            w['earned_micro'] += earn
            state['balance_micro'] += earn
            state['total_earned_micro'] += earn
            state['market_stock'] += fish
            state['events'].insert(0, {'text': f"{c['name']} #{w['uid']} delivered {fish} fish · +${earn / 1_000_000:.4f}",
                                       'kind': 'sale', 'at': now_iso()})
    remaining = delta
    while remaining > .000001:
        dt = min(.2, remaining)
        remaining -= dt
        state['simulation_time'] += dt
        advance_villagers(state, dt)
    state['fish_caught'] = sum(caught(w) for w in state['workers'])
    state['events'] = state['events'][:12]


def caught(w):
    c = CHARACTERS[w['character']]
    p = phase(c, w['elapsed'])
    return p['cycles'] * c['limit'] + p['session_caught']


def grant(state, character, price_usd, tx_hash, hourly_usd=None):
    c = CHARACTERS[character]
    # Vessels share one global slot sequence so no two ships ever park on the same spot.
    same = (lambda w: CHARACTERS[w['character']]['vessel'] is not None) if c['vessel'] else (lambda w: w['character'] == character)
    slot = sum(1 for w in state['workers'] if same(w))
    uid = state['next_uid']
    state['workers'].append({'uid': uid, 'character': character, 'slot': slot, 'elapsed': 0.0,
                             'delivered': 0, 'sold': 0, 'earned_micro': 0, 'price_usd': price_usd,
                             'hourly_usd': hourly_usd or price_usd / PAYBACK_HOURS,
                             'tx_hash': tx_hash, 'bought_at': now_iso()})
    state['next_uid'] += 1
    state['events'].insert(0, {'text': f"Hired {c['name']} #{uid} · ${price_usd:g}", 'kind': 'crew', 'at': now_iso()})
    return uid


def worker_view(w):
    c = CHARACTERS[w['character']]
    p = phase(c, w['elapsed'])
    return {'uid': w['uid'], 'id': w['character'], 'character': w['character'], 'slot': w['slot'],
            'name': c['name'], 'role': c['role'], 'price_usd': w['price_usd'], 'hourly_usd': hourly_of(w),
            'tx_hash': w.get('tx_hash'), 'bought_at': w.get('bought_at'), 'capacity': c['capacity'],
            'limit': c['limit'], 'elapsed': w['elapsed'], 'status': p['status'], 'energy': p['energy'],
            'bucket': p['bucket'], 'rest_left': p['rest_left'], 'caught': p['cycles'] * c['limit'] + p['session_caught'],
            'sold': w['sold'], 'earned_usd': w['earned_micro'] / 1_000_000}


def public_state(state):
    workers = [worker_view(w) for w in state['workers']]
    return {'name': state['name'], 'username_set': bool(state.get('username_set')), 'workers': workers,
            'active_workers': sum(1 for w in workers if w['status'] != 'Sleeping'),
            'hourly_usd': sum(w['hourly_usd'] for w in workers), 'invested_usd': sum(w['price_usd'] for w in workers),
            'claimable_usd': state['balance_micro'] / 1_000_000, 'earned_usd': state['total_earned_micro'] / 1_000_000,
            'claimed_usd': state.get('claimed_micro', 0) / 1_000_000,
            'fish_sold': state['fish_sold'], 'fish_caught': state['fish_caught'],
            'customers_served': state['customers_served'], 'market_stock': state['market_stock'],
            'paused': False, 'speed': 1, 'events': state['events'][:12], 'revision': state['revision'],
            'created_at': state['created_at'], 'villagers': public_villagers(state),
            'simulation_time': state['simulation_time']}
