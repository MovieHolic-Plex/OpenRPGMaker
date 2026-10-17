#!/usr/bin/env python3
"""jp_city 시설 실내 — 사무실 보강(자유석·회의·급탕실·로비). id 머리 `ox-`.

일본 사무 빌딩(オフィスビル)의 자유석(フリーアドレス)·회의실·급탕실(給湯室)·로비를 채우는 기물.
이미 있는 사무실 기물(interior_office of-: 책상 섬·의자·복합기·이동 화이트보드·캐비닛·엘리베이터·로비 소파·접수·보안 게이트·
급탕 싱크·냉장고·자판기·서버 랙)은 다시 그리지 않고 그 결(회청 카펫·흰 멜라민·검은 쇠·남색 의자)에 맞춘다.
칸 16px = 1m, 3/4 시점(윗면 + 남쪽 앞면), 빛 왼위, 외곽선 sumi, 팔레트 modern3 램프만(엔진 px.py). 글자·숫자·상표·사람 없음.

  python3 scripts/content/jp-city/blocks/interior_office2.py     # 검사 + _all-x3.png + _gate/*.png + items.jsonl
"""
import os, sys
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, '..', 'interior'))
from inst import Inst, main, furn, drawer, glass, paper, books, rnd, h32, slab34   # noqa: E402,F401

BLOCK = 'interior_office2'
I = Inst(BLOCK, '사무실 보강')
R = I.R
TAGS = ('사무실', '사무 빌딩', 'オフィス', 'office')


def box(c, x, y, w, h, t=('sumi', 1)):
    """윤곽 사각(속은 안 건드림)."""
    c.HL(x, y, w, *t); c.HL(x, y + h - 1, w, *t); c.VL(x, y, h, *t); c.VL(x + w - 1, y, h, *t)


def plate(c, x, y, w, n, mat, t):
    """위에서 본 윗면 판 n 행: 뒤 가장자리 어두운 1행 · 왼 밝게 · 오른 그늘 · 앞 모서리 반사 1행."""
    c.R(x, y, w, n, mat, t)
    c.HL(x, y, w, mat, t - 2)
    c.VL(x, y + 1, n - 2, mat, t + 1); c.VL(x + w - 1, y + 1, n - 2, mat, t - 1)
    c.HL(x, y + n - 1, w, mat, t + 1)


def cup(c, x, y, mat='shiro'):
    """머그 3×3 — 위 테 밝게, 속 커피."""
    c.R(x, y, 3, 3, mat, 3); c.HL(x, y, 3, mat, 4); c.P(x + 1, y, 'soil', 1); c.P(x + 2, y + 2, mat, 1)
    c.P(x + 3, y + 1, mat, 2)


