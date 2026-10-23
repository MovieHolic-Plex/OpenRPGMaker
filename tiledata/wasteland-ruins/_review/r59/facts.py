"""object-gate styleFacts 의 파이썬 옮김(같은 셈): 칸당 보이는 색조 중앙값 · 5×5 거의 평면 비율 · 정확 평면 비율 · 칸당 색 수."""
import numpy as np
def facts(a):
    H, W = a.shape[:2]; op = a[..., 3] >= 128
    key = (a[..., 0].astype(np.int64) << 16) | (a[..., 1].astype(np.int64) << 8) | a[..., 2]
    b = ((a[..., 0] >> 4).astype(np.int64) << 8) | ((a[..., 1] >> 4).astype(np.int64) << 4) | (a[..., 2] >> 4)
    tones, cols = [], []
    for ty in range(0, H, 16):
        for tx in range(0, W, 16):
            m = op[ty:ty + 16, tx:tx + 16]
            if m.sum() >= 128:
                tones.append(len(set(b[ty:ty + 16, tx:tx + 16][m].tolist()))); cols.append(len(set(key[ty:ty + 16, tx:tx + 16][m].tolist())))
    def flat(k):
        f = np.zeros((H, W), bool)
        for y in range(H - 4):
            for x in range(W - 4):
                blk = k[y:y + 5, x:x + 5]
                if op[y:y + 5, x:x + 5].all() and (blk == blk[0, 0]).all(): f[y:y + 5, x:x + 5] = True
        return round(f.sum() / op.sum(), 3)
    return dict(visibleTones=sorted(tones)[len(tones) // 2], nearFlat=flat(b), flat=flat(key), colorsPerTile=sorted(cols)[len(cols) // 2], distinct=len(set(key[op].tolist())))
if __name__ == '__main__':
    import sys
    from PIL import Image
    for p in sys.argv[1:]: print(p, facts(np.array(Image.open(p).convert('RGBA'))))
