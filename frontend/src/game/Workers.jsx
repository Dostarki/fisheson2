import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { Fisher, Bucket, Vessel, Rod, Hammock } from './Models';
import { ROD_PIVOT, ROD_TIP, NET_TIP } from './mergedModels';
import { CREW_BY_ID, workerPhase } from '../lib/gameData';
import { workerLayout, makeRoute } from '../lib/spots';
import { fishMaterial, zzzMaterial, barBgMaterial } from './labels';
import { rodPose, netPose, bobberState, burst, sagged, ROD, NET } from './fishingAnim';

const BAR = .8, right = new THREE.Vector3(), head = new THREE.Vector3(), tipWorld = new THREE.Vector3(), lineEnd = new THREE.Vector3(), water = new THREE.Vector3();
const PREVIEW_OFFSET = { rod: 4, net: 31, boat: 330, yacht: 120, sub: 210, flagship: 40, mothership: 0 };
const PATROL_SPEED = .32;
const LINE_POINTS = 9;
const ringGeometry = new THREE.RingGeometry(.22, .3, 14), ringMaterial = new THREE.MeshBasicMaterial({ color: '#eafcff', transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false });
const Sleeper = ({ color, kind }) => <group rotation={[0, Math.PI / 2, 0]}><group position={[0, .62, .65]} rotation={[-Math.PI / 2, 0, 0]}><Fisher color={color} kind={kind} pose="walking" /></group></group>;

/** Rod line, bobber, splash rings and the flying catch for one fishing cycle (fishT 0..1). */
function animateFishing(R, { kind, fishing, fishT, fishTime, time, waterAt, bucketAt, boat }) {
  const net = kind === 'net', sub = kind === 'sub', pose = net ? netPose(fishT, time) : rodPose(fishT, time);
  R.rod.visible = !sub;
  R.rod.rotation.set(fishing ? pose.angle : .25, fishing && pose.sweep ? pose.sweep : 0, 0);
  R.body.rotation.x = fishing ? pose.lean : 0;
  water.set(waterAt[0], waterAt[1], waterAt[2]);
  const exit = net ? NET.exit : ROD.exit;
  R.jump.visible = fishing && fishT > exit && fishT < 1;
  if (R.jump.visible) {
    const s = (fishT - exit) / (1 - exit);
    R.jump.position.set(THREE.MathUtils.lerp(water.x, bucketAt[0], s), THREE.MathUtils.lerp(water.y, bucketAt[1] + .35, s) + Math.sin(Math.PI * s) * 1.4, THREE.MathUtils.lerp(water.z, bucketAt[2], s));
    R.jump.rotation.set(s * 9, 0, s * 4);
  }
  const bob = fishing && !sub ? bobberState(fishT, time, kind) : { visible: false };
  R.bobber.visible = bob.visible;
  R.line.visible = fishing && !net && !sub && fishT >= ROD.release && fishT < .94;
  if (R.line.visible || bob.visible) { R.rod.updateWorldMatrix(true, false); tipWorld.set(ROD_TIP[0], ROD_TIP[1], ROD_TIP[2]); R.rod.localToWorld(tipWorld); R.root.worldToLocal(tipWorld); }
  if (bob.visible) {
    if (bob.flight !== undefined) R.bobber.position.lerpVectors(tipWorld, water, bob.flight).setY(THREE.MathUtils.lerp(tipWorld.y, water.y, bob.flight) + Math.sin(Math.PI * bob.flight) * .9);
    else R.bobber.position.set(water.x + (bob.dx || 0), water.y + bob.dy, water.z);
  }
  if (R.line.visible) {
    const reeling = fishT >= ROD.exit;
    if (reeling) lineEnd.copy(R.jump.position); else lineEnd.copy(R.bobber.position);
    const taut = reeling || fishT >= ROD.hook ? 0 : fishT < ROD.land ? .05 : .22 * tipWorld.distanceTo(lineEnd) * .5;
    sagged(R.line.geometry.attributes.position.array, tipWorld, lineEnd, taut);
    R.line.geometry.attributes.position.needsUpdate = true;
  }
  const splashAt = net ? [NET.plunge, NET.lift] : [ROD.land, ROD.exit];
  [R.splash, R.splash2].forEach((ring, i) => {
    const b = fishing ? burst((fishT - splashAt[i]) * fishTime, .6, .5, net ? 3.2 : 2.4) : null;
    ring.visible = !!b; if (b) { ring.scale.setScalar(b.scale); ring.material.opacity = b.opacity; ring.position.set(water.x, water.y + .02, water.z); }
  });
  const idle = fishing && !net && fishT > ROD.land && fishT < ROD.nibble;
  const ripple = idle ? burst(time % 1.9, 1.3, .4, 1.8) : null;
  R.ripple.visible = !!ripple; if (ripple) { R.ripple.scale.setScalar(ripple.scale); R.ripple.material.opacity = ripple.opacity * .45; R.ripple.position.set(water.x, water.y + .015, water.z); }
  if (net) { R.netSplash.visible = fishing && fishT > NET.plunge && fishT < NET.lift; if (R.netSplash.visible) { R.rod.updateWorldMatrix(true, false); tipWorld.set(NET_TIP[0], NET_TIP[1], NET_TIP[2]); R.rod.localToWorld(tipWorld); R.root.worldToLocal(tipWorld); R.netSplash.position.set(tipWorld.x, water.y + .02, tipWorld.z); R.netSplash.scale.setScalar(1.1 + Math.sin(time * 6) * .15); R.netSplash.material.opacity = .4; } }
  else R.netSplash.visible = false;
  if (boat && fishing) R.body.rotation.x += Math.sin(time * .9) * .015;
}

