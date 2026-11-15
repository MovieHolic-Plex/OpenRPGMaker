#!/usr/bin/env python3
"""버들항 던전 겉가죽(bd-dgn-*)을 공용 버들항 시트의 제 토막(52,608~56,703, 고정 4,096칸)에 굽는다.

  python3 scripts/content/beodeul-dungeons/bake.py --dry     # 관문 상태와 칸 계획만
  python3 scripts/content/beodeul-dungeons/bake.py           # 굽는다
  python3 scripts/content/beodeul-dungeons/bake.py --check   # 다시 구워 지금 파일과 같은지만
  python3 scripts/content/beodeul-dungeons/bake.py --dev     # 관문 없이(커밋하지 않는다)

그림 정본: tiledata/beodeul-dungeon/fable/pieces/<id>.png — Claude Fable 5.2 medium 한 방(줄 문자열 → 잠긴 색 줄 ramps.json). 정의는 spec.json.
주제(theme) 하나 = 바닥 판(64px, 여러 장을 덩이마다 섞음) · 벽 앞면(64×56, 위 8줄은 입술) · 벽 너머 윗면(64px) · 남/서 테 띠 · (물가 못 64px + 안쪽 모서리 섬 32px) · 기물.
이 스크립트가 조각을 16px 칸으로 자르고 조립한다(모양은 그대로, 조립·색 줄 바꾸기·어둡게 내리기만 코드):
  · 바닥·앞면·물 몸통은 그대로 자른 칸. 앞면 위 입술 8줄은 천장 칸에 얹는 투명 덧칸(2층).
  · 윗면은 세 밝기(가까움 · 한 단 어둡게 · 두 단 어둡게), 테는 윗면 칸에 띠를 얹은 불투명 칸(북·동·서·북동·북서·모서리, 벽 앞면 곁 동·서).
  · 물가는 못 그림의 가장자리 12칸 + 섬 그림 4칸(안쪽 모서리) — 투명 덧칸(2층), 몸통 4칸은 1층.
  · 겉모습(look)은 같은 화소에 다른 색 줄(spec looks[].remap) — 벽 앞면·입술·테만 다시 굽는다.
  · 빛 띠(불·수정 둘레)는 그림이 아니라 반투명 단색 두 띠다 — 조각이 아니므로 관문 대상이 아니다.

3/4 관문(hard rule): 조각 그림마다 object-gate 출구 `require_all(context="bundle")` — 하나라도 막히면 아무것도 쓰지 않는다.
이 그림들은 **3/4 관문 미통과 — 오너 면제 묶음**(spec waiver, harness-data/object-gate/waivers)으로 출구를 지난다. 면제는 그림 화소 해시에 묶여 있다. 면제는 통과가 아니다.

칸 번호: 토막의 첫 칸은 52,608 로 못박혀 있다(실내 토막 48,512~52,607 뒤). 내 칸 [52,608, 56,704) 만 제자리에서 다시 쓰고 앞 꼬리의 칸과 킷은 건드리지 않는다.
시트가 52,608 보다 짧으면 빈 줄로 채운다(실내 굽기가 제 칸만 제자리에서 쓴다). 토막은 늘 4,096칸으로 채운다(빈 칸 포함) — 뒤에 올 토막의 번호가 움직이지 않는다.
쓰는 것: public/assets/beodeul-city/beodeul-city-chipset.png · src/assets/beodeulCityTileset.json · src/assets/beodeulCitySheet.json ·
tiledata/beodeul-dungeon/fable/catalog.json · src/assets/beodeulDungeonSkins.json(시공기가 읽는 표: 주제·겉모습마다 칸 번호, 갈아 끼울 기물, 덧놓을 기물).
"""
import argparse, hashlib, json, math, pathlib, sys
import numpy as np
from PIL import Image

