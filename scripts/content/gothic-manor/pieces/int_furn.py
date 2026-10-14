"""실내 가구 — 서재·홀·침실·식당·부엌·지하·예배당. 모두 윗면(깨끗한 밝은 판, 뒤로 물러나는 이음)이 넓게 보이는 3/4 시점."""
import os, sys, math, random
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
from gmlib import REG, Cv, K, run_module   # noqa: E402
from gmdraw import *                         # noqa: E402,F403

MODULE = 'int_furn'
BOOK = ('velvet', 'slate', 'teal', 'wood', 'violet', 'gold')


def books(c, x0, y0, w, h, seed=0):
    """책장 한 칸: 높이가 다른 책등 줄(위에서 오는 빛은 책 머리 한 줄)."""
    rnd = random.Random(seed); x = x0
    c.R(x0, y0, w, h, K('wood', 1))
    while x < x0 + w - 1:
        bw = rnd.choice((1, 2, 2, 3)); bh = h - rnd.randint(0, 3); m = rnd.choice(BOOK)
        if x + bw > x0 + w: bw = x0 + w - x
        if rnd.random() < .12: x += bw; continue                      # 빈 자리
        c.R(x, y0 + h - bh, bw, bh, K(m, 3)); c.HL(x, y0 + h - bh, bw, K(m, 5)); c.VL(x + bw - 1, y0 + h - bh + 1, bh - 1, K(m, 2))
        if bh > 4: c.P(x, y0 + h - bh + 2, K('gold', 4))
        x += bw


@REG.piece('gm-bookshelf', '높은 오크 책장(먼지 쌓인 윗판)', 2, 3, ['CC', 'SS', 'SS'], 'furniture', 'library', role='prop', kind='tall_furniture',
           tags=['책장', '서가', '서재'], desc='천장 가까이 닿는 어두운 오크 책장: 넓은 윗판(먼지·촛대), 네 칸 선반에 빛바랜 책, 아래 장식 받침.',
           rules='북벽 앞에 2~4개를 이어 붙인다. 서재·도서실.')
def _bookshelf(c):
    slab(c, 0, 0, 32, 6, 0, m='wood', t=5, seams=6)
    c.R(4, 1, 2, 3, K('bone', 6)); c.P(4, 0, K('glow', 5))                      # 윗판의 초
    c.R(0, 6, 32, 42, K('wood', 2)); c.VL(0, 6, 42, K('wood', 4)); c.VL(1, 6, 42, K('wood', 3)); c.VL(30, 6, 42, K('wood', 2)); c.VL(31, 6, 42, K('wood', 1))
    c.HL(0, 6, 32, K('wood', 4)); c.HL(0, 7, 32, K('wood', 3))
    for k, y in enumerate((9, 18, 27, 36)):
        books(c, 2, y, 28, 8, seed=k * 7 + 3)
        c.HL(2, y + 8, 28, K('wood', 4))
    c.R(0, 44, 32, 4, K('wood', 2)); c.HL(0, 44, 32, K('wood', 4)); c.HL(0, 47, 32, K('wood', 1))
    finish(c)


@REG.piece('gm-desk', '서재 책상(촛대·펼친 책·깃펜)', 2, 2, ['SS', 'SS'], 'furniture', 'library', role='prop', kind='low_furniture',
           tags=['책상', '서재'], desc='가죽 깐 넓은 윗판(촛대·펼친 책·잉크병·깃펜) + 서랍 달린 앞면, 짧은 다리.',
           rules='서재 창 아래·방 가운데. 의자(gm-chair)를 남쪽에 붙인다.')
