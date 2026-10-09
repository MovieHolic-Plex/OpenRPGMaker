# 산중 무림 문파 — 소품·수련 기물·식생. 톤 캔버스 + pz.fin 윤곽, 3/4 시점, 빛 왼쪽 위. 잎 = ek_props.foliage(버들항 덤불 잎 결)를 재질만 바꿔 쓴다.
import math
import numpy as np
from PIL import Image
from ws_base import *
from ws_base import _hash
import ek_props as EP

foliage = EP.foliage


def _sh(im, cx, cy, rx, ry=2, a=55): return shadow_under(im, cx, cy, rx, ry, a)


def cyl(tc, x0, x1, y0, y1, mat, lo=2, hi=6):
    """세로 원통(왼 빛 → 오른 그늘)."""
    w = x1 - x0
    for y in range(int(y0), int(y1)):
        for x in range(int(x0), int(x1)):
            u = (x - x0 + .5) / w
            tc.px(x, y, mat, clamp(round(hi - (hi - lo) * (u ** .8)), 1, 6))


# ================================================================ 수련 기물
def wooden_dummy(seed=0):
    """목인장 1x2칸: 두 기둥 가로대 틀(나무)에 끼운 굵은 몸통 기둥(검붉게 닳은 나무) + 팔 막대 셋(위 둘은 비스듬히, 아래 하나는 가운데) + 다리 막대 하나."""
    tc = TC(16, 32, seed)
    for (x0) in (1, 13):                                                             # 틀 기둥
        for y in range(8, 32): tc.px(x0, y, 'wood', 4); tc.px(x0 + 1, y, 'wood', 2)
    for y in (9, 23):
        for x in range(1, 15): tc.px(x, y, 'wood', 5); tc.px(x, y + 1, 'wood', 2)
    cyl(tc, 5, 11, 4, 30, 'wood', 2, 5)
    for y in range(4, 30):
        if y % 7 == 3: tc.px(6, y, 'wood', 6); tc.px(9, y, 'wood', 2)
    for (sx, sy, dx) in ((5, 11, -1), (10, 11, 1)):
        for j in range(5): tc.px(sx + dx * j, sy + j // 2, 'wood', 5 if dx < 0 else 3); tc.px(sx + dx * j, sy + 1 + j // 2, 'wood', 2)
    for y in range(16, 19):
        for x in range(7, 9): tc.px(x, y, 'wood', 5 if y == 16 else 3)
    for j in range(6): tc.px(9 + j // 2, 24 + j, 'wood', 4); tc.px(10 + j // 2, 24 + j, 'wood', 2)
    for x in range(4, 12): tc.px(x, 30, 'stone', 4); tc.px(x, 31, 'stone', 2)
    return _sh(tc.fin(.6), 8, 31, 7)


def plum_posts(seed=0):
    """매화장(梅花樁) 3x2칸: 낮은 돌 받침 위에 높이가 제각각인 나무 말뚝 다섯(위 둥근 마구리 빛 · 나이테 점) — 발 디딤 수련."""
    W, H = 48, 32
    tc = TC(W, H, seed)
    for y in range(24, 32):
        for x in range(1, W - 1): tc.px(x, y, 'stone', 6 if y == 24 else (4 if y < 30 else 2))
    posts = [(6, 9), (17, 3), (28, 11), (38, 5), (22, 15)]
    for i, (px_, top) in enumerate(sorted(posts, key=lambda p: p[1] + (p[0] % 3))):
        bot = 27 if i % 2 else 29
        cyl(tc, px_, px_ + 6, top + 2, bot, 'wood', 2, 5)
        for x in range(px_, px_ + 6):
            tc.px(x, top, 'wood', 6 if x < px_ + 3 else 5); tc.px(x, top + 1, 'wood', 5 if x < px_ + 4 else 4)
        tc.px(px_ + 2, top, 'wood', 3)
    return _sh(tc.fin(.6), 24, 31, 22)


def polearm_rack(seed=0):
    """병기가 2x3칸: 나무 틀(위 가로대에 구멍)에 꽂은 긴 병장기 다섯 — 언월도(넓은 날) · 창 둘(붉은 술) · 극(가지 날) · 곤봉. 날은 쇠 빛."""
    W, H = 32, 48
    tc = TC(W, H, seed)
    for (x0) in (2, 28):
        for y in range(12, 48): tc.px(x0, y, 'wood', 4); tc.px(x0 + 1, y, 'wood', 2)
    for (yy) in (14, 38):
        for x in range(2, 30): tc.px(x, yy, 'wood', 5); tc.px(x, yy + 1, 'wood', 2)
    for i, (x, kind) in enumerate(((6, 'glaive'), (11, 'spear'), (16, 'halberd'), (21, 'spear'), (25, 'staff'))):
        top = 2 + (i % 2) * 3
        for y in range(top + 8, 46): tc.px(x, y, 'wood', 5); tc.px(x + 1, y, 'wood', 3)
        if kind == 'spear':
            for j in range(7): tc.px(x + (1 if j < 2 or j > 4 else 0), top + j, 'steel', 6 if j < 3 else 5); tc.px(x, top + j, 'steel', 5)
            for (dx, dy) in ((-1, 8), (0, 9), (1, 9), (2, 8), (-1, 10), (2, 10), (0, 11), (1, 11)): tc.px(x + dx, top + dy, 'shu', 5 if dy < 10 else 4)
        elif kind == 'glaive':
            for j in range(10):
                w = 2 + (j > 2) * 1 + (j > 6) * -1
                for dx in range(w): tc.px(x - dx + 1, top + j, 'steel', 6 - dx)
            tc.px(x + 2, top + 2, 'steel', 4)
        elif kind == 'halberd':
            for j in range(8): tc.px(x, top + j, 'steel', 6); tc.px(x + 1, top + j, 'steel', 4)
            for j in range(4): tc.px(x - 1 - j, top + 4 + j // 2, 'steel', 5); tc.px(x + 2 + j // 2, top + 3, 'steel', 4)
        else:
            for y in range(top + 2, top + 8): tc.px(x, y, 'kuro', 4); tc.px(x + 1, y, 'kuro', 2)
    return _sh(tc.fin(.6), 16, 47, 14)


def stone_weights(seed=0):
    """돌 역기·석쇄 1x1칸: 손잡이 달린 네모 돌 자물쇠(석쇄) 하나 + 둥근 돌 둘을 꿴 나무 봉 하나."""
    tc = TC(16, 16, seed)
    for y in range(9, 15):
        for x in range(1, 8): tc.px(x, y, 'gran', 5 if y == 9 else (4 if x < 6 else 3))
    for x in range(2, 7): tc.px(x, 7, 'gran', 5)
    tc.px(2, 8, 'gran', 4); tc.px(6, 8, 'gran', 3)
    for x in range(8, 16): tc.px(x, 12, 'wood', 5); tc.px(x, 13, 'wood', 3)
    for (cx) in (9, 14):
        tc.ell(cx, 12.5, 2.2, 3.2, 'gran', lambda X, Y: 5 if X < 9 + (cx - 9) else 3)
    return _sh(tc.fin(.6), 8, 15, 7, 1)


def war_drum(seed=0):
    """큰 북 2x3칸: 붉은 칠 북통(놋 징 점 줄, 금 고리 둘) 이 나무 틀에 비스듬히 걸리고, 앞을 보는 가죽 면(누런 흰색, 가운데 빛), 북채 둘."""
    W, H = 32, 48
    tc = TC(W, H, seed)
    for (x0) in (3, 27):
        for y in range(14, 48): tc.px(x0, y, 'wood', 4); tc.px(x0 + 1, y, 'wood', 2)
        for j in range(5): tc.px(x0 - 2 + j, 46 + (j % 2), 'wood', 3)
    cx, cy = 16, 24
    for y in range(cy - 13, cy + 14):
        for x in range(4, 28):
            dy = (y + .5 - cy) / 13.0; dx = (x + .5 - cx) / 12.0
            if dx * dx + dy * dy > 1: continue
            face = (dx * 1.2 + .25) ** 2 + dy * dy < .55
            if face:
                tc.px(x, y, 'washi', 6 if (dx < -.2 and dy < -.1) else (5 if dx < .2 else 4))
            else:
                tc.px(x, y, 'shu', 5 if dx < -.6 else (4 if dx < .3 else 2))
    for a in range(0, 360, 30):
        r = math.radians(a); tc.px(cx - 2 + math.cos(r) * 8.6, cy + math.sin(r) * 9.6, 'gold', 5)
    for (x0, y0, dx) in ((6, 40, 1), (20, 41, 1)):
        for j in range(9): tc.px(x0 + j, y0 - j // 3, 'wood', 5); tc.px(x0 + j, y0 + 1 - j // 3, 'wood', 2)
        tc.px(x0 + 9, y0 - 3, 'shu', 5); tc.px(x0 + 10, y0 - 3, 'shu', 4)
    return _sh(tc.fin(.6), 16, 47, 13)


def incense_burner(seed=0):
    """청동 향로(세 발 솥) 2x2칸: 둥근 몸통(녹청 그늘 → 놋빛), 위 두 귀, 세 발, 몸통 띠 무늬, 위로 오르는 가는 향 연기(반투명 안개)."""
    W, H = 32, 32
    tc = TC(W, H, seed)
    cx = 16
    for y in range(14, 27):
        hw = 10 - abs(y - 20) * .45
        for x in range(int(cx - hw), int(cx + hw) + 1):
            u = (x + .5 - (cx - hw)) / (2 * hw)
            k = 6 if u < .2 else (5 if u < .45 else (4 if u < .7 else (3 if u < .88 else 2)))
            if y in (17, 18): k = max(1, k - 2)
            if y == 18 and x % 3 == 0: k = 5
            tc.px(x, y, 'bronze', k)
    for x in range(cx - 9, cx + 10): tc.px(x, 13, 'bronze', 5 if x < cx else 3); tc.px(x, 14, 'dark', 1)
    for (ex) in (cx - 9, cx + 7):
        for j in range(4): tc.px(ex, 9 + j, 'bronze', 5); tc.px(ex + 2, 9 + j, 'bronze', 3); tc.px(ex + 1, 9, 'bronze', 5)
    for (lx) in (cx - 7, cx - 1, cx + 5):
        for y in range(26, 31): tc.px(lx, y, 'bronze', 4); tc.px(lx + 1, y, 'bronze', 2)
    for i in range(12):                                                              # 향 연기
        y = 11 - i; x = cx + int(round(math.sin(i * .7 + seed) * 2))
        tc.px(x, y, 'mist', 6 - i // 4, 200 - i * 12)
        if i % 3 == 0: tc.px(x + 1, y, 'mist', 5, 140)
    return _sh(tc.fin(.6), 16, 31, 11)


def alchemy_furnace(seed=0):
    """단약 화로(丹爐) 2x3칸: 돌 받침 위 배 불룩한 청동 화로 + 앞 불구멍(주황 불빛), 둥근 뚜껑 + 손잡이 꼭지, 굴뚝 김."""
    W, H = 32, 48
    tc = TC(W, H, seed)
    for y in range(41, 48):
        for x in range(2, 30): tc.px(x, y, 'stone', 6 if y == 41 else (4 if x < 27 else 3) if y < 47 else 2)
    cx = 16
    for y in range(16, 41):
        hw = 12 * math.sin(min(1, (y - 14) / 27.0) * math.pi) ** .6 + 1
        for x in range(int(cx - hw), int(cx + hw) + 1):
            u = (x + .5 - (cx - hw)) / (2 * hw)
            k = 6 if u < .18 else (5 if u < .42 else (4 if u < .68 else (3 if u < .88 else 2)))
            if y in (24, 33): k = max(1, k - 2)
            tc.px(x, y, 'bronze', k)
    for y in range(28, 35):
        for x in range(12, 20): tc.px(x, y, 'amber', 6 if 14 <= x < 18 and y > 29 else 4)
    for x in range(11, 21): tc.px(x, 27, 'bronze', 2); tc.px(x, 35, 'bronze', 5)
    for y in range(8, 17):                                                           # 뚜껑
        hw = 3 + (y - 8) * .9
        for x in range(int(cx - hw), int(cx + hw) + 1): tc.px(x, y, 'bronze', 5 if x < cx else 3)
    tc.ell(cx, 6, 2, 2, 'gold', lambda X, Y: 6 if X < cx else 4)
    for i in range(8): tc.px(cx + 4 + int(math.sin(i * .9) * 1.5), 10 - i, 'mist', 6 - i // 3, 190 - i * 15)
    return _sh(tc.fin(.6), 16, 47, 14)


def stone_lantern(seed=0):
    """팔각 석등 1x3칸(16x48): 연꽃 받침 → 가는 기둥 → 불집(불 켠 창 둘) → 넓은 옥개(끝 살짝 들림) → 보주. 화강암 회색."""
    tc = TC(16, 48, seed)
    for y in range(42, 48):
        for x in range(1, 15): tc.px(x, y, 'stone', 6 if y == 42 else (4 if x < 12 else 3) if y < 47 else 2)
    for y in range(37, 42):
        hw = 4 + (y - 37) * .6
        for x in range(int(8 - hw), int(8 + hw)): tc.px(x, y, 'stone', 5 if x < 8 else 3)
    cyl(tc, 6, 10, 26, 37, 'stone', 3, 6)
    for y in range(17, 26):
        for x in range(3, 13):
            if 5 <= x < 11 and 19 <= y < 24 and x not in (7, 8): tc.px(x, y, 'amber', 6 if y < 21 else 5)
            else: tc.px(x, y, 'stone', 5 if x < 5 else (4 if x < 11 else 3))
    for y in range(11, 17):
        hw = 3 + (y - 11) * 1.1
        for x in range(int(8 - hw), int(8 + hw) + 1): tc.px(x, y, 'stone', 6 if (x < 8 and y < 14) else (4 if y < 16 else 2))
    tc.px(1, 15, 'stone', 4); tc.px(14, 15, 'stone', 3)
    tc.ell(8, 8, 2.2, 2.4, 'stone', lambda X, Y: 6 if X < 8 else 3)
    return _sh(tc.fin(.6), 8, 47, 7)


def turtle_stele(seed=0):
    """귀부 비석 2x3칸(32x48): 넓적한 돌 거북 받침(등딱지 육각 결 · 앞으로 내민 머리 · 앞발) 위에 글자 없는 넓은 판 비석 +
    위 반원 머릿돌(구름 무늬 테 두 줄). 비석 면은 비워 둔다(글자 없음). 화강암 + 아래쪽 이끼."""
    W, H = 32, 48
    tc = TC(W, H, seed)
    for y in range(13, 37):                                                          # 비석 판(넓고 납작)
        for x in range(7, 25):
            k = 5 if x < 9 else (4 if x < 23 else 3)
            if y == 13: k = 6
            if x in (8, 23) or y in (14,): k -= 1
            tc.px(x, y, 'gran', k)
    for y in range(3, 14):                                                           # 반원 머릿돌
        hw = 10.5 * math.sqrt(max(0, 1 - ((13.5 - y) / 10.5) ** 2))
        for x in range(int(16 - hw), int(16 + hw) + 1):
            d = math.hypot(x + .5 - 16, (y + .5 - 13.5))
            k = 6 if (x < 14 and y < 8) else (5 if x < 18 else 3)
            if 7.2 < d < 8.2 or 4.4 < d < 5.2: k -= 2
            tc.px(x, y, 'gran', clamp(k, 1, 6))
    for y in range(34, 47):                                                          # 거북 등(넓적)
        hw = 15 * math.sqrt(max(0, 1 - ((y - 41) / 6.5) ** 2))
        for x in range(int(16 - hw), int(16 + hw) + 1):
            k = 5 if x < 14 else 4
            if (x + (y // 3) % 2 * 2) % 5 == 0 or y % 3 == 0: k -= 1
            if y > 44: k = 2
            m_ = 'koke' if y > 43 and _hash(x, y, seed) < .4 else 'gran'
            tc.px(x, y, m_, k)
    for y in range(41, 47):                                                          # 머리 + 앞발
        for x in range(13, 19): tc.px(x, y, 'gran', 6 if y == 41 else (5 if x < 16 else 3))
    tc.px(14, 43, 'dark', 1); tc.px(17, 43, 'dark', 1)
    for (fx) in (3, 25):
        for y in range(43, 47):
            for x in range(fx, fx + 4): tc.px(x, y, 'gran', 4 if y < 46 else 2)
    return _sh(tc.fin(.6), 16, 47, 15)


def banner_pole(seed=0, mat='shu'):
    """깃대 1x4칸(16x64): 검은 칠 장대 + 꼭대기 창끝 · 붉은 술, 장대 옆에 늘어진 긴 세로 깃발(글자 없음, 가장자리 톱니 테, 바람에 살짝 굽음), 돌 받침."""
    tc = TC(16, 64, seed)
    for y in range(4, 60): tc.px(3, y, 'kuro', 4); tc.px(4, y, 'kuro', 2)
    for j in range(4): tc.px(3 + (j == 0) * 0, j, 'steel', 6 - j); tc.px(4, j + 1, 'steel', 4)
    for (dx, dy) in ((2, 5), (5, 5), (2, 6), (5, 6), (1, 7), (6, 7)): tc.px(dx, dy, 'shu', 5)
    for y in range(8, 46):
        bend = int(round(math.sin((y - 8) / 38.0 * math.pi) * 1.5))
        for x in range(5, 14):
            xx = x + bend
            lx = x - 5
            k = 5 if lx < 3 else (4 if lx < 7 else 3)
            if lx in (0, 8) or y in (8, 9): m_, k2 = 'gold', (5 if lx == 0 or y == 8 else 3)
            else: m_, k2 = mat, k
            tc.px(xx, y, m_, k2)
        if y > 41:
            pass
    for x in range(5, 14):                                                           # 아래 톱니 끝
        if x % 2: tc.px(x + 1, 46, mat, 3)
    for y in range(58, 64):
        for x in range(0, 9): tc.px(x, y, 'stone', 6 if y == 58 else (4 if x < 7 else 3) if y < 63 else 2)
    return _sh(tc.fin(.6), 5, 63, 5, 1)


def stone_table(seed=0):
    """돌 탁자 + 북 모양 돌 의자 둘 2x2칸: 넓은 둥근 상판(윗면 빛 + 두께 앞면 2px, 위에 바둑판 줄 · 청동 찻주전자), 짧은 굵은 다리, 앞 양쪽 돌 의자."""
    W, H = 32, 32
    tc = TC(W, H, seed)
    for y in range(17, 25):                                                          # 다리
        for x in range(12, 20): tc.px(x, y, 'stone', 4 if x < 17 else 2)
    tc.ell(16, 12, 13, 5.5, 'stone', lambda X, Y: 6 if (X < 11 and Y < 11) else 5)
    for x in range(4, 29):                                                           # 상판 두께
        if abs(x + .5 - 16) < 12.6:
            tc.px(x, 17, 'stone', 3); tc.px(x, 18, 'stone', 2)
    for x in range(9, 24):
        for y in range(9, 16):
            if (x - 9) % 3 == 0 or (y - 9) % 3 == 0: tc.px(x, y, 'stone', 4)
    tc.ell(21, 10, 2.4, 1.8, 'bronze', lambda X, Y: 5 if X < 21 else 3); tc.px(21, 8, 'bronze', 4)
    for (cx, cy) in ((5, 27), (27, 27)):
        tc.ell(cx, cy, 4.2, 4, 'stone', lambda X, Y: 6 if Y < 25 else (4 if X < cx + 2 else 3))
        for x in range(cx - 3, cx + 4): tc.px(x, cy - 1, 'stone', 6)
    return _sh(tc.fin(.6), 16, 31, 14)


def water_jar(seed=0):
    """물 항아리 1x1칸: 짙은 갈색 유약 항아리(어깨 빛 점, 입 테) + 위에 얹은 표주박 국자."""
    tc = TC(16, 16, seed)
    for y in range(3, 16):
        hw = 6.5 * math.sin(min(1, (y - 1) / 15.0) * math.pi) ** .5
        for x in range(int(8 - hw), int(8 + hw) + 1):
            u = (x + .5 - (8 - hw)) / (2 * hw + .01)
            k = 5 if u < .3 else (4 if u < .6 else 2)
            if y == 6 and u < .4: k = 6
            tc.px(x, y, 'kuro', k)
    for x in range(4, 12): tc.px(x, 2, 'kuro', 5); tc.px(x, 3, 'dark', 1)
    for j in range(5): tc.px(9 + j, 2 - j // 2, 'straw' if False else 'gold', 4)
    return _sh(tc.fin(.6), 8, 15, 6, 1)


def herb_rack(seed=0):
    """약초 말림 채반 2x2칸: 대나무 사다리 틀에 둥근 채반 셋(위에서 보이는 테 + 말린 약초 점: 붉은 열매 · 마른 잎 · 뿌리)."""
    W, H = 32, 32
    tc = TC(W, H, seed)
    for (x0) in (2, 28):
        for y in range(2, 32): tc.px(x0, y, 'take', 5); tc.px(x0 + 1, y, 'take', 3)
    for (cy, kind) in ((8, 'aki'), (17, 'redl'), (26, 'soil')):
        tc.ell(16, cy, 13, 3.4, 'take', lambda X, Y: 5 if Y < cy else 3)
        tc.ell(16, cy - .4, 11, 2.4, 'take', 2)
        for i in range(14):
            x = 6 + int(_hash(i, cy, seed) * 20); y = cy - 2 + int(_hash(i, 1, seed + cy) * 3)
            tc.px(x, y, kind, 5 if i % 2 else 3)
    return _sh(tc.fin(.6), 16, 31, 13)


def sword_rack(seed=0):
    """검 거치대 2x1칸: 검은 칠 낮은 받침 위에 칼집 든 곧은 검 셋(검집 끝 금 장식 · 붉은 매듭)."""
    W, H = 32, 16
    tc = TC(W, H, seed)
    for y in range(10, 16):
        for x in range(1, 31): tc.px(x, y, 'kuro', 5 if y == 10 else (3 if y < 15 else 1))
    for (x0) in (4, 26):
        for y in range(2, 10): tc.px(x0, y, 'kuro', 4); tc.px(x0 + 1, y, 'kuro', 2)
    for i, y in enumerate((3, 5, 7)):
        for x in range(2, 30):
            m_ = 'ink' if 7 < x < 28 else ('gold' if x >= 28 else 'steel')
            tc.px(x, y, m_, 5 if m_ != 'ink' else 4); tc.px(x, y + 1, m_, 3 if m_ != 'ink' else 2)
        tc.px(8, y + 2, 'shu', 5); tc.px(9, y + 2, 'shu', 4)
    return _sh(tc.fin(.6), 16, 15, 14, 1)


def meditation_rock(seed=0):
    """좌선 바위 2x2칸: 윗면이 넓고 평평한 둥근 바위(이끼 점) 위에 짚 방석 하나."""
    tc = TC(32, 32, seed)
    W5._rock(tc, 1, 10, 30, 21, seed + 1, mossy=.25)
    tc.ell(16, 13, 6, 2.4, 'tatami', lambda X, Y: 5 if Y < 13 else 3)
    tc.ell(16, 12.6, 3, 1.2, 'tatami', 6)
    return _sh(tc.fin(.6), 16, 30, 14)


# ================================================================ 바위·봉우리·안개
def boulder(seed=0, w=2, mossy=.3):
    tc = TC(w * 16, 32, seed)
    W5._rock(tc, 1, 32 - (14 + w * 4), w * 16 - 2, 14 + w * 4 - 1, seed + 1, mossy=mossy)
    return _sh(tc.fin(.6), w * 8, 30, w * 7)


def rock_small(seed=0):
    tc = TC(16, 16, seed); W5._rock(tc, 2, 6, 12, 9, seed + 1, mossy=.3); return _sh(tc.fin(.6), 8, 15, 6, 1)


def peak_spire(seed=0, w=3, h=6):
    """구름 낀 봉우리 바위 w x h칸: 산수화 같은 세로로 솟은 화강암 봉우리(세로 갈비 결 · 위로 갈수록 좁아짐 · 층진 턱마다 이끼),
    꼭대기와 턱에 작은 소나무, 허리에 걸린 안개 띠(반투명). 아래 2줄만 막힌다."""
    W, H = w * 16, h * 16
    tc = TC(W, H, seed)
    import ws_cliff as WC
    cx = W / 2.0 + (_hash(seed, 1, 3) - .5) * 6
    for y in range(6, H):
        f = (y - 6) / (H - 6)
        hw = (W / 2.0 - 2) * (.35 + .65 * f ** .7) + 2 * math.sin(y / 5.0 + seed)
        for x in range(int(cx - hw), int(cx + hw) + 1):
            if not 0 <= x < W: continue
            k = WC.cliff_k(x + seed * 13, y, y, H, x // 16, seed)
            u = (x + .5 - (cx - hw)) / (2 * hw)
            if u < .2: k += 1
            if u > .8: k -= 1
            tier = (y + int(_hash(x // 6, 0, seed) * 4)) % 22
            m_ = 'gran'
            if tier in (0, 1): m_, k = 'koke', 5 if tier == 0 else 3
            tc.px(x, y, m_, clamp(k, 1, 6))
    for (px_, py_, r) in ((cx, 8, 6), (cx - 7, 30, 5), (cx + 8, 52, 5)):            # 작은 소나무
        if py_ > H - 20: continue
        for j in range(5): tc.px(px_ + j * .3, py_ + 4 + j, 'wood', 3)
        foliage(tc, px_, py_, r + 2, r * .55, seed + int(py_), mat='pine', shift=0, flat=True)
    im = tc.fin(.6)
    tc2 = TC(W, H, seed + 50)                                                          # 허리 구름(윤곽 없이 위에 얹는다)
    cloud_band(tc2, -2, W * .7, int(H * .52), 6, seed + 3, 200)
    cloud_band(tc2, W * .35, W + 2, int(H * .78), 5, seed + 4, 190)
    im.alpha_composite(tc2.img())
    return im


def cloud_band(tc, x0, x1, ybase, th, seed=0, alpha=205):
    """산수화 구름 띠: 밑은 평평(ybase), 윗변은 둥근 송이(반지름 3~th) 가 이어진 물결. 윗 윤곽 1px 짙은 청회(톤 3) · 그 아래 빛(6) 두 줄 ·
    몸(5) · 밑단 한 줄(4). 송이 사이 골에는 짧은 소용돌이 줄(톤 4). 알파 한 단(alpha)."""
    ybase = int(ybase); bumps = []; x = x0 + 2
    while x < x1 - 2:
        r = 3 + _hash(int(x), seed, 1) * (th - 3); bumps.append((x + r * .8, r)); x += r * 1.5 + 1
    top = {}
    for X in range(int(x0), int(x1)):
        h = 0
        for (bx, r) in bumps:
            d = abs(X + .5 - bx)
            if d < r: h = max(h, math.sqrt(r * r - d * d))
        u = min(X - x0, x1 - 1 - X)
        h = min(h, u * 1.2 + 1)
        top[X] = ybase - int(round(h))
    for X, ty in top.items():
        for Y in range(ty, ybase + 1):
            k = 3 if Y == ty else (6 if Y < ty + 3 else (4 if Y == ybase else 5))
            tc.px(X, Y, 'mist', k, alpha if Y > ty else min(255, alpha + 30))
    for (bx, r) in bumps[1:]:
        X = int(bx - r * .9)
        for j in range(2): tc.px(X + j, ybase - 2 - j, 'mist', 4, alpha)


def mist_cloud(seed=0, w=4, h=2):
    """구름·안개 덩이(위층 장식, 반투명) w x h칸: 산수화 구름 띠 둘(뒤 띠는 짧고 높게, 앞 띠는 길고 낮게) — 둥근 송이 윗변 · 평평한 밑.
    봉우리 허리·지도 가장자리·폭포 웅덩이 위에 겹쳐 깐다. 걷기에 영향 없음."""
    W, H = w * 16, h * 16
    tc = TC(W, H, seed)
    cloud_band(tc, W * .25, W * .9, H * .5, 6 + _hash(seed, 2, 3) * 3, seed + 1, 190)
    cloud_band(tc, 1, W * .75, H - 3, 7 + _hash(seed, 4, 3) * 3, seed + 2, 215)
    return tc.img()


# ================================================================ 나무
def cliff_pine(seed=0, flip_=False):
    """절벽 소나무 3x4칸: 바위 틈에서 비스듬히 뻗어 나온 굵은 줄기(비늘 껍질), 끝이 평평한 짙은 소나무 잎 구름 셋, 밑동에 바위 덩이."""
    W, H = 48, 64
    tc = TC(W, H, seed)
    W5._rock(tc, 8, 48, 20, 15, seed + 3, mossy=.4)
    pts = []
    for i in range(46):
        f = i / 45.0
        x = 16 + f * 18 + math.sin(f * 4 + seed) * 4; y = 52 - f * 36 - math.sin(f * 3) * 4
        pts.append((x, y, 3.2 - f * 1.8))
    for (x, y, r) in pts:
        for j in range(int(-r), int(r) + 1):
            u = (j + r) / (2 * r + .01)
            k = 5 if u < .3 else (4 if u < .65 else 2)
            if _hash(int(x), int(y + j), seed) < .15: k -= 1
            tc.px(x, y + j, 'wood', k)
    for (fx, fy, rx, ry) in ((pts[-1][0], pts[-1][1] - 2, 13, 5), (pts[25][0] - 9, pts[25][1] - 4, 11, 4.5), (pts[33][0] + 4, pts[33][1] + 6, 9, 4)):
        foliage(tc, fx, fy, rx, ry, seed + int(fx), mat='pine', shift=0, flat=True)
        foliage(tc, fx - 2, fy - 2, rx * .65, ry * .55, seed + int(fx) + 3, mat='pine', shift=1, flat=True)
    im = _sh(tc.fin(.6), 22, 62, 10)
    return flip(im) if flip_ else im


def maple_tree(seed=0):
    """단풍나무 3x4칸: 갈래 진 회갈색 줄기 + 둥근 잎 덩이 셋(붉은 · 주황 단풍, 칩셋 덤불 잎 결), 밑에 떨어진 잎 몇."""
    W, H = 48, 64
    tc = TC(W, H, seed)
    for y in range(34, 62):
        for x in range(21, 27): tc.px(x, y, 'ita', 5 if x < 23 else (4 if x < 25 else 2))
    for j in range(12):
        tc.px(22 - j, 36 - j, 'ita', 4); tc.px(23 - j, 36 - j, 'ita', 2)
        tc.px(26 + j * .8, 38 - j, 'ita', 4); tc.px(27 + j * .8, 38 - j, 'ita', 2)
    foliage(tc, 14, 24, 13, 11, seed + 1, mat='aki', shift=0)
    foliage(tc, 33, 22, 13, 12, seed + 2, mat='aki', shift=1)
    foliage(tc, 24, 13, 14, 11, seed + 3, mat='aki', shift=1)
    for i in range(6):
        x = 10 + int(_hash(i, 1, seed) * 28); y = 58 + int(_hash(i, 2, seed) * 5)
        tc.px(x, y, 'aki', 4); tc.px(x + 1, y, 'aki', 3)
    return _sh(tc.fin(.6), 24, 62, 12)


def ginkgo_tree(seed=0):
    """은행나무 3x5칸: 곧고 굵은 회색 줄기 + 위로 층진 부채꼴 노란 잎 덩이(은행잎 램프), 밑동 둘레 노란 잎."""
    W, H = 48, 80
    tc = TC(W, H, seed)
    for y in range(20, 78):
        for x in range(21, 28): tc.px(x, y, 'ita', 5 if x < 23 else (4 if x < 26 else 2))
    for (y, rx, ry) in ((52, 18, 8), (38, 16, 9), (24, 13, 9), (12, 9, 7)):
        foliage(tc, 24, y, rx, ry, seed + y, mat='ginkgo', shift=1)
    for i in range(10):
        x = 6 + int(_hash(i, 1, seed) * 36); y = 74 + int(_hash(i, 2, seed) * 5)
        tc.px(x, y, 'ginkgo', 5); tc.px(x + 1, y, 'ginkgo', 4)
    return _sh(tc.fin(.6), 24, 78, 13)


def mtn_shrub(seed=0):
    """산 덤불 2x2칸: 짙은 잎 덩이 둘 겹침 + 흰 들꽃 점."""
    tc = TC(32, 32, seed)
    foliage(tc, 11, 20, 10, 8, seed + 1, mat='leaf', shift=-1)
    foliage(tc, 20, 18, 11, 9, seed + 2, mat='leaf', shift=0)
    for i in range(5):
        x = 6 + int(_hash(i, 1, seed) * 20); y = 12 + int(_hash(i, 2, seed) * 12)
        tc.px(x, y, 'washi', 6); tc.px(x + 1, y, 'washi', 5)
    return _sh(tc.fin(.6), 16, 30, 13)


def fern(seed=0):
    """고사리 포기 1x1칸(땅 장식): 아치형으로 휜 잎줄기 넷 + 잔잎."""
    tc = TC(16, 16, seed)
    for i, a in enumerate((-2.4, -1.9, -1.2, -.7)):
        for t in range(8):
            x = 8 + math.cos(a) * t; y = 14 + math.sin(a) * t + t * t * .07
            tc.px(x, y, 'leaf', 5 if t < 4 else 4)
            if t % 2 == 0: tc.px(x + (1 if a > -1.5 else -1), y + 1, 'leaf', 3)
    return tc.fin(.7)


if __name__ == '__main__':
    import os
    fs = [wooden_dummy, plum_posts, polearm_rack, stone_weights, war_drum, incense_burner, alchemy_furnace, stone_lantern, turtle_stele,
          banner_pole, stone_table, water_jar, herb_rack, sword_rack, meditation_rock, boulder, rock_small, peak_spire, mist_cloud,
          cliff_pine, maple_tree, ginkgo_tree, mtn_shrub, fern]
    ims = [f() for f in fs]
    W = sum(i.width for i in ims) + 8 * (len(ims) + 1); H = max(i.height for i in ims) + 16
    o = Image.new('RGBA', (W, H), (70, 120, 60, 255)); x = 8
    for im in ims: o.alpha_composite(im, (x, H - 8 - im.height)); x += im.width + 8
    o.resize((W * 2, H * 2), Image.NEAREST).save(os.path.join(HERE, '_qa', 'props.png')); print('ok', o.size)
