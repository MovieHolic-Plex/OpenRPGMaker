"""사냥터 식물·나무·야영지·표식 조각. 코드 도트, tk.RGB 램프만. 나무는 기존 trees.py 를 씨앗·모양만 바꿔 다시 그리고(같은 잎 결),
군락은 그 나무 여러 그루를 겹쳐 한 조각으로 만든다."""
import math
from tk import *
from build import outline
from props5 import shadow_ell, ell
import trees as TR
from trees import ground_shadow
from fa_rocks import boulder

GR = RGB['leaf']; WD = RGB['wood']; EA = RGB['earth']; ST = RGB['stone']; PL = RGB['plaster']
STR = RGB['straw']; PE = RGB['persimmon']; RD = RGB['red']; DB = RGB['dblue']; GI = RGB['giwa']; PI = RGB['pine']


# ------------------------------------------------------------------ 들꽃 · 덤불
def flowers(k=0):
    """들꽃 16×16: 풀잎 다발 위로 꽃송이 5개(꽃잎 3×3 십자 + 중심점, 줄기). k0 분홍 · k1 노랑 · k2 흰색+연보라. 바깥 어두운 윤곽을 두르지 않는다(작은 꽃이 죽는다)."""
    c = Cv(T, T)
    pet = [(RD[6], RD[5]), (PE[6], PE[5]), (PL[6], DB[6])][k]
    mid = [PE[6], RD[4], PE[5]][k]
    shadow_ell(c, 8.5, 14.3, 6.5, 1.5, 55)
    for bx in (2, 5, 8, 11, 13):
        for y in range(9, 14):
            c.put(bx, y, GR[5] if y < 12 else GR[4]); c.put(bx + 1, y, GR[3] if y < 12 else GR[2])
    for i, (fx, fy) in enumerate(((3, 4), (8, 2), (12, 5), (5, 8), (11, 9))):
        a = pet[i % 2]
        for dx, dy in ((0, -1), (-1, 0), (1, 0), (0, 1)):
            c.put(fx + dx, fy + dy, a)
        c.put(fx, fy, mid)
        for y in range(fy + 2, 10): c.put(fx, y, GR[4])
    return c


def _flower_bush(kind, seed, flo, berry=False):
    base = TR.bush_size('l', seed) if kind == 'l' else TR.bush('a', seed)
    c = Cv(base.w, base.h)
    c.a[:] = base.a
    n = 0
    for k in range(70):
        x = int(4 + rnd(k, seed, 11) * (c.w - 8)); y = int(4 + rnd(k, seed, 12) * (c.h - 11))
        if c.a[y, x, 3] == 255 and tuple(c.a[y, x, :3]) in {tuple(v) for v in GR[2:7]}:
            if berry:
                c.put(x, y, flo[0]); c.put(x + 1, y, flo[1]) if c.a[y, x + 1, 3] == 255 else None
                c.put(x, y + 1, flo[1]) if c.a[y + 1, x, 3] == 255 else None
            else:
                for (dx, dy, t) in ((0, 0, 0), (1, 0, 1), (0, 1, 1), (1, 1, 2)):
                    if c.a[y + dy, x + dx, 3] == 255: c.put(x + dx, y + dy, flo[t])
            n += 1
            if n >= 16: break
    return c


def bush_flower(k=0):
    """꽃 핀 덤불 48×32(3×2): 기존 큰 덤불 위에 꽃송이 2×2 를 얹었다. k0 분홍 철쭉 · k1 노란 개나리."""
    return _flower_bush('l', 5 + k, ((RD[6], RD[5], RD[4]), (PE[6], PE[5], PE[4]))[k])


def bush_berry():
    """산딸기 덤불 32×32(2×2): 둥근 덤불에 붉은 열매 점."""
    return _flower_bush('s', 9, (RD[5], RD[3]), berry=True)


