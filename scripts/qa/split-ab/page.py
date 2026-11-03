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
        "haiku-deepseek": "Haiku 리드 + DeepSeek 워커", "opus-flash": "Opus 리드 + Flash 워커",
        "astra": "Astra 혼자", "terra": "Terra 혼자", "astra-terra": "Astra 리드 + Terra 워커", "astra-deepseek": "Astra 리드 + DeepSeek 워커",
        "astra-haiku": "Astra 리드 + Haiku 워커", "opus-terra": "Opus 리드 + Terra 워커", "sol-terra": "Sol 리드 + Terra 워커"}
GROUPS = [("logic", "퍼즐/로직"), ("rpg", "일반 RPG"), ("romance", "연애물")]
W = dict(quality=50, cost=25, speed=15, stability=10)
esc = html.escape
mean = lambda xs: (sum(xs) / len(xs)) if xs else None
FULL_N = 20          # 이만큼 판이 있어야 «전체» 조합(11과제 × 3판) — 그 밖은 선별
VR = json.load(open(f"{L}/video_review.json")) if os.path.exists(f"{L}/video_review.json") else {}
key = lambda r: f'{r["arm"]}__{r["task"]}__{r["rep"]}'


def false_done(r):
    """거짓 완료 — 시간 안에 «다 했다»고 끝냈는데(마지막 턴 settled) 요청 기능이 빠졌거나 깨짐: 판정 falseDone 또는 핵심이 안 돎(works=false).
    영상 검토(video_review.json)가 판정과 다르면 영상이 이긴다."""
    v = VR.get(key(r), {})
    if v.get("falseDone") is not None: return bool(v["falseDone"])
    return bool(r.get("claimedDone")) and (bool(r.get("falseDone")) or r.get("works") is False)


def quality(r):
    parts = [r["checksPass"] / r["checksN"]]
    if r.get("fidelity") is not None: parts.append(r["fidelity"] / 10)
    if r.get("readability") is not None: parts.append(r["readability"] / 10)
    if r.get("fidelity") is not None: parts.append(max(0.0, 1 - 0.12 * (r.get("defects") or 0) - (0.3 if false_done(r) else 0)))
    for k in ("dialogue", "staging"):
        if r.get(k) is not None: parts.append(r[k] / 10)
    q = sum(parts) / len(parts)
    return q * 0.5 if false_done(r) else q


def agg(rs):
    a = {}
    a["n"] = len(rs); a["tasks"] = len({r["task"] for r in rs})
    ok = [r for r in rs if not false_done(r)]
    a["fd"] = len(rs) - len(ok); a["fdRate"] = a["fd"] / len(rs) if rs else None
    a["complete"] = mean([r["checksPass"] / r["checksN"] for r in ok])
    a["completeAll"] = mean([r["checksPass"] / r["checksN"] for r in rs])
    a["ending"] = mean([1.0 if r.get("works") else 0.0 for r in rs if r.get("works") is not None])
    for k in ("fidelity", "readability", "dialogue", "staging", "defects"):
        a[k] = mean([r[k] for r in rs if r.get(k) is not None])
    a["reviews"] = sum(r.get("leadReviews") or 0 for r in rs); a["unread"] = sum(r.get("leadUnreadJson") or 0 for r in rs)
    a["unreadOther"] = sum(r.get("leadUnreadOther") or 0 for r in rs); a["planFail"] = sum(1 for r in rs if r.get("leadPlanFail"))
    a["split"] = any(r.get("lead") for r in rs)
    a["cost"] = mean([r["cost"] for r in rs]); a["costW"] = mean([r["costWorker"] for r in rs]); a["costL"] = mean([r["costLead"] for r in rs])
    a["min"] = mean([r["min"] for r in rs if r.get("min")]); a["calls"] = mean([r["callsWorker"] + r["callsLead"] for r in rs])
    a["timeout"] = sum(1 for r in rs if "timeout" in (r.get("outcome") or ""))
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
full = [a for a in arms if sum(1 for r in rows if r["arm"] == a) >= FULL_N]
part = [a for a in arms if a not in full]
overall = scored({a: agg([r for r in rows if r["arm"] == a]) for a in full})
screen_only = {a: agg([r for r in rows if r["arm"] == a]) for a in part}
genre = {g: scored({a: agg([r for r in rows if r["arm"] == a and r["group"] == g]) for a in full if any(r["arm"] == a and r["group"] == g for r in rows)}) for g, _ in GROUPS}
SCREEN = ["lock", "quest", "date"]     # GPT 선별 과제 — 모든 조합이 돈 과제만 따로 비교
screen = scored({a: agg([r for r in rows if r["arm"] == a and r["task"] in SCREEN]) for a in arms if any(r["arm"] == a and r["task"] in SCREEN for r in rows)})


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


