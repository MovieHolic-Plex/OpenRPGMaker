#!/usr/bin/env python3
"""jp_city 움직이는 탈것 굽기 — 그림 모듈(cars.py·heavy.py …)의 VEHICLES 를 모아 시트·목록을 쓰고 검사한다. 계약: SPEC.md

  python3 scripts/content/jp-city/vehicles/build_vehicles.py            # 검사 + public/assets/jp-city/vehicles/*.png + src/assets/jpCityVehicles.json
  python3 scripts/content/jp-city/vehicles/build_vehicles.py --preview  # + tiledata/jp-city/vehicles/preview-*.png (눈 확인용)
  python3 scripts/content/jp-city/vehicles/build_vehicles.py --check    # 쓰지 않고 검사만(현재 파일과 바이트 비교)

같은 입력이면 같은 바이트(시트 PNG 는 optimize 저장, JSON 은 키 순서 고정).
"""
import argparse, importlib, io, json, os, sys
import numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..', '..', '..'))
sys.path.insert(0, HERE)
sys.path.insert(0, os.path.join(HERE, '..', '..', 'atlas-pick'))
sys.path.insert(0, os.path.join(HERE, '..', 'lib'))
from modern3_check import load_pal  # noqa: E402

MODULES = ('cars', 'heavy')
OUT_DIR = os.path.join(ROOT, 'public', 'assets', 'jp-city', 'vehicles')
OUT_URL = '/assets/jp-city/vehicles'
OUT_JSON = os.path.join(ROOT, 'src', 'assets', 'jpCityVehicles.json')
PREVIEW_DIR = os.path.join(ROOT, 'tiledata', 'jp-city', 'vehicles')
KINDS = ('car', 'taxi', 'kei', 'truck', 'bus', 'tram', 'train', 'subway')
DIRS = ('right', 'left', 'up', 'down', 'right_open', 'left_open')
RISE_MAX = 32          # 발자국 위로 솟는 최대 높이(px)


def _palette():
    pal = load_pal()
    cols = set()
    for v in (pal.values() if isinstance(pal, dict) else pal):
        for c in v:
            cols.add(c if isinstance(c, int) else (int(c[0]) << 16) | (int(c[1]) << 8) | int(c[2]))
    return cols


def frame_problems(vid, d, a, L):
    out = []
    if not isinstance(a, np.ndarray) or a.ndim != 3 or a.shape[2] != 4 or a.dtype != np.uint8:
        return [f'{vid}/{d}: RGBA uint8 배열이 아니다']
    h, w = a.shape[:2]
    side = d.startswith(('right', 'left'))
    want_w = L * 16 if side else 32
    if w != want_w: out.append(f'{vid}/{d}: 폭 {w} ≠ {want_w}')
    foot_h = 32 if side else L * 16
    if not (foot_h <= h <= foot_h + RISE_MAX): out.append(f'{vid}/{d}: 높이 {h} 가 발자국 {foot_h}~{foot_h + RISE_MAX} 밖')
    al = a[..., 3]
    if not np.all((al == 0) | (al == 255)): out.append(f'{vid}/{d}: 반투명 화소 {int(((al != 0) & (al != 255)).sum())}')
    if not al[-6:].any(): out.append(f'{vid}/{d}: 맨 아래 6줄이 비었다 — 그림 아래 가장자리가 발자국 아래에 닿아야 한다')
    rows = np.where(al.any(axis=1))[0]
    if len(rows) and rows[0] > h - foot_h + 4 and h > foot_h: out.append(f'{vid}/{d}: 위쪽 {rows[0]}줄이 비었다 — 그림 높이를 줄여라')
    return out


def collect():
    vehicles = []
    for m in MODULES:
        p = os.path.join(HERE, m + '.py')
        if not os.path.exists(p): continue
        mod = importlib.import_module(m)
        for v in mod.VEHICLES: vehicles.append(dict(v, module=m))
    return vehicles


