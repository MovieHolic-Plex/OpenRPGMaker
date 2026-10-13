#!/usr/bin/env python3
"""modern_campus 실내 가구·바닥·벽면 — 학교 교실·복도·교무실·급식실·도서관·보건실·화장실·기숙사·동아리방·강의실. id 머리 `mc-`.

설계: openwiki/modern-campus-interior.md. 틀은 jp_city 실내 틀(`jp-city/interior/ikit.py` Registry)을 **읽기만** 한다(파일 수정 금지).
이미 있는 학교 기물(jp_city `sc-`·`pb-`·`gy-`, 침대·화장실 등)은 다시 그리지 않는다 — 재사용 표는 REUSE 와 문서를 본다. 여기엔 «없는 것»만 둔다.
3/4: 윗면(깊은 5행 이상 나뭇결·쇠 결 슬래브) + 남쪽 앞면. 빛 왼위, 팔레트 modern3 램프만, 글자·사람·상표 없음. 칠판·게시판은 색 덩이와 선뿐.

  python3 scripts/content/modern-campus/interior/campus_interior.py          # selftest + tiledata/modern-campus/interior/_gate/*.png + items.jsonl + _all-x3.png
  python3 .../campus_interior.py --only mc-desk-pair mc-lectern              # 일부만 다시 굽는다
산출: _gate/<id>.png (투명, object-gate 정본 · 바닥·벽면은 한 주기 그림) · items.jsonl(label modern-campus-int/<id>).
"""
import math, os, sys, json
HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..', '..', '..'))
sys.path.insert(0, os.path.join(ROOT, 'scripts', 'content', 'jp-city', 'interior'))
sys.path.insert(0, os.path.join(ROOT, 'scripts', 'content', 'jp-city', 'blocks'))
import numpy as np                                                        # noqa: E402
from PIL import Image                                                     # noqa: E402
from ikit import Registry, K, OL, Cv, RAMPS, blit                         # noqa: E402
from interior_school import rc, hl, vl, outline, block3, hs, rnd, px, WD, ST, WH, GL, disc   # noqa: E402

OUT = os.path.join(ROOT, 'tiledata', 'modern-campus', 'interior')
R = Registry('interior_campus', '캠퍼스')

# 문서·조수용 재사용 표 — 실내 장소가 이 id 들을 그대로 쓴다(tileset jp_city 사양에 이미 있다).
REUSE = {
    'classroom': ['sc-desk-n', 'sc-teacher-desk', 'sc-podium', 'sc-blackboard', 'sc-back-locker', 'sc-notice-board', 'sc-cleaning-locker', 'sc-classroom-door', 'sc-tv-stand', 'sc-chair-s', 'sc-whiteboard'],
    'corridor': ['sc-corridor', 'sc-wall', 'sc-washstand', 'sc-shoe-locker', 'sc-sunoko', 'sc-genkan-tile', 'sc-notice-board', 'sc-key-box'],
    'stairs': ['sc-stairs-up', 'sc-stairwell-down', 'sc-roof-door'],
    'toilet': ['sc-wall-tile', 'toilet', 'sc-urinal', 'sc-sink', 'toilet-paper', 'toilet-handwash', 'door-open-toilet'],
    'staffroom': ['sc-staff-desk', 'sc-staff-chair-s', 'sc-staff-chair-n', 'sc-copy-machine', 'sc-tea-shelf', 'sc-whiteboard', 'sc-key-box', 'pb-file-cabinet'],
    'library': ['sc-bookshelf', 'sc-book-island', 'sc-reading-table', 'sc-lib-counter', 'sc-chair-s'],
    'infirmary': ['sc-nurse-bed', 'sc-curtain', 'sc-med-shelf', 'sc-scale', 'sc-sink', 'pb-scale-height'],
    'dorm': ['bed-single', 'bunk-bed', 'wardrobe', 'dresser-low', 'bed-side-table', 'laundry-rack', 'washing-machine', 'laundry-basket'],
    'lecture': ['sc-lab-stool', 'sc-chair-s', 'sc-whiteboard'],
    'club': ['sc-piano', 'sc-music-stand', 'sc-instrument-shelf', 'gy-folding-table', 'gy-mat-stack'],
    'cafeteria': ['pb-water-dispenser', 'pb-vending', 'gy-folding-table'],
}


def wood_top(c, x, y, w, h, ramp='yuka', t=1, seed=0):
    """윗면 슬래브 안쪽에 나뭇결(가로 결 줄 + 옹이 점)을 얹는다. (x,y,w,h) = 윗면 안쪽 사각형."""
    for j in range(1, h, 2):
        hl(c, x + 1, y + j, w - 2, K(ramp, t - 1))
        for i in range(w - 2):
            if rnd(x + i, y + j, seed, 160): px(c, x + 1 + i, y + j, K(ramp, t))
    for k in range(3):
        px(c, x + 2 + hs(k, y, seed) % max(1, w - 4), y + hs(k, x, seed + 1) % h, K(ramp, t + 1))


