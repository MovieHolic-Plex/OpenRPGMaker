# 빙하기 설원 보정 패스 — 시그니처 땅 덩이 오토타일 3종(16변형, 위층 투명 덧그림). 결정적.
#  autotile-frozenpond : 두껍게 언 작은 연못(걷기). 눈 기슭 둑(북쪽 둑 안쪽 비탈 그늘·남쪽 둑 밝은 마루) + 젖빛 두꺼운 얼음, 눈가루 결, 서리꽃.
#                        기존 autotile-iceedge(큰 호수 얼음 채우기)와 달리 기슭 둑이 있는 따로 선 연못 덩이.
#  autotile-snowridge  : 바람에 쌓인 큰 눈 둔덕 능선(걷기). 윗면은 밝은 눈 + 바람 능선, 남쪽 앞면 5px(처마 마루·그늘), 밖에 옅은 그림자.
#                        기존 autotile-drift(납작한 눈 번짐 판)와 달리 3/4 앞면이 있는 솟은 덩이.
#  autotile-icepit     : 얼음 구덩이 균열(막힘). 눈 테 + 북쪽 안벽(빙하 결 앞면·고드름) + 짙푸른 바닥 모를 틈, 테에서 뻗는 잔 균열.
# 칸 번호 = 위 1 + 오른쪽 2 + 아래 4 + 왼쪽 8 (iaf_base.edge_depth 와 같은 규약, 0 외톨이 · 15 속 칸).
import os, math
import numpy as np
from PIL import Image, ImageDraw
from iaf_base import P, hash2, tnoise, tnoise1, sheet_from_cells, cell_of, BAY, N_, E_, S_, W_
import iaf_ground as G
from iaf_shore import shore

SNa = P('snow'); ICa = P('ice'); GLa = P('glac')
X, Y = np.meshgrid(np.arange(16), np.arange(16))


def sides(n, inset, jag, rad, seed):
    """이웃 없는 쪽마다 깊이장 D[k](안쪽 +) 와 합친 깊이 m(둥근 모서리), 가장 가까운 빈 쪽 번호 near(0 N,1 E,2 S,3 W).
    보정 4차: 공용 iaf_shore — 칸 끝 깊이 1px·끝 기울기 0.45·변형마다 다른 위상(오목 모서리에서 윤곽이 끊기지 않고,
    같은 쪽 둑이 칸마다 같은 물결로 되풀이되지 않는다)."""
    m, near, g, D = shore(n, seed, base=inset, amp=jag * 0.75, rad=rad, k=0.45, c0=1.0)
    return m, near, D


def _rgba(rgb, a):
    out = np.zeros((16, 16, 4), np.uint8); out[..., :3] = rgb; out[..., 3] = a
    return out


