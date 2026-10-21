#!/usr/bin/env python3
"""jp_city 블록 `jp_forest_pack` — 이어지는 빽빽한 숲(활엽 혼효림·대숲) 키트. 2026-10-20.

진단(시제품 r1): 지금 숲은 한 그루 키트(rg-sugi·rg-pine·대숲)를 regionComposer 가 흩뿌려 스티커 무리가 되고, 폭 3~4칸 띠는 비었다.
이 블록은 숲 구획을 통째로 덮는 조각을 굽는다. 그림 코드는 `scripts/content/jp-city/forest/forest_kit_proto.py`(코드 손 도트,
일본 로케일 팔레트 계약의 확장·하위 램프 pine_bamboo+ · pine_bamboo/sunleaf · pine_bamboo/culm · aged_cedar/bark).
칠하는 순서(편집기 `src/editor/jpCity/forestPainter.ts`): 마스크 → 수관 오토타일(3층) → 하늘선 키트 → 수관 머리(3층 불투명 + 4층 덧그림) → 줄기 띠.

종류(kind 접두 jp-forest-<bl|bb>-):
  오토타일 jp-forest-bl / jp-forest-bb   8방 47칸 + 몸통 변형(활엽 12·대숲 4). 위층(3층) 막힘.
  그룹 jp:forest-<k>-edge-<n|s|w|e>        곧은 가장자리 변형(칠하는 쪽이 위치 해시로 고른다). 활엽만.
  키트 head-<배치>-<v>                     몸통 위 수관 머리(3층 불투명 — 몸통 질감 위에 합성).
  키트 headx-<배치>-<v>                    같은 머리의 투명 덧그림(4층, 첫 머리 층의 키트 경계에 엇갈려 얹는다). 활엽만.
  키트 sky-<v>                             하늘선(윗줄 = 숲 밖 덧그림 ★, 가운데 줄 = 위 가장자리, 아랫줄 = 몸통).
  키트 band-<L|M|R|one>-<v>                S 가장자리 밑 줄기 띠(활엽 1칸·대숲 2칸 높이).
  키트 tree-<t2x3|t3x4|t4x4>-<v>          성긴 숲용 한 그루(활엽). 삼나무는 tree-<s2x4|s2x5|s3x5>-<v>.
  종류 bl 활엽(느티나무·잡목) · bb 대숲 · sk 벚나무 숲 · sg 삼나무 숲 · mp 단풍 숲(가을). 한 그루 느티나무·벚나무는 jp_street_trees(가로수 3×4)를 쓴다.

  python3 scripts/content/jp-city/blocks/jp_forest_pack.py [OUT_DIR]   # selftest + 미리보기
"""
import collections
import json
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, '..', 'forest'))
sys.path.insert(0, os.path.join(HERE, '..'))
import numpy as np  # noqa: E402
from PIL import Image  # noqa: E402
import forest_kit_proto as F  # noqa: E402

BLOCK = 'jp_forest_pack'
ROOT = os.path.abspath(os.path.join(HERE, '..', '..', '..', '..'))
OUTDIR = os.path.join(ROOT, 'tiledata', 'jp-city', 'blocks', BLOCK)
KINDS = (('bl', 'broadleaf', '활엽 혼효림(느티나무·잡목)'), ('bb', 'bamboo', '대숲'), ('sk', 'sakura', '벚나무 숲'), ('sg', 'sugi', '삼나무 숲'), ('mp', 'maple', '단풍 숲'))
_CACHE = {}


