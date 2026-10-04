#!/usr/bin/env python3
"""월드맵 설계 데모 3단계 비교 페이지(자체완결 HTML, 이미지는 data URI).
  python3 make_design_page.py [출력경로]   기본 ~/claude-viz/worldmap-design.html
먼저 make_design_map.py, make_terrain_sheet.py 를 돌려 design-*.png / missing.json / ../world-plus-terrain.* 를 만든다.
"""
import base64, html, io, json, os, sys
from pathlib import Path

import numpy as np
from PIL import Image

HERE = Path(__file__).resolve().parent
PLUS = HERE.parent
ROOT = HERE.parents[3]
OUT = sys.argv[1] if len(sys.argv) > 1 else os.path.expanduser('~/claude-viz/worldmap-design.html')


def uri(im):
    b = io.BytesIO(); im.save(b, 'PNG', optimize=True)
    return 'data:image/png;base64,' + base64.b64encode(b.getvalue()).decode()


def rgb(p):
    return Image.open(p).convert('RGB')


d1, d2 = rgb(HERE / 'design-1x.png'), rgb(HERE / 'design-2x.png')
o1, o2 = rgb(HERE / 'design-1x-v2.png'), rgb(HERE / 'design-2x-v2.png')   # 2단계 = 비교 기준
v1 = rgb(HERE / 'design-1x-v1.png')
ms = json.loads((HERE / 'missing.json').read_text())
mp = json.loads((HERE / 'map.json').read_text())
ts_json = json.loads((PLUS / 'world-plus-terrain.json').read_text())
ts_img = Image.open(PLUS / 'world-plus-terrain.png').convert('RGBA')
key = tuple(ts_json['key'])


def fig(im, cap='', w=None):
    st = f' style="width:{w}px"' if w else ''
    return (f'<figure><img src="{uri(im)}" width="{im.width}" height="{im.height}"{st}><figcaption>{cap}</figcaption></figure>')


def up(im, s):
    return im.resize((im.width * s, im.height * s), Image.NEAREST)


def cmp_pair(box, sc, capl, capr):
    a = up(o1.crop(box), sc); b = up(d1.crop(box), sc)
    return (f'<div class="pair"><figure><img src="{uri(a)}"><figcaption>{capl}</figcaption></figure>'
            f'<figure><img src="{uri(b)}"><figcaption>{capr}</figcaption></figure></div>')


# ── 새 칸 목록(4배) ─────────────────────────────────────────────────────────────
def cell_img(col, row):
    c = ts_img.crop((col * 16, row * 16, col * 16 + 16, row * 16 + 16))
    a = np.array(c)
    kmask = (a[..., 0] == key[0]) & (a[..., 1] == key[1]) & (a[..., 2] == key[2])
    a[kmask] = (0, 0, 0, 0)
    return Image.fromarray(a, 'RGBA')


GROUP_KO = {'highland': '고원 절벽 (3단계, 손 도트: 윗면·가장자리·앞 벽·모서리·계단·경사)', 'road': '길 킷 (풀·모래·눈·흙 x 2변형: 직선·모서리·T·+·끝·고립)', 'melt': '녹은 가장자리 킷 (눈↔풀 등 경계)', 'bridge': '나무 다리 (가로·세로, 양 끝)',
            'peak': '큰 봉우리·피라미드 (산 조각 재조립)', 'mirror': '좌우 뒤집은 산·숲 몸통(변형)', 'decor': '바닥 장식 소품(발자국·얼음 균열·눈더미·돌·풀포기 등)'}
groups = {}
for c in ts_json['cells']:
    groups.setdefault(c['group'], []).append(c)
