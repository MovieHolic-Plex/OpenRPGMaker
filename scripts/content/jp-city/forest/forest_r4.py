#!/usr/bin/env python3
"""jp 숲 r4 — 나무 한 그루 그림(버들항식 나무 인스턴스). 코드 손 도트, jp 팔레트 계약 잔 램프만.

r3(칸 오토타일 × 위상)은 시트 한도 안에서 6칸 주기 반복과 곧은 동서 가장자리를 못 없앴다(Argon 10판 NO-SHIP).
버들항 숲은 칸이 아니라 나무 그림(3×3 수관 · 3×4 / 4×5 줄기 나무 · 2×2 덤불)을 엇갈려 놓은 것이다(`plantBeodeulForestWall`).
r4 는 같은 위상을 쓴다: 종마다 나무 그림 몇 벌을 그리고, 숲 구획을 칠하면 composer(`forest_r4_compose.py` ·
`src/editor/jpCity/forestComposer.ts`)가 칸 해시로 자리·변형을 골라 3·4층에 놓는다. 주기가 없어 반복이 안 보이고,
가장자리는 둥근 수관 윤곽이 만든다.

그림 하나 = (이름, 칸 폭, 칸 높이, RGBA). 이름 규칙 `<종>-<모양><변형>`:
  T4 큰 줄기 나무 4×5 · T3 줄기 나무 3×4 · C3 수관 3×3 · C2 작은 수관 2×2 · T1 작은 나무 1×2 · B1 덤불 1×1
"""
import math
import os
import sys

import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import forest_r3 as F  # noqa: E402  팔레트·해시를 같이 쓴다

T = 16
PAL_R4 = F.PAL
GROUND = os.environ.get('JPF_GROUND', 'r6')
CROWN = os.environ.get('JPF_CROWN', 'v7')   # v7 = 띠 명암 수관(2026-10-21), r4 = 옛 3px 잎 무리 결

# r5 잔디 맞춤: 버들항 나무와 버들항 잔디의 관계(색상 +4°, 채도 ×0.9, 명도 중앙값 −0.14·폭 0.23~0.80)를
# jp_city 잔디(3281: 색상 122°, 채도 0.41, 명도 0.52)에 그대로 옮긴다. 나무 색상은 124° 쪽으로 당기고(노란 연두를 뺀다),
# 채도는 ×0.74, 명도는 ×0.93. 그늘은 잔디 짙은 단(130°)보다 푸른 쪽(≤150°)에 머문다.
HARMONY = dict(hue=124.0, pull=0.5, sat=0.74, val=0.93, bark_sat=0.85)


def _harm(c, leaf=True, H=HARMONY):
    import colorsys
    h, sat, v = colorsys.rgb_to_hsv(*[x / 255.0 for x in c])
    if leaf:
        hd = h * 360.0
        hd = hd + (H['hue'] - hd) * H['pull']
        h = min(150.0, hd) / 360.0; sat *= H['sat']; v *= H['val']
    else:
        sat *= H['bark_sat']
    return tuple(int(round(x * 255)) for x in colorsys.hsv_to_rgb(h, sat, v))


def harmonized_pal():
    P = dict(F.PAL)
    for k in ('keyaki_a', 'keyaki_b', 'hi'):
        P[k] = [_harm(c) for c in F.PAL[k]]
    P['bark'] = [_harm(c, leaf=False) for c in F.PAL['bark']]
    return P


def contract_pal():
    """계약에 올린 r5 램프(paletteContract.ts 의 keyaki_g/h·leafhi_g·bark_g — harmonized_pal() 로 만들어 올렸다)."""
    P = dict(F.PAL)
    P['keyaki_a'] = F.fine('pine_bamboo', 'keyaki_g'); P['keyaki_b'] = F.fine('pine_bamboo', 'keyaki_h')
    P['hi'] = F.ramp('pine_bamboo/leafhi_g'); P['bark'] = F.ramp('aged_cedar/bark_g')
    return P


PAL_R5 = contract_pal()
PAL = dict(PAL_R5) if os.environ.get('JPF_PAL', 'r5') == 'r5' else dict(PAL_R4)
hf = F.hf


