#!/usr/bin/env python3
"""버들항 길목 조각(bd-rt-*)을 공용 버들항 시트의 제 토막(56,704~60,799, 고정 4,096칸)에 굽는다.

  python3 scripts/content/beodeul-routes/bake.py --dry     # 관문 상태와 칸 계획만
  python3 scripts/content/beodeul-routes/bake.py           # 굽는다
  python3 scripts/content/beodeul-routes/bake.py --check   # 다시 구워 지금 파일과 같은지만
  python3 scripts/content/beodeul-routes/bake.py --dev     # 관문 없이(커밋하지 않는다)
  python3 scripts/content/beodeul-routes/bake.py --manifest  # 면제 입력(waive-manifest.json)만 다시 쓴다

그림 정본: tiledata/beodeul-routes/pieces/<id>.png — Claude Fable 5.2 medium 한 방(줄 문자열 → 잠긴 색 줄 ramps.json). 정의는 이 파일의 PIECES.
길목 갈래 둘(산길·등산로 mt-* · 정령·요정 숲 sp-*)의 주인공 볼거리·기물·바닥 판이다. 이 스크립트는 조각을 16px 칸으로 자르고 조립만 한다(모양은 그대로):
  · 서 있는 기물(object): 아래 맞춤 킷. 막힌 칸은 PIECES 의 solid(줄·칸), 나머지 그림 칸은 ★(지나가며 가려짐).
  · 바닥 그림(decal): 밟고 지나가는 덧그림 킷.
  · 다리(deck): 두 칸 폭 남북 다리의 [북쪽 끝 · 가운데 · 남쪽 끝] 줄 — 걷는 바닥 칸.
  · 정령 숲 바닥 판 둘(64px, 16칸씩) · 길 판(64px): 길 칸은 «이웃 길» 비트 16가지 × 위상 16 — 길 판을 굽이진 테 안에만 두고 밖은 바닥 판 A(같은 위상)를 그대로 둔 불투명 칸.
  · 정령 숲 수관 판(64px): 숲 칸은 «이웃 숲» 비트 16가지 × 위상 16 — 수관 판을 굽이진 테 안에만 둔 투명 덧칸(막힘). 남쪽 끝은 아래 넉 줄을 두 단 어둡게(밑동 그늘).
    테 모양·어둡게 내리기는 코드다(그린 화소를 옮기거나 새로 찍지 않는다 — 가리고, 같은 색 줄에서 단을 내릴 뿐).

3/4 관문(hard rule): 조각 그림마다 object-gate 출구 `require_all(context="bundle")` — 하나라도 막히면 아무것도 쓰지 않는다.
이 그림들은 **3/4 관문 미통과 — 오너 면제 묶음**(WAIVER, harness-data/object-gate/waivers)으로 출구를 지난다. 면제는 그림 화소 해시에 묶여 있다. 면제는 통과가 아니다.

칸 번호: 토막의 첫 칸은 56,704 로 못박혀 있다(실내 48,512~52,607 · 던전 52,608~56,703 뒤). 내 칸 [56,704, 60,800) 만 제자리에서 다시 쓰고 앞 칸과 킷은 건드리지 않는다.
시트가 56,704 보다 짧으면 빈 줄로 채운다(앞 토막의 굽기가 제 칸만 제자리에서 쓴다). 토막은 늘 4,096칸으로 채운다(빈 칸 포함).
쓰는 것: public/assets/beodeul-city/beodeul-city-chipset.png · src/assets/beodeulCityTileset.json · src/assets/beodeulCitySheet.json ·
tiledata/beodeul-routes/catalog.json · src/assets/beodeulRouteSkins.json(시공기 routeThemeBuild.ts 가 읽는 표).
"""
import argparse, hashlib, json, pathlib, sys
import numpy as np
from PIL import Image

