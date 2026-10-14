#!/usr/bin/env python3
"""중간 접촉 시트 — 처음 30조각(건물 12 + 소품 18) 3배 + 옛 초안 비교."""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from PIL import Image
import buildings as BD, props as PR, terrain as TR
from page import card, write, uri
lawn = TR.R.render(TR.R.by['lawn']).img(); pave = TR.R.render(TR.R.by['pave-brick']).img()
z = 3
bg_l = uri(lawn, z); bg_p = uri(pave, z)
body = ['<p>modern_campus 다시 그리기 — Opus 손 도트(modern3 팔레트 잠금, jp_city 와 같은 램프). 처음 30조각을 <b>3배</b>로, 실제 바닥(잔디·벽돌 포석) 위에 놓았다. '
        '건물은 통그림이 아니라 16px 블록을 이름으로 놓아 지은 것(블록 %d종)이다.</p>' % len(BD.B)]
body.append('<h2>건물 12 (블록 조립)</h2><div class=grid>')
for it in BD.R.items:
    body.append(card(it['id'] + ' · ' + it['name'], BD.R.render(it).img(), z, '칸 %d×%d' % (it['w'], it['h']), bg_p))
body.append('</div><h2>교정 소품 18</h2><div class=grid>')
first = ['bench', 'bench-stone', 'picnic-table', 'parasol-table', 'lamp-post', 'flagpole', 'vending', 'recycle-bins', 'drinking-fountain', 'notice-board',
         'campus-map', 'school-stone', 'bust', 'fountain', 'tree-zelkova', 'tree-ginkgo', 'tree-cherry', 'bleachers']
for i in first:
    it = PR.R.by[i]; body.append(card(i + ' · ' + it['name'], PR.R.render(it).img(), z, '', bg_l))
body.append('</div><h2>바닥 타일(3×3 반복, 이음새 확인)</h2><div class=grid>')
for it in TR.R.items[:20]:
    im = TR.R.render(it).img(); t = Image.new('RGBA', (48, 48))
    for a in range(3):
        for b in range(3): t.paste(im, (a * 16, b * 16))
    body.append(card(it['id'], t, z))
body.append('</div>')
old = '/home/main/z-project/rpg-zzu-bake-themes/tiledata/modern-campus/buildings/preview.png'
if os.path.exists(old):
    body.append('<h2>비교: 이전 Sonnet 초안(버림, 참고만)</h2><div class=wide><img src="%s"></div>' % uri(Image.open(old)))
print(write('campus-wip', 'modern_campus 다시 그리기 — 중간 시트(처음 30조각, 3배)', ''.join(body)))
