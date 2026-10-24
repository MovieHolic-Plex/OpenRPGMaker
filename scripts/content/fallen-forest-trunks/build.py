"""폴른 스타 숲 나무 줄기 시안(2026-10-24 사용자 「줄기 자체가 안 보인다」) — B1 활엽 composer 나무 7종의 줄기·뿌리만 손 도트로 다시 찍는다.

수관 화소는 원본(beodeul_city 칸) 그대로 두고, 줄기 색 역할 틀(아래 TRUNK·ROOTS, 손으로 찍은 행 문자열)을 줄기 자리에 찍는다.
  T1 키 큰 줄기: 수관을 16px 올리고 원본 줄기 행을 이어 붙인다(원본 화소만).
  T2 굵은 줄기: 폭 +2px, 뿌리 끝 셋, 원본 줄기 4색·원본 빛 방향(오른쪽 밝음).
  T3 껍질 대비: 원본 폭, 버들항 시트의 더 따뜻한 갈색 5색, 왼쪽 밝음·오른쪽 어둠·껍질 결·밑동 접지 그늘.
  T4 = T1+T2+T3.
출력: sheet-<v>.png(16칸 폭 칸 시트) · sprites.json(시안별 composer 그림 정의, 칸 번호 = 시트 칸) · preview-<v>.png.
  python3 scripts/content/fallen-forest-trunks/build.py
3/4 관문: 통과 전(object-gate 영수증 없음).
"""
import json, sys
from pathlib import Path
from PIL import Image

R = Path(__file__).resolve().parents[3]
OUT = Path(__file__).resolve().parent
SHEET = Image.open(R / 'public/assets/beodeul-city/beodeul-city-chipset.png').convert('RGBA')
COMP = json.loads((R / 'src/assets/beodeulForestComposer.json').read_text())['types']['broadleaf']
TREES = ['bd-tree-d43edd', 'bd-tree-5844f6', 'bd-tree-b1d104', 'bd-tree-1a786c', 'bd-tree-d61d7e', 'bd-tree-bdd36e', 'bd-tree-1e09f0']

ORIG_TRUNK = {(46, 32, 22), (76, 54, 32), (112, 80, 46), (150, 112, 66)}
TUFT = {(148, 179, 83)}
# 원본 줄기 4색(원본 빛 = 오른쪽): 역할 → 색
ORIG = {'D': (46, 32, 22), 'S': (76, 54, 32), 'M': (112, 80, 46), 'L': (112, 80, 46), 'H': (150, 112, 66)}
# 버들항 시트에 있는 더 따뜻한 갈색 5색(T3·T4)
WARM = {'D': (42, 26, 15), 'S': (69, 42, 23), 'M': (99, 55, 18), 'L': (136, 90, 38), 'H': (172, 112, 68)}
SHADOW = (10, 28, 24)  # beodeul_nature 그림자 색
DARKER = {'H': 'L', 'L': 'M', 'M': 'S', 'S': 'D', 'D': 'D'}

