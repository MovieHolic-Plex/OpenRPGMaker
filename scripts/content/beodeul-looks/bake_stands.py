#!/usr/bin/env python3
"""버들항 «숲 구성(stand)» 그림판 굽기 — 게임마다 다른 숲: 섞인 수종의 나무 그림 · 그 수종으로 다시 지은 이어진 숲 수관 · 숲 바닥 · 풀밭 얼룩.

  python3 scripts/content/beodeul-looks/bake_stands.py            # 굽는다(관문 통과분만)
  python3 scripts/content/beodeul-looks/bake_stands.py --check    # 다시 구워 지금 파일과 같은지만 본다(아무것도 쓰지 않는다)

왜(오너 2026-11-13 «나무랑 땅 타일도 좀 다양하게 해야할듯. 특히 숲쪽....»): 2차 겉모습은 «나무 수종 하나» 를 모든 나무 킷에 덮었다 — 한 맵의 숲이
같은 그림 하나를 고른 간격으로 찍은 것으로 읽혔다. 숲 구성 하나는 주 수종 · 곁 수종 둘 · 드문 강조 나무(고목·꽃나무) · 큰 나무 · 물가 나무 · 덤불 넷 안팎을
나무 킷 칸마다 나눠 덮고(칸 번호·통행 그대로), 이어진 숲 수관도 그 수종 수관으로 다시 짓는다.

무엇을 굽나
- 나무 그림(tiledata/beodeul-stands/trees + 2차 수종 tiledata/beodeul-looks/trees): 숲 구성마다 «킷 → 그림» 짝(pairs)과 역할별 킷 목록(kits).
- 이어진 숲 수관: scripts/content/append-beodeul-forest-canopy.py 의 짓는 함수(build_slots·canopy_tile·shade_tile)를 그대로 불러, 수관 그림만 그 숲 구성의
  수종 수관으로 바꿔 다시 짓는다(같은 씨앗 — 자리·겹·그늘·줄기 규칙은 원래 숲과 같다). 칸 번호는 자연 덧그림(tex_beodeul_nature)의 것 그대로이고
  그림만 겹친다(sources). 숲 남쪽 아래 그늘 칸은 2층에 놓여 숲 바닥 덧그림을 깔 수 없으므로 숲 바닥 재질 위에 얹은 그림을 따로 굽는다(shade — 둘레가 숲 바닥인 칸에만 쓴다).
- 덧그림(overlays): 숲 바닥 5 · 풀밭 얼룩 6 재질을 «꼭짓점 넷의 안팎»(북서1·북동2·남서4·남동8) 15꼴 × 두 벌로 — 가장자리는 들쭉날쭉한 점묘로 코드가 깎는다
  (재질만 그림). 숲 바닥은 나무·밑풀 그림자 칸에 얹은 벌(shadow)도 굽는다(그림자는 2층이라 숲 바닥과 한 칸에 겹칠 수 없다).

- 변형(variants): 같은 수종·같은 크기의 다른 개체 그림 — 킷 칸에 덮는 그림(pairs)과 달리 찍는 자리마다 골라 쓴다(project/standKit.ts). 덮개 값(cover)은 숲길의 나무 composer 가 읽는다.
- 솟는 나무 머리(crowns): 수종 그림에서 줄기를 잘라 낸 수관 — 이어진 숲 수관 위(4층)에 자리 해시로 얹어 여섯 칸 주기를 깬다.
- 한 칸 풀·덤불(small): 숲 바닥 종류마다 여섯 그림(tiledata/beodeul-stands/small) — 모든 게임이 같은 도장이던 고사리·헤더 덤불·들꽃 킷 열두 개를 덮는다.

무엇을 쓰나
- public/assets/beodeul-stands/chipset.png(128칸 폭) · src/assets/beodeulStands.json. 버들항 시트·자연 덧그림·타일셋 정의는 한 글자도 바꾸지 않는다.

3/4 관문(hard rule): 새로 그린 그림(나무·재질)마다 object-gate 출구 `require_all(context="bundle")`. 이 그림들은 **3/4 관문 미통과 — 오너 면제 묶음**
(spec.waiver)으로 출구를 지난다. 한 화소라도 바꾸면 면제가 풀린다.
"""
import argparse, hashlib, importlib.util, json, pathlib, sys
import numpy as np
from PIL import Image

