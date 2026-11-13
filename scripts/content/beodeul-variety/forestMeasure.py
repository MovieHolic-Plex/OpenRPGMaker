#!/usr/bin/env python3
"""버들항 숲·바닥 «닮음» 지표(모델 없음) — forestFacts.mts 가 적은 사실에서 맵마다 수치를 낸다.

  python3 scripts/content/beodeul-variety/forestMeasure.py <facts.json> [--out <결과.json>] [--only river|coast|woods|<게임>]

지표(오너 2026-11-13 «나무랑 땅 타일도 좀 다양하게 … 특히 숲쪽»)
- 나무 그림 수: 맵에 놓인 나무 킷의 서로 다른 그림(화소가 같으면 한 그림 — 겉모습이 겹친 뒤). 이어진 숲 수관은 «수관» 한 그림으로 센다.
- 나무 크기 수: 놓인 나무 킷의 서로 다른 칸 크기.
- 가장 많은 그림의 몫: 숲 넓이(나무 킷 칸 + 수관 칸) 가운데 가장 많이 쓰인 그림 하나가 덮은 칸의 몫.
- 바닥 재질 수: 걷는 칸의 서로 다른 바닥 그림(풀·흙·모래 바닥 — 길·광장 제외) + 바닥 덧그림(숲 바닥·풀밭 얼룩) 재질 수. 가장 많은 바닥 그림의 몫.
- 밑풀: 숲 칸에서 두 칸 안에 놓인 밑풀 기물(고사리·버섯·그루터기·통나무·바위·들꽃·덤불 1~2칸) 수 / 숲 100칸.
- 숲 생김새: 숲 칸 수·맵 몫, 덩이 수, 가장 큰 덩이의 몫, 맵 가장자리 다섯 칸 띠 안의 몫.
"""
import argparse, hashlib, json, pathlib, sys
import numpy as np
from PIL import Image

ROOT = pathlib.Path(__file__).resolve().parents[3]
T = 16
SHEETS = {
    "tex_beodeul_city": ("public/assets/beodeul-city/beodeul-city-chipset.png", 128),
    "tex_beodeul_looks": ("public/assets/beodeul-looks/chipset.png", 128),
    "tex_beodeul_nature": ("public/assets/beodeul-nature/chipset.png", 16),
    "tex_beodeul_ground": ("public/assets/beodeul-ground/chipset.png", 8),
    "tex_beodeul_houses": ("public/assets/beodeul-houses/chipset.png", 128),
    "tex_beodeul_stands": ("public/assets/beodeul-stands/chipset.png", 128),
}
_cache = {}


def cell(chip, tile):
    if chip not in SHEETS: return f"{chip}#{tile}".encode()  # 모르는 그림판은 칸 번호로 가른다(같은 그림으로 뭉치지 않게)
    if chip not in _cache:
        path, cols = SHEETS[chip]
        _cache[chip] = (np.array(Image.open(ROOT / path).convert("RGBA")), cols)
    a, cols = _cache[chip]
    y, x = divmod(tile, cols)
    return a[y * T:(y + 1) * T, x * T:(x + 1) * T].tobytes() if tile >= 0 else b""


def pic_hash(cells):
    h = hashlib.sha1()
    for chip, tile in cells: h.update(cell(chip, tile))
    return h.hexdigest()[:10]


GROUND_WORDS = ("풀", "잔디", "흙", "모래", "바닥", "grass", "meadow")
PAVED_WORDS = ("길", "포석", "판석", "광장", "다리", "계단", "부두", "잔교", "마루", "문", "road", "plaza")


