#!/usr/bin/env python3
"""steampunk_city 조립(모델 없음): fable-redraw/src/ 의 Fable 한 방 조각 → 칩셋 조각과 같은 id·같은 크기의 그림 fable-redraw/pieces/<묶음>/sp-<id>.png.

  python3 scripts/content/steampunk-city/fable/build.py            # pieces/ 를 다시 쓴다
  python3 scripts/content/steampunk-city/fable/build.py --check    # 쓰지 않고, 지금 pieces/ 와 화소가 같은지만 본다

- 조각 하나 = 칩셋 조각 하나(SINGLE): 바닥·소품·거리 시설. 물 프레임 2·3 은 이음매 없는 물 칸을 코드로 민 것.
- 큰 물체: 부분 조각을 이어 붙인다(기관차 40×48 둘 · 지브 기중기 48×32 둘 · 비행선 기낭 셋 + 곤돌라).
- 건물 18채(SPECS): 지붕 모듈을 가로로 이어 직사각형 지붕 덩이를 만들고, 벽 층 모듈을 16px 칸으로 잘라 층을 쌓고, 문 모듈을 옛 문 칸에 맞춰 놓고, 굴뚝·지붕창·천창·시계 등을 얹는다.
  그을린 벽돌은 벽돌 단을 한 단 내린 것, 차양 색은 색 바꿔치기. 건물을 고치려면 SPECS 한 줄을 고치면 된다(문 칸은 bake 의 entrance 와 같아야 한다 — 끝에서 검사한다).
- 검사(수치일 뿐 판정이 아니다): 지붕 끝 x 퍼짐 2px 이하(직각 지붕), 문 열림 폭 16 이상·높이 22~34(주인공 칩 속 사람 16×24), 한 층 ≥ 24.
pieces/ 의 화소가 바뀌면 art/<묶음>.py 로 _gate 를 다시 내보내고 오너 면제 묶음을 다시 써야 굽힌다.
"""
import os, sys
import numpy as np
from PIL import Image
import fb_common as C

P3 = C.P3
hx = P3.hexrgb
HERO_W, HERO_H = 16, 24      # 주인공 칩(24×32 프레임) 안의 사람 크기


def roof_taper(im, roof_rows=None):
    """지붕 줄(첫 불투명 줄부터 roof_rows 까지)의 왼쪽 끝 x 퍼짐 · 오른쪽 끝 x 퍼짐. 어느 쪽이든 2 초과면 직각 지붕이 아니다."""
    a = np.array(im.convert('RGBA'))[:, :, 3] > 0
    ys = [y for y in range(a.shape[0]) if a[y].any() and (roof_rows is None or y <= roof_rows)]
    L = [int(np.argmax(a[y])) for y in ys]
    R = [int(a.shape[1] - 1 - np.argmax(a[y][::-1])) for y in ys]
    return dict(left=max(L) - min(L), right=max(R) - min(R), ok=bool(max(L) - min(L) <= 2 and max(R) - min(R) <= 2))


def door_check(w, h, storey=None):
    ok = w >= 16 and HERO_H - 2 <= h <= HERO_H + 10 and (storey is None or storey >= HERO_H)
    return dict(w=w, h=h, storey=storey, ok=bool(ok))


def swap(im, table):
    a = np.array(im)
    for src, dst in table.items():
        m = (a[:, :, :3] == np.array(hx(src))).all(-1) & (a[:, :, 3] > 0)
        a[m, :3] = hx(dst)
    return Image.fromarray(a, 'RGBA')


def sooty(im):
    """그을린 벽돌: 벽돌 단을 한 단씩 내린다(동시에 — 연쇄로 겹치지 않게)."""
    b = P3.STRUCTURE['brick']
    a = np.array(im)
    out = a.copy()
    for i in range(1, len(b)):
        m = (a[:, :, :3] == np.array(hx(b[i]))).all(-1) & (a[:, :, 3] > 0)
        out[m, :3] = hx(b[i - 1])
    return Image.fromarray(out, 'RGBA')


def tile_x(mod, W):
    im = Image.new('RGBA', (W, mod.height))
    for x in range(0, W, mod.width):
        im.alpha_composite(mod, (x, 0))
    return im


def bay(mod, i):
    return mod.crop((i * 16, 0, i * 16 + 16, mod.height))