HERE = pathlib.Path(__file__).resolve().parent
ROOT = HERE.parents[2]
sys.path.insert(0, str(ROOT / "src/harnesses/_core"))
SHEET_PATH = ROOT / "public/assets/beodeul-city/beodeul-city-chipset.png"
TS_PATH = ROOT / "src/assets/beodeulCityTileset.json"
SHEET_JSON = ROOT / "src/assets/beodeulCitySheet.json"
STORE = ROOT / "tiledata/beodeul-dungeon/fable"
CATALOG = STORE / "catalog.json"
TABLE = ROOT / "src/assets/beodeulDungeonSkins.json"
T, COLS, BASE, BLOCK = 16, 128, 52608, 4096
END = BASE + BLOCK
PREFIX = "bd-dgn-"
LABEL = "버들항 던전 겉가죽"
OPEN = {k: True for k in ("up", "down", "left", "right")}
SHUT = {k: False for k in ("up", "down", "left", "right")}
GATE_NOTE = "3/4 관문 미통과 — 오너 면제 그림."


def hx(c): return tuple(int(c[i:i + 2], 16) for i in (1, 3, 5))


class Bake:
    def __init__(self, spec, ramps):
        self.spec, self.ramps = spec, ramps
        self.tone = {}
        for r, cs in ramps.items():
            for i, c in enumerate(cs): self.tone.setdefault(hx(c), (r, i))
        self.cells = []       # (px, meta)
        self.kits = []
        self.pieces = {}
        self.seen = {}        # (kind, 화소) → 칸 번호: 같은 그림 칸은 한 번만 굽는다(주제끼리 빌려 쓰는 윗면·바닥·물가)

    def piece(self, pid):
        if pid not in self.pieces:
            self.pieces[pid] = np.array(Image.open(STORE / "pieces" / f"{pid}.png").convert("RGBA"))
        return self.pieces[pid].copy()

    def colour(self, name):
        r, t = name.split(":"); return hx(self.ramps[r][int(t)])

    def remap(self, a, table):
        """색 줄 바꾸기: table {옛 줄: 새 줄} — 같은 단 번호로."""
        if not table: return a
        a = a.copy(); mp = {}
        for src, dst in table.items():
            for i, c in enumerate(self.ramps[src]): mp[hx(c)] = hx(self.ramps[dst][min(i, len(self.ramps[dst]) - 1)])
        flat = a.reshape(-1, 4)
        for i in range(len(flat)):
            if flat[i, 3]:
                k = (int(flat[i, 0]), int(flat[i, 1]), int(flat[i, 2]))
                if k in mp: flat[i, :3] = mp[k]
        return a

    def shift(self, a, delta, only):
        """그 색 줄 화소를 delta 단 옮긴다(줄 끝에서 멈춤)."""
        a = a.copy(); flat = a.reshape(-1, 4)
        for i in range(len(flat)):
            k = self.tone.get((int(flat[i, 0]), int(flat[i, 1]), int(flat[i, 2])))
            if k and k[0] in only:
                cs = self.ramps[k[0]]; flat[i, :3] = hx(cs[max(0, min(len(cs) - 1, k[1] + delta))])
        return a

    def emit(self, px, kind, label, theme):
        """칸 하나를 토막에 더하고 번호를 돌려준다. kind: floor·wall·ceil·water·over(2층 덧칸)·glow·solid(기물 막힌 칸)·star(기물 윗칸)·decal."""
        assert px.shape == (T, T, 4), px.shape
        key = (kind, px.tobytes())
        if key in self.seen: return self.seen[key]
        n = self.seen[key] = BASE + len(self.cells)
        if n >= END: sys.exit(f"토막 {BLOCK}칸을 넘는다 — 겉모습·기물을 줄인다")
        tags = {"floor": ["floor", "바닥"], "wall": ["벽", "wall", "face"], "ceil": ["천장", "wall", "ceiling"], "water": ["water", "물"], "over": ["덧그림"], "glow": ["덧그림", "빛"],
                "solid": ["prop"], "star": ["prop"], "decal": ["prop", "바닥 그림"], "stair": ["stair", "계단"]}[kind]
        walk = kind in ("floor", "over", "glow", "star", "decal", "stair")
        self.cells.append((px, dict(pass_=OPEN if walk else SHUT, priority="upper" if kind in ("over", "star", "glow") else "lower",   # 빛 띠도 ★: 벽 앞면 칸에 깔린 빛이 그 칸을 걷는 칸으로 만들었다(관문을 돌아가는 길이 생김)
                                    label=f"{LABEL} · {label}", description=f"{label}. {GATE_NOTE if kind != 'glow' else '반투명 빛 띠(그림 아님).'}",
                                    tags=["버들항", "던전", "dungeon", f"dgn:{theme}", *tags], layer="lower" if kind in ("floor", "wall", "ceil", "water", "stair") else "upper",
                                    passage={"floor": "passable", "decal": "passable", "over": "star", "star": "star", "glow": "star", "stair": "passable"}.get(kind, "solid"))))
        return n

    def grid(self, a, kind, label, theme, cols, rows, ox=0, oy=0):
        return [[self.emit(a[oy + y * T:oy + (y + 1) * T, ox + x * T:ox + (x + 1) * T], kind, f"{label} ({x},{y})", theme) for x in range(cols)] for y in range(rows)]


