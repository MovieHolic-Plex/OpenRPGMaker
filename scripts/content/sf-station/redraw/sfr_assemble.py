"""단위 그림(png/<unit>.png) → 조각 그림(out/<piece id>.png, 옛 조각과 같은 크기). 모델 호출 없음.
바닥 변형은 그대로 자르고, 오토타일·차선·횡단보도·안내선은 코드로 만든다(옛 시트의 칸 배치·마스크 그대로: 칸 (m%4, m//4) = 이웃 마스크 m, N=1 E=2 S=4 W=8).
건물은 지붕(+가운데 층 반복)+벽을 쌓는다. 단위 그림이 없으면 옛 그림을 그대로 둔다(source=old)."""
import json, os, sys
import numpy as np
from PIL import Image
import sfr_lib as L
import sfr_palette as PAL

H = L.HERE
INV = {o['id']: o for o in json.load(open(f'{H}/inventory.json'))}
N, E, S, W = 1, 2, 4, 8


def col(name):
    r, t = name.split(':'); return PAL.rgb(PAL.ALL[r][int(t)]) + (255,)


def unit(uid):
    f = f'{H}/png/{uid}.png'
    return Image.open(f).convert('RGBA') if os.path.exists(f) else None


def old(pid): return Image.open(f'{H}/old/{pid}.png').convert('RGBA')


def tiles(im, y=0): return [im.crop((x, y, x + 16, y + 16)) for x in range(0, im.width, 16)]


def strip(ts):
    out = Image.new('RGBA', (16 * len(ts), ts[0].height))
    for i, t in enumerate(ts): out.paste(t, (i * 16, 0))
    return out


def P(a, x, y, c):
    if 0 <= x < 16 and 0 <= y < 16: a[y, x] = col(c)


