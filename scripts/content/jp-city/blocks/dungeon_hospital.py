#!/usr/bin/env python3
"""jp_city 4묶음 현대 던전 — 폐병원(버려진 지 오래된 종합병원). id 머리 `hp-`.

  python3 scripts/content/jp-city/blocks/dungeon_hospital.py   # selftest + tiledata/jp-city/blocks/dungeon_hospital/_all-x3.png

1층 대기 로비·외래 진찰실·약제실, 2층 병동·간호사 스테이션·수술실, 지하 영안실·보일러실·창고의 **망가진 판**만 그린다.
멀쩡한 병원 가구는 의원 `pb-`(접수 카운터·약장·진찰 침대)·학교 `sc-`(콘크리트 계단·계단통)를 가져다 쓴다.

칸 16px = 1m, 3/4 시점(수평 면 윗면 + 남쪽 앞면), 빛 왼쪽 위, 윤곽 sumi 또는 재질 어두운 단, modern3 램프만(반투명 없음).
바닥·벽면은 의원 판(pb-linoleum·pb-office-wall)보다 1~2단 어둡고 얼룩·금·들뜬 타일·벗겨진 칠·녹 물때.
**피·시체·사람·해골·인체 모형·뼈 그림 없음** — 무서움은 어둠·잔해·흔적(넘어진 집기, 찢긴 커튼, 반쯤 열린 냉장 서랍의 빈 어둠)으로.
글자·숫자·상표·로고 없음 — 차트 등·번호판·계기판은 색 점과 선, 구급함도 십자 표지 대신 초록 띠.

크기(§12-3 공식, 1칸 = 1m):
  녹슨 병원 침대 1.0×2.1×0.6 → 1×2 up8 · 넘어진 침대(옆으로 누움, 높이 = 침대 폭 1m) 2.1×0.6×1.0 → 2×1 up8 ·
  커튼 칸막이 1.8m → up16 · 링거 걸이 0.5×0.5×1.8 → 1×1 up16 · 휠체어 0.6×0.9×0.9 → 1×1 up8 · 이동 침대 2.0×0.6×0.8 → 2×1 up0(T6 F9) ·
  간호사 스테이션 카운터 1.0×0.6×1.0 → 1×1 up0 이어 붙임 · 차트 선반 1.6×0.4×1.8 → 2×1 up16 · 약 카트 0.6×0.5×0.9 → 1×1 up8 ·
  수술대 0.6×2.0×0.9 → 1×2 up8 · 무영등(걸이) 지름 1.6m → 2칸 · 모니터 카트 0.5×0.5×1.6 → 1×1 up16 · 판독 상자(걸이) 2칸 ·
  냉장 서랍 벽 3.0×0.8×2.0 → 3×1 up16 · 보일러 1.8×1.8×2.2 → 2×2 up16 · 멈춘 엘리베이터 2칸 up32(of-elevator 와 같은 틀) ·
  잔해 더미 1×1 up8 · 떨어진 천장판 1.8×0.9 → 2×1 up8 · 넘어진 선반 1.8×0.5 → 2×1 up8 · 이어진 대기 의자 3인 3×1 up16.
분류는 interior/categories.py(ruin-hospital 병동·수술실 · ruin-debris 잔해·흔적).
"""
import os, sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, '..', 'interior'))
from ikit import Registry, K, OL, run_block, ROOT   # noqa: E402

BLOCK = 'dungeon_hospital'
R = Registry(BLOCK, '폐병원')

kc = K                                     # K 는 램프 끝 단에서 멈춘다(7단 -3…3, 5단 -2…2)
ST = lambda t: K('tekko', t)               # 쇠(침대 틀·카트·로커)
WH = lambda t: K('shiro', t)               # 흰 칠·시트·도기
GL = lambda t: K('garasu', t)              # 유리
CN = lambda t: K('conc', t)                # 콘크리트·스테인리스
RU = lambda t: K('soil', t + 1)            # 녹(흙 갈색 낮은 단 — 붉은 단은 피처럼 읽혀 쓰지 않는다)
TAGS = ('폐병원', '병원', '던전')


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
            if ((x + .5 - cx) / rx) ** 2 + ((y + .5 - cy) / ry) ** 2 <= 1: px(c, x, y, col)


def ring(c, cx, cy, rx, ry, col):
    for y in range(int(cy - ry) - 1, int(cy + ry) + 2):
        for x in range(int(cx - rx) - 1, int(cx + rx) + 2):
            d = ((x + .5 - cx) / rx) ** 2 + ((y + .5 - cy) / ry) ** 2
            if d <= 1 and ((x + .5 - cx) / (rx - 1)) ** 2 + ((y + .5 - cy) / (ry - 1)) ** 2 > 1: px(c, x, y, col)


def line(c, x0, y0, x1, y1, col):
    dx, dy = abs(x1 - x0), -abs(y1 - y0)
    sx, sy = (1 if x0 < x1 else -1), (1 if y0 < y1 else -1)
    err = dx + dy
    while True:
        px(c, x0, y0, col)
        if x0 == x1 and y0 == y1: break
        e2 = 2 * err
        if e2 >= dy: err += dy; x0 += sx
        if e2 <= dx: err += dx; y0 += sy


def block3(c, x, y, w, h, top, ramp, t=0, olc=None, front_t=None):
    """3/4 상자: 윗면 top px(가장자리 1px 밝은 테) + 앞 가장자리 하이라이트 1행 + 처마 그늘 2px + 앞면. 반환 = 앞면 내용 시작 y."""
    ft = t - 1 if front_t is None else front_t
    outline(c, x, y, w, h, olc or kc(ramp, -3))
    rc(c, x + 1, y + 1, w - 2, top, kc(ramp, t + 1))
    hl(c, x + 1, y + 1, w - 2, kc(ramp, t + 2)); vl(c, x + 1, y + 1, top, kc(ramp, t + 2))
    hl(c, x + 1, y + 1 + top, w - 2, kc(ramp, t + 2))
    rc(c, x + 1, y + 2 + top, w - 2, h - 3 - top, kc(ramp, ft))
    hl(c, x + 1, y + 2 + top, w - 2, kc(ramp, ft - 2)); hl(c, x + 1, y + 3 + top, w - 2, kc(ramp, ft - 1))
    vl(c, x + 1, y + 4 + top, h - 5 - top, kc(ramp, ft + 1))
    return y + 4 + top


def rust(c, x, y, w, h, seed, per=160):
    """녹: 이미 칠한 금속 위에만(투명 칸은 건드리지 않는다). 흩뿌린 점이 아니라 두세 화소씩 뭉친 갈색 얼룩 —
    붉은 점을 흩으면 피 튄 자국처럼 읽혔다(1회차). 색은 흙 갈색(soil)·짙은 황토(kii -2)만."""
    per = per // 3
    for yy in range(y, y + h):
        for xx in range(x, x + w):
            if 0 <= xx < c.w and 0 <= yy < c.h and c.a[yy, xx, 3] and rnd(xx, yy, seed, per):
                col = K('soil', 0) if rnd(xx, yy, seed + 1, 450) else K('kii', -2)
                for (dx, dy) in ((0, 0), (1, 0), (0, 1)):
                    if 0 <= xx + dx < x + w and 0 <= yy + dy < y + h and xx + dx < c.w and yy + dy < c.h and c.a[yy + dy, xx + dx, 3]:
                        px(c, xx + dx, yy + dy, col if (dx, dy) == (0, 0) else K('soil', -1))


def grime(c, x, y, w, h, seed, col, per=90):
    for yy in range(y, y + h):
        for xx in range(x, x + w):
            if 0 <= xx < c.w and 0 <= yy < c.h and c.a[yy, xx, 3] and rnd(xx, yy, seed, per): px(c, xx, yy, col)


