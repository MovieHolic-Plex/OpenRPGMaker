"""정원·마당 소품 — 영구 마차·고사 버드나무·덤불·시든 장미·버섯·이끼 바위·천사 묘비·가족 묘비·나무 십자가·새 물그릇·해시계·화분·장미 아치·지하실 문·돌계단·미술관 간판·흉상 기둥·가스등·호박·장작·상자."""
import os, sys, math, random
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
from gmlib import REG, Cv, K, OL, OL2, run_module   # noqa: E402
from gmdraw import *                                  # noqa: E402,F403
from gy_props import dead_tree, headstone, plinth, branch   # noqa: E402

MODULE = 'yard_props'
SP = 'grounds'


@REG.piece('gm-hearse', '검은 영구 마차(유리 관실·깃털 장식)', 4, 3, 'auto', 'vehicles', SP, role='prop', kind='other',
           tags=['영구차', '마차', '장례'], desc='말 없는 검은 장례 마차: 지붕 윗면(윗면 5행)과 네 귀 검은 깃털 장식, 유리 관실 안의 관, 붉은 바퀴살 큰 바퀴 둘, 마부석.',
           rules='저택 정문 앞·예배당 앞 길에 길 방향으로. 문 앞 접근칸을 막지 않게.')
def _hearse(c):
    # 지붕(윗면) + 몸
    block3(c, 8, 8, 44, 6, 2, m='iron', tb=3, fb=1, outline=False)
    c.HL(7, 14, 46, K('gold', 4))
    for px in (9, 48):                                       # 깃털 장식
        for k in range(6): c.P(px + (k % 2), 2 + k, K('ink', 2)); c.P(px + 1 + (k % 2), 3 + k, K('violet', 2))
        c.P(px + 1, 1, K('violet', 3))
    c.R(10, 16, 40, 20, K('iron', 1))
    c.R(14, 18, 30, 14, K('glass', 2)); c.HL(14, 18, 30, K('glass', 4))
    for x in range(14, 44, 10): c.VL(x, 18, 14, K('gold', 3))
    c.R(18, 26, 22, 5, K('wood', 2)); c.HL(18, 26, 22, K('wood', 4)); c.HL(26, 28, 6, K('gold', 4))   # 관
    c.HL(10, 36, 40, K('gold', 3)); c.R(10, 37, 40, 3, K('iron', 1))
    c.R(50, 22, 10, 6, K('iron', 2)); c.HL(50, 22, 10, K('iron', 4)); c.R(56, 16, 2, 7, K('iron', 2))  # 마부석
    for (wx, r) in ((16, 8), (46, 7)):                       # 바퀴
        c.ellipse(wx, 40, r, r, K('ink', 1)); c.ellipse(wx, 40, r - 1.2, r - 1.2, (0, 0, 0, 0))
        for k in range(8):
            a = k * math.pi / 4; c.line(wx, 40, int(wx + math.cos(a) * (r - 1)), int(40 + math.sin(a) * (r - 1)), K('velvet', 3))
        c.ellipse(wx, 40, r, r, K('iron', 3), fill=False); c.ellipse(wx, 40, 1.5, 1.5, K('gold', 4))
    finish(c)


@REG.piece('gm-willow-dead', '마른 수양버들(늘어진 가지)', 3, 4, 'auto', 'nature', 'graveyard', role='prop', kind='organic',
           tags=['버드나무', '고사목', '나무'], desc='잎이 다 진 수양버들: 굵게 갈라진 줄기에서 실처럼 늘어진 마른 가지 다발, 밑동 뿌리.',
           rules='연못가·묘지 모퉁이에 한 그루. 밑동 칸만 막는다.')
def _willow(c):
    rnd = random.Random(21)
    dead_tree(c, 24, 61, 40, .7, seed=21, th=8, depth=1)
    strands = []
    for k in range(30):                                       # 늘어진 가지: 뒤 줄(어둡게) 먼저, 앞 줄(밝게) 나중
        x = rnd.uniform(4, 44); y0 = rnd.uniform(8, 22); L = rnd.randint(16, 32)
        strands.append((k % 3 == 0, x, y0, L, k))
    for front in (False, True):
        for (fr, x, y0, L, k) in strands:
            if fr != front: continue
            for s_ in range(L):
                yy = int(y0 + s_); xx = int(x + math.sin(s_ * .2 + k) * 1.2 + (s_ * .08 if x > 24 else -s_ * .08))
                lit = x < 24                                   # 왼쪽 다발이 빛을 받는다
                if front: t = 5 if s_ < 2 else 4 if (lit and s_ % 5) else 3
                else: t = 2 if s_ % 4 else 1
                if s_ > L - 3: t = max(1, t - 1)              # 끝은 가늘고 어둡게
                c.P(xx, yy, K('bark', t))
                if front and s_ % 6 == 3 and hsh(xx, yy, 23) < .5:   # 말라 붙은 잎 몇
                    c.P(xx + (1 if x > 24 else -1), yy, K('gold', 2) if hsh(xx, yy, 24) < .4 else K('ivy', 3))
    finish(c, soft=True)