cells_html = []
for g in ('highland', 'mirror', 'bridge', 'road', 'melt', 'decor'):
    cs = groups.get(g, [])
    if not cs:
        continue
    n_re = sum(1 for c in cs if c['prov'].startswith('reassembly'))
    items = []
    for c in cs:
        im = up(cell_img(c['col'], c['row']), 4)
        cl = 're' if c['prov'].startswith('reassembly') else 'hp'
        items.append(f'<img class="cell {cl}" title="{html.escape(c["name"])} ({c["prov"]})" src="{uri(im)}" width="64" height="64">')
    cells_html.append(f'<h3>{GROUP_KO[g]} — {len(cs)}칸 (재조립 {n_re} / 손 도트 {len(cs) - n_re})</h3><div class="cells">{"".join(items)}</div>')
cnt = ts_json['counts']

# ── 원본 눈 칸 8배 vs 새 설원 ──────────────────────────────────────────────────
world = rgb(ROOT / 'public' / 'assets' / 'easyrpg-chipset-world.png')
snow_orig = up(world.crop((10 * 16, 6 * 16, 11 * 16, 7 * 16)), 8)
snow_new = up(d1.crop((300, 40, 300 + 16 * 4, 40 + 16 * 4)), 4)
sn_row = Image.new('RGB', (128 + 10 + 256, 256), (21, 24, 29))
sn_row.paste(snow_orig, (0, 0)); sn_row.paste(snow_new, (138, 0))

STAT = {'resolved': ('해결', 'ok'), 'partial': ('일부', 'mid'), 'remaining': ('남음', 'no')}
rows = []
for m in ms['items']:
    lab, cl = STAT[m['status']]
    rows.append(f'<tr><td class="n">{m["id"]}</td><td class="{cl}">{lab}</td><td>{html.escape(m["need"])}</td><td class="c">{m["count"]}</td>'
                f'<td class="nt">{html.escape(m.get("resolvedBy", ""))}<br><span class="ev">{html.escape(m.get("evidence", ""))}</span></td></tr>')
n_ok = sum(1 for m in ms['items'] if m['status'] == 'resolved')
n_mid = sum(1 for m in ms['items'] if m['status'] == 'partial')
n_no = sum(1 for m in ms['items'] if m['status'] == 'remaining')
table = ('<table><thead><tr><th>#</th><th>상태</th><th>필요했던 것</th><th>칸</th><th>어떻게 풀었나</th></tr></thead><tbody>'
         + ''.join(rows) + '</tbody></table>')

qa = []
for f, cap in (('round1-snow-before-after.png', '1차: 눈 지대 (앞 / 뒤)'), ('round2-river-road-before-after.png', '2차: 강·길·다리 (v1 / v2)'),
               ('round2-desert-dirt-before-after.png', '2차: 사막·흙 지대 (v1 / v2)'), ('round3-snow-melt-before-after.png', '3차: 눈↔풀 녹은 테 (v1 / v2)')):
    p = HERE / 'qa' / f
    if p.exists():
        qa.append(fig(rgb(p), cap))


# ── 3단계 확대 비교 ───────────────────────────────────────────────────────────
def crop_pair(im_a, im_b, box, sc, la, lb):
    x0, y0, x1, y1 = [v * 16 for v in box]
    a = up(im_a.crop((x0, y0, x1, y1)), sc); b = up(im_b.crop((x0, y0, x1, y1)), sc)
    return (f'<div class="pair"><figure><img src="{uri(a)}"><figcaption>{la}</figcaption></figure>'
            f'<figure><img src="{uri(b)}"><figcaption>{lb}</figcaption></figure></div>')


