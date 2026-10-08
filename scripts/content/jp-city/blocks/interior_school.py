#!/usr/bin/env python3
"""jp_city 일본 실내 3묶음 — 학교 본관(공립 중·고등학교). id 머리 `sc-`.

거리의 학교 본관 외관 `jp-bldg-school` 의 실내: 1층 昇降口(신발장)·복도·교무실·보건실·화장실, 2층 교실,
3층 특별교실(음악실·도서실·이과실), 옥상. 교실 바닥은 나무, 복도는 비닐 시트, 현관은 회색 타일.

칸 16px = 1m, 3/4 시점(윗면 + 남쪽 앞면), 왼위 빛, 외곽선 1px(sumi 또는 재질 어두운 단), 팔레트 modern3 램프만.
글자·숫자·상표·사람·인체 모형·해골 없음 — 칠판·게시판·시간표는 색 덩이와 선뿐.
캔버스 규약(ikit): floor/wall 은 주기 캔버스, obj = w*16 × (ceil(up/16) + h)*16, hang = w*16 × hrows*16, table = fn(c,w,h).
크기(§12-3, 1칸 = 1m): 학생 책상 0.6×0.45×0.75 → 1×1 · 신발장 1.5m → up16 · 칠판 3.6×1.2 → 걸이 4칸 · 사물함 0.9m → up8 ·
청소함·약품장·서가·표본장·드래프트 1.8m → up16 · 그랜드 피아노 1.5×1.8 → 2×2 up8 · 수조 2×2×2 → up16 · 철망 펜스 2.0m → up16.
분류는 interior/categories.py(school-entry·classroom·staffroom·special-room·school-stairs).
"""
import math, os, sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, '..', 'interior'))
from ikit import Registry, K, OL, run_block, ROOT   # noqa: E402

BLOCK = 'interior_school'
R = Registry(BLOCK, '학교')

kc = K                                     # K 는 램프 끝 단에서 멈춘다(7단 -3…3, 5단 -2…2)
WD = lambda t: K('yuka', t)                # 밝은 나무(교실 마루·책상·교탁)
DW = lambda t: K('ita', t)                 # 짙은 나무(서가·액자 틀)
ST = lambda t: K('tekko', t)               # 쇠(사물함·의자 다리·난간)
WH = lambda t: K('shiro', t)               # 흰 칠·도기·시트
GL = lambda t: K('garasu', t)              # 유리


def hs(x, y, s=0):
    n = (x * 374761393 + y * 668265263 + s * 2246822519 + 12345) & 0xffffffff
    n = ((n ^ (n >> 13)) * 1274126177) & 0xffffffff
    return (n ^ (n >> 16)) & 0xffff


def rnd(x, y, s, per): return hs(x, y, s) % 1000 < per


def px(c, x, y, col):
    if 0 <= x < c.w and 0 <= y < c.h: c.P(x, y, col)


def rc(c, x, y, w, h, col):
    x0, y0, x1, y1 = max(0, x), max(0, y), min(c.w, x + w), min(c.h, y + h)
    if x1 > x0 and y1 > y0: c.R(x0, y0, x1 - x0, y1 - y0, col)


def hl(c, x, y, n, col): rc(c, x, y, n, 1, col)
def vl(c, x, y, n, col): rc(c, x, y, 1, n, col)


def outline(c, x, y, w, h, col=None):
    col = col or OL
    hl(c, x, y, w, col); hl(c, x, y + h - 1, w, col); vl(c, x, y, h, col); vl(c, x + w - 1, y, h, col)


def disc(c, cx, cy, rx, ry, col):
    for y in range(int(cy - ry) - 1, int(cy + ry) + 2):
        for x in range(int(cx - rx) - 1, int(cx + rx) + 2):
            if ((x + .5 - cx) / rx) ** 2 + ((y + .5 - cy) / ry) ** 2 <= 1: px(c, x, y, col)


def bev(c, x, y, w, h, ramp, t=0, olc=None):
    """외곽선 + 면 + 왼위 밝은 변 + 오른아래 어두운 변."""
    outline(c, x, y, w, h, olc)
    ix, iy, iw, ih = x + 1, y + 1, w - 2, h - 2
    rc(c, ix, iy, iw, ih, kc(ramp, t))
    hl(c, ix, iy, iw, kc(ramp, t + 1)); vl(c, ix, iy, ih, kc(ramp, t + 1))
    hl(c, ix, iy + ih - 1, iw, kc(ramp, t - 1)); vl(c, ix + iw - 1, iy, ih, kc(ramp, t - 1))


def block3(c, x, y, w, h, top, ramp, t=0, olc=None, front_t=None):
    """3/4 상자: 윗면 top px(가장자리 1px 밝은 테) + 앞 가장자리 하이라이트 1행 + 처마 그늘 2px + 앞면. (x,y) 왼위, 전체 w×h."""
    ft = t - 1 if front_t is None else front_t
    outline(c, x, y, w, h, olc or kc(ramp, -3))
    rc(c, x + 1, y + 1, w - 2, top, kc(ramp, t + 1))                       # 윗면
    hl(c, x + 1, y + 1, w - 2, kc(ramp, t + 2)); vl(c, x + 1, y + 1, top, kc(ramp, t + 2))
    hl(c, x + 1, y + 1 + top, w - 2, kc(ramp, t + 2))                      # 앞 가장자리 하이라이트
    rc(c, x + 1, y + 2 + top, w - 2, h - 3 - top, kc(ramp, ft))            # 앞면
    hl(c, x + 1, y + 2 + top, w - 2, kc(ramp, ft - 2)); hl(c, x + 1, y + 3 + top, w - 2, kc(ramp, ft - 1))   # 처마 그늘 2px
    vl(c, x + 1, y + 4 + top, h - 5 - top, kc(ramp, ft + 1))               # 왼쪽 빛
    return y + 4 + top                                                       # 앞면 내용 시작 y


# ══ 바닥 ══════════════════════════════════════════════════════════════════════
@R.floor('sc-classroom-wood', '교실 나무 마루(좁은 판자)', cols=4, rows=4, tags=('교실', '학교', '특별교실'),
         desc='교실의 좁은 나무 판자 마루 — 판자 폭 4px 가로 줄, 줄마다 이음새가 어긋난다. 밝은 꿀색 4톤. 교실·음악실·도서실 바닥.')
