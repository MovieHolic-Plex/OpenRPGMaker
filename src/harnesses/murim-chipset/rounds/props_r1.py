"""기물 판 props-r1 — 묶음 props 28항목(소품 25 + 대형 3) × 줄 A 하나씩(A1), 재질이 줄 B 와 다른 항목만 B1.

사용자 2026-10-08: 「던전, 무림 들에 어울리는 기물들을 충분히 만들어라. 최소 50개정도. 대형 오브젝트로 5개까지」 — 무림 몫 28(대형 3).

그림은 전부 행 문자열이다. 글자 하나 = 화소 하나. `Rows`/`R` 는 손으로 정한 열·행 자리에 글자열을 놓는 보조일 뿐
도형 마스크·노이즈로 본체를 만들지 않는다(둥근 판·바퀴는 손으로 쓴 행을 그대로 찍는다).

외곽선 규칙(seed outlineRule, 2026-10-08 확정) — 처음부터 지킨다:
  - 먹(ink·밝기 ≤0.09 = mu·wa·zhuz·zhu 0단) 윤곽 없음. 범례에 ink 도, 그 0단도 없다.
  - 빛 받는 위·왼 가장자리 = 그 재질 밝은 단, 그늘 아래·오른 = 어두운 단.
  - 바닥에 묻히는 작은 기물(1~2칸)은 그늘 쪽을 재질 가장 어두운 단 + 진한 접지 그림자(~).

범례(모든 항목 공통): 숫자 0~6 = 그 항목의 주 재료 램프(항목마다 정한다), 글자 = 다른 램프의 단.
  mu   a b c d e f   (1~6, 0단은 먹이라 없음)        zhu  r s t u v w   (1~6)
  bai  g h i j k l m (0~6)                          song n o p q x y z (0~6)
  shi  A B C D E F G (0~6)                          wa   H I J K L M   (1~6)
  huang N O P Q R S T (0~6)                         jin  U V W X Y Z   (1~6)
  zhuz ( ) [ ] { }   (1~6, 대나무 — 주 재료일 때는 숫자)

meta: 'top' = 윗면 행 범위(관문 F), 세트(돌사자)는 meta['pieces'][조각]['top'].
"""
from tk import Cv, T, grid, stamp

ROUND = 'props-r1'
WAVE = 'props'
SHEET_ZOOM = 4

BASE = {}
for chars, ramp in (('_abcdef', 'mu'), ('_rstuvw', 'zhu'), ('ghijklm', 'bai'), ('nopqxyz', 'song'), ('ABCDEFG', 'shi'),
                    ('_HIJKLM', 'wa'), ('NOPQRST', 'huang'), ('_UVWXYZ', 'jin'), ('_()[]{}', 'zhuz')):
    for i, ch in enumerate(chars):
        if ch != '_':
            BASE[ch] = (ramp, i)


def leg(main):
    """숫자 = 주 재료. 0단이 먹인 램프(mu·wa·zhu·zhuz)는 0 을 빼서 실수로 먹을 찍지 못하게 한다."""
    d = dict(BASE)
    lo = 1 if main in ('mu', 'wa', 'zhu', 'zhuz') else 0
    d.update({str(i): (main, i) for i in range(lo, 7)})
    return d


class Rows:
    """w×h 투명('.') 행. put(x, y, 글자열) 로 손으로 정한 자리에 찍고, done() 이 행 목록을 낸다. '.'·' ' 는 건너뛴다."""

    def __init__(s, w, h):
        s.w, s.h = w, h
        s.r = [['.'] * w for _ in range(h)]

    def put(s, x, y, txt):
        for i, ch in enumerate(txt):     # '.'·' ' 는 건너뛴다(밑그림을 지우지 않는다). 지울 때는 r 을 직접 쓴다
            if ch not in ' .' and 0 <= x + i < s.w and 0 <= y < s.h:
                s.r[y][x + i] = ch
        return s

    def block(s, x, y, lines):
        for j, ln in enumerate(lines):
            s.put(x, y + j, ln)
        return s

    def shadow(s, pts):
        """그림자 '~' 는 빈 자리에만."""
        for x, y in pts:
            if 0 <= x < s.w and 0 <= y < s.h and s.r[y][x] == '.':
                s.r[y][x] = '~'
        return s

    def done(s):
        return [''.join(r) for r in s.r]


def draw(rows, legend, w, h, top, note, **meta):
    cv = grid(rows, legend, w, h)
    m = {'top': top, 'note': note}
    m.update(meta)
    return cv, m


def sh_run(y, x0, x1):
    return [(x, y) for x in range(x0, x1 + 1)]


# =============================================================================
# 1. 무기 걸이 (2×2) — A1 소나무 틀에 창 둘·관도·검 / B1 짙은 나무 벽걸이 틀(가로 걸이)
# =============================================================================
def weapon_rack_a1():
    g = Rows(32, 32)
    # 윗 들보(기둥 위에 얹힘): 윗면 5~6행, 앞 7, 밑 8
    g.put(1, 5, '5' + '6' * 27 + '65')
    g.put(1, 6, '5' + '5' * 27 + '54')
    g.put(1, 7, '4' + '4' * 27 + '43')
    g.put(1, 8, '2' * 30)
    # 기둥 둘
    for y in range(9, 28):
        g.put(3, y, '542')
        g.put(26, y, '542')
    # 창 1 (x 8~9): 날 0~3, 술 4~6, 자루 7~25
    g.block(8, 0, ['G.', 'GE', 'FD', 'EC'])
    g.block(7, 4, ['wvut', 'vuts', '.ts.'])
    # 창 2 (x 13~14): 두 행 낮게
    g.block(13, 2, ['G.', 'GE', 'FD', 'EC'])
    g.block(12, 6, ['wvut', 'vuts', '.ts.'])
    # 관도 (x 19~20 자루, 날은 왼쪽으로 넓게)
    g.block(17, 0, ['...G.', '..GF.', '.GFE.', 'GFEE.', 'FEED.', 'EEDC.', '.DDC.', '..DC.', '.YXWV'])
    # 검 (x 23~24, 자루가 위)
    g.block(23, 10, ['Y.', 'dc', 'cb', ])
    g.put(22, 13, 'ZYXW')
    for y in range(7, 26):
        g.put(8, y, 'db')
        if y >= 9:
            g.put(13, y, 'db')
            g.put(19, y, 'db')
        if y >= 14:
            g.put(23, y, 'FD')
    g.put(23, 25, 'ED')
    # 아래 받침 가로대(병기가 구멍에 꽂힌다): 윗면 17, 앞 18, 밑 19
    g.put(6, 17, '5' * 20)
    g.put(6, 18, '3' * 20)
    g.put(6, 19, '2' * 20)
    for x in (8, 13, 19, 23):     # 구멍 자리 — 자루가 가로대 앞을 지난다
        g.put(x, 17, '21')
    # 받침 틀: 윗면 26~27, 앞 28~29, 발 30~31
    g.put(1, 26, '5' + '6' * 28 + '5')
    g.put(1, 27, '5' * 29 + '4')
    g.put(1, 28, '3' * 29 + '2')
    g.put(1, 29, '2' * 29 + '1')
    g.put(1, 30, '43221')
    g.put(1, 31, '32110')
    g.put(26, 30, '43221')
    g.put(26, 31, '32110')
    g.shadow(sh_run(30, 6, 25) + sh_run(31, 6, 25) + [(31, 29), (31, 30), (31, 31), (30, 31)])
    return draw(g.done(), leg('song'), 32, 32, (5, 7),
                '줄 A · 밝은 소나무 틀(윗 들보·받침 틀 윗면)에 창 둘(붉은 술)·관도·검. 쇠는 청석 밝은 단, 자루는 짙은 나무 — 먹 윤곽 없음.')


def weapon_rack_b1():
    g = Rows(32, 32)
    # 짙은 나무 세움 틀: 위 갓(지붕처럼 끝이 들림)·세로 기둥 둘·가로 걸이 막대 셋에 병기를 눕혀 건다
    g.put(0, 3, 'e' + '.' * 30 + 'e')
    g.put(0, 4, 'ef' + 'f' * 28 + 'fd')
    g.put(1, 5, 'e' + 'f' * 28 + 'd')
    g.put(1, 6, 'd' * 29 + 'c')
    g.put(2, 7, 'b' * 28)
    for y in range(8, 30):
        g.put(3, y, 'edb')
        g.put(26, y, 'edb')
    # 뒤판(황토 회벽 판) — 걸이 사이를 막는 판, 그늘
    for y in range(8, 27):
        g.put(6, y, 'Q' + 'P' * 19 + 'O')
    for y in (8, 9):
        g.put(6, y, 'O' * 21)
    # 가로 걸이 막대 셋(윗면 밝은 줄 + 앞 어두운 줄)
    for y in (11, 17, 23):
        g.put(5, y, 'e' * 22)
        g.put(5, y + 1, 'c' * 22)
    # 눕힌 병기: 위 = 창(오른쪽으로 날), 가운데 = 도(휜 날), 아래 = 검 둘
    g.put(6, 10, 'tvu' + 'd' * 12 + 'c' * 3 + 'DEFG')        # 창: 술(왼) 자루 날(오른)
    g.put(17, 9, 'EFG')
    g.put(8, 16, 'ba' + 'YXW' + 'FFFFFFFFFFE')                 # 도: 자루·코등이·날
    g.put(13, 15, 'GGGGGGGFE')
    g.put(7, 22, 'ba' + 'YX' + 'GFFFFFFFE')                    # 검 1
    g.put(16, 22, '.')
    g.put(17, 21, 'ba' + 'YX' + 'GFFFE')                        # 검 2(짧은 단검)
    # 받침(굽): 윗면 27, 앞 28~29, 발 30~31
    g.put(1, 27, 'f' * 30)
    g.put(1, 28, 'd' * 29 + 'c')
    g.put(1, 29, 'c' * 29 + 'b')
    g.put(1, 30, 'dcba')
    g.put(1, 31, 'cbaa')
    g.put(27, 30, 'dcba')
    g.put(27, 31, 'cbaa')
    g.shadow(sh_run(30, 5, 26) + sh_run(31, 5, 26) + [(31, 30), (31, 31)])
    return draw(g.done(), leg('mu'), 32, 32, (4, 6),
                '줄 B · 짙은 나무 세움 틀(끝 들린 갓)·황토 뒤판에 가로 걸이 셋 — 창·도·검을 눕혀 건다. 줄 A 와 구조가 다르다(세운 걸이 ↔ 눕힌 걸이).')


# =============================================================================
# 2. 과녁 (1×2) — 짚 과녁판 + 세 발 받침
# =============================================================================
TARGET_FACE = [          # 13×12, x 1~13 · 1~12행. S·R 짚 테(빛), O 그늘 테 / l k j 흰 고리 / v u t 붉은 고리
    "....SSSSQ....",
    "..SSllllkPO..",
    ".SlllvvukkjO.",
    ".SlvvvluutjO.",
    "SllvllkkktkjO",
    "SlvvlvutkutjO",
    "RkvukuttjttjO",
    "RkkukkkjjtjjO",
    ".RkuuujtttjO.",
    ".QkkktttjjjO.",
    "..QQjjjjjOO..",
    "....OOOOO....",
]


def archery_target_a1():
    g = Rows(16, 32)
    # 세 발: 앞 둘은 벌어지고 뒤 하나는 짧고 어둡다(행마다 손으로 정한 x)
    lx = [4, 4, 4, 4, 3, 3, 3, 3, 3, 2, 2, 2, 2, 2, 1, 1, 1, 1, 1]
    rx = [10, 10, 10, 10, 11, 11, 11, 11, 11, 12, 12, 12, 12, 12, 13, 13, 13, 13, 13]
    for i, y in enumerate(range(13, 32)):
        if y <= 28:
            g.put(7, y, '2')
        g.put(lx[i], y, '51')
        g.put(rx[i], y, '41')
    g.put(7, 29, '1')
    g.put(3, 21, '5555555555')     # 앞 가로대
    g.put(3, 22, '2222222222')
    g.put(1, 31, '00')
    g.put(13, 31, '00')
    g.block(1, 1, TARGET_FACE)
    g.shadow([(14, 29), (15, 29), (14, 30), (15, 30), (15, 31)] + sh_run(31, 3, 12))
    return draw(g.done(), leg('song'), 16, 32, (1, 4),
                '줄 A · 짚 테를 두른 흰·붉은 과녁판(가운데 한 점)을 소나무 세 발에 세웠다. 그늘 쪽 테·다리는 재질 어두운 단.')