def steel_top(c, x, y, w, h, t=2):
    """쇠판 윗면: 가는 가로 결 + 모서리 반사."""
    for j in range(1, h, 2): hl(c, x + 1, y + j, w - 2, ST(t - 1))
    hl(c, x + 1, y, w - 2, ST(t + 2))
    for i in range(0, w - 2, 5): px(c, x + 2 + i, y + h // 2, ST(t + 2))


_CUR = [None]
_FRONT = [None]
_REV = {col: (name, k) for name, r in RAMPS.items() for k, col in enumerate(r)}


def darken_below(c, y0, steps=1):
    """y0 줄부터 아래 모든 화소를 자기 램프에서 steps 단 어둡게(윤곽 sumi 제외) — 윗면과 앞면의 명암 차를 키운다."""
    for yy in range(max(0, y0), c.h):
        for xx in range(c.w):
            if c.a[yy, xx, 3] != 255: continue
            v = (int(c.a[yy, xx, 0]) << 16) | (int(c.a[yy, xx, 1]) << 8) | int(c.a[yy, xx, 2])
            nk = _REV.get(v)
            if nk and nk[0] not in ('sumi',) and nk[1] > 0:
                c.a[yy, xx, :3] = [(RAMPS[nk[0]][max(0, nk[1] - steps)] >> 16) & 255, (RAMPS[nk[0]][max(0, nk[1] - steps)] >> 8) & 255, RAMPS[nk[0]][max(0, nk[1] - steps)] & 255]


def clutter(c, x, y, w, top, seed):
    """윗면 위에 놓인 작은 물건(상자·책 더미·화분·종이)을 깔아 «이 윗면은 위에서 본 면»임을 드러낸다. 뒤 가장자리엔 벽 그늘 줄."""
    hl(c, x, y, w, K('sumi', 1)); hl(c, x + 1, y + 1, w - 2, K('sumi', 2)) if False else None
    n = max(1, w // 7)
    for k in range(n):
        ox = x + 2 + k * (w - 4) // n + hs(k, seed, 1) % 2
        kind = (k + seed) % 3
        if kind == 0:      # 상자
            rc(c, ox, y + 2, 5, top - 5, K('daidai', 1)); hl(c, ox, y + 2, 5, K('daidai', 3)); hl(c, ox, y + top - 4, 5, K('daidai', -1)); outline(c, ox - 1, y + 1, 7, top - 3, OL)
        elif kind == 1:    # 책 더미
            for b in range(3):
                rc(c, ox, y + 2 + b * 2, 6, 2, K(('aka', 'sora', 'midori')[b], 1)); hl(c, ox, y + 2 + b * 2, 6, K(('aka', 'sora', 'midori')[b], 3))
            outline(c, ox - 1, y + 1, 8, 8, OL) if top >= 10 else None
        else:              # 화분
            disc(c, ox + 2.5, y + 3.5, 3, 2.4, K('midori', 1)); px(c, ox + 1, y + 2, K('midori', 3)); rc(c, ox, y + top - 5, 5, 2, K('daidai', 0)); outline(c, ox - 1, y + 1, 7, top - 3, OL)
PUNCH = {'mc-cabinet-glass', 'mc-vending-in', 'mc-bulletin-stand', 'mc-toilet-stall', 'mc-clean-cart', 'mc-book-cart', 'mc-catalog-drawers', 'mc-aid-cabinet',
         'mc-dorm-wardrobe', 'mc-mini-fridge', 'mc-easel-board', 'mc-trophy-case', 'mc-amp'}


def slab(c, x, y, w, h, top, ramp, t=0, olc=None, front_t=None, grain='wood', seed=0):
    """block3(윗면 top px + 앞면) 뒤에 윗면 결을 얹는다. 앞면 내용 시작 y 를 돌려준다.
    PUNCH 에 든 좁은 키 큰 가구는 윗면을 한 단 밝게·앞면을 두 단 어둡게 해 윗면과 앞면이 한눈에 갈리게 한다(관문 「정면 입면도」 대책)."""
    punch = _CUR[0] in PUNCH
    if punch:
        d = min(2, y); y -= d; h += d; top += d; front_t = -3
        yy = block3(c, x, y, w, h, top, ramp, t, olc, front_t)
        rc(c, x + 1, y + 1, w - 2, top, K(ramp, t + 3)); hl(c, x + 1, y + 1, w - 2, K(ramp, t + 4)); vl(c, x + 1, y + 1, top, K(ramp, t + 4))
        hl(c, x + 1, y + top, w - 2, K(ramp, t + 2)); hl(c, x + 1, y + top + 1, w - 2, K(ramp, -3)); hl(c, x + 1, y + top + 2, w - 2, K(ramp, -3))
        _FRONT[0] = yy
        return yy
    yy = block3(c, x, y, w, h, top, ramp, t, olc, front_t)
    if grain == 'wood': wood_top(c, x + 1, y + 1, w - 2, top, ramp, t + 1, seed)
    elif grain == 'steel': steel_top(c, x + 1, y + 1, w - 2, top, t + 1)
    return yy


def legs(c, xs, y, n, col=None):
    for x in xs: vl(c, x, y, n, col or ST(1)); vl(c, x + 1, y, n, ST(-2)); px(c, x, y + n, OL); px(c, x + 1, y + n, OL)


def reg(id_, ko, w=1, h=1, up=0, kind='floor', gate='low_furniture', **kw):
    """R.obj + 관문 종류(gate) 기록."""
    def deco(fn):
        def wrapped(c, *a, _id=id_, _fn=fn):
            _CUR[0] = _id
            try:
                r = _fn(c, *a)
                if _id in PUNCH and _FRONT[0] is not None: darken_below(c, _FRONT[0] - 1, 1)
                return r
            finally: _CUR[0] = None; _FRONT[0] = None
        R.obj(id_, ko, w=w, h=h, up=up, kind=kind, **kw)(wrapped)
        R.objs[id_]['gate'] = gate
        return fn
    return deco


# ══ 바닥 ══════════════════════════════════════════════════════════════════════
@R.floor('mc-floor-lino', '교실 리놀륨(연회색 + 베이지 점박이)', cols=4, rows=4, tags=('교실', '학교', '리놀륨'),
         desc='교실의 연한 회색 리놀륨 — 베이지·옅은 청회 점박이 4톤, 16px 마다 얇은 이음선. 책상 줄 밑 바닥.')
def _f_lino(c):
    rc(c, 0, 0, c.w, c.h, K('kinari', 0))
    for y in range(c.h):
        for x in range(c.w):
            r = hs(x, y, 5) % 100
            col = K('shiro', 1) if r < 14 else K('conc', 3) if r < 24 else K('kinari', 2) if r < 40 else None
            if col is not None: px(c, x, y, col)
    for k in range(0, c.w, 16): vl(c, k, 0, c.h, K('conc', 1))
    for k in range(0, c.h, 16): hl(c, 0, k, c.w, K('conc', 1))


@R.floor('mc-floor-corridor', '복도 대형 타일(옅은 청록 회색)', cols=4, rows=2, tags=('복도', '학교', '계단실'),
         desc='복도의 큰 사각 타일 — 청록빛 회색, 한 칸 가운데에 얇은 줄눈 십자와 모서리 하이라이트. 복도·계단실 바닥.')
def _f_cor(c):
    for ty in range(0, c.h, 16):
        for tx in range(0, c.w, 16):
            tone = (0, 1, 1, 0)[(tx // 16 + ty // 16 * 3) % 4]
            rc(c, tx, ty, 16, 16, K('lino', tone + 1))
            for y in range(16):
                for x in range(16):
                    if rnd(tx + x, ty + y, 8, 40): px(c, tx + x, ty + y, K('lino', tone + 2))
            hl(c, tx, ty, 16, K('lino', -1)); vl(c, tx, ty, 16, K('lino', -1))
            hl(c, tx + 1, ty + 1, 14, K('lino', 2)); vl(c, tx + 1, ty + 1, 14, K('lino', 2))


@R.floor('mc-floor-parquet', '도서관·동아리방 쪽마루(짙은 꿀색)', cols=4, rows=4, tags=('도서관', '동아리방', '교무실', '학교'),
         desc='도서관·동아리방의 쪽마루 — 4칸마다 엇갈리는 짧은 판, 짙은 꿀색 3톤. 카펫 대신 쓰는 따뜻한 바닥.')
def _f_parq(c):
    for r in range(c.h // 8):
        for k in range(c.w // 16 + 1):
            ox = (k * 16 + (r % 2) * 8) % c.w; tone = (1, 0, 2)[(r + k * 2) % 3]
            for x in range(16): hl(c, (ox + x) % c.w, r * 8, 1, WD(tone)) if False else None
            rc(c, ox % c.w, r * 8, min(16, c.w - ox % c.w), 8, WD(tone))
            if ox + 16 > c.w: rc(c, 0, r * 8, ox + 16 - c.w, 8, WD(tone))
            hl(c, ox % c.w, r * 8, min(16, c.w - ox % c.w), WD(tone + 1)); hl(c, ox % c.w, r * 8 + 7, min(16, c.w - ox % c.w), WD(-1))
            vl(c, ox % c.w, r * 8, 8, WD(-1))
    for y in range(c.h):
        for x in range(c.w):
            if rnd(x, y, 3, 60): px(c, x, y, WD(0))


@R.floor('mc-floor-cafe', '급식실 체크 타일(흰·옅은 하늘색)', cols=2, rows=2, tags=('급식실', '학교', '식당'),
         desc='급식실의 8px 체크 타일 — 흰색과 연한 하늘색이 번갈아, 줄눈은 회색. 청소하기 쉬워 보이는 밝은 바닥.')
def _f_cafe(c):
    for y in range(0, c.h, 8):
        for x in range(0, c.w, 8):
            col = K('shiro', 3) if ((x + y) // 8) % 2 == 0 else K('sora', 2) if False else K('garasu', 4)
            rc(c, x, y, 8, 8, col); hl(c, x, y, 8, K('conc', 4)); vl(c, x, y, 8, K('conc', 4))
            px(c, x + 1, y + 1, K('shiro', 4) if col == K('shiro', 3) else K('garasu', 5))


@R.floor('mc-floor-dorm', '기숙사 카펫(청회색 얇은 결)', cols=2, rows=2, tags=('기숙사', '학교', '카펫'),
         desc='기숙사 방·라운지의 청회색 카펫 — 가로 얇은 결과 점 무늬. 책상·침대 밑 바닥.')
def _f_dorm(c):
    rc(c, 0, 0, c.w, c.h, K('tairu', 3))
    for y in range(c.h):
        hl(c, 0, y, c.w, K('tairu', 3 + (y % 2) * 0 - (1 if y % 4 == 2 else 0)))
        for x in range(c.w):
            if rnd(x, y, 12, 90): px(c, x, y, K('tairu', 4))


@R.floor('mc-floor-tile-wc', '화장실 소형 타일(연녹 회색)', cols=2, rows=2, tags=('화장실', '학교', '샤워'),
         desc='화장실·샤워실의 4px 소형 타일 — 연한 녹회색, 줄눈이 격자로 보인다. 칸막이 안쪽 바닥.')
def _f_wc(c):
    rc(c, 0, 0, c.w, c.h, K('lino', 1))
    for y in range(0, c.h, 4):
        for x in range(0, c.w, 4):
            tone = 2 if hs(x, y, 4) % 3 == 0 else 1
            rc(c, x, y, 3, 3, K('lino', tone)); px(c, x, y, K('lino', 3))
    hl(c, 0, 0, c.w, K('lino', -1)) if False else None


# ══ 벽면(2칸 높이 중 위 줄 = 벽 윗면 아래 벽, 아래 줄 = 허리·걸레받이) ═══════
def _skirt(c, y, col=None, h=3):
    rc(c, 0, y, c.w, h, col or K('conc', -1)); hl(c, 0, y, c.w, K('conc', 1)); hl(c, 0, y + h - 1, c.w, K('sumi', 0))


@R.wall('mc-wall-class', '교실 벽(크림 + 초록 허리 칠 + 몰딩)', cols=2, tags=('교실', '복도', '교무실', '학교'),
        desc='위는 크림색 회반죽, 허리 아래는 짙은 초록 칠과 흰 몰딩 줄, 맨 밑 회색 걸레받이. 교실·교무실 벽면.')
def _w_class(c):
    rc(c, 0, 0, c.w, 18, K('kinari', 2))
    for y in range(18):
        for x in range(c.w):
            if rnd(x, y, 21, 40): px(c, x, y, K('kinari', 1))
    vl(c, 0, 0, 18, K('kinari', 3))
    rc(c, 0, 18, c.w, 11, K('lino', 0))
    for x in range(c.w): vl(c, x, 19, 9, K('lino', 0 if x % 4 else -1))
    hl(c, 0, 18, c.w, K('shiro', 3)); hl(c, 0, 19, c.w, K('shiro', 1))
    _skirt(c, 29, h=3)


@R.wall('mc-wall-corridor', '복도 벽(흰 벽 + 하늘색 띠 + 창틀 이음)', cols=2, tags=('복도', '계단실', '학교'),
        desc='복도의 흰 벽 — 한가운데 하늘색 가로 띠 한 줄, 아래 회색 걸레받이. 문·사물함이 줄지어 서는 벽.')
def _w_cor(c):
    rc(c, 0, 0, c.w, 22, K('shiro', 3))
    for y in range(22):
        for x in range(c.w):
            if rnd(x, y, 22, 35): px(c, x, y, K('shiro', 2))
    rc(c, 0, 12, c.w, 3, K('sora', 1)); hl(c, 0, 12, c.w, K('sora', 3)); hl(c, 0, 14, c.w, K('sora', -1))
    vl(c, 0, 0, 22, K('shiro', 4))
    rc(c, 0, 22, c.w, 7, K('conc', 3)); hl(c, 0, 22, c.w, K('conc', 5))
    for x in range(0, c.w, 8): vl(c, x, 23, 6, K('conc', 2))
    _skirt(c, 29, h=3)


@R.wall('mc-wall-tile', '화장실·보건실 타일 벽(흰 사각 타일)', cols=2, tags=('화장실', '보건실', '급식실', '학교'),
        desc='화장실·급식실·샤워실의 8px 흰 사각 타일 벽 — 줄눈 격자, 허리 높이에 짙은 청록 띠 한 줄.')
def _w_tile(c):
    for y in range(0, 29, 8):
        for x in range(0, c.w, 8):
            rc(c, x, y, 8, 8, K('shiro', 3)); hl(c, x, y, 8, K('conc', 5)); vl(c, x, y, 8, K('conc', 5)); px(c, x + 1, y + 1, K('shiro', 4))
    rc(c, 0, 17, c.w, 2, K('lino', 0)); hl(c, 0, 17, c.w, K('lino', 2))
    _skirt(c, 29, h=3)


@R.wall('mc-wall-dorm', '기숙사 벽(옅은 베이지 + 나무 몰딩)', cols=2, tags=('기숙사', '동아리방', '도서관', '학교'),
        desc='기숙사·동아리방·도서관의 따뜻한 베이지 벽 — 허리에 나무 몰딩, 아래 짙은 나무 걸레받이.')
def _w_dorm(c):
    rc(c, 0, 0, c.w, 20, K('kinari', 1))
    for y in range(20):
        for x in range(c.w):
            if rnd(x, y, 24, 40): px(c, x, y, K('kinari', 2))
    vl(c, 0, 0, 20, K('kinari', 2))
    rc(c, 0, 20, c.w, 2, WD(1)); hl(c, 0, 20, c.w, WD(3)); hl(c, 0, 21, c.w, WD(-1))
    rc(c, 0, 22, c.w, 7, WD(-1))
    for x in range(c.w): vl(c, x, 23, 5, WD(-1 if x % 4 else -2))
    _skirt(c, 29, WD(-2), 3)


@R.wall('mc-wall-cafe', '급식실 벽(연노랑 + 아래 타일)', cols=2, tags=('급식실', '학교', '식당'),
        desc='급식실의 연한 노랑 벽 — 허리 아래는 흰 사각 타일, 둘 사이 갈색 띠.')
def _w_cafe(c):
    rc(c, 0, 0, c.w, 16, K('kii', 3))
    for y in range(16):
        for x in range(c.w):
            if rnd(x, y, 26, 35): px(c, x, y, K('kii', 2))
    vl(c, 0, 0, 16, K('kii', 4))
    rc(c, 0, 16, c.w, 2, WD(0)); hl(c, 0, 16, c.w, WD(2))
    for y in range(18, 29, 5):
        for x in range(0, c.w, 8):
            rc(c, x, y, 8, 5, K('shiro', 3)); hl(c, x, y, 8, K('conc', 5)); vl(c, x, y, 5, K('conc', 5))
    _skirt(c, 29, h=3)


# ══ 벽걸이(hang) ═════════════════════════════════════════════════════════════
@reg('mc-board-green', '초록 칠판(넓은 4칸, 알루미늄 틀)', w=4, kind='hang', hrows=2, gate='wall_mounted', use=('read',), tags=('교실', '강의실', '학교', '칠판'),
     place='교실·강의실 앞 북쪽 벽면 윗줄 가운데',
     desc='알루미늄 틀의 초록 칠판 4칸 — 진초록 판에 분필 가루 결, 아래 은색 받침에 분필 셋. 판 위는 선 몇 줄뿐 글자 없음.')
def _board_green(c):
    W = 64
    rc(c, 0, 1, W, 26, ST(2)); outline(c, 0, 1, W, 26, ST(-2)); hl(c, 1, 2, W - 2, ST(5))
    rc(c, 3, 4, W - 6, 19, K('kokuban', 1)); outline(c, 3, 4, W - 6, 19, K('kokuban', -1))
    for y in range(5, 22):
        for x in range(4, W - 4):
            if rnd(x, y, 51, 30): px(c, x, y, K('kokuban', 2))
    for (x, y, n) in ((8, 9, 18), (8, 13, 11), (34, 8, 14), (44, 15, 9)): hl(c, x, y, n, K('shiro', 3))
    rc(c, 1, 23, W - 2, 3, ST(3)); hl(c, 1, 23, W - 2, ST(6)); hl(c, 1, 25, W - 2, ST(-1))
    for x, col in ((6, WH(3)), (10, K('kii', 3)), (14, K('aka', 2))): hl(c, x, 23, 3, col)
    hl(c, 0, 27, W, ST(-3))


@reg('mc-wall-clock', '교실 벽시계(원형, 철망 없음)', w=1, kind='hang', hrows=2, gate='wall_mounted', use=('light',), tags=('교실', '복도', '학교', '시계'),
     place='교실 칠판 위·복도 벽면 윗줄', desc='흰 원판에 짙은 테를 두른 둥근 벽시계 — 시침 분침은 짧은 두 선, 숫자 없음. 칸 가운데에 걸린다.')
def _wall_clock(c):
    disc(c, 7.5, 12, 7, 7, OL); disc(c, 7.5, 12, 6, 6, K('shiro', 3)); disc(c, 7.5, 12, 5, 5, K('shiro', 4))
    px(c, 7, 8, OL); px(c, 7, 15, OL); px(c, 4, 12, OL); px(c, 11, 12, OL)
    vl(c, 7, 8, 5, OL); hl(c, 7, 12, 3, OL); px(c, 7, 12, K('aka', 1))
    hl(c, 5, 4, 5, ST(-1)); hl(c, 4, 19, 8, K('sumi', 0))


@reg('mc-screen-proj', '교실 영사막(말아 내린 흰 막)', w=3, kind='hang', hrows=2, gate='wall_mounted', use=('read',), tags=('강의실', '교실', '학교'),
     place='강의실 북쪽 벽면 윗줄, 칠판 옆', desc='천장에서 내려온 영사막 3칸 — 흰 막에 검은 테두리, 위 가로봉과 아래 막대. 막 한쪽에 분필색 빛 얼룩.')
def _screen(c):
    W = 48
    rc(c, 0, 0, W, 3, ST(0)); hl(c, 0, 0, W, ST(3)); hl(c, 0, 2, W, ST(-2))
    rc(c, 2, 3, W - 4, 22, K('shiro', 3)); outline(c, 2, 3, W - 4, 22, K('sumi', 0))
    for y in range(4, 24):
        for x in range(3, W - 3):
            if rnd(x, y, 61, 25): px(c, x, y, K('shiro', 2))
    rc(c, 1, 25, W - 2, 2, ST(1)); hl(c, 1, 25, W - 2, ST(4)); vl(c, W // 2, 27, 3, ST(0)); rc(c, W // 2 - 1, 29, 3, 2, ST(2))


@reg('mc-cork-board', '코르크 게시판(색 종이 덩이)', w=2, kind='hang', hrows=2, gate='wall_mounted', use=('read',), tags=('복도', '교실', '동아리방', '학교'),
     place='복도·동아리방 벽면 윗줄', desc='나무 틀의 코르크 게시판 2칸 — 갈색 코르크에 노랑·분홍·하늘색 종이 덩이 일곱 장과 압정 점. 글자 없음.')
def _cork(c):
    W = 32
    rc(c, 0, 1, W, 26, WD(-1)); outline(c, 0, 1, W, 26, WD(-2)); hl(c, 1, 2, W - 2, WD(1))
    rc(c, 2, 3, W - 4, 22, K('daidai', -1))
    for y in range(4, 24):
        for x in range(3, W - 3):
            if rnd(x, y, 71, 30): px(c, x, y, K('daidai', 0))
    for (x, y, w, h, col) in ((4, 5, 7, 6, 'kii'), (13, 5, 6, 8, 'pinku'), (21, 6, 7, 6, 'sora'), (5, 14, 8, 6, 'midori'), (15, 15, 6, 7, 'shiro'), (23, 14, 6, 8, 'kii'), (10, 9, 4, 4, 'aka')):
        rc(c, x, y, w, h, K(col, 2)); hl(c, x, y, w, K(col, 3)); hl(c, x, y + h - 1, w, K(col, 0)); px(c, x + w // 2, y + 1, K('aka', 1))
        for k in range(1, h - 2, 2): hl(c, x + 1, y + 1 + k, max(1, w - 3), K(col, 1))
    hl(c, 0, 27, W, WD(-3))


@reg('mc-eye-chart', '시력표·신체 계측 벽판(색 덩이)', w=1, kind='hang', hrows=2, gate='wall_mounted', use=('read',), tags=('보건실', '학교'),
     place='보건실 벽면 윗줄', desc='보건실의 흰 시력표 판 — 위에서 아래로 줄어드는 검은 막대 열 줄과 옆 눈금 세로 줄. 글자 없음.')
def _eye(c):
    rc(c, 2, 1, 12, 26, K('shiro', 3)); outline(c, 2, 1, 12, 26, ST(-1)); hl(c, 3, 2, 10, K('shiro', 4))
    for i in range(9):
        w = max(1, 8 - i); hl(c, 8 - w // 2, 4 + i * 2, w, K('sumi', 0)); (px(c, 7 - w // 2 - 1, 4 + i * 2, K('sumi', 1)) if w > 3 else None)
    vl(c, 12, 4, 20, K('sora', 1)); hl(c, 1, 27, 14, K('sumi', 0))


@reg('mc-window-class', '교실 창(미닫이 알루미늄, 파란 하늘)', w=2, kind='hang', hrows=2, gate='wall_mounted', use=('light',), tags=('교실', '복도', '학교', '창문'),
     place='교실 남쪽·복도 벽면 윗줄, 두 칸씩', desc='알루미늄 틀의 미닫이 창 2칸 — 위쪽 두 장 유리에 하늘색과 구름 한 점, 가운데 세로 틀, 아래 창턱 흰 판.')
def _window(c):
    W = 32
    rc(c, 0, 1, W, 25, ST(3)); outline(c, 0, 1, W, 25, ST(-2)); hl(c, 1, 2, W - 2, ST(6))
    for x0 in (3, 17):
        rc(c, x0, 4, 12, 17, K('sora', 3)); outline(c, x0, 4, 12, 17, ST(-1))
        rc(c, x0 + 1, 5, 10, 8, K('sora', 4)); hl(c, x0 + 1, 12, 10, K('sora', 2))
        hl(c, x0 + 2, 8, 4, K('shiro', 4)); hl(c, x0 + 3, 7, 3, K('shiro', 4))
        px(c, x0 + 1, 5, K('shiro', 4)); vl(c, x0 + 1, 6, 6, K('shiro', 3))
    vl(c, 15, 4, 17, ST(-1)); vl(c, 16, 4, 17, ST(5))
    rc(c, 0, 22, W, 4, K('shiro', 3)); hl(c, 0, 22, W, K('shiro', 4)); hl(c, 0, 25, W, K('conc', 2)); hl(c, 0, 26, W, K('sumi', 0))


# ══ 교실·강의실 ═══════════════════════════════════════════════════════════════
@reg('mc-desk-pair', '2인 책상·의자 한 쌍(나란히)', w=2, gate='low_furniture', use=('sit',), facing='N', tags=('교실', '강의실', '학교', '책상'),
     place='교실 바닥 격자, 열마다 한 쌍(열 사이 1칸 통로)', desc='나란한 두 학생 책상 — 밝은 나무 상판(결 세 줄·모서리 반짝)과 쇠 다리, 아래 남쪽에 쇠 파이프 나무 의자 둘.')
def _desk_pair(c):
    for i in (0, 1):
        ox = i * 16
        slab(c, ox + 1, 0, 14, 11, 7, 'yuka', 1, olc=K('ita', -3), front_t=-1, seed=i)
        hl(c, ox + 3, 8, 10, K('ita', -2))
        legs(c, (ox + 3, ox + 12), 11, 2)
        rc(c, ox + 4, 12, 8, 3, WD(1)); hl(c, ox + 4, 12, 8, WD(3)); hl(c, ox + 4, 14, 8, WD(-1)); outline(c, ox + 3, 11, 10, 5, OL)


@reg('mc-lecture-bench', '강의실 긴 책상(3인, 의자 붙음)', w=3, gate='low_furniture', use=('sit', 'read'), facing='N', tags=('강의실', '학교', '책상'),
     place='강의실 바닥, 줄마다 앞뒤 간격 2칸', desc='강의실의 긴 나무 책상 3칸 — 깊은 나무 상판 가운데 앞 홈 선, 앞에 접이 좌석 셋(진청색 방석).')
def _lec_bench(c):
    slab(c, 1, 0, 46, 10, 7, 'yuka', 1, olc=K('ita', -3), front_t=-1, seed=3)
    hl(c, 3, 8, 42, K('ita', -2)); vl(c, 16, 1, 7, WD(-1)); vl(c, 32, 1, 7, WD(-1))
    legs(c, (3, 43), 10, 2)
    for i in range(3):
        x0 = 4 + i * 15
        rc(c, x0, 11, 9, 4, K('kon', 0)); hl(c, x0, 11, 9, K('kon', 2)); hl(c, x0, 14, 9, K('kon', -1)); outline(c, x0 - 1, 10, 11, 6, OL)


@reg('mc-lectern', '강의대(경사진 윗판 연단)', w=1, up=8, gate='tall_furniture', use=('read',), tags=('강의실', '교실', '학교'),
     place='강의실 북쪽 칠판 앞 가운데', desc='나무 연단 — 경사진 넓은 윗판(결·금속 가장자리)과 앞판 가운데 세로 홈, 아래 굽 받침. 윗판에 마이크 없음.')
def _lectern(c):
    y = slab(c, 1, 5, 14, 27, 8, 'ita', 2, olc=K('ita', -3), front_t=0, seed=4)
    hl(c, 2, 13, 12, K('ita', 5)); hl(c, 2, 14, 12, ST(2))
    vl(c, 7, y + 3, 32 - y - 4, K('ita', -2)); vl(c, 8, y + 3, 32 - y - 4, K('ita', 1))
    rc(c, 2, 29, 12, 2, K('ita', -2)); hl(c, 1, 31, 14, OL)
    rc(c, 6, 7, 4, 2, K('shiro', 3)); hl(c, 6, 7, 4, K('shiro', 4))


@reg('mc-cabinet-glass', '교실 유리문 캐비닛(교재장)', w=2, up=16, gate='tall_furniture', use=('open',), tags=('교실', '교무실', '학교', '수납'),
     place='교실·교무실 벽 앞', desc='나무 유리문 장 2칸 — 깊은 나무 윗판, 앞 유리 속에 교재·파일 색 덩이 줄, 아래 닫힌 문 둘과 은색 손잡이.')
def _cab_glass(c):
    y = slab(c, 0, 3, 32, 29, 7, 'yuka', 0, olc=K('ita', -3), front_t=-1, seed=5)
    for k in range(2):
        x0 = 2 + k * 15
        rc(c, x0, y, 13, 11, GL(0)); outline(c, x0, y, 13, 11, K('ita', -2)); hl(c, x0 + 1, y + 1, 11, GL(3))
        for r in range(2):
            for b in range(5):
                col = ('aka', 'sora', 'kii', 'midori', 'kon')[(b + k + r * 2) % 5]
                rc(c, x0 + 1 + b * 2 + (b // 3), y + 1 + r * 5, 2, 4, K(col, 1))
            hl(c, x0 + 1, y + 5 + r * 5 - (1 if r == 0 else 0), 11, K('ita', -1)) if r == 0 else None
        rc(c, x0, y + 12, 13, 5, K('yuka', -1)); outline(c, x0, y + 12, 13, 5, K('ita', -2)); px(c, x0 + 10 - k * 7, y + 14, ST(5))
    hl(c, 0, 31, 32, OL)


@reg('mc-pc-cart', '교실 노트북 보관 카트', w=1, up=8, gate='tall_furniture', use=('open',), tags=('교실', '강의실', '학교'),
     place='교실 뒤·강의실 벽 곁', desc='바퀴 달린 은색 카트 — 넓은 회색 윗판, 앞에 얇은 서랍 세 줄(작은 파랑 불빛 점)과 아래 바퀴 네 점.')
def _pc_cart(c):
    y = slab(c, 1, 6, 14, 24, 7, 'tekko', 2, olc=ST(-3), front_t=0, grain='steel')
    for r in range(3):
        rc(c, 3, y + r * 5, 10, 4, ST(1)); hl(c, 3, y + r * 5, 10, ST(4)); hl(c, 3, y + r * 5 + 3, 10, ST(-2)); px(c, 11, y + r * 5 + 1, K('sora', 4))
    for x in (2, 12): rc(c, x, 30, 2, 2, K('sumi', 0)); px(c, x, 30, ST(0))


@reg('mc-chair-stack', '쌓은 의자(3개)', w=1, up=8, gate='other', use=('block',), tags=('교실', '급식실', '강당', '학교'),
     place='교실 뒤 구석·창고', desc='쌓아 올린 학교 의자 — 맨 위 의자의 넓은 나무 좌판 윗면, 그 아래 좌판 앞면 띠 셋과 쇠 다리 네 개.')
def _chair_stack(c):
    block3(c, 1, 8, 14, 12, 8, 'yuka', 2, olc=K('ita', -3), front_t=-1)
    wood_top(c, 2, 9, 12, 8, 'yuka', 3, 21)
    for k in range(2): hl(c, 2, 20 + k * 3, 12, WD(-2)); hl(c, 2, 21 + k * 3, 12, WD(1)); outline(c, 1, 20 + k * 3 - 1, 14, 5, OL) if False else None
    rc(c, 2, 21, 12, 2, WD(0)); rc(c, 2, 24, 12, 2, WD(-1)); rc(c, 2, 27, 12, 2, WD(0)); hl(c, 2, 23, 12, OL); hl(c, 2, 26, 12, OL)
    vl(c, 1, 20, 9, OL); vl(c, 14, 20, 9, OL); hl(c, 2, 29, 12, OL)
    legs(c, (3, 11), 29, 2); hl(c, 2, 31, 12, K('sumi', 0))


@reg('mc-trash-bin', '교실 쓰레기통(둥근 열린 아가리)', w=1, gate='container', tags=('교실', '복도', '급식실', '학교'),
     place='교실 뒤·복도 벽 곁', desc='회색 쓰레기통 — 위에서 보이는 넓은 타원 아가리(밝은 림, 속 뒷벽은 어둡고 바닥에 휴지 덩이가 보인다)와 아래로 좁아지는 앞 몸통.')
def _bin(c):
    disc(c, 8, 9, 7, 4.5, OL); disc(c, 8, 9, 6, 3.7, ST(5))                                  # 림(밝음)
    disc(c, 8, 8.6, 5, 3, K('sumi', 0)); disc(c, 8, 9.4, 4.2, 2.3, K('sumi', 2))                   # 속: 뒷벽 어둡고 바닥 한 단 밝음
    rc(c, 6, 9, 3, 2, K('shiro', 3)); px(c, 10, 10, K('kii', 2)); px(c, 7, 8, K('shiro', 2)); px(c, 9, 9, K('sora', 2))
    rc(c, 2, 12, 12, 3, ST(1)); hl(c, 2, 12, 12, ST(-1)); vl(c, 2, 13, 2, ST(3)); vl(c, 13, 13, 2, ST(-2)); vl(c, 6, 13, 2, ST(-1)); vl(c, 10, 13, 2, ST(-1)); hl(c, 3, 15, 10, OL)
    px(c, 1, 11, OL); px(c, 14, 11, OL); vl(c, 1, 12, 3, OL); vl(c, 14, 12, 3, OL)


@reg('mc-umbrella-stand', '우산꽂이(철제 격자, 열린 아가리)', w=1, gate='container', tags=('복도', '현관', '교실', '학교'),
     place='현관·교실 문 옆', desc='사각 철제 우산꽂이 — 넓은 열린 윗 아가리 속에 검은·파랑·노랑 우산 손잡이 셋, 앞면 철 격자 틀.')
def _umbrella(c):
    outline(c, 1, 0, 14, 11, OL); rc(c, 2, 1, 12, 9, ST(4)); hl(c, 2, 1, 12, ST(6)); vl(c, 2, 1, 9, ST(5))
    rc(c, 3, 3, 10, 6, K('sumi', 0)); hl(c, 3, 3, 10, ST(-2)); rc(c, 4, 4, 8, 4, K('sumi', 1))
    for x, col in ((4, 'kon'), (8, 'kii'), (11, 'aka')):
        px(c, x, 4, K(col, 2)); px(c, x + 1, 4, K(col, 3)); vl(c, x, 5, 3, K(col, 0)); px(c, x + 1, 5, K(col, 1))
    rc(c, 2, 11, 12, 5, ST(0)); vl(c, 2, 11, 5, ST(3)); vl(c, 13, 11, 5, ST(-2)); hl(c, 2, 11, 12, ST(-1)); hl(c, 2, 14, 12, ST(-2))
    for x in range(4, 13, 3): vl(c, x, 12, 3, K('sumi', 1))
    hl(c, 1, 15, 14, OL)


# ══ 복도·사물함·계단실 ════════════════════════════════════════════════════════
@reg('mc-hall-locker', '복도 사물함 줄(철제 2×3 칸, 환기구)', w=2, up=16, gate='tall_furniture', use=('open',), tags=('복도', '사물함', '학교'),
     place='복도 벽 앞, 가로로 이어 줄을 만든다', desc='복도의 회청색 철제 사물함 2칸 — 윗면 넓은 철판, 앞 문 6칸에 환기 슬릿 세 줄과 작은 손잡이, 칸마다 색이 살짝 다르다.')
def _hall_locker(c):
    y = slab(c, 0, 3, 32, 29, 7, 'tekko', 2, olc=ST(-3), front_t=0, grain='steel')
    cols = ('sora', 'kon', 'midori', 'sora')
    for r in range(2):
        for k in range(4):
            x0, y0 = 1 + k * 8, y + r * 9
            rc(c, x0, y0, 7, 8, ST(1) if (r + k) % 2 else ST(0)); hl(c, x0, y0, 7, ST(4)); vl(c, x0, y0, 8, ST(3)); hl(c, x0, y0 + 7, 7, ST(-2))
            rc(c, x0 + 1, y0 + 1, 5, 1, K(cols[k], 0))
            for s in range(3): hl(c, x0 + 1, y0 + 2 + s * 2, 5, K('sumi', 1))
            px(c, x0 + 5, y0 + 6, K('kii', 3))
    hl(c, 0, 31, 32, OL)


@reg('mc-locker-bench', '사물함 앞 긴 의자(나무 판 + 쇠 다리)', w=2, gate='seat', use=('sit',), facing='N', tags=('복도', '사물함', '탈의', '학교'),
     place='사물함 줄 바로 앞', desc='긴 나무 판 의자 2칸 — 깊은 윗면 나뭇결과 앞 모서리 판, 양끝 쇠 다리 넷.')
def _locker_bench(c):
    slab(c, 1, 2, 30, 11, 7, 'ita', 2, olc=K('ita', -3), front_t=0, seed=6)
    hl(c, 3, 11, 26, K('ita', -2))
    legs(c, (3, 26), 13, 2)
    hl(c, 2, 15, 28, K('sumi', 0))


@reg('mc-shoe-rack-low', '낮은 실내화 선반(2단)', w=2, up=8, gate='low_furniture', use=('open',), tags=('복도', '현관', '기숙사', '학교'),
     place='현관·기숙사 방문 앞 벽', desc='낮은 쇠 선반 2칸 — 철판 윗면에 실내화 두 켤레, 앞 2단 칸마다 흰·청 실내화 코끝 색 덩이.')
def _shoe_rack(c):
    y = slab(c, 0, 8, 32, 24, 6, 'tekko', 2, olc=ST(-3), front_t=-1, grain='steel')
    for x, col in ((4, 'shiro'), (19, 'sora')):
        rc(c, x, 10, 8, 3, K(col, 2)); hl(c, x, 10, 8, K(col, 4)); outline(c, x - 1, 9, 10, 5, OL)
    for r in range(2):
        rc(c, 2, y + r * 6, 28, 5, K('yoru', -2)); hl(c, 2, y + r * 6, 28, K('sumi', 0))
        for k in range(4): rc(c, 4 + k * 7, y + r * 6 + 2, 4, 3, K(('shiro', 'sora', 'shiro', 'kon')[(k + r) % 4], 2))
    hl(c, 0, 31, 32, OL)


@reg('mc-water-fountain', '음수대(스테인리스 대야)', w=1, up=8, gate='container', use=('search',), tags=('복도', '학교', '체육관'),
     place='복도 벽 앞', desc='스테인리스 음수대 — 위에서 보이는 넓고 깊은 은색 사각 대야(안쪽 하늘색 물 바닥과 배수구 점), 뒤 꼭지, 앞 몸통 파란 버튼.')
def _fountain(c):
    outline(c, 0, 8, 16, 14, OL); rc(c, 1, 9, 14, 12, ST(5)); hl(c, 1, 9, 14, ST(6)); vl(c, 1, 9, 12, ST(6))
    rc(c, 3, 11, 10, 8, ST(-1)); hl(c, 3, 11, 10, ST(-3)); rc(c, 4, 12, 8, 6, K('garasu', 1)); hl(c, 4, 12, 8, K('garasu', -1)); hl(c, 4, 17, 8, K('garasu', 4)); px(c, 8, 15, K('sumi', 0)); px(c, 6, 14, K('garasu', 5))
    rc(c, 7, 4, 2, 6, ST(3)); px(c, 7, 3, ST(6)); px(c, 8, 3, ST(6)); hl(c, 6, 2, 4, OL); vl(c, 6, 3, 2, OL); vl(c, 9, 3, 2, OL)
    rc(c, 3, 22, 10, 9, ST(1)); vl(c, 3, 22, 9, ST(3)); vl(c, 12, 22, 9, ST(-2)); hl(c, 3, 22, 10, ST(-2)); px(c, 11, 25, K('sora', 3)); px(c, 11, 26, K('sora', 3)); outline(c, 2, 21, 12, 11, OL)


@reg('mc-fire-cabinet', '소화기함(빨간 문 + 흰 띠)', w=1, up=16, gate='tall_furniture', use=('open',), tags=('복도', '계단실', '학교'),
     place='복도·계단실 벽 앞', desc='빨간 소화기함 — 윗덮개에 흰 띠, 앞 빨간 문 가운데에 투명 창과 소화기 붉은 몸통, 아래 흰 호스 띠.')
def _fire(c):
    y = slab(c, 1, 3, 14, 29, 6, 'aka', 1, olc=K('aka', -2), front_t=0, grain=None)
    rc(c, 3, y, 10, 14, K('aka', -1)); outline(c, 3, y, 10, 14, K('aka', -2)); hl(c, 4, y + 1, 8, K('aka', 2))
    rc(c, 5, y + 3, 6, 8, GL(0)); outline(c, 5, y + 3, 6, 8, K('sumi', 0)); rc(c, 7, y + 4, 2, 6, K('aka', 2)); px(c, 7, y + 4, K('aka', 4))
    hl(c, 3, y + 15, 10, K('shiro', 3)); hl(c, 3, y + 16, 10, K('aka', -2))
    hl(c, 0, 31, 16, OL)


@reg('mc-vending-in', '실내 자판기(색 줄 3단, 글자 없음)', w=1, up=16, gate='tall_furniture', use=('search',), tags=('복도', '학교', '급식실', '기숙사'),
     place='복도 끝·급식실 벽 앞', desc='복도 자판기 — 튼 윗덮개, 앞 유리 속에 병 색 줄 3단, 오른쪽 동전 구멍 판과 아래 토출구 한 칸.')
def _vend_in(c):
    y = slab(c, 0, 2, 16, 30, 8, 'sora', 0, olc=K('sora', -2), front_t=-1, grain=None)
    rc(c, 2, y, 9, 15, K('garasu', -1)); outline(c, 2, y, 9, 15, K('sumi', 0)); hl(c, 3, y + 1, 7, GL(4))
    cols = ('aka', 'kii', 'midori', 'daidai', 'sora', 'pinku')
    for r in range(3):
        for i in range(4): rc(c, 3 + i * 2, y + 2 + r * 4, 2, 3, K(cols[(r * 2 + i) % 6], 1))
        hl(c, 3, y + 5 + r * 4, 8, ST(1))
    rc(c, 12, y, 3, 8, ST(2)); px(c, 13, y + 2, K('kii', 3)); rc(c, 13, y + 4, 1, 2, K('sumi', 0))
    rc(c, 3, y + 17, 9, 4, K('sumi', 1)); hl(c, 3, y + 17, 9, K('sumi', 0))
    hl(c, 0, 31, 16, OL)


@reg('mc-bulletin-stand', '이동식 게시판 스탠드', w=2, up=16, gate='frame', use=('read',), tags=('복도', '동아리방', '학교'),
     place='복도 가운데·동아리방 앞', desc='바퀴 달린 이동 게시판 — 짙은 틀의 넓은 윗 틀, 가운데 코르크 판에 색 종이 덩이, 양쪽 쇠 다리와 바퀴.')
def _bulletin(c):
    y = slab(c, 1, 3, 30, 22, 6, 'ita', 1, olc=K('ita', -3), front_t=0, seed=7)
    rc(c, 3, y, 26, 13, K('daidai', -1)); outline(c, 3, y, 26, 13, K('ita', -2))
    for (x, yy, w, h, col) in ((5, 1, 6, 5, 'kii'), (13, 2, 5, 6, 'pinku'), (20, 1, 7, 5, 'sora'), (6, 7, 7, 4, 'shiro'), (18, 8, 8, 4, 'midori')):
        rc(c, x - 2 + 3, y + yy, w, h, K(col, 2)); hl(c, x - 2 + 3, y + yy, w, K(col, 3))
    legs(c, (3, 27), y + 14, 6)
    for x in (3, 27): rc(c, x, 29, 2, 2, K('sumi', 0))
    hl(c, 2, 31, 28, OL)


# ══ 화장실 ═══════════════════════════════════════════════════════════════════
@reg('mc-toilet-stall', '화장실 칸막이 칸(문 닫힘)', w=1, up=16, gate='tall_furniture', use=('open',), tags=('화장실', '학교'),
     place='화장실 북쪽 벽 앞, 줄지어', desc='밝은 합판 칸막이 한 칸 — 윗면 얇은 판, 앞 문 가운데 빨강/파랑 표시 점, 문 아래 틈과 쇠 걸쇠.')
def _stall(c):
    y = slab(c, 0, 3, 16, 29, 5, 'kinari', 2, olc=K('kinari', -2), front_t=0, grain=None)
    for x in range(1, 15, 2): vl(c, x, 4, 4, K('kinari', 3))
    rc(c, 1, y, 14, 18, K('sora', 2)); outline(c, 1, y, 14, 18, K('sora', -1)); vl(c, 2, y + 1, 16, K('sora', 4)); vl(c, 14, y + 1, 16, K('sora', 0))
    hl(c, 2, y + 8, 12, K('sora', 1)); rc(c, 11, y + 6, 2, 3, ST(3)); px(c, 11, y + 7, K('aka', 2))
    hl(c, 2, y + 17, 12, K('sumi', 0)); rc(c, 2, y + 18, 12, 2, K('sumi', 1))
    hl(c, 0, 31, 16, OL)


@reg('mc-sink-vanity', '세면대 줄(2구, 아래 수납)', w=2, up=8, gate='low_furniture', use=('search',), tags=('화장실', '복도', '학교'),
     place='화장실·복도 벽 앞', desc='흰 대리석풍 세면대 줄 2칸 — 넓은 흰 윗판에 둥근 대야 둘과 은색 꼭지, 앞면은 닫힌 문 둘.')
def _vanity(c):
    y = slab(c, 0, 8, 32, 24, 8, 'shiro', 2, olc=K('conc', -1), front_t=-1, grain=None)
    for k in range(2):
        disc(c, 8 + k * 16, 13, 5, 3, K('conc', 2)); disc(c, 8 + k * 16, 13, 4, 2.4, K('garasu', 4)); px(c, 6 + k * 16, 12, K('shiro', 4))
        rc(c, 7 + k * 16, 8, 2, 3, ST(4)); px(c, 7 + k * 16, 7, ST(6)); px(c, 8 + k * 16, 7, ST(6))
        rc(c, 2 + k * 16, y, 12, 11, K('shiro', 1)); outline(c, 2 + k * 16, y, 12, 11, K('conc', 0)); px(c, 12 + k * 16 - 7, y + 3, ST(4))
    hl(c, 0, 31, 32, OL)


@reg('mc-clean-cart', '청소 카트(물통·걸레)', w=1, up=8, gate='tall_furniture', use=('open',), tags=('화장실', '복도', '학교'),
     place='화장실·복도 모퉁이', desc='노란 청소 카트 — 넓은 윗판에 파란 물통과 걸레 막대, 앞면 노란 주머니와 아래 바퀴.')
def _clean_cart(c):
    y = slab(c, 1, 8, 14, 22, 7, 'kii', 1, olc=K('kii', -2), front_t=0, grain=None)
    rc(c, 3, 9, 5, 5, K('sora', 1)); outline(c, 2, 8, 7, 7, OL); hl(c, 3, 9, 5, K('sora', 4))
    rc(c, 10, 9, 4, 5, K('shiro', 2)); outline(c, 9, 8, 6, 7, OL)
    vl(c, 13, 2, 7, K('ita', 1)); vl(c, 12, 4, 5, K('ita', 2)); rc(c, 11, 1, 4, 2, K('shiro', 1))
    rc(c, 3, y + 1, 10, 9, K('sora', -1)); outline(c, 3, y + 1, 10, 9, K('sora', -2)); hl(c, 4, y + 3, 8, K('sora', 1))
    for x in (2, 12): rc(c, x, 30, 2, 2, K('sumi', 0))


# ══ 급식실 ═══════════════════════════════════════════════════════════════════
@reg('mc-cafe-table', '급식실 긴 탁자(3칸, 밝은 합판 + 식판 줄)', w=3, gate='low_furniture', use=('sit',), tags=('급식실', '학교', '식당'),
     place='급식실 바닥, 줄마다 사이 2칸', desc='급식실 긴 탁자 3칸 — 깊은 연한 합판 윗판에 식판 여섯 개(회색 칸과 밥·국 색 점), 양끝 쇠 다리.')
def _cafe_table(c):
    slab(c, 1, 0, 46, 12, 9, 'kinari', 2, olc=K('ita', -2), front_t=-2, grain=None)
    for i in range(6):
        x0 = 3 + i * 7; col = ('kii', 'midori', 'aka', 'shiro', 'daidai', 'pinku')[i % 6]
        rc(c, x0, 2, 6, 7, ST(2)); outline(c, x0 - 1, 1, 8, 9, OL); hl(c, x0, 2, 6, ST(5))
        rc(c, x0 + 1, 3, 2, 3, K('shiro', 3)); rc(c, x0 + 3, 3, 2, 2, K(col, 1)); rc(c, x0 + 1, 6, 4, 2, K('ita', 1))
    for y in range(1, 9):
        for x in range(2, 46):
            if rnd(x, y, 17, 60): px(c, x, y, K('kinari', 3))
    hl(c, 3, 10, 42, K('kinari', 0)); legs(c, (3, 43), 13, 2)
    hl(c, 2, 15, 44, K('sumi', 0))


@reg('mc-cafe-table-2', '급식실 2칸 탁자 + 접이 의자 둘', w=2, gate='low_furniture', use=('sit',), facing='N', tags=('급식실', '학교', '식당'),
     place='급식실 벽 쪽 작은 줄', desc='급식실 2칸 탁자 — 연한 합판 깊은 윗판에 식판 넷, 아래 앞쪽 접이 의자 둘(짙은 나무 좌판).')
def _cafe_table2(c):
    slab(c, 1, 0, 30, 10, 8, 'kinari', 2, olc=K('ita', -2), front_t=-2, grain=None)
    for i in range(4):
        x0 = 3 + i * 7; rc(c, x0, 2, 6, 6, ST(2)); outline(c, x0 - 1, 1, 8, 8, OL); hl(c, x0, 2, 6, ST(5)); rc(c, x0 + 1, 3, 2, 3, K('shiro', 3)); rc(c, x0 + 3, 3, 2, 2, K(('kii', 'midori', 'aka', 'daidai')[i], 1))
    for x0 in (4, 18):
        rc(c, x0, 11, 9, 4, WD(0)); hl(c, x0, 11, 9, WD(2)); hl(c, x0, 14, 9, WD(-1)); outline(c, x0 - 1, 10, 11, 6, OL)
    legs(c, (3, 27), 10, 1)


@reg('mc-serving-counter', '배식대(3칸, 스테인리스 보온통 셋)', w=3, up=8, gate='low_furniture', use=('counter',), tags=('급식실', '학교', '식당'),
     place='급식실 한쪽 끝 벽 앞, 앞 2줄 줄 서는 자리', desc='스테인리스 배식대 3칸 — 넓은 은색 윗판 위 세 개의 보온통(열린 뚜껑 속 밥·국·반찬 색), 앞면 쇠판 두 줄과 아래 선반.')
def _serving(c):
    y = slab(c, 0, 6, 48, 26, 7, 'tekko', 2, olc=ST(-3), front_t=0, grain='steel')
    for k, col in enumerate(('shiro', 'kii', 'aka')):
        x0 = 3 + k * 15
        rc(c, x0, 8, 12, 5, ST(-1)); outline(c, x0 - 1, 7, 14, 7, OL)
        rc(c, x0 + 1, 8, 10, 3, K(col, 2)); hl(c, x0 + 1, 8, 10, K(col, 4)); px(c, x0 + 3, 9, K(col, 0)); px(c, x0 + 7, 10, K(col, 3))
        hl(c, x0, 12, 12, ST(5))
    hl(c, 1, y, 46, ST(1)); rc(c, 2, y + 1, 44, 8, ST(0)); hl(c, 2, y + 1, 44, ST(3)); hl(c, 2, y + 8, 44, ST(-2))
    for x in range(8, 44, 12): vl(c, x, y + 1, 8, ST(-1))
    rc(c, 2, y + 10, 44, 4, ST(2)); hl(c, 2, y + 10, 44, ST(5)); hl(c, 2, y + 13, 44, ST(-2))
    hl(c, 0, 31, 48, OL)


@reg('mc-tray-cart', '식판·배식 카트(2단, 식판 더미)', w=1, up=8, gate='tall_furniture', use=('open',), tags=('급식실', '학교', '식당'),
     place='배식대 옆·식기 반납구 앞', desc='바퀴 달린 은색 카트 — 넓은 윗판에 쌓은 식판 더미(회색 덩이)와 숟가락 통, 아래 선반에 흰 그릇 줄.')
def _tray_cart(c):
    y = slab(c, 1, 6, 14, 24, 7, 'tekko', 2, olc=ST(-3), front_t=0, grain='steel')
    for i in range(3): rc(c, 3, 8 - i, 10, 3, ST(3 - i)); hl(c, 3, 8 - i, 10, ST(6)); outline(c, 2, 7 - i, 12, 5, OL) if i == 2 else None
    rc(c, 11, 8, 2, 3, K('shiro', 2)); px(c, 12, 7, K('shiro', 4))
    rc(c, 3, y, 10, 5, ST(0)); hl(c, 3, y, 10, ST(3)); rc(c, 4, y + 1, 3, 3, K('shiro', 3)); rc(c, 8, y + 1, 4, 3, K('shiro', 2))
    rc(c, 3, y + 6, 10, 3, ST(1)); hl(c, 3, y + 6, 10, ST(4))
    for x in (2, 12): rc(c, x, 30, 2, 2, K('sumi', 0))


@reg('mc-cafe-stool', '급식실 동그란 의자(고정형)', w=1, gate='seat', use=('sit',), tags=('급식실', '학교', '식당'),
     place='급식실 탁자 곁', desc='둥근 빨간 방석 의자 — 넓은 윗면에 광택 점, 옆 가장자리와 가운데 쇠 기둥.')
def _stool(c):
    disc(c, 8, 7, 7, 5, OL); disc(c, 8, 7, 6, 4, K('aka', 1)); disc(c, 8, 6, 5, 3, K('aka', 3)); px(c, 6, 5, K('aka', 4)); px(c, 7, 5, K('aka', 4))
    rc(c, 7, 11, 2, 4, ST(1)); hl(c, 5, 15, 6, ST(-1)); hl(c, 5, 14, 6, OL)


# ══ 교무실·도서관·보건실 ═══════════════════════════════════════════════════════
@reg('mc-carrel', '독서실 칸막이 책상(2칸)', w=2, up=8, gate='low_furniture', use=('sit', 'read'), facing='N', tags=('도서관', '학교', '책상'),
     place='도서관 벽 쪽 줄', desc='독서 책상 2칸 — 깊은 짙은 나무 윗판, 가운데 낮은 칸막이 판, 칸마다 램프 점과 아래 의자 둘.')
def _carrel(c):
    y = slab(c, 0, 4, 32, 15, 8, 'ita', 2, olc=K('ita', -3), front_t=-1, seed=8)
    vl(c, 15, 1, 8, K('ita', -2)); vl(c, 16, 1, 8, K('ita', 4))
    for x0 in (4, 20):
        rc(c, x0, 7, 4, 2, K('kii', 3)); px(c, x0 + 1, 6, ST(4)); rc(c, x0 + 6, 8, 5, 3, K('shiro', 3)); hl(c, x0 + 6, 8, 5, K('shiro', 4))
    legs(c, (2, 28), 19, 2)
    for x0 in (5, 21): rc(c, x0, 21, 8, 4, K('kon', 0)); hl(c, x0, 21, 8, K('kon', 2)); outline(c, x0 - 1, 20, 10, 6, OL)
    rc(c, 0, 26, 0, 0, OL)


@reg('mc-book-cart', '도서 반납 카트(3단)', w=1, up=8, gate='tall_furniture', use=('open',), tags=('도서관', '학교'),
     place='도서관 카운터 곁', desc='나무 바퀴 달린 카트 — 윗판에 책 더미 둘(빨강·파랑), 앞 3단 선반마다 색색 책등 줄.')
def _book_cart(c):
    y = slab(c, 1, 6, 14, 24, 7, 'yuka', 0, olc=K('ita', -3), front_t=-1, seed=9)
    rc(c, 3, 8, 4, 3, K('aka', 1)); hl(c, 3, 8, 4, K('aka', 3)); rc(c, 8, 7, 5, 4, K('sora', 1)); hl(c, 8, 7, 5, K('sora', 3))
    for r in range(3):
        hl(c, 2, y + r * 5 + 4, 12, K('ita', -1))
        for b in range(6): rc(c, 3 + b * 2, y + r * 5, 2, 4, K(('kii', 'midori', 'aka', 'sora', 'kon', 'daidai')[(b + r * 2) % 6], 1))
    for x in (2, 12): rc(c, x, 30, 2, 2, K('sumi', 0))


@reg('mc-catalog-drawers', '목록 서랍장(작은 서랍 3×4)', w=1, up=16, gate='tall_furniture', use=('open',), tags=('도서관', '교무실', '학교'),
     place='도서관 입구 벽 앞', desc='나무 서랍장 — 깊은 나무 윗판, 앞 작은 서랍 열두 칸마다 쇠 손잡이 점과 색 이름표 띠.')
def _catalog(c):
    y = slab(c, 1, 3, 14, 29, 6, 'yuka', -1, olc=K('ita', -3), front_t=-1, seed=10)
    for r in range(4):
        for k in range(3):
            x0, y0 = 2 + k * 4, y + r * 6
            rc(c, x0, y0, 4, 5, K('yuka', 0)); hl(c, x0, y0, 4, K('yuka', 2)); hl(c, x0, y0 + 4, 4, K('ita', -2)); px(c, x0 + 1, y0 + 2, ST(5)); px(c, x0 + 2, y0 + 1, K(('kii', 'sora', 'aka')[(r + k) % 3], 2))
    hl(c, 0, 31, 16, OL)


@reg('mc-nurse-desk', '보건실 책상(약상자·체온계 올림)', w=2, gate='low_furniture', use=('sit', 'read'), tags=('보건실', '학교', '책상'),
     place='보건실 창가', desc='흰 철제 책상 2칸 — 깊은 연한 윗판에 약상자(빨간 십자 블록)와 체온계·노트, 앞 서랍 둘과 쇠 다리.')
def _nurse_desk(c):
    y = slab(c, 0, 0, 32, 13, 8, 'shiro', 2, olc=K('conc', -1), front_t=-1, grain=None)
    rc(c, 3, 2, 8, 5, K('shiro', 4)); outline(c, 2, 1, 10, 7, OL); rc(c, 6, 2, 2, 5, K('aka', 2)); rc(c, 4, 4, 6, 1, K('aka', 2))
    rc(c, 15, 3, 7, 4, K('kinari', 3)); outline(c, 14, 2, 9, 6, OL); hl(c, 16, 4, 5, K('sumi', 1)); rc(c, 25, 3, 4, 1, K('sora', 2))
    for x in range(2, 30, 3):
        for yy in range(1, 8): px(c, x, yy, K('shiro', 3)) if rnd(x, yy, 3, 50) else None
    rc(c, 3, y, 10, 4, K('shiro', 1)); outline(c, 3, y, 10, 4, K('conc', 0)); px(c, 8, y + 1, ST(4))
    legs(c, (3, 27), 13, 3)


@reg('mc-aid-cabinet', '구급 약장(흰 + 빨간 십자 띠)', w=1, up=16, gate='tall_furniture', use=('open',), tags=('보건실', '학교'),
     place='보건실 벽 앞', desc='흰 약장 — 흰 윗덮개, 앞 유리문 속 약병 줄 색 덩이, 문 가운데 빨간 십자 블록, 아래 닫힌 문.')
def _aid(c):
    y = slab(c, 1, 3, 14, 29, 6, 'shiro', 2, olc=K('conc', -1), front_t=0, grain=None)
    rc(c, 3, y, 10, 12, GL(0)); outline(c, 3, y, 10, 12, K('conc', 0)); hl(c, 4, y + 1, 8, GL(3))
    for r in range(2):
        for b in range(4): rc(c, 4 + b * 2 + (b // 2), y + 2 + r * 5, 2, 3, K(('aka', 'sora', 'kii', 'midori')[(b + r) % 4], 1))
        hl(c, 4, y + 5 + r * 5, 8, K('conc', 3))
    rc(c, 3, y + 13, 10, 10, K('shiro', 2)); outline(c, 3, y + 13, 10, 10, K('conc', 0)); rc(c, 7, y + 15, 2, 6, K('aka', 2)); rc(c, 5, y + 17, 6, 2, K('aka', 2))
    hl(c, 0, 31, 16, OL)


# ══ 기숙사 ═══════════════════════════════════════════════════════════════════
@reg('mc-dorm-bed', '기숙사 침대(남색 이불 + 흰 베개)', w=1, h=2, up=8, gate='low_furniture', use=('sleep',), tags=('기숙사', '학교', '침대'),
     place='기숙사 방 벽 쪽, 머리를 북쪽으로', desc='쇠 프레임 1인 침대 — 위쪽에 흰 베개, 아래로 남색 이불의 넓은 윗면(접힌 선과 가운데 주름), 발끝 쇠 틀.')
def _dorm_bed(c):
    outline(c, 0, 6, 16, 26, OL); rc(c, 1, 7, 14, 24, ST(1))
    rc(c, 3, 8, 10, 6, K('shiro', 4)); outline(c, 2, 7, 12, 8, K('conc', 2)); hl(c, 4, 9, 8, K('shiro', 3))
    rc(c, 1, 15, 14, 14, K('kon', 0)); hl(c, 1, 15, 14, K('kon', 3)); vl(c, 1, 15, 14, K('kon', 2)); vl(c, 14, 15, 14, K('kon', -1))
    for i in range(4): hl(c, 3, 18 + i * 3, 10, K('kon', -1)); hl(c, 3, 19 + i * 3, 10, K('kon', 1))
    hl(c, 1, 29, 14, K('kon', -2)); rc(c, 1, 30, 14, 1, ST(2)); hl(c, 0, 31, 16, OL)
    rc(c, 1, 2, 14, 5, ST(2)); outline(c, 0, 1, 16, 6, OL); hl(c, 1, 2, 14, ST(5)); vl(c, 3, 3, 3, ST(-1)); vl(c, 8, 3, 3, ST(-1)); vl(c, 12, 3, 3, ST(-1))


@reg('mc-dorm-desk', '기숙사 책상 + 위 선반(스탠드·책)', w=2, up=16, gate='tall_furniture', use=('sit', 'read'), facing='N', tags=('기숙사', '학교', '책상'),
     place='기숙사 방 창가 벽', desc='밝은 나무 책상 2칸 위에 책 선반 — 깊은 윗판에 스탠드와 노트북 덩이, 뒤 선반에 책 색 덩이 줄, 앞 서랍 하나.')
def _dorm_desk(c):
    rc(c, 1, 1, 30, 12, WD(-1)); outline(c, 0, 0, 32, 13, K('ita', -3)); hl(c, 1, 1, 30, WD(2))
    for b in range(11): rc(c, 2 + b * 2 + (b // 4), 3, 2, 4, K(('aka', 'sora', 'kii', 'midori', 'kon', 'daidai')[b % 6], 1))
    hl(c, 1, 8, 30, K('ita', 0))
    slab(c, 0, 12, 32, 20, 8, 'yuka', 1, olc=K('ita', -3), front_t=-1, seed=11)
    rc(c, 4, 14, 8, 5, ST(3)); outline(c, 3, 13, 10, 7, OL); rc(c, 5, 15, 6, 3, K('sora', 3)); hl(c, 5, 15, 6, K('sora', 4))
    px(c, 22, 14, K('kii', 3)); rc(c, 21, 15, 3, 3, K('kii', 1)); vl(c, 22, 18, 1, ST(2))
    rc(c, 16, 15, 4, 3, K('kinari', 3)); outline(c, 15, 14, 6, 5, OL)
    rc(c, 20, 23, 10, 6, K('yuka', -1)); outline(c, 20, 23, 10, 6, K('ita', -2)); px(c, 25, 25, ST(5))
    legs(c, (2, 28), 28, 3)


@reg('mc-dorm-wardrobe', '기숙사 옷장(두 문)', w=1, up=16, gate='tall_furniture', use=('open',), tags=('기숙사', '학교', '수납'),
     place='기숙사 방 벽 앞', desc='연한 나무 옷장 — 넓은 윗판, 앞 문 둘 가운데 세로 홈과 작은 손잡이 점, 아래 받침.')
def _wardrobe(c):
    y = slab(c, 1, 2, 14, 30, 7, 'yuka', 1, olc=K('ita', -3), front_t=-1, seed=12)
    for k in range(2):
        x0 = 2 + k * 6
        rc(c, x0, y, 6, 19, K('yuka', 0)); hl(c, x0, y, 6, K('yuka', 3)); vl(c, x0, y, 19, K('yuka', 2)); vl(c, x0 + 5, y, 19, K('yuka', -2)); hl(c, x0, y + 18, 6, K('ita', -2))
        px(c, x0 + (4 if k == 0 else 1), y + 9, ST(5))
    hl(c, 1, 31, 14, OL)


@reg('mc-mini-fridge', '미니 냉장고(은색 한 문)', w=1, up=8, gate='tall_furniture', use=('open',), tags=('기숙사', '학교', '급식실'),
     place='기숙사 방 책상 곁', desc='작은 은색 냉장고 — 깊은 윗판에 컵 하나, 앞 한 문 가운데 세로 손잡이와 위 얇은 냉동칸.')
def _fridge(c):
    y = slab(c, 1, 8, 14, 24, 7, 'tekko', 3, olc=ST(-3), front_t=1, grain='steel')
    rc(c, 3, 11, 3, 3, K('shiro', 3)); outline(c, 2, 10, 5, 5, OL)
    hl(c, 3, y + 5, 10, ST(-1)); vl(c, 4, y + 7, 7, ST(6)); vl(c, 5, y + 7, 7, ST(-2)); hl(c, 1, 31, 14, OL)


@reg('mc-lounge-sofa', '라운지 소파(2인, 남색 가죽풍)', w=2, up=8, gate='seat', use=('sit',), facing='S', tags=('기숙사', '동아리방', '도서관', '학교'),
     place='기숙사 라운지·동아리방 벽 쪽', desc='남색 2인 소파 — 등받이 윗면 띠, 방석 둘의 넓은 밝은 윗면(5행 이상), 어두운 앞면과 팔걸이 둘, 짧은 나무 다리.')
def _sofa(c):
    outline(c, 0, 2, 32, 10, OL); rc(c, 1, 3, 30, 4, K('kon', 3)); hl(c, 1, 3, 30, K('kon', 4)); rc(c, 1, 7, 30, 4, K('kon', -1)); hl(c, 1, 7, 30, K('kon', -2))   # 등받이: 윗면 띠 + 앞면
    for k in range(2):
        x0 = 4 + k * 13
        outline(c, x0 - 1, 11, 14, 14, OL); rc(c, x0, 12, 12, 7, K('kon', 3)); hl(c, x0, 12, 12, K('kon', 4)); vl(c, x0, 12, 7, K('kon', 4)); px(c, x0 + 5, 15, K('kon', 2))   # 방석 윗면 7행
        rc(c, x0, 19, 12, 5, K('kon', -1)); hl(c, x0, 19, 12, K('kon', -2)); vl(c, x0, 20, 4, K('kon', 1)); hl(c, x0, 23, 12, K('kon', -3))
    for x0 in (0, 28):
        outline(c, x0, 5, 4, 22, OL); rc(c, x0 + 1, 6, 2, 6, K('kon', 3)); rc(c, x0 + 1, 12, 2, 14, K('kon', -1))
    for x in (3, 27): rc(c, x, 27, 2, 3, WD(-2))
    hl(c, 1, 30, 30, K('sumi', 0))


@reg('mc-low-table', '낮은 탁자(밝은 나무, 책·컵)', w=2, gate='low_furniture', use=('read',), tags=('기숙사', '동아리방', '학교'),
     place='소파·라운지 앞', desc='낮고 깊은 밝은 나무 탁자 — 넓은 윗판에 책 한 권과 컵 둘, 앞 짧은 다리 넷.')
def _low_table(c):
    slab(c, 1, 2, 30, 11, 8, 'yuka', 2, olc=K('ita', -3), front_t=-1, seed=13)
    rc(c, 4, 4, 7, 4, K('aka', 1)); hl(c, 4, 4, 7, K('aka', 3)); outline(c, 3, 3, 9, 6, OL); hl(c, 5, 6, 5, K('shiro', 3))
    for x in (18, 23): rc(c, x, 5, 3, 3, K('shiro', 3)); outline(c, x - 1, 4, 5, 5, OL); px(c, x + 1, 6, K('daidai', 1))
    legs(c, (3, 27), 13, 2)


@reg('mc-bean-bag', '푸프(둥근 노랑 쿠션 의자)', w=1, gate='round_body', use=('sit',), tags=('기숙사', '동아리방', '학교'),
     place='라운지 구석', desc='원통형 노란 푸프 — 위에서 보이는 큰 타원 윗면(밝은 노랑, 가운데 단추 점)과 그 아래 짙은 노랑 옆면 띠, 바닥 둥근 그림자.')
def _beanbag(c):
    rc(c, 1, 8, 14, 6, K('kii', -1)); disc(c, 8, 13, 7, 2.5, K('kii', -1)); vl(c, 1, 8, 6, K('kii', 0)); vl(c, 14, 8, 6, K('kii', -2)); hl(c, 2, 12, 12, K('kii', -2))
    px(c, 0, 8, OL); vl(c, 0, 8, 6, OL); vl(c, 15, 8, 6, OL); hl(c, 3, 15, 10, OL); px(c, 1, 14, OL); px(c, 14, 14, OL)
    disc(c, 8, 7, 8, 5.5, OL); disc(c, 8, 7, 7, 4.6, K('kii', 3)); disc(c, 8, 6.5, 5.5, 3.4, K('kii', 4)); px(c, 8, 7, K('kii', 0)); px(c, 7, 7, K('kii', 1)); px(c, 9, 7, K('kii', 1))
    disc(c, 8, 9, 7, 2, K('kii', 2)); hl(c, 3, 10, 10, K('kii', 1)) if False else None


# ══ 동아리방 ═════════════════════════════════════════════════════════════════
@reg('mc-club-table', '동아리방 긴 탁자(3칸, 종이·노트북)', w=3, gate='low_furniture', use=('sit', 'read'), tags=('동아리방', '학교', '탁자'),
     place='동아리방 한가운데', desc='동아리방 긴 탁자 3칸 — 깊은 나무 윗판에 흩어진 종이 덩이와 노트북, 컵, 앞 짧은 다리.')
def _club_table(c):
    slab(c, 1, 0, 46, 12, 9, 'yuka', 0, olc=K('ita', -3), front_t=-1, seed=14)
    for (x, y, w, h, col) in ((4, 2, 8, 5, 'shiro'), (14, 3, 7, 5, 'kinari'), (36, 2, 8, 6, 'shiro')):
        rc(c, x, y, w, h, K(col, 3)); outline(c, x - 1, y - 1, w + 2, h + 2, OL); hl(c, x + 1, y + 2, w - 3, K('sumi', 1)); hl(c, x + 1, y + 4, w - 4, K('sumi', 1)) if h > 4 else None
    rc(c, 24, 2, 9, 6, ST(2)); outline(c, 23, 1, 11, 8, OL); rc(c, 25, 3, 7, 3, K('sora', 3)); hl(c, 25, 3, 7, K('sora', 4)); hl(c, 24, 7, 9, ST(5))
    rc(c, 22, 6, 2, 2, K('aka', 2))
    legs(c, (3, 43), 12, 3)
    hl(c, 2, 15, 44, K('sumi', 0))


@reg('mc-easel-board', '이동식 화이트보드(삼각 받침)', w=1, up=16, gate='frame', use=('read',), tags=('동아리방', '강의실', '학교'),
     place='동아리방 앞쪽', desc='이동식 화이트보드 — 흰 판에 은색 틀과 분필 대신 색 펜 선 몇 줄, 아래 펜 받침 홈과 삼각 다리.')
def _easel(c):
    y = slab(c, 0, 2, 16, 20, 5, 'tekko', 3, olc=ST(-3), front_t=1, grain='steel')
    rc(c, 1, y, 14, 10, K('shiro', 4)); outline(c, 1, y, 14, 10, ST(0))
    for (xx, yy, n, col) in ((3, 1, 8, 'sora'), (3, 4, 6, 'aka'), (3, 7, 9, 'midori')): hl(c, 1 + xx, y + yy, n, K(col, 1))
    hl(c, 1, y + 11, 14, ST(3)); hl(c, 2, y + 12, 12, ST(-2)); px(c, 4, y + 11, K('aka', 2)); px(c, 8, y + 11, K('sora', 2))
    vl(c, 3, y + 13, 6, ST(2)); vl(c, 12, y + 13, 6, ST(-1)); hl(c, 2, 31, 12, OL)


@reg('mc-club-shelf', '동아리방 잡동사니 선반(2칸)', w=2, up=16, gate='tall_furniture', use=('search',), tags=('동아리방', '학교', '수납'),
     place='동아리방 벽 앞', desc='나무 선반 2칸 — 깊은 윗판 위에 상자 둘과 공, 앞 3단 칸마다 책·상자·공 색 덩이가 뒤섞여 있다.')
def _club_shelf(c):
    y = slab(c, 0, 3, 32, 29, 7, 'ita', 1, olc=K('ita', -3), front_t=0, seed=15)
    rc(c, 3, 4, 6, 4, K('daidai', 1)); hl(c, 3, 4, 6, K('daidai', 3)); disc(c, 20, 6, 3, 3, K('aka', 1)); px(c, 19, 5, K('aka', 4)); rc(c, 24, 4, 5, 4, K('sora', 1)); hl(c, 24, 4, 5, K('sora', 3))
    for r in range(3):
        rc(c, 2, y + r * 7, 28, 6, K('ita', -2)); hl(c, 2, y + r * 7, 28, K('ita', -3))
        for k in range(7):
            if hs(k, r, 15) % 4: rc(c, 3 + k * 4, y + r * 7 + 1 + hs(k, r, 2) % 2, 3, 5, K(('kii', 'aka', 'sora', 'midori', 'kon', 'daidai', 'pinku')[(k + r * 3) % 7], 1))
    hl(c, 0, 31, 32, OL)


@reg('mc-trophy-case', '트로피 장(유리문 + 금속 컵)', w=2, up=16, gate='tall_furniture', use=('read',), tags=('복도', '동아리방', '학교'),
     place='현관·복도 벽 앞', desc='나무 유리문 진열장 — 깊은 윗판, 앞 유리 속 3단 선반에 금색 컵과 은색 방패 덩이, 아래 닫힌 문.')
def _trophy(c):
    y = slab(c, 0, 3, 32, 29, 7, 'ita', 1, olc=K('ita', -3), front_t=0, seed=16)
    rc(c, 2, y, 28, 17, K('garasu', -1)); outline(c, 2, y, 28, 17, K('ita', -2)); hl(c, 3, y + 1, 26, GL(4))
    for r in range(3):
        hl(c, 3, y + 5 + r * 5, 26, K('garasu', 3))
        for k in range(4):
            x0 = 5 + k * 6
            if (k + r) % 3 == 0: rc(c, x0, y + 1 + r * 5, 3, 4, K('mado', 1)); px(c, x0 + 1, y + 1 + r * 5, K('mado', 3)); hl(c, x0 - 1, y + 4 + r * 5, 5, K('mado', 0))
            elif (k + r) % 3 == 1: rc(c, x0, y + 2 + r * 5, 4, 3, ST(2)); px(c, x0 + 1, y + 2 + r * 5, ST(6))
            else: disc(c, x0 + 1.5, y + 3 + r * 5, 1.6, 1.6, K('aka', 1))
    rc(c, 2, y + 18, 28, 7, K('ita', 0)); outline(c, 2, y + 18, 28, 7, K('ita', -2)); vl(c, 15, y + 18, 7, K('ita', -2)); px(c, 13, y + 21, ST(5)); px(c, 17, y + 21, ST(5))
    hl(c, 0, 31, 32, OL)


@reg('mc-amp', '기타 앰프(검은 스피커 상자)', w=1, up=8, gate='box', use=('light',), tags=('동아리방', '학교', '음악'),
     place='동아리방 구석', desc='검은 앰프 상자 — 윗면 손잡이와 조절 knob 줄(흰 점), 앞 둥근 스피커 천 격자와 모서리 금속 점.')
def _amp(c):
    y = slab(c, 1, 8, 14, 24, 6, 'yoru', 0, olc=K('sumi', 0), front_t=-2, grain=None)
    hl(c, 5, 10, 6, ST(4)); px(c, 4, 11, K('shiro', 4)); px(c, 8, 11, K('aka', 2)); px(c, 11, 11, K('shiro', 4))
    disc(c, 8, y + 7, 5, 5, K('sumi', 1)); disc(c, 8, y + 7, 4, 4, K('yoru', -2))
    for yy in range(y + 3, y + 12, 2): hl(c, 5, yy, 7, K('yoru', -1))
    px(c, 2, y, K('mado', 3)); px(c, 13, y, K('mado', 3)); px(c, 2, y + 13, K('mado', 3)); px(c, 13, y + 13, K('mado', 3)); hl(c, 1, 31, 14, OL)


# 4회차까지 한 번도 못 통과해 버린 조각(소스는 남기되 굽지·등록하지 않는다 — 기록용). 대체품은 campus_interior_v2.py.
DROPPED = ['mc-chair-stack', 'mc-trash-bin', 'mc-vending-in', 'mc-bulletin-stand', 'mc-toilet-stall', 'mc-clean-cart', 'mc-book-cart', 'mc-aid-cabinet', 'mc-mini-fridge', 'mc-easel-board', 'mc-trophy-case', 'mc-amp']
DROPPED += ['mc-stall-block', 'mc-vending-low']   # 대체품도 4회차까지 못 통과(좁은 윗면이 「정면 입면도」로 읽힘)
for _d in DROPPED: R.objs.pop(_d, None)


# ══ 재설계(새 id — 낮고 넓은 형태로 윗면을 키운 대체품; 키 큰 좁은 가구는 관문이 「정면 입면도」로 막았다) ══
def _top_items(c, x, y, w, top, items):
    for (dx, dy, kind, col) in items:
        if kind == 'box': rc(c, x + dx, y + dy, 5, 4, K(col, 1)); hl(c, x + dx, y + dy, 5, K(col, 3)); hl(c, x + dx, y + dy + 3, 5, K(col, -1)); outline(c, x + dx - 1, y + dy - 1, 7, 6, OL)
        elif kind == 'books':
            for b in range(3): rc(c, x + dx, y + dy + b * 2, 6, 2, K(('aka', 'sora', 'midori')[b], 1)); hl(c, x + dx, y + dy + b * 2, 6, K(('aka', 'sora', 'midori')[b], 3))
            outline(c, x + dx - 1, y + dy - 1, 8, 8, OL)
        elif kind == 'plant': disc(c, x + dx + 2.5, y + dy + 1.5, 3, 2.4, K('midori', 1)); px(c, x + dx + 1, y + dy, K('midori', 3)); rc(c, x + dx, y + dy + 3, 5, 2, K('daidai', 0)); outline(c, x + dx - 1, y + dy - 1, 7, 7, OL)
        elif kind == 'bottle': rc(c, x + dx, y + dy, 2, 5, K(col, 2)); px(c, x + dx, y + dy, K(col, 4)); outline(c, x + dx - 1, y + dy - 1, 4, 7, OL)


def retop(c, x, y, w, top, ramp, t=2, grain=True, seed=0):
    """슬래브 윗면(x,y,w,top 안쪽)을 다른 램프로 다시 칠해 앞면과 확실히 갈리게 한다."""
    rc(c, x + 1, y + 1, w - 2, top, K(ramp, t)); hl(c, x + 1, y + 1, w - 2, K(ramp, t + 1)); vl(c, x + 1, y + 1, top, K(ramp, t + 1))
    hl(c, x + 1, y + top, w - 2, K(ramp, t - 1))
    if grain: wood_top(c, x + 1, y + 1, w - 2, top, ramp, t, seed)


@reg('mc-dorm-dresser', '기숙사 서랍장(낮고 넓은 3단, 위에 소품)', w=2, up=8, gate='low_furniture', use=('open',), tags=('기숙사', '학교', '수납'),
     place='기숙사 방 벽 앞', desc='낮고 넓은 연한 나무 서랍장 2칸 — 깊은 윗판에 화분·상자·책, 앞 3단 서랍마다 쇠 손잡이 점.')
def _dresser(c):
    y = slab(c, 0, 8, 32, 24, 9, 'yuka', 1, olc=K('ita', -3), front_t=-1, seed=31)
    _top_items(c, 1, 9, 30, 9, [(3, 1, 'plant', None), (12, 2, 'books', None), (22, 3, 'box', 'sora')])
    for r in range(3):
        rc(c, 2, y + r * 4, 28, 3, K('yuka', 0)); hl(c, 2, y + r * 4, 28, K('yuka', 2)); hl(c, 2, y + r * 4 + 2, 28, K('ita', -2)); px(c, 15, y + r * 4 + 1, ST(5)); px(c, 16, y + r * 4 + 1, ST(5))
    hl(c, 0, 31, 32, OL)


@reg('mc-cleaning-wagon', '청소 수레(낮고 넓은 노랑, 물통·솔 올림)', w=2, up=8, gate='low_furniture', use=('open',), tags=('화장실', '복도', '학교'),
     place='화장실·복도 모퉁이', desc='낮고 넓은 노란 청소 수레 2칸 — 깊은 윗판 위에 파란 물통 둘과 솔 막대, 앞 노란 판과 파란 주머니, 아래 바퀴 넷.')
def _wagon(c):
    y = slab(c, 0, 8, 32, 24, 9, 'kii', 1, olc=K('kii', -2), front_t=-1, grain=None)
    for x0 in (3, 12):
        rc(c, x0, 10, 7, 6, K('sora', 1)); outline(c, x0 - 1, 9, 9, 8, OL); hl(c, x0, 10, 7, K('sora', 4)); rc(c, x0 + 1, 11, 5, 3, K('garasu', -2))
    vl(c, 24, 4, 11, K('ita', 1)); vl(c, 25, 5, 10, K('ita', 3)); rc(c, 22, 3, 6, 2, K('shiro', 1)); outline(c, 21, 2, 8, 4, OL)
    rc(c, 3, y + 1, 12, 7, K('sora', -1)); outline(c, 3, y + 1, 12, 7, K('sora', -2)); hl(c, 4, y + 3, 10, K('sora', 1)); rc(c, 17, y + 1, 12, 7, K('kii', -1)); outline(c, 17, y + 1, 12, 7, K('kii', -2))
    for x in (2, 28): rc(c, x, 30, 3, 2, K('sumi', 0)); px(c, x, 30, ST(0))


@reg('mc-book-trolley', '도서 수레(낮은 2칸, 책 더미 올림)', w=2, up=8, gate='low_furniture', use=('open',), tags=('도서관', '학교'),
     place='도서관 카운터 곁', desc='낮은 나무 수레 2칸 — 깊은 윗판에 쌓인 책 더미 셋(빨강·파랑·초록), 앞 2단 선반마다 색 책등 줄, 아래 바퀴.')
def _trolley(c):
    y = slab(c, 0, 8, 32, 24, 9, 'yuka', 0, olc=K('ita', -3), front_t=-1, seed=32)
    _top_items(c, 1, 9, 30, 9, [(3, 1, 'books', None), (13, 2, 'books', None), (23, 1, 'books', None)])
    for r in range(2):
        hl(c, 2, y + r * 6 + 5, 28, K('ita', -2))
        for b in range(10): rc(c, 3 + b * 3, y + r * 6, 2, 5, K(('kii', 'midori', 'aka', 'sora', 'kon', 'daidai')[(b + r * 2) % 6], 1))
    for x in (2, 28): rc(c, x, 30, 3, 2, K('sumi', 0))


@reg('mc-aid-counter', '보건실 약 진열대(낮은 2칸, 약병 올림)', w=2, up=8, gate='low_furniture', use=('open',), tags=('보건실', '학교'),
     place='보건실 벽 앞', desc='낮은 흰 약 진열대 2칸 — 깊은 연한 윗판에 약병·약상자(빨간 십자 블록), 앞 두 문 가운데 파란 줄.')
def _aid_counter(c):
    y = slab(c, 0, 8, 32, 24, 9, 'shiro', 2, olc=K('conc', -1), front_t=-1, grain=None)
    rc(c, 3, 10, 7, 5, K('shiro', 4)); outline(c, 2, 9, 9, 7, OL); rc(c, 6, 10, 1, 5, K('aka', 2)); rc(c, 4, 12, 5, 1, K('aka', 2))
    _top_items(c, 1, 9, 30, 9, [(13, 2, 'bottle', 'sora'), (17, 2, 'bottle', 'midori'), (21, 2, 'bottle', 'aka'), (25, 3, 'box', 'kii')])
    for k in range(2): rc(c, 2 + k * 15, y, 13, 11, K('shiro', 1)); outline(c, 2 + k * 15, y, 13, 11, K('conc', 0)); hl(c, 3 + k * 15, y + 3, 11, K('sora', 1)); px(c, 8 + k * 15, y + 6, ST(4))
    hl(c, 0, 31, 32, OL)


@reg('mc-fridge-counter', '급식 냉장 보관대(낮은 은색, 전자레인지·상자 올림)', w=2, up=8, gate='low_furniture', use=('open',), tags=('급식실', '기숙사', '학교'),
     place='급식실·기숙사 부엌 벽 앞', desc='낮은 은색 냉장 보관대 2칸 — 깊은 쇠판 윗면에 전자레인지와 상자, 앞 문 둘에 세로 손잡이.')
def _fridge_counter(c):
    y = slab(c, 0, 8, 32, 24, 9, 'tekko', 3, olc=ST(-3), front_t=0, grain='steel')
    rc(c, 3, 10, 11, 6, ST(-1)); outline(c, 2, 9, 13, 8, OL); rc(c, 4, 11, 6, 4, K('garasu', -1)); px(c, 12, 12, K('kii', 3)); px(c, 12, 14, K('aka', 2)); hl(c, 3, 10, 11, ST(4))
    _top_items(c, 1, 9, 30, 9, [(19, 2, 'box', 'daidai'), (26, 3, 'bottle', 'sora')])
    for k in range(2): rc(c, 2 + k * 15, y, 13, 11, ST(1)); outline(c, 2 + k * 15, y, 13, 11, ST(-2)); hl(c, 3 + k * 15, y + 1, 11, ST(4)); vl(c, 4 + k * 8, y + 3, 6, ST(6))
    hl(c, 0, 31, 32, OL)


@reg('mc-trophy-shelf', '트로피 선반(낮은 2칸, 금색 컵·방패 올림)', w=2, up=8, gate='low_furniture', use=('read',), tags=('복도', '동아리방', '학교'),
     place='현관·동아리방 벽 앞', desc='낮은 짙은 나무 진열대 2칸 — 깊은 윗판 위에 금색 컵 둘·은 방패·붉은 공, 앞 유리 칸 속 작은 트로피 줄.')
def _trophy_shelf(c):
    y = slab(c, 0, 8, 32, 24, 9, 'ita', 1, olc=K('ita', -3), front_t=-2, seed=33); retop(c, 0, 8, 32, 9, 'yuka', 2, seed=33)
    for x0 in (4, 22): rc(c, x0, 12, 3, 4, K('mado', 1)); px(c, x0 + 1, 11, K('mado', 3)); hl(c, x0 - 1, 15, 5, K('mado', 0)); outline(c, x0 - 1, 10, 5, 7, OL)
    rc(c, 12, 11, 5, 5, ST(2)); px(c, 13, 11, ST(6)); outline(c, 11, 10, 7, 7, OL); disc(c, 26, 13, 2, 2, K('aka', 1)); px(c, 25, 12, K('aka', 4))
    for r in range(2):
        for k in range(2):
            x0 = 2 + k * 15; rc(c, x0, y + r * 6, 13, 5, K('ita', 0)); hl(c, x0, y + r * 6, 13, K('ita', 3)); hl(c, x0, y + r * 6 + 4, 13, K('ita', -2)); px(c, x0 + 6, y + r * 6 + 2, K('mado', 3))
    hl(c, 0, 31, 32, OL)


@reg('mc-amp-stack', '앰프 낮은 단(2칸, 검은 상자 둘)', w=2, up=8, gate='low_furniture', use=('light',), tags=('동아리방', '학교', '음악'),
     place='동아리방 구석', desc='검은 앰프 둘이 나란한 낮은 단 2칸 — 깊은 윗면에 knob 줄(흰·빨강 점)과 케이블 고리, 앞 둥근 스피커 천 격자.')
def _amp_stack(c):
    y = slab(c, 0, 8, 32, 24, 9, 'yuka', 1, olc=K('ita', -3), front_t=-1, seed=35)
    for k in range(2):
        x0 = 3 + k * 15
        rc(c, x0 + 1, 11, 9, 4, K('sumi', 0)); outline(c, x0, 10, 11, 6, OL); rc(c, x0 + 2, 12, 7, 2, K('aka', 1) if k else K('sora', 1)); px(c, x0 + 3, 12, K('shiro', 4)); hl(c, x0 + 1, 11, 9, ST(2))
        rc(c, x0, y, 11, 11, ST(2)); outline(c, x0, y, 11, 11, ST(-3)); hl(c, x0 + 1, y + 1, 9, ST(5))
        for i in range(4): px(c, x0 + 2 + i * 2, y + 3, K('sumi', 0)); px(c, x0 + 2 + i * 2, y + 4, K('shiro', 4))
        hl(c, x0 + 1, y + 7, 9, K('sumi', 1)); hl(c, x0 + 1, y + 8, 9, ST(-1))
    hl(c, 0, 31, 32, OL)


@reg('mc-bin-wide', '큰 쓰레기통(둥근 넓은 아가리)', w=1, gate='container', tags=('교실', '복도', '급식실', '학교'),
     place='교실 뒤·급식실 벽 곁', desc='녹색 큰 쓰레기통 — 위에서 보이는 큰 타원 아가리 속에 휴지·병이 쌓인 어두운 바닥, 밝은 림, 앞 몸통에 세로 홈.')
def _bin_wide(c):
    disc(c, 8, 6, 7.5, 5.5, OL); disc(c, 8, 6, 6.8, 4.8, K('midori', 3)); disc(c, 8, 5.4, 5.6, 3.7, K('sumi', 0)); disc(c, 8, 6.6, 4.6, 2.6, K('sumi', 2))
    rc(c, 5, 6, 3, 2, K('shiro', 3)); px(c, 9, 7, K('kii', 2)); px(c, 10, 6, K('sora', 2)); px(c, 7, 5, K('shiro', 2)); px(c, 6, 8, K('aka', 1))
    rc(c, 2, 8, 12, 7, K('midori', 0)); vl(c, 2, 8, 7, K('midori', 1)); vl(c, 13, 8, 7, K('midori', -1)); vl(c, 6, 9, 5, K('midori', -1)); vl(c, 10, 9, 5, K('midori', -1)); hl(c, 3, 15, 10, OL)
    vl(c, 1, 8, 7, OL); vl(c, 14, 8, 7, OL)


@reg('mc-lecture-stool', '실험실 둥근 의자 둘(나란히)', w=2, gate='seat', use=('sit',), tags=('강의실', '이과실', '학교'),
     place='실험대·강의실 앞', desc='둥근 나무 좌판 의자 둘 — 위에서 보이는 큰 타원 좌판(결과 광택)과 그 아래 쇠 기둥·발판 고리.')
def _stool2(c):
    for k in range(2):
        cx = 8 + k * 16
        disc(c, cx, 7, 7, 5, OL); disc(c, cx, 7, 6, 4, WD(1)); disc(c, cx, 6.5, 5, 3, WD(3)); px(c, cx - 3, 5, WD(4)); px(c, cx - 2, 5, WD(4)); hl(c, cx - 3, 7, 6, WD(2))
        rc(c, cx - 1, 11, 2, 4, ST(1)); hl(c, cx - 4, 15, 8, ST(-1)); hl(c, cx - 4, 14, 8, OL)


@reg('mc-stall-block', '화장실 칸막이 2칸 묶음(낮은 문 + 윗 틀)', w=2, up=8, gate='other', use=('open',), tags=('화장실', '학교'),
     place='화장실 북쪽 벽 앞 — 낮게 보이는 칸막이 줄', desc='밝은 합판 칸막이 두 칸 — 깊은 연한 윗 틀 위에 판 두 장, 앞 파란 문 둘에 빨강/파랑 표시 점과 걸쇠.')
def _stall_block(c):
    y = slab(c, 0, 8, 32, 24, 9, 'kinari', 2, olc=K('kinari', -2), front_t=-1, grain=None)
    _top_items(c, 1, 9, 30, 9, [(4, 2, 'box', 'sora'), (13, 2, 'plant', None), (22, 3, 'books', None)])
    for k in range(2):
        x0 = 2 + k * 15; rc(c, x0, y, 13, 11, K('sora', 1)); outline(c, x0, y, 13, 11, K('sora', -1)); vl(c, x0 + 1, y + 1, 9, K('sora', 3)); hl(c, x0 + 1, y + 1, 11, K('sora', 3))
        rc(c, x0 + 8, y + 3, 2, 3, ST(3)); px(c, x0 + 8, y + 4, K('aka' if k == 0 else 'midori', 2)); hl(c, x0 + 1, y + 9, 11, K('sumi', 1))
    hl(c, 0, 31, 32, OL)


@reg('mc-vending-low', '낮은 자판기 겸 냉장 진열대(2칸, 글자 없음)', w=2, up=8, gate='low_furniture', use=('search',), tags=('복도', '급식실', '기숙사', '학교'),
     place='복도 끝·급식실 벽 앞', desc='낮은 파란 자판기형 진열대 2칸 — 깊은 윗판에 음료 상자와 병, 앞 유리 속 병 색 줄 두 단과 토출구.')
def _vend_low(c):
    y = slab(c, 0, 8, 32, 24, 9, 'shiro', 2, olc=K('conc', -1), front_t=-1, grain=None)
    _top_items(c, 1, 9, 30, 9, [(4, 2, 'box', 'daidai'), (13, 2, 'bottle', 'aka'), (17, 2, 'bottle', 'kii'), (22, 2, 'bottle', 'midori')])
    for k in range(2):
        x0 = 2 + k * 15; rc(c, x0, y, 13, 11, K('sora', 0)); outline(c, x0, y, 13, 11, K('sora', -2)); hl(c, x0 + 1, y + 1, 11, K('sora', 3)); vl(c, x0 + 1, y + 1, 9, K('sora', 2))
        rc(c, x0 + 3, y + 3, 7, 4, K('garasu', -1)); outline(c, x0 + 3, y + 3, 7, 4, OL); px(c, x0 + 5, y + 4, K('aka', 2)); px(c, x0 + 7, y + 4, K('kii', 2)); px(c, x0 + 11, y + 8, K('kii', 3))
    hl(c, 0, 31, 32, OL)


for _d in DROPPED: R.objs.pop(_d, None)


# ══ 관문·굽기 ═══════════════════════════════════════════════════════════
def kit_images():
    """{id: (RGBA ndarray, gate kind, 한국어 이름)} — 바닥·벽면은 한 주기 그림(terrain)."""
    out = {}
    for id_, f in R.floors.items(): out[id_] = (R._canvas(f['draw'], f['cols'] * 16, f['rows'] * 16), 'terrain', f['ko'])
    for id_, w in R.walls.items(): out[id_] = (R._canvas(w['draw'], w['cols'] * 16, 32), 'terrain', w['ko'])
    for id_, o in R.objs.items(): out[id_] = (R.obj_image(id_)[0], o.get('gate', 'low_furniture'), o['ko'])
    return out


def palette_issues(a, tag):
    own = {c for r in RAMPS.values() for c in r}; bad = []
    al = a[..., 3]
    if not np.all((al == 0) | (al == 255)): bad.append('%s: 반투명' % tag)
    for y, x in zip(*np.nonzero(al == 255)):
        v = (int(a[y, x, 0]) << 16) | (int(a[y, x, 1]) << 8) | int(a[y, x, 2])
        if v not in own or v == 0xe040c0: bad.append('%s: 팔레트 밖 #%06x @%d,%d' % (tag, v, x, y)); break
    return bad


def main(argv):
    only = None
    if '--only' in argv: only = set(argv[argv.index('--only') + 1:])
    imgs = kit_images(); bad = []
    gd = os.path.join(OUT, '_gate'); os.makedirs(gd, exist_ok=True)
    lines = []
    for id_, (a, kind, ko) in imgs.items():
        bad += palette_issues(a, id_)
        if not a[..., 3].any(): bad.append('%s: 빈 그림' % id_)
        if id_ in R.objs:
            o = R.objs[id_]
            if o['kind'] not in ('hang',) and a.shape[0] != (math.ceil(o['up'] / 16) + o['h']) * 16: bad.append('%s: 높이' % id_)
            if o['kind'] not in ('hang',) and a[:, :, 3][-1].sum() == 0 and False: bad.append('%s: 밑줄 빔' % id_)
            wrong = [u for u in o['use'] if u not in ('sit', 'sleep', 'open', 'search', 'read', 'counter', 'travel', 'light', 'save', 'heal', 'switch', 'push', 'trap', 'key', 'gate', 'seal', 'walk', 'block')]
            if wrong: bad.append('%s: use %s' % (id_, wrong))
        if only and id_ not in only: continue
        p = os.path.join(gd, id_ + '.png'); Image.fromarray(a, 'RGBA').save(p)
        lines.append(dict(png=p, kind=kind, name=ko, label='modern-campus-int/' + id_))
    with open(os.path.join(OUT, '_gate', 'items.jsonl' if not only else 'items-only.jsonl'), 'w') as f:
        for m in lines: f.write(json.dumps(m, ensure_ascii=False) + '\n')
    # 눈 확인 시트
    parts = [(i, a) for i, (a, k, n) in imgs.items()]
    W = 640; x = y = 4; rowh = 0; place = []
    for i, a in parts:
        h, w = a.shape[:2]
        if x + w + 4 > W: x, y, rowh = 4, y + rowh + 6, 0
        place.append((x, y, a)); x += w + 6; rowh = max(rowh, h)
    sheet = np.zeros((y + rowh + 4, W, 4), np.uint8); sheet[:, :, :3] = (58, 56, 66); sheet[:, :, 3] = 255
    for (x0, y0, a) in place: blit(sheet, a, x0, y0)
    im = Image.fromarray(sheet, 'RGBA'); os.makedirs(os.path.join(OUT, 'preview'), exist_ok=True)
    im.resize((im.width * 3, im.height * 3), Image.NEAREST).save(os.path.join(OUT, 'preview', '_all-x3.png'))
    print('modern_campus 실내 — 바닥 %d · 벽면 %d · 가구 %d (벽걸이 %d) · 실패 %d' % (len(R.floors), len(R.walls), len(R.objs), sum(1 for o in R.objs.values() if o['kind'] == 'hang'), len(bad)))
    for m in bad[:30]: print('  x', m)
    return 1 if bad else 0


if __name__ == '__main__':
    sys.exit(main(sys.argv))
