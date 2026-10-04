import sys, os
sys.path.insert(0, os.path.dirname(__file__))
from j2_lib import Cv
from j2_small import outline, save
MAXT = {'mtile':5,'mconc':6,'mbrick':5,'mtile':5,'mblue':5,'matsu':5,'mgreen':5,'moss':4,'sakura':5,'shu':6,'myellow':5}
_px = Cv.px
def _cpx(self, x, y, k):
    if k and ':' in k:
        r, t = k.split(':'); t = max(0, min(int(t), MAXT.get(r, 9))); k = f'{r}:{t}'
    return _px(self, x, y, k)
Cv.px = _cpx

def pot(c, x, y, w, h, r, t, rim=True, strong=1):
    """화분: 윗 테두리 1~2줄 + 몸통이 아래로 좁아짐."""
    if rim:
        c.rect(x, y, w, 2, f'{r}:{t+1}'); c.h_(x, y, w, f'{r}:{t+2}'); c.px(x + w - 1, y + 1, f'{r}:{t}')
        y += 2; h -= 2
    for i in range(h):
        inset = 1 if i >= h - 2 and w > 4 else 0
        xx = x + inset; ww = w - 2 * inset
        c.rect(xx, y + i, ww, 1, f'{r}:{t}')
        c.px(xx, y + i, f'{r}:{t+strong}'); c.px(xx + ww - 1, y + i, f'{r}:{max(t-strong,0)}')
    c.h_(x + 1, y + h - 1, w - 2, f'{r}:{max(t-strong,0)}')

def bush(c, cx, cy, rx, ry, base='matsu', t=3, hi=2, dark=1):
    c.ell(cx, cy, rx, ry, f'{base}:{t}')
    # 왼쪽 위 밝게 / 오른쪽 아래 어둡게
    for y in range(int(cy - ry) - 1, int(cy + ry) + 2):
        for x in range(int(cx - rx) - 1, int(cx + rx) + 2):
            k = c.get(x, y)
            if k and k.startswith(base + ':'):
                dx, dy = x - cx, y - cy
                if dx + dy < -rx * 0.6: c.px(x, y, f'{base}:{t+hi}')
                elif dx + dy > rx * 0.7: c.px(x, y, f'{base}:{max(t-dark,0)}')

