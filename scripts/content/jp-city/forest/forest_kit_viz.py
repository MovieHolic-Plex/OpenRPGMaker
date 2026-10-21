#!/usr/bin/env python3
"""숲 팩 현재 상태 페이지 → ~/claude-viz/jp-forest-kit-<판>.html (+ 같은 이름 폴더에 그림). 최신 상태만 보인다.

  python3 scripts/content/jp-city/forest/forest_kit_viz.py [--round 1]
      [--regions-before DIR --regions-after DIR] [--inaka-before DIR --inaka-after DIR]
그림 출처: tiledata/jp-city/forest-proto/(시제품 장면·Argon 점수), tiledata/jp-city/blocks/jp_forest_pack/(조각 시트·관문 그림),
지도 전후는 scripts/qa/jp-forest-preview.mts 출력 폴더(임시 굽기 루트로 그린 것).
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
PROTO = ROOT / 'tiledata' / 'jp-city' / 'forest-proto'
BLOCK = ROOT / 'tiledata' / 'jp-city' / 'blocks' / 'jp_forest_pack'
VIZ = Path.home() / 'claude-viz'


def arg(n, d=None):
    return sys.argv[sys.argv.index('--' + n) + 1] if '--' + n in sys.argv else d


rnd = arg('round', '1')
name = f'jp-forest-kit-{rnd}'
OUT = VIZ / name
if OUT.exists():
    shutil.rmtree(OUT)          # 최신 상태만 — 옛 그림을 남기지 않는다
OUT.mkdir(parents=True)
ver = str(int(time.time()))


def put(src, dst, scale=1):
    im = Image.open(src)
    if scale != 1:
        im = im.resize((im.width * scale, im.height * scale), Image.NEAREST)
    im.save(OUT / dst)
    return f'{name}/{dst}?v={ver}'


def pair(title, a, b, la='전', lb='후', note=''):
    return (f'<div class="pair"><h4>{html.escape(title)}</h4>{note}<div class="ab">'
            f'<figure><img src="{a}"><figcaption>{la}</figcaption></figure>'
            f'<figure><img src="{b}"><figcaption>{lb}</figcaption></figure></div></div>')


sec = []

# 1) 상태
sec.append('''<section class="status"><h2>상태</h2><ul>
<li><b>3/4 관문 미통과 — 보정 대기.</b> object-gate 프로필 <code>ee216f0de5822996</code> 미보정. 대표 23조각: 3/4 판정 23/23 ok, 화풍 23/23 FAIL(「칸 정보량이 기준보다 훨씬 낮음」). 그림 머지 보류.</li>
<li>저장소 시트(<code>public/assets/jp-city/…</code>)에는 <b>굽지 않았다</b>. 아래 지도는 임시 굽기 루트(<code>bake_jp.bake(/tmp/…)</code>)로 그린 미리보기다. 굽기 시험: 칸 19,058 · 계약 밖 색 0 · 옛 칸 17,053 이동 0.</li>
<li>시골(inaka) 맵 다시 짓기는 #3071 브랜치에서, 숲 팩이 들어갈 수 있게 된 뒤 한다. 지금은 미리보기만.</li>
<li>한 그루 느티나무·벚나무는 modern-tiles-r1 의 가로수(jp_street_trees, 사용자 허용)를 쓴다 — 여기서 다시 그리지 않는다. 이 팩은 숲 덩이(활엽·대숲·벚나무·삼나무·단풍)와 삼나무 한 그루만.</li>
</ul></section>''')

# 2) Argon 판정
ar = json.load(open(PROTO / 'argon-rounds.json', encoding='utf-8'))
rows = []
for rname, r in ar['rounds'].items():
    cells = ''.join(f'<td>{html.escape(str(r.get(k, {}).get("score", "-")))}</td>' for k in ('dense', 'edge', 'bamboo', 'light'))
    rows.append(f'<tr><th>{html.escape(rname)}</th>{cells}</tr>')
last = list(ar['rounds'].values())[-1]
tops = ''.join(f'<li><b>{k}</b>: {html.escape(" / ".join(v.get("top", [])[:2]))}</li>' for k, v in last.items())
sec.append(f'''<section><h2>적대적 Argon 판정 ({html.escape(ar["judge"])})</h2>
<p>4배 사분면 확대를 버들항 숲 확대와 나란히, 10점 만점. 모든 판 FAIL — 점수는 오르는 방향만 본다.</p>
<table><tr><th>판</th><th>빽빽한 숲</th><th>숲 가장자리</th><th>대숲</th><th>성긴 숲</th></tr>{"".join(rows)}</table>
<p>마지막 판 주요 지적:</p><ul>{tops}</ul></section>''')

# 3) 시제품 장면 옛/새
scenes = []
for s, ko in (('dense', '빽빽한 숲'), ('edge', '숲 가장자리·얕은 띠'), ('bamboo', '대숲'), ('light', '성긴 숲')):
    o, n = PROTO / f'scene-{s}-old-x3.png', PROTO / f'scene-{s}-new-x3.png'
    if o.exists() and n.exists():
        scenes.append(pair(ko, put(o, f'scene-{s}-old.png'), put(n, f'scene-{s}-new.png'), '지금(main) 숲', '숲 팩'))
ref = PROTO / 'ref-beodeul-forest-x4.png'
crop = PROTO / 'proto-dense-crop-x4.png'
if ref.exists() and crop.exists():
    scenes.append(pair('같은 배율(4배) — 버들항 기준 vs 숲 팩', put(ref, 'ref-beodeul.png'), put(crop, 'proto-crop.png'), '버들항 숲', '숲 팩'))
sec.append('<section><h2>시제품 장면 (3배)</h2>' + ''.join(scenes) + '</section>')

# 4) 조각 시트
if (BLOCK / '_all-x2.png').exists():
    sec.append(f'<section><h2>조각 시트 (2배) — 활엽·대숲·벚나무·삼나무·단풍</h2><p>수관 오토타일 8방 47칸 + 몸통 변형, 머리(3층)·머리 덧그림(4층), 하늘선, 줄기 띠, 한 그루. 칸 2,005 · 오토타일 5 · 키트 404.</p>'
               f'<img class="sheet" src="{put(BLOCK / "_all-x2.png", "sheet.png")}"></section>')

# 5) 지도 전후
def maps(title, bdir, adir, note):
    if not (bdir and adir):
        return ''
    bdir, adir = Path(bdir), Path(adir)
    out = []
    for a in sorted(adir.glob('*.png')):
        b = bdir / a.name
        if not b.exists():
            continue
        out.append(pair(a.stem, put(b, f'{title}-{a.stem}-before.png'), put(a, f'{title}-{a.stem}-after.png'), '지금', '숲 팩'))
    return f'<section><h2>{html.escape(note)}</h2>' + ''.join(out) + '</section>'


sec.append(maps('region', arg('regions-before'), arg('regions-after'),
                '일본 지역 맵 — 숲 구획을 숲 팩으로 (regionComposer: 마스크 → 수관 오토타일 → 하늘선 → 머리 → 줄기 띠)'))
sec.append(maps('inaka', arg('inaka-before'), arg('inaka-after'),
                '시골(inaka) 쇼케이스 — 나무 무리(30칸 이상) → 숲, 외딴 삼나무 → 새 삼나무 한 그루, 공원 느티·벚나무는 그대로'))

sec.append('''<section><h2>남은 약점 (눈 판정)</h2><ul>
<li>넓은 숲 구획은 한 종류 한 덩이라 단조롭다 — 신사 경내의 소나무·단풍 섞임이 빨간 단풍 벽 하나로 바뀐다. 종류 섞기(덩이 안 반점)가 다음 일.</li>
<li>Argon 지적: 줄기 띠가 울타리처럼 곧다, 머리가 콜리플라워처럼 따로 논다, 16px 계단 가장자리, 대숲이 평평하다.</li>
<li>관문 화풍 FAIL — 「칸 정보량 낮음」. 버들항 대비 한 칸 안 명암 단이 적다.</li>
</ul></section>''')

page = f'''<!doctype html><html lang="ko"><meta charset="utf-8"><title>jp_city 숲 팩 — 현재 상태</title>
<style>
body{{background:#1d2026;color:#dde;font:14px/1.5 system-ui,sans-serif;margin:20px;max-width:1500px}}
h2{{border-bottom:1px solid #445;padding-bottom:4px;margin-top:32px}} h4{{margin:12px 0 4px}}
.status{{background:#2a2430;border-left:4px solid #c96;padding:4px 16px}}
img{{image-rendering:pixelated;max-width:100%}} .ab{{display:flex;gap:10px;flex-wrap:wrap}} figure{{margin:0;flex:1;min-width:300px}}
figcaption{{color:#99a;font-size:12px}} table{{border-collapse:collapse}} td,th{{border:1px solid #445;padding:3px 10px;text-align:center}}
.sheet{{border:1px solid #445}} code{{color:#fc9}}
</style><h1>jp_city 숲 팩 (PR #3058) — 현재 상태</h1><p>생성 {time.strftime("%Y-%m-%d %H:%M")} · 이 페이지는 최신 상태만 보여 준다.</p>
{"".join(sec)}</html>'''
(VIZ / f'{name}.html').write_text(page, encoding='utf-8')
print(VIZ / f'{name}.html')
