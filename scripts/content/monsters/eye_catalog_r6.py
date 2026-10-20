#!/usr/bin/env python3
# /// script
# requires-python = ">=3.11"
# dependencies = ["numpy", "pillow"]
# ///
# ─── How to run ───
# python3 scripts/content/monsters/eye_catalog_r6.py --out-dir /tmp/x [--species a,b]   # preview only (repo untouched)
# python3 scripts/content/monsters/eye_catalog_r6.py --apply [--species a,b]           # write authored fronts, eyes.json, ledger
# python3 scripts/content/monsters/eye_catalog_r6.py --catalog-json out.json           # dump the eye design table (review page)
"""Round 6 (2026-10-20): every species gets its own eye (사용자 「다 눈이 똑같아서 불만」).

Rounds 2–5 stamped one template everywhere (dark-brown 5×6/6×8 round eye, 2×2 catchlight top-left). This
script keeps everything else in each authored front pixel-identical and only redraws the eye area:

1. erase the old eye boxes (`eyes.json` near/far/second) by refilling each row from the nearest light
   non-eye pixels on either side (keeps the face's vertical shading);
2. build the new eye from the species' row in CATALOG — shape mask × iris colours × pupil × catchlights
   × lid/lash/brow — and stamp it centred on the old eye (plus the row's dx/dy), clipped to the body;
3. write `authored/<id>-front.png`, the new boxes and `style` (= shape) in `eyes.json`
   (`patch.from` = the origin/main authored hash, so the record spans the whole round), ledger hashes.

The three frozen reference species keep their eye shape; only their iris is re-coloured (`recolor`).
Profile species stay one-eyed (far eye hidden, 사용자 규칙 5차). 3/4 and frontal species that passed with two
eyes keep two eyes of the same design. Iris colours are snapped to colours already in the sprite when one is
close (ΔE ≤ 8), so the palette stays within the 20-colour limit.

Then: `npm run harness -- monster-collect-species build`, and for each changed species
`field_chip.py derive → pick`, then `field_chip.py bake`.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import subprocess
import sys
from pathlib import Path
from typing import Final

import numpy as np
from PIL import Image

ROOT: Final[Path] = Path(__file__).resolve().parents[3]
DATA: Final[Path] = ROOT / "harness-data/monster-collect-species"
AUTHORED: Final[Path] = DATA / "authored"
TABLE_PATH: Final[Path] = DATA / "eyes.json"
LEDGER_PATH: Final[Path] = DATA / "ledger.json"
SOURCE: Final[str] = "eye_catalog_r6.py"

# ═══════════════════════════════════════════════════════════════════════════
# colour helpers
# ═══════════════════════════════════════════════════════════════════════════

def _lin(v: float) -> float:
    v /= 255
    return v / 12.92 if v <= 0.04045 else ((v + 0.055) / 1.055) ** 2.4


def oklab(rgb) -> tuple[float, float, float]:
    r, g, b = (_lin(float(c)) for c in rgb[:3])
    l_ = (0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b) ** (1 / 3)
    m_ = (0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b) ** (1 / 3)
    s_ = (0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b) ** (1 / 3)
    return (0.2104542553 * l_ + 0.7936177850 * m_ - 0.0040720468 * s_,
            1.9779984951 * l_ - 2.4285922050 * m_ + 0.4505937099 * s_,
            0.0259040371 * l_ + 0.7827717662 * m_ - 0.8086757660 * s_)


def from_oklab(L: float, a: float, b: float) -> tuple[int, int, int]:
    l_ = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3
    m_ = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3
    s_ = (L - 0.0894841775 * a - 1.2914855480 * b) ** 3
    rgb = (4.0767416621 * l_ - 3.3077115913 * m_ + 0.2309699292 * s_,
           -1.2684380046 * l_ + 2.6097574011 * m_ - 0.3413193965 * s_,
           -0.0041960863 * l_ - 0.7034186147 * m_ + 1.7076147010 * s_)
    def enc(v: float) -> int:
        v = min(max(v, 0.0), 1.0)
        return int(round(255 * (12.92 * v if v <= 0.0031308 else 1.055 * v ** (1 / 2.4) - 0.055)))
    return enc(rgb[0]), enc(rgb[1]), enc(rgb[2])


def iris_dark(h: str, L: float = 0.33) -> str:
    """The catalog hue at a fixed dark lightness (L < 0.4 keeps it part of the eye blob) with its chroma kept."""
    _, a, b = oklab(hexrgb(h))
    return "#%02x%02x%02x" % from_oklab(L, a, b)


def hexrgb(h: str) -> tuple[int, int, int]:
    return int(h[1:3], 16), int(h[3:5], 16), int(h[5:7], 16)


def de(a, b) -> float:
    la, lb = oklab(a), oklab(b)
    return 100 * ((la[0] - lb[0]) ** 2 + (la[1] - lb[1]) ** 2 + (la[2] - lb[2]) ** 2) ** 0.5


def palette(arr: np.ndarray) -> list[tuple[int, int, int]]:
    m = arr[:, :, 3] > 0
    return sorted({tuple(int(c) for c in p[:3]) for p in arr[m]})


def snap(target: str, pal, tol: float = 8.0) -> tuple[int, int, int]:
    t = hexrgb(target)
    best = min(pal, key=lambda c: de(c, t)) if pal else None
    return best if best is not None and de(best, t) <= tol else t


# ═══════════════════════════════════════════════════════════════════════════
# hand eye templates — every eye faces LEFT (the front of the face is on the left)
#   D rim (sprite outline colour) · P pupil · I iris dark · H iris light · W catchlight · G glow halo · L lid/brow/lash
#   T = near eye, F = the narrow far eye of 3/4 faces (profile faces never get one)
# ═══════════════════════════════════════════════════════════════════════════
TEMPLATES: Final[dict[str, list[str]]] = {
 "glossy": [".DDDD.","DWWHID","DWWPPD","DHPPPD","DHPPID","DHHIID","DHHIWD",".DDDD."],
 "round": [".DDD.","DWWPD","DWPPD","DHPPD","DHIID","DHHID",".DDD."],
 "roundtr": [".DDD.","DPWWD","DPPWD","DPPHD","DIIHD","DIHHD",".DDD."],
 "bead": [".DDD.","DWWPD","DWPID","DHHID",".DDD."],
 "beadsm": [".DD.","DWPD","DPID","DHID",".DD."],
 "almond": ["..DDDD.",".DWWPHD","DHWPPID",".DHHIID","..DDDD."],
 "sleepy": [".LLLL.","LDDDDD","DWWPHD","DHPPID",".DHHD."],
 "sleepybig": [".LLLLL.","LDDDDDD","DWWPPHD","DWPPPID","DHHPIID",".DHHHD."],
 "sharp": ["...DDD",".DDWWD","DHWPPD","DHPPID",".DHHID","..DDD."],
 "slit": [".DDDD.","DWWPHD","DWHPHD","DHHPHD","DIHPHD","DIIPID",".DDDD."],
 "slitalm": ["..DDDD.",".DWWPHD","DWHHPHD","DIHHPID",".DIIPID","..DDDD."],
 "compound": [".DDDD.","DWWHID","DWWIHD","DHIHID","DIHIID",".DDDD."],
 "glow": ["..GGG..",".GDDDG.","GDWWPDG","GDWPPDG","GDHPPDG","GDHHIDG",".GDDDG.","..GGG.."],
 "ring": [".DDDD.","DWWIID","DIHHID","DHPPHD","DHPPHD","DIHHID",".DDDD."],
 "pin": [".DDD.","DHWPD","DHPPD","DHPPD","DIHHD",".DDD."],
 "sparkle": [".DDDD.","DWWHPD","DWWPPD","DHPPWD","DHPPID","DHHHID",".DDDD."],
 "stalk": [".DDD.","DWWPD","DWPPD","DHPPD",".DDD."],
}
FAR: Final[dict[str, list[str]]] = {
 "glossy": [".D.","DWD","DWD","DID","DHD",".D."],
 "round": [".D.","DWD","DWD","DID",".D."],
 "bead": ["DD","WD","WD","DD"],
 "almond": [".DD","DWD","DID",".DD"],
 "sleepy": [".L.","DDD","DWD",".D."],
 "sharp": ["..D","DDD","DWD",".DD"],
 "slit": [".D.","DWD","DHD","DID",".D."],
 "pin": [".D.","DWD","DPD","DHD",".D."],
 "compound": [".D.","DWD","DHD","DID",".D."],
 "glow": [".G.","GDG","DWD","DID","GDG"],
}

FAR_OF: Final[dict[str, str]] = {"glossy": "glossy", "round": "round", "roundtr": "round", "bead": "bead", "beadsm": "bead", "almond": "almond",
                                 "sleepy": "sleepy", "sleepybig": "sleepy", "sharp": "sharp", "slit": "slit", "slitalm": "almond", "compound": "compound", "glow": "glow",
                                 "ring": "round", "pin": "pin", "sparkle": "round", "stalk": "round"}


# ═══════════════════════════════════════════════════════════════════════════
# the catalog — one row per species: template · iris (dark hue, L < 0.4) · light (iris light) · glow · lash · brow · why
#   brow: up = rises toward the back of the head (determined) · flat = level, one skin row above · heavy = thick, low (stern)
#   lash: 1–2 lash pixels off the back corner. Lines progress: baby glossy/round → adult sharper/narrower.
# ═══════════════════════════════════════════════════════════════════════════
CATALOG: Final[dict[str, dict]] = {
    # fire starters
    "sparkit": dict(tpl="glossy", iris="#8a3008", light_c="#f08a20", why="불 아기 · 큰 광택 눈, 주황 홍채"),
    "kilnclaw": dict(tpl="round", iris="#7a1a0c", light_c="#e0582a", dy=1, why="불·격투 2단 · 둥근 눈, 붉은 홍채"),
    "furnscale": dict(tpl="sharp", iris="#6a1008", light_c="#f06a20", dy=1, why="불·격투 3단 · 앞으로 기운 날선 눈, 불꽃색"),
    # water starters
    "aqualing": dict(tpl="glossy", iris="#103a80", light_c="#48a0f0", why="물 아기 · 큰 광택 눈, 짙은 파랑 (3/4 두 눈 유지)"),
    "brookraft": dict(recolor=True, iris="#104a80", light_c="#3a90d0", why="기준종(동결) · 모양 그대로, 홍채만 바다 파랑"),
    "tidekeeper": dict(tpl="pin", iris="#0a4a5a", light_c="#40b0c0", why="물·얼음 3단 · 맑은 청록 홍채에 작은 동공(차분함)"),
    # grass starters
    "leafling": dict(tpl="glossy", iris="#1e5010", light_c="#80c838", why="풀 아기 · 큰 광택 눈, 잎 초록 (눈 다시 그림)"),
    "frondhare": dict(recolor=True, iris="#2a5a1a", light_c="#70b040", why="기준종(동결) · 모양 그대로, 홍채만 잎색"),
    "grovewarden": dict(tpl="almond", iris="#183e20", light_c="#68b070", brow="flat", why="풀·에스퍼 3단 · 아몬드 눈 + 곧은 눈썹(현자), 숲 초록"),
    # normal/flying birds
    "gustchick": dict(tpl="bead", iris="#18285a", light_c="#4060a8", why="아기 새 · 작은 구슬 눈, 남색 (4차 그림 복원)"),
    "ribbonwing": dict(tpl="roundtr", iris="#183a80", light_c="#5080d8", lash=2, why="새 2단 · 둥근 눈 + 속눈썹, 반짝임 오른쪽"),
    "galecrest": dict(tpl="pin", iris="#5a3a08", light_c="#e8b030", brow="up", why="맹금 3단 · 금빛 홍채 + 작은 동공 + 눈썹"),
    # bugs
    "pipbug": dict(tpl="sparkle", iris="#184a28", light_c="#58c060", why="벌레 아기 · 반짝임 둘 큰 눈, 새싹 초록"),
    "podback": dict(tpl="compound", iris="#3a4a10", light_c="#90b040", why="벌레·풀 2단 · 겹눈, 올리브"),
    "orchardant": dict(tpl="sharp", iris="#183a10", light_c="#60a040", why="벌레·풀 3단 · 날선 눈, 짙은 초록"),
    "wickworm": dict(tpl="round", iris="#6a3a06", light_c="#e0a020", why="반딧불 아기 · 둥근 눈, 호박 불빛 홍채(계통 금빛의 시작)"),
    "lanternwing": dict(tpl="roundtr", iris="#4a4a06", light_c="#c8d040", why="벌레·불 2단 나방 · 레몬 연두 홍채, 반짝임 오른쪽 위"),
    "beaconmoth": dict(tpl="glow", iris="#5a2806", light_c="#d07018", glow="#e89838", why="벌레·불 3단 · 주황 후광 눈"),
    # ground pigs
    "rootpig": dict(recolor=True, iris="#4a2a10", light_c="#b07030", why="기준종(동결) · 모양 그대로, 홍채만 흙색"),
    "brambleboar": dict(tpl="bead", iris="#3a3a10", light_c="#8a8a30", brow="flat", why="땅·풀 2단 · 작은 구슬 눈 + 평평한 눈썹"),
    "briartusk": dict(tpl="sharp", iris="#2a3a10", light_c="#7a8a30", brow="heavy", why="땅·풀 3단 · 날선 눈 + 무거운 눈썹"),
    # crabs (stalk eyes, both on stalks)
    "coralpin": dict(tpl="bead", iris="#6a1828", light_c="#d05060", why="게 아기 · 눈자루 구슬, 산호 홍채"),
    "reefguard": dict(tpl="pin", iris="#601008", light_c="#e05838", why="게 2단 · 눈자루 끝 밝은 다홍 홍채에 작은 동공"),
    "atollclamp": dict(tpl="beadsm", iris="#0a3a3a", light_c="#40a8a8", why="게 3단 · 작은 눈자루 눈, 청록"),
    # sea dragons
    "curlfin": dict(tpl="glossy", iris="#0a4848", light_c="#38b8a8", lash=2, why="해마 아기 · 광택 눈 + 속눈썹, 청록"),
    "brinewyrm": dict(tpl="slit", iris="#0a3a28", light_c="#60d0a8", dy=2, why="용·물 2단 · 세로 동공, 바다초록"),
    "abyssail": dict(tpl="slitalm", iris="#082a50", light_c="#40c0e8", dx=1, why="용·물 3단 · 가는 세로 동공 아몬드, 심해 파랑"),
    # electric
    "zaptoe": dict(tpl="sparkle", iris="#102a70", light_c="#3a78e0", why="전기 아기 · 반짝임 둘, 전기 파랑"),
    "coilcrest": dict(tpl="almond", iris="#6a2408", light_c="#e07020", dy=1, why="전기 2단 · 아몬드 눈, 호박색 홍채"),
    "stormskink": dict(tpl="slit", iris="#6a1606", light_c="#e05020", dx=2, dy=1, why="전기·용 3단 · 다홍 홍채 세로 동공"),
    # rocks
    "pebblekid": dict(tpl="round", iris="#283848", light_c="#8098b0", why="바위 아기 · 둥근 눈, 청회색 (BEFORE 그림 그대로 + 눈)"),
    "craghoof": dict(tpl="roundtr", iris="#3a2818", light_c="#907050", brow="up", why="바위·격투 2단 · 둥근 눈 + 눈썹, 회갈"),
    "ridgehorn": dict(tpl="beadsm", iris="#3a1810", light_c="#904838", brow="heavy", fkeep=True, why="바위·격투 3단 · 작은 눈 + 무거운 눈썹"),
    # moles
    "gritnose": dict(tpl="sleepy", iris="#3a2410", light_c="#906030", fkeep=True, why="두더지 아기 · 반쯤 감은 눈(눈부심)"),
    "tunnelpaw": dict(tpl="sleepy", iris="#2e1a0a", light_c="#805020", brow="flat", fkeep=True, why="두더지 2단 · 졸린 눈 + 눈썹"),
    "faultdigger": dict(tpl="sleepy", iris="#2a1006", light_c="#804020", brow="heavy", far="bead", dy=1, why="땅·바위 3단 · 두더지 계통 처진 눈꺼풀 + 무거운 눈썹, 흙빛"),
    # scorpions
    "sandnip": dict(tpl="roundtr", iris="#6a1030", light_c="#e06088", why="전갈 아기 · 둥근 눈(반짝임 오른쪽 위), 꼬리 구슬 같은 장밋빛 홍채"),
    "dunestalk": dict(tpl="roundtr", iris="#5a1a10", light_c="#c85838", far="bead", fkeep=True, why="전갈 2단 · 둥근 눈, 반짝임 오른쪽"),
    "miragespike": dict(tpl="slitalm", iris="#5a1020", light_c="#e05060", why="전갈 3단 · 붉은 아몬드 세로 동공(신기루)"),
    # snow lynxes
    "flurrykit": dict(tpl="sparkle", iris="#0a3a5a", light_c="#78d8f8", why="눈표범 아기 · 반짝임 둘, 얼음 하늘색(물 아기 aqualing 과 구분)"),
    "rimepelt": dict(tpl="almond", iris="#182a5a", light_c="#80b0f0", why="눈표범 2단 · 아몬드 눈, 얼음 하늘색"),
    "glaciermane": dict(tpl="sharp", iris="#282058", light_c="#a890f0", why="눈표범 3단 · 날선 눈, 라벤더 홍채"),
    # newts
    "miretail": dict(tpl="roundtr", iris="#381a5a", light_c="#a070d8", why="독·물 아기 · 보라 홍채, 반짝임 오른쪽"),
    "venomfrill": dict(tpl="almond", iris="#381050", light_c="#a850d0", lash=2, why="독·물 2단 · 아몬드 + 속눈썹, 독보라"),
    "marshcrown": dict(tpl="sleepy", iris="#281040", light_c="#a060e0", why="독·물 3단 · 거만한 반쯤 감은 눈"),
    # mantises
    "dozemite": dict(tpl="sleepybig", iris="#18483a", light_c="#60d0a8", why="에스퍼·벌레 아기 · 졸린 눈(설정), 민트"),
    "trancescythe": dict(tpl="sharp", iris="#281a58", light_c="#80e0c0", why="에스퍼·벌레 2단 · 날 선 사마귀 눈, 민트 홍채"),
    "oraclemantis": dict(tpl="glow", iris="#14304a", light_c="#40a0b8", glow="#a8f0d8", why="에스퍼·벌레 3단 · 민트 후광 눈"),
    # ghost dolls
    "threadimp": dict(tpl="bead", iris="#30183a", light_c="#9070b0", why="고스트 아기 인형 · 단추 같은 작은 눈"),
    "hushdoll": dict(tpl="glossy", iris="#2a1a5a", light_c="#9070d0", why="고스트 2단 인형 · 큰 유리구슬 눈, 제비꽃"),
    "veilmaster": dict(tpl="glow", iris="#1a0a3a", light_c="#6040a8", glow="#d0b0ff", why="고스트 3단 · 보라 후광 눈"),
    # herons
    "reedpeep": dict(tpl="bead", iris="#4a4006", light_c="#c0b030", why="왜가리 아기 · 작은 구슬 눈, 부리 같은 올리브 금색"),
    "fenstrider": dict(tpl="pin", iris="#6a1008", light_c="#e05030", why="왜가리 2단 · 붉은 홍채 + 작은 동공(물새 붉은 눈)"),
    "mistralheron": dict(tpl="sharp", iris="#5a4a06", light_c="#e0c030", why="왜가리 3단 · 날선 금빛 눈(물새의 노란 눈)"),
    # legendaries
    "thundercairn": dict(tpl="sharp", iris="#0a3a50", light_c="#48d0f0", brow="up", why="전설 전기·바위 · 날선 눈 + 치켜뜬 눈썹, 번개 하늘색"),
    "winterquill": dict(tpl="bead", iris="#183a6a", light_c="#90c8f8", why="전설 얼음·비행 · 정면 두 구슬 눈(사이 띄움), 얼음 파랑"),
    "solmane": dict(tpl="slitalm", iris="#6a3006", light_c="#f8b030", why="전설 사자 · 금빛 세로 동공 아몬드"),
    "lunavane": dict(tpl="glow", iris="#0a2a5a", light_c="#4070c0", glow="#b0f0ff", why="전설 달 가오리 · 하늘색 후광 눈"),
    "relicarab": dict(tpl="compound", iris="#4a3006", light_c="#d0a838", why="전설 풍뎅이 · 금빛 겹눈"),
    "astralhart": dict(tpl="roundtr", iris="#0a3a28", light_c="#50c098", lash=2, why="전설 별사슴 · 속눈썹 아몬드, 에메랄드"),
}

WHITE: Final = (251, 251, 251)


def species_ids() -> list[str]:
    return [s["id"] for s in json.loads((DATA / "seed.json").read_text(encoding="utf-8"))["species"]]


def outline_colour(arr: np.ndarray) -> tuple[int, int, int]:
    """Most common dark colour on the silhouette edge (the sprite's tinted outline)."""
    from collections import Counter
    a = arr[:, :, 3] > 0
    c: Counter = Counter()
    H, W = a.shape
    for y in range(H):
        for x in range(W):
            if a[y, x] and any(not (0 <= y + dy < H and 0 <= x + dx < W) or not a[y + dy, x + dx] for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1))):
                c[tuple(int(v) for v in arr[y, x, :3])] += 1
    dark = [(k, v) for k, v in c.items() if oklab(k)[0] < 0.4]
    return max(dark, key=lambda kv: kv[1])[0] if dark else min(c, key=lambda k: oklab(k)[0])


