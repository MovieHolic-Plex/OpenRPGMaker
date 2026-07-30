import base64, io, json, os

OUT = "snow60-learning-report.html"
R = "tmp/snow60-render"
CHIP = "public/assets/easyrpg-chipset-dungeon-transparent.png"

def b64(path):
    with open(path, "rb") as f:
        return "data:image/png;base64," + base64.b64encode(f.read()).decode()

imgs = {name: b64(f"{R}/{name}.png") for name in [
    "full-live", "full-orig", "full-live-tint",
    "a-shoulder-orig", "a-shoulder-live",
    "b-diag-stair-orig", "b-diag-stair-live", "b2-tint-live",
    "c-mid-drape-orig", "c-mid-drape-live", "c2-tint-live",
    "d-stair3-live", "e-foot-live", "f-deco37-live", "f-deco8-live",
]}
chip64 = b64(CHIP)

TPR, TS, SC = 30, 16, 4

def sw(tid, label=None):
    col, row = tid % TPR, tid // TPR
    px, py = col * TS * SC, row * TS * SC
    cap = label if label is not None else str(tid)
    return (f'<span class="sw"><span class="tile" style="background-position:-{px}px -{py}px"></span>'
            f'<span class="swid">{cap}</span></span>')

def swrow(ids):
    return '<div class="swrow">' + "".join(sw(i) for i in ids) + "</div>"

def img(name, cls="shot"):
    return f'<img class="{cls}" src="{imgs[name]}">'

