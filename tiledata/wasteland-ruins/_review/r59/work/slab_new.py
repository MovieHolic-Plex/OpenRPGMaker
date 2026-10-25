# ------------------------------------------------------------------ 콘크리트 판 (r59)
# 깨진 옛 도시 콘크리트(보도·광장·도로판). 판 한 장 = 8×8칸(128화소), 짜임표 한 글자 = 4화소.
# 이음 배치 셋: A(slab-a/b/c 가 같이 쓴다) · D(slab-d) · E(slab-e). 맵(slabAt)은 8×8칸 덩이마다 배치 하나를 해시로 고르고(각 1/3),
# A 덩이 안 칸은 같은 (x mod 8, y mod 8) 자리의 slab-a/b/c 를 2:4:4 로 섞는다.
# 덩이 경계 띠(가장자리 2글자 = 8화소)는 세 배치가 화소까지 같다 — 경계를 건너는 이음(포트)은 위·아래 x = 4·SLAB_PT, 왼·오른 y = 4·SLAB_PL 뿐이고,
# 경계를 따라 눕는 이음은 없다(경계를 건너는 판은 이웃 덩이의 판 반쪽과 한 장으로 이어진다). 띠 안의 얼룩은 공용 씨앗, 띠에 닿는 판의 단 차이는 포트 구간마다 고정.
# 그림 규칙: 몸 = body 회색 램프(따뜻한 판은 roof 갈회), 판마다 ±1~2단, 3~6화소 부드러운 얼룩, 위·왼 모서리 빛, 아래 모서리 그늘.
# 이음 = roof[1] 따뜻한 짙은 회색(곳곳 2화소·흙 낀 토막). 금 = body[0]/slate[2] 차가운 회색(이음 색과 다르다). 낱화소 흰/갈색 점 없음.
# 표시(구멍·기름·잡초·벗겨짐·금·깨진 모서리·들뜬 판)는 모두 한 칸 안(가장자리 1화소 안쪽)에만 — 칸마다 바꿔 끼워도 잘리지 않는다.
SP = 128
SLAB_PT, SLAB_PL = (3, 12, 21, 28), (3, 11, 20, 28)
SLAB_LAYOUTS = {}          # 'a' / 'd' / 'e' → 32 행 문자열 (아래에서 채운다)
SLAB_BAND = 8              # 덩이 경계 띠(화소)

BODY = [S['body'][i] for i in range(7)]                                   # 차가운 콘크리트 몸
WARM = [S['roof'][2], S['roof'][3], S['roof'][4], S['body'][3], S['body'][4], S['body'][5], S['body'][6]]   # 흙물 든 판(어두운 쪽이 갈회)
J_CORE, J_DEEP = S['roof'][1], S['roof'][0]                               # 이음
J_DIRT, J_DIRT2 = S['bark'][2], S['bark'][1]                              # 흙 낀 이음
CR_CORE, CR_DEEP = S['body'][0], S['slate'][2]                            # 금(이음과 다른 색)
OIL = [S['slate'][1], S['slate'][2], S['body'][0], S['body'][1]]          # 기름 얼룩 짙음 → 옅음

# 띠에 닿는 판의 (단 차이, 따뜻함) — 포트 구간마다 고정(이웃 덩이의 반쪽과 같은 값). tb0 = 모서리 구간(위·아래 [28,32)∪[0,3)), lr0 = 같은 모서리(왼·오른)
_SEG_TONE = {('tb', 0): (0, 0), ('tb', 1): (1, 0), ('tb', 2): (-1, 0), ('tb', 3): (0, 1), ('tb', 4): (0, 0),
             ('lr', 0): (0, 0), ('lr', 1): (-1, 0), ('lr', 2): (1, 0), ('lr', 3): (0, 0), ('lr', 4): (0, 0)}


def _seg_of(v, ports):
    k = sum(1 for p in ports if v >= p)
    return 0 if k == len(ports) else k        # 마지막 구간은 첫 구간과 같은 모서리 구간(감김)


_SLAB_INFO = {}


