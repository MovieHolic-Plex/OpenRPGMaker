# /// script
# requires-python = ">=3.11"
# dependencies = ["pillow"]
# ///
# ----- How to run -----
# C:/Users/hyeon/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe scripts/connected_tile_color_edge_report.py
from __future__ import annotations

import json
import math
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "output/evidence/connected-tile-classification"
SOURCE_IMAGE = ROOT / "public/assets/easyrpg-chipset-combined-town-transparent.png"
SOURCE_JSON = OUT / "combined-town-connected-tile-groups-per-tile-neighbor.json"
TARGET_JSON = OUT / "combined-town-connected-tile-groups-embedding-color-edge.json"
TARGET_IMAGE = OUT / "combined-town-connected-tile-groups-embedding-color-edge-ko.png"

TILE = 16
COLS = 30
SCALE = 3
EMBED_MIN = 0.95
COLOR_MIN = 0.90
COVERAGE_MIN = 0.125
GAP_MAX = 5.0
COMBINED_MIN = 0.93


def is_visible(pixel: tuple[int, int, int, int]) -> bool:
    red, green, blue, alpha = pixel
    is_magenta_key = red > 220 and green < 120 and blue > 120
    return alpha > 16 and not is_magenta_key


def tile_image(source: Image.Image, tile_id: int) -> Image.Image:
    x = tile_id % COLS * TILE
    y = tile_id // COLS * TILE
    return source.crop((x, y, x + TILE, y + TILE))


def edge_profile(tile: Image.Image, side: str) -> list[tuple[tuple[int, int, int], int] | None]:
    pixels = tile.load()
    profile: list[tuple[tuple[int, int, int], int] | None] = []
    if side in {"left", "right"}:
        for y in range(TILE):
            xs = range(TILE) if side == "left" else range(TILE - 1, -1, -1)
            found = None
            for x in xs:
                pixel = pixels[x, y]
                if is_visible(pixel):
                    distance = x if side == "left" else TILE - 1 - x
                    found = (pixel[:3], distance)
                    break
            profile.append(found)
        return profile

    for x in range(TILE):
        ys = range(TILE) if side == "up" else range(TILE - 1, -1, -1)
        found = None
        for y in ys:
            pixel = pixels[x, y]
            if is_visible(pixel):
                distance = y if side == "up" else TILE - 1 - y
                found = (pixel[:3], distance)
                break
        profile.append(found)
    return profile


def rgb_similarity(left: tuple[int, int, int], right: tuple[int, int, int]) -> float:
    distance = math.sqrt(sum((a - b) ** 2 for a, b in zip(left, right, strict=True)))
    return max(0.0, 1.0 - distance / math.sqrt(255 * 255 * 3))


def color_edge(source: Image.Image, edge: dict) -> dict:
    side_a, side_b = ("right", "left") if edge["direction"] == "right" else ("down", "up")
    profile_a = edge_profile(tile_image(source, edge["a"]), side_a)
    profile_b = edge_profile(tile_image(source, edge["b"]), side_b)
    similarities: list[float] = []
    gaps: list[int] = []
    either = 0
    for left, right in zip(profile_a, profile_b, strict=True):
        if left is not None or right is not None:
            either += 1
        if left is None or right is None:
            continue
        similarities.append(rgb_similarity(left[0], right[0]))
        gaps.append(left[1] + right[1])

    sample_count = len(similarities)
    avg_color = sum(similarities) / sample_count if sample_count else 0.0
    avg_gap = sum(gaps) / sample_count if sample_count else 99.0
    proximity = max(0.0, 1.0 - avg_gap / TILE)
    return {
        "color_coverage": round(sample_count / TILE, 4),
        "either_visible_coverage": round(either / TILE, 4),
        "color_similarity_avg": round(avg_color, 4),
        "color_similarity_min": round(min(similarities), 4) if similarities else 0.0,
        "avg_visible_gap_px": round(avg_gap, 4),
        "edge_proximity": round(proximity, 4),
        "sample_count": sample_count,
    }


def combined_score(edge: dict, color: dict) -> float:
    return round(
        0.55 * float(edge["score"])
        + 0.35 * float(color["color_similarity_avg"])
        + 0.10 * float(color["edge_proximity"]),
        4,
    )