def picks(arm, top=2):
    """그 조합에서 점수 높은 판 — 거짓 완료가 아닌 것 먼저, 품질 순, 같으면 싼 것."""
    rs = [r for r in rows if r["arm"] == arm and r.get("fidelity") is not None]
    return sorted(rs, key=lambda r: (false_done(r), -quality(r), r["cost"]))[:top]


def videos(arm):
    out = []
    for r in picks(arm):
        k = key(r)
        if not os.path.exists(os.path.expanduser(f"~/claude-viz/lead-worker-split/{k}.mp4")): continue
        v = VR.get(k, {}); note = v.get("note", "")
        flag = ' <b class="warn">영상 ≠ 판정</b>' if v.get("contradicts") else ""
        out.append(f'<figure><video controls preload="metadata" width="250" src="lead-worker-split/{k}.mp4"></video>'
                   f'<figcaption>{esc(TASKS[r["task"]]["label"])} {r["rep"]}판 · 체크 {r["checksPass"]}/{r["checksN"]} · 정확도 {r.get("fidelity")}{flag}<br>{esc(note)}</figcaption></figure>')
    return "".join(out) or '<small>(영상 없음)</small>'


def table(aggs, title, ranked=True, extra_rows=None, with_genre=False, with_video=False):
    ks = list(aggs) + list(extra_rows or {})
    allA = {**aggs, **(extra_rows or {})}
    col = lambda key_: [allA[k][key_] for k in ks]
    head = ["조합", "n", "연출", "대사", "요청 기능 체크리스트 통과<br><small>(거짓완료 제외)</small>", "거짓완료 비율", "리드 검토<br>«답 못 읽음» 통과",
            "엔딩·핵심 동작", "정확도", "가독성", "구조 결함", "$/요청", "(리드 / 워커)", "분", "시간 초과", "도구 실패율", "안정성(편차)"]
    if with_genre: head += [f"{g}<br><small>점수 #순위</small>" for _, g in GROUPS]
    head += ["품질<br><small>점수 #순위</small>", "종합<br><small>(비용·속도 포함)</small>", "순위"]
    qorder = sorted(aggs, key=lambda k: -aggs[k]["quality"]); qrank = {k: i + 1 for i, k in enumerate(qorder)}
    if with_video: head += ["플레이 영상 (점수 높은 2판, 출하 플레이어)"]
    trs = []
    order = sorted(aggs, key=lambda k: -aggs[k]["quality"]) + sorted(extra_rows or {}, key=lambda k: -(extra_rows[k]["quality"] or 0))   # 줄 순서 = 품질 순
    for k in order:
        a = allA[k]; sel = k in (extra_rows or {})
        nm = esc(NAME.get(k, k)) + (' <small class="sel">선별 3과제×1판</small>' if sel else "")
        unread = f'{a["unread"]}/{a["reviews"]}<small> ({a["unread"] / a["reviews"] * 100:.0f}%)</small>' if a["split"] and a["reviews"] else ("—" if not a["split"] else "0/0")
        if a["split"] and (a["unreadOther"] or a["planFail"]): unread += f'<br><small>호출 오류 {a["unreadOther"]} · 계획 실패 {a["planFail"]}</small>'
        tds = [f'<td class="name">{nm}</td>', f'<td data-v="{a["n"]}">{a["n"]}<small> ({a["tasks"]}과제)</small></td>',
               cell(a["staging"], f1, col("staging")), cell(a["dialogue"], f1, col("dialogue")),
               cell(a["complete"], pct, col("complete"), extra=f'<small> ({a["n"] - a["fd"]}판)</small>'), cell(a["fdRate"], lambda v: f'{v * 100:.0f}%<small> ({a["fd"]}/{a["n"]})</small>', col("fdRate"), False),
               f'<td data-v="{a["unread"]}">{unread}</td>',
               cell(a["ending"], pct, col("ending")), cell(a["fidelity"], f1, col("fidelity")),
               cell(a["readability"], f1, col("readability")), cell(a["defects"], f1, col("defects"), False),
               cell(a["cost"], usd, col("cost"), False, " <small>추정</small>" if a["est"] else ""),
               f'<td data-v="{a["costL"]}"><small>{usd(a["costL"])} / {usd(a["costW"])}</small></td>',
               cell(a["min"], f1, col("min"), False), f'<td data-v="{a["timeout"]}">{a["timeout"]}</td>',
               cell(a["failRate"], pct, col("failRate"), False), cell(a["spread"], pct, col("spread"), False)]
        if with_genre:
            for g, _ in GROUPS:
                ga = genre[g].get(k)
                tds.append(cell(ga["total"] if ga else None, lambda v: f"{v:.0f}", [x["total"] for x in genre[g].values()], extra=f' <small>#{ga["rank"]}</small>' if ga else ""))
        if sel: tds += [f'<td data-v="{a["quality"]}">{a["quality"] * 100:.0f}</td>', '<td class="na">—</td>', '<td data-v="99"><small>선별</small></td>']
        else: tds += [cell(a["quality"], lambda v: f"{v * 100:.0f}", [aggs[x]["quality"] for x in aggs], extra=f' <small>#{qrank[k]}</small>'),
                      cell(a["total"], lambda v: f"{v:.0f}", [aggs[x]["total"] for x in aggs]), f'<td data-v="{a["rank"]}"><b>{a["rank"]}</b></td>']
        if with_video: tds.append(f'<td class="vid">{videos(k)}</td>')
        trs.append(f'<tr class="{"selrow" if sel else ""}">{"".join(tds)}</tr>')
    return f'<h2>{esc(title)}</h2><table class="sort"><thead><tr>{"".join(f"<th>{h}</th>" for h in head)}</tr></thead><tbody>{"".join(trs)}</tbody></table>'