def _slab_info(L):
    """배치 L 의 화소 정보: reg(판 글자) · jt(이음 0/1) · seg(이음 토막 id) · tone(판 → (램프, 바탕 단)) · seed."""
    if L in _SLAB_INFO: return _SLAB_INFO[L]
    G = SLAB_LAYOUTS[L]
    assert len(G) == 32 and all(len(r) == 32 for r in G), L
    reg = [[G[y // 4][x // 4] for x in range(SP)] for y in range(SP)]
    vj = [[False] * SP for _ in range(SP)]; hj = [[False] * SP for _ in range(SP)]
    for y in range(SP):
        for x in range(4, SP, 4):
            if reg[y][x - 1] != reg[y][x]: vj[y][x] = True
    for y in range(4, SP, 4):
        for x in range(SP):
            if reg[y - 1][x] != reg[y][x]: hj[y][x] = True
    # 이음 토막: 세로 이음은 (x, 이어진 y 덩이), 가로는 (y, 이어진 x 덩이)
    segs = []
    for x in range(4, SP, 4):
        y = 0
        while y < SP:
            if vj[y][x]:
                y0 = y
                while y < SP and vj[y][x]: y += 1
                segs.append(('v', x, y0, y))
            else: y += 1
    for y in range(4, SP, 4):
        x = 0
        while x < SP:
            if hj[y][x]:
                x0 = x
                while x < SP and hj[y][x]: x += 1
                segs.append(('h', y, x0, x))
            else: x += 1
    B = SLAB_BAND
    inband = lambda x, y: x < B or y < B or x >= SP - B or y >= SP - B
    seed = {'a': 601, 'd': 613, 'e': 629}[L]
    jt = {}                                  # (x,y) → 이음 색
    for k, (o, c0, a, b) in enumerate(segs):
        pts = [(c0, t) for t in range(a, b)] if o == 'v' else [(t, c0) for t in range(a, b)]
        band = any(inband(x, y) for (x, y) in pts)
        r = h2(k * 7 + c0, a, seed + 3)
        wide = not band and (b - a) >= 10 and r % 4 == 0                 # 2화소 이음(한 토막 통째)
        dirt = None
        if not band and (b - a) >= 12 and (r >> 3) % 3 == 0:              # 흙 낀 토막(6~12화소)
            ln = 6 + (r >> 5) % 7; st = a + 2 + (r >> 8) % max(1, (b - a) - ln - 3); dirt = (st, st + ln)
        for i, (x, y) in enumerate(pts):
            t = a + i
            col = J_CORE
            if dirt and dirt[0] <= t < dirt[1]: col = J_DIRT if (t + (r >> 2)) % 5 else J_DIRT2
            jt[(x, y)] = col
            if wide:
                wx, wy = (x - 1, y) if o == 'v' else (x, y - 1)
                if (wx, wy) not in jt: jt[(wx, wy)] = J_DEEP if not (dirt and dirt[0] <= t < dirt[1]) else J_DIRT2
    # 판마다 단(바탕 + 차이) — 띠에 닿는 판은 포트 구간 값
    letters = sorted({ch for row in G for ch in row})
    tone = {}
    for ch in letters:
        cells = [(i, j) for j in range(32) for i in range(32) if G[j][i] == ch]
        key = None
        for (i, j) in cells:
            if j <= 1 or j >= 30: key = ('tb', _seg_of(i, SLAB_PT))
            elif i <= 1 or i >= 30: key = ('lr', _seg_of(j, SLAB_PL))
            if key: break
        if key:
            sh, warm = _SEG_TONE[key]
        else:
            r = h2(ord(ch), len(cells), seed + 11) % 20
            sh = (-1 if r < 5 else 0 if r < 12 else 1 if r < 18 else 2)
            warm = 1 if h2(ord(ch), 5, seed + 13) % 6 == 0 else 0
        tone[ch] = (WARM if warm else BODY, (2 if warm else 3) + sh)
    info = dict(reg=reg, jt=jt, tone=tone, seed=seed, segs=segs, G=G)
    _SLAB_INFO[L] = info
    return info


def _mottle(x, y, seed):
    """3~6화소 부드러운 얼룩(-1/0/+1) — 덩이 분할은 공용, 덩이 값은 seed(띠 안은 공용 씨앗). 넓게 젖은 자리는 한 단 더 어둡다."""
    B = blobs(SP, 655, 4)
    k = B[(x, y)][0]
    r = h2(k[0], k[1], seed) % 20
    off = -1 if r < 4 else 1 if r >= 16 else 0
    if wrapnoise(k[0] * 4, k[1] * 4, seed + 7, 32, SP) < 0.2: off -= 1
    return off


def slab_base(c, L):
    """배치 L 의 바탕 판(표시 없음)을 128×128 에 칠한다."""
    I = _slab_info(L); reg, jt, tone = I['reg'], I['jt'], I['tone']
    B = SLAB_BAND
    for y in range(SP):
        for x in range(SP):
            if (x, y) in jt: c.P(x, y, jt[(x, y)]); continue
            ramp, t = tone[reg[y][x]]
            inb = x < B or y < B or x >= SP - B or y >= SP - B
            t += _mottle(x, y, 977 if inb else I['seed'])
            up, lf = (x, y - 1) in jt, (x - 1, y) in jt
            dn = (x, y + 1) in jt
            if up: t += 1                                        # 위 모서리 빛
            if lf: t += 1 if (y + I['seed']) % 7 else 0          # 왼 모서리 빛(드문드문 닳음)
            if dn: t -= 1                                        # 아래 모서리 그늘
            c.P(x, y, ramp[max(0, min(len(ramp) - 1, t))])
