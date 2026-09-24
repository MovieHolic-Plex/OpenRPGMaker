"""숲마을 칩셋에 없는 소품만 손으로 찍는다(건초 수레·짚단·버섯·갈대·들꽃 변형). 있는 것은 칩셋 원래 칸을 쓴다(수정 29·59·119, 들꽃 348).
칩셋 소품 관례(시각 QA 로 맞춘 것): 한 칸 안에 들어가는 크기(수레만 2×2), 1px 짙은 외곽선, 오른쪽 아래 짙은 면 + 왼쪽 위 밝은 점,
칸마다 섞인 잔 결(매끈한 그러데이션 금지), 땅 그림자 없음, 색은 칩셋에 이미 있는 것만.
  python3 hand_props.py preview.png
  python3 hand_props.py --install <VDIR 폴더>"""
import json, math, os, sys
from PIL import Image

def hx(s): return (int(s[1:3], 16), int(s[3:5], 16), int(s[5:7], 16), 255)
# 칩셋 색(자루·항아리 178/352 의 짚색 묶음, 술통 177 의 나무 묶음, 꽃 348 의 빨강, 덤불 768 의 풀색)
PAL = {k: hx(v) for k, v in {
    'O': '#562945', 'D': '#893437', 'M': '#c67832', 'A': '#e1975a', 'L': '#ecdb95',        # 짚
    'Y': '#f0eaad', 'E': '#e9da9a', 't': '#603408', 'u': '#815521', 'v': '#6f4725', 'g2': '#bde36e',
    'o': '#312210', 'd': '#452a17', 'w': '#653f23', 'm': '#8c5d1b', 'W': '#956738', 'b': '#431d00', 'B': '#714210', 'n': '#845c1f',   # 나무
    'R': '#e0482a', 'r': '#a40100', 'y': '#f0eaad', 'h': '#d2c9c2', 'l': '#a199b1', 's': '#5c505c',   # 버섯
    'k': '#143a27', 'e': '#205030', 'f': '#2a6537', 'F': '#4b8232', 'G': '#89ac48',          # 풀
    'x': '#374243', 'g': '#777579', 'G2': '#90928f',
    'c': '#212d42', '1': '#3f5992', '2': '#5278bd', '3': '#5a93f2', '4': '#a7d4db', '5': '#f7fdff',     # 수정(538 의 파랑)
    'S': '#3d4159', 'p': '#5c505c', 'P': '#8c6c90', 'Q': '#a199b1'}.items()}                              # 받침돌(29 의 보랏빛 돌)

def grid(rows):
    w = len(rows[0]); im = Image.new('RGBA', (w, len(rows)))
    for y, row in enumerate(rows):
        assert len(row) == w, (y, row, len(row), w)
        for x, ch in enumerate(row):
            if ch != '.': im.putpixel((x, y), PAL[ch])
    return im

MUSHROOMS = [  # 큰 버섯 + 작은 버섯, 갓·대 외곽선 한 색, 대는 3칸 폭으로 가늘게
    "................",
    "................",
    "................",
    "....OOOOOO......",
    "...ORyyRRRO.....",
    "..ORyRRRRRRO....",
    "..ORRRRyRRRO....",
    "..OrrRrrrRrO....",
    "...OOOyhOOO.....",
    ".....OyyhO..OOO.",
    ".....OyyhO.ORyRO",
    ".....OyhlO.OrrrO",
    ".....OyhlO..OhO.",
    "......OOO...OOO.",
    "................",
    "................"]
REEDS_A = [  # 부들 셋 + 2~3칸 잎 획(끝은 #89ac48, 그늘 쪽만 #143a27). 밑줄은 틈이 있어 위아래로 쌓여도 16px 띠가 안 생긴다
    "................",
    "..........b.....",
    ".........bnb....",
    ".........bBb....",
    ".........bBb....",
    ".....b...bBb....",
    "....bnb..bBb.b..",
    "....bBb...b.bnb.",
    "....bBb...e.bBb.",
    "..G.bBb..Ge.bBb.",
    "..Fk.b..GF.e.b.G",
    "...Fke.GFk.eGe.F",
    "...GFe.Fk..GFe.F",
    "..GFkeGFk.GFke.F",
    ".GF.kGFk..FkGFkF",
    "..F..Fk...k.Fk.."]
