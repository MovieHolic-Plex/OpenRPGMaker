#!/usr/bin/env python3
"""적대적 실내 감사 보고서 빌더 — round*/report.json + PNG → 이미지 리치 HTML."""
import json, os, shutil, html, pathlib

ROOT = pathlib.Path("output/adv-interior")
OUT = ROOT / "report"
IMG = OUT / "img"
OUT.mkdir(parents=True, exist_ok=True)
IMG.mkdir(exist_ok=True)


def load(round_dir):
    p = ROOT / round_dir / "report.json"
    return json.loads(p.read_text()) if p.exists() else []


def copy_img(round_dir, png):
    src = ROOT / round_dir / png
    dst = IMG / f"{round_dir}-{png}"
    if src.exists():
        shutil.copy(src, dst)
    return f"img/{dst.name}"


rounds = {k: load(k) for k in ("round1", "round2", "round3", "t")}
for key, cases in rounds.items():
    for c in cases:
        c["img"] = copy_img(key, c["png"])
        c["round"] = key

byid = {c["id"]: c for cs in rounds.values() for c in cs}
diag = {p.stem: p.read_text() for p in (ROOT / "diag").glob("*.txt")}


def esc(s):
    return html.escape(str(s))


def badge(score, ok):
    cls = "ok" if ok else ("warn" if score >= 70 else "bad")
    return f'<span class="badge {cls}">score {score}</span>'


def card(c, extra=""):
    ev = c["evaluation"]
    adv = c["adversarial"]
    issues = "".join(f"<li>{esc(i)}</li>" for i in ev["issues"]) or "<li class='muted'>없음</li>"
    warns = "".join(f"<li>{esc(w)}</li>" for w in c["pipeline"]["warnings"]) or "<li class='muted'>없음</li>"
    rows = "".join(
        f"<tr><td>{esc(r['id'])}</td><td>{esc(r['theme'])}</td><td>{r['area']}</td><td>{r['occupied']}</td>"
        f"<td class='{'bad-num' if r['fill'] < 0.2 else ''}'>{r['fill']:.2f}</td><td>{r['northBias']:.2f}</td>"
        f"<td class='{'bad-num' if r['largestEmptyRect'] >= 18 else ''}'>{r['largestEmptyRect']}</td><td>{r['distinctProps']}</td></tr>"
        for r in adv["rooms"]
    )
    twins = (
        f"<p class='flag'>쌍둥이 방(가구 구성 완전 동일): {esc(', '.join(adv['twinRooms']))}</p>"
        if adv["twinRooms"] else ""
    )
    return f"""
<article class="card" id="{esc(c['id'])}">
  <header><h3>{esc(c['label'])}</h3>{badge(ev['score'], ev['ok'])}</header>
  <p class="brief">{esc(c.get('brief') or '')}</p>
  {f"<p class='note'>{esc(c['note'])}</p>" if c.get("note") else ""}
  <a href="{c['img']}" target="_blank"><img src="{c['img']}" alt="{esc(c['label'])}" loading="lazy"></a>
  <div class="stats">
    <span>맵 {c['size']['width']}×{c['size']['height']}</span>
    <span>채움률 <b>{adv['globalFill']:.2f}</b></span>
    <span>소품 종류 <b>{adv['distinctProps']}</b></span>
    <span>바닥 {adv['floorCells']}칸</span>
    <span>seed {esc(c['seed'])}</span>
    <span>벽 {esc(c['wallMaterial'])}</span>
  </div>
  {twins}
  <table class="rooms"><thead><tr><th>방</th><th>테마</th><th>면적</th><th>점유</th><th>채움</th><th>북벽편중</th><th>최대공백</th><th>소품종</th></tr></thead><tbody>{rows}</tbody></table>
  <details><summary>내장 평가 이슈 / 파이프라인 경고</summary>
    <div class="two"><div><h5>evaluate_interior_room</h5><ul>{issues}</ul></div><div><h5>pipeline warnings</h5><ul>{warns}</ul></div></div>
  </details>
  {extra}
</article>"""


