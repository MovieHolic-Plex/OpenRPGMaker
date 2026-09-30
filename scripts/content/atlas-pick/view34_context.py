#!/usr/bin/env python3
"""3/4 재작도 맥락 그림: 후보 PNG 를 바닥 위에 놓고 히어로 16×24 를 옆·앞·뒤에 세워 크기·시점을 눈으로 본다.
  python3 scripts/content/atlas-pick/view34_context.py <후보>.png [--in] [--wall]
    기본   실외: 아스팔트 + 보도            --in   실내: 널마루
    --wall 벽 붙은 키 큰 가구: 뒤에 회벽을 깔고 그 앞에 붙인다(실내)
출력: <후보>.v34ctx.png (4배). 왼쪽부터 [히어로 옆 · 후보 · 히어로 앞(후보 밑변 아래) · 히어로 뒤(발이 후보에 가림)].
읽는 법: 후보가 히어로에 견줘 크기가 맞나 / 윗면이 「위에서 내려다본 면」으로 읽히나(앞면과 다른 명도) /
뒤 히어로의 발이 가려질 때 후보 윗면 너머로 몸이 이어져 보이나."""
import os, sys, argparse
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from modern_style_bible_proof import K, Cv, hero
from PIL import Image


def main():
    ap = argparse.ArgumentParser(); ap.add_argument('png'); ap.add_argument('--in', dest='indoor', action='store_true')
    ap.add_argument('--wall', action='store_true'); a = ap.parse_args()
    im = Image.open(a.png).convert('RGBA'); w, h = im.size
    pad = 12; sw = 16
    W = pad + sw + pad + w + pad + sw + pad + sw + pad
    H = max(h + 28, 56) + 2 * pad + (24 if a.wall else 0)
    c = Cv(W, H)
    floor_y = H - pad - 4                                   # 후보 밑변 = 바닥선
    if a.indoor or a.wall:
        for y in range(H):
            for x in range(W): c.P(x, y, K('ita', 1) if (y // 8 + x // 24) % 2 == 0 else K('ita', 0))
        for y in range(0, H, 16): c.HL(0, y, W, K('ita', -1))
    else:
        c.R(0, 0, W, H, K('hodo', 1)); c.R(0, H - 44, W, 44, K('yoru', 2)); c.HL(0, H - 45, W, K('hodo', 3))
    top = floor_y - h
    if a.wall:
        c.R(0, 0, W, top + 6, K('kinari', 1)); c.R(0, 0, W, 8, K('kinari', 0)); c.HL(0, top + 6, W, K('kinari', -2))
    ox = pad + sw + pad
    hero(c, pad, floor_y - 24 + 2)                                       # 옆: 후보 옆에 발을 밑변 근처에
    c.a[...] = c.a                                                        # (Cv 배열 유지)
    from PIL import Image as I
    base = c.img(); base.alpha_composite(im, (ox, top)); c.a[...] = base
    import numpy as np
    c.a = np.array(base)
    hero(c, ox + w + pad, floor_y - 24 + 10)                             # 앞: 후보보다 앞줄(발이 밑변 아래 8px)
    hb = Cv(16, 24); hero(hb, 0, 0)
    hx, hy = ox + w + pad + sw + pad, floor_y - h + 4 - 0                # 뒤: 몸이 후보에 가려지도록, 후보 뒤에서 머리·어깨가 위로 나오게
    hy = top - 8
    for j in range(24):
        for i in range(16):
            if hb.a[j, i, 3] and 0 <= hy + j < H and hy + j < top + 4: c.a[hy + j, hx + i] = hb.a[j, i]   # 후보 윗면 선 아래는 가린다
    out = os.path.splitext(a.png)[0] + '.v34ctx.png'
    Image.fromarray(c.a, 'RGBA').resize((W * 4, H * 4), Image.NEAREST).save(out); print(out)


if __name__ == '__main__':
    main()
