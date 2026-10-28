import { Component, memo, Suspense, useEffect, useRef } from 'react';
import { Canvas, useThree, useFrame } from '@react-three/fiber';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import * as THREE from 'three';
import { Island } from './Island';
import { Customers, MarketStock } from './Actors';
import { Workers } from './Workers';
import { DayCycle } from './DayCycle';
import { Ocean, HarborDetails } from './Environment';
import { IceMountains, Clouds } from './Scenery';
import { MARKET } from '../lib/gameData';
import { RenderLoop } from './RenderLoop';

const CameraRig = ({ zoom, reset, labelRefs, active }) => {
  const { camera, gl, size }=useThree();
  const controls=useRef(), mobile=size.width<700;
  useEffect(()=>{
    const c=new OrbitControls(camera,gl.domElement);
    c.enableRotate=false;c.enableZoom=true;c.enablePan=true;c.screenSpacePanning=false;
    c.touches={ONE:THREE.TOUCH.PAN,TWO:THREE.TOUCH.DOLLY_PAN};c.zoomSpeed=.7;
    c.mouseButtons={LEFT:THREE.MOUSE.PAN,MIDDLE:THREE.MOUSE.DOLLY,RIGHT:THREE.MOUSE.PAN};
    c.enableDamping=true;c.dampingFactor=.09;controls.current=c;
    return()=>c.dispose();
  },[camera,gl]);
  useEffect(()=>{
    const target=mobile ? [0,-4,2] : active ? [0,2.5,0] : [-3,2.3,2.5];
    camera.position.set(target[0]+35,target[1]+27,target[2]+43);camera.lookAt(...target);
    if(controls.current)controls.current.target.set(...target);
    camera.zoom=(mobile ? size.width/32 : Math.min(size.width/53,size.height/26))*zoom;
    if(controls.current){const base=mobile?size.width/32:Math.min(size.width/53,size.height/26);controls.current.minZoom=base*.32;controls.current.maxZoom=base*2;}
    camera.updateProjectionMatrix();
  },[camera,size,zoom,reset,mobile,active]);
  useEffect(()=>{
    const handle=event=>{
      if(document.querySelector('[role="dialog"]')||['INPUT','TEXTAREA'].includes(event.target.tagName))return;
      const directions={ArrowLeft:[-1,0,0],a:[-1,0,0],ArrowRight:[1,0,0],d:[1,0,0],ArrowUp:[0,0,-1],w:[0,0,-1],ArrowDown:[0,0,1],s:[0,0,1]};
      const move=directions[event.key];if(!move)return;event.preventDefault();
      const delta=new THREE.Vector3(...move).multiplyScalar(.7);camera.position.add(delta);controls.current?.target.add(delta);
    };window.addEventListener('keydown',handle);return()=>window.removeEventListener('keydown',handle);
  },[camera]);
  const v=useRef(new THREE.Vector3()),before=useRef(new THREE.Vector3()),lastCamera=useRef('');
  const mapLabels=useRef([['market',[MARKET[0],5.1,MARKET[2]]],['water',[-6.3,.3,5]],['harbor',[11,2.6,15]]]);
  useFrame(()=>{
    const c=controls.current;
    if(c){c.update();before.current.copy(c.target);c.target.x=THREE.MathUtils.clamp(c.target.x,-42,42);c.target.z=THREE.MathUtils.clamp(c.target.z,-42,22);camera.position.x+=c.target.x-before.current.x;camera.position.z+=c.target.z-before.current.z;}
    const stamp=`${camera.position.x.toFixed(3)}:${camera.position.z.toFixed(3)}:${camera.zoom.toFixed(3)}:${size.width}:${size.height}`;
    if(stamp===lastCamera.current)return;lastCamera.current=stamp;
    mapLabels.current.forEach(([key,position])=>{
      const label=labelRefs.current[key];if(!label)return;v.current.set(...position).project(camera);
      const x=(v.current.x*.5+.5)*size.width,y=(-v.current.y*.5+.5)*size.height;
      label.style.left=`${THREE.MathUtils.clamp(x,75,size.width-75)}px`;label.style.top=`${y}px`;
      label.style.visibility=x<30||x>size.width-30||y<110||y>size.height-85?'hidden':'visible';
    });
  });return null;
};

class WorldBoundary extends Component {
  state={failed:false};static getDerivedStateFromError(){return{failed:true};}
  render(){return this.state.failed?<div className="world-fallback" data-testid="webgl-error">The island needs WebGL. Please enable hardware acceleration and refresh.</div>:this.props.children;}
}

export const World = memo(({ gameRef, roster, active, zoom, reset, onMarket, onSpot, profile, blocked, earlyAccessStage, onMeasure, onReady }) => {
  const labels=useRef({});
  return <div className={`world ${active?'world-active':''}`} data-testid="island-world">
    <WorldBoundary><Canvas orthographic frameloop="never" shadows={profile.shadows} dpr={profile.dpr} gl={{antialias:false,alpha:true,powerPreference:'high-performance',preserveDrawingBuffer:false}} camera={{position:[35,27,43],zoom:30,near:.1,far:300}} data-testid="island-canvas">
      <Suspense fallback={null}>
        <DayCycle profile={profile}/>
        <Ocean detail={profile.tier!=='battery'}/><Island lite={profile.tier==='battery'}/><HarborDetails/>
        <IceMountains/><Clouds count={profile.tier==='battery'?5:10}/>
        <Workers roster={roster} gameRef={gameRef} preview={!active} earlyAccessStage={earlyAccessStage}/>
        <Customers gameRef={gameRef} preview={!active}/>
        <MarketStock gameRef={gameRef} preview={!active} earlyAccessStage={earlyAccessStage}/>
        <CameraRig zoom={zoom} reset={reset} labelRefs={labels} active={active}/>
        <RenderLoop profile={profile} blocked={blocked} animateWhileBlocked={!!earlyAccessStage && !active} onMeasure={onMeasure} onReady={onReady} viewKey={`${zoom}:${reset}:${active}`}/>
      </Suspense>
    </Canvas></WorldBoundary>
    <div className="world-labels">
      <button ref={el=>labels.current.market=el} className="map-label market-label" onClick={onMarket} data-testid="map-market-button"><span className="label-dot"/> FISH MARKET <span className="label-arrow">↗</span></button>
      <div ref={el=>labels.current.water=el} className="water-label" data-testid="river-label">F R O S T W A T E R</div>
      <button ref={el=>labels.current.harbor=el} className="map-label harbor-label" onClick={onSpot} data-testid="map-harbor-button"><span>⚑</span> DRIFTWOOD HARBOR</button>
    </div>
  </div>;
});
