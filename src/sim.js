// Lantern Prowl – the pure, deterministic rules (no three.js, runs in node for tests and the bot):
// route generator (houses, gaps, chimneys, gargoyles, ghost-sheet laundry, bat swarms, lanterns, wisps, power-ups, the Moonlight arch),
// the cat's physics (lanes, jump + double jump with coyote time and a jump buffer, slide, falls, step-ups), collisions, near misses,
// scoring (Lantern Chain multiplier, Lantern Frenzy) and an autopilot that plays perfectly (intro, video, tests, GPU playtest).
// Distances are metres along the run (d grows forward; world z = -d).
export const LANE = 1.5;
export const GRAV = 24, JUMP_V = 7.6, DJUMP_V = 6.9, SLIDE_T = .62, COYOTE = .12, BUFFER = .15, H_CAT = .78, H_SLIDE = .36, CAT_HALF = .34;
export const LAUNCH_GAP = 27, LEAP_T = 2.6, LEAP_H = 9.5;
export const DIFF = {
  easy: { speed: .86, lives: 5, dens: .72, cap: 8, frenzy: 7, longK: .5 },
  medium: { speed: 1, lives: 3, dens: 1, cap: 10, frenzy: 6, longK: 1 },
  hard: { speed: 1.13, lives: 2, dens: 1.28, cap: 12, frenzy: 5, longK: 1.4 },
  kids: { speed: .74, lives: Infinity, dens: .5, cap: 6, frenzy: 8, longK: 0, kids: true } };
// 10 nights: length, base speed, gap range, share of long gaps (double jump), share of step-ups, hazard mix, power-up rate
export const NIGHTS = [
  { id: 'first_prowl', len: 460, v: 10, gaps: [2.4, 3.4], long: 0, steps: 0, mix: { chim: 1, low: .7, line: .2, bats: 0 }, pow: .2 },
  { id: 'chimney_row', len: 540, v: 10.5, gaps: [2.6, 3.8], long: 0, steps: .15, mix: { chim: 1.5, low: .6, line: .4, bats: .15 }, pow: .35 },
  { id: 'laundry_lane', len: 600, v: 11, gaps: [2.8, 4.2], long: .08, steps: .2, mix: { chim: 1, low: .6, line: 1.1, bats: .3 }, pow: .4 },
  { id: 'bat_belfry', len: 660, v: 11.4, gaps: [3, 4.4], long: .12, steps: .2, mix: { chim: 1, low: .7, line: .6, bats: 1.1 }, pow: .45 },
  { id: 'gargoyle_gutters', len: 720, v: 11.8, gaps: [3, 4.6], long: .15, steps: .25, mix: { chim: .9, low: 1.4, line: .6, bats: .6 }, pow: .45 },
  { id: 'crooked_roofs', len: 780, v: 12.1, gaps: [3.2, 4.8], long: .2, steps: .5, mix: { chim: 1.1, low: .8, line: .8, bats: .7 }, pow: .5 },
  { id: 'witch_quarter', len: 840, v: 12.4, gaps: [3.2, 5], long: .22, steps: .3, mix: { chim: 1.2, low: 1, line: 1, bats: 1 }, pow: .55 },
  { id: 'foggy_spires', len: 900, v: 12.7, gaps: [3.4, 5], long: .26, steps: .35, mix: { chim: 1.3, low: 1, line: 1, bats: 1.1 }, pow: .55 },
  { id: 'long_leaps', len: 960, v: 13, gaps: [3.6, 5.2], long: .4, steps: .35, mix: { chim: 1.2, low: 1.1, line: 1, bats: 1 }, pow: .6 },
  { id: 'midnight_tower', len: 1040, v: 13.3, gaps: [3.6, 5.4], long: .35, steps: .4, mix: { chim: 1.4, low: 1.2, line: 1.2, bats: 1.2 }, pow: .6 } ];
