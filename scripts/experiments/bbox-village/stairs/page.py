#!/usr/bin/env python3
"""~/claude-viz/stairs-per-tileset.html — cliff cut pieces per relief style (forward + reverse), probes, model runs, VQA.
  python3 page.py            (run from the worktree root; images go to ~/claude-viz/stairs-per-tileset/)"""
import glob, html, json, os
from PIL import Image
HOME = os.path.expanduser("~"); ROOT = os.getcwd()
S = f"{ROOT}/scripts/experiments/bbox-village/stairs"; GR = f"{ROOT}/scripts/experiments/bbox-village/ramps/png"
VIZ = f"{HOME}/claude-viz"; IMG = f"{VIZ}/stairs-per-tileset"; os.makedirs(IMG, exist_ok=True)
RUNS = f"{HOME}/z-project/assistant-whole-game/suite/rooms/runs-stairs"
STYLES = [("grass-steps", "풀밭(버들항 마을·숲 던전)"), ("sand-steps", "사막(버들항 사막·피라미드)"), ("snow-steps", "설원(버들항 설원·얼음 던전)"),
          ("peat-steps", "늪(버들항 늪 마을·늪 던전)"), ("cave-steps", "동굴(던전 기본)")]
def save(im, name, k):
    im = im.convert("RGB"); im.resize((im.width * k, im.height * k), Image.NEAREST).save(f"{IMG}/{name}"); return f"stairs-per-tileset/{name}"
def strip(paths, name, k=4):
    ims = [Image.open(p).convert("RGB") for p in paths if os.path.exists(p)]
    if not ims: return ""
    Wt = sum(i.width + 4 for i in ims) + 4; Ht = max(i.height for i in ims) + 8
    sh = Image.new("RGB", (Wt, Ht), (24, 24, 30)); x = 4
    for i in ims: sh.paste(i, (x, Ht - 4 - i.height)); x += i.width + 4
    return save(sh, name, k)
def names(): return [f"{k}-h{r}-w{w}" for k in ("ramp", "stairs") for r in (1, 2, 3, 4) for w in (2, 3)]
def vqa(prefix):
    out = []
    for f in sorted(glob.glob(f"{ROOT}/harness-data/object-gate/vqa/{prefix}.opus-vqa-r*.json")):
        d = json.load(open(f)); P = d.get("pieces", {}); bad = [k for k, v in P.items() if v.get("verdict") != "PASS"]
        out.append(f"<tr><td>{d.get('round')}</td><td>{d.get('verdict')}</td><td>{len(P) - len(bad)}/{len(P)}</td><td class=why>{html.escape(', '.join(bad) or '—')}</td><td class=why>{html.escape((d.get('summary') or '')[:420])}</td></tr>")
    return "<table><tr><th>판</th><th>판정</th><th>통과</th><th>떨어진 조각</th><th>요지</th></tr>" + "".join(out) + "</table>"
def probe_crop(p, name, rows=(3, 12)):
    if not os.path.exists(p): return ""
    im = Image.open(p); pad = im.height - 15 * 16
    return save(im.crop((0, rows[0] * 16 + pad - 64, im.width, rows[1] * 16 + pad)), name, 2)
rows = ""
for st, label in STYLES:
    fwd_dir = GR if st == "grass-steps" else f"{S}/fwd/{st}"
    f = strip([f"{fwd_dir}/{n}.png" for n in names()], f"{st}-fwd.png")
    r = strip([f"{S}/rev/{st}/{n}.png" for n in names()], f"{st}-rev.png")
    pf = probe_crop(f"{S}/fwd/{st}-probe.png", f"{st}-probe-fwd.png") if st != "grass-steps" else probe_crop("/tmp/stairs/grass-steps-s.png", f"{st}-probe-fwd.png")
    pr = probe_crop(f"{S}/rev/probe/{st}.png", f"{st}-probe-rev.png")
    rows += f"""<h3>{st} · {html.escape(label)}</h3>
<p class=c>정방향(남향 절벽, 4배) — 경사로 h1~h4 ×w2·w3, 계단 h1~h4 ×w2·w3</p><img src='{f}'>
<p class=c>역방향(북향 절벽, 4배) — 같은 순서, 조각마다 2줄(32px)</p><img src='{r}'>
<div class=row><figure><img src='{pf}'><figcaption>실제 렌더: 정방향(2배)</figcaption></figure><figure><img src='{pr}'><figcaption>실제 렌더: 역방향(2배)</figcaption></figure></div>"""
runs = ""
for d in sorted(glob.glob(f"{RUNS}/*/hill/RUN.json")):
    j = json.load(open(d)); arm = f"{j['arm']}{j['rep']}"
    if not j.get("ok"): runs += f"<li>{arm}: 실패 (수리 {j.get('repairs')}번 뒤 오류 {len(j.get('errors') or [])}건 — {html.escape((j.get('errors') or [''])[0][:160])})</li>"; continue
    lay = json.load(open(os.path.dirname(d) + "/layout.json")); rev = [c for c in lay["cuts"] if c["dir"] == "south"]
    crop = f"stairs-per-tileset/run-{arm}.png" if os.path.exists(f"{IMG}/run-{arm}.png") else ""
    runs += f"<li>{arm}: 통과 · 깎은 길 {len(lay['cuts'])}개 중 역방향 {len(rev)}개 {html.escape(json.dumps(rev))}" + (f"<br><img src='{crop}'>" if crop else "") + "</li>"
video = "stairs-per-tileset/walk.webm" if os.path.exists(f"{IMG}/walk.webm") else ""
extra = open(f"{IMG}/notes.html").read() if os.path.exists(f"{IMG}/notes.html") else ""
page = f"""<!doctype html><meta charset=utf-8><title>칩셋별 절벽 계단·경사로</title>
<style>body{{background:#16161c;color:#ddd;font:14px/1.55 system-ui,sans-serif;margin:20px;max-width:1500px}}img{{image-rendering:pixelated;max-width:100%}}
table{{border-collapse:collapse;margin:8px 0}}td,th{{border:1px solid #444;padding:4px 8px;vertical-align:top}}.why{{font-size:12px;color:#bbb}}.row{{display:flex;gap:12px;flex-wrap:wrap}}
figure{{margin:0}}figcaption,.c{{color:#9a9;font-size:12px}}h3{{margin-top:28px}}</style>
<h1>칩셋(절벽 양식)별 계단·경사로 + 역방향</h1>
{f"<p>게임(출하 플레이어)에서 깎은 길마다 올라갔다 내려오는 1배속 영상 — 역방향(북향 절벽)도 포함:</p><video src='{video}' controls loop autoplay muted style='max-width:100%;image-rendering:pixelated'></video>" if video else ""}
{extra}
<h2>1. 양식별 조각과 실제 렌더</h2>{rows}
<h2>2. 독립 Opus 적대 검수</h2><p>정방향(모래·눈·이탄·동굴 64장)</p>{vqa('stairs-fwd')}<p>역방향(다섯 양식 80장)</p>{vqa('stairs-rev')}
<h2>3. 모델이 깐 언덕 마을(역방향 허용 뒤)</h2><ul>{runs}</ul>"""
open(f"{VIZ}/stairs-per-tileset.html", "w").write(page); print("ok")
