# REFMAP 실내 팩을 재는 스크립트. 팩 그림은 저장소에 없다(서드파티 상용) — 로컬 다운로드 경로에서 읽기만 하고 수치만 낸다.
# 저장소 루트에서: python3 tiledata/hand-interior/refmap-study/measure.py [out.json]
import sys, json, os, colorsys
import numpy as np
from PIL import Image
from scipy import ndimage

PACK = os.path.expanduser('~/.local/share/oprn/refmap-downloads/_packs/refmap-interior/')

def load(name):
    return np.array(Image.open(PACK + name).convert('RGBA')).astype(np.int32)

def lum(a): return 0.299 * a[..., 0] + 0.587 * a[..., 1] + 0.114 * a[..., 2]

def grid_evidence(a):
    """타일 경계에서 불투명 내용이 끊기는 정도: 경계 교차 수 / 반칸 교차 수. 진짜 칸 크기에서 1 보다 작다."""
    op = a[..., 3] > 0; H, W = op.shape; out = {}
    for T in (16, 24, 32, 48):
        e = [(op[:, x - 1] & op[:, x]).sum() for x in range(T, W, T)]
        m = [(op[:, x - 1] & op[:, x]).sum() for x in range(T // 2, W - T // 2, T)]
        eh = [(op[y - 1] & op[y]).sum() for y in range(T, H, T)]
        mh = [(op[y - 1] & op[y]).sum() for y in range(T // 2, H - T // 2, T)]
        out[T] = round((np.mean(e) + np.mean(eh)) / max(1e-6, np.mean(m) + np.mean(mh)), 3)
    return out

def pixel_scale(a):
    """가로 같은 색 연속 길이 분포. 2·3 배 확대 그림이면 2·3 칸 연속이 주가 된다."""
    op = a[..., 3] == 255
    same = (a[:, 1:] == a[:, :-1]).all(-1) & op[:, 1:] & op[:, :-1]
    return round(float(same.sum() / max(1, op.sum())), 3)

def obj_stats(a):
    op = a[..., 3] > 0; full = a[..., 3] == 255
    rgb = a[..., :3]; L = lum(a)
    cols = {tuple(c) for c in rgb[full].reshape(-1, 3).tolist()}
    # 90% 를 덮는 색 수
    vals, cnt = np.unique(rgb[full].reshape(-1, 3), axis=0, return_counts=True)
    cs = np.cumsum(np.sort(cnt)[::-1]) / max(1, cnt.sum())
    c90 = int(np.searchsorted(cs, 0.9) + 1) if len(cs) else 0
    # 속 명도차 (이웃 4방향, 둘 다 불투명)
    dx = np.abs(L[:, 1:] - L[:, :-1])[full[:, 1:] & full[:, :-1]]
    dy = np.abs(L[1:] - L[:-1])[full[1:] & full[:-1]]
    d = np.concatenate([dx, dy]) if len(dx) + len(dy) else np.array([0])
    # 윤곽: 불투명인데 이웃에 투명(알파<128)이 있는 칸
    solid = a[..., 3] >= 128
    er = ndimage.binary_erosion(solid)
    edge = solid & ~er
    inner = er
    eL = L[edge].mean() if edge.any() else 0; iL = L[inner].mean() if inner.any() else 0
    black = float((L[edge] < 28).mean()) if edge.any() else 0
    # 윤곽 색상: 안쪽 평균 색상과 같은 계열인지 (채도·색상)
    def hs(px):
        m = px.reshape(-1, 3).mean(0) / 255; h, l, s = colorsys.rgb_to_hls(*m); return round(h * 360), round(s, 2)
    semi = float(((a[..., 3] > 0) & (a[..., 3] < 255)).sum() / max(1, op.sum()))
    return dict(px=int(op.sum()), colors=len(cols), colors90=c90, inner_dL=round(float(d.mean()), 1),
                big_dL=round(float((d > 40).mean()), 3), edge_L=round(float(eL), 1), inner_L=round(float(iL), 1),
                edge_black=round(black, 3), edge_hs=hs(rgb[edge]) if edge.any() else None,
                inner_hs=hs(rgb[inner]) if inner.any() else None, semi_alpha=round(semi, 3))

# 이름 → (시트, 상자 x0,y0,x1,y1)   B/C 시트 좌표(48px 칸)
OBJ = {
    'bed_white':   ('B', (0, 640, 48, 768)),
    'bed_pink':    ('B', (96, 640, 144, 768)),
    'drawer_shelf': ('B', (0, 288, 144, 416)),
    'cupboard':    ('B', (144, 288, 192, 384)),
    'barrel_1':    ('B', (720, 192, 768, 288)),
    'barrel_stack': ('B', (624, 96, 720, 192)),
    'sack':        ('B', (576, 288, 624, 336)),
    'jar_blue':    ('B', (672, 288, 720, 336)),
    'jar_clay':    ('B', (720, 288, 768, 336)),
    'stool':       ('B', (48, 0, 96, 48)),
    'fireplace':   ('B', (240, 0, 336, 144)),
    'potted_plant': ('B', (0, 528, 48, 624)),
    'clock':       ('B', (96, 432, 144, 528)),
    'armor':       ('B', (192, 528, 240, 624)),
    'table_big':   ('C', (0, 96, 144, 240)),
    'chairs':      ('C', (48, 0, 144, 96)),
    'stove':       ('C', (336, 0, 384, 144)),
    'cauldron':    ('C', (384, 240, 480, 336)),
}
SHEETS = {'B': 'B_REFMAP_Interior.png', 'C': 'C_REFMAP_Interior.png'}

def floor_wall():
    """A5 평바닥·벽 한 칸 결: 행 명도 자기상관으로 판 높이, 속 명도차."""
    a = load('A5_REFMAP_Interior.png'); out = {}
    def tile(cx, cy, w=1, h=1): return a[cy * 48:(cy + h) * 48, cx * 48:(cx + w) * 48]
    def period(prof):
        p = prof - prof.mean(); best = (0, 0)
        for k in range(4, 30):
            r = float((p[:-k] * p[k:]).mean() / max(1e-6, (p * p).mean()))
            if r > best[1]: best = (k, r)
        return best
    for name, (cx, cy, w, h) in {'plank_light_h': (0, 2, 1, 1), 'plank_light_v': (1, 2, 1, 1), 'flag_stone': (0, 6, 1, 1),
                                  'brick_wall_face': (0, 8, 1, 2), 'plaster_wall_face': (6, 8, 1, 2), 'check_tile': (6, 6, 1, 1)}.items():
        t = tile(cx, cy, w, h); L = lum(t)
        rp = period(L.mean(1)); cp = period(L.mean(0))
        s = obj_stats(t)
        out[name] = dict(row_period=rp[0], row_r=round(rp[1], 2), col_period=cp[0], col_r=round(cp[1], 2),
                         inner_dL=s['inner_dL'], colors=s['colors'], colors90=s['colors90'],
                         L_min=round(float(L.min()), 1), L_max=round(float(L.max()), 1))
    return out

def main():
    res = {'grid': {}, 'pixel_same_run': {}, 'objects': {}}
    for f in sorted(os.listdir(PACK)):
        if f.endswith('.png'):
            a = load(f); res['grid'][f] = grid_evidence(a); res['pixel_same_run'][f] = pixel_scale(a)
            res.setdefault('sizes', {})[f] = [int(a.shape[1]), int(a.shape[0])]
    for k, (s, box) in OBJ.items():
        a = load(SHEETS[s])[box[1]:box[3], box[0]:box[2]]
        res['objects'][k] = obj_stats(a)
    res['surfaces'] = floor_wall()
    return res

if __name__ == '__main__':
    r = main(); txt = json.dumps(r, ensure_ascii=False, indent=1)
    if len(sys.argv) > 1: open(sys.argv[1], 'w').write(txt)
    print(txt)