def light_pixel(arr, x, y) -> bool:
    return 0 <= x < 64 and 0 <= y < 64 and arr[y, x, 3] > 0 and oklab(arr[y, x, :3])[0] >= 0.45


def erase_box(arr: np.ndarray, box) -> None:
    """Refill a box row by row from the nearest light pixel on each side (left half from the left, right half from the right)."""
    x0, y0, w, h = box
    src = arr.copy()
    for y in range(y0, y0 + h):
        left = next((src[y, x, :].copy() for x in range(x0 - 1, x0 - 6, -1) if light_pixel(src, x, y)), None)
        right = next((src[y, x, :].copy() for x in range(x0 + w, x0 + w + 5) if light_pixel(src, x, y)), None)
        if left is None and right is None:
            mx = x0 + w // 2
            up = next((src[yy, mx, :].copy() for yy in range(y0 - 1, y0 - 6, -1) if light_pixel(src, mx, yy)), None)
            down = next((src[yy, mx, :].copy() for yy in range(y0 + h, y0 + h + 5) if light_pixel(src, mx, yy)), None)
            left = right = up if up is not None else down
        for x in range(x0, x0 + w):
            if arr[y, x, 3] == 0:
                continue
            c = left if (x - x0 < w / 2 and left is not None) or right is None else right
            if c is not None:
                arr[y, x, :] = c


