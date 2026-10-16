"""생성 도트 그림 → 진짜 도트: 그림 안의 가짜 픽셀 격자를 찾아 칸마다 최빈 색을 고른다.
BOX 축소는 격자와 어긋나 칸 경계를 섞어 「잘게 갈라진 색 조각」을 만든다. 격자를 따라 자르면 생성기가 고른 도트가 그대로 남는다.
사용: python3 grid.py in.png out.png [--max 96]"""
import sys, math
from collections import Counter
import numpy as np
from PIL import Image

def oklab(rgb):
    c = rgb / 255.0
    c = np.where(c <= 0.04045, c / 12.92, ((c + 0.055) / 1.055) ** 2.4)
    l = 0.4122214708*c[...,0] + 0.5363325363*c[...,1] + 0.0514459929*c[...,2]
    m = 0.2119034982*c[...,0] + 0.6806995451*c[...,1] + 0.1073969566*c[...,2]
    s = 0.0883024619*c[...,0] + 0.2817188376*c[...,1] + 0.6299787005*c[...,2]
    l, m, s = np.cbrt(l), np.cbrt(m), np.cbrt(s)
    return np.stack([0.2104542553*l + 0.7936177850*m - 0.0040720468*s,
                     1.9779984951*l - 2.4285922050*m + 0.4505937099*s,
                     0.0259040371*l + 0.7827717662*m - 0.8086757660*s], -1)

def is_bg(a):
    r, g, b = a[...,0].astype(int), a[...,1].astype(int), a[...,2].astype(int)
    return (r > 170) & (b > 170) & (g < 120) & (np.abs(r - b) < 70)

def votes_of(profile):
    pr = np.convolve(profile, [0.25, 0.5, 0.25], 'same')
    thr = pr.mean() + 0.5 * pr.std()
    peaks = [i for i in range(1, len(pr)-1) if pr[i] >= pr[i-1] and pr[i] > pr[i+1] and pr[i] > thr]
    d = np.diff(peaks); d = d[(d >= 5) & (d <= 40)]
    v = Counter()
    for x in d:
        for k in (1, 2, 3):
            q = x / k
            if 5 <= q <= 40: v[round(q)] += 1.0 / k
    return v

def lines(profile, p_guess=None):
    n = len(profile)
    pr = np.convolve(profile, [0.25, 0.5, 0.25], 'same')
    thr = pr.mean() + 0.5 * pr.std()
    peaks = [i for i in range(1, n-1) if pr[i] >= pr[i-1] and pr[i] > pr[i+1] and pr[i] > thr]
    d = np.diff(peaks)
    d = d[(d >= 5) & (d <= 40)]
    # 블록 크기: 간격 히스토그램에서 가장 많은 값(배수 간격은 기본 주기로 나눠 센다)
    votes = Counter()
    for v in d:
        for k in (1, 2, 3):
            q = v / k
            if 5 <= q <= 40: votes[round(q)] += 1.0 / k
    p = p_guess or max(votes, key=votes.get)
    out = [peaks[0] % p if peaks else 0]
    if out[0] > 0: out = [out[0] - p] if out[0] - p >= -p else out
    cur = out[0]
    ps = set(peaks)
    while cur + p < n + p:
        lo, hi = int(cur + 0.6*p), int(cur + 1.4*p)
        cand = [q for q in range(lo, hi+1) if q in ps]
        nxt = min(cand, key=lambda q: abs(q - cur - p)) if cand else cur + p
        out.append(nxt); cur = nxt
    return [max(0, min(n, v)) for v in out], p

