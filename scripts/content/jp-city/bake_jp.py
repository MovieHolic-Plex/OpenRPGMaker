#!/usr/bin/env python3
"""번들 타일셋 jp_city 굽기 — 이식한 일본 키트(2880칸 + 카탈로그)와 계약 블록(blocks/*.py)을 합쳐 48열 시트·정의 JSON 을 쓴다.

  python3 scripts/content/jp-city/bake_jp.py [--dry] [--selftest] [--out-root DIR]

입력  tiledata/jp-city/sources/jp_shopstreet16.png + .catalog.json   (16열 2880칸, 행인 칸 851~1005 는 투명 자리)
      scripts/content/jp-city/blocks/<이름>.py                       (BLOCK_ORDER 에 이름으로 고정한 것만, 없으면 건너뜀)
출력  public/assets/jp-city/jp-city-chipset.png      시트(48열, 16px 칸, 높이 ≤ 4096)
      src/assets/jpCitySheet.json                    {count, tilesPerRow}
      src/assets/jpCityTileset.json                  타일셋 정의(통행·층·이름표·그룹·오토타일·구조 키트)
      tiledata/jp-city/pins.json                     자리 키 → 칸 번호(앞 번호 불변, 새 칸은 끝에)
      tiledata/jp-city/bake-report.json              칸 수·키트 수·검증 숫자
      tiledata/jp-city/kit-index.json                키트 id → 종류·크기·출처·문·접근 칸
      tiledata/jp-city/bake/PC-RULES.md              칸 통행 종류(pc) 정하는 규칙

번호 핀(자리 키): 기본 블록 `jp16/<번호>` 는 원본 0..2879 그대로 고정. 통행이 다른 쓰임이 필요하면 `jp16/<번호>@<pc>`(같은 그림 복제 칸),
키트 안에서 문·간판·그림자를 겹쳐 굽는 칸은 `jp16c/<구성 번호들>@<pc>`. 계약 블록은 `<BLOCK>/<local>`. 새 키는 max(핀)+1 부터 덧붙고 기존 번호는 안 움직인다.
"""
import argparse, collections, hashlib, importlib.util, json, math, os, re, shutil, sys, tempfile
import numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..', '..'))
sys.path.insert(0, HERE)
sys.path.insert(0, os.path.join(HERE, 'lib'))
import bake_lib as BL            # noqa: E402
import bake_names as KO          # noqa: E402
import jpenv                     # noqa: E402,F401
import jpstreet                  # noqa: E402

ID = 'jp_city'
NAME = '일본 도시 · 상가·주택·역·신사 (도트)'
TEXTURE = 'tex_jp_city'
FAMILY = 'oprn-jp'
TPR = BL.TPR
SOURCES = os.path.join(ROOT, 'tiledata', 'jp-city', 'sources')
PALETTE = os.path.join(ROOT, 'tiledata', 'atlas-pick', 'palette', 'modern3.pal')
BLOCKS_DIR = os.path.join(HERE, 'blocks')
# 블록 합치는 순서(이름 고정). 블록을 추가할 때는 맨 끝에 덧붙인다. 번호는 핀이 지키므로 순서는 새 번호가 매겨지는 순서일 뿐이다.
BLOCK_ORDER = ['autotiles_ground', 'autotiles_lines', 'roads', 'buildings', 'street_hand']
PEOPLE = (851, 1005)            # 행인(Actor1) 자리 — 번들에서 제외, 투명 빈 칸으로 번호만 지킨다
N_ORIG = 2880
SIGN_DECOS = ('sign_h', 'vstack', 'wallad', 'vsign', 'plate', 'board', 'rtext', 'facade_ad', 'vision', 'mural')
BLOCK_ROLE = {'terrain': 'terrain', 'road': 'terrain', 'path': 'terrain', 'green': 'terrain', 'detail': 'terrain', 'edge': 'fence',
              'wall': 'wall', 'prop': 'prop', 'water': 'water', 'building': 'building', 'fence': 'fence', 'roof': 'roof', 'castle': 'castle'}
GROWTH = {'x': 'horizontal', 'y': 'vertical', 'xy': 'both', 'horizontal': 'horizontal', 'vertical': 'vertical', 'both': 'both'}
SNAP = {'floor': 'floor', 'wall': 'wall-any', 'wall-north': 'wall-north', 'wall-any': 'wall-any', 'free': 'free'}

PC_RULES_MD = """# jp_city 칸 통행 종류(pc) 정하는 규칙

`bake_jp.py` 가 칸마다 pc 를 정한다. pc → 통행·층은 modern_city 와 같은 표다(`bake_lib.PC`).

| pc | 층(priority) | 통행 | 홈 레이어 | 쓰임 |
|---|---|---|---|---|
| floor | 아래 | 걷는다 | 아래 | 불투명 땅(보도·도로·잔디 …) |
| solidfloor | 아래 | 막힘 | 아래 | 불투명인데 막힌 땅(물) |
| flat | 아래 | 걷는다 | 위(덧그림) | 투명 바닥 표시·소품 아랫단(캐릭터 밑) |
| solid | 위 | 막힘 | 위 | 건물 아래 두 줄·소품 밑동·가드레일 |
| star | 위 | 걷는다 ★ | 위 | 건물 윗층·처마·옥상 기물·소품 윗부분(사람 위에 그려짐) |
| blank | 아래 | 막힘 | 아래 | 빈 칸 |

## 칸의 쓰임(맥락)마다 정한다 — 카탈로그 walkLegend(F 걸음 / C 지나감 / S·X 막힘)와 층(lo/up)이 근거

1. **소품(props)** 칸 하나마다 카탈로그의 walk·layer·투명도로:
   - 막힘(S·X): 아래층(lo)이면서 불투명 → `solidfloor`, 그 밖 → `solid`
   - 지나감(C): 아래층(lo) 불투명 → `floor`, 아래층(lo) 투명 → `flat`(바퀴·열차 아랫줄처럼 사람 밑), 위층(up) → `star`
2. **건물(bands/recipes)** 위치마다: 지면 층 띠(`gr.*`)의 둘째·셋째 줄과 문 칸은 `solid`(몸채·문은 막힘, 문 앞 접근 칸은 키트 바깥 한 줄 아래), 그 위(윗층·처마·옥상·옥상 간판·지면 층 첫 줄)는 `star`.
   L자 건물의 마당 바닥(lot·sw …)은 불투명이므로 `floor`(아래층).
   ※ 원본 카탈로그는 문 앞 칸을 F(걸음)로 두었으나, 에디터 키트 규약(문 칸 = 입구 부위 = 막힘, 접근 칸 = 키트 바깥 한 줄 아래)에 맞춰 문 칸을 막힘으로 굽는다.
3. **부착물(decos)** 낱칸은 모두 `star`(문 부착물만 맨 아래 두 줄 `solid`). 키트 안에서는 건물 칸과 겹쳐 **합성 칸**(`jp16c/…`)으로 구워 위치 맥락의 pc 를 쓴다.
4. **거리 바닥(street)** 은 `floor`, 단 가드레일은 투명이라 `solid`, 물은 `solidfloor`.
5. 어느 이름에도 안 쓰인 원본 칸 110개는 투명이면 `solid`, 불투명이면 `solidfloor`(키트·그룹에 안 넣음, 번호만 지킨다). 행인 자리 155칸은 `blank`.

## 한 칸이 여러 맥락에서 다른 pc 를 요구하면

한 칸 번호는 통행이 하나뿐이다. 원본 번호에는 **가장 많이 쓰이는 맥락의 pc**(동률이면 floor > solidfloor > solid > star > flat)를 주고,
다른 pc 가 필요한 키트 칸은 같은 그림의 복제 칸(`jp16/<번호>@<pc>`)을 시트 끝에 덧붙여 쓴다. 원본 번호는 안 움직인다.

## 그룹 층(defaultLayer·layerHome)은 칸 홈에서 유도한다 (2026-10-03 정정)

엔진은 커스텀 타일셋의 칸 홈을 **칸 단위**로만 정한다(`tileLayerHome`: 잠긴 칸의 `defaultLayer`, 아니면 `priority`). 그룹의 `defaultLayer` 는 홈 판정에 안 쓰이고 어휘 설명만 정한다.
그래서 굽기(`bake_lib.derive_group_layer`)가 그룹 층을 멤버 칸의 홈에서 유도한다 — 전부 위층이면 `upper`, 전부 아래층이면 `lower`, 섞이면 `mixed`(+`layerHome: perCell`).
정의 검사 `group-layer-vs-tile-home` 가 일치를 지킨다. 정정 전에는 투명 덧그림 5그룹이 `lower`(엔진 홈 위층, 74칸), 소품·육교 8그룹이 `upper`(아래층 칸 103개 섞임)로 선언돼 있었다.
부수 효과: 투명 덧그림 그룹(`upper`)은 `fill_region` 재료가 아니다(`tileVocabulary.isFlatFillGroup` 이 위층 그룹을 거부) — `paint_tiles` layer "2" 로 칠한다.
★ 칸 중 태그에 stair·계단·사다리가 있는 54칸은 엔진이 일부러 캐릭터 아래로 그린다(`characterDepth.isWalkableStairTile`) — 어긋남이 아니라 설계된 예외다.

## 투명도 규칙(tile-layer-policy)

투명 조각을 아래층에 두지 않는다(받침 없이 검게 비친다). 투명 조각은 위층(`solid`·`star`) 또는 투명 덧그림(`flat`, 홈 레이어 위·`layerBacking: none`)이다.
불투명한 칸만 아래층(`floor`·`solidfloor`)이 된다. 건물 몸채는 불투명이어도 위층 pc 를 쓴다(키트는 위층에만 올린다).
"""


