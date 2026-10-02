"""3D 장면 아이콘 세트 빌더 — 세트 폴더의 scenes.py 를 읽어 sheet.png · manifest.json · preview/ 를 만든다.

세트 폴더 규약 (iconsets/<세트>/):
  scenes.py   SET = dict(id, name, camera?, max_new_colors?)
              ORDER = [(역할, 이름, 함수 이름, (칸w, 칸h), 설명), ...]   — kit/roles.json 의 17 역할을 모두 덮는다
              함수 이름() -> oblique.Scene   (카메라·칸 맞춤은 빌더가 한다. 함수는 장면만 짓는다)
  build.py    from buildset import main; main(__file__)

카메라 (2026-10-02 사용자 결정 이후 새 세트 기본):
  정면 카메라 KX=0(동·서 옆면이 화면에 안 잡힌다) · 윗면 비율 KY=.62(성 안·마당이 앞 성벽 위로 드러난다) · 빛은 원래(왼쪽 위).
  사막·동양풍 실험(front_v2)에서 「빛 정면」은 납작했고, 「KY .5」는 뒤 건물이 앞 건물 뒤로 숨었다.
  장면은 처음부터 정면 카메라용으로 짓는다 — 뒤 건물은 앞 건물과 좌우로 엇갈리게, 기단을 높여 머리가 보이게.

칸 맞춤: 큰 캔버스에 찍고 내용 상자를 칸 가운데·아래(1px 여유)에 앉힌다. 넘치면 실패 — 장면을 줄인다.
색: EasyRPG World.png 색 + 세트가 새로 쓴 색(manifest extra_colors 에 16진수로). 새 색 수 한도 SET['max_new_colors'](기본 24).
"""
import importlib.util
import json
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
if str(HERE) not in sys.path:
    sys.path.insert(0, str(HERE))
import numpy as np  # noqa: E402
from PIL import Image, ImageDraw  # noqa: E402
import oblique as ob  # noqa: E402

KEY = np.array([255, 103, 139], np.uint8)
SHADOW = np.array([254, 103, 139], np.uint8)
ROOT = HERE.parents[3]
WORLD_PNG = ROOT / 'public' / 'assets' / 'easyrpg-chipset-world.png'
ROLES = json.loads((HERE.parent.parent / 'kit' / 'roles.json').read_text())['roles']
SHEET_COLS = 32
_ORIG_LIGHT, _ORIG_SUN = ob.LIGHT.copy(), ob.D_SUN.copy()


def camera(kx=0.0, ky=.62, light='orig'):
    """렌더러 전역(투영·빛)을 바꾼다. render() 는 부를 때 전역을 읽으므로 장면을 지은 뒤 찍기 전에만 부르면 된다."""
    ob.KX, ob.KY = kx, ky
    ob.D_VIEW = np.array([-kx, 1.0, -ky])
    if light == 'front':
        L = np.array([0.0, -.35, .8])
        ob.LIGHT, ob.D_SUN = L / np.linalg.norm(L), np.array([0.0, .55, 1.0])
    else:
        ob.LIGHT, ob.D_SUN = _ORIG_LIGHT.copy(), _ORIG_SUN.copy()


def fit(scene, W, H, bottom=1, pad=48):
    """큰 캔버스에 찍고 내용 상자를 W×H 칸 가운데·아래에 앉힌다. 반환 (arr, (내용 w, h), 넘침 여부)."""
    arr, st = ob.render(scene, W + 2 * pad, H + 2 * pad, ox=pad, oy=pad + H)
    arr = ob.finish(arr)
    k = np.all(arr == KEY, -1)
    ys, xs = np.nonzero(~k)
    if len(xs) == 0:
        raise ValueError('빈 장면')
    x0, x1, y0, y1 = xs.min(), xs.max() + 1, ys.min(), ys.max() + 1
    w, h = int(x1 - x0), int(y1 - y0)
    over = w > W or h > H - bottom
    out = np.empty((H, W, 3), np.uint8)
    out[:] = KEY
    w2, h2 = min(w, W), min(h, H - bottom)
    sx = x0 + (w - w2) // 2
    dx, dy = (W - w2) // 2, H - bottom - h2
    out[dy:dy + h2, dx:dx + w2] = arr[y1 - h2:y1, sx:sx + w2]
    return out, (w, h), over, st


def _load(set_dir):
    spec = importlib.util.spec_from_file_location('scenes_' + set_dir.name.replace('-', '_'), set_dir / 'scenes.py')
    mod = importlib.util.module_from_spec(spec)
    sys.path.insert(0, str(set_dir))
    spec.loader.exec_module(mod)
    return mod


def pack(cells):
    order = sorted(range(len(cells)), key=lambda i: (-cells[i][1], -cells[i][0]))
    pos = [None] * len(cells)
    x = y = rowh = 0
    for i in order:
        w, h = cells[i]
        if x + w > SHEET_COLS:
            x, y, rowh = 0, y + rowh, 0
        pos[i] = (x, y)
        x += w
        rowh = max(rowh, h)
    return pos, y + rowh