# 줄기 한 행(왼쪽 밝음 기준). 폭별.
TRUNK = {6: 'LHMMSD', 8: 'LHLMMSSD', 10: 'LHLLMMMSSD', 12: 'LHLLMMMMSSSD'}
# 껍질 결: 줄기 행 번호(아래에서) → 바꿀 칸(폭 기준 비율 위치)과 역할. 세로로 2~3행 이어지는 갈라짐 + 옹이 하나.
def bark(width, rows):
    marks = {}
    mid = width // 2
    for r in range(rows):
        if r % 7 in (2, 3, 4): marks[(r, mid - 1)] = 'S'          # 가운데 갈라짐
        if r % 9 in (5, 6): marks[(r, width - 3)] = 'D'           # 그늘 쪽 갈라짐
        if r % 11 == 8: marks[(r, 1)] = 'L'                      # 밝은 쪽 끊김
    if rows > 10: marks[(rows // 2, mid)] = 'D'; marks[(rows // 2, mid + 1 if mid + 1 < width - 1 else mid)] = 'S'  # 옹이
    return marks
# 뿌리 틀: 아래 줄일수록 뒤. 폭 W 줄기 기준, 좌우 여유 3칸(길이 W+6). '.' = 비움, 'x' = 접지 그늘(반투명)
def roots(width):
    """뿌리 퍼짐 6행(손 도트, r3) — 줄기 밑이 양옆으로 벌어지고 왼쪽·오른쪽·앞 뿌리 끝 셋이 땅을 문다. 윤곽은 짙은 재질색(D).
    행 길이 width+8, 왼쪽 빛. D 윤곽 S 그늘 M 몸 L 빛 H 하이라이트."""
    n = width + 8
    body = lambda w: 'D' + 'LH' + 'M' * max(0, w - 6) + 'SSD' + ''
    rows = [
        '....' + body(width) + '....',
        '...D' + 'LH' + 'M' * (width - 5) + 'SS' + 'D...',
        '..DL' + 'H' + 'M' * (width - 4) + 'SSD' + 'D..',
        '.DLH' + 'L' + 'M' * (width - 6) + 'MSS' + 'SDD.',
        'DLLD' + 'D' + 'S' * (width - 6) + 'DMS' + 'D' + 'SD',
        'D' + 'D..' + '.' * ((width - 4) // 2) + 'DHMD' + '.' * ((width - 4) - (width - 4) // 2) + '..DD',
    ]
    return [r.ljust(n, '.')[:n] for r in rows]
CONTACT = lambda width: 'x' * (width + 12)

def kind(p):
    if p[3] == 0: return 'clear'
    rgb = p[:3]
    if rgb in ORIG_TRUNK: return 'trunk'
    if rgb in TUFT: return 'tuft'
    return 'crown'

def sprite_img(s):
    o = Image.new('RGBA', (s['w'] * 16, s['h'] * 16), (0, 0, 0, 0))
    for j in range(s['h']):
        for i in range(s['w']):
            t = s['tiles'][j * s['w'] + i]
            if t >= 0: o.alpha_composite(SHEET.crop((t % 128 * 16, t // 128 * 16, t % 128 * 16 + 16, t // 128 * 16 + 16)), (i * 16, j * 16))
    return o

def measure(im):
    """줄기만 있는 행 [ys, yf) · 줄기 가운데 x · 원본 폭."""
    W, H = im.size
    rows = []
    for y in range(H):
        ks = [kind(im.getpixel((x, y))) for x in range(W)]
        rows.append(ks)
    flare = H - 4  # 원본 뿌리 퍼짐은 아래 4~5행
    ys = None
    for y in range(flare - 1, -1, -1):
        if any(k == 'crown' for k in rows[y]): ys = y + 1; break
    xs = [x for y in range(ys, flare) for x in range(W) if rows[y][x] == 'trunk']
    x0, x1 = min(xs), max(xs)
    return ys, flare, (x0 + x1 + 1) / 2, x1 - x0 + 1, rows

def taller_orig(im, ys, flare, add=16):
    W, H = im.size
    o = Image.new('RGBA', (W, H + add), (0, 0, 0, 0))
    o.alpha_composite(im.crop((0, 0, W, ys)), (0, 0))
    span = max(1, flare - ys)
    for k in range(add):
        o.alpha_composite(im.crop((0, ys + (k % span), W, ys + (k % span) + 1)), (0, ys + k))
    o.alpha_composite(im.crop((0, ys, W, H)), (0, ys + add))
    return o

def repaint(im, width, pal, light_left, contact, add=0):
    W, H0 = im.size
    ys, flare, cx, w0, _ = measure(im)
    if add:
        base = Image.new('RGBA', (W, H0 + add), (0, 0, 0, 0))
        base.alpha_composite(im.crop((0, 0, W, ys)), (0, 0))
        base.alpha_composite(im.crop((0, ys, W, H0)), (0, ys + add))
        im = base
    W, H = im.size
    px = im.load()
    # 옛 줄기·뿌리·풀 다발 지우기(수관 화소는 남긴다)
    for y in range(H):
        for x in range(W):
            k = kind(px[x, y])
            # 줄기만 있는 행 아래(원본 뿌리 퍼짐)는 테두리 짙은 화소까지 다 지운다 — 남기면 수관으로 읽혀 줄기 윗끝이 내려갔다(r1 떠 있는 줄기)
            if k == 'trunk' or (k == 'tuft' and y >= H - 6) or (y >= flare + add and k != 'clear'): px[x, y] = (0, 0, 0, 0)
    top = None
    for y in range(H):
        if any(kind(px[x, y]) == 'crown' for x in range(int(cx) - 2, int(cx) + 2)):
            pass
    # 줄기 윗끝: 수관 아래 끝보다 6px 위(수관 속으로 들어가 보이지 않는 곳까지 칠해 틈이 없게)
    crown_bottom = max(y for y in range(min(H, ys + add + 1)) if any(kind(px[x, y]) == 'crown' for x in range(int(cx - width / 2), int(cx + width / 2) + 1)))
    ytop = max(0, min(ys + add, crown_bottom) - 6)
    R = roots(width)
    yroot = H - len(R)
    x0 = int(round(cx - width / 2))
    def put(x, y, role):
        if role == '.' or not (0 <= x < W and 0 <= y < H): return
        if kind(px[x, y]) == 'crown' and px[x, y][3] == 255: return  # 접지 그늘(반투명)은 뿌리가 덮는다
        if role == 'x':
            if px[x, y][3] == 0: px[x, y] = SHADOW + (118,)
            return
        if not light_left:
            role = {'H': 'H', 'L': 'L', 'M': 'M', 'S': 'S', 'D': 'D'}[role]
        px[x, y] = pal[role] + (255,)
    tmpl = TRUNK[width] if light_left else TRUNK[width][::-1]
    rows = yroot - ytop
    marks = bark(width, rows)
    # 접지 그늘(뿌리 뒤) 먼저 — 마지막 두 행
    c = CONTACT(width)
    for dy in (H - 2, H - 1):
        for i, ch in enumerate(c):
            xx = x0 - 6 + i
            if dy == H - 1 and (i < 2 or i >= len(c) - 2): continue
            if contact: put(xx, dy, ch)
    for r, y in enumerate(range(ytop, yroot)):
        under = y - crown_bottom  # 수관 바로 밑 두 행은 한 단 어둡게(수관 그늘)
        for i, role in enumerate(tmpl):
            rr = r_from_bottom = yroot - 1 - y
            m = marks.get((rr, i if light_left else width - 1 - i))
            if m: role = m if light_left else m
            if 0 < under <= 2 or y <= crown_bottom: role = DARKER[role]
            put(x0 + i, y, role)
    for j, row in enumerate(R):
        if not light_left: row = row[::-1].translate(str.maketrans('', ''))
        for i, role in enumerate(row):
            if role == '.': continue
            put(x0 - 4 + i, yroot + j, role)
    return im

def variants(im, name):
    ys, flare, cx, w0, _ = measure(im)
    big = im.size[0] >= 64
    return {
        'T1': taller_orig(im, ys, flare),
        'T2': repaint(im.copy(), w0 + 2 if (w0 + 2) in TRUNK else (12 if big else 8), ORIG, light_left=False, contact=False),
        'T3': repaint(im.copy(), w0 if w0 in TRUNK else (10 if big else 6), WARM, light_left=True, contact=True),
        'T4': repaint2(im.copy(), max(8, w0 + 2 if (w0 + 2) in TRUNK else (12 if big else 8)), HEIGHT_ADD[name], name),
    }


# r2(2026-10-24 관문 화풍 0/7 「평평한 갈색 기둥, 2~3톤, 결·뿌리·가지 없음」 + 독립 검수 「테이퍼·옹이·수관 그늘·끊긴 껍질 결·밝은 테 부드럽게·높이 다양」)
BARK = [(42, 26, 15), (58, 38, 20), (69, 42, 23), (84, 55, 25), (111, 71, 37), (136, 90, 38), (172, 112, 68)]  # 0 짙음 … 6 빛, 모두 버들항 시트 색

def h32(*a):
    v = 2166136261
    for x in a: v = ((v ^ (x & 0xffffffff)) * 16777619) & 0xffffffff
    return v

def repaint2(im, width, add, name):
    """T4 r2 줄기: 위로 가늘어지고(위 2px 좁음) 밑에서 벌어진다. 칸마다 열 위치로 7단 명암(왼쪽 빛)·체크 섞기, 해시로 끊긴 껍질 결,
    옹이 하나·가지 그루터기 하나, 수관 바로 밑 4행은 수관 그늘(두 단→한 단 어둡게), 뿌리 끝 셋, 접지 그늘."""
    W, H0 = im.size
    ys, flare, cx, w0, _ = measure(im)
    pad = (-(H0 + add)) % 16
    base = Image.new('RGBA', (W, H0 + add + pad), (0, 0, 0, 0))
    base.alpha_composite(im.crop((0, 0, W, ys)), (0, pad))
    base.alpha_composite(im.crop((0, ys, W, H0)), (0, pad + ys + add))
    im = base; W, H = im.size; px = im.load()
    ys += pad; flare += pad + add
    for y in range(H):
        for x in range(W):
            k = kind(px[x, y])
            if k == 'trunk' or (k == 'tuft' and y >= H - 6) or (y >= flare and k != 'clear'): px[x, y] = (0, 0, 0, 0)
    crown_bottom = max(y for y in range(min(H, ys + 1)) if any(kind(px[x, y]) == 'crown' for x in range(int(cx - width / 2), int(cx + width / 2) + 1)))
    ytop = max(0, min(ys, crown_bottom) - 6)
    R = roots(width); yroot = H - len(R)
    rows = yroot - ytop
    seed = h32(*map(ord, name))
    def put(x, y, c, a=255):
        if not (0 <= x < W and 0 <= y < H): return
        if kind(px[x, y]) == 'crown' and px[x, y][3] == 255: return
        px[x, y] = c + (a,)
    # 접지 그늘
    for dy, inset in ((H - 2, 0), (H - 1, 2)):
        for xx in range(int(round(cx - width / 2)) - 6 + inset, int(round(cx + width / 2)) + 6 - inset):
            if px[xx, dy][3] == 0: px[xx, dy] = SHADOW + (118,)
    knot_r = int(rows * 0.5) + (seed % 5) - 2
    stub_r = int(rows * 0.28) + (seed >> 3) % 3
    for r in range(rows):
        y = ytop + r
        t = max(0.0, (r - rows * 0.45) / (rows * 0.55))
        wr = width - 2 + round(2 * t)
        x0 = int(round(cx - wr / 2))
        below = y - crown_bottom
        for u in range(wr):
            f = (u + 0.5) / wr
            if u == 0: lv = 1                                                # r3: 빛 쪽에도 짙은 재질 윤곽(풀·수관과 떨어지게)
            elif u == 1 and wr >= 7: lv = 5 if r > rows * 0.35 else 4         # 밝은 테 — 위로 갈수록 한 단 낮다
            elif u == 2 and wr >= 7 or u == 1: lv = 6 if r > rows * 0.55 else 5
            elif f < 0.42: lv = 5 if (u + r) % 2 else 4                      # 빛 쪽 몸: 체크 섞기
            elif f < 0.62: lv = 4 if (u + r) % 3 else 3
            elif u < wr - 1: lv = 3 if (u + r) % 2 else 2
            else: lv = 0
            # 끊긴 껍질 결: 짧은 세로 획(2~3행), 그늘 한 단
            hv = h32(seed, u, r // 4)
            if 1 < u < wr - 1 and hv % 5 == 0 and (r % 4) != 3: lv = max(0, lv - 2)   # 끊긴 껍질 결(3행 획)
            elif 1 < u < wr - 2 and hv % 11 == 1 and (r % 4) == 1: lv = min(6, lv + 1) # 결 옆 빛 화소
            # 옹이
            if abs(r - knot_r) <= 1 and u in (wr // 2, wr // 2 + 1):
                lv = {-1: 2, 0: 0, 1: 4}[r - knot_r] if u == wr // 2 else {-1: 3, 0: 1, 1: 5}[r - knot_r]
            # 수관 그늘(수관 밑 4행), 수관 속에 들어간 윗부분은 가장 어둡게
            if y <= crown_bottom: lv = min(lv, 1)
            elif below <= 2: lv = max(0, lv - 2)
            elif below <= 4: lv = max(0, lv - 1)
            put(x0 + u, y, BARK[lv])
        if r == stub_r and below > 3:                                         # 가지 그루터기(그늘 쪽)
            put(x0 + wr, y, BARK[2]); put(x0 + wr + 1, y - 1, BARK[1]); put(x0 + wr, y + 1, BARK[0])
    role = {'D': 0, 'S': 2, 'M': 4, 'L': 5, 'H': 6}
    x0 = int(round(cx - width / 2))
    for j, row in enumerate(R):
        for i, ch in enumerate(row):
            if ch == '.': continue
            lv = role[ch]
            if j == 0 and 0 < i - 4 < width - 1 and h32(seed, i, 99) % 4 == 0: lv = max(0, lv - 1)
            put(x0 - 4 + i, yroot + j, BARK[lv])
    return im

HEIGHT_ADD = {'bd-tree-d43edd': 8, 'bd-tree-5844f6': 8, 'bd-tree-b1d104': 12, 'bd-tree-1a786c': 16, 'bd-tree-d61d7e': 20, 'bd-tree-bdd36e': 16, 'bd-tree-1e09f0': 12}

def cover(tile):
    a = tile.getchannel('A').tobytes()
    return round(sum(1 for v in a if v > 0) * 100 / 256)

def main():
    by = {}
    for s in COMP['sprites']:
        by.setdefault(s['name'], s)
    out = {}
    for v in ['T1', 'T2', 'T3', 'T4']:
        out[v] = {'sprites': [], 'tiles': 0}
    sheets = {v: [] for v in out}
    prev = {v: [] for v in out}
    for name in TREES:
        s = by[name]
        im = sprite_img(s)
        ys, flare, cx, w0, _ = measure(im)
        print(name, s['shape'], 'trunk-only rows', ys, flare, 'cx', cx, 'w', w0)
        prev.setdefault('orig', []).append(im)
        for v, vi in variants(im, name).items():
            w, h = vi.size[0] // 16, vi.size[1] // 16
            tiles, cov = [], []
            for j in range(h):
                for i in range(w):
                    t = vi.crop((i * 16, j * 16, i * 16 + 16, j * 16 + 16))
                    c = cover(t)
                    if c == 0: tiles.append(-1); cov.append(0); continue
                    tiles.append(len(sheets[v])); cov.append(c); sheets[v].append(t)
            for dark in (False, True):
                out[v]['sprites'].append(dict(name=name, shape=s['shape'], dark=dark, w=w, h=h, tiles=tiles, cover=cov))
            prev[v].append(vi)
    for v, ts in sheets.items():
        rows = (len(ts) + 15) // 16
        sh = Image.new('RGBA', (256, rows * 16), (0, 0, 0, 0))
        for k, t in enumerate(ts): sh.alpha_composite(t, (k % 16 * 16, k // 16 * 16))
        sh.save(OUT / f'sheet-{v}.png'); out[v]['tiles'] = len(ts)
    (OUT / 'sprites.json').write_text(json.dumps(out, separators=(',', ':')))
    # 미리보기: 원본 + 시안 넷, 풀 바탕, 3배
    order = ['orig', 'T1', 'T2', 'T3', 'T4']
    colw = [max(prev[v][k].size[0] for v in order) for k in range(len(TREES))]
    H = max(im.size[1] for v in order for im in prev[v])
    bg = Image.new('RGBA', (sum(colw) + 8 * len(TREES), (H + 6) * len(order)), (86, 120, 60, 255))
    for r, v in enumerate(order):
        x = 0
        for k, im in enumerate(prev[v]):
            bg.alpha_composite(im, (x, r * (H + 6) + H - im.size[1])); x += colw[k] + 8
    bg.resize((bg.size[0] * 3, bg.size[1] * 3), Image.NEAREST).save(OUT / 'preview.png')

main()
