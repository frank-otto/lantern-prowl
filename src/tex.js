// Procedural canvas textures (no image files): slate roof, brick walls with windows (+ a glow map for lit windows), the moon,
// carved jack-o'-lantern faces, ghost-sheet laundry, a distant skyline silhouette, soft sprites and smoke.
import * as THREE from 'three';
function cv(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return [c, c.getContext('2d')]; }
let seed = 7; const R = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
function tex(c, { srgb = true, rep = true, mip = true } = {}) { const t = new THREE.CanvasTexture(c); if (srgb) t.colorSpace = THREE.SRGBColorSpace; if (rep) t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4; if (!mip) { t.generateMipmaps = false; t.minFilter = THREE.LinearFilter; } return t; }
export function slateTex() { // overlapping slate tiles, 2 m × 2 m per repeat
  const [c, k] = cv(512, 512); k.fillStyle = '#2a2b36'; k.fillRect(0, 0, 512, 512);
  const rows = 8, cols = 6, th = 512 / rows, tw = 512 / cols;
  for (let r = 0; r < rows; r++) for (let q = -1; q <= cols; q++) { const x = q * tw + (r % 2) * tw / 2, y = r * th; const l = 30 + R() * 22, hue = 225 + R() * 30;
    const g = k.createLinearGradient(0, y, 0, y + th); g.addColorStop(0, `hsl(${hue},12%,${l + 6}%)`); g.addColorStop(1, `hsl(${hue},14%,${l - 8}%)`); k.fillStyle = g;
    k.beginPath(); k.moveTo(x + 2, y + 1); k.lineTo(x + tw - 2, y + 1); k.lineTo(x + tw - 3, y + th - 8); k.quadraticCurveTo(x + tw / 2, y + th + 2, x + 3, y + th - 8); k.closePath(); k.fill();
    k.strokeStyle = 'rgba(0,0,0,.55)'; k.lineWidth = 2; k.stroke(); if (R() < .25) { k.fillStyle = 'rgba(90,120,70,.25)'; k.beginPath(); k.arc(x + R() * tw, y + R() * th, 4 + R() * 8, 0, 7); k.fill(); } }
  for (let i = 0; i < 1400; i++) { k.fillStyle = `rgba(${R() < .5 ? '255,255,255' : '0,0,0'},${R() * .06})`; k.fillRect(R() * 512, R() * 512, 2, 2); }
  return tex(c); }
