"""구성기 시험 출력(compose_probe.ts 의 out.json)을 구운 시트로 그린다: 1층 → 2층 → 3층. 원본 해상도 PNG.
    python3 compose_render.py [/tmp/pic/out.json] [출력 폴더]
"""
import json, os, sys
from PIL import Image
HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..', '..'))
SHEET = Image.open(os.path.join(ROOT, 'public/assets/pirate-isles/pirate-isles-chipset.png')).convert('RGBA')
TPR = 48


def cell(t):
    return SHEET.crop(((t % TPR) * 16, (t // TPR) * 16, (t % TPR) * 16 + 16, (t // TPR) * 16 + 16))


def render(m):
    w, h = m['w'], m['h']
    im = Image.new('RGBA', (w * 16, h * 16), (20, 30, 40, 255))
    cache = {}
    def c(t):
        if t not in cache: cache[t] = cell(t)
        return cache[t]
    for layer in (m['lower'], m.get('l2'), m['upper']):
        if not layer: continue
        for i, t in enumerate(layer):
            if t is None or t < 0: continue
            im.alpha_composite(c(t), ((i % w) * 16, (i // w) * 16))
    return im


if __name__ == '__main__':
    src = sys.argv[1] if len(sys.argv) > 1 else '/tmp/pic/out.json'
    out = sys.argv[2] if len(sys.argv) > 2 else '/tmp/pic'
    d = json.load(open(src))
    for k, m in d.items():
        p = os.path.join(out, k.replace(':', '-') + '.png'); render(m).save(p); print(p, m['summary'])
