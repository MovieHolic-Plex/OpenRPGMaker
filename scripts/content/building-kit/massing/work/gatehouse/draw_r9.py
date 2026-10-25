"""성문루(gatehouse, 덩어리 모형 16) — 두 원탑(청석 원뿔) 사이 큰 징 박힌 두짝 성문(유일한 문) + 위 총안 회랑. 10×8칸.
판 2(2026-10-25): 검수 반려 반영 — 뚫린 통로 대신 닫힌 성문, 탑 문 없앰, 회랑 바닥 깊이 12px + 뒤 총안,
두 탑을 다르게(돌·창·깃발·꼭대기), 마름돌 대비 강하게, 원뿔 기와 줄을 꼭짓점으로 모이게.
다시 돌리면 같은 그림. 난수 없음."""
import math
import os
import sys

ROOT = __import__('os').path.abspath(__file__).rsplit('/scripts/content/building-kit/', 1)[0]
os.chdir(ROOT)
sys.path.insert(0, 'src/harnesses/building-kit')
sys.path.insert(0, 'scripts/content/building-kit/massing/work/chapel')
from massing_lib import Canvas  # noqa: E402
import pix  # noqa: E402
from pix import ST, sclamp, Ashlar  # noqa: E402

W, H = 10, 8
c = Canvas(W, H)
GY = 127                      # 땅 줄

# ---------------------------------------------------------------- 가운데 몸채
BX0, BX1 = 38, 121
FACE_Y = 61
ARCH_X0, ARCH_X1 = 61, 98
SPRING = 102
GATE_TOP = 89                 # 이보다 위는 들어 올린 쇠살문이 걸린 어두운 홈


def arch_inside(x, y, pad=0):
    x0, x1 = ARCH_X0 - pad, ARCH_X1 + pad
    if x < x0 or x > x1:
        return False
    if y >= SPRING:
        return True
    w = x1 - x0 + 1
    rr = w * 0.6
    cxl, cxr = x0 + rr, x1 + 1 - rr
    yy = y + 0.5
    dy = SPRING - yy
    return (x + 0.5 - cxl) ** 2 + dy ** 2 <= rr ** 2 and (x + 0.5 - cxr) ** 2 + dy ** 2 <= rr ** 2


wall_ash = Ashlar([6, 6, 5, 6, 6, 5, 6], seed=2)


def wall_shade(x, y):
    s = 0
    if y < FACE_Y + 4:
        s -= [3, 2, 1, 1][y - FACE_Y]
    if x < BX0 + 5 or x > BX1 - 5:
        s -= 1
    return s


pix.flat_wall(c, BX0, FACE_Y, BX1 - BX0 + 1, GY - FACE_Y + 1, wall_ash, shade=wall_shade,
              mask=lambda x, y: not arch_inside(x, y, 0))
# 기초 줄(크고 어두운 돌)
base_ash = Ashlar([5], seed=9, widths=[14, 11, 16, 12, 10, 15, 13, 9, 17], dark=2)
pix.flat_wall(c, BX0, GY - 4, BX1 - BX0 + 1, 5, base_ash, mask=lambda x, y: not arch_inside(x, y, 0))

# 홍예석
VOUS = 'bacbabcabbcabacb'
ACX = (ARCH_X0 + ARCH_X1 + 1) / 2
for y in range(70, SPRING + 1):
    for x in range(ARCH_X0 - 5, ARCH_X1 + 6):
        if arch_inside(x, y, 4) and not arch_inside(x, y, 0):
            ang = math.atan2(SPRING - y, x + 0.5 - ACX)
            k = int((ang / math.pi) * 15)
            t = int(VOUS[k % len(VOUS)], 16) - 1
            frac = (ang / math.pi) * 15 - k
            if frac < 0.14:
                t = 2
            elif not arch_inside(x, y, 3):
                t -= 2
            elif arch_inside(x, y, 1):
                t -= 3
            c.put(x, y, sclamp(t))
# 홍예 기둥(아치 시작 아래, 문설주 돌)
for y in range(SPRING, GY - 4):
    for k in range(4):
        lt = ['s', 'r', 'n', 'j'][k] if (y - SPRING) % 7 else ['m', 'k', 'j', 'e'][k]
        rt = ['k', 'j', 'i', 'a'][k] if (y - SPRING) % 7 else ['j', 'i', 'e', 'Y'][k]
        c.put(ARCH_X0 - 4 + k, y, lt)
        c.put(ARCH_X1 + 1 + k, y, rt)
