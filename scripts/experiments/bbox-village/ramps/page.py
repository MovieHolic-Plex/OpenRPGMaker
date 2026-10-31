#!/usr/bin/env python3
"""~/claude-viz/bbox-village-ramps.html : new cut pieces at 8x beside the RTP shape reference, the height-1/2/3 probe with zoom crops,
old vs new village maps with zoom crops of every crossing, the v2 builder maps, judge results and the object-gate receipts.
  python3 page.py "<verdict line>"   (run from the worktree root; needs probe PNG at $RAMP_RUNS/probe.png)"""
import json, os, sys, glob, html, subprocess, re
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
    for r in (1, 2, 3, 4):
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
def village_cards(rx, with_ref):
    sections = []
    for brief in ("port", "hill"):
        t = f"{NEW}/terrain-{brief}/terrain.json"; cards = []
        for arm in ("sol", "terra"):
            runs = sorted(r for r in glob.glob(f"{NEW}/{arm}*/{brief}/RUN.json") if re.fullmatch(rx, r.split("/")[-3]))
            for rj in runs:
                run = os.path.dirname(rj); tag = run.split("/")[-2]; r = json.load(open(rj))
                body = f"<p class=meta>{r['model']} · 고침 {r['repairs']}회 · {r['secs']}초 · " + ("통과" if r["ok"] else "<b>검증 실패</b>: " + html.escape("; ".join(r.get("errors", [])[:2]))) + "</p>"
                if os.path.exists(f"{run}/map.png"):
                    m = Image.open(f"{run}/map.png"); body += f"<img class=wide src='{save(m, f'new-{tag}-{brief}.png', 2 if m.width < 900 else 1)}'>"
                    if contact(run, t, f"{IMG}/new-{tag}-{brief}-cuts.png", 4): body += f"<p class=cap>경사로·계단 확대(4배) — 조각 높이 = 절벽 면 높이</p><img src='bbox-village-ramps/new-{tag}-{brief}-cuts.png'>"
                    st = r.get("stats", {}); body += f"<p class=meta>건물 {st.get('buildings')} · 경사로/계단 {st.get('cuts')}개(남향 {st.get('cutsSouthFacing')}) · 맨 풀밭 {st.get('bareLandPct')}%</p>"
                    js = [(k, v) for k, v in R.items() if k.split("|")[1] == f"{tag}/{brief}"]
                    if js: body += "<table><tr><th>판정(Opus 5.5 medium, 두 순서)</th><th>결과</th><th>높이 축</th><th>이유</th></tr>" + "".join(
                        f"<tr><td>{k.split('|')[0]} vs {k.split('|')[2]}</td><td>{vtxt(v['verdict'])}</td><td>{vtxt(v.get('height')) if k.startswith('map') else '—'}</td><td class=why>{html.escape(' / '.join(w for w in (v.get('why') or []) if w)[:600])}</td></tr>" for k, v in js) + "</table>"
                cards.append(f"<div class=card><h3>새 판 · {brief} · {tag}</h3>{body}</div>")
            old = f"{OLD}/{arm}1/{brief}"
            if with_ref and os.path.exists(f"{old}/map.png"):
                m = Image.open(f"{old}/map.png"); body = f"<img class=wide src='{save(m, f'old-{arm}1-{brief}.png', 2 if m.width < 900 else 1)}'>"
                if contact(old, t, f"{IMG}/old-{arm}1-{brief}-cuts.png", 4): body += f"<p class=cap>옛 계단 확대(4배) — 절벽보다 긴 회색 돌기둥</p><img src='bbox-village-ramps/old-{arm}1-{brief}-cuts.png'>"
                cards.append(f"<div class='card old'><h3>이전 bbox 판 · {brief} · {arm}1</h3>{body}</div>")
        if with_ref:
            for arm in ("sol", "terra"):
                b = f"{OLD}/base-{arm}/{brief}/map.png"
                if os.path.exists(b):
                    m = Image.open(b); cards.append(f"<div class='card base'><h3>현행 v2 빌더 · {brief} · {arm}</h3><img class=wide src='{save(m, f'base-{arm}-{brief}.png', 2 if m.width < 900 else 1)}'></div>")
        sections.append(f"<h3 style='font-size:16px;margin-top:20px'>{brief}</h3>" + "".join(cards))
    return "".join(sections)
def tally(rx):
    rows = []
    for typ, vs, name in (("cuts", "old-bbox", "교차 지점 확대 vs 이전 bbox"), ("map", "old-bbox", "맵 전체 vs 이전 bbox"), ("map", "base", "맵 전체 vs 현행 v2")):
        v = [x["verdict"] for k, x in R.items() if k.startswith(typ + "|") and k.split("|")[2].startswith(vs) and re.fullmatch(rx, k.split("|")[1].split("/")[0])]
        rows.append(f"<tr><td>{name}</td><td>{v.count(1)}승 {v.count(0)}무 {v.count(-1)}패 / {len(v)}</td></tr>")
    return "<table>" + "".join(rows) + "</table>"
