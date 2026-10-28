export const CREW = [
  { id: 'rod', name: 'The Angler', role: 'ROD FISHERMAN', subtitle: 'A rod. A quiet spot. A fresh start.', limit: 20, capacity: 5, fishTime: 3, walk: 9, rest: 120, color: '#ff7f2a', location: 'River bank' },
  { id: 'net', name: 'The Netter', role: 'NET FISHERMAN', subtitle: 'Cast a little wider. Catch a little more.', limit: 100, capacity: 10, fishTime: 1.2, walk: 10, rest: 120, color: '#12b5a5', location: 'West bank' },
  { id: 'boat', name: 'The Captain', role: 'BOAT FISHERMAN', subtitle: 'Good things wait beyond the shore.', limit: 200, capacity: 20, fishTime: .8, walk: 10, rest: 120, color: '#3f6dff', location: 'Open sea', vessel: 'boat', deck: 0 },
  { id: 'yacht', name: 'The Yachtsman', role: 'YACHT FISHERMAN', subtitle: 'Bigger deck. Bigger haul. One-minute naps.', limit: 400, capacity: 40, fishTime: .5, walk: 12, rest: 60, color: '#1f8fe6', location: 'Open sea', vessel: 'yacht', deck: .45, mult: 3 },
  { id: 'sub', name: 'The Submariner', role: 'SUBMARINE FISHERMAN', subtitle: 'Hunts below the waves, roams the whole bay.', limit: 600, capacity: 60, fishTime: .4, walk: 12, rest: 30, color: '#4a6f8f', location: 'Deep sea', vessel: 'sub', deck: .55, mult: 5, patrol: .9 },
  { id: 'flagship', name: 'The Admiral', role: 'FLAGSHIP FISHERMAN', subtitle: 'The fleet follows wherever the Admiral sails.', limit: 1000, capacity: 100, fishTime: .3, walk: 14, rest: 30, color: '#d9342b', location: 'Open sea', vessel: 'flagship', deck: .6, mult: 10, patrol: .8 },
  { id: 'mothership', name: 'The Legend', role: 'MOTHERSHIP FISHERMAN', subtitle: 'A ship of legend. Not yet seen in these waters.', limit: 2000, capacity: 200, fishTime: .2, walk: 14, rest: 30, color: '#8a4bd6', location: 'Open sea', vessel: 'mothership', deck: .7, mult: 20, patrol: .6 },
];
export const CREW_BY_ID = Object.fromEntries(CREW.map(c => [c.id, c]));
export const MARKET = [.4, 1, 2.4];

export function cycleOf(c) {
  const trip = c.capacity * c.fishTime + 2 * c.walk, trips = c.limit / c.capacity, work = trip * trips;
  return { trip, work, total: work + c.rest };
}

// Mirrors backend game.phase so animation matches the authoritative economy.
export function workerPhase(c, elapsed) {
  const { trip, work, total } = cycleOf(c), r = elapsed % total;
  if (r >= work) { const t = r - work; return { state: 'resting', t, restLeft: c.rest - t, energy: t / c.rest, bucket: 0 }; }
  const i = Math.floor(r / trip), te = r % trip, fishing = c.capacity * c.fishTime;
  const energy = 1 - (i * c.capacity + Math.min(c.capacity, te / c.fishTime)) / c.limit;
  if (te < fishing) return { state: 'fishing', t: te, energy, bucket: Math.floor(te / c.fishTime), fishT: (te % c.fishTime) / c.fishTime };
  if (te < fishing + c.walk) return { state: 'delivering', t: te - fishing, energy, bucket: c.capacity };
  return { state: 'returning', t: te - fishing - c.walk, energy, bucket: 0 };
}

export const restLabel = c => c.rest >= 60 ? `${c.rest / 60} min` : `${c.rest} s`;
