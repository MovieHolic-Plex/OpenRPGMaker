#!/usr/bin/env python3
"""집 벌(house set) 조립: 벌마다 한 번 그린 부품(tiledata/beodeul-houses/<벌>/parts)을 코드로 이어 붙여, 덮는 건물 킷마다 «같은 칸» 그림을 만든다.

    python3 scripts/content/beodeul-houses/assemble.py <벌> [--sheet <png> --hero <png>]

남기는 것: tiledata/beodeul-houses/<벌>/pictures/<그림 열쇠>[.v1|.v2].png(1배, 킷과 같은 크기) · report.json(직각 지붕 계약 수치·빈 칸).
그림 열쇠 = 같은 그림을 쓰는 킷 묶음(kits.json pictures)의 첫 킷 id. 변형 0 은 접미사가 없다.

조립 계약(굽기 bake.py 가 다시 잰다):
- 원본 킷이 비운 칸에는 화소가 없다(조립 끝에 지운다). 원본이 막힌 칸은 그대로 막히므로 가능한 한 그림을 둔다 — 빈 막힌 칸 수를 report 에 적는다.
- 지붕은 직사각형(옆선 수직 · 사다리꼴 없음), 높이 ≤ 44px(폭 128px 이상은 ≤ 48px), 주인공(32px)보다 높은 지붕은 건물 높이의 55% 이하.
- 문은 원본 문 칸(가로 한 칸)에, 문 아래가 원본 문 칸 아랫변에 온다.

명암(2026-11-13 검수: «새 집이 버들항 원본보다 납작하다»): 지붕은 위→아래 빛 흐름(용마루 밝은 줄 · 위 단 한 단 밝게 · 셋째 단마다 아랫줄 한 단 어둡게 ·
맨 아래 단과 처마 밑줄 어둡게)을 같은 재료 줄 안에서 준다 — 윤곽은 그대로 직사각형. 벽은 처마 바로 밑에 그늘 띠(두 줄 두 단 · 세 줄 한 단).
흰 벽은 버들항 집 벽의 실측 밝기(휘도 218~223) 안으로 낮추고(SETS.retone) 구름 얼룩 대신 잔 점 회벽을 코드로 찍는다(plaster_tile).

같은 벌 안 변형(VARIANTS): 킷마다 0·1·2 세 장 — 지붕 둘째 색조, 문·덧문 색, 아래층/단층 벽 재질, 창 화분·굴뚝 유무가 다르다. 빌더가 집마다(자리마다) 한 장을 고른다.
"""
import json, os, sys, random
import numpy as np
from PIL import Image, ImageDraw

HERE = os.path.dirname(os.path.abspath(__file__)); REPO = os.path.abspath(f"{HERE}/../../..")
DATA = f"{REPO}/tiledata/beodeul-houses"
T = 16

# 벌마다: 재료 줄 이름과 조립 규칙.
#   roofR 지붕 줄 · body 본벽(code = 코드 회벽 [줄, 바탕 단]) · alt 둘째 벽(부품 이름 또는 code 또는 본벽을 다른 줄로 옮긴 것) · altFoot 둘째 벽에도 기초 띠
#   rough 돌집·헛간(mat="stone")이 쓰는 벽 · two 두 층 집(ground="stone")의 재질 나눔: alt-ground 아래층이 둘째 벽 · alt-up 위층이 둘째 벽 · same 한 재질
#   lean 곁채 벽 · band 층 띠(줄, 어두운 단, 밝은 단) · accents 변형마다 문·덧문 색 줄 · mill 방앗간 탑 몸통의 줄 옮김(망루 집 탑과 다르게)
#   retone 줄을 통째로 다른 색으로(부품 화소도 같은 단끼리 옮긴다) · borrow 흰 벌에서 빌리는 부품의 줄 옮김
SETS = {
    "white": dict(roofR="slate", body=("code", "plaster", 3), alt="stonewall", altFoot=False, rough="alt", two="alt-ground", lean="planks", band=("plaster", 1, 4),
                  accents=["paint", "paint2", "wood"], mill={"plaster": "stone"},
                  retone={"plaster": ["#898b88", "#a8aaa7", "#c4c6c3", "#d6d8d5", "#dee0dd"]},
                  extra={"paint2": ["#562026", "#7a2e2c", "#863736", "#ab4144"]}),
    "stone": dict(roofR="thatch", body="wall", alt=("code", "lime", 3), altFoot=True, rough="body", two="alt-up", lean="body", band=("wallstone", 1, 5),
                  accents=["paint", "paint2", "wood"], mill={"wallstone": "lime"},
                  retone={"lime": ["#898b88", "#a8aaa7", "#c4c6c3", "#d6d8d5"]},
                  extra={"paint2": ["#2b333c", "#37545b", "#55858a", "#9badb1"]},
                  borrow={"plaster": "lime", "slate": "thatch", "stone": "wallstone"}),
    "timber": dict(roofR="shingle", body="wall", alt=("remap", {"tar": "falu"}), altFoot=True, rough="body", two="same", lean="body", band=("trim", 1, 3),
                   accents=["paint", "paint2", "paint3"], mill={"stone": "tar"}, retone={"trim": ["#898b88", "#afb1ae", "#cdcfcc", "#dee0dd"]},
                   extra={"paint2": ["#143a27", "#205030", "#3f723e", "#618c3b"], "paint3": ["#2b333c", "#37545b", "#55858a", "#9badb1"],
                          "falu": ["#452a17", "#562026", "#7a2e2c", "#863736", "#ab4144", "#ab4144"]},  # 붉게 칠한 널벽(둘째 벽) — 타르 널의 같은 단을 가라앉은 붉은색으로
                   borrow={"plaster": "trim", "slate": "shingle"}),
    "brick": dict(roofR="tile", body="wall", alt="stonewall", altFoot=False, rough="alt", two="alt-ground", lean="alt", band=("sand", 1, 5),
                  accents=["paint", "paint2", "paint3"], mill={"sand": "brick"},
                  extra={"paint2": ["#2b333c", "#37545b", "#55858a", "#9badb1"], "paint3": ["#562026", "#7a2e2c", "#863736", "#ab4144"]},
                  borrow={"plaster": "sand", "slate": "tile"}),
}
# 벌마다 다시 그리지 않는 부품 — 흰 벌 것을 그 벌의 줄로 옮겨 쓴다. tower-cap 은 벽돌 벌만 빌린다(그 벌의 둥근 지붕은 두 번 다 출력이 끊겨 그림이 없다 — 다시 그리기는 한 번뿐).
BORROWED = ("signs", "win-arch", "belfry", "tower-cap")
ACCENT_PARTS = ("door", "win-shutter", "barndoor", "hoist", "shopfront", "cupola")  # 문·덧문 색(변형)이 닿는 부품
# 같은 벌 안 변형: roof 지붕 색조(단) · accent 문·덧문 색(SETS.accents 순번) · flip 두 층 집의 아래층 재질 뒤집기 · alt1 단층 집을 둘째 벽으로
# · wins 창 모양 치우침 · flue 굴뚝 없는 집에 작은 굴뚝
VARIANTS = [
    dict(roof=0, accent=0, flip=False, alt1=False, wins=None, flue=False),
    dict(roof=-1, accent=1, flip=True, alt1=False, wins="shutter", flue=True),
    dict(roof=0, accent=2, flip=False, alt1=True, wins="box", flue=False),
]


