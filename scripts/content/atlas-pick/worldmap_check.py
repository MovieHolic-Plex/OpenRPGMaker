#!/usr/bin/env python3
"""월드맵 세트 후보 검사 — 공통 check_candidate.py 검사를 그대로 돌린 뒤, 월드맵에만 필요한 검사를 더해 같은 <후보>.check.json 에 합친다.
  python3 scripts/content/atlas-pick/worldmap_check.py tiledata/atlas-pick/candidates-worldmap/<slug>/w1-A.pxg [...]
  python3 scripts/content/atlas-pick/worldmap_check.py --worker w1          # 그 작업자 후보 전부
  python3 scripts/content/atlas-pick/worldmap_check.py --slug coast_grass   # 그 기물 후보 전부
  python3 scripts/content/atlas-pick/worldmap_check.py --all

더하는 검사(공통 파일은 고치지 않는다 — 공통 쪽이 받아들이면 이 파일은 지워도 된다):
 hard  world-easyrpg  EasyRPG 월드 시트(public/assets/easyrpg-chipset-world-transparent.png)와, 그것을 재칠한
                      atlas 월드 시트(public/assets/atlas-biomes/world-chipset.png) 칸과 95% 이상 닮은 칸 0.
                      (공통 easyrpg 검사는 현대 시트 0~2729 만 본다 — 월드맵 옛 칸은 거기 없다)
 hard  refmap-world   REFMAP 팩 중 지형 팩(refmap-snow·volcano·south-island·mz-ground)과 95% 이상 닮은 칸 0. 공통 검사는 town-outside·interior 만 본다.
 hard  bundle         이어짐 조각 묶음(3×4)의 「안쪽」이 꽉 차 있다 — 8px 사분면 합성에서 구멍이 나지 않게:
                      몸통 칸 전부, 북쪽 변 아랫절반, 남쪽 변 윗절반, 서쪽 변 오른절반, 동쪽 변 왼절반, 각 모서리의 안쪽 사분면,
                      안쪽 모서리 칸의 가운데 8×8 이 불투명(알파 255). 몸통 변형은 꽉 차거나 통째로 비어야 한다.
 hard  base           바탕 3칸이 각각 칸을 꽉 채운다(공통 ground 검사와 같음, 칸마다 따로 적는다).
 soft  seam           시험 지도에 사분면 합성으로 깔았을 때 8px 이음 줄의 색 차이 ÷ 이음 아닌 곳 색 차이(묶음), 칸 경계(바탕·다리).
                      2.0 이 넘으면 「이음이 보인다」 경고.
 soft  inner-notch    안쪽 모서리 칸 네 귀 화소가 비어 있나(바깥이 파고든 자리) — 차 있으면 경고.
 soft  iso-edge       외딴 칸이 네모로 꽉 차 보이나(네 변 모두 가장자리까지 불투명) — 경고.
 hard  shore-strait  (style line = 해안·강·길·용암; flat 은 6 미만 경고, mass 는 안 봄) 1칸 폭 줄(해협·길·강)의 속 폭 = 16 − 북쪽 변 기슭 깊이 − 남쪽 변 기슭 깊이(동서도) ≥ 6px.
                      기슭 깊이 = 칸 바깥쪽에서 몸통 재료(몸통 칸에 쓴 램프)가 두 화소 이어 시작하는 곳까지. 옛 1판 해안은 깊이 5~7 이라
                      해협 물이 2~4px — 두 땅이 거품 한 줄로 붙어 보였다(「가는 물·흰 줄 이음새」). 8 미만이면 경고.
 hard  shore-join    (line·flat) 사분면 이음에서 기슭선이 2px 넘게 어긋나지 않는다 — 모서리 칸 7열 ↔ 변 칸 8열, 안쪽 모서리 0열 ↔ 변 칸 15열 …
                      (엔진 quarterTile 이 실제로 붙이는 짝만 잰다). 3px 이상 hard, 2px 경고. 어긋나면 해안이 계단·톱니가 된다. mass(숲·산)는 경고만.
                      참고: World.png 물 블록 2, 우리 1판 해안 4~8, 2판 파일럿 0.
 hard  shore-step    (line·flat) 변 칸 기슭선의 이웃 열 깊이 차 ≤ 2(16px 감김 포함). 넘으면 톱니. 진폭(최대−최소) > 3 이면 경고(16px 마다 되풀이되는 혹).
 soft  corner-round  (line·flat) 바깥 모서리 칸 대각선 깊이 ≥ 이음 깊이 + 1 — 아니면 네모 모서리.
 soft  inner-round   (line·flat) 안쪽 모서리 홈의 대각선 깊이 < 이음 깊이 — 같으면 네모 홈(땅 볼록 모서리가 각진다).
"""
import argparse, glob, json, os, sys, warnings
warnings.filterwarnings('ignore')
import numpy as np
from PIL import Image
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import common
from common import *  # noqa
import check_candidate as CC
import worldmap_context as WC