def no_magenta(c: tuple[int, int, int]) -> tuple[int, int, int]:
    """The build rejects magenta-cast pixels (OKLab a > 0.09 and b < -0.01): pull such purples/pinks to b = 0."""
    L, a, b = oklab(c)
    return from_oklab(L, a, 0.0) if a > 0.09 and b < -0.01 else c


def colours_for(spec: dict, arr: np.ndarray, tol: float = 0.0) -> dict[str, tuple[int, int, int]]:
    pal = palette(arr)
    rim = outline_colour(arr)
    out = {"D": rim, "L": rim, "P": min(pal, key=lambda c: oklab(c)[0]),
           "I": no_magenta(snap(iris_dark(spec["iris"]), pal, 4.0 + tol)), "H": no_magenta(snap(spec["light_c"], pal, 6.0 + tol)), "W": WHITE}
    if spec.get("glow"):
        out["G"] = no_magenta(snap(spec["glow"], pal, 8.0 + tol))
    return out


def with_extras(rows: list[str], spec: dict) -> tuple[list[str], int]:
    """Lashes (off the back = right corner, 8-connected only) and brows (header rows above the eye). Returns rows and the header height.
    Header pixels are only drawn on light face skin (see stamp), so a brow never thickens the head outline."""
    lash, brow = spec.get("lash", 0), spec.get("brow")
    if not lash and not brow:
        return list(rows), 0
    w = len(rows[0])
    pad = 1 if lash else 0
    nh = 3 if brow in ("up", "flat") else 2
    head = [["."] * (w + pad) for _ in range(nh)]
    body = [r + "." * pad for r in rows]
    top = [i for i, c in enumerate(rows[0]) if c != "."]
    if brow == "up":       # stepped line, low at the front, high at the back, one skin row above the eye
        for x in range(max(0, top[0] - 1), top[0] + 1):
            head[1][x] = "B"
        for x in range(top[0] + 1, min(w + pad, top[-1] + 2)):
            head[0][x] = "B"
    elif brow == "flat":
        for x in range(top[0], top[-1] + 1):
            head[0][x] = "B"
    elif brow == "heavy":  # thick and low: sits on the lid
        for x in range(max(0, top[0] - 1), top[-1] + 1):
            head[1][x] = "B"
        for x in range(top[0] + 1, min(w + pad, top[-1] + 2)):
            head[0][x] = "B"
    if lash:
        last = top[-1]
        head[-1][last + 1] = "B"
        if lash >= 2:
            head[-2][min(last + 2, w + pad - 1)] = "B"
    return ["".join(r) for r in head] + body, nh


