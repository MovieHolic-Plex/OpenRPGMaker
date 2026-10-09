import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from hc_scene import Scene
s = Scene(24, 18, seed=3)
L = s.L
L[:, :] = 1
L[0:9, 0:9] = 2; L[0:6, 9:11] = 2
L[0:4, 11:16] = 0; L[4:12, 12:16] = 0; L[12:13, 13:15] = 0
L[0:7, 16:24] = 2; L[7:10, 19:24] = 2
s.build_faces()
for x in range(2, 8): s.path.add((x, 4))
for x in range(2, 6): s.path.add((x, 13 + (x % 2)))
for y in range(13, 16):
    for x in range(8, 12): s.crop.add((x, y))
for y in range(11, 16):
    for x in range(16, 21): s.dry.add((x, y))
im = s.render()
im.convert('RGB').resize((im.width * 2, im.height * 2), 0).save(os.path.join(os.path.dirname(__file__), 'mini.png'))
