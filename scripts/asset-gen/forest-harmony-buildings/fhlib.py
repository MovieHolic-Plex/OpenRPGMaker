"""숲마을 · 거리별 잔디 생성 건물 — 제작 틀 공통부.
틀(zone map)은 건물 픽셀마다 구역을 정한다. 구역이 곧 규칙이다:
  윤곽 = 틀 사각형(밖은 무조건 투명), 색 = 구역의 원본 칩셋 팔레트, 문·창 = 원본 칩셋 타일 그대로, 통행 = 틀.
AI 그림은 구역 안의 무늬(명암 배치)를 고르는 데만 쓰인다."""
import json, os, re
import numpy as np
from PIL import Image

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '../../..'))
SPEC_PATH = os.path.join(ROOT, 'tiledata/forest-harmony-buildings/frames.json')
SHEET_PATH = os.path.join(ROOT, 'public/assets/forest-harmony/chipset.png')
HOUSES_MD = os.path.join(ROOT, 'tiledata/tilesets/forest_harmony/dewbank-village/houses.md')
OUT = os.environ.get('OUT_DIR', os.path.join(ROOT, '.omo/asset-gen-tmp/fh-bld'))
os.makedirs(OUT, exist_ok=True)
MAGENTA = (255, 0, 255)

ZONES = {1: 'roof', 2: 'eave', 3: 'timber', 4: 'wall', 5: 'base', 6: 'chimney', 7: 'door', 8: 'window', 9: 'gable'}
FIXED = {7, 8}
# 생성 기준 이미지에 칠하는 회색(구역이 서로 구별되게만)
GRAY = {1: (168, 168, 168), 2: (112, 112, 112), 3: (84, 84, 84), 4: (214, 214, 214), 5: (190, 190, 190),
        6: (136, 136, 136), 9: (226, 226, 226)}

_sheet = None
def sheet():
    global _sheet
    if _sheet is None: _sheet = Image.open(SHEET_PATH).convert('RGBA')
    return _sheet

