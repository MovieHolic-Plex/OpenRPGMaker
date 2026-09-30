"""3/4 시점 계약 비교 페이지 생성기 → ~/claude-viz/view34-contract.html (자체완결, data URI).
사용: python3 view34_page.py   (먼저 view34_proof.py, view34_check.py --audit 를 돌려 둔다)"""
import base64, io, json, html
from collections import Counter
from pathlib import Path
from PIL import Image
import view34_check as vc
from common import BASE as _B
BASE = Path(_B)

DEMO = BASE / "style-demo-view34"
OUTP = Path.home() / "claude-viz" / "view34-contract.html"

def uri(p):
    p = Path(p)
    return "data:image/png;base64," + base64.b64encode(p.read_bytes()).decode()

def img(p, scale=1, cls=""):
    im = Image.open(p)
    return f'<img class="px {cls}" src="{uri(p)}" width="{im.width*scale}" height="{im.height*scale}" alt="">'

def meas(p, cat):
    r = vc.check_file(Path(p), Path(p).parent.name, cat=cat)
    return r

def badge(v):
    return f'<span class="b {v}">{v}</span>'

# 조각 비교: (이름, 옛 그림, 옛 분류, 새 그림, 새 분류, 스케일)
old_jp = BASE / "candidates-jp"
PAIRS = [
    ("3층 가게 (건물)", DEMO / "old-shop3f.png", "building", DEMO / "shop3f.png", "building", 2),
    ("편의점 (건물)", DEMO / "old-conbini.png", "building", DEMO / "conbini.png", "building", 2),
    ("자판기 2×2", DEMO / "old-vending2x2.png", "prop_box", DEMO / "vending2x2.png", "prop_box", 4),
    ("택시 가로 (옛 → 오른쪽 향 새)", DEMO / "old-taxi.png", "vehicle", DEMO / "taxi-h.png", "vehicle", 3),
]
rows = []
for name, o, oc, n, nc, sc in PAIRS:
    mo, mn = meas(o, oc), meas(n, nc)
    rows.append(f'<tr><td class="nm">{name}</td><td>{img(o, sc)}<div class="m">T {mo["T"]} / F {mo["F"]} = {mo["ratio"]}<br>{badge(mo["verdict"])}</div></td>'
                f'<td>{img(n, sc)}<div class="m">T {mn["T"]} / F {mn["F"]} = {mn["ratio"]}<br>{badge(mn["verdict"])}</div></td></tr>')
piece_tbl = "\n".join(rows)
extra = []
for n, note in (("tree.png", "가로수 — 수관이 둥근 덩어리, 윗면 판정 대상 아님(EXEMPT, 눈으로)"),
                ("signal.png", "신호등 — 머리에 윗면 3px. 가는 기둥이라 검사기는 「thin(눈 판정)」으로만 분류, prop 으로 재면 TOPDOWN 오탐"),
                ("ground.png", "바닥 — 보도·연석·차도. 위에서 본 1:1")):
    extra.append(f'<div class="ex">{img(DEMO / n, 4)}<div class="m">{html.escape(note)}</div></div>')

audit = json.load(open(BASE / "view34-audit.json", encoding="utf-8"))
ORDER = ["OK", "FRONT", "NOTOP", "TOPDOWN", "EXEMPT"]
def cnt_table(rows_, key):
    ks = sorted({key(r) for r in rows_})
    h = "<tr><th></th>" + "".join(f"<th>{k}</th>" for k in ORDER) + "<th>합계</th></tr>"
    body = ""
    for k in ks:
        c = Counter(r["verdict"] for r in rows_ if key(r) == k)
        body += f"<tr><td class='nm'>{k}</td>" + "".join(f"<td>{c.get(v,0) or ''}</td>" for v in ORDER) + f"<td>{sum(c.values())}</td></tr>"
    return f"<table class='t'>{h}{body}</table>"
tbl_set = cnt_table(audit, lambda r: {"jp": "일본", "modern": "강남", "school": "학원"}[r["set"]])
tbl_jp = cnt_table([r for r in audit if r["set"] == "jp"], lambda r: r["cat"] + (" (조립 예)" if r["assembled"] else ""))
redraw = [r for r in audit if r["verdict"] in ("FRONT", "NOTOP")]
redraw_n = Counter(r["set"] for r in redraw)

def hero_row():
    return ""

# 택시 두 방향
taxi_cells = []
for lab, f, cat in (("옛(가로)", "old-taxi.png", "vehicle"), ("새 가로 → 오른쪽", "taxi-h.png", "vehicle"),
                    ("새 가로 ← 왼쪽", "taxi-h-left.png", "vehicle"),
                    ("새 세로 ↓ 앞", "taxi-v-front.png", "vehicle"), ("새 세로 ↑ 뒤", "taxi-v-back.png", "vehicle")):
    m = meas(DEMO / f, cat)
    taxi_cells.append(f'<div class="ex">{img(DEMO / f, 4)}<div class="lab">{lab}</div><div class="m">T {m["T"]} / F {m["F"]} = {m["ratio"]}<br>{badge(m["verdict"])}</div></div>')