def fern(k=0):
    """고사리·풀포기 16×16: 가운데서 부채꼴로 퍼진 굵은 잎(2px 폭, 끝이 밝고 안쪽이 어둡다)."""
    c = Cv(T, T)
    shadow_ell(c, 9, 14.2, 6.5, 1.4, 55)
    for i, ang in enumerate((-1.25, -0.8, -0.35, 0.1, 0.55, 1.0, 1.35)):
        L = 8 + (i % 2) * 2 + (k % 2)
        for t in range(L):
            x = 8 + math.sin(ang) * t * 0.95
            y = 14 - math.cos(ang) * t * 0.85 + (t * t) * 0.03 * (abs(ang) > 0.7)
            tone = 6 if t > L - 3 else (5 if ang < 0.2 else 4)
            c.put(int(round(x)), int(round(y)), GR[tone]); c.put(int(round(x)) + 1, int(round(y)), GR[max(2, tone - 2)]); c.put(int(round(x)), int(round(y)) + 1, GR[max(2, tone - 2)])
    for x in range(6, 11): c.put(x, 14, GR[2])
    return c


# ------------------------------------------------------------------ 통나무 · 그루터기
def log(k=0):
    """쓰러진 통나무 48×16(3×1): 가로로 누운 원통. 왼쪽 단면은 나이테, 윗면은 밝고 아래는 어둡다, 껍질 세로 결 + 이끼(k1) + 가지 그루터기."""
    c = Cv(3 * T, T)
    W_ = c.w
    shadow_ell(c, 26, 14.4, 21, 1.6, 65)
    top, bot = 4, 13
    for x in range(5, W_ - 3):
        ry = (bot - top) / 2.0
        for y in range(top, bot + 1):
            v = (y - (top + bot) / 2.0) / ry
            col = WD[6] if v < -0.7 else (WD[5] if v < -0.2 else (WD[4] if v < 0.35 else (WD[3] if v < 0.75 else WD[2])))
            if (x * 7 + y * 3) % 13 == 0 and 0.2 < rnd(x, y, 3): col = WD[max(1, [WD[i] for i in range(7)].index(col) - 1)]
            c.put(x, y, col)
    for yy in range(top, bot + 1):                                       # 왼쪽 단면(나이테 타원)
        v = (yy - (top + bot) / 2.0) / ((bot - top) / 2.0)
        hw = 4.2 * math.sqrt(max(0.0, 1 - v * v))
        for x in range(int(5 - hw), 6):
            r = ((x - 5) / 4.2) ** 2 + v * v
            c.put(x, yy, STR[5] if r < 0.12 else (STR[4] if r < 0.45 else (WD[5] if r < 0.8 else STR[3])))
    for x in range(W_ - 4, W_ - 1):                                       # 오른쪽 둥글게 끝
        for y in range(top + 1 + (x - (W_ - 4)), bot - (x - (W_ - 4))):
            c.put(x, y, WD[3])
    c.put(30, 3, WD[5]); c.put(31, 3, WD[4]); c.put(30, 2, WD[4]); c.put(31, 2, WD[3])     # 가지 그루터기
    if k == 1:
        for x in range(10, 38):
            if rnd(x, 3, 5) > 0.45:
                c.put(x, top, GR[4]);
                if rnd(x, 4, 5) > 0.5: c.put(x, top + 1, GR[3])
    outline(c)
    return c


def stump(k=0):
    """그루터기 16×16: 윗면 타원(나이테) + 껍질 있는 원통 옆면 + 뿌리 퍼짐."""
    c = Cv(T, T)
    shadow_ell(c, 9.5, 14.2, 7, 1.6, 60)
    cx, cy, rx = 8, 7 + k, 5.6
    for x in range(int(cx - rx), int(cx + rx) + 1):
        u = (x + 0.5 - cx) / rx
        yb = int(cy + 5 + 1.6 * math.sqrt(max(0, 1 - u * u)))
        for y in range(int(cy), yb + 1):
            c.put(x, y, WD[5] if u < -0.45 else (WD[4] if u < 0.05 else (WD[3] if u < 0.55 else WD[2])))
    for x in (3, 4, 12, 13):                                              # 뿌리
        c.put(x, 13 + (x > 8), WD[3]); c.put(x - 1 if x < 8 else x + 1, 14, WD[2])
    ell(c, cx, cy, rx, 2.6, lambda x, y, u, v: STR[6] if (u * u + v * v) < 0.1 else (STR[5] if (u * u + v * v) < 0.35 else (STR[4] if (u * u + v * v) < 0.62 else (WD[5] if u < 0 else WD[4]))))
    outline(c)
    return c


