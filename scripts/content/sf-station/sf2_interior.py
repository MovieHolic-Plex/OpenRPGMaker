"""sf_station 실내 조각 v2 — Opus 손 도트 다시 그리기(2026-10-14). 같은 id 를 다시 등록해 Sonnet 초안(sf_base·sf_interior)을 대신한다.
도구는 sf_kit(box2·inset·raised·monitor·cushion·blanket·pane·plating·brushed). 빛 왼쪽 위, 윗면 3단·앞면 3단, 큰 단색 면 금지."""
from sf_kit import *

I = dict(group='interior')


# =================================================================== 함교
@piece2('console-desk', '조종 콘솔(윗면 화면 둘 + 자판 줄 + 앞면 눌린 패널)', 2, 1, 'low_furniture', solid=[(0, 0), (1, 0)], tags=['콘솔', '계기'], desc='함교 조종 책상. 벽을 등지고 놓는다.', **I)
def _(c):
    box2(c, 1, 1, 30, 9, 5, 'hull', tt=2, ft=-1)
    monitor(c, 3, 2, 11, 5, 'cyan', 'graph', 1); monitor(c, 17, 2, 12, 5, 'green', 'wave', 2)
    for i in range(4, 28, 2): c.P(i, 8, K('white', 1 if (i // 2) % 3 else 3)); c.P(i, 9, K('hull', -1))
    c.P(15, 4, K('orange', 3)); c.P(15, 6, K('orange', 1))
    inset(c, 3, 11, 18, 3, 'hull', 0); leds(c, 5, 12, 7, s=1)
    grille(c, 23, 11, 6, 3, 'hull', 0)
    c.outline()


@piece2('console-big', '함교 주 조종 콘솔(윗면 화면 셋 + 자판 + 앞 패널 램프 줄)', 3, 1, 'low_furniture', solid=[(0, 0), (1, 0), (2, 0)], tags=['콘솔', '함교'], desc='함교 중앙 큰 콘솔. 벽을 향해 놓는다.', **I)
def _(c):
    box2(c, 1, 1, 46, 9, 5, 'hull', tt=2, ft=-1)
    monitor(c, 3, 2, 12, 5, 'cyan', 'graph', 3); monitor(c, 18, 2, 12, 5, 'cyan', 'radar', 4); monitor(c, 33, 2, 12, 5, 'green', 'lines', 5)
    for i in range(4, 44, 2): c.P(i, 8, K('white', 3 if i in (22, 24) else 1)); c.P(i, 9, K('hull', -1))
    c.R(16, 3, 1, 3, K('orange', 2)); c.R(31, 3, 1, 3, K('orange', 2))
    for k, x0 in enumerate((3, 18, 33)): inset(c, x0, 11, 12, 3, 'hull', 0); leds(c, x0 + 2, 12, 5, s=k)
    c.outline()


# =================================================================== 의자
def chair(c, shell, pad, arms=None, lamp=None, high=False):
    """3/4 의자: 등받이(셸 윗턱 + 앞 쿠션) 뒤, 앉는 면(위에서 본 쿠션) 앞, 기둥 + 다섯 발 받침."""
    top = 0 if high else 1
    box2(c, 3, top, 10, 2, 7 - top, shell, tt=2, ft=0)                    # 등받이 셸
    cushion(c, 5, top + 3, 6, 5 - top, pad, 0, seam=False)                  # 등 쿠션
    if arms:
        box2(c, 1, 6, 3, 2, 5, arms, tt=2, ft=-1); box2(c, 12, 6, 3, 2, 5, arms, tt=2, ft=-1)
        if lamp: c.P(2, 9, K(lamp, 3)); c.P(13, 9, K(lamp, 3))
    box2(c, 3, 8, 10, 4, 2, pad, tt=1, ft=-1)                                # 앉는 면
    c.HL(4, 8, 8, K(pad, 3)); c.P(4, 9, K(pad, 3)); c.HL(5, 10, 6, K(pad, 0))
    c.R(7, 13, 2, 1, K('cable', 2)); c.HL(3, 14, 10, K('cable', 0)); c.P(3, 14, K('cable', 2)); c.P(12, 14, K('cable', -1)); c.P(7, 14, K('cable', 2))
    c.outline()


@piece2('pilot-seat', '조종사 좌석(등받이 + 시안 쿠션 + 양옆 팔걸이 램프)', 1, 1, 'seat', solid=[(0, 0)], tags=['의자', '조종석'], desc='함교 조종석.', **I)
def _(c): chair(c, 'hull', 'cyan', arms='hull', lamp='orange')


@piece2('crew-chair', '승무원 의자(흰 셸 + 회청 쿠션)', 1, 1, 'seat', solid=[(0, 0)], tags=['의자'], desc='승무원 일반 의자.', **I)
def _(c): chair(c, 'white', 'hull')


@piece2('captain-chair', '함장 의자(높은 등받이 + 주황 쿠션 + 흰 팔걸이)', 1, 1, 'seat', solid=[(0, 0)], tags=['의자', '함장'], desc='함장석.', **I)
def _(c): chair(c, 'hull', 'orange', arms='white', lamp='cyan', high=True)


@piece2('stool', '둥근 걸상(시안 쿠션 윗면 + 흰 몸통)', 1, 1, 'round_body', solid=[(0, 0)], tags=['걸상'], desc='식당·실험실 둥근 걸상.', **I)
def _(c):
    cyl(c, 8, 6, 6, 3, 4, 'white', tt=2, ft=-1, ol=False)
    c.ell(8, 6, 4, 2, K('cyan', 1)); c.HL(6, 5, 3, K('cyan', 3)); c.P(10, 7, K('cyan', -1))
    c.R(7, 12, 2, 2, K('cable', 1)); c.HL(4, 14, 8, K('cable', 0)); c.P(4, 14, K('cable', 2))
    c.outline()


@piece2('bench', '긴 벤치(쿠션 둘 + 금속 받침)', 2, 1, 'seat', solid=[(0, 0), (1, 0)], tags=['벤치'], desc='복도·식당 긴 벤치.', **I)
def _(c):
    box2(c, 1, 3, 30, 7, 4, 'hull', tt=2, ft=-1)
    cushion(c, 2, 4, 13, 5, 'cyan', 0); cushion(c, 17, 4, 13, 5, 'cyan', 0)
    c.R(3, 14, 4, 1, K('cable', 0)); c.R(25, 14, 4, 1, K('cable', 0)); c.R(7, 14, 18, 1, K('shadow', 1))
    c.outline()


# =================================================================== 침상
@piece2('bed-single', '1인 침대(흰 베개 + 매트리스 + 접힌 남색 담요)', 2, 1, 'low_furniture', solid=[(0, 0), (1, 0)], tags=['침대'], desc='숙소 1인 침대. 머리맡은 왼쪽.', **I)
def _(c):
    box2(c, 1, 1, 30, 10, 4, 'hull', tt=1, ft=-1)
    cushion(c, 2, 2, 28, 8, 'white', 2, seam=False)                         # 매트리스
    cushion(c, 3, 3, 7, 5, 'white', 3)                                       # 베개
    blanket(c, 12, 2, 17, 8, 'navy', 2, 1)
    c.VL(11, 2, 8, K('white', 0))
    leds(c, 4, 12, 3, ('cyan',), 2); c.R(20, 12, 8, 1, K('hull', -3))
    c.outline()


@piece2('bunk', '이층 침대(밝은 위 칸 매트 윗면·담요 + 두꺼운 틀 앞면 + 그늘진 아래 칸 + 사다리 + 기둥)', 2, 2, 'tall_furniture', solid=[(0, 0), (1, 0), (0, 1), (1, 1)], tags=['침대', '숙소'], desc='승무원 이층 침대.', **I)
def _(c):
    # 아래 칸: 위 칸 밑의 어두운 속 + 베개·담요 + 앞 난간
    c.R(2, 16, 28, 11, K('cable', -1)); c.HL(2, 16, 28, K('shadow', 1))
    cushion(c, 4, 19, 24, 5, 'white', -2, seam=False); cushion(c, 5, 19, 6, 3, 'white', -1); blanket(c, 13, 19, 14, 5, 'navy', -2, 3)
    box2(c, 1, 24, 30, 2, 5, 'hull', tt=1, ft=-1, round_top=False)
    # 위 칸: 깊은 윗면(매트 윗면 8줄 + 뒤 난간) + 두꺼운 틀 앞면 4줄
    box2(c, 1, 1, 30, 11, 4, 'hull', topmat='hull', tt=2, ft=-2)
    c.HL(1, 1, 30, K('hull', -1)); c.R(1, 2, 30, 1, K('hull', 3))                 # 뒤 난간 윗선
    cushion(c, 3, 3, 26, 8, 'white', 2, seam=False); c.R(4, 4, 7, 5, K('white', 3)); c.HL(4, 8, 7, K('white', 0)); c.VL(10, 4, 5, K('white', 1))
    blanket(c, 12, 3, 17, 8, 'navy', 1, 2); c.HL(12, 3, 17, K('navy', 3))
    c.HL(3, 10, 26, K('white', 0))
    c.HL(1, 12, 30, K('hull', 3)); c.R(3, 13, 26, 2, K('hull', -1)); c.HL(3, 14, 26, K('cyan', 1))   # 앞 틀 턱 + 띠 등
    for x in (1, 29): c.R(x, 15, 2, 10, K('white', 0)); c.VL(x, 15, 10, K('white', 2))
    for y in range(17, 25, 3): c.HL(24, y, 5, K('white', 2)); c.HL(24, y + 1, 5, K('hull', -2))
    c.VL(23, 15, 10, K('white', 1)); c.VL(29, 15, 10, K('white', 1))
    c.outline()


@piece2('med-bed', '의무실 침대(흰 매트 + 연청 담요 + 머리맡 생체 화면)', 2, 2, 'low_furniture', solid=[(0, 0), (1, 0), (0, 1), (1, 1)], tags=['침대', '의무실'], desc='의무실 환자 침대. 머리맡은 위.', **I)
def _(c):
    box2(c, 9, 0, 14, 3, 6, 'white', tt=2, ft=-1)                         # 머리맡 기둥 + 화면
    monitor(c, 11, 3, 10, 5, 'green', 'wave', 2)
    box2(c, 2, 8, 28, 16, 5, 'white', tt=1, ft=-1)
    cushion(c, 3, 9, 26, 14, 'white', 2, seam=False)
    cushion(c, 9, 10, 14, 4, 'white', 3)
    blanket(c, 4, 15, 24, 8, 'cyan', 1, 0)
    c.R(4, 29, 3, 2, K('cable', 0)); c.R(25, 29, 3, 2, K('cable', 0)); c.R(7, 29, 18, 1, K('shadow', 1))
    leds(c, 5, 26, 4, ('green', 'cyan'), 2); c.R(15, 26, 12, 1, K('white', -3))
    c.outline()


@piece2('mess-table', '식당 탁자(흰 상판 + 식판 둘 + 받침)', 2, 1, 'low_furniture', solid=[(0, 0), (1, 0)], tags=['탁자', '식당'], desc='식당 탁자.', **I)
def _(c):
    box2(c, 1, 1, 30, 9, 3, 'white', tt=2, ft=-1)
    brushed(c, 2, 3, 28, 5, 'white', 2, 4)
    for x0, col in ((4, 'orange'), (18, 'green')):
        rnd(c, x0, 3, 10, 5, K('hull', 1)); c.HL(x0 + 1, 3, 8, K('hull', 3)); c.HL(x0 + 1, 7, 8, K('hull', -1))
        c.R(x0 + 1, 4, 3, 2, K(col, 2)); c.P(x0 + 1, 4, K(col, 3)); c.R(x0 + 5, 4, 4, 2, K('white', 0)); c.P(x0 + 6, 4, K('white', 2))
    c.R(5, 13, 3, 2, K('hull', -1)); c.R(24, 13, 3, 2, K('hull', -2)); c.R(8, 13, 16, 1, K('shadow', 1))
    c.outline()


# =================================================================== 의무실·냉동
@piece2('med-scanner', '의무실 링 스캐너(넓은 판 윗면 + 고리 몸체 앞면 + 시안 링 + 앞으로 나온 침대 윗면)', 2, 2, 'structure', solid=[(0, 0), (1, 0), (0, 1), (1, 1)], tags=['스캐너', '의무실'], desc='전신 스캐너. 침대가 앞으로 나온다.', **I)
def _(c):
    import math
    fy = box2(c, 2, 1, 28, 9, 15, 'white', topmat='hull', tt=2, ft=-1)
    plating(c, 3, 2, 26, 7, 'hull', 2, pw=9, ph=7, rivets=False)
    grille(c, 6, 3, 8, 3, 'hull', 0); c.R(18, 3, 8, 3, K('cyan', 1)); c.HL(18, 3, 8, K('cyan', 3))
    c.ell(16, fy + 8, 9, 6, K('white', 2)); c.ell(16, fy + 8, 7, 5, K('cable', -1)); c.ell(16, fy + 7, 5, 3, K('cable', -2))
    for a in range(16):
        x = int(round(16 + 8 * math.cos(a / 16 * 2 * math.pi))); y = int(round(fy + 8 + 5.5 * math.sin(a / 16 * 2 * math.pi)))
        if a % 2 == 0: c.P(x, y, K('cyan', 3 if y < fy + 8 else 1))
    leds(c, 4, fy + 2, 3, ('green', 'cyan')); leds(c, 23, fy + 2, 3, ('cyan', 'green'))
    by = box2(c, 8, 18, 16, 8, 3, 'white', tt=2, ft=-1)                    # 침대: 윗면 8줄
    cushion(c, 9, 19, 14, 6, 'cyan', 1, seam=False); cushion(c, 10, 19, 4, 3, 'white', 2)
    c.R(10, by + 3, 12, 1, K('shadow', 1)); c.R(3, 28, 4, 2, K('white', -2)); c.R(25, 28, 4, 2, K('white', -2))
    c.outline()


@piece2('med-cabinet', '의료 보관장(윗면 + 유리문 안 약병 칸 + 녹색 십자 램프)', 1, 2, 'tall_furniture', solid=[(0, 0), (0, 1)], tags=['보관장', '의무실'], desc='의무실 약품장. 벽에 붙인다.', **I)
def _(c):
    box2(c, 1, 1, 14, 5, 25, 'white', tt=2, ft=-1)
    c.R(3, 8, 10, 13, K('glass', -2)); c.HL(3, 8, 10, K('glass', 1))
    for j, cols in enumerate((('green', 'orange', 'cyan'), ('cyan', 'cyan', 'green'), ('orange', 'white', 'green'))):
        yy = 10 + j * 4
        c.HL(3, yy + 3, 10, K('white', -1))
        for i, col in enumerate(cols): c.R(4 + i * 3, yy, 2, 3, K(col, 1)); c.P(4 + i * 3, yy, K(col, 3))
    c.line(9, 9, 12, 12, K('glass', 2)); c.VL(8, 8, 13, K('white', -1))
    c.R(6, 22, 4, 4, K('green', 0)); c.R(7, 21, 2, 6, K('green', 2)); c.R(5, 23, 6, 2, K('green', 2)); c.P(7, 23, K('glow', 0))
    c.R(3, 28, 10, 1, K('white', -3)); c.outline()


def pod_lid(c, x, y, w, h, s=0):
    """냉동 포드 뚜껑: 선체 테(둥근) + 서리 유리(위 밝음→아래 어두움, 대각 서리 줄 2개, 가장자리 성에 점) + 안쪽 은은한 빛 기둥."""
    rnd(c, x, y, w, h, K('hull', 1)); c.HL(x + 1, y, w - 2, K('hull', 3)); c.VL(x, y + 1, h - 2, K('hull', 2))
    gx, gy, gw, gh = x + 2, y + 2, w - 4, h - 4
    for j in range(gh):
        t = 1 if j < gh // 4 else 0 if j < gh // 2 else -1
        c.HL(gx, gy + j, gw, K('cyan', t))
    rnd(c, gx + 2, gy + 3, gw - 4, gh - 6, K('cyan', 1)); c.VL(gx + gw // 2, gy + 4, gh - 8, K('cyan', 2))
    for k in range(2): c.line(gx + 1 + k * 3, gy + gh - 3, gx + gw - 2, gy + 2 + k * 3 + gh // 3, K('cyan', 2 + (1 - k)))
    for k in range(6): c.P(gx + (hsh(k, s, 1) % 2) * (gw - 1), gy + 1 + hsh(k, s, 2) % (gh - 2), K('white', 3))
    c.HL(gx, gy, gw, K('white', 2)); c.HL(gx, gy + gh - 1, gw, K('cyan', -3)); c.P(gx + 1, gy + 1, K('glow', 1))


def plant(c, x, y, t=0, big=False):
    """잎 덩이(5×4 / 7×5): 왼쪽 위 밝은 잎 + 오른쪽 아래 어두운 잎 + 줄기 점."""
    pts = ((1, 0, 2), (2, 0, 1), (0, 1, 2), (1, 1, 3), (2, 1, 1), (3, 1, 0), (0, 2, 1), (1, 2, 1), (2, 2, 0), (3, 2, -1), (4, 2, -1), (1, 3, -1), (2, 3, -2), (3, 3, -2))
    if big: pts += ((3, 0, 0), (4, 1, -1), (-1, 2, 1), (5, 3, -2), (0, 3, 0), (4, 3, -2), (2, 4, -3))
    for dx, dy, tt in pts: c.P(x + dx, y + dy, K('plant', tt + t))
    c.P(x + 2, y + 4 if not big else y + 5, K('plant', -3))


def cryo_standing(c, x, w, s=0):
    """선 냉동 포드: 둥근 윗 뚜껑 타원(윗면 5줄, 램프 테) + 서리 유리 앞문 + 받침."""
    cx = x + w // 2; rx = w // 2 + (1 if w < 14 else 0)
    for j in range(26):
        c.HL(x, 4 + j, w, K('hull', -1))
    c.VL(x, 4, 26, K('hull', 1)); c.VL(x + w - 1, 4, 26, K('hull', -3))
    c.ell(cx, 4, rx, 3, K('hull', 2)); c.ell(cx, 4, rx - 2, 2, K('hull', 3)); c.ell(cx, 4, rx - 4, 1, K('cyan', 2)); c.P(cx - 2, 3, K('glow', 0))
    c.HL(x + 1, 7, w - 2, K('hull', -3))
    pod_lid(c, x + 1, 8, w - 2, 17, s)
    c.R(x, 26, w, 4, K('hull', -2)); c.HL(x, 26, w, K('hull', 1))
    c.P(x + 3, 28, K('green', 3)); c.P(x + 5, 28, K('cyan', 3)); c.P(x + w - 4, 28, K('orange', 2))


@piece2('cryo-pod', '냉동 수면 포드(넓은 윗판 윗면 6줄(환기·램프) + 서리 유리 앞문 + 받침 상태 램프)', 1, 2, 'tall_furniture', solid=[(0, 0), (0, 1)], tags=['냉동', '포드'], desc='선 냉동 수면 포드 하나. 벽에 붙인다.', **I)
def _(c):
    cryo_standing(c, 1, 14, 3)
    box2(c, 1, 0, 14, 6, 2, 'hull', tt=2, ft=-2)
    grille(c, 3, 1, 5, 3, 'hull', 1); c.R(9, 1, 4, 3, K('cyan', 1)); c.HL(9, 1, 4, K('cyan', 3))
    c.outline()


@piece2('cryo-bank', '냉동 수면 포드 세 기 묶음(공용 윗판 윗면 + 둥근 뚜껑 셋 + 서리 유리문 + 제어 띠)', 3, 2, 'tall_furniture', solid=[(x, y) for x in range(3) for y in range(2)], tags=['냉동', '포드'], desc='냉동 수면실 포드 열. 벽에 붙인다.', **I)
def _(c):
    box2(c, 1, 1, 46, 6, 2, 'hull', tt=2, ft=-2)
    grille(c, 4, 2, 10, 3, 'hull', 1); grille(c, 34, 2, 10, 3, 'hull', 1); c.R(19, 2, 10, 3, K('cyan', 0)); c.HL(19, 2, 10, K('cyan', 3))
    for k in range(3): cryo_standing(c, 2 + k * 15, 14, k + 5)
    c.outline()


# =================================================================== 실험실
def flask(c, x, y, col, h=5):
    """작은 유리 플라스크: 목 + 둥근 몸 + 액체 + 반사."""
    c.R(x + 1, y, 2, 2, K('glass', 2)); c.R(x, y + 2, 4, h - 2, K('glass', 1))
    c.R(x, y + 3, 4, h - 3, K(col, 1)); c.HL(x, y + 3, 4, K(col, 3)); c.P(x, y + 2, K('glow', 0))


@piece2('lab-bench', '실험대(흰 상판 + 플라스크·시험관 꽂이·작은 화면 + 서랍 앞면)', 3, 1, 'low_furniture', solid=[(0, 0), (1, 0), (2, 0)], tags=['실험대', '연구실'], desc='연구실 긴 실험대.', **I)
def _(c):
    box2(c, 1, 1, 46, 9, 5, 'white', tt=2, ft=-1)
    flask(c, 4, 2, 'green'); flask(c, 9, 3, 'magenta', 4)
    c.R(15, 5, 10, 3, K('hull', 0)); c.HL(15, 5, 10, K('hull', 2))
    for i, col in enumerate(('cyan', 'orange', 'green', 'magenta')): c.R(16 + i * 2, 2, 1, 4, K(col, 2)); c.P(16 + i * 2, 2, K('white', 3))
    monitor(c, 28, 2, 10, 6, 'cyan', 'graph', 7); c.R(40, 4, 5, 3, K('hull', 1)); c.HL(40, 4, 5, K('hull', 3)); c.P(42, 5, K('green', 3))
    for k in range(4): inset(c, 3 + k * 11, 11, 9, 3, 'white', -1); c.HL(5 + k * 11, 12, 5, K('hull', 1))
    c.outline()


@piece2('lab-sink-bench', '실험실 세면 작업대(눌린 스테인리스 싱크 + 꺾인 수전 + 문 앞면)', 2, 1, 'low_furniture', solid=[(0, 0), (1, 0)], tags=['싱크', '연구실'], desc='연구실 싱크대.', **I)
def _(c):
    box2(c, 1, 1, 30, 9, 5, 'white', tt=2, ft=-1)
    inset(c, 4, 3, 14, 6, 'hull', 1); c.R(6, 6, 10, 2, K('hull', -1)); c.P(10, 6, K('cable', 0)); c.HL(6, 7, 9, K('glass', 1))
    c.R(19, 2, 2, 3, K('hull', 2)); c.HL(14, 2, 6, K('hull', 2)); c.P(14, 3, K('hull', 1)); c.P(19, 2, K('white', 3))
    c.R(23, 3, 5, 5, K('green', 0)); c.HL(23, 3, 5, K('green', 2)); c.P(25, 2, K('white', 2))
    inset(c, 3, 11, 12, 3, 'white', -1); inset(c, 17, 11, 12, 3, 'white', -1); c.P(13, 12, K('hull', 1)); c.P(18, 12, K('hull', 1))
    c.outline()


@piece2('microscope-station', '현미경 작업대(작은 상판 + 검은 현미경 + 표본 화면)', 1, 1, 'low_furniture', solid=[(0, 0)], tags=['현미경', '연구실'], desc='연구실 현미경 자리.', **I)
def _(c):
    box2(c, 1, 5, 14, 6, 4, 'white', tt=2, ft=-1)
    c.R(3, 6, 5, 3, K('cable', 1)); c.HL(3, 6, 5, K('cable', 3))                # 받침
    c.R(5, 1, 2, 6, K('cable', 2)); c.VL(5, 1, 6, K('cable', 3)); c.R(4, 0, 4, 2, K('white', 2)); c.HL(4, 0, 4, K('white', 3))
    c.P(7, 4, K('cyan', 3))
    monitor(c, 9, 4, 5, 5, 'magenta', 'map', 3)
    c.R(3, 12, 3, 2, K('hull', -1)); c.R(10, 12, 3, 2, K('hull', -2))
    c.outline()


@piece2('centrifuge', '원심분리기(흰 원통 + 윗면 투명 뚜껑 속 회전자 + 램프)', 1, 1, 'round_body', solid=[(0, 0)], tags=['원심분리기', '연구실'], desc='연구실 원심분리기.', **I)
def _(c):
    cyl(c, 8, 6, 6, 3, 5, 'white', tt=2, ft=-1, ol=False)
    c.ell(8, 6, 4, 2, K('glass', 0)); c.ell(8, 6, 2, 1, K('hull', 2)); c.P(8, 6, K('cable', 0))
    c.P(5, 6, K('orange', 2)); c.P(11, 6, K('orange', 2)); c.P(6, 5, K('glow', 0))
    c.R(6, 11, 4, 1, K('cable', 0)); c.P(7, 11, K('green', 3)); c.P(9, 11, K('cyan', 3))
    c.outline()


@piece2('fume-hood', '흄 후드 실험장(밝은 윗판 윗면 8줄 + 둥근 배기구 + 유리 가림창 속 기구 + 아래 수납)', 2, 2, 'tall_furniture', solid=[(0, 0), (1, 0), (0, 1), (1, 1)], tags=['흄후드', '연구실'], desc='연구실 흄 후드. 벽에 붙인다.', **I)
def _(c):
    fy = box2(c, 1, 1, 30, 9, 21, 'white', topmat='white', tt=3, ft=-1)
    c.HL(1, 1, 30, K('white', 0)); c.HL(2, 2, 28, K('white', 2))
    c.ell(16, 5, 5, 2, K('hull', 0)); c.ell(16, 5, 4, 1, K('cable', -2)); c.HL(13, 4, 6, K('hull', 2))
    grille(c, 4, 4, 6, 3, 'white', 0); grille(c, 22, 4, 6, 3, 'white', 0)
    c.R(3, fy + 1, 26, 10, K('cable', -1)); c.HL(3, fy + 1, 26, K('shadow', 1))
    c.R(3, fy + 9, 26, 2, K('white', 1)); c.HL(3, fy + 9, 26, K('white', 3))
    flask(c, 7, fy + 3, 'green', 6); flask(c, 13, fy + 4, 'orange', 5); c.R(19, fy + 6, 6, 3, K('hull', 1)); c.HL(19, fy + 6, 6, K('hull', 3)); c.P(21, fy + 7, K('cyan', 3))
    for x in range(3, 29, 6): c.VL(x, fy + 1, 8, K('glass', 1))
    c.HL(3, fy + 4, 26, K('glass', 2)); c.line(5, fy + 7, 9, fy + 2, K('glass', 2))
    inset(c, 3, fy + 12, 12, 7, 'white', -1); inset(c, 17, fy + 12, 12, 7, 'white', -1); c.P(13, fy + 15, K('hull', 1)); c.P(18, fy + 15, K('hull', 1))
    c.outline()


@piece2('specimen-tank', '표본 수조(위에서 보이는 열린 용액 수면 타원 + 금속 테 + 초록 유리 원통 + 거품 + 받침)', 1, 2, 'round_body', solid=[(0, 0), (0, 1)], tags=['수조', '표본'], desc='연구실 표본 수조.', **I)
def _(c):
    box2(c, 1, 23, 14, 3, 5, 'hull', tt=2, ft=-1)
    for x in range(2, 14):
        u = (x - 7.5) / 6.5
        for y in range(7, 24): c.P(x, y, K('green', (1 if u < -0.4 else -1 if u > 0.5 else 0)))
    c.VL(3, 9, 13, K('green', 3)); c.VL(4, 9, 13, K('green', 2)); c.VL(12, 7, 16, K('green', -2))
    for (bx, by) in ((6, 19), (9, 15), (7, 12), (10, 21)): c.P(bx, by, K('glow', 0)); c.P(bx + 1, by + 1, K('green', 2))
    c.ell(8, 6, 7, 4, K('hull', 2)); c.ell(8, 6, 6, 3, K('hull', -1))            # 테(윗면)
    c.ell(8, 6, 5, 2, K('green', 1)); c.HL(5, 5, 5, K('green', 3)); c.P(6, 5, K('glow', 0))   # 열린 수면
    c.HL(2, 2, 12, K('hull', 3))
    c.P(4, 25, K('green', 3)); c.P(7, 25, K('cyan', 3)); c.outline()


@piece2('analysis-console', '분석 콘솔(윗면 화면 둘 + 시료병 받침 + 앞 램프 패널)', 2, 1, 'low_furniture', solid=[(0, 0), (1, 0)], tags=['콘솔', '분석'], desc='시료 분석 콘솔.', **I)
def _(c):
    box2(c, 1, 1, 30, 9, 5, 'hull', tt=2, ft=-1)
    monitor(c, 3, 2, 10, 6, 'green', 'graph', 9); monitor(c, 14, 2, 7, 6, 'cyan', 'radar', 3)
    rnd(c, 22, 3, 8, 5, K('hull', -1))
    for i in range(3):
        for j in range(2): c.P(23 + i * 2, 4 + j * 2, K(('magenta', 'cyan', 'orange')[(i + j) % 3], 3))
    inset(c, 3, 11, 26, 3, 'hull', 0); leds(c, 5, 12, 6, ('green', 'cyan', 'orange'), 2, 3); grille(c, 19, 12, 8, 1, 'hull', 2)
    c.outline()


@piece2('holo-table', '홀로 테이블(낮은 원판 + 위에 떠 있는 시안 행성 홀로)', 2, 2, 'low_furniture', solid=[(0, 1), (1, 1), (0, 0), (1, 0)], tags=['홀로', '탁자'], desc='작전실 홀로 테이블.', **I)
def _(c):
    cyl(c, 16, 21, 13, 5, 5, 'hull', tt=2, ft=-1, ol=False, bands=0)
    c.ell(16, 21, 10, 4, K('cable', 0)); c.ell(16, 21, 7, 3, K('cyan', -1)); c.ell(16, 21, 4, 1, K('cyan', 2))
    for k in range(-6, 7, 3): c.line(16 + k, 21, 16 + k * 2 // 3, 12, K('cyan', -2)) if k else None
    import math
    for y in range(2, 15):
        for x in range(9, 24):
            d = ((x - 16) / 6.5) ** 2 + ((y - 8) / 6.5) ** 2
            if d <= 1 and (x + y) % 2 == 0: c.P(x, y, K('cyan', 2 if d < .5 and x < 16 else 1 if d < .85 else 0))
    c.line(10, 8, 22, 8, K('cyan', 3)); c.P(13, 5, K('glow', 1)); c.P(19, 11, K('cyan', 3))
    c.P(5, 24, K('orange', 3)); c.P(27, 24, K('orange', 3))
    c.outline()


@piece2('3d-printer', '3D 프린터(유리 덮개 상자 + 출력 베드 위 물체 + 윗면 필라멘트 실패)', 2, 2, 'box', solid=[(0, 0), (1, 0), (0, 1), (1, 1)], tags=['프린터', '공작'], desc='공작실 3D 프린터.', **I)
def _(c):
    box2(c, 2, 2, 28, 9, 19, 'hull', tt=2, ft=-1)
    cyl(c, 10, 6, 4, 2, 1, 'orange', tt=2, ft=0, ol=False); c.P(10, 6, K('cable', 0))
    grille(c, 18, 4, 9, 4, 'hull', 1)
    c.R(4, 13, 24, 12, K('cable', -1)); c.HL(4, 13, 24, K('hull', -3))
    c.R(5, 22, 22, 2, K('hull', 1)); c.HL(5, 22, 22, K('hull', 3))
    c.R(12, 17, 8, 5, K('orange', 1)); c.HL(12, 17, 8, K('orange', 3)); c.R(13, 15, 6, 2, K('orange', 2))
    c.HL(5, 14, 22, K('hull', 1)); c.R(14, 14, 4, 2, K('hull', 2)); c.P(15, 16, K('orange', 3))
    for x in (4, 27): c.VL(x, 13, 12, K('hull', 1))
    c.line(6, 21, 11, 15, K('glass', 2)); c.P(25, 15, K('green', 3))
    c.R(4, 27, 24, 1, K('hull', -3)); c.outline()


@piece2('hydroponic-rack', '수경 재배 선반(보라 재배등 두 단 + 잎 덩이 + 물 트레이)', 2, 2, 'tall_furniture', solid=[(0, 0), (1, 0), (0, 1), (1, 1)], tags=['수경재배', '식물'], desc='수경 재배 선반. 벽에 붙인다.', **I)
def _(c):
    box2(c, 1, 1, 30, 5, 25, 'hull', tt=2, ft=-1)
    for k, yy in enumerate((8, 18)):
        c.R(3, yy, 26, 9, K('cable', -1)); c.HL(3, yy, 26, K('violet', 3)); c.HL(3, yy + 1, 26, K('violet', 0))
        for i in range(5):
            plant(c, 4 + i * 5 + (k % 2), yy + 2, 1 - (i % 2))
        c.R(3, yy + 7, 26, 2, K('cyan', -1)); c.HL(3, yy + 7, 26, K('cyan', 1))
    c.outline()


@piece2('planter-box', '재배 상자(금속 테 + 흙 윗면 + 초록 잎 덩이)', 2, 1, 'organic', solid=[(0, 0), (1, 0)], tags=['식물', '화분'], desc='거주구 재배 상자.', **I)
def _(c):
    box2(c, 1, 4, 30, 6, 5, 'hull', tt=2, ft=-1)
    c.R(3, 5, 26, 4, K('rust', -2)); c.HL(3, 5, 26, K('rust', -3))
    for i in range(4):
        plant(c, 4 + i * 6, 1 + (i % 2), 1 - (i % 2), big=True)
    c.R(3, 12, 26, 1, K('hull', -3)); c.outline()


# =================================================================== 숙소·식당·위생
def locker_door(c, x, y, w, h, mat='hull', s=0):
    """사물함 문: 튀어나온 판 + 위 환기 틈 셋 + 손잡이 + 이름표 램프."""
    raised(c, x, y, w, h, mat, -1)
    for k in range(3): c.HL(x + 2, y + 2 + k * 2, w - 4, K(mat, -3)); c.HL(x + 2, y + 3 + k * 2, w - 4, K(mat, 0))
    c.R(x + w - 3, y + h // 2, 1, 4, K('white', 2)); c.P(x + w - 3, y + h // 2 + 4, K('white', 0))
    c.R(x + 2, y + h - 5, 3, 2, K(('cyan', 'orange', 'green')[s % 3], 1)); c.P(x + 2, y + h - 5, K(('cyan', 'orange', 'green')[s % 3], 3))


@piece2('locker', '개인 사물함(윗면 + 환기 틈 문 + 손잡이 + 이름 램프)', 1, 2, 'tall_furniture', solid=[(0, 0), (0, 1)], tags=['사물함'], desc='승무원 사물함. 벽에 붙인다.', **I)
def _(c):
    box2(c, 1, 1, 14, 5, 25, 'hull', tt=2, ft=-1)
    locker_door(c, 3, 8, 10, 18, 'hull', 0); c.R(2, 28, 12, 1, K('hull', -3))
    c.outline()


@piece2('locker-row', '사물함 두 칸 열(윗면 + 문 둘)', 2, 2, 'tall_furniture', solid=[(0, 0), (1, 0), (0, 1), (1, 1)], tags=['사물함'], desc='사물함 두 칸. 벽에 붙인다.', **I)
def _(c):
    box2(c, 1, 1, 30, 5, 25, 'hull', tt=2, ft=-1)
    locker_door(c, 3, 8, 12, 18, 'hull', 1); locker_door(c, 17, 8, 12, 18, 'hull', 2); c.VL(16, 7, 21, K('hull', -3))
    c.R(2, 28, 28, 1, K('hull', -3)); c.outline()


@piece2('galley-counter', '조리 카운터(솔결 스테인리스 상판 + 가열판 둘 + 냄비 + 아래 수납)', 3, 1, 'low_furniture', solid=[(0, 0), (1, 0), (2, 0)], tags=['주방', '식당'], desc='식당 조리대.', **I)
def _(c):
    box2(c, 1, 1, 46, 9, 5, 'white', topmat='hull', tt=3, ft=-1, tex='brushed', seed=2)
    for x0 in (4, 14):
        c.ell(x0 + 3, 5, 3, 2, K('cable', 0)); c.ell(x0 + 3, 5, 2, 1, K('orange', 0)); c.P(x0 + 3, 5, K('orange', 3))
    cyl(c, 30, 4, 4, 2, 2, 'white', tt=2, ft=-1, ol=False); c.ell(30, 4, 2, 1, K('orange', 1)); c.P(29, 3, K('white', 3))
    c.R(37, 3, 7, 4, K('hull', 1)); c.HL(37, 3, 7, K('hull', 3)); c.P(39, 4, K('green', 2)); c.P(41, 4, K('orange', 2))
    for k in range(4): inset(c, 3 + k * 11, 11, 9, 3, 'white', -1); c.HL(5 + k * 11, 12, 5, K('hull', 1))
    c.outline()


@piece2('galley-fridge', '식당 냉장고(윗면 + 위·아래 두 문 + 세로 손잡이 + 온도 램프)', 1, 2, 'tall_furniture', solid=[(0, 0), (0, 1)], tags=['냉장고', '주방'], desc='식당 냉장고. 벽에 붙인다.', **I)
def _(c):
    box2(c, 1, 1, 14, 5, 25, 'white', tt=2, ft=-1)
    raised(c, 2, 7, 12, 8, 'white', 0); raised(c, 2, 16, 12, 11, 'white', -1)
    c.R(11, 9, 1, 5, K('hull', 1)); c.R(11, 18, 1, 6, K('hull', 1)); c.P(11, 9, K('hull', 3))
    c.R(4, 9, 4, 2, K('cable', 0)); c.P(4, 9, K('cyan', 3)); c.P(6, 9, K('cyan', 2))
    c.R(2, 28, 12, 1, K('white', -3)); c.outline()


@piece2('vending-int', '실내 자판기(윗면 + 음식 진열창 + 버튼 줄 + 투입구)', 1, 2, 'tall_furniture', solid=[(0, 0), (0, 1)], tags=['자판기'], desc='휴게실 자판기. 벽에 붙인다.', **I)
def _(c):
    box2(c, 1, 1, 14, 5, 25, 'orange', tt=2, ft=-1)
    c.R(3, 8, 8, 14, K('glass', -2)); c.HL(3, 8, 8, K('glass', 1))
    for j in range(3):
        c.HL(3, 12 + j * 4, 8, K('hull', 0))
        for i in range(3): c.R(4 + i * 2 + (j % 2), 10 + j * 4, 1, 2, K(('cyan', 'green', 'magenta', 'white')[(i + j) % 4], 2))
    c.line(5, 20, 9, 9, K('glass', 1))
    c.R(12, 9, 2, 10, K('cable', 0)); [c.P(12, 10 + k * 2, K(('green', 'cyan', 'orange', 'green', 'cyan')[k], 3)) for k in range(5)]
    c.R(4, 24, 7, 2, K('cable', -1)); c.HL(4, 24, 7, K('orange', -3)); c.R(2, 28, 12, 1, K('orange', -3))
    c.outline()


@piece2('shower-pod', '샤워 포드(윗면 샤워 머리 + 반투명 유리문 물줄기 + 배수 받침)', 1, 2, 'tall_furniture', solid=[(0, 0), (0, 1)], tags=['샤워', '위생'], desc='위생실 샤워 포드. 벽에 붙인다.', **I)
def _(c):
    box2(c, 1, 1, 14, 5, 25, 'white', tt=2, ft=-1)
    c.ell(8, 3, 3, 1, K('hull', 1)); c.P(8, 3, K('cyan', 3))
    pane(c, 3, 7, 10, 17, 'glass', 1)
    for x in range(4, 12, 2):
        for y in range(8 + (x % 4), 23, 3): c.P(x, y, K('cyan', 2))
    c.R(3, 24, 10, 2, K('hull', 0)); c.HL(3, 24, 10, K('hull', 2)); c.P(8, 25, K('cable', 0))
    c.R(2, 28, 12, 1, K('white', -3)); c.outline()


@piece2('sink-unit', '세면대 유닛(흰 상판 + 눌린 세면볼 + 수전 + 아래 문)', 1, 1, 'low_furniture', solid=[(0, 0)], tags=['세면대', '위생'], desc='위생실 세면대.', **I)
def _(c):
    box2(c, 1, 2, 14, 7, 6, 'white', tt=2, ft=-1)
    c.ell(8, 6, 5, 3, K('white', 3)); c.ell(8, 6, 4, 2, K('white', 0)); c.ell(8, 7, 3, 1, K('cyan', 0)); c.HL(5, 5, 6, K('white', -2)); c.P(8, 7, K('cable', 0)); c.P(6, 7, K('cyan', 2))
    c.R(7, 1, 2, 3, K('hull', 2)); c.P(7, 1, K('white', 3)); c.P(8, 3, K('hull', 0))
    inset(c, 3, 10, 10, 3, 'white', -1); c.P(8, 11, K('hull', 1))
    c.outline()


# =================================================================== 기관실·화물
@piece2('server-rack', '서버 랙(밝은 회색 윗판 윗면·환기 격자 + 어두운 앞면 램프 칸 여섯 + 손잡이)', 1, 2, 'tall_furniture', solid=[(0, 0), (0, 1)], tags=['서버'], desc='서버 랙. 벽에 붙인다.', **I)
def _(c):
    fy = box2(c, 1, 1, 14, 7, 23, 'cable', topmat='hull', tt=2, ft=0)
    grille(c, 3, 3, 10, 3, 'hull', 0)
    for k in range(6):
        y = fy + 1 + k * 3
        raised(c, 2, y, 12, 3, 'cable', 1); leds(c, 4, y + 1, 4, ('green', 'cyan', 'orange', 'green'), 2, k); c.P(12, y + 1, K('hull', 1))
    c.R(2, 29, 12, 1, K('cable', -2)); c.outline()


@piece2('reactor', '소형 반응로(띠 두른 원통 + 윗면 빛나는 코어 + 냉각관)', 2, 2, 'round_body', solid=[(0, 1), (1, 1), (0, 0), (1, 0)], tags=['반응로', '기관실'], desc='기관실 반응로 코어.', **I)
def _(c):
    cyl(c, 16, 9, 13, 5, 15, 'hull', tt=2, ft=-1, ol=False, bands=2)
    c.ell(16, 9, 10, 4, K('hull', -2)); c.ell(16, 9, 8, 3, K('cyan', 0)); c.ell(16, 9, 5, 2, K('cyan', 2)); c.ell(16, 9, 2, 1, K('glow', 1))
    for x in (5, 26): c.R(x, 15, 2, 9, K('cyan', 1)); c.VL(x, 15, 9, K('cyan', 3))
    for x in (10, 21): c.R(x, 17, 2, 10, K('hull', -2)); c.P(x, 17, K('hull', 1))
    hazard(c, 9, 25, 14, 2); c.outline()


@piece2('pipe-cluster', '배관 다발(굵은 구리관 셋, 위에서 보이는 관 끝 원 + 위 고정 판 윗면 + 흰 밸브 바퀴 + 받침 상자)', 1, 2, 'column', solid=[(0, 1)], tags=['배관', '기관실'], desc='기관실 배관 기둥. 벽에 붙인다.', **I)
def _(c):
    box2(c, 1, 21, 14, 4, 6, 'hull', tt=2, ft=-1)
    for k, x in enumerate((2, 6, 10)):
        c.R(x, 4, 4, 18, K('rust', 0)); c.VL(x, 4, 18, K('rust', 2)); c.VL(x + 1, 4, 18, K('rust', 1)); c.VL(x + 3, 4, 18, K('rust', -2))
        for y in (11, 17): c.HL(x, y, 4, K('hull', 2)); c.HL(x, y + 1, 4, K('hull', -2))
    box2(c, 1, 1, 14, 4, 2, 'hull', tt=2, ft=-2)                                 # 위 고정 판(윗면 4줄)
    for x in (4, 8, 12): c.ell(x, 3, 1, 1, K('rust', 3)); c.P(x, 3, K('rust', -2))
    c.ell(8, 14, 3, 3, K('white', 2)); c.ell(8, 14, 1, 1, K('hull', 0)); c.P(7, 12, K('white', 3)); c.P(8, 14, K('orange', 3))
    c.outline()


@piece2('power-conduit', '전력 도관 상자(윗면 굵은 케이블 둘 + 번개 경고 램프)', 2, 1, 'low_furniture', solid=[(0, 0), (1, 0)], tags=['전력', '기관실'], desc='기관실 전력 분배 상자.', **I)
def _(c):
    box2(c, 1, 2, 30, 7, 6, 'hull', tt=2, ft=-1, tex='plate')
    for y in (3, 6): c.HL(2, y, 28, K('cable', 1)); c.HL(2, y + 1, 28, K('cable', -1)); c.P(8, y, K('cable', 3))
    c.R(12, 3, 6, 5, K('yellow', 0)); c.HL(12, 3, 6, K('yellow', 2)); c.line(16, 4, 14, 6, K('cable', -2)); c.P(15, 5, K('cable', -2))
    inset(c, 3, 10, 18, 3, 'hull', 0); leds(c, 5, 11, 4, ('orange', 'green'), 3); grille(c, 23, 10, 6, 3, 'hull', 0)
    c.outline()


@piece2('cargo-crate', '화물 상자(주황 판 윗면 + 모서리 보강 + 위험 띠)', 1, 1, 'box', solid=[(0, 0)], tags=['화물'], desc='화물 상자.', **I)
def _(c):
    box2(c, 1, 2, 14, 7, 6, 'orange', tt=2, ft=-1)
    c.HL(2, 5, 12, K('orange', 0)); c.HL(2, 6, 12, K('orange', 3))
    for (x, y) in ((2, 3), (12, 3), (2, 7), (12, 7)): c.P(x, y, K('hull', 2))
    for x in (1, 14): c.VL(x, 9, 5, K('hull', 1 if x == 1 else -1))
    hazard(c, 3, 11, 10, 2); c.HL(2, 13, 12, K('orange', -3))
    c.outline()


@piece2('cargo-pallet', '화물 팔레트 적재(받침 판 + 상자 둘 + 묶음 띠)', 2, 1, 'box', solid=[(0, 0), (1, 0)], tags=['화물'], desc='화물 팔레트.', **I)
def _(c):
    box2(c, 1, 9, 30, 3, 3, 'rust', tt=1, ft=-2)
    c.R(4, 13, 4, 1, K('shadow', 1)); c.R(14, 13, 4, 1, K('shadow', 1)); c.R(24, 13, 4, 1, K('shadow', 1))
    box2(c, 3, 2, 12, 5, 5, 'hull', tt=2, ft=-1); c.HL(4, 4, 10, K('hull', 0)); c.P(8, 8, K('orange', 3))
    box2(c, 16, 1, 13, 6, 6, 'orange', tt=2, ft=-1); c.HL(17, 3, 11, K('orange', 0))
    c.VL(9, 1, 11, K('yellow', 1)); c.VL(22, 1, 11, K('yellow', 1))
    c.outline()


@piece2('cargo-container-int', '화물 컨테이너(주름 판 앞면 + 윗면 이음 + 잠금 손잡이)', 2, 2, 'box', solid=[(0, 0), (1, 0), (0, 1), (1, 1)], tags=['화물', '컨테이너'], desc='화물칸 컨테이너.', **I)
def _(c):
    box2(c, 1, 1, 30, 10, 19, 'navy', tt=2, ft=0, tex='plate')
    for x in range(3, 29, 3): c.VL(x, 12, 17, K('navy', 2)); c.VL(x + 1, 12, 17, K('navy', -2))
    c.VL(15, 12, 17, K('navy', -3)); c.VL(16, 12, 17, K('navy', 1))
    for x in (13, 18): c.R(x, 18, 1, 5, K('hull', 2))
    c.R(3, 13, 6, 3, K('white', 1)); c.HL(3, 13, 6, K('white', 3)); c.P(4, 14, K('orange', 2))
    c.outline()


@piece2('cargo-lift-pad', '화물 리프트 발판(바닥 원판 + 노랑 위험 테두리 + 가운데 화살표)', 3, 2, 'flat', solid=[], tags=['리프트', '화물'], desc='화물 승강 발판. 걷는다.', **I)
def _(c):
    c.R(1, 1, 46, 30, K('hull', -1)); plating(c, 1, 1, 46, 30, 'hull', -1, pw=12, ph=10)
    hazard(c, 1, 1, 46, 2); hazard(c, 1, 29, 46, 2)
    for y in range(3, 29): c.P(1, y, K('yellow', 1) if (y // 2) % 2 else K('cable', 0)); c.P(46, y, K('yellow', 1) if (y // 2) % 2 else K('cable', 0))
    c.ell(24, 16, 9, 7, K('hull', -3)); c.ell(24, 16, 8, 6, K('hull', 0))
    for k in range(4): c.HL(24 - k, 11 + k, 2 * k + 1, K('cyan', 2))
    c.R(23, 15, 3, 6, K('cyan', 2)); c.P(24, 11, K('glow', 0))
    for (x, y) in ((4, 5), (43, 5), (4, 26), (43, 26)): c.P(x, y, K('orange', 3))


@piece2('elevator-door', '승강기 문(사다리꼴 윗면 문틀 + 두 장 미닫이 + 층 램프)', 2, 2, 'structure', solid=[(0, 0), (1, 0), (0, 1), (1, 1)], tags=['승강기', '문'], desc='층 사이 승강기. 문 앞 칸에서 탄다.', **I)
def _(c):
    tcube(c, 1, 1, 30, 7, 23, 'white', ins=3, tt=2, ft=-1, ol=False, seams=False)
    c.R(4, 10, 24, 18, K('hull', -2)); c.HL(4, 10, 24, K('hull', -3))
    raised(c, 5, 11, 11, 17, 'hull', 1); raised(c, 16, 11, 11, 17, 'hull', 0)
    c.VL(16, 11, 17, K('cable', -1)); c.HL(5, 19, 22, K('hull', -1))
    c.R(11, 3, 10, 3, K('cable', 0)); c.P(13, 4, K('cyan', 3)); c.P(16, 4, K('cyan', 1)); c.P(18, 4, K('orange', 3))
    c.R(28, 15, 2, 4, K('cable', 0)); c.P(28, 16, K('green', 3)); c.P(28, 18, K('orange', 2))
    c.outline()


@piece2('airlock-inner', '내부 에어록 격벽문(사다리꼴 윗면 틀 + 큰 원형 해치 + 바퀴 손잡이 + 위험 띠)', 2, 2, 'structure', solid=[(0, 0), (1, 0), (0, 1), (1, 1)], tags=['에어록', '문'], desc='정거장 안 에어록 문.', **I)
def _(c):
    tcube(c, 1, 1, 30, 7, 23, 'hull', ins=3, tt=2, ft=-1, ol=False, seams=False)
    hazard(c, 3, 9, 26, 2)
    c.ell(16, 19, 10, 8, K('hull', -3)); c.ell(16, 19, 9, 7, K('hull', 1)); c.ell(16, 19, 7, 5, K('hull', 0)); c.ell(16, 20, 6, 4, K('hull', -1))
    c.ell(16, 19, 3, 3, K('white', 1)); c.ell(16, 19, 1, 1, K('hull', -2))
    c.line(12, 19, 20, 19, K('white', 2)); c.line(16, 15, 16, 23, K('white', 2)); c.P(13, 16, K('white', 3))
    for (x, y) in ((8, 13), (24, 13), (8, 25), (24, 25)): bolt(c, x, y, 'hull', 3)
    c.R(14, 3, 4, 3, K('orange', 1)); c.P(15, 3, K('orange', 3))
    c.outline()


@piece2('hatch-floor', '바닥 해치(정사각 판 + 가운데 손잡이 + 위험 모서리)', 1, 1, 'flat', solid=[], tags=['해치', '바닥'], desc='바닥 점검 해치. 걷는다.', **I)
def _(c):
    c.R(1, 1, 14, 14, K('hull', -3)); raised(c, 2, 2, 12, 12, 'hull', 0)
    for (x, y) in ((2, 2), (11, 2), (2, 11), (11, 11)): hazard(c, x, y, 3, 3)
    c.R(6, 7, 4, 2, K('hull', -2)); c.HL(6, 7, 4, K('hull', 2)); c.P(4, 4, K('hull', 2))


@piece2('rug-hex', '육각 바닥 깔개(남색 육각형 + 시안 테 + 가운데 무늬)', 2, 2, 'flat', solid=[], tags=['깔개', '바닥'], desc='휴게실 깔개. 걷는다.', **I)
def _(c):
    for y in range(3, 29):
        half = 14 - abs(y - 16) * 0.55
        for x in range(int(16 - half), int(16 + half) + 1):
            c.P(x, y, K('navy', 1 if (x + y) % 6 else 2))
    for y in range(3, 29):
        half = 14 - abs(y - 16) * 0.55
        c.P(int(16 - half), y, K('cyan', 1)); c.P(int(16 + half), y, K('cyan', 0))
    c.HL(10, 3, 13, K('cyan', 2)); c.HL(10, 28, 13, K('cyan', -1))
    for y in range(9, 24):
        half = 7 - abs(y - 16) * 0.55
        c.P(int(16 - half), y, K('violet', 2)); c.P(int(16 + half), y, K('violet', 1))
    c.ell(16, 16, 2, 2, K('cyan', 2)); c.P(15, 15, K('glow', 0))


# =================================================================== 벽에 거는 것
@piece2('wall-screen-a', '벽 부착 화면(시안 그래프 막대)', 1, 1, 'wall_mounted', solid=[], tags=['화면', '벽'], desc='벽 화면.', **I)
def _(c): monitor(c, 1, 2, 14, 11, 'cyan', 'graph', 4); c.R(6, 13, 4, 1, K('cable', 0)); c.outline()


@piece2('wall-screen-b', '벽 부착 화면(초록 데이터 줄)', 1, 1, 'wall_mounted', solid=[], tags=['화면', '벽'], desc='벽 화면.', **I)
def _(c): monitor(c, 1, 2, 14, 11, 'green', 'lines', 6); c.R(6, 13, 4, 1, K('cable', 0)); c.outline()


@piece2('wall-screen-c', '벽 부착 경고 화면(주황 경고 삼각)', 1, 1, 'wall_mounted', solid=[], tags=['화면', '경고', '벽'], desc='벽 경고 화면.', **I)
def _(c): monitor(c, 1, 2, 14, 11, 'orange', 'warn', 2); c.R(6, 13, 4, 1, K('cable', 0)); c.outline()


@piece2('wall-map-display', '벽 부착 항로 지도 화면(점 성계 + 항로 선)', 2, 1, 'wall_mounted', solid=[], tags=['화면', '지도', '벽'], desc='벽 항로 지도.', **I)
def _(c): monitor(c, 1, 1, 30, 13, 'cyan', 'map', 8); c.P(9, 9, K('magenta', 3)); c.P(22, 4, K('green', 3)); c.outline()


def porthole(c, inner):
    c.ell(8, 8, 7, 7, K('hull', 1)); c.ell(8, 8, 6, 6, K('hull', 2)); c.ell(8, 9, 6, 6, K('hull', -1))
    c.ell(8, 8, 5, 5, K('star', 0)); inner(c)
    for (x, y) in ((8, 1), (15, 8), (8, 15), (1, 8)): c.P(x, y, K('hull', -2))
    c.P(5, 4, K('glass', 3)); c.P(4, 5, K('glass', 2)); c.outline()


@piece2('porthole-star', '벽 현창(둥근 금속 테 + 별이 보이는 우주)', 1, 1, 'wall_mounted', solid=[], tags=['현창', '벽'], desc='우주가 보이는 현창.', **I)
def _(c):
    def inner(c):
        for (x, y, t) in ((6, 7, 3), (10, 6, 2), (9, 11, 3), (5, 10, 1), (11, 9, 1)): c.P(x, y, K('star', t))
    porthole(c, inner)


@piece2('porthole-planet', '벽 현창(둥근 금속 테 + 푸른 행성 가장자리)', 1, 1, 'wall_mounted', solid=[], tags=['현창', '벽'], desc='행성이 보이는 현창.', **I)
def _(c):
    def inner(c):
        c.ell(11, 12, 6, 6, K('cyan', 0), only=lambda x, y: ((x - 8) / 5.5) ** 2 + ((y - 8) / 5.5) ** 2 <= 1)
        c.ell(10, 11, 5, 5, K('cyan', 1), only=lambda x, y: ((x - 8) / 5.5) ** 2 + ((y - 8) / 5.5) ** 2 <= 1 and x + y < 19)
        c.P(6, 6, K('star', 3)); c.P(9, 9, K('green', 1)); c.P(11, 10, K('green', 0))
    porthole(c, inner)


@piece2('wall-lamp', '벽 램프(금속 받침 판 + 길쭉한 발광 등)', 1, 1, 'wall_mounted', solid=[], tags=['조명', '벽'], desc='벽 조명.', **I)
def _(c):
    raised(c, 3, 3, 10, 10, 'hull', 0); c.R(5, 5, 6, 6, K('cyan', 1)); c.R(6, 5, 4, 6, K('cyan', 3)); c.VL(7, 6, 4, K('glow', 1))
    bolt(c, 4, 4); c.outline()


@piece2('vent-grill', '벽 환기 격자(네모 틀 + 가로 살)', 1, 1, 'wall_mounted', solid=[], tags=['환기', '벽'], desc='벽 환기구.', **I)
def _(c):
    raised(c, 2, 2, 12, 12, 'hull', 0); grille(c, 4, 4, 8, 8, 'hull', 0)
    for (x, y) in ((3, 3), (12, 3), (3, 12), (12, 12)): c.P(x, y, K('hull', 3))
    c.outline()


@piece2('wall-pipes', '벽 배관 두 줄(구리 파이프 + 이음 고리 + 밸브)', 2, 1, 'wall_mounted', solid=[], tags=['배관', '벽'], desc='벽 배관.', **I)
def _(c):
    for y in (3, 9):
        c.R(0, y, 32, 4, K('rust', 0)); c.HL(0, y, 32, K('rust', 2)); c.HL(0, y + 1, 32, K('rust', 1)); c.HL(0, y + 3, 32, K('rust', -2))
        for x in (6, 20): c.R(x, y - 1, 2, 6, K('hull', 1)); c.VL(x, y - 1, 6, K('hull', 3))
    c.ell(26, 5, 2, 2, K('white', 2)); c.P(26, 5, K('orange', 3)); c.outline()


@piece2('fire-extinguisher', '벽 소화기 상자(흰 케이스 + 주황 통 + 노즐)', 1, 1, 'wall_mounted', solid=[], tags=['소화기', '벽'], desc='벽 소화기.', **I)
def _(c):
    raised(c, 3, 1, 10, 14, 'white', 1); c.R(5, 3, 6, 11, K('cable', 0))
    c.R(6, 5, 4, 8, K('orange', 1)); c.VL(6, 5, 8, K('orange', 3)); c.VL(9, 5, 8, K('orange', -1)); c.R(7, 3, 2, 2, K('hull', 1)); c.P(10, 4, K('cable', 2))
    c.HL(6, 9, 4, K('white', 2)); c.outline()
