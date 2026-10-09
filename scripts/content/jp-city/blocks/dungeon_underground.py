#!/usr/bin/env python3
"""jp_city 4묶음 현대 던전 — 지하철 보선 터널·하수도. id 머리 `ug-`.
  python3 scripts/content/jp-city/blocks/dungeon_underground.py     # selftest + tiledata/jp-city/blocks/dungeon_underground/_all-x3.png

칸 16px = 1m, 3/4 시점(윗면 + 남쪽 앞면), 왼위 빛, 외곽선 sumi, 팔레트 modern3 만. 글자·숫자·상표·사람·동물 없음.
화풍은 역 블록(`interior_station.py`, st-)을 따르되 바닥·벽면을 1~2단 어둡게, 면마다 녹물 줄·얼룩·바랜 칠(낡음)을 넣는다.
재질 대비: 터널 콘크리트(conc 낮은 단 + 세그먼트 이음) · 하수도 벽돌(장마다 다른 톤 + 밝은 줄눈) · 철(tekko + 녹 soil/daidai 낮은 단)이 서로 다른 명암.
캔버스 규약(ikit): floor/wall 은 주기 캔버스, obj = w*16 × (ceil(up/16) + h)*16, hang = w*16 × hrows*16, table = fn(c,w,h), flat h=2 = 16×32.

크기(§12-3 공식, 1칸 = 1m):
  난간 높이 1.1m → 위 레일이 발칸 위 8px(up 8). 지하 신호기 머리 1.6m → up16. 케이블 선반 2m 폭 × 2m 높이 → wall 2칸·up16.
  비상 전화함 0.4×0.6m → 걸이. 대피 홈 폭 1m·높이 2m → wall 1칸·up32(벽면 두 줄을 덮는 파인 칸). 보선 수레 2m×0.9m·높이 0.6m → floor 2×1·up10.
  환기팬 지름 1.6m → wall 2칸·up16. 벽 사다리·맨홀 사다리 → wall 1칸·up32(벽 속으로 오른다, 발칸 걸음).
  관 지름 0.6m → 1칸 안 10px. 수문 2m → wall 2칸·up16. 배전반 0.8×0.4×1.8m → wall 1칸·up16(T4·F27). 사물함 0.6×0.5×1.8m 동일.
  배수 펌프 1.8m×0.8m·높이 0.9m → floor 2×1·up10. 공구함·구급함·랜턴 0.5m → 1칸 안.
분류는 interior/categories.py(tunnel·sewer).
"""
import os, sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, '..', 'interior'))
from ikit import Registry, K, OL, run_block, ROOT   # noqa: E402

BLOCK = 'dungeon_underground'
R = Registry(BLOCK, '지하 던전')
T_TAGS = ('지하철', '터널', '보선 통로', '던전')
S_TAGS = ('하수도', '점검로', '던전')
RM_TAGS = ('기계실', '대피실', '던전')


# ── 도우미 ────────────────────────────────────────────────────────────────────
def hs(x, y, s=0):
    n = (x * 374761393 + y * 668265263 + s * 2246822519 + 12345) & 0xffffffff
    n = ((n ^ (n >> 13)) * 1274126177) & 0xffffffff
    return (n ^ (n >> 16)) & 0xffff


def rnd(x, y, s, per): return hs(x, y, s) % 1000 < per


def px(c, x, y, col):
    if 0 <= x < c.w and 0 <= y < c.h: c.P(x, y, col)


def rc(c, x, y, w, h, col):
    x0, y0, x1, y1 = max(0, x), max(0, y), min(c.w, x + w), min(c.h, y + h)
    if x1 > x0 and y1 > y0: c.R(x0, y0, x1 - x0, y1 - y0, col)


def hl(c, x, y, n, col): rc(c, x, y, n, 1, col)
def vl(c, x, y, n, col): rc(c, x, y, 1, n, col)


def outline(c, x, y, w, h, col=None):
    col = col or OL
    hl(c, x, y, w, col); hl(c, x, y + h - 1, w, col); vl(c, x, y, h, col); vl(c, x + w - 1, y, h, col)


def disc(c, cx, cy, rx, ry, col):
    for y in range(int(cy - ry) - 1, int(cy + ry) + 2):
        for x in range(int(cx - rx) - 1, int(cx + rx) + 2):
            if ((x - cx) / max(rx, .5)) ** 2 + ((y - cy) / max(ry, .5)) ** 2 <= 1.0: px(c, x, y, col)


def ring(c, cx, cy, rx, ry, col, th=1.0):
    for y in range(int(cy - ry) - 1, int(cy + ry) + 2):
        for x in range(int(cx - rx) - 1, int(cx + rx) + 2):
            d = ((x - cx) / max(rx, .5)) ** 2 + ((y - cy) / max(ry, .5)) ** 2
            if (1 - th / max(rx, ry)) ** 2 <= d <= 1.0: px(c, x, y, col)


