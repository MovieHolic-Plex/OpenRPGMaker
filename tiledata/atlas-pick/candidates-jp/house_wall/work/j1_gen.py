import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '../../house_roof/work'))
from j1_lib import C
OUT = os.path.dirname(os.path.dirname(__file__))
W, H = 64, 48

def wall(c, base, dark, light=None, hl_cols=0):
    for y in range(H):
        for x in range(W):
            t = base
            if light is not None and x < hl_cols: t = light
            c.px(x, y, 'mtile', t)
    # 모르타르 살짝 거친 결: 줄무늬(가로 이음) 두 줄
    for x in range(0, W): c.px(x, 24, 'mtile', dark)

def window(c, x, y, w, h, frame=('mmetal', 4), glass=5, dg=3, panes=2, hi=True):
    r, t = frame
    c.rect(x, y, w, h, r, t)
    c.rect(x + 1, y + 1, w - 2, h - 2, 'mglass', glass)
    pw = (w - 2) // panes
    for p in range(1, panes): c.vl(x + p * pw, y + 1, h - 2, r, t)
    c.hl(x + 1, y + h - 2, w - 2, 'mglass', dg)          # 아래 어두운 줄(유리 두께)
    c.vl(x, y, h, r, t + 1 if t < 6 else t); c.hl(x, y, w, r, min(t + 2, 7))
    c.hl(x, y + h - 1, w, r, t - 2); c.vl(x + w - 1, y, h, r, t - 2)
    if hi:   # 유리 반사 빗금
        for p in range(panes):
            bx = x + 2 + p * pw
            c.px(bx, y + 3, 'mglass', 7); c.px(bx + 1, y + 2, 'mglass', 7); c.px(bx + 2, y + 1, 'mglass', 7) if h > 8 else None

def rail(c, x, y, w, h, top=5, body=3):
    c.hl(x, y, w, 'mmetal', top); c.hl(x, y + 1, w, 'mmetal', top - 2)
    for i in range(x, x + w, 3): c.vl(i, y + 2, h - 2, 'mmetal', body)
    c.hl(x, y + h - 1, w, 'mmetal', 3)

def slab(c, x, y, w, t=(5, 3, 1)):
    c.hl(x, y, w, 'mconc', t[0]); c.hl(x, y + 1, w, 'mconc', t[1]); c.hl(x, y + 2, w, 'mconc', t[2])

