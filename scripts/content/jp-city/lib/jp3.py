"""일본 골목 v3 — 벽을 「기둥·보·들어간 패널·돌 밑단」으로 짠다(버들항 문법). 그림자는 이미 그려진 픽셀을 한 단 낮춰서 낸다.
문은 틀 안에서 땅(밑단 돌)에 닿고 16px 칸 격자에 맞춘다."""
import os, sys, random, math
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from jp import *
import jp, jp2, post
from jp2 import tiles_roof, namako, vending2, block_wall2, put2
from hip3 import hip3
from PIL import Image

def shade(c, x, y, w, h, dt, only=None):
    for j in range(y, y + h):
        for i in range(x, x + w):
            if 0 <= i < c.w and 0 <= j < c.h and c.a[j, i, 3]:
                f = post.fam(c.a, i, j)
                if only is None or f in only: c.a[j, i, :3] = post.step(c.a[j, i], dt)

PLASTER = ('kinari', 'shiro', 'conc')
def hashira(c, x, y, h, w=4):
    """기둥: 왼쪽 밝은 줄·몸통·오른쪽 어두운 줄 + 오른쪽 벽면으로 2px 그림자."""
    c.R(x, y, w, h, K('ita', 1)); c.VL(x, y, h, K('ita', 3)); c.VL(x + 1, y, h, K('ita', 2)); c.VL(x + w - 1, y, h, K('ita', -2))
    shade(c, x + w, y, 2, h, -1, PLASTER); shade(c, x + w, y, 1, h, -1, PLASTER)

def nageshi(c, x, y, w, t=3):
    """보(가로재): 윗줄 밝게·몸통·아랫줄 어둡게 + 아래로 3px 그림자."""
    c.R(x, y, w, t, K('ita', 1)); c.HL(x, y, w, K('ita', 4)); c.HL(x, y + t - 1, w, K('ita', -2))
    shade(c, x, y + t, w, 2, -1, PLASTER); shade(c, x, y + t, w, 1, -1, PLASTER)

def panel_shadow(c, x, y, w, h):
    """들어간 회벽 패널: 위쪽 3px·왼쪽 2px 안쪽 그늘(보·기둥이 튀어나와 있으므로)."""
    shade(c, x, y, w, 3, -1, PLASTER); shade(c, x, y, w, 1, -1, PLASTER); shade(c, x, y, 2, h, -1, PLASTER)