def measure(row):
    W, H = row["w"], row["h"]
    trees = [p for p in row["placed"] if p["kind"] == "tree"]
    # 밭 작물·허수아비는 밑풀이 아니다(킷 id 로 거른다 — 재는 자의 분류일 뿐 제품 코드가 아니다)
    under = [p for p in row["placed"] if p["kind"] == "under" and not any(w in p["kit"] for w in ("wheat-roman-road-wheat", "scare", "plot", "crop", "ground-"))]
    hashes = {kit: pic_hash(cells) for kit, cells in row["kitPics"].items()}
    by_pic = {}
    forest = np.zeros(W * H, bool)
    for p in trees:
        by_pic[hashes[p["kit"]]] = by_pic.get(hashes[p["kit"]], 0) + p["w"] * p["h"]
        for y in range(p["y"], p["y"] + p["h"]):
            forest[y * W + p["x"]:y * W + p["x"] + p["w"]] = True
    canopy = row["canopy"]
    if canopy:
        by_pic["canopy"] = len(canopy)
        forest[canopy] = True
    area = int(forest.sum())
    top = max(by_pic.values()) / max(1, sum(by_pic.values())) if by_pic else 0
    # 밑풀: 숲 칸에서 두 칸 안
    f2 = forest.reshape(H, W)
    near = np.zeros_like(f2)
    for dy in range(-2, 3):
        for dx in range(-2, 3):
            ys, xs = slice(max(0, dy), H + min(0, dy)), slice(max(0, dx), W + min(0, dx))
            yd, xd = slice(max(0, -dy), H + min(0, -dy)), slice(max(0, -dx), W + min(0, -dx))
            near[ys, xs] |= f2[yd, xd]
    n_under = sum(1 for p in under if near[p["y"]:p["y"] + p["h"], p["x"]:p["x"] + p["w"]].any())
    # 바닥
    ground = {}
    for key, count in row["ground"].items():
        label, pic = key.split("|", 1)
        if any(w in label for w in PAVED_WORDS) and not any(w in label for w in ("풀",)): continue
        if not any(w in label for w in GROUND_WORDS): continue
        chip, tile = pic.rsplit("#", 1)
        h = hashlib.sha1(cell(chip, int(tile))).hexdigest()[:8]
        ground[h] = ground.get(h, 0) + count
    floors = {k: v for k, v in row.get("floor", {}).items() if "바닥 덧그림" in k}
    open_cells = sum(ground.values())
    covered = sum(floors.values())
    textures = len(ground) + len(floors)
    top_ground = (max(ground.values()) - min(covered, max(ground.values()))) / max(1, open_cells) if ground else 0
    # 숲 덩이(8이웃)
    comp = np.zeros(W * H, int); n_comp = 0; sizes = []
    for i in np.nonzero(forest)[0]:
        if comp[i]: continue
        n_comp += 1; stack = [i]; comp[i] = n_comp; size = 0
        while stack:
            c = stack.pop(); size += 1; x, y = c % W, c // W
            for dy in (-1, 0, 1):
                for dx in (-1, 0, 1):
                    nx, ny = x + dx, y + dy
                    if 0 <= nx < W and 0 <= ny < H and forest[ny * W + nx] and not comp[ny * W + nx]:
                        comp[ny * W + nx] = n_comp; stack.append(ny * W + nx)
        sizes.append(size)
    edge = np.zeros((H, W), bool); edge[:5] = edge[-5:] = True; edge[:, :5] = edge[:, -5:] = True
    return {
        "id": row["id"], "size": f"{W}x{H}", "look": row.get("look"),
        "treeKits": len(trees), "treePictures": len(by_pic), "treeSizes": len({(p["w"], p["h"]) for p in trees}),
        "forestCells": area, "forestShare": round(area / (W * H), 3), "canopyCells": len(canopy), "topPictureShare": round(top, 3),
        "under": len(under), "underNearForest": n_under, "underPer100": round(n_under * 100 / max(1, area), 1),
        "groundTextures": textures, "topGroundShare": round(top_ground, 3), "openGround": open_cells, "floorCells": covered,
        "components": n_comp, "largestShare": round(max(sizes) / max(1, area), 3) if sizes else 0, "edgeShare": round(float((f2 & edge).sum()) / max(1, area), 3),
    }


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("facts"); ap.add_argument("--out"); ap.add_argument("--only")
    a = ap.parse_args()
    rows = [measure(r) for r in json.load(open(a.facts))["rows"] if not a.only or a.only in r["id"]]
    keys = ["treeKits", "treePictures", "treeSizes", "forestCells", "forestShare", "canopyCells", "topPictureShare", "underNearForest", "underPer100", "groundTextures", "topGroundShare", "floorCells", "components", "largestShare", "edgeShare"]
    print("맵".ljust(34) + " ".join(k[:12].rjust(12) for k in keys))
    for r in rows: print(r["id"][:33].ljust(34) + " ".join(str(r[k]).rjust(12) for k in keys))
    if rows:
        print("평균".ljust(34) + " ".join(f"{np.mean([r[k] for r in rows]):.2f}".rjust(12) for k in keys))
    if a.out: json.dump({"rows": rows, "mean": {k: round(float(np.mean([r[k] for r in rows])), 3) for k in keys} if rows else {}}, open(a.out, "w"), ensure_ascii=False, indent=1)


if __name__ == "__main__":
    main()
