import sys, os, math
sys.path.insert(0, os.path.dirname(__file__))
from j2_lib import Cv
from j2_small import outline, save

def rope(c, y0, sag, th, tones, twist, x0=0, x1=47, dark_edge=True):
    """tones=(top,mid,low,dark). 처지는 밧줄. 반환: 각 x 의 윗변 y."""
    tops = {}
    for x in range(x0, x1 + 1):
        t = (x - x0) / (x1 - x0)
        y = int(round(y0 + sag * 4 * t * (1 - t)))
        tops[x] = y
        for k in range(th):
            tone = tones[0] if k == 0 else (tones[2] if k >= th - 1 else tones[1])
            c.px(x, y + k, f'hinoki:{tone}')
    # 꼬임: 오른쪽 아래로 향하는 사선
    for x in range(x0, x1 + 1):
        if (x + twist[1]) % twist[0] == 0:
            y = tops[x]
            for k in range(th):
                if c.get(x + k // 2, y + k) is not None:
                    c.px(x + k // 2, y + k, f'hinoki:{twist[2]}')
    return tops

def shide(c, x, y, n=3, w=3, hi='washi:5', mid='washi:4', lo='washi:2'):
    """번개꼴 종이 (지그재그)."""
    for i in range(n):
        yy = y + i * 2
        off = (i % 2)
        c.rect(x + off, yy, w, 2, mid)
        c.h_(x + off, yy, w, hi)
        c.px(x + off + w - 1, yy + 1, lo)
    return

def A():
    c = Cv(48, 16)
    tops = rope(c, 3, 4, 4, (5, 4, 2, 1), (4, 0, 2))
    for x in (8, 17, 27, 37):
        y = tops[x] + 4
        shide(c, x, y, n=3, w=3)
    # 밧줄 끝 매듭
    for y in range(2, 8): pass
    c.rect(0, 3, 2, 4, 'hinoki:3'); c.v_(0, 3, 4, 'hinoki:4'); c.h_(0, 6, 2, 'hinoki:1')
    c.rect(46, 3, 2, 4, 'hinoki:2'); c.v_(47, 3, 4, 'hinoki:1')
    outline(c, {'hinoki': 1, 'washi': 1}, keys=('hinoki',))
    return c

def B():
    c = Cv(48, 16)
    tops = rope(c, 2, 4, 5, (6, 5, 2, 0), (4, 1, 1))
    for x in range(48):
        c.px(x, tops[x] + 1, 'hinoki:6')            # 윗면 밝은 띠
    for x in (7, 16, 26, 37):
        y = tops[x] + 5
        shide(c, x, y, n=4, w=3, hi='washi:5', mid='washi:4', lo='washi:1')
        # 종이 오른쪽 그늘
        for i in range(4): c.px(x + (i % 2) + 2, y + i * 2, 'washi:2')
    c.rect(0, 2, 2, 5, 'hinoki:4'); c.v_(0, 2, 5, 'hinoki:6'); c.h_(0, 6, 2, 'hinoki:0')
    c.rect(46, 2, 2, 5, 'hinoki:2'); c.v_(47, 2, 5, 'hinoki:0')
    outline(c, {'hinoki': 0, 'washi': 0}, keys=('hinoki',))
    for x in range(1, 47):
        yy = tops[x] + 6
        if c.get(x, yy) is None and c.get(x, yy - 1) is not None and c.get(x, yy - 1).startswith('hinoki'): c.px(x, yy, '~')
    return c

def C():
    c = Cv(48, 16)
    # 굵은 밧줄 + 가운데 큰 매듭 + 굵은 종이 3장
    tops = rope(c, 2, 3, 6, (5, 4, 2, 1), (5, 1, 2))
    c.rect(20, tops[24] - 1, 8, 9, 'hinoki:3'); c.h_(20, tops[24] - 1, 8, 'hinoki:5'); c.v_(20, tops[24] - 1, 9, 'hinoki:4'); c.v_(27, tops[24] - 1, 9, 'hinoki:1'); c.h_(20, tops[24] + 7, 8, 'hinoki:1')
    for k in range(4): c.px(22 + k, tops[24] + k, 'hinoki:2')
    for x in (6, 15, 32, 41):
        y = tops[x] + 6
        c.rect(x, y, 4, 3, 'washi:4'); c.h_(x, y, 4, 'washi:5'); c.px(x + 3, y + 2, 'washi:2')
        c.rect(x + 1, y + 3, 3, 3, 'washi:4'); c.px(x + 3, y + 5, 'washi:2'); c.px(x + 1, y + 3, 'washi:5')
        c.rect(x, y + 6, 3, 3, 'washi:4'); c.px(x + 2, y + 8, 'washi:2'); c.px(x, y + 6, 'washi:5')
    c.rect(0, 2, 2, 6, 'hinoki:3'); c.v_(0, 2, 6, 'hinoki:4'); c.rect(46, 2, 2, 6, 'hinoki:2')
    outline(c, {'hinoki': 1, 'washi': 1}, keys=('hinoki',))
    return c

N = {'A': '강남 결: 4px 짚 밧줄이 처지고 사선 꼬임, 번개꼴 흰 종이 넷, 위 밝고 아래 어두운 3단, 어두운 갈색 윤곽.',
     'B': '입체 강화: 5px 굵은 밧줄에 윗면 밝은 띠·아래 짙은 그늘, 종이 오른쪽 그늘, 밧줄 아래 ~ 한 줄(벽 그늘).',
     'C': '실루엣 재해석: 6px 굵고 덜 처진 밧줄, 가운데 큰 매듭 덩이, 굵은 흰 종이 넷 — 16px 로도 「금줄」로 읽히는 큰 덩이.'}
if __name__ == '__main__':
    for L, f in (('A', A), ('B', B), ('C', C)): save(f(), 'shimenawa', L, N[L])
