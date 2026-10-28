import { useEffect, useRef } from 'react';
import { useEnvironment } from '../hooks/useEnvironment';

export const WeatherOverlay = ({ density = 1 }) => {
  const ref = useRef(), { weather } = useEnvironment(), mode = useRef(weather);
  mode.current = weather;
  useEffect(() => {
    const canvas = ref.current, ctx = canvas.getContext('2d');
    let raf, last = performance.now(), flash = 0, nextFlash = last + 6000, W = 0, H = 0;
    const resize = () => { const d = Math.min(window.devicePixelRatio || 1, 1.5); W = canvas.clientWidth; H = canvas.clientHeight; canvas.width = W * d; canvas.height = H * d; ctx.setTransform(d, 0, 0, d, 0, 0); };
    resize(); window.addEventListener('resize', resize);
    function spawn(p, init) {
      p.kind = mode.current; p.x = Math.random() * (W + 100); p.y = init ? Math.random() * H : -20 - Math.random() * 60; p.z = Math.random();
      if (p.kind === 'rain') { p.vy = 900 + p.z * 600; p.vx = -140; p.len = 12 + p.z * 18; p.floor = H * (.5 + p.z * .5); }
      else { p.vy = 28 + p.z * 70; p.vx = 12; p.r = .8 + p.z * 2.6; p.phase = Math.random() * 6.28; p.floor = H + 10; }
      return p;
    }
    const ps = Array.from({ length: Math.round(280 * density) }, () => spawn({}, true)), splashes = [];
    const frame = now => {
      raf = requestAnimationFrame(frame);
      const dt = Math.max(0, Math.min(.05, (now - last) / 1000)); last = now;
      if (document.hidden) return;
      ctx.clearRect(0, 0, W, H); ctx.lineCap = 'round';
      for (const p of ps) {
        p.y += p.vy * dt; p.x += p.vx * dt;
        if (p.kind === 'snow') {
          p.phase += dt * 1.6; p.x += Math.sin(p.phase) * 22 * dt;
          ctx.fillStyle = `rgba(255,255,255,${.5 + p.z * .45})`; ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, 6.283); ctx.fill();
        } else {
          ctx.strokeStyle = `rgba(200,222,255,${.25 + p.z * .45})`; ctx.lineWidth = .8 + p.z * 1.3;
          ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x - p.vx * .02, p.y - p.len); ctx.stroke();
        }
        if (p.y > p.floor || p.x < -40) { if (p.kind === 'rain' && splashes.length < 90) splashes.push({ x: p.x, y: p.y, t: 0 }); spawn(p); }
      }
      for (let i = splashes.length - 1; i >= 0; i--) {
        const s = splashes[i]; s.t = Math.max(0, s.t + dt);
        if (!Number.isFinite(s.t) || s.t > .35) { splashes.splice(i, 1); continue; }
        ctx.strokeStyle = `rgba(215,232,255,${(1 - s.t / .35) * .6})`; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.ellipse(s.x, s.y, Math.max(.1, 2 + s.t * 30), Math.max(.1, 1 + s.t * 9), 0, 0, 6.283); ctx.stroke();
      }
      if (mode.current === 'rain' && now > nextFlash) { flash = 1; nextFlash = now + 8000 + Math.random() * 14000; }
      if (flash > 0) { ctx.fillStyle = `rgba(235,240,255,${flash * .32})`; ctx.fillRect(0, 0, W, H); flash -= dt * 2.4; }
    };
    raf = requestAnimationFrame(frame);
    return () => { cancelAnimationFrame(raf); window.removeEventListener('resize', resize); };
  }, [density]);
  return <canvas ref={ref} className={`weather-layer weather-${weather}`} data-testid="weather-overlay" data-weather={weather} aria-hidden="true" />;
};
