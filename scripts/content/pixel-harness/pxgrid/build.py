#!/usr/bin/env python3
"""시험 작도를 모두 굽는다: 단계마다 PNG(1배)·-x4.png·.txt, 단계 나란히 stages-x4.png, 최종본 final.png.
  python3 scripts/content/pixel-harness/pxgrid/build.py [시험이름…]
"""
import glob, os, shutil, sys
D = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, D)
import pxgrid
TRIALS = os.environ.get('PXGRID_TRIALS', 'trials')

def build(name):
    t = os.path.join(D, TRIALS, name); out = os.path.join(t, 'out'); os.makedirs(out, exist_ok=True)
    stages = sorted(glob.glob(os.path.join(t, '[0-9]-*.pxg')))
    for p in stages:
        pxgrid.render(p, os.path.join(out, os.path.basename(p)[:-4] + '.png'))
    pxgrid.sheet(os.path.join(out, 'stages-x4.png'), stages)
    last = os.path.join(out, os.path.basename(stages[-1])[:-4] + '.png')
    shutil.copyfile(last, os.path.join(out, 'final.png'))
    for v in sorted(glob.glob(os.path.join(t, 'var-*.pxg'))):   # 변형(바닥 타일 등): out/final-<이름>.png
        n = os.path.basename(v)[4:-4]
        pxgrid.render(v, os.path.join(out, os.path.basename(v)[:-4] + '.png'))
        shutil.copyfile(os.path.join(out, os.path.basename(v)[:-4] + '.png'), os.path.join(out, f'final-{n}.png'))
    vs = sorted(glob.glob(os.path.join(out, 'final-?.png')))
    if vs:   # 변형 섞어 깔기 5×3 (A = final.png). 옹이 있는 B 는 드물게.
        from PIL import Image
        m = {'a': Image.open(os.path.join(out, 'final.png'))}
        for v in vs: m[v[-5]] = Image.open(v)
        pat = ['aacca', 'cabac', 'acaac'] if 'b' in m else ['aacca', 'cacac', 'acaac']
        c = m['a'].width; im = Image.new('RGBA', (c * 5, c * 3))
        for j, r in enumerate(pat):
            for i, ch in enumerate(r): im.alpha_composite(m.get(ch, m['a']), (i * c, j * c))
        pxgrid.x4(im, 4).save(os.path.join(out, 'final-mix-x4.png'))
    if pxgrid.Doc(stages[-1]).tile:
        pxgrid.tile(stages[-1], os.path.join(out, 'final-tile3-x4.png'), 3)
    print(name, len(stages), '단계 →', os.path.relpath(os.path.join(out, 'final.png')))
    for r in pxgrid.check(stages[-1]):
        print('   ', r)

if __name__ == '__main__':
    names = sys.argv[1:] or sorted(os.path.basename(p) for p in glob.glob(os.path.join(D, TRIALS, '*')) if os.path.isdir(p))
    for n in names:
        build(n)
