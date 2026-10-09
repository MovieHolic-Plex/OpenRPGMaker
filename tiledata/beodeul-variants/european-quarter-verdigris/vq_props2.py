# 녹청 지붕 저택가 거리 소품 2 — 통·상자·자루·말뚝·광고 기둥·기념 기둥·정원 문·문기둥·눈 더미·장작, 바닥 덧그림. 결정적.
from vq_props import *

def barrel(seed=1, lid=True):
    """나무 통(1x1칸): 윗면 둥근 뚜껑(널 결) + 볼록한 몸통(세로 널, 쇠 테 둘, 왼 빛·오른 그늘)."""
    pen = Pen(16, 18); cx = 8
    for y in range(5, 17):
        t = (y - 5) / 11.0; half = 6 + math.sin(t * math.pi) * 1.0
        for x in range(16):
            d = (x + .5 - cx) / half
            if abs(d) > 1: continue
            k = clamp(int(round(4 - d * 1.8)), 1, 6)
            if (x - 1) % 3 == 0: k -= 1
            pen.p(x, y, WOOD, k)
            if y in (7, 14): pen.p(x, y, IRON, clamp(k, 2, 5))
    ellipse_fill(pen, cx, 5, 6, 2.6, lambda x, y, d: pen.p(x, y, WOOD, (5 if (x % 3) else 4) if d < .6 else 3))
    return fin(pen.im, .72)

def barrel_stack(seed=1):
    """통 무더기(2x2칸): 아래 통 둘 + 위 통 하나(눕힌 통의 둥근 마구리)."""
    o = Image.new('RGBA', (32, 30)); b = barrel(seed)
    o.alpha_composite(b, (1, 12)); o.alpha_composite(b, (15, 12))
    pen = Pen(16, 14)
    ellipse_fill(pen, 8, 7, 6.5, 6.5, lambda x, y, d: pen.p(x, y, IRON if d > .78 else WOOD, (4 if x < 8 else 2) if d > .78 else (3 + (1 if (x + y) % 4 == 0 else 0) if d > .25 else 2)))
    o.alpha_composite(fin(pen.im, .72), (8, 0))
    return o

def crates(seed=1):
    """나무 상자 둘(1x1칸): 큰 상자(윗면 널 + 앞면 널·대각 버팀) 위 작은 상자."""
    pen = Pen(16, 18)
    def box(x0, y0, w, h, top):
        for y in range(y0, y0 + top):
            for x in range(x0, x0 + w): pen.p(x, y, WOOD, 5 if (y - y0) % 2 == 0 else 4)
        for y in range(y0 + top, y0 + h):
            for x in range(x0, x0 + w):
                k = 3 if (y - y0 - top) % 3 else 2
                if x in (x0, x0 + w - 1) or y == y0 + h - 1: k = 4 if x == x0 else 2
                pen.p(x, y, WOOD, k)
        for j in range(w - 2):
            pen.p(x0 + 1 + j, y0 + h - 2 - int(j * (h - top - 3) / max(1, w - 3)), WOOD, 4)
    box(1, 7, 14, 11, 3); box(4, 1, 9, 7, 2)
    return fin(pen.im, .72)

def sacks(seed=1):
    """자루 셋(1x1칸): 거친 삼베 자루(묶은 목 + 볼록한 몸, 왼 빛)."""
    pen = Pen(16, 14)
    for (cx, cy, r) in ((5, 9, 4.2), (11, 9, 4.2), (8, 6, 3.6)):
        ellipse_fill(pen, cx, cy, r, r * .95, lambda x, y, d, cx=cx, cy=cy: pen.p(x, y, GRAV, clamp(int(round(5 - (x + .5 - cx + y + .5 - cy) / r * 1.3)) - (1 if (x + y) % 3 == 0 else 0), 2, 6)))
        pen.p(int(cx), int(cy - r), GRAV, 3); pen.p(int(cx), int(cy - r) - 1, GRAV, 5)
    return fin(pen.im, .72)

def bollard():
    """돌 말뚝(1x1칸): 둥근 머리 크림 돌 기둥(왼 빛), 밑 그늘. 마차길·보도 경계."""
    pen = Pen(16, 16)
    for y in range(5, 15):
        for x in range(5, 11): pen.p(x, y, TRIM, (6, 5, 5, 4, 3, 2)[x - 5])
    ellipse_fill(pen, 8, 5, 3.2, 2.2, lambda x, y, d: pen.p(x, y, TRIM, 6 if x < 8 else 4))
    for x in range(5, 11): pen.p(x, 9, TRIM, 3)
    for x in range(4, 12): pen.dark(x, 15, .7)
    return fin(pen.im, .72)

