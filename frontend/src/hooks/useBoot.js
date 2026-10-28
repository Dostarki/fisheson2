import { useCallback, useEffect, useRef, useState } from 'react';

/** Boot progress: world chunk (30) + saved session (32) + first rendered frame (30). */
export function useBoot(resume) {
  const [done, setDone] = useState(false);
  const [fading, setFading] = useState(false);
  const targetRef = useRef(8), steps = useRef({ chunk: 0, session: 0, frame: 0 }), began = useRef(performance.now()), started = useRef(false);
  const mark = useCallback(key => {
    steps.current[key] = 1; const s = steps.current;
    targetRef.current = 8 + s.chunk * 30 + s.session * 32 + s.frame * 30;
    if (targetRef.current >= 100) {
      const wait = Math.max(0, 1500 - (performance.now() - began.current));
      setTimeout(() => { setFading(true); setTimeout(() => setDone(true), 600); }, wait + 350);
    }
  }, []);
  const frameReady = useCallback(() => mark('frame'), [mark]);
  useEffect(() => {
    if (started.current) return; started.current = true;
    import('../game/World').then(() => mark('chunk'), () => mark('chunk'));
    (localStorage.getItem('frostfish-session') ? resume() : Promise.resolve()).finally(() => mark('session'));
    const fallback = setTimeout(() => mark('frame'), 9000);
    return () => clearTimeout(fallback);
  }, [mark, resume]);
  return { done, fading, frameReady, targetRef };
}