def on_ground(a, g=(96, 152, 72)):
    o = a.copy()
    o[np.all(a == KEY, -1)] = g
    o[np.all(a == SHADOW, -1)] = (np.array(g) * .65).astype(np.uint8)
    return o


def main(build_file, only=None):
    set_dir = Path(build_file).resolve().parent
    S = _load(set_dir)
    meta = S.SET
    cam = dict(kx=0.0, ky=.62, light='orig')
    cam.update(meta.get('camera', {}))
    role_cells = {r['id']: tuple(r['cells']) for r in ROLES}
    missing = set(role_cells) - {o[0] for o in S.ORDER}
    problems = [f'역할이 빠졌다: {sorted(missing)}'] if missing and not meta.get('partial') else []
    arrs, rows = [], []
    for role, name, fn, cells, desc in S.ORDER:
        if only and fn not in only:
            continue
        if tuple(cells) != role_cells[role]:
            problems.append(f'{fn}: 칸 {cells} ≠ 역할 {role} {role_cells[role]}')
        scene = getattr(S, fn)()
        camera(**cam)
        a, (w, h), over, st = fit(scene, cells[0] * 16, cells[1] * 16)
        if over:
            problems.append(f'{fn}: 내용 {w}x{h} 가 {cells[0] * 16}x{cells[1] * 16} 칸을 넘친다 — 장면을 줄일 것')
        side = int(st['all'].get('right', 0) + st['all'].get('left', 0)) if st else 0
        arrs.append(a)
        rows.append(dict(role=role, name=name, id=fn, cells=list(cells), desc=desc, fill=f'{w}x{h}', side_px=side))
    if only:
        for r, a in zip(rows, arrs):
            (set_dir / 'preview').mkdir(exist_ok=True)
            Image.fromarray(on_ground(a)).resize((a.shape[1] * 8, a.shape[0] * 8), Image.NEAREST).save(set_dir / 'preview' / f'{r["id"]}-8x.png')
        print(json.dumps(dict(rows=rows, problems=problems), ensure_ascii=False, indent=1))
        return rows, problems
    pos, sh = pack([r['cells'] for r in rows])
    sheet = np.zeros((sh * 16, SHEET_COLS * 16, 3), np.uint8)
    sheet[:] = KEY
    for r, a, (c, rr) in zip(rows, arrs, pos):
        sheet[rr * 16:rr * 16 + a.shape[0], c * 16:c * 16 + a.shape[1]] = a
        r['col'], r['row'] = c, rr
    Image.fromarray(sheet).save(set_dir / 'sheet.png')
    world = {tuple(c) for c in np.array(Image.open(WORLD_PNG).convert('RGB')).reshape(-1, 3).tolist()}
    used = {tuple(c) for c in sheet.reshape(-1, 3).tolist()} - {tuple(KEY), tuple(SHADOW)}
    new = sorted(used - world)
    limit = meta.get('max_new_colors', 24)
    if len(new) > limit:
        problems.append(f'새 색 {len(new)}개 > 한도 {limit}')
    manifest = {
        'id': meta['id'], 'name': meta['name'], 'tile': 16, 'key': KEY.tolist(), 'shadow_key': SHADOW.tolist(),
        'sheet': 'sheet.png', 'extra_colors': ['%02x%02x%02x' % c for c in new],
        'camera': cam, 'renderer': '_scene3d (경사 투영 레이캐스터, 정면 카메라)',
        'icons': [{k: r[k] for k in ('role', 'name', 'id', 'cells', 'col', 'row', 'desc')} for r in rows],
        'license': {'note': meta.get('license', '지형 팔레트는 EasyRPG World.png(CC BY 4.0)의 색을 바탕으로 한다. 그림은 이 폴더의 scenes.py 를 '
                                                 '_scene3d 렌더러로 찍은 것이며 생성 이미지·트레이싱이 없다.')},
    }
    for k in ('extends', 'kind'):           # extends: 부분 세트의 바탕 세트 · kind: 'space' 면 땅 대신 우주 배경(성계 지도)
        if meta.get(k):
            manifest[k] = meta[k]
    (set_dir / 'manifest.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=1) + '\n')
    pv = set_dir / 'preview'
    pv.mkdir(exist_ok=True)
    for r, a in zip(rows, arrs):
        Image.fromarray(on_ground(a)).resize((a.shape[1] * 8, a.shape[0] * 8), Image.NEAREST).save(pv / f'{r["id"]}-8x.png')
    big = Image.fromarray(on_ground(sheet)).resize((sheet.shape[1] * 4, sheet.shape[0] * 4), Image.NEAREST)
    d = ImageDraw.Draw(big)
    for r in rows:
        d.text((r['col'] * 64 + 2, r['row'] * 64 + 2), r['id'], fill=(255, 255, 0))
    big.save(pv / 'sheet-4x.png')
    (set_dir / 'build-report.json').write_text(json.dumps(dict(rows=rows, problems=problems, new_colors=len(new)), ensure_ascii=False, indent=1) + '\n')
    print(f'{meta["id"]}: 아이콘 {len(rows)} · 새 색 {len(new)} · 문제 {len(problems)}')
    for p in problems:
        print('  !!', p)
    return rows, problems


if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2:] or None)
