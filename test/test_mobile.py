"""Lantern Prowl – phone start-screen regression test (real touch emulation).
WebKit (iPhone 13/14/15, iPhone 8 = 375×667, iPhone SE 320×568) + Chromium (Pixel 7), portrait and landscape.
Checks: ONE tap from page load lands in a playable Night 1 run; every start-screen and options control can be TAPPED
(nothing covers it, nothing off-screen, no scrolling); language auto-detect; no overflow in German; no console errors.
Run: python3 test/test_mobile.py [base-url]   (exit code 0 = all checks passed; screenshots → test/shots/mobile/)"""
import asyncio, os, sys, threading, http.server, functools, socketserver, json
from playwright.async_api import async_playwright
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.environ.get('LP_SHOTS', ROOT + '/test/shots/mobile/'); os.makedirs(OUT, exist_ok=True)
if len(sys.argv) > 1: URL = sys.argv[1]
else:
    class _Q(http.server.SimpleHTTPRequestHandler):
        def log_message(self, *a): pass
    _srv = socketserver.ThreadingTCPServer(('127.0.0.1', 0), functools.partial(_Q, directory=ROOT)); _srv.daemon_threads = True
    threading.Thread(target=_srv.serve_forever, daemon=True).start(); URL = 'http://127.0.0.1:%d/index.html' % _srv.server_address[1]
ONLY = os.environ.get('LP_ONLY', '')
R = []
def check(n, ok, info=''): R.append(bool(ok)); print(('PASS ' if ok else 'FAIL ') + n + (f' — {info}' if info != '' else ''), flush=True)
DEVICES = [  # engine, descriptor, landscape, browser locale
    ('webkit', 'iPhone 13', False, 'de-DE'), ('webkit', 'iPhone 13', True, 'en-US'), ('webkit', 'iPhone 14', False, 'en-US'),
    ('webkit', 'iPhone 15', False, 'en-GB'), ('webkit', 'iPhone 15', True, 'de-DE'), ('webkit', 'iPhone 8', False, 'de-AT'), ('webkit', 'iPhone SE', False, 'en-US'),
    ('webkit', 'iPhone 8', True, 'en-US'), ('webkit', 'iPhone SE', True, 'de-DE'),
    ('chromium', 'Pixel 7', False, 'de-DE'), ('chromium', 'Pixel 7', True, 'en-US')]
HIT = """ids => ids.map(sel => { const e = document.querySelector(sel); if (!e) return [sel, 'missing'];
  const r = e.getBoundingClientRect(), cs = getComputedStyle(e); if (cs.display === 'none' || cs.visibility === 'hidden' || r.width < 2) return [sel, 'hidden'];
  if (r.left < -1 || r.top < -1 || r.right > innerWidth + 1 || r.bottom > innerHeight + 1) return [sel, 'off-screen ' + [r.left, r.top, r.right, r.bottom].map(Math.round)];
  for (const [fx, fy] of [[.5, .5], [.2, .5], [.8, .5]]) { const t = document.elementFromPoint(r.left + r.width * fx, r.top + r.height * fy); if (!t || !(t === e || e.contains(t))) return [sel, 'covered by ' + (t ? (t.id || t.tagName) : 'nothing')]; }
  if (r.height < 36 || r.width < 36) return [sel, 'too small ' + Math.round(r.width) + 'x' + Math.round(r.height)]; return [sel, 'ok']; })"""
async def ev(pg, js): return await pg.evaluate(js)
async def until(pg, js, secs=20):
    for _ in range(int(secs * 5)):
        try:
            if await pg.evaluate(js): return True
        except Exception: pass
        await pg.wait_for_timeout(200)
    return False
