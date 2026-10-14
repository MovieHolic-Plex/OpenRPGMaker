#!/usr/bin/env python3
"""sengoku_edo 바닥 — 불투명 16px 이음새 없는 타일(kind terrain). 모든 무늬는 16 주기로 감긴다.

가장자리 이름 규칙(캠퍼스 curb 와 같다): `<재질>-n` = 북쪽 이웃이 다른 재질(길·물·논두렁)인 칸.
  잔디 가장자리 grass-edge-*: 이 잔디 칸의 북/남/서/동 쪽이 흙길이다(풀 가장자리가 흙 위로 들쭉날쭉).
  해자·강 water-*: 이 물 칸의 북/남/서/동 쪽이 뭍이다(북쪽 뭍은 돌 축대 앞면이 물 위로 보인다).
  논 paddy-*: 논 사각형 둘레 칸 — 그쪽 변에 논두렁(흙 둑 + 풀)이 선다.

  python3 terrain.py            # 내보내기 + 시트
"""
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from px import C, rnd, h32
from kit import Reg, contact, OUT

R = Reg('terrain')


def T(id_, name, tags=(), rules='', **kw):
    return R.add(id_, name, 1, 1, 'terrain', tags=tags, rules=rules, **kw)


def wrap(f):
    def g(c):
        for y in range(16):
            for x in range(16):
                r = f(x, y)
                if r: c.P(x, y, *r)
    return g


def W(x, y): return x % 16, y % 16


def vnoise(x, y, s, cell=4, per=16):
    """16 주기로 감기는 부드러운 잡음 0..1 — 정수 진동수 사인 여섯의 합(위상은 씨앗). 네모 덩이가 생기지 않는다."""
    import math
    acc = 0.0; tot = 0.0
    for k, (fx, fy, a) in enumerate(((1, 0, 1.0), (0, 1, 1.0), (1, 1, 0.8), (1, -1, 0.8), (2, 1, 0.5), (1, 2, 0.5), (2, -1, 0.4))):
        ph = rnd(k, 7, s) * 6.2832
        acc += a * math.sin(6.2832 * (fx * x + fy * y) / per + ph); tot += a
    return 0.5 + 0.5 * acc / tot * 1.8


# ═══════════════ 풀밭 ═══════════════
def grass(x, y, s=5, base=4, flowers=0.0):
    """풀: 바탕 한 단 + 흩어진 풀 포기(밝은 끝 둘 + 가운데 어두운 밑동) + 아주 옅은 덩이(디더 경계)."""
    x, y = W(x, y)
    t = base
    n = vnoise(x, y, s, cell=8)
    if n < 0.17 or (n < 0.24 and (x + y) % 2 == 0): t = base - 1
    elif n > 0.86 and (x + y) % 2: t = base + 1
    # 풀 포기: 칸을 4×4 로 나눠 칸마다 0~1 포기, 자리는 해시
    for oy in (0, -1, 1):
        for ox in (0, -1, 1, -2):
            cx, cy = (x + ox) // 4, (y + oy) // 4
            hh = h32(cx % 4, cy % 4, s)
            if hh % 5 > 1: continue
            px_, py_ = cx * 4 + (hh >> 4) % 3, cy * 4 + (hh >> 8) % 3
            dx, dy = x + ox - px_, y + oy - py_
            if (ox, oy) == (0, 0):
                if (dx, dy) in ((0, 0), (2, 0)): t = base + 1
                elif (dx, dy) == (1, 1): t = base - 2
                elif (dx, dy) == (1, 0): t = base + (1 if hh % 7 == 0 else 0)
    if flowers and rnd(x, y, s + 29) < flowers:
        return ('sakura', 4) if rnd(x, y, s + 31) < 0.55 else ('kin', 4)
    if flowers:
        xa, ya = W(x, y - 1)
        if rnd(xa, ya, s + 29) < flowers: return ('kusa', 2)
    return ('kusa', t)