def rust_drip(c, x, y, n, s=0):
    """녹물 줄 — 볼트·이음 밑에서 아래로 흐르는 1px 줄(위는 진하고 아래로 점점 성기다)."""
    for i in range(n):
        if i < 2 or rnd(x, y + i, s, 700 - i * 60): px(c, x, y + i, K('soil', -1) if i < n // 2 else K('soil', -2))


def hazard(c, x, y, w, h, ph=0):
    """노랑·검정 사선 띠(보선 표시)."""
    for j in range(h):
        for i in range(w):
            px(c, x + i, y + j, K('kii', 0) if ((i + j + ph) // 2) % 2 == 0 else K('sumi', 0))


# ══ 바닥 ═════════════════════════════════════════════════════════════════════
def _crack(c, x, y, n, s, col):
    for i in range(n):
        px(c, x % c.w, y % c.h, col)
        d = hs(i, s, 77) % 3
        x += 1
        if d == 0: y += 1
        elif d == 1: y -= 1


@R.floor('ug-tunnel-floor', '터널 보선 통로 바닥(어두운 콘크리트·자갈)', cols=4, rows=4, tags=T_TAGS,
         desc='지하철 터널 보선 통로의 어두운 콘크리트 바닥. 자갈·모래 알갱이, 2m 이음 줄눈, 가는 금, 기름·물 얼룩. 일반 역 바닥보다 두 단 어둡다.')
def _tunnel_floor(c):
    rc(c, 0, 0, c.w, c.h, K('conc', -2))
    for y in range(c.h):
        for x in range(c.w):
            if rnd(x, y, 31, 70): px(c, x, y, K('conc', -3))
            elif rnd(x, y, 32, 30): px(c, x, y, K('conc', -1))
            elif rnd(x, y, 33, 14): px(c, x, y, K('yoru', 0))
    for y in range(0, c.h, 32): hl(c, 0, y, c.w, K('conc', -3))
    for x in range(0, c.w, 32): vl(c, x, 0, c.h, K('conc', -3))
    # 기름·물 얼룩(낮은 대비 덩이) 둘
    for (cx, cy, rx, ry) in ((19, 44, 6, 3), (50, 13, 4, 2)):
        for y in range(cy - ry, cy + ry + 1):
            for x in range(cx - rx, cx + rx + 1):
                if ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1 and rnd(x, y, 34, 820): px(c, x, y, K('yoru', 0))
    _crack(c, 6, 20, 9, 1, K('conc', -3)); _crack(c, 37, 51, 12, 2, K('conc', -3)); _crack(c, 40, 30, 6, 3, K('conc', -3))


@R.floor('ug-sewer-floor', '하수도 점검로 바닥(젖은 콘크리트)', cols=4, rows=4, tags=S_TAGS,
         desc='하수도 물길 옆 점검로의 젖은 콘크리트. 푸른 회색 물기 얼룩과 반짝이는 점, 물때 낀 이음 줄눈, 금. 어둡게.')
def _sewer_floor(c):
    rc(c, 0, 0, c.w, c.h, K('conc', -2))
    for y in range(c.h):
        for x in range(c.w):
            # 물기: 4px 덩이 해시로 넓은 얼룩
            wet = hs(x // 6, y // 5, 41) % 100 < 34 and rnd(x, y, 42, 760)
            if wet: px(c, x, y, K('tairu', 0))
            elif rnd(x, y, 43, 60): px(c, x, y, K('conc', -3))
            elif rnd(x, y, 44, 18): px(c, x, y, K('conc', -1))
    for y in range(c.h):
        for x in range(c.w):
            if hs(x // 6, y // 5, 41) % 100 < 34 and rnd(x, y, 45, 25): px(c, x, y, K('conc', 0))    # 물기 반짝임
    for y in range(0, c.h, 32):
        for x in range(c.w):
            if rnd(x, y, 46, 650): px(c, x, y, K('conc', -3))
    for x in range(16, c.w, 64):
        for y in range(c.h):
            if rnd(x, y, 47, 650): px(c, x, y, K('conc', -3))
    _crack(c, 3, 41, 10, 4, K('conc', -3)); _crack(c, 44, 9, 8, 5, K('conc', -3))


@R.floor('ug-room-floor', '기계실·대피실 바닥(닳은 녹회색 칠)', cols=4, rows=4, tags=RM_TAGS + T_TAGS,
         desc='기계실·대피실의 녹회색 에폭시 칠 콘크리트 바닥. 칠이 닳아 회색 콘크리트가 드러난 자리, 긁힘, 검은 얼룩.')
def _room_floor(c):
    rc(c, 0, 0, c.w, c.h, K('lino', -1))
    for y in range(c.h):
        for x in range(c.w):
            worn = hs(x // 5, y // 4, 51) % 100 < 16 and rnd(x, y, 52, 700)
            if worn: px(c, x, y, K('conc', -2))
            elif rnd(x, y, 53, 40): px(c, x, y, K('lino', -2))
            elif rnd(x, y, 54, 22): px(c, x, y, K('lino', 0))
    for y in range(0, c.h, 32): hl(c, 0, y, c.w, K('lino', -2))
    for x in range(0, c.w, 32): vl(c, x, 0, c.h, K('lino', -2))
    for (x, y, n) in ((9, 27, 7), (40, 46, 5), (28, 8, 6)):       # 긁힘
        for i in range(n): px(c, x + i, y + (i // 3), K('lino', 0))
    for (cx, cy) in ((52, 24), (14, 54)):
        for y in range(cy - 2, cy + 3):
            for x in range(cx - 3, cx + 4):
                if abs(x - cx) + abs(y - cy) <= 3: px(c, x, y, K('yoru', 0))


# ══ 벽면(2줄 = 32px) ═════════════════════════════════════════════════════════
@R.wall('ug-tunnel-wall', '터널 벽(세그먼트 판·케이블 줄)', cols=4, tags=T_TAGS,
        desc='둥근 터널의 콘크리트 세그먼트 판(2m 이음·볼트 구멍) 위로 검은 케이블 두 다발이 쇠 받침에 걸려 가로로 지난다. 아래는 물때, 녹물 줄, 바닥 배수 홈.')
def _tunnel_wall(c):
    W = c.w
    rc(c, 0, 0, W, 18, K('conc', -3))
    rc(c, 0, 18, W, 10, K('yoru', 0))
    for y in range(28):
        for x in range(W):
            if rnd(x, y, 61, 60): px(c, x, y, K('yoru', 0) if y < 18 else K('yoru', -1))
            elif y < 18 and rnd(x, y, 62, 22): px(c, x, y, K('conc', -2))
    # 세그먼트 이음: 32px 마다 세로(왼쪽 밝은 테), y17 가로
    for x in range(0, W, 32):
        vl(c, x, 0, 28, K('yoru', -2)); vl(c, x + 1, 0, 28, K('conc', -2))
    hl(c, 0, 17, W, K('yoru', -2)); hl(c, 0, 18, W, K('conc', -3))
    # 볼트 구멍(이음 양옆) + 녹물 줄
    for x0 in range(0, W, 32):
        for (bx, by) in ((x0 + 4, 2), (x0 + 27, 2), (x0 + 4, 21), (x0 + 27, 21)):
            rc(c, bx, by, 2, 2, K('yoru', -2)); px(c, bx, by, K('sumi', 0)); px(c, bx + 1, by + 1, K('conc', -2))
            rust_drip(c, bx + 1, by + 2, 4 + hs(bx, by, 63) % 5, 64)
    # 케이블 두 다발 — 굵은 검은 줄, 윗면 반짝, 아래 그늘(받침 16px 마다)
    for (y0, n) in ((6, 4), (12, 3)):
        for i in range(n):
            hl(c, 0, y0 + i, W, (K('yoru', -1), K('sumi', 1), K('yoru', -2), K('sumi', 0))[i % 4])
        hl(c, 0, y0 + n, W, K('sumi', 0)); hl(c, 0, y0 + n + 1, W, K('yoru', -1))
        for x in range(W):
            if rnd(x, y0, 65, 420): px(c, x, y0, K('yoru', 1))
            if rnd(x, y0 + 2, 66, 120): px(c, x, y0 + 2, K('yoru', 0))
    for x in range(8, W, 16):
        vl(c, x - 1, 5, 12, OL); vl(c, x, 5, 12, K('tekko', 0)); vl(c, x + 1, 5, 12, K('tekko', -2)); px(c, x, 5, K('tekko', 2))
        for y0 in (6, 12): px(c, x, y0 - 1, K('tekko', 1))
        rust_drip(c, x + 1, 17, 5, 66)
    # 물때 줄(아래 판)·백화
    for x in range(W):
        if hs(x, 0, 67) % 9 == 0:
            for y in range(19, 19 + 3 + hs(x, 1, 67) % 7): px(c, x, y, K('yoru', -2))
        if hs(x, 0, 68) % 23 == 0:
            for y in range(20, 24 + hs(x, 2, 68) % 3): px(c, x, y, K('conc', -2))
    # 바닥 배수 홈
    hl(c, 0, 28, W, K('conc', -2)); hl(c, 0, 29, W, K('yoru', -1)); rc(c, 0, 30, W, 2, K('yoru', -3))


@R.wall('ug-sewer-wall', '하수도 벽(이끼 낀 벽돌·콘크리트 아치)', cols=4, tags=S_TAGS,
        desc='위는 물때 줄이 흘러내린 콘크리트 아치, 아래는 장마다 톤이 다른 낡은 벽돌(밝은 회색 줄눈). 물높이 자국 줄 아래로 초록 이끼, 맨 아래 미끈한 물때.')
def _sewer_wall(c):
    W = c.w
    rc(c, 0, 0, W, 13, K('conc', -2))
    for y in range(13):
        for x in range(W):
            if rnd(x, y, 71, 50): px(c, x, y, K('conc', -3))
            elif rnd(x, y, 72, 12): px(c, x, y, K('conc', -1))
    for x in range(W):
        if hs(x, 2, 73) % 7 == 0:
            for y in range(0, 4 + hs(x, 3, 73) % 9): px(c, x, y, K('yoru', 0) if y % 3 else K('tairu', -1))
    hl(c, 0, 12, W, K('conc', -1)); hl(c, 0, 13, W, K('yoru', 0))          # 아치 받침 테
    # 벽돌 14..27: 줄 4px(3 벽돌 + 1 줄눈), 엇갈림 8px
    for j, y0 in enumerate(range(14, 28, 4)):
        hl(c, 0, y0 + 3, W, K('conc', -3))
        off = 0 if j % 2 == 0 else 4
        for bx in range(-off, W, 8):
            t = (-1, 0, -1, -2, -1)[hs(bx // 8 + 9, j, 74) % 5]
            for yy in range(y0, y0 + 3):
                for xx in range(bx, bx + 7):
                    if 0 <= xx < W: px(c, xx, yy, K('renga', t))
            for xx in range(bx, bx + 7):
                if 0 <= xx < W: px(c, xx, y0, K('renga', t + 1))          # 장 윗면 밝은 줄
            if 0 <= bx + 7 < W: vl(c, bx + 7, y0, 3, K('conc', -3))
    # 물높이 자국 + 이끼(어두운 초록, 성기게) + 맨 아래 물때
    for x in range(W):
        yy = 21 + (hs(x // 5, 0, 75) % 2)
        px(c, x, yy, K('yoru', 0)); px(c, x, yy + 1, K('kinari', -2) if rnd(x, 1, 76, 250) else K('renga', -2))
        for y in range(yy + 2, 28):
            if hs(x // 2, y // 2, 77) % 100 < 14 + (y - yy) * 5: px(c, x, y, K('ki', -2) if rnd(x, y, 78, 250) else K('ki', -3))
    rc(c, 0, 28, W, 4, K('yoru', -2)); hl(c, 0, 28, W, K('ki', -3))
    for x in range(W):
        if rnd(x, 0, 79, 350): vl(c, x, 29, 1 + hs(x, 4, 79) % 3, K('ki', -3))


@R.wall('ug-room-wall', '기계실 벽(칠 벗겨진 블록)', cols=4, tags=RM_TAGS,
        desc='회색 콘크리트 블록 벽. 아랫단은 바랜 녹회색 칠(군데군데 벗겨짐), 녹물 줄, 검은 걸레받이. 기계실·대피실·계전실.')
def _room_wall(c):
    W = c.w
    rc(c, 0, 0, W, 17, K('conc', -1))
    for j, y0 in enumerate(range(0, 17, 6)):
        hl(c, 0, y0 + 5, W, K('conc', -2))
        for bx in range(8 if j % 2 else 0, W, 16): vl(c, bx, y0, 5, K('conc', -2))
    for y in range(17):
        for x in range(W):
            if rnd(x, y, 81, 30): px(c, x, y, K('conc', -2))
    hl(c, 0, 17, W, K('lino', 0)); rc(c, 0, 18, W, 10, K('lino', -1))
    for y in range(18, 28):
        for x in range(W):
            if hs(x // 4, y // 3, 82) % 100 < 14: px(c, x, y, K('conc', -2))           # 벗겨진 칠
            elif rnd(x, y, 83, 40): px(c, x, y, K('lino', -2))
    for x in (11, 37, 54):
        rust_drip(c, x, 6, 14, 84)
    rc(c, 0, 28, W, 4, K('yoru', -1)); hl(c, 0, 28, W, K('yoru', 0)); hl(c, 0, 31, W, K('yoru', -2))


# ══ 탁자(자동 타일 — 전부 막힘) ═══════════════════════════════════════════════
def _rail_h(c, y, W):
    hl(c, 0, y - 1, W, OL); hl(c, 0, y, W, K('tekko', 2)); hl(c, 0, y + 1, W, K('tekko', 0))
    hl(c, 0, y + 2, W, K('tekko', -2)); hl(c, 0, y + 3, W, OL)


def _gravel(c, x0, y0, w, h):
    rc(c, x0, y0, w, h, K('conc', -3))
    for y in range(y0, y0 + h):
        for x in range(x0, x0 + w):
            if rnd(x % 16, y % 16, 91, 200): px(c, x, y, K('yoru', 0))
            elif rnd(x % 16, y % 16, 92, 110): px(c, x, y, K('conc', -2))
            elif rnd(x % 16, y % 16, 93, 40): px(c, x, y, K('yoru', -2))


@R.table('ug-track', '터널 선로(자갈·침목·레일)', tags=T_TAGS,
         desc='터널 바닥 홈에 깐 어두운 자갈과 콘크리트 침목, 레일 두 줄. 북쪽 끝은 홈 벽면, 가운데 배수 홈. 보선 통로 옆에 2줄 띠로 깐다. 전부 막힘 — 건너는 곳은 ug-track-crossing.')
def _track(c, w, h):
    W, H = w * 16, h * 16
    if w == 1 and h > 1:                                     # 세로 선로(남북)
        _gravel(c, 0, 0, W, H)
        for y in range(0, H, 16):
            for sy in (2, 10): rc(c, 0, y + sy, W, 4, K('conc', -2)); hl(c, 0, y + sy, W, K('conc', -1)); hl(c, 0, y + sy + 3, W, K('yoru', 0))
        for x in (3, 11):
            vl(c, x - 1, 0, H, OL); vl(c, x, 0, H, K('tekko', 2)); vl(c, x + 1, 0, H, K('tekko', -1)); vl(c, x + 2, 0, H, OL)
        return
    _gravel(c, 0, 0, W, H)
    for x in range(0, W, 16):
        for sx in (1, 9):
            rc(c, x + sx, 3, 5, H - 5, K('conc', -2)); vl(c, x + sx, 3, H - 5, K('conc', -1)); vl(c, x + sx + 4, 3, H - 5, K('yoru', 0))
    if h == 1:
        hl(c, 0, 0, W, K('conc', -1)); rc(c, 0, 1, W, 2, K('yoru', -1))
        _rail_h(c, 5, W); _rail_h(c, 10, W); hl(c, 0, 15, W, K('yoru', -2))
        return
    hl(c, 0, 0, W, K('conc', -1)); rc(c, 0, 1, W, 2, K('conc', -3)); hl(c, 0, 3, W, K('yoru', -2))     # 북쪽 홈 벽 + 그늘
    _rail_h(c, 10, W); _rail_h(c, H - 12, W)
    if h >= 3:
        for y in range(18, H - 18):
            if y % 16 == 7: hl(c, 0, y, W, K('yoru', -2)); hl(c, 0, y + 1, W, K('yoru', -1))           # 가운데 배수 홈
    rc(c, 0, H - 3, W, 3, K('yoru', -2)); hl(c, 0, H - 3, W, K('yoru', -1))


def _water(c, W, H, vert, base, ripple, hi, seed):
    """어두운 물: 바탕 한 색 + 흐름 방향 물결 줄(칸 안에서 끝나 이음매 없음) + 드문 반짝·거품. 무작위 잡티 없음."""
    rc(c, 0, 0, W, H, base)
    for cy in range(0, H, 16):
        for cx in range(0, W, 16):
            cs = seed * 31 + (cx // 16) * 7 + (cy // 16) * 13           # 칸마다 다른 물결(조각 L/M/R·T/M/B 가 서로 달라 반복이 덜 보인다)
            for k in range(3 + hs(cx, cy, seed) % 2):
                a = hs(k, cs, 131) % 9; b = hs(k, cs, 132) % 14 + 1; n = 3 + hs(k, cs, 133) % 5
                for i in range(n):
                    x, y = (cx + a + i, cy + b) if not vert else (cx + b, cy + a + i)
                    if (not vert and a + i < 16) or (vert and a + i < 16):
                        px(c, x, y, ripple)
                        if i == 0 and k % 2 == 0: px(c, x, y, hi)
            for k in range(1 if hs(cx, cy, seed + 1) % 3 == 0 else 0):           # 거품은 세 칸에 하나 꼴
                fx, fy = hs(k, cs, 134) % 14 + 1, hs(k, cs, 135) % 14 + 1
                px(c, cx + fx, cy + fy, K('kinari', -2)); px(c, cx + fx + 1, cy + fy, K('lino', -1))


@R.table('ug-channel', '하수 물길(어두운 물)', tags=S_TAGS,
         desc='점검로 사이로 흐르는 하수 물길. 북쪽 홈 벽(물때·이끼), 탁한 녹회색 물, 흐름 줄과 더러운 거품. 가로 2줄 띠 또는 세로 1칸 줄로 깐다. 전부 막힘 — 건너는 곳은 ug-grate.')
def _channel(c, w, h):
    W, H = w * 16, h * 16
    vert = (w == 1 and h > 1)
    _water(c, W, H, vert, K('garasu', -2), K('garasu', -1), K('tairu', 0), 1)
    if vert:
        vl(c, 0, 0, H, K('conc', -3)); vl(c, 1, 0, H, K('garasu', -3)); vl(c, W - 1, 0, H, K('conc', -3))
        hl(c, 0, 0, W, K('conc', -1)); rc(c, 0, 1, W, 3, K('conc', -3)); hl(c, 0, 4, W, K('garasu', -3))
        return
    hl(c, 0, 0, W, K('conc', -1))
    rc(c, 0, 1, W, 4, K('conc', -3))
    for x in range(W):
        if rnd(x % 16, 2, 105, 260): px(c, x, 4, K('ki', -3))
        if rnd(x % 16, 1, 106, 200): px(c, x, 2, K('yoru', 0))
    hl(c, 0, 5, W, K('garasu', -3)); hl(c, 0, 6, W, K('garasu', -3))
    hl(c, 0, H - 1, W, K('garasu', -3))


@R.table('ug-tank', '합류 수조(깊은 물)', tags=S_TAGS + ('합류 수조', '수조'),
         desc='여러 물길이 모이는 사각 콘크리트 합류 수조. 네 둘레 홈 벽(북쪽이 깊게 보인다)과 테두리 턱, 안은 짙은 물에 소용돌이 흐름 줄과 거품. 아무 크기로 깐다. 전부 막힘.')
def _tank(c, w, h):
    W, H = w * 16, h * 16
    _water(c, W, H, False, K('garasu', -3), K('garasu', -2), K('garasu', -1), 7)
    rc(c, 0, 0, W, 2, K('conc', -1)); hl(c, 0, 0, W, K('conc', 0))
    rc(c, 0, 2, W, 6, K('conc', -3)); hl(c, 0, 7, W, K('yoru', -1))
    for x in range(W):
        if rnd(x % 16, 3, 124, 260): px(c, x, 6, K('ki', -3))
        if rnd(x % 16, 4, 125, 160): vl(c, x, 2, 3, K('yoru', 0))
    rc(c, 0, 0, 2, H, K('conc', -1)); vl(c, 0, 0, H, K('conc', 0)); vl(c, 2, 8, H - 8, K('conc', -3)); vl(c, 3, 8, H - 8, K('garasu', -3))
    rc(c, W - 2, 0, 2, H, K('conc', -2)); vl(c, W - 1, 0, H, K('conc', -3))
    hl(c, 0, H - 2, W, K('conc', -1)); hl(c, 0, H - 1, W, K('conc', -3))


# ══ 지하철 터널 가구 ═══════════════════════════════════════════════════════════
@R.obj('ug-track-crossing', '선로 건널목 판(보선용)', w=1, h=2, kind='flat', use=('walk',), tags=T_TAGS + ('건널목',),
       place='2줄 선로(ug-track) 사이를 1칸 비우고 그 틈 위·아래 두 칸에 한 장', pair=('ug-track', 'ug-walkway-rail'),
       desc='선로 위에 깐 보선원용 나무 건널목 판(1×2). 레일이 판 사이로 이어지고 양 끝에 노랑·검정 표시. 밟고 선로를 건넌다 — 선로 양쪽 통로를 고리로 잇는다.')
def _crossing(c):
    _gravel(c, 0, 0, 16, 32)
    hl(c, 0, 0, 16, K('conc', -1)); rc(c, 0, 1, 16, 2, K('conc', -3))
    for y in range(3, 30, 4):
        rc(c, 1, y, 14, 3, K('ita', -1)); hl(c, 1, y, 14, K('ita', 0)); px(c, 1, y + 1, K('ita', 0)); hl(c, 1, y + 3, 14, K('yoru', -1))
        if rnd(y, 0, 111, 500): px(c, 5 + hs(y, 1, 112) % 6, y + 1, K('ita', -2))
    for y in (10, 20):
        _rail_h(c, y, 16)
    vl(c, 0, 3, 27, K('sumi', 0)); vl(c, 15, 3, 27, K('sumi', 0))
    for y in range(3, 30):
        if (y // 2) % 2 == 0: px(c, 0, y, K('kii', 0)); px(c, 15, y, K('kii', 0))
    rc(c, 0, 29, 16, 3, K('yoru', -2)); hl(c, 0, 29, 16, K('yoru', -1))


@R.obj('ug-walkway-rail', '보선 통로 난간', w=1, h=1, up=8, kind='floor', use=('block',), tags=T_TAGS + ('난간',),
       place='선로(ug-track) 바로 남쪽 줄에 가로로 이어 붙인다 — 건널목 앞 칸만 비운다', pair=('ug-track', 'ug-track-crossing'),
       desc='선로와 보선 통로 사이의 쇠 파이프 난간 한 칸(높이 1.1m). 회색 기둥(머리에 노란 반사띠)에 회색 레일 두 줄, 기둥 밑 받침판, 녹물. 이어 붙여 선로 쪽을 막는다. 막힘.')
def _rail(c):
    for y, (a, b, d) in ((9, (2, 0, -2)), (18, (1, -1, -2))):
        hl(c, 0, y - 1, 16, OL); hl(c, 0, y, 16, K('tekko', a)); hl(c, 0, y + 1, 16, K('tekko', b)); hl(c, 0, y + 2, 16, K('tekko', d))
        if y == 9: hl(c, 0, y + 3, 16, OL)
    for x in range(16):
        if rnd(x, 10, 121, 160): px(c, x, 10, K('soil', -1))                 # 레일 녹 점
    vl(c, 6, 8, 20, OL); vl(c, 9, 8, 20, OL)
    vl(c, 7, 12, 15, K('tekko', 1)); vl(c, 8, 12, 15, K('tekko', -2))
    vl(c, 7, 9, 3, K('kii', 1)); vl(c, 8, 9, 3, K('kii', -1))                 # 기둥 머리 노란 반사띠
    rust_drip(c, 8, 21, 4, 122)
    rc(c, 5, 26, 6, 2, K('tekko', 0)); hl(c, 5, 26, 6, K('tekko', 1)); outline(c, 4, 25, 8, 4, OL)
    hl(c, 4, 29, 8, K('yoru', -1))


@R.obj('ug-signal', '터널 신호기', w=1, h=1, up=16, kind='floor', use=('block',), tags=T_TAGS + ('신호기',),
       place='선로 옆 보선 통로 끝·건널목 옆, 선로 바로 북쪽 줄이나 난간 줄 — 통로 한가운데는 피한다', pair=('ug-track', 'ug-cable-rack'),
       desc='낮은 기둥 위 검은 판에 등 두 개 — 위 빨강 불이 켜지고 아래 초록은 꺼진 터널 신호기(1.6m). 등마다 검은 차양, 콘크리트 받침. 막힘.')
def _signal(c):
    rc(c, 3, 2, 10, 14, K('yoru', -3)); outline(c, 2, 1, 12, 16, OL)
    hl(c, 3, 2, 10, K('tekko', 0)); hl(c, 3, 3, 10, K('tekko', -1))                       # 판 윗면
    for (cy, lit) in ((7, True), (13, False)):
        hl(c, 4, cy - 3, 8, K('sumi', 1)); px(c, 4, cy - 2, K('sumi', 1)); px(c, 11, cy - 2, K('sumi', 1))    # 차양
        disc(c, 7.5, cy, 2.6, 2.2, K('sumi', 0))
        if lit:
            disc(c, 7.5, cy, 2, 1.6, K('aka', 1)); px(c, 7, cy - 1, K('aka', 2)); px(c, 6, cy, K('aka', 2)); px(c, 9, cy + 1, K('aka', 0))
        else:
            disc(c, 7.5, cy, 2, 1.6, K('midori', -2)); px(c, 6, cy - 1, K('midori', -1))
    rc(c, 7, 17, 2, 9, K('tekko', -1)); vl(c, 7, 17, 9, K('tekko', 0)); vl(c, 6, 17, 9, OL); vl(c, 9, 17, 9, OL)
    rust_drip(c, 8, 18, 5, 131)
    rc(c, 4, 26, 8, 3, K('conc', -1)); hl(c, 4, 26, 8, K('conc', 0)); hl(c, 4, 28, 8, K('conc', -3)); outline(c, 3, 25, 10, 5, OL)
    hl(c, 3, 30, 11, K('yoru', -1))


@R.obj('ug-cable-rack', '케이블 선반', w=2, h=1, up=16, kind='wall', use=('block',), tags=T_TAGS + ('케이블',),
       place='터널·기계실 북쪽 벽 바로 아래 줄. 대피 홈·신호기 사이에 2~3개', pair=('ug-emergency-phone', 'ug-refuge-niche'),
       desc='벽에 붙인 쇠 받침 두 개에 3단 케이블 선반(2칸). 단마다 검은·회색 케이블 다발이 놓이고 한 가닥은 아래로 처진다. 받침 밑 녹물 줄. 막힘.')
def _cable_rack(c):
    for x in (2, 27):
        rc(c, x, 1, 3, 29, K('tekko', -1)); vl(c, x, 1, 29, K('tekko', 1)); vl(c, x + 2, 1, 29, K('tekko', -3))
        outline(c, x - 1, 0, 5, 31, OL)
        rust_drip(c, x + 1, 30, 2, 141)
    for i, y in enumerate((4, 13, 22)):
        rc(c, 1, y + 4, 30, 2, K('tekko', 0)); hl(c, 1, y + 4, 30, K('tekko', 2)); hl(c, 1, y + 6, 30, OL)       # 선반 판
        hl(c, 1, y + 7, 30, K('yoru', -2))                                                                      # 선반 밑 그늘
        cols = (K('sumi', 1), K('yoru', -1), K('conc', -2), K('yoru', -2))
        for k in range(4):
            yy = y + k
            for x in range(5, 27):
                col = cols[(k + i) % 4]
                px(c, x, yy, col)
            for x in range(5, 27, 4 + k):
                if rnd(x, yy, 142, 500): px(c, x, yy, K('yoru', 1) if k < 2 else K('yoru', 0))                 # 케이블 반짝
        hl(c, 5, y - 1, 22, OL)
        sag = 9 + 7 * i
        for k, dy in enumerate((0, 1, 2, 2, 2, 1, 0)):
            px(c, sag + k, y + 7 + dy, K('sumi', 1)); px(c, sag + k, y + 8 + dy, K('yoru', -2))
    hl(c, 0, 31, 32, K('yoru', -2))


@R.obj('ug-emergency-phone', '터널 비상 전화함', w=1, kind='hang', hrows=2, use=('search',), tags=T_TAGS + ('비상 전화',),
       place='터널 북쪽 벽면 윗줄, 대피 홈·케이블 선반 옆', pair=('ug-refuge-niche', 'ug-light-emergency'),
       desc='벽에 붙은 바랜 크림색 비상 전화함. 위에 빨간 표시등(켜짐), 빨간 띠, 문 안쪽에 검은 수화기 모양 덩이, 손잡이. 위로 쇠 배관. 조사하면 통화·단서.')
def _ephone(c):
    vl(c, 7, 0, 5, K('tekko', -1)); vl(c, 8, 0, 5, K('tekko', -3))
    rc(c, 5, 3, 6, 3, K('aka', 0)); hl(c, 6, 3, 4, K('aka', 2)); px(c, 6, 4, K('aka', 1)); outline(c, 4, 2, 8, 5, OL)
    rc(c, 3, 7, 10, 19, K('kinari', -1)); hl(c, 3, 7, 10, K('kinari', 0)); hl(c, 3, 8, 10, K('kinari', 1)); vl(c, 3, 7, 19, K('kinari', 0))
    vl(c, 12, 8, 18, K('kinari', -2)); outline(c, 2, 6, 12, 21, OL)
    rc(c, 4, 11, 8, 2, K('aka', -1)); hl(c, 4, 11, 8, K('aka', 0))
    outline(c, 4, 13, 8, 12, K('kinari', -2))
    rc(c, 5, 15, 2, 7, K('sumi', 0)); rc(c, 5, 15, 4, 2, K('sumi', 0)); rc(c, 5, 20, 4, 2, K('sumi', 0)); px(c, 5, 15, K('yoru', 0))
    rc(c, 10, 17, 1, 3, K('tekko', 2))
    for (x, y) in ((4, 24), (11, 23), (7, 25)): px(c, x, y, K('soil', -1))                # 녹·때
    rust_drip(c, 11, 27, 4, 151)
    hl(c, 3, 27, 10, K('conc', -3))


@R.obj('ug-refuge-niche', '터널 대피 홈', w=1, h=1, up=32, kind='wall', use=('search', 'block'), tags=T_TAGS + ('대피 홈',),
       place='터널 북쪽 벽 바로 아래 줄, 케이블 선반 사이에 4~8칸 간격으로 하나씩 — 막다른 통로 끝에 두면 조사 자리', pair=('ug-cable-rack', 'ug-emergency-phone'),
       desc='터널 벽에 파인 1칸 폭 대피 홈(待避所). 콘크리트 테두리 안쪽이 어둡게 들어가고 흰 반사 띠, 바닥에 한 단 높은 턱과 고인 물. 들어가 서지 않고 조사(숨긴 물건) 자리로 쓴다. 막힘.')
def _niche(c):
    rc(c, 2, 3, 12, 38, K('yoru', -2))
    for y in range(3, 41):
        t = -1 if y < 12 else -2 if y < 30 else -3
        for x in range(2, 14):
            if x < 8 - (y - 3) // 6 and y < 24: px(c, x, y, K('yoru', t + 1) if rnd(x, y, 161, 300) else K('yoru', t))
            else: px(c, x, y, K('yoru', t))
    for x in range(2, 14):
        px(c, x, 3, K('sumi', 1)); px(c, x, 4, K('yoru', -3))
    px(c, 2, 4, K('conc', -1)); px(c, 13, 4, K('conc', -3))
    rc(c, 0, 0, 16, 3, K('conc', -1)); hl(c, 0, 0, 16, OL); hl(c, 0, 1, 16, K('conc', 0)); hl(c, 0, 2, 16, K('conc', -2))
    rc(c, 0, 3, 2, 40, K('conc', -1)); vl(c, 0, 0, 44, OL); vl(c, 1, 3, 40, K('conc', 0))
    rc(c, 14, 3, 2, 40, K('conc', -3)); vl(c, 15, 0, 44, OL)
    for y in range(8, 40, 6): px(c, 1, y, K('shiro', 0)); px(c, 1, y + 1, K('shiro', 0)); px(c, 14, y, K('shiro', -2)); px(c, 14, y + 1, K('shiro', -2))
    rust_drip(c, 4, 5, 9, 162); rust_drip(c, 11, 5, 6, 163)
    rc(c, 2, 36, 12, 3, K('conc', -2)); hl(c, 2, 36, 12, K('conc', -1)); hl(c, 2, 39, 12, K('conc', -3))     # 바닥 턱 윗면
    rc(c, 2, 40, 12, 3, K('conc', -3)); hl(c, 2, 42, 12, OL)
    rc(c, 5, 37, 5, 2, K('tairu', -1)); px(c, 6, 37, K('tairu', 1))                                       # 고인 물
    rc(c, 0, 43, 16, 2, K('conc', -2)); hl(c, 0, 43, 16, K('conc', -1)); hl(c, 0, 45, 16, OL); hl(c, 0, 46, 16, K('yoru', -1))


@R.obj('ug-maint-cart', '보선 수레(토롯코)', w=2, h=1, up=10, kind='floor', use=('search', 'block'), tags=T_TAGS + ('보선 수레',),
       place='보선 통로 넓은 곳·분기부 한쪽, 선로 옆 바닥', pair=('ug-item-toolbox', 'ug-track'),
       desc='노란 칠이 바랜 보선용 손수레(2칸). 줄무늬 철판 짐칸 위에 회색 레일 토막 묶음, 앞면 노랑·검정 사선, 작은 검은 바퀴 넷, 왼쪽 끝 손잡이. 막힘.')
def _cart(c):
    rc(c, 2, 2, 2, 16, K('tekko', 0)); vl(c, 2, 2, 16, K('tekko', 2)); hl(c, 1, 1, 8, OL); rc(c, 2, 2, 7, 2, K('tekko', 1)); hl(c, 2, 2, 7, K('tekko', 2))
    vl(c, 1, 1, 18, OL); vl(c, 4, 4, 14, OL)
    rc(c, 2, 11, 28, 9, K('tekko', 0))
    for y in range(12, 19):
        for x in range(3, 29):
            if (x + 2 * y) % 6 == 0: px(c, x, y, K('tekko', 1)); px(c, x + 1, y, K('tekko', -1))
    hl(c, 2, 11, 28, K('kii', 1)); vl(c, 2, 11, 9, K('kii', 1)); vl(c, 29, 11, 9, K('kii', -1))
    rc(c, 13, 9, 14, 6, K('tekko', 1)); hl(c, 13, 9, 14, K('tekko', 3)); hl(c, 13, 11, 14, K('tekko', 0)); hl(c, 13, 13, 14, K('tekko', -1))
    outline(c, 12, 8, 16, 8, OL); vl(c, 19, 8, 8, K('soil', -1)); vl(c, 20, 8, 8, K('soil', -1))
    rc(c, 2, 20, 28, 5, K('kii', 0)); hl(c, 2, 20, 28, K('kii', 1)); hl(c, 2, 24, 28, K('kii', -2))
    hazard(c, 6, 21, 20, 3)
    for x in range(2, 30):
        if rnd(x, 22, 171, 120): px(c, x, 22 + hs(x, 1, 171) % 2, K('soil', -1))
    outline(c, 1, 10, 30, 16, OL)
    for wx in (5, 23):
        disc(c, wx + 2, 27, 2.6, 2.4, K('sumi', 0)); px(c, wx + 2, 27, K('tekko', 1)); px(c, wx + 1, 26, K('tekko', -1))
    hl(c, 2, 30, 28, K('yoru', -1)); hl(c, 4, 31, 24, K('yoru', 0))


@R.obj('ug-fan', '터널 환기팬', w=2, h=1, up=16, kind='wall', use=('block',), tags=T_TAGS + ('환기 기계실', '환기팬'),
       place='환기 기계실·터널 북쪽 벽 바로 아래 줄', pair=('ug-panel', 'ug-light-off'),
       desc='벽에 박힌 사각 철 틀 속 큰 환기팬(지름 1.6m). 틀 윗면, 날개 넷과 가운데 축, 앞 보호 살, 볼트 밑 녹물 줄. 지금은 멈춰 있다. 막힘.')
def _fan(c):
    rc(c, 1, 1, 30, 29, K('tekko', -1)); outline(c, 0, 0, 32, 31, OL)
    rc(c, 1, 1, 30, 4, K('tekko', 0)); hl(c, 1, 1, 30, K('tekko', 1)); hl(c, 1, 5, 30, K('tekko', 2))
    hl(c, 1, 6, 30, K('tekko', -3)); hl(c, 1, 7, 30, K('tekko', -2))
    vl(c, 1, 6, 24, K('tekko', 0)); vl(c, 30, 6, 24, K('tekko', -3))
    cx, cy = 15.5, 18
    disc(c, cx, cy, 11.5, 10.5, K('yoru', -2))
    ring(c, cx, cy, 11.5, 10.5, K('tekko', -3), 1.5)
    import math
    for k in range(4):
        a0 = k * math.pi / 2 + 0.3
        for r in range(2, 11):
            for da in (-0.32, -0.16, 0, 0.16, 0.32):
                if r < 4 and abs(da) > 0.2: continue
                x = cx + r * math.cos(a0 + da); y = cy + r * 0.92 * math.sin(a0 + da)
                lit = math.cos(a0 + da + 2.4) > 0.2
                px(c, int(round(x)), int(round(y)), K('tekko', 1 if lit and r < 8 else 0 if lit else -1))
    disc(c, cx, cy, 2.2, 2, K('tekko', 1)); px(c, 15, 17, K('tekko', 3)); px(c, 16, 19, K('tekko', -2))
    for y in range(9, 29, 3):
        for x in range(5, 27):
            if ((x - cx) / 11) ** 2 + ((y - cy) / 10) ** 2 <= 1 and x % 2 == 0: px(c, x, y, K('tekko', -2))
    for (bx, by) in ((3, 9), (28, 9), (3, 27), (28, 27)):
        px(c, bx, by, K('tekko', 2)); px(c, bx, by + 1, K('sumi', 1)); rust_drip(c, bx, by + 2, 4 if by < 20 else 2, 181)
    hl(c, 0, 31, 32, K('yoru', -2))


@R.obj('ug-ladder-up', '터널 벽 사다리(위로)', w=1, h=1, up=32, kind='wall', walk=[(0, 0)], stairs='up', use=('travel',),
       tags=T_TAGS + ('사다리', '출구'), place='북쪽 벽 바로 아래 줄(벽 가구 자리) — 발칸에 위 맵으로 가는 links', pair=('ug-hatch-down', 'ug-light-emergency'),
       desc='벽을 타고 위 갱도로 오르는 쇠 사다리와 등 보호 고리. 꼭대기는 어두운 수직 갱 입구, 발밑에 노랑·검정 표시. 발칸에서 위로 올라가면 위 맵으로 이동.')
def _ladder(c):
    rc(c, 2, 0, 12, 9, K('sumi', 0)); hl(c, 2, 8, 12, K('yoru', -3)); outline(c, 1, 0, 14, 10, OL)
    hl(c, 1, 0, 14, K('conc', -1))
    for x in (3, 11):
        rc(c, x, 1, 2, 43, K('tekko', 0)); vl(c, x, 1, 43, K('tekko', 2)); vl(c, x + 1, 1, 43, K('tekko', -2))
        vl(c, x - 1, 6, 38, OL)
    vl(c, 13, 6, 38, OL)
    for y in range(4, 42, 4):
        hl(c, 5, y, 6, K('tekko', 2)); hl(c, 5, y + 1, 6, K('tekko', -2))
    for y in (8, 18, 28):                                        # 등 보호 고리
        hl(c, 0, y, 16, K('tekko', -1)); hl(c, 0, y + 1, 16, OL)
    for x in (0, 15):
        vl(c, x, 8, 22, K('tekko', -2))
    rust_drip(c, 4, 10, 6, 191); rust_drip(c, 12, 20, 5, 192)
    hazard(c, 1, 43, 14, 3); hl(c, 1, 46, 14, OL)


@R.obj('ug-hatch-down', '바닥 점검구(아래로 사다리)', w=1, h=1, kind='flat', use=('travel',), stairs='down',
       tags=T_TAGS + S_TAGS + ('점검구', '사다리'), place='기계실·점검실 바닥 한쪽, 벽에서 한 칸 떨어진 칸 — 그 칸에 아래 맵으로 가는 links', pair=('ug-ladder-up', 'ug-manhole-ladder'),
       desc='바닥에 뚫린 사각 점검구. 노랑·검정 테두리 안으로 쇠 사다리 가로대가 어둠 속으로 내려간다. 밟으면 아래 맵(터널 아래층·하수 본관)으로 이동.')
def _hatch(c):
    hazard(c, 0, 0, 16, 16, 1)
    rc(c, 2, 2, 12, 12, K('sumi', 0)); outline(c, 2, 2, 12, 12, OL)
    hl(c, 3, 3, 10, K('tekko', -2))
    for i, y in enumerate((5, 8, 11)):
        hl(c, 5, y, 6, K('tekko', 1 - i)); hl(c, 5, y + 1, 6, K('yoru', -2))
    vl(c, 4, 4, 9, K('tekko', -1)); vl(c, 11, 4, 9, K('tekko', -2))
    px(c, 2, 2, K('kii', 1)); px(c, 13, 13, K('soil', -1))


@R.obj('ug-point-machine', '선로 전환기 상자', w=1, h=1, up=4, kind='floor', use=('switch', 'block'), tags=T_TAGS + ('분기', '전환기'),
       place='선로가 갈라지는 곳 바로 옆 통로 줄', pair=('ug-signal', 'ug-track'),
       desc='선로 분기부 옆의 낮은 초록 철 상자(선로 전환기). 윗면 뚜껑과 볼트, 옆으로 나간 쇠 막대, 앞면 녹. 조작 자리로 쓴다. 막힘.')
def _point(c):
    rc(c, 2, 4, 12, 7, K('midori', -1)); hl(c, 2, 4, 12, K('midori', 0)); vl(c, 2, 4, 7, K('midori', 0))
    for (x, y) in ((4, 6), (11, 6), (4, 9), (11, 9)): px(c, x, y, K('midori', -2))
    rc(c, 2, 11, 12, 6, K('midori', -2)); hl(c, 2, 11, 12, K('midori', 0))
    for x in range(3, 13, 3): rust_drip(c, x, 12, 4, 201)
    outline(c, 1, 3, 14, 15, OL)
    rc(c, 14, 13, 2, 2, K('tekko', 0)); hl(c, 14, 13, 2, K('tekko', 2))
    hl(c, 2, 18, 13, K('yoru', -1))


@R.obj('ug-debris', '흩어진 잔해(종이·유리·콘크리트)', w=1, h=1, kind='flat', use=('walk',), tags=T_TAGS + S_TAGS + RM_TAGS + ('잔해',),
       place='통로·방 바닥 아무 데나, 넓은 곳에 드문드문(밟는다)', pair=('ug-trash-pile', 'ug-puddle'),
       desc='바닥에 흩어진 젖은 종이 몇 장, 반짝이는 유리 조각, 콘크리트 부스러기. 밟고 지나간다.')
def _debris(c):
    for (x, y, w, h, t) in ((2, 3, 4, 3, -1), (9, 9, 5, 3, -2), (4, 11, 3, 2, -2)):
        rc(c, x, y, w, h, K('kinari', t)); hl(c, x, y, w, K('kinari', t + 1)); hl(c, x, y + h, w, K('yoru', 0))
    for (x, y) in ((11, 3), (12, 4), (7, 7), (13, 13), (1, 14)):
        px(c, x, y, K('garasu', 2)); px(c, x + 1, y, K('garasu', 0))
    for (x, y) in ((8, 2), (14, 7), (3, 8), (10, 14), (6, 14), (12, 1)):
        px(c, x, y, K('conc', -1)); px(c, x, y + 1, K('yoru', 0))


# ══ 하수도 ═══════════════════════════════════════════════════════════════════
@R.obj('ug-grate', '쇠창살 다리(물길 위)', w=1, h=2, kind='flat', use=('walk',), tags=S_TAGS + ('다리', '쇠창살'),
       place='2줄 물길(ug-channel)을 1칸 비우고 그 틈 위·아래 두 칸에 한 장', pair=('ug-channel',),
       desc='물길 위에 걸친 녹슨 쇠창살 다리(1×2). 남북 쇠살 사이로 어두운 물이 보이고 양옆 테두리 철판. 밟고 물길을 건넌다.')
def _grate(c):
    _water(c, 16, 32, False, K('garasu', -2), K('garasu', -1), K('tairu', 0), 1)
    hl(c, 0, 0, 16, K('conc', -1)); rc(c, 0, 1, 16, 4, K('conc', -3)); rc(c, 0, 5, 16, 2, K('garasu', -3))
    for y in range(2, 32, 5):                                           # 가로 받침살(아래·어둡다)
        hl(c, 2, y, 12, K('tekko', -2)); hl(c, 2, y + 1, 12, K('sumi', 1))
    for x in range(4, 13, 3):                                          # 남북 쇠살(윗면 밝다)
        vl(c, x, 0, 32, K('tekko', 1)); vl(c, x + 1, 0, 32, K('tekko', -2))
        for y in range(0, 32):
            if rnd(x, y, 213, 140): px(c, x + (y % 2), y, K('soil', -1))
    for x0, a, b in ((0, 2, -1), (13, 0, -3)):
        rc(c, x0, 0, 3, 32, K('tekko', 0)); vl(c, x0, 0, 32, K('tekko', a)); vl(c, x0 + 2, 0, 32, K('tekko', b))
    vl(c, 0, 0, 32, OL); vl(c, 15, 0, 32, OL)
    for y in range(2, 30, 7): px(c, 1, y, K('tekko', 3)); px(c, 14, y + 3, K('sumi', 1))
    for y in range(0, 32):
        if rnd(1, y, 214, 150): px(c, 2, y, K('soil', -1))


@R.obj('ug-pipe-h', '큰 관(가로)', w=1, h=1, kind='floor', use=('block',), tags=S_TAGS + T_TAGS + ('관', '배관'),
       place='벽을 따라 또는 통로를 가로막아 가로로 이어 붙인다(이음 테가 1m 마다)', pair=('ug-pipe-v', 'ug-valve'),
       desc='바닥에 동서로 누운 지름 60cm 주철관 한 칸. 윗면 밝은 띠, 아래로 어두워지는 몸통, 칸 서쪽 끝 이음 테와 볼트, 녹 점. 이어 붙인다. 막힘.')
def _pipe_h(c):
    rows = (OL, K('tekko', 1), K('tekko', 0), K('tekko', -1), K('tekko', -1), K('tekko', -1), K('tekko', -2), K('tekko', -2), K('tekko', -3), OL)
    for i, col in enumerate(rows): hl(c, 0, 3 + i, 16, col)
    for x in range(16):
        for y in range(5, 11):
            if rnd(x, y, 221, 110): px(c, x, y, K('soil', -1) if y > 7 else K('soil', 0))
    rc(c, 0, 2, 3, 12, K('tekko', 0)); vl(c, 0, 2, 12, K('tekko', 1)); vl(c, 2, 2, 12, K('tekko', -3)); hl(c, 0, 1, 3, OL); hl(c, 0, 14, 3, OL)
    px(c, 1, 4, K('tekko', 2)); px(c, 1, 11, K('tekko', 2))
    rust_drip(c, 2, 13, 2, 222)
    hl(c, 0, 13, 16, K('yoru', -1)); hl(c, 3, 14, 13, K('yoru', 0))


@R.obj('ug-pipe-v', '큰 관(세로)', w=1, h=1, kind='floor', use=('block',), tags=S_TAGS + T_TAGS + ('관', '배관'),
       place='바닥에 남북으로 이어 붙인다 — 가로 관(ug-pipe-h)과 같은 굵기', pair=('ug-pipe-h',),
       desc='바닥에 남북으로 누운 주철관 한 칸. 왼쪽 밝은 띠, 오른쪽 어둡고 동남쪽 바닥에 그림자, 칸 북쪽 끝 이음 테. 이어 붙인다. 막힘.')
def _pipe_v(c):
    cols = (OL, K('tekko', 1), K('tekko', 0), K('tekko', -1), K('tekko', -1), K('tekko', -1), K('tekko', -2), K('tekko', -2), K('tekko', -3), OL)
    for i, col in enumerate(cols): vl(c, 3 + i, 0, 16, col)
    for y in range(16):
        for x in range(5, 11):
            if rnd(x, y, 231, 110): px(c, x, y, K('soil', -1))
    rc(c, 2, 0, 12, 3, K('tekko', 0)); hl(c, 2, 0, 12, K('tekko', 1)); hl(c, 2, 2, 12, K('tekko', -3)); vl(c, 1, 0, 3, OL); vl(c, 14, 0, 3, OL)
    vl(c, 13, 3, 13, K('yoru', -1)); vl(c, 14, 3, 13, K('yoru', 0))


@R.obj('ug-valve', '배관 밸브(빨간 손잡이)', w=1, kind='hang', hrows=2, use=('switch',), tags=S_TAGS + T_TAGS + ('밸브',),
       place='하수도·펌프실 북쪽 벽면 윗줄, 수문·펌프 옆', pair=('ug-sluice', 'ug-pump'),
       desc='벽을 타고 내려오는 쇠 배관에 붙은 밸브. 빨간 둥근 손잡이(살 넷), 밸브 몸통, 오른쪽 작은 흰 압력계, 아래로 녹물. 돌려서 물길·수문을 여닫는 장치로 쓴다.')
def _valve(c):
    rc(c, 6, 0, 4, 32, K('tekko', -1)); vl(c, 6, 0, 32, K('tekko', 1)); vl(c, 9, 0, 32, K('tekko', -3)); vl(c, 5, 0, 32, OL); vl(c, 10, 0, 32, OL)
    rc(c, 4, 15, 8, 6, K('tekko', 0)); hl(c, 4, 15, 8, K('tekko', 2)); outline(c, 3, 14, 10, 8, OL)
    rc(c, 7, 11, 2, 4, K('tekko', 1))
    ring(c, 7.5, 8, 6, 4, K('aka', 0), 1.6); ring(c, 7.5, 8, 6.6, 4.6, OL, 0.9)
    for (x, y) in ((3, 6), (4, 5), (5, 4)): px(c, x, y, K('aka', 1))
    hl(c, 3, 8, 10, K('aka', -1)); vl(c, 7, 4, 9, K('aka', -1)); vl(c, 8, 4, 9, K('aka', -2))
    disc(c, 7.5, 8, 1.4, 1.2, K('tekko', 2))
    disc(c, 13, 18, 2.3, 2.3, OL); disc(c, 13, 18, 1.5, 1.5, K('shiro', -1)); px(c, 13, 17, K('sumi', 0)); px(c, 12, 17, K('shiro', 0))
    rust_drip(c, 8, 22, 9, 241); rust_drip(c, 5, 22, 5, 242)
    for y in range(24, 32):
        if rnd(6, y, 243, 300): px(c, 7, y, K('soil', -1))


@R.obj('ug-manhole-ladder', '맨홀 사다리(지상으로)', w=1, h=1, up=32, kind='wall', walk=[(0, 0)], stairs='up', use=('travel',),
       tags=S_TAGS + ('맨홀', '사다리', '출구'), place='하수도 북쪽 벽 바로 아래 줄 — 발칸에 지상(또는 위 맵)으로 가는 links', pair=('ug-hatch-down', 'ug-valve'),
       desc='벽돌 벽에 박힌 ㄷ자 쇠 발판이 둥근 맨홀 수직 갱으로 오른다. 꼭대기 맨홀 뚜껑 구멍으로 희미한 빛 점. 발칸에서 올라가면 지상(위 맵)으로 나간다.')
def _manhole(c):
    disc(c, 7.5, 6.5, 7.5, 6.5, K('renga', -2)); disc(c, 7.5, 6.5, 6, 5, K('sumi', 0)); ring(c, 7.5, 6.5, 7.5, 6.5, OL, 1)
    for (x, y) in ((5, 3), (7, 2), (10, 3), (6, 6), (9, 5), (8, 8), (4, 6), (11, 7)): px(c, x, y, K('kinari', 0) if (x + y) % 2 else K('mado', 0))
    for i in range(3, 13):
        px(c, 1 + (i % 2), i, K('renga', -1)); px(c, 13 + (i % 2), i, K('renga', -3))
    for y in range(13, 44, 6):
        hl(c, 4, y, 8, K('tekko', 2)); hl(c, 4, y + 1, 8, K('tekko', -1))
        px(c, 3, y, OL); px(c, 12, y, OL); vl(c, 4, y + 2, 2, K('tekko', -2)); vl(c, 11, y + 2, 2, K('tekko', -3))
        hl(c, 5, y + 2, 6, K('yoru', -1))
        rust_drip(c, 6 + (y % 3), y + 3, 3, 251)
    rc(c, 3, 44, 10, 2, K('tairu', -1)); hl(c, 4, 44, 6, K('tairu', 0))


@R.obj('ug-sluice', '수문', w=2, h=1, up=16, kind='wall', use=('switch', 'block'), tags=S_TAGS + ('수문',),
       place='물길(ug-channel)이 시작하는 북쪽 벽 바로 아래 줄 — 물길 첫 칸 바로 위', pair=('ug-channel', 'ug-valve'),
       desc='양옆 쇠 홈 기둥 사이를 막은 녹슨 철 수문판(2칸). 위 보에 빨간 손잡이 바퀴와 축, 판에 가로 보강 줄·녹물·이끼, 아래 틈으로 물이 거품을 내며 흘러나온다. 막힘.')
def _sluice(c):
    for x0, a, b in ((1, 2, -2), (27, 0, -3)):
        rc(c, x0, 0, 4, 30, K('tekko', -1)); vl(c, x0, 0, 30, K('tekko', a)); vl(c, x0 + 3, 0, 30, K('tekko', b))
        outline(c, x0 - 1, 0, 6, 31, OL)
    rc(c, 0, 0, 32, 5, K('tekko', 0)); hl(c, 0, 0, 32, OL); hl(c, 0, 1, 32, K('tekko', 2)); hl(c, 0, 4, 32, K('tekko', -3)); hl(c, 0, 5, 32, OL)
    rc(c, 15, 0, 2, 9, K('tekko', 1))
    ring(c, 15.5, 2.5, 6.5, 2.4, K('aka', 0), 1.2); px(c, 10, 2, K('aka', 1)); px(c, 11, 1, K('aka', 1))
    rc(c, 5, 6, 22, 18, K('tekko', -1))
    for y in range(6, 24):
        for x in range(5, 27):
            if rnd(x, y, 261, 90): px(c, x, y, K('soil', -1))
    for y in (9, 15, 21):
        hl(c, 5, y, 22, K('tekko', 1)); hl(c, 5, y + 1, 22, K('tekko', -3))
    for x in (8, 15, 23): rust_drip(c, x, y + 2 if False else 11, 9, 262 + x)
    for y in range(19, 24):
        for x in range(5, 27):
            if hs(x // 2, y, 263) % 100 < 20 + (y - 19) * 14: px(c, x, y, K('ki', -2))
    rc(c, 5, 24, 22, 6, K('lino', -2))
    for x in range(5, 27):
        if rnd(x, 24, 264, 500): px(c, x, 24 + hs(x, 2, 264) % 2, K('kinari', -1))
        if x % 3 == 0: px(c, x, 26 + hs(x, 3, 265) % 3, K('lino', 0))
    hl(c, 5, 24, 22, K('garasu', -3))
    hl(c, 0, 30, 32, K('garasu', -3)); hl(c, 0, 31, 32, K('lino', -2))


@R.obj('ug-puddle', '물웅덩이', w=1, h=1, kind='flat', use=('walk',), tags=S_TAGS + T_TAGS + ('물웅덩이',),
       place='점검로·통로 바닥 아무 데나, 벽 밑·관 밑(밟는다)', pair=('ug-debris',),
       desc='바닥에 고인 얕은 검푸른 물웅덩이. 가장자리 진한 테, 위쪽에 천장 등 반사 줄. 밟고 지나간다.')
def _puddle(c):
    disc(c, 7.5, 8.5, 6.8, 4.2, K('tairu', -1))
    disc(c, 7, 8.5, 5.6, 3.2, K('garasu', -2))
    disc(c, 4, 7, 2.2, 1.4, K('garasu', -2)); disc(c, 12.5, 10, 2, 1.3, K('tairu', -1))
    hl(c, 4, 7, 4, K('tairu', 1)); px(c, 9, 7, K('tairu', 0)); px(c, 10, 9, K('garasu', -1))
    hl(c, 3, 12, 8, K('tairu', -2))


@R.obj('ug-trash-pile', '쓰레기 더미', w=1, h=1, up=6, kind='floor', use=('search', 'block'), tags=S_TAGS + T_TAGS + ('쓰레기', '잔해'),
       place='점검로 막다른 곳·물길 끝·관 옆 바닥', pair=('ug-debris', 'ug-rat-hole'),
       desc='떠내려와 쌓인 쓰레기 더미 — 검푸른·회색 비닐 봉지, 찌그러진 깡통, 비스듬한 나무 판. 뒤져 볼 수 있다. 막힘.')
def _trash(c):
    disc(c, 8, 22, 7.5, 6, OL)
    disc(c, 5, 22, 4.5, 4.5, K('kon', -1)); disc(c, 4.5, 20.5, 2.5, 2, K('kon', 0)); px(c, 3, 19, K('kon', 1))
    disc(c, 11, 23, 4.2, 4, K('conc', -2)); disc(c, 10.5, 21.5, 2.4, 1.8, K('conc', -1)); px(c, 9, 20, K('conc', 0))
    hl(c, 9, 17, 1, K('sumi', 1))
    for i in range(9): px(c, 2 + i, 15 + i // 2, K('soil', 0)); px(c, 2 + i, 16 + i // 2, K('soil', -2))
    hl(c, 1, 14, 2, OL)
    rc(c, 7, 25, 3, 3, K('aka', -1)); hl(c, 7, 25, 3, K('aka', 1)); px(c, 9, 27, K('tekko', 1))
    rc(c, 12, 18, 2, 2, K('kii', -1))
    hl(c, 1, 28, 14, K('yoru', -1)); hl(c, 2, 29, 12, K('yoru', 0))


@R.obj('ug-rat-hole', '벽 밑 구멍', w=1, kind='hang', hrows=2, use=('search',), tags=S_TAGS + ('구멍',),
       place='하수도 북쪽 벽면 윗줄 — 그림은 벽면 아랫단 밑에 보인다. 쓰레기 더미 옆', pair=('ug-trash-pile',),
       desc='벽 밑동이 무너져 생긴 아치 모양 어두운 구멍. 깨진 벽돌 테두리와 바닥의 부스러기. 동물은 그리지 않는다 — 조사 자리.')
def _rathole(c):
    for y in range(21, 32):
        for x in range(3, 13):
            if ((x - 7.5) / 5) ** 2 + ((y - 31) / 10) ** 2 <= 1: px(c, x, y, K('sumi', 0))
    for y in range(23, 32):
        for x in range(5, 11):
            if ((x - 7.5) / 3) ** 2 + ((y - 31.5) / 7) ** 2 <= 1: px(c, x, y, K('yoru', -3))
    for (x, y, t) in ((2, 26, -1), (3, 22, 0), (5, 20, 0), (9, 20, -1), (12, 22, -2), (13, 26, -2), (2, 30, -1), (13, 30, -3)):
        rc(c, x, y, 2, 2, K('renga', t)); px(c, x, y, K('renga', t + 1))
    for (x, y) in ((1, 31), (4, 31), (12, 31), (14, 31)): px(c, x, y, K('conc', -2))


# ══ 기계실·대피실 ═════════════════════════════════════════════════════════════
@R.obj('ug-panel', '배전반', w=1, h=1, up=16, kind='wall', use=('switch',), tags=RM_TAGS + T_TAGS + ('배전반',),
       place='기계실·계전실 북쪽 벽 바로 아래 줄, 2~3대 나란히', pair=('ug-fan', 'ug-locker'),
       desc='회색 철 배전반(1.8m). 윗면, 앞 가장자리 밝은 줄과 처마 그늘, 들어간 문짝에 빨강(켜짐)·초록 표시등, 노란 번개 삼각 표지(글자 없음), 손잡이, 아래 통풍 살, 밑동 녹. 전원을 켜고 끄는 장치로 쓴다.')
def _panel(c):
    rc(c, 1, 2, 14, 5, K('tekko', 0)); hl(c, 1, 2, 14, K('tekko', 1)); hl(c, 1, 6, 14, K('tekko', 2))
    hl(c, 1, 7, 14, K('tekko', -3)); hl(c, 1, 8, 14, K('tekko', -2))
    rc(c, 1, 9, 14, 20, K('tekko', 0)); vl(c, 1, 9, 20, K('tekko', 1))
    rc(c, 3, 10, 10, 17, K('tekko', -1)); hl(c, 3, 10, 10, K('tekko', -3)); vl(c, 3, 10, 17, K('tekko', -3)); hl(c, 3, 26, 10, K('tekko', 1))
    px(c, 5, 12, K('aka', 1)); px(c, 6, 12, K('aka', 2)); px(c, 9, 12, K('midori', -1)); px(c, 10, 12, K('midori', -1))
    for j in range(4):                                                  # 노란 삼각 표지
        hl(c, 7 - j // 2, 15 + j, 2 + (j // 2) * 2, K('kii', 1))
    px(c, 7, 17, K('sumi', 0)); px(c, 8, 16, K('sumi', 0))
    rc(c, 11, 17, 1, 3, K('tekko', 2)); px(c, 11, 20, K('sumi', 1))
    for y in (22, 24): hl(c, 5, y, 6, K('tekko', -3))
    for (x, y) in ((4, 25), (12, 14), (6, 21)): px(c, x, y, K('soil', -1))
    rust_drip(c, 4, 27, 3, 271); rust_drip(c, 12, 27, 2, 272)
    rc(c, 1, 29, 14, 1, K('yoru', -1))
    outline(c, 0, 1, 16, 30, OL); hl(c, 0, 31, 16, K('yoru', -2))


@R.obj('ug-pump', '배수 펌프', w=2, h=1, up=10, kind='floor', use=('switch', 'block'), tags=S_TAGS + RM_TAGS + ('펌프실', '펌프'),
       place='펌프실·합류 수조 옆 바닥, 수조 쪽으로 관이 나간다', pair=('ug-valve', 'ug-pipe-v', 'ug-panel'),
       desc='콘크리트 받침 위 배수 펌프(2칸). 왼쪽은 냉각 지느러미가 있는 녹색 전동기 원통, 오른쪽은 회색 펌프 몸통과 위로 솟은 토출관·작은 압력계. 칠이 벗겨지고 녹이 슬었다. 막힘.')
def _pump(c):
    rc(c, 1, 20, 30, 5, K('conc', -2)); hl(c, 1, 20, 30, K('conc', -1)); vl(c, 1, 20, 5, K('conc', -1))
    rc(c, 1, 25, 30, 3, K('conc', -3)); outline(c, 0, 19, 32, 10, OL)
    hl(c, 1, 29, 30, K('yoru', -1)); hl(c, 2, 30, 28, K('yoru', 0))
    rows = (K('midori', 0), K('midori', 0), K('midori', -1), K('midori', -1), K('midori', -1), K('midori', -1), K('midori', -2), K('midori', -2), K('midori', -2), K('sumi', 1))
    for i, col in enumerate(rows): hl(c, 3, 9 + i, 14, col)
    for x in range(5, 16, 2): vl(c, x, 10, 8, K('midori', -2))
    for x in range(4, 17):
        if rnd(x, 12, 281, 150): px(c, x, 12 + hs(x, 0, 281) % 4, K('conc', -1))          # 벗겨진 칠
    rc(c, 1, 9, 3, 10, K('tekko', 0)); vl(c, 1, 9, 10, K('tekko', 1)); outline(c, 0, 8, 18, 12, OL)
    rc(c, 18, 11, 11, 9, K('tekko', -1)); hl(c, 18, 11, 11, K('tekko', 1)); vl(c, 18, 11, 9, K('tekko', 0)); outline(c, 17, 10, 13, 11, OL)
    disc(c, 23, 15.5, 3, 2.5, K('tekko', -2)); px(c, 22, 14, K('tekko', 1))
    rc(c, 21, 1, 5, 10, K('tekko', -1)); vl(c, 21, 1, 10, K('tekko', 1)); vl(c, 25, 1, 10, K('tekko', -3)); outline(c, 20, 0, 7, 11, OL)
    rc(c, 19, 5, 9, 2, K('tekko', 0)); hl(c, 19, 5, 9, K('tekko', 2)); outline(c, 18, 4, 11, 4, OL)
    disc(c, 29, 9, 1.8, 1.8, OL); px(c, 29, 9, K('shiro', -1))
    rust_drip(c, 20, 20, 3, 282); rust_drip(c, 27, 20, 4, 283); rust_drip(c, 9, 19, 2, 284)


@R.obj('ug-locker', '작업자 사물함', w=1, h=1, up=16, kind='wall', use=('open', 'search'), tags=RM_TAGS + T_TAGS + ('사물함',),
       place='대피실·계전실·기계실 북쪽 벽 바로 아래 줄, 1~3개 — 열쇠·단서를 넣어 두는 자리', pair=('ug-panel', 'ug-item-toolbox'),
       desc='녹회색 칠이 바랜 철제 작업자 사물함(1.8m). 윗면과 앞 가장자리 밝은 줄, 문 위 통풍 살, 손잡이, 찌그러진 자국, 오른쪽 문틈이 살짝 열려 어둡다. 열어서 뒤진다(열쇠 자리).')
def _locker(c):
    rc(c, 1, 2, 14, 5, K('lino', 0)); hl(c, 1, 2, 14, K('lino', 1)); hl(c, 1, 6, 14, K('lino', 2))
    hl(c, 1, 7, 14, K('lino', -2)); hl(c, 1, 8, 14, K('lino', -1))
    rc(c, 1, 9, 14, 20, K('lino', -1)); vl(c, 1, 9, 20, K('lino', 0))
    rc(c, 3, 10, 9, 17, K('lino', -1)); hl(c, 3, 10, 9, K('lino', -2)); vl(c, 3, 10, 17, K('lino', -2))
    for y in (12, 14, 16): hl(c, 5, y, 5, K('lino', -2)); hl(c, 5, y + 1, 5, K('lino', 0))
    vl(c, 12, 9, 19, K('yoru', -2)); vl(c, 13, 10, 17, K('yoru', -1))
    rc(c, 10, 18, 1, 3, K('tekko', 2))
    px(c, 6, 21, K('lino', 0)); px(c, 7, 22, K('lino', -2)); px(c, 6, 22, K('lino', -2))
    for x in range(2, 14):
        if rnd(x, 26, 291, 300): px(c, x, 27 + hs(x, 1, 291) % 2, K('soil', -1))
    rust_drip(c, 4, 8, 6, 292)
    rc(c, 1, 29, 14, 1, K('yoru', -1))
    outline(c, 0, 1, 16, 30, OL); hl(c, 0, 31, 16, K('yoru', -2))


@R.obj('ug-door-steel', '철문(열림 — 잠긴 문 자리)', kind='door', use=('travel', 'open'), tags=RM_TAGS + T_TAGS + S_TAGS + ('철문', '문', '잠긴 문'),
       place='통로와 기계실·펌프실·계전실 사이 가로 칸막이의 1칸 틈 칸 — 잠긴 문(locks)은 이 칸에 조수가 이벤트로 단다', pair=('ug-locker',),
       desc='녹슨 두꺼운 철문이 문틀 서쪽에 젖혀 붙은 기계실 출입구. 문틀 위 노랑·검정 띠, 철 문턱. 가운데로 지나간다 — 잠금은 이 칸의 이벤트로 단다(열쇠를 얻기 전까지 막는다).')
def _door_steel(c):
    for x0, f in ((0, 1), (13, -1)):
        rc(c, x0, 0, 3, 32, K('tekko', -1)); vl(c, x0 + (0 if f > 0 else 2), 0, 32, K('tekko', 1 if f > 0 else -3)); vl(c, x0 + (2 if f > 0 else 0), 4, 28, K('tekko', -3 if f > 0 else 1))
    rc(c, 0, 0, 16, 4, K('tekko', -1)); hl(c, 0, 0, 16, OL); hazard(c, 0, 1, 16, 2); hl(c, 0, 3, 16, K('tekko', -3))
    rc(c, 3, 4, 4, 26, K('tekko', 0)); vl(c, 3, 4, 26, K('tekko', 2)); vl(c, 6, 4, 26, K('tekko', -3)); hl(c, 3, 4, 4, K('tekko', 2))
    rc(c, 5, 15, 2, 3, K('tekko', 3)); px(c, 6, 18, OL)
    for y in range(6, 30):
        if rnd(4, y, 301, 180): px(c, 4 + hs(y, 0, 301) % 2, y, K('soil', -1))
    rust_drip(c, 1, 4, 8, 302); rust_drip(c, 14, 4, 10, 303)
    rc(c, 3, 29, 10, 3, K('tekko', 0)); hl(c, 3, 29, 10, K('tekko', 2)); hl(c, 3, 31, 10, K('tekko', -3))


@R.obj('ug-light-off', '꺼진 형광등', w=1, kind='hang', hrows=2, tags=RM_TAGS + T_TAGS + S_TAGS + ('조명', '형광등'),
       place='북쪽 벽면 윗줄, 3~5칸 간격 — 통로·방 어디나', pair=('ug-light-emergency',),
       desc='벽 위에 매단 꺼진 형광등. 쇠 받침, 먼지 낀 갓, 끝이 검게 탄 회색 관, 오른쪽 끝에서 끊어진 전선이 늘어진다. 불빛 없음 — 어둠을 만든다.')
def _light_off(c):
    vl(c, 3, 0, 4, K('tekko', -1)); vl(c, 12, 0, 4, K('tekko', -1))
    rc(c, 1, 4, 14, 6, K('tekko', -1)); hl(c, 1, 4, 14, K('tekko', 0)); hl(c, 1, 5, 14, K('tekko', 1)); outline(c, 0, 3, 16, 8, OL)
    rc(c, 2, 7, 12, 2, K('conc', -2)); hl(c, 2, 7, 12, K('conc', -1))
    rc(c, 2, 7, 2, 2, K('yoru', 0)); rc(c, 12, 7, 2, 2, K('yoru', 0))
    for (x, y) in ((14, 11), (14, 12), (13, 13), (13, 14), (14, 15), (14, 16)): px(c, x, y, K('sumi', 1))
    px(c, 14, 17, K('aka', -1))
    hl(c, 1, 11, 14, K('conc', -3))


@R.obj('ug-light-emergency', '비상 유도등(초록)', w=1, kind='hang', hrows=2, tags=RM_TAGS + T_TAGS + S_TAGS + ('조명', '비상등', '유도등'),
       place='북쪽 벽면 윗줄, 출구(사다리·계단·출입구)·철문 옆', pair=('ug-ladder-up', 'ug-door-steel', 'ug-manhole-ladder'),
       desc='벽 위의 작은 초록 비상 유도등. 흰 테 안에 밝은 초록 판과 흰 화살·문 모양(사람·글자 없음), 아래 빨간 표시 점. 어둠 속에서 출구 쪽을 알린다.')
def _light_em(c):
    vl(c, 7, 0, 5, K('tekko', -2))
    rc(c, 2, 5, 12, 8, K('shiro', -1)); hl(c, 2, 5, 12, K('shiro', 0)); outline(c, 1, 4, 14, 10, OL)
    rc(c, 3, 6, 10, 6, K('midori', 1)); hl(c, 3, 6, 10, K('midori', 2))
    rc(c, 9, 7, 3, 4, K('shiro', 1)); px(c, 10, 9, K('midori', 0))
    for j in range(3): px(c, 6 - j, 8 + j // 2, K('shiro', 1)); px(c, 6 - j, 9 - j // 2 + (1 if j else 0), K('shiro', 1))
    hl(c, 4, 9, 4, K('shiro', 1))
    px(c, 7, 15, K('aka', 1)); px(c, 8, 15, K('aka', 0)); outline(c, 6, 14, 4, 3, OL)
    hl(c, 2, 14, 4, K('conc', -3))


# ══ 보물·단서(1×1, 조사) ═══════════════════════════════════════════════════════
@R.obj('ug-item-toolbox', '공구함', w=1, h=1, kind='floor', use=('search',), tags=T_TAGS + RM_TAGS + ('보물', '공구'),
       place='막다른 통로 끝·대피실·기계실 구석 바닥 — 보물·단서 자리', pair=('ug-locker', 'ug-maint-cart'),
       desc='빨간 칠이 벗겨진 쇠 공구함. 뚜껑 윗면과 손잡이, 앞 걸쇠, 모서리 녹. 조사하면 공구·열쇠·단서가 나온다. 막힘.')
def _toolbox(c):
    rc(c, 6, 2, 4, 1, K('tekko', 0)); px(c, 5, 3, K('tekko', -1)); px(c, 10, 3, K('tekko', -1)); hl(c, 5, 1, 6, OL)
    rc(c, 2, 4, 12, 4, K('aka', 1)); hl(c, 2, 4, 12, K('aka', 2)); vl(c, 2, 4, 4, K('aka', 2))
    hl(c, 2, 8, 12, K('aka', 2)); hl(c, 2, 9, 12, K('aka', -1))
    rc(c, 2, 10, 12, 3, K('aka', 0)); hl(c, 2, 12, 12, K('aka', -1))
    rc(c, 7, 9, 2, 2, K('tekko', 2)); px(c, 8, 10, K('tekko', -1))
    for (x, y) in ((3, 11), (12, 5), (13, 11), (4, 6)): px(c, x, y, K('soil', -1))
    outline(c, 1, 3, 14, 11, OL); hl(c, 1, 14, 14, K('yoru', -1))


@R.obj('ug-item-firstaid', '구급함', w=1, h=1, kind='floor', use=('search', 'heal'), tags=S_TAGS + RM_TAGS + ('보물', '구급'),
       place='막다른 점검로 끝·대피실 바닥 — 보물·회복 자리', pair=('ug-item-lantern',),
       desc='흰 플라스틱 구급함, 뚜껑과 앞면에 초록 십자(글자 없음), 손잡이, 물때 얼룩. 조사하면 회복 물건이 나온다. 막힘.')
def _firstaid(c):
    rc(c, 6, 2, 4, 1, K('tekko', 0)); hl(c, 5, 1, 6, OL); px(c, 5, 3, K('tekko', -1)); px(c, 10, 3, K('tekko', -1))
    rc(c, 2, 4, 12, 4, K('shiro', 0)); hl(c, 2, 4, 12, K('shiro', 1)); vl(c, 2, 4, 4, K('shiro', 1))
    hl(c, 6, 5, 4, K('midori', 0)); hl(c, 7, 4, 2, K('midori', 1)); px(c, 7, 6, K('midori', 0)); px(c, 8, 6, K('midori', 0))
    hl(c, 2, 8, 12, K('shiro', 1)); hl(c, 2, 9, 12, K('shiro', -2))
    rc(c, 2, 10, 12, 3, K('shiro', -1)); hl(c, 2, 12, 12, K('shiro', -2))
    rc(c, 7, 10, 2, 3, K('midori', 0)); hl(c, 6, 11, 4, K('midori', 0))
    for (x, y) in ((3, 12), (12, 11), (11, 7)): px(c, x, y, K('kinari', -2))
    outline(c, 1, 3, 14, 11, OL); hl(c, 1, 14, 14, K('yoru', -1))


@R.obj('ug-item-lantern', '작업 랜턴', w=1, h=1, kind='floor', use=('search', 'light'), tags=T_TAGS + S_TAGS + ('보물', '조명', '랜턴'),
       place='막다른 곳·대피 홈 앞 바닥 — 보물 자리(빛을 얻는 물건)', pair=('ug-item-firstaid', 'ug-item-toolbox'),
       desc='노란 몸통의 충전식 작업 랜턴. 위 검은 손잡이, 앞 둥근 렌즈에 켜진 불빛. 바닥에 놓여 있다. 조사하면 손에 넣는다. 막힘.')
def _lantern(c):
    hl(c, 6, 1, 4, OL); px(c, 5, 2, OL); px(c, 10, 2, OL); vl(c, 5, 3, 2, K('sumi', 1)); vl(c, 10, 3, 2, K('sumi', 1)); hl(c, 6, 2, 4, K('sumi', 1))
    rc(c, 4, 5, 8, 3, K('kii', 1)); hl(c, 4, 5, 8, K('kii', 2))
    rc(c, 4, 8, 8, 5, K('kii', 0)); vl(c, 4, 8, 5, K('kii', 1)); vl(c, 11, 8, 5, K('kii', -1))
    disc(c, 7.5, 10, 2.4, 2, K('mado', 2)); px(c, 7, 9, K('shiro', 2)); ring(c, 7.5, 10, 2.8, 2.4, K('tekko', -1), 0.9)
    outline(c, 3, 4, 10, 10, OL)
    for (x, y) in ((2, 13), (13, 13), (1, 11), (14, 11)): px(c, x, y, K('mado', -1))
    hl(c, 3, 14, 10, K('yoru', -1))


def build(): return R.build()
def selftest(): return R.selftest()


if __name__ == '__main__':
    sys.exit(1 if run_block(R, os.path.join(ROOT, 'tiledata', 'jp-city', 'blocks', BLOCK)) else 0)
