#!/usr/bin/env python3
"""버들항 실내 — 그린 원본(raw/)을 굽는 조각(pieces/)으로 다듬는다. 모양은 손대지 않는다: 칸에 맞춰 앉히기 · 색 줄 안 옮기기 · 바닥 그림자 · 불빛 번짐뿐.

  python3 scripts/content/beodeul-interiors/prepare.py

raw/<이름>.png = Claude Fable 5.2 medium 한 방(색은 ramps.json 에 붙은 것). pieces/<slug>.png = 굽는 그림(면제 해시가 여기에 묶인다) — 이 스크립트를 다시 돌리면 같은 화소가 나온다.
그림자(오너·감독 지시 2026-11-15 «가구가 바닥에서 떠야 한다»): 선 가구마다 발치 오른쪽 아래로 짧은 반투명 어둠, 탁자·의자 다리 사이에 밑 그늘.
불빛: 초·등은 불꽃 둘레에 세 단 번짐, 벽난로 앞·창 아래·등 아래 바닥 무늬(반투명 — 바닥 색 위에 얹힌다)는 코드로 만든다.
"""
import json, pathlib, re, sys
import numpy as np
from PIL import Image

HERE = pathlib.Path(__file__).resolve().parent
ROOT = HERE.parents[2]
STORE = ROOT / "tiledata/beodeul-interiors"
RAW, OUT = STORE / "raw", STORE / "pieces"
sys.path.insert(0, str(HERE))
import table as TB  # noqa: E402

T = 16
RAMPS = json.loads((STORE / "ramps.json").read_text())["ramps"]
SHADOW = (26, 16, 34)
WARM = (255, 168, 64)
SUN = (255, 238, 196)


def hx(c): return tuple(int(c[i:i + 2], 16) for i in (1, 3, 5))
def slug(i): return re.sub(r"[^a-z0-9]+", "-", i.lower()).strip("-")


def remap(im, rules):
    """색 줄 안에서(또는 줄에서 줄로) 단을 옮긴다. rules = [(줄, {옛: 새})] 또는 [(옛 줄, 새 줄, {옛: 새})]."""
    a = np.array(im.convert("RGBA")); src = a.copy()
    for rule in rules:
        frm, to, m = (rule[0], rule[0], rule[1]) if len(rule) == 2 else rule
        for old, new in m.items():
            if old >= len(RAMPS[frm]): continue
            c = hx(RAMPS[frm][old]); hit = (src[..., 0] == c[0]) & (src[..., 1] == c[1]) & (src[..., 2] == c[2]) & (src[..., 3] > 0)
            a[hit, :3] = hx(RAMPS[to][min(new, len(RAMPS[to]) - 1)])
    return Image.fromarray(a, "RGBA")


def load(src):
    if isinstance(src, str): return Image.open(RAW / f"{src}.png").convert("RGBA")
    name, x, y, w, h = src
    im = Image.open(RAW / f"{name}.png").convert("RGBA")
    return im.crop((x, y, min(im.width, x + w), min(im.height, y + h)))


def trim_cols(im):
    b = im.getchannel("A").getbbox()
    return im.crop((b[0], 0, b[2], im.height)) if b else im