def spikes(c, x, y, n, h, base='mgreen', t=3):
    for i in range(n):
        xx = x + i * 1
        hh = h - abs(i - n // 2) * 2
        for k in range(hh):
            xk = xx + (i - n // 2) * (k // 3) * 1
            c.px(xk, y - k, f'{base}:{t + (1 if i <= n//2 else -1)}')
            if k < hh - 2: c.px(xk + 1, y - k, f'{base}:{t - 1}')

def flower(c, x, y, r='shu', t=4):
    c.px(x, y, f'{r}:{t}'); c.px(x - 1, y, f'{r}:{t-1}'); c.px(x + 1, y, f'{r}:{t-1}'); c.px(x, y - 1, f'{r}:{t+1}'); c.px(x, y + 1, f'{r}:{t-2}')
    c.px(x, y, 'myellow:4')

def ground_shadow(c, x0, x1, y):
    for x in range(x0, x1 + 2):
        if c.get(x, 14) is None and c.get(x - 1, 14) is not None and c.get(x - 1, 14) != '~': c.px(x, 14, '~')
    for x in range(x0, x1 + 2):
        if c.get(x, 15) is None and (c.get(x, 14) not in (None,) or c.get(x - 1, 14) not in (None,)): c.px(x, 15, '~')

def A():
    c = Cv(32, 16)
    # 1: 키 큰 잎 + 토분
    pot(c, 1, 9, 6, 6, 'mbrick', 3)
    spikes(c, 3, 8, 3, 7, 'mgreen', 3)
    # 2: 작은 둥근 + 꽃
    pot(c, 8, 11, 5, 4, 'mconc', 3)
    bush(c, 10, 8, 3.2, 3, 'matsu', 3)
    flower(c, 10, 6)
    # 3: 큰 덤불
    pot(c, 14, 10, 7, 5, 'mtile', 3)
    bush(c, 17, 6, 4.5, 4, 'moss', 3, hi=1)
    # 4: 파란 플라스틱 + 잔가지
    pot(c, 22, 11, 5, 4, 'mblue', 3)
    bush(c, 24, 8, 3, 3, 'mgreen', 3)
    c.px(24, 4, 'mgreen:4'); c.px(24, 5, 'mgreen:3'); c.px(23, 5, 'mgreen:3')
    # 5: 작은 토분
    pot(c, 28, 12, 4, 3, 'mbrick', 3, rim=False)
    bush(c, 29.5, 10, 2, 2, 'matsu', 4)
    flower(c, 29, 9, 'sakura', 4)
    outline(c, {'mbrick': 1, 'mtile': 1, 'mconc': 1, 'mblue': 1, 'matsu': 1, 'mgreen': 1, 'moss': 1}, keys=('mbrick', 'mtile', 'mconc', 'mblue', 'matsu', 'mgreen', 'moss'))
    ground_shadow(c, 2, 31, 15)
    for x in (7, 13, 21, 27): c.px(x + 1, 14, '~') if c.get(x + 1, 14) is None else None
    return c

def B():
    c = Cv(32, 16)
    pot(c, 1, 9, 6, 6, 'mbrick', 3, strong=2)
    spikes(c, 3, 8, 3, 7, 'mgreen', 3)
    pot(c, 8, 11, 5, 4, 'mconc', 3, strong=2)
    bush(c, 10, 8, 3.2, 3, 'matsu', 3, hi=3, dark=2)
    flower(c, 10, 6)
    pot(c, 14, 10, 7, 5, 'mtile', 3, strong=2)
    bush(c, 17, 6, 4.5, 4, 'moss', 3, hi=2, dark=2)
    pot(c, 22, 11, 5, 4, 'mblue', 3, strong=2)
    bush(c, 24, 8, 3, 3, 'mgreen', 3, hi=3, dark=2)
    c.px(24, 4, 'mgreen:5'); c.px(24, 5, 'mgreen:4'); c.px(23, 5, 'mgreen:4')
    pot(c, 28, 12, 4, 3, 'mbrick', 3, rim=False, strong=2)
    bush(c, 29.5, 10, 2, 2, 'matsu', 4, hi=2, dark=2)
    flower(c, 29, 9, 'sakura', 4)
    outline(c, {'mbrick': 0, 'mtile': 0, 'mconc': 0, 'mblue': 0, 'matsu': 1, 'mgreen': 1, 'moss': 1}, keys=('mbrick', 'mtile', 'mconc', 'mblue', 'matsu', 'mgreen', 'moss'))
    ground_shadow(c, 1, 31, 15)
    for x in range(1, 32):
        if c.get(x, 15) is None and c.get(x, 14) == '~': c.px(x, 15, '-')
    for y in range(4, 14):
        for x in (7, 13, 21, 27, 31):
            if c.get(x, y) is None: c.px(x, y, '-') if y > 11 else None
    return c

def C():
    c = Cv(32, 16)
    # 실루엣 재해석: 계단식 높이(오른쪽으로 갈수록 큰 화분), 밖으로 늘어지는 덩굴 하나
    pot(c, 0, 12, 4, 3, 'mbrick', 3, rim=False)
    bush(c, 2, 10, 2, 2, 'matsu', 4); flower(c, 2, 9, 'sakura', 4)
    pot(c, 5, 10, 5, 5, 'mconc', 3)
    spikes(c, 7, 9, 3, 6, 'mgreen', 3)
    pot(c, 11, 8, 7, 7, 'mtile', 3)
    bush(c, 14, 4, 4, 3.6, 'moss', 3, hi=1)
    # 늘어진 덩굴
    for y in range(9, 13): c.px(18, y, 'matsu:3') if c.get(18, y) is None else None
    c.px(19, 12, 'matsu:2')
    pot(c, 19, 5, 8, 10, 'mblue', 3)
    bush(c, 23, 2, 5, 3.5, 'mgreen', 3)
    flower(c, 22, 2); flower(c, 25, 3, 'myellow', 4)
    c.rect(20, 8, 6, 2, 'mconc:6'); c.px(21, 8, 'mconc:5')          # 이름표 띠
    pot(c, 28, 11, 4, 4, 'mbrick', 2)
    spikes(c, 29, 10, 3, 5, 'matsu', 3)
    outline(c, {'mbrick': 1, 'mtile': 1, 'mconc': 1, 'mblue': 1, 'matsu': 1, 'mgreen': 1, 'moss': 1}, keys=('mbrick', 'mtile', 'mconc', 'mblue', 'matsu', 'mgreen', 'moss'))
    ground_shadow(c, 1, 31, 15)
    return c

N = {'A': '강남 결: 토분·흰 화분·파란 플라스틱 5개가 키·모양 달리 줄지음, 잎 3단 명암, 꽃 한 송이, 오른쪽 아래 ~ 그림자.',
     'B': '입체 강화: 화분 좌우 명암 폭 넓게, 잎 밝은 왼쪽·짙은 오른쪽, 윗면 밝은 테두리, 바닥 ~ 두 줄 + - 번짐.',
     'C': '실루엣 재해석: 왼쪽 작은 것에서 오른쪽 키 큰 화분으로 계단식, 큰 화분에 이름표 띠·늘어진 덩굴.'}
if __name__ == '__main__':
    for L, f in (('A', A), ('B', B), ('C', C)): save(f(), 'potted_plants', L, N[L])