def _desk(c):
    slab(c, 0, 4, 32, 12, 14, m='wood', t=5, fb=2, seams=0)
    c.R(3, 6, 26, 8, K('teal', 2)); c.HL(3, 6, 26, K('teal', 1))                 # 가죽 깔판
    c.R(12, 7, 11, 6, K('paper', 5)); c.VL(17, 7, 6, K('paper', 3)); c.HL(13, 9, 3, K('paper', 3)); c.HL(19, 10, 3, K('paper', 3))
    c.R(5, 0, 2, 9, K('bone', 6)); c.P(5, 0, K('glow', 6)); c.R(4, 9, 4, 2, K('gold', 4))
    c.R(25, 8, 3, 3, K('ink', 2)); c.line(26, 7, 29, 2, K('bone', 5))
    for x in (3, 17): c.R(x, 19, 12, 5, K('wood', 3)); c.HL(x, 19, 12, K('wood', 4)); c.P(x + 6, 21, K('gold', 5))
    c.R(1, 28, 3, 4, K('wood', 1)); c.R(28, 28, 3, 4, K('wood', 1))
    finish(c)


@REG.piece('gm-chair', '높은 등받이 나무 의자', 1, 1, ['S'], 'furniture', 'hall', role='prop', kind='seat',
           tags=['의자', '식당'], desc='고딕 첨두 등받이 의자(붉은 벨벳 앉는 판이 위에서 보임).', rules='탁자·책상 남쪽에 붙인다.')
def _chair(c):
    c.R(3, 0, 10, 6, K('wood', 3)); c.HL(3, 0, 10, K('wood', 5)); c.P(8, 0, K('wood', 6)); c.R(5, 2, 6, 3, K('velvet', 3))
    slab(c, 2, 6, 12, 6, 2, m='velvet', t=4, fb=2, seams=0)
    c.VL(2, 6, 8, K('wood', 3)); c.VL(13, 6, 8, K('wood', 2))
    c.R(2, 14, 2, 2, K('wood', 2)); c.R(12, 14, 2, 2, K('wood', 1))
    finish(c)


@REG.piece('gm-armchair', '날개 등받이 안락의자(붉은 벨벳)', 1, 2, ['C', 'S'], 'furniture', 'library', role='prop', kind='seat',
           tags=['안락의자', '의자', '서재'], desc='높은 날개 등받이 붉은 벨벳 안락의자: 둥근 팔걸이 윗면·두툼한 앉는 판이 보인다, 금 단추.',
           rules='벽난로 앞에 한 쌍(서로 마주 보게 깔개 위).')
def _armchair(c):
    c.R(2, 1, 12, 16, K('velvet', 3)); c.HL(2, 1, 12, K('velvet', 5)); c.HL(3, 0, 10, K('velvet', 4))
    c.VL(2, 2, 15, K('velvet', 4)); c.VL(13, 2, 15, K('velvet', 2))
    for (x, y) in ((5, 5), (8, 5), (11, 5), (6, 9), (10, 9)): c.P(x, y, K('gold', 4))
    for x0 in (0, 12):                                                            # 팔걸이: 둥근 윗면
        slab(c, x0, 12, 4, 4, 10, m='velvet', t=5, fb=2, seams=0)
    slab(c, 4, 15, 8, 7, 5, m='velvet', t=4, fb=2, seams=0)                       # 앉는 판
    c.R(1, 27, 2, 4, K('wood', 2)); c.R(13, 27, 2, 4, K('wood', 1))
    finish(c)


@REG.piece('gm-sofa', '긴 소파(낡은 벨벳·쿠션 셋)', 3, 2, ['CCC', 'SSS'], 'furniture', 'hall', role='prop', kind='seat',
           tags=['소파', '응접실'], desc='곡선 나무 테 붉은 벨벳 긴 소파: 등받이·팔걸이 윗면, 쿠션 셋, 한쪽 찢어진 천.',
           rules='응접실 벽 앞·깔개 둘레.')
def _sofa(c):
    c.R(2, 2, 44, 14, K('velvet', 3)); c.HL(2, 2, 44, K('velvet', 5)); c.HL(4, 1, 40, K('wood', 4)); c.HL(4, 0, 40, K('wood', 5))
    for x in (12, 24, 36): c.VL(x, 4, 10, K('velvet', 2))
    for x0 in (0, 42): slab(c, x0, 10, 6, 5, 12, m='velvet', t=5, fb=2, seams=0)
    slab(c, 6, 14, 36, 8, 5, m='velvet', t=4, fb=2, seams=12)
    c.line(30, 17, 34, 20, K('paper', 4)); c.P(32, 18, K('ink', 1))
    for x in (3, 43): c.R(x, 27, 2, 4, K('wood', 2))
    finish(c)