HERE = pathlib.Path(__file__).resolve().parent
ROOT = HERE.parents[2]
sys.path.insert(0, str(ROOT / "src/harnesses/_core"))
SHEET_PATH = ROOT / "public/assets/beodeul-city/beodeul-city-chipset.png"
TS_PATH = ROOT / "src/assets/beodeulCityTileset.json"
SHEET_JSON = ROOT / "src/assets/beodeulCitySheet.json"
STORE = ROOT / "tiledata/beodeul-routes"
CATALOG = STORE / "catalog.json"
MANIFEST = STORE / "waive-manifest.json"
TABLE = ROOT / "src/assets/beodeulRouteSkins.json"
T, COLS, BASE, BLOCK = 16, 128, 56704, 4096
END = BASE + BLOCK
PREFIX = "bd-rt-"
LABEL = "버들항 길목"
WAIVER = "fable-routes-beodeul-2026-11-15"
OPEN = {k: True for k in ("up", "down", "left", "right")}
SHUT = {k: False for k in ("up", "down", "left", "right")}
GATE_NOTE = "3/4 관문 미통과 — 오너 면제 그림."

ALL = "all"
def P(id, ko, en, cls, w, h, kind, solid=None, words=()):
    return dict(id=id, ko=ko, en=en, cls=cls, w=w, h=h, kind=kind, solid=solid, words=list(words))
