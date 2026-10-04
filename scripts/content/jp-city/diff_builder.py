#!/usr/bin/env python3
"""jp_city 건물 조립기 차이 증명 — Python 원본 `jpstreet.Kit`(lib/jpstreet.py)이 같은 입력에서 내놓는 칸 배열을 JSON 으로 덤프하고(이 파일),
TS 조립기(src/editor/jpCity/builder.ts)가 내놓는 칸 배열과 칸 하나하나 비교한다(diff_builder.mjs). 한 번에 돌리는 법:

  node scripts/content/jp-city/diff_builder.mjs                 # 덤프(이 파일 호출) → TS 조립 → 비교 → 렌더 픽셀 비교까지

  python3 scripts/content/jp-city/diff_builder.py dump  OUT.json   # 입력 + 정답(Python 원본) 덤프
  python3 scripts/content/jp-city/diff_builder.py render TS_OUT.json  # TS 가 정한 칸 층(아래·위·덧)을 시트로 합성해 Kit.render 와 픽셀 비교

정답은 부품 사전(bake_spec.py)과 **독립으로** 계산한다: 칸 이름 → 원본 칸 번호(catalog names) → 굽기 칸 번호(pins.json 의 `jp16/<번호>@<pc>` 복제 칸),
통행 종류(pc)는 Python 이 조립한 walk 격자(S·F → 막힘, C → ★)와 부착물 줄(deco_row_pc)에서 정한다. TS 쪽은 사전의 띠 줄별 pc(band_row_pc)를 쓴다.
두 길이 같은 칸 번호에 닿아야 일치다.
"""
import collections, json, os, random, re, sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..', '..'))
sys.path.insert(0, HERE)
sys.path.insert(0, os.path.join(HERE, 'lib'))
import bake_jp as B            # noqa: E402
import bake_lib as BL          # noqa: E402
import bake_spec as SP         # noqa: E402
import gen as G                # noqa: E402
from PIL import Image          # noqa: E402
import numpy as np             # noqa: E402

PINS = os.path.join(ROOT, 'tiledata', 'jp-city', 'pins.json')
SHEET = os.path.join(ROOT, 'public', 'assets', 'jp-city', 'jp-city-chipset.png')


class Ctx:
    def __init__(self):
        self.src = B.Src(); self.K = self.src.K; self.cat = self.K.cat
        self.pins = json.load(open(PINS, encoding='utf-8'))['cells']

    def tid(self, nm, pc):
        """칸 이름 + 통행 종류 → 굽기 칸 번호(없는 칸·투명 칸이면 None)."""
        i = self.src.idx_of(nm) if nm else None
        if i is None or self.src.alpha[i] == 'blank': return None
        if pc == self.src.primary[i]: return i
        t = self.pins.get(f'jp16/{i}@{pc}')
        assert t is not None, ('복제 칸 없음', nm, i, pc)
        return t


def deco_tid(cx, nm):
    m = re.match(r'^deco\.(.+)\.c(\d+)\.r(\d+)$', nm)
    did, rr = m.group(1), int(m.group(3))
    return cx.tid(nm, B.deco_row_pc(did, rr, cx.cat['decos'][did]['h']))


def base_pc_by_name(cx, asms):
    """Python 이 조립한 walk 격자에서 칸 이름마다 통행 종류를 읽는다. S·문(F) → solid, C → star, 마당 칸(F·lo)은 street_pc."""
    pcs = {}
    for a in asms:
        door = {(r, c) for r, c in a.get('doors', [(a['rows'] - 1, c) for c in a['door_cols']])}
        for r in range(a['rows']):
            for c in range(a['n']):
                nm = a['cells'][r][c]
                if not nm: continue
                w, lay = a['walk'][r][c], a['layer'][r][c]
                if (r, c) in door or w == 'S': pc = 'solid'
                elif w == 'C': pc = 'star'
                else: pc = 'floor'
                assert pcs.setdefault(nm, pc) == pc, ('같은 칸 이름이 두 통행으로 쓰인다', nm)
    return pcs


def lint_of(cx, spec, part=None):
    """원본 gen.lint_specs(창 위에 얹힌 부착물) 결과 → [부위, 층, 부착물, 열]. 정답 쪽 DECO_CLASH(창) 기대값."""
    return [[part, fl, dn, col] for (_n, fl, dn, col) in G.lint_specs(cx.K, 'x', spec)]