def stamp(arr: np.ndarray, rows: list[str], x0: int, y0: int, cmap: dict, body: np.ndarray) -> list[int]:
    """Stamp and return the bbox of the stamped eye pixels (the glow halo G is not part of the eye box)."""
    pts = []
    for dy, r in enumerate(rows):
        for dx, ch in enumerate(r):
            if ch == ".":
                continue
            x, y = x0 + dx, y0 + dy
            if 0 <= x < 64 and 0 <= y < 64 and body[y, x]:
                if ch == "B" and not light_pixel(arr, x, y):
                    continue
                arr[y, x, :3] = cmap["L" if ch == "B" else ch]
                arr[y, x, 3] = 255
                if ch != "G":
                    pts.append((x, y))
    xs, ys = [p[0] for p in pts], [p[1] for p in pts]
    return [min(xs), min(ys), max(xs) - min(xs) + 1, max(ys) - min(ys) + 1]


def bbox(rows: list[str], x0: int, y0: int) -> list[int]:
    pts = [(x0 + dx, y0 + dy) for dy, r in enumerate(rows) for dx, ch in enumerate(r) if ch != "."]
    xs, ys = [p[0] for p in pts], [p[1] for p in pts]
    return [min(xs), min(ys), max(xs) - min(xs) + 1, max(ys) - min(ys) + 1]