R1, R2, R3 = r"(sol|terra)[12]", r"(sol|terra)2[123]", r"(sol|terra)3[123]"
v2line = sys.argv[2] if len(sys.argv) > 2 else ""
v3line = sys.argv[3] if len(sys.argv) > 3 else ""
v4line = sys.argv[4] if len(sys.argv) > 4 else ""
# round 4 (bake): adversarial VQA rounds, final pieces, runtime QA video
def vqa_rows():
    rows = ""
    for f in sorted(glob.glob(f"{HOME}/z-project/rpg-zzu-bboxramps/harness-data/object-gate/vqa/bbox-village-ramps.opus-vqa-r*.json"), key=lambda p: int(re.search(r"r(\d+)\.json$", p).group(1))):
        d = json.load(open(f)); P = d.get("pieces", {})
        fails = [k for k, v in P.items() if v.get("verdict") != "PASS"]
        rows += f"<tr><td>{d.get('round')}</td><td>{d.get('verdict')}</td><td>{len(P) - len(fails)}/{len(P)}</td><td>{(d.get('stacked') or {}).get('verdict', '—')}</td><td class=why>{html.escape(', '.join(fails) or '—')}</td><td class=why>{html.escape((d.get('summary') or '')[:500])}</td></tr>"
    return "<table><tr><th>판</th><th>판정</th><th>조각 통과</th><th>겹친 계단</th><th>떨어진 조각</th><th>요지</th></tr>" + rows + "</table>"
R4 = r"(sol|terra)4[12]"
video = "bbox-village-ramps/qa-walk.webm" if os.path.exists(f"{IMG}/qa-walk.webm") else ""
# round 3: h1 stairs before/after, h4 pieces, probe2 (h4 + stacked flights) with crops, stacked crop on the hill
def strip(names, src, out):
    ims = [Image.open(f"{src}/{n}.png") for n in names]; Wt = sum(i.width + 6 for i in ims) + 6; Ht = max(i.height for i in ims) + 12
    sh = Image.new("RGB", (Wt, Ht), (24, 24, 30)); x = 6
    for i in ims: sh.paste(i, (x, Ht - 6 - i.height)); x += i.width + 6
    return save(sh, out, 8)
