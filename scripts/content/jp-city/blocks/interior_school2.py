#!/usr/bin/env python3
"""jp_city 시설 실내 — 학교 보강(일본 중·고등학교). id 머리 `sx-`.

복도·昇降口(소화전·소화기·트로피 진열장·작품 전시·우산꽂이·분리수거·연결 의자·청소 양동이), 교실 벽(스피커·학급 표찰),
교무실·인쇄실(교원 우편 칸·윤전 인쇄기), 음악실(팀파니·드럼·실로폰), 도서실(북 트럭·신문 걸이), 옥상(벤치·환기 갓·실외기).
이미 있는 것(interior_school `sc-`: 칠판·교탁·책상·사물함·신발장·교무 책상·피아노·실험대·서가 …)은 다시 그리지 않는다 — 그 결(나무 yuka·쇠 tekko·녹색)에 맞춘다.
칸 16px = 1m, 3/4 시점(윗면 + 남쪽 앞면), 빛 왼위, 외곽선 sumi, 팔레트 modern3 램프만(엔진 px.py). 글자·숫자·상표·사람 없음.

  python3 scripts/content/jp-city/blocks/interior_school2.py     # 검사 + _all-x3.png + _gate/*.png + items.jsonl
"""
import os, sys
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, '..', 'interior'))
from inst import Inst, main, furn, drawer, glass, paper, books, rnd, h32, ell_fill, NT, MI   # noqa: E402

BLOCK = 'interior_school2'
I = Inst(BLOCK, '학교 보강')
R = I.R
TAGS = ('학교', '学校', 'school')


def ol_rect(c, x, y, w, h, t=1):
    c.HL(x, y, w, 'sumi', t); c.HL(x, y + h - 1, w, 'sumi', t); c.VL(x, y, h, 'sumi', t); c.VL(x + w - 1, y, h, 'sumi', t)


def ring(c, cx, cy, rx, ry, top, rim, inner=None, rim_w=0.62):
    """위에서 본 둥근 윗면: 테(rim) + 속(top). inner=(mat,t) 이면 속 아래쪽 반을 한 단 어둡게(오목)."""
    def f(x, y, dx, dy, d):
        if d > rim_w:
            # 테: 왼위 밝게, 오른아래 어둡게
            m, t = rim
            if dx + dy < -0.5: t += 1
            elif dx + dy > 0.6: t -= 1
            return (m, t)
        m, t = top
        if inner and dy < -0.1: return inner
        return (m, t)
    c.ell(cx, cy, rx, ry, f)


def box(c, x, y, w, h, top, tm, tt, fm=None, ft=None, ol=True):
    """3/4 상자(hospital 과 같은 결): 윗면 top 행(뒤 가장자리 어둡게·왼쪽 밝게·앞 모서리 반사) + 앞면(입술 밑 그늘·왼 빛·오른 그늘) + sumi 윤곽."""
    fm = fm or tm
    ft = tt - 1 if ft is None else ft
    nt = NT[MI[tm]]; nf = NT[MI[fm]]
    c.R(x, y, w, top, tm, tt)
    c.HL(x, y + 1, w, tm, tt - 1)
    c.VL(x + 1, y + 1, top - 2, tm, min(nt - 1, tt + 1))
    c.HL(x + 1, y + top - 1, w - 2, tm, min(nt - 1, tt + 1))
    c.R(x, y + top, w, h - top, fm, ft)
    c.HL(x, y + top, w, fm, max(0, ft - 2))
    c.VL(x + 1, y + top + 1, h - top - 2, fm, min(nf - 1, ft + 1)); c.VL(x + w - 2, y + top + 1, h - top - 2, fm, max(0, ft - 1))
    c.HL(x, y + h - 2, w, fm, max(0, ft - 1))
    if ol:
        c.HL(x, y, w, 'sumi', 1); c.HL(x, y + h - 1, w, 'sumi', 0); c.VL(x, y, h, 'sumi', 1); c.VL(x + w - 1, y, h, 'sumi', 1)
    return y + top


# ═══════════════ 복도·昇降口 ═══════════════
@I.obj('sx-hydrant-box', '옥내 소화전함(빨간 함·위 표시등)', 'wall_mounted', w=1, kind='hang', hrows=2, use=('open',),
       tags=TAGS + ('복도', '소화전', '消火栓'), place='복도 북쪽 벽면 윗줄 — 계단·현관 가까이, 교실 문을 피해',
       desc='복도 벽에 붙은 빨간 옥내 소화전함 — 두께가 보이는 철제 함(윗면 밝은 테, 아래 그늘), 앞문 테두리와 손잡이, 함 위 둥근 빨간 표시등. 글자 없음.')
def _(c):
    # 표시등(둥근 갓 + 쇠 받침)
    c.R(6, 1, 4, 1, 'aka', 3); c.R(5, 2, 6, 2, 'aka', 4); c.P(6, 2, 'pinku', 4); c.HL(5, 4, 6, 'aka', 2)
    c.HL(6, 5, 4, 'tekko', 3)
    ol_rect(c, 5, 1, 6, 1); c.VL(4, 2, 3, 'sumi', 1); c.VL(11, 2, 3, 'sumi', 1); c.P(5, 1, None, 0); c.P(10, 1, None, 0)
    # 함: 윗면(두께) 3행 + 앞면
    x, y, w, h = 1, 6, 14, 22
    c.R(x, y, w, 3, 'aka', 4); c.HL(x, y + 1, w, 'aka', 3); c.HL(x + 1, y, w - 2, 'aka', 4); c.HL(x, y + 2, w, 'aka', 3)
    c.R(x, y + 3, w, h - 3, 'aka', 2)
    c.HL(x, y + 3, w, 'aka', 3)                        # 앞 모서리 반사
    c.VL(x + 1, y + 3, h - 5, 'aka', 3); c.VL(x + w - 2, y + 3, h - 5, 'aka', 1)
    # 앞문(테 + 속판) + 손잡이
    c.R(x + 3, y + 5, w - 6, h - 10, 'aka', 2)
    c.HL(x + 3, y + 5, w - 6, 'aka', 1); c.VL(x + 3, y + 5, h - 10, 'aka', 1)
    c.HL(x + 3, y + h - 6, w - 6, 'aka', 3); c.VL(x + w - 4, y + 5, h - 10, 'aka', 3)
    c.R(x + 4, y + 7, 2, h - 14, 'aka', 3)               # 문 판 반사 세로
    c.VL(x + w - 6, y + 9, 5, 'tekko', 5); c.VL(x + w - 5, y + 9, 5, 'tekko', 3)
    # 아래 면(그늘 2행) + 윤곽 + 벽 그늘
    c.HL(x, y + h - 2, w, 'aka', 1); c.HL(x, y + h - 1, w, 'aka', 0)
    ol_rect(c, x - 1, y - 1, w + 2, h + 1)
    c.HL(x, y + h, w, 'sumi', 0)


@I.obj('sx-extinguisher', '소화기(받침 위)', 'round_body', w=1, h=1, up=8, use=('search',),
       tags=TAGS + ('복도', '소화기', '消火器'), place='복도 벽 곁·계단참·교실 문 옆 바닥',
       desc='빨간 소화기 — 위에서 보이는 둥근 어깨와 검은 손잡이 꼭지, 몸통을 타고 내려오는 검은 호스, 발밑 작은 철판 받침.')
