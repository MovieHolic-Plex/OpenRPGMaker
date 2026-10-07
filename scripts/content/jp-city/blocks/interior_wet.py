#!/usr/bin/env python3
"""jp_city 블록 interior_wet — 일본 실내 욕실·탈의실·화장실 가구(유닛바스 욕조·세면대·세탁기·변기·탁상 소품).
  python3 scripts/content/jp-city/blocks/interior_wet.py     # selftest + tiledata/jp-city/blocks/interior_wet/_all-x3.png
틀(칸 자르기·사양 굽기)은 interior/ikit.py. 여기는 그림 함수와 메타만 쓴다. 팔레트는 K(램프, 단) 만(생 hex·반투명 금지), 윤곽 OL, 빛은 왼쪽 위.

크기(스타일 북 §12-3 표, 1칸=16px=1m): bathtub 1.6×0.75×0.55 → 2×1칸, F9 T6(물이 보이도록 T 12 까지 허용 — 오목한 물건),
toilet 0.4×0.7×0.8 → F12 T4(+뒤 물탱크가 벽면 위로 8px), washing_machine 0.6×0.6×0.85 → F12 T4.
표에 없는 것은 같은 공식(size_calc.py): washbasin 0.75×0.5×0.85(+거울 0.7m) → 1×2칸 캔버스, bath-stool 0.3×0.3×0.25 → F6 T4.
3/4: 키 큰 벽 가구는 윗면 4~6px + 앞 가장자리 하이라이트 1행 + 처마 그림자, 앞면은 들어간다. 걸이(hang)는 벽 앞면에 붙는 평면이라 평평해도 된다."""
import os, sys
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, '..', 'interior'))
from ikit import Registry, K, OL, run_block, ROOT   # noqa: E402,F401

BLOCK = 'interior_wet'
R = Registry(BLOCK, '욕실·화장실')
WET = ('욕실', '탈의실', '화장실')


# ── 그림 도우미 ──
def outline(c, x, y, w, h, col=OL):
    c.HL(x, y, w, col); c.HL(x, y + h - 1, w, col); c.VL(x, y, h, col); c.VL(x + w - 1, y, h, col)


def box(c, x, y, w, t, f, top, front, hi=None):
    """윗면 t행 + 앞 가장자리 하이라이트 1행 + 앞면 f행(왼쪽 밝고 오른쪽 어둡다) + 윤곽."""
    c.R(x, y, w, t, K(top, 1)); c.HL(x + 1, y, w - 2, K(top, 2))
    c.HL(x, y + t, w, K(hi or top, 2))
    c.R(x, y + t + 1, w, f - 1, K(front, 0)); c.VL(x + 1, y + t + 1, f - 1, K(front, 1)); c.VL(x + w - 2, y + t + 1, f - 1, K(front, -1))
    c.HL(x, y + t + f - 1, w, K(front, -1))
    outline(c, x, y, w, t + f + 1 - 1 + 0)


def disc(c, cx, cy, r, col):
    for y in range(int(cy - r - 1), int(cy + r + 2)):
        for x in range(int(cx - r - 1), int(cx + r + 2)):
            if (x + .5 - cx) ** 2 + (y + .5 - cy) ** 2 <= r * r: c.P(x, y, col)


def ring(c, cx, cy, r, col, w=1.0):
    for y in range(int(cy - r - 2), int(cy + r + 3)):
        for x in range(int(cx - r - 2), int(cx + r + 3)):
            d = ((x + .5 - cx) ** 2 + (y + .5 - cy) ** 2) ** .5
            if r - w <= d <= r: c.P(x, y, col)


def oval(c, cx, cy, rx, ry, col):
    for y in range(int(cy - ry - 1), int(cy + ry + 2)):
        for x in range(int(cx - rx - 1), int(cx + rx + 2)):
            if ((x + .5 - cx) / rx) ** 2 + ((y + .5 - cy) / ry) ** 2 <= 1: c.P(x, y, col)