def dump_single(cx, spec):
    K = cx.K
    asm = K.assemble(spec)
    pcs = base_pc_by_name(cx, [asm])
    return asm, dict(
        n=asm['n'], rows=asm['rows'], lint=lint_of(cx, spec),
        cells=[[cx.tid(nm, pcs[nm]) if nm else None for nm in row] for row in asm['cells']],
        deco=[[r, c, t] for r, c, nm in asm['deco'] for t in [deco_tid(cx, nm)] if t is not None],
        walk=[''.join(row) for row in asm['walk']], layer=[['lo' if x == 'lo' else 'up' for x in row] for row in asm['layer']],
        doors=[[asm['rows'] - 1, c] for c in asm['door_cols']], shadowCells=[], rect_solid=solid_grid(asm, [(asm['rows'] - 1, c) for c in asm['door_cols']]))


def solid_grid(asm, doors):
    ds = set(map(tuple, doors))
    return [[bool(asm['walk'][r][c] == 'S' or (r, c) in ds) for c in range(asm['n'])] for r in range(asm['rows'])]


def dump_L(cx, spec):
    K = cx.K
    asm = K.assemble_L(spec)
    m = K.assemble(spec['main']); w = K.assemble(spec['wing'])
    pcs = base_pc_by_name(cx, [m, w])
    n = asm['n']; yard_pc = 'floor'
    def base_tid(nm):
        if nm in pcs: return cx.tid(nm, pcs[nm])
        return cx.tid(nm, yard_pc)             # 마당 칸(거리 이름 → st.*)
    ds = [(r, c) for r, c in asm['doors']]
    shadow = []
    if asm.get('shadow'):
        x0, y0, x1, y1 = asm['shadow']
        for r in range(asm['rows']):
            for c in range(n):
                ix0, ix1 = max(x0, c * 16), min(x1, c * 16 + 16); iy0, iy1 = max(y0, r * 16), min(y1, r * 16 + 16)
                if ix0 < ix1 and iy0 < iy1: shadow.append([r, c])
    return asm, dict(
        n=n, rows=asm['rows'], lint=lint_of(cx, spec['main'], 'main') + lint_of(cx, spec['wing'], 'wing'),
        cells=[[base_tid(nm) if nm else None for nm in row] for row in asm['cells']],
        deco=[[r, c, t] for r, c, nm in asm['deco'] for t in [deco_tid(cx, nm) if nm.startswith('deco.') else base_tid(nm)] if t is not None],
        walk=[''.join(row) for row in asm['walk']], layer=[['lo' if x == 'lo' else 'up' for x in row] for row in asm['layer']],
        doors=[list(d) for d in ds], shadowCells=shadow, rect_solid=solid_grid(asm, ds))