export const WorkerActor = ({ uid, type, slot, gameRef, preview, earlyAccessStage }) => {
  const c = CREW_BY_ID[type], boat = !!c.vessel, deck = c.deck || 0, patrol = c.patrol || 0;
  const layout = useMemo(() => workerLayout(type, slot), [type, slot]);
  const route = useMemo(() => makeRoute(layout.route), [layout]);
  const seaLen = boat ? route.lengthTo(layout.seaPoints - 1) : 0;
  const speed = Math.max(3.4, route.total / (c.walk - .8));
  const reach = type === 'net' ? 1.35 : boat ? 2.6 : 2.1;
  const spotFor = (pos, facing, out) => { const dx = Math.sin(facing), dz = Math.cos(facing); out.bucket[0] = pos[0] + dz * .45; out.bucket[1] = pos[1] + (boat ? -.05 : 0); out.bucket[2] = pos[2] - dx * .45; out.water[0] = pos[0] + dx * reach; out.water[1] = boat ? .1 : .3; out.water[2] = pos[2] + dz * reach; return out; };
  const anchors = useMemo(() => spotFor(layout.spot, layout.facing, { bucket: [0, 0, 0], water: [0, 0, 0] }), [layout]); // eslint-disable-line react-hooks/exhaustive-deps
  const R = useRef({}).current, set = k => el => { R[k] = el; if (k === 'body' && el) el.rotation.order = 'YXZ'; };
  const fillMat = useMemo(() => new THREE.SpriteMaterial({ color: '#6ee75b', depthTest: false, transparent: true }), []);
  const line = useMemo(() => { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(LINE_POINTS * 3), 3)); const l = new THREE.Line(g, new THREE.LineBasicMaterial({ color: '#f6fffb', transparent: true, opacity: .9 })); l.frustumCulled = false; l.visible = false; return l; }, []);
  const rings = useMemo(() => Array.from({ length: 4 }, () => ringMaterial.clone()), []);
  useEffect(() => () => { fillMat.dispose(); line.geometry.dispose(); line.material.dispose(); rings.forEach(m => m.dispose()); }, [fillMat, line, rings]);

  useFrame(({ clock, camera }) => {
    const g = gameRef.current, w = preview ? null : g?.byUid?.[uid];
    if (!R.root) return;
    R.root.visible = preview || !!w; if (!R.root.visible) return;
    const time = clock.elapsedTime;
    const elapsed = preview ? time + PREVIEW_OFFSET[type] : w.elapsed + Math.min(4, (performance.now() - g.received) / 1000);
    let p = workerPhase(c, elapsed);
    let stageElapsed = 0;
    const stage = preview && type === 'rod' ? earlyAccessStage : null;
    if (stage) {
      stageElapsed = Math.max(0, (performance.now() - stage.startedAt) / 1000);
      if (stage.id === 'cast') {
        p = { ...p, state: 'fishing', fishT: Math.min(.22, stageElapsed * .15), bucket: 0, energy: 1 };
      } else if (stage.id === 'catch') {
        p = { ...p, state: 'fishing', fishT: stageElapsed < 2.55 ? .79 + Math.min(.209, stageElapsed * .082) : 1, bucket: stageElapsed >= 2.55 ? 1 : 0, energy: 1 };
      } else if (stage.id === 'sell') {
        const deliverySeconds = 5.2;
        p = { ...p, state: 'delivering', t: Math.min(route.total / speed, stageElapsed * route.total / (deliverySeconds * speed)), bucket: 1, energy: 1 };
      } else if (stage.id === 'earn') {
        p = { ...p, state: 'delivering', t: route.total / speed, bucket: 0, energy: 1 };
      }
    }
    let pos = layout.spot, rotY = layout.facing, pose = 'fish', moving = false, sleeping = false, onBoat = boat, boatPos = layout.spot, boatRot = 0;
    let { bucket: bucketAt, water: waterAt } = anchors;
    if (p.state === 'delivering' || p.state === 'returning') {
      const d = Math.min(route.total, p.t * speed), dist = p.state === 'delivering' ? d : route.total - d, q = route.at(dist);
      moving = d < route.total; pos = [q.x, q.y, q.z];
      rotY = moving ? q.angle + (p.state === 'returning' ? Math.PI : 0) : p.state === 'delivering' ? Math.PI : layout.facing;
      pose = p.state === 'delivering' ? 'carry' : moving ? 'walk' : 'fish';
      if (boat) {
        const b = route.at(Math.min(dist, seaLen)); boatPos = [b.x, layout.spot[1], b.z];
        boatRot = b.angle + (p.state === 'returning' && moving ? Math.PI : 0);
        onBoat = dist <= seaLen; if (onBoat) { pos = boatPos; rotY = boatRot; }
      }
    } else if (p.state === 'resting') {
      if (boat) sleeping = true;
      else {
        const k = p.t < 1.4 ? p.t / 1.4 : p.restLeft < 1.4 ? p.restLeft / 1.4 : 1;
        sleeping = k >= 1; moving = !sleeping; pose = 'walk';
        const h = layout.hammock;
        pos = [THREE.MathUtils.lerp(layout.spot[0], h[0], k), layout.spot[1], THREE.MathUtils.lerp(layout.spot[2], h[2] - .5, k)];
        rotY = Math.atan2(h[0] - layout.spot[0], h[2] - layout.spot[2]) + (p.t < 1.4 ? 0 : Math.PI);
      }
    } else if (patrol) {
      // Submarines and warships cruise a tight loop inside their own berth while they fish.
      const a = time * PATROL_SPEED + uid;
      boatPos = [layout.spot[0] + Math.sin(a) * patrol, layout.spot[1], layout.spot[2] + Math.cos(a) * patrol];
      boatRot = Math.atan2(Math.cos(a), -Math.sin(a));
      pos = boatPos; rotY = boatRot;
      ({ bucket: bucketAt, water: waterAt } = spotFor(pos, rotY, R.dyn || (R.dyn = { bucket: [0, 0, 0], water: [0, 0, 0] })));
    }
    if (stage?.id === 'earn') pose = 'fish';
    const bob = moving ? Math.abs(Math.sin(time * 9)) * .07 : Math.sin(time * 1.7) * .012;
    R.body.visible = !sleeping;
    R.body.position.set(pos[0], pos[1] + bob, pos[2]);
    R.body.rotation.set(0, rotY, moving ? Math.sin(time * 9) * .07 : 0);
    R.fish.visible = pose === 'fish'; R.carry.visible = pose === 'carry'; R.walk.visible = pose === 'walk';
    R.sleep.visible = sleeping;
    const fishing = p.state === 'fishing';
    animateFishing(R, { kind: type === 'net' ? 'net' : type === 'sub' ? 'sub' : 'rod', fishing, fishT: p.fishT || 0, fishTime: c.fishTime, time, waterAt, bucketAt, boat });
    R.bucket.position.set(bucketAt[0], bucketAt[1], bucketAt[2]);
    R.bucket.visible = fishing || (p.state === 'returning' && !moving) || (stage?.id === 'catch' && p.bucket > 0);
    R.bucketEmpty.visible = p.bucket === 0; R.bucketFull.visible = p.bucket > 0;
    if (R.boat) { R.boat.position.set(boatPos[0], .2 + Math.sin(time * .9 + uid) * .04, boatPos[2]); R.boat.rotation.y = boatRot; }
    if (sleeping) head.set(boat ? boatPos[0] : layout.hammock[0], (boat ? .6 + deck : layout.hammock[1]) + 1.25, boat ? boatPos[2] : layout.hammock[2]);
    else head.set(pos[0], pos[1] + (onBoat && moving ? 1.95 : 1.8), pos[2]);
    R.emoji.visible = !sleeping; R.zzz.visible = sleeping;
    R.emoji.position.set(head.x, head.y + .35 + Math.sin(time * 2.4 + uid) * .06, head.z);
    R.zzz.position.set(head.x + .2, head.y + .2 + (time * .35 % .35), head.z);
    right.set(1, 0, 0).applyQuaternion(camera.quaternion).multiplyScalar(-BAR / 2);
    R.bar.position.copy(head).add(right);
    R.fill.scale.x = Math.max(.02, BAR * p.energy);
    fillMat.color.set(p.energy > .5 ? '#6ee75b' : p.energy > .2 ? '#ffd23f' : '#ff4d4d');
  });

  return <group ref={set('root')}>
    <group ref={set('body')}>
      <group ref={set('fish')}><Fisher color={c.color} kind={type} pose="fishing" /><group ref={set('rod')} position={ROD_PIVOT}><Rod kind={type === 'net' ? 'net' : 'rod'} /></group></group>
      <group ref={set('carry')} visible={false}><Fisher color={c.color} kind={type} pose="carry" /></group>
      <group ref={set('walk')} visible={false}><Fisher color={c.color} kind={type} pose="walking" /></group>
    </group>
    <group ref={set('bucket')} position={anchors.bucket}><group ref={set('bucketEmpty')}><Bucket /></group><group ref={set('bucketFull')}><Bucket filled /></group></group>
    <group ref={set('jump')} visible={false}>
      <mesh><boxGeometry args={[.11, .11, .3]} /><meshLambertMaterial color="#ff9f1c" /></mesh>
      <mesh position={[0, 0, -.2]}><boxGeometry args={[.04, .14, .1]} /><meshLambertMaterial color="#ffb347" /></mesh>
    </group>
    <primitive object={line} ref={set('line')} />
    <group ref={set('bobber')} visible={false}>
      <mesh position={[0, .05, 0]}><boxGeometry args={[.11, .09, .11]} /><meshLambertMaterial color="#ff3b3b" /></mesh>
      <mesh position={[0, -.03, 0]}><boxGeometry args={[.11, .07, .11]} /><meshLambertMaterial color="#fffdf5" /></mesh>
    </group>
    {['splash', 'splash2', 'ripple', 'netSplash'].map((k, i) => <mesh key={k} ref={set(k)} geometry={ringGeometry} material={rings[i]} rotation={[-Math.PI / 2, 0, 0]} visible={false} renderOrder={3} />)}
    {boat
      ? <group ref={set('boat')}><Vessel kind={c.vessel} /><group position={[0, .12 + deck, 0]} rotation={[0, Math.PI / 2, 0]} scale={.75}><Hammock /><group ref={set('sleep')} visible={false}><Sleeper color={c.color} kind={type} /></group></group></group>
      : <group position={layout.hammock}><Hammock /><group ref={set('sleep')} visible={false}><Sleeper color={c.color} kind={type} /></group></group>}
    <sprite ref={set('emoji')} material={fishMaterial} scale={[1.15, .58, 1]} renderOrder={20} />
    <sprite ref={set('zzz')} material={zzzMaterial} scale={[1.1, .55, 1]} renderOrder={20} visible={false} />
    <group ref={set('bar')}>
      <sprite material={barBgMaterial} center={[0, .5]} scale={[BAR, .13, 1]} renderOrder={21} />
      <sprite ref={set('fill')} material={fillMat} center={[0, .5]} scale={[BAR, .08, 1]} renderOrder={22} />
    </group>
  </group>;
};

const PREVIEW = [[-1, 'rod', 0], [-2, 'net', 0], [-3, 'boat', 0], [-4, 'yacht', 1], [-5, 'sub', 2], [-6, 'flagship', 3]];
export const Workers = ({ roster, gameRef, preview, earlyAccessStage }) => {
  const list = useMemo(() => preview ? PREVIEW : roster ? roster.split(',').map(s => { const [u, t, sl] = s.split(':'); return [Number(u), t, Number(sl)]; }) : [], [roster, preview]);
  useFrame(({ clock }) => { zzzMaterial.opacity = .65 + Math.sin(clock.elapsedTime * 3) * .35; });
  return <>{list.map(([uid, type, slot]) => <WorkerActor key={`${uid}-${preview}`} uid={uid} type={type} slot={slot} gameRef={gameRef} preview={preview} earlyAccessStage={earlyAccessStage} />)}</>;
};
