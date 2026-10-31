#!/usr/bin/env python3
"""Script A/B PoC — build the Korean report page (and a markdown copy) from whatever results exist so far.

  python3 scripts/qa/script-ab/report.py <root> [--md <path>]   → ~/claude-viz/script-ab-poc.html (+ script-ab-poc/ media)

Reads per run: metrics.json (metrics.py), walk/<arm>-<run>/walk.json, <run>/audit.json, <run>/dump.json, RUN.txt;
per pair: judge/<prompt>-<rep>.json; optional media: ~/claude-viz/script-ab-poc/<arm>-<run>.mp4; examples.json.
"""
import json, os, sys, glob, statistics, html, re

ROOT = sys.argv[1]
MD = sys.argv[sys.argv.index("--md") + 1] if "--md" in sys.argv else None
VIZ = os.path.expanduser("~/claude-viz")
MEDIA = f"{VIZ}/script-ab-poc"
REQ = {"escape": "방탈출", "village": "마을 퀘스트", "dungeon": "던전 퍼즐"}
COLORS = {"escape": "#2a6fdb", "village": "#1b9e5a", "dungeon": "#c2410c"}
SCRIPT_TOOLS = {"get_script_api", "check_script", "author_script", "edit_script", "dry_run_script",
                "read_event_as_script", "write_event_as_script", "upsert_script_module", "list_script_modules"}
esc = html.escape


def load(p, default=None):
    try:
        return json.load(open(p))
    except Exception:
        return default


metrics = load(f"{ROOT}/metrics.json", {})
runs = []
for d in sorted(glob.glob(f"{ROOT}/[AB]/*-[0-9]")):
    arm, name = d.split("/")[-2:]
    pid, rep = name.rsplit("-", 1)
    runtxt = open(f"{d}/RUN.txt").read() if os.path.exists(f"{d}/RUN.txt") else ""
    if "finished=" not in runtxt:
        continue
    m = metrics.get(f"{arm}/{name}", {})
    walk = load(f"{ROOT}/walk/{arm}-{name}/walk.json")
    audit = load(f"{d}/audit.json")
    dump = load(f"{d}/dump.json")
    scripts_in_game = 0
    if dump:
        for mp in dump["maps"]:
            for e in mp["events"]:
                for pg in e["pages"]:
                    scripts_in_game += pg["kinds"].get("script", 0)
    runs.append(dict(arm=arm, pid=pid, rep=rep, name=name, m=m, walk=walk, audit=audit, timeout="timeout=" in runtxt,
                     scripts=scripts_in_game))

judges = {os.path.basename(p)[:-5]: load(p) for p in glob.glob(f"{ROOT}/judge/*.json")}


def med(xs):
    xs = [x for x in xs if x is not None]
    return statistics.median(xs) if xs else None


def fmt(v, kind):
    if v is None:
        return "—"
    if kind == "usd":
        return f"${v:.1f}"
    if kind == "min":
        return f"{v:.0f}분"
    if kind == "k":
        return f"{v/1000:.0f}k"
    if kind == "M":
        return f"{v/1e6:.1f}M"
    if kind == "pct":
        return f"{v*100:.0f}%"
    return f"{v:.0f}" if isinstance(v, (int, float)) else str(v)


def dots(vals, lo, hi):
    """vals: list of (value, pid, label). A tiny SVG strip."""
    w, h = 150, 18
    if hi == lo:
        hi = lo + 1
    out = [f'<svg width="{w}" height="{h}" viewBox="0 0 {w} {h}"><line x1="4" y1="9" x2="{w-4}" y2="9" stroke="#ddd"/>']
    for v, pid, label in vals:
        if v is None:
            continue
        x = 4 + (w - 8) * (v - lo) / (hi - lo)
        out.append(f'<circle cx="{x:.1f}" cy="9" r="4" fill="{COLORS[pid]}" fill-opacity="0.8"><title>{esc(label)}: {v}</title></circle>')
    out.append("</svg>")
    return "".join(out)