# ──────────────────────────────────────────────────────────────── 입력 모음
def cases(cx):
    K, cat = cx.K, cx.cat
    out = []                                           # (이름, 종류, 파이썬 spec)
    for rn, sp in cat['recipes'].items(): out.append((f'recipe:{rn}', 'single', sp))
    for rn, sp in cat['lRecipes'].items(): out.append((f'recipe:{rn}', 'L', sp))
    # 폭·층수·재질·1층·지붕·데코를 바꾼 합성 입력(시드 고정)
    for fam, n, nf, seed in [('retail', 4, 3, 1), ('retail', 5, 4, 2), ('retail', 7, 2, 3), ('retail', 9, 5, 4),
                             ('office', 4, 5, 5), ('office', 6, 3, 6), ('office', 8, 6, 7), ('office', 11, 4, 8),
                             ('mansion', 5, 6, 9), ('mansion', 6, 4, 10), ('mansion', 8, 7, 11), ('mansion', 3, 3, 12),
                             ('izakaya', 4, 4, 13), ('izakaya', 6, 3, 14), ('izakaya', 9, 5, 15),
                             ('bar', 5, 3, 16), ('bar', 7, 4, 17), ('bar', 10, 2, 18), ('retail', 3, 2, 19), ('office', 12, 8, 20)]:
        out.append((f'gen:{fam}-w{n}-f{nf}-s{seed}', 'single', G.gen(K, fam, n, nf, seed)))
    for n, seed in [(4, 31), (5, 32), (6, 33), (8, 34), (9, 35)]:
        out.append((f'machiya:w{n}-s{seed}', 'single', G.machiya(K, n, seed)))
    out.append(('machiya:w6-flat2', 'single', G.machiya(K, 6, 36, two=False)))
    # 손으로 고른 경계 입력: 최소 폭, 모듈 폭 2(베란다·발코니·옥상 간판)에서 홀수 폭(채움 칸), 셋백, 옥상 간판, 직접 지정 변형
    out += [
        ('edge:min-w3', 'single', dict(n=3, head=None, roof='roof.plain.plain', floors=[{'kind': 'blank', 'wall': 'conc', 'vs': [0]}], ground='gr.garage', door=('rollup', 0), decos=[])),
        ('edge:veranda-w7-odd', 'single', dict(n=7, head=None, roof='roof.stair.tank', floors=[{'kind': 'veranda', 'wall': 'shiro', 'vs': [1, 2, 3]}] * 3, ground='gr.shutter.kii', decos=[])),
        ('edge:balcony-w8-even', 'single', dict(n=8, head=None, roof='roof.ac.cyl', floors=[{'kind': 'balcony', 'wall': 'hodo', 'vs': [0, 7, 15, 3]}] * 2, ground='gr.glass.aka', door=('cafe', 2), decos=[])),
        ('edge:head-w6-roofsign', 'single', dict(n=6, head='roofsign.sora', roof='roof.plain.plain', floors=[{'kind': 'tile', 'wall': 'kinari', 'vs': [0, 1]}, {'kind': 'curtain', 'wall': 'kinari', 'vs': [1]}], ground='gr.izakaya', door=('noren', 0), decos=[dict(deco='rtext.ramen', col=1, floor='head')])),
        ('edge:setback-w9-ins2', 'single', dict(n=9, head=None, roof='roof.ac.plain', floors=[{'kind': 'ribbon', 'wall': 'shiro', 'vs': [0, 1]}, {'kind': 'pairs', 'wall': 'conc', 'vs': [1, 0]}, {'kind': 'slide', 'wall': 'hodo', 'vs': [5]}], ground='gr.konbini.1', setback=dict(upper=2, ins=2), door=('auto', 3), decos=[])),
        ('edge:setback-w5-ins1', 'single', dict(n=5, head=None, roof='roof.plain.cyl', floors=[{'kind': 'koushi', 'wall': 'kinari', 'vs': [2]}] * 2, ground='gr.konbini.0', setback=dict(upper=1, ins=1), decos=[])),
        ('edge:floors0-machiya-w4', 'single', dict(n=4, head=None, roof='roof.hip', eave='eave', floors=[], ground='gr.machiya', ground_vs=[0, 3, 5], door=('house', 1), decos=[dict(deco='inuyarai', col=0, floor='ground', row=2)])),
        ('edge:eave-slate-w5', 'single', dict(n=5, head=None, roof='roof.slate', eave='eave.slate', floors=[{'kind': 'koushi', 'wall': 'shiro', 'vs': [3, 1]}], ground='gr.machiya', ground_vs=[2, 4, 5, 1], decos=[dict(deco='mushiko', col=2, floor=0)])),
        ('edge:vstack-fe-w6', 'single', dict(n=6, head=None, roof='roof.stair.plain', floors=[{'kind': 'blank', 'wall': 'shiro', 'vs': [0]}] * 4, ground='gr.izakaya', door=('noren', 3),
                                              decos=[dict(deco='fe', col=3, floor=i) for i in range(4)] + [dict(deco='vstack.{c}', cols=['kii', 'aka'], col=5, floor=i) for i in (0, 2)])),
        ('edge:wide-w14-8floors', 'single', dict(n=14, head=None, roof='roof.ac.tank', floors=[{'kind': 'ribbon', 'wall': 'conc', 'vs': [0, 1, 0]}] * 8, ground='gr.shutter.sora', door=('steel', 6), decos=[dict(deco='ac.0', col=4, floor=1)] if False else [])),
        # L자: 별채 오른쪽·마당 이름·깊이 바꿈
        ('L:side-R-w7-k3', 'L', dict(side='R', depth=2, yard='lot',
                                    main=dict(n=7, head=None, roof='roof.plain.tank', floors=[{'kind': 'ribbon', 'wall': 'shiro', 'vs': [1, 0, 1]}, {'kind': 'pairs', 'wall': 'shiro', 'vs': [1, 2, 1, 0]}], ground='gr.shutter.sora', door=('steel', 0), decos=[]),
                                    wing=dict(n=3, head=None, roof='roof.plain.plain', floors=[], ground='gr.glass.kii', door=('cafe', 1), decos=[]))),
        ('L:sw-yard-depth3', 'L', dict(side='L', depth=3, yard='sw',
                                      main=dict(n=8, head=None, roof='roof.hip.slate', eave='eave.slate', floors=[{'kind': 'koushi', 'wall': 'kinari', 'vs': [1, 0, 0, 2, 0]}], ground='gr.machiya', ground_vs=[0, 4, 5, 4, 5, 0], door=('machiya', 5), decos=[]),
                                      wing=dict(n=4, head=None, roof='roof.hip.slate', floors=[], ground='gr.machiya', ground_vs=[4], door=('house', 1), decos=[]))),
        ('L:lot-w9-two-floor-wing', 'L', dict(side='L', depth=2, yard='lot',
                                             main=dict(n=9, head=None, roof='roof.ac.tank', floors=[{'kind': 'pairs', 'wall': 'conc', 'vs': [0, 1]}] * 3, ground='gr.garage', door=('rollup', 7), decos=[]),
                                             wing=dict(n=4, head=None, roof='roof.plain.plain', floors=[{'kind': 'ribbon', 'wall': 'hodo', 'vs': [0]}], ground='gr.glass.sora', door=('cafe', 1), decos=[]))),
    ]
    return out