# 이맛돌
c.rows(77, 72, ['.srrmj.', 'srnmkji', '.rnmki.', '..mkj..'])

# 아치 안 위쪽: 어두운 홈 + 들어 올린 쇠살문 이빨
for y in range(70, GATE_TOP):
    for x in range(ARCH_X0, ARCH_X1 + 1):
        if arch_inside(x, y, 0):
            c.put(x, y, 'T' if y < GATE_TOP - 6 else 'U')
for x in range(ARCH_X0 + 2, ARCH_X1, 4):
    for y in range(74, GATE_TOP - 1):
        if arch_inside(x, y - 2, 0):
            c.put(x, y, 'X' if y < GATE_TOP - 3 else 'e')
    if arch_inside(x, GATE_TOP - 1, 0):
        c.put(x, GATE_TOP - 1, 'h')
for y in (79, 84):
    for x in range(ARCH_X0, ARCH_X1 + 1):
        if arch_inside(x, y, 0) and arch_inside(x, y - 4, 0):
            c.put(x, y, 'X' if x % 4 else 'e')

# 두짝 성문(유일한 문): 세로 판자 + 쇠띠 셋 + 징 + 고리
PL = 'ηθεηθηεθηθεηθηεθηθεη'      # 판자 밝기(손으로)
for y in range(GATE_TOP, GY + 1):
    for x in range(ARCH_X0, ARCH_X1 + 1):
        if not arch_inside(x, y, 0):
            continue
        lx = x - ARCH_X0
        left = x < ACX
        pk = lx // 4
        lu = lx % 4
        ch = PL[pk % len(PL)]
        if lu == 0:
            ch = '-'
        elif lu == 1 and y % 9 not in (3,):
            ch = {'η': 'μ', 'θ': 'λ', 'ε': 'η'}[ch] if left else ch
        if lu == 3 and not left:
            ch = 'δ'
        # 문 위 끝(아치 따라) 어두운 테
        if not arch_inside(x, y - 1, 0) or not arch_inside(x - 1, y, 0) or not arch_inside(x + 1, y, 0):
            ch = '_'
        c.put(x, y, ch)
# 가운데 맞닿는 선
for y in range(GATE_TOP, GY + 1):
    c.put(int(ACX) - 1, y, '|')
    c.put(int(ACX), y, 'ε')
# 문 위 끝 그늘 2줄
for x in range(ARCH_X0, ARCH_X1 + 1):
    for d, ch in ((0, '|'), (1, '_')):
        if arch_inside(x, GATE_TOP + d, 0):
            c.put(x, GATE_TOP + d, ch)
# 쇠띠 셋(징 박음)
for by in (96, 108, 120):
    for x in range(ARCH_X0 + 1, ARCH_X1):
        if not arch_inside(x, by, 0):
            continue
        c.put(x, by - 1, 'W')
        c.put(x, by, 'e' if x % 5 == 2 else 'X')
        c.put(x, by + 1, 'U')
    for x in range(ARCH_X0 + 3, ARCH_X1 - 1, 5):
        if arch_inside(x, by, 0) and abs(x - ACX) > 1:
            c.put(x, by, 'm')
# 징(판자 사이)
for y in (101, 102, 113, 114):
    for x in range(ARCH_X0 + 2, ARCH_X1, 8):
        if arch_inside(x, y, 0) and y in (101, 113):
            c.put(x, y, 'j')
            c.put(x, y + 1, 'a')
# 고리 손잡이(금)
c.rows(int(ACX) - 6, 110, ['.W.', 'WkW', 'e.e', '.e.'])
c.rows(int(ACX) + 3, 110, ['.W.', 'WkW', 'e.e', '.e.'])
# 문턱
for x in range(ARCH_X0 - 4, ARCH_X1 + 5):
    c.put(x, GY - 1, 'k' if x % 6 else 'i')
    c.put(x, GY, 'e' if x % 6 else 'a')

# 아치 위 문장(방패, 글자 없음)
c.rows(74, 63, [
    '...YWWWWY...',
    '..EEEEEEEE..',
    '.EGHGGFFFEB.',
    '.EGKLGFKFEB.',
    '.EFGKLKFFEB.',
    '..EFGKFFEB..',
    '...EFKFEB...',
    '....EEBB....',
])

# 회랑(몸채 꼭대기): 뒤 총안 → 걷는 바닥(12px) → 앞 총안
BACK = 18
DECK0, DECK1 = 26, 47
MER = 48