ROWS = [
    ("총 처리 토큰(입력+캐시+출력)", lambda r: r["m"].get("tokensTotal"), "M", "low"),
    ("출력 토큰", lambda r: r["m"].get("output"), "k", "low"),
    ("비용 추정(API 단가)", lambda r: r["m"].get("cost"), "usd", "low"),
    ("모델 호출 수", lambda r: r["m"].get("modelCalls"), "n", "low"),
    ("도구 호출 수", lambda r: r["m"].get("tools"), "n", "low"),
    ("실패·거절된 도구 호출", lambda r: r["m"].get("failed"), "n", "low"),
    ("get_event 호출", lambda r: r["m"].get("getEvent"), "n", "low"),
    ("걸린 시간(요청 두 번 합)", lambda r: (r["m"].get("ms") or 0) / 60000 or None, "min", "low"),
    ("플레이 점검 통과율", lambda r: (r["walk"]["pass"] / r["walk"]["total"]) if r["walk"] else None, "pct", "high"),
    ("엔딩 도달", lambda r: (1.0 if any(c["id"] == "ending" and c["pass"] for c in r["walk"]["checks"]) else 0.0) if r["walk"] else None, "pct", "high"),
    ("판정자가 찾은 버그(중대)", lambda r: sum(1 for b in r["audit"].get("bugs", []) if b.get("severity") == "major") if r["audit"] else None, "n", "low"),
    ("판정자가 찾은 버그(전체)", lambda r: len(r["audit"].get("bugs", [])) if r["audit"] else None, "n", "low"),
    ("요청 기능 구현·정확(개)", lambda r: sum(1 for x in r["audit"].get("mechanics", []) if x.get("realized") and x.get("correct")) if r["audit"] else None, "n", "high"),
    ("판정 점수(0~10)", lambda r: r["audit"].get("score") if r["audit"] else None, "n", "high"),
    ("게임 속 스크립트 명령 수", lambda r: r["scripts"], "n", "-"),
]


def summary_table():
    t = ['<table class="sum"><tr><th>지표</th><th>A 스크립트 켬<br><small>중앙값</small></th><th>B 스크립트 끔<br><small>중앙값</small></th><th>판마다(● 방탈출 ● 마을 ● 던전)</th></tr>']
    for label, f, kind, better in ROWS:
        a = [(f(r), r["pid"], f"A {r['name']}") for r in runs if r["arm"] == "A"]
        b = [(f(r), r["pid"], f"B {r['name']}") for r in runs if r["arm"] == "B"]
        va, vb = med([x[0] for x in a]), med([x[0] for x in b])
        allv = [x[0] for x in a + b if x[0] is not None]
        lo, hi = (min(allv), max(allv)) if allv else (0, 1)
        win = ""
        if va is not None and vb is not None and va != vb and better != "-":
            win = "A" if (va < vb) == (better == "low") else "B"
        ca = ' class="win"' if win == "A" else ""
        cb = ' class="win"' if win == "B" else ""
        t.append(f'<tr><td>{label}</td><td{ca}>{fmt(va, kind)}</td><td{cb}>{fmt(vb, kind)}</td>'
                 f'<td><div class="strip">A {dots(a, lo, hi)}</div><div class="strip">B {dots(b, lo, hi)}</div></td></tr>')
    # judge
    wins = {"A": 0, "B": 0, "tie": 0}
    for j in judges.values():
        for r in j or []:
            wins[r["winner"]] = wins.get(r["winner"], 0) + 1
    if sum(wins.values()):
        t.append(f'<tr><td>짝 비교 판정(Opus 5.5 medium, 앞뒤 순서 둘 다)</td><td>{wins["A"]}승</td><td>{wins["B"]}승</td><td>무승부 {wins["tie"]} · 판정 {sum(wins.values())}회</td></tr>')
    t.append("</table>")
    return "\n".join(t)