# =============================================================================
# 3. 모래주머니 틀 (2×2)
# =============================================================================
def sandbag_frame_a1():
    g = Rows(32, 32)
    g.put(0, 3, '5' + '6' * 30 + '4')       # 들보 윗면(끝이 기둥 밖으로 나온다)
    g.put(0, 4, '5' + '5' * 30 + '3')
    g.put(0, 5, '3' * 31 + '2')
    g.put(0, 6, '.' + '1' * 30 + '.')
    for y in range(7, 28):
        g.put(3, y, '542')
        g.put(26, y, '542')
    # 끈(황토) — 들보에서 주머니 목까지
    for y in range(7, 10):
        g.put(11, y, 'P')
        g.put(21, y, 'P')
    for y in range(10, 12):
        g.put(21, y, 'P')
    # 길쭉한 주머니(흰 무명): 목 10, 몸 11~25
    g.put(10, 10, 'RQP')
    g.put(9, 11, 'kllkji')
    for y in range(12, 24):
        g.put(8, y, 'klmlkjih')
    g.put(8, 15, 'QRRQQPPO')    # 묶은 끈 띠
    g.put(8, 20, 'QRRQQPPO')
    g.put(8, 24, 'jkkjjihg')
    g.put(9, 25, 'hhhhgg')
    # 둥근 주머니(황토 삼베): 목 12, 몸 13~23
    g.put(20, 12, 'RQP')
    g.block(17, 13, [
        '.RSSRQ..',
        'RSTSRQPO',
        'STTSRQPO',
        'SSSRRQPO',
        'RSSRQQPO',
        'RRRQQPPO',
        'QRRQQPON',
        '.QQPPON.',
        '..PPON..',
    ])
    # 바닥 돌 받침 둘(청석)
    g.put(1, 28, 'FGGFFE')
    g.put(1, 29, 'EFFEED')
    g.put(1, 30, 'CDDCCB')
    g.put(1, 31, 'BCCBBA')
    g.put(24, 28, 'FGGFFE')
    g.put(24, 29, 'EFFEED')
    g.put(24, 30, 'CDDCCB')
    g.put(24, 31, 'BCCBBA')
    # 매달린 주머니 그림자(바닥, 오른쪽 아래로)
    g.shadow(sh_run(28, 10, 16) + sh_run(29, 11, 17) + sh_run(27, 19, 24) + sh_run(28, 18, 23) + [(30, 30), (31, 30), (30, 31), (31, 31)])
    return draw(g.done(), leg('song'), 32, 32, (3, 5),
                '줄 A · 소나무 기둥 둘에 들보, 흰 무명 길쭉한 주머니와 황토 삼베 둥근 주머니를 끈으로 매달았다. 기둥은 청석 받침 위.')


# =============================================================================
# 4. 명상 방석 묶음 (2×1) — 바닥에 하나 · 겹쳐 쌓은 둘
# =============================================================================
def meditation_mats_a1():
    g = Rows(32, 16)
    # 왼쪽 큰 방석 하나: 넓은 윗면(부들 고리 셋 — 밝은 고리 S·T 와 골 Q)·앞 두께 2행(세로 엮음 결)
    g.block(1, 7, [
        '....RSSSSSSR....',
        '..RSTTSSQQSSRQ..',
        '.RSTSQQRRRQQSRQ.',
        'RSTSQRSTTSRQSRQP',
        'RSSQRSTSSSRQRQQP',
        '.RSQQRRRRRQQRQP.',
        '..QRRQQQQQQQQP..',
        'OPQPOPQPOPQPOPON',
        '.NONNONNONNONNN.',
    ])
    # 오른쪽: 붉은 천 방석 위에 부들 방석을 겹쳐 쌓음(높이가 달라 나란한 두 덩이로 안 읽힌다)
    g.block(18, 9, [
        '.tuvvvvvvvut..',
        'tuvwwvvvvuuts.',
        'tuvvuuuuuutts.',
        'sttttttttsssr.',
        'rsrsrsrsrsrsr.',
        '.rrrrrrrrrrr..',
    ])
    g.block(19, 3, [
        '...RSSSSR...',
        '.RSTTSQQSRQ.',
        'RSTQRSSRQSQP',
        'RSQRSTTSRQQP',
        '.RQQRRRRQQP.',
        'OPQPOPQPOPON',
        '.NONNONNONN.',
    ])
    g.shadow(sh_run(15, 17, 17) + [(31, 13), (31, 14), (31, 15), (30, 15), (17, 13), (17, 14)])
    return draw(g.done(), leg('song'), 32, 16, (7, 10),
                '줄 A · 부들 방석: 바닥에 하나(고리 결 윗면·엮은 앞 두께), 붉은 천 방석 위에 하나를 겹쳐 쌓았다(높이가 달라 나란한 두 덩이로 안 읽힌다). 걸어 지나간다.')


# =============================================================================
# 5. 돌사자 한 쌍 (2×2 세트: l 수사자 · r 암사자) — 마주 본다, 빛은 둘 다 왼쪽 위
# =============================================================================
def stone_lions_a1():
    # 흰 대리석(bai) 앉은 사자 둘(왼쪽 16열 = 수사자, 오른쪽 16열 = 암사자)을 비스듬히 — 둘 다 문 가운데를 본다.
    # 말린 갈기 머리(윗면 밝게)·넓은 주둥이·앞다리 둘·엉덩이, 수사자는 앞발 아래 공, 암사자는 새끼. 청석 받침돌(윗면 22~23).
    # 빛은 둘 다 왼쪽 위. 그늘 쪽(오른쪽·아래가 빈 화소)은 대리석 0~1단 — 청석 마당에 묻히지 않게.
    rows = [
        "................................",
        ".....lhmmh............lhmmh.....",
        "...lmmlmmmh..........lmmlmmmh...",
        "..lmmlmmmmllh......lmmmmlmmlkh..",
        "..jkjijkkjjkjh....jkkjijkjkjih..",
        ".klkjkllmmmmlkh..kmmmmlkjkjkjih.",
        ".lkjklmmhmmmmlh..lmhmmmlkjkjkih.",
        ".kjkjlmmmmmmmlh.hmmmmmmlkjkjkih.",
        ".jkjklmmmlkhhhg..hhhkmmlkjkjkih.",
        ".kjkjklmmllllih.hlllllmlkjkjih..",
        ".hkjkjjklllkih...hhlljkkjkjkih..",
        "..ijkijkjkjih......hjkjkjkjih...",
        "..jklmkjlmlh........jlmljkmlkh..",
        ".jklmmlklmmlh......jlmmlkmmlkih.",
        ".klmmlkjlmmkh.....jlmmkjklmmlih.",
        "jklmlkjilmlkilh..jlmlkjikllmlkih",
        "kllmlkiilmlklmh.jklmljkiklmlkkih",
        "kllmlkhilmlkkjh.klmkkjhiklmlkkih",
        "jkllkjhilmllkkh.jkkjkjhijkllkjih",
        "hjkkjihjkllkkjh.hjkkjihhijkkjihh",
        ".hiiihhghiiihhg..hiiihhghiiihhg.",
        ".55555555555552..55555555555552.",
        ".56666666666662..56666666666662.",
        ".55555555555552..55555555555552.",
        ".34444444444432..34444444444432.",
        ".34222222222331..34222222222331.",
        ".34233333332331..34233333332331.",
        ".34222222222331..34222222222331.",
        ".33333333333331..33333333333331.",
        ".22222222222221..22222222222221.",
        ".11111111111110..11111111111110.",
        ".11111111111110..11111111111110.",
    ]
    g = Rows(32, 32).block(0, 0, rows)
    g.shadow([(15, 24), (31, 24), (15, 25), (31, 25), (15, 26), (31, 26), (15, 27), (31, 27), (15, 28), (31, 28), (15, 29), (31, 29), (15, 30), (31, 30), (15, 31), (31, 31)])
    return draw(rows, leg('shi'), 32, 32, None,
                '줄 A · 흰 대리석 돌사자 한 쌍(청석 받침돌 포함). 갈기 말린 큰 머리를 조금 안쪽(문 가운데)으로 돌렸다 — 왼쪽 수사자는 앞발 아래 공, 오른쪽 암사자는 새끼. 빛은 둘 다 왼쪽 위.',
                pieces={'l': {'top': (1, 4)}, 'r': {'top': (1, 4)}})


# =============================================================================
# 6. 석등 (1×2)
# =============================================================================
def stone_lantern_a1():
    # 그늘 쪽(오른쪽 끝·지붕돌 밑·받침 굽)은 청석 1~2단 — 같은 청석 마당에 묻히지 않게(외곽선 규칙 예외)
    rows = [
        "................",
        ".......FD.......",
        "......FGEC......",
        ".......EC.......",
        "D.....DEEC.....B",
        "CD..FGGGGGGFC.CB",
        ".DGGGGGGGGGGGGB.",
        "..DFFFFFFFFFEEB.",
        "...CDDDDDDDDCB..",
        "....BCCCCCCBB...",
        "....FEEEEEEDB...",
        "....EDBYZYBDB...",
        "....EDBZZYBDB...",
        "....EDBYYXBCB...",
        "....EDCCCCCCB...",
        "...FGGGGGGGGFB..",
        "...CEEEEEEEDCB..",
        "....BBCCCCBBB...",
        "......FEDB......",
        "......FEDB......",
        "......EEDB......",
        "......EDCB......",
        "......EDCB......",
        "......EDCB......",
        "....FGGGGGGC....",
        "....DEEEEEDB....",
        "....CDDDDDCB....",
        "..FGGGGGGGGGGC..",
        "..EFFFFFFFFFEB..",
        "..DEEEEEEEEDDB..",
        "..CDDDDDDDDCCB..",
        "..BBBBBBBBBBBB..",
    ]
    g = Rows(16, 32).block(0, 0, rows)
    g.shadow([(14, 29), (15, 29), (14, 30), (15, 30), (14, 31), (15, 31), (10, 22), (10, 23), (12, 25), (12, 26)])
    return draw(g.done(), leg('shi'), 16, 32, (5, 8),
                '줄 A · 청석 석등: 넓은 받침·기둥·불집(금빛 불 창 한 칸, 둘레는 어두운 돌)·끝이 들린 지붕돌·보주. 그늘 쪽은 청석 어두운 단.')


# =============================================================================
# 7. 비석 (1×2)
# =============================================================================
def stele_a1():
    rows = [
        "................",
        ".....FGGGF......",
        "...FGGFFFGGE....",
        "..FGFEEEEEFGD...",
        "..FFEDDDDDEFDC..",
        "..EEEDCCCDEEDC..",
        "...DDDDDDDDDC...",
        "...FFFFFFFFFE...",
        "...FEEEEEEEDC...",
        "...FEDDDDDDDC...",
        "...FED.....DC...",
        "...FEDEEEEDDC...",
        "...FEDEDDEDDC...",
        "...FEDEEEEDDC...",
        "...FEDEEDEDDC...",
        "...FEDEEEEDDC...",
        "...FEDEDEEDDC...",
        "...FEDEEEEDDC...",
        "...FEDDDDDDDC...",
        "...FEEEEEEEDC...",
        "...EDDDDDDDDB...",
        "...DCCCCCCCCB...",
        ".FGGGGGGGGGGGGE.",
        ".FFFFFFFFFFFFED.",
        ".EEEEEEEEEEEEDC.",
        ".DEDDDDDDDDDDCC.",
        ".DEDCCCCCCCCDCB.",
        ".DEDCDDDDDDCDCB.",
        ".DEDCCCCCCCCDCB.",
        ".CDDDDDDDDDDDCB.",
        ".CCCCCCCCCCCCCB.",
        ".BBBBBBBBBBBBBB.",
    ]
    g = Rows(16, 32).block(0, 0, rows)
    g.put(6, 10, 'CCCCC')
    g.shadow([(15, 25), (15, 26), (15, 27), (15, 28), (15, 29), (15, 30), (15, 31), (13, 20), (13, 21)])
    return draw(g.done(), leg('shi'), 16, 32, (1, 4),
                '줄 A · 청석 비석: 구름 띠를 두른 둥근 머리(윗면 밝게)·테두리 띠 안 면(글자 없음, 결만)·두 단 받침돌.')



