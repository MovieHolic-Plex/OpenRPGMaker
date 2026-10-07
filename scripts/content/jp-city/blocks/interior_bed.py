#!/usr/bin/env python3
"""jp_city 블록 interior_bed — 일본 실내 침실·아이방 가구(침대·이층침대·책상·의자·옷장·화장대·탁상 소품).
  python3 scripts/content/jp-city/blocks/interior_bed.py     # selftest + tiledata/jp-city/blocks/interior_bed/_all-x3.png
틀(칸 자르기·사양 굽기)은 interior/ikit.py. 여기는 그림 함수와 메타만 쓴다. 팔레트는 K(램프, 단) 만(5단 램프 ±2, 7단 램프 ±3), 윤곽 OL, 빛은 왼쪽 위.

크기(스타일 북 §12-3, 1칸=16px=1m):
  bed_single 캔버스 1×2 발자국 1×2 T16 F8 · bed_double 2×2 T16 F9 · wardrobe_2 2×2 발자국 2×1 T4 F28(폭 26) ·
  low_dresser 2×1 T4 F12 · school_desk 1×1 T4 F12(폭 10) · office_desk 2×1 T4 F12 · chair 1×1 T4 F12
표에 없는 것은 같은 공식(atlas-pick/size_calc.py)으로 계산: bunk-bed 0.9×2.0×1.7m → 캔버스 1×4(up 32) 발자국 1×2,
  desk-study = office_desk + 얹은 책꽂이(벽면 위 14px) → 2×2 캔버스(up 16), bed-side-table 0.4×0.4×0.5 → T4 F9, mirror-stand 0.45×0.3×1.5 → up 16,
  laundry-rack 1.2×0.5×1.0 → 2×1 발자국 up 8.
3/4: 키 큰 벽 가구는 윗면 4~6px + 앞 가장자리 하이라이트 1행 + 처마 그림자, 앞면은 들어간다. 걸이는 벽 앞면 평면이라 평평해도 된다."""
import os, sys
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, '..', 'interior'))
from ikit import Registry, K, OL, run_block, ROOT   # noqa: E402,F401

BLOCK = 'interior_bed'
R = Registry(BLOCK, '침실·아이방')
BED = ('침실', '아이방')


def outline(c, x, y, w, h, col=OL):
    c.HL(x, y, w, col); c.HL(x, y + h - 1, w, col); c.VL(x, y, h, col); c.VL(x + w - 1, y, h, col)


def oval(c, cx, cy, rx, ry, col):
    for y in range(int(cy - ry - 1), int(cy + ry + 2)):
        for x in range(int(cx - rx - 1), int(cx + rx + 2)):
            if ((x + .5 - cx) / rx) ** 2 + ((y + .5 - cy) / ry) ** 2 <= 1: c.P(x, y, col)


def disc(c, cx, cy, r, col): oval(c, cx, cy, r, r, col)


