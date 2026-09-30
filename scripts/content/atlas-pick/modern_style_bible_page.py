#!/usr/bin/env python3
"""~/claude-viz/modern-style-bible.html 재생성(현대 계열 공통 style bible 견본). 그림은 전부 data URI(자체완결), 참고 상용 그림은 넣지 않는다.
  python3 scripts/content/atlas-pick/modern_style_bible_page.py
입력: palette/modern3.pal, remap-to-modern3.json, style-demo-modern3/{proof,scale,cubes}.png(modern_style_bible_proof.py), style-demo-jp2/street/dm3-D.png(우리 2차 데모)."""
import base64, io, json, os, re, sys
from PIL import Image
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import BASE
from modern3_check import load_pal
OUT = os.path.expanduser('~/claude-viz/modern-style-bible.html')
D3 = os.path.join(BASE, 'style-demo-modern3')
def load(p): return Image.open(p).convert('RGBA')
def uri(im, k=1, box=None):
    if box: im = im.crop(box)
    if k != 1: im = im.resize((im.width * k, im.height * k), Image.NEAREST)
    b = io.BytesIO(); im.save(b, 'PNG', optimize=True); return 'data:image/png;base64,' + base64.b64encode(b.getvalue()).decode()
def img(im, k=1, box=None, cls=''): return f'<img class="{cls}" src="{uri(im, k, box)}">'
proof, scale, cubes = (load(os.path.join(D3, n + '.png')) for n in ('proof', 'scale', 'cubes'))
r2 = load(os.path.join(BASE, 'style-demo-jp2', 'street', 'dm3-D.png'))
remap = json.load(open(os.path.join(BASE, 'remap-to-modern3.json'), encoding='utf-8'))
ramps = load_pal()
labels = {}; last = ''
for ln in open(os.path.join(BASE, 'palette', 'modern3.pal'), encoding='utf-8'):
    if ln.startswith('//'): last = ln[2:].strip()
    m = re.match(r'@rampc\s+(\S+)', ln)
    if m: labels[m.group(1)] = last
def hx(c): return '#%06x' % c
sw = []
for n, r in ramps.items():
    cells = ''.join(f'<span class="sw" style="background:{hx(c)}" title="{n}{i - len(r) // 2:+d} {hx(c)}"><i>{i - len(r) // 2:+d}</i></span>' for i, c in enumerate(r))
    sw.append(f'<div class="rp"><b>{n}</b><span class="lb">{labels.get(n, "")}</span><div class="sws">{cells}</div></div>')
st = remap['stats']
S = 5   # 규모 그림 배율
# 규모 라벨: 각 물건의 x 범위(scale() 의 배치와 같음)
items = [('히어로', '16×24', 6, 16), ('문', '16×28', 30 + 3, 16), ('창', '16×14', 60 + 4, 16), ('층 32', '32', 92, 5), ('차', '56×24', 104, 56),
         ('자판기', '16×26', 168, 16), ('신호등', '16×48', 192, 16), ('가로수', '32×48', 216, 32)]
