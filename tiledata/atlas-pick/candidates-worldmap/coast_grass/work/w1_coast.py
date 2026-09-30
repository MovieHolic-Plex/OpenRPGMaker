"""w1 해안 셋(coast_grass/sand/snow) 생성기 — 손으로 정한 물결 위치·테 단면을 격자 글자로 옮겨 적는다.
바다 몸통은 세 해안이 같은 body()를 쓴다(같은 글자끼리 화소 동일). 저장소 루트에서 실행."""
import math, sys, os
import numpy as np
from scipy import ndimage as ndi
sys.path.insert(0, 'scripts/content/atlas-pick')
from pxg_emit import emit

RAMP = dict(d='wdeep', w='wsea', g='wgrass', D='wdirt', F='wfoam', s='wsea', S='wsand', N='wsnow', I='wice', r='wrock', U='wdune')
def tok(t): return (RAMP[t[0]], int(t[1:]))

# ---- 바다 몸통(16px 주기) : 파랑 획 목록 (x,y,길이,단) ; 어두운 밑획은 (x+1,y+1)
def deep_body(L, alt=False):
    B = {'A': 3, 'B': 2, 'C': 3}[L]
    g = [[('wdeep', B)] * 16 for _ in range(16)]
    def put(x, y, t): g[y % 16][x % 16] = ('wdeep', t)
    if L == 'A':
        rip = [(2,3,3),(9,10,3)] if not alt else [(10,2,3),(3,11,3)]
        for x, y, n in rip:
            for i in range(n): put(x+i, y, 4)
            for i in range(n-1): put(x+1+i, y+1, 2)
    elif L == 'B':
        rip = [(2,3,4),(10,10,4)] if not alt else [(9,2,4),(2,11,4)]
        for x, y, n in rip:
            for i in range(n): put(x+i, y, 3)
            put(x, y, 4)
            for i in range(n): put(x+1+i, y+1, 1)
        for x, y in (([(7,7),(14,13)]) if not alt else [(12,6),(5,14)]): put(x, y, 1); put(x+1, y, 1)
    else:
        rip = [(3,3),(10,10)] if not alt else [(9,3),(2,11)]
        for x, y in rip:
            put(x, y+1, 4); put(x+1, y, 4); put(x+2, y, 4); put(x+3, y+1, 4)
            put(x+1, y+2, 2); put(x+2, y+2, 2)
    return g

def body_grid(L, alt=False):
    if KIND == 'deep': return deep_body(L, alt)
    B = {'A': 3, 'B': 2, 'C': 3}[L]
    g = [[('wsea', B)] * 16 for _ in range(16)]
    def put(x, y, t): g[y % 16][x % 16] = ('wsea', t)
    if L == 'A':
        rip = [(1,2,3),(10,5,3),(5,9,4),(13,12,3)] if not alt else [(8,1,3),(2,6,3),(11,10,4),(4,14,3)]
        for x, y, n in rip:
            for i in range(n): put(x+i, y, 4)
            for i in range(n-1): put(x+1+i, y+1, 2)
        gl = [(2,2),(6,9)] if not alt else [(9,1),(12,10)]
        for x, y in gl: put(x, y, 5)
    elif L == 'B':
        rip = [(1,2,4),(9,6,4),(4,10,5),(12,13,3)] if not alt else [(7,1,4),(1,6,3),(10,10,5),(3,14,4)]
        for x, y, n in rip:
            for i in range(n): put(x+i, y, 3)
            put(x, y, 4); put(x+1, y, 4)
            for i in range(n): put(x+1+i, y+1, 1)
        # 어두운 결 한 줄(깊이감): 몸통 아래쪽에 드문 tone1 끊긴 획
        dk = [(6,4,2),(14,8,2)] if not alt else [(13,4,2),(5,8,2)]
        for x, y, n in dk:
            for i in range(n): put(x+i, y, 1)
    else:
        rip = [(1,2),(9,5),(4,9),(12,12)] if not alt else [(7,1),(1,6),(10,10),(4,14)]
        for x, y in rip:
            put(x, y+1, 4); put(x+1, y, 4); put(x+2, y, 4); put(x+3, y+1, 4)
            put(x+1, y+2, 2); put(x+2, y+2, 2)
    return g