html = f"""<!DOCTYPE html>
<html lang="ko"><head><meta charset="utf-8">
<title>설산 60×60 — 손으로 깐 타일에서 배운 것</title>
<style>
  body {{ background:#14181f; color:#dde3ec; font:15px/1.65 "Malgun Gothic",sans-serif; margin:0; padding:32px 40px 80px; max-width:1240px; }}
  h1 {{ font-size:26px; margin:0 0 4px; }}
  h2 {{ font-size:20px; margin:48px 0 6px; padding-top:14px; border-top:2px solid #2e3a4d; color:#8fc7ff; }}
  h3 {{ font-size:16px; margin:22px 0 4px; color:#c9d8ea; }}
  .meta {{ color:#8a94a6; font-size:13px; margin-bottom:8px; }}
  .shot {{ image-rendering:pixelated; border:1px solid #2e3a4d; border-radius:4px; background:#eaf6fb; max-width:100%; }}
  .pair {{ display:flex; gap:14px; flex-wrap:wrap; margin:10px 0 4px; }}
  .pair figure {{ margin:0; }}
  figcaption {{ font-size:12.5px; color:#9fb0c8; margin-top:4px; max-width:560px; }}
  .swrow {{ display:flex; gap:10px; flex-wrap:wrap; margin:8px 0; }}
  .sw {{ display:inline-flex; flex-direction:column; align-items:center; gap:3px; }}
  .tile {{ width:64px; height:64px; image-rendering:pixelated; background-image:url({chip64}); background-size:{TPR*TS*SC}px {16*TS*SC}px; border:1px solid #33405a; border-radius:3px; background-color:#0c0f14; }}
  .swid {{ font:11px/1 ui-monospace,monospace; color:#8a94a6; }}
  table {{ border-collapse:collapse; margin:10px 0; font-size:13.5px; }}
  th,td {{ border:1px solid #2e3a4d; padding:4px 10px; text-align:right; }}
  th {{ background:#1d2531; text-align:center; }}
  td:first-child {{ text-align:left; font-family:ui-monospace,monospace; }}
  .up {{ color:#7ee2a0; }} .down {{ color:#ff9d7e; }} .new {{ color:#ffd97e; }}
  .rule {{ background:#1a2230; border-left:3px solid #8fc7ff; padding:10px 14px; margin:12px 0; border-radius:0 6px 6px 0; }}
  .warn {{ background:#2a2118; border-left:3px solid #ffb35c; padding:10px 14px; margin:12px 0; border-radius:0 6px 6px 0; }}
  pre.section {{ background:#0d1117; border:1px solid #2e3a4d; padding:12px 16px; border-radius:6px; font:13px/1.5 ui-monospace,monospace; overflow-x:auto; }}
  .full {{ width:560px; }}
  code {{ background:#222b3a; padding:1px 5px; border-radius:3px; font-size:13px; }}
  ul {{ margin:6px 0; padding-left:22px; }} li {{ margin:3px 0; }}
</style></head><body>

<h1>설산 · 절벽 다섯 겹 (60×60) — 손으로 깐 타일에서 배운 것</h1>
<div class="meta">맵: <code>map_snow_mountain_60</code> · 타일셋: <code>easyrpg_chipset_dungeon</code> (EasyRPG RTP Dungeon, 16px, 30열) · 분석 기준: 라이브 프로젝트(rpg-zzu-quest-demo) vs 생성기 원본 · 2026-07-27</div>
<p>생성기가 만든 원본에서 <b>999칸</b>이 바뀌었다. 레이아웃(다섯 겹 사행 골조)은 그대로고,
바뀐 것은 전부 <b>단면(절벽의 세로 구성)과 마감</b>이다. 아래에 타일셋의 타일 패밀리 단위로 무엇이 달라졌고,
그래서 생성기가 다음에 무엇을 해야 하는지를 정리했다.</p>

<h2>0. 전체 구조 — 골조는 그대로, 단면이 달라졌다</h2>
<div class="pair">
  <figure>{img("full-orig","shot full")}<figcaption>생성기 원본 — 4행 절벽(상단+몸통×2+밑동). 겹 사이 평지가 좁다.</figcaption></figure>
  <figure>{img("full-live","shot full")}<figcaption>손으로 깐 판 — 2행 절벽 + 얼음 처마. 같은 다섯 겹인데 평지가 넓고 밴드가 얇다.</figcaption></figure>
</div>
<figure>{img("full-live-tint","shot full")}<figcaption>분홍 = 손이 닿은 999칸. 골조(밴드 위치·계단 축)는 건드리지 않고 절벽 단면과 평지 텍스처만 다시 깐 것이 보인다.</figcaption></figure>

<h2>1. 수평 절벽 패밀리 — 4행에서 2행으로 (핵심)</h2>
{swrow([372,373,374,285,402,403,404])}
<table>
<tr><th>타일</th><th>역할</th><th>원본</th><th>현재</th><th>변화</th></tr>
<tr><td>373</td><td>상단(눈 덮인 윗면)</td><td>211</td><td>419</td><td class="up">+208</td></tr>
<tr><td>285</td><td>몸통(수정 벽면)</td><td>442</td><td>4</td><td class="down">−438</td></tr>
<tr><td>403</td><td>밑동(눈 드레이프 받침)</td><td>211</td><td>204</td><td>−7</td></tr>
<tr><td>372/374</td><td>상단 좌우 끝 조각</td><td>5+5</td><td>0</td><td class="down">전량 제거</td></tr>
<tr><td>402/404</td><td>밑동 좌우 끝 조각</td><td>5+5</td><td>1+0</td><td class="down">사실상 제거</td></tr>
</table>
<div class="pair">
  <figure>{img("a-shoulder-orig")}<figcaption>원본 b5 겹 단면: 상단+몸통 2행+밑동 = 4행. 두껍고 웅장하지만 맵이 조이다.</figcaption></figure>
  <figure>{img("a-shoulder-live")}<figcaption>손으로 깐 단면: 상단 373 + 밑동 403 = 2행. 몸통 285 는 통째로 빠졌다.</figcaption></figure>
</div>
<pre class="section">원본 단면 (4행)          손으로 깐 단면 (2행 + 처마)
  눈밭 67                  눈밭 67
  상단 373                 처마 343   ← 평지 끝 행을 처마로 마감
  몸통 285                 상단 373
  몸통 285                 밑동 403
  밑동 403                 눈밭 67
  눈밭 67</pre>
<div class="rule"><b>배운 것 ① — 몸통 285 는 이 맵의 문법이 아니다.</b> "수정 같은 얼음 벽면" 한 장이 두 행 반복되면
절벽이 얼음 동굴의 벽처럼 읽힌다. 바깥 설산의 능선은 <b>눈 덮인 윗면(373) + 눈 드레이프 받침(403)</b> 두 행이면 충분하고,
그래야 다섯 겹이 화면에 들어온다. 가장자리 전용 조각(372/374/402/404)은 맵 끝에서도 쓰지 않았다 — mid 조각만으로 마감이 충분하다.</div>

<h2>2. 343 얼음 처마 — 금지 타일의 재발견</h2>
{swrow([343, 283])}
<table>
<tr><th>타일</th><th>역할</th><th>원본</th><th>현재</th><th>변화</th></tr>
<tr><td>343</td><td>얼음 처마(드레이프 립)</td><td>0 (생성기 금지)</td><td>205 (30개 런)</td><td class="new">신규</td></tr>
</table>
<div class="pair">
  <figure>{img("b-diag-stair-orig")}<figcaption>원본: 볏 행이 곧바로 절벽 상단. 경계가 날카롭다.</figcaption></figure>
  <figure>{img("b-diag-stair-live")}<figcaption>현재: 모든 볏 위에 343 처마 행. 평지 가장자리가 절벽 위로 삐져나온 얼음으로 덮인다.</figcaption></figure>
</div>
<figure>{img("b2-tint-live")}<figcaption>분홍으로 보는 손길 — 처마 행은 밴드 볏을 따라 긴 런으로 놓인다.</figcaption></figure>
<div class="warn"><b>생성기가 343 을 금지한 이유</b>는 통행 가능 타일이라서 <b>볏 행 자체를 343 으로 대체</b>하면 절벽에 걸음 구멍이 뚫렸기 때문이다.
손으로 깐 판은 다르다: 343 을 <b>평지의 마지막 행(볏 바로 위)</b>에 놓는다. 절벽 구조(373+403)는 그대로 통행 불가이고,
처마는 어차피 걸을 수 있는 평지 위에 있으므로 구멍이 아니다. 게다가 높이가 다른 두 구간이 만나는 이음새에는 343 을
<b>소프트 필러</b>로 써서(75칸이 373→343) 직각 턱을 지웠다.</div>
<div class="rule"><b>배운 것 ② — 343 의 자리는 "볏 대신"이 아니라 "볏 위 한 행".</b>
처마 행(통행 가능) → 상단 행(불가) → 밑동 행(불가). 이 3층 케이크가 이 맵의 표준 단면이다.
단, 처마 행은 걸을 수 있으므로 플레이어가 절벽 림을 따라 걷는 경로가 생긴다 — 이것이 의도인지는 감독 판단 사항.</div>

<h2>3. 대각 빙벽 패밀리 — 더 길게, 캡은 처마 위에</h2>
{swrow([286,287,316,317,346,347])}
<table>
<tr><th>타일</th><th>역할</th><th>원본</th><th>현재</th><th>변화</th></tr>
<tr><td>286/287</td><td>대각 캡 좌/우</td><td>33+26</td><td>39+32</td><td class="up">+12</td></tr>
<tr><td>316/317</td><td>대각 몸통 좌/우</td><td>66+52</td><td>77+64</td><td class="up">+23</td></tr>
<tr><td>346/347</td><td>대각 밑동 좌/우</td><td>33+26</td><td>39+32</td><td class="up">+12</td></tr>
</table>
<div class="rule"><b>배운 것 ③ — 대각 구간은 늘린다.</b> "수평으로 가다가 대각으로 가다가" 의 리듬을 더 살린 것이 보인다
(수평 상단 일부가 대각으로 전환: 373→286/287 16칸, 285→316/317 34칸). 2행 절벽에서 대각 기둥은
<b>캡(처마 행) → 몸통(상단 행) → 밑동(밑동 행)</b> 으로 재배염된다. 몸통이 행을 공유하므로 수평-대각 전환이 틈 없이 이어진다.</div>

<h2>4. 계단 패밀리 — 폭은 4, 높이는 절벽에 맞춰, 발밑 평지까지</h2>
{swrow([375,376,377])}
<table>
<tr><th>타일</th><th>원본</th><th>현재</th><th>비고</th></tr>
<tr><td>375 (좌)</td><td>20</td><td>18</td><td rowspan="3">5개 덩어리 유지. 두 덩어리가 4행→3행</td></tr>
<tr><td>376 (중)</td><td>40</td><td>36</td></tr>
<tr><td>377 (우)</td><td>20</td><td>18</td></tr>
</table>
<div class="pair">
  <figure>{img("d-stair3-live")}<figcaption>3행 계단 — 2행 절벽을 끊고 아래 평지까지 한 행 더 남는다 (9–11행).</figcaption></figure>
  <figure>{img("e-foot-live")}<figcaption>발밭 겹(b1)의 4행 계단 — 이 겹만 아직 4행 단면 흔적이 남아 있다.</figcaption></figure>
</div>
<div class="rule"><b>배운 것 ④ — 계단 높이 = 절벽 높이 + 1.</b> 계단은 절벽의 행수를 그대로 끊되,
<b>밑동 아래 평지로 한 행 더 남아야</b> 남쪽(아래)에서 올라탈 때 발이 평지에서 시작된다.
폭 4(375·376·376·377) 와 "평평한 구간 안에만" 규칙은 원본 그대로 유효하다.</div>

<h2>5. 바닥 텍스처 패밀리 — 단일 채우기 금지</h2>
{swrow([67,66,68,96,97,98])}
{swrow([8,36,37,38])}
<table>
<tr><th>타일</th><th>읽히는 것</th><th>원본</th><th>현재</th></tr>
<tr><td>67</td><td>기본 얼음 바닥</td><td>2400</td><td>2234</td></tr>
<tr><td>96/97/98</td><td>같은 계열 스펙클 변형</td><td>0</td><td class="new">24+22+4</td></tr>
<tr><td>8/36/37/38</td><td>반짝이는 얼음 글린트/페인</td><td>0</td><td class="new">47+8+42+27</td></tr>
</table>
<div class="pair">
  <figure>{img("f-deco37-live")}<figcaption>37 런 — 밴드 발밑을 따라 얇은 얼음 막이 드리워진다.</figcaption></figure>
  <figure>{img("f-deco8-live")}<figcaption>8 글린트 — 대각 밑동 주변과 평지에 1~2칸씩 흩어 놓는다.</figcaption></figure>
</div>
<div class="rule"><b>배운 것 ⑤ — 67 한 장으로 2,400칸을 채우면 죽은 평지가 된다.</b>
같은 밝기·같은 계열의 스펙클 변형(96/97/98)을 드문드문 섞고, 글린트(8)는 대각 밑동 주변에 얹는다.
절벽 발밑의 403 일부는 38 로 바꿔(12칸) 얼음 부스러기가 굴린 느낌을 준다. 66/68/283 은 각 1~2칸 — 시험 삼아 찍은 흔적으로 보인다.</div>

<h2>6. 쓰지 않은 것들 — 침묵도 문법이다</h2>
<div class="pair">
  <figure>{img("c-mid-drape-orig")}<figcaption>원본 중간 겹 — 정상 장식도 소품도 없다.</figcaption></figure>
  <figure>{img("c-mid-drape-live")}<figcaption>현재 — 마찬가지로 상위 레이어는 완전히 비어 있다.</figcaption></figure>
</div>
<figure>{img("c2-tint-live")}<figcaption>이 겹에서 손길(분홍)은 전부 단면과 처마에 집중된다.</figcaption></figure>
<ul>
<li><b>408/409 봉우리</b> — 원본도 손판도 0칸. "산의 중턱을 자른 화면"이라는 판단에 합의.</li>
<li><b>상위 레이어</b> — 완전 공백. 소품(얼음 수정·석순·눈사람)은 이 맵의 문제가 아니었다.</li>
<li><b>372/374/402/404 끝 조각</b> — 전량 제거됨. mid 조각만으로 충분.</li>
</ul>

<h2>7. 생성기에 반영할 규칙 (다음 판을 위한 체크리스트)</h2>
<pre class="section">표준 단면 (남향 절벽 1겹):
  y+0:  … 67 67 | 343 343 343 | 67 67 …      ← 평지 끝 행은 343 처마 (통행 O)
  y+1:  … 67 67 | 373 373 373 | 67 67 …      ← 상단 (통행 X)
  y+2:  … 67 67 | 403 403 403 | 67 67 …      ← 밑동 (통행 X)
  y+3:  … 67 67   67 67 67     67 67 …       ← 아래 평지

대각 전환 (좌향 예, 2열 이상 묶음):
  처마 행:  343 343 | 286 286 | 343 343      ← 캡은 처마 행에
  상단 행:  373 373 | 316 316 | 373 373      ← 몸통은 상단 행에
  밑동 행:  403 403 | 346 346 | 403 403      ← 밑동은 밑동 행에

계단 (폭 4 고정):
  높이 = 절벽 2행 + 아래 평지 1행 = 3행
  375·376·376·377, 평평한 구간 안에만

바닥:
  67 위에 96/97/98 을 ~2% 밀도로, 글린트 8 은 대각 밑동 주변에,
  절벽 발밑 403 의 일부는 38 로</pre>
<div class="rule">한 줄 요약: <b>골조는 생성기가 맞았고, 단면은 감독이 맞았다.</b>
다음 판부터는 4행 몸통 절벽을 버리고 "처마–상단–밑동" 3층 케이크를 기본으로 깐다.</div>

</body></html>"""

with io.open(OUT, "w", encoding="utf-8") as f:
    f.write(html)
print(OUT, os.path.getsize(OUT), "bytes")