def _vor(x, y, cell, salt):
    """그림 좌표 보로노이(잎 무리): (값 -1~1, 경계 0~1, 무리 중심에서 왼쪽 위로의 기울기 -1~1)."""
    gx, gy = math.floor(x / cell), math.floor(y / cell)
    best = (1e9, 0, 0, 0, 0); second = 1e9
    for j in (-1, 0, 1):
        for i in (-1, 0, 1):
            cx, cy = gx + i, gy + j
            px = (cx + 0.15 + 0.7 * hf('vx', cx, cy, salt)) * cell
            py = (cy + 0.15 + 0.7 * hf('vy', cx, cy, salt)) * cell
            d = (x + 0.5 - px) ** 2 + (y + 0.5 - py) ** 2
            if d < best[0]: second = best[0]; best = (d, cx, cy, px, py)
            elif d < second: second = d
    val = hf('vv', best[1], best[2], salt) * 2 - 1
    edge = 1.0 - min(1.0, (math.sqrt(second) - math.sqrt(best[0])) / 1.3)
    grad = max(-1.0, min(1.0, (-(x + 0.5 - best[3]) * 0.55 - (y + 0.5 - best[4]) * 0.8) / (0.8 * cell)))
    return val, edge, grad


def _lumps(cx, cy, rw, rh, seed, rl):
    """수관 = 큰 잎 덩이(lump): 둘레 고리(윤곽 혹) + 속 고리 + 가운데. 뒤(위) 덩이부터."""
    out = []
    R = (rw + rh) / 2
    n1 = max(7, int(round(2 * math.pi * R * 0.72 / (rl * 1.45))))
    for k in range(n1):
        a = 2 * math.pi * (k + 0.5 * hf('a1', seed, k)) / n1
        r = rl * (0.82 + 0.36 * hf('r1', seed, k))
        d = 1.0 - r / R * 0.95
        out.append((cx + math.cos(a) * rw * d, cy + math.sin(a) * rh * d - (1.0 if math.sin(a) < -0.3 else 0), r))
    n2 = max(4, int(round(n1 * 0.55)))
    for k in range(n2):
        a = 2 * math.pi * (k + 0.5 * hf('a2', seed, k)) / n2 + 0.4
        r = rl * (0.85 + 0.3 * hf('r2', seed, k))
        out.append((cx + math.cos(a) * rw * 0.40, cy + math.sin(a) * rh * 0.40, r))
    out.append((cx - rw * 0.08, cy - rh * 0.12, rl * 1.1))
    return sorted(out, key=lambda c: c[1])


