# 몬스터 수집 게임용 마을 부품 칩셋(생성 자산) 빌드.
#
# 입력: tiledata/monster-town-kit/raw/*.png — 이미지 생성 모델 출력 원본(투명 배경 RGBA).
#   스타일 기준은 tiledata/monster-town-kit/ref/houses-4x.png(Scarloxy 집·센터 4배 원본)이다.
# 출력:
#   public/assets/monster-town-kit/monster-town-kit.png   480x512 (16px, 30x32칸) 칩셋
#     위 480칸(0~479) = Scarloxy 초원 마을 시트 그대로(번호 동일), 아래 480칸(480~) = 새 부품.
#     맵 하나는 타일셋 하나만 쓰므로, 잔디·집·나무와 새 부품을 한 맵에 깔려면 한 장이어야 한다
#     (합본 마을 + 레트로 월드맵 시트와 같은 방식).
#   src/assets/monsterTownKitManifest.json               부품 블록 배치(행은 시트 전체 기준)
#
# 원본은 "4배로 그린 픽셀아트"를 흉내 내지만 격자가 정확히 4px 단위가 아니다. 그래서
# 불투명 영역만 잘라 목표 칸 수에 맞게 알파 가중 BOX 축소한 뒤, 알파를 이진화하고
# 팔레트를 줄여 흐림을 없앤다. 가로는 칸 중앙, 세로는 바닥 기준으로 붙인다(지면에 닿게).
#
# 실행: python3 scripts/content/build-monster-town-kit.py

import json
import os

import numpy as np
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
RAW = os.path.join(ROOT, "tiledata", "monster-town-kit", "raw")
GRASSLAND = os.path.join(ROOT, "public", "assets", "scarloxy", "scarloxy-chipset-grassland.png")
OUT_DIR = os.path.join(ROOT, "public", "assets", "monster-town-kit")
OUT_PNG = os.path.join(OUT_DIR, "monster-town-kit.png")
MANIFEST = os.path.join(ROOT, "src", "assets", "monsterTownKitManifest.json")

TILE = 16
COLS, ROWS = 30, 16  # 부품 반쪽의 크기. 시트 전체는 위에 초원 시트 16행이 더 붙는다.
BASE_ROWS = 16
PALETTE_COLORS = 64

# 건물·큰 구조물: (블록 이름, 원본 파일, 가로 칸, 세로 칸, 종류, 시트 col, row)
BUILDINGS = [
    ("item-shop", "shop.png", 6, 6, "structure", 0, 0),
    ("research-lab", "lab.png", 8, 6, "structure", 6, 0),
    ("cave-entrance", "cave.png", 5, 4, "structure", 14, 0),
]

# 소품 시트(props.png)의 성분을 왼쪽부터 이 순서로 읽는다. (블록 이름, 가로 칸, 세로 칸, 종류)
PROPS = [
    ("signpost", 1, 1, "sign"),
    ("mailbox", 1, 1, "rock"),
    ("cuttable-shrub", 1, 1, "shrub"),
    ("boulder", 1, 1, "rock"),
    ("crate", 1, 1, "rock"),
    ("flower-planter", 2, 1, "rock"),
    ("bench", 2, 1, "rock"),
    ("street-lamp", 1, 2, "lamp"),
]
PROP_ORIGIN = (0, 6)  # 소품 줄 시작 칸(col, row). 2칸 높이 줄이며 1칸 소품은 아래 칸에 놓는다.

# 길 부품 시트(route.png). 풀숲은 칸을 꽉 채워야 이어 깔리므로 fill=True 로 비율을 버리고 늘린다.
# (블록 이름, 가로 칸, 세로 칸, 종류, fill)
ROUTE = [
    ("tall-grass-a", 1, 1, "tall-grass", True),
    ("tall-grass-b", 1, 1, "tall-grass", True),
    # 울타리는 가로로 반복하므로 폭을 칸에 꽉 채운다(비율 유지면 2칸마다 틈이 생겼다).
    ("picket-fence", 2, 1, "fence", True),
    ("fence-post", 1, 1, "fence", False),
    ("grass-ledge", 3, 1, "ledge", True),
    ("plank-bridge", 2, 1, "bridge", True),
]
ROUTE_ORIGIN = (0, 8)


def load(name):
    return Image.open(os.path.join(RAW, name)).convert("RGBA")


def crop_opaque(im):
    a = np.array(im)[..., 3]
    ys, xs = np.where(a > 128)
    return im.crop((int(xs.min()), int(ys.min()), int(xs.max()) + 1, int(ys.max()) + 1))