def plain_bay(mod, src_bay, rows, h, head=0, foot=0):
    """모듈의 민무늬 조적 조각(src_bay 칸의 rows 줄 — 8줄 = 두 켜)을 세로로 이어 높이 h 의 민무늬 칸을 만든다. head/foot = 그 모듈 같은 칸의 윗띠·밑띠 줄 수(그대로 옮김)."""
    b = bay(mod, src_bay)
    patch = b.crop((0, rows[0], 16, rows[0] + 8))
    im = Image.new('RGBA', (16, h))
    for y in range(rows[0] % 8 - 8, h, 8):
        im.alpha_composite(patch, (0, y)) if y >= 0 else im.paste(patch.crop((0, -y, 16, 8)), (0, 0))
    if head:
        im.paste(b.crop((0, 0, 16, head)), (0, 0))
    if foot:
        im.paste(b.crop((0, h - foot, 16, h)), (0, h - foot))
    return im


class Kit:
    def __init__(self):
        g = lambda k: C.src('k-' + k)
        self.roof = {'slate40': g('roof-slate-40'), 'slate56': g('roof-slate-56'), 'iron56': g('roof-iron-56')}
        self.up = {'brick': g('brick-up'), 'stone': g('stone-up')}
        self.gr = {'brick': g('brick-ground'), 'stone': g('stone-ground')}
        self.door = {'d1': g('brick-door1'), 'd2': g('brick-door2'), 'shop': g('brick-shop'), 'freight': g('brick-freight'), 'sd2': g('stone-door2')}
        self.feat = {k: g(k) for k in ('chimney', 'dormer', 'skylight', 'stack', 'clock', 'balcony', 'hoist', 'pipes')}
        self.DOORBOX = {'d1': (8, 12, 16, 28), 'd2': (8, 10, 32, 30), 'shop': (16, 13, 16, 27), 'freight': (8, 8, 32, 32), 'sd2': (8, 10, 32, 30)}

    def missing(self, names):
        out = []
        for n in names:
            grp, k = n.split(':')
            if getattr(self, grp).get(k) is None:
                out.append(n)
        return out


