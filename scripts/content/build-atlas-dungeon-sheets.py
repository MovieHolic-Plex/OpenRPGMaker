"""Atlas dungeons (tiledata/atlas-dungeons): the graft parts sheet and the new dungeon-family sheets.

Two kinds of picture, both 480 px wide, 16 px cells, 30 per row:

  public/assets/atlas-dungeons/parts.png
      pieces the dungeon sheet lacks, grafted onto every dungeon-family tileset after tile 509
      (target = 510 + part index). Three sources:
        - copies of EasyRPG (CC0) tiles from the same art family: the interior sheet (furniture, curtains,
          clocks, bookcases), the ship sheet (cargo, cannons, wheel, the whole moored ship of 「푸른물결항」
          with its stern mirrored the way the harbor snapshot mirrors it);
        - recoloured copies of dungeon tiles (crystals in the element colours, ghost fire);
        - pixels drawn here (coffins, cobwebs, spike traps, pressure plates, gears, glass vats …).
      parts.json lists every part (name, passability, layer, where it came from) and the multi-cell stamps.

  public/assets/atlas-dungeons/<theme>-chipset.png
      the EasyRPG dungeon chipset with the SAME tile numbers, repainted (the climate-sheet method) or with whole
      RM2k autotile blocks swapped in from a sibling EasyRPG sheet (same block layout, so every variant map of the
      dungeon definition still fits): ghost ship (ship-sheet rim, wall and holed deck), haunted manor
      (interior-sheet ceiling, wallpaper, wood floor, red carpet), lab, the four element temples, sky tower, trial
      tower, dream world, spider nest, ancient ruins, bonus abyss.

Usage: python3 scripts/content/build-atlas-dungeon-sheets.py
"""
import colorsys
import importlib.util
import io
import base64
import json
import os
from PIL import Image, ImageDraw

HERE = os.path.dirname(os.path.abspath(__file__))
spec = importlib.util.spec_from_file_location("rpgsheets", os.path.join(HERE, "build-rpg-dungeon-sheets.py"))
R = importlib.util.module_from_spec(spec)
spec.loader.exec_module(R)
span, repaint, lum, ramp_at, chasm_to_water = R.span, R.repaint, R.lum, R.ramp_at, R.chasm_to_water

COLS = 30
DUNGEON = "public/assets/easyrpg-chipset-dungeon-transparent.png"
INTERIOR = "public/assets/easyrpg-chipset-interior-transparent.png"
SHIP = "public/assets/easyrpg-chipset-ship-transparent.png"
OUT = "public/assets/atlas-dungeons"
DATA = "tiledata/atlas-dungeons"
PART_BASE = 510  # first family slot of the parts (the dungeon family ends at 509: 480 sheet + 30 grafted)
SHIP_KEY = (0xFF, 0x67, 0x8B)


def load(path, key=None):
    im = Image.open(path).convert("RGBA")
    if key:
        px = im.load()
        for y in range(im.height):
            for x in range(im.width):
                r, g, b, a = px[x, y]
                if (r, g, b) == key:
                    px[x, y] = (0, 0, 0, 0)
    return im


