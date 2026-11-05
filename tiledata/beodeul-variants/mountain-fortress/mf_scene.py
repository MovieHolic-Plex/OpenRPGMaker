# 산악 요새 장면: 버들항 장면(_lib-5/bd5.Scene = city_v6 물체 배치·그림자·통행 BFS)에 산 땅 그리기만 바꿔 얹는다.
#   땅 = 암반(mf_ground.rock_floor) → 풀 덩이(칩셋 풀) → 눈 덮개 → 앞뜰 포석 → 자갈길 오토타일 → 골짜기 오토타일 →
#   바위 절벽 앞면(단 차 1 = 3줄, 2 = 6줄; 아래 칸이 모자라면 거기서 끊고 어둠으로) → 돌계단 → 그림자 → 물체(발치 y 순).
import os, sys
HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, HERE)
sys.path.insert(0, os.path.join(HERE, '..', '_lib-5'))
import numpy as np
from PIL import Image
import bd5
from bd5 import Scene, _hash
import mf_ground as G
from roman import ST, mul, mix
from collections import deque
from px2 import vnoise
def vn_(X, cy): return vnoise(X, cy * 16, 5, 909)

ROWS_PER_LEVEL = 3

class MScene(Scene):
    def __init__(s, *a, **k):
        super().__init__(*a, **k)
        g = lambda v: [[v] * s.W for _ in range(s.H)]
        s.grass = g(False); s.snow = g(False); s.court = g(False); s.path = g(False); s.chasm = g(False)
        s.snowy_face = g(0.0); s.rock_top = g(False)
        s.path_join = g(False); s.scree = g(False)

    # ---- 단·절벽 ----
    def faces(s):
        """F[y][x] = (k, n): 남쪽으로 떨어지는 앞면의 k 번째 줄(1..n), n = 앞면 줄 수. 아니면 0."""
        if getattr(s, '_FF', None) is not None: return s._FF
        H, W, E = s.H, s.W, s.lev
        F = [[0] * W for _ in range(H)]
        for x in range(W):
            for y in range(1, H):
                if E[y - 1][x] > E[y][x] and not F[y - 1][x]:
                    n = ROWS_PER_LEVEL * (E[y - 1][x] - E[y][x])
                    k = 0
                    while k < n and y + k < H and E[y + k][x] == E[y][x] and not s.chasm[y + k][x]:
                        k += 1
                    if k == 0:   # 골짜기: 골짜기 칸까지 앞면이 내려간다
                        while k < n and y + k < H and s.chasm[y + k][x]: k += 1
                    for j in range(k): F[y + j][x] = (j + 1, n)
        s._FF = F
        return F
    def face_mask(s):
        F = s.faces(); return [[bool(F[y][x]) for x in range(s.W)] for y in range(s.H)]
    def stair_cells(s):
        return {(x + i, y + j) for x, y, w in s.stairs for i in range(w) for j in range(ROWS_PER_LEVEL)}
    def walk_grid(s):
        F = s.faces(); sc = s.stair_cells()
        return [[(not s.block[y][x]) and (not s.chasm[y][x]) and (not s.rock_top[y][x]) and (not F[y][x] or (x, y) in sc)
                 for x in range(s.W)] for y in range(s.H)]
    def bfs(s, start, walk=None):
        walk = walk or s.walk_grid(); sc = s.stair_cells()
        seen = {start}; q = deque([start])
        while q:
            x, y = q.popleft()
            for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                nx, ny = x + dx, y + dy
                if not (0 <= nx < s.W and 0 <= ny < s.H) or (nx, ny) in seen or not walk[ny][nx]: continue
                a, b = (x, y) in sc, (nx, ny) in sc
                if s.lev[ny][nx] != s.lev[y][x] and not (a or b): continue
                if (a or b) and dx != 0 and not (a and b): continue         # 계단은 위아래로만 오르내린다
                seen.add((nx, ny)); q.append((nx, ny))
        return seen
    def cell_free(s, x, y, lv=None, margin=0):
        if not (0 <= x < s.W and 0 <= y < s.H): return False
        o = s._occ(); F = s.faces()
        if F[y][x] or (x, y) in o or s.block[y][x] or s.chasm[y][x] or (s.rock_top[y][x] and not getattr(s, '_ign_rock', False)): return False
        if lv is not None and s.lev[y][x] != lv: return False
        for j in range(-margin, margin + 1):
            for i in range(-margin, margin + 1):
                xx, yy = x + i, y + j
                if 0 <= xx < s.W and 0 <= yy < s.H and (s.path[yy][xx] or s.court[yy][xx]): return False
        return True

    # ---- 그리기 ----
    def render(s, frame=0):
        W, H = s.W, s.H; Wp, Hp = W * 16, H * 16
        rgb = G.rock_floor(Wp, Hp, s.seed + 7)
        img = Image.fromarray(rgb, 'RGB').convert('RGBA')
        F = s.faces(); sc = s.stair_cells()
        # 풀·눈·포석
        if any(any(r) for r in s.grass):
            img.alpha_composite(G.lawn_layer(G.jag_mask(s.grass, s.seed + 11, 9, 4, blur=8.0), s.seed + 12))
        if any(any(r) for r in getattr(s, 'scree', [[]])):
            img.alpha_composite(G.scree_layer(G.jag_mask(s.scree, s.seed + 31, 6, 3), s.seed + 32))
        if any(any(r) for r in s.court):
            m = np.kron(np.array(s.court, bool), np.ones((16, 16), bool))
            cr = G.flag_court(Wp, Hp)
            a = np.where(m, 255, 0).astype(np.uint8)
            court = Image.fromarray(np.dstack([cr, a]).copy(), 'RGBA').copy(); cp = court.load()
            # 연석: 포석 끝 2화소 밝은 돌 + 1화소 어두운 줄눈 (terrain.paving 의 연석과 같은 결)
            for y in range(H):
                for x in range(W):
                    if not s.court[y][x]: continue
                    on = lambda xx, yy: 0 <= xx < W and 0 <= yy < H and (s.court[yy][xx] or s.path[yy][xx] or F[yy][xx] or s.rock_top[yy][xx])
                    for ly in range(16):
                        for lx in range(16):
                            X, Y = x * 16 + lx, y * 16 + ly
                            if (not on(x, y + 1) and ly >= 13) or (not on(x, y - 1) and ly <= 2) or (not on(x - 1, y) and lx <= 2) or (not on(x + 1, y) and lx >= 13):
                                e = min(15 - ly if not on(x, y + 1) else 99, ly if not on(x, y - 1) else 99, lx if not on(x - 1, y) else 99, 15 - lx if not on(x + 1, y) else 99)
                                cp[X, Y] = tuple(ST[1] if e == 0 else (ST[6] if e == 1 else ST[5])) + (255,)
            img.alpha_composite(court)
        if any(any(r) for r in s.snow):
            img.alpha_composite(G.snow_layer(G.jag_mask(s.snow, s.seed + 21, 9, 4, blur=9.0), s.seed + 22))
        for im, x, y in s.overlays: img.alpha_composite(im, (x, y))
        # 자갈길 오토타일
        GP = G.autotile_gravelpath()
        def on(g, x, y): return 0 <= x < W and 0 <= y < H and g[y][x]
        for y in range(H):
            for x in range(W):
                if not s.path[y][x]: continue
                n = 0
                for b, (dx, dy) in ((1, (0, -1)), (2, (1, 0)), (4, (0, 1)), (8, (-1, 0))):
                    xx, yy = x + dx, y + dy
                    if on(s.path, xx, yy) or on(s.path_join, xx, yy) or (xx, yy) in sc or (0 <= xx < W and 0 <= yy < H and (s.court[yy][xx] or (not (0 <= xx < W and 0 <= yy < H)))):
                        n |= b
                    elif not (0 <= xx < W and 0 <= yy < H): n |= b
                img.alpha_composite(GP.crop(((n % 4) * 16, (n // 4) * 16, (n % 4) * 16 + 16, (n // 4) * 16 + 16)), (x * 16, y * 16))
        # 산 윗면(못 가는 바위 덩이): 암반 위에 눈 덮개를 더 짙게 — 물체(바위 봉우리·전나무)로 채운다
        # 골짜기 오토타일(작은 틈)
        CH = G.autotile_chasm()
        px = img.load()
        for y in range(H):
            for x in range(W):
                if not s.chasm[y][x] or F[y][x]: continue
                n = sum(b for b, (dx, dy) in ((1, (0, -1)), (2, (1, 0)), (4, (0, 1)), (8, (-1, 0))) if (on(s.chasm, x + dx, y + dy) or (0 <= y + dy < H and 0 <= x + dx < W and F[y + dy][x + dx] and s.chasm[y + dy][x + dx])) or not (0 <= x + dx < W))
                img.alpha_composite(CH.crop(((n % 4) * 16, (n // 4) * 16, (n % 4) * 16 + 16, (n // 4) * 16 + 16)), (x * 16, y * 16))
        # 절벽 앞면
        def need(cx, cy):
            if F[cy][cx]: return True
            if cy + 1 < H and F[cy + 1][cx]: return True
            h = s.lev[cy][cx]
            if cx > 0 and s.lev[cy][cx - 1] < h: return True
            if cx < W - 1 and s.lev[cy][cx + 1] < h: return True
            if cy > 0 and (s.lev[cy - 1][cx] < h or s.chasm[cy - 1][cx]): return True
            return False
        band = getattr(s, 'band', None)
        cells = [(cx, cy) for cy in range(H) for cx in range(W) if need(cx, cy)]
        for (cx, cy) in cells:
          for ly in range(16):
            Y = cy * 16 + ly
            for lx in range(16):
                X = cx * 16 + lx
                f = F[cy][cx]
                if band and cx in band['cols'] and band['y0'] <= cy < band['y0'] + 4 and s.chasm[cy][cx]: continue   # 낭떠러지 띠는 조각으로
                if f and (cx, cy) not in sc:
                    k, n = f; fy = ly + (k - 1) * 16; FH = n * 16
                    c = G.cliff_px(X, Y, fy, FH, cx, cy, s.seed, s.snowy_face[cy][cx])
                    if s.chasm[cy][cx] and k == 1 and ly < int(vn_(X, cy + 50) * 4):   # 윗단 바위가 골짜기 위로 조금 튀어나온다
                        px[X, Y] = tuple(G.MR[4] if ly > 0 else G.MR[5]) + (255,); continue
                    if s.chasm[cy][cx]:                          # 골짜기 벽: 아래로 어둠에 잠긴다
                        dk = min(1.0, fy / 40.0)
                        c = mul(c, 1.0 - 0.85 * dk ** 1.2)
                        if fy > 44 and (X * 7 + Y * 13) % 29 == 0: c = (34, 39, 48)
                    ends_w = cx == 0 or not F[cy][cx - 1]; ends_e = cx == W - 1 or not F[cy][cx + 1]
                    if ends_w and lx < 2: c = mul(c, 0.55 if lx == 0 else 0.75)
                    if ends_e and lx > 13: c = mul(c, 0.45 if lx == 15 else 0.7)
                    px[X, Y] = tuple(c[:3]) + (255,)
                    continue
                # 윗단 가장자리 턱: 아래 칸이 앞면 첫 줄이면 밝은 모 + 어두운 금(높이 2~4화소로 들쭉날쭉)
                if cy + 1 < H and F[cy + 1][cx] and F[cy + 1][cx][0] == 1 and (cx, cy + 1) not in sc:
                    lip = 3 + int(_hash(X // 3, cy, 41) * 2.6)
                    if ly >= 16 - lip:
                        k = ly - (16 - lip)
                        c = G.MR[6] if k == 0 else (G.MR[5] if k < lip - 1 else G.MR[2])
                        if s.snowy_face[cy + 1][cx] > 0 and _hash(X // 4, cy, 3) < s.snowy_face[cy + 1][cx] and k < lip - 1:
                            c = G.SN[6] if k == 0 else G.SN[4]
                        px[X, Y] = tuple(c) + (255,); continue
                if not f:
                    h = s.lev[cy][cx]
                    lvW = s.lev[cy][cx - 1] if cx > 0 else h; lvE = s.lev[cy][cx + 1] if cx < W - 1 else h
                    lvN = s.lev[cy - 1][cx] if cy > 0 else h
                    MR = G.MR
                    if lvW < h and not F[cy][cx - 1] and lx < 2: px[X, Y] = tuple(MR[5] if lx == 1 else MR[1]) + (255,)
                    elif lvE < h and not F[cy][cx + 1] and lx > 13: px[X, Y] = tuple(MR[3] if lx == 14 else MR[1]) + (255,)
                    elif lvN < h and ly < 2 and cy > 0 and not s.chasm[cy - 1][cx]: px[X, Y] = tuple(MR[5] if ly == 1 else MR[2]) + (255,)
                    elif cy > 0 and s.chasm[cy - 1][cx] and not s.chasm[cy][cx]:                # 골짜기 가까운 쪽 턱(들쭉날쭉, 위로 튀어나옴)
                        lip = 2 + int(vn_(X, cy) * 4)
                        if ly < lip:
                            k = lip - 1 - ly
                            px[X, Y] = tuple(MR[1] if ly == 0 else (MR[6] if ly == 1 else MR[5] if k > 0 else MR[4])) + (255,)
        if band:                                           # 성벽 아래 골짜기 낭떠러지 띠: mf_chasm 한 칸 폭 조각(변형 넷 + 받침 둘)
            import mf_chasm as CH
            for cx, (v, kind) in band['cols'].items():
                img.alpha_composite(CH.face_col(v, kind or ('snowlip' if cx in band.get('snowlip', ()) else None), seed=(3 if cx in band.get('snowlip', ()) and not kind else 0)), (cx * 16, band['y0'] * 16))
            px = img.load()
        for x0, y0, w in s.stairs: G.stair_rock(px, x0, y0, w, ROWS_PER_LEVEL)
        # 그림자(곱하기, +6,+3) — 버들항과 같다
        mask = Image.new('L', img.size, 0)
        for sy, x, y, im, sh in s.objs:
            if sh and im.height >= 40: mask.paste(255, (x + 6, y + 3), im.split()[3].point(lambda v: 255 if v > 128 else 0))
        SH = np.array(mask) > 0
        Aa = np.array(img).astype(np.float64); Aa[SH, :3] = np.floor(Aa[SH, :3] * np.array((0.52, 0.58, 0.74))); img = Image.fromarray(Aa.astype(np.uint8), 'RGBA')
        for sy, x, y, im, sh in sorted(s.objs, key=lambda o: (o[0], o[1])):
            if x >= 0 and y >= 0: img.alpha_composite(im, (x, y))
            else: img.alpha_composite(im.crop((max(0, -x), max(0, -y), im.width, im.height)), (max(0, x), max(0, y)))
        for im, x, y in s.top_overlays: img.alpha_composite(im, (x, y))
        s.img = img
        return img
