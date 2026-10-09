import sys, os
sys.path.insert(0, os.path.dirname(__file__))
from s3lib import C
D = os.path.dirname(os.path.dirname(__file__))
def mats(extra=None):
    m = dict(o=('vpine',0), d=('vpine',1), m=('vpine',2), w=('vpine',3), l=('vpine',4), h=('vpine',5),
             n=('vlinen',5), N=('vlinen',4), q=('vlinen',3), P=('vlinen',6),
             b=('vblue',4), B=('vblue',3), c=('vblue',2), e=('vblue',5), k=('vblue',1),
             s=('sakura',3), S=('sakura',2), t=('sakura',4), u=('sakura',1))
    if extra: m.update(extra)
    return m

def frame(c, hi=False):
    # 기둥 (왼 x0-2, 오 x23-25), 세로 전체
    for x0 in (0, 23):
        c.vl(x0, 1, 45, 'o'); c.vl(x0+1, 1, 44, 'l'); c.vl(x0+2, 1, 44, 'w')
        c.vl(x0+2 if x0==0 else x0+2, 1, 45, 'm')
        c.px(x0+1, 1, 'h')
    # 기둥 꼭대기 (윗면 한 줄)
    for x0 in (0, 23):
        c.hl(x0, 0, 3, 'd'); c.px(x0, 0, '.')
    # 위 칸 뒤 난간
    c.rect(3, 2, 20, 3, 'w'); c.hl(3, 2, 20, 'l'); c.hl(3, 4, 20, 'd')
    # 위 칸 앞 판
    c.rect(3, 17, 20, 4, 'w'); c.hl(3, 17, 20, 'l'); c.hl(3, 18, 20, 'w'); c.hl(3, 20, 20, 'd')
    # 아래 칸 뒤판(머리판)
    c.rect(3, 24, 20, 3, 'm'); c.hl(3, 24, 20, 'w'); c.hl(3, 26, 20, 'd')
    # 아래 칸 앞 판
    c.rect(3, 37, 20, 4, 'w'); c.hl(3, 37, 20, 'l'); c.hl(3, 38, 20, 'w'); c.hl(3, 40, 20, 'd')
    # 아래 빈 공간 어둡게(반투명)
    for y in range(41, 45):
        for x in range(3, 23): c.px(x, y, '~')
    for y in range(21, 24):
        for x in range(3, 23): c.px(x, y, '~')

def ladder(c):
    for (x0, a, b) in ((26, 'l', 'w'), (30, 'w', 'm')):
        c.vl(x0, 11, 34, a); c.vl(x0+1, 11, 34, b)
    c.hl(26, 11, 2, 'h'); c.hl(30, 11, 1, 'l')
    for y in (15, 20, 25, 30, 35, 40):
        c.hl(28, y, 2, 'l'); c.hl(28, y+1, 2, 'd')

def bedding_top(c):
    # 위 칸: 매트리스 윗면 y5-9, 앞면 y10-16
    c.rect(3, 5, 20, 5, 'n'); c.hl(3, 5, 20, 'P')       # 윗면 밝게
    c.box(4, 6, 6, 3, 'P', 'P', 'N')                     # 베개
    c.hl(4, 8, 6, 'q')
    c.rect(11, 5, 12, 5, 'b'); c.hl(11, 5, 12, 'e'); c.hl(11, 9, 12, 'B')   # 이불 윗면
    c.hl(13, 7, 8, 'B')
    c.rect(3, 10, 20, 7, 'N'); c.hl(3, 10, 20, 'N')
    c.rect(11, 10, 12, 7, 'B'); c.hl(11, 10, 12, 'b'); c.hl(11, 16, 12, 'c'); c.hl(3, 16, 20, 'c')
    c.hl(3, 16, 8, 'q')
    c.vl(11, 10, 7, 'b')

def bedding_bottom(c):
    c.rect(3, 27, 20, 5, 'n'); c.hl(3, 27, 20, 'P')
    c.box(4, 28, 6, 3, 'P', 'P', 'N'); c.hl(4, 30, 6, 'q')
    c.rect(11, 27, 12, 5, 's'); c.hl(11, 27, 12, 't'); c.hl(11, 31, 12, 'S')
    c.hl(13, 29, 8, 'S')
    c.rect(3, 32, 20, 5, 'N')
    c.rect(11, 32, 12, 5, 'S'); c.hl(11, 32, 12, 's'); c.hl(11, 36, 12, 'u'); c.hl(3, 36, 8, 'q')
    c.vl(11, 32, 5, 's')

# ---------------- A : v5 결
c = C(32, 48, mats())
frame(c); ladder(c); bedding_top(c); bedding_bottom(c)
c.shadow(1, 45, 30, 2)
c.hl(0, 45, 3, 'o'); c.hl(23, 45, 3, 'o')
c.save(D + '/s3-A.pxg', 'v5 가구 결 그대로: 소나무 기둥 3px(밝/중/어둠)·앞판 윗줄 밝게, 위·아래 칸 매트리스 윗면 띠+앞면, 베개·파랑/분홍 이불 색 분리, 오른쪽 사다리, 발치 그림자 2줄')
