#!/usr/bin/env python3
"""숲 키트 시제품 비교 페이지 → ~/claude-viz/jp-forest-kit-<판>.html (+ 같은 이름 폴더에 그림).

  python3 scripts/content/jp-city/forest/forest_kit_viz.py [--round 1]
forest_kit_proto.py 를 먼저 돌려 tiledata/jp-city/forest-proto/ 에 그림이 있어야 한다.
"""
import html
import json
import shutil
import sys
import time
from pathlib import Path

from PIL import Image

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[3]
SRC = ROOT / 'tiledata' / 'jp-city' / 'forest-proto'
VIZ = Path.home() / 'claude-viz'

rnd = sys.argv[sys.argv.index('--round') + 1] if '--round' in sys.argv else '1'
name = f'jp-forest-kit-{rnd}'
OUT = VIZ / name
OUT.mkdir(parents=True, exist_ok=True)
ver = str(int(time.time()))

rep = json.load(open(SRC / 'report.json', encoding='utf-8'))
notes = json.load(open(SRC / 'notes.json', encoding='utf-8')) if (SRC / 'notes.json').exists() else {}

for p in SRC.glob('*.png'):
    shutil.copy(p, OUT / p.name)
for extra in (notes.get('extra_images') or []):
    src = Path(extra)
    if src.exists(): shutil.copy(src, OUT / src.name)


def img(fn, w=None, cls=''):
    im = Image.open(OUT / fn)
    ww = w or im.width
    return f'<img class="px {cls}" src="{name}/{fn}?v={ver}" width="{ww}" alt="{html.escape(fn)}">'


order = ['dense', 'bamboo', 'edge', 'light']
scene_html = []
for k in order:
    s = rep['scenes'][k]
    note = notes.get('scene', {}).get(k, '')
    W = Image.open(OUT / f'scene-{k}-new.png').width
    scene_html.append(f'''
<section>
<h2>{html.escape(s['name'])}</h2>
<p class="note">{note}</p>
<div class="pair">
 <figure><figcaption>지금(현재 키트·지금 숲 채우기 규칙)</figcaption>{img(f'scene-{k}-old.png', W)}</figure>
 <figure><figcaption>시제품 r{rnd}</figcaption>{img(f'scene-{k}-new.png', W)}</figure>
</div>
<details open><summary>3배</summary>
<div class="col">
 <figure><figcaption>지금 ×3</figcaption>{img(f'scene-{k}-old-x3.png')}</figure>
 <figure><figcaption>시제품 ×3</figcaption>{img(f'scene-{k}-new-x3.png')}</figure>
</div></details>
</section>''')

pieces = ''.join(f'<figure><figcaption>{c}</figcaption>{img(f)}</figure>' for f, c in (
    ('broadleaf-pieces-x3.png', '활엽 조각(×3): 수관 오토타일 canon 47 · 몸통 변형 8 · 줄기 띠 · 수관 머리 키트 · 하늘선 키트 · 한 그루 나무'),
    ('bamboo-pieces-x3.png', '대숲 조각(×3): 수관 오토타일 canon 47 · 몸통 변형 8 · 줄기 벽(2칸) · 햇빛 잎 다발 키트'),
) if (OUT / f).exists())

ref = ''
if (OUT / 'ref-beodeul-forest-x4.png').exists():
    ref = f'<figure><figcaption>기준: 버들항 숲(같은 배율 ×4)</figcaption>{img("ref-beodeul-forest-x4.png")}</figure>'
if (OUT / 'proto-dense-crop-x4.png').exists():
    ref += f'<figure><figcaption>시제품 빽빽한 숲(×4)</figcaption>{img("proto-dense-crop-x4.png")}</figure>'

diag = notes.get('diagnosis', '')
gate = notes.get('gate', '')
judge = notes.get('judge', '')
counts = rep.get('piece_cells', {})
cpc = rep.get('colors_per_cell', {})

page = f'''<!doctype html><html lang="ko"><head><meta charset="utf-8">
<title>jp_city 숲 키트 r{rnd} — 지금 vs 시제품</title>
<style>
body{{background:#1d1f24;color:#e6e6e6;font:15px/1.55 system-ui,"Noto Sans KR",sans-serif;margin:24px;max-width:1700px}}
h1{{font-size:22px}} h2{{font-size:18px;margin-top:34px;border-top:1px solid #444;padding-top:14px}}
.px{{image-rendering:pixelated;image-rendering:crisp-edges;display:block;max-width:100%;height:auto}}
.pair{{display:flex;gap:18px;flex-wrap:wrap}} .col{{display:flex;flex-direction:column;gap:14px}}
figure{{margin:0}} figcaption{{color:#aab;font-size:13px;margin:4px 0}}
.note{{color:#cfd3da}} .box{{background:#262a31;border:1px solid #3a3f48;padding:12px 16px;border-radius:6px;margin:12px 0}}
code{{background:#30343c;padding:1px 4px;border-radius:3px}} table{{border-collapse:collapse}} td,th{{border:1px solid #444;padding:4px 8px}}
.warn{{color:#ffcf7a}}
</style></head><body>
<h1>jp_city 숲 키트 시제품 r{rnd} — 지금 숲 vs 이어지는 수관 키트</h1>
<div class="box">
<b>무엇을 보면 되나</b>: 각 장면에서 왼쪽(지금)과 오른쪽(시제품)을 같은 배율로 보고, ① 빽빽한 숲이 한 덩어리 숲으로 읽히는지 ② 잎 결이 「동글동글」하지 않은지 ③ 대숲이 대숲으로 읽히는지 판단하면 된다.
<span class="warn">시제품이다 — 시트에 굽지 않았고 번들·지도에 들어가지 않는다. 3/4 관문(object-gate) 미통과.</span>
</div>
<div class="box"><b>진단</b><br>{diag}</div>
{''.join(scene_html)}
<section><h2>기준 대비(같은 배율)</h2><div class="pair">{ref}</div></section>
<section><h2>조각</h2><p class="note">칸 수(중복 제거, 16px 칸): 활엽 {counts.get('broadleaf')} · 대숲 {counts.get('bamboo')}. 칸당 색 수: {html.escape(json.dumps(cpc, ensure_ascii=False))}</p>{pieces}</section>
<section><h2>적대적 검수·관문</h2><div class="box">{judge}</div><div class="box">{gate}</div></section>
</body></html>'''
(VIZ / f'{name}.html').write_text(page, encoding='utf-8')
print(VIZ / f'{name}.html')
