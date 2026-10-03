"""조선 실내 구조 키트 — 바닥·천장·벽면·창·문·기둥·계단·단(壇). 조각 이름은 전부 `in_` 접두.

기준: 손 도트 실내 v5(`atlas_biome_interior`)와 같은 시점·배율 — 정면-위 3/4, 빛은 왼쪽 위, 벽면 2칸(32px), 천장 띠 + 방 쪽 림,
바닥은 대비가 낮고(톤 4~5, 밝기 차 ~25) 물체가 대비를 가진다. 조선 팔레트 91색 잠금은 tk.py 가 지킨다(색을 직접 적지 않는다).

구조 규칙(스킬 interior-chipset-authoring 0절): 벽은 손으로 칠하지 않는다 — demo_interior.build_room 이 평면도에서 유도한다.
  고체 칸 = 천장(블롭 47, 방 쪽에 창방 띠) · 고체 칸 바로 밑 두 줄 = 벽면(1×2 조각, 끝 변형 m/l/r/lr) · 그 밑 바닥은 그늘 변형.
"""
import math
from tk import *
from build import outline, _snap_dark

W_ = RGB['wood']; E_ = RGB['earth']; P_ = RGB['plaster']; S_ = RGB['stone']; G_ = RGB['giwa']; ST_ = RGB['straw']


# ------------------------------------------------------------------ 바닥 (평면 지형 묶음)
# 묶음 순서(모든 바닥 공통): 0,1 평면 변형 · 2 북쪽 그늘(벽면 밑) · 3 서쪽 그늘(서벽 곁) · 4 북서 그늘 · 5 북쪽 그늘 변형 · (마루·온돌만) 6 앞 턱(남쪽 가장자리)
FLOOR_ORDER = ('v0', 'v1', 'sh_n', 'sh_w', 'sh_nw', 'sh_n1', 'lip_s')
# 바닥 종류: ondol 장판 · maru 마루 · dirt 흙 · stone 박석 · jeondol 전돌 · deck 단 널마루(단 윗면) · yard 문 밖 마당
_snap_cache = {}


def _dark(rgb, f):
    k = (tuple(int(v) for v in rgb[:3]), round(f, 3))
    if k not in _snap_cache:
        _snap_cache[k] = _snap_dark(tuple(int(v * f) for v in k[0]))
    return _snap_cache[k]


def _shade(cv, fn):
    """fn(x, y) -> 0.0~1.0 곱셈 계수(1 = 그대로)."""
    out = Cv(T, T)
    out.a = cv.a.copy()
    for y in range(T):
        for x in range(T):
            f = fn(x, y)
            if f < 0.999:
                out.put(x, y, _dark(cv.a[y, x, :3], f))
    return out


