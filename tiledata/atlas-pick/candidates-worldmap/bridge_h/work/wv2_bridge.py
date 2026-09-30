#!/usr/bin/env python3
"""wv2 bridge_h / bridge_v A/B/C. 가로 다리 한 칸을 (u=진행축, v=가로지르는 축)으로 짜고, 세로 다리는 전치한다.
재료·난간 두께는 두 다리가 같다. 진행축 16px 주기로 감아 좌우(위아래) 끝이 이어진다."""
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '../../meadow/work'))
from wv2_lib import write_pxg
S = lambda n: ('wstone', n)
W = lambda n: ('mwood', n)

def col_A(u, v):
    # World.png 식 돌 상판: 굵은 난간 2px, 상판 가운데 한 단 밝음, 8px마다 이음
    j = (u % 8 == 0)
    if v == 3: return S(5 if not j else 4)
    if v == 4: return S(3)
    if v == 5: return S(3)
    if 6 <= v <= 10:
        base = 5 if v in (7, 8) else 4
        if j: base -= 1
        if (u, v) in ((4, 9), (12, 6)): base += 1 if base < 5 else 0
        return S(base)
    if v == 11: return S(5 if not j else 4)
    if v == 12: return S(2)
    if v == 13: return '~'
    return None

def col_B(u, v):
    # 깊이 강조: 난간 그림자가 상판에 떨어지고 다리 옆면(v13)이 어둡게 보인다. 어긋난 돌 이음
    if v == 3: return S(6)
    if v == 4: return S(4)
    if 5 <= v <= 10:
        base = {5: 2, 6: 3, 7: 4, 8: 4, 9: 5, 10: 5}[v]
        jn = (u % 8 == 0) if v <= 8 else (u % 8 == 4)
        if jn: base -= 1
        return S(base)
    if v == 11: return S(6 if u % 8 else 5)
    if v == 12: return S(3)
    if v == 13: return S(1) if u % 8 else S(0)
    if v == 14: return '~'
    if v == 15: return '-'
    return None

def col_C(u, v):
    # 다른 재료: 나무 널. 널은 진행축에 직각으로 4px 폭, 널마다 두 단 번갈아, 사이 이음 한 줄
    if v == 3: return W(5 if u % 8 else 4)
    if v == 4: return W(3)
    if v == 11: return W(4)
    if v == 12: return W(2)
    if 5 <= v <= 10:
        if u % 4 == 3: return W(1)
        base = 3 if (u // 4) % 2 == 0 else 2
        if v in (7, 8): base += 1
        if v == 5: base = max(1, base - 1)
        return W(base)
    if v == 13: return '~'
    return None

DIRS = {'A': col_A, 'B': col_B, 'C': col_C}
NOTE = {
 'A': ('World.png 식 돌 상판. 굵은 난간 2px에 위쪽 줄이 밝고, 상판 가운데 두 줄이 한 단 밝다. 8px마다 이음 줄, 남쪽(동쪽) 물 위 그림자 한 줄',
       'bridge_v 는 같은 돌·같은 난간을 전치한 것. 그림자는 동쪽'),
 'B': ('깊이 강조 돌다리. 난간이 상판에 그늘을 떨구고 상판이 난간 쪽에서 안쪽으로 밝아진다. 다리 옆면 한 줄이 어둡고 그 밖에 그림자 두 줄. 이음은 위·아래 절반이 4px 어긋난다',
       'bridge_v 는 같은 돌 전치, 그림자 동쪽'),
 'C': ('나무다리. 널을 진행축에 직각으로 4px씩 깔고 널마다 두 단 번갈아 넣었으며 널 사이 이음 한 줄. 난간 2px, 그림자 한 줄',
       'bridge_v 는 같은 나무 전치, 그림자 동쪽'),
}
for k, f in DIRS.items():
    hg = [[f(u, v) for u in range(16)] for v in range(16)]
    vg = [[f(u, v) for v in range(16)] for u in range(16)]   # 전치: 행 = u, 열 = v
    write_pxg(f'../wv2-{k}.pxg', f'bridge_h wv2-{k}', hg, 16, 16)
    open(f'../wv2-{k}.note', 'w').write(NOTE[k][0] + '\n')
    write_pxg(f'../../bridge_v/wv2-{k}.pxg', f'bridge_v wv2-{k}', vg, 16, 16)
    open(f'../../bridge_v/wv2-{k}.note', 'w').write(NOTE[k][1] + '\n')