# ── 욕조 ──
def _tub(c, lid=False):
    W = c.w; B = c.h
    x0, x1 = 1, W - 2                      # 욕조 몸 x 범위
    top = B - 21                           # 뒤 테두리 윗줄
    # 뒤 테두리 + 안쪽 벽(물 위로 보이는 욕조 안벽)
    c.R(x0, top, x1 - x0 + 1, 2, K('shiro', 2)); c.HL(x0 + 1, top, x1 - x0 - 1, K('shiro', 2))
    c.R(x0, top + 2, x1 - x0 + 1, 2, K('shiro', -1))
    # 물
    c.R(x0 + 1, top + 4, x1 - x0 - 1, 8, K('sora', 1))
    for i in range(x0 + 3, x1 - 2, 5): c.HL(i, top + 6, 3, K('sora', 2))
    for i in range(x0 + 6, x1 - 4, 6): c.HL(i, top + 9, 2, K('sora', 2))
    c.HL(x0 + 1, top + 4, x1 - x0 - 1, K('sora', 0)); c.HL(x0 + 1, top + 11, x1 - x0 - 1, K('sora', 0))
    # 앞 테두리 윗면 + 앞 가장자리 하이라이트 + 앞면(에이프런)
    c.R(x0, top + 12, x1 - x0 + 1, 2, K('shiro', 2)); c.HL(x0, top + 14, x1 - x0 + 1, K('shiro', 1))
    c.R(x0, top + 15, x1 - x0 + 1, 6, K('shiro', 0)); c.VL(x0 + 1, top + 15, 6, K('shiro', 1)); c.VL(x1 - 1, top + 12, 9, K('shiro', -1))
    c.HL(x0, top + 20, x1 - x0 + 1, K('shiro', -1))
    c.HL(x0 + 3, top + 17, x1 - x0 - 5, K('shiro', -1))                       # 에이프런 패널 이음선
    c.R(x1 - 6, top + 17, 3, 2, K('conc', 0))                                  # 배수 점검구
    outline(c, x0 - 1, top - 1, x1 - x0 + 3, 23)
    if lid:
        mid = x0 + (x1 - x0) // 2 + 1
        c.R(mid, top + 3, x1 - mid, 10, K('conc', 2))                          # 접이식 덮개(오른쪽 절반)
        for i in range(mid + 2, x1, 3): c.VL(i, top + 3, 10, K('conc', 1))
        c.HL(mid, top + 3, x1 - mid, K('shiro', 2)); c.HL(mid, top + 12, x1 - mid, K('conc', -1)); c.VL(mid, top + 3, 10, K('conc', -1))
        c.HL(mid - 1, top + 4, 1, K('sora', 0))


@R.obj('bathtub', '욕조', w=2, h=1, up=8, kind='wall', cat='bath', cat_ko='욕실', tags=WET, place='욕실 안쪽 벽', use=('목욕',),
       desc='유닛바스 욕조(2×1칸). 물이 담긴 수면과 안벽이 보이고 앞쪽 에이프런에 점검구가 있다. 욕실 북쪽 벽 바로 아래에 둔다.', pair=('bathtub-lid', 'shower-faucet'))
def _bathtub(c): _tub(c)


@R.obj('bathtub-lid', '욕조(덮개 반쯤)', w=2, h=1, up=8, kind='wall', cat='bath', cat_ko='욕실', tags=WET, place='욕실 안쪽 벽',
       desc='욕조 변형 — 접이식 덮개가 오른쪽 절반을 덮고 왼쪽 절반은 물이 보인다. 목욕 뒤 온기 보존 연출.', pair=('bathtub',))
def _bathtub_lid(c): _tub(c, True)


# ── 샤워·거울·수건걸이(걸이) ──
@R.obj('shower-faucet', '샤워·수전', w=1, kind='hang', hrows=1, cat='bath', cat_ko='욕실', tags=('욕실',), place='욕조·샤워 위 벽면',
       desc='벽 걸이 샤워 수전 — 수도꼭지 두 개와 샤워 헤드가 달린 봉. 욕실 벽면 윗줄(욕조 위).', pair=('bathtub', 'bath-stool'))
def _shower(c):
    c.R(7, 0, 2, 4, K('tekko', 0)); c.VL(7, 0, 4, K('tekko', 2))
    for x0 in (2, 11):                                                         # 온·냉 수전
        c.R(x0, 11, 3, 4, K('tekko', 1)); c.HL(x0, 11, 3, K('tekko', 3)); outline(c, x0 - 1, 10, 5, 6)
    c.R(3, 14, 1, 1, K('aka', 2)); c.R(12, 14, 1, 1, K('sora', 2))
    c.R(6, 3, 4, 3, K('tekko', 1)); c.HL(6, 3, 4, K('tekko', 3))              # 헤드 이음
    c.R(4, 6, 8, 3, K('tekko', 2)); c.HL(4, 6, 8, K('shiro', 2)); c.HL(5, 8, 6, K('tekko', -1)); outline(c, 3, 5, 10, 5)
    for x in range(5, 12, 2): c.P(x, 8, K('conc', -1))
    c.R(6, 9, 4, 2, K('tekko', 0))


