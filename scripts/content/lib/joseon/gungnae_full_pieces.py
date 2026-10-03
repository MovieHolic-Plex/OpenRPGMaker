"""국내성 원작 규모 맵(demo_gungnae_full.py)에서만 쓰는 새 조각. 기존 조각 함수를 인자만 바꿔 다시 조립한 것이 대부분이고
(기존 조각·96×96 맵은 그대로), 새로 그린 것은 세로 성벽 치(bastion)·굴 입구·타일 정렬 사립문 정도다. 색은 tk.RGB 램프만 쓴다."""
import gungnae_palace as GP
import gungnae_gates as GG
import gungnae_houses as GH
import trees as TR
from tk import *
from trees import ground_shadow

S = RGB['stone']
Wd = RGB['wood']


def _pier_full(mat='mud'):
    """담 끝 기둥 한 칸 폭(16px). 기존 wall_pier 는 10px 이라 사립문을 4칸으로 맞추면 담과 기둥 사이에 풀 틈이 생긴다."""
    cap = 'thatch' if mat == 'mud' else 'slab'
    c = Cv(T, T)
    x0, x1 = 0, T
    (GH._mud_face if mat == 'mud' else GH._stone_face)(c, x0, x1, 7, 14, 1)
    St = RGB['straw']; Sn = RGB['stone']
    for y in range(1, 7):
        for x in range(x0, x1):
            k = y - 1
            if cap == 'thatch': col = (St[6], St[5], St[5], St[4], St[3], St[2])[k]
            else: col = (Sn[5], Sn[5], Sn[4], Sn[4], Sn[3], Sn[2])[k]
            if x == x0 and k < 4 and cap == 'thatch': continue
            c.put(x, y, col)
    for x in range(x0, x1):
        c.put(x, 14, RGB['earth'][1] if mat == 'mud' else RGB['stone'][1]); c.put(x, 15, SHADOW, 80)
    return c


def sarip4(mat='mud'):
    """타일 정렬 사립문 4×1(G08): 양끝 기둥 한 칸씩 + 열린 구멍이 정확히 2칸(32px). 문짝은 왼쪽 기둥 안쪽에 붙은 가는 널 한 짝(구멍 안으로 튀어나오지 않는다)."""
    cv = Cv(4 * T, T)
    p = _pier_full(mat)
    cv.paste(p, 0, 0); cv.paste(p.hflip(), 3 * T, 0)
    St = RGB['straw']
    for x in range(T, T + 3):
        for y in range(5, 14):
            col = St[5] if x == T else (St[4] if x == T + 1 else Wd[3])
            if (y - 5) % 4 == 3: col = Wd[3]
            cv.put(x, y, col)
    return cv