KIND = 'grass'
# ---- 기슭 단면 (깊이 d = 바깥(육지) 쪽 투명 화소에서 안쪽으로 몇 번째인가)
PROF = {
 'grass': {
  'A': dict(N='g1 D2 D1 F1 s4', S='g1 D1 F1 s4', W='g1 D1 F1 s4', E='g2 D2 F1 s4'),
  'B': dict(N='g2 D3 D1 F1 s1 s2', S='g3 D2 F2 s4 s3', W='g2 D2 F1 s1 s2', E='g3 D3 F2 s4 s3'),
  'C': dict(N='g2 r4 r2 F2 s4', S='g2 r3 F1 s4', W='g1 r2 F1 s4', E='g2 r4 F2 s4'),
 },
 'sand': {
  'A': dict(N='S3 S2 S1 F1 s4', S='S3 S1 F1 s4', W='S3 S1 F1 s4', E='S4 S2 F1 s4'),
  'B': dict(N='S4 S3 S1 F1 s1 s2', S='S4 S2 F2 s4 s3', W='S3 S1 F1 s1 s2', E='S4 S3 F2 s4 s3'),
  'C': dict(N='S4 S2 S1 F2 s4', S='S4 S1 F1 s4', W='S3 S1 F1 s4', E='S4 S2 F2 s4'),
 },
 'deep': {
  'A': dict(N='d5 d4', S='d5 d4', W='d5 d4', E='d5 d4'),
  'B': dict(N='w2 d5 d4 d3', S='w1 d5 d4', W='w2 d5 d4 d3', E='w1 d5 d4'),
  'C': dict(N='d5 d3 d4', S='d5 d3', W='d5 d4', E='d5 d3 d4'),
 },
 'snow': {
  'A': dict(N='N4 I4 I3 I1 s1', S='N4 I4 I2 s1', W='N4 I4 I2 s1', E='N5 I4 I3 s1'),
  'B': dict(N='N5 I4 I3 I1 s0 s1', S='N5 I4 I3 s4', W='N4 I3 I1 s0 s1', E='N5 I4 I3 s4 s3'),
  'C': dict(N='I4 I2 I1 s1', S='I4 I3 s1', W='I3 I1 s1', E='I4 I3 s1'),
 },
}
# 기슭선 물결 (16px 주기, 6..9 는 0 — 모서리 사분면과 이음)
WOB = {
 'A': dict(N=[1,1,1,2,2,1,1,0,0,0,0,0,1,1,1,1], S=[0,0,1,1,1,1,0,0,0,0,0,0,0,0,0,0], W=[1,1,2,2,1,1,1,0,0,0,0,1,1,2,1,1], E=[1,1,0,0,0,1,1,0,0,0,0,1,1,1,0,0]),
 'B': dict(N=[1,1,1,2,2,1,1,0,0,0,0,0,1,1,1,1], S=[0,0,1,1,1,1,0,0,0,0,0,0,0,0,0,0], W=[1,1,2,2,1,1,1,0,0,0,0,1,1,2,1,1], E=[1,1,0,0,0,1,1,0,0,0,0,1,1,1,0,0]),
 'C': dict(N=[0,2,3,1,0,2,1,0,0,0,0,1,3,2,0,1], S=[1,2,0,0,2,1,0,0,0,0,1,2,2,0,0,1], W=[2,0,1,3,2,0,1,0,0,0,0,2,3,1,0,2], E=[0,1,2,0,0,2,3,0,0,0,0,3,2,0,1,0]),
}
CORNER_R = {'A': 8.0, 'B': 8.0, 'C': 7.4}
def cmod(L, ang):
    if L != 'C': return 0.0
    return 0.9 * math.sin(ang * 5.0)