def paths(out_root):
    j = lambda *p: os.path.join(out_root, *p)
    return dict(png=j('public/assets/jp-city/jp-city-chipset.png'), sheet=j('src/assets/jpCitySheet.json'), tileset=j('src/assets/jpCityTileset.json'),
                pins=j('tiledata/jp-city/pins.json'), report=j('tiledata/jp-city/bake-report.json'), kits=j('tiledata/jp-city/kit-index.json'),
                pcrules=j('tiledata/jp-city/bake/PC-RULES.md'))


# ====================================================================== 맥락 → pc
def prop_pc(w, layer, alpha):
    if alpha == 'blank': return None
    if w in ('S', 'X'): return 'solidfloor' if (layer == 'lo' and alpha == 'opaque') else 'solid'
    if layer == 'lo': return 'floor' if alpha == 'opaque' else 'flat'
    return 'star'


def street_pc(name):
    return {'guard': 'solid', 'water': 'solidfloor'}.get(name, 'floor')


def deco_row_pc(did, r, h):
    return 'solid' if did.startswith('door.') and r >= h - 2 else 'star'


def band_row_pc(bid, r):
    return 'solid' if bid.startswith('gr.') and r >= 1 else 'star'


def band_cells(rec):
    """band 레코드의 (칸 이름, 줄 번호) 전부."""
    out = []
    for r in range(rec['rows']):
        out.append((rec['L'][r], r))
        for R in rec['R']: out.append((R[r], r))
        if rec['F']: out.append((rec['F'][r], r))
        for mod in rec['mods'].values():
            for col in mod: out.append((col[r], r))
    return [(nm, r) for nm, r in out if nm]


class Src:
    """카탈로그 + 원본 시트(읽기 전용) 와 칸별 맥락."""
    def __init__(self):
        self.K = jpstreet.Kit.load(SOURCES)
        self.cat = self.K.cat
        self.names = self.cat['names']
        self.alpha = {}
        self.raw_img = {}
        for i in range(N_ORIG):
            im = BL.arr_norm(self.cell_arr(i)); self.raw_img[i] = im; self.alpha[i] = BL.alpha_class(im)
        self.by_idx = collections.defaultdict(list)      # idx → [칸 이름 …] (카탈로그 순)
        for nm, i in self.names.items():
            if i is not None: self.by_idx[i].append(nm)
        self.ctx = collections.defaultdict(collections.Counter)
        self._collect()
        self.primary = {i: self._primary(i) for i in range(N_ORIG)}

    def cell_arr(self, i):
        r, c = divmod(i, 16)
        return self.K.sheet[r * 16:(r + 1) * 16, c * 16:(c + 1) * 16]

    def idx_of(self, nm):
        return self.names.get(nm) if nm else None

    def _collect(self):
        c = self.cat
        for bid, rec in c['bands'].items():
            for nm, r in band_cells(rec):
                i = self.idx_of(nm)
                if i is not None: self.ctx[i][band_row_pc(bid, r)] += 1
        for did, d in c['decos'].items():
            for r in range(d['h']):
                for cc in range(d['w']):
                    i = self.idx_of(d['cells'][r][cc])
                    if i is not None and self.alpha[i] != 'blank': self.ctx[i][deco_row_pc(did, r, d['h'])] += 1
        for sn, nm in c['street'].items():
            i = self.idx_of(nm)
            if i is not None: self.ctx[i][street_pc(sn)] += 1
        for pn, p in c['props'].items():
            for r in range(p['h']):
                for cc in range(p['w']):
                    i = self.idx_of(p['cells'][r][cc])
                    if i is None: continue
                    pc = prop_pc(p['walk'][r][cc], p['layer'][r][cc], self.alpha[i])
                    if pc: self.ctx[i][pc] += 1

    def _primary(self, i):
        if PEOPLE[0] <= i <= PEOPLE[1] and self.alpha[i] == 'blank': return 'blank'
        cnt = self.ctx.get(i)
        if not cnt: return 'solid' if self.alpha[i] == 'trans' else 'solidfloor' if self.alpha[i] == 'opaque' else 'blank'
        return sorted(cnt.items(), key=lambda kv: (-kv[1], BL.PC_ORDER.index(kv[0])))[0][0]

    # ---- 이름표
    def describe_name(self, nm):
        """칸 이름 하나 → (label, role, kind, tags)."""
        c = self.cat
        if nm.startswith('st.'):
            ko, cat = KO.street_ko(nm[3:]); return ko, 'terrain', 'street', ['street', cat]
        m = re.match(r'^prop\.(.+)\.c(\d+)\.r(\d+)$', nm)
        if m and m.group(1) in c['props']:
            pn = m.group(1); p = c['props'][pn]; var = KO.prop_variant_ko(pn)
            return f"{p['desc']}{' · ' + var if var else ''} ({int(m.group(2)) + 1},{int(m.group(3)) + 1})", KO.prop_role(pn), 'prop', ['prop', KO.prop_cat(pn)]
        m = re.match(r'^deco\.(.+)\.c(\d+)\.r(\d+)$', nm)
        if m and m.group(1) in c['decos']:
            did = m.group(1)
            return f"{KO.deco_ko(did)} ({int(m.group(2)) + 1},{int(m.group(3)) + 1})", KO.deco_role(did), 'deco', ['deco', did.split('.')[0]]
        for bid in sorted(c['bands'], key=len, reverse=True):
            if nm.startswith(bid + '.'):
                ko, role = KO.band_ko(bid)
                return f"{ko} · {KO.band_part_ko(nm[len(bid) + 1:])}", role, 'band', ['band', bid.split('.')[0]]
        raise KeyError(nm)

    def describe(self, i, pc, variant):
        if self.alpha[i] == 'blank' and PEOPLE[0] <= i <= PEOPLE[1] and not self.by_idx.get(i):
            return dict(pc=pc, label='빈 칸 (행인 자리)', role='empty', cat='people-reserve', tags=['jp-city', '빈 칸'],
                        desc='원본 시트에서 행인(Actor1) 그림이 있던 자리. 행인은 번들에서 제외해 투명 빈 칸으로 번호만 지킨다. 쓰지 않는다.')
        nms = self.by_idx.get(i)
        if not nms:
            return dict(pc=pc, label=f'미사용 원본 칸 {i}', role='unused', cat='unused-source', tags=['jp-city', '미사용'],
                        desc=f'{BL.PCNOTE[pc]}. 카탈로그 어느 이름에도 쓰이지 않는 원본 시트의 칸(번호를 지키려고 남겼다). 키트·그룹에 넣지 않는다.')
        pri = {'street': 0, 'prop': 1, 'deco': 2, 'band': 3}
        info = sorted((self.describe_name(n) + (n,) for n in nms), key=lambda t: pri[t[2]])
        label, role, kind, tags, _n = info[0]
        others = [t[0] for t in info[1:4]]
        desc = f'{BL.PCNOTE[pc]}. {label} 칸.'
        if others: desc += f" 같은 그림을 쓰는 다른 이름: {', '.join(others)}{' 외' if len(info) > 4 else ''}."
        if kind in ('band', 'deco'): desc += ' 건물은 낱칸으로 칠하지 않고 완성 예제 키트·조립 도구로 짓는다.'
        if kind == 'prop': desc += ' 소품은 키트(jp-prop-…)로 찍는다.'
        if variant: label += f' [통행 변형: {BL.PCNOTE[pc].split("(")[0].strip()}]'; desc += ' 키트에서 위치에 맞는 통행을 쓰려고 같은 그림을 복제한 칸.'
        return dict(pc=pc, label=label, role=role, cat=kind, tags=['jp-city'] + tags, desc=desc)


