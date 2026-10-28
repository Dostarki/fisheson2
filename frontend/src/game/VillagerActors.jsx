import { useEffect, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { Fisher } from './Models';
import { routePoint } from './routes';

export const Customers=({gameRef,preview})=>{
  const [residents,setResidents]=useState([]);
  const refs=useRef({}),walkers=useRef({}),shoppers=useRef({});
  useEffect(()=>{
    const controller=new AbortController();
    fetch(`${process.env.REACT_APP_BACKEND_URL}/api/village`,{signal:controller.signal}).then(r=>r.ok?r.json():Promise.reject()).then(data=>setResidents(data.villagers)).catch(()=>{});
    return()=>controller.abort();
  },[]);
  useFrame(({clock})=>{
    const game=gameRef.current;
    residents.forEach((meta,i)=>{
      const ref=refs.current[meta.id];if(!ref)return;
      let resident=game?.villagers?.find(v=>v.id===meta.id);
      if(preview){
        const t=(clock.elapsedTime+i*4.3)%34;
        resident={...meta,state:t<4?'home':t<13?'to_market':t<21?'waiting':'returning',phase_time:t<4?t:t<13?t-4:t<21?t-13:t-21,travel_time:t<21?9:13,queue_position:i%3};
      }
      ref.visible=!!resident&&resident.state!=='home';if(!ref.visible)return;
      const extra=preview||game?.paused?0:Math.min(2.4,(performance.now()-game.received)/1000)*game.speed;
      const phase=resident.phase_time+extra;
      const returning=resident.state==='returning',waiting=resident.state==='waiting';
      const progress=waiting?1:THREE.MathUtils.clamp(phase/resident.travel_time,0,1);
      const p=routePoint(resident.route||meta.route,returning?1-progress:progress);
      const queueOffset=waiting?resident.queue_position*.48:0;
      const moving=!waiting&&progress<1&&!game?.paused;
      ref.position.set(p.x,p.y+(moving?Math.abs(Math.sin(clock.elapsedTime*8+i))*.035:0),p.z+queueOffset);
      ref.rotation.y=waiting?Math.PI:p.angle+(returning?Math.PI:0);
      if(walkers.current[meta.id])walkers.current[meta.id].visible=!returning;
      if(shoppers.current[meta.id])shoppers.current[meta.id].visible=returning;
    });
  });
  return <>{residents.map(meta=><group key={meta.id} ref={el=>refs.current[meta.id]=el} scale={.79} visible={false}>
    <group ref={el=>walkers.current[meta.id]=el}><Fisher color={meta.color} kind="customer" pose="walking"/></group>
    <group ref={el=>shoppers.current[meta.id]=el} visible={false}><Fisher color={meta.color} kind="customer" pose="shopping"/></group>
  </group>)}</>;
};