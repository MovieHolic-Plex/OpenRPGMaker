"""왕도 아스텔(Fallen Star) 새 조각 — 16px 칸, 3/4 탑뷰, 버들항 시트에 이미 있는 색만(굽기 전에 팔레트 검사).

코드 손 도트: 행 문자열 대신 규칙 함수가 점을 찍는다(성벽 3판 wall_art.py 와 같은 방식, 같은 돌·줄눈·그늘 함수를 쓴다). 생성 이미지 없음.
빛은 왼쪽 위. 돌은 3판 성벽의 차가운 밝은 회색 마름돌. 문장은 아스텔 왕실(파란 바탕 · 금빛 왕관 · 그 밑 금빛 팔방 별) — 실제 국기·종교 상징 없음.

조각(이름 → 칸은 bake_capital.py 가 정한다):
  round tower 3×11 · water gate 4×4 (북·남) · fountain 4×4 · dais 4×2 · banner pole 1×3 · wall banner 1×2 · shield 1×1
  royal lamp 1×3 · double lamp 2×3 · quay steps 1×3 (서·동 둑) · canal lock 6×2
"""
import math
import pathlib
import sys

HERE = pathlib.Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent / "beodeul-wall"))
import wall_art as A  # noqa: E402
from wall_art import Canvas, hx, h, step, step_any, stone, mortar_row, COOL, WARM, FLAG, MOSS, WOOD, IRON, FIRE, OUT, OUT2, MORT, MORT2, EDGE, CLEAR  # noqa: E402,F401

T = 16

# ================================================================ 색 (모두 버들항 시트 앞 칸에 있는 값)
# 원뿔 지붕: 버들항 마법사의 탑 원뿔 램프(오프닝 천문대와 같은 파랑) + 슬레이트 회청 한 단
CONE = [hx(c) for c in ("#131a40", "#1f2b5e", "#2f4a8f", "#446295", "#4470bd", "#6e9fdb", "#a9cbf0")]
CONE_RIM = hx("#1d2d61")   # 버들항 마법사의 탑 원뿔 그늘 윤곽
# 왕실 파랑(문장 바탕): 같은 램프의 짙은 쪽
ROYAL = [hx(c) for c in ("#131a40", "#1f2b5e", "#2f4a8f", "#4470bd", "#6e9fdb")]
GOLD = [hx(c) for c in ("#513915", "#694b05", "#aa7a08", "#ec9900", "#fbc10d", "#ecdb95")]
GLASS = [hx(c) for c in ("#ec9900", "#fbc10d", "#ecdb95")]
SLIT = [hx(c) for c in ("#0e0814", "#1f2a3e", "#2d4257")]
# 운하 물(버들항 강·운하 물 오토타일 몸통 23,153 의 값)
WATER = [hx(c) for c in ("#143c36", "#173f38", "#1a4640", "#1c4a44", "#21584e", "#2a6a60", "#2b7173", "#45716f", "#5c8184", "#a7d4db")]
# 갑문 널(버들항 나무 램프 일곱 단: 짙은 틈 → 빛 받은 결)
DECK = [hx(c) for c in ("#2a1a0f", "#452a17", "#633712", "#885a26", "#ac7044", "#c89a66", "#dcb680")]
# 운하 둑 테(오토타일 테와 같은 값): 서쪽 = 밝은 돌 두 열 + 짙은 줄, 동쪽 = 짙은 줄 + 중간 돌 두 열
KERB_W = (COOL[8], COOL[8], COOL[2])
KERB_E = (COOL[2], COOL[5], COOL[5])
FOAM = [hx(c) for c in ("#5b7d81", "#a7d4db", "#e5e7e4")]
STONE_TONES = A.STONE_TONES


def ramp_step(ramp, c, n):
    i = ramp.index(c) if c in ramp else 0
    return ramp[max(0, min(len(ramp) - 1, i + n))]


# ================================================================ 둥근 탑 3×11 (48×176)
TW, TH = 48, 176
T_CX = 23.5            # 탑 가운데 x
DRUM_R = 24.0          # 원통 반폭(x 0~47 — 칸을 꽉 채워 성벽 통로·앞면 칸에 땅이 비치지 않는다)
EAVE_R = 24.0          # 원뿔 처마 반폭(x 0~47)
APEX_Y = 12            # 원뿔 꼭대기
EAVE_Y = 66            # 원뿔 밑 타원 가운데 줄
EAVE_B = 6             # 처마 타원 세로 반축(앞쪽이 6px 처진다)
DRUM_TOP = 72          # 원통 몸 시작(맞물림 띠 밑, 가장자리 기준)
DRUM_B = 4             # 원통 켜 줄이 가운데에서 처지는 양(3/4: 앞쪽 반원이 아래로 휜다)
BASE_Y = 160           # 굽도리 시작(가장자리 기준)


def _sag(dx, r, b):
    u = max(-1.0, min(1.0, dx / r))
    return b * math.sqrt(max(0.0, 1 - u * u))


def _csag(dx, r, b):
    """원통 켜 줄의 처짐: 포물선 반올림 — 가운데로 갈수록 1px 씩 고르게 처져 켜 줄이 원통 호를 따라 휜다(타원 int 는 가운데가 평평했다)."""
    u = max(-1.0, min(1.0, dx / r))
    return int(round(b * (1 - u * u)))


def _cyl_shade(u):
    """원통 명암(빛이 왼쪽 위): 왼쪽 가장자리 한 단 어둡게, 왼쪽 1/3 밝게, 오른쪽으로 갈수록 두세 단 어둡게."""
    if u < -0.86: return -1
    if u < -0.2: return 1
    if u < 0.3: return 0
    if u < 0.62: return -1
    if u < 0.86: return -2
    return -3


def cone(cv, ox=0, oy=0, apex=APEX_Y, eave_y=EAVE_Y, r=EAVE_R, b=EAVE_B, cx=T_CX, seed="cone"):
    """원뿔 지붕: 비늘 슬레이트 줄(타원 호를 따라 처진다), 왼쪽 위 빛 · 오른쪽 그늘 · 줄마다 밑 그늘선 · 처마 테."""
    H = eave_y - apex
    NR = 8
    for y in range(apex, eave_y + b + 1):
        for x in range(int(cx - r) - 1, int(cx + r) + 2):
            dx = x + 0.5 - cx
            if y <= eave_y:
                w = r * (y + 0.5 - apex) / H
                if abs(dx) > w + 0.35: continue
                u = dx / max(0.8, w)
            else:
                if abs(dx) > r: continue
                if y + 0.5 > eave_y + _sag(dx, r, b): continue
                u = dx / r
            u = max(-1.0, min(1.0, u))
            # 비늘 줄: 꼭대기에서 처마로 t, 줄 경계는 처마와 같은 호로 처진다
            t = (y + 0.5 - apex) / (H + b * math.sqrt(max(0.0, 1 - u * u)))
            t = max(0.0, min(1.0, t))
            row = int(t * NR)
            within = t * NR - row
            n = 3 + int(t * 7)
            ph = (math.asin(u) / math.pi + 0.5) * n + (0.5 if row % 2 else 0)
            col = int(ph)
            fx = ph - col
            sh = _cyl_shade(u)
            k = 3 + (1 if sh > 0 else sh - 1 if sh < 0 else -1)
            if h(seed, row, col) % 5 == 0: k -= 1
            elif h(seed, row, col) % 7 == 0: k += 1
            edge = 0.7 + 0.28 * (1 - (2 * fx - 1) ** 2)       # 둥근 비늘 밑선(가운데가 처진다)
            if within > edge: k -= 2
            elif fx < 0.1 and within > 0.25: k -= 1           # 비늘 사이 틈
            elif within < 0.3 and fx < 0.5: k += 1            # 비늘 윗머리 빛
            if u < 0.1 and 0.25 < within < 0.5 and 0.2 < fx < 0.45 and h(seed, row, col, "gl") % 2 == 0: k += 2   # 반짝 점
            k = max(0, min(len(CONE) - 2, k))
            if abs(dx) > (r * (y + 0.5 - apex) / H if y <= eave_y else r) - 0.9 and y < eave_y:
                # 윤곽: 버들항 마법사의 탑처럼 빛 받는 왼쪽은 중간 파랑, 그늘 오른쪽은 짙은 남청(검정 계단 대신 물든 윤곽)
                cv.set(ox + x, oy + y, CONE_RIM if dx > 0 else CONE[3]); continue
            cv.set(ox + x, oy + y, CONE[k])
    # 처마 테: 앞쪽 호 1px 밝은 테 + 그 밑 짙은 선
    for x in range(int(cx - r), int(cx + r) + 1):
        dx = x + 0.5 - cx
        if abs(dx) > r: continue
        ye = int(eave_y + _sag(dx, r, b))
        u = dx / r
        cv.set(ox + x, oy + ye, CONE[0])
        cv.set(ox + x, oy + ye - 1, CONE[4] if u < -0.2 else CONE[3] if u < 0.4 else CONE[2])


