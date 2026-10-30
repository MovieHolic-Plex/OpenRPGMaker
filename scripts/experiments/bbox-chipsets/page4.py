"""bbox-chipsets round 4 section (sketch arm vs round 3 JSON arm) for bbox-chipsets-3.html. section(J, M, copy, IMG_REL) -> html."""
import json, os, sys, html
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from places import PLACES
import sketch
H = os.path.expanduser("~"); S = f"{H}/z-project/assistant-whole-game/suite/rooms"
R3, R4 = f"{S}/runs-bbox-chipsets-3", f"{S}/runs-bbox-chipsets-4"
SLOTS = ("sol1", "sol2", "terra1", "terra2")

def need(place, L):
    """what the request asks, checked the same way for both arms"""
    ids = [o.get("id", "") for o in ([L.get("landmark") or {}] + (L.get("objects") or [])) if isinstance(o, dict)]
    if place == "wz-class": return f"솥 {sum('cauldron' in i for i in ids)}개"
    fl = {r.get("floor") for r in L.get("regions") or []}
    have = [k for k, f in (("현관", "tataki"), ("다다미", "tatami"), ("욕실", "bathtile")) if f in fl]
    return "·".join(have) or "—"

def section(J, M, copy, rel, fmt, wdl, add):
    if not os.path.isdir(R4): return ""
    res3, res4 = J(f"{R3}/results-opus.json"), J(f"{R4}/results-opus.json")
    m = lambda rnd, run, f, pct=False: ("—" if M.get(f"{rnd}|{run}", {}).get(f) is None else f"{M[f'{rnd}|{run}'][f]}{'%' if pct else ''}")
    out, summ, tot = [], [], {"r3": (0, 0, 0, 0), "r4": (0, 0, 0, 0), "vs": (0, 0, 0, 0)}
    for place in ("jp-house", "wz-class"):
        rows, cards, pt, b3s, b4s = [], [], {k: (0, 0, 0, 0) for k in tot}, [0, 0], [0, 0]
        for slot in SLOTS:
            run = f"{slot}/{place}"; L3, L4 = J(f"{R3}/{run}/layout.json"), J(f"{R4}/{run}/layout.json"); RUN4 = J(f"{R4}/{run}/RUN.json")
            a, b, c = wdl(res3, run), wdl(res4, run), wdl(res4, run, True)
            pt = {"r3": add(pt["r3"], a), "r4": add(pt["r4"], b), "vs": add(pt["vs"], c)}
            if L3.get("regions"):
                L3p = dict(L3); b3 = sketch.box_rooms(L3p); b3s = [b3s[0] + b3[0], b3s[1] + b3[1]]
            else: b3 = None
            b4 = sketch.box_rooms(L4) if L4.get("regions") else None
            if b4: b4s = [b4s[0] + b4[0], b4s[1] + b4[1]]
            state = "" if not RUN4 else ("통과" if RUN4.get("ok") else ("공간 검사 미통과로 그대로 깜" if RUN4.get("structOk") else "검증 실패"))
            if not RUN4 and os.path.exists(f"{R4}/{run}/prompt.txt"): state = "실행 중"
            notes = "; ".join(RUN4.get("requiredNotes") or []) if RUN4 else ""
            rows.append(f"<tr><td>{slot}</td><td>{b3[0] if b3 else '—'}/{b3[1] if b3 else '—'} → <b>{b4[0] if b4 else '—'}/{b4[1] if b4 else '—'}</b></td>"
                        f"<td>{m('r3', run, 'emptyPct', True)} → <b>{m('r4', run, 'emptyPct', True)}</b></td><td>{m('r3', run, 'types')} → <b>{m('r4', run, 'types')}</b></td>"
                        f"<td>{need(place, L3)} → <b>{need(place, L4) if L4 else '—'}</b>{('<br><small>' + html.escape(notes) + '</small>') if notes else ''}</td>"
                        f"<td>{fmt(a)} → <b>{fmt(b)}</b></td><td>{fmt(c)}</td><td>{state}</td></tr>")
            i3 = copy(f"{R3}/{run}/map.png", f"{rel[1]}/r3-{slot}-{place}.png", 2); i4 = copy(f"{R4}/{run}/map.png", f"{rel[1]}/r4-{slot}-{place}.png", 2)
            plan = "\n".join(L4.get("plan") or [])
            cards.append(f"<div class=card><h3>{place} · {slot} — 3판(JSON 벽) vs 4판(평면 스케치)</h3><div class=pair>"
                         + (f"<figure><img src='{rel[0]}/r3-{slot}-{place}.png'><figcaption>3판 JSON 벽 · 상자 {b3[0]}/{b3[1]}</figcaption></figure>" if i3 and b3 else "")
                         + (f"<figure><img src='{rel[0]}/r4-{slot}-{place}.png'><figcaption>4판 스케치 · 상자 {b4[0]}/{b4[1]} · {state}</figcaption></figure>" if i4 and b4 else f"<figure><p class=meta>4판 {state or '대기'}</p></figure>")
                         + (f"<figure style='flex:0 0 auto'><pre class=plan>{html.escape(plan)}</pre><figcaption>모델이 먼저 그린 평면</figcaption></figure>" if plan else "")
                         + "</div></div>")
        for k in tot: tot[k] = add(tot[k], pt[k])
        summ.append(f"<tr><td>{place}</td><td>{b3s[0]}/{b3s[1]} → <b>{b4s[0]}/{b4s[1]}</b></td><td>{fmt(pt['r3'])} → <b>{fmt(pt['r4'])}</b></td><td>{fmt(pt['vs'])}</td></tr>")
        out.append(f"<h3 class=sub>{place}</h3><table><tr><th>판</th><th>상자 공간 3→4</th><th>빈 바닥 3→4</th><th>물건 종류 3→4</th><th>요청 항목 3→4</th><th>Opus vs 기준 3→4</th><th>4판 vs 3판</th><th>4판 상태</th></tr>{''.join(rows)}</table>{''.join(cards)}")
    return (f"<h2 id=r4>4판 — 평면을 먼저 문자 격자로 그리기 (스케치 방식, 3판 JSON 방식과 A/B)</h2>"
            "<p>모델이 실제 칸 크기의 문자 평면(# 벽 · 방 글자 · D 문 · c 기둥 · = 낮은 칸막이 · ^ 단)을 먼저 그리고, JSON 은 방 바닥·물건만 더한다. 요청에서 뽑은 필수 항목(예: 솥 실습대)은 할 일 목록으로 확인한다. "
            "상자 공간 = 이어진 열린 공간 중 바운딩 박스를 90% 이상 채우고 기둥·칸막이·단이 없는 것(두 방식 같은 기준), 표기는 상자/전체.</p>"
            f"<table><tr><th>장소</th><th>상자 공간 3→4 (합)</th><th>Opus vs 기준 3→4</th><th>4판 vs 3판(같은 칸)</th></tr>{''.join(summ)}"
            f"<tr><td><b>합계</b></td><td></td><td>{fmt(tot['r3'])} → <b>{fmt(tot['r4'])}</b></td><td>{fmt(tot['vs'])}</td></tr></table>" + "".join(out))
