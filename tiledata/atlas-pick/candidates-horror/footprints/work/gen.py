import sys
sys.path.insert(0, '/home/main/.t3/worktrees/rpg-zzu/t3code-8b4b09de-jp-pick/tiledata/atlas-pick/candidates-horror/blood_pool/work')
from blood import *
SLUG = 'footprints'
# 왼발(9x10): 발가락 다섯 점(큰 발가락은 세로 2) + 발바닥
SOLE = {3: (1, 8), 4: (1, 8), 5: (1, 7), 6: (1, 5), 7: (1, 5), 8: (2, 5), 9: (2, 5)}
TOES = [(0, 2), (2, 1), (4, 0), (6, 0), (8, 0), (8, 1)]
def foot(ox, oy, mirror, toes=TOES, sole=SOLE):
    m = set()
    def P(x, y): m.add((ox + (8 - x if mirror else x), oy + y))
    for y, (a, b) in sole.items():
        for x in range(a, b+1): P(x, y)
    for x, y in toes: P(x, y)
    return m
def only_bleed(g, mask, tone='$'):
    for (x, y) in mask:
        if 0 <= x < g.w and 0 <= y < g.H: g.put(x, y, tone)
def build(hi, mid, edge, low, glint, claws=False, far_extra=False):
    g = G(16, 16)
    near = foot(0, 6, False)             # 아래 왼발: 피 그대로
    far = foot(7, 0, True)                # 위 오른발: 옅게 $ 만
    paint(g, near, hi=hi, mid=mid, edge=edge, low=low, glint=glint, bleed=1, bleed_lr=1)
    only_bleed(g, far)
    for (x, y) in foot(0, 6, False, sole={}):
        g.put(x, y, hi if y == 6 else mid)
    if far_extra:
        # 위쪽 발: 발끝 두어 점만 아직 붉다
        for (x, y) in far:
            if y <= 1: g.put(x, y, edge)
        g.pts(low, 12, 8, 11, 9)
    return g
a = build('4', '3', '2', '1', '5')
b = build('5', '2', '1', '0', '5', far_extra=True)
# B: 밝은 테를 왼쪽 위 발가락과 발볼 윗줄에만
# C: 발가락이 길고 뾰족(세로 2~3px) + 끝에 창백한 발톱 한 점
CT = [(0, 1), (0, 2), (2, 0), (2, 1), (4, -1), (4, 0), (6, -1), (6, 0), (8, -1), (8, 0), (8, 1)]
def build_c():
    g = G(16, 16)
    near = foot(0, 7, False, toes=CT)
    far = foot(7, 1, True, toes=CT)
    paint(g, near, hi='4', mid='3', edge='2', low='1', glint='5', bleed=1, bleed_lr=1)
    only_bleed(g, far)
    for (x, y) in foot(0, 7, False, toes=CT, sole={}):
        g.put(x, y, '4' if y <= 7 else '3')
    for (x, y) in near:
        if y == 6:  # 발가락 끝 = 발톱
            pass
    # 발톱(창백): 아래 발 발가락 끝 한 점씩
    for dx in (0, 2, 4, 6, 8):
        ty = 6 if dx >= 4 else 7 + (0 if dx == 2 else 1) - 1
    g.pts('e', 4, 6, 6, 6, 8, 6, 2, 7, 0, 8)
    return g
c = build_c()
notes = {
 'A': ('맨발 발자국 둘 엇갈려 위로: 아래 왼발은 피 그대로(왼쪽 위 밝은 테, 오른쪽 아래 어두운 테), 위 오른발은 $ 번짐만, 발가락 점 다섯', a),
 'B': ('대비 강화: 발 윗테 blood 5, 속 2, 아랫테 0, 위 발은 발끝 두어 점만 아직 붉고 뒤꿈치 흔적', b),
 'C': ('발가락이 길고 뾰족한 발톱 발자국: 발가락마다 세로 2~3px, 끝에 창백한 발톱 점(짐승 같다)', c),
}
finish(SLUG, notes, LG)
