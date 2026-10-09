"""forest wv5 — 활엽수 숲 A/B/C. 손으로 적은 수관 도장을 8px 엇갈린 격자(16px 주기)에 찍는다."""
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from wv5lib import *
OUT = os.path.join(HERE, '..')
BK = {'p': ('wbark', 1), 'q': ('wbark', 2), 'r': ('wbark', 3), 's': ('wbark', 0)}
def S(rows, maps=BK): return parse(rows, 'wleaf', anchor=(4, 4), maps=maps)

# ---------- A : World.png 결 — 둥근 수관, 어두운 둘레, 왼위 밝은 덩이, 아래오른 그늘 ----------
A1 = S(["..22100..",
        ".2455430.",
        "245555430",
        "245545330",
        "144544320",
        "134444320",
        "133443210",
        ".1333210.",
        ".0232210.",
        "..00000.."])
A2 = S(["..22100..",
        ".2345540.",
        "234555430",
        "244554330",
        "144454320",
        "133444310",
        "133343210",
        ".1332210.",
        ".0232210.",
        "..00000.."])
A3 = S(["..22210..",
        ".2445540.",
        "245545430",
        "244454330",
        "134444320",
        "133443310",
        "133433210",
        ".1233210.",
        ".0232210.",
        "..00000.."])
def trunkA(cv, x, y, xb, yb):
    cv.put(x - 1, y + 6, BK['q']); cv.put(x, y + 6, BK['p']); cv.put(x - 1, y + 7, BK['p']); cv.put(x, y + 7, BK['s'])
ROWS = [(4, [4, 12]), (12, [0, 8])]
def pickA(xb, yb): return {(4, 4): A1, (12, 4): A2, (0, 12): A3, (8, 12): A1}[(xb, yb)]
def pickA2(xb, yb): return {(4, 4): A2, (12, 4): A3, (0, 12): A1, (8, 12): A2}[(xb, yb)]

def build(pick, pick2, iso_specs, trunkfn, ground, title, note, name, y_max=84, inner_kw=None, shadow=True, r1y=None):
    it = lattice_pos(ROWS)
    cv = render_patch(it, pick, ground, y_max, trunkfn, r1y=r1y)
    cv2 = render_patch(it, pick2, ground, y_max, trunkfn, r1y=r1y)
    iso = iso_cell(iso_specs, trunkfn)
    if shadow:
        shadow_pass(cv); shadow_pass(cv2); shadow_pass(iso, region=None)
    roles = roles_from_patch(cv, cv2, [r[:] for r in iso.a], inner_kw or dict(radius=5.4, rim_dn=0, rim_up=1))
    write(os.path.join(OUT, f'wv5-{name}.pxg'), roles, title, note)


# ---------- B : 깊이 — 3/4 시점, 밝은 정수리·짙은 그늘, 수관 밑 그림자 ----------
B1 = S(["..12210..",
        ".1355541.",
        "13555543.",
        "23555432.",
        "13454321.",
        "13443211.",
        "12332210.",
        ".1222100.",
        ".0121000.",
        "..00000.."])
B2 = S(["..12210..",
        ".1355441.",
        "13554543.",
        "13554432.",
        "23454321.",
        "13343211.",
        "12332100.",
        ".1222100.",
        ".0121000.",
        "..00000.."])
B3 = S(["..12210..",
        ".1345541.",
        "13555433.",
        "13545432.",
        "13444321.",
        "12433211.",
        "12332210.",
        ".1212100.",
        ".0121000.",
        "..00000.."])
def pickB(xb, yb): return {(4, 4): B1, (12, 4): B2, (0, 12): B3, (8, 12): B1}[(xb, yb)]
def pickB2(xb, yb): return {(4, 4): B3, (12, 4): B1, (0, 12): B2, (8, 12): B3}[(xb, yb)]
def trunkB(cv, x, y, xb, yb):
    cv.put(x - 1, y + 6, BK['r']); cv.put(x, y + 6, BK['q']); cv.put(x - 1, y + 7, BK['q']); cv.put(x, y + 7, BK['s'])
def dropshadow(cv, x, y, xb, yb): pass

# ---------- C : 덩이 — 잎 뭉치(꽃양배추) 3덩이가 한 수관, 납작한 두 톤 + 잎끝 밝은 점 ----------
C1 = S(["...222...",
        ".22545522",
        "245545543",
        "245554543",
        "144544433",
        "144444333",
        "133443332",
        ".1333232.",
        ".0222210.",
        "..00000.."])
C2 = S(["..22.22..",
        ".24555542",
        "245445543",
        "244554433",
        "144454333",
        "134444332",
        "133433322",
        ".1332221.",
        ".0222210.",
        "..00000.."])
C3 = S(["...22....",
        ".22455422",
        "245555543",
        "245445433",
        "144544332",
        "134444333",
        "133343322",
        ".1332221.",
        ".0222210.",
        "..00000.."])
def pickC(xb, yb): return {(4, 4): C1, (12, 4): C2, (0, 12): C3, (8, 12): C2}[(xb, yb)]
def pickC2(xb, yb): return {(4, 4): C3, (12, 4): C1, (0, 12): C2, (8, 12): C1}[(xb, yb)]

if __name__ == '__main__':
    isoA = [(A1, 4, 5), (A2, 11, 5), (A3, 8, 9)]
    build(pickA, pickA2, isoA, trunkA, ('wleaf', 1), 'forest A — World.png 결: 8px 엇갈린 둥근 수관 덩이, 어두운 둘레·틈',
          'A: World.png 숲 구조(지름 9 수관이 8px 엇갈림, 수관 사이 가장 어두운 초록, 남쪽 줄기 2px)를 우리 팔레트로.', 'A')
    isoB = [(B1, 4, 5), (B2, 11, 6), (B3, 7, 9)]
    build(pickB, pickB2, isoB, trunkB, ('wleaf', 0), 'forest B — 깊이: 밝은 정수리·짙은 오른아래 그늘·수관 밑 긴 그림자',
          'B: 3/4 시점 볼륨 — 정수리 5단·오른아래 0~1단으로 대비를 키우고 밑에 굵은 남동 그림자, 바탕도 한 단 어둡게.', 'B')
    isoC = [(C1, 4, 5), (C2, 11, 5), (C3, 8, 9)]
    build(pickC, pickC2, isoC, trunkA, ('wleaf', 1), 'forest C — 잎 뭉치: 톱니 윗선(잎끝이 삐죽)과 뭉치 결',
          'C: 같은 수치에서 다른 해석 — 수관 윗선에 잎 뭉치 톱니를 넣어 실루엣이 오돌토돌한 꽃양배추 결.', 'C')