def grid(cases, extra_map=None):
    return f'<div class="grid">{"".join(card(c, (extra_map or {}).get(c["id"], "")) for c in cases)}</div>'


r1 = rounds["round1"]
r1_llm = [c for c in r1 if c["source"] == "llm"]
r1_code = [c for c in r1 if c["source"].startswith("code:")]
r2 = rounds["round2"]
r3 = rounds["round3"]
t = rounds["t"]

allcases = r1 + r2 + r3
fills = [c["adversarial"]["globalFill"] for c in allcases]
summary_rows = "".join(
    f"<tr><td>{esc(c['round'])}</td><td>{esc(c['label'])}</td><td>{esc(c['source'])}</td>"
    f"<td>{c['evaluation']['score']}</td><td>{c['adversarial']['globalFill']:.2f}</td>"
    f"<td>{c['adversarial']['distinctProps']}</td><td>{max([r['largestEmptyRect'] for r in c['adversarial']['rooms']] or [0])}</td>"
    f"<td>{len(c['pipeline']['warnings'])}</td></tr>"
    for c in allcases
)

CSS = """
:root{--bg:#0d0f14;--panel:#151922;--panel2:#1b2029;--line:#2a3140;--fg:#e6e9ef;--mut:#8b95a7;--ok:#3fb950;--warn:#d29922;--bad:#f85149;--acc:#58a6ff}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--fg);font:15px/1.7 -apple-system,"Segoe UI",Roboto,"Noto Sans KR",sans-serif}
header.top{padding:56px 32px 40px;background:linear-gradient(160deg,#1b2740,#0d0f14 70%);border-bottom:1px solid var(--line)}
header.top h1{margin:0 0 12px;font-size:34px;letter-spacing:-.5px}
header.top p{margin:4px 0;color:var(--mut);max-width:900px}
main{max-width:1280px;margin:0 auto;padding:0 24px 80px}
section{margin:56px 0}
h2{font-size:24px;border-left:4px solid var(--acc);padding-left:12px;margin:0 0 8px}
h2 .sub{display:block;font-size:13px;color:var(--mut);font-weight:400;padding-top:4px}
.lede{color:#c9d1d9;background:var(--panel);border:1px solid var(--line);border-left:3px solid var(--acc);padding:16px 20px;border-radius:8px}
.verdicts{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:16px;margin:24px 0}
.verdict{background:var(--panel);border:1px solid var(--line);border-radius:10px;padding:18px}
.verdict b{display:block;font-size:13px;color:var(--acc);letter-spacing:.08em;text-transform:uppercase;margin-bottom:8px}
.verdict .big{font-size:28px;font-weight:700;display:block;margin-bottom:6px}
.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(420px,1fr));gap:20px;margin-top:20px}
.card{background:var(--panel);border:1px solid var(--line);border-radius:12px;padding:16px;overflow:hidden}
.card header{display:flex;justify-content:space-between;align-items:center;gap:12px;margin-bottom:6px}
.card h3{margin:0;font-size:16px}
.card img{width:100%;image-rendering:pixelated;border-radius:8px;background:#000;border:1px solid var(--line);display:block;margin:10px 0}
.badge{font-size:12px;padding:3px 10px;border-radius:99px;white-space:nowrap;font-weight:600}
.badge.ok{background:rgba(63,185,80,.15);color:var(--ok);border:1px solid rgba(63,185,80,.4)}
.badge.warn{background:rgba(210,153,34,.15);color:var(--warn);border:1px solid rgba(210,153,34,.4)}
.badge.bad{background:rgba(248,81,73,.15);color:var(--bad);border:1px solid rgba(248,81,73,.4)}
.brief{color:var(--mut);font-size:13px;margin:0}
.note{color:#d29922;font-size:13px;margin:6px 0 0}
.flag{background:rgba(248,81,73,.1);border:1px solid rgba(248,81,73,.3);color:#ffb3ae;padding:8px 12px;border-radius:6px;font-size:13px;margin:10px 0 0}
.stats{display:flex;flex-wrap:wrap;gap:8px;margin:8px 0}
.stats span{background:var(--panel2);border:1px solid var(--line);border-radius:6px;padding:3px 10px;font-size:12px;color:var(--mut)}
.stats b{color:var(--fg)}
table{width:100%;border-collapse:collapse;font-size:12.5px;margin-top:8px}
th,td{text-align:left;padding:5px 8px;border-bottom:1px solid var(--line)}
th{color:var(--mut);font-weight:600;font-size:11.5px;text-transform:uppercase;letter-spacing:.05em}
td.bad-num{color:var(--bad);font-weight:600}
details{margin-top:10px}
summary{cursor:pointer;color:var(--acc);font-size:13px}
.two{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-top:8px}
.two h5{margin:0 0 4px;font-size:12px;color:var(--mut);text-transform:uppercase}
ul{margin:4px 0;padding-left:18px}li{font-size:12.5px}
.muted{color:var(--mut)}
pre{background:#0a0c10;border:1px solid var(--line);border-radius:8px;padding:14px;overflow:auto;font:12px/1.45 ui-monospace,SFMono-Regular,Menlo,monospace;color:#c9d1d9}
pre b{color:var(--bad)}
.code-cite{background:#0a0c10;border:1px solid var(--line);border-left:3px solid var(--bad);border-radius:8px;padding:14px;overflow:auto;font:12.5px/1.6 ui-monospace,Menlo,monospace}
.pair{display:grid;grid-template-columns:1fr 1fr;gap:20px;align-items:start}
.pair figure{margin:0}
.pair img{width:100%;image-rendering:pixelated;border-radius:8px;border:1px solid var(--line)}
.pair figcaption{font-size:13px;color:var(--mut);padding-top:8px}
.recos{counter-reset:r}
.reco{background:var(--panel);border:1px solid var(--line);border-radius:10px;padding:16px 20px;margin:12px 0;position:relative}
.reco:before{counter-increment:r;content:counter(r);position:absolute;left:-14px;top:16px;width:28px;height:28px;border-radius:99px;background:var(--acc);color:#04121f;font-weight:700;display:grid;place-items:center;font-size:14px}
.reco h4{margin:0 0 6px;font-size:15px}
.reco .sev{font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:var(--bad);font-weight:700}
footer{border-top:1px solid var(--line);padding:28px 24px;color:var(--mut);font-size:13px;text-align:center}
@media(max-width:820px){.pair,.two{grid-template-columns:1fr}}
"""