SET = 'worldmap'
WORLD_SET = {'id': SET, 'name': '월드맵', 'items': 'jobs-worldmap.json', 'candidates': 'candidates-worldmap', 'baseline': None,
             'palette': 'worldmap.pal', 'worker': 'WORKER-WORLDMAP.md', 'about': 'JRPG 월드맵(필드 축척) 16px 조각. 절차 WORKER-WORLDMAP.md.'}
_orig = common.list_sets
def _list_sets():
    s = _orig()
    return s if any(m.get('id') == SET for m in s) else s + [WORLD_SET]
common.list_sets = _list_sets
import re
if not CC.WORKER_RE.match('w1-A.pxg'):
    CC.WORKER_RE = re.compile(r'^([a-z]{1,3}[0-9]{1,2}|pilot)-([A-Z])\.pxg$')

WORLD_SHEETS = [os.path.join(ROOT, 'public/assets/easyrpg-chipset-world-transparent.png'),
                os.path.join(ROOT, 'public/assets/atlas-biomes/world-chipset.png')]
REFMAP_WORLD = [os.path.expanduser('~/.local/share/oprn/refmap-downloads/_packs/' + p)
                for p in ('refmap-snow', 'refmap-volcano', 'refmap-south-island', 'refmap-mz-ground')]
CACHE = os.path.expanduser('~/.cache/oprn-atlas-pick')

_WS = None
def world_cells():
    global _WS
    if _WS is None:
        cs = []
        for p in WORLD_SHEETS:
            if os.path.exists(p):
                c = CC.cells(np.array(Image.open(p).convert('RGBA')), 16); cs.append(c[[i for i in range(len(c)) if c[i][..., 3].any()]])
        _WS = np.concatenate(cs) if cs else False
    return _WS