def _classroom_wood(c):
    W, H = c.w, c.h
    for r in range(H // 4):
        tone = (1, 0, 1, 1, 0, 1, 0, 1)[(r * 5 + 3) % 8]
        y0 = r * 4
        rc(c, 0, y0, W, 4, WD(tone))
        hl(c, 0, y0, W, WD(tone + 1) if tone == 0 else WD(1))
        hl(c, 0, y0 + 3, W, WD(-1))                                          # 판자 사이 홈
        for k in range(2):
            sx = (r * 23 + 7 + k * 32 + hs(r, k, 3) % 9) % W
            vl(c, sx, y0, 3, WD(-1)); px(c, (sx + 1) % W, y0, WD(2))
        for x in range(W):
            if rnd(x, r, 11, 18): px(c, x, y0 + 1 + hs(x, r, 2) % 2, WD(tone - 1 if tone > 0 else 0))


@R.floor('sc-corridor', '학교 복도 비닐 시트', cols=2, rows=2, tags=('복도', '학교'),
         desc='학교 복도의 연녹회색 비닐 시트 — 드문 얼룩 점, 32px 마다 시트 이음선. 복도·계단참 바닥.')
def _corridor(c):
    rc(c, 0, 0, 32, 32, K('lino', 1))
    for y in range(32):
        for x in range(32):
            if rnd(x, y, 5, 40): px(c, x, y, K('lino', 2))
            elif rnd(x, y, 6, 22): px(c, x, y, K('lino', 0))
    hl(c, 0, 0, 32, K('lino', 0)); hl(c, 0, 1, 32, K('lino', 2))


@R.floor('sc-genkan-tile', '현관 회색 타일(昇降口)', cols=2, rows=2, tags=('현관', '昇降口', '학교'),
         desc='昇降口의 회색 16px 타일 — 줄눈 어둡고 타일마다 윗·왼 변이 밝다. 신발 갈아 신는 현관 바닥(스노코를 놓는 곳).')
def _genkan_tile(c):
    for ty in range(2):
        for tx in range(2):
            x0, y0 = tx * 16, ty * 16
            t = 1 if (tx + ty) % 2 == 0 else 0
            rc(c, x0, y0, 16, 16, K('conc', t))
            hl(c, x0, y0, 16, K('conc', -2)); vl(c, x0, y0, 16, K('conc', -2))
            hl(c, x0 + 1, y0 + 1, 15, K('conc', t + 1)); vl(c, x0 + 1, y0 + 1, 15, K('conc', t + 1))
            for k in range(5):
                px(c, x0 + 3 + hs(tx, ty, k) % 11, y0 + 3 + hs(ty, tx, k + 7) % 11, K('conc', t - 1))


@R.floor('sc-roof-conc', '옥상 방수 바닥(녹색)', cols=3, rows=3, tags=('옥상', '학교'),
         desc='옥상의 녹색 방수 도장 콘크리트 — 48px 마다 회색 신축 줄눈, 드문 얼룩. 옥상 바닥.')
def _roof(c):
    rc(c, 0, 0, 48, 48, K('lino', 0))
    for y in range(48):
        for x in range(48):
            if rnd(x, y, 9, 50): px(c, x, y, K('lino', 1))
            elif rnd(x, y, 10, 30): px(c, x, y, K('lino', -1))
    hl(c, 0, 0, 48, K('conc', -1)); vl(c, 0, 0, 48, K('conc', -1))
    hl(c, 1, 1, 47, K('conc', 1)); vl(c, 1, 1, 47, K('conc', 1))


# ══ 벽면(2줄 32px) ════════════════════════════════════════════════════════════
def _wainscot(c, y0, ramp='yuka'):
    """허리판: y0 레일 → 세로 널 → 걸레받이."""
    hl(c, 0, y0, c.w, kc(ramp, 2)); hl(c, 0, y0 + 1, c.w, kc(ramp, -2))
    rc(c, 0, y0 + 2, c.w, 28 - y0, kc(ramp, 0))
    for x in range(0, c.w, 8): vl(c, x, y0 + 2, 28 - y0, kc(ramp, -1)); vl(c, x + 1, y0 + 2, 28 - y0, kc(ramp, 1))
    hl(c, 0, 29, c.w, K('ita', 0)); hl(c, 0, 30, c.w, K('ita', -1)); hl(c, 0, 31, c.w, K('ita', -3))


@R.wall('sc-wall', '학교 벽(흰 회반죽 + 나무 허리판)', cols=2, tags=('교실', '복도', '교무실', '보건실', '학교'),
        desc='위는 흰 회반죽, 아래는 나무 허리판과 짙은 걸레받이. 교실·복도·교무실·보건실·도서실 벽면.')
def _sc_wall(c):
    rc(c, 0, 0, 32, 18, WH(1))
    for y in range(18):
        for x in range(32):
            if rnd(x, y, 21, 30): px(c, x, y, WH(0))
    vl(c, 0, 0, 18, WH(2))
    _wainscot(c, 18)


@R.wall('sc-wall-tile', '학교 타일 벽(화장실·이과실)', cols=2, tags=('화장실', '이과실', '학교'),
        desc='흰 8px 타일 벽, 아래 한 단은 연녹 타일 띠와 회색 걸레받이. 학교 화장실·이과실·보건실 세면대 벽.')
def _sc_wall_tile(c):
    for ty in range(4):
        for tx in range(4):
            x0, y0 = tx * 8, ty * 8
            low = ty == 3
            rc(c, x0, y0, 8, 8, K('lino', 2) if low else WH(2))
            hl(c, x0, y0, 8, K('lino', 3) if low else WH(3)); vl(c, x0, y0, 8, K('lino', 3) if low else WH(3))
            hl(c, x0, y0 + 7, 8, K('lino', 0) if low else K('conc', 3)); vl(c, x0 + 7, y0, 8, K('lino', 0) if low else K('conc', 3))
    hl(c, 0, 30, 32, K('conc', 0)); hl(c, 0, 31, 32, K('conc', -2))


@R.wall('sc-soundwall', '음악실 유공 흡음 벽', cols=2, tags=('음악실', '학교'),
        desc='작은 구멍이 촘촘히 뚫린 크림색 유공 흡음판, 아래 나무 허리판. 음악실 벽면.')
def _soundwall(c):
    rc(c, 0, 0, 32, 18, K('kinari', 1))
    for x in range(0, 32, 16): vl(c, x, 0, 18, K('kinari', 0)); vl(c, x + 1, 0, 18, K('kinari', 2))
    for y in range(2, 17, 3):
        for x in range(3 + (y // 3) % 2, 32, 3):
            if x % 16 > 1: px(c, x, y, K('kinari', -1))
    _wainscot(c, 18, 'ita')


@R.wall('sc-parapet', '옥상 콘크리트 난간벽', cols=2, tags=('옥상', '학교'),
        desc='옥상 가장자리의 콘크리트 난간벽(파라펫) — 위 갓돌 밝고, 면에 얼룩·물 자국, 아래 녹색 방수 치켜올림. 옥상 북쪽 벽면.')
def _parapet(c):
    rc(c, 0, 0, 32, 32, K('conc', 0))
    hl(c, 0, 0, 32, K('conc', 3)); rc(c, 0, 1, 32, 3, K('conc', 2)); hl(c, 0, 4, 32, K('conc', -2))
    for x in range(0, 32, 16): vl(c, x, 5, 22, K('conc', -1))
    for y in range(5, 26):
        for x in range(32):
            if rnd(x, y, 31, 45): px(c, x, y, K('conc', -1))
            elif rnd(x, y, 32, 25): px(c, x, y, K('conc', 1))
    for x in (5, 22): vl(c, x, 5, 9, K('conc', -1))                     # 물 자국
    rc(c, 0, 26, 32, 6, K('midori', -1)); hl(c, 0, 26, 32, K('midori', 0)); hl(c, 0, 31, 32, K('midori', -2))


# ══ 현관 昇降口 ═══════════════════════════════════════════════════════════════
@R.obj('sc-shoe-locker', '학교 신발장(下駄箱)', w=2, h=1, up=16, kind='floor', use=('open',), tags=('현관', '昇降口', '학교', '신발장'),
       place='昇降口 타일 바닥, 남북으로 줄지어(사이 2줄 통로)',
       desc='昇降口의 회색 철제 신발장 2칸 — 높이 1.5m, 작은 칸이 5열×4단, 칸마다 흰 실내화(우와바키). 바닥에 서는 floor 종류라 현관 한가운데에도 여러 개를 가로로 이어 줄을 만든다.')
def _shoe_locker(c):
    y = block3(c, 0, 3, 32, 29, 4, 'tekko', 1, front_t=0)
    for r in range(4):
        for k in range(5):
            x0, y0 = 2 + k * 6, y + r * 6
            rc(c, x0, y0, 5, 5, K('yoru', -2)); hl(c, x0, y0 + 4, 5, ST(-2))
            if hs(k, r, 4) % 5:
                rc(c, x0 + 1, y0 + 2, 3, 2, WH(3)); hl(c, x0 + 1, y0 + 2, 3, WH(4))
                px(c, x0 + 1, y0 + 3, (K('aka', 1), K('sora', 1), K('midori', 1))[r % 3])   # 학년 색 고무 끝
        hl(c, 1, y + r * 6 + 5, 30, ST(2))
    hl(c, 1, 30, 30, ST(-3))


@R.obj('sc-sunoko', '스노코(나무 발판)', kind='flat', tags=('현관', '昇降口', '학교'), use=('walk',),
       place='신발장 앞 타일 바닥, 가로로 이어 깐다',
       desc='昇降口의 나무 발판(すのこ) — 가로 널 네 장 사이로 어두운 틈. 신발을 벗고 올라서는 자리. 밟는 무늬, 가로로 이어 깐다.')
def _sunoko(c):
    for i in range(4):
        y = 1 + i * 4
        rc(c, 0, y, 16, 3, WD(1)); hl(c, 0, y, 16, WD(2)); hl(c, 0, y + 2, 16, WD(-1))
        hl(c, 0, y + 3, 16, K('ita', -2))
    for x in (3, 12): vl(c, x, 1, 15, WD(-1))
    hl(c, 0, 0, 16, K('ita', -2))


# ══ 교실 ══════════════════════════════════════════════════════════════════════
@R.obj('sc-blackboard', '칠판', w=4, kind='hang', hrows=2, use=('read',), tags=('교실', '학교', '칠판'),
       place='교실 북쪽 벽면 윗줄 가운데(교단 위)',
       desc='교실 앞 칠판 4칸 — 짙은 녹색 판에 나무 틀, 아래 분필 받침(흰·빨강·노랑 분필, 지우개). 판 위엔 분필 선과 동그라미 몇 개뿐, 글자 없음.')
def _blackboard(c):
    W = 64
    rc(c, 0, 1, W, 26, K('ita', 0)); outline(c, 0, 1, W, 26, K('ita', -3)); hl(c, 1, 2, W - 2, K('ita', 2))
    rc(c, 2, 3, W - 4, 21, K('kokuban', 0)); outline(c, 2, 3, W - 4, 21, K('kokuban', -2))
    for y in range(4, 23):
        for x in range(3, W - 3):
            if rnd(x, y, 41, 35): px(c, x, y, K('kokuban', 1))
    for (x, y, n) in ((7, 8, 14), (7, 12, 9), (30, 7, 6), (46, 15, 11)): hl(c, x, y, n, K('kokuban', 2))   # 분필 선
    for t in range(16):
        a = 2 * math.pi * t / 16
        px(c, int(round(38 + 4 * math.cos(a))), int(round(15 + 3.5 * math.sin(a))), K('kokuban', 2))      # 동그라미
    for i in range(6): px(c, 10 + i * 2, 18 - (i % 2), K('kii', 2))                                     # 노란 물결선
    rc(c, 1, 24, W - 2, 3, K('ita', 1)); hl(c, 1, 24, W - 2, K('ita', 3)); hl(c, 1, 26, W - 2, K('ita', -2))   # 분필 받침
    for x, col in ((8, WH(3)), (12, K('aka', 2)), (15, K('kii', 3))): hl(c, x, 24, 3, col)
    rc(c, 48, 23, 7, 2, K('kon', 1)); hl(c, 48, 23, 7, K('kii', 2))                                      # 칠판 지우개
    hl(c, 0, 27, W, K('ita', -3))


@R.obj('sc-podium', '교단(敎壇)', kind='flat', use=('walk',), tags=('교실', '학교'),
       place='칠판 바로 아래 첫 바닥 줄, 칠판 폭만큼 가로로 이어 깐다',
       desc='칠판 앞 나무 교단 — 한 단 높은 판. 윗면 널, 남쪽에 짙은 앞 단(챌판). 밟는 무늬, 가로로 이어 깐다. 교탁은 그 바로 앞(남쪽) 칸.')
def _podium(c):
    rc(c, 0, 0, 16, 10, K('ita', 1)); hl(c, 0, 0, 16, K('ita', 2))
    for y in (3, 6): hl(c, 0, y, 16, K('ita', 0))
    vl(c, 9, 0, 3, K('ita', 0)); vl(c, 4, 4, 2, K('ita', 0)); vl(c, 12, 7, 3, K('ita', 0))
    hl(c, 0, 9, 16, K('ita', 3))
    rc(c, 0, 10, 16, 5, K('ita', -1)); hl(c, 0, 10, 16, K('ita', -2)); hl(c, 0, 14, 16, K('ita', -3))
    hl(c, 0, 15, 16, K('ita', -3))


@R.obj('sc-teacher-desk', '교탁', w=1, h=1, up=0, kind='floor', surface=True, use=('counter',), tags=('교실', '학교'),
       place='교단 바로 남쪽, 교실 가운데 앞',
       desc='선생님 교탁 — 밝은 나무 윗면과 앞판(가운데 세로 홈). 윗면에 출석부·분필 상자를 올린다. 학생 책상들과 마주 본다.')
def _teacher_desk(c):
    y = block3(c, 0, 0, 16, 16, 6, 'yuka', 0, olc=K('ita', -3), front_t=-1)
    vl(c, 7, y, 15 - y, WD(-2)); vl(c, 8, y, 15 - y, WD(0))
    hl(c, 1, 14, 14, WD(-2))


def _desk_top(c, x, y, w, top):
    """학생 책상 윗면(크림 합판, 바닥보다 밝다) + 쇠 앞판."""
    outline(c, x - 1, y - 1, w + 2, top + 2, OL)
    rc(c, x, y, w, top, K('kinari', 1)); hl(c, x, y, w, K('kinari', 2)); vl(c, x, y, top, K('kinari', 2)); hl(c, x, y + top - 1, w, K('kinari', 0))
    rc(c, x - 1, y + top + 1, w + 2, 2, ST(0)); hl(c, x - 1, y + top + 1, w + 2, ST(2)); hl(c, x - 1, y + top + 2, w + 2, ST(-2))
    vl(c, x - 1, y + top + 3, 2, ST(1)); vl(c, x + w, y + top + 3, 2, ST(-2))


def _pipe_chair(c, back):
    """쇠 파이프 학교 의자: back='s' 등받이가 남쪽(북향으로 앉음) · 'n' 등받이가 북쪽(남향)."""
    if back == 'n':
        rc(c, 4, 1, 8, 3, WD(-1)); hl(c, 4, 1, 8, WD(1)); outline(c, 3, 0, 10, 5, OL)       # 등받이 판
        vl(c, 3, 5, 3, ST(2)); vl(c, 12, 5, 3, ST(-1))
        sy = 7
    else:
        sy = 3
    rc(c, 4, sy + 1, 8, 4, K('kinari', 0)); hl(c, 4, sy + 1, 8, K('kinari', 1)); vl(c, 4, sy + 1, 4, K('kinari', 1)); hl(c, 4, sy + 4, 8, WD(-1))   # 좌판(밝은 합판)
    outline(c, 3, sy, 10, 6, OL)
    if back == 's':
        rc(c, 4, sy + 6, 8, 3, WD(-2)); hl(c, 4, sy + 6, 8, WD(0)); outline(c, 3, sy + 5, 10, 5, OL)   # 등받이 뒤판
        vl(c, 3, sy + 10, 15 - sy - 10, ST(1)); vl(c, 12, sy + 10, 15 - sy - 10, ST(-2))
    else:
        vl(c, 3, sy + 6, 15 - sy - 6, ST(1)); vl(c, 12, sy + 6, 15 - sy - 6, ST(-2)); hl(c, 4, 13, 8, ST(-1))
    px(c, 3, 15, OL); px(c, 12, 15, OL)


@R.obj('sc-desk-n', '학생 책상·의자(북향)', w=1, h=1, up=0, kind='floor', surface=True, use=('sit',), facing='N', tags=('교실', '학교', '책상'),
       place='교실 바닥, 5열 × 3~4행 격자(줄 사이 1칸 통로)',
       desc='학생 책상과 의자 한 벌 — 위쪽 밝은 크림 합판 상판·쇠 틀 책상, 남쪽에 쇠 파이프 나무 의자(등받이가 남쪽). 학생은 북쪽 칠판을 본다. 상판에 교과서를 올린다.')
def _desk_n(c):
    _desk_top(c, 3, 1, 10, 4)
    rc(c, 4, 9, 8, 3, K('kinari', 0)); hl(c, 4, 9, 8, K('kinari', 1)); hl(c, 4, 11, 8, WD(-1)); outline(c, 3, 8, 10, 5, OL)      # 의자 좌판
    rc(c, 4, 13, 8, 2, WD(-2)); hl(c, 4, 13, 8, WD(0)); outline(c, 3, 12, 10, 4, OL)                           # 등받이 뒤판
    vl(c, 2, 8, 7, ST(1)); vl(c, 13, 8, 7, ST(-2))


@R.obj('sc-back-locker', '학급 사물함(교실 뒤·복도)', w=3, h=1, up=8, kind='wall', use=('open',), tags=('교실', '복도', '학교', '사물함'),
       place='교실 밖 복도 북쪽 벽(교실 벽) 바로 아래 첫 바닥 줄, 문 틈 사이에 가로로 — 남쪽 벽에는 벽면이 없어 교실 뒤 대신 복도에 둔다(廊下ロッカー)',
       desc='학급 학생들의 낮은 나무 사물함 3칸 — 문 없는 작은 칸이 6열×2단, 칸마다 가방·체육복 색 덩이, 윗면에 가방 둘. 높이 0.9m. 교실 문 사이 복도 벽에 붙인다(wall).')
def _back_locker(c):
    y = block3(c, 0, 8, 48, 24, 4, 'yuka', 0, olc=K('ita', -3), front_t=-1)
    for r in range(2):
        for k in range(6):
            x0, y0 = 2 + k * 8, y + r * 8
            rc(c, x0, y0, 7, 7, K('ita', -2)); hl(c, x0, y0, 7, K('ita', -3))
            col = ('kon', 'aka', 'sora', 'kon', 'midori', 'kii')[(k + r * 2) % 6]
            if hs(k, r, 9) % 4: rc(c, x0 + 1, y0 + 2, 5, 5, kc(col, 0)); hl(c, x0 + 1, y0 + 2, 5, kc(col, 1))
        hl(c, 1, y + r * 8 + 7, 46, WD(1))
    for x0, col in ((6, 'kon'), (30, 'yoru')):                                                          # 윗면 가방
        rc(c, x0, 4, 9, 6, kc(col, 0)); hl(c, x0, 4, 9, kc(col, 2)); outline(c, x0 - 1, 3, 11, 8, OL); hl(c, x0 + 3, 2, 3, kc(col, -1))
    hl(c, 1, 30, 46, K('ita', -3))


@R.obj('sc-notice-board', '교실 게시판', w=2, kind='hang', hrows=2, use=('read',), tags=('교실', '복도', '학교', '게시판'),
       place='교실 뒤·옆 벽면 윗줄, 또는 복도 벽',
       desc='코르크 게시판 2칸 — 갈색 판에 색종이 네모(노랑·하늘·분홍·흰) 여러 장과 빨간 압정. 종이 위엔 회색 줄뿐, 글자 없음.')
def _notice(c):
    rc(c, 0, 1, 32, 24, K('ita', -1)); outline(c, 0, 1, 32, 24, K('ita', -3)); hl(c, 1, 2, 30, K('ita', 1))
    rc(c, 2, 3, 28, 20, K('soil', 1))
    for y in range(3, 23):
        for x in range(2, 30):
            if rnd(x, y, 51, 70): px(c, x, y, K('soil', 2))
    for (x, y, w, h, col) in ((4, 5, 7, 8, 'kii'), (13, 4, 8, 6, 'shiro'), (23, 6, 5, 7, 'pinku'), (5, 15, 9, 6, 'sora'), (17, 13, 6, 8, 'shiro'), (25, 15, 4, 5, 'midori')):
        rc(c, x, y, w, h, kc(col, 1)); hl(c, x, y, w, kc(col, 2)); hl(c, x, y + h - 1, w, kc(col, -1))
        for yy in range(y + 2, y + h - 1, 2): hl(c, x + 1, yy, w - 3, K('conc', 1))
        px(c, x + w // 2, y, K('aka', 1))


@R.obj('sc-cleaning-locker', '청소 도구함', w=1, h=1, up=16, kind='wall', use=('open',), tags=('교실', '학교', '청소'),
       place='교실 뒤쪽 벽 구석',
       desc='회색 철제 청소 도구함(빗자루·대걸레를 넣는 키 큰 함) — 문 위 환기 살, 오른쪽 손잡이. 높이 1.8m. 벽 붙이.')
def _cleaning_locker(c):
    y = block3(c, 1, 2, 14, 30, 4, 'tekko', 1, front_t=0)
    for yy in range(y + 1, y + 6, 2): hl(c, 4, yy, 8, ST(-2))
    hl(c, 4, y + 1, 8, ST(-2)); vl(c, 12, y + 10, 4, ST(3)); px(c, 12, y + 14, ST(-2))
    hl(c, 2, 29, 12, ST(-2))


@R.obj('sc-classroom-door', '교실 미닫이 문(열림)', kind='door', use=('travel',), tags=('교실', '복도', '학교', '문'),
       place='교실과 복도 사이 가로 칸막이의 1칸 틈 칸(교실 앞문·뒷문)',
       desc='교실 미닫이 문 — 나무 문틀, 위 반은 유리창인 나무 문짝이 오른쪽으로 밀려 열려 있고 가운데는 통로. 바닥에 문턱 레일. 교실마다 앞·뒤 두 개.')
def _classroom_door(c):
    for x0, f in ((0, 1), (13, -1)):
        rc(c, x0, 0, 3, 32, WD(-1)); vl(c, x0 + (0 if f > 0 else 2), 0, 32, WD(1) if f > 0 else K('ita', -3)); vl(c, x0 + (2 if f > 0 else 0), 4, 28, K('ita', -3) if f > 0 else WD(0))
    rc(c, 0, 0, 16, 4, WD(0)); hl(c, 0, 0, 16, K('ita', -3)); hl(c, 0, 1, 16, WD(2)); hl(c, 0, 3, 16, K('ita', -3))
    rc(c, 8, 4, 5, 26, WD(0)); vl(c, 8, 4, 26, WD(2)); vl(c, 12, 4, 26, K('ita', -2))                    # 밀린 문짝
    rc(c, 9, 6, 3, 10, GL(1)); px(c, 9, 7, GL(3)); hl(c, 9, 16, 3, WD(-2))                             # 문짝 창
    px(c, 9, 20, ST(-1))
    rc(c, 3, 29, 10, 3, ST(1)); hl(c, 3, 29, 10, ST(3)); hl(c, 3, 30, 10, ST(-2)); hl(c, 3, 31, 10, ST(1))


@R.obj('sc-tv-stand', '교실 TV 받침', w=1, h=1, up=16, kind='floor', tags=('교실', '학교'),
       place='교실 앞 구석(칠판 옆), 교단 끝',
       desc='교실 앞 구석의 바퀴 달린 쇠 받침 위 검은 평면 TV — 화면은 어두운 유리, 아래 선반에 기기. 높이 약 1.8m.')
def _tv_stand(c):
    rc(c, 1, 2, 14, 11, K('yoru', -2)); outline(c, 0, 1, 16, 13, OL); hl(c, 1, 2, 14, K('yoru', 0))
    rc(c, 2, 3, 12, 8, GL(-2)); px(c, 3, 4, GL(1)); px(c, 4, 4, GL(0)); hl(c, 2, 11, 12, K('yoru', -1))
    vl(c, 7, 14, 10, ST(1)); vl(c, 8, 14, 10, ST(-1))
    rc(c, 3, 21, 10, 4, ST(0)); hl(c, 3, 21, 10, ST(2)); rc(c, 5, 22, 5, 2, K('yoru', -1)); px(c, 9, 22, K('midori', 2)); outline(c, 2, 20, 12, 6, ST(-3))
    hl(c, 2, 28, 12, ST(0)); hl(c, 2, 29, 12, ST(-2))
    for x in (2, 13): rc(c, x - 1, 29, 2, 2, K('yoru', -2))


# ══ 교무실 ════════════════════════════════════════════════════════════════════
@R.obj('sc-staff-desk', '교사 책상(교무실)', w=2, h=1, up=0, kind='floor', surface=True, use=('read',), tags=('교무실', '학교', '책상'),
       place='교무실 가운데 섬 — 두 줄을 등 맞대어 붙이고(북쪽 줄 의자 -s, 남쪽 줄 의자 -n) 가로로 이어 붙인다',
       desc='교무실 회색 철제 교사 책상 2칸 — 연녹 책상 매트, 왼쪽 서류 더미·책꽂이, 오른쪽 작은 모니터. 서로 마주 보는 섬으로 이어 붙인다. 윗면에 물건을 더 올린다.')
def _staff_desk(c):
    y = block3(c, 0, 0, 32, 16, 8, 'tekko', 1, front_t=0)
    rc(c, 6, 3, 14, 5, K('lino', 2)); hl(c, 6, 3, 14, K('lino', 3)); hl(c, 6, 7, 14, K('lino', 0))       # 책상 매트
    for i, col in enumerate(('kon', 'aka', 'kii', 'sora')): rc(c, 2 + i, 2, 1, 5, kc(col, 0)); px(c, 2 + i, 2, kc(col, 2))   # 책꽂이 파일
    rc(c, 22, 2, 8, 5, K('yoru', -2)); rc(c, 23, 3, 6, 3, GL(-1)); px(c, 23, 3, GL(1)); outline(c, 21, 1, 10, 7, OL); hl(c, 25, 8, 2, ST(-2))   # 모니터
    rc(c, 9, 4, 6, 3, WH(3)); hl(c, 10, 5, 4, K('conc', 2))                                             # 서류
    for x0 in (2, 18): rc(c, x0, y + 1, 12, 3, ST(1)); hl(c, x0, y + 1, 12, ST(3)); hl(c, x0 + 4, y + 2, 4, ST(-2))   # 서랍
    hl(c, 1, 14, 30, ST(-2))


def _office_chair(c, d):
    m = 'kon'
    if d == 's':                                               # 남쪽을 보고 앉음 — 등받이가 북쪽(위)
        bev(c, 4, 1, 8, 7, m, 0); hl(c, 5, 3, 6, kc(m, 2))
        bev(c, 3, 7, 10, 5, m, 1)
    else:                                                      # 북쪽을 보고 앉음 — 좌판이 위, 등받이 뒤판이 아래
        bev(c, 3, 2, 10, 5, m, 1)
        bev(c, 4, 6, 8, 6, m, -1); hl(c, 5, 7, 6, kc(m, 0))
    vl(c, 7, 12, 2, ST(1)); vl(c, 8, 12, 2, ST(-1))
    hl(c, 3, 14, 10, ST(0)); px(c, 2, 15, K('yoru', -2)); px(c, 13, 15, K('yoru', -2)); px(c, 7, 15, K('yoru', -2))


@R.obj('sc-staff-chair-s', '교무실 의자(남향)', w=1, h=1, up=0, kind='floor', use=('sit',), facing='S', tags=('교무실', '학교'),
       place='교사 책상 섬 북쪽 줄 책상의 북쪽 칸', desc='남색 천 사무 의자 — 등받이가 북쪽, 남쪽 책상을 보고 앉는다. 다리 다섯 갈래 바퀴.')
def _sc_chair_s(c): _office_chair(c, 's')


@R.obj('sc-staff-chair-n', '교무실 의자(북향)', w=1, h=1, up=0, kind='floor', use=('sit',), facing='N', tags=('교무실', '학교'),
       place='교사 책상 섬 남쪽 줄 책상의 남쪽 칸', desc='남색 천 사무 의자 — 등받이 뒤판이 남쪽, 북쪽 책상을 보고 앉는다. 다리 다섯 갈래 바퀴.')
def _sc_chair_n(c): _office_chair(c, 'n')


@R.obj('sc-whiteboard', '일정 화이트보드', w=2, kind='hang', hrows=2, use=('read',), tags=('교무실', '학교'),
       place='교무실 북쪽 벽면 윗줄',
       desc='교무실 행사 일정 화이트보드 2칸 — 알루미늄 틀, 검정·빨강 마커 격자 칸(달력 모양)과 색 자석. 글자·숫자 없이 선과 점뿐. 아래 마커 받침.')
def _whiteboard(c):
    rc(c, 0, 1, 32, 23, ST(1)); outline(c, 0, 1, 32, 23, ST(-3)); hl(c, 1, 2, 30, ST(3))
    rc(c, 2, 3, 28, 19, WH(3))
    for x in range(2, 30, 4): vl(c, x, 6, 16, K('conc', 2))
    for y in (6, 11, 16, 21): hl(c, 2, y, 28, K('conc', 2))
    hl(c, 2, 4, 28, K('kon', 1)); hl(c, 2, 5, 28, K('kon', 1))
    for (x, y, col) in ((4, 8, 'aka'), (12, 13, 'sora'), (20, 8, 'kii'), (24, 18, 'aka'), (8, 18, 'midori')):
        rc(c, x, y, 2, 2, kc(col, 1)); px(c, x, y, kc(col, 2))
    hl(c, 5, 9, 5, K('aka', 1)); hl(c, 17, 14, 6, K('kon', 1))
    rc(c, 3, 24, 26, 2, ST(1)); hl(c, 3, 25, 26, ST(-2)); hl(c, 8, 24, 3, K('aka', 1)); hl(c, 12, 24, 3, K('kon', 1))


@R.obj('sc-key-box', '열쇠함', w=1, kind='hang', hrows=2, use=('open',), tags=('교무실', '학교'),
       place='교무실 벽면 윗줄(문 가까이)',
       desc='교무실 벽의 열린 철제 열쇠함 — 안에 고리 3단, 열쇠마다 색 꼬리표. 교실·특별교실 열쇠.')
def _key_box(c):
    rc(c, 2, 3, 12, 18, ST(1)); outline(c, 1, 2, 14, 20, ST(-3)); hl(c, 2, 3, 12, ST(3))
    rc(c, 3, 5, 10, 15, ST(-2))
    for r in range(3):
        y = 6 + r * 5
        hl(c, 3, y, 10, ST(0))
        for k in range(4):
            x = 4 + k * 2 + (r % 2)
            px(c, x, y + 1, K('kii', 2)); px(c, x, y + 2, kc(('aka', 'sora', 'midori', 'shiro')[(k + r) % 4], 1))


@R.obj('sc-copy-machine', '복사기', w=1, h=1, up=8, kind='floor', use=('search',), tags=('교무실', '학교'),
       place='교무실 구석이나 벽 옆',
       desc='교무실 복합 복사기 — 연회색 몸통, 위 원고 덮개, 앞 조작판(색 점 단추), 아래 용지 서랍 두 단. 높이 약 1.1m.')
def _copier(c):
    y = block3(c, 0, 6, 16, 26, 5, 'conc', 2, front_t=1)
    rc(c, 3, 8, 10, 3, K('conc', 0)); hl(c, 3, 8, 10, K('conc', 1))
    rc(c, 10, 10, 4, 2, K('yoru', -1)); px(c, 11, 10, K('midori', 3)); px(c, 13, 11, K('aka', 1))
    for yy in (y + 4, y + 10): rc(c, 2, yy, 12, 4, K('conc', 1)); hl(c, 2, yy, 12, K('conc', 3)); hl(c, 5, yy + 2, 6, K('conc', -1))
    hl(c, 1, 30, 14, K('conc', -2))


@R.obj('sc-tea-shelf', '교무실 차 선반', w=1, h=1, up=16, kind='wall', use=('search',), tags=('교무실', '학교'),
       place='교무실 벽 구석',
       desc='교무실 차 선반 — 나무 찬장 위에 흰 전기 포트와 찻잔, 유리문 안에 찻잔·찻통이 줄지어 있다. 벽 붙이.')
def _tea_shelf(c):
    y = block3(c, 0, 10, 16, 22, 4, 'yuka', 0, olc=K('ita', -3), front_t=-1)
    rc(c, 2, y, 12, 8, GL(-1)); outline(c, 1, y - 1, 14, 10, K('ita', -2))
    for k in range(4): rc(c, 3 + k * 3, y + 4, 2, 3, WH(3) if k % 2 else K('midori', 1))
    hl(c, 2, y + 3, 12, GL(1))
    hl(c, 1, 30, 14, K('ita', -3))
    rc(c, 3, 3, 5, 9, WH(2)); hl(c, 3, 3, 5, WH(4)); vl(c, 3, 3, 9, WH(4)); outline(c, 2, 2, 7, 11, K('conc', -1)); px(c, 9, 6, WH(1))   # 포트
    rc(c, 10, 9, 3, 3, WH(3)); outline(c, 9, 8, 5, 5, K('conc', 0))                                     # 찻잔


# ══ 보건실 ════════════════════════════════════════════════════════════════════
@R.obj('sc-nurse-bed', '보건실 침대', w=1, h=2, up=8, kind='floor', use=('sleep',), tags=('보건실', '학교', '침대'),
       place='보건실 북쪽, 침대끼리 커튼 칸막이를 사이에 두고',
       desc='보건실 1인 침대 1×2 — 흰 쇠 파이프 머리판(북쪽), 흰 베개·흰 시트, 하늘색 담요. 쉬는 학생용.')
def _nurse_bed(c):
    rc(c, 1, 0, 14, 2, WH(2)); hl(c, 1, 0, 14, WH(4)); outline(c, 0, 0, 16, 11, K('conc', -1))
    for x in (1, 14): rc(c, x, 0, 1, 12, WH(1))
    for x in (4, 7, 10): vl(c, x, 2, 8, WH(1))
    rc(c, 1, 9, 14, 37, WH(2)); outline(c, 0, 9, 16, 37, K('conc', -1)); vl(c, 1, 10, 35, WH(4))
    rc(c, 3, 11, 10, 6, WH(4)); hl(c, 3, 16, 10, WH(1)); outline(c, 2, 10, 12, 8, K('conc', 1))       # 베개
    rc(c, 1, 22, 14, 21, K('sora', 3)); hl(c, 1, 22, 14, K('sora', 4)); hl(c, 1, 23, 14, WH(4))       # 담요 + 접힌 시트
    for y in (28, 34, 39): hl(c, 2, y, 12, K('sora', 2))
    rc(c, 1, 43, 14, 2, K('conc', 1)); hl(c, 1, 45, 14, K('conc', -2))
    rc(c, 1, 46, 2, 2, ST(0)); rc(c, 13, 46, 2, 2, ST(-1))


@R.obj('sc-curtain', '보건실 커튼 칸막이', w=1, h=1, up=16, kind='floor', tags=('보건실', '학교'),
       place='보건실 침대와 침대 사이, 또는 침대 남쪽',
       desc='침대 사이를 가리는 연녹 천 커튼 칸막이 — 위 쇠 레일, 세로 주름, 아래 바퀴 받침. 높이 1.8m.')
def _curtain(c):
    rc(c, 0, 1, 16, 2, ST(1)); hl(c, 0, 1, 16, ST(3)); hl(c, 0, 3, 16, ST(-2))
    rc(c, 1, 4, 14, 24, K('lino', 3))
    for x in range(1, 15, 3): vl(c, x, 4, 24, K('lino', 4)); vl(c, x + 2, 4, 24, K('lino', 2))
    hl(c, 1, 27, 14, K('lino', 1)); outline(c, 0, 3, 16, 26, K('lino', -1))
    vl(c, 1, 29, 2, ST(0)); vl(c, 14, 29, 2, ST(-1)); hl(c, 0, 31, 16, K('yoru', -2))


@R.obj('sc-med-shelf', '약품장(보건실)', w=1, h=1, up=16, kind='wall', use=('search',), tags=('보건실', '학교'),
       place='보건실 북쪽 벽 아래',
       desc='흰 칠 약품장 — 위 유리문 안에 약병·구급 상자(색 덩이), 아래 닫힌 문 두 짝. 높이 1.8m. 벽 붙이.')
def _med_shelf(c):
    y = block3(c, 0, 2, 16, 30, 4, 'shiro', 1, olc=K('conc', -2), front_t=0)
    rc(c, 2, y, 12, 12, GL(0)); outline(c, 1, y - 1, 14, 14, K('conc', 0))
    for r in range(2):
        yy = y + 1 + r * 6
        for k in range(4):
            col = ('shiro', 'daidai', 'sora', 'aka')[(k + r) % 4]
            rc(c, 3 + k * 3, yy + 1, 2, 4, kc(col, 1)); px(c, 3 + k * 3, yy, kc(col, 2))
        hl(c, 2, yy + 5, 12, GL(2))
    vl(c, 3, y, 12, GL(2))
    for x0 in (2, 8): rc(c, x0, y + 14, 6, 9, WH(1)); hl(c, x0, y + 14, 6, WH(3)); px(c, x0 + (4 if x0 == 2 else 1), y + 18, ST(1))
    hl(c, 1, 30, 14, K('conc', -2))


@R.obj('sc-scale', '체중계(보건실)', w=1, h=1, up=16, kind='floor', tags=('보건실', '학교'),
       place='보건실 구석',
       desc='보건실 체중계 — 흰 발판 위에 가는 기둥, 맨 위 작은 표시창(녹색 빛 덩이, 숫자 없음). 신체검사용.')
def _scale(c):
    rc(c, 4, 2, 8, 6, ST(0)); outline(c, 3, 1, 10, 8, ST(-3)); rc(c, 5, 3, 6, 3, K('kokuban', -1)); hl(c, 6, 4, 4, K('midori', 3))
    vl(c, 7, 9, 15, ST(2)); vl(c, 8, 9, 15, ST(-1))
    rc(c, 1, 23, 14, 6, WH(2)); hl(c, 1, 23, 14, WH(4)); vl(c, 1, 23, 6, WH(4)); hl(c, 1, 28, 14, K('conc', 0))
    rc(c, 4, 25, 8, 2, K('conc', 2))
    rc(c, 1, 29, 14, 2, K('conc', -1)); outline(c, 0, 22, 16, 10, K('conc', -2))


@R.obj('sc-sink', '세면대(학교)', w=1, h=1, up=16, kind='wall', use=('search',), tags=('보건실', '이과실', '학교'),
       place='보건실·이과실 북쪽 벽 아래(타일 벽 앞)',
       desc='벽 붙이 흰 도기 세면대 — 위 벽에 작은 거울, 은색 수도꼭지, 아래 배수관과 받침. 손 씻는 곳.')
def _sink(c):
    rc(c, 3, 1, 10, 9, GL(2)); outline(c, 2, 0, 12, 11, ST(0)); px(c, 4, 2, WH(4)); px(c, 5, 3, GL(4))
    rc(c, 7, 12, 2, 3, ST(2)); px(c, 7, 12, ST(3)); hl(c, 6, 12, 4, ST(1))
    rc(c, 1, 15, 14, 7, WH(3)); outline(c, 0, 14, 16, 9, K('conc', -1)); hl(c, 1, 15, 14, WH(4))
    rc(c, 3, 16, 10, 4, WH(1)); hl(c, 3, 16, 10, K('conc', 2)); px(c, 8, 18, K('conc', 0))             # 대야 안
    hl(c, 1, 21, 14, K('conc', 1))
    vl(c, 7, 23, 6, ST(1)); vl(c, 8, 23, 6, ST(-1)); hl(c, 5, 29, 6, ST(-2))


# ══ 음악실 ════════════════════════════════════════════════════════════════════
@R.obj('sc-piano', '그랜드 피아노', w=2, h=2, up=8, kind='floor', use=('search',), tags=('음악실', '학교', '피아노'),
       place='음악실 앞(북쪽) 한쪽 — 건반이 남쪽, 학생 의자들이 바라본다',
       desc='음악실 검은 그랜드 피아노 2×2 — 위에서 본 날개 모양 뚜껑(오른쪽 위가 둥글다), 남쪽에 흰·검은 건반, 다리 셋과 페달. 덮개 위 하이라이트.')
def _piano(c):
    W = 32
    for y in range(3, 37):                                               # 몸통 윗면(오른쪽 위 둥근 꼬리)
        t = (y - 3) / 33
        xr = 30 if y > 18 else int(round(13 + 17 * math.sqrt(max(0, 1 - ((18 - y) / 15.5) ** 2))))
        for x in range(2, xr + 1): px(c, x, y, K('yoru', -2) if (x + y) % 9 else K('yoru', -1))
        px(c, 1, y, OL); px(c, xr + 1, y, OL)
        if xr >= 3: px(c, 2, y, K('yoru', 1))
    for x in range(2, 14): px(c, x, 2, OL)
    for y in range(3, 19):
        xr = int(round(13 + 17 * math.sqrt(max(0, 1 - ((18 - y) / 15.5) ** 2))))
        px(c, xr, y, K('yoru', 1))
    for i in range(10): px(c, 6 + i, 8 + i, K('yoru', 1))                   # 뚜껑 반사
    for i in range(6): px(c, 20 + i, 24 - i // 2, K('yoru', 0))
    rc(c, 1, 37, 30, 2, K('yoru', 0)); hl(c, 1, 37, 30, K('yoru', 2))      # 건반 뚜껑 가장자리
    rc(c, 2, 39, 28, 4, WH(4)); hl(c, 2, 42, 28, WH(1))
    for x in range(3, 30, 2): vl(c, x, 39, 3, K('conc', 1))
    for x in (4, 6, 10, 12, 14, 18, 20, 24, 26, 28): vl(c, x, 39, 2, K('sumi', 0))   # 검은 건반
    outline(c, 1, 38, 30, 6, OL)
    rc(c, 2, 44, 2, 4, K('yoru', -1)); rc(c, 27, 44, 2, 4, K('yoru', -1)); rc(c, 14, 44, 4, 2, K('kii', 2))   # 다리·페달
    hl(c, 2, 47, 2, OL); hl(c, 27, 47, 2, OL)


@R.obj('sc-music-stand', '보면대', w=1, h=1, up=16, kind='floor', tags=('음악실', '학교'),
       place='음악실 앞, 피아노 옆이나 의자 줄 앞',
       desc='검은 쇠 보면대 — 기울어진 악보 받침판(위에 흰 악보 한 장, 음표 없이 회색 줄), 가는 기둥, 세 갈래 다리.')
def _music_stand(c):
    rc(c, 2, 3, 12, 9, K('yoru', -1)); outline(c, 1, 2, 14, 11, OL); hl(c, 2, 3, 12, K('yoru', 1))
    rc(c, 4, 4, 8, 6, WH(3)); hl(c, 5, 6, 6, K('conc', 1)); hl(c, 5, 8, 6, K('conc', 1))
    rc(c, 2, 12, 12, 1, K('yoru', 0))
    vl(c, 7, 13, 14, K('yoru', 1)); vl(c, 8, 13, 14, K('yoru', -2))
    for i in range(4): px(c, 7 - i, 27 + i, K('yoru', 0)); px(c, 8 + i, 27 + i, K('yoru', -1))
    vl(c, 7, 27, 4, K('yoru', 0))


@R.obj('sc-chair-s', '학교 나무 의자(남향)', w=1, h=1, up=0, kind='floor', use=('sit',), facing='S', tags=('도서실', '교실', '학교', '의자'),
       place='열람 탁자·책상의 북쪽 칸', desc='쇠 파이프 학교 의자 — 북쪽에 나무 등받이, 아래 나무 좌판. 남쪽 탁자를 보고 앉는다.')
def _chair_s(c): _pipe_chair(c, 'n')


@R.obj('sc-music-chair-n', '음악실 의자(북향)', w=1, h=1, up=0, kind='floor', use=('sit',), facing='N', tags=('음악실', '도서실', '학교', '의자'),
       place='음악실 바닥 줄지어(피아노·칠판을 보게)',
       desc='쇠 파이프 학교 의자 — 나무 좌판, 남쪽에 등받이 뒤판. 북쪽(피아노·칠판)을 보고 앉는다.')
def _music_chair(c): _pipe_chair(c, 's')


@R.obj('sc-instrument-shelf', '악기 선반', w=2, h=1, up=16, kind='wall', use=('search',), tags=('음악실', '학교'),
       place='음악실 뒤·옆 벽 아래',
       desc='음악실 나무 악기 선반 2칸 — 위 칸에 작은북(흰 가죽·빨간 몸통)과 탬버린, 아래 칸에 실로폰(색 건반)과 악기 상자. 벽 붙이.')
def _instrument_shelf(c):
    y = block3(c, 0, 2, 32, 30, 4, 'yuka', 0, olc=K('ita', -3), front_t=-1)
    for yy in (y, y + 12):
        rc(c, 2, yy, 28, 10, K('ita', -2)); hl(c, 2, yy, 28, K('ita', -3)); hl(c, 1, yy + 10, 30, WD(1))
    disc(c, 8, y + 4, 4.5, 2, WH(3)); rc(c, 4, y + 4, 9, 5, K('aka', 1)); hl(c, 4, y + 8, 9, K('aka', -1))   # 작은북
    disc(c, 8, y + 3.5, 4.2, 1.6, WH(4)); vl(c, 6, y + 5, 3, K('kii', 3)); vl(c, 10, y + 5, 3, K('kii', 3))
    disc(c, 20, y + 6, 4, 3, K('soil', 2)); disc(c, 20, y + 6, 2.6, 1.8, K('kinari', 2))                 # 탬버린
    for a in range(0, 360, 60): px(c, int(20 + 4 * math.cos(math.radians(a))), int(y + 6 + 3 * math.sin(math.radians(a))), K('kii', 3))
    for k, col in enumerate(('aka', 'daidai', 'kii', 'midori', 'sora', 'kon', 'murasaki')):              # 실로폰
        rc(c, 3 + k * 2, y + 14, 2, 6 - k // 2, kc(col, 1)); px(c, 3 + k * 2, y + 14, kc(col, 2))
    rc(c, 19, y + 15, 10, 6, K('yoru', -1)); hl(c, 19, y + 15, 10, K('yoru', 1)); px(c, 24, y + 17, K('kii', 2))   # 악기 상자
    hl(c, 1, 30, 30, K('ita', -3))


# ══ 도서실 ════════════════════════════════════════════════════════════════════
def _books(c, x, y, w, h, seed):
    cols = ('aka', 'kon', 'midori', 'kii', 'sora', 'daidai', 'shiro', 'murasaki', 'soil')
    xx = x
    while xx < x + w:
        bw = 1 + hs(xx, y, seed) % 2
        hh = h - hs(xx, y, seed + 1) % 2
        col = cols[hs(xx, y, seed + 2) % len(cols)]
        rc(c, xx, y + h - hh, bw, hh, kc(col, 0)); px(c, xx, y + h - hh, kc(col, 2))
        if bw == 2: vl(c, xx + 1, y + h - hh + 1, hh - 1, kc(col, -1))
        xx += bw


@R.obj('sc-bookshelf', '도서실 벽 서가', w=2, h=1, up=16, kind='wall', use=('read',), tags=('도서실', '학교', '책장'),
       place='도서실 북쪽 벽 아래, 가로로 이어 붙인다',
       desc='도서실 키 큰 나무 벽 서가 2칸 — 4단에 색색 책등이 빼곡하다(글자 없음). 높이 1.8m. 가로로 이어 붙인다.')
def _bookshelf(c):
    y = block3(c, 0, 2, 32, 30, 4, 'ita', 1, front_t=0)
    for r in range(4):
        yy = y + r * 6
        rc(c, 2, yy, 28, 5, K('ita', -2))
        _books(c, 2, yy, 28, 5, r + 1)
        hl(c, 1, yy + 5, 30, K('ita', 2))
    vl(c, 15, y, 24, K('ita', -2)); vl(c, 16, y, 24, K('ita', 2))
    hl(c, 1, 30, 30, K('ita', -3))


@R.obj('sc-book-island', '양면 낮은 서가', w=2, h=1, up=8, kind='floor', use=('read',), tags=('도서실', '학교', '책장'),
       place='도서실 가운데, 열람 탁자와 2줄 통로를 두고',
       desc='도서실 가운데 양면 낮은 서가 2칸 — 높이 1.2m, 윗면 나무판, 앞면 두 단에 책등. 섬처럼 바닥에 선다.')
def _book_island(c):
    y = block3(c, 0, 6, 32, 26, 5, 'yuka', 0, olc=K('ita', -3), front_t=-1)
    for r in range(2):
        yy = y + r * 8
        rc(c, 2, yy, 28, 7, K('ita', -2)); _books(c, 2, yy + 1, 28, 6, r + 7)
        hl(c, 1, yy + 7, 30, WD(1))
    hl(c, 1, 30, 30, K('ita', -3))


@R.table('sc-reading-table', '도서실 열람 탁자', desc='도서실 밝은 나무 열람 탁자 — 넓은 윗면(가장자리 밝은 테), 남쪽 앞판과 다리. 어떤 w×h 로도 이어 붙는다. 윗면에 책·지구본을 올린다.',
         tags=('도서실', '학교'))
def _reading_table(c, w, h):
    W, H = w * 16, h * 16
    rc(c, 0, 0, W, H, WD(1))
    for y in range(2, H - 5, 4): hl(c, 1, y, W - 2, WD(1) if y % 8 else WD(0))
    hl(c, 0, 0, W, WD(2)); hl(c, 0, 1, W, WD(2)); vl(c, 0, 0, H, WD(2))
    hl(c, 0, H - 5, W, WD(2))
    rc(c, 0, H - 4, W, 3, WD(-1)); hl(c, 0, H - 4, W, K('ita', -2))
    for x in (1, W - 3): rc(c, x, H - 2, 2, 2, K('ita', -1))
    outline(c, 0, 0, W, H - 1, K('ita', -3))


@R.obj('sc-lib-counter', '대출 카운터', w=1, h=1, up=0, kind='floor', surface=True, use=('counter',), tags=('도서실', '학교'),
       place='도서실 입구 옆, 이어 붙여 2~3칸',
       desc='도서실 대출 카운터 — 나무 윗면, 앞에 남색 앞판(세로 홈). 윗면에 대출 장부·책을 올린다. 앞에 손님 자리 2줄.')
def _lib_counter(c):
    y = block3(c, 0, 0, 16, 16, 6, 'yuka', 0, olc=K('ita', -3), front_t=-1)
    rc(c, 1, y, 14, 15 - y, K('kon', 1)); hl(c, 1, y, 14, K('kon', 0)); vl(c, 5, y + 1, 14 - y, K('kon', 0)); vl(c, 10, y + 1, 14 - y, K('kon', 0))
    hl(c, 1, 14, 14, K('kon', -1))


# ══ 이과실 ════════════════════════════════════════════════════════════════════
@R.obj('sc-lab-bench', '실험대', w=2, h=1, up=0, kind='floor', surface=True, use=('search',), tags=('이과실', '학교'),
       place='이과실 가운데, 2줄 통로를 두고 남북으로 줄지어(둘레에 둥근 의자)',
       desc='이과실 실험대 2칸 — 검은 내약품 상판(밝은 테), 오른쪽에 회색 개수대와 학 모양 수도꼭지, 앞면 나무 수납. 왼쪽 칸에 플라스크를 올린다.')
def _lab_bench(c):
    y = block3(c, 0, 0, 32, 16, 8, 'yoru', -1, olc=OL, front_t=None)
    rc(c, 1, 1, 30, 8, K('yoru', -2)); hl(c, 1, 1, 30, K('yoru', 1)); vl(c, 1, 1, 8, K('yoru', 1)); hl(c, 1, 9, 30, K('yoru', 1))
    rc(c, 20, 3, 9, 5, ST(0)); hl(c, 20, 3, 9, ST(-2)); hl(c, 20, 7, 9, ST(2)); px(c, 24, 5, K('yoru', -2))   # 개수대
    vl(c, 18, 2, 4, ST(2)); hl(c, 18, 2, 4, ST(3)); px(c, 21, 3, ST(1))                                  # 수도꼭지
    rc(c, 1, y, 30, 15 - y, WD(-1))
    vl(c, 15, y, 15 - y, K('ita', -2)); vl(c, 16, y, 15 - y, WD(1))
    px(c, 12, y + 1, ST(2)); px(c, 19, y + 1, ST(2)); hl(c, 1, 14, 30, K('ita', -3))


@R.obj('sc-lab-stool', '둥근 의자(이과실)', w=1, h=1, up=0, kind='floor', use=('sit',), tags=('이과실', '학교', '의자'),
       place='실험대 둘레(북·남쪽 칸)',
       desc='이과실 나무 둥근 의자 — 위에서 보이는 둥근 좌판(밝은 테), 다리 네 개와 가로대. 등받이 없음.')
def _lab_stool(c):
    disc(c, 8, 6, 5.5, 3.5, K('ita', -3)); disc(c, 8, 5.7, 4.6, 2.7, WD(1)); disc(c, 7, 5, 2.5, 1.3, WD(2))
    for x, col in ((4, WD(0)), (11, WD(-2))): vl(c, x, 9, 6, col)
    for x in (6, 9): vl(c, x, 10, 5, WD(-1))
    hl(c, 4, 12, 8, WD(-1)); hl(c, 3, 15, 10, K('ita', -3))


@R.obj('sc-specimen-case', '표본장', w=1, h=1, up=16, kind='wall', use=('search',), tags=('이과실', '학교'),
       place='이과실 북쪽 벽 아래',
       desc='이과실 나무 틀 유리문 표본장 — 안에 병(노랑·녹색 액체)·광물 덩이·조개껍데기가 3단으로 놓였다. 인체 모형·뼈 없음. 높이 1.8m.')
def _specimen(c):
    y = block3(c, 0, 2, 16, 30, 4, 'ita', 0, front_t=-1)
    rc(c, 2, y, 12, 22, GL(-1)); outline(c, 1, y - 1, 14, 24, K('ita', -3))
    for r in range(3):
        yy = y + 1 + r * 7
        if r == 0:
            for k, col in enumerate(('kii', 'midori', 'kii')): rc(c, 3 + k * 4, yy + 2, 3, 4, kc(col, 1)); rc(c, 3 + k * 4, yy + 1, 3, 1, WH(2)); px(c, 3 + k * 4, yy + 3, kc(col, 2))
        elif r == 1:
            for k, col in enumerate(('conc', 'murasaki', 'soil')): rc(c, 3 + k * 4, yy + 3, 3, 3, kc(col, 1)); px(c, 3 + k * 4, yy + 3, kc(col, 2))
        else:
            disc(c, 6, yy + 4, 2.5, 1.8, K('pinku', 2)); disc(c, 11, yy + 4, 2.2, 1.6, WH(3)); px(c, 11, yy + 4, K('conc', 1))
        hl(c, 2, yy + 6, 12, GL(1))
    vl(c, 7, y, 22, K('ita', -2)); vl(c, 3, y, 6, GL(2))
    hl(c, 1, 30, 14, K('ita', -3))


@R.obj('sc-fume-hood', '드래프트(배기 실험대)', w=1, h=1, up=16, kind='wall', tags=('이과실', '학교'),
       place='이과실 북쪽 벽 아래 구석',
       desc='이과실 흰 드래프트 — 위 배기 덕트 띠, 가운데 반쯤 올린 유리 새시 안 어두운 작업 공간(작은 비커), 아래 수납장. 높이 1.8m.')
def _fume_hood(c):
    y = block3(c, 0, 2, 16, 30, 4, 'shiro', 1, olc=K('conc', -2), front_t=0)
    rc(c, 2, y, 12, 3, K('conc', 2))
    for x in range(3, 13, 2): px(c, x, y + 1, K('conc', 0))
    rc(c, 2, y + 4, 12, 10, K('yoru', -1)); outline(c, 1, y + 3, 14, 12, K('conc', 0))
    rc(c, 2, y + 4, 12, 4, GL(1)); hl(c, 2, y + 8, 12, ST(2)); px(c, 3, y + 5, GL(3))
    rc(c, 9, y + 10, 3, 3, GL(2)); hl(c, 9, y + 12, 3, K('midori', 2))
    hl(c, 2, y + 14, 12, ST(1))
    rc(c, 2, y + 16, 12, 6, WH(1)); hl(c, 2, y + 16, 12, WH(3)); vl(c, 8, y + 16, 6, K('conc', 1))
    hl(c, 1, 30, 14, K('conc', -2))


# ══ 화장실 ════════════════════════════════════════════════════════════════════
@R.obj('sc-urinal', '학교 소변기', w=1, h=1, up=8, kind='wall', tags=('화장실', '학교'),
       place='학교 화장실 북쪽 벽 아래, 가로로 줄지어',
       desc='벽에 붙은 흰 도기 소변기 — 위 은색 물 내림 관, 길쭉한 몸통과 안쪽 그늘, 아래 배수 받침. 가로로 이어 놓는다.')
def _urinal(c):
    vl(c, 7, 0, 7, ST(2)); vl(c, 8, 0, 7, ST(-1)); rc(c, 6, 5, 4, 2, ST(1))
    rc(c, 3, 8, 10, 17, WH(3)); outline(c, 2, 7, 12, 19, K('conc', -1)); vl(c, 3, 8, 17, WH(4))
    rc(c, 5, 11, 6, 11, WH(1)); hl(c, 5, 11, 6, K('conc', 2)); vl(c, 10, 12, 10, K('conc', 1)); px(c, 8, 20, K('conc', 0))
    rc(c, 5, 26, 6, 3, K('conc', 1)); hl(c, 5, 26, 6, K('conc', 3)); outline(c, 4, 25, 8, 5, K('conc', -2))


# ══ 계단 ══════════════════════════════════════════════════════════════════════
def _conc_stairs(c, w):
    """북쪽 벽으로 올라가는 콘크리트 계단(나무 계단 _stairs 와 같은 짜임). 디딤판 밝은 회색 + 앞 끝 어두운 미끄럼 방지 줄,
    왼쪽 벽 쇠 손잡이, 오른쪽 트인 쪽 쇠 난간."""
    pw = w * 16
    R0 = pw - 5
    c.R(0, 0, pw, 48, OL)
    c.R(1, 0, pw - 2, 5, K('yoru', -2)); c.R(1, 4, pw - 2, 2, K('yoru', 0))
    tx, tw = 3, R0 - 3
    for i in range(8):
        yb = 46 - 5 * i
        dim = 1 if i >= 6 else 0
        c.R(tx, yb - 4, tw, 2, K('conc', 2 - dim)); c.HL(tx, yb - 4, tw, K('conc', 3 - dim))
        c.HL(tx, yb - 2, tw, K('yoru', 0))                                     # 미끄럼 방지 줄
        c.R(tx, yb - 1, tw, 2, K('conc', -1)); c.HL(tx, yb + 1, tw, K('conc', -3))
    c.R(1, 6, 2, 41, K('conc', -1)); c.VL(2, 6, 41, K('conc', 0)); c.VL(1, 8, 34, ST(2))
    for y in (14, 26, 38): c.P(2, y, ST(0))
    NT = 30
    c.R(R0, 6, 1, NT - 6, K('conc', -2))
    for y in range(8, NT - 1, 4): c.R(R0 + 1, y, 2, 1, ST(1))                 # 난간 살
    c.R(R0 + 1, 6, 1, NT - 6, ST(-1))
    c.R(R0 + 3, 6, 1, NT - 6, ST(2)); c.P(R0 + 3, 6, ST(3))                    # 손잡이 쇠파이프
    c.R(R0, NT, 5, 2, OL); c.R(R0 + 1, NT, 3, 1, ST(3))
    c.R(R0 + 1, NT + 2, 3, 47 - NT - 2, K('conc', 1)); c.VL(R0 + 1, NT + 2, 47 - NT - 2, K('conc', 3)); c.VL(R0 + 3, NT + 2, 47 - NT - 2, K('conc', -2))
    c.R(R0, NT + 2, 1, 47 - NT - 2, OL); c.R(pw - 1, 0, 1, 48, OL); c.HL(0, 47, pw, OL)


@R.obj('sc-stairs-up', '학교 콘크리트 계단(위)', w=2, h=1, up=32, kind='wall', walk=[(0, 0), (1, 0)], stairs='up', use=('travel',),
       tags=('계단', '학교', '階段'),
       place='복도 북쪽 벽 바로 아래(벽 가구 자리) — 위층 계단통과 같은 x',
       desc='학교 2칸 폭 콘크리트 계단 — 북쪽 벽 속으로 오르는 밝은 회색 디딤판, 단마다 앞 끝 어두운 미끄럼 방지 줄. 왼쪽 벽 쇠 손잡이, 오른쪽 쇠 난간과 아래 기둥. 발칸 두 칸에서 위층으로 이동.')
def _sc_stairs(c): _conc_stairs(c, 2)


@R.obj('sc-stairwell-down', '학교 내려가는 계단통(쇠 난간)', w=2, h=2, up=16, kind='floor', use=('travel',), stairs='down', walk=((0, 1), (1, 1)),
       tags=('계단', '학교', '階段', '난간'),
       place='위층 복도 한쪽 — 아래층 올라가는 계단과 같은 x',
       desc='위층 바닥에 뚫린 내려가는 콘크리트 계단통 2×2 — 북·동·서는 쇠 난간, 남쪽이 열린 입구. 윗줄 난간은 막히고 아랫줄 두 칸은 밟는다 — 그 칸에 아래층으로 가는 이동.')
def _sc_well(c):
    c.R(1, 18, 30, 29, OL)
    c.R(3, 20, 26, 24, K('yoru', -2))
    for i in range(6):
        y = 22 + i * 4
        t = 2 - i
        c.R(4, y, 24, 2, K('conc', t)); c.HL(4, y, 24, K('conc', t + 1)); c.HL(4, y + 1, 24, K('yoru', 0) if i < 4 else K('yoru', -1))
        c.R(4, y + 2, 24, 2, K('yoru', -2))
    c.R(1, 44, 30, 3, K('conc', 1)); c.HL(1, 44, 30, K('conc', 3)); c.HL(1, 46, 30, K('conc', -2)); c.HL(1, 47, 30, K('conc', -3))
    c.R(2, 16, 28, 2, ST(2)); c.HL(2, 16, 28, ST(3)); c.HL(2, 18, 28, ST(-2))         # 북쪽 쇠 난간
    for x in (6, 11, 16, 21, 26): c.R(x, 18, 1, 3, ST(0))
    for x in (1, 29):
        c.R(x, 18, 2, 26, K('conc', 0)); c.VL(x, 18, 26, K('conc', 2))
        c.R(x, 5, 2, 40, ST(-2)); c.VL(x, 6, 38, ST(1))
        c.R(x, 4, 2, 2, ST(3))
        for y in range(9, 40, 6): c.P(x + (1 if x == 1 else 0), y, ST(2))


# ══ 옥상 ══════════════════════════════════════════════════════════════════════
def _mesh(c, x0, x1, y0, y1):
    for y in range(y0, y1):
        for x in range(x0, x1):
            if (x + y) % 4 == 0 or (x - y) % 4 == 0: px(c, x, y, ST(1) if (x + y) % 8 else ST(0))


@R.obj('sc-roof-fence', '옥상 철망 펜스', w=1, h=1, up=16, kind='floor', tags=('옥상', '학교', '펜스'),
       place='옥상 둘레 남쪽·북쪽 가장자리, 가로로 이어 붙인다',
       desc='옥상 둘레의 높은 철망 펜스(2m) — 위·아래 쇠 가로대와 기둥 사이 마름모 철망, 철망 사이로 뒤가 보인다. 가로로 이어 붙인다.')
def _roof_fence(c):
    _mesh(c, 0, 16, 3, 30)
    hl(c, 0, 1, 16, ST(3)); hl(c, 0, 2, 16, ST(0)); hl(c, 0, 29, 16, ST(2)); hl(c, 0, 30, 16, ST(-2))
    vl(c, 0, 0, 32, ST(2)); vl(c, 1, 0, 32, ST(-2)); px(c, 0, 0, ST(3)); hl(c, 0, 31, 3, K('yoru', -2))


@R.obj('sc-roof-fence-side', '옥상 철망 펜스(옆 줄)', w=1, h=1, up=16, kind='floor', tags=('옥상', '학교', '펜스'),
       place='옥상 동쪽·서쪽 가장자리, 세로로 이어 붙인다',
       desc='옆에서 본 옥상 철망 펜스 — 칸 가운데 세로 쇠 기둥과 얇게 보이는 철망 띠. 동·서 가장자리에 세로로 이어 붙여 둘레를 막는다.')
def _roof_fence_side(c):
    for y in range(0, 32):
        if y % 3 == 0: px(c, 7, y, ST(1)); px(c, 9, y, ST(0))
        else: px(c, 8, y, ST(0) if y % 2 else ST(1))
    rc(c, 6, 0, 4, 2, ST(3)); rc(c, 6, 14, 4, 2, ST(2)); hl(c, 6, 15, 4, ST(-2))
    rc(c, 6, 28, 4, 3, ST(1)); hl(c, 6, 30, 4, ST(-2)); hl(c, 5, 31, 6, K('yoru', -2))


@R.obj('sc-water-tank', '옥상 고가 수조', w=2, h=2, up=16, kind='floor', tags=('옥상', '학교'),
       place='옥상 한쪽(펜스 안)',
       desc='옥상 고가 수조 2×2 — 쇠 받침대 위 연회색 패널 물탱크(패널 줄눈 격자), 윗면 둥근 맨홀 뚜껑, 옆 쇠 사다리.')
def _water_tank(c):
    y = block3(c, 1, 2, 30, 34, 9, 'conc', 2, front_t=1)
    disc(c, 15, 7, 4, 2.5, K('conc', -1)); disc(c, 15, 6.5, 3, 1.8, K('conc', 1))
    for x in range(2, 31, 7): vl(c, x, y, 34 + 2 - y - 1, K('conc', 0))
    for yy in range(y + 6, 35, 7): hl(c, 2, yy, 29, K('conc', 0))
    for k in range(4): hl(c, 27, y + 2 + k * 5, 3, ST(2))
    vl(c, 26, y, 34 - y, ST(0)); vl(c, 30, y, 34 - y, ST(-1))
    rc(c, 2, 36, 28, 2, ST(0)); hl(c, 2, 36, 28, ST(2))
    for x in (2, 14, 27):
        rc(c, x, 38, 3, 9, ST(0)); vl(c, x, 38, 9, ST(2)); vl(c, x + 2, 38, 9, ST(-2))
    for i in range(9): px(c, 5 + i, 38 + i, ST(-1)); px(c, 26 - i, 38 + i, ST(-1))
    hl(c, 1, 47, 30, K('yoru', -2))


@R.obj('sc-roof-door', '옥상 塔屋 철문', w=1, kind='hang', hrows=2, use=('travel', 'open'), tags=('옥상', '학교', '문'),
       place='옥상 북쪽 벽면(塔屋) — 그 아래 바닥 칸이 아래층 계단에서 나오는 칸',
       desc='옥상 계단실(塔屋)의 회색 철문 — 위에 작은 철망 유리창, 레버 손잡이, 문틀 아래 문턱. 아래층 계단으로 이어진다.')
def _roof_door(c):
    rc(c, 1, 0, 14, 32, ST(-2)); rc(c, 2, 1, 12, 31, ST(0))
    rc(c, 3, 2, 10, 29, ST(1)); hl(c, 3, 2, 10, ST(3)); vl(c, 3, 2, 29, ST(2)); vl(c, 12, 2, 29, ST(-1))
    rc(c, 5, 5, 6, 6, GL(0)); outline(c, 4, 4, 8, 8, ST(-2))
    for i in range(5, 11, 2): px(c, i, 7, GL(2)); px(c, i + 1, 9, GL(2))
    rc(c, 10, 17, 2, 1, ST(3)); px(c, 9, 17, ST(-2)); px(c, 11, 18, ST(-2))
    hl(c, 1, 30, 14, K('conc', 2)); hl(c, 1, 31, 14, K('conc', -2))


# ══ 탁상 물건(16×16) ══════════════════════════════════════════════════════════
@R.good('sc-textbook', '교과서·공책', desc='학생 책상 위 남색 교과서 한 권과 흰 공책, 연필 하나. 표지는 색 띠뿐, 글자 없음.')
def _textbook(c):
    rc(c, 3, 2, 7, 5, K('kon', 1)); hl(c, 3, 2, 7, K('kon', 3)); hl(c, 3, 6, 7, K('kon', -1)); rc(c, 4, 4, 5, 1, K('kii', 2)); outline(c, 2, 1, 9, 7)
    rc(c, 8, 4, 6, 4, WH(3)); hl(c, 9, 6, 4, K('sora', 2)); outline(c, 7, 3, 8, 6, K('conc', -1))
    hl(c, 4, 8, 6, K('kii', 3)); px(c, 10, 8, K('soil', 1)); px(c, 3, 8, OL)


@R.good('sc-chalk-box', '분필 상자', desc='교탁 위 작은 분필 상자 — 흰·빨강·노랑 분필이 꽂혀 있고 옆에 칠판 지우개.')
def _chalk_box(c):
    rc(c, 2, 6, 7, 5, K('kii', 1)); hl(c, 2, 6, 7, K('kii', 3)); outline(c, 1, 5, 9, 7, K('kii', -2))
    for k, col in enumerate((WH(4), K('aka', 2), K('kii', 4), WH(4))): vl(c, 3 + k * 2 - (k > 1), 3, 3, col)
    rc(c, 10, 7, 5, 4, K('kon', 1)); hl(c, 10, 7, 5, K('kii', 2)); hl(c, 10, 10, 5, WH(2)); outline(c, 9, 6, 7, 6)


@R.good('sc-globe', '지구본', desc='도서실·교실 탁상 지구본 — 파란 바다에 녹색 땅 덩이, 쇠 반달 축과 둥근 받침.')
def _globe(c):
    disc(c, 8, 7, 5, 5, OL); disc(c, 8, 7, 4.2, 4.2, K('sora', 2))
    for (x, y) in ((6, 5), (7, 5), (6, 6), (9, 8), (10, 8), (10, 9), (8, 9), (5, 8)): px(c, x, y, K('midori', 2))
    px(c, 6, 4, K('sora', 4)); px(c, 7, 4, K('sora', 3))
    for t in range(9):
        a = math.pi * (0.25 + 1.0 * t / 8)
        px(c, int(round(8 + 6 * math.cos(a + math.pi / 2))), int(round(7 - 6 * math.sin(a + math.pi / 2))), ST(2))
    rc(c, 7, 12, 2, 2, ST(0)); rc(c, 4, 14, 8, 2, ST(1)); hl(c, 4, 14, 8, ST(3)); hl(c, 3, 15, 10, OL)


@R.good('sc-flask', '플라스크·시험관', desc='실험대 위 삼각 플라스크(연두 액체)와 시험관 셋을 꽂은 나무 시험관대.')
def _flask(c):
    rc(c, 4, 2, 2, 4, GL(3)); vl(c, 3, 2, 4, OL); vl(c, 6, 2, 4, OL)
    for i in range(6):
        hw = 1 + i
        for x in range(5 - hw, 5 + hw):
            px(c, x, 6 + i, K('midori', 3) if i >= 3 else GL(3))
        px(c, 4 - hw, 6 + i, OL); px(c, 5 + hw, 6 + i, OL)
    hl(c, -1 + 0, 12, 11, OL); px(c, 3, 9, WH(4))
    rc(c, 11, 8, 4, 5, WD(0)); hl(c, 11, 8, 4, WD(2)); outline(c, 10, 7, 6, 7, K('ita', -3))
    for k, col in enumerate(('aka', 'kii', 'sora')): vl(c, 11 + k, 3, 5, kc(col, 1)); px(c, 11 + k, 3, GL(3))


@R.good('sc-attendance-book', '출석부', desc='교탁 위 검정 표지 출석부와 빨간 펜 — 펼친 면엔 회색 칸 줄뿐, 글자 없음.')
def _attendance(c):
    rc(c, 2, 4, 12, 8, K('yoru', -1)); outline(c, 1, 3, 14, 10)
    rc(c, 3, 5, 5, 6, WH(3)); rc(c, 8, 5, 5, 6, WH(2)); vl(c, 8, 5, 6, K('conc', 1))
    for y in (6, 8, 10): hl(c, 3, y, 10, K('conc', 2))
    for x in (5, 11): vl(c, x, 5, 6, K('conc', 2))
    hl(c, 9, 13, 5, K('aka', 1)); px(c, 14, 13, K('aka', 3))


def build(): return R.build()
def selftest(): return R.selftest()


if __name__ == '__main__':
    sys.exit(1 if run_block(R, os.path.join(ROOT, 'tiledata', 'jp-city', 'blocks', BLOCK)) else 0)