h1old = strip(["stairs-h1-w2", "stairs-h1-w3"], "/tmp/ramps/old2", "h1-round2.png") if os.path.exists("/tmp/ramps/old2/stairs-h1-w2.png") else ""
h1new = strip(["stairs-h1-w2", "stairs-h1-w3"], f"{HERE}/png", "h1-round3.png")
h4 = strip(["ramp-h4-w2", "ramp-h4-w3", "stairs-h4-w2", "stairs-h4-w3"], f"{HERE}/png", "h4.png")
final_r = strip(["ramp-h1-w2", "ramp-h2-w3", "ramp-h3-w2", "ramp-h4-w3"], f"{HERE}/png", "final-ramps.png")
final_s = strip(["stairs-h1-w3", "stairs-h2-w2", "stairs-h3-w3", "stairs-h4-w2"], f"{HERE}/png", "final-stairs.png")
probe2 = ""
if os.path.exists(f"{NEW}/probe2.png"):
    pim = Image.open(f"{NEW}/probe2.png").convert("RGB"); pj = json.load(open(f"{NEW}/probe2.json")); pad = pim.height - pj["H"] * 16
    probe2 = f"<img class=wide src='{save(pim, 'probe2.png', 3)}'><p class=meta>걷기 검사: {html.escape(' · '.join(pj['report']))}</p><div class=row>"
    for x0, w, kind, z in pj["sections"]:
        c = pim.crop(((x0 - 2) * 16, (pj["CLIFF"] - 3) * 16 + pad - 64, (x0 + w + 2) * 16, (pj["CLIFF"] + 2) * 16 + pad))
        probe2 += f"<figure class=pc><img src='{save(c, f'probe2-{kind}-{z}.png', 5)}'><figcaption>{kind} · {'절벽 4칸 한 번' if z == 'h4' else ('2칸 + 띠 + 2칸 (겹친 계단)' if z == 's22' else '1칸 + 띠 + 2칸 (겹친 계단)')}</figcaption></figure>"
    probe2 += "</div>"
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
<h2>3. 1판 마을 — 새 판 · 이전 판 · 현행 v2</h2><p>1판 지도는 1판 계단 그림(아래 4절 왼쪽)으로 그려져 판정받았다.</p>{tally(R1)}{village_cards(R1, True)}
<h2>4. 2판 — 계단 다시 그림 · 북향 절벽 거절 · 언덕 4판 + 포구 2판</h2>
<p class=v>{html.escape(v2line)}</p>
<p>계단 1판(왼쪽) → 2판(오른쪽): 돌 판석 줄·이음 엇갈림·판석마다 밝은 모서리와 그늘·아래 계단일수록 한 단 어둡게. 8배, 왼쪽부터 h1-w2 · h1-w3 · h2-w3 · h3-w3.</p>
<div class=row><figure class=pc><img src='bbox-village-ramps/stairs-round1.png'><figcaption>1판 계단</figcaption></figure><figure class=pc><img src='bbox-village-ramps/stairs-round2.png'><figcaption>2판 계단</figcaption></figure></div>
<p>북향 절벽(높은 단이 남쪽)을 깎는 자리는 이제 거절한다. 같은 높은 단으로 오르는 남향 면이 있으면 그 자리 좌표를 영어 Fixed 문장으로 주고, 없을 때만 "northFace": true 로 인정한 경우를 받는다(그래도 3/4 시점에서는 가려진다). 비교 대상(이전 bbox·현행 v2)은 3절과 같다.</p>
{tally(R2)}{village_cards(R2, False)}
<h2>5. 3판 — 4칸 절벽 조각 · 겹친 계단(층계참) · h1 계단 다시 그림 · 언덕 4판</h2>
<p class=v>{html.escape(v3line)}</p>
<p>h1 계단 2판(왼쪽) → 3판(오른쪽): 돌을 더 작게 쪼개 돌마다 밝은 모서리·그늘을 주고, 디딤판에 결·얼룩, 디딤 앞면에 정 자국, 꼭대기에 풀 술을 늘어뜨렸다. 8배.</p>
<div class=row><figure class=pc><img src='{h1old}'><figcaption>2판 h1 계단(관문 조언 FAIL)</figcaption></figure><figure class=pc><img src='{h1new}'><figcaption>3판 h1 계단</figcaption></figure></div>
<p>새 4칸 조각(8배): 경사로 w2·w3, 계단 w2·w3.</p><div class=row><figure class=pc><img src='{h4}'></figure></div>
<p>겹친 계단: 한 줄짜리 가운데 단 띠가 층계참이 된다. 모델은 같은 x 에 조각 둘을 놓고(아래 것 발치 = 아래 단, 위 것 발치 = 띠), 각 조각은 제 절벽 높이에 맞춘다. 그림은 낱조각 둘을 이어 붙인 것(새 화소 없음)이고, 엔진에는 h=2 경사로 한 개로 들어가 걷기 규칙이 그대로 통한다.</p>
{probe2}
{tally(R3)}{village_cards(R3, False)}
<h2>6. 굽기 — 독립 Opus 적대 검수 · 다시 그림 · 게임 안 걷기</h2>
<p class=v>{html.escape(v4line)}</p>
{f"<p>게임(출하 플레이어)에서 깎은 길마다 아래에서 올라갔다 내려오는 1배속 영상(13길, 길 사이는 순간 이동; 녹화기가 화면을 0.625배로 줄였다):</p><video src='{video}' controls loop autoplay muted style='max-width:100%;image-rendering:pixelated'></video>" if video else ""}
<div class=row><figure class=pc><img src='bbox-village-ramps/qa-stacked.png'><figcaption>게임 안: 겹친 계단·경사로(시험 맵)</figcaption></figure><figure class=pc><img src='bbox-village-ramps/qa-hill.png'><figcaption>게임 안: 언덕 마을 겹친 경사로(terra32 고침판)</figcaption></figure></div>
<p>독립 Opus 5.5 적대 검수(판마다 새 검수자, 앞 판 점수를 모름):</p>{vqa_rows()}
<p>마지막 조각(8배): 경사로 — 길의 흙이 그대로 이어지고, 가운데로 꺾이는 등고선과 아래로 넓어지는 옆벽이 오르막을 보인다. 계단 — 돌 디딤판. 발치 줄은 실제 길이 곧게 이어지는 모습을 렌더에서 뜬 것.</p>
<div class=row><figure class=pc><img src='{final_r}'></figure><figure class=pc><img src='{final_s}'></figure></div>
<p>겹친 계단 정본 나눔: 아래 = floor(전체/2), 위 = 나머지 (1+1 · 1+2 · 2+2 · 2+3 · 3+3 · 3+4 · 4+4). 렌더러가 낱조각 둘을 이어 붙인다. 다른 나눔과 절벽이 꺾이는 자리의 깎은 길은 깔 때 거절한다.</p>
{tally(R4)}{village_cards(R4, False)}"""
open(f"{VIZ}/bbox-village-ramps.html", "w").write(page); print("ok")
