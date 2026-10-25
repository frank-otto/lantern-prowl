// The night town: sky dome with a moon glow, the giant full moon (billboard at "infinity"), stars, drifting clouds, a distant skyline ring
// with window and lantern lights, two rows of instanced Victorian houses on each side of the run (brick + slate in world-space UVs, lit
// windows, gable roofs, chimneys, jack-o'-lanterns that ignite in a wave), moonlight with shadows, a warm fill, fog, grade shader.
import * as THREE from 'three';
import { brickTex, slateTex, moonTex, skylineTex, softTex, smokeTex, pumpkinTex, faceTex } from './tex.js';
export const QUALITY = {
  low: { dpr: 1, shadows: false, bloom: .8, lights: 2, msaa: 0, smoke: 6, stars: 700 },
  mid: { dpr: 1.25, shadows: true, shadowSize: 1024, bloom: 1, lights: 4, msaa: 4, smoke: 14, stars: 1400 },
  high: { dpr: 1.6, shadows: true, shadowSize: 2048, bloom: 1, lights: 6, msaa: 4, smoke: 20, stars: 2000 },
  ultra: { dpr: 2, shadows: true, shadowSize: 2048, bloom: 1, lights: 8, msaa: 4, smoke: 24, stars: 2400 } };
const fin = (v, d = 0) => Number.isFinite(v) ? v : d;
function hash(n) { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); }
// MeshStandardMaterial with world-space UVs: walls get brick (+ lit windows that switch on with aLit), up-facing faces get wet slate
export function wsMaterial(T, opt = {}) {
  const m = new THREE.MeshStandardMaterial({ color: opt.color || '#ffffff', roughness: .88, metalness: 0, emissive: '#ffffff' });
  m.userData.u = { wallMap: { value: T.brick.map }, glowMap: { value: T.brick.glow }, roofMap: { value: T.slate }, wsS: { value: new THREE.Vector3(.25, 1 / 3.2, .5) }, glowK: { value: opt.glow ?? 1 }, litMin: { value: opt.litMin ?? 0 } };
  m.onBeforeCompile = sh => { Object.assign(sh.uniforms, m.userData.u);
    sh.vertexShader = 'attribute float aLit;\nvarying float vLit; varying vec3 vWsP; varying vec3 vWsN;\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
      vec4 wsp = vec4(transformed, 1.); vec3 wsn = objectNormal;
      #ifdef USE_INSTANCING
        wsp = instanceMatrix * wsp; wsn = mat3(instanceMatrix) * wsn;
      #endif
      vWsP = (modelMatrix * wsp).xyz; vWsN = normalize(mat3(modelMatrix) * wsn); vLit = aLit;`);
    sh.fragmentShader = 'uniform sampler2D wallMap, glowMap, roofMap; uniform vec3 wsS; uniform float glowK, litMin; varying float vLit; varying vec3 vWsP; varying vec3 vWsN;\n' + sh.fragmentShader
      .replace('#include <map_fragment>', `float isRoof = step(.6, vWsN.y); vec2 wuv = abs(vWsN.x) > .5 ? vec2(vWsP.z, vWsP.y) : vec2(vWsP.x, vWsP.y); vec2 wallUv = wuv * wsS.xy; vec2 roofUv = vWsP.xz * wsS.z;
        vec3 texel = isRoof > .5 ? texture2D(roofMap, roofUv).rgb * 1.15 : texture2D(wallMap, wallUv).rgb; diffuseColor.rgb *= texel;`)
      .replace('#include <roughnessmap_fragment>', 'float roughnessFactor = mix(roughness, .34, isRoof);')
      .replace('#include <emissivemap_fragment>', `vec3 gw = texture2D(glowMap, wallUv).rgb * (1. - isRoof) * step(abs(vWsN.y), .5); vec2 cell = floor(wallUv + vec2(.0, .0));
        float hs = fract(sin(dot(cell, vec2(12.9898, 78.233))) * 43758.5453); float on = step(hs, .16 + .72 * max(vLit, litMin)) * (.85 + .3 * fract(hs * 91.7));
        totalEmissiveRadiance = gw * on * 1.6 * glowK;`); };
  m.customProgramCacheKey = () => 'ws' + (opt.key || ''); return m; }
// a lit-aware pumpkin material (instanced, aLit 0..1 = carved face glowing)
export function pumpkinMaterial(T, key = 'p') {
  const m = new THREE.MeshStandardMaterial({ map: T.pumpkin, roughness: .55, metalness: 0, emissive: '#ff8a2a', emissiveMap: T.face, emissiveIntensity: 3.2 });
  m.onBeforeCompile = sh => { sh.vertexShader = 'attribute float aLit; varying float vLit;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n vLit = aLit;');
    sh.fragmentShader = 'varying float vLit;\n' + sh.fragmentShader.replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
      totalEmissiveRadiance *= vLit; totalEmissiveRadiance += vec3(.9, .32, .05) * vLit * .16;`); };
  m.customProgramCacheKey = () => 'pk' + key; return m; }
