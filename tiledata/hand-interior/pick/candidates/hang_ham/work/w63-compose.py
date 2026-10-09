#!/usr/bin/env python3
"""w63 변형 몸통 맞추기 합성기 — hang 6 · tall vase 2 · potted 2 · banner 2 의 w63-A.pxg/.note 를 만든다.
몸통은 ref 후보에서, 담긴 물건 화소는 각 기물의 v5.pxg 에서 그대로 옮긴다(새로 그리지 않음)."""
import re, os, string
C = os.path.dirname(os.path.abspath(__file__)) + '/../..'
C = os.path.normpath(C)
LET = string.ascii_lowercase + string.ascii_uppercase

def pal_map(slug):
    m = {}
    for l in open(f'{C}/{slug}/palette.pal'):
        r = re.match(r'([A-K])\s+#\w+\s+// = (\w+):(\d)', l)
        if r: m[r[1]] = (r[2], int(r[3]))
    return m

def v5_grid(slug):
    rows, on = [], False
    for l in open(f'{C}/{slug}/v5.pxg'):
        l = l.rstrip('\n')
        if l.startswith('@block'): on = True; continue
        if on and l and not l.startswith('@'): rows.append(l)
    return rows

def objgrid(slug):
    pm = pal_map(slug)
    return [[pm.get(ch) if ch != '.' else None for ch in row] for row in v5_grid(slug)]

def emit(slug, grid, note, shadow=None, w=16):
    h = len(grid)
    mats = {}
    for row in grid:
        for c in row:
            if c and c not in mats: mats[c] = LET[len(mats)]
    out = [f'@size {w} {h}', '@cell 16', '@palette palette.pal']
    for (m, s), l in mats.items(): out.append(f'@mat {l} {m} {s}')
    if shadow:
        out += ['@layer shadow', '@block 0 0'] + shadow + ['@layer main']
    out.append('@mblock 0 0')
    out += [''.join(mats[c] if c else '.' for c in row) for row in grid]
    open(f'{C}/{slug}/w63-A.pxg', 'w').write('\n'.join(out) + '\n')
    open(f'{C}/{slug}/w63-A.note', 'w').write(note + '\n')

def blank(h=16): return [[None] * 16 for _ in range(h)]
def put(g, x, y, c): g[y][x] = c

# ---------- hang ----------
BEAM6, BEAM2, STRAW2 = ('wood', 6), ('wood', 2), ('straw', 2)
def beam_frame(slug, note):
    """ham w4-A 짜임: 막대(wood6/wood2) + straw:2 끈. 물건·끈 위치는 v5 그대로."""
    g = objgrid(slug)
    emit(slug, g, note)

for s, n in (('hang_fish', '물고기'), ('hang_fishr', '붉은 물고기'), ('hang_sausage', '소시지')):
    beam_frame(s, f'몸통=hang:ham w4-A(막대 wood6/2 + straw:2 끈 둘, 끈이 물건 윗점에 닿음). 매단 {n}은 v5 그대로; 걸이 짜임이 ham 과 이미 같아 위치 변경 없음. 합성 work/w63-compose.py')

# onion w5-C 짜임: 두 못(iron:5) 사이에 처진 straw 끈, 물건이 왼쪽/가운데(한 줄 아래)/오른쪽 끈에서 매달림
def string_frame(slug, note):
    g = blank()
    iron, st3, st2, st5 = ('iron', 5), ('straw', 3), ('straw', 2), ('straw', 3)
    for y in (1, 2): put(g, 1, y, iron); put(g, 14, y, iron)
    for x in (2, 3): put(g, x, 3, st3)
    for x in (11, 12, 13): put(g, x, 3, st2)
    put(g, 2, 4, st3); put(g, 12, 4, st3)
    for x in (4, 5): put(g, x, 4, st3)
    for x in (9, 10): put(g, x, 4, st2)
    for x in (6, 7, 8): put(g, x, 5, st3 if x < 8 else st2)
    o = objgrid(slug)
    # v5 물건(행 5~) 을 한 칸 왼쪽으로: 끈 매듭 x2 · x7 · x12 에 물건 윗점을 맞춘다
    for y in range(5, 16):
        for x in range(16):
            c = o[y][x]
            if c and x - 1 >= 0:
                g[y][x - 1] = c
    emit(slug, g, note)

