#!/usr/bin/env python3
"""중간 시트 — 팔레트 + 처음 조각들(바닥·건물·소품) 3배 + 맥락 장면 한 장."""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from PIL import Image
import terrain as TR, buildings as BD, props as PR
from palette import RAMPS
from page import card, write, uri
from scene import Scene, piece

z = 3
flag = TR.R.render(TR.R.by['flag']).img(); cob = TR.R.render(TR.R.by['cobble']).img()
bg_f = uri(flag, z); bg_c = uri(cob, z)
n = len(TR.R.items) + len(BD.R.items) + len(PR.R.items)
body = ['<p>steampunk_city — Opus 손 도트(자체 팔레트 잠금 %d색, 재질 %d). 지금까지 조각 %d개(바닥 %d · 건물 %d · 소품 %d, 애니메이션 프레임 포함). '
        '모두 <b>3배</b>, 실제 바닥(판석·자갈) 위. 건물은 통그림이 아니라 16px 블록(%d종)을 이름으로 놓아 지은 것이다. 한 층 = 32px, 문 높이 26px(사람 24px).</p>'
        % (sum(len(v) for v in RAMPS.values()), len(RAMPS), n, len(TR.R.items), len(BD.R.items), len(PR.R.items), len(BD.B))]
body.append('<h2>팔레트(재질 램프, 왼쪽 = 어두움)</h2><table>')
for m, cols in RAMPS.items():
    body.append('<tr><td>%s</td><td>%s</td></tr>' % (m, ''.join('<span style="display:inline-block;width:26px;height:18px;background:%s"></span>' % c for c in cols)))
body.append('</table>')
sc = Scene(30, 22, 'cobble')
x = 0
for b in ['row-3', 'row-4', 'shop-gears', 'row-3', 'inn', 'tavern']:
    im = piece(b); sc.put(b, x, 10 - im.height // 16); x += im.width // 16
sc.fill(0, 10, 30, 1, 'flag'); sc.fill(0, 11, 30, 1, 'curb-s'); sc.fill(0, 13, 30, 1, 'tram-n'); sc.fill(0, 14, 30, 1, 'tram-s')
sc.fill(0, 17, 30, 1, 'curb-n'); sc.fill(0, 18, 30, 4, 'flag')
for lx in (2, 8, 14, 20, 26): sc.put('gas-lamp', lx, 9)
sc.put('stall-fruit', 3, 18); sc.put('stall-parts', 8, 18); sc.put('bench', 14, 19); sc.put('barrels', 23, 19); sc.put('steam-vent', 18, 16)
body.append('<h2>맥락 장면(거리 한 토막, 2배 — 구성기 전 손 배치)</h2><div class=wide><img src="%s"></div>' % uri(sc.render(), 2))
body.append('<h2>건물 (블록 조립)</h2><div class=grid>')
for it in BD.R.items:
    body.append(card(it['id'] + ' · ' + it['name'], BD.R.render(it).img(), z, '칸 %d×%d · 문 칸 %s' % (it['w'], it['h'], it.get('entrance')), bg_f))
body.append('</div><h2>소품</h2><div class=grid>')
for it in PR.R.items:
    body.append(card(it['id'] + ' · ' + it['name'], PR.R.render(it).img(), z, '', bg_f))
body.append('</div><h2>바닥 타일(3×3 반복, 이음새 확인)</h2><div class=grid>')
for it in TR.R.items:
    im = TR.R.render(it).img(); t = Image.new('RGBA', (48, 48))
    for a in range(3):
        for b in range(3): t.paste(im, (a * 16, b * 16))
    body.append(card(it['id'] + ' · ' + it['name'], t, z))
body.append('</div>')
print(write('steampunk-wip', 'steampunk_city — 중간 시트(팔레트 + 처음 조각, 3배)', ''.join(body)))