def tile(i):
    return sheet().crop(((i % 30) * 16, (i // 30) * 16, (i % 30) * 16 + 16, (i // 30) * 16 + 16))

def spec():
    return json.load(open(SPEC_PATH))

def building(bid):
    s = spec()
    b = next(x for x in s['buildings'] if x['id'] == bid)
    return s, b

def palette(s, name):
    """(색 n×3, 비중 n) — 원본 칩셋 칸에서 센 색과 픽셀 비중. 'colors' 로 준 팔레트는 같은 비중."""
    p = s['palettes'][name]
    if 'colors' in p: return np.array(p['colors'], int), np.full(len(p['colors']), 1 / len(p['colors']))
    seen = {}
    for t in p['tiles']:
        for px in np.array(tile(t)).reshape(-1, 4):
            if px[3] > 200: seen[tuple(int(v) for v in px[:3])] = seen.get(tuple(int(v) for v in px[:3]), 0) + 1
    # 칸 몇 개에만 찍힌 경계 잡색은 뺀다(8px 미만)
    keep = [(c, n) for c, n in seen.items() if n >= 2]
    w = np.array([n for _, n in keep], float)
    return np.array([c for c, _ in keep], int), w / w.sum()

FORMS_PATH = os.path.join(ROOT, 'tiledata/forest-harmony-buildings/reference-forms.json')
ROOF_TILES = {404, 405, 406, 407, 467, 374, 375, 376, 377, 436, 437, 354, 355, 356, 357, 384, 385, 386, 387}
BASE_TILES = {75, 76, 77, 72, 73, 74, 162, 163, 164, 256}
WALL_TILES = {15, 16, 17, 45, 46, 47, 12, 13, 14, 42, 43, 44, 102, 103, 104, 132, 133, 134, 196, 226} | BASE_TILES
TIMBER_RGB = {(132, 92, 31), (96, 52, 8), (67, 29, 0)}

def form(fid):
    return next(f for f in json.load(open(FORMS_PATH)) if f['id'] == fid)

DOOR_TOP, DOOR = -2, 359   # 문은 생성하지 않는다: 위 칸 완전 검정(-2), 아래 칸 원본 359

def form_render(f):
    """참고 형태를 원본 칩셋으로 그리고, 픽셀마다 그린 타일 번호를 함께 돌려준다(아래층→위층, 문은 359 두 칸)."""
    W, H = f['w'] * 16, f['h'] * 16
    im = np.zeros((H, W, 4), np.uint8); src = np.full((H, W), -1, int)
    dx, dy = f['doorAt']['x'], f['doorAt']['y']
    for layer in ('tiles', 'upperTiles', 'door'):
        for y, r in enumerate(f['rows']):
            vals = r.get(layer, []) if layer != 'door' else [(DOOR_TOP if y == dy - 1 else DOOR) if x == dx and y in (dy - 1, dy) else -1 for x in range(f['w'])]
            for x, v in enumerate(vals):
                if v == DOOR_TOP:
                    t = np.zeros((16, 16, 4), np.uint8); t[..., 3] = 255
                elif v is None or not (0 <= v < 2550): continue
                else: t = np.array(tile(v))
                m = t[..., 3] > 0
                im[y * 16:(y + 1) * 16, x * 16:(x + 1) * 16][m] = t[m]
                src[y * 16:(y + 1) * 16, x * 16:(x + 1) * 16][m] = v
    return im, src

def house_render(fid):
    return Image.fromarray(form_render(form(fid))[0], 'RGBA')

def zone_palettes(s, b):
    wall = s['kits']['wall'][b['wall']]
    roof = palette(s, s['kits']['roof'][b['roof']])
    tim = palette(s, 'timber')
    def with_timber(p):   # 벽 속 기둥·가새는 목재색으로 남긴다(닻). 재료색 비중은 본체 칸 그대로.
        c, w = p
        extra = [x for x in tim[0].tolist() if x not in c.tolist()]
        return (np.vstack([c, np.array(extra, int)]) if extra else c), np.concatenate([w, np.full(len(extra), 0.05)])
    return {1: roof, 3: tim, 4: with_timber(palette(s, wall['wall'])), 5: with_timber(palette(s, wall['base']))}

def zone_map(s, b):
    """참고 형태 → (H,W) 구역, (H,W,4) 고정 부품(문·창·굴뚝 원본 그림), 칸 통행.
    구역은 그 픽셀을 그린 원본 타일의 종류로 정한다: 지붕 타일 → 지붕, 벽 타일 속 목재색 → 목재, 벽 밑단 → 토대, 나머지 벽."""
    f = form(b['form'])
    im, src = form_render(f)
    H, W = src.shape
    z = np.zeros((H, W), np.uint8); fixed = np.zeros((H, W, 4), np.uint8)
    rgb = [tuple(p) for p in im[..., :3].reshape(-1, 3)]
    timber = np.array([c in TIMBER_RGB for c in rgb]).reshape(H, W)
    roof = np.isin(src, list(ROOF_TILES)); wallt = np.isin(src, list(WALL_TILES)); base = np.isin(src, list(BASE_TILES))
    z[roof] = 1; z[wallt] = 4; z[base] = 5; z[(roof | wallt) & timber] = 3
    keep = np.isin(src, [DOOR_TOP, DOOR] + s['fixed']['keepUpper'])
    z[keep] = 7; fixed[keep] = im[keep]
    unk = (src >= 0) & (z == 0)
    if unk.any(): z[unk] = 4                     # 목록에 없는 벽 조각은 벽으로
    passmap = [''.join('X' if (r.get('tiles', [])[x] if x < len(r.get('tiles', [])) else -1) not in (-1, None) or
                       (r.get('upperTiles') or [-1] * f['w'])[x] not in (-1, None) else '.' for x in range(f['w'])) for r in f['rows']]
    dx, dy = f['doorAt']['x'], f['doorAt']['y']
    return z, fixed, dict(passmap=passmap, doorAt=[dx, dy], front=[dx, dy + 1], form=f['id'])

def layout(s, b):
    """기준 이미지 안 틀·화풍 기준의 위치와 배율(출력 = 기준 크기라 좌표가 그대로 유지된다). 큰 형태는 배율을 줄인다."""
    C, T = s['canvas'], s['tile']
    f = form(b['form']); st = house_render(s['styleGuides'][b['roof']])
    fw0, fh0 = f['w'] * T, f['h'] * T
    k = max(kk for kk in range(2, s['scale'] + 1) if (fw0 + st.width) * kk + 48 + 40 <= C and max(fh0, st.height) * kk <= C - 60)
    fw, fh, sw, sh = fw0 * k, fh0 * k, st.width * k, st.height * k
    gap = 48; x0 = (C - (fw + gap + sw)) // 2
    base = (C + max(fh, sh)) // 2           # 두 그림의 밑변을 같은 줄에(같은 축척임을 보이게)
    return dict(scale=k, frame=[x0, base - fh, fw, fh], style=[x0 + fw + gap, base - sh, sw, sh], split=x0 + fw + gap // 2)
