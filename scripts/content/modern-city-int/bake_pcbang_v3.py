#!/usr/bin/env python3
"""한국 PC방 v3 (Carbon 100% 다크톤 전용 기물 21종 + 바닥 2종 + 벽면 2종) modern_city 번들 굽기 (append-only).

사용법:
  python3 scripts/content/modern-city-int/bake_pcbang_v3.py build-pieces   # PNG 조각 + waiver-manifest.json + preview 생성
  python3 scripts/content/modern-city-int/bake_pcbang_v3.py gate           # object-gate 출구(bundle) 상태 확인
  python3 scripts/content/modern-city-int/bake_pcbang_v3.py bake [--dry]   # 관문 확인 후 modern-city-chipset.png · JSON · pins 덧붙이기

규칙:
  - 순수 #000000 0px 강제 검증.
  - 앞 타일 번호(< count0) 화소 100% 불변 검증.
  - object_gate.refusal(im, kind, context='bundle') 이 None 인 조각만 굽는다(우회 금지, 오너 면제 묶음 기록 선행).
"""
from __future__ import annotations

import json
import math
import os
import sys
from pathlib import Path

from PIL import Image, ImageDraw

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]
sys.path.insert(0, str(ROOT / "src" / "harnesses" / "_core"))
import numpy as np  # noqa: E402
import object_gate as OG  # noqa: E402

SRC_V3 = ROOT / "tiledata" / "dungeon-arch-v2" / "modern_pcbang_v3" / "objects"
OUT_DIR = ROOT / "tiledata" / "modern-city" / "pcbang-v3"
PIECES_DIR = OUT_DIR / "pieces"
MANIFEST_PATH = OUT_DIR / "waiver-manifest.json"
PREVIEW_PATH = OUT_DIR / "preview_new_dark_props_3x.png"
OWN_PATH = OUT_DIR / "baked.json"
REPORT_PATH = OUT_DIR / "bake-report.json"

PNG_PATH = ROOT / "public" / "assets" / "modern-city" / "modern-city-chipset.png"
TS_PATH = ROOT / "src" / "assets" / "modernCityTileset.json"
RS_PATH = ROOT / "src" / "assets" / "modernCityRoomSpec.json"
SH_PATH = ROOT / "src" / "assets" / "modernCitySheet.json"
PINS_PATH = ROOT / "tiledata" / "modern-city" / "pins.json"

WAIVER_BATCH_ID = "owner-pcbang-carbon-2026-11-28"
T = 16


def hx(s: str, a: int = 255) -> tuple[int, int, int, int]:
    s = s.lstrip("#")
    rgb = (int(s[0:2], 16), int(s[2:4], 16), int(s[4:6], 16))
    assert rgb != (0, 0, 0), "Pure #000000 forbidden"
    return (rgb[0], rgb[1], rgb[2], a)


def darken(rgba: tuple[int, int, int, int], delta: int) -> tuple[int, int, int, int]:
    if rgba[3] == 0:
        return rgba
    r = max(12, rgba[0] - delta)
    g = max(14, rgba[1] - delta)
    b = max(20, rgba[2] - delta)
    return (r, g, b, rgba[3])


def assert_no_pure_black(im: Image.Image, label: str) -> None:
    arr = np.asarray(im.convert("RGBA"))
    mask = (arr[:, :, 3] > 0) & (arr[:, :, 0] == 0) & (arr[:, :, 1] == 0) & (arr[:, :, 2] == 0)
    cnt = int(mask.sum())
    assert cnt == 0, f"{label}: found {cnt} pure #000000 pixels"


