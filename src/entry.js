import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { createWorld, updateWorld, gradeShader, igniteWave, applyWorldQuality, QUALITY } from './world.js';
import { createCat, updateCat } from './cat.js';
import { createProps, syncProps, lanternLights } from './props.js';
import { createFX, sparks, puff, updateFX, seedFX } from './fx.js';
import { Track, Runner, autopilot, NIGHTS, ENDLESS, DUEL_NIGHT, DIFF, LANE } from './sim.js';
import { Player } from './music.js';
import * as A from './audio.js';
import { T } from './i18n.js';

const CREDIT_TXT = 'Built with Grok Bot · 5 days to Halloween 🎃';
const defName = () => S.lang === 'de' ? 'Spieler' : 'Player'; const shownName = () => S.name === 'Player' || S.name === 'Spieler' ? defName() : S.name;
const $ = id => document.getElementById(id);
const ls = { get(k, d) { try { const v = localStorage.getItem(k); return v === null ? d : v; } catch (e) { return d; } }, set(k, v) { try { localStorage.setItem(k, v); } catch (e) {} } };
const lerp = (a, b, k) => a + (b - a) * k, clamp = (v, a, b) => Math.max(a, Math.min(b, v)), smooth = x => x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x), fin = (v, d = 0) => Number.isFinite(v) ? v : d;
const fmt = n => Math.round(fin(n)).toLocaleString('en-US');
let fxSeed = (window.__lpSeed || (Date.now() & 0xffffff)) >>> 0;
function rng() { fxSeed = (fxSeed + 0x6D2B79F5) >>> 0; let t = fxSeed; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }
function autoLang() { try { const l = (navigator.languages && navigator.languages[0]) || navigator.language || ''; return /^de\b|^de-/i.test(l) || l.toLowerCase() === 'de' ? 'de' : 'en'; } catch (e) { return 'en'; } }
const S = { state: 'intro', mode: 'night', lang: ls.get('lp-lang', '') || autoLang(), diff: ls.get('lp-diff', 'medium'), kids: ls.get('lp-kids', '0') === '1', q: ls.get('lp-q', ''), qUser: !!ls.get('lp-q', ''),
  name: ls.get('lp-name', 'Player') || 'Player', gt: 0, ts: 1, ni: +ls.get('lp-ni', '0') || 0, player: 0, duel: [null, null], result: null, stars: 0, more: false, auto: false, introT: 0, titleT: -1, endT: 0, cine: null, camBlend: 1, punch: 0, newBest: false, hintT: 0 };
if (!DIFF[S.diff] || S.diff === 'kids') S.diff = 'medium';
if (!QUALITY[S.q]) { S.q = 'mid'; S.qUser = false; }
if (!(S.ni >= 0 && S.ni < NIGHTS.length)) S.ni = 0;
const dkey = () => S.kids ? 'kids' : S.diff;
A.setClock(() => S.gt);
const t = k => T[S.lang][k] ?? T.en[k] ?? k;
const progKey = () => `lp-prog-${dkey()}`;
function prog() { let p = null; try { p = JSON.parse(ls.get(progKey(), 'null')); } catch (e) {} if (!p || !Array.isArray(p.st)) p = { u: 0, st: [], b: [], e: 0 }; if (S.kids) p.u = NIGHTS.length - 1; return p; }
function saveProg(p) { ls.set(progKey(), JSON.stringify(p)); }
let isTouch = matchMedia && matchMedia('(pointer: coarse)').matches;

// ---------------- renderer / scene / post ----------------
const canvas = $('game');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance', preserveDrawingBuffer: !!window.__lpPDB });
renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.12; renderer.shadowMap.type = THREE.PCFShadowMap;
const W = createWorld(renderer); const scene = W.scene;
const camera = new THREE.PerspectiveCamera(60, 1, .1, 1200);
const F = createFX(scene, W.soft, W.smokeTex); F.floor = -14;
const C = createCat(scene, W.soft);
const P = createProps(scene, W);
// the shockwave ring + a bat flock for the Moonlight Leap
const ringM = new THREE.MeshBasicMaterial({ color: new THREE.Color(2.4, 1.1, .3), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false });
const ring = new THREE.Mesh(new THREE.RingGeometry(.92, 1, 96), ringM); ring.rotation.x = -Math.PI / 2; ring.visible = false; scene.add(ring);
const ring2 = new THREE.Mesh(ring.geometry, ringM.clone()); ring2.rotation.x = -Math.PI / 2; ring2.visible = false; scene.add(ring2);
const flockN = 46; const batShape = new THREE.Shape(); batShape.moveTo(0, .05); batShape.lineTo(.5, .2); batShape.lineTo(.7, 0); batShape.lineTo(.5, -.06); batShape.lineTo(.35, 0); batShape.lineTo(.2, -.1); batShape.lineTo(0, -.05); batShape.lineTo(-.2, -.1); batShape.lineTo(-.35, 0); batShape.lineTo(-.5, -.06); batShape.lineTo(-.7, 0); batShape.lineTo(-.5, .2); batShape.closePath();
const flock = new THREE.InstancedMesh(new THREE.ShapeGeometry(batShape), new THREE.MeshBasicMaterial({ color: '#07040c', side: THREE.DoubleSide }), flockN); flock.frustumCulled = false; flock.count = 0; scene.add(flock);
const flockB = []; for (let i = 0; i < flockN; i++) flockB.push({ p: new THREE.Vector3(), v: new THREE.Vector3(), ph: rng() * 6, life: 0 });
let composer, bloom, gradePass, rtOwn;
function disposeComposer() { if (!composer) return; for (const p of composer.passes) { if (p.dispose) p.dispose(); } composer.renderTarget1.dispose(); composer.renderTarget2.dispose(); if (rtOwn) rtOwn.dispose(); composer = null; }
function buildComposer() { disposeComposer();
  const q = QUALITY[S.q]; rtOwn = new THREE.WebGLRenderTarget(4, 4, { type: THREE.HalfFloatType, samples: q.msaa || 0 });
  composer = new EffectComposer(renderer, rtOwn); composer.addPass(new RenderPass(scene, camera));
  bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), .55, .5, 1.25); { const hp = bloom.materialHighPassFilter; hp.fragmentShader = hp.fragmentShader.replace('vec4 texel = texture2D( tDiffuse, vUv );', 'vec4 texel = min( texture2D( tDiffuse, vUv ), vec4( 3.2 ) );'); hp.needsUpdate = true; } // clamp hot spots: glow, never glare
  composer.addPass(bloom); composer.addPass(new OutputPass()); gradePass = new ShaderPass(gradeShader()); composer.addPass(gradePass); }
function applyQuality(qn, user) {
  if (!QUALITY[qn]) qn = 'mid'; S.q = qn; if (user) { S.qUser = true; ls.set('lp-q', qn); } const q = QUALITY[qn];
  renderer.shadowMap.enabled = q.shadows; W.key.castShadow = q.shadows; if (q.shadows) { W.key.shadow.mapSize.set(q.shadowSize, q.shadowSize); } if (W.key.shadow.map) { W.key.shadow.map.dispose(); W.key.shadow.map = null; }
  W.lights.forEach((L, i) => { L.visible = i < q.lights; L.intensity = 0; }); applyWorldQuality(W, q);
  scene.traverse(o => { if (o.material) { const m = Array.isArray(o.material) ? o.material : [o.material]; m.forEach(x => x.needsUpdate = true); } });
  buildComposer(); resize(); qLabels(); }
