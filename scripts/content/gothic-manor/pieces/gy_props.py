"""공동묘지 소품 — 묘비(두꺼운 돌판: 윗면이 보이게)·십자가·오벨리스크·석관·무덤·석상·고사목·덤불·관·등불 기둥·벤치."""
import os, sys, math, random
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
from gmlib import REG, Cv, K, OL, OL2, run_module   # noqa: E402
from gmdraw import *                                  # noqa: E402,F403

MODULE = 'gy_props'
SP = 'graveyard'


def plinth(c, x, y, w, top=3, front=3, m='stone', tb=6, fb=3, seed=0):
    """받침돌: 윗면(밝음) + 앞면(어둠), 뒷변 어두운 선은 외곽선이 맡는다."""
    block3(c, x, y, w, top, front, m=m, tb=tb, fb=fb, seed=seed)


def headstone(c, x, y_face, w, h, depth=5, m='stone', arch=True, seed=0, mark='cross', tilt=0, pointed=False):
    """두꺼운 돌 묘비: 앞면(어둠, 둥근/첨두 머리) + 그 위로 depth 행 윗면(돌 두께를 위에서 본 밝은 면) + 어두운 뒷변.
    tilt 는 위로 갈수록 x 를 민다."""
    r = w / 2
    prof = arch_profile(w)[0] if pointed else None
    def ftop(i):
        if pointed: return prof[i]
        if not arch: return 0
        dx = abs(i + .5 - r) / r
        return int(round(r * .8 * (1 - math.sqrt(max(0, 1 - dx * dx))))) if dx < 1 else int(r)
    for i in range(w):
        t0 = y_face + ftop(i)
        for yy in range(t0, y_face + h):
            sh = int((y_face + h - yy) * tilt)
            t = 3 if 0 < i < w - 2 else (4 if i == 0 else 2)
            if yy == t0: t = 2                                   # 윗면 앞 모서리 밑 그늘
            c.P(x + i + sh, yy, K(m, t))
        for k in range(1, depth + 1):          # 윗면: 앞 머리선 위로 depth 행(깨끗한 밝은 면)
            sh = int((y_face + h - (t0 - k)) * tilt)
            t = 5 if k == 1 else 6
            c.P(x + i + sh, t0 - k, K(m, t))
        sh = int((y_face + h - (t0 - depth - 1)) * tilt)
        c.P(x + i + sh, t0 - depth - 1, K(m, 1))                # 뒷변(어두운 선)
    cx = x + w // 2
    if mark == 'cross':
        yy = y_face + h // 2 - 2; sh = int(h // 2 * tilt)
        c.VL(cx + sh, yy, 5, K(m, 1)); c.HL(cx - 2 + sh, yy + 1, 5, K(m, 1))
    elif mark == 'lines':
        for k in range(2): c.HL(x + 2, y_face + 3 + k * 2, w - 4, K(m, 1))
    elif mark == 'skull':
        c.R(cx - 2, y_face + 2, 5, 3, K('bone', 4)); c.P(cx - 1, y_face + 3, K('ink', 1)); c.P(cx + 1, y_face + 3, K('ink', 1)); c.HL(cx - 1, y_face + 5, 3, K('bone', 3))


@REG.piece('gm-tomb-round', '둥근 머리 묘비(두꺼운 돌·십자 새김)', 1, 1, ['S'], 'nature', SP, role='prop', kind='column',
           tags=['묘비', '무덤'], desc='둥근 머리의 두꺼운 회색 묘비: 위에서 보이는 돌 두께(윗면 4행), 십자 새김, 받침돌, 이끼.',
           rules='묘지에 2~3칸 간격 줄로. 앞(아래) 칸은 비워 둔다.')
def _tomb_round(c):
    plinth(c, 1, 11, 14, 3, 3, seed=1)
    headstone(c, 3, 7, 10, 6, depth=5, seed=1)
    finish(c)


@REG.piece('gm-tomb-broken', '부서진 묘비(그루터기 + 쓰러진 조각)', 1, 1, ['S'], 'nature', SP, role='prop', kind='column',
           tags=['묘비', '폐허'], desc='위가 부러진 묘비 그루터기(깨진 윗면이 보임)와 앞에 쓰러진 머리 조각.', rules='폐허 묘지에.')
