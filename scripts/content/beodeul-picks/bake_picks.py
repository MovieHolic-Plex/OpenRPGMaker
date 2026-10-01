#!/usr/bin/env python3
"""버들항 변형 20곳에서 사용자가 고른 조각을 공용 버들항(beodeul_city) 시트·키트·참고문서에 굽는다.

입력  tiledata/beodeul-variants/picks.json (install_picks.py 가 쓴다) + 같은 폴더의 parts/*.png · render-1x.png · plan.md · parts.md
출력  public/assets/beodeul-city/beodeul-city-chipset.png   — 기존 23,936칸(0~23935)은 그대로, 뒤에 고른 조각 칸을 덧붙인다
      src/assets/beodeulCityTileset.json · beodeulCitySheet.json — 칸 표(통행·층·메타)·애니메이션 띠·키트 bd-pick-*
      src/assets/beodeulCityReferences.json                — 용도 beodeul-picks-* 다섯 개(문서 bd-pick-*, 그림은 /assets/… 경로)
      public/assets/beodeul-city/references/picks/*.png     — 맵 렌더·조각 판·오류 그림 (긴 변 ≤820px, 128색)
      tiledata/beodeul-variants/pick-cells.json + pick-cells.png — 덧붙인 칸 등록부(덧붙이기 전용)

  python3 scripts/content/beodeul-picks/bake_picks.py [--dry]

칸 번호를 지키는 법: 덧붙인 칸은 등록부에 (그림 해시·자리·층·통행) 열쇠로 적고, 다음 실행은 같은 열쇠면 같은 번호를 쓴다.
고른 것이 바뀌어도(var2/var4/var6 다시 그리기 뒤) 옛 칸은 지우지 않고 새 칸만 뒤에 붙인다 — 그 칸을 찍은 맵이 바뀌지 않게.
build-beodeul-city.py 로 시트를 다시 만들면 앞 23,936칸만 남으므로 이 스크립트를 다시 돌린다(등록부가 덧붙인 칸을 그대로 되살린다).
"""
import argparse, hashlib, json, math, os, pathlib, re

from PIL import Image, ImageDraw

ROOT = pathlib.Path(__file__).resolve().parents[3]
VAR = ROOT / "tiledata/beodeul-variants"
SHEET_PATH = ROOT / "public/assets/beodeul-city/beodeul-city-chipset.png"
TS_PATH = ROOT / "src/assets/beodeulCityTileset.json"
SHEET_JSON = ROOT / "src/assets/beodeulCitySheet.json"
REF_PATH = ROOT / "src/assets/beodeulCityReferences.json"
IMG_DIR = ROOT / "public/assets/beodeul-city/references/picks"
MD_DIR = ROOT / "tiledata/beodeul-city/references"
REG_JSON = VAR / "pick-cells.json"
REG_PNG = VAR / "pick-cells.png"
BASE = 23936          # 버들항 v8 시트의 칸 수. 이 앞은 build-beodeul-city.py 소유, 뒤는 이 스크립트 소유.
T = 16
KIT_PREFIX = "bd-pick-"
CAT_PREFIX = "beodeul-picks-"

# 장소: 슬러그 → (한글 이름, 분류 키(themes), 변형 묶음)
PLACES = {
    "fishing-port": ("어촌 포구", ["village", "coast"]), "riverside-mill": ("강가 방앗간 마을", ["village"]),
    "vineyard": ("포도원 마을", ["village"]), "walled-market": ("성벽 장터 마을", ["village"]),
    "desert-oasis": ("사막 오아시스 마을", ["village", "desert"]), "mining-valley": ("광산 골짜기 마을", ["village", "mine"]),
    "snowfield": ("설원 마을", ["village", "snow"]), "swamp-stilt": ("늪 수상 마을", ["village", "swamp"]),
    "aqueduct-sewer": ("지하 수도교·하수도", ["dungeon"]), "castle-catacombs": ("성 지하 감옥·카타콤", ["dungeon"]),
    "sea-cave": ("바다 동굴", ["dungeon", "coast"]), "temple-ruins": ("신전 폐허", ["dungeon"]),
    "headland-lighthouse": ("곶 등대", ["coast", "landmark"]), "shipwreck-reef": ("난파선 암초", ["coast", "dungeon"]),
    "volcano-cave": ("화산 동굴", ["dungeon", "volcano"]), "wizard-tower": ("마법사의 탑", ["landmark", "dungeon"]),
    "coast-cliff-road": ("해안 절벽길", ["field", "coast"]), "deep-forest-path": ("깊은 숲길", ["field", "forest"]),
    "mountain-pass": ("산길 고개", ["field", "mountain"]), "wheat-roman-road": ("밀밭 로마 가도", ["field"]),
}
CAT_KO = {"village": "마을", "coast": "해안", "desert": "사막", "mine": "광산", "snow": "설원", "swamp": "늪", "dungeon": "던전",
          "landmark": "랜드마크", "volcano": "화산", "field": "필드", "forest": "숲", "mountain": "산"}