# ── 침대 ──
def _bed(c, x0, w, yb, duvet, pillows=1, plain=False):
    """yb = 캔버스 아랫줄. 윗면 16행(yb-24..yb-9), 앞면 8행. 머리판은 윗면 위로 12행 솟는다. duvet = 이불 램프 이름."""
    ytop = yb - 24; x1 = x0 + w - 1
    # 머리판(북쪽 벽면에 기댐)
    c.R(x0, ytop - 12, w, 13, K('ita', 0)); c.HL(x0, ytop - 12, w, K('ita', 2)); c.R(x0 + 1, ytop - 10, w - 2, 9, K('ita', 1))
    c.HL(x0 + 1, ytop - 10, w - 2, K('ita', 2)); c.VL(x0 + 1, ytop - 10, 9, K('ita', 2)); c.VL(x1 - 1, ytop - 10, 9, K('ita', -1))
    c.HL(x0, ytop - 1, w, K('ita', -2)); outline(c, x0 - 1, ytop - 13, w + 2, 14)
    # 매트리스 윗면(시트)
    c.R(x0, ytop, w, 16, K('shiro', 1)); c.HL(x0, ytop, w, K('shiro', 2))
    # 베개
    n = pillows; pw = (w - 2 - (n - 1) * 2) // n
    for i in range(n):
        px = x0 + 1 + i * (pw + 2)
        c.R(px, ytop + 1, pw, 6, K('shiro', 2)); c.HL(px, ytop + 6, pw, K('shiro', -1)); c.VL(px + pw - 1, ytop + 2, 5, K('shiro', 0))
        c.P(px, ytop + 1, K('shiro', 1)); outline(c, px - 1, ytop, pw + 2, 8, K('shiro', -2))
    # 이불: 윗면 아래쪽 + 접힌 단
    c.R(x0, ytop + 8, w, 8, K(duvet, 0)); c.HL(x0, ytop + 8, w, K(duvet, 2)); c.HL(x0, ytop + 9, w, K(duvet, 1)); c.VL(x0, ytop + 8, 8, K(duvet, 1)); c.VL(x1, ytop + 8, 8, K(duvet, -1))
    if not plain:
        for i in range(x0 + 3, x1 - 1, 5): c.R(i, ytop + 12, 2, 2, K(duvet, 1)); c.P(i, ytop + 12, K(duvet, 2))
    c.HL(x0, ytop + 15, w, K(duvet, 2))
    # 앞면: 이불 늘어짐 4행 + 프레임 4행
    c.R(x0, ytop + 16, w, 4, K(duvet, -1)); c.VL(x0 + 1, ytop + 16, 4, K(duvet, 0)); c.HL(x0, ytop + 16, w, K(duvet, 2)); c.HL(x0, ytop + 19, w, K(duvet, -2))
    c.R(x0, ytop + 20, w, 4, K('ita', 0)); c.HL(x0, ytop + 20, w, K('ita', 1)); c.VL(x0 + 1, ytop + 20, 4, K('ita', 1)); c.VL(x1 - 1, ytop + 20, 4, K('ita', -1)); c.HL(x0, ytop + 23, w, K('ita', -2))
    # 윗면·앞면 윤곽
    c.VL(x0 - 1, ytop, 24, OL); c.VL(x1 + 1, ytop, 24, OL); c.HL(x0 - 1, ytop + 24, w + 2, OL)
    c.P(x0 - 1, ytop - 1, OL)


@R.obj('bed-single', '1인용 침대', w=1, h=2, up=16, kind='wall', cat='bed', cat_ko='침실', tags=BED, place='침실 북쪽 벽 아래(머리판이 벽에)',
       use=('잠자기',), desc='1인용 침대(1×2칸). 머리판이 북쪽 벽면에 기대고, 윗면에 베개와 이불이 3/4 시점으로 보인다.', pair=('bed-side-table', 'alarm-clock', 'stuffed-toy'))
def _bed_single(c): _bed(c, 1, 14, c.h, 'sora', 1)


@R.obj('bed-double', '2인용 침대', w=2, h=2, up=16, kind='wall', cat='bed', cat_ko='침실', tags=('침실', '부부 침실'), place='침실 북쪽 벽 아래',
       use=('잠자기',), desc='2인용 침대(2×2칸). 베개 둘, 넓은 이불. 양옆에 침대 곁 탁자를 둔다.', pair=('bed-side-table', 'dresser-low', 'alarm-clock'))
def _bed_double(c): _bed(c, 1, 30, c.h, 'aka', 2, plain=False)


@R.obj('bunk-bed', '이층침대', w=1, h=2, up=32, kind='wall', cat='bed', cat_ko='침실', tags=('아이방',), place='아이방 북쪽 벽 아래',
       use=('잠자기',), desc='이층침대(1×2칸 발자국, 키 2칸 높이). 위층 매트리스 윗면과 앞 이불, 아래층 베개가 보이고 오른쪽에 사다리가 있다.', pair=('desk-study', 'stuffed-toy'))