export function pumpkinGeometry() { // ribbed, slightly squashed sphere; UV u = .75 faces −z (towards the camera when placed facing +z → rotated)
  const g = new THREE.SphereGeometry(.42, 28, 18); const p = g.attributes.position, v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) { v.fromBufferAttribute(p, i); const a = Math.atan2(v.z, v.x), rib = 1 + .07 * Math.cos(a * 10); v.x *= rib; v.z *= rib; v.y *= .78; if (v.y > .25) v.y -= (v.y - .25) * .6 * (1 - Math.hypot(v.x, v.z) / .42); p.setXYZ(i, v.x, v.y, v.z); }
  g.computeVertexNormals(); return g; }
function prism() { // gable roof: ridge along z, base 1×1, height 1 (scaled per instance)
  const s = .5, P = [-s, 0, -s, s, 0, -s, 0, 1, -s, -s, 0, s, s, 0, s, 0, 1, s];
  const idx = [0, 2, 1, 3, 4, 5, 0, 3, 5, 0, 5, 2, 1, 2, 5, 1, 5, 4];
  const pos = []; for (const i of idx) pos.push(P[i * 3], P[i * 3 + 1], P[i * 3 + 2]);
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(new Array(pos.length / 3 * 2).fill(0), 2)); g.computeVertexNormals(); return g; }
export function gradeShader() { return { uniforms: { tDiffuse: { value: null }, time: { value: 0 }, vig: { value: .36 }, grain: { value: .028 }, lift: { value: new THREE.Vector3(.012, .004, .03) }, sat: { value: 1.08 }, flash: { value: 0 }, warm: { value: 0 } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }',
  fragmentShader: `varying vec2 vUv; uniform sampler2D tDiffuse; uniform float time, vig, grain, sat, flash, warm; uniform vec3 lift;
    float hash(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
    void main(){ vec4 c = texture2D(tDiffuse, vUv); vec3 x = c.rgb; float l = dot(x, vec3(.299, .587, .114));
      x = mix(vec3(l), x, sat); x += lift * (1. - l); x = mix(x, x * vec3(1.05, .99, .93), smoothstep(.35, .9, l));
      x = mix(x, x * vec3(1.1, 1.0, .84) + vec3(.025, .012, 0.), warm);
      vec2 q = vUv - .5; float v = 1. - vig * smoothstep(.2, .85, dot(q, q) * 2.2); x *= v; x += flash * vec3(.2, .14, .06) * (1. - l);
      x += (hash(vUv * 900. + fract(time * 7.)) - .5) * grain * (1. - l * .6); gl_FragColor = vec4(x, c.a); }` }; }

