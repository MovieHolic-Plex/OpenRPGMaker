#!/usr/bin/env python3
"""jp_city 시설 실내 — 일반 병원(総合病院・クリニック 확장). id 머리 `hs-`. (폐병원 dungeon_hospital `hp-` 와 다른 깨끗한 병원)

방: 外来 대기실(待合室)·종합 접수(総合受付)·진찰실(診察室)·처치실·병동 복도·병실(病室 4상)·간호사 대기소(ナースステーション)·원내 약국(薬局).
칸 16px = 1m, 3/4 시점(윗면 + 남쪽 앞면), 빛 왼위, 외곽선 sumi, 팔레트 modern3 램프만(엔진 px.py). 글자·숫자·상표·사람·십자 로고 없음.
이미 있는 것은 다시 그리지 않는다 — 의원(pb-reception·pb-exam-bed·pb-doctor-desk·pb-med-cabinet·pb-waiting-sofa·pb-water-dispenser·
pb-magazine-rack·pb-scale-height·pb-curtain), 사무(of-elevator·of-plant-big), 현관(umbrella-stand) 을 그대로 섞어 쓴다.

  python3 scripts/content/jp-city/blocks/interior_hospital.py     # 검사 + _all-x3.png + _gate/*.png + items.jsonl
"""
import os, sys
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, '..', 'interior'))
from inst import Inst, main, furn, drawer, glass, paper, books, rnd, h32, NT, MI, box34   # noqa: E402

BLOCK = 'interior_hospital'
I = Inst(BLOCK, '병원')
R = I.R
TAGS = ('병원', '病院', 'hospital')


# ═══════════════ 바닥·벽면 ═══════════════
@I.floor('hs-floor-sheet', '병원 비닐 시트(연한 민트 회색)', cols=4, rows=4, tags=TAGS + ('대기실', '복도', '병동'),
         desc='병원 복도·대기실의 장척 비닐 시트 — 연한 민트 회색 바탕에 작은 덩이 얼룩, 32px 마다 희미한 용접 이음선. 넓게 깔아도 줄무늬가 안 생긴다.')
