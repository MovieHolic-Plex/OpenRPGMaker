"""Assemble ~/claude-viz/field-foes-1.html (self-contained) from the comparison run in WORK (default /tmp/ff)."""
import base64, html, sys
from pathlib import Path

WORK = Path(sys.argv[1] if len(sys.argv) > 1 else "/tmp/ff")
OUT = Path.home() / "claude-viz/field-foes-1.html"
b64 = lambda p: base64.b64encode(Path(p).read_bytes()).decode()
img = lambda p, w=None, cls="": f'<img class="{cls}" src="data:image/png;base64,{b64(p)}"{f" width={w}" if w else ""}>'

OPTIONS = [
    ("base", "Today (shipping)", "The battle battler itself, fitted to a 2-tile box by the renderer. No frames, no facing, no shadow.",
     ["Exact identity with battle (it IS the battle sprite)", "Zero cost, already covers all ~140 species"],
     ["Static: slides across the map like a sticker, no idle life", "Never turns; side-view art moonwalks when it walks the other way", "No ground shadow, no outline; dark species sink into foliage", "Non-integer downscale of 64px art blurs line work"],
     "Free (current)."),
    ("a", "A · derived from the battler", "Auto: the battler's 3 idle frames, pixel-pooled to ~1.5 tiles, 1px dark outline, baked soft shadow, mirrored for left/right, squash/stretch step + 1px bob, stepping idle.",
     ["Fully automatic for any generated or user battler: one function, no art", "Identity kept: same shape and palette you fight", "Alive: idle/step animation, faces the way it moves, grounded by a shadow"],
     ["1/3 downscale eats detail: spider becomes a purple lump, wolf loses its spikes", "Side view only: up/down rows reuse a mirrored profile (no true front/back)", "Dark species still weak on dark foliage without a light rim"],
     "~1 day: bake at load (canvas) or at export; per-species cost 0. Needs a size rule for big bosses."),
    ("b", "B · hand-dotted 4-direction charsets", "Code hand-dotted RM2000 charsets in 3/4 view for wolf, spider, wisp, boar only (true front/back/side, walking legs). 3/4 object gate NOT passed (no receipt).",
     ["Real 3/4 field art: front and back views, legs walk", "Cleanest silhouettes at 1x (spider, boar, wisp side views)", "Same look as party/NPC charsets"],
     ["Wolf front/back reads as an armoured block, not the battle wolf", "Per-species hand work + gate review; cannot cover 140 species or user enemies", "Walk frames subtle in front/back views"],
     "~1-2 h hand-dot + gate per species → 140 species ≈ weeks; user-made enemies never get one."),
    ("c", "C · encounter symbol", "Area-tinted mist blob with glowing eyes (Persona / Mana style). Every foe on a map uses the area symbol.",
     ["Reads instantly as 'enemy' at any size", "Zero per-species cost, trivially applies to every game", "Mood/tint per area is cheap theming"],
     ["Kills identity: wolf, spider, wisp, boar are the same blob", "Player cannot choose or avoid fights by type", "Breaks the 'field matches battle' rule the editor enforces today", "Generic; looks like placeholder art in a fantasy forest"],
     "~0.5 day for the symbol set; per-species cost 0."),
    ("d", "D · hybrid (A + area danger aura)", "A, fitted slightly smaller, plus a thin area-tinted (amber) aura that pulses with the step frames.",
     ["Everything A gives, automatic", "Aura adds an 'enemy' cue and lifts dark sprites off foliage"],
     ["At 1x the aura is thin; on the brown boar over a brown path it reads as a fringe artefact", "Smaller fit loses a little more detail than A"],
     "Same as A (+ aura colour per area)."),
]

REVIEW = """<p><b>Independent reviewer (Sonnet, saw the 3x crops, 1x screens, sheets and battle sprites): A &gt; D &gt; B &gt; today &gt; C.</b></p>
<table><tr><th></th><th>readability 1x</th><th>identity vs battle</th><th>appeal vs CT / Sea of Stars</th></tr>
<tr><td>A</td><td>7</td><td>8</td><td>7</td></tr><tr><td>D</td><td>7</td><td>8</td><td>6</td></tr>
<tr><td>B</td><td>8</td><td>6</td><td>7</td></tr><tr><td>today</td><td>6</td><td>10</td><td>4</td></tr><tr><td>C</td><td>9</td><td>1</td><td>3</td></tr></table>
<ul><li>A: spider is a dark lump at 1x; the downscale eats the wolf's spikes. Wisp is the best-looking monster in the set.</li>
<li>D: the aura vanishes at 1x and on the boar over the path it reads as an orange artefact.</li>
<li>B: clean read, but the wolf front/back is a square armoured block, and per-species cost cannot reach 140 species.</li>
<li>Today: static, unshadowed stickers; the wolf moonwalks.</li><li>C: four different monsters become the same blob.</li></ul>
<p>Reviewer's pick for every game: <b>A</b>, with a silhouette-preserving downscale (about 2 tiles / fit by longest side) and a 1px light outer rim so dark creatures separate from foliage. Aura only while chasing, opt-in.</p>"""

