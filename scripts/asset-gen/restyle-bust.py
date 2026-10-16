"""생성 도트 반신상을 몬스터 도트 규격(단색 면 · 1px 어두운 윤곽 · 적은 색 · 디더 없음)에 맞춰 다시 정리한다.
pixelize-grid.py 가 만든 122×97 도트(격자 복원 완료)를 입력으로 받아 크기·격자를 그대로 두고 색·잡티·윤곽만 손본다. 새 이미지 생성 호출이 없다.
사용: python3 restyle-bust.py in.png out.png --colors 24 [--tones 3] [--despeckle 2] [--outline flat|selective|none]
  --colors   최종 색 수 상한(윤곽색 포함). 몬스터 도트는 13~19색이다.
  --tones    색상(hue) 묶음마다 허용하는 명암 단계 수. 0 이면 제한하지 않는다(몬스터는 3~4단).
  --despeckle  외톨이 점 정리 횟수. 같은 색 이웃이 없는 점·1~2칸짜리 얼룩을 이웃 최빈 색으로 흡수한다.
  --outline  flat: 실루엣 가장자리 1px 을 한 가지 어두운 색으로 / selective: 자기 색을 어둡게 한 색 / none."""
import argparse
import numpy as np
from PIL import Image
from collections import Counter


def to_oklab(rgb):
    c = np.asarray(rgb, float) / 255.0
    c = np.where(c <= 0.04045, c / 12.92, ((c + 0.055) / 1.055) ** 2.4)
    l = 0.4122214708 * c[..., 0] + 0.5363325363 * c[..., 1] + 0.0514459929 * c[..., 2]
    m = 0.2119034982 * c[..., 0] + 0.6806995451 * c[..., 1] + 0.1073969566 * c[..., 2]
    s = 0.0883024619 * c[..., 0] + 0.2817188376 * c[..., 1] + 0.6299787005 * c[..., 2]
    l, m, s = np.cbrt(l), np.cbrt(m), np.cbrt(s)
    return np.stack([0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s,
                     1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s,
                     0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s], -1)


def kmeans(pts, w, k, seed=7, iters=40):
    rng = np.random.default_rng(seed)
    cent = [pts[rng.choice(len(pts), p=w / w.sum())]]
    for _ in range(1, k):
        d = np.min([((pts - c) ** 2).sum(1) for c in cent], axis=0) * w
        cent.append(pts[rng.choice(len(pts), p=d / d.sum())])
    cent = np.array(cent)
    for _ in range(iters):
        lab = np.argmin(((pts[:, None] - cent[None]) ** 2).sum(-1), axis=1)
        for i in range(k):
            sel = lab == i
            if sel.any():
                cent[i] = (pts[sel] * w[sel, None]).sum(0) / w[sel].sum()
    return cent


