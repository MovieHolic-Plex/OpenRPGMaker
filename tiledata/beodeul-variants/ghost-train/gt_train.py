# 유령 열차 — 열차 외관 조각(객차 셋·탄수차·기관차·연결부·연기). 3/4: 가로로 놓인 열차의 지붕 윗면 + 남쪽 앞면(창·문), 옆면(끝면) 없음.
# 톤 캔버스(fr_mat.TC)로 칠한다: 재질 번호 + 톤 0..6 → 램프. 판 줄눈·리벳·관은 미래 폐허 「기계 재질 규약」,
# 목재 외판은 버들항 나무 결(칩셋 널 288,80)을 니스칠 램프 VARN 으로. 빛 왼쪽 위.
# 크기(칸): 객차 10×5, 탄수차 5×5, 기관차 11×6, 연결부 1×5. 맨 아래 줄 = 대차·바퀴(철로 칸 위), 위 둘 줄 = 지붕(걷기+가림).
import math
from gt_base import *
from gt_base import _hash, vnoise

def tc_img(tc, k=.6): return pz.fin(tc.img(), k)

def wood_v(tc, x0, y0, x1, y1, mat='varn', base=4, bw=4, seed=0):
    """세로 널 판(앞면): bw px 널마다 홈(톤 2), 칩셋 널 결 ±1, 널마다 바램 흔들림. 왼쪽 2px 밝고 오른쪽 2px 어둡다."""
    for y in range(int(y0), int(y1)):
        for x in range(int(x0), int(x1)):
            b = (x - x0) // bw; lx = (x - x0) % bw
            k = base + (1 if _hash(b, seed, 901) < .2 else 0) - (1 if _hash(b, seed, 902) > .82 else 0)
            g = AK.grain((x * 2 + seed * 5) % 48, (y + b * 11) % 48) - 3
            if g >= 2: k += 1
            elif g <= -2: k -= 1
            if lx == bw - 1: k = 2
            elif lx == 0: k += 1
            if x < x0 + 2: k += 1
            if x >= x1 - 2: k -= 1
            tc.px(x, y, mat, clamp(k, 1, 6))

def hband(tc, x0, x1, y, mat, k):
    for x in range(int(x0), int(x1)): tc.px(x, y, mat, k)

def wheel(tc, cx, cy, r, mat='soot', spokes=8, seed=0, rim_mat='steel', hub_mat='brass', red=False):
    """옆에서 본 바퀴: 테(강철, 왼쪽 위 빛) + 바퀴살 + 굴대 머리(놋쇠). red = 바퀴 속을 붉게 칠한 기관차 동륜."""
    for y in range(int(cy - r - 1), int(cy + r + 2)):
        for x in range(int(cx - r - 1), int(cx + r + 2)):
            dx = x + .5 - cx; dy = y + .5 - cy; d = math.hypot(dx, dy)
            if d > r: continue
            lit = (-dx - dy) / max(1e-6, d * 1.414) if d > 0 else 0
            if d > r - 2.0:                                                   # 바퀴 테
                k = 5 if lit > .35 else (4 if lit > -.2 else 2)
                if d > r - .9: k = max(1, k - 1)
                tc.px(x, y, rim_mat, k); continue
            if d < max(1.6, r * .22):                                          # 굴대 머리
                tc.px(x, y, hub_mat, 5 if lit > 0 else 3); continue
            ang = math.atan2(dy, dx)
            sp = abs(((ang / (2 * math.pi / spokes)) % 1) - .5) < .5 * (1.3 / max(1.0, d * 2 * math.pi / spokes))
            if sp or d < r * .36:
                tc.px(x, y, 'redl' if red else mat, (4 if lit > 0 else 3) if red else (3 if lit > 0 else 2))
            else:
                tc.px(x, y, mat, 1)                                           # 바퀴살 사이 어둠