function qLabels() { const b = $('btnQ2'); if (b) { b.textContent = `⚙ ${t('q_' + S.q)}${S.qUser ? '' : ' · ' + t('qAuto')}`; b.title = t('qL'); } }
let VW = 1, VH = 1;
function resize() { VW = window.innerWidth; VH = window.innerHeight; const dpr = Math.min(window.devicePixelRatio || 1, QUALITY[S.q].dpr);
  renderer.setPixelRatio(dpr); renderer.setSize(VW, VH, false); if (composer) { composer.setPixelRatio(dpr); composer.setSize(VW, VH); } camera.aspect = VW / VH; camera.updateProjectionMatrix(); }

// ---------------- run state ----------------
let TR = null, RN = null; const timers = []; const after = (s, f) => timers.push({ t: S.gt + s, f });
const music = new Player();
function nightOf() { return S.mode === 'endless' ? ENDLESS : S.mode === 'duel' ? NIGHTS[DUEL_NIGHT] : NIGHTS[S.ni]; }
function seedOf() { return S.mode === 'endless' ? (window.__lpRouteSeed ?? ((Date.now() & 0xffff) + 1)) : S.mode === 'duel' ? (S.duelSeed || 4040) : 1000 + S.ni * 37; }
function nightName() { return t('n_' + nightOf().id); }
function resetVisuals() { timers.length = 0; S.ts = 1; S.cine = null; S.camBlend = 1; S.punch = 0; W.wave = null; W.festive = .12; W.flash = 0; W.warm = 0; W.moonScale = 1; W.moonDir.set(-.12, .3, -1).normalize(); S.moonDir0 = W.moonDir.clone();
  for (const H of W.hs) { W.hLit[H.i] = Math.min(W.hLit[H.i], .2); } W.sideLit.at.fill(1e9); W.skyLit.at.fill(1e9); W.skyU.uT0.value = 1e9; ring.visible = ring2.visible = false; flock.count = 0; for (const b of flockB) b.life = 0;
  for (let i = 0; i < F.life.length; i++) F.life[i] = 0; for (const p of F.puffs) { p.life = 0; p.s.visible = false; } $('banner').classList.remove('show'); window.__banners = []; window.__pops = []; }
function newRun(intro) { const N = intro ? NIGHTS[0] : nightOf(); const dk = intro ? 'medium' : dkey(); TR = new Track({ night: N, diff: dk, seed: intro ? 77 : seedOf(), intro }); RN = new Runner(TR, dk); camSnap = true; }
function start(mode = 'night', ni) {
  if (typeof mode === 'number') { ni = mode; mode = 'night'; } S.mode = mode; if (mode === 'night' && ni != null) S.ni = clamp(ni | 0, 0, NIGHTS.length - 1); ls.set('lp-ni', S.ni);
  if (mode === 'duel' && S.player !== 1) { S.player = 0; S.duel = [null, null]; S.duelSeed = 4040; }
  resetVisuals(); newRun(false); S.state = 'play'; S.result = null; S.more = false; S.auto = !!window.__lpAuto; S.hintT = 0; S.lastLives = RN.lives;
  music.start('game', S.gt + .05); A.sfx.ui(); showLevelCard(); seedFX(1234 + S.ni); setUI(); applyLang(); }
function clearBanners() { $('banner').classList.remove('show'); $('toast').classList.remove('show'); $('lvCard').classList.remove('show'); }
function endRun(res) { if (S.state !== 'play') return; S.result = res; S.endT = S.gt; clearBanners();
  if (S.mode === 'duel') { S.duel[S.player] = { score: RN.score, lit: RN.lit, of: TR.lanterns, chain: RN.bestChain, leaps: RN.leaps, d: RN.d, res };
    if (S.player === 0) { S.state = 'handover'; S.player = 1; A.sfx.turn(); setUI(); applyLang(); return; } }
  const N = nightOf(), lit = RN.lit / Math.max(1, TR.lanterns); S.stars = res === 'win' ? (lit >= .75 && RN.leaps > 0 ? 3 : lit >= .55 ? 2 : 1) : 0;
  const p = prog(); S.newBest = false;
  if (S.mode === 'night') { const i = S.ni; if (res === 'win') { p.st[i] = Math.max(p.st[i] || 0, S.stars); if (!S.kids) p.u = Math.max(p.u, Math.min(NIGHTS.length - 1, i + 1)); } if (RN.score > (p.b[i] || 0)) { p.b[i] = RN.score; S.newBest = true; } saveProg(p); }
  if (S.mode === 'endless') { if (RN.score > (p.e || 0)) { p.e = RN.score; S.newBest = true; } saveProg(p); }
  S.state = 'end'; if (res === 'win') { A.sfx.win(); for (let i = 0; i < S.stars; i++) after(.45 + i * .35, () => A.sfx.star(i)); } else if (res !== 'quit') A.sfx.fail();
  music.start('menu', S.gt + .8); showEnd(); setUI(); }
function toMenu() { const wasIntro = S.state === 'intro'; clearBanners(); S.state = 'menu'; S.more = false; S.player = 0; if (!wasIntro || !RN || RN.state !== 'run' && RN.state !== 'leap') { resetVisuals(); newRun(true); startCine(true); } S.auto = true; S.titleT = -1; $('opening').style.opacity = 0;
  hideLevelCard(); music.start('menu', S.gt + .1); setUI(); applyLang(); }
function startIntro() { S.state = 'intro'; S.introT = 0; S.titleT = -1; resetVisuals(); seedFX(77); newRun(true); S.auto = true; music.stop(); A.sfx.intro(); startCine(true); setUI(); applyLang(); }
function endIntro() { $('opening').style.opacity = 0; S.titleT = -1; }

