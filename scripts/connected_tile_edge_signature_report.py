# /// script
# requires-python = ">=3.11"
# dependencies = ["pillow"]
# ///
# ----- How to run -----
# C:/Users/hyeon/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe scripts/connected_tile_edge_signature_report.py
from __future__ import annotations

import json
import math
from pathlib import Path
from statistics import mean

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "output/evidence/connected-tile-classification"
SOURCE_IMAGE = ROOT / "public/assets/easyrpg-chipset-combined-town-transparent.png"
SOURCE_JSON = OUT / "combined-town-connected-tile-groups-per-tile-neighbor.json"
TARGET_JSON = OUT / "combined-town-connected-tile-groups-edge-signature.json"
TARGET_IMAGE = OUT / "combined-town-connected-tile-groups-edge-signature-ko.png"

TILE = 16
COLS = 30
SCALE = 3
EMBED_MIN = 0.95
COLOR_MIN = 0.88
PROFILE_MIN = 0.80
COVERAGE_MIN = 0.125
GAP_MAX = 5.0


def is_visible(pixel: tuple[int, int, int, int]) -> bool:
    red, green, blue, alpha = pixel
    return alpha > 16 and not (red > 220 and green < 120 and blue > 120)


def crop(source: Image.Image, tile_id: int) -> Image.Image:
    x = tile_id % COLS * TILE
    y = tile_id // COLS * TILE
    return source.crop((x, y, x + TILE, y + TILE))


def profile(tile: Image.Image, side: str) -> list[tuple[tuple[int, int, int], int] | None]:
    pixels = tile.load()
    values: list[tuple[tuple[int, int, int], int] | None] = []
    vertical = side in {"left", "right"}
    for index in range(TILE):
        found = None
        scan = range(TILE) if side in {"left", "up"} else range(TILE - 1, -1, -1)
        for offset in scan:
            x, y = (offset, index) if vertical else (index, offset)
            pixel = pixels[x, y]
            if is_visible(pixel):
                distance = offset if side in {"left", "up"} else TILE - 1 - offset
                found = (pixel[:3], distance)
                break
        values.append(found)
    return values


def rgb_similarity(left: tuple[int, int, int], right: tuple[int, int, int]) -> float:
    distance = math.sqrt(sum((a - b) ** 2 for a, b in zip(left, right, strict=True)))
    return max(0.0, 1.0 - distance / math.sqrt(255 * 255 * 3))


def strip_gray(tile: Image.Image, side: str) -> list[float | None]:
    pixels = tile.load()
    values: list[float | None] = []
    vertical = side in {"left", "right"}
    primary = 0 if side in {"left", "up"} else TILE - 1
    secondary = 1 if side in {"left", "up"} else TILE - 2
    for index in range(TILE):
        samples = []
        for offset in (primary, secondary):
            x, y = (offset, index) if vertical else (index, offset)
            pixel = pixels[x, y]
            if is_visible(pixel):
                samples.append(0.299 * pixel[0] + 0.587 * pixel[1] + 0.114 * pixel[2])
        values.append(mean(samples) if samples else None)
    return values


def masked_ssim(left: list[float | None], right: list[float | None]) -> float:
    pairs = [(a, b) for a, b in zip(left, right, strict=True) if a is not None and b is not None]
    if len(pairs) < 2:
        return 0.0
    xs = [pair[0] for pair in pairs]
    ys = [pair[1] for pair in pairs]
    mx = mean(xs)
    my = mean(ys)
    vx = mean((x - mx) ** 2 for x in xs)
    vy = mean((y - my) ** 2 for y in ys)
    cov = mean((x - mx) * (y - my) for x, y in pairs)
    c1 = 6.5025
    c2 = 58.5225
    value = ((2 * mx * my + c1) * (2 * cov + c2)) / ((mx * mx + my * my + c1) * (vx + vy + c2))
    return max(0.0, min(1.0, value))


def segment_match(left: list[tuple[tuple[int, int, int], int] | None], right: list[tuple[tuple[int, int, int], int] | None]) -> float:
    scores = []
    for start in range(0, TILE, 4):
        segment_scores = []
        for left_item, right_item in zip(left[start : start + 4], right[start : start + 4], strict=True):
            if left_item is not None and right_item is not None:
                segment_scores.append(rgb_similarity(left_item[0], right_item[0]))
        if segment_scores:
            scores.append(mean(segment_scores))
    return mean(scores) if scores else 0.0