def comp(base, over):
    out = base.copy(); m = over[:, :, 3] > 0; out[m] = over[m]; return out


def build_theme(B, th):
    tid, ko = th["id"], th["ko"]; out = dict(id=tid, ko=ko, types=th["types"], **({"lava": True} if th.get("lava") else {}), looks=[])
    sliver = B.colour(th["sliver"]); gap = B.colour(th["faceGap"])
    bw = th.get("borrow") or {}          # 다른 주제에서 빌린 조각(윗면·테·물가)을 이 주제의 색 줄로
    P = lambda pid: B.remap(B.piece(pid), bw)
    th = dict(th, topRamps=[bw.get(r, r) for r in th["topRamps"]])
    np_ = th.get("rimPhases", 4)
    tops = [P(p) for p in th["top"]]
    floors = [P(p) for p in th["floor"]]
    common = dict(
        floor=[[n for row in B.grid(f, "floor", f"{ko} 바닥 {i + 1}", tid, 4, 4) for n in row] for i, f in enumerate(floors)],
        top=[[[n for row in B.grid(B.shift(tp, -d * th.get("fadeStep", 1), th["topRamps"]) if d else tp, "ceil", f"{ko} 벽 너머 {i + 1}·{d}", tid, 4, 4) for n in row] for i, tp in enumerate(tops)] for d in (0, 1)]
            + [[[n for row in B.grid(B.shift(tp, -2 * th.get("fadeStep", 1), th["topRamps"]), "ceil", f"{ko} 벽 너머 깊은 곳 {i + 1}", tid, 4, 4) for n in row] for i, tp in enumerate(tops)] if th.get("deepFull")
               else [[n for row in B.grid(B.shift(tops[0], -2 * th.get("fadeStep", 1), th["topRamps"]), "ceil", f"{ko} 벽 너머 깊은 곳", tid, 2, 2) for n in row]]],
    )
    if th.get("bridge"):
        common["bridge"] = {d: B.emit(P(f"br-{th['bridge']}-{d}"), "floor", f"{ko} 다리 {d}", tid) for d in ("ew", "ns")}
    if th.get("shore"):
        sh, si = P(th["shore"]), P(th["shoreIn"])
        if th.get("water"): common["water"] = [n for row in B.grid(P(th["water"]), "water", f"{ko} 물", tid, 4, 4) for n in row]
        else: common["water"] = [n for row in B.grid(sh[T:3 * T, T:3 * T], "water", f"{ko} 물", tid, 2, 2) for n in row]
        shore = []
        for y in range(4):
            for x in range(4):
                shore.append(-1 if (x in (1, 2) and y in (1, 2)) else B.emit(sh[y * T:(y + 1) * T, x * T:(x + 1) * T], "over", f"{ko} 물가 ({x},{y})", tid))
        common["shore"] = shore
        common["shoreIn"] = [B.emit(si[y * T:(y + 1) * T, x * T:(x + 1) * T], "over", f"{ko} 물가 안쪽 모서리 ({x},{y})", tid) for y in range(2) for x in range(2)]
        cell = lambda x, y: sh[y * T:(y + 1) * T, x * T:(x + 1) * T]
        def vcell(cy):
            o = np.zeros((T, T, 4), np.uint8); o[:, :8] = cell(0, cy)[:, 5:13]; o[:, 8:] = cell(3, cy)[:, 3:11]; return o
        def hcell(cx):
            o = np.zeros((T, T, 4), np.uint8); o[:8] = cell(cx, 0)[4:12]; o[8:] = cell(cx, 3)[3:11]; return o
        dot = np.zeros((T, T, 4), np.uint8); dot[:8, :8] = cell(0, 0)[4:12, 5:13]; dot[:8, 8:] = cell(3, 0)[4:12, 3:11]; dot[8:, :8] = cell(0, 3)[3:11, 5:13]; dot[8:, 8:] = cell(3, 3)[3:11, 3:11]
        common["narrow"] = dict(v=[B.emit(vcell(k), "over", f"{ko} 좁은 물줄기 세로 {k}", tid) for k in range(4)], h=[B.emit(hcell(k), "over", f"{ko} 좁은 물줄기 가로 {k}", tid) for k in range(4)],
                                dot=B.emit(dot, "over", f"{ko} 웅덩이", tid))
    for li, lk in enumerate(th["looks"]):
        rm = lk.get("remap") or {}; nm = f"{ko}·{lk['ko']}"
        faces = [B.remap(P(p), rm) for p in th["faces"]]
        rs, rw = B.remap(P(th["rimS"]), rm), B.remap(P(th["rimW"]), rm); re = rw[:, ::-1]
        top0 = tops[0]
        look = dict(id=lk["id"], ko=lk["ko"], **({"stagger": True} if th.get("stagger") else {}), **({"floorWeights": th["floorWeights"]} if th.get("floorWeights") else {}), **common)
        st = th.get("stairs")
        if st:   # 계단: 벽 앞면 두 칸(올라감)은 겉모습의 벽 색 줄로, 바닥 한 칸(내려감)은 바닥 색 줄로 — 킷으로 굽는다(시공기가 옛 계단 킷 대신 쓴다)
            up = B.remap(B.remap(B.piece(st["up"]), st.get("upRemap")), rm); down = B.remap(B.piece(st["down"]), st.get("downRemap"))
            ids = {}
            for name, a, h in (("up", up, 2), ("down", down, 1)):
                kid = f"{PREFIX}{tid}-{lk['id']}-stairs-{name}"; ids[name] = kid
                rows = [dict(tiles=[B.emit(a[r * T:(r + 1) * T], "stair", f"{nm} 계단 {'올라감' if name == 'up' else '내려감'} {r}", tid)], upperTiles=[-1]) for r in range(h)]
                B.kits.append(dict(id=kid, name=f"{LABEL} · {nm} {'벽 앞면에서 올라가는 계단 1×2' if name == 'up' else '바닥에서 내려가는 계단 1×1'}", kind="section", width=1, height=h, tileSize=T, learnedFrom="pack-preset", rows=rows,
                                   ai=dict(role="stairs", repeatability="fixed", layerHome="lower", tags=["버들항", "던전", "계단", f"dgn:{tid}"], themes=["dungeon", "던전"],
                                           description=f"{nm} 계단. {GATE_NOTE}", placementRules="던전 시공기(author_dungeon)가 층 사이 이동 칸에 깐다.")))
            look["stairs"] = ids
        ph = lambda cells: [cells[k % np_] for k in range(4)]
        # 앞면: [조각][열 0..3][줄 0(위)..2(아래)], 입술: [조각][열] (천장 칸의 아래 8줄)
        look["face"] = [[[B.emit(f[8 + r * T:8 + (r + 1) * T, c * T:(c + 1) * T], "wall", f"{nm} 벽 앞면 {i + 1} ({c},{r})", tid) for r in range(3)] for c in range(4)] for i, f in enumerate(faces)]
        lips = []
        for i, f in enumerate(faces):
            row = []
            for c in range(4):
                px = np.zeros((T, T, 4), np.uint8); px[8:16] = f[0:8, c * T:(c + 1) * T]
                row.append(B.emit(px, "over", f"{nm} 벽 윗변 입술 {i + 1} ({c})", tid) if (px[:, :, 3] > 0).any() else -1)
            lips.append(row)
        look["lip"] = lips

        def fill(strip, colour):
            o = strip.copy(); m = o[:, :, 3] == 0; o[m, :3] = colour; o[m, 3] = 255; return o
        rim = {}
        nS = lambda k, f=True: fill(rs[:, k * T:(k + 1) * T], sliver) if f else rs[:, k * T:(k + 1) * T]
        eW = lambda k, col: fill(rw[k * T:(k + 1) * T], col)
        eE = lambda k, col: fill(re[k * T:(k + 1) * T], col)
        base = lambda k: top0[0:T, k * T:(k + 1) * T]
        rim["N"] = [B.emit(comp(base(k), nS(k)), "ceil", f"{nm} 테 북 {k}", tid) for k in range(4)]
        rim["E"] = ph([B.emit(eW(k, sliver), "ceil", f"{nm} 테 동 {k}", tid) for k in range(np_)])
        rim["W"] = ph([B.emit(eE(k, sliver), "ceil", f"{nm} 테 서 {k}", tid) for k in range(np_)])
        def both(k):   # 동·서가 다 바닥인 한 칸 두께 벽 윗면: 왼쪽 반은 «바닥이 서쪽» 테, 오른쪽 반은 «바닥이 동쪽» 테
            o = eE(k, sliver).copy(); o[:, 8:] = eW(k, sliver)[:, 8:]; return o
        rim["EW"] = ph([B.emit(both(k), "ceil", f"{nm} 테 동서 {k}", tid) for k in range(np_)])
        rim["Ef"] = ph([B.emit(eW(k, gap), "ceil", f"{nm} 테 동(앞면 곁) {k}", tid) for k in range(np_)])
        rim["Wf"] = ph([B.emit(eE(k, gap), "ceil", f"{nm} 테 서(앞면 곁) {k}", tid) for k in range(np_)])

        def corner(k, east):
            o = comp(base(k), nS(k)); side = eW(k, sliver) if east else eE(k, sliver)
            if east: o[:, 7:] = side[:, 7:]
            else: o[:, :9] = side[:, :9]
            return o
        rim["NE"] = ph([B.emit(corner(k, True), "ceil", f"{nm} 테 북동 {k}", tid) for k in range(np_)])
        rim["NW"] = ph([B.emit(corner(k, False), "ceil", f"{nm} 테 북서 {k}", tid) for k in range(np_)])

        def diag(k, east):   # 바닥이 대각(북동/북서)에만 있는 모서리 칸: 남쪽 테 띠가 13px 만큼 돌아 들어온다
            o = base(k).copy(); s = nS(k, False); t = np.zeros_like(s)
            if east: t[:, 3:] = s[:, :13]
            else: t[:, :13] = s[:, 3:]
            return comp(o, t)
        rim["cE"] = ph([B.emit(diag(k, True), "ceil", f"{nm} 테 모서리(북동) {k}", tid) for k in range(np_)])
        rim["cW"] = ph([B.emit(diag(k, False), "ceil", f"{nm} 테 모서리(북서) {k}", tid) for k in range(np_)])
        look["rim"] = rim
        out["looks"].append(look)
    return out


