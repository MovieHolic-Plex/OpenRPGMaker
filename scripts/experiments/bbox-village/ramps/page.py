#!/usr/bin/env python3
"""~/claude-viz/bbox-village-ramps.html : new cut pieces at 8x beside the RTP shape reference, the height-1/2/3 probe with zoom crops,
old vs new village maps with zoom crops of every crossing, the v2 builder maps, judge results and the object-gate receipts.
  python3 page.py "<verdict line>"   (run from the worktree root; needs probe PNG at $RAMP_RUNS/probe.png)"""
import json, os, sys, glob, html, subprocess
from PIL import Image
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from crops import contact, crops
HOME = os.path.expanduser("~"); S = f"{HOME}/z-project/assistant-whole-game/suite/rooms"
NEW = os.environ.get("RAMP_RUNS", f"{S}/runs-bboxramps"); OLD = f"{S}/runs-bboxvillage"
VIZ = f"{HOME}/claude-viz"; IMG = f"{VIZ}/bbox-village-ramps"; os.makedirs(IMG, exist_ok=True)
HERE = os.path.dirname(os.path.abspath(__file__))
verdict = sys.argv[1] if len(sys.argv) > 1 else ""
RTP = "/home/main/.z-project-root/rpg-zzu/.ovis/paste-20261030-163324-3377c5f3.png"
def save(im, name, k=1):
    if k != 1: im = im.resize((im.width * k, im.height * k), Image.NEAREST)
    im.save(f"{IMG}/{name}"); return f"bbox-village-ramps/{name}"
# 1. pieces + RTP reference
rtp = Image.open(RTP).convert("RGB").crop((192, 64, 240, 144))
ref = save(rtp, "rtp-cut.png", 8)
pieces = []
for kind in ("ramp", "stairs"):
    for r in (1, 2, 3):
        for w in (2, 3):
            n = f"{kind}-h{r}-w{w}"; pieces.append((n, save(Image.open(f"{HERE}/png/{n}.png"), f"{n}.png", 8)))
G = {}
for gl in glob.glob(f"{HOME}/z-project/rpg-zzu-bboxramps/harness-data/object-gate/receipts/**/*.json", recursive=True):
    try: r = json.load(open(gl))
    except Exception: continue
    lab = r.get("label") or ""
    n = lab.split("/")[-1]
    if lab.startswith("bbox-village-ramps/") and r.get("decidedAt", "") > G.get(n, {}).get("decidedAt", ""): G[n] = r
def gate_cell(n):
    r = G.get(n)
    if not r: return "영수증 없음"
    v = r.get("verdict") or r.get("decision", {}).get("verdict")
    why = "; ".join(str(x) for x in (r.get("reasons") or [])[:2])
    return f"관문 {v.upper()} · 영수증 {r.get('pixelSha256', '')[:12]}" + (f" · {why}" if why and v != "pass" else "")
pc = "".join(f"<figure class=pc><img src='{p}'><figcaption>{n}<br><span class=g>{html.escape(gate_cell(n))}</span></figcaption></figure>" for n, p in pieces)
# 2. probe
probe = ""
if os.path.exists(f"{NEW}/probe.png"):
    pim = Image.open(f"{NEW}/probe.png").convert("RGB"); pj = json.load(open(f"{NEW}/probe.json"))
    probe = f"<img class=wide src='{save(pim, 'probe.png', 3)}'>"
    pad = pim.height - pj["H"] * 16; cs = ""
    for x0, w, r, kind, _ in pj["sections"]:
        c = pim.crop(((x0 - 2) * 16, (pj["CLIFF"] - 2) * 16 + pad - r * 16, (x0 + w + 2) * 16, (pj["CLIFF"] + 2) * 16 + pad))
        cs += f"<figure class=pc><img src='{save(c, f'probe-{kind}-h{r}.png', 6)}'><figcaption>{kind} · 절벽 {r}칸 → 조각 {r}칸</figcaption></figure>"
    probe += f"<div class=row>{cs}</div>"