def edge_signature(source: Image.Image, edge: dict) -> dict:
    side_a, side_b = ("right", "left") if edge["direction"] == "right" else ("down", "up")
    tile_a = crop(source, edge["a"])
    tile_b = crop(source, edge["b"])
    profile_a = profile(tile_a, side_a)
    profile_b = profile(tile_b, side_b)
    similarities: list[float] = []
    gaps: list[int] = []
    for item_a, item_b in zip(profile_a, profile_b, strict=True):
        if item_a is None or item_b is None:
            continue
        similarities.append(rgb_similarity(item_a[0], item_b[0]))
        gaps.append(item_a[1] + item_b[1])
    sample_count = len(similarities)
    color = mean(similarities) if similarities else 0.0
    gap = mean(gaps) if gaps else 99.0
    ssim = masked_ssim(strip_gray(tile_a, side_a), strip_gray(tile_b, side_b))
    segment = segment_match(profile_a, profile_b)
    profile_score = 0.50 * color + 0.30 * ssim + 0.20 * segment
    color_support = color >= COLOR_MIN and sample_count / TILE >= COVERAGE_MIN and gap <= GAP_MAX
    structural_support = profile_score >= PROFILE_MIN and sample_count / TILE >= COVERAGE_MIN and gap <= GAP_MAX
    visible_support = bool(edge["visible_edge_valid"])
    strong = float(edge["score"]) >= EMBED_MIN and (visible_support or color_support or structural_support)
    return {
        "color_similarity": round(color, 4),
        "strip_ssim": round(ssim, 4),
        "segment_similarity": round(segment, 4),
        "profile_score": round(profile_score, 4),
        "sample_coverage": round(sample_count / TILE, 4),
        "avg_gap_px": round(gap, 4),
        "visible_support": visible_support,
        "color_support": color_support,
        "structural_support": structural_support,
        "edge_signature_pass": strong,
    }


def components(tiles: list[int], edges: list[dict]) -> list[list[int]]:
    parent = {tile: tile for tile in tiles}

    def find(tile: int) -> int:
        while parent[tile] != tile:
            parent[tile] = parent[parent[tile]]
            tile = parent[tile]
        return tile

    for edge in edges:
        left = find(edge["a"])
        right = find(edge["b"])
        if left != right:
            parent[right] = left
    groups: dict[int, list[int]] = {}
    for tile in tiles:
        groups.setdefault(find(tile), []).append(tile)
    return sorted((sorted(group) for group in groups.values()), key=lambda item: (-len(item), item[0]))


def classify(source: Image.Image, group: dict) -> dict:
    edges = []
    strong = []
    linked: set[int] = set()
    for edge in group["edges"]:
        signature = edge_signature(source, edge)
        enriched = {**edge, **signature}
        edges.append(enriched)
        if signature["edge_signature_pass"]:
            strong.append(enriched)
            linked.update((edge["a"], edge["b"]))
    groups = components(group["tiles"], strong)
    unlinked = [tile for tile in group["tiles"] if tile not in linked]
    per_tile = not unlinked
    connected = per_tile and len(groups) == 1
    verdict = "확정: edge signature가 한 덩어리로 연결됨"
    if not connected:
        verdict = "후보: 모든 타일은 연결되지만 여러 덩어리로 분리" if per_tile else "탈락: edge signature 기준 고립 타일 존재"
    base = {key: value for key, value in group.items() if key not in {"edges", "strong_edges"}}
    return {
        **base,
        "edge_signature_pass": connected,
        "edge_signature_per_tile_pass": per_tile,
        "edge_signature_verdict_ko": verdict,
        "edge_signature_strong_edge_count": len(strong),
        "edge_signature_unlinked_tiles": unlinked,
        "edge_signature_components": groups,
        "edge_signature_component_count": len(groups),
        "edges": edges,
        "edge_signature_strong_edges": strong,
    }


