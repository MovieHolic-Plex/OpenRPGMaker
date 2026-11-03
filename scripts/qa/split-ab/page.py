#!/usr/bin/env python3
"""Lead/worker split battery — scorecard page ~/claude-viz/lead-worker-split.html from <batch>/measure.json (Korean)."""
import html, json, math, os, statistics, sys
L = sys.argv[1]
OUT = os.path.expanduser(sys.argv[2] if len(sys.argv) > 2 else "~/claude-viz/lead-worker-split.html")
P = json.load(open(os.path.join(os.path.dirname(os.path.abspath(__file__)), "prompts.json")))
TASKS = {t["id"]: t for t in P["tasks"]}
rows = [r for r in json.load(open(f"{L}/measure.json"))["rows"] if r.get("checksN")]
NAME = {"opus": "Opus 혼자", "haiku": "Haiku 혼자", "deepseek": "DeepSeek 혼자", "flash": "Flash 혼자", "argon": "Argon 혼자",
        "opus-haiku": "Opus 리드 + Haiku 워커", "opus-deepseek": "Opus 리드 + DeepSeek 워커", "argon-haiku": "Argon 리드 + Haiku 워커",
        "haiku-deepseek": "Haiku 리드 + DeepSeek 워커", "opus-flash": "Opus 리드 + Flash 워커"}
GROUPS = [("logic", "퍼즐/로직"), ("rpg", "일반 RPG"), ("romance", "연애물")]
W = dict(quality=50, cost=25, speed=15, stability=10)
esc = html.escape
mean = lambda xs: (sum(xs) / len(xs)) if xs else None


def quality(r):
    parts = [r["checksPass"] / r["checksN"]]
    if r.get("fidelity") is not None: parts.append(r["fidelity"] / 10)
    if r.get("readability") is not None: parts.append(r["readability"] / 10)
    if r.get("fidelity") is not None: parts.append(max(0.0, 1 - 0.12 * (r.get("defects") or 0) - (0.3 if r.get("falseDone") else 0)))
    for k in ("dialogue", "staging"):
        if r.get(k) is not None: parts.append(r[k] / 10)
    return sum(parts) / len(parts)


def agg(rs):
    a = {}
    a["n"] = len(rs); a["tasks"] = len({r["task"] for r in rs})
    a["complete"] = mean([r["checksPass"] / r["checksN"] for r in rs])
    a["ending"] = mean([1.0 if r.get("works") else 0.0 for r in rs if r.get("works") is not None])
    for k in ("fidelity", "readability", "dialogue", "staging", "defects"):
        a[k] = mean([r[k] for r in rs if r.get(k) is not None])
    a["falseDone"] = sum(1 for r in rs if r.get("falseDone"))
    a["cost"] = mean([r["cost"] for r in rs]); a["costW"] = mean([r["costWorker"] for r in rs]); a["costL"] = mean([r["costLead"] for r in rs])
    passed = sum(r["checksPass"] for r in rs); a["perPass"] = (sum(r["cost"] for r in rs) / passed) if passed else None
    a["min"] = mean([r["min"] for r in rs if r.get("min")]); a["calls"] = mean([r["callsWorker"] + r["callsLead"] for r in rs])
    a["callsL"] = mean([r["callsLead"] for r in rs]); a["tools"] = mean([r["tools"] for r in rs])
    a["failRate"] = (sum(r["toolFails"] for r in rs) / max(1, sum(r["tools"] for r in rs)))
    a["est"] = any(r.get("estimated") for r in rs)
    by = {}
    for r in rs: by.setdefault(r["task"], []).append(r["checksPass"] / r["checksN"])
    spreads = [max(v) - min(v) for v in by.values() if len(v) >= 2]
    a["spread"] = mean(spreads) if spreads else None
    a["quality"] = mean([quality(r) for r in rs])
    return a


