"""16px 손 도트 도구 — 타일셋 하네스 공용.

그림은 전부 좌표로 한 점씩 정한다(생성 이미지·축소 변환 없음). 같은 이름이면 같은 결과가 나오도록
난수는 이름 해시로 씨앗을 준다. 오토타일은 이웃 비트(N=1 E=2 S=4 W=8)로 모양을 정하고,
가장자리 흔들림은 칸 경계를 넘어 이어지도록 x(또는 y) 한 칸 주기(16)의 함수로만 만든다.
"""
from __future__ import annotations

import hashlib
import random
from typing import Callable, Iterable

from PIL import Image

T = 16
N, E, S, W = 1, 2, 4, 8
NE, SE, SW, NW = 16, 32, 64, 128  # 엔진 AUTOTILE_DIR 과 같은 비트
Color = tuple[int, int, int, int]


def hexc(h: str, a: int = 255) -> Color:
    h = h.lstrip("#")
    return (int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16), a)


def ramp(hexes: Iterable[str]) -> list[Color]:
    return [hexc(h) for h in hexes]


def rng(name: str) -> random.Random:
    return random.Random(int(hashlib.sha1(name.encode()).hexdigest()[:12], 16))


def new(w: int = T, h: int = T) -> Image.Image:
    return Image.new("RGBA", (w, h), (0, 0, 0, 0))


def fill(im: Image.Image, c: Color) -> Image.Image:
    im.paste(c, (0, 0, im.width, im.height))
    return im


def put(im: Image.Image, x: int, y: int, c: Color) -> None:
    if 0 <= x < im.width and 0 <= y < im.height:
        im.putpixel((x, y), c)


def rect(im: Image.Image, x0: int, y0: int, x1: int, y1: int, c: Color) -> None:
    """x1,y1 는 포함."""
    for y in range(y0, y1 + 1):
        for x in range(x0, x1 + 1):
            put(im, x, y, c)


def stamp(im: Image.Image, x: int, y: int, rows: list[str], key: dict[str, Color]) -> None:
    """글자 격자 도장. '.' 은 건드리지 않는다."""
    for dy, row in enumerate(rows):
        for dx, ch in enumerate(row):
            if ch != "." and ch in key:
                put(im, x + dx, y + dy, key[ch])


def mirror(im: Image.Image) -> Image.Image:
    return im.transpose(Image.FLIP_LEFT_RIGHT)


def tint(c: Color, f: float) -> Color:
    return (min(255, int(c[0] * f)), min(255, int(c[1] * f)), min(255, int(c[2] * f)), c[3])


def swap(im: Image.Image, mapping: dict[Color, Color]) -> Image.Image:
    out = im.copy()
    px = out.load()
    for y in range(out.height):
        for x in range(out.width):
            if px[x, y] in mapping:
                px[x, y] = mapping[px[x, y]]
    return out


def sheet_bytes(im: Image.Image) -> bytes:
    import io
    b = io.BytesIO()
    im.save(b, "PNG", optimize=True)
    return b.getvalue()


# ---- 오토타일 ------------------------------------------------------------------------------
def edge_jitter(name: str, side: str, amp: int = 1) -> list[int]:
    """한 변 16칸의 가장자리 깊이 흔들림(0..amp). 변 이름이 같으면 같은 값 — 이웃 칸과 이어진다."""
    r = rng(f"{name}:{side}")
    out, v = [], r.randint(0, amp)
    for _ in range(T):
        if r.random() < 0.35:
            v = max(0, min(amp, v + r.choice((-1, 1))))
        out.append(v)
    out[T - 1] = out[0]  # 주기 16: 오른쪽 끝과 왼쪽 끝이 같다
    return out