export function createWorld(renderer) {
  const scene = new THREE.Scene(); const W = { scene, t: 0, flash: 0, warm: 0, festive: .1, wave: null };
  scene.fog = new THREE.FogExp2('#1b1532', .017); scene.background = new THREE.Color('#090a1c');
  const T = W.T = { brick: brickTex(), slate: slateTex(), moon: moonTex(), sky: skylineTex(), soft: softTex(), smoke: smokeTex(), pumpkin: pumpkinTex(), face: faceTex() };
  W.soft = T.soft; W.smokeTex = T.smoke;
  // sky dome (follows the camera)
  const skyU = { moonDir: { value: new THREE.Vector3(0, .3, -1).normalize() }, time: { value: 0 }, glow: { value: 1 } };
  W.sky = new THREE.Mesh(new THREE.SphereGeometry(520, 32, 16), new THREE.ShaderMaterial({ uniforms: skyU, side: THREE.BackSide, depthWrite: false, fog: false,
    vertexShader: 'varying vec3 vD; void main(){ vD = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }',
    fragmentShader: `varying vec3 vD; uniform vec3 moonDir; uniform float time, glow; void main(){ float h = vD.y; vec3 top = vec3(.025, .03, .085), mid = vec3(.09, .06, .17), hor = vec3(.23, .12, .22);
      vec3 c = mix(hor, mid, smoothstep(-.02, .22, h)); c = mix(c, top, smoothstep(.2, .8, h)); float m = clamp(dot(vD, moonDir), 1e-4, 1.);
      c += vec3(.55, .52, .62) * pow(m, 60.) * .9 * glow + vec3(.25, .22, .36) * pow(m, 8.) * .45 * glow; c = mix(c, vec3(.05, .03, .06), (1. - smoothstep(-.25, -.02, h))); gl_FragColor = vec4(c, 1.); }` }));
  W.sky.renderOrder = -10; W.sky.frustumCulled = false; scene.add(W.sky);
  // stars
  { const n = 2400, p = new Float32Array(n * 3), s = new Float32Array(n); for (let i = 0; i < n; i++) { const u = hash(i) * 2 - 1, a = hash(i + 9e3) * 6.283, y = Math.abs(u) * .95 + .03, r = Math.sqrt(1 - y * y); p.set([Math.cos(a) * r * 480, y * 480, Math.sin(a) * r * 480], i * 3); s[i] = .6 + hash(i + 7e3) * 1.8; }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(p, 3)); g.setAttribute('size', new THREE.BufferAttribute(s, 1));
    W.stars = new THREE.Points(g, new THREE.ShaderMaterial({ uniforms: { time: { value: 0 }, map: { value: T.soft }, k: { value: 1 } }, transparent: true, depthWrite: false, fog: false, blending: THREE.AdditiveBlending,
      vertexShader: 'attribute float size; uniform float time, k; varying float vA; void main(){ vec4 mv = modelViewMatrix * vec4(position, 1.); vA = .55 + .45 * sin(time * (1. + size) + position.x); gl_PointSize = size * 2.2 * k; gl_Position = projectionMatrix * mv; }',
      fragmentShader: 'uniform sampler2D map; varying float vA; void main(){ float a = texture2D(map, gl_PointCoord).a; gl_FragColor = vec4(vec3(.85, .88, 1.) * 1.4, a * vA); }' }));
    W.stars.frustumCulled = false; W.stars.renderOrder = -9; scene.add(W.stars); W.starGeo = g; }
  // the moon + halo (billboards placed at "infinity" along moonDir from the camera)
  W.moonDir = new THREE.Vector3(-.12, .3, -1).normalize(); W.moonScale = 1;
  W.moon = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: T.moon, color: new THREE.Color(2.1, 2.02, 1.85), transparent: true, depthWrite: false, fog: false }));
  W.halo = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: T.soft, color: new THREE.Color(.55, .55, .75), transparent: true, depthWrite: false, fog: false, blending: THREE.AdditiveBlending, opacity: .55 }));
  W.moon.renderOrder = -8; W.halo.renderOrder = -7; W.moon.frustumCulled = W.halo.frustumCulled = false; scene.add(W.moon, W.halo);
  // clouds near the moon
  W.clouds = []; for (let i = 0; i < 7; i++) { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: T.smoke, color: new THREE.Color('#4a3c66'), transparent: true, opacity: .55, depthWrite: false, fog: false })); s.renderOrder = -6; s.frustumCulled = false; scene.add(s); W.clouds.push({ s, a: (hash(i + 40) - .5) * 1.1, e: (hash(i + 50) - .3) * .25, k: 60 + hash(i + 60) * 70, v: .004 + hash(i + 70) * .006 }); }
  // lights
  W.hemi = new THREE.HemisphereLight('#7a80c8', '#1a0c10', .55); scene.add(W.hemi);
  W.key = new THREE.DirectionalLight('#c4d4ff', 1.9); W.key.castShadow = true; W.key.shadow.bias = -.0006; W.key.shadow.normalBias = .03;
  const sc = W.key.shadow.camera; sc.left = -16; sc.right = 16; sc.top = 16; sc.bottom = -16; sc.near = 1; sc.far = 80; scene.add(W.key, W.key.target);
  W.fill = new THREE.DirectionalLight('#8a7cc0', .55); scene.add(W.fill, W.fill.target);
  W.lights = []; for (let i = 0; i < 8; i++) { const L = new THREE.PointLight('#ff9a3c', 0, 9, 1.6); L.visible = false; scene.add(L); W.lights.push(L); }
  // ground far below (streets), follows the camera
  W.ground = new THREE.Mesh(new THREE.PlaneGeometry(600, 600), new THREE.MeshStandardMaterial({ color: '#141018', roughness: 1 })); W.ground.rotation.x = -Math.PI / 2; W.ground.position.y = -14; W.ground.receiveShadow = false; scene.add(W.ground);
  // distant skyline rings
  W.skyU = { uT: { value: 0 }, uT0: { value: 1e9 }, uO: { value: new THREE.Vector3() } };
  W.rings = []; for (const [r, h, c, rep] of [[150, 44, '#120e22', 5], [235, 70, '#0e0b1c', 7]]) { const t = T.sky.clone(); t.wrapT = THREE.ClampToEdgeWrapping; t.needsUpdate = true; t.repeat.set(rep, 1); W.ownTex = (W.ownTex || []).concat(t);
    const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, 64, 1, true), new THREE.ShaderMaterial({ uniforms: { map: { value: t }, uT: W.skyU.uT, uT0: W.skyU.uT0, uO: W.skyU.uO, col: { value: new THREE.Color(c) } }, side: THREE.BackSide, depthWrite: true, fog: false,
      vertexShader: 'uniform mat3 uvTransform; varying vec2 vUv; varying vec3 vW; void main(){ vUv = (uvTransform * vec3(uv, 1.)).xy; vec4 w = modelMatrix * vec4(position, 1.); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }',
      fragmentShader: 'uniform sampler2D map; uniform float uT, uT0; uniform vec3 uO, col; varying vec2 vUv; varying vec3 vW; void main(){ vec4 s = texture2D(map, vUv); if (s.a < .4 || vUv.y > .992) discard; float d = distance(vW.xz, uO.xz); float ig = clamp(((uT - uT0) * 150. - d) / 30., 0., 1.); float w = max(s.r * .8, s.g * ig * 1.25); vec3 win = mix(vec3(1., .62, .25), vec3(1., .82, .45), fract(sin(dot(floor(vUv * vec2(400., 30.)), vec2(12.9898, 78.233))) * 43758.5453)); gl_FragColor = vec4(mix(col, win * 1.6, w), 1.); }' }));
    m.material.uniforms.uvTransform = { value: (t.updateMatrix(), t.matrix) };
    m.position.y = -14 + h / 2 - 2; m.renderOrder = -5; m.frustumCulled = false; scene.add(m); W.rings.push(m); }
  // skyline lanterns: points that ignite in the wave
  { const n = 520, p = new Float32Array(n * 3), lit = new Float32Array(n); W.skyLit = { n, at: new Float32Array(n).fill(1e9), base: new Float32Array(n), lit };
    for (let i = 0; i < n; i++) { const a = hash(i + 300) * 6.283, r = 138 + hash(i + 400) * 80, y = -13 + hash(i + 500) * (r > 180 ? 30 : 18); p.set([Math.cos(a) * r, y, Math.sin(a) * r], i * 3); W.skyLit.base[i] = hash(i + 600); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(p, 3)); g.setAttribute('aLit', new THREE.BufferAttribute(lit, 1));
    W.skyPts = new THREE.Points(g, new THREE.ShaderMaterial({ uniforms: { map: { value: T.soft }, k: { value: 1 } }, transparent: true, depthWrite: false, fog: false, blending: THREE.AdditiveBlending,
      vertexShader: 'attribute float aLit; uniform float k; varying float vA; void main(){ vec4 mv = modelViewMatrix * vec4(position, 1.); vA = aLit; gl_PointSize = (2.5 + 9. * aLit) * k * 160. / -mv.z; gl_Position = projectionMatrix * mv; }',
      fragmentShader: 'uniform sampler2D map; varying float vA; void main(){ float a = texture2D(map, gl_PointCoord).a; gl_FragColor = vec4(vec3(1., .55, .16) * (1.2 + vA), a * (.12 + .88 * vA)); }' }));
    W.skyPts.frustumCulled = false; W.skyPts.renderOrder = -4; scene.add(W.skyPts); W.skyGeo = g; }
  // side houses: 4 rows (near/far, left/right)
  W.houseMat = wsMaterial(T, { key: 'h' }); W.roofMat = wsMaterial(T, { key: 'r' }); W.chimMat = wsMaterial(T, { key: 'c', glow: 0 });
  const box = new THREE.BoxGeometry(1, 1, 1); box.translate(0, .5, 0); W.box = box; W.prism = prism();
  const ROWS = [{ x0: 4.4, x1: 7.2, n: 18, side: -1, near: true }, { x0: 4.4, x1: 7.2, n: 18, side: 1, near: true }, { x0: 11, x1: 17, n: 13, side: -1 }, { x0: 11, x1: 17, n: 13, side: 1 }];
  const NH = ROWS.reduce((a, r) => a + r.n, 0); W.NH = NH;
  W.houses = new THREE.InstancedMesh(box, W.houseMat, NH); W.roofs = new THREE.InstancedMesh(W.prism, W.roofMat, NH); W.chims = new THREE.InstancedMesh(box, W.chimMat, NH);
  W.hLit = new Float32Array(NH);
  W.houses.geometry = box.clone(); W.houses.geometry.setAttribute('aLit', new THREE.InstancedBufferAttribute(W.hLit, 1)); W.houseGeo = W.houses.geometry;
  W.houses.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(NH * 3), 3); W.roofs.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(NH * 3), 3);
  for (const M of [W.houses, W.roofs, W.chims]) { M.castShadow = false; M.receiveShadow = true; M.frustumCulled = false; scene.add(M); }
  W.pumpGeo = pumpkinGeometry(); W.pumpMatSide = pumpkinMaterial(T, 'side');
  const NL = NH * 2; W.NL = NL; W.sideLit = { at: new Float32Array(NL).fill(1e9), base: new Float32Array(NL), lit: new Float32Array(NL) };
  W.sidePump = new THREE.InstancedMesh(W.pumpGeo.clone(), W.pumpMatSide, NL); W.sidePump.geometry.setAttribute('aLit', new THREE.InstancedBufferAttribute(W.sideLit.lit, 1)); W.sidePumpGeo = W.sidePump.geometry;
  W.sidePump.frustumCulled = false; W.sidePump.castShadow = false; scene.add(W.sidePump);
  W.hs = []; let k = 0; for (const R of ROWS) { let d = -30; for (let i = 0; i < R.n; i++) { const H = { i: k++, row: R, d, seed: k * 7 + 1 }; W.hs.push(H); d += placeHouse(W, H, d); } R.next = d; }
  W.houses.instanceMatrix.needsUpdate = true; W.roofs.instanceMatrix.needsUpdate = true; W.chims.instanceMatrix.needsUpdate = true;
  // env map for PBR reflections (sky + moon)
  { const pm = new THREE.PMREMGenerator(renderer); const es = new THREE.Scene(); const sk = W.sky.clone(); sk.material = W.sky.material; es.add(sk);
    const mo = new THREE.Mesh(new THREE.SphereGeometry(40, 16, 8), new THREE.MeshBasicMaterial({ color: new THREE.Color(6, 6, 5.5) })); mo.position.copy(W.moonDir).multiplyScalar(400); es.add(mo);
    W.env = pm.fromScene(es, .02).texture; pm.dispose(); mo.geometry.dispose(); mo.material.dispose(); scene.environment = W.env; scene.environmentIntensity = .55; }
  return W;
}
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _s = new THREE.Vector3(), _p = new THREE.Vector3(), _c = new THREE.Color(), _e = new THREE.Euler();
const HUES = ['#7a5a52', '#6a6070', '#5e6a64', '#7a6a50', '#6a5a6a', '#80705e', '#5a5a6e'];
function placeHouse(W, H, d) { // (re)build house slot H at distance d, returns its footprint length incl. spacing
  const R = H.row, s = H.seed + Math.floor(d * 3.1) * 13; const h = i => hash(s * 1.37 + i * 17.3);
  const len = R.near ? 6 + h(1) * 6 : 8 + h(1) * 9, wid = R.near ? (R.x1 - R.x0) + h(2) * 2.2 : 5 + h(2) * 6, top = R.near ? -3.6 + h(3) * 5.4 : -4 + h(3) * 9;
  const xc = R.side * (R.x0 + wid / 2) + (R.near ? 0 : R.side * h(4) * 3), zc = -(d + len / 2), base = -14;
  _q.identity(); _m.compose(_p.set(xc, base, zc), _q, _s.set(wid, top - base, len)); W.houses.setMatrixAt(H.i, _m);
  _c.set(HUES[Math.floor(h(5) * HUES.length)]).multiplyScalar(.75 + h(6) * .5); W.houses.setColorAt(H.i, _c);
  const rot = h(7) < .35 ? Math.PI / 2 : 0, rh = 1.6 + h(8) * 2.2; _q.setFromEuler(_e.set(0, rot, 0));
  _m.compose(_p.set(xc, top, zc), _q, rot ? _s.set(len + .5, rh, wid + .5) : _s.set(wid + .5, rh, len + .5)); W.roofs.setMatrixAt(H.i, _m);
  _c.set('#5a6070').multiplyScalar(.7 + h(9) * .5); W.roofs.setColorAt(H.i, _c);
  const cx = xc + (h(10) - .5) * wid * .5, cz = zc + (h(11) - .5) * len * .6; _q.identity(); _m.compose(_p.set(cx, top + rh * .3, cz), _q, _s.set(.7, rh * .8 + .9, .7)); W.chims.setMatrixAt(H.i, _m);
  H.top = top; H.rh = rh; H.xc = xc; H.zc = zc; H.len = len; H.wid = wid; H.rot = rot; H.chim = new THREE.Vector3(cx, top + rh * 1.1 + .9, cz);
  // two jack-o'-lanterns: one on the ridge end facing the run, one on the eave corner
  const facing = R.side < 0 ? -Math.PI * .75 : Math.PI * .75; // carved face → the run and the camera
  for (let j = 0; j < 2; j++) { const li = H.i * 2 + j; const px = j ? xc - R.side * (wid / 2 - .3) : (rot ? xc - R.side * (wid / 2 - .1) : xc), py = j ? top + .32 : top + rh * (rot ? .5 : .95) + .3, pz = j ? zc + len / 2 - .6 : zc + (rot ? 0 : len / 2 - .2);
    const sc = (R.near ? .9 : 1.5) * (.85 + h(12 + j) * .4); _q.setFromEuler(_e.set(0, facing + (h(14 + j) - .5) * .8, 0)); _m.compose(_p.set(px, py, pz), _q, _s.set(sc, sc, sc)); W.sidePump.setMatrixAt(li, _m);
    W.sideLit.base[li] = h(16 + j); W.sideLit.at[li] = 1e9; }
  const lit = Math.max(0, Math.min(1, W.festive)); W.hLit[H.i] = h(18) < lit ? 1 : .15 * h(19);
  if (W.houseGeo) W.houseGeo.attributes.aLit.needsUpdate = true;
  return len + (R.near ? .4 + h(20) * 1.4 : 1 + h(20) * 4);
}
// the town lighting wave: every lantern at distance r from the origin ignites at t0 + r / speed
export function igniteWave(W, origin, t0, speed = 42) { W.wave = { o: origin.clone(), t0, speed }; W.skyU.uT0.value = t0; W.skyU.uO.value.copy(origin); W.festive = Math.min(.92, W.festive + .3);
  for (const H of W.hs) for (let j = 0; j < 2; j++) { const li = H.i * 2 + j; const dx = H.xc - origin.x, dz = H.zc - origin.z; W.sideLit.at[li] = t0 + Math.hypot(dx, dz) / speed; }
  const p = W.skyGeo.attributes.position.array; for (let i = 0; i < W.skyLit.n; i++) { const dx = p[i * 3] + W.rings[0].position.x - origin.x, dz = p[i * 3 + 2] + W.rings[0].position.z - origin.z; W.skyLit.at[i] = t0 + .3 + Math.hypot(dx, dz) / (speed * 1.6); } }