def scored(aggs):
    costs = [a["cost"] for a in aggs.values() if a["cost"]]; mins = [a["min"] for a in aggs.values() if a["min"]]
    def logscore(v, xs):
        if not v or len(xs) < 2 or max(xs) == min(xs): return 1.0
        return (math.log(max(xs)) - math.log(v)) / (math.log(max(xs)) - math.log(min(xs)))
    for a in aggs.values():
        a["costScore"] = logscore(a["cost"], costs); a["speedScore"] = logscore(a["min"], mins)
        a["stabScore"] = None if a["spread"] is None else max(0.0, 1 - a["spread"])
        parts = [(W["quality"], a["quality"]), (W["cost"], a["costScore"]), (W["speed"], a["speedScore"])]
        if a["stabScore"] is not None: parts.append((W["stability"], a["stabScore"]))
        a["total"] = 100 * sum(w * v for w, v in parts) / sum(w for w, _ in parts)
    order = sorted(aggs, key=lambda k: -aggs[k]["total"])
    for i, k in enumerate(order): aggs[k]["rank"] = i + 1
    return aggs


arms = [a for a in P["arms"] if any(r["arm"] == a for r in rows)]
overall = scored({a: agg([r for r in rows if r["arm"] == a]) for a in arms})
genre = {g: scored({a: agg([r for r in rows if r["arm"] == a and r["group"] == g]) for a in arms if any(r["arm"] == a and r["group"] == g for r in rows)}) for g, _ in GROUPS}


def tone(v, xs, hi_good=True):
    xs = [x for x in xs if x is not None]
    if v is None or len(xs) < 2: return ""
    lo, hi = min(xs), max(xs)
    if hi == lo: return "ok"
    t = (v - lo) / (hi - lo)
    if not hi_good: t = 1 - t
    return "good" if t >= 0.67 else "bad" if t < 0.34 else "ok"


def cell(v, fmt, xs=None, hi_good=True, extra=""):
    if v is None: return '<td class="na">—</td>'
    cls = tone(v, xs or [], hi_good) if xs is not None else ""
    return f'<td class="{cls}" data-v="{v}">{fmt(v)}{extra}</td>'


pct = lambda v: f"{v * 100:.0f}%"
f1 = lambda v: f"{v:.1f}"
usd = lambda v: f"${v:.3f}" if v < 1 else f"${v:.2f}"
def table(aggs, title, with_genre=False):
    ks = list(aggs)
    col = lambda key: [aggs[k][key] for k in ks]
    head = ["조합", "n", "완성도", "엔딩·핵심 동작", "정확도", "가독성", "구조 결함", "거짓 완료", "대사", "연출", "$/요청", "(리드 / 워커)", "$/통과 검사", "분", "모델 호출(리드)", "도구 호출", "실패율", "안정성(편차)", "종합", "순위"]
    if with_genre: head[18:18] = [g for _, g in GROUPS]
    trs = []
    for k in sorted(ks, key=lambda k: aggs[k]["rank"]):
        a = aggs[k]
        tds = [f'<td class="name">{esc(NAME.get(k, k))}</td>', f'<td data-v="{a["n"]}">{a["n"]}<small> ({a["tasks"]}과제)</small></td>',
               cell(a["complete"], pct, col("complete")), cell(a["ending"], pct, col("ending")), cell(a["fidelity"], f1, col("fidelity")),
               cell(a["readability"], f1, col("readability")), cell(a["defects"], f1, col("defects"), False), cell(a["falseDone"], str, col("falseDone"), False),
               cell(a["dialogue"], f1, col("dialogue")), cell(a["staging"], f1, col("staging")),
               cell(a["cost"], usd, col("cost"), False, " <small>추정</small>" if a["est"] else ""),
               f'<td data-v="{a["costL"]}"><small>{usd(a["costL"])} / {usd(a["costW"])}</small></td>',
               cell(a["perPass"], usd, col("perPass"), False), cell(a["min"], f1, col("min"), False),
               f'<td data-v="{a["calls"]}">{a["calls"]:.0f}<small> ({a["callsL"]:.0f})</small></td>', cell(a["tools"], lambda v: f"{v:.0f}"),
               cell(a["failRate"], pct, col("failRate"), False), cell(a["spread"], pct, col("spread"), False)]
        if with_genre:
            for g, _ in GROUPS:
                ga = genre[g].get(k)
                tds.append(cell(ga["total"] if ga else None, lambda v: f"{v:.0f}", [x["total"] for x in genre[g].values()], extra=f' <small>#{ga["rank"]}</small>' if ga else ""))
        tds += [cell(a["total"], lambda v: f"{v:.0f}", col("total")), f'<td data-v="{a["rank"]}"><b>{a["rank"]}</b></td>']
        trs.append(f"<tr>{''.join(tds)}</tr>")
    return f'<h2>{esc(title)}</h2><table class="sort"><thead><tr>{"".join(f"<th>{esc(h)}</th>" for h in head)}</tr></thead><tbody>{"".join(trs)}</tbody></table>'