def door(c, x, y, w, h, frame=3, glass=True, lat=True, light=False):
    c.rect(x, y, w, h, 'hinoki', frame)
    c.box(x, y, w, h, 'hinoki', frame - 2)
    c.hl(x, y, w, 'hinoki', frame + 1)
    pw = w // 2
    c.vl(x + pw, y + 1, h - 1, 'hinoki', frame - 2)
    for pane in (0, 1):
        gx = x + 2 + pane * pw; gw = pw - 3
        c.rect(gx, y + 2, gw, h - 8, 'mglass', 4 if light else 3)
        for i in range(gx + 2, gx + gw, 3): c.vl(i, y + 2, h - 8, 'hinoki', frame)
        for j in range(y + 4, y + h - 6, 3): c.hl(gx, j, gw, 'hinoki', frame)
        c.hl(gx, y + h - 6, gw, 'hinoki', frame - 1)
    c.hl(x + 1, y + h - 1, w - 2, 'hinoki', 0)
    # 손잡이
    c.px(x + pw - 2, y + h // 2 + 2, 'mmetal', 6); c.px(x + pw + 2, y + h // 2 + 2, 'mmetal', 6)

def plate(c, x, y):
    c.rect(x, y, 4, 5, 'washi', 4); c.box(x, y, 4, 5, 'sumi', 2)
    c.px(x + 1, y + 1, 'sumi', 1); c.px(x + 2, y + 2, 'sumi', 1); c.px(x + 1, y + 3, 'sumi', 1)
def mailbox(c, x, y):
    c.rect(x, y, 6, 5, 'akachin', 3); c.hl(x, y, 6, 'akachin', 5); c.vl(x + 5, y, 5, 'akachin', 1); c.hl(x, y + 4, 6, 'akachin', 1)
    c.hl(x + 1, y + 2, 4, 'mmetal', 0)

def A():
    c = C(W, H); wall(c, 4, 3)
    # 2층
    slab(c, 3, 21, 42)                                    # 베란다 바닥
    window(c, 6, 4, 34, 11, panes=2)
    rail(c, 3, 14, 42, 8)
    window(c, 50, 6, 9, 9, frame=('mmetal', 5), glass=6, dg=5, panes=1, hi=False)
    c.hl(49, 15, 11, 'mconc', 4); c.hl(49, 16, 11, 'mconc', 2)
    # 1층
    window(c, 6, 28, 16, 11, frame=('hinoki', 3), glass=3, dg=2, panes=2, hi=False)
    for i in range(7, 21, 3): c.vl(i, 29, 9, 'hinoki', 3)
    for j in (32, 35): c.hl(7, j, 14, 'hinoki', 3)
    c.hl(4, 39, 20, 'mconc', 4); c.hl(4, 40, 20, 'mconc', 2)
    door(c, 28, 26, 20, 18)
    plate(c, 51, 29); mailbox(c, 51, 36)
    # 발치 단
    c.rect(0, 44, 64, 4, 'mconc', 3); c.hl(0, 44, 64, 'mconc', 4)
    c.rect(24, 44, 28, 4, 'mconc', 4); c.hl(24, 44, 28, 'mconc', 5); c.hl(24, 47, 28, 'mconc', 2)
    return c

def B():
    c = C(W, H); wall(c, 4, 3, light=5, hl_cols=0)
    # 처마 밑 그림자 3줄 + 베란다 바닥 밑 그림자
    slab(c, 3, 21, 42, (6, 3, 0))
    window(c, 6, 4, 34, 11, panes=2, glass=6, dg=3)
    rail(c, 3, 14, 42, 8, top=6, body=3)
    window(c, 50, 6, 9, 9, frame=('mmetal', 5), glass=6, dg=5, panes=1, hi=False)
    c.hl(49, 15, 11, 'mconc', 5); c.hl(49, 16, 11, 'mconc', 1)
    window(c, 6, 28, 16, 11, frame=('hinoki', 4), glass=3, dg=1, panes=2, hi=False)
    for i in range(7, 21, 3): c.vl(i, 29, 9, 'hinoki', 4)
    for j in (32, 35): c.hl(7, j, 14, 'hinoki', 4)
    c.hl(4, 39, 20, 'mconc', 5); c.hl(4, 40, 20, 'mconc', 1)
    door(c, 28, 26, 20, 18, frame=4, light=True)
    plate(c, 51, 29); mailbox(c, 51, 36)
    c.rect(0, 44, 64, 4, 'mconc', 3); c.hl(0, 44, 64, 'mconc', 5)
    c.rect(24, 44, 28, 4, 'mconc', 5); c.hl(24, 44, 28, 'mconc', 6); c.hl(24, 47, 28, 'mconc', 1)
    # 그림자: 오른쪽 아래로 드리움
    for x in range(0, 64): c.px(x, 0, '~'); c.px(x, 1, '~'); c.px(x, 2, '-')
    c.hl(3, 23, 42, '~'); c.hl(4, 24, 42, '-')
    c.hl(6, 15, 34, '-')
    for y in range(4, 15): c.px(40, y, '-')
    for y in range(28, 44): c.px(48, y, '~') if False else None
    c.vl(47, 27, 17, '-')
    c.hl(4, 41, 18, '-')
    c.hl(0, 44, 24, '-')
    return c

def Cc():
    c = C(W, H)
    # 町家: 위층 하얀 회벽 + 작은 격자 환기창 + 목재 난간, 아래층 세로 격자(出格子) + 목재 문
    for y in range(H):
        for x in range(W):
            c.px(x, y, 'washi', 4 if y < 24 else 3)
    for y in range(H):
        if y >= 24:
            for x in range(W):
                c.px(x, y, 'hinoki', 2 if x % 3 else 1)
    for x in range(W): c.px(x, 24, 'sumi', 1); c.px(x, 25, 'sumi', 3); c.px(x, 26, 'hinoki', 4)
    # 위층: 가로 보 하나, 격자창 2개, 목재 난간
    c.hl(0, 12, W, 'sumi', 3); c.hl(0, 13, W, 'sumi', 1)
    for wx in (6, 24):
        c.rect(wx, 3, 14, 8, 'sumi', 2); c.rect(wx + 1, 4, 12, 6, 'washi', 5)
        for i in range(wx + 2, wx + 13, 2): c.vl(i, 4, 6, 'sumi', 3)
        c.hl(wx, 11, 14, 'washi', 2)
    c.rect(44, 3, 16, 8, 'sumi', 2); c.rect(45, 4, 14, 6, 'mglass', 5); c.vl(52, 4, 6, 'sumi', 2); c.px(46, 5, 'mglass', 7)
    c.hl(2, 15, 60, 'hinoki', 5); c.hl(2, 16, 60, 'hinoki', 3)
    for i in range(3, 62, 4): c.vl(i, 17, 6, 'hinoki', 2); c.px(i, 17, 'hinoki', 4)
    c.hl(2, 23, 60, 'hinoki', 1)
    # 1층: 出格子(오른쪽으로 튀어나온 세로 격자 창)와 문
    c.rect(4, 28, 20, 14, 'sumi', 1)
    for i in range(6, 23, 2): c.vl(i, 29, 12, 'hinoki', 4); c.px(i, 29, 'hinoki', 5)
    c.hl(3, 27, 22, 'sumi', 4); c.hl(3, 42, 22, 'sumi', 3)
    door(c, 32, 27, 20, 17, frame=3)
    # 노렌(가게 포렴): 짙은 남색 천 + 흰 무늬
    c.rect(33, 27, 18, 5, 'ai', 2); c.hl(33, 31, 18, 'ai', 1)
    for i in range(33, 51, 6): c.vl(i, 27, 5, 'ai', 0)
    c.px(41, 29, 'washi', 5); c.px(42, 29, 'washi', 5); c.px(41, 28, 'washi', 5)
    plate(c, 55, 30)
    c.rect(0, 44, 64, 4, 'ishi', 3); c.hl(0, 44, 64, 'ishi', 4); c.hl(0, 47, 64, 'ishi', 1)
    return c

if __name__ == '__main__':
    for n, f in (('A', A), ('B', B), ('C', Cc)): f().save(os.path.join(OUT, f'j1-{n}.pxg'))