@REG.piece('gm-clock', '괘종시계(멈춘 바늘)', 1, 3, ['C', 'C', 'S'], 'furniture', 'hall', role='prop', kind='tall_furniture',
           tags=['괘종시계', '시계', '홀'], desc='키 큰 흑단 괘종시계: 첨두 갓 윗면, 둥근 상아 문자판(자정에 멈춘 바늘), 유리 너머 놋쇠 추, 넓은 받침.',
           rules='홀·계단참 벽 앞에 하나.')
def _clock(c):
    slab(c, 1, 0, 14, 5, 0, m='wood', t=4, seams=0)
    c.R(1, 5, 14, 42, K('wood', 2)); c.VL(1, 5, 42, K('wood', 3)); c.VL(14, 5, 42, K('wood', 1))
    c.ellipse(8, 12, 5, 5, K('bone', 5)); c.ellipse(8, 12, 5, 5, K('gold', 3), fill=False)
    c.VL(8, 8, 4, K('ink', 1)); c.VL(8, 9, 3, K('ink', 1)); c.P(8, 12, K('velvet', 3))
    for a in range(12):
        c.P(int(8 + math.cos(a * math.pi / 6) * 3.6), int(12 + math.sin(a * math.pi / 6) * 3.6), K('ink', 2))
    c.R(4, 20, 8, 20, K('glass', 1)); c.HL(4, 20, 8, K('wood', 4)); c.VL(8, 21, 13, K('gold', 3)); c.ellipse(8, 35, 2.5, 2.5, K('gold', 4)); c.P(5, 22, K('glass', 4))
    slab(c, 0, 41, 16, 3, 4, m='wood', t=4, fb=2, seams=0)
    finish(c)


@REG.piece('gm-piano', '그랜드 피아노(열린 덮개)', 3, 2, ['SSS', 'SSS'], 'furniture', 'hall', role='prop', kind='low_furniture',
           tags=['피아노', '음악', '홀'], desc='검은 그랜드 피아노: 위에서 보이는 곡선 몸통 윗면과 비스듬히 열린 덮개(속 금 현), 앞쪽 상아 건반, 의자.',
           rules='홀·응접실 창가. 남쪽(건반 앞)을 한 칸 비운다.')
def _piano(c):
    pts = [(2, 6), (30, 4), (40, 8), (46, 16), (44, 22), (2, 22)]
    c.poly(pts, K('ink', 2))
    c.poly([(4, 8), (29, 6), (38, 10), (43, 16), (41, 19), (4, 19)], K('gold', 2))   # 열린 속(금 현)
    for x in range(8, 40, 3): c.line(x, 8, x + 2, 18, K('gold', 4))
    c.line(4, 7, 34, 0, K('ink', 3)); c.line(34, 0, 44, 10, K('ink', 3)); c.line(4, 8, 34, 1, K('iron', 4))     # 받침대로 연 덮개
    c.line(28, 3, 30, 12, K('iron', 3))
    c.R(2, 22, 44, 3, K('ink', 1)); c.HL(2, 22, 44, K('iron', 3))
    c.R(4, 23, 40, 3, K('bone', 6))
    for x in range(5, 44, 3): c.R(x, 23, 1, 2, K('ink', 1))
    c.R(2, 26, 44, 2, K('ink', 2)); c.R(3, 28, 2, 4, K('ink', 1)); c.R(43, 28, 2, 4, K('ink', 1))
    finish(c)


