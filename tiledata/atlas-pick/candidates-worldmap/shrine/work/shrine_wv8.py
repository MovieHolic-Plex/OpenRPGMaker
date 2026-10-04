import sys, os, math
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'castle', 'work'))
from wv8_lib import *
W = 'mwhite'

def dome(c, y0, y1, xc=7.5, r=6.5, hi=4, lo=1):
    rows = {}
    for y in range(y0, y1 + 1):
        hw = math.sqrt(max(0, 1 - ((y1 - y) / (y1 - y0 + .5)) ** 2)) * r
        rows[y] = (int(xc - hw + .5), int(xc + hw - .5))
    c.spans(rows, W, hi=hi, lo=lo)

def A():
    c = Cv('shrine', 16, 16)
    dome(c, 1, 7)
    c.rect(1, 7, 14, 8, W, 4); c.rect(1, 8, 14, 8, W, 1); c.rect(14, 7, 14, 8, W, 0)
    c.rect(3, 9, 12, 14, 'mout', 0)
    c.body(2, 4, 9, 14, W, hi=4, lo=1); c.body(11, 13, 9, 14, W, hi=4, lo=1)
    c.rect(1, 15, 14, 15, W, 2); c.rect(14, 15, 14, 15, W, 0)
    return c

def B():
    c = Cv('shrine', 16, 16)
    dome(c, 0, 6, hi=5, lo=0)
    c.put(7, 0, 'wgold', 3); c.put(8, 0, 'wgold', 3); c.put(7, 1, 'wgold', 2); c.put(8, 1, 'wgold', 2)
    c.rect(1, 6, 14, 7, W, 5); c.rect(1, 7, 14, 7, W, 2); c.rect(14, 6, 14, 7, W, 0)
    c.rect(3, 8, 12, 14, 'mout', 0)
    c.body(2, 4, 8, 14, W, hi=5, lo=1); c.body(11, 13, 8, 14, W, hi=5, lo=1)
    c.put(7, 11, 'myellow', 3); c.put(8, 11, 'myellow', 3); c.put(7, 12, 'myellow', 2); c.put(8, 12, 'myellow', 2)
    c.rect(1, 15, 14, 15, W, 3); c.rect(14, 15, 14, 15, W, 0)
    return c

def C():
    """다른 해석 — 뾰족 첨탑형 사당: 가운데 뾰족 지붕, 기둥 둘, 금빛 꼭지."""
    c = Cv('shrine', 16, 16)
    c.cone(7, 0, 6, 7, W, hi=4, lo=1)
    c.put(7, 0, 'wgold', 3); c.put(7, 1, 'wgold', 3); c.put(8, 0, 'wgold', 2) if False else None
    c.rect(1, 6, 14, 7, W, 3); c.rect(1, 7, 14, 7, W, 1); c.rect(14, 6, 14, 7, W, 0)
    c.rect(3, 8, 12, 14, 'mout', 0)
    c.body(2, 4, 8, 14, W, hi=4, lo=1); c.body(11, 13, 8, 14, W, hi=4, lo=1)
    c.rect(1, 15, 14, 15, W, 2); c.rect(14, 15, 14, 15, W, 0)
    return c

if __name__ == '__main__':
    for n, f, note in (('A', A, 'World.png 구조를 우리 팔레트로 — 흰 돌 둥근 돔, 기둥 둘, 어두운 입구'),
                       ('B', B, '명암 강화 — 돔 위 금빛 꼭지, 입구 안 불빛, 명암 단을 늘림'),
                       ('C', C, '다른 해석 — 돔 대신 뾰족 지붕 사당')):
        c = f(); c.emit('wv8-' + n, note)