def fit_pixels(im, tiles_w, tiles_h, fill=False):
    """불투명 영역을 칸 상자 안에 비율을 지켜 최대로 맞춘다."""
    box_w, box_h = tiles_w * TILE, tiles_h * TILE
    scale = min(box_w / im.width, box_h / im.height)
    w = max(1, round(im.width * scale))
    h = max(1, round(im.height * scale))
    if fill:
        w, h = box_w, box_h
    # premultiply 후 BOX: 투명 픽셀의 검은 RGB 가 테두리로 번지지 않게 한다.
    arr = np.array(im).astype(np.float32)
    alpha = arr[..., 3:4] / 255.0
    pre = np.concatenate([arr[..., :3] * alpha, arr[..., 3:4]], axis=-1).astype(np.uint8)
    small = np.array(Image.fromarray(pre, "RGBA").resize((w, h), Image.BOX)).astype(np.float32)
    a = small[..., 3:4] / 255.0
    rgb = np.where(a > 0, small[..., :3] / np.maximum(a, 1e-6), 0)
    out = np.concatenate([np.clip(rgb, 0, 255), small[..., 3:4]], axis=-1).astype(np.uint8)
    out[..., 3] = np.where(out[..., 3] >= 110, 255, 0)
    return Image.fromarray(out, "RGBA")


def place(sheet, sprite, col, row, tiles_w, tiles_h):
    box_w, box_h = tiles_w * TILE, tiles_h * TILE
    x = col * TILE + (box_w - sprite.width) // 2
    y = row * TILE + (box_h - sprite.height)
    sheet.alpha_composite(sprite, (x, y))


def prop_components(im):
    """props.png 를 빈 열 구간으로 나눠 가로 순서로 뽑는다(작은 부스러기는 버린다)."""
    a = np.array(im)[..., 3] > 128
    cols = a.any(axis=0)
    spans, start = [], None
    for x, filled in enumerate(cols):
        if filled and start is None:
            start = x
        elif not filled and start is not None:
            spans.append((start, x))
            start = None
    if start is not None:
        spans.append((start, len(cols)))
    spans = [s for s in spans if s[1] - s[0] > 20]
    return [crop_opaque(im.crop((x0, 0, x1, im.height))) for x0, x1 in spans]


def reduce_palette(sheet):
    alpha = np.array(sheet)[..., 3]
    rgb = sheet.convert("RGB").quantize(PALETTE_COLORS, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE).convert("RGB")
    out = np.dstack([np.array(rgb), alpha])
    out[alpha == 0] = 0
    return Image.fromarray(out.astype(np.uint8), "RGBA")


def main():
    os.makedirs(OUT_DIR, exist_ok=True)
    sheet = Image.new("RGBA", (COLS * TILE, ROWS * TILE), (0, 0, 0, 0))
    blocks = []

    for name, file, tw, th, kind, col, row in BUILDINGS:
        place(sheet, fit_pixels(crop_opaque(load(file)), tw, th), col, row, tw, th)
        blocks.append({"name": name, "col": col, "row": row, "w": tw, "h": th, "kind": kind})

    comps = prop_components(load("props.png"))
    if len(comps) != len(PROPS):
        raise SystemExit(f"props.png 성분 {len(comps)}개 — 기대 {len(PROPS)}개")
    col, row = PROP_ORIGIN
    for (name, tw, th, kind), comp in zip(PROPS, comps):
        r = row + (2 - th)
        place(sheet, fit_pixels(comp, tw, th), col, r, tw, th)
        blocks.append({"name": name, "col": col, "row": r, "w": tw, "h": th, "kind": kind})
        col += tw

    comps = prop_components(load("route.png"))
    if len(comps) != len(ROUTE):
        raise SystemExit(f"route.png 성분 {len(comps)}개 — 기대 {len(ROUTE)}개")
    col, row = ROUTE_ORIGIN
    for (name, tw, th, kind, fill), comp in zip(ROUTE, comps):
        place(sheet, fit_pixels(comp, tw, th, fill), col, row, tw, th)
        blocks.append({"name": name, "col": col, "row": row, "w": tw, "h": th, "kind": kind})
        col += tw

    sheet = reduce_palette(sheet)
    full = Image.new("RGBA", (COLS * TILE, (BASE_ROWS + ROWS) * TILE), (0, 0, 0, 0))
    full.paste(Image.open(GRASSLAND).convert("RGBA"), (0, 0))
    full.paste(sheet, (0, BASE_ROWS * TILE))
    full.save(OUT_PNG, optimize=True)
    for block in blocks:
        block["row"] += BASE_ROWS
    with open(MANIFEST, "w", encoding="utf-8") as f:
        json.dump({"file": "monster-town-kit.png", "baseRows": BASE_ROWS, "blocks": blocks}, f, ensure_ascii=False, indent=2)
        f.write("\n")
    print(f"sheet: {OUT_PNG} ({os.path.getsize(OUT_PNG)} bytes)")
    print(f"manifest: {MANIFEST} ({len(blocks)} blocks)")


if __name__ == "__main__":
    main()