def laptop(c, x, y, w=8):
    """남향 노트북: 서 있는 화면(윗테 두께·화면 빛) + 앞 키보드 판."""
    c.R(x, y, w, 5, 'yoru', 2); c.HL(x, y, w, 'yoru', 4)
    c.R(x + 1, y + 1, w - 2, 3, 'sora', 2); c.P(x + 1, y + 1, 'sora', 4); c.P(x + 2, y + 1, 'sora', 3); c.HL(x + 1, y + 3, w - 2, 'sora', 1)
    c.R(x, y + 5, w, 3, 'tekko', 5); c.HL(x + 1, y + 6, w - 2, 'tekko', 3); c.HL(x, y + 7, w, 'tekko', 2)
    c.P(x + w // 2, y + 7, 'tekko', 4)


# ═══════════════ 자유석·회의 ═══════════════
@I.obj('ox-phone-booth', '1인 텔레워크 부스', 'tall_furniture', w=1, h=1, up=24, kind='wall', use=('sit',),
       tags=TAGS + ('부스', '자유석', '테레워크', 'テレワークブース', '전화'), place='자유석 구역 북쪽 벽 앞 — 둘이면 나란히 붙인다',
       desc='한 사람이 들어가 화상 회의·전화를 하는 방음 부스 — 흰 멜라민 지붕판을 위에서 보고, 앞은 쇠 테 유리문(사선 반사)이라 속 남색 의자 등받이가 비친다. 아래 흰 받침.')
def _(c):
    # 캔버스 16×48 (up 24 → U=2)
    # 지붕판 윗면 8행(위에서 내려다본 흰 판) — 위에 환기 그릴 판이 얹혀 있다
    slab34(c, 0, 1, 16, 9, 'shiro', 3)                                         # 내민 흰 지붕판(위에서)
    c.R(10, 4, 3, 2, 'conc', 3); c.HL(10, 6, 3, 'shiro', 2)                    # 작은 환기 구멍(판 뒤 오른쪽, 누워 있다)
    c.R(1, 11, 14, 1, 'conc', 2)                                               # 지붕 밑 그늘
    # 몸통 옆 기둥(흰 판, 왼 밝게 오른 그늘)
    c.R(1, 12, 2, 29, 'shiro', 3); c.VL(1, 12, 29, 'shiro', 4)
    c.R(13, 12, 2, 29, 'shiro', 2); c.VL(14, 12, 29, 'shiro', 1)
    # 유리문 속(어두운 실내 + 펠트 뒷벽 + 남색 의자 등받이)
    c.R(3, 12, 10, 29, 'tairu', 1)
    c.R(3, 13, 10, 10, 'lino', 1); c.HL(3, 22, 10, 'lino', 0)
    for x in range(4, 12, 2): c.VL(x, 15, 7, 'lino', 2)
    c.HL(4, 13, 8, 'kii', 4); c.HL(5, 14, 6, 'kii', 3)                         # 천장 등
    c.R(5, 22, 6, 9, 'kon', 2); c.HL(6, 21, 4, 'kon', 3); c.HL(5, 22, 6, 'kon', 3)  # 등받이
    c.VL(5, 23, 8, 'kon', 3); c.VL(10, 23, 8, 'kon', 1)
    c.R(7, 31, 2, 4, 'yoru', 3); c.HL(5, 35, 6, 'yoru', 2)
    c.R(3, 36, 10, 4, 'tairu', 0)
    # 유리 반사(사선 두 줄)
    c.line(8, 21, 11, 15, 'garasu', 5); c.line(9, 21, 11, 17, 'garasu', 4)
    c.line(4, 39, 8, 31, 'garasu', 5); c.line(5, 39, 9, 31, 'garasu', 4)
    # 문 테·손잡이
    c.VL(3, 12, 29, 'yoru', 3); c.VL(12, 12, 29, 'yoru', 1); c.HL(3, 40, 10, 'yoru', 2)
    c.VL(11, 24, 6, 'tekko', 6); c.P(11, 30, 'tekko', 3)
    # 받침(윗 테 + 앞면 + 접지)
    c.HL(1, 41, 14, 'shiro', 4); c.R(1, 42, 14, 3, 'conc', 3); c.HL(1, 44, 14, 'conc', 1)
    c.VL(1, 42, 3, 'conc', 4)
    box(c, 0, 0, 16, 46)
    c.HL(0, 46, 16, 'sumi', 0)


@I.obj('ox-projector-screen', '천장 영사 스크린(내려옴)', 'wall_mounted', w=2, kind='hang', hrows=2, use=('read',),
       tags=TAGS + ('회의실', '스크린', 'プロジェクター'), place='회의실 북쪽 벽면 윗줄 가운데 — 아래에 회의 탁자를 남북으로 놓는다',
       desc='회의실 벽 위에서 끌어 내린 영사 스크린 — 위에 원통 케이스(윗면 밝게, 아래 그늘), 검은 테를 두른 흰 막, 아래 무게 봉과 당김 고리.')
def _(c):
    # 캔버스 32×32
    # 케이스 통: 윗면 2행 + 앞면 3행 + 아래 그늘
    c.R(1, 1, 30, 6, 'shiro', 3)
    c.HL(1, 1, 30, 'shiro', 2); c.HL(2, 2, 28, 'shiro', 4); c.HL(2, 3, 28, 'shiro', 4)
    c.HL(1, 4, 30, 'shiro', 3); c.HL(1, 5, 30, 'shiro', 2); c.HL(1, 6, 30, 'conc', 2)
    c.R(0, 2, 2, 4, 'tekko', 4); c.R(30, 2, 2, 4, 'tekko', 2)                  # 끝 마개
    box(c, 0, 0, 32, 8); c.HL(1, 7, 30, 'sumi', 2)
    # 막(검은 테 + 흰 면, 왼 밝게 오른 그늘, 아래로 살짝 늘어진 주름)
    c.R(3, 8, 26, 19, 'yoru', 2)
    c.R(4, 9, 24, 16, 'shiro', 4)
    c.VL(4, 9, 16, 'shiro', 4); c.R(24, 9, 4, 16, 'shiro', 3); c.VL(27, 9, 16, 'shiro', 2)
    c.HL(4, 9, 24, 'shiro', 3)
    for y in (13, 19): c.HL(6, y, 2, 'shiro', 3)
    c.HL(4, 25, 24, 'yoru', 2)
    # 아래 봉(윗면 밝게 + 앞 그늘) + 당김 고리
    c.HL(2, 27, 28, 'tekko', 6); c.HL(2, 28, 28, 'tekko', 4); c.HL(2, 29, 28, 'tekko', 2)
    c.VL(1, 27, 3, 'sumi', 1); c.VL(30, 27, 3, 'sumi', 1)
    c.P(15, 30, 'yoru', 2); c.P(16, 30, 'yoru', 2); c.P(15, 31, 'yoru', 1); c.P(16, 31, 'yoru', 1)


@I.obj('ox-display-stand', '회의용 대형 화면 스탠드', 'tall_furniture', w=2, h=1, up=20, use=('read',),
       tags=TAGS + ('회의실', '모니터', '화상회의'), place='회의실 탁자 한쪽 끝(보통 남쪽이나 북쪽) 가운데, 탁자 쪽을 보게',
       desc='바퀴 달린 이동 스탠드에 걸린 회의용 대형 화면 — 검은 테 윗면이 보이고 화면엔 사선 반사, 두 기둥 아래 선반에 화상 회의 기기, 넓은 받침에 바퀴 넷.')
def _(c):
    # 캔버스 32×48 (up 20 → U=2)
    # 화면 머리: 윗면 판 5행(쇠 상자 윗면, 위에 화상 회의 카메라) + 화면 앞면
    slab34(c, 0, 0, 32, 7, 'tekko', 4)
    c.R(12, 2, 8, 3, 'yoru', 2); c.HL(12, 2, 8, 'yoru', 4); c.P(15, 3, 'neonC', 2); c.P(16, 3, 'yoru', 0)
    c.R(1, 7, 30, 16, 'yoru', 1)
    c.R(3, 8, 26, 13, 'garasu', 1)
    for y in range(8, 21):
        for x in range(3, 29):
            d = (x + (20 - y)) % 23
            if d in (0, 1): c.P(x, y, 'garasu', 3)
            elif d == 3: c.P(x, y, 'garasu', 2)
    c.HL(3, 8, 26, 'garasu', 2)
    c.VL(1, 7, 16, 'yoru', 3)
    c.P(15, 22, 'neonC', 1)
    c.VL(0, 7, 17, 'sumi', 1); c.VL(31, 7, 17, 'sumi', 1); c.HL(0, 23, 32, 'sumi', 1)
    # 두 기둥
    for x0 in (11, 19):
        c.VL(x0, 24, 15, 'tekko', 5); c.VL(x0 + 1, 24, 15, 'tekko', 2)
    # 가운데 선반: 윗면 판 5행 + 앞 두께, 위에 기기
    plate(c, 6, 28, 20, 5, 'tekko', 4); c.R(6, 33, 20, 2, 'yoru', 2); box(c, 5, 27, 22, 9)
    c.R(9, 29, 6, 3, 'yoru', 3); c.HL(9, 29, 6, 'yoru', 5); c.P(13, 30, 'neonC', 2)
    c.R(18, 29, 5, 3, 'kinari', 4); c.HL(18, 31, 5, 'kinari', 2)
    # 받침: 넓은 판 윗면 5행 + 앞면 + 바퀴
    plate(c, 1, 38, 30, 5, 'tekko', 4); c.R(1, 43, 30, 2, 'tekko', 2); c.HL(1, 44, 30, 'tekko', 1)
    box(c, 0, 37, 32, 9)
    for wx in (2, 9, 21, 28):
        c.R(wx, 46, 2, 1, 'yoru', 2); c.HL(wx, 47, 2, 'sumi', 0)


@I.obj('ox-standing-table', '스탠딩 높은 탁자', 'low_furniture', w=2, h=1, up=4, surface=True, use=('read',),
       tags=TAGS + ('자유석', '회의', 'スタンディング'), place='자유석·라운지 가장자리, 둘레에 ox-bar-stool 을 둘 둔다',
       desc='서서 쓰는 높은 탁자(허리보다 높다) — 넓은 흰 멜라민 윗면에 노트와 머그, 두꺼운 앞 모서리, 검은 쇠 다리 둘과 발 받침 봉.')
def _(c):
    # 캔버스 32×32 (up 4 → U=1). 허리보다 높다 — 윗면 8행, 앞 두께 3행, 아래로 긴 다리
    y1 = furn(c, 1, 1, 30, 12, 9, 'shiro', tt=4, ft=2)
    c.HL(2, 2, 28, 'shiro', 2); c.HL(2, 3, 28, 'shiro', 4)
    for i in range(4, 28, 8): c.P(i, 6, 'shiro', 3)
    # 노트(펼침)·노트북·머그
    c.R(4, 4, 8, 4, 'kinari', 4); c.VL(8, 4, 4, 'kinari', 2); c.HL(5, 5, 2, 'conc', 4); c.HL(9, 5, 2, 'conc', 4); c.HL(4, 7, 8, 'kinari', 2)
    c.R(15, 2, 8, 3, 'yoru', 2); c.HL(15, 2, 8, 'yoru', 4); c.R(16, 3, 6, 1, 'sora', 3)
    c.R(15, 5, 8, 3, 'tekko', 5); c.HL(16, 6, 6, 'tekko', 3); c.HL(15, 7, 8, 'tekko', 2)
    cup(c, 25, 4)
    c.HL(1, y1 + 2, 30, 'shiro', 1)
    # 다리 둘(검은 쇠, 왼 밝게) + 발 받침 봉 + 받침 발
    for lx in (5, 25):
        c.R(lx, 13, 2, 15, 'yoru', 3); c.VL(lx, 13, 15, 'yoru', 4); c.VL(lx + 1, 13, 15, 'yoru', 1)
        c.R(lx - 3, 28, 8, 2, 'yoru', 3); c.HL(lx - 3, 28, 8, 'yoru', 5); c.HL(lx - 3, 30, 8, 'sumi', 0)
    c.HL(7, 23, 18, 'tekko', 6); c.HL(7, 24, 18, 'tekko', 3); c.HL(7, 25, 18, 'sumi', 2)
    c.HL(2, 13, 28, 'sumi', 0)

@I.obj('ox-bar-stool', '높은 둥근 의자(스툴)', 'seat', w=1, h=1, use=('sit',),
       tags=TAGS + ('자유석', '스툴'), place='ox-standing-table·급탕실 카운터 둘레',
       desc='높은 둥근 스툴 — 남색 천 타원 좌판을 위에서 보고(속 단추 주름), 검은 기둥 가운데에 은색 발 고리, 아래 둥근 받침.')
def _(c):
    # 캔버스 16×16 — 납작한 원판 좌석(윗면 타원 6행 + 두께) + 기둥·발 고리·받침
    c.ell(8, 5.2, 7.4, 4.6, lambda x, y, dx, dy, d: ('sumi', 1))
    c.ell(8, 5.0, 6.6, 3.8, lambda x, y, dx, dy, d: ('kon', 1) if dx > 0.3 else ('kon', 2))   # 좌판 두께(아래)
    def seat(x, y, dx, dy, d):
        if d > 0.7 and dy < 0: return ('kon', 2)            # 뒤 가장자리
        if d > 0.7: return ('kon', 4)                        # 앞 모서리 반사
        if dx < -0.25 and dy < 0.2: return ('kon', 4)
        return ('kon', 3)
    c.ell(8, 3.6, 6.6, 3.3, seat)
    c.P(8, 3, 'kon', 2); c.P(5, 2, 'murasaki', 4)
    # 기둥 + 발 고리 + 받침
    c.VL(7, 9, 4, 'tekko', 5); c.VL(8, 9, 4, 'tekko', 2)
    c.HL(4, 11, 8, 'tekko', 6); c.P(3, 11, 'sumi', 1); c.P(12, 11, 'sumi', 1); c.HL(4, 12, 8, 'tekko', 2)
    c.HL(5, 13, 6, 'yoru', 4); c.HL(4, 14, 8, 'yoru', 2); c.HL(4, 15, 8, 'sumi', 0)


@I.obj('ox-bench-desk', '자유석 긴 벤치 책상(3인)', 'low_furniture', w=3, h=1, surface=True, use=('read',),
       tags=TAGS + ('자유석', 'フリーアドレス', '책상'), place='자유석 구역 가운데 — 남북 양쪽에 의자(of-desk-chair-n/s)를 3개씩',
       desc='여럿이 마주 앉는 자유석 긴 나무 책상 — 밝은 나무 윗면 가운데로 은색 전선 덮개 줄이 지나고, 남쪽 자리에 노트북 둘과 머그, 북쪽 자리에 서류. 앞 모서리 두께와 짧은 쇠 다리.')
def _(c):
    # 캔버스 48×16
    furn(c, 0, 0, 48, 15, 11, 'yuka', tt=4, ft=2, grain='wood')
    # 전선 덮개 줄(가운데)
    c.HL(1, 4, 46, 'tekko', 6); c.HL(1, 5, 46, 'tekko', 3)
    for x in (12, 24, 36): c.P(x, 4, 'yoru', 3)
    # 북쪽 자리 서류
    c.R(29, 1, 5, 3, 'shiro', 4); c.HL(30, 2, 3, 'conc', 4)
    # 남쪽 자리 노트북 둘 + 머그
    laptop(c, 5, 2, 9)
    laptop(c, 31, 3, 9)
    cup(c, 21, 7)
    c.R(42, 7, 3, 2, 'yoru', 3); c.HL(42, 7, 3, 'yoru', 5)                    # 휴대전화
    # 다리
    for lx in (2, 45): c.P(lx, 15, 'yoru', 1)
    c.HL(1, 15, 46, 'sumi', 0)


@I.obj('ox-lounge-sofa', '라운지 소파(2인·남향)', 'seat', w=2, h=1, up=6, use=('sit',), facing='S',
       tags=TAGS + ('라운지', '자유석', '소파'), place='라운지·자유석 창가, 앞에 낮은 탁자',
       desc='라운지의 회색 천 2인 소파 — 뒤로 솟은 등받이 윗면, 두툼한 양 팔걸이, 좌판 쿠션 두 장, 등받이에 기댄 겨자색·연녹색 쿠션, 짧은 나무 다리.')
def _(c):
    # 캔버스 32×32 (up 6 → U=1). 앉는 면(위에서 본 밝은 쿠션 판)이 앞면보다 크게
    m = 'hodo'
    # 등받이: 윗면 4행 + 짧은 어두운 앞면
    plate(c, 3, 2, 26, 4, m, 5)
    c.R(3, 6, 26, 6, m, 2); c.VL(3, 6, 6, m, 3); c.VL(28, 6, 6, m, 1)
    c.VL(15, 6, 6, m, 1); c.VL(16, 6, 6, m, 3)
    # 기댄 쿠션 둘(등받이 앞)
    for (x0, mat) in ((6, 'kii'), (20, 'lino')):
        c.R(x0, 7, 6, 6, mat, 3); c.HL(x0, 7, 6, mat, 4); c.VL(x0, 8, 4, mat, 4); c.VL(x0 + 5, 7, 6, mat, 2)
        c.HL(x0, 12, 6, mat, 1); c.P(x0 + 3, 10, mat, 2)
    # 좌판 쿠션 두 장: 윗면 판 8행(앞으로 갈수록 밝게) + 앞 두께 4행
    for x0 in (4, 16):
        c.R(x0, 13, 12, 8, m, 5); c.HL(x0, 13, 12, m, 3); c.HL(x0, 14, 12, m, 4)
        c.HL(x0, 19, 12, m, 6); c.HL(x0, 20, 12, m, 6)
        c.VL(x0, 14, 6, m, 6); c.VL(x0 + 11, 14, 6, m, 4)
        c.P(x0 + 6, 16, m, 4)
        c.R(x0, 21, 12, 4, m, 2); c.HL(x0, 21, 12, m, 3); c.HL(x0, 24, 12, m, 1)
    c.VL(15, 13, 12, m, 2); c.VL(16, 13, 12, m, 3)
    # 팔걸이: 윗면 판 7행 + 앞면
    for ax in (0, 28):
        lit = ax == 0
        plate(c, ax, 7, 4, 7, m, 5 if lit else 4)
        c.R(ax, 14, 4, 12, m, 3 if lit else 2); c.HL(ax, 14, 4, m, 2)
        c.VL(ax + (0 if lit else 3), 14, 12, m, 4 if lit else 1)
    # 윤곽 + 다리
    c.HL(3, 1, 26, 'sumi', 1); c.VL(2, 2, 5, 'sumi', 1); c.VL(29, 2, 5, 'sumi', 1)
    c.HL(0, 6, 4, 'sumi', 1); c.HL(28, 6, 4, 'sumi', 1)
    c.VL(0, 7, 20, 'sumi', 1); c.VL(31, 7, 20, 'sumi', 1); c.HL(0, 26, 32, 'sumi', 1)
    c.HL(4, 25, 24, 'sumi', 1)
    for lx in (2, 28):
        c.R(lx, 27, 2, 2, 'yuka', 2); c.P(lx, 27, 'yuka', 3); c.HL(lx, 29, 2, 'sumi', 0)


@I.obj('ox-planter-box', '칸막이 화분 상자', 'container', w=2, h=1, up=8,
       tags=TAGS + ('자유석', '화분', '칸막이', '그린'), place='자유석 구역 사이·통로 가장자리에 줄지어 칸막이로',
       desc='자유석 사이를 나누는 긴 나무 화분 상자 — 위에서 상자 속 흙이 보이고 그 위로 잎 덩이가 셋 솟는다. 앞면은 가로 나무 판 결.')
def _(c):
    # 캔버스 32×32 (up 8 → U=1). 상자 윗면(테 + 속 흙) 8행이 위에서 보이고 잎은 뒤쪽에 솟는다
    c.R(1, 13, 30, 9, 'yuka', 4)
    c.HL(1, 13, 30, 'yuka', 2); c.HL(1, 14, 30, 'yuka', 5)                      # 뒤 테
    c.R(3, 15, 26, 5, 'soil', 1); c.HL(3, 15, 26, 'soil', 0)                    # 속 흙(5행)
    for x in range(4, 28, 3): c.P(x, 17 + (x % 2), 'soil', 2)
    c.VL(1, 14, 7, 'yuka', 5); c.VL(30, 14, 7, 'yuka', 3)
    c.HL(1, 20, 30, 'yuka', 4); c.HL(1, 21, 30, 'yuka', 6)                      # 앞 테 + 반사
    # 잎 덩이 셋(뒤쪽 — 흙 앞부분은 보인다)
    for (cx, cy, rx, ry) in ((8, 10, 5.5, 5), (17, 8, 5, 6), (25, 10, 4.8, 4.5)):
        c.ell(cx, cy, rx, ry, lambda x, y, dx, dy, d: ('ki', 2) if d > 0.7 else (('ki', 5) if dx < -0.1 and dy < -0.1 else ('ki', 4)))
    for (x, y) in ((6, 7), (10, 9), (15, 4), (18, 7), (14, 10), (23, 9), (26, 11), (7, 12), (20, 11)):
        c.P(x, y, 'ki', 6)
    for (x, y) in ((9, 13), (16, 12), (19, 4), (24, 13), (12, 7), (28, 10)):
        c.P(x, y, 'ki', 1)
    c.HL(4, 15, 22, 'ki', 1)                                                    # 잎 그늘이 흙 위로
    # 앞면 가로 판(짧게)
    c.R(1, 22, 30, 8, 'yuka', 2)
    c.HL(2, 25, 28, 'yuka', 1)
    c.VL(1, 22, 8, 'yuka', 3); c.VL(30, 22, 8, 'yuka', 1)
    for x in range(4, 28, 7): c.P(x, 23 + (x % 3), 'yuka', 3)
    c.HL(1, 28, 30, 'yuka', 1)
    c.VL(0, 13, 17, 'sumi', 1); c.VL(31, 13, 17, 'sumi', 1)
    c.HL(0, 30, 32, 'sumi', 0)


@I.obj('ox-shredder', '문서 파쇄기', 'box', w=1, h=1, up=8, use=('search',),
       tags=TAGS + ('파쇄기', 'シュレッダー'), place='복합기(of-copier) 옆·사무실 벽 가',
       desc='사무용 문서 파쇄기 — 검은 윗면에 종이 투입구 틈과 초록 등, 회색 통 몸통 앞에 작은 창으로 잘린 종이 조각이 보인다.')
def _(c):
    # 캔버스 16×32 (up 8 → U=1). 윗면 판 7행(투입구 틈에 종이가 꽂힘) + 회색 통 앞면
    slab34(c, 1, 6, 14, 8, 'conc', 5)
    c.HL(4, 10, 8, 'yoru', 0); c.HL(4, 11, 8, 'yoru', 2)                       # 투입구 틈
    c.R(5, 8, 5, 2, 'shiro', 4); c.HL(5, 9, 5, 'shiro', 3); c.P(9, 8, 'shiro', 3)   # 꽂힌 종이
    c.P(11, 12, 'midori', 4); c.P(4, 12, 'conc', 3)
    # 앞면
    y1 = 15
    c.R(2, y1, 12, 15, 'conc', 3); c.HL(2, y1, 12, 'conc', 2)
    c.VL(2, y1, 16, 'conc', 4); c.VL(13, y1, 16, 'conc', 1)
    c.R(5, y1 + 3, 6, 5, 'garasu', 1)
    for x in range(5, 11): c.VL(x, y1 + 5 + (x % 2), 3 - (x % 2), 'shiro', 3 if x % 2 else 4)
    c.HL(5, y1 + 3, 6, 'garasu', 3)
    c.HL(4, y1 + 11, 8, 'conc', 1); c.P(10, y1 + 12, 'conc', 5)
    c.VL(1, 15, 16, 'sumi', 1); c.VL(14, 15, 16, 'sumi', 1); c.HL(1, 31, 14, 'sumi', 0)


@I.obj('ox-desk-wagon', '책상 밑 사이드 왜건', 'box', w=1, h=1, surface=True, use=('open',),
       tags=TAGS + ('왜건', '서랍', '책상'), place='책상(of-desk·ox-bench-desk) 옆이나 밑, 의자 반대쪽',
       desc='책상 옆에 끼우는 흰 바퀴 서랍장 — 위에서 보이는 흰 윗면(필통 하나), 앞면 서랍 셋과 손잡이 줄, 밑 작은 바퀴.')
def _(c):
    # 캔버스 16×16 — 윗면 6행(필통) + 서랍 셋
    y1 = furn(c, 2, 0, 12, 15, 6, 'shiro', tt=3, ft=2)
    c.VL(3, 2, 3, 'shiro', 4); c.HL(3, 5, 10, 'shiro', 4)
    c.R(5, 2, 5, 2, 'kon', 3); c.HL(5, 2, 5, 'kon', 4); c.P(10, 3, 'aka', 3)
    for k, yy in enumerate((y1, y1 + 3, y1 + 6)):
        hh = 3 if k < 2 else 2
        c.R(3, yy, 10, hh, 'shiro', 2); c.HL(3, yy + hh - 1, 10, 'shiro', 1)
        c.HL(6, yy + (1 if hh == 3 else 0), 4, 'tekko', 4)
    c.VL(12, y1, 8, 'shiro', 1)
    c.P(3, 15, 'yoru', 1); c.P(12, 15, 'yoru', 1)


@I.obj('ox-whiteboard-wall', '벽 붙박이 화이트보드', 'wall_mounted', w=3, kind='hang', hrows=2, use=('read',),
       tags=TAGS + ('회의실', '화이트보드', '자유석'), place='회의실·자유석 북쪽 벽면 윗줄',
       desc='벽에 붙인 넓은 화이트보드 — 은색 알루미늄 테, 색 접착 메모가 덩이로 붙고 마커 선·화살 낙서(글자 없음), 아래 두께 있는 펜 받침에 마커 셋.')
def _(c):
    # 캔버스 48×32
    c.R(1, 1, 46, 25, 'tekko', 5); c.HL(1, 1, 46, 'tekko', 6); c.VL(1, 1, 25, 'tekko', 6); c.VL(46, 1, 25, 'tekko', 3)
    c.R(3, 3, 42, 21, 'shiro', 4)
    c.R(40, 3, 5, 21, 'shiro', 3); c.HL(3, 3, 42, 'shiro', 3)
    for k in range(4): c.P(36 + k, 6 + k, 'shiro', 3)                       # 반사
    box(c, 0, 0, 48, 27)
    c.HL(1, 24, 46, 'tekko', 2); c.HL(3, 23, 42, 'shiro', 2)                  # 판 아래 가장자리 그늘(두께)
    # 메모 덩이(왼쪽) — 3×3 네모
    notes = ((5, 6, 'kii'), (9, 6, 'kii'), (13, 6, 'pinku'), (5, 10, 'sora'), (9, 10, 'kii'), (13, 11, 'midori'), (6, 14, 'pinku'), (10, 15, 'kii'))
    for (x, y, m) in notes:
        c.R(x, y, 3, 3, m, 3); c.HL(x, y, 3, m, 4); c.P(x + 2, y + 2, m, 2)
    # 마커 선(가로 줄·화살·동그라미)
    for i, y in enumerate((6, 8, 10)):
        c.HL(19, y, 9 - i * 2, 'kon', 2)
        c.P(28 - i * 2, y + 1, 'kon', 2)
    c.line(19, 14, 28, 18, 'aka', 2); c.P(27, 17, 'aka', 2); c.P(28, 17, 'aka', 2); c.P(27, 18, 'aka', 2)
    c.ell(35, 15, 4.5, 3, lambda x, y, dx, dy, d: ('midori', 1) if d > 0.6 else None)
    for i, y in enumerate((20, 22)): c.HL(6, y, 14 - i * 4, 'kon', 2)
    c.HL(31, 7, 9, 'sora', 2); c.HL(31, 9, 6, 'sora', 2)
    # 펜 받침: 윗면 2행 + 앞면 + 아래 그늘
    c.HL(4, 27, 40, 'tekko', 6); c.HL(4, 28, 40, 'tekko', 5)
    c.R(14, 27, 4, 1, 'aka', 3); c.R(19, 27, 4, 1, 'kon', 3); c.R(24, 28, 4, 1, 'kokuban', 2)
    c.HL(4, 29, 40, 'tekko', 3); c.HL(4, 30, 40, 'tekko', 1)
    c.VL(3, 27, 4, 'sumi', 1); c.VL(44, 27, 4, 'sumi', 1); c.HL(4, 31, 40, 'sumi', 1)


# ═══════════════ 급탕실·로비 ═══════════════
@I.obj('ox-coffee-counter', '급탕실 커피 카운터', 'low_furniture', w=2, h=1, up=12, kind='wall', surface=True, use=('search',),
       tags=TAGS + ('급탕실', '給湯室', '커피', '휴게'), place='급탕실 북쪽 벽 앞 — 급탕 싱크 옆, 위 벽면에 ox-water-boiler',
       desc='급탕실 커피 카운터 — 밝은 나무 윗면에 검은 커피 머신(초록 등), 엎어 쌓은 흰 컵 두 줄, 은색 포트와 설탕 통. 앞은 흰 수납문 둘과 은색 손잡이.')
def _(c):
    # 캔버스 32×32 (up 12 → U=1). 카운터 윗면 10행 — 기물은 뒤쪽에, 앞 6행은 비워 윗면이 판으로 보이게
    y1 = furn(c, 0, 12, 32, 19, 10, 'yuka', tt=4, ft=2, grain='wood')
    c.VL(1, 13, 8, 'yuka', 5); c.HL(1, 21, 30, 'yuka', 5)
    # 커피 머신(윗면 판 4행 + 앞면), 바닥 = 15행
    plate(c, 2, 1, 10, 5, 'yoru', 4)
    c.R(2, 6, 10, 9, 'yoru', 2); c.VL(2, 6, 9, 'yoru', 3); c.VL(11, 6, 9, 'yoru', 1)
    c.R(4, 7, 3, 2, 'neonC', 0); c.P(9, 7, 'midori', 4)
    c.R(4, 10, 6, 4, 'yoru', 0); c.R(6, 12, 2, 2, 'shiro', 3); c.HL(4, 14, 6, 'tekko', 4)
    box(c, 1, 0, 12, 16)
    # 엎어 쌓은 컵(두 줄)
    for cx in (14, 18):
        for k in range(2):
            y = 9 + k * 3
            c.R(cx, y, 3, 3, 'shiro', 3); c.HL(cx, y, 3, 'shiro', 4); c.P(cx + 2, y + 1, 'shiro', 2)
        c.HL(cx, 15, 3, 'yuka', 1)
    # 포트(윗면 뚜껑 타원 + 몸통)
    c.R(22, 9, 7, 6, 'tekko', 4); c.VL(22, 9, 6, 'tekko', 6); c.VL(27, 9, 6, 'tekko', 2); c.VL(28, 9, 6, 'tekko', 1)
    c.ell(25, 8.5, 3.6, 2.2, lambda x, y, dx, dy, d: ('tekko', 3) if d > 0.6 and dy < 0 else ('tekko', 6))
    c.P(25, 8, 'yoru', 1); c.P(29, 10, 'yoru', 1); c.P(29, 11, 'yoru', 1); c.P(21, 10, 'tekko', 3)
    c.HL(22, 15, 7, 'yuka', 1)
    # 앞쪽 윗면: 머그 하나·설탕 통·스푼
    cup(c, 5, 17); c.HL(5, 20, 4, 'yuka', 1)
    c.R(14, 17, 3, 2, 'kinari', 4); c.HL(14, 18, 3, 'kinari', 2)
    c.HL(19, 18, 4, 'tekko', 5)
    # 앞 수납문 둘
    for dx in (2, 17):
        c.R(dx, y1 + 1, 13, 7, 'shiro', 3); c.HL(dx, y1 + 1, 13, 'shiro', 4); c.HL(dx, y1 + 7, 13, 'shiro', 1)
        c.VL(dx + 12, y1 + 1, 7, 'shiro', 2)
    c.VL(13, y1 + 2, 4, 'tekko', 5); c.VL(18, y1 + 2, 4, 'tekko', 5)
    c.HL(0, 31, 32, 'sumi', 0)


@I.obj('ox-water-boiler', '벽 전기 온수기(給湯器)', 'wall_mounted', w=1, kind='hang', hrows=2, use=('search',),
       tags=TAGS + ('급탕실', '給湯室', '온수'), place='급탕실 싱크·커피 카운터 위 벽면 윗줄',
       desc='급탕실 벽에 단 흰 전기 온수기 — 상자 위 테 밝게, 아래 면 그늘, 앞에 작은 수위 창과 빨강·초록 등, 아래로 은색 꼭지와 레버.')
def _(c):
    # 캔버스 16×32 — 벽에서 튀어나온 상자: 윗면 판 4행 + 앞면 + 아래 그늘
    plate(c, 2, 2, 12, 5, 'shiro', 3)
    c.R(9, 3, 3, 2, 'tekko', 5); c.HL(9, 4, 3, 'tekko', 3)                     # 물 넣는 뚜껑(윗면 위)
    c.R(2, 7, 12, 14, 'shiro', 2)
    c.VL(2, 7, 14, 'shiro', 3); c.VL(13, 7, 14, 'shiro', 1)
    c.HL(2, 20, 12, 'shiro', 1); c.HL(2, 21, 12, 'conc', 2)
    box(c, 1, 1, 14, 22)
    c.R(4, 9, 3, 7, 'garasu', 2); c.VL(4, 12, 4, 'garasu', 4); c.HL(4, 9, 3, 'garasu', 1)
    c.P(9, 9, 'aka', 3); c.P(9, 11, 'midori', 4)
    c.R(8, 14, 4, 3, 'conc', 4); c.HL(8, 14, 4, 'conc', 5); c.HL(8, 16, 4, 'conc', 2)
    # 꼭지·레버
    c.R(6, 23, 4, 2, 'tekko', 5); c.HL(6, 23, 4, 'tekko', 6); c.VL(7, 25, 3, 'tekko', 4); c.VL(8, 25, 3, 'tekko', 2)
    c.P(7, 28, 'tekko', 3)
    c.HL(10, 23, 3, 'kon', 3); c.P(12, 22, 'kon', 3)
    c.HL(6, 25, 4, 'sumi', 2)


@I.obj('ox-security-desk', '경비 데스크', 'low_furniture', w=2, h=1, up=8, use=('counter',),
       tags=TAGS + ('로비', '경비', '警備', '접수'), place='로비 입구 안쪽 옆 — 경비원은 북쪽에 앉아 남쪽(입구)을 본다',
       desc='로비 경비 데스크 — 연회색 돌 윗면 북쪽 가장자리에 감시 모니터 둘의 검은 뒤판, 무전기(안테나)와 출입 기록 판, 앞판은 짙은 나무 세로 결과 걸레받이.')
def _(c):
    # 캔버스 32×32 (up 8 → U=1). 돌 윗면 판 11행(뒤에 모니터 뒤판) + 짙은 나무 앞판
    y1 = furn(c, 0, 9, 32, 22, 11, 'conc', tt=5, ft=3)
    c.VL(1, 10, 9, 'conc', 6); c.HL(1, 18, 30, 'conc', 6)
    for x in range(3, 30, 5): c.P(x, 15 + (x % 3), 'conc', 4)
    # 모니터 뒤판 둘(뒤쪽 가장자리, 윗면 2행 보이게)
    for mx in (3, 14):
        c.R(mx, 2, 9, 9, 'yoru', 2); c.HL(mx, 2, 9, 'yoru', 4); c.HL(mx, 3, 9, 'yoru', 3)
        c.VL(mx + 8, 3, 8, 'yoru', 1); box(c, mx - 1, 1, 11, 11)
        c.R(mx + 3, 11, 3, 2, 'yoru', 1); c.HL(mx + 2, 12, 5, 'yoru', 3)
    # 키보드(모니터 앞)
    c.R(5, 14, 10, 2, 'yoru', 3); c.HL(5, 14, 10, 'yoru', 4)
    # 무전기 + 안테나
    c.R(25, 10, 3, 6, 'yoru', 2); c.HL(25, 10, 3, 'yoru', 4); c.VL(26, 5, 5, 'yoru', 3); c.P(26, 4, 'aka', 3)
    c.P(27, 12, 'midori', 3)
    # 출입 기록 판(클립보드)
    c.R(17, 13, 6, 5, 'yuka', 3); c.R(18, 14, 4, 3, 'shiro', 4); c.HL(19, 13, 2, 'tekko', 5)
    # 앞판 짙은 나무
    c.R(1, y1, 30, 10, 'ita', 2); c.HL(1, y1, 30, 'ita', 3); c.VL(1, y1, 10, 'ita', 3); c.VL(30, y1, 10, 'ita', 1)
    for x in range(5, 30, 5): c.VL(x, y1 + 1, 8, 'ita', 1)
    c.HL(1, y1 + 9, 30, 'yoru', 1)
    box(c, 0, 9, 32, 22); c.HL(0, 31, 32, 'sumi', 0)


@I.obj('ox-trash-column', '로비 원통 쓰레기통', 'round_body', w=1, h=1, up=8,
       tags=TAGS + ('로비', '쓰레기통', '분리수거'), place='로비·엘리베이터 홀 구석, 기둥 곁',
       desc='로비의 스테인리스 원통 쓰레기통 — 위에서 보이는 둥근 쇠 뚜껑(가운데 둥근 투입구), 왼쪽이 밝고 오른쪽이 그늘진 몸통에 세로 결, 아래 검은 띠.')
def _(c):
    # 캔버스 16×32 (up 8 → U=1). 둥근 뚜껑 윗면(타원 8행) + 원통 몸통
    for y in range(12, 29):
        for x in range(2, 14):
            t = 3
            if x <= 4: t = 5
            elif x <= 6: t = 4
            elif x >= 12: t = 1
            elif x >= 10: t = 2
            c.P(x, y, 'tekko', t)
    for x in (5, 8): c.VL(x, 15, 11, 'tekko', 6 if x == 5 else 3)
    c.HL(2, 26, 12, 'yoru', 2); c.HL(2, 27, 12, 'yoru', 1); c.HL(2, 28, 12, 'yoru', 0)
    c.ell(8, 9.5, 7.2, 5.0, lambda x, y, dx, dy, d: ('sumi', 1))
    c.ell(8, 10.5, 6.4, 4.0, lambda x, y, dx, dy, d: ('tekko', 2))              # 뚜껑 앞 두께
    def lid(x, y, dx, dy, d):
        if d > 0.72 and dy < 0: return ('tekko', 3)
        if d > 0.72: return ('tekko', 6)
        return ('tekko', 6) if dx < -0.3 else ('tekko', 5)
    c.ell(8, 9.2, 6.4, 4.2, lid)
    c.ell(8, 8.8, 2.6, 1.3, lambda x, y, dx, dy, d: ('yoru', 0) if dy < 0.3 else ('yoru', 2))   # 투입구
    c.P(4, 8, 'shiro', 4)
    c.VL(1, 11, 18, 'sumi', 1); c.VL(14, 11, 18, 'sumi', 1)
    c.HL(2, 29, 12, 'sumi', 1); c.HL(3, 30, 10, 'sumi', 0)


@I.obj('ox-umbrella-bagger', '우산 비닐 씌우는 받침(傘袋スタンド)', 'column', w=1, h=1, up=12, use=('search',),
       tags=TAGS + ('로비', '입구', '우산', '傘袋'), place='빌딩 자동문 안쪽 바로 옆(비 오는 날)',
       desc='입구의 우산 비닐 받침 — 은색 기둥 몸통 윗면에 우산을 꽂는 둥근 투입구 둘이 보이고, 앞으로 투명 비닐 봉투 묶음이 늘어져 흔들린다. 아래 넓은 받침.')
def _(c):
    # 캔버스 16×32 (up 12 → U=1). 밝은 윗면 판 8행(우산 꽂는 구멍 둘) + 어두운 앞 몸통에 늘어진 봉투
    slab34(c, 0, 2, 16, 9, 'tekko', 5)
    for ox in (4, 9):
        c.R(ox, 5, 3, 3, 'yoru', 0); c.HL(ox, 7, 3, 'yoru', 2); c.HL(ox, 4, 3, 'tekko', 3); c.P(ox + 2, 6, 'yoru', 1)
    c.VL(10, 2, 3, 'kon', 3); c.P(10, 1, 'kon', 4)                              # 꽂힌 우산 손잡이
    c.R(2, 12, 12, 13, 'tekko', 2); c.VL(2, 11, 14, 'tekko', 4); c.VL(13, 11, 14, 'tekko', 1); c.HL(2, 11, 12, 'tekko', 1)
    for (bx, ln) in ((3, 11), (7, 9), (10, 12)):
        for j in range(ln):
            w = 3 if j < ln - 3 else (2 if j < ln - 1 else 1)
            for i in range(w):
                c.P(bx + i + (1 if w < 3 and j >= ln - 1 else 0), 12 + j, 'garasu', 6 if i == 0 else (5 if i == 1 else 4))
        c.P(bx + 2, 12 + ln - 3, 'garasu', 3)
    c.P(4, 15, 'shiro', 4); c.P(8, 14, 'shiro', 4); c.P(11, 16, 'shiro', 4)
    c.VL(1, 11, 15, 'sumi', 1); c.VL(14, 11, 15, 'sumi', 1)
    plate(c, 1, 25, 14, 3, 'tekko', 4); c.HL(1, 28, 14, 'tekko', 2)
    c.VL(0, 25, 4, 'sumi', 1); c.VL(15, 25, 4, 'sumi', 1); c.HL(1, 29, 14, 'sumi', 0)


@I.obj('ox-floor-guide', '층 안내 받침 판', 'column', w=1, h=1, up=20, use=('read',),
       tags=TAGS + ('로비', '안내', 'フロアガイド'), place='로비 입구에서 엘리베이터 홀로 가는 길목',
       desc='로비에 세운 층 안내 받침 — 기울어진 판 윗면에 층 평면 지도(색 칸·흰 통로, 글자 없음)가 보이고, 은색 기둥과 둥근 받침이 판을 받친다.')
def _(c):
    # 캔버스 16×48 (up 20 → U=2). 비스듬히 누운 안내판 = 위에서 보이는 사다리꼴 판(뒤 좁고 앞 넓다) + 앞 두께
    # 위에서 본 판(윗면 12행, 검은 테 안 흰 평면도) + 앞 두께 3행
    slab34(c, 0, 4, 16, 13, 'yoru', 3, edge=('yoru', 5), under=('yoru', 1))
    c.R(2, 6, 12, 9, 'shiro', 4); c.HL(2, 6, 12, 'shiro', 3)
    rooms = ((3, 7, 3, 3, 'sora'), (7, 7, 2, 3, 'kii'), (10, 7, 3, 3, 'midori'), (3, 11, 4, 3, 'pinku'), (9, 11, 4, 3, 'lino'))
    for (x, y, w, h, m) in rooms:
        c.R(x, y, w, h, m, 3); c.HL(x, y, w, m, 4)
    c.P(8, 12, 'aka', 3)
    c.R(1, 18, 14, 2, 'yoru', 2); c.VL(0, 17, 4, 'sumi', 1); c.VL(15, 17, 4, 'sumi', 1); c.HL(1, 20, 14, 'sumi', 1)
    # 기둥
    c.R(7, 21, 2, 19, 'tekko', 4); c.VL(7, 21, 19, 'tekko', 6); c.VL(8, 21, 19, 'tekko', 2)
    # 둥근 받침(윗면 타원)
    c.ell(8, 42.5, 6.4, 3.2, lambda x, y, dx, dy, d: ('sumi', 1))
    c.ell(8, 42.3, 5.6, 2.6, lambda x, y, dx, dy, d: ('tekko', 3) if dy > 0.4 else (('tekko', 6) if dx < 0 else ('tekko', 5)))
    c.R(7, 40, 2, 2, 'tekko', 4); c.HL(4, 45, 8, 'sumi', 0)


@I.obj('ox-visitor-kiosk', '방문자 접수 태블릿 받침', 'column', w=1, h=1, up=16, use=('read', 'counter'),
       tags=TAGS + ('로비', '접수', '무인 접수', '受付'), place='로비 접수 카운터 대신·옆, 입구에서 보이는 곳',
       desc='무인 방문자 접수용 태블릿 받침 — 가는 흰 기둥 위 기울어진 태블릿 윗면이 보이고 화면은 하늘빛(단추 칸 둘), 둥근 흰 받침.')
def _(c):
    # 캔버스 16×32 (up 16 → U=1). 비스듬히 누운 태블릿 = 위에서 보이는 사다리꼴 판 + 앞 두께
    # 위에서 본 태블릿 판(윗면 9행: 검은 테 + 하늘빛 화면) + 앞 두께
    slab34(c, 0, 1, 16, 10, 'yoru', 2, edge=('yoru', 5), under=('yoru', 1))
    c.R(2, 3, 12, 6, 'sora', 3); c.HL(2, 3, 12, 'sora', 4); c.P(3, 4, 'shiro', 4)
    c.R(3, 6, 4, 2, 'shiro', 4); c.R(9, 6, 4, 2, 'midori', 4)
    c.VL(0, 11, 2, 'sumi', 1); c.VL(15, 11, 2, 'sumi', 1); c.HL(1, 12, 14, 'sumi', 1)
    # 기둥 + 받침
    c.R(7, 13, 2, 11, 'shiro', 3); c.VL(7, 13, 11, 'shiro', 4); c.VL(8, 13, 11, 'shiro', 2)
    c.ell(8, 26.5, 6.2, 3.2, lambda x, y, dx, dy, d: ('sumi', 1))
    c.ell(8, 26.3, 5.4, 2.6, lambda x, y, dx, dy, d: ('shiro', 2) if dy > 0.4 else (('shiro', 4) if dx < 0 else ('shiro', 3)))
    c.R(7, 23, 2, 2, 'shiro', 3); c.HL(4, 29, 8, 'sumi', 0)


# 3/4 관문 불합격 조각은 굽지 않는다(interior/gate_hold.py)
I.hold()


def build(): return R.build()


def selftest(): return R.selftest()


if __name__ == '__main__':
    sys.exit(main(I, sys.argv))
