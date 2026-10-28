import * as THREE from 'three';
const cache=new WeakMap();
export function routePoint(points,progress){
  if(!cache.has(points)){const lengths=points.slice(1).map((p,i)=>Math.hypot(p[0]-points[i][0],p[2]-points[i][2]));cache.set(points,{lengths,total:lengths.reduce((a,b)=>a+b,0)});}
  const {lengths,total}=cache.get(points);
  let target=total*THREE.MathUtils.clamp(progress,0,1);
  for(let i=0;i<lengths.length;i++){
    if(target<=lengths[i]||i===lengths.length-1){const t=target/lengths[i],a=points[i],b=points[i+1];return {x:THREE.MathUtils.lerp(a[0],b[0],t),y:THREE.MathUtils.lerp(a[1],b[1],t),z:THREE.MathUtils.lerp(a[2],b[2],t),angle:Math.atan2(b[0]-a[0],b[2]-a[2])};}target-=lengths[i];
  }
}