def paint_crown(img, lev, famg, cx, cy, rw, rh, fam, seed, rl=7.0, mixf=0.0, bright=0.0, pockets=2):
    """버들항 수관: 큰 혹 덩이마다 왼쪽 위 빛 · 오른쪽 아래 어두운 테, 덩이 사이 홈, 3px 잎 무리 결,
    덩이 꼭대기 왼쪽에 모인 밝은 반점(낱점 아님), 아래쪽 그늘 주머니 속 굵은 가지."""
    H, W = lev.shape
    own = np.full((H, W), -1, int)
    for ci, (x0, y0, r) in enumerate(_lumps(cx, cy, rw, rh, seed, rl)):
        r = min(r, (y0 - 1.0) / 1.16, (x0 - 1.0) / 1.16, (W - 1.0 - x0) / 1.16)   # 그림 칸 밖으로 넘쳐 잘리지 않게(평평한 윗선 방지)
        for y in range(max(0, int(y0 - r - 2)), min(H, int(y0 + r + 3))):
            for x in range(max(0, int(x0 - r - 2)), min(W, int(x0 + r + 3))):
                dx, dy = x + 0.5 - x0, y + 0.5 - y0
                a = math.atan2(dy, dx)
                rj = r * (1.0 + 0.10 * math.sin(a * 4 + ci * 1.7 + seed % 7) + 0.06 * math.sin(a * 7 + ci))
                d = math.sqrt(dx * dx + dy * dy) / rj
                if d > 1.0: continue
                nx, ny = dx / rj, dy / rj
                nz = math.sqrt(max(0.0, 1 - d * d))
                lam = -0.55 * nx - 0.65 * ny + 0.52 * nz
                ncx, ncy = (x + 0.5 - cx) / rw, (y + 0.5 - cy) / rh
                base = 0.70 - 0.22 * ncy - 0.12 * ncx + bright
                lv, le, gr = _vor(x, y, 3.0, (seed, 'lf'))
                # 버들항 결: 3px 잎 무리마다 왼쪽 위 1~2화소가 밝고 오른쪽 아래가 어둡다(화소 단위 대비가 크다).
                # 덩이 빛은 그 위의 큰 명암일 뿐 — 덩이 빛이 크면 솜뭉치(베개 명암)가 된다
                v = base - 0.04 + 0.22 * (lam - 0.30) + 0.04 * lv + 0.30 * gr - 0.30 * le * (0.6 if lam > 0.55 else 1.0)
                if d > 0.80 and (nx * 0.6 + ny * 0.8) > -0.25: v -= 0.22 * (d - 0.80) / 0.20
                # 색상 이동: 빛은 황록(keyaki_b), 그늘은 청록(keyaki_a)
                pf = 'keyaki_b' if v > 0.58 else 'keyaki_a'
                L = int(np.clip(round(v * 19), 0, 19))
                if v > 0.64 and gr > 0.35 and le < 0.55:
                    L = 100 + (1 if v > 0.80 and gr > 0.7 else 0)
                lev[y, x] = L; famg[y, x] = pf if fam in FAMS else fam; own[y, x] = ci
    # 속 빈 틈: 깊은 그늘 잎
    for y in range(H):
        for x in range(W):
            if lev[y, x] >= 0: continue
            ex, ey = (x + 0.5 - cx) / rw, (y + 0.5 - cy) / rh
            if ex * ex + ey * ey < 0.70:
                lv, le, gr = _vor(x, y, 3.0, (seed, 'lf'))
                lev[y, x] = int(np.clip(round((0.24 + 0.04 * lv + 0.08 * gr - 0.08 * le) * 19), 0, 19)); famg[y, x] = 'keyaki_a' if fam in FAMS else fam
    # 그늘 주머니 + 굵은 가지(2px, 아래 반쪽): 어두운 잎 타원 안에 갈색 V
    for b in range(pockets):
        bx = cx + (hf('pkx', seed, b) - 0.5) * rw * 0.9
        by = cy + rh * (0.05 + 0.35 * hf('pky', seed, b))
        pr = 2.2 + hf('pkr', seed, b) * 1.2
        for y in range(int(by - pr - 1), int(by + pr + 2)):
            for x in range(int(bx - pr - 2), int(bx + pr + 3)):
                if not (0 <= x < W and 0 <= y < H) or lev[y, x] < 0: continue
                e = ((x + 0.5 - bx) / (pr * 1.3)) ** 2 + ((y + 0.5 - by) / pr) ** 2
                if e < 0.45: lev[y, x] = min(lev[y, x], 6 + int(e * 4))
        # 가지: 한쪽으로 기운 굵은 가지(2px) + 짧은 잔가지 — 얼굴처럼 대칭인 V 는 쓰지 않는다
        sgn = 1 if hf('pks', seed, b) < 0.5 else -1
        for t in range(int(pr * 1.6) + 2):
            for th in (0, 1):
                x = int(round(bx - sgn * pr * 0.6 + sgn * t * 0.75)) + th
                y = int(round(by + pr * 0.7 - t * 0.8))
                if 0 <= x < W and 0 <= y < H and lev[y, x] >= 0: lev[y, x] = 200 if th == 0 else 201
        for t in range(3):
            x = int(round(bx + sgn * 0.5 - sgn * t)); y = int(round(by - t))
            if 0 <= x < W and 0 <= y < H and lev[y, x] >= 0: lev[y, x] = 201
    return own


BANDS = (3, 6, 9, 12, 15, 17)   # v7 수관 명암 단(keyaki 램프 번호): 깊은 그늘 · 그늘 · 중간 · 밝음 · 빛 · 빛 끝


