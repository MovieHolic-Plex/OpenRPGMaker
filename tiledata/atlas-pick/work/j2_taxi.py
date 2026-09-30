import sys, os
sys.path.insert(0, os.path.dirname(__file__))
from j2_lib import Cv
OUT = 'candidates-jp'
MAXT = {'lacq': 6, 'taxi': 5}
NOTE = {}

def mk(body):
    return lambda k: f'{body}:{max(0, min(MAXT[body], 3 + k))}'

def wheels(c, ys=((8, 7), (30, 8)), xl=2, xr=27, w=3, hub=False):
    for (y, h) in ys:
        c.rect(xl, y, w, h, 'mout:0'); c.rect(xr, y, w, h, 'mout:0')
        if hub:
            c.px(xl, y + 1, 'mout:1'); c.px(xl, y + 2, 'mout:1')

def shadow(c, x0, x1, y0, rows, side=True):
    """오른쪽 아래 그림자: 차 밑 rows 줄 + 오른쪽 옆 2열."""
    for r in range(rows):
        for x in range(x0 + 2 * r, x1 - r):
            if c.get(x, y0 + r) is None: c.px(x, y0 + r, '~' if r < rows - 1 or rows == 1 else '-')
    for x in (x1 - 1, x1):
        for y in range(y0 - 30, y0):
            if c.get(x, y) is None and y > 6: c.px(x, y, '~' if x == x1 - 1 else '-')

