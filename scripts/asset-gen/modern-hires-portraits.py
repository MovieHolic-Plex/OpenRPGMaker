"""현대 연애 초상 24세트를 매끈한 고해상도 일러스트로 다시 그리는 앞뒤 처리.

  python3 scripts/asset-gen/modern-hires-portraits.py prep <work>   # 도트 전신 → 1024×1536 마젠타 참조
  python3 scripts/asset-gen/modern-hires-portraits.py post <work>   # 생성 원본 → 키잉 → full 768×1130 · bust 512×512

생성은 gen-modern-hires-portraits.mjs 가 한다. post 는 public/assets/shared/portraits/<stem>/ 에 바로 쓴다.
"""
import glob
import os
import sys

import numpy as np
from PIL import Image
from scipy import ndimage

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
PORTRAITS = os.path.join(ROOT, "public/assets/shared/portraits")
EXPRESSIONS = ["base", "happy", "surprised", "sad", "embarrassed"]
FULL_W, FULL_H = 768, 1130
BUST = 512
MAGENTA = (255, 0, 255, 255)


def key(src):
    """마젠타 배경만 지운다. key-magenta.py 와 달리 분홍 후드·라벤더 블라우스 같은 옷 색은 건드리지 않는다:
    배경은 테두리에서 이어진 마젠타, 팔 사이 섬은 거의 순수한 마젠타만, 번짐 제거는 윤곽 3px 띠에서만."""
    im = Image.open(src).convert("RGBA")
    a = np.array(im)
    if a[..., 3].min() < 250:
        out = a
    else:
        rgb = a[..., :3].astype(float)
        d = np.sqrt((rgb[..., 0] - 255) ** 2 + rgb[..., 1] ** 2 + (rgb[..., 2] - 255) ** 2)
        lab, _ = ndimage.label(d < 110)
        edge = set(np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]))) - {0}
        bg = np.isin(lab, list(edge)) | (d < 60)
        dist = ndimage.distance_transform_edt(~bg)
        out = a.copy()
        band = (dist < 3) & ~bg
        r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
        spill = np.clip(np.minimum(r, b) - g - 20, 0, None)
        out[..., 0] = np.where(band, np.clip(r - spill * 0.9, 0, 255), r).astype(np.uint8)
        out[..., 2] = np.where(band, np.clip(b - spill * 0.9, 0, 255), b).astype(np.uint8)
        out[..., 3] = np.where(bg, 0, np.clip(dist / 1.5, 0, 1) * 255).astype(np.uint8)
    o = Image.fromarray(out, "RGBA")
    return o.crop(o.getchannel("A").point(lambda v: 255 if v > 8 else 0).getbbox())


def prep(work):
    os.makedirs(os.path.join(work, "ref"), exist_ok=True)
    for path in sorted(glob.glob(os.path.join(PORTRAITS, "modern-*/full-base.png"))):
        stem = os.path.basename(os.path.dirname(path))
        src = Image.open(path).convert("RGBA")
        scale = min(900 / src.width, 1440 / src.height)
        src = src.resize((round(src.width * scale), round(src.height * scale)), Image.NEAREST)
        canvas = Image.new("RGBA", (1024, 1536), MAGENTA)
        canvas.paste(src, ((1024 - src.width) // 2, 1536 - src.height - 48), src)
        canvas.convert("RGB").save(os.path.join(work, "ref", f"{stem}.png"))


def fit_full(cut):
    scale = min(FULL_W / cut.width, (FULL_H - 24) / cut.height)
    cut = cut.resize((round(cut.width * scale), round(cut.height * scale)), Image.LANCZOS)
    canvas = Image.new("RGBA", (FULL_W, FULL_H), (0, 0, 0, 0))
    canvas.paste(cut, ((FULL_W - cut.width) // 2, FULL_H - cut.height), cut)
    return canvas


def bust_of(full):
    alpha = full.getchannel("A")
    top = alpha.point(lambda v: 255 if v > 8 else 0).getbbox()[1]
    head = alpha.crop((0, top, FULL_W, min(FULL_H, top + 140))).point(lambda v: 255 if v > 8 else 0).getbbox()
    cx = (head[0] + head[2]) // 2 if head else FULL_W // 2
    side = 600
    left = max(0, min(FULL_W - side, cx - side // 2))
    y0 = max(0, top - 24)
    return full.crop((left, y0, left + side, y0 + side)).resize((BUST, BUST), Image.LANCZOS)


def post(work):
    done = 0
    for raw in sorted(glob.glob(os.path.join(work, "raw", "*.png"))):
        name = os.path.basename(raw)[:-4]
        stem, expression = name.rsplit("__", 1)
        if expression not in EXPRESSIONS:
            continue
        full = fit_full(key(raw))
        out = os.path.join(PORTRAITS, stem)
        full.save(os.path.join(out, f"full-{expression}.png"), optimize=True)
        bust_of(full).save(os.path.join(out, f"bust-{expression}.png"), optimize=True)
        done += 1
    print("post", done)


if __name__ == "__main__":
    {"prep": prep, "post": post}[sys.argv[1]](sys.argv[2])