per = []
for r in sorted(rows, key=lambda r: (list(TASKS).index(r["task"]), r["arm"], r["rep"])):
    per.append("<tr>" + "".join([f'<td>{esc(TASKS[r["task"]]["label"])}</td>', f'<td class="name">{esc(NAME.get(r["arm"], r["arm"]))}</td>', f'<td>{r["rep"]}</td>',
        f'<td data-v="{r["checksPass"] / r["checksN"]}">{r["checksPass"]}/{r["checksN"]} <small>{"플레이" if r["checksSrc"] == "play" else "판정"}</small></td>',
        f'<td>{r.get("fidelity") if r.get("fidelity") is not None else "—"}</td>', f'<td>{r.get("readability") if r.get("readability") is not None else "—"}</td>',
        f'<td>{r.get("dialogue") if r.get("dialogue") is not None else "—"}</td>', f'<td>{r.get("staging") if r.get("staging") is not None else "—"}</td>',
        f'<td>{r.get("defects", "—")}{" · 거짓완료" if r.get("falseDone") else ""}</td>',
        f'<td data-v="{r["cost"]}">{usd(r["cost"])}{" 추정" if r.get("estimated") else ""}<small> (L {usd(r["costLead"])})</small></td>',
        f'<td>{r["min"]}</td>', f'<td>{r["callsWorker"]}+{r["callsLead"]}</td>', f'<td>{r["tools"]}/{r["toolFails"]}✗</td>',
        f'<td class="sum">{esc(r.get("summary") or "")}</td>']) + "</tr>")

