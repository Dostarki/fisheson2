import { useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { VoxelBatch } from './VoxelBatch';
import { seeded } from './villageBuilder';
import { env } from '../lib/environment';

const vertex = `varying vec3 vWorld; void main(){ vec4 world=modelMatrix*vec4(position,1.0); vWorld=world.xyz; gl_Position=projectionMatrix*viewMatrix*world; }`;
const fragment = `
  uniform float uTime; uniform float uDetail; uniform float uBright; uniform float uSunset; uniform vec2 uResolution; varying vec3 vWorld;
  float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
  void main(){
    vec2 uv=gl_FragCoord.xy/uResolution;
    vec2 p=vWorld.xz;
    float wave=sin(p.y*1.1+uTime*.3)*.4;
    float fine=.5;
    if(uDetail>.5){wave=sin(p.x*2.4+p.y*.8+uTime*.65)*sin(p.y*3.1-uTime*.48);fine=hash(floor(p*5.0));}
    vec3 deep=vec3(.08,.42,.62), shallow=vec3(.16,.70,.80);
    vec3 color=mix(deep,shallow,smoothstep(-.6,.8,wave)*.26+smoothstep(.0,.7,uv.y)*.36);
    float glint=step(.84,wave)*step(.52,fine);
    color+=vec3(.18,.22,.18)*glint*.3;
    float sunset=pow(max(0.0,1.0-abs(uv.x-.78)*2.8),7.0)*smoothstep(.24,.84,uv.y);
    float bands=step(.66,sin(p.y*5.0+sin(p.x*2.0)+uTime*.5)*.5+.5);
    color=mix(color,vec3(1.,.62,.62),sunset*(.19+bands*.3)*uSunset);
    color*=uBright;
    color=mix(color,vec3(.70,.64,.70)*uBright,smoothstep(.65,.84,uv.y)*.70);
    float alpha=1.0-smoothstep(.80,.88,uv.y);
    gl_FragColor=vec4(pow(color,vec3(2.2)),alpha);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

export const Ocean = ({detail=true}) => {
  const { gl }=useThree();
  const uniforms=useMemo(()=>({uTime:{value:0},uDetail:{value:1},uResolution:{value:new THREE.Vector2()},uBright:{value:1},uSunset:{value:1}}),[]);
  useFrame(({clock})=>{uniforms.uTime.value=clock.elapsedTime;uniforms.uDetail.value=detail?1:0;uniforms.uBright.value=env.bright;uniforms.uSunset.value=env.sunset;gl.getDrawingBufferSize(uniforms.uResolution.value);});
  return <mesh position={[0,.05,0]} rotation={[-Math.PI/2,0,0]} renderOrder={-1}>
    <planeGeometry args={[300,300]}/><shaderMaterial vertexShader={vertex} fragmentShader={fragment} uniforms={uniforms} transparent depthWrite={false}/>
  </mesh>;
};

export const DistantCoast = () => {
  const blocks=useMemo(()=>{
    const out=[]; const box=(x,y,z,w,h,d,color)=>out.push({x,y,z,w,h,d,color});
    // Layered block-built alpine silhouettes, pale enough to read as distant scenery.
    [[-30,-23,8,9],[-12,-34,9,8],[9,-35,8,7],[25,-23,7,6]].forEach(([cx,cz,width,height],index)=>{
      for(let layer=0;layer<7;layer++){
        const w=width*(1-layer*.115), y=layer*height/7;
        box(cx+Math.sin(layer)*.25,y,cz,w,height/7+.08,w*.77,layer>3?'#c6c1d4':index%2?'#aaaec5':'#a4afc3');
        if(layer>2)box(cx+Math.sin(layer)*.25,y+height/14+.03,cz,w+.03,.18,w*.77+.04,'#ded7e0');
      }
      for(let i=0;i<5;i++){const x=cx-width*.6+i*width*.29,z=cz+width*.35+seeded(i+index)*1.7;for(let k=0;k<4;k++)box(x,.55+k*.42,z,1.2-k*.23,.43,1.2-k*.23,k%2?'#cbd0d5':'#a3b4bd');}
    });return out;
  },[]);
  return <VoxelBatch blocks={blocks}/>;
};

export const HarborDetails = () => {
  const refs=useRef([]);
  useFrame(({clock})=>refs.current.forEach((ref,i)=>{if(ref)ref.position.y=.18+Math.sin(clock.elapsedTime*.8+i)*.07;}));
  return <group>{[[17,9.5],[-4,14],[4,18],[14,19],[-10,16]].map(([x,z],i)=><group position={[x,.15,z]} key={i} ref={el=>refs.current[i]=el}>
    <mesh position={[0,.15,0]}><boxGeometry args={[.24,.4,.24]}/><meshStandardMaterial color="#c88483"/></mesh>
    <mesh position={[0,.4,0]}><boxGeometry args={[.16,.12,.16]}/><meshStandardMaterial color="#f0dfc4"/></mesh>
    <mesh rotation={[-Math.PI/2,0,0]}><ringGeometry args={[.4,.425,16]}/><meshBasicMaterial color="#bdcbd0" transparent opacity={.36} side={THREE.DoubleSide}/></mesh>
  </group>)}</group>;
};