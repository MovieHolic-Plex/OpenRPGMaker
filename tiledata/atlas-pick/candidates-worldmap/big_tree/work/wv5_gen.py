"""wv5 big_tree — 32x32 icon(object). 덩이(원) 여섯~여덟을 뒤→앞 순서로 겹쳐 수관을 만들고,
덩이별 윗왼 광원으로 wleaf 단계를 정한다. 줄기·뿌리는 wbark. 난수 없음(결정적 점무늬)."""
import os, sys, math
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from wv5lib import Cv, shadow_pass, to_pxg
OUT = os.path.abspath(os.path.join(HERE, '..'))
L = lambda n: ('wleaf', n)
B = lambda n: ('wbark', n)

def crown(cv, lumps, steps, tex, rim=True):
    """lumps: (cx,cy,r) 뒤→앞. steps: 밝기 t(-1..1)->wleaf 단계 경계."""
    owner = {}
    for i, (cx, cy, r) in enumerate(lumps):
        for y in range(cv.h):
            for x in range(cv.w):
                if (x + .5 - cx) ** 2 + (y + .5 - cy) ** 2 <= r * r: owner[(x, y)] = i
    for (x, y), i in owner.items():
        cx, cy, r = lumps[i]
        t = ((x + .5 - cx) * -.62 + (y + .5 - cy) * -.78) / r      # +1 = 윗왼 끝
        d = r - math.hypot(x + .5 - cx, y + .5 - cy)                # 덩이 가장자리까지
        s = 3
        for k, th in enumerate(steps):
            if t > th: s = 5 - k if False else [5, 4, 3, 2, 1][k]; break
        else: s = 1
        # 결정적 잎 점무늬: 밝은 쪽에 한 단계 밝게, 어두운 쪽에 한 단계 어둡게
        if tex and (x * 3 + y * 5) % 7 == 0 and 2 <= s <= 4: s += 1 if t > 0 else -1
        # 덩이 가장자리(이웃 화소가 다른 덩이거나 밖)
        edge_out = any((x + dx, y + dy) not in owner for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)))
        edge_in = any(owner.get((x + dx, y + dy), i) < i for dx, dy in ((-1, 0), (0, -1))) and False
        if edge_out: s = 0 if (t < .35 or not rim) else 1
        cv.put(x, y, L(s))
    # 앞 덩이가 뒤 덩이를 가리는 경계: 뒤 덩이 쪽 한 줄을 어둡게(윗왼→아랫오른 접힘)
    for (x, y), i in list(owner.items()):
        for dx, dy in ((1, 0), (0, 1), (1, 1)):
            j = owner.get((x + dx, y + dy))
            if j is not None and j > i:
                v = cv.get(x, y)
                if v and v[1] > 1: cv.put(x, y, L(v[1] - 1 if v[1] > 2 else 1))
    return owner

def trunk(cv, top, bot, xl, xr, flare, roots, hi=3, lit=True):
    """줄기: 위 top~bot, 폭 xl..xr, 아래 flare 줄은 좌우로 벌어짐. 왼쪽 밝음(hi) / 가운데 2 / 오른쪽 1 / 바깥 0"""
    for y in range(top, bot + 1):
        f = max(0, y - (bot - flare)); l = xl - f; r = xr + f
        for x in range(l, r + 1):
            v = 0 if x in (l, r) else (hi if x == l + 1 and lit else (1 if x >= r - 1 else 2))
            if y == bot and 0 < x - l < r - l: v = 0
            cv.put(x, y, B(v))
    for (x, y, v) in roots: cv.put(x, y, B(v))

def bark_marks(cv, marks):
    for (x, y) in marks: 
        if cv.get(x, y) and cv.get(x, y)[0] == 'wbark': cv.put(x, y, B(0))

def make(kind):
    cv = Cv(32, 32)
    if kind == 'A':   # 세계 지도 큰 나무 구조: 큰 둥근 수관 + 굵은 줄기 + 뿌리
        trunk(cv, 21, 30, 13, 18, 3, [])
        lumps = [(16, 12, 9), (8, 14, 7), (24, 14, 7), (11, 8, 6.5), (21, 8, 6.5), (16, 5, 5.5), (16, 17, 7.5)]
        crown(cv, lumps, [.55, .2, -.15, -.5], True)
        bark_marks(cv, [(15, 24), (16, 26), (15, 28)])
    elif kind == 'B':  # 깊이 강조: 덩이 여덟, 강한 명암, 안쪽 깊은 틈, 옹이진 줄기 + 드러난 뿌리
        trunk(cv, 20, 30, 12, 19, 4, [(9, 30, 0), (10, 29, 1), (22, 30, 0), (21, 29, 1), (11, 30, 0), (20, 30, 0)], hi=3)
        lumps = [(16, 14, 10), (7, 16, 6.5), (25, 16, 6.5), (10, 9, 6), (22, 9, 6), (16, 6, 5.5), (12, 18, 6), (21, 18, 6)]
        crown(cv, lumps, [.5, .15, -.2, -.55], True)
        bark_marks(cv, [(15, 23), (14, 26), (17, 25), (16, 28), (13, 29)])
    else:              # C: 다른 해석 — 옆으로 넓게 퍼진 세 층 구름형 수관 + 굽은 줄기, 위로 갈수록 작음
        trunk(cv, 18, 30, 13, 17, 5, [(8, 30, 0), (9, 29, 1), (24, 30, 0), (23, 29, 1)], hi=3)
        lumps = [(8, 14, 6.5), (24, 14, 6.5), (16, 15, 8.5), (10, 10, 6), (22, 10, 6), (16, 9, 6.5), (12, 5, 4.5), (20, 5, 4.5), (16, 4, 4)]
        crown(cv, lumps, [.6, .25, -.1, -.45], False)
        bark_marks(cv, [(15, 22), (15, 26), (14, 28)])
    shadow_pass(cv, near=((1, 1), (2, 1), (1, 0), (0, 1)), far=((2, 2), (3, 2), (3, 1)))
    return cv

if __name__ == '__main__':
    X = sys.argv[1] if len(sys.argv) > 1 else 'A'
    cv = make(X)
    open(os.path.join(OUT, f'wv5-{X}.pxg'), 'w').write(to_pxg(cv.a, f'big_tree wv5-{X}'))
    notes = {'A': 'A: World.png 구조 — 큰 둥근 수관(덩이 일곱, 윗왼 밝게)과 굵은 줄기, 아래로 벌어지는 뿌리.',
             'B': 'B: 깊이 강조 — 덩이 여덟이 겹치고 덩이 사이 어두운 틈, 잎 점무늬, 드러난 뿌리.',
             'C': 'C: 다른 해석 — 옆으로 넓게 퍼진 층층 구름형 수관과 낮고 넓은 밑동.'}
    open(os.path.join(OUT, f'wv5-{X}.note'), 'w').write(notes[X] + '\n')