def paint_crown_v7(img, lev, famg, cx, cy, rw, rh, fam, seed, rl=7.0, bright=0.0):
    """v7 수관(2026-10-21 적대 VQA r1: 1px 점무늬·떠 있는 가지 획 불합격): 덩이(lobe)마다 5단 명암 띠,
    5px 잎 무리는 띠 경계만 물결로 밀고(낱점 없음), 무리 왼쪽 위 2~3px 초승달만 한 단 밝게. 가지 획은 그리지 않는다."""
    H, W = lev.shape
    own = np.full((H, W), -1, int)
    for ci, (x0, y0, r) in enumerate(_lumps(cx, cy, rw, rh, seed, rl)):
        r = min(r, (y0 - 1.0) / 1.16, (x0 - 1.0) / 1.16, (W - 1.0 - x0) / 1.16)
        for y in range(max(0, int(y0 - r - 2)), min(H, int(y0 + r + 3))):
            for x in range(max(0, int(x0 - r - 2)), min(W, int(x0 + r + 3))):
                dx, dy = x + 0.5 - x0, y + 0.5 - y0
                a = math.atan2(dy, dx)
                rj = r * (1.0 + 0.10 * math.sin(a * 4 + ci * 1.7 + seed % 7) + 0.06 * math.sin(a * 7 + ci))
                d = math.sqrt(dx * dx + dy * dy) / rj
                if d > 1.0: continue
                nx, ny = dx / rj, dy / rj
                nz = math.sqrt(max(0.0, 1 - d * d))
                lam = -0.55 * nx - 0.65 * ny + 0.52 * nz
                ncx, ncy = (x + 0.5 - cx) / rw, (y + 0.5 - cy) / rh
                lv, le, gr = _vor(x, y, 5.0, (seed, 'lf7'))
                v = 0.50 - 0.20 * ncy - 0.10 * ncx + bright + 0.42 * (lam - 0.30) + 0.07 * lv
                b = int(np.clip(math.floor(v * 5.0), 0, 4))
                if gr > 0.50 and le < 0.6: b = min(5, b + 1)          # 잎 무리 왼쪽 위 초승달
                elif gr < -0.55 and le > 0.55: b = max(0, b - 1)      # 무리 오른쪽 아래 홈
                if d > 0.84 and (nx * 0.6 + ny * 0.8) > -0.2: b = max(0, b - 1)   # 덩이 오른쪽 아래 테
                L = BANDS[b]
                if b == 5 and v > 0.86 and gr > 0.7: L = 100
                lev[y, x] = L; famg[y, x] = ('keyaki_b' if b >= 3 else 'keyaki_a') if fam in FAMS else fam; own[y, x] = ci
    for y in range(H):
        for x in range(W):
            if lev[y, x] >= 0: continue
            ex, ey = (x + 0.5 - cx) / rw, (y + 0.5 - cy) / rh
            if ex * ex + ey * ey < 0.70:
                lev[y, x] = BANDS[0]; famg[y, x] = 'keyaki_a' if fam in FAMS else fam
    return own


def outline(lev, famg):
    """바깥 윤곽: 오른쪽·아래는 가장 어두운 단, 왼쪽·위는 세 단 어둡게(군데군데 끊김). 둘레에 1px 잎 끝을 군데군데 내민다."""
    H, W = lev.shape
    tips = []
    for y in range(1, H - 1):
        for x in range(1, W - 1):
            if lev[y, x] >= 0 or famg[y, x] is not None: continue
            for a, b in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                L = lev[y + b, x + a]
                if 0 <= L < 100 and famg[y + b, x + a] is not None and hf('tip', x, y) < 0.18:
                    tips.append((y, x, max(4, L - 2), famg[y + b, x + a])); break
    for y, x, L, f in tips:
        lev[y, x] = L; famg[y, x] = f
    res = lev.copy()
    for y in range(H):
        for x in range(W):
            L = lev[y, x]
            if L < 0 or L >= 200: continue
            out = lambda a, b: not (0 <= x + a < W and 0 <= y + b < H) or lev[y + b, x + a] < 0
            base = 17 if L >= 100 else L
            if out(1, 0) or out(0, 1):
                res[y, x] = max(2, min(base - 5, 5))
            elif out(-1, 0) or out(0, -1):
                if hf('ol', x, y) < 0.75: res[y, x] = max(0, base - 3)
    lev[:] = res


def flush(img, lev, famg, bark):
    H, W = lev.shape
    for y in range(H):
        for x in range(W):
            L = lev[y, x]
            if L < 0: continue
            if L >= 200: img[y, x, :3] = bark[2 if L == 200 else 1]
            elif L >= 100: img[y, x, :3] = PAL['hi'][L - 100]
            else: img[y, x, :3] = PAL[famg[y, x]][L]
            img[y, x, 3] = 255