# =============================================================================
# 8. 작은 청동 향로 (1×1) — 세 발·귀 둘·재 위 향 셋
# =============================================================================
def censer_small_a1():
    rows = [
        "................",
        "................",
        "................",
        "......s.s.s.....",
        "......s.s.s.....",
        "...61.s.r.s.41..",
        "...41.......21..",
        "...5666666651...",
        "..56DEEEEEDC41..",
        "..5544444433211.",
        "..4566554433211.",
        "..165656453421..",
        "...1444313221...",
        "....3211.121....",
        "....31...21.10..",
        "....10...10.00..",
    ]
    g = Rows(16, 16).block(0, 0, rows)
    g.shadow([(13, 13), (14, 13), (14, 14), (15, 14), (6, 15), (7, 15), (8, 15), (14, 15), (15, 15)])
    return draw(g.done(), leg('jin'), 16, 16, (7, 9),
                '줄 A · 세 발 청동 향로: 선 귀 둘·아가리 안 재(청석)·향 셋(붉은 끝)·배에 금 점 띠. 그늘 쪽 = 청동 가장 어두운 단.')


# =============================================================================
# 9. 대나무 화분 (1×2)
# =============================================================================
def bamboo_pot_a1():
    # 잎·화분의 그늘 쪽(오른쪽·아래가 빈 화소)은 대나무·유약 2단 이하 — 마루에 묻히지 않게(외곽선 규칙 예외)
    rows = [
        "................",
        ".......52.......",
        "....2.5662.42...",
        "..456565565652..",
        ".25624565252542.",
        "..22.4522.2.432.",
        ".2...22.32..22..",
        "....2.2532.2....",
        "...562.42.2542..",
        "..4522.42..232..",
        "..22...52...2...",
        "......4532......",
        "...2..5342.2....",
        "..422.5342252...",
        "..2.2.6442.22...",
        "......5342......",
        "......5342......",
        "......6442......",
        "......5342......",
        "......5342......",
        "......5342......",
        "......5342......",
        "...LMMMMMMMMLI..",
        "..LMPQQQQPPOKIH.",
        "..KLLLLLLKKJJIH.",
        "..IMMLLLKKJJIHH.",
        "...LMLLKKJJIHH..",
        "...ILLKKJJIIHH..",
        "....KKKJJIIHH...",
        "....IJJIIIHHH...",
        ".....IIIHHHH....",
        "....HHH...HHH...",
    ]
    g = Rows(16, 32).block(0, 0, rows)
    g.shadow([(15, 25), (15, 26), (15, 27), (14, 28), (15, 28), (14, 29), (15, 29), (13, 30), (14, 30), (15, 30), (13, 31), (14, 31), (15, 31), (7, 31), (8, 31), (9, 31)])
    return draw(g.done(), leg('zhuz'), 16, 32, (2, 5),
                '줄 A · 청회 유약 화분(아가리 윗면·흙)에 대 두 줄기(마디 밝은 고리)와 잎 덩이 둘. 위 잎 덩이 윗면이 밝고, 잎 아래·오른쪽 끝은 짙다.')


# =============================================================================
# 10. 대숲 덤불 (2×2, 가로 반복)
# =============================================================================
# 대숲 잎 획: (x, y, 방향, 단). 방향 r = 오른쪽 아래로 처진 잎, l = 왼쪽 아래. 잎 하나 = 대각 3화소(밝은 끝 → 어두운 끝).
# 위 줄일수록 밝다. x 는 32 로 감아 찍는다(가로 반복 이음). 자리는 손으로 골랐다.
THICKET_LEAVES = [
    (2, 1, 'r', 6), (9, 0, 'l', 6), (14, 1, 'r', 6), (20, 0, 'r', 6), (26, 1, 'l', 6), (30, 0, 'r', 6),
    (0, 3, 'l', 5), (5, 2, 'r', 5), (11, 3, 'r', 5), (17, 2, 'l', 5), (23, 3, 'r', 5), (28, 3, 'l', 5),
    (3, 5, 'r', 5), (8, 4, 'l', 5), (14, 5, 'l', 5), (19, 4, 'r', 5), (25, 5, 'r', 5), (31, 5, 'l', 5),
    (1, 7, 'r', 4), (6, 7, 'l', 4), (11, 6, 'r', 4), (16, 7, 'r', 4), (21, 7, 'l', 4), (27, 7, 'r', 4),
    (4, 9, 'l', 4), (9, 9, 'r', 4), (14, 9, 'l', 4), (19, 10, 'r', 4), (24, 9, 'l', 4), (29, 10, 'r', 4),
    (2, 11, 'r', 3), (7, 12, 'l', 3), (12, 11, 'r', 3), (17, 12, 'l', 3), (22, 11, 'r', 3), (27, 12, 'l', 3),
    (0, 14, 'r', 3), (5, 14, 'l', 3), (10, 14, 'r', 3), (15, 15, 'l', 3), (20, 14, 'r', 3), (25, 14, 'r', 3), (30, 15, 'l', 3),
]
THICKET_STALKS = [(3, '53'), (10, '42'), (17, '53'), (24, '42'), (29, '53')]   # 줄기 열(2px): 앞(밝음)·뒤(어두움)


def bamboo_thicket_a1():
    g = Rows(32, 32)
    # 잎 덩이 바탕(속 그늘): 위는 잎 끝만, 아래로 짙어진다
    for y in range(2, 18):
        base = '3' if y < 6 else '2' if y < 13 else '1'
        g.put(0, y, base * 32)
    for x in (1, 4, 7, 12, 15, 18, 22, 25, 28, 31):
        g.r[2][x] = '.'
    for x in (0, 9, 13, 20, 26):
        g.r[18][x] = '1'
        g.r[18][(x + 1) % 32] = '1'
    # 줄기(잎 속에서도 비친다): 6~31행, 마디는 밝은 고리
    for x, c in THICKET_STALKS:
        for y in range(6, 32):
            node = (y + x) % 7 == 0
            g.put(x, y, ('64' if c == '53' else '53') if node else c)
    # 잎 획(줄기 위에 겹친다)
    for x, y, d, t in THICKET_LEAVES:
        for k in range(3):
            xx = (x + (k if d == 'r' else -k)) % 32
            if 0 <= y + k < 32:
                g.r[y + k][xx] = str(max(1, t - k))
    # 줄기 밑동(소나무 그늘 단 흙)·그림자
    for x, _ in THICKET_STALKS:
        g.put(x - 1, 31, 'po')
        g.r[31][(x + 2) % 32] = 'o'
        g.shadow([((x + 3) % 32, 30), ((x + 3) % 32, 31)])
    return draw(g.done(), leg('zhuz'), 32, 32, (2, 5),
                '줄 A · 가로로 이어 까는 대숲: 위는 처진 잎 획(대각 3화소, 위가 밝다)이 겹친 덩이, 속은 짙은 그늘, 아래로 줄기 다섯(마디 밝은 고리)이 내려온다.')


# =============================================================================
# 11. 매화 분재 (1×1)
# =============================================================================
def plum_bonsai_a1():
    # 꽃 무더기를 위 덩이(꽃 구름) 하나로 모아 윗면을 만든다. 꽃 = 연붉은·흰 점, 덩이 아래·오른쪽 끝은 짙은 꽃봉오리(주칠 1~2단)
    rows = [
        "................",
        "....ws.wms......",
        "..wmlwvmlwvs.s..",
        ".swmlvwmwlvwvsr.",
        "..swvscvwtuvssr..",
        "...rc.dc.sr..r..",
        "..ws..cb..dc....",
        ".smvs..dc.ecb...",
        "..sr...cdcdb.ws.",
        "........ccb.svsr",
        ".........dc..sr.",
        "...FGGGGGGGGGB..",
        "..FEPQ)PQ[Q)OCB.",
        "..BFFFFFFFFFECB.",
        "...CCBBBBBBBBBA.",
        "...BA.......BA..",
    ]
    g = Rows(16, 16).block(0, 0, rows)
    g.shadow([(15, 12), (15, 13), (15, 14), (15, 15), (14, 15), (5, 15), (6, 15), (7, 15), (8, 15), (9, 15), (10, 15), (11, 15)])
    return draw(g.done(), leg('mu'), 16, 16, (2, 4),
                '줄 A · 얕은 청석 분(흙·이끼)에 굽은 짙은 매화 가지, 위에 연붉은·흰 꽃 무더기(꽃 구름 한 덩이 + 곁가지 둘). 점 둘이 나란히 서지 않게, 덩이 끝은 짙은 봉오리.')


# =============================================================================
# 12. 정원석 태호석 (1×2) — 구멍 하나
# =============================================================================
def garden_rock_a1():
    # 밝은 석회암(청석 밝은 단)이라 청석 마당 위에서도 떠 보인다. 오른쪽으로 기운 층층 덩이, 구멍은 오른쪽 위에 하나만.
    rows = [
        "................",
        "................",
        "................",
        "........FG......",
        ".......FGGF.....",
        "......FGGFFE....",
        ".....FGFFEEDC...",
        "....FGGFEDC.DB..",
        "....GFFED...CB..",
        "...FGFEEDC.CDB..",
        "...EFEEDDCCDCB..",
        "....DEDDCCBCB...",
        "...FGGGFFEDC....",
        "..FGGFFFEEDDC...",
        "..EFFEEEDDDCCB..",
        "...DEEDDCCCCB...",
        "....CDDCCBBB....",
        "...FGGFEDDE.....",
        "..FGGFFEEDDDC...",
        ".FGFFEEEDDDCCB..",
        ".EFEEEDDDCCCBB..",
        "..DEDDDCCCBBB...",
        "...CCCBBBBBA....",
        "...ABBBBBAA.....",
        ".BCDDDDDDDDDDCB.",
        "BCEFFFFFFFFFFEDB",
        "BDEEEEEEEEEEEEDB",
        "BCDDDDDDDDDDDDCA",
        "ABCCCCCCCCCCCCBA",
        ".ABBBBBBBBBBBBA.",
        "................",
        "................",
    ]
    g = Rows(16, 32).block(0, 0, rows)
    g.r = [list('.' * 16) for _ in range(2)] + g.r[:30]     # 통째로 두 행 내려 받침 발이 칸 아래 경계에 닿게
    g.shadow([(14, y) for y in range(10, 25)] + [(15, y) for y in range(14, 26)] + [(15, 28), (15, 29), (15, 30)])
    return draw(g.done(), leg('shi'), 16, 32, (14, 16),
                '줄 A · 밝은 석회암 태호석: 오른쪽으로 기운 층층 덩이(층마다 윗면이 밝다)·오른쪽 위 구멍 하나·낮은 청석 수반. 구멍이 하나뿐이라 얼굴로 읽히지 않는다.')


# =============================================================================
# 13. 우물 (2×2) — 청석 우물 테·물·도르래 틀·두레박
# =============================================================================
def well_a1():
    g = Rows(32, 32)
    # 도르래 틀(소나무): 기둥 둘, 위 가로대에 도르래
    g.put(1, 2, '5' + '6' * 28 + '4')
    g.put(1, 3, '5' * 29 + '3')
    g.put(1, 4, '3' * 29 + '2')
    for y in range(5, 22):
        g.put(3, y, '52')
        g.put(27, y, '52')
    g.block(13, 4, ['.dfed.', 'dfeedc', '.cbba.'])     # 도르래(짙은 나무)
    for y in range(7, 13):
        g.put(15, y, 'R')                               # 두레박 줄
    g.block(13, 12, ['ycxx', 'xyyq', 'qxqp', '.pp.'])   # 두레박(소나무)
    # 우물 테(청석): 윗면 둥근 띠 + 안 물 + 앞면 돌 줄
    g.block(2, 14, [
        '......FGGGGGGGGGGGGGGF......',
        '...FGGGFFFFFFFFFFFFFFGGGF...',
        '.FGGFEDCCCCCCCCCCCCCCCDEFGF.',
        'FGFEDBIIIIIIIIIIIIIIIIIBDEFE',
        'GFEDBIHIJIIIIIIIIJJIIHIBDEFD',
        'FFEDBHIIIIIKJIIIIIIIIIHHBDED',
        'FFEEDBHHHHHHHHHHHHHHHHHBCDED',
        'EFFEEDCCBBBBBBBBBBBBBCCDDEDC',
        '.EFFFEEEEDDDDDDDDDDDDDDDEDC.',
        'DEEEEDCDEEEEDCDEEEEDCDEEEDCB',
        'DEDDDCBDEDDDCBDEDDDDCBDDDDCB',
        'CDDDDCBCDDDDCBCDDDDDCBCDDDCB',
        'BBBBBBBBBBBBBBBBBBBBBBBBBBBA',
        'DEEEDCDEEEEDCDEEEEDCDEEEEDCB',
        'CDDDCBCDDDDCBCDDDDCBCDDDDCBA',
        'BCCCBBBCCCCBBBCCCCBBBCCCCBBA',
        'ABBBBBBBBBBBBBBBBBBBBBBBBBAA',
        '.BBBBBBBBBBBBBBBBBBBBBBBBBB.',
    ])
    g.shadow(sh_run(31, 30, 31) + sh_run(30, 30, 31) + sh_run(29, 30, 31))
    return draw(g.done(), leg('song'), 32, 32, (14, 17),
                '줄 A · 청석 우물 테(둥근 윗면 안에 짙은 물)·두 줄 돌 앞면·소나무 도르래 틀과 두레박.')


