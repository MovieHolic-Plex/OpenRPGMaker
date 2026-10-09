# 산악 요새 골짜기 낭떠러지 띠(성벽 아래 4줄) — 3/4 시점 바위 절벽 앞면 + 바닥 안개·아래 골짜기 전나무 끝.
#   한 칸 폭(16x64) 변형 넷 + 도개교 받침 둘. 변형은 칸 경계(x=0, 15)에서 지층 금·안개 윗선 높이가 같아 어떤 순서로 이어도 이음새가 없다.
#   재료: 산 바위 램프 MR(7단) — 버들항 terrain 절벽처럼 판(슬래브)마다 1px 어두운 금, 윗왼 밝은 모, 세로 결 점·잔 구멍.
#   아래로 갈수록 판 밝기를 한두 단씩 내리되(결은 그대로) 안개(steam 램프)로 잠긴다. 받침 = 버들항 성 마름돌(mf_stone.stone).
#   결정적: 칸 안 좌표와 변형 번호만으로 칠한다(같은 변형 = 같은 그림).
import os, sys, math
HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, HERE)
from PIL import Image
import mf_ground as G
from mfwl import hash2
from px2 import PAL, hx
from roman import ST

MR, SN = G.MR, G.SN
STM = [hx(c) for c in PAL['steam']]
PINE = [hx(c) for c in PAL['pine']]
ICE = [hx(c) for c in PAL['ice']]
BH = 64                      # 띠 높이(4줄)
S_EDGE = [16, 30]            # 지층 금 높이(칸 경계에서)
M_LAYERS = [48, 56]          # 골짜기 바닥 윗선 · 수관 사이 안개 띠(칸 경계에서)
M_BACK = M_LAYERS[0]

def bump(x, a, k=1, ph=0.0):
    """칸 경계(x=0, 15)에서 0 인 흔들림."""
    w = math.sin(math.pi * x / 15.0)
    if k != 1: w *= math.sin(math.pi * x / 15.0 * k + ph)
    return int(round(a * w))

# 변형: 지층 금 둘(진폭,k,위상), 윗턱 흔들림, 띠마다 세로 금(x, 길이 비율, 기울기), 짧은 지층 렌즈, 안개 두 겹 솟음, 골짜기 전나무 끝, 특징
#   a·e = 민 바위(판 이음·지층 흔들림이 다름), b = 세로 틈, c = 튀어나온 바위 혹, d = 눈 쌓인 선반 + 고드름
#   세로 금은 칸 경계에서 3화소 넘게 떨어진다(x 3..12) — 경계를 넘는 판은 톤·밝은 모가 양쪽에서 같다.
V = {
 'a': dict(st=[(3.4, 2, 0.3), (-2.6, 1, 0)], lip=(1.2, 2, 0.0), joints=[[(6, 1.0, 1)], [], [(11, 1.0, 1)], [(4, 0.8, 0)]],
           lens=[(3, 10, 23)], m=[(3, 1, 0), (-2, 1, 0)], feat=None),
 'e': dict(st=[(-2.4, 1, 0), (3.6, 2, 2.0)], lip=(-1.4, 2, 0.5), joints=[[], [(9, 1.0, -1)], [(4, 0.6, 0)], [(10, 1.0, 0)]],
           lens=[(8, 13, 9)], m=[(-1, 1, 0), (3, 1, 0)], feat=None),
 'b': dict(st=[(-2.0, 1, 0), (2.8, 2, 1.0)], lip=(-1.0, 1, 0.0), joints=[[(11, 0.8, 0)], [(3, 0.6, 1)], [], [(12, 1.0, 0)]],
           lens=[], m=[(2, 1, 0), (1, 1, 0)], feat='fissure'),
 'c': dict(st=[(3.0, 1, 0), (-1.6, 2, 1.1)], lip=(1.6, 1, 0.0), joints=[[(3, 1.0, 0)], [], [(12, 1.0, 0)], []],
           lens=[(9, 14, 37)], m=[(1, 1, 0), (-2, 1, 0)], feat='boulder'),
 'd': dict(st=[(-1.8, 2, 0.2), (1.8, 1, 0)], lip=(0.8, 2, 0.8), joints=[[(9, 0.7, 1)], [(4, 1.0, 0)], [], [(7, 1.0, 1)]],
           lens=[(2, 8, 11)], m=[(4, 1, 0), (2, 2, 0.5)], feat='shelf'),
}
BASE = [4.35, 3.85, 3.3, 2.75]     # 띠(판 줄)마다 밝기: 아래로 한 단씩 어두워진다(결은 그대로)