// ---------------- events from the rules → visuals + sound ----------------
const _v = new THREE.Vector3(), _w = new THREE.Vector3(), _sp = new THREE.Vector3();
const catWorld = (o = _v) => o.set(RN.x, RN.y, -RN.d);
function panX(x) { return clamp(x / 4, -.6, .6); }
function handleEvents() {
  const evs = RN.ev; if (!evs.length) return; RN.ev = [];
  for (const e of evs) {
    const pan = panX(e.x); const live = S.state === 'play';
    switch (e.t) {
      case 'lantern': { const p = TR.picks.find(q => q.id === e.p); if (p) { p.gotT = S.gt; sparks(F, _w.set(p.x, p.by + .45, -p.d), 26, { colors: ['#ffd27a', '#ff8a2a', '#ff5a10'], speed: 3.2, up: 2.2, life: .8, size: .11, grav: 2 }); }
        A.sfx.lantern(e.chain, pan); W.warm = Math.min(.5, W.warm + .05); if (live && e.chain % 5 === 0) popAt(`${t('chainX')}${Math.min(5, 1 + Math.floor(e.chain / 5))}`, '#ffd27a', true, null); break; }
      case 'wisp': { const p = TR.picks.find(q => q.id === e.p); if (p) sparks(F, _w.set(p.x, p.by + p.y, -p.d), 8, { colors: ['#9affe0', '#6ad8ff'], speed: 1.6, up: .8, life: .5, size: .07, grav: 0 }); A.sfx.wisp(pan); break; }
      case 'jump': A.sfx.jump(pan); if (!e.auto || true) puff(F, catWorld(_w).add(_sp.set(0, .1, .3)), 1, '#5a5070', .5); break;
      case 'djump': A.sfx.djump(pan); sparks(F, C.tipWorld, 18, { colors: ['#ffd27a', '#9affe0'], speed: 2, life: .5, size: .08, grav: 1 }); break;
      case 'land': A.sfx.land(Math.abs(e.vy || 0), pan); C.squash = Math.min(1, Math.abs(e.vy || 0) / 12); if (Math.abs(e.vy || 0) > 4) puff(F, catWorld(_w), 2, '#4a4058', .7);
        if (e.big) { A.sfx.bigLand(); S.punch = 1; sparks(F, catWorld(_w).add(_sp.set(0, .2, 0)), 60, { colors: ['#ffd27a', '#ff8a2a'], speed: 5, up: 1, life: .9, size: .1, grav: 4 }); } break;
      case 'slide': A.sfx.slide(pan); break;
      case 'near': A.sfx.near(); if (live) popAt(t('near'), '#9affe0', false, catWorld(_w).add(_sp.set(0, 1.2, 0))); break;
      case 'hit': A.sfx.hit(pan); W.flash = .5; S.punch = -1; if (live) { popAt(t('hit'), '#ff8a7a', true, null); if (e.lives === 1) toast(t('lastLife')); } { const o = TR.obs.find(q => q.t === e.ot && q.hit && !q.hitT); if (o) o.hitT = S.gt; } sparks(F, catWorld(_w).add(_sp.set(0, .6, -.4)), 30, { colors: ['#ffffff', '#c8b8a8'], speed: 3, life: .6, size: .09, grav: 5 }); break;
      case 'bonk': A.sfx.bonk(pan); if (live) popAt(t('bonk'), '#ffd27a', false, null); break;
      case 'smash': { const o = TR.obs.find(q => q.id === e.o); if (o) { o.hitT = S.gt; sparks(F, _w.set(o.x, o.by + 1, -o.d), 24, { colors: ['#b8b0a8', '#8a6a5a'], speed: 3.5, life: .7, size: .12, grav: 7 }); } A.sfx.smash(e.ot, pan); break; }
      case 'fall': A.sfx.fall(); if (live) popAt(t('fall'), '#ff8a7a', true, null); break;
      case 'respawn': A.sfx.respawn(); sparks(F, catWorld(_w).add(_sp.set(0, .5, 0)), 40, { colors: ['#9affe0', '#ffffff'], speed: 2.5, life: .7, size: .08, grav: 0 }); camSnap = true; break;
      case 'power': A.sfx.power(e.k); if (live) banner(t(e.k)); break;
      case 'ready': A.sfx.ready(); if (live || S.state === 'menu') { banner('🌕 ' + t('ready')); after(1.6, () => { if (S.state === 'play') toast(t('archAhead')); }); } break;
      case 'leap': A.sfx.leap(); startCine(false); if (live) banner(t('leap')); break;
      case 'ignite': igniteFx(); if (S.state !== 'intro' || window.__lpIntroBanners) banner('🎃 ' + t('ignites')); break;
      case 'frenzy': A.sfx.frenzy(); if (live) after(.5, () => banner('🔥 ' + t('frenzy'))); break;
      case 'win': if (live) { banner('🕛 ' + t('finish')); after(1.4, () => endRun('win')); } break;
      case 'dead': if (live) after(1.0, () => endRun('dead')); break;
    }
  }
}
function igniteFx() { const at = catWorld(_w).clone(); A.sfx.ignite(); W.flash = .55; S.flashCat = 1;
  igniteWave(W, at, S.gt, 40); ring.visible = ring2.visible = true; S.ringT = S.gt; ring.position.set(at.x, TR.bAt(RN.leap ? RN.leap.d0 - 1 : RN.d)?.y ?? 0, at.z); ring2.position.copy(ring.position);
  const side = !!S.cine && !!RN.leap; let fo = null, fr = null; if (side) { const c0 = cineCam(.62, new THREE.Vector3()), l0 = leapWorld(.62, new THREE.Vector3()); fo = l0.sub(c0).setY(0).normalize(); fr = new THREE.Vector3(-fo.z, 0, fo.x); fo.c = c0; } for (let i = 0; i < 14; i++) after(side ? .04 + i * .075 : .1 + i * .16 + rng() * .08, () => { const p = side ? _w.copy(fo.c).addScaledVector(fo, 45 + rng() * 25).addScaledVector(fr, (i % 2 ? 1 : -1) * (6 + rng() * 22)).setY(15 + rng() * 16) : _w.set((rng() - .5) * 70, 14 + rng() * 22, -RN.d - 20 - rng() * 70); const cols = [['#ffb04a', '#ffe08a'], ['#b06aff', '#ffd0ff'], ['#7affc8', '#e0fff0'], ['#ff6a3a', '#ffd27a']][i % 4];
    sparks(F, p, 170, { colors: cols, speed: side ? 26 : 9, up: 0, life: side ? 2.2 : 1.8, size: side ? .9 : .6, grav: side ? 4 : 2.2 }); A.play(i % 2 ? 'fw_burst_b' : 'fw_burst', .28, .9 + rng() * .2, 0, .5, 0, (p.x / 40)); });
  let k = 0; for (const b of flockB) { const H = W.hs[(k * 7) % W.hs.length]; b.p.set(H.xc, H.top + 2, H.zc); b.v.set((rng() - .5) * 6, 4 + rng() * 5, (rng() - .5) * 6 - 2); b.life = 4 + rng() * 2; k++; } flock.count = flockN; }
// ---------------- the cinematic camera for the Moonlight Leap (and the opening) ----------------
let camSnap = true; const camPos = new THREE.Vector3(), camLook = new THREE.Vector3(), cineLook = new THREE.Vector3();
function leapWorld(u, o) { const L = RN.leap; const p = RN.leapPos(u); return o.set(0, p.y, -p.d); }
function startCine(intro) { if (!RN.leap) return; S.cine = { intro, t0: S.gt, side: 1 };
  // the moon sits exactly behind the apex as seen from the apex camera
  const apex = leapWorld(.5, new THREE.Vector3()); const cp = cineCam(.5, new THREE.Vector3(), true); S.cine.moon = apex.clone().sub(cp).normalize(); S.cine.moon.y += .02; S.cine.moon.normalize();
  // open the town square on the camera side (no house between the camera and the cat)
  const d0 = RN.leap.d0 - 8, d1 = RN.leap.d1 + 8; const z = new THREE.Matrix4().makeScale(0, 0, 0);
  for (const H of W.hs) if (H.row.side > 0 && H.d < d1 && H.d + H.len > d0) { W.houses.setMatrixAt(H.i, z); W.roofs.setMatrixAt(H.i, z); W.chims.setMatrixAt(H.i, z); W.sidePump.setMatrixAt(H.i * 2, z); W.sidePump.setMatrixAt(H.i * 2 + 1, z); }
  W.houses.instanceMatrix.needsUpdate = W.roofs.instanceMatrix.needsUpdate = W.chims.instanceMatrix.needsUpdate = W.sidePump.instanceMatrix.needsUpdate = true; }
function cineCam(u, out, plan) { const L = RN.leap; const p = RN.leapPos(clamp(u, 0, 1)); const apexD = (L.d0 + L.d1) / 2;
  const zTrack = lerp(-apexD, -p.d, .55); const intro = S.cine && S.cine.intro && !plan;
  const dist = intro ? lerp(15, 9.5, smooth((u - .3) / .45)) : 9.5;
  return out.set(dist * .86, 6.6 + L.y0 + (intro ? lerp(1.2, 0, smooth((u - .3) / .4)) : 0), zTrack + 2.2); }
