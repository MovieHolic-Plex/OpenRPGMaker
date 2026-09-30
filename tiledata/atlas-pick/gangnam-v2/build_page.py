#!/usr/bin/env python3
"""강남 v2 데모 페이지 생성 → ~/claude-viz/gangnam-v2-demo.html (이미지는 전부 data URI, 자체완결)."""
import base64, io, os, json
from PIL import Image
HERE = os.path.dirname(os.path.abspath(__file__)); AP = os.path.dirname(HERE)
OLD = '/home/main/.t3/worktrees/rpg-zzu/t3code-8b4b09de-atlas-modern/verify-shots/gangnam-hero-qa'
OUT = os.path.expanduser('~/claude-viz/gangnam-v2-demo.html')

def uri(path, max_w=None):
    im = Image.open(path).convert('RGBA')
    if max_w and im.width > max_w: im = im.resize((max_w, round(im.height * max_w / im.width)), Image.NEAREST)
    b = io.BytesIO(); im.save(b, 'PNG', optimize=True)
    return 'data:image/png;base64,' + base64.b64encode(b.getvalue()).decode()
def img(path, cls='', w=None, alt='', max_w=None):
    st = f' style="width:{w}px"' if w else ''
    return f'<img class="px {cls}" src="{uri(path, max_w)}"{st} alt="{alt}">'

BD = lambda n: os.path.join(AP, 'beodeul-study', n)
ER = lambda n: os.path.join(AP, 'easyrpg-study', n)
G = lambda n: os.path.join(HERE, n)
P = json.load(open(G('parts.json')))
nparts = len(P['parts']); nup = sum(1 for v in P['parts'].values() if v['layer'] == 'up'); nlo = nparts - nup

def fig(path, cap, w=None, cls=''):
    return f'<figure>{img(path, cls, w)}<figcaption>{cap}</figcaption></figure>'

