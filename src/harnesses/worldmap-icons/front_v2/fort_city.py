exec(open(''+__import__('os').path.join(__import__('os').path.dirname(__file__),'exp.py')+'').read())
from PIL import Image

FW = 6
def fort_front(ob, E, B, wide=True):
    """읍성 — 정면 카메라용 배치. 원래(scenes_b.fort_city)와 같은 부품, 좌표만 정면용으로."""
    s = B.Scene()
    x0, x1, D = (2, 43, 46) if wide else (6, 39, 48)
    s.patch(x0, x1, 4, D - 4, B.court_fn(xr=(21, 24), yr=(16, 19), grass=.2), mat='dirt')
    B.wall(s, x0 - 3, x1 + 3, D - 5, D, 6, edges=('front',))
    B.wall(s, x0 - 3, x0 + 3, 0, D, 6, edges=('front',))
    B.wall(s, x1 - 3, x1 + 3, 0, D, 6, edges=('front',))
    # 관아: 문루 뒤에 일렬로 숨지 않게 더 뒤로, 기단을 높여 문루 지붕 위로 머리가 나오게
    E.hall(s, (x0 + x1) / 2 - 10, 30, 20, 8, 6.5, 8, plat=3.4, mat='tile', npil=5, over=3)
    # 곁채 둘: 관아와 겹치지 않게 양옆 앞쪽으로 엇갈려
    B.house(s, x0 + 3, 21, 7, 4, wh=3.4, rise=3.6)
    B.house(s, x1 - 10, 21, 7, 4, wh=3.4, rise=3.6)
    B.tree(s, x0 + 7, 12, 7, 2.8)
    B.tree(s, x1 - 7, 12, 7, 2.8)
    xc = (x0 + x1) / 2
    B.wall(s, x0 - 3, xc - 6, 0, 4, FW, edges=('front', 'back'))
    B.wall(s, xc + 6, x1 + 3, 0, 4, FW, edges=('front', 'back'))
    B.gatehouse(s, xc, -3, 14, 10, 7, 4.6, 5.8, gate_w=6)
    for tx in (x0 - 1, x1 + 1):
        for ty in (3, D - 3):
            B.corner_tower(s, tx, ty, 8, 5, 6, 5.5)
    return s

out = {}
ob, E, A, B = load(.28, .5, 'orig'); out['before'] = B.fort_city()[0]
ob, E, A, B = load(0, .5, 'front'); a, _ = B.fort_city(); out['after_now'] = a
ob, E, A, B = load(0, .5, 'orig'); out['light_orig'], sz = fit(ob, fort_front(ob, E, B, wide=False) if False else B.Scene() or B.fort_city.__wrapped__ if False else None, 64, 64) if False else (None, None)
for ky in (.62, .66):
  for fw in (6, 4.5):
    FW = fw
    ob, E, A, B = load(0, ky, 'orig')
    out[f'ky{ky}_fw{fw}'], sz = fit(ob, fort_front(ob, E, B), 64, 64); print('ky', ky, fw, sz)
del out['after_now']
G = np.array([96, 152, 72], np.uint8)
def show(a, z=6):
    o = a.copy(); o[(a == KEY).all(2)] = G; o[(a == SHD).all(2)] = (G * .65).astype(np.uint8)
    return Image.fromarray(o).resize((a.shape[1] * z, a.shape[0] * z), Image.NEAREST)
keys = [k for k in out if out[k] is not None]
ims = [show(out[k]) for k in keys]
o = Image.new('RGB', (sum(i.width + 16 for i in ims), ims[0].height), (30, 30, 34)); x = 0
for i in ims: o.paste(i, (x, 0)); x += i.width + 16
o.save('/home/main/z-project/rpg-zzu/.playwright-mcp/fort-exp.png'); print(keys)