# ------------------------------------------------------------------ 나무 변형 · 군락
def _paste_tree(dst, src, x, y):
    dst.paste(src, x, y)


def grove(kind='z', seed=0):
    """나무 군락: 같은 종 세 그루를 높낮이 어긋나게 겹쳐 한 조각으로. 활엽 96×80(6×5) · 침엽 96×80. 뒤쪽 나무를 먼저 붙인다."""
    c = Cv(6 * T, 5 * T)
    if kind == 'z':
        parts = [(TR.zelkova(10 + seed, 0, 2), 0, 2), (TR.zelkova(11 + seed, 1, 1), 32, 0), (TR.zelkova(12 + seed, -1, 0), 16, 0)]
    else:
        parts = [(TR.pine(7 + seed, 0, 0), 0, 0), (TR.pine(8 + seed, 1, 0), 32, 2), (TR.pine(9 + seed, 0, 1), 16, 0)]
    for t, x, y in sorted(parts, key=lambda p: p[2]):
        c.paste(t, x, y)
    outline(c)
    return c


def dead_tree(k=0):
    """고목 48×64(3×4): 잎 없는 굵은 줄기가 꺾여 올라가고 마른 가지가 갈라진다. 껍질 세로 결, 뿌리 퍼짐, 가지 끝에 마른 잎 몇 점."""
    c = Cv(3 * T, 4 * T)
    ground_shadow(c, 24, 61, 16, 2.6)
    TR.trunk(c, 24, 26 + 2 * k, 62, 8, flare=6, lean=0.05 * (1 if k else -1), seed=70 + k)
    for pts, w0, w1 in ([[(24, 28), (15, 18), (9, 8), (8, 3)], 5, 2], [[(25, 30), (34, 20), (40, 12), (41, 6)], 5, 2],
                        [[(24, 26), (22, 14), (24, 4)], 4, 2], [[(15, 18), (6, 15)], 3, 1.5], [[(34, 20), (44, 22)], 3, 1.5]):
        TR.bark_line(c, pts, w0, w1, 71 + k)
    for (x, y) in ((8, 3), (41, 6), (24, 4), (6, 15), (44, 22), (12, 12)):
        c.put(x, y, STR[3]); c.put(x + 1, y, STR[2]); c.put(x, y + 1, STR[2])
    outline(c)
    return c


# ------------------------------------------------------------------ 표식 · 야영지
def signpost():
    """이정표 16×32(1×2): 말뚝에 가로 판자 두 장이 서로 반대로 뾰족하게 붙은 방향 표지. 정면에 가는 글줄."""
    c = Cv(T, 2 * T)
    shadow_ell(c, 9, 30, 6, 1.4, 60)
    for y in range(6, 30):
        c.put(7, y, WD[5]); c.put(8, y, WD[4]); c.put(9, y, WD[3]); c.put(10, y, WD[2])
    for (y0, left) in ((8, False), (16, True)):
        for dy in range(6):
            for x in range(1, 15):
                p = 14 - x if left else x - 1
                if (left and x < 3 + abs(dy - 2.5) * 0.9) or ((not left) and x > 12 - abs(dy - 2.5) * 0.9): continue
                col = WD[6] if dy == 0 else (WD[5] if dy < 4 else WD[3])
                c.put(x, y0 + dy, col)
        for x in range(5, 11, 2): c.put(x, y0 + 2, WD[2]); c.put(x, y0 + 3, WD[2])
    c.put(7, 5, WD[6]); c.put(8, 5, WD[5])
    outline(c)
    return c