def ishidai(c, x, y, w, h=8):
    """돌 밑단: 윗면 2(밝음) + 앞면 블록 줄눈 + 바닥 어두움."""
    c.R(x, y, w, h, K('hodo', 2)); c.HL(x, y, w, K('hodo', 6)); c.HL(x, y + 1, w, K('hodo', 4))
    for i in range(0, w, 12): c.VL(x + i + (6 if (y // 4) % 2 else 0) % 12, y + 2, h - 3, K('hodo', 0))
    c.HL(x, y + 4, w, K('hodo', 1)); c.HL(x, y + h - 1, w, K('hodo', -1))

def koshi(c, x, y, w, h):
    """격자(고시): 안쪽 어둠 + 세로 나무살 2px 간격 4px. 살 왼쪽 밝음·오른쪽 어둠. 위 보·아래 받침."""
    c.R(x, y, w, h, K('ita', -3)); 
    for i in range(x + 1, x + w - 2, 4):
        c.R(i, y + 1, 2, h - 2, K('ita', 1)); c.VL(i, y + 1, h - 2, K('ita', 3)); c.VL(i + 1, y + 1, h - 2, K('ita', -1))
    c.R(x, y, w, 2, K('ita', 0)); c.HL(x, y, w, K('ita', 3)); c.HL(x, y + 2, w, K('ita', -2))
    shade(c, x, y + 3, w, 4, -1, ('ita',))

def mushiko(c, x, y, w, h):
    """무시코창(2층 횡살 회벽창): 깊은 틀 + 가로 살 + 안쪽 어둠."""
    c.R(x - 2, y - 2, w + 4, h + 4, K('ita', -3)); c.R(x, y, w, h, K('ita', -3))
    for j in range(y + 1, y + h - 1, 4): c.R(x + 1, j, w - 2, 2, K('kinari', 2)); c.HL(x + 1, j, w - 2, K('kinari', 4)); c.HL(x + 1, j + 2, w - 2, K('ita', -2))
    c.HL(x - 2, y - 2, w + 4, K('ita', 1)); c.HL(x - 2, y + h + 2, w + 4, K('kinari', 3)); c.HL(x - 2, y + h + 3, w + 4, K('ita', -3))

def shoji(c, x, y, w, h, lit=True):
    """장지창(미닫이 종이 + 격자): 들어간 틀(위 3 · 왼 2 그림자) + 종이 + 살 + 튀어나온 문턱."""
    c.R(x - 2, y - 2, w + 4, h + 3, K('ita', -3)); c.R(x, y, w, h, K('mado', 2) if lit else K('kinari', 3))
    c.R(x, y, w, 3, K('mado', 0) if lit else K('kinari', 1)); c.R(x, y, 2, h, K('mado', 1) if lit else K('kinari', 2))
    for i in range(x + 5, x + w - 1, 6): c.VL(i, y, h, K('ita', 0)); c.VL(i + 1, y, h, K('ita', 2))
    for j in range(y + 6, y + h - 1, 7): c.HL(x, j, w, K('ita', 0)); c.HL(x, j + 1, w, K('ita', 2))
    c.HL(x - 2, y - 2, w + 4, K('ita', 2)); c.R(x - 3, y + h + 1, w + 6, 2, K('ita', 3)); c.HL(x - 3, y + h + 1, w + 6, K('ita', 5)); c.HL(x - 3, y + h + 3, w + 6, K('ita', -2))
    shade(c, x - 3, y + h + 4, w + 6, 2, -1, PLASTER)

def door_bay(c, x, w, base, h=30, noren_col=None):
    """문: 틀 안에서 땅에 닿는다. 들어간 문(위 그림자 4) + 격자 유리 미닫이 + 돌 문턱 계단 3px. base = 문 밑변 y."""
    top = base - h
    c.R(x - 2, top - 3, w + 4, h + 3, K('ita', -3))
    c.R(x, top, w, h, K('ita', 0)); half = w // 2
    for k in (0, 1):
        x0 = x + k * half
        c.R(x0 + 1, top + 2, half - 2, h - 10, K('garasu', 4))
        for i in range(x0 + 4, x0 + half - 1, 4): c.VL(i, top + 2, h - 10, K('ita', -1))
        for j in range(top + 8, top + h - 10, 8): c.HL(x0 + 1, j, half - 2, K('ita', -1))
        c.R(x0 + 1, top + 2, half - 2, 2, K('garasu', 2))
        c.R(x0 + 1, top + h - 7, half - 2, 7, K('ita', 1)); c.HL(x0 + 1, top + h - 7, half - 2, K('ita', 3))
    c.VL(x + half, top, h, K('ita', -2)); c.R(x + half - 3, top + h // 2 - 2, 1, 5, K('tekko', 4)); c.R(x + half + 2, top + h // 2 - 2, 1, 5, K('tekko', 4))
    c.R(x - 3, base - 2, w + 6, 2, K('hodo', 5)); c.HL(x - 3, base - 2, w + 6, K('hodo', 6)); c.HL(x - 3, base - 1, w + 6, K('hodo', 1))
    shade(c, x, top, w, 3, -1, ('ita', 'garasu'))
    if noren_col: jp.noren(c, x + 1, top + 1, w - 2, 16, noren_col)

def machiya(W_, H_, seed):
    """기와 2층 마치야: 깊은 지붕(48) + 2층(무시코창·보·기둥) + 기와 히사시 + 1층(고시·문·노렌) + 돌 밑단. 문 x 는 16px 칸 격자."""
    c = Cv(W_, H_); T = 48
    hip3(c, 0, 0, W_, T, 'kawara')
    for i in range(0, W_, 1): c.P(i, T - 1, K('kawara', -3)) if False else None
    y2 = T + 3; h2 = 34
    c.R(0, y2, W_, h2, K('kinari', 1)); shade(c, 0, y2, W_, 4, -1, PLASTER)
    # 2층
    nageshi(c, 0, y2, W_, 4)
    mushiko(c, W_ // 2 - 12, y2 + 11, 24, 14)
    hashira(c, 0, y2, h2); hashira(c, W_ - 4, y2, h2); hashira(c, W_ // 2 - 26, y2, h2); hashira(c, W_ // 2 + 22, y2, h2)
    panel_shadow(c, 4, y2 + 4, W_ // 2 - 30, h2 - 4); panel_shadow(c, W_ // 2 + 26, y2 + 4, W_ // 2 - 30, h2 - 4)
    c.R(W_ // 2 - 30, y2 + h2 - 4, 60, 3, K('ita', 1)); c.HL(W_ // 2 - 30, y2 + h2 - 4, 60, K('ita', 3)); c.HL(W_ // 2 - 30, y2 + h2 - 2, 60, K('ita', -2))
    # 히사시
    ey = y2 + h2
    jp.eave(c, -3, ey, W_ + 6, 'kawara', 10)
    y1 = ey + 10 + 3; h1 = H_ - y1
    c.R(0, y1, W_, h1, K('kinari', 1)); shade(c, 0, y1, W_, 6, -1, PLASTER); shade(c, 0, y1, W_, 3, -1, PLASTER)
    base = H_ - 1
    bayx = [0, 16, W_ - 16 - 24, W_ - 16]     # 문 폭 24 칸 격자
    dx = (W_ // 16 // 2 - 1) * 16 + 8          # 문 왼쪽 x(칸+8 → 문 가운데가 칸 경계)
    dx = (W_ - 28) // 2
    koshi(c, 6, y1 + 4, dx - 12, h1 - 12); koshi(c, dx + 28 + 6, y1 + 4, W_ - dx - 28 - 12, h1 - 12)
    hashira(c, 0, y1, h1 - 6); hashira(c, dx - 5, y1, h1 - 6); hashira(c, dx + 28, y1, h1 - 6); hashira(c, W_ - 4, y1, h1 - 6)
    nageshi(c, 0, y1, W_, 4)
    door_bay(c, dx, 24, base - 3, 34, 'sora')
    ishidai(c, 0, H_ - 8, dx - 3); ishidai(c, dx + 27, H_ - 8, W_ - dx - 27)
    jp.chochin(c, 7, y1 + 10); jp.chochin(c, W_ - 18, y1 + 10)
    return c

def house2(W_, H_, seed):
    """기와 단층집: 2단 지붕(윗 40 + 처마 지붕 10) + 회벽 패널(장지창) + 나마코 밑벽 + 문 + 돌 밑단."""
    c = Cv(W_, H_); T = 46
    hip3(c, 0, 0, W_, T, 'kawara')
    y = T + 4; h = H_ - y
    c.R(0, y, W_, h, K('kinari', 1)); shade(c, 0, y, W_, 5, -1, PLASTER); shade(c, 0, y, W_, 2, -1, PLASTER)
    nageshi(c, 0, y, W_, 4)
    shoji(c, 10, y + 12, 22, 18, lit=True)
    hashira(c, 0, y, h - 8); hashira(c, 40, y, h - 8); hashira(c, W_ - 4, y, h - 8)
    panel_shadow(c, 4, y + 4, 36, h - 12); panel_shadow(c, 44, y + 4, W_ - 48, h - 12)
    # 가운데 오른쪽 나마코 + 문
    namako(c, 4, H_ - 8 - 18, 36, 18); c.R(4, H_ - 8 - 20, 36, 2, K('ita', 1)); c.HL(4, H_ - 8 - 20, 36, K('ita', 3))
    shade(c, 4, H_ - 8 - 18, 36, 2, -1, ('tairu', 'shiro'))
    dx = 48 + (W_ - 48 - 4 - 24) // 2 + 2
    c.R(44, y + 4, W_ - 48, 6, K('kinari', 1)) if False else None
    door_bay(c, dx, 24, H_ - 3, 32, None)
    ishidai(c, 0, H_ - 8, dx - 3); ishidai(c, dx + 27, H_ - 8, W_ - dx - 27)
    return c

def apt2(W_, H_, seed):
    """오사카식 맨션: 옥상판(32, 흰 난간 림 + 바깥 그림자) + 타일 벽 2층(들어간 창 + 난간 베란다) + 1층 셔터 가게."""
    c = Cv(W_, H_); T = 32
    c.R(0, 0, W_, T, K('conc', 2)); c.HL(0, 0, W_, K('shiro', 4)); c.R(0, 1, W_, 3, K('shiro', 3)); c.HL(0, 4, W_, K('conc', 0)); c.HL(0, 5, W_, K('conc', -1))
    c.VL(0, 0, T, K('shiro', 4)); c.VL(W_ - 1, 0, T, K('shiro', 2)); c.VL(1, 0, T, K('shiro', 3))
    for j in range(6, T - 5): c.HL(2, j, W_ - 3, K('conc', 2 if j % 8 else 1))
    for i in range(0, W_, 16): c.VL(i, 6, T - 11, K('conc', 1))
    tx = 10; c.R(tx, 10, 14, 10, K('tairu', 2)); c.R(tx, 10, 4, 10, K('tairu', 3)); c.R(tx + 10, 10, 4, 10, K('tairu', 0)); c.R(tx, 8, 14, 3, K('tairu', 4)); c.HL(tx, 8, 14, K('shiro', 2)); c.R(tx + 14, 11, 3, 11, K('conc', -1)); c.HL(tx, 21, 17, K('conc', -2))
    jp.ac_unit(c, 52, 7)
    c.HL(0, T - 5, W_, K('shiro', 4)); c.R(0, T - 4, W_, 2, K('shiro', 3)); c.HL(0, T - 2, W_, K('conc', 2)); c.HL(0, T - 1, W_, K('conc', -2))
    shade(c, 0, T, W_, 3, -1); 
    y2 = T; h2 = 38
    c.R(0, y2, W_, h2, K('tairu', 2))
    for j in range(0, h2, 6):
        c.HL(0, y2 + j, W_, K('tairu', 0))
        for i in range(((j // 6) % 2) * 6, W_, 12): c.VL(i, y2 + j, 6, K('tairu', 0))
    shade(c, 0, y2, W_, 5, -1, ('tairu',)); shade(c, 0, y2, W_, 2, -1, ('tairu',))
    for x in (8, 48):
        c.R(x - 1, y2 + 8, 28, 22, K('tairu', -3)); c.R(x, y2 + 9, 26, 20, K('garasu', 1)); c.R(x, y2 + 9, 26, 4, K('garasu', 0)); c.R(x, y2 + 9, 3, 20, K('garasu', 0)); c.VL(x + 13, y2 + 9, 20, K('tekko', 1))
        for k in range(8): c.P(x + 5 + k, y2 + 25 - k, K('garasu', 4))
        c.R(x - 3, y2 + 28, 32, 10, K('tekko', 1)); c.HL(x - 3, y2 + 28, 32, K('tekko', 5)); c.R(x - 3, y2 + 36, 32, 2, K('tekko', 3))
        for i in range(x - 2, x + 28, 4): c.VL(i, y2 + 30, 6, K('tekko', 0))
        shade(c, x - 3, y2 + 38, 32, 3, -1, ('tairu',))
    y1 = y2 + h2 + 3
    c.HL(0, y1 - 3, W_, K('shiro', 5)); c.R(0, y1 - 2, W_, 2, K('shiro', 3)); c.HL(0, y1, W_, K('conc', -2)); c.HL(0, y1 + 1, W_, K('conc', -3))
    c.R(0, y1, W_, H_ - y1, K('conc', 2))
    shade(c, 0, y1, W_, 5, -1, ('conc',))
    # 셔터 가게: 롤 셔터(가로 줄) + 차양 + 출입문
    sx = 6; sw = W_ - 6 - 40
    c.R(sx - 1, y1 + 10, sw + 2, H_ - y1 - 10 - 7, K('tekko', -2)); 
    for j in range(y1 + 11, H_ - 9, 3): c.HL(sx, j, sw, K('tekko', 2)); c.HL(sx, j + 1, sw, K('tekko', 1)); c.HL(sx, j + 2, sw, K('tekko', 0))
    c.R(sx - 2, y1 + 6, sw + 4, 7, K('aka', 2)); c.HL(sx - 2, y1 + 6, sw + 4, K('aka', 4))
    for i in range(sx - 2, sx + sw + 2, 6): c.R(i, y1 + 11, 3, 3, K('shiro', 3))
    shade(c, sx - 1, y1 + 14, sw + 2, 3, -2, ('tekko',))
    dx = W_ - 34
    door_bay(c, dx, 24, H_ - 3, 32, None)
    c.R(dx - 2, y1 + 8, 28, 3, K('tekko', 2)); c.HL(dx - 2, y1 + 8, 28, K('tekko', 4))
    ishidai(c, 0, H_ - 8, sx - 1 + 0) if False else None
    c.R(0, H_ - 7, sx - 1, 7, K('hodo', 2)); c.R(sx + sw + 2, H_ - 7, dx - sx - sw - 4, 7, K('hodo', 2))
    return c

VARMAP = {}
def build():
    sc = Cv(W, H)
    for y in range(0, 46):
        for x in range(W): sc.P(x, y, K('garasu', 5 - y // 14))
    for x0, w0, h0 in ((0, 38, 26), (52, 30, 34), (130, 46, 22), (232, 34, 30), (290, 50, 24)):
        sc.R(x0, 46 - h0, w0, h0, K('tairu', 3)); sc.R(x0, 46 - h0, w0, 2, K('tairu', 4))
        for i in range(x0 + 4, x0 + w0 - 4, 7): sc.R(i, 46 - h0 + 6, 3, 3, K('tairu', 1))
    sc.R(0, 46, W, ROAD0 - 46, K('conc', 0))
    bl = [(house2(88, 128, 1), 0), (machiya(96, 132, 2), 96), (apt2(88, 124, 3), 192)]
    import tune
    bl[2][0].a[:] = tune.remap(bl[2][0].a, {'tairu': 'renga', 'conc': 'kinari', 'shiro': 'kinari'})
    if VARMAP:
        for cv_, _ in bl: cv_.a[:] = tune.remap(cv_.a, VARMAP)
    for cv, x in bl:
        yy = ROAD0 - cv.h
        put2(sc, cv, x, yy); jp.cast(sc, x, yy, cv.w, cv.h, tall=40)
    # 오른쪽 끝: 정원(블록담 + 소나무형 정원수 + 기와 문 지붕 없이 담만)
    for x0, y0 in ((292, ROAD0 - 62), (316, ROAD0 - 54)):
        for j in range(30):
            for i in range(30):
                if (i - 15) ** 2 + (j - 14) ** 2 * 1.5 <= 210:
                    t = 4 if j < 6 else 3 if j < 13 else 2 if j < 20 else 1
                    if (i * 2 + j) % 7 == 0: t += 1
                    if (i + j * 3) % 11 == 0: t -= 1
                    sc.P(x0 + i, y0 + j, K('ki', t))
    for k in range(3): sc.R(304 + k * 2, ROAD0 - 38 + k, 2, 14, K('ita', -1))
    block_wall2(sc, 280, ROAD0 - 28, 56, 26)
    road(sc); sidewalk_south(sc)
    vending2(sc, 82, ROAD0 - 1)
    bike(sc, 40, ROAD0 - 1)
    block_wall2(sc, 0, ROAD1 + 10, 140, 18); block_wall2(sc, 196, ROAD1 + 10, 140, 18)
    for x0 in (22, 70, 226, 290):
        for j in range(14):
            for i in range(26):
                if (i - 13) ** 2 + (j - 9) ** 2 * 1.7 <= 120:
                    t = 4 if j < 3 else 3 if j < 6 else 2 if j < 9 else 1
                    if (i + j * 2) % 6 == 0: t += 1
                    sc.P(x0 + i, ROAD1 - 6 + j, K('ki', t))
        for i in range(26): sc.P(x0 + i, ROAD1 + 9, K('conc', -2))
    pole(sc, 322, ROAD1 + 34, top=8)
    wires(sc, [-10, 322, 350], 4, sag=5, n=3); wires(sc, [-10, 322], 12, sag=4, n=2, col=K('tekko', 0))
    hero(sc, 136, ROAD1 - 38)
    return sc

if __name__ == '__main__':
    sc = build(); im = sc.img(); im.save('out/jp3.png'); im.resize((im.width * 3, im.height * 3), Image.NEAREST).save('out/jp3-3x.png')