REEDS_B = [  # 이삭 둘 + 맨 윗줄까지 닿는 긴 잎(위 칸 갈대와 이어진다)
    "......G.........",
    "......F....b....",
    ".....Fk...bnb...",
    ".....F....bBb...",
    "....Fk....bBb...",
    "....F.b...bBb...",
    "...Fkbnb..bBb...",
    "...F.bBb...b....",
    "..Fk.bBb...e..G.",
    "..F..bBb...e.GF.",
    ".Fk...b...Ge.Fk.",
    ".F....e..GFe.F..",
    "..G...eGFk.eGk..",
    ".GFk.GFk..GFk.G.",
    "..FkGFk..GFk.GF.",
    "...F.k....F...k."]
WHEEL = [
    "..oooo..",
    ".owmmwo.",
    "owo..owo",
    "om.mm.mo",
    "omm.dmmo",
    "om.mm.mo",
    "owo..owo",
    ".owmmwo.",
    "..oooo.."]
def hh(x, y, s):
    v = (x * 73856093) ^ (y * 19349663) ^ (s * 83492791); v = (v ^ (v >> 13)) * 1274126177 & 0xffffffff
    return ((v ^ (v >> 16)) & 0xffffffff) / 4294967296

def straw(im, mask, top=0, seed=1, straps=()):
    """짚 결: 몸 #e1975a, 2~3칸 가로 획(그늘 #c67832 / 왼쪽 위 햇빛 #ecdb95), 윗면(top 줄)은 한 단 밝고 #c67832 모서리 줄로 앞면과 갈린다.
    끈(straps: x 목록)은 앞면에만, 윗면 모서리 한 칸만 감긴다. 외곽선 #431d00, 모서리 한 칸은 깎는다(둥근 짚단)."""
    xs = [x for x, _ in mask]; ys = [y for _, y in mask]; x0, x1, y0, y1 = min(xs), max(xs), min(ys), max(ys)
    edge = y0 + top
    col = {}
    for (x, y) in mask:
        c = 'A'
        if y < edge: c = 'L' if hh(x, y, seed) < 0.45 else 'A'
        elif y == edge: c = 'M'
        elif y >= y1 - 1 or x >= x1 - 1: c = 'M' if hh(x, y, seed + 1) < 0.6 else 'A'
        col[(x, y)] = c
    for y in range(edge + 1, y1 - 1):                         # 가로 획
        x = x0 + 1
        while x < x1 - 1:
            r = hh(x, y, seed + 2); n = 2 + (hh(y, x, seed) > 0.5)
            if r < 0.3: c = 'M'
            elif r < 0.42 and (x - x0) + (y - edge) * 2 < (x1 - x0): c = 'L'
            else: x += 1; continue
            for i in range(n):
                if (x + i, y) in col: col[(x + i, y)] = c
            x += n + 1
    for sx in straps:
        for y in range(edge, y1 + 1):
            if (sx, y) in col: col[(sx, y)] = 't'
        if (sx, edge - 1) in col: col[(sx, edge - 1)] = 't'
    for (x, y), c in col.items():
        out = any((x + dx, y + dy) not in col for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)))
        im.putpixel((x, y), PAL['b'] if out else PAL[c])

def bale_mask(ox, oy, w=16, h=13):
    return {(ox + x, oy + y) for y in range(h) for x in range(w) if not ((x in (0, w - 1)) and (y in (0, h - 1)))}

def haybale():
    im = Image.new('RGBA', (16, 16)); straw(im, bale_mask(0, 3), top=3, seed=3, straps=(5, 10)); return im

