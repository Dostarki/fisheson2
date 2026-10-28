import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
const MODES=['auto','high','balanced','battery'];
const mobileDevice=()=>window.matchMedia('(max-width: 767px), (pointer: coarse)').matches;
export function useGraphics(){
  const [mode,setModeState]=useState(()=>{const saved=localStorage.getItem('frostfish-graphics');return MODES.includes(saved)?saved:'auto';});
  const [mobile,setMobile]=useState(mobileDevice);
  const [autoTier,setAutoTier]=useState(()=>mobileDevice()||(navigator.deviceMemory&&navigator.deviceMemory<=4)?'balanced':'high');
  const [hidden,setHidden]=useState(document.hidden);
  const [software,setSoftware]=useState(false);
  const metrics=useRef(null),slowWindows=useRef(0);
  useEffect(()=>{
    const media=window.matchMedia('(max-width: 767px), (pointer: coarse)');
    const resize=()=>{setMobile(media.matches);setAutoTier(media.matches?'balanced':'high');};
    const visibility=()=>setHidden(document.hidden);
    media.addEventListener('change',resize);document.addEventListener('visibilitychange',visibility);
    return()=>{media.removeEventListener('change',resize);document.removeEventListener('visibilitychange',visibility);};
  },[]);
  const tier=mode==='auto'?autoTier:mode;
  const profile=useMemo(()=>({tier,mobile,dpr:tier==='high'?Math.min(window.devicePixelRatio,1.25):tier==='balanced'?1:software?(mobile?0.65:0.5):.75,
    fps:tier==='high'?60:tier==='balanced'?45:30,shadows:tier!=='battery',shadowSize:tier==='high'?1024:512,snow:tier!=='battery'}),[tier,mobile,software]);
  const setMode=useCallback(value=>{if(!MODES.includes(value))return;localStorage.setItem('frostfish-graphics',value);setModeState(value);slowWindows.current=0;if(value==='auto')setAutoTier(mobile?'balanced':'high');},[mobile]);
  const measure=useCallback(data=>{
    metrics.current=data;
    if(data.software)setSoftware(true);
    if(mode!=='auto')return;
    if(data.software&&autoTier!=='battery'){setAutoTier('battery');return;}
    if(data.fps<profile.fps*.65){slowWindows.current++;if(slowWindows.current>=2){setAutoTier(t=>t==='high'?'balanced':'battery');slowWindows.current=0;}}else slowWindows.current=0;
  },[mode,autoTier,profile.fps]);
  return {mode,setMode,profile,metrics,measure,hidden,mobile};
}