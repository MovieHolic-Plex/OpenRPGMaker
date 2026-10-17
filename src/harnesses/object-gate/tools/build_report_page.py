"""object-gate 보정·재검수 결과를 자체완결 HTML 한 장으로 만든다(~/claude-viz/gate-argon.html).

    python3 src/harnesses/object-gate/tools/build_report_page.py <프로필 해시> [--out ~/claude-viz/gate-argon.html]

읽는 것: calibration/run-<해시>.json, calibration/{style,interior,murim}, style-refs, view34-guide.png, audit/rereview-*.json(있으면).
그림은 data URI 로 박는다. 외부 참조 없음.
"""
import base64
import collections
import html
import io
import json
import sys
from pathlib import Path

from PIL import Image

REPO = Path(__file__).resolve().parents[4]
CAL = REPO / "harness-data" / "object-gate" / "calibration"


def data_uri(img: Image.Image, scale: int = 1) -> str:
    if scale != 1:
        img = img.resize((img.width * scale, img.height * scale), Image.NEAREST)
    buf = io.BytesIO()
    img.save(buf, "PNG")
    return "data:image/png;base64," + base64.b64encode(buf.getvalue()).decode()


def card(img_path: Path, scale: int, caption: str, verdict: str | None = None, note: str = "") -> str:
    img = Image.open(img_path).convert("RGBA")
    cls = {"pass": "ok", "fail": "no"}.get(verdict or "", "")
    return (f'<figure class="{cls}"><img src="{data_uri(img, scale)}" width="{img.width * scale}" height="{img.height * scale}" alt="">'
            f'<figcaption><b>{html.escape(caption)}</b>{(" · " + html.escape(verdict.upper())) if verdict else ""}<br><small>{html.escape(note)}</small></figcaption></figure>')


def matrix(title: str, rows: list[tuple[str, int, int]], extra: str = "") -> str:
    """rows = (라벨, 게이트 불합격 수, 게이트 통과 수)"""
    body = "".join(f"<tr><th>{html.escape(l)}</th><td>{f}</td><td>{p}</td></tr>" for l, f, p in rows)
    return f'<div class="mx"><h3>{html.escape(title)}</h3><table><tr><th>실제 라벨</th><th>게이트 FAIL</th><th>게이트 PASS</th></tr>{body}</table>{extra}</div>'