def notice_column():
    """광고 기둥(1x2칸): 원통 기둥(크림) 위 녹청 돔 갓 + 붙인 종이 세 장(바랜 색 네모, 글자 없음) + 아래 돌 받침."""
    pen = Pen(16, 32); cx = 8
    for y in range(8, 29):
        for x in range(2, 14):
            d = (x + .5 - cx) / 6
            k = clamp(int(round(4.6 - (d + .3) * 2)), 1, 6)
            pen.p(x, y, CREAM, k)
    for (y0, y1, R, x0, x1) in ((10, 17, AWNC, 3, 9), (11, 19, FLOWR, 9, 13), (19, 26, AWNG, 4, 11)):
        for y in range(y0, y1):
            for x in range(x0, x1):
                d = (x + .5 - cx) / 6
                pen.p(x, y, R, clamp(int(round(4.5 - (d + .3) * 1.6)), 2, 6))
        for x in range(x0, x1): pen.dark(x, y1, .75)
    for x in range(1, 15): pen.p(x, 7, TRIM, 5 if x < cx else 3); pen.p(x, 8, TRIM, 3)
    for y in range(0, 7):
        half = 1 + y * .95
        for x in range(16):
            d = (x + .5 - cx) / half
            if abs(d) <= 1: pen.p(x, y, VERDL if d < -.2 else VERD, 4 if d < -.2 else (4 if d < .3 else 3))
    pen.p(cx, 0, VERDL, 6)
    for y in range(28, 32):
        for x in range(1, 15): pen.p(x, y, PLIN, 5 if y == 28 else (4 if x < cx else 3))
    return fin(pen.im, .72)

