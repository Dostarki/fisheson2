import { useEffect, useRef, useState } from 'react';
export function useAmbience() {
  const [sound, setSound] = useState(false);
  const audio = useRef(null);
  useEffect(() => () => { if (audio.current) audio.current.close(); }, []);
  const toggle = async () => {
    if (sound) { await audio.current?.suspend(); setSound(false); return; }
    if (!audio.current) {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      audio.current = ctx;
      const gain = ctx.createGain(); gain.gain.value = 0.022; gain.connect(ctx.destination);
      [130.81, 196, 261.63, 329.63].forEach((freq, i) => {
        const osc = ctx.createOscillator(); osc.type = 'sine'; osc.frequency.value = freq;
        const g = ctx.createGain(); g.gain.value = 0.25;
        const lfo = ctx.createOscillator(); lfo.frequency.value = 0.08 + i * .023;
        const lg = ctx.createGain(); lg.gain.value = .17;
        lfo.connect(lg); lg.connect(g.gain); osc.connect(g); g.connect(gain); osc.start(); lfo.start();
      });
    }
    await audio.current.resume(); setSound(true);
  };
  return { sound, toggle };
}