def _bunk(c):
    yb = c.h                                               # 64
    x0, x1 = 1, 14
    # 기둥(뒤쪽 두 개는 위층 윗면 위로 솟음)
    c.R(x0, 4, 2, yb - 4, K('ita', 0)); c.VL(x0, 4, yb - 4, K('ita', 2)); c.R(x1 - 1, 4, 2, yb - 4, K('ita', -1))
    # 아래층: 윗면 40..55, 앞면 56..63
    c.R(x0 + 2, 40, 10, 16, K('shiro', 1)); c.R(x0 + 2, 40, 10, 5, K('shiro', 2)); c.HL(x0 + 2, 44, 10, K('shiro', -1))
    c.R(x0 + 2, 46, 10, 10, K('kii', 0)); c.HL(x0 + 2, 46, 10, K('kii', 2)); c.HL(x0 + 2, 55, 10, K('kii', -1))
    c.R(x0, 56, 14, 3, K('kii', -1)); c.HL(x0, 56, 14, K('kii', 1)); c.R(x0, 59, 14, 5, K('ita', 0)); c.HL(x0, 59, 14, K('ita', 1)); c.HL(x0, 63, 14, K('ita', -2))
    # 위층 아래의 어두운 틈(그림자)
    c.R(x0 + 2, 31, 10, 9, K('ita', -2)); c.HL(x0 + 2, 31, 10, K('ita', -3))
    # 위층: 윗면 10..25, 앞면 26..31
    c.R(x0, 10, 14, 16, K('shiro', 1)); c.HL(x0, 10, 14, K('shiro', 2))
    c.R(x0 + 1, 11, 10, 5, K('shiro', 2)); c.HL(x0 + 1, 15, 10, K('shiro', -1)); outline(c, x0, 10, 12, 6, K('shiro', -2))
    c.R(x0, 17, 14, 9, K('kii', 0)); c.HL(x0, 17, 14, K('kii', 2)); c.HL(x0, 18, 14, K('kii', 1)); c.VL(x0, 17, 9, K('kii', 1))
    for i in range(x0 + 3, x1 - 3, 5): c.R(i, 21, 2, 2, K('kii', 1))
    c.R(x0, 26, 14, 3, K('kii', -1)); c.HL(x0, 26, 14, K('kii', 2)); c.R(x0, 29, 14, 3, K('ita', 0)); c.HL(x0, 29, 14, K('ita', 1)); c.HL(x0, 31, 14, K('ita', -2))
    # 위층 난간(왼쪽 짧게)과 사다리
    c.HL(x0, 9, 14, K('ita', 2)); c.HL(x0, 10, 14, K('ita', 1))
    c.VL(11, 26, 38, K('ita', 0)); c.VL(13, 26, 38, K('ita', -1))
    for y in range(34, 62, 6): c.HL(11, y, 3, K('ita', 2)); c.HL(11, y + 1, 3, K('ita', -2))
    outline(c, x0 - 1, 3, 16, yb - 3)
    c.HL(x0 - 1, yb - 1, 16, OL)


# ── 책상·의자 ──
@R.obj('desk-study', '공부 책상(책꽂이)', w=2, h=1, up=16, kind='wall', cat='bed', cat_ko='침실', tags=('아이방', '서재'), place='아이방 벽면',
       surface=True, use=('공부', '숙제'), desc='책꽂이가 붙은 공부 책상(2×1칸 발자국). 벽면 위로 책꽂이, 아래로 서랍 책상 — 윗면에 스탠드·책을 놓는다.',
       pair=('desk-chair-n', 'desk-lamp', 'books-stack', 'randoseru'))
