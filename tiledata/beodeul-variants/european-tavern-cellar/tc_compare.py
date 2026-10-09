# compare-ref.png — 같은 배율(2x)로 [기준 크롭 | 이 장소 크롭]. 기준: 버들항 성(city6_base, 석재)·같은 장르 석조 시가지·합격한 실내(탑 내부).
#   python3 tc_compare.py [--snap TAG]   (--snap 은 현재 크롭을 _qa/cmp-<TAG>-*.png 로 남긴다 — 고침 전후 기록)
import os, sys, glob
from PIL import Image, ImageDraw, ImageFont
try: FONT = ImageFont.truetype('/usr/share/fonts/truetype/nanum/NanumSquareR.ttf', 13)
except Exception: FONT = None
HERE = os.path.dirname(os.path.abspath(__file__))
VAR = os.path.join(HERE, '..')
ROOT = os.path.join(HERE, '..', '..')

def crop(path, box):
    return Image.open(path).convert('RGBA').crop(box)

MINE = os.path.join(HERE, 'render-1x.png')
ROWS = [
    ('버들항 성 마당(석재·소품) | 저장고(벽·자갈·통·선반)', (os.path.join(ROOT, 'beodeul-city', 'render', 'city6_base.png'), (40, 150, 264, 318)), (16, 0, 240, 168)),
    ('석조 시가지(같은 장르) | 아래 식당(판석·가구·창)', (os.path.join(VAR, 'european-quarter-stone', 'render-1x.png'), (560, 120, 784, 288)), (240, 0, 464, 168)),
    ('탑 내부(합격 실내) | 주방(난로·조리대·솥)', (os.path.join(VAR, 'tower-interior', 'render-1x.png'), (0, 120, 224, 288)), (480, 0, 704, 168)),
    ('극장 무대 뒤(합격 실내) | 창고(짚·우물·계단)', (os.path.join(VAR, 'opera-stage', 'render-1x.png'), (800, 0, 1024, 168)), (160, 296, 384, 464)),
]

def build(out, snap=None, extra=()):
    rows = []
    for label, (rp, rb), mb in ROWS:
        a = crop(rp, rb); b = crop(MINE, mb)
        if snap: b.save(os.path.join(HERE, '_qa', 'cmp-%s-%d.png' % (snap, len(rows))))
        rows.append((label, a, b))
    for label, a, b in extra: rows.append((label, a, b))
    S = 2; pad = 10
    W = max(a.width + b.width for _, a, b in rows) * S + pad * 3
    H = sum(max(a.height, b.height) * S + 22 for _, a, b in rows) + pad
    o = Image.new('RGBA', (W, H), (22, 22, 28, 255)); d = ImageDraw.Draw(o); y = pad
    for label, a, b in rows:
        d.text((pad, y), label, fill=(226, 226, 232, 255), font=FONT); y += 16
        o.alpha_composite(a.resize((a.width * S, a.height * S), Image.NEAREST), (pad, y))
        o.alpha_composite(b.resize((b.width * S, b.height * S), Image.NEAREST), (pad * 2 + a.width * S, y))
        y += max(a.height, b.height) * S + 6
    o.convert('RGB').save(out)

if __name__ == '__main__':
    snap = sys.argv[sys.argv.index('--snap') + 1] if '--snap' in sys.argv else None
    extra = []
    hist = sorted(glob.glob(os.path.join(HERE, '_qa', 'fix-*-before.png')))
    for bp in hist:
        ap = bp.replace('-before.png', '-after.png')
        if os.path.exists(ap):
            tag = os.path.basename(bp)[4:-11]
            extra.append(('고침 %s: 전 | 후' % tag, Image.open(bp).convert('RGBA'), Image.open(ap).convert('RGBA')))
    build(os.path.join(HERE, 'compare-ref.png'), snap, extra)
