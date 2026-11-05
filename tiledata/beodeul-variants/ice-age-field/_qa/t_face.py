import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
from PIL import Image
import iaf_face2 as F2, iaf_export as E
ims = [E.face_sample()] + [F2.face_variant_sample(k) for k in ('icicles', 'crack', 'snowload', 'rubble')]
W = sum(i.width * 3 + 12 for i in ims)
o = Image.new('RGB', (W, 112 * 3), (24, 24, 30)); x = 0
for i in ims: o.paste(i.convert('RGB').resize((i.width * 3, i.height * 3), 0), (x, 0)); x += i.width * 3 + 12
o.save(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'face-test.png'))