def bogie(tc, x0, y0, seed=0):
    """객차 대차(36px): 강철 옆틀 + 놋쇠 축상 둘 + 판 스프링 + 작은 바퀴 둘(r=6)."""
    for (wx) in (x0 + 9, x0 + 27):
        wheel(tc, wx, y0 + 9, 6, mat='soot', spokes=6, seed=seed)
    # 옆틀(바퀴 위로 지나는 강철 띠)
    for y in range(y0 + 1, y0 + 6):
        for x in range(x0 + 2, x0 + 34):
            k = 4 if y == y0 + 1 else (3 if y < y0 + 4 else 2)
            if x in (x0 + 2, x0 + 33): k -= 1
            tc.px(x, y, 'steel', k)
    for ax in (x0 + 9, x0 + 27):                                              # 축상(놋쇠)
        tc.rect(ax - 2, y0 + 5, ax + 3, y0 + 9, 'brass', 4)
        tc.hline(ax - 2, ax + 3, y0 + 5, 'brass', 5); tc.px(ax + 2, y0 + 8, 'brass', 2)
    for i, x in enumerate(range(x0 + 13, x0 + 24)):                           # 판 스프링(가운데 아래로 휜 띠)
        yy = y0 + 6 + (1 if 15 <= x - x0 <= 21 else 0)
        tc.px(x, yy, 'steel', 4); tc.px(x, yy + 1, 'steel', 2)

def under(tc, x0, x1, y0, y1):
    """차체 밑 그늘 + 버팀대(트러스 막대)·제동 실린더."""
    for y in range(y0, y1):
        for x in range(x0, x1): tc.px(x, y, 'soot', 1 if y > y0 + 1 else 2)
    mid = (x0 + x1) // 2
    for x in range(x0, x1):                                                   # 트러스 막대(가운데로 처짐)
        f = (x - x0) / max(1, x1 - x0); yy = y0 + 1 + int(round(4 * 4 * f * (1 - f)))
        tc.px(x, yy, 'steel', 3)
    tc.rect(mid - 7, y0 + 1, mid + 7, y0 + 6, 'soot', 3); tc.hline(mid - 7, mid + 7, y0 + 1, 'soot', 4)   # 축전지 상자
    tc.rect(mid + 10, y0 + 1, mid + 18, y0 + 5, 'steel', 3)                                                # 제동 실린더

# ---------------------------------------------------------------- 객차
CW, CH = 160, 80
WIN_X = (24, 40, 56, 72, 88, 104, 120)