# 3. villages
R = json.load(open(f"{NEW}/results-opus.json")) if os.path.exists(f"{NEW}/results-opus.json") else {}
def vtxt(v): return {1: "새 판 승", 0: "무", -1: "새 판 패"}.get(v, "채점 전")
sections = []
for brief in ("port", "hill"):
    t = f"{NEW}/terrain-{brief}/terrain.json"; cards = []
    for arm in ("sol", "terra"):
        runs = sorted(glob.glob(f"{NEW}/{arm}*/{brief}/RUN.json"))
        for rj in runs:
            run = os.path.dirname(rj); tag = run.split("/")[-2]; r = json.load(open(rj))
            body = f"<p class=meta>{r['model']} · 고침 {r['repairs']}회 · {r['secs']}초 · " + ("통과" if r["ok"] else "<b>검증 실패</b>: " + html.escape("; ".join(r.get("errors", [])[:2]))) + "</p>"
            if os.path.exists(f"{run}/map.png"):
                m = Image.open(f"{run}/map.png"); body += f"<img class=wide src='{save(m, f'new-{tag}-{brief}.png', 2 if m.width < 900 else 1)}'>"
                if contact(run, t, f"{IMG}/new-{tag}-{brief}-cuts.png", 4): body += f"<p class=cap>새 경사로·계단 확대(4배) — 조각 높이 = 절벽 면 높이</p><img src='bbox-village-ramps/new-{tag}-{brief}-cuts.png'>"
                st = r.get("stats", {}); body += f"<p class=meta>건물 {st.get('buildings')} · 경사로/계단 {st.get('cuts')}개(남향 {st.get('cutsSouthFacing')}) · 맨 풀밭 {st.get('bareLandPct')}%</p>"
                js = [(k, v) for k, v in R.items() if k.split("|")[1] == f"{tag}/{brief}"]
                if js: body += "<table><tr><th>판정(Opus 5.5 medium, 두 순서)</th><th>결과</th><th>높이 축</th><th>이유</th></tr>" + "".join(
                    f"<tr><td>{k.split('|')[0]} vs {k.split('|')[2]}</td><td>{vtxt(v['verdict'])}</td><td>{vtxt(v.get('height')) if k.startswith('map') else '—'}</td><td class=why>{html.escape(' / '.join(w for w in (v.get('why') or []) if w)[:600])}</td></tr>" for k, v in js) + "</table>"
            cards.append(f"<div class=card><h3>새 판 · {brief} · {tag}</h3>{body}</div>")
        old = f"{OLD}/{arm}1/{brief}"
        if os.path.exists(f"{old}/map.png"):
            m = Image.open(f"{old}/map.png"); body = f"<img class=wide src='{save(m, f'old-{arm}1-{brief}.png', 2 if m.width < 900 else 1)}'>"
            if contact(old, t, f"{IMG}/old-{arm}1-{brief}-cuts.png", 4): body += f"<p class=cap>옛 계단 확대(4배) — 절벽보다 긴 회색 돌기둥</p><img src='bbox-village-ramps/old-{arm}1-{brief}-cuts.png'>"
            cards.append(f"<div class='card old'><h3>이전 bbox 판 · {brief} · {arm}1</h3>{body}</div>")
    for arm in ("sol", "terra"):
        b = f"{OLD}/base-{arm}/{brief}/map.png"
        if os.path.exists(b):
            m = Image.open(b); cards.append(f"<div class='card base'><h3>현행 v2 빌더 · {brief} · {arm}</h3><img class=wide src='{save(m, f'base-{arm}-{brief}.png', 2 if m.width < 900 else 1)}'></div>")
    sections.append(f"<h2>{brief}</h2>" + "".join(cards))
page = f"""<!doctype html><meta charset=utf-8><title>bbox 마을 — 경사로·계단 다시 그림</title>
<style>body{{background:#16161c;color:#ddd;font:14px/1.5 sans-serif;margin:20px}}h1{{font-size:20px}}h2{{font-size:17px;margin-top:30px}}.v{{font-size:16px;color:#ffd866}}
.card{{background:#222230;border-radius:8px;padding:12px;margin:14px 0}}.old{{background:#2a2222}}.base{{background:#1d2a24}}h3{{margin:0 0 8px;font-size:15px}}
img{{image-rendering:pixelated;max-width:100%}}img.wide{{width:100%}}.row{{display:flex;flex-wrap:wrap;gap:14px;align-items:flex-end}}figure{{margin:0}}.pc figcaption{{font-size:12px;color:#aaa;max-width:420px}}
.g{{color:#8fd}}.meta,.cap{{color:#bbb;margin:6px 0}}td,th{{border:1px solid #444;padding:4px 8px;vertical-align:top}}table{{border-collapse:collapse;margin-top:6px}}.why{{font-size:12px;color:#bbb;max-width:700px}}</style>
<h1>bbox 마을 — 옛 회색 돌기둥 계단을 지우고, 절벽을 깎은 경사로·계단으로</h1>
<p class=v>{html.escape(verdict)}</p>
<h2>1. 새 조각(8배)과 RTP 참고 모양</h2>
<p>왼쪽 = EasyRPG RTP Dungeon 가운데 열의 깎인 절벽(모양 참고만, 화소는 쓰지 않았고 출하하지 않는다). 오른쪽 = 버들항 절벽 면·길 색만으로 코드 손 도트로 그린 조각.
조각 = 폭(2·3칸) × (절벽 높이 + 발치 1칸). 위 h줄이 절벽 면을 정확히 대신하고, 마지막 한 줄은 아랫단 길과 이어지는 발치다. 초록 글씨 = 3/4 관문 영수증(object-gate review, 현재 프로필은 보정 안 됨 = 조언일 뿐).</p>
<div class=row><figure class=pc><img src='{ref}'><figcaption>RTP 참고(모양만)</figcaption></figure>{pc}</div>
<h2>2. 높이 1·2·3 절벽 시험 맵</h2><p>같은 렌더러(relief)로 그린 시험 맵. 확대 그림에서 경사로·계단의 깎인 부분이 옆 절벽 면과 같은 줄 수인지 본다.</p>{probe}
<h2>3. 마을 — 새 판 · 이전 판 · 현행 v2</h2>{''.join(sections)}"""
open(f"{VIZ}/bbox-village-ramps.html", "w").write(page); print("ok")