concl = open(f"{L}/conclusion.html").read() if os.path.exists(f"{L}/conclusion.html") else "<p>(측정 중)</p>"
diagram = """<svg viewBox="0 0 760 250" class="dia" role="img" aria-label="리드·워커 나누기">
<defs><marker id="ar" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M0,0 L8,4 L0,8 z" fill="#555"/></marker></defs>
<rect x="10" y="95" width="120" height="56" rx="8" class="u"/><text x="70" y="120">사용자 요청</text><text x="70" y="139" class="s">(한국어)</text>
<rect x="180" y="15" width="220" height="90" rx="8" class="l"/><text x="290" y="40">리드 (비싼 모델)</text>
<text x="290" y="62" class="s">① 할 일 + 구체 사양(이벤트·변수·대사)</text><text x="290" y="82" class="s">③ 단계 끝 검토: 승인 / 영어 고칠 것</text><text x="290" y="98" class="s">도구 호출은 안 본다 — 요약만</text>
<rect x="180" y="140" width="220" height="90" rx="8" class="w"/><text x="290" y="165">워커 (값싼 모델 = 주 모델)</text>
<text x="290" y="187" class="s">② 사양대로 도구 호출·오류 재시도</text><text x="290" y="207" class="s">할 일 고리(omo)·완료 관문 그대로</text>
<rect x="470" y="140" width="130" height="90" rx="8" class="m"/><text x="535" y="170">기계 확인</text><text x="535" y="190" class="s">TodoChecks</text><text x="535" y="208" class="s">통과해야 done</text>
<rect x="640" y="95" width="110" height="56" rx="8" class="u"/><text x="695" y="128">프로젝트</text>
<path d="M130,115 L178,70" class="a"/><path d="M290,105 L290,138" class="a"/><path d="M400,185 L468,185" class="a"/><path d="M600,170 L638,135" class="a"/>
<path d="M470,160 C430,120 430,90 402,70" class="a d"/><text x="455" y="105" class="s">할 일 표·변경 요약</text></svg>"""
page = f"""<!doctype html><html lang="ko"><head><meta charset="utf-8"><title>리드·워커 나누기 점수표</title>
<style>body{{font:14px/1.5 system-ui,sans-serif;margin:24px;color:#222;max-width:1500px}}table{{border-collapse:collapse;margin:8px 0 24px;font-size:13px}}
th,td{{border:1px solid #ddd;padding:4px 7px;text-align:right;white-space:nowrap}}th{{background:#f4f4f4;cursor:pointer;position:sticky;top:0}}td.name{{text-align:left;font-weight:600}}
td.sum{{text-align:left;white-space:normal;min-width:440px;max-width:560px;color:#555}}td.good{{background:#dff3e2}}td.ok{{background:#fbf6dc}}td.bad{{background:#f8dcdc}}td.na{{color:#aaa}}
small{{color:#666}}.dia{{width:760px;max-width:100%}}.dia rect.u{{fill:#eee;stroke:#999}}.dia rect.l{{fill:#e6efff;stroke:#5b7fd6}}.dia rect.w{{fill:#e9f7ec;stroke:#4c9a5f}}.dia rect.m{{fill:#fff4e0;stroke:#d39b38}}
.dia text{{text-anchor:middle;font-size:14px}}.dia text.s{{font-size:11.5px;fill:#444}}.dia .a{{stroke:#555;fill:none;marker-end:url(#ar)}}.dia .d{{stroke-dasharray:4 3}}.note{{color:#555;font-size:13px}}</style></head><body>
<h1>리드·워커 나누기 — 조합별 점수표</h1>
<p class="note">같은 무대 체크포인트(맵·이름 붙은 이벤트만 있는 상태)에 요청 하나만 보내고 15분 상한으로 지은 결과. 완성도 = 출하 플레이어 자동 플레이 검사(퍼즐/로직) 또는 Opus 판정 체크리스트(일반 RPG·연애물) 통과 비율.
정확도·대사·연출·가독성은 Opus 5.5 판정(1–10). 비용은 공개 정가 × 실제 토큰(Claude·DeepSeek), Flash·Argon 은 글자 수로 «추정». n = 판 수. 칸 머리를 누르면 정렬.</p>
{diagram}
<h2>결론</h2>{concl}
{table(overall, "종합 점수표 (모든 과제)", True)}
<p class="note">종합 = 품질 {W['quality']} · 비용 {W['cost']} · 속도 {W['speed']} · 안정성 {W['stability']}. 품질 = 완성도·정확도·가독성·구조·(대사·연출) 평균. 비용·속도 점수는 조합 사이 로그 눈금(가장 싼/빠른 = 1).
안정성은 같은 과제를 2판 이상 돌린 조합만(완성도 편차) — 없으면 나머지 셋으로 나눠 매긴다.</p>
{''.join(table(genre[g], f"{t} 과제만") for g, t in GROUPS if genre[g])}
<h2>과제별 판</h2><table class="sort"><thead><tr><th>과제</th><th>조합</th><th>판</th><th>완성도</th><th>정확도</th><th>가독성</th><th>대사</th><th>연출</th><th>구조 결함</th><th>$</th><th>분</th><th>호출 W+L</th><th>도구/실패</th><th>판정 한 줄</th></tr></thead><tbody>{''.join(per)}</tbody></table>
<script>document.querySelectorAll('table.sort th').forEach((th,i)=>th.onclick=()=>{{const tb=th.closest('table').tBodies[0];const rs=[...tb.rows];const d=th.dataset.d=th.dataset.d==='1'?'-1':'1';
rs.sort((a,b)=>{{const x=a.cells[i],y=b.cells[i];const vx=parseFloat(x.dataset.v??x.textContent),vy=parseFloat(y.dataset.v??y.textContent);return (isNaN(vx)||isNaN(vy)?x.textContent.localeCompare(y.textContent):vx-vy)*d}});rs.forEach(r=>tb.appendChild(r))}})</script>
</body></html>"""
open(OUT, "w").write(page)
print("written", OUT, len(rows), "runs")