html = f'''<!doctype html><html lang="ko"><head><meta charset="utf-8"><title>강남 v2 — 3/4 뷰 데모</title>
<style>
body{{margin:0;background:#15171c;color:#dfe3ea;font:15px/1.6 system-ui,'Noto Sans KR',sans-serif}}
main{{max-width:1180px;margin:0 auto;padding:24px 20px 80px}}
h1{{font-size:26px;margin:0 0 4px}} h2{{font-size:20px;margin:44px 0 6px;border-bottom:1px solid #333a46;padding-bottom:6px}}
p.lead{{color:#9aa4b5;margin:0 0 8px}} .px{{image-rendering:pixelated;display:block;background:#0c0d10}}
.row{{display:flex;flex-wrap:wrap;gap:18px;align-items:flex-start}} figure{{margin:0}} figcaption{{font-size:13px;color:#9aa4b5;margin-top:6px;max-width:560px}}
.scroll{{overflow-x:auto;max-width:100%;border:1px solid #2a303b}} table{{border-collapse:collapse;width:100%;font-size:14px}}
th,td{{border:1px solid #333a46;padding:7px 10px;vertical-align:top;text-align:left}} th{{background:#1e222a}}
.note{{font-size:12.5px;color:#c7a55a;border-left:3px solid #c7a55a;padding:4px 10px;margin:10px 0;background:#1d1a12}}
.k{{display:inline-block;width:12px;height:12px;vertical-align:-1px;margin-right:4px}}
.num{{color:#8fd0a0}}
ul{{margin:6px 0 6px 18px;padding:0}}
</style></head><body><main>
<h1>강남 v2 — 3/4 뷰 데모</h1>
<p class="lead">보고 판단할 것: (1) 새 블록이 버들항과 같은 3/4 문법으로 읽히는가 (2) 옛 강남보다 건물·바닥이 입체로 보이는가 (3) 사람 대비 크기가 자연스러운가. 조각 <b>{nparts}</b>개({nup} up + {nlo} lo), 팔레트 modern3.</p>

<h2>1. 학습 요약 — 버들항(beodeul_city)</h2>
<p class="lead">기본 타일셋으로 삼은 우리 자체 제작 팩. 실측 원문: <code>tiledata/atlas-pick/beodeul-study.md</code>. 아래 그림은 학습용 확대 사본(게임 소재 아님).</p>
<div class="row">
{fig(BD('01_small-house_with-hero_6x.png'), '작은 집 48×84 + 주인공 15×23(6×). 지붕 약 48 + 벽 약 33, 기와 주기 4px. 벽 한 층 ≈ 주인공 1.4배.')}
{fig(BD('02_shop-house_cafe_5x.png'), '가게 딸린 집(카페, 5×). 깊은 우진각 지붕이 높이의 절반, 굴뚝, 줄무늬 어닝, 화분 좌대. 옆면 없음.')}
{fig(BD('03_wide-house_4x.png'), '넓은 목조 집(4×). 처마 어두운 선 2px, 목조 기둥 2px, 바닥 그림자 어두운 선 → 청회색.')}
</div>
<div class="scroll" style="margin-top:14px">{fig(BD('04_kit_bd-manor-small_lo-up_4x.png'), '킷 bd-manor-small 176×192 (4×) 의 lo / up 분리. 건물은 거의 통째로 up. 문은 맨 아랫줄, 그 아래 한 칸이 문 앞 길.')}</div>
<div class="scroll" style="margin-top:14px">{fig(BD('05_mparts_up_5x.png'), '부품 = 16px 폭 세로 기둥 조각(5×). 처마 어두운 선 2px + 좌대 약 4px 로 위아래 이음이 정해진다.')}</div>
<div class="row" style="margin-top:14px">
{fig(BD('06_avenue-lamp-tree_5x.png'), '대로 3~4칸: 가로등·가로수가 5칸 간격 교대. 나무는 석재 화분 안. 거리 2칸, 골목 1칸.')}
{fig(BD('07_street-autotile_4x.png'), '2칸 청회색 자갈길 + 밝은 연석선 + 횡단보도. 포장색 (55,66,67)/(91,102,103)/(119,117,121)/(144,146,143).')}
</div>
<p><b>버들항에서 뽑은 규칙 5가지</b></p>
<ul>
<li><span class="num">16px 칸 · 벽 한 층 ≈ 주인공×1.4</span> (주인공 15×23, 문 12~19×23~30, 저택 176×192 = 지붕 48 + 2층×40)</li>
<li>킷 = <code>json + lo.png + up.png</code>, 건물은 거의 통째로 up, 통행 문법 <code>F · X · C · S · .</code></li>
<li>3/4: 윗면(지붕 ≈ 절반) + 앞면(층당 33~40), 옆면 없음, 처마 2px 어두운 선, 아래 2~4px·오른쪽 ~4px 그림자</li>
<li>부품은 16px 폭 기둥 조각, 위아래 이음은 처마선 2px + 좌대 4px</li>
<li>길 위계: 대로 3~4 / 거리 2 / 골목 1, 블록 킷은 맞붙이지 않고 사이에 길</li>
</ul>
<h3 style="font-size:16px;margin-top:22px">버들항 카페 vs 강남 카페 (3×, 같은 문법 확인)</h3>
{fig(G('compare-cafe-bd-vs-gv2.png'), '왼쪽 버들항, 오른쪽 강남 v2. 윗면+앞면·옆면 없음·바닥 그림자·기둥 조각 구조가 같다. 다른 것은 지붕 형태(깊은 박공 → 평지붕 판)뿐 — 현대 도심이라 의도.', 664)}
<h3 style="font-size:16px;margin-top:22px">참고 — EasyRPG (보조, 한 문단)</h3>
<div class="row">
{fig(ER('01_roof-wall_ex_8x.png'), 'Exterior 지붕·벽(8×): 기와 세로 주기 8px, 벽돌 4px.')}
{fig(ER('03_door-window_ct_8x.png'), '문 16×32 평면 틀, 창 12×13 창턱 없음(8×).')}
{fig(ER('08_props_ex_6x.png'), '소품은 정면 + 윗면 약 3px(6×).')}
</div>
<p>EasyRPG 는 지붕 주기가 크고(8px) 문·창이 평면 틀이며 바닥은 흔들리는 덩이(연석·그림자 없음)다. 버들항이 지붕 깊이·창턱·그림자에서 더 3/4 에 가깝다. 이 칩셋은 2026-09-29 폐기(월드맵 제외)라 참고만 한다.</p>
<div class="note">EasyRPG RTP crop — CC BY 4.0 · EasyRPG RTP (https://easyrpg.org/). 그중 Exterior.png 는 CC0. 학습용 확대 사본이며 게임 소재로 쓰지 않는다.</div>

<h2>2. 옛 강남 vs 새 데모</h2>
<p class="lead">옛 강남 = 게임 화면 캡처(1024×768 을 ½ 로 줄인 것 / 원본). 새 데모 = 480×368 장면 1× / 3×.</p>
<div class="row">
{fig(os.path.join(OLD, '03-start.png'), '옛 강남 · 시작 지점 (캡처 ½). 옥상 면이 큰 단색 사각형이고 바로 아래에 간판 띠 — 윗면과 앞면의 비례 규칙이 없다.', 512)}
{fig(os.path.join(OLD, '12-alley-front.png'), '옛 강남 · 골목 (캡처 ½). 바닥은 한 장의 회색 면, 건물 밑 그림자·연석이 없다.', 512)}
</div>
<div class="row" style="margin-top:16px">
{fig(G('scene.png'), '새 데모 1× (480×368).', 480)}
</div>
<div class="scroll" style="margin-top:16px">{fig(G('scene.png'), '새 데모 3× (1440×1104). 왼쪽부터 오피스 타워 144×224 · 카페 112×128 · 편의점 160×80. 처마띠·필라스터·실외기·간판띠 = 앞면, 평지붕 판 = 윗면(T 14~16). 인도 → 연석 → 차도(중앙 점선) → 횡단보도, 뒷골목에 맨홀·주차선·얼룩.', 1440)}</div>

<h2>3. 조각 시트 (4×)</h2>
<p class="lead">{nparts}개 = up {nup} + lo {nlo}. 16px 폭 기둥으로 자르고 해시로 중복 제거(타워 54칸 중 고유 34, 카페 21/19, 편의점 20/17). 소품: 가로등·가로수·자판기 2·버스정류장·택시 2·쓰레기통·행인.</p>
<div class="scroll">{img(G('parts.png'), '', 2048, '조각 시트')}</div>

<h2>4. 막힘 / 가려짐 겹침</h2>
<p class="lead"><span class="k" style="background:#e62828"></span>빨강 = 막힘(앞면 아래 D×16) &nbsp; <span class="k" style="background:#286ef0"></span>파랑 = 위로 가려짐(주인공이 뒤로 걷는 곳) &nbsp; <span class="k" style="background:#28c85a"></span>초록 = 문 앞 통행 &nbsp; 주황 테두리 = 편의점 뒤에 서 있는 행인(머리까지 가려짐).</p>
<div class="scroll">{img(G('scene-overlay.png'), '', 1440, '겹침')}</div>

<h2>5. 옛 강남에서 바뀐 점</h2>
<table><tr><th>항목</th><th>옛 강남</th><th>새 데모</th></tr>
<tr><td>시점 계약</td><td>옥상 면 큰 사각형 + 바로 아래 간판띠, 윗면/앞면 비례 규칙 없음</td><td>윗면 T + 앞면 F(층 32), 옆면 없음, 빛 왼쪽 위. <code>view34_check</code> 건물·박스 소품·차량 모두 OK</td></tr>
<tr><td>바닥·경계</td><td>단색 회색 면, 연석·건물 밑 그림자 없음</td><td>인도 포장 → 연석 → 차도 5줄(점선) → 횡단보도, 건물 아래 ramp 그림자, 뒷골목 맨홀·주차선·얼룩</td></tr>
<tr><td>조각·킷 구조</td><td>정면 벽을 층마다 반복한 그림(캡처 기준, 킷 문법 없음)</td><td>16px 기둥 조각 {nparts}개 + 킷 3종(tower/cafe/conbini) — 버들항 킷 문법(lo/up, F·X·C·S) 그대로라 stamp_object 킷으로 이식 가능</td></tr>
<tr><td>가림·통행</td><td>정면 벽이라 「건물 뒤로 걷기」 구조가 없다(캡처 기준)</td><td>앞면 아래 D×16 만 막힘, 위는 up 으로 가려짐 — 숨은 행인으로 검증</td></tr>
<tr><td>소품</td><td>정면 아이콘형</td><td>자판기 16×32·택시 64×36 등 윗면 + 앞면(택시는 지붕 단 ≥ 5px), 그림자는 타원</td></tr>
<tr><td>팔레트</td><td>—</td><td>modern3 91색, 팔레트 밖 0</td></tr></table>
<p class="lead" style="margin-top:14px">스스로 찾은 약점: (1) 뒷골목이 아직 대부분 회색 면이고 얼룩·맨홀이 희미하다 (2) 건물 옆면을 안 그려서 타워 오른쪽 모서리가 납작하다 (3) 택시는 지붕 단으로만 3/4 로 읽힌다.</p>
</main></body></html>'''
open(OUT, 'w', encoding='utf-8').write(html)
print(OUT, len(html) // 1024, 'KB')
