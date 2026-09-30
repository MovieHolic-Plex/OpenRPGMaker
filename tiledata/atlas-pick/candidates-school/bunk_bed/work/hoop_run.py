from hoop import *
# A
c = hoop(P('vwhite', 5), P('vwhite', 6), P('vwhite', 2), (P('vred', 4), P('vred', 2)), P('vred', 3), 'viron', 'vblue',
         (P('morange', 3), P('morange', 2), P('morange', 1)), P('vwhite', 6), P('vwhite', 4))
fin(c, 'A', 'v5 결: 흰 백보드에 붉은 테·조준 사각형, 주황 링과 흰 그물, 굵은 철 기둥, 파란 물통 받침에 바퀴 둘')
# B 강한 명암: 어두운 유리 보드, 밝은 링
c = hoop(P('vglass', 3), P('vglass', 6), P('vglass', 0), (P('vred', 5), P('vred', 2)), P('vred', 5), 'vblack', 'vred',
         (P('morange', 4), P('morange', 3), P('morange', 0)), P('vwhite', 6), P('vwhite', 3), lit=True)
fin(c, 'B', '센 명암: 어두운 푸른 유리 백보드에 밝은 붉은 테, 밝은 주황 링, 검은 기둥, 붉은 물통 받침, 깊은 그림자')

# C 옆모습 — 단일 기둥, 판은 얇게, 링이 왼쪽으로 튀어나옴 (L자)
c = C(32, 48)
# 기둥
c.rect(20, 6, 4, 36, P('viron', 3)); c.vl(20, 6, 36, P('viron', 4)); c.vl(23, 6, 36, P('viron', 1))
# 보드(옆): 얇고 키가 큼
c.rect(24, 1, 3, 14, P('vwhite', 5)); c.vl(24, 1, 14, P('vwhite', 6)); c.vl(26, 1, 14, P('vwhite', 2)); c.hl(24, 1, 3, P('vred', 4)); c.hl(24, 14, 3, P('vred', 2))
c.rect(20, 4, 4, 2, P('viron', 5))
# 링 팔 + 링 (왼쪽으로)
c.hl(13, 12, 11, P('morange', 3)); c.hl(13, 13, 11, P('morange', 1)); c.px(12, 12, P('morange', 4)); c.px(12, 13, P('morange', 2))
# 그물 (링 아래)
for i, (x0, n) in enumerate([(13, 10), (14, 8), (14, 7), (15, 5), (15, 4)]):
    for x in range(x0, x0 + n):
        if (x + i) % 2 == 0: c.px(x, 14 + i, P('vwhite', 6 if (x + i) % 4 else 4))
# 받침
c.rect(9, 40, 22, 4, P('vred', 3)); c.hl(9, 40, 22, P('vred', 5)); c.vl(9, 40, 4, P('vred', 5)); c.hl(9, 43, 22, P('vred', 1)); c.vl(30, 40, 4, P('vred', 1))
c.px(9, 40, '.'); c.px(30, 43, '.')
c.hl(12, 41, 6, P('vred', 4))
for wx in (11, 26):
    c.rect(wx, 44, 4, 2, P('vblack', 2)); c.px(wx, 44, P('vblack', 4)); c.px(wx + 1, 44, P('vblack', 3))
fin(c, 'C', '실루엣 다르게: 옆에서 본 농구대, 얇은 백보드와 왼쪽으로 뻗은 링·그물, 굵은 기둥, 붉은 받침', sx=9, sw=22)
