import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from s3k import C
ROOT = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..'))
def out(slug, X): return ROOT + '/%s/s3-%s.pxg' % (slug, X)
P = lambda r, s: (r, s)

def net(c, cx, y0, ringc, netc, netc2):
    # 링(타원) y0..y0+2, 폭 11
    c.hl(cx - 5, y0, 11, ringc[0]); c.hl(cx - 6, y0 + 1, 13, ringc[1]);
    c.px(cx - 6, y0 + 1, ringc[2]); c.px(cx + 6, y0 + 1, ringc[2])
    c.hl(cx - 5, y0 + 2, 11, ringc[2])
    # 그물: 지그재그 1px, 아래로 좁아짐
    rows = [(5, 1), (4, 1), (4, 0), (3, 1), (3, 0), (2, 1)]
    y = y0 + 3
    for i, (half, ph) in enumerate(rows):
        for x in range(cx - half, cx + half + 1):
            if (x + i + ph) % 2 == 0: c.px(x, y, netc if (x + i) % 4 else netc2)
        y += 1

def hoop(board_fill, board_hi, board_lo, frame, target, pole, base, ringc, netc, netc2, lit=False):
    c = C(32, 48)
    # 기둥 (오른쪽 뒤) + 팔
    c.rect(26, 9, 4, 33, P(pole, 3)); c.vl(26, 9, 33, P(pole, 4)); c.vl(29, 9, 33, P(pole, 1)); c.vl(27, 9, 33, P(pole, 4))
    c.rect(22, 9, 5, 3, P(pole, 2)); c.hl(22, 9, 5, P(pole, 4))
    # 백보드
    c.rect(3, 1, 22, 14, board_fill)
    c.hl(3, 1, 22, board_hi); c.vl(3, 1, 14, board_hi)
    c.hl(3, 14, 22, board_lo); c.vl(24, 1, 14, board_lo)
    # 빨간 테 (안쪽 1칸)
    c.hl(4, 2, 20, frame[0]); c.hl(4, 13, 20, frame[1]); c.vl(4, 2, 12, frame[0]); c.vl(23, 2, 12, frame[1])
    # 조준 사각형
    c.hl(9, 7, 10, target); c.hl(9, 12, 10, target); c.vl(9, 7, 6, target); c.vl(18, 7, 6, target)
    # 광택 대각선
    for i in range(4): c.px(6 + i, 6 - i, board_hi if lit else P('vwhite', 6))
    # 링과 그물 (보드 앞으로)
    net(c, 13, 15, ringc, netc, netc2)
    # 받침(물통) + 바퀴
    c.rect(6, 40, 25, 4, P(base, 3)); c.hl(6, 40, 25, P(base, 5)); c.vl(6, 40, 4, P(base, 5)); c.hl(6, 43, 25, P(base, 1)); c.vl(30, 40, 4, P(base, 1))
    c.px(6, 40, '.'); c.px(30, 43, '.')
    c.hl(9, 41, 6, P(base, 4))  # 물통 주입구 띠
    for wx in (9, 26):
        c.rect(wx, 44, 4, 2, P('vblack', 2)); c.px(wx, 44, P('vblack', 4)); c.px(wx + 1, 44, P('vblack', 3))
    return c

def fin(c, X, note, sx=6, sw=25):
    c.shadow(sx, 46, sw, 2)
    c.save(out('basketball_hoop', X), note)
