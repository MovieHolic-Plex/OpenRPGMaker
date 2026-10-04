import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from s3k import C
ROOT = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..'))
def out(slug, X): return ROOT + '/%s/s3-%s.pxg' % (slug, X)

def cell(c, x, y, w, h, fill, hi, lo, cellfill=None):
    c.rect(x, y, w, h, cellfill or ('tray', 3))
    c.rect(x, y, w, h, fill)
    c.hl(x, y, w, hi) if hi else None
    c.hl(x, y + h - 1, w, lo) if lo else None

def landscape(tray_fill, tray_edge_hi, tray_edge_lo, tray_cell, food):
    c = C(16, 16)
    c.rect(1, 1, 14, 10, ('tray', tray_fill))
    c.hl(1, 1, 14, ('tray', tray_edge_hi)); c.vl(1, 1, 10, ('tray', tray_edge_hi))
    c.hl(1, 10, 14, ('tray', tray_edge_lo)); c.vl(14, 1, 10, ('tray', tray_edge_lo))
    c.px(1, 1, '.'); c.px(14, 1, '.'); c.px(1, 10, '.'); c.px(14, 10, '.')
    # 칸: 위 3칸, 아래 2칸
    tops = [(2, 3), (6, 4), (11, 3)]
    for x, w in tops: c.rect(x, 2, w, 3, ('tray', tray_cell)); c.hl(x, 2, w, ('tray', tray_cell - 1))
    bots = [(2, 6), (9, 5)]
    for x, w in bots: c.rect(x, 6, w, 4, ('tray', tray_cell)); c.hl(x, 6, w, ('tray', tray_cell - 1))
    # 음식
    (r1, r2, r3, r4, r5) = food
    # 위 왼쪽: 초록 반찬
    c.rect(2, 3, 3, 2, r1[0]); c.px(2, 3, r1[1]); c.px(3, 3, r1[1])
    # 위 가운데: 노란 계란
    c.rect(6, 3, 4, 2, r2[0]); c.hl(6, 3, 3, r2[1])
    # 위 오른쪽: 붉은 김치
    c.rect(11, 3, 3, 2, r3[0]); c.px(11, 3, r3[1]); c.px(13, 4, r3[2])
    # 아래 왼쪽: 흰 밥 (수북)
    c.rect(2, 6, 6, 4, r4[0]); c.hl(2, 6, 5, r4[1]); c.px(2, 7, r4[1]); c.hl(2, 9, 6, r4[2]); c.px(7, 8, r4[2])
    # 아래 오른쪽: 주황 국
    c.rect(9, 6, 5, 4, r5[0]); c.hl(9, 6, 4, r5[1]); c.hl(9, 9, 5, r5[2]); c.px(11, 8, r5[1])
    # 숟가락 (판 밖 아래)
    c.hl(4, 12, 6, ('viron', 5)); c.hl(4, 13, 1, ('viron', 3))
    c.rect(10, 12, 2, 1, ('viron', 6)); c.px(9, 12, ('viron', 5)); c.px(11, 13, ('viron', 3))
    return c

def fin(c, X, note, y=13, x=1, w=14):
    c.shadow(x, y, w, 2)
    c.save(out('meal_tray', X), note)