def seat(im, kind, w, foot, o):
    """칸 크기 캔버스에 앉힌다. 선 것은 밑변 맞춤·가로 가운데, 걸이는 위 맞춤(oy)·가로 가운데, 밟는 무늬는 가운데."""
    if o.get("cx") or im.width > w * T: im = trim_cols(im)
    if im.width > w * T: raise SystemExit(f"폭 {im.width} > {w * T}")
    if kind == "hang":
        rows = o.get("rows", 1); H = rows * T; oy = o.get("oy", 0)
        b = im.getchannel("A").getbbox(); im = im.crop((0, b[1], im.width, b[3]))
        if im.height + oy > H: oy = max(0, H - im.height)
        out = Image.new("RGBA", (w * T, H)); out.alpha_composite(im.crop((0, 0, im.width, min(im.height, H - oy))), ((w * T - im.width) // 2, oy)); return out
    if kind == "flat":
        H = foot * T; out = Image.new("RGBA", (w * T, H)); b = im.getchannel("A").getbbox(); im = im.crop(b)
        out.alpha_composite(im.crop((0, 0, min(im.width, w * T), min(im.height, H))), ((w * T - min(im.width, w * T)) // 2, (H - min(im.height, H)) // 2)); return out
    b = im.getchannel("A").getbbox(); im = im.crop((0, b[1], im.width, im.height))
    H = max(foot * T, -(-im.height // T) * T)
    out = Image.new("RGBA", (w * T, H)); out.alpha_composite(im, ((w * T - im.width) // 2, H - im.height)); return out


def shadow(im):
    """발치 그림자: 맨 아래 6줄에서 불투명 화소의 오른쪽 아래 1~2px 로 드리운 어둠 + 다리 사이(양옆과 위가 막힌 투명 화소)의 밑 그늘."""
    a = np.array(im); h, w = a.shape[:2]; op = a[..., 3] > 0; out = a.copy()
    lo = max(0, h - 12)
    for y in range(lo, h):
        for x in range(w):
            if op[y, x]: continue
            above = op[max(0, y - 12):y, x].any()
            left = op[y, :x].any(); right = op[y, x + 1:].any()
            if above and left and right: out[y, x] = (*SHADOW, 96)       # 밑 그늘
    for y in range(max(0, h - 6), h):
        for x in range(w):
            if op[y, x] or out[y, x, 3]: continue
            if any(0 <= y - d < h and 0 <= x - d < w and op[y - d, x - d] for d in (1, 2)): out[y, x] = (*SHADOW, 110)
    return Image.fromarray(out, "RGBA")


def halo(im):
    """불꽃(가장 밝은 불 색) 둘레의 투명 화소에 세 단 번짐."""
    a = np.array(im); hot = [hx("#fff0c0"), hx("#fbc10d")]
    ys, xs = np.nonzero(((a[..., :3] == hot[0]).all(2) | (a[..., :3] == hot[1]).all(2)) & (a[..., 3] > 0) & (np.arange(a.shape[0])[:, None] < a.shape[0] * 0.7))
    if not len(ys): return im
    out = a.copy(); yy, xx = np.mgrid[0:a.shape[0], 0:a.shape[1]]
    d = np.sqrt(((yy[..., None] - ys) ** 2 + (xx[..., None] - xs) ** 2).min(2))
    for r, al in ((9.5, 34), (6.5, 62), (3.5, 96)):
        m = (d <= r) & (a[..., 3] == 0); out[m] = (*WARM, al)
    return Image.fromarray(out, "RGBA")


def glow(name):
    if name == "glow-hearth":      # 3×2칸: 위 가운데(불 아가리)에서 퍼지는 반타원 세 단
        a = np.zeros((32, 48, 4), np.uint8); yy, xx = np.mgrid[0:32, 0:48]
        for rx, ry, al in ((23.5, 30, 40), (17, 21, 66), (10, 12, 96)):
            a[((xx - 23.5) / rx) ** 2 + ((yy + 1) / ry) ** 2 <= 1] = (*WARM, al)
    elif name == "glow-window":    # 1×2칸: 창살 넷으로 갈린 기운 네모(오른쪽 아래로 기운다)
        a = np.zeros((32, 16, 4), np.uint8)
        for y in range(2, 28):
            x0 = 1 + (y - 2) // 5
            for x in range(x0, min(16, x0 + 10)):
                if (y - 2) % 13 == 12 or x - x0 == 4: continue
                a[y, x] = (*SUN, 74)
    else:                          # 2×1칸: 등 아래 둥근 빛 두 단
        a = np.zeros((16, 32, 4), np.uint8); yy, xx = np.mgrid[0:16, 0:32]
        for rx, ry, al in ((14, 7.5, 44), (8, 4.5, 76)):
            a[((xx - 15.5) / rx) ** 2 + ((yy - 7.5) / ry) ** 2 <= 1] = (*WARM, al)
    return Image.fromarray(a, "RGBA")


def main():
    OUT.mkdir(exist_ok=True)
    made = 0
    for oid, src, kind, w, foot, _cat, _ko, _tags, _gate, o in TB.OBJECTS:
        im = load(src)
        if o.get("remap"): im = remap(im, o["remap"])
        im = seat(im, kind, w, foot, o)
        if o.get("halo"): im = halo(im)
        if kind in ("floor", "wall") and not o.get("noshadow"): im = shadow(im)
        im.save(OUT / f"{slug(oid)}.png"); made += 1
    for gid, src, w, h, _ko in TB.GLOWS:
        g = glow(src); assert g.size == (w * T, h * T), (gid, g.size); g.save(OUT / f"{slug(gid)}.png"); made += 1
    for gid, (name, cell), _ko in TB.GOODS:
        load((name, cell * T, 0, T, T)).save(OUT / f"goods-{slug(gid)}.png"); made += 1
    for wid, src, _ko, _st in TB.WALLS:
        im = load(src); assert im.size == (48, 32), (wid, im.size); im.save(OUT / f"wall-{wid}.png"); made += 1
    for fid, src, _ko, o in TB.FLOORS:
        im = load(src)
        if o.get("remap"): im = remap(im, o["remap"])
        if o.get("vary"): im = vary(im, o["vary"], o["period"])
        im.save(OUT / f"floor-{fid}.png"); made += 1
    for eid, src, _ko in TB.EDGES:
        im = load(src); assert im.size == (48, 48), (eid, im.size); im.save(OUT / f"edge-{eid}.png"); made += 1
    print(f"조각 {made}장 → {OUT.relative_to(ROOT)}")


def darker(c):
    for cs in RAMPS.values():
        hs = [hx(v) for v in cs]
        if c in hs: return hs[max(0, hs.index(c) - 1)]
    return c


def vary(im, bands, period):
    """널 한 장(맞댄 이음 사이)마다 다섯에 하나를 한 단 어둡게 — 넓은 주기(period 칸)로 펼쳐 되풀이가 널 단위로 깨지게 한다. 무늬가 아니라 널이다."""
    t = np.array(im); tw, th = im.width, im.height; W, H = period[0] * T, period[1] * T
    a = np.tile(t, (H // th, W // tw, 1)); dark = t[..., :3].astype(int).sum(2)
    table = {}; m = np.zeros((H, W), bool)
    for bi, (r0, r1) in enumerate(bands):
        col = int(np.argmin(dark[r0:r1, :].sum(0)))
        for ty in range(0, H, th):
            for k in range(W // tw):
                if (bi * 7 + (ty // th) * 13 + k * 5 + 3) % 5: continue
                for x in range(col + 1 + k * tw, col + (k + 1) * tw): m[ty + r0:ty + r1, x % W] = True
    for y, x in zip(*np.nonzero(m)):
        c = tuple(int(v) for v in a[y, x, :3]); a[y, x, :3] = table.setdefault(c, darker(c))
    return Image.fromarray(a, "RGBA")


if __name__ == "__main__":
    main()
