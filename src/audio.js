// WebAudio for the embedded CC0 recordings (window.LP_SOUNDS): soft paw steps, swishes, a real cat's meow and purr, roof-tile
// knocks, fire whooshes for every lantern that ignites, chimes and harp for wisps, bats, crows, owls, bells, choir, fireworks, booms,
// wind, and a real pipe organ, pizzicato, harp, contrabass and timpani (VSCO 2 CE). Nothing is synthesized: pitched
// instruments re-pitch the nearest recorded note; the rooftop echo is a generated convolution reverb (processing only).
// Every sound (and every loop level change) is logged so tests and the video mix can replay it exactly.
let ctx = null, master = null, dry = null, conv = null, bufs = {}, ready = false, muted = false; const loops = {};
export const log = [];
let clock = () => 0;
export function setClock(f) { clock = f; }
function b64(s) { const bin = atob(s), u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); return u.buffer; }
export const INS = {
  org: Object.fromEntries([48, 51, 54, 57, 60, 63, 66, 69, 72, 75].map(m => [m, m])),
  ped: Object.fromEntries([24, 27, 30, 33, 36, 39, 42].map(m => [m, m])),
  pz: { D3: 50, A3: 57, C4: 60, E4: 64, G4: 67, D5: 74 },
  cb: { E1: 28, Fs1: 30, A1: 33, Cs2: 37, E2: 40 },
  hp: { D4: 62, A4: 69 }
};
const SORTED = Object.fromEntries(Object.entries(INS).map(([k, v]) => [k, Object.entries(v).sort((a, b) => a[1] - b[1])]));
export function sampleFor(ins, m) { const L = SORTED[ins]; let best = L[0]; for (const e of L) if (Math.abs(e[1] - m) < Math.abs(best[1] - m)) best = e; return { n: ins + '_' + best[0], r: Math.pow(2, (m - best[1]) / 12) }; }
function makeIR(sec = 3.2) { const sr = ctx.sampleRate, n = Math.floor(sr * sec), ir = ctx.createBuffer(2, n, sr); let seed = 11;
  const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647 * 2 - 1; };
  for (let c = 0; c < 2; c++) { const d = ir.getChannelData(c); let lp = 0; for (let i = 0; i < n; i++) { const t = i / sr; lp += (rnd() - lp) * (.5 - .38 * t / sec); d[i] = lp * Math.exp(-t * 1.9) * (i < sr * .02 ? i / (sr * .02) : 1); } } return ir; }
