import { riverX, shoreZ } from '../game/villageBuilder';
import { CREW_BY_ID } from './gameData';

const BANK_Z = [5.2, 2.9, .6, -8.6, -10.9, -13.2, -15.5, -17.8, -20.1, -22.4, -24.7, -27];
// One shared grid for every vessel type, spaced for the largest hull so ships never overlap.
const VESSEL_X = [-12.5, -8, -3.5, 1, 19, 23.5, 28, 32.5, 37, 41.5], VESSEL_ROW = 7;
const Y = 1.02;
const MARKET_STOP = [[.8, Y, 4.3], [.8, Y, 4.1]];
const bank = (z, side, off = 0) => [riverX(z) + side * (1.9 + off), Y, z];
function bankWalk(from, to, side, off) {
  const pts = [], step = from > to ? -2 : 2;
  for (let z = from; step < 0 ? z > to : z < to; z += step) pts.push(bank(z, side, off));
  pts.push(bank(to, side, off));
  return pts;
}

export function workerLayout(type, slot) {
  const c = CREW_BY_ID[type];
  if (c.vessel) {
    const n = VESSEL_X.length, x = VESSEL_X[slot % n], row = Math.floor(slot / n), z = shoreZ(x) + 3.5 + row * VESSEL_ROW, sy = .43 + c.deck;
    const spot = [x, sy, z], mz = 13.2 + (slot % 4), lane = 19.5 + row * VESSEL_ROW;
    const sea = x > 7 ? [spot, [x, sy, lane], [6.4, sy, lane], [7.1, sy, mz]] : [spot, [7.1, sy, mz]];
    return { spot, facing: 0, seaPoints: sea.length, route: [...sea, [8.8, Y, mz], [8.8, Y, 5.6], [.8, Y, 5.6], [.8, Y, 4.1]] };
  }
  const side = type === 'rod' ? 1 : -1, n = BANK_Z.length, z = BANK_Z[slot % n], off = Math.floor(slot / n) * 3.2;
  const spot = bank(z, side, off);
  const route = type === 'rod'
    ? [...bankWalk(z, 4.3, 1, off), ...MARKET_STOP]
    : [...bankWalk(z, -5.5, -1, off), bank(-5.5, 1, 0), ...bankWalk(-5.5, 4.3, 1, 0), ...MARKET_STOP];
  const hammock = [riverX(z + 1.15) + side * (3.05 + off), Y, z + 1.15];
  return { spot, facing: side > 0 ? -Math.PI / 2 : Math.PI / 2, route, hammock };
}

export function makeRoute(raw) {
  const pts = raw.filter((p, i) => i === 0 || Math.hypot(p[0] - raw[i - 1][0], p[2] - raw[i - 1][2]) > 1e-4);
  const cum = [0];
  for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][2] - pts[i - 1][2]));
  const total = cum[cum.length - 1];
  return {
    total,
    lengthTo: idx => cum[Math.min(idx, cum.length - 1)],
    at(d) {
      const dist = Math.max(0, Math.min(total, d));
      let i = 1;
      while (i < pts.length - 1 && cum[i] < dist) i++;
      const a = pts[i - 1], b = pts[i] || a, seg = (cum[i] - cum[i - 1]) || 1, t = (dist - cum[i - 1]) / seg;
      return { x: a[0] + (b[0] - a[0]) * t, y: a[1] + (b[1] - a[1]) * t, z: a[2] + (b[2] - a[2]) * t, angle: Math.atan2(b[0] - a[0], b[2] - a[2]) };
    },
  };
}
