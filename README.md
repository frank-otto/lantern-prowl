# 🐈‍⬛ Lantern Prowl

Day 15 of a daily Halloween web-game series – **5 days to Halloween 🎃**

A cinematic 3D rooftop run through a Halloween town at night. You are a black cat with a will-o'-wisp flame on the tip of its tail, racing over slate roofs, brick chimneys and crooked gables under a giant moon. Every jack-o'-lantern you brush past lights up – and the whole town slowly wakes up around you.

**The hook – THE MOONLIGHT LEAP.** Lanterns fill the moon. When it is full, a glowing moon arch appears at the edge of the roofs. Run through it and the cat launches across the town square: time slows, the camera swings to the side and the cat flies as a silhouette straight across the giant moon. At the top of the leap **THE TOWN IGNITES** – a wave of light runs through every window and jack-o'-lantern to the horizon, fireworks burst behind the moon and a flock of bats takes off. Then **LANTERN FRENZY**: double points for a few seconds.

## How to play
- **Swipe ← →** to switch between three lanes, **swipe ↑ or tap** to jump (tap again in the air for a double jump), **swipe ↓** to slide.
- Keyboard: **← →** lanes · **↑ / Space** jump · **↓** slide · **Esc** menu.
- Brush past jack-o'-lanterns to light them – unbroken **Lantern Chains** multiply your score. Passing a hazard by a hair gives a **Whisker close!** bonus.
- Hazards: brick chimneys (switch lanes), low gargoyles (jump – or smash them while on fire), ghost-sheet laundry lines (slide under), bat swarms (slide or switch lanes), gaps between houses (jump, double-jump the wide ones).
- Power-ups: **broom ride** (fly over everything), **wisp magnet**, **shadow dash** (pass through one hazard).
- Reach the clock tower before midnight for 1 to 3 stars (3 stars: win, light at least 75 % of the lanterns and make a Moonlight Leap).

**10 nights** with a smooth curve (Chimney Row, Laundry Lane, Bat Belfry, Gargoyle Gutters, Crooked Roofs, Witches' Quarter, Foggy Spires, Long Leaps, Midnight Tower …), stars and best score per night and difficulty.
**Modes:** night journey · **Endless Night** (no finish line, ever faster) · **Player 1 vs Player 2** hot-seat Rooftop Duel (same route, one run each, highest score wins).
**Difficulty:** Easy / Medium / Hard (speed, lives, hazard density, how much the moon needs). **Kids mode:** slower, can't lose, gaps are jumped automatically, bumps cost no lives, every night open.

**One tap to play.** The game opens mid-leap: the cat is already flying across the moon in the very first frame. Tap (or click) anywhere and you are straight in Night 1, sound on, with a short hint card. After the opening the start screen has one big PLAY button; nights, Endless Night, the duel, difficulty, kids mode, quality, sound and the intro replay sit behind the small ⚙. The language follows the browser (German for German browsers, English otherwise) with a tiny DE/EN switch (remembered). A 1080×1350 score card to save or share. Quality is automatic (Normal, steps down only if the frame rate stays low).

## Tech
- Three.js (WebGL): world-space-UV PBR materials (slate roofs, brick walls with instanced lit windows), PMREM environment light from the night sky, shadowed moon key light, pooled point lights for lanterns, exponential fog, HDR bloom with a clamped high-pass (no glare), colour grade with vignette, MSAA.
- Instanced town: hundreds of houses, roofs, chimneys and carved jack-o'-lanterns; a skyline shader whose windows light up in a wave when the town ignites; GPU spark particles for fireworks and embers.
- A pure, deterministic run simulation (`src/sim.js`): 120 Hz substeps, coyote time, jump buffer, double jump, slide, falls and respawns, near misses, chains, power-ups and the Moonlight Leap; every night was calibrated with a bot on all difficulties.
- Frame-rate independent clock with NaN guards; GPU resources are disposed on quality changes (leak-tested).
- Sounds: real CC0 recordings only, no oscillators; original sample-based music. See `LICENSES/SOUNDS.md`.
- Everything is bundled into `js/game.bundle.js` + `js/sounds-src.js`, so it also runs straight from the file system (`start.command` or open `index.html`).

## Build & test
```
npm install
node tools/build.mjs
python3 test/test_game.py     # headless Chrome (SwiftShader) via Playwright
python3 test/test_mobile.py   # phones: WebKit iPhone + Chromium Pixel, real taps, portrait + landscape
```

Built with Grok Bot by Frank (@Frank_AI_Lab). Sound credits by source ID in `LICENSES/SOUNDS.md`. Code licenses: three.js (MIT), Fredoka font (OFL).
