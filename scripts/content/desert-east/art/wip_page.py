#!/usr/bin/env python3
"""중간 시트 — 팔레트 + 처음 30조각(건물·바닥) 3배, 실제 모래 위."""
import sys, os, json
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from PIL import Image
import buildings as BD, terrain as TR
from page import card, write, uri
z = 3
sand = TR.R.render(TR.R.by['sand']).img()
bg = uri(sand, z)
pal = json.load(open(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'palette.json')))
body = ['<p>desert_east — 동양 사막(아라비아·실크로드·이집트·메소포타미아) 새 칩셋. Opus 코드 손 도트, 16px, 3/4 탑뷰. 잠긴 팔레트 램프 %d개. 3배 확대, 모래 바닥 위.</p>' % (len(pal) - 1)]
body.append('<h2>팔레트(램프: 어두움 → 밝음)</h2><table>')
for k, v in pal.items():
    if k.startswith('_'): continue
    body.append('<tr><td>%s</td><td>%s</td></tr>' % (k, ''.join('<span style="display:inline-block;width:28px;height:20px;background:%s"></span>' % c for c in v)))
body.append('</table><h2>건물·유적·성벽·천막 (%d)</h2><div class=grid>' % len(BD.R.items))
for it in BD.R.items:
    body.append(card(it['id'] + ' · ' + it['name'], BD.R.render(it).img(), z, '칸 %d×%d · 문 칸 %s' % (it['w'], it['h'], it.get('entrance') or '-'), bg))
body.append('</div><h2>바닥 한 칸(3×3 반복)</h2><div class=grid>')
for it in TR.R.items:
    if it.get('wang'): continue
    im = TR.R.render(it).img(); t = Image.new('RGBA', (48, 48))
    for a in range(3):
        for b in range(3): t.paste(im, (a * 16, b * 16))
    body.append(card(it['id'], t, z))
body.append('</div><h2>모서리 왕 타일 5벌(구성기가 꼭짓점 재질로 고른다) — 덩이 시험</h2><div class=grid>')
imgs = {it['id']: TR.R.render(it).img() for it in TR.R.items}
W, H = 12, 8
for sid in TR.WANG:
    V = [[1 if ((x - 6) / 4.6) ** 2 + ((y - 4) / 2.9) ** 2 < 1 else 0 for x in range(W + 1)] for y in range(H + 1)]
    under = 'grass' if sid == 'water' else 'sand'
    im = Image.new('RGBA', (W * 16, H * 16))
    for y in range(H):
        for x in range(W):
            idx = V[y][x] + V[y][x + 1] * 2 + V[y + 1][x] * 4 + V[y + 1][x + 1] * 8
            im.paste(imgs['%s-%d' % (sid, idx)], (x * 16, y * 16))
    body.append(card(sid, im, z))
body.append('</div>')
print(write('desert-east-wip', 'desert_east 사막·동양풍 칩셋 — 중간 시트(팔레트 + 처음 조각들, 3배)', ''.join(body)))
