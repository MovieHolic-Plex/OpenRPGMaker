#!/usr/bin/env python3
"""장르 웨이브 진행 보고서(HTML, 이미지 내장) — ~/claude-viz/beodeul-genre-report.html 로 쓴다. 다시 돌리면 덮어쓴다.
   python3 scripts/content/beodeul-picks/report.py "<이번 보고의 한 줄 요약>" """
import base64, io, json, subprocess, sys, time
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[3]
VAR = ROOT / "tiledata/beodeul-variants"
OUT = Path.home() / "claude-viz/beodeul-genre-report.html"
LAYOUT_SLUGS = None  # tiledata/beodeul-variants/*/layouts/preview.png 가 있는 장소 전부
GENRES = {
    "steampunk 스팀펑크": ["steam-city", "clockwork-tower", "airship-dock"],
    "wuxia 동양 무협": ["wuxia-sect-mountain", "bamboo-valley", "lantern-river-town"],
    "gothic 고딕 호러": ["gothic-village", "haunted-manor", "bleak-moor"],
}
FIXES = [("ice-age-field", "얼음 호수 가장자리"), ("desert-castle", "오아시스 풀 덩이 둘레"), ("sky-city", "구름 바탕 격자 반복")]

def uri(path, w=980, q=80):
    if not Path(path).exists():
        return None
    im = Image.open(path).convert("RGB")
    im.thumbnail((w, w))
    b = io.BytesIO(); im.save(b, "JPEG", quality=q)
    return "data:image/jpeg;base64," + base64.b64encode(b.getvalue()).decode()

def img(path, cap, w=980):
    u = uri(path, w)
    return f'<figure><img src="{u}"><figcaption>{cap}</figcaption></figure>' if u else f'<div class="ph">{cap} — 아직 없음</div>'

def git(*a):
    return subprocess.run(["git", *a], cwd=ROOT, capture_output=True, text=True).stdout.strip()

def place_block(slug):
    d = VAR / slug
    n_parts = len(list((d / "parts").glob("*.png"))) if (d / "parts").exists() else 0
    n_auto = len(list((d / "parts").glob("autotile-*.png"))) if (d / "parts").exists() else 0
    log = git("log", "--format=%h %s", "-1", "--", f"tiledata/beodeul-variants/{slug}")
    state = "작업 중" if n_parts else "시작 전"
    if (d / "battle-bg.png").exists() and (d / "compare-ref.png").exists() and (d / "check-overlay.png").exists():
        state = "산출물 갖춤(검수 대기)"
    h = f'<section class="place"><h3>{slug} <span class="tag">{state}</span> <small>조각 {n_parts} · 오토타일 {n_auto}</small></h3><div class="small">{log or "커밋 없음"}</div><div class="grid">'
    h += img(d / "render-1x.png", "데모 맵") + img(d / "battle-bg.png", "전투 배경 640×360", 640)
    h += img(d / "check-autotile.png", "오토타일 이음 시험", 640) + img(d / "compare-ref.png", "버들항 기준 비교", 760)
    return h + "</div></section>"

