"""『폴른 스타』 오프닝 시차 층 — 이미 고른 오프닝 그림(town·fall)에서 하늘만 투명하게 오려 낸다.

새로 그리는 화소는 없다: 원본 화소를 그대로 두고 알파만 정한다.
- 하늘 = 위 가장자리에서 이어진 「남색 계열」 화소(b > 1.45g, b > 2.2r, g < 110) 의 홍수 채우기.
- 땅 = 아래 가장자리에서 이어진 하늘 아닌 화소. 하늘에 떠 있던 것(구운 별똥별·밝은 별)은 땅과 이어지지 않으니 같이 빠진다.
그러면 오프닝 무대가 그 뒤에 밤하늘 파노라마 세 겹(성운·먼 별·가까운 별)을 서로 다른 깊이로 깔 수 있다.

  python3 scripts/content/fallen-star-opening-cutouts.py
"""
from collections import deque
from pathlib import Path

import numpy as np
from PIL import Image

ART = Path(__file__).resolve().parents[2] / "public/assets/fallen-star/opening/art"


def flood(mask: np.ndarray, seeds: list[tuple[int, int]]) -> np.ndarray:
    h, w = mask.shape
    seen = np.zeros_like(mask)
    q = deque()
    for y, x in seeds:
        if mask[y, x] and not seen[y, x]:
            seen[y, x] = True
            q.append((y, x))
    while q:
        y, x = q.popleft()
        for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            yy, xx = y + dy, x + dx
            if 0 <= yy < h and 0 <= xx < w and mask[yy, xx] and not seen[yy, xx]:
                seen[yy, xx] = True
                q.append((yy, xx))
    return seen


def cut(name: str) -> None:
    rgb = np.array(Image.open(ART / f"{name}.png").convert("RGB")).astype(int)
    h, w, _ = rgb.shape
    r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
    skyish = (b > g * 1.45) & (b > r * 2.2) & (g < 110)
    sky = flood(skyish, [(0, x) for x in range(w)])
    ground = flood(~sky, [(h - 1, x) for x in range(w)])
    alpha = np.where(ground, 255, 0).astype(np.uint8)
    out = np.dstack([rgb.astype(np.uint8), alpha])
    Image.fromarray(out, "RGBA").save(ART / f"{name}-ground.png", optimize=True)
    print(name, "ground px", int(ground.sum()), "of", h * w)


for art in ("town", "fall"):
    cut(art)