def recolor(arr: np.ndarray, entry: dict, spec: dict) -> None:
    """Frozen reference eyes: keep every pixel position, swap the warm iris colours for the species hue."""
    pal = palette(arr)
    iris, light = snap(spec["iris"], pal), snap(spec["light_c"], pal)
    for key in ("near", "far"):
        box = entry.get(key)
        if not box:
            continue
        x0, y0, w, h = box
        cells = [(x, y) for y in range(y0, y0 + h) for x in range(x0, x0 + w) if arr[y, x, 3]]
        darkest = min({tuple(int(v) for v in arr[y, x, :3]) for x, y in cells}, key=lambda c: oklab(c)[0])
        for x, y in cells:
            c = tuple(int(v) for v in arr[y, x, :3])
            L, a, b = oklab(c)
            if c == darkest or (a * a + b * b) ** 0.5 <= 0.03 or L >= 0.85:
                continue
            arr[y, x, :3] = iris if L < 0.4 else light


def dark_px(arr, x, y) -> bool:
    return 0 <= x < 64 and 0 <= y < 64 and arr[y, x, 3] > 0 and oklab(arr[y, x, :3])[0] < 0.4


def edge_px(arr, x, y) -> bool:
    return arr[y, x, 3] > 0 and any(not (0 <= x + dx < 64 and 0 <= y + dy < 64) or arr[y + dy, x + dx, 3] == 0 for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)))


