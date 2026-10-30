#!/usr/bin/env python3
"""bbox-better page → ~/claude-viz/bbox-better.html (images in ~/claude-viz/bbox-better/).
  python3 scripts/experiments/bbox-better/page.py "<one-line verdict>"   (run from the worktree root)"""
import json, os, sys, glob, html
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import RUNS, MODEL, draw, x2
HOME = os.path.expanduser("~")
VIZ = f"{HOME}/claude-viz"; IMG = f"{VIZ}/bbox-better"; os.makedirs(IMG, exist_ok=True)
verdict = sys.argv[1] if len(sys.argv) > 1 else "진행 중 — 판이 끝나는 대로 채운다."
res = json.load(open(f"{RUNS}/results-opus.json")) if os.path.exists(f"{RUNS}/results-opus.json") else {}
TASKS = ["inn", "boss"]


def wdl(keys):
    vs = [v["verdict"] for k, v in res.items() if k.split("|")[0] in keys]
    return vs.count(1), vs.count(0), vs.count(-1), len(vs)


def score(t): return f"{(t[0] + 0.5 * t[1]) / t[3]:.2f}" if t[3] else "—"
def fmt(t): return f"{t[0]}승 {t[1]}무 {t[2]}패 / {t[3]}" if t[3] else "채점 전"


def cost(calls):
    s = sum(c["tokens"] for c in calls if c["model"] == MODEL["sol"]); t = sum(c["tokens"] for c in calls if c["model"] == MODEL["terra"])
    return s, t, round(sum(c["secs"] for c in calls), 1)


rows, sections = [], []
def cond(name, runs, note=""):
    """runs: list of (dir rel RUNS, calls) — calls already cumulative for that condition."""
    done = [r for r in runs if os.path.exists(f"{RUNS}/{r[0]}/map.png")]
    t = wdl({r[0] for r in done})
    n = max(1, len(done))
    s = sum(cost(r[1])[0] for r in done) / n; tt = sum(cost(r[1])[1] for r in done) / n; sec = sum(cost(r[1])[2] for r in done) / n
    rows.append(f"<tr><td>{name}</td><td>{len(done)}/{len(runs)}</td><td>{fmt(t)}</td><td><b>{score(t)}</b></td><td>{s:,.0f}</td><td>{tt:,.0f}</td><td>{sec:.0f}</td><td>{note}</td></tr>")


def card_row(rel, tag, label, calls):
    d = f"{RUNS}/{rel}"
    if not os.path.exists(f"{d}/layout.json"): return f"<div class=row><p class=meta>{label}: 실행 중</p></div>"
    draw(f"{d}/layout.json", f"{IMG}/{tag}-layout.png")
    imgs = f"<figure><img src='bbox-better/{tag}-layout.png'></figure>"
    if os.path.exists(f"{d}/map.png"):
        x2(f"{d}/map.png", f"{IMG}/{tag}-map.png"); imgs += f"<figure><img src='bbox-better/{tag}-map.png'></figure>"
    t = wdl({rel}); s, tt, sec = cost(calls)
    models = " + ".join(sorted({c["model"] for c in calls}))
    return (f"<div class=row><h4>{label}</h4><div class=pair>{imgs}</div><p class=meta>{models} high · Opus 5.5 medium 판정 {fmt(t)} (점수 {score(t)}) · "
            f"{sec}초 · 토큰 sol {s:,} / terra {tt:,}</p></div>")


def runs_json(rel):
    p = f"{RUNS}/{rel}/RUN.json"
    return json.load(open(p)) if os.path.exists(p) else None


# (a) self-critique
crit = {}
for arm in ["sol", "terra"]:
    for k in range(3):
        rl = []
        for task in TASKS:
            for rep in "12":
                base = f"crit-{arm}{rep}/{task}"; calls = []
                for j in range(k + 1):
                    p = f"{RUNS}/{base}/r{j}/ROUND.json"
                    if os.path.exists(p): calls += json.load(open(p))["calls"]
                rl.append((f"{base}/r{k}", calls))
        crit[(arm, k)] = rl
# (c) two-stage
two = []
for task in TASKS:
    for rep in "12":
        r = runs_json(f"two-terrasol{rep}/{task}"); two.append((f"two-terrasol{rep}/{task}", r["calls"] if r else []))
# (b) catalog variants (terra)
VARS = [("text", "텍스트 카탈로그만"), ("textimg", "텍스트 + id 팔레트 그림"), ("examples", "텍스트 + 팔레트 + 견본 배치 2개")]
var = {}
for v, _ in VARS:
    var[v] = []
    for task in TASKS:
        rel = f"crit-terra1/{task}/r0" if v == "textimg" else f"var-{v}1/{task}"
        if v == "textimg": var[v].append((rel, json.load(open(f"{RUNS}/{rel}/ROUND.json"))["calls"] if os.path.exists(f"{RUNS}/{rel}/ROUND.json") else []))
        else:
            r = runs_json(rel); var[v].append((rel, r["calls"] if r else []))

rows.append("<tr><th colspan=8>(a) 자기 비평 고리 — 깐 맵을 보여 주고 패치 받기, 2바퀴 (토큰·시간은 0바퀴부터 누적)</th></tr>")
for arm in ["sol", "terra"]:
    for k in range(3): cond(f"{arm} · {k}바퀴" + (" (= 기존 bbox)" if k == 0 else ""), crit[(arm, k)])