def run_table():
    t = ['<table class="runs"><tr><th>판</th><th>토큰</th><th>비용</th><th>모델 호출</th><th>도구 호출(실패)</th><th>스크립트 도구</th><th>시간</th><th>플레이 점검</th><th>엔딩</th><th>버그(중대/전체)</th><th>게임 속 스크립트</th></tr>']
    for r in sorted(runs, key=lambda r: (r["pid"], r["rep"], r["arm"])):
        m, w, a = r["m"], r["walk"], r["audit"]
        ending = "—" if not w else ("✓" if any(c["id"] == "ending" and c["pass"] for c in w["checks"]) else "✗")
        fails = "" if not w else ", ".join(c["id"] for c in w["checks"] if not c["pass"])
        bugs = "—" if not a else f'{sum(1 for b in a.get("bugs", []) if b.get("severity") == "major")}/{len(a.get("bugs", []))}'
        to = ' <span class="to">35분 상한에 걸림</span>' if r["timeout"] else ""
        t.append(f'<tr><td><b>{r["arm"]}</b> {REQ[r["pid"]]} {r["rep"]}{to}</td><td>{fmt(m.get("tokensTotal"), "M")}</td><td>{fmt(m.get("cost"), "usd")}</td>'
                 f'<td>{m.get("modelCalls", "—")}</td><td>{m.get("tools", "—")} ({m.get("failed", "—")})</td><td>{m.get("scriptCalls", "—")}</td>'
                 f'<td>{fmt((m.get("ms") or 0) / 60000 or None, "min")}</td><td>{"—" if not w else f"{w[chr(112)+chr(97)+chr(115)+chr(115)]}/{w[chr(116)+chr(111)+chr(116)+chr(97)+chr(108)]}"}'
                 f'{"<br><small>✗ " + esc(fails) + "</small>" if fails else ""}</td><td>{ending}</td><td>{bugs}</td><td>{r["scripts"]}</td></tr>')
    t.append("</table>")
    return "\n".join(t)


def clips():
    out = []
    for pid in ("escape", "village", "dungeon"):
        cells = []
        for arm in ("A", "B"):
            vids = sorted(glob.glob(f"{MEDIA}/{arm}-{pid}-*.mp4"))
            if not vids:
                cells.append(f'<div class="clip"><div class="ph">{arm} 영상 준비 중</div></div>')
                continue
            v = os.path.basename(vids[0])
            cap = open(vids[0][:-4] + ".txt").read() if os.path.exists(vids[0][:-4] + ".txt") else ""
            cells.append(f'<div class="clip"><video src="script-ab-poc/{v}" autoplay muted loop playsinline controls></video><div class="cap"><b>{arm}</b> {esc(cap)}</div></div>')
        out.append(f'<h3>{REQ[pid]}</h3><div class="clips">{"".join(cells)}</div>')
    return "\n".join(out)


def examples():
    ex = load(f"{ROOT}/examples.json")
    if not ex:
        return "<p>(예시 준비 중)</p>"
    return ex.get("html", "")


def judge_notes():
    out = []
    for k in sorted(judges):
        for r in judges[k] or []:
            out.append(f'<li><b>{REQ.get(k.rsplit("-", 1)[0], k)} {k.rsplit("-", 1)[1]}</b> ({" → ".join(x.split("/")[0] for x in r["order"])} 순서로 보여 줌): '
                       f'승자 <b>{r["winner"]}</b> — {esc(str(r.get("decisive", "")))}</li>')
    return "<ul>" + "\n".join(out) + "</ul>" if out else "<p>(판정 준비 중)</p>"


