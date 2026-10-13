#!/usr/bin/env python3
"""중간 시트 — 팔레트 + 지금까지 조각 3배 + 맥락 장면(손 배치)."""
import sys, os, math
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from PIL import Image
import terrain as TR, dwellings as DW, nature as NA, props as PR
from palette import RAMPS
from page import card, write, uri
from scene import Scene, vgrid, piece

z = 3
bg = uri(TR.R.render(TR.R.by['dirt']).img(), z)
singles = [it for it in TR.R.items if not it['id'].startswith('w-') and '-f' not in it['id']]
objs = DW.R.items + NA.R.items + [it for it in PR.R.items if '-f' not in it['id']]
body = ['<p>prehistoric — Opus 손 도트(자체 팔레트 잠금 %d색, 재질 %d). 지금까지: 한 칸 바닥 %d + 가장자리 세트 %d쌍(각 14칸, 꼭짓점 왕 방식 = 둥근 덩이) + 기물 %d. '
        '3배 확대, 흙 바닥 위. 사람 문(폭 14~16 × 높이 25~26px)은 모두 한 칸 열에 맞췄다. 관문(object-gate)은 아직 — 다음 단계.</p>'
        % (sum(len(v) for v in RAMPS.values()), len(RAMPS), len(singles), len(TR.PAIRS), len(objs))]
body.append('<h2>팔레트(재질 램프, 왼쪽 = 어두움)</h2><table>')
for m, cols in RAMPS.items():
    body.append('<tr><td>%s</td><td>%s</td></tr>' % (m, ''.join('<span style="display:inline-block;width:26px;height:18px;background:%s"></span>' % c for c in cols)))
body.append('</table>')
# 맥락 장면
sc = Scene(30, 20, 'grass')
sc.blob('grass', vgrid(30, 20, lambda x, y: True))
cx, cy = 15, 11
V = vgrid(30, 20, lambda x, y: ((x - cx) / 11.5) ** 2 + ((y - cy) / 7.5) ** 2 > 1 + 0.15 * math.sin(x * 1.3 + y))
sc.fill(0, 0, 30, 20, 'dirt'); sc.blob('grass', V)
V2 = vgrid(30, 20, lambda x, y: ((x - 26) / 4.5) ** 2 + ((y - 16) / 3.2) ** 2 < 1)
sc.blob('water', V2)
sc.put('chief-house', 11, 1)
sc.put('hut-thatch-s', 4, 5); sc.put('hut-log', 22, 5); sc.put('tipi', 6, 11); sc.put('bone-hut', 19, 11)
sc.put('bonfire', 14, 10); sc.put('log-seat', 11, 11); sc.put('log-seat', 17, 12); sc.put('stone-seat', 13, 13)
sc.put('totem', 9, 6); sc.put('drying-rack', 26, 8); sc.put('pots', 3, 9); sc.put('woodpile', 7, 9)
for (t, x, y) in (('jungle-tree', 0, 13), ('araucaria', 26, 0), ('tree-fern', 1, 0), ('cycad', 23, 0), ('fern-giant', 0, 3), ('rock-l', 28, 3),
                  ('reeds', 23, 15), ('horsetail', 29, 14), ('fern-s', 12, 17), ('bush', 9, 17), ('berry-bush', 16, 17), ('rock-s', 20, 18)):
    sc.put(t, x, y)
body.append('<h2>맥락 장면(마을 한 토막, 2배 — 구성기 전 손 배치)</h2><div class=wide><img src="%s"></div>' % uri(sc.render(), 2))
body.append('<h2>거처</h2><div class=grid>')
for it in DW.R.items:
    body.append(card(it['id'] + ' · ' + it['name'], DW.R.render(it).img(), z, '칸 %d×%d · 문 칸 %s · %s' % (it['w'], it['h'], it.get('entrance'), it['kind']), bg))
body.append('</div><h2>자연</h2><div class=grid>')
for it in NA.R.items:
    body.append(card(it['id'] + ' · ' + it['name'], NA.R.render(it).img(), z, it['kind'], bg))
body.append('</div><h2>소품·뼈·화석·물 위</h2><div class=grid>')
for it in PR.R.items:
    if '-f' in it['id']: continue
    body.append(card(it['id'] + ' · ' + it['name'], PR.R.render(it).img(), z, it['kind'], bg))
body.append('</div><h2>바닥 한 칸(3×3 반복, 이음새 확인)</h2><div class=grid>')
for it in singles:
    im = TR.R.render(it).img(); t = Image.new('RGBA', (48, 48))
    for a in range(3):
        for b in range(3): t.paste(im, (a * 16, b * 16))
    body.append(card(it['id'] + ' · ' + it['name'], t, z))
body.append('</div><h2>가장자리 세트(꼭짓점 격자로 이어 붙인 표본)</h2><div class=grid>')
for p in TR.PAIRS:
    body.append(card(p[4], TR.swatch(p[0])[0].img(), 2))
body.append('</div>')
print(write('prehistoric-wip', 'prehistoric — 중간 시트(팔레트 + 처음 조각, 3배)', ''.join(body)))
