"""첫사랑 엔딩 A·B·C 카드 그림 (VQA r22: B 카드가 커플 그림·C 카드 없음 / VQA r25: A 카드의 남자가 지후와 다르다, B·C 가 같은 서하 그림, 밤에 밀짚모자).

재료는 모두 저장소 안의 그림이다(새로 생성하지 않는다):
  - 배경: public/assets/generated/title/romance-office.jpg 의 왼쪽(사람이 없는 도시 전경)을 잘라 밤으로 색보정
  - 인물: public/assets/shared/portraits/{modern-casual-girl-lavender, modern-casual-boy-hoodie}/full-*.png (공용 전신 초상, 서하·지후)
A = 노을 아래 두 사람, B = 맑은 밤 서하 혼자(왼쪽·허리 위), C = 비 오는 밤 서하 혼자(오른쪽·어깨 위·슬픈 얼굴).
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
PORTRAITS = ROOT / "public/assets/shared/portraits"
SEOHA, JIHU = "modern-casual-girl-lavender", "modern-casual-boy-hoodie"
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


def sunset_city() -> Image.Image:
    """엔딩 A — 석 달 뒤 금요일 저녁: 같은 도시 전경을 노을빛으로."""
    src = Image.open(TITLE / "romance-office.jpg").convert("RGB")
    cw = int(src.height * 16 / 9 * 0.62)
    ch = int(cw * 9 / 16)
    crop = src.crop((0, src.height - ch, cw, src.height)).resize((W, H), Image.LANCZOS)
    a = np.asarray(crop).astype(np.float32) / 255.0
    lum = a.mean(axis=2, keepdims=True)
    ys = np.linspace(0, 1, H, dtype=np.float32)[:, None, None]
    sky = np.array([1.0, 0.62, 0.38], dtype=np.float32) * (1 - ys) + np.array([0.55, 0.30, 0.38], dtype=np.float32) * ys
    out = lum * sky * 1.15 + a * 0.18
    out *= 0.78 + 0.22 * (1 - ys)
    return Image.fromarray(np.clip(out * 255, 0, 255).astype(np.uint8))


def figure(who: str, expr: str, *, flip: bool, height: float, keep: float = 1.0) -> Image.Image:
    """공용 전신 초상 — keep<1 이면 위쪽(머리부터 keep 비율)만 남긴다(엔딩 B: 밤에 든 밀짚모자가 안 보이게)."""
    fig = Image.open(PORTRAITS / who / f"full-{expr}.png").convert("RGBA")
    if flip:
        fig = fig.transpose(Image.FLIP_LEFT_RIGHT)
    fig = fig.crop(fig.getbbox())
    if keep < 1.0:
        fig = fig.crop((0, 0, fig.width, int(fig.height * keep)))
        # 잘린 아래 가장자리는 부드럽게 사라지게
        alpha = np.asarray(fig.getchannel("A")).astype(np.float32)
        fade = int(fig.height * 0.12)
        alpha[-fade:, :] *= np.linspace(1, 0, fade, dtype=np.float32)[:, None]
        fig.putalpha(Image.fromarray(alpha.astype(np.uint8)))
    scale = H * height / fig.height
    return fig.resize((int(fig.width * scale), int(fig.height * scale)), Image.LANCZOS)


def light(fig: Image.Image, shade: tuple[float, float, float], rim_rgb: tuple[int, int, int], rim_left: bool) -> Image.Image:
    a = np.asarray(fig).astype(np.float32)
    a[..., :3] *= np.array(shade, dtype=np.float32)
    xs = np.arange(fig.width, dtype=np.float32) / fig.width
    rim = np.clip(((1 - xs if rim_left else xs) - 0.7) / 0.3, 0, 1)[None, :, None]
    a[..., :3] += rim * np.array(rim_rgb, dtype=np.float32) * (a[..., 3:4] / 255.0)
    return Image.fromarray(np.clip(a, 0, 255).astype(np.uint8), "RGBA")


def rain_layer(seed: int, count: int, alpha: tuple[int, int]) -> Image.Image:
    layer = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    px = layer.load()
    rng = random.Random(seed)
    for _ in range(count):
        x, y, ln = rng.randrange(W), rng.randrange(H), rng.randrange(18, 46)
        al = rng.randrange(*alpha)
        for t in range(ln):
            xx, yy = x - t // 5, y + t
            if 0 <= xx < W and 0 <= yy < H:
                px[xx, yy] = (200, 215, 240, al)
    return layer


def card_a() -> Image.Image:
    """엔딩 A — 노을 아래 서하(왼쪽)와 지후(오른쪽)가 서로를 본다. 게임 속 두 사람의 공용 초상 그대로(타이틀 그림의 다른 남자 대신)."""
    out = sunset_city().convert("RGBA")
    warm = (1.0, 0.86, 0.78)
    seoha = light(figure(SEOHA, "happy", flip=True, height=1.0), warm, (70, 40, 0), rim_left=True)
    jihu = light(figure(JIHU, "happy", flip=True, height=1.06), warm, (70, 40, 0), rim_left=False)
    out.alpha_composite(seoha, (int(W * 0.22) - seoha.width // 2, H - int(seoha.height * 0.93)))
    out.alpha_composite(jihu, (int(W * 0.79) - jihu.width // 2, H - int(jihu.height * 0.93)))
    return out.convert("RGB")


def card_b() -> Image.Image:
    """엔딩 B — 맑은 밤, 혼자 올라와 하늘을 보는 서하(허리 위만, 왼쪽 1/3)."""
    out = night_city(False).convert("RGBA")
    seoha = light(figure(SEOHA, "base", flip=True, height=0.95, keep=0.58), (0.5, 0.54, 0.72), (60, 40, 10), rim_left=True)
    out.alpha_composite(seoha, (int(W * 0.24) - seoha.width // 2, H - seoha.height))
    return out.convert("RGB")


def card_c() -> Image.Image:
    """엔딩 C — 비 오는 회사 앞에 혼자 선 서하. B(맑은 밤·왼쪽·허리 위·담담)와 다르게 오른쪽에 어깨 위로 크게, 슬픈 얼굴,
    인물 앞으로도 굵은 비. 지후를 그리면 «서하 혼자 비 속»인 장면과 어긋났다(VQA r27)."""
    out = night_city(True).convert("RGBA")
    seoha = light(figure(SEOHA, "sad", flip=False, height=0.95, keep=0.42), (0.38, 0.44, 0.60), (20, 30, 50), rim_left=False)
    out.alpha_composite(seoha, (int(W * 0.74) - seoha.width // 2, H - seoha.height))
    out.alpha_composite(rain_layer(97, 1700, (80, 165)))  # 인물 앞으로도 비
    return out.convert("RGB")


def main() -> None:
    card_a().save(TITLE / "first-love-ending-a.jpg", quality=88)
    card_b().save(TITLE / "first-love-ending-b.jpg", quality=88)
    card_c().save(TITLE / "first-love-ending-c.jpg", quality=88)
    print("wrote first-love-ending-a.jpg, first-love-ending-b.jpg, first-love-ending-c.jpg")


if __name__ == "__main__":
    main()