# ====================================================================== 칸 사전
class Cells:
    def __init__(self, pins):
        self.pins = pins
        self.img = {}
        self.info = {}
        self.order = []

    def put(self, key, img, info):
        tid = self.pins.assign(key)
        if tid in self.img:
            return tid
        self.img[tid] = img; self.info[tid] = info; self.order.append(tid)
        return tid


# ====================================================================== 블록
def load_blocks(blocks_dirs, order):
    """BLOCK_ORDER 의 이름 중 blocks_dirs(폴더 하나 또는 목록, 앞쪽 우선)에 파일이 있는 것만 불러온다. 반환 ([(이름, 모듈)], 없는 이름, 순서에 없는 디스크 블록)."""
    dirs = [blocks_dirs] if isinstance(blocks_dirs, str) else list(blocks_dirs)
    mods, missing = [], []
    for nm in order:
        p = next((os.path.join(d, nm + '.py') for d in dirs if os.path.exists(os.path.join(d, nm + '.py'))), None)
        if p is None: missing.append(nm); continue
        spec = importlib.util.spec_from_file_location('jpblock_' + nm, p)
        m = importlib.util.module_from_spec(spec); spec.loader.exec_module(m)
        assert m.BLOCK == nm, ('BLOCK 이름이 파일 이름과 다르다', nm, m.BLOCK)
        mods.append((nm, m))
    extra = sorted({f[:-3] for d in dirs if os.path.isdir(d) for f in os.listdir(d) if f.endswith('.py') and not f.startswith('_') and f[:-3] not in order})
    return mods, missing, extra


# ====================================================================== 굽기
def compose_chains(src, asm):
    """키트 한 장(asm)의 칸마다 (합성 그림, 구성 칸 번호 목록, 그림자 겹침 여부). 그림은 Kit.render 결과를 그대로 자른 것(원본)."""
    K = src.K
    R, n = asm['rows'], asm['n']
    full = K.render(asm)
    chains = [[[] for _ in range(n)] for _ in range(R)]
    for r in range(R):
        for c in range(n):
            nm = asm['cells'][r][c]
            if nm: chains[r][c].append(nm)
    for r, c, nm in asm['deco']:
        assert 0 <= r < R and 0 <= c < n, ('부착물이 키트 밖', r, c, nm)
        chains[r][c].append(nm)
    sh = asm.get('shadow')
    out = [[None] * n for _ in range(R)]
    for r in range(R):
        for c in range(n):
            im = BL.arr_norm(full[r * 16:(r + 1) * 16, c * 16:(c + 1) * 16])
            if BL.empty(im): continue
            idxs = [src.idx_of(nm) for nm in chains[r][c]]
            idxs = [i for i in idxs if i is not None and src.alpha[i] != 'blank']
            shaded = False
            if sh:
                x0, y0, x1, y1 = sh
                ix0, ix1 = max(x0, c * 16), min(x1, c * 16 + 16); iy0, iy1 = max(y0, r * 16), min(y1, r * 16 + 16)
                shaded = ix0 < ix1 and iy0 < iy1
                shrect = (ix0 - c * 16, iy0 - r * 16, ix1 - c * 16, iy1 - r * 16) if shaded else None
            out[r][c] = dict(img=im, idxs=idxs, shade=shrect if shaded else None)
    return out


