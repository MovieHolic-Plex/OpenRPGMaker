# 공동묘지 오토타일 3종 (4x4 시트, 번호 = 위1+오른쪽2+아래4+왼쪽8)
from gc_kit import *
from gc_kit import _hash, _pn1
from gc_art2 import fence_cell, dirt_inner, dirt_border

def fence_sheet(): return autotile_sheet(fence_cell)
def dirt_sheet(): return edge_overlay(dirt_inner, dirt_border, 2, 1, 5)

def mist_sheet():
    """안개 오토타일: 이웃이 있는 쪽은 안으로 이어지고 없는 쪽은 옅어지며 들쭉날쭉하게 끝난다. 반투명."""
    def cell(m, N, E, S, W):
        im = new(); p = im.load()
        for y in range(T):
            for x in range(T):
                e = 99
                if not W: e = min(e, x - 1 - 3 * _pn1(y, 21))
                if not E: e = min(e, 14 - x - 3 * _pn1(y, 22))
                if not N: e = min(e, y - 1 - 3 * _pn1(x, 23))
                if not S: e = min(e, 14 - y - 3 * _pn1(x, 24))
                if e < 0: continue
                n = pn(x + (m % 4) * 0, y, 4, 60 + 0, 16)
                n = _pn1(x + y * 3, 25) * .5 + _pn1(y + x * 2, 26) * .5
                a = 70 if e > 4 else (46 if e > 2 else 26)
                if n < .3: a = max(0, a - 26)
                if a: p[x, y] = (206, 222, 238, a)
        return im
    return autotile_sheet(cell)