export const ENDLESS = { id: 'endless', len: Infinity, v: 10.6, gaps: [2.6, 4.2], long: .1, steps: .25, mix: { chim: 1.1, low: .9, line: .8, bats: .7 }, pow: .5 };
export const DUEL_NIGHT = 2; // the duel route = night 3, same seed for both players
export function makeRng(seed) { let s = (seed >>> 0) || 1; return () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const clamp = (v, a, b) => Math.max(a, Math.min(b, v)), fin = (v, d = 0) => Number.isFinite(v) ? v : d;
export const OBS = { chim: { len: 1.1, w: .62, y0: 0, y1: 2.9 }, low: { len: .8, w: .56, y0: 0, y1: .72 }, line: { len: .3, w: 2.7, y0: .55, y1: 2.6 }, bats: { len: 1.2, w: .62, y0: .5, y1: 1.95 } };

export class Track {
  constructor({ night = NIGHTS[0], diff = 'medium', seed = 1, intro = false } = {}) {
    this.N = night; this.D = DIFF[diff] || DIFF.medium; this.r = makeRng(seed); this.blds = []; this.obs = []; this.picks = []; this.nid = 1;
    this.goalD = Number.isFinite(night.len) ? night.len : Infinity; this.finishD = Infinity; this.wantLaunch = false; this.ended = false; this.lanterns = 0; this.intro = intro;
    if (intro) { // the opening: the cat is already in the air over the town square, mid Moonlight Leap
      this.blds.push({ id: this.nid++, d0: -60, d1: -LAUNCH_GAP, y: 0, kind: 'launch', arch: true, style: 0 });
      const b = { id: this.nid++, d0: 0, d1: 34, y: 0, kind: 'land', style: 1 }; this.blds.push(b); this.fill(b, 6);
    } else { const b = { id: this.nid++, d0: -30, d1: 36 + this.r() * 8, y: 0, kind: 'roof', style: 0 }; this.blds.push(b); this.fill(b, 20); }
  }
  get last() { return this.blds[this.blds.length - 1]; }
  requestLaunch(d = -Infinity) { if (this.wantLaunch || this.blds.some(b => b.kind === 'launch' && b.arch && !b.used)) return;
    // re-route the far part of the route so the Moonlight arch comes within a few seconds (it lies beyond the fog line)
    const keep = this.blds.filter(b => b.d0 <= d + 34);
    if (keep.length && keep.length < this.blds.length && keep[keep.length - 1].d1 + LAUNCH_GAP + 64 < this.goalD) {
      const lim = keep[keep.length - 1].d1; this.blds = keep;
      this.obs = this.obs.filter(o => o.d <= lim); this.picks = this.picks.filter(p => { const k = p.d <= lim; if (!k && p.t === 'lantern' && !p.got) this.lanterns--; return k; });
      this.ended = false; this.finishD = Infinity; }
    if (this.last.d1 + LAUNCH_GAP + 64 < this.goalD) this.wantLaunch = true; }
  gen(until) { let n = 0; while (!this.ended && this.last.d1 < until && n++ < 40) this.gen1(); }
  gen1() {
    const N = this.N, r = this.r, prev = this.last, D = this.D;
    let gap = N.gaps[0] + (N.gaps[1] - N.gaps[0]) * r(); if (r() < N.long * D.longK) gap = 6.6 + r() * 1.8;
    if (prev.kind === 'launch') gap = LAUNCH_GAP;
    const d0 = prev.d1 + gap; let y = prev.y;
    if (prev.kind !== 'launch' && r() < N.steps) y = clamp(prev.y + (r() < .55 ? .5 : -.5), 0, 1);
    if (gap > 6) y = Math.min(y, prev.y); // never a step-up after a long gap
    const style = Math.floor(r() * 6);
    if (d0 >= this.goalD) { // the clock-tower roof: finish gate, no hazards, end of the route
      const b = { id: this.nid++, d0, d1: d0 + 40, y, kind: 'goal', style: 9 }; this.blds.push(b); this.finishD = d0 + 12; this.ended = true;
      for (let k = 0; k < 3; k++) this.addPick('lantern', d0 + 4 + k * 2.5, [-1, 0, 1][k] * LANE, 0, y); return b; }
    if (this.wantLaunch) { // the Moonlight arch at the roof edge over the town square
      this.wantLaunch = false; const b = { id: this.nid++, d0, d1: d0 + 30, y, kind: 'launch', arch: true, style }; this.blds.push(b);
      for (let k = 0; k < 6; k++) this.addPick('lantern', d0 + 5 + k * 3.6, [0, -1, 1, 0, -1, 1][k] * LANE, 0, y);
      for (let k = 0; k < 7; k++) this.addPick('wisp', b.d1 - 9 + k * 1.2, 0, .9 + k * .18, y);
      const L = { id: this.nid++, d0: b.d1 + LAUNCH_GAP, d1: b.d1 + LAUNCH_GAP + 34, y: 0, kind: 'land', style: (style + 2) % 6 }; this.blds.push(L); this.fill(L, 14); return b; }
    const len = 18 + r() * 24 * (N.v > 12 ? .85 : 1);
    const b = { id: this.nid++, d0, d1: d0 + len, y, kind: 'roof', style, bridge: !!D.kids && gap < 6 }; this.blds.push(b);
    if (gap > 5) this.arcWisps(prev.d1, d0, prev.y, y, 0);
    this.fill(b, 5); return b;
  }
  addObs(t, d, x, by) { const o = { id: this.nid++, t, d, x, by, ...OBS[t], hit: false, done: false }; this.obs.push(o); return o; }
  addPick(t, d, x, y, by) { const p = { id: this.nid++, t, d, x, y, by, got: false }; this.picks.push(p); if (t === 'lantern') this.lanterns++; return p; }
  arcWisps(a, b, ya, yb, x) { const n = 6; for (let k = 1; k < n; k++) { const u = k / n; this.addPick('wisp', a + (b - a) * u - .3, x, .8 + (ya + (yb - ya) * u - Math.min(ya, yb)) + 1.5 * 4 * u * (1 - u), Math.min(ya, yb)); } }
  fill(b, safe) {
    const N = this.N, r = this.r, D = this.D, dens = D.dens, v = N.v * D.speed;
    const minS = Math.max(7.2, v * .78); let d = b.d0 + safe; const end = b.d1 - 4.5;
    const W = Object.entries(N.mix).map(([k, w]) => [k, w * dens]); W.push(['free', .75 / dens]);
    const tot = W.reduce((a, e) => a + e[1], 0); let lastLantern = b.d0 + safe - 6, slot = 0;
    while (d < end) {
      let q = r() * tot, kind = 'free'; for (const [k, w] of W) { if ((q -= w) <= 0) { kind = k; break; } }
      if (slot === 0 && safe < 8) kind = 'free';
      const lanes = [-1, 0, 1]; for (let i = 2; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [lanes[i], lanes[j]] = [lanes[j], lanes[i]]; }
      let blocked = [];
      if (kind === 'chim') { const n = r() < .4 * dens ? 2 : 1; blocked = lanes.slice(0, n); for (const l of blocked) this.addObs('chim', d, l * LANE, b.y); }
      else if (kind === 'low') { const n = r() < .22 * dens ? 3 : r() < .5 ? 2 : 1; blocked = lanes.slice(0, n); for (const l of blocked) this.addObs('low', d, l * LANE, b.y); if (n < 3 && r() < .5) this.arcWisps(d - 3, d + 3.6, b.y, b.y, blocked[0] * LANE); }
      else if (kind === 'line') { this.addObs('line', d, 0, b.y); blocked = [-1, 0, 1]; }
      else if (kind === 'bats') { const n = r() < .35 * dens ? 2 : 1; blocked = lanes.slice(0, n); for (const l of blocked) this.addObs('bats', d, l * LANE, b.y); }
      const free = [-1, 0, 1].filter(l => !blocked.includes(l) || kind === 'line' || kind === 'low');
      // lanterns: one every ~6–9 m in a lane that is free there; wisps in short lines
      const ld = d + minS * .5; if (ld < end + 2 && ld - lastLantern > 5.5) { const l = free[Math.floor(r() * free.length)] ?? 0; if (!this.blockedAt(ld, l)) { this.addPick('lantern', ld, l * LANE, 0, b.y); lastLantern = ld; } }
      if (kind === 'free' && r() < .7) { const l = lanes[0]; for (let k = 0; k < 5; k++) this.addPick('wisp', d + k * 1.4, l * LANE, .7, b.y); }
      if (r() < N.pow * .14 && kind !== 'line') { const l = free[0] ?? 0, P = ['magnet', 'shadow', 'broom'][Math.floor(r() * 3)]; if (!this.blockedAt(d + 3, l)) this.addPick(P, d + 3, l * LANE, .75, b.y); }
      d += minS * (.95 + r() * .75) / Math.sqrt(dens); slot++;
    }
    // last metres before the edge: a lantern or two to lure the jump
    if (b.d1 - lastLantern > 6 && b.d1 - b.d0 > 12) { const l = [-1, 0, 1][Math.floor(r() * 3)]; if (!this.blockedAt(b.d1 - 2.2, l)) this.addPick('lantern', b.d1 - 2.2, l * LANE, 0, b.y); }
  }
  blockedAt(d, lane) { return this.obs.some(o => Math.abs(o.d + o.len / 2 - d) < 1.6 && Math.abs(o.x - lane * LANE) < o.w + .3); }
  bAt(d) { for (let i = this.blds.length - 1; i >= 0; i--) { const b = this.blds[i]; if (d >= b.d0 && d <= b.d1) return b; if (b.d1 < d - 80) break; } return null; }
  next(d) { for (const b of this.blds) if (b.d0 > d) return b; return null; }
  prev(d) { let p = null; for (const b of this.blds) { if (b.d1 <= d) p = b; else break; } return p; }
  prune(d) { // drop what is far behind the cat (ids stay unique)
    const keep = d - 40; this.blds = this.blds.filter(b => b.d1 > keep || b === this.last); this.obs = this.obs.filter(o => o.d > keep); this.picks = this.picks.filter(p => p.d > keep); }
}

export class Runner {
  constructor(track, diff = 'medium', opt = {}) {
    this.T = track; this.D = DIFF[diff] || DIFF.medium; this.kids = !!this.D.kids; this.d = opt.d ?? 0; this.x = 0; this.lane = 0; this.y = 0; this.vy = 0; this.air = false; this.dj = false;
    this.slideT = 0; this.coy = 0; this.buf = 0; this.sbuf = 0; this.v = 0; this.lives = this.D.lives; this.inv = 0; this.state = 'run'; this.t = 0; this.fallT = 0;
    this.score = 0; this.dist = 0; this.chain = 0; this.bestChain = 0; this.meter = 0; this.lit = 0; this.wisps = 0; this.nears = 0; this.hits = 0; this.falls = 0; this.leaps = 0; this.smash = 0;
    this.frenzy = 0; this.pow = { broom: 0, magnet: 0, shadow: 0 }; this.ev = []; this.leap = null; this.ignited = false; this.endless = !Number.isFinite(track.N.len); this.lastLand = 0; this.flyY = 0;
    if (track.intro) this.startLeap(track.blds[0], .3);
  }
  get mult() { return Math.min(5, 1 + Math.floor(this.chain / 5)) * (this.frenzy > 0 ? 2 : 1); }
  get speed() { const N = this.T.N; const k = this.endless ? 1 + Math.min(.5, this.d / 3000) : 1 + .14 * clamp(this.d / Math.max(1, N.len), 0, 1); return N.v * this.D.speed * k * (this.frenzy > 0 ? 1.1 : 1) * (this.pow.broom > 0 ? 1.08 : 1); }
  act(a) { if (this.state !== 'run') return;
    if (a === 'left') this.lane = Math.max(-1, this.lane - 1); else if (a === 'right') this.lane = Math.min(1, this.lane + 1);
    else if (a === 'jump') this.buf = BUFFER; else if (a === 'slide') { if (this.air && this.pow.broom <= 0) { this.vy = Math.min(this.vy, -11); this.sbuf = BUFFER * 2; } else this.sbuf = BUFFER; } }
  emit(t, o = {}) { this.ev.push({ t, at: this.t, d: this.d, x: this.x, y: this.y, ...o }); }
  add(pts) { this.score += Math.round(pts); }
  startLeap(b, u0 = 0) { const L = this.T.next(b.d1 - .01) || { d0: b.d1 + LAUNCH_GAP, y: 0 }; b.used = true;
    this.leap = { d0: b.d1 - .9, d1: L.d0 + 3.5, y0: b.y, y1: L.y, u: u0, x0: this.x }; this.state = 'leap'; this.ignited = u0 >= .5; this.air = true; this.slideT = 0; this.meter = 0; this.T.wantLaunch = false;
    if (u0 > 0) { const P = this.leapPos(u0); this.d = P.d; this.y = P.y; }
    this.emit('leap', { u0 }); }
  leapPos(u) { const L = this.leap; return { d: L.d0 + (L.d1 - L.d0) * u, y: L.y0 + (L.y1 - L.y0) * u + LEAP_H * 4 * u * (1 - u) }; }
  step(dt) {
    dt = clamp(fin(dt), 0, 1 / 20); let n = Math.ceil(dt / (1 / 120)); const h = n ? dt / n : 0;
    for (let i = 0; i < n; i++) this.sub(h);
    for (const k of ['d', 'x', 'y', 'vy', 'meter', 'score']) if (!Number.isFinite(this[k])) this[k] = 0; // NaN guards
  }
  sub(dt) {
    this.t += dt; const T = this.T; this.inv = Math.max(0, this.inv - dt); this.frenzy = Math.max(0, this.frenzy - dt); for (const k in this.pow) this.pow[k] = Math.max(0, this.pow[k] - dt);
    if (this.state === 'dead' || this.state === 'win') return;
    T.gen(this.d + 70);
    if (this.state === 'leap') { const L = this.leap; L.u = Math.min(1, L.u + dt / LEAP_T); const P = this.leapPos(L.u); this.d = P.d; this.y = P.y; this.x += (0 - this.x) * Math.min(1, dt * 3); this.lane = 0;
      this.v = (L.d1 - L.d0) / LEAP_T; if (!this.ignited && L.u >= .5) { this.ignited = true; this.emit('ignite'); }
      this.collect(dt); if (L.u >= 1) { this.state = 'run'; this.air = false; this.vy = 0; this.y = L.y1; this.leaps++; this.frenzy = this.D.frenzy; this.leap = null; this.lastLand = this.t; this.emit('land', { vy: -9, big: true }); this.emit('frenzy'); }
      return; }
    if (this.state === 'fall') { this.fallT += dt; this.vy -= GRAV * dt; this.y += this.vy * dt; this.d += this.v * .35 * dt;
      if (this.fallT > .85) this.respawn(); return; }
    const v = this.v = this.speed, pd = this.d, py = this.y;
    // lanes
    const tx = this.lane * LANE, dx = tx - this.x; this.x += Math.sign(dx) * Math.min(Math.abs(dx), dt * 10.5);
    this.buf = Math.max(0, this.buf - dt); this.coy = Math.max(0, this.coy - dt); this.slideT = Math.max(0, this.slideT - dt);
    this.d += v * dt; if (this.endless || !Number.isFinite(T.N.len)) { } this.dist += v * dt; if (this.dist >= 1) { const k = Math.floor(this.dist); this.dist -= k; this.add(k); }
    const b = T.bAt(this.d);
    if (this.pow.broom > 0) { // flying on the broom: above everything, nothing can hit or drop the cat
      const ref = (b || T.next(this.d) || { y: 0 }).y; this.flyY += (ref + 2.9 - this.flyY) * Math.min(1, dt * 4); this.y += (this.flyY - this.y) * Math.min(1, dt * 6); this.vy = 0; this.air = true; this.dj = false;
      if (this.pow.broom <= dt * 1.5) { this.air = true; this.vy = 0; }
    } else {
      // jump / double jump
      if (this.buf > 0) { if (!this.air || this.coy > 0) { this.vy = JUMP_V; this.air = true; this.coy = 0; this.buf = 0; this.slideT = 0; this.emit('jump'); } else if (!this.dj) { this.vy = DJUMP_V; this.dj = true; this.buf = 0; this.emit('djump'); } }
      if (this.sbuf > 0) { this.sbuf = Math.max(0, this.sbuf - dt); if (!this.air) { this.slideT = SLIDE_T; this.sbuf = 0; this.emit('slide'); } }
      if (!this.air) { if (!b) { this.air = true; this.vy = 0; this.coy = COYOTE; } else this.y = b.y; }
      if (this.kids && !this.air && b && this.d + v * .1 > b.d1) { const nb = T.next(this.d); if (nb) { this.vy = JUMP_V; this.air = true; this.emit('jump', { auto: true }); } }
      if (this.air) {
        this.vy -= GRAV * dt; this.y += this.vy * dt;
        if (this.kids && !this.dj && this.vy < 0 && !b) { const nb = T.next(this.d); if (nb && (nb.d0 - this.d) > this.vy * -.0 + v * .25 && this.y < nb.y + 1.2) { this.vy = DJUMP_V; this.dj = true; this.emit('djump', { auto: true }); } }
        if (b && this.vy <= 0 && this.y <= b.y) {
          if (py >= b.y - .3 || pd >= b.d0) { const imp = this.vy; this.y = b.y; this.vy = 0; this.air = false; this.dj = false; if (this.sbuf > 0) { this.slideT = SLIDE_T; this.sbuf = 0; this.emit('slide'); } this.emit('land', { vy: imp }); }
          else { this.y = b.y; this.vy = 0; this.air = false; this.dj = false; this.hit({ t: 'wall', id: -b.id }); } // ran into a higher roof's wall → hoisted up, costs a life
        }
        if (!b) { const nb = T.next(this.d), pb = T.prev(this.d); const floor = Math.min(nb ? nb.y : 0, pb ? pb.y : 0) - 1.1;
          if (this.y < floor) { if (this.kids) { this.respawn(true); return; } this.state = 'fall'; this.fallT = 0; this.chain = 0; this.falls++; this.emit('fall'); return; } }
      }
    }
    // obstacles
    const top = (this.slideT > 0 && !this.air ? H_SLIDE : H_CAT);
    for (const o of T.obs) {
      if (o.done) continue; if (o.d > this.d + CAT_HALF) break;
      const inD = this.d + CAT_HALF > o.d && this.d - CAT_HALF < o.d + o.len;
      if (inD && !o.hit) { const bot = this.y - o.by; const xo = Math.abs(this.x - o.x) < o.w + .26; const yo = bot < o.y1 && bot + top > o.y0;
        if (xo && yo) { if (this.pow.shadow > 0 || this.frenzy > 0 || this.pow.broom > 0) { o.hit = true; this.smash++; this.add(20 * this.mult); this.emit('smash', { o: o.id, ot: o.t }); } else if (this.inv <= 0) this.hit(o); }
        if (xo) o.lane = true; if (o.t === 'line' && this.slideT > 0) o.slid = true; if (o.t === 'low' && this.air) o.clear = Math.min(o.clear ?? 9, bot - o.y1);
        if (!xo) o.gapX = Math.min(o.gapX ?? 9, Math.abs(this.x - o.x) - o.w - .26); }
      if (this.d - CAT_HALF > o.d + o.len && !o.done) { o.done = true;
        if (!o.hit && this.state === 'run') { const near = (o.t === 'line' && o.slid) || (o.t === 'low' && o.clear !== undefined && o.clear < .45) || (o.gapX !== undefined && o.gapX < .55 && o.t !== 'line');
          if (near) { this.nears++; this.meter = Math.min(this.D.cap, this.meter + .25); this.add(25 * this.mult); this.emit('near', { ot: o.t }); } } }
    }
    this.collect(dt);
    if (this.meter >= this.D.cap - 1e-6 && !this.ready) { this.ready = true; T.requestLaunch(this.d); this.emit('ready'); }
    const lb = b && b.kind === 'launch' && b.arch && !b.used ? b : null;
    if (lb && this.d >= lb.d1 - .9) { this.ready = false; this.startLeap(lb); return; }
    if (this.d >= T.finishD) { this.state = 'win'; this.emit('win'); }
    if (this.t - (this._pr || 0) > 2) { this._pr = this.t; T.prune(this.d); }
  }
  collect() {
    const T = this.T, mag = this.pow.magnet > 0 || this.frenzy > 0;
    for (const p of T.picks) {
      if (p.got) continue; if (p.d > this.d + (mag ? 7 : 1.2)) break; if (p.d < this.d - 2) continue;
      const dy = (this.y - p.by) - p.y + .35, dx = Math.abs(this.x - p.x), dd = Math.abs(this.d - p.d);
      let ok = false;
      if (p.t === 'lantern') ok = (dx < .9 && dd < 1 && this.y - p.by < 1.35) || (mag && dx < 4.6 && this.d > p.d - 6.5 && this.d < p.d + 1);
      else if (p.t === 'wisp') ok = (dx < .75 && dd < .8 && Math.abs(dy) < 1) || (mag && dx < 4.6 && this.d > p.d - 6.5 && this.d < p.d + 1) || (this.state === 'leap' && dd < 1.4);
      else ok = dx < .85 && dd < .9 && Math.abs(dy) < 1.2;
      if (!ok) continue; p.got = true;
      if (p.t === 'lantern') { this.lit++; this.chain++; this.bestChain = Math.max(this.bestChain, this.chain); this.add(50 * this.mult); this.meter = Math.min(this.D.cap, this.meter + 1); this.emit('lantern', { p: p.id, chain: this.chain, mag }); }
      else if (p.t === 'wisp') { this.wisps++; this.add(10 * this.mult); this.meter = Math.min(this.D.cap, this.meter + .12); this.emit('wisp', { p: p.id }); }
      else { this.pow[p.t] = p.t === 'broom' ? 5 : p.t === 'magnet' ? 8 : 5; if (p.t === 'broom') this.flyY = this.y; this.emit('power', { p: p.id, k: p.t }); }
    }
  }
  hit(o) { o.hit = true; this.chain = 0;
    if (this.kids) { this.emit('bonk', { ot: o.t }); this.inv = .8; return; }
    this.hits++; this.lives--; this.inv = 1.7; this.emit('hit', { ot: o.t, lives: this.lives }); if (this.lives <= 0) { this.state = 'dead'; this.emit('dead'); } }
  respawn(free) { const T = this.T; let nb = T.next(this.d - (free ? 0 : 3)); if (!nb) { T.gen(this.d + 80); nb = T.next(this.d - 3); }
    if (!free) { this.lives--; if (this.lives <= 0) { this.state = 'dead'; this.emit('dead'); return; } }
    this.d = nb.d0 + 1.6; this.y = nb.y; this.vy = 0; this.air = false; this.dj = false; this.x = this.lane * LANE; this.state = 'run'; this.inv = free ? .6 : 1.7;
    for (const o of T.obs) if (o.d < this.d + 3 && o.d + o.len > this.d - 1) o.hit = true; // never respawn into a hazard
    this.emit('respawn', { free: !!free, lives: this.lives }); }
}

// ---------- autopilot: plays like a perfect player (used by the opening, the video, tests and the GPU playtest) ----------
export function autopilot(R, opt = {}) {
  if (R.state !== 'run') return null; const T = R.T, v = R.speed, d = R.d; const look = v * 1.1 + 4;
  const cost = [0, 0, 0]; const lane = R.lane;
  for (const o of T.obs) { if (o.d + o.len < d - .2 || o.hit) continue; if (o.d > d + look) break;
    for (const l of [-1, 0, 1]) if (Math.abs(l * LANE - o.x) < o.w + .3) cost[l + 1] += o.t === 'chim' ? 60 / Math.max(.5, o.d - d) : o.t === 'bats' ? 2 : 1.2; }
  if (opt.greedy !== false) for (const p of T.picks) { if (p.got || p.d < d) continue; if (p.d > d + look) break; const l = Math.round(p.x / LANE); if (l >= -1 && l <= 1) cost[l + 1] -= p.t === 'lantern' ? 2.6 : p.t === 'wisp' ? .35 : 1.5; }
  for (const l of [-1, 0, 1]) cost[l + 1] += Math.abs(l - lane) * .35;
  let best = lane; for (const l of [-1, 0, 1]) { const path = l === lane ? [] : [lane + Math.sign(l - lane)]; const pc = Math.max(...path.map(p => p === l ? 0 : (cost[p + 1] > 30 ? 99 : 0)), 0); if (cost[l + 1] + pc < cost[best + 1] - .2) best = l; }
  if (best !== lane) return best < lane ? 'left' : 'right';
  // vertical: hazards straight ahead in this lane
  for (const o of T.obs) { if (o.hit || o.d + o.len < d - .2) continue; if (o.d > d + v * .5 + 1) break; if (Math.abs(R.x - o.x) >= o.w + .26) continue;
    const dist = o.d - d - CAT_HALF; if (o.t === 'low' && !R.air && dist < v * .2 + .5 && dist > -.2) return 'jump'; if ((o.t === 'line' || o.t === 'bats') && !R.air && R.slideT <= .05 && dist < v * .13 + .35) return 'slide'; }
  // gaps
  const b = T.bAt(d);
  if (b && !R.air) { const nb = T.next(d); const edge = b.d1 - d; if (nb && edge < v * .07 + .25 && edge > -.1) return 'jump'; }
  if (R.air && !R.dj && R.vy < .8 && !T.bAt(d)) { const nb = T.next(d); if (nb) { const t = (nb.d0 + .6 - d) / v; const yAt = R.y + R.vy * t - GRAV * t * t / 2; if (yAt < nb.y + .05) return 'jump'; } }
  if (R.air && !R.dj && R.vy < 0 && T.bAt(d)) { } // landing normally
  return null;
}
// run a whole route with the autopilot (tests / calibration)
export function simulate({ night, diff = 'medium', seed = 1, maxT = 400, dt = 1 / 60, think = 1 / 30 } = {}) {
  const T = new Track({ night, diff, seed }); const R = new Runner(T, diff); let acc = 0;
  while (R.t < maxT && R.state !== 'dead' && R.state !== 'win') { acc += dt; if (acc >= think) { acc = 0; const a = autopilot(R); if (a) R.act(a); } R.step(dt); }
  return { R, T };
}