function kick() { try { const b = ctx.createBuffer(1, 1, 22050), s = ctx.createBufferSource(); s.buffer = b; s.connect(ctx.destination); s.start(0); } catch (e) {} } // a silent sample inside the gesture unlocks iOS Safari
export function state() { return ctx ? ctx.state : 'none'; }
export function isReady() { return ready; }
export async function unlock() {
  if (ctx) { if (ctx.state !== 'running') { const r = ctx.resume(); if (r && r.catch) r.catch(() => {}); kick(); } return; }
  const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
  try { if (navigator.audioSession) navigator.audioSession.type = 'playback'; } catch (e) {} // iOS 17+: play even with the ring/silent switch on silent
  ctx = new AC(); master = ctx.createGain(); master.gain.value = muted ? 0 : .9; if (ctx.state !== 'running') { const r = ctx.resume(); if (r && r.catch) r.catch(() => {}); } kick();
  const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -16; comp.ratio.value = 3; comp.attack.value = .004; comp.release.value = .2; master.connect(comp); comp.connect(ctx.destination);
  dry = ctx.createGain(); dry.connect(master); conv = ctx.createConvolver(); conv.buffer = makeIR(); const wet = ctx.createGain(); wet.gain.value = .32; conv.connect(wet); wet.connect(master);
  const src = window.LP_SOUNDS || {};
  // base64 → bytes is synchronous: do it a few sounds per tick so the first tap never freezes a frame (beds and loops first)
  const keys = Object.keys(src).sort((a, b) => (b.endsWith('_loop') || b === 'wind' || b === 'night_loop') - (a.endsWith('_loop') || a === 'wind')); const jobs = [];
  for (let i = 0; i < keys.length; i += 4) { for (const k of keys.slice(i, i + 4)) jobs.push(new Promise(res => { try { ctx.decodeAudioData(b64(src[k]), b => { bufs[k] = b; res(); }, () => res()); } catch (e) { res(); } })); await new Promise(r => setTimeout(r, 0)); }
  await Promise.all(jobs);
  ready = true; window.__lpAudioReady = Object.keys(bufs).length; for (const k in loops) startLoop(k);
}
export function play(n, vol = 1, rate = 1, delay = 0, rev = .4, dur = 0, pan = 0) {
  if (!Number.isFinite(vol)) vol = 0; if (!Number.isFinite(rate) || rate <= 0) rate = 1; if (!Number.isFinite(delay)) delay = 0; if (!Number.isFinite(rev)) rev = 0; if (!Number.isFinite(dur)) dur = 0; if (!Number.isFinite(pan)) pan = 0;
  delay = Math.max(0, delay); log.push({ n, t: clock() + delay, v: vol, r: rate, rv: rev, d: dur, p: pan });
  if (log.length > 8000) log.splice(0, 1500);
  if (!ready || !bufs[n] || !(vol > 0)) return null;
  const s = ctx.createBufferSource(); s.buffer = bufs[n]; s.playbackRate.value = rate;
  const g = ctx.createGain(); g.gain.value = vol; s.connect(g); let out = g;
  if (pan && ctx.createStereoPanner) { const p = ctx.createStereoPanner(); p.pan.value = Math.max(-1, Math.min(1, pan)); g.connect(p); out = p; }
  out.connect(dry); if (rev > 0) { const sg = ctx.createGain(); sg.gain.value = rev; out.connect(sg); sg.connect(conv); }
  const t0 = ctx.currentTime + delay; s.start(t0);
  if (dur > 0) { g.gain.setValueAtTime(vol, t0 + dur); g.gain.exponentialRampToValueAtTime(.0008, t0 + dur + .4); s.stop(t0 + dur + .45); }
  return s;
}
export function note(ins, m, vol = .7, dur = 0, delay = 0, rev = .4, pan = 0) { const { n, r } = sampleFor(ins, m); return play(n, vol, r, delay, rev, dur, pan); }
// looping beds (rain, coil buzz, bubbling, mob): level/rate changes are logged as '~name'
function startLoop(k) { const L = loops[k]; if (!ready || L.src || !bufs[k]) return; L.g = ctx.createGain(); L.g.gain.value = L.v; L.src = ctx.createBufferSource(); L.src.buffer = bufs[k]; L.src.loop = true; L.src.playbackRate.value = L.r; L.src.connect(L.g); L.g.connect(dry); const sg = ctx.createGain(); sg.gain.value = .25; L.g.connect(sg); sg.connect(conv); L.src.start(); }
export function loop(k, v, r = 1, fade = .4) {
  if (!Number.isFinite(v)) v = 0; if (!Number.isFinite(r) || r <= 0) r = 1; if (!Number.isFinite(fade)) fade = .4;
  const L = loops[k] || (loops[k] = { v: 0, r: 1 }); if (Math.abs(L.v - v) < .004 && Math.abs(L.r - r) < .004) return; L.v = v; L.r = r;
  log.push({ n: '~' + k, t: clock(), v, r, f: fade }); startLoop(k);
  if (L.g) { const t = ctx.currentTime; L.g.gain.cancelScheduledValues(t); L.g.gain.setValueAtTime(L.g.gain.value, t); L.g.gain.linearRampToValueAtTime(v, t + fade); L.src.playbackRate.setTargetAtTime(r, t, .15); }
}
export function setMuted(m) { muted = m; if (master) master.gain.value = m ? 0 : .9; }
export function isMuted() { return muted; }
const R = Math.random, rr = a => a[Math.floor(R() * a.length)], jit = (k = .06) => 1 + (R() - .5) * 2 * k;
const PENTA = [50, 53, 55, 57, 60, 62, 65, 67, 69, 72, 74, 77, 79, 81, 84];
let stepN = 0;
export const sfx = {
  ui() { play('knock', .22, 1.0, 0, .15); },
  step(v, pan = 0) { stepN++; play(['step_soft_L1', 'step_soft_R1', 'step_soft_L2'][stepN % 3], .1 + Math.min(.08, v * .004), .95 * jit(.08), 0, .12, 0, pan); },
  jump(pan = 0) { play('swish_a', .3, 1.05 * jit(), 0, .2, 0, pan); play('step_soft_L2', .2, .8, 0, .1, 0, pan); },
  djump(pan = 0) { play('swish_b', .34, 1.15 * jit(), 0, .25, 0, pan); play('wing', .22, 1.2, 0, .3, 0, pan); play('chime_b', .12, 1.1, .02, .5, 0, pan); },
  land(k, pan = 0) { play('thud_a', Math.min(.45, .12 + k * .03), .95 * jit(.08), 0, .15, 0, pan); play('step_soft_R1', .2, .85, 0, .1, 0, pan); if (k > 9) play('stone_1', .18, .9, 0, .2, 0, pan); },
  slide(pan = 0) { play('swoosh_rise', .2, 1.25, 0, .2, 0, pan); play('gravel_1', .22, 1.1 * jit(), 0, .15, .5, pan); },
  lane(dir) { play('whoosh', .12, 1.25 * jit(), 0, .15, 0, dir * .4); },
  lantern(chain, pan = 0) { const i = Math.min(PENTA.length - 1, 2 + (chain % 10)); play('fwoosh', .34, 1.1 * jit(.08), 0, .3, 0, pan); note('pz', PENTA[i], .22, 0, .01, .5, pan); note('hp', PENTA[i] + 12, .16, 0, .04, .6, pan);
    if (chain % 5 === 0 && chain > 0) { play('chime_a', .3, 1, .03, .6); play('bell_strike', .2, 1.1, .05, .6); } },
  wisp(pan = 0) { play(rr(['chime_a', 'chime_b', 'chime_c']), .12, 1.05 * jit(.1), 0, .5, 0, pan); },
  near() { play('swish_b', .32, .9, 0, .3); play('chime_c', .18, 1.15, .03, .5); },
  hit(pan = 0) { play('impact', .55, .9 * jit(), 0, .35, 0, pan); play('crumble', .35, 1, .02, .4, 0, pan); play('meow', .38, .92, .05, .35, 0, pan); },
  bonk(pan = 0) { play('thump', .35, 1.1, 0, .3, 0, pan); play('laugh_kids', .2, 1, .1, .5, 0, pan); },
  smash(t, pan = 0) { if (t === 'chim' || t === 'low') { play('stone_2', .45, .9 * jit(), 0, .35, 0, pan); play('crumble', .35, 1, .02, .35, 0, pan); } else if (t === 'bats') play('bats', .35, 1.1, 0, .4, 0, pan); else play('whoosh', .3, .8, 0, .3, 0, pan); },
  fall() { play('swoosh_rise', .3, .6, 0, .5); play('meow', .32, .82, .05, .5); play('body_fall', .3, .9, .6, .4); },
  respawn() { play('magic', .32, 1.1, 0, .5); play('chime_a', .2, .9, .05, .6); },
  power(k) { play('magic', .4, 1, 0, .5); play('harp', .3, 1, .03, .6); if (k === 'broom') play('fwoosh', .35, .8, 0, .4); if (k === 'shadow') play('ghosts', .3, 1.1, 0, .6, 1.2); if (k === 'magnet') play('glissup', .25, 1.1, 0, .5); },
  ready() { play('riser', .45, 1, 0, .5); play('choir_ah', .3, 1, .1, .7); play('bell_far', .3, 1, 0, .6); },
  bats(pan = 0) { play('bats', .2, 1 * jit(), 0, .4, 0, pan); },
  crow(pan = 0) { play('crow', .2, .95 * jit(), 0, .6, 0, pan); }, owl() { play('owl', .16, 1, 0, .6, 0, (R() - .5) * 1.4); }, howl() { play('howl', .12, 1, 0, .7, 0, (R() - .5) * 1.2); },
  leap() { play('swoosh_rise', .55, .7, 0, .5); play('riser', .4, .9, 0, .5); play('wind', .3, 1.2, 0, .4, 2.5); },
  ignite() { play('boom_cine', .95, .95, 0, .5); play('sub', .8, 1, 0, .2); play('bell_deep', .7, 1, 0, .7); play('meow', .55, .72, .04, .6); play('fwoosh', .6, .7, 0, .5); play('fw_burst', .5, .85, .25, .55); play('fw_burst_b', .45, .8, .7, .55);
    play('fw_crackle', .35, 1, 1.1, .5); play('bat_swarm', .4, 1, .15, .5); play('choir_swell', .55, 1, .05, .7); [26, 38].forEach((m, i) => note('ped', m, .5, 3.5, i * .02, .7)); [50, 57, 62, 65, 69].forEach((m, i) => note('org', m, .22, 3.2, .04 + i * .02, .7)); play('gong', .3, .8, .05, .7); },
  bigLand() { play('thump_b', .6, .8, 0, .35); play('hit_dram', .45, 1, 0, .4); play('purr', .3, 1, .2, .4); },
  frenzy() { play('fw_crackle', .3, 1.1, 0, .5); play('cheer', .18, 1, .1, .5, 2); },
  win() { play('success', .45, .95, 0, .5); play('choir_ah', .35, 1, .1, .7); play('bell_strike', .35, .95, 0, .6); play('bell_deep', .4, 1, .2, .7); play('purr', .35, 1, .5, .4); },
  star(i) { play('bell_strike', .42, [.9, 1, 1.12][i] || 1, 0, .6); play('harp', .25, [.9, 1, 1.12][i] || 1, .02, .6); },
  fail() { play('meow', .4, .78, 0, .55); [50, 53, 56].forEach((m, i) => note('org', m, .2, 2, i * .04, .7)); note('ped', 26, .4, 2.4, 0, .7); play('thunder_soft', .3, 1, .1, .6); },
  turn() { play('bell_far', .38, 1, 0, .6); },
  intro() { play('wind', .25, 1, 0, .4, 4); play('swoosh_rise', .4, .7, 0, .5); },
  title() { play('boom_cine', .9, .9, 0, .5); play('hit_dram', .6, .85, 0, .5); [26, 38].forEach((m, i) => note('ped', m, .5, 3, i * .02, .7)); [50, 57, 62, 65].forEach((m, i) => note('org', m, .24, 3, .03 + i * .02, .7)); play('choir_swell', .5, 1, 0, .7); play('meow', .3, .85, .4, .6); }
};