rows = lambda *ys: [("row", y) for y in ys]
cells = lambda *xy: [("cell", x, y) for x, y in xy]
# solid: 막힌 칸 — ("row", y) 그 줄의 그림 있는 칸 전부 · ("cell", x, y). None = 맨 아랫줄.
PIECES = [
    # ── 산길·등산로 ──
    P("mt-bridge", "구름다리(남북, 두 칸 폭)", "rope suspension bridge, north-south", "deck", 2, 3, "terrain"),
    P("mt-lodge", "산장", "mountain lodge", "object", 6, 6, "structure", rows(1, 2, 3, 4, 5), ["산장", "lodge"]),
    P("mt-watchtower", "산불 감시대", "fire-watch tower", "object", 3, 6, "structure", rows(4, 5), ["감시대", "망루", "watchtower"]),
    P("mt-shelter", "길손 쉼터", "trail rest shelter", "object", 3, 3, "structure", rows(1, 2), ["쉼터", "shelter"]),
    P("mt-rest-rock", "너럭 쉼터 바위", "flat resting rock", "object", 3, 2, "other", None, ["바위", "쉼터 바위"]),
    P("mt-rail", "밧줄 난간", "rope guard rail", "object", 3, 1, "other", rows(0), ["난간", "rail"]),
    P("mt-summit-stone", "봉우리 표지석", "summit marker stone", "object", 2, 3, "other", None, ["표지석", "정상석"]),
    P("mt-log-pile", "벌목 통나무 더미", "stack of felled logs", "object", 3, 2, "other", None, ["통나무", "벌목"]),
    P("mt-sawhorse", "톱질 받침", "sawbuck with a log", "object", 2, 2, "other", None, ["톱질"]),
    P("mt-spring-trough", "통나무 물받이 샘터", "spring with a log trough", "object", 3, 2, "other", None, ["샘터", "샘", "spring"]),
    P("mt-pine-a", "늙은 소나무(기운 것)", "old leaning pine", "object", 3, 5, "organic", cells((1, 4)), ["소나무", "pine"]),
    P("mt-pine-b", "늙은 소나무(곧은 것)", "old forked pine", "object", 3, 5, "organic", cells((1, 4)), ["소나무", "pine"]),
    P("mt-snow-rock", "눈 덮인 바위", "snow-capped boulder", "object", 2, 2, "other", None, ["눈", "바위"]),
    P("mt-snow-patch", "남은 눈 자국", "patch of old snow", "decal", 2, 2, "flat", None, ["눈"]),
    P("mt-herb-a", "산약초(붉은 열매)", "mountain herb with berries", "object", 1, 1, "organic", None, ["약초"]),
    P("mt-herb-b", "산약초(종꽃)", "mountain herb with bell flowers", "object", 1, 1, "organic", None, ["약초"]),
    P("mt-herb-basket", "약초 바구니와 낫", "herb basket with a sickle", "object", 1, 1, "other", None, ["약초", "바구니"]),
    P("mt-leaves", "낙엽 더미", "drift of fallen leaves", "decal", 2, 2, "flat", None, ["낙엽"]),
    P("mt-rockfall", "낙석 더미", "rockfall heap", "object", 3, 2, "debris", None, ["낙석", "바위"]),
    P("mt-trail-gate", "등산로 어귀 통나무 문", "trailhead log gate", "object", 3, 3, "structure", cells((0, 1), (0, 2), (2, 1), (2, 2)), ["등산로 입구", "문"]),
    P("mt-tent", "길가 천막과 불 자리", "trail tent with a fire ring", "object", 3, 2, "other", None, ["천막", "야영"]),
    # ── 정령·요정 숲 ──
    P("sp-ground-a", "정령 숲 이끼 바닥 A", "spirit forest moss floor A", "ground", 4, 4, "terrain"),
    P("sp-ground-b", "정령 숲 이끼 바닥 B(고사리·토끼풀)", "spirit forest moss floor B", "ground", 4, 4, "terrain"),
    P("sp-path", "정령 숲 오솔길", "spirit forest path", "path", 4, 4, "terrain"),
    P("sp-canopy", "정령 숲 수관(숲 벽)", "spirit forest canopy", "canopy", 4, 4, "terrain"),
    P("sp-bridge", "덩굴 다리(남북, 두 칸 폭)", "living vine bridge, north-south", "deck", 2, 3, "terrain"),
    P("sp-tree-gate", "두 고목이 맞닿은 나무 문", "great tree gate", "object", 6, 6, "organic", [("cell", x, y) for x in (0, 1, 4, 5) for y in (2, 3, 4, 5)], ["나무 문", "gate"]),
    P("sp-root-gate", "천년목의 뿌리 문", "giant root gate", "object", 5, 4, "organic", [("cell", x, y) for x in (0, 1, 3, 4) for y in (1, 2, 3)], ["뿌리 문", "gate"]),
    P("sp-mist-stones", "안개 장막의 돌문", "mist gate of standing stones", "object", 5, 4, "structure", [("cell", x, y) for x in (0, 1, 3, 4) for y in (1, 2, 3)], ["돌문", "안개", "gate"]),
    P("sp-moon-spring", "달빛 샘", "moonlight spring", "object", 5, 4, "other", rows(1, 2, 3), ["달빛 샘", "샘", "spring"]),
    P("sp-fairy-ring", "요정 고리", "fairy ring", "decal", 4, 4, "flat", None, ["요정 고리", "버섯 고리"]),
    P("sp-shroom-s", "빛 버섯 무리", "small glowing mushrooms", "object", 1, 1, "organic", None, ["버섯"]),
    P("sp-shroom-m", "키 큰 빛 버섯", "tall glowing mushroom", "object", 1, 2, "organic", None, ["버섯"]),
    P("sp-shroom-l", "큰 빛 버섯", "giant glowing mushroom", "object", 2, 3, "organic", None, ["버섯"]),
    P("sp-stone-a", "정령석(소용돌이)", "spirit stone with a spiral", "object", 1, 2, "other", None, ["정령석"]),
    P("sp-stone-b", "정령석(고리)", "spirit stone with rings", "object", 1, 2, "other", None, ["정령석"]),
    P("sp-guardian", "숲의 문지기 석상", "forest guardian statue", "object", 2, 3, "figure", None, ["석상", "문지기"]),
    P("sp-tree-a", "정령 나무(넓은 수관)", "spirit tree, broad", "object", 4, 5, "organic", cells((1, 4), (2, 4)), ["나무"]),
    P("sp-tree-b", "정령 나무(꽃 핀 것)", "spirit tree in bloom", "object", 4, 5, "organic", cells((1, 4), (2, 4)), ["나무", "꽃"]),
    P("sp-tree-c", "어린 정령 나무", "young spirit tree", "object", 3, 4, "organic", cells((1, 3)), ["나무"]),
    P("sp-crystal-tree", "수정 나무", "crystal tree", "object", 3, 4, "organic", cells((1, 3)), ["수정", "나무"]),
    P("sp-crystal", "수정 무리", "crystal cluster", "object", 1, 2, "other", None, ["수정"]),
    P("sp-wisp", "도깨비불", "will-o'-the-wisp", "object", 1, 2, "other", None, ["도깨비불", "혼불"]),
    P("sp-petals", "떨어진 꽃잎", "drift of fallen petals", "decal", 2, 2, "flat", None, ["꽃잎"]),
    P("sp-sleeper", "잠든 정령의 돌 얼굴", "sleeping spirit stone face", "object", 3, 3, "figure", rows(1, 2), ["석상", "정령"]),
    P("sp-star-shard", "떨어진 별 조각", "fallen star shard", "object", 3, 3, "other", rows(1, 2), ["별"]),
    P("sp-market", "버섯 지붕 요정 노점", "fairy market stall", "object", 3, 3, "structure", rows(1, 2), ["요정 시장", "노점"]),
    P("sp-lantern", "요정 등불", "fairy lantern", "object", 1, 2, "other", None, ["등불"]),
    P("sp-stag", "은빛 사슴상", "silver stag statue", "object", 3, 3, "figure", None, ["사슴", "석상"]),
    P("sp-world-root", "세계수의 밑동", "foot of the world tree", "object", 6, 5, "organic", rows(1, 2, 3, 4), ["세계수"]),
    P("sp-flower", "정령 꽃", "glowing spirit flowers", "object", 1, 1, "organic", None, ["꽃"]),
]