def lamp(c, x, y, w, h=3):
    c.rect(x, y, w, h, 'washi:4'); c.h_(x, y, w, 'washi:5'); c.h_(x, y + h - 1, w, 'washi:2')
    c.h_(x + 1, y + h, w - 2, 'taxi:1')
    c.px(x + w // 2 - 1, y + 1, 'akachin:3'); c.px(x + w // 2, y + 1, 'akachin:3')
    c.px(x, y + 1, 'taxi:4'); c.px(x + w - 1, y + 1, 'taxi:3')

def stripe(c, body, x, y, h, side):
    k = 'kgreen:3' if body == 'taxi' else 'mmetal:4'
    c.v_(x, y, h, k if side == 'l' else k.replace(':3', ':2').replace(':4', ':3'))

def A(body):
    c = Cv(32, 48); K = mk(body)
    c.rect(4, 3, 24, 38, K(0)); c.h_(5, 2, 22, K(-1))
    c.v_(4, 4, 34, K(1)); c.v_(27, 4, 34, K(-1))
    c.rect(7, 4, 18, 5, K(-1)); c.h_(7, 4, 18, K(0))
    c.rect(7, 9, 18, 5, 'mglass:2'); c.h_(7, 9, 18, 'mglass:3')
    c.rect(7, 14, 18, 10, K(1)); c.h_(7, 14, 18, K(2))
    lamp(c, 11, 16, 10)
    c.rect(6, 24, 20, 7, 'mglass:3'); c.h_(6, 24, 20, 'mglass:5'); c.px(9, 26, 'mglass:6'); c.px(10, 25, 'mglass:6')
    c.rect(6, 31, 20, 6, K(0)); c.h_(6, 31, 20, K(1))
    c.rect(4, 37, 24, 6, K(-1)); c.h_(4, 37, 24, K(0))
    c.rect(10, 39, 12, 3, 'mmetal:2'); c.h_(11, 40, 10, 'mmetal:1')
    c.rect(5, 38, 4, 3, 'myellow:5'); c.rect(23, 38, 4, 3, 'myellow:5')
    if body == 'taxi': c.h_(4, 42, 24, 'kgreen:3')          # 앞 범퍼 녹색 띠
    else: c.h_(4, 42, 24, 'mmetal:4')                        # 은색 테
    c.rect(1, 25, 3, 3, K(-1)); c.rect(28, 25, 3, 3, K(-2))  # 사이드미러
    wheels(c)
    c.px(3, 32, 'mmetal:3'); c.px(28, 32, 'mmetal:3')
    c.edge(lambda r, i, j, dx, dy: 0, keys=(body,))
    shadow(c, 6, 31, 43, 3)
    return c

def B(body):
    c = Cv(32, 48); K = mk(body)
    # 지붕 위 강한 빛: 왼쪽 위 밝고 오른쪽 아래 어둡다
    c.rect(4, 3, 24, 38, K(0)); c.h_(5, 2, 22, K(1))
    c.v_(4, 4, 34, K(2)); c.v_(5, 4, 34, K(1)); c.v_(26, 4, 34, K(-1)); c.v_(27, 4, 34, K(-2))
    # 트렁크(왼쪽 밝고 오른쪽 그늘)
    c.rect(7, 4, 18, 5, K(0)); c.h_(7, 4, 18, K(1)); c.rect(7, 4, 4, 4, K(1)); c.rect(21, 6, 4, 3, K(-1))
    c.rect(7, 9, 18, 5, 'mglass:1'); c.h_(7, 9, 18, 'mglass:2'); c.rect(7, 9, 6, 3, 'mglass:2'); c.px(8, 10, 'mglass:5'); c.h_(9, 9, 3, 'mglass:4')
    # 지붕: 크게 밝은 덩이
    c.rect(7, 14, 18, 10, K(1)); c.rect(7, 14, 10, 6, K(2)); c.rect(8, 14, 6, 3, K(3)); c.h_(7, 14, 18, K(3))
    c.rect(20, 20, 5, 4, K(0)); c.h_(7, 23, 18, K(0))
    lamp(c, 11, 16, 10)
    # 앞유리: 위 밝고 아래 어둡고 대각 반사
    c.rect(6, 24, 20, 7, 'mglass:2'); c.rect(6, 24, 20, 3, 'mglass:4'); c.h_(6, 24, 20, 'mglass:6')
    c.rect(6, 29, 20, 2, 'mglass:1')
    for i in range(4): c.px(9 + i, 28 - i, 'mglass:7' if i < 3 else 'mglass:6')
    c.rect(20, 25, 5, 2, 'mglass:3')
    # 후드: 왼쪽 밝게, 중앙 캐릭터선, 오른쪽 그늘
    c.rect(6, 31, 20, 6, K(0)); c.rect(6, 31, 8, 5, K(2)); c.h_(6, 31, 20, K(3)); c.v_(15, 32, 4, K(1)); c.rect(21, 32, 5, 5, K(-1))
    # 앞면: 어둡다
    c.rect(4, 37, 24, 6, K(-2)); c.h_(4, 37, 24, K(-1)); c.rect(4, 38, 4, 4, K(-1))
    c.rect(10, 39, 12, 3, 'mmetal:1'); c.h_(11, 39, 10, 'mmetal:3'); c.h_(11, 40, 10, 'mmetal:0'); c.h_(11, 41, 10, 'mmetal:1')
    c.rect(5, 38, 4, 3, 'myellow:5'); c.px(5, 38, 'mwhite:4'); c.rect(23, 38, 4, 3, 'myellow:3')
    if body == 'taxi': c.h_(4, 42, 24, 'kgreen:2'); c.h_(4, 42, 8, 'kgreen:4')
    else: c.h_(4, 42, 24, 'mmetal:3'); c.h_(4, 42, 8, 'mmetal:6')
    c.rect(1, 25, 3, 3, K(1)); c.rect(28, 25, 3, 3, K(-3))
    wheels(c, hub=True)
    c.px(3, 32, 'mmetal:4'); c.px(3, 33, 'mmetal:2'); c.px(28, 32, 'mmetal:2')
    c.edge(lambda r, i, j, dx, dy: 0, keys=(body,))
    # 깊은 그림자 + 헤드라이트 빛번짐
    for x in range(4, 30):
        c.px(x, 43, '~'); c.px(x, 44, '~')
    for x in range(6, 31): c.px(x, 45, '~')
    for x in range(9, 32): c.px(x, 46, '-')
    for y in range(12, 43):
        for x in (29, 30):
            if c.get(x, y) is None: c.px(x, y, '~' if x == 29 else '-')
    for x in (5, 6, 7, 8): c.px(x, 44, '%')
    return c

def C(body):
    """실루엣 재해석: 각지고 높은 지붕의 「크라운 컴포트」형 — 지붕·행등이 크고 보닛은 짧고 앞바퀴가 툭 나온다."""
    c = Cv(32, 48); K = mk(body)
    prof = {2: 7, 3: 9, 4: 10}
    for y in range(2, 44):
        hw = prof.get(y, 12 if y < 34 else 11)
        if y >= 39: hw = 12
        if y >= 43: hw = 10
        c.h_(16 - hw, y, 2 * hw, K(0))
    # 옆 빛 쪽/그늘 쪽 테
    for y in range(4, 43):
        hw = prof.get(y, 12 if y < 34 else 11)
        if y >= 39: hw = 12
        c.px(16 - hw, y, K(1)); c.px(16 + hw - 1, y, K(-1))
    c.h_(9, 2, 14, K(-1))
    c.rect(8, 4, 16, 4, K(-1)); c.h_(8, 4, 16, K(0))                           # 짧은 트렁크
    c.rect(9, 8, 14, 4, 'mglass:2'); c.h_(9, 8, 14, 'mglass:4'); c.px(10, 9, 'mglass:6')   # 뒷유리(좁게)
    c.rect(6, 12, 20, 16, K(1)); c.h_(6, 12, 20, K(2)); c.v_(6, 12, 16, K(2)); c.rect(24, 13, 2, 15, K(0))   # 크고 높은 지붕
    lamp(c, 9, 16, 14, 4)                                                       # 큰 행등
    c.px(11, 23, K(2)); c.h_(8, 25, 16, K(2))
    c.rect(7, 28, 18, 6, 'mglass:3'); c.h_(7, 28, 18, 'mglass:5'); c.px(9, 30, 'mglass:6'); c.v_(7, 28, 6, 'mglass:4')   # 서 있는 앞유리
    c.rect(9, 34, 14, 4, K(0)); c.h_(9, 34, 14, K(1))                             # 짧은 보닛
    c.rect(4, 38, 24, 6, K(-1)); c.h_(4, 38, 24, K(0))
    c.ell(8, 40.5, 2.6, 2.6, 'mwhite:4'); c.ell(24, 40.5, 2.6, 2.6, 'mwhite:3')  # 큰 둥근 헤드라이트
    c.px(7, 39, 'mwhite:5'); c.rect(8, 40, 2, 2, 'myellow:4'); c.rect(23, 40, 2, 2, 'myellow:3')
    c.rect(12, 39, 8, 4, 'mmetal:1'); c.h_(12, 39, 8, 'mmetal:3'); c.v_(14, 40, 3, 'mmetal:3'); c.v_(17, 40, 3, 'mmetal:3')   # 격자 그릴
    if body == 'taxi': c.h_(5, 43, 22, 'kgreen:3')
    else: c.h_(5, 43, 22, 'mmetal:5')
    # 툭 튀어나온 큰 바퀴
    wheels(c, ys=((6, 8), (31, 9)), xl=0, xr=28, w=4, hub=True)
    c.px(1, 33, 'mmetal:3'); c.px(30, 33, 'mmetal:3')
    c.rect(2, 26, 4, 2, K(-1)); c.rect(26, 26, 4, 2, K(-2))                       # 커다란 사이드미러
    c.edge(lambda r, i, j, dx, dy: 0, keys=(body,))
    shadow(c, 5, 31, 44, 2)
    return c

NOTES = {
 'A': '강남 세단(sedan_v)과 같은 단수·윤곽·발치 그림자: 남향 세단, 지붕 행등 {lamp}, {trim}, 오른쪽 아래 반투명 그림자 3줄.',
 'B': '빛·그림자를 세게: 왼쪽 위 지붕 덩이 밝게(+3)·오른쪽/앞면 어둡게(-2), 앞유리 대각 반사, 차 밑 짙은 ~ 두 줄 + - 번짐, 헤드라이트 % 빛번짐.',
 'C': '실루엣 재해석: 각지고 높은 지붕의 크라운 컴포트형 — 지붕·행등을 키우고 보닛을 짧게, 둥근 헤드라이트와 툭 튀어나온 큰 바퀴(16px 에서도 택시로 읽힘).',
}
if __name__ == '__main__':
    for slug, body in (('taxi_black', 'lacq'), ('taxi_yellow', 'taxi')):
        trim = '은색 테 줄' if body == 'lacq' else '앞 범퍼 녹색 띠'
        for L, f in (('A', A), ('B', B), ('C', C)):
            f(body).save(f'{OUT}/{slug}/j2-{L}.pxg', note=NOTES[L].format(lamp='흰·노랑', trim=trim))