def color_supports_edge(color: dict, score: float) -> bool:
    return (
        float(color["color_similarity_avg"]) >= COLOR_MIN
        and float(color["color_coverage"]) >= COVERAGE_MIN
        and float(color["avg_visible_gap_px"]) <= GAP_MAX
        and score >= COMBINED_MIN
    )


def edge_is_strong(edge: dict, color: dict, score: float) -> bool:
    embedding_ok = float(edge["score"]) >= EMBED_MIN
    visible_support = bool(edge["visible_edge_valid"])
    color_support = color_supports_edge(color, score)
    return embedding_ok and (visible_support or color_support)


def strong_components(tiles: list[int], edges: list[dict]) -> list[list[int]]:
    parent = {tile: tile for tile in tiles}

    def find(tile: int) -> int:
        while parent[tile] != tile:
            parent[tile] = parent[parent[tile]]
            tile = parent[tile]
        return tile

    def union(left: int, right: int) -> None:
        root_left = find(left)
        root_right = find(right)
        if root_left != root_right:
            parent[root_right] = root_left

    for edge in edges:
        union(edge["a"], edge["b"])

    groups: dict[int, list[int]] = {}
    for tile in tiles:
        groups.setdefault(find(tile), []).append(tile)
    return sorted((sorted(group) for group in groups.values()), key=lambda group: (-len(group), group[0]))


def classify(source: Image.Image, group: dict) -> dict:
    linked: set[int] = set()
    edges = []
    strong_edges = []
    for edge in group["edges"]:
        color = color_edge(source, edge)
        score = combined_score(edge, color)
        strong = edge_is_strong(edge, color, score)
        enriched = {
            **edge,
            **color,
            "combined_edge_score": score,
            "color_edge_support": color_supports_edge(color, score),
            "embedding_color_edge_pass": strong,
        }
        edges.append(enriched)
        if strong:
            strong_edge = {
                "a": edge["a"],
                "b": edge["b"],
                "direction": edge["direction"],
                "embedding_score": edge["score"],
                "color_similarity_avg": color["color_similarity_avg"],
                "color_coverage": color["color_coverage"],
                "avg_visible_gap_px": color["avg_visible_gap_px"],
                "combined_edge_score": score,
            }
            strong_edges.append(strong_edge)
            linked.update((edge["a"], edge["b"]))

    tiles = group["tiles"]
    unlinked = [tile for tile in tiles if tile not in linked]
    components = strong_components(tiles, strong_edges)
    per_tile_pass = not unlinked
    connected_pass = per_tile_pass and len(components) == 1
    verdict = "확정: 임베딩+색 외곽이 한 덩어리로 연결됨"
    if not connected_pass:
        verdict = "후보: 모든 타일은 이웃이 있으나 여러 덩어리로 갈라짐" if per_tile_pass else "탈락: 색/임베딩 기준에서 고립 타일 존재"

    base = {key: value for key, value in group.items() if key not in {"edges", "strong_edges"}}
    return {
        **base,
        "embedding_color_edge_pass": connected_pass,
        "embedding_color_edge_per_tile_pass": per_tile_pass,
        "embedding_color_edge_strong_edge_count": len(strong_edges),
        "embedding_color_edge_unlinked_tiles": unlinked,
        "embedding_color_edge_linked_tile_count": len(linked),
        "embedding_color_edge_component_count": len(components),
        "embedding_color_edge_strong_components": components,
        "embedding_color_edge_verdict_ko": verdict,
        "edges": edges,
        "embedding_color_strong_edges": strong_edges,
    }