def to_ts_input(kind, sp):
    return SP.to_input(sp) if kind == 'single' else SP.l_to_input(sp)


def cmd_dump(path):
    cx = Ctx(); res = []; skipped = []
    for name, kind, sp in cases(cx):
        try:
            asm, exp = (dump_single if kind == 'single' else dump_L)(cx, sp)
        except Exception as e:                        # 원본이 스스로 거부하는 입력(assert·ValueError)은 비교 대상이 아니다 — 숨기지 않고 기록
            skipped.append(dict(name=name, error=f'{type(e).__name__}: {e}')); continue
        inp = to_ts_input(kind, sp)
        inp['x'] = 0; inp['y'] = exp['rows'] - 1
        res.append(dict(name=name, kind=kind, input=inp, expected=exp))
    json.dump(dict(cases=res, skipped=skipped), open(path, 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
    print(json.dumps(dict(dumped=len(res), single=sum(1 for r in res if r['kind'] == 'single'), L=sum(1 for r in res if r['kind'] == 'L'), skipped=skipped), ensure_ascii=False))


def cmd_render(path):
    """TS 가 정한 칸 층을 시트로 합성해 Python Kit.render(그림자만 뺀 것)와 화소 비교."""
    cx = Ctx(); sheet = Image.open(SHEET).convert('RGBA')
    ts = json.load(open(path, encoding='utf-8'))
    byname = {n: (k, sp) for n, k, sp in cases(cx)}
    rows = []; bad = 0
    for c in ts['cases']:
        kind, sp = byname[c['name']]
        asm = cx.K.assemble(sp) if kind == 'single' else cx.K.assemble_L(sp)
        shadow = asm.get('shadow'); asm = dict(asm); asm['shadow'] = None
        exp = cx.K.render(asm)
        n, R = asm['n'], asm['rows']
        got = np.zeros((R * 16, n * 16, 4), np.uint8)
        def blit(r, col, t):
            a = np.asarray(BL.read_cell(sheet, t)); sub = got[r * 16:(r + 1) * 16, col * 16:(col + 1) * 16]; m = a[..., 3] > 0; sub[m] = a[m]
        for p in c['placements']:
            for key in ('lower', 'upper', 'overlay'):
                if p.get(key) is not None: blit(p['y'], p['x'], p[key])
        diff = int((got != exp).any(-1).sum())
        rows.append(dict(name=c['name'], pixels_different=diff, shadow_omitted=bool(shadow)))
        bad += diff > 0
    print(json.dumps(dict(rendered=len(rows), identical=sum(1 for r in rows if r['pixels_different'] == 0), different=[r for r in rows if r['pixels_different']]), ensure_ascii=False))
    sys.exit(1 if bad else 0)


if __name__ == '__main__':
    if len(sys.argv) == 3 and sys.argv[1] == 'dump': cmd_dump(sys.argv[2])
    elif len(sys.argv) == 3 and sys.argv[1] == 'render': cmd_render(sys.argv[2])
    else: print(__doc__); sys.exit(2)
