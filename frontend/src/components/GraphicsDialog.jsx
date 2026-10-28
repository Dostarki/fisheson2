import { useEffect, useState } from 'react';
import { Gauge, Sparkles, Leaf, Zap, Check, BookOpen } from 'lucide-react';
import { GameDialog } from './GameDialog';
const MODES=[['auto','Auto',Gauge,'Device-adaptive'],['high','High',Sparkles,'Up to 60 FPS'],['balanced','Balanced',Zap,'Up to 45 FPS'],['battery','Battery saver',Leaf,'Up to 30 FPS']];
export const GraphicsDialog=({open,onClose,graphics,onGuide})=>{
  const [stats,setStats]=useState(graphics.metrics.current);
  useEffect(()=>{const id=setInterval(()=>setStats(graphics.metrics.current),1000);return()=>clearInterval(id);},[graphics.metrics]);
  return <GameDialog open={open} onClose={onClose} id="graphics" title="Make yourself comfortable." subtitle="Graphics & island settings" className="graphics-dialog">
    <div className="graphics-options">{MODES.map(([id,name,Icon,detail])=><button key={id} className={`graphics-option ${graphics.mode===id?'selected':''}`} data-testid={`graphics-mode-${id}`} aria-pressed={graphics.mode===id} onClick={()=>graphics.setMode(id)}><Icon size={22}/><strong>{name}</strong><span>{detail}</span>{graphics.mode===id&&<Check className="graphics-check" size={15}/>}</button>)}</div>
    <div className="graphics-stats" data-testid="graphics-live-stats"><span>LAST ACTIVE FRAME RATE<strong data-testid="measured-fps">{stats?`${stats.fps} FPS`:'Measuring…'}</strong></span><span>ACTIVE QUALITY<strong data-testid="active-graphics-quality">{graphics.profile.tier==='battery'?'Battery saver':graphics.profile.tier}</strong></span></div>
    <p className="graphics-note" data-testid="graphics-device-note">Frame rate depends on your device. Rendering rests while a menu is open or the game is in the background.</p>
    <div className="settings-actions"><button data-testid="settings-guide-button" onClick={onGuide}><BookOpen size={17}/> Field guide</button></div>
  </GameDialog>;
};