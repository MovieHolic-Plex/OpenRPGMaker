import sys, os; sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import numpy as np
from PIL import Image
import iaf_ground as G
from iaf_base import soft_mask
W, H = 30, 22
Wp, Hp = W*16, H*16
img = Image.fromarray(G.snow_rgb(Wp, Hp, 31)).convert('RGBA')
cm = np.zeros((H, W), bool); cm[9:19, 5:26] = True
lake = soft_mask(np.kron(cm, np.ones((16,16),bool)), 5, 6, 10)
img.alpha_composite(G.ice_layer(lake, 41))
wc = np.zeros((H, W), bool); wc[13:15, 4:27] = True
wm = soft_mask(np.kron(wc, np.ones((16,16),bool)), 8, 3, 6) & lake
img.alpha_composite(G.water_layer(wm, 51))
GT = [2 + (x//7)%2 for x in range(W)]; FH=[4]*W
gl, fm, tm, lip, bot = G.glacier_layer(GT, FH, W, 61)
img.alpha_composite(gl, (0,0))
sh = G.glacier_shadow(bot, Wp, gl.height)
A = np.array(img).astype(float); m = np.zeros((Hp,Wp),bool); m[:gl.height]=sh[:Hp] & ~(fm|tm)[:Hp]
A[m,:3]*=np.array((0.72,0.76,0.9)); img=Image.fromarray(A.astype(np.uint8))
img.resize((Wp*2,Hp*2),Image.NEAREST).save(os.path.join(os.path.dirname(os.path.abspath(__file__)),'t_ground.png'))
