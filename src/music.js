// Music, all played on recorded samples (VSCO 2 CE, CC0): an original D-minor "rooftop prowl" – a sneaky contrabass walk, pizzicato
// violins on the off-beats, harp sparkles, organ pads and timpani; layers join as the Lantern Chain grows (intensity I). Menu = slow 6/8.
import { note, play } from './audio.js';
const CH = { Dm: { b: [38, 45, 41, 43], p: [62, 65, 69, 74], o: [50, 53, 57] }, Bb: { b: [34, 41, 38, 39], p: [58, 62, 65, 70], o: [50, 53, 58] }, Gm: { b: [31, 38, 34, 36], p: [55, 58, 62, 67], o: [50, 55, 58] },
  A: { b: [33, 40, 37, 38], p: [57, 61, 64, 69], o: [49, 52, 57] }, F: { b: [29, 36, 33, 34], p: [57, 60, 65, 69], o: [48, 53, 57] }, C: { b: [36, 43, 40, 41], p: [55, 60, 64, 67], o: [48, 52, 55] }, E7: { b: [28, 35, 32, 33], p: [56, 59, 62, 64], o: [50, 52, 56] } };
const GROOVES = {
  menu: { bpm: 84, beats: 6, prog: ['Dm', 'Dm', 'Bb', 'A', 'Dm', 'Gm', 'E7', 'A'], bar(b, c, k) { const E = [];
    E.push([0, () => note('cb', c.b[0], .3 * k, 0, 0, .45)]); E.push([3, () => note('cb', c.b[1], .22 * k, 0, 0, .45)]); E.push([0, () => c.o.forEach(m => note('org', m, .05 * k, 3.2, 0, .75))]);
    [1, 2, 4, 5].forEach((q, i) => E.push([q, () => note('pz', c.p[i % 4], .075 * k, 0, 0, .5, (i - 1.5) * .2)])); if (b % 2) E.push([4.5, () => note('hp', c.p[3] + 12, .08 * k, 0, 0, .6)]); return E; } },
  game: { bpm: 152, beats: 4, prog: ['Dm', 'Dm', 'Bb', 'A', 'Dm', 'Gm', 'E7', 'A', 'F', 'C', 'Gm', 'A'], bar(b, c, k, I) { const E = [];
    [0, 1, 2, 3].forEach(q => E.push([q, () => note('cb', c.b[q], (q ? .26 : .36) * k, 0, 0, .3)]));
    [.5, 1.5, 2.5, 3.5].forEach((q, i) => E.push([q, () => note('pz', c.p[(i + b) % 4], .085 * k, 0, 0, .4, i % 2 ? .3 : -.3)]));
    if (b % 2 === 0) E.push([0, () => c.o.forEach(m => note('org', m, (.035 + .035 * I) * k, 3.4, 0, .75))]);
    if (I > .25) [0, .75, 1.5, 2.25, 3, 3.5].forEach((q, i) => E.push([q, () => note('hp', c.p[i % 4] + 12, .05 * k, 0, 0, .55, (i - 2.5) * .15)]));
    if (I > .5) { E.push([0, () => play('tp_4', .2 * k, Math.pow(2, ((c.b[0] - 40) % 12) / 24), 0, .4)]); E.push([2, () => play('tp_2', .14 * k, 1, 0, .4)]); }
    if (b % 4 === 0) E.push([0, () => play('bd', .2 * k, .8, 0, .4)]); if (b % 8 === 7) E.push([2, () => play('cymcresc', .06 * k, 1, 0, .5, .8)]); return E; } }
};
export class Player {
  constructor() { this.g = null; this.on = false; this.vol = 1; this.I = 0; }
  start(name, t0) { this.g = GROOVES[name]; this.name = name; this.t0 = t0; this.spb = 60 / this.g.bpm; this.bar = -1; this.q = []; this.on = true; }
  stop() { this.on = false; this.q = []; }
  step(t) { if (!this.on) return; const nb = this.g.beats; const b = Math.floor((t - this.t0) / this.spb / nb);
    while (this.bar < b + 1) { this.bar++; if (this.bar < 0) continue; const ch = CH[this.g.prog[this.bar % this.g.prog.length]]; for (const [be, f] of this.g.bar(this.bar, ch, this.vol, this.I)) this.q.push([this.t0 + (this.bar * nb + be) * this.spb, f]); this.q.sort((a, b2) => a[0] - b2[0]); }
    while (this.q.length && this.q[0][0] <= t) { const [, f] = this.q.shift(); f(); } }
}