# 참고문서 용도 = 변형 묶음(var1~5). var6 은 재작업 중이라 아직 없다.
GROUPS = {
    1: ("village", "마을", "포구·방앗간·포도원·장터 — 버들항 이웃 마을 넷"),
    2: ("climate-village", "기후 마을", "사막·광산·설원·늪 — 기후가 다른 마을 넷"),
    3: ("dungeon", "던전", "지하 수도교·카타콤·바다 동굴·신전 폐허 — 천장·벽 앞면·바닥 표본으로 짜는 던전 넷"),
    4: ("special", "특수 던전·랜드마크", "곶 등대·난파선 암초·화산 동굴·마법사의 탑"),
    5: ("field", "필드", "해안 절벽길·깊은 숲길·산길 고개·밀밭 로마 가도 — 마을 사이를 잇는 길 넷"),
}
FALLBACK = {"hall": "회관", "board": "판자 더미", "pile": "더미", "bin": "광석 통", "buffer": "선로 끝 막이", "bollard": "계류 말뚝",
            "netrack": "그물 걸이", "ice_boat": "얼음 위 배", "ice_row": "얼음 덩이 줄", "ice_hole": "얼음 구멍", "boss": "감독관 집",
            "barrel": "통", "crates": "상자 더미", "bench": "벤치", "lamp": "등불", "well": "우물", "stall": "노점", "shed": "헛간",
            "hut": "오두막", "bath": "목욕집", "rock": "바위", "fence": "울타리", "stool": "걸상", "sled": "썰매", "snowman": "눈사람",
            "firewood": "장작", "fishcrates": "생선 상자", "pine": "소나무", "bonfire": "모닥불", "mound": "눈 둔덕", "loom": "베틀 집",
            "pierhut": "잔교 오두막", "shrine": "사당", "pilings": "말뚝", "reed": "갈대", "lily": "수련", "ducks": "오리",
            "rowboat": "작은 배", "snag": "고사목", "mangrove": "맹그로브", "lantern": "등롱", "moss_log": "이끼 통나무",
            "fish_rack": "생선 건조대", "fishing_boat": "고깃배", "crab_trap": "게 통발", "reed_stack": "갈대 다발", "temple": "사원",
            "tent": "천막", "camel": "낙타", "cactus": "선인장", "palm": "대추야자", "khan": "대상 숙소", "oven": "흙 화덕", "jars": "항아리",
            "bones": "뼈", "grave": "무덤", "hitch": "말뚝 가로대", "pillar": "돌기둥", "scrub": "덤불", "wall": "흙담", "bales": "짐 꾸러미",
            "rug": "깔개", "datemat": "대추 말리는 자리", "kiln": "가마", "headframe": "갱 탑", "adit": "갱구", "smelt": "제련소",
            "smith": "대장간", "inn": "여관", "chimney": "굴뚝", "cart": "광차", "cart_h": "광차(가로)", "ore": "광석", "rack": "선반",
            "sluice": "선광 홈통", "slagheap": "광재 더미", "slagrock": "광재 돌", "fir": "전나무", "sea_chest": "선원 궤짝", "stool34": "걸상",
            "wizard-tower": "마법사의 탑", "wizard_tower": "마법사의 탑"}
# 문서의 영어 재질 낱말 → 한글 (바닥 cata 같은 이름을 고친다)
WORDS = {"cata": "카타콤", "darkcata": "어두운 카타콤", "bone": "뼈", "plank": "널빤지", "sewer": "하수도", "castle": "성", "cell": "감방",
         "cave": "동굴", "sand": "모래", "wetsand": "젖은 모래", "dirt": "흙", "grass": "풀", "ruin": "폐허", "trav": "트래버틴", "temple": "신전",
         "sew": "하수", "sea": "바다", "tide": "밀물", "cliff": "절벽", "deck": "널 바닥", "road": "길", "rock": "바위", "slagg": "광재 땅",
         "soil": "흙", "tail": "광재 연못", "tcliff": "윗단 절벽", "terr": "계단밭", "yard": "마당"}
BAD_NAMES = {"안쪽용"}

def hangul(s): return bool(re.search(r"[가-힣]", s or ""))

def parse_desc(place, stem):
    p = VAR / place / "parts.md"
    if not p.exists(): return ""
    pat = re.compile(r"(^|[\s/`|(])" + re.escape(stem) + r"\.png")
    for line in p.read_text(encoding="utf-8").splitlines():
        if not pat.search(line): continue
        if line.lstrip().startswith("|"):
            cols = [c.strip() for c in line.strip().strip("|").split("|")]
            idx = next((i for i, c in enumerate(cols) if pat.search(" " + c)), 0)
            for c in cols[idx + 1:] + cols[:idx]:
                c2 = re.sub(r"`[^`]*`", "", c).strip()
                if hangul(c2) and not re.fullmatch(r"[\d×x\s칸()]+", c2): return c2
            return ""
        m = re.split(r"\s—\s", line, maxsplit=1)
        if len(m) < 2: continue
        t = re.sub(r"^\d+x\d+\s*px\s*\([^)]*\)\.?\s*", "", m[1].strip())
        t = re.sub(r"\s/\s*\d+x\d+칸.*$", "", t)
        return t.strip()
    return ""