def notice():
    """방(告示) 16×32(1×2): 두 기둥 사이에 널판을 대고 한지 방문 한 장과 붉은 끈. 앞면 3/4(윗면 지붕 한 줄)."""
    c = Cv(T, 2 * T)
    shadow_ell(c, 9, 30, 7, 1.5, 60)
    for x in (2, 13):
        for y in range(6, 30):
            c.put(x, y, WD[5]); c.put(x + 1, y, WD[3])
    for y in range(8, 22):
        for x in range(4, 13):
            c.put(x, y, WD[4] if x < 8 else (WD[3] if x < 11 else WD[2]))
    for y in range(10, 19):
        for x in range(5, 12):
            c.put(x, y, PL[6] if (x + y) % 5 else PL[5])
    for y in range(12, 18, 2):
        c.hl(6, 11, y, PL[2])
    c.put(8, 10, RD[4]); c.put(8, 9, RD[3])
    for x in range(1, 16):                                               # 윗덮개
        c.put(x, 5, WD[6]); c.put(x, 6, WD[5] if x < 8 else WD[3])
    outline(c)
    return c


def campfire():
    """모닥불 16×16: 돌 고리 안에 엇갈린 장작 위 불꽃(붉은 주황→노랑 심지), 잉걸."""
    c = Cv(T, T)
    shadow_ell(c, 9, 14.2, 7.5, 1.6, 60)
    for i in range(9):
        ang = math.pi * (0.05 + 0.9 * i / 8.0)
        x = 8 + 6.6 * math.cos(ang); y = 11.5 + 2.6 * math.sin(ang)
        c.put(int(x) - 1, int(y), ST[6] if i < 4 else ST[5]); c.put(int(x), int(y), ST[5] if i < 4 else ST[4]); c.put(int(x) + 1, int(y), ST[4] if i < 4 else ST[3]); c.put(int(x), int(y) + 1, ST[3]); c.put(int(x) + 1, int(y) + 1, ST[2])
    for x in range(3, 13): c.put(x, 11, EA[2]); c.put(x, 10, EA[1])
    for x in range(4, 12): c.put(x, 10, WD[4] if x % 3 else WD[3]); c.put(x, 11, WD[3])
    for (x, y, h, col) in ((4, 9, 6, PE[3]), (6, 9, 8, PE[4]), (8, 9, 11, PE[5]), (10, 9, 7, PE[4]), (7, 9, 7, PE[6]), (9, 9, 5, PE[6])):
        for yy in range(h):
            c.put(x, y - yy, col if yy < h - 1 else PE[6]); c.put(x + 1, y - yy, PE[3] if col == PE[3] else (PE[4] if col != PE[6] else PE[5]))
    for x in range(5, 11): c.put(x, 9, RD[4] if x % 2 else PE[4])
    return c