def monument_column():
    """광장 기념 기둥(2x4칸): 계단진 받침(윗면 빛 + 앞면 마름돌) 위 홈 판 크림 원기둥 + 기둥머리 + 녹청 구(동판 공 + 창끝). 앵커."""
    pen = Pen(32, 64); cx = 16
    for (y0, y1, w) in ((56, 64, 13), (50, 56, 10), (44, 50, 8)):
        for y in range(y0, y1):
            for x in range(cx - w, cx + w):
                ly = y - y0
                k = 6 if ly == 0 else (5 if ly == 1 else 4)
                if x < cx - w + 2: k = min(6, k + 1)
                if x >= cx + w - 2: k -= 1
                if ly > 1 and (x + (ly // 3) * 4) % 8 == 7: k = 3
                pen.p(x, y, TRIM if ly < 2 else CREAM, k)
    for y in range(14, 44):
        for x in range(cx - 4, cx + 4):
            k = (6, 5, 5, 4, 4, 3, 3, 2)[x - cx + 4]
            if (x - cx + 4) in (2, 5): k -= 1
            pen.p(x, y, CREAM if x > cx - 3 else TRIM, k)
    for y in range(10, 14):
        for x in range(cx - 6, cx + 6): pen.p(x, y, TRIM, 6 if y == 10 else (5 if x < cx else 3))
    ellipse_fill(pen, cx, 6, 4.5, 4.5, lambda x, y, d: pen.p(x, y, VERDL if (x < cx and y < 6) else VERD, 5 if (x < cx and y < 6) else (4 if d < .5 else 3)))
    for y in range(0, 3): pen.p(cx, y, VERDL, 6); pen.p(cx - 1, y + 1, VERDL, 4)
    return fin(pen.im, .7)

def gatepost(seed=1, urn=True):
    """정원 문기둥(1x2칸): 네모 크림 돌 기둥(앞면 마름돌 + 모서리 빛) + 갓돌 + 위 돌 항아리 또는 공."""
    pen = Pen(16, 32)
    for y in range(12, 32):
        for x in range(3, 13):
            row = (y - 12) // 5; ly = (y - 12) % 5
            k = 4 if ly else 5
            if ly == 4: k = 3
            if x < 5: k += 1
            if x > 10: k -= 1
            pen.p(x, y, CREAM, k)
    for x in range(2, 14): pen.p(x, 10, TRIM, 6 if x < 8 else 5); pen.p(x, 11, TRIM, 3)
    if urn:
        for y in range(3, 10):
            t = (y - 3) / 7.0; half = 4 - abs(t - .4) * 3
            for x in range(16):
                d = (x + .5 - 8) / max(1, half)
                if abs(d) <= 1: pen.p(x, y, TRIM, clamp(int(round(5 - d * 1.5)), 2, 6))
        for x in range(4, 12): pen.p(x, 3, TRIM, 6)
        crown(pen, 8, 1.5, 3.5, 2, seed, LEAF)
    else:
        ellipse_fill(pen, 8, 6, 4, 4, lambda x, y, d: pen.p(x, y, TRIM, 6 if (x < 8 and y < 6) else (4 if d < .6 else 3)))
    return fin(pen.im, .72)

def garden_gate(open_=False):
    """정원 쇠 대문(3x2칸): 양쪽 돌 문기둥(항아리 머리) + 가운데 쌍 쇠문(살 + 위 둥근 고리 무늬 + 창끝). open_ = 활짝 열린 문(가운데 걷기)."""
    o = Image.new('RGBA', (48, 32)); gp = gatepost(3, True)
    o.alpha_composite(gp, (0, 0)); o.alpha_composite(flip(gp), (32, 0))
    pen = Pen(48, 32)
    if not open_:
        for x in range(13, 35):
            t = (x - 24) / 11.0; top = int(12 + 4 * t * t)
            pen.p(x, top, IRON, 5); pen.p(x, top + 1, IRON, 2); pen.p(x, 22, IRON, 4); pen.p(x, 29, IRON, 4)
            if (x - 13) % 2 == 0:
                for y in range(top - 1, 31): pen.p(x, y, IRON, 4 if y < 24 else 3)
                pen.p(x, top - 2, IRON, 6)
        for y in range(13, 31): pen.p(24, y, IRON, 2)
        for cx in (18, 30):
            for a in range(10):
                t = a / 10 * math.tau; pen.p(int(cx + math.cos(t) * 2.5), int(25.5 + math.sin(t) * 2.5), IRON, 5)
    else:
        for side in (0, 1):
            x0 = 13 if side == 0 else 31
            for x in range(x0, x0 + 4):
                for y in range(14, 31): pen.p(x, y, IRON, 4 if (x - x0) % 2 == 0 else 1)
                pen.p(x, 13, IRON, 5)
    o.alpha_composite(fin(pen.im, .78))
    return o

def snow_heap(seed=1):
    """치워 쌓은 녹는 눈 더미(2x1칸): 둥근 눈 덩이(윗면 흰 빛 6 · 앞 그늘 3), 끝에 질척한 물기, 섞인 자갈 점."""
    pen = Pen(32, 16)
    for (cx, cy, rx, ry) in ((10, 10, 9, 5), (21, 10, 9, 5.5), (15, 7, 7, 4)):
        def f(x, y, d, cx=cx, cy=cy, rx=rx, ry=ry):
            k = 5.2 - ((x + .5 - cx) / rx * .9 + (y + .5 - cy) / ry * 1.8)
            if _h(x, y, seed) > .9: k -= 1
            pen.p(x, y, SNOW, clamp(int(round(k)), 2, 6))
        ellipse_fill(pen, cx, cy, rx, ry, f)
    for x in range(2, 30):
        if _h(x, 1, seed) > .4: pen.p(x, 15, SLUSH, 3)
    for i in range(6): pen.p(4 + int(_h(i, 3, seed) * 24), 8 + int(_h(i, 4, seed) * 6), COB, 3)
    return fin(pen.im, .8)

def firewood(seed=1):
    """장작 더미(2x1칸, 벽에 붙여 쌓는다): 둥근 마구리(나이테 점)가 보이는 쌓인 통나무 + 위 덮은 널."""
    pen = Pen(32, 20)
    for row in range(3):
        for i in range(7 - (row % 2)):
            cx = 3 + i * 4.3 + (2 if row % 2 else 0); cy = 17 - row * 4
            ellipse_fill(pen, cx, cy, 2.3, 2.2, lambda x, y, d, cx=cx, cy=cy: pen.p(x, y, BARK if d > .55 else WOOD, (3 if x > cx else 4) if d > .55 else (5 if d > .2 else 3)))
    for x in range(0, 32): pen.p(x, 4, WOOD, 5 if x < 16 else 4); pen.p(x, 5, WOOD, 2)
    return fin(pen.im, .72)

def stoop_steps():
    """현관 돌계단(2x1칸, 걷기 바닥 덧그림): 문 앞 낮은 계단 셋(윗면 밝게 6·5 + 앞모 3·2), 양끝 작은 볼 기둥."""
    pen = Pen(32, 16)
    for s in range(3):
        y0 = 1 + s * 5; x0 = 4 - s * 1; x1 = 28 + s * 1
        for x in range(x0, x1):
            pen.p(x, y0, TRIM, 6 if x < 16 else 5); pen.p(x, y0 + 1, TRIM, 5); pen.p(x, y0 + 2, TRIM, 4)
            pen.p(x, y0 + 3, TRIM, 3); pen.p(x, y0 + 4, TRIM, 2)
    return pen.im

# ---------------------------------------------------------------- 바닥 덧그림(걷기, 사람 아래)
def decal_puddle(seed=1):
    """작은 물웅덩이(1x1칸): 흐린 하늘을 비춘 납작한 물(가장자리 젖은 돌 짙게, 가운데 빛 줄 하나)."""
    pen = Pen(16, 16)
    ellipse_fill(pen, 8, 9, 6.5, 3.4, lambda x, y, d: pen.p(x, y, PUD, 2 if d > .6 else (3 if _h(x, y, seed) > .3 else 4), 230))
    for x in range(5, 10): pen.p(x, 8, PUD, 5, 230)
    pen.p(10, 10, PUD, 6, 230)
    return pen.im

def decal_leaves(seed=1):
    """젖은 낙엽 흩어짐(1x1칸): 누른·갈색 잎 2~3화소, 방향 제각각."""
    pen = Pen(16, 16)
    for k in range(9):
        x0 = 1 + int(_h(k, 1, seed) * 13); y0 = 2 + int(_h(k, 2, seed) * 12)
        R = FLOWY if _h(k, 3, seed) > .5 else BARK
        t = 3 + int(_h(k, 4, seed) * 3)
        pen.p(x0, y0, R, t); pen.p(x0 + 1, y0, R, t - 1)
        if _h(k, 5, seed) > .5: pen.p(x0 + 1, y0 + 1, R, t - 2)
    return pen.im

def decal_manhole():
    """맨홀 쇠 뚜껑(1x1칸): 둥근 쇠판(동심 홈 + 십자 결), 테두리 돌."""
    pen = Pen(16, 16)
    ellipse_fill(pen, 8, 8, 6.4, 5, lambda x, y, d: pen.p(x, y, IRON, 2 if d > .82 else (4 if (x + y) % 3 == 0 else 3)))
    ellipse_fill(pen, 8, 8, 3.2, 2.4, lambda x, y, d: pen.p(x, y, IRON, 2 if d > .7 else 4))
    pen.p(6, 6, IRON, 5); pen.p(7, 5, IRON, 5)
    return pen.im

def decal_drain():
    """빗물받이 쇠창살(1x1칸): 보도 끝 네모 창살(살 사이 어둠)."""
    pen = Pen(16, 16)
    for y in range(4, 12):
        for x in range(3, 13):
            if x in (3, 12) or y in (4, 11): pen.p(x, y, IRON, 4 if (x == 3 or y == 4) else 2)
            else: pen.p(x, y, DARK, 1 if (x % 2) else 3)
    return pen.im

def decal_mosscrack(seed=1):
    """돌 틈 이끼·금(1x1칸): 꺾인 금 줄(어둠) 따라 이끼 점."""
    pen = Pen(16, 16); x, y = 2, 4
    for i in range(14):
        pen.p(x, y, DARK, 3)
        if _h(i, 1, seed) > .4: pen.p(x, y - 1, MOSS, 4)
        if _h(i, 2, seed) > .6: pen.p(x + 1, y + 1, MOSS, 3)
        x += 1; y += (1 if _h(i, 3, seed) > .55 else 0) - (1 if _h(i, 4, seed) > .8 else 0)
    return pen.im

def decal_hatch():
    """지하 저장고 덧문(2x1칸, 보도 위 비스듬한 나무 쌍문 + 쇠 경첩). 걷기 바닥 덧그림(내려가는 이벤트 자리)."""
    pen = Pen(32, 16)
    for y in range(2, 15):
        for x in range(3, 29):
            k = 4 if (x - 3) % 4 else 3
            if x in (15, 16): k = 1
            if y in (2,): k = 5
            if y == 14: k = 2
            pen.p(x, y, WOOD, k)
    for x in (7, 23):
        for y in (4, 11): pen.p(x, y, IRON, 5); pen.p(x + 1, y, IRON, 3); pen.p(x + 2, y, IRON, 3)
    for x in range(2, 30): pen.p(x, 1, TRIM, 5); pen.p(x, 15, TRIM, 3)
    return pen.im