def autosheet(fn):
    out = Image.new('RGBA', (64, 64))
    for m in range(16):
        ox, oy = (m % 4) * 16, (m // 4) * 16
        out.paste(fn(m, ox, oy), (ox, oy))
    return out


def hsh(x, y, s=0): return L.C.hsh(x, y, s)


# ───────── 오토타일
def at_deck(deck):
    def fn(m, ox, oy):
        a = np.array(deck[(ox // 16 * 3 + oy // 16) % 2])       # 무늬 없는 판 둘만 쓴다(점검 판·바닥 등은 가장자리에 넣지 않는다)
        if not m & N:
            for x in range(16): P(a, x, 0, 's_hull:5'); P(a, x, 1, 's_hull:3'); P(a, x, 2, 'ink:1')
        if not m & W:
            for y in range(16): P(a, 0, y, 's_hull:4'); P(a, 1, y, 's_hull:2')
        if not m & E:
            for y in range(16): P(a, 15, y, 'ink:1'); P(a, 14, y, 's_hull:0')
        if not m & S:
            for y in range(10, 16):
                for x in range(16): P(a, x, y, 's_hull:1' if y < 13 else 's_hull:0')
            for x in range(16):
                P(a, x, 10, 's_hull:5'); P(a, x, 11, 's_hull:2'); P(a, x, 13, 'a_cyan:0' if x % 4 else 'a_cyan:1'); P(a, x, 15, 'ink:0')
            for x in (4, 12): P(a, x, 12, 's_hull:4'); P(a, x, 14, 'ink:1')
            if not m & W:
                for y in range(10, 15): P(a, 0, y, 's_hull:3')
            if not m & E:
                for y in range(10, 15): P(a, 15, y, 'ink:1')
        return Image.fromarray(a, 'RGBA')
    return autosheet(fn)


def at_wall(ceil, mat):
    hi, mid, lo, dark, acc = {'hull': ('s_hull:3', 's_hull:2', 's_hull:0', 'ink:1', 'a_orange:0'), 'white': ('s_white:3', 's_white:2', 's_white:0', 's_hull:0', 'a_cyan:1')}[mat]

    def fn(m, ox, oy):
        a = np.array(ceil[0])
        caph = 16 if m & S else 13
        if not m & N:
            for x in range(16): P(a, x, 0, dark); P(a, x, 1, hi); P(a, x, 2, mid)
        if not m & W:
            for y in range(caph): P(a, 0, y, hi); P(a, 1, y, mid)
        if not m & E:
            for y in range(caph): P(a, 15, y, dark); P(a, 14, y, lo)
        if not m & S:
            for x in range(16): P(a, x, 12, acc); P(a, x, 13, hi); P(a, x, 14, mid if mat == 'white' else 's_hull:1'); P(a, x, 15, dark)
        return Image.fromarray(a, 'RGBA')
    return autosheet(fn)


def at_road(asp):
    def fn(m, ox, oy):
        a = np.array(asp[(ox // 16 * 3 + oy // 16) % 2])
        if not m & N:
            for x in range(16): P(a, x, 0, 'g_road:3'); P(a, x, 1, 'g_road:2'); P(a, x, 2, 'g_road:1'); P(a, x, 3, 'ink:1')
        if not m & W:
            for y in range(16): P(a, 0, y, 'g_road:3'); P(a, 1, y, 'g_road:2'); P(a, 2, y, 'ink:1')
        if not m & E:
            for y in range(16): P(a, 15, y, 'g_road:1'); P(a, 14, y, 'g_road:2'); P(a, 13, y, 'ink:1')
        if not m & S:
            for x in range(16): P(a, x, 11, 'ink:1'); P(a, x, 12, 'g_road:3'); P(a, x, 13, 'g_road:2'); P(a, x, 14, 'g_road:1'); P(a, x, 15, 'g_road:0')
            for x in range(3, 16, 8): P(a, x, 14, 'g_road:0')
        return Image.fromarray(a, 'RGBA')
    return autosheet(fn)


def at_regolith_path(reg, path):
    def fn(m, ox, oy):
        a = np.array(reg[(ox // 16 + oy // 16 * 3) % 2]); p = np.array(path[(ox // 16 + oy // 16) % len(path)])
        for y in range(16):
            for x in range(16):
                d = 99
                if not m & N: d = min(d, y)
                if not m & S: d = min(d, 15 - y)
                if not m & W: d = min(d, x)
                if not m & E: d = min(d, 15 - x)
                j = 2 + hsh(ox + x, oy + y, 7) % 2
                if d > j: a[y, x] = p[y, x]
                elif d == j: P(a, x, y, 'g_dust:3' if hsh(ox + x, oy + y, 3) % 3 else 'g_dust:2')
        return Image.fromarray(a, 'RGBA')
    return autosheet(fn)


def at_rail(parts):
    bed, hor, hub = (np.array(t) for t in parts)
    ver = np.transpose(hor, (1, 0, 2))

    def fn(m, ox, oy):
        a = bed.copy()
        vert = [d for d in (N, S) if m & d]; hz = [d for d in (W, E) if m & d]
        if m & N: a[0:8, 3:13] = ver[0:8, 3:13]
        if m & S: a[8:16, 3:13] = ver[8:16, 3:13]
        if m & W: a[3:13, 0:8] = hor[3:13, 0:8]
        if m & E: a[3:13, 8:16] = hor[3:13, 8:16]
        if m == 0 or (vert and hz) or len(vert) + len(hz) == 1: a[4:12, 4:12] = hub[4:12, 4:12]
        return Image.fromarray(a, 'RGBA')
    return autosheet(fn)


def at_lightline():
    def fn(m, ox, oy):
        a = np.zeros((16, 16, 4), np.uint8)
        hubc = m == 0 or bin(m).count('1') != 2 or m in (N | E, E | S, S | W, W | N)
        if hubc:
            for y in (6, 7, 8, 9):
                for x in (6, 7, 8, 9): P(a, x, y, 'a_cyan:0' if x in (6, 9) or y in (6, 9) else 'a_cyan:1')
        for d in (N, E, S, W):
            if not m & d: continue
            rng = range(0, 7) if d in (N, W) else range(9, 16)
            for k in rng:
                if d in (N, S): P(a, 7, k, 'a_cyan:1'); P(a, 8, k, 'a_cyan:0')
                else: P(a, k, 7, 'a_cyan:1'); P(a, k, 8, 'a_cyan:0')
            kk = 3 if d in (N, W) else 12
            if d in (N, S): P(a, 7, kk, 'a_glow:0')
            else: P(a, kk, 7, 'a_glow:0')
        if m == N | S:
            for k in range(16): P(a, 7, k, 'a_cyan:1'); P(a, 8, k, 'a_cyan:0')
        if m == W | E:
            for k in range(16): P(a, k, 7, 'a_cyan:1'); P(a, k, 8, 'a_cyan:0')
        return Image.fromarray(a, 'RGBA')
    return autosheet(fn)


def marks_from_old(pid, asp):
    """차선·횡단보도: 옛 칸의 밝은 표시 화소 자리(마스크)에만 새 표시색을 올린다. 바탕은 새 아스팔트."""
    o = np.array(old(pid)); out = []
    for v in range(o.shape[1] // 16):
        a = np.array(asp[v % 2]); cell = o[:, v * 16:(v + 1) * 16]
        lum = cell[..., :3].astype(float) @ L.LUM
        for y in range(16):
            for x in range(16):
                if lum[y, x] > 110: a[y, x] = col('g_tile:2' if lum[y, x] > 170 else 'g_tile:0')
                elif lum[y, x] > 85: a[y, x] = col('g_road:3')
        out.append(Image.fromarray(a, 'RGBA'))
    return strip(out)


def stack(parts, w, h):
    out = Image.new('RGBA', (w, h)); y = 0
    for p in parts:
        out.alpha_composite(p, (0, y)); y += p.height
    assert y == h, (y, h)
    return out


def main():
    res = {}

    def put(pid, im, source, units):
        o = old(pid)
        if im is None or im.size != o.size:
            res[pid] = dict(source='old', why='no picture' if im is None else f'size {im.size} != {o.size}', units=units); o.save(f'{H}/out/{pid}.png'); return
        res[pid] = dict(source=source, units=units); im.save(f'{H}/out/{pid}.png')

    done = set()
    # 바닥 낱칸
    for pid, uid in [(p, 'g-' + p) for p in ('deck-plate', 'deck-grate', 'deck-hazard', 'deck-lane-h', 'deck-lane-v', 'lab-floor', 'crew-floor', 'cargo-floor', 'glass-floor', 'void-star', 'regolith', 'landing-plate', 'asphalt', 'sidewalk', 'puddle', 'hydro-soil')]:
        put(pid, unit(uid), 'fable', [uid]); done.add(pid)
    asp = unit('g-asphalt'); deck = unit('g-deck-plate'); reg = unit('g-regolith'); path = unit('g-regolith-path'); rail = unit('g-rail'); wh = unit('w-hull'); ww = unit('w-white'); wv = unit('wf-viewport')
    for pid in ('lane-dash', 'crosswalk'):
        put(pid, marks_from_old(pid, tiles(asp)) if asp else None, 'code', ['g-asphalt']); done.add(pid)
    put('at-deck', at_deck(tiles(deck)) if deck else None, 'code', ['g-deck-plate'])
    put('at-road', at_road(tiles(asp)) if asp else None, 'code', ['g-asphalt'])
    put('at-regolith-path', at_regolith_path(tiles(reg), tiles(path)) if reg and path else None, 'code', ['g-regolith', 'g-regolith-path'])
    put('at-rail', at_rail(tiles(rail)) if rail else None, 'code', ['g-rail'])
    put('at-lightline', at_lightline(), 'code', [])
    put('at-wall-hull', at_wall(tiles(wh), 'hull') if wh else None, 'code', ['w-hull'])
    put('at-wall-viewport', at_wall(tiles(wh), 'hull') if wh else None, 'code', ['w-hull'])
    put('at-wall-white', at_wall(tiles(ww), 'white') if ww else None, 'code', ['w-white'])
    for pid, w_ in (('wall-face-hull', wh), ('wall-face-white', ww)):
        if w_ is None: put(pid, None, 'fable', []); continue
        A, B = w_.crop((0, 16, 16, 48)), w_.crop((16, 16, 32, 48)); im = Image.new('RGBA', (64, 32))
        for i, t in enumerate((A, B, A, B)): im.paste(t, (i * 16, 0))
        put(pid, im, 'fable', ['w-hull' if pid.endswith('hull') else 'w-white'])
    if wv is not None and wh is not None:
        A, B = wv.crop((0, 0, 16, 32)), wv.crop((16, 0, 32, 32)); hA, hB = wh.crop((0, 16, 16, 48)), wh.crop((16, 16, 32, 48)); im = Image.new('RGBA', (64, 32))
        for i, t in enumerate((A, hB, hA, B)): im.paste(t, (i * 16, 0))      # 구성기는 전망창에 열 0·3 을 번갈아 쓴다. 열 1 은 옛 시트에서 hull 열 1 과 같은 칸(번호 공유)이었다
        put('wall-face-viewport', im, 'fable', ['wf-viewport', 'w-hull'])
    else: put('wall-face-viewport', None, 'fable', [])
    done |= {'at-deck', 'at-road', 'at-regolith-path', 'at-rail', 'at-lightline', 'at-wall-hull', 'at-wall-viewport', 'at-wall-white', 'wall-face-hull', 'wall-face-white', 'wall-face-viewport'}
    # 나눠 그린 건물
    for pid in ('hab-module-3', 'hab-dome-l', 'hab-block', 'cargo-hangar', 'street-data-center'):
        r, w_ = unit(pid + '.roof'), unit(pid + '.wall'); o = old(pid)
        put(pid, stack([r, w_], *o.size) if r is not None and w_ is not None and r.height + w_.height == o.height else None, 'fable', [pid + '.roof', pid + '.wall']); done.add(pid)
    for pid in ('street-tower-s', 'street-tower-m', 'street-tower-l', 'street-apartment'):
        r, m_, w_ = unit(pid + '.roof'), unit(pid + '.mid'), unit(pid + '.wall'); o = old(pid)
        if r is None or m_ is None or w_ is None: put(pid, None, 'fable', [pid + '.roof', pid + '.mid', pid + '.wall']); done.add(pid); continue
        need = o.height - r.height - w_.height; mids = []; y = 0
        while y < need:
            hh = min(m_.height, need - y); mids.append(m_.crop((0, 0, m_.width, hh))); y += hh
        put(pid, stack([r] + mids + [w_], *o.size), 'fable', [pid + '.roof', pid + '.mid', pid + '.wall']); done.add(pid)
    # 나머지: 단위 id = 조각 id
    for pid in INV:
        if pid in done: continue
        put(pid, unit(pid), 'fable', [pid])
    # 옛 시트에서 한 번호를 나눠 쓰던 칸(같은 그림 칸)은 새 그림에서도 같은 그림이어야 한다 — 저장된 맵은 그 번호 하나만 가리킨다(셔터 3칸·타워 창 등 9묶음).
    d = json.load(open(f'{H}/before/sfStationTileset.json')); use = {}
    for k in d['structureKits']:
        for y, row in enumerate(k['rows']):
            for x in range(k['width']):
                for t in (row['tiles'][x], (row.get('upperTiles') or [-1] * k['width'])[x]):
                    if t >= 0: use.setdefault(t, []).append((k['id'][3:], x, y))
    shared = []
    for t, cells in sorted(use.items()):
        if len(cells) < 2: continue
        srcc = cells[1] if len(cells) == 3 and cells[0][0] == cells[2][0] else cells[0]      # 셔터 3칸은 가운데 칸(문틀 없는 살)을 본으로
        src = Image.open(f'{H}/out/{srcc[0]}.png').convert('RGBA').crop((srcc[1] * 16, srcc[2] * 16, srcc[1] * 16 + 16, srcc[2] * 16 + 16))
        for (pid, x, y) in cells:
            if (pid, x, y) == srcc or res[pid]['source'] == 'old': continue
            im = Image.open(f'{H}/out/{pid}.png').convert('RGBA'); im.paste(src, (x * 16, y * 16)); im.save(f'{H}/out/{pid}.png')
        shared.append((t, cells))
    print('shared-cell groups kept identical:', len(shared))
    # 바닥 덧그림(flat): 옛 그림에서 꽉 찬 칸(아래층 바닥 칸)은 새 그림에서도 꽉 차야 층이 안 바뀐다 — 투명 화소를 그 칸의 가장 많은 색으로 채운다(착륙장 모서리 4칸).
    filled = []
    for pid, r in res.items():
        if INV[pid]['kind'] != 'flat' or r['source'] == 'old': continue
        o = np.array(old(pid)); im = Image.open(f'{H}/out/{pid}.png').convert('RGBA'); n = np.array(im); ch = False
        for cy in range(o.shape[0] // 16):
            for cx in range(o.shape[1] // 16):
                oc = o[cy * 16:cy * 16 + 16, cx * 16:cx * 16 + 16, 3]; nc = n[cy * 16:cy * 16 + 16, cx * 16:cx * 16 + 16]
                if oc.min() == 255 and nc[..., 3].min() < 255 and nc[..., 3].max() == 255:
                    px = nc[nc[..., 3] == 255][:, :3]; vals, cnt = np.unique(px, axis=0, return_counts=True); c = vals[cnt.argmax()]
                    m = nc[..., 3] < 255; nc[m, :3] = c; nc[m, 3] = 255; ch = True; filled.append((pid, cx, cy))
        # 반대로 옛 그림에서 투명 화소가 있던 칸(위층 덧그림 칸)이 새 그림에서 꽉 찼으면, 옛 그림에서 통째로 비어 있던 가장자리 줄·열을 새 그림에서도 비운다(리프트 발판 둘레 1px).
        need = [(cx, cy) for cy in range(o.shape[0] // 16) for cx in range(o.shape[1] // 16)
                if o[cy * 16:cy * 16 + 16, cx * 16:cx * 16 + 16, 3].min() < 255 and o[cy * 16:cy * 16 + 16, cx * 16:cx * 16 + 16, 3].max() == 255 and n[cy * 16:cy * 16 + 16, cx * 16:cx * 16 + 16, 3].min() == 255]
        if need:
            for y in range(o.shape[0]):
                if o[y, :, 3].max() == 0: n[y, :, :] = 0
            for x in range(o.shape[1]):
                if o[:, x, 3].max() == 0: n[:, x, :] = 0
            ch = True; filled.append((pid, 'edge rows cleared', need))
        if ch: Image.fromarray(n, 'RGBA').save(f'{H}/out/{pid}.png')
    print('flat cells kept in their layer class:', filled)
    # 칸 점유 비교(옛 그림과): 옛 칸에 그림이 있었는데 새 그림은 빈 칸 / 그 반대
    for pid, r in res.items():
        o = np.array(old(pid))[..., 3] > 0; n = np.array(Image.open(f'{H}/out/{pid}.png').convert('RGBA'))[..., 3] > 0
        lost, gained = [], []
        for cy in range(o.shape[0] // 16):
            for cx in range(o.shape[1] // 16):
                a, b = o[cy * 16:cy * 16 + 16, cx * 16:cx * 16 + 16].any(), n[cy * 16:cy * 16 + 16, cx * 16:cx * 16 + 16].any()
                if a and not b: lost.append((cx, cy))
                if b and not a: gained.append((cx, cy))
        r['lostCells'] = lost; r['gainedCells'] = gained
        r['lostSolid'] = [c for c in lost if list(c) in [list(s) for s in INV[pid]['solid']]]
    json.dump(res, open(f'{H}/assembled.json', 'w'), ensure_ascii=False, indent=1)
    import collections
    print(collections.Counter(r['source'] for r in res.values()))
    print('old:', [(k, r['why']) for k, r in res.items() if r['source'] == 'old'])
    print('lost cells:', {k: r['lostCells'] for k, r in res.items() if r['lostCells']})
    print('lost SOLID:', {k: r['lostSolid'] for k, r in res.items() if r['lostSolid']})
    print('gained cells:', {k: r['gainedCells'] for k, r in res.items() if r['gainedCells']})


if __name__ == '__main__':
    main()