# =============================================================================
# 14. 물독 (1×1)
# =============================================================================
def water_jar_a1():
    rows = [
        "................",
        "................",
        "...LMMMMMMMML...",
        "..LMKJJJJJJKLK..",
        ".LMJHIIIIIIHJLI.",
        ".LLKIIKLIIIIKKI.",
        "..LKKJJJJJJKKI..",
        ".LMMLLLLLKKKJJH.",
        ".LMLLLLLKKKJJIH.",
        ".KLLLLKKKKJJJIH.",
        ".KLLKKKKJJJJIIH.",
        "..KKKKJJJJIIIH..",
        "..JKKJJJJIIIHH..",
        "...JJJIIIIHHH...",
        "....IIIHHHHH....",
        ".....HHHHHH.....",
    ]
    g = Rows(16, 16).block(0, 0, rows)
    g.put(9, 4, 'RS')               # 물에 뜬 박 바가지(황토) 하나
    g.put(9, 5, 'QR')
    g.put(11, 3, 'Q')
    g.shadow([(15, 8), (15, 9), (15, 10), (15, 11), (14, 12), (15, 12), (14, 13), (15, 13), (13, 14), (14, 14), (15, 14), (12, 15), (13, 15), (14, 15), (15, 15)])
    return draw(g.done(), leg('wa'), 16, 16, (2, 4),
                '줄 A · 큰 청회 유약 물독: 아가리 윗면 안에 짙은 물(빛 한 점)과 뜬 박 바가지, 둥근 배는 왼쪽 위가 밝다. 그늘 쪽 = 유약 가장 어두운 단 + 접지 그림자.')


# =============================================================================
# 15. 찻상 (2×1) — A1 짙은 나무 낮은 네모 찻상 / B1 소나무 찻상(주칠 테·서랍)
# =============================================================================
def tea_table_a1():
    g = Rows(32, 16)
    g.put(1, 6, 'e' + 'f' * 28 + 'e')
    g.put(1, 7, 'e' + 'ffeeeeeeffffeeeeeeeeffffeeeee' + 'd')
    g.put(1, 8, 'e' + 'eeeeddeeeeeeeeeeddddeeeeeeeed' + 'd')
    g.put(1, 9, 'e' + 'eeeeeeeeeeeddeeeeeeeeeeeddeed' + 'c')
    g.put(1, 10, 'd' * 29 + 'c')
    g.put(1, 11, 'c' * 29 + 'b')
    g.put(1, 12, 'b' * 30)
    g.put(2, 13, 'dcb')
    g.put(27, 13, 'dcb')
    g.put(2, 14, 'dcb')
    g.put(27, 14, 'cba')
    g.put(1, 15, 'dcba')
    g.put(26, 15, 'dcbaa')
    g.put(6, 13, 'b' + 'a' * 20)
    # 다기: 청자 찻주전자 하나(왼쪽 뒤) · 옆에서 본 흰 잔 둘을 대각선(가운데 앞 · 오른쪽 뒤) — 잔 속 점을 찍지 않는다
    g.block(4, 2, ['..LM...', '.LMMLK.', 'KLMLLKJJ', '.KLLKJI.', '..JJII..'])
    g.block(14, 8, ['lmk', 'jkj'])
    g.block(23, 5, ['lmk', 'jkj'])
    g.shadow([(31, 11), (31, 12), (31, 13), (31, 14), (31, 15), (30, 13), (30, 14), (5, 13), (5, 14)] + sh_run(14, 6, 26) + sh_run(15, 6, 25))
    return draw(g.done(), leg('mu'), 32, 16, (6, 10),
                '줄 A · 짙은 나무 낮은 네모 찻상(넓은 윗면·앞 두께·짧은 다리)에 청자 찻주전자 하나와 흰 잔 둘(대각선, 잔 속 점 없음).')


def tea_table_b1():
    rows = [
        "................................",
        "................................",
        "................................",
        "........aa......................",
        ".......adcba....................",
        "...vwwadcccbwwwwwwwwwwwwwwwwv...",
        "...v666abbba6666666jjk666665t...",
        "...v6666655666ijk665555556665t..",
        "...v5555555555555555555555554s..",
        "...uuuuuuuuuuuuuuuuuuuuuuuuus...",
        "...tttttttttttttttttttttttttr...",
        "....4444444Y44444444Y333330.....",
        "....100000000000000000000000....",
        "....s......................r....",
        "....t......................r....",
        "...tsr....................srr...",
    ]
    g = Rows(32, 16).block(0, 0, rows)
    g.shadow([(28, 12), (6, 13), (7, 13), (8, 13), (9, 13), (10, 13), (11, 13), (12, 13), (13, 13), (14, 13), (15, 13), (16, 13), (17, 13), (18, 13), (19, 13), (20, 13), (21, 13), (22, 13), (23, 13), (24, 13), (25, 13), (26, 13), (28, 13), (29, 13), (6, 14), (7, 14), (8, 14), (9, 14), (10, 14), (11, 14), (12, 14), (13, 14), (14, 14), (15, 14), (16, 14), (17, 14), (18, 14), (19, 14), (20, 14), (21, 14), (22, 14), (23, 14), (24, 14), (25, 14), (26, 14), (28, 14), (29, 14), (6, 15), (7, 15), (8, 15), (9, 15), (10, 15), (11, 15), (12, 15), (13, 15), (14, 15), (15, 15), (16, 15), (17, 15), (18, 15), (19, 15), (20, 15), (21, 15), (22, 15), (23, 15), (24, 15), (25, 15), (29, 15)])
    return draw(g.done(), leg('song'), 32, 16, (6, 9),
                '줄 B · 소나무 찻상에 주칠 테·앞에 서랍 둘(금 손잡이)·휜 다리, 자사 찻주전자와 잔 둘. 줄 A 보다 좁고 높다. 그늘 쪽은 소나무·주칠 가장 어두운 단(붉은 마루에 묻히지 않게).')


# =============================================================================
# 16. 낮은 서안 + 두루마리 (2×1)
# =============================================================================
def writing_desk_a1():
    g = Rows(32, 16)
    g.put(1, 4, 'f' * 30)
    g.put(1, 5, 'e' + 'f' * 28 + 'e')
    g.put(1, 6, 'e' * 29 + 'd')
    g.put(1, 7, 'e' * 29 + 'd')
    g.put(1, 8, 'd' * 29 + 'c')
    g.put(0, 9, 'f' + 'c' * 30 + 'b')            # 끝이 말린 앞 모서리(권두)
    g.put(0, 10, 'e' + 'b' * 30 + 'a')
    g.put(2, 11, 'dc')
    g.put(28, 11, 'cb')
    g.put(2, 12, 'dc')
    g.put(28, 12, 'cb')
    g.put(1, 13, 'ddcb')
    g.put(27, 13, 'dcbb')
    g.put(1, 14, 'cbba')
    g.put(27, 14, 'cbba')
    g.put(1, 15, 'baa.')
    g.put(27, 15, 'baa.')
    g.put(4, 12, 'b' * 23)
    # 펼친 두루마리(흰 종이, 결만) — 양 끝 축
    g.put(3, 5, 'xpmmmmmmmmmmmmmllpx')
    g.put(3, 6, 'xplkjlkkjllkjkllkpx')
    g.put(3, 7, 'xplllllllllllllkkpx')
    # 벼루·먹·붓
    g.block(24, 4, ['CDDDB', 'BAAAB', 'CBBBB'])
    g.put(25, 3, 'cb')
    g.put(23, 8, 'yxqpb')
    g.shadow([(31, 10), (31, 11), (31, 12), (31, 13), (31, 14), (30, 15), (31, 15), (4, 13)] + sh_run(13, 5, 26) + sh_run(14, 5, 26) + sh_run(15, 4, 26))
    return draw(g.done(), leg('mu'), 32, 16, (4, 8),
                '줄 A · 짙은 나무 낮은 서안(앞 끝이 말린 권두)·펼친 흰 두루마리(글자 없는 결)·벼루와 먹·붓.')


def writing_desk_b1():
    rows = [
        "....LMMMLH................a.a...",
        "....jjjjjj...lmmmmmmlg...deeda..",
        "....KLLLKH...kvlllllkg...cddca..",
        "..66iiiii66666lmmmmmlk66666660..",
        "..6666666666666666666666666660..",
        "..5555555555555555555555555550..",
        "..4444444444444444444444444440..",
        "..OOOOOOOOOONNNNNNNNOOOOOOOOON..",
        "..PNNNNNNNNN........PNNNNNNNNN..",
        "..POOOOXOOON........POOOOXOOON..",
        "..POOOOOOOON........POOOOOOOON..",
        "..PNNNNNNNNN........PNNNNNNNNN..",
        "..220000000.........2000000220..",
        "..20......0.........0......10...",
        "..20......0.........0......10...",
        ".000......0.........0......000..",
    ]
    g = Rows(32, 16).block(0, 0, rows)
    g.shadow([(30, 12), (11, 13), (12, 13), (13, 13), (14, 13), (15, 13), (16, 13), (17, 13), (18, 13), (19, 13), (30, 13), (31, 13), (11, 14), (12, 14), (13, 14), (14, 14), (15, 14), (16, 14), (17, 14), (18, 14), (19, 14), (31, 14), (11, 15), (12, 15), (13, 15), (14, 15), (15, 15), (16, 15), (17, 15), (18, 15), (19, 15), (31, 15)])
    return draw(g.done(), leg('song'), 32, 16, (3, 5),
                '줄 B · 소나무 서안에 황토 서랍장 둘(가운데 무릎 자리 뚫림), 위에 청회 겉장 책 더미·붉은 끈 두루마리 둘·붓통. 그늘 쪽 = 소나무 가장 어두운 단.')


# =============================================================================
# 17. 병풍 (2×2) — A1 네 폭 흰 비단 산수(폭을 넘어 이어지는 산줄기) / B1 세 폭 창살+대나무
# =============================================================================
# 산줄기 윗선(열 x → 그 열의 산 꼭대기 행). 먼 산·가까운 산. 손으로 정한 표 — 폭 틀을 넘어 한 그림으로 이어진다
FAR_HILLS = [17, 16, 15, 14, 13, 12, 13, 14, 15, 15, 14, 12, 11, 10, 11, 12, 14, 15, 16, 15, 14, 13, 12, 12, 13, 14, 15, 16, 16, 15, 14, 15]
NEAR_HILLS = [21, 20, 19, 18, 19, 20, 21, 21, 20, 19, 18, 18, 19, 20, 21, 21, 20, 19, 18, 17, 17, 18, 19, 20, 21, 20, 19, 19, 20, 21, 21, 20]


