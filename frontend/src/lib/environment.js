export const DAY_SECONDS = 480;
export const WEATHER_SECONDS = 120;
export const PHASES = ['morning', 'noon', 'evening', 'night'];
export const LIGHT_KEYS = [
  { sun: '#ffc48a', sunI: 2.4, amb: '#ffe0c8', ambI: .62, sky: '#ffcfae', ground: '#6aa7bd', hemiI: .85, bright: 1.0, sunset: .55 },
  { sun: '#fff3d6', sunI: 3.1, amb: '#ffffff', ambI: .74, sky: '#bfe4ff', ground: '#78bccb', hemiI: .95, bright: 1.12, sunset: .06 },
  { sun: '#ff8a66', sunI: 2.2, amb: '#f6b3d4', ambI: .56, sky: '#ffb0c8', ground: '#6a8fb2', hemiI: .8, bright: .95, sunset: 1 },
  { sun: '#7d95ff', sunI: .75, amb: '#4a5db0', ambI: .42, sky: '#3b4e9e', ground: '#1d2c55', hemiI: .55, bright: .48, sunset: 0 },
];
// Shared, mutable render-side environment values written by DayCycle and read by shaders.
export const env = { bright: 1, sunset: 1 };

export function dayInfo(now = Date.now()) {
  const t = (now / 1000 % DAY_SECONDS) / DAY_SECONDS;
  const weights = PHASES.map((_, i) => { let d = Math.abs(t - (i + .5) / 4); d = Math.min(d, 1 - d); return Math.max(0, 1 - d * 4); });
  return { t, phase: PHASES[Math.floor(t * 4)], weights };
}
const rnd = n => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
export function weatherAt(now = Date.now()) {
  return rnd(Math.floor(now / 1000 / WEATHER_SECONDS)) < .33 ? 'rain' : 'snow';
}