def paint_trunk(img, cx, top, base, w, bark, seed, root=5):
    """줄기: 위가 좁고 밑이 넓다(테이퍼), 왼쪽 밝은 결 + 세로 껍질 골, 밑동에서 뿌리 가닥 3~4개가 갈라져 땅에 박힌다.
    밑에 두 단 땅 그늘 타원(오른쪽으로 밀림)."""
    H, W = img.shape[:2]
    if GROUND == 'r5':
        gsh = PAL['gsh']
        # 땅 그늘: 속(gsh0) · 둘레(gsh1), 오른쪽으로 2px 밀림
        sw = w / 2 + root + 6; sh = 3.6
        for y in range(int(base - sh - 1), min(H, int(base + sh + 1))):
            for x in range(max(0, int(cx + 2 - sw - 1)), min(W, int(cx + 2 + sw + 2))):
                e = ((x + 0.5 - cx - 2) / sw) ** 2 + ((y + 0.5 - base) / sh) ** 2
                if e <= 1 and not img[y, x, 3]:
                    img[y, x, :3] = gsh[1 if e < 0.5 else 0]; img[y, x, 3] = 255
    else:
        # r6 접지: 넓은 땅 그늘은 1·2층(forest_r6_ground)이 깐다. 그림에는 밑동 닿는 곳만 — 뿌리 밑 좁은 타원,
        # 속은 잔디 ×0.55, 가는 ×0.70(숲 바닥 속과 같은 색이라 바닥에 녹아든다). 빛이 왼쪽 위라 오른쪽으로 2px.
        grass = ((52, 99, 60), (73, 128, 76), (104, 158, 99))
        dark = tuple(int(round(v * 0.55)) for v in grass[1]); mid = tuple(int(round(v * 0.70)) for v in grass[1])
        gsh = [dark, mid]
        sw = w / 2 + root + 4; sh = 3.2
        for y in range(int(base - sh - 1), min(H, int(base + sh + 1))):
            for x in range(max(0, int(cx + 2 - sw - 1)), min(W, int(cx + 2 + sw + 2))):
                e = ((x + 0.5 - cx - 2) / sw) ** 2 + ((y + 0.5 - base - 0.5) / sh) ** 2
                if e <= 1 and not img[y, x, 3]:
                    img[y, x, :3] = dark if e < 0.55 else mid; img[y, x, 3] = 255
    lean = (hf('lean', seed) - 0.5) * 2.4
    for y in range(top, base + 1):
        f = (y - top) / max(1, base - top)
        fl = max(0, y - (base - 7))
        ww = w - 2 + int(round(2 * f)) + int(round(fl * fl / 5.0))
        ccx = cx + lean * (1 - f)
        x0 = int(round(ccx - ww / 2))
        for i in range(ww):
            x = x0 + i
            if not (0 <= x < W): continue
            u = i / max(1, ww - 1)
            lit = 5 if u < 0.12 else 4 if u < 0.3 else 3 if u < 0.55 else 2 if u < 0.8 else 1
            if y < top + 3: lit -= 2
            if hf('bk', seed, (x - int(cx)) // 2, y // 3) < 0.22 and 0.15 < u < 0.85: lit -= 1   # 껍질 골
            if fl >= 3 and hf('rf', seed, (x - int(cx)) // 2) < 0.35 and 0.1 < u < 0.9: lit -= 1   # 뿌리 사이 골
            img[y, x, :3] = bark[max(0, min(6, lit))]; img[y, x, 3] = 255
    # 뿌리: 밑동에서 좌우로 세 갈래씩 비스듬히 벌어진다(두께 2→1), 갈래 사이는 땅 그늘
    for sgn in (-1, 1):
        for k in range(3):
            ln = 3 + k + int(hf('rl', seed, sgn, k) * 3) + (2 if GROUND != 'r5' else 0)
            sx = cx + sgn * (w / 2 - 1)
            slope = 0.25 + 0.3 * k + 0.2 * hf('rsl', seed, sgn, k) + (0.12 if GROUND != 'r5' else 0.0)
            for t in range(ln):
                x = int(round(sx + sgn * t)); y = int(round(base - 3 + t * slope))
                th = 2 if t < ln * 0.6 else 1
                for q in range(th):
                    yy = y - q
                    if 0 <= x < W and 0 <= yy < H:
                        img[yy, x, :3] = bark[(4 if sgn < 0 else 2) - q * (2 if sgn > 0 else 1)]; img[yy, x, 3] = 255
    if GROUND != 'r5':
        # r6 접지: 밑동 아랫선을 들쭉날쭉하게 — 줄기 열마다 1~2px 땅으로 파고들거나(가장 어두운 껍질) 1px 덜 내려온다.
        # 앞으로 뻗는 뿌리 하나(아래로 2~3px). 버들항 밑동 실측: 뿌리 끝이 땅 그늘 속으로 박히고 풀 술이 뿌리 끝을 덮는다.
        cols = [x for x in range(W) if img[base, x, 3] and tuple(img[base, x, :3]) in {tuple(c) for c in bark}]
        for x in cols:
            h = hf('bite', seed, x)
            if h < 0.45:
                for d in range(1, 2 + (h < 0.18)):
                    if base + d < H: img[base + d, x, :3] = bark[0 if d > 1 else 1]; img[base + d, x, 3] = 255
            elif h > 0.85 and not img[base + 1, x, 3] if base + 1 < H else False:
                img[base, x, :3] = bark[0]
        fx0 = int(round(cx - 1 + (hf('froot', seed) - 0.5) * w * 0.5))
        for d in range(1, 3 + int(hf('frl', seed) * 2)):
            for x in (fx0, fx0 + 1):
                if 0 <= x < W and base + d < H: img[base + d, x, :3] = bark[2 if x == fx0 else 1] if d < 2 else bark[0]; img[base + d, x, 3] = 255
        # 풀 술: 뿌리 줄을 따라 5~6개, 뿌리·밑동 아랫 두 줄 위에도 덮는다(풀이 밑동 앞에 선다)
        grass_hi = ((104, 158, 99), tuple(PAL['keyaki_b'][13]), tuple(PAL['keyaki_b'][16]))
        for b in range(6):
            fx = int(cx - w / 2 - root + hf('fx6', seed, b) * (w + 2 * root)); fy = base + 2 - int(hf('fy6', seed, b) * 3)
            for dx, dy, k in ((0, 0, 0), (0, -1, 1), (-1, -1, 0), (1, -2, 2), (0, -2, 1), (-1, -3, 2)):
                if dy == -3 and hf('tall', seed, b) < 0.5: continue
                x, y = fx + dx, fy + dy
                if 0 <= x < W and 0 <= y < H and (not img[y, x, 3] or y >= base - 1):
                    img[y, x, :3] = grass_hi[k]; img[y, x, 3] = 255
        return
    # 풀잎 술
    for b in range(3):
        fx = int(cx - w / 2 - root + hf('fx', seed, b) * (w + 2 * root)); fy = base + 1 - int(hf('fy', seed, b) * 2)
        for dx, dy, L in ((0, 0, 9), (-1, -1, 12), (1, -1, 11), (0, -2, 13)):
            x, y = fx + dx, fy + dy
            if 0 <= x < W and 0 <= y < H and (not img[y, x, 3] or tuple(img[y, x, :3]) in map(tuple, gsh)):
                img[y, x, :3] = PAL['keyaki_b'][L]; img[y, x, 3] = 255


def paint_fork(img, lev, cx, ytop, w, bark):
    """수관 밑에서 갈라지는 두 가지(2px): 수관 밑 테 위로 3~5px 보인다."""
    H, W = lev.shape
    for sgn in (-1, 1):
        for t in range(5):
            for th in (0, 1):
                x = int(round(cx + sgn * (w * 0.25 + t * 0.9))) + th * sgn
                y = ytop - t
                if 0 <= x < W and 0 <= y < H:
                    lev[y, x] = 200 if sgn < 0 else 201


SHAPES = {
    # 이름: (칸 폭, 칸 높이, 수관 cx, cy, rw, rh, 줄기 폭, 줄기 위, 밑동, 뿌리, 혹 덩이 반지름)
    'T4': (4, 5, 32, 33, 31.0, 32.0, 13, 54, 77, 8, 8.5),
    'T3': (3, 4, 24, 25, 23.5, 24.0, 11, 42, 61, 7, 7.2),
    'T2': (2, 3, 16, 17, 15.5, 16.0, 7, 30, 46, 5, 5.5),
    'C3': (3, 3, 24, 24, 23.5, 22.5, 0, 0, 0, 0, 7.2),
    'C2': (2, 2, 16, 16, 15.5, 14.5, 0, 0, 0, 0, 5.5),
    'T1': (1, 2, 8, 9, 7.6, 8.4, 3, 14, 29, 2, 3.6),
}
VARIANTS = dict(T4=3, T3=5, T2=4, C3=6, C2=4, T1=3)
FAMS = ('keyaki_a', 'keyaki_b')
BASE_UP = dict(T4=(0, 2, 4), T3=(0, 2, 4), T2=(0, 1, 3), T1=(0, 0, 0))


def sprite(sp, shape, v, dark=False):
    cw, ch, cx, cy, rw, rh, tw, ttop, tbase, root, rl = SHAPES[shape]
    W, H = cw * T, ch * T
    img = np.zeros((H, W, 4), np.uint8)
    seed = F.h32(sp, shape, v) % 100000
    fam = FAMS[(v + (1 if shape in ('C3', 'T1') else 0)) % 2]
    bark = PAL['bark']
    up = BASE_UP.get(shape, (0,))[v % len(BASE_UP.get(shape, (0,)))]
    tbase -= up; cy = max(cy - up, rh + 1)
    jx = (hf('vjx', seed) - 0.5) * 2.0; jr = 1.0 - 0.07 * hf('vjr', seed)
    lev = np.full((H, W), -1, int); famg = np.full((H, W), None, object)
    if tw: paint_trunk(img, cx + jx * 0.5, ttop - up, tbase, tw, bark, seed, root)
    if CROWN == 'v7':
        paint_crown_v7(img, lev, famg, cx + jx, cy, rw * jr, rh * jr, fam, seed, rl=rl,
                       bright=(-0.04, 0.03, -0.01, 0.05, -0.03, 0.01)[v % 6] - (0.10 if dark else 0.0))
    else:
        paint_crown(img, lev, famg, cx + jx, cy, rw * jr, rh * jr, fam, seed, rl=rl,
                    bright=(-0.05, 0.03, -0.01, 0.05, -0.03, 0.01)[v % 6] - (0.13 if dark else 0.0), pockets=0 if shape in ('T1',) else 2 if shape in ('C2', 'T2') else 4)
    # 수관 밑면 그늘(줄기 위 2줄)
    for x in range(W):
        col = [y for y in range(H) if lev[y, x] >= 0]
        if not col: continue
        yb = max(col)
        for k, d in ((0, 5), (1, 3)):
            y = yb - k
            if 0 <= lev[y, x] < 100: lev[y, x] = max(0, lev[y, x] - d)
    outline(lev, famg)
    if tw >= 6:
        paint_fork(img, lev, cx + jx * 0.5, int(cy + rh * jr * 0.92), tw, bark)
    flush(img, lev, famg, bark)
    return img


def all_sprites(sp='bl'):
    out = []
    for shape, n in VARIANTS.items():
        for v in range(n):
            cw, ch = SHAPES[shape][:2]
            out.append((f'{sp}-{shape}{v}', cw, ch, sprite(sp, shape, v)))
            if shape in ('T4', 'T3', 'T2'):       # 숲 속(앞에 다른 나무가 있는) 나무: 그늘진 판
                out.append((f'{sp}-{shape}{v}d', cw, ch, sprite(sp, shape, v, dark=True)))
    return out


def tones_per_tile(img):
    r = []
    for y in range(0, img.shape[0], T):
        for x in range(0, img.shape[1], T):
            t = img[y:y + T, x:x + T]; m = t[..., 3] > 0
            if m.mean() > 0.6: r.append(len({tuple(p) for p in t[m][:, :3]}))
    return r


if __name__ == '__main__':
    from PIL import Image
    sp = sys.argv[2] if len(sys.argv) > 2 else 'bl'
    ss = all_sprites(sp)
    Wd = sum(s[1] for s in ss) * T + 4 * len(ss); Hh = 5 * T + 8
    can = np.zeros((Hh, Wd, 4), np.uint8); can[..., :3] = (73, 128, 76); can[..., 3] = 255
    x = 4; tones = []
    for name, cw, ch, im in ss:
        F.over(can, im, x, 4); x += cw * T + 4; tones += tones_per_tile(im)
    print('tones/tile median', np.median(tones), 'p25', np.percentile(tones, 25))
    Image.fromarray(can).save(sys.argv[1])
