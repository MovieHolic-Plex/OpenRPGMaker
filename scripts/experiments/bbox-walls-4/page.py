#!/usr/bin/env python3
"""bbox-walls page, rounds 1|2|3 -> ~/claude-viz/bbox-walls-2.html: per place, round 1 (bbox-walls), 2 (bbox-walls-2), 3 (bbox-walls-3) side by side.
  python3 scripts/experiments/bbox-walls-4/page.py "<one-line verdict>"   (from the worktree root)"""
import html, json, os, sys
from PIL import Image
HOME = os.path.expanduser("~"); S = f"{HOME}/z-project/assistant-whole-game/suite/rooms"
R3 = os.environ.get("BW_RUNS", f"{S}/runs-bboxwalls4")
VIZ = f"{HOME}/claude-viz"; IMG = f"{VIZ}/bbox-walls-2"; os.makedirs(IMG, exist_ok=True)
verdict = sys.argv[1] if len(sys.argv) > 1 else "진행 중 — 판이 끝나는 대로 채운다."
ld = lambda p: json.load(open(p)) if os.path.exists(p) else {}
TASKS = ["inn", "library", "jail", "manor"]; KO = {"inn": "여관", "library": "도서관", "jail": "감옥", "manor": "저택"}
RUNS = [f"{a}{r}" for a in ("sol", "terra") for r in "12"]
NEED_STAIRS = {"inn", "manor"}
side = {"r1": dict(res=ld(f"{S}/runs-bboxwalls/results.json"), wal=ld(f"{S}/runs-bboxwalls/walls.json"), meas=ld(f"{R3}/measure-r1.json"), root=f"{S}/runs-bboxwalls"),
        "r2": dict(res=ld(f"{S}/runs-bboxwalls2/results.json"), wal=ld(f"{S}/runs-bboxwalls2/walls.json"), meas=ld(f"{R3}/measure-r2.json"), root=f"{S}/runs-bboxwalls2"),
        "r3": dict(res=ld(f"{R3}/results.json"), wal=ld(f"{R3}/walls.json"), meas={}, root=R3)}
ROUNDS = ["r1", "r2", "r3"]; RK = {"r1": "1판 (bbox-walls)", "r2": "2판 (bbox-walls-2)", "r3": "3판 (몸채 먼저)"}
for t in TASKS:
    for k in RUNS:
        r = ld(f"{R3}/{k}/{t}/RUN.json")
        if r.get("stats"): side["r3"]["meas"][f"{k}/{t}"] = r["stats"]["measure"]


def m_of(s, key): return side[s]["meas"].get(key)


def wdl(s, keys):
    vs = [v["verdict"] for kk, v in side[s]["res"].items() if kk.split("|")[0] in keys]
    return f"{vs.count(1)}승 {vs.count(0)}무 {vs.count(-1)}패" if vs else "—"


def wavg(s, keys):
    v = [side[s]["wal"][k]["walls"] for k in keys if isinstance(side[s]["wal"].get(k, {}).get("walls"), (int, float))]
    return f"{sum(v) / len(v):.1f}" if v else "—"


def avg(vals, f="{:.0f}"):
    vals = [v for v in vals if v is not None]
    return f.format(sum(vals) / len(vals)) if vals else "—"


def stair_txt(m, t):
    if not m: return "—"
    st = m["stairs"]
    if t in NEED_STAIRS: return f"{st['ok']}/{max(1, st['placed'])} 맞음" if st["placed"] else "없음"
    return f"{st['ok']}/{st['placed']} 맞음" if st["placed"] else "해당 없음"


def summary(s, t):
    keys = [f"{k}/{t}" for k in RUNS]; ms = [m for m in (m_of(s, k) for k in keys) if m]
    ok_st = sum(1 for m in ms if m["stairs"]["placed"] and m["stairs"]["ok"] == m["stairs"]["placed"])
    sh = [m.get("shell") or {} for m in ms]
    return [avg([m.get("emptyPctAll") for m in ms], "{:.0f}%"), avg([m["emptyPct"] for m in ms], "{:.0f}%"),
            avg([m["rugs"] for m in ms], "{:.1f}") + " / 방당 최대 " + str(max([m["maxRugs"] for m in ms] or [0])),
            (f"{ok_st}/{len(ms)}" if t in NEED_STAIRS else "—"), avg([m["types"] for m in ms], "{:.0f}"),
            (avg([len(m.get("poolUsed", [])) for m in ms], "{:.1f}") if s != "r1" else "—"),
            avg([x.get("convexity") for x in sh], "{:.2f}"), avg([x.get("outerRuns") for x in sh], "{:.1f}"), avg([x.get("sharedWallRatio") for x in sh], "{:.2f}"),
            wdl(s, keys), wavg(s, keys)]


rows = []
for t in TASKS:
    for s in ROUNDS:
        rows.append(f"<tr class={s}><td>{KO[t]} · {RK[s]}</td>" + "".join(f"<td>{html.escape(c)}</td>" for c in summary(s, t)) + "</tr>")


