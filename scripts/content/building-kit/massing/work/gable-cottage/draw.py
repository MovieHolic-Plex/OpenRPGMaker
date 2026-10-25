"""gable-cottage — 박공 정면 오두막(덩어리 모형 2). 4×6 칸(64×96). 박공 끝이 남쪽, 짧은 지붕 깊이, 굴뚝, 다락 창."""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import Canvas, chimney, moss, plaster, eave_shadow, post, beam, brace, window, door  # noqa: E402
from gf import gable_front, foundation  # noqa: E402

W, H = 64, 96
c = Canvas(4, 6)

APEX, KNEE, EAVE, GPEAK = 4, 30, 58, 34
gable_front(c, 0, W - 1, APEX, KNEE, EAVE, GPEAK, 2, W - 3, vshift=2, attic=(10, 8))
# 굴뚝: 왼 사면 위쪽(용마루 가까이)
chimney(c, 13, 5, 22, cw=8, start=1, slope=-1)

# 벽
WX0, WX1 = 2, W - 3
WY0 = EAVE + 3          # 61
beam(c, WX0, WX1, WY0)  # 삼각벽 밑 도리(61~63)
eave_shadow(c, WX0, WY0 + 3, WX1 - WX0 + 1, rows=('-', 'c', 'f', 'l'))
plaster(c, WX0, WY0 + 7, WX1 - WX0 + 1, H - 2 - WY0 - 7, ox=4, oy=1)
for px in (WX0, 27, WX1 - 2):
    post(c, px, WY0 + 3, H - 3)
beam(c, WX0, WX1, H - 7, h=1)
DOOR_X, DOOR_W = 10, 12
door(c, DOOR_X, WY0 + 6, DOOR_W, H - (WY0 + 6) - 2)
window(c, 40, WY0 + 8, w=10, h=11, box=True, shutters=True, look=3)
for (x, y) in [(42, H - 5), (47, H - 4), (55, WY0 + 9)]:
    c.put(x, y, 'z')
foundation(c, WX0, WX1, H - 2, step=(DOOR_X - 1, DOOR_X + DOOR_W))
for (x, y, ch) in [(3, H - 3, 'N'), (4, H - 3, 'O'), (28, H - 3, 'N'), (59, H - 3, 'O'), (60, H - 3, 'N')]:
    c.put(x, y, ch)

meta = {
    'name': '박공 정면 오두막', 'massing': '2', 'material': 'plaster',
    'refs': ['bd-house-h101_2', 'bd-house-lodge'],
    'walk': ['***.', '****', '****', '****', 'XXXX', 'XDXX'],
}
from fixups import finalize  # noqa: E402
finalize(c)
fails, warns = c.save('gable-cottage', meta)
print('fails', fails, 'warns', warns)