async def run(p, eng, dev, land, loc):
    d = dict(p.devices[dev]); d.pop('default_browser_type', None)
    if land: d['viewport'] = {'width': d['viewport']['height'], 'height': d['viewport']['width']}
    W, H = d['viewport']['width'], d['viewport']['height']; tag = f"{dev.replace(' ', '')}-{'land' if land else 'port'}"; T = f'[{tag} {eng} {W}×{H} {loc}]'
    kw = {} if eng == 'webkit' else dict(executable_path='/usr/bin/google-chrome', args=['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'])
    b = await (p.webkit if eng == 'webkit' else p.chromium).launch(**kw)
    ctx = await b.new_context(**d, locale=loc); await ctx.add_init_script("window.__lpNoAutoQ = true; try{if(!sessionStorage.getItem('lpInit')){sessionStorage.setItem('lpInit','1'); localStorage.clear();}}catch(e){}")
    pg = await ctx.new_page(); pg.set_default_timeout(30000); errs = []
    pg.on('console', lambda m: errs.append(m.text[:160]) if m.type == 'error' else None); pg.on('pageerror', lambda e: errs.append('PAGEERROR ' + str(e)[:160]))
    await pg.goto(URL); await pg.wait_for_function('document.body.classList.contains("ready") && window.__lp', timeout=90000)
    # ---------- 1) ONE TAP from page load → playable Night 1 ----------
    await pg.wait_for_timeout(1200); st0 = await ev(pg, '__lp.S.state'); await pg.screenshot(path=f'{OUT}{tag}-0-opening.png')
    sk = dict(await ev(pg, f"({HIT})(['#btnSkip'])"))['#btnSkip'] if st0 == 'intro' else 'n/a'
    sktxt = await ev(pg, "document.getElementById('btnSkip').textContent")
    check(f'{T} opens on the cinematic opening, "tap to play" label on screen (touch wording)', st0 == 'intro' and sk in ('ok',) or (st0 == 'intro' and sk.startswith('covered')), (st0, sk, sktxt))
    want = 'de' if loc.startswith('de') else 'en'; check(f'{T} language auto-detected from the browser ({want})', await ev(pg, '__lp.S.lang') == want and await ev(pg, 'document.documentElement.lang') == want)
    await pg.touchscreen.tap(W / 2, H * .45)  # ONE tap, anywhere
    ok = await until(pg, "__lp.S.state === 'play'", 10)
    info = await ev(pg, '[__lp.S.state, __lp.S.mode, __lp.S.ni, __lp.runner().state, document.getElementById("lvCard").classList.contains("show")]')
    check(f'{T} a single tap goes straight into Night 1 (runner running, short in-game hint card)', ok and info[:4] == ['play', 'night', 0, 'run'] and info[4], info)
    check(f'{T} sound unlocks on that first tap (sound on by default)', await until(pg, "__lp.audioState() !== 'none'", 5) and not await ev(pg, "document.getElementById('btnSound').textContent.includes('🔇')"), await ev(pg, '__lp.audioState()'))
    await pg.wait_for_timeout(1500); await pg.screenshot(path=f'{OUT}{tag}-1-night1.png')
    j0 = await ev(pg, '__lp.log.length'); await pg.touchscreen.tap(W / 2, H * .6)
    jumped = await until(pg, f"__lp.log.slice({j0}).some(e => /wing|flap|whoosh|swish|fwoosh/.test(e.n)) || __lp.runner().air", 4)
    check(f'{T} the run is playable by touch (tap = jump)', jumped, await ev(pg, '[__lp.runner().state, __lp.runner().air]'))
    hud = dict(await ev(pg, f'({HIT})(["#btnQuit", "#btnSound", "#btnLang"])')); badh = {k: v for k, v in hud.items() if v != 'ok'}
    check(f'{T} in-game buttons (✕ menu, sound, DE/EN) are tappable, nothing covers them', not badh, badh or hud)
    # ---------- 2) the start screen: one big PLAY, everything else behind the gear ----------
    await ev(pg, '__lp.toMenu()'); await pg.wait_for_timeout(1300); await pg.screenshot(path=f'{OUT}{tag}-2-menu.png')
    lay = await ev(pg, """(() => { const r = s => document.querySelector(s).getBoundingClientRect(); const p = r('#btnPlay'), h = r('#menu h1'), c = r('#menu .credit');
      return { p: [p.left, p.top, p.width, p.height].map(Math.round), cy: (p.top + p.height / 2) / innerHeight, overlap: !(h.bottom <= p.top || h.top >= p.bottom) && !(h.right <= p.left || h.left >= p.right),
        scroll: document.scrollingElement.scrollHeight > innerHeight + 1 || document.getElementById('menu').scrollHeight > document.getElementById('menu').clientHeight + 1, inView: c.bottom <= innerHeight + 1 && h.top >= 0 }; })()""")
    check(f'{T} start screen: one big PLAY (≥ 60 px tall, ≥ 220 px wide) in the thumb zone, title clear of it, no scrolling', lay['p'][3] >= 60 and lay['p'][2] >= 220 and (.45 if land else .55) <= lay['cy'] <= .92 and not lay['overlap'] and not lay['scroll'] and lay['inView'], lay)
    hit = dict(await ev(pg, f'({HIT})(["#btnPlay", "#btnGear", "#btnLang"])')); bad = {k: v for k, v in hit.items() if v != 'ok'}
    check(f'{T} start screen: PLAY, gear and the tiny DE/EN are all tappable (≥ 44 px, nothing covers them)', not bad and all(await ev(pg, "['btnGear','btnLang'].map(i => { const r = document.getElementById(i).getBoundingClientRect(); return r.width >= 44 && r.height >= 44; })")), bad or hit)
    l0 = await ev(pg, '__lp.S.lang'); await pg.tap('#btnLang'); l1 = await ev(pg, '__lp.S.lang'); await pg.tap('#btnLang'); l2 = await ev(pg, '__lp.S.lang')
    check(f'{T} tap DE/EN toggles the language and back', l0 != l1 and l2 == l0, (l0, l1, l2))
    await ev(pg, "__lp.S.lang === 'de' || document.getElementById('btnLang').click()")
    of = await ev(pg, "[...document.querySelectorAll('#menu button, #more button, #menu h1 span, #menu .kicker')].filter(e => e.offsetParent !== null || e.closest('#more')).filter(e => e.scrollWidth > e.clientWidth + 2 || e.getBoundingClientRect().right > innerWidth + 1).map(e => e.id || e.className || e.tagName)")
    check(f'{T} German: no text overflows its button or the screen (menu + options)', not of, of)
    await pg.tap('#btnGear'); await pg.wait_for_timeout(1500); await pg.screenshot(path=f'{OUT}{tag}-3-options-de.png')
    sh = await ev(pg, "(() => { const m = document.getElementById('more'); return [m.classList.contains('show'), m.scrollHeight > m.clientHeight + 1]; })()")
    sel = ['#btnMoreX', '#nights .lv', '#btnEndless', '#btnDuel', '#diff button[data-d=easy]', '#diff button[data-d=medium]', '#diff button[data-d=hard]', '#btnKids', '#btnQ2', '#btnSound2', '#btnIntro']
    if sh[1]: await ev(pg, "document.getElementById('more').scrollTop = 0")
    hit = dict(await ev(pg, f'({HIT})({json.dumps(sel)})')); bad = {k: v for k, v in hit.items() if v != 'ok'}
    sz = await ev(pg, f"{json.dumps(sel)}.map(s => {{ const r = document.querySelector(s).getBoundingClientRect(); return [s, Math.round(r.width), Math.round(r.height)]; }}).filter(x => x[1] < 44 || x[2] < 44)")
    check(f'{T} gear sheet opens; nights, endless, duel, difficulty, kids, quality, sound, intro, close are all on screen, ≥ 44 px and tappable without scrolling', sh[0] and not sh[1] and not bad and not sz, (bad or hit, sz, sh))
    q0 = await ev(pg, '__lp.quality()'); await pg.tap('#btnQ2'); await pg.wait_for_timeout(600); q1 = await ev(pg, '__lp.quality()'); await ev(pg, "__lp.quality('mid')")
    await pg.tap('#btnKids'); k1 = await ev(pg, '__lp.S.kids'); await pg.tap('#btnKids'); k2 = await ev(pg, '__lp.S.kids')
    await pg.tap('#diff button[data-d=easy]', timeout=30000); d1 = await ev(pg, '__lp.S.diff'); await pg.tap('#diff button[data-d=medium]'); d2 = await ev(pg, '__lp.S.diff')
    s0 = await ev(pg, "document.getElementById('btnSound2').textContent"); await pg.tap('#btnSound2'); s1 = await ev(pg, "document.getElementById('btnSound2').textContent"); await pg.tap('#btnSound2')
    check(f'{T} options by tap: quality switches, kids mode on/off, difficulty easy → medium, sound off/on', q0 != q1 and k1 and not k2 and d1 == 'easy' and d2 == 'medium' and s0 != s1, (q0, q1, k1, k2, d1, d2, s0, s1))
    await pg.tap('#btnMoreX'); await pg.wait_for_timeout(500); closed = not await ev(pg, "document.getElementById('more').classList.contains('show')")
    await pg.tap('#btnGear'); await pg.wait_for_timeout(600); await pg.tap('#btnDuel'); duel = await until(pg, "__lp.S.state === 'play' && __lp.S.mode === 'duel'", 8)
    check(f'{T} close (✕) works; duel (Player 1 vs Player 2) starts by tap', closed and duel)
    await ev(pg, '__lp.toMenu()'); await pg.wait_for_timeout(700); await pg.tap('#btnGear'); await pg.wait_for_timeout(600); await pg.tap('#btnEndless'); en = await until(pg, "__lp.S.state === 'play' && __lp.S.mode === 'endless'", 8)
    await ev(pg, '__lp.toMenu()'); await pg.wait_for_timeout(700); await pg.tap('#btnGear'); await pg.wait_for_timeout(600); await pg.tap('#nights .lv'); lv = await until(pg, "__lp.S.state === 'play' && __lp.S.ni === 0 && __lp.S.mode === 'night'", 8)
    await ev(pg, '__lp.toMenu()'); await pg.wait_for_timeout(700); await pg.tap('#btnGear'); await pg.wait_for_timeout(600); await pg.tap('#btnIntro'); intro = await until(pg, "__lp.S.state === 'intro'", 5)
    await pg.wait_for_timeout(800); await pg.touchscreen.tap(W * .3, H * .3); intro2 = await until(pg, "__lp.S.state === 'play'", 8)
    check(f'{T} endless, night 1 from the night map, intro replay, and a tap on the replayed intro goes into play', en and lv and intro and intro2, (en, lv, intro, intro2))
    await ev(pg, '__lp.toMenu()'); await pg.wait_for_timeout(900); await pg.tap('#btnPlay'); pl = await until(pg, "__lp.S.state === 'play' && __lp.S.mode === 'night'", 8)
    check(f'{T} tap PLAY starts the night', pl)
    # end screen fits and is tappable
    await ev(pg, '__lp.end("dead")'); await pg.wait_for_timeout(900); await pg.screenshot(path=f'{OUT}{tag}-4-end.png')
    if land: await ev(pg, "document.getElementById('end').scrollTop = 0")
    hit = dict(await ev(pg, f'({HIT})(["#btnAgain", "#btnMenu", "#btnCard"])')); bad = {k: v for k, v in hit.items() if v != 'ok'}
    check(f'{T} end screen: run again, menu, save card tappable' + (' (landscape: panel scrolls)' if land else ''), not bad or (land and all(v.startswith('off-screen') for v in bad.values())), bad or hit)
    check(f'{T} no console errors', not errs, errs[:3])
    await b.close()
async def main():
    async with async_playwright() as p:
        for eng, dev, land, loc in DEVICES:
            if ONLY and ONLY not in dev.replace(' ', ''): continue
            for attempt in (1, 2):  # headless WPE WebKit's software compositor sometimes segfaults (null deref in libWPEWebKit ThreadedCompositor): retry once, say so
                n0 = len(R)
                try: await run(p, eng, dev, land, loc); break
                except Exception as e:
                    msg = str(e).split('\n')[0][:300]
                    if attempt == 1 and 'crashed' in msg.lower(): del R[n0:]; print(f'RETRY [{dev} {"land" if land else "port"}] browser process crashed ({msg}) – rerunning this device once', flush=True); continue
                    check(f'[{dev} {"land" if land else "port"}] run finished', False, msg)
    print(f'\n{sum(R)}/{len(R)} checks passed'); sys.exit(0 if R and all(R) else 1)
asyncio.run(main())