def _tomb_broken(c):
    plinth(c, 2, 11, 12, 3, 3, seed=4)
    for i in range(9):                         # 부러진 그루터기: 깨진 윗면 5행(밝음) + 앞면
        top = 6 + (i * 7) % 3 + (1 if i > 5 else 0)
        for yy in range(top, 12): c.P(4 + i, yy, K('stone', 4 if i < 2 else 3 if i < 7 else 2))
        c.P(4 + i, top, K('stone', 2))
        for k in range(1, 5): c.P(4 + i, top - k, K('stone', 6 if k < 3 else 5) if hsh(i, k, 4) > .2 else K('stone', 4))
        c.P(4 + i, top - 5, K('stone', 1))
    block3(c, 0, 12, 6, 2, 2, m='stone', tb=6, fb=3)                      # 쓰러진 머리 조각
    finish(c)


@REG.piece('gm-tomb-cross', '돌 십자가 묘비', 1, 2, ['C', 'S'], 'nature', SP, role='prop', kind='column',
           tags=['십자가', '묘비'], desc='두꺼운 돌 십자가(팔·머리 윗면이 보임) + 두 단 받침.', rules='묘지 줄 끝·중요한 무덤에.')
def _tomb_cross(c):
    slab(c, 0, 20, 16, 8, 4, seams=5)                                    # 넓은 받침: 윗면 8행
    slab(c, 3, 15, 10, 5, 3, seams=4)                                     # 둘째 단: 윗면 5행
    for x0, w in ((0, 5), (11, 5)):                                       # 팔: 윗면 4행 + 앞면 3행
        slab(c, x0, 6, w, 4, 3, seams=0)
    slab(c, 5, 0, 6, 4, 13, seams=0)                                      # 세로: 머리 윗면 4행 + 긴 앞면
    c.R(5, 4, 6, 13, K('stone', 3)); c.VL(5, 4, 13, K('stone', 4)); c.VL(10, 4, 13, K('stone', 2)); c.HL(5, 4, 6, K('stone', 4))
    finish(c)


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
    block3(c, 1, 3, 30, 10, 3, m=st, tb=5, fb=3, seed=14)               # 두꺼운 뚜껑: 윗면 10행
    c.HL(1, 2, 30, K(st, 1))
    c.R(13, 5, 6, 6, K(st, 6)); c.HL(13, 5, 6, K(st, 6)); c.HL(13, 11, 6, K(st, 3)); c.VL(18, 5, 6, K(st, 3))   # 뚜껑 위 십자 돋을새김
    c.R(15, 4, 2, 9, K(st, 6)); c.R(11, 7, 10, 2, K(st, 6)); c.HL(11, 9, 10, K(st, 3)); c.VL(17, 4, 9, K(st, 3))
    c.R(3, 16, 26, 12, K(st, 3)); c.VL(3, 16, 12, K(st, 4)); c.VL(28, 16, 12, K(st, 1)); c.HL(3, 16, 26, K(st, 2))
    for px in (5, 13, 21):
        c.R(px, 18, 7, 7, K(st, 2)); c.HL(px, 24, 7, K(st, 4)); c.VL(px + 6, 18, 7, K(st, 4))
    c.R(14, 19, 5, 3, K(st, 5)); c.P(15, 20, K('ink', 1)); c.P(17, 20, K('ink', 1)); c.HL(15, 22, 3, K(st, 4))
    c.R(1, 28, 30, 3, K('stone', 3)); c.HL(1, 28, 30, K('stone', 5))
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


@REG.piece('gm-urn', '받침 위 돌 항아리(장례 항아리)', 1, 2, ['C', 'S'], 'nature', SP, role='prop', kind='container',
           tags=['항아리', '묘지', '정원'], desc='네모 받침(윗면 보임) 위 천을 두른 돌 장례 항아리(뚜껑 윗면 타원).', rules='묘지 입구·계단 양옆에 한 쌍.')
def _urn(c):
    block3(c, 2, 18, 12, 5, 9, m='stone', tb=6, fb=3, seed=12)
    c.R(5, 15, 6, 3, K('stone', 3)); c.HL(5, 15, 6, K('stone', 4))      # 굽
    prof = [3, 4, 5, 5.5, 6, 6, 5.5, 5, 4, 3]
    for j, hw in enumerate(prof):                                        # 몸: 어깨가 넓은 항아리
        y = 6 + j
        for x in range(int(round(8 - hw)), int(round(8 + hw))):
            u = (x - (8 - hw)) / (2 * hw)
            c.P(x, y, K('stone', 5 if u < .3 else 4 if u < .62 else 3 if u < .85 else 2))
    c.HL(3, 9, 10, K('stone', 2)); c.HL(3, 10, 10, K('stone', 5))        # 띠
    c.ellipse(8, 3.5, 6, 3.5, K('stone', 6)); c.ellipse(8, 3.5, 6, 3.5, K('stone', 4), fill=False)   # 넓은 아가리 테(위에서 보임)
    c.ellipse(8, 3.8, 4.4, 2.4, K('ink', 1)); c.HL(6, 4, 3, K('ivy', 2)); c.P(9, 3, K('ivy', 3))
    finish(c)