lab = ''.join(f'<div class="tk" style="left:{x * S}px;width:{max(w, 22) * S}px"><b>{n}</b><br>{d}</div>' for n, d, x, w in items)
faces = [('지붕 윗면', '+2'), ('앞면(기본)', '0'), ('슬래브 밑·처마 그림자', '-2'), ('오른쪽 옆면', '-2'), ('바닥 그림자', '-2 (가장자리 -1)')]
ftab = ''.join(f'<tr><td>{a}</td><td>{b}</td></tr>' for a, b in faces)
html = f'''<!doctype html><html lang="ko"><meta charset="utf-8"><title>현대 계열 공통 style bible (modern3)</title>
<style>
body{{background:#1b1826;color:#e6e2f0;font:14px/1.6 system-ui,sans-serif;margin:0;padding:20px 28px;max-width:1500px}}
h1{{font-size:20px;margin:0 0 4px}} h2{{font-size:15px;margin:28px 0 6px;color:#c8c0e0}} .s{{color:#9c94b4}}
img{{image-rendering:pixelated;display:block;border:1px solid #4c4560}}
.rps{{display:grid;grid-template-columns:repeat(auto-fill,minmax(330px,1fr));gap:6px 18px}} .rp b{{display:inline-block;width:70px}} .lb{{color:#9c94b4;font-size:12px}}
.sws{{display:flex}} .sw{{flex:1;height:22px;position:relative;border:1px solid #0006}} .sw i{{position:absolute;right:2px;bottom:0;font:9px/1 monospace;color:#fff8;mix-blend-mode:difference}}
.row{{display:flex;gap:18px;flex-wrap:wrap;align-items:flex-start}} table{{border-collapse:collapse}} td{{border:1px solid #4c4560;padding:2px 10px}}
.tkw{{position:relative;height:38px;margin-top:2px;width:{scale.width * S}px}} .tk{{position:absolute;text-align:center;font-size:11px;line-height:1.25;color:#c8c0e0}}
.tag{{display:inline-block;padding:1px 8px;border-radius:9px;font-size:12px;background:#3a6a5a;margin-right:6px}} .tag.o{{background:#4c4560}}
small{{color:#9c94b4;display:block;margin-bottom:3px}}
</style>
<h1>현대 계열 공통 style bible — modern3 (일본 · 강남 · 학원)</h1>
<div class="s">16px 칸. 램프 {len(ramps)}개 · {sum(len(r) for r in ramps.values())}색(상한 160). 어두운 쪽은 청보라(258°)로, 밝은 쪽은 살구빛(48°)으로 기운다. 윤곽은 검정이 아니라 sumi(보라 검정). 그림자는 램프의 낮은 단(불투명). 색 밖 사용 0.
판정 포인트: (1) 벽이 평평한가? (2) 창이 스티커 같은가? (3) 앞 건물과 뒤 건물이 앞뒤로 갈리는가? (4) 히어로·문·차의 크기가 맞는가?</div>
<h2>1. 램프 {len(ramps)}개 (칸의 숫자 = 단. 0 이 기본색, -는 그늘, +는 빛)</h2><div class="rps">{''.join(sw)}</div>
<h2>2. 빛 = 왼쪽 위. 면마다 램프 단이 정해져 있다 (재료 10종을 같은 상자로)</h2>
<div class="row"><div>{img(cubes, 4)}<small>conc · tairu · renga · kawara · ita · garasu · yuka · kokuban · lino · kinari (왼쪽부터)</small></div><table>{ftab}</table></div>
<h2>3. 규모 — 히어로 16×24 기준 (한 눈금 = 16px 칸 1개)</h2>
<div>{img(scale, S)}<div class="tkw">{lab}</div></div>
<div class="s">한 층 = 32px(히어로 1.33배로 압축), 문 28px, 1층 가게 44px, 창 14px, 차 56×24, 신호등 48px, 가로수 48px. 강남 QA 의 「히어로가 세계보다 1.75배 크다」를 없애기 위해 문·층을 히어로에 맞췄다.</div>
<h2>4. 증명 블록 — 4·6칸 건물 두 채 (왼쪽: 튀어나온 타일 건물, 오른쪽: 물러선 콘크리트 건물) 와 2차 데모</h2>
<div class="row">
 <div><small><span class="tag">modern3</span>원본 192×208</small>{img(proof)}</div>
 <div><small><span class="tag">modern3</span>3배</small>{img(proof, 3)}</div>
 <div><small><span class="tag o">2차 데모</span>우리 것, 같은 영역 3배(왼쪽 위 128×144)</small>{img(r2, 3, (0, 0, 128, 144))}</div>
</div>
<h2>5. 2차 데모 전체 (옛 jp 팔레트, 512×384)</h2>{img(r2)}
<h2>6. 옛 팔레트 → modern3 대응표 요약 (remap-to-modern3.json)</h2>
<div>옛 램프 {st['oldRamps']}개 · 옛 색 {st['oldColors']}개(jp·modern·school) → modern3 {st['newColorsUsed']}색 사용(전체 {st['newColorsTotal']}색 중), 평균 거리 {st['meanDist']}, 약한 대응 {st['weakCount']}색(밝은 끝 · 네온 · 순노랑처럼 modern3 에 없는 채도), 반투명 4줄과 마커 색은 대응 없음(합성 후 낮은 단으로 굽는다).</div>
'''
os.makedirs(os.path.dirname(OUT), exist_ok=True); open(OUT, 'w', encoding='utf-8').write(html)
print(OUT, len(html) // 1024, 'KB')