def card(s, k, t):
    root = side[s]["root"]; g = f"{root}/{k}/{t}"; key = f"{k}/{t}"
    run = ld(f"{g}/RUN.json")
    if not run: return "<figure><p class=meta>실행 중</p></figure>"
    png = f"{g}/map.png"
    if not os.path.exists(png): return f"<figure><p class=meta>그림 없음 — {html.escape('; '.join(run.get('errors', [])[:2]))}</p></figure>"
    out = f"{IMG}/{s}-{k}-{t}.png"
    if not os.path.exists(out) or os.path.getmtime(out) < os.path.getmtime(png):
        im = Image.open(png); im.resize((im.width * 2, im.height * 2), Image.NEAREST).save(out)
    m = m_of(s, key) or {}
    w = side[s]["wal"].get(key) or {}
    sh = m.get("shell") or {}
    bits = [f"빈 바닥 {m.get('emptyPctAll', '—')}% (통로 제외 {m.get('emptyPct', '—')}%)", f"몸채 볼록도 {sh.get('convexity', '—')} · 바깥벽 꺾임 {sh.get('outerRuns', '—')} · 공유벽 {sh.get('sharedWallRatio', '—')}", f"양탄자 {m.get('rugs', '—')} (방당 최대 {m.get('maxRugs', '—')})", f"계단 {stair_txt(m, t)}",
            f"물건 종류 {m.get('types', '—')}" + (f" (새 풀 {len(m.get('poolUsed', []))})" if s != "r1" else ""),
            f"바닥 {len(m.get('floors', []))}종", f"Opus 쌍 비교 {wdl(s, [key])}", f"벽 {w.get('walls', '—')}/10"]
    if s != "r1":
        bits.append(f"검증 {'통과' if run.get('ok') else '<b>실패</b>'} · 고침 {run.get('repairs')}회 {run.get('errorsPerCall')} · {run.get('secs')}초")
    why = f"<br><span class=why>{html.escape(str(w.get('why', '')))}</span>" if w.get("why") else ""
    return f"<figure><img src='bbox-walls-2/{s}-{k}-{t}.png'><figcaption>{' · '.join(bits)}{why}</figcaption></figure>"


secs = []
for t in TASKS:
    cards = []
    for k in RUNS:
        model = "gpt-6.1-sol" if k.startswith("sol") else "gpt-6.1-terra"
        cards.append(f"<div class=card><h3>{KO[t]} · {model} #{k[-1]}</h3><div class=pair>{''.join(f"<div class=col><h4>{RK[s]}</h4>{card(s, k, t)}</div>" for s in ROUNDS)}</div></div>")
    secs.append(f"<h2>{KO[t]}</h2>" + "".join(cards))
page = f"""<!doctype html><meta charset=utf-8><title>bbox 벽 시험 1·2·3판</title>
<style>body{{background:#16161c;color:#ddd;font:14px/1.5 sans-serif;margin:20px}}h1{{font-size:20px}}h2{{margin-top:28px}}.v{{font-size:17px;color:#ffd866;margin:6px 0}}
.card{{background:#222230;border-radius:8px;padding:12px;margin:14px 0}}h3{{margin:0 0 8px;font-size:15px}}h4{{margin:0 0 4px;color:#9ab;font-size:13px}}
.pair{{display:flex;gap:10px;align-items:flex-start}}.col{{flex:1 1 0;min-width:0}}figure{{margin:0}}img{{image-rendering:pixelated;width:100%;display:block}}
figcaption{{font-size:12px;color:#bbb;margin-top:4px}}.why{{color:#888}}.meta{{color:#999}}
table{{border-collapse:collapse;margin:8px 0}}td,th{{border:1px solid #444;padding:4px 10px}}tr.r1 td{{color:#8a9}}tr.r2 td{{color:#9ab}}tr.r3 td{{color:#fff}}tr.r3 td:first-child{{font-weight:bold}}</style>
<h1>bbox 벽 시험 — 1판 | 2판(계단 크기·빈 바닥·양탄자·방 나누기·물건 풀) | 3판(몸채 먼저 짓고 칸막이로 나누기)</h1>
<p class=v>{html.escape(verdict)}</p>
<p>왼쪽부터 1판(bbox-walls) · 2판(bbox-walls-2) · 3판(bbox-walls-3). 같은 장소·같은 모델(gpt-6.1-sol / terra high)·같은 판정자(Opus 5.5 medium)·같은 기준 방. 지표는 세 판 모두 3판 검사기로 다시 쟀다.
빈 바닥 = 그 칸과 둘레 8칸에 아무것도(벽·가구·난간) 없는 바닥의 비율 · 통로 제외 = 문과 문 사이 3칸 폭 길은 빼고 잰 값(3판 검사 기준) · 몸채 볼록도 = 건물 면적 / 둘레 사각형 면적(1 = 네모) · 바깥벽 꺾임 = 바깥벽 윤곽의 모서리 수(네모 = 4) · 공유벽 = 방 둘에 맞닿은 벽 칸 비율.</p>
<table><tr><th>장소 · 판</th><th>빈 바닥</th><th>통로 제외</th><th>양탄자</th><th>계단 맞음</th><th>물건 종류</th><th>새 풀 물건</th><th>볼록도</th><th>바깥벽 꺾임</th><th>공유벽</th><th>Opus 쌍 비교</th><th>벽 점수</th></tr>{''.join(rows)}</table>
{''.join(secs)}"""
open(f"{VIZ}/bbox-walls-2.html", "w").write(page); print("ok")
