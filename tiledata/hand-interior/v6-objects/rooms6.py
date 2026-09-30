# 예제 방 3장 전후 렌더 (벽·바닥은 v5 그대로, 가구만 v6): python3 tiledata/hand-interior/v6-objects/rooms6.py OUTDIR
import sys, os, copy
sys.path.insert(0, 'tiledata/hand-interior/v6-objects'); sys.path.insert(0, 'tiledata/hand-interior/v5')
import apply6, rooms4, room4
ROOMS = [('bakery', 'bakery'), ('inn', 'inn'), ('manor', 'manor_1f')]
def get(b, key): return next(m for m in rooms4.B[b]['maps'] if m['key'] == key)
def after(m):
    n = dict(m); items = []
    for it in m['items']:
        items.append((apply6.patch_item(it[0]),) + tuple(it[1:]))
    n['items'] = items; return n
def usage(m):
    """방에 놓인 가구 중 v6 로 바뀐 것의 비율"""
    t = len(m['items']); v = sum(1 for it in after(m)['items'] if getattr(it[0], 'v6', False)); return v, t
if __name__ == '__main__':
    out = sys.argv[1]; os.makedirs(out, exist_ok=True)
    for b, key in ROOMS:
        m = get(b, key)
        a = room4.compose(m); z = room4.compose(after(m))
        a.save(f'{out}/room-{key}-v5.png'); z.save(f'{out}/room-{key}-v6.png')
        print(key, a.size, 'v6 가구', usage(m))