def draw_report(source: Image.Image, groups: list[dict]) -> None:
    font = ImageFont.truetype("C:/Windows/Fonts/NotoSansKR-VF.ttf", 14)
    title_font = ImageFont.truetype("C:/Windows/Fonts/NotoSansKR-VF.ttf", 18)
    small_font = ImageFont.truetype("C:/Windows/Fonts/NotoSansKR-VF.ttf", 11)
    cards = []
    for index, group in enumerate(groups, 1):
        tiles = group["tiles"]
        min_col, max_col = min(tile % COLS for tile in tiles), max(tile % COLS for tile in tiles)
        min_row, max_row = min(tile // COLS for tile in tiles), max(tile // COLS for tile in tiles)
        mosaic_w = (max_col - min_col + 1) * TILE * SCALE
        mosaic_h = (max_row - min_row + 1) * TILE * SCALE
        card = Image.new("RGB", (382, 128 + mosaic_h), (255, 255, 252))
        draw = ImageDraw.Draw(card)
        ok = group["edge_signature_pass"]
        per_tile = group["edge_signature_per_tile_pass"]
        color = (27, 128, 78) if ok else ((185, 119, 21) if per_tile else (190, 54, 44))
        draw.rounded_rectangle((0, 0, 381, card.height - 1), radius=8, outline=color, width=3)
        draw.text((12, 8), f"{index}. {group['title_ko']}", font=title_font, fill=(24, 28, 32))
        draw.text((12, 34), group["edge_signature_verdict_ko"], font=font, fill=color)
        dx, dy = 12, 64
        for tile in tiles:
            x = dx + (tile % COLS - min_col) * TILE * SCALE
            y = dy + (tile // COLS - min_row) * TILE * SCALE
            tile_img = crop(source, tile).resize((TILE * SCALE, TILE * SCALE), Image.Resampling.NEAREST)
            bg = Image.new("RGBA", tile_img.size, (228, 228, 228, 255))
            bg.alpha_composite(tile_img)
            card.paste(bg.convert("RGB"), (x, y))
            unlinked = tile in group["edge_signature_unlinked_tiles"]
            draw.rectangle((x, y, x + TILE * SCALE - 1, y + TILE * SCALE - 1), outline=(216, 47, 35) if unlinked else (205, 205, 205), width=3 if unlinked else 1)
            draw.text((x + 2, y + 2), str(tile), font=small_font, fill=(0, 0, 0))
        for edge in group["edge_signature_strong_edges"]:
            ax = dx + (edge["a"] % COLS - min_col) * TILE * SCALE + TILE * SCALE // 2
            ay = dy + (edge["a"] // COLS - min_row) * TILE * SCALE + TILE * SCALE // 2
            bx = dx + (edge["b"] % COLS - min_col) * TILE * SCALE + TILE * SCALE // 2
            by = dy + (edge["b"] // COLS - min_row) * TILE * SCALE + TILE * SCALE // 2
            draw.line((ax, ay, bx, by), fill=(33, 145, 82), width=4)
        info = f"강연결 {group['edge_signature_strong_edge_count']} / 고립 {group['edge_signature_unlinked_tiles']} / 덩어리 {group['edge_signature_component_count']}"
        draw.text((12, 72 + mosaic_h), info, font=font, fill=(48, 52, 56))
        cards.append(card)
    row_heights = [max(card.height for card in cards[i : i + 2]) for i in range(0, len(cards), 2)]
    sheet = Image.new("RGB", (816, 88 + sum(row_heights) + 22 * len(row_heights)), (241, 239, 234))
    draw = ImageDraw.Draw(sheet)
    draw.text((18, 16), "Edge signature 중심 연결 판정", font=title_font, fill=(22, 26, 30))
    draw.text((18, 43), "투명 제외 경계 점유율 + 색 연속성 + strip SSIM + 세그먼트 패턴 + 임베딩 보조", font=font, fill=(70, 74, 78))
    y = 88
    for row, height in enumerate(row_heights):
        for col, card in enumerate(cards[row * 2 : row * 2 + 2]):
            sheet.paste(card, (18 + col * 399, y))
        y += height + 22
    sheet.save(TARGET_IMAGE)


def main() -> None:
    source = Image.open(SOURCE_IMAGE).convert("RGBA")
    previous = json.loads(SOURCE_JSON.read_text(encoding="utf-8"))
    groups = [classify(source, group) for group in previous["groups"]]
    payload = {
        "method": {
            "name": "edge_signature_primary_embedding_assist",
            "thresholds": {
                "embedding_min": EMBED_MIN,
                "color_min": COLOR_MIN,
                "profile_min": PROFILE_MIN,
                "coverage_min": COVERAGE_MIN,
                "avg_gap_px_max": GAP_MAX,
            },
        },
        "groups": groups,
    }
    TARGET_JSON.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    draw_report(source, groups)
    for source_group in ("tent_objects", "fence_objects", "statue_objects"):
        group = next(group for group in groups if group["source_group"] == source_group)
        print(source_group, group["edge_signature_verdict_ko"], group["edge_signature_unlinked_tiles"], group["edge_signature_components"])


if __name__ == "__main__":
    main()