@R.obj('bath-mirror', '욕실 거울', w=1, kind='hang', hrows=1, cat='bath', cat_ko='욕실', tags=('욕실',), place='욕실 벽',
       desc='욕실 벽 거울 — 김 서림 방지 얇은 틀. 벽 앞면에 붙은 평면.')
def _bath_mirror(c):
    c.R(2, 1, 12, 14, K('shiro', 1)); outline(c, 1, 0, 14, 16)
    c.R(3, 2, 10, 12, K('garasu', 3))
    for i in range(6): c.P(4 + i, 11 - i, K('garasu', 4 if i != 3 else 3)); c.P(5 + i, 11 - i, K('shiro', 2))
    c.HL(3, 2, 10, K('garasu', 2)); c.VL(3, 2, 12, K('garasu', 2)); c.HL(3, 13, 10, K('garasu', 1))
    c.HL(2, 14, 12, K('shiro', -1))


@R.obj('towel-rack', '수건걸이', w=1, kind='hang', hrows=1, cat='bath', cat_ko='욕실', tags=WET, place='탈의실·욕실 벽',
       desc='벽 걸이 수건 봉 — 흰 봉에 수건 한 장이 걸려 있다.')
def _towel_rack(c):
    c.R(2, 2, 12, 1, K('tekko', 3)); c.VL(1, 1, 3, K('tekko', 1)); c.VL(14, 1, 3, K('tekko', 1)); c.R(1, 1, 1, 1, K('tekko', 3)); c.R(14, 1, 1, 1, K('tekko', 3))
    c.R(3, 3, 9, 9, K('sora', 2)); c.R(3, 3, 9, 1, K('sora', 2)); c.VL(3, 3, 9, K('sora', 2)); c.VL(11, 4, 8, K('sora', 2))
    c.HL(3, 11, 9, K('sora', 2)); c.HL(3, 7, 9, K('shiro', 2)); c.HL(3, 8, 9, K('shiro', 1))
    outline(c, 2, 2, 11, 10)
    c.R(5, 12, 7, 2, K('kinari', 2)); c.HL(5, 12, 7, K('shiro', 2)); outline(c, 4, 12, 9, 3)


# ── 욕실 바닥 소품 ──
@R.obj('bath-stool', '목욕 의자', w=1, h=1, kind='floor', cat='bath', cat_ko='욕실', tags=('욕실',), place='샤워 앞', pair=('bath-bucket', 'bathtub'),
       desc='낮은 플라스틱 목욕 의자. 앉는 면이 위에서 보이고 다리 셋이 보인다. 샤워 앞 바닥.')
def _bath_stool(c):
    oval(c, 8, 7, 5.5, 3.5, K('sora', 1)); oval(c, 8, 6.5, 4.5, 2.5, K('sora', 2))
    c.HL(5, 5, 5, K('sora', 2))
    for x in (4, 10): c.R(x, 9, 3, 5, K('sora', 1)); c.VL(x, 9, 5, K('sora', 2)); c.R(x, 13, 3, 1, K('sora', -1))
    c.R(7, 10, 2, 3, K('sora', -1)); c.R(6, 14, 4, 1, K('hodo', -1))
    c.HL(3, 8, 10, K('sora', -1))


@R.obj('bath-bucket', '세숫대야', w=1, h=1, kind='flat', cat='bath', cat_ko='욕실', tags=('욕실',), place='욕실 바닥',
       desc='욕실 바닥에 놓인 세숫대야. 걸을 수 있는 바닥 무늬(위에서 본 둥근 테두리와 물).')
def _bucket(c):
    disc(c, 8.5, 9, 6, K('hodo', -1)); disc(c, 8, 8, 5.5, K('kii', 1)); disc(c, 8, 8, 4, K('sora', 1))
    ring(c, 8, 8, 5.5, K('kii', 2), 1); ring(c, 8, 8, 5.9, OL, 0.8)
    c.HL(6, 6, 3, K('sora', 2)); c.P(10, 9, K('sora', 2)); c.R(13, 7, 1, 2, K('kii', -1))


