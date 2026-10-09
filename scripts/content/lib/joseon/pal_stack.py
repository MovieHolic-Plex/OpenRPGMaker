"""검수 시트(tiledata/joseon-demo/review/<조각>.png)를 몇 장씩 세로로 이어 한 번에 읽는다: python3 pal_stack.py <출력접두> <접두> ... — 쪽당 최대 6장."""
import sys, os, glob
from PIL import Image
D = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', '..', '..', 'tiledata', 'joseon-demo', 'review')
out = sys.argv[1]
pres = sys.argv[2:]
files = sorted(f for f in glob.glob(os.path.join(D, 'pal_*.png')) if any(os.path.basename(f).startswith(p) for p in pres))
per = 6
for i in range(0, len(files), per):
    ims = [Image.open(f) for f in files[i:i + per]]
    W = max(im.width for im in ims); H = sum(im.height + 4 for im in ims)
    sh = Image.new('RGB', (W, H), (40, 40, 40))
    y = 0
    for im in ims:
        sh.paste(im, (0, y)); y += im.height + 4
    sh.save('%s%d.png' % (out, i // per))
print(len(files), 'sheets')