def _roof(tc, x0, x1, y0, seed, hole=None, moss=0.0):
    """지붕 윗면: 북쪽 처마 → 빛 받은 북쪽 비탈 → 용마루 빛줄 → 남쪽으로 둥글게 내려가는 면. 16px 마다 가로 이음, 통풍구 둥근 머리."""
    rows = [(0, 2), (1, 3), (2, 5), (3, 5), (4, 5), (5, 5), (6, 5), (7, 5), (8, 6), (9, 4), (10, 4), (11, 4), (12, 4),
            (13, 4), (14, 4), (15, 4), (16, 3), (17, 3), (18, 3), (19, 3), (20, 3), (21, 2), (22, 2), (23, 2)]
    for (dy, k) in rows:
        y = y0 + dy
        # 지붕 끝은 둥글게 깎는다(위에서 본 끝 모)
        inset = 0
        if dy < 2: inset = 2 - dy
        if dy > 20: inset = dy - 20
        for x in range(x0 + inset, x1 - inset):
            kk = k
            if (x - x0) % 16 == 15 and 2 < dy < 21: kk -= 1                      # 지붕 널 이음
            if x < x0 + inset + 2: kk += 1
            if x >= x1 - inset - 2: kk -= 1
            if _hash(x, y, seed + 3) < .07: kk += 1 if _hash(y, x, seed + 4) < .5 else -1
            tc.px(x, y, 'slate', clamp(kk, 1, 6))
    # 이끼·지의(유령 열차: 오래 멈춰 선)
    if moss:
        for y in range(y0 + 3, y0 + 20):
            for x in range(x0 + 4, x1 - 4):
                if vnoise(x, y, 5, seed + 20) > 1 - moss * .32 and _hash(x, y, seed + 21) < .8:
                    tc.px(x, y, 'leaf', 2 if vnoise(x, y, 2, seed + 22) < .5 else 3)
    # 통풍구(지붕 위 둥근 머리, 32px 마다)
    for vx in range(x0 + 20, x1 - 10, 32):
        for y in range(y0 + 5, y0 + 12):
            for x in range(vx - 3, vx + 4):
                dx = (x + .5 - vx) / 3.5; dy = (y + .5 - (y0 + 8.5)) / 3.5
                if dx * dx + dy * dy <= 1: tc.px(x, y, 'soot', 5 if (dx < -.1 and dy < -.1) else (3 if dx < .4 else 2))
        tc.hline(vx - 2, vx + 4, y0 + 12, 'slate', 1)                          # 그늘
    if hole:
        hx0, hx1 = hole
        for y in range(y0 + 4, y0 + 20):
            for x in range(hx0, hx1):
                e = min(x - hx0, hx1 - 1 - x, y - y0 - 4, y0 + 19 - y)
                if e > 1.2 + 2.0 * _hash(x // 2, y // 2, seed + 30):
                    tc.px(x, y, 'dark', 1 if y < y0 + 12 else 2)
                elif e > .6 + 1.5 * _hash(x // 2, y // 2, seed + 30):
                    tc.px(x, y, 'varn', 2)                                     # 부러진 널 단면
        for i in range(3):                                                     # 들린 널 조각
            bx = hx0 + 2 + i * 5
            tc.line(bx, y0 + 6 + i, bx + 4, y0 + 3 + i, 'varn', 5)
    # 처마 홈통(남쪽 끝): 놋쇠 한 줄 + 그늘
    hband(tc, x0 + 3, x1 - 3, y0 + 24, 'brass', 3)
    hband(tc, x0 + 3, x1 - 3, y0 + 25, 'varn', 1)

def _window(tc, x0, y0, w=10, h=15, kind='dark', seed=0):
    """창: 놋쇠 틀(위·왼 밝고 아래·오른쪽 어둡다) + 유리. kind: dark(빈 칸) / spirit(얼굴 없는 인영) / curtain / broken / lit(희미한 푸른 빛)."""
    for y in range(y0, y0 + h):
        for x in range(x0, x0 + w):
            edge = x == x0 or x == x0 + w - 1 or y == y0 or y == y0 + h - 1
            if edge:
                k = 4 if (x == x0 or y == y0) else 2
                tc.px(x, y, 'brass', k); continue
            v = (y - y0) / h
            k = 3 if v < .25 else (2 if v < .6 else 1)
            mat = 'glass'
            if kind == 'lit': mat = 'ghost'; k = 3 if v < .3 else (2 if v < .7 else 2)
            if (x - x0) + (y - y0) in (5, 6) and v < .7 and kind != 'broken': k = 4      # 45도 빛줄
            tc.px(x, y, mat, k)
    if kind in ('spirit', 'lit'):                                              # 얼굴 없는 인영: 둥근 머리 + 어깨, 청회 두 단
        cx = x0 + w // 2 + (1 if _hash(x0, y0, seed) < .5 else -1)
        hy = y0 + 5
        for y in range(y0 + 2, y0 + h - 1):
            for x in range(x0 + 1, x0 + w - 1):
                head = ((x + .5 - cx) / 2.6) ** 2 + ((y + .5 - hy) / 3.0) ** 2 <= 1
                sh = y >= hy + 4 and abs(x + .5 - cx) <= 1.5 + (y - hy - 4) * 1.2
                if head or sh:
                    k = 4 if (x < cx and y < hy + 1) else 3
                    tc.px(x, y, 'spirit', k)
    if kind == 'curtain':
        for y in range(y0 + 1, y0 + h - 1):
            for x in range(x0 + 1, x0 + w - 1):
                if x - x0 < 4 + (1 if (y - y0) > h * .6 else 0):
                    tc.px(x, y, 'redl' if False else 'paint', 3 if (x - x0) % 2 else 2)
    if kind == 'broken':
        for y in range(y0 + 1, y0 + h - 1):
            for x in range(x0 + 1, x0 + w - 1):
                e = min(x - x0, x0 + w - 1 - x, y - y0, y0 + h - 1 - y)
                if e > 1 + 2.5 * _hash((x - x0) // 2, (y - y0) // 2, seed + 7):
                    tc.px(x, y, 'dark', 1)
                elif _hash(x, y, seed + 8) < .3: tc.px(x, y, 'glass', 4)

def carriage(kind='a', seed=0):
    """객차 10×5칸. kind: a = 인영이 비치는 객차, b = 무너진 객차(깨진 창·지붕 구멍·이끼), c = 끝 객차(서쪽 끝 난간 발코니·꼬리등)."""
    tc = TC(CW, CH, seed)
    x0, x1 = 0, CW
    if kind == 'c': x0 = 12                                                    # 서쪽 끝 발코니 자리
    _roof(tc, x0, x1, 2, seed, hole=(70, 92) if kind == 'b' else None, moss=(1.0 if kind == 'b' else .35))
    # 앞면 벽(y 28..62)
    wy0, wy1 = 28, 62
    wood_v(tc, x0, wy0, x1, wy1, 'varn', 4, 4, seed)
    hband(tc, x0, x1, wy0, 'varn', 5); hband(tc, x0, x1, wy0 + 1, 'varn', 3); hband(tc, x0, x1, wy0 + 2, 'varn', 2)
    # 창 띠 위·아래 몰딩
    for y, k in ((wy0 + 3, 4), (wy0 + 4, 2), (48, 5), (49, 3), (50, 2)):
        hband(tc, x0 + 1, x1 - 1, y, 'varn', k)
    # 아래 판: 바랜 초록 도장 띠 + 금빛 가는 선(판마다 사각 테)
    for y in range(51, 61):
        for x in range(x0 + 1, x1 - 1):
            k = 3 if (x - x0) % 4 else 2
            if x < x0 + 3: k += 1
            if x >= x1 - 3: k -= 1
            if _hash(x // 4, y // 3, seed + 41) < .1: k -= 1                      # 벗겨진 칠
            tc.px(x, y, 'green', clamp(k, 1, 6))
    for bx in range(x0 + 22, x1 - 22, 16):
        for x in range(bx, bx + 13):
            tc.px(x, 52, 'brass', 3); tc.px(x, 59, 'brass', 2)
        for y in range(52, 60):
            tc.px(bx, y, 'brass', 3); tc.px(bx + 12, y, 'brass', 2)
    hband(tc, x0, x1, 61, 'varn', 2)
    # 창
    kinds = {'a': ['spirit', 'dark', 'lit', 'spirit', 'curtain', 'dark', 'spirit'],
             'b': ['broken', 'dark', 'broken', 'curtain', 'dark', 'broken', 'spirit'],
             'c': ['dark', 'spirit', 'curtain', 'lit', 'dark', 'spirit', 'dark']}[kind]
    for wx, k in zip(WIN_X, kinds):
        if wx < x0 + 4: continue
        _window(tc, wx, 32, 10, 15, k, seed + wx)
    # 문 둘(양 끝): 들어간 문짝 + 작은 창 + 놋쇠 손잡이 + 발판
    for dx in ((x0 + 6) if kind != 'c' else (x0 + 4), x1 - 18):
        for y in range(31, 61):
            for x in range(dx, dx + 12):
                edge = x in (dx, dx + 11) or y in (31, 60)
                k = 2 if edge else 4
                if x == dx + 1 and not edge: k = 5
                if x == dx + 10 and not edge: k = 3
                if y in (45, 46) and not edge: k = 3 if y == 45 else 5
                tc.px(x, y, 'varn', k)
        _window(tc, dx + 2, 33, 8, 10, 'dark' if kind != 'a' else 'spirit', seed + dx)
        tc.rect(dx + 9, 48, dx + 11, 51, 'brass', 5); tc.px(dx + 10, 50, 'brass', 2)
    # 끝 기둥 + 세로 손잡이(놋쇠)
    for ex in (x0, x1 - 2):
        for y in range(28, 62):
            tc.px(ex, y, 'varn', 2 if ex > x0 else 5); tc.px(ex + 1, y, 'varn', 3)
    # 객차 b: 기운 문짝·덩굴
    if kind == 'b':
        for y in range(36, 62):
            for x in range(x0 + 2, x0 + 5):
                if vnoise(x, y, 3, seed + 50) > .45: tc.px(x, y, 'leaf', 2 + (1 if _hash(x, y, 51) < .4 else 0))
        for x in range(x1 - 40, x1 - 22):
            for y in range(52, 61 + (1 if x % 3 == 0 else 0)):
                if vnoise(x, y, 3, seed + 52) > .5: tc.px(x, y, 'leaf', 2 + (1 if _hash(x, y, 53) < .4 else 0))
    # 차대(밑 기둥) + 발판(걸음판)
    for x in range(0, CW):
        if kind == 'c' and x < 8: continue
        tc.px(x, 62, 'steel', 4); tc.px(x, 63, 'steel', 3); tc.px(x, 64, 'steel', 2)
        if x % 8 == 3: tc.px(x, 63, 'steel', 6)
        tc.px(x, 65, 'varn', 4); tc.px(x, 66, 'varn', 2)
    under(tc, 52 if kind != 'c' else 56, 108, 67, 72)
    bogie(tc, 14 if kind != 'c' else 22, 66, seed)
    bogie(tc, 110, 66, seed + 1)
    # 끝 객차: 서쪽 발코니(난간 + 기둥 + 붉은 꼬리등)
    if kind == 'c':
        for y in range(40, 62):
            for x in (1, 6, 11):
                tc.px(x, y, 'brass', 4 if x == 1 else 3)
        for x in range(0, 12):
            tc.px(x, 40, 'brass', 5); tc.px(x, 41, 'brass', 2); tc.px(x, 50, 'brass', 3)
        for x in range(0, 13):
            tc.px(x, 62, 'steel', 4); tc.px(x, 63, 'steel', 2)
        tc.rect(2, 26, 9, 30, 'slate', 4); tc.hline(2, 9, 26, 'slate', 5)    # 발코니 지붕 끝
        tc.rect(3, 54, 7, 59, 'redl', 4); tc.px(4, 55, 'redl', 6); tc.px(6, 58, 'redl', 2)   # 꼬리등
        tc.rect(2, 53, 8, 54, 'steel', 3)
    tc.grain(.04, seed + 90, mats=('varn', 'green'))
    return tc_img(tc)

def gangway(seed=0):
    """객차 연결부 1×5칸: 지붕 덮개 + 주름 가죽 통로(세로 주름) + 완충기 둘이 맞닿고 사슬 연결기·제동 호스."""
    tc = TC(16, CH, seed)
    for y in range(8, 26):
        for x in range(0, 16):
            k = 4 if y < 12 else (3 if y < 20 else 2)
            tc.px(x, y, 'slate', k)
    hband(tc, 0, 16, 8, 'slate', 5)
    for y in range(26, 61):                                                    # 주름 통로
        for x in range(1, 15):
            f = x % 3
            k = 3 if f == 0 else (2 if f == 1 else 1)
            if y in (26, 60): k = 1
            tc.px(x, y, 'soot', k)
    for x in (0, 15):
        for y in range(26, 62): tc.px(x, y, 'varn', 2)
    # 완충기(양쪽에서 나온 둥근 머리가 맞닿음)
    for bx, k in ((5, 5), (10, 3)):
        for y in range(63, 69):
            for x in range(bx - 3, bx + 3):
                if abs(y + .5 - 66) <= 2.8: tc.px(x, y, 'steel', k if x < bx else k - 1)
    tc.px(4, 64, 'steel', 6)
    for i, x in enumerate(range(3, 13)):                                       # 늘어진 사슬
        yy = 70 + (1 if 5 <= x <= 10 else 0) + (1 if 7 <= x <= 8 else 0)
        tc.px(x, yy, 'steel', 4 if i % 2 else 2)
    for y in range(66, 76):                                                    # 제동 호스
        tc.px(12 + (1 if y > 70 else 0), y, 'cable', 3)
    return tc_img(tc)

# ---------------------------------------------------------------- 탄수차
def tender(seed=0):
    """탄수차 5×5칸: 윗면에 쌓인 석탄(덩이마다 빛) + 물 탱크 뚜껑, 앞면은 바랜 초록 도장 + 놋쇠 테, 작은 바퀴 셋."""
    W, H = 80, 80
    tc = TC(W, H, seed)
    # 윗면 테(탱크 위 가장자리)
    for y in range(4, 30):
        for x in range(2, W - 2):
            tc.px(x, y, 'green', 4 if y < 6 else 3)
    for y in range(6, 28):                                                     # 석탄 더미(동쪽 = 기관차 쪽이 높다)
        for x in range(4, W - 4):
            hgt = 1 - abs((y - 16) / 11.0)
            top = .5 + .4 * (x / W)
            if hgt < .1: continue
            cell = _hash(x // 3 + (y // 3) * 7, y // 3, seed + 11)
            k = 2 if cell < .5 else 3
            if (x % 3 == 0 and y % 3 == 0): k = 5 if cell > .55 else 4
            if y > 22: k -= 1
            tc.px(x, y, 'coal', clamp(k, 1, 6))
    # 물 넣는 구멍 뚜껑(서쪽 뒤)
    for y in range(8, 15):
        for x in range(8, 20):
            dx = (x + .5 - 14) / 6; dy = (y + .5 - 11.5) / 3.5
            if dx * dx + dy * dy <= 1: tc.px(x, y, 'steel', 5 if (dx < 0 and dy < 0) else 3)
    hband(tc, 2, W - 2, 4, 'brass', 5); hband(tc, 2, W - 2, 28, 'brass', 3); hband(tc, 2, W - 2, 29, 'green', 1)
    # 앞면
    for y in range(30, 62):
        for x in range(1, W - 1):
            k = 4 if x > 3 else 5
            if x >= W - 4: k = 3
            if y == 30: k = 5
            if y >= 59: k = 2
            tc.px(x, y, 'green', k)
    for (bx0, bx1) in ((6, 36), (42, 74)):                                     # 놋쇠 테 두 판
        for x in range(bx0, bx1):
            tc.px(x, 35, 'brass', 4); tc.px(x, 55, 'brass', 2)
        for y in range(35, 56):
            tc.px(bx0, y, 'brass', 4); tc.px(bx1 - 1, y, 'brass', 2)
    for x in range(0, W):                                                      # 차대
        tc.px(x, 62, 'steel', 4); tc.px(x, 63, 'steel', 3); tc.px(x, 64, 'steel', 2)
        if x % 8 == 3: tc.px(x, 63, 'steel', 6)
    under(tc, 4, W - 4, 65, 70)
    for wx in (16, 40, 64): wheel(tc, wx, 72, 7, mat='soot', spokes=8, seed=seed)
    for wx in (16, 40, 64):                                                    # 축상
        tc.rect(wx - 2, 65, wx + 3, 69, 'brass', 4); tc.hline(wx - 2, wx + 3, 65, 'brass', 5)
    tc.grain(.05, seed + 3, mats=('green',))
    return tc_img(tc)

# ---------------------------------------------------------------- 기관차
LW, LH = 176, 96

def boiler_k(y, top, dia):
    """누운 원통(보일러) 단면 위→아래 명암: 윗면 쪽 빛줄."""
    t = (y + .5 - top) / dia
    return FB.cyl_k(t)

def locomotive(seed=0):
    """증기 기관차 11×6칸, 동쪽(오른쪽)이 앞. 서쪽 운전실(창 속 푸른 화실 빛) · 검은 보일러(놋쇠 띠·증기 돔·모래 돔·안전판) ·
    연기 상자 + 굴뚝(입에서 푸른 유령불) · 앞 헤드램프(동쪽으로 빛나는 렌즈) · 붉은 완충 들보 · 붉은 동륜 셋과 연결 막대."""
    tc = TC(LW, LH, seed)
    # --- 보일러(x 38..150, 지름 26, 위 y 38)
    btop, bdia = 38, 26
    for y in range(btop, btop + bdia):
        for x in range(38, 150):
            k = boiler_k(y, btop, bdia)
            tc.px(x, y, 'soot', k)
    for bx in range(52, 146, 24):                                              # 보일러 띠(놋쇠 2px)
        for y in range(btop, btop + bdia):
            k = boiler_k(y, btop, bdia)
            tc.px(bx, y, 'brass', clamp(k + 1, 1, 6)); tc.px(bx + 1, y, 'brass', clamp(k - 1, 1, 6))
    for x in range(40, 150):                                                   # 손잡이 난간
        tc.px(x, btop + 9, 'brass', 4)
    # --- 연기 상자(x 146..168, 조금 굵다)
    for y in range(btop - 2, btop + bdia + 1):
        for x in range(146, 168):
            k = boiler_k(y, btop - 2, bdia + 3) - 1
            if x >= 165: k -= 1
            if x == 146: k += 1
            tc.px(x, y, 'soot', clamp(k, 1, 6))
    for y in range(btop + 1, btop + bdia - 2):                                 # 연기 상자 앞문 테(동쪽 끝)
        tc.px(167, y, 'steel', 4); tc.px(168, y, 'steel', 2)
    # --- 굴뚝(x 152..163, y 18..38): 세로 원통 + 넓어진 입술
    for y in range(20, btop + 2):
        for x in range(153, 163):
            tc.px(x, y, 'soot', FB.cyl_k((x - 153 + .5) / 10))
    for y in range(16, 21):
        for x in range(151, 165):
            k = FB.cyl_k((x - 151 + .5) / 14)
            if y == 16: k = 5
            tc.px(x, y, 'soot', clamp(k, 1, 6))
    for x in range(152, 164):                                                  # 굴뚝 입(위에서 보인 타원 속 = 푸른 불)
        for y in range(15, 18):
            dx = (x + .5 - 158) / 5.5; dy = (y + .5 - 16.5) / 1.6
            if dx * dx + dy * dy <= 1: tc.px(x, y, 'ghost', 5 if abs(dx) < .5 else 3)
    # 굴뚝 입에서 너울거리는 푸른 불꽃
    for (fx, fh, ph) in ((155, 9, 0), (158, 13, 1), (161, 8, 2)):
        for i in range(fh):
            y = 15 - i
            w = max(0, int(round((fh - i) / fh * 2.2 + .3)))
            sx = fx + int(round(math.sin(i * .7 + ph) * 1.2))
            for x in range(sx - w, sx + w + 1):
                k = 6 if (i < fh * .35 and abs(x - sx) <= max(0, w - 1)) else (5 if i < fh * .7 else 4)
                if abs(x - sx) == w and w > 0: k -= 1
                tc.px(x, y, 'ghost', clamp(k, 1, 6))
    # --- 돔 셋(보일러 윗면 위로 솟은 둥근 머리)
    def dome(cx, rx, h, mat):
        for y in range(btop - h, btop + 4):
            for x in range(cx - rx, cx + rx + 1):
                dx = (x + .5 - cx) / (rx + .5)
                top = btop - h * math.sqrt(max(0, 1 - dx * dx))
                if y + .5 < top: continue
                k = FB.cyl_k((x - (cx - rx) + .5) / (2 * rx + 1))
                if y < top + 1.5: k = min(6, k + 1)
                tc.px(x, y, mat, k)
    dome(100, 7, 9, 'brass')                                                   # 증기 돔(놋쇠)
    dome(76, 5, 6, 'soot')                                                     # 모래 돔
    for x in range(44, 50):                                                    # 안전판 둘 + 기적
        for y in range(btop - 7, btop + 1):
            tc.px(x, y, 'brass', FB.cyl_k((x - 44 + .5) / 6))
    tc.hline(43, 51, btop - 7, 'brass', 6)
    for y in range(btop - 11, btop - 6): tc.px(54, y, 'brass', 5); tc.px(55, y, 'brass', 3)
    tc.hline(53, 57, btop - 11, 'brass', 6)
    # --- 헤드램프(연기 상자 앞 위): 쇠 상자 + 동쪽 렌즈(푸른 흰빛)
    tc.rect(160, 26, 172, 36, 'steel', 3); tc.hline(160, 172, 26, 'steel', 5); tc.vline(160, 26, 36, 'steel', 4)
    tc.rect(161, 24, 171, 26, 'steel', 4); tc.hline(162, 170, 23, 'steel', 5)               # 갓
    for y in range(27, 35):
        for x in range(169, 175):
            dx = (x + .5 - 171) / 3.6; dy = (y + .5 - 31) / 4.2
            if dx * dx + dy * dy <= 1: tc.px(x, y, 'ghost', 6 if dx * dx + dy * dy < .35 else 5)
    tc.px(174, 31, 'ghost', 6)
    tc.rect(163, 36, 169, 38, 'steel', 2)
    # --- 운전실(x 2..40): 지붕 윗면 + 바랜 초록 앞벽 + 창(속에 화실의 푸른 빛과 기관사 인영)
    for y in range(24, 33):
        for x in range(0, 42):
            k = 5 if y < 27 else (4 if y < 31 else 2)
            if x < 2: k += 1
            if x > 39: k -= 1
            tc.px(x, y, 'slate', clamp(k, 1, 6))
    hband(tc, 0, 42, 24, 'slate', 6); hband(tc, 1, 41, 33, 'slate', 1)
    for y in range(34, 66):
        for x in range(2, 40):
            k = 4 if x > 4 else 5
            if x >= 37: k = 3
            if y >= 63: k = 2
            tc.px(x, y, 'green', k)
    for x in range(4, 38): tc.px(x, 37, 'brass', 4); tc.px(x, 61, 'brass', 2)
    for y in range(37, 62): tc.px(4, y, 'brass', 4); tc.px(37, y, 'brass', 2)
    for y in range(40, 56):                                                    # 큰 창(문 없는 열린 창)
        for x in range(8, 32):
            edge = x in (8, 31) or y in (40, 55)
            if edge: tc.px(x, y, 'brass', 4 if (x == 8 or y == 40) else 2); continue
            v = (y - 40) / 15
            tc.px(x, y, 'ghost' if v > .45 else 'dark', (2 if v < .7 else 3) if v > .45 else 1)
    for y in range(43, 55):                                                    # 기관사 인영(얼굴 없음)
        for x in range(13, 25):
            head = ((x + .5 - 19) / 3.0) ** 2 + ((y + .5 - 46) / 3.2) ** 2 <= 1
            sh = y >= 50 and abs(x + .5 - 19) <= 2 + (y - 50) * 1.4
            if head or sh: tc.px(x, y, 'spirit', 3 if (x < 19 and y < 47) else 2)
    for x in range(14, 25): tc.px(x, 42, 'spirit', 2)                          # 모자 챙
    for y in range(36, 64): tc.px(39, y, 'green', 2)                           # 운전실 앞 모서리 그늘
    # --- 걸음판(발판)·붉은 들보(valance)
    for x in range(30, 172):
        tc.px(x, 64, 'steel', 5); tc.px(x, 65, 'steel', 3)
        for y in (66, 67, 68):
            tc.px(x, y, 'redl', 3 if y == 66 else 2)
        if x % 10 == 4: tc.px(x, 67, 'redl', 5)
    # --- 실린더(앞, x 136..158)
    for y in range(66, 82):
        for x in range(136, 158):
            k = 4 if y < 69 else (3 if y < 78 else 2)
            if x < 138: k += 1
            if x >= 155: k -= 1
            tc.px(x, y, 'soot', k)
    tc.rect(139, 70, 155, 78, 'brass', 3); tc.hline(139, 155, 70, 'brass', 5); tc.vline(139, 70, 78, 'brass', 4)
    # --- 완충 들보 + 완충기(동쪽 끝)
    for y in range(62, 74):
        for x in range(166, 172):
            tc.px(x, y, 'redl', 4 if y < 64 else (3 if y < 72 else 2))
    for by in (64, 70):
        tc.rect(172, by, 176, by + 3, 'steel', 4); tc.px(175, by, 'steel', 6); tc.px(175, by + 2, 'steel', 2)
    # 앞 바퀴(작은 선륜) + 동륜 셋(붉은 속) + 뒤 바퀴
    wheel(tc, 154, 85, 5, mat='soot', spokes=6, seed=seed)
    for wx in (62, 88, 114): wheel(tc, wx, 79, 11, mat='soot', spokes=10, seed=seed, red=True)
    wheel(tc, 22, 84, 6, mat='soot', spokes=6, seed=seed)
    # 연결 막대(동륜 셋을 잇는다) + 주연봉(실린더 → 가운데 바퀴)
    for x in range(62, 115):
        tc.px(x, 83, 'steel', 5); tc.px(x, 84, 'steel', 3)
    for x in range(88, 140):
        f = (x - 88) / 52.0; yy = int(round(80 + (74 - 80) * f))
        tc.px(x, yy, 'steel', 5); tc.px(x, yy + 1, 'steel', 2)
    for wx in (62, 88, 114): tc.rect(wx - 1, 82, wx + 2, 86, 'brass', 5)
    # 운전실 밑 발판 계단
    tc.rect(6, 66, 14, 68, 'steel', 4); tc.rect(7, 72, 13, 74, 'steel', 3)
    for y in range(66, 75): tc.px(6, y, 'steel', 3); tc.px(13, y, 'steel', 2)
    tc.grain(.04, seed + 7, mats=('soot', 'green'))
    return tc_img(tc)

def ghost_smoke(seed=0):
    """굴뚝에서 서쪽(뒤)으로 흘러가는 연기 4×3칸: 둥근 덩이 넷이 뒤로 갈수록 커지고 옅어진다. 아래는 푸른 빛, 윗가 밝다(반투명)."""
    W, H = 64, 48
    im = new(W, H); p = im.load()
    BAY = np.array([[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]]) / 16.0
    puffs = [(54, 38, 5.5, .95), (44, 30, 7.5, .85), (30, 22, 9.5, .7), (14, 14, 10.5, .5)]
    for y in range(H):
        for x in range(W):
            best = None
            for (cx, cy, r, d) in puffs:
                rr = r * (1 + .12 * math.sin(math.atan2(y - cy, x - cx) * 5 + cx))
                q = math.hypot(x + .5 - cx, y + .5 - cy) / rr
                if q < 1 and (best is None or q < best[0]): best = (q, cy, r, d)
            if not best: continue
            q, cy, r, d = best
            if BAY[y % 4, x % 4] > d * (1.15 - q * .6): continue
            up = (y + .5 - cy) / r
            k = 6 if up < -.55 else (5 if up < 0 else (4 if up < .5 else 3))
            col = FOG[k] if d < .9 else mix(FOG[k], GHOST[4], .25)
            p[x, y] = tuple(col) + (int(150 * d + 40),)
    return im
