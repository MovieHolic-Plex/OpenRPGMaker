#!/usr/bin/env python3
"""중간 시트 — 팔레트 + 조각(바닥·오토타일·건물·소품) 3배 + 손 배치 맥락 장면."""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from PIL import Image
import terrain as TR, buildings as BD, props as PR
from palette import RAMPS
from page import card, write, uri
from scene import Scene, piece, autos

z = 3
snow = TR.R.render(TR.R.by['snow']).img()
bg = uri(snow, z)
ats = autos()
n = len(TR.R.items) + len(BD.R.items) + len(PR.R.items)
body = ['<p>snow_north — Opus 손 도트, 자체 팔레트 잠금 %d색(재질 %d). 지금까지 조각 %d개(바닥 %d · 오토타일 %d묶음×49칸 · 건물 %d · 소품 %d, 애니메이션 프레임 포함). '
        '모두 <b>3배</b>, 눈밭 위. 한 층 = 32px, 문 틀 높이 25~27px(사람 24px). 3/4 관문(object-gate)은 아직 — 이 시트는 화풍 확인용.</p>'
        % (sum(len(v) for v in RAMPS.values()), len(RAMPS), n, len(TR.R.items), len(ats), len(BD.R.items), len(PR.R.items))]
body.append('<h2>팔레트(재질 램프, 왼쪽 = 어두움)</h2><table>')
for m, cols in RAMPS.items():
    body.append('<tr><td>%s</td><td>%s</td></tr>' % (m, ''.join('<span style="display:inline-block;width:26px;height:18px;background:%s"></span>' % c for c in cols)))
body.append('</table>')
# 맥락 장면
sc = Scene(34, 22, 'snow')
for (x, y, t) in ((3, 2, 'snow-b'), (20, 3, 'snow-c'), (8, 16, 'snow-d'), (28, 15, 'snow-b'), (14, 19, 'snow-c')): sc.fill(x, y, 2, 1, t)
sc.rect('pack', 0, 10, 34, 2); sc.rect('pack', 15, 12, 3, 4)
sc.area('ice', [(i, j) for j in range(14, 22) for i in range(19, 34) if (i - 27) ** 2 / 50 + (j - 19) ** 2 / 12 < 1])
sc.area('water', [(26, 18), (27, 18), (26, 19), (27, 19)])
sc.area('tundra', [(1, 15), (2, 15), (3, 15), (1, 16), (2, 16), (3, 16), (4, 16), (2, 17), (3, 17)])
sc.rect('frost', 9, 4, 4, 2)
sc.put('cabin-s', 1, 6); sc.put('woodpile', 4, 8); sc.put('meadhall', 6, 4); sc.put('cabin-m', 13, 6); sc.put('sauna', 17, 6)
sc.put('stave-church', 22, 2); sc.put('brazier', 12, 8); sc.put('smoke', 3, 4)
sc.put('pine-l', 28, 3); sc.put('pine-m', 31, 6); sc.put('pine-s', 27, 8); sc.put('birch', 20, 7)
sc.put('pine-pair', 0, 17); sc.put('boulder-l', 5, 18); sc.put('bush', 8, 13); sc.put('fishing-hut', 23, 15); sc.put('fishing-spot', 29, 17)
sc.put('stall-fish', 9, 13); sc.put('sled', 12, 13); sc.put('lamp-post', 18, 13); sc.put('drift', 4, 13); sc.put('reeds', 20, 14); sc.put('reeds', 32, 14)
sc.render(2).save('/tmp/scene.png')
body.append('<h2>맥락 장면(손 배치 한 토막, 2배 — 구성기 전)</h2><div class=wide><img src="%s"></div>' % uri(sc.render(), 2))
body.append('<h2>건물</h2><div class=grid>')
for it in BD.R.items:
    body.append(card(it['id'] + ' · ' + it['name'], BD.R.render(it).img(), z, '칸 %d×%d · 문 칸 %s' % (it['w'], it['h'], it.get('entrance')), bg))
body.append('</div><h2>소품</h2><div class=grid>')
for it in PR.R.items:
    body.append(card(it['id'] + ' · ' + it['name'], PR.R.render(it).img(), z, '', bg))
body.append('</div><h2>오토타일(견본 조립 — 47 모양 전부 등장)</h2><div class=grid>')
for gid, a in ats.items():
    body.append(card('sn-at-' + gid + ' · ' + a['name'], a['sample'].img(), 2))
body.append('</div><h2>한 칸 바닥(3×3 반복, 이음새 확인)</h2><div class=grid>')
for it in TR.R.items:
    im = TR.R.render(it).img(); t = Image.new('RGBA', (48, 48))
    for a in range(3):
        for b in range(3): t.paste(im, (a * 16, b * 16))
    body.append(card(it['id'] + ' · ' + it['name'], t, z))
body.append('</div>')
print(write('snow-north-wip', 'snow_north — 중간 시트(팔레트 + 처음 조각, 3배)', ''.join(body)))
