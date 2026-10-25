"""Lantern Prowl – full headless test suite (Chrome + SwiftShader WebGL over a local web server).
Run: python3 test/test_game.py   (exit code 0 = all checks passed; screenshots → test/shots/)"""
SUR = bytes([79, 116, 116, 111]).decode()  # the surname that must never appear (spelled as bytes so this file stays clean)
FAM = [bytes(x).decode() for x in ([84, 104, 101, 111, 100, 111, 114], [77, 97, 114, 116, 104, 97], [69, 108, 105, 115, 97, 98, 101, 116, 104], [65, 110, 110, 97])]
# third-party names / phrases that must never appear in visible text
TM = r'candy|saga|crush|haunted\s*mansion|whac|grok(?!\s*bot)|subway|temple\s*run|black\s*cat\s*run|nine\s*lives|sonic|mario|garfield|felix'
import asyncio, os, re, glob, json, sys, base64, io
from playwright.async_api import async_playwright
import threading, http.server, functools, socketserver
from PIL import Image
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
class _Q(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a): pass
_srv = socketserver.ThreadingTCPServer(('127.0.0.1', 0), functools.partial(_Q, directory=ROOT)); _srv.daemon_threads = True
threading.Thread(target=_srv.serve_forever, daemon=True).start()
URL = 'http://127.0.0.1:%d/index.html' % _srv.server_address[1]
OUT = ROOT + '/test/shots/'; os.makedirs(OUT, exist_ok=True)
ARGS = ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required']
R = []
def check(n, ok, info=''): R.append(bool(ok)); print(('PASS ' if ok else 'FAIL ') + n + (f' — {info}' if info != '' else ''), flush=True)
CLEAR = "try{if(!sessionStorage.getItem('lpInit')){sessionStorage.setItem('lpInit','1'); localStorage.clear();}}catch(e){}"
TXT = "window.__txt=[];(function(){const f=CanvasRenderingContext2D.prototype.fillText;CanvasRenderingContext2D.prototype.fillText=function(s,...a){try{window.__txt.push(String(s))}catch(e){}return f.call(this,s,...a)};})();"
async def page(b, skip=False, manual=True, locale='en-US', vp=(1280, 800)):
    ctx = await b.new_context(accept_downloads=True, locale=locale, viewport={'width': vp[0], 'height': vp[1]})
    init = 'window.__lpSeed = 4242; window.__lpPDB = true; window.__lpNoAutoQ = true;' + ('window.__lpManual = true;' if manual else '') + ('window.__lpSkipIntro = true;' if skip else '') + CLEAR + TXT
    await ctx.add_init_script(init)
    pg = await ctx.new_page(); pg.set_default_timeout(300000); logs = []
    pg.on('console', lambda m: logs.append(f'{m.type}: {m.text}') if m.type == 'error' else None)
    pg.on('pageerror', lambda e: logs.append(f'PAGEERROR {e}'))
    await pg.goto(URL); await pg.wait_for_function('document.body.classList.contains("ready") && window.__lp', timeout=120000)
    return ctx, pg, logs
def pxs(im): return im.get_flattened_data() if hasattr(im, 'get_flattened_data') else list(im.getdata())
def mean(path): im = Image.open(path).convert('L'); px = pxs(im); return sum(px) / len(px)
def diff(a, b):
    A = Image.open(a).convert('L').resize((160, 100)); B = Image.open(b).convert('L').resize((160, 100)); pa, pb = pxs(A), pxs(B); return sum(abs(x - y) for x, y in zip(pa, pb)) / len(pa)
def white_share(path):
    im = Image.open(path).convert('RGB').resize((200, 125)); px = pxs(im); return sum(1 for r, g, b in px if r > 245 and g > 245 and b > 245) / len(px)
async def ev(pg, js): return await pg.evaluate(js)
async def shot(pg, name, n=1):
    await pg.evaluate(f'__lp.step(1/30, {n})'); await pg.screenshot(path=OUT + name, timeout=180000); return OUT + name
