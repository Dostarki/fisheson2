import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { Block } from './Models';
import { MARKET } from '../lib/gameData';
export { Customers } from './VillagerActors';

export const MarketStock=({gameRef,preview,earlyAccessStage})=>{
  const refs=useRef([]),coin=useRef(),reward=useRef();
  const rewardMaterial=useMemo(()=>{
    const canvas=document.createElement('canvas');canvas.width=512;canvas.height=128;
    const ctx=canvas.getContext('2d');ctx.font='bold 54px "Silkscreen","Press Start 2P",monospace';ctx.textAlign='center';ctx.textBaseline='middle';
    ctx.lineWidth=9;ctx.strokeStyle='#17344e';ctx.strokeText('TOKEN EARNED',256,66);ctx.fillStyle='#fff1ae';ctx.fillText('TOKEN EARNED',256,66);
    const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;
    return new THREE.SpriteMaterial({map:texture,transparent:true,depthTest:false});
  },[]);
  useEffect(()=>()=>{rewardMaterial.map?.dispose();rewardMaterial.dispose();},[rewardMaterial]);
  useFrame(({clock})=>{
    const earning=preview&&earlyAccessStage?.id==='earn';
    const elapsed=earning?Math.max(0,(performance.now()-earlyAccessStage.startedAt)/1000):0;
    const sold=preview&&(earning||earlyAccessStage?.id==='sell'&&(performance.now()-earlyAccessStage.startedAt)/1000>=4.8);
    const stock=preview?(sold?8:7):gameRef.current?.market_stock||0;
    refs.current.forEach((ref,i)=>{if(ref)ref.visible=i<stock;});
    if(coin.current){coin.current.visible=earning||!preview&&stock>0;coin.current.position.y=3.25+(earning?Math.min(.9,elapsed*.45):0)+Math.sin(clock.elapsedTime*3)*.13;coin.current.rotation.y=clock.elapsedTime*(earning?3.2:1);coin.current.scale.setScalar(earning?1.25:1);}
    if(reward.current){const visible=earning&&elapsed<5.5;reward.current.visible=visible;reward.current.position.set(.45,3.9+Math.min(.85,elapsed*.42),.2);rewardMaterial.opacity=visible?Math.min(1,elapsed*2):0;}
  });
  return <group position={[MARKET[0],0,MARKET[2]]}>
    {Array.from({length:12},(_,i)=><group key={i} ref={el=>refs.current[i]=el}><Block at={[-.75+i%4*.47,2.39+Math.floor(i/4)*.09,.2+Math.floor(i/4)*.14]} size={[.11,.09,.38]} color={i%3?'#7fd3f0':'#ffb347'} rotation={[0,.3,0]}/></group>)}
    <mesh ref={coin} position={[.4,3.25,.3]} rotation={[Math.PI/2,0,0]}><cylinderGeometry args={[.15,.15,.04,8]}/><meshStandardMaterial color="#ffd23f" emissive="#e0a800" emissiveIntensity={.5}/></mesh>
    <sprite ref={reward} material={rewardMaterial} scale={[1.65,.42,1]} renderOrder={24} visible={false}/>
  </group>;
};