def main() -> None:
    args = sys.argv[1:]
    profile = args[0]
    out = Path(args[args.index("--out") + 1]) if "--out" in args else Path.home() / "claude-viz" / "gate-argon.html"
    run = {x["label"]: x for x in json.loads((CAL / f"run-{profile}.json").read_text())}
    rec = json.loads((REPO / "harness-data/object-gate/profiles" / f"{profile}.json").read_text()) if (REPO / "harness-data/object-gate/profiles" / f"{profile}.json").exists() else None
    items = json.loads((CAL / "style" / "items.json").read_text())
    refs = json.loads((REPO / "harness-data/object-gate/style-refs/manifest.json").read_text())

    # --- 3/4
    v34 = collections.Counter()
    miss, falsefail = [], []
    for setname in ("interior", "murim"):
        lab = json.loads((CAL / setname / "labels.json").read_text())
        for truth in ("bad", "good"):
            for n in lab[truth]:
                r = run.get(f"{setname}/{n}")
                if not r:
                    continue
                v = r["view34"]["verdict"]
                v34[(truth, v)] += 1
                if truth == "bad" and v == "pass":
                    miss.append((setname, n, r))
                if truth == "good" and v == "fail":
                    falsefail.append((setname, n, r))
    m34 = matrix("3/4 시점 — 위반 표본 vs 정상 표본", [("위반(bad)", v34[("bad", "fail")], v34[("bad", "pass")]), ("정상(good)", v34[("good", "fail")], v34[("good", "pass")])])

    # --- 화풍
    st = collections.Counter()
    for it in items:
        r = run.get(f"style/{it['name']}")
        if not r:
            continue
        key = (it["group"], it["style"], r["style"]["verdict"])
        st[key] += 1
    strong = [("farm-user", "bad"), ("synthetic-shallow", "bad"), ("farm-user", "good"), ("beodeul-heldout", "good")]
    rows = []
    for g, truth in strong:
        sub = [x for x in items if x["group"] == g and x["style"] == truth and not x.get("weak") and f"style/{x['name']}" in run]
        f = sum(1 for x in sub if run[f"style/{x['name']}"]["style"]["verdict"] == "fail")
        rows.append((f"{g} ({'얕음' if truth == 'bad' else '버들 수준'})", f, len(sub) - f))
    mst = matrix("화풍 — 강한 라벨(사용자 판정·통제 표본·버들항 홀드아웃)", rows)
    weak_rows = []
    for label, grp, truth in (("고치기 전(PR 부모 커밋)", "quality-before", "bad"), ("병합 후", "quality-after", "good")):
        sub = [x for x in items if x["group"] == grp and f"style/{x['name']}" in run]
        f = sum(1 for x in sub if run[f"style/{x['name']}"]["style"]["verdict"] == "fail")
        weak_rows.append((label, f, len(sub) - f))
    mweak = matrix("화풍 — 약한 라벨(PR #2544~#2558 전/후, 병합했다고 버들항 수준은 아니다)", weak_rows)

    css = """body{font:14px/1.5 system-ui,sans-serif;background:#16181d;color:#e6e6ea;margin:0;padding:24px;max-width:1400px}
h1{font-size:22px}h2{margin-top:36px;border-bottom:1px solid #333;padding-bottom:6px}h3{font-size:15px;margin:0 0 6px}
.mx{display:inline-block;vertical-align:top;margin:0 24px 16px 0;background:#1e2128;padding:12px 16px;border-radius:8px}
table{border-collapse:collapse}th,td{border:1px solid #333;padding:5px 12px;text-align:right}th{text-align:left;font-weight:500}
.row{display:flex;flex-wrap:wrap;gap:14px;align-items:flex-end}
figure{margin:0;background:#242832;padding:8px;border-radius:6px;border:2px solid #333}figure.ok{border-color:#3a9d5d}figure.no{border-color:#c2453f}
figure img{image-rendering:pixelated;display:block;background:#464a56}figcaption{font-size:12px;margin-top:6px;max-width:360px}small{color:#9aa}
.pair{display:flex;gap:10px;background:#1e2128;padding:10px;border-radius:8px}.badge{padding:2px 8px;border-radius:10px;font-size:12px}
.b-no{background:#7a2b27}.b-ok{background:#235c3a}.b-warn{background:#6b5a1f}code{background:#2a2e38;padding:1px 5px;border-radius:4px}"""
    status = "calibrated" if rec and rec["status"] == "calibrated" else ("rejected" if rec else "미기록")
    parts = [f"<!doctype html><meta charset=utf-8><title>object-gate · gemini-4-argon 3/4 + 화풍</title><style>{css}</style>",
             "<h1>object-gate — 한 번 판정으로 3/4 + 버들항 화풍 (판정자 gemini-4-argon, effort medium 가정)</h1>",
             f'<p>프로필 <code>{profile}</code> · 상태 <span class="badge {"b-ok" if status == "calibrated" else "b-no"}">{status}</span> · 규칙 v4 · 판정 4번 중앙값/동률 불합격</p>',
             "<h2>보정 혼동표</h2>", m34, mst, mweak]
    if miss:
        parts.append("<h3>놓친 3/4 위반(게이트 PASS 인데 실제로는 위반)</h3><div class='row'>" + "".join(
            card(CAL / s / f"{n}.png", 4, n, "pass", "; ".join(r["view34"]["reasons"]) or "통과") for s, n, r in miss) + "</div>")
    if falsefail:
        parts.append("<h3>정상인데 막힌 것(3/4 오탐)</h3><div class='row'>" + "".join(
            card(CAL / s / f"{n}.png", 4, n, "fail", "; ".join(r["view34"]["reasons"])) for s, n, r in falsefail) + "</div>")

    # --- 화풍 예시: 버들항 기준 + FAIL/PASS 나란히 2배
    parts.append("<h2>화풍 예시(2배, 버들항 기준 그림 옆)</h2><h3>버들항 기준 그림(판정자가 같은 종류끼리 비교하는 것)</h3><div class='row'>")
    for kind, ents in refs.items():
        for name in ents:
            parts.append(card(REPO / "harness-data/object-gate/style-refs" / kind / f"{name}.png", 2, f"{kind}/{name}"))
    parts.append("</div>")

    def examples(title, pick, limit):
        out = [f"<h3>{title}</h3><div class='row'>"]
        n = 0
        for it in items:
            r = run.get(f"style/{it['name']}")
            if not r or not pick(it, r):
                continue
            ev = ""
            for q in r["runs"]:
                if q.get("a") and q["a"].get("style") and q["a"]["style"].get("evidence"):
                    ev = q["a"]["style"]["evidence"]
                    break
            out.append(card(CAL / "style" / f"{it['name']}.png", 2, it["name"].replace("__", " · "), r["style"]["verdict"], f"{it['group']} · {ev[:150]}"))
            n += 1
            if n >= limit:
                break
        out.append("</div>")
        return "".join(out)

    parts.append(examples("농장 2판(사용자 반려, 얕음) — 게이트 FAIL 이어야 함", lambda it, r: it["group"] == "farm-user" and it["style"] == "bad", 5))
    parts.append(examples("농장 3판(사용자 수락) — 게이트 PASS 이어야 함", lambda it, r: it["group"] == "farm-user" and it["style"] == "good", 5))
    parts.append(examples("통제 표본(버들항을 4색·근흑 윤곽으로 얕게 만듦) — FAIL", lambda it, r: it["group"] == "synthetic-shallow", 6))
    parts.append(examples("버들항 홀드아웃 — PASS", lambda it, r: it["group"] == "beodeul-heldout" and r["style"]["verdict"] == "pass", 6))
    parts.append(examples("PR 병합 후 판인데도 화풍 FAIL(남은 결함 후보)", lambda it, r: it["group"] == "quality-after" and r["style"]["verdict"] == "fail", 12))
    parts.append(examples("PR 병합 후 판이 화풍 PASS", lambda it, r: it["group"] == "quality-after" and r["style"]["verdict"] == "pass", 8))

    parts.append("<h2>3/4 안내 그림(판정자 3번째 이미지)</h2>" + card(REPO / "harness-data/object-gate/view34-guide.png", 1, "view34-guide.png"))

    audits = sorted((REPO / "harness-data/object-gate/audit").glob(f"rereview-*-{profile}.json")) if (REPO / "harness-data/object-gate/audit").exists() else []
    if audits:
        rep = json.loads(audits[-1].read_text())["report"]
        parts.append("<h2>테마 칩셋 재검수(현재 번들)</h2><table><tr><th>테마</th><th>조각</th><th>통과</th><th>3/4 통과</th><th>화풍 통과</th></tr>" + "".join(
            f"<tr><th>{t}</th><td>{v['total']}</td><td>{v['pass']}</td><td>{v['view34Pass']}</td><td>{v['stylePass']}</td></tr>" for t, v in rep.items()) + "</table>")
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text("\n".join(parts))
    print(out, out.stat().st_size // 1024, "KB")


if __name__ == "__main__":
    main()
