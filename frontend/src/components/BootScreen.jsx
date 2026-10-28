import { useEffect, useState } from 'react';
import '../boot.css';

const ART = [
  '.......HH.......',
  '.....HH..HH.....',
  '....H......H....',
  '...H........H...',
  '...H..F.....H...',
  '...H.FFF..F.H...',
  '..RRRRRRRRRRRR..',
  '..RWWWwWWWwWWR..',
  '...BLBBBBBBBB...',
  '...BLBBBBBBBB...',
  '...BLBBBBBBBB...',
  '...BBBBBBBBBB...',
  '....BLBBBBBB....',
  '....BBBBBBBB....',
  '....DDDDDDDD....',
  '.....SSSSSS.....',
];
const INK = { H: '#e9d6c3', R: '#d8e2f2', W: '#4fd7c7', w: '#9df2e6', B: '#8ea6cb', L: '#cfdcf2', D: '#5d6f9c', F: '#ff9f6e', S: '#2a3566' };

export const BucketArt = () => <svg className="boot-bucket" viewBox="0 0 16 16" shapeRendering="crispEdges" aria-hidden="true" data-testid="boot-bucket">
  {ART.flatMap((row, y) => [...row].map((c, x) => c === '.' ? null : <rect key={`${x}-${y}`} x={x} y={y} width="1" height="1" fill={INK[c]} className={c === 'w' ? 'boot-sparkle' : c === 'F' ? 'boot-fish' : undefined} />))}
</svg>;

export const BootScreen = ({ targetRef, fading }) => {
  const [progress, setProgress] = useState(0);
  useEffect(() => {
    let raf, shown = 0;
    const tick = () => { shown += (targetRef.current - shown) * .085; if (targetRef.current >= 100 && shown > 99.3) shown = 100; setProgress(Math.round(shown)); if (shown < 100) raf = requestAnimationFrame(tick); };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [targetRef]);
  return <div className={`boot-screen ${fading ? 'boot-fading' : ''}`} data-testid="boot-screen" role="status" aria-live="polite">
    <div className="boot-stage"><BucketArt /><div className="boot-shadow" /></div>
    <p className="boot-text" data-testid="boot-text">Loading your island…</p>
    <div className="boot-bar" data-testid="boot-progress" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100}><i style={{ width: `${progress}%` }} /></div>
  </div>;
};