def hexrgb(h): return tuple(int(h[i:i + 2], 16) for i in (1, 3, 5))


class Set:
    def __init__(self, name):
        self.name = name; self.dir = f"{DATA}/{name}"; self.cfg = SETS[name]
        self.ramps = json.load(open(f"{self.dir}/ramps.json"))
        self.parts = {f[:-4]: Image.open(f"{self.dir}/parts/{f}").convert("RGBA") for f in sorted(os.listdir(f"{self.dir}/parts")) if f.endswith(".png")}
        if name != "white":  # 빌린 부품: 흰 벌 줄 → 이 벌 줄(같은 자리 단)
            white = json.load(open(f"{DATA}/white/ramps.json")); moves = {src: dst for src, dst in self.cfg.get("borrow", {}).items()}
            for part in BORROWED:
                if part not in self.parts:
                    self.parts[part] = self.move(Image.open(f"{DATA}/white/parts/{part}.png").convert("RGBA"), moves, src_ramps=white)
        for ramp, tones in (self.cfg.get("retone") or {}).items():  # 줄 통째 바꾸기(흰 벽을 버들항 벽 밝기 안으로)
            old = [hexrgb(h) for h in self.ramps[ramp]]; new = [hexrgb(h) for h in tones]; table = {o: new[min(i, len(new) - 1)] for i, o in enumerate(old)}
            for key, im in self.parts.items():
                a = np.array(im); rgb = a[:, :, :3]
                for o, n in table.items(): a[(rgb == o).all(axis=2) & (a[:, :, 3] > 0), :3] = n
                self.parts[key] = Image.fromarray(a, "RGBA")
            self.ramps[ramp] = list(tones)
        self.ramps.update(self.cfg.get("extra") or {})
        self.index = {}
        for ramp, tones in self.ramps.items():
            for i, h in enumerate(tones): self.index.setdefault(hexrgb(h), (ramp, i))
        self.fix_parts()

    @staticmethod
    def rgb(h): return hexrgb(h)

    def tone(self, ramp, i):
        tones = self.ramps[ramp]; return hexrgb(tones[max(0, min(len(tones) - 1, i))]) + (255,)

    def shift(self, px, d):
        """그 색을 같은 재료 줄에서 d 단 옮긴 색(줄에 없는 색은 그대로)."""
        hit = self.index.get(tuple(px[:3]))
        return self.tone(hit[0], hit[1] + d) if hit else tuple(px)

    def move(self, im, moves, src_ramps=None, rows=None):
        """줄 옮기기: moves {원래 줄: 새 줄} — 화소를 새 줄의 같은 자리 단으로(길이가 다르면 비율로). rows=(y0, y1) 이면 그 줄만."""
        src = src_ramps or self.ramps; table = {}
        for a_name, b_name in moves.items():
            if a_name not in src or b_name not in self.ramps: continue
            A = src[a_name]; B = self.ramps[b_name]
            for i, h in enumerate(A): table.setdefault(hexrgb(h), hexrgb(B[int(round(i * (len(B) - 1) / max(1, len(A) - 1)))]))
        a = np.array(im); out = a.copy(); rgb = a[:, :, :3]; mask_rows = np.zeros(a.shape[:2], bool)
        if rows: mask_rows[rows[0]:rows[1]] = True
        else: mask_rows[:] = True
        for o, n in table.items(): out[(rgb == o).all(axis=2) & (a[:, :, 3] > 0) & mask_rows, :3] = n
        return Image.fromarray(out, "RGBA")

    def shift_ramp(self, im, ramp, d):
        """그 줄의 화소만 d 단 옮긴다(지붕 둘째 색조가 지붕창·환기탑·둥근 지붕에도 닿게)."""
        if not d: return im
        a = im.copy(); px = a.load()
        for y in range(a.height):
            for x in range(a.width):
                if px[x, y][3] and self.index.get(tuple(px[x, y][:3]), ("", 0))[0] == ramp: px[x, y] = self.shift(px[x, y], d)
        return a

    def fix_parts(self):
        # 코드로 손댄 부품: 둥근 탑 벽의 밑동은 지시한 곡선(맨 아랫줄 12~27열 · 그 위 두 줄 6~33열 · 그 위 두 줄 전폭)만 남긴다 — 답의 줄 길이가 한두 자 어긋난 판이 있다.
        shaft = self.parts.get("tower-shaft")
        if shaft is not None:
            a = np.array(shaft); ink = np.array(self.tone("ink", 2), np.uint8)
            for y in range(48):  # 줄 길이가 어긋나 생긴 구멍은 왼쪽 이웃 화소로 메우고, 양옆 윤곽 열을 다시 세운다
                lo, hi = (0, 40) if y < 44 else (6, 34) if y < 46 else (12, 28)
                for x in range(lo, hi):
                    if a[y, x, 3] == 0: a[y, x] = a[y, x - 1] if x > lo and a[y, x - 1, 3] else a[y - 1, x]
                a[y, :lo] = 0; a[y, hi:] = 0
                if y < 44: a[y, 0] = ink; a[y, 39] = ink
                else: a[y, lo] = ink; a[y, hi - 1] = ink
            self.parts["tower-shaft"] = Image.fromarray(a, "RGBA")