_RW = None
def refmap_world():
    """지형 REFMAP 팩 48px 칸 → 16px(LANCZOS·NEAREST). 제3자 상용 자료: 읽기만, 캐시는 저장소 밖."""
    global _RW
    if _RW is None:
        cp = os.path.join(CACHE, 'refmap16-world.npz')
        if os.path.exists(cp):
            z = np.load(cp); _RW = (z['r48'], z['l16'], z['n16'])
        else:
            files = [f for p in REFMAP_WORLD if os.path.isdir(p) for f in sorted(glob.glob(os.path.join(p, '*.png')))]
            if not files: _RW = False; return _RW
            big = []
            for f in files:
                a = np.array(Image.open(f).convert('RGBA'))
                a = a[:a.shape[0] // 48 * 48, :a.shape[1] // 48 * 48]
                c = CC.cells(a, 48); big.append(c[[i for i in range(len(c)) if c[i][..., 3].any()]])
            B = np.concatenate(big); _, ui = np.unique(B.reshape(len(B), -1), axis=0, return_index=True); R48 = B[np.sort(ui)]
            l16 = np.stack([np.array(Image.fromarray(c).resize((16, 16), Image.LANCZOS)) for c in R48])
            n16 = np.stack([np.array(Image.fromarray(c).resize((16, 16), Image.NEAREST)) for c in R48])
            os.makedirs(CACHE, exist_ok=True); np.savez_compressed(cp, r48=R48, l16=l16, n16=n16); _RW = (R48, l16, n16)
    return _RW

def world_easy_check(a):
    W = world_cells(); Q = CC.content_cells(a)
    if W is False: return dict(skipped='월드 시트 없음')
    if Q is None: return dict(cells=0, atLeast95=0, max=0.0)
    b, _ = CC.best_match(Q, W, 16)
    return dict(cells=len(Q), atLeast95=int((b >= .95).sum()), max=round(float(b.max()), 3))

def refmap_world_check(a):
    R = refmap_world(); Q = CC.content_cells(a)
    if R is False: return dict(skipped='지형 REFMAP 팩 없음')
    if Q is None: return dict(cells=0, atLeast95=0, max=0.0)
    Qb = np.stack([np.array(Image.fromarray(c).resize((48, 48), Image.NEAREST)) for c in Q]); best = np.zeros(len(Q))
    for A, B, T in ((Q, R[1], 16), (Q, R[2], 16), (Qb, R[0], 48)):
        b, _ = CC.best_match(A, B, T); best = np.maximum(best, b)
    return dict(cells=len(Q), atLeast95=int((best >= .95).sum()), max=round(float(best.max()), 3))

# 묶음 칸마다 꽉 차야 하는 영역 (x0, y0, x1, y1) — 칸 안 좌표
SOLID = {'body': (0, 0, 16, 16), 'edge_n': (0, 8, 16, 16), 'edge_s': (0, 0, 16, 8), 'edge_w': (8, 0, 16, 16), 'edge_e': (0, 0, 8, 16),
         'corner_nw': (8, 8, 16, 16), 'corner_ne': (0, 8, 8, 16), 'corner_sw': (8, 0, 16, 8), 'corner_se': (0, 0, 8, 8), 'inner': (4, 4, 12, 12)}

def seam_ratio(img, step, mask=None):
    """step 간격 이음 줄(세로·가로)의 이웃 화소 색 차 평균 ÷ 이음 아닌 곳 평균. 둘 다 불투명한 짝만."""
    a = img.astype(np.int16); op = img[..., 3] == 255
    dx = np.abs(a[:, 1:, :3] - a[:, :-1, :3]).sum(-1); ox = op[:, 1:] & op[:, :-1]
    dy = np.abs(a[1:, :, :3] - a[:-1, :, :3]).sum(-1); oy = op[1:, :] & op[:-1, :]
    xs = (np.arange(dx.shape[1]) + 1) % step == 0; ys = (np.arange(dy.shape[0]) + 1) % step == 0
    seam = np.concatenate([dx[:, xs][ox[:, xs]], dy[ys, :][oy[ys, :]]]); rest = np.concatenate([dx[:, ~xs][ox[:, ~xs]], dy[~ys, :][oy[~ys, :]]])
    if len(seam) == 0 or len(rest) == 0: return None
    return round(float(seam.mean() + 1) / float(rest.mean() + 1), 2)


# ── 기슭선(물가·테) 기하 — 2판(2026-09-30). worldmap-reference-study.md 4절 ──
_RAMP_OF = None
def ramp_of():
    """색(rgb) → 그 색이 든 램프 이름들."""
    global _RAMP_OF
    if _RAMP_OF is None:
        P = WC.pal(); _RAMP_OF = {}
        for k, c in P.items():
            if ':' in k: _RAMP_OF.setdefault(tuple(c[:3]), set()).add(k.split(':')[0])
    return _RAMP_OF

def interior(a):
    """몸통 재료 마스크: 불투명하고 몸통 칸(과 꽉 찬 몸통 변형)에 쓴 램프의 색."""
    R = ramp_of(); body = WC.role(a, 'body'); ramps = set()
    for p in body.reshape(-1, 4):
        if p[3] == 255: ramps |= R.get(tuple(p[:3]), set())
    m = np.zeros(a.shape[:2], bool)
    for y in range(a.shape[0]):
        for x in range(a.shape[1]):
            p = a[y, x]; m[y, x] = p[3] == 255 and bool(R.get(tuple(p[:3]), set()) & ramps)
    return m

def _top(m, x, lim=16):
    """열 x 에서 위에서부터 몸통이 두 화소 이어 시작하는 깊이(lim 까지 없으면 lim)."""
    for y in range(lim):
        if m[y, x] and (y + 1 >= m.shape[0] or m[y + 1, x]): return y
    return lim

def _nw(t, q):
    """사분면 q 가 왼쪽 위로 오게 뒤집는다."""
    if q[1] == 'e': t = t[:, ::-1]
    if q[0] == 's': t = t[::-1]
    return t

def shore_geometry(a):
    I = interior(a); role = lambda r: WC.role(I[..., None], r)[..., 0]
    prof = {'n': [_top(role('edge_n'), x) for x in range(16)],
            's': [_top(role('edge_s')[::-1], x) for x in range(16)],
            'w': [_top(role('edge_w').T, y) for y in range(16)],
            'e': [_top(role('edge_e')[:, ::-1].T, y) for y in range(16)]}
    joins = []   # (이름, 모서리·홈 쪽 깊이, 변 쪽 깊이)
    for q, (vs, hs) in {'nw': ('n', 'w'), 'ne': ('n', 'e'), 'sw': ('s', 'w'), 'se': ('s', 'e')}.items():
        c = _nw(role('corner_' + q), q)
        cv, ch = _top(c, 7, 8), _top(c.T, 7, 8)
        # 모서리 칸 안쪽 열(7) ↔ 같은 칸 옆 사분면 = 변 칸의 8열(동쪽 모서리면 7열)
        joins.append((f'corner_{q}↔edge_{vs}', cv, prof[vs][8 if q[1] == 'w' else 7]))
        joins.append((f'corner_{q}↔edge_{hs}', ch, prof[hs][8 if q[0] == 'n' else 7]))
        diag = next((k for k in range(8) if c[k, k]), 8)
        n = _nw(role('inner'), q)
        iv, ih = _top(n, 0, 8), _top(n.T, 0, 8)
        # 안쪽 모서리 0열 ↔ 왼(오른)쪽 이웃 칸 변의 15열(0열), 0행 ↔ 위(아래) 이웃 칸 변의 15행(0행)
        joins.append((f'inner_{q}↔edge_{vs}', iv, prof[vs][15 if q[1] == 'w' else 0]))
        joins.append((f'inner_{q}↔edge_{hs}', ih, prof[hs][15 if q[0] == 'n' else 0]))
        idiag = next((k for k in range(8) if n[k, k]), 8)
        yield_q = dict(q=q, corner=(cv, ch, diag), inner=(iv, ih, idiag))
        joins.append(('_q', yield_q, None))
    qs = [j[1] for j in joins if j[0] == '_q']; joins = [j for j in joins if j[0] != '_q']
    strait = min(min(16 - prof['n'][x] - prof['s'][x] for x in range(16)), min(16 - prof['w'][y] - prof['e'][y] for y in range(16)))
    steps = {k: max(abs(v[i] - v[(i + 1) % 16]) for i in range(16)) for k, v in prof.items()}
    amp = {k: max(v) - min(v) for k, v in prof.items()}
    return dict(profile=prof, strait=int(strait), joins=[(n, int(x), int(y)) for n, x, y in joins], steps=steps, amp=amp, quarters=qs)

def shore_verdict(res, it, g):
    """style(info.json): line = 1칸 폭 줄로도 쓰는 지형(해안·강·길·용암) / flat = 평지 덩이(사막·설원·늪…) / mass = 숲·산처럼 덩이 무늬.
    1판 후보(style 없음)는 flat 으로 본다."""
    style = it.get('style', 'flat'); edge = style in ('line', 'flat')
    if style == 'line':
        if g['strait'] < 6: res['hard'].append(f'shore-strait: 1칸 폭 줄 속이 {g["strait"]}px — 기슭 깊이를 칸 바깥 2~4px 로(6 이상, 권장 8)')
        elif g['strait'] < 8: res['warn'].append(f'shore-strait: 1칸 폭 줄 속 {g["strait"]}px — 8 이상이면 해협·길이 또렷하다')
    elif style == 'flat' and g['strait'] < 6:
        res['warn'].append(f'shore-strait: 1칸 폭 띠 속 {g["strait"]}px — 6 이상 권장')
    bad = [f'{n} {x}≠{y}' for n, x, y in g['joins'] if abs(x - y) > 2]
    near = [f'{n} {x}≠{y}' for n, x, y in g['joins'] if abs(x - y) == 2]
    lst = lambda l: ', '.join(l[:6]) + (' …' if len(l) > 6 else '')
    if bad: (res['hard'] if edge else res['warn']).append('shore-join: 사분면 이음에서 기슭선이 3px 이상 어긋난다(계단·톱니) — ' + lst(bad))
    if near and edge: res['warn'].append('shore-join: 이음에서 2px 어긋남(1 이하 권장) — ' + lst(near))
    if edge:
        st = [f'{k} {v}' for k, v in g['steps'].items() if v > 2]
        if st: res['hard'].append('shore-step: 변 칸 기슭선이 이웃 열에서 3px 이상 튄다(톱니) — ' + ', '.join(st))
        am = [f'{k} {v}' for k, v in g['amp'].items() if v > 3]
        if am: res['warn'].append('shore-step: 변 칸 기슭선 진폭이 크다(16px 마다 같은 혹이 되풀이된다, ±1 권장) — ' + ', '.join(am))
        sq = [q['q'] for q in g['quarters'] if q['corner'][2] < max(q['corner'][0], q['corner'][1]) + 1]
        if sq: res['warn'].append('corner-round: 바깥 모서리가 네모다(대각선 깊이 = 이음 깊이) — ' + ' '.join(sq))
        sn = [q['q'] for q in g['quarters'] if min(q['inner'][0], q['inner'][1]) >= 2 and q['inner'][2] >= min(q['inner'][0], q['inner'][1])]
        if sn: res['warn'].append('inner-round: 안쪽 모서리 홈이 네모다(대각선 깊이 ≥ 이음 깊이) — ' + ' '.join(sn))

ALLOW_EASYRPG = False  # --allow-easyrpg 로만 켠다

def extra(res, it, a):
    wm = {}; kind = it.get('kind')
    ec = world_easy_check(a); wm['worldEasyrpg'] = ec
    if ec.get('atLeast95') and not ALLOW_EASYRPG: res['hard'].append(f'world-easyrpg: EasyRPG 월드 시트 칸과 95% 이상 닮은 칸 {ec["atLeast95"]}개 — 옛 월드 칸을 베끼지 마라')
    rc = refmap_world_check(a); wm['refmapWorld'] = rc
    if rc.get('atLeast95'): res['hard'].append(f'refmap-world: 지형 REFMAP 과 95% 이상 닮은 칸 {rc["atLeast95"]}개 — 제3자 화소 복사 금지')
    if kind == 'bundle' and a.shape[:2] == (64, 48):
        holes = []
        for r, (x0, y0, x1, y1) in SOLID.items():
            c = WC.role(a, r); n = int((c[y0:y1, x0:x1, 3] < 255).sum())
            if n: holes.append(f'{r} {n}px')
        alt = WC.role(a, 'body_alt')[..., 3]
        if not ((alt == 255).all() or (alt == 0).all()):
            holes.append('body_alt 가 반만 찼다(꽉 채우거나 통째로 비워라)')
        if holes: res['hard'].append('bundle: 사분면 합성에서 구멍이 날 안쪽 영역이 비었다 — ' + ', '.join(holes))
        inner = WC.role(a, 'inner'); corners = [inner[0, 0, 3], inner[0, 15, 3], inner[15, 0, 3], inner[15, 15, 3]]
        if sum(c == 255 for c in corners) > 1:
            res['warn'].append('inner-notch: 안쪽 모서리 칸 네 귀가 차 있다 — 네 귀에 바깥(투명)이 파고들어야 오목 모서리가 된다')
        iso = WC.role(a, 'isolated')[..., 3]
        if all((e == 255).all() for e in (iso[0], iso[-1], iso[:, 0], iso[:, -1])):
            res['warn'].append('iso-edge: 외딴 칸이 칸 끝까지 네모로 꽉 찼다 — 둥근 덩이로')
        g = shore_geometry(a); wm['shore'] = {k: g[k] for k in ('profile', 'strait', 'steps', 'amp')}
        wm['shore']['joinWorst'] = max((abs(x - y) for _, x, y in g['joins']), default=0)
        shore_verdict(res, it, g)
        mask, outside = WC.bundle_mask(it['slug'])
        comp = WC.compose_bundle(a, mask, outside, ())
        wm['seam'] = seam_ratio(comp, 8)
    elif kind == 'base' and a.shape[1] == 48:
        for k in range(3):
            n = int((a[:, k * 16:(k + 1) * 16, 3] < 255).sum())
            if n: res['hard'].append(f'base: 변형 {k + 1} 칸에 빈 화소 {n}개')
        cs = [a[:, k * 16:(k + 1) * 16] for k in range(3)]
        mix = np.zeros((96, 96, 4), np.uint8)
        for y in range(6):
            for x in range(6): mix[y * 16:(y + 1) * 16, x * 16:(x + 1) * 16] = cs[(x * 2 + y * 5 + x * y) % 3]
        wm['seam'] = seam_ratio(mix, 16)
        lum = [round(float((c[..., :3].astype(np.float32) @ [0.299, 0.587, 0.114]).mean()), 1) for c in cs]
        wm['variantLuma'] = lum
        if max(lum) - min(lum) > 8: res['warn'].append(f'base: 세 변형 평균 밝기 차 {max(lum) - min(lum):.1f} — 섞어 깔면 얼룩진다(8 이하)')
    elif kind == 'piece':
        rep = np.tile(a, (1, 4, 1)) if it.get('joins') == 'x' else np.tile(a, (4, 1, 1))
        wm['seam'] = seam_ratio(rep, 16)
    if wm.get('seam') and wm['seam'] > 2.0:
        res['warn'].append(f'seam: 이음 줄 색 차가 다른 곳의 {wm["seam"]}배 — 이어 깔면 칸 경계·8px 줄이 보인다(2.0 이하)')
    res['worldmap'] = wm

_allowed_orig = CC.allowed
def _allowed_v3(palpath):
    """v3-*.pxg 는 후보 폴더의 palette.pal(2판 사본) 대신 worldmap3.pal 로 「팔레트 밖 색」을 잰다."""
    if WC.PALNAME in ('worldmap3.pal', 'worldmap5.pal', 'worldmap6.pal') and os.path.basename(palpath) == 'palette.pal':
        palpath = os.path.join(PAL_DIR, WC.PALNAME)
    elif WC.PALNAME == 'worldmap6.pal' and os.path.basename(palpath) == 'worldmap.pal':   # 6판 신규 slug(후보 폴더에 palette.pal 이 없다)
        palpath = os.path.join(PAL_DIR, WC.PALNAME)
    return _allowed_orig(palpath)
CC.allowed = _allowed_v3

def check(pxg, quiet=False):
    global _RAMP_OF
    want = WC.palette_for(pxg)
    if want != WC.PALNAME: _RAMP_OF = None
    WC.use_palette(want)
    res = CC.check(pxg, quiet=True)
    st, s = set_of_path(pxg); it = items_by_slug(st).get(s) if st else None
    png = os.path.splitext(os.path.abspath(pxg))[0] + '.png'
    if it and os.path.exists(png) and not any(h.startswith(('size', 'pxgrid')) for h in res['hard']):
        extra(res, it, np.array(Image.open(png).convert('RGBA')))
    return CC.finish(res, os.path.splitext(os.path.abspath(pxg))[0], quiet)

def main():
    ap = argparse.ArgumentParser(); ap.add_argument('files', nargs='*'); ap.add_argument('--slug'); ap.add_argument('--worker')
    ap.add_argument('--all', action='store_true'); ap.add_argument('--quiet', action='store_true')
    ap.add_argument('--allow-easyrpg', action='store_true', help='EasyRPG 월드 개선판 작업 전용: world-easyrpg 95%% 유사 하드 실패를 끈다(기본은 켜짐)')
    a = ap.parse_args()
    global ALLOW_EASYRPG; ALLOW_EASYRPG = a.allow_easyrpg
    files = list(a.files); cd = cand_dir(SET)
    if a.slug: files += sorted(glob.glob(os.path.join(cd, a.slug, '*.pxg')))
    if a.all or a.worker: files += sorted(glob.glob(os.path.join(cd, '*', f'{a.worker or "*"}-*.pxg')))
    files = [f for f in files if CC.WORKER_RE.match(os.path.basename(f)) or f in a.files]
    if not files: raise SystemExit('검사할 후보가 없다')
    rs = []
    for f in files:
        r = check(f, a.quiet); rs.append(r)
        if not a.quiet and r.get('worldmap'):
            wm = r['worldmap']; print('   월드맵: easyrpg-world max', wm.get('worldEasyrpg', {}).get('max'), '| refmap-world max',
                                      wm.get('refmapWorld', {}).get('max', wm.get('refmapWorld', {}).get('skipped')), '| seam', wm.get('seam'),
                                      *(('| 해협', wm['shore']['strait'], '| 이음 어긋남', wm['shore']['joinWorst']) if wm.get('shore') else ()))
    print(f'{sum(r["ok"] for r in rs)}/{len(rs)} 합격')
    sys.exit(0 if all(r['ok'] for r in rs) else 1)

if __name__ == '__main__':
    main()
