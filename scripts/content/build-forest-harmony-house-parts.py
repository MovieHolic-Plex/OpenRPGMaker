#!/usr/bin/env python3
"""숲마을 집 부품 시트 — 굴뚝·지붕창·현관 차양·박공 꼭대기 장식(손 도트)을 결정적으로 찍는다.

    python3 scripts/content/build-forest-harmony-house-parts.py

출력
  public/assets/forest-harmony/house-parts.png   (30칸 폭, 16px, 알파 0/255)
  src/assets/forestHarmonyHouseParts.json        (칸 이름·이식 번호·통행·설명)

규칙
  · 색은 숲마을 시트(public/assets/forest-harmony/chipset.png)에 이미 있는 색만 쓴다 — 아래 PALETTE 의 값은
    전부 원본 칸(326 굴뚝·356/354 캡·404/406 지붕·85/87 창·199 판자·208 깃발·16 회벽)에서 뽑았다. 스크립트가 끝에서
    원본에 없는 색이 섞였는지 검사하고, 있으면 실패한다.
  · 1px 윤곽, 알파 0/255 만. 같은 입력이면 같은 PNG(무작위 없음).
  · 캡 변형(박공 꼭대기 장식)은 원본 캡 칸을 그대로 복사한 뒤 꼭대기 모서리에 장식만 얹는다.
  · 이식 번호는 forest_harmony 3060 부터 — 공용 이식 꼬리(2550~2759)·기후 시트의 덧칸(~3029)과 겹치지 않게 띄웠다.
    기존 번호는 옮기지 않는다.
"""
import json
import os
from PIL import Image

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
CHIPSET = os.path.join(ROOT, "public/assets/forest-harmony/chipset.png")
OUT_PNG = os.path.join(ROOT, "public/assets/forest-harmony/house-parts.png")
OUT_JSON = os.path.join(ROOT, "src/assets/forestHarmonyHouseParts.json")
TEXTURE_KEY = "tex_forest_harmony_house_parts"
TARGET_START = 3060
S, TPR = 16, 30

PALETTE = {
    ".": None,
    # 윤곽·그늘
    "O": "#2b203f",  # 가장 어두운 윤곽(돌벽 13)
    "K": "#2b3934",  # 굴뚝 윤곽(326)
    # 벽돌(지붕 375/354 계열 붉은 흙색)
    "D": "#582840", "R": "#863736", "r": "#c27536",
    # 돌 굴뚝(326)
    "G": "#929491", "g": "#c4c6c3", "S": "#3e403d", "t": "#9e8d83",
    # 연기(회벽 16·46)
    "w": "#ecd6c6", "s": "#bcaaa0",
    # 판자(199·133)
    "1": "#885a26", "2": "#744c2a", "3": "#653f23", "4": "#5a3011", "W": "#3c1700",
    # 창(85)
    "F": "#431d00", "f": "#603408", "a": "#3fa2ae", "A": "#a7d4db",
    # 회벽
    "P": "#ecd6c6", "p": "#bcaaa0",
    # 천(깃발 208)
    "c": "#dd2912", "C": "#9e2514", "y": "#fbc10d", "Y": "#ec9900",
}
BLUE = {"L": "#524cb1", "D": "#2e2b66", "H": "#cbc6e5", "E": "#201e45"}
ORANGE = {"L": "#c67832", "D": "#893437", "H": "#ecdb95", "E": "#562945"}


def hex_rgba(value):
    return (int(value[1:3], 16), int(value[3:5], 16), int(value[5:7], 16), 255)


def paint(rows, palette=None):
    assert len(rows) == 16, len(rows)
    pal = dict(PALETTE)
    if palette:
        pal.update(palette)
    tile = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    px = tile.load()
    for y, row in enumerate(rows):
        assert len(row) == 16, (y, row, len(row))
        for x, ch in enumerate(row):
            color = pal[ch]
            if color is not None:
                px[x, y] = hex_rgba(color)
    return tile


def overlay(base, rows, palette=None):
    top = paint(rows, palette)
    out = base.copy()
    out.alpha_composite(top)
    return out