// brick wall: one repeat = 4 m wide × 3.2 m tall (one storey, one window). Returns { map, glow }.
export function brickTex(tint = 0) {
  const [c, k] = cv(512, 410), [g, q] = cv(256, 205); k.fillStyle = '#3a2422'; k.fillRect(0, 0, 512, 410); q.fillStyle = '#000'; q.fillRect(0, 0, 256, 205);
  const bh = 410 / 24, bw = 512 / 12;
  for (let r = 0; r < 24; r++) for (let i = -1; i < 13; i++) { const x = i * bw + (r % 2) * bw / 2, y = r * bh; const l = 22 + R() * 12, h = 8 + R() * 14 + tint;
    k.fillStyle = `hsl(${h},${32 + R() * 14}%,${l}%)`; k.fillRect(x + 1.5, y + 1.5, bw - 3, bh - 3); }
  // window: arched frame, mullions; dark glass (the glow map lights it)
  const wx = 196, wy = 92, ww = 120, wh = 176;
  k.fillStyle = '#1b1416'; k.fillRect(wx - 12, wy - 6, ww + 24, wh + 22); k.fillStyle = '#6a5a4a'; k.fillRect(wx - 16, wy + wh + 8, ww + 32, 14);
  k.fillStyle = '#0c0d18'; k.beginPath(); k.moveTo(wx, wy + wh); k.lineTo(wx, wy + 40); k.arc(wx + ww / 2, wy + 40, ww / 2, Math.PI, 0); k.lineTo(wx + ww, wy + wh); k.closePath(); k.fill();
  k.strokeStyle = '#2a1e1a'; k.lineWidth = 8; k.beginPath(); k.moveTo(wx + ww / 2, wy - 18); k.lineTo(wx + ww / 2, wy + wh); k.moveTo(wx, wy + 100); k.lineTo(wx + ww, wy + 100); k.stroke();
  q.fillStyle = '#000'; const s = .5; const gr = q.createRadialGradient((wx + ww / 2) * s, (wy + wh * .6) * s, 4, (wx + ww / 2) * s, (wy + wh * .6) * s, 70);
  gr.addColorStop(0, '#ffd88a'); gr.addColorStop(.6, '#ff9a3a'); gr.addColorStop(1, '#a8501a'); q.fillStyle = gr;
  q.beginPath(); q.moveTo(wx * s, (wy + wh) * s); q.lineTo(wx * s, (wy + 40) * s); q.arc((wx + ww / 2) * s, (wy + 40) * s, ww / 2 * s, Math.PI, 0); q.lineTo((wx + ww) * s, (wy + wh) * s); q.closePath(); q.fill();
  q.strokeStyle = '#000'; q.lineWidth = 4; q.beginPath(); q.moveTo((wx + ww / 2) * s, wy * s - 9); q.lineTo((wx + ww / 2) * s, (wy + wh) * s); q.moveTo(wx * s, (wy + 100) * s); q.lineTo((wx + ww) * s, (wy + 100) * s); q.stroke();
  // a silhouette cat or pumpkin in some windows is part of the glow map
  q.fillStyle = 'rgba(40,14,0,.9)'; q.beginPath(); q.arc((wx + 34) * s, (wy + wh - 18) * s, 9, 0, 7); q.fill();
  for (let i = 0; i < 2600; i++) { k.fillStyle = `rgba(0,0,0,${R() * .12})`; k.fillRect(R() * 512, R() * 410, 2, 2); }
  return { map: tex(c), glow: tex(g) }; }
export function moonTex() {
  const [c, k] = cv(512, 512); const g = k.createRadialGradient(240, 230, 10, 256, 256, 250); g.addColorStop(0, '#fffdf2'); g.addColorStop(.7, '#f3ead2'); g.addColorStop(.95, '#d9cba8'); g.addColorStop(1, 'rgba(217,203,168,0)');
  k.fillStyle = g; k.beginPath(); k.arc(256, 256, 250, 0, 7); k.fill();
  const maria = [[180, 190, 70], [300, 160, 52], [320, 300, 80], [200, 330, 46], [260, 240, 34], [140, 280, 30]];
  for (const [x, y, r] of maria) { const m = k.createRadialGradient(x, y, 2, x, y, r); m.addColorStop(0, 'rgba(150,140,120,.55)'); m.addColorStop(1, 'rgba(150,140,120,0)'); k.fillStyle = m; k.beginPath(); k.arc(x, y, r, 0, 7); k.fill(); }
  for (let i = 0; i < 90; i++) { const a = R() * 7, rr = Math.sqrt(R()) * 230, x = 256 + Math.cos(a) * rr, y = 256 + Math.sin(a) * rr, r = 2 + R() * 9;
    // soft craters (no hard outlines – they read as bubbles): a shaded bowl + a faint lit rim on the upper left
    const cg = k.createRadialGradient(x + r * .2, y + r * .2, 0, x, y, r * 1.15); cg.addColorStop(0, 'rgba(128,116,98,.26)'); cg.addColorStop(.75, 'rgba(128,116,98,.12)'); cg.addColorStop(1, 'rgba(128,116,98,0)'); k.fillStyle = cg; k.beginPath(); k.arc(x, y, r * 1.15, 0, 7); k.fill();
    const hg = k.createRadialGradient(x - r * .55, y - r * .55, 0, x - r * .55, y - r * .55, r * .8); hg.addColorStop(0, 'rgba(255,252,238,.16)'); hg.addColorStop(1, 'rgba(255,252,238,0)'); k.fillStyle = hg; k.beginPath(); k.arc(x - r * .55, y - r * .55, r * .8, 0, 7); k.fill(); }
  { const lg = k.createRadialGradient(256, 256, 170, 256, 256, 250); lg.addColorStop(0, 'rgba(120,100,80,0)'); lg.addColorStop(1, 'rgba(120,100,80,.18)'); k.fillStyle = lg; k.beginPath(); k.arc(256, 256, 250, 0, 7); k.fill(); } // gentle limb darkening
  return tex(c, { rep: false }); }