def hx(c): return tuple(int(c[i:i + 2], 16) for i in (1, 3, 5))


def noise(x, y, seed):
    h = (x * 374761393 + y * 668265263 + seed * 2246822519) & 0xFFFFFFFF
    h = ((h ^ (h >> 13)) * 1274126177) & 0xFFFFFFFF
    return ((h ^ (h >> 16)) & 0xFFFF) / 65536.0


def edge_mask(mask, px, py, seed, lo=2, hi=4):
    """이웃 비트(북 1 · 동 2 · 남 4 · 서 8 이 같은 것)에 맞는 16×16 안쪽 모양 — 이웃 없는 변은 lo~hi 화소 들여 굽이지고(네 화소마다 바뀜), 이웃 없는 두 변이 만나는 모서리는 둥글다.
    굽이는 판 안의 절대 화소(px, py)로 읽어 같은 변을 잇는 옆 칸과 이어진다."""
    n, e, s, w = bool(mask & 1), bool(mask & 2), bool(mask & 4), bool(mask & 8)
    inset = lambda along, line: lo + int(noise(along // 4, line, seed) * (hi - lo + 1))
    m = np.zeros((T, T), bool); r = 4
    for y in range(T):
        for x in range(T):
            ax, ay = px + x, py + y
            top = 0 if n else inset(ax, 1000 + py // T)
            bot = T - 1 - (0 if s else inset(ax, 2000 + py // T))
            left = 0 if w else inset(ay, 3000 + px // T)
            right = T - 1 - (0 if e else inset(ay, 4000 + px // T))
            if not (top <= y <= bot and left <= x <= right): continue
            ok = True
            for open_, cx, cy, sx, sy in ((not n and not w, left + r, top + r, -1, -1), (not n and not e, right - r, top + r, 1, -1), (not s and not w, left + r, bot - r, -1, 1), (not s and not e, right - r, bot - r, 1, 1)):
                if open_ and (x - cx) * sx > 0 and (y - cy) * sy > 0 and (x - cx) ** 2 + (y - cy) ** 2 > r * r: ok = False
            m[y, x] = ok
    return m


class Bake:
    def __init__(self, ramps):
        self.ramps = ramps
        self.tone = {}
        for r, cs in ramps.items():
            for i, c in enumerate(cs): self.tone.setdefault(hx(c), (r, i))
        self.cells, self.kits, self.seen = [], [], {}

    def piece(self, pid):
        return np.array(Image.open(STORE / "pieces" / f"{pid}.png").convert("RGBA"))

    def shift(self, a, delta):
        """화소를 제 색 줄에서 delta 단 옮긴다(줄 끝에서 멈춤)."""
        a = a.copy(); flat = a.reshape(-1, 4)
        for i in range(len(flat)):
            if not flat[i, 3]: continue
            k = self.tone.get((int(flat[i, 0]), int(flat[i, 1]), int(flat[i, 2])))
            if k: cs = self.ramps[k[0]]; flat[i, :3] = hx(cs[max(0, min(len(cs) - 1, k[1] + delta))])
        return a

    def emit(self, px, kind, label, theme, words=()):
        """칸 하나를 토막에 더하고 번호를 돌려준다. kind: floor(걷는 바닥) · solid(막힌 기물 칸) · star(지나가며 가려지는 기물 칸) · decal(밟는 덧그림) · wall(막힌 덧칸 — 수관)."""
        assert px.shape == (T, T, 4), px.shape
        key = (kind, px.tobytes())
        if key in self.seen: return self.seen[key]
        n = self.seen[key] = BASE + len(self.cells)
        if n >= END: sys.exit(f"토막 {BLOCK}칸을 넘는다")
        tags = {"floor": ["floor", "바닥"], "solid": ["prop"], "star": ["prop"], "decal": ["prop", "바닥 그림"], "wall": ["숲", "수관", "덧그림"]}[kind]
        walk = kind in ("floor", "star", "decal")
        self.cells.append((px, dict(pass_=OPEN if walk else SHUT, priority="upper" if kind in ("star", "wall") else "lower", label=f"{LABEL} · {label}", description=f"{label}. {GATE_NOTE}",
                                    tags=["버들항", "길목", "route", f"route:{theme}", *tags, *words], layer="lower" if kind == "floor" else "upper",
                                    passage={"floor": "passable", "decal": "passable", "star": "star"}.get(kind, "solid"))))
        return n


def object_kit(B, p):
    a = B.piece(p["id"]); w, h = p["w"], p["h"]; theme = "mountain" if p["id"].startswith("mt-") else "spirit"
    canvas = np.zeros((h * T, w * T, 4), np.uint8); ph, pw = a.shape[:2]
    assert ph <= h * T and pw <= w * T, (p["id"], a.shape)
    ox = (w * T - pw) // 2; oy = h * T - ph
    canvas[oy:oy + ph, ox:ox + pw] = a
    decal = p["cls"] == "decal"
    solid = set()
    for rule in (p["solid"] if p["solid"] is not None else [("row", h - 1)]):
        if rule[0] == "row": solid |= {(x, rule[1]) for x in range(w)}
        else: solid.add((rule[1], rule[2]))
    out = []
    for y in range(h):
        row = []
        for x in range(w):
            c = canvas[y * T:(y + 1) * T, x * T:(x + 1) * T]
            if not (c[:, :, 3] > 0).any(): row.append(-1); continue
            kind = "decal" if decal else "solid" if (x, y) in solid else "star"
            row.append(B.emit(c, kind, p["ko"] + (f" ({x},{y})" if w * h > 1 else ""), theme, p["words"]))
        out.append(row)
    blocked = sorted((x, y) for (x, y) in solid if out[y][x] >= 0) if not decal else []
    how = "바닥 그림 — 밟고 지나간다" if decal else "서 있는 기물 — 막힌 칸 " + " ".join(f"({x},{y})" for x, y in blocked)
    B.kits.append(dict(id=PREFIX + p["id"], name=f"{LABEL} · {p['ko']} {w}×{h}", kind="section", width=w, height=h, tileSize=T, learnedFrom="pack-preset",
                       rows=[dict(tiles=[-1] * w, upperTiles=r) for r in out],
                       ai=dict(role="prop", repeatability="fixed", layerHome="upper", tags=["버들항", "길목", "기물", "주제 소품", f"route:{theme}", "필드", *p["words"]],
                               themes=["field", "forest", "mountain", "필드", "숲", "산"] if theme == "mountain" else ["field", "forest", "필드", "숲", "정령 숲"],
                               description=f"{p['ko']} ({p['en']}) — {how}. {GATE_NOTE}",
                               placementRules="길목 시공기(author_wild_route theme)가 놓는다 — 따로 찍을 때는 풀·흙·이끼 같은 걷는 바닥 위에, 길 한가운데를 막지 않게.")))
    return PREFIX + p["id"], out


def main():
    ap = argparse.ArgumentParser()
    for flag in ("--dry", "--check", "--dev", "--manifest"): ap.add_argument(flag, action="store_true")
    a = ap.parse_args()
    ramps = json.loads((STORE / "ramps.json").read_text(encoding="utf-8"))["ramps"]
    if a.manifest:
        MANIFEST.write_text(json.dumps(dict(items=[dict(png=f"tiledata/beodeul-routes/pieces/{p['id']}.png", kind=p["kind"], label=f"beodeul_routes/{p['id']}", chipset="beodeul_city") for p in PIECES]), ensure_ascii=False, indent=0) + "\n", encoding="utf-8")
        print(f"면제 입력 {len(PIECES)}장 → {MANIFEST.relative_to(ROOT)}"); return
    B = Bake(ramps)
    imgs = [(Image.open(STORE / "pieces" / f"{p['id']}.png").convert("RGBA"), p["kind"], f"beodeul_routes/{p['id']}") for p in PIECES]
    if a.dev:
        got = [hashlib.sha256(im.tobytes()).hexdigest() for im, _, _ in imgs]; gate = "DEV"
    else:
        from object_gate import require_all
        got = require_all(imgs, context="bundle"); gate = f"3/4 gate not passed — owner waiver {WAIVER}"
    print(f"관문(bundle 출구): {len(got)}/{len(imgs)} — {'DEV(관문 없음)' if a.dev else GATE_NOTE + ' 묶음 ' + WAIVER}")

    table = dict(_doc="버들항 길목 표 — scripts/content/beodeul-routes/bake.py 가 굽는다(손으로 고치지 않는다). spirit.ground[판][위상 16 = (y%4)*4 + x%4] · spirit.path[이웃 길 비트 북1 동2 남4 서8][위상 16] · "
                      "spirit.canopy[이웃 숲 비트][위상 16] · bridge.rope|vine[북쪽 끝 · 가운데 · 남쪽 끝][서 · 동].",
                 version=1, tilesetId="beodeul_city", kitPrefix=PREFIX, base=BASE, end=END, gate=gate, spirit=dict(ground=[], path=[], canopy=[]), bridge={})
    objs = []
    by = {p["id"]: p for p in PIECES}
    grid = lambda px, kind, label, theme: [B.emit(px[y * T:(y + 1) * T, x * T:(x + 1) * T], kind, f"{label} ({x},{y})", theme) for y in range(4) for x in range(4)]
    ga = B.piece("sp-ground-a")
    table["spirit"]["ground"] = [grid(B.piece(pid), "floor", by[pid]["ko"], "spirit") for pid in ("sp-ground-a", "sp-ground-b")]
    path = B.piece("sp-path"); rim = hx(ramps["glade"][1])
    for mask in range(16):
        row = []
        for ph in range(16):
            px_, py_ = (ph % 4) * T, (ph // 4) * T
            m = edge_mask(mask, px_, py_, 11)
            cell = ga[py_:py_ + T, px_:px_ + T].copy(); src = path[py_:py_ + T, px_:px_ + T]
            cell[m] = src[m]
            # 길 테: 길 안쪽 화소 가운데 바깥(이끼)과 맞닿은 것 아래·오른쪽에 그늘 한 화소(이끼 색 줄의 어두운 단)
            for y in range(T):
                for x in range(T):
                    if not m[y, x] and ((y > 0 and m[y - 1, x]) or (x > 0 and m[y, x - 1])): cell[y, x, :3] = rim
            row.append(B.emit(cell, "floor", f"정령 숲 오솔길 {mask}·{ph}", "spirit"))
        table["spirit"]["path"].append(row)
    can = B.piece("sp-canopy")
    for mask in range(16):
        row = []
        for ph in range(16):
            px_, py_ = (ph % 4) * T, (ph // 4) * T
            m = edge_mask(mask, px_, py_, 29, 1, 4)
            src = can[py_:py_ + T, px_:px_ + T].copy()
            if not mask & 4: src[T - 5:] = B.shift(src[T - 5:], -2)   # 남쪽 끝: 밑동 그늘
            cell = np.zeros((T, T, 4), np.uint8); cell[m] = src[m]
            row.append(B.emit(cell, "wall", f"정령 숲 수관 {mask}·{ph}", "spirit"))
        table["spirit"]["canopy"].append(row)
    for name, pid in (("rope", "mt-bridge"), ("vine", "sp-bridge")):
        d = B.piece(pid)
        table["bridge"][name] = [[B.emit(d[r * T:(r + 1) * T, c * T:(c + 1) * T], "floor", f"{by[pid]['ko']} ({c},{r})", "mountain" if name == "rope" else "spirit") for c in range(2)] for r in range(3)]
    for p in PIECES:
        if p["cls"] not in ("object", "decal"): continue
        kid, rows_ = object_kit(B, p)
        objs.append(dict(id=p["id"], kit=kid, rows=rows_))
    n = len(B.cells)
    print(f"조각 {len(PIECES)}장 · 킷 {len(B.kits)}개 · 칸 {n}/{BLOCK} → 내 토막 {BASE}..{END - 1}")
    if a.dry: return

    ts = json.loads(TS_PATH.read_text())
    sheet = Image.open(SHEET_PATH).convert("RGBA")
    assert ts["count"] == json.loads(SHEET_JSON.read_text())["count"] == (sheet.height // T) * COLS and ts["count"] % COLS == 0
    total = max(END, ts["count"])
    foreign = [i for i in range(BASE, min(END, ts["count"])) if (ts["tileMeta"][i].get("label") or "") and not ts["tileMeta"][i]["label"].startswith(LABEL)]
    if foreign: sys.exit(f"내 토막 안의 칸 {foreign[0]}(「{ts['tileMeta'][foreign[0]]['label']}」)이 남의 것이다")
    canvas = Image.new("RGBA", (COLS * T, total // COLS * T), (0, 0, 0, 0))
    canvas.paste(sheet, (0, 0))
    canvas.paste(Image.new("RGBA", (COLS * T, BLOCK // COLS * T), (0, 0, 0, 0)), (0, BASE // COLS * T))
    blank = lambda: (dict(OPEN), "lower", 0, dict(label="", description="", source="bundled-default"))
    for i in range(ts["count"], total):
        p_, pr, te, m = blank(); ts["passability"].append(p_); ts["priority"].append(pr); ts["terrain"].append(te); ts["tileMeta"].append(m)
    for i in range(BASE, END):
        p_, pr, te, m = blank(); ts["passability"][i] = p_; ts["priority"][i] = pr; ts["terrain"][i] = te; ts["tileMeta"][i] = m
    for k, (px, m) in enumerate(B.cells):
        i = BASE + k
        canvas.paste(Image.fromarray(px, "RGBA"), ((i % COLS) * T, (i // COLS) * T))
        ts["passability"][i] = dict(m["pass_"]); ts["priority"][i] = m["priority"]
        ts["tileMeta"][i] = dict(label=m["label"], description=m["description"], tags=m["tags"], defaultLayer=m["layer"], passage=m["passage"], source="bundled-default")
    ts["animationStrips"] = [s for s in ts.get("animationStrips", []) if not (BASE <= s["baseTile"] < END)]
    at = next((i for i, k in enumerate(ts["structureKits"]) if k["id"].startswith(PREFIX)), len(ts["structureKits"]))
    ts["structureKits"] = [k for k in ts["structureKits"][:at] if not k["id"].startswith(PREFIX)] + B.kits + [k for k in ts["structureKits"][at:] if not k["id"].startswith(PREFIX)]
    ts["count"] = total
    catalog = dict(tilesetId="beodeul_city", texture="tex_beodeul_city", tileSize=T, tilesPerRow=COLS, kitPrefix=PREFIX, base=BASE, end=END, used=n,
                   source="scripts/content/beodeul-routes/bake.py (pieces by Claude Fable 5.2 medium one-shot, cut and assembled by code; path and canopy edge cells are the drawn textures behind a code-made edge shape)",
                   gate=gate, pieces=[dict(id=p["id"], kind=p["kind"], sha256=d) for p, d in zip(PIECES, got)], objects=objs)
    outputs = [(TS_PATH, json.dumps(ts, ensure_ascii=False, separators=(",", ":")) + "\n"), (SHEET_JSON, json.dumps(dict(count=total, tilesPerRow=COLS)) + "\n"),
               (CATALOG, json.dumps(catalog, ensure_ascii=False, indent=1) + "\n"), (TABLE, json.dumps(table, ensure_ascii=False, separators=(",", ":")) + "\n")]
    if a.check:
        bad = [str(p_.relative_to(ROOT)) for p_, text in outputs if not p_.exists() or p_.read_text(encoding="utf-8") != text]
        if not np.array_equal(np.array(Image.open(SHEET_PATH).convert("RGBA")), np.array(canvas)): bad.append(str(SHEET_PATH.relative_to(ROOT)))
        print("다시 구운 것과 같다" if not bad else f"다르다: {bad}"); sys.exit(1 if bad else 0)
    canvas.save(SHEET_PATH, optimize=True)
    for p_, text in outputs: p_.write_text(text, encoding="utf-8")
    print(f"길목 토막: 킷 {len(B.kits)}개 · 칸 {BASE}..{BASE + n - 1} (예약 {END - 1} 까지)")


if __name__ == "__main__":
    main()