def bake(out_root, dry=False, blocks_dir=BLOCKS_DIR, block_order=None, quiet=False):
    block_order = list(BLOCK_ORDER if block_order is None else block_order)
    P = paths(out_root)
    src = Src(); K = src.K; cat = src.cat
    pal = BL.load_palette(PALETTE) - {BL.MARKER}
    prev_pins = BL.load_pins(P['pins'])
    pins = BL.Pins(prev_pins)
    cells = Cells(pins)
    old_png = Image.open(P['png']).convert('RGBA') if os.path.exists(P['png']) else None
    old_def = json.load(open(P['tileset'], encoding='utf-8')) if os.path.exists(P['tileset']) else None

    # ---- 1) 기본 블록 jp16 — 원본 0..2879 번호 그대로
    for i in range(N_ORIG):
        tid = pins.assign(f'jp16/{i}')
        assert tid == i, ('jp16 번호가 원본과 다르다 — pins.json 이 망가졌다', i, tid)
        cells.put(f'jp16/{i}', src.raw_img[i], src.describe(i, src.primary[i], False))

    def raw(i, pc):
        """원본 칸 i 를 pc 로 쓰는 번호. 그 칸의 기본 pc 가 아니면 같은 그림 복제 칸."""
        if pc == src.primary[i]: return i
        return cells.put(f'jp16/{i}@{pc}', src.raw_img[i], src.describe(i, pc, True))

    n_variants_before = None
    groups = collections.OrderedDict()           # id → dict(name, role, layer, tids(set), desc, rules)

    def group(gid, name, role, layer, desc, rules):
        if gid not in groups: groups[gid] = dict(id=gid, name=name, role=role, layer=layer, ids=set(), desc=desc, rules=rules)
        return groups[gid]

    kits, kit_index, expected = [], collections.OrderedDict(), {}

    def realize(kid, name, rows_lo_up, w, h, ai, parts, learned='db-authored'):
        rows = [dict(tiles=lo, upperTiles=up) for lo, up in rows_lo_up]
        k = dict(id=kid, kind='section', name=name, width=w, height=h, tileSize=16, rows=rows, learnedFrom=learned, ai=ai)
        if parts: k['parts'] = parts
        assert kid not in kit_index, ('키트 id 중복', kid)
        kits.append(k)
        return k

    def split_rows(grid):
        """grid[y][x] = (tid, pc) | None → [(tiles, upperTiles)]. 아래층 pc(floor·solidfloor)만 tiles."""
        out = []
        for row in grid:
            lo = [-1] * len(row); up = [-1] * len(row)
            for x, it in enumerate(row):
                if it is None: continue
                tid, pc = it
                if pc in BL.LOWER_PC: lo[x] = tid
                else: up[x] = tid
            out.append((lo, up))
        return out

    def pc_summary(grid):
        cnt = collections.Counter(pc for row in grid for it in row if it for pc in [it[1]])
        return cnt

    # ---- 2) 건물 레시피 키트 (22 + L자 3)
    def building_kit(kid, name, asm, spec_desc, expect_img, is_l):
        R, n = asm['rows'], asm['n']
        ch = compose_chains(src, asm)
        if is_l: doors = list(asm['doors'])
        else: doors = [(R - 1, c) for c in asm['door_cols']]
        doorset = set(doors)
        grid = [[None] * n for _ in range(R)]
        comp_used = 0
        for r in range(R):
            for c in range(n):
                e = ch[r][c]
                if e is None: continue
                w_ = asm['walk'][r][c]; lay = asm['layer'][r][c]
                if (r, c) in doorset: pc = 'solid'
                elif w_ == 'S': pc = 'solid'
                elif w_ == 'C': pc = 'star'
                elif w_ == 'F' and lay == 'lo': pc = 'floor' if BL.alpha_class(e['img']) == 'opaque' else 'flat'
                else: raise AssertionError(('알 수 없는 walk', kid, r, c, w_, lay))
                if len(e['idxs']) == 1 and e['shade'] is None and BL.same_image(e['img'], src.raw_img[e['idxs'][0]]):
                    tid = raw(e['idxs'][0], pc)
                else:
                    key = 'jp16c/' + '+'.join(str(i) for i in e['idxs']) + ('|sh%d.%d.%d.%d' % e['shade'] if e['shade'] else '') + '@' + pc
                    first = f'{name} · 겹쳐 구운 칸'
                    tid = cells.put(key, e['img'], dict(pc=pc, label=f'{first} ({c + 1},{r + 1})', role='building', cat='composite', tags=['jp-city', 'composite', '건물'],
                                                        desc=f'{BL.PCNOTE[pc]}. 키트 {kid} 안에서 벽 칸에 문·간판·창·그림자를 겹쳐 구운 칸(구성 원본 칸 {" + ".join(str(i) for i in e["idxs"])}). 키트로만 찍는다(낱칸으로 칠하지 않는다).'))
                    comp_used += 1
                grid[r][c] = (tid, pc)
        # 부위: 문(입구), 간판
        parts = []
        rowdoors = collections.defaultdict(list)
        for r, c in doors: rowdoors[r].append(c)
        for k_, (r, cs) in enumerate(sorted(rowdoors.items())):
            cs = sorted(cs)
            parts.append(dict(id='door' if len(rowdoors) == 1 else f'door{k_ + 1}', kind='entrance', dx=cs[0], dy=r, w=len(cs), h=1,
                              note='문 칸(그림) — 문 칸 자체는 막힘, 바로 아래 한 줄(접근 칸)이 문 앞에 서는 자리'))
        sg = collections.OrderedDict()
        for r, c, nm in asm['deco']:
            m = re.match(r'^deco\.(.+)\.c(\d+)\.r(\d+)$', nm)
            if not m or m.group(1).split('.')[0] not in SIGN_DECOS: continue
            sg.setdefault((m.group(1), r - int(m.group(3)), c - int(m.group(2))), []).append((r, c))
        for k_, ((did, r0, c0), pts) in enumerate(sg.items()):
            rs = [p[0] for p in pts]; cs = [p[1] for p in pts]
            parts.append(dict(id=f'sign{k_ + 1}', kind='sign', dx=min(cs), dy=min(rs), w=max(cs) - min(cs) + 1, h=max(rs) - min(rs) + 1, note=KO.deco_ko(did)))
        access = [dict(dx=c, dy=r + 1) for r, c in sorted(doors)]
        floors = len(spec_desc['floors']) if 'floors' in spec_desc else None
        pcs = pc_summary(grid)
        ground = spec_desc.get('ground')
        desc = (f"{name} — 폭 {n}칸 × 높이 {R}칸 일본 상가 건물 완성 예제{'(L자: 본채 + 앞으로 튀어나온 별채·마당)' if is_l else ''}. "
                f"1층 {KO.band_ko(ground)[0] if ground else ''}, 윗층 {floors if floors is not None else '여러'}개. 문 칸은 막힘, 지면 층 아래 두 줄은 막힘, 윗층·처마·옥상은 ★(걸어 지나감). "
                f"접근 칸(문 앞)은 키트 바깥 한 줄 아래{'' if not is_l else '(본채 문은 키트 안 마당 줄)'}: " + ', '.join(f"({a['dx']},{a['dy']})" for a in access) + '.')
        rules = ('보도·도로 위 위층에 찍는다. 문 바로 아래 한 줄(접근 칸)이 걸을 수 있는 바닥이어야 한다. 뒷줄 건물은 앞줄 건물보다 먼저 찍는다. '
                 '키트 하나가 건물 한 채(칸 낱개로 칠하지 않는다). 폭·층수를 바꾼 건물은 조립 도구로 짓는다.')
        ai = dict(description=desc[:400], placementRules=rules, tags=['jp-city', 'building', '일본 상가', name], role='building', repeatability='fixed',
                  layerHome='upper', themes=['일본 도시'], origin='ai', confidence='high', access=access)
        k = realize(kid, name, split_rows(grid), n, R, ai, parts)
        expected[kid] = expect_img
        tids = {it[0] for row in grid for it in row if it}
        kit_index[kid] = dict(kind='recipe-L' if is_l else 'recipe', name=name, w=n, h=R, source=dict(catalog='recipes' if not is_l else 'lRecipes', id=kid.replace('jp-recipe-', '')),
                              door=dict(cells=[dict(dx=p['dx'], dy=p['dy'], w=p['w']) for p in parts if p['kind'] == 'entrance']), anchor=dict(dx=0, dy=R - 1, note='왼쪽 아래 칸 = 건물 발'),
                              access=access, layer='upper', cells=len(tids), composite_cells=comp_used, pc=dict(pcs))
        return tids

    def rid(s): return re.sub(r'[._]', '-', s).lower()
    RECIPE_KO = {'izakaya_tower': '이자카야 타워', 'konbini_block': '편의점 블록', 'garage_flats': '차고 아파트', 'shutter_office': '셔터 사무소',
                 'setback_shop': '셋백 점포', 'narrow_shutter': '좁은 셔터 점포', 'wide_konbini': '넓은 편의점', 'izakaya_alt': '이자카야 (벽돌)',
                 'garage_tall': '차고 고층', 'big_setback': '큰 셋백 건물', 'machiya_izakaya': '마치야 이자카야', 'sushi_bar': '초밥집', 'ramen_tower': '라멘 타워',
                 'bento_corner': '도시락 가게', 'sento_front': '대중목욕탕 정면', 'danchi_flats': '단지 아파트', 'bar_row': '술집 거리 건물', 'office_shutter': '셔터 사무소 (큰)',
                 'mansion_veranda': '베란다 맨션', 'office_slide': '미닫이창 사무소', 'mixed_tenant': '복합 임대 건물', 'slim_tower': '가는 타워',
                 'L_office_cafe': 'L자 사무소 + 카페', 'L_machiya_annex': 'L자 마치야 + 별채', 'L_flats_lot': 'L자 아파트 + 주차장'}
    recipe_tids = {}
    for rn, spec in cat['recipes'].items():
        asm = K.assemble(spec)
        recipe_tids[rn] = building_kit(f'jp-recipe-{rid(rn)}', f'건물 · {RECIPE_KO[rn]}', asm, spec, Image.fromarray(K.render(asm)), False)
    for rn, spec in cat['lRecipes'].items():
        asm = K.assemble_L(spec)
        recipe_tids[rn] = building_kit(f'jp-recipe-{rid(rn)}', f'건물 · {RECIPE_KO[rn]}', asm, spec['main'], Image.fromarray(K.render(asm)), True)

    # ---- 3) 문 부착물 9종 키트
    for did, d in cat['decos'].items():
        if not did.startswith('door.'): continue
        w, h = d['w'], d['h']
        grid = [[None] * w for _ in range(h)]
        for r in range(h):
            for c in range(w):
                i = src.idx_of(d['cells'][r][c])
                if i is None or src.alpha[i] == 'blank': continue
                pc = deco_row_pc(did, r, h); grid[r][c] = (raw(i, pc), pc)
        kid = 'jp-door-' + did[5:]
        ko = KO.deco_ko(did)
        access = [dict(dx=c, dy=h) for c in range(w)]
        desc = f'{ko} {w}×{h}칸 문 부착물. 건물 지면 층 아래 3줄의 문 자리에 겹쳐 찍는다. 맨 아래 두 줄은 막힘(문 칸), 윗줄은 ★. 문 앞 접근 칸은 키트 바깥 한 줄 아래.'
        ai = dict(description=desc, placementRules='건물 지면 층(3줄) 위에 문 열 폭만큼 겹쳐 찍는다(위층). 문 아래 한 줄은 걸을 수 있는 바닥(보도)이어야 한다.',
                  tags=['jp-city', 'door', ko], role='building', repeatability='fixed', layerHome='upper', themes=['일본 도시'], origin='ai', confidence='high', access=access)
        parts = [dict(id='door', kind='entrance', dx=0, dy=h - 1, w=w, h=1, note='문 칸 — 막힘, 바로 아래 한 줄이 접근 칸')]
        realize(kid, f'문 · {ko}', split_rows(grid), w, h, ai, parts)
        expected[kid] = Image.fromarray(K.cell_arr_deco(did))
        kit_index[kid] = dict(kind='door', name=f'문 · {ko}', w=w, h=h, source=dict(catalog='decos', id=did), door=dict(cells=[dict(dx=0, dy=h - 1, w=w)]),
                              anchor=dict(dx=0, dy=h - 1, note='왼쪽 아래 칸'), access=access, layer='upper', cells=len({it[0] for row in grid for it in row if it}), pc=dict(pc_summary(grid)))

    # ---- 4) 소품 키트 142
    PROPCAT_RULE = {c: v[2] for c, v in KO.PROP_CAT_KO.items()}
    prop_group_ids = collections.defaultdict(set)
    for pn, p in cat['props'].items():
        w, h = p['w'], p['h']
        grid = [[None] * w for _ in range(h)]
        for r in range(h):
            for c in range(w):
                i = src.idx_of(p['cells'][r][c])
                if i is None: continue
                pc = prop_pc(p['walk'][r][c], p['layer'][r][c], src.alpha[i])
                if pc: grid[r][c] = (raw(i, pc), pc)
        kid = 'jp-prop-' + rid(pn)
        var = KO.prop_variant_ko(pn)
        name = f"{p['desc']}{' · ' + var if var else ''}"
        pcs = pc_summary(grid); pcat = KO.prop_cat(pn); prole = KO.prop_role(pn)
        notes = []
        if pcs.get('solid') or pcs.get('solidfloor'): notes.append('막힌 칸(밑동·몸체)')
        if pcs.get('star'): notes.append('★ 칸(걸어 지나감·사람 위에 그려짐)')
        if pcs.get('flat') or pcs.get('floor'): notes.append('아래층 칸(걸어 지나감·사람 밑)')
        desc = f"{name} {w}×{h}칸 키트. {', '.join(notes)}. {PROPCAT_RULE[pcat]}"
        ai = dict(description=desc[:400], placementRules='바닥(보도·도로·잔디) 위에 키트 하나로 찍는다(낱칸으로 칠하지 않는다). 막힌 칸이 길을 막지 않는 자리에 둔다.',
                  tags=['jp-city', 'prop', name, pn], role=prole, repeatability='fixed', layerHome='upper', themes=['일본 도시'], origin='ai', confidence='high')
        realize(kid, name, split_rows(grid), w, h, ai, [])
        expected[kid] = Image.fromarray(K.prop_image(pn))
        tids = {it[0] for row in grid for it in row if it}
        prop_group_ids[pcat] |= tids
        kit_index[kid] = dict(kind='prop', name=name, w=w, h=h, source=dict(catalog='props', id=pn), door=None, anchor=dict(dx=w // 2, dy=h - 1, note='아래 줄 가운데 = 발밑'),
                              access=[], layer='upper', cells=len(tids), category=pcat, pc=dict(pcs))

    # ---- 5) 블록 병합
    mods, missing_blocks, extra_blocks = load_blocks(blocks_dir, block_order)
    block_info = []; built = {}
    local2tid = {}                # (블록, local) → tid
    pending_autotiles = []
    pending_groups = []
    pending_kits = []
    block_group_role = {}
    for bname, mod in mods:
        B = mod.build(); built[bname] = B
        # 그룹 role 먼저(칸 role 에 쓴다)
        crole = {}
        for g in B.get('groups', []):
            for loc in g['cells']: crole.setdefault(loc, g['role'])
        for loc, c in B['cells'].items():
            im = c['img']
            assert im.size == (16, 16), (bname, loc, im.size)
            im = BL.norm(im); assert c['pc'] in BL.PC, (bname, loc, c['pc'])
            tid = cells.put(f'{bname}/{loc}', im, dict(pc=c['pc'], label=c['label'], role=crole.get(loc, 'detail'), cat='block:' + bname, tags=list(c.get('tags', [])), desc=c['desc']))
            local2tid[(bname, loc)] = tid
        for a in B.get('autotiles', []): pending_autotiles.append((bname, a))
        for g in B.get('groups', []): pending_groups.append((bname, g))
        for k in B.get('kits', []): pending_kits.append((bname, k))
        block_info.append(dict(name=bname, cells=len(B['cells']), autotiles=len(B.get('autotiles', [])), groups=len(B.get('groups', [])), kits=len(B.get('kits', [])), notes=B.get('notes', '')))
    L = lambda b, loc: local2tid[(b, loc)]
    extra_conn = {}                # 오토타일 id → 다른 블록이 덧붙이는 연결 칸(키트용 복사 칸)
    for bname, B in built.items():
        for aid, locs in (B.get('connect_extra') or {}).items(): extra_conn.setdefault(aid, []).extend(L(bname, x) for x in locs)
    autotiles, at_members = [], {}
    for b, a in pending_autotiles: at_members[a['id']] = [L(b, x) for x in a['member']]
    for b, a in pending_autotiles:
        mem = [L(b, x) for x in a['member']]
        conn = []
        for x in a.get('connect') or []:
            if isinstance(x, str) and x.startswith('other:'): conn += at_members[x[6:]]
            else: conn.append(L(b, x))
        conn = sorted(set(conn) | set(mem)) if not a.get('connect') else sorted(set(conn))
        conn = sorted(set(conn) | set(extra_conn.get(a['id'], [])))
        vm = {str(k): L(b, a['variantMap'][str(k)]) for k in range(16 if a['neighborhood'] == 4 else 256)}
        assert len(a['variantMap']) == len(vm), ('variantMap 키 수', a['id'])
        at = dict(id=a['id'], name=a['name'], neighborhood=a['neighborhood'], memberTileIds=sorted(set(mem)), connectTileIds=conn, variantMap=vm, layer=a['layer'], edgeConnects=bool(a.get('edgeConnects')))
        if a.get('interior'): at['interiorVariants'] = [[L(b, x) for x in lst] for lst in a['interior']]
        autotiles.append(at)
    block_groups = []
    for b, g in pending_groups:
        tids = sorted({L(b, x) for x in g['cells']})
        role = BLOCK_ROLE.get(g['role'], 'terrain')
        block_groups.append(dict(id=g['id'], name=g['name'], role=role, defaultLayer=g['defaultLayer'], tileIds=tids, description=g['desc'], placementRules=g['rules'] or g['desc'],
                                 source='bundled-default', confidence='high', layerHome=g['defaultLayer'] if g['defaultLayer'] in ('lower', 'upper') else 'perCell'))
    for b, k in pending_kits:
        g_up, g_lo = k['grid'], k.get('base')
        h = len(g_up); w = len(g_up[0])
        rows = []
        for y in range(h):
            up = [L(b, g_up[y][x]) if g_up[y][x] is not None else -1 for x in range(w)]
            lo = [L(b, g_lo[y][x]) if g_lo and g_lo[y][x] is not None else -1 for x in range(w)]
            rows.append((lo, up))
        parts = [dict(id=f"{p['kind']}{i + 1}", kind=p['kind'], dx=p['x'], dy=p['y'], w=p['w'], h=p['h'], note=p.get('label', '')) for i, p in enumerate(k.get('parts', []))]
        a = k.get('ai', {})
        ai = dict(description=a.get('description', k['name']), placementRules=a.get('placementRules', '키트 하나로 찍는다.'), tags=list(a.get('tags', [])), role=a.get('role', 'prop'),
                  repeatability=a.get('repeatability', 'fixed'), layerHome='upper', themes=['일본 도시'], origin='ai', confidence='high')
        if a.get('growthAxis'): ai['growthAxis'] = GROWTH[a['growthAxis']]
        if a.get('snap'): ai['snap'] = SNAP[a['snap']]
        if a.get('anchor'): ai['anchor'] = a['anchor']
        if a.get('access'): ai['access'] = [dict(dx=q['x'], dy=q['y']) for q in a['access']]
        realize(k['id'], k['name'], rows, w, h, ai, parts)
        # 기대 그림: 블록 칸 그림 그대로 아래층 → 위층 겹침
        exp = Image.new('RGBA', (w * 16, h * 16), (0, 0, 0, 0))
        bc = built[b]['cells']
        for y in range(h):
            for x in range(w):
                for lay in (g_lo, g_up):
                    nm = lay[y][x] if lay else None
                    if nm is None: continue
                    cimg = bc[nm]['img'].convert('RGBA'); reg = exp.crop((x * 16, y * 16, x * 16 + 16, y * 16 + 16)); reg.alpha_composite(cimg); exp.paste(reg, (x * 16, y * 16))
        expected[k['id']] = exp
        kit_index[k['id']] = dict(kind='block-kit', name=k['name'], w=w, h=h, source=dict(block=b), door=None, anchor=a.get('anchor'), access=ai.get('access', []), layer='upper',
                                  cells=len({t for lo, up in rows for t in lo + up if t >= 0}))

    # ---- 6) 그룹
    # 6a) 거리 바닥(분류별)
    scat = collections.OrderedDict()
    for sn, nm in cat['street'].items():
        i = src.idx_of(nm); ko, c_ = KO.street_ko(sn)
        scat.setdefault(c_, []).append(i)
    for c_, idxs in scat.items():
        ko, desc, role = KO.STREET_CAT[c_]
        g = group(f'jp:street:{c_}', f'거리 · {ko}', role, 'lower' if c_ != 'guard' else 'upper', f'{ko} — 일본 상가 거리 키트의 거리 바닥 칸. {desc}', desc + ' 낱칸으로 칠한다(오토타일 세트가 있는 지면은 오토타일이 우선).')
        g['ids'] |= {raw(i, src.primary[i]) for i in idxs}
    # 6b) 건물 띠
    for bid, rec in cat['bands'].items():
        ko, role = KO.band_ko(bid)
        idxs = {src.idx_of(nm) for nm, r in band_cells(rec)} - {None}
        rule = ('건물 층 띠: 왼쪽 끝(L) + 몸통 칸 반복 + 오른쪽 끝 2칸(R0·R1) 순서로 이어 폭을 만든다(2줄 높이). 낱칸으로 칠하지 않고 완성 예제 키트(jp-recipe-…)나 조립 도구로 짓는다.'
                if bid.startswith('fl.') else '건물 띠 부품. 낱칸으로 칠하지 않고 완성 예제 키트(jp-recipe-…)나 조립 도구로 짓는다.')
        g = group(f'jp:band:{bid}', f'건물 띠 · {ko}', role if role in ('wall', 'roof', 'building', 'prop') else 'wall', 'upper', f'{ko} — 일본 상가 건물 부품 띠 {rec["rows"]}줄 높이. 위층 칸.', rule)
        g['ids'] |= {raw(i, src.primary[i]) for i in idxs if src.alpha[i] != 'blank'}
    # 6c) 부착물
    for did, d in cat['decos'].items():
        ko = KO.deco_ko(did)
        idxs = {src.idx_of(d['cells'][r][c]) for r in range(d['h']) for c in range(d['w'])} - {None}
        rule = ('문 부착물: 건물 지면 층 아래 3줄에 겹쳐 찍는다(문 키트 jp-door-…). 문 칸은 막힘.' if did.startswith('door.') else '건물 벽 위에 겹쳐 붙이는 투명 부착물(위층). 낱칸이 아니라 한 덩이로 붙인다.')
        g = group(f'jp:deco:{did}', f'부착물 · {ko}', KO.deco_role(did) if KO.deco_role(did) == 'building' else 'prop', 'upper', f'{ko} {d["w"]}×{d["h"]}칸 부착물.', rule)
        g['ids'] |= {raw(i, src.primary[i]) for i in idxs if src.alpha[i] != 'blank'}
    # 6d) 소품 분류
    for pcat, tids in prop_group_ids.items():
        ko, role, desc = KO.PROP_CAT_KO[pcat]
        g = group(f'jp:prop:{pcat}', f'소품 · {ko}', role, 'upper', f'{ko} 소품 칸 모음. {desc}', '소품은 낱칸으로 칠하지 않고 키트(jp-prop-…)로 찍는다.')
        g['ids'] |= tids

    # ---- 7) 번호 마무리 · legacy
    count = pins.next_id
    assert math.ceil(count / TPR) * 16 <= BL.MAX_H, ('시트 높이 4096px 초과', count)
    legacy = [t for t in range(count) if t not in cells.img]
    for t in legacy:
        if old_png is not None and (t % TPR + 1) * 16 <= old_png.width and (t // TPR + 1) * 16 <= old_png.height:
            cells.img[t] = BL.norm(BL.read_cell(old_png, t))
        else:
            cells.img[t] = Image.new('RGBA', (16, 16), (0, 0, 0, 0))
    sheet_img = BL.render_sheet(cells.img, count)

    # ---- 8) 정의 JSON
    SOLID = dict(up=False, down=False, left=False, right=False); PASS = dict(up=True, down=True, left=True, right=True)
    passability, priority, terrain, tile_meta = [], [], [], []
    for tid in range(count):
        inf = cells.info.get(tid)
        if inf is None:
            if old_def and tid < old_def['count']:
                passability.append(old_def['passability'][tid]); priority.append(old_def['priority'][tid]); terrain.append(0)
                m = dict(old_def['tileMeta'][tid])
                if not m.get('description', '').startswith('옛 굽기 칸'): m['description'] = '옛 굽기 칸(번호 고정용) — 지금은 쓰지 않는다. ' + m.get('description', '')
                tile_meta.append(m)
            else:
                passability.append(dict(SOLID)); priority.append('lower'); terrain.append(0)
                tile_meta.append(dict(label='옛 굽기 칸', description='옛 굽기 칸(번호 고정용) — 지금은 쓰지 않는다.', source='bundled-default'))
            continue
        prio, passable, passage, home = BL.PC[inf['pc']]
        passability.append(dict(PASS) if passable else dict(SOLID)); priority.append(prio); terrain.append(0)
        meta = dict(label=inf['label'], description=inf['desc'], role=inf['role'], passage=passage, defaultLayer=home, tags=list(inf['tags']), source='bundled-default',
                    confidence='high', repeatability='repeat' if inf['pc'] == 'floor' else 'fixed')
        if inf['pc'] == 'flat': meta['locked'] = True; meta['layerBacking'] = 'none'; meta['description'] += ' 투명 덧그림: 붓은 위층, 캐릭터 밑에 그린다.'
        elif home == 'upper': meta['layerBacking'] = 'none'
        tile_meta.append(meta)
    tile_groups = []
    for g in groups.values():
        tile_groups.append(dict(id=g['id'], name=g['name'], role=g['role'], defaultLayer=g['layer'], tileIds=sorted(g['ids']), description=g['desc'], placementRules=g['rules'],
                                source='bundled-default', confidence='high', layerHome=g['layer']))
    tile_groups += block_groups
    # 그룹 층은 선언값이 아니라 멤버 칸의 엔진 홈에서 유도한다(bake_lib.derive_group_layer) — 선언과 칸 홈이 어긋난 74+103칸 정정.
    for g in tile_groups:
        was = g['defaultLayer']
        g['defaultLayer'], g['layerHome'] = BL.derive_group_layer(was, g['tileIds'], priority, tile_meta)
        if was == 'lower' and g['defaultLayer'] == 'upper':
            # 투명 덧그림 그룹: 엔진 홈이 위층이라 fill_region(면 채우기 재료 아님)은 거부된다(tileVocabulary.isFlatFillGroup). 갈 길을 규칙에 적는다.
            g['placementRules'] += ' 투명 덧그림이라 엔진 홈은 위층 — fill_region 재료가 아니다. paint_tiles layer "2"(2층)로 칠한다.'
    kit_order = [k for k in kits if k['id'].startswith('jp-recipe-')] + [k for k in kits if k['id'].startswith('jp-door-')] + [k for k in kits if k['id'].startswith('jp-prop-')] \
        + [k for k in kits if not k['id'].startswith(('jp-recipe-', 'jp-door-', 'jp-prop-'))]
    data = collections.OrderedDict(id=ID, name=NAME, textureKey=TEXTURE, family=FAMILY, tileSize=16, tilesPerRow=TPR, count=count, libraryEnd=count,
                                   passability=passability, priority=priority, terrain=terrain, tileMeta=tile_meta, tileGroups=tile_groups, autotileGroups=autotiles,
                                   animationStrips=[], structureKits=kit_order)

    # ---- 9) 검증
    res = collections.OrderedDict()
    cat_counts = collections.Counter(i['cat'].split(':')[0] if i['cat'].startswith('block') else i['cat'] for i in cells.info.values())
    n_var = sum(1 for k in pins.used if re.search(r'^jp16/\d+@', k)); n_comp = sum(1 for k in pins.used if k.startswith('jp16c/'))
    n_block = sum(1 for k in pins.used if not k.startswith('jp16'))
    res['tiles'] = dict(count=count, tilesPerRow=TPR, rows=math.ceil(count / TPR), sheetPx=[TPR * 16, math.ceil(count / TPR) * 16], height_ok=math.ceil(count / TPR) * 16 <= BL.MAX_H,
                        original=N_ORIG, pc_variant_copies=n_var, composite_cells=n_comp, block_cells=n_block, legacy=len(legacy), legacy_ids=legacy[:20],
                        unused_source=sum(1 for t, i in cells.info.items() if i['cat'] == 'unused-source'), people_reserved=sum(1 for t, i in cells.info.items() if i['cat'] == 'people-reserve'),
                        by_category=dict(cat_counts))
    res['pc_counts'] = dict(collections.Counter(i['pc'] for i in cells.info.values()))
    kk = collections.Counter(v['kind'] for v in kit_index.values())
    res['kits'] = dict(total=len(kits), by_kind=dict(kk), prop=kk['prop'], recipe=kk['recipe'], recipe_L=kk['recipe-L'], door=kk['door'], block_kit=kk['block-kit'])
    gk = collections.Counter(g['id'].split(':')[1] if g['id'].count(':') >= 2 else 'block' for g in tile_groups)
    res['groups'] = dict(total=len(tile_groups), by_kind=dict(gk))
    res['autotiles'] = dict(total=len(autotiles), ids=[a['id'] for a in autotiles])
    res['blocks'] = dict(order=block_order, merged=[b['name'] for b in block_info], missing=missing_blocks, on_disk_not_in_order=extra_blocks, detail=block_info)
    # 재조립 픽셀 일치 (메모리 시트 → 정의로 다시 조립해 원본과 비교)
    res['reassembly'] = verify_reassembly(sheet_img, data['structureKits'], expected)
    res['definition_checks'] = BL.check_definition(data)
    # 원본 2880칸이 48열로 옮겨져도 같은 그림인가
    diff = [i for i in range(N_ORIG) if not BL.same_image(BL.read_cell(sheet_img, i), src.raw_img[i])]
    res['relayout_identical'] = dict(cells=N_ORIG, mismatched=len(diff), ids=diff[:10])
    # 팔레트·알파
    offs = {}; partial = 0; marker = 0
    for t in range(count):
        a = np.asarray(cells.img[t]); alpha = a[:, :, 3]
        partial += int(((alpha != 0) & (alpha != 255)).sum())
        vis = a[alpha > 0][:, :3]
        marker += int((vis == np.array(BL.MARKER)).all(-1).sum())
        o = BL.off_palette(cells.img[t], pal)
        if o: offs[t] = o
    res['palette'] = dict(allowed_colors=len(pal), cells_with_off_palette=len(offs), off_palette_examples={str(t): {('#%02x%02x%02x' % c): n for c, n in o.items()} for t, o in list(offs.items())[:5]},
                          marker_pixels=marker, partial_alpha_pixels=partial)
    res['sheet_hash'] = hashlib.sha1(sheet_img.tobytes()).hexdigest()
    res['pc_rule'] = 'tiledata/jp-city/bake/PC-RULES.md'
    pins_out = dict(version=1, tilesPerRow=TPR, count=count, cells={k: v for k, v in sorted(pins.map.items(), key=lambda kv: kv[1])})
    out = dict(data=data, sheet_img=sheet_img, count=count, pins=pins_out, kit_index=kit_index, report=res, expected=expected)
    if dry: return out
    for p in P.values(): os.makedirs(os.path.dirname(p), exist_ok=True)
    sheet_img.save(P['png'], optimize=True)
    wr = lambda path, obj, **kw: open(path, 'w', encoding='utf-8').write(json.dumps(obj, ensure_ascii=False, **kw) + '\n')
    wr(P['tileset'], data, separators=(',', ':'))
    wr(P['sheet'], dict(count=count, tilesPerRow=TPR), separators=(',', ': '))
    wr(P['pins'], pins_out, separators=(',', ':'))
    wr(P['kits'], dict(version=1, tileset=ID, tileSize=16, tilesPerRow=TPR, count=count, kits=kit_index), separators=(',', ':'))
    open(P['pcrules'], 'w', encoding='utf-8').write(PC_RULES_MD)
    # 파일에서 다시 읽어 한 번 더
    sheet2 = Image.open(P['png']).convert('RGBA'); d2 = json.load(open(P['tileset'], encoding='utf-8'))
    res['reassembly_from_files'] = verify_reassembly(sheet2, d2['structureKits'], expected)
    res['definition_checks_from_files'] = BL.check_definition(d2)
    res['files'] = {k: os.path.relpath(v, out_root) for k, v in P.items()}
    wr(P['report'], res, indent=1)
    return out


def verify_reassembly(sheet_img, kits, expected):
    bad = []; px_bad = 0; kinds = collections.Counter()
    for k in kits:
        got = BL.reassemble(k, sheet_img); exp = expected[k['id']]
        kinds[k['id'].split('-')[1] if k['id'].startswith('jp-') else 'block'] += 1
        if not BL.same_image(got, exp):
            bad.append(k['id'])
            a = np.asarray(got).astype(int); b = np.asarray(BL.norm(exp)).astype(int)
            px_bad += int((a != b).any(-1).sum()) if a.shape == b.shape else a.shape[0] * a.shape[1]
    return dict(kits_checked=len(kits), by_kind=dict(kinds), mismatched_kits=len(bad), mismatched_pixels=px_bad, mismatched_ids=bad[:12])


# ====================================================================== 자체 시험
FAKE_BLOCK = '''BLOCK = "zz_fake"
from PIL import Image
def build():
    cells = {}
    for i in range(3):
        im = Image.new("RGBA", (16, 16), (0, 0, 0, 0))
        for x in range(16):
            for y in range(16):
                if (x + y + i) % 3 == 0: im.putpixel((x, y), (0x21, 0x1f, 0x26, 255))
        cells["f%d" % i] = dict(img=im, pc="floor", label="가짜 %d" % i, desc="자체 시험용", tags=["fake"])
    return dict(cells=cells, autotiles=[], groups=[], kits=[], notes="selftest")
'''


def selftest():
    """같은 입력 → 같은 바이트, 가짜 블록 추가(맨 앞) → 앞 번호 불변, 블록 빼기 → legacy 보존·다시 넣으면 같은 번호. 임시 폴더에서만."""
    tmp = tempfile.mkdtemp(prefix='jp-bake-'); r = {}
    try:
        P = paths(tmp)
        read = lambda: {k: open(v, 'rb').read() for k, v in P.items() if k != 'report'}
        bake(tmp, quiet=True); a = read()
        bake(tmp, quiet=True); b = read()
        r['rebake_identical'] = {k: a[k] == b[k] for k in a}; r['rebake_all_identical'] = all(a[k] == b[k] for k in a)
        old_pins = json.load(open(P['pins']))['cells']; old_def = json.load(open(P['tileset']))
        sheet_a = Image.open(P['png']).convert('RGBA')
        # 가짜 블록(맨 앞)
        fb = os.path.join(tmp, 'fakeblocks'); os.makedirs(fb)
        open(os.path.join(fb, 'zz_fake.py'), 'w').write(FAKE_BLOCK)
        both = [fb, BLOCKS_DIR]
        bake(tmp, blocks_dir=both, block_order=['zz_fake'] + BLOCK_ORDER, quiet=True)
        new_pins = json.load(open(P['pins']))['cells']; new_def = json.load(open(P['tileset']))
        moved = [k for k, v in old_pins.items() if new_pins.get(k) != v]
        sheet_b = Image.open(P['png']).convert('RGBA')
        same = all(BL.read_cell(sheet_a, t).tobytes() == BL.read_cell(sheet_b, t).tobytes() for t in range(old_def['count']))
        kit_changed = [k['id'] for k in old_def['structureKits'] if (next((x for x in new_def['structureKits'] if x['id'] == k['id']), {}) or {}).get('rows') != k['rows']]
        r['add_block'] = dict(old_count=old_def['count'], new_count=new_def['count'], added_cells=new_def['count'] - old_def['count'], pinned_moved=len(moved), kits_changed=len(kit_changed),
                              old_cell_pixels_unchanged=same, new_ids_start_at=min(new_pins[k] for k in new_pins if k.startswith('zz_fake/')),
                              pass_=bool(not moved and not kit_changed and same and new_def['count'] == old_def['count'] + 3))
        # 블록 하나 빼기 → legacy 로 보존
        bake(tmp, blocks_dir=BLOCKS_DIR, block_order=['autotiles_ground'], quiet=True)
        d3 = json.load(open(P['tileset'])); s3 = Image.open(P['png']).convert('RGBA'); p3 = json.load(open(P['pins']))['cells']
        lost_ids = [v for k, v in new_pins.items() if k.startswith('autotiles_lines/') or k.startswith('zz_fake/')]
        keep = all(BL.read_cell(s3, t).tobytes() == BL.read_cell(sheet_b, t).tobytes() for t in lost_ids)
        r['remove_block'] = dict(count_unchanged=d3['count'] == new_def['count'], pins_unchanged=(p3 == new_pins), legacy_pixels_kept=keep, legacy_cells=len(lost_ids),
                                 pass_=bool(d3['count'] == new_def['count'] and p3 == new_pins and keep))
        bake(tmp, blocks_dir=both, block_order=['zz_fake'] + BLOCK_ORDER, quiet=True)
        d4 = json.load(open(P['tileset'])); r['readd_block'] = dict(identical_to_before_remove=(d4 == new_def), pass_=(d4 == new_def))
    finally:
        shutil.rmtree(tmp, ignore_errors=True)
    r['pass'] = bool(r['rebake_all_identical'] and r['add_block']['pass_'] and r['remove_block']['pass_'] and r['readd_block']['pass_'])
    return r


def main():
    ap = argparse.ArgumentParser(description='일본 도시 타일셋(jp_city) 굽기')
    ap.add_argument('--dry', action='store_true', help='파일을 쓰지 않고 칸·키트·검증 숫자만 계산한다')
    ap.add_argument('--selftest', action='store_true', help='다시 굽기 동일·가짜 블록 추가 시 번호 불변을 임시 폴더에서 시험하고 bake-report.json 에 기록')
    ap.add_argument('--out-root', default=ROOT, help='산출물 루트(기본 저장소 루트)')
    a = ap.parse_args()
    out = bake(a.out_root, dry=a.dry)
    rep = out['report']
    if a.selftest:
        rep['selftest'] = selftest()
        if not a.dry: open(paths(a.out_root)['report'], 'w', encoding='utf-8').write(json.dumps(rep, ensure_ascii=False, indent=1) + '\n')
    keys = ('tiles', 'pc_counts', 'kits', 'groups', 'autotiles', 'blocks', 'reassembly', 'definition_checks', 'relayout_identical', 'palette')
    summ = {k: rep[k] for k in keys if k in rep}
    summ['blocks'] = {k: v for k, v in rep['blocks'].items() if k != 'detail'}
    if 'selftest' in rep: summ['selftest'] = rep['selftest']
    print(json.dumps(summ, ensure_ascii=False, indent=1, default=str))
    bad = (rep['reassembly']['mismatched_kits'] or rep['definition_checks']['violations'] or rep['relayout_identical']['mismatched'] or rep['palette']['cells_with_off_palette']
           or rep['palette']['marker_pixels'] or rep['palette']['partial_alpha_pixels'] or not rep['tiles']['height_ok'] or ('selftest' in rep and not rep['selftest']['pass']))
    if bad: print('검증 실패', file=sys.stderr); sys.exit(1)


if __name__ == '__main__': main()