def object_kit(B, ob, theme, light=None):
    a = B.remap(B.remap(B.piece(ob["src"]), ob.get("remap")), light["remap"] if light else None); w, h = ob["w"], ob["h"]
    if light: ob = dict(ob, id=f"{ob['id']}-{light['suffix']}", ko=f"{ob['ko']}({light['ko']})")
    if ob.get("crop"): x0, y0, x1, y1 = ob["crop"]; a = a[y0:y1, x0:x1]
    canvas = np.zeros((h * T, w * T, 4), np.uint8); ph, pw = a.shape[:2]
    assert ph <= h * T and pw <= w * T, (ob["id"], a.shape)
    ox = (w * T - pw) // 2; oy = h * T - ph if ob["cls"] == "object" else 0 if ob["cls"] == "mount" else (h * T - ph) // 2   # 서 있는 것은 아래 맞춤, 벽걸이는 위 맞춤, 바닥 그림은 가운데
    canvas[oy:oy + ph, ox:ox + pw] = a
    block = {tuple(b) for b in ob.get("block", [[x, h - 1] for x in range(w)] if ob["cls"] == "object" else [[x, y] for x in range(w) for y in range(h)] if ob["cls"] == "mount" else [])}
    rows = []
    for y in range(h):
        row = []
        for x in range(w):
            c = canvas[y * T:(y + 1) * T, x * T:(x + 1) * T]
            if not (c[:, :, 3] > 0).any(): row.append(-1); continue
            kind = "decal" if ob["cls"] == "decal" else "solid" if (x, y) in block else "star"
            row.append(B.emit(c, kind, f"{ob['ko']}" + (f" ({x},{y})" if w * h > 1 else ""), theme))
        rows.append(row)
    kid = PREFIX + ob["id"]
    how = "바닥 그림, 밟고 지나간다" if ob["cls"] == "decal" else "벽 앞면에 붙는다" if ob["cls"] == "mount" else "서 있는 기물, 아랫줄이 막힌다"
    B.kits.append(dict(id=kid, name=f"{LABEL} · {ob['ko']} {w}×{h}", kind="section", width=w, height=h, tileSize=T, learnedFrom="pack-preset",
                       rows=[dict(tiles=[-1] * w, upperTiles=r) for r in rows],
                       ai=dict(role="prop", repeatability="fixed", layerHome="upper", tags=["버들항", "던전", "기물", "주제 소품", f"dgn:{theme}", *(["벽걸이"] if ob["cls"] == "mount" else []), *ob.get("words", [])], themes=["dungeon", "던전"],
                               description=f"{ob['ko']} ({ob['en']}) — {how}. {GATE_NOTE}", placementRules="던전 시공기(author_dungeon)가 주제·겉모습에 맞춰 놓는다 — 따로 찍을 때는 던전 바닥(벽걸이는 벽 앞면) 위에.")))
    return kid, rows


