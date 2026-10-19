"""Phone test for the Heart Meter. Runs the real index.html against a fake backend.
Run: <python with playwright> tests/movil.py"""
import asyncio, json, os, sys, http.server, threading, functools
from playwright.async_api import async_playwright

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SHOTS = sys.argv[1] if len(sys.argv) > 1 else "/tmp"
LEADERS = ["Ava","Bishop","Catherine","Ceci","Charlotte","Ella","Emerson","Kate","Lesley","Libby","Maddie","Maeve","Mary Claire","Philip","Sophie","Teresa","Yve"]
fails = 0
def ok(c, m):
    global fails
    print(("ok   " if c else "FAIL ") + m)
    if not c: fails += 1

def serve():
    class Quiet(http.server.SimpleHTTPRequestHandler):
        def log_message(self, *a): pass
    h = functools.partial(Quiet, directory=ROOT)
    
    srv = http.server.ThreadingHTTPServer(("127.0.0.1", 0), h)
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    return srv

async def run(p, device_name, viewport=None):
    srv = serve()
    port = srv.server_address[1]
    db = {"donations": [], "outreach": [], "posts": []}
    b = await p.chromium.launch()
    ctx = await b.new_context(**(p.devices[device_name] if device_name else {"viewport": viewport, "is_mobile": True, "has_touch": True, "device_scale_factor": 2}))
    pg = await ctx.new_page()
    errors = []
    pg.on("pageerror", lambda e: errors.append(str(e)))
    pg.on("console", lambda m: m.type == "error" and errors.append(m.text))

    async def backend(route):
        req = route.request
        if req.method == "GET":
            body = {"ok": True, "settings": {"goal": 2000, "leaders": LEADERS}, "donations": db["donations"], "outreach": db["outreach"]}
        else:
            d = json.loads(req.post_data); db["posts"].append(d)
            if d.get("code") != "test-code": body = {"ok": False, "error": "wrong_code"}
            elif d["action"] == "add_donation":
                db["donations"].append({**{k: d[k] for k in ("leader","donor","amount","event","date","note","received","thanked")}, "id": "d%d" % len(db["donations"])}); body = {"ok": True}
            elif d["action"] == "add_outreach":
                db["outreach"].append({**{k: d[k] for k in ("leader","org","how","status","note","date")}, "id": "o%d" % len(db["outreach"])}); body = {"ok": True}
            elif d["action"] == "move":
                for o in db["outreach"]:
                    if o["id"] == d["id"]: o["status"] = d["status"]
                body = {"ok": True}
            else: body = {"ok": True}
        await route.fulfill(status=200, content_type="application/json", body=json.dumps(body))
    await pg.route("https://script.google.com/**", backend)
    await pg.route("**/config.js", lambda r: r.fulfill(content_type="application/javascript", body='window.HEART_METER_CONFIG={scriptUrl:"https://script.google.com/macros/s/TEST/exec"};'))
    await pg.goto(f"http://127.0.0.1:{port}/index.html")
    await pg.wait_for_selector(".hc")
    tag = device_name or f"{viewport['width']}px"
    W = await pg.evaluate("innerWidth")

    ok(await pg.evaluate("document.documentElement.scrollWidth <= innerWidth"), f"[{tag}] no sideways scroll at {W}px")
    ok(await pg.locator(".hc").count() == 17, f"[{tag}] 17 hearts render")
    await pg.screenshot(path=f"{SHOTS}/movil-{tag.replace(' ','_')}-top.png")

    # sticky bar stays on screen after scrolling to the bottom
    await pg.evaluate("scrollTo(0, document.body.scrollHeight)")
    await pg.wait_for_timeout(300)
    box = await pg.locator("#openGift").bounding_box()
    vh = await pg.evaluate("innerHeight")
    ok(box and box["y"] + box["height"] <= vh and box["y"] > vh * 0.7, f"[{tag}] Log a donation stays pinned at the bottom")
    ok(box["height"] >= 44, f"[{tag}] button is at least 44px tall ({box['height']:.0f})")

    # open the form from the bottom of the page
    await pg.locator("#openGift").tap()
    await pg.wait_for_timeout(1500)
    fb = await pg.locator("#giftForm").bounding_box()
    ok(fb["y"] >= 0 and fb["y"] < vh * 0.5 and await pg.evaluate("document.activeElement.id") == "g-leader", f"[{tag}] tapping it scrolls the form into view and focuses the name")
    sizes = await pg.evaluate("[...document.querySelectorAll('#giftForm input,#giftForm select')].filter(e=>e.type!=='checkbox').map(e=>parseFloat(getComputedStyle(e).fontSize))")
    sb = await pg.locator("#giftForm button[type=submit]").bounding_box()
    ok(sb["height"] < 60, f"[{tag}] Save button text fits on one line")
    tops = await pg.evaluate("[...document.querySelectorAll('.tab')].map(t=>Math.round(t.getBoundingClientRect().top))")
    ok(len(set(tops)) == 1, f"[{tag}] the three tabs sit on one line")
    rows = await pg.evaluate("new Set([...document.querySelectorAll('.hc')].slice(0,3).map(h=>Math.round(h.getBoundingClientRect().top))).size")
    ok(rows == 1, f"[{tag}] three hearts per row")
    ok(min(sizes) >= 16, f"[{tag}] inputs are 16px or more, so iPhone does not zoom in")
    ok(await pg.evaluate("document.documentElement.scrollWidth <= innerWidth"), f"[{tag}] open form does not cause sideways scroll")

    # wrong code
    await pg.select_option("#g-leader", "Kate")
    await pg.fill("#g-donor", "Test Donor")
    await pg.fill("#g-amount", "1990")
    await pg.fill("#g-code", "bad")
    await pg.locator("#giftForm button[type=submit]").tap()
    await pg.wait_for_timeout(500)
    ok("not right" in (await pg.text_content("#giftMsg")), f"[{tag}] wrong code shows a clear message")

    # right code
    await pg.fill("#g-code", "test-code")
    await pg.locator("#giftForm button[type=submit]").tap()
    await pg.wait_for_timeout(800)
    ok("Added $1,990" in (await pg.text_content("#giftMsg")), f"[{tag}] donation saves with the right code")
    last = db["posts"][-1]
    ok(last["leader"] == "Kate" and last["amount"] == 1990 and last["donor"] == "Test Donor", f"[{tag}] backend got the right leader, donor and amount")
    kate = pg.locator(".hc", has_text="Kate")
    ok("$1,990" in (await kate.text_content()), f"[{tag}] Kate's heart updates to $1,990")

    # crossing the goal
    await pg.fill("#g-donor", "Second Donor"); await pg.fill("#g-amount", "20")
    await pg.locator("#giftForm button[type=submit]").tap()
    await pg.wait_for_timeout(800)
    ok("hit the $2,000 goal" in (await pg.text_content("#giftMsg")), f"[{tag}] crossing $2,000 celebrates")
    ok("Goal reached" in (await kate.text_content()), f"[{tag}] Kate shows Goal reached")
    await pg.screenshot(path=f"{SHOTS}/movil-{tag.replace(' ','_')}-form.png")

    # code and name are remembered after reload
    await pg.reload(); await pg.wait_for_selector(".hc")
    ok(await pg.input_value("#g-code") == "test-code", f"[{tag}] team code is remembered")
    ok(await pg.input_value("#g-leader") == "Kate", f"[{tag}] leader name is remembered")

    # outreach
    await pg.locator("#openOut").tap(); await pg.wait_for_timeout(600)
    await pg.fill("#o-org", "Dirty Coast"); await pg.select_option("#o-status", "waiting")
    await pg.locator("#outForm button[type=submit]").tap(); await pg.wait_for_timeout(800)
    ok("Added Dirty Coast" in (await pg.text_content("#outMsg")), f"[{tag}] outreach saves")
    await pg.locator("#tab-out").tap(); await pg.wait_for_timeout(300)
    ok(await pg.locator("#pane-out").is_visible() and "Dirty Coast" in (await pg.text_content("#board")), f"[{tag}] outreach board tab shows it")
    await pg.select_option("[data-move]", "yes"); await pg.wait_for_timeout(800)
    ok(db["posts"][-1]["action"] == "move" and db["posts"][-1]["status"] == "yes", f"[{tag}] status can be moved to Said yes")
    ok(await pg.evaluate("document.documentElement.scrollWidth <= innerWidth"), f"[{tag}] outreach board fits the screen")

    # donations table scrolls inside its box, not the page
    await pg.locator("#tab-gifts").tap(); await pg.wait_for_timeout(300)
    ok(await pg.evaluate("document.documentElement.scrollWidth <= innerWidth"), f"[{tag}] donations table does not push the page sideways")
    # last row not hidden behind the pinned bar
    await pg.evaluate("scrollTo(0, document.body.scrollHeight)"); await pg.wait_for_timeout(300)
    rb = await pg.locator("#giftRows tr").last.bounding_box(); bar = await pg.locator(".actions").bounding_box()
    ok(rb["y"] + rb["height"] <= bar["y"] + 1, f"[{tag}] last row is not hidden behind the pinned buttons")
    await pg.screenshot(path=f"{SHOTS}/movil-{tag.replace(' ','_')}-bottom.png")
    ok(not errors, f"[{tag}] no errors in the console" + ("" if not errors else ": " + errors[0][:120]))
    await b.close(); srv.shutdown()

async def main():
    async with async_playwright() as p:
        await run(p, "iPhone 13")
        await run(p, None, {"width": 360, "height": 740})
        await run(p, "iPhone SE")
    print("\n" + (f"{fails} check(s) failed" if fails else "all phone checks passed"))
    sys.exit(1 if fails else 0)
asyncio.run(main())
