import sys
sys.path.insert(0, '/home/main/.t3/worktrees/rpg-zzu/t3code-8b4b09de-jp-pick/tiledata/atlas-pick/candidates-horror/floor_creaky/work')
from h3_shapes import *
# 피 식구 공용 범례: 0..5 = blood 단, a..g = sheet(뼈·눈 흰자), h..m = dust
LG = L(blood='012345', sheet='abcdefg', dust='hijklmn')
def nb4(m, x, y): return [(x+1,y),(x-1,y),(x,y+1),(x,y-1)]
def paint(g, mask, hi='4', mid='3', edge='2', low='1', glint='5', core=None, bleed=1, bleed_lr=2, put_bleed=True):
    """마스크 안: 왼위 테 = hi, 오른아래 테 = low, 그 밖의 테 = edge, 속 = mid. 바깥 1~2px = $ 번짐(오른아래로 더)"""
    M = set(mask)
    for (x, y) in M:
        up = (x, y-1) not in M; lf = (x-1, y) not in M
        dn = (x, y+1) not in M; rt = (x+1, y) not in M
        if dn or rt: c = low if (dn and rt) or (dn and (x+1, y+1) not in M) else edge
        elif up or lf: c = hi
        else: c = mid
        if (dn or rt) and not (up or lf): c = edge if not (dn and rt) else low
        g.put(x, y, c)
    if put_bleed:
        for (x, y) in list(M):
            for dx in range(-bleed_lr, bleed_lr+1):
                for dy in range(-bleed_lr, bleed_lr+1):
                    xx, yy = x+dx, y+dy
                    if (xx, yy) in M: continue
                    d = max(abs(dx), abs(dy))
                    ok = d <= bleed or (d <= bleed_lr and dx >= 0 and dy >= 0)
                    if ok and g.get(xx, yy) == '.' if 0 <= xx < g.w and 0 <= yy < g.H else False:
                        g.put(xx, yy, '$')
def ell_mask(cx, cy, rx, ry):
    s = set()
    for y in range(int(cy-ry-1), int(cy+ry+2)):
        for x in range(int(cx-rx-1), int(cx+rx+2)):
            if ((x-cx)/rx)**2 + ((y-cy)/ry)**2 <= 1.0: s.add((x, y))
    return s