export function updateWorld(W, t, dt, q, cam, focusD) {
  W.t = t; W.skyU.uT.value = t; W.flash = Math.max(0, fin(W.flash) - dt * 1.6); W.warm = Math.max(0, Math.min(1, fin(W.warm))); W.festive = Math.max(0, Math.min(1, fin(W.festive, .1)));
  W.sky.position.copy(cam.position); W.stars.position.copy(cam.position); W.sky.material.uniforms.time.value = t; W.stars.material.uniforms.time.value = t;
  W.sky.material.uniforms.moonDir.value.copy(W.moonDir);
  const md = 380, ms = 70 * W.moonScale; W.moon.position.copy(cam.position).addScaledVector(W.moonDir, md); W.moon.quaternion.copy(cam.quaternion); W.moon.scale.set(ms, ms, 1);
  { const k = 1 / (1 + Math.max(0, W.moonScale - 1) * .5); W.moon.material.color.setRGB(2.1 * k, 2.02 * k, 1.85 * k); W.halo.material.opacity = .55 * k * k; } W.halo.position.copy(cam.position).addScaledVector(W.moonDir, md + 2); W.halo.quaternion.copy(cam.quaternion); W.halo.scale.set(ms * 3.4, ms * 3.4, 1);
  for (const C of W.clouds) { C.a += C.v * dt; const dir = _p.copy(W.moonDir).applyAxisAngle(new THREE.Vector3(0, 1, 0), C.a).add(new THREE.Vector3(0, C.e, 0)).normalize(); C.s.position.copy(cam.position).addScaledVector(dir, 360); C.s.scale.set(C.k * 2.4, C.k, 1); }
  for (const r of W.rings) { r.position.x = cam.position.x; r.position.z = cam.position.z; } W.skyPts.position.set(cam.position.x, 0, cam.position.z);
  // light rig follows the action
  const fz = -focusD; W.key.position.set(W.moonDir.x * 40, 34, fz + W.moonDir.z * 40); W.key.target.position.set(0, 0, fz - 4); W.fill.position.set(6, 14, fz + 24); W.fill.target.position.set(0, 0, fz);
  W.ground.position.x = cam.position.x; W.ground.position.z = cam.position.z;
  // recycle houses behind the camera
  let moved = false; const behind = focusD - 26;
  for (const H of W.hs) if (H.d + H.len < behind) { const R = H.row; H.d = R.next; R.next += placeHouse(W, H, H.d); moved = true; }
  if (moved) { W.houses.instanceMatrix.needsUpdate = true; W.roofs.instanceMatrix.needsUpdate = true; W.chims.instanceMatrix.needsUpdate = true; W.sidePump.instanceMatrix.needsUpdate = true; W.houses.instanceColor.needsUpdate = true; W.roofs.instanceColor.needsUpdate = true; }
  // lantern states (base share lit = festivity, plus the wave)
  const L = W.sideLit; for (let i = 0; i < W.NL; i++) { const w = t >= L.at[i] ? Math.min(1, (t - L.at[i]) / .25) : 0; const base = L.base[i] < W.festive * .9 ? 1 : 0; const v = Math.max(base * .95, w); L.lit[i] += (v - L.lit[i]) * Math.min(1, dt * 8); if (w > 0 && L.at[i] < 1e8) { const H = W.hs[i >> 1]; W.hLit[H.i] = Math.max(W.hLit[H.i], w); } }
  W.sidePumpGeo.attributes.aLit.needsUpdate = true; W.houseGeo.attributes.aLit.needsUpdate = true;
  const S = W.skyLit; for (let i = 0; i < S.n; i++) { const w = t >= S.at[i] ? Math.min(1, (t - S.at[i]) / .3) : 0; const base = S.base[i] < .12 + W.festive * .5 ? .55 : 0; S.lit[i] = Math.max(base, w * (.8 + .2 * Math.sin(t * 7 + i))); }
  W.skyGeo.attributes.aLit.needsUpdate = true;
}
export function applyWorldQuality(W, q) { W.stars.geometry.setDrawRange(0, q.stars); }
export function disposeWorld() {}
