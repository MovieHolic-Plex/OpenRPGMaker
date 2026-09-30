#!/usr/bin/env python3
"""월드맵 설계 데모 1단계 비교 페이지(자체완결 HTML). 이미지는 data URI, 주석은 SVG(칸 단위 viewBox).
  python3 make_design_page.py [출력경로]   기본 ~/claude-viz/worldmap-design.html
먼저 make_design_map.py 를 돌려 map.json / design-*.png / missing.json 을 만들어 둔다.
"""
import base64, html, io, json, os, sys
from pathlib import Path

import numpy as np
from PIL import Image

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[3]
sys.path.insert(0, str(HERE))
sys.path.insert(0, str(ROOT / 'scripts' / 'content' / 'atlas-pick'))
import make_design_map as dm  # noqa: E402
import worldmap_easyrpg_plus as wm  # noqa: E402

OUT = sys.argv[1] if len(sys.argv) > 1 else os.path.expanduser('~/claude-viz/worldmap-design.html')
W, H = dm.W, dm.H


def uri(im):
    b = io.BytesIO(); im.save(b, 'PNG', optimize=True)
    return 'data:image/png;base64,' + base64.b64encode(b.getvalue()).decode()


d1 = Image.open(HERE / 'design-1x.png').convert('RGB')
d2 = Image.open(HERE / 'design-2x.png').convert('RGB')
mp = json.loads((HERE / 'map.json').read_text())
ms = json.loads((HERE / 'missing.json').read_text())

# 옛 무작위 지도(같은 시트, 같은 렌더러, 옛 40x30 시드 7 + 광장 + 아이콘)
sh = wm.Sheet(wm.PLUS)
t_old = wm.carve(wm.make_map(7))
meta = json.loads(wm.EXT_JSON.read_text())
ext_arr = np.array(Image.open(wm.EXT).convert('RGB'), np.uint8)
old1 = Image.fromarray(wm.overlay(wm.render(sh, t_old, 0), sh.a, ext_arr, meta, with_ext=True))
old2 = old1.resize((old1.width * 2, old1.height * 2), Image.NEAREST)

# ── SVG 도우미 (좌표 = 칸, 칸 중심은 +0.5) ────────────────────────────────────
def pts(p, half=True):
    o = 0.5 if half else 0
    return ' '.join(f'{x + o:.2f},{y + o:.2f}' for x, y, *_ in p)


def svg(inner, cls=''):
    return (f'<svg class="ov {cls}" viewBox="0 0 {W} {H}" preserveAspectRatio="none" '
            f'xmlns="http://www.w3.org/2000/svg">{inner}</svg>')


def label(x, y, s, cls='lb', anchor='middle'):
    return f'<text x="{x:.2f}" y="{y:.2f}" class="{cls}" text-anchor="{anchor}">{html.escape(s)}</text>'


