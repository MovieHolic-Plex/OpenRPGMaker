"""object-gate Sonnet 5.5 high 판정자 보정 결과를 Argon 과 나란히 보여 주는 자체완결 HTML 한 장(~/claude-viz/gate-sonnet.html).

    python3 src/harnesses/object-gate/tools/build_sonnet_page.py --argon 473db36f963972c9 --r1 f0b45e9ca4ea1968 --final <해시> [--out ~/claude-viz/gate-sonnet.html]

읽는 것: calibration/run-<해시>.json, profiles/<해시>.json, calibration/{interior,murim,murim-postfix-unlabeled,style}, style-refs, audit/rereview-*.json(있으면).
그림은 data URI 로 박는다. 외부 참조 없음.
"""
import argparse
import collections
import html
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from build_report_page import CAL, REPO, card, data_uri  # noqa: E402

from PIL import Image  # noqa: E402


def load_run(h: str) -> dict:
    return {x["label"]: x for x in json.loads((CAL / f"run-{h}.json").read_text())}


def three_four_sets():
    out = []
    for setname in ("interior", "murim"):
        lab = json.loads((CAL / setname / "labels.json").read_text())
        for truth in ("bad", "good"):
            for n in lab[truth]:
                out.append((setname, n, truth))
    return out


def conf34(run: dict, label_filter=None):
    c = collections.Counter()
    miss, ff = [], []
    for s, n, truth in three_four_sets():
        r = run.get(f"{s}/{n}")
        if not r:
            continue
        v = r["view34"]["verdict"]
        c[(truth, v)] += 1
        if truth == "bad" and v == "pass":
            miss.append(f"{s}/{n}")
        if truth == "good" and v == "fail":
            ff.append(f"{s}/{n}")
    # 화풍 표본 중 3/4 정상 라벨이 있는 것(버들항 기물)
    items = json.loads((CAL / "style" / "items.json").read_text())
    for it in items:
        if it.get("view34") in ("good", "bad"):
            r = run.get(f"style/{it['name']}")
            if not r:
                continue
            v = r["view34"]["verdict"]
            truth = it["view34"]
            c[(truth, v)] += 1
            if truth == "bad" and v == "pass":
                miss.append(f"style/{it['name']}")
            if truth == "good" and v == "fail":
                ff.append(f"style/{it['name']}")
    return c, miss, ff


def convstyle(run: dict):
    items = json.loads((CAL / "style" / "items.json").read_text())
    groups = collections.defaultdict(lambda: [0, 0])  # (group,truth) -> [fail, pass]
    for it in items:
        r = run.get(f"style/{it['name']}")
        if not r:
            continue
        groups[(it["group"], it["style"])][0 if r["style"]["verdict"] == "fail" else 1] += 1
    return groups


def mx(title: str, rows, note: str = "") -> str:
    body = "".join(f"<tr><th>{html.escape(l)}</th><td>{f}</td><td>{p}</td></tr>" for l, f, p in rows)
    return f'<div class="mx"><h3>{html.escape(title)}</h3><table><tr><th>실제 라벨</th><th>게이트 FAIL</th><th>게이트 PASS</th></tr>{body}</table><small>{html.escape(note)}</small></div>'


def rows34(c):
    return [("위반(bad)", c[("bad", "fail")], c[("bad", "pass")]), ("정상(good)", c[("good", "fail")], c[("good", "pass")])]


def rowsstyle(g):
    out = []
    for (grp, truth), lab in (
        (("farm-user", "bad"), "농장 v2 (사용자 반려)"), (("synthetic-shallow", "bad"), "통제 얕음(합성)"),
        (("farm-user", "good"), "농장 v3 (사용자 수락)"), (("beodeul-heldout", "good"), "버들항 홀드아웃"),
    ):
        f, p = g[(grp, truth)]
        out.append((lab + (" · 얕음" if truth == "bad" else " · 버들 수준"), f, p))
    return out


def rowsweak(g):
    return [("고치기 전(PR 부모, 약한 라벨 · 얕음)", *g[("quality-before", "bad")]), ("병합 후(약한 라벨 · 버들 수준)", *g[("quality-after", "good")])]


