#!/usr/bin/env python3
"""월드맵 설계 데모 4단계 비교 페이지(자체완결 HTML, 이미지는 data URI).
  python3 make_design_page_v4.py [출력경로]   기본 ~/claude-viz/worldmap-design.html
먼저 make_map_v4.py, make_terrain_sheet_v4.py 를 돌려 design-*-v4.png / map-v4.json / terrain-sheet-v4.* 를 만든다."""
import base64, io, json, os, sys
from pathlib import Path
import numpy as np
from PIL import Image

HERE = Path(__file__).resolve().parent
OUT = sys.argv[1] if len(sys.argv) > 1 else os.path.expanduser('~/claude-viz/worldmap-design.html')


def uri(im, fmt='PNG'):
    b = io.BytesIO(); im.save(b, fmt, optimize=True)
    return 'data:image/png;base64,' + base64.b64encode(b.getvalue()).decode()


rgb = lambda p: Image.open(p).convert('RGB')
v3, v4, v4x2 = rgb(HERE / 'design-1x-v3.png'), rgb(HERE / 'design-1x-v4.png'), rgb(HERE / 'design-2x-v4.png')
sheet = rgb(HERE / 'terrain-sheet-v4.png')
sj = json.loads((HERE / 'terrain-sheet-v4.json').read_text())
m = json.loads((HERE / 'map-v4.json').read_text())
G, O, Hh = np.array(m['ground']), np.array(m['object']), np.array(m['height_level'])
W, H = m['width'], m['height']


def fig(im, cap=''):
    return f'<figure><img src="{uri(im)}" width="{im.width}" height="{im.height}"><figcaption>{cap}</figcaption></figure>'


def crop(box, sc, cap):
    x0, y0, x1, y1 = box
    im = v4.crop((x0 * 16, y0 * 16, x1 * 16, y1 * 16)).resize(((x1 - x0) * 16 * sc, (y1 - y0) * 16 * sc), Image.NEAREST)
    return fig(im, f'{cap} (타일 {x0},{y0} ~ {x1},{y1}, {sc}배)')


# 통계
names = m['names']; nm = {0: '바다', 1: '강·호수', 2: '용암', 3: '독수'}; nm.update({int(k): v for k, v in names.items()})
rows = ''.join(f'<tr><td>{nm[int(g)]}</td><td class="n">{int((G == g).sum())}</td></tr>' for g in np.unique(G))
OB = {1: '활엽수', 2: '침엽수', 3: '정글 숲', 4: '고사목', 5: '눈 숲', 6: '갈색 산', 7: '눈 산', 8: '화산', 9: '붉은 메사'}
orows = ''.join(f'<tr><td>{OB[int(o)]}</td><td class="n">{int((O == o).sum())}</td></tr>' for o in np.unique(O) if o)
srows = ''.join(f'<tr><td>{s["name"]}</td><td>{s["kind"]}</td><td class="n">{s["x"]},{s["y"]}</td><td class="nt">{s["note"]}</td></tr>' for s in m['sites'])
n_ground = len([g for g in np.unique(G) if g >= 10]) + 4 - 0   # 바닥 종류 + 바다·강·용암·독수
uniq = len({v4.crop((x * 16, y * 16, x * 16 + 16, y * 16 + 16)).tobytes() for y in range(H) for x in range(W)})
n_faces = int(sum(1 for y in range(H - 1) for x in range(W) if Hh[y, x] > Hh[y + 1, x]))