function updateCamera(dt) {
  const aspect = VW / VH, portrait = aspect < 1; const v = RN ? RN.v : 10;
  // chase camera
  const fr = RN ? RN.frenzy > 0 : false; const up = portrait ? 3.0 : 2.4, back = portrait ? 6.6 : 5.4;
  const cx = RN.x * .55, cy = RN.y + up + Math.min(1.2, v * .02), cz = -RN.d + back;
  let tp = _v.set(cx, cy, cz), tl = _w.set(RN.x * .7, RN.y + .9 + (portrait ? .6 : 0), -RN.d - 7);
  let fov = 58 + (v - 10) * 1.1 + (fr ? 5 : 0) + (portrait ? (1 - aspect) * 26 : 0);
  if (S.state === 'menu' && !RN.leap) { const a = S.gt * .12; tp.set(RN.x + 2.4 + Math.sin(a) * .8, RN.y + 1.5, -RN.d + 4.8); tl.set(RN.x - 1.2, RN.y + 2.1, -RN.d - 10); fov = 50 + (portrait ? (1 - aspect) * 30 : 0); }
  if (RN.state === 'fall') { tp.set(cx, RN.y + 4.5, cz - 1); tl.set(RN.x, RN.y, -RN.d - 2); }
  if (RN.leap && S.cine) { const u = RN.leap.u, cin = S.cine; const cp = cineCam(u, new THREE.Vector3()); const p = RN.leapPos(u);
    const lk = cineLook.set(0, lerp(p.y, (RN.leap.y0 + LEAP_APEX()), .35) + .4, -p.d - 1.2);
    const k = cin.intro ? 1 : smooth(u / .2) * (1 - smooth((u - .9) / .1)); tp.lerp(cp, k); tl.lerp(lk, k); const pw = portrait ? (1 - aspect) * 40 : 0; fov = lerp(fov, (cin.intro ? lerp(30, 46, smooth((u - .3) / .45)) : 44) + pw, k);
    W.moonDir.copy(S.moonDir0).lerp(cin.moon, smooth(k * 1.3)).normalize(); W.moonScale = lerp(1, 2.3 * (1 - pw / 40 * .4), smooth(k * 1.3)); S.camBlend = 0; }
  else { if (S.cine) { S.cine = null; S.camBlend = 0; } W.moonDir.lerp(S.moonDir0, Math.min(1, dt * 1.2)).normalize(); W.moonScale = lerp(W.moonScale, 1, Math.min(1, dt * 1.2)); S.camBlend = Math.min(1, S.camBlend + dt * 1.6); }
  S.punch = fin(S.punch) * Math.exp(-dt * 5); fov += S.punch * -4;
  if (camSnap) { camPos.copy(tp); camLook.copy(tl); camSnap = false; } else { const kk = RN.leap ? 1 - Math.exp(-dt * 9) : 1 - Math.exp(-dt * (4 + 5 * S.camBlend)); camPos.lerp(tp, kk); camLook.lerp(tl, Math.min(1, kk * 1.3)); }
  camera.position.copy(camPos); camera.lookAt(camLook); camera.fov = fin(fov, 58); camera.updateProjectionMatrix();
}
const LEAP_APEX = () => 9.5;
// ---------------- input ----------------
const press = { id: null, x: 0, y: 0, t: 0, sw: false };
function act(a) { if (!RN || S.state !== 'play') return; RN.act(a); { const lc = $('lvCard'); if (lc.classList.contains('show') && S.gt - (+lc.dataset.t0) > .35) lc.classList.remove('show'); } if (a === 'left' || a === 'right') A.sfx.lane(a === 'left' ? -1 : 1); S.hintT = Math.max(S.hintT, 0); }
function uiTarget(e) { return e.target && e.target.closest && e.target.closest('button, .panel, #top, input, label'); }
canvas.addEventListener('pointerdown', e => { if (e.pointerType === 'touch' && !isTouch) { isTouch = true; applyLang(); } if (S.state !== 'play') return; press.id = e.pointerId; press.x = e.clientX; press.y = e.clientY; press.t = performance.now(); press.sw = false; });
window.addEventListener('pointermove', e => { if (press.id !== e.pointerId || press.sw || S.state !== 'play') return; const dx = e.clientX - press.x, dy = e.clientY - press.y; const th = Math.max(22, Math.min(VW, VH) * .045);
  if (Math.hypot(dx, dy) < th) return; press.sw = true; if (Math.abs(dx) > Math.abs(dy)) act(dx < 0 ? 'left' : 'right'); else act(dy < 0 ? 'jump' : 'slide'); });
window.addEventListener('pointerup', e => { if (press.id !== e.pointerId) return; press.id = null; if (!press.sw && S.state === 'play' && performance.now() - press.t < 450) act('jump'); });
window.addEventListener('pointercancel', () => { press.id = null; });
window.addEventListener('keydown', e => { if (e.target && e.target.tagName === 'INPUT') return; const k = e.key;
  if (S.state === 'intro' && !e.repeat && (k === ' ' || k === 'Enter')) { e.preventDefault(); playNow(); return; }
  if (S.state === 'handover' && (k === ' ' || k === 'Enter')) { e.preventDefault(); $('btnGo').click(); return; }
  if (k === 'Escape') { if (S.state === 'play') { endRun('quit'); toMenu(); } else if (S.more) { S.more = false; setUI(); } else if (S.state === 'end') toMenu(); return; }
  if (S.state === 'menu' && !S.more && (k === 'Enter' || k === ' ')) { e.preventDefault(); $('btnPlay').click(); return; }
  if (S.state !== 'play' || e.repeat) return;
  if (k === 'ArrowLeft' || k === 'a' || k === 'A') act('left'); else if (k === 'ArrowRight' || k === 'd' || k === 'D') act('right');
  else if (k === 'ArrowUp' || k === 'w' || k === 'W' || k === ' ') { e.preventDefault(); act('jump'); } else if (k === 'ArrowDown' || k === 's' || k === 'S') { e.preventDefault(); act('slide'); } });
// ---------------- UI ----------------
function setUI() { const st = S.state; const b = document.body; b.dataset.state = st; b.dataset.mode = S.mode; b.dataset.kids = S.kids ? '1' : '0';
  if (st !== 'menu') S.more = false; $('menu').classList.toggle('show', st === 'menu'); $('more').classList.toggle('show', st === 'menu' && !!S.more); b.dataset.more = S.more ? '1' : '0'; $('btnGear').setAttribute('aria-expanded', S.more ? 'true' : 'false');
  $('end').classList.toggle('show', st === 'end'); $('handover').classList.toggle('show', st === 'handover');
  if (st !== 'play' || !RN) return; const duel = S.mode === 'duel';
  $('hNight').textContent = duel ? `${t(S.player ? 'p2' : 'p1')} · ${t('duelT')}` : S.mode === 'endless' ? t('n_endless') : `${S.ni + 1} · ${nightName()}`;
  $('hScore').textContent = fmt(RN.score); $('hLives').textContent = Number.isFinite(RN.lives) ? '🐾'.repeat(Math.max(0, RN.lives)) || '–' : '∞';
  $('hChain').textContent = '×' + RN.mult; $('hChain').parentElement.classList.toggle('hot', RN.mult >= 3);
  const m = RN.meter / RN.D.cap; $('moonFill').style.transform = `scaleY(${clamp(m, 0, 1).toFixed(3)})`; $('moon').classList.toggle('full', m >= 1);
  const N = nightOf(); $('progFill').style.width = (Number.isFinite(N.len) ? clamp(RN.d / TR.finishD === Infinity ? RN.d / N.len : RN.d / N.len, 0, 1) * 100 : 100) + '%'; $('prog').classList.toggle('endless', !Number.isFinite(N.len));
  if (Number.isFinite(N.len)) $('progTxt').textContent = ''; else $('progTxt').textContent = Math.floor(RN.d) + ' m';
  $('pw').textContent = (RN.pow.broom > 0 ? '🧹' : '') + (RN.pow.magnet > 0 ? '🧲' : '') + (RN.pow.shadow > 0 ? '🟣' : '') + (RN.frenzy > 0 ? '🔥' : ''); }