ANSWERS = load(f"{ROOT}/answers.json", {})
done = len(runs)
page = f"""<!doctype html><html lang="ko"><head><meta charset="utf-8"><title>스크립트 샌드박스 A/B PoC</title>
<style>
body{{font:15px/1.55 system-ui,-apple-system,'Noto Sans KR',sans-serif;max-width:1180px;margin:24px auto;padding:0 18px;color:#1d1d1f}}
h1{{font-size:24px;margin:0 0 4px}} h2{{font-size:19px;margin:30px 0 8px;border-bottom:1px solid #eee;padding-bottom:4px}} h3{{font-size:16px;margin:18px 0 6px}}
.lead{{color:#555}} table{{border-collapse:collapse;width:100%;margin:8px 0}} td,th{{border-bottom:1px solid #eee;padding:5px 8px;text-align:left;vertical-align:middle}}
th{{background:#fafafa;font-weight:600}} td.win{{background:#e9f7ef;font-weight:600}} .strip{{display:flex;align-items:center;gap:4px;font-size:11px;color:#888}}
.runs td{{font-size:13px}} .to{{color:#b45309;font-size:11px}} .qa{{background:#f6f8fb;border:1px solid #e3e8f0;border-radius:8px;padding:10px 14px;margin:10px 0}}
.qa p{{margin:4px 0}} .clips{{display:flex;gap:12px}} .clip{{flex:1}} .clip video{{width:100%;border-radius:6px;background:#000}} .cap{{font-size:12px;color:#555}}
.ph{{height:200px;background:#f2f2f2;border-radius:6px;display:flex;align-items:center;justify-content:center;color:#999}}
pre{{background:#0f172a;color:#e2e8f0;padding:10px 12px;border-radius:6px;font-size:12px;overflow:auto;max-height:420px}} .two{{display:flex;gap:12px}} .two>div{{flex:1;min-width:0}}
small{{color:#777}} .warn{{color:#92400e}}
</style></head><body>
<h1>TypeScript 스크립트 샌드박스 — 켬(A) vs 끔(B) A/B PoC</h1>
<p class="lead">같은 main 빌드(1bfdb570bf, #4130 스위치)에서 조수(v2, Opus 5.5 medium)에게 「스크립트」라는 말 없는 짧은 게임 요청 3개를 판마다 두 번씩 보냈다.
A 는 스크립트 도구 9개·스킬을 그대로, B 는 <code>OPRN_V2_SCRIPTS=0</code> 으로 숨겼다. 신기루 VM 에서 짓고, 출하 플레이어로 같은 점검 대본을 돌렸다. 완료된 판 {done}/12.</p>
<div class="qa">{ANSWERS.get("html", "<p>(세 질문의 답은 모든 판이 끝난 뒤 채운다)</p>")}</div>
<h2>1. 한눈에</h2>
{summary_table()}
<p><small>비용은 조수 기록의 API 단가 추정(구독 경로라 실제 청구액은 아니다). 「총 처리 토큰」은 캐시 읽기를 포함한다 — 같은 시스템 글을 매 호출 다시 읽어 대부분이 캐시다. 초록 칸 = 그 지표에서 나은 쪽(중앙값).</small></p>
<h2>2. 판마다</h2>
{run_table()}
<h2>3. 게임 화면 (출하 플레이어, 1배속)</h2>
{clips()}
<h2>4. 스크립트 하나 vs 같은 일을 하는 명령 목록</h2>
{examples()}
<h2>5. 짝 비교 판정 근거</h2>
{judge_notes()}
<h2>6. 조심할 점</h2>
<ul>{ANSWERS.get("caveats", "<li>판이 적다(요청 3개 × 2회 × 2팔 = 12판). 차이는 방향만 본다.</li>")}</ul>
</body></html>"""
os.makedirs(MEDIA, exist_ok=True)
open(f"{VIZ}/script-ab-poc.html", "w").write(page)
print(f"report: {done} runs → {VIZ}/script-ab-poc.html")
if MD:
    lines = ["# 스크립트 샌드박스 A/B PoC (2026-10-31)", "", "http://mdc-server:18301/script-ab-poc.html", "",
             re.sub(r"<[^>]+>", "", ANSWERS.get("html", "").replace("</p>", "\n")), "", "| 지표 | A 켬 | B 끔 |", "|---|---|---|"]
    for label, f, kind, better in ROWS:
        va = med([f(r) for r in runs if r["arm"] == "A"]); vb = med([f(r) for r in runs if r["arm"] == "B"])
        lines.append(f"| {label} | {fmt(va, kind)} | {fmt(vb, kind)} |")
    lines += ["", "## 판마다", "", "| 판 | 토큰 | 비용 | 도구(실패) | 시간 | 플레이 | 버그 |", "|---|---|---|---|---|---|---|"]
    for r in sorted(runs, key=lambda r: (r["pid"], r["rep"], r["arm"])):
        m, w, a = r["m"], r["walk"], r["audit"]
        lines.append(f'| {r["arm"]} {r["pid"]}-{r["rep"]}{" (timeout)" if r["timeout"] else ""} | {fmt(m.get("tokensTotal"), "M")} | {fmt(m.get("cost"), "usd")} | {m.get("tools")} ({m.get("failed")}) | {fmt((m.get("ms") or 0)/60000 or None, "min")} | {"—" if not w else str(w["pass"]) + "/" + str(w["total"])} | {"—" if not a else len(a.get("bugs", []))} |')
    lines += ["", "## 조심할 점", "", re.sub(r"<[^>]+>", "", ANSWERS.get("caveats", "").replace("</li>", "\n- "))]
    open(MD, "w").write("\n".join(lines) + "\n")
