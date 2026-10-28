import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { dayInfo, weatherAt, env, LIGHT_KEYS } from '../lib/environment';
import { voxelLiteMaterial } from './voxelLiteMaterial';

const cols = k => LIGHT_KEYS.map(x => new THREE.Color(x[k]));
const SUN = cols('sun'), AMB = cols('amb'), SKY = cols('sky'), GROUND = cols('ground');
const mix = (arr, w, out) => { out.setRGB(0, 0, 0); arr.forEach((c, i) => { out.r += c.r * w[i]; out.g += c.g * w[i]; out.b += c.b * w[i]; }); };
const num = (k, w) => LIGHT_KEYS.reduce((s, x, i) => s + x[k] * w[i], 0);

export const DayCycle = ({ profile }) => {
  const sun = useRef(), amb = useRef(), hemi = useRef(), wet = useRef(weatherAt() === 'rain' ? 1 : 0);
  useFrame((_, delta) => {
    if (!sun.current) return;
    const { weights } = dayInfo();
    wet.current = THREE.MathUtils.damp(wet.current, weatherAt() === 'rain' ? 1 : 0, 1.2, delta);
    const dim = 1 - wet.current * .25;
    mix(SUN, weights, sun.current.color); sun.current.intensity = num('sunI', weights) * dim;
    mix(AMB, weights, amb.current.color); amb.current.intensity = num('ambI', weights);
    mix(SKY, weights, hemi.current.color); mix(GROUND, weights, hemi.current.groundColor); hemi.current.intensity = num('hemiI', weights) * dim;
    env.bright = num('bright', weights) * (1 - wet.current * .15); env.sunset = num('sunset', weights) * (1 - wet.current * .6);
    voxelLiteMaterial.uniforms.uBright.value = Math.max(.42, env.bright); voxelLiteMaterial.uniforms.uTint.value.copy(amb.current.color);
  });
  return <>
    <ambientLight ref={amb} intensity={.6} /><hemisphereLight ref={hemi} />
    <directionalLight ref={sun} position={[-18, 32, -15]} intensity={2.4} castShadow={profile.shadows} shadow-mapSize={[profile.shadowSize, profile.shadowSize]} shadow-camera-left={-27} shadow-camera-right={27} shadow-camera-top={27} shadow-camera-bottom={-27} shadow-camera-far={110} shadow-bias={-.0005} shadow-normalBias={.04} />
    <directionalLight position={[15, 8, 24]} intensity={.5} color="#c2dbeb" />
  </>;
};