def bastion_v(side='w', rows=5, seed=2):
    """세로 성벽 치(G12): 3칸 폭 세로 성벽에 2칸 폭 돌출 보루가 붙는다. side='w' 는 서쪽(바깥)으로, 'e' 는 동쪽으로 튀어나온다.
    윗면(걷는 길 + 바깥 성가퀴 띠 + 북쪽 성가퀴 줄 + 남쪽 낮은 성가퀴)과 남쪽 앞면(장대석 + 막돌)이 보인다. 폭 5칸 · 높이 rows 칸."""
    W, H = 5 * T, rows * T
    c = Cv(W, H)
    off = 2 * T if side == 'w' else 0
    tmp = Cv(GG.VW, H)
    GG._vwall_cols(tmp, 0, H, seed)
    c.paste(tmp, off, 0)
    ytop, ybot = 14, 50
    if side == 'w':
        bx0, bx1 = 0, off + 14
        band_src = (12, 21)
    else:
        bx0, bx1 = GG.VW - 14, W
        band_src = (39, 48)
    GG.walkway(c, bx0, ytop, bx1, ybot, seed)
    # 바깥쪽 가장자리 성가퀴 띠: 세로 성벽 띠 무늬를 그대로 옮긴다
    ox0 = bx0 if side == 'w' else bx1 - 9
    for y in range(ytop, ybot):
        for k in range(9):
            sx = band_src[0] + k
            px = tmp.a[y, sx]
            if px[3]:
                c.a[y, ox0 + k] = px
    for y in range(ytop, ybot):                          # 안쪽(성벽 쪽) 가장자리: 윗면이 성벽 걷는 길과 이어지게 성벽 쪽 띠를 지운다
        pass
    for x in range(bx0 + 9, bx1 - 9, 16):                # 북쪽 성가퀴 줄
        GG._merlon(c, x + 2, ytop - 6, 9, fh=5, slit=(x // 16) % 2 == 0)
    for x in range(bx0 + 9, bx1 - 9, 16):                # 남쪽 낮은 성가퀴
        GG._merlon(c, x + 3, ybot - 8, 8, fh=3)
    for x in range(bx0, bx1):                            # 윗면 앞 턱
        c.put(x, ybot, S[6]); c.put(x, ybot + 1, S[5]); c.put(x, ybot + 2, S[2])
    GG.ashlar_face(c, bx0, ybot + 3, bx1, ybot + 16, seed=seed * 3, ch=6, bw=8)
    GG.rubble_face(c, bx0, ybot + 16, bx1, H, seed=seed * 5 + 1)
    # 앞면 바깥 모서리 귀돌
    cx = (bx0, bx0 + 1, bx0 + 2, bx0 + 3) if side == 'w' else (bx1 - 1, bx1 - 2, bx1 - 3, bx1 - 4)
    for y in range(ybot + 3, H):
        for k, x in enumerate(cx):
            c.put(x, y, S[6 if k == 0 else (5 if k == 1 else 4)] if (y // 11) % 2 == 0 else S[5 if k == 0 else 4])
    # 땅 그림자(오른쪽 아래)
    for y in range(ybot + 3, H):
        for i, al in enumerate((60, 40, 20)):
            if c.a[y, min(W - 1, bx1 + i), 3] == 0 and bx1 + i < W:
                c.put(bx1 + i, y, SHADOW, al)
    return c


def cave_mouth(tone=0, seed=0, sign=True):
    """굴 입구 5×4(G14): 둥근 돌무더기 한가운데 반원 구멍(안쪽이 어둡다), 둘레 쐐기돌, 옆에 나무 팻말. tone: 0 어두운 바위 · 1 밝은 흰 바위 · 2 이끼 낀 바위."""
    W, H = 5 * T, 4 * T
    c = Cv(W, H)
    ground_shadow(c, W // 2 + 4, H - 2, W // 2 - 6, 3, 70)
    cxm = W // 2

    def lo(y):
        return int(cxm - (W // 2 - 4) * min(1.0, (y - 6) / 26.0) ** 0.6)

    def hi(y):
        return int(cxm + (W // 2 - 4) * min(1.0, (y - 6) / 26.0) ** 0.6)
    GG.rubble_face(c, 0, 8, W, H - 3, seed=seed + 3, lo=lo, hi=hi)
    if tone == 1:                                          # 밝은 바위: 한 톤 올린다
        for y in range(H):
            for x in range(W):
                if c.a[y, x, 3]:
                    r, g, b = [int(v) for v in c.a[y, x, :3]]
                    for t in range(1, 6):
                        if tuple(c.a[y, x, :3]) == tuple(S[t]):
                            c.a[y, x, :3] = S[t + 1]; break
    if tone == 2:                                          # 이끼: 윗면 가장자리에 잎 점
        for k in range(26):
            x = 6 + (k * 11 + seed * 7) % (W - 12)
            y = 8 + (k * 5) % 20
            if c.a[y, x, 3]:
                c.put(x, y, RGB['leaf'][3 if k % 2 else 2])
    # 구멍
    rx, ry = 13, 24
    ybot = H - 4
    yspring = ybot - 12
    for y in range(yspring - ry + 4, ybot):
        for x in range(cxm - rx - 3, cxm + rx + 4):
            dx = x + 0.5 - cxm
            if y < yspring:
                d = ((dx / rx) ** 2 + ((y + 0.5 - yspring) / ry) ** 2) ** 0.5
                dd = ((dx / (rx + 3)) ** 2 + ((y + 0.5 - yspring) / (ry + 3)) ** 2) ** 0.5
            else:
                d = abs(dx) / rx
                dd = abs(dx) / (rx + 3)
            if d <= 1.0:
                tt = (y - (yspring - ry)) / float(ybot - (yspring - ry))
                c.put(x, y, S[0] if tt < 0.55 else (S[1] if tt < 0.85 else S[2]))
            elif dd <= 1.0:
                seg = int((y if y >= yspring else y * 0.9) / 5) % 2
                c.put(x, y, S[6] if seg else S[5])
    for x in range(cxm - rx, cxm + rx):                      # 문턱 흙
        c.put(x, ybot, RGB['earth'][4]); c.put(x, ybot + 1, RGB['earth'][3])
    if sign:                                                 # 팻말
        px = cxm + rx + 7
        for y in range(H - 24, H - 3):
            c.put(px, y, Wd[3]); c.put(px + 1, y, Wd[4])
        for y in range(H - 28, H - 20):
            for x in range(px - 5, px + 7):
                c.put(x, y, Wd[5] if y in (H - 28,) or x in (px - 5,) else Wd[2])
        for i in range(3):
            c.put(px - 3 + i * 3, H - 25, RGB['straw'][5]); c.put(px - 3 + i * 3, H - 24, RGB['straw'][4])
    return c


def objects():
    o = {
        # 원작 정전(약 20×12칸)에 맞춰 폭 가변 인자(bays)만 키운 넓은 대전: 폭 bays+4 = 18칸, 가운데 칸이 축.
        'gnf_palace_hall_wide_14': GP.palace_hall_wide(14),
        # 전사의 길 대나무숲: 같은 그림이 6칸 안에 겹치지 않도록(지도 게이트 M4) 씨앗만 바꾼 변형. 기존 bamboo·bamboo_grove 는 그대로.
        'bamboo_b': TR.bamboo(1), 'bamboo_c': TR.bamboo(2), 'bamboo_d': TR.bamboo(3),
        'bamboo_grove_b': TR.bamboo_grove(1), 'bamboo_grove_c': TR.bamboo_grove(2), 'bamboo_grove_d': TR.bamboo_grove(3),
        # G01: 측면 문루 — 문설주를 통로 양끝 행에만(가운데는 석판이 훤히 보인다)
        'gnf_gate_side_5': GG.gate_side(5, 8, wall=GG.wall_v(1), open_passage=True),
        'gnf_palace_gate_side_3': GG.gate_side(3, 8, ramp='giwa', seed=5, post=(15, 33), pw=6, roof=(9, 39), wall=GP.pwall_v(False), wall_x=16, plaster=True, open_passage=True),
        # G02: 대문루 아치 안 통로 바닥을 큰 석판 길로(어둠은 위쪽만)
        'gnf_gate_great_12': GG.gate_great(12, 64, floor_h=14),
        # G08: 열린 폭이 정확히 2칸인 사립문
        'gnf_sarip_stone': sarip4('stone'), 'gnf_sarip_mud': sarip4('mud'),
        # G12: 세로 성벽 치
        'gnf_bastion_w': bastion_v('w', 5, 2), 'gnf_bastion_e': bastion_v('e', 5, 3),
        'gnf_bastion_w2': bastion_v('w', 5, 4), 'gnf_bastion_e2': bastion_v('e', 5, 5),
        # G13: 기단 윗면이 3칸 성벽 폭과 딱 맞는 모서리 망루(지붕·누각은 5칸 폭 그대로 — 처마만 성벽 밖으로 나온다)
        'gnf_tower_corner_5w': GG.tower_corner(5, inset=16, inset_bot=16),
        # G14: 굴 입구 3종
        'gnf_cave_dark': cave_mouth(0, 1), 'gnf_cave_white': cave_mouth(1, 2), 'gnf_cave_moss': cave_mouth(2, 3),
    }
    return o