rows.append("<tr><th colspan=8>(c) 두 단계 — terra 가 큰 틀(방·구역), sol 이 기물</th></tr>")
cond("terra 틀 + sol 기물", two)
cond("sol 혼자 (= 기존 bbox)", crit[("sol", 0)]); cond("terra 혼자 (= 기존 bbox)", crit[("terra", 0)])
rows.append("<tr><th colspan=8>(b) 카탈로그 형식 — terra, 형식마다 1판씩(여관·보스)</th></tr>")
for v, lab in VARS: cond(lab, var[v], "기존 terra1 재사용" if v == "textimg" else "")

# cards
cards = ["<h2>(a) 자기 비평 고리</h2>"]
for task in TASKS:
    for arm in ["sol", "terra"]:
        for rep in "12":
            base = f"crit-{arm}{rep}/{task}"; inner = ""
            for k in range(3):
                p = f"{RUNS}/{base}/r{k}/ROUND.json"
                rd = json.load(open(p)) if os.path.exists(p) else {"calls": []}
                lab = f"{k}바퀴" + (" (기존 bbox 판)" if k == 0 else "") + ("" if rd.get("ok", True) else " — 패치 검증 실패, 앞 바퀴 유지")
                prob = rd.get("problems") or []
                inner += card_row(f"{base}/r{k}", f"{arm}{rep}-{task}-r{k}", lab, rd["calls"])
                if prob: inner += "<p class=prob>모델이 본 문제: " + html.escape(" / ".join(map(str, prob[:5]))) + "</p>"
            cards.append(f"<div class=card><h3>{task} · {MODEL[arm]} #{rep}</h3>{inner}</div>")
cards.append("<h2>(c) terra 틀 + sol 기물</h2>")
for task in TASKS:
    for rep in "12":
        rel = f"two-terrasol{rep}/{task}"; r = runs_json(rel)
        if not r: cards.append(f"<div class=card><h3>{task} #{rep}</h3><p class=meta>실행 중</p></div>"); continue
        bad = "" if r["ok"] else f"<p class=prob>검증 실패: {html.escape('; '.join(r.get('errors', [])[:3]))}</p>"
        pl = ""
        if os.path.exists(f"{RUNS}/{rel}/plan.json"):
            zones = json.load(open(f"{RUNS}/{rel}/plan.json")).get("zones") or []
            pl = "<p class=prob>terra 구역: " + html.escape(" / ".join(f"{z.get('id')}: {z.get('purpose')}" for z in zones[:8])) + "</p>"
        cards.append(f"<div class=card><h3>{task} · terra 틀 + sol 기물 #{rep}</h3>{card_row(rel, f'two{rep}-{task}', '최종', r['calls'])}{pl}{bad}</div>")
cards.append("<h2>(b) 카탈로그 형식 (terra)</h2>")
for v, lab in VARS:
    for (rel, calls), task in zip(var[v], TASKS):
        cards.append(f"<div class=card><h3>{task} · {lab}</h3>{card_row(rel, f'var-{v}-{task}', 'terra', calls)}</div>")

page = f"""<!doctype html><meta charset=utf-8><title>bbox 더 좋게·더 싸게</title>
<style>body{{background:#16161c;color:#ddd;font:14px/1.5 sans-serif;margin:20px}}h1{{font-size:20px}}h2{{font-size:17px;margin-top:28px}}.v{{font-size:17px;color:#ffd866;margin:6px 0 10px}}
.card{{background:#222230;border-radius:8px;padding:12px;margin:14px 0}}h3{{margin:0 0 8px;font-size:15px}}h4{{margin:6px 0;font-size:13px;color:#9cf}}.pair{{display:flex;gap:12px;align-items:flex-start}}
figure{{margin:0;flex:1 1 0;min-width:0}}img{{image-rendering:pixelated;width:100%;display:block}}.meta{{margin:6px 0 0;color:#bbb}}.prob{{color:#c9a;font-size:12px;margin:4px 0}}
table{{border-collapse:collapse;margin:8px 0}}td,th{{border:1px solid #444;padding:4px 10px}}th{{text-align:left;background:#2a2a3a}}</style>
<h1>bbox 배치를 더 좋게·더 싸게 — 자기 비평 · 카탈로그 형식 · 두 단계</h1>
<p class=v>{html.escape(verdict)}</p>
<p>과제는 기존 bbox 와 같은 여관 1층·마왕 보스 방. 판정은 Opus 5.5 medium, 같은 기준 방들과 쌍 비교(두 순서, 엇갈리면 무). 점수 = (승 + 0.5×무) / 판정 수. 토큰은 방 하나당 평균(조수 모델만, 판정 제외).
왼쪽 그림 = 모델이 쓴 배치(노란 = 랜드마크, 어두운 띠 = 북쪽 벽면 두 줄, 초록 = 입구·통로), 오른쪽 = 코드가 그대로 깐 맵(2배).</p>
<table><tr><th>조건</th><th>판</th><th>Opus 판정</th><th>점수</th><th>sol 토큰</th><th>terra 토큰</th><th>초</th><th></th></tr>{''.join(rows)}</table>
{''.join(cards)}"""
open(f"{VIZ}/bbox-better.html", "w").write(page)
print("ok")