def plaster_tile(S, ramp, base, seed):
    """잔 점 회벽 32x32(이음매 없음): 바탕 한 색에 한 단 어두운 잔 점(약 4%)과 한 단 밝은 짧은 흙손 자국 — 버들항 목골 집 벽의 결. 구름 얼룩 없음."""
    rng = random.Random(seed); im = Image.new("RGBA", (32, 32), S.tone(ramp, base)); px = im.load(); used = set()
    for _ in range(42):
        x, y = rng.randrange(32), rng.randrange(32)
        if any(((x + dx) % 32, (y + dy) % 32) in used for dx in (-1, 0, 1) for dy in (-1, 0, 1)): continue
        used.add((x, y)); px[x, y] = S.tone(ramp, base - 1)
    for _ in range(5):
        x, y = rng.randrange(32), rng.randrange(32)
        if any(((x + dx) % 32, (y + dy) % 32) in used for dx in (-1, 0, 1, 2) for dy in (-1, 0, 1)): continue
        for dx in (0, 1): used.add(((x + dx) % 32, y)); px[(x + dx) % 32, y] = S.tone(ramp, base + 1)
    return im


def tile_fill(src, w, h, ox=0, oy=0):
    out = Image.new("RGBA", (w, h)); sw, sh = src.size
    for y in range(-((oy % sh)), h, sh):
        for x in range(-((ox % sw)), w, sw): out.paste(src, (x, y))
    return out


def shade(S, im, box, d):
    a = im.load(); x0, y0, x1, y1 = box
    for y in range(max(0, y0), min(im.height, y1)):
        for x in range(max(0, x0), min(im.width, x1)):
            if a[x, y][3] == 255: a[x, y] = S.shift(a[x, y], d)


def roof_image(S, w, R, ox=0, tone=0):
    """직사각형 지붕 w x R: 용마루 5줄 + 단(4줄씩) + 처마 3줄. R = 8 + 4k. tone = 지붕 색조(변형, 단).

    빛 흐름(같은 줄 안에서만 옮긴다 — 윤곽은 직사각형 그대로): 용마루 윗줄 두 단·둘째 줄 한 단 밝게 · 맨 위 단(여섯 단 이상이면 두 단) 한 단 밝게 · 셋째 단마다 아랫줄(단 그림자) 한 단 어둡게 ·
    맨 아래 단 한 단 어둡게 · 처마 밑줄 한 단 어둡게.
    """
    src = S.parts["roof"]; ridge = src.crop((0, 0, 32, 5)); field = src.crop((0, 5, 32, 37)); eave = src.crop((0, 37, 32, 40))
    fh = R - 8; assert fh >= 4 and fh % 4 == 0, R
    tall = tile_fill(field, 32, fh + 32, 0, 0).crop((0, (32 - fh % 32) % 32, 32, (32 - fh % 32) % 32 + fh)) if fh % 32 else tile_fill(field, 32, fh)
    col = Image.new("RGBA", (32, R)); col.paste(ridge, (0, 0)); col.paste(tall, (0, 5)); col.paste(eave, (0, 5 + fh))
    out = tile_fill(col, w, R, ox, 0)
    n = fh // 4
    shade(S, out, (0, 1, w, 3), +1); shade(S, out, (0, 1, w, 2), +1)
    if n >= 3: shade(S, out, (0, 5, w, 8), +1)
    if n >= 6: shade(S, out, (0, 9, w, 12), +1)
    for k in range(2, n - 1, 3): shade(S, out, (0, 5 + k * 4 + 3, w, 5 + k * 4 + 4), -1)
    if n >= 2: shade(S, out, (0, 5 + (n - 1) * 4, w, 5 + n * 4), -1)
    shade(S, out, (0, R - 2, w, R - 1), -1)
    if tone: shade(S, out, (0, 0, w, R), tone)
    a = out.load(); ink = S.tone("ink", 1)
    for y in range(R):
        a[0, y] = ink; a[w - 1, y] = ink
        if 0 < y < R - 1:
            a[1, y] = S.shift(a[1, y], +1) if a[1, y] != ink else a[1, y]
            a[w - 2, y] = S.shift(a[w - 2, y], -1) if a[w - 2, y] != ink else a[w - 2, y]
    for x in range(w): a[x, 0] = ink; a[x, R - 1] = ink
    return out


def wall_texture(S, kind, seed):
    """벽 재질 한 장(이어 붙이는 무늬)과 기초 띠(없으면 None). kind = body · alt · lean."""
    cfg = S.cfg; spec = cfg["body"] if kind == "body" else cfg["alt"] if kind == "alt" else cfg["lean"]
    if kind == "lean" and spec in ("body", "alt"): return wall_texture(S, spec, seed)
    foot = S.parts["wall"].crop((0, 32, 32, 40))
    if isinstance(spec, tuple) and spec[0] == "code": tex = plaster_tile(S, spec[1], spec[2], f"{S.name}|{spec[1]}")
    elif isinstance(spec, tuple) and spec[0] == "remap": tex = S.move(S.parts["wall"].crop((0, 0, 32, 32)), spec[1])
    elif spec == "wall": tex = S.parts["wall"].crop((0, 0, 32, 32))
    else: tex = S.parts[spec]
    has_foot = kind == "body" or (kind == "alt" and cfg["altFoot"])
    return tex, (foot if has_foot else None)