def pre_diag(name, highlight=()):
    text = esc(diag.get(name, "(없음)"))
    for h in highlight:
        text = text.replace(esc(h), f"<b>{esc(h)}</b>")
    return f"<pre>{text}</pre>"


HTML = f"""<!doctype html>
<html lang="ko"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>실내 시공 파이프라인 적대적 감사 · villager-room-v1</title>
<style>{CSS}</style></head>
<body>
<header class="top">
  <h1>실내 시공 파이프라인 적대적 감사</h1>
  <p><b>대상</b> villager-room-v1 (<code>src/editor/interiorRoomPipeline.ts</code>) · LLM 저작 플랜 vs 코드 하드코딩 평면</p>
  <p><b>방법</b> 내가 직접 LLM 역할로 플랜을 저작 → 실제 파이프라인 시공 → PNG 렌더 → 스크린샷 육안 + 정량 적대 지표 → 재저작. 3라운드 + 트리거 격리 스윕.</p>
  <p><b>표본</b> {len(allcases) + len(t)}건 시공 · 전부 실제 <code>runInteriorRoomPipeline</code> 산출물이며 합성·보정 없음</p>
</header>
<main>

<section>
  <h2>결론<span class="sub">한 줄 요약</span></h2>
  <div class="lede">
    실내가 형편없어 보이는 원인은 <b>LLM이 아니다.</b> LLM이 정할 수 있는 것은 방 bbox·역할 테마·문 위치뿐이고,
    가구 배치는 전부 결정론적 절차 코드가 한다. 같은 브리프를 코드 하드코딩 평면으로 돌려도
    채움률은 <b>0.19~0.23</b>으로 LLM 산출물(0.13~0.28)과 사실상 같다.
    즉 <b>천장은 배치 엔진이 정하고 있으며, 프롬프트를 고쳐도 이 천장은 올라가지 않는다.</b>
    다만 LLM 플랜은 코드 평면이 우연히 피해 온 <b>봉쇄 지뢰</b>를 밟는다 — 방 하나를 완전히 못 들어가게 만드는
    재현 가능한 엔진 버그를 이 감사에서 격리했다.
  </div>
  <div class="verdicts">
    <div class="verdict"><b>평균 채움률</b><span class="big">{sum(fills)/len(fills):.2f}</span>바닥 4칸 중 1칸만 가구. 방 중앙은 거의 항상 빈 나무바닥.</div>
    <div class="verdict"><b>score 100인데도</b><span class="big">18~45칸</span>내장 평가 만점 맵에 남는 최대 연속 공백 직사각형. 평가기는 이걸 보지 않는다.</div>
    <div class="verdict"><b>봉쇄 버그</b><span class="big">폭 7→8</span>서재 폭 한 칸 차이로 방 전체가 문에서 도달 불가. 자동 수리 불가.</div>
    <div class="verdict"><b>LLM vs 코드</b><span class="big">동급</span>코드 템플릿 0.19~0.23 / LLM 0.21~0.28. 사람이 짠 평면도 더 낫지 않다.</div>
  </div>
</section>

<section>
  <h2>측정 방식<span class="sub">내장 평가기가 보지 않는 것을 따로 재도록 지표를 새로 정의했다</span></h2>
  <div class="lede" style="border-left-color:#8b95a7">
    <b>채움률</b> = 방 바닥 중 가구 점유 칸 비율 · <b>북벽 편중</b> = 점유 칸 중 방 상단 1/3에 몰린 비율 ·
    <b>최대공백</b> = 가구가 하나도 없는 최대 연속 직사각형 면적(시각적 죽은 공간) ·
    <b>소품 종류</b> = 서로 다른 상단 타일 수 · <b>쌍둥이 방</b> = 같은 테마 방끼리 가구 구성 다중집합이 완전히 동일.
    이 넷은 모두 <code>evaluate_interior_room</code>이 채점하지 않는 축이다.
  </div>
</section>

<section>
  <h2>라운드 1 — LLM 1차 산출물<span class="sub">build-interior 스킬 지시만 보고 좌표를 직접 계산한 결과</span></h2>
  {grid(r1_llm)}
</section>

<section>
  <h2>라운드 1 대조군 — 코드 하드코딩 평면<span class="sub">마을 생성기가 LLM 없이 쓰는 <code>houseInteriors.ts</code> 템플릿. 같은 엔진, 사람이 손으로 짠 좌표.</span></h2>
  {grid(r1_code)}
  <div class="lede" style="margin-top:20px">
    코드 템플릿이 <b>더 낫게 보이는</b> 이유는 배치가 똑똑해서가 아니다. 침실에 러그가 깔리고 방 비례가 안정적이어서
    '방처럼' 읽히는 것뿐이고, 정량 채움률은 LLM 산출물보다 오히려 <b>낮다</b>(cottage-l 0.22 / mansion 0.19).
    죽은 공간도 그대로다 — mansion master 침실의 최대 공백은 <b>28칸</b>.
  </div>
</section>

<section>
  <h2>치명 결함 — 방 하나가 통째로 봉쇄된다<span class="sub">라운드 1 저택: 서재 도달 불가 20~22칸, 자동 수리 실패</span></h2>
  <div class="pair">
    <figure>
      <img src="{byid['r1-llm-manor']['img']}" alt="R1 manor">
      <figcaption><b>R1 저택 (score 45)</b> — 북동 서재로 들어가는 문이 서가에 막혔다. 침실은 35칸 중 3칸만 점유.
      파이프라인 경고: <code>제거 가능한 소품 없음(멀티타일 세트가 길을 막음)</code></figcaption>
    </figure>
    <figure>
      <img src="{byid['r3-llm-manor']['img']}" alt="R3 manor">
      <figcaption><b>R3 저택 (score 100)</b> — 서재 폭을 8→7로 줄인 것 <i>말고는</i> 아무것도 바꾸지 않았다. 봉쇄가 사라졌다.</figcaption>
    </figure>
  </div>
  <h3 style="margin-top:32px">트리거 격리 — 델타 하나씩 되돌린 5개 변형</h3>
  <p class="brief">코드 템플릿 기하에서 출발해 내 플랜과의 차이를 하나씩 적용했다. 봉쇄를 만드는 델타는 정확히 하나다.</p>
  {grid(t)}
  <h3 style="margin-top:32px">봉쇄 지도 — 정상(폭 7) vs 봉쇄(폭 8)</h3>
  <div class="two">
    <div><h5>t0 · 서재 폭 7 (면적 42) — 정상</h5>{pre_diag("t0-template")}</div>
    <div><h5>t1 · 서재 폭 8 (면적 48) — 서재 전체 X</h5>{pre_diag("t1-studyw8")}</div>
  </div>
  <h3 style="margin-top:32px">근본 원인</h3>
  <div class="code-cite">
<b>src/editor/interiorRoomPipeline.ts · placeBookshelfRow</b><br><br>
const shelvesPerRow = area &lt; 40 ? 1 : Math.max(1, Math.floor(bboxW / 4));   <span style="color:#8b95a7">// 폭 8 → 2열</span><br>
if (area &gt;= 48 &amp;&amp; northFloor.length &gt; 0) {{ ... placeBookshelfRow(map, midRow, ...) }}  <span style="color:#8b95a7">// 면적 48 → 방 중앙에 서가 한 줄 더</span><br><br>
<span style="color:#8b95a7">// 배치 본문 — 상단(upper)이 아니라 하단(lower)에 쓴다</span><br>
setL(map, c.x, c.y, VR.BOOK_TL); setL(map, c.x + 1, c.y, VR.BOOK_TR); ...<br>
<span style="color:#8b95a7">// 유효성 검사도 하단만 본다</span><br>
if (!isWalkFloor(map, c.x + dx, c.y + dy)) ok = false;
  </div>
  <div class="verdicts" style="margin-top:16px">
    <div class="verdict"><b>왜 센티널이 못 막나</b>방 입구 보호용 <code>ENTRY_SENTINEL</code>은 <b>upper</b>에 박힌다. 서가는 <b>lower</b>에 쓰고 upper를 보지 않으므로 입구 착지칸 위에 그대로 앉는다.</div>
    <div class="verdict"><b>왜 수리가 못 고치나</b><code>enforceWalkability</code>는 <code>setU(..., EMPTY)</code>로 <b>upper 소품만</b> 녹인다. lower에 쓰인 서가는 제거 대상이 아니라 영구 벽이 된다.</div>
    <div class="verdict"><b>왜 평가가 못 잡나</b>평가기는 lower가 통행 불가면 '가구 점유'로 세므로 봉쇄의 형태가 안 보인다. 도달 불가 카운트만 남고 원인 지목이 안 된다.</div>
    <div class="verdict"><b>왜 검증이 없나</b>사분면 필러는 놓고-BFS검증-되돌리기를 하는데, 서가 중앙열은 <b>무검증</b>으로 방을 반으로 자른다.</div>
  </div>
</section>

<section>
  <h2>라운드 2 — 1차 교정<span class="sub">천장 여백·방 깊이·문 위치 교정. 저택 봉쇄는 <b>살아남았다</b></span></h2>
  {grid(r2)}
  <div class="lede" style="margin-top:20px">
    상단 3행 여백과 방 깊이 교정은 채움률을 거의 바꾸지 못했다(0.26→0.26, 0.24→0.21). 저택 봉쇄도 그대로다 —
    내 첫 가설(천장 여백 누락)은 <b>틀렸고</b>, 스윕을 돌려서야 서가 임계가 범인으로 드러났다.
    같은 기하에 seed만 바꾼 두 판(A/B)은 채움률 0.25/0.26으로 <b>분산이 거의 없다</b> — 재추첨은 구도를 바꾸지 못한다.
  </div>
</section>

<section>
  <h2>라운드 3 — 최종<span class="sub">지뢰를 모두 피한 플랜. 합격은 하지만 그림은 크게 나아지지 않는다</span></h2>
  {grid(r3)}
  <div class="lede" style="margin-top:20px">
    저택은 100점이 됐다. 그런데 채움률은 <b>0.20</b> — R1(0.13)보다 나아진 건 봉쇄가 풀려서 방이 채워졌기 때문이고,
    방 중앙 공백은 그대로다. 여관 객실 두 개는 가구 구성이 <b>완전히 동일</b>(쌍둥이)한데 내장 평가는 만점을 준다.
    상점은 seed를 바꿔도 북동 사분면 공백이 남아 85점에서 더 오르지 않았다 — 밀도 문제는 <b>seed가 아니라 문법</b>의 문제다.
  </div>
</section>

<section>
  <h2>전체 지표<span class="sub">{len(allcases)}건</span></h2>
  <table><thead><tr><th>라운드</th><th>케이스</th><th>출처</th><th>score</th><th>채움률</th><th>소품종</th><th>최대공백</th><th>경고</th></tr></thead>
  <tbody>{summary_rows}</tbody></table>
</section>

<section>
  <h2>적대적 판정<span class="sub">내장 평가기 score와 실제 보이는 품질의 괴리</span></h2>
  <div class="verdicts">
    <div class="verdict"><b>score는 품질 신호가 아니다</b>score 100 케이스 8건 전부 채움률 0.19~0.26, 최대 공백 18~45칸. 평가기는 '필수 가구 존재 + 도달 가능 + 사분면 비율'만 본다.</div>
    <div class="verdict"><b>사분면 판정이 너무 거칠다</b>맵 전체를 4등분해 비교하므로, 방 <i>안</i>이 텅 비어도 다른 방이 채워져 있으면 통과한다.</div>
    <div class="verdict"><b>중복을 안 본다</b>같은 테마 방은 같은 가구 세트를 그대로 반복한다(여관 객실). variant 로테이션은 방 좌표 기반이라 좌우 대칭 배치에서 자주 충돌한다.</div>
    <div class="verdict"><b>북벽 편중</b>침실 북벽 편중 0.5~0.75. 벽 스냅·북측 바닥 위주 문법의 구조적 결과이고, 남반부 필러는 임계 미달 방에서 자주 침묵한다.</div>
  </div>
</section>

<section class="recos">
  <h2>권고<span class="sub">우선순위 순. 1~2는 버그 수정, 3~5는 품질 상한 올리기</span></h2>
  <div class="reco"><span class="sev">P0 · 버그</span><h4>하단 타일 멀티세트를 통행 계약에 편입</h4>
    <code>placeBookshelfRow</code>(그리고 <code>setL</code>로 쓰는 모든 세트: 화덕 하단, 카운터)를
    <b>ENTRY_SENTINEL 검사에 포함</b>하고, 배치 후 <b>문 BFS 검증 → 실패 시 되돌리기</b>를 적용한다.
    사분면 필러가 이미 쓰는 place-verify-revert 패턴을 그대로 재사용하면 된다.</div>
  <div class="reco"><span class="sev">P0 · 버그</span><h4>면적 48 서가 중앙열을 무검증으로 놓지 말 것</h4>
    지금은 방을 반으로 자른다. 최소한 중앙열 배치 후 도달성 검증을 걸고, 통로 폭 1칸을 강제해야 한다.</div>
  <div class="reco"><span class="sev">P1 · 평가</span><h4>평가를 방 단위로 내리고 공백 직사각형을 채점에 넣기</h4>
    사분면을 맵이 아니라 <b>방</b>에 적용하고, 최대 공백 직사각형과 쌍둥이 방(가구 구성 동일)을 감점 항목으로 추가한다.
    지금 score 100은 "치명 결함 없음"일 뿐 "볼만함"이 아니다.</div>
  <div class="reco"><span class="sev">P1 · 문법</span><h4>방 중앙을 채우는 문법이 없다</h4>
    소품 표면 분류가 <code>wallFace / againstWallFloor / cornerFloor / openFloor</code>인데 실제 배치는 벽면·북측·코너에 몰린다.
    러그+좌석군처럼 <b>중앙 앵커 클러스터</b>를 방 면적 기준으로 강제하는 규칙이 필요하다.</div>
  <div class="reco"><span class="sev">P2 · 프롬프트</span><h4>스킬 프롬프트에 없는 제약이 실패를 만든다</h4>
    <code>build-interior</code> 스킬은 상단 3행 여백(코드 경로의 <code>shiftPlanForCeiling</code>이 자동으로 해주는 일)과
    면적 임계(서재 48, 카운터 30, 러그 16 등)를 알려주지 않는다. LLM은 알 수 없는 지뢰를 밟는다.
    임계를 프롬프트에 넣거나 — 더 좋게는 — 툴 쪽에서 플랜을 자동 정규화해야 한다.</div>
</section>

<section>
  <h2>재현<span class="sub">전부 실제 코드 경로. 합성 이미지 없음</span></h2>
  <pre># 감사 하네스(플랜 → 시공 → PNG → 지표)
npx vite-node --script scripts/adv-interior-audit.mts -- output/adv-interior/plans-round1.json output/adv-interior/round1
npx vite-node --script scripts/adv-interior-audit.mts -- output/adv-interior/plans-round2.json output/adv-interior/round2
npx vite-node --script scripts/adv-interior-audit.mts -- output/adv-interior/plans-round3.json output/adv-interior/round3
npx vite-node --script scripts/adv-interior-audit.mts -- output/adv-interior/plans-t.json      output/adv-interior/t

# 봉쇄 지도(문 BFS + 내부 문 주변 타일 덤프)
npx vite-node --script scripts/adv-interior-diag.mts  -- output/adv-interior/plans-t.json t1-studyw8

# 보고서 빌드
python3 scripts/adv-interior-report.py</pre>
</section>
</main>
<footer>villager-room-v1 적대적 감사 · 시공 {len(allcases) + len(t)}건 · PNG는 <code>runInteriorRoomPipeline</code> 산출물을 EasyRPG 인테리어 칩셋으로 직접 블릿한 것</footer>
</body></html>
"""

(OUT / "report.html").write_text(HTML, encoding="utf-8")
for key in rounds:
    src = ROOT / key / "report.json"
    if src.exists():
        shutil.copy(src, OUT / f"metrics-{key}.json")
diag_dir = OUT / "diag"
diag_dir.mkdir(exist_ok=True)
for name, text in diag.items():
    (diag_dir / f"{name}.txt").write_text(text)
print("wrote", OUT / "report.html", "images:", len(list(IMG.glob('*.png'))))
