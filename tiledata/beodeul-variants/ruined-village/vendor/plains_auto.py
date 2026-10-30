# (동결 사본) 초원 하이로드(plains-highroad) 도우미 — 폐허 마을 지도에서 기존 소품을 다시 쓰려고 복사. 경로만 한 단계 깊게 고쳤다.
# 초원 하이로드 오토타일 4종(16변형, 번호 = 위1·오른2·아래4·왼8).
#  autotile-dirtroad   흙길(아래층 투명 덧그림)   autotile-stoneroad  옛 돌길(아래층)
#  autotile-woodfence  나무 울타리(위층)          autotile-stonewall  낮은 돌담(위층)
from wl import *
from wl import N_, E_, S_, W_

PAL['earth'] = ['#2d231e', '#4c3b30', '#6e5b49', '#816a56', '#8a745c', '#9e8b64', '#bcab82']
PAL['flag'] = ['#2b3330', '#3e403d', '#595b58', '#747672', '#929491', '#b0b2ae', '#d0d2cc']
LAWN = [hx(c) for c in ('#3f7a2c', '#4b8232', '#579f35', '#58a035', '#73b83e', '#8fd24a')]

# ---------------------------------------------------------------- 흙길
def dirt_shader(X, Y, m, n, seed):
    sd = seed * 3
    base = tnoise(16, 16, 8, sd) * 0.6 + tnoise(16, 16, 4, sd + 1) * 0.4
    T = 3 + np.rint((base - 0.5) * 2.6)           # 3 기준 ±1
    h = hash2(X, Y, sd + 5)
    T = np.where(h > 0.93, 5, np.where(h < 0.07, 2, T))           # 잔 점
    # 바퀴 자국: 가로 두 줄 어두운 홈(길이 주기 16 에 맞춘다) — 이웃에 관계 없이 같은 모양이라 이어진다
    rut = ((Y == 5) | (Y == 10)) & (tnoise(16, 16, 8, sd + 2) > 0.40)
    T = np.where(rut, 2, T)
    # 자갈 알: 2화소 덩이
    peb = (hash2(X // 2, Y // 2, sd + 9) > 0.93) & ((X + Y) % 2 == 0)
    T = np.where(peb, 6, T)
    T = np.where((m >= 0) & (m < 1.0), 2, np.where((m >= 1.0) & (m < 2.0), np.minimum(T, 3), T))   # 가장자리 테: 어둡게→눌린 띠
    T = np.where((m >= 0) & (m < 0.4), 1, T)
    mat = 'earth'
    rgb = P('earth')[np.clip(T, 0, 6).astype(int)]
    # 풀 잔털: 바깥(칸 안 투명 영역)에 초록 점이 드문드문 — 길 가장자리가 풀에 묻힌 느낌
    tuft = (m < 0) & (m > -1.9) & (hash2(X, Y, sd + 11) > 0.80 + 0.04 * (-m))
    tcol = np.array(LAWN)[(hash2(X, Y, sd + 12) * 6).astype(int).clip(0, 5)]
    rgb = np.where(tuft[..., None], tcol, rgb)
    return rgb, (m >= 0) | tuft

def _auto_terrain(shader, seed, inset, jag, rad):
    cells = []
    X, Y = np.meshgrid(np.arange(16), np.arange(16))
    for n in range(16):
        m, miss = edge_depth(n, inset, jag, rad, seed)
        rgb, alpha = shader(X, Y, m, n, seed)
        a = np.where(alpha, 255, 0).astype(np.uint8)
        cells.append(Image.fromarray(np.dstack([np.asarray(rgb).astype(np.uint8), a]), 'RGBA'))
    return sheet_from_cells(cells)

def dirt_road(): return _auto_terrain(dirt_shader, 11, 2.6, 1.9, 6.0)

# ---------------------------------------------------------------- 돌길(옛 포석)
def stone_shader(X, Y, m, n, seed):
    sd = seed * 5
    row = Y // 4; xo = (X + (row % 2) * 4) % 16; col = xo // 8
    lx = xo % 8; ly = Y % 4
    hb = hash2(col + 2 * row, row, sd + 1)
    base = 3 + np.rint((hb - 0.5) * 2.0) + np.rint((hash2(X, Y, sd + 2) - 0.5) * 0.7)
    T = np.where(lx == 0, 2, np.where(ly == 3, 2, base))            # 줄눈
    T = np.where((lx == 1) & (ly < 3), np.minimum(T + 1, 5), T)       # 윗왼 하이라이트
    T = np.where((ly == 0) & (lx > 0), np.minimum(T + 1, 5), T)
    # 균열 한두 줄·이끼 낀 줄눈
    crack = (hash2(col + 7 * row, row + 3, sd + 3) > 0.88) & (ly == 1) & (lx > 2) & (lx < 7)
    T = np.where(crack, 1, T)
    moss = ((lx == 0) | (ly == 3)) & (hash2(X, Y, sd + 4) > 0.82)
    T = np.where((m >= 0) & (m < 1.0), 1, np.where((m >= 1.0) & (m < 2.4), np.where((X + Y) % 5 == 0, 4, 5), T))
    rgb = P('flag')[np.clip(T, 0, 6).astype(int)]
    rgb = np.where((moss & (m >= 2.4))[..., None], np.array(LAWN[1]), rgb)
    return rgb, (m >= 0)

def stone_road(): return _auto_terrain(stone_shader, 13, 1.0, 0.9, 4.0)

# ---------------------------------------------------------------- 나무 울타리(위층)
def fence_cell(n):
    c = Cv(); o = 8
    px0, px1 = o + 6, o + 8                      # 기둥 x (3화소)
    hasN, hasE, hasS, hasW = bool(n & N_), bool(n & E_), bool(n & S_), bool(n & W_)
    # 아래쪽(남) 팔: 레일 윗면 띠 — 이웃 칸이 기둥을 그리므로 기둥 높이만큼 위로 올라간 자리에서 시작
    if hasS:
        for y in range(o + 6, 32):
            c.set(o + 7, y, 'wood', 5); c.set(o + 8, y, 'wood', 3)
            if y % 7 == 0: c.set(o + 7, y, 'wood', 4)
        for y in range(o + 11, 32): c.set(o + 6, y, 'wood', 2) if False else None
    if hasN:
        for y in range(0, o + 6):
            c.set(o + 7, y, 'wood', 5); c.set(o + 8, y, 'wood', 3)
            if y % 7 == 3: c.set(o + 7, y, 'wood', 4)
    # 기둥: 윗면(밝음) + 앞면 + 밑동 그림자
    for x in range(px0, px1 + 1):
        c.set(x, o + 2, 'wood', 6 if x == px0 else 5)
        c.set(x, o + 3, 'wood', 5)
        for y in range(o + 4, o + 14): c.set(x, y, 'wood', 5 if x == px0 else (4 if x == px0 + 1 else 3))
        c.set(x, o + 14, 'wood', 2); c.set(x, o + 15, 'wood', 1)
    for y in (o + 4, o + 9): c.set(px0, y, 'wood', 4)
    # 가로 레일 두 줄(앞면: 윗면 1 + 앞 2). 서·동 팔
    xs = []
    if hasW: xs += list(range(0, px0))
    if hasE: xs += list(range(px1 + 1, 32))
    for (ry, tops) in ((o + 4, (5, 4, 3)), (o + 9, (5, 4, 3))):
        for x in xs:
            for k in range(3): c.set(x, ry + k, 'wood', tops[k])
        # 옹이 하나
    for x in xs:
        if (x * 7 + 3) % 11 == 0: c.set(x, o + 5, 'wood', 2)
        if (x * 5 + 1) % 13 == 0: c.set(x, o + 10, 'wood', 2)
    # 못
    if hasW or hasE:
        c.set(px0 + 1, o + 5, 'iron', 3); c.set(px0 + 1, o + 10, 'iron', 3)
    # 레일이 없는 외톨이도 기둥 위로 두 짧은 가로대 끝
    if not (hasW or hasE or hasN or hasS):
        for ry in (o + 4, o + 9):
            c.rect(px0 - 2, ry, px1 + 2, ry, 'wood', 5); c.rect(px0 - 2, ry + 1, px1 + 2, ry + 2, 'wood', 3)
    return c.img()

def wood_fence(): return autotile_composed(fence_cell)

# ---------------------------------------------------------------- 낮은 돌담(위층)
def wall_cell(n):
    c = Cv(); o = 8
    hasN, hasE, hasS, hasW = bool(n & N_), bool(n & E_), bool(n & S_), bool(n & W_)
    # 윗면 띠: 중심 블록 x o+4..o+11, y o+1..o+8 + 팔
    top = np.zeros((32, 32), bool)
    top[o + 1:o + 9, o + 4:o + 12] = True
    if hasW: top[o + 1:o + 9, 0:o + 4] = True
    if hasE: top[o + 1:o + 9, o + 12:32] = True
    if hasN: top[0:o + 1, o + 4:o + 12] = True
    if hasS: top[o + 9:32, o + 4:o + 12] = True
    # 앞면: 윗면 바로 아래로 7줄(아래 이웃이 윗면이면 면 없음)
    face = np.zeros((32, 32), bool)
    for x in range(32):
        for y in range(32):
            if top[y, x] and not (y + 1 < 32 and top[y + 1, x]):
                for k in range(1, 8):
                    if y + k < 32 and not top[y + k, x]: face[y + k, x] = True
    for y in range(32):
        for x in range(32):
            if top[y, x]:
                # 윗면: 돌 얼굴 — 줄눈이 어긋난 큰 돌, 윗·왼 하이라이트
                gx = x + (0 if (y // 4) % 2 == 0 else 3)
                bw = 5 + int(hash2(gx // 5, y // 4, 71) * 3)
                t = 5 if hash2(gx // 5, y // 4, 72) > 0.4 else 4
                if (gx % 5 == 4) or (y % 4 == 0 and y > o + 1 and False): t = 3
                if y == o + 1 or (y > 0 and not top[y - 1, x]): t = 6 if (x % 3) else 5
                elif x > 0 and not top[y, x - 1]: t = 6
                elif y + 1 < 32 and top[y + 1, x] is False: t = 4
                if hash2(x, y, 73) > 0.94: t = 3
                c.set(x, y, 'flag', t)
            elif face[y, x]:
                fy = 0
                k = 1
                while y - k >= 0 and face[y - k, x]: k += 1
                row = k - 1                                 # 0..6 앞면 안 행
                gx = x + (0 if (row // 3) % 2 == 0 else 3)
                t = 3 if row < 3 else 2
                if gx % 6 == 5: t = 2 if row < 3 else 1       # 세로 줄눈
                if row % 3 == 2: t = 2 if row < 3 else 1      # 가로 줄눈
                if row == 0: t = 4
                if row == 6: t = 1
                if hash2(x, y, 74) > 0.93: t = 4
                c.set(x, y, 'flag', t)
    # 이끼
    for y in range(32):
        for x in range(32):
            if c.m[y][x] and c.m[y][x][0] == 'flag' and hash2(x // 2, y // 2, 75) > 0.90 and hash2(x, y, 76) > 0.4:
                t = c.m[y][x][1]; c.set(x, y, 'moss', min(5, max(2, t)))
    return c.img()

def stone_wall(): return autotile_composed(wall_cell)

if __name__ == '__main__':
    out = os.path.join(HERE, '_t'); os.makedirs(out, exist_ok=True)
    sh = [('dirt', dirt_road()), ('stone', stone_road()), ('fence', wood_fence()), ('wall', stone_wall())]
    big = sheet_img(sh, cols=4, scale=4)
    big.save(os.path.join(out, 'auto.png'))
