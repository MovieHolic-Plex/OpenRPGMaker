import sys, os; sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from PIL import Image
import ec_roofs as R, ec_build as B
names = ['house_verdigris','house_verdigris_gable','house_mansard','house_mansard_verd','house_corrugated','house_corrugated3','house_flatroof','house_flatroof_sky','house_zinc_hip']
ims = [B.house(4,2,seed=11), B.house_tall(seed=13)] + [getattr(R,n)() for n in names]
W = sum(i.width for i in ims) + 8*len(ims) + 8; H = max(i.height for i in ims) + 16
o = Image.new('RGBA', (W, H), (70, 110, 60, 255)); x = 8
for i in ims: o.alpha_composite(i, (x, H - 8 - i.height)); x += i.width + 8
o.resize((W*3, H*3), Image.NEAREST).save(sys.argv[1])
