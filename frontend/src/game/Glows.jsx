import { useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { dayInfo } from '../lib/environment';

let haloTexture;
function radial() {
  if (haloTexture) return haloTexture;
  const canvas = document.createElement('canvas'); canvas.width = canvas.height = 128;
  const ctx = canvas.getContext('2d'), g = ctx.createRadialGradient(64, 64, 2, 64, 64, 64);
  g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(.25, 'rgba(255,255,255,.55)'); g.addColorStop(.6, 'rgba(255,255,255,.14)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, 128, 128);
  haloTexture = new THREE.CanvasTexture(canvas); return haloTexture;
}
const BILLBOARD = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().lookAt(new THREE.Vector3(35, 27, 43), new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 1, 0)));
const FLAT = new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI / 2, 0, 0));
const glowMaterial = color => new THREE.MeshBasicMaterial({ map: radial(), color, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, opacity: .3 });

/** Soft halos + warm ground pools for every lamp, window and torch; brightens as night falls. */
export const Glows = ({ lamps, lights = true }) => {
  const halo = useRef(), pool = useRef();
  const haloMat = useMemo(() => glowMaterial('#ffd38a'), []), poolMat = useMemo(() => glowMaterial('#ffb866'), []);
  const pointLights = useRef([]);
  const lit = useMemo(() => lamps.filter(l => l.light), [lamps]);
  useLayoutEffect(() => {
    const m = new THREE.Matrix4(), p = new THREE.Vector3(), s = new THREE.Vector3();
    lamps.forEach((l, i) => {
      p.set(l.x, l.y, l.z); s.set(l.s, l.s, 1); m.compose(p, BILLBOARD, s); halo.current.setMatrixAt(i, m);
      p.set(l.x, l.ground ?? 1.1, l.z); s.set(l.s * 1.6, l.s * 1.6, 1); m.compose(p, FLAT, s); pool.current.setMatrixAt(i, m);
    });
    halo.current.instanceMatrix.needsUpdate = pool.current.instanceMatrix.needsUpdate = true;
    halo.current.computeBoundingSphere(); pool.current.computeBoundingSphere();
  }, [lamps]);
  useFrame(({ clock }) => {
    const { weights } = dayInfo();
    const night = Math.min(1, weights[3] + weights[2] * .6 + weights[0] * .3);
    const flicker = 1 + Math.sin(clock.elapsedTime * 7.3) * .04 + Math.sin(clock.elapsedTime * 13.1) * .03;
    haloMat.opacity = (.14 + .7 * night) * flicker; poolMat.opacity = (.08 + .5 * night) * flicker;
    pointLights.current.forEach(light => { if (light) light.intensity = (1.5 + 9 * night) * flicker; });
  });
  return <>
    <instancedMesh ref={halo} args={[null, null, lamps.length]} material={haloMat} frustumCulled={false} renderOrder={5}><planeGeometry /></instancedMesh>
    <instancedMesh ref={pool} args={[null, null, lamps.length]} material={poolMat} frustumCulled={false} renderOrder={4}><planeGeometry /></instancedMesh>
    {lights && lit.map((l, i) => <pointLight key={i} ref={el => pointLights.current[i] = el} position={[l.x, l.y + .1, l.z]} color={l.color || '#ffc772'} intensity={4} distance={l.s * 3.6} decay={2} />)}
  </>;
};
