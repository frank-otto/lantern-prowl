// The black cat: procedural (spheres, capsules, cones), sheen fur that catches the moonlight on its rim, glowing amber-green eyes with
// slit pupils, whiskers, a 9-segment tail with a will-o'-wisp flame on the tip (it lights the lanterns), gallop / jump / slide / leap poses.
import * as THREE from 'three';
export function createCat(scene, soft) {
  const C = { g: new THREE.Group(), body: new THREE.Group(), phase: 0, squash: 0, lean: 0, look: 0, blink: 0, spirit: 0 };
  const fur = new THREE.MeshPhysicalMaterial({ color: '#101018', roughness: .62, metalness: 0, sheen: .7, sheenColor: new THREE.Color('#6f7cc4'), sheenRoughness: .42, clearcoat: .08 });
  const inner = new THREE.MeshStandardMaterial({ color: '#3a1a26', roughness: .7 });
  const eyeM = new THREE.MeshStandardMaterial({ color: '#1a1a00', emissive: '#c8ff3a', emissiveIntensity: 2.6, roughness: .2 });
  const pupilM = new THREE.MeshBasicMaterial({ color: '#000000' });
  // moon rim: a thin cool fresnel edge, weighted to the sky-facing side (reads as moonlight from behind; brighter in the Moonlight Leap)
  C.rimU = { rimC: { value: new THREE.Color(.36, .44, .9) }, rimK: { value: .05 }, rimP: { value: 4 } };
  fur.onBeforeCompile = sh => { Object.assign(sh.uniforms, C.rimU);
    sh.fragmentShader = 'uniform vec3 rimC; uniform float rimK, rimP;\n' + sh.fragmentShader.replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
      { vec3 nV = normalize(normal); float fr = 1. - clamp(dot(nV, normalize(vViewPosition)), 0., 1.); fr = fr * fr * (rimP > 3.5 ? fr * fr : fr);
        vec3 upV = normalize((viewMatrix * vec4(0., 1., 0., 0.)).xyz); float w = .15 + .85 * clamp(dot(nV, upV) * .8 + .2, 0., 1.);
        totalEmissiveRadiance += rimC * (fr * w * rimK); }`); };
  fur.customProgramCacheKey = () => 'catfur';
  C.mats = [fur, inner, eyeM, pupilM]; C.fur = fur; C.eyeM = eyeM; C.geos = [];
  const G = g => (C.geos.push(g), g);
  const sph = G(new THREE.SphereGeometry(1, 24, 16)), cap = G(new THREE.CapsuleGeometry(.055, .26, 4, 10)), cone = G(new THREE.ConeGeometry(.075, .17, 4, 1)), seg = G(new THREE.CapsuleGeometry(.045, .11, 3, 8));
  const add = (par, geo, mat, p, s, r) => { const m = new THREE.Mesh(geo, mat); m.position.set(...p); if (s) m.scale.set(...s); if (r) m.rotation.set(...r); m.castShadow = true; par.add(m); return m; };
  C.g.add(C.body); scene.add(C.g);
  // torso: chest + belly + hips (the cat faces −z)
  C.chest = add(C.body, sph, fur, [0, .42, -.2], [.2, .21, .26]); C.belly = add(C.body, sph, fur, [0, .4, .05], [.18, .18, .3]); C.hips = add(C.body, sph, fur, [0, .42, .28], [.19, .2, .22]);
  // head
  C.head = new THREE.Group(); C.head.position.set(0, .62, -.42); C.body.add(C.head);
  add(C.head, sph, fur, [0, 0, 0], [.17, .15, .16]); add(C.head, sph, fur, [0, -.045, -.12], [.085, .065, .07]);
  add(C.head, sph, inner, [0, -.02, -.185], [.018, .014, .012]);
  for (const s of [-1, 1]) { const e = add(C.head, cone, fur, [s * .095, .14, .01], [1, 1, .55], [0, 0, -s * .32]); add(e, cone, inner, [0, -.01, -.02], [.6, .7, .3]);
    const eye = add(C.head, sph, eyeM, [s * .062, .025, -.128], [.036, .03, .02]); eye.castShadow = false; const pu = add(eye, sph, pupilM, [0, 0, -.6], [.25, .85, .5]); pu.castShadow = false; C['eye' + s] = eye; }
  { const wp = []; for (const s of [-1, 1]) for (let i = 0; i < 3; i++) { wp.push(s * .05, -.05, -.17, s * .26, -.03 + (i - 1) * .035, -.1 - i * .01); }
    const wg = G(new THREE.BufferGeometry()); wg.setAttribute('position', new THREE.Float32BufferAttribute(wp, 3)); const wm = new THREE.LineBasicMaterial({ color: '#c8c8d8', transparent: true, opacity: .55 }); C.mats.push(wm); C.head.add(new THREE.LineSegments(wg, wm)); }
  // legs: shoulder/hip pivots → upper + lower (two-bone, simple)
  C.legs = []; for (const [x, z, front] of [[-.1, -.24, 1], [.1, -.24, 1], [-.1, .3, 0], [.1, .3, 0]]) { const p = new THREE.Group(); p.position.set(x, .4, z); C.body.add(p);
    const up = add(p, cap, fur, [0, -.13, 0]); const kn = new THREE.Group(); kn.position.set(0, -.25, 0); p.add(kn); const lo = add(kn, cap, fur, [0, -.12, 0], [.85, .9, .85]); add(kn, sph, fur, [0, -.26, -.02], [.05, .03, .065]);
    C.legs.push({ p, kn, front, side: x < 0 ? -1 : 1 }); }
  // tail: chain of segments; the last one carries the flame
  C.tail = []; let par = C.body; const t0 = new THREE.Group(); t0.position.set(0, .5, .45); C.body.add(t0); par = t0;
  for (let i = 0; i < 9; i++) { const s = new THREE.Group(); s.position.set(0, i ? .13 : 0, 0); par.add(s); const m = add(s, seg, fur, [0, .065, 0], [1 - i * .05, 1, 1 - i * .05]); C.tail.push(s); par = s; }
  C.tip = new THREE.Group(); C.tip.position.set(0, .16, 0); par.add(C.tip);
  const flameM = new THREE.SpriteMaterial({ map: soft, color: new THREE.Color(2.1, .95, .28), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }); C.mats.push(flameM);
  C.flame = new THREE.Sprite(flameM); C.flame.scale.set(.3, .42, 1); C.tip.add(C.flame);
  const coreM = new THREE.SpriteMaterial({ map: soft, color: new THREE.Color(1.9, 1.3, .6), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }); C.mats.push(coreM);
  C.core = new THREE.Sprite(coreM); C.core.scale.set(.13, .18, 1); C.tip.add(C.core);
  C.light = new THREE.PointLight('#ffa448', 1.6, 7, 1.7); C.light.position.set(0, .25, .1); C.tip.add(C.light);
  C.tipWorld = new THREE.Vector3();
  return C;
}
const lerp = (a, b, k) => a + (b - a) * k;
// pose the cat. st: { run speed v, air, vy, slide (0..1), leap (0..1 or -1), lane lean, t, inv blink, frenzy, spirit (shadow dash) }
export function updateCat(C, st, dt) {
  const v = st.v || 0; C.phase += dt * (st.air ? 4 : 2.1 + v * .55); const ph = C.phase;
  const slide = st.slide || 0, air = st.air ? 1 : 0, leap = st.leap ?? -1;
  // gallop: legs in a rotary gallop, spine flexes, head steady
  const amp = air ? 0 : (1 - slide * .7);
  for (const L of C.legs) { const o = L.front ? 0 : Math.PI * .9, sp = L.side * .18; const a = Math.sin(ph + o + sp) * .95 * amp;
    let rx = a, kx = (L.front ? -1 : 1) * Math.max(0, Math.sin(ph + o + sp + 1.2)) * .9 * amp;
    if (air) { const tuck = st.vy > 0 ? 1 : .4; rx = L.front ? -1.1 * tuck - .2 : 1.0 * tuck + .1; kx = L.front ? .9 * tuck : -1.2 * tuck; if (leap >= 0) { rx = L.front ? -1.5 : 1.4; kx = L.front ? .3 : -.3; } }
    if (slide > 0) { rx = lerp(rx, L.front ? -1.35 : 1.3, slide); kx = lerp(kx, 0, slide); }
    L.p.rotation.x = rx; L.kn.rotation.x = kx; }
  const bob = air ? 0 : Math.abs(Math.sin(ph)) * .05 * amp;
  C.body.position.y = bob - slide * .2; C.body.scale.set(1 + slide * .12, 1 - slide * .32 + (C.squash > 0 ? -C.squash * .25 : 0), 1 + slide * .18 + Math.max(0, C.squash) * .1);
  let pitch = air ? -Math.max(-.5, Math.min(.5, (st.vy || 0) * .06)) : Math.sin(ph * 2) * .04 * amp; if (leap >= 0) pitch = Math.sin(leap * Math.PI) * -.15 + (leap - .5) * .9;
  C.body.rotation.x = pitch; C.body.rotation.z = lerp(C.body.rotation.z, -(st.lean || 0) * .35, Math.min(1, dt * 8));
  C.chest.position.y = .42 + Math.sin(ph) * .012 * amp; C.hips.position.y = .42 - Math.sin(ph) * .015 * amp;
  C.head.rotation.x = -pitch * .7 + Math.sin(ph * 2) * .03 * amp; C.head.rotation.y = lerp(C.head.rotation.y, (st.look || 0) * .5, Math.min(1, dt * 5));
  // tail: a lazy S that streams back when fast or in the air
  const stream = Math.min(1, v / 14) * .5 + air * .4 + slide * .3;
  for (let i = 0; i < C.tail.length; i++) { const s = C.tail[i]; s.rotation.x = (i === 0 ? .9 + stream * .6 : .08 + stream * .05) + Math.sin(ph * .5 + i * .5 + (st.t || 0) * 2) * .12 * (1 - stream * .5); s.rotation.z = (i ? .1 : .26) * (1 - air * .5) + Math.sin((st.t || 0) * 2.2 + i * .6) * .1 * (1 + i * .1); }
  // eyes blink now and then; flash in the leap
  C.blink -= dt; const bl = C.blink < 0 && C.blink > -.12 ? .15 : 1; if (C.blink < -.12) C.blink = 2.5 + Math.random() * 3;
  for (const s of [-1, 1]) C['eye' + s].scale.y = .03 * bl;
  C.eyeM.emissiveIntensity = 2.6 + (st.flash || 0) * 6;
  { const lp = leap >= 0 ? Math.sin(Math.min(1, Math.max(0, leap)) * Math.PI) : 0; C.rimK = lerp(C.rimK ?? .05, .05 + lp * 1.15, Math.min(1, dt * 6)); C.rimU.rimK.value = C.rimK; }
  // the wisp flame: flickers, grows in the frenzy, turns violet in the shadow dash
  const f = 1 + Math.sin((st.t || 0) * 23) * .08 + Math.sin((st.t || 0) * 37) * .06, big = 1 + (st.frenzy ? .32 : 0) + (st.flash || 0) * .35;
  C.flame.scale.set(.3 * f * big, .44 * f * big, 1); C.core.scale.set(.11 * big, .16 * f * big, 1); C.light.intensity = (1.5 + Math.sin((st.t || 0) * 19) * .2) * big;
  const sp = st.spirit || 0; C.flame.material.color.setRGB(lerp(2.1, 1.2, sp), lerp(.95, .6, sp), lerp(.28, 2.4, sp)); C.light.color.setRGB(lerp(1, .6, sp), lerp(.64, .4, sp), lerp(.28, 1, sp));
  C.fur.sheenColor.setRGB(lerp(.54, .7, sp), lerp(.59, .4, sp), lerp(.85, 1, sp)); C.fur.emissive = C.fur.emissive || new THREE.Color(); C.fur.emissive.setRGB(sp * .08, 0, sp * .18);
  C.g.visible = !(st.inv > 0 && Math.floor(st.inv * 12) % 2 === 1);
  C.squash = Math.max(0, C.squash - dt * 5);
  C.tip.getWorldPosition(C.tipWorld);
}
export function disposeCat(C) { for (const g of C.geos) g.dispose(); for (const m of C.mats) m.dispose(); }