# ================================================================ ① 두껍게 언 연못(걷기)
def _pond_ice_tone(seed):
    """속 얼음 톤(주기 16 — 속 칸끼리 이어진다): 젖빛 4 바탕에 낮은 대비의 잔 결만(칸마다 되풀이돼도 격자 무늬로 튀지 않게).
    짧은 눈가루 결 하나(5), 서리꽃 하나(6), 옅은 머리카락 금 하나(3 + 아래 5), 잔 기포·잔 그늘 점."""
    T = np.full((16, 16), 4, int)
    T = np.where(hash2(X, Y, seed + 1) > 0.965, 3, T)
    T = np.where(hash2(X, Y, seed + 2) > 0.972, 5, T)
    for k in range(4): T[9 - k // 2, 2 + k] = 5
    T[12, 12] = 6; T[12, 11] = 5; T[11, 12] = 5
    for (x, y) in ((9, 3), (10, 4), (11, 4)):
        T[y, x] = 3; T[y + 1, x] = 5
    return T


def frozenpond_sheet(seed=171):
    cells = []
    T0 = _pond_ice_tone(seed + 7)
    for n in range(16):
        m, near, D = sides(n, inset=3.2, jag=3.4, rad=11.5, seed=seed)
        bank = 2.6 + (hash2(X // 3, Y // 3, seed + 9) - 0.5) * 0.8
        a = m >= 0
        rgb = ICa[T0].copy()
        inb = a & (m < bank)
        # 둑(눈 기슭): 북쪽 = 안쪽 비탈이 남쪽을 보아 그늘, 남쪽 = 마루가 밝다, 서쪽 = 안 비탈 그늘, 동쪽 = 안 비탈 밝음
        f = m / np.maximum(bank, 0.1)                      # 0 바깥 → 1 얼음 쪽
        bN = np.where(f < 0.34, 6, np.where(f < 0.7, 4, 3))
        bS = np.where(f < 0.5, 5, 6)
        bW = np.where(f < 0.4, 6, 4)
        bE = np.where(f < 0.5, 5, 6)
        for k, bb in ((0, bN), (1, bE), (2, bS), (3, bW)):
            rgb = np.where((inb & (near == k))[..., None], SNa[bb], rgb)
        ice = a & ~inb
        mi = m - bank                                      # 얼음 안쪽 거리
        # 북쪽 둑 그림자(얼음 위 2px, 끝은 디더) · 서쪽 둑 그림자 1px · 남쪽 얼음 턱 밝음
        shN = ice & (near == 0) & ((mi < 1.0) | ((mi < 2.2) & (BAY[Y % 4, X % 4] < 0.5)))
        rgb = np.where(shN[..., None], ICa[2], rgb)
        shW = ice & (near == 3) & (mi < 1.0)
        rgb = np.where(shW[..., None], ICa[3], rgb)
        lipS = ice & (near == 2) & (mi < 1.0)
        rgb = np.where(lipS[..., None], ICa[6], rgb)
        lipE = ice & (near == 1) & (mi < 1.0)
        rgb = np.where(lipE[..., None], ICa[5], rgb)
        out = _rgba(rgb, np.where(a, 255, 0))
        # 둑 바깥 1px: 남·동쪽 옅은 그림자(눈이 살짝 솟았다)
        sh = (m < 0) & (m > -1.0) & ((near == 2) | (near == 1))
        out[sh] = list(SNa[4]) + [60]
        # 둑 바깥으로 튄 눈 알갱이
        dots = (m < -1.0) & (m > -2.6) & (hash2(X, Y, seed + 30 + n) > 0.88)
        out[dots] = list(SNa[6]) + [255]
        cells.append(Image.fromarray(out, 'RGBA'))
    return sheet_from_cells(cells)


# ================================================================ ② 큰 눈 둔덕 능선(걷기)
FACE = 6.0


def snowridge_sheet(seed=181):
    cells = []
    B = BAY[Y % 4, X % 4]
    # 둔덕 윗면: 바탕 눈과 같은 5(평평한 흰 판이 되지 않게) — 드문 밝은 점 6, 바람 능선 한 획(마루 6, 아래 그늘 4).
    #           둔덕은 가장자리(북·서 빛 받는 비탈 6, 남쪽 앞면, 동쪽 그늘 비탈, 밖 그림자)로 읽힌다.
    top0 = np.where(hash2(X, Y, seed + 2) > 0.94, 6, 5)
    for k in range(6):
        x = 5 + k; y = 7 + (1 if k in (0, 5) else 0)
        top0[y, x] = 6
        if 0 < k < 5: top0[y + 1, x] = 4
    for n in range(16):
        m, near, D = sides(n, inset=3.0, jag=3.6, rad=11.5, seed=seed)
        a = m >= 0
        T = top0.copy()
        # 동쪽 비탈(그늘): 바깥 1px 4, 2.4px 까지 4/5 디더, 4px 까지 5 섞임
        T = np.where(a & (near == 1) & (m < 1.0), 4, T)
        T = np.where(a & (near == 1) & (m >= 1.0) & (m < 2.6), np.where(B < 0.5, 4, 5), T)
        T = np.where(a & (near == 1) & (m >= 2.6) & (m < 4.2), np.where(B < 0.5, 5, T), T)
        # 남쪽: 앞면 아래 그늘 3 → 몸 4(아래쪽 3 디더) → 처마 마루 6, 그 위 비탈 5 디더
        fs = a & (near == 2) & (m < FACE)
        Tf = np.where(m < 1.0, 3, np.where(m < FACE - 1.4, np.where((B < 0.5) & (m < 3.0), 3, 4), 6))
        T = np.where(fs, Tf, T)
        T = np.where(a & (near == 2) & (m >= FACE) & (m < FACE + 2.2), np.where(B < 0.5, 5, 6), T)
        T = np.where(a & ((near == 0) | (near == 3)) & (m < 2.6), np.where((m < 1.2) | (B < 0.5), 6, T), T)      # 북·서 빛 받는 비탈
        rgb = SNa[np.clip(T, 0, 6)]
        out = _rgba(rgb, np.where(a, 255, 0))
        # 앞면 밑 그림자(남·동 바깥 2px, 반투명 푸른빛)
        sh = (m < 0) & (m > -3.0) & ((near == 2) | (near == 1))
        out[sh] = list(SNa[3]) + [62]
        sh2 = (m <= -3.0) & (m > -4.0) & (near == 2) & (B < 0.5)
        out[sh2] = list(SNa[3]) + [40]
        dots = (m < -0.5) & (m > -2.4) & ((near == 0) | (near == 3)) & (hash2(X, Y, seed + 20 + n) > 0.84)
        out[dots] = list(SNa[6]) + [255]
        cells.append(Image.fromarray(out, 'RGBA'))
    return sheet_from_cells(cells)


# ================================================================ ③ 얼음 구덩이 균열(막힘)
WALL = 7.0


def icepit_sheet(seed=191):
    cells = []
    for n in range(16):
        m, near, D = sides(n, inset=2.6, jag=2.4, rad=11.0, seed=seed)
        rim = 1.8 + (hash2(X // 2, Y // 2, seed + 5) - 0.5) * 0.6
        a = m >= 0
        # 바닥 모를 틈: 깊을수록 짙다(디더), 군데군데 푸른 빛 점
        dpt = np.clip((m - rim) / 6.0, 0, 1)
        T = np.where(dpt + (BAY[Y % 4, X % 4] - 0.5) * 0.5 > 0.45, 0, 1)
        rgb = GLa[T].copy()
        gl = (hash2(X, Y, seed + 11) > 0.965) & (m > rim + 2)
        rgb = np.where(gl[..., None], GLa[2], rgb)
        inrim = a & (m < rim)
        # 테(눈 입술): 남쪽(가까운 테) 마루 밝음, 북쪽(먼 테) 처마 6 → 그 밑 그늘, 서·동
        rgb = np.where((inrim & (near == 2))[..., None], SNa[np.where(m < rim * 0.5, 5, 6)], rgb)
        rgb = np.where((inrim & (near == 0))[..., None], SNa[np.where(m < rim * 0.55, 6, 4)], rgb)
        rgb = np.where((inrim & (near == 3))[..., None], SNa[np.where(m < rim * 0.5, 6, 4)], rgb)
        rgb = np.where((inrim & (near == 1))[..., None], SNa[5], rgb)
        # 북쪽 안벽: 빙하 결 앞면(위 밝고 아래 어둡다, 세로 잔결), 서쪽 안벽 그늘 1~2px, 동쪽 안벽 밝음 1~2px
        wz = m - rim
        wN = a & ~inrim & (near == 0) & (wz < WALL)
        streak = (hash2(X, 0, seed + 13) - 0.5) * 1.2
        tw = np.clip(np.rint(4.6 - wz * 0.62 + streak + (BAY[Y % 4, X % 4] - 0.5) * 0.8), 1, 5).astype(int)
        rgb = np.where(wN[..., None], GLa[tw], rgb)
        rgb = np.where((wN & (wz < 1.0))[..., None], GLa[5], rgb)
        wW = a & ~inrim & (near == 3) & (wz < 2.0)
        rgb = np.where(wW[..., None], GLa[1], rgb)
        wE = a & ~inrim & (near == 1) & (wz < 2.0)
        rgb = np.where(wE[..., None], GLa[np.where(wz < 1.0, 4, 3)], rgb)
        out = _rgba(rgb, np.where(a, 255, 0))
        # 고드름: 북쪽 안벽 윗가장자리에서 아래로 2~4px
        for x in range(16):
            col = np.where(wN[:, x])[0]
            if len(col) == 0 or hash2(x, 1, seed + 17) < 0.55: continue
            y0 = col[0]; L = 2 + int(hash2(x, 2, seed + 17) * 3)
            for j in range(L):
                if y0 + j < 16 and a[y0 + j, x]: out[y0 + j, x] = list(ICa[6] if j < L - 1 else ICa[4]) + [255]
        # 잔 균열: 테 바깥 눈으로 3~5px 뻗는 금(짙은 1px, 갈지자) + 금 아래 밝은 턱. 칸 가장자리 1px 안에서 멈춘다.
        for k, (dx, dy) in enumerate(((0, -1), (1, 0), (0, 1), (-1, 0))):
            side = 'NESW'[k]
            if D[side].min() > 50: continue
            for i in range(2):
                h = hash2(n * 7 + k, i, seed + 23)
                if h < 0.30: continue
                along = 4 + int(hash2(n * 7 + k, i, seed + 24) * 8)
                if side in 'NS':
                    col = np.where(a[:, along])[0]
                    if len(col) == 0: continue
                    x, y = along, ((col[0] - 1) if side == 'N' else (col[-1] + 1))
                else:
                    row = np.where(a[along, :])[0]
                    if len(row) == 0: continue
                    x, y = ((row[-1] + 1) if side == 'E' else (row[0] - 1)), along
                L = 3 + int(hash2(n * 7 + k, i, seed + 25) * 3)
                for j in range(L):
                    if not (1 <= x <= 14 and 1 <= y <= 14) or a[y, x]: break
                    out[y, x] = list(GLa[1]) + [255]
                    if y + 1 <= 15 and not a[y + 1, x] and out[y + 1, x, 3] == 0: out[y + 1, x] = list(SNa[6]) + [255]
                    wob = int(hash2(n * 7 + k, i * 16 + j, seed + 26) * 3) - 1
                    x += dx + (wob if dy else 0); y += dy + (wob if dx else 0)
        # 테 바깥 1px: 남·동 옅은 눈 그늘(테가 살짝 솟았다)
        sh = (m < 0) & (m > -1.0) & ((near == 2) | (near == 1)) & (out[..., 3] == 0)
        out[sh] = list(SNa[4]) + [110]
        cells.append(Image.fromarray(out, 'RGBA'))
    return sheet_from_cells(cells)


# ================================================================ 시험 그림
SHAPES = {
    '5x5 덩이': ["11111", "11111", "11111", "11111", "11111"],
    '나선': ["1111111", "1000001", "1011101", "1010101", "1010001", "1011111"],
    '코 L자': ["0110000", "1110000", "1100000", "1100000", "1111111", "1111110", "0011000"],
    '고리·외톨이': ["111101", "101000", "111001", "000011"],
}


def paint(cells, sheet, im, ox=0, oy=0):
    for (x, y) in cells:
        nb = (1 if (x, y - 1) in cells else 0) | (2 if (x + 1, y) in cells else 0) | (4 if (x, y + 1) in cells else 0) | (8 if (x - 1, y) in cells else 0)
        im.alpha_composite(cell_of(sheet, nb), (ox + x * 16, oy + y * 16))


def _font(sz=12):
    from PIL import ImageFont
    for p in ('/usr/share/fonts/truetype/nanum/NanumSquareB.ttf', '/usr/share/fonts/truetype/nanum/NanumGothic.ttf'):
        if os.path.exists(p): return ImageFont.truetype(p, sz)
    return None


def check_autotile(sheets, path):
    """오토타일마다 한 줄: [4x4 시트 4배 | 5x5 덩이 · 나선 · 코 L자 · 고리·외톨이 를 눈 바닥 위에 2배]."""
    F = _font()
    snow = G.ground_snow()
    rows = []
    for name, sh in sheets:
        tiles = []
        big = sh.resize((256, 256), Image.NEAREST)
        bg = Image.new('RGBA', (64, 64)); [bg.alpha_composite(snow, (x, y)) for x in (0, 48) for y in (0, 48)]
        bg.alpha_composite(sh); sheet4 = bg.resize((256, 256), Image.NEAREST)
        d = ImageDraw.Draw(sheet4)
        for i in range(16): d.text(((i % 4) * 64 + 2, (i // 4) * 64 + 1), str(i), fill=(200, 20, 40), font=F)
        tiles.append(('시트(번호)', sheet4))
        for sname, rows_ in SHAPES.items():
            cs = {(x + 1, y + 1) for y, r in enumerate(rows_) for x, ch in enumerate(r) if ch == '1'}
            w = (len(rows_[0]) + 2) * 16; h = (len(rows_) + 2) * 16
            im = Image.new('RGBA', (w, h))
            for yy in range(0, h, 48):
                for xx in range(0, w, 48): im.alpha_composite(snow, (xx, yy))
            paint(cs, sh, im)
            tiles.append((sname, im.resize((w * 2, h * 2), Image.NEAREST)))
        rows.append((name, tiles))
    W_ = max(sum(t.width + 12 for _, t in tiles) for _, tiles in rows) + 8
    H_ = sum(max(t.height for _, t in tiles) + 40 for _, tiles in rows)
    o = Image.new('RGB', (W_, H_), (24, 24, 30)); d = ImageDraw.Draw(o); y = 0
    for name, tiles in rows:
        d.text((6, y + 4), name, fill=(240, 240, 240), font=_font(14)); x = 6
        for lab, t in tiles:
            d.text((x, y + 22), lab, fill=(190, 190, 200), font=F)
            o.paste(t.convert('RGB'), (x, y + 38)); x += t.width + 12
        y += max(t.height for _, t in tiles) + 40
    o.save(path)
    return o.size


if __name__ == '__main__':
    HERE = os.path.dirname(os.path.abspath(__file__))
    S = [('autotile-frozenpond 두껍게 언 연못(걷기)', frozenpond_sheet()), ('autotile-snowridge 큰 눈 둔덕 능선(걷기)', snowridge_sheet()),
         ('autotile-icepit 얼음 구덩이 균열(막힘)', icepit_sheet())]
    print(check_autotile(S, os.path.join(HERE, '_qa', 'check-auto-draft.png')))
