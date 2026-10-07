"""예제 맵 미리보기(굽기 전): python3 preview_example.py <모듈> → tiledata/wizarding/review/<모듈>-example-<id>.png (1배·3배)
다른 모듈의 조각 id 를 쓰면 그 모듈도 불러온다(없으면 빨간 상자로 표시)."""
import os, sys
from PIL import Image, ImageDraw
HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, HERE)
import loader, wzlib  # noqa: E402


def render_example(ex, pieces, autos):
    W, H = ex['w'] * 16, ex['h'] * 16
    im = Image.new('RGBA', (W, H), (0, 0, 0, 255))
    fl = ex['floor']
    if fl in autos:
        _, tiles, _, _ = wzlib.autotile_cells(autos[fl][1]); t = tiles[255]
    elif fl in pieces:
        t = wzlib.render_piece(pieces[fl][1]).img().crop((0, 0, 16, 16))
    else: t = None
    missing = []
    if t is not None:
        for y in range(ex['h']):
            for x in range(ex['w']): im.alpha_composite(t, (x * 16, y * 16))
    d = ImageDraw.Draw(im)
    for pid, x, y in ex['place']:
        if pid in pieces:
            im.alpha_composite(wzlib.render_piece(pieces[pid][1]).img(), (x * 16, y * 16))
        elif pid in autos:
            _, tiles, _, _ = wzlib.autotile_cells(autos[pid][1]); im.alpha_composite(tiles[255], (x * 16, y * 16))
        else:
            missing.append(pid); d.rectangle([x * 16, y * 16, x * 16 + 15, y * 16 + 15], outline=(255, 0, 0, 255))
    return im, missing


def main(mod):
    regs, errs = loader.load_all(sorted(set(loader.module_names()) | {mod}), quiet=True)
    if mod not in regs: print(errs.get(mod, f'{mod} 없음')); return 1
    pieces, autos = loader.index(regs)
    rc = 0
    for ex in regs[mod].examples:
        im, missing = render_example(ex, pieces, autos)
        base = os.path.join(wzlib.TD, 'review', f"{mod}-example-{ex['id']}")
        os.makedirs(os.path.dirname(base), exist_ok=True)
        im.save(base + '.png'); im.resize((im.width * 3, im.height * 3), Image.NEAREST).save(base + '-x3.png')
        print(f"{ex['id']} {ex['w']}x{ex['h']} → {base}.png" + (f'  ✗ 없는 id: {sorted(set(missing))}' if missing else ''))
        rc |= bool(missing)
    return rc


if __name__ == '__main__':
    sys.exit(main(sys.argv[1]))