def _desk(c):
    # 책꽂이(벽면 위)
    c.R(3, 1, 26, 15, K('ita', 1)); c.HL(3, 1, 26, K('ita', 3)); c.VL(3, 1, 15, K('ita', 2)); c.VL(28, 1, 15, K('ita', -1)); outline(c, 2, 0, 28, 16)
    c.R(4, 3, 24, 5, K('ita', -2)); c.R(4, 9, 24, 5, K('ita', -2))                  # 칸 안쪽
    cols = [('aka', 0), ('kon', 0), ('midori', 0), ('kii', 0), ('sora', 0), ('murasaki', 0)]
    x = 5
    for i in range(7):
        col = cols[i % 6]; h = 5 if i % 3 else 4
        c.R(x, 8 - h, 3, h, K(col[0], col[1])); c.VL(x, 8 - h, h, K(col[0], 2)); x += 3 + (i % 2)
    x = 5
    for i in range(6):
        col = cols[(i + 2) % 6]; h = 5 if i % 2 else 4
        c.R(x, 14 - h, 3, h, K(col[0], col[1])); c.VL(x, 14 - h, h, K(col[0], 2)); x += 3 + (i % 2)
    c.HL(4, 8, 24, K('ita', 2)); c.HL(4, 14, 24, K('ita', 2))
    # 책상 윗면(8행) + 앞 가장자리
    c.R(1, 16, 30, 7, K('yuka', 1)); c.HL(1, 16, 30, K('yuka', 2)); c.HL(1, 22, 30, K('yuka', 2)); outline(c, 0, 15, 32, 9)
    c.HL(1, 23, 30, K('ita', -1))
    # 앞면: 왼쪽 서랍장 + 오른쪽 다리 둘 사이 무릎 공간
    c.R(1, 24, 10, 8, K('ita', 1)); c.VL(2, 24, 8, K('ita', 2)); c.VL(10, 24, 8, K('ita', -1)); c.HL(1, 31, 10, K('ita', -2))
    c.HL(3, 27, 6, K('ita', -2)); c.HL(3, 30, 6, K('ita', -2)); c.R(5, 25, 2, 1, K('tekko', 3)); c.R(5, 28, 2, 1, K('tekko', 3))
    c.R(29, 24, 2, 8, K('ita', 0)); c.VL(29, 24, 8, K('ita', 2)); c.VL(30, 24, 8, K('ita', -1)); c.HL(29, 31, 2, K('ita', -2))
    c.R(11, 24, 18, 2, K('ita', -2))                                                # 상판 밑 그림자
    outline(c, 0, 24, 12, 8); outline(c, 28, 24, 4, 8)


def _chair(c, d):
    """d: 's'(남쪽을 향함: 앞에서 본다) 'n'(등을 보인다) 'e' 'w'(옆모습)."""
    W = 'ita'
    if d == 'n':      # 등받이가 화면 앞쪽: 위에 좌판 윗줄이 얼핏, 등받이 뒷면이 크다
        c.R(4, 2, 8, 5, K(W, 1)); c.HL(4, 2, 8, K(W, 2)); outline(c, 3, 1, 10, 7)
        c.R(4, 8, 8, 2, K(W, 2)); c.HL(4, 8, 8, K('yuka', 2))                       # 등받이 윗면
        c.R(4, 10, 8, 3, K(W, 0)); c.VL(4, 10, 3, K(W, 1)); c.VL(11, 10, 3, K(W, -1)); c.HL(4, 12, 8, K(W, -2))
        outline(c, 3, 7, 10, 7)
        for x in (4, 10): c.R(x, 14, 2, 2, K(W, -1)); c.VL(x, 14, 2, K(W, 0))
    elif d == 's':    # 정면: 좌판 윗면이 크고 등받이가 뒤로 솟는다
        c.R(4, 1, 8, 4, K(W, 0)); c.HL(4, 1, 8, K(W, 2)); outline(c, 3, 0, 10, 6)
        c.R(3, 6, 10, 5, K('yuka', 1)); c.HL(3, 6, 10, K('yuka', 2)); outline(c, 2, 5, 12, 7)
        c.R(3, 11, 10, 1, K(W, -1))
        for x in (3, 11): c.R(x, 12, 2, 4, K(W, 0)); c.VL(x, 12, 4, K(W, 1)); c.R(x, 15, 2, 1, K(W, -2))
    else:             # 옆모습 e / w: ㄴ자 옆면(좌판 위+다리 둘+등받이 세로)
        e = d == 'e'
        bx = 10 if e else 3                                                         # 등받이 기둥 x
        c.R(bx, 1, 3, 12, K(W, 0 if e else 1)); c.VL(bx, 1, 12, K(W, 2)); outline(c, bx - 1, 0, 5, 14)
        sx, sw = (3, 9) if e else (4, 9)
        c.R(sx, 6, sw, 3, K('yuka', 1)); c.HL(sx, 6, sw, K('yuka', 2)); c.HL(sx, 8, sw, K(W, -1)); outline(c, sx - 1, 5, sw + 2, 5)
        c.R(bx - 1 if e else bx, 6, 4, 3, K('yuka', 1))
        for x in (sx, sx + sw - 2): c.R(x, 10, 2, 5, K(W, 0)); c.VL(x, 10, 5, K(W, 2)); c.R(x, 15, 2, 1, K(W, -2))