@REG.piece('gm-candelabra', '서 있는 촛대(깜빡임 3프레임)', 1, 2, ['C', 'S'], 'furniture', 'hall', role='prop', kind='column',
           frames=3, fps=5, tags=['촛대', '촛불', '애니메이션'], desc='키 큰 무쇠 촛대: 세 갈래에 촛농 흘러내린 초 셋(불꽃이 일렁인다), 넓은 세 발 받침.',
           rules='방 구석·문 양옆·식탁 끝. 어두운 방의 빛.')
def _candelabra(c, f):
    c.ellipse(8, 28, 6.5, 2.8, K('iron', 1)); c.ellipse(8, 27, 6.5, 2.8, K('iron', 5)); c.ellipse(7, 26.5, 3, 1, K('iron', 6))   # 둥근 받침 윗면
    c.R(7, 12, 2, 15, K('iron', 3)); c.VL(7, 12, 15, K('iron', 5))
    c.ellipse(8, 10, 7.5, 3.6, K('iron', 1)); c.ellipse(8, 9.4, 7.5, 3.4, K('iron', 5)); c.ellipse(8, 9.4, 5.5, 2.2, K('iron', 6))  # 촛농 받이 둥근 쟁반 윗면
    for x in (4, 8, 12):
        y0 = 8 if x != 8 else 7
        c.R(x - 1, y0 - 4, 2, 5, K('bone', 6)); c.P(x, y0, K('bone', 4))
        fx = x - 1 + (1 if (f + x) % 3 == 1 else 0)
        c.P(fx, y0 - 5, K('glow', 6 if f != 2 else 5)); c.P(fx + (1 if f == 2 else 0), y0 - 6, K('glow', 4))
    finish(c)


@REG.piece('gm-table-round', '작은 둥근 탁자(차 쟁반)', 1, 1, ['S'], 'furniture', 'hall', role='prop', kind='low_furniture',
           tags=['탁자', '차'], desc='외다리 둥근 탁자: 넓은 둥근 윗판에 찻잔과 식은 찻주전자.', rules='안락의자 곁.')
def _table_round(c):
    c.ellipse(8, 6, 7.5, 5, K('wood', 5)); c.ellipse(8, 6, 7.5, 5, K('wood', 6), fill=False)
    for x in range(1, 16):
        dx = (x + .5 - 8) / 7.5; yb = int(6 + 5 * math.sqrt(max(0, 1 - dx * dx)))
        c.P(x, yb, K('wood', 3)); c.P(x, yb + 1, K('wood', 2))
    c.ellipse(6, 5, 2.5, 2, K('bone', 5)); c.P(6, 3, K('bone', 6)); c.R(10, 5, 3, 2, K('bone', 6)); c.P(11, 5, K('ink', 2))
    c.R(7, 12, 2, 3, K('wood', 2)); c.HL(4, 15, 8, K('wood', 1))
    finish(c)


@REG.piece('gm-bed', '사주식 침대(찢긴 휘장)', 2, 3, ['CC', 'SS', 'SS'], 'furniture', 'bedroom', role='prop', kind='low_furniture',
           tags=['침대', '사��식', '침실'], desc='네 기둥 침대: 위 닫집 틀(윗면), 늘어진 찢긴 붉은 휘장, 흐트러진 흰 시트와 베개 둘, 발치 판.',
           rules='침실 북벽 앞 가운데. 양옆에 협탁·촛대.')