@REG.piece('gm-lantern-pillar', '등불 돌기둥(쇠 등롱)', 1, 2, ['C', 'S'], 'nature', 'grounds', role='prop', kind='column',
           tags=['가로등', '등불', '기둥'], desc='뭉툭한 사각 돌기둥(갓돌 윗면 보임) 위에 불 켜진 무쇠 등롱(지붕 윗면 보임).', rules='길가·문 양옆에 2~4칸 간격.')
def _lantern_pillar(c):
    for y in range(9, 30):                                                # 둥근 돌기둥: 원통 몸
        for x in range(2, 14):
            u = (x + .5 - 2) / 12; c.P(x, y, K('stone', 4 if u < .3 else 3 if u < .7 else 2))
        if y % 6 == 0: c.HL(2, y, 12, K('stone', 2))
    c.HL(2, 29, 12, K('stone', 1))
    c.ellipse(8, 9, 7, 4.4, K('stone', 2)); c.ellipse(8, 8, 7, 4.4, K('stone', 6)); c.ellipse(7, 7, 3.5, 1.8, K('stone', 5))   # 타원 갓 윗면
    c.R(5, 14, 6, 9, K('iron', 1)); c.R(6, 15, 4, 7, K('glow', 4)); c.VL(7, 16, 5, K('glow', 6)); c.HL(5, 14, 6, K('iron', 3))   # 앞면 등 감실
    finish(c)


@REG.piece('gm-bench', '돌 벤치(쇠 다리)', 2, 1, ['SS'], 'nature', 'grounds', role='prop', kind='seat',
           tags=['벤치', '의자'], desc='두꺼운 돌 좌판(윗면 5행)과 무쇠 소용돌이 다리 둘.', rules='길가·분수 둘레에 길과 나란히.')
def _bench(c):
    block3(c, 2, 4, 28, 5, 3, m='stone', tb=5, fb=3, seed=14)
    for px in (4, 24):
        c.R(px, 12, 4, 3, K('iron', 3)); c.P(px, 12, K('iron', 5)); c.P(px + 3, 14, K('iron', 1))
        c.P(px + 1, 15, K('iron', 2)); c.P(px + 2, 15, K('iron', 2))
    finish(c, tex=True)


def _branch_tone(d, n, px, py):
    """가지 단면 명암(빛 왼위): 윗 가장자리 밝음 → 가운데 → 밑 그늘. 1px 가지는 껍질 결로 두 단을 번갈아."""
    if n >= 3: t = 5 if d == 0 else 1 if d == n - 1 else 3 if d < n - 2 or n == 3 else 2
    elif n == 2: t = 4 if d == 0 else 2
    else: t = 3 if hsh(px, py, 7) < .6 else 2
    return t


