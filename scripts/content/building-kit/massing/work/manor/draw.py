"""manor — 저택(덩어리 모형 19). 12×8 칸(192×128). 한 채. 난수 없음.
본채: 정면과 나란한 용마루 손 기와 앞 사면(얇은 마룻기와), 양 끝은 앞으로 나온 박공 날개 지붕이 덮고 골로 만난다.
날개 둘은 폭·높이·삼각벽이 다르다(왼쪽 좁은 회벽 삼각벽+다락창 · 오른쪽 넓고 높은 마름돌 삼각벽+둥근 창).
박공 동서 사면의 기와 줄은 처마와 나란히 세로로 선다. 가운데 박공 현관(문)은 본채 벽 가운데.
굴뚝 둘은 폭·높이가 다르고 띠 받침 없이 용마루에 걸친다. 1층은 잔 마름돌."""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import pix  # noqa: E402
from pix import Ashlar  # noqa: E402
from common import Canvas, moss, plaster, eave_shadow, door  # noqa: E402
from gf import foundation  # noqa: E402
from bits import darken, outline, fill_pinholes  # noqa: E402
from hand import btiles, ridge, eave, chimney  # noqa: E402
from nh import vtiles, cwin, stipple, edge_report  # noqa: E402
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '../../../../../../src/harnesses/building-kit'))
from massing_lib import P  # noqa: E402

W, H = 192, 128
c = Canvas(12, 8)
GY = H - 1

FINE = Ashlar([4, 4, 5, 4, 4, 5, 4], seed=3, widths=[7, 5, 8, 6, 9, 5, 7, 6, 8, 5, 6, 9, 7, 5, 8])
FINE2 = Ashlar([4, 5, 4, 4, 5, 4], seed=8, widths=[6, 8, 5, 7, 6, 9, 5, 8, 7, 6, 5, 8])


def ashlar(x0, y0, x1, y1, ash=FINE, shade=None):
    pix.flat_wall(c, x0, y0, x1 - x0 + 1, y1 - y0 + 1, ash, shade=shade)


def band(x0, x1, y):
    for x in range(x0, x1 + 1):
        c.put(x, y, 'r' if x % 11 else 'n')
        c.put(x, y + 1, 'm' if x % 11 else 'k')
        c.put(x, y + 2, 'h' if x % 11 else 'e')
        c.put(x, y + 3, 'a')


# ---------------------------------------------------------------- 본채 지붕(앞 사면, 손 기와) + 얇은 마룻기와 + 굴뚝 둘
R_Y, E_Y = 9, 48
MX0, MX1 = 14, 177
btiles(c, lambda x, y: True, MX0, MX1, R_Y + 3, E_Y, 'front', seed=4)
ridge(c, MX0, MX1, R_Y)
eave(c, MX0, MX1, E_Y + 1)
chimney(c, 56, 0, 13, 14, cw=10)          # 왼쪽: 넓고 높다
chimney(c, 112, 4, 15, 16, cw=7)          # 오른쪽: 좁고 낮다

# ---------------------------------------------------------------- 본채 벽(물러난 2층) — 가운데 87.5
WX0, WX1 = 38, 137
CTR = 87.5
eave_shadow(c, WX0, E_Y + 3, WX1 - WX0 + 1, rows=('-', 'c', 'f', 'l'))
plaster(c, WX0, E_Y + 7, WX1 - WX0 + 1, 80 - (E_Y + 7), ox=2, oy=4)
stipple(c, WX0, E_Y + 7, WX1, 79, k=0)
band(WX0, WX1, 80)
ashlar(WX0, 84, WX1, 109)
foundation(c, WX0, WX1, 110)
cwin(c, 52, 58, w=8, h=13, shutters='both', glint=0)
cwin(c, 116, 58, w=8, h=13, shutters='both', curtain=True, glint=1, sill=2)
cwin(c, 51, 89, w=9, h=14, shutters='left', box=True, glint=2)
cwin(c, 116, 89, w=8, h=14, shutters='both', lit=True, sill=0)