function applyLang() { document.documentElement.lang = S.lang; if ($('eName') && /^(Player|Spieler)$/.test($('eName').value)) $('eName').value = defName(); document.querySelectorAll('[data-t]').forEach(el => el.textContent = t(el.dataset.t)); $('btnLang').textContent = S.lang === 'en' ? 'DE' : 'EN'; $('btnLang').setAttribute('aria-label', S.lang === 'en' ? 'Deutsch' : 'English');
  $('keysTip').textContent = t('keysHint'); $('oSub').textContent = t('countdown');
  $('btnKids').classList.toggle('on', S.kids); $('btnKids').setAttribute('aria-pressed', S.kids); document.querySelectorAll('#diff button').forEach(b => b.classList.toggle('on', b.dataset.d === S.diff)); $('diff').classList.toggle('off', S.kids);
  $('btnSound').textContent = A.isMuted() ? '🔇' : '🔊'; $('btnSound2').textContent = t(A.isMuted() ? 'soundOff' : 'soundOn'); qLabels(); $('btnSkip').textContent = '▶ ' + (isTouch ? (S.lang === 'de' ? 'Tippen zum Spielen' : 'Tap to play') : (S.lang === 'de' ? 'Klicken zum Spielen' : 'Click to play'));
  $('playL').textContent = `${t('night')} ${S.ni + 1} · ${t('n_' + NIGHTS[S.ni].id)}`; $('btnGear').setAttribute('aria-label', t('gear')); buildNightMap();
  if (S.state === 'handover') { $('hoT').textContent = t(S.player ? 'duelTurn2' : 'duelTurn1'); $('hoS').textContent = S.duel[0] ? `${t('p1')}: ${fmt(S.duel[0].score)}` : ''; }
  if (S.state === 'end') showEnd(); setUI(); }
function buildNightMap() { const p = prog(); const el = $('nights'); el.innerHTML = NIGHTS.map((N, i) => { const lock = i > p.u; const st = p.st[i] || 0;
  return `<button class="lv${lock ? ' lock' : ''}${i === S.ni ? ' cur' : ''}" data-i="${i}" ${lock ? 'disabled' : ''} title="${t('n_' + N.id)}"><b>${lock ? '🔒' : i + 1}</b><i>${'★'.repeat(st)}${'☆'.repeat(3 - st)}</i></button>`; }).join('');
  el.querySelectorAll('button').forEach(b => b.onclick = () => { A.unlock(); start('night', +b.dataset.i); }); }
function showEnd() { const duel = S.mode === 'duel', r = S.result; let title;
  if (duel) { const a = S.duel[0], b = S.duel[1]; title = !a || !b ? t('quitT') : a.score > b.score ? t('duelWin1') : b.score > a.score ? t('duelWin2') : t('duelTie'); $('eScore').textContent = a && b ? `${fmt(a.score)} : ${fmt(b.score)}` : fmt(RN.score); }
  else { title = r === 'win' ? t('win') : r === 'quit' ? t('quitT') : S.mode === 'endless' ? t('endlessEnd') : t('fail'); $('eScore').textContent = fmt(RN.score); }
  $('eTitle').textContent = title; $('eNight').textContent = duel ? t('duelT') : S.mode === 'endless' ? t('n_endless') : `${t('night')} ${S.ni + 1} · ${nightName()}`;
  $('eStars').innerHTML = S.mode === 'night' && r === 'win' ? [0, 1, 2].map(i => `<i class="${i < S.stars ? 'on' : ''}">★</i>`).join('') : '';
  const p = prog(); $('eBest').textContent = duel ? '' : S.newBest ? t('newBest') : `${t('bestL')}: ${fmt(S.mode === 'endless' ? p.e || 0 : p.b[S.ni] || 0)}`;
  $('eStats').innerHTML = duel && S.duel[0] && S.duel[1] ? [0, 1].map(i => `<div><b>${t(i ? 'p2' : 'p1')}</b> 🎃 ${S.duel[i].lit}/${S.duel[i].of} · 🔗 ${S.duel[i].chain} · 🌕 ${S.duel[i].leaps}</div>`).join('')
    : `<div>🎃 ${t('stLit')}: <b>${RN.lit}/${TR.lanterns}</b></div><div>🔗 ${t('stChain')}: <b>${RN.bestChain}</b></div><div>🌕 ${t('stLeaps')}: <b>${RN.leaps}</b></div><div>🐈‍⬛ ${t('stNear')}: <b>${RN.nears}</b></div><div>📏 ${t('stDist')}: <b>${Math.floor(RN.d)} m</b></div>`;
  $('btnNext').style.display = S.mode === 'night' && r === 'win' && S.ni < NIGHTS.length - 1 ? '' : 'none'; $('btnAgain').textContent = duel ? t('againD') : t('again'); $('eName').value = shownName(); }
function showLevelCard() { const N = nightOf(); $('lcT').textContent = S.mode === 'duel' ? `${t(S.player ? 'p2' : 'p1')} · ${t('duelT')}` : S.mode === 'endless' ? t('n_endless') : `${t('night')} ${S.ni + 1} · ${nightName()}`;
  const el = $('lvCard'), compact = innerWidth < innerHeight * .85 || (innerHeight <= 520 && innerWidth > innerHeight); el.classList.toggle('compact', compact); // portrait phones: small card at the top edge, short text
  $('lcG').textContent = t('hintGoal'); const first = S.ni === 0 || S.mode !== 'night';
  $('lcTip').textContent = compact ? (first ? t(isTouch ? 'hintShort' : 'hintKeys') : t('tip_' + N.id)) : (first ? t(isTouch ? 'hintTouch' : 'hintKeys') + ' · ' : '') + t('tip_' + N.id);
  el.classList.add('show'); el.dataset.t0 = S.gt; }
function hideLevelCard() { $('lvCard').classList.remove('show'); }
function popAt(txt, col, big, at) { (window.__pops = window.__pops || []).push(txt); let x = 0, y = -VH * .12; if (at) { _sp.copy(at).project(camera); if (_sp.z < 1) { x = clamp(_sp.x * .5 * VW, -VW * .36, VW * .36); y = clamp(-_sp.y * .5 * VH, -VH * .3, VH * .3); } }
  const el = document.createElement('div'); el.className = 'pop' + (big ? ' big' : ''); el.textContent = txt; el.style.color = col; el.style.left = x + 'px'; el.style.top = y + 'px'; el.dataset.t0 = S.gt; $('pops').appendChild(el); if ($('pops').children.length > 8) $('pops').firstChild.remove(); }
function banner(s) { if (!s) return; (window.__banners = window.__banners || []).push(s); const el = $('banner'); el.textContent = s; el.style.fontSize = ''; el.dataset.t0 = S.gt; el.classList.add('show');
  const sw = el.scrollWidth, cw = el.clientWidth; if (sw > cw + 1) el.style.fontSize = (parseFloat(getComputedStyle(el).fontSize) * cw / sw * .97).toFixed(1) + 'px'; }