def clean_ghosts(out: np.ndarray, before: np.ndarray, boxes: list[list[int]]) -> None:
    """Old-eye leftovers: dark, non-outline pixels within 2 px of a new eye box that touch its dark pixels
    (the V5 rule) and were dark before the stamp too — refill them from the nearest light pixel in the row."""
    inside = lambda x, y, pad=0: any(b[0] - pad <= x < b[0] + b[2] + pad and b[1] - pad <= y < b[1] + b[3] + pad for b in boxes)
    stack = [(x, y) for b in boxes for y in range(b[1], b[1] + b[3]) for x in range(b[0], b[0] + b[2]) if dark_px(out, x, y)]
    seen, ghosts = set(stack), []
    while stack:
        x, y = stack.pop()
        for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            nx, ny = x + dx, y + dy
            if (nx, ny) in seen or inside(nx, ny) or not inside(nx, ny, 2) or not dark_px(out, nx, ny) or edge_px(out, nx, ny):
                continue
            seen.add((nx, ny))
            ghosts.append((nx, ny))
            stack.append((nx, ny))
    for x, y in ghosts:
        erase_box(out, [x, y, 1, 1])


def fit(arr: np.ndarray, rows: list[str], x0: int, y0: int, reach: int) -> tuple[int, int]:
    """Nearest offset (≤ reach px) where the eye and a 1-px ring around it lie inside the body, clear of the silhouette edge
    (the V1 rule). Falls back to the requested spot."""
    cells = [(dx, dy) for dy, r in enumerate(rows) for dx, ch in enumerate(r) if ch not in ".G"]
    xs, ys = [c[0] for c in cells], [c[1] for c in cells]
    def ok(ox, oy) -> bool:
        for y in range(oy + min(ys) - 1, oy + max(ys) + 2):
            for x in range(ox + min(xs) - 1, ox + max(xs) + 2):
                if not (0 <= x < 64 and 0 <= y < 64) or arr[y, x, 3] == 0:
                    return False
        return not any(edge_px(arr, ox + dx, oy + dy) for dx, dy in cells)
    cands = sorted(((ax, ay) for ax in range(-reach, reach + 1) for ay in range(-reach, reach + 1)), key=lambda t: (abs(t[0]) + abs(t[1]), abs(t[1])))
    for ax, ay in cands:
        if ok(x0 + ax, y0 + ay):
            return x0 + ax, y0 + ay
    return x0, y0


