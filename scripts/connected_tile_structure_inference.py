# /// script
# requires-python = ">=3.11"
# dependencies = ["pillow"]
# ///
# ----- How to run -----
# C:/Users/hyeon/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe scripts/connected_tile_structure_inference.py
import json
from collections import deque
from dataclasses import dataclass
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "output/evidence/connected-tile-classification"
SOURCE_IMAGE = ROOT / "public/assets/easyrpg-chipset-combined-town-transparent.png"
SOURCE_JSON = OUT / "combined-town-connected-tile-groups-edge-signature.json"
TARGET_JSON = OUT / "combined-town-structure-inference.json"
TARGET_IMAGE = OUT / "combined-town-structure-inference-ko.png"
TILE, COLS, SCALE = 16, 30, 3
RECT_SIZES = ((1, 2), (2, 1), (2, 2), (1, 3), (3, 1), (2, 3), (3, 2), (3, 3), (4, 1), (6, 2), (6, 4))
BLOB_CACHE: dict[tuple[int, ...], dict] = {}


@dataclass(frozen=True, slots=True)
class Candidate:
    title: str
    kind: str
    tiles: tuple[int, ...]
    score: float
    metrics: dict


def visible(pixel: tuple[int, int, int, int]) -> bool:
    red, green, blue, alpha = pixel
    return alpha > 16 and not (red > 220 and green < 120 and blue > 120)


def crop(source: Image.Image, tile: int) -> Image.Image:
    x, y = tile % COLS * TILE, tile // COLS * TILE
    return source.crop((x, y, x + TILE, y + TILE))


def side_edges(tiles: tuple[int, ...], edges: list[dict]) -> list[dict]:
    allowed = set(tiles)
    return [edge for edge in edges if edge["a"] in allowed and edge["b"] in allowed]


def component_count(tiles: tuple[int, ...], edges: list[dict]) -> int:
    if not tiles:
        return 0
    parent = {tile: tile for tile in tiles}

    def find(tile: int) -> int:
        while parent[tile] != tile:
            parent[tile] = parent[parent[tile]]
            tile = parent[tile]
        return tile

    for edge in edges:
        if not edge["edge_signature_pass"]:
            continue
        left = find(edge["a"])
        right = find(edge["b"])
        if left != right:
            parent[right] = left
    return len({find(tile) for tile in tiles})


