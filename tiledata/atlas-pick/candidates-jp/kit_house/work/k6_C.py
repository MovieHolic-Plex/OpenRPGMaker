from k6_std import *
# C: 실루엣 재해석 — 붉은 물고기비늘 기와, 검은 세로 판벽, 격자 장지 창, 원형 작은 창, 나무 난간.
def kawC(cl):
    def kaw(x, y):
        c = (y // 8) % 2
        cx = (x + 2 * c) % 4; cy = y % 8
        t = [1, 5, 5, 4, 4, 3, 3, 1][cy]
        if cy == 4 and cx in (0, 3): t = 3
        if cy == 5 and cx in (0, 3): t = 2
        if cy == 6 and cx in (1, 2): t = 2
        if cy == 6 and cx in (0, 3): t = 2
        if cy == 3 and cx == 1: t = 5
        return cl('akachin', t)
    return kaw
S = dict(roof='akachin', wall='sumi', kaw=kawC,
  row=[1,5,4,4,3,3,3,1], col=[0,0,0,0],
  ridge=[3,5,4,2,0], rim=[1,3,5,2], mk=[5,3,4,3,2],
  eave=[0,1,2], top=[2,3], lit=4, groove=1, base=3, corner=4, rdark=1,
  fd=[2,3,1],
  fr=[5,3,2,5,4], gl=[3,2,1,4,5], sill=[4,2], fz=[3,4], bar=2,
  rail=[5,4,3,2,4,5],
  lin=[4,3,2], post=[3,2], step=[4,3,2], pan=[3,2], rail_d=[4,3,2], fd_=None)
build(S)
Hn, W_, MGc = 'hinoki', 'washi', 'mglass'
# 검은 세로 판벽: 세로 이랑(4px 주기), 위 2행·기초 3행은 build 것을 그대로 둔다
def board(x, side):
    t = [4, 3, 2, 1][x % 4] if x % 4 else 4
    t = {0: 4, 1: 3, 2: 3, 3: 1}[x % 4]
    if side == 'l':
        if x == 0: t = 0
        elif x == 1: t = 4
    if side == 'r':
        if x >= 11: t -= 1
        if x == 15: t = 0
    return ('sumi', max(0, t))
def wallfill(slug, side, y0=2, y1=29, cells=None):
    p = P(slug)
    for y in range(y0, y1):
        for x in range(16):
            if cells is None or cells(x, y): p.px(x, y, board(x, side))
for slug, side in (('wall_l', 'l'), ('wall_m', None), ('wall_r', 'r')): wallfill(slug, side)
for slug in ('win_slide', 'win_small', 'win_veranda', 'genkan'):
    pass
# 장지 창(win_slide): 나무 틀, 흰 종이 살, 오른 칸 반쯤 열림
p = P('win_slide'); wallfill('win_slide', None)
for y in range(6, 26):
    for x in range(16):
        if y in (6, 25) or x in (0, 8): key = (Hn, 3 if y != 25 else 1)
        elif y == 24: key = (Hn, 2)
        elif x == 7: key = (Hn, 2)
        else:
            inner = (x % 4 == 2) or ((y - 6) % 6 == 0)
            key = (W_, 3 if inner else 5)
            if y >= 20: key = (W_, 4 if not inner else 2)
            if x > 8 and y >= 8 and x % 2 == 0 and not inner: key = ('mglass', 3)
        p.px(x, y, key)
for x in range(16): p.px(x, 26, ('sumi', 1)); p.px(x, 27, ('sumi', 2))
# 원형 작은 창
p = P('win_small'); wallfill('win_small', None)
disc = ['....oooooo....', '..oowwwwwwoo..', '.owwwwwwwwwwo.', '.owwbwwwwwwwo.', 'owwwwwwwwwwwwo', 'owwwbwwbwwwwwo',
        'owwwwwwwwwwwwo', 'owwwwwwwwwwwwo', '.owwwwwwwwwwo.', '.owwwwwwwwwso.', '..oowwwwwsoo..', '....oooooo....']
leg = dict(o=(Hn, 2), w=('mglass', 3), b=('mglass', 6), s=('mglass', 1))
p.art(1, 8, disc, leg)
for x in range(3, 13): p.px(x, 21, (Hn, 3)); p.px(x, 22, (Hn, 1))
# 베란다: 유리 + 나무 난간(굵은 기둥, 가로대)
p = P('win_veranda'); wallfill('win_veranda', None)
for y in range(3, 18):
    for x in range(16):
        if y == 3: key = (Hn, 3)
        elif x in (0, 8): key = (Hn, 3)
        elif x in (7,): key = (Hn, 2)
        else: key = ('mglass', 3 if y <= 8 else (2 if y <= 14 else 1))
        p.px(x, y, key)
for (x, y) in ((2, 11), (3, 10), (4, 9), (10, 12), (11, 11)): p.px(x, y, ('mglass', 5))
for y in range(18, 29):
    for x in range(16):
        if y == 18: key = (Hn, 5)
        elif y == 19: key = (Hn, 3)
        elif y in (27, 28): key = (Hn, 2 if y == 27 else 1)
        elif x % 4 in (0, 1): key = (Hn, 4 if x % 4 == 0 else 3)
        else: key = ('sumi', 1)
        p.px(x, y, key)
# 현관: 세로살 미닫이(붉은 문살 대신 히노키 세로살)와 유리
p = P('genkan')
for y in range(5, 27):
    for x in range(2, 14):
        if y in (5, 26): key = (Hn, 2)
        elif x in (2, 13): key = (Hn, 3)
        elif y >= 17: key = (Hn, 4 if x % 3 == 0 else 3) if x % 3 else (Hn, 2)
        elif x % 3 == 1: key = (Hn, 4)
        else: key = ('mglass', 3 if y <= 10 else 2)
        p.px(x, y, key)
export('k6-C.pxg', 'kit_house k6-C 실루엣 재해석')