taxi_html = "".join(taxi_cells)

# 실내 옛/새
import interior_view34_audit as iva
ipairs = [("옷장 16×32", "wardrobe", "wall"), ("책장 16×48", "bookshelf", "wall"), ("벽난로 32×32", "fireplace", "wall"), ("사물함(강철) 16×32", "locker", "wall")]
irows = []
for nm, key, _ in ipairs:
    o = DEMO / f"interior-old-{key}.png"; n = DEMO / f"interior-new-{key}.png"
    def cell(pth):
        if not pth.exists(): return '<div class="m">(옛 조각 없음 — 새로 만든 견본)</div>'
        import numpy as np
        m = iva.measure_wall_tall(np.array(Image.open(pth).convert("RGBA")))
        t, f = m["t"], m["f"]; v = iva.classify_wall_tall(m)
        vv = {"ok": "OK", "front": "FRONT", "rim": "NOTOP", "topdown": "TOPDOWN"}.get(v, v)
        return f'{img(pth, 6)}<div class="m">T {t} / F {f}<br>{badge(vv)}</div>'
    irows.append(f'<tr><td class="nm">{nm}</td><td>{cell(o)}</td><td>{cell(n)}</td></tr>')
interior_tbl = "\n".join(irows)

# 배치 요약
rw = json.load(open(BASE / "view34-rework.json", encoding="utf-8"))
SETN = {"jp": "일본", "modern": "강남", "school": "학원", "horror": "호러", "interior": "실내 v5"}
brows = "".join(f'<tr><td class="nm">{b["id"]}</td><td>{SETN.get(b["set"], b["set"])}</td><td>{b["picker"]}</td><td>{b["count"]}</td><td>{b["weight"]}</td>'
                f'<td class="nm">{b["worker"]}</td></tr>' for b in rw["batches"])
sm = rw["summary"]
ex_reason = {"exempt": "검사기 면제 분류 — 눈 검수", "deferred-no-folder": "v5 후보 폴더 없음", "interior-ok": "이미 통과한 호러 변형", "other-agent": "월드맵(다른 에이전트)"}
exrows = "".join(f'<tr><td class="nm">{k}</td><td>{v}</td><td class="nm">{ex_reason.get(k, "")}</td></tr>' for k, v in sm["exclusionReasons"].items())

