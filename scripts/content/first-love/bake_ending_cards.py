"""첫사랑 엔딩 B·C 카드 그림 — 서하 혼자(VQA r22: 엔딩 B 카드가 커플 그림, 엔딩 C 카드 그림 없음).

재료는 모두 저장소 안의 그림이다(새로 생성하지 않는다):
  - 배경: public/assets/generated/title/romance-office.jpg 의 왼쪽(사람이 없는 도시 전경)을 잘라 밤으로 색보정
  - 인물: public/assets/shared/portraits/modern-casual-girl-lavender/full-*.png (공용 전신 초상, 서하)
글자(「끝」·제목)는 엔딩 카드가 가운데에 쓰므로 인물은 오른쪽 1/3, 가운데는 어둡게 비운다.
실행: python3 scripts/content/first-love/bake_ending_cards.py  (결정적)
"""
from __future__ import annotations

import random
from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter

ROOT = Path(__file__).resolve().parents[3]
TITLE = ROOT / "public/assets/generated/title"
PORTRAIT = ROOT / "public/assets/shared/portraits/modern-casual-girl-lavender"
W, H = 1672, 941


def night_city(rain: bool) -> Image.Image:
    src = Image.open(TITLE / "romance-office.jpg").convert("RGB")
    cw = int(src.height * 16 / 9 * 0.62)
    ch = int(cw * 9 / 16)
    # 아래쪽(강·불 켜진 도시)이 들어오게 그림 아래에 맞춰 자른다.
    crop = src.crop((0, src.height - ch, cw, src.height)).resize((W, H), Image.LANCZOS)
    a = np.asarray(crop).astype(np.float32) / 255.0
    lum = a.mean(axis=2, keepdims=True)
    # 밤: 전체를 남색으로 누르고, 밝은 점(도시 불빛)만 따뜻하게 남긴다.
    tint = np.array([0.20, 0.26, 0.48] if not rain else [0.15, 0.20, 0.34], dtype=np.float32)
    base = lum * tint * (1.25 if not rain else 1.0)
    hi = np.clip((lum - 0.62) / 0.38, 0, 1) ** 1.5
    warm = np.array([1.0, 0.82, 0.55], dtype=np.float32)
    out = base * (1 - hi) + a * warm * hi * (0.95 if not rain else 0.7)
    # 위는 더 어둡게(하늘) — 가운데 글자 자리가 읽히게.
    ys = np.linspace(0, 1, H, dtype=np.float32)[:, None, None]
    out *= 0.72 + 0.28 * ys
    img = Image.fromarray(np.clip(out * 255, 0, 255).astype(np.uint8))
    if not rain:  # 맑은 밤 — 별(엔딩 B: 혼자 올라와 본 밤하늘)
        px = img.load()
        rng = random.Random(7)
        for _ in range(260):
            x, y = rng.randrange(W), rng.randrange(int(H * 0.45))
            v = rng.randrange(170, 255)
            px[x, y] = (v, v, min(255, v + 20))
            if rng.random() < 0.15 and x + 1 < W:
                px[x + 1, y] = (v, v, min(255, v + 20))
    if rain:
        img = img.filter(ImageFilter.GaussianBlur(1.2))
        layer = Image.new("RGBA", (W, H), (0, 0, 0, 0))
        px = layer.load()
        rng = random.Random(41)
        for _ in range(1600):
            x, y, ln = rng.randrange(W), rng.randrange(H), rng.randrange(18, 46)
            alpha = rng.randrange(60, 130)
            for t in range(ln):
                xx, yy = x - t // 5, y + t
                if 0 <= xx < W and 0 <= yy < H:
                    px[xx, yy] = (200, 215, 240, alpha)
        img = Image.alpha_composite(img.convert("RGBA"), layer).convert("RGB")
    return img


def place_seoha(bg: Image.Image, expr: str, rain: bool, left: bool = False) -> Image.Image:
    fig = Image.open(PORTRAIT / f"full-{expr}.png").convert("RGBA")
    if left:  # 왼쪽 1/3 에 세우고 글자(가운데) 쪽을 보게 뒤집는다
        fig = fig.transpose(Image.FLIP_LEFT_RIGHT)
    fig = fig.crop(fig.getbbox())
    scale = H * 1.05 / fig.height
    fig = fig.resize((int(fig.width * scale), int(fig.height * scale)), Image.LANCZOS)
    a = np.asarray(fig).astype(np.float32)
    # 밤빛에 맞춘다: 남색으로 조금 누르고 오른쪽(가로등 쪽) 가장자리만 따뜻하게.
    shade = np.array([0.5, 0.54, 0.72] if not rain else [0.4, 0.45, 0.6], dtype=np.float32)
    a[..., :3] *= shade
    xs = np.arange(fig.width, dtype=np.float32) / fig.width
    rim = np.clip(((1 - xs if left else xs) - 0.7) / 0.3, 0, 1)[None, :, None]
    a[..., :3] += rim * np.array([60, 40, 10], dtype=np.float32) * (a[..., 3:4] / 255.0)
    fig = Image.fromarray(np.clip(a, 0, 255).astype(np.uint8), "RGBA")
    out = bg.convert("RGBA")
    out.alpha_composite(fig, (int(W * (0.27 if left else 0.70)) - fig.width // 2, H - int(fig.height * 0.9)))
    return out.convert("RGB")


def main() -> None:
    b = place_seoha(night_city(False), "base", False, left=True)
    b.save(TITLE / "first-love-ending-b.jpg", quality=88)
    c = place_seoha(night_city(True), "sad", True)
    c.save(TITLE / "first-love-ending-c.jpg", quality=88)
    print("wrote first-love-ending-b.jpg, first-love-ending-c.jpg")


if __name__ == "__main__":
    main()