def merlon_row(y0, period, offset, face_h, back=False):
    for x in range(BX0, BX1 + 1):
        k = (x - BX0 + offset) % period
        if k < 6:
            c.put(x, y0, ['s', 'r', 'r', 'r', 'n', 'k'][k])
            c.put(x, y0 + 1, ['r', 'n', 'n', 'm', 'm', 'j'][k])
            for y in range(y0 + 2, y0 + 2 + face_h):
                t = [10, 9, 8, 8, 7, 5][k] - (1 if back else 0)
                if y == y0 + 1 + face_h:
                    t -= 2
                if y == y0 + 4 and k in (2, 3):
                    t -= 2      # 이 앞면 돌 줄눈
                c.put(x, y, sclamp(t))
        else:
            return_k = k - 6
            yield (x, return_k)


# 뒤 흉벽: 낮은 벽 + 이(이 안쪽 면이 남쪽을 본다)
for x in range(BX0, BX1 + 1):
    for y in range(BACK + 4, DECK0):
        c.put(x, y, 'k' if y < DECK0 - 1 else 'i')
for x, g in merlon_row(BACK, 9, 4, 3, back=True):
    c.put(x, BACK + 2, 'i')
    c.put(x, BACK + 3, 'k')
    c.put(x, BACK + 4, 'm')
# 걷는 바닥(위에서 보는 수평 판석 13px): 줄은 뒤로 갈수록 얕다(2·3·3·4·…), 판석은 길고(10~16px) 밝은 윗면,
# 이음은 한 단 어두운 회색. 뒤 두 줄은 뒤 흉벽 그늘. 바닥 위 나무 들창 하나 + 화로 하나(걷는 곳이라는 표시).
DROWS = [2, 3, 3, 4, 4, 6]
FLAGW = [13, 10, 16, 11, 14, 12, 15, 10, 13]
FT = 'zy0zyzx0yzyx'
y = DECK0
for ri, rh in enumerate(DROWS):
    x = BX0 - [0, 6, 3, 9, 5, 1][ri % 6]
    n = ri * 4
    for yy in range(y, min(y + rh, DECK1 + 1)):
        fy = yy - y
        xx0 = x
        nn = n
        while xx0 <= BX1:
            w = FLAGW[nn % len(FLAGW)]
            tone = FT[(nn * 5 + ri) % len(FT)]
            for i in range(w):
                xx = xx0 + i
                if not (BX0 <= xx <= BX1):
                    continue
                if fy == rh - 1:
                    ch = 'u'                          # 줄 이음(판석 앞 모서리 그늘)
                elif i == w - 1:
                    ch = 'w'                          # 세로 이음
                elif fy == 0 and i < 2:
                    ch = '2' if tone != '0' else '4'  # 판석 윗모서리 빛
                else:
                    ch = tone
                if ri == 0:
                    ch = {'0': 'x', 'z': 'w', 'y': 'v', 'x': 'v', '2': 'x', '4': 'y', 'u': 't', 'w': 'u'}.get(ch, ch)   # 뒤 흉벽 그늘
                c.put(xx, yy, ch)
            xx0 += w
            nn += 1
    y += rh
# 나무 들창(위에서 본 네모 판자 + 쇠 고리)
c.rows(66, DECK0 + 12, ['_ηηηηηηη_', 'ηθηηθηηθε', 'ηθηXXηηθε', 'ηηηηηηηηε', '_εεεεεεε_'])
# 쇠 화로(위에서 본 둥근 그릇 + 숯불)
c.rows(98, DECK0 + 9, ['.YWWY.', 'WτKτW.', 'WKLKτW', '.WττW.', '..YY..'])
# 앞 흉벽: 이 + 총안 틈(틈으로 바닥이 보이고 이 그늘이 오른쪽에 진다)
for x, g in merlon_row(MER, 10, 3, 6):
    c.put(x, MER, 'x' if g < 2 else 'z')
    c.put(x, MER + 1, 'w' if g < 2 else 'y')
    c.put(x, MER + 2, 'n' if g else 'k')     # 아랫돌 윗면
    c.put(x, MER + 3, 'm')
    for y in range(MER + 4, MER + 8):
        c.put(x, y, 'k' if y < MER + 6 else 'i')
# 받침 돌출띠
for x in range(BX0, BX1 + 1):
    k = (x - BX0) % 5
    c.put(x, MER + 8, 'n' if k else 'e')
    c.put(x, MER + 9, ('k' if k < 3 else 'i') if k else 'W')
    c.put(x, MER + 10, 'W' if k == 0 else ('Y' if k == 4 else 'a'))
    c.put(x, MER + 11, 'Y' if k in (0, 4) else 'a')
    c.put(x, MER + 12, 'a' if k in (0, 4) else 'X')       # 내민 받침 사이 틈은 투명이 아니라 어두운 구멍(돌 떨굼 구멍)

