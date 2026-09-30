import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from s3k import C
ROOT = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..'))
def out(slug, X): return ROOT + '/%s/s3-%s.pxg' % (slug, X)

def bunk(c, ox, ladder_x, F, top, bot, hi=6, lo=0, steel=False):
    """F=(램프, 밝음, 중간, 어둠, 외곽). 몸통 폭 26(ox..ox+25), 매트리스 폭 20"""
    R, a, b, d, o = F
    mx = ox + 3
    # 기둥 2개
    for px_ in (ox, ox + 23):
        c.vl(px_, 0, 46, (R, o)); c.vl(px_+1, 0, 46, (R, a)); c.vl(px_+2, 0, 46, (R, d if px_ > ox else b))
        c.px(px_+1, 0, (R, hi)); c.px(px_, 0, '.'); c.px(px_+2, 0, (R, o))
    # 위칸: 뒤 난간·매트리스
    def level(y0, blanket, pillow_side):
        c.hl(mx, y0-3, 20, (R, a)); c.rect(mx, y0-2, 20, 2, (R, b)); c.hl(mx, y0-1, 20, (R, d))   # 머리·발치 판 (뒤)
        c.rect(mx, y0, 20, 5, ('vlinen', 5)); c.hl(mx, y0, 20, ('vlinen', 6))
        c.rect(mx+1, y0+1, 6, 3, ('vlinen', 6)); c.hl(mx+1, y0+3, 6, ('vlinen', 4))
        c.rect(mx+8, y0, 12, 5, (blanket, 3)); c.hl(mx+8, y0, 12, (blanket, 4)); c.hl(mx+8, y0+4, 12, (blanket, 2))
        c.rect(mx, y0+5, 20, 7, ('vlinen', 4)); c.hl(mx, y0+5, 20, ('vlinen', 5))
        c.rect(mx+8, y0+5, 12, 7, (blanket, 2)); c.hl(mx+8, y0+5, 12, (blanket, 3)); c.vl(mx+8, y0+5, 7, (blanket, 3))
        c.hl(mx, y0+11, 20, ('vlinen', 2)); c.hl(mx+8, y0+11, 12, (blanket, 1))
        # 앞 판
        c.hl(mx, y0+12, 20, (R, a)); c.rect(mx, y0+13, 20, 2, (R, b)); c.hl(mx, y0+15, 20, (R, d))
    level(5, top, 0)
    level(26, bot, 0)
    # 사다리
    for i in (0, 4):
        c.vl(ladder_x + i, 12, 34, (R, a)); c.vl(ladder_x + i + 1, 12, 34, (R, d))
    for y in range(15, 46, 5):
        c.hl(ladder_x + 2, y, 2, (R, b)); c.hl(ladder_x + 2, y+1, 2, (R, d))