def _(c):
    for y in range(c.h):
        for x in range(c.w):
            r = rnd(x // 3, y // 2, 31); q = rnd(x, y, 32)
            t = 4
            if r < 0.05 and q < 0.6: t = 3
            if q > 0.992: t = 3
            c.P(x, y, 'lino', t)
    for k in range(0, c.w, 32):
        for y in range(c.h):
            if (y // 4) % 3 != 2: c.P(k, y, 'lino', 3)


@I.floor('hs-floor-ward', '병실 비닐 타일(연베이지 나뭇결)', cols=4, rows=4, tags=TAGS + ('병실', '진찰실'),
         desc='병실·진찰실의 따뜻한 연베이지 목재 무늬 비닐 타일 — 가로 16px 판이 반씩 엇갈리고 결이 한두 줄 지나간다.')
def _(c):
    for y in range(c.h):
        row = y // 8
        for x in range(c.w):
            xs = x + (16 if row % 2 else 0) + (8 if row % 4 >= 2 else 0); k = xs // 32; lx = xs % 32; ly = y % 8
            t = 3
            if ly == 0: t = 4
            elif ly == 7 or lx == 31: t = 2
            elif rnd(x // 5, y, 8 + h32(k, row, 7) % 3) < 0.10: t = 4
            c.P(x, y, 'kinari', t)


def handrail(c, y, mat='yuka'):
    """복도 손잡이 난간: 둥근 나무 봉(윗면 밝게) + 16px 마다 쇠 받침."""
    c.HL(0, y, c.w, mat, 4); c.HL(0, y + 1, c.w, mat, 3); c.HL(0, y + 2, c.w, mat, 1)
    c.HL(0, y + 3, c.w, 'lino', 2)
    for x in range(6, c.w, 16):
        c.P(x, y + 3, 'tekko', 4); c.P(x, y + 4, 'tekko', 3); c.P(x + 1, y + 4, 'tekko', 2)


@I.wall('hs-wall', '병원 벽(흰 칠 + 연녹 허리판 + 나무 손잡이)', cols=2, tags=TAGS + ('복도', '대기실', '병동'),
        desc='병원 복도·대기실 벽 — 위는 흰 칠, 허리 아래 연한 녹색 판, 그 경계에 둥근 나무 손잡이 난간(쇠 받침), 맨 아래 회색 걸레받이.')
def _(c):
    for y in range(0, 18):
        for x in range(c.w): c.P(x, y, 'shiro', 3 if rnd(x, y, 41) > 0.04 else 2)
    handrail(c, 15)
    for y in range(20, 28):
        for x in range(c.w): c.P(x, y, 'lino', 4 if rnd(x, y, 42) > 0.05 else 3)
    for x in range(0, c.w, 16): c.VL(x + 15, 21, 7, 'lino', 3)
    c.HL(0, 28, c.w, 'conc', 4); c.R(0, 29, c.w, 2, 'conc', 3); c.HL(0, 31, c.w, 'sumi', 1)


@I.wall('hs-wall-room', '병실·진찰실 벽(연크림 + 의료 가스 띠)', cols=2, tags=TAGS + ('병실', '진찰실', '처치실'),
        desc='병실·진찰실 벽 — 연한 크림색 칠, 눈높이에 가는 연녹 띠, 아래 크림 걸레받이. 침대 머리맡 가스 단자는 걸이 기물(hs-bed-headwall)로 단다.')
def _(c):
    for y in range(0, 28):
        for x in range(c.w): c.P(x, y, 'kinari', 4 if rnd(x, y, 43) > 0.04 else 3)
    c.HL(0, 12, c.w, 'lino', 4); c.HL(0, 13, c.w, 'lino', 3)
    c.HL(0, 28, c.w, 'kinari', 3); c.R(0, 29, c.w, 2, 'kinari', 2); c.HL(0, 31, c.w, 'sumi', 1)


# ═══════════════ 병실 ═══════════════
@I.obj('hs-ward-bed', '병실 침대(난간·하늘색 이불)', 'low_furniture', w=1, h=2, up=8, kind='wall', use=('sleep', 'heal'),
       tags=TAGS + ('병실', '침대', '病室'), place='병실 북쪽 벽에 머리를 붙여 한 줄로 — 침대 사이 1칸(커튼·협탁 자리)',
       desc='전동 병원 침대 — 크림 머리판이 벽 앞에 솟고, 흰 시트·베개 위에 하늘색 이불이 접혀 덮였다. 위쪽 양옆에 은색 사이드 난간, 발치 판과 바퀴.')
def _(c):
    # 머리판(벽 앞에 솟음): 윗면 3행 + 앞면
    furn(c, 1, 2, 14, 11, 3, 'kinari', tt=4, ft=2)
    c.HL(3, 7, 10, 'kinari', 3); c.HL(3, 10, 10, 'kinari', 1)
    # 매트리스 윗면(시트)
    c.R(1, 12, 14, 30, 'shiro', 4)
    c.VL(1, 12, 30, 'sumi', 1); c.VL(14, 12, 30, 'sumi', 1)
    c.VL(2, 13, 28, 'shiro', 3); c.VL(13, 13, 28, 'shiro', 2)
    # 베개
    c.R(3, 13, 10, 6, 'shiro', 4); c.HL(3, 13, 10, 'shiro', 4); c.HL(4, 18, 8, 'shiro', 2); c.VL(12, 14, 4, 'shiro', 2)
    c.HL(4, 14, 3, 'shiro', 4); c.P(3, 13, 'shiro', 3); c.P(12, 13, 'shiro', 3)
    c.HL(5, 16, 6, 'shiro', 3)
    # 이불: 접힌 흰 시트 띠 + 하늘색 이불(주름)
    c.R(2, 21, 12, 2, 'shiro', 4); c.HL(2, 23, 12, 'shiro', 2)
    for y in range(24, 40):
        for x in range(2, 14):
            t = 6
            if x in (2, 3): t = 5
            if x >= 12: t = 4
            if (x + y // 3) % 9 == 0 and y < 38: t = 5
            c.P(x, y, 'garasu', t)
    c.HL(2, 24, 12, 'garasu', 5)
    # 이불이 발치로 흘러내린 앞면
    c.R(1, 40, 14, 2, 'garasu', 4); c.HL(1, 41, 14, 'garasu', 3)
    # 사이드 난간(위쪽 절반): 은색 봉 + 받침
    for x0 in (0, 15):
        c.VL(x0, 14, 13, 'tekko', 5); c.P(x0, 14, 'tekko', 6); c.P(x0, 26, 'tekko', 2)
    c.VL(1, 15, 11, 'tekko', 3); c.VL(14, 15, 11, 'tekko', 3)
    # 발치 판: 윗면 2행 + 앞면 + 바퀴
    c.R(1, 42, 14, 2, 'kinari', 4); c.HL(1, 42, 14, 'kinari', 3)
    c.R(1, 44, 14, 2, 'kinari', 2); c.HL(1, 44, 14, 'kinari', 1)
    c.HL(1, 46, 14, 'sumi', 1); c.VL(0, 42, 5, 'sumi', 1); c.VL(15, 42, 5, 'sumi', 1)
    for wx in (2, 12):
        c.R(wx, 46, 2, 2, 'yoru', 1); c.P(wx, 46, 'tekko', 4)


@I.obj('hs-overbed-table', '오버 테이블(침대용 탁자)', 'low_furniture', w=1, h=1, up=6, use=('search',),
       tags=TAGS + ('병실',), place='병실 침대 바로 옆 칸 — 침대 쪽으로',
       desc='침대 위로 미끄러져 들어가는 병원 오버 테이블 — 연한 나무 상판(윗면 넓게), 한쪽만 선 은색 기둥과 H 자 바퀴 받침, 위에 물컵.')
def _(c):
    # 캔버스 16×32 (up 6 → U=1)
    furn(c, 1, 10, 14, 7, 4, 'yuka', tt=4, ft=2, grain='wood')
    c.HL(2, 11, 12, 'yuka', 4)
    # 물컵
    c.R(10, 10, 3, 3, 'garasu', 5); c.HL(10, 10, 3, 'garasu', 6); c.P(11, 11, 'sora', 3); c.P(12, 12, 'garasu', 3)
    # 기둥(오른쪽) + 받침
    c.VL(12, 17, 10, 'tekko', 5); c.VL(13, 17, 10, 'tekko', 3)
    c.R(2, 27, 13, 2, 'tekko', 4); c.HL(2, 27, 13, 'tekko', 5); c.HL(2, 29, 13, 'sumi', 1)
    for wx in (2, 13): c.P(wx, 30, 'yoru', 1)
    c.VL(1, 27, 3, 'sumi', 1); c.VL(15, 27, 3, 'sumi', 1)


@I.obj('hs-bedside-cabinet', '병실 협탁(床頭台·작은 TV)', 'tall_furniture', w=1, h=1, up=12, kind='wall', use=('search',),
       tags=TAGS + ('병실',), place='병실 침대와 침대 사이, 북쪽 벽 앞',
       desc='병실 협탁(床頭台) — 크림 몸통에 서랍 둘과 아래 수납 문, 윗면엔 작은 검은 TV 와 꽃병. 침대 머리맡 사이에 둔다.')
def _(c):
    # 캔버스 16×32 (up 12 → U=1). 윗면 판 10행(8..17): 뒤 왼쪽에 작은 TV, 뒤 오른쪽 꽃병, 앞 컵 — 판이 대부분 보인다
    # 윗면 9행(10..18)은 밝은 크림 판(앞면보다 두 단 밝다) — 뒤 가장자리에 작은 TV 만, 앞 6행은 빈 판 위 컵 하나
    y1 = box34(c, 1, 10, 14, 22, 8, 'kinari', 4, 'kinari', 2, lid=False) - 1
    # 작은 TV(윗면 뒤쪽에 선다): 윗 두께 2행 + 화면 + 발 — 판 뒤 3행만 가린다
    c.R(3, 5, 6, 2, 'yoru', 4); c.HL(3, 5, 6, 'yoru', 5)
    c.R(3, 7, 6, 4, 'yoru', 1); c.R(4, 8, 4, 2, 'garasu', 1); c.P(4, 8, 'garasu', 3)
    c.HL(3, 4, 6, 'sumi', 1); c.VL(2, 5, 6, 'sumi', 1); c.VL(9, 5, 6, 'sumi', 1)
    c.R(5, 11, 2, 1, 'yoru', 2); c.HL(3, 12, 6, 'kinari', 2)                              # 발 + 판 위 그늘
    # 물컵(판 가운데 오른쪽, 위에서 본 동그라미 + 그늘)
    c.R(10, 13, 3, 2, 'shiro', 4); c.P(11, 13, 'sora', 3); c.HL(10, 15, 3, 'kinari', 2)
    # 앞면: 서랍 둘 + 아래 문
    drawer(c, 3, y1 + 1, 10, 3, 'kinari', 3, handle=('tekko', 4))
    drawer(c, 3, y1 + 5, 10, 3, 'kinari', 3, handle=('tekko', 4))
    c.R(3, y1 + 9, 10, 2, 'kinari', 2); c.HL(3, y1 + 9, 10, 'kinari', 1); c.P(11, y1 + 9, 'tekko', 4)


@I.obj('hs-iv-stand', '링거 걸이(점적 스탠드)', 'column', w=1, h=1, up=20, use=('heal',),
       tags=TAGS + ('병실', '처치실'), place='병실 침대 옆·처치실 침대 머리맡',
       desc='은색 점적 스탠드 — 꼭대기 갈고리 넷에 투명 수액 팩 하나, 가는 관이 흘러내리고, 아래 바퀴 다섯 갈래 받침(위에서 보이는 별 모양).')
def _(c):
    # 캔버스 16×48 (up 20 → U=2). 꼭대기 갈고리 고리를 위에서 본 타원, 아래 바퀴 받침을 위에서 본 별
    # 갈고리 고리(위에서 본 둥근 테)
    def ring(x, y, dx, dy, d):
        if d < 0.38: return None
        if dy < -0.2: return ('tekko', 3)
        return ('tekko', 6 if dx < 0 else 5)
    c.ell(8, 4, 6.6, 3.2, lambda x, y, dx, dy, d: ('sumi', 1) if d > 0.62 else None)
    c.ell(8, 4, 6.0, 2.7, ring)
    for (hx, hy) in ((2, 4), (14, 4), (8, 1), (8, 7)): c.P(hx, hy, 'tekko', 6)
    # 기둥 꼭대기 마개(위)
    c.R(6, 2, 5, 3, 'tekko', 6); c.HL(7, 2, 3, 'shiro', 4); c.HL(6, 4, 5, 'tekko', 3); c.P(6, 2, 'tekko', 5); c.P(10, 2, 'tekko', 5)   # 기둥 꼭대기 둥근 마개(윗면)
    c.HL(7, 1, 3, 'sumi', 1); c.HL(6, 5, 5, 'tekko', 2)
    # 수액 팩 둘(갈고리에 걸려 늘어짐, 위 가장자리 접힌 띠가 보인다)
    c.R(1, 7, 5, 9, 'garasu', 5); c.HL(2, 7, 3, 'shiro', 4); c.HL(1, 8, 5, 'garasu', 6); c.P(1, 7, 'garasu', 4); c.P(5, 7, 'garasu', 4); c.VL(1, 9, 6, 'garasu', 6)
    c.VL(5, 9, 6, 'garasu', 3); c.R(2, 11, 3, 4, 'kii', 4); c.HL(2, 11, 3, 'kii', 3); c.HL(1, 16, 5, 'garasu', 3)
    c.VL(0, 7, 10, 'sumi', 1); c.VL(6, 8, 9, 'sumi', 1); c.P(2, 6, 'tekko', 4)
    c.R(11, 7, 4, 6, 'garasu', 5); c.HL(11, 7, 4, 'garasu', 6); c.HL(11, 8, 4, 'shiro', 4); c.VL(14, 9, 4, 'garasu', 3)
    c.R(12, 10, 2, 2, 'sora', 3); c.HL(11, 13, 4, 'garasu', 3); c.VL(15, 7, 7, 'sumi', 1); c.P(14, 6, 'tekko', 4)
    # 관
    c.VL(3, 17, 7, 'garasu', 5); c.line(3, 24, 6, 28, 'garasu', 5); c.P(6, 29, 'garasu', 4)
    c.VL(13, 14, 5, 'garasu', 5); c.line(13, 19, 10, 23, 'garasu', 5)
    # 기둥
    c.VL(8, 6, 32, 'tekko', 5); c.VL(9, 6, 32, 'tekko', 3)
    c.R(7, 21, 4, 2, 'tekko', 4); c.HL(7, 21, 4, 'tekko', 6)                             # 높이 조절 마디
    # 받침(위에서 본 별 다섯 갈래 + 바퀴)
    star_plan(c, 8, 40)


@I.obj('hs-wheelchair', '휠체어(접이식·남향)', 'seat', w=1, h=1, up=10, use=('sit',),
       tags=TAGS + ('대기실', '병동', '복도'), place='대기실 구석·병동 복도 벽 곁',
       desc='남쪽을 보는 접이식 휠체어 — 남색 천 좌판을 위에서 보고, 등받이가 뒤로 솟고, 양옆 큰 은색 바퀴(손잡이 테)와 앞 발판.')
def _(c):
    # 캔버스 16×32 (up 10 → U=1)
    # 손잡이·등받이
    c.P(2, 4, 'yoru', 2); c.P(13, 4, 'yoru', 2)
    c.VL(2, 5, 12, 'tekko', 5); c.VL(13, 5, 12, 'tekko', 3)
    c.R(3, 6, 10, 7, 'kon', 2); c.HL(3, 6, 10, 'kon', 3); c.HL(3, 12, 10, 'kon', 1)
    # 좌판(윗면)
    c.R(3, 13, 10, 7, 'kon', 3); c.HL(3, 13, 10, 'kon', 4); c.HL(3, 19, 10, 'kon', 2)
    # 팔걸이
    c.R(1, 11, 2, 7, 'tekko', 5); c.R(13, 11, 2, 7, 'tekko', 4); c.HL(1, 11, 2, 'yoru', 2); c.HL(13, 11, 2, 'yoru', 2)
    # 큰 바퀴(옆에서 본 테 — 남향이라 앞쪽에서 얇게 보이는 세로 타원)
    for x0, t in ((0, 4), (14, 3)):
        c.VL(x0, 12, 14, 'yoru', 1); c.VL(x0 + 1, 13, 12, 'tekko', t)
        c.P(x0 + (1 if x0 == 0 else 0), 25, 'sumi', 1)
    # 앞 프레임·발판
    c.VL(4, 20, 6, 'tekko', 4); c.VL(11, 20, 6, 'tekko', 3)
    c.R(3, 25, 4, 2, 'yoru', 3); c.R(9, 25, 4, 2, 'yoru', 3); c.HL(3, 25, 4, 'yoru', 4); c.HL(9, 25, 4, 'yoru', 4)
    c.P(4, 28, 'yoru', 1); c.P(11, 28, 'yoru', 1)
    c.HL(2, 29, 12, 'sumi', 0)


@I.obj('hs-bench-row-s', '대기실 연결 의자(3석·남향)', 'seat', w=3, h=1, up=6, use=('sit',),
       tags=TAGS + ('대기실', '待合室'), place='대기실 가운데 줄 — 접수 창구·호출 화면을 보게(남향이면 남쪽 접수 쪽)',
       desc='쇠 들보 하나에 붙은 대기실 연결 의자 3석 — 둥근 모서리의 청록 비닐 쿠션 좌판을 위에서 보고, 뒤로 낮은 등받이, 좌석 사이 팔걸이, 아래 은색 들보와 다리.')
def _(c):
    # 캔버스 48×32 (up 6 → U=1). 좌석 하나 = 16px. 좌판 윗면 9행이 등받이 앞면보다 크다
    for k in range(3):
        x = k * 16
        # 등받이: 윗면 3행(3..5) + 짧은 앞면 4행(6..9)
        c.HL(x + 2, 2, 12, 'sumi', 1)
        c.HL(x + 2, 3, 12, 'ki', 4); c.R(x + 2, 4, 12, 2, 'ki', 5); c.HL(x + 3, 4, 9, 'ki', 6)
        c.R(x + 2, 6, 12, 4, 'ki', 3); c.HL(x + 2, 6, 12, 'ki', 2); c.HL(x + 2, 9, 12, 'ki', 2)
        c.VL(x + 2, 6, 4, 'ki', 4); c.VL(x + 13, 6, 4, 'ki', 2)
        # 좌판 윗면 9행(10..18): 등받이 밑 그늘 → 앞으로 갈수록 밝게
        c.HL(x + 2, 10, 12, 'ki', 2)
        c.R(x + 2, 11, 12, 2, 'ki', 4)
        c.R(x + 2, 13, 12, 5, 'ki', 5)
        c.VL(x + 2, 11, 7, 'ki', 5); c.VL(x + 3, 13, 5, 'ki', 6); c.VL(x + 13, 11, 7, 'ki', 3)
        c.HL(x + 5, 15, 6, 'ki', 4)                                                       # 쿠션 이음
        c.HL(x + 2, 18, 12, 'ki', 6)                                                      # 앞 모서리 반사
        # 좌판 앞면
        c.HL(x + 2, 19, 12, 'ki', 2); c.HL(x + 2, 20, 12, 'ki', 1)
        # 윤곽
        c.VL(x + 1, 3, 18, 'sumi', 1); c.VL(x + 14, 3, 18, 'sumi', 1); c.HL(x + 2, 21, 12, 'sumi', 1)
    # 팔걸이(좌석 사이·양끝): 위에서 본 검은 패드 띠 + 은색 받침
    for ax in (0, 15, 31, 47):
        x0 = ax - (0 if ax == 0 else 1); ww = 1 if ax in (0, 47) else 2
        c.R(x0, 9, ww, 9, 'yoru', 3); c.HL(x0, 9, ww, 'yoru', 4); c.P(x0, 17, 'yoru', 1)
        c.R(x0, 18, ww, 3, 'tekko', 4)
    # 들보(윗면 2행 + 앞면) + 다리
    c.HL(1, 22, 46, 'tekko', 5); c.HL(1, 23, 46, 'tekko', 4); c.HL(1, 24, 46, 'tekko', 2)
    for lx in (4, 23, 43):
        c.R(lx, 25, 2, 4, 'tekko', 4); c.VL(lx + 1, 25, 4, 'tekko', 2)
        c.R(lx - 1, 28, 4, 2, 'tekko', 5); c.HL(lx - 1, 29, 4, 'tekko', 3); c.HL(lx - 1, 30, 4, 'sumi', 0)


# ═══════════════ 공용 도우미(이 블록) ═══════════════
def box(c, x, y, w, h, top, tm, tt, fm=None, ft=None, ol=True):
    """3/4 상자: 윗면 top 행(뒤 가장자리 어둡게·왼쪽 밝게·앞 모서리 반사) + 앞면(입술 밑 그늘·왼 빛·오른 그늘) + sumi 윤곽."""
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


def wheel(c, x, y):
    """작은 바퀴(위에서 반쯤 보임) + 접지 점."""
    c.R(x, y, 2, 2, 'yoru', 1); c.P(x, y, 'tekko', 4); c.HL(x, y + 2, 2, 'sumi', 0)


def star_base(c, cx, cy, mat='tekko'):
    """다섯 갈래 바퀴 받침(위에서 보이는 별)."""
    for (dx, dy) in ((-6, 0), (6, 0), (-4, 3), (4, 3), (0, 4)):
        c.line(cx, cy, cx + dx, cy + dy, mat, 4)
    c.R(cx - 2, cy - 1, 5, 3, mat, 5); c.HL(cx - 2, cy - 1, 5, mat, 6)
    for (wx, wy) in ((cx - 6, cy + 1), (cx + 6, cy + 1), (cx - 4, cy + 4), (cx + 4, cy + 4), (cx, cy + 5)):
        c.P(wx, wy, 'yoru', 1); c.P(wx, wy + 1, 'sumi', 0)


def star_plan(c, cx, cy, mat='tekko'):
    """다섯 갈래 바퀴 받침을 위에서 본 별: 가운데 둥근 마디(윗면) + 두께 있는 갈래 + 바퀴(접지 점)."""
    legs = ((-7, 0), (7, 0), (-5, 4), (5, 4), (0, -3))
    for (dx, dy) in legs:
        c.line(cx, cy + 1, cx + dx, cy + dy + 1, mat, 2)
        c.line(cx, cy, cx + dx, cy + dy, mat, 5 if dx <= 0 else 4)
    c.ell(cx + 0.5, cy + 0.5, 2.6, 1.8, lambda x, y, dx, dy, d: (mat, 3) if d > 0.6 and dy > 0 else (mat, 6 if dx < 0 else 5))
    for (dx, dy) in legs:
        wx, wy = cx + dx, cy + dy
        c.R(wx - (1 if dx > 0 else 0), wy, 2, 2, 'yoru', 1); c.P(wx - (1 if dx > 0 else 0), wy, 'yoru', 3)
        c.HL(wx - (1 if dx > 0 else 0), wy + 2, 2, 'sumi', 0)


def acrylic(c, x, y, w, h):
    """투명 칸막이 판: 얇은 테 + 사선 반사 두 줄(속은 비친다)."""
    c.HL(x, y, w, 'garasu', 6); c.VL(x, y, h, 'garasu', 5); c.VL(x + w - 1, y, h, 'garasu', 4); c.HL(x, y + h - 1, w, 'garasu', 4)
    for k, t in ((2, 6), (4, 5)):
        for i in range(min(w, h)):
            xx = x + k + i; yy = y + h - 2 - i
            if x < xx < x + w - 1 and y < yy < y + h - 1: c.P(xx, yy, 'garasu', t)


def lino_front(c, x, y, w, h, seam=16):
    """연녹 앞판: 위 그늘·판 이음·아래 굽도리."""
    c.R(x, y, w, h, 'lino', 3)
    c.HL(x, y, w, 'lino', 1); c.HL(x, y + 1, w, 'lino', 4)
    c.VL(x + 1, y + 1, h - 3, 'lino', 4)
    for k in range(x + seam, x + w - 2, seam): c.VL(k, y + 2, h - 5, 'lino', 2); c.VL(k + 1, y + 2, h - 5, 'lino', 4)
    c.HL(x, y + h - 3, w, 'conc', 3); c.HL(x, y + h - 2, w, 'conc', 2)
    c.VL(x + w - 2, y + 1, h - 3, 'lino', 2)


# ═══════════════ 대기실·접수 ═══════════════
@I.obj('hs-bench-row-n', '대기실 연결 의자(3석·북향)', 'seat', w=3, h=1, up=6, use=('sit',),
       tags=TAGS + ('대기실', '待合室'), place='대기실 줄 — 남향 줄(hs-bench-row-s)과 등을 맞대거나, 북쪽 호출 화면을 보게',
       desc='북쪽을 보는 대기실 연결 의자 3석 — 청록 비닐 좌판을 위에서 보고, 등받이는 남쪽(우리 쪽)에 낮게 서서 등판 뒷면이 보인다. 좌석 사이 팔걸이, 은색 들보와 다리.')
def _(c):
    # 캔버스 48×32 (U=1). 북향: 좌판 윗면이 위쪽(먼 쪽)에 크게, 등받이는 남쪽(가까운 쪽)에 낮게 — 윗면 3행 + 등판 뒷면
    for k in range(3):
        x = k * 16
        c.HL(x + 2, 5, 12, 'sumi', 1)
        # 좌판 윗면 10행(6..15) — 앞(북) 모서리가 위
        # 좌판을 위에서 본다: 먼(북) 가장자리 두께는 어둡게(앞으로 떨어지는 면), 판은 우리 쪽으로 갈수록 밝고, 등받이 앞에 깊은 홈 그늘
        c.HL(x + 2, 6, 12, 'ki', 2)
        c.R(x + 2, 7, 12, 3, 'ki', 4); c.R(x + 2, 10, 12, 4, 'ki', 5); c.HL(x + 2, 14, 12, 'ki', 6); c.HL(x + 2, 15, 12, 'yoru', 1)
        c.VL(x + 2, 7, 8, 'ki', 6); c.VL(x + 13, 7, 8, 'ki', 3)
        c.HL(x + 4, 11, 8, 'ki', 6); c.HL(x + 4, 12, 8, 'ki', 4)
        # 등받이(남쪽): 윗면 3행(16..18) + 등판 뒷면 4행(19..22)
        c.HL(x + 2, 16, 12, 'ki', 4); c.R(x + 2, 17, 12, 2, 'ki', 5); c.HL(x + 3, 17, 9, 'ki', 6)
        c.R(x + 2, 19, 12, 4, 'ki', 2); c.HL(x + 2, 19, 12, 'ki', 1); c.VL(x + 2, 19, 4, 'ki', 3); c.VL(x + 13, 19, 4, 'ki', 1)
        c.P(x + 7, 21, 'tekko', 4); c.P(x + 8, 21, 'tekko', 3)                            # 등판 뒤 나사
        c.VL(x + 1, 6, 17, 'sumi', 1); c.VL(x + 14, 6, 17, 'sumi', 1); c.HL(x + 2, 23, 12, 'sumi', 1)
    for ax in (0, 15, 31, 47):
        x0 = ax - (0 if ax == 0 else 1); ww = 1 if ax in (0, 47) else 2
        c.R(x0, 7, ww, 9, 'yoru', 3); c.HL(x0, 7, ww, 'yoru', 4); c.P(x0, 15, 'yoru', 1)
        c.R(x0, 16, ww, 3, 'tekko', 4)
    c.HL(1, 24, 46, 'tekko', 5); c.HL(1, 25, 46, 'tekko', 2)
    for lx in (4, 23, 43):
        c.R(lx, 26, 2, 3, 'tekko', 4); c.VL(lx + 1, 26, 3, 'tekko', 2)
        c.R(lx - 1, 28, 4, 2, 'tekko', 5); c.HL(lx - 1, 29, 4, 'tekko', 3); c.HL(lx - 1, 30, 4, 'sumi', 0)


@I.obj('hs-front-counter', '종합 접수대(総合受付)', 'low_furniture', w=3, h=1, up=10, use=('counter',),
       tags=TAGS + ('대기실', '접수', '総合受付'), place='대기실 북쪽 — 입구에서 정면으로 보이게, 뒤쪽에 직원 자리 1줄',
       desc='종합 접수의 높은 카운터 — 넓은 흰 윗면에 서류 더미·펜꽂이·접수 바구니, 가운데 작은 투명 칸막이 판, 앞면은 연녹 판과 회색 굽도리.')
def _(c):
    # 캔버스 48×32 (U=1)
    acrylic(c, 13, 0, 22, 9)
    y1 = box(c, 0, 6, 48, 26, 11, 'shiro', 3, 'lino', 3)
    acrylic(c, 13, 0, 22, 9)
    c.HL(14, 8, 20, 'shiro', 1)                                    # 칸막이 받침 그늘
    paper(c, 4, 9, 6, 4); paper(c, 5, 8, 6, 4, t=4)
    c.R(38, 9, 7, 4, 'sora', 3); c.HL(38, 9, 7, 'sora', 4); c.HL(38, 12, 7, 'sora', 1)   # 접수 바구니
    paper(c, 39, 9, 5, 2)
    c.R(23, 11, 3, 3, 'yoru', 2); c.HL(23, 11, 3, 'yoru', 4)                   # 펜꽂이
    c.P(23, 10, 'aka', 3); c.P(24, 9, 'sora', 3); c.P(25, 10, 'yoru', 4)
    c.R(29, 12, 5, 2, 'shiro', 4); c.HL(29, 13, 5, 'shiro', 1)                  # 번호표 묶음
    lino_front(c, 1, y1, 46, 31 - y1)
    c.HL(0, 31, 48, 'sumi', 0)


@I.obj('hs-reception-kiosk', '재진 접수기(再来受付機)', 'column', w=1, h=1, up=20, use=('counter',),
       tags=TAGS + ('대기실', '접수', '再来受付機'), place='종합 접수대 옆·입구 안쪽',
       desc='기둥형 받침 위에 비스듬히 누운 하늘빛 화면(글자 없음)과 카드 투입구가 있는 재진 접수기. 아래 넓은 받침판.')
def _(c):
    # 캔버스 16×48 (U=2). 머리 상자 윗면 11행에 비스듬히 누운 화면, 짧은 앞면(카드 투입구), 기둥, 받침판 윗면
    # 받침판(먼저): 윗면 6행 + 앞면
    box(c, 1, 37, 14, 10, 6, 'conc', 5, 'conc', 3)
    c.HL(5, 38, 6, 'conc', 3)                                                             # 기둥 그늘
    # 기둥
    c.R(5, 25, 6, 14, 'shiro', 2); c.VL(5, 25, 14, 'shiro', 3); c.VL(10, 25, 14, 'shiro', 1)
    c.VL(4, 25, 14, 'sumi', 1); c.VL(11, 25, 14, 'sumi', 1)
    # 머리 상자
    y1 = box34(c, 1, 5, 14, 21, 11, 'conc', 5, 'shiro', 2, lid=False) - 1
    # 윗면 판 가운데 누운 화면(뒤가 좁은 사다리꼴) — 둘레 흰 판이 2칸 이상 보인다
    c.poly([(5.5, 8), (10.5, 8), (11.5, 13), (4.5, 13)], lambda x, y: ('tekko', 2))
    c.poly([(6.5, 9), (9.5, 9), (10.5, 12), (5.5, 12)], lambda x, y: ('sora', 4 if y > 9 else 3))
    c.P(7, 9, 'shiro', 4); c.HL(5, 14, 7, 'shiro', 2); c.P(12, 11, 'midori', 3)
    # 앞면: 카드 투입구 + 표시등
    c.HL(4, y1 + 3, 6, 'yoru', 0); c.HL(4, y1 + 4, 6, 'tekko', 4)
    c.R(11, y1 + 3, 2, 2, 'kii', 3)


@I.obj('hs-pay-machine', '자동 정산기(自動精算機)', 'tall_furniture', w=1, h=1, up=16, kind='wall', use=('counter',),
       tags=TAGS + ('대기실', '会計', '自動精算機'), place='회계 창구 옆 북쪽 벽 앞에 2~3대 나란히',
       desc='흰 몸통의 자동 정산기 — 윗면, 비스듬한 하늘빛 화면, 그 아래 지폐(초록)·동전(노랑) 투입구와 영수증 구멍, 아래 거스름돈 받는 홈.')
def _(c):
    # 캔버스 16×32 (U=1). 윗판 9행(연회색 뚜껑 판 — 위에서 본 판, 앞 모서리 반사 + 앞면 위 그늘), 앞면 위쪽에 비스듬한 화면,
    # 그 아래 지폐(초록)·동전(노랑) 투입구, 영수증 구멍, 맨 아래 거스름 홈. 앞면은 판보다 두 단 어둡다.
    y1 = box34(c, 1, 2, 14, 29, 9, 'conc', 5, 'shiro', 2)
    c.R(10, 5, 2, 2, 'midori', 3); c.P(10, 5, 'midori', 4); c.HL(10, 7, 2, 'conc', 3)       # 판 위 상태등(그늘)
    # 앞면 화면(테 + 하늘빛 + 반사)
    c.R(3, y1, 10, 6, 'yoru', 1); c.R(4, y1 + 1, 8, 4, 'sora', 3); c.HL(4, y1 + 1, 8, 'sora', 4); c.P(5, y1 + 2, 'shiro', 4)
    c.R(9, y1 + 3, 2, 1, 'midori', 3)
    c.R(3, y1 + 7, 5, 2, 'midori', 2); c.HL(3, y1 + 7, 5, 'midori', 3); c.HL(4, y1 + 8, 3, 'sumi', 0)
    c.R(9, y1 + 7, 4, 2, 'kii', 2); c.HL(9, y1 + 7, 4, 'kii', 3); c.P(10, y1 + 8, 'sumi', 0)
    c.R(4, y1 + 10, 8, 1, 'sumi', 0); c.HL(4, y1 + 11, 8, 'shiro', 3)
    c.R(4, y1 + 13, 8, 4, 'yoru', 1); c.HL(4, y1 + 13, 8, 'yoru', 0); c.HL(5, y1 + 16, 6, 'tekko', 4); c.P(12, y1 + 14, 'aka', 3)


@I.obj('hs-call-display', '진료 호출 화면', 'wall_mounted', w=2, kind='hang', hrows=2, use=('read',),
       tags=TAGS + ('대기실', '呼出'), place='대기실 북쪽 벽면 윗줄 — 의자 줄에서 보이게',
       desc='천장에서 쇠봉 둘로 내려온 검은 호출 번호판 — 주황·초록 점 칸이 줄지어 켜져 있다(숫자 모양 없이 색 덩이). 위 테 밝게, 아래 그늘.')
def _(c):
    # 캔버스 32×32
    for x in (7, 24):
        c.VL(x, 0, 7, 'tekko', 5); c.VL(x + 1, 0, 7, 'tekko', 3); c.HL(x - 1, 6, 4, 'tekko', 4)
    c.R(1, 7, 30, 3, 'tekko', 5); c.HL(1, 7, 30, 'tekko', 6); c.HL(1, 9, 30, 'tekko', 3)     # 윗 두께
    c.R(1, 10, 30, 15, 'yoru', 0); c.HL(2, 10, 28, 'yoru', 2)
    for r, (y, mat) in enumerate(((12, 'daidai'), (16, 'midori'), (20, 'daidai'))):
        for k in range(5):
            x = 3 + k * 6
            on = (r * 5 + k) % 4 != 3
            if on:
                c.R(x, y, 4, 2, mat, 3); c.HL(x, y, 4, mat, 4); c.P(x + 3, y + 1, mat, 2)
            else:
                c.R(x, y, 4, 2, 'yoru', 2)
    c.HL(1, 25, 30, 'yoru', 3); c.HL(1, 26, 30, 'sumi', 0)
    c.VL(0, 7, 20, 'sumi', 1); c.VL(31, 7, 20, 'sumi', 1); c.HL(1, 27, 30, 'sumi', 0)


@I.obj('hs-tv-wall', '벽걸이 TV(대기실)', 'wall_mounted', w=2, kind='hang', hrows=2, use=('read',),
       tags=TAGS + ('대기실', '병실'), place='대기실·휴게실 벽면',
       desc='벽 받침에 걸린 얇은 검은 TV — 위 두께 테가 밝고 아래로 그늘이 진다. 꺼진 듯 어두운 화면에 사선 반사 두 줄과 흐린 풍경 덩이.')
def _(c):
    # 캔버스 32×32
    c.R(1, 4, 30, 2, 'yoru', 4); c.HL(1, 4, 30, 'yoru', 5)                         # 윗 두께
    c.R(1, 6, 30, 18, 'yoru', 1); c.HL(1, 6, 30, 'yoru', 2)
    c.R(3, 7, 26, 15, 'garasu', 1)
    c.R(3, 15, 26, 7, 'ki', 1); c.R(3, 12, 10, 3, 'garasu', 2); c.R(15, 13, 8, 2, 'ki', 2)   # 흐린 풍경
    c.R(3, 7, 26, 4, 'garasu', 2)
    for k, t in ((6, 4), (9, 3)):
        for i in range(12):
            x = 3 + k + i; y = 21 - i
            if 7 <= y <= 21 and x < 29: c.P(x, y, 'garasu', t)
    c.HL(1, 22, 30, 'yoru', 2); c.P(27, 23, 'midori', 3)
    c.HL(1, 24, 30, 'yoru', 0); c.HL(3, 25, 26, 'sumi', 0)
    c.HL(1, 3, 30, 'sumi', 1); c.VL(0, 4, 21, 'sumi', 1); c.VL(31, 4, 21, 'sumi', 1)


@I.obj('hs-kids-mat', '키즈 코너 퍼즐 매트', 'flat', w=2, h=2, kind='flat', use=('walk',),
       tags=TAGS + ('대기실', '키즈', 'キッズ'), place='대기실 한쪽 구석 2×2 — 장난감 선반 곁',
       desc='네 가지 색 조각(빨강·하늘·노랑·초록)이 요철 이음으로 맞물린 키즈 코너 퍼즐 매트. 조각마다 밝은 위 테와 어두운 아래 테.')
def _(c):
    mats = (('aka', 'sora'), ('kii', 'midori'))
    for y in range(32):
        for x in range(32):
            c.P(x, y, mats[y // 16][x // 16], 3)
    # 요철: 세로 이음(x=16) 에 왼쪽 조각이 오른쪽으로 튀어나간 혹, 가로 이음(y=16) 에 위 조각이 아래로
    for gy in (0, 16):
        m = mats[gy // 16][0]; c.R(16, gy + 6, 3, 4, m, 3)
    for gx in (0, 16):
        m = mats[0][gx // 16]; c.R(gx + 6, 16, 4, 3, m, 3)
    # 테: 조각 경계 어둡게(아래·오른쪽), 밝게(위·왼쪽)
    for y in range(32):
        for x in range(32):
            g = c.get(x, y); m, t = g
            r = c.get(x + 1, y) if x < 31 else None; d = c.get(x, y + 1) if y < 31 else None
            l = c.get(x - 1, y) if x > 0 else None; u = c.get(x, y - 1) if y > 0 else None
            if (r and r[0] != m) or (d and d[0] != m): c.P(x, y, m, 1)
            elif (l and l[0] != m) or (u and u[0] != m): c.P(x, y, m, 4)
    for x in range(32): c.P(x, 0, mats[0][x // 16], 4); c.P(x, 31, mats[1][x // 16], 1)
    for y in range(32): c.P(0, y, mats[y // 16][0], 4); c.P(31, y, mats[y // 16][1], 1)
    # 바깥 요철 자국
    for (x, y, m) in ((6, 0, 'aka'), (22, 0, 'sora'), (0, 6, 'aka'), (0, 22, 'kii'), (31, 6, 'sora'), (31, 22, 'midori'), (6, 31, 'kii'), (22, 31, 'midori')):
        for i in range(4):
            if y in (0, 31): c.P(x + i, y, m, 2)
            else: c.P(x, y + i, m, 2)
    # 작은 결
    for (x, y) in ((5, 5), (25, 9), (9, 24), (21, 27), (27, 20)): c.shift(x, y, 1)


@I.obj('hs-toy-shelf', '키즈 코너 낮은 장난감 선반', 'low_furniture', w=2, h=1, up=6, use=('search',),
       tags=TAGS + ('대기실', '키즈'), place='퍼즐 매트 곁·대기실 구석 벽 앞',
       desc='아이 키 낮은 나무 칸 선반 — 연한 나무 윗면에 블록 두 개, 앞 칸 셋에 색 블록·공·그림책이 들어 있다.')
def _(c):
    # 캔버스 32×32 (U=1)
    y1 = box(c, 1, 8, 30, 23, 7, 'yuka', 3, 'yuka', 2)
    for i in range(3, 28, 5): c.P(i, 11, 'yuka', 2); c.P(i + 2, 13, 'yuka', 4)
    # 윗면 블록
    c.R(5, 9, 4, 3, 'aka', 3); c.HL(5, 9, 4, 'aka', 4); c.HL(5, 12, 4, 'aka', 1)
    c.R(9, 10, 3, 3, 'sora', 3); c.HL(9, 10, 3, 'sora', 4); c.HL(9, 13, 3, 'sora', 1)
    c.R(22, 10, 5, 3, 'kii', 3); c.HL(22, 10, 5, 'kii', 4); c.HL(22, 13, 5, 'kii', 1)
    # 칸 셋
    for k, x in enumerate((3, 12, 21)):
        c.R(x, y1 + 2, 8, 11, 'yuka', 0); c.HL(x, y1 + 2, 8, 'soil', 0); c.VL(x, y1 + 2, 11, 'soil', 1)
        c.HL(x, y1 + 13, 8, 'yuka', 3)
    # 칸1: 블록 쌓기
    c.R(4, y1 + 9, 3, 4, 'aka', 3); c.HL(4, y1 + 9, 3, 'aka', 4); c.R(7, y1 + 10, 3, 3, 'midori', 3); c.HL(7, y1 + 10, 3, 'midori', 4)
    c.R(5, y1 + 6, 3, 3, 'kii', 3); c.HL(5, y1 + 6, 3, 'kii', 4)
    # 칸2: 공
    def ball(x, y, dx, dy, d):
        if d > 0.7: return ('daidai', 1)
        if dx < -0.1 and dy < -0.1: return ('daidai', 4)
        return ('daidai', 3)
    c.ell(16, y1 + 9, 3.6, 3.6, ball); c.P(15, y1 + 7, 'shiro', 4)
    # 칸3: 그림책
    books(c, 22, y1 + 4, 7, 9, s=3)
    c.HL(1, 31, 30, 'sumi', 0)


@I.obj('hs-sanitizer-stand', '손 소독제 받침대', 'column', w=1, h=1, up=16, use=('heal',),
       tags=TAGS + ('입구', '대기실', '消毒'), place='입구 안쪽·엘리베이터 앞·병실 문 곁',
       desc='얇은 은색 기둥 위 둥근 접시(윗면)에 펌프 소독제 병, 아래 흘림 받이 접시와 둥근 받침판.')
def _(c):
    # 캔버스 16×32 (U=1). 둥근 받침판·접시를 위에서 본 타원, 병도 원통(위 타원 어깨 + 몸)
    def disk(mat, hi, mid, lo):
        def f(x, y, dx, dy, d):
            if d > 0.72: return (mat, lo)
            if dx < -0.2 and dy < 0: return (mat, hi)
            return (mat, mid)
        return f
    # 받침판: 윗면 타원 + 앞 두께
    c.ell(8, 27, 7.0, 3.6, lambda x, y, dx, dy, d: ('sumi', 1) if d > 0.8 else None)
    c.R(2, 27, 13, 2, 'tekko', 2); c.HL(3, 29, 11, 'tekko', 1); c.HL(3, 30, 11, 'sumi', 0)
    c.ell(8, 26, 6.4, 3.0, disk('tekko', 6, 5, 3))
    c.ell(8, 26, 1.6, 1.0, lambda *a: ('tekko', 2))                                       # 기둥 그늘
    # 기둥
    c.VL(7, 16, 10, 'tekko', 5); c.VL(8, 16, 10, 'tekko', 3)
    # 위 접시: 두께 + 윗면 타원(7행) + 흘림 받이 홈
    c.ell(8, 13, 7.2, 3.8, lambda x, y, dx, dy, d: ('sumi', 1) if d > 0.82 else ('tekko', 2))
    c.ell(8, 12, 6.6, 3.4, disk('tekko', 6, 5, 3))
    c.ell(8, 12, 4.6, 2.2, lambda x, y, dx, dy, d: ('tekko', 4 if dy > 0 else 3))
    # 펌프병(원통): 몸 + 위 어깨 타원 + 펌프 머리
    c.R(5, 4, 6, 9, 'shiro', 3); c.VL(5, 4, 9, 'shiro', 4); c.VL(10, 4, 9, 'shiro', 1); c.HL(5, 12, 6, 'shiro', 1)
    c.R(6, 7, 4, 4, 'sora', 3); c.P(6, 7, 'sora', 4); c.HL(6, 10, 4, 'sora', 2)
    c.VL(4, 4, 9, 'sumi', 1); c.VL(11, 4, 9, 'sumi', 1)
    c.ell(8, 4, 3.4, 1.8, lambda x, y, dx, dy, d: ('shiro', 2) if d > 0.7 else ('shiro', 4))
    c.R(7, 1, 2, 3, 'shiro', 2); c.P(7, 1, 'shiro', 4)
    c.R(6, 0, 4, 1, 'shiro', 4); c.P(10, 0, 'shiro', 3); c.P(10, 1, 'shiro', 1)


@I.obj('hs-aed', 'AED 수납함', 'wall_mounted', w=1, kind='hang', hrows=2, use=('heal',),
       tags=TAGS + ('대기실', '복도', 'AED'), place='대기실·복도 눈높이 벽면',
       desc='흰 AED 벽 수납함 — 위 두께 테가 밝고, 위쪽 빨간 띠와 작은 초록 띠(글자 없음), 가운데 투명 창 속 주황 AED 본체, 아래 그늘.')
def _(c):
    # 캔버스 16×32
    c.R(1, 6, 14, 3, 'shiro', 4); c.HL(1, 8, 14, 'shiro', 2)                      # 윗 두께
    c.R(1, 9, 14, 17, 'shiro', 3); c.VL(2, 9, 16, 'shiro', 4); c.VL(13, 9, 16, 'shiro', 1)
    c.R(1, 9, 14, 3, 'aka', 2); c.HL(1, 9, 14, 'aka', 3)                           # 빨간 띠
    c.R(3, 13, 10, 9, 'garasu', 4); c.HL(3, 13, 10, 'tekko', 2)
    c.R(5, 15, 6, 6, 'daidai', 3); c.HL(5, 15, 6, 'daidai', 4); c.HL(5, 20, 6, 'daidai', 1); c.R(7, 17, 2, 2, 'kii', 4)
    c.P(4, 14, 'garasu', 6); c.P(5, 14, 'garasu', 6); c.P(11, 20, 'garasu', 6)
    c.R(3, 23, 10, 1, 'midori', 3)                                                  # 초록 띠
    c.R(12, 17, 1, 3, 'tekko', 4)                                                   # 손잡이
    c.HL(1, 25, 14, 'shiro', 1); c.HL(1, 26, 14, 'sumi', 0); c.HL(2, 27, 12, 'sumi', 0)
    c.HL(1, 5, 14, 'sumi', 1); c.VL(0, 6, 21, 'sumi', 1); c.VL(15, 6, 21, 'sumi', 1)


@I.obj('hs-door-sliding', '병원 넓은 미닫이문(열림)', 'part', kind='door', use=('travel',),
       tags=TAGS + ('문', '미닫이', '병실', '진찰실'), place='가로 칸막이 1칸 틈 칸 — 병실·진찰실·처치실 입구',
       desc='흰 문틀 + 인방 아래로, 크림색 미닫이 문짝이 틀 안 오른쪽으로 밀려 반쯤 보인다(세로 유리 띠·은색 손잡이). 바닥에 은색 레일.')
def _(c):
    # 캔버스 16×32: 왼 기둥 3px, 오른쪽 기둥 3px, 위 인방
    c.R(0, 0, 3, 32, 'shiro', 3); c.VL(0, 0, 32, 'shiro', 1); c.VL(1, 0, 32, 'shiro', 4); c.VL(2, 0, 32, 'shiro', 2)
    c.R(13, 0, 3, 32, 'shiro', 2); c.VL(13, 0, 32, 'shiro', 3); c.VL(15, 0, 32, 'shiro', 0)
    # 인방: 윗면 3행(칸막이 두께를 위에서 — 밝게) + 앞 모서리 반사 + 아래 안쪽 천장면(soffit) 2행 어둡게 → 벽 두께가 보이는 틈
    c.R(0, 0, 16, 3, 'conc', 5); c.HL(0, 0, 16, 'conc', 4); c.HL(0, 2, 16, 'shiro', 4); c.HL(0, 3, 16, 'shiro', 2)
    c.HL(3, 4, 10, 'yoru', 1); c.HL(3, 5, 10, 'yoru', 3)
    c.R(0, 28, 3, 4, 'conc', 3); c.R(13, 28, 3, 4, 'conc', 2)
    # 문짝(오른쪽으로 밀림): 8px 보이고 나머지는 기둥 속
    x0, y0, w, h = 7, 6, 6, 22
    c.R(x0, y0, w, h, 'kinari', 3); c.VL(x0, y0, h, 'kinari', 1); c.VL(x0 + 1, y0, h, 'kinari', 4); c.HL(x0, y0 + h - 1, w, 'kinari', 1)
    c.R(x0 + 2, y0 + 3, 2, 10, 'garasu', 4); c.P(x0 + 2, y0 + 3, 'garasu', 6); c.P(x0 + 3, y0 + 7, 'garasu', 5)
    c.VL(x0 + 1, y0 + 12, 6, 'tekko', 5); c.VL(x0 + 2, y0 + 13, 4, 'tekko', 3)       # 세로 손잡이
    c.VL(x0 - 1, y0 + 1, h - 1, 'kinari', 0)                                         # 문짝 두께 그늘
    # 레일
    c.HL(3, 29, 10, 'tekko', 5); c.HL(3, 30, 10, 'tekko', 2); c.HL(3, 31, 10, 'tekko', 4)


@I.obj('hs-door-side', '병원 미닫이 옆문(세로 칸막이)', 'part', kind='sidedoor', use=('travel',),
       tags=TAGS + ('문', '미닫이', '복도'), place='세로 칸막이 3줄 틈의 통로 칸(셋째 줄)',
       desc='세로 칸막이 끝 흰 문틀 기둥 + 인방, 벽 속으로 반쯤 밀린 크림색 미닫이(세로 유리 띠·손잡이), 통로 바닥에 남북 은색 레일 두 줄.')
def _(c):
    # 캔버스 16×48
    c.R(0, 0, 3, 32, 'shiro', 3); c.VL(0, 0, 32, 'shiro', 1); c.VL(1, 0, 32, 'shiro', 4); c.VL(2, 0, 32, 'shiro', 2)
    c.R(13, 0, 3, 32, 'shiro', 2); c.VL(13, 0, 32, 'shiro', 3); c.VL(15, 0, 32, 'shiro', 0)
    c.R(0, 29, 3, 3, 'conc', 3); c.R(13, 29, 3, 3, 'conc', 2)
    c.R(0, 22, 16, 6, 'shiro', 3); c.HL(0, 22, 16, 'shiro', 4); c.HL(1, 26, 14, 'shiro', 2); c.HL(0, 27, 16, 'shiro', 1)
    c.VL(0, 22, 6, 'shiro', 1); c.VL(15, 22, 6, 'shiro', 0); c.HL(3, 28, 10, 'yoru', 2)
    for x0 in (2, 12):
        c.VL(x0, 32, 15, 'tekko', 5); c.VL(x0 + 1, 32, 15, 'tekko', 2); c.HL(x0, 46, 2, 'tekko', 1)
    x0, y0, w, h = 3, 28, 8, 17
    c.R(x0, y0, w, h, 'kinari', 3); c.HL(x0, y0, w, 'kinari', 4); c.VL(x0, y0, h, 'kinari', 1); c.VL(x0 + w - 1, y0, h, 'kinari', 1); c.HL(x0, y0 + h - 1, w, 'kinari', 0)
    c.VL(x0 + 1, y0 + 1, h - 2, 'kinari', 4)
    c.R(x0 + 3, y0 + 3, 2, 8, 'garasu', 4); c.P(x0 + 3, y0 + 3, 'garasu', 6); c.P(x0 + 4, y0 + 6, 'garasu', 5)
    c.VL(x0 + 6, y0 + 7, 5, 'tekko', 5); c.P(x0 + 6, y0 + 12, 'tekko', 2)
    c.VL(x0 + w, y0 + 1, h - 1, 'kinari', 0)


# ═══════════════ 진찰실·처치실 ═══════════════
@I.obj('hs-exam-stool', '진찰용 회전 의자', 'seat', w=1, h=1, up=4, use=('sit',),
       tags=TAGS + ('진찰실', '처치실'), place='진찰실 의사 책상 앞·진찰대 곁',
       desc='등받이 없는 둥근 회전 의자 — 남색 비닐 타원 좌판을 위에서 보고, 가는 가스 실린더, 다섯 갈래 받침과 바퀴.')
def _(c):
    # 캔버스 16×32 (U=1)
    def side(x, y, dx, dy, d):
        if d > 0.8: return ('sumi', 1)
        return ('kon', 1 if dx > 0.3 else 2)
    def seat(x, y, dx, dy, d):
        if d > 0.78: return ('kon', 2)
        if dx < -0.1 and dy < 0: return ('kon', 4)
        if dx > 0.45 or dy > 0.5: return ('kon', 2)
        return ('kon', 3)
    c.ell(8, 17, 6.6, 3.6, side)                                                  # 좌판 두께(아래 타원)
    c.ell(8, 14, 6.6, 3.6, side)
    c.R(2, 14, 13, 3, 'kon', 1); c.VL(2, 14, 3, 'kon', 2); c.VL(14, 14, 3, 'sumi', 1); c.VL(1, 14, 3, 'sumi', 1)
    c.ell(8, 14, 6.0, 3.2, seat)
    c.HL(5, 12, 4, 'murasaki', 4); c.P(4, 13, 'kon', 4)
    c.R(7, 21, 2, 4, 'tekko', 5); c.VL(8, 21, 4, 'tekko', 3); c.HL(6, 20, 4, 'yoru', 1)
    c.P(10, 21, 'tekko', 4); c.P(11, 21, 'yoru', 2)                                # 높이 레버
    star_base(c, 8, 25)


@I.obj('hs-ultrasound', '초음파 진단기 카트', 'tall_furniture', w=1, h=1, up=16, use=('switch',),
       tags=TAGS + ('진찰실', '처치실', 'エコー'), place='진찰대 머리맡 옆',
       desc='바퀴 달린 초음파 기계 — 위 검은 모니터(흐린 회색 부채꼴 화면), 가운데 넓은 조작판 윗면(작은 키·둥근 트랙볼), 옆에 프로브 걸이와 늘어진 줄, 아래 흰 몸통과 바퀴.')
def _(c):
    # 캔버스 16×32 (U=1). 조작판 윗면 10행(키·트랙볼·프로브)을 크게, 그 뒤에 윗 두께가 보이는 모니터, 아래 흰 몸통과 바퀴
    # 모니터(뒤쪽, 남쪽을 본다): 윗면 2행 + 화면
    c.R(4, 2, 8, 2, 'yoru', 4); c.HL(4, 2, 8, 'yoru', 5)
    c.R(4, 4, 8, 5, 'yoru', 2); c.R(5, 5, 6, 3, 'yoru', 0)
    c.poly([(8, 5), (5.5, 7.5), (10.5, 7.5)], lambda x, y: ('conc', 2 if (x * 3 + y) % 5 else 3))
    c.P(8, 6, 'conc', 5); c.P(11, 4, 'midori', 3)
    c.HL(4, 1, 8, 'sumi', 1); c.VL(3, 2, 7, 'sumi', 1); c.VL(12, 2, 7, 'sumi', 1)
    c.R(7, 9, 2, 2, 'tekko', 2)
    # 조작판(넓은 윗면 10행) + 앞 두께
    y1 = box(c, 0, 10, 16, 13, 10, 'shiro', 4, 'shiro', 1)
    c.HL(1, 18, 14, 'shiro', 4); c.HL(6, 11, 4, 'shiro', 2)
    for (x, y, m, n) in ((3, 13, 'conc', 2), (6, 13, 'conc', 2), (3, 15, 'conc', 2), (6, 15, 'sora', 2), (3, 17, 'conc', 4), (12, 13, 'midori', 1), (12, 15, 'kii', 1)):
        c.HL(x, y, n, m, 3)
    c.R(9, 15, 2, 2, 'tekko', 5); c.P(9, 15, 'tekko', 6); c.P(10, 16, 'tekko', 2); c.HL(9, 17, 2, 'shiro', 2)   # 트랙볼
    c.R(12, 17, 2, 2, 'shiro', 3); c.P(12, 17, 'yoru', 3); c.P(13, 18, 'yoru', 2)                             # 프로브 꽂이
    c.line(13, 18, 15, 22, 'yoru', 3)
    # 몸통
    c.R(2, y1 + 3, 12, 6, 'shiro', 2); c.VL(3, y1 + 3, 6, 'shiro', 3); c.VL(12, y1 + 3, 6, 'shiro', 1)
    c.HL(2, y1 + 3, 12, 'shiro', 0); c.HL(4, y1 + 5, 8, 'shiro', 1)
    c.VL(1, y1 + 3, 6, 'sumi', 1); c.VL(14, y1 + 3, 6, 'sumi', 1); c.HL(2, y1 + 9, 12, 'sumi', 1)
    for wx in (2, 12): wheel(c, wx, 29)


@I.obj('hs-vitals-monitor', '생체 정보 모니터 스탠드', 'column', w=1, h=1, up=20, use=('switch',),
       tags=TAGS + ('처치실', '병실', '진찰실'), place='처치실·병실 침대 머리맡',
       desc='바퀴 달린 받침 기둥 위 생체 정보 모니터 — 흰 몸통 윗면, 검은 화면에 초록 파형 선과 노랑·하늘 색 덩이(숫자 없음), 가는 기둥, 다섯 갈래 받침.')
def _(c):
    # 캔버스 16×48 (U=2). 모니터 상자 윗면 7행(손잡이), 앞면 화면, 기둥 중간 바구니(위에서 본 철망 타원), 아래 별 받침
    y1 = box34(c, 1, 2, 14, 19, 7, 'conc', 5, 'shiro', 2, lid=False) - 1
    c.HL(5, 4, 6, 'tekko', 5); c.HL(5, 5, 6, 'conc', 3)                                     # 위 손잡이(누운 막대 + 그늘)
    c.P(12, 6, 'aka', 4); c.P(11, 6, 'shiro', 2)
    c.R(2, y1 + 1, 12, 9, 'yoru', 0)
    wave = (3, 3, 3, 2, 0, 4, 3, 3, 3, 3)
    for i, d in enumerate(wave): c.P(3 + i, y1 + 1 + d, 'midori', 4)
    for i in range(3, 13): c.P(i, y1 + 6, 'kii', 3 if i % 2 else 2)
    c.R(10, y1 + 7, 3, 2, 'sora', 4); c.R(3, y1 + 8, 4, 1, 'aka', 3)
    # 기둥
    c.VL(7, 21, 18, 'tekko', 5); c.VL(8, 21, 18, 'tekko', 3)
    # 바구니(위에서 본 철망 타원)
    c.ell(8, 29, 5.2, 2.6, lambda x, y, dx, dy, d: ('tekko', 5 if dy < 0 else 3) if d > 0.55 else ('yoru', 1 if (x + y) % 2 else 2))
    c.HL(4, 32, 9, 'tekko', 2); c.HL(5, 33, 7, 'sumi', 0)
    c.VL(7, 28, 3, 'tekko', 5); c.VL(8, 28, 3, 'tekko', 3)
    star_plan(c, 8, 41)


@I.obj('hs-xray-viewer', '판독용 라이트 박스', 'wall_mounted', w=2, kind='hang', hrows=2, use=('read',),
       tags=TAGS + ('진찰실', 'シャウカステン'), place='진찰실 의사 책상 위 벽면',
       desc='벽에 건 흰 라이트 박스 두 칸 — 위 두께 테가 밝고, 빛나는 판에 흐린 회색 필름 덩이(뼈 모양 아님), 아래 그늘과 작은 스위치.')
def _(c):
    # 캔버스 32×32
    c.R(1, 4, 30, 3, 'shiro', 4); c.HL(1, 6, 30, 'shiro', 2)
    c.R(1, 7, 30, 18, 'shiro', 2); c.VL(2, 7, 17, 'shiro', 3); c.VL(29, 7, 17, 'shiro', 1)
    for x0 in (3, 17):
        c.R(x0, 8, 12, 14, 'kinari', 4)
        c.R(x0 + 1, 9, 10, 12, 'conc', 4); c.HL(x0 + 1, 9, 10, 'conc', 5)
        c.ell(x0 + 4, 14, 2.6, 4.2, lambda x, y, dx, dy, d: ('conc', 6 if d < 0.4 else 5))
        c.ell(x0 + 8, 15, 2.2, 3.6, lambda x, y, dx, dy, d: ('conc', 6 if d < 0.4 else 5))
        c.HL(x0 + 1, 8, 10, 'tekko', 3); c.P(x0 + 5, 8, 'tekko', 5)            # 필름 집게
    c.HL(1, 23, 30, 'shiro', 1); c.R(26, 23, 2, 1, 'midori', 3)
    c.HL(1, 24, 30, 'shiro', 0); c.HL(1, 25, 30, 'sumi', 0); c.HL(2, 26, 28, 'sumi', 0)
    c.HL(1, 3, 30, 'sumi', 1); c.VL(0, 4, 22, 'sumi', 1); c.VL(31, 4, 22, 'sumi', 1)


@I.obj('hs-instrument-cart', '스테인리스 기구 카트(2단)', 'low_furniture', w=1, h=1, up=8, use=('search',),
       tags=TAGS + ('처치실', '진찰실'), place='처치실 침대 곁·진찰대 옆',
       desc='은색 2단 기구 카트 — 윗판에 하늘색 트레이와 가위·겸자 은색 덩이·흰 거즈, 아래 판에 상자, 네 귀 기둥과 바퀴.')
def _(c):
    # 캔버스 16×32 (U=1). 윗판 윗면 11행(스테인리스 트레이·가위·겸자·거즈·소독 솜 병), 네 귀 기둥, 아래 판 윗면 4행, 바퀴
    box(c, 1, 20, 14, 7, 4, 'tekko', 4, 'tekko', 2)
    c.R(4, 20, 6, 3, 'shiro', 4); c.HL(4, 20, 6, 'shiro', 3); c.R(4, 23, 6, 1, 'shiro', 2)
    for x, t in ((2, 5), (13, 3)):
        c.VL(x, 16, 4, 'tekko', t); c.VL(x, 27, 1, 'tekko', t)
    y1 = box(c, 1, 3, 14, 14, 11, 'tekko', 5, 'tekko', 3)
    # 콩팥 모양 트레이(얕은 은색, 안쪽 그늘)
    c.ell(6.5, 8.5, 4.2, 3.0, lambda x, y, dx, dy, d: ('tekko', 3) if d > 0.6 and dy < 0 else (('tekko', 6) if d > 0.6 else ('tekko', 4)))
    c.line(4, 8, 8, 7, 'yoru', 3); c.P(4, 8, 'yoru', 2); c.P(3, 9, 'yoru', 2)              # 가위
    c.line(4, 10, 9, 9, 'tekko', 6); c.P(4, 10, 'yoru', 2)                                 # 겸자
    c.R(10, 5, 3, 3, 'shiro', 4); c.HL(10, 8, 3, 'shiro', 2); c.P(10, 5, 'shiro', 3)        # 거즈
    c.R(11, 10, 2, 2, 'garasu', 5); c.P(11, 10, 'garasu', 6); c.HL(11, 12, 2, 'tekko', 2)   # 솜 병
    for wx in (1, 13): wheel(c, wx, 28)


@I.obj('hs-folding-screen', '흰 천 3폭 칸막이', 'frame', w=2, h=1, up=16, use=('block',),
       tags=TAGS + ('진찰실', '처치실', '衝立'), place='진찰대 곁·처치실 침대 사이',
       desc='은색 쇠 틀에 흰 천을 댄 3폭 접이 칸막이 — 가운데 폭이 뒤로 접혀 지그재그로 선다. 틀 윗봉 윗면이 보이고, 폭마다 앞뒤로 뻗은 발과 작은 바퀴.')
def _(c):
    # 캔버스 32×32 (U=1). 일자로 선 세 폭. 위 틀은 위에서 본 쇠봉 윗면 4행(밝은 띠 + 앞 반사 + 밑 그늘),
    # 천은 앞면, 바닥엔 폭마다 앞뒤로 뻗은 발(위에서 본 짧은 막대)과 바퀴.
    c.HL(1, 6, 30, 'sumi', 1)
    c.R(0, 7, 32, 4, 'tekko', 5); c.HL(1, 7, 30, 'tekko', 4); c.HL(1, 9, 30, 'tekko', 6); c.HL(1, 10, 30, 'shiro', 4)
    c.VL(0, 7, 4, 'sumi', 1); c.VL(31, 7, 4, 'sumi', 1)
    for x0 in (1, 11, 21):
        c.R(x0, 11, 10, 14, 'shiro', 3); c.HL(x0, 11, 10, 'shiro', 1)
        for x in range(x0, x0 + 10, 3): c.VL(x, 12, 13, 'shiro', 2)
        c.VL(x0 + 1, 12, 13, 'shiro', 4)
    for x in (0, 10, 20, 30):
        c.VL(x, 7, 19, 'tekko', 4); c.R(x - (0 if x == 0 else 1), 6, 2 if x in (0, 30) else 3, 2, 'tekko', 6)   # 기둥 + 위 마디(윗면)
    c.HL(1, 25, 30, 'tekko', 3); c.HL(1, 26, 30, 'sumi', 0)
    for x in (1, 11, 20, 29):
        c.R(x, 25, 2, 5, 'tekko', 4); c.VL(x, 25, 5, 'tekko', 5); c.HL(x, 30, 2, 'sumi', 0)          # 앞뒤로 뻗은 발(위에서)
        c.P(x, 29, 'yoru', 1)
    c.VL(0, 11, 15, 'sumi', 1); c.VL(31, 11, 15, 'sumi', 1)


@I.obj('hs-sharps-bin', '의료 폐기물 통(노랑)', 'box', w=1, h=1, up=0, use=('open',),
       tags=TAGS + ('처치실', '진찰실'), place='처치실 카트 곁·진찰실 구석',
       desc='노란 의료 폐기물 통 — 위 뚜껑 윗면(가운데 투입 홈), 뚜껑 밑 빨간 띠, 노란 몸통.')
def _(c):
    # 캔버스 16×16. 뚜껑 윗면 7행(투입 홈·덮개) + 빨간 띠 + 노란 몸통
    c.HL(3, 0, 10, 'sumi', 1)
    c.HL(2, 1, 12, 'kii', 2)                                                               # 뒤 가장자리
    c.R(2, 2, 12, 5, 'kii', 4); c.VL(13, 2, 5, 'kii', 3); c.VL(2, 2, 5, 'kii', 4)
    c.R(5, 3, 6, 3, 'yoru', 1); c.HL(5, 3, 6, 'kii', 1); c.R(5, 3, 3, 2, 'kii', 3); c.HL(5, 5, 6, 'yoru', 0)   # 투입 홈 + 반쯤 연 덮개
    c.P(3, 3, 'shiro', 4)
    c.HL(2, 7, 12, 'kii', 4); c.P(2, 7, 'shiro', 4)                                         # 앞 모서리 반사
    c.HL(2, 8, 12, 'aka', 3); c.HL(2, 9, 12, 'aka', 1)
    c.R(2, 10, 12, 4, 'kii', 2); c.VL(3, 10, 4, 'kii', 3); c.VL(12, 10, 4, 'kii', 1); c.HL(2, 13, 12, 'kii', 1)
    c.VL(1, 1, 14, 'sumi', 1); c.VL(14, 1, 14, 'sumi', 1); c.HL(2, 14, 12, 'sumi', 0); c.HL(3, 15, 10, 'sumi', 0)


# ═══════════════ 병동·병실 ═══════════════
@I.obj('hs-bed-headwall', '침대 머리맡 벽 단자 띠', 'wall_mounted', w=1, kind='hang', hrows=2, use=('heal',),
       tags=TAGS + ('병실', '처치실'), place='병실 침대 머리 위 벽면 — 침대와 같은 x',
       desc='침대 머리맡 벽에 붙은 크림 단자판 — 위 작은 등, 산소(초록)·흡인(흰) 둥근 꼭지, 호출 버튼 줄, 아래로 늘어진 호출 줄. 위 테 밝게, 아래 그늘.')
def _(c):
    # 캔버스 16×32
    c.R(1, 3, 14, 2, 'kinari', 4); c.HL(1, 4, 14, 'kinari', 3)
    c.R(1, 5, 14, 17, 'kinari', 3); c.VL(2, 5, 16, 'kinari', 4); c.VL(13, 5, 16, 'kinari', 2)
    c.R(4, 6, 8, 2, 'kii', 4); c.HL(4, 7, 8, 'kii', 2)                              # 등
    for (cx, mat) in ((5, 'midori'), (11, 'shiro')):
        c.R(cx - 2, 10, 4, 4, mat, 3); c.HL(cx - 2, 10, 4, mat, 4); c.HL(cx - 2, 13, 4, mat, 1); c.P(cx - 1, 11, 'yoru', 1); c.P(cx, 12, 'yoru', 1)
    for i, m in enumerate(('aka', 'kii', 'sora')):
        c.R(3 + i * 4, 16, 3, 2, m, 3); c.HL(3 + i * 4, 16, 3, m, 4)
    c.HL(2, 19, 12, 'kinari', 2)
    c.HL(1, 21, 14, 'kinari', 1); c.HL(1, 22, 14, 'sumi', 0)
    c.VL(4, 18, 9, 'yoru', 3); c.R(3, 27, 3, 3, 'shiro', 3); c.P(4, 28, 'aka', 3); c.HL(3, 30, 3, 'sumi', 0)   # 호출 줄
    c.HL(1, 2, 14, 'sumi', 1); c.VL(0, 3, 20, 'sumi', 1); c.VL(15, 3, 20, 'sumi', 1)


@I.obj('hs-curtain-wide', '병상 칸막이 커튼', 'other', w=2, h=1, up=24, use=('block',),
       tags=TAGS + ('병실', '처치실', 'カーテン'), place='병실 침대 사이·침대 발치 동서 줄',
       desc='천장 레일(윗면 보임)에 걸린 연분홍 무늬 병상 커튼 — 위쪽 흰 그물 띠, 주름져 늘어진 천, 바닥 위 조금 뜬 아래 단과 그늘.')
def _(c):
    # 캔버스 32×48 (U=2). 천장 레일 윗면 띠(3행) → 주름 윗 가장자리 물결(가까운 주름은 아래·밝게) → 그물 띠 → 늘어진 천 → 바닥 위 아래 단 물결 + 발자국 그늘
    def off(x):
        return (0, 1, 2, 2, 1, 0)[x % 6]                                                       # 2 = 가까운(남쪽) 주름
    # 레일(위에서 본 띠) + 고리
    c.HL(1, 0, 30, 'sumi', 1); c.VL(0, 1, 4, 'sumi', 1); c.VL(31, 1, 4, 'sumi', 1)
    c.R(1, 1, 30, 4, 'tekko', 5); c.HL(1, 1, 30, 'tekko', 4); c.HL(2, 2, 28, 'tekko', 6); c.HL(1, 3, 30, 'tekko', 5); c.HL(1, 4, 30, 'shiro', 4)
    c.HL(0, 5, 32, 'tekko', 1)
    for x in range(2, 32, 6): c.P(x, 5, 'tekko', 4); c.P(x + 1, 5, 'tekko', 3)
    for x in range(32):
        o = off(x)
        top = 6 + o
        # 주름 윗 가장자리(위에서 보이는 천 끝 두께 2행)
        c.P(x, top, 'shiro', 4 if o >= 1 else 3); c.P(x, top + 1, 'shiro', 3 if o >= 1 else 2)
        # 그물 띠
        for y in range(top + 2, top + 7):
            c.P(x, y, 'shiro', (3 if o >= 1 else 2) if (x + y) % 3 else 1)
        # 천(가까운 주름 밝게)
        for y in range(top + 7, 41 + o):
            t = (2, 3, 4, 4, 3, 2)[x % 6]
            c.P(x, y, 'pinku', t)
        for y in range(top + 9, 40, 6):
            if x % 6 == 1: c.P(x, y, 'pinku', 1)
        # 아래 단(물결) + 발자국 그늘
        c.P(x, 41 + o, 'pinku', 3); c.P(x, 42 + o, 'pinku', 1)
        c.P(x, 44 + o, 'sumi', 0)
    c.VL(0, 6, 37, 'sumi', 1); c.VL(31, 6, 37, 'sumi', 1)


@I.obj('hs-patient-locker', '환자용 로커', 'tall_furniture', w=1, h=1, up=16, kind='wall', use=('open',),
       tags=TAGS + ('병실',), place='병실 침대 곁 북쪽 벽 앞',
       desc='좁은 크림색 환자 로커 — 윗면, 위 옷장 문과 아래 작은 귀중품 칸 문, 은색 손잡이와 열쇠 구멍, 환기 구멍.')
def _(c):
    # 캔버스 16×32 (U=1)
    y1 = box(c, 1, 1, 14, 30, 5, 'kinari', 3, 'kinari', 3)
    c.R(3, y1 + 1, 10, 14, 'kinari', 3); c.HL(3, y1 + 1, 10, 'kinari', 4); c.VL(12, y1 + 1, 14, 'kinari', 1); c.HL(3, y1 + 14, 10, 'kinari', 1)
    for y in (y1 + 3, y1 + 5): c.HL(5, y, 6, 'kinari', 1)                                # 환기 구멍
    c.R(10, y1 + 8, 1, 3, 'tekko', 5); c.P(11, y1 + 9, 'tekko', 3)
    c.R(3, y1 + 16, 10, 6, 'kinari', 3); c.HL(3, y1 + 16, 10, 'kinari', 4); c.VL(12, y1 + 16, 6, 'kinari', 1); c.HL(3, y1 + 21, 10, 'kinari', 1)
    c.P(10, y1 + 18, 'tekko', 5); c.P(10, y1 + 19, 'yoru', 1)
    c.R(5, y1 + 17, 3, 2, 'shiro', 4)


@I.obj('hs-nurse-counter', '간호사 대기소 카운터', 'low_furniture', w=3, h=1, up=10, use=('counter',),
       tags=TAGS + ('병동', 'ナースステーション'), place='병동 복도 가운데 — 뒤쪽에 간호사 자리',
       desc='간호사 대기소의 넓은 카운터 — 흰 윗면에 안쪽(북쪽)을 보는 모니터 둘의 회색 뒷판과 받침, 서류철·전화, 앞면은 연녹 판.')
def _(c):
    # 캔버스 48×32 (U=1)
    y1 = box(c, 0, 8, 48, 24, 10, 'shiro', 3, 'lino', 3)
    for x0 in (7, 27):                                                                     # 모니터 뒷판
        c.R(x0, 0, 13, 9, 'tekko', 3); c.HL(x0, 0, 13, 'tekko', 4); c.VL(x0, 0, 9, 'tekko', 4); c.VL(x0 + 12, 0, 9, 'tekko', 2)
        c.R(x0 + 4, 3, 5, 3, 'tekko', 2); c.HL(x0 + 4, 3, 5, 'tekko', 1)
        c.HL(x0, 9, 13, 'tekko', 1); c.R(x0 + 5, 10, 3, 2, 'tekko', 2); c.HL(x0 + 3, 12, 7, 'tekko', 4); c.HL(x0 + 3, 13, 7, 'shiro', 1)
        c.HL(x0, -1, 13, 'sumi', 1); c.VL(x0 - 1, 0, 9, 'sumi', 1); c.VL(x0 + 13, 0, 9, 'sumi', 1)
    c.HL(7, 0, 13, 'sumi', 1); c.HL(27, 0, 13, 'sumi', 1)
    books(c, 41, 9, 6, 6, s=5)                                                             # 서류철
    c.R(1, 12, 5, 4, 'shiro', 4); c.R(2, 11, 5, 4, 'sora', 4); c.HL(2, 14, 5, 'sora', 2)  # 서류
    c.R(22, 13, 4, 3, 'yoru', 3); c.HL(22, 13, 4, 'yoru', 5); c.P(24, 15, 'kii', 3)       # 전화
    lino_front(c, 1, y1, 46, 31 - y1)
    c.HL(0, 31, 48, 'sumi', 0)


@I.obj('hs-chart-cart', '전자 차트 카트', 'low_furniture', w=1, h=1, up=12, use=('switch',),
       tags=TAGS + ('병동', '병실'), place='간호사 대기소 곁·병실 복도',
       desc='바퀴 달린 전자 차트 카트 — 흰 윗판에 열린 노트북(하늘빛 화면·키보드), 아래 서랍 몸통, 한 기둥과 바퀴 받침.')
def _(c):
    # 캔버스 16×32 (U=1)
    c.R(3, 0, 10, 7, 'yoru', 1); c.R(4, 1, 8, 5, 'sora', 3); c.HL(4, 1, 8, 'sora', 4); c.P(5, 2, 'shiro', 4); c.R(9, 4, 2, 1, 'midori', 3)
    c.HL(3, 7, 10, 'tekko', 2)
    y1 = box(c, 1, 7, 14, 10, 8, 'shiro', 3, 'shiro', 2)
    c.R(3, 8, 10, 5, 'tekko', 4); c.HL(3, 8, 10, 'tekko', 5)                               # 키보드 판
    for y in (9, 11):
        for x in range(4, 12, 2): c.P(x, y, 'tekko', 2)
    c.R(6, 12, 4, 1, 'tekko', 3)
    drawer(c, 3, y1 + 1, 10, 3, 'shiro', 3, handle=('tekko', 5))
    c.VL(7, 17, 8, 'tekko', 5); c.VL(8, 17, 8, 'tekko', 3)
    c.R(2, 25, 12, 2, 'tekko', 4); c.HL(2, 25, 12, 'tekko', 5); c.HL(2, 27, 12, 'sumi', 1)
    for wx in (1, 13): wheel(c, wx, 28)


@I.obj('hs-med-cart', '투약 카트', 'box', w=1, h=1, up=10, use=('search', 'heal'),
       tags=TAGS + ('병동', '처치실'), place='간호사 대기소 곁·병동 복도',
       desc='색 서랍이 여러 칸 달린 투약 카트 — 윗면 트레이에 약 컵, 앞면 파랑·노랑·분홍 작은 서랍 격자, 아래 바퀴.')
def _(c):
    # 캔버스 16×32 (U=1). 윗면 10행 트레이(약 컵·병) + 앞면 색 서랍 격자 + 바퀴
    # 윗면 10행 = 밝은 흰 판(둘레에 낮은 난간 테) 위에 약 컵 셋·약병 — 판 바탕이 넓게 보인다
    y1 = box34(c, 1, 2, 14, 26, 10, 'conc', 5, 'shiro', 2, lid=False) - 1
    c.HL(2, 3, 12, 'tekko', 4); c.VL(2, 4, 6, 'tekko', 5); c.VL(13, 4, 6, 'tekko', 3)       # 난간 테(뒤·좌·우)
    for x, m in ((4, 'aka'), (7, 'kii')):
        c.R(x, 6, 2, 2, 'shiro', 3); c.P(x, 6, m, 3); c.P(x + 1, 7, m, 4); c.HL(x, 8, 2, 'shiro', 2)   # 약 컵(위에서) + 그늘
    c.R(10, 5, 2, 3, 'ita', 4); c.P(10, 5, 'ita', 6); c.HL(10, 8, 2, 'shiro', 2)            # 약병 + 그늘
    rows = ('sora', 'kii', 'pinku')
    for r, m in enumerate(rows):
        for k in range(2):
            x = 3 + k * 5; y = y1 + 1 + r * 4
            c.R(x, y, 5, 3, m, 3); c.HL(x, y, 5, m, 4); c.HL(x, y + 2, 5, m, 1); c.P(x + 2, y + 1, 'shiro', 4)
    c.HL(3, y1 + 13, 10, 'shiro', 1)
    for wx in (2, 12): wheel(c, wx, 28)


@I.obj('hs-stretcher', '이송용 침대(스트레처)', 'low_furniture', w=2, h=1, up=6, use=('sleep', 'heal'),
       tags=TAGS + ('처치실', '병동', '복도'), place='처치실·복도 벽 곁 — 동서로 길게',
       desc='깨끗한 이송 침대 — 흰 시트 윗면이 넓고 왼쪽 머리 쪽 등받이가 살짝 세워져 베개가 있다. 은색 옆 난간 봉, 아래 틀과 네 바퀴.')
def _(c):
    # 캔버스 32×32 (U=1). 흰 시트 매트 윗면 12행(베개·담요·난간 봉이 그 위), 짧은 앞 두께, 아래 틀과 바퀴
    # 아래 틀·바퀴(먼저)
    c.R(3, 22, 26, 2, 'tekko', 4); c.HL(3, 22, 26, 'tekko', 5); c.HL(3, 23, 26, 'tekko', 2)
    c.R(14, 24, 4, 3, 'tekko', 3); c.VL(14, 24, 3, 'tekko', 5)
    c.R(3, 26, 26, 2, 'tekko', 5); c.HL(3, 27, 26, 'tekko', 2)
    for wx in (3, 27): wheel(c, wx, 28)
    for wx in (8, 22): c.R(wx, 28, 2, 1, 'yoru', 1); c.P(wx, 29, 'sumi', 0)
    # 매트
    y1 = box(c, 1, 5, 30, 17, 12, 'shiro', 4, 'shiro', 2)
    for x in range(12, 21, 4): c.P(x, 11, 'shiro', 3); c.P(x + 1, 12, 'shiro', 3)          # 시트 주름
    # 베개(머리 쪽, 윗면 위)
    c.R(3, 7, 7, 7, 'shiro', 4); c.HL(3, 7, 7, 'shiro', 3); c.HL(3, 13, 7, 'shiro', 2); c.VL(9, 8, 5, 'shiro', 2)
    c.HL(4, 10, 4, 'shiro', 3)
    # 발치에 접힌 하늘색 담요
    c.R(21, 7, 8, 8, 'sora', 4); c.HL(21, 7, 8, 'sora', 3); c.HL(21, 10, 8, 'sora', 3); c.HL(21, 14, 8, 'sora', 2)
    c.VL(28, 7, 8, 'sora', 2); c.HL(21, 15, 8, 'shiro', 2)
    # 옆 난간 봉(내린 상태, 매트 뒤·앞 가장자리 위)
    c.HL(5, 6, 22, 'tekko', 4)
    c.HL(5, 16, 22, 'tekko', 6); c.HL(5, 17, 22, 'tekko', 3); c.P(5, 18, 'tekko', 4); c.P(26, 18, 'tekko', 2)


# ═══════════════ 원내 약국 ═══════════════
@I.obj('hs-drug-drawers', '약품 서랍장(유리장 겸)', 'tall_furniture', w=2, h=1, up=24, kind='wall', use=('search',),
       tags=TAGS + ('약국', '薬局'), place='원내 약국 북쪽 벽 앞에 나란히',
       desc='키 큰 약품장 — 윗면, 위 칸 유리장 속 약병 줄(사선 반사), 아래 작은 흰 서랍 수십 칸 격자(이름표 띠·손잡이 점).')
def _(c):
    # 캔버스 32×48 (U=2)
    y1 = box(c, 0, 1, 32, 46, 5, 'shiro', 3, 'shiro', 2)
    # 유리장
    c.R(2, y1 + 1, 28, 14, 'garasu', 2); c.HL(2, y1 + 1, 28, 'garasu', 1)
    for sy in (y1 + 7, y1 + 14):
        c.HL(2, sy, 28, 'shiro', 3)
        for x in range(3, 29, 2):
            m = ('daidai', 'shiro', 'sora', 'ita', 'midori', 'shiro', 'daidai')[(x // 2 + sy) % 7]
            hh = 3 + (x // 2 + sy) % 2
            c.VL(x, sy - hh, hh, m, 3 if m != 'ita' else 4); c.P(x, sy - hh, m, 4 if m != 'ita' else 5)
    for k, t in ((6, 6), (9, 5), (20, 6)):
        for i in range(10):
            x = 2 + k + i; y = y1 + 14 - i
            if y > y1 and x < 30: c.P(x, y, 'garasu', t)
    c.VL(16, y1 + 1, 14, 'shiro', 3); c.HL(2, y1 + 15, 28, 'shiro', 1)
    # 서랍 격자
    for r in range(6):
        for k in range(4):
            x = 2 + k * 7; y = y1 + 17 + r * 4
            c.R(x, y, 7, 4, 'shiro', 3); c.HL(x, y, 7, 'shiro', 4); c.VL(x + 6, y, 4, 'shiro', 1); c.HL(x, y + 3, 7, 'shiro', 1)
            c.HL(x + 1, y + 1, 3, 'kinari', 4 if (r + k) % 3 else 3); c.P(x + 4, y + 2, 'tekko', 2)


@I.obj('hs-dispense-table', '조제대', 'low_furniture', w=2, h=1, up=6, use=('search',),
       tags=TAGS + ('약국', '調剤'), place='원내 약국 가운데 — 약품 서랍장 앞',
       desc='넓은 흰 조제대 — 윗면에 약포지 분포 기계(회색 상자·종이 롤), 작은 전자 저울, 알약 트레이, 갈색·흰 약병. 앞면 서랍.')
def _(c):
    # 캔버스 32×32 (U=1)
    y1 = box(c, 0, 5, 32, 26, 14, 'shiro', 3, 'shiro', 2)
    # 약포지 기계(솟은 상자)
    furn(c, 2, 2, 11, 12, 5, 'conc', tt=5, ft=3)
    c.R(4, 4, 7, 2, 'conc', 3); c.HL(4, 4, 7, 'conc', 2)
    c.R(4, 9, 5, 2, 'sora', 3); c.P(10, 9, 'midori', 3); c.P(10, 11, 'aka', 3)
    c.R(4, 14, 7, 3, 'shiro', 4); c.HL(4, 16, 7, 'shiro', 2)                               # 나온 약포지
    # 저울
    c.R(15, 8, 6, 4, 'tekko', 5); c.HL(15, 8, 6, 'tekko', 6); c.HL(15, 12, 6, 'tekko', 2); c.R(16, 13, 4, 1, 'kokuban', 3)
    # 알약 트레이
    c.R(14, 14, 8, 4, 'sora', 3); c.HL(14, 14, 8, 'sora', 2); c.HL(14, 17, 8, 'sora', 1)
    for (x, y, m) in ((15, 15, 'shiro'), (17, 16, 'kii'), (19, 15, 'pinku'), (20, 16, 'shiro')): c.P(x, y, m, 4)
    # 약병
    for (x, m, t) in ((24, 'ita', 4), (27, 'shiro', 3), (29, 'ita', 3)):
        c.R(x, 9, 2, 6, m, t); c.P(x, 9, m, t + 1); c.HL(x, 8, 2, 'shiro' if m == 'ita' else 'sora', 2); c.HL(x, 15, 2, m, t - 2)
    drawer(c, 3, y1 + 2, 12, 5, 'shiro', 2, handle=('tekko', 5))
    drawer(c, 17, y1 + 2, 12, 5, 'shiro', 2, handle=('tekko', 5))


@I.obj('hs-med-fridge', '약품 냉장고(유리문)', 'tall_furniture', w=1, h=1, up=20, kind='wall', use=('search',),
       tags=TAGS + ('약국', '冷蔵庫'), place='원내 약국 북쪽 벽 앞',
       desc='유리문 약품 냉장고 — 흰 윗면, 유리문 속 선반마다 작은 약병 줄과 사선 반사, 아래 환기 그릴, 손잡이.')
def _(c):
    # 캔버스 16×48 (U=2). 흰 윗면 10행(위에 약 상자·온도 기록판) + 유리문 앞면
    y1 = box34(c, 1, 1, 14, 46, 10, 'conc', 5, 'shiro', 2, lid=False) - 1
    c.R(3, 3, 5, 3, 'sora', 3); c.HL(3, 3, 5, 'sora', 4); c.HL(3, 6, 5, 'shiro', 2)         # 보냉 상자(뒤 왼쪽) + 판 위 그늘
    c.R(10, 5, 3, 2, 'conc', 4); c.HL(10, 7, 3, 'shiro', 2)                                 # 기록판(누워 있다)
    c.R(3, y1 + 1, 10, 28, 'garasu', 2); c.HL(3, y1 + 1, 10, 'garasu', 1)
    for sy in (y1 + 8, y1 + 15, y1 + 22, y1 + 28):
        c.HL(3, sy, 10, 'shiro', 2)
        for x in range(4, 12, 2):
            m = ('shiro', 'daidai', 'sora', 'midori')[(x + sy) % 4]
            c.VL(x, sy - 3, 3, m, 3); c.P(x, sy - 3, m, 4)
    for k, t in ((2, 6), (5, 5)):
        for i in range(13):
            x = 3 + k + i // 2; y = y1 + 27 - i * 2
            if x < 13 and y > y1: c.P(x, y, 'garasu', t); c.P(x, y + 1, 'garasu', t)
    c.VL(12, y1 + 6, 10, 'tekko', 5); c.VL(13, y1 + 6, 10, 'tekko', 2)
    c.R(3, y1 + 30, 10, 5, 'shiro', 1)
    for y in range(y1 + 31, y1 + 35, 2): c.HL(4, y, 8, 'yoru', 2)
    c.P(4, y1 + 2, 'midori', 4)


@I.obj('hs-pickup-window', '투약 창구', 'low_furniture', w=2, h=1, up=12, use=('counter',),
       tags=TAGS + ('약국', '投薬口'), place='원내 약국과 대기실 사이 — 대기실 쪽을 보게',
       desc='약을 건네는 낮은 투약 창구 — 흰 카운터 윗면, 뒤쪽에 선 투명 칸막이 판(사선 반사)과 아래 건넴 틈, 그 앞 하늘색 통 트레이, 앞면 연녹 판.')
def _(c):
    # 캔버스 32×32 (U=1). 카운터 윗면 11행(통 트레이·종이) 뒤에 선 낮은 투명 칸막이 — 칸막이 위 틀도 윗면 3행이 보인다
    # 칸막이 위 틀(두꺼운 흰 틀 윗면)
    y1 = box34(c, 0, 9, 32, 23, 13, 'conc', 5, 'lino', 3, lid=False, ov=0) - 1
    # 상판 뒤쪽에 선 투명 칸막이(좌우 4칸씩 상판이 드러난다) — 위 틀 윗면 3행
    c.HL(6, 0, 20, 'sumi', 1)
    c.HL(6, 1, 20, 'shiro', 3); c.R(6, 2, 20, 2, 'shiro', 4); c.HL(6, 4, 20, 'shiro', 1)
    acrylic(c, 7, 5, 18, 6)
    c.VL(6, 5, 6, 'shiro', 3); c.VL(25, 5, 6, 'shiro', 1); c.VL(5, 1, 10, 'sumi', 1); c.VL(26, 1, 10, 'sumi', 1)
    c.R(11, 9, 10, 2, 'yoru', 1); c.HL(11, 9, 10, 'shiro', 2)                                  # 건넴 틈
    c.HL(5, 11, 22, 'conc', 3)                                                                  # 칸막이 밑 그늘(상판 위)
    c.R(10, 14, 12, 5, 'sora', 3); c.HL(10, 14, 12, 'sora', 2); c.HL(11, 15, 10, 'sora', 1); c.HL(10, 18, 12, 'sora', 4)   # 통 트레이
    paper(c, 13, 15, 5, 3)
    c.R(3, 15, 5, 3, 'kii', 4); c.HL(3, 17, 5, 'kii', 2); c.P(4, 15, 'kii', 3)                 # 번호 종이
    c.R(25, 14, 3, 3, 'shiro', 4); c.P(26, 15, 'midori', 3); c.HL(25, 17, 3, 'shiro', 2)       # 소독제 작은 병
    lino_front(c, 1, y1, 30, 31 - y1)
    c.HL(0, 31, 32, 'sumi', 0)


# 3/4 관문 불합격 조각은 굽지 않는다(interior/gate_hold.py)
I.hold()


def build(): return R.build()


def selftest(): return R.selftest()


if __name__ == '__main__':
    sys.exit(main(I, sys.argv))