def mask_O(kind, L):
    W = WOB[L]
    O = np.zeros((16, 16), bool)
    def edge_n(): 
        for x in range(16):
            for y in range(W['N'][x]): O[y, x] = True
    def edge_s():
        for x in range(16):
            for y in range(W['S'][x]): O[15-y, x] = True
    def edge_w():
        for y in range(16):
            for x in range(W['W'][y]): O[y, x] = True
    def edge_e():
        for y in range(16):
            for x in range(W['E'][y]): O[y, 15-x] = True
    def circ(cx, cy, R, inv=False):
        for y in range(16):
            for x in range(16):
                dx, dy = x+.5-cx, y+.5-cy
                r = math.hypot(dx, dy); a = math.atan2(dy, dx)
                rr = R + cmod(L, a)
                if (r > rr) != inv and not inv: O[y, x] = True
                if inv and r < rr: O[y, x] = True
    return O, dict(N=edge_n, S=edge_s, W=edge_w, E=edge_e, circ=circ)

def build(kind, L, which):
    O, f = mask_O(kind, L)
    R = CORNER_R[L]
    if which == 'edge_n': f['N']()
    elif which == 'edge_s': f['S']()
    elif which == 'edge_w': f['W']()
    elif which == 'edge_e': f['E']()
    elif which in ('corner_nw','corner_ne','corner_sw','corner_se'):
        cy = 8.0 if which[-2] == 'n' else 8.0
        # 네 사분면: 모서리 쪽 사분면 = 원호, 나머지 둘 = 변 기슭
        tmp = np.zeros((16, 16), bool)
        cx, cyy = (8.0, 8.0)
        for y in range(16):
            for x in range(16):
                inq = (x < 8) == (which[-1] == 'w') and (y < 8) == (which[-2] == 'n')
                if inq:
                    dx, dy = x+.5-8, y+.5-8
                    r = math.hypot(dx, dy); a = math.atan2(dy, dx)
                    if r > R + cmod(L, a): tmp[y, x] = True
        O = tmp
        Wd = WOB[L]
        for x in range(16):
            for y in range(16):
                inq_x = (x < 8) == (which[-1] == 'w')
                inq_y = (y < 8) == (which[-2] == 'n')
                if inq_x and inq_y: continue
                if inq_y and not inq_x:   # 가로 방향 이웃 사분면 = 남북 변
                    if which[-2] == 'n' and y < Wd['N'][x]: O[y, x] = True
                    if which[-2] == 's' and 15-y < Wd['S'][x]: O[y, x] = True
                if inq_x and not inq_y:
                    if which[-1] == 'w' and x < Wd['W'][y]: O[y, x] = True
                    if which[-1] == 'e' and 15-x < Wd['E'][y]: O[y, x] = True
    elif which == 'inner':
        rr = 4.6 if L != 'C' else 4.2
        for (cx, cy) in ((0,0),(16,0),(0,16),(16,16)):
            for y in range(16):
                for x in range(16):
                    dx, dy = x+.5-cx, y+.5-cy
                    a = math.atan2(dy, dx)
                    if math.hypot(dx, dy) < rr + cmod(L, a)*0.6: O[y, x] = True
    elif which == 'isolated':
        for y in range(16):
            for x in range(16):
                dx, dy = x+.5-8, y+.5-8.3
                a = math.atan2(dy, dx)
                rr = 7.3 + (0.45*math.sin(a*4+0.6) if L == 'C' else 0.25*math.sin(a*2))
                if math.hypot(dx, dy*1.06) > rr: O[y, x] = True
    # body / body_alt: O 없음
    return O

def paint(kind, L, which, O):
    alt = which == 'body_alt'
    bg = body_grid(L, alt=alt)
    out = [[None]*16 for _ in range(16)]
    prof = {k: [tok(t) for t in v.split()] for k, v in PROF[kind][L].items()}
    if O.any():
        dist, idx = ndi.distance_transform_edt(~O, return_indices=True)
    for y in range(16):
        for x in range(16):
            if O[y, x]: continue
            if which in ('body', 'body_alt'):
                out[y][x] = bg[y][x]; continue
            d = int(dist[y, x]) - 1
            oy, ox = idx[0][y, x], idx[1][y, x]
            dy, dx = oy - y, ox - x
            if abs(dy) >= abs(dx): dr = 'N' if dy < 0 else 'S'
            else: dr = 'W' if dx < 0 else 'E'
            p = prof[dr]
            out[y][x] = p[d] if d < len(p) else bg[y][x]
    return out