def redraw(sid: str, arr: np.ndarray, entry: dict, spec: dict) -> tuple[np.ndarray, dict]:
    for tol in (0.0, 6.0, 12.0, 20.0):
        out, new = _redraw(arr, entry, spec, tol)
        if len(palette(out)) <= 20:
            break
    return out, new


def _redraw(arr: np.ndarray, entry: dict, spec: dict, tol: float) -> tuple[np.ndarray, dict]:
    out = arr.copy()
    if spec.get("recolor"):
        recolor(out, entry, spec)
        return out, dict(entry)
    body = out[:, :, 3].copy()
    cmap = colours_for(spec, out, tol)
    for b in [entry["near"]] + [entry[k] for k in ("far", "second") if entry.get(k)]:
        erase_box(out, b)
    new = {k: v for k, v in entry.items() if k not in ("near", "far", "second", "accept")}
    new["style"] = spec["tpl"]
    new["far"] = None
    base = TEMPLATES[spec["tpl"]]
    bw, bh = len(base[0]), len(base)
    rows, head = with_extras(base, spec)
    nx, ny, nw, nh = entry["near"]
    x0 = int(round(nx + nw / 2 + spec.get("dx", 0) - bw / 2))
    y0 = int(round(ny + nh / 2 + spec.get("dy", 0) - bh / 2))
    fx, fy = fit(arr, rows, x0, y0 - head, spec.get("fit", 2))
    x0, y0 = fx, fy + head
    new["near"] = stamp(out, rows, x0, y0 - head, cmap, body)
    if entry.get("second"):
        sx, sy, sw, sh = entry["second"]
        if entry["anatomy"] == "frontal":   # mirrored partner at the same height
            srows = [r[::-1] for r in rows]
            sx0 = int(round(sx + sw / 2 - spec.get("dx", 0) - bw / 2)) - (len(srows[0]) - bw)
            new["second"] = stamp(out, srows, sx0, y0 - head, cmap, body)
        else:                               # stalk partner: same eye, no extras
            sx0 = int(round(sx + sw / 2 - bw / 2 + spec.get("sdx", 0)))
            sy0 = int(round(sy + sh / 2 - bh / 2 + spec.get("sdy", 0)))
            new["second"] = stamp(out, base, sx0, sy0, cmap, body)
    if entry.get("far") and entry["anatomy"] == "threequarter" and not spec.get("nofar"):
        frows = FAR[spec.get("far") or FAR_OF[spec["tpl"]]]
        fw, fh = len(frows[0]), len(frows)
        fx0 = int(round(entry["far"][0] + entry["far"][2] / 2 - fw / 2)) + spec.get("fdx", 0)
        fy0 = int(round(y0 + bh / 2 - fh / 2)) + spec.get("fdy", 0)
        if spec.get("fkeep"):               # the face has no room to move it: keep the old far eye's centre
            fy0 = int(round(entry["far"][1] + entry["far"][3] / 2 - fh / 2))
        else:
            fx0 = max(min(fx0, x0 - fw - 1), x0 - fw - 3)
        new["far"] = stamp(out, frows, fx0, fy0, cmap, body)
    clean_ghosts(out, arr, [new[k] for k in ("near", "far", "second") if new.get(k)])
    return out, new