def tent(k=0):
    """천막 48×48(3×3, k0 광목 천막) · 32×32(2×2, k1 가죽 천막): 정면 대칭 원뿔형 — 왼쪽 반 밝고 오른쪽 반 어둡다, 가운데 아래 여닫이 입구(어두운 속), 꼭대기 장대,
    밑에 말뚝과 줄. 비스듬히 돌리지 않는다."""
    if k == 0:
        c = Cv(3 * T, 3 * T); W_, H_ = 48, 48; cl = PL
    else:
        c = Cv(2 * T, 2 * T); W_, H_ = 32, 32; cl = STR
    cx = W_ / 2.0
    ground_shadow(c, cx + 3, H_ - 3, W_ * 0.43, 2.8, 70)
    top, bot = 4, H_ - 5
    for y in range(top, bot + 1):
        t = (y - top) / float(bot - top)
        hw = (W_ / 2.0 - 3) * (t ** 0.85) + 0.5
        for x in range(int(cx - hw), int(cx + hw) + 1):
            u = (x + 0.5 - cx) / max(1.0, hw)
            if k == 0:
                col = cl[6] if u < -0.55 else (cl[5] if u < -0.05 else (cl[4] if u < 0.45 else (cl[3] if u < 0.8 else cl[2])))
                if (x + y // 2) % 9 == 0 and u > -0.5: col = cl[3] if u > 0 else cl[4]       # 천 솔기
            else:
                col = cl[5] if u < -0.55 else (cl[4] if u < -0.05 else (cl[3] if u < 0.45 else (cl[2] if u < 0.8 else cl[1])))
                if (x * 5 + y * 3) % 11 == 0: col = cl[3]
            c.put(x, y, col)
    dh = int((bot - top) * 0.42); dw = int(W_ * 0.12)                    # 입구
    for y in range(bot - dh, bot + 1):
        tt = (y - (bot - dh)) / float(max(1, dh))
        hw = dw * (0.55 + 0.45 * tt)
        for x in range(int(cx - hw), int(cx + hw) + 1):
            c.put(x, y, GI[0] if tt < 0.5 else ST[1])
    for y in range(bot - dh, bot + 1):                                    # 입구 천 가장자리
        tt = (y - (bot - dh)) / float(max(1, dh)); hw = dw * (0.55 + 0.45 * tt)
        c.put(int(cx - hw) - 1, y, cl[3] if k == 0 else cl[2]); c.put(int(cx + hw) + 1, y, cl[2] if k == 0 else cl[1])
    for y in range(0, top + 2):                                           # 꼭대기 장대
        c.put(int(cx), y, WD[5]); c.put(int(cx) + 1, y, WD[3])
    c.put(int(cx) + 2, 1, RD[5]); c.put(int(cx) + 3, 1, RD[4]); c.put(int(cx) + 2, 2, RD[4])   # 작은 깃
    for sx in (int(cx - W_ * 0.42), int(cx + W_ * 0.42)):                 # 말뚝 + 줄
        for y in range(bot - 1, bot + 3): c.put(sx, y, WD[5]); c.put(sx + 1, y, WD[2])
    outline(c)
    return c


def burrow():
    """짐승 굴 32×16(2×1): 흙을 파헤쳐 쌓은 낮은 흙무더기(윗면 밝고 앞면 어두움) 가운데 어두운 굴 구멍, 곁에 파낸 흙 부스러기와 발자국."""
    c = Cv(2 * T, T)
    shadow_ell(c, 17, 14.2, 13, 1.6, 60)
    cx, cy, rx, ry = 16, 9.5, 13, 5.6
    for y in range(int(cy - ry) - 1, 15):
        for x in range(int(cx - rx) - 1, int(cx + rx) + 2):
            u = (x + 0.5 - cx) / rx; v = (y + 0.5 - cy) / ry
            if u * u + v * v > 1.0 or v > 0.75: continue
            lit = -(u * 0.55 + v * 0.8)
            t = 6 if lit > 0.8 else (5 if lit > 0.35 else (4 if lit > -0.1 else (3 if lit > -0.5 else 2)))
            col = EA[t] if rnd(x, y, 3) > 0.12 else EA[max(1, t - 1)]
            c.put(x, y, col)
    ell(c, 15, 10.5, 5, 3.0, lambda x, y, u, v: GI[0] if v < 0.2 else ST[1])
    for x in range(10, 21): c.put(x, 13, EA[5] if x % 3 else EA[4])
    for (x, y) in ((3, 12), (5, 13), (27, 12), (29, 13)):
        c.put(x, y, EA[2]); c.put(x + 1, y, EA[2])
    outline(c)
    return c


def bones_field(k=0):
    """들판 짐승 뼈 16×16: 갈비뼈 호 여러 개(k0) · 큰 두개골과 뿔(k1)."""
    c = Cv(T, T)
    shadow_ell(c, 9, 14, 6.5, 1.4, 55)
    if k == 0:
        for x in range(1, 15): c.put(x, 12, PL[5] if x % 3 else PL[6]); c.put(x, 13, PL[3])
        for i in range(4):
            x = 3 + i * 3
            for y in range(5, 12):
                dx = int(round(math.sin((y - 5) / 6.0 * 1.4) * 2))
                c.put(x + dx, y, PL[6] if i % 2 == 0 else PL[5]); c.put(x + dx + 1, y, PL[3])
    else:
        ell(c, 8, 9, 5, 3.6, lambda x, y, u, v: PL[6] if (u < 0 and v < 0) else (PL[5] if u < 0.4 else PL[4]))
        for x, y in ((6, 8), (7, 8), (9, 8), (10, 8)): c.put(x, y, ST[1])
        for i in range(4):
            c.put(3 - i // 2, 6 - i, PL[5]); c.put(4 - i // 2, 6 - i, PL[3])
            c.put(13 + i // 2, 6 - i, PL[4]); c.put(12 + i // 2, 6 - i, PL[5])
        for x in range(6, 10): c.put(x, 12, PL[4]); c.put(x, 13, PL[2])
    outline(c)
    return c


def log_seat():
    """통나무 의자 16×16(야영지): 짧게 자른 통나무 눕힘 — 단면이 보이는 둥근 면 + 옆면."""
    c = Cv(T, T)
    shadow_ell(c, 9, 14, 7, 1.5, 55)
    for x in range(2, 14):
        for y in range(6, 12):
            c.put(x, y, WD[6] if y == 6 else (WD[5] if y < 8 else (WD[4] if y < 10 else WD[3])))
    ell(c, 3.5, 9, 2.4, 3.6, lambda x, y, u, v: STR[5] if (u * u + v * v) < 0.3 else (STR[4] if (u * u + v * v) < 0.7 else WD[5]))
    for x in range(4, 13): c.put(x, 12, WD[2])
    outline(c)
    return c


def drying_rack():
    """건조대 32×32(2×2): 두 기둥에 가로장, 말린 고기·가죽이 걸렸다(야영지)."""
    c = Cv(2 * T, 2 * T)
    shadow_ell(c, 17, 30, 13, 1.6, 60)
    for x in (3, 27):
        for y in range(5, 30):
            c.put(x, y, WD[5]); c.put(x + 1, y, WD[4]); c.put(x + 2, y, WD[2])
    for y in (6, 7, 8):
        for x in range(2, 31): c.put(x, y, WD[6] if y == 6 else (WD[4] if y == 7 else WD[2]))
    for (x, ln, col) in ((7, 9, (RD[4], RD[3])), (12, 12, (EA[5], EA[4])), (17, 8, (RD[4], RD[3])), (21, 11, (STR[4], STR[3]))):
        for y in range(9, 9 + ln):
            c.put(x, y, col[0]); c.put(x + 1, y, col[0]); c.put(x + 2, y, col[1])
        c.put(x, 9 + ln, col[1]); c.put(x + 1, 9 + ln, col[1])
    outline(c)
    return c


def objects():
    d = {}
    for k in range(3): d['fld_flowers_' + 'abc'[k]] = flowers(k)
    d['fld_bush_flower_a'] = bush_flower(0); d['fld_bush_flower_b'] = bush_flower(1)
    d['fld_bush_berry'] = bush_berry()
    d['fld_fern_a'] = fern(0); d['fld_fern_b'] = fern(1)
    d['fld_log_a'] = log(0); d['fld_log_b'] = log(1)
    d['fld_stump_a'] = stump(0); d['fld_stump_b'] = stump(1)
    for i in range(4):
        d['fld_zelkova_' + 'abcd'[i]] = TR.zelkova(10 + i, (0, 1, -1, 0)[i], (0, 1, 2, 3)[i])
        d['fld_pine_' + 'abcd'[i]] = TR.pine(6 + i, (0, 1, 0, 1)[i], (0, 0, 1, 1)[i])
    d['fld_grove_z'] = grove('z', 0); d['fld_grove_p'] = grove('p', 0)
    d['fld_dead_a'] = dead_tree(0); d['fld_dead_b'] = dead_tree(1)
    d['fld_signpost'] = signpost(); d['fld_notice'] = notice()
    d['fld_campfire'] = campfire()
    d['fld_tent_a'] = tent(0); d['fld_tent_b'] = tent(1)
    d['fld_burrow'] = burrow()
    d['fld_bones_a'] = bones_field(0); d['fld_bones_b'] = bones_field(1)
    d['fld_log_seat'] = log_seat()
    d['fld_rack'] = drying_rack()
    return d