def annotation():
    o = []
    # 기후대(반투명 면) — 눈 지대 윗줄, 사막·늪
    o.append(f'<polygon points="{pts(dm.SNOW_ZONE, False)}" fill="#8fd8ff" fill-opacity=".16" stroke="#8fd8ff" stroke-width=".12" stroke-dasharray=".5 .3"/>')
    for k, p in dm.SAND_ZONES.items():
        o.append(f'<polygon points="{pts(p, False)}" fill="#ffd54a" fill-opacity=".18" stroke="#ffd54a" stroke-width=".12" stroke-dasharray=".5 .3"/>')
    for k, p in dm.MARSH_ZONES.items():
        o.append(f'<polygon points="{pts(p, False)}" fill="#d38cff" fill-opacity=".22" stroke="#d38cff" stroke-width=".12"/>')
    o.append(label(32, 3.6, '북: 설원 (눈 숲 무리 3개)', 'lb c1'))
    o.append(label(15, 40.5, '남서: 사막', 'lb c2'))
    o.append(label(51, 42, '남동: 사막', 'lb c2'))
    o.append(label(29.5, 39.2, '늪', 'lb c3'))
    o.append(label(38.8, 37.3, '늪', 'lb c3'))
    # 능선
    for name, r, tx, ty in (('산맥 A', dm.RIDGE_A, 15.5, 11.6), ('산맥 B', dm.RIDGE_B, 55.6, 18.5)):
        o.append(f'<polyline points="{pts(r)}" fill="none" stroke="#ff9a3c" stroke-width=".55" stroke-linecap="round" stroke-linejoin="round" stroke-opacity=".8"/>')
        o.append(label(tx, ty, name, 'lb c4'))
    # 강·지류·호수
    o.append(f'<polyline points="{pts(dm.RIVER)}" fill="none" stroke="#39c5ff" stroke-width=".5" stroke-linecap="round" stroke-linejoin="round" stroke-opacity=".9"/>')
    o.append(f'<polyline points="{pts(dm.TRIBUTARY)}" fill="none" stroke="#39c5ff" stroke-width=".35" stroke-linecap="round" stroke-linejoin="round" stroke-opacity=".9"/>')
    o.append(f'<polygon points="{pts(dm.LAKE)}" fill="#39c5ff" fill-opacity=".25" stroke="#39c5ff" stroke-width=".12"/>')
    o.append(label(27, 24.6, '강 (발원→하구)', 'lb c5', 'end'))
    o.append(label(43.5, 27.2, '호수', 'lb c5'))
    o.append(label(36.5, 27.5, '지류', 'lb c5'))
    # 길(의도, 점선) — 시트에 길 타일이 없어 실제 지도에는 그려지지 않는다
    for n, p in dm.ROADS:
        o.append(f'<polyline points="{pts(p)}" fill="none" stroke="#ffffff" stroke-width=".22" stroke-dasharray=".45 .35" stroke-opacity=".85"/>')
    # 장소
    for s in mp['sites']:
        cx, cy = s['x'] + s['w'] / 2, s['y'] + s['h'] / 2
        o.append(f'<rect x="{s["x"]}" y="{s["y"]}" width="{s["w"]}" height="{s["h"]}" fill="none" stroke="#7CFF9B" stroke-width=".14"/>')
        o.append(label(cx, s['y'] - 0.35, s['name'], 'lb c6'))
    return svg(''.join(o))