T('grass', '풀밭', ['풀밭', '들'], '마을·들의 기본 땅. grass-b 와 덩이로 섞는다.')(wrap(lambda x, y: grass(x, y, 5)))
T('grass-b', '풀밭(짙은 변주)', ['풀밭', '들'], 'grass 와 칸마다 덩이로 섞는다.')(wrap(lambda x, y: grass(x, y, 17, base=3)))
T('grass-flower', '들꽃 풀밭', ['풀밭', '꽃'], '풀밭 가장자리·나무 둘레에 드문드문.')(wrap(lambda x, y: grass(x, y, 23, flowers=0.03)))


# ═══════════════ 흙길 ═══════════════
def dirt(x, y, s=3):
    """다진 흙: 고운 알갱이(밝·어 점) + 디더로 섞인 옅은 얼룩 + 잔돌(밝은 윗점·밑 그늘)."""
    x, y = W(x, y)
    n = vnoise(x, y, s, cell=8)
    t = 3
    if n < 0.16 or (n < 0.23 and (x + y) % 2): t = 2
    elif n > 0.86 or (n > 0.80 and (x + y) % 2): t = 4
    r = rnd(x, y, s + 9)
    if r < 0.05: t = max(1, t - 1)
    elif r > 0.93: t = min(5, t + 1)
    q = h32(x // 5, y // 5, s + 3)
    px_, py_ = (x // 5) * 5 + q % 4, (y // 5) * 5 + (q >> 3) % 4
    if q % 3 == 0:
        if (x, y) == (px_, py_): return ('ishi', 5)
        if (x, y) == (px_ + 1, py_): return ('ishi', 4)
        if (x, y) in ((px_, py_ + 1), (px_ + 1, py_ + 1)): return ('michi', 1)
    return ('michi', t)


T('road', '다진 흙길', ['길', '흙길', '가도'], '성하마을 큰길·가도. 폭 3~4칸. 가장자리 풀밭 칸은 grass-edge-* 로.')(wrap(lambda x, y: dirt(x, y, 3)))
T('road-b', '다진 흙길(변주)', ['길', '흙길'], 'road 와 섞는다.')(wrap(lambda x, y: dirt(x, y, 31)))


def dirt_track(x, y):
    """발자국·짐수레 자국이 흩어진 흙길(방향 없음)."""
    xx, yy = W(x, y)
    r = dirt(xx, yy, 47)
    k = h32(xx // 4, yy // 4, 5) % 7
    if k == 0 and (xx % 4, yy % 4) in ((1, 1), (2, 1)): return ('michi', 1)
    if k == 0 and (xx % 4, yy % 4) in ((1, 2), (2, 2)): return ('michi', 2)
    return r


T('road-c', '흙길(발자국)', ['길', '흙길'], '사람이 많이 다니는 길 가운데·광장.')(wrap(dirt_track))


def edge_fn(sides):
    """잔디 칸 + sides(n/s/w/e) 쪽이 흙길. 흙이 1~3px 파고들고 풀 가장자리는 어두운 입술 + 밝은 풀끝."""
    def f(x, y):
        best = None
        for sd in sides:
            if sd == 'n': d, u = y, x
            elif sd == 's': d, u = 15 - y, x
            elif sd == 'w': d, u = x, y
            else: d, u = 15 - x, y
            b = 1 + (h32(u // 2, ord(sd), 7) % 3)        # 흙 폭 1..3
            if d < b: return dirt(x, y, 3)
            if d == b: best = ('kusa', 1) if sd in 'nw' else ('kusa', 2)
            elif d == b + 1 and best is None: best = ('kusa', 5)
        return best or grass(x, y, 5)
    return f


for sd, nm in (('n', '북'), ('s', '남'), ('w', '서'), ('e', '동')):
    T('grass-edge-' + sd, f'풀밭 가장자리({nm}쪽 흙길)', ['풀밭', '가장자리', '길'], f'흙길 바로 {nm}쪽 풀밭 칸. 구성기가 자동으로 둔다.')(wrap(edge_fn(sd)))
for sd, nm in (('nw', '북서'), ('ne', '북동'), ('sw', '남서'), ('se', '남동')):
    T('grass-edge-' + sd, f'풀밭 모서리({nm}쪽 흙길)', ['풀밭', '가장자리', '길'], '흙길 모서리의 풀밭 칸.')(wrap(edge_fn(sd)))


# ═══════════════ 돌길·자갈 정원·이끼·마루 ═══════════════
def cobble(x, y, s=0, moss=False):
    """이시다타미: 줄마다 높이 5~6px, 길이 6~9px 엇갈린 다듬은 돌. 위·왼 모서리 밝게, 아래·오른 그늘, 줄눈 어둡게."""
    x, y = W(x, y)
    rows = [0, 5, 11, 16]
    ri = max(i for i in range(3) if rows[i] <= y)
    y0, y1 = rows[ri], rows[ri + 1]
    off = (h32(ri, 0, s + 3) % 8)
    xs = (x + off) % 16
    cuts = [0]
    k = 0
    while cuts[-1] < 16:
        cuts.append(cuts[-1] + 5 + h32(ri, k, s + 7) % 4); k += 1
    ci = max(i for i in range(len(cuts)) if cuts[i] <= xs)
    x0, x1 = cuts[ci], min(16, cuts[ci + 1])
    lx, ly = xs - x0, y - y0
    w, h = x1 - x0, y1 - y0
    if ly == h - 1 or lx == w - 1:
        if moss and h32(ci, ri, s + 41) % 3 == 0: return ('kusa', 2)
        return ('ishi', 1)
    base = 4 + (1 if h32(ci, ri, s + 11) % 4 == 0 else 0) - (1 if h32(ci, ri, s + 13) % 5 == 0 else 0)
    t = base
    if ly == 0 or lx == 0: t = base + 1
    if ly == h - 2 or lx == w - 2: t = base - 1
    r = rnd(x, y, s + 17)
    if r < 0.06: t -= 1
    return ('ishi', max(1, min(6, t)))


T('cobble', '돌길(이시다타미)', ['돌길', '포석', '참배길', '성'], '신사 참배길·성 안 길·다리 앞. 흙길과 칸 경계로 바로 잇는다.')(wrap(lambda x, y: cobble(x, y, 0)))
T('cobble-moss', '이끼 낀 돌길', ['돌길', '포석', '절', '정원'], '절·오래된 참배길. cobble 과 섞는다.')(wrap(lambda x, y: cobble(x, y, 19, moss=True)))


def raked(x, y, wavy=False):
    """가레산스이 자갈: 4px 마다 이랑(밝은 마루 + 어두운 골), 고운 자갈 점."""
    x, y = W(x, y)
    import math
    yy = y + (round(1.4 * math.sin(2 * math.pi * x / 16)) if wavy else 0)
    k = yy % 4
    t = 4 if k == 0 else 3 if k == 1 else 2 if k == 3 else 3
    if k == 0: t = 5
    r = rnd(x, y, 61)
    if r < 0.08: t -= 1
    elif r > 0.93: t += 1
    return ('suna', max(0, min(5, t)))


T('gravel', '갈퀴 자국 자갈(가레산스이)', ['자갈', '정원', '절', '저택'], '절·무가 저택 정원. 바위·이끼와 함께. 사람이 걷는 길에는 쓰지 않는다(정원 바닥).')(wrap(lambda x, y: raked(x, y)))
T('gravel-wave', '물결 자갈(가레산스이)', ['자갈', '정원', '절'], 'gravel 옆에 바위 둘레·한 줄 띠로.')(wrap(lambda x, y: raked(x, y, True)))


def moss(x, y):
    x, y = W(x, y)
    n = vnoise(x, y, 71, cell=4)
    t = 2 if n < 0.22 else 4 if n > 0.8 else 3
    r = rnd(x, y, 73)
    if r < 0.08: t += 1
    if r > 0.96: return ('kusa', 5)
    return ('matsu', t)


T('moss', '이끼 정원', ['이끼', '정원', '절'], '정원 나무 밑·바위 둘레·디딤돌 사이.')(wrap(moss))


def deck(x, y):
    """판자 마루(바깥): 가로 판 4px, 판 끝 이음 엇갈림, 윗줄 밝게·밑 줄눈 어둡게."""
    x, y = W(x, y)
    row = y // 4; ly = y % 4
    xs = (x + (h32(row, 0, 5) % 16)) % 16
    if ly == 3: return ('ki', 1)
    if xs == 0: return ('ki', 2)
    base = 4 + (1 if row % 2 else 0)
    if ly == 0: base += 1
    if rnd(x, y, 9) < 0.07 and ly in (1, 2): base -= 1
    return ('ki', min(6, base))


T('deck', '판자 마루(바깥)', ['마루', '나루터', '다리'], '나루터·물가 판자 마루. 강·해자 가장자리.')(wrap(deck))


# ═══════════════ 논 ═══════════════
def paddy_water(x, y, kind='young'):
    x, y = W(x, y)
    # 흙탕 물: 덩이 명암 + 하늘 반사 짧은 줄
    n = vnoise(x, y, 81, cell=8)
    t = 3 if n > 0.8 or (n > 0.74 and (x + y) % 2) else 2
    if (y % 8 == 3) and (x + y // 8 * 5) % 16 in (2, 3, 4, 10, 11): t = 4
    base = ('mizu', t)
    if kind == 'young':
        # 모: 줄 간격 5px·포기 간격 4px(가로 엇갈림 없음 — 모내기 줄), 한 포기 = 끝 1 + 잎 2 + 물그림자 1
        gx, gy = x % 4, y % 4
        if gx == 1 and gy == 1: return ('kusa', 5)
        if gx == 1 and gy == 2: return ('kusa', 3)
        if gx == 1 and gy == 3: return ('mizu', 1)
        return base
    if kind == 'grown':
        r = rnd(x, y, 83)
        k = (x + y * 2) % 3
        t = 4 if k == 0 else 3 if k == 1 else 5
        if r < 0.1: t = 2
        if (x * 3 + y) % 7 == 0: t = 6
        return ('kusa', t)
    # ripe: 누렇게 익은 벼 이삭
    r = rnd(x, y, 85)
    k = (x + y * 2) % 3
    t = 4 if k == 0 else 3 if k == 1 else 5
    if (x * 3 + y) % 7 == 0: return ('kin', 4)
    if r < 0.12: return ('kaya', 2)
    return ('kaya', t)


def levee(sides, kind='young'):
    """논 사각형 둘레 칸: sides 쪽에 논두렁(흙 둑). 북쪽 둑: 풀 윗면 3 + 흙 앞면 2 + 물 그늘 1. 남쪽 둑: 둑 윗면만(앞면은 아래 칸 밖)."""
    def f(x, y):
        out = None
        for sd in sides:
            if sd == 'n':
                if y <= 2: out = ('kusa', 5 if y == 1 else 4 if y == 2 else 3)
                elif y <= 4: out = out or ('michi', 3 if y == 3 else 2)
                elif y == 5: out = out or ('mizu', 1)
            elif sd == 's':
                if y >= 12: out = ('kusa', 5 if y == 13 else 4) if y <= 13 else ('michi', 3 if y == 14 else 2)
                elif y == 11: out = out or ('mizu', 1)
            elif sd == 'w':
                if x <= 2: out = out or ('kusa', 5 if x == 1 else 4)
                elif x == 3: out = out or ('michi', 2)
            elif sd == 'e':
                if x >= 13: out = out or ('kusa', 4 if x == 14 else 3)
                elif x == 12: out = out or ('mizu', 1)
        if out and out[0] == 'kusa' and rnd(x, y, 91) < 0.12: out = ('kusa', out[1] + 1)
        return out or paddy_water(x, y, kind)
    return f


T('paddy', '논(모내기 한 물논)', ['논', '농촌', '들'], '논 사각형 안쪽. 둘레 칸은 paddy-n/s/w/e·모서리. 논 사이 논두렁 길은 흙길 1칸.')(wrap(lambda x, y: paddy_water(x, y, 'young')))
T('paddy-grown', '논(자란 벼)', ['논', '농촌'], '여름 논 안쪽. paddy 대신 한 논 전체에.')(wrap(lambda x, y: paddy_water(x, y, 'grown')))
T('paddy-ripe', '논(익은 벼)', ['논', '농촌', '가을'], '가을 논 안쪽. 한 논 전체에.')(wrap(lambda x, y: paddy_water(x, y, 'ripe')))
for sd, nm in (('n', '북'), ('s', '남'), ('w', '서'), ('e', '동'), ('nw', '북서'), ('ne', '북동'), ('sw', '남서'), ('se', '남동')):
    T('paddy-' + sd, f'논두렁({nm}쪽 둑)', ['논', '논두렁', '농촌'], f'논 사각형의 {nm}쪽 둘레 칸(모 논). 안쪽은 paddy.')(wrap(levee(sd)))


# ═══════════════ 해자·강 ═══════════════
def water(x, y, s=0):
    x, y = W(x, y)
    n = vnoise(x, y, 101 + s, cell=8)
    t = 3
    if n < 0.15 or (n < 0.22 and (x + y) % 2): t = 2
    # 잔물결: 줄마다 자리가 다른 짧은 가로 반짝임(2~3px) + 그 밑 어두운 점
    row = y // 3
    ph = (x - h32(row, 0, 21 + s) % 16) % 16
    ln = 2 + h32(row, 1, 21 + s) % 2
    if y % 3 == 0 and ph < ln and h32(row, 2, 21 + s) % 3: t = 5
    if y % 3 == 1 and 0 < ph <= ln and h32(row, 2, 21 + s) % 3: t = max(1, t - 1)
    return ('mizu', t)


def stone_face(x, y, top):
    """물 위로 보이는 돌 축대 앞면(top..top+4행): 맨 윗줄 갓돌 윗면 밝게, 아래로 큰 돌 + 줄눈."""
    ly = y - top
    if ly == 0: return ('ishi', 5)
    if ly == 1: return ('ishi', 3)
    blk = (x + (3 if ly >= 3 else 0)) // 5
    lx = (x + (3 if ly >= 3 else 0)) % 5
    if lx == 4 or ly == 3: return ('ishi', 1)
    t = 3 + (h32(blk, ly // 3, 9) % 2)
    if lx == 0: t += 1
    return ('ishi', t)


def bank(sides):
    def f(x, y):
        out = None
        for sd in sides:
            if sd == 'n':
                if y <= 4: out = stone_face(x, y, 0)
                elif y == 5: out = out or ('sumi', 1)
                elif y <= 7: out = out or ('mizu', 1)
            elif sd == 's':
                if y >= 14: out = ('ishi', 5 if y == 14 else 4)
                elif y == 13: out = out or ('mizu', 1)
            elif sd == 'w':
                if x <= 1 and not (out and out[0] == 'ishi' and y <= 4): out = ('ishi', 5 if x == 1 else 4) if y > 0 else out or ('ishi', 5)
                elif x == 2: out = out or ('mizu', 1)
            elif sd == 'e':
                if x >= 14: out = out if (out and y <= 4) else ('ishi', 4 if x == 14 else 3)
                elif x == 13: out = out or ('mizu', 1)
        return out or water(x, y)
    return f


T('water', '해자·강물', ['물', '강', '해자', '연못'], '해자·강·연못 안쪽. 뭍과 닿는 칸은 water-n/s/w/e·모서리(돌 축대). 걸을 수 없다.')(wrap(lambda x, y: water(x, y)))
for sd, nm in (('n', '북'), ('s', '남'), ('w', '서'), ('e', '동'), ('nw', '북서'), ('ne', '북동'), ('sw', '남서'), ('se', '남동')):
    T('water-' + sd, f'물가 돌 축대({nm}쪽 뭍)', ['물', '해자', '강', '축대'], f'물 칸 중 {nm}쪽이 뭍인 칸. 북쪽 뭍이면 축대 앞면이 물 위로 보인다.')(wrap(bank(sd)))


# ═══════════════ 밭·돌계단 ═══════════════
def field(x, y, crop=True):
    """밭: 동서 이랑(4px: 북쪽 밝은 두둑 · 남쪽 그늘 고랑), crop 이면 두둑 위 잎 포기."""
    x, y = W(x, y)
    k = y % 4
    t = 4 if k == 0 else 3 if k == 1 else 2 if k == 2 else 1
    if rnd(x, y, 111) < 0.08: t = max(1, t - 1)
    if crop:
        if k in (0, 1) and (x + (y // 4) * 2) % 4 in (1, 2):
            return ('kusa', 5 if k == 0 else 3)
    return ('michi', t)


T('field', '채소밭(이랑 + 잎)', ['밭', '농촌', '채소'], '농가 옆 작은 밭. 사각형으로 칠하고 둘레는 흙길·풀밭.')(wrap(lambda x, y: field(x, y, True)))
T('field-bare', '갈아 놓은 밭(이랑)', ['밭', '농촌'], '빈 밭. field 와 이웃해 깔면 갈이 차례가 보인다.')(wrap(lambda x, y: field(x, y, False)))


def steps(x, y):
    """돌계단(남쪽으로 내려간다): 4px 단마다 밝은 디딤 윗면 3 + 어두운 챌면 1."""
    x, y = W(x, y)
    k = y % 4
    if k == 3: return ('ishi', 1)
    t = 5 if k == 0 else 4
    if x in (0, 15): t -= 1
    if (x + (y // 4) * 5) % 8 == 0: t -= 1
    return ('ishi', t)


T('stone-steps', '돌계단', ['계단', '신사', '절', '성'], '신사·절·성 앞 비탈. 위아래로 이어 칠한다. 걸을 수 있다.')(wrap(steps))


def sheet(path=None, z=4):
    items = [(it['id'], R.render(it).img()) for it in R.items]
    return contact(items, path or os.path.join(OUT, 'terrain', 'preview.png'), z=z, W=1800)


def tiled(ids, w, h, path, z=3):
    """여러 조각을 실제로 이어 붙인 판(이음새 확인용). ids = 2차원 id 목록."""
    from PIL import Image
    im = Image.new('RGBA', (len(ids[0]) * 16, len(ids) * 16))
    for j, row in enumerate(ids):
        for i, id_ in enumerate(row):
            im.alpha_composite(R.render(R.by[id_]).img(), (i * 16, j * 16))
    im.resize((im.width * z, im.height * z), 0).save(path)


if __name__ == '__main__':
    R.export(); sheet()
    g = 'grass'
    tiled([[g, g, 'grass-edge-s', 'grass-edge-s', g, g],
           [g, 'grass-edge-e', 'road', 'road-b', 'grass-edge-w', g],
           [g, 'grass-edge-e', 'road-c', 'road', 'road', 'road-b'],
           [g, g, 'grass-edge-n', 'grass-edge-n', 'grass-edge-nw', 'grass-edge-n'],
           ['paddy-nw', 'paddy-n', 'paddy-n', 'paddy-ne', 'cobble', 'cobble-moss'],
           ['paddy-w', 'paddy', 'paddy', 'paddy-e', 'gravel', 'gravel-wave'],
           ['paddy-sw', 'paddy-s', 'paddy-s', 'paddy-se', 'moss', 'deck'],
           ['water-nw', 'water-n', 'water-n', 'water-ne', 'paddy-grown', 'paddy-ripe'],
           ['water-w', 'water', 'water', 'water-e', 'grass-flower', g],
           ['water-sw', 'water-s', 'water-s', 'water-se', g, g]], 6, 10, os.path.join(OUT, 'terrain', 'tiled.png'))
    print(len(R.items), 'terrain')