def main():
    summary = sys.argv[1] if len(sys.argv) > 1 else ""
    h = ["""<meta charset=utf-8><title>버들항 장르 웨이브 보고</title><style>
body{background:#14161c;color:#e8e8ee;font:14px/1.5 -apple-system,sans-serif;max-width:1180px;margin:auto;padding:16px}
h1,h2{margin:.6em 0 .2em}h3{margin:.8em 0 .1em}.small,small{color:#9aa}figure{margin:6px 0}figcaption{color:#9aa;font-size:12px}
img{max-width:100%;image-rendering:pixelated;border:1px solid #333}.grid{display:grid;grid-template-columns:1fr 1fr;gap:8px}
.tag{background:#2b3a55;border-radius:4px;padding:1px 7px;font-size:12px;margin-left:6px}.ph{background:#1c1f27;border:1px dashed #444;padding:30px;text-align:center;color:#777}
table{border-collapse:collapse}td,th{border:1px solid #333;padding:4px 10px}.ok{color:#7fd48a}.sum{background:#1d2431;padding:10px 14px;border-left:3px solid #5b8cff}
</style><body>"""]
    h.append(f"<h1>버들항 장르 웨이브 — 진행 보고</h1><div class=small>{time.strftime('%Y-%m-%d %H:%M')} · 브랜치 agent/beodeul-continue</div>")
    if summary:
        h.append(f'<div class="sum">{summary}</div>')
    h.append("""<h2>지금 하는 일</h2><table><tr><th>축</th><th>내용</th><th>상태</th></tr>
<tr><td>팩 전용 파이프라인</td><td>packOnly 장소는 공용 시트에 굽지 않고 따로 굽는다 (<code>bake_pack_only.sh</code>)</td><td class=ok>완료·시험 통과</td></tr>
<tr><td>로딩 측정</td><td>타일셋 JSON 파싱 58ms→99ms, gzip 189KB→534KB (공용 시트 동결로 더 불리지 않는다)</td><td class=ok>측정</td></tr>
<tr><td>장르 3개 × 장소 3곳</td><td>스팀펑크·동양 무협·고딕 호러, 에이전트 9명(장소당 1명)</td><td>작업 중</td></tr>
<tr><td>약점 수정</td><td>오토타일 네모 가장자리·구름 바탕 격자 반복, 전수 감사 스크립트(품질 게이트)</td><td>작업 중</td></tr></table>""")
    for g, slugs in GENRES.items():
        h.append(f"<h2>{g}</h2>" + "".join(place_block(s) for s in slugs))
    h.append("<h2>독립 적대 검수 결과 (tiledata/beodeul-kits/qa/)</h2><table><tr><th>장소</th><th>총평</th><th>상위 사유 1</th><th>증거</th></tr>")
    import re
    for f in sorted((ROOT / "tiledata/beodeul-kits/qa").glob("*.md")):
        t = f.read_text(encoding="utf-8")
        m = re.search(r"총평[:：]?\s*\**\s*(PASS|조건부|반려)", t)
        verdict = m.group(1) if m else "?"
        r1 = re.search(r"^1\.\s*(.+)$", t, re.M)
        ev = sorted(f.parent.glob(f.stem + "-*.png"))[:1]
        im = f'<img style="width:260px" src="{uri(ev[0], 420)}">' if ev else ""
        col = {"PASS": "#7fd48a", "조건부": "#e0b050", "반려": "#e06060"}.get(verdict, "#aaa")
        h.append(f'<tr><td>{f.stem}</td><td style="color:{col}"><b>{verdict}</b></td><td>{(r1.group(1)[:140] if r1 else "")}</td><td>{im}</td></tr>')
    h.append("</table><div class=small>PASS 0건 — 만든 쪽 「통과」 보고 중 독립 검수가 동의한 곳이 아직 없다. 반려·조건부는 만든 에이전트에게 돌려보내 재작업 중.</div>")
    h.append("<h2>조수가 팩을 받아 깔 때 — 완성 배치도 효과</h2><div class=grid>")
    for f, c in [("dc3.png", "전: 안내서만 — 즉흥 배치 (호출 97회)"), ("dc4-keep.png", "후: 팩에 완성 배치도 키트 — 조수가 첫 호출에 찍고 꾸밈만 추가 (65회)")]:
        h.append(img(Path("/tmp/asst-bd") / f, c, 760))
    h.append("</div><div class=small>배치도 저작: 에이전트 6명이 기존 팩 30곳을 맡는 중 (tiledata/beodeul-variants/&lt;slug&gt;/layouts/preview.png)</div>")
    for slug in ["desert-castle"] + [s for s in []]:
        pass
    prev = sorted(VAR.glob("*/layouts/preview.png"))
    if prev:
        h.append(f"<h2>완성 배치도 미리보기 ({len(prev)}곳)</h2><div class=grid>")
        for pth in prev:
            h.append(img(pth, pth.parent.parent.name, 560))
        h.append("</div>")
    qa = sorted((ROOT / "tiledata/beodeul-kits/qa").glob("*.md"))
    if qa:
        h.append("<h2>적대적 검수 결과</h2><ul>")
        for q in qa:
            first = [l for l in q.read_text(encoding="utf-8").splitlines() if l.strip()][:3]
            h.append(f"<li><b>{q.stem}</b> — {' / '.join(x.lstrip('# ').strip() for x in first)[:260]}</li>")
        h.append("</ul>")
    h.append("<h2>약점 수정</h2>")
    for slug, what in FIXES:
        d = VAR / slug
        h.append(f"<h3>{slug} — {what}</h3><div class=grid>" + img(d / "compare-ref.png", "전/후 비교", 760) + img(d / "check-autotile.png" if (d / "check-autotile.png").exists() else d / "check-tiling.png", "이음 시험", 640) + "</div>")
    h.append("<h2>팩만 받은 조수 시험 (직전 결과)</h2><div class=grid>")
    for f, c in [("dc-pack.png", "① 사막 성 첫 시험: 빈 바탕·사각 호수"), ("dc3.png", "③ 안내서 수정 후: 둥근 연못·풀 덩이"), ("ia2.png", "빙하기 설원 (팩만)"), ("sc3.png", "하늘 도시 (팩만)")]:
        h.append(img(Path("/tmp/asst-bd") / f, c, 760))
    h.append("</div>")
    OUT.write_text("".join(h), encoding="utf-8")
    print(OUT, OUT.stat().st_size // 1024, "KB")

main()