def missing_board():
    o = []
    for m in ms['items']:
        cells = m['at']
        for x, y in cells:
            o.append(f'<circle cx="{x + .5}" cy="{y + .5}" r=".42" fill="#ff2d2d" fill-opacity=".55"/>')
        xs = sorted(c[0] for c in cells); ys = sorted(c[1] for c in cells)
        mx, my = xs[len(xs) // 2] + .5, ys[len(ys) // 2] + .5
        o.append(f'<circle cx="{mx}" cy="{my}" r="1.15" fill="none" stroke="#ff2d2d" stroke-width=".22"/>')
        o.append(f'<text x="{mx}" y="{my + .42}" class="lb num" text-anchor="middle">{m["id"]}</text>')
    return svg(''.join(o), 'miss')


KIND_KO = {'road': '길', 'bridge': '다리', 'river': '강 몸통·둑', 'river_mouth': '강 하구', 'river_source': '강 발원',
           'cliff': '절벽·고원 끝', 'ridge_end': '산맥 끝(경사)', 'mountain_snow_seam': '산↔설원 이음',
           'shallow_sea': '얕은 바다 단계', 'desert_grass_seam': '사막↔풀 이음', 'snow_forest_seam': '눈↔숲 이음',
           'snow_rim': '눈 가장자리 녹색 테', 'marsh_water': '늪↔물 이음', 'site_ground': '장소 밑바닥'}
YES = {'yes': ('원본 조각으로 가능', 'ok'), 'partial': ('일부만 가능', 'mid'), 'no': ('불가(새로 그려야 함)', 'no')}


def missing_table():
    rows = []
    for m in ms['items']:
        lab, cl = YES[m['fromOriginalModules']]
        ex = ', '.join(f'({x},{y})' for x, y in m['at'][:3]) + (' …' if len(m['at']) > 3 else '')
        rows.append(f'<tr><td class="n">{m["id"]}</td><td>{KIND_KO.get(m["kind"], m["kind"])}</td>'
                    f'<td>{html.escape(m["need"])}</td><td class="c">{m["count"]}</td><td class="{cl}">{lab}</td>'
                    f'<td class="ex">{ex}</td><td class="nt">{html.escape(m["note"])}</td></tr>')
    return ('<table><thead><tr><th>#</th><th>종류</th><th>필요한 타일</th><th>칸</th><th>원본 모듈로?</th><th>자리(예)</th><th>메모</th></tr></thead><tbody>'
            + ''.join(rows) + '</tbody></table>')


def fig(im, svg_html='', cap='', cls=''):
    return (f'<figure class="{cls}"><div class="wrap"><img src="{uri(im)}" width="{im.width}" height="{im.height}">{svg_html}</div>'
            f'<figcaption>{cap}</figcaption></figure>')


by_kind = {}
for m in ms['items']:
    by_kind.setdefault(m['fromOriginalModules'], 0)
    by_kind[m['fromOriginalModules']] += 1

sites_rows = ''.join(f'<tr><td>{html.escape(s["name"])}</td><td>({s["x"]},{s["y"]}) {s["w"]}×{s["h"]}</td><td>{html.escape(s["note"])}</td></tr>' for s in mp['sites'])

PAGE = f'''<!doctype html><html lang="ko"><head><meta charset="utf-8"><title>월드맵 설계 데모 1단계</title>
<meta name="viewport" content="width=device-width,initial-scale=1"><style>
body{{background:#15181d;color:#dfe5ee;font:14px/1.55 -apple-system,"Noto Sans KR",sans-serif;margin:0;padding:20px 24px 60px;max-width:2120px}}
h1{{font-size:22px;margin:0 0 4px}} h2{{font-size:17px;margin:34px 0 8px;border-bottom:1px solid #2c333d;padding-bottom:4px}}
p,li{{color:#b9c2cf}} .sub{{color:#8b96a5}} b{{color:#fff}}
figure{{margin:8px 0 18px}} figcaption{{color:#8b96a5;font-size:13px;margin-top:6px}}
.wrap{{position:relative;display:inline-block;max-width:100%;line-height:0}}
.wrap img{{image-rendering:pixelated;display:block;max-width:100%;height:auto;border:1px solid #2c333d}}
.wrap svg.ov{{position:absolute;left:0;top:0;width:100%;height:100%;pointer-events:none}}
.lb{{font:.85px "Noto Sans KR",sans-serif;font-weight:700;paint-order:stroke;stroke:#000;stroke-width:.22px;stroke-linejoin:round;fill:#fff}}
.c1{{fill:#8fd8ff}} .c2{{fill:#ffd54a}} .c3{{fill:#e2b0ff}} .c4{{fill:#ffb066}} .c5{{fill:#7fdcff}} .c6{{fill:#7CFF9B;font-size:.8px}} .num{{fill:#fff;font-size:1.25px}}
table{{border-collapse:collapse;width:100%;font-size:12.5px}} th,td{{border-bottom:1px solid #2c333d;padding:4px 8px;text-align:left;vertical-align:top}}
th{{color:#8b96a5;font-weight:600;position:sticky;top:0;background:#15181d}} td.n,td.c{{text-align:right;color:#fff}} td.ex{{white-space:nowrap;color:#8b96a5}} td.nt{{color:#8b96a5}}
td.ok{{color:#7CFF9B}} td.mid{{color:#ffd54a}} td.no{{color:#ff7a7a}}
.grid2{{display:grid;grid-template-columns:1fr 1fr;gap:20px}} @media(max-width:1200px){{.grid2{{grid-template-columns:1fr}}}}
.legend span{{display:inline-block;margin-right:14px}} .dot{{display:inline-block;width:12px;height:12px;border-radius:50%;vertical-align:-1px;margin-right:4px}}
.attr{{margin-top:34px;padding:10px 14px;border:1px solid #2c333d;border-radius:6px;font-size:12.5px;color:#8b96a5}}
</style></head><body>
<h1>월드맵 설계 데모 1단계 — 손으로 설계한 {W}×{H}칸</h1>
<p class="sub">EasyRPG World 개선판 시트(<code>world-plus.png</code> + <code>world-plus-ext.png</code>)를 한 칸도 바꾸지 않고, <b>배치만</b> 손으로 설계했다. 무작위 생성기 없음, 생성 이미지 없음.
길·다리·강 몸통·얕은 바다 같은 <b>시트에 없는 것은 그리지 않고</b> 아래 「없어서 어색한 자리」에 좌표로 남긴다(2단계 입력).</p>

<h2>1. 설계 지도 (2배)</h2>
{fig(d2, cap=f"{W}×{H}칸 = 게임 화면 기준 1024×768(1배). 산맥 2줄 + 강·지류·호수, 북 설원 / 남 사막 / 중앙 평야, 하구 늪, 곶·만·섬 3개, 장소 {len(mp['sites'])}곳.")}

<h2>2. 옛 무작위 지도 (2배) — 비교</h2>
{fig(old2, cap="같은 시트·같은 렌더러, 40×30 노이즈 지도. 산이 삼각형 카펫, 숲·늪은 덩어리, 아이콘은 광장 세 곳에 모아 흩뿌림. (칸 수가 달라 실제 화면 폭은 이쪽이 더 좁다)")}

<h2>3. 주석판 — 무엇을 설계했나</h2>
<p class="legend"><span><i class="dot" style="background:#ff9a3c"></i>산맥 능선</span><span><i class="dot" style="background:#39c5ff"></i>강·지류·호수</span><span><i class="dot" style="background:#8fd8ff"></i>설원</span><span><i class="dot" style="background:#ffd54a"></i>사막</span><span><i class="dot" style="background:#d38cff"></i>늪</span><span><i class="dot" style="background:#7CFF9B"></i>장소(윤곽)</span><span><i class="dot" style="background:#fff"></i>길 의도(점선, 실제로는 미표시)</span></p>
{fig(d2, annotation(), cap="반투명 선·면은 이 페이지에서만 얹은 주석이다(지도 그림에는 없음). 강은 산맥 A 끝에서 발원해 만으로 흐르고, 대성은 그 발원지 아래 강가 평야에 앉는다.")}

<h2>4. 없어서 어색한 자리 — 빨간 원 ({ms['count']}건)</h2>
<p>원본 모듈로 가능 {by_kind.get('yes', 0)} · 일부만 가능 {by_kind.get('partial', 0)} · 불가 {by_kind.get('no', 0)}. 번호는 아래 표와 같다.</p>
{fig(d2, missing_board(), cap="빨간 점 = 해당 칸, 번호 원 = 그 항목의 대표 자리. 길(1·2·4·6·8·9·10)은 시트에 길 타일이 없어 지도에 비어 있고, 다리(3·5·7)는 길이 물을 건너는 자리다.")}
{missing_table()}

<h2>5. 1배 (게임에서 보이는 크기)</h2>
{fig(d1, cap=f"{d1.width}×{d1.height}px. 위 설계 지도 그대로.")}
<div class="grid2"><div><h2>장소 목록</h2><table><thead><tr><th>장소</th><th>칸</th><th>왜 거기</th></tr></thead><tbody>{sites_rows}</tbody></table></div>
<div><h2>옛 지도 1배</h2>{fig(old1, cap="비교용 (40×30).")}</div></div>

<div class="attr">원본 지형·아이콘은 EasyRPG RTP <code>ChipSet/World.png</code> (CC BY 4.0). 개선판(<code>world-plus*.png</code>)은 그 수정본이며 이 데모는 시트를 바꾸지 않고 배치만 했다.
출처 표기: <code>tiledata/atlas-pick/worldmap-easyrpg-plus/ATTRIBUTION-NOTE.md</code>. 스크립트: <code>design-map/make_design_map.py</code>, <code>make_design_page.py</code>.</div>
</body></html>'''

Path(OUT).parent.mkdir(parents=True, exist_ok=True)
Path(OUT).write_text(PAGE, encoding='utf-8')
print('wrote', OUT, len(PAGE) // 1024, 'KB')
