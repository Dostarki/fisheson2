import { useEffect, useRef } from 'react';
import { useThree } from '@react-three/fiber';

/** Explicit frame budget: dialogs pause rendering except during the Early Access scene beats. */
export const RenderLoop=({profile,blocked,animateWhileBlocked=false,onMeasure,onReady,viewKey})=>{
  const {advance,gl,setDpr,setEvents}=useThree();
  const report=useRef(onMeasure);report.current=onMeasure;
  const ready=useRef(onReady);ready.current=onReady;
  const announced=useRef(false);
  const software=useRef(false);
  useEffect(()=>{
    const context=gl.getContext(),ext=context.getExtension('WEBGL_debug_renderer_info');
    const renderer=ext?context.getParameter(ext.UNMASKED_RENDERER_WEBGL):'';
    software.current=/swiftshader|llvmpipe|software|mesa offscreen/i.test(renderer);
  },[gl]);
  useEffect(()=>{
    setDpr(profile.dpr);gl.shadowMap.enabled=profile.shadows;gl.shadowMap.autoUpdate=false;gl.shadowMap.needsUpdate=true;
  },[gl,setDpr,profile.dpr,profile.shadows,profile.shadowSize]);
  useEffect(()=>{setEvents({enabled:!blocked});},[setEvents,blocked]);
  useEffect(()=>{
    let id,stopped=false,last=0,start=performance.now(),frames=0,cost=0;
    const interval=1000/profile.fps;
    const frame=now=>{
      if(stopped)return;
      if(!document.hidden&&(now-last>=interval-.6||last===0)){
        const before=performance.now();advance(now/1000,true);cost+=performance.now()-before;frames++;last=now;
        if(!announced.current&&frames>=2){announced.current=true;ready.current?.();}
        if(now-start>=1800){
          const data={fps:Math.round(frames*1000/(now-start)),frameMs:Math.round(cost/frames*10)/10,drawCalls:gl.info.render.calls,triangles:gl.info.render.triangles,dpr:profile.dpr,tier:profile.tier,targetFps:profile.fps,software:software.current,blocked:false};
          // Diagnostic numbers only: no account, wallet, or session data.
          window.__FROSTFISH_PERF__=data;report.current(data);start=now;frames=0;cost=0;
        }
      }
      if(!blocked||animateWhileBlocked)id=requestAnimationFrame(frame);
      else window.__FROSTFISH_PERF__={...window.__FROSTFISH_PERF__,blocked:true};
    };
    id=requestAnimationFrame(frame);
    return()=>{stopped=true;cancelAnimationFrame(id);};
  },[advance,gl,profile,blocked,animateWhileBlocked,viewKey]);
  return null;
};