def cell(im, t):
    x0, y0 = (t % COLS) * 16, (t // COLS) * 16
    return im.crop((x0, y0, x0 + 16, y0 + 16))


def put_cell(im, t, tile):
    x0, y0 = (t % COLS) * 16, (t // COLS) * 16
    im.paste((0, 0, 0, 0), (x0, y0, x0 + 16, y0 + 16))
    im.alpha_composite(tile, (x0, y0))


def flipped(tile):
    return tile.transpose(Image.FLIP_LEFT_RIGHT)


def pass_str(p):
    return "".join(k for k, v in zip("udlr", (p["up"], p["down"], p["left"], p["right"])) if v)


def flip_pass(s):
    return "".join(sorted(({"l": "r", "r": "l"}.get(c, c) for c in s), key="udlr".index))


def and_pass(a, b):
    return "".join(c for c in "udlr" if c in a and c in b)


# ── source rules: passability of the sheets the copies come from ─────────────────────────────────────────────
def tsv_rules(path):
    out = {}
    for line in open(path):
        n, label, prio, p = line.rstrip("\n").split("\t")
        out[int(n)] = (label, prio, pass_str(json.loads(p)))
    return out


class Parts:
    def __init__(self):
        self.items, self.index, self.by_pixels = [], {}, {}
        self.stamps = {}

    def add(self, key, img, passable, layer="upper", label=None, source="drawn", dedupe=False):
        """One 16×16 part. passable: 'udlr' subset. layer: the layer it is meant for (lower = floor)."""
        assert img.size == (16, 16), key
        if key in self.index:
            raise ValueError("duplicate part " + key)
        if dedupe:
            sig = (img.tobytes(), passable, layer)
            if sig in self.by_pixels:
                self.index[key] = self.by_pixels[sig]
                return self.index[key]
        i = len(self.items)
        self.items.append({"key": key, "img": img, "pass": passable, "layer": layer, "label": label or key, "source": source})
        self.index[key] = i
        if dedupe:
            self.by_pixels[sig] = i
        return i

    def tile(self, key):
        return PART_BASE + self.index[key]

    def save(self):
        os.makedirs(OUT, exist_ok=True)
        rows = (len(self.items) + COLS - 1) // COLS
        sheet = Image.new("RGBA", (COLS * 16, rows * 16), (0, 0, 0, 0))
        for i, it in enumerate(self.items):
            sheet.alpha_composite(it["img"], ((i % COLS) * 16, (i // COLS) * 16))
        sheet.save(f"{OUT}/parts.png", optimize=True)
        os.makedirs(DATA, exist_ok=True)
        data = {
            "base": PART_BASE, "texture": "tex_oprn_dungeon_parts", "count": len(self.items),
            "parts": [{"tile": PART_BASE + i, "key": it["key"], "label": it["label"], "pass": it["pass"], "layer": it["layer"], "source": it["source"]} for i, it in enumerate(self.items)],
            "alias": {k: PART_BASE + v for k, v in self.index.items()},
            "stamps": self.stamps,
        }
        with open(f"{DATA}/parts.json", "w") as f:
            json.dump(data, f, ensure_ascii=False, indent=0)
            f.write("\n")
        return sheet


# ── 1. the moored ship of 푸른물결항 (harbor snapshot), stern mirrored like the snapshot's stern events ───────────
STAIRS = {(10, 1), (10, 2), (15, 1), (15, 2)}


def ship_stamp(P, ship_img):
    snap = json.load(open("src/project/regionReferences/ships.json"))
    m = snap["maps"]["map_bluewave_harbor"]
    rules = snap["tilesets"]["bluewave_harbor_tiles"]
    W = m["width"]
    L, U = m["lowerTiles"], m["upperTiles"]
    sp = lambda t: pass_str(rules["passability"][t])
    label = lambda t: (rules.get("tileMeta") or [{}] * 480)[t].get("label", str(t)) if t < len(rules.get("tileMeta") or []) else str(t)
    stern = {}
    for e in m["events"]:
        g = e["pages"][0].get("graphic", {}).get("sprite", {}).get("id", "")
        if g.startswith("ref_stern_"):
            stern[(e["x"], e["y"])] = int(g.split("_")[-1])
    x0, x1, y0, y1 = 17, 46, 18, 28
    lower, upper = [], []
    for y in range(y0, y1 + 1):
        lr, ur = [], []
        for x in range(x0, x1 + 1):
            lo, up = L[y * W + x], U[y * W + x]
            if up == 356:
                up = 167  # a lone cannon muzzle poking through the bottom rail shows the sea behind it: keep the rail
            st = stern.get((x, y))
            if lo == 14:
                # a deck cell boxed in by the bow fittings (rel 4,3) would be a stranded pocket: it is not a floor
                boxed = (x - x0, y - y0) in {(4, 3)}
                lr.append(P.add(f"ship:deck:{x - x0},{y - y0}", cell(ship_img, 14), "" if boxed else sp(14), "lower", "배 갑판 널(푸른물결항 배)", "EasyRPG 배 14", dedupe=True) + PART_BASE)
            else:
                lr.append(None)
            if up == -1 and st is None:
                ur.append(None)
                continue
            img = Image.new("RGBA", (16, 16), (0, 0, 0, 0))
            ps, names = "udlr", []
            if up != -1:
                img.alpha_composite(cell(ship_img, up)); ps = and_pass(ps, sp(up)); names.append(f"{up}")
            if st is not None:
                img.alpha_composite(flipped(cell(ship_img, st))); ps = and_pass(ps, flip_pass(sp(st))); names.append(f"{st}(좌우 반전)")
            if lo != 14:
                ps = ""  # hull over the water: never a floor
            if (x - x0, y - y0) in STAIRS:
                ps = "udlr"  # the quarterdeck stairs (45·75 and their mirror 194·224) are climbed
            ur.append(P.add(f"ship:hull:{x - x0},{y - y0}", img, ps, "upper", "배 선체·갑판 조각 " + "+".join(names), "EasyRPG 배 " + "+".join(names), dedupe=True) + PART_BASE)
        lower.append(lr)
        upper.append(ur)
    P.stamps["moored-ship"] = {"name": "정박한 범선(푸른물결항 배, 선미 반전)", "w": x1 - x0 + 1, "h": y1 - y0 + 1, "lower": lower, "upper": upper,
                               "note": "선체 칸 아래는 물(lower=null 이면 맵의 물을 둔다), 갑판 칸 lower 는 널. 이물 왼쪽, 선미 오른쪽. 승선 널판은 윗면 가운데 x=11~12 (선실 지붕 왼쪽) 에 댄다"}


def add_block(P, key, img, passable, layer="upper", label=None, source="drawn", flat=False):
    """Cut a w×h picture into parts key:dx,dy and register it as a stamp (all on `layer`)."""
    w, h = img.width // 16, img.height // 16
    grid = []
    for dy in range(h):
        row = []
        for dx in range(w):
            c = img.crop((dx * 16, dy * 16, dx * 16 + 16, dy * 16 + 16))
            i = P.add(f"{key}:{dx},{dy}" if w * h > 1 else key, c, passable if not callable(passable) else passable(dx, dy, w, h), layer, label, source)
            row.append(PART_BASE + i)
        grid.append(row)
    blank = [[None] * w for _ in range(h)]
    P.stamps[key] = {"name": label or key, "w": w, "h": h, "lower": grid if layer == "lower" else blank, "upper": grid if layer == "upper" else blank}
    return grid


def copy_parts(P, im, rules, prefix, entries, source_name, tint=None):
    """entries: (key, [[tile,…],…] rows, label). Copies EasyRPG tiles with their own passability."""
    for key, rows, label in entries:
        h, w = len(rows), len(rows[0])
        pic = Image.new("RGBA", (w * 16, h * 16), (0, 0, 0, 0))
        for dy, r in enumerate(rows):
            for dx, t in enumerate(r):
                if t is not None:
                    pic.alpha_composite(cell(im, t), (dx * 16, dy * 16))
        if tint:
            pic = A.recolor(pic, A.RAMPS[tint]) if isinstance(tint, str) else tint(pic)
        flat = {(dx, dy): rules[rows[dy][dx]][2] if rows[dy][dx] is not None else "" for dy in range(h) for dx in range(w)}
        layer = "lower" if all(rules[t][1] == "lower" and rules[t][2] == "" for r in rows for t in r if t is not None) and key.endswith("floor") else "upper"
        ids = "·".join(str(t) for r in rows for t in r if t is not None)
        add_block(P, f"{prefix}:{key}", pic, lambda dx, dy, W, H: flat[(dx, dy)], layer, label, f"{source_name} {ids}")


def ghostly(pic):
    """Desaturate towards a cold sea-green: wreck wood, drowned iron."""
    out = pic.copy()
    px = out.load()
    for y in range(out.height):
        for x in range(out.width):
            r, g, b, a = px[x, y]
            if not a:
                continue
            L = 0.299 * r + 0.587 * g + 0.114 * b
            nr, ng, nb = L * 0.78 + r * 0.12, L * 0.92 + g * 0.12, L * 0.9 + b * 0.16
            px[x, y] = (min(255, round(nr)), min(255, round(ng)), min(255, round(nb)), a)
    return out


import atlas_dungeon_art as A  # noqa: E402  (scripts/content is on sys.path: this file's directory)


def build_parts():
    ship = load(SHIP, SHIP_KEY)
    interior = load(INTERIOR)
    dungeon = load(DUNGEON)
    P = Parts()
    # ── 1. the moored ship (pirate cove, ghost ship deck) ──
    ship_stamp(P, ship)

    # ── 2. interior furniture (EasyRPG interior, CC0) — manor, lab, hideouts, merchants ──
    irules = tsv_rules("output/atlas-scratch/meta-easyrpg_chipset_interior.tsv") if os.path.exists("output/atlas-scratch/meta-easyrpg_chipset_interior.tsv") else json.load(open(f"{DATA}/interior-rules.json"), object_hook=None)
    if isinstance(irules, dict) and irules and isinstance(next(iter(irules.values())), list):
        irules = {int(k): tuple(v) for k, v in irules.items()}
    os.makedirs(DATA, exist_ok=True)
    json.dump({str(k): list(v) for k, v in irules.items()}, open(f"{DATA}/interior-rules.json", "w"), ensure_ascii=False)
    I = [
        ("bookcase", [[18, 19, 20], [48, 49, 50], [78, 79, 80]], "큰 책장 3×3"),
        ("shelf-books", [[147], [177]], "책 꽂힌 선반장"), ("cupboard", [[148], [178]], "선반장"), ("wardrobe", [[149], [179]], "양문 수납장"),
        ("bed-v", [[324], [354]], "세로 침대"), ("bed-h", [[355, 356]], "가로 침대"),
        ("table-long", [[325, 326, 327]], "긴 탁자"), ("table-square", [[328]], "사각 탁자"), ("table-round", [[236]], "원형 탁자"),
        ("table-tall", [[234], [264], [294]], "세로 긴 탁자"),
        ("chair-r", [[267]], "등받이 의자(오른쪽 보기)"), ("chair-l", [[268]], "등받이 의자(왼쪽 보기)"),
        ("seat-r", [[297]], "의자(오른쪽 보기)"), ("seat-l", [[298]], "의자(왼쪽 보기)"), ("stool", [[266]], "원형 걸상"), ("chair-fallen", [[384]], "쓰러진 의자"),
        ("candle", [[204]], "촛대"), ("lantern", [[206]], "랜턴"), ("clock", [[389], [419]], "괘종시계"), ("mirror", [[269], [299]], "대형 거울"),
        ("armor", [[87], [117]], "갑옷 전시대"), ("bust", [[88], [118]], "여자 흉상"), ("pillar", [[89], [119]], "돌기둥"), ("armor-stand", [[290]], "갑옷(전시)"),
        ("curtain", [[318, 319], [348, 349]], "붉은 커튼(창 양옆)"), ("drape", [[142, 143], [172, 173], [202, 203]], "붉은 대형 커튼"), ("banner", [[378, 379]], "붉은 배너"),
        ("piano", [[358, 359]], "피아노"), ("cauldron", [[323]], "가마솥"), ("crystal-ball", [[329]], "수정구 점술대"), ("jar-shelf", [[320]], "단지 선반"),
        ("jars", [[350]], "흰 단지 두 개"), ("pot", [[235]], "항아리"), ("barrel", [[205]], "대형 나무 통"), ("crate", [[295]], "나무 상자"), ("box", [[55]], "나무 궤짝"),
        ("bucket", [[265]], "나무 물통"), ("plank-stand", [[386]], "세운 나무 판자"), ("plank-pile", [[387]], "판자 더미"), ("glass", [[417]], "깨진 유리 조각"),
        ("crack", [[388], [418]], "벽 균열"), ("skeleton", [[470]], "해골 유골"), ("sack", [[471]], "곡물 자루"), ("ladder", [[472]], "나무 사다리"),
        ("painting-land", [[84]], "풍경 액자"), ("painting-fire", [[85]], "불꽃 액자"), ("painting-big", [[114, 115]], "대형 그림"),
        ("window", [[54]], "흰 창문"), ("window-curtain", [[56]], "커튼 창문"), ("window-dark", [[174]], "격자 창(어두운)"), ("stained", [[144]], "스테인드글라스"),
        ("book-open", [[145]], "펼친 책"), ("book-red", [[175]], "붉은 책"), ("letters", [[322]], "흩어진 편지"), ("feather", [[352]], "큰 깃털"),
        ("circle", [[381, 382, 383], [411, 412, 413], [441, 442, 443]], "마법진 3×3"), ("stove", [[209], [239]], "난로 연통"), ("oven", [[21], [51]], "화덕 오븐"),
        ("counter", [[22, 23], [52, 53]], "조리대"), ("food", [[207]], "고기 요리"), ("salad", [[208]], "샐러드 접시"), ("bottles", [[237]], "술병과 잔"), ("dishes", [[238]], "식기 세트"),
        ("weapon-case", [[263], [293]], "검 진열 박스"), ("wall-sword", [[260]], "벽걸이 검"), ("wall-hammer", [[261]], "벽걸이 망치"), ("wall-shield", [[262]], "벽걸이 방패"),
        ("helmet", [[291]], "가죽 투구"), ("leather", [[292]], "가죽 갑옷"), ("ore", [[414]], "광석 바위"), ("rocks", [[415]], "둥근 바위 더미"), ("bricks", [[416]], "부서진 벽돌 더미"),
        ("fruit-shelf", [[25]], "과일 단지 선반"), ("cross", [[59]], "십자 장식"), ("cloth-table", [[228, 229, 230]], "흰 천 테이블"), ("teapot", [[380]], "돌 항아리"),
        ("necklace", [[321]], "보석 목걸이"), ("boots", [[353]], "가죽 장화 더미"), ("sign-weapon", [[27]], "무기점 간판"), ("sign-armor", [[28]], "방어구점 간판"), ("sign-item", [[29]], "잡화점 간판"),
        ("throne-red", [[446], [476]], "붉은 의자"), ("stair-down", [[474]], "하강 계단 1×1"),
    ]
    copy_parts(P, interior, irules, "int", I, "EasyRPG 실내")
    # manor-tinted copies of the pieces the haunted manor uses (cold, faded)
    MANOR = ["bookcase", "shelf-books", "cupboard", "wardrobe", "bed-v", "bed-h", "table-long", "table-square", "table-round", "chair-r", "chair-l", "seat-r", "seat-l", "stool", "chair-fallen",
             "candle", "clock", "mirror", "armor", "bust", "curtain", "drape", "piano", "painting-land", "painting-fire", "painting-big", "window-dark", "window-curtain", "cloth-table", "crack", "glass",
             "plank-stand", "plank-pile", "crate", "barrel", "sack", "box", "letters", "book-open", "dishes", "bottles", "skeleton", "stove", "oven", "counter", "pot", "jars", "banner", "throne-red"]
    copy_parts(P, interior, irules, "manor", [e for e in I if e[0] in MANOR], "EasyRPG 실내(저택 재칠)", tint=manor_tint)

    # ── 3. ship cargo and fittings (EasyRPG ship, CC0), plain and ghostly ──
    snap = json.load(open("src/project/regionReferences/ships.json"))
    srules_def = snap["tilesets"]["bluewave_harbor_tiles"]
    srules = {i: ((srules_def.get("tileMeta") or [{}] * 480)[i].get("label", "") if (srules_def.get("tileMeta") or [None] * 480)[i] else "", "upper", pass_str(srules_def["passability"][i])) for i in range(480)}
    S = [
        ("barrel", [[385]], "대형 오크통"), ("barrel-open", [[415]], "열린 나무통"), ("crate", [[379]], "사각 나무 상자"), ("drawer", [[382]], "나무 서랍 가구"),
        ("jug", [[386]], "도자기 항아리"), ("table", [[387]], "둥근 나무 탁자"), ("stool", [[417]], "둥근 목재 의자"), ("bookcase", [[414], [384]], "책장"),
        ("cannon-l", [[324]], "왼쪽 향한 대포"), ("cannon-r", [[325]], "오른쪽 향한 대포"), ("cannon-front", [[326], [356]], "정면 대포"), ("cannon-up", [[327], [357]], "상향 대포"),
        ("cannon-cart-l", [[354]], "좌향 포차 대포"), ("cannon-cart-r", [[355]], "우향 포신 대포"),
        ("anchor", [[259]], "닻"), ("rope", [[263]], "감긴 밧줄 더미"), ("rigging", [[204]], "밧줄과 활 장비"), ("wheel", [[58]], "나무 키(조타륜)"), ("wheel-side", [[59]], "나무 바퀴 측면"),
        ("lamp", [[83]], "사각 금속 등"), ("skull", [[205]], "해골과 뼈 더미"), ("swords", [[295]], "엇갈린 은색 검"), ("flag", [[288]], "붉은 삼각 깃발"), ("banner", [[318], [348]], "붉은 금장 깃발"),
        ("hammock", [[416], [446]], "흰 베개 침대"), ("bunk", [[476, 477]], "침대(옆면)"), ("wardrobe", [[474, 475]], "나무 장롱"), ("organ", [[444, 445]], "파이프오르간"),
        ("potions", [[148]], "선반 위 물약병"), ("shelf", [[143]], "벽 부착 가로 널 선반"), ("vent", [[202]], "환기 격자창"), ("porthole", [[232]], "창살 격자 창문"),
        ("picture-sea", [[388, 389]], "바다 그림 액자"), ("winch", [[138], [142]], "원통형 권양기"), ("post", [[57]], "짧은 세로 목재 말뚝"), ("hole", [[294]], "나무 위 검은 구멍"),
        ("ladder", [[22, 23], [22, 23]], "목재 사다리(2×2)"), ("ladder-top", [[328]], "목재 사다리 상단"), ("hatch-top", [[264]], "갑판 해치 입구 상단"), ("rope-hang", [[298]], "늘어진 밧줄"),
        ("cabin-wall", [[198, 199, 200, 201], [228, 229, 230, 231]], "목재 선실 벽 4×2"), ("rail-v", [[418], [478]], "세로 목재 난간"), ("rail-h", [[447, 448, 449]], "가로 목재 난간"),
    ]
    copy_parts(P, ship, srules, "ship", S, "EasyRPG 배")
    copy_parts(P, ship, srules, "ghost", S, "EasyRPG 배(유령선 재칠)", tint=ghostly)

    # ── 4. dungeon tiles recoloured: crystals in element colours, ghost and element fires ──
    drules = {i: ("", "upper", "") for i in range(480)}
    CRY = [("crystal-big", [[320, 321], [350, 351]], "큰 수정"), ("crystal-pillar", [[262], [292]], "수정 기둥"), ("crystal-small", [[289]], "작은 수정"), ("crystal-pile", [[413]], "수정 무더기"), ("gem", [[118]], "보석")]
    NAMES = {"red": "붉은", "green": "초록", "amber": "호박색", "gold": "금빛", "violet": "보라", "pink": "분홍", "cyan": "청록", "white": "흰"}
    for c, nm in NAMES.items():
        copy_parts(P, dungeon, drules, f"cry-{c}", [(k, rows, f"{nm} {label}") for k, rows, label in CRY], f"EasyRPG 던전({nm} 재칠)", tint=c)
    FIRE = [("fire", [[207]], "바닥 불길"), ("fire-small", [[209]], "바닥 불길 작은"), ("torch", [[264]], "벽 횃불"), ("brazier", [[263], [293]], "화로")]
    walk = {207: "udlr", 209: "udlr", 264: "udlr", 263: "", 293: ""}
    for c, nm in {"ghost": "도깨비불(청록)", "violet": "보랏빛", "green": "초록"}.items():
        copy_parts(P, dungeon, {k: ("", "upper", v) for k, v in walk.items()}, f"fire-{c}", [(k, rows, f"{nm} {label}") for k, rows, label in FIRE], f"EasyRPG 던전({nm} 재칠)", tint=c)

    # ── 5. drawn here ──
    add_block(P, "coffin-wood", A.coffin("wood"), "", label="나무 관(닫힘) 1×2")
    add_block(P, "coffin-wood-open", A.coffin("wood", True), "", label="열린 나무 관과 유골 1×2")
    add_block(P, "coffin-stone", A.coffin("stone"), "", label="석관(기사 부조) 1×2")
    add_block(P, "coffin-stone-open", A.coffin("stone", True), "", label="열린 석관과 유골 1×2")
    add_block(P, "chest-wood", A.chest(A.WOOD, A.GOLD), "", label="보물상자(나무·금테)")
    add_block(P, "chest-wood-open", A.chest(A.WOOD, A.GOLD, True, A.GOLD), "", label="열린 보물상자")
    add_block(P, "chest-iron", A.chest(A.IRON, A.GOLD), "", label="쇠 보물상자")
    add_block(P, "chest-iron-open", A.chest(A.IRON, A.GOLD, True, A.GOLD), "", label="열린 쇠 보물상자")
    add_block(P, "chest-red", A.chest(A.RED + [(255, 200, 170, 255)], A.GOLD), "", label="붉은 금장 보물상자(보스 보상)")
    add_block(P, "chest-red-open", A.chest(A.RED + [(255, 200, 170, 255)], A.GOLD, True, A.GOLD), "", label="열린 붉은 보물상자")
    add_block(P, "web-l", A.web_corner("left"), "udlr", label="거미줄(왼쪽 위 모서리)")
    add_block(P, "web-r", A.web_corner("right"), "udlr", label="거미줄(오른쪽 위 모서리)")
    add_block(P, "web-big", A.web_big(), "", label="큰 거미줄 2×2(막힘)")
    add_block(P, "egg-sac", A.egg_sac(), "", label="거미 알 무더기")
    add_block(P, "cocoon", A.cocoon(), "", label="거미줄에 감긴 고치 1×2")
    add_block(P, "spikes-down", A.spike_plate(False), "udlr", label="가시 함정(들어감)")
    add_block(P, "spikes-up", A.spike_plate(True), "", label="가시 함정(솟음)")
    add_block(P, "plate", A.pressure_plate(False), "udlr", label="발판 스위치")
    add_block(P, "plate-down", A.pressure_plate(True), "udlr", label="눌린 발판 스위치")
    add_block(P, "lever-off", A.floor_lever(False), "", label="바닥 레버(왼쪽)")
    add_block(P, "lever-on", A.floor_lever(True), "", label="바닥 레버(오른쪽)")
    GLY = {"wind": ((60, 150, 110, 255), (110, 210, 160, 255), (210, 255, 230, 255)), "water": ((30, 80, 160, 255), (70, 150, 230, 255), (200, 236, 255, 255)),
           "earth": ((120, 80, 20, 255), (190, 140, 40, 255), (250, 220, 120, 255)), "fire": ((140, 30, 20, 255), (220, 80, 40, 255), (255, 200, 120, 255)),
           "star": ((110, 80, 20, 255), (200, 160, 50, 255), (255, 240, 170, 255)), "eye": ((80, 30, 120, 255), (150, 80, 210, 255), (230, 200, 255, 255))}
    for k, col in GLY.items():
        add_block(P, f"rune-{k}", A.rune_glyph(col, k), "udlr", label=f"바닥 룬({k})")
    add_block(P, "sparkle-gold", A.sparkle((255, 236, 150, 255)), "udlr", label="반짝임(금빛)")
    add_block(P, "sparkle-blue", A.sparkle((180, 240, 255, 255)), "", label="샘물 반짝임(물 위)")
    add_block(P, "gear-big", A.gear(2), "", label="큰 톱니바퀴 2×2")
    add_block(P, "gear", A.gear(1), "", label="톱니바퀴")
    for k in ("h", "v", "cross", "valve"):
        add_block(P, f"pipe-{k}", A.pipe(k), "", label={"h": "가로 관", "v": "세로 관", "cross": "관 이음", "valve": "관 밸브"}[k])
    add_block(P, "piston", A.piston(), "", label="피스톤 기둥 1×2")
    add_block(P, "vat", A.vat(((20, 80, 40, 255), (70, 190, 100, 200), (170, 250, 190, 255))), "", label="초록 약물 유리관 1×2")
    add_block(P, "vat-specimen", A.vat(((30, 60, 40, 255), (70, 190, 100, 200), (170, 250, 190, 255)), specimen=True), "", label="표본이 든 유리관 1×2")
    add_block(P, "vat-blue", A.vat(((20, 50, 100, 255), (70, 140, 220, 200), (170, 220, 255, 255))), "", label="푸른 약물 유리관 1×2")
    add_block(P, "vat-broken", A.vat(((20, 80, 40, 255), (70, 190, 100, 200), (170, 250, 190, 255)), broken=True), "", label="깨진 유리관 1×2")
    add_block(P, "console", A.lab_console(), "", label="장치 조종대 2×1")
    add_block(P, "mast-stump", A.mast_stump(), "", label="부러진 돛대 밑동")
    add_block(P, "hatch-open", A.floor_hatch(True), "udlr", label="열린 바닥 해치(사다리)")
    add_block(P, "hatch", A.floor_hatch(False), "udlr", label="닫힌 바닥 해치")
    add_block(P, "shackles", A.shackles(), "udlr", label="벽 족쇄")
    add_block(P, "ore-gold", A.ore_vein(A.GOLD), "udlr", label="금 광맥(벽면)")
    add_block(P, "ore-silver", A.ore_vein(A.IRON), "udlr", label="은 광맥(벽면)")
    add_block(P, "lift", A.lift_platform(), "udlr", label="승강 발판 2×2", layer="upper")
    add_block(P, "basin", A.healing_basin(), "", label="회복의 샘 돌확 2×2")
    add_block(P, "bones", A.bone_pile(), "udlr", label="뼈 무더기")
    return P


def manor_tint(pic):
    """Faded, cold manor colours: 45% towards grey, a little violet in the shadows."""
    out = pic.copy()
    px = out.load()
    for y in range(out.height):
        for x in range(out.width):
            r, g, b, a = px[x, y]
            if not a:
                continue
            L = 0.299 * r + 0.587 * g + 0.114 * b
            k = 0.45
            nr, ng, nb = r + (L - r) * k, g + (L - g) * k, b + (L - b) * k
            nr, ng, nb = nr * 0.92, ng * 0.9, nb * 1.02 + 6
            px[x, y] = (max(0, min(255, round(nr))), max(0, min(255, round(ng))), max(0, min(255, round(nb))), a)
    return out


# ── sheets ────────────────────────────────────────────────────────────────────────────────────────────────────
BLOCK = lambda first: [first + r * 30 + c for r in range(4) for c in range(3)]
RIM = BLOCK(369)
CHASM_BLK = BLOCK(129)
WALLS = span((21, 23), (51, 53))
FLOORS = span(187, (108, 111), 78, 79, 80, 81, 82, 83, 112, 113)
CRYSTALS = span(118, 119, 149, 262, 292, 289, 320, 321, 350, 351, 413)
FIRE = span(207, 208, 209, 263, 264, 293)
WATER = span((0, 5), (30, 35), (60, 65), (90, 95), (120, 125), (150, 155), (180, 185), (210, 215))


def swap(dst, src_img, pairs):
    for d_t, s_t in pairs:
        put_cell(dst, d_t, cell(src_img, s_t))


def tint_all(img, fn, tiles=range(480)):
    for t in tiles:
        x0, y0 = (t % COLS) * 16, (t // COLS) * 16
        img.paste(fn(img.crop((x0, y0, x0 + 16, y0 + 16))), (x0, y0))


def sky_rim(img, sky, frame):
    """Rim cells become open sky: dark pixels → a vertical sky gradient with soft cloud flecks; the frame → cloud edge."""
    px = img.load()
    import random
    rnd = random.Random(7)
    for t in RIM:
        x0, y0 = (t % COLS) * 16, (t // COLS) * 16
        for y in range(16):
            for x in range(16):
                r, g, b, a = px[x0 + x, y0 + y]
                if not a:
                    continue
                L = lum(r, g, b)
                if L < 40:
                    c = ramp_at(sky, 0.35 + 0.3 * ((y0 + y) % 64) / 64)
                    if rnd.random() < 0.035:
                        c = sky[-1]
                    px[x0 + x, y0 + y] = (*c, 255)
                else:
                    c = ramp_at(frame, L / 255)
                    px[x0 + x, y0 + y] = (*c, 255)


def star_rim(img, deep, star):
    px = img.load()
    import random
    rnd = random.Random(11)
    for t in RIM:
        x0, y0 = (t % COLS) * 16, (t // COLS) * 16
        for y in range(16):
            for x in range(16):
                r, g, b, a = px[x0 + x, y0 + y]
                if not a:
                    continue
                L = lum(r, g, b)
                if L < 40:
                    px[x0 + x, y0 + y] = (*deep, 255) if rnd.random() > 0.02 else (*star, 255)


def recolor_classes(img, spec):
    for tiles, ramp, lo, hi in spec:
        repaint(img, tiles, ramp, lo=lo, hi=hi)


def element_sheet(base, walls, floors, props, crystal, rim=None, extra=None):
    im = base.copy()
    classes = [(R.EARTH_WALLS + R.TEAL + R.STONE_CLIFF, walls, 20, 150), (R.STONE_FLOOR + FLOORS + R.PLATFORM + R.DIRT, floors, 20, 190),
               (R.STATUES + R.BARS + R.BOULDERS_GRAY, props, 15, 230), (R.BOULDERS_BROWN, walls, 15, 200)]
    if rim:
        classes.append((RIM, rim, 0, 150))
    recolor_classes(im, classes)
    repaint(im, CRYSTALS, crystal, lo=15, hi=250, keep_special=False)
    if extra:
        extra(im)
    return im


SHEETS_DOC = {}


def build_sheets():
    base = load(DUNGEON)
    ship = load(SHIP, SHIP_KEY)
    interior = load(INTERIOR)
    os.makedirs(OUT, exist_ok=True)
    out = {}

    # 유령선: ship-sheet rim (dark hold with a timber frame), cabin wall face, deck planks, deck holes as the chasm
    g = base.copy()
    swap(g, ship, list(zip(RIM, RIM)) + list(zip(CHASM_BLK, CHASM_BLK)) + [(21, 198), (22, 199), (23, 201), (51, 228), (52, 229), (53, 231), (187, 14), (108, 13), (109, 12), (110, 247), (111, 277)])
    tint_all(g, ghostly)
    repaint(g, WATER, [(4, 14, 18), (8, 30, 36), (18, 52, 58), (40, 86, 90), (86, 140, 136), (160, 200, 190)], lo=10, hi=240, keep_special=False)
    out["ghostship"] = (g, "던전 · 유령선 (배 시트 선실 벽·갑판·구멍, 재칠)", "배 시트의 선실 벽(198~231)·갑판 널(12~14)·어두운 선창 테두리(369~461)·갑판 구멍(129~221)을 던전 칸 번호에 옮겨 넣고 차가운 청록 회색으로 바랜 난파선 색으로 칠했다")

    # 유령 저택: interior-sheet ceiling rim, cream wallpaper, plank floor, red carpet → faded and cold
    m = base.copy()
    swap(m, interior, list(zip(RIM, RIM)) + [(21, 75), (22, 76), (23, 77), (51, 105), (52, 106), (53, 107), (187, 102), (108, 72), (109, 163), (110, 162), (112, 103)]
         + [(d, s) for d, s in zip([138, 139, 140, 168, 169, 170, 198, 199, 200], [375, 376, 377, 405, 406, 407, 435, 436, 437])])
    tint_all(m, manor_tint, list(range(480)))
    out["manor"] = (m, "던전 · 유령 저택 (실내 시트 벽지·마루·카펫, 재칠)", "실내 시트의 천장 테두리·크림 벽지(75~107)·나무 마루(72·102·103)·무늬 석판(162·163)·붉은 카펫을 던전 칸 번호에 옮기고 빛바랜 찬 색으로 칠했다. 던전 원래 벽(18~20·48~50 청록 돌)과 젖은 돌바닥 111 은 지하실용으로 남는다")

    # 비밀 연구소: light brick wall, cracked stone floor, faint green
    lab = base.copy()
    swap(lab, interior, [(21, 135), (22, 136), (23, 137), (51, 165), (52, 166), (53, 167), (187, 162), (108, 74), (109, 163), (110, 42)])
    tint_all(lab, lambda p: A.recolor(p, [(10, 20, 16), (40, 60, 52), (84, 108, 98), (136, 160, 150), (196, 214, 206), (236, 246, 240)]) , RIM + WALLS + [187, 108, 109, 110])
    repaint(lab, CRYSTALS, A.RAMPS["green"], lo=15, hi=250, keep_special=False)
    out["lab"] = (lab, "던전 · 비밀 연구소 (밝은 벽돌·석재 바닥, 재칠)", "실내 시트의 밝은 벽돌(135~167)·금간 석재 162·흰 바닥 74·문양 석판 163 을 옮기고 약품 냄새 나는 옅은 청록 회색으로 칠했다. 수정은 초록")

    # 원소 신전 넷
    out["wind"] = (element_sheet(base, [(30, 50, 46), (70, 104, 96), (116, 152, 140), (164, 196, 184), (206, 230, 220), (240, 252, 246)],
                                 [(60, 70, 60), (120, 136, 120), (170, 186, 168), (206, 220, 204), (230, 240, 226), (248, 252, 244)],
                                 [(40, 60, 56), (90, 120, 110), (150, 180, 170), (200, 222, 214), (236, 246, 240), (255, 255, 255)], A.RAMPS["green"],
                                 rim=[(14, 24, 24), (60, 90, 86), (120, 160, 150), (180, 210, 200), (220, 240, 232), (250, 255, 252)]),
                   "던전 · 바람의 신전 (옥빛 대리석, 재칠)", "벽·바닥·석상·테두리를 옥빛 대리석으로, 수정을 초록으로 칠했다")
    out["tide"] = (element_sheet(base, [(10, 30, 50), (24, 66, 96), (46, 110, 140), (90, 160, 180), (160, 210, 220), (220, 244, 248)],
                                 [(50, 70, 90), (110, 140, 160), (164, 190, 204), (204, 222, 232), (230, 240, 246), (248, 252, 255)],
                                 [(20, 50, 70), (60, 110, 140), (120, 170, 196), (180, 214, 230), (226, 242, 250), (255, 255, 255)], [(6, 30, 70), (10, 70, 150), (30, 130, 220), (100, 190, 250), (190, 236, 255), (240, 252, 255)]),
                   "던전 · 물의 신전 (청백 대리석, 재칠)", "벽을 물빛 대리석, 바닥을 흰 청석으로, 수정은 푸른색 그대로(더 맑게) 칠했다")
    out["earth"] = (element_sheet(base, [(34, 26, 10), (78, 62, 26), (122, 100, 50), (164, 140, 80), (200, 180, 120), (230, 216, 170)],
                                  [(46, 40, 20), (96, 86, 50), (140, 128, 84), (178, 166, 118), (210, 200, 156), (236, 228, 196)],
                                  [(40, 34, 20), (92, 80, 52), (142, 128, 90), (188, 176, 136), (224, 216, 184), (250, 246, 226)], A.RAMPS["amber"]),
                    "던전 · 땅의 신전 (황토 사암·이끼, 재칠)", "벽·바닥을 황토 사암으로, 수정을 호박색으로 칠했다")
    out["fire"] = (element_sheet(base, [(18, 6, 6), (54, 16, 12), (94, 32, 20), (140, 56, 32), (184, 92, 52), (226, 146, 96)],
                                 [(30, 12, 10), (76, 30, 22), (118, 52, 36), (158, 80, 54), (196, 118, 80), (232, 170, 130)],
                                 [(24, 10, 8), (70, 30, 22), (120, 60, 40), (170, 100, 70), (214, 150, 110), (246, 206, 170)], A.RAMPS["red"],
                                 rim=[(10, 2, 2), (60, 14, 8), (130, 40, 14), (200, 90, 30), (240, 150, 60), (255, 210, 120)]),
                   "던전 · 불의 신전 (검붉은 현무암, 재칠)", "벽·바닥·석상을 검붉은 현무암으로, 테두리 선을 불씨색으로, 수정을 붉게 칠했다(용암 신전에 푸른 수정 금지)")

    # 하늘 탑: white marble, gold trim, the void outside the floor is open sky
    sky = element_sheet(base, [(70, 74, 90), (130, 136, 156), (182, 188, 204), (220, 224, 234), (240, 242, 248), (255, 255, 255)],
                        [(110, 104, 80), (176, 168, 136), (214, 206, 176), (236, 230, 206), (248, 244, 228), (255, 254, 246)],
                        [(80, 70, 40), (150, 130, 80), (206, 186, 130), (236, 222, 176), (250, 244, 220), (255, 255, 250)], A.RAMPS["gold"])
    sky_rim(sky, [(90, 140, 210), (120, 170, 230), (150, 196, 240), (186, 220, 248), (220, 238, 252), (250, 252, 255)],
            [(150, 170, 200), (200, 214, 234), (236, 242, 250), (255, 255, 255)])
    out["sky"] = (sky, "던전 · 하늘 탑 (흰 대리석·금, 바깥은 하늘)", "벽·바닥을 흰 대리석과 상아색으로, 석상·기둥을 금빛으로, 공허 테두리를 구름 낀 하늘로 칠했다 — 방 밖이 트인 하늘로 보인다")
    out["trial"] = (element_sheet(base, [(14, 10, 26), (36, 28, 62), (64, 52, 100), (98, 84, 140), (140, 124, 180), (190, 176, 220)],
                                  [(22, 20, 34), (50, 46, 72), (80, 74, 108), (112, 106, 142), (150, 144, 178), (196, 190, 220)],
                                  [(20, 16, 34), (60, 50, 96), (104, 90, 150), (150, 136, 196), (196, 186, 236), (236, 230, 255)], A.RAMPS["violet"]),
                    "던전 · 시련의 탑 (흑요석·보랏빛, 재칠)", "벽·바닥을 흑요석과 보랏빛 석판으로, 수정을 보라로 칠했다")
    dream = element_sheet(base, [(40, 20, 60), (96, 54, 120), (150, 100, 176), (200, 150, 214), (236, 196, 240), (255, 236, 252)],
                          [(70, 50, 90), (130, 104, 160), (180, 156, 206), (214, 196, 234), (236, 224, 248), (252, 246, 255)],
                          [(50, 30, 70), (110, 80, 150), (170, 136, 206), (220, 190, 240), (246, 226, 255), (255, 250, 255)], A.RAMPS["pink"])
    star_rim(dream, (22, 12, 44), (250, 230, 255))
    out["dream"] = (dream, "던전 · 꿈 세계 (연보라 몽환, 별 뜬 공허)", "벽·바닥을 연보라·분홍으로, 공허를 별 뜬 남보라 밤으로, 수정을 분홍으로 칠했다")
    out["spider"] = (element_sheet(base, [(20, 18, 24), (50, 46, 58), (82, 76, 92), (116, 110, 126), (156, 150, 164), (200, 196, 206)],
                                   [(26, 24, 26), (54, 50, 52), (82, 78, 78), (110, 106, 104), (142, 138, 134), (180, 176, 170)],
                                   [(30, 28, 34), (70, 66, 78), (110, 106, 118), (150, 146, 158), (194, 190, 200), (230, 228, 236)], A.RAMPS["violet"]),
                     "던전 · 거미 소굴 (잿빛 동굴, 재칠)", "벽·바닥을 잿빛 보라 바위로, 수정을 보라로 칠했다")
    out["ruins"] = (element_sheet(base, [(20, 34, 30), (46, 72, 62), (80, 108, 90), (124, 146, 116), (170, 182, 146), (214, 218, 184)],
                                  [(54, 52, 36), (104, 100, 70), (150, 144, 104), (186, 178, 136), (214, 206, 168), (238, 232, 204)],
                                  [(40, 36, 20), (100, 82, 40), (160, 128, 60), (206, 170, 90), (236, 206, 140), (255, 238, 196)], A.RAMPS["cyan"]),
                    "던전 · 고대 유적 (녹슨 청동·이끼 사암, 재칠)", "벽을 이끼 낀 청록 돌로, 바닥을 모래빛 판석으로, 석상·창살을 청동으로, 수정을 청록 에너지빛으로 칠했다")
    void = element_sheet(base, [(8, 6, 10), (26, 20, 26), (48, 40, 44), (80, 66, 60), (130, 104, 70), (200, 164, 90)],
                         [(12, 10, 14), (30, 26, 32), (52, 46, 52), (78, 70, 72), (120, 100, 80), (180, 150, 100)],
                         [(20, 14, 6), (70, 50, 16), (140, 104, 34), (200, 160, 60), (240, 210, 120), (255, 244, 200)], A.RAMPS["gold"],
                         rim=[(4, 2, 6), (40, 28, 10), (110, 80, 24), (190, 150, 50), (240, 210, 110), (255, 245, 200)])
    out["abyss"] = (void, "던전 · 심연 (흑금, 보너스 던전)", "벽·바닥을 먹빛으로, 석상·테두리 선을 금빛으로, 수정을 금색으로 칠했다")

    for key, (img, name, how) in out.items():
        img.save(f"{OUT}/{key}-chipset.png", optimize=True)
        SHEETS_DOC[key] = {"id": f"oprn_dungeon_{key}", "name": name, "texture": f"tex_oprn_dungeon_{key}", "path": f"assets/atlas-dungeons/{key}-chipset.png", "how": how}
    return out


def build():
    P = build_parts()
    P.save()
    build_sheets()
    with open(f"{DATA}/sheets.json", "w") as f:
        json.dump(SHEETS_DOC, f, ensure_ascii=False, indent=1)
        f.write("\n")
    print("parts", len(P.items), "sheets", len(SHEETS_DOC))


if __name__ == "__main__":
    build()