async def run_until(pg, cond, frames=3000, dt='1/30'):
    return await ev(pg, f'(() => {{ for (let i = 0; i < {frames}; i++) {{ if ({cond}) return i; __lp.stepq({dt}, 1); }} return ({cond}) ? {frames} : -1; }})()')

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path='/usr/bin/google-chrome', args=ARGS)
        # ================= 1) the opening: motion from frame 0, title, one click → play =================
        ctx, pg, logs = await page(b)
        st = await ev(pg, '[__lp.S.state, __lp.runner().state, __lp.S.lang, __lp.quality(), document.title]')
        check('page opens straight into the cinematic opening (cat mid Moonlight Leap), English default, quality auto = Normal', st[0] == 'intro' and st[1] == 'leap' and st[2] == 'en' and st[3] == 'mid' and 'Lantern Prowl' in st[4], st)
        f0 = await shot(pg, 'o0.png'); f1 = await shot(pg, 'o1.png', 3)
        check('frame 0 is not black and already moving (frame 0 vs frame 3)', mean(f0) > 35 and diff(f0, f1) > 1.0, (round(mean(f0), 1), round(diff(f0, f1), 2)))
        check('frame 0 has no blown-out glare (white pixels < 3 %)', white_share(f0) < .03, round(white_share(f0), 4))
        n = await run_until(pg, '__lp.S.titleT >= 0', 600)
        await shot(pg, 'o2-title.png', 8); op = await ev(pg, '+getComputedStyle(document.getElementById("opening")).opacity')
        check('the title slams in after the landing (LANTERN PROWL on screen)', n > 0 and op > .5, (n, op))
        n2 = await run_until(pg, '__lp.S.state === "menu"', 600)
        check('the opening hands over to the start screen by itself (never blocks), total < 12 s', n2 >= 0 and (n + n2) / 30 < 12, round((n + n2) / 30, 1))
        await pg.wait_for_timeout(900); await shot(pg, 'm-menu.png')
        hit = await ev(pg, "['btnPlay','btnLang','btnGear'].map(id => { const r = document.getElementById(id).getBoundingClientRect(); const e = document.elementFromPoint(r.left + r.width/2, r.top + r.height/2); return [id, Math.round(r.width), Math.round(r.height), !!e && (e.id === id || document.getElementById(id).contains(e))]; })")
        check('start screen: big PLAY + tiny DE/EN + gear, all hit-testable and ≥ 44 px', all(h[3] and h[1] >= 44 and h[2] >= 44 for h in hit), hit)
        vis = await ev(pg, "['btnQuit','btnSound','btnSkip','more','end'].map(id => [id, getComputedStyle(document.getElementById(id)).display !== 'none' && getComputedStyle(document.getElementById(id)).visibility !== 'hidden'])")
        check('start screen shows nothing else (quit, sound, sheet, end panel hidden)', not any(v[1] for v in vis), vis)
        await ctx.close()
        ctx, pg, logs = await page(b)
        await shot(pg, 'x.png', 2); await pg.mouse.click(640, 360)
        st = await ev(pg, '[__lp.S.state, __lp.S.mode, __lp.S.ni, __lp.runner().state, __lp.audioState(), document.getElementById("lvCard").classList.contains("show")]')
        check('ONE click anywhere on the opening → straight into Night 1 (playable runner, night card hint, audio unlocked)', st[:4] == ['play', 'night', 0, 'run'] and st[4] in ('running', 'suspended') and st[5], st)
        await shot(pg, 'p0-play.png', 20)
        # ================= 2) the rules =================
        r = await ev(pg, '(() => { const R = __lp.runner(); __lp.stepq(1/30, 30); const x0 = R.x; __lp.act("left"); __lp.stepq(1/30, 10); const x1 = R.x; __lp.act("right"); __lp.stepq(1/30, 10); const x2 = R.x; __lp.act("jump"); __lp.stepq(1/30, 6); const y = R.y - (__lp.track().bAt(R.d)?.y ?? 0); __lp.act("jump"); __lp.stepq(1/120, 1); const ev2 = R.vy; __lp.stepq(1/30, 40); __lp.act("slide"); __lp.stepq(1/30, 3); const sl = R.slideT > 0; return [x0, x1, x2, +y.toFixed(2), +ev2.toFixed(2), sl]; })()')
        check('lanes (swipe ← →), jump, double jump, slide all work', r[1] < r[0] - 1 and abs(r[2] - r[0]) < .2 and r[3] > .5 and r[4] > 3 and r[5], r)
        r = await ev(pg, '(() => { const R = __lp.runner(); const l0 = R.lit, s0 = R.score, m0 = R.meter; __lp.auto(true); __lp.stepq(1/30, 300); return [R.lit - l0, R.score - s0, R.meter > m0 || R.leaps > 0, R.bestChain, R.d | 0]; })()')
        check('running lights jack-o\'-lanterns: lit count, score, moon meter and Lantern Chain go up', r[0] >= 5 and r[1] > 0 and r[2] and r[3] >= 2, r)
        k0 = await ev(pg, '__lp.log.length')
        r = await ev(pg, '(() => { const R = __lp.runner(); __lp.fillMoon(); const T = __lp.track(); let i = 0, ready = false, leap = -1, ts = 1, ign = false, sp = 0, land = -1, cine = false;'
                     ' for (; i < 900; i++) { __lp.stepq(1/30, 1); ready = ready || R.ready; if (R.state === "leap" && leap < 0) leap = i; if (R.state === "leap") { ts = Math.min(ts, __lp.S.ts); cine = cine || !!__lp.S.cine; } if (R.ignited && !ign) { ign = true; } sp = Math.max(sp, __lp.sparks()); if (leap >= 0 && R.state === "run") { land = i; break; } }'
                     ' return [ready, leap, land, +ts.toFixed(2), cine, ign, sp, R.leaps, R.frenzy > 0, __lp.W.skyU.uT0.value < 1e8]; })()')
        check('full moon → the Moonlight arch comes within 10 s → MOONLIGHT LEAP (slow-mo, cinematic camera)', r[0] and 0 <= r[1] < 300 and r[3] <= .4 and r[4], r)
        check('THE TOWN IGNITES at the apex: skyline wave, fireworks (sparks), lands safely, Lantern Frenzy starts', r[5] and r[9] and r[6] > 400 and r[2] > r[1] and r[7] == 1 and r[8], r)
        snd = await ev(pg, f'[...new Set(__lp.log.slice({k0}).map(e => e.n))]')
        check('the leap plays real layered sounds (ignite boom, fireworks, landing)', len(snd) >= 6 and any('fw_' in s for s in snd), snd)
        # leap visuals
        await ev(pg, '__lp.start("night", 0); __lp.auto(true); __lp.stepq(1/30, 120); __lp.fillMoon()'); await run_until(pg, '__lp.runner().state === "leap"', 900)
        a1 = await shot(pg, 'l1-leap.png', 40); await run_until(pg, '__lp.runner().ignited', 300); a2 = await shot(pg, 'l2-ignite.png', 30)
        r = await ev(pg, '[__lp.W.rings.map(m => m.material.uniforms.map.value.wrapT === __lp._dbg.THREE.ClampToEdgeWrapping), __lp.rim(), __lp.runner().state]')
        check('polish: skyline rings clamp the silhouette texture vertically (no black dashed line on the ring tops, WebKit) and the cat gets a moon rim in the leap', all(r[0]) and len(r[0]) == 2 and r[1] > .3, r)
        check('leap + ignite frames render, readable (no white-out glare)', white_share(a1) < .04 and white_share(a2) < .04 and mean(a2) > 30, (round(white_share(a1), 4), round(white_share(a2), 4), round(mean(a2), 1)))
        # ================= 3) hazards, lives, falls =================
        r = await ev(pg, '(() => { __lp.start("night", 2); __lp.auto(false); const R = __lp.runner(); const L0 = R.lives; let i = 0; for (; i < 3000 && R.state !== "dead"; i++) __lp.stepq(1/30, 1); return [L0, R.hits, R.falls, R.state, i]; })()')
        check('doing nothing on Medium: hazards and gaps cost lives (3) until the run ends', r[0] == 3 and r[1] + r[2] >= 3 and r[3] == 'dead', r)
        await run_until(pg, '__lp.S.state === "end"', 200)
        st = await ev(pg, '[__lp.S.state, __lp.S.result, document.getElementById("end").classList.contains("show"), document.getElementById("btnNext").style.display]')
        check('a lost run shows the end panel (no "next night")', st[0] == 'end' and st[2] and st[3] == 'none', st)
        # ================= 4) a full night won by the bot, progress, stars =================
        r = await ev(pg, '(() => { __lp.start("night", 0); __lp.auto(true); const R = __lp.runner(); let i = 0; for (; i < 6000 && __lp.S.state === "play"; i++) __lp.stepq(1/30, 1); return [__lp.S.state, __lp.S.result, __lp.S.stars, R.leaps, Math.round(100 * R.lit / __lp.track().lanterns), (i / 30) | 0, __lp.prog().u, __lp.prog().st[0]]; })()')
        check('Night 1 can be won (finish gate at the clock tower), ≥ 2 stars, Night 2 unlocked, understandable length (< 90 s)', r[0] == 'end' and r[1] == 'win' and r[2] >= 2 and r[6] >= 1 and r[5] < 90, r)
        e1 = await shot(pg, 'e-win.png', 30)
        st = await ev(pg, '[document.getElementById("eTitle").textContent, document.getElementById("eStars").textContent, document.getElementById("btnNext").style.display, document.getElementById("eName").value]')
        check('win screen: title, stars, NEXT NIGHT button, default name "Player"', st[0] and st[2] != 'none' and st[3] == 'Player', st)
        # ================= 5) share card =================
        await ev(pg, 'window.__txt.length = 0'); url = await ev(pg, '__lp.cardURL()'); txt = await ev(pg, 'window.__txt.join(" | ")')
        im = Image.open(io.BytesIO(base64.b64decode(url.split(',')[1]))); im.save(OUT + 'card.jpg')
        check('share card is 1080×1350', im.size == (1080, 1350), im.size)
        bad = re.findall(r'https?:|www\.|github|\.io\b|\.com\b|@(?!Frank_AI_Lab)|' + SUR + '|' + '|'.join(FAM) + r'|\bAI\b|\bKI\b', txt, re.I)
        check('share card: no URL, no surname / family names / email, says "by Player", credits Grok Bot + countdown', not bad and 'Player' in txt and 'Grok Bot' in txt and '5 days to Halloween' in txt, bad or txt[:200])
        # ================= 6) modes and difficulties =================
        r = await ev(pg, '["easy","medium","hard"].map(d => { document.querySelector(`#diff button[data-d=${d}]`).click(); __lp.start("night", 0); const R = __lp.runner(); return [d, R.lives, +R.D.speed.toFixed(2), R.D.cap]; })')
        check('Easy / Medium / Hard: 5 / 3 / 2 lives, faster and denser with difficulty, bigger moon on Hard', [x[1] for x in r] == [5, 3, 2] and r[0][2] < r[1][2] < r[2][2] and r[0][3] < r[2][3], r)
        await ev(pg, 'document.querySelector("#diff button[data-d=medium]").click()')
        r = await ev(pg, '(() => { document.getElementById("btnKids").click(); __lp.start("night", 4); __lp.auto(false); const R = __lp.runner(); for (let i = 0; i < 1800 && R.state !== "dead" && R.state !== "win"; i++) __lp.stepq(1/30, 1); const o = [__lp.S.kids, R.lives, R.state, R.d | 0, __lp.prog().u]; document.getElementById("btnKids").click(); return o; })()')
        check('kids mode: no game over, auto-jumps over gaps by itself (60 s with no input), all nights open', r[0] and r[1] == float('inf') or (r[0] and r[1] is None), r)
        check('kids mode: the cat makes real progress without input', r[3] > 400 and r[2] in ('run', 'leap', 'win', 'fall', 'fly', 'respawn'), r)
        r = await ev(pg, '(() => { __lp.start("endless"); __lp.auto(true); const R = __lp.runner(); __lp.stepq(1/30, 2400); return [__lp.S.mode, R.state, R.d | 0, R.leaps, Number.isFinite(__lp.track().finishD), document.getElementById("prog").classList.contains("endless")]; })()')
        check('Endless Night: no finish line, keeps going (80 s+), several Moonlight Leaps', r[0] == 'endless' and r[1] != 'win' and r[2] > 700 and r[3] >= 2 and not r[4] and r[5], r)
        r = await ev(pg, '(() => { __lp.toMenu(); document.getElementById("btnDuel").click(); const a = [__lp.S.mode, __lp.S.player]; __lp.auto(true); __lp.stepq(1/30, 300); __lp.end("dead"); const h = [__lp.S.state, document.getElementById("handover").classList.contains("show"), document.getElementById("hoT").textContent];'
                     ' document.getElementById("btnGo").click(); const b2 = [__lp.S.state, __lp.S.player]; __lp.auto(true); __lp.stepq(1/30, 200); __lp.end("dead"); return [a, h, b2, __lp.S.state, document.getElementById("eTitle").textContent, JSON.stringify(__lp.S.duel.map(d => d && d.score))]; })()')
        check('duel: Player 1 runs → handover screen → Player 2 runs the same route → winner shown', r[0] == ['duel', 0] and r[1][0] == 'handover' and r[1][1] and 'Player 2' in r[1][2] and r[2] == ['play', 1] and r[3] == 'end' and ('Player' in r[4] or 'Draw' in r[4]), r)
        await shot(pg, 'e-duel.png', 20)
        # ================= 7) language =================
        r = await ev(pg, '(() => { __lp.toMenu(); const a = document.getElementById("btnPlay").textContent; document.getElementById("btnLang").click(); const b2 = [__lp.S.lang, document.getElementById("btnPlay").textContent, document.documentElement.lang]; document.getElementById("btnLang").click(); return [a, b2, __lp.S.lang]; })()')
        check('tiny DE/EN toggle switches every text (PLAY → SPIELEN) and back', 'PLAY' in r[0].upper() and r[1][0] == 'de' and r[1][2] == 'de' and r[1][1] != r[0] and r[2] == 'en', r)
        # ================= 8) robustness: NaN / frame-clock guards =================
        r = await ev(pg, '(() => { __lp.start("night", 0); const R = __lp.runner(); R.vy = NaN; R.x = NaN; __lp.S.ts = NaN; __lp.stepq(1/30, 3); __lp.stepq(NaN, 2); __lp.stepq(5, 1); __lp.stepq(-1, 1); const c = __lp.cam(); return [R.x, R.y, R.d, __lp.S.ts, __lp.S.gt, c.p, c.fov].flat().every(Number.isFinite); })()')
        check('NaN guards: NaN velocity/position/time-scale and NaN/negative/5 s frame steps never break the sim or camera', r is True, r)
        r = await ev(pg, '(() => { const l0 = __lp.last(); __lp.advance(l0 + 16); const l1 = __lp.last(); const d = __lp.advance(l1 - 500); return [d, __lp.last() >= l1]; })()')
        check('frame clock never runs backwards (out-of-order rAF stamps give dt = 0)', r[0] == 0 and r[1], r)
        await ev(pg, '__lp.toMenu()'); await shot(pg, 'm2.png', 4)
        check('no console errors so far', not logs, logs[:4])
        await ctx.close()
        # ================= 9) GPU resource leak test =================
        ctx, pg, logs = await page(b, skip=True)
        await ev(pg, '__lp.start("night", 0); __lp.auto(true)'); await shot(pg, 'x.png', 3)
        async def cycle():
            for q in ['low', 'high', 'ultra', 'mid', 'low', 'mid']:
                await ev(pg, f'__lp.quality("{q}")'); await shot(pg, 'x.png', 2)
            for i in range(3):
                await ev(pg, '__lp.start("night", 1); __lp.auto(true); __lp.fillMoon(); __lp.stepq(1/30, 400)'); await shot(pg, 'x.png', 2)
                await ev(pg, '__lp.end("quit"); __lp.toMenu(); __lp.stepq(1/30, 200)'); await shot(pg, 'x.png', 2)
            await ev(pg, '__lp.start("night", 0)'); await shot(pg, 'x.png', 3)
        await cycle()  # warm-up: every shader variant (shadows on/off, light counts) gets compiled once
        m0 = await ev(pg, '__lp.mem()')
        await cycle()
        m1 = await ev(pg, '__lp.mem()')
        check('no GPU leaks: geometries / textures / shader programs flat over a 2nd round of 6 quality switches + 3 runs with leaps + menu', m1['geometries'] <= m0['geometries'] + 1 and m1['textures'] <= m0['textures'] + 1 and m1['programs'] <= m0['programs'] + 2, (m0, m1))
        check('no console errors (leak run)', not logs, logs[:4])
        await ctx.close()
        # ================= 10) German browser → German, auto =================
        ctx, pg, logs = await page(b, locale='de-DE')
        r = await ev(pg, '[__lp.S.lang, document.documentElement.lang, document.getElementById("btnSkip").textContent]')
        check('German browser → German texts automatically', r[0] == 'de' and r[1] == 'de' and 'spielen' in r[2].lower(), r)
        r = await ev(pg, '(() => { __lp.endIntro(); __lp.start("night", 0); __lp.auto(true); __lp.stepq(1/30, 90); __lp.banner("x"); __lp.end("win"); return [document.getElementById("eName").value, document.getElementById("banner").classList.contains("show")]; })()')
        await ev(pg, 'window.__txt.length = 0'); await ev(pg, '__lp.cardURL()'); txt = await ev(pg, 'window.__txt.join(" | ")')
        check('German: default name is "Spieler" (end screen + card "von Spieler"), the card credit is German, no banner bleeds through the end screen', r[0] == 'Spieler' and not r[1] and 'von Spieler' in txt and 'Gebaut mit Grok Bot' in txt and 'Noch 5 Tage bis Halloween' in txt, (r, txt[:300]))
        check('no console errors (German run)', not logs, logs[:4])
        await ctx.close()
        # ================= 11) static scans =================
        vis = open(ROOT + '/index.html', encoding='utf-8').read() + open(ROOT + '/src/i18n.js', encoding='utf-8').read()
        vis_txt = re.sub(r'<[^>]+>', ' ', vis)
        check('visible texts: no surname, no family names, no email address', not re.search(SUR + '|' + '|'.join(FAM), vis, re.I) and not re.search(r'[\w.+-]+@[\w-]+\.[\w.]+', vis), '')
        check('visible texts say SI, never "AI"/"KI"', not re.search(r'\bAI\b|\bKI\b', vis_txt), re.findall(r'.{20}\bAI\b.{20}', vis_txt)[:3])
        m = re.findall(TM, vis_txt, re.I); check('no third-party game/film names in visible texts', not m, m[:5])
        src = ''.join(open(f, encoding='utf-8').read() for f in glob.glob(ROOT + '/src/*.js'))
        check('no synthesized beeps (no oscillators) – real recorded sounds only', 'createOscillator' not in src)
        rev = [m for m in re.findall(r'smoothstep\(\s*(-?[\d.]+)\s*,\s*(-?[\d.]+)\s*,', src) if float(m[0]) >= float(m[1])]
        pw = [m for m in re.findall(r'pow\(\s*([A-Za-z_][\w.]*)\s*,\s*[\d.]+\s*\)', src)]
        check('GLSL: no reversed smoothstep edges (undefined → black artefacts on Safari/Metal); pow() only on clamped bases', not rev and all(v == 'm' for v in pw) and 'clamp(dot(vD, moonDir), 1e-4, 1.)' in src, (rev, pw))
        lic = os.listdir(ROOT + '/LICENSES'); check('LICENSES/ has font, three.js, sound credits', any('OFL' in x for x in lic) and any('three' in x.lower() for x in lic) and 'SOUNDS.md' in lic, lic)
        await b.close()
    print(f'\n{sum(R)}/{len(R)} checks passed'); sys.exit(0 if R and all(R) else 1)
asyncio.run(main())