@R.obj('bath-mat', '욕실 발매트', w=1, h=1, kind='flat', cat='bath', cat_ko='욕실', tags=('탈의실', '욕실'), place='욕조 앞·탈의실 문 앞',
       desc='욕실 앞 발매트(바닥 무늬). 흰 파일 직물에 푸른 테두리.')
def _bath_mat(c):
    c.R(1, 3, 14, 10, K('shiro', 1)); c.R(2, 4, 12, 8, K('shiro', 2)); outline(c, 1, 3, 14, 10, K('sora', 1))
    c.HL(2, 4, 12, K('sora', 2)); c.HL(2, 11, 12, K('sora', 2))
    for x in range(3, 13, 2): c.P(x, 7, K('shiro', 0)); c.P(x + 1, 8, K('shiro', 0))
    c.HL(1, 13, 14, K('hodo', -1))


# ── 탈의실 ──
@R.obj('washbasin', '세면대(거울·수납)', w=1, h=1, up=16, kind='wall', cat='bath', cat_ko='욕실', tags=('탈의실', '세면실'), place='탈의실 북쪽 벽 아래',
       surface=True, use=('세수', '양치'), desc='세면화장대 1×2칸 캔버스 — 아래 세면볼·수납장, 위로 벽면에 오르는 거울. 탈의실 북쪽 벽 바로 아래.',
       pair=('washing-machine', 'towel-rack', 'toothbrush-cup', 'soap'))
def _washbasin(c):
    # 거울(벽면 위로 솟음)
    c.R(2, 1, 12, 13, K('ita', 1)); c.HL(2, 1, 12, K('ita', 2)); outline(c, 1, 0, 14, 15)
    c.R(3, 2, 10, 11, K('garasu', 3)); c.HL(3, 2, 10, K('garasu', 2)); c.VL(3, 2, 11, K('garasu', 2))
    for i in range(5): c.P(5 + i, 10 - i, K('garasu', 4)); c.P(6 + i, 10 - i, K('shiro', 2))
    c.R(11, 4, 1, 1, K('shiro', 2))
    # 캐비닛: 윗면(세면볼 포함) + 앞 가장자리 + 앞면
    c.R(1, 15, 14, 5, K('shiro', 2)); outline(c, 0, 14, 16, 7)
    oval(c, 8, 17.5, 4.5, 2, K('shiro', -1)); oval(c, 8, 17.5, 3.5, 1.5, K('shiro', 0)); c.R(8, 15, 1, 1, K('tekko', 3)); c.HL(7, 14, 3, K('tekko', 2))
    c.HL(1, 20, 14, K('shiro', 1))
    c.R(1, 21, 14, 10, K('ita', 1)); c.VL(2, 21, 10, K('ita', 2)); c.VL(13, 21, 10, K('ita', -1)); c.HL(1, 30, 14, K('ita', -1))
    c.VL(8, 22, 8, K('ita', -2)); c.R(7, 25, 1, 3, K('tekko', 3)); c.R(9, 25, 1, 3, K('tekko', 3))
    c.R(2, 22, 5, 7, K('ita', 0)); c.R(9, 22, 5, 7, K('ita', 0))
    c.HL(2, 21, 12, K('ita', -2)); c.HL(1, 21, 14, K('ita', -2))


@R.obj('washing-machine', '세탁기', w=1, h=1, kind='floor', cat='bath', cat_ko='욕실', tags=('탈의실', '세탁'), place='탈의실',
       surface=True, use=('빨래',), desc='드럼 세탁기(0.6m). 윗면과 조작부, 앞면의 둥근 유리 문. 탈의실에 둔다.', pair=('laundry-basket', 'washbasin'))
def _washer(c):
    c.R(2, 1, 12, 4, K('shiro', 2)); c.HL(2, 1, 12, K('shiro', 2)); c.R(3, 3, 5, 1, K('conc', 1)); c.R(10, 3, 2, 1, K('aka', 2))
    c.HL(2, 5, 12, K('shiro', 2))
    c.R(2, 6, 12, 9, K('shiro', 1)); c.VL(3, 6, 9, K('shiro', 2)); c.VL(12, 6, 9, K('shiro', -1)); c.HL(2, 14, 12, K('shiro', -2))
    disc(c, 8, 10.5, 4, K('tekko', 1)); disc(c, 8, 10.5, 3, K('garasu', 1)); disc(c, 8, 11, 2, K('garasu', 2))
    c.P(6, 9, K('garasu', 4)); c.P(7, 9, K('garasu', 4)); c.P(6, 10, K('shiro', 2))
    c.R(11, 7, 1, 1, K('sora', 2))
    outline(c, 1, 0, 14, 16)