PAGE = f'''<!doctype html><html lang="ko"><head><meta charset="utf-8"><title>월드맵 설계 데모 4단계</title>
<meta name="viewport" content="width=device-width,initial-scale=1"><style>
body{{background:#15181d;color:#dfe5ee;font:14px/1.55 -apple-system,"Noto Sans KR",sans-serif;margin:0;padding:20px 24px 60px;max-width:2120px}}
h1{{font-size:22px;margin:0 0 4px}} h2{{font-size:17px;margin:34px 0 8px;border-bottom:1px solid #2c333d;padding-bottom:4px}}
p,li{{color:#b9c2cf}} .sub{{color:#8b96a5}} b{{color:#fff}}
figure{{margin:8px 0 18px}} figcaption{{color:#8b96a5;font-size:13px;margin-top:6px}}
img{{image-rendering:pixelated;max-width:100%;height:auto;border:1px solid #2c333d}}
table{{border-collapse:collapse;font-size:12.5px}} th,td{{border-bottom:1px solid #2c333d;padding:3px 10px;text-align:left;vertical-align:top}}
td.n{{text-align:right;color:#fff}} td.nt{{color:#8b96a5}} .cols{{display:flex;gap:40px;flex-wrap:wrap;align-items:flex-start}}
.attr{{margin-top:34px;padding:10px 14px;border:1px solid #2c333d;border-radius:6px;font-size:12.5px;color:#8b96a5}}
</style></head><body>
<h1>월드맵 설계 데모 4단계 — 크로노 트리거·FF6 급 다양성 ({W}×{H}칸)</h1>
<p class="sub">3단계 진단 세 가지를 고쳤다. (1) 상자 같은 고원 → 삐뚤빼뚤한 윤곽에 2~3칸 두꺼운 절벽과 단(2단 고원 포함). (2) 흩어진 산 덩어리 → 주봉·능선·산기슭 언덕이 있는 산맥 6줄. (3) 북쪽 해안선 타일(물 세트 col 3~5)은 계속 쓰지 않는다.
전부 EasyRPG World 팔레트·명암 단계·외곽선 결로 좌표를 적어 찍은 손 도트이고, 생성 이미지나 트레이싱은 없다. 결정적 노이즈 왜곡만 쓰고 무작위 생성기는 없다.<br>
지형 {n_ground}종(바닥 {n_ground - 4} + 바다·강·용암·독수), 대륙 2·내해·해협·섬줄기, 절벽 면 {n_faces}열, 지도의 고유 16×16 칸 {uniq}개, 장소 {len(m['sites'])}곳.</p>

<h2>1. 4단계 지도 전체 (2배)</h2>
{fig(v4x2, f'{W}×{H}칸. 서쪽 대륙(설원·산맥·2단 고원·초원·숲·사막·정글)과 동쪽 대륙(사바나·독늪·화산·오아시스·협곡·눈 반도), 사이의 내해와 해협, 남쪽 섬줄기.')}

<h2>2. 3단계 vs 4단계 (1배)</h2>
{fig(v3, '3단계: 64×48칸. 상자 고원, 흩어진 산 덩어리, 지형 종류가 적다.')}
{fig(v4, '4단계: 96×72칸. 대륙 둘, 능선, 고원, 강 체계, 얕은 물에서 깊은 물로 가는 수심, 기후대.')}

<h2>3. 지역 확대 (3배)</h2>
{crop((8, 4, 38, 22), 3, '북서 설원과 눈 산맥: 주 능선 위로 산기슭 언덕, 옅은 눈 결')}
{crop((6, 14, 32, 30), 3, '서쪽 고원: 삐뚤빼뚤한 윤곽, 2~3칸 절벽, 윗단 마을, 경사로')}
{crop((58, 8, 92, 28), 3, '화산·분화구·용암과 독늪: 화산 바닥이 검은 현무암·화산재로 바뀌고 독수가 늪 안에 고인다')}
{crop((68, 26, 94, 44), 3, '사바나·오아시스·균열 협곡')}
{crop((12, 44, 42, 66), 3, '사막: 모래언덕, 메사, 사막 촌락·폐허')}
{crop((46, 48, 92, 70), 2, '남쪽 섬줄기: 섬마다 다른 바닥과 물체(붉은 메사, 검은 바위산), 수심 3단')}

<h2>4. 새 지형 도감 (2배)</h2>
<p class="sub">실제 렌더러로 그린 견본 {len(sj['panels'])}장: 바닥 {sj['ground_types']}종은 바다 위 덩이와 안쪽 이웃 바닥(가장자리·모서리·변형), 이어서 고원 2색·물 3종·물체 9종. 이 시트의 고유 16×16 칸은 {sj['unique_tiles_in_sheet']}개.</p>
{fig(sheet, '')}

<h2>5. 조사 요약</h2>
<div class="cols">
<div><table><thead><tr><th>바닥</th><th>칸</th></tr></thead><tbody>{rows}</tbody></table></div>
<div><table><thead><tr><th>물체</th><th>칸</th></tr></thead><tbody>{orows}</tbody></table></div>
</div>
<p style="margin-top:14px"><b>요구 충족:</b> 지형 18종 이상(바닥 종류 {n_ground - 4} + 물 4계열) / 대륙 2 + 섬줄기 + 내해 / 산맥 6줄, 강 5줄 / 수심 단계 / 장소 {len(m['sites'])}곳(12곳 이상).</p>
<p><b>아직 어색한 곳:</b> 툰드라가 넓고 비어 있다. 2단 고원의 회색 절벽과 1단 갈색 절벽 색이 갈린다. 균열 협곡이 검은 국수처럼 보인다. 섬은 여전히 한 바닥으로 채운 덩이에 가깝다. 수심 얼룩이 다소 불규칙하다.</p>
<h2>6. 장소</h2>
<table><thead><tr><th>이름</th><th>종류</th><th>좌표</th><th>비고</th></tr></thead><tbody>{srows}</tbody></table>

<div class="attr">원본 지형·아이콘은 EasyRPG RTP <code>ChipSet/World.png</code> (CC BY 4.0). 4단계 지형은 그 팔레트와 결로 새로 찍은 도트이다. 크로노 트리거·FF6는 구성 방식을 관찰만 했고 그림·데이터는 쓰지 않았다.
출처 표기: <code>tiledata/atlas-pick/worldmap-easyrpg-plus/ATTRIBUTION-NOTE.md</code>. 스크립트: <code>design-map/terrain_v4.py</code>, <code>make_map_v4.py</code>, <code>make_terrain_sheet_v4.py</code>, <code>make_design_page_v4.py</code>.</div>
</body></html>'''
Path(OUT).parent.mkdir(parents=True, exist_ok=True)
Path(OUT).write_text(PAGE, encoding='utf-8')
print('wrote', OUT, len(PAGE) // 1024, 'KB', 'ground', n_ground, 'uniq', uniq, 'faces', n_faces)