def folding_screen_a1():
    g = Rows(32, 32)
    g.put(1, 2, 'f' * 30)
    g.put(1, 3, 'e' * 29 + 'd')
    g.put(1, 4, 'c' * 30)
    # 폭 넷(8px): 폭마다 비단 바탕 단을 달리해 지그재그로 꺾인 느낌 — 1·3 밝음(빛 받는 면), 2·4 한 단 어둡게
    for k, x0 in enumerate((1, 9, 17, 25)):
        lit = k % 2 == 0
        silk, far, near, mist = ('l', 'K', 'J', 'm') if lit else ('k', 'J', 'I', 'l')
        for y in range(5, 27):
            g.put(x0, y, 'e' + silk * 6 + 'c')
        for x in range(x0 + 1, x0 + 7):
            for y in range(FAR_HILLS[x], 27):
                g.r[y][x] = far if y < NEAR_HILLS[x] else near
            g.r[FAR_HILLS[x]][x] = 'L' if lit else 'K'        # 먼 산 능선 빛
            for y in (23, 24):
                g.r[y][x] = mist                                # 산 아래 물안개
            g.r[25][x] = silk
            g.r[26][x] = silk
    g.put(1, 27, 'd' * 30)
    g.put(1, 28, 'c' * 30)
    for x0 in (1, 9, 17, 25):
        g.put(x0, 29, 'dcb')
        g.put(x0 + 5, 29, 'cb')
        g.put(x0, 30, 'dcb')
        g.put(x0 + 5, 30, 'cb')
        g.put(x0, 31, 'cba')
        g.put(x0 + 5, 31, 'ba')
    g.shadow([(31, y) for y in range(5, 32)])
    return draw(g.done(), leg('mu'), 32, 32, (2, 4),
                '줄 A · 짙은 나무 틀 네 폭 병풍. 흰 비단 면에 폭을 넘어 이어지는 먼 산·가까운 산(청회)과 물안개, 글자 없음. 지그재그로 꺾인 것은 폭마다 밝기를 달리해 보인다(옆면 없음).')


def folding_screen_b1():
    g = Rows(32, 32)
    g.put(2, 1, 'J' + 'K' * 26 + 'J')
    g.put(1, 2, 'J' + 'L' * 28 + 'I')
    g.put(1, 3, 'I' + 'J' * 28 + 'H')
    g.put(1, 4, 'u' * 30)
    for k, x0 in enumerate((1, 11, 21)):
        base = 'R' if k != 1 else 'Q'
        for y in range(5, 27):
            g.put(x0, y, 'v' + base * 8 + 's')
        for y in range(5, 13):
            g.put(x0 + 1, y, ('uuuu' if y % 3 == 0 else 'tPtP') * 2)
        g.put(x0, 13, 'v' + 'u' * 8 + 's')
        for y in range(15, 26):
            g.put(x0 + 3, y, '4' if y % 4 else '6')
            g.put(x0 + 6, y, '3' if y % 5 else '5')
        g.put(x0 + 4, 16, '45')
        g.put(x0 + 5, 17, '4')
        g.put(x0 + 1, 19, '54')
        g.put(x0 + 7, 21, '4')
    g.put(1, 27, 't' * 30)
    g.put(1, 28, 's' * 30)
    for x0 in (1, 11, 21):
        g.put(x0, 29, 'ts')
        g.put(x0 + 8, 29, 'sr')
        g.put(x0, 30, 'ts')
        g.put(x0 + 8, 30, 'sr')
        g.put(x0, 31, 'sr')
        g.put(x0 + 8, 31, 'rr')
    g.shadow([(31, y) for y in range(5, 32)])
    return draw(g.done(), leg('zhuz'), 32, 32, (1, 4),
                '줄 B · 청회 기와 갓을 얹은 세 폭 병풍: 주칠 틀, 위는 붉은 창살, 아래 황토 종이에 대나무. 줄 A(네 폭 흰 비단)와 폭 수·짜임이 다르다.')


# =============================================================================
# 18. 비급 서가 (2×2) — A1 짙은 나무 세 칸 서가 / B1 소나무 다보격(엇갈린 칸)
# =============================================================================
def scroll_shelf_a1():
    g = Rows(32, 32)
    g.put(1, 1, 'f' * 30)
    g.put(1, 2, 'e' + 'f' * 28 + 'e')
    g.put(1, 3, 'd' * 29 + 'c')
    for y in range(4, 29):
        g.put(1, y, 'ed')
        g.put(29, y, 'cb')
    for y0 in (4, 12, 20):
        for y in range(y0, y0 + 6):
            g.put(3, y, 'a' + 'b' * 25 + 'a')
        g.put(3, y0 + 6, 'f' * 26)
        g.put(3, y0 + 7, 'c' * 26)
    for x, c in ((4, 'v'), (8, 'Y'), (12, 'K'), (16, 'v'), (20, 'Y')):
        g.put(x, 8, 'lkj' if x != 12 else 'mlk')
        g.put(x, 9, c + 'k' + 'i')
    for x, c in ((6, 'K'), (10, 'v'), (14, 'Y'), (18, 'K')):
        g.put(x, 6, 'lkj')
        g.put(x, 7, c + 'j' + 'i')
    g.block(24, 6, ['RSSR', 'QRRQ', 'QRRP', 'PQQP'])
    for x, a, b in ((4, 'L', 'J'), (7, 'K', 'I'), (10, 'v', 't'), (13, 'L', 'J'), (16, 'M', 'K'), (19, 'u', 's'), (22, 'K', 'I'), (25, 'L', 'J')):
        for y in range(13, 18):
            g.put(x, y, a + b)
        g.put(x, 13, 'kj')
    g.block(4, 22, ['TSSSSSSR', 'SRRRRRRQ', 'RQQXQQQP', 'QPPPPPPO'])
    g.block(14, 23, ['LMMMMMLK', 'jjjjjjji', 'KLLLLLKJ'])
    g.block(23, 21, ['.lk.', 'lmkj', 'kv.j', 'jkji', '.ji.'])
    g.put(1, 28, 'd' * 30)
    g.put(1, 29, 'c' * 30)
    g.put(1, 30, 'dcb')
    g.put(28, 30, 'cba')
    g.put(1, 31, 'cba')
    g.put(28, 31, 'baa')
    g.shadow([(31, y) for y in range(3, 32)] + sh_run(30, 4, 27) + sh_run(31, 4, 27))
    return draw(g.done(), leg('mu'), 32, 32, (1, 3),
                '줄 A · 짙은 나무 세 칸 서가: 위 칸 두루마리(색 마구리)·함, 가운데 칸 청회·주칠 책갑, 아래 칸 황토 비급 상자·눕힌 책. 칸 안은 어둡다.')


def scroll_shelf_b1():
    g = Rows(32, 32)
    g.put(1, 1, '6' * 30)
    g.put(1, 2, '5' + '6' * 28 + '5')
    g.put(1, 3, '4' * 29 + '3')
    for y in range(4, 29):
        g.put(1, y, '54')
        g.put(29, y, '32')
    for y in range(4, 28):
        g.put(3, y, 'c' * 26)
    for y in (11, 19):
        g.put(3, y, '5' * 26)
        g.put(3, y + 1, '3' * 26)
    g.put(3, 15, '5' * 11)
    g.put(3, 16, '3' * 11)
    g.put(19, 7, '5' * 10)
    g.put(19, 8, '3' * 10)
    for y in range(4, 11):
        g.put(17, y, '42')
    for y in range(13, 19):
        g.put(14, y, '42')
    for y in range(21, 28):
        g.put(10, y, '42')
        g.put(22, y, '42')
    g.block(6, 4, ['.kl.', 'kLMj', 'jKLi', '.ji.', '.KJ.', 'jKJi', '.ii.'])
    g.block(20, 9, ['lmmmlk', 'kvkkki'])
    g.block(23, 4, ['.fe.', 'dffc', 'cddb'])
    g.block(5, 13, ['lmmlk', 'kjjji'])
    g.block(17, 13, ['RSSSSSR', 'QRRRRRQ', 'PQQQQQP', 'LMMMMLK', 'KLLLLKJ', 'JKKKKJI'])
    g.block(5, 21, ['.SRQ', 'SRQP', 'RQPO', '.QP.'])
    g.block(13, 22, ['vutvut', 'utsuts', 'tsrtsr'])
    g.block(25, 23, ['ml', 'lk', 'kj'])
    g.put(1, 28, '4' * 30)
    g.put(1, 29, '3' * 30)
    g.put(1, 30, '432')
    g.put(28, 30, '321')
    g.put(1, 31, '321')
    g.put(28, 31, '210')
    g.shadow([(31, y) for y in range(3, 32)] + sh_run(30, 4, 27) + sh_run(31, 4, 27))
    return draw(g.done(), leg('song'), 32, 32, (1, 3),
                '줄 B · 소나무 다보격(엇갈린 칸) — 청화 병·두루마리·자사 단지·황토 상자·청회 책·주칠 책갑. 줄 A(고른 세 칸)와 칸 짜임이 다르다.')


# =============================================================================
# 19. 약재 서랍장 (2×2) — A1 짙은 나무 작은 서랍 4×5 / B1 소나무·주칠 3×4
# =============================================================================
def medicine_cabinet_a1():
    g = Rows(32, 32)
    g.put(1, 3, 'f' * 30)
    g.put(1, 4, 'e' + 'f' * 28 + 'e')
    g.put(1, 5, 'd' * 29 + 'c')
    for y in range(6, 28):
        g.put(1, y, 'e' + 'c' * 28 + 'b')
    for row in range(5):
        y = 7 + row * 4
        for col in range(4):
            x = 3 + col * 7
            g.put(x, y, 'eeeeed')
            g.put(x, y + 1, 'ddYddc')
            g.put(x, y + 2, 'ccccbb')
    g.put(1, 27, 'd' * 30)
    g.put(1, 28, 'c' * 30)
    g.put(2, 29, 'dcb')
    g.put(27, 29, 'cba')
    g.put(2, 30, 'dcb')
    g.put(27, 30, 'cba')
    g.put(1, 31, 'dcba')
    g.put(26, 31, 'dcbaa')
    g.block(4, 0, ['.RSSSSSR.', 'RSQRQRQSQ', 'QRRRRRRQP'])
    g.block(21, 0, ['.lk.', 'lmkj', 'kljj'])
    g.shadow([(31, y) for y in range(5, 32)] + sh_run(29, 5, 26) + sh_run(30, 5, 26) + sh_run(31, 5, 25))
    return draw(g.done(), leg('mu'), 32, 32, (3, 5),
                '줄 A · 짙은 나무 약재장: 작은 서랍 4열×5줄(금 손잡이 한 점씩, 고른 격자)·위에 약재 소쿠리와 흰 약 단지.')


def medicine_cabinet_b1():
    g = Rows(32, 32)
    g.put(0, 2, 'v' + 'w' * 30 + 'v')
    g.put(0, 3, 'v' + '6' * 30 + 'u')
    g.put(0, 4, 'u' + '5' * 30 + 't')
    g.put(0, 5, 't' * 32)
    for y in range(6, 28):
        g.put(1, y, 'u' + '3' * 28 + 's')
    for row in range(4):
        y = 7 + row * 5
        for col in range(3):
            x = 3 + col * 9
            g.put(x, y, '66666665')
            g.put(x, y + 1, '555X5554')
            g.put(x, y + 2, '554W4544')
            g.put(x, y + 3, '33333332')
    g.put(1, 27, 's' * 30)
    g.put(1, 28, 'r' * 30)
    g.put(2, 29, 'tsr')
    g.put(27, 29, 'srr')
    g.put(2, 30, 'tsr')
    g.put(27, 30, 'srr')
    g.put(1, 31, 'tsrr')
    g.put(26, 31, 'srrrr')
    g.block(3, 0, ['YXW....', '.X.WW..'])
    g.put(5, 1, 'X')
    g.block(20, 0, ['.RSR.RSR', 'QRRQPRQP'])
    g.shadow([(31, y) for y in range(6, 32)] + sh_run(29, 5, 26) + sh_run(30, 5, 26) + sh_run(31, 5, 25))
    return draw(g.done(), leg('song'), 32, 32, (2, 5),
                '줄 B · 주칠 틀 소나무 약재장: 큰 서랍 3열×4줄(금 고리 하나씩)·위에 금 약저울과 황토 약봉지. 줄 A 와 서랍 짜임이 다르다.')


