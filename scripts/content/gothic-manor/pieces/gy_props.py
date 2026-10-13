"""공동묘지 소품 — 묘비(두꺼운 돌판: 윗면이 보이게)·십자가·오벨리스크·석관·무덤·석상·고사목·덤불·관·등불 기둥·벤치."""
import os, sys, math, random
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
from gmlib import REG, Cv, K, OL, OL2, run_module   # noqa: E402
from gmdraw import *                                  # noqa: E402,F403

MODULE = 'gy_props'
SP = 'graveyard'


def plinth(c, x, y, w, top=3, front=3, m='stone', tb=5, fb=3, seed=0):
    """받침돌: 윗면(밝음) + 앞면(어둠), 뒷변 어두운 선은 외곽선이 맡는다."""
    block3(c, x, y, w, top, front, m=m, tb=tb, fb=fb, seed=seed)


def headstone(c, x, y_face, w, h, depth=4, m='stone', arch=True, seed=0, mark='cross', tilt=0):
    """두꺼운 돌 묘비: 앞면(첨두/둥근 머리) + 그 위로 depth 행 윗면(돌 두께를 위에서 본 면). tilt 는 위로 갈수록 x 를 민다."""
    r = w / 2
    def ftop(i):
        if not arch: return 0
        dx = abs(i + .5 - r) / r
        return int(round(r * .8 * (1 - math.sqrt(max(0, 1 - dx * dx))))) if dx < 1 else int(r)
    for i in range(w):
        t0 = y_face + ftop(i)
        for yy in range(t0, y_face + h):
            sh = int((y_face + h - yy) * tilt)
            u = i / max(1, w - 1)
            t = 4 if u < .25 else 3 if u < .75 else 2
            if yy == t0: t = 4
            c.P(x + i + sh, yy, K(m, t))
        for k in range(1, depth + 1):          # 윗면: 앞 머리선 위로
            sh = int((y_face + h - (t0 - k)) * tilt)
            t = 6 if k == depth else 5
            if k == 1: t = 5
            c.P(x + i + sh, t0 - k, K(m, t))
    for i in range(w):
        t0 = y_face + ftop(i); sh = int((y_face + h - t0) * tilt)
        c.P(x + i + sh, t0 - depth - 1, K(m, 2))            # 뒷변(어두운 선)
        c.P(x + i + sh, t0, K(m, 3))                         # 앞 모서리 아래 그늘
    cx = x + w // 2
    if mark == 'cross':
        yy = y_face + h // 2 - 2; sh = int(h // 2 * tilt)
        c.VL(cx + sh, yy, 6, K(m, 1)); c.HL(cx - 2 + sh, yy + 2, 5, K(m, 1))
    elif mark == 'lines':
        for k in range(3): c.HL(x + 2, y_face + 5 + k * 2, w - 4, K(m, 2))
    elif mark == 'skull':
        c.R(cx - 2, y_face + 4, 5, 3, K('bone', 4)); c.P(cx - 1, y_face + 5, K('ink', 1)); c.P(cx + 1, y_face + 5, K('ink', 1)); c.HL(cx - 1, y_face + 7, 3, K('bone', 3))
    moss_top(c, x, y_face + ftop(w // 2) - depth, w, seed=seed, amount=.25)


@REG.piece('gm-tomb-round', '둥근 머리 묘비(두꺼운 돌·십자 새김)', 1, 1, ['S'], 'nature', SP, role='prop', kind='column',
           tags=['묘비', '무덤'], desc='둥근 머리의 두꺼운 회색 묘비: 위에서 보이는 돌 두께(윗면 4행), 십자 새김, 받침돌, 이끼.',
           rules='묘지에 2~3칸 간격 줄로. 앞(아래) 칸은 비워 둔다.')
def _tomb_round(c):
    plinth(c, 1, 11, 14, 2, 4, seed=1)
    headstone(c, 3, 3, 10, 9, depth=3, seed=1)
    finish(c, tex=True)


@REG.piece('gm-tomb-arch', '첨두 머리 묘비(해골 새김)', 1, 1, ['S'], 'nature', SP, role='prop', kind='column',
           tags=['묘비', '무덤'], desc='뾰족한 첨두 머리의 두꺼운 묘비, 해골 부조, 받침돌.', rules='묘지 줄 사이사이에 섞는다.')
def _tomb_arch(c):
    plinth(c, 2, 11, 12, 2, 4, seed=2)
    w = 9; x = 4; yf = 3
    prof, _ = arch_profile(w)
    for i in range(w):
        t0 = yf + prof[i]
        for yy in range(t0, 12):
            u = i / (w - 1); c.P(x + i, yy, K('stone', 4 if u < .25 else 3 if u < .75 else 2))
        for k in range(1, 4): c.P(x + i, t0 - k, K('stone', 6 if k == 3 else 5))
        c.P(x + i, t0 - 4, K('stone', 2))
    c.R(7, 6, 4, 3, K('bone', 4)); c.P(7, 7, K('ink', 1)); c.P(9, 7, K('ink', 1)); c.HL(8, 9, 2, K('bone', 3))
    finish(c, tex=True)


@REG.piece('gm-tomb-tilt', '기울어진 묘비', 1, 1, ['S'], 'nature', SP, role='prop', kind='column',
           tags=['묘비', '무덤', '폐허'], desc='한쪽으로 기운 두꺼운 묘비(윗면 보임), 반쯤 묻힌 받침, 흙 덩이.', rules='오래된 묘지 구역에 섞는다.')
def _tomb_tilt(c):
    c.R(2, 12, 12, 3, K('dirt', 3)); c.HL(2, 12, 12, K('dirt', 4)); c.HL(3, 14, 10, K('dirt', 2))
    headstone(c, 3, 4, 9, 9, depth=4, seed=3, mark='lines', tilt=.35)
    finish(c, tex=True)


@REG.piece('gm-tomb-broken', '부서진 묘비(그루터기 + 쓰러진 조각)', 1, 1, ['S'], 'nature', SP, role='prop', kind='column',
           tags=['묘비', '폐허'], desc='위가 부러진 묘비 그루터기(깨진 윗면이 보임)와 앞에 쓰러진 머리 조각.', rules='폐허 묘지에.')
def _tomb_broken(c):
    plinth(c, 2, 10, 12, 2, 4, seed=4)
    for i in range(9):
        top = 4 + (i * 7) % 3 + (1 if i > 5 else 0)
        for yy in range(top, 11): c.P(4 + i, yy, K('stone', 4 if i < 3 else 3 if i < 7 else 2))
        for k in range(1, 4): c.P(4 + i, top - k, K('stone', 5 if k < 3 else 6))
    c.R(1, 13, 6, 2, K('stone', 5)); c.HL(1, 13, 6, K('stone', 6)); c.HL(1, 15, 6, K('stone', 2))
    finish(c, tex=True)


@REG.piece('gm-tomb-cross', '돌 십자가 묘비', 1, 2, ['C', 'S'], 'nature', SP, role='prop', kind='column',
           tags=['십자가', '묘비'], desc='두꺼운 돌 십자가(팔·머리 윗면이 보임) + 두 단 받침.', rules='묘지 줄 끝·중요한 무덤에.')
def _tomb_cross(c):
    plinth(c, 1, 23, 14, 3, 5, seed=5)
    plinth(c, 3, 19, 10, 2, 3, seed=6)
    x = 6; w = 5
    for yy in range(6, 20):
        for i in range(w): c.P(x + i, yy, K('stone', 4 if i == 0 else 2 if i == w - 1 else 3))
    for k in range(1, 4): c.HL(x, 6 - k, w, K('stone', 5 if k < 3 else 6))
    for yy in range(9, 13):
        for i in range(14):
            if 5 <= i < 9: continue
            c.P(1 + i, yy, K('stone', 4 if i < 3 else 3 if i < 11 else 2))
    for k in range(1, 3): c.HL(1, 9 - k, 5, K('stone', 5 if k == 1 else 6)); c.HL(10, 9 - k, 5, K('stone', 5 if k == 1 else 6))
    moss_top(c, 6, 3, 5, seed=5, amount=.3)
    finish(c, tex=True)


@REG.piece('gm-tomb-celtic', '켈트 고리 십자가', 1, 2, ['C', 'S'], 'nature', SP, role='prop', kind='column',
           tags=['십자가', '묘비'], desc='고리가 있는 켈트 돌 십자가(윗면 두께가 보임), 받침돌.', rules='묘지 가운데 길가에.')
def _tomb_celtic(c):
    plinth(c, 2, 23, 12, 3, 5, seed=7)
    c.ellipse(8, 10, 7, 7, K('stone', 4))
    c.ellipse(7.5, 9.5, 7, 7, K('stone', 5), fill=False)
    c.ellipse(8, 10, 4.6, 4.6, (0, 0, 0, 0))
    for yy in range(2, 24):
        for i in range(4): c.P(6 + i, yy, K('stone', 4 if i == 0 else 2 if i == 3 else 3))
    for yy in range(8, 12):
        for i in range(14):
            if 5 <= i < 9: continue
            c.P(1 + i, yy, K('stone', 4 if i < 3 else 3 if i < 11 else 2))
    for k in range(1, 3): c.HL(6, 2 - k + 1, 4, K('stone', 6 - k + 1)); c.HL(1, 8 - k, 5, K('stone', 5)); c.HL(10, 8 - k, 5, K('stone', 5))
    c.HL(6, 0, 4, K('stone', 6))
    for k in range(3): c.P(7, 14 + k * 3, K('stone', 1)); c.P(8, 15 + k * 3, K('stone', 5))
    finish(c, tex=True)


@REG.piece('gm-tomb-obelisk', '돌 오벨리스크', 1, 3, ['C', 'S', 'S'], 'nature', SP, role='prop', kind='column',
           tags=['오벨리스크', '묘비', '기념비'], desc='높은 돌 오벨리스크: 꼭대기 피라미드(윗면 두 면이 보임), 가는 몸, 넓은 두 단 받침(윗면).', rules='묘지 가운데·갈림길에 하나.')
def _obelisk(c):
    plinth(c, 1, 38, 14, 4, 6, seed=8)
    plinth(c, 3, 33, 10, 3, 3, seed=9)
    for yy in range(8, 33):
        f = (yy - 8) / 25
        hw = 3 + f * 1.4
        for x in range(int(8 - hw), int(8 + hw) + 1):
            u = (x - (8 - hw)) / (2 * hw)
            c.P(x, yy, K('stone', 5 if u < .3 else 3 if u < .7 else 2))
    for k in range(6):            # 피라미드 머리: 왼 면 밝음 · 오른 면 어둠
        y = 7 - k; hw = 3 - k * .5
        for x in range(int(8 - hw), int(8 + hw) + 1): c.P(x, y, K('stone', 6 if x < 8 else 3))
    for k in range(4): c.P(7, 14 + k * 4, K('stone', 2)); c.P(8, 14 + k * 4, K('stone', 2))
    finish(c, tex=True)


@REG.piece('gm-tomb-chest', '돌 궤 무덤(뚜껑 윗면·조각 판)', 2, 2, ['SS', 'SS'], 'nature', SP, role='prop', kind='box',
           tags=['석관', '무덤', '궤'], desc='가슴 높이 돌 궤 무덤: 넓은 두꺼운 뚜껑(윗면 10행), 앞면 조각 판 셋, 모서리 기둥, 이끼.', rules='묘지 가운데 귀족 무덤. 둘레를 걸을 수 있게.')
def _tomb_chest(c):
    block3(c, 1, 6, 30, 12, 13, m='stone', tb=5, fb=3, tex='masonry', seed=10)
    c.HL(1, 6, 30, K('stone', 6)); c.HL(0, 17, 32, K('stone', 6)); c.HL(0, 18, 32, K('stone', 4))
    for px in (4, 13, 22):
        c.R(px, 21, 7, 7, K('stone', 2)); c.HL(px, 21, 7, K('stone', 1)); c.VL(px, 21, 7, K('stone', 1)); c.HL(px, 27, 7, K('stone', 4))
    c.R(14, 23, 5, 3, K('stone', 4)); c.VL(16, 22, 5, K('stone', 4))
    c.R(0, 30, 32, 2, K('stone', 2))
    moss_patches(c, 2, 30, 7, 15, 5, seed=3)
    finish(c, tex=True)


@REG.piece('gm-sarcophagus', '석관(박공 뚜껑·조각)', 2, 2, ['SS', 'SS'], 'nature', 'crypt', role='prop', kind='box',
           tags=['석관', '관', '납골당'], desc='두꺼운 대리석 석관: 박공 모양 뚜껑(윗면 두 경사가 보임), 앞면 해골 부조와 띠, 받침.', rules='납골당·묘소 안에. 둘레를 비워 둔다.')
def _sarc(c):
    st = 'bone'
    for y in range(3, 15):                      # 박공 뚜껑: 뒤 경사(어둡게) · 용마루 · 앞 경사(밝게)
        for x in range(1, 31):
            if y < 7: t = 4
            elif y == 7: t = 6
            else: t = 5 if y < 11 else 4
            if x == 1: t -= 1
            if x == 30: t -= 2
            c.P(x, y, K(st, t))
    c.HL(2, 2, 28, K(st, 2)); c.HL(1, 14, 30, K(st, 2))
    for x in (3, 28): c.VL(x, 4, 10, K(st, 3))
    c.R(2, 15, 28, 13, K(st, 3)); c.VL(2, 15, 13, K(st, 4)); c.VL(29, 15, 13, K(st, 1)); c.HL(2, 15, 28, K(st, 2))
    for px in (5, 13, 21):
        c.R(px, 18, 7, 7, K(st, 2)); c.HL(px, 24, 7, K(st, 4)); c.VL(px + 6, 18, 7, K(st, 4))
    c.R(14, 19, 5, 3, K(st, 5)); c.P(15, 20, K('ink', 1)); c.P(17, 20, K('ink', 1)); c.HL(15, 22, 3, K(st, 4))
    c.HL(1, 28, 30, K(st, 2)); c.R(1, 28, 30, 3, K('stone', 3)); c.HL(1, 28, 30, K('stone', 5))
    finish(c, tex=True)


@REG.piece('gm-grave-open', '파헤친 무덤 구덩이(흙더미·삽)', 2, 2, ['ff', 'ff'], 'nature', SP, role='prop', kind='flat',
           tags=['무덤', '구덩이', '파헤친'], desc='바닥에 판 직사각 무덤 구덩이(위에서 본 깊은 벽면·어두운 바닥), 옆 흙더미에 꽂힌 삽.', rules='묘지 바닥 위에 덧그림(걸을 수 있음 — 막으려면 이벤트로). 공포 장면의 단서.')
def _grave_open(c):
    c.R(4, 6, 14, 22, K('dirt', 2))
    for y in range(6, 28):
        for x in range(4, 18):
            if y < 10: t = 3 - (y - 6) // 2           # 뒷벽(위에서 보임, 아래로 갈수록 어두움)
            elif x < 6: t = 2
            elif x > 15: t = 1
            else: t = 0
            c.P(x, y, K('dirt', t))
    c.HL(3, 5, 16, K('dirt', 4)); c.VL(3, 5, 24, K('dirt', 4)); c.VL(18, 5, 24, K('dirt', 3)); c.HL(3, 28, 16, K('dirt', 5))
    for y in range(8, 30):                           # 흙더미
        for x in range(19, 31):
            d = ((x - 25) / 6) ** 2 + ((y - 20) / 10) ** 2
            if d <= 1: c.P(x, y, K('dirt', 5 if d < .25 and x < 25 else 4 if x < 26 else 3))
    c.line(27, 6, 24, 18, K('wood', 5)); c.line(28, 6, 25, 18, K('wood', 3)); c.R(23, 17, 4, 4, K('iron', 5)); c.HL(23, 17, 4, K('iron', 6))


@REG.piece('gm-grave-mound', '새 무덤 흙더미(나무 십자가)', 1, 2, ['C', 'S'], 'nature', SP, role='prop', kind='organic',
           tags=['무덤', '흙무덤'], desc='갓 덮은 길쭉한 흙무덤(위에서 본 둔덕)과 머리맡 나무 십자가, 시든 꽃 한 송이.', rules='묘지 가장자리 새 무덤 줄.')
def _mound(c):
    for y in range(14, 31):
        for x in range(1, 15):
            d = ((x - 7.5) / 6.8) ** 2 + ((y - 22) / 8.5) ** 2
            if d > 1: continue
            t = 5 if (y < 19 and x < 9) else 4 if (y < 23 and x < 11) else 3 if x < 12 else 2
            if y > 27: t = min(t, 2)
            if hsh(x // 2, y, 7) < .18: t -= 1
            elif hsh(x, y // 2, 8) > .9: t += 1
            c.P(x, y, K('dirt', t))
    for (x, y) in ((4, 20), (9, 24), (6, 27), (11, 19)): c.P(x, y, K('dirt', 6)); c.P(x + 1, y + 1, K('dirt', 2))
    c.R(7, 2, 2, 15, K('wood', 4)); c.VL(8, 2, 15, K('wood', 2)); c.R(4, 5, 8, 2, K('wood', 4)); c.HL(4, 6, 8, K('wood', 2)); c.HL(7, 2, 2, K('wood', 6))
    c.P(10, 26, K('velvet', 4)); c.P(11, 25, K('velvet', 3)); c.P(10, 27, K('ivy', 2))
    finish(c, tex=True)


@REG.piece('gm-urn', '받침 위 돌 항아리(장례 항아리)', 1, 2, ['C', 'S'], 'nature', SP, role='prop', kind='column',
           tags=['항아리', '묘지', '정원'], desc='네모 받침(윗면 보임) 위 천을 두른 돌 장례 항아리(뚜껑 윗면 타원).', rules='묘지 입구·계단 양옆에 한 쌍.')
def _urn(c):
    block3(c, 2, 18, 12, 4, 10, m='stone', tb=5, fb=3, tex='masonry', seed=12)
    c.R(4, 16, 8, 2, K('stone', 4)); c.HL(4, 16, 8, K('stone', 5))
    c.ellipse(8, 11, 5, 5, K('stone', 4)); c.ellipse(7, 10, 3, 3, K('stone', 5)); c.P(6, 8, K('stone', 6))
    for y in range(8, 16): c.P(12, y, K('stone', 2)); c.P(11, y, K('stone', 3))
    c.ellipse(8, 5, 4, 1.6, K('stone', 5)); c.ellipse(8, 5, 4, 1.6, K('stone', 6), fill=False); c.R(7, 2, 2, 3, K('stone', 5))
    c.R(2, 10, 2, 3, K('stone', 4)); c.R(12, 10, 2, 3, K('stone', 2)); c.P(2, 10, K('stone', 5))
    c.HL(4, 13, 8, K('stone', 2))
    finish(c, tex=True)


@REG.piece('gm-lantern-pillar', '등불 돌기둥(쇠 등롱)', 1, 2, ['C', 'S'], 'nature', 'grounds', role='prop', kind='column',
           tags=['가로등', '등불', '기둥'], desc='뭉툭한 사각 돌기둥(갓돌 윗면 보임) 위에 불 켜진 무쇠 등롱(지붕 윗면 보임).', rules='길가·문 양옆에 2~4칸 간격.')
def _lantern_pillar(c):
    block3(c, 3, 14, 10, 4, 14, m='stone', tb=5, fb=3, tex='masonry', seed=13)
    c.R(2, 13, 12, 2, K('stone', 6)); c.HL(2, 15, 12, K('stone', 2))
    c.R(5, 6, 6, 7, K('glow', 4)); c.VL(5, 6, 7, K('iron', 3)); c.VL(10, 6, 7, K('iron', 1)); c.VL(7, 7, 5, K('glow', 6)); c.HL(5, 12, 6, K('iron', 2))
    for k in range(4): c.HL(4 + k, 5 - k, 8 - 2 * k, K('iron', 4 - (k == 0)))
    c.HL(4, 5, 8, K('iron', 5)); c.P(7, 0, K('iron', 4))
    finish(c, tex=True)


@REG.piece('gm-bench', '돌 벤치(쇠 다리)', 2, 1, ['SS'], 'nature', 'grounds', role='prop', kind='seat',
           tags=['벤치', '의자'], desc='두꺼운 돌 좌판(윗면 5행)과 무쇠 소용돌이 다리 둘.', rules='길가·분수 둘레에 길과 나란히.')
def _bench(c):
    block3(c, 2, 4, 28, 5, 3, m='stone', tb=5, fb=3, seed=14)
    for px in (4, 24):
        c.R(px, 12, 4, 3, K('iron', 3)); c.P(px, 12, K('iron', 5)); c.P(px + 3, 14, K('iron', 1))
        c.P(px + 1, 15, K('iron', 2)); c.P(px + 2, 15, K('iron', 2))
    finish(c, tex=True)


def branch(c, x, y, ang, length, th, depth, rnd, m='bark'):
    """고사목 가지(재귀): 두께 th 를 줄이며 꺾여 뻗고 갈라진다. 굵기는 가지에 수직으로, 위/왼 가장자리 밝게."""
    for k in range(int(length)):
        ang += rnd.uniform(-.16, .16)
        x += math.cos(ang); y += math.sin(ang)
        w = max(1.0, th * (1 - k / length * .45))
        horiz = abs(math.cos(ang)) > abs(math.sin(ang))
        n = int(round(w))
        for d in range(n):
            o = d - (n - 1) / 2
            px, py = (int(x), int(y + o)) if horiz else (int(x + o), int(y))
            t = 4 if d == 0 and n >= 2 else 1 if d == n - 1 and n >= 3 else 2 if n >= 2 else 3
            c.P(px, py, K(m, t))
    if depth <= 0: return
    n = 2 if depth > 1 else rnd.choice((1, 2))
    for i in range(n):
        na = ang + (-.6 if i == 0 else .5) + rnd.uniform(-.2, .2)
        branch(c, x, y, na, length * rnd.uniform(.5, .68), max(1, th * .62), depth - 1, rnd, m)


def dead_tree(c, cx, base_y, height, spread, seed, th=6, depth=3):
    rnd = random.Random(seed)
    # 뿌리 퍼짐
    for k in range(-th - 2, th + 3):
        h = max(0, 3 - abs(k) // 2)
        for y in range(base_y - h, base_y + 1): c.P(cx + k, y, K('bark', 3 if k < 0 else 2 if k < 3 else 1))
    trunk_top = base_y - height * .45
    x, y = float(cx), float(base_y)
    for k in range(int(height * .45)):
        y -= 1; x += math.sin(k * .25 + seed) * .35
        w = th - k / (height * .45) * (th * .35)
        for d in range(int(-w / 2), int(w / 2) + 1):
            t = 4 if d <= int(-w / 2) + 1 else 3 if d < 0 else 2 if d < w / 4 else 1
            if hsh(int(x) + d, int(y) // 3, seed) < .15: t -= 1     # 껍질 결
            c.P(int(x + d), int(y), K('bark', t))
    c.ellipse(int(x) - 1, int(base_y - height * .25), 1.5, 2, K('ink', 1))        # 옹이 구멍
    angs = (-2.25, -1.7, -1.3, -.8) if depth >= 3 else (-2.1, -1.45, -.9)
    for i, a in enumerate(angs):
        branch(c, x + (i - 1.5) * 1.2, y, a + rnd.uniform(-.15, .15), height * rnd.uniform(.3, .4) * spread, th * .62, depth, rnd)


@REG.piece('gm-dead-tree', '큰 고사목(뒤틀린 가지·옹이 구멍)', 3, 4, 'auto', 'nature', SP, role='prop', kind='organic',
           tags=['고사목', '나무', '마른 나무'], desc='잎 하나 없는 뒤틀린 큰 고사목: 굵은 줄기, 뿌리 퍼짐, 옹이 구멍, 갈라지며 가늘어지는 가지.',
           rules='묘지·저택 정원 가장자리에 2~3그루씩 덩이로. 밑동 칸만 막는다.')
def _dead_tree(c):
    dead_tree(c, 24, 61, 60, 1.0, seed=4, th=9, depth=3)
    finish(c, tex=True)


@REG.piece('gm-dead-tree-s', '작은 고사목', 2, 3, 'auto', 'nature', SP, role='prop', kind='organic',
           tags=['고사목', '나무'], desc='가는 줄기의 작은 고사목, 가지 셋.', rules='큰 고사목 곁·길가에.')
def _dead_tree_s(c):
    dead_tree(c, 16, 45, 38, .9, seed=9, th=6, depth=2)
    finish(c, tex=True)


@REG.piece('gm-stump', '고목 그루터기(도끼)', 1, 1, ['S'], 'nature', SP, role='prop', kind='organic',
           tags=['그루터기', '나무'], desc='나이테가 위에서 보이는 그루터기와 박힌 도끼.', rules='고사목 곁에.')
def _stump(c):
    for k in range(-6, 7):
        h = max(0, 2 - abs(k) // 3)
        for y in range(14 - h, 15): c.P(8 + k, y, K('bark', 3 if k < 0 else 1))
    for y in range(7, 14):
        for x in range(3, 13): c.P(x, y, K('bark', 4 if x < 6 else 3 if x < 10 else 2))
    c.ellipse(8, 6.5, 5, 2.6, K('wood', 5)); c.ellipse(8, 6.5, 3, 1.4, K('wood', 4), fill=False); c.P(8, 6, K('wood', 3))
    c.line(10, 3, 12, 7, K('wood', 5)); c.R(9, 5, 3, 2, K('iron', 5))
    finish(c, tex=True)


@REG.piece('gm-bramble', '가시 덤불(마른 넝쿨·붉은 열매)', 2, 1, ['SS'], 'nature', SP, role='prop', kind='organic',
           tags=['덤불', '가시', '넝쿨'], desc='마른 가시 넝쿨 덩이(어두운 속·밝은 윗가지)와 검붉은 열매 몇.', rules='담·철책 밑, 무덤 사이에 낮게.')
def _bramble(c):
    rnd = random.Random(14)
    for k in range(40):
        x, y = rnd.uniform(3, 29), rnd.uniform(5, 14)
        a = rnd.uniform(-3, 0)
        for s in range(rnd.randint(3, 7)):
            x += math.cos(a); y += math.sin(a) * .6
            c.P(int(x), int(y), K('bark', 1 + (y < 9) + (y < 7)))
            if s % 3 == 0: c.P(int(x) + 1, int(y) - 1, K('bark', 4))
    for (x, y) in ((8, 8), (19, 7), (24, 11), (13, 12)): c.P(x, y, K('velvet', 4)); c.P(x + 1, y, K('velvet', 2))
    finish(c, tex=True)


@REG.piece('gm-coffin', '나무 관(닫힘)', 2, 1, ['SS'], 'nature', 'crypt', role='prop', kind='box',
           tags=['관', '장례'], desc='육각 나무 관: 뚜껑 윗면(8행, 십자 새김), 앞면 띠, 놋쇠 손잡이.', rules='납골당·장례 장면 바닥에.')
def _coffin(c):
    pts = [(2, 6), (8, 2), (26, 2), (30, 6), (26, 10), (8, 10)]
    c.poly(pts, K('wood', 5))
    c.poly([(2, 7), (8, 11), (26, 11), (30, 7), (30, 11), (26, 15), (8, 15), (2, 11)], K('wood', 2))
    c.line(8, 2, 26, 2, K('wood', 6)); c.line(2, 6, 8, 2, K('wood', 6)); c.line(8, 10, 26, 10, K('wood', 4))
    c.HL(13, 6, 7, K('wood', 3)); c.VL(15, 4, 5, K('wood', 3))
    for px in (10, 22): c.R(px, 12, 3, 1, K('gold', 4))
    finish(c, tex=True)


@REG.piece('gm-coffin-open', '열린 관(빈 안쪽·비스듬한 뚜껑)', 2, 2, ['SS', 'SS'], 'nature', 'crypt', role='prop', kind='container',
           tags=['관', '빈 관', '흡혈귀'], desc='뚜껑이 벗겨진 나무 관: 위에서 들여다보이는 검붉은 비단 안쪽(아가리 6행), 옆에 기대 놓은 뚜껑.', rules='납골당·지하실 공포 장면에.')
def _coffin_open(c):
    pts = [(2, 14), (8, 9), (26, 9), (30, 14), (26, 19), (8, 19)]
    c.poly(pts, K('wood', 4))
    c.poly([(5, 14), (9, 11), (25, 11), (28, 14), (25, 17), (9, 17)], K('velvet', 2))
    c.poly([(6, 14), (10, 12), (24, 12), (26, 14), (24, 15), (10, 15)], K('velvet', 3))
    c.line(10, 12, 24, 12, K('velvet', 1))
    c.poly([(2, 15), (8, 20), (26, 20), (30, 15), (30, 19), (26, 24), (8, 24), (2, 19)], K('wood', 2))
    c.line(8, 9, 26, 9, K('wood', 6))
    c.poly([(20, 0), (31, 3), (31, 8), (20, 6)], K('wood', 5)); c.line(20, 0, 31, 3, K('wood', 6))
    finish(c, tex=True)


@REG.piece('gm-statue-mourner', '애도하는 두건 석상', 1, 2, ['C', 'S'], 'nature', SP, role='prop', kind='figure',
           tags=['석상', '조각상', '애도'], desc='두건을 쓰고 고개 숙인 대리석 애도자 석상, 넓은 받침(윗면 보임).', rules='묘소 양옆·묘지 입구에.')
def _mourner(c):
    plinth(c, 1, 24, 14, 3, 5, m='stone', seed=15)
    st = 'stone'
    for y in range(4, 24):
        f = (y - 4) / 20
        hw = 2.5 + f * 3.5
        for x in range(int(8 - hw), int(8 + hw) + 1):
            u = (x - (8 - hw)) / (2 * hw)
            t = 5 if u < .3 else 4 if u < .6 else 3 if u < .85 else 2
            c.P(x, y, K(st, t))
    for y in range(8, 24, 3): c.P(9, y, K(st, 2)); c.P(6, y + 1, K(st, 4))
    c.ellipse(8, 5, 3, 3, K(st, 4)); c.R(7, 5, 3, 3, K('ink', 2)); c.P(6, 3, K(st, 6))      # 두건 속 그늘 얼굴
    c.R(6, 11, 5, 3, K(st, 5)); c.HL(6, 13, 5, K(st, 3))
    finish(c, tex=True)


@REG.piece('gm-statue-gargoyle', '받침 위 가고일 석상', 1, 2, ['C', 'S'], 'nature', 'grounds', role='prop', kind='figure',
           tags=['가고일', '석상', '조각상'], desc='날개 접고 웅크린 돌 가고일(뿔·드러낸 이빨), 네모 받침(윗면 보임).', rules='문 양옆·계단 끝에 한 쌍.')
def _gargoyle(c):
    block3(c, 2, 17, 12, 4, 11, m='stone', tb=5, fb=3, tex='masonry', seed=16)
    st = 'stone'
    c.ellipse(8, 13, 5, 4, K(st, 4)); c.ellipse(7, 12, 3, 2, K(st, 5))
    for k in range(5): c.P(2 + k, 7 + k // 2, K(st, 3)); c.P(13 - k, 7 + k // 2, K(st, 2))   # 접은 날개
    c.R(2, 8, 3, 5, K(st, 3)); c.R(11, 8, 3, 5, K(st, 2))
    c.ellipse(8, 7, 3, 3, K(st, 4)); c.P(6, 3, K(st, 5)); c.P(10, 3, K(st, 3)); c.P(6, 4, K(st, 4)); c.P(10, 4, K(st, 3))
    c.P(7, 7, K('velvet', 5)); c.P(9, 7, K('velvet', 5)); c.HL(7, 9, 3, K('ink', 1)); c.P(7, 10, K('bone', 5)); c.P(9, 10, K('bone', 5))
    c.R(5, 15, 2, 2, K(st, 3)); c.R(9, 15, 2, 2, K(st, 2))
    finish(c, tex=True)


@REG.piece('gm-crow-post', '까마귀가 앉은 부러진 돌기둥', 1, 2, ['C', 'S'], 'nature', SP, role='prop', kind='column',
           tags=['까마귀', '기둥', '폐허'], desc='위가 부러진 돌기둥(깨진 윗면 보임) 위에 앉은 검은 까마귀(붉은 눈).', rules='묘지·길목에 하나씩. 까마귀 떼는 두셋을 흩어서.')
def _crow_post(c):
    block3(c, 4, 12, 8, 4, 18, m='stone', tb=5, fb=3, tex='masonry', seed=17)
    c.P(4, 12, (0, 0, 0, 0)); c.P(11, 12, (0, 0, 0, 0)); c.P(10, 12, K('stone', 3))
    # 까마귀
    c.ellipse(8, 8, 3.5, 2.5, K('ink', 2)); c.ellipse(6, 5, 2, 2, K('ink', 2)); c.HL(3, 5, 2, K('iron', 2)); c.P(6, 4, K('velvet', 5))
    c.line(10, 8, 13, 10, K('ink', 1)); c.P(7, 7, K('iron', 3)); c.P(8, 7, K('iron', 3))
    c.P(7, 11, K('iron', 2)); c.P(9, 11, K('iron', 2))
    finish(c, tex=True)


@REG.piece('gm-bones', '흩어진 뼈와 해골', 1, 1, ['f'], 'nature', 'crypt', role='prop', kind='debris',
           tags=['뼈', '해골'], desc='바닥에 흩어진 해골 하나와 긴 뼈 둘.', rules='납골당·지하실 바닥 덧그림.')
def _bones(c):
    c.ellipse(5, 9, 3, 2.6, K('bone', 5)); c.P(4, 9, K('ink', 1)); c.P(6, 9, K('ink', 1)); c.HL(4, 11, 3, K('bone', 3)); c.P(4, 8, K('bone', 6))
    c.line(8, 12, 14, 9, K('bone', 5)); c.P(8, 13, K('bone', 4)); c.P(14, 8, K('bone', 4)); c.line(9, 13, 14, 10, K('bone', 3))
    c.line(9, 4, 13, 6, K('bone', 4)); c.P(9, 3, K('bone', 6))
    finish(c, tex=True)


if __name__ == '__main__':
    sys.exit(1 if run_module(MODULE) else 0)