def branch(c, x, y, ang, length, th, depth, rnd, m='bark'):
    """고사목 가지(재귀): 두께 th 를 줄이며 꺾여 뻗고 갈라진다. 굵기는 가지에 수직으로, 윗 가장자리 밝고 밑은 그늘(4~5단)."""
    for k in range(int(length)):
        ang += rnd.uniform(-.16, .16)
        x += math.cos(ang); y += math.sin(ang)
        w = max(1.0, th * (1 - k / length * .45))
        horiz = abs(math.cos(ang)) > abs(math.sin(ang))
        n = int(round(w))
        for d in range(n):
            o = d - (n - 1) / 2
            px, py = (int(x), int(y + o)) if horiz else (int(x + o), int(y))
            t = _branch_tone(d, n, px, py)
            if n >= 3 and 0 < d < n - 1 and hsh(px // 2, py, 9) < .14: t -= 1        # 껍질 갈라짐
            c.P(px, py, K(m, t))
    if depth <= 0: return
    n = 2 if depth > 1 else rnd.choice((1, 2))
    for i in range(n):
        na = ang + (-.6 if i == 0 else .5) + rnd.uniform(-.2, .2)
        branch(c, x, y, na, length * rnd.uniform(.5, .68), max(1, th * .62), depth - 1, rnd, m)


def _trunk_tone(u):
    """원통 줄기 단면 u(0 왼 → 1 오른) → 껍질 단(빛 왼위, 5단)."""
    return 5 if u < .16 else 4 if u < .36 else 3 if u < .6 else 2 if u < .84 else 1


def dead_tree(c, cx, base_y, height, spread, seed, th=6, depth=3, moss=True):
    rnd = random.Random(seed)
    # 뿌리 퍼짐: 줄기에서 흘러내린 둔덕(왼 밝음 → 오른 그늘) + 땅으로 파고드는 뿌리 끝
    for k in range(-th - 2, th + 3):
        h = max(0, 3 - abs(k) // 2)
        u = (k + th + 2) / (2 * th + 5)
        for y in range(base_y - h, base_y + 1):
            t = _trunk_tone(u) - (1 if y == base_y else 0)
            c.P(cx + k, y, K('bark', max(1, t)))
    for (dx, L) in ((-th - 2, 3), (th + 2, 2)):
        for i in range(L): c.P(cx + dx + (i if dx > 0 else -i), base_y - (1 if i == 0 else 0), K('bark', 3 if dx < 0 else 2))
    trunk_top = base_y - height * .45
    x, y = float(cx), float(base_y)
    hh = int(height * .45)
    for k in range(hh):
        y -= 1; x += math.sin(k * .25 + seed) * .35
        w = th - k / (height * .45) * (th * .35)
        lo, hi = int(-w / 2), int(w / 2)
        for d in range(lo, hi + 1):
            u = (d - lo + .5) / (hi - lo + 1)
            t = _trunk_tone(u)
            px = int(x + d)
            if hsh(px, int(y) // 3, seed) < .16 and 0 < u < .9: t -= 1                 # 세로 껍질 골(3행 단위로 이어진다)
            elif hsh(px, int(y) // 5, seed + 3) > .93 and u < .7: t += 1               # 껍질 결 볕
            c.P(px, int(y), K('bark', t))
            if moss and k < hh * .55 and u < .3 and hsh(px // 2, int(y) // 2, seed + 5) < .32:   # 북서쪽 이끼
                c.P(px, int(y), K('ivy', 3 if hsh(px, int(y), seed + 6) < .5 else 4))
    kx, ky = int(cx) - 1, int(base_y - height * .25)                                # 옹이 구멍: 깊은 속 + 밝은 위 입술
    c.ellipse(kx, ky, 1.5, 2, K('bark', 0)); c.P(kx - 1, ky - 2, K('bark', 5)); c.P(kx, ky - 2, K('bark', 4)); c.P(kx + 1, ky + 1, K('bark', 2))
    angs = (-2.25, -1.7, -1.3, -.8) if depth >= 3 else (-2.1, -1.45, -.9)
    for i, a in enumerate(angs):
        branch(c, x + (i - 1.5) * 1.2, y, a + rnd.uniform(-.15, .15), height * rnd.uniform(.3, .4) * spread, th * .62, depth, rnd)


@REG.piece('gm-dead-tree', '큰 고사목(뒤틀린 가지·옹이 구멍)', 3, 4, 'auto', 'nature', SP, role='prop', kind='organic',
           tags=['고사목', '나무', '마른 나무'], desc='잎 하나 없는 뒤틀린 큰 고사목: 굵은 줄기, 뿌리 퍼짐, 옹이 구멍, 갈라지며 가늘어지는 가지.',
           rules='묘지·저택 정원 가장자리에 2~3그루씩 덩이로. 밑동 칸만 막는다.')
def _dead_tree(c):
    dead_tree(c, 24, 61, 60, 1.0, seed=4, th=9, depth=3)
    finish(c, tex=True, soft=True)


@REG.piece('gm-dead-tree-s', '작은 고사목', 2, 3, 'auto', 'nature', SP, role='prop', kind='organic',
           tags=['고사목', '나무'], desc='가는 줄기의 작은 고사목, 가지 셋.', rules='큰 고사목 곁·길가에.')
def _dead_tree_s(c):
    dead_tree(c, 16, 45, 38, .9, seed=9, th=6, depth=2)
    finish(c, tex=True, soft=True)


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


@REG.piece('gm-bones', '흩어진 뼈와 해골', 1, 1, ['f'], 'nature', 'crypt', role='prop', kind='debris',
           tags=['뼈', '해골'], desc='바닥에 흩어진 해골 하나와 긴 뼈 둘.', rules='납골당·지하실 바닥 덧그림.')
def _bones(c):
    c.ellipse(5, 9, 3, 2.6, K('bone', 5)); c.P(4, 9, K('ink', 1)); c.P(6, 9, K('ink', 1)); c.HL(4, 11, 3, K('bone', 3)); c.P(4, 8, K('bone', 6))
    c.line(8, 12, 14, 9, K('bone', 5)); c.P(8, 13, K('bone', 4)); c.P(14, 8, K('bone', 4)); c.line(9, 13, 14, 10, K('bone', 3))
    c.line(9, 4, 13, 6, K('bone', 4)); c.P(9, 3, K('bone', 6))
    finish(c, tex=True)


if __name__ == '__main__':
    sys.exit(1 if run_module(MODULE) else 0)