# ── 1. Floors (64×64 = 16 tiles: ((y%2)*2 + x%2)*4 + shadow) ──
def draw_floor_sheet(smoke: bool = False) -> Image.Image:
    sheet = Image.new("RGBA", (64, 64), (0, 0, 0, 0))
    c0 = hx("#1b1f2a") if not smoke else hx("#202634")
    c1 = hx("#202534") if not smoke else hx("#272e3e")
    c2 = hx("#252b3c") if not smoke else hx("#2e3648")
    seam = hx("#151923")
    accent = hx("#1e2d3f") if not smoke else hx("#2a3446")

    for ty in range(2):
        for tx in range(2):
            base = Image.new("RGBA", (16, 16), c0 if (tx + ty) % 2 == 0 else c1)
            px = base.load()
            for y in range(16):
                for x in range(16):
                    if x == 0 or y == 0:
                        px[x, y] = seam
                    elif smoke and (x + y) % 5 == 0:
                        px[x, y] = c2
                    elif not smoke and ((x * 3 + y * 5 + tx + ty) % 11 == 0):
                        px[x, y] = c2
                    elif not smoke and x in (7, 8) and y == 8 and (tx + ty) == 1:
                        px[x, y] = accent
            for sh in range(4):
                v = base.copy()
                vp = v.load()
                if sh in (1, 3):  # north wall shadow
                    for sy, d in ((0, 8), (1, 5), (2, 3)):
                        for sx in range(16):
                            vp[sx, sy] = darken(vp[sx, sy], d)
                if sh in (2, 3):  # west wall shadow
                    for sx, d in ((0, 7), (1, 5), (2, 3), (3, 2)):
                        for sy in range(16):
                            vp[sx, sy] = darken(vp[sx, sy], d)
                idx = ((ty * 2 + tx) * 4) + sh
                sheet.paste(v, ((idx % 4) * 16, (idx // 4) * 16))
    return sheet


# ── 2. Walls (64×32 = 8 tiles: (row*2 + x%2)*2 + west) ──
def draw_wall_dark() -> Image.Image:
    sheet = Image.new("RGBA", (64, 32), (0, 0, 0, 0))
    for tx in range(2):
        col32 = Image.new("RGBA", (16, 32), hx("#232938"))
        px = col32.load()
        for y in range(32):
            for x in range(16):
                if y == 0:
                    px[x, y] = hx("#141822")
                elif y == 1:
                    px[x, y] = hx("#1d3d56")
                elif y == 2:
                    px[x, y] = hx("#39b7db") if (x + tx) % 8 != 0 else hx("#7ce8ff")
                elif y == 3:
                    px[x, y] = hx("#1c3448")
                elif 4 <= y <= 18:
                    px[x, y] = hx("#252b3b") if x not in (0, 15) else hx("#1d2230")
                elif y == 19:
                    px[x, y] = hx("#31394d")
                elif 20 <= y <= 28:
                    px[x, y] = hx("#1d2230") if (x + y) % 6 != 0 else hx("#222838")
                elif y == 29:
                    px[x, y] = hx("#2b3346")
                else:
                    px[x, y] = hx("#141822")
        for row in range(2):
            tile = col32.crop((0, row * 16, 16, row * 16 + 16))
            for west in range(2):
                v = tile.copy()
                if west == 1:
                    vp = v.load()
                    for sx, d in ((0, 7), (1, 5), (2, 3), (3, 2)):
                        for sy in range(16):
                            vp[sx, sy] = darken(vp[sx, sy], d)
                idx = (row * 2 + tx) * 2 + west
                sheet.paste(v, ((idx % 4) * 16, (idx // 4) * 16))
    return sheet


def draw_wall_glass() -> Image.Image:
    """다크 알루미늄 멀리언 + 스모크 강화유리 파티션 부스 벽면 (흡연부스·팀룸 전용)."""
    sheet = Image.new("RGBA", (64, 32), (0, 0, 0, 0))
    for tx in range(2):
        col32 = Image.new("RGBA", (16, 32), hx("#1d2432"))
        px = col32.load()
        for y in range(32):
            for x in range(16):
                if y in (0, 31):
                    px[x, y] = hx("#131722")
                elif y in (1, 2):
                    px[x, y] = hx("#2d3648") if y == 1 else hx("#202838")
                elif y == 20:
                    # Horizontal waist mullion bar with subtle cyan trim
                    px[x, y] = hx("#344156")
                elif y == 21:
                    px[x, y] = hx("#18202c")
                elif x == 0 or (tx == 1 and x == 15):
                    # Dark aluminium vertical mullion
                    px[x, y] = hx("#2b3446") if x == 0 else hx("#19202c")
                elif 3 <= y <= 19:
                    # Tinted dark blue-slate tempered glass pane with diagonal specular sheen
                    d = (x + tx * 16 + y) % 19
                    if d in (3, 4):
                        px[x, y] = hx("#47627e")
                    elif d == 7:
                        px[x, y] = hx("#374d66")
                    else:
                        px[x, y] = hx("#263548") if y < 12 else hx("#223042")
                else:
                    # Dark anodized kickplate below glass
                    px[x, y] = hx("#1c2230") if (x + y) % 4 else hx("#22293a")
        for row in range(2):
            tile = col32.crop((0, row * 16, 16, row * 16 + 16))
            for west in range(2):
                v = tile.copy()
                if west == 1:
                    vp = v.load()
                    for sx, d in ((0, 7), (1, 5), (2, 3)):
                        for sy in range(16):
                            vp[sx, sy] = darken(vp[sx, sy], d)
                idx = (row * 2 + tx) * 2 + west
                sheet.paste(v, ((idx % 4) * 16, (idx // 4) * 16))
    return sheet


# ── 3. Five NEW Carbon Dark Wall & Lounge Props (replacing legacy bright props) ──
def draw_digital_menu() -> Image.Image:
    """32×32 hang: 다크 베젤 듀얼 디지털 메뉴판 (라면·핫도그·에이드 아이콘 + 사이언/앰버 가격 라인)."""
    im = Image.new("RGBA", (32, 32), (0, 0, 0, 0))
    px = im.load()
    # Mounting bracket + outer dark bezel (x=1..30, y=3..26)
    for x in range(6, 26):
        if x in (7, 8, 23, 24):
            px[x, 1] = hx("#181d28")
            px[x, 2] = hx("#2b3346")
    for y in range(3, 27):
        for x in range(1, 31):
            if y in (3, 26) or x in (1, 30) or x == 15 or x == 16:
                px[x, y] = hx("#141822") if (y == 26 or x in (1, 30)) else hx("#262e40")
            else:
                px[x, y] = hx("#192231")
    # Header bars: left = AMBER "FOOD", right = CYAN "ADE"
    for x in range(3, 14):
        px[x, 5] = hx("#d97c2b")
        px[x, 6] = hx("#f2a93b") if x % 2 == 0 else hx("#8a4b1c")
    for x in range(18, 29):
        px[x, 5] = hx("#2796ba")
        px[x, 6] = hx("#5fd8f7") if x % 2 == 0 else hx("#1d5a73")
    # Left screen: steaming ramen bowl icon (x=4..8, y=9..14) + price rows
    for x in range(4, 9):
        px[x, 12] = hx("#e0533c")
        px[x, 13] = hx("#a83427")
    for x in range(5, 8):
        px[x, 11] = hx("#f4cf63")
        px[x, 14] = hx("#d8dde8")
    px[5, 9] = hx("#95b4cc")
    px[7, 8] = hx("#95b4cc")
    for ry in (10, 13, 17, 20, 23):
        for x in range(10 if ry <= 13 else 4, 14):
            px[x, ry] = hx("#b8c7dc") if x < 11 else hx("#f2a93b")
    # Hotdog / snack icon at y=17..21 left
    px[5, 18] = hx("#d98a3c"); px[6, 18] = hx("#e04838"); px[7, 18] = hx("#d98a3c")
    px[5, 19] = hx("#b86b28"); px[6, 19] = hx("#f4cf63"); px[7, 19] = hx("#b86b28")
    # Right screen: glowing iced ade cups (pink grapefruit & blue lemon) + menu lines
    for cy_x, col_top, col_bot in ((19, "#f06292", "#c23b6b"), (23, "#4dd0e1", "#24869e")):
        px[cy_x + 1, 8] = hx("#d8dde8")  # straw
        px[cy_x + 1, 9] = hx("#d8dde8")
        for yy in range(10, 15):
            for xx in range(cy_x, cy_x + 3):
                px[xx, yy] = hx(col_top if yy < 12 else col_bot)
    for ry in (17, 20, 23):
        for x in range(18, 29):
            if x != 25:
                px[x, ry] = hx("#9ed9ec") if x < 25 else hx("#5fd8f7")
    # Under-bezel cyan indicator LED
    px[14, 26] = hx("#4ad8f5")
    px[17, 26] = hx("#4ad8f5")
    return im


def draw_esports_poster() -> Image.Image:
    """32×32 hang: 다크 네온 e스포츠 챔피언십 벽걸이 액자 (노란 영화포스터 대체)."""
    im = Image.new("RGBA", (32, 32), (0, 0, 0, 0))
    px = im.load()
    # Backlit neon aura on wall (subtle dark cyan/crimson edge)
    for y in range(2, 29):
        px[3, y] = hx("#1c3c52")
        px[28, y] = hx("#4a1e2e")
    for y in range(2, 29):
        for x in range(4, 28):
            if y in (2, 28) or x in (4, 27):
                px[x, y] = hx("#141822")
            elif y in (3, 27) or x in (5, 26):
                px[x, y] = hx("#2b3447")
            else:
                # Diagonal split dark background (left navy-cyan vs right crimson-violet)
                px[x, y] = hx("#182338") if (x + y // 2) < 21 else hx("#291a2c")
    # Center Championship Trophy + V-wings in pixel art
    trophy = [
        (14, 8, "#f5d36c"), (15, 8, "#fff0a6"), (16, 8, "#f5d36c"), (17, 8, "#d19b38"),
        (13, 9, "#4ad8f5"), (14, 9, "#f5d36c"), (15, 9, "#fff0a6"), (16, 9, "#e6b44c"), (17, 9, "#c4882b"), (18, 9, "#f04e68"),
        (13, 10, "#4ad8f5"), (14, 10, "#e6b44c"), (15, 10, "#f5d36c"), (16, 10, "#d19b38"), (17, 10, "#b07422"), (18, 10, "#f04e68"),
        (14, 11, "#d19b38"), (15, 11, "#f5d36c"), (16, 11, "#c4882b"), (17, 11, "#9c621c"),
        (15, 12, "#e6b44c"), (16, 12, "#b07422"),
        (15, 13, "#d19b38"), (16, 13, "#9c621c"),
        (14, 14, "#f5d36c"), (15, 14, "#fff0a6"), (16, 14, "#d19b38"), (17, 14, "#9c621c"),
    ]
    for x, y, c in trophy:
        px[x, y] = hx(c)
    # Neon diagonal VS slashes & title bar
    for i in range(6):
        px[8 + i, 17 - i // 2] = hx("#4ad8f5")
        px[23 - i, 17 - i // 2] = hx("#f04e68")
    for x in range(8, 24):
        if x % 3 != 0:
            px[x, 20] = hx("#d9e6f7")
        px[x, 23] = hx("#4ad8f5") if x < 16 else hx("#f04e68")
    return im


def draw_ac_dark() -> Image.Image:
    """32×32 hang: 다크 차콜 무풍 벽걸이 에어컨 (흰색 가정용 에어컨 대체)."""
    im = Image.new("RGBA", (32, 32), (0, 0, 0, 0))
    px = im.load()
    # Contact shadow below unit
    for x in range(3, 29):
        px[x, 19] = hx("#141822", 85)
    for y in range(6, 19):
        for x in range(2, 30):
            if y in (6, 18) or x in (2, 29):
                px[x, y] = hx("#141822")
            elif y == 7:
                px[x, y] = hx("#394359")  # 3/4 top bevel!
            elif y == 8:
                px[x, y] = hx("#2d3548")
            elif 9 <= y <= 13:
                px[x, y] = hx("#232a3a") if (x + y) % 3 else hx("#1e2433")
            elif y == 14:
                px[x, y] = hx("#181e2b")
            elif y in (15, 16):
                # Louver vent blades
                px[x, y] = hx("#131722") if y == 15 else hx("#2f394f")
            else:
                px[x, y] = hx("#1d2332")
    # Cyan digital temperature readout ("18°") on right front face
    for x in (23, 25, 26):
        px[x, 11] = hx("#5fd8f7")
        px[x, 12] = hx("#34a8cc")
    px[27, 10] = hx("#7ce8ff")
    return im


def draw_wait_sofa_dark() -> Image.Image:
    """48×32 floor (w=3, h=1, up=16): 다크 차콜 퀼팅 가죽 3인 대기 소파 벤치 (사이언 파이핑)."""
    im = Image.new("RGBA", (48, 32), (0, 0, 0, 0))
    px = im.load()
    # Ground shadow
    for x in range(3, 45):
        px[x, 30] = hx("#141822", 85)
        px[x, 31] = hx("#141822", 85)
    # Backrest top (3/4 top plane y=6..9) + quilted front face (y=10..17)
    for y in range(6, 18):
        for x in range(3, 45):
            if y == 6 or x in (3, 44):
                px[x, y] = hx("#141822")
            elif y == 7:
                px[x, y] = hx("#39b7db") if x % 14 != 0 else hx("#256d85")  # cyan piping accent
            elif y in (8, 9):
                px[x, y] = hx("#323a4e") if y == 8 else hx("#293042")
            elif x in (17, 30):
                px[x, y] = hx("#181d28")  # 3-cushion seam
            else:
                px[x, y] = hx("#242b3c") if (x + y) % 5 != 0 else hx("#2c3448")
    # Armrests (x=2..5, x=42..45, y=12..26) + Seat plane (3/4 top surface y=18..23, front apron y=24..27)
    for y in range(18, 28):
        for x in range(2, 46):
            if x in (2, 45) or y == 27:
                px[x, y] = hx("#141822")
            elif x in (3, 4, 43, 44):
                px[x, y] = hx("#353e54") if y < 21 else hx("#23293a")
            elif y <= 22:
                # 3/4 visible top cushion surface!
                if x in (17, 30):
                    px[x, y] = hx("#1b202e")
                else:
                    px[x, y] = hx("#2f384d") if y < 20 else hx("#293144")
            elif y == 23:
                px[x, y] = hx("#2a829e") if x % 2 == 0 else hx("#1e2536")
            else:
                px[x, y] = hx("#1c2230")
    # Dark steel legs (y=28..30)
    for lx in (5, 6, 23, 24, 41, 42):
        for ly in (28, 29):
            px[lx, ly] = hx("#2c3446") if lx % 2 == 1 else hx("#161a24")
    return im


def draw_side_table_dark() -> Image.Image:
    """32×32 floor (w=2, h=1, up=16): 다크 슬레이트 보조 테이블 (음료컵·잡지 디테일)."""
    im = Image.new("RGBA", (32, 32), (0, 0, 0, 0))
    px = im.load()
    for x in range(3, 29):
        px[x, 29] = hx("#141822", 85)
        px[x, 30] = hx("#141822", 85)
    # 3/4 Tabletop (y=11..19) + dark cyan front trim (y=20..22)
    for y in range(11, 23):
        for x in range(3, 29):
            if y == 11 or y == 22 or x in (3, 28):
                px[x, y] = hx("#141822")
            elif 12 <= y <= 18:
                px[x, y] = hx("#2d364a") if y < 15 else hx("#262e40")
            elif y == 19:
                px[x, y] = hx("#39b7db") if 5 <= x <= 26 else hx("#202736")
            else:
                px[x, y] = hx("#1d2332")
    # Tabletop details: iced drink cup (left) + dark gaming magazine (right)
    for yy in range(13, 17):
        px[8, yy] = hx("#5fd8f7"); px[9, yy] = hx("#2796ba")
    px[9, 12] = hx("#d8dde8")
    for yy in range(14, 18):
        for xx in range(16, 23):
            px[xx, yy] = hx("#dc4c64") if yy == 14 else hx("#39445c")
    # Steel legs + lower shelf bar (y=23..29)
    for yy in range(23, 29):
        for lx in (5, 6, 25, 26):
            px[lx, yy] = hx("#293142") if lx in (5, 25) else hx("#151924")
    for x in range(6, 26):
        px[x, 26] = hx("#202736")
        px[x, 27] = hx("#151924")
    return im


def tile_horiz(im: Image.Image, n: int) -> Image.Image:
    out = Image.new("RGBA", (im.width * n, im.height), (0, 0, 0, 0))
    for i in range(n):
        out.paste(im, (i * im.width, 0))
    return out


# (id, kind, gate_kind, w, h, up, walk_rows, ko, desc, tags, use, facing)
OBJ_SPECS = [
    ("pcb3-b2b-blue-5", "floor", "low_furniture", 10, 3, 16, [0, 3], "블루 양면 맞대기 10석 게이밍 아일랜드",
     "중앙 파티션·좌석번호표를 사이에 두고 남북으로 각 5석씩 마주 앉는 한국 PC방 표준 10석 아일랜드.",
     ["PC방", "피시방", "게이밍", "모니터", "컴퓨터", "책상", "의자"], ["sit"], None),
    ("pcb3-b2b-blue-4", "floor", "low_furniture", 8, 3, 16, [0, 3], "블루 양면 맞대기 8석 게이밍 아일랜드",
     "중앙 파티션을 사이에 두고 남북 4석씩 마주 앉는 8석 게이밍 아일랜드.",
     ["PC방", "피시방", "게이밍", "모니터", "컴퓨터", "책상", "의자"], ["sit"], None),
    ("pcb3-b2b-red-4", "floor", "low_furniture", 8, 3, 16, [0, 3], "240Hz FPS 레드 양면 맞대기 8석 아일랜드",
     "크림슨 LED 백라이트와 240Hz 게이밍 모니터를 갖춘 FPS 존 8석 양면 아일랜드.",
     ["PC방", "피시방", "FPS", "게이밍", "모니터", "컴퓨터"], ["sit"], None),
    ("pcb3-b2b-blue-1", "floor", "low_furniture", 2, 3, 16, [0, 3], "블루 양면 맞대기 2석 모듈",
     "북쪽 남향석과 남쪽 북향석이 파티션을 사이에 두고 맞댄 2석 게이밍 모듈.",
     ["PC방", "피시방", "게이밍", "컴퓨터", "좌석"], ["sit"], None),
    ("pcb3-b2b-red-1", "floor", "low_furniture", 2, 3, 16, [0, 3], "240Hz FPS 레드 양면 맞대기 2석 모듈",
     "크림슨 V-LED 후면 모니터와 파티션을 갖춘 FPS 2석 모듈.",
     ["PC방", "피시방", "FPS", "게이밍", "좌석"], ["sit"], None),
    ("pcb3-team-row-4", "floor", "low_furniture", 8, 2, 16, [2], "다인큐 팀룸 4연석 게이밍 데스크",
     "유리 부스 팀룸 벽을 따라 나란히 앉는 4인 다인큐 전용 게이밍 연석.",
     ["PC방", "피시방", "팀룸", "게이밍", "컴퓨터"], ["sit"], "N"),
    ("pcb3-team-desk-1", "floor", "low_furniture", 2, 2, 16, [2], "팀룸 단면 게이밍석(1인)",
     "커브드 듀얼 모니터·RGB 본체·버킷 체어를 갖춘 단면 게이밍 좌석.",
     ["PC방", "피시방", "게이밍", "컴퓨터", "좌석"], ["sit"], "N"),
    ("pcb3-kiosk-pair", "floor", "tall_furniture", 2, 1, 16, [], "무인 선불결제기 2연속 키오스크",
     "PC방 출입구 옆 시간 충전·좌석 배정용 무인 선불결제기 2대.",
     ["PC방", "피시방", "선불결제기", "키오스크", "결제"], ["counter"], "S"),
    ("pcb3-kiosk-1", "floor", "tall_furniture", 1, 1, 16, [], "무인 선불결제기",
     "터치스크린과 카드·지폐 투입구가 있는 PC방 무인 선불결제기.",
     ["PC방", "피시방", "선불결제기", "키오스크"], ["counter"], "S"),
    ("pcb3-counter-pos", "floor", "low_furniture", 3, 1, 16, [], "PC방 알바 POS 계산 카운터",
     "듀얼 포스기·바코드 스캐너·픽업 트레이가 놓인 다크 슬레이트 알바 카운터.",
     ["PC방", "피시방", "카운터", "계산대", "POS"], ["counter"], "S"),
    ("pcb3-drink-triple", "wall", "tall_furniture", 3, 1, 16, [], "3도어 음료 쇼케이스 냉장고",
     "에너지드링크·탄산음료·캔커피가 단별로 진열된 다크 프레임 3도어 냉장고.",
     ["PC방", "피시방", "냉장고", "음료", "매점"], ["search"], "S"),
    ("pcb3-snack-rack", "wall", "tall_furniture", 2, 1, 16, [], "컵라면·스낵 진열 선반",
     "종류별 용기면과 스낵 봉지가 4단으로 채워진 PC방 먹거리 진열대.",
     ["PC방", "피시방", "컵라면", "과자", "진열대", "매점"], ["search"], "S"),
    ("pcb3-ramen-bar", "wall", "tall_furniture", 3, 1, 16, [], "한강 즉석라면 조리기 & 얼음정수기 바",
     "인덕션 즉석라면 조리기 2구와 다크 스테인리스 얼음정수기 일체형 셀프 바.",
     ["PC방", "피시방", "라면", "정수기", "조리기", "매점"], ["heal"], "S"),
    ("pcb3-tray-bin", "floor", "container", 2, 1, 16, [], "3구 퇴식구·분리수거함",
     "식기 반납 트레이와 캔·플라스틱·국물 분리수거 구멍이 있는 PC방 퇴식구.",
     ["PC방", "피시방", "퇴식구", "분리수거", "휴지통"], ["block"], "S"),
    ("pcb3-ashtray", "floor", "container", 1, 1, 16, [], "스탠드형 재떨이",
     "흡연부스 안에 세워 두는 스테인리스 원통형 스탠드 재떨이.",
     ["PC방", "흡연", "흡연부스", "재떨이"], ["block"], None),
    ("pcb3-vent", "hang", "wall_mounted", 2, 0, 0, [], "흡연부스 천장 환풍 후드",
     "흡연부스 북쪽 벽 상단에 설치되는 다크 메탈 제연 환풍 후드.",
     ["PC방", "흡연", "흡연부스", "환풍기"], None, None),
    ("pcb3-digital-menu", "hang", "wall_mounted", 2, 0, 0, [], "PC방 다크 디지털 메뉴판",
     "먹거리·에이드 아이콘과 가격표가 켜진 다크 베젤 듀얼 디지털 메뉴 보드.",
     ["PC방", "피시방", "메뉴판", "매점"], ["read"], None),
    ("pcb3-esports-poster", "hang", "wall_mounted", 2, 0, 0, [], "e스포츠 네온 챔피언십 포스터",
     "사이언·크림슨 백라이트와 트로피 아트가 그려진 다크 프레임 게이밍 액자.",
     ["PC방", "피시방", "포스터", "게이밍", "액자"], ["read"], None),
    ("pcb3-ac-dark", "hang", "wall_mounted", 2, 0, 0, [], "다크 무풍 벽걸이 에어컨",
     "사이언 온도 표시등이 켜진 다크 차콜 상업용 벽걸이 에어컨.",
     ["PC방", "피시방", "에어컨", "가전"], None, None),
    ("pcb3-wait-sofa-dark", "floor", "low_furniture", 3, 1, 16, [], "PC방 다크 가죽 대기 소파(3인)",
     "사이언 파이핑 스티치가 들어간 다크 차콜 퀼팅 가죽 3인 대기 벤치.",
     ["PC방", "피시방", "대기", "소파", "벤치", "대기 소파"], ["sit"], "S"),
    ("pcb3-side-table-dark", "floor", "low_furniture", 2, 1, 16, [], "PC방 다크 스틸 사이드 테이블",
     "음료컵과 게이밍 잡지가 놓인 다크 슬레이트 보조 테이블.",
     ["PC방", "피시방", "대기", "사이드 테이블", "보조 테이블"], ["block"], None),
]

FLOOR_SPECS = [
    ("pcb-floor-dark", "PC방 다크 차콜 방음 카펫", ["PC방", "피시방", "카펫", "다크"]),
    ("pcb-floor-smoke", "흡연부스 다크 논슬립 타일", ["PC방", "흡연부스", "타일", "다크"]),
]

WALL_SPECS = [
    ("pcb-wall-dark", "PC방 다크 슬레이트 & 사이언 LED 벽면", ["PC방", "피시방", "다크", "LED"]),
    ("pcb-wall-glass", "다크 프레임 스모크 강화유리 부스 벽면", ["PC방", "흡연부스", "팀룸", "유리벽"]),
]


def build_pieces() -> None:
    PIECES_DIR.mkdir(parents=True, exist_ok=True)
    blue1 = Image.open(SRC_V3 / "b2b_pod_blue.png").convert("RGBA")
    red1 = Image.open(SRC_V3 / "b2b_pod_red.png").convert("RGBA")
    team1 = Image.open(SRC_V3 / "team_desk_blue.png").convert("RGBA")
    kiosk1 = Image.open(SRC_V3 / "prepay_kiosk.png").convert("RGBA")

    raw_map: dict[str, Image.Image] = {
        "pcb-floor-dark": draw_floor_sheet(smoke=False),
        "pcb-floor-smoke": draw_floor_sheet(smoke=True),
        "pcb-wall-dark": draw_wall_dark(),
        "pcb-wall-glass": draw_wall_glass(),
        "pcb3-b2b-blue-5": tile_horiz(blue1, 5),
        "pcb3-b2b-blue-4": tile_horiz(blue1, 4),
        "pcb3-b2b-red-4": tile_horiz(red1, 4),
        "pcb3-b2b-blue-1": blue1,
        "pcb3-b2b-red-1": red1,
        "pcb3-team-row-4": tile_horiz(team1, 4),
        "pcb3-team-desk-1": team1,
        "pcb3-kiosk-pair": tile_horiz(kiosk1, 2),
        "pcb3-kiosk-1": kiosk1,
        "pcb3-counter-pos": Image.open(SRC_V3 / "counter_pos_dark.png").convert("RGBA"),
        "pcb3-drink-triple": Image.open(SRC_V3 / "drink_fridge_triple.png").convert("RGBA"),
        "pcb3-snack-rack": Image.open(SRC_V3 / "snack_ramen_rack.png").convert("RGBA"),
        "pcb3-ramen-bar": Image.open(SRC_V3 / "ramen_water_bar.png").convert("RGBA"),
        "pcb3-tray-bin": Image.open(SRC_V3 / "tray_return_bin.png").convert("RGBA"),
        "pcb3-ashtray": Image.open(SRC_V3 / "smoking_ashtray.png").convert("RGBA"),
        "pcb3-vent": Image.open(SRC_V3 / "glass_booth_vent.png").convert("RGBA"),
        "pcb3-digital-menu": draw_digital_menu(),
        "pcb3-esports-poster": draw_esports_poster(),
        "pcb3-ac-dark": draw_ac_dark(),
        "pcb3-wait-sofa-dark": draw_wait_sofa_dark(),
        "pcb3-side-table-dark": draw_side_table_dark(),
    }

    gk_by_id = {s[0]: s[2] for s in OBJ_SPECS}
    manifest_items = []
    for pid, im in raw_map.items():
        assert_no_pure_black(im, pid)
        out_p = PIECES_DIR / f"{pid}.png"
        im.save(out_p)
        gkind = "terrain" if pid.startswith("pcb-floor-") else ("structure" if pid.startswith("pcb-wall-") else gk_by_id[pid])
        manifest_items.append({
            "png": str(out_p.relative_to(ROOT)),
            "kind": gkind,
            "label": f"modern_city/pcbang_v3/{pid}",
        })

    MANIFEST_PATH.write_text(json.dumps({
        "note": f"object-gate owner-waive manifest for {WAIVER_BATCH_ID} (100% Carbon Korean PC Bang v3 bundle).",
        "items": manifest_items,
    }, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    # Build 3x preview sheet of the new dark wall/lounge/glass pieces
    new_keys = ["pcb-wall-dark", "pcb-wall-glass", "pcb3-digital-menu", "pcb3-esports-poster", "pcb3-ac-dark", "pcb3-wait-sofa-dark", "pcb3-side-table-dark"]
    pv = Image.new("RGBA", (740, 150), hx("#12151e"))
    dr = ImageDraw.Draw(pv)
    cx = 14
    for k in new_keys:
        s3 = raw_map[k].resize((raw_map[k].width * 2, raw_map[k].height * 2), Image.Resampling.NEAREST)
        pv.paste(s3, (cx, 28), s3)
        dr.text((cx, 8), k.replace("pcb3-", "").replace("pcb-", ""), fill=(190, 210, 235, 255))
        cx += max(s3.width + 18, 96)
    pv.save(PREVIEW_PATH)
    print(f"Built {len(raw_map)} pieces -> {PIECES_DIR} & {MANIFEST_PATH}")


def check_gate() -> tuple[list[str], list[tuple[str, str]]]:
    manifest = json.loads(MANIFEST_PATH.read_text(encoding="utf-8"))
    opened, blocked = [], []
    for it in manifest["items"]:
        im = Image.open(ROOT / it["png"]).convert("RGBA")
        why = OG.refusal(im, kind=it["kind"], context="bundle")
        if why is None:
            opened.append(it["label"])
        else:
            blocked.append((it["label"], why))
    return opened, blocked


def bake(dry: bool = False) -> None:
    opened, blocked = check_gate()
    if blocked:
        raise SystemExit("3/4 관문 출구에서 막힘 %d:\n" % len(blocked) + "\n".join("  %s: %s" % b for b in blocked))

    sheet = Image.open(PNG_PATH).convert("RGBA")
    ts = json.loads(TS_PATH.read_text(encoding="utf-8"))
    rs = json.loads(RS_PATH.read_text(encoding="utf-8"))
    pins = json.loads(PINS_PATH.read_text(encoding="utf-8"))
    own = json.loads(OWN_PATH.read_text(encoding="utf-8")) if OWN_PATH.exists() else {"version": 1, "cells": {}}

    cols = ts["tilesPerRow"]
    assert cols == 48, cols
    count0 = ts["count"]
    count = max([count0] + [v + 1 for v in own["cells"].values()])

    PASS = {"up": True, "down": True, "left": True, "right": True}
    SOLID = {"up": False, "down": False, "left": False, "right": False}
    PLACE = {
        "wall": "북쪽 벽면 앞 첫 바닥 줄",
        "floor": "실내 배치",
        "hang": "벽면 윗줄",
    }

    mine: dict[int, tuple[Image.Image, dict, str, dict]] = {}
    new_kits: list[dict] = []

    def alloc_slot(pin_key: str, cell_im: Image.Image, pass_obj: dict, prio: str, meta_obj: dict) -> int:
        nonlocal count
        if pin_key in own["cells"]:
            tid = own["cells"][pin_key]
        else:
            tid = count
            count += 1
            own["cells"][pin_key] = tid
            pins["cells"][pin_key] = tid
        mine[tid] = (cell_im, pass_obj, prio, meta_obj)
        return tid

    # 1) Floors
    for fid, ko, tags in FLOOR_SPECS:
        im = Image.open(PIECES_DIR / f"{fid}.png").convert("RGBA")
        tiles = []
        for idx in range(16):
            cell = im.crop(((idx % 4) * T, (idx // 4) * T, (idx % 4) * T + T, (idx // 4) * T + T))
            tid = alloc_slot(
                f"pcbang3:floor:{fid}:{idx}",
                cell,
                PASS,
                "lower",
                {
                    "label": f"{ko} 바닥",
                    "description": f"{ko} (3/4 관문 미통과 — 오너 면제 {WAIVER_BATCH_ID}).",
                    "role": "terrain",
                    "passage": "passable",
                    "defaultLayer": "lower",
                    "tags": ["modern-city", "실내", *tags],
                    "source": "bundled-default",
                    "confidence": "high",
                    "repeatability": "repeat",
                },
            )
            tiles.append(tid)
        rs["floors"][fid] = {"ko": ko, "cols": 2, "rows": 2, "tiles": tiles}

    # 2) Walls
    for wid, ko, tags in WALL_SPECS:
        im = Image.open(PIECES_DIR / f"{wid}.png").convert("RGBA")
        tiles = []
        for idx in range(8):
            cell = im.crop(((idx % 4) * T, (idx // 4) * T, (idx % 4) * T + T, (idx // 4) * T + T))
            row_label = "윗줄" if idx < 4 else "아랫줄"
            tid = alloc_slot(
                f"pcbang3:wall:{wid}:{idx}",
                cell,
                SOLID,
                "lower",
                {
                    "label": f"{ko} {row_label}",
                    "description": f"{ko} (3/4 관문 미통과 — 오너 면제 {WAIVER_BATCH_ID}).",
                    "role": "terrain",
                    "passage": "solid",
                    "defaultLayer": "lower",
                    "tags": ["modern-city", "실내", *tags],
                    "source": "bundled-default",
                    "confidence": "high",
                    "repeatability": "fixed",
                },
            )
            tiles.append(tid)
        rs["walls"][wid] = {"ko": ko, "cols": 2, "tiles": tiles}

    # 3) Objects
    for pid, kind, _gk, w, h, up, walk_rows, ko, desc, tags, use, facing in OBJ_SPECS:
        im = Image.open(PIECES_DIR / f"{pid}.png").convert("RGBA")
        rows_px = im.height // T
        assert im.width == w * T, (pid, im.size, w)
        up_rows = up // T
        top = 0 if kind == "hang" else -up_rows
        cells = []
        krows = []
        for ry in range(rows_px):
            dy = top + ry
            ups = []
            for rx in range(w):
                cell = im.crop((rx * T, ry * T, rx * T + T, ry * T + T))
                if not cell.getbbox():
                    ups.append(-1)
                    continue
                is_walk = (ry < up_rows) or (ry in walk_rows) or (kind == "hang")
                solid = not is_walk
                tid = alloc_slot(
                    f"pcbang3:obj:{pid}:{rx},{ry}",
                    cell,
                    SOLID if solid else PASS,
                    "upper",
                    {
                        "label": f"{ko} ({rx},{dy})",
                        "description": f"{desc} (3/4 관문 미통과 — 오너 면제 {WAIVER_BATCH_ID})",
                        "role": "prop",
                        "passage": "solid" if solid else "passable",
                        "defaultLayer": "upper",
                        "tags": ["modern-city", "실내", *tags],
                        "source": "bundled-default",
                        "confidence": "high",
                        "repeatability": "fixed",
                        "layerBacking": "none",
                    },
                )
                cells.append([rx, dy, tid, 3])
                ups.append(tid)
            krows.append({"tiles": [-1] * w, "upperTiles": ups})

        kid = f"mc-in-pcb3-{pid}"
        new_kits.append({
            "id": kid,
            "kind": "section",
            "name": ko,
            "width": w,
            "height": rows_px,
            "tileSize": 16,
            "rows": krows,
            "learnedFrom": "modern-city-interior",
            "ai": {
                "description": f"{desc} — 3/4 관문 미통과 — 오너 면제({WAIVER_BATCH_ID}).",
                "placementRules": PLACE[kind],
                "tags": ["modern-city", "실내", "PC방", *tags],
                "role": "prop",
                "repeatability": "fixed",
                "layerHome": "upper",
                "themes": ["현대 도시"],
                "origin": "ai",
                "confidence": "high",
                "snap": "floor",
                "anchor": {"dx": 0, "dy": -top},
            },
        })
        rs["objects"][pid] = {
            "ko": ko,
            "kind": kind,
            "desc": desc,
            "tags": tags,
            "place": PLACE[kind],
            "category": "commercial",
            "category_ko": "상업·PC방",
            "cells": cells,
            "w": w,
            "h": h,
            "up": up,
            **({"use": use} if use else {}),
            **({"facing": facing} if facing else {}),
        }

    rows_n = math.ceil(count / cols)
    out_sheet = Image.new("RGBA", (cols * T, max(sheet.height, rows_n * T)), (0, 0, 0, 0))
    out_sheet.paste(sheet, (0, 0))
    for tid, (cell_im, *_rest) in mine.items():
        px_x, px_y = (tid % cols) * T, (tid // cols) * T
        out_sheet.paste(Image.new("RGBA", (T, T), (0, 0, 0, 0)), (px_x, px_y))
        out_sheet.paste(cell_im, (px_x, px_y))
        assert np.array_equal(np.asarray(out_sheet.crop((px_x, px_y, px_x + T, px_y + T))), np.asarray(cell_im)), tid

    # Verify zero mutation on existing tiles < count0
    a0 = np.asarray(sheet)
    a1 = np.asarray(out_sheet)[: sheet.height]
    changed = [
        t for t in range(min(count0, (sheet.height // T) * cols))
        if t not in mine and not np.array_equal(
            a0[(t // cols) * T : (t // cols) * T + T, (t % cols) * T : (t % cols) * T + T],
            a1[(t // cols) * T : (t // cols) * T + T, (t % cols) * T : (t % cols) * T + T],
        )
    ]
    assert not changed, f"Existing tiles mutated: {changed[:10]}"

    while len(ts["passability"]) < count:
        ts["passability"].append(PASS)
    while len(ts["priority"]) < count:
        ts["priority"].append("lower")
    while len(ts["terrain"]) < count:
        ts["terrain"].append(0)
    while len(ts["tileMeta"]) < count:
        ts["tileMeta"].append(None)

    for tid, (_im, p_obj, prio, m_obj) in mine.items():
        ts["passability"][tid] = p_obj
        ts["priority"][tid] = prio
        ts["terrain"][tid] = 0
        ts["tileMeta"][tid] = m_obj

    ts["count"] = count
    new_kit_ids = {k["id"] for k in new_kits}
    ts["structureKits"] = [k for k in ts.get("structureKits", []) if k.get("id") not in new_kit_ids] + new_kits

    report = {
        "gate": {
            "bundle_open": len(opened),
            "owner_waiver": {
                "batch": WAIVER_BATCH_ID,
                "note": "3/4 관문 미통과 — 오너 면제(통과가 아니다)",
                "count": len(opened),
            },
        },
        "tiles_before": count0,
        "tiles_after": count,
        "tiles_added_or_updated": len(mine),
        "sheet_size": list(out_sheet.size),
        "objects": len(OBJ_SPECS),
        "floors": len(FLOOR_SPECS),
        "walls": len(WALL_SPECS),
    }

    if dry:
        print("DRY OK:", json.dumps(report, ensure_ascii=False))
        return

    out_sheet.save(PNG_PATH, optimize=True)
    TS_PATH.write_text(json.dumps(ts, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")
    RS_PATH.write_text(json.dumps(rs, ensure_ascii=True, separators=(",", ":")) + "\n", encoding="utf-8")
    SH_PATH.write_text(f'{{"count": {count},"tilesPerRow": {cols}}}\n', encoding="utf-8")
    PINS_PATH.write_text(json.dumps(pins, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    OWN_PATH.write_text(json.dumps(own, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    REPORT_PATH.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print("BAKED OK:", json.dumps(report, ensure_ascii=False))


if __name__ == "__main__":
    cmd = sys.argv[1] if len(sys.argv) > 1 else "build-pieces"
    if cmd == "build-pieces":
        build_pieces()
    elif cmd == "gate":
        o, b = check_gate()
        print(f"open={len(o)} blocked={len(b)}")
        for lbl, why in b:
            print("  BLOCKED:", lbl, "->", why)
    elif cmd == "bake":
        bake(dry="--dry" in sys.argv[2:])
    else:
        raise SystemExit(f"Unknown command: {cmd}")
