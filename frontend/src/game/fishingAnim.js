import * as THREE from 'three';

const { lerp, clamp } = THREE.MathUtils;
const ease = t => t < .5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
const seg = (t, a, b) => clamp((t - a) / (b - a), 0, 1);

/** Rod: wind back, whip forward, wait, nibble, hook, reel in. Negative angle = tip up/back. */
export const ROD = { release: .08, land: .14, nibble: .7, hook: .74, exit: .8 };
export function rodPose(f, time) {
  if (f < .05) { const k = ease(seg(f, 0, .05)); return { angle: lerp(-.12, -1.7, k), lean: -.09 * k }; }
  if (f < .09) { const k = seg(f, .05, .09); return { angle: lerp(-1.7, .5, k * k), lean: lerp(-.09, .13, k) }; }
  if (f < .16) { const k = ease(seg(f, .09, .16)); return { angle: lerp(.5, -.2, k), lean: lerp(.13, 0, k) }; }
  if (f < ROD.nibble) return { angle: -.2 + Math.sin(time * 2.2) * .04, lean: Math.sin(time * 1.1) * .01 };
  if (f < ROD.hook) { const k = Math.sin(seg(f, ROD.nibble, ROD.hook) * Math.PI); return { angle: -.2 - .22 * k, lean: 0 }; }
  if (f < ROD.exit) { const k = seg(f, ROD.hook, ROD.exit), snap = Math.min(1, k * 3); return { angle: lerp(-.2, -1.5, snap) + (snap >= 1 ? Math.sin(time * 32) * .06 : 0), lean: -.16 * snap }; }
  const k = ease(seg(f, ROD.exit, 1)); return { angle: lerp(-1.5, -.12, k), lean: lerp(-.16, 0, k) };
}

/** Net: raise, plunge, drag through the water, lift the catch. */
export const NET = { plunge: .42, lift: .76, exit: .84 };
export function netPose(f, time) {
  if (f < .3) { const k = ease(seg(f, 0, .3)); return { angle: lerp(-.12, -1.25, k), lean: -.07 * k }; }
  if (f < NET.plunge) { const k = seg(f, .3, NET.plunge); return { angle: lerp(-1.25, .8, k * k), lean: lerp(-.07, .2, k) }; }
  if (f < NET.lift) { const k = seg(f, NET.plunge, NET.lift); return { angle: .8 + Math.sin(time * 3.4) * .09 - k * .25, lean: .2 - k * .1, sweep: Math.sin(time * 1.6) * .35 }; }
  if (f < .9) { const k = ease(seg(f, NET.lift, .9)); return { angle: lerp(.55, -1.05, k), lean: lerp(.1, -.12, k) }; }
  const k = ease(seg(f, .9, 1)); return { angle: lerp(-1.05, -.12, k), lean: lerp(-.12, 0, k) };
}

/** Where the bobber (or net hoop) is relative to its water point, and whether it is visible. */
export function bobberState(f, time, kind) {
  if (kind === 'net') return { visible: false };
  if (f < ROD.release || f >= ROD.exit) return { visible: false };
  if (f < ROD.land) return { visible: true, flight: seg(f, ROD.release, ROD.land), dy: 0 };
  if (f < ROD.nibble) return { visible: true, dy: Math.sin(time * 2.6) * .03 };
  if (f < ROD.hook) return { visible: true, dy: -.1 * Math.sin(seg(f, ROD.nibble, ROD.hook) * Math.PI) };
  return { visible: true, dy: -.22 - Math.abs(Math.sin(time * 28)) * .08, dx: Math.sin(time * 19) * .05 };
}

/** Ring bursts in seconds since an event: returns {scale, opacity} or null. */
export function burst(seconds, duration = .55, from = .6, to = 2.4) {
  if (seconds < 0 || seconds > duration) return null;
  const k = seconds / duration; return { scale: lerp(from, to, Math.sqrt(k)), opacity: (1 - k) * .9 };
}
export const sagged = (() => {
  const mid = new THREE.Vector3();
  return (out, a, b, sag) => {
    mid.lerpVectors(a, b, .5); mid.y -= sag;
    const n = out.length / 3;
    for (let i = 0; i < n; i++) { const t = i / (n - 1), u = 1 - t; out[i * 3] = u * u * a.x + 2 * u * t * mid.x + t * t * b.x; out[i * 3 + 1] = u * u * a.y + 2 * u * t * mid.y + t * t * b.y; out[i * 3 + 2] = u * u * a.z + 2 * u * t * mid.z + t * t * b.z; }
  };
})();