function toast(s) { if (S.state !== 'play') return; const el = $('toast'); el.textContent = s; el.classList.add('show'); el.dataset.t0 = S.gt; }
function updateOverlays() { // timed on game time (frame exact in the video)
  const bn = $('banner'); if (bn.classList.contains('show')) { const a = S.gt - (+bn.dataset.t0); const k = a < .18 ? a / .18 : a > 1.9 ? Math.max(0, 1 - (a - 1.9) / .35) : 1; bn.style.opacity = k; bn.style.transform = `translate(-50%,-50%) scale(${(a < .18 ? 1.5 - .5 * a / .18 : 1 + a * .02).toFixed(3)})`; if (a > 2.3) bn.classList.remove('show'); }
  const ts = $('toast'); if (ts.classList.contains('show') && S.gt - (+ts.dataset.t0) > 2.4) ts.classList.remove('show');
  const lc = $('lvCard'); if (lc.classList.contains('show') && S.gt - (+lc.dataset.t0) > 3.2) lc.classList.remove('show');
  for (const el of [...$('pops').children]) { const a = S.gt - (+el.dataset.t0); if (a > 1.1) { el.remove(); continue; } el.style.opacity = a < .1 ? a / .1 : 1 - Math.max(0, (a - .6) / .5); el.style.transform = `translate(-50%,-50%) translateY(${-a * 46}px) scale(${a < .12 ? .6 + a / .12 * .4 : 1})`; }
  // the opening title: slams in huge, then recedes into the stars
  const op = $('opening'); if (S.state === 'intro' && S.titleT >= 0) { const a = S.introT - S.titleT; const sIn = a < .28 ? 3.2 - 2.2 * smooth(a / .28) : 1; const rec = smooth((a - 1.2) / 2.6);
    op.style.opacity = a < .08 ? a / .08 : 1 - smooth((a - 2.6) / 1.2); $('oTitle').style.transform = `translateY(${-rec * VH * .18}px) scale(${(sIn * (1 - rec * .72)).toFixed(3)}) perspective(600px) rotateX(${(rec * 32).toFixed(1)}deg)`; } else if (S.state !== 'intro') op.style.opacity = 0; }
function audioBadge() { document.body.dataset.audio = A.state() === 'running' ? 'on' : 'locked'; }
// ---------------- buttons ----------------
$('btnPlay').onclick = () => { A.unlock(); start('night', S.ni); };
$('btnGear').onclick = () => { if (S.state === 'play') return; A.unlock(); S.more = !S.more; A.sfx.ui(); setUI(); };
$('btnMoreX').onclick = $('moreBg').onclick = () => { S.more = false; A.sfx.ui(); setUI(); };
$('btnEndless').onclick = () => { A.unlock(); start('endless'); }; $('btnDuel').onclick = () => { A.unlock(); S.player = 0; start('duel'); };
document.querySelectorAll('#diff button').forEach(b => b.onclick = () => { S.diff = b.dataset.d; S.kids = false; ls.set('lp-diff', S.diff); ls.set('lp-kids', '0'); A.sfx.ui(); applyLang(); });
$('btnKids').onclick = () => { S.kids = !S.kids; ls.set('lp-kids', S.kids ? '1' : '0'); A.sfx.ui(); applyLang(); };
$('btnQ2').onclick = () => { const o = ['low', 'mid', 'high', 'ultra']; applyQuality(o[(o.indexOf(S.q) + 1) % o.length], true); A.sfx.ui(); };
$('btnIntro').onclick = () => { A.unlock(); startIntro(); };
$('btnLang').onclick = () => { S.lang = S.lang === 'en' ? 'de' : 'en'; ls.set('lp-lang', S.lang); A.sfx.ui(); applyLang(); };
const toggleSound = () => { A.unlock(); A.setMuted(!A.isMuted()); ls.set('lp-mute', A.isMuted() ? '1' : '0'); applyLang(); }; $('btnSound').onclick = toggleSound; $('btnSound2').onclick = toggleSound;
$('btnQuit').onclick = () => { if (S.state === 'play') endRun('quit'); toMenu(); };
$('btnNext').onclick = () => { A.unlock(); start('night', S.ni + 1); }; $('btnAgain').onclick = () => { A.unlock(); if (S.mode === 'duel') { S.player = 0; start('duel'); } else start(S.mode, S.ni); }; $('btnMenu').onclick = () => toMenu();
$('btnCard').onclick = () => saveCard(false); $('btnShare').onclick = () => saveCard(true);
$('btnGo').onclick = () => { A.unlock(); start('duel'); }; $('handover').addEventListener('click', e => { if (e.target.id !== 'btnGo') $('btnGo').click(); });
$('eName').addEventListener('keydown', e => e.stopPropagation()); $('eName').addEventListener('input', () => { S.name = ($('eName').value || '').slice(0, 18); });
if (ls.get('lp-mute', '0') === '1') A.setMuted(true);
// ---- ONE TAP TO PLAY: the first tap/click anywhere on the opening goes straight into Night 1 (sound unlocks on that same tap) ----
let eatClick = 0;
function playNow() { if (S.state !== 'intro') return; A.unlock(); setTimeout(audioBadge, 60); endIntro(); start('night', S.ni); }
function introTap(e) { if (S.state !== 'intro' || (e.target && e.target.closest && e.target.closest('#top'))) return; if (e.pointerType === 'touch' && !isTouch) { isTouch = true; } eatClick = performance.now() + 450; playNow(); }
window.addEventListener('pointerup', introTap);
window.addEventListener('click', e => { if (performance.now() < eatClick) { e.stopPropagation(); e.preventDefault(); eatClick = 0; return; } introTap(e); }, true);
for (const ev of ['touchend', 'click', 'keydown', 'pointerup']) window.addEventListener(ev, () => { A.unlock(); setTimeout(audioBadge, 80); }, { capture: true, passive: true }); // iOS: resume audio inside a real user gesture
window.addEventListener('resize', resize);
// ---------------- share card (1080×1350, no URL) ----------------
async function makeCard() {
  S.name = ($('eName').value || '').trim().slice(0, 18) || defName(); ls.set('lp-name', S.name); try { await document.fonts.load('700 40px Fredoka'); } catch (e) {}
  const CW = 1080, CH = 1350; renderer.setPixelRatio(1); renderer.setSize(CW, CH, false); composer.setPixelRatio(1); composer.setSize(CW, CH);
  const old = { a: camera.aspect, f: camera.fov, p: camera.position.clone(), q: camera.quaternion.clone() }; const md = W.moonDir.clone(), msc = W.moonScale;
  camera.aspect = CW / CH; camera.fov = 52; camera.position.set(RN.x + 2.2, RN.y + 1.6, -RN.d + 4.6); camera.lookAt(RN.x - .6, RN.y + 2.6, -RN.d - 10); camera.updateProjectionMatrix(); camera.updateMatrixWorld();
  W.moonDir.set(-.08, .2, -1).normalize(); W.moonScale = 1.5; updateWorld(W, S.gt, 0, QUALITY.high, camera, RN.d); composer.render();
  const c = document.createElement('canvas'); c.width = CW; c.height = CH; const k = c.getContext('2d'); k.drawImage(renderer.domElement, 0, 0, CW, CH);
  camera.aspect = old.a; camera.fov = old.f; camera.position.copy(old.p); camera.quaternion.copy(old.q); W.moonDir.copy(md); W.moonScale = msc; resize();
  const gr = k.createLinearGradient(0, 0, 0, CH); gr.addColorStop(0, 'rgba(6,4,16,.9)'); gr.addColorStop(.2, 'rgba(6,4,16,.15)'); gr.addColorStop(.58, 'rgba(6,4,16,.05)'); gr.addColorStop(.72, 'rgba(6,4,16,.82)'); gr.addColorStop(1, 'rgba(6,4,16,.97)'); k.fillStyle = gr; k.fillRect(0, 0, CW, CH);
  const Fo = (w, s) => `${w} ${s}px Fredoka, "Arial Rounded MT Bold", sans-serif`; k.textAlign = 'center'; k.lineJoin = 'round';
  const txt = (s, x, y, fill, stroke = 'rgba(16,6,24,.9)', lw = 8) => { if (lw) { k.strokeStyle = stroke; k.lineWidth = lw; k.strokeText(s, x, y); } k.fillStyle = fill; k.fillText(s, x, y); };
  k.font = Fo(700, 104); txt('LANTERN PROWL', CW / 2, 120, '#ffe2b0', 'rgba(60,20,4,.92)', 12);
  const duel = S.mode === 'duel' && S.duel[0] && S.duel[1];
  if (duel) { k.font = Fo(700, 112); txt(`${fmt(S.duel[0].score)} : ${fmt(S.duel[1].score)}`, CW / 2, 1040, '#fff0c0', 'rgba(30,16,4,.9)', 14); k.font = Fo(600, 50); txt($('eTitle').textContent, CW / 2, 1110, '#ffb35a'); k.font = Fo(500, 34); txt(`${t('p1')} · ${t('p2')}`, CW / 2, 182, '#ffffff'); }
  else { k.font = Fo(600, 46); txt(S.mode === 'endless' ? `${t('n_endless')} · ${Math.floor(RN.d)} m` : `${t('night')} ${S.ni + 1} · ${nightName()}`, CW / 2, 962, '#ffd0a0'); k.font = Fo(700, 150); txt(fmt(RN.score), CW / 2, 1104, '#fff0c0', 'rgba(30,16,4,.9)', 16);
    if (S.result === 'win' && S.mode === 'night') { k.font = Fo(700, 70); txt('★'.repeat(S.stars) + '☆'.repeat(3 - S.stars), CW / 2, 1182, '#ffcf4a', 'rgba(40,20,0,.9)', 8); } else { k.font = Fo(600, 46); txt($('eTitle').textContent || '', CW / 2, 1178, '#ffb35a'); }
    k.font = Fo(500, 34); txt(`${t('by')} ${shownName()}`, CW / 2, 182, '#ffffff'); }
  const lp = duel ? S.duel[0].leaps + S.duel[1].leaps : RN.leaps; if (lp > 0) { k.save(); k.translate(CW - 172, 330); k.rotate(-.16); k.fillStyle = 'rgba(30,26,60,.92)'; k.strokeStyle = '#ffe6a0'; k.lineWidth = 6; k.beginPath(); k.arc(0, 0, 118, 0, 7); k.fill(); k.stroke();
    k.font = Fo(700, 58); txt('🌕', 0, -16, '#fff', 'rgba(0,0,0,0)', 0); k.font = Fo(700, 22); txt(S.lang === 'de' ? 'MONDSPRUNG' : 'MOON LEAP', 0, 30, '#ffe6a0', 'rgba(0,0,0,0)', 0); k.font = Fo(700, 34); txt('x' + lp, 0, 72, '#fff', 'rgba(0,0,0,0)', 0); k.restore(); }
  const st = duel ? `🎃 ${S.duel[0].lit}:${S.duel[1].lit} · 🔗 ${S.duel[0].chain}:${S.duel[1].chain}` : `${S.kids ? t('kidsT') : t(S.diff)} · 🎃 ${RN.lit}/${TR.lanterns} · 🔗 ${RN.bestChain} · 🌕 ${RN.leaps}`;
  k.font = Fo(600, 34); txt(st, CW / 2, 1240, '#ffe08a'); k.font = Fo(600, 40); txt(t('cardTag'), CW / 2, 1288, '#ffd0a0'); k.font = Fo(400, 30); txt(t('credit') || CREDIT_TXT, CW / 2, 1330, 'rgba(255,255,255,.92)');
  window.__lpCard = { w: c.width, h: c.height }; return c; }