def draw_report(source: Image.Image, groups: list[dict]) -> None:
    font_path = "C:/Windows/Fonts/NotoSansKR-VF.ttf"
    font_title = ImageFont.truetype(font_path, 18)
    font = ImageFont.truetype(font_path, 14)
    font_small = ImageFont.truetype(font_path, 11)
    cards = []
    for index, group in enumerate(groups, 1):
        tiles = group["tiles"]
        min_col = min(tile % COLS for tile in tiles)
        max_col = max(tile % COLS for tile in tiles)
        min_row = min(tile // COLS for tile in tiles)
        max_row = max(tile // COLS for tile in tiles)
        mosaic_w = (max_col - min_col + 1) * TILE * SCALE
        mosaic_h = (max_row - min_row + 1) * TILE * SCALE
        card = Image.new("RGB", (380, 124 + mosaic_h), (255, 255, 252))
        draw = ImageDraw.Draw(card)
        color = (27, 128, 78) if group["embedding_color_edge_pass"] else ((185, 119, 21) if group["embedding_color_edge_per_tile_pass"] else (190, 54, 44))
        draw.rounded_rectangle((0, 0, 379, card.height - 1), radius=8, outline=color, width=3)
        draw.text((12, 8), f"{index}. {group['title_ko']}", font=font_title, fill=(24, 28, 32))
        draw.text((12, 34), group["embedding_color_edge_verdict_ko"], font=font, fill=color)
        dx, dy = 12, 62
        for tile in tiles:
            tile_col = tile % COLS
            tile_row = tile // COLS
            tile_img = tile_image(source, tile).resize((TILE * SCALE, TILE * SCALE), Image.Resampling.NEAREST)
            x = dx + (tile_col - min_col) * TILE * SCALE
            y = dy + (tile_row - min_row) * TILE * SCALE
            bg = Image.new("RGBA", tile_img.size, (228, 228, 228, 255))
            bg.alpha_composite(tile_img)
            card.paste(bg.convert("RGB"), (x, y))
            is_unlinked = tile in group["embedding_color_edge_unlinked_tiles"]
            draw.rectangle((x, y, x + TILE * SCALE - 1, y + TILE * SCALE - 1), outline=(216, 47, 35) if is_unlinked else (205, 205, 205), width=3 if is_unlinked else 1)
            draw.text((x + 2, y + 2), str(tile), font=font_small, fill=(0, 0, 0))
        for edge in group["embedding_color_strong_edges"]:
            ax = dx + (edge["a"] % COLS - min_col) * TILE * SCALE + TILE * SCALE // 2
            ay = dy + (edge["a"] // COLS - min_row) * TILE * SCALE + TILE * SCALE // 2
            bx = dx + (edge["b"] % COLS - min_col) * TILE * SCALE + TILE * SCALE // 2
            by = dy + (edge["b"] // COLS - min_row) * TILE * SCALE + TILE * SCALE // 2
            draw.line((ax, ay, bx, by), fill=(33, 145, 82), width=4)
        info = f"강연결 {group['embedding_color_edge_strong_edge_count']} / 고립 {group['embedding_color_edge_unlinked_tiles']} / 덩어리 {group['embedding_color_edge_component_count']}"
        draw.text((12, 70 + mosaic_h), info, font=font, fill=(48, 52, 56))
        cards.append(card)

    sheet_w = 812
    row_heights = [max(card.height for card in cards[i : i + 2]) for i in range(0, len(cards), 2)]
    sheet = Image.new("RGB", (sheet_w, 86 + sum(row_heights) + 22 * len(row_heights)), (241, 239, 234))
    draw = ImageDraw.Draw(sheet)
    draw.text((18, 16), "임베딩 + 마지막/첫 실제 픽셀 색 연속성 판정", font=font_title, fill=(22, 26, 30))
    draw.text((18, 43), "초록=한 덩어리 확정, 주황=타일별 이웃은 있으나 덩어리 분리, 빨강=고립 타일 존재", font=font, fill=(70, 74, 78))
    y = 86
    for row, height in enumerate(row_heights):
        for col, card in enumerate(cards[row * 2 : row * 2 + 2]):
            sheet.paste(card, (18 + col * 398, y))
        y += height + 22
    sheet.save(TARGET_IMAGE)


def main() -> None:
    source = Image.open(SOURCE_IMAGE).convert("RGBA")
    previous = json.loads(SOURCE_JSON.read_text(encoding="utf-8"))
    groups = [classify(source, group) for group in previous["groups"]]
    payload = {
        "method": {
            "name": "embedding_plus_last_first_visible_pixel_color_edge",
            "thresholds": {
                "embedding_min": EMBED_MIN,
                "color_similarity_avg_min": COLOR_MIN,
                "color_coverage_min": COVERAGE_MIN,
                "avg_visible_gap_px_max": GAP_MAX,
                "combined_score_min": COMBINED_MIN,
            },
        },
        "groups": groups,
    }
    TARGET_JSON.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    draw_report(source, groups)
    for name in ("tent_objects", "fence_objects"):
        group = next(group for group in groups if group["source_group"] == name)
        print(name, group["embedding_color_edge_verdict_ko"], group["embedding_color_edge_unlinked_tiles"], group["embedding_color_edge_strong_components"])


if __name__ == "__main__":
    main()