for _d, _ko, _fc in (('s', '남쪽', 'S'), ('n', '북쪽', 'N'), ('e', '동쪽', 'E'), ('w', '서쪽', 'W')):
    R.obj('desk-chair-' + _d, '의자(%s 향함)' % _ko, w=1, h=1, kind='floor', facing=_fc, cat='bed', cat_ko='침실', tags=('아이방', '서재', '침실'),
          place='책상 앞(책상이 북쪽 벽이면 북쪽 향함)', use=('앉기',), pair=('desk-study',),
          desc='책상 의자 — %s을 향한 모습. 좌판 윗면과 다리, 등받이가 3/4 시점.' % _ko)(lambda c, d=_d: _chair(c, d))


# ── 옷장·붙박이장 ──
@R.obj('wardrobe', '옷장', w=2, h=1, up=16, kind='wall', cat='bed', cat_ko='침실', tags=BED, place='침실 벽면', use=('옷 보관',),
       desc='두 문짜리 옷장(2×2칸 캔버스, 발자국 2×1). 윗면 4px가 보이고 앞면이 안으로 들어간 문 둘 + 손잡이.', pair=('closet-doors', 'mirror-stand'))
def _wardrobe(c):
    x0, x1 = 3, 28
    c.R(x0, 0, x1 - x0 + 1, 4, K('ita', 2)); c.HL(x0 + 1, 0, x1 - x0 - 1, K('yuka', 2)); c.HL(x0, 4, x1 - x0 + 1, K('ita', 3))   # 윗면 + 앞 가장자리
    c.R(x0, 5, x1 - x0 + 1, 2, K('ita', -2))                                                                                # 처마 그림자
    c.R(x0, 7, x1 - x0 + 1, 24, K('ita', 0)); c.VL(x0 + 1, 7, 24, K('ita', 1)); c.VL(x1 - 1, 7, 24, K('ita', -1)); c.HL(x0, 30, x1 - x0 + 1, K('ita', -2))
    for dx0 in (x0 + 2, 16):                                                                                                 # 문 둘(안으로 들어간 패널)
        c.R(dx0, 8, 10, 21, K('ita', 1)); c.HL(dx0, 8, 10, K('ita', -1)); c.VL(dx0, 8, 21, K('ita', -1)); c.HL(dx0, 28, 10, K('ita', 2)); c.VL(dx0 + 9, 8, 21, K('ita', 2))
        c.R(dx0 + 2, 11, 6, 6, K('ita', 0)); c.HL(dx0 + 2, 11, 6, K('ita', -1)); c.R(dx0 + 2, 20, 6, 6, K('ita', 0)); c.HL(dx0 + 2, 20, 6, K('ita', -1))
    c.R(14, 8, 2, 21, K('ita', -2))                                                                                          # 문 사이 틈
    for hx in (13, 17): c.R(hx, 17, 1, 4, K('tekko', 3)); c.P(hx, 17, K('shiro', 2))
    c.R(x0, 31, 3, 1, K('ita', -2)); c.R(x1 - 2, 31, 3, 1, K('ita', -2))
    outline(c, x0 - 1, 0, x1 - x0 + 3, 32)