@REG.piece('gm-bush-dead', '마른 관목', 1, 1, ['S'], 'nature', SP, role='prop', kind='organic', tags=['덤불', '관목'],
           desc='잎 몇 남은 마른 관목 덩이(잔가지).', rules='담 밑·길가에 덩이로 2~3개.')
def _bush_dead(c):
    rnd = random.Random(31)
    for k in range(9):
        branch(c, 8 + rnd.uniform(-2, 2), 15, -math.pi / 2 + rnd.uniform(-.9, .9), rnd.uniform(6, 10), 1.6, 1, rnd)
    for (x, y) in ((4, 6), (11, 5), (8, 3), (13, 9)): c.P(x, y, K('ivy', 3)); c.P(x + 1, y, K('ivy', 2))
    finish(c)


@REG.piece('gm-roses-dead', '시든 장미 덤불(검붉은 꽃)', 2, 1, ['SS'], 'nature', SP, role='prop', kind='organic', tags=['장미', '덤불', '정원'],
           desc='가시 줄기 덤불에 시들어 고개 숙인 검붉은 장미 몇 송이, 떨어진 꽃잎.', rules='정원 화단·묘비 앞에.')
def _roses(c):
    for y in range(4, 15):
        for x in range(2, 30):
            d = ((x - 16) / 14) ** 2 + ((y - 10) / 6) ** 2
            if d > 1 or hsh(x // 2, y // 2, 4) < .25: continue
            c.P(x, y, K('ivy', 2 if y > 9 else 3 if hsh(x, y, 5) < .7 else 4))
    for (x, y) in ((6, 5), (13, 4), (21, 6), (26, 8), (17, 8), (9, 9)):
        c.R(x, y, 3, 2, K('velvet', 3)); c.P(x, y, K('velvet', 5)); c.P(x + 2, y + 1, K('velvet', 1)); c.P(x + 1, y + 2, K('ivy', 1))
    for (x, y) in ((5, 14), (24, 14), (12, 15)): c.P(x, y, K('velvet', 2))
    finish(c)


@REG.piece('gm-mushrooms', '버섯 고리(창백한 버섯)', 1, 1, ['f'], 'nature', SP, role='prop', kind='organic', tags=['버섯', '덧그림'],
           desc='창백한 갓 버섯 다섯이 고리로 난 자리(갓 윗면이 보임).', rules='고사목 밑·축축한 그늘에.')
def _mush(c):
    for k in range(5):
        a = k * 2 * math.pi / 5; x = int(8 + math.cos(a) * 5); y = int(9 + math.sin(a) * 3.5)
        c.VL(x, y, 3, K('paper', 4)); c.ellipse(x, y, 2, 1.3, K('paper', 5)); c.P(x - 1, y - 1, K('paper', 6)); c.P(x + 1, y + 1, K('paper', 2))
    finish(c)


@REG.piece('gm-rock-moss', '이끼 덮인 바위', 2, 2, 'auto', 'nature', SP, role='prop', kind='organic', tags=['바위', '돌', '이끼'],
           desc='모난 회색 바위 덩이(면마다 다른 단) 윗면에 이끼.', rules='묘지 가장자리·연못가에 하나둘.')
def _rock(c):
    pts = [(3, 22), (5, 10), (12, 4), (22, 5), (29, 12), (30, 24), (24, 29), (8, 29)]
    c.poly(pts, K('stone', 3))
    c.poly([(5, 10), (12, 4), (22, 5), (20, 13), (9, 15)], K('stone', 5))
    c.poly([(20, 13), (22, 5), (29, 12), (30, 24), (22, 21)], K('stone', 2))
    c.poly([(9, 15), (20, 13), (22, 21), (14, 24)], K('stone', 4))
    c.line(12, 4, 22, 5, K('stone', 6)); c.line(5, 10, 12, 4, K('stone', 6))
    moss_patches(c, 6, 26, 5, 14, 9, seed=8)
    finish(c, tex=True)


@REG.piece('gm-tomb-angel', '천사 묘비(날개 접은 천사상)', 1, 2, ['C', 'S'], 'nature', 'graveyard', role='prop', kind='figure',
           tags=['천사상', '묘비', '석상'], desc='넓은 받침(윗면 보임) 위에 날개를 접고 무릎 꿇어 기도하는 작은 천사상.', rules='아이 무덤·귀족 무덤 머리맡에.')
def _tomb_angel(c):
    plinth(c, 1, 22, 14, 4, 6, seed=22)
    st = 'bone'
    for side in (-1, 1):                                   # 날개: 어깨 뒤에서 위로 솟은 깃털 날개
        pts = [(8 + side * 2, 11), (8 + side * 6, 2), (8 + side * 8, 6), (8 + side * 7, 14), (8 + side * 4, 19)]
        c.poly(pts, K(st, 3 if side > 0 else 4))
        for k in range(4):
            y = 7 + k * 3; c.line(8 + side * 3, y + 3, 8 + side * 7, y, K(st, 2 if side > 0 else 3))
        c.line(8 + side * 6, 2, 8 + side * 8, 6, K(st, 5 if side < 0 else 4))
    c.poly([(6, 10), (10, 10), (12, 22), (4, 22)], K(st, 4))                 # 옷자락
    c.VL(5, 13, 9, K(st, 5)); c.VL(6, 11, 11, K(st, 5)); c.VL(10, 12, 10, K(st, 2)); c.VL(11, 16, 6, K(st, 2))
    c.VL(8, 14, 8, K(st, 3))
    c.R(7, 12, 2, 3, K(st, 6)); c.P(7, 14, K(st, 5))                          # 모은 손
    c.ellipse(8, 7.5, 2.2, 2.4, K(st, 5)); c.P(7, 6, K(st, 6)); c.P(9, 8, K(st, 3)); c.HL(7, 9, 2, K(st, 3))
    finish(c)


@REG.piece('gm-sundial', '해시계 받침', 1, 2, ['C', 'S'], 'nature', SP, role='prop', kind='column',
           tags=['해시계', '정원'], desc='네모 돌기둥(윗면에 놋쇠 해시계판과 바늘이 보임).', rules='정원 가운데·길이 만나는 곳.')
def _sundial(c):
    block3(c, 3, 9, 10, 7, 17, m='stone', tb=5, fb=3, tex='masonry', seed=25)
    c.ellipse(8, 12, 4, 2.5, K('gold', 4)); c.ellipse(8, 12, 4, 2.5, K('gold', 2), fill=False)
    c.line(8, 12, 10, 9, K('gold', 6)); c.P(8, 12, K('ink', 1))
    finish(c)


@REG.piece('gm-planter', '큰 돌 화분(마른 덩굴)', 1, 1, ['S'], 'nature', SP, role='prop', kind='container',
           tags=['화분', '정원'], desc='넓은 돌 화분(위에서 보이는 흙 아가리)에 마른 덩굴.', rules='계단·문 양옆에 한 쌍.')
def _planter(c):
    c.ellipse(8, 5.5, 7.5, 4, K('stone', 6)); c.ellipse(8, 5.8, 5.8, 2.9, K('dirt', 1)); c.HL(4, 6, 8, K('dirt', 2))
    for y in range(7, 15):
        hw = 7 - (y - 7) * .35
        for x in range(int(8 - hw), int(8 + hw) + 1):
            u = (x - (8 - hw)) / (2 * hw); c.P(x, y, K('stone', 4 if u < .3 else 3 if u < .7 else 2))
    c.HL(3, 14, 10, K('stone', 1))
    for (x, y, L) in ((5, 5, 5), (9, 5, 6), (11, 6, 4)):
        for s in range(L): c.P(x + (s % 2), y - s, K('bark', 3 if s % 2 else 2))
    c.P(6, 1, K('velvet', 3))
    finish(c)


@REG.piece('gm-steps-stone', '바깥 돌계단(3단)', 2, 1, ['FF'], 'surfaces', SP, role='terrain', kind='terrain',
           tags=['계단', '돌계단'], desc='낮은 둔덕을 오르는 넓은 돌계단 3단(디딤면 밝음·챌면 어둠), 양 끝 돌 볼.',
           rules='높이가 다른 마당 사이, 문 앞. 걸을 수 있다.')
def _steps(c):
    for y in range(16):
        for x in range(32):
            r = y // 5; ry = y % 5
            t = 5 if ry < 2 else 2 if ry == 4 else 3
            t += (1 if x < 3 else -1 if x > 28 else 0)
            if hsh(x // 3, r, 6) < .12 and ry < 2: t -= 1
            c.P(x, y, K('stone', t))


@REG.piece('gm-sign-gallery', '미술관 안내판(액자 그림 판)', 1, 2, ['C', 'S'], 'architecture', 'gallery', role='prop', kind='frame',
           tags=['안내판', '미술관', '표지'], desc='나무 이젤 모양 안내판(글자 없음): 금 테 액자 그림 판, 위 지붕 덮개(윗면 보임), 다리 둘.',
           rules='미술관 앞 광장 입구에 하나.')
def _sign(c):
    block3(c, 0, 0, 16, 5, 2, m='wood', tb=6, fb=3)
    c.R(2, 7, 12, 11, K('gold', 3)); c.HL(2, 7, 12, K('gold', 5)); c.VL(2, 7, 11, K('gold', 5)); c.VL(13, 7, 11, K('gold', 1)); c.HL(2, 17, 12, K('gold', 1))
    c.R(4, 9, 8, 7, K('violet', 2)); c.ellipse(7, 12, 2, 2.5, K('bone', 4)); c.R(5, 14, 5, 2, K('velvet', 3)); c.P(10, 10, K('glow', 5))
    for px in (3, 11): c.R(px, 18, 2, 12, K('wood', 3)); c.VL(px, 18, 12, K('wood', 5))
    c.HL(3, 24, 10, K('wood', 2))
    finish(c)


@REG.piece('gm-woodpile', '장작더미(통나무 끝 나이테)', 2, 1, ['SS'], 'nature', SP, role='prop', kind='organic',
           tags=['장작', '통나무'], desc='쌓은 장작(위 통나무 윗면·끝 나이테가 보임)과 박힌 도끼.', rules='헛간·부엌 문 옆 벽에 붙여.')
def _woodpile(c):
    LOG = ['..ooo..', '.oLLLo.', 'oLMMMLo', 'oLMDMLo', 'oLMMMLo', '.oLLLo.', '..ooo..']
    tone = dict(o=('bark', 3), L=('wood', 6), M=('wood', 5), D=('wood', 3))
    c.poly([(1, 15), (4, 3), (12, 0), (20, 0), (26, 4), (29, 15)], K('bark', 1))   # 틈 그늘
    for (y, n, off) in ((9, 4, 1), (4, 3, 5), (-1, 2, 9)):
        for k in range(n):
            x = off + k * 7
            for j, row in enumerate(LOG):
                for i, ch in enumerate(row):
                    if ch != '.' and 0 <= y + j < 16:
                        t = tone[ch]
                        if ch == 'M' and hsh(x + i, y + j, 9) < .25: t = ('wood', 4)
                        c.P(x + i, y + j, K(*t))
    c.line(28, 3, 30, 13, K('wood', 4)); c.line(29, 3, 31, 13, K('wood', 2)); c.R(26, 1, 5, 3, K('iron', 5)); c.HL(26, 1, 5, K('iron', 6))
    finish(c)


@REG.piece('gm-crates', '쌓은 나무 상자 둘', 1, 2, ['C', 'S'], 'nature', SP, role='prop', kind='box',
           tags=['상자', '창고'], desc='판자 나무 상자 둘을 쌓았다(위 상자 뚜껑 윗면 5행, 대각 버팀목).', rules='마차고·부엌 뒷마당·지하실에.')
def _crates(c):
    for (x, y, w, top, fr) in ((1, 13, 14, 5, 13), (3, 3, 10, 4, 7)):
        block3(c, x, y, w, top, fr, m='wood', tb=5, fb=3, outline=False)
        c.line(x + 1, y + top + 1, x + w - 2, y + top + fr - 2, K('wood', 2))
        c.VL(x, y + top, fr, K('wood', 4)); c.VL(x + w - 1, y + top, fr, K('wood', 1))
        for xx in range(x + 3, x + w - 1, 4): c.VL(xx, y, top, K('wood', 4))
    finish(c)


if __name__ == '__main__':
    sys.exit(1 if run_module(MODULE) else 0)