def building(kit, spec):
    """spec: id, W, H, mat('brick'|'stone'), soot, roof, ups=[[칸…]…], ground=[칸…], door=(종류, 문 첫 칸), feats=[(이름, x, y)], awning."""
    W, Hh = spec['W'], spec['H']
    need = ['roof:' + spec['roof'], 'door:' + spec['door'][0]] + ['feat:' + f[0] for f in spec.get('feats', [])]
    mats = {spec['mat']} | {m for row in spec['ups'] for m, _ in row if m} | {m for m, _ in spec['ground'] if m}
    need += ['up:' + m for m in mats if any(mm == m for row in spec['ups'] for mm, _ in row)] + ['gr:' + m for m in mats if any(mm == m for mm, _ in spec['ground'])]
    miss = kit.missing(need)
    if miss:
        return None, dict(missing=miss)
    soot = sooty if spec.get('soot') else (lambda im: im)
    im = Image.new('RGBA', (W, Hh))
    roof = tile_x(kit.roof[spec['roof']], W)
    a = np.array(roof)
    sl = P3.STRUCTURE['slate']
    a[:, 0, :3], a[:, 1, :3], a[:, W - 2, :3], a[:, W - 1, :3] = hx(sl[3]), hx(sl[0]), hx(sl[1]), hx(sl[0])     # 양 끝 박공널(곧은 세로 끝)
    im.alpha_composite(Image.fromarray(a, 'RGBA'), (0, 0))
    y = roof.height

    def plain(m, h):
        if h == 32:
            return plain_bay(kit.up[m], 2, (2, 10), 32, head=2) if m == 'brick' else plain_bay(kit.gr[m], 1, (2, 10), 32)
        return plain_bay(kit.up['brick'], 2, (2, 10), 40, head=0, foot=0) if m == 'brick' else plain_bay(kit.gr[m], 1, (2, 10), 40, head=2, foot=4)

    for row in spec['ups']:
        for i, (m, b) in enumerate(row):
            cell = plain(m, 32) if b is None else bay(kit.up[m], b)
            im.alpha_composite(soot(cell), (i * 16, y))
        y += 32
    gmod = kit.gr[spec['mat']]
    for i, (m, b) in enumerate(spec['ground']):
        if b is None:
            cell = plain(m, 40)
            if m == 'brick':      # 벽돌 민무늬 1층 칸: 윗띠·밑띠는 1층 모듈의 민무늬 칸(2번)에서
                g2 = bay(kit.gr['brick'], 1)
                cell.paste(g2.crop((0, 0, 16, 2)), (0, 0))
                cell.paste(g2.crop((0, 36, 16, 40)), (0, 36))
        else:
            cell = bay(kit.gr[m], b)
        im.alpha_composite(soot(cell), (i * 16, y))
    kind, cell0 = spec['door']
    dm = kit.door[kind]
    bx, by, bw, bh = kit.DOORBOX[kind]
    if spec.get('awning'):
        dm = swap(dm, spec['awning'])
    dx = cell0 * 16 - bx
    im.alpha_composite(soot(dm) if kind != 'sd2' else dm, (dx, y))
    door = [dx + bx, y + by, bw, bh]
    for name, fx, fy in spec.get('feats', []):
        im.alpha_composite(kit.feat[name], (fx, fy))
    # 벽 양 끝 세로선(문 자리는 건드리지 않는다)
    a = np.array(im)
    edge = hx(P3.STRUCTURE['brick'][0] if spec['mat'] == 'brick' else P3.GROUND['gstone'][1])
    for x in (0, W - 1):
        for yy in range(roof.height, Hh):
            if not (door[0] <= x < door[0] + door[2] and yy >= door[1]):
                a[yy, x, :3] = edge
    im = Image.fromarray(a, 'RGBA')
    info = dict(roofRows=roof.height, taper=roof_taper(im, roof.height - 1), door=door, doorCheck=door_check(bw, bh, storey=32), entranceCells=list(range(door[0] // 16, (door[0] + door[2] - 1) // 16 + 1)))
    return im, info


B, S = 'brick', 'stone'
U = lambda m, *bs: [(m, b) for b in bs]
RED2GREEN = {P3.ACCENT['red'][0]: P3.ACCENT['green'][0], P3.ACCENT['red'][1]: P3.ACCENT['green'][1]}
RED2SLATE = {P3.ACCENT['red'][0]: P3.STRUCTURE['slate'][1], P3.ACCENT['red'][1]: P3.STRUCTURE['slate'][3]}
N = None
SPECS = [
 dict(id='row-soot-3', W=48, H=112, mat=B, soot=1, roof='slate40', ups=[U(B, 1, 0, 2)], ground=U(B, N, N, 2), door=('d1', 0), feats=[('chimney', 28, 2), ('dormer', 6, 14)]),
 dict(id='row-3', W=48, H=144, mat=B, roof='slate40', ups=[U(B, 0, 2, 1), U(B, 1, 0, 2)], ground=U(B, N, N, N), door=('d1', 1), feats=[('chimney', 4, 2), ('dormer', 26, 14), ('balcony', 0, 62)]),
 dict(id='row-4', W=64, H=144, mat=B, roof='slate40', ups=[U(B, 0, 1, 2, 0), U(B, 1, 2, 0, 1)], ground=U(B, 0, N, N, N), door=('d1', 2), feats=[('chimney', 6, 2), ('chimney', 44, 2), ('dormer', 26, 14)]),
 dict(id='shop-gears', W=64, H=144, mat=B, roof='slate40', ups=[U(B, 0, 1, 0, 2), U(B, 2, 0, 1, 0)], ground=U(B, 0, N, N, N), door=('shop', 2), feats=[('chimney', 46, 2), ('dormer', 8, 14), ('dormer', 28, 14)]),
 dict(id='shop-apoth', W=48, H=112, mat=B, roof='slate40', ups=[U(B, 0, 2, 1)], ground=U(B, N, N, N), door=('shop', 1), awning=RED2GREEN, feats=[('chimney', 30, 2), ('dormer', 8, 14)]),
 dict(id='shop-bakery', W=48, H=112, mat=B, soot=1, roof='slate40', ups=[U(B, 1, 2, 0)], ground=U(B, N, N, N), door=('shop', 1), awning=RED2SLATE, feats=[('chimney', 4, 2), ('chimney', 30, 2)]),
 dict(id='inn', W=96, H=160, mat=B, roof='slate56', ups=[U(B, 0, 1, 0, 0, 1, 0), U(B, 1, 0, 2, 2, 0, 1)], ground=U(B, 0, N, N, N, N, 2), door=('d2', 2), feats=[('chimney', 6, 4), ('chimney', 74, 4), ('dormer', 28, 24), ('dormer', 52, 24), ('balcony', 32, 110)]),
 dict(id='tavern', W=80, H=128, mat=B, soot=1, roof='slate56', ups=[U(B, 0, 1, 0, 0, 1)], ground=U(B, 2, N, N, N, N), door=('d2', 2), feats=[('chimney', 60, 4), ('dormer', 12, 24), ('dormer', 36, 24)]),
 dict(id='warehouse', W=128, H=128, mat=B, roof='iron56', ups=[U(B, 1, 2, 1, N, N, 1, 2, 1)], ground=U(B, 0, N, N, N, N, N, N, 0), door=('freight', 3), feats=[('hoist', 56, 54), ('skylight', 16, 22), ('skylight', 80, 22)]),
 dict(id='station', W=128, H=128, mat=S, roof='slate56', ups=[U(S, 0, 1, 0, N, N, 0, 1, 0)], ground=U(S, 0, 1, N, N, N, N, 1, 2), door=('sd2', 3), feats=[('clock', 48, 56), ('chimney', 10, 4), ('chimney', 102, 4)]),
 dict(id='clock-tower', W=64, H=176, mat=S, roof='slate40', ups=[U(S, N, N, N, N), U(B, 2, 1, 1, 2), U(B, 2, 0, 0, 2)], ground=U(S, N, N, N, N), door=('sd2', 1), feats=[('clock', 16, 40)]),
 dict(id='guild-hall', W=128, H=160, mat=S, roof='slate56', ups=[U(S, 0, 2, 1, 0, 0, 1, 2, 0), U(S, 1, 2, 0, 1, 1, 0, 2, 1)], ground=U(S, 0, 1, N, N, N, N, 1, 2), door=('sd2', 3), feats=[('chimney', 8, 4), ('chimney', 104, 4), ('dormer', 40, 24), ('dormer', 72, 24), ('balcony', 48, 110)]),
 dict(id='dock-warehouse', W=112, H=160, mat=B, soot=1, roof='iron56', ups=[U(B, 1, 2, 1, N, N, 1, 2), U(B, 2, 1, 2, N, N, 2, 1)], ground=U(B, 0, N, N, N, N, N, 0), door=('freight', 3), feats=[('hoist', 56, 58), ('skylight', 40, 22)]),
 dict(id='workshop', W=96, H=112, mat=B, roof='slate40', ups=[U(B, N, 0, N, N, 1, N)], ground=U(B, 0, N, N, N, N, 2), door=('freight', 2), feats=[('skylight', 6, 16), ('skylight', 44, 16), ('stack', 78, 2), ('pipes', 0, 40), ('pipes', 48, 40)], extra=True),
 dict(id='boiler-house', W=96, H=128, mat=B, soot=1, roof='slate56', ups=[U(B, N, 1, N, N, 1, N)], ground=U(B, 0, N, N, N, N, 0), door=('d2', 2), feats=[('stack', 8, 6), ('stack', 30, 6), ('stack', 72, 6), ('pipes', 0, 58), ('pipes', 48, 58)], extra=True),
 dict(id='factory', W=160, H=128, mat=B, soot=1, roof='iron56', ups=[U(B, 1, 1, 2, 1, N, N, 1, 2, 1, 1)], ground=U(B, 0, 0, N, N, N, N, N, N, 0, 0), door=('freight', 4), feats=[('stack', 10, 6), ('stack', 134, 6), ('skylight', 40, 22), ('skylight', 88, 22), ('hoist', 72, 54)], extra=True),
 dict(id='row-soot-4', W=64, H=144, mat=B, soot=1, roof='slate40', ups=[U(B, 1, 0, 2, 1), U(B, 0, 2, 1, 0)], ground=U(B, N, N, N, 2), door=('d1', 1), feats=[('chimney', 40, 2), ('balcony', 16, 62)], extra=True),
 dict(id='row-flush-3', W=48, H=144, mat=B, roof='slate40', ups=[U(B, 0, 1, 2), U(B, 2, 0, 1)], ground=U(B, 0, N, N), door=('d1', 2), feats=[('dormer', 6, 14), ('dormer', 28, 14)], extra=True),
]
SINGLE = {   # 조각 하나 = 옛 조각 하나: 새 id → (묶음, 옛 id)
 **{f'g-{k}': ('terrain', k) for k in ('cobble', 'cobble-b', 'cobble-c', 'cobble-oil', 'flag', 'flag-b', 'flag-c', 'platform', 'cinder', 'cinder-b', 'cinder-c', 'grass', 'soil', 'tram-n', 'tram-s', 'rail-n', 'rail-s', 'water', 'bridge-m')},
 'g-floor-stone': ('interior', 'floor-stone'), 'g-stairs-down': ('interior', 'stairs-down'),
 **{f'q-{k}': ('props', k) for k in ('plaza-lamp', 'fence', 'fence-v', 'stall-fruit', 'stall-parts', 'stall-fish')},
 **{f'q-{k}': ('street', k) for k in ('clock-post', 'poster-column', 'rail-signal', 'buffer-stop', 'kiosk')}, 'q-handcart': ('vehicles', 'handcart'),
}




def joined(parts, size):
    ims = [(C.src(p), x, y) for p, x, y in parts]
    if any(i is None for i, _, _ in ims):
        return None
    out = Image.new('RGBA', size)
    for i, x, y in ims:
        out.alpha_composite(i, (x, y))
    return out


def build():
    """→ ({(묶음, id): 그림}, [빠진 것], {건물 id: 검사 수치})"""
    out, left, info = {}, [], {}
    kit = Kit()
    for nid, (g, oid) in SINGLE.items():
        im = C.src(nid)
        if im is None: left.append((g, oid, f'{nid} 그림 없음'))
        else: out[(g, oid)] = im
    w = C.src('g-water')
    if w is not None:       # 물 애니메이션 프레임: 이음매 없는 칸을 가로·세로로 돌려 민다
        for f, (dx, dy) in ((1, (5, 1)), (2, (10, 2))):
            out[('terrain', f'water-f{f}')] = Image.fromarray(np.roll(np.roll(np.array(w), dx, axis=1), dy, axis=0), 'RGBA')
    lamp = C.src('p-gas-lamp')        # 1단계 시범에서 그린 가스등(색만 옮김)
    if lamp is not None: out[('props', 'gas-lamp')] = lamp
    for oid, g, size, parts in (('locomotive', 'vehicles', (80, 48), [('x-loco-w', 0, 0), ('x-loco-e', 40, 0)]), ('jib-crane', 'street', (48, 64), [('x-crane-top', 0, 0), ('x-crane-base', 0, 32)]),
                                ('airship-docked', 'street', (128, 80), [('x-air-w', 0, 0), ('x-air-m', 43, 0), ('x-air-e', 85, 0), ('x-air-gondola', 32, 48)])):
        im = joined(parts, size)
        if im is None: left.append((g, oid, '부분 조각이 다 나오지 않음'))
        else: out[(g, oid)] = im
    for spec in SPECS:
        im, inf = building(kit, spec)
        if im is None: left.append(('buildings', spec['id'], '키트 조각 없음: ' + ', '.join(inf['missing'])))
        else: out[('buildings', spec['id'])] = im; info[spec['id']] = inf
    return out, left, info


def main():
    out, left, info = build()
    check = '--check' in sys.argv
    diff = []
    for (g, oid), im in out.items():
        a = np.array(im)
        assert im.width % 16 == 0 and im.height % 16 == 0 and not ((a[:, :, 3] > 0) & (a[:, :, 3] < 255)).any(), (g, oid)
        assert not P3.check_palette(im), ('팔레트 v3 밖의 색', g, oid)
        p = os.path.join(C.PIECES, g, f'sp-{oid}.png')
        if check:
            if not os.path.exists(p) or not np.array_equal(a, np.array(Image.open(p).convert('RGBA'))): diff.append(f'{g}/sp-{oid}')
        else:
            os.makedirs(os.path.dirname(p), exist_ok=True); im.save(p)
    # 문 칸이 굽기의 entrance 와 같은가(건물 등록부의 entrance = 옛 조각의 문 칸)
    sys.path.insert(0, os.path.join(C.HERE, '..', 'art'))
    import buildings as AB
    bad = [(k, v['entranceCells'], AB.R.by[k].get('entrance')) for k, v in info.items() if v['entranceCells'] != list(AB.R.by[k].get('entrance') or []) or (v['roofRows'] and (AB.R.by[k]['w'] * 16, AB.R.by[k]['h'] * 16) != out[('buildings', k)].size)]
    fail = [(k, v['taper'], v['doorCheck']) for k, v in info.items() if not (v['taper']['ok'] and v['doorCheck']['ok'])]
    print(f'pictures {len(out)} · buildings {len(info)} · 지붕 퍼짐·문 크기 어긋남 {fail} · 문 칸/크기가 등록부와 다름 {bad} · 빠진 것 {left}' + (f' · pieces/ 와 다른 그림 {diff}' if check else ' → ' + C.PIECES))
    return 1 if (bad or fail or left or diff) else 0


if __name__ == '__main__':
    sys.exit(main())