@R.obj('closet-doors', '붙박이장 문', w=2, kind='hang', hrows=2, cat='bed', cat_ko='침실', tags=BED, place='침실 벽면(옷장 자리)',
       desc='붙박이장(오시이레) 미닫이 문 — 벽 앞면에 붙은 평면. 위 칸 문 둘과 손잡이.', pair=('wardrobe',))
def _closet(c):
    c.R(1, 1, 30, 30, K('kinari', 1)); outline(c, 0, 0, 32, 32); c.HL(1, 1, 30, K('ita', 1))
    for x0 in (2, 16):
        c.R(x0, 3, 13, 26, K('kinari', 2)); c.HL(x0, 3, 13, K('ita', 0)); c.VL(x0, 3, 26, K('ita', 0)); c.VL(x0 + 12, 3, 26, K('ita', -1)); c.HL(x0, 28, 13, K('ita', -1))
        c.R(x0 + 2, 5, 9, 22, K('kinari', 1)); c.HL(x0 + 2, 5, 9, K('kinari', -1)); c.VL(x0 + 2, 5, 22, K('kinari', -1))
        for i in range(8, 26, 6): c.P(x0 + 3, i, K('kinari', -1))
    c.R(13, 14, 2, 5, K('tekko', 3)); c.R(17, 14, 2, 5, K('tekko', 3)); c.HL(14, 3, 2, K('ita', -2)); c.VL(15, 3, 26, K('ita', -2))


# ── 낮은 수납·화장대 ──
@R.obj('dresser-low', '낮은 서랍장', w=2, h=1, kind='wall', cat='bed', cat_ko='침실', tags=BED, place='침실 벽면', surface=True,
       use=('옷 보관', '화장'), desc='낮은 서랍장(2×1칸) — 윗면에 스탠드·시계·인형을 놓는다. 서랍 셋.', pair=('mirror-stand', 'alarm-clock', 'stuffed-toy'))
def _dresser(c):
    c.R(1, 2, 30, 5, K('yuka', 2)); c.HL(2, 2, 28, K('shiro', 2)); c.HL(1, 7, 30, K('yuka', 1)); outline(c, 0, 1, 32, 7)
    c.R(1, 8, 30, 7, K('ita', 1)); c.VL(2, 8, 7, K('ita', 2)); c.VL(29, 8, 7, K('ita', -1)); c.HL(1, 14, 30, K('ita', -2))
    for dx in (3, 12, 21):
        c.R(dx, 9, 8, 4, K('ita', 0)); c.HL(dx, 9, 8, K('ita', -1)); c.R(dx + 3, 11, 2, 1, K('tekko', 3))
    c.R(1, 15, 3, 1, OL); c.R(28, 15, 3, 1, OL)


@R.obj('mirror-stand', '스탠드 거울', w=1, h=1, up=16, kind='floor', cat='bed', cat_ko='침실', tags=BED, place='옷장·서랍장 옆',
       desc='바닥에 세워 두는 전신 거울(키 2칸). 나무 틀과 받침 다리, 유리에 하이라이트.', pair=('wardrobe',))