# =============================================================================
# 20. 약탕 화로 (1×1)
# =============================================================================
def herb_stove_a1():
    rows = [
        "................",
        "......aa........",
        ".....bdcb.......",
        "....bdeedb...b..",
        "...bdeeddcbbcb..",
        "...cdddccccb....",
        "...bcccbbbbb....",
        "..RSSSSSSSSRQ...",
        "..QRRRRRRRQQP...",
        ".RSRRRRRRRQQPO..",
        ".RRQwvvvwQQPPO..",
        ".QQQvZYZvQPPON..",
        ".QQQtvwvtPPOON..",
        "..PPQQQQPPOON...",
        "..OPPPPPOOONN...",
        "...ON.....NN....",
    ]
    g = Rows(16, 16).block(0, 0, rows)
    g.shadow([(14, 10), (14, 11), (14, 12), (14, 13), (13, 14), (14, 14), (15, 14), (12, 15), (13, 15), (14, 15), (15, 15), (5, 15), (6, 15), (7, 15), (8, 15), (9, 15), (10, 15)])
    return draw(g.done(), leg('mu'), 16, 16, (7, 9),
                '줄 A · 황토 흙 화로(아가리 윗면·앞 불 구멍에 숯불 한 덩이) 위에 짙은 흙빛 약탕관(뚜껑 꼭지·오른쪽 부리).')


# =============================================================================
# 21. 전고(북) (2×2) — 북면 위로 붉은 몸통 윗면이 보이는 큰 북 + 소나무 받침
# =============================================================================
DRUM_FACE = [      # 20×17. 테 = 주칠(빛 v·그늘 t s) + 금 징(Y·X), 가죽 = 황토 밝은 단(빛 T S → 그늘 Q P)
    ".......vYvvYv.......",
    "....vYvvTTTTvvYu....",
    "...vvTTTTTTSSSSuu...",
    "..YvTTSSSSSSSSSSuY..",
    ".vvTSSSSSSSSSSSSRut.",
    ".vTSSSSSSSSSSSSRRRt.",
    "YvSSSSSSSSSSSSSRRRtX",
    "vSSSSSSSSSSSSRRRRRRt",
    "uSSSSSSSSSSSRRRRRRQs",
    "uSSSSSSSSSRRRRRRRQQs",
    "XuRRRRRRRRRRRRRQQQsX",
    ".uRRRRRRRRRRRRQQQQs.",
    ".utRRRRRRRRRRQQQQss.",
    "..XtQRRRRRRRQQQQsX..",
    "...ttQQQQQQQQPPss...",
    "....tXtsPPPPssXs....",
    ".......sXssX........",
]


def war_drum_a1():
    g = Rows(32, 32)
    # 받침(소나무): 북 양옆에 바짝 붙은 다리 둘 + 아래 가로대 둘
    for y in range(10, 32):
        g.put(4, y, '52')
        g.put(26, y, '42')
    g.put(3, 9, '654')
    g.put(25, 9, '653')
    g.put(4, 25, '5' * 24)
    g.put(4, 26, '2' * 24)
    g.put(4, 29, '4' * 24)
    g.put(4, 30, '1' * 24)
    g.put(3, 31, '321')
    g.put(25, 31, '3210')
    # 몸통 윗면(북면 위로 보이는 붉은 통) — 손으로 정한 폭, 금 징 한 줄
    g.put(9, 3, 'w' * 14)
    g.put(7, 4, 'v' + 'w' * 16 + 'v')
    g.put(6, 5, 'v' + ''.join('Y' if k % 4 == 1 else 'w' for k in range(18)) + 'u')
    g.put(6, 6, 'u' + 'v' * 18 + 't')
    g.block(6, 7, DRUM_FACE)
    # 북채 둘(아래 가로대에 걸침)
    g.put(7, 27, 'vuxxxxxq')
    g.put(17, 28, 'vuxxxxq')
    g.shadow(sh_run(27, 15, 27) + sh_run(28, 6, 16) + sh_run(31, 6, 24) + [(28, 29), (28, 30), (29, 31), (28, 31)])
    return draw(g.done(), leg('song'), 32, 32, (3, 6),
                '줄 A · 소나무 받침에 얹은 큰 붉은 북: 북면 위로 붉은 몸통 윗면(금 징 한 줄)이 보이고, 북면은 밝은 가죽 원 하나·테에 금 징. 북채 둘은 아래 가로대에.')


# =============================================================================
# 22. 징 틀 (2×2)
# =============================================================================
GONG = [           # 18×18. 테 = 청동 어두운 단, 몸 = 금빛 청동(빛 왼쪽 위), 가운데 젖꼭지 하나
    "......443333......",
    "....4455544433....",
    "...445566655433...",
    "..44566666555433..",
    ".4456666655554332.",
    ".4566665555544332.",
    "445666554455543322",
    "456665544665543322",
    "456655446654443322",
    "456655445544443322",
    "455655554444443322",
    "355555544444433221",
    ".3455544444433322.",
    ".3345444443333221.",
    "..33444433333221..",
    "...333333332221...",
    "....3322222211....",
    "......222111......",
]


def gong_frame_a1():
    g = Rows(32, 32)
    g.put(0, 1, 'f' + '.' * 30 + 'e')
    g.put(0, 2, 'ef' + 'f' * 28 + 'ed')
    g.put(1, 3, 'e' * 29 + 'd')
    g.put(1, 4, 'c' * 30)
    g.put(2, 5, 'b' * 28)
    for y in range(6, 30):
        g.put(3, y, 'edb')
        g.put(26, y, 'edb')
    for y in range(6, 9):
        g.put(10, y, 'P')
        g.put(21, y, 'P')
    g.block(7, 8, GONG)
    g.put(0, 29, 'feeeedc')
    g.put(0, 30, 'dccccba')
    g.put(0, 31, 'cbbbbaa')
    g.put(23, 29, 'feeeedc')
    g.put(23, 30, 'dccccba')
    g.put(23, 31, 'cbbbbaa')
    g.put(28, 18, 'jk')
    g.put(28, 19, 'ij')
    for y in range(20, 29):
        g.put(29, y, 'x' if y < 27 else 'q')
    g.shadow(sh_run(27, 10, 22) + sh_run(28, 11, 21) + sh_run(31, 7, 22) + [(30, 29), (31, 29), (30, 30), (31, 30), (31, 31)])
    return draw(g.done(), leg('jin'), 32, 32, (1, 4),
                '줄 A · 짙은 나무 틀(위 갓 끝이 들림)에 끈으로 매단 금빛 청동 징(원 하나·가운데 젖꼭지 하나)과 채.')