def _cells(a):
    """RGBA 배열 → [(cx, cy, 16x16 배열 | None)] (완전 투명 칸은 None)."""
    out = []
    for cy in range(a.shape[0] // 16):
        for cx in range(a.shape[1] // 16):
            t = a[cy * 16:(cy + 1) * 16, cx * 16:(cx + 1) * 16]
            out.append((cx, cy, t.copy() if t[:, :, 3].any() else None))
    return out


def _clean(t):
    t = t.copy()
    t[:, :, 3] = np.where(t[:, :, 3] > 0, 255, 0)
    t[t[:, :, 3] == 0] = 0
    return t


def _finalize():
    if 'r' in _CACHE: return _CACHE['r']
    cells = collections.OrderedDict(); seen = {}
    autotiles, groups, kits, renders = [], [], [], {}

    def put(t, pc, loc, label, desc, tags):
        t = _clean(t)
        key = (t.tobytes(), pc)
        if key in seen: return seen[key]
        seen[key] = loc
        cells[loc] = dict(img=Image.fromarray(t, 'RGBA'), pc=pc, label=label, desc=desc, tags=list(tags))
        return loc

    def add_kit(kid, name, arr, pc_of_row, desc, rules, tags, role='terrain', anchor_dy=None):
        h, w = arr.shape[0] // 16, arr.shape[1] // 16
        g = [[None] * w for _ in range(h)]
        for cx, cy, t in _cells(arr):
            if t is None: continue
            g[cy][cx] = put(t, pc_of_row(cy, h), f'{kid}/{cx}.{cy}', f'{name} 칸 ({cx},{cy})', f'[숲 팩] {name} 의 일부. 키트 jp-{kid} 로 통째로 놓는다.', tags)
        ai = dict(snap='floor', tags=list(tags) + ['jp-forest'], description=f'{name} - 폭 {w}칸×높이 {h}칸. {desc}', placementRules=rules,
                  repeatability='repeat', growthAxis=None, anchor=dict(dx=0, dy=h - 1 if anchor_dy is None else anchor_dy), access=[], role=role)
        kits.append(dict(id='jp-' + kid, name=name, grid=g, base=None, parts=[], ai=ai))
        renders[kid] = arr

    for k, kind, ko in KINDS:
        kit = F.Kit(kind)
        tags = ['숲', ko, '수관']
        # 1) 수관 오토타일
        canon_loc = {}
        for m in F.CANON:
            canon_loc[m] = put(kit.tiles[m], 'solid', f'canopy-{k}/m{m}', f'{ko} 수관 (8방 {m})', f'[숲 팩] {ko} 수관 오토타일 칸. 오토타일 jp-forest-{k} 로 칠한다.', tags)
        interior = []
        for v, t in enumerate(kit.interior[0]):
            interior.append(put(t, 'solid', f'canopy-{k}/body{v}', f'{ko} 수관 몸통 변형 {v}', f'[숲 팩] {ko} 수관 속칸(위치 해시로 고른다).', tags))
        edges = {}
        for side, lst in (('n', kit.n_edge), ('s', kit.s_edge), ('w', kit.w_edge), ('e', kit.e_edge)):
            edges[side] = [put(t, 'solid', f'canopy-{k}/{side}{v}', f'{ko} 수관 {side} 가장자리 변형 {v}', f'[숲 팩] {ko} 곧은 가장자리 변형.', tags) for v, t in enumerate(lst)]
        member = list(dict.fromkeys(list(canon_loc.values()) + interior + [x for l in edges.values() for x in l]))
        autotiles.append(dict(id=f'jp-forest-{k}', name=f'숲 수관 · {ko}', neighborhood=8, layer='upper', member=member, connect=None,
                              variantMap={str(m): canon_loc[F.canon(m)] for m in range(256)}, interior=[interior, interior], edgeConnects=True))
        groups.append(dict(id=f'jp:forest-{k}-canopy', name=f'숲 수관 · {ko}', role='green', defaultLayer='upper', cells=member,
                           desc=f'{ko} 숲 구획을 덮는 수관(위층·막힘). 숲 칠하기(forestPainter)가 마스크 → 오토타일 → 하늘선 → 머리 → 줄기 띠 순서로 쓴다.',
                           rules='낱칸으로 찍지 말고 숲 칠하기 도구 또는 오토타일 jp-forest-%s 로 칠한다. 마지막 줄(활엽 1줄·대숲 2줄)은 줄기 띠 자리다.' % k))
        if kind != 'bamboo':
            for side in 'nswe':
                groups.append(dict(id=f'jp:forest-{k}-edge-{side}', name=f'숲 수관 {side} 가장자리 변형 · {ko}', role='green', defaultLayer='upper', cells=edges[side],
                                   desc=f'{ko} 수관의 곧은 {side} 가장자리 변형 칸.', rules='숲 칠하기가 위치 해시로 고른다.'))
        # 2) 머리 키트
        for (key, v), arr in sorted(kit.patches.items()):
            opaque = arr.copy()
            if kind != 'bamboo':
                # 3층 불투명 머리 = 몸통 질감(변형 0) 위에 투명 머리를 합성
                h, w = arr.shape[0] // 16, arr.shape[1] // 16
                body = np.zeros_like(arr)
                for j in range(h):
                    for i in range(w):
                        body[j * 16:(j + 1) * 16, i * 16:(i + 1) * 16] = kit.interior[0][0]
                F.over(body, arr, 0, 0)
                opaque = body
                add_kit(f'forest-{k}-headx-{key}-{v}', f'{ko} 수관 머리 덧그림 {key}-{v}', arr, lambda cy, h: 'star',
                        '수관 머리 투명 덧그림(4층). 첫 머리 층의 키트 경계에 엇갈려 얹어 덩이를 겹친다.', '숲 수관 위(4층)에만. 숲 칠하기가 쓴다.', tags + ['덧그림'])
            add_kit(f'forest-{k}-head-{key}-{v}', f'{ko} 수관 머리 {key}-{v}', opaque, lambda cy, h: 'solid',
                    '수관 몸통 위 큰 잎 덩이(3층, 몸통 칸을 바꿔 놓는다).', '숲 수관 속칸 위에만(가장자리 칸 금지, 활엽은 S 가장자리 허용).', tags)
        # 3) 하늘선 키트
        for v, arr in enumerate(kit.edge_kits):
            add_kit(f'forest-{k}-sky-{v}', f'{ko} 하늘선 {v}', arr, lambda cy, h: 'star' if cy == 0 else 'solid',
                    '숲 위 가장자리의 솟은 수관. 윗줄은 숲 밖 칸 위 덧그림(★, 4층), 가운데 줄은 위 가장자리, 아랫줄은 몸통(3층).',
                    '윗줄이 숲 위 바깥 칸에 오도록 놓는다(가운데 줄 = 숲 첫 줄).', tags, anchor_dy=1)
        # 4) 줄기 띠
        for (part, v), arr in sorted(kit.bands.items()):
            add_kit(f'forest-{k}-band-{part}-{v}', f'{ko} 줄기 띠 {part}-{v}', arr, lambda cy, h: 'solid',
                    '숲 남쪽 가장자리 밑의 줄기·그늘 띠(3층 막힘). L=왼끝 M=가운데 R=오른끝 one=한 칸.',
                    '수관 S 가장자리 바로 밑 줄에 놓는다.', tags + ['줄기'])
        # 5) 한 그루 나무
        for (key, v), arr in sorted(kit.trees.items()):
            add_kit(f'forest-{k}-tree-{key}-{v}', f'{ko} 한 그루 {key}-{v}', arr, lambda cy, h: 'solid' if cy == h - 1 else 'star',
                    '성긴 숲(잡목림)의 한 그루. 줄기 밑 줄만 막힘.', '풀밭·숲 바닥에 2칸 이상 띄워 세운다(발 = 아랫줄).', tags + ['나무'], role='prop')
    _CACHE['r'] = (cells, autotiles, groups, kits, renders)
    return _CACHE['r']


# 2026-10-20: 숲 구획은 r3 오토타일(jp_forest_r3)이 칠한다. 이 팩은 한 그루 키트(tree-*)만 굽는다 — 수관 오토타일·머리·하늘선·줄기 띠는
# 저장소 시트에 구운 적이 없어(069acd8999 되돌림) 없앨 번호가 없다. 시트 4096px 안에 r3 6종(6×4 위상)을 넣기 위해서다.
TREES_ONLY = True


def build():
    cells, autotiles, groups, kits, _ = _finalize()
    if TREES_ONLY:
        kits = [k for k in kits if '-tree-' in k['id']]
        keep = {x for k in kits for row in k['grid'] for x in row if x}
        cells = collections.OrderedDict((k, v) for k, v in cells.items() if k in keep)
        autotiles, groups = [], []
    return {'cells': collections.OrderedDict((k, dict(v, img=v['img'].copy(), tags=list(v['tags']))) for k, v in cells.items()),
            'autotiles': [dict(a, member=list(a['member']), interior=[list(x) for x in a['interior']], variantMap=dict(a['variantMap'])) for a in autotiles],
            'groups': [dict(g, cells=list(g['cells'])) for g in groups], 'kits': [dict(k) for k in kits],
            'notes': '이어지는 숲(활엽·대숲): 수관 8방 오토타일 + 머리·하늘선·줄기 띠·한 그루. 칠하기는 src/editor/jpCity/forestPainter.ts.'}


def kinds():
    """object-gate 종류: 숲 조각은 모두 organic(시점 면제 종류 — 판정자 과반이 「종류가 맞다」고 해야 한다)."""
    return {k['id']: 'organic' for k in _finalize()[3] if not TREES_ONLY or '-tree-' in k['id']}


def _allowed():
    c = json.load(open(os.path.join(ROOT, 'tiledata', 'jp-city', 'palette-contract.json'), encoding='utf-8'))
    return {tuple(int(h[i:i + 2], 16) for i in (1, 3, 5)) for h in c['colors']}


def selftest(verbose=True):
    out = []
    allowed = _allowed()
    b = build()
    for k, c in b['cells'].items():
        a = np.array(c['img'])
        if a.shape != (16, 16, 4): out.append('(a) %s 크기' % k); continue
        al = a[..., 3]
        if not np.all((al == 0) | (al == 255)): out.append('(a) %s 반투명' % k)
        vis = {tuple(int(x) for x in p) for p in a[al == 255][:, :3]}
        off = vis - allowed
        if off: out.append('(a) %s 계약 밖 색 %s' % (k, sorted('#%02x%02x%02x' % q for q in off)[:3]))
    for at in b['autotiles']:
        if len(at['variantMap']) != 256: out.append('(b) %s 키 수' % at['id'])
        if len({F.canon(m) for m in range(256)}) != 47: out.append('(b) canon')
        for loc in list(at['variantMap'].values()) + at['member']:
            if loc not in b['cells']: out.append('(b) %s 칸 없음 %s' % (at['id'], loc))
    for kt in b['kits']:
        for row in kt['grid']:
            for loc in row:
                if loc is not None and loc not in b['cells']: out.append('(c) %s 칸 없음 %s' % (kt['id'], loc))
    if verbose:
        print('[%s] 칸 %d · 오토타일 %d · 그룹 %d · 키트 %d · 문제 %d' % (BLOCK, len(b['cells']), len(b['autotiles']), len(b['groups']), len(b['kits']), len(out)))
        for o in out[:20]: print('  ', o)
    return out


def preview(out=OUTDIR):
    os.makedirs(out, exist_ok=True)
    _, _, _, _, renders = _finalize()
    pad = 4; maxw = 640
    x = y = rowh = 0; pos = {}
    for kid, a in renders.items():
        h, w = a.shape[:2]
        if x + w > maxw: x = 0; y += rowh + pad; rowh = 0
        pos[kid] = (x, y); x += w + pad; rowh = max(rowh, h)
    sheet = np.zeros((y + rowh, maxw, 4), np.uint8); sheet[:] = (52, 56, 66, 255)
    for kid, a in renders.items():
        px, py = pos[kid]; F.over(sheet, a, px, py)
    Image.fromarray(sheet).save(os.path.join(out, '_all.png'))
    Image.fromarray(sheet).resize((sheet.shape[1] * 2, sheet.shape[0] * 2), Image.NEAREST).save(os.path.join(out, '_all-x2.png'))
    return os.path.join(out, '_all.png')


def export_gate(out=None):
    """object-gate 판정용 PNG(키트 그림, 투명 배경) + items.jsonl. 판정은 `npm run harness -- object-gate review --batch <jsonl>`."""
    out = out or os.path.join(OUTDIR, '_gate')
    os.makedirs(out, exist_ok=True)
    _, _, _, kits, renders = _finalize()
    lines = []
    names = {'head': 'forest canopy crown heads (tile overlay on forest roof)',  # 삼나무 머리는 원뿔 수관 'headx': 'forest canopy crown heads overlay',
             'sky': 'forest north-edge skyline of treetops', 'band': 'forest south edge: trunk band under the canopy', 'tree': 'single deciduous tree'}
    for kt in kits:
        kid = kt['id'][3:]
        p = os.path.join(out, kt['id'] + '.png')
        Image.fromarray(renders[kid]).save(p)
        part = kid.split('-')[2]
        sp = {'-bb-': ' (bamboo)', '-sk-': ' (cherry blossom)', '-sg-': ' (japanese cedar)', '-mp-': ' (autumn maple)'}
        lines.append(json.dumps(dict(png=os.path.basename(p), kind='organic', name=names.get(part, 'forest piece') + next((v for k_, v in sp.items() if k_ in kid), ''), label='jp_city/' + kt['id'])))
    # 수관 오토타일 표본: 6×4 마스크 지도
    for k, kind, _ in KINDS:
        kit = F.Kit(kind)
        g = np.zeros((6, 8), bool); g[1:5, 1:7] = True; g[0, 3:5] = True
        img = np.zeros((6 * 16, 8 * 16, 4), np.uint8)
        for yy in range(6):
            for xx in range(8):
                if not g[yy, xx]: continue
                m = F.canon(F.mask_at(g, xx, yy))
                F.over(img, kit.tiles[m] if m != 255 else kit.interior[0][F.cell_hash(xx, yy) % len(kit.interior[0])], xx * 16, yy * 16)
        p = os.path.join(out, f'jp-forest-{k}-canopy-sample.png')
        Image.fromarray(img).save(p)
        lines.append(json.dumps(dict(png=os.path.basename(p), kind='organic', name='forest canopy autotile sample' + (' (bamboo)' if k == 'bb' else ''), label=f'jp_city/jp-forest-{k}-canopy')))
    jl = os.path.join(out, 'items.jsonl')
    open(jl, 'w', encoding='utf-8').write('\n'.join(lines) + '\n')
    return jl


if __name__ == '__main__':
    bad = selftest()
    print('preview:', preview(sys.argv[1] if len(sys.argv) > 1 else OUTDIR))
    print('gate items:', export_gate())
    sys.exit(1 if bad else 0)
