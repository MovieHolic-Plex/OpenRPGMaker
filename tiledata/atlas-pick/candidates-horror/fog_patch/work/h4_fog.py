import sys, os, math, random
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, '..', '..', 'wall_paper_torn', 'work'))
from h4lib import Cv, P
CH = os.path.join(HERE, '..', '..')

def blobs(c, specs, seed, core_ratio=0.55, sparse=0.5):
    rnd = random.Random(seed)
    for (cx, cy, rx, ry) in specs:
        for y in range(c.h):
            for x in range(c.w):
                d = ((x + .5 - cx) / rx) ** 2 + ((y + .5 - cy) / ry) ** 2
                if d > 1.0: continue
                # 가장자리 성기게
                if d > 0.62 and rnd.random() < sparse * (d - .55) * 2.2: continue
                if not (2 <= x <= c.w - 3 and 2 <= y <= c.h - 3): continue
                cur = c.get(x, y)
                if d < core_ratio: c.set(x, y, '!')
                elif cur != '!': c.set(x, y, '+')

def fog(d):
    c = Cv(32, 32)
    if d == 'A':
        blobs(c, [(11, 12, 8.5, 3.6), (20, 19, 9, 4), (13, 25, 6, 2.4)], 3)
    elif d == 'B':
        # 바닥에 깔린 긴 띠 하나와 위로 말려 올라가는 덩이, 왼쪽이 짙고 오른쪽은 흩어짐
        blobs(c, [(9, 17, 6, 6), (17, 20, 8, 3), (24, 22, 4.5, 2)], 8, core_ratio=0.5, sparse=0.9)
    else:
        # 손가락처럼 위로 뻗은 안개 — 팔 같은 세로 줄기 넷
        for i, (cx, top) in enumerate(((7, 9), (13, 5), (19, 7), (25, 11))):
            blobs(c, [(cx, (top + 27) / 2, 1.9, (27 - top) / 2)], 20 + i, core_ratio=0.45, sparse=0.3)
        blobs(c, [(16, 27, 12, 2.2)], 40, core_ratio=0.6, sparse=0.5)
        for (cx, top) in ((7, 9), (13, 5), (19, 7), (25, 11)):
            c.set(cx, top - 1, '+'); c.set(cx + 1, top - 2, '+') if top > 6 else None
    return c

N = {
 'A': '가로로 긴 안개 덩이 셋: 속 ! 한 덩이, 가장자리 +, 칸 안쪽 2칸 밖에서 끝남',
 'B': '왼쪽이 짙고 무겁게 말려 올라가고 오른쪽으로 갈수록 성기게 흩어지는 안개 띠 — 바닥에 낮게 깔림',
 'C': '바닥 안개에서 손가락·팔처럼 위로 뻗은 안개 줄기 넷(높이 제각각)',
}
for d in 'ABC':
    fog(d).emit(f'{CH}/fog_patch/h4-{d}.pxg', f'fog_patch h4-{d}')
    open(f'{CH}/fog_patch/h4-{d}.note', 'w', encoding='utf-8').write(N[d] + '\n')