ORDER = [['isolated','body_alt','inner'],['corner_nw','edge_n','corner_ne'],['edge_w','body','edge_e'],['corner_sw','edge_s','corner_se']]

def make(kind, L):
    global KIND; KIND = kind
    pool = iter('abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789')
    leg = {}; ch = {}
    def c(t):
        if t not in ch:
            k = next(pool); ch[t] = k; leg[k] = t
        return ch[t]
    rows = []
    for tr in ORDER:
        tiles = []
        for w in tr:
            O = build(kind, L, w)
            tiles.append(paint(kind, L, w, O))
        for y in range(16):
            s = ''
            for t in tiles:
                s += ''.join('.' if v is None else c(v) for v in t[y])
            rows.append(s)
    return emit(rows, leg, title=f'{kind} w1-{L}')

NOTES = {
 ('deep','A'): '생성 계열 결: 깊은 바다 밑색(wdeep3)+드문 물결 2줄(16px 주기), 경계는 얕은 바다에서 밝은 두 단으로 0~2px 물결치며 풀어짐',
 ('deep','B'): '명암 강화: 밑색 한 단 어둡게(wdeep2)+어두운 결 끊김, 경계에 얕은 바다색 한 줄→깊은 밝은 단→중간 단으로 3px 완만 전이',
 ('deep','C'): '들쭉날쭉 깊은 웅덩이: 경계 0~3px 크게 굴곡, 호 물결 두 줄뿐인 아주 드문 몸통, 밝은 테→어두운 해구 단',
 ('grass','A'): '생성 계열 결: 얕은 바다 밑색 한 단(tone3) 위에 3~4획 물결+밑획 한 단 어둡게, 풀 둑 흙 2px+거품 한 줄, 기슭선 0~2px 완만한 물결, 몸통 16px 주기',
 ('grass','B'): '명암 강화: 밑색 한 단 어둡게(tone2)+밝은 물결 머리(tone4)+밑획 그늘(tone1), 북·서 둑 아래 물에 둑 그림자 두 단, 남·동 둑은 밝은 흙+흰 거품',
 ('grass','C'): '바위 해안: 기슭선 0~3px 들쭉날쭉, 둑 흙 대신 바위(wrock) 2px+흰 거품, 몸통은 호(‿) 모양 물결, 모서리도 불규칙 곡선',
 ('sand','A'): '생성 계열 결: 풀 해안과 같은 바다 몸통, 마른 모래 끝→젖은 모래 두 단 어둡게→거품 한 줄',
 ('sand','B'): '명암 강화: 북·서 기슭 아래 물에 그늘 두 단, 남·동 기슭은 밝은 모래+흰 거품, 몸통은 풀 해안 B 와 동일',
 ('sand','C'): '들쭉날쭉 모래톱: 기슭선 0~3px 초승달 굴곡, 젖은 모래 띠+흰 거품, 몸통은 풀 해안 C(호 물결)와 동일',
 ('snow','A'): '생성 계열 결: 푸른 흰 얼음 판 2px(윗면 밝게)+어두운 물 테 한 줄, 거품 없음, 몸통은 풀 해안 A 와 동일',
 ('snow','B'): '명암 강화: 얼음 윗면 최밝음·앞면 두 단, 북·서 얼음 아래 물에 깊은 그늘 두 줄, 남·동은 밝은 얼음+밝은 물',
 ('snow','C'): '깨진 얼음 해안: 기슭선 0~3px 들쭉날쭉, 얼음 조각 2px 두께에 물 테 한 줄, 몸통은 풀 해안 C 와 동일',
}
if __name__ == '__main__':
    kinds = sys.argv[1:] or ['grass', 'sand', 'snow', 'deep']
    for kind in kinds:
        for L in 'ABC':
            d = f'tiledata/atlas-pick/candidates-worldmap/' + ('sea_deep' if kind == 'deep' else f'coast_{kind}')
            open(f'{d}/w1-{L}.pxg', 'w').write(make(kind, L))
            open(f'{d}/w1-{L}.note', 'w').write(NOTES[(kind, L)] + '\n')
            print('wrote', d, L)