# ---------------------------------------------------------------- 원탑 둘(서로 다르게)
R = 21.0
SAG = 7
SLIT = ['.rmj.',
        '.rTi.',
        '.rTi.',
        'rmTmj',
        'TTTTU',
        'iiTji',
        '.rTi.',
        '.rTi.',
        '.rTi.',
        '.nUj.',
        '.iii.']
WIN = ['..rmj..',
       '.rDDAj.',
       'rD^DDAj',
       'rEHD>Aj',
       'rED>DAj',
       'rED>DAj',
       'r>>>>>j',
       'rED>DAj',
       'rEDDDAj',
       'nnnnnnj',
       'eYYYYYe']


def tower(cx, seed, cone_seed, apex, extras):
    ash = Ashlar([6, 5, 6, 6, 5, 6, 6], seed=seed)
    top = 52
    pix.cyl_wall(c, cx, R, top, GY, ash, SAG)
    base = Ashlar([4, 4], seed=seed + 7, widths=[13, 10, 15, 11, 9, 14, 12], dark=2)
    pix.cyl_wall(c, cx, R + 0.6, GY - 6, GY, base, SAG)
    for x in range(int(cx - R), int(cx + R) + 1):
        dx = x + 0.5 - cx
        if abs(dx) > R:
            continue
        cosv = math.sqrt(1 - (dx / R) ** 2)
        y0 = top + round(SAG * cosv) - SAG
        for d in range(3):
            ch = c.get(x, y0 + d)
            if ch in ST:
                c.put(x, y0 + d, sclamp(ST.index(ch) - (3 - d)))
    extras(cx)
    # 내쌓기 고리
    for x in range(int(cx - R) - 1, int(cx + R) + 2):
        dx = x + 0.5 - cx
        rr = R + 1.2
        if abs(dx) > rr:
            continue
        cosv = math.sqrt(max(0, 1 - (dx / rr) ** 2))
        y0 = 42 + round(SAG * cosv)                 # 원뿔 처마 밑 타원과 같은 곡선 — 처마가 고리 위에 얹힌다
        sh = pix.cyl_shade(dx, rr)
        k = int((math.asin(dx / rr) * rr + 100 + seed)) % 6
        c.put(x, y0, sclamp(10 + sh))
        for d in (1, 2, 3):
            t = (8 if d == 1 else 7) + sh
            if k == 0:
                t = 3 + sh
            c.put(x, y0 + d, sclamp(t))
        c.put(x, y0 + 4, sclamp(5 + sh))
        for d in (5, 6, 7):
            if k in (1, 2, 3):
                t = (8 if k == 1 else 7) + sh - (d - 5)
            else:
                t = 1 + sh + (1 if d == 5 else 0)
            c.put(x, y0 + d, sclamp(t))
        c.put(x, y0 + 8, sclamp(3 + sh))
    hw = R + 1.5
    ell = SAG
    pix.cone(c, cx, apex, 42, hw, ell, seed=cone_seed)
    # 처마: 밑 타원을 따라 2px(위 밝은 테, 아래 어두운 밑면)
    for x in range(int(cx - hw), int(cx + hw) + 1):
        dx = x + 0.5 - cx
        if abs(dx) > hw or not (0 <= x < c.w):
            continue
        ye = 42 + ell * math.sqrt(max(0, 1 - (dx / hw) ** 2))
        y = int(math.floor(ye + 0.5))
        f = dx / hw
        c.put(x, y, 'B' if f > -0.2 else 'E')
        if c.get(x, y - 1) != '.':
            c.put(x, y - 1, 'E' if f > 0.45 else ('F' if f > -0.1 else 'G'))


def left_extras(cx):
    for sy, ox in ((62, -1), (88, -4)):
        c.rows(int(cx) - 2 + ox, sy, SLIT)


def right_extras(cx):
    c.rows(int(cx) - 1, 64, WIN)                 # 위층: 작은 유리창
    c.rows(int(cx) + 2, 92, SLIT)                # 아래: 화살 구멍(비켜 놓음)