sheet_src = Image.open(CHIPSET).convert("RGBA")


def source_tile(index):
    return sheet_src.crop(((index % TPR) * S, (index // TPR) * S, (index % TPR + 1) * S, (index // TPR + 1) * S))


SMOKE = [
    "..........sww...",
    ".........swwws..",
    "......s...swws..",
    ".....sww...ss...",
    "....swwws.......",
    ".....swws.......",
    "......ss........",
]

BRICK_BODY = [
    ".....OrRDrO.....",
    ".....ORRDRO.....",
    ".....ODDDDO.....",
    ".....ORDrRO.....",
    ".....ORDRRO.....",
    ".....ODDDDO.....",
]

STONE_BODY = [
    ".....KgGSGK.....",
    ".....KGGSGK.....",
    ".....KSSSSK.....",
    ".....KGStGK.....",
    ".....KtSGGK.....",
    ".....KSSSSK.....",
]


def chimney(body, cap_rows, smoke):
    # 캡 3줄 + 몸통 — 연기 있는 것은 위 7줄이 연기라 몸통이 짧다.
    top = SMOKE if smoke else ["................"]
    return (top + cap_rows + body * 3)[:16]


BRICK_CAP = [
    "....OOOOOOOO....",
    "....OgOOOOgO....",
    "....OgggggGO....",
]
STONE_CAP = [
    "....KKKKKKKK....",
    "....KgKKKKgK....",
    "....KgggggGK....",
]

DORMER = [
    "................",
    ".......OO.......",
    "......OLDO......",
    ".....OLLDDO.....",
    "....OLLLDDDO....",
    "...OLHLLDDDDO...",
    "..OEEEEEEEEEEO..",
    "...OPPPPPPPPO...",
    "...OPFFFFFFPO...",
    "...OPFAAaaFPO...",
    "...OPFAaaaFPO...",
    "...OPFFFFFFPO...",
    "...OPFaaaaFPO...",
    "...OPFFFFFFPO...",
    "...OppppppppO...",
    "...OOOOOOOOOO...",
]

AWNING_WOOD = [
    "................",
    "................",
    "................",
    "................",
    "................",
    "................",
    "................",
    "................",
    "WWWWWWWWWWWWWWWW",
    "W12121212121212W",
    "W21212121212121W",
    "W33333333333333W",
    "WWWWWWWWWWWWWWWW",
    ".W3W........W3W.",
    "..W3W......W3W..",
    "...WW......WW...",
]

AWNING_CLOTH = [
    "................",
    "................",
    "................",
    "................",
    "................",
    "................",
    "................",
    "................",
    "OOOOOOOOOOOOOOOO",
    "OccwwccwwccwwccO",
    "OccwwccwwccwwccO",
    "OCCssCCssCCssCCO",
    "OCCOOCCOOCCOOCCO",
    ".OO..OO..OO..OO.",
    "................",
    "................",
]

# 꼭대기 장식 — 두 캡(왼 L·오른 R)이 맞닿는 꼭대기 모서리에 금빛 구슬. L 은 오른쪽 두 열, R 은 왼쪽 두 열.
FINIAL_L = [
    "..............OO",
    ".............Oyy",
    ".............OYY",
    "..............OO",
] + ["................"] * 12
FINIAL_R = [
    "OO..............",
    "yYO.............",
    "YYO.............",
    "OO..............",
] + ["................"] * 12

TILES = [
    ("chimney-brick", "굴뚝 · 벽돌", "붉은 벽돌 굴뚝(연기 없음). 지붕 몸통 칸 위 상위에 얹는다.", paint(chimney(BRICK_BODY, BRICK_CAP, False))),
    ("chimney-brick-smoke", "굴뚝 · 벽돌 + 연기", "연기가 오르는 붉은 벽돌 굴뚝. 지붕 몸통 칸 위 상위.", paint(chimney(BRICK_BODY, BRICK_CAP, True))),
    ("chimney-stone-smoke", "굴뚝 · 돌 + 연기", "연기가 오르는 회색 돌 굴뚝(326 돌 굴뚝과 같은 색). 지붕 몸통 칸 위 상위.", paint(chimney(STONE_BODY, STONE_CAP, True))),
    ("dormer-blue", "지붕창 · 파랑 지붕", "파랑 지붕에 내는 작은 박공 지붕창. 측면 박공 덩어리 지붕 몸통 칸 위 상위.", paint(DORMER, BLUE)),
    ("dormer-orange", "지붕창 · 주황 지붕", "주황 지붕에 내는 작은 박공 지붕창. 측면 박공 덩어리 지붕 몸통 칸 위 상위.", paint(DORMER, ORANGE)),
    ("awning-wood", "현관 차양 · 널판", "문 바로 위 벽 윗줄 칸에 얹는 널판 차양과 까치발.", paint(AWNING_WOOD)),
    ("awning-cloth", "현관 차양 · 줄무늬 천", "문 바로 위 벽 윗줄 칸에 얹는 붉은 줄무늬 천 차양.", paint(AWNING_CLOTH)),
    ("finial-blue-l", "박공 꼭대기 장식 · 파랑 왼쪽", "파랑 사선 캡 356 + 꼭대기 금빛 구슬 왼쪽 반.", overlay(source_tile(356), FINIAL_L)),
    ("finial-blue-r", "박공 꼭대기 장식 · 파랑 오른쪽", "파랑 사선 캡 357 + 꼭대기 금빛 구슬 오른쪽 반.", overlay(source_tile(357), FINIAL_R)),
    ("finial-orange-l", "박공 꼭대기 장식 · 주황 왼쪽", "주황 사선 캡 354 + 꼭대기 금빛 구슬 왼쪽 반.", overlay(source_tile(354), FINIAL_L)),
    ("finial-orange-r", "박공 꼭대기 장식 · 주황 오른쪽", "주황 사선 캡 355 + 꼭대기 금빛 구슬 오른쪽 반.", overlay(source_tile(355), FINIAL_R)),
]


def main():
    rows = (len(TILES) + TPR - 1) // TPR
    sheet = Image.new("RGBA", (TPR * S, rows * S), (0, 0, 0, 0))
    for index, (_, _, _, tile) in enumerate(TILES):
        sheet.paste(tile, ((index % TPR) * S, (index // TPR) * S))
    # 알파 0/255 · 원본 팔레트 검사.
    source_colors = {p[:3] for p in sheet_src.getdata() if p[3] == 255}
    for (name, _, _, tile) in TILES:
        for p in tile.getdata():
            assert p[3] in (0, 255), (name, p)
            if p[3] == 255 and p[:3] not in source_colors:
                raise SystemExit(f"{name}: 원본 시트에 없는 색 {p[:3]}")
    sheet.save(OUT_PNG)
    slots = []
    for index, (name, label, description, _) in enumerate(TILES):
        slots.append({
            "name": name,
            "passability": {"up": False, "down": False, "left": False, "right": False},
            "priority": "upper",
            "terrain": 0,
            "tileMeta": {
                "role": "roof" if not name.startswith("awning") else "prop",
                "label": label,
                "description": f"{description} 상위·통행 불가. 집 시공기(박공 조합 형태)가 집마다 0~2개 결정적으로 붙인다.",
                "source": "user",
                "passage": "solid",
                "userLocked": True,
                "defaultLayer": "upper",
                "layerBacking": "none",
            },
        })
    data = {
        "textureKey": TEXTURE_KEY,
        "start": TARGET_START,
        "count": TARGET_START + len(TILES),
        "frames": len(TILES),
        "grafts": [{"targetTile": TARGET_START + i, "sourceChipset": TEXTURE_KEY, "sourceTile": i} for i in range(len(TILES))],
        "slots": slots,
    }
    with open(OUT_JSON, "w", encoding="utf8") as handle:
        json.dump(data, handle, ensure_ascii=False, indent=1)
        handle.write("\n")
    print(OUT_PNG, sheet.size, "tiles", len(TILES), "→", TARGET_START, "..", TARGET_START + len(TILES) - 1)


if __name__ == "__main__":
    main()