def drip(c, x, y0, n, col, col2=None):
    """위에서 흘러내린 물때 한 줄(끝으로 갈수록 끊긴다)."""
    for k in range(n):
        if k > n * 2 // 3 and k % 2: continue
        px(c, x, y0 + k, col if (col2 is None or k < n // 2) else col2)


def blob(c, cx, cy, rx, ry, seed, col, rough=0.25):
    """가장자리가 울퉁불퉁한 얼룩(좌표 해시로 결정)."""
    for y in range(int(cy - ry) - 1, int(cy + ry) + 2):
        for x in range(int(cx - rx) - 1, int(cx + rx) + 2):
            d = ((x + .5 - cx) / rx) ** 2 + ((y + .5 - cy) / ry) ** 2
            if d <= 1 - rough + rough * 2 * (hs(x, y, seed) % 100) / 100: px(c, x, y, col)


def shadow_base(c, x, y, w):
    """바닥에 닿는 어두운 접지선."""
    hl(c, x, y, w, K('sumi', 0))


# ══ 바닥 ══════════════════════════════════════════════════════════════════════
@R.floor('hp-floor-dirty', '얼룩진 리놀륨(폐병원)', cols=4, rows=4, tags=TAGS + ('복도', '병동', '로비'),
         desc='폐병원 복도·로비·병실의 낡은 비닐 리놀륨 타일(16px) — 의원 바닥보다 두 단 어두운 탁한 청록회색, 물 얼룩·긁힌 금, '
              '타일이 떨어져 나가 회색 시멘트 바탕이 드러난 칸과 모서리가 들뜬 칸. 던전 1·2층 기본 바닥.')
def _floor_dirty(c):
    """16px 타일 판마다 톤을 해시로(바둑 무늬가 아니게), 먼지는 줄눈·모서리 쪽에 몰리고 판 가운데는 조용하다.
    1회차: 빠진 타일·갈색 얼룩 고리가 64px 마다 도장처럼 되풀이됐다 → 빠진 타일 대신 모서리 깨짐 하나, 얼룩은 같은 램프 낮은 단."""
    W, H = c.w, c.h
    for ty in range(H // 16):
        for tx in range(W // 16):
            n = hs(tx, ty, 3) % 7
            base = K('lino', 0) if n in (0, 3) else K('lino', -1)
            rc(c, tx * 16, ty * 16, 16, 16, base)
            for y in range(16):
                for x in range(16):
                    e = min(x, y, 15 - x, 15 - y)
                    if (e <= 1 and rnd(tx * 16 + x, ty * 16 + y, 4, 260)) or rnd(tx * 16 + x, ty * 16 + y, 5, 22):
                        px(c, tx * 16 + x, ty * 16 + y, K('lino', -2) if base == K('lino', -1) else K('lino', -1))
    for y in range(0, H, 16): hl(c, 0, y, W, K('lino', -2))                 # 줄눈(16px)
    for x in range(0, W, 16): vl(c, x, 0, H, K('lino', -2))
    blob(c, 22, 41, 10, 6, 30, K('lino', -2), 0.35)                          # 물 얼룩(같은 램프 낮은 단, 하나만 크게)
    blob(c, 22, 41, 8, 4.5, 31, K('lino', -1), 0.35)
    blob(c, 52, 12, 4, 3, 33, K('lino', -2), 0.4)
    rc(c, 33, 17, 4, 3, CN(-2)); px(c, 33, 17, K('sumi', 0)); px(c, 36, 19, CN(-1)); px(c, 34, 20, CN(-2))   # 깨진 모서리(시멘트)
    hl(c, 1, 49, 14, K('lino', 1)); vl(c, 1, 49, 14, K('lino', 1))           # 들뜬 판: 위·왼 날이 밝고 아래·오른 그늘
    hl(c, 1, 63, 15, K('sumi', 0)); vl(c, 15, 49, 15, K('sumi', 0))
    line(c, 40, 30, 47, 26, K('lino', -2)); line(c, 47, 26, 52, 27, K('lino', -2))   # 긁힌 금
    line(c, 6, 6, 11, 10, K('lino', -2))


@R.floor('hp-floor-tile-dirty', '더러운 작은 타일(수술실·영안실)', cols=4, rows=4, tags=TAGS + ('수술실', '영안실'),
         desc='수술실·영안실의 회백색 8px 타일 — 줄눈에 검은 때가 끼고, 금 간 타일·빠진 타일, 바닥 쪽으로 번진 녹물 얼룩. 의원 욕실 타일보다 두 단 어둡다.')
def _floor_tile(c):
    W, H = c.w, c.h
    for ty in range(H // 8):
        for tx in range(W // 8):
            base = CN(1) if hs(tx, ty, 11) % 3 else CN(0)
            rc(c, tx * 8, ty * 8, 8, 8, base)
            px(c, tx * 8 + 1, ty * 8 + 1, CN(2))
            if hs(tx, ty, 12) % 9 == 0: rc(c, tx * 8 + 1, ty * 8 + 1, 7, 7, CN(-1)); px(c, tx * 8 + 2, ty * 8 + 3, CN(-2))   # 빠진 타일
    for y in range(H):
        for x in range(W):
            if x % 8 == 0 or y % 8 == 0: px(c, x, y, CN(-1) if rnd(x, y, 13, 700) else K('yoru', 1))   # 때 낀 줄눈
    for y in range(H):                                                         # 녹물: 줄눈에만 번진 갈색(타일 면 얼룩은 64px 마다 도장처럼 되풀이돼 뺐다)
        for x in range(W):
            d = ((x - 44) / 9) ** 2 + ((y - 20) / 6) ** 2
            if d <= 1 and (x % 8 == 0 or y % 8 == 0) and rnd(x, y, 16, 450): px(c, x, y, K('soil', -1))
    line(c, 6, 50, 15, 41, K('yoru', 0)); line(c, 15, 41, 21, 43, K('yoru', 0))   # 금
    line(c, 50, 58, 58, 52, K('yoru', 0))


@R.floor('hp-floor-conc', '젖은 시멘트 바닥(지하)', cols=4, rows=4, tags=TAGS + ('보일러실', '창고', '지하'),
         desc='지하 보일러실·창고·복도의 맨 시멘트 바닥 — 어두운 회색, 거친 점, 물기 번진 짙은 얼룩, 갈라진 금과 미장 이음선.')
def _floor_conc(c):
    W, H = c.w, c.h
    rc(c, 0, 0, W, H, K('hodo', -1))
    for y in range(H):
        for x in range(W):
            n = hs(x, y, 21) % 1000
            if n < 60: px(c, x, y, K('hodo', -2))
            elif n < 95: px(c, x, y, K('hodo', 0))
    for k, (cx, cy, rx, ry) in enumerate(((18, 20, 11, 6), (50, 47, 6, 8))):    # 젖은 자국(한 단만 — 두 단이면 64px 마다 검은 얼룩이 줄 섰다)
        for y in range(int(cy - ry), int(cy + ry) + 1):
            for x in range(int(cx - rx), int(cx + rx) + 1):
                d = ((x + .5 - cx) / rx) ** 2 + ((y + .5 - cy) / ry) ** 2
                if d <= 1 and (d < 0.5 or (x + y) % 2) and 0 <= x < W and 0 <= y < H: px(c, x, y, K('hodo', -2))
    hl(c, 0, 31, W, K('hodo', -2)); vl(c, 31, 0, H, K('hodo', -2))            # 미장 이음선(32px)
    hl(c, 0, 32, W, K('hodo', 0)); vl(c, 32, 0, H, K('hodo', 0))
    line(c, 36, 6, 44, 12, K('yoru', -1)); line(c, 44, 12, 46, 20, K('yoru', -1))
    line(c, 4, 52, 12, 58, K('yoru', -1))


# ══ 벽면(2줄 = 32px) ══════════════════════════════════════════════════════════
@R.wall('hp-wall-peel', '칠이 벗겨진 병원 벽', cols=4, tags=TAGS + ('복도', '병동', '로비'),
        desc='폐병원 벽면 — 위는 누렇게 바랜 크림색 칠, 아래는 탁한 청록 허리 판, 그 경계에 나무 손잡이 레일(쇠 받침). '
             '칠이 벗겨져 회색 미장이 드러난 덩이, 위에서 흘러내린 물때, 금. 맨 아래 어두운 걸레받이.')
def _wall_peel(c):
    W = c.w
    rc(c, 0, 0, W, 16, K('kinari', -1)); rc(c, 0, 16, W, 12, K('lino', -1))   # 의원 벽(kinari +2)보다 세 단 어두운 바랜 칠
    for y in range(28):
        for x in range(W):
            if rnd(x, y, 31, 45): px(c, x, y, K('kinari', 0) if y < 16 and rnd(x, y, 39, 400) else K('kinari', -2) if y < 16 else K('lino', -2))
    for x0, n in ((9, 13), (30, 7), (51, 10), (40, 5)):                        # 물때(누런 줄 — 길이 제각각)
        for k in range(n):
            if k > n * 2 // 3 and k % 2: continue
            px(c, x0, k, K('kinari', -2)); px(c, x0 + 1, k + 1, K('kinari', -2) if k < n // 2 else K('kinari', -1))
        px(c, x0, n, K('soil', 0))
    # 벗겨진 칠: 회색 미장(어두움)이 드러나고, 남은 칠의 아래 날이 빛을 받아 밝다(두께), 위 날은 그늘. 크기·높이 제각각.
    for k, (cx, cy, rx, ry) in enumerate(((19, 9, 5, 3), (56, 4, 3, 2), (44, 22, 4, 2))):
        rim = K('kinari', -2) if cy < 16 else K('lino', -2)
        blob(c, cx, cy, rx + 1, ry + 1, 35 + k, rim, 0.35)
        blob(c, cx, cy, rx, ry, 35 + k, CN(-1), 0.35)
        blob(c, cx - 1, cy, rx * 0.5, ry * 0.5, 38 + k, CN(-2), 0.4)
        for x in range(int(cx - rx), int(cx + rx) + 1):                        # 아래 날 밝게
            for y in range(int(cy + ry) + 2, int(cy - ry) - 3, -1):
                if 0 <= y < 32 and c.a[y, x % c.w, 3] and tuple(c.a[y, x % c.w, :3]) == tuple(int(v) for v in ((CN(-1) >> 16) & 255, (CN(-1) >> 8) & 255, CN(-1) & 255)):
                    px(c, x, y + 1, K('kinari', 0) if cy < 16 else K('lino', 0)); break
    line(c, 2, 2, 6, 9, K('kinari', -2)); line(c, 6, 9, 5, 14, K('kinari', -2))   # 금
    line(c, 33, 22, 37, 26, K('lino', -2))
    hl(c, 0, 15, W, K('kinari', -2))
    # 손잡이 레일(높이 0.8m): 나무 막대 3px + 아래 그늘, 쇠 받침 32px 마다
    hl(c, 0, 17, W, K('ita', 1)); hl(c, 0, 18, W, K('ita', 0)); hl(c, 0, 19, W, K('ita', -2)); hl(c, 0, 20, W, K('lino', -2))
    for x0 in (12, 44):
        rc(c, x0, 19, 2, 3, ST(-1)); px(c, x0, 19, ST(1))
    for x in range(W):
        if rnd(x, 17, 33, 200): px(c, x, 17, K('ita', -1))
    hl(c, 0, 27, W, K('lino', -2))
    rc(c, 0, 28, W, 4, CN(-1)); hl(c, 0, 28, W, CN(0)); hl(c, 0, 31, W, CN(-3))
    for x in range(W):
        if rnd(x, 29, 34, 150): px(c, x, 29, K('soil', -1))


@R.wall('hp-wall-tile', '금 간 타일 벽(수술실·영안실)', cols=4, tags=TAGS + ('수술실', '영안실'),
        desc='수술실·영안실의 회백색 8px 타일 벽 — 줄눈의 때, 금 간 타일과 빠진 타일 자리(시멘트), 녹물 줄. 맨 아래 시멘트 띠.')
def _wall_tile(c):
    W = c.w
    for ty in range(4):
        for tx in range(W // 8):
            base = WH(-1) if hs(tx, ty, 41) % 4 else CN(1)
            if ty >= 2 and base == WH(-1): base = CN(1) if hs(tx, ty, 42) % 3 == 0 else WH(-1)
            rc(c, tx * 8, ty * 8, 8, 8, base)
            hl(c, tx * 8 + 1, ty * 8 + 1, 3, WH(0))
            if hs(tx, ty, 43) % 11 == 0: rc(c, tx * 8 + 1, ty * 8 + 1, 7, 7, CN(-1)); px(c, tx * 8 + 3, ty * 8 + 4, CN(-2))
    for y in range(32):
        for x in range(W):
            if x % 8 == 0 or y % 8 == 0: px(c, x, y, CN(-1))
    for x0 in (13, 46):                                                         # 녹물 줄
        drip(c, x0, 0, 18, K('soil', 0), K('soil', 1))
        drip(c, x0 + 1, 2, 9, K('soil', 1))
    line(c, 26, 3, 30, 12, K('yoru', 1)); line(c, 30, 12, 28, 20, K('yoru', 1))
    line(c, 56, 18, 61, 24, K('yoru', 1))
    rc(c, 0, 28, W, 4, CN(-1)); hl(c, 0, 28, W, CN(-2)); hl(c, 0, 31, W, CN(-3))


@R.wall('hp-wall-conc', '얼룩진 시멘트 벽(지하)', cols=4, tags=TAGS + ('보일러실', '창고', '지하'),
        desc='지하의 맨 시멘트 벽 — 거푸집 이음선과 둥근 구멍(폼타이 자국) 줄, 위에서 번진 짙은 물때, 아래 젖은 띠.')
def _wall_conc(c):
    W = c.w
    rc(c, 0, 0, W, 32, K('hodo', 0))
    for y in range(32):
        for x in range(W):
            n = hs(x, y, 51) % 1000
            if n < 50: px(c, x, y, K('hodo', -1))
            elif n < 80: px(c, x, y, K('hodo', 1))
    for x in (0, 32): vl(c, x, 0, 28, K('hodo', -1))
    for x0 in range(8, W, 16):                                                  # 폼타이 구멍
        for y0 in (7, 21):
            px(c, x0, y0, K('hodo', -3)); px(c, x0 + 1, y0, K('hodo', -2)); px(c, x0, y0 + 1, K('hodo', -2)); px(c, x0 + 1, y0 + 1, K('hodo', 1))
    for x0 in (4, 22, 38, 57):                                                  # 물때
        n = 10 + hs(x0, 1, 52) % 10
        for k in range(n):
            px(c, x0, k, K('hodo', -2));
            if k < n - 4: px(c, x0 + 1, k, K('hodo', -1))
    rc(c, 0, 24, W, 4, K('hodo', -1))
    for x in range(W):
        if rnd(x, 23, 53, 400): px(c, x, 23, K('hodo', -1))
    rc(c, 0, 28, W, 4, K('hodo', -2)); hl(c, 0, 31, W, K('hodo', -3))


# ══ 병동 ══════════════════════════════════════════════════════════════════════
@R.obj('hp-bed-rusty', '녹슨 병원 침대', w=1, h=2, up=8, kind='floor', use=('sleep', 'search'), tags=TAGS + ('병실', '병동', '침대'),
       place='병실 북쪽 벽 아래·창 아래, 침대 사이에 찢긴 커튼', pair=('hp-curtain-torn', 'hp-iv-stand'),
       desc='병실의 녹슨 1인 병원 침대 1×2 — 쇠 파이프 머리판(북쪽)에 녹이 번지고, 회백 매트는 누렇게 얼룩지고 가운데가 찢겨 속이 드러났다. 꺼진 베개, 발치에 접힌 바랜 담요. 병실마다 2~4개.')
def _bed_rusty(c):
    """병원 침대를 위에서: 쇠 파이프 머리판(북쪽, 위로 8px) → 누렇게 바랜 회백 매트(베개 자국·얼룩·가운데 찢김) → 발치에 접힌 담요 → 발치 틀·바퀴.
    1회차: 매트를 갈색(kinari -1)으로 칠하니 나무 장·문짝처럼 읽혔다 → 매트는 회백(shiro -1), 얼룩만 누렇게."""
    rc(c, 1, 6, 14, 2, ST(1)); hl(c, 1, 6, 14, ST(3)); outline(c, 0, 5, 16, 9, ST(-3))   # 머리판 파이프
    for x in (1, 14): rc(c, x, 5, 1, 10, ST(0))
    for x in (5, 8, 11): vl(c, x, 8, 5, ST(-1))
    rust(c, 0, 5, 16, 9, 61, 220)
    rc(c, 1, 13, 14, 29, WH(-1)); outline(c, 0, 12, 16, 31, ST(-3))              # 매트
    hl(c, 1, 13, 14, WH(0)); vl(c, 1, 13, 29, WH(0)); vl(c, 14, 14, 28, WH(-2))
    rc(c, 3, 14, 10, 5, WH(0)); hl(c, 3, 18, 10, WH(-2)); hl(c, 4, 14, 8, WH(1))   # 베개(납작하게 꺼짐)
    blob(c, 5, 22, 3, 2, 62, K('kinari', 0), 0.3); blob(c, 11, 31, 3, 4, 63, K('kinari', -1), 0.3)   # 누런 얼룩
    for y in range(25, 30):                                                     # 찢긴 자리: 바랜 속 + 찢긴 날
        a = 6 + (hs(0, y, 64) % 2); b = 10 - (hs(1, y, 64) % 2)
        rc(c, a, y, b - a, 1, K('kinari', 1) if y % 2 else K('kinari', 0))
        px(c, a - 1, y, WH(-2)); px(c, b, y, WH(-2))
    hl(c, 6, 24, 4, WH(-2)); hl(c, 6, 30, 4, WH(-2))
    rc(c, 1, 35, 14, 6, K('garasu', -1)); hl(c, 1, 35, 14, K('garasu', 0)); hl(c, 1, 40, 14, K('garasu', -2))   # 접힌 담요(바랜 청회색)
    for x in (4, 9, 12): px(c, x, 37, K('garasu', -2))
    rc(c, 0, 41, 16, 3, ST(0)); hl(c, 0, 41, 16, ST(2)); hl(c, 0, 43, 16, ST(-2))   # 발치 틀
    rust(c, 0, 41, 16, 3, 65, 260)
    for x in (1, 13): rc(c, x, 44, 2, 2, ST(-1)); px(c, x, 44, ST(1))
    hl(c, 0, 46, 3, OL); hl(c, 13, 46, 3, OL); px(c, 2, 47, K('sumi', 0)); px(c, 14, 47, K('sumi', 0))


@R.obj('hp-bed-overturned', '넘어진 병원 침대', w=2, h=1, up=8, kind='floor', use=('block',), tags=TAGS + ('병실', '병동', '잔해'),
       place='복도·병실을 가로막는 자리(통로를 막아 길을 돌게 한다)',
       desc='옆으로 넘어져 길을 막은 병원 침대 2×1 — 바닥 쪽 쇠 격자 밑판이 앞을 보고, 다리와 바퀴가 이쪽으로 튀어나왔다. 뒤로 떨어진 매트 끝이 위로 보인다. 지나갈 수 없다.')
def _bed_over(c):
    """옆으로 넘어진 침대: 얼룩진 매트 면이 남쪽(앞)을 보고 서 있고, 둘레에 녹슨 파이프 틀, 서쪽 끝에 머리판 기둥,
    다리·바퀴는 북쪽 뒤로 튀어나와 윗날 위로 끝만 보인다. 1회차의 격자 밑판은 라디오처럼 읽혀 버렸다."""
    for x0 in (6, 22):                                                          # 뒤로 튀어나온 다리·바퀴 끝
        vl(c, x0, 3, 6, ST(1)); vl(c, x0 + 1, 3, 6, ST(-2))
        rc(c, x0 - 1, 1, 4, 3, K('sumi', 0)); hl(c, x0, 2, 2, ST(0))
    rc(c, 4, 8, 26, 3, ST(0)); hl(c, 4, 8, 26, ST(2)); hl(c, 4, 10, 26, ST(-2))   # 윗날 = 침대 옆 난간(위에서 보인다)
    rc(c, 4, 11, 26, 18, K('kinari', -1)); hl(c, 4, 11, 26, K('kinari', 0))       # 서 있는 매트 면
    for x in range(5, 30, 6): vl(c, x, 12, 16, K('kinari', -2))                  # 누빈 줄
    blob(c, 11, 18, 4, 3, 72, K('soil', 1), 0.3); blob(c, 24, 23, 4, 3, 73, K('soil', 0), 0.35)
    for y in range(17, 24):                                                     # 찢김(노란 속)
        a = 15 + hs(0, y, 74) % 2; b = 19 - hs(1, y, 74) % 2
        rc(c, a, y, b - a, 1, K('kii', -1) if y % 2 else K('kii', 0))
    outline(c, 3, 7, 28, 23, ST(-3))
    rc(c, 0, 4, 4, 26, ST(0)); vl(c, 0, 4, 26, K('sumi', 0)); vl(c, 1, 5, 24, ST(2)); vl(c, 3, 4, 26, ST(-2))   # 머리판 기둥(서쪽)
    for y in (10, 18, 25): hl(c, 1, y, 2, ST(-1))
    rust(c, 0, 4, 31, 26, 71, 160)
    hl(c, 0, 30, 31, K('sumi', 0)); hl(c, 2, 31, 28, K('sumi', 0))


@R.obj('hp-curtain-torn', '찢긴 칸막이 커튼', w=1, h=1, up=16, kind='floor', tags=TAGS + ('병실', '병동', '진찰실'),
       place='병실 침대와 침대 사이, 진찰 침대 곁', pair=('hp-bed-rusty',),
       desc='이동식 레일에 걸린 누렇게 바랜 연녹 커튼 — 반쯤 찢겨 왼쪽 천만 너덜너덜 늘어지고 오른쪽은 레일과 쇠 다리만 남았다. 구멍과 얼룩. 통과 못 한다.')
def _curtain_torn(c):
    rc(c, 0, 1, 16, 2, ST(0)); hl(c, 0, 1, 16, ST(2)); hl(c, 0, 3, 16, ST(-2))      # 레일
    for x in (2, 5, 8, 13): px(c, x, 4, ST(1))                                  # 고리(남은 것)
    vl(c, 14, 3, 26, ST(1)); vl(c, 15, 3, 26, ST(-2))                           # 레일 다리(오른쪽)
    # 누렇게 바랜 천: 주름 3px 단위(밝은 마루·중간·골), 아래 끝이 찢겨 길이가 제각각
    ends = (27, 26, 22, 25, 24, 15, 19, 21, 12, 16)
    for x in range(1, 11):
        ph = (x - 1) % 3
        col = K('kinari', 1) if ph == 0 else K('kinari', 0) if ph == 1 else K('kinari', -1)
        e = ends[x - 1]
        vl(c, x, 4, e - 4, col)
        px(c, x, e, K('kinari', -2)); px(c, x, e - 1, K('kinari', -1))
    vl(c, 0, 4, 23, K('kinari', -2)); vl(c, 11, 4, 9, K('kinari', -2))
    for (x, y) in ((3, 9), (4, 10), (7, 14), (2, 19), (8, 7), (5, 21)): px(c, x, y, K('kinari', -2))   # 구멍
    blob(c, 5, 13, 2, 3, 81, K('soil', 1), 0.3)                                 # 얼룩
    for (x, y) in ((12, 5), (12, 6), (13, 8)): px(c, x, y, K('kinari', -1))    # 고리에 남은 천 조각
    hl(c, 0, 29, 16, ST(-1)); rc(c, 1, 29, 2, 2, ST(1)); rc(c, 13, 29, 2, 2, ST(0)); hl(c, 0, 31, 16, K('sumi', 0))


@R.obj('hp-iv-stand', '링거 걸이', w=1, h=1, up=16, kind='floor', tags=TAGS + ('병실', '병동'),
       place='병실 침대 머리 곁', pair=('hp-bed-rusty',),
       desc='녹슨 쇠 링거 걸이 — 꼭대기 갈고리에 쭈그러진 빈 수액 봉지와 늘어진 관, 아래 바퀴 다섯 개 받침.')
def _iv(c):
    hl(c, 3, 2, 10, ST(1)); hl(c, 3, 3, 10, ST(-2)); px(c, 3, 1, ST(2)); px(c, 12, 1, ST(2))   # 갈고리 가로대
    vl(c, 7, 2, 26, ST(2)); vl(c, 8, 2, 26, ST(-1))
    rust(c, 7, 12, 2, 14, 91, 250)
    rc(c, 2, 4, 4, 7, WH(-1)); hl(c, 2, 4, 4, WH(0)); vl(c, 5, 5, 6, WH(-2)); px(c, 3, 7, WH(0)); px(c, 4, 9, WH(-2))   # 쭈그러진 봉지
    outline(c, 1, 3, 6, 9, CN(-2))
    for k in range(10): px(c, 3 + (k // 4), 12 + k, CN(1))                     # 늘어진 관
    rc(c, 5, 26, 6, 2, ST(0)); hl(c, 5, 26, 6, ST(2))
    for (x, y) in ((2, 28), (13, 28), (4, 30), (11, 30), (7, 29)): rc(c, x, y, 2, 2, K('sumi', 0)); px(c, x, y, ST(0))
    line(c, 7, 27, 3, 28, ST(-1)); line(c, 8, 27, 12, 28, ST(-1))


@R.obj('hp-wheelchair', '버려진 휠체어', w=1, h=1, up=8, kind='floor', use=('search',), tags=TAGS + ('병동', '로비', '복도'),
       place='복도 구석·병실 문 곁·로비 한쪽',
       desc='먼지 쌓인 휠체어(남쪽을 향함) — 찢어진 감색 비닐 등받이·좌판, 양옆 큰 바퀴의 녹슨 테, 앞 발판과 작은 앞바퀴.')
def _wheelchair(c):
    rc(c, 4, 9, 8, 9, K('kon', -1)); outline(c, 3, 8, 10, 11, ST(-3)); hl(c, 4, 9, 8, K('kon', 0))   # 등받이
    line(c, 6, 11, 8, 15, K('kinari', -1)); px(c, 9, 12, K('kinari', -2))                      # 찢김
    for x in (3, 12): vl(c, x, 7, 12, ST(1))                                    # 손잡이 기둥
    px(c, 3, 7, K('sumi', 0)); px(c, 12, 7, K('sumi', 0))
    rc(c, 4, 18, 8, 4, K('kon', 0)); hl(c, 4, 18, 8, K('kon', 1)); hl(c, 4, 21, 8, K('kon', -2))   # 좌판 윗면
    for x0 in (0, 13):                                                          # 큰 바퀴(정면에서 세로 테)
        rc(c, x0, 12, 3, 18, K('sumi', 0)); vl(c, x0 + 1, 13, 16, ST(1)); px(c, x0 + 1, 13, ST(3))
        rust(c, x0, 12, 3, 18, 101 + x0, 200)
    hl(c, 3, 22, 10, ST(-1)); vl(c, 5, 22, 5, ST(0)); vl(c, 10, 22, 5, ST(0))
    rc(c, 4, 26, 3, 2, ST(1)); rc(c, 9, 26, 3, 2, ST(1)); hl(c, 4, 26, 3, ST(3)); hl(c, 9, 26, 3, ST(3))   # 발판
    for x in (5, 10): rc(c, x, 28, 2, 2, K('sumi', 0))
    hl(c, 1, 31, 14, K('sumi', 0))
    grime(c, 4, 9, 8, 13, 102, K('kon', -2), 120)


@R.obj('hp-stretcher', '이동 침대(스트레처)', w=2, h=1, up=0, kind='floor', use=('search',), tags=TAGS + ('복도', '수술실', '병동'),
       place='복도 벽 곁·수술실 앞', desc='버려진 이동 침대 2×1 — 얼룩진 흰 비닐 매트와 구겨진 시트, 쇠 난간 한쪽이 내려앉았고 X자 다리 아래 바퀴.')
def _stretcher(c):
    rc(c, 1, 1, 30, 7, WH(-1)); hl(c, 1, 1, 30, WH(0)); vl(c, 1, 1, 7, WH(0)); outline(c, 0, 0, 32, 9, ST(-3))   # 매트 윗면
    for (x, y, n) in ((6, 3, 7), (16, 5, 9), (24, 2, 5)): hl(c, x, y, n, WH(-2))   # 구겨진 주름
    blob(c, 22, 5, 4, 2, 111, K('soil', 1), 0.35)
    hl(c, 1, 8, 30, ST(1)); hl(c, 2, 9, 28, ST(-1))                            # 앞 난간(내려앉음)
    line(c, 20, 8, 30, 10, ST(0))
    for x0, x1 in ((4, 14), (18, 28)):                                          # X 다리
        line(c, x0, 10, x1, 13, ST(-1)); line(c, x1, 10, x0, 13, ST(0))
    rust(c, 0, 8, 32, 6, 112, 200)
    for x in (2, 13, 17, 28): rc(c, x, 13, 2, 2, K('sumi', 0)); px(c, x, 13, ST(0))
    hl(c, 1, 15, 30, K('sumi', 0))


@R.obj('hp-nurse-station', '간호사 스테이션 카운터', w=1, h=1, up=0, kind='floor', surface=True, use=('counter', 'search'), tags=TAGS + ('간호사 스테이션', '병동', '접수'),
       place='병동 복도 가운데, 가로로 이어 붙인다(양 끝 한 칸은 비워 안쪽과 잇는다)',
       desc='간호사 스테이션의 높은 카운터 한 칸 — 긁히고 얼룩진 흰 상판, 칠이 벗겨진 청록 앞판과 먼지 낀 걸레받이. 가로로 이어 붙인다. 위에 서류·물건을 올린다.')
def _nurse_station(c):
    rc(c, 0, 1, 16, 6, WH(-1)); hl(c, 0, 1, 16, WH(0)); hl(c, 0, 0, 16, K('sumi', 0))
    for x in range(16):
        if rnd(x, 3, 121, 120): px(c, x, 3 + hs(x, 0, 122) % 3, WH(-2))       # 긁힌 자국
    px(c, 4, 4, K('soil', 1)); px(c, 5, 4, K('soil', 1)); px(c, 5, 5, K('soil', 0))
    hl(c, 0, 7, 16, WH(0)); hl(c, 0, 8, 16, K('lino', -2))                    # 앞 가장자리 + 처마 그늘
    rc(c, 0, 9, 16, 5, K('lino', -1)); hl(c, 0, 9, 16, K('lino', 0))
    vl(c, 15, 7, 7, K('lino', -2))                                             # 판 이음(이어 붙이면 판마다)
    blob(c, 9, 11, 3, 2, 123, CN(-1), 0.3); px(c, 9, 11, CN(0))                # 벗겨진 칠
    rc(c, 0, 14, 16, 2, CN(-2)); hl(c, 0, 15, 16, K('sumi', 0))


@R.obj('hp-chart-rack', '차트 선반', w=2, h=1, up=16, kind='wall', use=('search', 'read'), tags=TAGS + ('간호사 스테이션', '병동', '진찰실'),
       place='간호사 스테이션·진찰실 북쪽 벽 아래', pair=('hp-nurse-station',),
       desc='먼지 쌓인 쇠 차트 선반 2칸 — 세 단에 색색 진료 차트 바인더가 꽂혀 있다가 반쯤 빠지고 쓰러져 비스듬히 기댔다. 바닥 쪽에 흘러내린 종이. 글자 없음.')
def _chart_rack(c):
    y = block3(c, 0, 4, 32, 28, 4, 'tekko', 0, front_t=-2)
    rust(c, 0, 4, 32, 8, 131, 120)
    cols = ('sora', 'aka', 'kii', 'midori', 'kon', 'daidai', 'pinku')
    for r, yy in enumerate((y + 1, y + 8, y + 15)):
        hl(c, 2, yy + 6, 28, ST(1)); hl(c, 2, yy + 7, 28, ST(-2))
        x = 3
        k = 0
        while x < 28:
            gap = hs(r, k, 132) % 5 == 0
            if gap: x += 3; k += 1; continue
            col = cols[(k + r * 2) % len(cols)]
            lean = r == 1 and k == 4
            if lean:
                for i in range(5): rc(c, x + i, yy + 1 + (4 - i) // 2, 2, 5 - (4 - i) // 2, kc(col, -1))
                x += 6; k += 1; continue
            rc(c, x, yy, 2, 6, kc(col, -1)); px(c, x, yy, kc(col, 0)); px(c, x + 1, yy + 3, WH(-1))
            x += 3; k += 1
    hl(c, 1, 31, 30, K('sumi', 0))


@R.obj('hp-med-cart', '약 카트', w=1, h=1, up=8, kind='floor', use=('search',), tags=TAGS + ('병동', '간호사 스테이션', '처치실'),
       place='간호사 스테이션 곁·복도 벽 곁', desc='녹슨 바퀴 달린 약 카트 — 윗면 쟁반 테두리 안에 쓰러진 약병 둘, 앞 서랍 세 단 중 한 단이 빠져 어두운 속이 보인다.')
def _med_cart(c):
    y = block3(c, 1, 8, 14, 21, 5, 'shiro', -1, olc=CN(-3), front_t=-1)
    rc(c, 3, 10, 3, 2, K('daidai', 0)); px(c, 3, 10, K('daidai', 1))          # 쓰러진 약병(갈색)
    rc(c, 8, 11, 2, 3, WH(1)); px(c, 8, 11, K('aka', 0))                      # 선 약병
    for i, yy in enumerate((y, y + 5, y + 10)):
        if yy + 4 > 28: break
        if i == 1:
            rc(c, 3, yy, 10, 4, K('sumi', 0)); rc(c, 3, yy + 2, 10, 2, WH(-2)); hl(c, 3, yy + 2, 10, WH(-1))   # 빠진 서랍
        else:
            rc(c, 3, yy, 10, 4, WH(-1)); hl(c, 3, yy, 10, WH(0)); hl(c, 3, yy + 3, 10, WH(-2)); hl(c, 6, yy + 1, 4, K('sora', -1))
    rust(c, 1, 8, 14, 21, 141, 60)
    for x in (2, 12): rc(c, x, 29, 2, 2, K('sumi', 0)); px(c, x, 29, ST(0))
    hl(c, 1, 31, 14, K('sumi', 0))


# ══ 수술실·검사 ═══════════════════════════════════════════════════════════════
@R.obj('hp-op-table', '수술대', w=1, h=2, up=8, kind='floor', use=('search',), tags=TAGS + ('수술실',),
       place='수술실 가운데, 위 북쪽 벽에 무영등', pair=('hp-op-light', 'hp-monitor-cart'),
       desc='수술실 가운데의 좁은 수술대 1×2 — 이음선 두 줄로 나뉜 짙은 청록 비닐 패드(갈라짐), 양옆 은색 레일, 가운데 쇠 기둥 하나와 넓은 받침. 사람 없음.')
def _op_table(c):
    """좁은 수술대를 위에서: 한 덩이 짙은 청록 패드(이음선 두 줄로 머리·몸·다리판), 둘레 은색 레일, 앞 끝 두께, 아래 굵은 기둥과 넓은 받침.
    1회차 통짜 짙은 판은 세운 관처럼, 2회차 十자 팔 받침은 서 있는 사람 꼴로 읽혀 뺐다."""
    P = lambda t: K('garasu', t)
    rc(c, 3, 9, 10, 26, P(0)); outline(c, 2, 8, 12, 28, K('sumi', 0))
    hl(c, 3, 9, 10, P(1)); vl(c, 3, 9, 26, P(1)); vl(c, 12, 10, 25, P(-1))
    for y in (14, 28): hl(c, 3, y, 10, P(-2)); hl(c, 3, y + 1, 10, P(1))        # 판 이음
    line(c, 6, 18, 9, 24, K('kinari', 0)); line(c, 7, 18, 10, 24, P(-2))       # 갈라진 패드
    vl(c, 1, 12, 22, CN(1)); vl(c, 14, 12, 22, CN(-1))                         # 레일
    hl(c, 2, 35, 12, CN(2)); rc(c, 2, 36, 12, 2, CN(0)); hl(c, 2, 38, 12, CN(-2))   # 앞 끝(두께)
    rc(c, 6, 39, 4, 5, ST(1)); vl(c, 6, 39, 5, ST(3)); vl(c, 9, 39, 5, ST(-2))   # 기둥
    rc(c, 2, 44, 12, 2, ST(0)); hl(c, 2, 44, 12, ST(2)); hl(c, 2, 46, 12, K('sumi', 0))
    rust(c, 2, 35, 12, 12, 151, 150)
    hl(c, 2, 47, 12, K('sumi', 0))


@R.obj('hp-op-light', '무영등', w=2, kind='hang', hrows=2, use=('light',), tags=TAGS + ('수술실',),
       place='수술실 북쪽 벽면 윗줄, 수술대 바로 위(같은 x)', pair=('hp-op-table',),
       desc='천장에서 꺾인 팔로 내려온 둥근 무영등 2칸 — 흰 갓 안에 둥근 등알 여섯 개가 모두 꺼져 어둡고 하나는 깨졌다. 먼지 낀 손잡이.')
def _op_light(c):
    rc(c, 14, 0, 4, 2, ST(0)); hl(c, 14, 0, 4, ST(2))                          # 천장 받침
    vl(c, 15, 2, 5, ST(1)); vl(c, 16, 2, 5, ST(-2))                            # 팔
    rc(c, 13, 6, 6, 2, ST(0)); hl(c, 13, 6, 6, ST(2))
    disc(c, 16, 17, 14, 10, K('sumi', 0))                                      # 갓
    disc(c, 16, 17, 13, 9, WH(-1))
    disc(c, 15, 15, 11, 6, WH(0))
    disc(c, 16, 18, 10, 6.5, CN(-1))                                           # 안쪽(그늘)
    for (x, y) in ((10, 15), (16, 14), (22, 15), (10, 20), (16, 22), (22, 20)):   # 꺼진 등알
        disc(c, x, y, 2.6, 2.2, K('yoru', -1)); px(c, x - 1, y - 1, GL(0))
    line(c, 21, 19, 24, 22, WH(0)); line(c, 22, 18, 23, 21, K('sumi', 0))      # 깨진 등알
    rc(c, 15, 17, 2, 3, ST(1)); px(c, 15, 17, ST(3))                           # 손잡이
    grime(c, 2, 8, 28, 20, 161, K('shiro', -2), 70)


@R.obj('hp-monitor-cart', '모니터 카트', w=1, h=1, up=16, kind='floor', use=('search',), tags=TAGS + ('수술실', '병동'),
       place='수술대 머리 곁', pair=('hp-op-table',),
       desc='바퀴 달린 생체 모니터 카트 — 금 간 꺼진 화면(어두운 유리에 흐린 녹색 줄 하나), 늘어진 전선, 아래 받침 선반과 녹슨 바퀴.')
def _monitor_cart(c):
    rc(c, 2, 2, 12, 11, CN(-1)); outline(c, 1, 1, 14, 13, K('sumi', 0)); hl(c, 2, 2, 12, CN(0))   # 모니터 틀
    rc(c, 3, 3, 10, 8, K('yoru', -2)); hl(c, 3, 7, 10, K('kokuban', 0)); px(c, 7, 6, K('kokuban', 0))   # 꺼진 화면 + 흐린 줄
    line(c, 4, 3, 10, 10, K('yoru', 1)); px(c, 9, 4, GL(0))                    # 금
    vl(c, 7, 14, 10, ST(1)); vl(c, 8, 14, 10, ST(-2))                          # 기둥
    for k in range(8): px(c, 12 + (k % 2), 13 + k, K('sumi', 0))               # 늘어진 전선
    rc(c, 2, 22, 12, 3, ST(0)); hl(c, 2, 22, 12, ST(2)); hl(c, 2, 25, 12, ST(-2))   # 받침 선반
    rust(c, 2, 22, 12, 4, 171, 220)
    for x in (2, 12): rc(c, x, 28, 2, 2, K('sumi', 0)); px(c, x, 28, ST(0))
    line(c, 7, 26, 3, 28, ST(-1)); line(c, 8, 26, 12, 28, ST(-1))
    hl(c, 1, 31, 14, K('sumi', 0))


@R.obj('hp-xray-box', '엑스레이 판독 상자', w=2, kind='hang', hrows=2, use=('read', 'light'), tags=TAGS + ('진찰실', '검사실'),
       place='진찰실·검사실 북쪽 벽면 윗줄(책상 위)',
       desc='벽의 필름 판독 상자 2칸 — 흰 틀에 판 둘, 왼쪽은 깜박이는 희뿌연 빛에 흐린 회색 필름 한 장(무늬 없는 판), 오른쪽은 꺼져 어둡다. 위 집게.')
def _xray(c):
    rc(c, 1, 4, 30, 20, WH(-1)); outline(c, 0, 3, 32, 22, CN(-3)); hl(c, 1, 4, 30, WH(0))
    rc(c, 3, 6, 12, 15, WH(0)); rc(c, 17, 6, 12, 15, K('yoru', -1))            # 판: 왼쪽 켜짐·오른쪽 꺼짐
    rc(c, 5, 8, 8, 11, CN(0)); outline(c, 4, 7, 10, 13, CN(-2))                # 필름(흐린 회색 판)
    blob(c, 8, 12, 2.5, 3.5, 181, CN(1), 0.4); blob(c, 10, 15, 2, 2, 182, CN(1), 0.4)
    px(c, 3, 6, WH(1)); hl(c, 3, 20, 12, WH(-1))
    rc(c, 18, 8, 10, 10, K('yoru', -2)); line(c, 19, 9, 23, 13, K('yoru', 0))  # 꺼진 판에 금
    for x in (7, 11, 21, 25): rc(c, x, 4, 2, 2, ST(1))                         # 집게
    hl(c, 1, 23, 30, CN(-2)); grime(c, 1, 4, 30, 20, 183, WH(-2), 60)
    rc(c, 14, 24, 4, 3, K('sumi', 0))                                           # 늘어진 전선 끝
    vl(c, 15, 27, 3, K('sumi', 0))


# ══ 지하 영안실·기계 ═══════════════════════════════════════════════════════════
@R.obj('hp-morgue-drawers', '냉장 서랍 벽(영안실)', w=3, h=1, up=16, kind='wall', use=('search', 'open'), tags=TAGS + ('영안실', '지하'),
       place='지하 영안실 북쪽 벽 아래, 타일 벽 앞',
       desc='영안실의 스테인리스 냉장 서랍 벽 3칸 — 네모 문 3×2, 문마다 쇠 레버 손잡이와 색 점 번호판(숫자 없음). 오른쪽 위 문 하나가 반쯤 열려 빈 어둠만 보인다. 녹물과 찌그러짐.')
def _morgue(c):
    y = block3(c, 0, 2, 48, 30, 4, 'conc', 0, olc=K('sumi', 0), front_t=0)
    for r in range(2):
        for k in range(3):
            x0, y0 = 2 + k * 15, y + r * 12
            if r == 0 and k == 2:                                               # 반쯤 열린 문: 빈 어둠
                rc(c, x0, y0, 14, 11, K('sumi', -1)); rc(c, x0 + 1, y0 + 1, 12, 9, K('yoru', -3))
                rc(c, x0 + 11, y0 - 1, 3, 12, CN(1)); vl(c, x0 + 11, y0 - 1, 12, CN(2)); vl(c, x0 + 13, y0 - 1, 12, CN(-2))   # 열려 젖혀진 문짝
                continue
            rc(c, x0, y0, 14, 11, CN(0)); outline(c, x0, y0, 14, 11, CN(-2))
            hl(c, x0 + 1, y0 + 1, 12, CN(1)); vl(c, x0 + 1, y0 + 1, 9, CN(1))
            rc(c, x0 + 9, y0 + 4, 3, 2, ST(2)); px(c, x0 + 9, y0 + 4, ST(3)); px(c, x0 + 11, y0 + 6, ST(-1))   # 레버
            rc(c, x0 + 3, y0 + 3, 3, 2, (K('kii', -1), K('sora', -1), K('midori', -1))[(r + k) % 3])   # 번호판(색 점)
    drip(c, 9, y, 14, K('soil', 0), K('soil', 1)); drip(c, 34, y + 2, 10, K('soil', 0))
    line(c, 20, y + 15, 24, y + 19, CN(-2))                                     # 찌그러짐
    hl(c, 1, 31, 46, K('sumi', 0))


@R.obj('hp-boiler', '보일러', w=2, h=2, up=16, kind='floor', use=('search', 'switch'), tags=TAGS + ('보일러실', '지하', '기계실'),
       place='지하 보일러실 가운데·벽에서 한 줄 띄워', pair=('hp-pipes',),
       desc='지하 보일러실의 큰 원통 보일러 2×2 — 녹이 번진 회색 철판 몸통에 리벳 줄, 위로 솟은 배관과 빨간 밸브 바퀴, 바늘만 남은 압력계, 콘크리트 받침. 꺼져서 차다.')
def _boiler(c):
    rc(c, 13, 0, 4, 6, ST(0)); vl(c, 13, 0, 6, ST(2)); vl(c, 16, 0, 6, ST(-2))   # 위로 솟은 배관
    disc(c, 15, 3, 3, 1.5, K('aka', -1)); px(c, 14, 2, K('aka', 0))              # 밸브 바퀴
    # 몸통(세로 원통): 왼쪽 밝게 → 오른쪽 어둡게
    for x in range(3, 29):
        t = 1 if x < 8 else 0 if x < 18 else -1 if x < 25 else -2
        vl(c, x, 10, 28, ST(t))
    vl(c, 2, 10, 28, K('sumi', 0)); vl(c, 29, 10, 28, K('sumi', 0))
    disc(c, 16, 10, 13.5, 4.5, K('sumi', 0)); disc(c, 16, 10, 12.5, 3.5, ST(1)); disc(c, 14, 9, 8, 2, ST(2))   # 윗면 타원
    for yy in (19, 31):                                                         # 리벳 줄
        hl(c, 3, yy, 26, ST(-2)); hl(c, 3, yy + 1, 26, ST(1))
        for x in range(5, 28, 4): px(c, x, yy - 1, ST(2))
    disc(c, 10, 25, 3.2, 3.2, K('sumi', 0)); disc(c, 10, 25, 2.3, 2.3, WH(-1)); line(c, 10, 25, 11, 23, K('aka', -1))   # 압력계
    rc(c, 24, 22, 6, 3, ST(-1)); hl(c, 24, 22, 6, ST(1))                         # 옆 배관 + 밸브
    disc(c, 30, 23, 1.6, 2.5, K('aka', -1))
    rc(c, 14, 30, 9, 7, K('sumi', 0)); rc(c, 15, 31, 7, 5, K('yoru', -2)); hl(c, 15, 31, 7, ST(-2))   # 버너 점검 문(차갑게 꺼진 어둠)
    rc(c, 20, 33, 2, 1, ST(2))
    rust(c, 3, 8, 26, 30, 191, 110)
    drip(c, 20, 20, 10, RU(-2)); drip(c, 7, 32, 6, RU(-1))
    rc(c, 1, 38, 30, 8, CN(-1)); hl(c, 1, 38, 30, CN(0)); outline(c, 0, 37, 32, 10, K('sumi', 0))   # 받침
    hl(c, 1, 45, 30, CN(-2)); hl(c, 1, 47, 30, K('sumi', 0))


@R.obj('hp-elevator-dead', '멈춘 엘리베이터', w=2, h=1, up=32, kind='wall', use=('search',), tags=TAGS + ('엘리베이터', '로비', '복도'),
       place='로비·복도 북쪽 벽 바로 아래(벽 가구 자리). 멈춰서 이동하지 않는다 — 앞 칸에서 조사.',
       desc='멈춘 엘리베이터 — 녹슨 스테인리스 문 두 짝이 반쯤 벌어져 그 틈으로 어두운 승강로와 늘어진 쇠줄이 보인다. 층 표시 램프는 모두 꺼졌다. 발밑은 막힌다.')
def _elevator_dead(c):
    rc(c, 1, 0, 30, 32, ST(0)); vl(c, 1, 0, 32, ST(2)); vl(c, 30, 0, 32, ST(-2))
    rc(c, 9, 1, 14, 4, K('yoru', -2)); outline(c, 8, 0, 16, 6, ST(-3))
    for x in range(10, 22, 2): px(c, x, 3, K('yoru', 0))                        # 꺼진 램프
    rc(c, 4, 7, 24, 25, K('yoru', -3))                                          # 승강로 어둠
    for x in (13, 18): vl(c, x, 7, 25, ST(-2))                                  # 쇠줄
    for y in range(8, 30, 3): px(c, 13, y, ST(0)); px(c, 18, y + 1, ST(0))
    for x0, w in ((4, 8), (20, 8)):                                             # 반쯤 벌어진 문짝
        rc(c, x0, 8, w, 24, ST(1))
        for x in range(x0 + 1, x0 + w - 1, 3): vl(c, x, 9, 22, ST(2))
        vl(c, x0, 8, 24, ST(3) if x0 == 4 else ST(2)); vl(c, x0 + w - 1, 8, 24, ST(-1))
        hl(c, x0, 8, w, ST(3))
    vl(c, 12, 8, 24, K('sumi', 0)); vl(c, 19, 8, 24, K('sumi', 0))
    rust(c, 1, 0, 30, 32, 201, 90)
    outline(c, 4, 7, 24, 25); outline(c, 0, 0, 32, 32)
    rc(c, 3, 32, 26, 3, ST(1)); hl(c, 3, 32, 26, ST(2)); hl(c, 3, 34, 26, ST(-2))   # 문턱
    rc(c, 12, 32, 8, 3, K('yoru', -3))                                          # 문턱 틈(어둠)
    hl(c, 3, 35, 26, K('sumi', 0))
    for (x, y) in ((6, 38), (24, 40), (10, 43)): px(c, x, y, GL(1))            # 떨어진 유리 가루


# ══ 잔해 ══════════════════════════════════════════════════════════════════════
@R.obj('hp-debris', '잔해 더미', w=1, h=1, up=8, kind='floor', use=('block',), tags=TAGS + ('잔해', '폐허'),
       place='복도·방을 막는 자리(길을 돌게), 무너진 천장 밑', desc='무너진 콘크리트 덩이와 천장판 조각, 녹슨 철근이 쌓인 잔해 더미 1칸. 지나갈 수 없다.')
def _debris(c):
    """무너진 더미: 칸 폭을 다 덮는 낮고 넓은 흙먼지 둔덕(위로 6~8px만 솟는다) 위에 납작하고 모가 난 콘크리트 판들이
    비스듬히 겹친다. 판은 윗면(한 단 밝게)·앞날(어둡게) 두 면, 테두리 없음. 철근 두 가닥이 옆으로 삐져나온다.
    1~3회차: 덩이를 위로 쌓으니 작은 기계·앉은 사람 꼴로 읽혔다 → 낮고 넓게, 어둡게."""
    for y in range(16, 31):                                                     # 넓은 둔덕
        half = 4 + (y - 16) if y < 21 else 8
        for x in range(8 - half, 8 + half):
            if hs(x, y, 212) % 5 or abs(x - 8) < half - 1: px(c, x, y, K('hodo', -2) if y > 25 else K('hodo', -1))
    def slab(x, y, w, top, front, t, tilt=0):
        for j in range(top):
            hl(c, x + (j * tilt) // max(1, top), y + j, w, CN(t + (1 if j else 2)))
        for j in range(front):
            hl(c, x + (top * tilt) // max(1, top), y + top + j, w, CN(t - 1) if j < front - 1 else K('sumi', 0))
    slab(0, 24, 9, 2, 4, -1, 1)
    slab(8, 22, 8, 3, 4, -1, -1)
    slab(2, 19, 7, 3, 3, -1, 0)
    slab(9, 18, 6, 2, 3, -2, 0)
    slab(5, 16, 5, 2, 2, 0, 1)
    rc(c, 10, 15, 5, 2, WH(-2)); hl(c, 10, 15, 5, WH(-1)); hl(c, 10, 17, 5, K('sumi', 0))   # 천장판 조각
    line(c, 0, 17, 5, 22, RU(-1)); line(c, 15, 19, 12, 24, RU(-2))              # 녹슨 철근
    for (x, y) in ((1, 29), (14, 29), (12, 30), (4, 30), (7, 29)): px(c, x, y, CN(-1))   # 부스러기
    hl(c, 1, 31, 14, K('sumi', 0))


@R.obj('hp-papers', '흩어진 서류', kind='flat', use=('walk', 'read'), tags=TAGS + ('잔해', '흔적'),
       place='접수·간호사 스테이션·진찰실 바닥, 서류 상자 곁', desc='바닥에 흩어진 누렇게 바랜 서류 몇 장 — 회색 줄(글자 아님)과 접힌 모서리. 밟고 지나간다.')
def _papers(c):
    sheets = (((2, 3), (8, 1), (10, 7), (4, 9)), ((7, 8), (13, 6), (14, 12), (8, 14)), ((1, 11), (5, 10), (6, 15), (2, 15)))
    for k, pts in enumerate(sheets):
        xs = [p[0] for p in pts]; ys = [p[1] for p in pts]
        for y in range(min(ys), max(ys) + 1):
            for x in range(min(xs), max(xs) + 1):
                # 볼록 사각형 안
                inside = True
                for i in range(4):
                    (ax, ay), (bx, by) = pts[i], pts[(i + 1) % 4]
                    if (bx - ax) * (y - ay) - (by - ay) * (x - ax) < 0: inside = False; break
                if inside: px(c, x, y, (WH(0), K('kinari', 1), WH(-1))[k])
        for i in range(4): line(c, *pts[i], *pts[(i + 1) % 4], (CN(0), K('kinari', -1), CN(-1))[k])
    for (x, y, n) in ((5, 4, 3), (5, 6, 4), (9, 10, 3), (9, 12, 2)): hl(c, x, y, n, CN(0))
    px(c, 8, 2, WH(1)); px(c, 13, 7, K('kinari', -1))


@R.obj('hp-glass', '유리 조각', kind='flat', use=('walk',), tags=TAGS + ('잔해', '흔적'),
       place='깨진 창·유리문·약장 아래 바닥', desc='바닥에 흩어진 깨진 유리 조각 — 날카로운 옅은 푸른 조각과 반짝임. 밟고 지나간다.')
def _glass(c):
    for (pts, t) in ((((2, 3), (6, 2), (4, 7)), 1), (((9, 5), (13, 4), (12, 9)), 0), (((5, 10), (9, 9), (6, 14)), 1),
                     (((11, 11), (14, 13), (10, 14)), 0), (((1, 12), (3, 11), (2, 14)), 2)):
        for i in range(3): line(c, *pts[i], *pts[(i + 1) % 3], GL(t))
        cx = sum(p[0] for p in pts) // 3; cy = sum(p[1] for p in pts) // 3
        px(c, cx, cy, GL(t + 1)); px(c, pts[0][0], pts[0][1], WH(1))
    for (x, y) in ((7, 6), (14, 8), (3, 8), (11, 2)): px(c, x, y, GL(2))


@R.obj('hp-ceiling-fallen', '떨어진 천장판', w=2, h=1, up=8, kind='floor', use=('block',), tags=TAGS + ('잔해', '폐허'),
       place='복도·병실에 떨어져 길을 막는 자리, 위 천장이 뚫린 곳', desc='무너져 내린 흰 석고 천장판 2×1 — 벌레 먹은 듯한 구멍 무늬, 한쪽 끝이 잔해에 걸려 들렸고 위에 깨진 형광등 관과 휜 경량 철골. 지나갈 수 없다.')
def _ceiling_fallen(c):
    # 기울어진 판: 왼쪽이 들림(윗면이 넓게 보임) → 오른쪽이 바닥에 닿음
    for x in range(1, 31):
        top = 9 + (x * 6) // 30; bot = 25 + (x * 2) // 30
        vl(c, x, top, bot - top, WH(-1))
        px(c, x, top, WH(0)); px(c, x, bot, CN(-1)); px(c, x, bot + 1, CN(-2))
    for y in range(9, 28):
        for x in range(2, 30):
            if c.a[y, x, 3] and ((x * 3 + y * 5) % 7 == 0 or rnd(x, y, 221, 60)): px(c, x, y, WH(-2))   # 흡음판 구멍
    outline_pts = (0, 31)
    for x in outline_pts: vl(c, x, 9, 19, K('sumi', 0))
    for x in range(0, 32): px(c, x, 8 + (x * 6) // 30, K('sumi', 0)); px(c, x, 28 + (x * 2) // 30 if x < 31 else 28, K('sumi', 0))
    line(c, 3, 20, 27, 13, ST(1)); line(c, 3, 21, 27, 14, ST(-2))              # 휜 경량 철골
    line(c, 6, 15, 22, 22, WH(1)); line(c, 6, 16, 22, 23, CN(0))               # 깨진 형광등 관
    px(c, 6, 15, CN(-2)); px(c, 22, 22, CN(-2)); px(c, 14, 19, K('sumi', 0))
    for (x, y) in ((2, 29), (12, 30), (25, 30), (29, 29)): px(c, x, y, CN(0))   # 부스러기
    hl(c, 1, 30, 30, K('sumi', 0))


@R.obj('hp-puddle', '물웅덩이', kind='flat', use=('walk',), tags=TAGS + ('잔해', '흔적', '지하'),
       place='새는 천장 밑·지하 바닥·배관 아래', desc='새는 천장에서 떨어진 물이 고인 어두운 웅덩이 — 젖은 테두리, 희미한 반사 줄. 밟고 지나간다.')
def _puddle(c):
    blob(c, 8, 9, 7, 5, 231, K('yoru', 0), 0.25)
    blob(c, 8, 9, 6, 4, 232, GL(-2), 0.25)
    blob(c, 7, 8, 4, 2.5, 233, GL(-1), 0.3)
    hl(c, 4, 7, 3, GL(1)); hl(c, 9, 10, 2, GL(0)); px(c, 4, 7, WH(-1))


def _frame(c, ramp):
    for x0, f in ((0, 1), (13, -1)):
        rc(c, x0, 0, 3, 32, kc(ramp, 0)); vl(c, x0 + (0 if f > 0 else 2), 0, 32, kc(ramp, 2 if f > 0 else -2)); vl(c, x0 + (2 if f > 0 else 0), 4, 28, kc(ramp, -2 if f > 0 else 1))
    rc(c, 0, 0, 16, 4, kc(ramp, 0)); hl(c, 0, 0, 16, kc(ramp, -3)); hl(c, 0, 1, 16, kc(ramp, 2)); hl(c, 0, 3, 16, kc(ramp, -2))


@R.obj('hp-door-broken', '부서진 문', kind='door', use=('travel',), tags=TAGS + ('문', '잔해'),
       place='가로 칸막이 1칸 틈 칸(병실·진찰실·창고 문)', desc='경첩 하나에 매달려 비스듬히 기운 부서진 병원 문 — 칠이 벗겨진 회녹색 문짝, 깨진 작은 창, 쇠 문틀의 녹. 가운데로 지나간다.')
def _door_broken(c):
    _frame(c, 'conc')
    rust(c, 0, 0, 16, 32, 241, 90)
    for v in range(22):                                                         # 기운 문짝(서쪽 기둥 위 경첩에서 아래로 벌어짐)
        y = 5 + v; x0 = 3 + v // 6
        rc(c, x0, y, 4, 1, K('lino', -1) if v % 7 else K('lino', -2))
        px(c, x0, y, K('lino', 0)); px(c, x0 + 3, y, K('sumi', 0))
    for v in range(4, 9):                                                       # 깨진 작은 창
        x0 = 3 + v // 6
        rc(c, x0 + 1, 5 + v, 2, 1, K('yoru', -1))
    px(c, 4, 10, GL(1)); px(c, 7, 22, ST(2))                                    # 남은 유리·손잡이
    blob(c, 5, 18, 1.5, 2, 242, CN(0), 0.3)
    rc(c, 3, 29, 10, 3, CN(-1)); hl(c, 3, 29, 10, CN(1)); hl(c, 3, 31, 10, K('sumi', 0))
    for (x, y) in ((9, 27), (11, 28), (8, 30)): px(c, x, y, CN(0))


@R.obj('hp-door-locked', '체인 감긴 문', kind='door', use=('travel', 'key'), tags=TAGS + ('문', '잠긴 문', '열쇠'),
       place='가로 칸막이 1칸 틈 칸 — 잠긴 문 자리(잠금은 이벤트로 단다, 열쇠는 막다른 방에)',
       desc='쇠사슬이 X자로 감기고 큰 놋쇠 자물쇠가 매달린 닫힌 철문 — 녹슨 회청색 문짝, 철망 유리 작은 창은 어둡다. 맞는 열쇠로 열면 지나간다.')
def _door_locked(c):
    _frame(c, 'tekko')
    rc(c, 3, 4, 10, 25, ST(-1)); hl(c, 3, 4, 10, ST(1)); vl(c, 3, 4, 25, ST(0)); vl(c, 12, 4, 25, ST(-3))   # 닫힌 문짝
    rc(c, 5, 7, 6, 5, K('yoru', -2)); outline(c, 4, 6, 8, 7, ST(-3))
    for (x, y) in ((6, 8), (8, 8), (10, 8), (6, 10), (8, 10), (10, 10)): px(c, x, y, ST(-2))   # 철망
    rust(c, 3, 4, 10, 25, 251, 140)
    for i in range(10):                                                         # 쇠사슬 X
        for (x, y) in ((3 + i, 13 + i), (12 - i, 13 + i)):
            px(c, x, y, ST(2) if i % 2 else ST(0)); px(c, x, y + 1, K('sumi', 0))
    rc(c, 6, 18, 4, 4, K('kii', -1)); hl(c, 6, 18, 4, K('kii', 1)); vl(c, 6, 18, 4, K('kii', 0)); outline(c, 5, 17, 6, 6, K('kii', -2))   # 자물쇠
    ring(c, 8, 17, 2, 2, ST(1)); px(c, 8, 20, K('sumi', 0))
    rc(c, 3, 29, 10, 3, ST(-1)); hl(c, 3, 29, 10, ST(1)); hl(c, 3, 31, 10, K('sumi', 0))


@R.obj('hp-light-flicker', '깨진 형광등', w=2, kind='hang', hrows=2, use=('light',), tags=TAGS + ('잔해', '조명'),
       place='복도·병실 북쪽 벽면 윗줄', desc='한쪽 줄이 끊겨 비스듬히 매달린 형광등 2칸 — 관 하나는 깨져 끝만 남았고 다른 하나는 희미하게 깜박인다. 늘어진 전선.')
def _light_flicker(c):
    vl(c, 3, 0, 4, K('sumi', 0)); vl(c, 28, 0, 3, K('sumi', 0))                 # 매단 줄(오른쪽은 끊김)
    for k in range(6): px(c, 28 + (k % 2), 3 + k, K('sumi', 0))
    for i in range(27):                                                         # 기운 등기구(왼쪽 위 → 오른쪽 아래)
        x = 2 + i; y = 4 + (i * 12) // 27
        rc(c, x, y, 1, 5, WH(-1)); px(c, x, y, WH(0)); px(c, x, y + 4, CN(-2)); px(c, x, y - 1, K('sumi', 0)); px(c, x, y + 5, K('sumi', 0))
        if i < 22: px(c, x, y + 2, WH(1))                                       # 깜박이는 관
        if i < 6 or i > 20: px(c, x, y + 3, K('sumi', 0))                       # 깨진 관: 양 끝만
        else: px(c, x, y + 3, K('yoru', -1))
    vl(c, 2, 3, 6, K('sumi', 0)); vl(c, 29, 15, 6, K('sumi', 0))
    for k in range(8): px(c, 20 + k // 3, 20 + k, K('sumi', 0))                # 늘어진 전선


# ══ 보물·단서 ══════════════════════════════════════════════════════════════════
@R.obj('hp-item-medkit', '구급함', w=1, h=1, up=0, kind='floor', use=('search', 'heal'), tags=TAGS + ('보물', '단서', '구급'),
       place='막다른 방(약제실·처치실·창고)의 바닥·선반 아래', desc='바닥에 놓인 흰 구급함 — 손잡이와 초록 띠(십자 표지 대신), 걸쇠 둘. 먼지가 앉았지만 열 수 있다.')
def _medkit(c):
    y = block3(c, 2, 4, 12, 11, 4, 'shiro', 0, olc=CN(-3), front_t=0)
    rc(c, 6, 2, 4, 2, CN(-1)); hl(c, 6, 2, 4, CN(1)); px(c, 6, 3, K('sumi', 0)); px(c, 9, 3, K('sumi', 0))   # 손잡이
    hl(c, 3, y, 10, K('midori', 0)); hl(c, 3, y + 1, 10, K('midori', -1))       # 초록 띠
    for x in (4, 11): px(c, x, y + 3, ST(2))                                    # 걸쇠
    grime(c, 3, 5, 10, 3, 261, WH(-2), 200)
    hl(c, 2, 15, 12, K('sumi', 0))


@R.obj('hp-item-keybox', '열쇠함', w=1, kind='hang', hrows=2, use=('search', 'key'), tags=TAGS + ('보물', '열쇠', '간호사 스테이션'),
       place='간호사 스테이션·경비실·보일러실 벽면 윗줄(막다른 곳)', desc='벽에 걸린 작은 쇠 열쇠함 — 문이 열려 있고 안쪽 고리 두 단에 색 꼬리표 달린 열쇠가 몇 개 남았다. 놋쇠 열쇠 하나가 반짝인다.')
def _keybox(c):
    rc(c, 3, 6, 10, 15, ST(-2)); outline(c, 2, 5, 12, 17, K('sumi', 0)); hl(c, 3, 6, 10, ST(0))   # 함 안쪽
    for yy in (9, 15): hl(c, 4, yy, 8, ST(1))
    for (x, yy, col) in ((5, 10, 'aka'), (8, 10, 'kii'), (5, 16, 'sora'), (10, 16, 'midori')):
        vl(c, x, yy, 2, K('kii', 0) if col == 'kii' else ST(1)); px(c, x, yy + 2, kc(col, -1)); px(c, x + 1, yy + 2, kc(col, -1))
    px(c, 8, 10, K('kii', 2)); px(c, 9, 11, K('kii', 1))                        # 반짝이는 놋쇠 열쇠
    rc(c, 13, 5, 2, 17, ST(0)); vl(c, 13, 5, 17, ST(2)); vl(c, 14, 5, 17, ST(-2))   # 열린 문짝(옆면)
    rust(c, 2, 5, 13, 17, 271, 100)
    hl(c, 3, 22, 10, K('sumi', 0))


@R.obj('hp-item-records', '진료 기록 상자', w=1, h=1, up=8, kind='floor', use=('search', 'read'), tags=TAGS + ('단서', '기록', '창고'),
       place='막다른 방(진찰실 구석·창고·영안실 사무 자리) 바닥', pair=('hp-papers',),
       desc='뚜껑이 열린 골판지 상자에 누런 진료 기록 서류철이 빽빽이 꽂혀 몇 개는 비스듬히 솟았다. 단서를 찾는 자리. 글자 없음.')
def _records(c):
    for x0, h, col in ((4, 7, 'kinari'), (7, 9, 'kinari'), (10, 6, 'sora')):    # 솟은 서류철
        rc(c, x0, 18 - h, 3, h, kc(col, 0) if col == 'kinari' else kc(col, -1)); hl(c, x0, 18 - h, 3, kc(col, 1)); vl(c, x0 + 2, 18 - h, h, kc(col, -1) if col == 'kinari' else kc(col, -2))
    rc(c, 2, 11, 3, 3, K('ita', 1)); line(c, 2, 11, 0, 9, K('ita', 1))          # 열린 뚜껑 날개
    rc(c, 12, 11, 3, 3, K('ita', 0)); line(c, 14, 11, 15, 8, K('ita', 0))
    y = block3(c, 1, 14, 14, 16, 3, 'ita', 0, olc=K('ita', -3), front_t=0)
    hl(c, 2, 15, 12, K('kinari', 1))
    hl(c, 2, y + 3, 12, K('ita', -1)); px(c, 5, y + 6, K('ita', 2)); px(c, 10, y + 7, K('ita', -2))
    hl(c, 1, 30, 14, K('sumi', 0))
    for (x, y_) in ((0, 29), (15, 28)): px(c, x, y_, K('kinari', 1))


@R.obj('hp-item-locker', '찌그러진 사물함', w=1, h=1, up=16, kind='wall', use=('search', 'open'), tags=TAGS + ('보물', '탈의실', '진찰실'),
       place='진찰실·탈의실·경비실 북쪽 벽 아래(막다른 곳)', desc='칠이 바래고 찌그러진 철제 사물함 — 위아래 문 중 위 문이 비스듬히 벌어져 어두운 속이 보인다. 녹 줄과 통풍 슬릿.')
def _locker(c):
    y = block3(c, 1, 3, 14, 29, 4, 'sora', -1, olc=K('sumi', 0), front_t=-1)
    rc(c, 3, y, 10, 10, K('yoru', -2)); hl(c, 3, y + 3, 10, ST(-1))             # 열린 위 칸 속
    rc(c, 11, y - 1, 3, 11, K('sora', 0)); vl(c, 11, y - 1, 11, K('sora', 1)); vl(c, 13, y - 1, 11, K('sora', -2))   # 벌어진 문짝
    rc(c, 3, y + 11, 10, 12, K('sora', -1)); hl(c, 3, y + 11, 10, K('sora', 0)); vl(c, 12, y + 11, 12, K('sora', -2))
    for i in range(3): hl(c, 5, y + 13 + i * 2, 5, K('sora', -2))
    px(c, 10, y + 18, ST(2))
    line(c, 4, y + 20, 7, y + 22, K('sora', -2))                                # 찌그러짐
    rust(c, 1, 3, 14, 29, 281, 110); drip(c, 4, y + 11, 8, RU(-2))
    hl(c, 1, 31, 14, K('sumi', 0))


# ══ 덧붙인 잔해·로비 ═════════════════════════════════════════════════════════
@R.obj('hp-chair-fallen', '넘어진 대기 의자', w=1, h=1, up=0, kind='floor', use=('block',), tags=TAGS + ('로비', '대기실', '잔해'),
       place='로비·대기실 바닥, 대기 의자 줄 곁', desc='뒤로 넘어진 한 사람 대기 의자 — 바랜 파란 비닐 좌판이 앞으로 서고 쇠 다리 넷이 위로 들렸다.')
def _chair_fallen(c):
    rc(c, 2, 8, 12, 5, K('sora', -1)); hl(c, 2, 8, 12, K('sora', 0)); outline(c, 1, 7, 14, 7, K('sumi', 0))   # 좌판(앞으로 섬)
    line(c, 4, 10, 7, 11, K('kinari', -1))                                     # 찢김
    rc(c, 3, 3, 10, 4, K('sora', -2)); outline(c, 2, 2, 12, 6, K('sumi', 0)); hl(c, 3, 3, 10, K('sora', -1))   # 등판(바닥에 누움)
    for x in (3, 12): vl(c, x, 0, 8, ST(1)); px(c, x, 0, ST(3))                 # 들린 다리
    for x in (5, 10): vl(c, x, 1, 6, ST(0))
    rc(c, 2, 13, 12, 1, ST(-1)); hl(c, 1, 14, 14, K('sumi', 0))


@R.obj('hp-shelf-fallen', '넘어진 쇠 선반', w=2, h=1, up=8, kind='floor', use=('block', 'search'), tags=TAGS + ('창고', '약제실', '잔해'),
       place='창고·약제실 바닥(길을 막는다)', desc='앞으로 엎어진 회색 쇠 선반 2×1 — 뒤판과 기둥이 위로 보이고, 밑으로 흘러나온 약 상자와 병 조각. 지나갈 수 없다.')
def _shelf_fallen(c):
    rc(c, 1, 10, 30, 12, ST(-1)); outline(c, 0, 9, 32, 14, K('sumi', 0)); hl(c, 1, 10, 30, ST(1))   # 뒤판 윗면
    for x in (1, 15, 30): vl(c, x, 10, 12, ST(1))
    for y in (13, 17): hl(c, 2, y, 28, ST(-2))
    rust(c, 1, 10, 30, 12, 291, 120)
    hl(c, 1, 22, 30, ST(0)); hl(c, 1, 23, 30, ST(-2))                          # 앞 가장자리(기둥 끝)
    for (x, y, col) in ((3, 24, 'kinari'), (12, 25, 'shiro'), (22, 24, 'kinari'), (27, 26, 'sora')):   # 흘러나온 상자
        rc(c, x, y, 4, 3, kc(col, 0)); hl(c, x, y, 4, kc(col, 1)); hl(c, x, y + 3, 4, K('sumi', 0))
    for (x, y) in ((8, 27), (18, 28), (9, 26)): px(c, x, y, GL(1))
    hl(c, 1, 29, 30, K('sumi', 0))


@R.obj('hp-emergency-light', '비상등', w=1, kind='hang', hrows=2, use=('light',), tags=TAGS + ('조명', '비상구', '복도'),
       place='복도·계단 문 위 벽면 윗줄', desc='벽 위쪽의 작은 비상등 — 흰 상자에 희미한 초록 빛 판(그림·글자 없음)과 빨간 점멸 점. 꺼진 형광등 사이에서 유일한 빛.')
def _emergency(c):
    rc(c, 2, 3, 12, 7, WH(-1)); outline(c, 1, 2, 14, 9, CN(-3)); hl(c, 2, 3, 12, WH(0))
    rc(c, 3, 5, 8, 4, K('midori', 0)); hl(c, 3, 5, 8, K('midori', 1)); px(c, 4, 6, K('midori', 2))
    disc(c, 12, 7, 1.2, 1.2, K('aka', 1)); px(c, 12, 6, K('aka', 2))
    for (x, y) in ((4, 12), (6, 13), (9, 12), (11, 13)): px(c, x, y, K('midori', -2))   # 벽에 번진 초록 기운(어두운 점)


@R.obj('hp-pipes', '드러난 배관', w=2, kind='hang', hrows=2, tags=TAGS + ('보일러실', '지하', '기계실'),
       place='지하 보일러실·복도 북쪽 벽면 윗줄', pair=('hp-boiler',),
       desc='벽을 따라 가로로 지나는 녹슨 배관 두 줄 — 이음 플랜지와 빨간 밸브 바퀴, 이음에서 새어 벽을 타고 흐른 물때.')
def _pipes(c):
    for y0, t in ((5, 0), (13, -1)):
        rc(c, 0, y0, 32, 4, ST(t)); hl(c, 0, y0, 32, ST(t + 2)); hl(c, 0, y0 + 3, 32, ST(t - 2)); hl(c, 0, y0 + 4, 32, K('sumi', 0))
        for x0 in (6, 22):
            rc(c, x0, y0 - 1, 3, 6, ST(t + 1)); vl(c, x0, y0 - 1, 6, ST(t + 2)); vl(c, x0 + 2, y0 - 1, 6, ST(t - 2))
    rust(c, 0, 4, 32, 14, 301, 150)
    disc(c, 15, 4, 3, 1.6, K('aka', -1)); px(c, 14, 3, K('aka', 0)); vl(c, 15, 4, 2, ST(1))   # 밸브 바퀴
    for k in range(10): px(c, 23, 18 + k, GL(-1) if k % 3 else GL(0))         # 새는 물
    for (x, y) in ((4, 20), (26, 22)): px(c, x, y, RU(-2))


def _bench(c, d):
    """이어진 대기 의자 3인(병원 로비) — 바랜 청회색 비닐(garasu 낮은 채도), 쇠 가로대 다리.
    남향: 이어진 낮은 등받이(뒤) + 앞으로 나온 좌판 셋(밝은 윗면). 북향: 좌판 앞 끝이 등받이 뒷면 위로 조금 보인다(의원 소파와 같은 짜임).
    1·2회차: 자리마다 네모 판을 둘러 창·화면처럼 읽혔다 → 등받이를 한 덩이로."""
    V = lambda t: K('garasu', t)
    if d == 's':
        rc(c, 2, 8, 44, 6, V(0)); hl(c, 2, 8, 44, V(1)); hl(c, 2, 13, 44, V(-2)); outline(c, 1, 7, 46, 8, K('sumi', 0))   # 이어진 등받이
        for k in range(3):
            x0 = 1 + k * 15
            rc(c, x0 + 1, 15, 13, 6, V(1)); hl(c, x0 + 1, 15, 13, V(2)); vl(c, x0 + 1, 15, 6, V(2)); vl(c, x0 + 13, 15, 6, V(0))   # 좌판 윗면
            hl(c, x0 + 1, 21, 13, V(-1)); hl(c, x0 + 1, 22, 13, V(-2))
            outline(c, x0, 14, 15, 10, K('sumi', 0))
        for y in range(16, 21): rc(c, 21 + (y - 16) // 2, y, 4, 1, K('kii', -1) if y % 2 else K('kii', 0))   # 가운데 자리 찢김
        line(c, 34, 9, 37, 12, V(-2))
    else:
        for k in range(3):
            x0 = 1 + k * 15
            rc(c, x0 + 1, 10, 13, 3, V(1)); hl(c, x0 + 1, 10, 13, V(2)); outline(c, x0, 9, 15, 5, K('sumi', 0))   # 좌판 앞 끝
        rc(c, 2, 14, 44, 9, V(-1)); hl(c, 2, 14, 44, V(0)); vl(c, 2, 14, 9, V(0)); hl(c, 2, 22, 44, V(-2))   # 이어진 등받이 뒷면
        for x in (16, 31): vl(c, x, 15, 7, V(-2))
        outline(c, 1, 13, 46, 11, K('sumi', 0))
        line(c, 19, 16, 24, 21, K('kinari', -1)); line(c, 20, 16, 25, 21, V(-2))
    hl(c, 1, 24, 46, ST(1)); hl(c, 1, 25, 46, ST(-2))                           # 쇠 가로대
    for x in (3, 23, 43): rc(c, x, 26, 2, 4, ST(0)); px(c, x, 26, ST(2))
    rust(c, 0, 24, 48, 7, 311 + (d == 'n'), 160)
    grime(c, 1, 7, 46, 17, 313, V(-1), 40)
    hl(c, 1, 30, 46, K('sumi', 0)); hl(c, 3, 31, 42, K('sumi', 0))


for _d, _ko, _face in (('s', '남향', '남쪽(앞)'), ('n', '북향', '북쪽(접수·창구)')):
    def _reg(d=_d, ko=_ko, face=_face):
        @R.obj('hp-bench-torn-' + d, '찢긴 대기 의자 3인(%s)' % ko, w=3, h=1, up=16, kind='floor', use=('sit',), facing=d.upper(),
               tags=TAGS + ('로비', '대기실'), place='대기 로비 — %s을 보고 줄지어' % face,
               desc='병원 로비의 이어진 대기 의자 3인 — 바랜 파란 비닐 좌석, 한 자리가 찢겨 노란 속이 비친다. 녹슨 쇠 가로대. %s을 보고 앉는다.' % face)
        def _f(c): _bench(c, d)
    _reg()


def build(): return R.build()
def selftest(): return R.selftest()


if __name__ == '__main__':
    sys.exit(1 if run_block(R, os.path.join(ROOT, 'tiledata', 'jp-city', 'blocks', BLOCK)) else 0)
