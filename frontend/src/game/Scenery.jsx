import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { VoxelBatch } from './VoxelBatch';
import { seeded } from './villageBuilder';

const ICE = ['#6f9cc4', '#8fb6d6', '#b4d3ea', '#d9ebf7', '#f3f9ff'];
function peak(out, cx, cz, r, h, seed) {
  const layers = Math.max(4, Math.round(h / .9));
  for (let l = 0; l < layers; l++) {
    const t = l / layers, w = Math.max(.8, r * (1 - t) * (1 + seeded(seed + l) * .16 - .08)), y = .5 + l * .9;
    const x = cx + Math.sin(l * 1.7 + seed) * .35, color = ICE[Math.min(4, Math.floor(t * 5.2))];
    out.push({ x, y, z: cz, w, h: .92, d: w * .82, color });
    if (t > .45) out.push({ x, y: y + .5, z: cz, w: w + .06, h: .16, d: w * .82 + .06, color: '#ffffff' });
    if (l % 3 === 1 && t < .5) out.push({ x: x + w * .34, y: y + .2, z: cz + w * .3, w: w * .32, h: .5, d: w * .32, color: '#dcecf8' });
  }
}
/** Icy voxel mountains past the northern and western shores, plus icebergs drifting in the open sea. */
export const IceMountains = () => {
  const blocks = useMemo(() => {
    const out = [];
    for (let i = 0; i < 17; i++) peak(out, -74 + i * 9.2 + seeded(i * 3) * 4, -50 - seeded(i * 5) * 6, 6.5 + seeded(i * 7) * 4.5, 12 + seeded(i * 11) * 11, i);
    for (let i = 0; i < 11; i++) peak(out, -82 + i * 15 + seeded(i * 13) * 6, -63 - seeded(i * 17) * 8, 11 + seeded(i * 19) * 6, 20 + seeded(i * 23) * 12, 40 + i);
    for (let i = 0; i < 8; i++) peak(out, -53 - seeded(i * 29) * 6, -46 + i * 8 + seeded(i * 31) * 3, 6 + seeded(i * 37) * 4, 10 + seeded(i * 41) * 10, 80 + i);
    for (let i = 0; i < 6; i++) peak(out, 70 + seeded(i * 43) * 6, -54 + i * 9 + seeded(i * 47) * 3, 5 + seeded(i * 53) * 3, 6 + seeded(i * 59) * 3.5, 120 + i);
    // Icebergs: low, so they never hide the island; kept clear of boat lanes (x -12..42, z 13..27).
    for (let i = 0; i < 14; i++) { const west = i < 6; peak(out, west ? -48 + seeded(i * 61) * 28 : -40 + seeded(i * 61) * 84, west ? 15 + seeded(i * 67) * 24 : 29 + seeded(i * 67) * 16, 1.6 + seeded(i * 71) * 2.2, 2 + seeded(i * 73) * 3, 160 + i); }
    return out;
  }, []);
  return <VoxelBatch blocks={blocks} castShadow={false} receiveShadow={false} />;
};

const cloudBlocks = seed => {
  const out = [], n = 4 + Math.floor(seeded(seed) * 4);
  for (let i = 0; i < n; i++) {
    const w = 1.8 + seeded(seed * 3 + i) * 2.4, d = 1.6 + seeded(seed * 11 + i) * 1.4, x = (i - n / 2) * 1.6 + seeded(seed + i) * .7, z = (seeded(seed * 5 + i) - .5) * 1.6;
    out.push({ x, y: .45 + seeded(seed * 7 + i) * .5, z, w, h: .95 + seeded(seed * 9 + i) * .7, d, color: i % 3 ? '#fcfdff' : '#eef4fb' });
    out.push({ x, y: -.25, z, w: w * .8, h: .5, d: d * .8, color: '#cad9ea' });
  }
  return out;
};
const Cloud = ({ cloud, index, refs }) => <group ref={el => refs.current[index] = el} position={[cloud.x, cloud.y, cloud.z]} scale={cloud.scale}><VoxelBatch blocks={cloud.blocks} opacity={.78} castShadow={false} receiveShadow={false} /></group>;

/** Soft voxel clouds drifting east across the whole sky; they wrap around when they leave. */
export const Clouds = ({ count = 10 }) => {
  const refs = useRef([]);
  const clouds = useMemo(() => Array.from({ length: count }, (_, i) => ({
    blocks: cloudBlocks(i + 1), x: -75 + seeded(i * 13) * 150, z: -58 + seeded(i * 5) * 90, y: 12 + seeded(i * 17) * 7, speed: .3 + seeded(i * 19) * .45, scale: .8 + seeded(i * 23) * .9,
  })), [count]);
  useFrame((_, delta) => refs.current.forEach((g, i) => {
    if (!g) return; g.position.x += clouds[i].speed * delta; if (g.position.x > 80) g.position.x = -80;
  }));
  return <>{clouds.map((cloud, i) => <Cloud key={i} cloud={cloud} index={i} refs={refs} />)}</>;
};