def wall_image(S, w, h, kind, ox=0, plinth=True, seed=""):
    """앞벽 w x h: 재질 + 아래 기초 8줄(있으면) + 옆 윤곽 + 처마 밑 그늘 띠."""
    tex, foot = wall_texture(S, kind, seed)
    out = tile_fill(tex, w, h, ox, 7 if foot is not None else -(h % tex.height))
    if foot is not None and plinth and h >= 16: out.paste(tile_fill(foot, w, 8, ox, 0), (0, h - 8))
    else: ImageDraw.Draw(out).line((0, h - 1, w, h - 1), fill=S.tone("ink", 0))
    # 처마 밑 그늘 띠: 두 줄은 두 단, 그 아래 세 줄은 한 단 어둡게 — 지붕이 벽 위에 얹힌 깊이.
    shade(S, out, (0, 0, w, 2), -2); shade(S, out, (0, 2, w, 5), -1)
    shade(S, out, (w - 3, 0, w - 1, h - 1), -1)
    a = out.load(); ink = S.tone("ink", 2)
    for y in range(h): a[0, y] = ink; a[w - 1, y] = ink
    return out


def paste(dst, part, x, y):
    dst.alpha_composite(part, (int(x), int(y))) if 0 <= x and 0 <= y and x + part.width <= dst.width and y + part.height <= dst.height else dst.alpha_composite(
        part.crop((max(0, -int(x)), max(0, -int(y)), min(part.width, dst.width - int(x)), min(part.height, dst.height - int(y)))), (max(0, int(x)), max(0, int(y))))


def storeys(wall_h):
    return 1 if wall_h < 54 else 2 if wall_h < 88 else 3