def short_name(stem, desc):
    d = re.sub(r"\[.*?\]", "", desc or "").strip()
    if hangul(d):
        for sep in (" — ", " (", "(", ":", " / ", " · ", ", "):
            if sep in d and hangul(d.split(sep)[0]): d = d.split(sep)[0]
        d = re.sub(r"\s*\d+프레임.*$", "", d)
        d = re.sub(r"\s*\d+\s*[x×]\s*\d+\s*(칸|px)?$", "", d)
        d = re.sub(r"\s*\d+칸$", "", d)
        d = " ".join(WORDS.get(w, w) for w in d.split())
        d = d.strip(" .-")
        if hangul(d) and d not in BAD_NAMES: return d[:22]
    base = stem
    if re.fullmatch(r"[nsew]\d", stem) or re.fullmatch(r"[nsewd]\d(-\w+)?", stem): return f"집 {stem}"
    for k in sorted(FALLBACK, key=len, reverse=True):
        if base == k or base.startswith(k + "_") or base.startswith(k + "-"): return FALLBACK[k] + (base[len(k):].replace("_", " ").replace("-", " ") if base != k else "")
    if base.startswith("ground-"): return "바닥 " + base[7:]
    return base

def classify(stem):
    s = stem.lower()
    if re.search(r"(^water_|ground-water|ground-hot|ground-bog|ground-tail|lava|ice_hole)", s): return "liquid"
    if re.search(r"(^face_|ground-cliff|ground-tcliff|^ceiling)", s): return "wall"
    if re.search(r"(^ground-|^floor_|^mosaic_|grate_floor|glow_moss_floor|^rug$|^datemat$|^vine_field$)", s): return "floor"
    if re.search(r"(jetty_|footbridge|gangway|bridge|stair)", s): return "walk"
    if re.search(r"(^heath_|^fern_|^wild_|^alpine_|^scree_|^stones_|^toadstools_|^shells$|^ember_|^bones$|^rubble|^seaweed_)", s): return "decal"
    if re.search(r"(^fir_|^fir$|^pine|^palm|^olive_|mangrove|cypress|^snag|tree$|^tree)", s): return "tree"
    return "object"

ROLE = {"decal": "prop", "liquid": "water", "wall": "wall", "floor": "terrain", "walk": "terrain", "tree": "prop", "object": "prop"}
KIND_KO = {"liquid": "물·용암 표본", "wall": "벽 앞면·절벽·천장 표본", "floor": "바닥 표본", "walk": "걸음 구조물(다리·계단·잔교)", "tree": "나무", "object": "물체", "decal": "바닥 소품(걸음)"}

def cell_bytes(im): return hashlib.sha1(im.tobytes()).hexdigest()

def frames_of(stem, desc, im):
    if stem.endswith("-strip") and "4프레임" in desc and im.width % 4 == 0: return 4
    return 1

def pad(im, kind):
    """칸에 맞게 투명으로 채운다. 물체는 왼쪽 아래(버들항 변형 스크립트의 img(X,Y) = 왼쪽 아래 칸), 바닥 표본은 왼쪽 위."""
    w, h = math.ceil(im.width / T), math.ceil(im.height / T)
    out = Image.new("RGBA", (w * T, h * T), (0, 0, 0, 0))
    out.alpha_composite(im, (0, 0) if kind in ("floor", "liquid", "wall") else (0, h * T - im.height))
    return out, w, h

def blocked_rows(kind, w, h):
    if kind == "tree" or w == 1 or h <= 2: return 1
    return max(2, math.ceil(h / 2))