def glow_cells(B, colour, w, h, cx, cy, r1, r2, a1, a2, torch, label):
    c = hx(colour); a = np.zeros((h * T, w * T, 4), np.uint8)
    for y in range(h * T):
        for x in range(w * T):
            dx, dy = x - cx, y - cy; th = math.atan2(dy, dx)
            ky = (0.55 if dy > 0 else 1.5) if torch else 1.15
            d = math.hypot(dx, dy * ky) / (1 + 0.12 * math.sin(3 * th + 1.0) + 0.07 * math.sin(7 * th + 2.0))
            al = a1 if d <= r1 else a2 if d <= r2 else 0
            if al: a[y, x] = (*c, int(round(al * 255)))
    rows = [[(B.emit(a[y * T:(y + 1) * T, x * T:(x + 1) * T], "glow", f"{label} ({x},{y})", "light") if (a[y * T:(y + 1) * T, x * T:(x + 1) * T, 3] > 0).any() else -1) for x in range(w)] for y in range(h)]
    return rows


def main():
    ap = argparse.ArgumentParser()
    for flag in ("--dry", "--check", "--dev"): ap.add_argument(flag, action="store_true")
    a = ap.parse_args()
    spec = json.loads((STORE / "spec.json").read_text(encoding="utf-8"))
    ramps = json.loads((STORE / "ramps.json").read_text(encoding="utf-8"))["ramps"]
    B = Bake(spec, ramps)
    used = sorted({p for th in spec["themes"] for p in [*th["floor"], *th["faces"], *th["top"], th["rimS"], th["rimW"], *([th["shore"], th["shoreIn"]] if th.get("shore") else []), *([th["water"]] if th.get("water") else []), *([f"br-{th['bridge']}-{d}" for d in ("ew", "ns")] if th.get("bridge") else []), *([th["stairs"]["up"], th["stairs"]["down"]] if th.get("stairs") else [])]}
                  | {ob["src"] for grp in [spec["shared"], *spec["themes"]] for ob in grp.get("objects", [])})
    waiver = spec.get("waiver", "")
    imgs = [(Image.open(STORE / "pieces" / f"{p}.png").convert("RGBA"), spec["kinds"][p], f"beodeul_dungeons/{p}") for p in used]
    if a.dev:
        got = [hashlib.sha256(im.tobytes()).hexdigest() for im, _, _ in imgs]; gate = "DEV"
    else:
        from object_gate import require_all
        got = require_all(imgs, context="bundle"); gate = f"3/4 gate not passed — owner waiver {waiver}"
    print(f"관문(bundle 출구): {len(got)}/{len(imgs)} — {'DEV(관문 없음)' if a.dev else GATE_NOTE + ' 묶음 ' + waiver}")

    table = dict(_doc="버들항 던전 겉가죽 표 — scripts/content/beodeul-dungeons/bake.py 가 굽는다(손으로 고치지 않는다). 주제(themes)마다 겉모습(looks) 목록: floor[판][16칸] · face[조각][열][줄] · lip[조각][열] · "
                      "top[밝기][판][칸] · rim{N,E,W,Ef,Wf,NE,NW,cE,cW}[위상 4] · water[4] · shore[16](가운데 넷은 -1) · shoreIn[4]. swap = 옛 킷 id → 갈아 끼울 새 킷 id 들, extras = 덧놓을 킷, glow = 빛 띠 킷, light = 겉모습 이름 → 불 기물을 그 색 불 킷으로.",
                 version=1, tilesetId="beodeul_city", kitPrefix=PREFIX, base=BASE, end=END, gate=gate, looks=spec["lookNames"], themes=[], glow={}, light={})
    catalog_objs = []
    for g in spec["glows"]:
        rows = glow_cells(B, g["colour"], g["w"], g["h"], g["cx"], g["cy"], g["r1"], g["r2"], g["a1"], g["a2"], g.get("torch", False), g["ko"])
        table["glow"][g["id"]] = dict(w=g["w"], h=g["h"], rows=rows, dx=g["dx"], dy=g["dy"])
    shared_swap, shared_ids = {}, {}
    for ob in spec["shared"]["objects"]:
        kid, rows = object_kit(B, ob, "shared"); shared_ids[ob["id"]] = kid
        for old in ob.get("swap", []): shared_swap.setdefault(old, []).append(kid)
        catalog_objs.append(dict(id=ob["id"], kit=kid, theme="shared", rows=rows))
    done = {}
    # 빛 색: 겉모습 이름마다 «불을 내는 공용 기물 → 그 색 불 킷» 과 그 킷의 빛 띠
    light_glow = {}
    for name, lt in spec["shared"].get("light", {}).items():
        table["light"][name] = {}
        for ob in spec["shared"]["objects"]:
            g = spec["shared"]["glowOf"].get(ob["id"])
            if g not in lt["glow"]: continue
            kid, rows = object_kit(B, ob, "shared", lt)
            table["light"][name][shared_ids[ob["id"]]] = kid; light_glow[kid] = lt["glow"][g]
            catalog_objs.append(dict(id=f"{ob['id']}-{lt['suffix']}", kit=kid, theme="shared", rows=rows))
    for th in spec["themes"]:
        # 갈아 끼우기: 주제 기물이 같은 옛 킷을 맡으면 공용(·물려받은) 것을 밀어낸다(주제 것이 여럿이면 자리 해시로 번갈아)
        up = done.get(th.get("inherit"))
        t = build_theme(B, th); swap = {k: list(v) for k, v in (up["swap"] if up else shared_swap).items()}; own = dict(up["own"]) if up else {}; mine = set()
        for ob in th.get("objects", []):
            kid, rows = object_kit(B, ob, th["id"]); own[ob["id"]] = kid
            for old in ob.get("swap", []):
                if old not in mine: swap[old] = []; mine.add(old)
                swap[old].append(kid)
            catalog_objs.append(dict(id=ob["id"], kit=kid, theme=th["id"], rows=rows))
        for old in th.get("keep", []): swap.pop(old, None)
        ids = {**shared_ids, **own}
        t["swap"] = swap
        extras = [*(up["extras"] if up else []), *th.get("extras", [])]; glow_of = {**(up["glowOf"] if up else spec["shared"].get("glowOf", {})), **th.get("glowOf", {})}
        done[th["id"]] = dict(swap=swap, own=own, extras=extras, glowOf=glow_of)
        t["extras"] = [dict(kit=ids[e["id"]], cls=e["cls"], per=e["per"], **{k: e[k] for k in ("max", "rooms", "once") if k in e}) for e in extras]
        t["glowOf"] = {**{ids[k]: v for k, v in glow_of.items()}, **light_glow}
        table["themes"].append(t)
    n = len(B.cells)
    print(f"주제 {len(spec['themes'])}개 · 킷 {len(B.kits)}개 · 칸 {n}/{BLOCK} → 내 토막 {BASE}..{END - 1}")
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
        p, pr, te, m = blank(); ts["passability"].append(p); ts["priority"].append(pr); ts["terrain"].append(te); ts["tileMeta"].append(m)
    for i in range(BASE, END):
        p, pr, te, m = blank(); ts["passability"][i] = p; ts["priority"][i] = pr; ts["terrain"][i] = te; ts["tileMeta"][i] = m
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
                   source="scripts/content/beodeul-dungeons/bake.py (pieces by Claude Fable 5.2 medium one-shot, cut and assembled by code; looks are the same pixels on another locked ramp)",
                   gate=gate, pieces=[dict(id=p, kind=k, sha256=d) for (_, k, _), p, d in zip(imgs, used, got)], objects=catalog_objs)
    outputs = [(TS_PATH, json.dumps(ts, ensure_ascii=False, separators=(",", ":")) + "\n"), (SHEET_JSON, json.dumps(dict(count=total, tilesPerRow=COLS)) + "\n"),
               (CATALOG, json.dumps(catalog, ensure_ascii=False, indent=1) + "\n"), (TABLE, json.dumps(table, ensure_ascii=False, separators=(",", ":")) + "\n")]
    if a.check:
        bad = [str(p.relative_to(ROOT)) for p, text in outputs if not p.exists() or p.read_text(encoding="utf-8") != text]
        if not np.array_equal(np.array(Image.open(SHEET_PATH).convert("RGBA")), np.array(canvas)): bad.append(str(SHEET_PATH.relative_to(ROOT)))
        print("다시 구운 것과 같다" if not bad else f"다르다: {bad}"); sys.exit(1 if bad else 0)
    canvas.save(SHEET_PATH, optimize=True)
    for p, text in outputs: p.write_text(text, encoding="utf-8")
    print(f"던전 겉가죽 토막: 킷 {len(B.kits)}개 · 칸 {BASE}..{BASE + n - 1} (예약 {END - 1} 까지)")


if __name__ == "__main__":
    main()
