"""빠른 미리보기: python3 view.py <모듈> [id,id,...] [배율] → ~/gothic-scratch/view-<모듈>.png
조각을 어두운 풀밭 위에 Actor1 축척 표본과 나란히(격자선 포함) 놓는다."""
import os, sys
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE); sys.path.insert(0, os.path.join(HERE, 'pieces'))
import loader, gmlib
from PIL import Image, ImageDraw

def main():
    mod = sys.argv[1]
    ids = sys.argv[2].split(',') if len(sys.argv) > 2 and sys.argv[2] not in ('', '-') else None
    z = int(sys.argv[3]) if len(sys.argv) > 3 else 4
    reg = loader.load(mod)
    ps = [p for p in reg.pieces.values() if not ids or p['id'] in ids]
    actor = gmlib._scale_actor()
    ims = []
    for p in ps:
        fr = [gmlib.render_piece(p, f).img() for f in range(p['frames'])]
        w = sum(f.width + 4 for f in fr) + 28; h = max(f.height for f in fr)
        im = Image.new('RGBA', (w, h), (0, 0, 0, 0)); x = 0
        for f in fr: im.alpha_composite(f, (x, 0)); x += f.width + 4
        if actor: im.alpha_composite(actor, (x + 2, h - 32))
        ims.append((p, im))
    for a in reg.autotiles.values():
        if ids and a['id'] not in ids: continue
        masks, tiles, patch, ic = gmlib.autotile_cells(a)
        demo = gmlib._autotile_demo(tiles, n=8)
        im = Image.new('RGBA', (demo.width + 52, demo.height), (0, 0, 0, 0)); im.alpha_composite(demo, (0, 0)); im.alpha_composite(patch.img(), (demo.width + 2, 0))
        ims.append((dict(id=a['id'], w=0, h=0), im))
    for r in reg.runs.values():
        if ids and r['id'] not in ids: continue
        ims.append((dict(id=r['id'], w=0, h=0), gmlib.run_demo(r)))
    W = 1500 // z; x = y = rh = 0; pos = []
    for p, im in ims:
        if x + im.width > W and x: x = 0; y += rh + 12; rh = 0
        pos.append((x, y)); x += im.width + 10; rh = max(rh, im.height)
    H = y + rh + 4
    S = Image.new('RGBA', (W, H), gmlib.RAMPS['grass'][3])
    for (p, im), (px, py) in zip(ims, pos): S.alpha_composite(im, (px, py + 2))
    S = S.resize((W * z, H * z), Image.NEAREST)
    d = ImageDraw.Draw(S)
    for (p, im), (px, py) in zip(ims, pos):
        d.text((px * z + 2, py * z), p['id'][3:], fill=(255, 255, 255, 200))
        if z >= 3:
            for gx in range(0, p['w'] * 16 + 1, 16): d.line([((px + gx) * z, (py + 2) * z), ((px + gx) * z, (py + 2 + p['h'] * 16) * z)], fill=(255, 255, 255, 30))
            for gy in range(0, p['h'] * 16 + 1, 16): d.line([(px * z, (py + 2 + gy) * z), ((px + p['w'] * 16) * z, (py + 2 + gy) * z)], fill=(255, 255, 255, 30))
    out = os.path.expanduser(f'~/gothic-scratch/view-{mod}.png'); S.save(out)
    errs = []
    for p in ps: errs += [f"{p['id']}: {e}" for e in gmlib.check_piece(p)]
    for a in reg.autotiles.values():
        m, t, pa, ic = gmlib.autotile_cells(a); errs += [f"{a['id']}: {e}" for e in gmlib.check_img(pa.img()) + gmlib.check_img(ic.img())]
    for r in reg.runs.values():
        for k, im in gmlib.run_cells(r).items(): errs += [f"{r['id']} m{k}: {e}" for e in gmlib.check_img(im)]
    print(out, len(ps), 'pieces', '\n'.join(errs[:20]))

if __name__ == '__main__': main()