def inside_mask(mask: int, name: str, depth: int, radius: int, amp: int = 1) -> list[list[bool]]:
    """mask 비트가 꺼진 쪽(이웃이 같은 재료가 아님)마다 깊이 depth±amp 만큼 깎는다. 두 변이 맞닿으면 둥글게."""
    jn = edge_jitter(name, "ns", amp)  # 북·남은 같은 흔들림표를 쓰고 방향만 다르다
    jw = edge_jitter(name, "ew", amp)
    inside = [[True] * T for _ in range(T)]
    for y in range(T):
        for x in range(T):
            ok = True
            if not mask & N and y < depth + jn[x]:
                ok = False
            if not mask & S and y > T - 1 - (depth + jn[(T - 1 - x) % T]):
                ok = False
            if not mask & W and x < depth + jw[y]:
                ok = False
            if not mask & E and x > T - 1 - (depth + jw[(T - 1 - y) % T]):
                ok = False
            inside[y][x] = ok
    # 모서리 둥글리기: 인접한 두 변이 열려 있으면 그 모서리 radius 안에서 사분원 밖은 깎는다
    corners = (
        (N | W, 0, 0, 1, 1), (N | E, T - 1, 0, -1, 1),
        (S | W, 0, T - 1, 1, -1), (S | E, T - 1, T - 1, -1, -1),
    )
    for bits, cx, cy, sx, sy in corners:
        if mask & bits:
            continue
        # radius < 0: 칸 전체 사분원 — 중심을 맞은편 모서리에 두고, 반지름은 가장자리 흔들림의 최소 깊이에서 멈춘다(이음매 불변).
        # 작은 반지름은 여러 칸짜리 구역에서 모서리가 네모로 읽힌다(동굴 모래, 적대 검수 2026-10-02)
        r = T - 1 - max(0, depth - amp) if radius < 0 else depth + radius
        for dy in range(min(r, T - 1) + 1):
            for dx in range(min(r, T - 1) + 1):
                x, y = cx + sx * dx, cy + sy * dy
                # 원 중심은 (cx+sx*r, cy+sy*r)
                ox, oy = (cx + sx * (T - 1), cy + sy * (T - 1)) if radius < 0 else (cx + sx * r, cy + sy * r)
                if (x - ox) ** 2 + (y - oy) ** 2 > r * r + 1:
                    inside[y][x] = False
    # 안쪽 모서리: 두 이웃 변이 이어져 있는데 그 사이 대각 칸이 비면, 두 변의 가장자리 깎임이 겹치는 구석을 깎는다
    def cut_n(x, y): return y < depth + jn[x]
    def cut_s(x, y): return y > T - 1 - (depth + jn[(T - 1 - x) % T])
    def cut_w(x, y): return x < depth + jw[y]
    def cut_e(x, y): return x > T - 1 - (depth + jw[(T - 1 - y) % T])
    notches = ((N | E, NE, cut_n, cut_e), (N | W, NW, cut_n, cut_w), (S | E, SE, cut_s, cut_e), (S | W, SW, cut_s, cut_w))
    for sides, diag, ca, cb in notches:
        if (mask & sides) == sides and not mask & diag:
            for y in range(T):
                for x in range(T):
                    if ca(x, y) and cb(x, y):
                        inside[y][x] = False
    return inside


def neighbours4(inside: list[list[bool]], x: int, y: int, mask: int = 0) -> dict[str, bool]:
    """4방향 이웃이 안쪽인지. 칸 밖은 그쪽 변이 이어져 있으면(mask 비트) 안쪽으로 본다 — 이음새에 테두리가 안 생긴다."""
    def g(xx: int, yy: int, bit: int) -> bool:
        if 0 <= xx < T and 0 <= yy < T:
            return inside[yy][xx]
        return bool(mask & bit)
    return {"n": g(x, y - 1, N), "e": g(x + 1, y, E), "s": g(x, y + 1, S), "w": g(x - 1, y, W)}


def canon(mask8: int) -> int:
    """8방향 마스크를 그림이 같은 것끼리 한 키로. 대각은 두 이웃 변이 모두 이어졌을 때만 의미가 있다."""
    m = mask8 & 15
    for sides, diag in ((N | E, NE), (S | E, SE), (S | W, SW), (N | W, NW)):
        if (m & sides) == sides and mask8 & diag:
            m |= diag
    return m


ALL47 = sorted({canon(m) for m in range(256)})


def blob_variants(draw: Callable[[int], object]) -> dict:
    """canon 키 47개 → 그림(또는 프레임 목록)."""
    return {k: draw(k) for k in ALL47}