HTML = f'''<!doctype html><html lang="ko"><head><meta charset="utf-8"><title>3/4 시점 계약 — 옛 정면 도면 vs 새 그림</title>
<style>
body{{background:#15171c;color:#dfe3ea;font:14px/1.55 -apple-system,"Noto Sans KR",sans-serif;margin:0;padding:24px 32px 64px;max-width:1120px}}
h1{{font-size:22px;margin:0 0 4px}} h2{{font-size:17px;margin:36px 0 8px;border-bottom:1px solid #2c313b;padding-bottom:4px}}
.sub{{color:#9aa3b2;margin:0 0 12px}} .px{{image-rendering:pixelated;display:block;background:#0c0d10}}
.pair{{display:flex;gap:20px;flex-wrap:wrap;align-items:flex-start}} .pair>div{{flex:0 0 auto}}
.lab{{font-weight:600;margin:0 0 4px}} .old .lab{{color:#f08a8a}} .new .lab{{color:#8fd9a0}}
table{{border-collapse:collapse}} td,th{{padding:6px 10px;border:1px solid #2c313b;vertical-align:top;text-align:left}}
.t td,.t th{{text-align:center}} .t td.nm,td.nm{{text-align:left;white-space:nowrap}} th{{background:#1d2027}}
.m{{font-size:12px;color:#9aa3b2;margin-top:4px}} .ex{{display:inline-block;margin:0 24px 12px 0;vertical-align:top;max-width:320px}}
.b{{padding:1px 6px;border-radius:3px;font-size:11px;font-weight:700;color:#111}}
.OK{{background:#7fd68f}} .FRONT{{background:#f08a8a}} .NOTOP{{background:#f0b36a}} .TOPDOWN{{background:#a9b8f0}} .EXEMPT{{background:#8b93a1}}
.note{{background:#1d2027;border-left:3px solid #4a90d9;padding:8px 12px;margin:10px 0;font-size:13px}}
.key{{display:flex;gap:10px;flex-wrap:wrap;margin:8px 0}} .key div{{background:#1d2027;padding:6px 12px;border-radius:4px}} .key b{{color:#ffd76a}}
svg text{{font:12px sans-serif;fill:#dfe3ea}}
</style></head><body>
<h1>3/4 시점 계약 — 옛 정면 도면 vs 계약대로 다시 그린 것</h1>
<p class="sub">사용자 판정 「일본 칩셋이 3/4 view 라고 하나, 전혀 안 지켜졌다」에 대한 답. 왼쪽 옛 / 오른쪽 새. 같은 구도·같은 바닥·같은 팔레트(modern3).</p>

<h2>1. 계약 한 장</h2>
<div class="key">
<div>바닥 = 칸당 <b>1:1 위에서 본 판</b></div>
<div>윗면 두께 T = 밑면 깊이 D × <b>16px</b> (건물)</div>
<div>앞면 F = 층수 × <b>32px</b></div>
<div>건물 T/F <b>0.10~1.10</b> (T≥14)</div>
<div>자판기류 <b>0.22~0.60</b> · 차 <b>0.28~0.95</b></div>
</div>
<svg width="1000" height="290" viewBox="0 0 1000 290" style="max-width:100%">
 <rect x="20" y="20" width="300" height="64" fill="#8e97a6" stroke="#dfe3ea"/><text x="30" y="56">윗면(지붕판) T = D×16 = 32px</text>
 <rect x="20" y="84" width="300" height="128" fill="#4c6a8a" stroke="#dfe3ea"/><text x="30" y="150">앞면 F = 3층×32 + 가게 = 112px</text>
 <line x1="20" y1="212" x2="320" y2="212" stroke="#ffd76a" stroke-width="2"/><text x="20" y="232">밑변(앞면 맨 아래) — 여기서 위로 D칸이 「막힘」</text>
 <rect x="20" y="180" width="300" height="32" fill="none" stroke="#f06a6a" stroke-dasharray="4 3"/>
 <text x="345" y="52">1. 지붕판은 깊이 D칸 만큼 <tspan fill="#ffd76a">넓게</tspan> 보인다 (얇은 띠 금지)</text>
 <text x="345" y="72">2. 옥상 실외기·물탱크는 윗면 위에 앉고 앞으로 그림자</text>
 <text x="345" y="120">3. 옆면은 안 그린다 (정면 고정, 왼쪽 위 빛)</text>
 <text x="345" y="150">4. 층수는 앞면으로만 센다</text>
 <text x="345" y="196" fill="#f06a6a">붉은 점선 = 막힘(밑면 D×16)</text>
 <text x="345" y="216">파랑(위쪽 전부) = 뒤로 걸으면 가려지는 칸(walk-behind)</text>
 <text x="20" y="270">금지: 정면 도면 · 앞면에 붙은 1~3px 지붕 띠 · 윗면 없는 상자 · T/F &gt; 1.1(위에서 본 판)</text>
</svg>

<h2>2. 같은 장면, 옛 vs 새 (20×15칸)</h2>
<p class="sub">볼 것: ① 지붕이 「띠」인가 「판」인가 ② 자판기·택시에 윗면이 있는가 ③ 주인공이 편의점 <b>왼쪽 모서리 뒤</b>에 서면 몸 반이 지붕·앞면에 가려지는가.</p>
<h3 class="lab" style="color:#f08a8a">옛 (정면 도면 + 지붕 띠)</h3>{img(DEMO/"scene-old.png",3)}
<h3 class="lab" style="color:#8fd9a0;margin-top:16px">새 (3/4 계약)</h3>{img(DEMO/"scene-new.png",3)}
<p class="sub" style="margin-top:8px">1× 원본 크기(게임에서 보이는 크기):</p>
<div class="pair"><div class="old"><div class="lab">옛</div>{img(DEMO/"scene-old.png",1)}</div><div class="new"><div class="lab">새</div>{img(DEMO/"scene-new.png",1)}</div></div>

<h2>3. 막힘·가림 진단 (새 장면)</h2>
<p class="sub">빨강 = 막힌 칸(밑면 D×16, 걸을 수 없음). 파랑 = 그 위, 뒤로 돌아 걸으면 가려지는 칸. 지붕 윗면이 곧 파랑 — 밟는 곳이 아니라 <b>가리는 곳</b>.</p>
{img(DEMO/"scene-new-overlay.png",3)}

<h2>4. 조각별 검사기 수치</h2>
<table><tr><th>조각</th><th>옛</th><th>새</th></tr>{piece_tbl}</table>
<div style="margin-top:14px">{"".join(extra)}</div>

<h2>4-b. 택시 두 방향</h2>
<p class="sub">가로 진행은 옆면 + 지붕 윗선 계단(보닛·트렁크보다 지붕이 솟음), 세로 진행은 앞/뒤면 + 긴 지붕 윗면. 같은 검사기가 방향을 읽어 각각의 범위로 잰다.</p>
<div>{taxi_html}</div>

<h2>4-c. 건물 앞면 깊이 (수치는 계약 §10-2b, 눈으로 확인)</h2>
<div class="note">「벽이 평평해서 공간감이 없다」 → 앞면을 한 장 벽지로 칠하지 않는다. 층 슬래브 = 윗면 3 + 앞면 2(+가장자리 1) + 그림자 3(합 9행) · 창 = 들어가 있음(위 안쪽 그림자 1, 문턱 윗면 2·앞 1·아래 그림자 2) · 필라스터 폭 4 + 오른쪽 어둠 1 · 발코니 윗면 4 + 난간 2 + 그림자 3 · 1층 출입구 8px 물러섬 · 간판판 윗면 2 + 앞 12 + 그림자 3 · 차양 윗 7 + 앞 3 + 벽 그림자 2.</div>
<div class="pair"><div class="old"><div class="lab">옛 (벽지 한 장)</div>{img(DEMO/"old-shop3f.png",3)}</div><div class="new"><div class="lab">새 (슬래브·창턱·발코니·차양)</div>{img(DEMO/"shop3f.png",3)}</div><div class="old"><div class="lab">옛 편의점</div>{img(DEMO/"old-conbini.png",3)}</div><div class="new"><div class="lab">새 편의점</div>{img(DEMO/"conbini.png",3)}</div></div>

<h2>4-d. 실내 3/4 — 벽 붙은 키 큰 가구 (계약 §11)</h2>
<div class="note">T(윗면) 4~6px + 앞 가장자리 하이라이트 1행 + 처마 그림자 2px, 앞면은 들어간다. 옛 그림은 T=1~2 의 정면 도면. 게이트: <code>interior_view34_audit.py --wall-tall</code> — t≤2 front · t=3 rim · t&gt;8 또는 앞면&lt;15 topdown.
<br>기타 가구: 탁자·침대·카운터 T 8~14 + 다리 8~14 · 의자 좌판 T 4~6 + 다리 6~8 · 상자·통 T 4~8 + F 8~16.</div>
<table><tr><th>조각</th><th>옛</th><th>새</th></tr>{interior_tbl}</table>

<h2>4-e. 재작도 배치 (다음 단계 작업자용)</h2>
<div class="note">총 <b>{sm["batches"]}</b> 배치 · <b>{sm["items"]}</b> 개 (사용자가 고른 것 <b>{sm["chosenItems"]}</b>). 목록 <code>view34-rework.json</code>, 절차서 <code>WORKER-VIEW34.md</code>. 25개 미만 배치는 세트 안에서만 묶고 킷(1벌=4개 분량)을 가중으로 셌기 때문 — 일본 킷 8벌 = 가중 32, 현대는 대상 자체가 15개, 호러 36개는 18+18.</div>
<table><tr><th>배치</th><th>세트</th><th>피커</th><th>개수</th><th>가중</th><th>작업자</th></tr>{brows}</table>
<p class="sub" style="margin-top:12px">목록에서 뺀 것</p>
<table><tr><th>사유</th><th>개수</th><th>설명</th></tr>{exrows}</table>

<h2>5. 전수 검사 결과 (재작업 대상 목록: <code>tiledata/atlas-pick/view34-audit.json</code>)</h2>
<div class="note">FRONT/NOTOP = 재작업 후보 <b>{len(redraw)}</b>건 (일본 {redraw_n["jp"]} · 강남 {redraw_n["modern"]} · 학원 {redraw_n["school"]}). TOPDOWN/EXEMPT 는 눈으로 확인할 것.</div>
{tbl_set}
<p class="sub" style="margin-top:14px">일본 분류별</p>
{tbl_jp}

<h2>6. 정직한 한계</h2>
<ul>
<li>검사기는 행별 밝기 띠로 「가장 두꺼운 평탄 지붕 본체」를 재는 <b>어림 도구</b>다. <b>OK 는 합격이 아니다</b> — 눈 확인이 최종.</li>
<li>지붕 위 잡동사니가 폭의 절반을 넘으면 오판. 가는 기둥·신호는 NOTOP 오탐. 나무·기둥·표지는 EXEMPT.</li>
<li>박공 지붕은 큰 지붕으로 재져 통과할 수 있다. 위/옆에서 본 차는 TOPDOWN/NOTOP 이 나와 눈으로 봐야 한다.</li>
<li><code>ctx-*</code> 장면 이미지는 재지 않는다. 킷 조립 예의 소품(문·신호·건널목)은 건물이 아니므로 prop 으로 잰다.</li>
<li>증명 조각 7종은 손으로 한 번 찍은 것이지 킷 시트에 통합해 통행·이음 검사를 돌린 것이 아니다.</li>
</ul>
</body></html>'''
OUTP.parent.mkdir(exist_ok=True)
OUTP.write_text(HTML, encoding="utf-8")
print("wrote", OUTP, len(HTML)//1024, "KB")