def haystack():
    """짚단 셋 쌓기(2×2 칸): 아래 둘 + 가운데 이음매 위에 하나."""
    im = Image.new('RGBA', (32, 32))
    straw(im, bale_mask(0, 19), top=3, seed=5, straps=(5, 10)); straw(im, bale_mask(16, 19), top=3, seed=7, straps=(21, 26))
    straw(im, bale_mask(8, 9), top=3, seed=9, straps=(13, 18))
    return im

def cart():
    im = Image.new('RGBA', (32, 32)); by = 21                        # 짐칸 윗줄
    dome = set()
    for y in range(9, by + 1):
        for x in range(1, 29):
            dx, dy = (x + .5 - 14.5) / 14, (y + .5 - (by + 1)) / 12.5
            if dx * dx + dy * dy <= 1: dome.add((x, y))
    straw(im, dome, top=0, seed=11)
    for x, y in ((5, 12), (12, 8), (19, 8), (25, 12), (1, by), (28, by - 1)): im.putpixel((x, y), PAL['L'])   # 삐져나온 지푸라기
    wood = ['u', 'v', 'W', 'm', 'w']
    for y in range(by, by + 6):
        for x in range(1, 29):
            if y in (by, by + 5) or x in (1, 28): c = 'o'
            elif y == by + 1: c = 'W' if hh(x, y, 2) < 0.7 else 'u'
            elif y == by + 4: c = 'd' if hh(x, y, 3) < 0.7 else 'w'
            else: c = wood[int(hh(x // 3, y, 4) * len(wood))] if hh(x, y, 5) < 0.8 else 'v'
            im.putpixel((x, y), PAL[c])
    for x in (9, 20): 
        for y in range(by + 1, by + 5): im.putpixel((x, y), PAL['w'])    # 옆판 이음 기둥
    for x, y in ((29, by + 2), (30, by + 2), (31, by + 3), (29, by + 3), (30, by + 3)): im.putpixel((x, y), PAL['m' if y == by + 2 else 'd'])   # 끌채
    wheel = grid(WHEEL)
    for wx in (3, 18): im.alpha_composite(wheel, (wx, by + 2))
    return im

def crystal():
    """육각 기둥 셋(뒤 둘 → 앞 하나). 기둥마다 자기 외곽선을 둘러 겹친 곳도 갈라 보인다. 빛은 왼쪽 위."""
    im = Image.new('RGBA', (16, 16))
    base = ["..................",]
    rock = ["....SSSSSSS.....",
            "..SSQPPQPPPSSS..",
            ".SPPpPPpPPpppPS.",
            ".SSppSppppSpSSS.",
            "..SSSSSSSSSSSS.."]
    im.alpha_composite(grid(rock), (0, 11))
    def prism(cx, top, bot):
        body = {}
        for y in range(top, bot + 1):
            dark = y >= bot - 1
            body[(cx - 1, y)] = '4' if not dark else '3'
            body[(cx, y)] = '3' if not dark else '2'
            body[(cx + 1, y)] = '2' if not dark else '1'
        body[(cx - 1, top)] = '5'
        body[(cx, top - 1)] = '4'; body[(cx - 1, top - 1)] = 'c'; body[(cx + 1, top - 1)] = 'c'
        body[(cx, top - 2)] = 'c'
        ring = set()
        for (x, y) in body:
            for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                if (x + dx, y + dy) not in body: ring.add((x + dx, y + dy))
        for x, y in ring:
            if 0 <= x < 16 and 0 <= y < 16: im.putpixel((x, y), PAL['c'])
        for (x, y), ch in body.items():
            if 0 <= x < 16 and 0 <= y < 16: im.putpixel((x, y), PAL[ch])
    prism(3, 6, 12); prism(12, 5, 12); prism(7, 3, 12)
    for x, y in ((1, 2), (14, 1)): im.putpixel((x, y), PAL['5'])     # 반짝임
    return im

def flower_variant(spots):
    """칩셋 348(들꽃)의 꽃 송이(8-연결 덩이)를 떼어 spots 자리에 다시 놓는다. 색·모양은 원본 그대로."""
    def make():
        px = chip_tile(348).load(); seen = set(); blobs = []
        for y in range(16):
            for x in range(16):
                if px[x, y][3] and (x, y) not in seen:
                    st = [(x, y)]; seen.add((x, y)); cells = []
                    while st:
                        a, b = st.pop(); cells.append((a, b))
                        for dx in (-1, 0, 1):
                            for dy in (-1, 0, 1):
                                q = (a + dx, b + dy)
                                if 0 <= q[0] < 16 and 0 <= q[1] < 16 and q not in seen and px[q][3]: seen.add(q); st.append(q)
                    x0 = min(c[0] for c in cells); y0 = min(c[1] for c in cells); blobs.append([(a - x0, b - y0, px[a, b]) for a, b in cells])
        im = Image.new('RGBA', (16, 16))
        for (bx, by), n in spots:
            for a, b, c in blobs[n % len(blobs)]: im.putpixel((bx + a, by + b), c)
        return im
    return make
NATIVE = {'prop-wildflowers': [348], 'prop-crystal': [29, 59, 119]}   # 수정은 칩셋 원래 수정 덩이(29·59·119)
FLOWER_VARIANTS = [flower_variant([((2, 3), 0), ((9, 1), 1), ((6, 9), 2), ((12, 11), 3)]),
                   flower_variant([((4, 1), 2), ((11, 5), 0), ((2, 11), 1)])]
def flip(r): return (lambda: draw(r).transpose(Image.FLIP_LEFT_RIGHT))
# 한 소품에 모양이 여럿이면 목록(작성기가 칸마다 해시로 고른다). 갈대 side = 물이 있는 쪽.
HAND = {'prop-haycart': [(cart, [[1, 1], [0, 0]], {})], 'prop-haybales': [(haystack, [[1, 1], [0, 0]], {})], 'prop-haybale': [(haybale, [[0]], {})],
        'prop-mushrooms': [(MUSHROOMS, [[1]], {}), (flip(MUSHROOMS), [[1]], {})],   # 반 칸짜리 버섯은 밟고 지나간다
        'prop-wildflowers': [(v, [[1]], {}) for v in FLOWER_VARIANTS],
        'prop-reeds': [(REEDS_A, [[1]], {'side': 'R'}), (REEDS_B, [[1]], {'side': 'R'}), (flip(REEDS_A), [[1]], {'side': 'L'}), (flip(REEDS_B), [[1]], {'side': 'L'})]}
LABEL = {'prop-haycart': '건초 수레', 'prop-haybales': '쌓은 짚단', 'prop-haybale': '짚단', 'prop-crystal': '빛나는 수정', 'prop-mushrooms': '요정 버섯',
         'prop-wildflowers': '들꽃', 'prop-rock': '돌무더기', 'prop-stump': '통나무 잔해', 'prop-reeds': '갈대'}
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '../../..'))
CHIP = os.path.join(ROOT, 'public/assets/forest-harmony/chipset.png')
def chip_tile(i):
    c = Image.open(CHIP).convert('RGBA'); return c.crop(((i % 30) * 16, (i // 30) * 16, (i % 30) * 16 + 16, (i // 30) * 16 + 16))

def draw(r): return r() if callable(r) else grid(r)

def variants():
    for bp, vs in HAND.items():
        for n, (r, walk, extra) in enumerate(vs): yield bp, n, draw(r), walk, extra

def palette_check():
    """손 그림 색이 전부 칩셋에 (10칸 이상) 실제로 쓰이는 색인지."""
    from collections import Counter
    chip = Counter(p[:3] for p in Image.open(CHIP).convert('RGBA').getdata() if p[3] == 255)
    bad = {}
    for bp, n, im, _, _ in variants():
        for p in im.getdata():
            if p[3] and chip[p[:3]] < 10: bad.setdefault('#%02x%02x%02x' % p[:3], set()).add(f'{bp}#{n}')
    return bad

def preview(path):
    items = [im for _, _, im, _, _ in variants()] + [chip_tile(t) for t in (348, 29, 59, 119, 177, 207, 349, 381, 768)]
    g = chip_tile(240); out = Image.new('RGBA', (sum(i.width + 6 for i in items) + 6, 44), (20, 20, 20, 255)); x = 6
    for it in items:
        bg = Image.new('RGBA', it.size)
        for yy in range(0, it.height, 16):
            for xx in range(0, it.width, 16): bg.paste(g, (xx, yy))
        bg.alpha_composite(it); out.paste(bg, (x, 6 + 32 - it.height)); x += it.width + 6
    out.resize((out.width * 5, out.height * 5), Image.NEAREST).save(path)
    print('palette outside chipset:', palette_check() or 'none')

def install(vdir):
    bad = palette_check(); assert not bad, f'칩셋에 없는 색: {bad}'
    g = json.load(open(f'{vdir}/gen-tiles.json')); sheet = Image.open(f'{vdir}/gen-sheet.png').convert('RGBA'); cols = g['cols']
    old = [n for n, b in g['buildings'].items() if b.get('kind') == 'prop']
    ks = [c['k'] for n in old for c in g['buildings'][n]['cells'] if c and 'k' in c]
    rest = [c['k'] for n, b in g['buildings'].items() if n not in old for c in b['cells'] if c and 'k' in c]
    first = min(ks) if ks else g['tiles']
    assert all(k < first for k in rest), '소품 칸이 시트 끝에 몰려 있지 않다'
    for n in old: del g['buildings'][n]
    k = first; tiles = []
    for bp, n, im, walk, extra in variants():
        w, h = im.width // 16, im.height // 16; cells = []
        for ty in range(h):
            for tx in range(w):
                cells.append({'layer': 'U', 'k': k, 'walk': bool(walk[ty][tx])}); tiles.append(im.crop((tx * 16, ty * 16, tx * 16 + 16, ty * 16 + 16))); k += 1
        g['buildings'][f'{bp}-hand-{n}'] = {'blueprint': bp, 'label': LABEL[bp], 'kind': 'prop', 'w': w, 'h': h, 'headExtra': 0, 'doors': [], 'cells': cells, 'hand': True, 'variant': n, **extra}
    for bp, ts in NATIVE.items():
        for n, t in enumerate(ts):
            g['buildings'][f'{bp}-chip-{t}'] = {'blueprint': bp, 'label': LABEL[bp], 'kind': 'prop', 'w': 1, 'h': 1, 'headExtra': 0, 'doors': [], 'cells': [{'layer': 'U', 'orig': t, 'walk': bp == 'prop-wildflowers'}], 'native': True, 'variant': 100 + n}
    g['tiles'] = k; rows = math.ceil(k / cols)
    out = Image.new('RGBA', (cols * 16, rows * 16)); out.paste(sheet.crop((0, 0, sheet.width, min(sheet.height, rows * 16))), (0, 0))
    for i in range(first, k):
        out.paste(Image.new('RGBA', (16, 16)), ((i % cols) * 16, (i // cols) * 16)); out.paste(tiles[i - first], ((i % cols) * 16, (i // cols) * 16))
    out.save(f'{vdir}/gen-sheet.png'); json.dump(g, open(f'{vdir}/gen-tiles.json', 'w'), ensure_ascii=False)
    print('installed', sum(len(v) for v in HAND.values()), 'hand variants +', len(NATIVE), 'native;', k - first, 'tiles')

if __name__ == '__main__':
    install(sys.argv[2]) if sys.argv[1] == '--install' else preview(sys.argv[1])
