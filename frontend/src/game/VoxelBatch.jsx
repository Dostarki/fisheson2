import { useLayoutEffect, useRef } from 'react';
import { useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { voxelLiteMaterial } from './voxelLiteMaterial';

/** Thousands of colored blocks, a single draw call. Shared geometry keeps the village light. */
export const VoxelBatch = ({ blocks, emissive = false, lite=false, opacity=1, ...props }) => {
  const mesh = useRef();
  const { invalidate } = useThree();
  useLayoutEffect(() => {
    const matrix = new THREE.Matrix4(), quaternion = new THREE.Quaternion();
    const p = new THREE.Vector3(), s = new THREE.Vector3(), color = new THREE.Color();
    blocks.forEach((b, i) => {
      p.set(b.x,b.y,b.z); s.set(b.w,b.h,b.d);
      quaternion.setFromEuler(new THREE.Euler(0,b.r || 0,0));
      matrix.compose(p,quaternion,s); mesh.current.setMatrixAt(i,matrix);
      mesh.current.setColorAt(i,color.set(b.color));
    });
    mesh.current.instanceMatrix.needsUpdate=true;
    mesh.current.instanceColor.needsUpdate=true;
    mesh.current.computeBoundingSphere();
    invalidate();
  },[blocks,invalidate]);
  return <instancedMesh ref={mesh} args={[null,null,blocks.length]} castShadow={!emissive&&!lite} receiveShadow={!emissive&&!lite} {...props}>
    <boxGeometry/>
    {emissive ? <meshBasicMaterial toneMapped={false}/> : lite ? <primitive object={voxelLiteMaterial} attach="material" dispose={null}/> : <meshLambertMaterial color="white" transparent={opacity<1} opacity={opacity} depthWrite={opacity>=1}/>}
  </instancedMesh>;
};