# =============================================================================
# 23. 문파 깃발 장대 (1×3)
# =============================================================================
def banner_pole_a1():
    g = Rows(16, 48)
    g.block(2, 0, ['.Z.', 'ZYX', '.X.'])
    g.put(2, 3, 'tu')
    g.put(1, 4, 'Y' + 'Z' * 12 + 'X')
    g.put(1, 5, 'X' + 'W' * 12 + 'V')
    for y in range(6, 41):
        g.put(2, y, 'vt')
    # 깃발: 붉은 비단(왼쪽 밝은 결 → 오른쪽 그늘), 위 금 띠·양옆 가는 금 테, 아래 톱니 술
    for y in range(6, 31):
        g.put(5, y, 'Y' + 'wvvuuuts' + 'W')
    g.put(5, 6, 'YZZZZZZYYX')
    g.put(5, 7, 'XYYYYYYXXW')
    for y in range(9, 29):
        g.put(7 + (y // 5) % 2, y, 'w')        # 접힌 결(밝은 줄이 한 칸씩 흔들린다)
        g.put(11, y, 't' if y % 4 else 's')
    g.put(5, 31, 'XWWWWWWWWV')
    g.put(5, 32, 'u.ut.ts.s.')
    g.put(5, 33, '.t..s..r..')
    g.put(3, 39, 'FGF')
    g.put(0, 40, '.FGGGGGGGF')
    g.put(0, 41, 'FFFFFFFFFE')
    g.put(0, 42, 'EEEEEEEEED')
    g.put(0, 43, 'DDDDDDDDDC')
    g.put(0, 44, 'DEDDDDDDDC')
    g.put(0, 45, 'CDCCCCCCCB')
    g.put(0, 46, 'BCBBBBBBBA')
    g.put(0, 47, 'BBBBBBBBBA')
    g.shadow([(10, y) for y in range(41, 48)] + [(11, y) for y in range(43, 48)] + [(15, y) for y in range(8, 32)])
    return draw(g.done(), leg('zhu'), 16, 48, (4, 6),
                '줄 A · 청석 받침에 세운 붉은 장대·금 보주와 금 가로대에 매단 붉은 비단 깃발(위 금 띠·접힌 결·톱니 술). 글자·문양 없음.')


# =============================================================================
# 24. 짐수레 (2×2) — 가로로 놓인 손수레(가까운 바퀴 하나가 앞면에 보인다)
# =============================================================================
WHEEL = [          # 14×14 짙은 나무 바퀴: 테(빛 e d · 그늘 b a)·살 넷·통
    "....eeeedc....",
    "..eed.dc.dcb..",
    ".ed...dc...cb.",
    ".e.d..dc..c.b.",
    "ed..d.dc.c..cb",
    "e....ddccc...b",
    "edddddefdcccbb",
    "dccccdedcbbbba",
    "d....ccbb....a",
    "dc..c.cb.b..ba",
    ".d.c..cb..b.a.",
    ".dc...cb...ba.",
    "..dcb.cb.bba..",
    "....dccbbaa...",
]


def hand_cart_a1():
    g = Rows(32, 32)
    g.put(1, 12, '5' + '6' * 22 + '5')
    g.put(1, 13, '5' + '6' * 22 + '5')
    g.put(1, 14, '5' + '5' * 22 + '4')
    g.put(1, 15, '4' * 23 + '3')
    for y in range(16, 21):
        g.put(1, y, '5' + ('4' if y != 18 else '3') * 22 + '2')
    g.put(1, 21, '2' * 24)
    g.put(24, 14, '6666665')
    g.put(24, 15, '3333332')
    for y in range(16, 32):
        g.put(26, y, '41')
    g.put(25, 31, '210')
    g.block(2, 4, ['..klk...', '.klmlkj.', 'klmmllkj', 'kllllkji', 'jkkkkjji', '.jjjjii.', '..hhhh..'])
    g.put(4, 6, 'RQ')
    g.block(10, 6, ['..RSR..', '.RSTSQ.', 'RSTSRQP', 'RSSRQPO', 'QRRQPPO', '.PPPOO.'])
    g.block(17, 7, ['efffffe', 'deeeeed', 'cdYddcb', 'cddddcb', 'bccccba'])
    g.block(7, 18, WHEEL)
    g.shadow(sh_run(30, 2, 6) + sh_run(31, 2, 10) + sh_run(31, 21, 24) + [(28, 30), (28, 31), (29, 31)])
    return draw(g.done(), leg('song'), 32, 32, (12, 15),
                '줄 A · 소나무 손수레(짐칸 윗면·앞 판, 오른쪽으로 손잡이와 받침 다리)에 흰 무명 자루·황토 삼베 자루·짙은 나무 상자. 가까운 바퀴 하나가 앞면에 보인다.')


# =============================================================================
# 25. 장작더미 (2×1) — 통나무 끝 나이테 + 도끼 박힌 모탕
# =============================================================================
LOG = ['.qxq.', 'qyRxp', 'xRQRp', 'qxRpo', '.ppo.']     # 통나무 끝 5×5: 껍질 테(소나무) 안 나이테(황토)


def firewood_pile_a1():
    g = Rows(32, 16)
    g.put(2, 0, 'q' + 'zyyyyyyyyyyyyyyy' + 'xq')     # 맨 위에 길게 누운 통나무(껍질 윗면이 밝다)
    g.put(1, 1, 'qx' + 'yxxxxxxxxxxxxxxx' + 'qp')
    g.put(1, 2, 'pq' + 'qqqqqqqqqqqqqqqq' + 'po')
    for x in (4, 9):
        g.block(x, 3, LOG)
    for x in (2, 7, 12):
        g.block(x, 6, LOG)
    for x in (0, 5, 10, 15):
        g.block(x, 10, LOG)
    g.put(0, 15, 'oooooooooooooooooooo')
    # 모탕: 넓은 그루터기 윗면(나이테) + 껍질 앞면, 도끼(쇠 날·소나무 자루)가 비스듬히 박혔다
    g.block(21, 8, [
        '.qxyyyyxq.',
        'qyzRSSRzxp',
        'pqyxxxxyqo',
        'p43p43p32o',
        'p4p34p3p2o',
        'o3p23p2p1n',
        'onnnnnnnnn',
        '.nnnnnnnn.',
    ])
    g.put(28, 3, 'q').put(27, 4, 'x').put(27, 5, 'x').put(26, 6, 'x').put(26, 7, 'q')
    g.block(23, 6, ['FGE', 'EFD', '.DC'])
    g.shadow(sh_run(15, 20, 20) + [(31, 11), (31, 12), (31, 13), (31, 14), (31, 15), (20, 13), (20, 14)])
    return draw(g.done(), leg('song'), 32, 16, (0, 2),
                '줄 A · 통나무 끝(나이테)이 보이게 아홉 개를 쌓고 맨 위에 하나를 길게 눕힌 장작(껍질 윗면)·오른쪽에 도끼가 비스듬히 박힌 넓은 모탕(윗면 나이테).')


# =============================================================================
# 대형 공용: 지붕 띠 — style-r1 A 수키와(8px 단위) · B 비늘 평기와를 우리 범례로 옮긴 주기 행.
#   먹(K)·wa 0단 자리는 wa 1단(H)·mu 1단(a, 처마 밑 그늘)로 바꿨다(외곽선 규칙).
# =============================================================================
TILE_A = {   # 수키와: 볼록 기와(빛 M L → 그늘 J) + 골(H I)
    'ridge': ['LMMLLMML', 'LLLLLLLL', 'JKKJJKKJ', 'IJJIIJJI', 'HHHHHHHH'],
    'slope': ['HMMLKHII', 'HLLKJHII', 'HLKKJHII', 'IJJIHHHH'] * 2,
    'eave': ['HJKKJHHH', 'KMLLKIHH', 'KLLLKIHH', 'JKKKJaHH', 'aJJJaaaa', 'aaaaaaaa', 'avuaavua', 'autaauta'],
}
TILE_B = {   # 비늘 평기와(단마다 반 장 어긋남) + 주칠 처마판·금 점
    'ridge': ['LLLLLLLL', 'KKKKKKKK', 'JJJIJJJI', 'IIIIIIII', 'HHHHHHHH'],
    'slope': ['HIIIIIIH', 'IJKKKKJI', 'JKLLLLKJ', 'IKLMLLKI', 'IIIHHIII', 'KJIJKKKK', 'LKJKLLLL', 'LKIKLMLL'],
    'eave': ['IKLLLLKI', 'HJKKKKJH', 'aHJJJJHa', 'aaHHHHaa', 'vvvvvvvv', 'uuuYYuuu', 'ssssssss', 'rrrrrrrr'],
}
DY_GATE = [6, 5, 4, 3, 3, 2, 2, 1, 1, 1]


def roof_band(g, x0, x1, y0, tile, ridge_in, dy=DY_GATE, ends='both', eave_rows=8, slope_rows=8):
    """x0~x1 폭 지붕: 용마루(ridge_in 만큼 안으로) · 사면 · 처마. 처마는 끝에서 dy 만큼 들린다(ends: both·left·right).
    무늬는 x0 기준 8px 주기(손으로 정한 주기 행). 사면 양 끝 2px 은 박공 띠(빛 쪽 밝게, 그늘 쪽 어둡게)."""
    y = y0
    for r in tile['ridge']:
        g.put(x0 + ridge_in, y, ''.join(r[(x - x0) % 8] for x in range(x0 + ridge_in, x1 - ridge_in + 1)))
        y += 1
    ys = y
    for r in tile['slope'][:slope_rows]:
        g.put(x0, y, ''.join(r[(x - x0) % 8] for x in range(x0, x1 + 1)))
        g.put(x0, y, 'LK')
        g.put(x1 - 1, y, 'IH')
        y += 1
    ye = y
    for x in range(x0, x1 + 1):
        kl, kr = x - x0, x1 - x
        k = min(kl, kr) if ends == 'both' else (kl if ends == 'left' else kr)
        d = dy[k] if k < len(dy) else 0
        for j, r in enumerate(tile['eave'][:eave_rows]):
            g.put(x, ye + j - d, r[(x - x0) % 8])
        for j in range(d):
            g.r[ye + eave_rows - d + j][x] = '.'
    return ys, ye + eave_rows


CHIWEN_L = ['M....', 'LM...', '.KL..', '.JKLL', '..JKK', '..IJJ']
CHIWEN_R = ['....L', '...LK', '..KJ.', 'LKJI.', 'KJI..', 'JIH..']


# =============================================================================
# 26. 산문 패루 (6×5) — 세 칸 패루, 가운데 두 칸이 문간
# =============================================================================
def sect_gate_a1():
    g = Rows(96, 80)
    # 그리는 순서(깊이): 옆 칸 지붕 → 기둥 → 보·두공 → 가운데 지붕 → 편액 → 난간·받침
    side = {'ridge': TILE_A['ridge'][:3], 'slope': TILE_A['slope'], 'eave': TILE_A['eave']}
    roof_band(g, 0, 31, 30, side, 4, dy=[5, 4, 3, 3, 2, 2, 1, 1, 1], ends='left', slope_rows=4)
    roof_band(g, 64, 95, 30, side, 4, dy=[5, 4, 3, 3, 2, 2, 1, 1, 1], ends='right', slope_rows=4)
    g.block(0, 27, ['L..', 'ML.', '.KL'])
    g.block(93, 27, ['..K', '.KJ', 'KJ.'])
    # 기둥(주칠 둥근 기둥: 빛 w v → 그늘 t s) — 옆 지붕 앞을 지나 가운데 지붕 밑까지
    for y in range(24, 72):
        g.put(24, y, 'wvvuuts')
        g.put(65, y, 'wvvuuts')
    for y in range(40, 72):
        g.put(3, y, 'wvuts')
        g.put(88, y, 'wvuts')
    for x in (24, 65):
        g.put(x, 50, 'ZYYXXWV')
        g.put(x, 51, 'XWWVVVU')
    # 옆 칸 보(주칠)
    for x0 in (8, 72):
        g.put(x0, 46, 'v' * 16)
        g.put(x0, 47, 'u' * 16)
        g.put(x0, 48, 's' * 16)
    # 가운데 큰 지붕 + 치미
    roof_band(g, 12, 83, 4, TILE_A, 8)
    g.block(17, 1, CHIWEN_L)
    g.block(74, 1, CHIWEN_R)
    # 두공 띠(주칠 받침·청록 판·금 점)
    for y, pat in ((25, 'vwvaKLKa'), (26, 'uvuaJKJa'), (27, 'tutaIJIa'), (28, 'aYaaaaYa')):
        g.put(20, y, ''.join(pat[(x - 20) % 8] for x in range(20, 76)))
    # 큰 보(채색): 윗면 청록·금 점 띠·주칠 아래띠
    for y, pat in ((29, 'LLLLLLLL'), (30, 'KYKJJKYK'), (31, 'JKLKJIJK'), (32, 'IJKJIHIJ'), (33, 'vvvvvvvv'), (34, 'ssssssss')):
        g.put(24, y, ''.join(pat[(x - 24) % 8] for x in range(24, 72)))
    # 아래 보(주칠)
    g.put(31, 40, 'w' * 34)
    g.put(31, 41, 'v' * 34)
    g.put(31, 42, 'u' * 34)
    g.put(31, 43, 's' * 34)
    # 편액(금 테 · 청 바탕에 안쪽 빛 테, 글자 없음)
    g.put(38, 21, '.ZYYYYYYYYYYYYYYYYX.')
    g.put(38, 22, 'ZYXXXXXXXXXXXXXXXXWV')
    g.put(38, 23, 'YXLLLLLLLLLLLLLLLKWV')
    for y in range(24, 32):
        g.put(38, y, 'YXLKKKKKKKKKKKKKKJWV')
    g.put(38, 32, 'YXKJJJJJJJJJJJJJJJWV')
    g.put(38, 33, 'XWWWWWWWWWWWWWWWWWWV')
    g.put(38, 34, '.VVVVVVVVVVVVVVVVVV.')
    # 옆 칸 돌난간(청석)
    for x0 in (8, 72):
        g.put(x0, 56, 'F' + 'G' * 14 + 'E')
        g.put(x0, 57, 'E' + 'F' * 14 + 'D')
        g.put(x0, 58, 'D' * 15 + 'C')
        for y in range(59, 68):
            edge = y in (59, 67)
            g.put(x0, y, 'DE' + ('DDDDD' if edge else 'DCCCD') + 'DE' + ('DDDDD' if edge else 'DCCCD') + 'DC')
        g.put(x0, 68, 'D' * 15 + 'C')
        g.put(x0, 69, 'C' * 15 + 'B')
        g.put(x0, 70, 'B' * 16)
        g.put(x0, 71, 'B' * 16)
    # 기둥 받침돌(청석 북 모양)
    for x0, w in ((22, 11), (63, 11), (1, 9), (86, 9)):
        g.put(x0, 70, '.' + 'G' * (w - 3) + 'F.')
        g.put(x0, 71, 'F' + 'G' * (w - 3) + 'FE')
        g.put(x0, 72, 'E' + 'F' * (w - 3) + 'ED')
        for y in range(73, 77):
            g.put(x0, y, 'D' + 'E' * (w - 4) + 'DDC')
        g.put(x0, 77, 'C' + 'D' * (w - 3) + 'CB')
        g.put(x0, 78, 'B' + 'C' * (w - 3) + 'BB')
        g.put(x0, 79, 'B' * (w - 1) + 'A')
        g.shadow([(x0 + w, y) for y in range(73, 80)] + [(x0 + w + 1, y) for y in range(76, 80)])
    g.shadow(sh_run(72, 9, 21) + sh_run(73, 10, 21) + sh_run(72, 75, 85) + sh_run(73, 76, 85))
    return draw(g.done(), leg('shi'), 96, 80, (4, 6),
                '줄 A · 세 칸 패루: 주칠 둥근 기둥 넷(가운데 둘 크게, 금 띠)·청석 북 받침·채색 큰 보(청록·금 점)·두공 띠·가운데 금 테 편액(글자 없음)·청회 수키와 지붕 셋(가운데 높게, 치미, 추녀 들림)·옆 칸 돌난간. 가운데 두 칸으로 지나간다.')


# =============================================================================
# 27. 석조 육각 정자 (5×5) — 앞 세 면이 보이는 육각 지붕 + 청석 기단(앞 계단)
# =============================================================================
# 지붕 면 경계(행: 왼 바깥, 앞면 시작, 앞면 끝, 오른 바깥) — 손으로 정한 표. 왼 면 = 빛(밝은 기와), 앞 = 보통, 오른 = 그늘
HEX_ROOF = {
    8: (34, 36, 43, 45), 9: (32, 35, 44, 47), 10: (30, 34, 45, 49), 11: (28, 33, 46, 51), 12: (26, 32, 47, 53),
    13: (24, 31, 48, 55), 14: (22, 30, 49, 57), 15: (20, 29, 50, 59), 16: (18, 27, 52, 61), 17: (16, 26, 53, 63),
    18: (14, 25, 54, 65), 19: (12, 24, 55, 67), 20: (10, 22, 57, 69), 21: (8, 21, 58, 71), 22: (6, 20, 59, 73),
    23: (5, 19, 60, 74), 24: (4, 18, 61, 75),
}
HEX_FACE = {    # 면마다 8px 주기 기와 무늬 4행 — 왼 면은 한 단 밝게, 오른 면은 한 단 어둡게
    'L': ['IMMLLIJJ', 'ILLLKIJJ', 'ILLKKIJJ', 'JKKJIIII'],
    'F': ['HMMLKHII', 'HLLKJHII', 'HLKKJHII', 'IJJIHHHH'],
    'R': ['HLLKJHHI', 'HKKJIHHI', 'HKJJIHHI', 'HIIHHHHH'],
}
# 처마 들림(열 x → 들린 행 수): 양 끝 추녀(1·78) 7, 앞 모서리(18·61) 2 — 손으로 정한 표
HEX_EAVE_DY = {x: max(0, 7 - (x - 1) // 2) for x in range(1, 15)}
HEX_EAVE_DY.update({x: max(0, 7 - (78 - x) // 2) for x in range(65, 79)})
HEX_EAVE_DY.update({16: 1, 17: 2, 18: 2, 19: 2, 20: 1, 59: 1, 60: 2, 61: 2, 62: 2, 63: 1})


def stone_pavilion_a1():
    g = Rows(80, 80)
    # 기단(청석 육각): 윗면 56~62(밝게), 앞 세 면 63~74(왼 면 밝게·가운데·오른 면 그늘), 가운데 계단 63~79
    plat = {56: (14, 65), 57: (12, 67), 58: (10, 69), 59: (8, 71), 60: (7, 72), 61: (6, 73), 62: (6, 73)}
    for y, (a, b) in plat.items():
        g.put(a, y, 'G' * (b - a + 1))
        g.put(a, y, 'F')
        g.put(b, y, 'E')
    g.put(6, 62, 'E' * 68)
    front = {63: (6, 18, 61, 73), 64: (6, 18, 61, 73), 65: (7, 19, 60, 72), 66: (7, 19, 60, 72), 67: (8, 20, 59, 71),
             68: (8, 20, 59, 71), 69: (9, 21, 58, 70), 70: (9, 21, 58, 70), 71: (10, 22, 57, 69), 72: (10, 22, 57, 69),
             73: (11, 23, 56, 68), 74: (12, 24, 55, 67)}
    for y, (a, b, c, d) in front.items():
        joint = y in (66, 70)
        g.put(a, y, ('E' if joint else 'F') * (b - a))
        g.put(b, y, ('D' if joint else 'E') * (c - b))
        g.put(c, y, ('B' if joint else 'C') * (d - c + 1))
        g.put(c, y, 'D')
    for y in (73, 74):
        g.put(front[y][0], y, 'D' * (front[y][3] - front[y][0] + 1))
    for k, y in enumerate(range(63, 80)):     # 계단: 디딤 윗면(밝음)·챌면(어두움)
        g.put(31, y, ('G' if k % 3 == 0 else 'E' if k % 3 == 1 else 'C') * 18)
        g.put(31, y, 'F')
        g.put(48, y, 'C')
    g.put(31, 79, 'B' * 18)
    # 뒤 기둥 둘(그늘) · 앞 기둥 넷(주칠)
    for y in range(33, 56):
        g.put(22, y, 'tsr')
        g.put(55, y, 'tsr')
    for y in range(33, 62):
        for x in (12, 64):
            g.put(x, y, 'wvut')
    for y in range(33, 63):
        for x in (30, 46):
            g.put(x, y, 'wvut')
    # 앞 난간(소나무 미인고 등받이) — 가운데 앞은 트였다
    for x0, x1 in ((16, 29), (50, 63)):
        g.put(x0, 49, 'y' * (x1 - x0 + 1))
        g.put(x0, 50, 'x' * (x1 - x0 + 1))
        for y in range(51, 56):
            g.put(x0, y, ''.join('q' if (x - x0) % 3 == 0 else '.' for x in range(x0, x1 + 1)))
        g.put(x0, 56, 'x' * (x1 - x0 + 1))
        g.put(x0, 57, 'p' * (x1 - x0 + 1))
    # 두공·처마도리 띠
    for y, pat in ((32, 'vwvaKLKa'), (33, 'uvuaJKJa'), (34, 'aYaaaaYa')):
        g.put(10, y, ''.join(pat[(x - 10) % 8] for x in range(10, 70)))
    # 지붕: 면 셋(왼·앞·오른) + 갈마루(면 사이 밝은 줄)
    for y, (a, b, c, d) in HEX_ROOF.items():
        k = y % 4
        g.put(a, y, ''.join(HEX_FACE['L'][k][(x - a) % 8] for x in range(a, b)))
        g.put(b, y, ''.join(HEX_FACE['F'][k][(x - b) % 8] for x in range(b, c + 1)))
        g.put(c + 1, y, ''.join(HEX_FACE['R'][k][(x - c) % 8] for x in range(c + 1, d + 1)))
        g.put(a, y, 'L')
        g.put(b - 1, y, 'MM')
        g.put(c, y, 'LK')
        g.put(d, y, 'I')
    # 처마(25~31): 앞 세 면 아래 띠, 양 끝 추녀·앞 모서리가 들린다
    eave = ['KMLLKIHH', 'KLLLKIHH', 'JKKKJaHH', 'aJJJaaaa', 'aaaaaaaa', 'avuaavua', 'autaauta']
    for x in range(2, 78):
        d = HEX_EAVE_DY.get(x, 0)
        for j, r in enumerate(eave):
            g.put(x, 25 + j - d, r[x % 8])
    g.block(0, 15, ['M.', 'LM', '.L'])
    g.block(78, 15, ['.K', 'KJ', 'J.'])
    # 보주(금)와 꼭대기
    g.block(37, 0, ['..Z...', '.ZYX..', '.YXW..', '..W...', '.LMK..', 'LMMLK.', 'KLLKJ.', '.JJI..'])
    g.shadow([(74, y) for y in range(63, 75)] + [(75, y) for y in range(64, 76)] + [(49, y) for y in range(64, 80)] + [(50, y) for y in range(66, 80)]
             + sh_run(75, 12, 30) + sh_run(75, 49, 68) + sh_run(76, 13, 30) + sh_run(76, 51, 69))
    return draw(g.done(), leg('shi'), 80, 80, (12, 30),
                '줄 A · 석조 육각 정자: 청석 육각 기단(밝은 윗면·앞 세 면·가운데 계단)·주칠 기둥(앞 넷, 뒤 둘은 그늘)·소나무 난간·두공 띠·청회 수키와 육각 지붕(왼 면 밝게·오른 면 그늘, 추녀 넷이 들림)·금 보주.')


# =============================================================================
# 28. 대형 청동 정 (4×4) — 선 귀 둘·넓은 아가리·기하 띠·세 발 + 청석 받침
# =============================================================================
DING_BODY = {   # 행: (왼, 오른) — 위가 넓고 아래로 둥글게. 손으로 정한 폭
    19: (8, 55), 20: (7, 56), 21: (7, 56), 22: (7, 56), 23: (7, 56), 24: (7, 56), 25: (7, 56), 26: (7, 56),
    27: (7, 56), 28: (8, 55), 29: (8, 55), 30: (9, 54), 31: (10, 53), 32: (11, 52), 33: (13, 50), 34: (15, 48), 35: (18, 45), 36: (22, 41),
}


def bronze_ding_a1():
    g = Rows(64, 64)
    # 받침(청석): 윗면 46~50, 앞 51~60(오목 판 둘), 굽 61~63
    g.put(3, 46, '.' + 'G' * 56 + '.')
    g.put(3, 47, 'F' + 'G' * 56 + 'F')
    g.put(3, 48, 'F' * 57 + 'E')
    g.put(3, 49, 'E' * 57 + 'D')
    g.put(3, 50, 'D' * 58)
    for y in range(51, 60):
        inner = y not in (51, 59)
        g.put(3, y, 'E' + 'DDDD' + ('C' + 'D' * 21 + 'CC' + 'D' * 21 + 'C' if inner else 'C' * 47) + 'DDD' + 'C')
    g.put(3, 60, 'C' * 57 + 'B')
    g.put(2, 61, 'D' + 'C' * 58 + 'B')
    g.put(2, 62, 'C' + 'B' * 58 + 'A')
    g.put(2, 63, 'B' * 59 + 'A')
    # 세 발: 뒤 발(가운데, 그늘) 먼저
    for y in range(36, 46):
        g.put(29, y, '22111')
    for y in range(36, 48):
        g.put(13, y, '454332')
        g.put(45, y, '443221')
    g.put(12, 47, '45543321')
    g.put(44, 47, '44332211')
    # 몸통(배): 왼쪽 위 빛 → 오른쪽 그늘. 아래쪽 행은 한 단 어둡게
    for y, (a, b) in DING_BODY.items():
        row = ''.join('5' if x - a < 2 else '4' if x - a < 12 else '3' if x - a < 32 else '2' for x in range(a, b + 1))
        if y >= 33:
            row = row.replace('3', '2').replace('4', '3').replace('5', '4')
        g.put(a, y, row)
        g.put(b, y, '1')
    # 기하 띠(꺾쇠 줄) 22~25 — 얼굴 무늬(도철) 없음
    band = ['YXXYXXYXXYXXYXXYXXYXXYXXYXXYXXYXXYXXYXXYXXYXXYXX',
            'X2X2XX2X2XX2X2XX2X2XX2X2XX2X2XX2X2XX2X2XX2X2XX2X',
            '2X2X22X2X22X2X22X2X22X2X22X2X22X2X22X2X22X2X22X2',
            'WVVWVVWVVWVVWVVWVVWVVWVVWVVWVVWVVWVVWVVWVVWVVWVV']
    for j, r in enumerate(band):
        g.put(8, 22 + j, r)
    # 아가리(윗면): 금 테, 안은 재(청석)·향 셋
    g.put(10, 13, 'Y' * 44)
    g.put(8, 14, 'YY' + 'X' * 44 + 'WV')
    g.put(7, 15, 'YX' + 'BBCCCCCCCDDDDDDDDDDDDDDDDDDDDDDDCCCCCCCCBB' + 'WV')
    g.put(7, 16, 'X4' + 'BCCDDDDDDDDEEEEEEEEEEEEEEEEEEEDDDDDDDDDCCB' + '2V')
    g.put(7, 17, 'X4' + 'CDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDC' + '2U')
    g.put(7, 18, '4' * 4 + '3' * 30 + '2' * 12 + '1' * 2)
    for x in (27, 31, 35):
        g.put(x, 9, 'w')
        for y in range(10, 16):
            g.put(x, y, 't' if y < 14 else 's')
    # 선 귀 둘(네모 고리, 가운데 구멍은 투명)
    for x0 in (12, 45):
        g.put(x0, 3, 'YYYYYX')
        g.put(x0, 4, 'Y5554W')
        g.put(x0, 5, 'X4..3V')
        for y in range(6, 11):
            g.put(x0, y, 'X4..2V')
        g.put(x0, 11, 'X4332V')
        g.put(x0, 12, 'W3221U')
    g.shadow([(61, y) for y in range(49, 64)] + [(62, y) for y in range(52, 64)])
    return draw(g.done(), leg('jin'), 64, 64, (13, 16),
                '줄 A · 청석 받침 위 세 발 청동 큰 정: 선 네모 귀 둘·넓은 아가리(금 테·재·향 셋)·배에 꺾쇠 띠(얼굴 무늬 없음)·굵은 발 셋(뒤 발은 그늘). 몸은 어두운 청동, 빛 쪽만 금빛.')


CANDIDATES = {
    'prop_weapon_rack': {'A1': weapon_rack_a1, 'B1': weapon_rack_b1},
    'prop_archery_target': {'A1': archery_target_a1},
    'prop_sandbag_frame': {'A1': sandbag_frame_a1},
    'prop_meditation_mats': {'A1': meditation_mats_a1},
    'prop_stone_lions': {'A1': stone_lions_a1},
    'prop_stone_lantern': {'A1': stone_lantern_a1},
    'prop_stele': {'A1': stele_a1},
    'prop_censer_small': {'A1': censer_small_a1},
    'prop_bamboo_pot': {'A1': bamboo_pot_a1},
    'prop_bamboo_thicket': {'A1': bamboo_thicket_a1},
    'prop_plum_bonsai': {'A1': plum_bonsai_a1},
    'prop_garden_rock': {'A1': garden_rock_a1},
    'prop_well': {'A1': well_a1},
    'prop_water_jar': {'A1': water_jar_a1},
    'prop_tea_table': {'A1': tea_table_a1, 'B1': tea_table_b1},
    'prop_writing_desk': {'A1': writing_desk_a1, 'B1': writing_desk_b1},
    'prop_folding_screen': {'A1': folding_screen_a1, 'B1': folding_screen_b1},
    'prop_scroll_shelf': {'A1': scroll_shelf_a1, 'B1': scroll_shelf_b1},
    'prop_medicine_cabinet': {'A1': medicine_cabinet_a1, 'B1': medicine_cabinet_b1},
    'prop_herb_stove': {'A1': herb_stove_a1},
    'prop_war_drum': {'A1': war_drum_a1},
    'prop_gong_frame': {'A1': gong_frame_a1},
    'prop_banner_pole': {'A1': banner_pole_a1},
    'prop_hand_cart': {'A1': hand_cart_a1},
    'prop_firewood_pile': {'A1': firewood_pile_a1},
    'prop_sect_gate': {'A1': sect_gate_a1},
    'prop_stone_pavilion': {'A1': stone_pavilion_a1},
    'prop_bronze_ding': {'A1': bronze_ding_a1},
}
