"""jp_city 블록 `buildings` — 손 도트 일본 건물 통 키트(주택·공동주택·가게·음식점·상업·공공·공장). 계약: ../CONTRACT.md
그림은 scripts/content/jp-city/houses/(ref_house → house_kit → shop_parts → catalog)가 modern3 램프로 그린다(2026-10-06 사용자 승인 화풍).
건물 한 채 = 키트 하나(위층 칸만). 칸은 16px 로 자르고, 같은 화소·같은 통행의 칸은 블록 안에서 하나로 합친다.
통행은 3/4 계약(modern-style-bible §10-2): 맨 아래 D 줄(벽 칸)만 막힘(solid), 그 위·처마 옆 칸은 뒤로 지나가는 칸(star).
  python3 scripts/content/jp-city/blocks/buildings.py           # selftest + tiledata/jp-city/blocks/buildings/*.png
"""
import os, sys, hashlib, json, collections
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, '..')); sys.path.insert(0, HERE)
sys.path.insert(0, os.path.join(HERE, '..', 'houses'))
import numpy as np                                        # noqa: E402
from PIL import Image                                     # noqa: E402
from lib_blocks_lines.core import check_cell, ROOT        # noqa: E402
import catalog as CG                                      # noqa: E402
import house_kit as HK                                    # noqa: E402

BLOCK = 'buildings'
OUTDIR = os.path.join(ROOT, 'tiledata', 'jp-city', 'blocks', 'buildings')
CAT_KO = {'house': '단독주택', 'apartment': '공동주택', 'shop': '가게', 'restaurant': '음식점',
          'commercial': '상업 건물', 'public': '공공 건물', 'industrial': '공장·창고'}
RULES = {
    'house': '주택가 생활도로·골목 쪽으로 정면을 둔다. 옆집과 0~1칸 띄우고 마당·블록 담·화분은 따로 깐다.',
    'apartment': '생활도로 쪽 정면. 큰 건물이라 앞에 자전거 두는 자리·주차 칸을 1~2줄 비우면 자연스럽다.',
    'shop': '상점가(商店街) 보도에 정면을 붙여 옆 가게와 벽을 맞대 줄지어 세운다. 출입구 앞 보도는 비운다.',
    'restaurant': '상점가·역 앞 골목. 노렌·제등이 있는 쪽이 정면이다. 옆 가게와 붙여 세운다.',
    'commercial': '역 앞·간선도로 쪽. 큰 정면 앞에 보도 2칸 이상, 슈퍼·편의점은 앞에 주차·자전거 자리를 둔다.',
    'public': '동네 중심(역 앞·교차로 모퉁이·공원 옆). 앞에 보도와 출입구 앞 빈칸을 둔다.',
    'industrial': '주택가 가장자리·선로·강변 쪽. 셔터 앞은 트럭이 서는 넓은 바닥(아스팔트·콘크리트)을 둔다.',
}


def _depth_rows(R, meta, cat):
    """막힘 줄 수 D: 1층 앞면이 덮는 줄 수(최소 2), 큰 건물은 3."""
    big = cat in ('apartment', 'commercial', 'industrial') or meta['nfloors'] >= 3
    return max(2, min(R - 1, 3 if big else 2))