HERE = pathlib.Path(__file__).resolve().parent
ROOT = HERE.parents[2]
sys.path.insert(0, str(ROOT / "src/harnesses/_core"))
STORE = ROOT / "tiledata/beodeul-stands"
LOOKS = ROOT / "tiledata/beodeul-looks"
OUT_PNG = ROOT / "public/assets/beodeul-stands/chipset.png"
OUT_JSON = ROOT / "src/assets/beodeulStands.json"
TS_PATH = ROOT / "src/assets/beodeulCityTileset.json"
NATURE_PNG = ROOT / "public/assets/beodeul-nature/chipset.png"
NATURE_CAT = ROOT / "src/assets/beodeulNatureCatalog.json"
T, COLS = 16, 128
GATE_NOTE = "3/4 관문 미통과 — 오너 면제 그림."
ROLE_TEXT = {"floor": "숲 바닥 덧그림", "patch": "풀밭 바닥 덧그림"}
TREE_SHADOW_KITS = ["bd-tree-c27062", "bd-tree-eef4bc", "bd-tree-28ad5e", "bd-pick-coast-cliff-road-fir-l", "bd-pick-coast-cliff-road-fir-m", "bd-pick-coast-cliff-road-fir-m2", "bd-pick-coast-cliff-road-fir-s"]


def load():
    spec = json.loads((STORE / "spec.json").read_text(encoding="utf-8"))
    looks = json.loads((LOOKS / "spec.json").read_text(encoding="utf-8"))
    trees = []
    for it in spec["trees"]:
        trees.append({**it, "im": Image.open(STORE / "trees" / it["src"]).convert("RGBA"), "new": True})
    for it in looks["trees"]:
        if it["species"] in spec["flora"]: trees.append({**it, "im": Image.open(LOOKS / "trees" / it["src"]).convert("RGBA"), "new": False})
    for it in trees:
        w, h = (int(v) * T for v in it["slot"].split("x"))
        assert it["im"].size == (w, h), (it["id"], it["im"].size)
    tex = {}
    for it in spec["textures"]:
        im = Image.open((LOOKS if it.get("store") == "looks" else STORE) / "textures" / f"{it['id']}.png").convert("RGBA")
        assert im.size == (T, T) and np.array(im)[:, :, 3].min() == 255, it["id"]
        tex[it["id"]] = np.array(im)
    small = {}
    for hid, it in spec.get("small", {}).get("strips", {}).items():
        im = Image.open(STORE / "small" / it["src"]).convert("RGBA")
        assert im.size == (6 * T, T), (hid, im.size)
        small[hid] = im
    return spec, trees, tex, small


def gate(spec, trees, tex, small):
    from object_gate import require_all
    items = [(Image.fromarray(tex[it["id"]], "RGBA"), it["kind"], f"beodeul_{'looks' if it.get('store') == 'looks' else 'stands'}/{it['id']}") for it in spec["textures"]]
    items += [(it["im"], it["kind"], f"beodeul_{'stands' if it['new'] else 'looks'}/{it['id']}") for it in trees]
    items += [(im, "organic", f"beodeul_stands/small-{hid}") for hid, im in small.items()]
    got = require_all(items, context="bundle")
    print(f"관문(bundle 출구): {len(got)}/{len(items)} — {GATE_NOTE} 묶음 {spec['waiver']}")


def crown_keep(im):
    """그림의 불투명 부분 가운데 수관이 차지하는 위쪽 몫 — 밑에서부터 폭이 가장 넓은 줄의 45% 를 처음 넘는 줄까지(그 아래는 줄기)."""
    a = np.array(im)[:, :, 3] > 200
    ys = np.nonzero(a.any(1))[0]
    widths = a.sum(1)
    for y in range(ys.max(), ys.min() - 1, -1):
        if widths[y] >= 0.45 * widths.max(): return (y - ys.min() + 1) / (ys.max() - ys.min() + 1)
    return 1.0


def cover_of(im):
    """그림의 칸마다 불투명 화소의 몫(0~100, 행 우선) — 나무 composer 가 «이 칸이 뒤 나무를 다 가리는가» 를 이 값으로 본다."""
    a = np.array(im)[:, :, 3] > 127
    return [int(round(100 * a[y:y + T, x:x + T].mean())) for y in range(0, a.shape[0], T) for x in range(0, a.shape[1], T)]