@R.obj('laundry-basket', '빨래 바구니', w=1, h=1, kind='floor', cat='bath', cat_ko='욕실', tags=('탈의실',), place='탈의실',
       desc='엮은 빨래 바구니 — 윗면으로 수건이 삐져나와 있다. 탈의실 바닥.', pair=('washing-machine',))
def _basket(c):
    oval(c, 8, 5, 5.5, 3, K('ita', -1)); oval(c, 8, 5, 4.5, 2.2, K('shiro', 1))
    oval(c, 7, 4.5, 3, 1.5, K('aka', 2)); c.HL(5, 3, 4, K('aka', 2)); c.R(9, 4, 3, 1, K('sora', 2)); c.R(10, 3, 2, 1, K('sora', 2))
    c.R(2, 6, 12, 9, K('ita', 2)); c.HL(2, 6, 12, K('ita', 3)); c.VL(2, 6, 9, K('ita', 3)); c.VL(13, 6, 9, K('ita', 0)); c.HL(2, 14, 12, K('ita', 0))
    for y in range(8, 14, 2):
        for x in range(3, 13, 3): c.R(x + (1 if y % 4 == 0 else 0), y, 2, 1, K('ita', 1))
    c.HL(2, 6, 12, K('ita', 3)); outline(c, 1, 3, 14, 12)


# ── 화장실 ──
@R.obj('toilet', '양변기', w=1, h=1, up=8, kind='wall', facing='S', cat='bath', cat_ko='욕실', tags=('화장실',), place='화장실 북쪽 벽 아래',
       use=('화장실',), desc='양변기(남쪽을 향함) — 뒤 물탱크가 벽면 위로 솟고 앞에 뚜껑 닫힌 변좌가 위에서 보인다. 화장실 북쪽 벽 바로 아래.',
       pair=('toilet-handwash', 'toilet-paper', 'toilet-mat'))
def _toilet(c):
    # 물탱크
    c.R(3, 9, 10, 4, K('shiro', 2)); c.HL(3, 9, 10, K('shiro', 2)); c.HL(3, 13, 10, K('shiro', 1)); c.R(3, 14, 10, 7, K('shiro', 0))
    c.VL(4, 14, 7, K('shiro', 1)); c.VL(11, 14, 7, K('shiro', -1)); c.R(10, 10, 2, 2, K('tekko', 3)); outline(c, 2, 8, 12, 14)
    c.HL(3, 21, 10, K('shiro', -1))
    # 변좌(윗면, 타원) + 앞 도기
    oval(c, 8, 24, 5.5, 4, K('ita', 1)); oval(c, 8, 23.6, 4.5, 3, K('shiro', 2)); oval(c, 8, 24, 3, 1.5, K('shiro', 1))
    c.R(6, 23, 3, 1, K('shiro', 2))
    c.R(4, 27, 8, 4, K('shiro', 0)); c.VL(5, 27, 4, K('shiro', 1)); c.VL(10, 27, 4, K('shiro', -1)); c.HL(4, 30, 8, K('shiro', -2))
    c.HL(5, 27, 6, K('shiro', 2))
    outline(c, 3, 19, 10, 13)
    c.R(4, 21, 8, 1, K('shiro', -1))


@R.obj('toilet-handwash', '화장실 손씻기', w=1, kind='hang', hrows=1, cat='bath', cat_ko='욕실', tags=('화장실',), place='화장실 벽',
       desc='벽걸이 작은 손씻기 세면기(수전 포함). 화장실 벽 앞면에 붙은 평면.', pair=('toilet',))
def _handwash(c):
    c.R(7, 2, 2, 4, K('tekko', 2)); c.HL(5, 2, 6, K('tekko', 3)); c.R(5, 2, 1, 2, K('tekko', 2)); c.R(10, 2, 1, 2, K('tekko', 2))
    c.R(6, 5, 4, 2, K('tekko', 1)); c.P(8, 7, K('sora', 2))
    c.R(2, 8, 12, 3, K('shiro', 2)); c.HL(2, 8, 12, K('shiro', 2)); c.R(4, 9, 8, 1, K('shiro', -1))
    c.R(3, 11, 10, 3, K('shiro', 0)); c.HL(4, 13, 8, K('shiro', -2)); c.VL(4, 11, 3, K('shiro', 1)); c.VL(11, 11, 3, K('shiro', -1))
    outline(c, 1, 7, 14, 8)