# ═══════════════════════════════════════════════════════════════════════════
# io
# ═══════════════════════════════════════════════════════════════════════════

def file_sha(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def main_sha(path: Path) -> str | None:
    rel = path.relative_to(ROOT).as_posix()
    try:
        data = subprocess.run(["git", "show", f"origin/main:{rel}"], cwd=ROOT, capture_output=True, check=True).stdout
    except subprocess.CalledProcessError:
        return None
    return hashlib.sha256(data).hexdigest()


def rgba_sha(arr: np.ndarray) -> str:
    return hashlib.sha256(np.ascontiguousarray(arr).tobytes()).hexdigest()


def dump_table(table: dict) -> str:
    lines = ["{", f'  "version": {table["version"]},', '  "species": {']
    items = list(table["species"].items())
    for i, (k, v) in enumerate(items):
        lines.append(f'    "{k}": {json.dumps(v, ensure_ascii=False)}' + ("," if i < len(items) - 1 else ""))
    lines += ["  }", "}"]
    return "\n".join(lines) + "\n"


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("--out-dir", type=Path)
    ap.add_argument("--species")
    ap.add_argument("--apply", action="store_true")
    ap.add_argument("--catalog-json", type=Path)
    a = ap.parse_args(argv)
    ids = species_ids()
    if a.catalog_json:
        a.catalog_json.write_text(json.dumps({k: {kk: vv for kk, vv in v.items()} for k, v in CATALOG.items()}, ensure_ascii=False, indent=1), encoding="utf-8")
        return 0
    missing = [s for s in ids if s not in CATALOG]
    if missing:
        print("catalog missing:", missing, file=sys.stderr)
        return 1
    only = a.species.split(",") if a.species else ids
    table = json.loads(TABLE_PATH.read_text(encoding="utf-8"))
    ledger = json.loads(LEDGER_PATH.read_text(encoding="utf-8"))
    new_table = json.loads(json.dumps(table))
    for sid in only:
        spec = CATALOG[sid]
        path = AUTHORED / f"{sid}-front.png"
        arr = np.array(Image.open(path).convert("RGBA"))
        entry = table["species"][sid]
        out, new = redraw(sid, arr, entry, spec)
        n_col = len(palette(out))
        print(f"{sid}: {spec.get('tpl', 'recolor')} near {new.get('near')} far {new.get('far')} second {new.get('second')} colours {n_col}{'  !! >20' if n_col > 20 else ''}")
        new_table["species"][sid] = new
        if a.out_dir:
            a.out_dir.mkdir(parents=True, exist_ok=True)
            Image.fromarray(out, "RGBA").save(a.out_dir / f"{sid}-front.png")
        if a.apply:
            Image.fromarray(out, "RGBA").save(path, optimize=True)
            after = file_sha(path)
            before = main_sha(path) or file_sha(path)
            pick = ledger["picks"][sid]["front"]
            pick["authored"] = f"authored/{sid}-front.png"
            pick["previousAuthoredSha256"] = before
            pick["authoredSha256"] = after
            new["patch"] = {"from": before, "to": after, "source": SOURCE}
            new.pop("repair", None)
            if new.get("frozen"):
                new["frozen"] = dict(new["frozen"], front=rgba_sha(out))
            new_table["species"][sid] = new
    if a.out_dir:
        (a.out_dir / "eyes.json").write_text(dump_table(new_table), encoding="utf-8")
    if a.apply:
        TABLE_PATH.write_text(dump_table(new_table), encoding="utf-8")
        LEDGER_PATH.write_text(json.dumps(ledger, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