CSS = """body{font:14px/1.55 system-ui,sans-serif;background:#16181d;color:#e6e6ea;margin:0;padding:24px;max-width:1500px}
h1{font-size:22px}h2{margin-top:36px;border-bottom:1px solid #333;padding-bottom:6px}h3{font-size:15px;margin:0 0 6px}
.mx{display:inline-block;vertical-align:top;margin:0 20px 16px 0;background:#1e2128;padding:12px 16px;border-radius:8px;max-width:420px}
.pair{display:flex;gap:28px;flex-wrap:wrap;align-items:flex-start}.col{background:#1b1d23;border-radius:10px;padding:10px 14px}.col>b{display:block;margin-bottom:6px}
table{border-collapse:collapse}th,td{border:1px solid #333;padding:5px 12px;text-align:right}th{text-align:left;font-weight:500}
.row{display:flex;flex-wrap:wrap;gap:14px;align-items:flex-end}
figure{margin:0;background:#242832;padding:8px;border-radius:6px;border:2px solid #333}figure.ok{border-color:#3a9d5d}figure.no{border-color:#c2453f}
figure img{image-rendering:pixelated;display:block;background:#464a56}figcaption{font-size:12px;margin-top:6px;max-width:300px}small{color:#9aa}
.badge{padding:2px 8px;border-radius:10px;font-size:12px}.b-no{background:#7a2b27}.b-ok{background:#235c3a}code{background:#2a2e38;padding:1px 5px;border-radius:4px}
.note{background:#26231a;border-left:4px solid #b8962e;padding:8px 12px;margin:10px 0;border-radius:4px}"""


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--argon", required=True); ap.add_argument("--r1", required=True); ap.add_argument("--final", required=True)
    ap.add_argument("--out", default=str(Path.home() / "claude-viz" / "gate-sonnet.html"))
    a = ap.parse_args()
    argon, r1, fin = load_run(a.argon), load_run(a.r1), load_run(a.final)
    prof = lambda h: json.loads((REPO / "harness-data/object-gate/profiles" / f"{h}.json").read_text()) if (REPO / "harness-data/object-gate/profiles" / f"{h}.json").exists() else None
    pf = prof(a.final)
    status = pf["status"] if pf else "미기록"

    ca, miss_a, ff_a = conf34(argon); c1, miss_1, ff_1 = conf34(r1); cf, miss_f, ff_f = conf34(fin)
    ga, g1, gf = convstyle(argon), convstyle(r1), convstyle(fin)

    parts = [f"<!doctype html><meta charset=utf-8><title>object-gate · Sonnet 5.5 high 판정자</title><style>{CSS}</style>",
             "<h1>object-gate — 판정자 Claude Sonnet 5.5 (high) × 4번, Argon 과 같은 표본 · 나란히</h1>",
             f'<p>최종 프로필 <code>{a.final}</code> · 상태 <span class="badge {"b-ok" if status == "calibrated" else "b-no"}">{status}</span> · 영수증은 보정 통과 전엔 쓰지 않았다(0장). '
             f'Argon 기록 <code>{a.argon}</code> · Sonnet 1바퀴(지시문 그대로, 모델만 교체) <code>{a.r1}</code>.</p>',
             '<div class="note"><b>표본 정정(이번에 발견):</b> 이전 보정의 무림 3/4 위반 표본 6장(서가 A·B, 약재장 A·B, 징 틀, 무기 걸이)은 v2 의 위반 그림이 아니라 '
             '<b>고친 뒤(props-r1 3/4 윗면 보정 d9964e58d) 그림</b>이었다 — 해시가 v2 기록(<code>history/2026-10-09-v2</code>)과 안 맞는다. '
             'git 이력(<code>agent/murim-props</code>)에서 고치기 전 판을 다시 그려 v2 해시와 일치함을 확인하고 바꿔 넣었다(정상 표본 우물 A·찻상 A 도 v2 판으로). '
             '고친 뒤 그림 8장은 <code>calibration/murim-postfix-unlabeled/</code> 에 라벨 없이 보관. Argon 숫자는 옛(잘못된) 무림 그림 기준, Sonnet 1바퀴도 같은 옛 표본, 최종은 정정 표본이다.</div>',
             "<h2>보정 혼동표 — 나란히</h2><div class='pair'>"]
    parts.append(f"<div class='col'><b>3/4 시점 (위반 {ca[('bad','fail')]+ca[('bad','pass')]} · 정상 {ca[('good','fail')]+ca[('good','pass')]})</b>"
                 + mx("Argon medium ×4 (rejected)", rows34(ca), "옛 무림 표본") + mx("Sonnet 5.5 high ×4 — 지시문 그대로(1바퀴)", rows34(c1), "옛 무림 표본")
                 + mx("Sonnet 5.5 high ×4 — 최종 지시문+측정값", rows34(cf), "정정 무림 표본") + "</div>")
    parts.append("<div class='col'><b>화풍 — 강한 라벨</b>" + mx("Argon", rowsstyle(ga)) + mx("Sonnet 1바퀴", rowsstyle(g1)) + mx("Sonnet 최종", rowsstyle(gf)) + "</div>")
    parts.append("<div class='col'><b>화풍 — 약한 라벨(PR 전/후; 병합이 버들항 수준을 보증하지 않는다)</b>" + mx("Argon", rowsweak(ga)) + mx("Sonnet 1바퀴", rowsweak(g1)) + mx("Sonnet 최종", rowsweak(gf)) + "</div></div>")

    if pf:
        parts.append(f"<p>최종 프로필 기록: 3/4 위반 {pf['bad']['caught']}/{pf['bad']['total']} 잡음, 정상 {pf['good']['passed']}/{pf['good']['total']} 통과"
                     + (f" · 화풍 얕음 {pf['style']['caught']}/{pf['style']['badTotal']} 잡음, 버들 수준 {pf['style']['passed']}/{pf['style']['goodTotal']} 통과" if pf.get("style") else "") + f" · 판정자 {html.escape(pf.get('judge',''))}</p>")

    def figs(labels, truth_ok, verdict_of, limit=40, scale=4):
        out = ["<div class='row'>"]
        for l in labels[:limit]:
            s, n = l.split("/", 1)
            p = CAL / s / f"{n}.png"
            if not p.exists():
                continue
            r = fin.get(l)
            reasons = "; ".join(r["view34"]["reasons"])[:150] if r else ""
            out.append(card(p, scale, n, verdict_of, reasons))
        out.append("</div>")
        return "".join(out)

    parts.append(f"<h2>최종 지시문에서 3/4 를 놓친 위반({len(miss_f)})</h2><p>게이트 PASS 인데 라벨은 위반.</p>" + figs(miss_f, False, "pass"))
    parts.append(f"<h2>최종 지시문에서 정상인데 막힌 것({len(ff_f)})</h2>" + figs(ff_f, True, "fail"))
    # 정정 표본 전/후
    pairs = []
    for n in ("scroll_shelf__A", "scroll_shelf__B", "medicine_cabinet__A", "medicine_cabinet__B", "gong_frame__A", "weapon_rack__A"):
        old, new = CAL / "murim-postfix-unlabeled" / f"{n}.png", CAL / "murim" / f"{n}.png"
        if old.exists() and new.exists():
            pairs.append(f"<div class='row'>{card(new, 6, n + ' · v2 위반(정정 표본)', fin.get('murim/' + n, {}).get('view34', {}).get('verdict'), '')}{card(old, 6, n + ' · 고친 뒤(이전 표본에 섞여 있던 것)', None, '')}</div>")
    parts.append("<h2>정정한 무림 표본(왼쪽 = 이제 쓰는 v2 위반 그림, 오른쪽 = 이전에 위반으로 잘못 쓰던 고친 뒤 그림)</h2>" + "".join(pairs))

    # 화풍 예시
    items = json.loads((CAL / "style" / "items.json").read_text())

    def ex(title, pick, limit):
        out = [f"<h3>{title}</h3><div class='row'>"]; k = 0
        for it in items:
            r = fin.get(f"style/{it['name']}")
            if not r or not pick(it, r):
                continue
            ev = ""
            for q in r["runs"]:
                if q.get("a") and q["a"].get("style") and q["a"]["style"].get("evidence"):
                    ev = q["a"]["style"]["evidence"]; break
            out.append(card(CAL / "style" / f"{it['name']}.png", 2, it["name"].replace("__", " · "), r["style"]["verdict"], f"{it['group']} · {ev[:170]}"))
            k += 1
            if k >= limit:
                break
        return "".join(out) + "</div>"

    parts.append("<h2>화풍 예시(2배)</h2>")
    parts.append(ex("얕음 라벨인데 PASS(놓침)", lambda it, r: it["style"] == "bad" and not it.get("weak") and r["style"]["verdict"] == "pass", 8))
    parts.append(ex("버들 수준 라벨인데 FAIL(오탐)", lambda it, r: it["style"] == "good" and not it.get("weak") and r["style"]["verdict"] == "fail", 8))
    parts.append(ex("합성 얕음 — FAIL 이어야 함", lambda it, r: it["group"] == "synthetic-shallow", 6))
    parts.append(ex("PR 병합 후 판인데 화풍 FAIL(남은 결함 후보)", lambda it, r: it["group"] == "quality-after" and r["style"]["verdict"] == "fail", 12))

    audits = sorted((REPO / "harness-data/object-gate/audit").glob(f"rereview-*-{a.final}.json")) if (REPO / "harness-data/object-gate/audit").exists() else []
    if audits:
        rep = json.loads(audits[-1].read_text())
        parts.append(f"<h2>테마 칩셋 재검수(현재 번들) — {'영수증 기록' if not rep.get('audit') else '보고서만(audit, 영수증 안 씀)'}</h2><table><tr><th>테마</th><th>조각</th><th>통과</th><th>3/4 통과</th><th>화풍 통과</th></tr>" + "".join(
            f"<tr><th>{t}</th><td>{v['total']}</td><td>{v['pass']}</td><td>{v['view34Pass']}</td><td>{v['stylePass']}</td></tr>" for t, v in rep["report"].items()) + "</table>")
    Path(a.out).parent.mkdir(parents=True, exist_ok=True)
    Path(a.out).write_text("\n".join(parts))
    print(a.out, Path(a.out).stat().st_size // 1024, "KB")


if __name__ == "__main__":
    main()