def _bed(c):
    slab(c, 0, 0, 32, 4, 2, m='wood', t=4, fb=2, seams=0)                         # 닫집 틀
    for x in (0, 29): c.R(x, 4, 3, 40, K('wood', 3)); c.VL(x, 4, 40, K('wood', 4)); c.VL(x + 2, 4, 40, K('wood', 1))
    c.R(3, 6, 26, 10, K('wood', 2)); c.HL(3, 6, 26, K('wood', 4))                 # 머리 판
    slab(c, 3, 14, 26, 24, 5, m='bone', t=5, fb=3, seams=0)                       # 이불 윗면(넓게)
    c.R(5, 16, 9, 5, K('bone', 6)); c.R(18, 16, 9, 5, K('bone', 6)); c.HL(5, 20, 9, K('bone', 4)); c.HL(18, 20, 9, K('bone', 4))
    c.R(3, 26, 26, 12, K('velvet', 3)); c.HL(3, 26, 26, K('velvet', 5)); c.line(8, 30, 20, 27, K('velvet', 2))   # 덮은 붉은 이불
    for x0 in (3, 25):                                                            # 늘어진 휘장
        for y in range(6, 34 if x0 == 3 else 22):
            c.P(x0 + (y // 7) % 2, y, K('velvet', 2)); c.P(x0 + 1 + (y // 7) % 2, y, K('velvet', 4))
    c.R(3, 41, 26, 5, K('wood', 2)); c.HL(3, 41, 26, K('wood', 4))
    finish(c)


@REG.piece('gm-wardrobe', '큰 옷장(반쯤 열린 문)', 2, 3, ['CC', 'SS', 'SS'], 'furniture', 'bedroom', role='prop', kind='tall_furniture',
           tags=['옷장', '침실'], desc='키 큰 마호가니 옷장: 조각 갓 윗면, 쌍문 하나가 조금 열려 어둠 속 옷이 보인다, 거울 판.',
           rules='침실 북벽·서벽 앞. 숨을 곳 이벤트에 좋다.')
def _wardrobe(c):
    slab(c, 0, 0, 32, 10, 2, m='wood', t=5, seams=8)                              # 넓은 갓 윗면 10행
    c.HL(0, 0, 32, K('wood', 1))
    c.R(1, 12, 30, 32, K('wood', 2)); c.VL(1, 12, 32, K('wood', 3)); c.VL(30, 12, 32, K('wood', 1))
    for x0 in (3, 16):                                                            # 닫힌 쌍문: 조각 판 둘씩
        c.R(x0, 14, 13, 28, K('wood', 3)); c.VL(x0, 14, 28, K('wood', 4)); c.VL(x0 + 12, 14, 28, K('wood', 2))
        for y0, h in ((16, 12), (30, 10)):
            c.R(x0 + 2, y0, 9, h, K('wood', 2)); c.HL(x0 + 2, y0, 9, K('wood', 1)); c.VL(x0 + 10, y0, h, K('wood', 4)); c.HL(x0 + 2, y0 + h - 1, 9, K('wood', 4))
    c.VL(15, 14, 28, K('wood', 1))
    c.P(13, 28, K('gold', 5)); c.P(18, 28, K('gold', 5))
    c.R(0, 44, 32, 4, K('wood', 2)); c.HL(0, 44, 32, K('wood', 4)); c.HL(0, 47, 32, K('wood', 1))
    finish(c)


@REG.piece('gm-vanity', '거울 화장대(금 간 거울)', 2, 2, ['CC', 'SS'], 'furniture', 'bedroom', role='prop', kind='low_furniture',
           tags=['화장대', '거울', '침실'], desc='타원 거울 화장대: 금 간 거울, 넓은 윗판(향수병·빗·촛대), 서랍 둘.',
           rules='침실 벽 앞. 거울 속 공포 연출.')
def _vanity(c):
    c.ellipse(16, 8, 8, 8, K('gold', 3)); c.ellipse(16, 8, 6.5, 6.5, K('glass', 3)); c.P(13, 4, K('glass', 5)); c.P(14, 5, K('glass', 5))
    c.line(17, 3, 15, 8, K('glass', 6)); c.line(15, 8, 19, 12, K('glass', 6))
    slab(c, 0, 14, 32, 7, 9, m='wood', t=5, fb=2, seams=0)
    c.R(4, 15, 3, 4, K('violet', 4)); c.P(5, 14, K('gold', 5)); c.R(10, 17, 5, 2, K('bone', 6)); c.R(25, 12, 2, 6, K('bone', 6)); c.P(25, 11, K('glow', 6))
    for x in (3, 17): c.R(x, 23, 12, 5, K('wood', 3)); c.HL(x, 23, 12, K('wood', 4)); c.P(x + 6, 25, K('gold', 5))
    finish(c)


@REG.piece('gm-dining-table', '긴 식탁(먼지 쌓인 만찬)', 4, 2, ['SSSS', 'SSSS'], 'furniture', 'hall', role='prop', kind='low_furniture',
           tags=['식탁', '식당', '만찬'], desc='흰 식탁보 덮인 긴 식탁: 넓은 윗면에 은 촛대·썩은 만찬 접시·거미줄 잔, 식탁보 가장자리 늘어짐.',
           rules='식당 가운데. 남북으로 의자(gm-chair)를 줄지어.')
def _dining(c):
    slab(c, 0, 2, 64, 18, 0, m='bone', t=5, seams=0)
    c.HL(0, 2, 64, K('bone', 3))
    c.R(0, 20, 64, 6, K('bone', 4)); c.HL(0, 20, 64, K('bone', 6))
    for x in range(0, 64, 8): c.VL(x + 4, 21, 5, K('bone', 3))
    c.R(1, 26, 3, 6, K('wood', 2)); c.R(60, 26, 3, 6, K('wood', 1))
    for x in (12, 32, 52):
        c.R(x - 1, 6, 3, 10, K('gold', 3)); c.HL(x - 3, 15, 7, K('gold', 4)); c.R(x, 3, 1, 3, K('bone', 6)); c.P(x, 2, K('glow', 6))
    for (x, y) in ((5, 8), (22, 12), (40, 8), (58, 12)):
        c.ellipse(x, y, 3, 2, K('bone', 6)); c.ellipse(x, y, 2, 1.2, K('velvet', 2)); c.P(x, y, K('ivy', 2))
    for (x, y) in ((18, 6), (44, 14)): c.R(x, y, 2, 3, K('glass', 4)); c.P(x, y, K('glass', 6))
    finish(c)


@REG.piece('gm-stove', '무쇠 화덕(냄비·주전자)', 2, 2, ['SS', 'SS'], 'furniture', 'kitchen', role='prop', kind='low_furniture',
           tags=['화덕', '부엌', '스토브'], desc='검은 무쇠 장작 화덕: 넓은 윗판(화구 둘에 끓는 검은 냄비·주전자), 불 구멍 문, 위로 굽은 연통.',
           rules='부엌 북벽 앞.')
def _stove(c):
    c.R(24, 0, 5, 8, K('iron', 2)); c.VL(24, 0, 8, K('iron', 4))
    slab(c, 0, 6, 32, 10, 12, m='iron', t=4, fb=1, seams=0)
    for (x, y) in ((8, 10), (22, 11)): c.ellipse(x, y, 5, 2.5, K('iron', 1))
    c.ellipse(8, 9, 4, 2, K('ink', 2)); c.R(4, 9, 8, 4, K('ink', 2)); c.ellipse(8, 8.5, 4, 1.4, K('ivy', 2))
    c.ellipse(22, 9, 3, 2, K('iron', 5)); c.R(19, 9, 6, 3, K('iron', 4)); c.line(25, 9, 28, 7, K('iron', 5))
    c.R(4, 19, 10, 7, K('ink', 1)); c.R(5, 21, 8, 4, K('glow', 3)); c.HL(5, 21, 8, K('glow', 5))
    c.R(18, 19, 10, 7, K('iron', 2)); c.HL(18, 19, 10, K('iron', 4)); c.P(26, 22, K('gold', 4))
    finish(c)


@REG.piece('gm-kitchen-table', '부엌 작업대(칼·빵·고기)', 2, 2, ['SS', 'SS'], 'furniture', 'kitchen', role='prop', kind='low_furniture',
           tags=['작업대', '부엌', '탁자'], desc='긁힌 두꺼운 나무 작업대: 넓은 도마 윗면에 식칼·딱딱한 빵·붉은 고깃덩이, 아래 선반의 단지.',
           rules='부엌 가운데.')
def _ktable(c):
    slab(c, 0, 2, 32, 14, 4, m='wood', t=5, fb=3, seams=4)
    c.ellipse(9, 8, 5, 3, K('paper', 4)); c.ellipse(9, 7, 4, 2, K('paper', 5))
    c.R(17, 6, 9, 5, K('velvet', 3)); c.HL(17, 6, 9, K('velvet', 5)); c.P(20, 8, K('bone', 6))
    c.line(4, 13, 12, 12, K('iron', 5)); c.R(13, 12, 3, 2, K('wood', 2))
    c.R(2, 20, 28, 8, K('wood', 1)); c.ellipse(10, 24, 3, 3, K('brick', 4)); c.ellipse(20, 24, 3, 3, K('brick', 3))
    c.R(0, 28, 3, 4, K('wood', 2)); c.R(29, 28, 3, 4, K('wood', 1))
    finish(c)


@REG.piece('gm-pot-shelf', '냄비 선반(구리 냄비·단지)', 2, 2, ['CC', 'SS'], 'furniture', 'kitchen', role='prop', kind='tall_furniture',
           tags=['선반', '부엌', '냄비'], desc='벽에 붙인 나무 선반 장: 윗판, 칸마다 구리 냄비·흙 단지·병, 걸린 국자.', rules='부엌 벽 앞.')
def _pots(c):
    pslab(c, 0, 0, 32, 10, 0, m='wood', t=6, inset=3, seams=8)                   # 원근 윗판 10행(빈 판 — 뒤로 모이는 널 이음)
    c.R(0, 10, 32, 22, K('wood', 1)); c.VL(0, 10, 22, K('wood', 3)); c.VL(31, 10, 22, K('wood', 2)); c.HL(0, 10, 32, K('wood', 2))
    for y in (19, 28):                                                            # 선반 판: 윗면 3행 + 앞턱
        c.HL(1, y, 30, K('wood', 6)); c.HL(1, y + 1, 30, K('wood', 5)); c.HL(1, y + 2, 30, K('wood', 5)); c.HL(1, y + 3, 30, K('wood', 2))
    for (x, y, m) in ((3, 13, 'gold'), (13, 14, 'brick'), (23, 13, 'glass'), (4, 23, 'brick'), (15, 23, 'gold'), (24, 23, 'brick')):
        h = 19 - y if y < 19 else 28 - y
        c.R(x, y, 5, h, K(m, 3)); c.ellipse(x + 2, y, 2.5, 1.2, K(m, 5)); c.P(x + 2, y, K('ink', 1)); c.VL(x + 4, y + 1, h - 1, K(m, 2))
    finish(c)


@REG.piece('gm-barrel', '참나무 술통', 1, 1, ['S'], 'furniture', 'cellar', role='prop', kind='container',
           tags=['술통', '통', '지하'], desc='쇠 테 두른 참나무 통(위에서 보이는 둥근 뚜껑 판과 마개).', rules='지하실·부엌 구석에 2~3개 무리.')
def _barrel(c):
    for y in range(5, 15):
        f = (y - 5) / 9; hw = 6 + math.sin(f * math.pi) * 1.3
        for x in range(int(8 - hw), int(8 + hw) + 1):
            u = (x - (8 - hw)) / (2 * hw); c.P(x, y, K('wood', 4 if u < .3 else 3 if u < .7 else 2))
    for y in (7, 12): c.HL(2, y, 12, K('iron', 3))
    c.ellipse(8, 4.5, 6, 3.2, K('wood', 5)); c.ellipse(8, 4.5, 6, 3.2, K('iron', 3), fill=False)
    c.HL(4, 4, 8, K('wood', 4)); c.P(10, 5, K('wood', 2))
    finish(c)


@REG.piece('gm-wine-rack', '포도주 시렁(먼지 낀 병)', 2, 2, ['CC', 'SS'], 'furniture', 'cellar', role='prop', kind='tall_furniture',
           tags=['포도주', '시렁', '지하'], desc='마름모 칸 나무 시렁(윗판 보임)에 눕힌 포도주 병 끝(붉은 봉랍)·빈 칸·거미줄.', rules='지하실 북벽 앞에 2~3개 이어.')
def _wine(c):
    slab(c, 0, 0, 32, 5, 0, m='wood', t=4, seams=8)
    c.R(0, 5, 32, 27, K('wood', 1))
    for y in range(6, 31, 6): c.HL(0, y, 32, K('wood', 3)); c.HL(0, y + 1, 32, K('wood', 2))
    for x in range(0, 32, 6): c.VL(x, 5, 27, K('wood', 3))
    for y in range(8, 30, 6):
        for x in range(1, 30, 6):
            if hsh(x, y, 3) < .15: continue
            c.ellipse(x + 2.5, y + 2, 2, 2, K('ivy', 0)); c.ellipse(x + 2.5, y + 2, 1.2, 1.2, K('ivy', 2)); c.P(x + 2, y + 1, K('velvet', 4)); c.P(x + 1, y + 1, K('glass', 5))
    c.VL(0, 5, 27, K('wood', 3)); c.VL(31, 5, 27, K('wood', 2))
    finish(c)


@REG.piece('gm-pew', '예배당 긴 의자', 3, 1, ['SSS'], 'furniture', 'chapel', role='prop', kind='seat',
           tags=['장의자', '예배당', '의자'], desc='어두운 오크 긴 의자: 등받이 윗면·앉는 판 윗면(넓게)·끝 첨두 판.', rules='예배당 가운데 통로 양옆으로 줄지어.')
def _pew(c):
    pslab(c, 2, 0, 44, 3, 5, m='wood', t=5, fb=2, inset=1)                        # 등받이: 위 갓 3행 + 등판(조각 판)
    for x in range(6, 44, 8): c.R(x, 4, 5, 3, K('wood', 3)); c.HL(x, 4, 5, K('wood', 1))
    pslab(c, 2, 8, 44, 6, 2, m='wood', t=6, fb=3, inset=2, seams=11)             # 앉는 판 윗면 6행(원근) + 앞턱
    for x in (0, 44):
        c.R(x, 0, 4, 16, K('wood', 3)); c.HL(x, 0, 4, K('wood', 6)); c.HL(x, 1, 4, K('wood', 5)); c.VL(x + 3, 2, 14, K('wood', 2))
    finish(c)


@REG.piece('gm-altar', '돌 제단(촛대·펼친 경전)', 3, 2, ['SSS', 'SSS'], 'furniture', 'chapel', role='prop', kind='low_furniture',
           tags=['제단', '예배당'], desc='흰 천 덮은 돌 제단: 넓은 윗면에 촛대 둘·펼친 경전·성배, 앞면에 금 십자 수놓은 천.', rules='예배당 북벽 앞 가운데.')
def _altar(c):
    slab(c, 0, 4, 48, 12, 0, m='bone', t=5, seams=0)
    c.HL(0, 4, 48, K('bone', 3))
    c.R(0, 16, 48, 14, K('stone', 3)); c.VL(0, 16, 14, K('stone', 4)); c.VL(47, 16, 14, K('stone', 2)); c.HL(0, 29, 48, K('stone', 1))
    c.R(12, 16, 24, 11, K('velvet', 3)); c.HL(12, 16, 24, K('velvet', 5)); c.VL(24, 18, 7, K('gold', 4)); c.HL(21, 20, 7, K('gold', 4))
    for x in (6, 41): c.R(x, 0, 2, 9, K('bone', 6)); c.P(x, 0, K('glow', 6)); c.R(x - 1, 9, 4, 3, K('gold', 4))
    c.R(18, 7, 12, 6, K('paper', 5)); c.VL(24, 7, 6, K('paper', 3))
    c.R(32, 6, 3, 4, K('gold', 5)); c.P(33, 10, K('gold', 3))
    finish(c)


if __name__ == '__main__':
    sys.exit(1 if run_module(MODULE) else 0)