def _(c):
    # 캔버스 16×32. 받침판(윗면 6행 y22~27 + 앞 2행) 위에 원통, 원통 위 어깨 타원 윗면 7행 + 밸브.
    box(c, 0, 22, 16, 10, 6, 'tekko', 4, 'tekko', 2)
    for yy in (24, 26): c.HL(2, yy, 12, 'tekko', 3)          # 판 줄무늬(미끄럼 방지)
    # 몸통(원통 x3~12): 왼 밝게 → 오른 어둡게, 밑은 판 윗면 위에 선다
    x0, x1, y0, y1 = 3, 12, 12, 27
    tone = {3: 2, 4: 3, 5: 4, 6: 4, 7: 3, 8: 3, 9: 2, 10: 2, 11: 1, 12: 1}
    for x in range(x0, x1 + 1): c.VL(x, y0, y1 - y0, 'aka', tone[x])
    c.HL(x0, y1 - 1, x1 - x0 + 1, 'aka', 0)
    c.HL(x0 - 1, y1, x1 - x0 + 3, 'sumi', 0)                 # 판 위 접지 그늘
    c.R(4, 19, 7, 3, 'shiro', 3); c.HL(4, 19, 7, 'shiro', 4); c.HL(4, 21, 7, 'shiro', 2)   # 라벨 띠(글자 없음)
    # 어깨 윗면(타원 7행): 둥근 판, 왼위 밝게 · 테 어둡게
    def top(x, y, dx, dy, d):
        if d > 0.78: return ('aka', 1 if dx > 0.1 or dy > 0.3 else 2)
        if dx + dy < -0.35: return ('aka', 4)
        return ('aka', 3)
    c.ell(7.5, 11.5, 5, 3.6, top)
    c.P(5, 10, 'pinku', 4)                                      # 어깨 반사
    # 밸브(위에서 본 쇠 목) + 검은 손잡이(왼으로 누운 레버 윗면)
    c.R(6, 8, 3, 4, 'tekko', 4); c.HL(6, 8, 3, 'tekko', 6); c.VL(8, 9, 3, 'tekko', 2)
    c.R(2, 6, 6, 2, 'yoru', 3); c.HL(2, 6, 6, 'yoru', 5); c.HL(2, 8, 4, 'yoru', 1)
    c.R(8, 5, 3, 3, 'yoru', 2); c.HL(8, 5, 3, 'yoru', 4)
    # 호스: 밸브 오른쪽에서 몸통 오른쪽을 타고 내려온다
    c.P(11, 7, 'yoru', 2); c.P(12, 8, 'yoru', 2); c.P(13, 9, 'yoru', 2)
    c.VL(13, 10, 10, 'yoru', 2); c.VL(14, 11, 8, 'yoru', 1); c.P(13, 20, 'yoru', 3); c.R(12, 20, 2, 2, 'yoru', 1)
    # 윤곽
    for y in range(12, 27):
        c.P(2, y, 'sumi', 1)
        if not c.on(13, y): c.P(13, y, 'sumi', 1)
    for x in range(0, 16):
        for y in range(4, 16):
            if c.on(x, y) and not c.on(x, y - 1): c.P(x, y - 1, 'sumi', 1); break


@I.obj('sx-trophy-case', '트로피 유리 진열장', 'tall_furniture', w=2, h=1, up=24, kind='wall', use=('read', 'search'),
       tags=TAGS + ('복도', '현관', '트로피', '진열장'), place='현관 홀·교무실 앞 복도 북쪽 벽 앞',
       desc='부활동 트로피 진열장 2칸 — 짙은 나무 윗면, 유리 두 칸 속 선반 2단에 금·은 트로피와 상패·메달, 유리에 비스듬한 반사, 아래 나무 문 받침장.')