for s, n in (('hang_herb', '허브 다발'), ('hang_mushroom', '버섯'), ('hang_flower', '꽃다발')):
    string_frame(s, f'몸통=hang:onion w5-C(못 iron:5 둘 + 가운데가 처진 straw 끈, 가운데 물건이 한 줄 낮게). 매단 {n}은 v5 화소를 왼쪽 1칸만 옮겨 끈 매듭(x2·x7·x12)에 맞춤. 합성 work/w63-compose.py')

# ---------- tall vase ----------
src = open(f'{C}/tall_vase_blue/w2-B.pxg').read()
for col in ('teal', 'yellow'):
    open(f'{C}/tall_vase_{col}/w63-A.pxg', 'w').write(src)
    open(f'{C}/tall_vase_{col}/w63-A.note', 'w').write(f'몸통=tall vase blue w2-B 그대로 복사(A~F 의 뜻이 같아 {col} 6단으로 다시 칠해짐). 광택 강조·오른쪽 그늘·바닥 그림자 동일\n')

# ---------- potted ----------
fl = open(f'{C}/potted_flowering/w3-B.pxg').read().split('\n')
si = fl.index('@layer shadow'); shadow = fl[si + 2: si + 18]
mi = fl.index('@mblock 0 0'); main = fl[mi + 1: mi + 17]
clay = dict(zip('klmnop', range(1, 7)))
for slug, stemrow, name in (('potted_sapling', 'F', '새싹'), ('potted_cactus', 'C', '선인장')):
    pm = pal_map(slug); o = objgrid(slug)
    g = blank()
    for y in range(9, 15):
        for x, ch in enumerate(main[y]):
            if ch in clay: g[y][x] = ('clay', clay[ch])
    for y in range(0, 8):
        for x in range(16):
            if o[y][x] and x + 1 < 16: g[y + 1][x + 1] = o[y][x]
    emit(slug, g, f'몸통=potted flowering w3-B 의 화분(clay 6단 외곽선 화분 + 바닥 그림자). v5 {name}은 오른쪽 1칸·아래 1칸 옮겨 화분 가운데 두고 줄기 끝이 화분 테두리에 닿게 함(화소는 그대로). fern 화분 대신 flowering 화분: 윗단이 더 넓어 식물이 앉기 좋음. 합성 work/w63-compose.py', shadow=shadow)

# ---------- banner ----------
ref = [l for l in open(f'{C}/banner_green/w8-C.pxg').read().split('\n')]
bi = ref.index('@mblock 0 0'); rows = [list(r) for r in ref[bi + 1: bi + 17]]
for col, slug in (('red', 'banner_red'), ('blue', 'banner_blue')):
    pm = pal_map(slug)
    rm = {'a': 1, 'b': 2, 'c': 3, 'd': 4, 'e': 5, 'f': 6}
    gold = dict(zip('hijkl', range(2, 7))); brass = dict(zip('mnopq', range(2, 7)))
    g = [r[:] for r in rows]
    # 문양(잎) 지우고 천 속을 줄무늬로 채움
    for y in range(5, 10):
        xs = range(4, 12) if y < 8 else range(5, 11)
        for i, x in enumerate(xs):
            g[y][x] = 'e' if i == 0 else ('c' if i == len(xs) - 1 else 'd')
    g[10][7] = 'd'
    out = [[None] * 16 for _ in range(16)]
    for y in range(16):
        for x in range(16):
            ch = g[y][x]
            if ch in rm: out[y][x] = (col, rm[ch])
            elif ch in gold: out[y][x] = ('gold', gold[ch])
            elif ch in brass: out[y][x] = ('brass', brass[ch])
    # v5 금 십자(행 5~8) 그대로
    v = objgrid(slug)
    for y in range(5, 9):
        for x in range(16):
            if v[y][x] and v[y][x][0] == 'gold': out[y][x] = v[y][x]
    emit(slug, out, f'몸통=banner green w8-C(놋쇠 막대+금 테두리+끝이 뾰족한 방패 천+금 술). 천은 {col} 6단(왼쪽 밝은 줄·가운데·오른쪽 그늘), 문양은 v5 금 십자로 교체. 합성 work/w63-compose.py')
print('ok')