# ---------------------------------------------------------------- 앞마당 돌 바닥 단 — 땅선 127
for y in range(112, 122):
    lv = y - 112
    for x in range(WX0, WX1 + 1):
        fx = (x + (lv // 4) * 6) % 11
        fy = lv % 4
        if fy == 3 or fx == 10:
            ch = 'e' if (x + lv) % 3 else 'i'
        elif fy == 0 or fx == 0:
            ch = 'n'
        else:
            ch = ('m', 'k', 'm', 'j', 'm', 'k', 'j')[((x + (lv // 4) * 6) // 11 + lv // 4) % 7]
        if lv < 2:
            ch = {'n': 'j', 'm': 'i', 'k': 'e', 'j': 'e', 'e': 'a', 'i': 'e'}[ch]
        c.put(x, y, ch)
for x in range(WX0, WX1 + 1):
    c.put(x, 122, 'r' if x % 9 else 'n')
    c.put(x, 123, 'm' if x % 9 else 'k')
    for y in (124, 125):
        c.put(x, y, 'j' if ((x + (y - 124) * 5) % 11) else 'a')
    c.put(x, 126, 'e' if x % 7 else 'a')
    c.put(x, 127, 'Y' if x % 6 else 'X')
c.rows(52, 113, ['.NOM.', 'MκOLM', '.NκN.', '.δεδ.', '.ηεβ.', '.δεδ.'])          # 화분(왼쪽만, 둥근 꽃)
c.rows(119, 114, ['.ζηζ.', 'ζσξηβ', 'ηξξηβ', 'ηεεεβ', '.δδδ.'])                  # 오른쪽은 뚜껑 덮인 물통(윗면)


# ---------------------------------------------------------------- 박공 날개·현관 지붕(남북 박공)
def ns_gable(x0, x1, apex_y, knee_y, eave_y, gpeak_y, seed, infill, valley_left=True, valley_right=True):
    wdt = x1 - x0 + 1
    ctr = x0 + wdt / 2.0
    rx = x0 + wdt // 2 - 1                 # 용마루 왼 화소
    half = wdt / 2.0

    def hw(y):
        return half if y >= knee_y else half * (y - apex_y + 1) / (knee_y - apex_y + 1)

    gb = eave_y + 2

    def gw(y):
        return half * (y - gpeak_y + 1) / (gb - gpeak_y + 1)

    def in_gable(x, y):
        return gpeak_y <= y <= gb and abs(x + 0.5 - ctr) <= gw(y)

    def inside(x, y):
        return apex_y <= y <= gb and abs(x + 0.5 - ctr) <= hw(y) and not in_gable(x, y)

    vtiles(c, lambda x, y: inside(x, y) and x < rx, x0, rx - 1, apex_y, gb, rx - 1, -1, 'lit', seed=seed)
    vtiles(c, lambda x, y: inside(x, y) and x > rx + 1, rx + 2, x1, apex_y, gb, rx + 2, +1, 'dark', seed=seed + 3)
    for y in range(apex_y, gpeak_y + 1):   # 얇은 마룻기와(세로): 빛 받는 왼 · 그늘 오른
        c.put(rx, y, 'σ' if y % 4 == 1 else 'ξ')
        c.put(rx + 1, y, 'η' if y % 4 else 'ζ')
    for y in range(apex_y, gb + 1):        # 바깥 처마(동서 처마끝: 세로 줄) + 위 골
        xs = [x for x in range(x0, x1 + 1) if inside(x, y) or in_gable(x, y)]
        if not xs:
            continue
        l, r = xs[0], xs[-1]
        if y >= knee_y:
            c.put(l, y, 'ε' if y % 3 else 'δ')
            c.put(l + 1, y, 'ξ' if y % 2 else 'η')
            c.put(r, y, '%' if y % 3 else '7')
            c.put(r - 1, y, '@')
        else:                              # 골: 본채 앞 사면과 만나는 사선
            if valley_left:
                c.put(l, y, 'ξ')
                darken(c, l - 1, y, 2)
            if valley_right:
                c.put(r, y, '@')
                darken(c, r + 1, y, 2)
                darken(c, r + 2, y, 1)
    # 박공널(남쪽 삼각 사선): 얇은 기와 끝 줄 + 널(왼 밝음 · 오른 그늘) + 밑 그늘
    for y in range(gpeak_y, gb + 1):
        for x in range(x0, x1 + 1):
            if not in_gable(x, y):
                continue
            d = gw(y) - abs(x + 0.5 - ctr)
            left = x + 0.5 < ctr
            if d < 1:
                ch = 'ε' if left else '@'
            elif d < 2:
                ch = 'σ' if left else '<'
            elif d < 3:
                ch = 'ξ' if left else 'ε'
            elif d < 4:
                ch = 'c' if left else 'Y'
            else:
                ch = None
            if ch:
                c.put(x, y, ch)
    infill(lambda x, y: in_gable(x, y) and gw(y) - abs(x + 0.5 - ctr) >= 4, int(ctr), gpeak_y, gb)
    c.put(rx, gpeak_y - 1, 'ξ')            # 꼭대기 마구리(용마루 끝, 삼각 꼭짓점에 닿는다)
    c.put(rx + 1, gpeak_y - 1, 'η')
    return in_gable


def plaster_gable(mask, cx, top, gb):
    for y in range(top, gb + 1):
        for x in range(cx - 40, cx + 41):
            if mask(x, y):
                c.put(x, y, '3')
    stipple(c, cx - 40, top, cx + 40, gb, k=2)
    for x in range(cx - 40, cx + 41):       # 밑 보(삼각벽과 2층 사이 띠)
        if mask(x, gb) or mask(x, gb - 1):
            c.put(x, gb, 'ε')
            c.put(x, gb - 1, 'η')
    cwin(c, cx - 4, gb - 13, w=8, h=9, frame='wood', shutters='none', glint=3, sill=0, transom=True)


def stone_gable(mask, cx, top, gb):
    ash = Ashlar([4, 4, 5, 4], seed=11, widths=[6, 8, 5, 7, 9, 6])
    for y in range(top, gb + 1):
        for x in range(cx - 40, cx + 41):
            if mask(x, y):
                ch = ash.color(x + 300, y - top, 0 if x < cx else -1)
                c.put(x, y, ch or 'm')
    c.rows(cx - 6, gb - 15, [                # 둥근 창: 돌 고리 + 유리 + 십자 살
        '...rnnm...',
        '.rnDDDDmj.',
        '.nDbD^DDe.',
        'rnD^DeDDie',
        'neeeeeeeea',
        'mDDDDeDDDa',
        '.jDDDeDDa.',
        '.jie>e>ea.',
        '...ieea...',
    ])
    for x in range(cx - 40, cx + 41):
        if mask(x, gb):
            c.put(x, gb, 'e')
            c.put(x, gb - 1, 'k')


def wing(x0, x1, apex_y, knee_y, gpeak_y, seed, infill, wins, ash, vl, vr):
    EV = 70
    ns_gable(x0, x1, apex_y, knee_y, EV, gpeak_y, seed, infill, valley_left=vl, valley_right=vr)
    nx0, nx1 = x0 + 1, x1 - 1
    wy0 = EV + 3
    eave_shadow(c, nx0, wy0, nx1 - nx0 + 1, rows=('-', 'c', 'f', 'l'))
    plaster(c, nx0, wy0 + 4, nx1 - nx0 + 1, 96 - wy0 - 4, ox=x0 % 13, oy=2)
    stipple(c, nx0, wy0 + 4, nx1, 95, k=1 if x0 else 0)
    band(nx0, nx1, 96)
    ashlar(nx0, 100, nx1, 125, ash=ash)
    foundation(c, nx0, nx1, 126)
    for kw in wins:
        cwin(c, **kw)
    for y in range(wy0 + 4, 126):          # 귀돌(왼 밝음 · 오른 그늘)
        k = (y - wy0) // 5
        if (y - wy0) % 5 == 4:
            c.put(nx0, y, 'e')
            c.put(nx1, y, 'a')
            continue
        c.put(nx0, y, 'r' if k % 2 else 'n')
        c.put(nx0 + 1, y, 'm' if k % 2 else 'k')
        c.put(nx1, y, 'h')
        c.put(nx1 - 1, y, 'j' if k % 2 else 'k')


# 왼 날개(좁다, 0..41): 회벽 삼각벽 + 다락창
wing(0, 41, 12, 40, 47, 2, plaster_gable,
     [dict(x=8, y=78, w=7, h=12, glint=0), dict(x=27, y=78, w=7, h=12, shutters='left', glint=2),
      dict(x=8, y=104, w=7, h=13, box=True, glint=1), dict(x=27, y=104, w=7, h=13, curtain=True, glint=3, sill=2)],
     FINE2, False, True)
# 오른 날개(넓고 높다, 134..191): 마름돌 삼각벽 + 둥근 창
wing(134, 191, 3, 34, 38, 7, stone_gable,
     [dict(x=145, y=78, w=8, h=13, curtain=True, glint=1), dict(x=172, y=78, w=8, h=13, shutters='right', glint=0),
      dict(x=145, y=104, w=9, h=14, lit=True, sill=2), dict(x=172, y=104, w=8, h=14, box=True, glint=2)],
     FINE, True, False)

# ---------------------------------------------------------------- 가운데 박공 현관(문 열 5: 80..95)
PX0, PX1 = 70, 105


def pediment(mask, cx, top, gb):
    for y in range(top, gb + 1):
        for x in range(cx - 30, cx + 31):
            if mask(x, y):
                c.put(x, y, '3')
    stipple(c, cx - 30, top, cx + 30, gb, k=1)
    c.rows(cx - 5, gb - 9, ['..ζηηζ..', '.ηKLKKβ.', 'ηLKKKKKβ', '.ηKKKτβ.', '..δδδδ..'])   # 둥근 금빛 문장(글자 없음)
    for x in range(cx - 30, cx + 31):
        if mask(x, gb) or mask(x, gb - 1):
            c.put(x, gb, 'k')
            c.put(x, gb - 1, 's')


ns_gable(PX0, PX1, 58, 66, 84, 64, 5, pediment)
PW0 = 87
ashlar(PX0 + 1, PW0, PX1 - 1, 125, ash=FINE, shade=lambda x, y: 1 if x < PX0 + 4 else (-1 if x > PX1 - 4 else 0))
for px in (PX0 + 2, PX1 - 6):              # 돌 기둥 둘(위 머리·아래 받침)
    for y in range(PW0, 126):
        for i, ch in enumerate('rnkje'):
            c.put(px + i, y, ch)
    c.rows(px - 1, PW0, ['srrnmj', 'nmmkje'])
    c.rows(px - 1, 123, ['rnnkje', 'mkkjea'])
DX, DW = 82, 12
for j in range(126 - 96):
    for i, ch in ((-2, 'n'), (-1, 'k'), (DW, 'j'), (DW + 1, 'e')):
        c.put(DX + i, 96 + j, ch if j % 6 else 'a')
for i in range(-2, DW + 2):
    c.put(DX + i, 95, 'r' if i < DW // 2 else 'm')
door(c, DX, 97, DW, 126 - 97)
foundation(c, PX0, PX1, 126, step=(DX - 3, DX + DW + 2))
for y in range(PW0, 126):                  # 현관이 본채 벽에 던지는 오른쪽 그늘
    darken(c, PX1 + 1, y, 2)
    darken(c, PX1 + 2, y, 1)

moss(c, [(4, 64, 2), (100, 40, 2), (186, 62, 0)])

outline(c, 2)
print('pinholes', fill_pinholes(c))
for y in range(H):                              # 바깥 테두리의 무채색 짙은 회색 → 푸른 기 도는 재질 어두운 단
    for x in range(W):
        ch = c.get(x, y)
        if ch in 'UVWXTYZ' and any(not (0 <= x + a < W and 0 <= y + b < H) or c.get(x + a, y + b) == '.'
                                   for a, b in ((1, 0), (-1, 0), (0, 1), (0, -1))):
            c.put(x, y, 'b' if (x + y) % 3 else 'a')
        elif ch == '_' and any(not (0 <= x + a < W and 0 <= y + b < H) or c.get(x + a, y + b) == '.'
                               for a, b in ((1, 0), (-1, 0), (0, 1), (0, -1))):
            c.put(x, y, 'α')
mn, bad = edge_report(c, P)
print('edge min lum %.3f  near-black edge px %d %s' % (mn, len(bad), bad[:6]))

walk = []
for cy in range(8):
    r = ''
    for cx in range(12):
        op = any(c.get(x, y) != '.' for y in range(cy * 16, cy * 16 + 16) for x in range(cx * 16, cx * 16 + 16))
        if not op:
            r += '.'
        elif cx == 5 and cy in (6, 7):
            r += 'D'
        else:
            r += '*' if cy < 4 else 'X'
    walk.append(r)
print('\n'.join(walk))
meta = {'name': '저택', 'massing': '19', 'material': 'stone', 'refs': ['bd-house-manor', 'bd-manor-tower'], 'walk': walk}
fails, warns = c.save('manor', meta)
print('fails', fails, 'warns', warns)