per = []
for r in sorted(rows, key=lambda r: (list(TASKS).index(r["task"]), r["arm"], r["rep"])):
    fd = false_done(r); v = VR.get(key(r), {})
    per.append(f'<tr class="{"fd" if fd else ""}">' + "".join([f'<td>{esc(TASKS[r["task"]]["label"])}</td>', f'<td class="name">{esc(NAME.get(r["arm"], r["arm"]))}</td>', f'<td>{r["rep"]}</td>',
        f'<td>{r.get("staging") if r.get("staging") is not None else "—"}</td>', f'<td>{r.get("dialogue") if r.get("dialogue") is not None else "—"}</td>',
        f'<td data-v="{r["checksPass"] / r["checksN"]}">{r["checksPass"]}/{r["checksN"]} <small>{"플레이" if r["checksSrc"] == "play" else "판정"}</small></td>',
        f'<td>{"거짓완료" if fd else ""}</td>',
        f'<td>{r.get("fidelity") if r.get("fidelity") is not None else "—"}</td>', f'<td>{r.get("readability") if r.get("readability") is not None else "—"}</td>',
        f'<td>{r.get("defects", "—")}</td>', f'<td>{(str(r.get("leadUnreadJson", 0)) + "/" + str(r.get("leadReviews", 0))) if r.get("lead") else "—"}</td>',
        f'<td data-v="{r["cost"]}">{usd(r["cost"])}{" 추정" if r.get("estimated") else ""}<small> (L {usd(r["costLead"])})</small></td>',
        f'<td>{r["min"]}</td>', f'<td>{esc(r["outcome"])}</td>', f'<td>{r["tools"]}/{r["toolFails"]}✗</td>',
        f'<td class="sum">{esc(r.get("summary") or "")}{("<br><b>영상:</b> " + esc(v["note"])) if v.get("note") else ""}</td>']) + "</tr>")

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
td.sum{{text-align:left;white-space:normal;min-width:440px;max-width:560px;color:#555}}td.good{{background:#dff3e2}}td.ok{{background:#fbf6dc}}td.bad{{background:#f8dcdc}}td.na{{color:#aaa}}td.vid{{text-align:left;white-space:normal;min-width:530px}}td.vid figure{{display:inline-block;vertical-align:top;margin:2px 6px 2px 0;width:250px}}figcaption{{font-size:11.5px;color:#444;white-space:normal}}.warn{{color:#b00}}tr.selrow td.name{{background-color:#eef0f8}}tr.fd td{{color:#a33}}small.sel{{color:#7a5;font-weight:400}}
small{{color:#666}}.dia{{width:760px;max-width:100%}}.dia rect.u{{fill:#eee;stroke:#999}}.dia rect.l{{fill:#e6efff;stroke:#5b7fd6}}.dia rect.w{{fill:#e9f7ec;stroke:#4c9a5f}}.dia rect.m{{fill:#fff4e0;stroke:#d39b38}}
.dia text{{text-anchor:middle;font-size:14px}}.dia text.s{{font-size:11.5px;fill:#444}}.dia .a{{stroke:#555;fill:none;marker-end:url(#ar)}}.dia .d{{stroke-dasharray:4 3}}.note{{color:#555;font-size:13px}}</style></head><body>
<h1>리드·워커 나누기 — 조합별 점수표</h1>
<p class="note">같은 무대 체크포인트(맵·이름 붙은 이벤트만 있는 상태)에 요청 하나만 보내고 15분 상한으로 지은 결과. 요청 기능 체크리스트 = 출하 플레이어 자동 플레이 검사(퍼즐/로직) 또는 Opus 판정 체크리스트(일반 RPG·연애물) 통과 비율.
정확도·대사·연출·가독성은 Opus 5.5 판정(1–10). 비용은 공개 정가 × 실제 토큰(Claude·DeepSeek·GPT 워커; Haiku 는 Haiku 정가), Argon 과 계정 모델 리드(Astra·Sol)는 글자 수 ÷ 3.04 로 «추정». GPT 정가: Astra $10/$50 · Sol $2/$10 · Terra $1/$5 (100만 토큰당). n = 판 수. 칸 머리를 누르면 정렬.</p>
{diagram}
<h2>결론</h2>{concl}
{table(overall, "종합 점수표", extra_rows=screen_only, with_genre=True, with_video=True)}
<p class="note">「요청 기능 체크리스트 통과」= 출하 플레이어 자동 플레이 검사(퍼즐/로직) 또는 Opus 판정 체크리스트(일반 RPG·연애물) 통과 비율 — <b>거짓 완료 판은 빼고</b> 평균했다.
거짓 완료 = 시간 안에 «다 했다»고 끝냈는데 요청 기능이 빠졌거나 깨진 판(판정 falseDone, 또는 끝냈다는데 핵심이 안 돎). 영상이 판정과 다르면 영상을 따른다. 시간 초과(15분 상한)는 거짓 완료가 아니다.
「리드 검토 «답 못 읽음» 통과」= 리드 답에 JSON 이 없거나 못 읽어서 parseLeadReview 가 승인으로 처리한 검토 수 / 전체 검토 수. <b>이 비율이 높은 조합은 리드 검토 없이 통과한 셈이라 점수가 부풀었을 수 있다.</b>
종합 = 품질 {W['quality']} · 비용 {W['cost']} · 속도 {W['speed']} · 안정성 {W['stability']} (품질 = 체크리스트·정확도·가독성·구조·대사·연출 평균, 거짓 완료 판은 절반). 비용·속도는 조합 사이 로그 눈금.
줄 순서는 품질 순이다. 「종합」은 비용 25%·속도 15%를 섞은 점수라 값싼 조합이 위로 올라온다. 기본값 추천은 품질 칸(연출·대사·체크리스트·거짓 완료)으로 정했다. 순위는 11과제×3판을 다 돈 조합끼리만 매긴다. 「선별」 행(GPT)은 자물쇠·마을 퀘스트·데이트 1판씩이라 순위에서 뺐다 — 아래 3과제 표에서 같은 과제끼리 비교.</p>
{table(screen, "같은 3과제만 (자물쇠·마을 퀘스트·데이트) — GPT 조합과 나란히")}
{''.join(table(genre[g], f"{t} 과제만") for g, t in GROUPS if genre[g])}
<h2>과제별 판</h2><table class="sort"><thead><tr><th>과제</th><th>조합</th><th>판</th><th>연출</th><th>대사</th><th>체크리스트</th><th>거짓완료</th><th>정확도</th><th>가독성</th><th>구조 결함</th><th>리드 «답 못 읽음»</th><th>$</th><th>분</th><th>결과</th><th>도구/실패</th><th>판정 한 줄</th></tr></thead><tbody>{''.join(per)}</tbody></table>
<script>document.querySelectorAll('table.sort th').forEach((th,i)=>th.onclick=()=>{{const tb=th.closest('table').tBodies[0];const rs=[...tb.rows];const d=th.dataset.d=th.dataset.d==='1'?'-1':'1';
rs.sort((a,b)=>{{const x=a.cells[i],y=b.cells[i];const vx=parseFloat(x.dataset.v??x.textContent),vy=parseFloat(y.dataset.v??y.textContent);return (isNaN(vx)||isNaN(vy)?x.textContent.localeCompare(y.textContent):vx-vy)*d}});rs.forEach(r=>tb.appendChild(r))}})</script>
</body></html>"""
open(OUT, "w").write(page)
print("written", OUT, len(rows), "runs")