async function saveCard(share) { const c = await makeCard(); const blob = await new Promise(r => c.toBlob(r, 'image/png')); const file = new File([blob], 'my-lantern-prowl.png', { type: 'image/png' });
  if (share && navigator.canShare && navigator.canShare({ files: [file] })) { try { await navigator.share({ files: [file], text: `Lantern Prowl · ${t('cardTag')}` }); return; } catch (e) { if (e && e.name === 'AbortError') return; } }
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'my-lantern-prowl.png'; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1500); toast(t('saved')); }
// ---------------- simulation ----------------
let ambT = 3, crowT = 9, stepAcc = 0, smokeT = 0, thinkAcc = 0, emberAcc = 0;
function beds() { const sp = RN ? RN.v : 0; A.loop('wind', .07 + Math.min(.16, sp * .009) + (RN && RN.leap ? .18 : 0), .9 + Math.min(.3, sp * .015), 1); A.loop('night_loop', S.state === 'play' ? .06 : .1, 1, 1.5); }
function ambient(dt) { ambT -= dt; if (ambT <= 0) { ambT = 9 + rng() * 9; const r = rng(); if (r < .4) A.sfx.owl(); else if (r < .7) A.sfx.crow((rng() - .5) * 1.2); else A.sfx.howl(); } }
function step(dt) {
  dt = Math.max(0, Math.min(fin(dt), 1 / 20)); // never step backwards, never jump
  // slow motion through the Moonlight Leap (apex)
  if (RN && RN.leap) { const u = RN.leap.u; S.ts = u < .2 ? 1 : u < .42 ? lerp(1, .3, smooth((u - .2) / .22)) : u < .64 ? .3 : u < .88 ? lerp(.3, 1, smooth((u - .64) / .24)) : 1; } else S.ts = lerp(fin(S.ts, 1), 1, Math.min(1, dt * 4));
  S.ts = clamp(fin(S.ts, 1), .05, 1.5); const gdt = dt * S.ts; S.gt += gdt;
  for (let i = timers.length - 1; i >= 0; i--) if (timers[i] && timers[i].t <= S.gt) { const f = timers[i].f; timers.splice(i, 1); f(); }
  for (const k of ['flash', 'warm', 'festive', 'moonScale']) if (!Number.isFinite(W[k])) W[k] = k === 'festive' ? .12 : k === 'moonScale' ? 1 : 0; // NaN guards
  for (const k of ['punch', 'camBlend']) if (!Number.isFinite(S[k])) S[k] = 0;
  music.I = RN ? clamp(RN.chain / 15 + (RN.frenzy > 0 ? .5 : 0), 0, 1) : 0; music.step(S.gt); ambient(gdt); beds();
  if (S.state === 'intro') { S.introT += dt; if (RN.state === 'run' && S.titleT < 0 && RN.t > (RN.lastLand || 0) + 1.5 && RN.leaps > 0) { S.titleT = S.introT; A.sfx.title(); W.flash = .3; } if (S.titleT >= 0 && S.introT - S.titleT > 3.9) toMenu(); }
  const running = S.state === 'play' || S.state === 'intro' || S.state === 'menu';
  if (RN && running) {
    if (S.auto || S.state !== 'play') { thinkAcc += gdt; if (thinkAcc >= 1 / 30) { thinkAcc = 0; const a = autopilot(RN, { greedy: true }); if (a) RN.act(a); } }
    if (S.state === 'play' || RN.state !== 'dead' && RN.state !== 'win') RN.step(gdt);
    handleEvents();
    if (S.state !== 'play' && (RN.state === 'dead' || RN.state === 'win')) { newRun(true); TR.intro = false; }
    // paw steps + embers
    if (RN.state === 'run' && !RN.air) { stepAcc += gdt * (RN.v * .55); if (stepAcc > 1) { stepAcc = 0; A.sfx.step(RN.v, panX(RN.x)); } }
    emberAcc += gdt * (RN.frenzy > 0 ? 70 : 22); while (emberAcc > 1) { emberAcc--; sparks(F, C.tipWorld, 1, { colors: RN.pow.shadow > 0 ? ['#b06aff', '#ffd0ff'] : ['#ffb04a', '#ffe08a', '#ff7a2a'], speed: .5, vz: RN.v * .25, up: .6, life: .55, size: .07, grav: -.6 }); }
    smokeT -= gdt; if (smokeT <= 0) { smokeT = .5; const o = TR.obs.find(o => o.t === 'chim' && o.d > RN.d + 4 && o.d < RN.d + 45 && !o.hit); if (o) puff(F, _w.set(o.x, o.by + 3.2, -o.d), 1, '#5a5268', 1.2); const H = W.hs[Math.floor(rng() * W.hs.length)]; if (H.d > RN.d && H.d < RN.d + 70) puff(F, H.chim, 1, '#4a4258', 1.6); }
  }
  // ring + flock
  if (ring.visible) { const a = S.gt - S.ringT; const s = 2 + a * 70; ring.scale.set(s, s, s); ringM.opacity = Math.max(0, 1 - a / 1.6) * .9; const s2 = 1 + a * 40; ring2.scale.set(s2, s2, s2); ring2.material.opacity = Math.max(0, 1 - a / 1.3) * .6; if (a > 1.7) ring.visible = ring2.visible = false; }
  if (flock.count) { let alive = 0; const m = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(); for (let i = 0; i < flockN; i++) { const b = flockB[i]; if (b.life <= 0) { m.makeScale(0, 0, 0); flock.setMatrixAt(i, m); continue; } alive++; b.life -= gdt; b.p.addScaledVector(b.v, gdt); b.v.y += gdt * .5;
      q.setFromEuler(new THREE.Euler(0, Math.atan2(b.v.x, b.v.z), 0)); const f = .4 + .6 * Math.abs(Math.sin(S.gt * 16 + b.ph)); sc.set(.9 * f, .9, .9); m.compose(b.p, q, sc); flock.setMatrixAt(i, m); } flock.instanceMatrix.needsUpdate = true; if (!alive) flock.count = 0; }
  // the cat
  if (RN) { C.g.position.set(RN.x, RN.y, -RN.d); const lean = (RN.lane * LANE - RN.x); S.flashCat = Math.max(0, fin(S.flashCat) - gdt * 1.5);
    updateCat(C, { v: RN.v, air: RN.air || RN.state === 'leap' || RN.state === 'fall', vy: RN.vy, slide: RN.slideT > 0 && !RN.air ? 1 : 0, leap: RN.leap ? RN.leap.u : -1, lean: clamp(lean, -1, 1), t: S.gt, inv: RN.state === 'run' ? RN.inv : 0, frenzy: RN.frenzy > 0, flash: S.flashCat, spirit: RN.pow.shadow > 0 ? 1 : 0, look: 0 }, gdt);
    if (RN.pow.broom > 0) C.g.rotation.z = Math.sin(S.gt * 3) * .08; else C.g.rotation.z = 0;
    updateCamera(dt);
    syncProps(P, TR, RN.d, S.gt, gdt, { festive: W.festive }); lanternLights(P, TR, RN.d, W.lights, QUALITY[S.q].lights); }
  updateWorld(W, S.gt, gdt, QUALITY[S.q], camera, RN ? RN.d : 0); updateFX(F, gdt, VH * 1.5 * renderer.getPixelRatio()); P.glow.material.uniforms.scale.value = VH * .9 * renderer.getPixelRatio();
  bloom.strength = .55 * QUALITY[S.q].bloom * (1 + W.flash * .3); gradePass.uniforms.time.value = S.gt; gradePass.uniforms.flash.value = W.flash; gradePass.uniforms.warm.value = W.warm * .5 + (RN && RN.frenzy > 0 ? .25 : 0);
  W.warm = Math.max(0, W.warm - gdt * .2);
  updateOverlays(); if ((S.uiT = (S.uiT || 0) + dt) > .1) { S.uiT = 0; setUI(); } }