parts = ["""<!doctype html><html lang="en"><meta charset="utf-8"><title>Field foes · look comparison</title>
<style>body{background:#14171a;color:#dde3e6;font:15px/1.5 system-ui,sans-serif;margin:24px;max-width:1500px}
h1{font-size:22px}h2{font-size:18px;margin-top:36px;border-top:1px solid #333;padding-top:16px}
.vids{display:grid;grid-template-columns:repeat(auto-fill,minmax(490px,1fr));gap:14px}
figure{margin:0}figcaption{font-size:13px;color:#9aa6ad}
video,img.px{image-rendering:pixelated;border:1px solid #333}
.row{display:flex;gap:14px;flex-wrap:wrap;align-items:flex-start}
table{border-collapse:collapse;margin:8px 0}td,th{border:1px solid #333;padding:4px 10px;text-align:left}
.pro{color:#9fd49a}.con{color:#f0a49a}.rec{background:#1e2a22;border:1px solid #3d5a45;padding:12px 16px;border-radius:6px}
</style>
<h1>Fallen Star · visible field monsters — five looks on the real B1 forest edge</h1>
<p>All clips are the shipped player (player.html, dev build of the Fallen Star demo) at true 1x (480×270, 16px tiles), shown at 1x; use the fullscreen button to enlarge.
The heroes stand still; the wolf patrols, sees them ("!"), rushes, and the battle opens. Spider, wisp and boar are staged next to the path so all four forest species share one screen
(boar is the edge-area enemy from PR #3335).</p>
<div class="vids">"""]
for key, title, *_ in OPTIONS:
    parts.append(f'<figure><video src="data:video/mp4;base64,{b64(WORK / f"chase-{key}.mp4")}" width="480" height="270" autoplay loop muted playsinline controls></video><figcaption>{html.escape(title)} — chase at 1x</figcaption></figure>')
parts.append("</div>")
parts.append(f"""<div class="rec"><h2 style="border:0;margin-top:0">Recommendation</h2>
<p><b>Ship A as the automatic default for every game and enemy</b>, with the reviewer's two fixes: fit by longest side to about 2 tiles (an exact 2:1 pool of the 64px battler, which needs 32px-wide frames instead of RM2000 24×32), and a 1px light rim outside the dark outline for dark species.
Keep <b>B as an optional per-species override</b> for flagship games (a hand charset wins where it exists), and use D's aura only as an opt-in "now chasing" cue, not at rest. Do not use C as a default: it breaks the field-matches-battle rule.</p></div>
<h2>Independent review</h2>{REVIEW}
<h2>Battle sprites (identity reference)</h2>{img(WORK / "review/battle-portraits-2x.png", cls="px")}""")
for key, title, desc, pros, cons, cost in OPTIONS:
    parts.append(f"<h2>{html.escape(title)}</h2><p>{html.escape(desc)}</p><div class='row'>")
    parts.append(f"<figure>{img(WORK / f'review/{key}-1x.png', cls='px')}<figcaption>1x full screen</figcaption></figure>")
    parts.append(f"<figure>{img(WORK / f'review/{key}-3x-crop.png', cls='px')}<figcaption>3x crop, same moment</figcaption></figure>")
    parts.append(f"<figure>{img(WORK / f'review/{key}-3x-chase.png', cls='px')}<figcaption>3x mid-chase</figcaption></figure>")
    if key != "base":
        parts.append(f"<figure>{img(WORK / f'review/{key}-sheet-3x.png', cls='px')}<figcaption>charset 3x (rows up/right/down/left; slots wolf, spider, wisp, boar{'; C = 4 area tints' if key == 'c' else ''})</figcaption></figure>")
    parts.append("</div><ul>" + "".join(f"<li class=pro>+ {html.escape(p)}</li>" for p in pros) + "".join(f"<li class=con>− {html.escape(c)}</li>" for c in cons) + f"</ul><p><b>Cost for all games/enemies:</b> {html.escape(cost)}</p>")
parts.append("<script>addEventListener('load',()=>{const v=[...document.querySelectorAll('video')];v.forEach(x=>{x.currentTime=0;x.play().catch(()=>{})})})</script>")
parts.append("<p style='color:#9aa6ad'>Prototype only (branch agent/field-foes, scripts/content/field-foes). New art in A, B, C and D has no object-gate receipt: 3/4 gate not passed.</p></html>")
OUT.write_text("".join(parts))
print(OUT, OUT.stat().st_size)
