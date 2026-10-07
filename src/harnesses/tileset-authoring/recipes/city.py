"""도시 건물 — 무지개시티·해변시티 문법: 평지붕 여러 층 건물(지붕 윗면이 3/4 로 보이고 난간·실외기),
층마다 창 줄, 1층은 유리문과 간판. 집(박공·평지붕 1층)과 같은 빛(왼쪽 위)·윤곽(재료의 가장 어두운 톤)·처마 밑 그림자 규칙.

tower(P, n, floors, scheme): n 칸 폭, floors 층(위층마다 16px, 3층까지), 1층 24px, 지붕 윗면 40px(2.5칸) → 높이 = 40 + 16·floors + 24.
문은 가운데 칸(n//2) 안에 14px 유리문 — 입구 좌표는 (n//2, 높이-1)."""
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "lib"))
import px  # noqa: E402
from px import T  # noqa: E402

SHADOW = (0, 0, 0, 64)

SCHEMES = {
    # 외벽 램프, 창 종류, 간판 램프, 차양 램프
    "store": ("plaster", "band", "i2_red", "i2_red"),
    "apart": ("brick", "balcony", None, None),
    "office": ("concrete", "curtain", "i2_blue", None),
    "hall": ("plaster", "band", "i2_green", "i2_green"),
    "shop": ("plaster", "band", "i2_orange", "i2_orange"),  # 상점가 소매점: 낮은 상자 + 주황 간판·차양(파란 박공 Mart 와 구별, 적대 검수 L4 N2)
}


# 간판 글씨: 손으로 찍은 4줄 높이 픽셀 글자(점선 「▬▬▬」 자리 표시를 버린다 — 적대 검수 L1 N10)
GLYPHS = {
    "M": ["#...#", "##.##", "#.#.#", "#...#"], "A": [".#.", "#.#", "###", "#.#"], "R": ["##.", "#.#", "##.", "#.#"],
    "T": ["###", ".#.", ".#.", ".#."], "D": ["##.", "#.#", "#.#", "##."], "E": ["###", "##.", "#..", "###"],
    "P": ["##.", "#.#", "##.", "#.."], "O": [".#.", "#.#", "#.#", ".#."], "F": ["###", "##.", "#..", "#.."],
    "I": ["#", "#", "#", "#"], "S": [".##", "#..", "..#", "##."], "C": [".##", "#..", "#..", ".##"], "H": ["#.#", "###", "#.#", "#.#"], "L": ["#..", "#..", "#..", "###"],
}


def text_width(word: str) -> int:
    return sum(len(GLYPHS[ch][0]) for ch in word) + len(word) - 1


def draw_text(im, word: str, cx: int, y: int, col, shade=None):
    """word 를 가운데 cx, 윗줄 y 에 찍는다. shade 가 있으면 글자 오른쪽 아래 1px 그늘(간판에서 떠 보이게)."""
    x = cx - text_width(word) // 2
    for ch in word:
        g = GLYPHS[ch]
        for r, row in enumerate(g):
            for c, bit in enumerate(row):
                if bit == "#":
                    if shade is not None and im.getpixel((x + c + 1, y + r + 1)) != col:
                        im.putpixel((x + c + 1, y + r + 1), shade)
        for r, row in enumerate(g):
            for c, bit in enumerate(row):
                if bit == "#":
                    im.putpixel((x + c, y + r), col)
        x += len(g[0]) + 1