export function faceTex() { // carved jack-o'-lantern face (emissive map), centred on u = .75 of a sphere's UVs (its front)
  const [c, k] = cv(512, 256); k.fillStyle = '#000'; k.fillRect(0, 0, 512, 256); const cx = 384, cy = 128;
  const fire = k.createLinearGradient(0, 60, 0, 200); fire.addColorStop(0, '#ffe7a0'); fire.addColorStop(.5, '#ffa030'); fire.addColorStop(1, '#ff6010'); k.fillStyle = fire;
  for (const s of [-1, 1]) { k.beginPath(); k.moveTo(cx + s * 22, cy - 14); k.lineTo(cx + s * 52, cy - 14); k.lineTo(cx + s * 36, cy - 46); k.closePath(); k.fill(); }
  k.beginPath(); k.moveTo(cx - 6, cy + 4); k.lineTo(cx + 6, cy + 4); k.lineTo(cx, cy - 8); k.fill();
  k.beginPath(); k.moveTo(cx - 62, cy + 18); k.quadraticCurveTo(cx, cy + 74, cx + 62, cy + 18); k.lineTo(cx + 40, cy + 30); k.lineTo(cx + 30, cy + 20); k.lineTo(cx + 14, cy + 34); k.lineTo(cx, cy + 24); k.lineTo(cx - 14, cy + 34); k.lineTo(cx - 30, cy + 20); k.lineTo(cx - 40, cy + 30); k.closePath(); k.fill();
  return tex(c, { rep: false }); }
