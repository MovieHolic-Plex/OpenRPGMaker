import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'portrait_eyes', 'work'))
from h1_lib import Canvas
NOTES = {
 'A': "A: 학생 책상(쇠 다리+나무 윗판)의 오른쪽 앞다리가 부러져 윗판이 오른쪽으로 기울고, 부러진 다리 토막이 바닥에 누웠다. 의자는 등받이 쪽으로 뒤집혀 오른쪽에 쓰러짐. 윗판에 칼 낙서 줄 세 개. 윗면이 칸 높이 3/4 쯤 보이는 낮은 시점.",
 'B': "B: 왼쪽 위 빛 — 윗판 왼쪽·윗모서리가 밝고 앞판과 다리 안쪽은 깊게 어둡다. 낙서 홈은 어두운 줄+밝은 언저리. 기운 책상 오른쪽 아래에 반투명 접촉 그림자(~ -).",
 'C': "C: 실루엣 재해석 — 책상이 무릎 꿇은 듯 오른쪽으로 크게 기울고 부러진 다리가 뼈처럼 밖으로 꺾였다. 의자가 그 옆에서 다리를 책상 쪽으로 뻗어 붙잡으려는 모양. 어긋난 곳은 꺾인 다리와 뻗은 의자 다리.",
}
def top_y(x, kind):
    s = {'A': 5, 'B': 5, 'C': 3}[kind]
    return 3 + x // s
def desk(c, kind):
    W = 10
    for x in range(0, W):
        t = top_y(x, kind)
        lit = 1 if (kind == 'B' and x < 4) else 0
        cols = [6 if kind != 'C' else 5, 5, 5 - (1 if kind == 'B' and x > 5 else 0)]
        for i, s in enumerate(cols): c.px(x, t + i, f'rot:{s + lit if kind=="B" else s}')
        # 앞판 두께
        c.px(x, t + 3, 'rot:3' if kind != 'B' else ('rot:3' if x < 5 else 'rot:2')); c.px(x, t + 4, 'rot:1')
        # 옆(위 가장자리) 밝은 줄
    for i in range(3): c.px(0, top_y(0, kind) + i, 'rot:6'); 
    c.px(W - 1, top_y(W - 1, kind) + 1, 'rot:3'); c.px(W - 1, top_y(W - 1, kind) + 2, 'rot:3')  # 오른쪽 옆면
    # 낙서
    t0 = top_y(3, kind)
    for (x, y) in ((2, 1), (3, 1), (4, 1), (5, 1)): c.px(x, top_y(x, kind) + 1, 'rot:1')
    for (x, dy) in ((3, 2), (4, 2)): c.px(x, top_y(x, kind) + dy, 'rot:2')
    c.px(6, top_y(6, kind), 'rot:1'); c.px(7, top_y(7, kind) + 1, 'rot:1'); c.px(1, top_y(1, kind) + 2, 'rot:2')
    if kind == 'B':
        for x in (2, 3, 4, 5): c.px(x, top_y(x, kind) + 2, 'rot:6')
    # 왼쪽 앞다리
    e = top_y(1, kind) + 5
    for y in range(e, 15):
        c.px(1, y, 'tin:4' if kind != 'B' else 'tin:5'); c.px(2, y, 'tin:2')
    c.px(0, 15, 'tin:2'); c.px(1, 15, 'tin:1'); c.px(2, 15, 'tin:1')
    # 뒤쪽 다리(어둡게)
    e2 = top_y(6, kind) + 5
    for y in range(e2, 14): c.px(5, y, 'tin:2')
    # 오른쪽 부러진 다리: 짧은 토막
    e3 = top_y(8, kind) + 5
    for y in range(e3, e3 + 2): c.px(8, y, 'tin:3'); c.px(9, y, 'tin:1')
    c.px(7, e3 + 2, 'tin:2') if kind != 'C' else None
    # 아래 그림자
    for x in range(2, 8):
        for y in (14, 15):
            if c.get(x, y) is None: c.px(x, y, 'void:2' if kind != 'B' else 'void:1')
    # 앞판 아래 그늘 한 줄
    for x in range(1, 9): c.px(x, top_y(x, kind) + 5, 'void:2') if c.get(x, top_y(x, kind) + 5) is None else None
def fallen_leg(c, kind):
    if kind == 'C':
        # 뼈처럼 밖으로 꺾인 다리
        for i, (x, y) in enumerate(((8, 11), (9, 12), (9, 13), (10, 13), (11, 14))): c.px(x, y, 'tin:4'); c.px(x + 1, y, 'tin:2') if x < 11 else None
        c.px(11, 14, 'tin:5'); c.px(12, 14, 'tin:2')
    else:
        for x in range(4, 10): c.px(x, 14 if kind != 'A' else 14, 'tin:3'); c.px(x, 15, 'tin:1')
        c.px(4, 14, 'tin:5'); c.px(9, 14, 'tin:1'); c.px(9, 13, 'tin:5')  # 부러진 끝 톱니
def chair(c, kind):
    if kind == 'C':
        # 옆으로 누워 다리를 책상 쪽으로 뻗음
        for x in range(11, 16):
            for y in range(9, 14): c.px(x, y, 'vdwood:4' if y < 11 else 'vdwood:3')
        for x in range(11, 16): c.px(x, 13, 'vdwood:1'); c.px(x, 9, 'vdwood:5')
        for (x, y) in ((10, 9), (9, 9), (8, 8), (10, 12), (9, 12), (8, 13)): c.px(x, y, 'tin:4')
        c.px(15, 9, None); c.px(15, 8, None)
        for x in range(12, 16): c.px(x, 14, 'vdwood:2'); c.px(x, 15, 'vdwood:1')
        return
    # 등받이가 바닥, 좌판이 세워짐
    for y in range(8, 14):
        for x in range(12, 15): c.px(x, y, 'vdwood:5' if (x == 12) else 'vdwood:4')
        c.px(14, y, 'vdwood:3')
    for x in range(12, 15): c.px(x, 8, 'vdwood:6' if kind != 'B' else 'vdwood:6')
    for x in range(10, 16): c.px(x, 14, 'vdwood:3'); c.px(x, 15, 'vdwood:1')   # 등받이(누움)
    c.px(15, 14, 'vdwood:1')
    # 다리 두 개가 위/왼쪽으로 삐죽
    for x in (10, 11): c.px(x, 9, 'tin:4'); c.px(x, 12, 'tin:3')
    c.px(10, 9, 'tin:5'); c.px(10, 12, 'tin:4')
    c.px(15, 8, None)
def build(kind):
    c = Canvas('broken_desk', 16, 16)
    desk(c, kind)
    fallen_leg(c, kind)
    chair(c, kind)
    if kind == 'B':
        for y in range(9, 16):
            for x in (10, 11, 15):
                if c.get(x, y) is None and x < 16: c.px(x, y, '-')
        for x in range(6, 16):
            if c.get(x, 15) is None: c.px(x, 15, '~')
    c.px(0, 0, None); c.px(15, 0, None)
    return c
if __name__ == '__main__':
    for k in 'ABC': build(k).save(f'h1-{k}', NOTES[k])
    print('ok')