def blob_metrics(source: Image.Image, tiles: tuple[int, ...]) -> dict:
    key = tuple(sorted(tiles))
    if key in BLOB_CACHE:
        return BLOB_CACHE[key]
    min_col = min(tile % COLS for tile in tiles)
    min_row = min(tile // COLS for tile in tiles)
    width = (max(tile % COLS for tile in tiles) - min_col + 1) * TILE
    height = (max(tile // COLS for tile in tiles) - min_row + 1) * TILE
    mask = [[False for _ in range(width)] for _ in range(height)]
    for tile in tiles:
        img = crop(source, tile)
        ox = (tile % COLS - min_col) * TILE
        oy = (tile // COLS - min_row) * TILE
        pixels = img.load()
        for y in range(TILE):
            for x in range(TILE):
                mask[oy + y][ox + x] = visible(pixels[x, y])
    seen = [[False for _ in range(width)] for _ in range(height)]
    total, largest, parts = 0, 0, 0
    largest_tiles: set[int] = set()
    for y in range(height):
        for x in range(width):
            if seen[y][x] or not mask[y][x]:
                continue
            parts += 1
            q, seen[y][x] = deque([(x, y)]), True
            count, touched = 0, set()
            while q:
                px, py = q.popleft()
                count += 1
                total += 1
                col = min_col + px // TILE
                row = min_row + py // TILE
                touched.add(row * COLS + col)
                for nx, ny in ((px + 1, py), (px - 1, py), (px, py + 1), (px, py - 1)):
                    if 0 <= nx < width and 0 <= ny < height and mask[ny][nx] and not seen[ny][nx]:
                        seen[ny][nx] = True
                        q.append((nx, ny))
            if count > largest:
                largest = count
                largest_tiles = touched
    result = {"visible_pixels": total, "blob_components": parts, "largest_blob_ratio": round(largest / total, 4) if total else 0.0, "largest_blob_tiles": sorted(largest_tiles), "largest_blob_tile_count": len(largest_tiles)}
    BLOB_CACHE[key] = result
    return result


def infer_kind(source_group: str, tiles: tuple[int, ...], metrics: dict) -> str:
    name = source_group.lower()
    width = metrics["bbox_w"]
    height = metrics["bbox_h"]
    if len(tiles) == 1:
        return "single_prop"
    if ("autotile" in name or "ground" in name or "road" in name) and len(tiles) >= 8 and metrics["internal_ratio"] >= 0.7:
        return "autotile_set"
    if "tree" in name and metrics["component_count"] == 1:
        return "connected_object"
    if "fence" in name or "wall" in name or "roof" in name or width >= 4:
        return "modular_set" if metrics["component_count"] > 1 or width > 3 else "connected_object"
    if "statue" in name or (metrics["largest_blob_tile_count"] >= 3 and metrics["largest_blob_ratio"] >= 0.45):
        return "decorative_blob"
    if metrics["component_count"] == 1 and metrics["internal_ratio"] >= 0.55:
        return "connected_object"
    if "small" in name or "sign" in name or "fire" in name or "flower" in name:
        return "prop_cluster"
    return "candidate_cluster"


def score_candidate(kind: str, tiles: tuple[int, ...], metrics: dict) -> float:
    type_bonus = {
        "autotile_set": 1.25,
        "connected_object": 1.12,
        "modular_set": 1.02,
        "decorative_blob": 0.95,
        "prop_cluster": 0.58,
        "candidate_cluster": 0.48,
        "single_prop": 0.20,
    }[kind]
    quality = 0.38 * metrics["internal_ratio"] + 0.22 * metrics["fill_ratio"] + 0.22 * metrics["largest_blob_ratio"] + 0.18 * metrics["metadata_prior"]
    if kind == "modular_set" and metrics["component_count"] > 1:
        quality += 0.12
    if kind == "decorative_blob" and metrics["largest_blob_tile_count"] >= 3:
        quality += 0.16
    return round(len(tiles) * (quality + type_bonus), 4)


def make_candidate(source: Image.Image, group: dict, tiles: tuple[int, ...], title: str) -> Candidate:
    edge_list = side_edges(tiles, group["edges"])
    strong = [edge for edge in edge_list if edge["edge_signature_pass"]]
    cols = [tile % COLS for tile in tiles]
    rows = [tile // COLS for tile in tiles]
    possible = len(edge_list)
    blobs = blob_metrics(source, tiles)
    metrics = {
        **blobs,
        "bbox_w": max(cols) - min(cols) + 1,
        "bbox_h": max(rows) - min(rows) + 1,
        "fill_ratio": round(len(tiles) / ((max(cols) - min(cols) + 1) * (max(rows) - min(rows) + 1)), 4),
        "internal_ratio": round(len(strong) / possible, 4) if possible else 0.0,
        "strong_edges": len(strong),
        "possible_edges": possible,
        "component_count": component_count(tiles, edge_list),
        "metadata_prior": 1.0 if set(tiles) == set(group["tiles"]) else 0.72,
    }
    kind = infer_kind(group["source_group"], tiles, metrics)
    return Candidate(title, kind, tuple(sorted(tiles)), score_candidate(kind, tiles, metrics), metrics)


def rectangle_candidates(group: dict) -> list[tuple[int, ...]]:
    present = set(group["tiles"])
    result: set[tuple[int, ...]] = set()
    cols = range(min(tile % COLS for tile in present), max(tile % COLS for tile in present) + 1)
    rows = range(min(tile // COLS for tile in present), max(tile // COLS for tile in present) + 1)
    for width, height in RECT_SIZES:
        for col in cols:
            for row in rows:
                tiles = tuple(sorted((row + dy) * COLS + col + dx for dy in range(height) for dx in range(width)))
                if set(tiles).issubset(present):
                    result.add(tiles)
    return sorted(result, key=lambda item: (-len(item), item))


def generate_candidates(source: Image.Image, group: dict) -> list[Candidate]:
    candidates = [make_candidate(source, group, tuple(group["tiles"]), "전체 후보")]
    for component in group["edge_signature_components"]:
        if len(component) > 1:
            candidates.append(make_candidate(source, group, tuple(component), "강연결 컴포넌트"))
    for tiles in rectangle_candidates(group):
        candidates.append(make_candidate(source, group, tiles, "다중 스케일 사각 후보"))
    for tile in group["tiles"]:
        candidates.append(make_candidate(source, group, (tile,), "단일 타일"))
    unique: dict[tuple[int, ...], Candidate] = {}
    for candidate in candidates:
        previous = unique.get(candidate.tiles)
        if previous is None or candidate.score > previous.score:
            unique[candidate.tiles] = candidate
    ranked = sorted(unique.values(), key=lambda candidate: (-candidate.score, -len(candidate.tiles), candidate.tiles))
    keep = {ranked[0].tiles, tuple(group["tiles"])}
    keep.update(candidate.tiles for candidate in ranked if len(candidate.tiles) == 1)
    return [candidate for candidate in ranked[:70] if candidate.tiles in keep or len(candidate.tiles) > 1] + [candidate for candidate in ranked if candidate.tiles in keep and candidate not in ranked[:70]]


def choose(group: dict, candidates: list[Candidate]) -> list[Candidate]:
    full = next(candidate for candidate in candidates if set(candidate.tiles) == set(group["tiles"]))
    if full.kind == "autotile_set" or (full.kind == "modular_set" and full.metrics["internal_ratio"] >= 0.35) or (full.kind == "decorative_blob" and full.metrics["largest_blob_tile_count"] >= len(full.tiles) * 0.7):
        return [full]
    uncovered = set(group["tiles"])
    selected = []
    while uncovered:
        usable = [candidate for candidate in candidates if set(candidate.tiles).issubset(uncovered)]
        best = max(usable, key=lambda candidate: (candidate.score, len(candidate.tiles)))
        selected.append(best)
        uncovered.difference_update(best.tiles)
    return sorted(selected, key=lambda candidate: (min(candidate.tiles), -len(candidate.tiles)))


def draw(source: Image.Image, selections: list[dict]) -> None:
    font = ImageFont.truetype("C:/Windows/Fonts/NotoSansKR-VF.ttf", 14)
    title_font = ImageFont.truetype("C:/Windows/Fonts/NotoSansKR-VF.ttf", 18)
    small_font = ImageFont.truetype("C:/Windows/Fonts/NotoSansKR-VF.ttf", 10)
    cards = []
    colors = {"autotile_set": (27, 128, 78), "connected_object": (28, 104, 180), "modular_set": (185, 119, 21), "decorative_blob": (135, 88, 170), "prop_cluster": (120, 95, 70), "single_prop": (150, 150, 150), "candidate_cluster": (110, 110, 110)}
    for group in selections:
        tiles = tuple(tile for item in group["selected"] for tile in item["tiles"])
        min_col, max_col = min(tile % COLS for tile in tiles), max(tile % COLS for tile in tiles)
        min_row, max_row = min(tile // COLS for tile in tiles), max(tile // COLS for tile in tiles)
        height = (max_row - min_row + 1) * TILE * SCALE
        card = Image.new("RGB", (390, 128 + height), (255, 255, 252))
        d = ImageDraw.Draw(card)
        d.rounded_rectangle((0, 0, 389, card.height - 1), radius=8, outline=(70, 74, 78), width=2)
        d.text((12, 8), group["title_ko"], font=title_font, fill=(24, 28, 32))
        d.text((12, 34), group["decision_ko"], font=font, fill=(70, 74, 78))
        dx, dy = 12, 64
        for item in group["selected"]:
            color = colors[item["kind"]]
            for tile in item["tiles"]:
                x = dx + (tile % COLS - min_col) * TILE * SCALE
                y = dy + (tile // COLS - min_row) * TILE * SCALE
                tile_img = crop(source, tile).resize((TILE * SCALE, TILE * SCALE), Image.Resampling.NEAREST)
                bg = Image.new("RGBA", tile_img.size, (228, 228, 228, 255))
                bg.alpha_composite(tile_img)
                card.paste(bg.convert("RGB"), (x, y))
                d.rectangle((x, y, x + TILE * SCALE - 1, y + TILE * SCALE - 1), outline=color, width=3)
                d.text((x + 2, y + 2), str(tile), font=small_font, fill=(0, 0, 0))
        summary = " / ".join(f"{item['kind']}:{len(item['tiles'])}" for item in group["selected"])
        d.text((12, 72 + height), summary[:45], font=font, fill=(48, 52, 56))
        cards.append(card)
    row_heights = [max(card.height for card in cards[i : i + 2]) for i in range(0, len(cards), 2)]
    sheet = Image.new("RGB", (836, 90 + sum(row_heights) + 22 * len(row_heights)), (241, 239, 234))
    d = ImageDraw.Draw(sheet)
    d.text((18, 16), "사람 피드백 없는 타일셋 구조 추론", font=title_font, fill=(22, 26, 30))
    d.text((18, 43), "multi-scale 후보 + edge signature + opaque blob + metadata prior + set cover 선택", font=font, fill=(70, 74, 78))
    y = 90
    for row, height in enumerate(row_heights):
        for col, card in enumerate(cards[row * 2 : row * 2 + 2]):
            sheet.paste(card, (18 + col * 409, y))
        y += height + 22
    sheet.save(TARGET_IMAGE)


def as_json(candidate: Candidate) -> dict:
    return {"kind": candidate.kind, "title": candidate.title, "tiles": list(candidate.tiles), "score": candidate.score, "metrics": candidate.metrics}


def main() -> None:
    source = Image.open(SOURCE_IMAGE).convert("RGBA")
    data = json.loads(SOURCE_JSON.read_text(encoding="utf-8"))
    groups = []
    for group in data["groups"]:
        candidates = generate_candidates(source, group)
        selected = choose(group, candidates)
        decision = "전체 유지" if len(selected) == 1 and set(selected[0].tiles) == set(group["tiles"]) else "자동 분해"
        groups.append({"source_group": group["source_group"], "title_ko": group["title_ko"], "decision_ko": decision, "selected": [as_json(item) for item in selected], "top_candidates": [as_json(item) for item in candidates[:8]]})
    TARGET_JSON.write_text(json.dumps({"method": "multi_scale_edge_blob_metadata_set_cover", "groups": groups}, ensure_ascii=False, indent=2), encoding="utf-8")
    draw(source, groups)
    for name in ("tent_objects", "fence_objects", "statue_objects"):
        group = next(group for group in groups if group["source_group"] == name)
        print(name, group["decision_ko"], [(item["kind"], item["tiles"]) for item in group["selected"]])


if __name__ == "__main__":
    main()
