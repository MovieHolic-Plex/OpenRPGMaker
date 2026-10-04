import sys
sys.path.insert(0, '/home/main/.t3/worktrees/rpg-zzu/t3code-8b4b09de-jp-pick/tiledata/atlas-pick/candidates-horror/blood_pool/work')
from blood import *
SLUG = 'handprints_wall'
# 손: x 0..7 (엄지 왼쪽 x=0), 손가락 x=1,3,5,7 세로 줄, 손바닥 x=1..7 5줄
HAND = [
 "...#.#..",
 ".#.#.#.#",
 ".#.#.#.#",
 ".#.###.#",   # 가운뎃손가락 x=3,5 는 길게 -> 위 두 줄에 있음
 ".#######",
 "########",
 ".#######",
 ".#######",
 "..#####.",
]
# 위 격자는 손가락 길이를 다르게: 위 두 칸은 가운데(x=3,5), 새끼(x=7) 짧게
def hand_mask(ox, oy, extra=None):
    m = set()
    for j, r in enumerate(HAND):
        for i, ch in enumerate(r):
            if ch == '#': m.add((ox + i, oy + j))
    # 가운뎃손가락 한 칸 더 길게
    m.add((ox + 3, oy - 1))
    return m
def drag(g, ox, oy, cols, length, tones):
    # 손바닥 아래로 손가락 자국이 끌려 내려감 (칸 끝에서 희미해짐)
    for i, x in enumerate(cols):
        for k in range(length[i]):
            t = tones[min(k * len(tones) // max(length[i], 1), len(tones)-1)]
            g.put(ox + x, oy + k, t)
def build(hi, mid, edge, low, glint, shade=False, eye=False):
    g = G(16, 16)
    m1 = hand_mask(0, 6)          # 깨끗한 손자국 (아래쪽)
    m2 = hand_mask(8, 1)          # 끌려 내려가는 손자국 (위쪽)
    # 오른쪽 손은 너비 8 이라 x 15 를 넘으면 자른다
    m2 = {(x, y) for x, y in m2 if x <= 15}
    paint(g, m1, hi=hi, mid=mid, edge=edge, low=low, glint=glint, bleed=1, bleed_lr=1)
    paint(g, m2, hi=hi, mid=mid, edge=edge, low=low, glint=glint, bleed=1, bleed_lr=1)
    # 끌림: 손바닥 아래(y=10)에서 x=9,11,13,15 세로 줄 (짧아질수록 옅게)
    for i, x in enumerate((9, 11, 13, 15)):
        n = (5, 6, 5, 4)[i]
        for k in range(n):
            y = 10 + k
            if y > 15: break
            g.put(x, y, mid if k < n-2 else (edge if k == n-2 else low))
            if x + 1 <= 15 and k > 0 and g.get(x+1, y) == '.': g.put(x+1, y, '$')
    if shade:
        for (x, y) in list(m1) + list(m2):
            if (x+1, y) not in m1 and (x+1, y) not in m2 and x+1 <= 15 and g.get(x+1, y) in '.$':
                pass
    if eye:
        # 아래 손자국 손바닥 가운데(x=4,y=12)에 눈
        g.row(3, 11, 'fff'); g.row(3, 12, 'f0f'.replace('f', 'f')); g.put(4, 12, '0'); g.row(3, 13, 'bbb')
        g.put(2, 12, '1'); g.put(6, 12, '1')
    return g
a = build('4', '3', '2', '1', '5')
b = build('5', '2', '1', '0', '5')
# B: 접지 그림자 -, 오른쪽 한 줄만
for y in range(16):
    for x in range(15):
        if b.get(x, y) in '01' and b.get(x+1, y) == '.': b.put(x+1, y, '-')
c = build('4', '3', '2', '1', '5', eye=True)
notes = {
 'A': ('벽에 찍힌 손자국 둘: 아래는 깨끗한 손바닥 5x5+손가락 4줄+엄지, 위는 손가락이 아래로 끌려 내려가며 옅어짐, 왼쪽 위 밝고 오른쪽 아래 어둡게, $ 번짐', a),
 'B': ('대비 강화: 윗테 blood 5 단, 속 2, 아랫테 0/1 로 어둡게, 오른쪽 접지 그림자 반투명 한 줄', b),
 'C': ('아래 손자국 손바닥 가운데에 눈이 하나 뜨고 있다(흰자 sheet, 눈동자 blood)', c),
}
finish(SLUG, notes, LG)