def _floor_ondol(v):
    """온돌 장판: 기름먹인 노란 한지 — 매끈한 황갈 한 톤(황토 흙바닥보다 한 단 밝다), 결 방향 1px 가로 섬유, 32px 폭 장판 이음 한 줄(세로)."""
    c = Cv(T, T)
    for y in range(T):
        for x in range(T):
            q = rnd(x // 3 + 5 * v, y, 11)
            c.put(x, y, E_[6] if q > 0.985 else (E_[4] if q < 0.07 else E_[5]))
    if v == 0:
        c.vl(0, 0, T, E_[4])
    return c


def _floor_maru(v):
    """마루: 가로로 길게 깐 널(폭 5px) — 널마다 한 톤, 널 사이 줄눈 1px, 널 끝 이음은 타일마다 한 줄에만(벽돌처럼 줄마다 어긋나면 안 된다). 윗줄은 옻칠 윤."""
    c = Cv(T, T)
    ys = (0, 5, 10, 16)
    for b in range(3):
        y0, y1 = ys[b], ys[b + 1]
        tone = W_[4] if rnd(b, v, 21) > 0.5 else W_[3]
        for y in range(y0, y1):
            for x in range(T):
                q = rnd(x // 5, y, 22 + b)
                t = tone
                if y == y0 and tone is W_[4]:
                    t = W_[5]
                elif q < 0.07:
                    t = W_[2]
                c.put(x, y, t)
        c.hl(0, T, y1 - 1, W_[2])
    jb = (v * 2 + 1) % 3                                   # 이음이 들어가는 널(타일마다 한 장)
    jx = 5 + 6 * v
    c.vl(jx, ys[jb], ys[jb + 1] - 1, W_[2])
    return c


def _floor_deck(v):
    """단 널마루(훈장·원님 단 윗면): 마루보다 밝고 가는 널(폭 4px) + 가장자리 밝은 윤 — 바닥보다 한 단 높은 판자 상판으로 읽힌다."""
    c = Cv(T, T)
    for b in range(4):
        tone = W_[5] if rnd(b, v, 23) > 0.45 else W_[4]
        for y in range(b * 4, b * 4 + 4):
            for x in range(T):
                c.put(x, y, W_[6] if (y == b * 4 and tone is W_[5]) else tone)
        c.hl(0, T, b * 4 + 3, W_[3])
    c.vl((9 * v + 4) % 16, 4 * ((v + 1) % 4), 4 * ((v + 1) % 4) + 3, W_[3])
    return c


def _floor_dirt(v):
    """흙바닥: 다진 흙 — 어두운/밝은 1px 얼룩과 드문 잔돌."""
    c = Cv(T, T)
    for y in range(T):
        for x in range(T):
            q = rnd(x + 16 * v, y, 31)
            c.put(x, y, E_[2] if q < 0.11 else (E_[4] if q > 0.86 else E_[3]))
    for (x, y) in ((3 + 5 * v, 4), (11 - 4 * v, 11), (7, 14 - 6 * v)):
        c.put(x, y, E_[4]); c.put(x + 1, y, E_[4]); c.put(x, y + 1, E_[2])
    return c


def _floor_yard(v):
    """문 밖 마당: 다져진 밝은 흙 — 방 안 흙바닥(부엌)보다 한 단 밝고 잔돌이 적다. 바깥 땅이라는 것이 읽혀야 한다."""
    c = Cv(T, T)
    for y in range(T):
        for x in range(T):
            q = rnd(x + 16 * v, y, 32)
            c.put(x, y, E_[3] if q < 0.07 else (E_[5] if q > 0.88 else E_[4]))
    for (x, y) in ((4 + 5 * v, 5), (11 - 4 * v, 12)):
        c.put(x, y, E_[3]); c.put(x + 1, y, E_[3])
    return c


def _floor_stone(v):
    """돌바닥(박석): 반듯하지 않은 큰 돌 — 5/6/5 줄, 줄눈 1px, 돌마다 한 톤 차이, 왼쪽 위 1px 하이라이트."""
    c = Cv(T, T)
    rows = [(0, 5), (5, 11), (11, 16)] if v == 0 else [(0, 6), (6, 11), (11, 16)]
    for ri, (y0, y1) in enumerate(rows):
        cuts = [(3, 9), (0, 6, 12), (4, 10)][ri] if v == 0 else [(6, 12), (2, 8, 13), (5, 11)][ri]
        xs = [0] + list(cuts) + [16]
        for k in range(len(xs) - 1):
            x0, x1 = xs[k], xs[k + 1]
            tone = S_[4] if rnd(k, ri, 41 + v) < 0.62 else S_[3]
            for y in range(y0, y1):
                for x in range(x0, x1):
                    c.put(x, y, tone)
            c.put(x0 + 1, y0 + 1, S_[5]) if (x1 - x0) > 3 else None
            c.vl(x0, y0, y1, S_[2])
        c.hl(0, T, y1 - 1, S_[2])
    return c


def _floor_jeondol(v):
    """전돌: 회청색 네모 벽돌 8×8 — 줄눈 1px, 벽돌마다 한 톤 차이, 한 줄 걸러 반 칸 어긋남."""
    c = Cv(T, T)
    for by in range(2):
        for bx in range(3):
            x0 = bx * 8 - (4 if (by + v) % 2 else 0)
            tone = G_[4] if rnd(bx, by, 51 + v) < 0.65 else G_[3]
            for y in range(by * 8, by * 8 + 8):
                for x in range(max(0, x0), min(T, x0 + 8)):
                    c.put(x, y, tone)
            c.hl(max(0, x0), min(T, x0 + 8), by * 8 + 7, G_[2])
            if 0 <= x0 < T: c.vl(x0, by * 8, by * 8 + 7, G_[2])
            c.put(max(0, x0) + 1, by * 8 + 1, G_[5])
    return c


def _lip(base, ramp_wood=True):
    """앞 턱: 위 10줄은 바닥, 그 밑 널 모서리(밝은 입술) + 어두운 옆면 + 접지."""
    c = Cv(T, T)
    c.a = base.a.copy()
    for x in range(T):
        c.put(x, 10, W_[6]); c.put(x, 11, W_[5])
        c.put(x, 12, W_[3]); c.put(x, 13, W_[2]); c.put(x, 14, W_[2]); c.put(x, 15, W_[1])
    return c


def floor_set(kind):
    mk = {'ondol': _floor_ondol, 'maru': _floor_maru, 'dirt': _floor_dirt, 'stone': _floor_stone, 'jeondol': _floor_jeondol, 'deck': _floor_deck, 'yard': _floor_yard}[kind]
    v0, v1 = mk(0), mk(1)
    sh_n = lambda x, y: (0.74, 0.86, 0.94)[y] if y < 3 else 1.0
    sh_w = lambda x, y: (0.82, 0.9, 0.95, 0.98)[x] if x < 4 else 1.0
    sh_nw = lambda x, y: min(sh_n(x, y), sh_w(x, y))
    tiles = [v0, v1, _shade(v0, sh_n), _shade(v0, sh_w), _shade(v0, sh_nw), _shade(v1, sh_n)]
    if kind in ('ondol', 'maru', 'deck'):
        tiles.append(_lip(v0))
    return tiles


# ------------------------------------------------------------------ 천장 (블롭 47)
N_, E__, S__, W__ = 1, 2, 4, 8
NE_, SE_, SW_, NW_ = 16, 32, 64, 128


def _canon(m):
    out = m & 15
    for bit, a, b in ((NE_, N_, E__), (SE_, S__, E__), (SW_, S__, W__), (NW_, N_, W__)):
        if (m & bit) and (m & a) and (m & b):
            out |= bit
    return out


ALL47 = sorted({_canon(m) for m in range(256)})
INDEX47 = {m: i for i, m in enumerate(ALL47)}


def _rim(side, d, pos):
    """방 쪽 천장 띠(기와 처마 단면) 한 화소의 색. side N/S/W/E 는 천장 덩이의 어느 변이 방을 보는가. d = 그 변에서 안쪽으로 거리, pos = 변을 따른 위치.
    v5 실내처럼 어두운 천장 + 밝은 림 — 조선은 회청색 기와 단면이고 4px 마다 막새 박자로 한 톤 어둡다."""
    notch = (pos % 4 == 3)
    hi = G_[5] if notch else G_[6]
    if side in ('N', 'W'):
        return (G_[1], hi, G_[5], None)[d]
    if side == 'S':
        return (G_[1], G_[3], G_[5], hi)[d]
    return (G_[1], G_[3], G_[4], None)[d]


def ceil_tile(m):
    """m: 이웃 8비트(1 = 그 이웃도 천장). 속은 어두운 두 톤 체크, 천장이 아닌 이웃 쪽 변에 창방 띠."""
    c = Cv(T, T)
    for y in range(T):                                    # 벽 윗면(기와 덮개): 검은 허공이 아니라 보이는 재료 — 4px 줄마다 이음, 줄마다 어긋난 짧은 이음
        for x in range(T):
            q = rnd(x, y // 4, 77)
            c.put(x, y, G_[4] if q > 0.9 else (G_[2] if y % 4 == 3 else G_[3]))
    for r in range(4):
        c.vl((r * 7 + 3) % 16, r * 4, r * 4 + 3, G_[2])
        c.vl((r * 7 + 11) % 16, r * 4, r * 4 + 3, G_[2])
    cand = []
    reach = {'N': 3, 'S': 4, 'W': 3, 'E': 3}
    for y in range(T):
        for x in range(T):
            best = None
            for side, bit, d, pos in (('N', N_, y, x), ('S', S__, 15 - y, x), ('W', W__, x, y), ('E', E__, 15 - x, y)):
                if not (m & bit) and d < reach[side]:
                    if best is None or d < best[0]:
                        best = (d, side, pos)
            # 오목 모서리: 양쪽 변은 천장인데 그 사이 대각 이웃이 방이다
            for bit, a, b, cx, cy, side in ((NE_, N_, E__, 15, 0, 'N'), (SE_, S__, E__, 15, 15, 'S'),
                                              (SW_, S__, W__, 0, 15, 'S'), (NW_, N_, W__, 0, 0, 'N')):
                if (m & a) and (m & b) and not (m & bit):
                    d = max(abs(x - cx), abs(y - cy))
                    if d < reach[side] and (best is None or d < best[0]):
                        best = (d, side, x if side in 'NS' else y)
            if best:
                col = _rim(best[1], best[0], best[2])
                if col is not None:
                    c.put(x, y, col)
    return c


def ceil47():
    return [ceil_tile(m) for m in ALL47]


def void_tile():
    """방 밖 허공(문 밖 마당 둘레): 칠흑. 벽 윗면(ceil47)과 달리 아무 재료도 아니다."""
    c = Cv(T, T)
    c.rect(0, 0, T, T, G_[0])
    return c


def ceil_front(ends):
    """바깥 아랫벽(남벽) 한 칸: 위 7줄은 벽 윗면(기와 덮개 + 앞 처마 턱), 아래 9줄은 바깥 벽면(회벽 윗단 + 돌 굽). 두께가 읽힌다.
    ends: 'm' 이어짐 · 'l' 왼 끝 · 'r' 오른 끝 · 'lr' 한 칸 — 끝에는 모서리 기둥 면."""
    c = Cv(T, T)
    for y in range(0, 7):
        for x in range(T):
            q = rnd(x, y // 4, 77)
            c.put(x, y, G_[4] if q > 0.9 else (G_[2] if y % 4 == 3 else G_[3]))
    for x in range(T):                                    # 앞 처마 턱(밝은 입술 → 그늘)
        c.put(x, 5, G_[5] if x % 4 != 3 else G_[4]); c.put(x, 6, G_[6] if x % 4 != 3 else G_[5])
    for y in range(7, 16):                                # 바깥 벽면
        for x in range(T):
            q = rnd(x, y, 78)
            if y < 9:
                col = G_[1]                              # 처마 밑 그늘
            elif y < 13:
                col = P_[3] if q > 0.1 else P_[2]
            elif y < 15:
                col = S_[4] if y == 13 else S_[3]
            else:
                col = S_[1]
            c.put(x, y, col)
    if 'l' in ends:
        for y in range(5, 16): c.put(0, y, G_[1]); c.put(1, y, W_[4] if y > 8 else G_[5])
    if 'r' in ends:
        for y in range(5, 16): c.put(T - 1, y, G_[0]); c.put(T - 2, y, W_[2] if y > 8 else G_[3])
    return c


def ceil_front_set():
    return [ceil_front(e) for e in ('m', 'l', 'r', 'lr')]


# ------------------------------------------------------------------ 벽면 1×2 (16×32)
def _post(c, x0, x1, y0=0, y1=32):
    """기둥 면: 왼쪽 밝고 오른쪽 어둡다."""
    for y in range(y0, y1):
        for k, x in enumerate(range(x0, x1)):
            t = 5 if k == 0 else (4 if k < (x1 - x0) - 1 else 2)
            c.put(x, y, W_[t])
    c.hl(x0, x1, y1 - 1, W_[1])


def _beam(c, x0=0, x1=T):
    """창방(위쪽 가로 들보) 4줄: 천장 림 밑 그늘, 밝은 앞면, 아랫그늘."""
    c.hl(x0, x1, 0, W_[2]); c.hl(x0, x1, 1, W_[5]); c.hl(x0, x1, 2, W_[4]); c.hl(x0, x1, 3, W_[2])


def _skirt(c, x0=0, x1=T):
    """바닥 쪽 굽널(걸레받이) 5줄: 밝은 윗입술 · 몸 · 접지 어둠."""
    c.hl(x0, x1, 27, W_[6]); c.hl(x0, x1, 28, W_[4]); c.hl(x0, x1, 29, W_[4]); c.hl(x0, x1, 30, W_[3]); c.hl(x0, x1, 31, W_[1])


def _wall_hoe(ends, kind='hoe'):
    """회벽: 아래 줄은 한 톤 어둡다. 위 창방, 아래 굽널, 끝 변형은 기둥."""
    c = Cv(T, T * 2)
    for y in range(4, 32):
        lo = y >= 16
        for x in range(T):
            q = rnd(x, y, 91)
            if lo:
                c.put(x, y, P_[4] if q > 0.1 else P_[3])
            else:
                c.put(x, y, P_[6] if q > 0.94 else (P_[5] if q > 0.1 else P_[4]))
    _beam(c)
    _skirt(c)
    for x in range(T):                       # 위·아래 줄 경계 그늘 한 줄(두 줄 구성이 읽히게)
        c.put(x, 15, P_[4] if rnd(x, 1, 3) > 0.3 else P_[3])
    return _ends(c, ends)


def _wall_heuk(ends):
    """황토벽: 흙+짚 얼룩, 위 창방 + 굽널(돌 굽 대신 낮은 흙 턱)."""
    c = Cv(T, T * 2)
    for y in range(4, 32):
        lo = y >= 16
        for x in range(T):
            q = rnd(x, y, 92)
            base = E_[3] if lo else E_[4]
            c.put(x, y, E_[5] if (q > 0.93 and not lo) else (E_[2] if q < 0.1 else base))
    for (x, y) in ((3, 8), (11, 6), (7, 12), (13, 21), (4, 24)):     # 짚 여물 자국 2px
        c.put(x, y, E_[6] if y < 16 else E_[4]); c.put(x + 1, y, E_[6] if y < 16 else E_[4])
    _beam(c)
    _skirt(c)
    return _ends(c, ends)


def _wall_mok(ends):
    """목재벽: 세로 널 4px, 줄눈, 널마다 밝기 차, 아래 줄은 한 톤 어둡다."""
    c = Cv(T, T * 2)
    for y in range(4, 32):
        lo = y >= 16
        for x in range(T):
            bd = x // 4
            q = rnd(bd, 0, 93)
            body = (W_[4] if q < 0.5 else W_[5]) if not lo else (W_[3] if q < 0.5 else W_[4])
            if x % 4 == 3:
                body = W_[2] if not lo else W_[1]
            elif x % 4 == 0 and not lo:
                body = W_[6] if q > 0.6 else W_[5]
            c.put(x, y, body)
    _beam(c)
    c.hl(0, T, 27, W_[5]); c.hl(0, T, 28, W_[3]); c.hl(0, T, 29, W_[3]); c.hl(0, T, 30, W_[2]); c.hl(0, T, 31, W_[1])
    return _ends(c, ends, post=False)


def _wall_dol(ends):
    """돌벽: 막돌 쌓기 — 줄 높이 6/5, 줄마다 어긋난 이음, 아래 줄은 한 톤 어둡다."""
    c = Cv(T, T * 2)
    rows = [(4, 10), (10, 16), (16, 21), (21, 27), (27, 32)]
    for ri, (y0, y1) in enumerate(rows):
        lo = y0 >= 16
        cuts = [(5, 11), (2, 8, 13), (6, 12), (3, 9), (7, 13)][ri]
        xs = [0] + list(cuts) + [16]
        for k in range(len(xs) - 1):
            x0, x1 = xs[k], xs[k + 1]
            q = rnd(k, ri, 94)
            tone = (S_[4] if q < 0.55 else S_[3]) if not lo else (S_[3] if q < 0.55 else S_[2])
            for y in range(y0, y1):
                for x in range(x0, x1):
                    c.put(x, y, tone)
            c.vl(x0, y0, y1, S_[2] if not lo else S_[1])
            c.put(x0 + 1, y0, S_[5] if not lo else S_[4])
        c.hl(0, T, y1 - 1, S_[2] if not lo else S_[1])
    _beam(c)
    return _ends(c, ends, post=False, dark=True)


def _wall_chang(ends):
    """창호 벽면: 한지 바른 문살 판 — 위 3/4 은 격자, 아래 1/4 은 낮은 머름 널. 열 칸마다 문틀 기둥이 좌우에 선다."""
    c = Cv(T, T * 2)
    for y in range(4, 32):
        for x in range(T):
            c.put(x, y, P_[4] if rnd(x, y, 95) > 0.12 else P_[3])
    # 문살: 세로 살 4px 간격, 가로 살
    for x in range(3, T, 4):
        c.vl(x, 4, 25, W_[4])
    for y in (9, 14, 19):
        c.hl(0, T, y, W_[4])
    c.hl(0, T, 4, W_[3]); c.hl(0, T, 24, W_[3]); c.hl(0, T, 25, W_[5])
    for y in range(26, 31):
        c.hl(0, T, y, W_[4] if y % 2 else W_[5])
    c.hl(0, T, 31, W_[1])
    _beam(c)
    for y in range(4, 25):               # 아래 칸 한지는 한 톤 어둡게(윗 칸보다 빛이 덜 든다)
        if y >= 16:
            for x in range(T):
                if tuple(c.a[y, x, :3]) in (tuple(P_[4]) if False else ()):
                    pass
    return _ends(c, ends)


def _ends(c, ends, post=True, dark=False):
    """끝 변형: l = 왼쪽 끝 기둥, r = 오른쪽 끝 기둥. 목재·돌벽은 기둥 대신 어두운 모서리 띠."""
    for side in ('l', 'r'):
        if side in ends.replace('m', ''):
            x0, x1 = (0, 3) if side == 'l' else (T - 3, T)
            if post:
                _post(c, x0, x1, 0, 31)
                c.hl(x0, x1, 31, W_[1])
            else:
                for y in range(0, 32):
                    for x in range(x0, x1):
                        c.put(x, y, (S_[1] if dark else W_[2]) if (x == (0 if side == 'l' else T - 1)) else (S_[3] if dark else W_[3]))
    return c


def _lattice_box(c, x0, y0, x1, y1, step=4, paper=True):
    """살창: 격자 한지. 프레임 1px 왼쪽 밝고 오른쪽 어둡다."""
    for y in range(y0, y1):
        for x in range(x0, x1):
            c.put(x, y, P_[5] if rnd(x, y, 96) > 0.15 else P_[4])
    for x in range(x0 + step, x1 - 1, step):
        c.vl(x, y0 + 1, y1 - 1, W_[4])
    for y in range(y0 + step, y1 - 1, step):
        c.hl(x0 + 1, x1 - 1, y, W_[4])
    c.hl(x0, x1, y0, W_[5]); c.hl(x0, x1, y1 - 1, W_[2])
    c.vl(x0, y0, y1, W_[6]); c.vl(x1 - 1, y0, y1, W_[2])


def _win_over(base_fn, ends='m', sill=True, big=False):
    c = base_fn(ends)
    x0, x1, y0, y1 = (2, 14, 5, 15) if big else (3, 13, 6, 14)
    _lattice_box(c, x0, y0, x1, y1, 3 if not big else 4)
    if sill:
        c.hl(x0 - 1, x1 + 1, y1, W_[6]); c.hl(x0 - 1, x1 + 1, y1 + 1, W_[3])
    return c


def _door_over(base_fn, ends='m'):
    """닫힌 미닫이 장지문: 문틀 안에 격자 한지 두 짝, 가운데 문고리 한 점, 아래 널 머름."""
    c = base_fn(ends)
    for y in range(4, 31):
        for x in range(1, 15):
            c.put(x, y, P_[5] if rnd(x, y, 97) > 0.15 else P_[4])
    for x in range(4, 15, 4):
        c.vl(x, 5, 24, W_[4])
    for y in (9, 14, 19):
        c.hl(1, 15, y, W_[4])
    c.vl(1, 4, 31, W_[6]); c.vl(14, 4, 31, W_[2]); c.vl(7, 5, 29, W_[3]); c.vl(8, 5, 29, W_[5])
    c.hl(1, 15, 4, W_[5]); c.hl(1, 15, 24, W_[3])
    for y in range(25, 30):
        c.hl(1, 15, y, W_[5] if y % 2 else W_[4])
    c.put(6, 17, S_[5]); c.put(9, 17, S_[5])
    c.hl(1, 15, 30, W_[2]); c.hl(0, 16, 31, W_[1])
    return c


WALL_KINDS = {'hoe': _wall_hoe, 'heuk': _wall_heuk, 'mok': _wall_mok, 'dol': _wall_dol, 'chang': _wall_chang}


def walls():
    out = {}
    for k, fn in WALL_KINDS.items():
        for e in ('m', 'l', 'r', 'lr'):
            out[f'in_wall_{k}_{e}'] = fn(e)
    out['in_wall_hoe_win'] = _win_over(_wall_hoe)
    out['in_wall_mok_win'] = _win_over(_wall_mok, sill=True)
    out['in_wall_heuk_win'] = _win_over(_wall_heuk, big=False)
    out['in_wall_hoe_door'] = _door_over(_wall_hoe)
    out['in_wall_chang_door'] = _door_over(_wall_chang)
    out['in_wall_mok_door'] = _door_over(_wall_mok)
    return out


# ------------------------------------------------------------------ 기둥·들보
def pillar(h=2):
    """둥근 기둥(16×16h): 주춧돌 위에 선 목재 기둥 — 왼쪽 밝고 오른쪽 어둡다. 위 끝에 창방이 얹힌다."""
    c = Cv(T, T * h)
    H = T * h
    for y in range(H - 6, H - 1):                    # 주춧돌
        w = 12 if y > H - 4 else 10
        for x in range(8 - w // 2, 8 + w // 2):
            c.put(x, y, S_[5] if x < 8 - w // 4 else (S_[4] if x < 8 + w // 4 else S_[3]))
    c.hl(2, 14, H - 1, S_[2])
    for y in range(4, H - 6):                        # 기둥(폭 7)
        for k, x in enumerate(range(5, 12)):
            c.put(x, y, W_[(6, 5, 5, 4, 3, 2, 2)[k]])
    c.hl(1, 15, 0, W_[2]); c.hl(1, 15, 1, W_[6]); c.hl(1, 15, 2, W_[5]); c.hl(1, 15, 3, W_[2])     # 창방 얹힘
    c.hl(4, 13, 4, W_[3])
    outline(c)
    shadow_r = [(12, H - 2), (13, H - 2)]
    for (x, y) in shadow_r:
        if c.a[y, x, 3] == 0: c.put(x, y, SHADOW, 60)
    return c


def ceil_beam(kind='m'):
    """천장 들보(16×16): 방 위를 가로지르는 목재 보 — 윗면 한 줄, 앞면 밝고, 밑에 그늘. 사람 위에 그려진다(C)."""
    c = Cv(T, T)
    x0 = 0 if kind != 'l' else 3
    x1 = T if kind != 'r' else T - 3
    c.hl(x0, x1, 3, W_[6]); c.hl(x0, x1, 4, W_[5])
    for y in range(5, 9):
        c.hl(x0, x1, y, (W_[5], W_[4], W_[3], W_[2])[y - 5])
    c.hl(x0, x1, 9, W_[1])
    for y in range(10, 13):
        for x in range(x0, x1):
            c.put(x, y, SHADOW, (80, 55, 30)[y - 10])
    if kind == 'l':
        for y in range(3, 10): c.put(x0 - 1, y, W_[2]); c.put(x0 - 2, y, W_[3]); c.put(x0 - 3, y, W_[4])
    if kind == 'r':
        for y in range(3, 10): c.put(x1, y, W_[2]); c.put(x1 + 1, y, W_[3]); c.put(x1 + 2, y, W_[4])
    return c


# ------------------------------------------------------------------ 문
def exit_door(w=1):
    """출입구(w×1): 남벽 틈을 문틀로 짠다 — 위 3줄 인방(들보), 양옆 기둥 2px, 가운데는 방 바닥이 이어지는 어두운 마루 + 문턱 널(밝은 윗면 · 앞면 · 접지).
    문 밖은 이 칸 바로 아래 마당(in_floor_yard) 두 줄이 이어진다. 이 칸을 밟으면 밖으로 나간다(F)."""
    c = Cv(T * w, T)
    Wd = T * w
    for y in range(0, T):
        for x in range(Wd):
            q = rnd(x, y, 99)
            c.put(x, y, W_[2] if q > 0.2 else W_[1])        # 문 안쪽 어두운 마루(바깥에서 보면 그늘)
    for y in range(3, 11):                                    # 안쪽 그늘은 위가 더 어둡다
        for x in range(2, Wd - 2):
            c.put(x, y, W_[1] if y < 6 else W_[2])
    for x in range(Wd):                                       # 인방
        c.put(x, 0, W_[6]); c.put(x, 1, W_[5]); c.put(x, 2, W_[3])
    for y in range(0, 12):                                    # 문설주
        for k, x in enumerate((0, 1)):
            c.put(x, y, W_[6] if k == 0 else W_[4]); c.put(Wd - 1 - k, y, W_[2] if k == 0 else W_[3])
    for x in range(2, Wd - 2):                                # 문턱
        c.put(x, 11, W_[6]); c.put(x, 12, W_[5]); c.put(x, 13, W_[4]); c.put(x, 14, W_[2]); c.put(x, 15, W_[1])
    for y in range(12, 16):
        for x in (0, 1):
            c.put(x, y, S_[5] if x == 0 else S_[4]); c.put(Wd - 1 - x, y, S_[3] if x == 0 else S_[2])
    return c


def doorway():
    """칸막이 통로(1×1): 방 사이 문틀 — 위 3줄 인방, 양옆 문설주 2px, 가운데는 비어 바닥이 보이고 한가운데 문턱 널. 걸어 지난다(F). 인방·문설주는 사람 위에 그려진다."""
    c = Cv(T, T)
    for x in range(T):
        c.put(x, 0, W_[6]); c.put(x, 1, W_[5]); c.put(x, 2, W_[3]); c.put(x, 3, W_[2])
    for y in range(0, T):
        c.put(0, y, W_[6]); c.put(1, y, W_[4]); c.put(T - 2, y, W_[3]); c.put(T - 1, y, W_[2])
    for x in range(2, T - 2):
        c.put(x, 12, W_[6]); c.put(x, 13, W_[5]); c.put(x, 14, W_[3]); c.put(x, 15, W_[1])
    return c


def door_sill():
    """문턱(1×1): 칸막이 통로 바닥에 가로로 놓인 낮은 문지방 — 세로 줄(남북으로 놓임), 윗면 밝고 옆면 어둡다. 걸어 지난다(F)."""
    c = Cv(T, T)
    for y in range(0, T):
        c.put(6, y, W_[6]); c.put(7, y, W_[5]); c.put(8, y, W_[4]); c.put(9, y, W_[3]); c.put(10, y, W_[2])
    for y in range(0, T):
        c.put(11, y, SHADOW, 70); c.put(12, y, SHADOW, 35)
    return c


# ------------------------------------------------------------------ 계단·단
def stairs_wood(w=3):
    """나무 계단(w×3칸): 북벽에 붙어 벽 속으로 오른다 — 위는 어두운 올라간 자리, 디딤 널은 밝고 챌판은 어둡다, 양옆 난간 기둥."""
    c = Cv(T * w, T * 3)
    Wd = T * w
    for y in range(0, 10):                            # 올라간 자리(어둠)
        for x in range(Wd):
            c.put(x, y, G_[0] if y < 6 else G_[1])
    y = 10
    k = 0
    while y < T * 3 - 1:
        for x in range(4, Wd - 4):
            c.put(x, y, W_[6] if k % 2 == 0 else W_[5])
            c.put(x, y + 1, W_[5] if k % 2 == 0 else W_[4])
            if y + 2 < T * 3: c.put(x, y + 2, W_[3])
            if y + 3 < T * 3: c.put(x, y + 3, W_[2] if y + 3 < T * 3 - 1 else W_[1])
        y += 4
        k += 1
    for x0 in (0, Wd - 4):                            # 난간(옆판)
        for yy in range(6, T * 3):
            for kx in range(4):
                c.put(x0 + kx, yy, (W_[6], W_[5], W_[4], W_[2])[kx] if x0 == 0 else (W_[5], W_[4], W_[3], W_[1])[kx])
    outline(c)
    return c


def stairs_stone(w=3):
    """돌계단(w×3칸): 같은 구조, 돌 디딤·돌 옆판."""
    c = Cv(T * w, T * 3)
    Wd = T * w
    for y in range(0, 10):
        for x in range(Wd):
            c.put(x, y, G_[0] if y < 6 else G_[1])
    y, k = 10, 0
    while y < T * 3 - 1:
        for x in range(4, Wd - 4):
            c.put(x, y, S_[5]); c.put(x, y + 1, S_[4] if k % 2 else S_[5])
            if y + 2 < T * 3: c.put(x, y + 2, S_[3])
            if y + 3 < T * 3: c.put(x, y + 3, S_[2] if y + 3 < T * 3 - 1 else S_[1])
        y += 4; k += 1
    for x0 in (0, Wd - 4):
        for yy in range(6, T * 3):
            for kx in range(4):
                c.put(x0 + kx, yy, (S_[5], S_[4], S_[3], S_[2])[kx] if x0 == 0 else (S_[4], S_[3], S_[2], S_[1])[kx])
    outline(c)
    return c


def stairs_down():
    """지하 곳간 내림 사다리(1×1): 마루 바닥 구멍 — 뚜껑 문 널을 젖힌 어둠 + 사다리 두 가로대."""
    c = Cv(T, T)
    for y in range(2, 14):
        for x in range(2, 14):
            c.put(x, y, G_[0] if y > 4 else G_[1])
    c.hl(2, 14, 2, W_[6]); c.vl(2, 2, 14, W_[5]); c.vl(13, 2, 14, W_[2]); c.hl(2, 14, 13, W_[3])
    c.hl(4, 12, 6, W_[5]); c.hl(4, 12, 10, W_[5])
    c.vl(4, 5, 12, W_[4]); c.vl(11, 5, 12, W_[3])
    return c


def dais_front(kind='m'):
    """단(壇) 앞면(1×1): 위 6줄은 단 널마루 윗면(밝음, 앞 모서리 윤), 밑 9줄은 앞 널(챌면 — 가로 널 두 장, 위는 밝고 밑은 어둡다), 접지.
    kind l/r 은 끝 모서리: 옆면(왼쪽 밝고 오른쪽 어두운 4px)이 한 칸 폭으로 이어진다."""
    c = Cv(T, T)
    for y in range(0, 6):
        for x in range(T):
            q = rnd(x // 4, y, 61)
            c.put(x, y, W_[6] if y == 5 else (W_[5] if (y % 4) != 3 else W_[4]))
    for y in range(6, 15):
        for x in range(T):
            c.put(x, y, W_[(4, 4, 4, 3, 3, 3, 3, 2, 2)[y - 6]])
    c.hl(0, T, 6, W_[5]); c.hl(0, T, 10, W_[2])           # 윗 널 윤 · 두 널 사이 줄눈
    for x in range(T):
        if x % 7 == 3: c.put(x, 8, W_[3]); c.put(x, 12, W_[2])
    c.hl(0, T, 15, W_[1])
    if kind in ('l', 'lr'):
        for y in range(0, 16):
            for k in range(4): c.put(k, y, (W_[6], W_[5], W_[4], W_[3])[k] if y < 6 else (W_[5], W_[4], W_[3], W_[2])[k])
    if kind in ('r', 'lr'):
        for y in range(0, 16):
            for k in range(4): c.put(T - 1 - k, y, (W_[1], W_[2], W_[3], W_[3])[k] if y < 6 else (W_[1], W_[1], W_[2], W_[2])[k])
    return c


def dais_side(side='l'):
    """단 옆면(1×1): 단 널마루 바깥 가장자리 한 칸 — 왼쪽은 빛을 받아 밝고 오른쪽은 어둡다. 단이 얇은 판이 아니라 높이가 있는 덩어리로 읽히게 한다. 막힘(X)."""
    c = Cv(T, T)
    for y in range(T):
        for x in range(T):
            q = rnd(x // 4, y, 62)
            c.put(x, y, W_[6] if y % 4 == 0 else W_[5])
    for y in range(T):
        for k in range(4):
            if side == 'l':
                c.put(k, y, (W_[6], W_[5], W_[4], W_[3])[k])
            else:
                c.put(T - 1 - k, y, (W_[1], W_[2], W_[3], W_[3])[k])
    return c


def dais_steps():
    """단 오르는 디딤(1×1): 위 6줄 단 윗면 + 밑 디딤 세 단 — 밝은 윗면(디딤)과 어두운 챌면이 번갈아 보인다. 걷는 칸(F)."""
    c = Cv(T, T)
    for y in range(0, 6):
        for x in range(T):
            c.put(x, y, W_[6] if y == 5 else (W_[5] if y % 4 != 3 else W_[4]))
    for tread, riser in ((6, (8, 9)), (10, (12, 12)), (13, (15, 15))):
        c.hl(0, T, tread, W_[6]); 
        for y in range(tread + 1, riser[0]):
            c.hl(0, T, y, W_[5])
        for k, y in enumerate(range(riser[0], riser[1] + 1)):
            c.hl(0, T, y, W_[3] if k == 0 else W_[2])
    c.vl(0, 6, 16, W_[3]); c.vl(T - 1, 6, 16, W_[1])
    c.hl(0, T, 15, W_[1])
    return c


# ------------------------------------------------------------------ 카탈로그 연결
def terrain():
    d = {}
    for k in ('ondol', 'maru', 'dirt', 'stone', 'jeondol', 'deck', 'yard'):
        d[f'in_floor_{k}'] = floor_set(k)
    d['in_ceil47'] = ceil47()
    d['in_ceil_front'] = ceil_front_set()
    d['in_void'] = [void_tile()]
    return d


def objects():
    d = walls()
    d['in_pillar'] = pillar(2)
    d['in_pillar_3'] = pillar(3)
    for k in ('m', 'l', 'r'):
        d[f'in_ceil_beam_{k}'] = ceil_beam(k)
    d['in_door_sill'] = door_sill()
    d['in_doorway'] = doorway()
    d['in_exit_door'] = exit_door(1)
    d['in_exit_door2'] = exit_door(2)
    d['in_stairs_wood_3'] = stairs_wood(3)
    d['in_stairs_wood_2'] = stairs_wood(2)
    d['in_stairs_stone_3'] = stairs_stone(3)
    d['in_stairs_down'] = stairs_down()
    for k in ('m', 'l', 'r'):
        d[f'in_dais_front_{k}'] = dais_front(k)
    d['in_dais_steps'] = dais_steps()
    d['in_dais_side_l'] = dais_side('l')
    d['in_dais_side_r'] = dais_side('r')
    return d


if __name__ == '__main__':
    import sys
    from PIL import Image
    t = terrain()
    o = objects()
    print({k: len(v) for k, v in t.items()}, len(o), 'violations', len(VIOLATIONS))