def finial(cv, x, y, pennant=True):
    """꼭대기 쇠 꼬챙이 + 금빛 공 + 아스텔 삼각기(파랑 바탕 · 금빛 별 한 점)."""
    for i in range(0, 12):
        cv.set(x, y - i, IRON[2] if i % 3 else IRON[1])
    cv.set(x + 1, y - 1, IRON[0])
    # 금빛 공
    cv.set(x - 1, y - 5, GOLD[2]); cv.set(x, y - 5, GOLD[4]); cv.set(x + 1, y - 5, GOLD[1])
    cv.set(x, y - 6, GOLD[3]); cv.set(x, y - 4, GOLD[1])
    cv.set(x, y - 12, GOLD[4])
    if pennant:
        for i in range(9):
            for j in range(max(1, 4 - (i * 4) // 9)):
                c = ROYAL[3] if j == 0 else ROYAL[2]
                if i >= 6: c = ROYAL[2] if j == 0 else ROYAL[1]
                cv.set(x + 1 + i, y - 11 + j + (1 if i > 5 else 0), c)
        cv.set(x + 3, y - 10, GOLD[4])


def drum(cv, top=DRUM_TOP, bottom=TH - 1, cx=T_CX, r=DRUM_R, b=DRUM_B, seed="drum", window="slits"):
    """원통 몸: 휘는 켜 돌쌓기(돌은 가장자리로 갈수록 좁다) · 원통 명암 · 맞물림 띠 · 굽도리 · 앞쪽 처진 밑선."""
    x0, x1 = int(math.floor(cx - r + 0.5)), int(math.ceil(cx + r - 0.5))
    course_h = (6, 5, 7, 5, 6, 7, 5, 6, 5, 7, 6, 5)
    # 각 열의 처짐
    for x in range(x0, x1 + 1):
        dx = x + 0.5 - cx
        if abs(dx) > r: continue
        u = dx / r
        sag = _csag(dx, r, b)
        sh = _cyl_shade(u)
        ylo = top + sag
        yb = BASE_Y + sag
        yend = bottom - b + sag
        # 켜 찾기
        y = top
        for yy in range(ylo, yend + 1):
            rel = yy - sag - top          # 처짐을 걷어낸 높이
            if yy >= yb:
                # 굽도리: 내민 턱 2 + 큰 돌 + 짙은 밑
                k = yy - yb
                if k == 0: c = COOL[10]
                elif k == 1: c = COOL[8]
                elif k == 2: c = COOL[5]
                elif yy >= yend - 1: c = OUT2 if yy == yend - 1 else OUT
                else:
                    ang = (math.asin(max(-1, min(1, u))) / math.pi + 0.5) * 7
                    seg = int(ang)
                    if ang - seg < 0.12 * (1 + abs(u) * 3) and abs(u) < 0.95: c = MORT
                    else:
                        c = [COOL[6], COOL[7], WARM[4], COOL[5]][h(seed, "pl", seg) % 4]
                        if k == 3: c = step(c, 1)
                        if h(seed, "mud", x, yy) % 3 == 0 and k > 6: c = step(c, -1)
                        if k == 8 and h(seed, "moss", x) % 4 == 0: c = MOSS[1 + h(seed, x) % 2]
                c = step_any(c, min(0, sh)) if c not in (OUT, OUT2, MORT) and c not in MOSS else c
                cv.set(x, yy, c)
                continue
            # 켜
            acc = 0; ci = 0
            while True:
                ch = course_h[ci % len(course_h)]
                if rel < acc + ch: break
                if rel == acc + ch: break
                acc += ch + 1; ci += 1
            ch = course_h[ci % len(course_h)]
            if rel == acc + ch:
                cv.set(x, yy, MORT2 if h(seed, x, ci, "mj") % 6 == 0 else MORT)
                continue
            # 돌 나누기: 각도에 고르게(가장자리에서 좁아 보인다), 켜마다 반 칸 엇갈림
            nst = 9
            ang = (math.asin(max(-1, min(1, u))) / math.pi + 0.5) * nst + (0.5 if ci % 2 else 0) + (h(seed, ci, "off") % 3) * 0.15
            sid = int(ang)
            fx = ang - sid
            jw = 0.1 + 0.1 * abs(u)
            if fx < jw and abs(u) < 0.97:
                cv.set(x, yy, MORT)
                continue
            tone = STONE_TONES[h(seed, ci, sid, "t") % len(STONE_TONES)]
            if rel > 60 and h(seed, ci, sid, "dk") % 2 == 0: tone = step(tone, -1)
            ry = rel - acc
            c = tone
            if ry == 0 and fx < 0.8: c = step(tone, 1)
            elif fx < jw + 0.1 and ry <= 2: c = step(tone, 1)
            if ry == ch - 1: c = step(tone, -1)
            elif fx > 0.9: c = step(tone, -1)
            if h(seed, x, yy, "sp") % 9 == 0 and 0 < ry < ch - 1: c = step(c, -1)
            c = step_any(c, sh)
            cv.set(x, yy, c)
    # 윤곽(실루엣 좌우): 검은 줄 대신 그 자리 돌을 한 번 더 어둡게 — 빛 받는 왼쪽은 두 단, 그늘 오른쪽은 세 단(버들항 마법사의 탑처럼).
    # 성벽·성문루가 탑 옆에 붙을 때 1px 검은 이음줄이 생기지 않는다
    for yy in range(top, bottom + 1):
        for x, n in ((x0, -2), (x1, -3)):
            c = cv.get(x, yy)
            if c[3] and c not in (OUT, OUT2): cv.set(x, yy, step_any(c, n))
    # 밑 처진 선
    for x in range(x0, x1 + 1):
        dx = x + 0.5 - cx
        yend = bottom - b + _csag(dx, r, b)
        cv.set(x, yend, OUT)


def slit(cv, x, y, n=8, lit=False):
    """좁은 둥근 머리 창(유리 3px): 왼쪽 빛 나팔면 · 오른쪽 그늘 · 창턱 빛. lit 이면 따뜻한 불빛 창."""
    for i in range(-1, n + 1):
        for dx in range(-2, 3):
            if i == -1 and dx in (-2, 2): continue
            if i == -1: c = COOL[10] if dx < 1 else COOL[8]
            elif i == n: c = COOL[11] if dx < 1 else COOL[9]
            elif dx == -2: c = COOL[10]
            elif dx == 2: c = COOL[5]
            else:
                head = i == 0 and dx != 0
                if lit:
                    c = GLASS[1] if (dx == 0 and 1 < i < n - 1) else GLASS[0]
                    if head: c = OUT
                else:
                    c = SLIT[0] if (head or dx == 1) else SLIT[1]
                    if dx == -1 and 1 <= i <= 3: c = SLIT[2]
            cv.set(x + dx, y + i, c)
    if lit:
        for (dx, dy) in ((-3, 1), (3, 2), (-3, n // 2), (3, n - 1), (0, n + 1), (-1, n + 1)):
            c = cv.get(x + dx, y + dy)
            if c in COOL: cv.set(x + dx, y + dy, WARM[7] if c in COOL[8:] else WARM[5])


def corbel_ring(cv, y0, cx=T_CX, r=DRUM_R, b=DRUM_B, seed="cor"):
    """원뿔 밑 내민 받침돌 띠(6행): 갓 2행 + 받침돌·짙은 틈 4행 — 원통 호를 따라 처진다."""
    for x in range(int(cx - r), int(cx + r) + 1):
        dx = x + 0.5 - cx
        if abs(dx) > r: continue
        u = dx / r
        sh = _cyl_shade(u)
        yy = y0 + _csag(dx, r, b)
        ang = (math.asin(max(-1, min(1, u))) / math.pi + 0.5) * 11
        k = ang - int(ang)
        for i in range(6):
            if i == 0: c = COOL[10]
            elif i == 1: c = COOL[8]
            else:
                if k < 0.55: c = COOL[9] if i == 2 else COOL[7] if i < 5 else COOL[5]
                else: c = OUT if i >= 3 else OUT2
            if c not in (OUT, OUT2): c = step_any(c, sh)
            cv.set(x, yy + i, c)
        if x in (int(cx - r), int(cx + r)):
            for i in range(6): cv.set(x, yy + i, EDGE)


def round_tower(var=0, lit=False):
    """둥근 성벽 탑 3×11(48×176): 파란 원뿔 비늘 지붕 + 꼭대기 쇠 꼬챙이·금빛 공·아스텔 삼각기,
    원뿔 밑 내민 받침돌 띠, 3판 성벽 돌의 원통 몸(휘는 켜·좁아지는 돌·원통 명암), 좁은 창, 굽도리.
    4·5행 = 성벽 통로가 탑 밑을 지나는 줄(★). 10행 = 성벽 앞면 아래 땅 줄(탑이 한 줄 앞으로 내민다)."""
    cv = Canvas(TW, TH)
    drum(cv, seed=("drum", var))
    corbel_ring(cv, DRUM_TOP - 6, seed=("cor", var))
    # 원뿔이 몸에 드리운 그늘(처마 바로 밑 두 줄)
    cone(cv, seed=("cone", var))
    finial(cv, 23, APEX_Y + 1)
    # 창: 가운데 줄 세 개(변형마다 자리 다름) — lit 이면 하나가 따뜻한 불빛
    if var == 0:
        spots = [(23, 88), (23, 112), (23, 136)]
    else:
        spots = [(16, 92), (30, 104), (21, 132)]
    for i, (x, y) in enumerate(spots):
        slit(cv, x, y + _csag(x + 0.5 - T_CX, DRUM_R, DRUM_B), 9, lit=lit and i == 1)
    return cv


# ================================================================ 운하 수문 앞면 4×4 (64×64) — 성벽 앞면 네 줄을 바꾼다
WG_ARCHES = (15.5, 47.5)     # 두 아치 가운데 x
WG_R = 10.5                  # 열린 반폭(x 5~26 · 37~58)
WG_SPRING = 30               # 이 줄 아래는 곧은 문설주
WG_RING = 4                  # 홍예 두께
WG_WATER = 41                # 아치 안 물 높이(이 줄부터 물)


def _wg_open(x, y, cx):
    dx = abs(x + 0.5 - cx)
    if y >= WG_SPRING: return dx <= WG_R
    dy = WG_SPRING - y
    return dx * dx + dy * dy <= WG_R * WG_R


def _wg_ring(x, y, cx):
    """홍예돌 자리면 (각도, 바깥까지 남은 두께), 아니면 None."""
    X, Y = x + 0.5 - cx, min(0.0, y + 0.5 - WG_SPRING)
    d = math.hypot(X, Y)
    if y >= WG_SPRING:
        if WG_R < abs(X) <= WG_R + WG_RING and y < WG_SPRING + 3: return (90.0 if X > 0 else -90.0, WG_R + WG_RING - abs(X))
        return None
    if WG_R < d <= WG_R + WG_RING: return (math.degrees(math.atan2(X, -Y)), WG_R + WG_RING - d)
    return None


def water_gate(side="N"):
    """운하 수문 앞면: 3판 성벽 앞면 네 열을 바탕으로 두 둥근 아치(홍예돌·쐐기돌)를 뚫고, 아치 안은 어두운 물길,
    아래 줄은 아치 밖으로 흘러나오는 물(물보라). 가운데 교각은 물가르개 받침. N = 북쪽 성벽 안쪽 면(들어 올린 쇠창살),
    S = 남쪽 성벽 바깥 면(가운데 교각에 아스텔 방패, 물때 짙게)."""
    cv = Canvas(64, 64)
    vars_ = ("a", "b", "e", "f") if side == "N" else ("b", "g", "a", "h")
    for i, v in enumerate(vars_):
        col = A.face_column("abcdefgh".index(v))
        cv.paste(col, i * 16, 0)
    seed = ("wg", side)
    for cx in WG_ARCHES:
        for y in range(4, 64):
            for x in range(64):
                if _wg_open(x, y, cx):
                    dx = x + 0.5 - cx
                    if y < WG_WATER:
                        # 터널 안: 궁륭 돌 켜(짙은 돌 · 줄눈)가 안으로 물러나고, 끝에 건너편 출구 빛이 작게 보인다
                        depth_in = abs(dx) < 5.5 and y >= WG_WATER - 7
                        if depth_in:
                            c = WATER[7] if y >= WG_WATER - 3 else COOL[3] if y >= WG_WATER - 5 else COOL[2]
                            if abs(dx) > 4.5: c = OUT2
                        else:
                            ring = (y - (WG_SPRING - WG_R)) % 5 == 0
                            c = OUT if ring else (COOL[1], OUT2, OUT, COOL[1])[h(seed, x // 3, y // 5, "vs") % 4]
                            if abs(dx) > WG_R - 2.5 and y > WG_SPRING - 7: c = COOL[3] if dx < 0 else OUT       # 볼(왼쪽 빛 · 오른쪽 그늘)
                            elif abs(dx) > WG_R - 4.5 and y > WG_SPRING - 3: c = COOL[2] if dx < 0 else OUT
                            if (x + (y // 5)) % 7 == 0 and not ring and c != COOL[3]: c = MORT if dx < 0 else OUT
                    else:
                        # 물: 안쪽(위) 짙고 앞(아래)으로 밝다. 가로 물결 빛 줄
                        d = (y - WG_WATER) / (63 - WG_WATER)
                        k = 0 if d < 0.15 else 2 if d < 0.4 else 3 if d < 0.65 else 5
                        if dx > WG_R - 3: k = max(0, k - 1)                     # 오른쪽 볼 그늘
                        c = WATER[k]
                        if (y + int(dx * 0.3) + h(seed, x // 3, "wv")) % 5 == 0 and d > 0.2: c = WATER[min(9, k + 3)]
                        if y > 57 and abs(dx) > WG_R - 4 and h(seed, x, y, "fm") % 3 == 0: c = FOAM[h(seed, x, "f2") % 2]
                        elif y > 59 and h(seed, x, y, "fm2") % 7 == 0: c = FOAM[1]
                    cv.set(x, y, c)
                else:
                    r = _wg_ring(x, y, cx)
                    if r is None: continue
                    ang, rem = r
                    # 홍예돌: 각도 18°마다 이음, 쐐기돌(가운데)은 넓고 밝다
                    key = abs(ang) < 10
                    seg = int((ang + 100) // 20)                      # 20° 쐐기 열 개, 가운데(-10~10°) = 쐐기돌
                    # 깨끗한 쐐기돌: 돌마다 한 색(번갈아 두 톤), 이음은 반지름 방향 1줄, 바깥 테 1줄 빛 · 안쪽 테 1줄 그늘, 잡점 없음
                    tone = COOL[10] if key else COOL[9] if ang < 0 else COOL[8]
                    if (ang + 100) % 20 < 1.6 and abs(ang) < 89: c = MORT
                    elif rem < 0.9: c = MORT if not key else COOL[8]
                    else:
                        c = tone
                        if ang > 40: c = step_any(c, -1)                                   # 오른쪽 어깨 그늘
                        if rem > WG_RING - 1.1: c = step_any(tone, -2 if ang > 10 else -1)   # 안쪽 테(터널 쪽으로 꺾인 면)
                        elif rem < 1.8 and ang < 30: c = step_any(c, 1)                    # 바깥 테 빛(왼쪽 위 빛)
                    cv.set(x, y, c)
        # 쐐기돌 머리(링 위로 한 켜 솟는다)
        kx = int(cx)
        for y in range(WG_SPRING - int(WG_R) - WG_RING - 2, WG_SPRING - int(WG_R) - WG_RING + 1):
            for x in range(kx - 1, kx + 3):
                cv.set(x, y, COOL[11] if x < kx + 1 else COOL[9])
        cv.set(kx + 2, WG_SPRING - int(WG_R) - WG_RING - 2, COOL[8])
    # 교각 받침: 물 높이 아래 돌은 젖어 짙고, 물가에 이끼 띠, 맨 밑은 물이 핥는다
    for x in range(64):
        if any(_wg_open(x, 50, cx) for cx in WG_ARCHES): continue
        for y in range(WG_WATER + 6, 64):
            c = cv.get(x, y)
            if c[3] and c not in (OUT, OUT2):
                n = -1 if y < 56 else -2
                cv.set(x, y, step_any(c, n))
        for y in (WG_WATER + 5, WG_WATER + 6):
            if h(seed, x, y, "ms") % 3: cv.set(x, y, MOSS[(x + y) % 3])
        for y in (62, 63):
            if h(seed, x, y, "lap") % 3 == 0: cv.set(x, y, WATER[5 + h(seed, x, "lc") % 2])
            elif y == 63: cv.set(x, y, WATER[3])
    # 가운데 교각 발치 물보라(양쪽 아치 물이 교각을 핥는다)
    for (x, y) in ((25, 62), (26, 61), (27, 63), (37, 62), (36, 63), (38, 61), (4, 63), (59, 62)):
        cv.set(x, y, FOAM[1])
    if side == "N":
        # 들어 올린 쇠창살: 아치 머리에 살 끝이 내려와 보인다
        for cx in WG_ARCHES:
            for x in range(int(cx - WG_R) + 1, int(cx + WG_R) + 1):
                if (x - int(cx)) % 4 != 0: continue
                for y in range(WG_SPRING - 9, WG_SPRING + 1):
                    if _wg_open(x, y, cx):
                        cv.set(x, y, IRON[2] if y < WG_SPRING else COOL[6]); cv.set(x + 1, y, IRON[1] if y < WG_SPRING else OUT)
            for x in range(int(cx - WG_R) + 1, int(cx + WG_R) + 1):
                for y in (WG_SPRING - 3,):
                    if _wg_open(x, y, cx): cv.set(x, y, IRON[1] if x % 4 else IRON[2])
    else:
        # 가운데 교각 위 아스텔 방패(성벽 바깥 면)
        royal_shield(cv, 31, 12)
    return cv


# ================================================================ 아스텔 문장
def star8(cv, cx, cy, big=False):
    """금빛 팔방 별(5×5, big 이면 7×7): 가로·세로 긴 살 + 대각 짧은 살, 가운데 밝다."""
    r = 3 if big else 2
    for i in range(-r, r + 1):
        cv.set(cx + i, cy, GOLD[3] if abs(i) < r else GOLD[2])
        cv.set(cx, cy + i, GOLD[3] if abs(i) < r else GOLD[2])
    for d in (-1, 1):
        cv.set(cx + d, cy + d, GOLD[3]); cv.set(cx + d, cy - d, GOLD[3])
        if big:
            cv.set(cx + 2 * d, cy + 2 * d, GOLD[2]); cv.set(cx + 2 * d, cy - 2 * d, GOLD[2])
    cv.set(cx, cy, GOLD[5])


CROWN7 = ("#..#..#", "##.#.##", "#######", "#r#b#r#", "#######")
CROWN5 = ("#.#.#", "#####", "#r#r#", "#####")


def crown(cv, x, y, small=False):
    """금빛 왕관(7×5 · small 5×4): 세 뾰족 끝 금구슬 · 띠에 파랑 보석."""
    rows = CROWN5 if small else CROWN7
    w = len(rows[0])
    for j, r in enumerate(rows):
        for i, ch in enumerate(r):
            if ch == ".": continue
            if ch == "r": c = ROYAL[3]
            elif ch == "b": c = ROYAL[4]
            else:
                c = GOLD[4] if (j == 0 or i < w // 2) else GOLD[3]
                if j == len(rows) - 1: c = GOLD[2] if i < w - 1 else GOLD[1]
            cv.set(x + i, y + j, c)


def royal_shield(cv, cx, y, small=False):
    """아스텔 방패: 금 테 · 파랑 바탕(왼쪽 빛) · 금 왕관 위 · 팔방 별 아래 · 밑이 뾰족. small 은 9×11, 아니면 11×13."""
    w = 9 if small else 11
    hgt = 11 if small else 14
    x0 = cx - w // 2
    for yy in range(hgt):
        inset = 0 if yy < hgt - 5 else (yy - (hgt - 5)) // 1
        inset = min(inset, w // 2)
        for xx in range(x0 + inset, x0 + w - inset):
            edge = xx in (x0 + inset, x0 + w - 1 - inset) or yy == 0 or (yy == hgt - 1)
            if edge: c = GOLD[2] if xx < cx else GOLD[1]
            else:
                c = ROYAL[3] if xx < cx - 1 else ROYAL[2] if xx < cx + 2 else ROYAL[1]
                if yy == 1: c = ramp_step(ROYAL, c, 1)
                elif yy >= hgt - 6: c = ramp_step(ROYAL, c, -1)                       # 밑으로 갈수록 짙다(볼록한 판)
                if xx == x0 + inset + 1 and 0 < yy < hgt - 2: c = ROYAL[4] if yy < hgt - 6 else ROYAL[3]   # 왼쪽 안 테 빛(두께)
                if yy == 1 and x0 + inset < xx < cx: c = ROYAL[4]                  # 윗 테 빛
            cv.set(xx, y + yy, c)
        cv.shade(x0 + w - inset, y + yy + 1, -2)
    for xx in range(x0 + 1, x0 + w): cv.shade(xx, y + hgt, -2)
    crown(cv, cx - 2 if small else cx - 3, y + 2, small)
    star8(cv, cx, y + (7 if small else 9))


# ================================================================ 광장 분수 4×4 (64×64)
SH1, SH2, SH3 = A.SH1, A.SH2, A.SH3
F_CX, F_CY = 31.5, 41.5      # 수반 타원 가운데
F_A, F_B = 30.5, 13.5        # 바깥 테 반축
F_RIM = 4                    # 테 윗면 두께(가로)
F_FACE = 9                   # 앞 테 앞면 높이


def _ell(x, y, a, b, cx=F_CX, cy=F_CY):
    return ((x + 0.5 - cx) / a) ** 2 + ((y + 0.5 - cy) / b) ** 2


def fountain(frame=0):
    """광장 분수: 둥근 돌 수반(테 윗면 = 타원 고리, 앞 테 앞면 = 휘는 돌 켜), 물 위 물결 고리, 가운데 기둥·받침 그릇 두 단 ·
    금빛 팔방 별 꼭지, 위 그릇에서 넘쳐 떨어지는 물줄기와 물보라. frame 0~2 는 물결·물줄기만 다르다(움직임)."""
    cv = Canvas(64, 64)
    seed = "fnt"
    ia, ib = F_A - F_RIM, F_B - F_RIM * F_B / F_A - 0.6
    # 땅 그림자(오른쪽 아래, 반투명)
    for y in range(30, 64):
        for x in range(64):
            if _ell(x - 3, y - 3, F_A, F_B + F_FACE * 0.5) <= 1.0 and _ell(x, y, F_A, F_B) > 1.0:
                cv.set(x, y, SH2)
    # 앞 테 앞면: 바깥 타원 아래 반 호에서 F_FACE 줄 아래로
    for x in range(64):
        dx = x + 0.5 - F_CX
        if abs(dx) > F_A: continue
        u = dx / F_A
        ybot = F_CY + F_B * math.sqrt(max(0.0, 1 - u * u))
        # 테 윗면 타원이 이 열에서 실제로 끝나는 줄 — 앞면을 거기 바로 밑에서 시작해 테와 앞면 사이 빈 점(구멍)이 없다
        ylast = max((yy for yy in range(64) if _ell(x, yy, F_A, F_B) <= 1.0), default=int(ybot))
        sh = _cyl_shade(u)
        ang = (math.asin(max(-1, min(1, u))) / math.pi + 0.5) * 9
        for y in range(ylast + 1, int(ybot) + F_FACE + 1):
            if y >= 64: continue
            k = max(1, y - int(ybot))
            if k == F_FACE: c = OUT
            elif k == 1: c = COOL[9]
            elif k == 4:
                c = MORT
            else:
                off = 0.5 if k > 4 else 0
                seg = int(ang + off)
                if (ang + off) - seg < 0.14 + 0.1 * abs(u): c = MORT
                else:
                    c = STONE_TONES[h(seed, seg, k > 4) % len(STONE_TONES)]
                    if k in (2, 5): c = step_any(c, 1)
                    if k in (3, 7): c = step_any(c, -1)
                    if (ang + off) - seg > 0.85: c = step_any(c, -1)
                    c = speck(c, seed, x, y, 5)
                    if k == 8 and h(seed, x, "ms") % 4 == 0: c = MOSS[2]
            if c not in (OUT, MORT) and c not in MOSS: c = step_any(c, sh)
            cv.set(x, y, c)
        if abs(dx) > F_A - 1:
            for y in range(int(ybot) - 3, int(ybot) + F_FACE): cv.set(x, y, EDGE)
    # 테 윗면(타원 고리) + 물
    for y in range(64):
        for x in range(64):
            e = _ell(x, y, F_A, F_B)
            if e > 1.0: continue
            ei = _ell(x, y, ia, ib)
            dx, dy = x + 0.5 - F_CX, y + 0.5 - F_CY
            if ei > 1.0:
                # 테 윗면: 판돌 이음(각도마다), 바깥 가장자리 밝은 턱 · 안쪽 가장자리 그늘
                ang = math.degrees(math.atan2(dy * F_A / F_B, dx)) % 360
                seg = int(ang // 22.5)
                if ang % 22.5 < 2.6: c = MORT
                else:
                    c = [COOL[9], COOL[10], COOL[9], WARM[6], COOL[8], WARM[5]][h(seed, "rim", seg) % 6]
                    if ang % 22.5 < 4.5: c = step_any(c, 1)              # 판돌 왼쪽 머리 빛
                    elif ang % 22.5 > 20: c = step_any(c, -1)            # 판돌 오른쪽 끝 그늘
                    if e > 0.86 and dy < 0: c = step_any(c, 1)           # 뒤 테 바깥 턱(빛)
                    if e > 0.86 and dy > 0: c = step_any(c, 1 if dx < 0 else 0)
                    if ei < 1.18: c = step_any(c, -1 if dy > 0 else -2)  # 안쪽 가장자리(물 쪽으로 꺾인다)
                    if dx > F_A * 0.55: c = step_any(c, -1)
                    if dx < -F_A * 0.5 and dy < 0: c = step_any(c, 1)
                    c = speck(c, seed, x, y, 6)
                # 바깥 윤곽: 4이웃 중 하나라도 타원 밖인 점만(두께 1px — 두꺼운 계단 덩어리가 생기지 않는다)
                if any(_ell(x + ax, y + ay, F_A, F_B) > 1.0 for ax, ay in ((1, 0), (-1, 0), (0, 1), (0, -1))):
                    c = EDGE if dy < 0 else COOL[9] if dx < 0 else COOL[7]
                cv.set(x, y, c)
            else:
                # 물: 뒤쪽(위)은 테 그늘로 짙고, 앞쪽으로 밝다. 기둥 둘레 물결 고리(frame 마다 퍼진다)
                d = (dy / ib + 1) / 2 + ((h(seed, x, y, "dw") % 5) - 2) * 0.04     # 띠 경계를 흩뜨린다(물결 결)
                k = 1 if d < 0.15 else 2 if d < 0.3 else 3 if d < 0.5 else 4 if d < 0.72 else 5 if d < 0.9 else 6
                if dx > ia * 0.5: k -= 1
                if dx < -ia * 0.55 and d > 0.4: k += 1
                k = max(0, min(7, k))
                c = WATER[k]
                if h(seed, x // 2, y, "gl") % 13 == 0 and d > 0.35: c = WATER[min(9, k + 2)]
                rr = math.hypot(dx / 1.0, dy * 2.2)
                ring = (rr - frame * 2.0) % 6.0
                if 4 < rr < ia and ring < 1.0 and h(seed, x, y, "rp") % 3: c = WATER[8] if dx < 0 else WATER[7]
                if d < 0.18: c = WATER[1]
                # 뒤(북쪽) 테 안벽: 물 위로 보이는 얇은 돌 앞면 두 줄(위 = 그늘 돌, 아래 = 물에 젖은 짙은 돌) — 그 밑에 물 가장자리 짙은 선
                if dy < 0:
                    above = sum(1 for j in (1, 2, 3) if _ell(x, y - j, ia, ib) > 1.0)
                    if above:
                        su = max(-1.0, min(1.0, dx / ia))
                        if above >= 2: c = step_any(COOL[6] if h(seed, "iw", int((dx + 40) // 5)) % 3 else COOL[5], min(0, _cyl_shade(su)) - 1)
                        else: c = COOL[3] if abs(su) < 0.9 else WATER[1]
                        if above >= 2 and int(dx + 40) % 5 == 0: c = MORT
                        if above == 1: c = COOL[3] if (x + y) % 2 else WATER[0]
                cv.set(x, y, c)
    # 기둥 그림자(물 위, 오른쪽)
    for y in range(33, 47):
        for x in range(33, 38):
            if _ell(x, y, ia, ib) < 1.0 and cv.get(x, y) in WATER: cv.set(x, y, WATER[max(0, WATER.index(cv.get(x, y)) - 2)])
    # 가운데 기둥(원통): 물에서 아래 그릇까지
    def shaft(xa, xb, ya, yb, band=6, sag=1.6, foot=0.0):
        """원통 기둥: 돌 이음 띠가 앞쪽으로 처지는 호(3/4 원통) — 곧은 가로줄이 아니다. foot 이면 밑끝도 같은 호로 처진다."""
        for x in range(xa, xb + 1):
            u = (x + 0.5 - F_CX) / ((xb - xa + 1) / 2)
            sh = _cyl_shade(u)
            s_ = int(round(sag * (1 - min(1.0, u * u))))
            yend = yb + int(round(foot * (1 - min(1.0, u * u))))
            for y in range(ya, yend + 1):
                c = COOL[8] if (y - ya - s_) % band or y - s_ <= ya else MORT
                if (y - ya - s_) % band == 1 and y - s_ > ya: c = COOL[9]
                if x in (xa, xb): c = EDGE
                else: c = step_any(c, sh)
                cv.set(x, y, c)
    # 기둥 밑 받침: 물 위로 내민 둥근 턱 — 윗면 타원(빛) + 앞으로 처진 앞면 두 줄 + 물 닿는 짙은 호
    fa, fb, fy = 6.8, 2.7, 41.5
    for x in range(24, 40):
        dx = x + 0.5 - F_CX
        if abs(dx) > fa: continue
        u = dx / fa
        sh = _cyl_shade(u)
        dip = fb * math.sqrt(max(0.0, 1 - u * u))
        ytop = int(round(fy - dip))          # 윗면 타원 뒤 호
        ymid = int(round(fy + dip))          # 윗면 타원 앞 호(= 앞면 시작)
        for y in range(ytop, ymid + 3):
            if y < ymid: c = step_any(COOL[10] if y == ytop else COOL[9], sh)
            elif y == ymid: c = step_any(COOL[8], sh)
            else: c = step_any(COOL[6], sh)
            if abs(u) > 0.88: c = EDGE if y >= ymid else OUT2 if y == ytop else c
            cv.set(x, y, c)
        cv.set(x, ymid + 3, OUT2)
    shaft(28, 35, 26, 40, foot=1.6)
    def bowl(cy, a, b, depth, frame_off):
        """받침 그릇: 테 윗면 타원 고리 + 안 물 + 앞 테 앞면(depth 줄) + 밑으로 좁아지는 받침."""
        for y in range(int(cy - b) - 1, int(cy + b) + depth + 2):
            for x in range(int(F_CX - a) - 1, int(F_CX + a) + 2):
                dx = x + 0.5 - F_CX
                e = _ell(x, y, a, b, cy=cy)
                if e <= 1.0:
                    ei = _ell(x, y, a - 2, b - 1.2, cy=cy)
                    if ei > 1.0:
                        u = dx / a
                        c = step_any(COOL[9], _cyl_shade(u))
                        if y + 0.5 < cy: c = step_any(COOL[10], _cyl_shade(u))
                        if ei < 1.25: c = step_any(c, -1)
                        c = speck(c, "bowl", x, y, 5)
                        if e > 0.9 and y + 0.5 < cy: c = EDGE
                    else:
                        c = WATER[5] if y + 0.5 > cy else WATER[3]
                        if (x + y + frame_off) % 4 == 0: c = WATER[8]
                    cv.set(x, y, c)
                elif abs(dx) <= a:
                    u = dx / a
                    yb = cy + b * math.sqrt(max(0.0, 1 - u * u))
                    k = y + 0.5 - yb
                    if 0 < k <= depth:
                        c = step_any(COOL[8] if k > 1 else COOL[9], _cyl_shade(u))
                        if k > depth - 0.9: c = OUT2
                        if abs(dx) > a - 1: c = EDGE
                        cv.set(x, y, c)
    bowl(24.5, 11.5, 3.5, 3, frame)
    shaft(30, 33, 13, 22)
    bowl(13.5, 5.5, 2.2, 2, frame + 1)
    # 꼭지: 금빛 팔방 별(가는 줄기 위)
    # 꼭지: 기둥 축(x 31.5)에 맞춘 짝수 폭 금빛 팔방 별 + 2px 줄기(왼쪽 빛 · 오른쪽 그늘)
    for y in range(7, 12): cv.set(31, y, GOLD[2]); cv.set(32, y, GOLD[1])
    for xx in (31, 32): cv.set(xx, 1, GOLD[2]); cv.set(xx, 2, GOLD[3]); cv.set(xx, 3, GOLD[3]); cv.set(xx, 6, GOLD[3])
    for yy in (4, 5):
        for xx in (29, 30, 33, 34): cv.set(xx, yy, GOLD[3])
        cv.set(28, yy, GOLD[2]); cv.set(35, yy, GOLD[2])
    cv.set(31, 4, GOLD[5]); cv.set(32, 4, GOLD[4]); cv.set(31, 5, GOLD[4]); cv.set(32, 5, GOLD[3])
    for (xx, yy) in ((30, 3), (33, 3), (30, 6), (33, 6)): cv.set(xx, yy, GOLD[3])
    for (xx, yy) in ((29, 2), (34, 2), (29, 7), (34, 7)): cv.set(xx, yy, GOLD[2])
    # 넘쳐 떨어지는 물줄기: 아래 그릇 테에서 수반 물로, 위 그릇에서 아래 그릇으로
    for (sx, y0, y1) in ((19, 26, 41), (20, 26, 38), (43, 26, 41), (44, 26, 38), (25, 15, 23), (38, 15, 23)):
        for y in range(y0, y1):
            if (y + frame * 2 + sx) % 5 == 4: continue
            c = FOAM[1] if (y + frame) % 3 else WATER[9]
            if sx > 31 and (y + frame) % 2: c = WATER[8]
            cv.set(sx, y, c)
    # 물보라: 떨어진 자리 둘레 흰 점(frame 마다 다른 자리)
    for (sx, sy) in ((19, 41), (43, 41), (31, 46)):
        for i in range(5):
            ddx = (h(seed, "spr", sx, frame, i) % 7) - 3
            ddy = (h(seed, "spy", sx, frame, i) % 4) - 2
            cv.set(sx + ddx, sy + ddy, FOAM[1 + (i % 2)])
    return cv


# ================================================================ 질감 도우미
def speck(c, seed, x, y, rate=5):
    """돌·나무 결 점: rate 분의 1 은 한 단 어둡게, 드물게 한 단 밝게(램프 밖 색이면 그대로)."""
    v = h(seed, x, y, "spk")
    if v % rate == 0: return step_any(c, -1)
    if v % (rate * 4) == 1: return step_any(c, 1)
    return c


def slab(cv, x0, y0, x1, y1, tone, seed, moss=0, crack=False):
    """판돌 하나(성벽 3판의 stone 과 같은 명암) + 결 점."""
    stone(cv, x0, y0, x1, y1, tone, seed, crack=crack, moss=moss)
    for y in range(y0 + 1, y1):
        for x in range(x0 + 1, x1):
            c = cv.get(x, y)
            if c == tone: cv.set(x, y, speck(c, seed, x, y, 6))


# ================================================================ 포고 단 4×2 (64×32) — 바닥 층(불투명), 윗면·디딤돌 모두 걷는다
DAIS_TONES = [COOL[9], COOL[8], WARM[6], COOL[9], WARM[5], COOL[10]]


def dais():
    """포고 단(3판): 위에서 내려다본 넓은 판석 윗면(0~19, 밝다 — 테 돌 + 엇갈린 판석 + 가운데 파랑 돌 원에 금빛 팔방 별)
    · 빛 받는 앞 턱 한 줄(19) · 짙은 앞면 마름돌 한 켜(20~26, 윗면보다 세 단 어둡다) · 밑 그늘 줄(27) · 단이 드리운 그늘 진 바닥 판석(28~31).
    윗면이 그림의 대부분이라 벽이 아니라 올라설 수 있는 단으로 읽힌다(2판은 윗면이 14줄뿐이라 앞면 벽으로 읽혔다 — Opus VQA)."""
    cv = Canvas(64, 32)
    seed = "dais3"
    cv.rect(0, 0, 63, 31, MORT)
    TOP = [COOL[9], COOL[10], WARM[6], COOL[9], COOL[8], COOL[10]]
    # 윗면: 버들항 광장 우물터처럼 크기가 제각각인 자연 판석(엇갈린 덩이 · 부드러운 갈색 줄눈) — 곧은 벽돌 켜가 아니다.
    # 씨앗을 흔든 격자에 뿌리고 가장 가까운 씨앗으로 칸을 나눈다(세로는 3/4 로 눌려 1.6 배로 잰다).
    FLAGT = [COOL[9], COOL[10], WARM[6], COOL[8], WARM[5], COOL[9], COOL[7]]
    seeds = []
    for gy, yc in enumerate((3.0, 9.5, 15.5)):
        x = -3 + (h(seed, "gx", gy) % 5); i = 0
        while x < 70:
            w = 9 + h(seed, "fw", gy, i) % 6
            seeds.append((x + w / 2 + (h(seed, "jx", gy, i) % 3) - 1, yc + (h(seed, "jy", gy, i) % 3) - 1,
                          FLAGT[h(seed, "ft", gy, i) % len(FLAGT)]))
            x += w; i += 1
    sid = {}
    for y in range(1, 19):
        for x in range(1, 63):
            ds = sorted(((sx - x - 0.5) ** 2 + (1.6 * (sy - y - 0.5)) ** 2, k) for k, (sx, sy, _t) in enumerate(seeds))
            sid[(x, y)] = ds[0][1]
    JOINT = FLAG[4]
    for y in range(1, 19):
        for x in range(1, 63):
            k = sid[(x, y)]
            tone = seeds[k][2]
            right = sid.get((x + 1, y), k); down = sid.get((x, y + 1), k)
            left = sid.get((x - 1, y), k); up = sid.get((x, y - 1), k)
            if right != k or down != k: c = JOINT                     # 줄눈 1px(오른쪽·아래)
            elif left != k or up != k: c = step_any(tone, 1)          # 판석 왼쪽 위 머리 빛
            elif sid.get((x + 1, y + 1), k) != k or sid.get((x + 2, y), k) != k: c = step_any(tone, -1)   # 오른쪽 아래 그늘
            else: c = speck(tone, seed, x, y, 9)
            if x > 50 and c != JOINT: c = step_any(c, -1)                # 오른쪽 끝은 빛에서 멀다
            cv.set(x, y, c)
    # 뒤 가장자리(바닥에서 솟은 선) · 양 옆 윤곽
    for x in range(64): cv.set(x, 0, EDGE if x % 11 else OUT2)
    for y in range(0, 20): cv.set(0, y, EDGE); cv.set(63, y, OUT2)
    # 가운데: 짙은 파랑 돌 원(금 테) + 금 팔방 별
    for y in range(3, 18):
        for x in range(17, 47):
            e = _ell(x, y, 13.5, 6.6, cx=31.5, cy=10.0)
            if e <= 1.0:
                c = ROYAL[2] if x < 27 else ROYAL[1] if x < 38 else ROYAL[0]
                if y <= 6 and x < 33: c = ROYAL[3]
                if e > 0.70: c = GOLD[3] if y < 9 and x < 33 else GOLD[2] if x < 40 else GOLD[1]
                if e > 0.92: c = GOLD[1]
                cv.set(x, y, speck(c, seed, x, y, 7) if c in ROYAL else c)
    star8(cv, 31, 10, big=True)
    # 윗면 줄눈은 옅게(바닥 판석 — 벽돌 켜처럼 보이지 않게)
    for y in range(1, 19):
        for x in range(1, 63):
            if cv.get(x, y) in (MORT, MORT2): cv.set(x, y, COOL[7])
    # 앞 턱: 빛 받는 한 줄
    for x in range(1, 63): cv.set(x, 19, step_any(cv.get(x, 19), 1) if cv.get(x, 19) != MORT else COOL[10])
    # 앞면: 짙은 마름돌 한 켜(20~26) — 맨 윗줄은 턱 밑 그늘
    FRONT = [COOL[5], COOL[4], COOL[5], COOL[6], WARM[4]]
    x = -4; i = 0
    while x < 64:
        w = 9 + h(seed, "rw", i) % 5
        slab(cv, max(0, x), 20, min(63, x + w - 1), 26, FRONT[h(seed, "rt", i) % 5], (seed, "r", i), moss=1 if i % 3 == 1 else 0)
        x += w + 1; i += 1
    for x in range(64):
        cv.set(x, 20, step_any(cv.get(x, 20), -2) if cv.get(x, 20) != MORT else OUT2)
        cv.set(x, 27, OUT if x % 6 else OUT2)
    # 단 밑 디딤 턱(28~31): 이어진 낮은 디딤돌 한 단 — 윗면(위에서 본다, 단 그늘로 위가 어둡다) + 짙은 앞 끝선. 반쪽 벽돌 없이 끝난다.
    joints = [0]
    while joints[-1] < 63: joints.append(joints[-1] + 18 + h(seed, "tj", len(joints)) % 7)
    for x in range(64):
        for yy, c in ((28, COOL[4]), (29, COOL[6]), (30, COOL[7]), (31, COOL[3])):
            if yy < 31 and x in joints[1:]: c = MORT2 if yy > 28 else COOL[3]
            elif yy in (29, 30): c = speck(c, seed, x, yy, 7)
            cv.set(x, yy, c)
    for yy in range(28, 32): cv.set(0, yy, OUT2 if yy < 31 else OUT); cv.set(63, yy, OUT)
    for y in range(20, 27):
        cv.set(0, y, OUT2); cv.set(63, y, OUT)
        for x in (61, 62):
            if cv.get(x, y) not in (MORT, OUT, OUT2, EDGE): cv.set(x, y, step_any(cv.get(x, y), -1))
    return cv


# ================================================================ 왕실 깃발 · 방패
def _royal_cloth(cv, x, y, w, hgt, tail=True, seed="cloth", shadow=True):
    """파란 천: 세로 주름(밝은 둥 · 짙은 골이 번갈아 다섯 단) · 금 테(세 단) · 금 왕관 · 그 밑 금 팔방 별 · 제비꼬리 · 밑 금술."""
    fold = [1, 0, -1, -1, 0, 1, 1, 0, -1, -2, -1, 0]
    for yy in range(hgt):
        for i in range(w):
            if tail and yy >= hgt - 4:
                mid = w // 2
                if abs(i - mid + 0.5) < (yy - (hgt - 4)) + 1: continue
            if i in (0, w - 1) or yy == 0:
                c = GOLD[4] if (i == 0 and yy < hgt // 2) else GOLD[3] if i < w // 2 else GOLD[2] if yy < hgt - 3 else GOLD[1]
                if yy == 0: c = GOLD[4] if i < w // 2 else GOLD[2]
            else:
                k = 2 + fold[(i + (yy // 9)) % len(fold)]
                if i == 1: k += 1
                if i >= w - 2: k -= 1
                if yy > hgt - 7: k -= 1
                k = max(0, min(len(ROYAL) - 1, k))
                c = ROYAL[k]
                if h(seed, i, yy) % 9 == 0: c = ramp_step(ROYAL, c, -1)
            if yy == hgt - 1 and c in ROYAL: c = GOLD[2]
            cv.set(x + i, y + yy, c)
        if shadow and not (tail and yy >= hgt - 4): cv.set(x + w, y + yy, SH2)   # 벽에 걸 때만 벽에 지는 그늘(허공 깃대엔 없다)
    crown(cv, x + w // 2 - 2, y + 3, small=True)
    star8(cv, x + w // 2 - (0 if w % 2 else 1), y + 10)


def stone_foot(cv, x0, x1, y0, top=4, face=5, seed="foot"):
    """네모 돌 굽: 윗면 top 줄(위에서 본 판돌 둘, 앞 턱 빛) + 앞면 face 줄(엇갈린 마름돌 두 켜, 오른쪽 그늘) + 땅 그림자."""
    for x in range(x0 + 2, x1 + 3):
        for y in (y0 + top + face, y0 + top + face + 1): cv.set(x, y, SH2 if y == y0 + top + face else SH3)
    mid = (x0 + x1) // 2 + 1
    slab(cv, x0, y0, mid - 1, y0 + top - 1, COOL[10], (seed, "t0"))
    slab(cv, mid + 1, y0, x1, y0 + top - 1, COOL[9], (seed, "t1"))
    cv.rect(mid, y0, mid, y0 + top - 1, MORT)
    for x in range(x0, x1 + 1):
        cv.set(x, y0, EDGE if x in (x0, x1) else COOL[11] if x < x1 - 2 else COOL[9])
        cv.set(x, y0 + top - 1, COOL[11] if x < mid else COOL[10])                  # 앞 턱 빛
    fy = y0 + top
    h1 = (face - 1) // 2
    j1 = x0 + 3 + h(seed, "j1") % 3
    slab(cv, x0, fy, j1 - 1, fy + h1 - 1, COOL[7], (seed, "f0"))
    slab(cv, j1 + 1, fy, x1, fy + h1 - 1, COOL[8], (seed, "f1"))
    cv.rect(j1, fy, j1, fy + h1 - 1, MORT)
    j2 = x1 - 3 - h(seed, "j2") % 3
    slab(cv, x0, fy + h1 + 1, j2 - 1, fy + face - 2, COOL[7], (seed, "f2"), moss=1)
    slab(cv, j2 + 1, fy + h1 + 1, x1, fy + face - 2, COOL[6], (seed, "f3"))
    cv.rect(j2, fy + h1 + 1, j2, fy + face - 2, MORT)
    for x in range(x0, x1 + 1):
        cv.set(x, fy + h1, MORT); cv.set(x, fy + face - 1, OUT2)
    for y in range(fy, fy + face - 1):
        for x in (x1 - 1, x1 - 2):
            if cv.get(x, y) not in (MORT, OUT2): cv.set(x, y, step_any(cv.get(x, y), -1))
        cv.set(x0, y, EDGE); cv.set(x1, y, OUT2)
    for y in range(y0, y0 + top): cv.set(x0, y, EDGE); cv.set(x1, y, COOL[6] if y > y0 else EDGE)


def banner_pole():
    """왕실 깃대 1×3(16×48): 금빛 창끝 꼭지 · 가로대 · 파란 깃발(금 테 · 왕관 · 별 · 제비꼬리) · 나무 장대(쇠띠) · 네모 돌 굽."""
    cv = Canvas(16, 48)
    fy0 = 35                     # 굽 윗면 첫 줄 — 밑 그림자 두 줄이 칸 안(46·47)에 들어간다
    x0, x1, top, face = 2, 13, 5, 6
    stone_foot(cv, x0, x1, fy0, top=top, face=face, seed="bpf")
    # 굽 윗면 뒤 테: 한 줄 전체를 짙은 윤곽으로 이어(모서리에만 튀어나온 검은 점이 없다), 그 밑 줄이 빛 받는 뒤 턱
    for x in range(x0, x1 + 1):
        cv.set(x, fy0, EDGE if x < x1 - 1 else OUT2)
        if x0 < x < x1: cv.set(x, fy0 + 1, COOL[11] if x < x1 - 2 else COOL[9])
    # 땅 그림자(빛 왼쪽 위): 오른쪽 옆 한 열 + 밑 두 줄, 칸 안에서 끝까지 이어진다
    for y in range(fy0 + 2, fy0 + top + face):
        cv.set(x1 + 1, y, SH2)
    for x in range(x0 + 2, x1 + 2):
        cv.set(x, fy0 + top + face, SH2)
        if x > x0 + 2: cv.set(x, fy0 + top + face + 1, SH3)
    cv.set(x1 + 1, fy0 + top + face, SH3)
    for y in range(3, fy0 + 2):
        g = h("pole", y) % 4
        cv.set(7, y, (WOOD[5], WOOD[6], WOOD[5], WOOD[4])[g] if y % 7 else GOLD[3]); cv.set(8, y, (WOOD[3], WOOD[4], WOOD[3], WOOD[2])[g] if y % 7 else GOLD[1])
    # 장대 밑 쇠 고리(굽 윗면에 박힌다) + 장대가 굽 윗면에 드리운 그늘(돌을 어둡게 — 반투명으로 칠하면 구멍이 된다)
    for x in (6, 9): cv.set(x, fy0 + 1, IRON[2] if x == 6 else IRON[1]); cv.set(x, fy0 + 2, IRON[1] if x == 6 else WOOD[1])
    for x in (7, 8): cv.set(x, fy0 + 2, WOOD[2] if x == 7 else WOOD[1])
    for x in range(9, 12):
        c = cv.get(x, fy0 + 3)
        if c[3] == 255: cv.set(x, fy0 + 3, step_any(c, -2))
    cv.set(7, 0, GOLD[5]); cv.set(7, 1, GOLD[4]); cv.set(8, 1, GOLD[2]); cv.set(6, 2, GOLD[3]); cv.set(7, 2, GOLD[4]); cv.set(8, 2, GOLD[2]); cv.set(9, 2, GOLD[1])
    for x in range(2, 14): cv.set(x, 4, WOOD[5] if x < 8 else WOOD[4] if x < 12 else WOOD[3]); cv.set(x, 5, WOOD[2])
    cv.set(1, 4, GOLD[4]); cv.set(14, 4, GOLD[2]); cv.set(1, 5, GOLD[2]); cv.set(14, 5, GOLD[1])
    _royal_cloth(cv, 3, 6, 10, 24, shadow=False)
    return cv


def banner_wall():
    """벽걸이 왕실 깃발 1×2(16×32): 쇠 막대 + 파란 깃발 + 벽에 진 그림자(투명 바탕)."""
    cv = Canvas(16, 32)
    for x in range(1, 15): cv.set(x, 1, IRON[2] if x < 12 else IRON[1]); cv.set(x, 2, IRON[0] if x % 3 == 0 else CLEAR)
    cv.set(1, 0, IRON[1]); cv.set(14, 0, IRON[1]); cv.set(0, 1, GOLD[4]); cv.set(15, 1, GOLD[2])
    _royal_cloth(cv, 3, 2, 10, 27)
    return cv


# ================================================================ 왕실 가로등
def lantern_small(cv, cx, y):
    """작은 팔각 등롱(9×16, 홑 가로등용 — 버들항 가로등 등 크기에 맞춤): 파랑 뿔 지붕 세 줄 · 금 처마 테 · 쇠살 유리 다섯 줄 · 받침판 · 깔때기."""
    cv.set(cx, y, GOLD[5]); cv.set(cx, y + 1, GOLD[3])
    for j in range(3):
        half = 1 + j
        for x in range(cx - half, cx + half + 1):
            if x == cx: c = GOLD[3] if j < 2 else GOLD[2]
            elif x < cx: c = ROYAL[4] if x == cx - 1 and j > 0 else ROYAL[3]
            else: c = ROYAL[1] if x > cx + 1 else ROYAL[2]
            if x in (cx - half, cx + half): c = ROYAL[0] if x > cx else ROYAL[2]
            cv.set(x, y + 2 + j, c)
    for x in range(cx - 4, cx + 5):
        cv.set(x, y + 5, GOLD[4] if x < cx else GOLD[3] if x < cx + 3 else GOLD[2])
        cv.set(x, y + 6, GOLD[2] if x < cx + 2 else GOLD[1])
    for yy in range(y + 7, y + 12):
        for x in range(cx - 3, cx + 4):
            if x in (cx - 3, cx + 3): c = IRON[2] if x < cx else ROYAL[0]
            elif x == cx: c = IRON[1] if (yy - y) % 3 else ROYAL[1]
            elif x < cx: c = GLASS[2] if (x == cx - 1 and y + 8 <= yy <= y + 9) else GLASS[1] if x == cx - 1 else GLASS[0]
            else: c = GLASS[1] if x == cx + 1 and yy < y + 10 else GLASS[0]
            cv.set(x, yy, c)
    for x in range(cx - 4, cx + 5):
        cv.set(x, y + 12, IRON[2] if x < cx + 2 else IRON[1]); cv.set(x, y + 13, ROYAL[0] if x % 2 else IRON[1])
    cv.set(cx - 1, y + 14, IRON[2]); cv.set(cx, y + 14, IRON[1]); cv.set(cx + 1, y + 14, IRON[0]); cv.set(cx, y + 15, GOLD[2])


def lantern(cv, cx, y, seed="ln", glow=True):
    """팔각 등롱(11×17): 위에서 본 파랑 뿔 지붕(왼쪽 빛 · 오른쪽 그늘 · 금 마룻대) + 금 꼭지 · 금 처마 테(윗면 한 줄 + 앞 한 줄) ·
    쇠살 유리 세 쪽(따뜻한 불빛, 가운데 밝다) · 밑 받침판(윗면이 보인다) · 깔때기 · 불빛 점."""
    cv.set(cx, y, GOLD[5]); cv.set(cx, y + 1, GOLD[3])
    for j in range(4):           # 뿔 지붕: 위로 좁아지는 네 줄
        half = 1 + j
        for x in range(cx - half, cx + half + 1):
            if x == cx: c = GOLD[3] if j < 3 else GOLD[2]
            elif x < cx: c = ROYAL[4] if x == cx - 1 and j > 0 else ROYAL[3]
            else: c = ROYAL[1] if x > cx + 1 else ROYAL[2]
            if x in (cx - half, cx + half): c = ROYAL[0] if x > cx else ROYAL[2]
            cv.set(x, y + 2 + j, c)
    for x in range(cx - 5, cx + 6):
        cv.set(x, y + 6, GOLD[4] if x < cx else GOLD[3] if x < cx + 4 else GOLD[2])
        cv.set(x, y + 7, GOLD[2] if x < cx + 3 else GOLD[1])
    for yy in range(y + 8, y + 14):
        for x in range(cx - 4, cx + 5):
            if x in (cx - 4, cx + 4): c = IRON[2] if x < cx else ROYAL[0]
            elif x == cx: c = IRON[1] if (yy - y) % 3 else ROYAL[1]
            elif x < cx: c = GOLD[5] if (x == cx - 2 and yy == y + 10) else GLASS[2] if (x == cx - 2 and y + 9 <= yy <= y + 11) else GLASS[1] if x > cx - 3 else GLASS[0]
            else: c = GLASS[1] if x == cx + 1 and yy < y + 11 else GLASS[0]
            cv.set(x, yy, c)
    for x in range(cx - 5, cx + 6):            # 받침판 윗면(밝게) + 앞(짙게)
        cv.set(x, y + 14, IRON[2] if x < cx + 3 else IRON[1]); cv.set(x, y + 15, ROYAL[0] if x % 2 else IRON[1])
    cv.set(cx - 2, y + 16, IRON[2]); cv.set(cx - 1, y + 16, IRON[1]); cv.set(cx, y + 16, IRON[1]); cv.set(cx + 1, y + 16, IRON[0]); cv.set(cx, y + 17, GOLD[2])
    for (dx, dy) in (((-6, 9), (6, 11), (-6, 12), (5, 8)) if glow else ()):
        if not cv.get(cx + dx, y + dy)[3]: cv.set(cx + dx, y + dy, GLASS[0] if dy % 2 else CLEAR)


def _iron_post(cv, x, y0, y1):
    for y in range(y0, y1 + 1):
        band = (y - y0) % 9
        if band in (0, 1):
            cv.set(x - 1, y, GOLD[5] if band == 0 else GOLD[3]); cv.set(x, y, GOLD[3] if band == 0 else GOLD[2]); cv.set(x + 1, y, GOLD[1])
        else:
            cv.set(x - 1, y, COOL[5] if band == 2 else IRON[2]); cv.set(x, y, IRON[2] if band % 3 == 0 else IRON[1]); cv.set(x + 1, y, ROYAL[0] if band % 2 else IRON[1])
    for y in (y1 - 2, y1 - 1, y1):
        cv.set(x - 2, y, IRON[2]); cv.set(x + 2, y, IRON[0])


def lamp():
    """왕실 가로등 1×3: 네모 돌 받침(윗면이 보인다, 파랑 판) · 금띠 두른 쇠기둥 · 말린 쇠 받침대 · 파랑 뿔 지붕 팔각 등롱."""
    cv = Canvas(16, 48)
    stone_foot(cv, 2, 13, 36, top=4, face=6, seed="lpf")
    # 받침 윗면 뒤 테를 한 줄로 닫는다(모서리 두 점만 짙어 「뿔」처럼 튀던 것), 그 밑 줄이 빛 받는 뒤 턱
    for x in range(2, 14):
        cv.set(x, 36, EDGE if x < 12 else OUT2)
        if 2 < x < 13: cv.set(x, 37, COOL[11] if x < 11 else COOL[9])
    for yy in range(42, 45): cv.set(7, yy, ROYAL[2]); cv.set(8, yy, ROYAL[1])
    cv.set(7, 43, GOLD[3])
    _iron_post(cv, 7, 18, 37)
    lantern_small(cv, 7, 2)
    return cv


def lamp_double():
    """왕실 쌍등 2×3: 네모 돌 받침 · 금띠 쇠기둥 위 금 팔방 별 · 말린 가로팔 양끝에 매단 등롱 둘."""
    cv = Canvas(32, 48)
    stone_foot(cv, 9, 22, 35, top=5, face=6, seed="lpf2")
    for yy in range(42, 45): cv.set(15, yy, ROYAL[2]); cv.set(16, yy, ROYAL[1])
    cv.set(15, 43, GOLD[3])
    _iron_post(cv, 15, 8, 37)
    star8(cv, 15, 4)
    for x in range(4, 28):
        cv.set(x, 8, COOL[5] if x < 16 else IRON[2]); cv.set(x, 9, IRON[2] if x < 16 else IRON[1]); cv.set(x, 10, ROYAL[0])
    for x in (3, 28): cv.set(x, 8, GOLD[4] if x == 3 else GOLD[2]); cv.set(x, 9, GOLD[2] if x == 3 else GOLD[1])
    for (dx, dy) in ((-3, 11), (-4, 12), (-5, 12), (-6, 11), (3, 11), (4, 12), (5, 12), (6, 11)):
        cv.set(15 + dx + (1 if dx > 0 else 0), dy, IRON[1])
    for cx in (5, 26):
        cv.set(cx, 11, IRON[1]); cv.set(cx, 8, GOLD[3])
        lantern_small(cv, cx, 12)                      # 홑 가로등과 같은 등롱(뿔 지붕 윗면 · 처마 테 윗면이 보인다)
    # 받침 윗면 뒤 테를 한 줄로 닫고 그 밑 줄을 빛 받는 뒤 턱으로(홑 가로등과 같은 처리 — 윗면이 면으로 읽힌다)
    for x in range(9, 23):
        cv.set(x, 35, EDGE if x < 21 else OUT2)
        if 9 < x < 22: cv.set(x, 36, COOL[11] if x < 20 else COOL[9])
    # 가로팔 밑 작은 왕실 기(기둥 양옆)
    for bx in (10, 19):
        for yy in range(11, 20):
            for i in range(4):
                if yy >= 18 and i in (1, 2): continue
                c = ROYAL[3] if i == 0 else ROYAL[2] if i < 3 else ROYAL[1]
                if yy == 11: c = GOLD[3] if i < 2 else GOLD[2]
                if yy in (14, 15) and i in (1, 2): c = GOLD[4] if yy == 14 else GOLD[2]
                cv.set(bx + i, yy, c)
    return cv


def shield_plaque():
    """벽걸이 아스텔 방패 1×1(투명 바탕)."""
    cv = Canvas(16, 16)
    royal_shield(cv, 7, 1)
    return cv


# ================================================================ 선착 계단 1×3(16×48) — 바닥 층(불투명), 운하 둑 쪽 열에 놓는다
# 선착 계단 돌(버들항 시트 앞 칸의 따뜻한 사암 램프 열 단: 짙은 윤곽 → 빛 받은 디딤판)
QSTONE = [hx(c) for c in ("#45382a", "#574234", "#635342", "#76634f", "#887664", "#9b8a73", "#aca089", "#c2bca7", "#d2c6b0", "#e2d6c0")]


def _qs(i):
    return QSTONE[max(0, min(len(QSTONE) - 1, i))]


def quay_steps(side="W"):
    """둑에서 운하 물로 남쪽으로 내려가는 돌계단: 둑 높이 디딤판 · 네 단(아래로 갈수록 짙고 젖는다) · 마지막 단은 물에 잠긴다.
    돌은 따뜻한 사암 램프(윤곽·이음도 따뜻한 짙은 갈색), 둑 테만 운하 오토타일 테와 같은 열 색.
    side W = 서쪽 둑(둑 돌 테가 서쪽), E = 동쪽 둑(테가 동쪽). 빛은 늘 왼쪽 위."""
    cv = Canvas(16, 48)
    seed = ("quay2", side)
    cheek = range(0, 3) if side == "W" else range(13, 16)
    x0, x1 = (3, 15) if side == "W" else (0, 12)          # 계단 몸 열(테 제외)
    steps = [(14, 4, 3), (21, 4, 3), (28, 4, 3), (35, 3, 3)]
    for y in range(48):
        for x in range(16):
            if x in cheek:
                kerb = KERB_W if side == "W" else KERB_E
                c = kerb[x - cheek[0]]
                if y < 13 and c == COOL[2]: c = COOL[6]
                if c != COOL[2]: c = speck(c, seed, x, y, 5)
                cv.set(x, y, c)
                continue
            u = (x - x0) / max(1, x1 - x0)                     # 0 = 왼쪽(빛 쪽) → 1 = 오른쪽
            c = None
            if y < 13:
                # 둑 높이 디딤판: 엇갈린 판석 두 줄, 판마다 톤 · 왼쪽 위 밝은 테 · 오른쪽 아래 그늘 · 따뜻한 이음
                row = 0 if y < 6 else 1
                off = 0 if row == 0 else 4
                k = (x - x0 + off) // 6
                lx = (x - x0 + off) % 6
                ly = y if row == 0 else y - 6
                hgt = 6 if row == 0 else 7
                base = 7 + (h(seed, k, row, "sl") % 3)          # 7..9
                if lx == 5 or ly == hgt - 1: c = _qs(3 if (lx == 5 and ly == hgt - 1) else 4)
                else:
                    t = base
                    if ly == 0 or lx == 0: t += 1
                    if ly == hgt - 2 or lx == 4: t -= 1
                    g = h(seed, x, y, "g") % 6
                    if g == 0: t -= 1
                    elif g == 1 and lx and ly: t -= 2 if h(seed, k, row, "cr") % 2 else 1   # 금·패인 점
                    elif g == 2 and lx < 4: t += 1
                    if lx == 0 and ly == 0: t = 9
                    c = _qs(min(9, t))
                if y == 0: c = _qs(9) if c != _qs(4) else _qs(5)
            elif y == 13:
                c = _qs(9) if (x + h(seed, x, "lip")) % 4 else _qs(8)   # 디딤판 앞 모서리(빛)
            else:
                for i, (sy, tr, rs) in enumerate(steps):
                    if sy <= y < sy + tr:
                        # 디딤판: 이음 자리가 단마다 다르다 · 아래 단일수록 한 단 짙다
                        j = x0 + (6 if i % 2 == 0 else 4)
                        j2 = j + 6
                        base = 8 - i
                        t = base + (0 if x < j else -1 if x < j2 else 0)
                        ly = y - sy
                        if ly == 0: t += 1                                  # 앞 모서리 빛(위쪽)
                        elif ly == tr - 1: t -= 1                            # 다음 챌판 위 그늘
                        t -= round(u * 1.4)                                  # 오른쪽으로 갈수록 그늘
                        g = h(seed, x, y, "g") % 7                           # 돌 결: 점마다 한 단 오르내림
                        if g in (0, 1): t -= 1
                        elif g == 2 and ly > 0: t += 1
                        bx = x - (x0 if x < j else j if x < j2 else j2)       # 디딤돌 안 위치
                        if bx == 1 and ly == 1: t += 1                       # 돌마다 왼쪽 위 빛 점
                        if h(seed, x // 3, i, "pit") % 4 == 0 and ly == 2 and h(seed, x, "pit2") % 2: t -= 2   # 패인 자국
                        c = _qs(t)
                        if x in (j, j2) and ly < tr - 1: c = _qs(max(1, base - 4))
                        if i >= 1 and h(seed, x, y, "ms") % (11 - 2 * i) == 0: c = MOSS[1 + h(seed, x, "mc") % 3]
                        if i == 3 and ly == tr - 1: c = WATER[7] if x % 2 else WATER[8]      # 젖은 끝 단
                        break
                    if sy + tr <= y < sy + tr + rs:
                        # 챌판(남쪽 앞면): 위 줄 밝은 턱 → 가운데 → 맨 아래 따뜻한 짙은 윤곽
                        ry = y - (sy + tr)
                        t = [5, 3, 0][ry] - i // 2
                        if ry < 2:
                            t -= round(u * 1.2)
                            if (x + 3 * i) % 5 == 0: t = max(0, t - 2)              # 세로 이음
                            elif h(seed, x, y, "rg") % 3 == 0: t -= 1
                            elif h(seed, x, y, "rg") % 5 == 1: t += 1
                        c = _qs(t)
                        if i >= 2 and ry == 1 and h(seed, x, "drip") % 3 == 0: c = WATER[5]   # 젖은 자국
                        break
            if y >= 38:
                # 물: 잠긴 마지막 단이 비치는 밝은 청록 → 깊어지며 짙게, 물결 무늬는 사선으로
                d = (y - 38) / 9.0
                w = 7 - int(d * 6.5)
                rip = (x + 2 * y + h(seed, x // 3, y // 2, "rp") % 3) % 7
                if rip == 0: w += 1
                elif rip == 4: w -= 1
                if 40 <= y <= 43 and x0 <= x <= x1 and h(seed, x, y, "sub") % 3: w = max(w, 6) - (1 if (x + y) % 2 else 0)   # 물 밑 단
                if h(seed, x, y, "gl") % 13 == 0: w = 8
                c = WATER[max(1, min(8, w))]
                if y == 38: c = FOAM[1] if (x + h(seed, x, "fm")) % 3 else FOAM[0]
                elif y == 39: c = FOAM[0] if h(seed, x, "fm2") % 3 == 0 else WATER[5] if x % 2 else WATER[4]
            if side == "W" and x in (3, 4) and 13 < y < 38:
                c = _qs(QSTONE.index(c) - (2 if x == 3 else 1)) if c in QSTONE else c   # 서쪽 테 그늘
            if side == "E" and x == 12 and 13 < y < 38:
                c = _qs(QSTONE.index(c) - 1) if c in QSTONE else c                      # 동쪽 테 맞닿은 이음
            cv.set(x, y, c)
    return cv


# ================================================================ 운하 갑문 6×2
def _water_px(seed, x, y, base, spread=1):
    """물 한 점: base 단 둘레로 흩뜨린 결(가로로 긴 물결 빛 · 짙은 골)."""
    v = h(seed, x // 3, y, "wv")
    k = base + (1 if v % 7 == 0 else -1 if v % 5 == 0 else 0) * spread
    if h(seed, x, y, "sp") % 17 == 0: k += 2
    return WATER[max(0, min(9, k))]


def canal_lock():
    """갑문 64×32: 위쪽 물(높다) · 쇠 난간 · 널 다리 윗면(동서로 걷는다 — 널마다 왼쪽 빛·오른쪽 그늘·결) ·
    두 짝 나무 갑문 앞면(굵은 가로 들보 · 쇠띠와 못 · 가운데 맞물림 · 수문 구멍에서 새는 물) · 아래쪽 거품 물."""
    cv = Canvas(64, 32)
    seed = "lock2"
    PL = (WOOD[6], WOOD[5], WOOD[5], WOOD[4], WOOD[3])      # 널 한 장: 빛 · 몸 · 몸 · 그늘 · 짙은 끝
    for y in range(32):
        for x in range(64):
            if x <= 2 or x >= 61:
                cv.set(x, y, KERB_W[x] if x <= 2 else KERB_E[x - 61]); continue
            if y <= 2:
                c = _water_px(seed, x, y, (4, 3, 2)[y])
            elif y <= 4:
                c = IRON[2] if y == 3 else WOOD[1]                       # 북쪽 난간 막대(위 빛 · 밑 그늘)
            elif y <= 17:
                # 널 다리 윗면: 동서로 긴 널(두 줄 몸 + 한 줄 틈), 이음은 줄마다 엇갈린다 — 위에서 본 바닥(밝다)
                r = (y - 5) // 3
                k = (y - 5) % 3
                joint = (x + r * 13) % 21 == 0
                if k == 2 or joint: c = DECK[1] if k == 2 else DECK[2]
                else:
                    c = DECK[5] if k == 0 else DECK[4]
                    if (r + h(seed, (x + r * 13) // 21, r)) % 3 == 0: c = DECK[4] if k == 0 else DECK[3]     # 널마다 다른 색
                    g = h(seed, x // 3, y, "gr") % 7
                    if g == 0: c = DECK[max(2, DECK.index(c) - 1)]
                    elif g == 1 and k == 0: c = DECK[6]
                    if (x + r * 13) % 21 in (1, 2) and k == 0: c = DECK[6]
                    if (x + r * 13) % 21 == 20: c = DECK[3]
                if y == 5: c = DECK[2]                                             # 난간 밑 그늘
                if x > 52 and c in DECK: c = DECK[max(1, DECK.index(c) - 1)]
                if (x - 5) % 9 in (1, 2) and y in (6, 7): c = DECK[3] if c in DECK[4:] else c        # 난간 기둥 그림자
            elif y == 18:
                c = DECK[2] if x % 9 else DECK[1]                                   # 널 다리 앞 끝(그늘선)
            elif y <= 24:
                k = (y - 19) % 3
                c = (DECK[4], DECK[3], DECK[1])[k]
                if k == 0 and h(seed, x // 4, y, "hl") % 3 == 0: c = DECK[5]
                if k == 1 and h(seed, x // 3, y, "bg") % 4 == 0: c = DECK[2]
                if (x - 3) % 10 in (5, 6):
                    c = IRON[2] if (x - 3) % 10 == 5 else IRON[1]
                    if k == 0 and (x - 3) % 10 == 5: c = COOL[8]
                if x in (31, 32): c = WOOD[1] if x == 32 else WOOD[2]
                if x > 50 and c in DECK: c = DECK[max(0, DECK.index(c) - 1)]
            else:
                c = FOAM[1] if y == 25 else _water_px(seed, x, y, (6, 6, 5, 5, 4, 4)[min(5, y - 26)])
                if y > 25 and h(seed, x, y, "fo") % 5 == 0: c = FOAM[h(seed, x, "f") % 2]
            cv.set(x, y, c)
    # 난간 기둥(빛 · 그늘 두 열 + 금빛 머리)
    for x in range(5, 60, 9):
        cv.set(x, 1, GOLD[3]); cv.set(x + 1, 1, GOLD[1])
        for y in (2, 3, 4, 5): cv.set(x, y, IRON[2]); cv.set(x + 1, y, WOOD[1])
        cv.set(x + 2, 5, WOOD[2]); cv.set(x + 2, 6, WOOD[3])
    # 수문 구멍 두 곳: 쇠 판(빛 · 그늘) + 새어 나오는 물줄기 + 물보라
    for sx in (15, 47):
        for y in range(19, 22):
            for x in range(sx - 2, sx + 3):
                cv.set(x, y, COOL[6] if y == 19 else IRON[1] if y == 20 else WOOD[1])
        cv.set(sx - 2, 19, COOL[8])
        for y in range(22, 27):
            cv.set(sx, y, FOAM[2] if y % 2 else FOAM[1]); cv.set(sx - 1, y, WATER[9] if y > 23 else WATER[8]); cv.set(sx + 1, y, WATER[7])
        for x in range(sx - 3, sx + 4): cv.set(x, 27, FOAM[2] if (x + sx) % 2 else FOAM[1])
        for x in range(sx - 4, sx + 5, 2): cv.set(x, 28, FOAM[1])
    return cv


def capstan():
    """갑문 물레(둑 칸, 투명 바탕): 위에서 본 둥근 나무 머리(바큇살 구멍) + 쇠테 + 몸통 + 비스듬히 꽂힌 손잡이 막대 + 땅 그림자."""
    cv = Canvas(16, 16)
    for x in range(5, 15):
        for y in (13, 14): cv.set(x, y, SH2)
    for y in range(3, 14):
        for x in range(3, 13):
            dx = x + 0.5 - 8
            u = dx / 5
            if abs(dx) > 5: continue
            top = _ell(x, y, 5, 2.5, cx=8, cy=5.5)
            if top <= 1.0:
                c = WOOD[6] if dx < -1 else WOOD[5] if dx < 2 else WOOD[4]
                if top > 0.7: c = IRON[2] if dx < 0 else IRON[1]
                if (x, y) in ((8, 5), (7, 5)): c = WOOD[1]
            elif y > 5:
                ybot = 5.5 + 2.5 * math.sqrt(max(0.0, 1 - u * u))
                if y + 0.5 < ybot: continue
                if y > 12: continue
                c = WOOD[4] if dx < -1 else WOOD[3] if dx < 2 else WOOD[2]
                if y in (8, 11): c = IRON[1]
                if abs(dx) > 4.2: c = WOOD[1]
                if y == 12: c = WOOD[0]
            else: continue
            cv.set(x, y, c)
    for i in range(6):
        cv.set(9 + i, 4 - i // 2, WOOD[5] if i < 5 else WOOD[3]); cv.set(9 + i, 5 - i // 2, WOOD[2])
    for i in range(4):
        cv.set(2 - i // 2, 6 + i, WOOD[4]); cv.set(3 - i // 2, 6 + i, WOOD[2])
    return cv


# ================================================================ 운하 조각 3판 (2026-10-27 사용자 「cmp-5 운하가 이상하다」)
# 2판(따뜻한 사암 계단 · 가로 널 갑문 앞면)은 버들항 운하·계단과 따로 놀았다. 3판은 버들항 원본의 실제 칸을 바탕으로 쓴다:
#   물·둑 테 = 강·운하 물 오토타일(23,089 서 · 23,153 몸통 · 23,137 동)의 화소 그대로,
#   계단 = 버들항 돌계단(코 dee0dd · 디딤 c4c6c3 · 챌판 그늘 3e403d 5px 주기, 볼 테 595b58),
#   갑문 아래 = 버들항 성벽 밑 둑(위어)의 물턱·물줄기·물거품·물결 줄을 그 화소 그대로 옮긴다,
#   널 = 버들항 부두 널(885a26 몸 · 633712 이음 · 452a17 테).
_ROOT = HERE.parents[2]
_SRC = {}


def _src(key):
    if key not in _SRC:
        from PIL import Image as _I
        if key == "sheet": _SRC[key] = _I.open(_ROOT / "public/assets/beodeul-city/beodeul-city-chipset.png").convert("RGBA")
        else: _SRC[key] = _I.open(_ROOT / "tiledata/beodeul-city/render/city6_base.png").convert("RGBA")
    return _SRC[key]


def _canal_px(side, x, y):
    """운하 오토타일 칸 화소(16px 주기). side W/C/E = 서쪽 둑 열 · 몸통 · 동쪽 둑 열."""
    n = {"W": 23089, "C": 23153, "E": 23137}[side]
    return _src("sheet").getpixel(((n % 128) * 16 + x % 16, (n // 128) * 16 + y % 16))


_WEIR_X0, _WEIR_Y0 = 47 * 16, 61 * 16      # 원본 렌더의 성벽 밑 둑(운하 네 칸 폭, 테 포함)


def _weir_px(x, y):
    return _src("render").getpixel((_WEIR_X0 + x, _WEIR_Y0 + y))


ST_NOSE, ST_TREAD, ST_RISER = hx("#dee0dd"), hx("#c4c6c3"), hx("#3e403d")
ST_CHEEK, ST_CHEEK_IN, ST_CHEEK_IN2, ST_CHEEK_DK = hx("#595b58"), hx("#9b9c9a"), hx("#898a88"), hx("#2b2c2a")
WET_NOSE, WET_TREAD, WET_RISER = hx("#5f878a"), hx("#5c8184"), hx("#2a6a60")
PIER = [hx(c) for c in ("#452a17", "#633712", "#885a26", "#b77541")]


def quay_steps(side="W"):
    """선착 계단 1×3(16×48, 바닥 층): 운하 둑 쪽 물 열에 깎아 넣은 돌계단 — 버들항 돌계단 그대로의 단(코·디딤·챌판 그늘 5px)이
    남쪽으로 내려가 물에 잠긴다. 둑 테는 운하 오토타일 화소 그대로, 물 쪽에는 낮은 볼 벽(버들항 계단 볼과 같은 색).
    W = 서쪽 둑(둑 테 x0~2, 계단 x3~11, 볼 x12~15) · E = 좌우를 바꾼 자리(빛은 늘 왼쪽 위라 볼 색은 다시 칠한다)."""
    cv = Canvas(16, 48)
    WATER_Y = 36                       # 이 줄부터 물(마지막 단이 잠긴다)
    tile = "W" if side == "W" else "E"
    for y in range(48):
        for x in range(16):
            # 바탕: 운하 오토타일 화소(둑 테 포함)
            c = _canal_px(tile, x, y)
            xs = x if side == "W" else 15 - x          # 서쪽 기준 좌표
            kerb = xs <= 2
            if kerb:
                cv.set(x, y, c); continue
            if y < WATER_Y:
                if xs <= 11:
                    # 계단: 5px 주기(그늘 2 · 코 1 · 디딤 2) — 위에서부터, 아래 두 단은 젖는다
                    k = (y + 3) % 5
                    wet = y >= WATER_Y - 9
                    if k in (0, 1): c = WET_RISER if wet else ST_RISER
                    elif k == 2: c = WET_NOSE if wet else ST_NOSE
                    else: c = WET_TREAD if wet else ST_TREAD
                    step_i = (y + 3) // 5
                    joint = 4 + (step_i * 3) % 5                                    # 단마다 엇갈린 돌 이음
                    if k >= 2 and xs == joint: c = ST_CHEEK_IN2 if not wet else WET_RISER
                    elif k == 1 and xs == joint: c = COOL[0]
                    elif k >= 3 and not wet:
                        g = h("quay3", side, x, y) % 9                            # 디딤 돌결(밝은 점 · 패인 점)
                        if g == 0: c = COOL[6]
                        elif g == 1: c = COOL[9]
                        elif g == 2 and xs > joint: c = COOL[7]
                    elif k >= 3 and wet and h("quay3w", x, y) % 5 == 0: c = hx("#45716f")
                    if xs == 3: c = ST_CHEEK_DK if k in (0, 1) else (ST_CHEEK_IN if k == 2 else ST_CHEEK_IN2)   # 둑 쪽 안 모서리
                    if xs == 11 and side == "W": c = ST_CHEEK_DK if k in (0, 1) else ST_CHEEK_IN2            # 볼 쪽 그늘
                else:
                    # 볼 벽(물 쪽 낮은 담): 서쪽 둑이면 x12 짙은 줄 · x13~14 밝은 윗면 · x15 물에 진 그늘
                    j = xs - 12
                    c = (ST_CHEEK, ST_TREAD, ST_TREAD, COOL[0])[j] if side == "W" else (ST_CHEEK, COOL[5], COOL[5], ST_TREAD)[j]
                    if j in (1, 2) and y % 8 == 7: c = COOL[5] if side == "W" else ST_CHEEK   # 볼 돌 이음
                    elif j in (1, 2) and h("quay3c", side, x, y) % 7 == 0: c = COOL[6] if c == ST_TREAD else COOL[4]
                    elif j in (1, 2) and y % 8 == 0 and c == ST_TREAD: c = COOL[9]                       # 돌 윗 모서리 빛
                    if y == WATER_Y - 1: c = WET_TREAD if j in (1, 2) else c
            else:
                # 물: 운하 화소 · 첫 줄 물턱 거품 · 잠긴 단이 희미하게
                if y == WATER_Y: c = hx("#a7d4db") if (x + side.__len__()) % 3 else hx("#5f878a")
                elif y in (WATER_Y + 3, WATER_Y + 4) and 3 <= xs <= 11: c = hx("#2e7979") if y == WATER_Y + 3 else hx("#338383") if x % 2 else c
                elif y in (WATER_Y + 8,) and 4 <= xs <= 10 and x % 2: c = hx("#2e7979")
            cv.set(x, y, c)
    return cv


def canal_lock():
    """갑문 64×32(가운데 4칸 · 바닥 층): 0행 = 위에서 본 부두 널 다리(널이 남북으로 놓여 동서로 걷는다) + 그 남쪽 앞면 나무 갑문(쇠띠),
    1행 = 갑문 밑으로 넘쳐 떨어지는 물 — 버들항 성벽 밑 둑의 물턱·물줄기·물거품·물결 줄을 화소 그대로 줄여 옮긴다. 둑 테는 운하 오토타일 그대로."""
    cv = Canvas(64, 32)
    DECK_Y0, DECK_Y1, FACE_Y1 = 1, 9, 14
    weir_rows = [14, 16, 30, 31, 32, 33, 34, 35, 57, 58, 59, 60, 61, 69, 70, 71, 72]   # 원본 둑 줄 → y 15..31(물턱 · 물줄기 · 물거품 · 물결 줄)
    for y in range(32):
        for x in range(64):
            side = "W" if x < 16 else "E" if x >= 48 else "C"
            c = _canal_px(side, x, y)
            kerb = x <= 2 or x >= 61
            if y < DECK_Y0:
                c = PIER[0]                                                        # 널 다리 뒤 테(물 위 그늘선)
            elif y <= DECK_Y1:
                # 널: 4px 주기 남북 널(이음 1 · 몸 3), 위·아래 테
                if y == DECK_Y1: c = PIER[0]
                else:
                    c = PIER[1] if x % 4 == 0 else PIER[2]
                    if y == DECK_Y0 and x % 4 != 0: c = PIER[3] if x % 8 < 4 else PIER[2]          # 빛 받은 윗 끝
                    if x % 4 == 3 and y > DECK_Y0 + 1 and (x // 4 + y) % 5 == 0: c = PIER[1]       # 결 한 점
                    g = h("lock3", x, y) % 11
                    if x % 4 != 0 and y > DECK_Y0 and g == 0: c = WOOD[4]                       # 결 그늘
                    elif x % 4 == 1 and y > DECK_Y0 and g in (1, 2): c = PIER[3]               # 널 왼쪽 빛
                    elif x % 4 == 3 and y > DECK_Y0 and g in (3, 4, 5): c = WOOD[4]            # 널 오른쪽 그늘
                    if y == DECK_Y1 - 1 and x % 4 != 0: c = WOOD[4]                             # 앞 끝 바로 위 그늘
                if x in (0, 63): c = PIER[0]
            elif y <= FACE_Y1:
                # 갑문 앞면(남쪽, 짙다): 가로 들보 두 단 · 쇠띠 · 가운데 맞물림
                k = y - DECK_Y1 - 1                        # 0..4
                c = (PIER[3], PIER[2], PIER[1], PIER[0], WOOD[1])[k]
                if k in (1, 2) and h("lock3f", x // 3, y) % 4 == 0: c = WOOD[4] if k == 1 else PIER[0]
                if x % 16 in (5, 6) and k < 4: c = IRON[2] if x % 16 == 5 else IRON[1]
                if x in (31, 32): c = PIER[0] if x == 32 else PIER[1]
                if kerb: c = (ST_TREAD, ST_TREAD, ST_CHEEK)[x] if x <= 2 else (ST_CHEEK, COOL[5], COOL[5])[x - 61]
                if kerb and k == 0: c = ST_NOSE if x <= 2 else COOL[8]
            else:
                i = y - FACE_Y1 - 1
                src = weir_rows[min(i, len(weir_rows) - 1)]
                if not kerb: c = _weir_px(x, src)
            cv.set(x, y, c)
    return cv