def _(c):
    # 캔버스 32×48. 몸통 y5~46: 윗면 8행(y5~12, 밝은 나무 판 + 위에 올린 우승기·작은 컵) + 앞면(유리 두 칸 + 받침장)
    y1 = box(c, 0, 5, 32, 42, 8, 'ita', 5, 'ita', 2)
    for i in range(2, 30):                                   # 윗판 나뭇결(가로로 긴 덩이)
        for j in range(2, 7):
            r = rnd(i // 4, j, 61)
            if r < 0.16: c.P(i, 5 + j, 'ita', 4)
            elif r > 0.92: c.P(i, 5 + j, 'ita', 6)
    # 윗면에 올린 물건: 접은 우승기(흰 천 + 빨간 테) · 작은 금컵(그림자 포함)
    c.R(3, 7, 9, 4, 'shiro', 4); c.HL(3, 10, 9, 'shiro', 2); c.HL(3, 7, 9, 'aka', 3); c.VL(11, 7, 4, 'aka', 2)
    c.HL(4, 11, 9, 'ita', 3)
    c.R(22, 3, 5, 3, 'kii', 3); c.HL(22, 3, 5, 'kii', 4); c.P(26, 4, 'kii', 1); c.P(21, 4, 'kii', 3); c.P(27, 4, 'kii', 1)
    c.R(23, 6, 3, 2, 'kii', 2); c.R(22, 8, 5, 2, 'yoru', 2); c.HL(22, 8, 5, 'yoru', 4); c.HL(22, 10, 6, 'ita', 3)
    c.HL(21, 2, 7, 'sumi', 1); c.VL(20, 3, 2, 'sumi', 1); c.VL(28, 3, 2, 'sumi', 1)
    # 유리 몸(y14~31): 나무 틀 + 속
    for gx in (3, 17):
        gw = 12
        c.R(gx, y1 + 1, gw, 18, 'garasu', 1)                  # 진열장 속(어두운 뒤판)
        c.HL(gx, y1 + 1, gw, 'garasu', 0)
        c.HL(gx, y1 + 9, gw, 'garasu', 4); c.HL(gx, y1 + 10, gw, 'garasu', 2)   # 유리 선반
        c.HL(gx, y1 + 18, gw, 'ita', 1)
    def cup(x0, y0, mat, hi):
        c.R(x0, y0, 5, 3, mat, hi - 1); c.HL(x0, y0, 5, mat, hi); c.P(x0 + 4, y0 + 1, mat, hi - 2)
        c.P(x0 - 1, y0 + 1, mat, hi - 1); c.P(x0 + 5, y0 + 1, mat, hi - 2)     # 손잡이
        c.R(x0 + 1, y0 + 3, 3, 1, mat, hi - 2); c.P(x0 + 2, y0 + 4, mat, hi - 2)
        c.R(x0 + 1, y0 + 5, 3, 2, 'yoru', 2); c.HL(x0 + 1, y0 + 5, 3, 'yoru', 4)
    t0 = y1 + 2
    cup(5, t0, 'kii', 4); cup(19, t0, 'tekko', 6)
    c.R(11, t0 + 2, 3, 3, 'kii', 3); c.HL(11, t0 + 2, 3, 'kii', 4); c.R(11, t0 + 5, 3, 2, 'yoru', 2)
    c.R(25, t0 + 1, 3, 4, 'tekko', 5); c.P(25, t0 + 1, 'tekko', 6); c.R(25, t0 + 5, 3, 2, 'yoru', 3)
    b0 = y1 + 12
    c.R(4, b0, 6, 6, 'ita', 3); c.HL(4, b0, 6, 'ita', 5); c.R(5, b0 + 1, 4, 3, 'kii', 3); c.HL(5, b0 + 1, 4, 'kii', 4)
    c.R(11, b0 + 2, 3, 4, 'yoru', 3); c.R(11, b0 + 1, 3, 2, 'kii', 4); c.P(12, b0, 'aka', 3)
    c.R(18, b0, 5, 6, 'kon', 3); c.HL(18, b0, 5, 'kon', 4); c.R(19, b0 + 2, 3, 2, 'tekko', 6)
    c.R(24, b0 + 1, 4, 5, 'ita', 3); c.HL(24, b0 + 1, 4, 'ita', 4); c.R(25, b0 + 2, 2, 2, 'kii', 4)
    for gx in (3, 17):                                        # 유리 반사(사선 두 줄)
        for (sx, ln) in ((1, 7), (4, 4)):
            for j in range(ln): c.P(gx + sx + j, y1 + 1 + ln - j, 'garasu', 5)
        c.HL(gx, y1 + 1, 3, 'garasu', 4)
    c.VL(15, y1 + 1, 18, 'ita', 3); c.VL(16, y1 + 1, 18, 'ita', 1)   # 가운데 문틀
    # 받침장(나무 문 둘) y33~44
    c.HL(1, 33, 30, 'ita', 4)
    for dx in (3, 16):
        c.R(dx, 34, 12, 9, 'ita', 3); c.HL(dx, 34, 12, 'ita', 2); c.VL(dx, 34, 9, 'ita', 2)
        c.HL(dx, 42, 12, 'ita', 4); c.VL(dx + 11, 34, 9, 'ita', 4)
        for j in range(35, 42):
            if rnd(dx, j, 62) < 0.4: c.HL(dx + 2, j, 7, 'ita', 2)
    c.P(14, 38, 'tekko', 5); c.P(17, 38, 'tekko', 5)
    c.HL(0, 47, 32, 'sumi', 0)


@I.obj('sx-art-display', '미술 작품 전시 선반', 'low_furniture', w=2, h=1, up=8, kind='wall', use=('read',),
       tags=TAGS + ('복도', '미술실', '전시'), place='미술실·현관 홀 북쪽 벽 앞',
       desc='낮은 나무 전시 선반 2칸 — 윗면에 학생 작품: 갈색 점토 항아리, 하늘색 유약 꽃병, 쌓아 올린 추상 점토 조각, 작은 흰 이름 카드(글자 없음). 아래 칸에 작품 접시.')
def _(c):
    y0 = furn(c, 1, 13, 30, 18, 6, 'yuka', tt=4, ft=2, grain='wood')
    # 아래 열린 칸 둘(속 어둡게) + 접시
    for dx in (3, 17):
        c.R(dx, y0 + 3, 12, 7, 'ita', 1); c.HL(dx, y0 + 3, 12, 'ita', 0)
        c.HL(dx, y0 + 9, 12, 'yuka', 3)
    ell_fill(c, 9, y0 + 7, 4, 1.6, 'daidai', 3); c.HL(7, y0 + 6, 4, 'daidai', 4)
    ell_fill(c, 22, y0 + 7, 3, 1.5, 'midori', 3); c.P(21, y0 + 6, 'midori', 4)
    c.R(25, y0 + 5, 3, 4, 'kinari', 3); c.HL(25, y0 + 5, 3, 'kinari', 4)
    # 테라코타 화분형 항아리(넓은 입 — 위에서 속이 보인다, 몸에 흰 줄 무늬)
    def body(x, y, dx, dy, d):
        t = 4 if dx < -0.45 else 3 if dx < 0.2 else 2
        if dy > 0.55: t -= 1
        return ('daidai', t)
    c.ell(7, 14, 4.6, 4.2, body)
    c.R(4, 17, 7, 1, 'daidai', 1)
    ring(c, 7, 10, 4.2, 2.0, ('soil', 0), ('kinari', 3), inner=('soil', 1), rim_w=0.5)
    c.P(4, 10, 'kinari', 4)
    for xx in range(4, 11): c.P(xx, 14 + (xx % 2), 'kinari', 4 if xx < 7 else 3)   # 물결 무늬
    c.HL(4, 18, 7, 'sumi', 0)
    # 하늘색 꽃병(가는 목)
    c.R(14, 8, 2, 3, 'sora', 3); ring(c, 14.9, 8, 1.6, 0.9, ('sora', 0), ('sora', 4), rim_w=0.3)
    def vase(x, y, dx, dy, d): return ('sora', 4 if dx < -0.3 else 3 if dx < 0.3 else 2)
    c.ell(15, 14, 3, 4, vase); c.HL(13, 18, 5, 'sumi', 0)
    c.P(14, 12, 'shiro', 4)
    # 추상 점토 조각(쌓은 덩이 셋)
    c.R(21, 13, 7, 5, 'conc', 4); c.HL(21, 13, 7, 'conc', 5); c.VL(27, 13, 5, 'conc', 2); c.HL(21, 17, 7, 'conc', 3)
    c.R(22, 9, 5, 4, 'kinari', 3); c.HL(22, 9, 5, 'kinari', 4); c.VL(26, 9, 4, 'kinari', 1)
    c.R(23, 5, 3, 4, 'daidai', 3); c.HL(23, 5, 3, 'daidai', 4); c.P(25, 7, 'daidai', 2)
    c.HL(20, 18, 9, 'sumi', 0)
    # 이름 카드
    c.R(10, 17, 3, 2, 'shiro', 4); c.R(28, 17, 2, 2, 'shiro', 4)
    for (a, b, w, h) in ((2, 4, 10, 15), (12, 7, 5, 12), (20, 4, 9, 15)):
        pass


@I.obj('sx-umbrella-rack', '昇降口 긴 우산꽂이', 'frame', w=2, h=1, up=4, use=('search',),
       tags=TAGS + ('현관', '昇降口', '우산'), place='昇降口 신발장 곁·현관 문 안쪽 바닥',
       desc='昇降口의 긴 쇠 우산꽂이 2칸 — 위에서 보이는 칸 격자(2줄×7칸)의 어두운 구멍, 몇 칸에 접은 우산(남색·빨강·투명·초록)이 꽂혀 손잡이가 솟는다. 아래 쇠 다리.')
def _(c):
    # 캔버스 32×32, 윗면(격자) y12~23
    x, y, w = 1, 12, 30
    c.R(x, y, w, 12, 'tekko', 4)
    c.HL(x, y, w, 'tekko', 5); c.HL(x, y + 1, w, 'tekko', 3)
    holes = []
    for r in range(2):
        for k in range(7):
            hx, hy = x + 2 + k * 4, y + 2 + r * 5
            c.R(hx, hy, 3, 4, 'yoru', 0); c.HL(hx, hy, 3, 'sumi', 0); c.P(hx + 2, hy + 3, 'yoru', 2)
            holes.append((hx, hy))
    c.HL(x, y + 11, w, 'tekko', 5)                       # 앞 모서리
    # 앞면 + 물받이
    c.R(x, y + 12, w, 4, 'tekko', 2); c.HL(x, y + 12, w, 'tekko', 3); c.HL(x, y + 15, w, 'tekko', 1)
    c.VL(x + 1, y + 12, 4, 'tekko', 3)
    ol_rect(c, x - 1, y - 1, w + 2, 18)
    for lx in (2, 28):
        c.R(lx, 29, 2, 1, 'tekko', 3); c.HL(lx - 1, 30, 4, 'sumi', 0)
    # 꽂힌 우산(접힌 천 몸 + 쇠 끝 + 휜 손잡이)
    for (k, col, hand) in ((0, 'kon', 'ita'), (2, 'aka', 'yoru'), (3, 'garasu', 'conc'), (5, 'midori', 'ita'), (8, 'kon', 'yoru'), (11, 'garasu', 'conc'), (13, 'kii', 'ita')):
        hx, hy = holes[k]
        top = hy - 9 + (k % 3)
        cx = hx + 1
        hi = 4 if col != 'garasu' else 6
        c.R(cx - 1, top + 3, 3, hy - top - 1, col, hi - 2); c.VL(cx - 1, top + 3, hy - top - 1, col, hi - 1)
        c.VL(cx + 1, top + 3, hy - top - 1, col, hi - 3)
        c.P(cx, top + 3, col, hi - 1)
        c.VL(cx, top, 3, hand, 4 if hand != 'yoru' else 3)
        c.P(cx + 1, top - 1, hand, 3 if hand != 'yoru' else 2); c.P(cx + 2, top, hand, 2)
        c.P(cx, hy + 1, col, hi - 3)


@I.obj('sx-recycle-bins', '분리수거통 3개(캔·페트·종이)', 'box', w=2, h=1, up=6, use=('search',),
       tags=TAGS + ('복도', '분리수거', '쓰레기통'), place='복도 끝·계단 곁·자판기 옆 벽 쪽 바닥',
       desc='복도 분리수거통 셋 — 파랑(둥근 구멍)·초록(둥근 구멍)·노랑(납작한 네모 구멍) 뚜껑의 윗면이 위에서 보이고, 회백 몸통 앞면에 색 띠(글자 없음).')
def _(c):
    # 캔버스 32×32. 통 셋(폭 10): 뚜껑 윗면 8행(y5~12, 구멍이 위에서 보인다) + 뚜껑 앞 테 2행 + 회백 몸통 앞면.
    for k, (col, hole) in enumerate((('sora', 'round'), ('midori', 'round'), ('kii', 'slot'))):
        x = 1 + k * 10; w = 10
        y1 = box(c, x, 5, w, 25, 8, col, 3, col, 2)
        # 뚜껑 윗면 둥근 앞 모서리(가운데가 조금 솟은 판): 가운데 줄 밝게
        c.HL(x + 2, 7, w - 4, col, 4)
        if hole == 'round':
            ell_fill(c, x + 5, 9.5, 2.8, 2.0, 'yoru', 0); c.HL(x + 3, 11, 4, 'yoru', 2); c.HL(x + 3, 8, 4, 'sumi', 0)
            c.P(x + 5 + (k % 2), 10, 'tekko', 5 if k == 0 else 4)        # 구멍 속 캔·병 뚜껑
        else:
            c.R(x + 2, 8, 6, 3, 'yoru', 0); c.HL(x + 2, 10, 6, 'yoru', 2); c.HL(x + 3, 8, 3, 'shiro', 3)   # 꽂힌 종이 끝
        # 뚜껑 앞 테(2행) 아래 회백 몸통
        c.HL(x + 1, y1 + 1, w - 2, col, 1)
        c.R(x + 1, y1 + 2, w - 2, 14, 'shiro', 2); c.VL(x + 1, y1 + 2, 14, 'shiro', 3); c.VL(x + w - 2, y1 + 2, 14, 'shiro', 1)
        c.HL(x + 1, y1 + 2, w - 2, 'shiro', 1)                           # 테 밑 그늘
        c.R(x + 2, y1 + 6, w - 4, 3, col, 3); c.HL(x + 2, y1 + 8, w - 4, col, 2)   # 색 띠(글자 없음)
        c.HL(x + 1, y1 + 14, w - 2, 'shiro', 1); c.HL(x + 1, y1 + 15, w - 2, 'shiro', 0)
    c.HL(0, 30, 32, 'sumi', 0)


@I.obj('sx-pa-speaker', '교실 방송 스피커', 'wall_mounted', w=1, kind='hang', hrows=2, use=(),
       tags=TAGS + ('교실', '스피커', '방송'), place='교실 앞 북쪽 벽면 윗줄 — 칠판 위 구석',
       desc='교실 앞 벽 높이 달린 교내 방송 스피커 — 나무 틀 상자(위에서 두께 보이는 윗면), 앞은 성긴 크림색 천 그릴, 아래 면 그늘.')
def _(c):
    x, y, w, h = 2, 3, 12, 17
    c.R(x, y, w, 4, 'yuka', 4); c.HL(x, y + 1, w, 'yuka', 3); c.HL(x + 1, y, w - 2, 'yuka', 4)
    for i in range(1, w - 1):
        if rnd(i, 1, 71) < 0.3: c.P(x + i, y + 2, 'yuka', 3)
    c.HL(x, y + 4, w, 'yuka', 4)                           # 앞 모서리 반사
    c.R(x, y + 5, w, h - 5, 'yuka', 2)
    c.VL(x + 1, y + 5, h - 6, 'yuka', 3); c.VL(x + w - 2, y + 5, h - 6, 'yuka', 1)
    # 천 그릴(성긴 결)
    gx, gy, gw, gh = x + 2, y + 6, w - 4, h - 9
    for j in range(gh):
        for i in range(gw):
            t = 3 if (i + j) % 2 == 0 else 2
            if j == 0 or i == 0: t = 1
            c.P(gx + i, gy + j, 'kinari', t)
    c.HL(x, y + h - 2, w, 'yuka', 1); c.HL(x, y + h - 1, w, 'yuka', 0)
    ol_rect(c, x - 1, y - 1, w + 2, h + 1)
    c.HL(x, y + h, w, 'sumi', 0)


@I.obj('sx-class-plate', '학급 표찰(문 위 돌출)', 'wall_mounted', w=1, kind='hang', hrows=2, use=('read',),
       tags=TAGS + ('교실', '복도', '표찰'), place='교실 문 바로 위 벽면 윗줄(문 칸과 같은 x)',
       desc='교실 문 위 벽에서 쇠 팔로 튀어나온 흰 학급 표찰 — 위에서 비스듬히 보여 판 윗면(두께)과 앞면이 보이고, 가는 회색 테뿐 글자 없음.')
def _(c):
    # 쇠 팔(벽 → 판)
    c.R(6, 1, 4, 2, 'tekko', 5); c.HL(6, 3, 4, 'tekko', 2); ol_rect(c, 5, 0, 6, 4)
    c.VL(7, 4, 3, 'tekko', 5); c.VL(8, 4, 3, 'tekko', 3)
    # 판: 윗면 4행 + 앞면
    x, y, w = 1, 7, 14
    c.R(x, y, w, 4, 'shiro', 4); c.HL(x, y + 1, w, 'shiro', 3); c.HL(x, y + 3, w, 'shiro', 3)
    c.R(x, y + 4, w, 8, 'shiro', 3)
    c.HL(x, y + 4, w, 'shiro', 4)
    c.R(x + 2, y + 6, w - 4, 4, 'shiro', 4)                 # 속판(밝게)
    c.HL(x + 2, y + 6, w - 4, 'conc', 4); c.HL(x + 2, y + 9, w - 4, 'conc', 4)
    c.VL(x + 2, y + 6, 4, 'conc', 4); c.VL(x + w - 3, y + 6, 4, 'conc', 4)
    c.HL(x, y + 11, w, 'shiro', 1)
    ol_rect(c, x - 1, y - 1, w + 2, 14)
    c.HL(x, y + 13, w, 'sumi', 0); c.HL(x + 1, y + 14, w - 2, 'shiro', 0)


@I.obj('sx-hall-bench', '복도 나무 긴 의자', 'seat', w=2, h=1, up=6, use=('sit',),
       tags=TAGS + ('복도', '현관', '벤치'), place='복도 벽 곁·현관 홀·체육관 앞',
       desc='복도 나무 긴 의자 2칸(등받이 없음) — 위에서 보이는 널 세 장(결·틈)과 앞 모서리, 양끝 굵은 나무 다리와 가로대.')
def _(c):
    # 캔버스 32×32 (up 6 → U=1). 좌판 윗면 10행(y9~18, 널 셋·틈) + 앞판 3행 + 아래 다리·가로대가 보인다.
    x, y, w = 1, 9, 30
    y1 = box(c, x, y, w, 14, 10, 'yuka', 3, 'ita', 3)
    for k in range(3):                                       # 널 세 장(뒤→앞으로 조금씩 밝게), 널 사이 틈
        py = y + 1 + k * 3
        t = (3, 3, 4)[k]
        c.R(x + 1, py, w - 2, 3, 'yuka', t)
        c.HL(x + 2, py, w - 4, 'yuka', 4)
        if k < 2: c.HL(x + 1, py + 2, w - 2, 'ita', 2)
        for i in range(3, w - 3):
            r = rnd(i // 4, k, 81)
            if r < 0.2: c.P(x + i, py + 1, 'yuka', 2)
            elif r > 0.9: c.P(x + i, py + 1, 'kinari', 3)
    c.HL(x + 1, y + 1, w - 2, 'yuka', 2)                     # 뒤 가장자리 그늘
    c.VL(x + 1, y + 1, 9, 'yuka', 4)
    c.HL(x + 1, y + 9, w - 2, 'kinari', 3)                   # 앞 모서리 반사
    # 좌판 위 물건: 접은 체육복 주머니(남색) — 윗면에 놓인 게 보이게
    c.R(20, 11, 7, 5, 'kon', 3); c.HL(20, 11, 7, 'kon', 4); c.HL(20, 15, 7, 'kon', 1); c.VL(26, 11, 5, 'kon', 2)
    c.P(21, 12, 'shiro', 4); c.HL(20, 16, 7, 'yuka', 2)
    # 다리 + 가로대(좌판 밑 그늘 사이로)
    for lx in (3, 26):
        c.R(lx, 23, 3, 6, 'ita', 3); c.VL(lx, 23, 6, 'ita', 4); c.VL(lx + 2, 23, 6, 'ita', 1)
        c.VL(lx - 1, 23, 6, 'sumi', 1); c.VL(lx + 3, 23, 6, 'sumi', 1); c.HL(lx - 1, 29, 5, 'sumi', 0)
    c.HL(6, 26, 20, 'ita', 3); c.HL(6, 27, 20, 'ita', 1); c.HL(6, 25, 20, 'sumi', 1)
    c.HL(5, 29, 22, 'yoru', 1)                                # 좌판 밑 바닥 그늘


@I.obj('sx-mop-bucket', '청소 양동이와 대걸레', 'container', w=1, h=1, up=8, use=('search',),
       tags=TAGS + ('복도', '청소', '掃除'), place='복도 끝 청소 도구함 곁·교실 뒤 구석',
       desc='파란 플라스틱 청소 양동이 — 위에서 둥근 테 속에 회색 물이 보이고, 대걸레 실 뭉치가 물에 잠겨 나무 자루가 비스듬히 솟는다. 손잡이 철사.')
def _(c):
    # 몸통(아래로 좁아짐)
    for y in range(17, 28):
        inset = (y - 17) // 5
        for x in range(2 + inset, 14 - inset):
            t = 3 if x < 5 else 2 if x < 11 else 1
            c.P(x, y, 'sora', t)
        c.P(1 + inset, y, 'sumi', 1); c.P(14 - inset, y, 'sumi', 1)
    c.HL(3, 21, 10, 'sora', 1); c.HL(3, 22, 10, 'sora', 3)       # 몸 띠
    c.HL(4, 28, 8, 'sumi', 1); c.HL(4, 29, 8, 'sumi', 0)
    # 위 테 + 물(타원 윗면 7행)
    ring(c, 8, 16, 6.6, 3.8, ('conc', 2), ('sora', 3), inner=('conc', 1), rim_w=0.55)
    c.HL(5, 15, 3, 'conc', 3)                              # 물 반사
    # 대걸레 실 뭉치(물속)
    for (dx, dy) in ((-3, 0), (-2, 1), (-1, 0), (0, 1), (1, 0), (-2, -1), (0, -1), (-1, 2), (1, 2), (2, 1)):
        c.P(9 + dx, 17 + dy, 'kinari', 3 if (dx + dy) % 2 else 4)
    # 자루(오른위로)
    c.line(10, 16, 14, 2, 'yuka', 4); c.line(11, 16, 15, 3, 'yuka', 2)
    c.P(14, 1, 'ita', 2); c.P(15, 2, 'ita', 2)
    # 손잡이 철사
    c.P(2, 14, 'tekko', 4); c.P(1, 15, 'tekko', 3); c.P(13, 14, 'tekko', 3)
    c.P(3, 12, 'tekko', 5); c.HL(4, 11, 3, 'tekko', 5)
    c.HL(2, 12, 1, 'sumi', 1)


# ═══════════════ 교무실·인쇄실 ═══════════════
@I.obj('sx-letter-shelf', '교원 우편 칸 선반(레터 케이스)', 'tall_furniture', w=2, h=1, up=24, kind='wall', use=('open', 'search'),
       tags=TAGS + ('교무실', '우편', '선반'), place='교무실 입구 북쪽 벽 앞',
       desc='교무실 교원 우편 칸 2칸 — 나무 윗면 아래 작은 칸 6열×6단 격자, 칸마다 흰 서류 뭉치·색 봉투·빈 칸이 섞였다. 이름표 자리는 빈 흰 띠(글자 없음).')
def _(c):
    # 캔버스 32×48. 윗면 8행(y4~11, 위에 서류 상자·펜 통·쌓인 봉투) + 앞면 칸 격자
    y0 = box(c, 1, 4, 30, 43, 8, 'yuka', 3, 'yuka', 2)
    for i in range(3, 29):
        for j in range(2, 7):
            if rnd(i // 5, j, 92) < 0.14: c.P(1 + i, 4 + j, 'yuka', 2)
    # 윗면 물건: 서류 트레이(흰 종이 묶음 — 윗면+앞 두께) · 펜 통 · 갈색 봉투 더미
    c.R(4, 5, 10, 5, 'shiro', 4); c.HL(4, 9, 10, 'shiro', 2); c.HL(4, 10, 10, 'tekko', 3); c.HL(5, 7, 8, 'shiro', 3)
    c.VL(3, 5, 6, 'sumi', 1); c.VL(14, 5, 6, 'sumi', 1); c.HL(4, 4, 10, 'sumi', 1)
    ell_fill(c, 18, 7, 1.8, 1.2, 'yoru', 1); c.R(17, 7, 3, 3, 'kon', 3); c.VL(17, 7, 3, 'kon', 4); c.P(17, 5, 'aka', 3); c.P(19, 5, 'kii', 4)
    c.R(22, 6, 7, 4, 'kinari', 3); c.HL(22, 6, 7, 'kinari', 4); c.R(23, 5, 5, 2, 'kinari', 4); c.HL(22, 9, 7, 'kinari', 1)
    c.HL(3, 11, 26, 'yuka', 4)
    gx, gy = 3, y0 + 1
    for r in range(6):
        for k in range(6):
            x0, y1 = gx + k * 4 + (k // 3), gy + r * 5
            c.R(x0, y1, 3, 4, 'ita', 1); c.HL(x0, y1, 3, 'ita', 0)
            v = h32(k, r, 91) % 6
            if v in (0, 1, 2):                               # 흰 서류 뭉치
                c.R(x0, y1 + 2, 3, 2, 'shiro', 3); c.HL(x0, y1 + 2, 3, 'shiro', 4)
                if v == 1: c.R(x0, y1 + 1, 2, 1, 'shiro', 4)
            elif v == 3:
                m = ('kii', 'sora', 'pinku')[r % 3]
                c.R(x0, y1 + 2, 3, 2, m, 3); c.HL(x0, y1 + 2, 3, m, 4)
            elif v == 4:
                c.R(x0 + 1, y1 + 1, 2, 3, 'kinari', 3); c.HL(x0 + 1, y1 + 1, 2, 'kinari', 4)
            c.VL(x0 + 3, y1, 4, 'yuka', 3 if k % 3 != 2 else 2)   # 칸막이
        c.HL(gx, gy + r * 5 + 4, 26, 'yuka', 3)               # 선반 앞 모서리
    c.VL(15, y0, 31, 'yuka', 3); c.VL(16, y0, 31, 'yuka', 1)
    # 아래 걸레받이
    c.R(2, 44, 28, 1, 'yuka', 1)
    c.HL(1, 46, 30, 'sumi', 0)


@I.obj('sx-riso-printer', '윤전 인쇄기(인쇄실)', 'low_furniture', w=2, h=1, up=8, use=('switch',),
       tags=TAGS + ('인쇄실', '교무실', '인쇄기'), place='인쇄실·교무실 구석 벽 곁 바닥',
       desc='학교 윤전 인쇄기(リソグラフ류) — 회백 몸통 윗면에 왼쪽 종이 공급 받침(흰 종이 묶음)과 오른쪽 어두운 조작판(작은 초록·주황 불), 앞면 드럼 문 이음과 받침장, 오른쪽 옆 바닥에 인쇄된 종이 더미.')
def _(c):
    # 캔버스 32×32. 몸통 x0~25: 윗면 9행(y6~14 — 종이 공급 판·조작판이 윗면 위에 놓인다) + 앞면(드럼 문) + 받침장
    y0 = box(c, 0, 6, 26, 18, 9, 'conc', 5, 'conc', 3)
    # 공급 판 위 흰 종이 묶음(윗면 위에 얹힘: 종이 윗면 + 1행 두께)
    c.R(2, 7, 11, 5, 'shiro', 4); c.HL(3, 8, 9, 'shiro', 3); c.HL(2, 12, 11, 'shiro', 2)
    c.HL(2, 13, 11, 'conc', 3); c.VL(1, 7, 6, 'tekko', 3); c.VL(13, 7, 6, 'tekko', 3)    # 종이 가이드
    # 조작판(오른쪽, 기울어진 검은 판 — 화면·불)
    c.R(15, 8, 9, 5, 'yoru', 2); c.HL(15, 8, 9, 'yoru', 4); c.HL(15, 12, 9, 'yoru', 1)
    c.R(16, 9, 4, 2, 'garasu', 4); c.P(16, 9, 'garasu', 6)
    c.P(21, 9, 'midori', 4); c.P(22, 9, 'daidai', 4); c.P(21, 11, 'conc', 5); c.P(23, 11, 'conc', 5)
    c.HL(15, 13, 9, 'conc', 3)
    # 앞면: 배출 받침(앞으로 나온 얇은 판 위 종이) · 드럼 문 이음
    c.R(3, y0 + 1, 10, 2, 'shiro', 4); c.HL(3, y0 + 2, 10, 'shiro', 2); c.HL(3, y0 + 3, 10, 'tekko', 2)
    c.VL(14, y0 + 1, 7, 'conc', 1); c.VL(15, y0 + 1, 7, 'conc', 4)
    c.R(17, y0 + 3, 6, 2, 'yoru', 3); c.HL(17, y0 + 3, 6, 'yoru', 4)
    # 받침장(바닥까지)
    c.R(1, 24, 24, 6, 'conc', 2); c.HL(1, 24, 24, 'conc', 4); c.VL(12, 24, 6, 'conc', 1)
    c.P(10, 26, 'tekko', 5); c.P(14, 26, 'tekko', 5); c.HL(1, 29, 24, 'conc', 1)
    c.VL(0, 23, 8, 'sumi', 1); c.VL(25, 23, 8, 'sumi', 1); c.HL(0, 30, 26, 'sumi', 0)
    # 옆 종이 더미(윗면 5행)
    y2 = box(c, 26, 17, 6, 14, 5, 'shiro', 4, 'shiro', 3)
    for yy in range(y2 + 1, 30, 2): c.HL(27, yy, 4, 'shiro', 2)
    c.HL(0, 31, 32, 'sumi', 0)


# ═══════════════ 음악실 ═══════════════
@I.obj('sx-timpani', '팀파니', 'round_body', w=1, h=1, up=0, use=('search',),
       tags=TAGS + ('음악실', '악기', '취주악'), place='음악실 뒤쪽(타악기 자리) 바닥',
       desc='구리 몸통의 팀파니 — 위에서 보이는 흰 막 타원과 쇠 테(조임 볼트), 아래로 둥글게 좁아지는 구리 솥, 짧은 쇠 다리.')
def _(c):
    # 구리 솥(앞면): 위 넓고 아래 둥글게 좁아짐
    for y in range(7, 14):
        half = [7, 7, 7, 6, 6, 5, 4][y - 7]
        for x in range(8 - half, 8 + half):
            dx = (x - 8 + 0.5) / half
            t = 4 if dx < -0.55 else 3 if dx < -0.1 else 2 if dx < 0.5 else 1
            c.P(x, y, 'daidai', t)
        c.P(8 - half - 1, y, 'sumi', 1); c.P(8 + half, y, 'sumi', 1)
    c.HL(4, 14, 8, 'sumi', 1)
    for rx in (2, 6, 10, 13):                                   # 조임 막대(세로)
        c.VL(rx, 7, 4 if rx in (2, 13) else 6, 'tekko', 5 if rx < 8 else 4)
    # 막(윗면 타원 7행) + 쇠 테
    def head(x, y, dx, dy, d):
        if d > 0.7: return ('tekko', 5 if dy < 0 else 3)
        t = 4 if (dx + dy) < 0.1 else 3
        if 0.2 < d < 0.32 and dx > 0: t = 3
        return ('shiro', t)
    c.ell(8, 4.5, 7.5, 3.6, head)
    c.R(7, 4, 2, 1, 'shiro', 2)                                  # 가운데 친 자리
    for (bx, by) in ((1, 4), (14, 4), (4, 7), (11, 7)): c.P(bx, by, 'tekko', 6)
    for x in range(1, 15):
        if c.on(x, 0) or c.on(x, 1):
            yt = 0 if c.on(x, 0) else 1
            c.P(x, yt, 'sumi', 1)
    c.P(0, 4, 'sumi', 1); c.P(15, 4, 'sumi', 1)
    # 다리 셋
    c.P(4, 15, 'tekko', 4); c.P(11, 15, 'tekko', 3); c.P(5, 15, 'sumi', 0); c.P(12, 15, 'sumi', 0)
    c.P(8, 15, 'yoru', 2)


@I.obj('sx-drum-kit', '드럼 세트', 'round_body', w=2, h=1, up=8, use=('search',),
       tags=TAGS + ('음악실', '경음악부', '악기'), place='음악실·경음악부 부실 구석 바닥 — 뒤쪽(북)에 의자',
       desc='남향 드럼 세트 — 뒤 둥근 의자, 가운데 큰 베이스 드럼(빨간 몸통·흰 앞 막), 그 위 탐 둘, 왼쪽 스네어와 하이햇, 오른쪽 플로어 탐과 금빛 심벌. 북 윗면은 모두 흰 타원으로 보인다.')
def _(c):
    def drum_top(cx, cy, rx, ry):
        ring(c, cx, cy, rx, ry, ('shiro', 4), ('tekko', 4), rim_w=0.55)
        c.P(int(cx - rx / 2), int(cy - ry / 3), 'shiro', 4)
    def shell(x, y, w, h, mat='aka'):
        c.R(x, y, w, h, mat, 2); c.VL(x, y, h, mat, 3); c.VL(x + w - 1, y, h, mat, 1); c.HL(x, y + h - 1, w, mat, 1)
    def cymbal(cx, cy, rx, ry):
        def f(x, y, dx, dy, d):
            if d < 0.08: return ('kii', 2)
            return ('kii', 4 if dx + dy < -0.3 else 3 if d < 0.6 else 2)
        c.ell(cx, cy, rx, ry, f)
    # 의자(뒤, 북쪽)
    ring(c, 16, 6, 3.6, 2.2, ('yoru', 3), ('yoru', 2), rim_w=0.6); c.VL(16, 8, 3, 'tekko', 4)
    # 베이스 드럼(가운데): 몸통 윗띠 + 흰 앞 막
    c.R(10, 13, 12, 4, 'aka', 3); c.HL(10, 13, 12, 'aka', 4); c.HL(10, 16, 12, 'aka', 2)
    def head(x, y, dx, dy, d):
        if d > 0.7: return ('tekko', 4 if dx < 0 else 2)
        return ('shiro', 3 if dx < 0.3 else 2)
    c.ell(16, 22, 6.2, 6.2, head)
    c.ell(16, 22, 2.5, 2.5, lambda x, y, dx, dy, d: ('aka', 2))
    c.HL(12, 29, 9, 'sumi', 0)
    # 탐 둘(베이스 위)
    for cx in (12.5, 19.5):
        shell(int(cx) - 3, 12, 7, 4, 'aka')
        drum_top(cx, 10.5, 3.8, 3.0)
    # 스네어(왼쪽)
    shell(3, 19, 9, 4, 'tekko')
    drum_top(7.5, 18.5, 4.8, 3.4)
    c.VL(5, 23, 5, 'tekko', 4); c.VL(10, 23, 5, 'tekko', 3); c.P(5, 28, 'sumi', 0); c.P(10, 28, 'sumi', 0)
    # 플로어 탐(오른쪽)
    shell(22, 20, 9, 7, 'aka')
    drum_top(26.5, 19.5, 4.8, 3.4)
    c.P(23, 27, 'tekko', 4); c.P(30, 27, 'tekko', 3); c.HL(22, 28, 2, 'sumi', 0); c.HL(29, 28, 2, 'sumi', 0)
    # 하이햇(왼 뒤) · 크래시(오른 뒤)
    c.VL(3, 10, 9, 'tekko', 4); cymbal(3.5, 9, 3.5, 1.6); cymbal(3.5, 10.5, 3.5, 1.4)
    c.VL(28, 6, 13, 'tekko', 3); cymbal(27.5, 6, 4.4, 2)
    for (x, y) in ((3, 19), (28, 19)): c.P(x, y, 'sumi', 0)
    # 스틱
    c.line(8, 15, 12, 16, 'yuka', 4)


@I.obj('sx-xylophone', '실로폰(목금)', 'frame', w=2, h=1, up=4, use=('search',),
       tags=TAGS + ('음악실', '악기', '취주악'), place='음악실 뒤쪽(타악기 자리) 바닥',
       desc='음악실 실로폰 2칸 — 위에서 보이는 붉은 갈색 나무 건반 줄이 왼쪽(길다)에서 오른쪽(짧다)으로 줄어들고, 건반 밑 두 쇠 받침대가 비스듬히 좁아진다. 건반 위에 털실 채 둘, 아래 쇠 다리와 바퀴.')
def _(c):
    # 캔버스 32×32. 나무 틀 상자: 윗면 15행(y4~18, 짙은 펠트 레일 둘 위에 건반이 누워 있다) + 앞판 4행 + 쇠 다리·바퀴
    box(c, 1, 4, 30, 19, 15, 'ita', 3, 'ita', 2)
    c.R(3, 6, 26, 11, 'ita', 1)                                # 틀 속(어두운 공명 칸)
    n = 9
    xs = [3 + k * 3 for k in range(n)]
    half = [6 - k * 3 // (n - 1) for k in range(n)]           # 6 → 3 (왼쪽 길고 오른쪽 짧다)
    cy = 11
    # 펠트 레일 둘(사선, 건반 밑)
    c.line(3, cy - half[0] + 1, 29, cy - half[-1] + 1, 'aka', 1)
    c.line(3, cy + half[0] - 1, 29, cy + half[-1] - 1, 'aka', 1)
    for k in range(n):
        x, hh = xs[k], half[k]
        t0, b0 = cy - hh, cy + hh
        c.R(x, t0, 2, b0 - t0, 'yuka', 3)                     # 건반 윗면(밝은 나무)
        c.VL(x, t0, b0 - t0, 'yuka', 4); c.P(x, t0, 'kinari', 4)
        c.HL(x, b0, 2, 'ita', 3)                              # 건반 앞 두께
        if x + 2 < 29: c.P(x + 2, t0 + 1, 'sumi', 1)
        c.P(x, t0 + 1, 'tekko', 5); c.P(x, b0 - 2, 'tekko', 5)  # 핀(레일 위)
    # 털실 채 둘(틀 앞 칸 위에 놓임, 검은 자루)
    c.line(9, 16, 18, 14, 'yoru', 3); c.R(6, 15, 3, 2, 'aka', 3); c.HL(6, 15, 3, 'aka', 4); c.P(8, 16, 'aka', 1)
    c.line(16, 17, 25, 15, 'yoru', 3); c.R(13, 16, 3, 2, 'aka', 3); c.HL(13, 16, 3, 'aka', 4); c.P(15, 17, 'aka', 1)
    # 쇠 다리 + 가로대 + 바퀴
    for lx in (3, 27):
        c.R(lx, 23, 2, 6, 'tekko', 4); c.VL(lx + 1, 23, 6, 'tekko', 2)
        c.VL(lx - 1, 23, 6, 'sumi', 1); c.VL(lx + 2, 23, 6, 'sumi', 1)
        c.R(lx - 1, 29, 4, 1, 'yoru', 1); c.P(lx, 29, 'tekko', 4); c.HL(lx - 1, 30, 4, 'sumi', 0)
    c.HL(5, 26, 22, 'tekko', 4); c.HL(5, 27, 22, 'tekko', 2)    # 아래 가로대


# ═══════════════ 도서실 ═══════════════
@I.obj('sx-book-cart', '도서실 북 트럭', 'low_furniture', w=1, h=1, up=8, use=('search', 'read'),
       tags=TAGS + ('도서실', '책', '図書室'), place='도서실 서가 사이 통로·반납대 곁',
       desc='나무 2단 북 트럭 — 위에서 보이는 윗단 홈에 책이 비스듬히 기대 꽂혔고(색 등), 아랫단에도 책 줄, 네 모서리 작은 바퀴.')
def _(c):
    # 캔버스 16×32. 윗단 = 위에서 보이는 나무 홈 상자(윗면 9행 y5~13: 책 윗머리가 줄지어 보인다) + 앞면 아랫단 + 바퀴
    x, w = 0, 16
    y1 = box(c, x, 5, w, 22, 9, 'yuka', 3, 'yuka', 2)
    c.R(2, 7, 12, 5, 'ita', 1)                                 # 홈 속(어둡게)
    cols = ('aka', 'kon', 'midori', 'kii', 'sora', 'daidai', 'murasaki', 'kon')
    for i in range(6):                                         # 책 윗머리: 표지 색 1px + 종이 단면 1px, 기울어 엇갈림
        bx = 2 + i * 2
        col = cols[h32(i, 1, 95) % len(cols)]
        off = (i % 2)
        c.VL(bx, 7 + off, 4, col, 3); c.P(bx, 7 + off, col, 4)
        c.VL(bx + 1, 7 + off, 4, 'kinari', 4 if off == 0 else 3)
    c.HL(2, 12, 12, 'yuka', 4)                                 # 홈 앞 턱
    # 앞면: 아랫단 열린 칸 + 눕힌 책 줄
    c.R(2, y1 + 2, 12, 6, 'ita', 1); c.HL(2, y1 + 2, 12, 'ita', 0)
    books(c, 2, y1 + 3, 12, 5, s=7)
    c.HL(2, y1 + 8, 12, 'yuka', 4)
    # 바퀴(넷 중 앞 둘)
    for wx in (1, 12):
        c.R(wx, 27, 3, 2, 'yoru', 1); c.P(wx, 27, 'tekko', 4); c.HL(wx, 29, 3, 'sumi', 0)


@I.obj('sx-newspaper-rack', '신문 걸이대', 'tall_furniture', w=1, h=1, up=16, kind='wall', use=('read',),
       tags=TAGS + ('도서실', '신문'), place='도서실 열람석 곁 북쪽 벽 앞',
       desc='도서실 신문 걸이대 — 나무 틀 윗면(위에서 보이는 널) 아래 신문 막대 셋에 접힌 신문이 겹쳐 걸렸다(회색 줄뿐, 글자 없음). 양쪽 기둥과 발.')
def _(c):
    # 윗면(나무 판 7행 y0~6, 위에 접어 둔 신문 한 부) + 앞 띠 3행
    box(c, 0, 0, 16, 10, 7, 'yuka', 3, 'yuka', 2)
    c.R(3, 1, 8, 4, 'shiro', 4); c.HL(3, 4, 8, 'shiro', 2); c.HL(4, 2, 2, 'conc', 3)
    c.VL(7, 2, 2, 'conc', 5); c.VL(9, 2, 2, 'conc', 5); c.HL(3, 5, 8, 'yuka', 2)
    c.P(12, 3, 'yuka', 2); c.P(13, 2, 'yuka', 2)
    # 기둥 둘(가늘게 — 사이는 비어 신문이 걸린 게 보인다)
    for px_, t in ((1, 4), (14, 2)):
        c.VL(px_, 10, 18, 'yuka', t); c.VL(px_ - 1 if px_ == 1 else px_ + 1, 10, 18, 'sumi', 1)
    # 신문 막대 셋: 막대(양 기둥에 걸침) + 접혀 늘어진 신문(엇갈린 폭)
    for k, (y, x0, w, ln) in enumerate(((11, 3, 10, 6), (16, 2, 11, 6), (21, 4, 9, 5))):
        c.HL(2, y, 12, 'ita', 4); c.HL(2, y + 1, 12, 'ita', 2); c.P(13, y, 'ita', 3)
        c.R(x0, y + 2, w, ln, 'shiro', 4 if k == 2 else 3)
        c.HL(x0, y + 2, w, 'shiro', 4)                          # 접힌 윗단(밝게)
        c.R(x0 + 1, y + 3, 3, 2, 'conc', 3)                     # 사진 덩이
        for cx in range(x0 + 5, x0 + w - 1, 2): c.VL(cx, y + 3, ln - 3, 'conc', 5)   # 단 줄(글자 아님)
        c.VL(x0 + w - 1, y + 2, ln, 'shiro', 1); c.HL(x0, y + ln + 1, w, 'shiro', 1)
        c.VL(x0 - 1, y + 2, ln, 'sumi', 1)
    # 발(바닥 받침, 윗면 보임)
    c.R(0, 28, 5, 2, 'yuka', 3); c.HL(0, 28, 5, 'yuka', 4); c.R(11, 28, 5, 2, 'yuka', 2); c.HL(11, 28, 5, 'yuka', 3)
    c.HL(0, 30, 5, 'sumi', 0); c.HL(11, 30, 5, 'sumi', 0)


# ═══════════════ 옥상 ═══════════════
@I.obj('sx-roof-bench', '옥상 벤치(바랜 널·쇠 틀)', 'seat', w=2, h=1, up=6, use=('sit',),
       tags=TAGS + ('옥상', '屋上', '벤치'), place='옥상 난간 안쪽·塔屋 벽 곁 콘크리트 바닥',
       desc='옥상 벤치 2칸 — 비바람에 바랜 회갈색 널 네 장(윗면, 틈과 얼룩), 양끝 녹슨 쇠 틀 팔걸이, 쇠 다리.')
def _(c):
    # 캔버스 32×32 (up 6 → U=1). 좌판 윗면 10행(y10~19, 바랜 널 넷·틈·얼룩) + 앞 띠 + 양끝 녹슨 쇠 틀(팔걸이 윗면 + 다리)
    x, y, w = 4, 10, 24
    y1 = box(c, x, y, w, 13, 10, 'ita', 4, 'ita', 2)
    for k in range(4):
        py = y + 1 + k * 2 + (k // 2)
        c.HL(x + 1, py, w - 2, 'ita', 5 if k else 4)
        c.HL(x + 1, py + 1, w - 2, 'ita', 4)
        for i in range(1, w - 1):
            r = rnd(i // 2, k, 99)
            if r < 0.14: c.P(x + i, py + 1, 'hodo', 4)
            elif r > 0.9: c.P(x + i, py, 'ita', 6)
        if k in (0, 2): c.HL(x + 1, py + 2, w - 2, 'ita', 1)   # 널 틈
    c.VL(x + 1, y + 1, 8, 'ita', 5)
    c.HL(x + 1, y + 9, w - 2, 'ita', 6)                      # 앞 모서리 반사
    # 좌판 밑 그늘·바닥 접지
    c.HL(x + 1, 23, w - 2, 'conc', 2); c.HL(x + 2, 28, w - 4, 'conc', 2)
    # 양끝 쇠 틀: 팔걸이 윗면(4행, 좌판보다 높다) + 앞면 다리
    for fx in (1, 28):
        c.R(fx, 6, 3, 4, 'tekko', 5); c.HL(fx, 6, 3, 'tekko', 4); c.VL(fx, 7, 3, 'tekko', 6); c.HL(fx, 9, 3, 'tekko', 6)
        c.R(fx, 10, 3, 18, 'tekko', 3); c.VL(fx, 10, 18, 'tekko', 4); c.VL(fx + 2, 10, 18, 'tekko', 1)
        c.HL(fx, 10, 3, 'tekko', 2)
        c.P(fx + 1, 14, 'soil', 2); c.P(fx + 1, 21, 'soil', 1); c.P(fx + 1, 25, 'soil', 2)   # 녹
        c.HL(fx, 5, 3, 'sumi', 1); c.VL(fx - 1, 6, 23, 'sumi', 1); c.VL(fx + 3, 6, 4, 'sumi', 1)
        if fx == 1: c.VL(fx + 3, 23, 6, 'sumi', 1)
        else: c.VL(fx - 1, 23, 6, 'sumi', 1)
        c.HL(fx, 28, 3, 'tekko', 2); c.HL(fx, 29, 3, 'sumi', 0)
    c.HL(4, 26, 24, 'tekko', 3); c.HL(4, 27, 24, 'tekko', 1)   # 아래 쇠 가로대


@I.obj('sx-roof-vent', '옥상 환기 갓', 'round_body', w=1, h=1, up=6, use=(),
       tags=TAGS + ('옥상', '환기'), place='옥상 콘크리트 바닥 — 塔屋 곁·난간 안쪽',
       desc='옥상 바닥에서 솟은 버섯 모양 환기 갓 — 위에서 보이는 둥근 쇠 캡(가운데 꼭지, 녹 얼룩), 캡 아래 어두운 틈, 굵은 관과 바닥 플랜지.')
def _(c):
    # 바닥 플랜지(타원)
    ring(c, 8, 27, 6, 2.4, ('conc', 3), ('tekko', 3), rim_w=0.5)
    c.HL(3, 29, 10, 'sumi', 0)
    # 관
    c.R(5, 19, 6, 8, 'tekko', 3); c.VL(5, 19, 8, 'tekko', 4); c.VL(6, 19, 8, 'tekko', 5); c.VL(10, 19, 8, 'tekko', 1)
    c.HL(5, 23, 6, 'tekko', 2); c.VL(4, 19, 8, 'sumi', 1); c.VL(11, 19, 8, 'sumi', 1)
    # 캡 아래 틈 + 캡 앞 테
    c.HL(3, 18, 10, 'yoru', 0); c.HL(2, 17, 12, 'yoru', 1)
    c.HL(2, 16, 12, 'tekko', 2); c.HL(1, 15, 14, 'tekko', 3)
    # 캡 윗면(낮은 원뿔: 가운데 밝게)
    def cap(x, y, dx, dy, d):
        t = 5 if d < 0.25 else 4 if (dx + dy) < 0 else 3
        if d > 0.8: t = 2 if dx > 0 else 3
        return ('tekko', t)
    c.ell(8, 12, 7.2, 4, cap)
    c.R(7, 10, 2, 2, 'tekko', 6); c.P(8, 11, 'tekko', 4)
    c.P(4, 13, 'soil', 2); c.P(11, 12, 'soil', 1); c.P(10, 14, 'soil', 2)
    for y in range(8, 17):
        for x in range(0, 16):
            if c.on(x, y) and (not c.on(x - 1, y) or not c.on(x + 1, y) or not c.on(x, y - 1)): c.P(x, y, 'sumi', 1)


@I.obj('sx-roof-ac-big', '옥상 대형 실외기', 'box', w=2, h=1, up=12, use=(),
       tags=TAGS + ('옥상', '실외기', '설비'), place='옥상 바닥 — 塔屋 뒤·난간 곁에 한 줄로',
       desc='옥상 업무용 대형 실외기 2칸 — 위로 부는 둥근 팬 그릴 둘이 넓은 회백 윗면에 보이고, 앞면에 가로 루버, 오른쪽 앞으로 보온재 감은 배관이 나와 바닥으로 내려간다. 쇠 받침 위.')
def _(c):
    x, y, w = 1, 4, 27
    # 윗면 y4~15
    c.R(x, y, w, 12, 'conc', 5); c.HL(x, y + 1, w, 'conc', 4); c.HL(x + 1, y, w - 2, 'conc', 6); c.HL(x, y + 11, w, 'conc', 4)
    for cx in (8, 21):
        def fan(xx, yy, dx, dy, d, cx=cx):
            if d < 0.07: return ('tekko', 5)
            if d < 0.2: return ('yoru', 3)
            if d > 0.82: return ('conc', 3)
            ring_i = int(d * 6)
            return ('yoru', 1 if ring_i % 2 else 2)
        c.ell(cx, 10, 6, 4.4, fan)
        c.line(cx - 4, 10, cx + 4, 10, 'tekko', 3); c.line(cx, 7, cx, 13, 'tekko', 3)
        c.P(cx - 4, 8, 'conc', 6)
    # 앞면 y16~27
    c.HL(x, 16, w, 'conc', 5)
    c.R(x, 17, w, 10, 'conc', 3); c.VL(x + 1, 17, 10, 'conc', 4); c.VL(x + w - 2, 17, 10, 'conc', 2)
    for yy in range(18, 26, 2): c.HL(x + 12, yy, w - 15, 'conc', 1)
    c.R(x + 2, 18, 8, 7, 'conc', 4); c.HL(x + 2, 24, 8, 'conc', 2); c.VL(x + 9, 18, 7, 'conc', 2)
    c.HL(x, 26, w, 'conc', 2)
    ol_rect(c, x - 1, y - 1, w + 2, 25)
    # 쇠 받침
    c.R(1, 28, 27, 2, 'tekko', 2); c.HL(1, 28, 27, 'tekko', 3); c.HL(1, 30, 27, 'sumi', 0)
    # 배관(오른쪽 앞 → 바닥, 오른쪽으로)
    c.R(28, 20, 2, 10, 'kinari', 3); c.VL(28, 20, 10, 'kinari', 4); c.VL(30, 20, 10, 'sumi', 1)
    c.HL(28, 21, 2, 'kinari', 2); c.HL(28, 25, 2, 'kinari', 2)
    c.R(28, 28, 4, 2, 'kinari', 3); c.HL(28, 28, 4, 'kinari', 4); c.HL(28, 30, 4, 'sumi', 0)
    c.P(28, 19, 'sumi', 1); c.P(29, 19, 'sumi', 1)


def build(): return R.build()


def selftest(): return R.selftest()


if __name__ == '__main__':
    sys.exit(main(I, sys.argv))
