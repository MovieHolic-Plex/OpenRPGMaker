import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'portrait_eyes', 'work'))
from h1_lib import Canvas
NOTES = {
 'A': "A: v5 커튼 창을 1x2 로 키운 낡은 판 — 밤 유리(달 하나, 십자 창살), 왼쪽 벨벳은 온전, 오른쪽은 위쪽만 걸리고 찢겨 아래 절반이 바닥에 뭉쳐 떨어졌다. 창 아래 빈 벽에 창살 모양 달빛 번짐(?).",
 'B': "B: 왼쪽 위 달빛 — 창틀·주름의 왼쪽 면이 밝고 오른쪽이 깊게 어둡다. 유리에 달 빛줄기. 오른쪽으로 반투명 접촉 그림자(~ -), 달빛 번짐은 더 길고 비스듬하다.",
 'C': "C: 실루엣 재해석 — 찢긴 오른쪽 커튼이 다섯 갈래 손가락처럼 길게 늘어져 한 가닥은 바닥까지 닿는다. 창틀 십자는 그대로라 낯익음과 어긋남이 함께 읽힌다. 어긋난 곳은 손가락 갈래.",
}
def glass(c, kind):
    for y in range(4, 25):
        for x in range(5, 11):
            s = 0 if y < 9 else (1 if y < 17 else 2)
            c.px(x, y, f'vglass:{s}')
    # 달
    cx, cy = 6, 8
    for (dx, dy, s) in ((0,0,5),(1,0,5),(0,1,4),(1,1,4),(-1,0,3),(2,0,3),(0,-1,3),(1,-1,3),(0,2,3),(1,2,3),(-1,1,3)):
        if kind == 'B' and dx >= 1: s -= 1
        c.px(cx+dx, cy+dy, f'moon:{max(0,min(5,s))}')
    # 별/얼룩
    c.px(9, 6, 'moon:3'); c.px(10, 11, 'vglass:3'); c.px(9, 20, 'vglass:3')
    if kind == 'B':
        for i in range(6): c.px(5 + i, 18 + i // 3 if False else 17 + i // 2, 'vglass:3')
    # 창살
    for y in range(4, 25):
        c.px(7, y, 'rot:4' if kind != 'C' else 'rot:3'); c.px(8, y, 'rot:2')
    for x in range(5, 11): c.px(x, 14, 'rot:4'); c.px(x, 15, 'rot:2')
    # 금
    c.px(9, 17, 'vglass:5'); c.px(10, 18, 'vglass:4') 
def frame(c, kind):
    for y in range(3, 27):
        c.px(4, y, 'rot:4' if kind == 'B' else 'rot:3'); c.px(11, y, 'rot:1')
    for x in range(4, 12):
        c.px(x, 3, 'rot:4'); 
    for x in range(4, 12):
        c.px(x, 24 + 1, 'rot:3')
    for x in range(3, 13):
        c.px(x, 26, 'rot:4' if x < 8 else 'rot:2')
        c.px(x, 27, 'rot:1')
    c.px(3, 26, 'rot:5'); c.px(12, 27, 'rot:0')
    # 창턱 먼지
    for x in (4, 5, 9, 10): c.px(x, 25, 'dust:3')
def rod(c, kind):
    for x in range(0, 16): c.px(x, 1, 'vbrass:5' if x < 8 else 'vbrass:3'); c.px(x, 2, 'vbrass:2')
    c.px(0, 0, 'vbrass:6'); c.px(15, 0, 'vbrass:3') if False else None
    for x in (2, 6, 13): c.px(x, 0, 'vbrass:4')
def pleat(x0, w, y, y1, c, sh, lit=0):
    pass
LEFT = [2, 4, 5, 3, 1]
def left_curtain(c, kind, x0=0, ylo=27):
    prof = LEFT if kind != 'B' else [3, 5, 4, 2, 0]
    for i, s in enumerate(prof):
        for y in range(3, ylo + 1):
            v = s + (1 if y < 8 and s < 5 else 0) - (1 if y > ylo - 3 else 0)
            c.px(x0 + i, y, f'velv:{max(0,min(5,v))}')
    for y in range(3, ylo + 1, 4):   # 주름 어둡게
        c.px(x0 + 3, y, 'velv:1')
    for x in range(x0, x0 + 5): c.px(x, ylo, 'velv:0')
    c.px(x0 + 1, ylo - 1, 'velv:1'); c.px(x0 + 4, ylo, 'velv:0')
    c.px(x0 + 2, ylo - 2, 'velv:3'); c.px(x0, ylo - 4, 'velv:1')
    c.px(x0 + 4, 10, 'velv:5')  # 매듭
    for (x, y) in ((1, 20), (2, 21), (3, 19)): c.px(x, y, 'dust:2')
def right_top(c, kind, hang):
    # 오른쪽 커튼: x=11..15, 위쪽만 남음. hang: 열별 늘어진 길이
    prof = [1, 3, 5, 4, 2] if kind != 'B' else [2, 4, 3, 1, 0]
    for i, s in enumerate(prof):
        x = 11 + i
        for y in range(3, 3 + hang[i]):
            v = s + (1 if y < 8 and s < 5 else 0)
            c.px(x, y, f'velv:{max(0,min(5,v))}')
        yy = 3 + hang[i] - 1
        c.px(x, yy, 'velv:0'); 
        if hang[i] > 3: c.px(x, yy - 1, 'velv:1')
def pile(c, kind, x0=7):
    # 바닥에 떨어져 뭉친 절반 (하단 y=27..31)
    rows = {31: (x0 + 1, 15), 30: (x0 + 1, 15), 29: (x0 + 3, 14), 28: (x0 + 5, 13)}
    for y, (a, b) in rows.items():
        for x in range(a, b + 1):
            s = 3 + ((x + y) % 3) - (1 if x > 11 else 0) + (1 if y < 30 else 0)
            if kind == 'B': s = 4 - (x - a) // 3 + (1 if y < 30 else 0)
            c.px(x, y, f'velv:{max(0,min(5,s))}')
        c.px(a, y, 'velv:1'); c.px(b, y, 'velv:1')
    for x in range(x0 + 1, 16): c.px(x, 31, 'velv:0')
    for (x, y) in ((11, 29), (12, 30), (9, 30), (13, 28)): c.px(x, y, 'velv:5')
    for (x, y) in ((10, 29), (14, 30)): c.px(x, y, 'velv:0')
    c.px(x0 + 2, 29, 'velv:5') if False else None
def moonspill(c, kind):
    if kind == 'B':
        pats = [(0, 28, 3), (5, 28, 3), (1, 29, 3), (6, 29, 3), (2, 30, 3), (7, 30, 2), (3, 31, 3)]
    else:
        pats = [(1, 28, 3), (5, 28, 3), (1, 29, 3), (5, 29, 3), (2, 30, 3), (6, 30, 2)]
    # 창살 모양 두 줄
    for (x, y, w) in pats:
        for i in range(w):
            if c.get(x + i, y) is None: c.px(x + i, y, '?')
def build(kind):
    c = Canvas('curtain_torn', 16, 32)
    rod(c, kind); frame(c, kind); glass(c, kind)
    left_curtain(c, kind)
    if kind == 'C':
        hang = [10, 5, 21, 8, 15]   # 갈래: 하나는 바닥 가까이
        prof = [1, 3, 5, 4, 2]
        right_top(c, kind, [22, 4, 12, 7, 19])
        # 갈래 사이 틈(찢김)
        for y in range(9, 26):
            for x in (12,):
                if y > 7: c.px(x, y, None)
        for y in range(15, 28): c.px(14, y, None) if y < 22 else None
        for y in range(3, 3 + 5): pass
        # 긴 갈래 끝 = 손끝
        c.px(11, 26, 'velv:0'); c.px(15, 22, 'velv:0'); c.px(15, 23, 'velv:1')
        for x in range(11, 16): c.px(x, 2, 'vbrass:2')
        # 발치 뭉친 자락 작게
        for x in range(9, 16):
            c.px(x, 31, 'velv:0'); c.px(x, 30, 'velv:2' if x % 2 else 'velv:3')
        for x in range(11, 15): c.px(x, 29, 'velv:2')
    else:
        # 위쪽 걸린 부분 + 대각선 찢김
        right_top(c, kind, [9, 8, 6, 4, 3])
        # 찢어진 조각 하나가 대각선으로 늘어짐
        for i in range(7):
            c.px(15 - min(i, 2), 12 + i, 'velv:2' if kind != 'B' else 'velv:1')
            c.px(14 - min(i, 2), 12 + i, 'velv:3' if kind != 'B' else 'velv:0')
        c.px(15, 19, 'velv:0'); c.px(13, 18, 'velv:0')
        pile(c, kind)
    moonspill(c, kind)
    if kind == 'B':
        # 오른쪽 접촉 그림자는 오른쪽 열에 없으면 안 되므로 커튼 왼쪽 벽 쪽 빈칸에
        for y in range(3, 28):
            if c.get(15, y) is None: c.px(15, y, '~')
    # 위 모서리·아래 모서리 비움
    c.px(0, 0, None); c.px(15, 0, None); c.px(0, 31, None); c.px(15, 31, None) if kind == 'C' else None
    c.px(0, 31, None); c.px(0, 30, None)
    return c
if __name__ == '__main__':
    for k in 'ABC':
        build(k).save(f'h1-{k}', NOTES[k])
    print('ok')