tower(22.0, 1, 0, 2, left_extras)
tower(138.0, 6, 3, 5, right_extras)
# 꼭대기: 왼쪽 금 구, 오른쪽 깃대 + 청색 삼각기
c.rows(21, 0, ['.K.', 'KLK', '.τ.'])
c.rows(137, 0, ['τ....', 'τEFG.', 'τEF..', 'τE...', 'KL...', 'τ....'])

# 깃발: 왼쪽 벽(탑과 아치 사이) 하나, 오른쪽 탑 몸통에 하나(위치·길이 다르게)
BANNER = ['δηηηηηδ', '.EGGFE.', '.EHGFB.', '.EHGFB.', '.EHKFB.', '.EKLKB.', '.EHKFB.', '.EHGFB.',
          '.EGGFB.', '.EGFFB.', '.EGGFB.', '.EGFEB.', '.EFFEB.', '.EF.EB.', '.E...B.']
c.rows(46, 68, ['W.....W'])
c.rows(46, 69, BANNER)
c.rows(127, 78, ['W.....W'])
c.rows(127, 79, BANNER[:9] + ['.EFFEB.', '.EF.EB.', '.E...B.'])
# 오른쪽 벽: 횃불 받침(쇠 받침 + 불꽃 금색)

# 이끼·풍화
for x, y, ch in [(3, 120, 'M'), (4, 121, 'N'), (5, 121, 'M'), (9, 122, 'N'), (34, 119, 'M'), (35, 120, 'N'),
                 (41, 124, 'M'), (42, 125, 'N'), (45, 126, 'M'), (103, 123, 'M'),
                 (104, 122, 'N'), (118, 124, 'M'), (126, 121, 'N'), (127, 122, 'M'), (150, 121, 'M'), (151, 120, 'N'),
                 (155, 118, 'M'), (110, 125, 'N'), (52, 60, 'N'), (88, 60, 'M')]:
    if c.get(x, y) in ST:
        c.put(x, y, ch)

# 바깥 윤곽: 재질 어두운 단(두 겹: 바깥 어둡게, 안쪽 한 단 내림)
edge_pts = []
for y in range(c.h):
    for x in range(c.w):
        ch = c.get(x, y)
        if ch == '.':
            continue
        if any(not (0 <= x + ax < c.w and 0 <= y + ay < c.h) or c.get(x + ax, y + ay) == '.'
               for ax, ay in ((1, 0), (-1, 0), (0, 1), (0, -1))):
            edge_pts.append((x, y, ch))
for x, y, ch in edge_pts:
    if ch in pix.SL:
        c.put(x, y, 'C' if ch in 'CBE' else 'E')
    elif ch in ST:
        c.put(x, y, ST[max(1, min(2, ST.index(ch) - 5))])
    elif ch in 'xyz0u':
        c.put(x, y, 't')

import importlib.util as _iu  # noqa: E402
for _n in ('fixups', 'edgefix'):
    _sp = _iu.spec_from_file_location(_n + '_gt', os.path.join(ROOT, 'scripts/content/building-kit/massing/work/gatehouse', _n + '.py'))
    globals()[_n] = _iu.module_from_spec(_sp)
    _sp.loader.exec_module(globals()[_n])
if __name__ == '__main__':
    fixups.finalize(c)
    print('  먹 윤곽 → 재질 어두운 단', edgefix.material_edges(c))
    _spt = _iu.spec_from_file_location('tint_gt', os.path.join(ROOT, 'scripts/content/building-kit/massing/work/gatehouse/tint.py'))
    TN = _iu.module_from_spec(_spt)
    _spt.loader.exec_module(TN)
    print('  윤곽 색조', TN.tint_edges(c, 80), '· 무채 가장자리', TN.neutral_share(c))

walk = [
    '**********',
    '**********',
    '**********',
    '**********',
    '**********',
    'XXXXXXXXXX',
    'XXXXDXXXXX',
    'XXXXDXXXXX',
]
meta = dict(name='성문루', massing='16', material='stone', refs=['bd-wall-tower', 'bd-castle'], walk=walk)
if __name__ == '__main__':
    wl = [list(r) for r in walk]
    for cy in range(H):
        for cx in range(W):
            op = any(c.get(x, y) != '.' for y in range(cy * 16, cy * 16 + 16) for x in range(cx * 16, cx * 16 + 16))
            if not op:
                wl[cy][cx] = '.'
            elif wl[cy][cx] == '.':
                wl[cy][cx] = '*'
    meta['walk'] = [''.join(r) for r in wl]
    print('\n'.join(meta['walk']))
    f, w = c.save('gatehouse', meta)
    print('FAIL', f, 'WARN', w)