# 산: 원본 산 킷(3x4칸) 6배 vs 새 지도 산 덩어리 6배
kx, ky = 3, 12
orig_kit = up(world.crop((kx * 16, ky * 16, (kx + 3) * 16, (ky + 4) * 16)), 6)
new_mt = up(d1.crop((47 * 16, 13 * 16, 53 * 16, 19 * 16)), 6)
mt_row = Image.new('RGB', (orig_kit.width + 12 + new_mt.width, max(orig_kit.height, new_mt.height)), (21, 24, 29))
mt_row.paste(orig_kit, (0, 0)); mt_row.paste(new_mt, (orig_kit.width + 12, 0))
sec_peaks = fig(mt_row, '왼쪽 = 원본 World.png 산 킷 (3x4칸) 6배: 작은 직사각 덩어리로 쌓는다. 오른쪽 = 새 지도의 산 덩어리 6배: 같은 문법(1칸 산 조각을 직사각 덩어리로), 큰 봉우리 오버레이 없음.')
sec_peaks += crop_pair(o1, d1, (42, 10, 58, 34), 2, '2단계: 산 위에 큰 봉우리·피라미드를 얹은 촘촘한 격자', '3단계: 원본 문법의 산 덩어리 + 고원')
sec_sea = crop_pair(o1, d1, (14, 0, 30, 6), 8, '전: 눈 땅 가장자리에 흰 물결선(물 세트 col 3~5) 띠', '후: 흰 선 제거 — 바다 킷 col 0 그대로, 땅 쪽만 눈으로 칠함')
sec_hl = (crop_pair(o1, d1, (3, 12, 20, 26), 3, '2단계: 같은 자리(평지)', '3단계: 서쪽 2단 고원 — 계단 2곳, 윗단에 마을')
          + crop_pair(o1, d1, (34, 12, 50, 24), 3, '2단계: 같은 자리(평지)', '3단계: 중앙 고원 — 발치 계단, 윗면에 폐허')
          + crop_pair(o1, d1, (6, 29, 20, 39), 4, '2단계: 같은 자리(평지)', '3단계: 사막 흙 고원 — 경사로, 윗면에 동굴 길'))
