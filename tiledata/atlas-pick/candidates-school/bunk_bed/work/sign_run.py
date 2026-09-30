from sign import *
V = lambda s: ('vwhite', s)
# ---------- 학급 표찰 ----------
# A: 흰 판 + 회색 받침
c = C(16, 16)
c.hl(3, 3, 10, ('viron', 4)); c.px(3, 4, ('viron', 3)); c.px(12, 4, ('viron', 3)); c.hl(3, 3, 10, ('viron', 5)) 
c.rect(1, 5, 14, 9, V(5)); c.hl(1, 5, 14, V(6)); c.vl(1, 5, 9, V(6)); c.hl(1, 13, 14, V(3)); c.vl(14, 5, 9, V(3))
c.px(1, 5, '.'); c.px(14, 5, '.'); c.px(1, 13, '.'); c.px(14, 13, '.')
digits(c, 2, 6, ('vblack', 2))
c.save(out('class_plate', 'A'), 'v5 결: 앞에서 본 흰 가로판에 검정 「2-1」(굵은 획), 위에 회색 쇠 받침 1px, 모서리 살짝 둥금')
# B: 센 명암 — 짙은 남색 판, 밝은 흰 글자, 밝은 윗 모서리
c = C(16, 16)
c.hl(3, 3, 10, ('viron', 5)); c.px(3, 4, ('viron', 3)); c.px(12, 4, ('viron', 3))
c.rect(1, 5, 14, 9, ('vblue', 2)); c.hl(1, 5, 14, ('vblue', 5)); c.vl(1, 5, 9, ('vblue', 4)); c.hl(1, 13, 14, ('vblue', 0)); c.vl(14, 5, 9, ('vblue', 0))
c.px(1, 5, '.'); c.px(14, 5, '.'); c.px(1, 13, '.'); c.px(14, 13, '.')
digits(c, 2, 6, V(6))
c.save(out('class_plate', 'B'), '센 명암: 짙은 남색 판에 흰 「2-1」, 윗·왼 모서리 밝은 띠와 아래·오른 어두운 띠 대비, 밝은 회색 받침')
# C: 사슬로 매단 표찰 (윗줄 받침 + 두 줄 사슬)
c = C(16, 16)
c.hl(2, 1, 12, ('viron', 5)); c.hl(2, 2, 12, ('viron', 2))
for x in (3, 12):
    c.vl(x, 3, 3, ('viron', 4)); c.px(x, 4, ('viron', 6))
c.rect(1, 6, 14, 8, V(5)); c.hl(1, 6, 14, V(6)); c.vl(1, 6, 8, V(6)); c.hl(1, 13, 14, V(2)); c.vl(14, 6, 8, V(3))
# 아래쪽 뾰족 (화살 모양 밑)
c.px(1, 13, '.'); c.px(14, 13, '.'); c.px(1, 6, '.'); c.px(14, 6, '.')
c.px(3, 14, V(3)); c.px(12, 14, V(3)); c.hl(4, 14, 8, V(2))
c.px(1, 12, '.'); c.px(14, 12, '.')
digits(c, 2, 6, ('vblack', 2)) if False else None
# 글자 7줄은 6..12
for j in range(7):
    pass
digits(c, 2, 6, ('vblack', 2))
c.save(out('class_plate', 'C'), '실루엣 다르게: 위 쇠 막대에서 두 줄 사슬로 늘어뜨린 흰 표찰, 밑변 양끝이 깎인 모양, 검정 「2-1」')

# ---------- 비상구 표지 ----------
def exit_sign(c, rim, body, hi, lo, y0, glow=None, arrow=False):
    # 판 x1..14, y0..y0+8
    h = 9
    c.rect(1, y0, 14, h, (body[0], body[1]))
    c.hl(1, y0, 14, rim); c.hl(1, y0 + h - 1, 14, rim); c.vl(1, y0, h, rim); c.vl(14, y0, h, rim)
    for p in ((1, y0), (14, y0), (1, y0 + h - 1), (14, y0 + h - 1)): c.px(p[0], p[1], '.')
    # 안쪽 하이라이트(위)/그림자(아래)
    c.hl(2, y0 + 1, 12, hi); c.hl(2, y0 + h - 2, 12, lo)
    man(c, 3, y0 + 1, V(6))
    # 문 (오른쪽)
    dx = 10
    c.rect(dx, y0 + 1, 4, 7, body if False else lo)
    c.hl(dx, y0 + 1, 4, V(6)); c.vl(dx + 3, y0 + 1, 7, V(6)); c.hl(dx, y0 + 7, 4, V(6))
    c.px(dx, y0 + 2, V(6)) if False else None
    c.px(dx + 1, y0 + 4, V(5))
# A: 초록 판 + 밝은 테
c = C(16, 16)
exit_sign(c, ('vgreen', 6), ('vgreen', 3), ('vgreen', 4), ('vgreen', 1), 4)
c.save(out('exit_sign', 'A'), 'v5 결: 초록 유도등 판, 밝은 연두 테로 불 켜진 느낌, 흰 달리는 사람과 흰 테 문')
# B: 센 명암 — 짙은 초록 판, 더 밝은 흰빛 테 + 바깥 은은한 빛 테두리
c = C(16, 16)
exit_sign(c, ('vwhite', 5), ('mgreen', 3), ('mgreen', 5), ('mgreen', 1), 4)
c.hl(3, 3, 10, ('vgreen', 5)); c.hl(3, 13, 10, ('vgreen', 1))
c.save(out('exit_sign', 'B'), '센 명암: 밝은 흰 테와 안쪽 위 연초록 띠, 아래 짙은 초록 띠로 강한 대비, 판 위아래로 초록 빛 번짐 한 줄')
# C: 천장에서 사슬로 매단 (사슬 + 위 받침)
c = C(16, 16)
c.hl(2, 0, 12, ('viron', 4))
for x in (4, 11): c.vl(x, 1, 3, ('viron', 5))
exit_sign(c, ('vgreen', 6), ('vgreen', 3), ('vgreen', 4), ('vgreen', 1), 4)
c.hl(1, 13, 14, ('viron', 2)) if False else None
c.save(out('exit_sign', 'C'), '실루엣 다르게: 천장 쇠 막대에서 두 사슬로 매단 초록 유도등, 흰 사람과 문')