def spread(lo, hi, width, gap, limit=9):
    """[lo, hi) 안에 폭 width 를 gap 이상 띄워 고르게 놓은 왼쪽 x 들."""
    span = hi - lo
    n = min(limit, (span + gap) // (width + gap))
    if n <= 0: return []
    free = span - n * width; step = free / (n + 1)
    return [int(round(lo + step * (i + 1) + width * i)) for i in range(int(n))]


class Builder:
    def __init__(self, S, kit, seed, variant=0):
        self.S = S; self.kit = kit; self.w = kit["w"] * T; self.h = kit["h"] * T; self.v = VARIANTS[variant]; self.vi = variant
        self.im = Image.new("RGBA", (self.w, self.h)); self.rng = random.Random(seed); self.roofs = []; self.notes = []
        self.rt = self.v["roof"]; cfg = S.cfg
        accent = cfg["accents"][self.v["accent"]]
        self.parts = dict(S.parts)
        for name in ACCENT_PARTS:  # 문·덧문 색(변형): 칠 줄 → 그 변형의 줄
            if name in self.parts and accent != "paint": self.parts[name] = S.move(self.parts[name], {"paint": accent})
        for name in ("dormer", "cupola", "tower-cap"):  # 지붕 둘째 색조는 지붕창·환기탑·둥근 지붕에도
            if name in self.parts: self.parts[name] = S.shift_ramp(self.parts[name], cfg["roofR"], self.rt)

    def kinds(self, mat, ground, n):
        """(위층 벽, 아래층 벽) — 벌의 재질 규칙 + 변형."""
        cfg = self.S.cfg; base = "body" if mat == "plaster" else cfg["rough"]
        two = ground == "stone"
        if self.v["flip"] and n >= 2 and mat == "plaster": two = not two
        if n >= 2 and two and cfg["two"] != "same": return ("alt", "body") if cfg["two"] == "alt-up" else (base, "alt")
        if n == 1 and self.v["alt1"] and mat == "plaster": return ("alt", "alt")
        if n >= 2 and self.v["alt1"] and cfg["two"] == "same" and mat == "plaster": return ("alt", "alt")
        return (base, base)

    # ── 덩어리 ──
    def block(self, c0, c1, r0, r1, door=None, mat="plaster", R=None, shop=None, sign=None, chim=(), flue=(), dormers=0, cupola=None, vane=None, wins="mix", barn=False, hoist=False,
              inset=2, y0=None, upper=None, ground=None, door_bottom=None, nowin=False, behind=()):
        S = self.S; P = self.parts; x0, x1 = c0 * T, c1 * T; y0 = r0 * T if y0 is None else y0; y1 = r1 * T; w = x1 - x0; hb = y1 - y0
        if R is None: R = 44 if (w >= 128 and hb >= 96) else 40 if hb >= 96 else 36 if hb >= 76 else 32 if hb >= 60 else 24 if hb >= 44 else 20
        wall_h = hb - R; wx0 = x0 + inset; ww = w - 2 * inset
        n = storeys(wall_h); base = wall_h // n; hs = [base] * n; hs[-1] += wall_h - base * n  # 위층부터, 나머지는 1층에
        tops = [y0 + R + sum(hs[:i]) for i in range(n)]
        up, down = self.kinds(mat, ground, n); ox = self.rng.randrange(32)
        self.im.alpha_composite(wall_image(S, ww, wall_h, up, ox=ox), (wx0, y0 + R))
        if down != up:
            g = wall_image(S, ww, hs[-1], down, ox=self.rng.randrange(32)); shade(S, g, (0, 0, ww, 5), +1); shade(S, g, (0, 0, ww, 2), +1)  # 처마 그늘은 맨 위층에만
            ink = S.tone("ink", 2)
            for y in range(hs[-1]): g.putpixel((0, y), ink); g.putpixel((ww - 1, y), ink)
            self.im.paste(g, (wx0, tops[-1]))
        foot_h = 8 if wall_texture(S, down, "")[1] is not None else 4
        band = S.cfg["band"]
        for i in range(1, n):  # 층 띠
            for x in range(wx0 + 1, wx0 + ww - 1):
                self.im.putpixel((x, tops[i] - 1), S.tone(band[0], band[1])); self.im.putpixel((x, tops[i]), S.tone(band[0], band[2]))
        # 1층: 문 · 간판 · 가게 창 · 창
        gy1 = y1 if door_bottom is None else door_bottom
        gtop = y1 - foot_h + (0 if foot_h == 8 else -2)
        lo, hi = wx0 + 4, wx0 + ww - 4

        def gaps(busy):
            free = []; cur = lo
            for a, b in sorted(busy):
                if a - cur > 0: free.append((cur, min(a, hi)))
                cur = max(cur, b)
            if hi - cur > 0: free.append((cur, hi))
            return free

        busy = [(a * T - 2, b * T + 2) for a, b in behind]; sign_at = None  # 앞 날개채에 가리는 폭에는 1층 창을 두지 않는다
        if barn:
            bd = P["barndoor"]; bx = x0 + door * T + (2 * T - bd.width) // 2; paste(self.im, bd, bx, gy1 - bd.height); busy.append((bx - 3, bx + bd.width + 3))
        elif door is not None:
            d = P["door"]; dx = door * T + (T - d.width) // 2; paste(self.im, d, dx, gy1 - d.height); busy.append((dx - 4, dx + d.width + 4))
            if sign is not None:
                sf_w = P["shopfront"].width if shop else 0
                right = (dx + d.width + 1, gy1 - d.height - 6); left = (dx - 17, gy1 - d.height - 6); above = (dx - 1, gy1 - d.height - 15)
                order = [right, left] if dx + d.width + 17 <= wx0 + ww - 2 else [left, right]
                fits = lambda at: at[0] >= wx0 + 1 and at[0] + 16 <= wx0 + ww - 1 and (not shop or any(b - a >= sf_w for a, b in gaps(busy + [(at[0] - 1, at[0] + 17)])))
                sign_at = next((at for at in order if fits(at)), None)
                if sign_at is None and above[1] >= tops[-1] + 3: sign_at = above  # 가게 창 자리가 모자라면 간판은 문 위에
                if sign_at is None: sign_at = order[0]
                if sign_at is not above: busy.append((sign_at[0] - 1, sign_at[0] + 17))
        free = gaps(busy)
        if shop:
            sf = P["shopfront"]; cands = [iv for iv in free if iv[1] - iv[0] >= sf.width]
            cands.sort(key=lambda iv: iv[0], reverse=(shop == "R"))
            if cands:
                iv = cands[0]; sx = iv[0] + (iv[1] - iv[0] - sf.width) // 2; paste(self.im, sf, sx, gtop - sf.height + 2)
                free = [f for f in free if f != iv] + [(iv[0], sx - 3), (sx + sf.width + 3, iv[1])]
            else: self.notes.append("가게 창 자리 없음")
        if not nowin:
            pick = self.v["wins"] if wins == "mix" and self.v["wins"] else wins
            kind = pick if pick in ("shutter", "box", "plain", "arch") else self.rng.choice(["shutter", "shutter", "box"])
            gpart = P[{"shutter": "win-shutter", "box": "win-box", "plain": "win-plain", "arch": "win-arch"}[kind]]
            for a, b in free:
                p = gpart if b - a >= gpart.width + 2 else P["win-plain"]
                for x in spread(a, b, p.width, 8, limit=3 if p is gpart else 2):
                    top = tops[-1] + max(5, (hs[-1] - foot_h - p.height) // 2 + 1)
                    paste(self.im, p, x, top)
            # 위층 창
            for i in range(n - 1):
                ukind = upper or (self.v["wins"] if self.vi == 2 else None) or self.rng.choice(["plain", "plain", "box", "shutter"])
                p = P[{"shutter": "win-shutter", "box": "win-box", "plain": "win-plain", "arch": "win-arch"}[ukind]]
                xs = spread(lo, hi, p.width, 10 if ukind != "shutter" else 6, limit=max(1, ww // 30))
                if hoist and i == 0:
                    hp = P["hoist"]; hx = x0 + (w - hp.width) // 2; paste(self.im, hp, hx, tops[0] + max(2, (hs[0] - hp.height)))
                    xs = [x for x in xs if x + p.width < hx - 2 or x > hx + hp.width + 2]
                for x in xs: paste(self.im, p, x, tops[i] + max(6, (hs[i] - p.height) // 2 + 1))
        if sign_at is not None:  # 간판은 맨 나중(창·화분에 가리지 않게)
            sg = P["signs"].crop(((sign % 3) * 16, (sign // 3) * 16, (sign % 3) * 16 + 16, (sign // 3) * 16 + 16)); paste(self.im, sg, sign_at[0], sign_at[1])
        # 지붕
        self.im.alpha_composite(roof_image(S, w, R, ox=self.rng.randrange(32), tone=self.rt), (x0, y0))
        self.roofs.append({"x": x0, "y": y0, "w": w, "h": R, "bodyH": hb})
        for i in range(dormers):
            dp = P["dormer"]; xs = spread(x0 + 6, x1 - 6, dp.width, 14, limit=dormers)
            for x in xs: paste(self.im, dp, x, y0 + R - dp.height - 6)
            break
        if self.v["flue"] and not chim and not flue and cupola is None and vane is None and not dormers:
            cx = x0 + (w * 2 // 3)  # 변형의 작은 굴뚝 — 지붕 위 칸이 원본에도 있는 집에만(없으면 잘려 밑동만 남는다)
            if y0 >= T and self.kit["cells"][(y0 - 1) // T][cx // T] is not None and self.kit["cells"][(y0 - 1) // T][(cx - 4) // T] is not None: flue = [cx]
        for cx in chim: p = P["chimney"]; paste(self.im, p, cx - p.width // 2, y0 + 4 - p.height)
        for cx in flue: p = P["flue"]; paste(self.im, p, cx - p.width // 2, y0 + 4 - p.height)
        if cupola is not None: p = P["cupola"]; paste(self.im, p, cupola - p.width // 2, y0 + 2 - p.height)
        if vane is not None: self.vane(vane, y0)
        return {"x0": x0, "x1": x1, "y0": y0, "y1": y1, "R": R, "wall_top": y0 + R}

    def vane(self, cx, y0):
        """용마루 풍향계(코드 도트 11x15)."""
        S = self.S; ink = S.tone("ink", 1); st = S.tone("stone", 3); a = self.im
        for y in range(y0 - 13, y0 + 1): a.putpixel((cx, y), ink)
        for x in range(cx - 5, cx + 6): a.putpixel((x, y0 - 10), st if abs(x - cx) > 1 else ink)
        for dx, dy in ((5, -11), (5, -9), (4, -12), (4, -8), (-5, -11), (-5, -9)): a.putpixel((cx + dx, y0 + dy), st)
        for dx, dy in ((-1, -15), (0, -15), (1, -15), (-2, -14), (2, -14), (0, -14), (1, -14), (-1, -14)): a.putpixel((cx + dx, y0 + dy), S.tone("clay", 2) if dy == -14 else S.tone("clay", 1))

    def leanto(self, c0, c1, r0, r1, flue=None):
        """곁채(달개집): 낮은 직사각 지붕 + 곁채 벽."""
        S = self.S; x0, x1, y0, y1 = c0 * T, c1 * T, r0 * T, r1 * T; w = x1 - x0; R = 16 if y1 - y0 <= 48 else 20
        self.im.alpha_composite(wall_image(S, w - 2, y1 - y0 - R, "lean", ox=self.rng.randrange(16), plinth=False), (x0, y0 + R))
        if w >= 28:  # 헛간 문(널문, 코드): 어두운 문틀 + 가로 띠
            dx = x0 + (w - 12) // 2; d = ImageDraw.Draw(self.im); d.rectangle((dx, y1 - 20, dx + 11, y1 - 2), fill=S.tone("wood", 1), outline=S.tone("ink", 2))
            for yy in (y1 - 16, y1 - 8): d.line((dx + 1, yy, dx + 10, yy), fill=S.tone("wood", 3))
        self.im.alpha_composite(roof_image(S, w, R, ox=self.rng.randrange(32), tone=self.rt), (x0, y0))
        self.roofs.append({"x": x0, "y": y0, "w": w, "h": R, "bodyH": y1 - y0})
        if flue is not None: p = self.parts["flue"]; paste(self.im, p, flue - p.width // 2, y0 + 4 - p.height)

    def wing(self, c0, c1, r1, wall_h, door=None, R=20, wins="plain", mat="plaster"):
        """앞으로 나온 날개채(현관채): 본채 벽 앞에 벽 wall_h 와 낮은 지붕 R. 본채 벽에 지붕 그림자를 떨군다."""
        S = self.S; x0, x1, y1 = c0 * T, c1 * T, r1 * T; w = x1 - x0; y0 = y1 - wall_h - R
        kind = self.kinds(mat, None, 1)[0]
        shade(S, self.im, (x1 - 2, y0 + 2, x1 + 2, y1 - wall_h + 40), -1)  # 날개채가 본채 벽에 떨구는 그림자(빛은 왼쪽 위)
        self.im.alpha_composite(wall_image(S, w - 4, wall_h, kind, ox=self.rng.randrange(32)), (x0 + 2, y1 - wall_h))
        busy = []
        if door is not None:
            d = self.parts["door"]; dx = door * T + (T - d.width) // 2; paste(self.im, d, dx, y1 - d.height); busy.append((dx - 3, dx + d.width + 3))
        cur = x0 + 5
        foot_h = 8 if wall_texture(S, kind, "")[1] is not None else 4
        for a, b in sorted(busy) + [(x1 - 5, x1)]:
            p = self.parts["win-plain"]
            for x in spread(cur, a, p.width, 6, limit=2): paste(self.im, p, x, y1 - wall_h + max(6, (wall_h - foot_h - p.height) // 2 + 1))
            cur = b
        self.im.alpha_composite(roof_image(S, w, R, ox=self.rng.randrange(32), tone=self.rt), (x0, y0))
        self.roofs.append({"x": x0, "y": y0, "w": w, "h": R, "bodyH": wall_h + R})

    def breast(self, c, r0, r1, shoulder, side="R"):
        """옆벽 바깥 돌 굴뚝: 한 칸 폭 — 어깨(shoulder y) 아래는 넓고 위는 좁은 굴뚝."""
        S = self.S; x0, y0, y1 = c * T, r0 * T, r1 * T
        tex = wall_texture(S, S.cfg["rough"], "")[0]
        if S.cfg["two"] == "same": tex = S.parts["wall"].crop((0, 34, 32, 39))  # 널벽 집의 굴뚝은 돌 — 기초 띠의 막돌 다섯 줄을 쌓는다
        st = tile_fill(tex, 16, y1 - y0, self.rng.randrange(32), self.rng.randrange(32)); a = st.load(); ink = S.tone("ink", 2)
        for y in range(y1 - y0):
            wide = (y0 + y) >= shoulder; l, r = ((0, 13) if wide else (0, 10)) if side == "R" else ((2, 15) if wide else (5, 15))
            for x in range(16):
                if x < l or x > r: a[x, y] = (0, 0, 0, 0)
                elif x in (l, r): a[x, y] = ink
                elif x == r - 1 or x == r - 2: a[x, y] = S.shift(a[x, y], -1)
            if (y0 + y) == shoulder:
                for x in (range(11, 14) if side == "R" else range(2, 5)): a[x, y] = ink
        for x in (range(0, 12) if side == "R" else range(4, 16)):  # 굴뚝 머리
            a[x, 0] = ink; a[x, 1] = S.tone("stone", 5); a[x, 2] = S.tone("stone", 4); a[x, 3] = S.tone("stone", 1)
        for x in range(16): a[x, y1 - y0 - 1] = S.tone("ink", 0) if a[x, y1 - y0 - 1][3] else (0, 0, 0, 0)
        self.im.alpha_composite(st, (x0, y0))

    def tower(self, c0, r1, cap_y, kind="keep"):
        """둥근 탑(세 칸 폭): 위에서 본 원형 지붕 + 원통 벽. keep = 망루 집 탑(창 줄) · mill = 방앗간 탑(몸통 재질이 다르고, 지붕 한 단 어둡고, 창 대신 짐 문)."""
        S = self.S; x0, y1 = c0 * T, r1 * T; cap = self.parts["tower-cap"]; sh = S.parts["tower-shaft"]
        if kind == "mill": sh = S.move(sh, S.cfg["mill"], rows=(0, 32)); cap = S.shift_ramp(cap, S.cfg["roofR"], -1)
        top = cap_y + 24; body = y1 - top
        shaft = Image.new("RGBA", (40, body)); base = sh.crop((0, 32, 40, 48)); rep = tile_fill(sh.crop((0, 0, 40, 32)), 40, max(1, body - 16), 0, 0)
        shaft.paste(rep, (0, 0)); shaft.paste(base, (0, body - 16))
        self.im.alpha_composite(shaft, (x0 + 4, top))
        if kind == "mill":
            hp = self.parts["hoist"]; paste(self.im, hp, x0 + 4 + (40 - hp.width) // 2, cap_y + 44)
        else:
            wp = self.parts["win-plain"]
            for wy in range(cap_y + 46, y1 - 34, 30): paste(self.im, wp, x0 + 4 + 12, wy)
        shade(S, self.im, (x0 + 5, cap_y + 36, x0 + 43, cap_y + 38), -2); shade(S, self.im, (x0 + 5, cap_y + 38, x0 + 43, cap_y + 41), -1)
        self.im.alpha_composite(cap, (x0, cap_y))
        self.roofs.append({"x": x0 + 1, "y": cap_y + 6, "w": 46, "h": 32, "bodyH": y1 - cap_y - 6, "round": True})

    def cross(self, cx, y):
        S = self.S; a = self.im
        for yy in range(y, y + 12): a.putpixel((cx, yy), S.tone("stone", 4)); a.putpixel((cx + 1, yy), S.tone("stone", 2))
        for xx in range(cx - 3, cx + 5): a.putpixel((xx, y + 3), S.tone("stone", 4)); a.putpixel((xx, y + 4), S.tone("stone", 2))

    def belfry(self, x, y):
        paste(self.im, self.parts["belfry"], x, y)


def specs(b, key):
    """그림 열쇠마다 조립 순서(뒤 → 앞). 좌표는 칸."""
    k = b.kit; W, H = k["w"], k["h"]; d = k["door"]; dc = d["dx"] if d else None
    s = key.replace("bd-house-", "")
    if s in ("h101_0", "h102_0"):
        b.block(0, 5, 1, 6, door=dc, mat="stone" if s == "h102_0" else "plaster", dormers=1); b.leanto(5, 7, 3, 6, flue=88)
    elif s == "h101_1": b.block(0, 6, 1, 6, door=dc, dormers=1)
    elif s == "h102_1": b.block(0, 5, 1, 8, door=dc, ground="stone")
    elif s == "h103_1": b.block(0, 5, 1, 6, door=dc, chim=[32], flue=[58])
    elif s == "h103_2": b.block(0, 5, 1, 6, door=dc, dormers=1, wins="box")
    elif s == "h104_0": b.block(0, 7, 1, 8, door=dc, dormers=2, ground="stone")
    elif s == "h106_1": b.block(0, 6, 1, 8, door=dc, shop="L", sign=2)
    elif s == "h107_0": b.block(0, 6, 1, 6, door=dc, wins="shutter")
    elif s == "h107_1": b.block(0, 7, 2, 8, door=dc, chim=[32, 80], vane=56, shop="L")
    elif s == "h109_1": b.block(0, 7, 1, 6, door=None, dormers=1, behind=[(0, 3)]); b.breast(7, 2, 6, 16 + 36, "R"); b.wing(0, 3, 8, 32, door=dc)
    elif s == "h111_0": b.block(0, 7, 2, 8, door=dc, chim=[32, 80], vane=56, shop="L", sign=1, ground="stone")
    elif s == "h111_1": b.block(0, 5, 1, 8, door=dc, chim=[32], flue=[58], sign=1)
    elif s == "h112_0": b.block(0, 4, 1, 6, door=dc, chim=[32])
    elif s == "h116_0": b.block(0, 5, 1, 8, door=dc, sign=2, dormers=1)
    elif s == "h117_1": b.block(0, 4, 1, 8, door=dc, chim=[32])
    elif s == "h120_0": b.block(0, 7, 1, 6, door=dc, dormers=2, wins="shutter")
    elif s == "h122_0": b.block(1, 8, 1, 6, door=None, dormers=2, behind=[(3, 6)]); b.breast(0, 2, 6, 16 + 36, "L"); b.breast(8, 2, 6, 16 + 36, "R"); b.wing(3, 6, 8, 32, door=dc)
    elif s == "h123_1": b.block(0, 6, 1, 6, door=dc, shop="L", sign=3)
    elif s == "h131_0": b.block(0, 6, 1, 6, door=dc, shop="R", sign=4)
    elif s == "h134_0": b.block(0, 5, 1, 6, door=dc, chim=[32], flue=[58], sign=5, wins="box")
    elif s == "h135_0": b.block(0, 5, 1, 6, door=dc, mat="stone", dormers=1)
    elif s == "inn": b.block(0, 8, 2, 8, door=dc, R=40, chim=[32, 96], cupola=64, sign=0, ground="stone", upper="shutter")
    elif s == "h124_0":
        b.block(1, 8, 1, 8, door=None, chim=[32, 96], flue=[56, 120], ground="stone", behind=[(1, 4), (5, 8)]); b.breast(0, 2, 8, 16 + 40, "L"); b.breast(8, 2, 8, 16 + 40, "R")
        b.wing(1, 4, 9, 32, door=dc); b.wing(5, 8, 9, 32, door=None)
    elif s == "h104_1": b.block(0, 8, 2, 8, door=dc, R=40, chim=[32, 96], vane=64, dormers=2, upper="box")
    elif s == "mk-tower-house": b.block(0, 6, 2, 8, door=dc, chim=[32], ground="stone"); b.tower(6, 8, 10, "keep")
    elif s == "mk-chapel":
        b.block(1, 8, 3, 8, door=None, wins="arch", R=36); b.breast(0, 4, 8, 48 + 36, "L")
        q = b.block(8, 11, 1, 8, door=None, R=28, nowin=True, inset=1, mat="stone"); b.belfry(8 * T + 14, q["wall_top"] + 8); b.cross(9 * T + 7, 4)
        p = b.parts["win-arch"]; paste(b.im, p, 8 * T + 20, q["wall_top"] + 44)
        b.wing(1, 4, 9, 32, door=dc, R=16)
    elif s == "mk-manor":
        b.block(0, 11, 0, 7, door=dc, R=44, upper="shutter", wins="shutter")
        b.wing(0, 3, 8, 64, R=20, wins="plain"); b.wing(8, 11, 8, 64, R=20, wins="plain")
    elif s == "bd-farm-barn": b.block(0, 6, 0, 6, door=dc, barn=True, mat="stone", R=40, nowin=True)
    elif s == "mk-tithe-barn": b.block(0, 12, 1, 6, door=dc, mat="stone", R=36, wins="plain")
    elif s == "mk-granary-mill": b.block(0, 7, 1, 7, door=dc, ground="stone"); b.tower(7, 7, 0, "mill")
    elif s == "mk-warehouse": b.block(0, 5, 1, 10, door=dc, hoist=True, ground="stone", upper="plain")
    else: raise SystemExit(f"조립 순서 없음: {key}")


def assemble(S, kit, key, variant=0):
    b = Builder(S, kit, seed=f"{S.name}|{key}" + (f"|{variant}" if variant else ""), variant=variant); specs(b, key)
    a = np.array(b.im); cleared = 0; empty_blocked = []; empty_other = 0
    for j, row in enumerate(kit["cells"]):
        for i, cell in enumerate(row):
            sl = a[j * T:(j + 1) * T, i * T:(i + 1) * T]
            if cell is None: cleared += int((sl[:, :, 3] > 0).sum()); sl[:] = 0
            elif "포석" in cell["label"]: sl[:] = 0  # 문 앞 포석 칸은 원본 칸을 그대로 쓴다(굽기가 원본 칸 번호를 남긴다)
            elif not (sl[:, :, 3] > 0).any():
                if cell["pass"]: empty_other += 1
                else: empty_blocked.append([i, j])
    im = Image.fromarray(a, "RGBA")
    roofs = []
    for r in b.roofs:
        limit = 48 if r["w"] >= 128 else 44; share = r["h"] / r["bodyH"]
        ok = r["h"] <= limit and (r["h"] <= 32 or share <= 0.55)
        roofs.append({**r, "share": round(share, 3), "limit": limit, "ok": ok})
    return im, {"key": key, "variant": variant, "kit": [kit["w"], kit["h"]], "roofs": roofs, "clearedPx": cleared, "emptyBlocked": empty_blocked, "emptyPassable": empty_other, "notes": b.notes}


def picture_name(key, variant): return f"{key}.png" if not variant else f"{key}.v{variant}.png"


def main():
    name = sys.argv[1]; S = Set(name)
    data = json.load(open(f"{DATA}/kits.json")); kits = {k["id"]: k for k in data["kits"]}
    os.makedirs(f"{S.dir}/pictures", exist_ok=True); report = []; ims = []; lum = 0
    for group in data["pictures"]:
        key = group[0]
        for variant in range(len(VARIANTS)):
            im, rep = assemble(S, kits[key], key, variant); rep["kits"] = group
            im.save(f"{S.dir}/pictures/{picture_name(key, variant)}"); report.append(rep); ims.append((key, variant, im, rep))
            bad = [r for r in rep["roofs"] if not r["ok"]]
            a = np.array(im); op = a[a[:, :, 3] == 255][:, :3].astype(float); top = float(np.percentile(op @ np.array([0.2126, 0.7152, 0.0722]), 99)) if len(op) else 0; lum = max(lum, top)
            if variant == 0 or bad or rep["notes"]:
                print(f"{key:28s} v{variant} {rep['kit'][0]}x{rep['kit'][1]} 지붕 {[(r['w'], r['h'], r['share']) for r in rep['roofs']]}{' 계약 위반!' if bad else ''} 지움 {rep['clearedPx']}px 빈 막힌 칸 {len(rep['emptyBlocked'])} {rep['notes'] or ''}")
    json.dump({"set": name, "variants": len(VARIANTS), "pictures": report}, open(f"{S.dir}/report.json", "w"), ensure_ascii=False, indent=1)
    print(f"{name}: 그림 {len(ims)} · 가장 밝은 그림의 99백분위 휘도 {lum:.0f}")
    if "--sheet" in sys.argv:
        out = sys.argv[sys.argv.index("--sheet") + 1]; hero = Image.open(sys.argv[sys.argv.index("--hero") + 1]).convert("RGBA") if "--hero" in sys.argv else None
        only = int(sys.argv[sys.argv.index("--variant") + 1]) if "--variant" in sys.argv else None
        Sx = 2; pad = 12; x = pad; y = pad; rowh = 0; Wd = 1500; pos = []
        for key, variant, im, rep in ims:
            if only is not None and variant != only: continue
            w = im.width * Sx + (30 * Sx if hero else 0)
            if x + w > Wd: x = pad; y += rowh + pad + 12; rowh = 0
            pos.append((key, variant, im, x, y)); x += w + pad; rowh = max(rowh, im.height * Sx)
        sheet = Image.new("RGBA", (Wd, y + rowh + pad + 14), (96, 140, 84, 255)); dr = ImageDraw.Draw(sheet)
        for key, variant, im, x, y in pos:
            sheet.alpha_composite(im.resize((im.width * Sx, im.height * Sx), Image.NEAREST), (x, y)); dr.text((x, y + im.height * Sx + 1), key.replace("bd-house-", "") + (f" v{variant}" if variant else ""), fill=(255, 255, 255, 255))
            if hero: sheet.alpha_composite(hero.resize((24 * Sx, 32 * Sx), Image.NEAREST), (x + im.width * Sx + 4, y + im.height * Sx - 32 * Sx))
        sheet.save(out); print("sheet", sheet.size)


if __name__ == "__main__":
    main()