export function pumpkinTex() { // skin colour with ribs (u wraps around)
  const [c, k] = cv(512, 256); for (let x = 0; x < 512; x++) { const rib = .5 + .5 * Math.cos(x / 512 * Math.PI * 2 * 10); k.fillStyle = `hsl(${22 + rib * 6},${78 + rib * 10}%,${30 + rib * 16}%)`; k.fillRect(x, 0, 1, 256); }
  const v = k.createLinearGradient(0, 0, 0, 256); v.addColorStop(0, 'rgba(40,20,0,.55)'); v.addColorStop(.25, 'rgba(0,0,0,0)'); v.addColorStop(.8, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(30,10,0,.6)'); k.fillStyle = v; k.fillRect(0, 0, 512, 256);
  return tex(c, { rep: false }); }
export function sheetTex() { // ghost-sheet laundry: off-white linen with two dark eye holes and a little mouth
  const [c, k] = cv(256, 256); k.fillStyle = '#e8e4f0'; k.fillRect(0, 0, 256, 256); for (let i = 0; i < 1200; i++) { k.fillStyle = `rgba(80,70,110,${R() * .08})`; k.fillRect(R() * 256, R() * 256, 1 + R() * 3, 1); }
  k.fillStyle = '#1a1424'; k.beginPath(); k.ellipse(92, 104, 17, 25, 0, 0, 7); k.ellipse(164, 104, 17, 25, 0, 0, 7); k.fill(); k.beginPath(); k.ellipse(128, 162, 14, 18, 0, 0, 7); k.fill();
  const e = k.createLinearGradient(0, 200, 0, 256); e.addColorStop(0, 'rgba(120,100,150,0)'); e.addColorStop(1, 'rgba(120,100,150,.35)'); k.fillStyle = e; k.fillRect(0, 200, 256, 56);
  return tex(c, { rep: false }); }
export function skylineTex() { // a distant town silhouette strip (alpha) with window lights: R = lit now, G = every window slot (lights up when the town ignites)
  const [c, k] = cv(2048, 256); k.fillStyle = '#000'; k.fillRect(0, 0, 2048, 256); const [cw, kw] = cv(2048, 256); kw.fillStyle = '#000'; kw.fillRect(0, 0, 2048, 256); let x = 0;
  const [ca, ka] = cv(2048, 256); ka.clearRect(0, 0, 2048, 256); ka.fillStyle = '#fff';
  while (x < 2048) { const w = 30 + R() * 70, h = 50 + R() * 90, kind = R(); ka.fillRect(x, 256 - h, w, h);
    if (kind < .55) { ka.beginPath(); ka.moveTo(x - 4, 256 - h); ka.lineTo(x + w / 2, 256 - h - 20 - R() * 30); ka.lineTo(x + w + 4, 256 - h); ka.fill(); }
    else if (kind < .66) { ka.beginPath(); ka.moveTo(x + w * .3, 256 - h); ka.lineTo(x + w / 2, 256 - h - 90 - R() * 50); ka.lineTo(x + w * .7, 256 - h); ka.fill(); }
    if (R() < .5) ka.fillRect(x + w * .7, 256 - h - 16, 7, 16);
    for (let wy = 256 - h + 12; wy < 246; wy += 16) for (let wx = x + 6; wx < x + w - 8; wx += 13) { const on = R() < .2, ig = R() < .8; if (on) { k.fillStyle = '#fff'; k.fillRect(wx, wy, 5, 7); } if (on || ig) { kw.fillStyle = '#fff'; kw.fillRect(wx, wy, 5, 7); } }
    x += w + R() * 6; }
  // pack: R = lit now, G = all windows, A = silhouette
  const a = ka.getImageData(0, 0, 2048, 256), r = k.getImageData(0, 0, 2048, 256), g = kw.getImageData(0, 0, 2048, 256);
  for (let i = 0; i < a.data.length; i += 4) { a.data[i] = r.data[i]; a.data[i + 1] = g.data[i]; a.data[i + 2] = 0; }
  ka.putImageData(a, 0, 0); return tex(ca, { rep: true, srgb: false }); }
export function softTex() { const [c, k] = cv(64, 64); const g = k.createRadialGradient(32, 32, 0, 32, 32, 32); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(.25, 'rgba(255,255,255,.65)'); g.addColorStop(1, 'rgba(255,255,255,0)'); k.fillStyle = g; k.fillRect(0, 0, 64, 64); return tex(c, { srgb: false, rep: false }); }
export function smokeTex() { const [c, k] = cv(128, 128); for (let i = 0; i < 26; i++) { const x = 34 + R() * 60, y = 34 + R() * 60, r = 14 + R() * 26; const g = k.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, 'rgba(255,255,255,.22)'); g.addColorStop(1, 'rgba(255,255,255,0)'); k.fillStyle = g; k.fillRect(0, 0, 128, 128); } return tex(c, { rep: false }); }
export function runeTex() { // the Moonlight arch: a pale ring of moon runes (emissive)
  const [c, k] = cv(512, 64); k.fillStyle = '#000'; k.fillRect(0, 0, 512, 64); k.strokeStyle = '#cfe6ff'; k.lineWidth = 3;
  for (let i = 0; i < 24; i++) { const x = 10 + i * 21; k.beginPath(); const t = i % 4; if (t === 0) { k.arc(x + 6, 32, 7, .6, 5.6); } else if (t === 1) { k.moveTo(x, 18); k.lineTo(x + 12, 46); k.moveTo(x + 12, 18); k.lineTo(x, 46); } else if (t === 2) { k.moveTo(x + 6, 14); k.lineTo(x + 6, 50); k.moveTo(x, 26); k.lineTo(x + 12, 26); } else { k.arc(x + 6, 32, 8, 0, 7); k.moveTo(x + 6, 24); k.lineTo(x + 6, 40); } k.stroke(); }
  return tex(c); }
