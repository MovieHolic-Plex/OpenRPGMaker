"""문과 새 집 변형 — 솟을대문·평대문(열린 통로) · 초가/기와 변형 · 곳간 · 마구간 · 누마루집 · 서원 강당.
조립 블록(blocks.library)을 그대로 쓰되, 문은 닫힌 판문이 아니라 **열린 통로**(안쪽 마당이 밝게 보임 + 열린 문짝 + 문턱 계단)로 그린다."""
from tk import *
from build import outline
import blocks as K
from props5 import box, ell, shadow_ell


def _lib():
    import catalog
    return catalog.lib()


def open_passage(cv, x0, x1, y_top, y_bot, y_end, leaves=True):
    """문 통로. 두 기둥 사이(x0..x1-1)를 어두운 통로로 파내고, 멀리 밝은 안마당을 보이게 한다.
    y_top = 통로 윗끝(인방 밑), y_bot = 바닥 끝(마지막 줄). 열린 문짝은 양쪽 기둥 안쪽에 얇게 붙는다."""
    W = RGB['wood']; E = RGB['earth']; S = RGB['stone']
    for y in range(y_top, y_bot + 1):
        for x in range(x0, x1):
            c = W[1] if y < y_top + 2 else W[1]
            cv.put(x, y, c)
    for x in range(x0, x1):                                           # 인방 밑 그림자 줄
        cv.put(x, y_top, W[2]); cv.put(x, y_top + 1, W[1])
    w = x1 - x0
    fx0, fx1 = x0 + 5, x1 - 5                                         # 멀리 보이는 밝은 안마당(창)
    fy0, fy1 = y_top + 3, y_bot - 5
    for y in range(fy0, fy1):
        for x in range(fx0, fx1):
            t = (y - fy0) / max(1, fy1 - fy0 - 1)
            col = E[5] if t < 0.35 else (E[4] if t < 0.75 else E[3])
            if rnd(x, y, 7) > 0.9: col = E[6] if t < 0.5 else E[4]
            cv.put(x, y, col)
    for x in range(fx0 - 1, fx1 + 1):                                 # 창틀 그림자
        cv.put(x, fy0 - 1, W[2])
    for y in range(fy1, y_bot):                                       # 통로 안쪽 바닥(어둑한 흙)
        for x in range(x0, x1):
            t = (y - fy1) / max(1, y_bot - fy1)
            col = E[3] if t < 0.5 else E[4]
            if rnd(x, y, 9) > 0.88: col = E[5]
            cv.put(x, y, col)
    for x in range(x0, x1):                                           # 문턱 목재
        cv.put(x, y_bot, W[5]); cv.put(x, y_bot + 1, W[3])
    if leaves:
        for k, side in enumerate((0, 1)):
            lx = x0 if side == 0 else x1 - 4
            for y in range(y_top + 2, y_bot):
                for dx in range(4):
                    if side == 0:
                        col = W[5] if dx == 0 else (W[4] if dx < 3 else W[3])
                    else:
                        col = W[3] if dx < 2 else (W[2] if dx < 3 else W[1])
                    cv.put(lx + dx, y, col)
            for yy in (y_top + 5, (y_top + y_bot) // 2 + 2):
                cv.hl(lx, lx + 4, yy, W[2])
            cv.put(lx + (3 if side == 0 else 0), (y_top + y_bot) // 2, RGB['straw'][5])


def passage_apron(cv, x0, x1, y_bot, y_end):
    """문턱 앞 흙(마당 칸과 같은 톤). 그림자 그라데이션(finish_house) 뒤에 따로 칠하고 따로 외곽선을 둘러 붙인다 —
    합성물 전체에 외곽선을 다시 두르면 부품이 이미 가진 외곽선이 두 번 어두워진다."""
    E = RGB['earth']
    ap = Cv(cv.w, cv.h)
    for y in range(y_bot + 2, y_end + 1):
        for x in range(x0 - 2, x1 + 2):
            ap.put(x, y, E[5] if rnd(x, y, 11) > 0.12 else E[4])
    outline(ap)
    cv.paste(ap, 0, 0)


def solseul_daemun():
    """솟을대문 160×112 (10×7칸): 가운데 대문칸 지붕을 한 단 높이 솟구치게 하고 양옆에 낮은 행랑 지붕을 잇는다.
    가운데는 열린 통로(안마당이 비침) + 열린 문짝 + 문 앞 계단. 두 기둥은 붉은 주칠."""
    L = _lib()
    # 통로 칸은 가운데 블록이 덮는다. 행랑은 널문·살창을 번갈아.
    flank = K.assemble(K.house('jo', 8, 'lwwoowwr', 'lffooffr', steps=(), chimi=False, hip=True), L,
                       post=lambda cv: K.roof_baram(cv, 3, 'giwa', wing=22), finish=False)

    def center_post(cv):
        K.roof_baram(cv, 4, 'giwa', wing=26, trim=True)
        open_passage(cv, 35, 63, 68, 91, 111)

    center = K.assemble(K.house('jo', 4, 'loor', 'loor', rows=4, steps=(1, 2), chimi=False, hip=True), L, post=center_post, finish=False)
    cv = Cv(10 * T, 7 * T)
    cv.paste(flank, 0, T)
    cv.paste(center, 2 * T, 0)
    from blocks import finish_house
    finish_house(cv)
    passage_apron(cv, 67, 95, 91, 111)
    return cv


def pyeong_daemun():
    """평대문 64×96 (4×6칸): 평민·소지주 집의 작은 기와 대문 — 두 기둥, 낮은 맞배 지붕, 열린 통로."""
    def post(cv):
        K.roof_baram(cv, 3, 'brown', wing=18)
        open_passage(cv, 19, 45, 52, 75, 95)
    cv = K.assemble(K.house('jo', 2, 'lr', 'lr', steps=(0, 1), chimi=False, hip=True), _lib(), post=post, finish=False)
    from blocks import finish_house
    finish_house(cv)
    passage_apron(cv, 19, 45, 75, 95)
    return cv


def thatch_hut_2():
    """오두막 초가 (2칸): 한 칸 방 + 부엌 — 폭 4칸 캔버스의 작은 집."""
    return K.assemble(K.house('jc', 2, 'gr', 'gr', steps=(0,), hip=True, chimi=False), _lib(), post=lambda cv: K.thatch_baram(cv, 3))


def thatch_house_4k():
    """초가 4칸: 왼쪽 방 창 + 가운데 널문 + 오른쪽 부엌문(작은 이엉 처마 덧댐)."""
    return K.assemble(K.house('jc', 4, 'lwgr', 'lfgr', steps=(2,), hip=True, chimi=False), _lib(), post=lambda cv: K.thatch_baram(cv, 3))


def thatch_house_6():
    """초가 6칸: 방 둘 + 대청 + 부엌 — 긴 몸채."""
    return K.assemble(K.house('jc', 6, 'lwdwor', 'lfdfor', steps=(2, 4), hip=True, chimi=False), _lib(), post=lambda cv: K.thatch_baram(cv, 3, over=8))


def giwa_house_4w():
    """기와 4칸(밝은 갈색 지붕): 문 둘에 창 둘."""
    return K.assemble(K.house('jo', 4, 'ldwr', 'ldfr', steps=(1,), hip=True), _lib(), post=lambda cv: K.roof_baram(cv, 3, 'brown', wing=20))


def giwa_numa():
    """누마루 사랑채: 앞 절반이 난간 둘린 마루(누마루), 뒤에 방. 회청 기와."""
    return K.assemble(K.house('jo', 5, 'lwoor', 'lfkkr', steps=(2,), hip=True), _lib(), post=lambda cv: K.roof_baram(cv, 3, 'giwa', wing=24))


def seowon_hall():
    """서원·향교 강당 (단청): 7칸 긴 강당. 처마 밑 단청 띠 + 현판."""
    return K.assemble(K.house('jo', 7, 'lwwdwwr', 'lffdffr', steps=(3,), hip=True, dan=True), _lib(), post=lambda cv: K.roof_baram(cv, 3, 'giwa', wing=26, trim=True))


def gotgan():
    """곳간: 널벽 + 높은 기단, 초가 지붕, 작은 널문 하나 — 곡식을 쌓아 둔 창고."""
    return K.assemble(K.house('pv', 3, 'lgr', 'lgr', steps=(1,), hip=True, chimi=False), _lib(), post=lambda cv: K.thatch_baram(cv, 3))


def maguan():
    """마구간·외양간: 널벽 기둥만 서고 앞이 트인 낮은 초가 헛간. 안쪽에 여물통과 짚."""
    def post(cv):
        K.thatch_baram(cv, 3)
        W = RGB['wood']; S = RGB['straw']
        x0, x1 = 22, 74
        for y in range(70, 80):                                            # 안쪽 어둠
            for x in range(x0, x1): cv.put(x, y, W[1])
        for y in range(80, 90):
            for x in range(x0, x1): cv.put(x, y, S[4] if (x + y) % 3 else S[3])            # 깔린 짚
        box(cv, 30, 90, 36, 3, 4, W, (6, 5), (5, 4, 3, 2))                  # 여물통
        for x in range(33, 63, 2): cv.put(x, 85, S[6]); cv.put(x + 1, 84, S[5])
        for xp in (x0, 40, 58, x1 - 3):
            for y in range(66, 94): cv.put(xp, y, W[5]); cv.put(xp + 1, y, W[4]); cv.put(xp + 2, y, W[2])
    return K.assemble(K.house('pv', 4, 'looo', 'looo', steps=(), hip=True, chimi=False), _lib(), post=post)
