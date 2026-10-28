import * as THREE from 'three';

function texture(draw, w = 128, h = 64) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.minFilter = THREE.LinearFilter;
  return t;
}
function pixelFish(ctx) {
  const px = (x, y, w, h, color) => { ctx.fillStyle = color; ctx.fillRect(x, y, w, h); };
  px(40, 22, 40, 22, '#1d6fd1'); px(44, 18, 32, 30, '#2e8bff'); px(80, 26, 8, 14, '#2e8bff'); px(88, 20, 10, 26, '#1d6fd1');
  px(50, 24, 24, 6, '#8fd0ff'); px(48, 27, 6, 6, '#fff'); px(50, 29, 3, 3, '#111'); px(62, 14, 10, 6, '#ffb347');
}
export const fishMaterial = new THREE.SpriteMaterial({ transparent: true, depthTest: false, map: texture((ctx, w, h) => {
  ctx.font = '50px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText('🐟', w / 2, h / 2 + 3);
  const data = ctx.getImageData(0, 0, w, h).data; let colored = false;
  for (let i = 0; i < data.length; i += 16) if (data[i + 3] > 0 && Math.abs(data[i] - data[i + 2]) > 30) { colored = true; break; }
  if (!colored) { ctx.clearRect(0, 0, w, h); pixelFish(ctx); }
}) });
export const zzzMaterial = new THREE.SpriteMaterial({ transparent: true, depthTest: false, map: texture((ctx) => {
  ctx.lineJoin = 'round'; ctx.textBaseline = 'middle';
  [['Z', 6, 44, 30], ['z', 34, 36, 22], ['z', 56, 28, 18], ['Z', 80, 20, 28]].forEach(([s, x, y, size]) => {
    ctx.font = `900 ${size}px monospace`; ctx.lineWidth = 6; ctx.strokeStyle = '#1b2550'; ctx.strokeText(s, x, y); ctx.fillStyle = '#ffffff'; ctx.fillText(s, x, y);
  });
}) });
export const barBgMaterial = new THREE.SpriteMaterial({ color: '#1b2236', transparent: true, opacity: .85, depthTest: false });