def _mr(t): return MR[int(max(1, min(6, round(t))))]

def face_col(v, kind=None, seed=0):
    """16x64 RGBA 한 칸 폭 낭떠러지. v = 'a'..'d'. kind = None | 'pier_w' | 'pier_e' (도개교 받침 마름돌) | 'snowlip'(산 덩이 밑, 윗턱이 눈)."""
    P = V[v]; sd = 700 + ord(v) * 13 + seed
    o = Image.new('RGBA', (16, BH)); px = o.load()
    lip = [2 + bump(x, *P['lip']) for x in range(16)]
    s = [[S_EDGE[i] + bump(x, *P['st'][i]) for x in range(16)] for i in range(2)]
    ml = [[M_LAYERS[i] - bump(x, *P['m'][i]) for x in range(16)] for i in range(2)]
    mb = ml[0]
    tops = lambda x: [lip[x] + 1, s[0][x] + 1, s[1][x] + 1, mb[x] - 7]
    def band_of(x, y):
        if y <= lip[x]: return -1
        if y < s[0][x]: return 0
        if y < s[1][x]: return 1
        return 2 if y < mb[x] - 7 else 3
    def cracks(b, x, y):
        """띠 b 의 세로 금 x 위치들(이 줄 y 에서). 길이 비율만큼만 내려가고, 기울기만큼 4줄마다 1px 옮긴다."""
        y0 = tops(x)[b]; y1 = (s[0][x], s[1][x], mb[x] - 7, mb[x])[b]
        out = []
        for (jx, ln, sl) in P['joints'][b]:
            if y - y0 > (y1 - y0) * ln + 0.5: continue
            out.append(jx + sl * ((y - y0) // 4) // 2)
        return out
    for x in range(16):
        for y in range(BH):
            b = band_of(x, y)
            if b == -1:                                    # 윗턱(성벽·산 덩이 발치 바위가 앞으로 조금 나온다)
                if y == 0: c = MR[1]
                elif y == lip[x]: c = MR[2]
                else: c = MR[6] if hash2(x, y, sd) > 0.7 else MR[5]
                if kind == 'snowlip' and 0 < y < lip[x] + 1: c = SN[6] if hash2(x, y, sd + 1) > 0.4 else SN[5]
                px[x, y] = c + (255,); continue
            xs = cracks(b, x, y)
            inner = sorted(xs)
            seg = sum(1 for j in inner if x > j)
            edge_seg = seg == 0 or seg == len(inner)
            t = BASE[b] + (0.0 if edge_seg else (hash2(seg, b, sd + 5) - 0.5) * 0.9)   # 판마다 톤(경계 판은 고정)
            dy = y - tops(x)[b]
            if dy <= 1: t += 0.6                                      # 판 윗모(빛)
            t += (hash2(x, y // 3 + int(hash2(x, 9, sd) * 7), sd + 2) - 0.5) * 1.05   # 세로 결
            h = hash2(x, y, sd + 3)
            if h < 0.05: t -= 1.4                                     # 잔 구멍
            elif h > 0.965: t += 1.0                                  # 반짝 알갱이
            if b == 0 and dy < 3: t -= (3 - dy) * 0.5                 # 윗턱 밑 그늘
            c = _mr(t)
            if x in xs: c = MR[1]                                     # 세로 금
            elif x - 1 in xs: c = _mr(min(5.4, t + 1.1))             # 금 오른쪽 = 밝은 모(빛 왼쪽 위)
            elif x - 2 in xs: c = _mr(t + 0.5)
            elif x + 1 in xs: c = MR[2]
            for i in range(2):                                       # 지층 금: 위 판 밑 그늘 + 금 + 아래 판 윗모
                if y == s[i][x]: c = MR[1]
                elif y == s[i][x] - 1 and x not in xs: c = MR[2]
            for (lx0, lx1, ly) in P['lens']:                          # 짧은 지층 렌즈(판 안의 가로 금 토막)
                if lx0 <= x <= lx1:
                    yy = ly + (1 if (x - lx0) * 2 > (lx1 - lx0) else 0)
                    if y == yy: c = MR[1] if lx0 < x < lx1 else MR[2]
                    elif y == yy + 1 and lx0 < x < lx1: c = _mr(t + 0.9)
            if b >= 2 and y >= mb[x] - 3:                             # 안개 바로 위: 엷은 김 점
                if (x + y) % 2 == 0 and hash2(x, y, sd + 4) > 0.5: c = STM[0]
            px[x, y] = c + (255,)
        # 지층 턱의 눈(금 아래 판 윗모에 군데군데)
        for i in range(2):
            if hash2(x // 4, i, sd + 8) > (0.8 if i == 0 else 0.9):
                y = s[i][x] + 1; px[x, y] = (SN[6] if hash2(x, y, sd) > 0.5 else SN[5]) + (255,)
    feat = P['feat']
    if feat == 'fissure': _fissure(px, lip, mb, sd)
    elif feat == 'boulder': _boulder(px, sd)
    elif feat == 'shelf': _shelf(px, s, sd)
    _mist(px, ml, v, sd)
    if kind in ('pier_w', 'pier_e'): _pier(px, kind == 'pier_w', s, sd)
    return o

def _fissure(px, lip, mb, sd):
    """세로로 길게 갈라진 틈: 2px 어둠, 왼쪽 볼 그늘, 오른쪽 볼(왼쪽을 보는 면) 밝음, 군데군데 끼인 돌."""
    for y in range(lip[0] + 3, M_BACK - 2):
        xc = 7 + int(round(1.3 * math.sin(y / 4.7))) + ((y // 11) % 2)
        w = 2 if y % 5 else 1
        for k in range(w): px[xc + k, y] = MR[0] + (255,)
        px[xc - 1, y] = MR[2] + (255,)
        px[xc + w, y] = MR[5] + (255,)
        if y % 13 == 6: px[xc, y] = MR[4] + (255,)

def _boulder(px, sd):
    """앞으로 튀어나온 바위 혹(깎인 면 셋): 윗면 밝음 + 눈 갓, 앞면, 오른 아래 그늘면, 아래로 지는 그늘."""
    cx, cy, rx, ry = 8, 24, 6.2, 5.6
    for y in range(int(cy - ry) - 1, int(cy + ry) + 5):
        for x in range(1, 15):                                       # 칸 경계 화소는 건드리지 않는다
            dx, dy = (x + 0.5 - cx) / rx, (y + 0.5 - cy) / ry
            d = dx * dx + dy * dy
            if d > 1.0:
                # 바위 아래·오른쪽으로 지는 그늘(앞면이 한두 단 어둡다)
                ddx, ddy = (x + 0.5 - cx - 1.5) / rx, (y + 0.5 - cy - 3) / ry
                if ddx * ddx + ddy * ddy <= 1.0 and y > cy:
                    r, g, b, a = px[x, y]
                    i = min(range(7), key=lambda k: sum((MR[k][j] - (r, g, b)[j]) ** 2 for j in range(3)))
                    px[x, y] = MR[max(0, i - 2)] + (255,)
                continue
            if d > 0.78: c = MR[1]                                     # 윤곽
            elif dy < -0.25 + dx * 0.25: c = MR[6] if hash2(x, y, sd) > 0.75 else MR[5]   # 윗면
            elif dx > 0.35 and dy > -0.1: c = MR[2] if hash2(x, y, sd + 1) > 0.2 else MR[3]  # 오른 아래 그늘면
            else: c = MR[4] if hash2(x, y, sd + 2) > 0.18 else MR[3]                       # 앞면
            if dy < -0.55 and d <= 0.78: c = SN[6] if hash2(x, y, sd + 3) > 0.35 else SN[5]  # 눈 갓
            px[x, y] = c + (255,)

def _shelf(px, s, sd):
    """지층 금 하나를 따라 앞으로 나온 바위 선반: 눈 쌓인 윗면, 어두운 앞 모서리, 아래로 늘어진 고드름."""
    for x in range(2, 14):                                          # 칸 안에서 끝난다(양끝 2화소는 지층 금 그대로)
        end = x in (2, 13)
        y0 = s[1][x] - 2 + (1 if end else 0)
        if end:
            px[x, y0] = SN[5] + (255,); px[x, y0 + 1] = MR[4] + (255,); px[x, y0 + 2] = MR[1] + (255,); px[x, y0 + 3] = MR[2] + (255,); continue
        px[x, y0] = (SN[6] if hash2(x, 1, sd) > 0.3 else SN[5]) + (255,)
        px[x, y0 + 1] = (SN[5] if hash2(x, 2, sd) > 0.5 else MR[5]) + (255,)
        px[x, y0 + 2] = MR[4] + (255,)
        px[x, y0 + 3] = MR[1] + (255,)
        px[x, y0 + 4] = MR[2] + (255,); px[x, y0 + 5] = MR[2] + (255,)
        if x % 2 == 1 and 3 < x < 13:                               # 고드름
            L = 2 + int(hash2(x, 5, sd) * 5)
            for k in range(L): px[x, y0 + 4 + k] = (ICE[6] if k == 0 else (ICE[5] if k < L - 1 else ICE[4])) + (255,)

TIPW = [0, 1, 2, 1, 2, 3, 2, 3, 4]       # 전나무 끝 줄마다 반폭: 세 단(단마다 한 칸 들어간다)

def _tip(px, cx, base, h, dim, sd):
    """골짜기 바닥 전나무 끝 하나(내려다본 작은 수관, 버들항 전나무 pine 램프): 세 단, 왼쪽 밝음·가운데·오른쪽 그늘, 오른 끝 윤곽,
    단 윗가장자리 왼쪽에 눈가루. dim = 멀수록 한 단 어둡게. 칸 밖 화소는 버린다 — 칸 경계 수관은 양쪽 변형이 같은 반쪽을 그린다."""
    for r in range(h):
        y = base - h + 1 + r
        if not 0 <= y < BH: continue
        w = TIPW[r]
        for x in range(cx - w, cx + w + 1):
            if not 0 <= x < 16: continue
            d = x - cx
            c = PINE[4 - dim] if d < 0 else (PINE[3 - dim] if d == 0 else PINE[2 - dim])
            if d == w and w > 0: c = PINE[1]
            if d == -w and w > 1: c = PINE[3 - dim]
            if r in (2, 5, 8) and d > 0: c = PINE[1]                 # 단 아랫자락 그늘
            if r == 0: c = PINE[5 - dim]
            if r in (3, 6) and d == -1: c = SN[5] if dim == 0 else STM[3]
            px[x, y] = c + (255,)

# 골짜기 바닥 수관 줄: (밑 y, 어둡기, 높이, [수관 가운데 x]) — 앞 줄은 칸 경계(0·16)에 반쪽 수관이 늘 있어 이어진다
CANOPY = {
 'a': [(57, 1, 7, [5, 11]), (66, 0, 9, [0, 8, 16])],
 'e': [(56, 1, 7, [8]), (66, 0, 9, [0, 5, 11, 16])],
 'b': [(57, 1, 7, [4, 10]), (66, 0, 9, [0, 7, 16])],
 'c': [(56, 1, 7, [9]), (66, 0, 9, [0, 4, 11, 16])],
 'd': [(57, 1, 7, [6, 12]), (66, 0, 9, [0, 9, 16])],
}

def _mist(px, ml, v, sd):
    """골짜기 바닥: 그늘진 아래 골짜기 전나무 숲 윗면(작은 수관 두 줄, 앞줄이 가깝고 밝다) + 바위 발치를 덮는 엷은 김(steam 램프, 성긴 점)과
    수관 사이로 흐르는 짧은 안개 가닥."""
    for x in range(16):                                                # 숲 바닥 그늘(수관 사이)
        for y in range(ml[0][x], BH):
            px[x, y] = (PINE[0] if hash2(x, y, sd + 20) > 0.3 else MR[1]) + (255,)
    for (base, dim, h, xs) in CANOPY[v]:
        for cx in xs:
            if cx in (0, 16): _tip(px, cx, base, h, dim, sd); continue     # 칸 경계 수관은 늘 같은 모양
            hh = h - int(hash2(cx, base, sd + 21) * 3)                       # 안쪽 수관은 키·밑 높이가 조금씩 다르다
            _tip(px, cx, base - int(hash2(cx, base, sd + 22) * 3), hh, dim, sd)
    for x in range(16):                                                # 뒷줄 수관 위 엷은 김(멀다)
        for y in range(ml[0][x] + 2, ml[0][x] + 8):
            if (x + y) % 2 == 1 and hash2(x, y, sd + 25) > 0.55 and y < BH: px[x, y] = STM[0] + (255,)
    for x in range(16):                                                # 바위 발치 김: 위로 갈수록 성기다
        for y in range(ml[0][x] - 4, ml[0][x] + 3):
            k = y - ml[0][x]
            p = (0.75, 0.6, 0.4, 0.2, 0.15, 0.4, 0.7)[k + 4]
            if (x + y) % 2 == 0 and hash2(x, y, sd + 10) > p: px[x, y] = (STM[1] if k >= 0 else STM[0]) + (255,)
            elif k == 0 and hash2(x, y, sd + 12) > 0.55: px[x, y] = STM[2] + (255,)
    for x in range(16):                                                # 수관 사이 안개 가닥(짧게 끊긴다)
        y0 = ml[1][x]
        if hash2(x // 3, y0, sd + 30) > 0.45 and 0 <= y0 < BH:
            px[x, y0] = STM[3 if hash2(x, 1, sd + 31) > 0.5 else 2] + (255,)
            if hash2(x, 2, sd + 32) > 0.5 and y0 + 1 < BH: px[x, y0 + 1] = STM[1] + (255,)

def _darker(c, n):
    """같은 램프 안에서 n 단 어둡게(MR·ST·STM 중 가장 가까운 램프)."""
    best = None
    for R in (MR, ST, STM, SN):
        for i, rc in enumerate(R):
            d = sum((rc[j] - c[j]) ** 2 for j in range(3))
            if best is None or d < best[0]: best = (d, R, i)
    _, R, i = best
    return R[max(0, i - n)]

def _pier(px, west, s, sd):
    """도개교 받침(성문 기둥 아래로 이어지는 마름돌 기둥): 위 넓고 아래 계단꼴로 좁아져 바위 지층에 얹힌다.
    west = 다리 왼쪽(오른쪽 끝이 다리에 닿는다). 동쪽 받침은 다리 그늘이 왼쪽 몇 화소에 진다."""
    import mf_stone as S
    for y in range(0, 34):
        w = 12 if y < 14 else (9 if y < 25 else 6)
        x0, x1 = (16 - w, 15) if west else (0, w - 1)
        for x in range(x0, x1 + 1):
            c = S.stone(x + (40 if west else 90), y + 8)
            edge = (x == x0) if west else (x == x1)
            if edge: c = MR[1]
            elif (x == x0 + 1 and west) or (x == x1 - 1 and not west): c = ST[3] if not west else ST[5]
            if y in (13, 24): c = ST[2]                               # 계단꼴 턱 밑 줄
            if y in (14, 25) and not edge: c = ST[6]                  # 턱 윗면 빛
            px[x, y] = tuple(c[:3]) + (255,)
        if y == 33:
            for x in range(x0, x1 + 1): px[x, y] = MR[1] + (255,)
    if not west:                                                     # 다리(왼쪽)가 오른쪽으로 던지는 그늘
        for y in range(0, M_BACK):
            for x in range(0, 4 - (1 if y > 30 else 0)):
                px[x, y] = _darker(px[x, y][:3], 2 if x < 2 else 1) + (255,)

def pick_cols(W, gate_x=(33, 37), seed=0):
    """칸 x → (변형, 종류). 같은 변형이 둘 잇달아 오지 않게, 특징 변형(b 틈·c 바위 혹·d 선반)은 서로 붙지 않게."""
    out = {}; prev = None
    bag = ['a', 'e', 'a', 'e', 'b', 'c', 'a', 'e', 'c', 'b', 'd', 'e', 'a']
    for x in range(W):
        feat = lambda v: v in ('b', 'c', 'd')
        for t in range(12):                                          # 조건에 맞을 때까지 다른 씨앗으로 다시 뽑는다
            cand = bag[int(hash2(x, 3 + t, 4711 + seed) * len(bag))]
            recent = [out[xx][0] for xx in range(max(0, x - 4), x)]
            if cand != prev and not (feat(cand) and prev and feat(prev)) and not (feat(cand) and cand in recent): break
        kind = 'pier_w' if x == gate_x[0] else ('pier_e' if x == gate_x[1] else None)
        if kind: cand = 'e' if prev == 'a' else 'a'
        out[x] = (cand, kind); prev = cand
    return out

def parts():
    """내보낼 조각: 변형 넷 + 눈 턱 + 받침 둘."""
    return {'chasm_face_a': face_col('a'), 'chasm_face_e': face_col('e'), 'chasm_face_b': face_col('b'), 'chasm_face_c': face_col('c'), 'chasm_face_d': face_col('d'),
            'chasm_face_snowlip': face_col('a', 'snowlip', seed=3),
            'chasm_pier_w': face_col('e', 'pier_w'), 'chasm_pier_e': face_col('a', 'pier_e')}

if __name__ == '__main__':
    P = parts(); o = Image.new('RGBA', (16 * len(P) + 4 * len(P), BH), (20, 20, 24, 255))
    for i, (n, im) in enumerate(P.items()): o.alpha_composite(im, (i * 20, 0))
    o.resize((o.width * 6, o.height * 6), Image.NEAREST).save('/tmp/mf_chasm_parts.png')