def variant_map256(ids: dict[int, int]) -> dict[str, int]:
    """엔진 variantMap: 모든 원시 마스크(0..255) → 그 canon 키의 칸 번호."""
    return {str(m): ids[canon(m)] for m in range(256)}


def seam_report(masks: dict[int, list[list[bool]]]) -> list[str]:
    """맞닿는 두 변형의 안/밖 모양(구조)이 이어지는지(질감은 주기 16 이라 따로 검사 안 함).
    실제 맵에서 일어날 수 있는 모든 이웃 조합(두 칸이 공유하는 칸의 상태가 서로 같은 것)에서 맞닿는 열·행을 비교한다."""
    bad: set[str] = set()
    for a in range(256):
        for b in range(256):
            ka, kb = canon(a), canon(b)
            # b 가 a 의 동쪽
            if a & E and b & W and bool(a & NE) == bool(b & N) and bool(a & SE) == bool(b & S) and bool(b & NW) == bool(a & N) and bool(b & SW) == bool(a & S):
                if [masks[ka][y][T - 1] for y in range(T)] != [masks[kb][y][0] for y in range(T)]:
                    bad.add(f"E-W {ka}->{kb}")
            # b 가 a 의 남쪽
            if a & S and b & N and bool(a & SE) == bool(b & E) and bool(a & SW) == bool(b & W) and bool(b & NE) == bool(a & E) and bool(b & NW) == bool(a & W):
                if masks[ka][T - 1] != masks[kb][0]:
                    bad.add(f"S-N {ka}->{kb}")
    return sorted(bad)


# ---- 16 주기 질감(이웃 칸과 이음새 없이 이어진다) ---------------------------------------------
def torus_seeds(name: str, n: int) -> list[tuple[float, float]]:
    """칸 위에 흩뿌린 점 n 개. 서로 너무 붙지 않게 몇 번 걸러 뽑는다."""
    r = rng(name)
    pts: list[tuple[float, float]] = []
    tries = 0
    while len(pts) < n and tries < 400:
        tries += 1
        p = (r.random() * T, r.random() * T)
        if all(torus_dist(p, q) >= T / (n ** 0.5) * 0.78 for q in pts):
            pts.append(p)
    return pts


def torus_dist(a: tuple[float, float], b: tuple[float, float]) -> float:
    dx = abs(a[0] - b[0]); dy = abs(a[1] - b[1])
    dx = min(dx, T - dx); dy = min(dy, T - dy)
    return (dx * dx + dy * dy) ** 0.5


def voronoi(seeds: list[tuple[float, float]], x: float, y: float) -> tuple[float, float, int, tuple[float, float]]:
    """가장 가까운 점까지(d1), 둘째로 가까운 점까지(d2), 가장 가까운 점 번호, 그 점에서 (x,y) 로의 벡터."""
    best = []
    for i, (sx, sy) in enumerate(seeds):
        dx = x - sx; dy = y - sy
        dx -= T * round(dx / T); dy -= T * round(dy / T)
        best.append(((dx * dx + dy * dy) ** 0.5, i, (dx, dy)))
    best.sort(key=lambda t: t[0])
    return best[0][0], best[1][0], best[0][1], best[0][2]


def clumps(name: str, base: Color, accents: list[tuple[Color, int, int]]) -> Image.Image:
    """덩이진 질감. accents = [(색, 개수, 최대폭)] — 폭 1~최대폭, 높이 1~2 의 둥근 덩이를 칸 주기로 흩뿌린다."""
    im = new()
    fill(im, base)
    r = rng(name)
    for color, count, wmax in accents:
        for _ in range(count):
            cx, cy = r.randrange(T), r.randrange(T)
            w = r.randint(1, wmax); h = 1 if r.random() < 0.55 else 2
            for dy in range(h):
                for dx in range(w):
                    if w >= 3 and h == 2 and dy == 1 and dx in (0, w - 1):
                        continue  # 둥근 모서리
                    im.putpixel(((cx + dx) % T, (cy + dy) % T), color)
    return im