def run(src, dst, maxn=128):
    im = np.array(Image.open(src).convert('RGB'))
    bg = is_bg(im)
    # 마젠타가 아닌 단색 배경(검정 등): 네 모서리 색과 가까운 픽셀 중 가장자리와 이어진 것만 배경
    corners = np.concatenate([im[:12, :12].reshape(-1, 3), im[:12, -12:].reshape(-1, 3), im[-12:, :12].reshape(-1, 3), im[-12:, -12:].reshape(-1, 3)])
    if not is_bg(corners[None]).mean() > 0.5:
        from scipy import ndimage
        ref = oklab(np.median(corners, 0)[None].astype(float))[0]
        near = np.linalg.norm(oklab(im.astype(float)) - ref, axis=-1) < 0.07
        lab_, _ = ndimage.label(near)
        edge_ids = set(np.unique(np.concatenate([lab_[0], lab_[-1], lab_[:, 0], lab_[:, -1]]))) - {0}
        bg = bg | np.isin(lab_, list(edge_ids))
    lab = oklab(im.astype(float))
    lab[bg] = [2, 2, 2]  # 배경 경계도 강하게
    dx = np.abs(np.diff(lab, axis=1)).sum(-1).sum(0)
    dy = np.abs(np.diff(lab, axis=0)).sum(-1).sum(1)
    v = votes_of(np.r_[0, dx]) + votes_of(np.r_[0, dy])
    p = max(v, key=v.get)
    xs, px_ = lines(np.r_[0, dx], p)
    ys, py_ = lines(np.r_[0, dy], p)
    W, H = len(xs)-1, len(ys)-1
    cells = np.zeros((H, W, 4), np.uint8)
    for j in range(H):
        for i in range(W):
            x0, x1, y0, y1 = xs[i], xs[i+1], ys[j], ys[j+1]
            if x1 - x0 < 2 or y1 - y0 < 2: continue
            mx, my = max(1, (x1-x0)//4), max(1, (y1-y0)//4)  # 경계 번짐 빼고 가운데만
            blk = im[y0+my:y1-my, x0+mx:x1-mx].reshape(-1, 3)
            bgb = bg[y0+my:y1-my, x0+mx:x1-mx].reshape(-1)
            if bgb.size == 0 or bgb.mean() > 0.5: continue
            q = (blk[~bgb] // 6).astype(int)
            key = Counter(map(tuple, q)).most_common(1)[0][0]
            sel = blk[~bgb][(q == key).all(1)]
            cells[j, i, :3] = sel.mean(0).round(); cells[j, i, 3] = 255
    a = cells[..., 3] > 0
    border = np.concatenate([cells[0], cells[-1], cells[:, 0], cells[:, -1]])
    bo = border[border[:, 3] > 0]
    if len(bo) > len(border) * 0.3:
        bgc = oklab(np.array([Counter(map(tuple, bo[:, :3] // 8 * 8)).most_common(1)[0][0]], float) + 4)[0]
        lab_c = oklab(cells[..., :3].astype(float))
        near = a & (np.linalg.norm(lab_c - bgc, axis=-1) < 0.08)
        H_, W_ = a.shape; st = [(y, x) for y in range(H_) for x in (0, W_-1)] + [(y, x) for x in range(W_) for y in (0, H_-1)]
        seen = np.zeros_like(a)
        while st:
            y, x = st.pop()
            if not (0 <= y < H_ and 0 <= x < W_) or seen[y, x]: continue
            seen[y, x] = True
            if a[y, x] and not near[y, x]: continue
            cells[y, x, 3] = 0
            st += [(y+1, x), (y-1, x), (y, x+1), (y, x-1)]
        a = cells[..., 3] > 0
    ys_, xs_ = np.where(a)
    cells = cells[ys_.min():ys_.max()+1, xs_.min():xs_.max()+1]
    cells, ncol = tidy(cells)
    Image.fromarray(cells, 'RGBA').save(dst)
    return dict(block=(px_, py_), size=cells.shape[1::-1], colors=ncol)

def tidy(c, kmax=20):
    a = c[..., 3] > 0
    H, W = a.shape
    # 1) 마젠타 번짐 칸 제거
    lab = oklab(c[..., :3].astype(float))
    mag = oklab(np.array([[255., 0, 255]]))[0]
    a &= np.linalg.norm(lab - mag, axis=-1) > 0.18
    # 2) 작은 섬 제거
    seen = np.zeros_like(a)
    for y in range(H):
        for x in range(W):
            if a[y, x] and not seen[y, x]:
                st = [(y, x)]; seen[y, x] = 1; comp = []
                while st:
                    cy, cx = st.pop(); comp.append((cy, cx))
                    for dy, dx in ((1,0),(-1,0),(0,1),(0,-1)):
                        ny, nx = cy+dy, cx+dx
                        if 0 <= ny < H and 0 <= nx < W and a[ny, nx] and not seen[ny, nx]: seen[ny, nx] = 1; st.append((ny, nx))
                if len(comp) < 6:
                    for p in comp: a[p] = False
    # 3) 팔레트: 가까운 색을 많은 색 쪽으로 합친다 (kmax 이하가 될 때까지 문턱을 올린다)
    cols = Counter(map(tuple, c[a][:, :3]))
    order = [k for k, _ in cols.most_common()]
    L = {k: oklab(np.array([k], float))[0] for k in order}
    thr = 0.03
    while True:
        reps = []
        m = {}
        for k in order:
            best = min(reps, key=lambda r: np.linalg.norm(L[k]-L[r])) if reps else None
            if best is not None and np.linalg.norm(L[k]-L[best]) < thr: m[k] = best
            else: reps.append(k); m[k] = k
        if len(reps) <= kmax: break
        thr += 0.01
    out = np.zeros_like(c)
    for y in range(H):
        for x in range(W):
            if a[y, x]: out[y, x, :3] = m[tuple(c[y, x, :3])]; out[y, x, 3] = 255
    # 4) 외톨이 점: 네 이웃 중 같은 색이 없고 이웃 최빈 색과 가까우면 흡수
    o2 = out.copy()
    for y in range(H):
        for x in range(W):
            if not out[y, x, 3]: continue
            nb = [tuple(out[y+dy, x+dx]) for dy, dx in ((1,0),(-1,0),(0,1),(0,-1)) if 0 <= y+dy < H and 0 <= x+dx < W]
            me = tuple(out[y, x])
            if me in nb: continue
            nbo = [n for n in nb if n[3]]
            if len(nbo) < 3: continue
            mode = Counter(nbo).most_common(1)[0][0]
            if np.linalg.norm(L[me[:3]] - L[mode[:3]]) < 0.09: o2[y, x] = mode
    return o2, len(reps)

if __name__ == '__main__':
    print(run(sys.argv[1], sys.argv[2]))