def neighbours4(idx, y, x, H, W):
    return [idx[y + dy, x + dx] for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)) if 0 <= y + dy < H and 0 <= x + dx < W]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('src'); ap.add_argument('dst')
    ap.add_argument('--colors', type=int, default=24)
    ap.add_argument('--tones', type=int, default=0)
    ap.add_argument('--despeckle', type=int, default=1)
    ap.add_argument('--outline', default='flat', choices=['flat', 'selective', 'none'])
    ap.add_argument('--outline-color', default='')
    ap.add_argument('--rare', type=float, default=1.0, help='색 묶기 가중치 = 화소 수의 rare 제곱. 1 이면 화소 수 그대로, 0.5 면 드문 색(눈·안경테·별 핀)을 더 지킨다')
    ap.add_argument('--protect', default='', help='x0,y0,x1,y1[;x0,y0,x1,y1...] — 이 사각형 안은 외톨이 점 정리를 건너뛴다(얼굴 눈·안경·수염)')
    a = ap.parse_args()

    im = np.asarray(Image.open(a.src).convert('RGBA'))
    H, W = im.shape[:2]
    op = im[..., 3] > 128
    rgb = im[..., :3]

    # 1) 팔레트: 색을 Oklab 에서 k 개로 묶는다(디더 없음). 윤곽색 한 칸을 따로 둔다.
    k = a.colors - (1 if a.outline != 'none' else 0)
    cols = Counter(map(tuple, rgb[op]))
    keys = list(cols)
    pts = to_oklab(np.array(keys, float))
    w = np.array([cols[c] for c in keys], float) ** a.rare
    cent = kmeans(pts, w, k)
    lab_all = to_oklab(rgb.astype(float))

    # 색상 묶음마다 명암 단계 제한: 같은 hue 안에서 L 을 tones 단으로 다시 묶는다.
    if a.tones > 0:
        hue = np.arctan2(cent[:, 2], cent[:, 1])
        chroma = np.hypot(cent[:, 1], cent[:, 2])
        order = np.argsort(hue)
        groups, cur = [], [order[0]]
        for i in order[1:]:
            if abs(hue[i] - hue[cur[-1]]) < 0.35 and chroma[i] > 0.03 and chroma[cur[0]] > 0.03: cur.append(i)
            else: groups.append(cur); cur = [i]
        groups.append(cur)
        for g in groups:
            if len(g) > a.tones:
                sub = cent[g]
                sw = np.array([w[np.argmin(((pts - c) ** 2).sum(1))] for c in sub])
                new = kmeans(sub, sw, a.tones, seed=3)
                for i in g:
                    cent[i] = new[np.argmin(((new - cent[i]) ** 2).sum(1))]
        cent = np.unique(np.round(cent, 5), axis=0)

    flat = lab_all.reshape(-1, 3)
    idx = np.argmin(((flat[:, None] - cent[None]) ** 2).sum(-1), axis=1).reshape(H, W)
    idx[~op] = -1

    # 2) 외톨이 점·얼룩 정리
    boxes = [[int(v) for v in b.split(',')] for b in a.protect.split(';')] if a.protect else []
    for _ in range(a.despeckle):
        out = idx.copy()
        for y in range(H):
            for x in range(W):
                if idx[y, x] < 0: continue
                if any(b[0] <= x <= b[2] and b[1] <= y <= b[3] for b in boxes): continue
                nb = [n for n in neighbours4(idx, y, x, H, W) if n >= 0]
                same = sum(1 for n in nb if n == idx[y, x])
                if same == 0 and len(nb) >= 3:
                    out[y, x] = Counter(nb).most_common(1)[0][0]
                elif same == 1 and len(nb) >= 3:  # 2칸짜리 얼룩: 이웃 최빈 색이 압도적이면 흡수
                    top, n = Counter(n for n in nb if n != idx[y, x]).most_common(1)[0] if any(n != idx[y, x] for n in nb) else (idx[y, x], 0)
                    if n >= 2 and np.linalg.norm(cent[idx[y, x]] - cent[top]) < 0.12: out[y, x] = top
        idx = out

    # 3) 팔레트 → RGB
    def to_rgb(lab):
        l_ = lab[..., 0] + 0.3963377774 * lab[..., 1] + 0.2158037573 * lab[..., 2]
        m_ = lab[..., 0] - 0.1055613458 * lab[..., 1] - 0.0638541728 * lab[..., 2]
        s_ = lab[..., 0] - 0.0894841775 * lab[..., 1] - 1.2914855480 * lab[..., 2]
        l, m, s = l_ ** 3, m_ ** 3, s_ ** 3
        r = 4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s
        g = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s
        b = -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s
        c = np.stack([r, g, b], -1).clip(0, 1)
        c = np.where(c <= 0.0031308, 12.92 * c, 1.055 * c ** (1 / 2.4) - 0.055)
        return (c * 255).round().astype(np.uint8)

    pal = to_rgb(cent)
    out = np.zeros((H, W, 4), np.uint8)
    m = idx >= 0
    out[m, :3] = pal[idx[m]]
    out[m, 3] = 255

    # 4) 1px 어두운 윤곽: 실루엣 가장자리 안쪽 한 줄(크기 유지)
    if a.outline != 'none':
        pad = np.pad(~m, 1, constant_values=True)
        ring = m & (pad[:-2, 1:-1] | pad[2:, 1:-1] | pad[1:-1, :-2] | pad[1:-1, 2:])
        if a.outline_color:
            oc = np.array([int(a.outline_color[i:i + 2], 16) for i in (1, 3, 5)], np.uint8)
        else:
            dark = pal[np.argmin(cent[:, 0])]
            oc = np.minimum(dark, [26, 22, 20]).astype(np.uint8)
        if a.outline == 'flat':
            out[ring, :3] = oc
        else:  # selective: 자기 색 L 을 0.45 배로 낮춘 색 → 가장 가까운 어두운 팔레트 색
            for y, x in zip(*np.nonzero(ring)):
                c = cent[idx[y, x]].copy(); c[0] *= 0.45
                out[y, x, :3] = to_rgb(c[None])[0]
    Image.fromarray(out, 'RGBA').save(a.dst)
    n = len(Counter(map(tuple, out[m][:, :3])))
    print(f'{a.dst}: {W}x{H} colors={n}')


if __name__ == '__main__':
    main()