PAGE = f'''<!doctype html><html lang="ko"><head><meta charset="utf-8"><title>월드맵 설계 데모 3단계</title>
<meta name="viewport" content="width=device-width,initial-scale=1"><style>
body{{background:#15181d;color:#dfe5ee;font:14px/1.55 -apple-system,"Noto Sans KR",sans-serif;margin:0;padding:20px 24px 60px;max-width:2120px}}
h1{{font-size:22px;margin:0 0 4px}} h2{{font-size:17px;margin:34px 0 8px;border-bottom:1px solid #2c333d;padding-bottom:4px}} h3{{font-size:14px;margin:18px 0 6px;color:#cfd8e4}}
p,li{{color:#b9c2cf}} .sub{{color:#8b96a5}} b{{color:#fff}}
figure{{margin:8px 0 18px}} figcaption{{color:#8b96a5;font-size:13px;margin-top:6px}}
img{{image-rendering:pixelated;max-width:100%;height:auto;border:1px solid #2c333d}}
.pair{{display:grid;grid-template-columns:1fr 1fr;gap:12px}} @media(max-width:1200px){{.pair{{grid-template-columns:1fr}}}}
.cells{{display:flex;flex-wrap:wrap;gap:3px}} img.cell{{border:2px solid #ff9a3c;background:repeating-conic-gradient(#2a3038 0 25%,#1d2229 0 50%) 0 0/16px 16px;width:64px;height:64px}} img.cell.re{{border-color:#7CFF9B}}
table{{border-collapse:collapse;width:100%;font-size:12.5px}} th,td{{border-bottom:1px solid #2c333d;padding:4px 8px;text-align:left;vertical-align:top}}
th{{color:#8b96a5;font-weight:600}} td.n,td.c{{text-align:right;color:#fff}} td.nt{{color:#b9c2cf}} .ev{{color:#8b96a5}}
td.ok{{color:#7CFF9B}} td.mid{{color:#ffd54a}} td.no{{color:#ff7a7a}}
.attr{{margin-top:34px;padding:10px 14px;border:1px solid #2c333d;border-radius:6px;font-size:12.5px;color:#8b96a5}}
.lg span{{margin-right:14px}} .sw{{display:inline-block;width:12px;height:12px;vertical-align:-1px;margin-right:4px}}
</style></head><body>
<h1>월드맵 설계 데모 3단계 — 봉우리 다시 쌓기 · 북쪽 흰 선 제거 · 고원 (64×48칸)</h1>
<p class="sub">피드백 세 가지를 고쳤다. (1) 큰 봉우리 오버레이가 어색했다 → 없애고 원본 World 산 킷 문법(1칸 산 조각을 작은 직사각 덩어리로)으로 다시 쌓았다.
(2) 북쪽 눈 땅을 둘러싼 물의 흰 선이 어색했다 → 물 세트 col 3~5(흰 물결·고드름 띠)는 아예 쓰지 않고, 일반 바다 킷 col 0 그대로 두고 땅 쪽만 눈색으로 칠했다.
(3) 고지대를 요청받아 원본 팔레트만으로 고원 3곳(서쪽 2단·중앙·사막 흙 고원)을 손 도트로 그렸다: 윗면 변형, 북/좌/우 가장자리 3변형, 앞 벽, 둥근/파인 모서리, 계단, 경사로, 벽 밑 그림자. 생성 이미지·트레이싱 없음.
새 칸 시트 {cnt['total']}개(2단계 293개; 봉우리 18칸 삭제, 고원 38칸 추가) = 원본 조각 재조립 {cnt['reassembly']} + 손 도트 {cnt['handpixel']}. 비움 목록 {ms['count']}건 중 해결 {n_ok} / 일부 {n_mid} / 남음 {n_no}.</p>

<h2>1. 새 설계 지도 (2배)</h2>
{fig(d2, '64×48칸. 고원 3곳(서 2단, 중앙, 남서 사막)과 그 위 마을·망루·폐허·동굴, 계단·경사로로 이어지는 길.')}

<h2>2. 2단계 vs 3단계 (1배 1024×768)</h2>
<div class="pair">{fig(o1, '2단계: 큰 봉우리 격자, 눈 땅을 두른 흰 물결선, 평지뿐.')}{fig(d1, '3단계: 산 덩어리, 흰 선 없음, 고원 3곳.')}</div>

<h2>3. 봉우리: 원본 산 vs 새 산</h2>
{sec_peaks}

<h2>4. 북쪽 해안: 흰 선 제거 (8배, 전 / 후)</h2>
{sec_sea}

<h2>5. 고원 확대 (전 / 후)</h2>
{sec_hl}

<h2>6. 눈 지대: 원본 눈 칸 8배 vs 새 설원 4배</h2>
{fig(sn_row, '왼쪽 = 원본 World.png 눈 칸(10,6) 8배, 오른쪽 = 새 설원 일부 4배. 원본의 옅은 체크 결 위에 청록 음영 얼룩·균열·눈더미를 얹었다.')}
<h3>눈 지대 확대: 전(왼쪽) / 후(오른쪽), 3배</h3>
{cmp_pair((100, 10, 400, 260), 3, '2단계', '3단계')}

<h2>7. 새로 만든 칸 (4배) — 초록 테두리 = 원본 조각 재조립, 주황 테두리 = 손 도트</h2>
<p class="sub">시트 <code>world-plus-terrain.png</code> (480×192, 재조립 {cnt['reassembly']} / 손 도트 {cnt['handpixel']}). 칸에 마우스를 올리면 이름이 나온다.</p>
{"".join(cells_html)}

<h2>8. 적대적 검수 전후</h2>
{"".join(qa)}

<h2>9. 어색한 자리 22건의 처리 결과</h2>
{table}

<div class="attr">원본 지형·아이콘은 EasyRPG RTP <code>ChipSet/World.png</code> (CC BY 4.0). <code>world-plus*.png</code> 는 그 수정본이고, <code>world-plus-terrain.png</code> 는 원본 조각 재조립과 원본 팔레트 손 도트로 더한 새 칸이다.
출처 표기: <code>tiledata/atlas-pick/worldmap-easyrpg-plus/ATTRIBUTION-NOTE.md</code>. 스크립트: <code>design-map/make_design_map.py</code>, <code>make_terrain_sheet.py</code>, <code>make_design_page.py</code>.</div>
</body></html>'''

Path(OUT).parent.mkdir(parents=True, exist_ok=True)
Path(OUT).write_text(PAGE, encoding='utf-8')
print('wrote', OUT, len(PAGE) // 1024, 'KB')