@R.obj('toilet-paper', '화장지 홀더', w=1, kind='hang', hrows=1, cat='bath', cat_ko='욕실', tags=('화장실',), place='변기 옆 벽',
       desc='벽 화장지 홀더 — 휴지가 걸린 작은 선반. 평면 부착.')
def _tp(c):
    c.R(4, 4, 8, 7, K('ita', 1)); c.HL(4, 4, 8, K('ita', 2)); outline(c, 3, 3, 10, 9)
    disc(c, 8, 7, 3, K('shiro', 2)); disc(c, 8, 7, 1, K('tekko', 1)); c.VL(5, 5, 4, K('shiro', 0)); ring(c, 8, 7, 3, K('shiro', -1), 1)
    c.R(10, 9, 3, 4, K('shiro', 2)); c.HL(10, 12, 3, K('shiro', 0)); outline(c, 9, 8, 5, 6)


@R.obj('toilet-mat', '화장실 매트', w=1, h=1, kind='flat', cat='bath', cat_ko='욕실', tags=('화장실',), place='변기 앞',
       desc='변기 앞 발매트(바닥 무늬) — 연두색, 앞이 둥글게 파인 모양.')
def _toilet_mat(c):
    c.R(2, 2, 12, 12, K('midori', 2)); outline(c, 2, 2, 12, 12, K('midori', 1))
    oval(c, 8, 11, 3.5, 3, K('midori', 1)); c.R(5, 2, 6, 5, K('midori', 2))
    c.HL(3, 3, 10, K('midori', 2)); c.VL(3, 3, 9, K('midori', 2))
    for x in range(4, 13, 3): c.P(x, 5, K('midori', 2))


@R.obj('toilet-slippers', '화장실 슬리퍼', w=1, h=1, kind='flat', cat='bath', cat_ko='욕실', tags=('화장실',), place='화장실 문 앞',
       desc='화장실 전용 슬리퍼 한 켤레(바닥 무늬) — 위에서 본 모습.')
def _slippers(c):
    for x0 in (3, 9):
        c.R(x0, 4, 4, 9, K('aka', 2)); c.R(x0 + 1, 3, 2, 1, K('aka', 2)); c.R(x0 + 1, 13, 2, 1, K('aka', 1)); c.R(x0, 4, 1, 9, K('aka', 2))
        c.R(x0, 4, 4, 3, K('shiro', 1)); c.HL(x0, 4, 4, K('shiro', 2)); outline(c, x0 - 1, 2, 6, 12)
    c.HL(3, 14, 10, K('hodo', -1))


# ── 탁상 소품 16×16 ──
@R.good('toothbrush-cup', '칫솔 컵', desc='세면대 위 칫솔 컵 — 칫솔 두 개가 꽂혀 있다.')
def _cup(c):
    c.R(5, 4, 1, 5, K('aka', 2)); c.R(5, 3, 1, 1, K('shiro', 2)); c.R(8, 3, 1, 6, K('sora', 2)); c.R(8, 2, 1, 1, K('shiro', 2))
    c.R(4, 8, 7, 6, K('garasu', 3)); c.VL(5, 8, 6, K('garasu', 4)); c.VL(9, 8, 6, K('garasu', 2)); c.HL(4, 8, 7, K('shiro', 2)); c.HL(4, 13, 7, K('garasu', 1))
    outline(c, 3, 7, 9, 8)


@R.good('soap', '비누', desc='세면대·욕실 선반 위 비누와 비누받침.')
def _soap(c):
    c.R(3, 10, 10, 3, K('ita', 2)); c.HL(3, 10, 10, K('ita', 3)); outline(c, 2, 9, 12, 5)
    c.R(4, 6, 8, 4, K('pinku', 2)); c.HL(4, 6, 8, K('pinku', 2)); c.VL(4, 6, 4, K('pinku', 2)); c.HL(4, 9, 8, K('pinku', 1)); outline(c, 3, 5, 10, 6)
    c.P(6, 7, K('shiro', 2)); c.P(9, 8, K('shiro', 2))


def build(): return R.build()
def selftest(): return R.selftest()


if __name__ == '__main__':
    sys.exit(1 if run_block(R, os.path.join(ROOT, 'tiledata', 'jp-city', 'blocks', BLOCK)) else 0)
