"""조각 미리보기: python3 preview.py out.png scale name...  (잔디 위, 4배)"""
import sys; sys.path.insert(0, '.')
import catalog
from PIL import Image
out, sc, names = sys.argv[1], int(sys.argv[2]), sys.argv[3:]
o = catalog.objects()
ims = [Image.fromarray(o[n].a) for n in names]
W = sum(i.width * sc + 16 for i in ims) + 16; H = max(i.height * sc for i in ims) + 16
sh = Image.new('RGBA', (W, H), (120, 170, 90, 255)); x = 16
for i in ims:
    j = i.resize((i.width * sc, i.height * sc), Image.NEAREST); sh.alpha_composite(j, (x, 8)); x += j.width + 16
sh.save(out); print(sh.size)