function render() { composer.render(); }
const fps = { n: 0, acc: 0, frames: 0, bad: 0, since: 0 };
function fpsTick(dt) { if (document.hidden) return; fps.since += dt; if (fps.since < 6 || dt > .25) return; fps.acc += dt; fps.frames++; // ignore the first 6 s (shader compile, decode): no false step-down at startup
  if (fps.acc >= 1) { const f = fps.frames / fps.acc; fps.acc = 0; fps.frames = 0; fps.n++; fps.bad = f < 32 ? fps.bad + 1 : 0; fps.last = f;
    if (!S.qUser && !window.__lpNoAutoQ && fps.bad >= 4 && S.q !== 'low') { const o = ['low', 'mid', 'high', 'ultra']; const nq = o[o.indexOf(S.q) - 1]; applyQuality(nq); toast(`${t('autoQ')} ${t('q_' + nq)} (${Math.round(f)} fps)`); fps.bad = 0; fps.since = 0; } } }
applyQuality(S.q); resize();
let last = performance.now();
function advance(now) { const dt = Math.max(0, (now - last) / 1000) || 0; last = Math.max(last, now || 0); if (!window.__lpManual) { step(dt); fpsTick(dt); } return dt; } // rAF stamps can be earlier than the last one: never run the clock backwards
function frameLoop(now) { advance(now); render(); requestAnimationFrame(frameLoop); }
if (window.__lpSkipIntro) { startIntro(); toMenu(); } else startIntro();
applyLang(); audioBadge();
step(0); requestAnimationFrame(frameLoop);
window.__lp = { S, W, C, P, F, step: (dt, n = 1) => { for (let i = 0; i < n; i++) step(dt); render(); }, stepq: (dt, n = 1) => { for (let i = 0; i < n; i++) step(dt); }, log: A.log, quality: q => q ? applyQuality(q, true) : S.q, renderer,
  start, end: endRun, toMenu, startIntro, endIntro, playNow, runner: () => RN, track: () => TR, act, auto: v => { S.auto = !!v; }, NIGHTS, prog, setUI, applyLang,
  card: saveCard, cardURL: async () => (await makeCard()).toDataURL('image/jpeg', .9), fps, fpsTick, advance, last: () => last, play: A.play, sfx: A.sfx, audioState: A.state,
  mem: () => ({ ...renderer.info.memory, programs: renderer.info.programs ? renderer.info.programs.length : 0 }),
  screen: (x, y, z) => { _sp.set(x, y, z).project(camera); return { x: (_sp.x * .5 + .5) * VW, y: (-_sp.y * .5 + .5) * VH, z: _sp.z }; }, cam: () => ({ p: camera.position.toArray(), fov: camera.fov }),
  fillMoon: () => { RN.meter = RN.D.cap; }, banner, rim: () => C.rimU.rimK.value, sparks: () => { let n = 0; for (let i = 0; i < F.life.length; i++) if (F.life[i] > 0) n++; return n; },
  _dbg: { scene, camera, composer, bloom, THREE } };
document.body.classList.add('ready');