def _sprite(id_):
    name, cat, r = CG.CATALOG[id_]
    cv, m = HK.build(r)
    a = cv.a.copy()
    alpha = a[:, :, 3] > 0
    ys = np.where(alpha.any(1))[0]; xs = np.where(alpha.any(0))[0]
    x0 = m['x0'] - 16
    while x0 > xs.min(): x0 -= 16
    x1 = m['x1'] + 1 + 16
    while x1 <= xs.max(): x1 += 16
    B = ys.max() + 1
    rows = -(-(B - ys.min()) // 16)
    T = B - rows * 16
    pad_top = max(0, -T)
    G = m['ground']
    if pad_top:
        a = np.concatenate([np.zeros((pad_top, a.shape[1], 4), np.uint8), a], 0); T += pad_top; B += pad_top; G += pad_top
    pad_l = max(0, -x0)
    if pad_l:
        a = np.concatenate([np.zeros((a.shape[0], pad_l, 4), np.uint8), a], 1); x0 += pad_l; x1 += pad_l
        m = dict(m, doors=[d + pad_l for d in m['doors']])
    if x1 > a.shape[1]:
        a = np.concatenate([a, np.zeros((a.shape[0], x1 - a.shape[1], 4), np.uint8)], 1)
    crop = a[T:B, x0:x1]
    m = dict(m, groundRow=G - T)                          # 땅 줄(크롭 좌표) — 줄 키트가 건물 발을 맞출 때 쓴다
    return name, cat, crop, m, x0


# 상점가 줄 키트 — 단품 키트를 x + w − 1 로 세우면 처마 칸끼리만 겹쳐 벽 사이에 1칸 틈(골목)이 남는다.
# 칸 하나에 위층 그림이 하나뿐이라 옆 건물 처마를 화소로 겹칠 수 없으므로, 벽을 맞댄 상점가는 미리 합친 줄로 둔다.
ROWS = collections.OrderedDict([
    ('row_shotengai_a', ('상점가 줄 A · 八百屋·魚屋·肉屋·パン', 'shop', ['shop_greengrocer', 'shop_fish', 'shop_butcher', 'shop_bakery'])),
    ('row_shotengai_b', ('상점가 줄 B · 花屋·書店·薬局·クリーニング', 'shop', ['shop_flower', 'shop_books', 'shop_pharmacy', 'shop_cleaning'])),
    ('row_shotengai_c', ('상점가 줄 C · 酒屋·自転車·不動産·美容室', 'shop', ['shop_sake', 'shop_bicycle', 'shop_realestate', 'shop_salon'])),
    ('row_shotengai_d', ('상점가 줄 D · 和菓子·駄菓子·たばこ·理髪', 'shop', ['shop_wagashi', 'shop_dagashi', 'shop_tabako', 'shop_barber'])),
    ('row_inshokugai', ('음식점 줄 · ラーメン·寿司·定食·居酒屋·喫茶', 'restaurant', ['shop_ramen', 'shop_sushi', 'shop_teishoku', 'shop_izakaya', 'shop_cafe'])),
    ('row_ekimae', ('역 앞 줄 · 薬局·コンビニ·喫茶·不動産', 'commercial', ['shop_pharmacy', 'conbini', 'shop_cafe', 'shop_realestate'])),
    # 셔터 거리(조사 01: 빈 점포율 13.6%, 한 줄 10칸에 1~2칸) — 영업 가게 사이에 셔터 가게를 섞은 줄
    ('row_shutter_a', ('셔터 섞인 상점가 줄 A · 花屋·(셔터)·薬局·(셔터)·酒屋', 'shop', ['shop_flower', 'shop_cleaning_shut', 'shop_pharmacy', 'shop_bicycle_shut', 'shop_sake'])),
    ('row_shutter_b', ('셔터 섞인 상점가 줄 B · 八百屋·(셔터)·パン·(빈 점포)', 'shop', ['shop_greengrocer', 'shop_fish_shut', 'shop_bakery', 'shop_vacant'])),
])


def _row_sprite(row_id):
    """단품 건물을 벽을 맞대 합친 줄 그림. 다음 건물의 처마 칸(0열)이 앞 건물의 마지막 벽 칸에 겹친다 — 뒤 건물이 앞에 그려진다."""
    name, cat, ids = ROWS[row_id]
    parts = [_sprite(i) for i in ids]
    up = max(p[3]['groundRow'] for p in parts)            # 땅 줄 위 높이
    down = max(p[2].shape[0] - p[3]['groundRow'] for p in parts)
    oxs = []; ox = 0
    for p in parts:
        oxs.append(ox); ox += (p[2].shape[1] // 16 - 2) * 16
    W = oxs[-1] + parts[-1][2].shape[1]
    H = -(-(up + down) // 16) * 16
    top = H - down - up                                   # 위쪽 여백(16 배수 맞춤)
    a = np.zeros((H, W, 4), np.uint8); doors = []; nf = 1
    for p, ox in zip(parts, oxs):
        crop, m = p[2], p[3]
        y = top + up - m['groundRow']; msk = crop[:, :, 3] > 0
        a[y:y + crop.shape[0], ox:ox + crop.shape[1]][msk] = crop[msk]
        doors += [d - p[4] + ox for d in m['doors']]
        nf = max(nf, m['nfloors'])
    return name, cat, a, dict(doors=doors, nfloors=nf), 0


def _finalize():
    if 'r' in _CACHE: return _CACHE['r']
    cells = collections.OrderedDict(); seen = {}; kits = []; sprites = {}
    for id_ in list(CG.CATALOG) + list(ROWS):
        name, cat, crop, m, x0 = _row_sprite(id_) if id_ in ROWS else _sprite(id_)
        R, C = crop.shape[0] // 16, crop.shape[1] // 16
        D = _depth_rows(R, m, cat)
        door_cols = sorted({(d - x0) // 16 for d in m['doors'] if 0 <= (d - x0) // 16 < C})
        grid = []
        for cy in range(R):
            row = []
            for cx in range(C):
                t = crop[cy * 16:(cy + 1) * 16, cx * 16:(cx + 1) * 16].copy()
                if not t[:, :, 3].any(): row.append(None); continue
                t[t[:, :, 3] == 0] = 0
                side = cx == 0 or cx == C - 1
                pc = 'solid' if (cy >= R - D and not side) else 'star'
                if cy == R - 1 and cx in door_cols: pc = 'solid'
                key = (t.tobytes(), pc)
                if key in seen:
                    row.append(seen[key]); continue
                local = '%s/%d.%d' % (id_, cx, cy)
                seen[key] = local
                cells[local] = dict(img=Image.fromarray(t, 'RGBA'), pc=pc, label='%s 칸 (%d,%d)' % (name, cx, cy),
                                    desc='[건물 키트] %s 의 일부. 키트 jp-bldg-%s 로 통째로 놓는다.' % (name, id_.replace('_', '-')),
                                    tags=['건물', CAT_KO[cat]])
                row.append(local)
            grid.append(row)
        nf = m['nfloors']
        parts = [dict(kind='entrance', x=c, y=R - 1, w=1, h=1, label='출입구') for c in door_cols]
        access = [dict(x=c, y=R) for c in door_cols]
        desc = '%s — %s, %d층, 폭 %d칸×높이 %d칸(밑면 막힘 %d줄). 손 도트 일본 동네 건물(modern3, 빛 왼쪽 위, 정면 고정 3/4).' % (
            name, CAT_KO[cat], nf, C, R, D)
        if id_ in ROWS:
            desc += ' 단품 건물 %d채를 벽을 맞대 미리 합친 상점가 줄이다(단품은 붙여 세워도 1칸 틈이 남는다).' % len(ROWS[id_][2])
        rules = RULES[cat] + ' 키트 아래 %d줄만 막힘이고 그 위(지붕·윗층)는 캐릭터가 뒤로 지나가며 가려지는 칸이다. 출입구 바로 아래 한 칸은 걸을 수 있는 바닥으로 둔다.' % D
        ai = dict(snap='floor', tags=['건물', CAT_KO[cat], name.split(' ')[0]], description=desc, placementRules=rules,
                  repeatability='fixed', growthAxis=None, anchor=dict(dx=C // 2, dy=R - 1), access=access, role='building')
        kits.append(dict(id='jp-bldg-' + id_.replace('_', '-'), name=name, grid=grid, base=None, parts=parts, ai=ai))
        sprites[id_] = (crop, grid, D)
    _CACHE['r'] = (cells, kits, sprites)
    return _CACHE['r']


_CACHE = {}
NOTES = ('일본 동네 건물 %d종 블록. 그림은 houses/ 의 조립 키트(기준 집 ref_house 를 사용자가 승인한 화풍)로 그린 통 건물을 16px 로 자른 것이다. '
         '같은 화소·같은 통행의 칸은 합쳤다. 통행: 맨 아래 D줄(2, 큰 건물 3)의 벽 칸만 solid, 처마 옆·윗층·지붕은 star(뒤로 지나감). '
         '한계: (1) 건물은 정면 하나(뒷면·옆면 없음). (2) 간판 글자는 일본어 고정(JIS 16px 글리프). (3) 마당·담·주차장은 키트에 없다 — 기존 오토타일·소품으로 깐다.')


def build():
    cells, kits, sprites = _finalize()
    return {'cells': collections.OrderedDict((k, dict(v, img=v['img'].copy(), tags=list(v['tags']))) for k, v in cells.items()),
            'autotiles': [], 'groups': [], 'kits': [dict(k) for k in kits], 'notes': NOTES % len(kits)}


def _digest(b):
    h = hashlib.sha256()
    for k in sorted(b['cells']): h.update(k.encode()); h.update(np.array(b['cells'][k]['img']).tobytes()); h.update(b['cells'][k]['pc'].encode())
    for kit in b['kits']: h.update(json.dumps([kit['id'], kit['grid'], kit['parts'], kit['ai']], ensure_ascii=False, sort_keys=True).encode())
    return h.hexdigest()


def render_all():
    """눈 확인: 각 키트를 칸에서 다시 조립 + 통행 덧그림(막힘 빨강 테·출입구 노랑)."""
    os.makedirs(OUTDIR, exist_ok=True)
    cells, kits, sprites = _finalize()
    for kit in kits:
        g = kit['grid']; R, C = len(g), len(g[0])
        im = Image.new('RGBA', (C * 16, R * 16), (104, 103, 122, 255))
        ov = Image.new('RGBA', im.size, (0, 0, 0, 0))
        for y in range(R):
            for x in range(C):
                k = g[y][x]
                if k is None: continue
                im.alpha_composite(cells[k]['img'], (x * 16, y * 16))
                if cells[k]['pc'] == 'solid':
                    for i in range(16):
                        for (px, py) in ((x * 16 + i, y * 16), (x * 16 + i, y * 16 + 15), (x * 16, y * 16 + i), (x * 16 + 15, y * 16 + i)):
                            ov.putpixel((px, py), (219, 77, 74, 255))
        for p in kit['parts']:
            for i in range(16): ov.putpixel((p['x'] * 16 + i, p['y'] * 16 + 15), (240, 205, 69, 255))
        im.save(os.path.join(OUTDIR, kit['id'] + '.png'))
        im2 = im.copy(); im2.alpha_composite(ov); im2.resize((im.width * 3, im.height * 3), Image.NEAREST).save(os.path.join(OUTDIR, kit['id'] + '-pass-x3.png'))


def selftest(verbose=True, render=True):
    out = []
    def bad(m): out.append(m)
    b = build(); cells, kits, sprites = _finalize()
    for k, c in b['cells'].items():
        for m in check_cell(c['img']): bad('(a) %s: %s' % (k, m))
        if c['pc'] not in ('solid', 'star'): bad('(a) %s pc %s' % (k, c['pc']))
        if not np.array(c['img'])[..., 3].any(): bad('(a) %s 완전 투명 칸' % k)
    # (b) 칸에서 다시 조립한 그림 == 원래 건물 그림
    for kit in kits:
        id_ = kit['id'][len('jp-bldg-'):].replace('-', '_')
        crop, grid, D = sprites[id_]
        g = kit['grid']; R, C = len(g), len(g[0])
        re_ = np.zeros((R * 16, C * 16, 4), np.uint8)
        for y in range(R):
            for x in range(C):
                if g[y][x] is not None: re_[y * 16:(y + 1) * 16, x * 16:(x + 1) * 16] = np.array(b['cells'][g[y][x]]['img'])
        c2 = crop.copy(); c2[c2[:, :, 3] == 0] = 0
        if not (re_ == c2).all(): bad('(b) %s 다시 조립한 그림이 원본과 다르다' % kit['id'])
        if not kit['id'].startswith('jp-'): bad('(e) id 접두 %s' % kit['id'])
        for p in kit['parts']:
            k = g[p['y']][p['x']]
            if k is None or b['cells'][k]['pc'] != 'solid': bad('(e) %s 출입구 칸 (%d,%d) 이 막힘이 아니다' % (kit['id'], p['x'], p['y']))
        for a in kit['ai']['access']:
            if a['y'] < R: bad('(e) %s 접근 칸이 키트 안' % kit['id'])
        if not kit['parts'] and not kit['id'].startswith('jp-bldg-factory'): pass
    ids = [k['id'] for k in kits]
    if len(ids) != len(set(ids)): bad('(e) 키트 id 중복')
    _CACHE.clear(); h2 = _digest(build()); _CACHE.clear(); h3 = _digest(build())
    if h2 != h3: bad('(d) 같은 입력 build() 해시가 다르다')
    if render: render_all()
    if verbose:
        n_cells = sum(sum(1 for k in r if k) for kit in kits for r in kit['grid'])
        print('buildings — 키트 %d · 고유 칸 %d (자리 %d, 합침 %d) · 출입구 없는 키트 %s' % (
            len(kits), len(b['cells']), n_cells, n_cells - len(b['cells']), [k['id'] for k in kits if not k['parts']]))
        for m in out: print('  ✗', m)
    return len(out)


if __name__ == '__main__':
    sys.exit(1 if selftest() else 0)
