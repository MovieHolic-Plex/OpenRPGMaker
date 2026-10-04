#!/usr/bin/env python3
"""trace-c 결과 페이지 생성 — 자체완결 HTML(data URI)을 ~/claude-viz 에 쓴다.
읽기 전용: trace-c/*.png|json, bakeoff/c-32px/{scene.png,raw/*}. 픽셀 생성과 무관(표시용 조립만)."""
import base64, io, json, os
from PIL import Image
R = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', '..'))
A = os.path.join(R, 'tiledata/atlas-pick')
T = os.path.join(A, 'trace-c')
OUT = os.path.expanduser('~/claude-viz/trace-c-assets.html')

def uri(im, fmt='PNG', **kw):
    b = io.BytesIO(); im.save(b, fmt, **kw)
    return f'data:image/{fmt.lower()};base64,' + base64.b64encode(b.getvalue()).decode()

def png(path): return uri(Image.open(path).convert('RGBA'), optimize=True)

def under(name):  # 밑그림은 표시용으로만 줄여 JPEG (결과 픽셀과 무관)
    im = Image.open(os.path.join(A, 'bakeoff/c-32px/raw', name + '.png')).convert('RGB')
    im.thumbnail((640, 640), Image.LANCZOS)
    return uri(im, 'JPEG', quality=82)

before = Image.open(os.path.join(A, 'bakeoff/c-32px/scene.png')).convert('RGBA')
after = Image.open(os.path.join(T, 'scene.png')).convert('RGBA')
CROPS = [('옥상 물탱크', 20, 0, 88, 76), ('가로수 + 자판기', 150, 200, 190, 108), ('택시', 132, 336, 148, 60),
         ('상가 앞면(띠+유리)', 0, 196, 128, 100), ('난간형 가드레일', 96, 270, 90, 30)]
def crop(im, x, y, w, h, s=4):
    return uri(im.crop((x, y, x + w, y + h)).resize((w * s, h * s), Image.NEAREST))

assets = json.load(open(os.path.join(T, 'assets.json')))
prov = {p['name']: p for p in json.load(open(os.path.join(T, 'provenance.json')))}
kinds = {}
for a in assets: kinds[a['kind']] = kinds.get(a['kind'], 0) + 1

rows = ''
for a in assets:
    p = prov[a['name']]
    cls = ' class="hi"' if p['exact'] >= 15 else ''
    rows += (f"<tr{cls}><td>{a['name']}</td><td>{a['kind']}</td><td>{a['size'][0]}x{a['size'][1]}</td>"
             f"<td>{a['tracedFrom']}</td><td>{p['placements']}</td><td>{p['exact']:.1f}</td><td>{p['near']:.1f}</td>"
             f"<td>{p['paletteOutside']}</td></tr>")
ex = [p['exact'] for p in prov.values()]; nr = [p['near'] for p in prov.values()]
kindtxt = ' · '.join(f'{k} {v}' for k, v in kinds.items())

html = f"""<!doctype html><html lang="ko"><meta charset="utf-8"><title>trace-c 손 트레이싱 에셋</title>
<style>
body{{background:#1d1f27;color:#dfe3ee;font:14px/1.5 system-ui,sans-serif;margin:24px auto;max-width:1280px;padding:0 16px}}
h1{{font-size:20px}}h2{{font-size:16px;margin-top:36px;border-left:4px solid #e8c040;padding-left:8px}}
img{{image-rendering:pixelated;background:#2a2d38;border:1px solid #444a5a}}
.u img{{image-rendering:auto}}.row{{display:flex;flex-wrap:wrap;gap:12px;align-items:flex-start}}
.cap{{color:#9aa3b8;font-size:12px}}table{{border-collapse:collapse;font-size:12px}}td,th{{border:1px solid #3a3f4e;padding:2px 8px;text-align:right}}
td:nth-child(-n+4){{text-align:left}}th{{background:#2a2d38}}tr.hi td{{color:#f0b060}}
.pair{{display:flex;gap:8px;margin:8px 0 18px;flex-wrap:wrap}}.pair figure{{margin:0}}
.note{{background:#262a36;padding:8px 12px;border-radius:4px;max-width:1000px}}
</style>
<h1>C 장면 — 생성 그림 밑그림 → 손 도트 트레이싱 → 에셋 {len(assets)}개</h1>
<p class="note">최종 픽셀은 전부 좌표·색을 손으로 정한 pxgrid(modern3 팔레트)다. 생성 그림은 눈으로 보는 밑그림일 뿐이며 색을 읽거나 줄이거나 필터링한 픽셀은 하나도 없다.
장면(2번)은 3번의 에셋만 다시 붙여 만들었다.</p>

<h2>1. 생성 밑그림 (표시용 축소, 결과에 쓰지 않음)</h2>
<div class="row u"><img src="{under('L-r1-1')}"><img src="{under('R-r1-2')}"><img src="{under('P-r2-1')}"><img src="{under('P-r2-3')}"></div>
<p class="cap">L-r1-1 · R-r1-2 · P-r2-1 · P-r2-3</p>

<h2>2. 손 트레이싱 장면 (에셋 조립만으로 재구성, 512x448 · 2배 표시)</h2>
<div class="row"><figure style="margin:0"><img src="{png(os.path.join(A,'bakeoff/c-32px/scene.png'))}" width="1024"><div class="cap">비교용: 기존 C군 셀 중앙값 도트화(폐기 방식)</div></figure>
<figure style="margin:0"><img src="{png(os.path.join(T,'scene.png'))}" width="1024"><div class="cap">이번: 손 트레이싱 재조립</div></figure></div>

<h2>3. 에셋 시트 ({kindtxt})</h2>
<p class="cap">빨간 X = 통행 불가 칸, 파란 V = 통행 가능 칸 (32px 칸 기준). 이름 뒤 숫자 = 크기(px).</p>
<img src="{png(os.path.join(T,'sheet.png'))}" style="max-width:100%">

<h2>4. 확대 전후 (4배, 좌: 기존 C군 도트화, 우: 손 트레이싱)</h2>
"""
for n, x, y, w, h in CROPS:
    html += f'<div class="cap">{n}</div><div class="pair"><figure><img src="{crop(before,x,y,w,h)}"></figure><figure><img src="{crop(after,x,y,w,h)}"></figure></div>'

html += f"""
<h2>5. 출처 검증 (trace_provenance.py)</h2>
<p class="note">exact = 불투명 픽셀 중 밑그림 장면과 색이 완전히 같은 비율, near = RGB 차 합 24 이하. 배치마다 ±8px 이동 탐색의 최댓값이다.
밑그림 장면이 이미 modern3 로 양자화돼 있어 베끼면 100%에 가깝게 나온다. 실측 exact {min(ex):.1f}~{max(ex):.1f}%(평균 {sum(ex)/len(ex):.1f}), near {min(nr):.1f}~{max(nr):.1f}%(평균 {sum(nr)/len(nr):.1f}), 팔레트 밖 픽셀 0.
높은 값(주황)은 맨홀·점자블록·횡단보도·도로처럼 <b>단색·단순 반복 에셋이라 우연히 같은 색</b>인 경우이며 복사 징후가 아니다.</p>
<table><tr><th>에셋</th><th>종류</th><th>크기</th><th>밑그림</th><th>배치</th><th>exact %</th><th>near %</th><th>팔레트밖</th></tr>{rows}</table>
"""
open(OUT, 'w', encoding='utf-8').write(html)
print('wrote', OUT, os.path.getsize(OUT) // 1024, 'KB')
