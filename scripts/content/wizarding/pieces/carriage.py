"""금지된 숲 가장자리 세스트랄 마차 승차장(carriage). 손 도트."""
import os, sys
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
import numpy as np   # noqa: E402
from wzlib import REG, Cv, K, OL, OL2, CLEAR, run_module   # noqa: E402

MODULE = 'carriage'
SP = 'carriage'


# ---------------------------------------------------------------- 공용 도우미
def glow_pane(c, x, y, w, h, bars=True):
    """등불 비치는 창: 놋쇠 틀 + 따뜻한 속 + 왼쪽 위 밝은 점."""
    c.R(x, y, w, h, K('brass', 1))
    c.R(x + 1, y + 1, w - 2, h - 2, K('fire', 2))
    c.R(x + 1, y + 1, w - 2, max(1, (h - 2) // 2), K('fire', 3))
    c.P(x + 1, y + 1, K('fire', 4))
    if bars and w >= 6: c.VL(x + w // 2, y + 1, h - 2, K('brass', 1))
    c.HL(x, y, w, K('brass', 3)); c.VL(x, y, h, K('brass', 2))


def shingles(c, x0, y0, w, h, base, lo, hi, horizontal=True, step=5):
    """엇갈린 비늘 기와: base 면 + 줄마다 아랫변 어두운 선 + 엇갈린 짧은 세로 이음 + 줄 첫머리 밝은 점."""
    c.R(x0, y0, w, h, K('night', base))
    r = 0
    for y in range(y0, y0 + h, step):
        yy = min(y + step - 1, y0 + h - 1)
        c.HL(x0, yy, w, K('night', lo))
        for x in range(x0 + 1 + (r % 2) * 3, x0 + w, 6):
            c.VL(x, y, yy - y, K('night', lo))
            c.P(x + 1, y, K('night', hi))
        r += 1


def roof_slate(c, x0, y0, x1, y1, north_lip=False):
    """마차 지붕 윗면(용마루 남북): 겹친 슬레이트 단. 단마다 위 1px 밝고 아래 1px 그림자, 아래 끝 비늘 홈이 엇갈린다.
    네 모서리 2px 둥글게, 왼쪽 비탈 밝게·오른쪽 어둡게, 놋쇠 용마루."""
    xm = (x0 + x1) // 2
    # 굽은 지붕 명암 띠: 왼쪽 바깥 밝게 → 용마루 → 오른쪽 바깥 가장 어둡게
    bands = [(x0, x0 + 5, 3), (x0 + 5, xm, 2), (xm, x1 - 5, 1), (x1 - 5, x1, 0)]
    for xa, xb, t in bands: c.R(xa, y0, xb - xa, y1 - y0, K('night', t))
    step = 5
    for i, yt in enumerate(range(y0 + step - 1, y1 - 1, step)):
        for xa, xb, t in bands:
            lo = K('night', max(0, t - 1)) if t > 0 else OL2
            c.HL(xa, yt, xb - xa, lo)                          # 단 아래 그림자선
            if t >= 2: c.HL(xa, yt + 1, xb - xa, K('night', min(3, t + 1)) if t < 3 else K('iron', 4))   # 다음 단 윗머리 빛
        for x in range(x0 + 3 + (i % 2) * 4, x1 - 2, 8):       # 엇갈린 슬레이트 끝: 그림자선이 1px 끊김
            if x in (xm - 1, xm): continue
            c.P(x, yt, K('night', 2) if x < xm else K('night', 1))
    c.VL(xm - 1, y0, y1 - y0, K('brass', 3)); c.VL(xm, y0, y1 - y0, K('brass', 1))   # 놋쇠 용마루
    c.outline_rect(x0, y0, x1 - x0, y1 - y0, OL)
    for (cx, cy, dx, dy) in ((x0, y0, 1, 1), (x1 - 1, y0, -1, 1), (x0, y1 - 1, 1, -1), (x1 - 1, y1 - 1, -1, -1)):
        c.clear(cx, cy); c.clear(cx + dx, cy); c.clear(cx, cy + dy); c.P(cx + dx, cy + dy, OL)
    if north_lip:                                            # 견인봉 쪽 처마 턱: 첫 단을 1px 넓게
        c.HL(x0 + 1, y0, x1 - x0 - 2, OL); c.HL(x0, y0 + 1, x1 - x0, K('brass', 2)); c.HL(x0 + 1, y0 + 1, xm - x0 - 2, K('brass', 3))
        c.P(x0 - 1, y0 + 1, OL); c.P(x1, y0 + 1, OL); c.HL(x0, y0 + 2, x1 - x0, K('night', 0))


def eave_lip(c, x0, x1, y):
    """앞(남) 처마 턱 2px: 차체 정면 위로 1px 씩 넓게 돌출. 윗줄 밝은 턱 면, 아랫줄 그림자."""
    c.HL(x0, y, x1 - x0, K('brass', 2)); c.HL(x0 + 1, y, (x1 - x0) // 2 - 1, K('brass', 3)); c.P(x0 + 1, y, K('brass', 4))
    c.P(x0, y, OL); c.P(x1 - 1, y, OL)
    c.HL(x0 + 1, y + 1, x1 - x0 - 2, OL)


def wheel_tall(c, x, y, h, hub='L'):
    """앞뒤에서 본 바퀴: 청회색 쇠테 3px 폭 세로 타원(위아래 둥글게) + 바깥으로 튀어나온 놋쇠 허브 2×3."""
    c.HL(x + 1, y, 3, OL); c.HL(x + 1, y + h - 1, 3, OL)
    c.VL(x, y + 1, h - 2, OL); c.VL(x + 4, y + 1, h - 2, OL)
    c.VL(x + 1, y + 1, h - 2, K('iron', 4)); c.VL(x + 2, y + 1, h - 2, K('iron', 3)); c.VL(x + 3, y + 1, h - 2, K('iron', 2))
    c.HL(x + 1, y + 1, 3, K('iron', 2)); c.HL(x + 1, y + h - 2, 3, K('iron', 1))       # 위아래로 굽어 들어가는 테
    c.P(x + 1, y + 2, K('iron', 3)); c.P(x + 3, y + h - 3, K('iron', 1))
    hy = y + h // 2 - 1
    hx = x - 2 if hub == 'L' else x + 5
    c.R(hx, hy, 2, 3, K('brass', 3)); c.P(hx, hy, K('brass', 5)); c.P(hx + 1, hy, K('brass', 4))
    c.HL(hx, hy + 2, 2, K('brass', 1))
    c.HL(hx, hy - 1, 2, OL); c.HL(hx, hy + 3, 2, OL)
    c.P(hx - 1 if hub == 'L' else hx + 2, hy + 1, OL)


def chassis(c, x0, x1, y):
    """차체 아래 차대·차축 띠 2px(바퀴 사이)."""
    c.HL(x0, y, x1 - x0, K('night', 0)); c.HL(x0, y + 1, x1 - x0, OL)
    for x in (x0 + 3, x1 - 5): c.R(x, y, 2, 2, K('iron', 2)); c.P(x, y, K('iron', 3))   # 판스프링 받침


def roof_ew(c, x0, y0, x1, y1):
    """옆에서 본 맞배 지붕 윗면(용마루 동서): 위(북) 비탈 어둡고 아래(남) 비탈 밝다."""
    ym = (y0 + y1) // 2
    shingles(c, x0, y0, x1 - x0, ym - y0, 1, 0, 2, step=4)
    shingles(c, x0, ym, x1 - x0, y1 - ym, 2, 1, 3, step=4)
    c.HL(x0, ym - 1, x1 - x0, K('brass', 3)); c.HL(x0, ym, x1 - x0, K('brass', 1))
    c.HL(x0 + 1, y1 - 2, x1 - x0 - 2, K('night', 3))
    c.HL(x0, y1 - 1, x1 - x0, K('brass', 1))
    c.outline_rect(x0, y0, x1 - x0, y1 - y0, OL)


def spike(c, x, y, up=True):
    """놋쇠 지붕 꼭지(2px 폭 뾰족)."""
    c.P(x, y, K('brass', 4)); c.P(x + 1, y, K('brass', 3))
    c.P(x, y - 1 if up else y + 1, K('brass', 5)); c.P(x + 1, y + 1 if up else y - 1, K('brass', 2))
    c.P(x - 1, y + 1 if up else y - 1, OL); c.P(x + 2, y + 1 if up else y - 1, OL)


def wheel_face(c, cx, cy, r):
    """옆에서 본 바퀴: 쇠 테, 속 어둡게, 나무 바큇살 8개, 놋쇠 축."""
    c.ellipse(cx, cy, r, r, K('iron', 1))
    c.ellipse(cx, cy, r - 1.2, r - 1.2, K('ink', 1))
    n = r - 2
    for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1), (1, 1), (-1, -1), (1, -1), (-1, 1)):
        for k in range(1, n + 1):
            px, py = int(cx - 0.5 + dx * k * (0.72 if dx and dy else 1)), int(cy - 0.5 + dy * k * (0.72 if dx and dy else 1))
            c.P(px, py, K('wood', 4) if (dx <= 0 and dy <= 0) else K('wood', 3))
    c.ellipse(cx, cy, 1.6, 1.6, K('brass', 3)); c.P(int(cx - 1), int(cy - 1), K('brass', 5))
    c.ellipse(cx, cy, r, r, K('iron', 3), fill=False)
    for x, y in ((int(cx - r * 0.6), int(cy - r * 0.6)), ):
        c.P(x, y, K('iron', 4))
    c.ellipse(cx, cy, r + 1, r + 1, OL, fill=False)


def door_leaf(c, x, y, w, h, open_=False):
    c.R(x, y, w, h, K('night', 2))
    c.VL(x, y, h, K('night', 3)); c.VL(x + w - 1, y, h, K('night', 1))
    for yy in (y + h // 2, y + h - 4): c.HL(x + 1, yy, w - 2, K('night', 1))
    c.outline_rect(x, y, w, h, OL)


# ---------------------------------------------------------------- 마차(아래 향함)
def draw_down(c, door='closed'):
    # 뒷바퀴(지붕 옆으로 보이는 것)
    wheel_tall(c, 2, 26, 20, 'L'); wheel_tall(c, 41, 26, 20, 'R')
    # 지붕 윗면 + 남쪽 처마 턱
    roof_slate(c, 5, 6, 43, 45)
    spike(c, 23, 4)
    eave_lip(c, 4, 44, 45)
    # 차체 앞면
    c.R(6, 48, 36, 26, K('night', 1))
    c.R(6, 47, 36, 2, K('night', 0)); c.HL(6, 50, 36, K('brass', 2))
    c.VL(6, 50, 24, K('night', 3)); c.VL(7, 50, 24, K('night', 2)); c.VL(41, 50, 24, K('night', 0))
    c.HL(6, 71, 36, K('night', 0)); c.HL(6, 72, 36, K('brass', 1))
    c.VL(5, 47, 28, OL); c.VL(42, 47, 28, OL); c.HL(5, 74, 38, OL)
    glow_pane(c, 9, 53, 6, 9); glow_pane(c, 33, 53, 6, 9)
    # 문
    if door == 'closed':
        door_leaf(c, 17, 52, 14, 20)
        glow_pane(c, 20, 55, 8, 8)
        c.R(27, 66, 2, 2, K('brass', 4)); c.P(27, 66, K('brass', 5))
        c.HL(18, 70, 12, K('night', 0))
    else:
        c.R(18, 53, 12, 19, K('ink', 0))
        c.R(19, 54, 10, 12, K('fire', 0)); c.R(20, 55, 8, 6, K('fire', 1)); c.R(21, 55, 5, 3, K('fire', 2)); c.P(21, 55, K('fire', 3))
        c.R(19, 66, 10, 5, K('wood', 2)); c.HL(19, 66, 10, K('wood', 4)); c.HL(19, 70, 10, K('wood', 1))   # 안쪽 좌석
        c.outline_rect(17, 52, 14, 20, OL)
        c.R(14, 52, 4, 21, K('night', 2)); c.VL(14, 52, 21, K('night', 3)); c.VL(17, 52, 21, K('night', 0))
        c.HL(14, 52, 4, OL); c.HL(14, 72, 4, OL); c.VL(13, 53, 19, OL)
        c.R(14, 56, 3, 5, K('fire', 2)); c.P(14, 56, K('fire', 3))
    # 차대 띠 + 견인봉 혀
    chassis(c, 7, 41, 75)
    c.R(21, 75, 6, 5, K('wood', 3)); c.VL(21, 75, 5, K('wood', 4)); c.VL(26, 75, 5, K('wood', 1))
    c.HL(21, 79, 6, K('brass', 3)); c.VL(20, 75, 5, OL); c.VL(27, 75, 5, OL)
    # 앞바퀴(차체 아래로 내려와 땅에 닿음)
    wheel_tall(c, 2, 58, 22, 'L'); wheel_tall(c, 41, 58, 22, 'R')


@REG.piece('wz-car-carriage-down', '세스트랄 마차(아래 향함)', 3, 5, ['CCC', 'CCC', 'CCC', 'SSS', 'SSS'], 'vehicles', SP,
           desc='검은 마차 3×5칸, 앞(견인봉)이 남쪽. 뾰족한 검은 맞배 지붕 윗면, 놋쇠 지붕 꼭지, 문과 양옆 창에 등불 빛, 네 바퀴.',
           rules='견인봉 아래 1×2 연결부 wz-car-harness-s 를 붙이고 그 앞에 세스트랄을 둔다. 지붕 3행은 사람 위로 지난다.',
           tags=['마차', '세스트랄', '탈것'])
def _carriage_down(c): draw_down(c, 'closed')


@REG.piece('wz-car-carriage-door-closed', '세스트랄 마차 문 닫힘', 3, 5, ['CCC', 'CCC', 'CCC', 'SSS', 'SSS'], 'vehicles', SP,
           desc='아래 향함 마차의 문이 닫힌 상태. 같은 크기·피벗의 문 열림과 한 묶음.', states='carriage-door', tags=['마차', '문'])
def _carriage_door_closed(c): draw_down(c, 'closed')


@REG.piece('wz-car-carriage-door-open', '세스트랄 마차 문 열림', 3, 5, ['CCC', 'CCC', 'CCC', 'SCS', 'SCS'], 'vehicles', SP,
           desc='아래 향함 마차의 문이 열린 상태. 안쪽 등불·좌석이 보이고 문 칸은 통행.', states='carriage-door', tags=['마차', '문'])
def _carriage_door_open(c): draw_down(c, 'open')



# ---------------------------------------------------------------- 마차(위 향함)
def draw_up(c):
    # 견인봉(북쪽으로 뻗음)
    c.R(21, 0, 6, 17, K('wood', 3)); c.VL(21, 0, 17, K('wood', 4)); c.VL(26, 0, 17, K('wood', 1))
    c.VL(20, 0, 17, OL); c.VL(27, 0, 17, OL); c.HL(21, 0, 6, K('brass', 3))
    # 앞바퀴(북쪽, 지붕 옆으로 보임)
    wheel_tall(c, 2, 26, 18, 'L'); wheel_tall(c, 41, 26, 18, 'R')
    roof_slate(c, 5, 17, 43, 53, north_lip=True)
    eave_lip(c, 4, 44, 53)
    # 뒷면(문 없음, 창과 짐칸)
    c.R(6, 55, 36, 22, K('night', 1))
    c.R(6, 55, 36, 2, K('night', 0)); c.HL(6, 57, 36, K('brass', 2))
    c.VL(6, 57, 20, K('night', 3)); c.VL(7, 57, 20, K('night', 2)); c.VL(41, 57, 20, K('night', 0))
    c.HL(6, 75, 36, K('night', 0)); c.HL(6, 76, 36, K('brass', 1))
    c.VL(5, 55, 23, OL); c.VL(42, 55, 23, OL)
    glow_pane(c, 17, 59, 14, 9)                            # 뒷창
    # 짐 선반: 나무 판 + 가죽끈
    c.R(13, 69, 22, 6, K('wood', 2)); c.HL(13, 69, 22, K('wood', 4)); c.HL(13, 74, 22, K('wood', 1))
    for x in (16, 31): c.VL(x, 69, 6, K('choc', 1))
    c.outline_rect(12, 68, 24, 8, OL)
    # 뒷등 고리 등불
    c.R(9, 62, 3, 5, K('fire', 2)); c.P(9, 62, K('fire', 4)); c.R(36, 62, 3, 5, K('fire', 2)); c.P(36, 62, K('fire', 4))
    c.HL(5, 77, 38, OL)
    chassis(c, 7, 41, 78)
    # 뒷바퀴(남쪽, 땅에 닿음)
    wheel_tall(c, 2, 58, 22, 'L'); wheel_tall(c, 41, 58, 22, 'R')


@REG.piece('wz-car-carriage-up', '세스트랄 마차(위 향함)', 3, 5, ['.S.', 'CCC', 'CCC', 'SSS', 'SSS'], 'vehicles', SP,
           desc='검은 마차 3×5칸, 앞(견인봉)이 북쪽. 지붕 윗면 뒤로 뒷창과 짐 선반이 정면에 보이고 놋쇠 용마루, 네 바퀴.',
           rules='견인봉 위쪽 1×2 연결부를 붙이고 그 앞에 세스트랄을 둔다.', tags=['마차', '세스트랄', '탈것'])
def _carriage_up(c): draw_up(c)


# ---------------------------------------------------------------- 마차(왼쪽 향함 / 오른쪽 향함)
def draw_left(c):
    # 견인봉(왼쪽)
    c.R(0, 23, 17, 5, K('wood', 3)); c.HL(0, 23, 17, K('wood', 4)); c.HL(0, 27, 17, K('wood', 1))
    c.R(0, 23, 2, 5, K('brass', 3)); c.HL(0, 23, 2, K('brass', 5)); c.outline_rect(0, 22, 17, 7, OL)
    # 지붕 윗면 + 옆벽
    roof_ew(c, 16, 6, 78, 22)
    c.P(16, 5, K('brass', 4)); c.P(77, 5, K('brass', 4))
    c.R(17, 22, 60, 16, K('night', 1)); c.HL(17, 22, 60, K('night', 0)); c.HL(17, 23, 60, K('brass', 2))
    c.VL(17, 23, 15, K('night', 3)); c.VL(76, 23, 15, K('night', 0))
    c.HL(17, 36, 60, K('night', 0)); c.HL(17, 37, 60, K('brass', 1))
    c.outline_rect(16, 21, 62, 18, OL)
    glow_pane(c, 22, 26, 10, 8); glow_pane(c, 62, 26, 10, 8)
    # 문(가운데)
    door_leaf(c, 38, 25, 18, 13)
    glow_pane(c, 41, 27, 12, 6)
    c.R(53, 31, 2, 2, K('brass', 4))
    # 뒷등(오른쪽 끝)
    c.R(75, 24, 2, 4, K('fire', 2)); c.P(75, 24, K('fire', 4))
    # 바퀴(옆모습, 앞·뒤)
    wheel_face(c, 30, 37, 9); wheel_face(c, 65, 37, 9)
    c.HL(18, 46, 50, K('night', 0)) if False else None


@REG.piece('wz-car-carriage-left', '세스트랄 마차(왼쪽 향함)', 5, 3, ['.CCCC', 'SSSSS', '.SSSS'], 'vehicles', SP,
           desc='검은 마차 5×3칸, 앞(견인봉)이 서쪽. 놋쇠 용마루 지붕 윗면, 옆면에 등불 창 둘과 문, 옆모습 바퀴 둘.',
           rules='견인봉 왼쪽 연결부에 세스트랄을 잇는다.', tags=['마차', '세스트랄', '탈것'])
def _carriage_left(c): draw_left(c)


@REG.piece('wz-car-carriage-right', '세스트랄 마차(오른쪽 향함)', 5, 3, ['CCCC.', 'SSSSS', 'SSSS.'], 'vehicles', SP,
           desc='왼쪽 향함의 좌우 대칭. 앞(견인봉)이 동쪽.', rules='견인봉 오른쪽 연결부에 세스트랄을 잇는다.', tags=['마차', '세스트랄', '탈것'])
def _carriage_right(c):
    t = Cv(80, 48); draw_left(t); c.blit(t.flip_h(), 0, 0)


# ---------------------------------------------------------------- 견인봉·마구 연결부
_SHAFT = (3, 3, 3, 2, 2, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 2, 2, 2, 2, 3, 3, 3, 3)   # y5..30 왼쪽 채 x(바깥으로 휜 뒤 앞으로 모임)


@REG.piece('wz-car-harness-s', '견인봉·마구 연결부', 1, 2, ['S', 'S'], 'vehicles', SP,
           desc='마차 견인봉 끝에 잇는 1×2칸 마구: 나무 봉, 가죽 멍에 가로대, 놋쇠 고리와 늘어진 쇠사슬.',
           rules='마차 앞(견인봉 끝) 1칸 밖에 세우고 그 앞에 세스트랄을 둔다.', tags=['마구', '견인봉'])
def _harness(c):
    # 마차 혀 끝 → 가로대(얇은 나무 채, 2px)
    c.R(6, 0, 4, 3, K('wood', 3)); c.VL(6, 0, 3, K('wood', 4)); c.VL(9, 0, 3, K('wood', 1))
    c.R(3, 3, 10, 2, K('wood', 3)); c.HL(3, 3, 10, K('wood', 4)); c.HL(3, 4, 10, K('wood', 1))
    c.R(7, 3, 2, 2, K('brass', 3)); c.P(7, 3, K('brass', 5))                       # 혀 고정 놋쇠 핀
    # 두 채(2px): 동물 몸을 감싸듯 바깥으로 휘었다가 앞(남)으로 모인다
    for i, x in enumerate(_SHAFT):
        y = 5 + i
        c.P(x, y, K('wood', 4)); c.P(x + 1, y, K('wood', 2))
        c.P(14 - x, y, K('wood', 3)); c.P(15 - x, y, K('wood', 1))
    for x in (3, 11): c.P(x, 30, K('brass', 5)); c.P(x + 1, 30, K('brass', 3))      # 채 끝 놋쇠 덮개
    for x in (1, 13): c.R(x, 15, 2, 1, K('brass', 4))                            # 채에 단 놋쇠 끈고리
    # 가로대 양끝에서 늘어져 처진 가죽 끈(2px, U 자)
    for x, y in ((5, 5), (5, 6), (5, 7), (6, 8), (6, 9), (7, 10)):
        c.P(x, y, K('choc', 3)); c.P(x, y + 1, K('choc', 1)) if (x, y + 1) not in ((5, 6), (5, 7), (6, 9)) else None
        c.P(15 - x, y, K('choc', 2)); c.P(15 - x, y + 1, K('choc', 0)) if (x, y + 1) not in ((5, 6), (5, 7), (6, 9)) else None
    c.HL(7, 10, 2, K('choc', 2)); c.HL(7, 11, 2, K('choc', 0))
    c.outline()


# ---------------------------------------------------------------- 바퀴 자국(덧그림)
_RJ = ((0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0), (0, 0, 0, -1, -1, -1, -1, 0, 0, 0, 0, 0, 1, 1, 1, 0))
_RL = ((1, 1, 1, 0, 0, 1, 1, 1, 1, 0, 1, 1, 1, 1, 0, 0), (0, 1, 1, 1, 1, 1, 0, 0, 1, 1, 1, 1, 1, 0, 1, 1))


def _groove(c, i, g, vertical):
    """파인 홈 하나: 그림자 쪽 1px 가장 어둡게, 다음 1px 어둡게, 반대쪽 1px 밝은 흙 턱(끊김). 가장자리 1px 흔들림."""
    for t in range(16):
        o = g + _RJ[i][t]
        for k, col in ((0, K('dirt', 1)), (1, K('dirt', 2))):
            (c.P(o + k, t, col) if vertical else c.P(t, o + k, col))
        if _RL[i][t]:
            (c.P(o + 2, t, K('dirt', 5)) if vertical else c.P(t, o + 2, K('dirt', 5)))
        elif _RJ[i][(t + 1) % 16] != _RJ[i][t]:
            (c.P(o + 2, t, K('dirt', 2)) if vertical else c.P(t, o + 2, K('dirt', 2)))


@REG.piece('wz-car-rut-h', '바퀴 자국(가로)', 1, 1, ['f'], 'surfaces', SP, role='terrain',
           desc='흙길 위 가로 바퀴 자국 두 줄. 얕게 파인 어두운 골과 둑의 밝은 가장자리. 좌우로 이어 칠한다.',
           rules='마차가 지나는 가로 길 위에 겹쳐 깐다.', tags=['바퀴자국'])
def _rut_h(c):
    _groove(c, 0, 3, False); _groove(c, 1, 10, False)


@REG.piece('wz-car-rut-v', '바퀴 자국(세로)', 1, 1, ['f'], 'surfaces', SP, role='terrain',
           desc='흙길 위 세로 바퀴 자국 두 줄. 얕게 파인 어두운 골과 둑의 밝은 가장자리. 위아래로 이어 칠한다.',
           rules='마차가 지나는 세로 길 위에 겹쳐 깐다.', tags=['바퀴자국'])
def _rut_v(c):
    _groove(c, 0, 3, True); _groove(c, 1, 10, True)


# ---------------------------------------------------------------- 승차 차양(3x3)
@REG.piece('wz-car-canopy', '목재 승차 차양', 3, 3, ['CCC', 'SCS', 'SCS'], 'vehicles', SP, role='roof',
           desc='승차장 목재 차양 3×3칸. 경사 판 지붕 윗면(널 결, 용마루 놋쇠띠), 앞 처마와 굵은 나무 기둥 둘.',
           rules='마차 승차 자리 위에 덮는다. 가운데 아래 칸은 비어 있어 걸어 들어간다.', tags=['차양', '승차장'])
def _canopy(c):
    for px in (3, 40):                                   # 기둥
        c.R(px, 30, 5, 18, K('wood', 3)); c.VL(px, 30, 18, K('wood', 4)); c.VL(px + 4, 30, 18, K('wood', 1))
        c.R(px - 1, 45, 7, 3, K('stone', 3)); c.HL(px - 1, 45, 7, K('stone', 4))
    # 지붕 윗면: 위쪽이 뒤. 널 가로결
    c.R(0, 3, 48, 27, K('wood', 3))
    for y in range(3, 26, 6):
        c.HL(0, y + 5, 48, K('wood', 1))
        for x in range(1 + ((y // 6) % 2) * 5, 48, 10): c.VL(x, y, 5, K('wood', 2))
        c.HL(0, y, 48, K('wood', 4))
    c.VL(1, 3, 25, K('wood', 5)); c.VL(46, 3, 25, K('wood', 1))
    c.R(0, 26, 48, 6, K('wood', 2)); c.HL(0, 26, 48, K('wood', 4)); c.HL(0, 31, 48, K('wood', 0))   # 앞 처마 면
    for x in range(4, 48, 8): c.VL(x, 27, 4, K('wood', 1))
    c.HL(0, 3, 48, K('brass', 3)); c.HL(0, 4, 48, K('brass', 1))   # 뒤 용마루 띠
    for x in (2, 45): c.R(x, 27, 2, 3, K('brass', 3)); c.P(x, 27, K('brass', 5))
    c.outline_rect(0, 2, 48, 30, OL)
    c.R(4, 32, 40, 3, K('night', 0)); c.HL(4, 32, 40, OL)   # 처마 밑 그늘
    c.HL(5, 35, 38, OL2)
    for x in range(8, 40, 6): c.P(x, 34, K('fire', 1))
    # 기둥 위의 매단 등
    c.R(22, 35, 4, 5, K('fire', 2)); c.P(22, 35, K('fire', 4)); c.HL(22, 34, 4, K('brass', 2)); c.VL(23, 32, 2, K('iron', 1))
    c.HL(22, 40, 4, K('brass', 1)); c.outline_rect(21, 34, 6, 7, OL)


# ---------------------------------------------------------------- 울타리(1x1)
def rails(c, x0, x1, ys=(5, 10)):
    for y in ys:
        c.R(x0, y, x1 - x0, 3, K('wood', 3)); c.HL(x0, y, x1 - x0, K('wood', 5)); c.HL(x0, y + 2, x1 - x0, K('wood', 1))
        c.HL(x0, y + 3, x1 - x0, K('wood', 0))


def stake(c, x, y0=2, y1=15):
    c.R(x, y0, 4, y1 - y0, K('wood', 3)); c.VL(x, y0, y1 - y0, K('wood', 4)); c.VL(x + 3, y0, y1 - y0, K('wood', 1))
    c.R(x + 1, y0 - 1, 2, 1, K('wood', 5)); c.HL(x, y1, 4, K('wood', 0))
    c.P(x + 1, y0 + 4, K('wood', 2))


@REG.piece('wz-car-fence-h', '나무 울타리(가로)', 1, 1, ['S'], 'vehicles', SP, role='fence', repeat=True,
           desc='말뚝과 가로대 두 줄의 나무 울타리. 좌우로 이어 칠한다.', rules='가로로 이어 깐다. 끝은 fence-end.', tags=['울타리'])
def _fence_h(c):
    c.R(0, 5, 16, 3, K('wood', 3)); c.HL(0, 5, 16, K('wood', 5)); c.HL(0, 7, 16, K('wood', 1)); c.HL(0, 8, 16, K('wood', 0))
    c.R(0, 10, 16, 3, K('wood', 3)); c.HL(0, 10, 16, K('wood', 5)); c.HL(0, 12, 16, K('wood', 1)); c.HL(0, 13, 16, K('wood', 0))
    stake(c, 6, 2, 15)


@REG.piece('wz-car-fence-v', '나무 울타리(세로)', 1, 1, ['S'], 'vehicles', SP, role='fence',
           desc='세로로 이어지는 울타리. 위에서 내려다본 가로대 한 줄과 말뚝 머리가 보인다.', rules='세로로 이어 깐다.', tags=['울타리'])
def _fence_v(c):
    c.R(6, 0, 4, 16, K('wood', 3)); c.VL(6, 0, 16, K('wood', 5)); c.VL(9, 0, 16, K('wood', 1)); c.VL(10, 0, 16, K('wood', 0))
    c.R(4, 3, 8, 6, K('wood', 3)); c.HL(4, 3, 8, K('wood', 5)); c.HL(4, 8, 8, K('wood', 1))
    c.HL(4, 9, 8, K('wood', 0)); c.R(5, 4, 2, 2, K('wood', 4)); c.P(5, 4, K('wood', 5))
    c.R(5, 13, 6, 3, K('night', 0)) if False else None
    c.outline()


@REG.piece('wz-car-fence-end', '나무 울타리(끝)', 1, 1, ['S'], 'vehicles', SP, role='fence',
           desc='가로 울타리의 오른쪽 끝: 굵은 마감 말뚝과 왼쪽에서 오는 가로대 두 줄.', rules='가로 울타리 오른쪽 끝에 놓는다.', tags=['울타리'])
def _fence_end(c):
    for y in (5, 10):
        c.R(0, y, 11, 3, K('wood', 3)); c.HL(0, y, 11, K('wood', 5)); c.HL(0, y + 2, 11, K('wood', 1)); c.HL(0, y + 3, 11, K('wood', 0))
    c.R(9, 1, 5, 14, K('wood', 3)); c.VL(9, 1, 14, K('wood', 5)); c.VL(13, 1, 14, K('wood', 1)); c.HL(9, 15, 5, K('wood', 0))
    c.R(10, 0, 3, 1, K('wood', 5)); c.R(10, 4, 2, 2, K('wood', 4)); c.P(11, 8, K('wood', 2))
    c.outline()


@REG.piece('wz-car-fence-corner', '나무 울타리(모서리)', 1, 1, ['S'], 'vehicles', SP, role='fence',
           desc='울타리 모서리: 말뚝 하나에서 왼쪽 가로대와 아래쪽 세로대가 갈라진다(ㄱ자).', rules='가로 울타리 오른쪽 끝이 아래로 꺾일 때 쓴다.', tags=['울타리'])
def _fence_corner(c):
    for y in (4, 8):
        c.R(0, y, 10, 3, K('wood', 3)); c.HL(0, y, 10, K('wood', 5)); c.HL(0, y + 2, 10, K('wood', 1)); c.HL(0, y + 3, 10, K('wood', 0))
    c.R(6, 6, 4, 10, K('wood', 3)); c.VL(6, 6, 10, K('wood', 5)); c.VL(9, 6, 10, K('wood', 1))
    c.R(9, 1, 5, 7, K('wood', 3)); c.VL(9, 1, 7, K('wood', 5)); c.VL(13, 1, 7, K('wood', 1)); c.R(10, 0, 3, 1, K('wood', 5))
    c.R(9, 8, 5, 2, K('wood', 2)); c.HL(9, 9, 5, K('wood', 0))
    c.R(7, 11, 5, 5, K('wood', 3)); c.R(8, 12, 2, 2, K('wood', 4)); c.VL(11, 11, 5, K('wood', 1)); c.HL(7, 15, 5, K('wood', 0))
    c.outline()


# ---------------------------------------------------------------- 승차 발판
@REG.piece('wz-car-step', '승차 발판', 1, 1, ['S'], 'vehicles', SP,
           desc='마차 문 앞에 놓는 나무 디딤대: 윗면 널 두 장과 앞면, 놋쇠 모서리쇠.', rules='열린 마차 문 바로 앞칸에 둔다.', tags=['발판'])
def _step(c):
    # 뒤쪽 윗단(좁게): 디딤판 3px + 챌판 3px
    c.R(3, 2, 10, 3, K('wood', 4)); c.HL(3, 2, 10, K('wood', 5)); c.HL(4, 4, 3, K('wood', 3)); c.HL(9, 3, 2, K('wood', 3))
    c.R(3, 5, 10, 3, K('wood', 2)); c.HL(3, 7, 10, K('wood', 1)); c.VL(12, 5, 3, K('wood', 1)); c.VL(3, 5, 2, K('wood', 3))
    # 앞쪽 아랫단(넓게): 디딤판 3px + 챌판 3px
    c.R(1, 8, 14, 3, K('wood', 4)); c.HL(1, 8, 14, K('wood', 5)); c.HL(3, 8, 10, K('wood', 3))   # 윗단 챌판 밑 그늘
    c.HL(2, 10, 4, K('wood', 3)); c.HL(10, 9, 3, K('wood', 3))
    c.R(1, 11, 14, 3, K('wood', 2)); c.HL(1, 13, 14, K('wood', 1)); c.VL(14, 11, 3, K('wood', 1)); c.VL(1, 11, 2, K('wood', 3))
    c.outline()


# ---------------------------------------------------------------- 운행 게시판(1x2)
@REG.piece('wz-car-noticeboard', '운행 게시판', 1, 2, ['S', 'S'], 'furniture', SP,
           desc='나무 기둥 둘에 건 운행표 게시판 1×2칸. 위에 양피지 세 장과 붉은 밀랍 핀, 아래 작은 선반.', rules='승차장 옆 길가에 둔다.', tags=['게시판', '운행표'])
def _noticeboard(c):
    for x in (2, 12): c.R(x, 6, 2, 26, K('wood', 2)); c.VL(x, 6, 26, K('wood', 3))
    c.R(1, 2, 14, 17, K('wood', 3)); c.HL(1, 2, 14, K('wood', 5)); c.VL(1, 2, 17, K('wood', 4)); c.VL(14, 2, 17, K('wood', 1)); c.HL(1, 18, 14, K('wood', 0))
    c.R(3, 4, 10, 12, K('wood', 2))
    c.R(3, 5, 4, 6, K('linen', 3)); c.HL(3, 5, 4, K('linen', 4)); c.HL(4, 7, 2, K('stone', 2)); c.HL(4, 9, 2, K('stone', 2)); c.P(4, 5, K('red', 3))
    c.R(8, 4, 4, 5, K('linen', 2)); c.HL(8, 4, 4, K('linen', 4)); c.HL(9, 6, 2, K('stone', 2)); c.P(10, 4, K('red', 3))
    c.R(7, 10, 5, 5, K('linen', 3)); c.HL(7, 10, 5, K('linen', 4)); c.HL(8, 12, 3, K('stone', 2)); c.HL(8, 13, 2, K('stone', 2)); c.P(9, 10, K('red', 3))
    c.R(0, 20, 16, 3, K('wood', 3)); c.HL(0, 20, 16, K('wood', 5)); c.HL(0, 22, 16, K('wood', 1))
    c.R(2, 28, 12, 3, K('night', 0)); c.R(5, 27, 6, 2, K('night', 0)) if False else None
    c.outline()


# ---------------------------------------------------------------- 마구 걸이(1x2)
@REG.piece('wz-car-harness-hook', '마구 걸이', 1, 2, ['S', 'S'], 'furniture', SP,
           desc='가죽 마구와 놋쇠 방울을 건 나무 걸이대 1×2칸. 위 가로대에 쇠 고리, 가죽끈 고리 둘.', rules='승차장 기둥 곁에 둔다.', tags=['마구', '걸이'])
def _hook(c):
    c.R(6, 2, 4, 30, K('wood', 3)); c.VL(6, 2, 30, K('wood', 4)); c.VL(9, 2, 30, K('wood', 1))
    c.R(1, 4, 14, 3, K('wood', 3)); c.HL(1, 4, 14, K('wood', 5)); c.HL(1, 6, 14, K('wood', 1)); c.HL(1, 7, 14, K('wood', 0))
    for x in (2, 12):
        c.VL(x, 8, 5, K('iron', 3)); c.P(x - 1, 13, K('iron', 3)); c.P(x, 13, K('iron', 2)); c.P(x + 1, 13, K('iron', 3))
    c.R(3, 8, 3, 12, K('choc', 2)); c.VL(3, 8, 12, K('choc', 3)); c.VL(5, 8, 12, K('choc', 0))
    c.R(10, 8, 3, 9, K('choc', 2)); c.VL(10, 8, 9, K('choc', 3)); c.VL(12, 8, 9, K('choc', 0))
    c.R(4, 20, 3, 3, K('brass', 3)); c.P(4, 20, K('brass', 5)); c.P(5, 22, K('brass', 1))
    c.R(11, 17, 3, 3, K('brass', 3)); c.P(11, 17, K('brass', 5)); c.P(12, 19, K('brass', 1))
    c.R(5, 29, 6, 3, K('wood', 2)); c.HL(5, 29, 6, K('wood', 4))
    c.outline()


# ---------------------------------------------------------------- 걸이 등불 기둥(1x3)
@REG.piece('wz-car-lantern-post', '걸이 등불 기둥', 1, 3, ['C', 'S', 'S'], 'furniture', SP,
           desc='휜 쇠팔에 따뜻한 등불을 매단 나무 기둥 1×3칸. 맨 위 등불은 사람 머리 위, 밑동은 돌받침.', rules='승차장·길가에 세운다. 등불 칸은 지나갈 수 있다.', tags=['등불', '기둥'])
def _lantern_post(c):
    c.R(6, 18, 4, 30, K('wood', 3)); c.VL(6, 18, 30, K('wood', 4)); c.VL(9, 18, 30, K('wood', 1))
    c.R(4, 43, 8, 5, K('stone', 3)); c.HL(4, 43, 8, K('stone', 4)); c.HL(4, 47, 8, K('stone', 1)); c.VL(11, 43, 5, K('stone', 2))
    c.R(7, 5, 2, 14, K('wood', 3)); c.R(3, 3, 11, 2, K('iron', 2)); c.HL(3, 3, 11, K('iron', 3)); c.P(3, 5, K('iron', 1))
    c.VL(4, 5, 3, K('iron', 1))
    c.R(2, 7, 5, 8, K('fire', 2)); c.R(3, 8, 3, 3, K('fire', 4)); c.P(3, 8, K('fire', 3)); c.HL(2, 6, 5, K('brass', 3)); c.HL(2, 15, 5, K('brass', 1))
    c.P(4, 5, K('brass', 5))
    c.outline()
    c.shadow(8, 46, 7, 2)


# ---------------------------------------------------------------- 짐 트렁크
@REG.piece('wz-car-trunk', '짐 트렁크', 1, 1, ['S'], 'furniture', SP,
           desc='둥근 뚜껑에 놋쇠 띠와 자물쇠가 달린 가죽 나무 트렁크. 윗면이 보인다.', rules='마차 곁·승차장에 쌓는다.', tags=['트렁크', '짐'])
def _trunk(c):
    c.R(1, 3, 14, 5, K('choc', 3)); c.HL(1, 3, 14, K('choc', 4)); c.HL(2, 4, 12, K('choc', 4)); c.HL(1, 7, 14, K('choc', 2))
    c.R(1, 8, 14, 7, K('choc', 2)); c.HL(1, 8, 14, K('choc', 1)); c.VL(14, 8, 7, K('choc', 0)); c.HL(1, 14, 14, K('choc', 0))
    for x in (3, 11): c.VL(x, 3, 12, K('brass', 3)); c.VL(x + 1, 3, 12, K('brass', 1))
    c.R(7, 7, 3, 4, K('brass', 4)); c.P(8, 9, K('night', 0)); c.P(7, 7, K('brass', 5))
    c.outline()


def _stop_place():
    P = []
    # 숲 가장자리: 위쪽·양옆 나무
    for x, y in ((0, 0), (3, 0), (6, 0), (9, 0), (12, 0)):
        P.append(('wz-nat-conifer-large' if x % 6 == 0 else 'wz-nat-conifer-small', x, y))
    P += [('wz-nat-broadleaf-old', 0, 2), ('wz-nat-twisted-old', 12, 2), ('wz-nat-conifer-small', 14, 5), ('wz-nat-conifer-small', 0, 6)]
    P += [('wz-nat-bush-wide', 4, 4), ('wz-nat-bush', 9, 4), ('wz-nat-rock-moss', 11, 5), ('wz-nat-bush', 5, 4)]
    P += [('wz-nat-fern-a', 3, 5), ('wz-nat-mushrooms', 8, 5), ('wz-nat-grass-tuft', 14, 4)]
    # 흙길
    for y in range(6, 13):
        for x in range(2, 14): P.append(('wz-nat-dirt', x, y))
    # 바퀴 자국
    P += [('wz-car-rut-h', x, 12) for x in range(4, 13)]
    P += [('wz-car-rut-v', 7, y) for y in (6, 7, 8, 9, 10, 11)]
    # 마차 A(아래 향함)와 마구 연결
    P += [('wz-car-carriage-down', 2, 6), ('wz-car-harness-s', 3, 11)]
    # 마차 B(왼쪽 향함)
    P += [('wz-car-carriage-left', 9, 8)]
    # 차양 · 등불 기둥 · 게시판 · 발판 · 트렁크 · 걸이
    P += [('wz-car-canopy', 5, 5), ('wz-car-lantern-post', 8, 6), ('wz-car-noticeboard', 11, 6), ('wz-car-step', 5, 10),
          ('wz-car-trunk', 14, 9), ('wz-car-trunk', 14, 10), ('wz-car-trunk', 13, 12), ('wz-car-harness-hook', 13, 7)]
    # 울타리
    P += [('wz-car-fence-corner', 1, 13)] + [('wz-car-fence-h', x, 13) for x in range(2, 14)] + [('wz-car-fence-end', 14, 13)]
    P += [('wz-car-fence-v', 1, 12), ('wz-car-fence-v', 1, 11)]
    return P


REG.example('wz-car-example-stop', '숲 승차장', 'carriage', 16, 14, 'wz-nat-forest-floor-a', _stop_place(),
            desc='금지된 숲 가장자리 세스트랄 마차 승차장. 흙길에 마차 2대(아래·왼쪽 향함), 승차 차양, 등불 기둥, 게시판, 울타리, 가장자리 숲.')


if __name__ == '__main__':
    sys.exit(1 if run_module(MODULE) else 0)
