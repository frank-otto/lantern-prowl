// Everything on the run, synced from the pure Track data each frame and pooled (no per-frame allocation, nothing leaks):
// roof blocks + cornices (instanced, world-space brick/slate), kids' plank bridges, chimneys with caps, stone gargoyles, ghost-sheet laundry
// lines, bat swarms, jack-o'-lanterns (instanced, ignite), wisps (points), power-ups (broom, wisp magnet, shadow flame), the Moonlight arch, the
// clock tower + finish gate.
import * as THREE from 'three';
import { wsMaterial, pumpkinMaterial, pumpkinGeometry } from './world.js';
import { sheetTex, runeTex } from './tex.js';
const HW = 2.75, BASE = -14;
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _s = new THREE.Vector3(), _p = new THREE.Vector3(), _e = new THREE.Euler(), _c = new THREE.Color();
const TINT = ['#8a6a62', '#76707e', '#6c7a72', '#86765c', '#7a6a7a', '#8e7e6a', '#9a8a7a', '#7a7a8a', '#6a6a7a', '#a09080'];
export function createProps(scene, W) {
  const P = { scene, W, geos: [], mats: [], tex: [], pools: {}, t: 0 };
  const G = g => (P.geos.push(g), g), M = m => (P.mats.push(m), m);
  const box = G(new THREE.BoxGeometry(1, 1, 1)); box.translate(0, .5, 0);
  // roof blocks
  P.blockMat = M(wsMaterial(W.T, { key: 'b', litMin: .25 })); P.blockGeo = G(box.clone()); P.blockLit = new Float32Array(24).fill(.35); P.blockGeo.setAttribute('aLit', new THREE.InstancedBufferAttribute(P.blockLit, 1));
  P.blocks = new THREE.InstancedMesh(P.blockGeo, P.blockMat, 24); P.blocks.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(72), 3); P.blocks.receiveShadow = true; P.blocks.castShadow = true; P.blocks.frustumCulled = false; scene.add(P.blocks);
  P.ledgeMat = M(new THREE.MeshStandardMaterial({ color: '#4a4048', roughness: .7 })); P.ledges = new THREE.InstancedMesh(box, P.ledgeMat, 72); P.ledges.receiveShadow = true; P.ledges.castShadow = true; P.ledges.frustumCulled = false; scene.add(P.ledges);
  P.plankMat = M(new THREE.MeshStandardMaterial({ color: '#6a4a2e', roughness: .85 })); P.planks = new THREE.InstancedMesh(box, P.plankMat, 12); P.planks.receiveShadow = true; P.planks.frustumCulled = false; scene.add(P.planks);
  // chimneys
  P.chimMat = M(wsMaterial(W.T, { key: 'tc', glow: 0 })); P.chims = new THREE.InstancedMesh(box, P.chimMat, 40); P.chims.castShadow = true; P.chims.receiveShadow = true; P.chims.frustumCulled = false; scene.add(P.chims);
  P.caps = new THREE.InstancedMesh(box, P.ledgeMat, 40); P.caps.castShadow = true; P.caps.frustumCulled = false; scene.add(P.caps);
  // lanterns on the run
  P.pumpGeo = G(pumpkinGeometry()); P.pumpLit = new Float32Array(60); P.pumpGeo.setAttribute('aLit', new THREE.InstancedBufferAttribute(P.pumpLit, 1));
  P.pumpMat = M(pumpkinMaterial(W.T, 'run')); P.pumps = new THREE.InstancedMesh(P.pumpGeo, P.pumpMat, 60); P.pumps.castShadow = true; P.pumps.frustumCulled = false; scene.add(P.pumps);
  P.stemMat = M(new THREE.MeshStandardMaterial({ color: '#3a4a1a', roughness: .8 })); P.stemGeo = G(new THREE.CylinderGeometry(.035, .05, .14, 6)); P.stems = new THREE.InstancedMesh(P.stemGeo, P.stemMat, 60); P.stems.frustumCulled = false; scene.add(P.stems);
  // glow points (lit lanterns + wisps)
  { const n = 200; P.gp = { n, pos: new Float32Array(n * 3), col: new Float32Array(n * 3), size: new Float32Array(n) }; const g = G(new THREE.BufferGeometry());
    g.setAttribute('position', new THREE.BufferAttribute(P.gp.pos, 3)); g.setAttribute('color', new THREE.BufferAttribute(P.gp.col, 3)); g.setAttribute('size', new THREE.BufferAttribute(P.gp.size, 1)); P.gpGeo = g;
    P.glow = new THREE.Points(g, M(new THREE.ShaderMaterial({ uniforms: { map: { value: W.soft }, scale: { value: 700 } }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, vertexColors: true,
      vertexShader: 'attribute float size; uniform float scale; varying vec3 vC; void main(){ vC = color; vec4 mv = modelViewMatrix * vec4(position, 1.); gl_PointSize = min(size * scale / -mv.z, 220.); gl_Position = projectionMatrix * mv; }',
      fragmentShader: 'uniform sampler2D map; varying vec3 vC; void main(){ float a = texture2D(map, gl_PointCoord).a; gl_FragColor = vec4(vC, a); }' }))); P.glow.frustumCulled = false; scene.add(P.glow); }
  // gargoyles (pool of groups)
  const stone = M(new THREE.MeshStandardMaterial({ color: '#6c7068', roughness: .92, metalness: 0 })), eyeR = M(new THREE.MeshStandardMaterial({ color: '#200', emissive: '#ff3a1a', emissiveIntensity: 2.4 }));
  const sph = G(new THREE.SphereGeometry(1, 14, 10)), cone = G(new THREE.ConeGeometry(1, 1, 6)), wing = G(new THREE.ConeGeometry(.5, 1, 3));
  const mk = (par, g, m, p, s, r) => { const o = new THREE.Mesh(g, m); o.position.set(...p); o.scale.set(...s); if (r) o.rotation.set(...r); o.castShadow = true; o.receiveShadow = true; par.add(o); return o; };
  P.pools.low = []; for (let i = 0; i < 14; i++) { const g = new THREE.Group(); mk(g, box, stone, [0, 0, 0], [.92, .2, .72]); mk(g, sph, stone, [0, .38, .05], [.26, .24, .3]); mk(g, sph, stone, [0, .58, -.2], [.17, .15, .16]);
    for (const s of [-1, 1]) { mk(g, cone, stone, [s * .09, .74, -.2], [.035, .12, .035], [0, 0, -s * .4]); mk(g, wing, stone, [s * .26, .5, .14], [.34, .5, .1], [.5, 0, s * 1.0]); mk(g, sph, eyeR, [s * .06, .6, -.34], [.025, .02, .02]); }
    g.visible = false; scene.add(g); P.pools.low.push({ g, id: 0 }); }
  // ghost-sheet laundry lines
  P.sheetTex = sheetTex(); P.tex.push(P.sheetTex);
  P.sheetU = { time: { value: 0 } };
  const sheetM = M(new THREE.MeshStandardMaterial({ map: P.sheetTex, roughness: .9, side: THREE.DoubleSide, emissive: '#3a3450', emissiveIntensity: .35 }));
  sheetM.onBeforeCompile = sh => { sh.uniforms.time = P.sheetU.time; sh.vertexShader = 'uniform float time;\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
    float hang = clamp(-position.y / 1.6 + .5, 0., 1.); vec4 wp0 = modelMatrix * vec4(position, 1.); transformed.z += sin(time * 3.1 + wp0.x * 1.7 + wp0.z * .3) * .16 * hang * hang + .1 * hang; transformed.x += sin(time * 2.3 + wp0.x) * .04 * hang;`); };
  sheetM.customProgramCacheKey = () => 'sheet';
  const pole = M(new THREE.MeshStandardMaterial({ color: '#3a2a1e', roughness: .8 })), rope = M(new THREE.MeshStandardMaterial({ color: '#b0a890', roughness: .9 }));
  const sheetG = G(new THREE.PlaneGeometry(1.3, 1.6, 6, 8)), poleG = G(new THREE.CylinderGeometry(.06, .07, 2.7, 6)), ropeG = G(new THREE.CylinderGeometry(.018, .018, 5.8, 4));
  P.pools.line = []; for (let i = 0; i < 6; i++) { const g = new THREE.Group(); for (const s of [-1, 1]) { const p = new THREE.Mesh(poleG, pole); p.position.set(s * 2.85, 1.35, 0); p.castShadow = true; g.add(p); }
    const r = new THREE.Mesh(ropeG, rope); r.rotation.z = Math.PI / 2; r.position.y = 2.4; g.add(r);
    for (let j = 0; j < 3; j++) { const s = new THREE.Mesh(sheetG, sheetM); s.position.set((j - 1) * 1.65, 1.6, 0); s.castShadow = true; g.add(s); }
    g.visible = false; scene.add(g); P.pools.line.push({ g, id: 0 }); }
  // bat swarms
  const batM = M(new THREE.MeshStandardMaterial({ color: '#1a1020', roughness: .6, side: THREE.DoubleSide })), batEye = M(new THREE.MeshBasicMaterial({ color: '#ff5030' }));
  const wingShape = new THREE.Shape(); wingShape.moveTo(0, 0); wingShape.lineTo(.3, .1); wingShape.lineTo(.42, -.02); wingShape.lineTo(.34, -.06); wingShape.lineTo(.26, -.02); wingShape.lineTo(.18, -.08); wingShape.lineTo(.1, -.03); wingShape.lineTo(0, -.06);
  const wingG = G(new THREE.ShapeGeometry(wingShape)); wingG.rotateX(-Math.PI / 2);
  P.pools.bats = []; for (let i = 0; i < 8; i++) { const g = new THREE.Group(); const bats = [];
    for (let j = 0; j < 5; j++) { const b = new THREE.Group(); const body = new THREE.Mesh(sph, batM); body.scale.set(.07, .07, .1); b.add(body);
      for (const s of [-1, 1]) { const wg = new THREE.Group(); const w = new THREE.Mesh(wingG, batM); w.scale.set(s, 1, 1); wg.add(w); wg.position.x = s * .04; b.add(wg); b['w' + s] = wg; const e = new THREE.Mesh(sph, batEye); e.scale.setScalar(.012); e.position.set(s * .025, .02, -.08); b.add(e); }
      g.add(b); bats.push({ b, ph: j * 1.3, ox: (j % 3 - 1) * .32, oy: .75 + (j % 2) * .55 + j * .08, oz: (j - 2) * .25 }); }
    g.visible = false; scene.add(g); P.pools.bats.push({ g, id: 0, bats }); }
  // power-ups
  const wood = M(new THREE.MeshStandardMaterial({ color: '#6a4424', roughness: .7 })), straw = M(new THREE.MeshStandardMaterial({ color: '#c8a050', roughness: .9 }));
  const glass = M(new THREE.MeshPhysicalMaterial({ color: '#a8e8ff', roughness: .05, transmission: .6, transparent: true, opacity: .5, thickness: .2 })), violet = M(new THREE.MeshStandardMaterial({ color: '#100818', emissive: '#7a2aff', emissiveIntensity: 1.6, roughness: .4 }));
  const stick = G(new THREE.CylinderGeometry(.03, .03, 1.1, 6)), brist = G(new THREE.ConeGeometry(.16, .4, 10)), jar = G(new THREE.CylinderGeometry(.16, .16, .36, 16)), orb = G(new THREE.IcosahedronGeometry(.18, 1));
  const ringTex = W.soft; P.pools.pow = [];
  for (const k of ['broom', 'magnet', 'shadow']) for (let i = 0; i < 2; i++) { const g = new THREE.Group(); const inner = new THREE.Group(); g.add(inner);
    if (k === 'broom') { const s = new THREE.Mesh(stick, wood); s.rotation.z = Math.PI / 2.6; inner.add(s); const b = new THREE.Mesh(brist, straw); b.position.set(.42, -.32, 0); b.rotation.z = Math.PI / 2.6 + Math.PI; inner.add(b); }
    if (k === 'magnet') { inner.add(new THREE.Mesh(jar, glass)); const c = new THREE.Sprite(M(new THREE.SpriteMaterial({ map: ringTex, color: new THREE.Color(.6, 2.2, 2), blending: THREE.AdditiveBlending, depthWrite: false }))); c.scale.setScalar(.5); inner.add(c); }
    if (k === 'shadow') { inner.add(new THREE.Mesh(orb, violet)); }
    const halo = new THREE.Sprite(M(new THREE.SpriteMaterial({ map: ringTex, color: k === 'broom' ? new THREE.Color(1.6, 1.1, .4) : k === 'magnet' ? new THREE.Color(.4, 1.5, 1.4) : new THREE.Color(1, .4, 2), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: .8 })));
    halo.scale.setScalar(1.3); g.add(halo); g.visible = false; scene.add(g); P.pools.pow.push({ g, inner, k, id: 0 }); }
  // the Moonlight arch
  P.rune = runeTex(); P.tex.push(P.rune);
  { const g = new THREE.Group(); const am = M(new THREE.MeshStandardMaterial({ color: '#203050', emissive: '#bfe0ff', emissiveIntensity: 2.4, emissiveMap: P.rune, roughness: .3 }));
    P.rune.repeat.set(6, 1); const t = new THREE.Mesh(G(new THREE.TorusGeometry(2.95, .14, 12, 64, Math.PI)), am); t.position.y = .05; g.add(t);
    const inner = new THREE.Mesh(G(new THREE.CircleGeometry(2.8, 48, 0, Math.PI)), M(new THREE.MeshBasicMaterial({ color: new THREE.Color(.25, .4, .9), transparent: true, opacity: .22, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }))); g.add(inner); P.archVeil = inner;
    const beam = new THREE.Mesh(G(new THREE.CylinderGeometry(2.2, 3, 60, 24, 1, true)), M(new THREE.MeshBasicMaterial({ color: new THREE.Color(.35, .5, 1), transparent: true, opacity: .07, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false })));
    beam.position.y = 30; g.add(beam); P.archBeam = beam;
    P.archLight = new THREE.PointLight('#a8c8ff', 0, 14, 1.5); scene.add(P.archLight); // outside the group: its visibility never changes
    g.visible = false; scene.add(g); P.arch = g; P.archMat = am; }
  // clock tower + finish gate
  { const g = new THREE.Group(); const tw = new THREE.Mesh(box, P.blockMat); tw.scale.set(7, 34, 7); tw.position.set(0, BASE, -26); tw.castShadow = true; g.add(tw);
    const sp = new THREE.Mesh(G(new THREE.ConeGeometry(5.4, 9, 4)), M(new THREE.MeshStandardMaterial({ color: '#3a3a50', roughness: .5, metalness: .2 }))); sp.rotation.y = Math.PI / 4; sp.position.set(0, BASE + 34 + 4.5, -26); g.add(sp);
    const cc = document.createElement('canvas'); cc.width = cc.height = 256; const k = cc.getContext('2d'); k.fillStyle = '#fff2c8'; k.beginPath(); k.arc(128, 128, 120, 0, 7); k.fill(); k.strokeStyle = '#2a1a10'; k.lineWidth = 8; k.stroke();
    k.fillStyle = '#2a1a10'; for (let i = 0; i < 12; i++) { const a = i / 12 * 6.283; k.fillRect(128 + Math.sin(a) * 100 - 4, 128 - Math.cos(a) * 100 - 10, 8, 20); } k.lineWidth = 10; k.beginPath(); k.moveTo(128, 128); k.lineTo(128, 40); k.moveTo(128, 128); k.lineTo(128, 60); k.stroke();
    const ct = new THREE.CanvasTexture(cc); ct.colorSpace = THREE.SRGBColorSpace; P.tex.push(ct);
    const face = new THREE.Mesh(G(new THREE.CircleGeometry(2.6, 40)), M(new THREE.MeshStandardMaterial({ map: ct, emissive: '#ffd890', emissiveMap: ct, emissiveIntensity: 1.6 }))); face.position.set(0, BASE + 28, -22.45); g.add(face);
    const post = G(new THREE.CylinderGeometry(.12, .14, 3.4, 8)); for (const s of [-1, 1]) { const p = new THREE.Mesh(post, wood); p.position.set(s * 2.9, 1.7, 0); p.castShadow = true; g.add(p); }
    const banner = new THREE.Mesh(G(new THREE.TorusGeometry(2.9, .05, 6, 40, Math.PI)), rope); banner.position.y = .9; banner.scale.y = .9; g.add(banner);
    g.visible = false; scene.add(g); P.goal = g; }
  P.ids = { low: new Map(), line: new Map(), bats: new Map(), pow: new Map() };
  return P;
}
function poolGet(P, kind, id) { const map = P.ids[kind]; let e = map.get(id); if (e) return e; const pool = P.pools[kind]; e = pool.find(x => !x.id && (kind !== 'pow' || x.k === P._wantK)); if (!e) return null; e.id = id; map.set(id, e); e.g.visible = true; return e; }
// sync the visuals with the track for the window [d - back, d + ahead]
export function syncProps(P, T, d, t, dt, opt = {}) {
  P.t = t; P.sheetU.time.value = t; const back = opt.back ?? 18, ahead = opt.ahead ?? 80, lo = d - back, hi = d + ahead;
  let nb = 0, nl = 0, np = 0; const ledges = P.ledges;
  for (const b of T.blds) { if (b.d1 < lo || b.d0 > hi) continue; if (nb >= 24) break;
    _q.identity(); _m.compose(_p.set(0, BASE, -(b.d0 + b.d1) / 2), _q, _s.set(HW * 2, b.y - BASE, b.d1 - b.d0)); P.blocks.setMatrixAt(nb, _m); _c.set(TINT[b.style % TINT.length]); P.blocks.setColorAt(nb, _c); P.blockLit[nb] = .3 + (opt.festive || 0) * .7; nb++;
    if (nl + 3 <= 72) { for (const s of [-1, 1]) { _m.compose(_p.set(s * (HW - .08), b.y - .05, -(b.d0 + b.d1) / 2), _q, _s.set(.22, .2, b.d1 - b.d0)); ledges.setMatrixAt(nl++, _m); }
      _m.compose(_p.set(0, b.y - .35, -b.d1 + .1), _q, _s.set(HW * 2 + .2, .3, .3)); ledges.setMatrixAt(nl++, _m); }
    if (b.bridge) { const pv = T.blds[T.blds.indexOf(b) - 1]; if (pv && np < 12) { const L = b.d0 - pv.d1; _m.compose(_p.set(0, Math.min(b.y, pv.y) - .12, -(pv.d1 + L / 2)), _q, _s.set(2.6, .12, L + .6)); P.planks.setMatrixAt(np++, _m); } } }
  P.blocks.count = nb; P.ledges.count = nl; P.planks.count = np; P.blocks.instanceMatrix.needsUpdate = true; P.blocks.instanceColor.needsUpdate = true; P.ledges.instanceMatrix.needsUpdate = true; P.planks.instanceMatrix.needsUpdate = true; P.blockGeo.attributes.aLit.needsUpdate = true;
  // obstacles
  let nc = 0; const seen = new Set();
  for (const o of T.obs) { if (o.d + o.len < lo || o.d > hi) continue; const z = -(o.d + o.len / 2);
    if (o.t === 'chim') { if (nc >= 40) continue; const wob = o.hit ? Math.min(1, (t - (o.hitT ?? t)) * 3) : 0; _q.setFromEuler(_e.set(-wob * .9, 0, wob * .3));
      _m.compose(_p.set(o.x, o.by - (o.hit ? wob * 1.2 : 0), z), _q, _s.set(1.1, 2.7, 1.1)); P.chims.setMatrixAt(nc, _m); _m.compose(_p.set(o.x, o.by + 2.7 - (o.hit ? wob * 1.2 : 0), z), _q, _s.set(1.3, .22, 1.3)); P.caps.setMatrixAt(nc, _m); nc++; o.top = _p.y + .3; continue; }
    const e = poolGet(P, o.t, o.id); if (!e) continue; seen.add(o.id);
    if (o.t === 'low') { e.g.position.set(o.x, o.by + .1, z); e.g.rotation.set(o.hit ? -.6 : 0, Math.PI, 0); if (o.hit) e.g.position.y -= Math.min(1, (t - (o.hitT ?? t)) * 2) * .6; }
    else if (o.t === 'line') { e.g.position.set(0, o.by, z); }
    else if (o.t === 'bats') { e.g.position.set(o.x, o.by, z); for (const B of e.bats) { const fl = Math.sin(t * 22 + B.ph) * .9; B.b.w1.rotation.z = fl; B.b['w-1'].rotation.z = -fl;
        B.b.position.set(B.ox + Math.sin(t * 2.1 + B.ph) * .18, B.oy + Math.sin(t * 3.3 + B.ph * 2) * .14 + (o.hit ? (t - (o.hitT ?? t)) * 4 : 0), B.oz + Math.cos(t * 1.7 + B.ph) * .2); B.b.rotation.y = Math.PI + Math.sin(t * 1.3 + B.ph) * .5; } } }
  P.chims.count = nc; P.caps.count = nc; P.chims.instanceMatrix.needsUpdate = true; P.caps.instanceMatrix.needsUpdate = true;
  for (const k of ['low', 'line', 'bats']) for (const [id, e] of P.ids[k]) if (!seen.has(id)) { e.id = 0; e.g.visible = false; P.ids[k].delete(id); }
  // pickups
  let nk = 0, ng = 0; const gp = P.gp; const pseen = new Set();
  for (const p of T.picks) { if (p.d < lo || p.d > hi) continue; const z = -p.d;
    if (p.t === 'lantern') { if (nk >= 60) continue; const lit = p.got ? Math.min(1, (t - (p.gotT ?? t)) / .18) : 0; const pop = p.got ? 1 + Math.max(0, .35 - (t - (p.gotT ?? t))) * 1.6 : 1 + Math.sin(t * 3 + p.id) * .03;
      _q.setFromEuler(_e.set(0, Math.PI + Math.sin(p.id) * .3, 0)); const sc = .86 * pop; _m.compose(_p.set(p.x, p.by + .3 * sc, z), _q, _s.set(sc, sc, sc)); P.pumps.setMatrixAt(nk, _m);
      _m.compose(_p.set(p.x, p.by + .62 * sc, z), _q, _s.set(1, 1, 1)); P.stems.setMatrixAt(nk, _m); P.pumpLit[nk] = lit * (.9 + .1 * Math.sin(t * 17 + p.id)); nk++;
      if (lit > 0 && ng < gp.n) { gp.pos.set([p.x, p.by + .4, z], ng * 3); gp.col.set([1.6 * lit, .62 * lit, .14 * lit], ng * 3); gp.size[ng++] = 1.25; } continue; }
    if (p.t === 'wisp') { if (p.got || ng >= gp.n) continue; gp.pos.set([p.x, p.by + p.y + Math.sin(t * 3 + p.id) * .08, z], ng * 3); gp.col.set([.5, 1.6, 1.35], ng * 3); gp.size[ng++] = .42; continue; }
    if (p.got) continue; P._wantK = p.t; const e = poolGet(P, 'pow', p.id); if (!e) continue; pseen.add(p.id); e.g.position.set(p.x, p.by + p.y + Math.sin(t * 2.4) * .12, z); e.inner.rotation.y = t * 2.2; e.inner.rotation.z = Math.sin(t * 1.7) * .3; }
  for (const [id, e] of P.ids.pow) if (!pseen.has(id)) { e.id = 0; e.g.visible = false; P.ids.pow.delete(id); }
  P.pumps.count = nk; P.stems.count = nk; P.pumps.instanceMatrix.needsUpdate = true; P.stems.instanceMatrix.needsUpdate = true; P.pumpGeo.attributes.aLit.needsUpdate = true;
  for (let i = ng; i < gp.n; i++) gp.size[i] = 0; P.gpGeo.attributes.position.needsUpdate = true; P.gpGeo.attributes.color.needsUpdate = true; P.gpGeo.attributes.size.needsUpdate = true; P.ng = ng;
  // the arch + the goal
  const lb = T.blds.find(b => b.kind === 'launch' && b.arch && b.d1 > lo - 20 && b.d1 < hi + 40);
  P.arch.visible = !!lb; if (lb) { P.arch.position.set(0, lb.y, -(lb.d1 - .9)); P.archMat.emissiveIntensity = 2.2 + Math.sin(t * 4) * .5 + (lb.used ? 2 : 0); P.archBeam.material.opacity = .06 + Math.sin(t * 2) * .02; P.archVeil.material.opacity = .22 * Math.min(1, Math.max(0, (lb.d1 - d - 3) / 9)); P.rune.offset.x = t * .05; P.archLight.position.set(0, lb.y + 2, -(lb.d1 - .9)); } P.archLight.intensity = lb ? 6 : 0;
  const gb = T.blds.find(b => b.kind === 'goal'); P.goal.visible = !!gb && gb.d0 < hi + 60; if (gb) P.goal.position.set(0, gb.y, -T.finishD);
}
// lit-lantern light pool: the nearest lit lanterns around the cat get real point lights (count by quality)
export function lanternLights(P, T, d, lights, n) { let k = 0;
  const cand = []; for (const p of T.picks) { if (p.t !== 'lantern' || !p.got) continue; const dd = p.d - d; if (dd < -9 || dd > 10) continue; cand.push([Math.abs(dd + 2), p]); }
  cand.sort((a, b) => a[0] - b[0]);
  for (const L of lights) { const c = k < n ? cand[k] : null; if (c) { const p = c[1]; L.position.set(p.x, p.by + .8, -p.d); L.intensity = 5.5 * Math.min(1, (P.t - (p.gotT ?? 0)) / .2); } else L.intensity = 0; k++; } } // never toggle .visible per frame (that recompiles every shader)
export function disposeProps(P) { for (const g of P.geos) g.dispose(); for (const m of P.mats) m.dispose(); for (const t of P.tex) t.dispose(); }