def tower(P, n: int, floors: int, scheme: str, v: dict | None = None, roof_h: int = 40):
    """v: 동마다 다른 얼굴(적대 검수 2차 N10·N11) — roof(지붕 막 램프), stair("L"|"R" 계단실 자리), tank(물탱크), billboard(옥상 간판 틀),
    pilaster(정면 세로 기둥 간격 px, 0 = 없음), porch(현관 차양), glass_mid(가운데 돌출 유리 탑 폭 칸), side_signs(좌우 세로 간판)."""
    v = v or {}
    wall_key, win_kind, sign_key, awn_key = SCHEMES[scheme]
    wl = P[wall_key] if wall_key != "plaster" else [P["plaster"][0], P["plaster"][0], P["plaster"][1], P["plaster"][1]]
    if wall_key == "plaster":
        wl = [tuple(int(c * 0.72) for c in P["plaster"][0][:3]) + (255,), P["plaster"][0], P["plaster"][1], P["plaster"][1]]
    cc, gl, ol = P["concrete"], P["glass"], P["i2_ol"][0]
    W = n * T
    fl_h, g_h = 16, 24
    rr = P[v.get("roof", "concrete")]
    H = roof_h + fl_h * floors + g_h
    im = px.new(W, H)
    # 오른쪽·아래 그림자(바닥 칸 쪽 3px)
    # 지붕 윗면(2.5칸, 적대 검수 1 「지붕이 얕다」): 두께 3px 난간(밝은 윗변·안쪽 그늘) 안에 방수 막 격자(8px 이음, 한 톤 차),
    # 왼쪽 뒤 계단실(3/4 상자 + 앞면 문), 오른쪽 물탱크(원통 + 다리), 가운데 실외기 줄(환기 살).
    for y in range(roof_h):
        for x in range(1, W - 1):
            rim = y < 3 or x < 4 or x > W - 5
            if rim:
                c = cc[3] if y == 0 or x in (2, 3) and y > 0 else cc[2]
                if x == 1 or x == W - 2:
                    c = cc[0] if x == W - 2 else cc[1]
            else:
                c = rr[1] if (x - 4) % 8 == 0 or (y - 3) % 8 == 0 else rr[2]
                if y == 3 or x == 4:
                    c = cc[0]                                     # 난간 안쪽 그늘(위·왼쪽 벽이 드리운다)
            im.putpixel((x, y), c)
    def box(x0, y0, w, top, face, door=False):
        for y in range(y0, y0 + top + face):
            for x in range(x0, x0 + w):
                if y < y0 + top:
                    c = cc[3] if y == y0 else cc[2]
                else:
                    c = wl[1] if x < x0 + w - 2 else wl[0]
                    if door and x0 + 2 <= x < x0 + 7 and y >= y0 + top + 2:
                        c = gl[0] if x > x0 + 2 else cc[0]
                im.putpixel((x, y), c)
        for y in range(y0 + 2, y0 + top + face + 2):              # 오른쪽 아래 그림자
            for x in range(x0 + w, x0 + w + 2):
                if 0 <= x < W - 4:
                    im.putpixel((x, y), cc[0])
        for x in range(x0 + 2, x0 + w + 2):
            yy = y0 + top + face
            if yy < roof_h - 3 and x < W - 4:
                im.putpixel((x, yy), cc[0])
    left = v.get("stair", "L") == "L"
    if roof_h >= 32:
        box(7 if left else W - 21, 5, 14, 6, 11, door=True)       # 계단실
    tx = W - 17 if left else 6                                    # 물탱크
    for y in range(6, 24) if v.get("tank", True) and roof_h >= 32 else ():
        for x in range(tx, tx + 11):
            if y < 9:
                if ((x - tx - 5) / 5.5) ** 2 + ((y - 7.5) / 1.8) ** 2 <= 1:
                    im.putpixel((x, y), cc[3] if x < tx + 6 else cc[2])
            elif y < 19:
                if tx <= x < tx + 11:
                    im.putpixel((x, y), P["i2_blue"][2] if x < tx + 4 else P["i2_blue"][1] if x < tx + 8 else P["i2_blue"][0])
            elif x in (tx + 1, tx + 9):
                im.putpixel((x, y), cc[0])
    if v.get("billboard"):                                        # 옥상 간판 틀: 다리 둘 위 빨간 판 + 흰 띠(랜드마크 실루엣)
        bx0, bx1 = W // 2 - 16, W // 2 + 16
        for y in range(1, 20):
            for x in range(bx0, bx1):
                if y < 13:
                    c = P["i2_red"][1] if 2 < y < 12 else P["i2_red"][0]
                    im.putpixel((x, y), c)
                elif x in (bx0 + 3, bx1 - 4):
                    im.putpixel((x, y), cc[0])
        draw_text(im, v.get("billboard_text", "DEPT"), W // 2, 5, P["i2_white"][2], P["i2_red"][0])
    ac = range(26, W - 22, 13) if left else range(22, W - 26, 13)
    if v.get("billboard"):
        ac = [x for x in ac if not (W // 2 - 26 < x < W // 2 + 16)]
    for ux in ac if roof_h >= 32 else ():                         # 실외기 줄
        for y in range(24, 34):
            for x in range(ux, ux + 10):
                c = cc[3] if y == 24 else cc[2] if x < ux + 8 else cc[1]
                if y in (27, 29, 31) and ux + 1 <= x <= ux + 7:
                    c = cc[0]
                im.putpixel((x, y), c)
        for x in range(ux + 1, ux + 12):
            im.putpixel((x, 34), cc[0])
    # 처마(지붕 앞 턱): 3px 밝은 턱 + 1px 어두운 밑변
    for x in range(0, W):
        im.putpixel((x, roof_h - 3), cc[3]); im.putpixel((x, roof_h - 2), cc[2]); im.putpixel((x, roof_h - 1), cc[0])
    # 외벽
    y0 = roof_h
    for y in range(y0, H):
        for x in range(1, W - 1):
            c = wl[2] if x < W - 6 else wl[1]
            if x in (1, W - 2):
                c = wl[0]
            im.putpixel((x, y), c)
    for x in range(1, W - 1):                                     # 처마 밑 그림자
        im.putpixel((x, y0), wl[1]); im.putpixel((x, y0 + 1), wl[1] if x % 2 else wl[2])
    # 층 창 열: 기둥(pilaster)이 있으면 기둥 간격 한 칸에 창 하나를 가운데 두고 기둥은 창 사이 벽에 선다(적대 검수 L2 N1 — 16px 기둥선이
    # 12px 창 열을 찢어 격자가 보였다). 세로 간판·가운데 유리 탑 곁 2px 안의 창 열은 뺀다(L2 N10 — 현수막이 창을 반쯤 가렸다).
    pil = v.get("pilaster") or 0
    blocked = []
    if v.get("side_signs"):
        blocked += [(3, 8), (W - 8, W - 3)]
    if v.get("glass_mid"):
        gw_ = v["glass_mid"] * T
        blocked.append(((W - gw_) // 2, (W + gw_) // 2))
    if pil:
        win_xs = [b * pil + (pil - 8) // 2 for b in range(W // pil)]
    else:
        win_xs = list(range(5, W - 10, 12))
    win_xs = [wx for wx in win_xs if not any(wx - 2 < b1 and wx + 10 > b0 for b0, b1 in blocked)]
    for f in range(floors):
        fy = y0 + 3 + f * fl_h
        if win_kind == "curtain":
            for x in range(4, W - 4):
                for y in range(fy, fy + 11):
                    c = gl[1] if (x - 4) % 8 < 7 else cc[1]
                    if y == fy:
                        c = cc[2]
                    elif (x - 4) % 8 < 7 and y - fy < 4 and (x - y) % 7 < 2:
                        c = gl[3]
                    im.putpixel((x, y), c)
            for x in range(4, W - 4):
                im.putpixel((x, fy + 11), cc[0])
        else:
            for wx in win_xs:
                for y in range(fy, fy + 9):
                    for x in range(wx, wx + 8):
                        c = gl[2] if y > fy + 1 else gl[1]
                        if x in (wx, wx + 7) or y in (fy, fy + 8):
                            c = wl[0]
                        elif y - fy in (2, 3) and x - wx in (1, 2, 3):
                            c = gl[4]
                        im.putpixel((x, y), c)
                if win_kind == "balcony":                         # 난간: 창 밑 가로 막대 + 기둥
                    for x in range(wx - 1, wx + 9):
                        im.putpixel((x, fy + 10), cc[3]); im.putpixel((x, fy + 12), cc[2])
                        if (x - wx) % 3 == 0:
                            im.putpixel((x, fy + 11), cc[2])
                    for x in range(wx - 1, wx + 9):
                        im.putpixel((x, fy + 13), SHADOW if im.getpixel((x, fy + 13))[3] == 0 else wl[1])
        if win_kind == "band":                                    # 층 띠
            for x in range(1, W - 1):
                im.putpixel((x, fy + 11), wl[1])
    # 1층: 간판 띠 · 차양 · 유리문 · 쇼윈도
    gy = y0 + fl_h * floors
    if sign_key:
        sg = P[sign_key]
        for y in range(gy, gy + 6):
            for x in range(3, W - 3):
                c = sg[1] if 0 < y - gy < 5 else sg[0]
                im.putpixel((x, y), c)
        if v.get("text"):
            draw_text(im, v["text"], W // 2, gy + 1, P["i2_white"][2], sg[0])
    if awn_key:
        aw = P[awn_key]
        for x in range(2, W - 2):
            stripe = (x // 4) % 2 == 0
            for k in range(4):
                im.putpixel((x, gy + 6 + k), (aw[2] if stripe else P["i2_white"][2]) if k < 3 else (aw[0] if stripe else P["i2_white"][0]))
    dx0 = (n // 2) * T + 1
    for y in range(gy + 10, H):                                   # 유리문(가운데 칸 안 14px)
        for x in range(dx0, dx0 + 14):
            c = gl[2] if (x - dx0) not in (0, 6, 7, 13) else cc[0]
            if y == gy + 10:
                c = cc[0]
            elif (x - dx0) in (2, 3, 9, 10) and y < gy + 15:
                c = gl[4]
            im.putpixel((x, y), c)
    shop_xs = list(range(5, dx0 - 14, 14)) + list(range(dx0 + 18, W - 16, 14))
    if pil:                                                       # 기둥 간격이면 쇼윈도도 위층 창과 같은 칸에(문 칸은 뺀다)
        shop_xs = [b * pil + (pil - 11) // 2 for b in range(W // pil) if b != n // 2 and b * pil + (pil - 11) // 2 + 11 < W - 2]
    for sx in shop_xs:   # 쇼윈도
        for y in range(gy + 11, H - 3):
            for x in range(sx, sx + 11):
                c = gl[1] if y > gy + 12 else wl[0]
                if x in (sx, sx + 10):
                    c = wl[0]
                elif y - gy in (13, 14) and x - sx in (2, 3, 4, 5):
                    c = gl[3]
                im.putpixel((x, y), c)
    for x in range(1, W - 1):                                     # 바닥 보
        im.putpixel((x, H - 2), cc[1]); im.putpixel((x, H - 1), cc[0])
    # 정면 얼굴(동마다 다르게)
    if pil:
        for px0 in range(pil - 1, W - 4, pil):
            for y in range(y0 + 2, gy):
                im.putpixel((px0, y), wl[3]); im.putpixel((px0 + 1, y), wl[1])
    if v.get("side_signs"):
        sg = P[v.get("sign_ramp", "i2_red")]
        for sx in (3, W - 8):
            for y in range(y0 + 3, gy - 1):
                for x in range(sx, sx + 5):
                    c = sg[1] if x < sx + 4 else sg[0]
                    if x == sx + 2 and (y - y0) % 4 == 1:
                        c = P["i2_white"][2]
                    im.putpixel((x, y), c)
    if v.get("glass_mid"):
        gw = v["glass_mid"] * T
        gx0 = (W - gw) // 2
        for y in range(roof_h - 10, gy):                          # 지붕 앞 턱 위로 솟은 유리 탑
            for x in range(gx0, gx0 + gw):
                c = gl[2] if (x - gx0) % 6 else cc[1]
                if y < roof_h - 7:
                    c = cc[3] if y == roof_h - 10 else cc[2]
                elif (y - roof_h) % 16 == 0:
                    c = P["i2_yellow"][1]
                elif (x - gx0) % 6 and (x - y) % 9 < 2:
                    c = gl[3]
                if x in (gx0, gx0 + gw - 1):
                    c = cc[0]
                im.putpixel((x, y), c)
    if v.get("porch"):
        dxp = (n // 2) * T
        for y in range(gy + 6, gy + 10):
            for x in range(dxp - 3, dxp + T + 3):
                im.putpixel((x, y), cc[3] if y == gy + 6 else cc[2] if y < gy + 9 else cc[0])
        for y in range(gy + 10, H - 2):
            for x in (dxp - 2, dxp + T + 1):
                im.putpixel((x, y), cc[1])
    # 윤곽
    src = im.copy()
    for y in range(H):
        for x in range(W):
            if src.getpixel((x, y))[3] == 0 and any(0 <= x + a < W and 0 <= y + b < H and src.getpixel((x + a, y + b))[3] == 255 for a, b in ((1, 0), (-1, 0), (0, 1), (0, -1))):
                im.putpixel((x, y), ol)
    return im


BUILDINGS = {
    "dept": lambda P: tower(P, 9, 3, "store", {"text": "DEPT", "roof": "roof_olive", "billboard": True, "glass_mid": 2, "side_signs": True, "tank": False}),
    "apart": lambda P: tower(P, 5, 3, "apart", {"roof": "roof_tar", "stair": "R"}),
    "office": lambda P: tower(P, 6, 3, "office", {"text": "OFFICE", "stair": "L", "porch": True}),
    "hall": lambda P: tower(P, 5, 2, "hall", {"text": "HALL", "roof": "roof_olive", "stair": "R", "pilaster": 16, "porch": True, "tank": False}),
    "shop_s": lambda P: tower(P, 5, 0, "shop", {"text": "SHOP", "tank": False}, roof_h=24),
}
ENTRANCES = {"dept": [4, 6], "apart": [2, 6], "office": [3, 6], "hall": [2, 5], "shop_s": [2, 2]}   # 높이 = 64 + 16·층 → 행 수 - 1