def build(write=True, preview=False):
    pal = _palette()
    vehicles = collect()
    problems = []
    ids = [v['id'] for v in vehicles]
    if len(ids) != len(set(ids)): problems.append('id 중복')
    catalog = []
    sheets = {}
    for v in vehicles:
        vid, L, kind = v['id'], v['L'], v['kind']
        if not vid.startswith('jp-'): problems.append(f'{vid}: id 는 jp- 로 시작')
        if kind not in KINDS: problems.append(f'{vid}: kind {kind}')
        frames = {}
        for d in DIRS:
            fn = v['frames'].get(d)
            if fn is None: continue
            a = fn() if callable(fn) else fn
            a = np.ascontiguousarray(a)
            problems += frame_problems(vid, d, a, L)
            op = a[..., 3] == 255
            if op.any():
                rgb = (a[..., 0].astype(np.int64) << 16) | (a[..., 1].astype(np.int64) << 8) | a[..., 2].astype(np.int64)
                bad = set(np.unique(rgb[op]).tolist()) - pal
                if bad: problems.append(f'{vid}/{d}: 팔레트 밖 색 {len(bad)}개 예 #{sorted(bad)[0]:06x}')
                if 0xe040c0 in set(np.unique(rgb[op]).tolist()): problems.append(f'{vid}/{d}: 마커색')
            frames[d] = a
        for need in ('right', 'left'):
            if need not in frames: problems.append(f'{vid}: {need} 프레임 없음')
        if kind in ('car', 'taxi', 'kei', 'truck', 'bus') and not ('up' in frames and 'down' in frames):
            problems.append(f'{vid}: 도로 탈것은 up·down 프레임도 필요')
        if kind in ('bus', 'tram', 'train', 'subway') and not ('right_open' in frames and 'left_open' in frames):
            problems.append(f'{vid}: 문 여는 프레임(right_open·left_open) 필요')
        # 가로로 이어 붙인다(프레임 사이 2px 빈칸), 높이는 가장 큰 프레임
        H = max(f.shape[0] for f in frames.values())
        W = sum(f.shape[1] for f in frames.values()) + 2 * (len(frames) - 1)
        sheet = np.zeros((H, W, 4), np.uint8)
        x = 0; rects = {}
        for d in DIRS:
            if d not in frames: continue
            f = frames[d]; h, w = f.shape[:2]
            sheet[H - h:H, x:x + w] = f
            side = d.startswith(('right', 'left'))
            rects[d] = dict(x=x, y=H - h, w=w, h=h, foot=dict(w=L if side else 2, h=2 if side else L))
            x += w + 2
        sheets[vid] = sheet
        catalog.append(dict(id=vid, name=v['name'], kind=kind, length=L, image=f'{OUT_URL}/{vid}.png', width=W, height=H, frames=rects))
    if problems:
        for p in problems: print('  ✗', p)
        return 1
    if write:
        os.makedirs(OUT_DIR, exist_ok=True)
        for vid, s in sheets.items():
            Image.fromarray(s, 'RGBA').save(os.path.join(OUT_DIR, vid + '.png'), optimize=True)
        for fn in os.listdir(OUT_DIR):
            if fn.endswith('.png') and fn[:-4] not in sheets: os.remove(os.path.join(OUT_DIR, fn))
        with open(OUT_JSON, 'w', encoding='utf-8') as f:
            f.write(json.dumps(dict(version=1, tileSize=16, vehicles=catalog), ensure_ascii=False, indent=1) + '\n')
    if preview: render_preview(catalog, sheets)
    print(f'탈것 {len(catalog)}종 · 프레임 {sum(len(c["frames"]) for c in catalog)}')
    return 0


def render_preview(catalog, sheets):
    """도로(아스팔트) 위에 종류별로 4방향을 세워 원본 해상도로 저장 + ×3. 사람 눈금 16×24 막대를 옆에."""
    os.makedirs(PREVIEW_DIR, exist_ok=True)
    asphalt = (86, 84, 96, 255); line = (226, 226, 232, 255)
    for kind_group, kinds in (('road', ('car', 'taxi', 'kei', 'truck', 'bus')), ('rail', ('tram', 'train', 'subway'))):
        items = [c for c in catalog if c['kind'] in kinds]
        if not items: continue
        cols = []
        for c in items:
            s = sheets[c['id']]
            parts = [Image.fromarray(s[r['y']:r['y'] + r['h'], r['x']:r['x'] + r['w']], 'RGBA') for d, r in c['frames'].items()]
            cols.append(parts)
        Wd = max(sum(p.width for p in ps) + 12 * len(ps) + 40 for ps in cols)
        Hd = sum(max(p.height for p in ps) + 20 for ps in cols) + 10
        im = Image.new('RGBA', (min(Wd, 2000), Hd), asphalt)
        y = 10
        for ps in cols:
            x = 30; hh = max(p.height for p in ps)
            # 사람 눈금 16×24
            for yy in range(y + hh - 24, y + hh):
                for xx in range(6, 22): im.putpixel((xx, yy), (240, 200, 160, 255) if yy < y + hh - 14 else (60, 70, 140, 255))
            for p in ps:
                im.alpha_composite(p, (x, y + hh - p.height)); x += p.width + 12
            for xx in range(0, im.width, 8): im.putpixel((xx, y + hh + 6), line)
            y += hh + 20
        im.save(os.path.join(PREVIEW_DIR, f'preview-{kind_group}.png'))
        im.resize((im.width * 3, im.height * 3), Image.NEAREST).save(os.path.join(PREVIEW_DIR, f'preview-{kind_group}-x3.png'))


if __name__ == '__main__':
    ap = argparse.ArgumentParser()
    ap.add_argument('--preview', action='store_true')
    ap.add_argument('--check', action='store_true')
    a = ap.parse_args()
    sys.exit(build(write=not a.check, preview=a.preview))