class Registry:
    def __init__(self):
        self.cells = []      # {key, slot, priority, pass, meta} ; None = padding
        self.png = []        # cell images
        self.index = {}
        if REG_JSON.exists():
            data = json.loads(REG_JSON.read_text())
            assert data["base"] == BASE, "등록부의 base 가 시트와 다르다"
            img = Image.open(REG_PNG).convert("RGBA") if REG_PNG.exists() else None
            for i, c in enumerate(data["cells"]):
                self.cells.append(c)
                self.png.append(img.crop((i % 128 * T, i // 128 * T, i % 128 * T + T, i // 128 * T + T)) if img else Image.new("RGBA", (T, T)))
                if c and c.get("key"): self.index[c["key"]] = i
        self.used = set()
    def add_run(self, ims, slot, priority, passable, meta):
        """ims = 같은 자리의 장면들(1 이면 정지). 첫 장면 칸 번호를 돌려준다. 띠는 한 행 안에 둔다."""
        key = "|".join(cell_bytes(i) for i in ims) + f"|{slot}|{priority}|{int(passable)}"
        if key in self.index:
            i = self.index[key]; self.used.update(range(i, i + len(ims)))
            self.cells[i]["meta"] = meta   # 설명·태그는 열쇠가 아니다 — 다시 구우면 새 것으로
            return BASE + i
        n = len(ims)
        while n > 1 and (len(self.cells) % 128) + n > 128:
            self.cells.append(None); self.png.append(Image.new("RGBA", (T, T)))
        i = len(self.cells)
        for k, im in enumerate(ims):
            self.cells.append(dict(key=key if k == 0 else None, slot=slot, priority=priority, passable=passable, meta=meta, frames=n if k == 0 else 0))
            self.png.append(im)
        self.index[key] = i; self.used.update(range(i, i + n))
        return BASE + i
    def save(self):
        n = len(self.cells)
        rows = max(1, math.ceil(n / 128))
        img = Image.new("RGBA", (128 * T, rows * T), (0, 0, 0, 0))
        for i, im in enumerate(self.png): img.alpha_composite(im, (i % 128 * T, i // 128 * T))
        img.save(REG_PNG, optimize=True)
        REG_JSON.write_text(json.dumps(dict(base=BASE, cols=128, note="덧붙이기 전용 — 칸을 지우거나 순서를 바꾸지 말 것 (bake_picks.py)", cells=self.cells), ensure_ascii=False) + "\n")
        return img, rows

def main():
    ap = argparse.ArgumentParser(); ap.add_argument("--dry", action="store_true"); args = ap.parse_args()
    snap = json.loads((VAR / "picks.json").read_text())
    items = [i for i in snap["items"] if i["status"] in ("after", "unpicked-after", "before")]
    parts = [i for i in items if i["kind"] == "part"]
    maps = {i["place"]: i for i in items if i["kind"] == "map"}
    TS = json.loads(TS_PATH.read_text())
    assert TS["count"] >= BASE
    reg = Registry()
    DOORS = json.loads((VAR / "pick-doors.json").read_text()) if (VAR / "pick-doors.json").exists() else {}

    # ---- 조각 → 키트 (같은 그림은 한 키트, 장소는 여럿) ----
    by_hash, order = {}, []
    for it in parts:
        f = VAR / it["rel"]
        im = Image.open(f).convert("RGBA")
        h = hashlib.sha1(im.tobytes() + bytes(str(im.size), "ascii")).hexdigest()
        if h not in by_hash:
            by_hash[h] = dict(img=im, items=[]); order.append(h)
        by_hash[h]["items"].append(it)
    kits, ids, rows_out = [], set(), []
    for h in order:
        g = by_hash[h]; first = g["items"][0]
        place = first["place"]; stem = pathlib.Path(first["rel"]).stem
        desc = parse_desc(place, stem)
        ko = short_name(stem, desc)
        kind = classify(stem)
        im = g["img"]
        nfr = frames_of(stem, desc, im)
        frames = [im.crop((k * im.width // nfr, 0, (k + 1) * im.width // nfr, im.height)) for k in range(nfr)]
        padded = [pad(fr, kind) for fr in frames]
        _, w, hh = padded[0]
        brows = blocked_rows(kind, w, hh) if kind in ("object", "tree") else 0
        places = sorted({x["place"] for x in g["items"]}, key=lambda p: list(PLACES).index(p))
        pko = PLACES[place][0]
        lower, upper = [], []
        for y in range(hh):
            lr, ur = [], []
            for x in range(w):
                cells = [p[0].crop((x * T, y * T, x * T + T, y * T + T)) for p in padded]
                alpha = [c.getchannel("A").getextrema() for c in cells]
                if all(a[1] == 0 for a in alpha): lr.append(-1); ur.append(-1); continue
                opaque = all(a[0] == 255 for a in alpha)
                if kind in ("floor", "liquid", "wall") or (kind == "walk" and opaque):
                    passable = kind in ("floor", "walk")
                    if opaque:
                        slot, pri = "lower", "lower"
                    else:
                        slot, pri = "upper", ("lower" if passable else "upper")
                elif kind in ("walk", "decal"):
                    slot, pri, passable = "upper", "lower", True                 # 사람 아래에 그려지는 걸음 덧그림
                else:
                    passable = y < hh - brows                                    # 위쪽 줄 = ★
                    slot, pri = "upper", "upper"
                mark = "solid" if not passable else ("star" if pri == "upper" else "passable")
                # 바닥 표본 중 길·광장 표본은 road/plaza 태그 — 도시 형태 자(cityForm)와 빈 바닥 지표가 길·광장으로 읽는다
                floor_tag = "road" if re.search(r"ground-(road|path)$", stem) else "plaza" if re.search(r"ground-(plaza|deck)$", stem) else "floor"
                tag = {"liquid": "water", "wall": "wall", "floor": floor_tag, "walk": "bridge" if "bridge" in stem or "jetty" in stem or "gang" in stem else "stair" if "stair" in stem else "walk",
                       "tree": "tree", "object": "prop", "decal": "decal"}[kind]
                meta = dict(label=f"버들항 장소 · {ko}", description=f"버들항 {pko} {ko} ({'땅' if slot == 'lower' else '윗부분'}), {'막힘' if mark == 'solid' else '걸음'}",
                            tags=["버들항", "버들항 장소", tag, *(["floor"] if tag in ("road", "plaza") else [])], defaultLayer=slot, passage=mark, source="bundled-default")
                t = reg.add_run(cells, slot, pri, passable, meta)
                (lr if slot == "lower" else ur).append(t); (ur if slot == "lower" else lr).append(-1)
            lower.append(lr); upper.append(ur)
        slug = re.sub(r"[^a-z0-9]+", "-", stem.lower()).strip("-")
        kid = f"{KIT_PREFIX}{place}-{slug}"
        assert kid not in ids, kid
        ids.add(kid)
        cats = sorted({c for p in places for c in PLACES[p][1]}, key=list(CAT_KO).index)
        where = ", ".join(PLACES[p][0] for p in places)
        if kind in ("object", "tree"):
            rule = (f"땅(풀·포석·바닥) 위에 찍는다. 아래 {brows}줄 막힘, 그 위 {hh - brows}줄은 ★(사람 위에 그려짐). " if hh > brows else f"땅 위에 찍는다. {hh}줄 모두 막힘. ") + \
                   ("나무는 밑동 1칸만 막힌다. 덩이로 심고(일렬 금지) 수관이 맵 밖으로 잘리지 않게. " if kind == "tree" else "문 앞 칸·길·다리 끝을 막지 않는다. 같은 조각을 일렬로 세우지 않는다. ")
        elif kind == "decal":
            rule = "바닥 소품 — 걸음, 사람 아래에 그려진다. 풀·꽃·자갈·뼈는 덩이로 흩는다(일렬·격자 금지). 길 한가운데에는 두지 않는다."
        elif kind == "walk":
            rule = "걸음. 덧그림 칸은 사람 아래에 그려진다. 다리·잔교는 물 위에, 계단은 바닥 위(벽 앞면 계단은 벽 앞면 줄)에 둔다. 양 끝을 길·바닥과 잇는다."
        elif kind == "floor":
            rule = f"바닥 표본 {w}×{hh}. 넓은 면은 이 키트를 이어 찍는다(무늬가 이웃과 이어짐). 걸음."
        elif kind == "liquid":
            rule = f"물·용암 표본 {w}×{hh}. 막힘. 가장자리가 그려진 쪽을 둑·바닥 쪽에 맞춘다." + (f" {nfr}장면 애니메이션 칸." if nfr > 1 else "")
        else:
            rule = f"벽 앞면·절벽·천장 표본 {w}×{hh}. 막힘. 던전은 천장 밑에 벽 앞면 2~3줄을 둔다(ㅁ자 고립 방 금지)."
        kit = dict(id=kid, kind="section", name=f"버들항 {pko} · {ko} {w}×{hh}", width=w, height=hh, tileSize=T,
                   rows=[dict(tiles=lower[y], upperTiles=upper[y]) for y in range(hh)], learnedFrom="db-authored",
                   ai=dict(description=f"{desc or ko} — {where}. 고른 조각(tiledata/beodeul-variants/{first['rel']}, {first['status']}).",
                           placementRules=rule, tags=["버들항", "버들항 장소", *[CAT_KO[c] for c in cats], *[PLACES[p][0] for p in places], KIND_KO[kind]],
                           role=ROLE[kind], repeatability="repeat" if kind in ("floor", "liquid", "wall") else "fixed",
                           layerHome="upper" if kind in ("object", "tree") else ("lower" if all(u < 0 for r in upper for u in r) else "perCell"),
                           themes=[*cats, *[CAT_KO[c] for c in cats]]))
        if kid in DOORS:   # 문 칸 — find_pick_doors.py 가 그림에서 찾은 것(tiledata/beodeul-variants/pick-doors.json)
            d = DOORS[kid]
            kit["parts"] = [dict(id="door", kind="entrance", dx=d["dx"], dy=d["dy"], w=1, h=1, note="문 칸(윗부분 그림, 그림에서 찾음) — 문 칸 자체는 막힘, 그 아래 칸이 문 앞 길")]
        kits.append(kit)
        rows_out.append(dict(kit=kid, ko=ko, kind=kind, w=w, h=hh, brows=brows, frames=nfr, places=places, var=first["var"],
                             status=[x["status"] for x in g["items"]], rel=first["rel"]))

    print("parts", len(parts), "unique images", len(order), "kits", len(kits), "registry cells", len(reg.cells), "used", len(reg.used))
    if args.dry:
        for r in rows_out[:400]: print(r["kit"], r["ko"], r["kind"], f'{r["w"]}x{r["h"]}', r["brows"], r["frames"])
        return

    # ---- 시트·칸 표 ----
    reg_img, reg_rows = reg.save()
    sheet = Image.open(SHEET_PATH).convert("RGBA")
    base_rows = BASE // 128
    out = Image.new("RGBA", (128 * T, (base_rows + reg_rows) * T), (0, 0, 0, 0))
    out.alpha_composite(sheet.crop((0, 0, 128 * T, base_rows * T)), (0, 0))
    out.alpha_composite(reg_img, (0, base_rows * T))
    out.save(SHEET_PATH, optimize=True)
    count = BASE + reg_rows * 128
    empty_meta = dict(label="", description="", source="bundled-default")
    for key in ("passability", "priority", "terrain", "tileMeta"): TS[key] = TS[key][:BASE]
    TS["animationStrips"] = [s for s in TS["animationStrips"] if s["baseTile"] < BASE]
    for i in range(reg_rows * 128):
        c = reg.cells[i] if i < len(reg.cells) else None
        if c:
            TS["passability"].append({d: bool(c["passable"]) for d in ("up", "down", "left", "right")})
            TS["priority"].append(c["priority"]); TS["terrain"].append(0); TS["tileMeta"].append(c["meta"])
            if c.get("frames", 0) > 1: TS["animationStrips"].append(dict(baseTile=BASE + i, frames=c["frames"], fps=4))
        else:
            TS["passability"].append({d: True for d in ("up", "down", "left", "right")})
            TS["priority"].append("lower"); TS["terrain"].append(0); TS["tileMeta"].append(dict(empty_meta))
    TS["count"] = count
    TS["structureKits"] = [k for k in TS["structureKits"] if not k["id"].startswith(KIT_PREFIX)] + kits
    TS_PATH.write_text(json.dumps(TS, ensure_ascii=False, separators=(",", ":")) + "\n")
    SHEET_JSON.write_text(json.dumps(dict(count=count, tilesPerRow=128)) + "\n")

    # ---- 참고문서 ----
    IMG_DIR.mkdir(parents=True, exist_ok=True); MD_DIR.mkdir(parents=True, exist_ok=True)
    def tile(t): return out.crop((t % 128 * T, t // 128 * T, t % 128 * T + T, t // 128 * T + T))
    def kit_img(k, bg=(58, 90, 52, 255)):
        im = Image.new("RGBA", (k["width"] * T, k["height"] * T), bg)
        for y, r in enumerate(k["rows"]):
            for layer in (r["tiles"], r["upperTiles"]):
                for x, t in enumerate(layer):
                    if t >= 0: im.alpha_composite(tile(t), (x * T, y * T))
        return im
    def small(im, side=820):
        s = min(1.0, side / max(im.size))
        if s < 1: im = im.resize((max(1, int(im.width * s)), max(1, int(im.height * s))), Image.LANCZOS)
        return im.convert("RGB").quantize(colors=128, method=Image.Quantize.MEDIANCUT)
    def save(name, im, caption):
        small(im).save(IMG_DIR / f"{name}.png", optimize=True)
        return dict(id=f"bd-pick-img-{name}", name=f"{name}.png", caption=caption, dataUrl=f"/assets/beodeul-city/references/picks/{name}.png")
    kit_by_id = {k["id"]: k for k in kits}
    def roles(k):
        rs = []
        for r in k["rows"]:
            s = ""
            for lo, u in zip(r["tiles"], r["upperTiles"]):
                t = u if u >= 0 else lo
                if t < 0: s += "."
                elif u >= 0 and TS["passability"][u]["up"]: s += "C" if TS["priority"][u] == "upper" else "W"
                elif u >= 0: s += "S"
                elif TS["passability"][lo]["up"]: s += "F"
                else: s += "X"
            rs.append(s)
        return rs
    def sheet_of(rows):
        """조각 판 — 키트를 엔진 칸 그대로 그려 번호를 붙인다(번호 → 문서 표)."""
        ims = [kit_img(kit_by_id[r["kit"]]) for r in rows]
        width = 820; x = y = 0; lh = 0; pos = []
        for im in ims:
            if x + im.width + 8 > width: x = 0; y += lh + 18; lh = 0
            pos.append((x, y)); x += im.width + 10; lh = max(lh, im.height)
        board = Image.new("RGBA", (width, y + lh + 18), (24, 26, 30, 255))
        d = ImageDraw.Draw(board)
        for n, (im, (px, py)) in enumerate(zip(ims, pos), 1):
            board.alpha_composite(im, (px, py + 12)); d.text((px, py), str(n), fill=(255, 230, 120, 255))
        return board
    HEAD = (f"tilesetId `beodeul_city` · 그림 `public/assets/beodeul-city/beodeul-city-chipset.png`(텍스처 `tex_beodeul_city`, {count}칸, 16px 칸, "
            f"한 줄 128칸 — 번호 n 의 칸은 행 n÷128, 열 n%128). 0~{BASE - 1} 은 버들항 도시 칸, {BASE}~{count - 1} 은 고른 장소 조각 칸(이 용도). 다른 칩셋 번호를 섞지 않는다.")
    LEGEND = "역할 글자: `S` 윗부분 막힘(사람과 y 정렬) · `C` 윗부분 걸음 ★(사람 위에 그려짐) · `W` 윗부분 걸음(사람 아래, 다리·계단·바닥 얼룩) · `F` 땅 걸음 · `X` 땅 막힘 · `.` 빈 칸(-1, 찍는 자리의 그 층을 건드리지 않음)."
    # 오류 그림(잘못된 레이어): 윗부분 물체를 땅 칸에 넣으면 투명 부분이 비어 보인다
    sample = next(k for k in kits if k["ai"]["layerHome"] == "upper" and k["width"] >= 3 and k["height"] >= 3)
    ok = kit_img(sample)
    bad = Image.new("RGBA", ok.size, (0, 0, 0, 255))
    for y, r in enumerate(sample["rows"]):
        for x, t in enumerate(r["upperTiles"]):
            if t >= 0: bad.alpha_composite(tile(t), (x * T, y * T))
    pair = Image.new("RGBA", (ok.width * 2 + 16, ok.height), (24, 26, 30, 255)); pair.alpha_composite(bad, (0, 0)); pair.alpha_composite(ok, (ok.width + 16, 0))
    pair = pair.resize((pair.width * 3, pair.height * 3), Image.NEAREST)
    err_img = save("err-layer", pair, f"왼쪽 오류 · 오른쪽 정답. `{sample['id']}` 의 윗부분 칸을 아래층(땅)에 칠했다 → 투명 부분 밑에 땅이 없어 검게 비었다(검출: lint `wrong-layer`/눈 검사). 키트는 stamp_object 로 찍으면 층이 저절로 맞는다.")

    old = json.loads(REF_PATH.read_text())
    old = [c for c in old if not c["id"].startswith(CAT_PREFIX)]
    new_cats = []
    for var, (gid, gko, gdesc) in GROUPS.items():
        places = [p for p in PLACES if any(r["var"] == var and p in r["places"] for r in rows_out) or (p in maps and maps[p]["var"] == var)]
        docs, images = [], []
        guide = f"""# 버들항 장소 조각 · {gko} — 먼저 읽는다

{HEAD}

사용자가 버들항 변형 20곳에서 **고른 조각만** 이 용도에 있다(`tiledata/beodeul-variants/MANIFEST.md`: AFTER·BEFORE·안 고름=AFTER, 「둘 다 별로」(다시 그리는 중)는 뺐다).
조각은 모두 키트 `kit:beodeul_city/bd-pick-<장소>-<이름>` 이다. 칸을 하나씩 칠하지 말고 `stamp_object({{objectId:'kit:beodeul_city/<키트 id>', x, y}})` 로 찍는다(x,y = 키트 왼쪽 위 칸).
장소마다 문서 하나: 용도·구역(원래 계획), 조각 표(번호 = 조각 판 그림의 번호), 각 키트의 역할 글자와 아래층/윗층 전체 배열.

## 작업 순서 (이 순서를 바꾸지 않는다)
1. 맵 크기를 목적에 맞게 정한다(마을 48×40~80×64, 던전 방 묶음 40×30~64×48, 필드 64×48~96×64). 남는 바닥은 메우지 말고 맵을 줄인다.
2. 땅: 바닥 표본 키트(`바닥 표본`)를 면에 이어 찍거나 버들항 땅 재료(`버들항 풀밭`·`길 포석` 오토타일·`광장 판석`)를 `fill_region` 으로 칠한다.
3. 물·용암·절벽·벽: 물·용암 표본(막힘), 벽 앞면·절벽·천장 표본(막힘). 던전은 천장 밑에 벽 앞면 2~3줄 — 천장 아래 바로 바닥이 오면 안 된다.
4. 길: 입구 → 앵커(랜드마크) → 문 앞을 잇는다. 다리·계단·잔교 키트(`걸음 구조물`)는 길이 끊기는 곳에만, 양 끝을 길과 잇는다.
5. 건물·랜드마크: 큰 키트부터. 문 칸 아래 칸이 길이어야 한다(문 칸은 막힘). 이웃 건물과 1칸 띄우거나 벽을 맞댄다.
6. 소품·나무: 목적 있는 덩이로(시장 옆 좌판, 부두 옆 통발…). 같은 조각을 일렬로 세우지 않는다. 한 화면(20×15) 빈 바닥 ≤40%.
7. `check_reachability` 로 입구 → 모든 문 앞·앵커 도달을 확인한다.

## 층·통행 규칙 (키트가 이미 지킨다 — 손으로 칠할 때만 신경 쓴다)
{LEGEND}
- 물체·나무 키트는 아래층이 모두 -1 이다. 찍는 자리의 땅은 그대로 남는다. 물체 칸을 **아래층에 칠하면 투명 부분이 검게 빈다**(오류 그림 `err-layer`).
- 물체는 아래 줄(키트마다 「막힘 줄」 수)이 막히고 그 위는 ★ — 사람이 뒤로 지나가면 지붕·수관에 가린다.
- 바닥 표본이 불투명하면 아래층, 가장자리에 투명이 있으면 그 칸만 윗부분(걸음, 사람 아래)이다.
- 애니메이션: 용암 표본은 칸마다 4장면 띠(`animationStrips`, fps 4)다. 키트에는 첫 장면 번호만 있다.

## 원래 맵 그림에 대해
그림 `<장소>-map` 은 버들항 변형 작업의 **Python 렌더**(고른 판)이지 이 시트로 엔진이 그린 맵이 아니다. 목표 분위기·구역 배치를 보는 데 쓴다 — 좌표를 베끼지 않는다.
그림 `<장소>-parts` 는 이 시트의 칸으로 엔진과 같은 방식(아래층 → 윗층)으로 키트를 그린 것이다(풀색 바탕 = 빈 칸).

## 검사 범위
자동 검사(`check_reachability`·`check_city_form`)는 통행·도달만 본다. 미적 품질·반복·이벤트 동작은 이 검사로 주장하지 않는다.
없는 소재: 문 이벤트·실내 맵은 키트에 없다(문 칸만 그림). 실내는 실내 칩셋 경로를 쓴다.
"""
        docs.append(dict(id=f"bd-pick-doc-{gid}-guide", name=f"{gko} 장소 조각 · 작업 순서와 층 규칙", markdown=guide))
        if var == 1: images.append(err_img)
        for p in places:
            prow = [r for r in rows_out if p in r["places"]]
            pko = PLACES[p][0]
            if p in maps:
                images.append(save(f"{p}-map", Image.open(VAR / maps[p]["rel"]).convert("RGBA"),
                                   f"{pko} — 고른 맵 렌더({maps[p]['status']}, Python 데모 렌더 · 엔진 출력 아님). 목표 분위기·구역 배치. 긴 변 820px 로 줄임."))
            if prow:
                images.append(save(f"{p}-parts", sheet_of(prow), f"{pko} 고른 조각 {len(prow)}종 — 이 시트의 칸으로 그린 키트(번호 = 문서 표 번호, 풀색 = 빈 칸)."))
            plan = (VAR / p / "plan.md").read_text(encoding="utf-8") if (VAR / p / "plan.md").exists() else ""
            plan_head = "\n".join(plan.splitlines()[:22])[:1600]
            table = "\n".join(f"| {n} | `{r['kit']}` | {r['ko']} | {r['w']}×{r['h']} | {KIND_KO[r['kind']]} | {r['brows'] or '-'} | {'/'.join(sorted(set(r['status'])))} |"
                              for n, r in enumerate(prow, 1))
            arrays = []
            for n, r in enumerate(prow, 1):
                k = kit_by_id[r["kit"]]
                lo = "\n".join(" ".join(str(t) for t in row["tiles"]) for row in k["rows"])
                up = "\n".join(" ".join(str(t) for t in row["upperTiles"]) for row in k["rows"])
                arrays.append(f"### {n}. `{k['id']}` {r['ko']} {k['width']}×{k['height']}\n역할 `{' / '.join(roles(k))}`\n```\n아래층\n{lo}\n윗층\n{up}\n```")
            md = f"""# {pko} — 고른 조각 {len(prow)}종

{HEAD}

## 원래 계획 (tiledata/beodeul-variants/{p}/plan.md 앞부분 — 목적·구역을 보고 새로 배치한다)
{plan_head}

## 조각 표
번호 = 그림 `{p}-parts` 의 번호. 판정: after = 사용자가 AFTER 를 고름 · unpicked-after = 안 고름(AFTER) · before = BEFORE 사본 복원.
| # | 키트 | 이름 | 칸 | 종류 | 막힘 줄 | 판정 |
|---|---|---|---|---|---|---|
{table}

## 칸 배열 (원점 = 키트 왼쪽 위, -1 = 그 층을 건드리지 않음)
{LEGEND}

""" + "\n\n".join(arrays) + "\n"
            docs.append(dict(id=f"bd-pick-doc-{p}", name=f"{pko} 조각 {len(prow)}종", markdown=md))
        new_cats.append(dict(id=f"{CAT_PREFIX}{gid}", name=f"버들항 장소 · {gko}(고른 조각)", description=f"{gdesc}. 사용자가 고른 조각 키트 bd-pick-*, 장소별 맵 렌더·조각 판·칸 배열, 작업 순서.",
                             documents=docs, images=images))
    for c in new_cats:
        for d_ in c["documents"]: (MD_DIR / f"{d_['id']}.md").write_text(d_["markdown"].rstrip() + "\n", encoding="utf-8")
    REF_PATH.write_text(json.dumps(old + new_cats, ensure_ascii=False, indent=0) + "\n")
    print(json.dumps(dict(count=count, newCells=[BASE, count - 1], registry=len(reg.cells), kits=len(kits),
                          categories=len(new_cats), documents=sum(len(c["documents"]) for c in new_cats), images=sum(len(c["images"]) for c in new_cats),
                          docChars=sum(len(d_["markdown"]) for c in new_cats for d_ in c["documents"]))))

if __name__ == "__main__":
    main()