def crown_only(im, seed):
    """숲 수관 위로 솟는 나무 머리 — 그림에서 줄기 줄을 잘라 낸 수관(아랫선은 3px 안에서 들쭉날쭉). 수관이 그림의 절반을 못 채우면 None."""
    a = np.array(im).copy(); alpha = a[:, :, 3] > 200
    ys = np.nonzero(alpha.any(1))[0]
    cut = ys.min() + int(round(min(crown_keep(im), 0.78) * (ys.max() - ys.min() + 1)))   # 줄기가 굵어 수관 끝을 못 찾은 그림도 아래 2할은 자른다
    rng = np.random.default_rng(seed)
    for x0 in range(0, a.shape[1], 3):
        a[cut - int(rng.integers(0, 4)):, x0:x0 + 3] = 0
    a[a[:, :, 3] < 255] = 0                                   # 땅 그림자(반투명)는 수관 위에 두지 않는다
    rows = -(-cut // T)
    if rows < 2 or (a[:, :, 3] > 0).sum() < 0.3 * rows * T * a.shape[1]: return None
    return a[:rows * T]


def tile_noise(seed):
    """16×16, 칸 경계에서 감싸 이어지는 부드러운 잡음(0~1)."""
    g = np.random.default_rng(seed).random((4, 4))
    yy, xx = np.mgrid[0:T, 0:T]
    fx, fy = (xx + 0.5) / 4 - 0.5, (yy + 0.5) / 4 - 0.5
    x0, y0 = np.floor(fx).astype(int), np.floor(fy).astype(int)
    tx, ty = fx - x0, fy - y0
    tx, ty = tx * tx * (3 - 2 * tx), ty * ty * (3 - 2 * ty)
    v = lambda dx, dy: g[(y0 + dy) % 4, (x0 + dx) % 4]
    return v(0, 0) * (1 - tx) * (1 - ty) + v(1, 0) * tx * (1 - ty) + v(0, 1) * (1 - tx) * ty + v(1, 1) * tx * ty


def wang(tex, mask, seed):
    """꼭짓점 넷의 안팎(북서1·북동2·남서4·남동8)으로 깎은 덧그림 칸 — 재질 화소는 그 자리 그대로, 가장자리는 잡음으로 흔들고 점묘로 푼다."""
    if mask == 15: return tex.copy()
    yy, xx = np.mgrid[0:T, 0:T]
    u, v = (xx + 0.5) / T, (yy + 0.5) / T
    nw, ne, sw, se = (mask & 1) > 0, (mask & 2) > 0, (mask & 4) > 0, (mask & 8) > 0
    f = nw * (1 - u) * (1 - v) + ne * u * (1 - v) + sw * (1 - u) * v + se * u * v
    val = f + 0.26 * (tile_noise(seed) - 0.5)
    d = np.random.default_rng(seed + 977).random((T, T))
    inside = val > 0.5
    inside |= (val > 0.36) & (d < 0.2)
    inside &= ~((val < 0.64) & (d > 0.84))
    out = tex.copy(); out[~inside] = 0
    return out


def over(base, top):
    """불투명 base 위에 top(RGBA)을 얹은 불투명 칸."""
    a = top[:, :, 3:4].astype(float) / 255
    out = base.copy()
    out[:, :, :3] = np.round(top[:, :, :3] * a + base[:, :, :3] * (1 - a)).astype(np.uint8)
    out[:, :, 3] = 255
    return out


def hex_rgb(h): return tuple(int(h[i:i + 2], 16) for i in (1, 3, 5))


class Canopy:
    """이어진 숲 수관을 그 숲 구성의 수종으로 다시 짓는다 — 짓는 규칙은 append-beodeul-forest-canopy.py 그대로."""

    def __init__(self, spec, pics):
        s = importlib.util.spec_from_file_location("beodeul_canopy_gen", ROOT / "scripts/content/append-beodeul-forest-canopy.py")
        self.gen = gen = importlib.util.module_from_spec(s); s.loader.exec_module(gen)
        self.spec, self.pics = spec, pics
        self.cat = json.loads(NATURE_CAT.read_text(encoding="utf-8"))
        leaf = self.cat["forestCanopy"]["leaf"]
        # 숲 덩이의 남쪽 끝 줄에만 쓰이는 칸(남쪽이 숲이 아닌 이웃 모양) — 2층에 놓인다
        south, inner = set(), set()
        for row in leaf:
            for m, t in enumerate(row):
                if t >= 0: (inner if m & 64 else south).add(t)
        self.south = south - inner
        self.reg = {}
        self.sent = ([(0, 0, 0)] * 6, [(1, 1, 1)] * 6)
        gen.RAMP["st:a"], gen.RAMP["st:b"] = self.sent
        kit_image, relight = gen.kit_image, gen.relight
        gen.kit_image = lambda kid: np.array(pics[kid]) if kid in pics else kit_image(kid)
        def lit(img, ramp, off, rim, snow=None, caps=False, shape=None, clump=False):
            v = self.reg.get(hashlib.sha1(np.ascontiguousarray(img).tobytes()).digest())
            if v is not None: ramp = v[1 if ramp is self.sent[1] else 0]
            return relight(img, ramp, off, rim, snow, caps, shape, clump)
        gen.relight = lit
        self.memo = {}

    def ramps(self, sp):
        r = self.spec["flora"][sp].get("ramp", "oak")
        if sp == "orig": return [self.gen.RAMP["oak"], self.gen.RAMP["lime"]]
        base = self.gen.RAMP[r] if isinstance(r, str) else [hex_rgb(h) for h in r]
        return [base, [base[0], base[0], base[1], base[2], base[3], base[4]]]

    def crowns(self, sp, n):
        """수종의 수관 그림 n 개 — (그림 id, 수관 몫). 3×3 → 3×4 → 2×2 → 4×5 순으로 서로 다른 그림."""
        if sp == "orig": return [("bd-tree-f4f319", 1.0), ("bd-tree-37f48b", 1.0), ("bd-tree-0f7ed1", 1.0)][:max(n, 2)]
        have = []
        for slot in ("3x3", "3x4", "2x2", "4x5"):
            have += [p for p in self.pics if p.startswith(f"tree-{sp}-{slot}-")]
        return [(have[i % len(have)], crown_keep(self.pics[have[i % len(have)]])) for i in range(n)] if have else []

    # 숲 남쪽 끝 줄(밑동 사이)과 수관이 못 선 칸에 서는 하층 덤불·고사리·들꽃 — 원본은 옛 밝은 연두 덤불(bd-mpart-bush-c 등)을 덤불 색 단으로 칠한 것이라
    # 어느 숲 구성이든 같은 연두 덤불이 여섯 칸마다 섰다(2026-11-13 «옛 밝은 한 칸 덤불이 게임마다 같은 도장»). 그 숲 바닥의 한 칸 풀·덤불 띠 그림으로 바꾼다
    # (띠의 칸: 고사리 0·1 · 낮은 덤불 2·3 · 들꽃 4·5). 띠 그림은 이미 그 숲의 색이라 다시 칠하지 않는다.
    UNDER = {"bd-mpart-bush-c": 2, "bd-mpart-bush-e": 3, "bd-tree-47e17a": 4, "bd-pick-deep-forest-path-fern-a": 0, "bd-pick-deep-forest-path-fern-b": 1,
             "bd-pick-deep-forest-path-fern-c": 0, "bd-pick-deep-forest-path-wild-a": 4, "bd-pick-deep-forest-path-wild-b": 5}

    def tiles(self, stand, strip=None):
        """→ {자연 덧그림 칸 번호: 그림}. 같은 수종 묶음·같은 숲 바닥이면 한 번만 짓는다. strip = 그 숲 바닥의 한 칸 풀·덤불 띠(없으면 원본 하층)."""
        gen, flora = self.gen, self.spec["flora"]
        dom = stand["dominant"]
        # 눈에 띄는 수종(꽃나무·구리빛·연두 — flora.loud)은 이어진 수관에 넣지 않는다: 수관은 여섯 칸 주기라 밝은 수관이 격자로 되풀이됐다.
        # 그 수종은 수관 위로 솟는 머리(crowns)와 낱 나무로만 선다. 주 수종이 그런 수종이면 수관 전체가 그 빛이라 격자가 보이지 않는다.
        calm = [c for c in stand["companions"] if not flora[c].get("loud")]
        comps = (calm + [dom, dom])[:2]
        key = (dom, tuple(comps), stand["floor"] if strip is not None else None)
        if key in self.memo: return self.memo[key]
        groups = [[(dom, 2), (comps[0], 1)], [(comps[1], 2)]]
        species = []
        for group in groups:
            kits, narrow = [], True
            for sp, n in group:
                for pid, keep in self.crowns(sp, n):
                    kits.append((pid, keep)); narrow = narrow and bool(flora[sp].get("narrow") or sp in ("fir", "pine"))
            fits = (28, 30, 32) if narrow else gen.STYLES["leaf"]["fits"]
            for sp, n in group:
                for pid, keep in self.crowns(sp, n):
                    for f in fits:
                        s = gen.sprite(pid, keep, f)
                        for img in (s, s[:, ::-1]): self.reg[hashlib.sha1(np.ascontiguousarray(img).tobytes()).digest()] = self.ramps(sp)
            species.append(dict(kits=kits, ramps=["st:a", "st:b"], tw=2 if narrow else 4, fits=fits))
        style = dict(gen.STYLES["leaf"], species=species, conifer=0.3)
        if strip is not None:
            band = np.array(strip)
            for kid, n in self.UNDER.items(): self.pics[kid] = Image.fromarray(band[:, n * T:(n + 1) * T])
            for part in ("undergrowth", "brush"): style[part] = [(k, f, None if k in self.UNDER else r) for k, f, r in gen.STYLES["leaf"][part]]
        if flora[dom].get("trunk"): style["trunk"] = tuple(hex_rgb(h) for h in flora[dom]["trunk"])
        name = "leaf@" + "+".join([dom, *comps])
        gen.STYLES[name] = style
        data = gen.build_slots(name, 23)
        P = data["P"]
        # 자연 덧그림은 닮은 그림끼리 한 번호를 나눠 쓴다(append-beodeul-forest-canopy.py 의 번호 맞추기) — 수관이 달라지면 그 그림들이 갈린다.
        # 번호마다 그림은 하나뿐이니 이웃이 많은 꼴(숲 속 → 가장자리 → 뾰족한 끝)부터 차지하게 한다: 흔한 칸이 제 그림을 갖는다.
        out, memo, clash, inner = {}, {}, 0, 0
        order = sorted(((ph, m, t) for ph, row in enumerate(self.cat["forestCanopy"]["leaf"]) for m, t in enumerate(row) if t >= 0), key=lambda v: -bin(gen.canon(v[1])).count("1"))
        for ph, m, t in order:
            k = (gen.canon(m), ph)
            if k not in memo: memo[k] = gen.canopy_tile(name, data, k[0], ph % P, ph // P)
            if t in out:
                bad = not np.array_equal(out[t], memo[k]); clash += bad; inner += bad and bin(k[0]).count("1") >= 5
            else: out[t] = memo[k]
        clash = (clash, inner)
        i = 0
        for phx in range(P):
            for nw in (False, True):
                for ne in (False, True):
                    t = self.cat["forestShade"]["leaf"][i]; i += 1
                    if t >= 0: out[t] = gen.shade_tile(name, phx, nw, ne)
        del gen.STYLES[name]
        if strip is not None:
            for kid in self.UNDER: del self.pics[kid]
        self.memo[key] = (out, clash)
        return self.memo[key]


def assign(spec, stand, by):
    """나무 킷마다 덮을 그림과 역할. by[(수종, 크기)] = [그림 id…]. → ({킷: 그림 id}, {역할: [킷…]})"""
    dom, (ca, cb) = stand["dominant"], stand["companions"]
    acc, giant, water, shrubs = stand.get("accent"), stand.get("giant"), stand.get("water"), stand.get("shrubs", [])
    want = {
        "4x5": [dom, giant, ca, cb],
        "3x4": [dom, ca, water or cb, acc, cb],
        "3x3": [dom, ca, cb, acc],
        "2x2": [dom, ca, cb, *shrubs],
    }
    role_of = lambda sp, slot: "shrub" if slot == "2x2" else "dominant" if sp == dom else "water" if sp == water and sp not in (ca, cb) else "accent" if sp in (acc, giant) and sp not in (ca, cb) else "companion"
    pic, roles = {}, {r: [] for r in ("dominant", "companion", "accent", "shrub", "water", "row", "fruit")}
    for slot, kits in spec["treeSlots"].items():
        order = []
        for sp in want[slot]:
            if sp and sp not in order and (sp == "orig" or by.get((sp, slot))): order.append(sp)
        if not order: order = ["orig"]
        used = {}
        for n, kit in enumerate(kits):
            sp = order[n % len(order)]
            if sp != "orig":
                pics = by[(sp, slot)]; pic[kit] = pics[used.get(sp, 0) % len(pics)]; used[sp] = used.get(sp, 0) + 1
            role = role_of(sp, slot)
            roles[role].append(kit)
            if slot != "2x2":
                for extra in ("row", "fruit"):
                    if extra in spec["flora"][sp].get("roles", []): roles[extra].append(kit)
                if role != "water" and "water" in spec["flora"][sp].get("roles", []): roles["water"].append(kit)
    return pic, roles


SMALL_KITS = [  # 걸어 넘는 한 칸 풀·덤불 킷 → 띠의 칸(0~5: 고사리 둘 · 낮은 덤불 둘 · 들꽃 둘). 이름표(고사리·헤더 덤불·들꽃)와 같은 갈래의 그림만 덮는다.
    ("bd-pick-deep-forest-path-fern-a", 0), ("bd-pick-deep-forest-path-fern-b", 1),
    ("bd-pick-deep-forest-path-heath-a", 2), ("bd-pick-deep-forest-path-heath-b", 3),
    ("bd-pick-coast-cliff-road-heath-a", 3), ("bd-pick-coast-cliff-road-heath-b", 2), ("bd-pick-coast-cliff-road-heath-c", 3),
    ("bd-pick-deep-forest-path-wild-a", 4), ("bd-pick-deep-forest-path-wild-b", 5), ("bd-pick-deep-forest-path-wild-c", 4),
    ("bd-pick-wheat-roman-road-wild-a", 5), ("bd-pick-wheat-roman-road-wild-b", 4),
]


def compose(spec, trees, tex, small):
    ts = json.loads(TS_PATH.read_text(encoding="utf-8"))
    kits = {k["id"]: k for k in ts["structureKits"]}
    cells, index = [np.zeros((T, T, 4), np.uint8)], {}
    def add(px):
        key = px.tobytes()
        if key not in index: index[key] = len(cells); cells.append(np.ascontiguousarray(px))
        return index[key]
    pics = {it["id"]: it["im"] for it in trees}
    by = {}
    for it in trees: by.setdefault((it["species"], it["slot"]), []).append(it["id"])
    # 그림 id 순(…-1, …-2) — 첫 그림이 킷 칸에 덮이는 그림이다. 2차의 수종(버들 등)에 이 그림판이 다른 개체 그림을 더해도 첫 그림이 바뀌지 않게 한다.
    for ids in by.values(): ids.sort()
    table = {"version": 2, "tilesetId": "beodeul_city", "image": "tex_beodeul_city", "texture": "tex_beodeul_stands", "tileSize": T, "tilesPerRow": COLS,
             "note": "생성 파일 — scripts/content/beodeul-looks/bake_stands.py. pairs·small·sources·shadow·shade 는 [원본 칸, 그림판 칸] 쌍을 편 목록(shade = 숲 그늘 칸을 숲 바닥에 얹은 그림 — 둘레가 숲 바닥일 때만 쓴다). cover·variantCover 는 칸마다 불투명 몫(0~100). variants[킷] = 같은 수종의 다른 개체 그림들(줄 목록, 빈 칸 -1). crowns = 숲 수관 위로 솟는 나무 머리(4층). overlays.cells[꼭짓점 비트 북서1·북동2·남서4·남동8] = 그림판 칸(alt = 둘째 벌).",
             "gate": f"3/4 gate not passed — owner waiver {spec['waiver']}", "stands": {}, "meadows": spec["meadows"], "overlays": {}, "worn": spec["worn"], "verge": spec["verge"], "reed": spec["reed"]}
    # 덧그림
    nat_cat = json.loads(NATURE_CAT.read_text(encoding="utf-8"))
    nat = np.array(Image.open(NATURE_PNG).convert("RGBA"))
    nat_tile = lambda t: nat[(t // 16) * T:(t // 16 + 1) * T, (t % 16) * T:(t % 16 + 1) * T]
    shadow_tiles = sorted({t for kid in [k for ks in spec["treeSlots"].values() for k in ks] + TREE_SHADOW_KITS + spec["shadowKits"]
                           for row in (nat_cat["shadows"].get(kid) or {"rows": []})["rows"] for t in row if t >= 0})
    for n, it in enumerate(spec["textures"]):
        px = tex[it["id"]]
        entry = {"label": f"{ROLE_TEXT[it['role']]}({it['name'].split('· ')[-1]})", "en": it["en"], "role": it["role"],
                 "cells": [-1] + [add(wang(px, m, 1000 + n * 10)) for m in range(1, 16)], "alt": [-1] + [add(wang(px, m, 1005 + n * 10)) for m in range(1, 16)]}
        if it.get("store") == "looks": entry["ground"] = it["id"]
        if it.get("avoid"): entry["avoid"] = it["avoid"]
        if it.get("small"): entry["small"] = True
        if it["role"] == "floor":
            entry["shadow"] = [v for t in shadow_tiles for v in (t, add(over(px, nat_tile(t))))]
        table["overlays"][it["id"]] = entry
    # 나무 그림 칸(그림마다 한 벌)
    pic_cells = {}
    def cells_of(pid):
        if pid not in pic_cells:
            im = np.array(pics[pid]); h, w = im.shape[0] // T, im.shape[1] // T
            pic_cells[pid] = [[add(im[y * T:(y + 1) * T, x * T:(x + 1) * T]) if im[y * T:(y + 1) * T, x * T:(x + 1) * T, 3].max() else 0 for x in range(w)] for y in range(h)]
        return pic_cells[pid]
    meta = {it["id"]: it for it in trees}
    variant_memo = {}
    def variant_cells(kid, pid):
        """변형 그림의 칸 — (킷, 그림)마다 따로 굽는다(같은 화소라도 합치지 않는다): 칸 하나가 원본 킷의 한 자리만 가리켜야 도구가 변형 나무를 그 킷으로 되읽는다.

        그림이 비운 칸이라도 원본 킷에서 막힌 칸이면 빈 그림 칸을 하나 굽는다 — 변형 나무의 발자국(막힌 칸)이 원본 킷과 같아야 한다.
        (비워 두면 그 칸이 걷는 칸이 돼, 숲 구성을 고른 게임만 던전 장치·적 자리가 달라지고 다른 배치가 뽑혔다 — 첫 그림은 킷 칸에 덮여 원래 막힌 채다.)"""
        if (kid, pid) not in variant_memo:
            im = np.array(pics[pid]); rows = []; kit = kits[kid]
            for y in range(0, im.shape[0], T):
                row = []; kr = kit["rows"][y // T]
                for x in range(0, im.shape[1], T):
                    px = im[y:y + T, x:x + T]
                    up = (kr.get("upperTiles") or [-1] * kit["width"])[x // T]
                    base = up if up >= 0 else kr["tiles"][x // T]
                    solid = base >= 0 and not any(ts["passability"][base].values())
                    if px[:, :, 3].max() or solid: row.append(len(cells)); cells.append(np.ascontiguousarray(px))
                    else: row.append(-1)
                rows.append(row)
            variant_memo[(kid, pid)] = rows
        return variant_memo[(kid, pid)]
    crown_cells = {}
    def crown_of(pid):
        """솟는 나무 머리의 칸(줄 목록, 빈 칸 -1) — 그림마다 한 번."""
        if pid not in crown_cells:
            a = crown_only(pics[pid], int(hashlib.sha1(pid.encode()).hexdigest()[:8], 16))
            crown_cells[pid] = None if a is None else [[add(a[y:y + T, x:x + T]) if a[y:y + T, x:x + T, 3].max() else -1 for x in range(0, a.shape[1], T)] for y in range(0, a.shape[0], T)]
        return crown_cells[pid]
    canopy = Canopy(spec, pics)
    for sid, stand in spec["stands"].items():
        pic, roles = assign(spec, stand, by)
        pairs, seen = [], set()
        for kid, pid in pic.items():
            kit = kits[kid]; rows = cells_of(pid)
            for y, row in enumerate(kit["rows"]):
                for x in range(kit["width"]):
                    up = (row.get("upperTiles") or [-1] * kit["width"])[x]
                    t = up if up >= 0 else row["tiles"][x]
                    assert t >= 0 and t not in seen, (kid, x, y)
                    seen.add(t); pairs += [int(t), rows[y][x]]
        tiles, clash = canopy.tiles(stand, small.get(stand["floor"]))
        floor = tex[stand["floor"]]
        shade = set(t for t in nat_cat["forestShade"]["leaf"] if t >= 0)
        src, shade_over = [], []
        for t in sorted(tiles):
            px = tiles[t]
            src += [int(t), add(px) if px[:, :, 3].max() else 0]
            # 숲 그늘 칸(숲 남쪽 바로 아래 줄, 2층)은 숲 바닥 덧그림과 한 칸에 겹칠 수 없다 — 숲 바닥에 얹은 그림을 따로 굽고,
            # 시공기가 «둘레가 모두 숲 바닥인 칸» 에만 그 그림으로 바꾼다(늘 얹어 구우면 숲 바닥이 없는 자리에 네모 판이 남는다)
            if t in shade and px[:, :, 3].max(): shade_over += [int(t), add(over(floor, px))]
        # 나무 composer(숲길)가 읽는 덮개 값과 같은 수종·같은 크기의 «다른 개체» 그림(변형) — 찍는 자리마다 골라 옆 나무와 다른 그림이 선다
        cover = {kid: cover_of(pics[pid]) for kid, pid in pic.items()}
        variants, variant_cover = {}, {}
        for kid, pid in pic.items():
            others = [p for p in by[(meta[pid]["species"], meta[pid]["slot"])] if p != pid]
            if others:
                variants[kid] = [variant_cells(kid, p) for p in others]
                variant_cover[kid] = [cover_of(pics[p]) for p in others]
        # 숲 수관 위로 솟는 나무 머리: 주 수종·곁 수종·강조·큰 나무의 세 칸 넘는 그림(변형 포함)에서 줄기를 잘라 낸 것
        crowns, seen_crown = [], set()
        for sp in [stand["dominant"], *stand["companions"], stand.get("accent"), stand.get("giant")]:
            for slot in ("3x3", "3x4", "4x5"):
                for pid in by.get((sp, slot), []) if sp and sp != "orig" else []:
                    rows = crown_of(pid)
                    if rows and pid not in seen_crown:
                        # 눈에 띄는 수종(flora.loud)이 주 수종이 아니면 «강조 머리» — 시공기가 드물게만 세운다(밝은 머리 여덟이 한 맵에 서면 그것이 도장으로 읽혔다)
                        loud = bool(spec["flora"][sp].get("loud")) and sp != stand["dominant"]
                        seen_crown.add(pid); crowns.append({"w": len(rows[0]), "h": len(rows), "rows": rows, **({"accent": True} if loud else {"dominant": True} if sp == stand["dominant"] else {})})
        # 한 칸 풀·덤불: 그 숲 바닥의 띠에서 여섯 그림
        strip = small.get(stand["floor"]); small_pairs = []
        if strip is not None:
            a = np.array(strip)
            for kid, n in SMALL_KITS:
                row = kits[kid]["rows"][0]; up = (row.get("upperTiles") or [-1])[0]
                small_pairs += [int(up if up >= 0 else row["tiles"][0]), add(a[:, n * T:(n + 1) * T])]
        table["stands"][sid] = {"label": stand["label"], "en": stand["en"], "floor": stand["floor"], "dominant": stand["dominant"], "pairs": pairs, "sources": {"tex_beodeul_nature": src},
                                "kits": {r: v for r, v in roles.items() if v}, "under": spec["undergrowth"][stand["floor"]], "cover": cover, "shade": shade_over,
                                **({"orchard": True} if "fruit" in spec["flora"][stand["dominant"]].get("roles", []) else {}),
                                # 눈에 띄는 곁 수종(flora.loud)의 킷 — 숲 끝의 앞줄 나무·만입 덤불은 이 킷을 드물게만 고른다
                                **(lambda loud: {"loud": loud} if loud else {})(sorted(kid for kid, pid in pic.items() if spec["flora"][meta[pid]["species"]].get("loud") and meta[pid]["species"] != stand["dominant"])),
                                **({"variants": variants, "variantCover": variant_cover} if variants else {}), **({"crowns": crowns} if crowns else {}), **({"small": small_pairs} if small_pairs else {})}
        print(f"  {sid}: 킷 그림 {len(pic)} · 수관 칸 {len(tiles)}(제 그림을 못 가진 자리 {clash[0]} · 그중 이웃 다섯 넘는 꼴 {clash[1]}) · 역할 " + " ".join(f"{r}{len(v)}" for r, v in roles.items() if v))
    table["count"] = -(-len(cells) // COLS) * COLS
    return cells, table


def sheet_png(cells, count):
    a = np.zeros((count // COLS * T, COLS * T, 4), np.uint8)
    for i, c in enumerate(cells):
        y, x = divmod(i, COLS)
        a[y * T:(y + 1) * T, x * T:(x + 1) * T] = c
    return Image.fromarray(a, "RGBA")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--check", action="store_true")
    args = ap.parse_args()
    spec, trees, tex, small = load()
    gate(spec, trees, tex, small)
    cells, table = compose(spec, trees, tex, small)
    im = sheet_png(cells, table["count"])
    assert im.size[1] <= 4096, f"그림판이 {im.size[1]}px — 4096px(GPU 한도)를 넘는다"
    text = json.dumps(table, ensure_ascii=False, separators=(",", ":")) + "\n"
    print(f"그림판 {im.size[0]}×{im.size[1]} · 칸 {len(cells)}(표 {table['count']}) · 숲 구성 {len(table['stands'])} · 풀밭 얼룩 {len(table['meadows'])} · 덧그림 재질 {len(table['overlays'])}")
    if args.check:
        same = OUT_JSON.exists() and OUT_JSON.read_text(encoding="utf-8") == text and OUT_PNG.exists() and np.array_equal(np.array(Image.open(OUT_PNG).convert("RGBA")), np.array(im))
        print("같다" if same else "다르다 — 다시 구워야 한다")
        sys.exit(0 if same else 1)
    OUT_PNG.parent.mkdir(parents=True, exist_ok=True)
    im.save(OUT_PNG, optimize=True)
    OUT_JSON.write_text(text, encoding="utf-8")
    print(f"썼다: {OUT_PNG.relative_to(ROOT)} ({OUT_PNG.stat().st_size // 1024} KB) · {OUT_JSON.relative_to(ROOT)} ({len(text) // 1024} KB)")


if __name__ == "__main__":
    main()