def _mirror(c):
    c.R(3, 2, 10, 24, K('ita', 1)); c.HL(3, 2, 10, K('ita', 3)); c.VL(3, 2, 24, K('ita', 2)); c.VL(12, 2, 24, K('ita', -1)); outline(c, 2, 1, 12, 26)
    c.R(5, 4, 6, 20, K('garasu', 2))
    for i in range(7): c.P(6 + i // 2, 18 - i, K('garasu', 3)); c.P(7 + i // 2, 18 - i, K('shiro', 2))
    c.HL(5, 4, 6, K('garasu', 3)); c.VL(5, 4, 20, K('garasu', 3)); c.HL(5, 23, 6, K('garasu', 1))
    c.R(2, 27, 3, 4, K('ita', -1)); c.R(11, 27, 3, 4, K('ita', -1)); c.VL(2, 27, 4, K('ita', 1)); c.HL(2, 31, 12, K('ita', -2)); c.HL(3, 28, 10, K('ita', 0))


@R.obj('bed-side-table', '침대 곁 탁자', w=1, h=1, kind='floor', cat='bed', cat_ko='침실', tags=BED, place='침대 머리 옆', surface=True,
       desc='침대 곁 작은 서랍 탁자 — 윗면에 스탠드·시계를 놓는다.', pair=('bed-single', 'desk-lamp', 'alarm-clock'))
def _side_table(c):
    c.R(3, 3, 10, 5, K('yuka', 2)); c.HL(4, 3, 8, K('shiro', 2)); c.HL(3, 8, 10, K('yuka', 1)); outline(c, 2, 2, 12, 7)
    c.R(3, 9, 10, 6, K('ita', 1)); c.VL(4, 9, 6, K('ita', 2)); c.VL(11, 9, 6, K('ita', -1)); c.HL(3, 14, 10, K('ita', -2))
    c.R(5, 10, 6, 3, K('ita', 0)); c.HL(5, 10, 6, K('ita', -1)); c.R(7, 11, 2, 1, K('tekko', 3)); c.R(3, 15, 2, 1, OL); c.R(11, 15, 2, 1, OL)


@R.obj('laundry-rack', '빨래 건조대', w=2, h=1, up=8, kind='floor', cat='bed', cat_ko='침실', tags=('침실', '베란다', '탈의실'), place='창가·베란다 쪽 바닥',
       use=('빨래 말리기',), desc='접이식 빨래 건조대(2×1칸) — 가로 봉에 셔츠·수건이 널려 있다.', pair=('washing-machine',))
def _rack(c):
    for x0 in (4, 25):
        c.R(x0, 4, 2, 26, K('tekko', 2)); c.VL(x0, 4, 26, K('tekko', 3)); c.R(x0 - 1, 29, 4, 2, K('tekko', -1))
    c.R(4, 4, 23, 2, K('tekko', 3)); c.HL(4, 4, 23, K('shiro', 2)); c.R(4, 12, 23, 1, K('tekko', 2))
    shirts = (('sora', 0), ('shiro', 1), ('pinku', 0), ('kii', 0))
    x = 7
    for i, (n, t) in enumerate(shirts):
        c.R(x, 6, 4, 8, K(n, t)); c.HL(x, 6, 4, K(n, 2)); c.VL(x, 6, 8, K(n, 2)); c.VL(x + 3, 6, 8, K(n, -1)); c.HL(x, 13, 4, K(n, -2))
        c.R(x - 1, 7, 1, 3, K(n, t)); c.R(x + 4, 7, 1, 3, K(n, -1)); x += 6
    c.R(10, 14, 6, 9, K('shiro', 1)); c.R(10, 14, 6, 1, K('shiro', 2)); c.VL(10, 14, 9, K('shiro', 2)); c.HL(10, 22, 6, K('shiro', -1)); c.HL(10, 17, 6, K('sora', 1))
    c.R(18, 14, 4, 6, K('aka', 0)); c.HL(18, 14, 4, K('aka', 2)); c.HL(18, 19, 4, K('aka', -2))


# ── 탁상 소품 ──
@R.good('desk-lamp', '탁상 스탠드', desc='책상 위 스탠드 — 관절 팔과 둥근 갓.')
def _lamp(c):
    c.R(3, 12, 6, 2, K('tekko', 1)); c.HL(3, 12, 6, K('tekko', 3)); outline(c, 2, 11, 8, 4)
    c.VL(5, 6, 6, K('tekko', 2)); c.R(5, 5, 6, 1, K('tekko', 2)); c.VL(10, 4, 2, K('tekko', 2))
    c.R(8, 2, 6, 3, K('kii', 2)); c.HL(8, 2, 6, K('shiro', 2)); c.HL(9, 5, 4, K('kii', 0)); outline(c, 7, 1, 8, 5)
    c.R(9, 6, 3, 1, K('kii', 2))


@R.good('alarm-clock', '알람 시계', desc='침대 곁 탁자 위 알람 시계 — 둥근 시계 둘레 두 종.')
def _clock(c):
    disc(c, 8, 10, 4, K('aka', 0)); disc(c, 8, 10, 2.8, K('shiro', 2)); c.VL(8, 8, 3, OL); c.HL(8, 10, 2, OL)
    c.R(4, 5, 2, 2, K('tekko', 3)); c.R(10, 5, 2, 2, K('tekko', 3)); outline(c, 3, 4, 10, 2, OL)
    c.R(5, 15, 2, 1, OL); c.R(10, 15, 2, 1, OL); c.P(5, 8, K('aka', 2)); c.P(6, 7, K('aka', 2))


@R.good('books-stack', '책 더미', desc='책상 위 책 세 권 쌓임.')
def _books(c):
    for y, w, x, n, t in ((11, 11, 2, 'kon', 0), (7, 9, 3, 'aka', 0), (3, 8, 4, 'midori', 0)):
        c.R(x, y, w, 4, K(n, t)); c.HL(x, y, w, K(n, 2)); c.HL(x, y + 3, w, K(n, -2)); c.R(x + w - 2, y + 1, 2, 2, K('shiro', 2)); outline(c, x - 1, y - 1, w + 2, 6)


@R.good('stuffed-toy', '곰 인형', desc='침대·서랍장 위 곰 인형.')
def _toy(c):
    disc(c, 6, 6, 1.6, K('ita', 1)); disc(c, 10, 6, 1.6, K('ita', 1)); disc(c, 8, 8, 3.6, K('ita', 2)); disc(c, 8, 9, 1.6, K('kinari', 2))
    c.R(7, 8, 1, 1, OL); c.R(9, 8, 1, 1, OL); c.R(8, 9, 1, 1, OL)
    c.R(5, 12, 6, 3, K('ita', 1)); c.HL(5, 12, 6, K('ita', 2)); c.R(7, 13, 2, 2, K('kinari', 2)); c.R(4, 13, 1, 2, K('ita', 0)); c.R(11, 13, 1, 2, K('ita', 0)); c.HL(5, 15, 6, K('ita', -2))
    outline(c, 4, 4, 8, 12, OL)


@R.good('randoseru', '란도셀', desc='책상 위 란도셀(초등학생 책가방) — 붉은 가죽 본체와 덮개.')
def _rando(c):
    c.R(3, 3, 10, 11, K('aka', 0)); c.HL(3, 3, 10, K('aka', 2)); c.VL(3, 3, 11, K('aka', 2)); c.VL(12, 3, 11, K('aka', -1)); c.HL(3, 13, 10, K('aka', -2))
    c.R(4, 4, 8, 6, K('aka', 1)); c.HL(4, 9, 8, K('aka', -2)); c.R(7, 10, 2, 2, K('kii', 2)); c.R(7, 5, 2, 2, K('kii', 1))
    c.R(1, 5, 2, 7, K('ita', -1)); c.R(13, 5, 2, 7, K('ita', -2)); outline(c, 2, 2, 12, 13)


def build(): return R.build()
def selftest(): return R.selftest()


if __name__ == '__main__':
    sys.exit(1 if run_block(R, os.path.join(ROOT, 'tiledata', 'jp-city', 'blocks', BLOCK)) else 0)
