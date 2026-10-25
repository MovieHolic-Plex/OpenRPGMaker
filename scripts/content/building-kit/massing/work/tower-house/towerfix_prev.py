"""원통 탑 붓(3차 감독 메모 ⑲): 작은 막돌 원통(왼쪽 밝음 → 오른쪽 어두움 세로 명암 단계, 줄은 밑 타원 따라 휜다)
+ 꼭대기로 좁아지는 작은 비늘 기와 원뿔. 난수 없음 — 돌 폭·바탕은 손으로 쓴 표를 줄마다 다른 자리에서 읽는다.
granary-mill · tower-house 공용 사본."""
import math

# 따뜻한 크림·회갈 돌 램프(밝음 → 어둠)
WARM = ['3', '2', '0', 'z', 'y', 'x', 'w', 'v', 'u', 't', 'J']
COURSES = [3, 2, 3, 3, 2, 4, 3, 2, 3, 2, 3, 4]
SW = [5, 3, 6, 4, 3, 5, 7, 4, 3, 6, 4, 5, 3, 4, 6, 5, 3, 7, 4, 5]
FACE_OFF = '0101201010210100120101'     # 돌마다 바탕 밝기 차(0·1·2 단 어둡게)
SPECK = '0003000500020000400030006000'


def band(f):
    """가로 위치 f(-1 왼끝 … 1 오른끝) → 명암 단계(0 가장 밝음). 왼끝 테두리는 한 단 내려 둥글게."""
    if f < -0.82:
        return 2
    if f < -0.45:
        return 0
    if f < -0.1:
        return 1
    if f < 0.25:
        return 2
    if f < 0.55:
        return 3
    if f < 0.8:
        return 4
    return 5


def shaft(c, cx, R, top, bottom, sag, start=0, skip=None):
    """원통 몸통. top = 앞 가운데 윗선 y(옆은 sag 만큼 위), bottom = 땅 줄(가운데), 옆 밑은 sag 만큼 위.
    줄(course)은 v = y - sag·cosθ 로 펴서 깐다 — 그래서 줄눈이 밑 타원처럼 휜다."""
    skip = skip or (lambda x, y: False)
    # 줄 경계(v 좌표)
    edges = []
    v = top - sag
    k = 0
    while v < bottom + 2:
        edges.append((v, COURSES[(k + start) % len(COURSES)], k))
        v += COURSES[(k + start) % len(COURSES)]
        k += 1
    for x in range(int(cx - R) - 1, int(cx + R) + 2):
        dx = x + 0.5 - cx
        if abs(dx) > R:
            continue
        f = dx / R
        cosv = math.sqrt(max(0.0, 1 - f * f))
        th = math.asin(max(-1.0, min(1.0, f)))
        s = th * R + 200                  # 둘레 길이 좌표
        b = band(f)
        ytop = top - sag + round(sag * cosv)
        ybot = bottom - sag + round(sag * cosv)
        for y in range(ytop, min(ybot, c.h - 1) + 1):
            if skip(x, y):
                continue
            vv = y - round(sag * cosv)
            # 어느 줄?
            ci = 0
            for i, (v0, hgt, kk) in enumerate(edges):
                if v0 <= vv < v0 + hgt:
                    ci = i
                    break
            v0, hgt, kk = edges[ci]
            r = vv - v0
            # 그 줄의 돌
            off = (kk * 7 + start * 3) % 11
            pos = s + off
            acc = 0
            j = (kk * 5 + start) % len(SW)
            n = 0
            while acc + SW[j % len(SW)] <= pos:
                acc += SW[j % len(SW)]
                j += 1
                n += 1
            w = SW[j % len(SW)]
            u = pos - acc
            # 둘레에서 가장자리 쪽은 돌이 좁아 보인다 → 줄눈 폭은 화면에서 1px 유지
            face = b + 1 + int(FACE_OFF[(n + kk * 3) % len(FACE_OFF)])
            joint_v = (r == hgt - 1)
            joint_u = (u >= w - (1.0 / max(0.25, cosv)) * 0.9)
            if joint_v or joint_u:
                ch = WARM[min(len(WARM) - 1, b + 5 + (1 if b >= 2 else 0))]
            else:
                ch = WARM[min(len(WARM) - 2, face)]
                sp = SPECK[(n * 3 + kk + int(u)) % len(SPECK)]
                if sp != '0' and r == 1 and int(u) == 1:
                    ch = WARM[min(len(WARM) - 2, face + 1)]
                if r == 0 and int(u) == 0 and b <= 2:
                    ch = WARM[max(0, face - 1)]
            c.put(x, y, ch)


def ring_band(c, cx, R, y_front, sag, rows=3, out=0.0):
    """원통을 두르는 돌 띠(가운데가 처지는 같은 곡선). 윗줄 밝은 턱 · 가운데 · 아랫줄 그늘 — 명암 단계는 몸통과 같다."""
    rr = R + out
    for x in range(int(cx - rr) - 1, int(cx + rr) + 2):
        dx = x + 0.5 - cx
        if abs(dx) > rr:
            continue
        f = dx / rr
        cosv = math.sqrt(max(0.0, 1 - f * f))
        b = band(f)
        y0 = y_front - sag + round(sag * cosv)
        for d in range(rows):
            if d == 0:
                ch = WARM[min(10, b)]                 # 밝은 윗턱
            elif d == rows - 1:
                ch = WARM[min(10, b + 7)]             # 띠 밑 그늘(몸통에 드리운다)
            else:
                ch = WARM[min(10, b + 2)]
                if int((math.asin(f) * rr + 100)) % 6 == 0:
                    ch = WARM[min(10, b + 6)]         # 띠돌 이음
            c.put(x, y0 + d, ch)


# 원뿔 비늘 색(명암 단계별): (윗빛, 몸, 아랫그늘)
CONE_BANDS = [('L', 'ρ', '?'), ('ρ', 'π', '$'), ('π', '<', '@'), ('<', '=', '!'), ('=', '+', '9'), ('+', '&', '9')]


def cone(c, cx, apex_y, base_y, hw, ell, th=3, sw=3.6, start=0):
    """작은 비늘 기와 원뿔. 줄은 밑 타원과 나란히 휘고(th px), 한 줄의 비늘 수는 그 줄 둘레에 비례 —
    꼭대기로 갈수록 비늘 수가 줄어 방사로 좁아진다. 장마다 왼쪽 1px 빛, 맨 아래 줄 그늘."""
    H = base_y - apex_y
    pts = {}
    for y in range(apex_y, base_y + ell + 1):
        for x in range(int(cx - hw) - 1, int(cx + hw) + 2):
            dx = x + 0.5 - cx
            t = min(1.0, max(0.0, (y + 0.5 - apex_y) / H))
            half = hw * t
            if half < 0.5 or abs(dx) > half:
                continue
            f = dx / half
            bump = ell * t * math.sqrt(max(0.0, 1 - f * f))
            if y > base_y + bump:
                continue
            v = y + 0.5 - apex_y - bump * 0.9
            row = int(v // th)
            lv = int(v % th)
            # 이 줄의 비늘 수: 보이는 반 둘레 길이(π·half) / 비늘 폭
            n = max(2, int(round(math.pi * half / sw)))
            th_ang = math.asin(max(-1.0, min(1.0, f)))
            p = (th_ang / math.pi + 0.5) * n + (0.5 if (row + start) % 2 else 0.0)
            col = int(math.floor(p))
            fr = p - col
            b = band(f)
            b = min(5, b if f > -0.82 else 1)
            hi, body, sh = CONE_BANDS[b]
            var = '0102000120010020'[(row * 3 + col * 5 + start) % 16]
            if var == '1':
                body = hi if b >= 2 else body
            elif var == '2':
                body = sh if b >= 3 else body
            if lv == th - 1:
                ch = sh
            elif fr < 0.22:
                ch = hi if lv == 0 else body
            elif fr > 0.85:
                ch = sh
            else:
                ch = body
            pts[(x, y)] = ch
    for (x, y), ch in pts.items():
        c.put(x, y, ch)
    return pts


def cone_eave(c, cx, base_y, hw, ell):
    """원뿔 처마 앞 끝 두께: 밑 타원 앞 반쪽을 따라 두 줄(명암 단계 따라)."""
    for x in range(int(cx - hw), int(cx + hw) + 1):
        dx = x + 0.5 - cx
        if abs(dx) > hw:
            continue
        f = dx / hw
        y = int(round(base_y + ell * math.sqrt(max(0, 1 - f * f))))
        b = band(f)
        c.put(x, y, ['ν', 'ν', '+', '&', '9', '9'][b])
        c.put(x, y + 1, ['&', '&', '9', '9', '6', '6'][b])


SLITS = [  # 좁은 창 셋 — 반짝 자리·덧돌·창턱이 다르다(⑰)
    ['..ηζζ..', '.ηζDζ-.', '.ηDAD-.', '.ηFAA-.', '.η^AA-.', '.ηDAA-.', '.ηAAB-.', '.ηAAB-.', '.ζ----.', '.yxxwv.'],
    ['..ηζζ..', '.ηζEζ-.', '.ηDA^-.', '.ηDAA-.', '.ηAAB-.', '.ηAFB-.', '.ηAAB-.', '.ζ----.', 'zyxxwvu'],
    ['...ζ...', '..ηDζ..', '.ηDAD-.', '.ηHAA-.', '.ηDAA-.', '.ηA^B-.', '.ηAAB-.', '.ηAAB-.', '.ηAAB-.',
     '.ζ----.', '..yxw..'],
]


def slit(c, x, y, k):
    for j, row in enumerate(SLITS[k % len(SLITS)]):
        for i, ch in enumerate(row):
            if ch != '.':
                c.put(x + i, y + j, ch)
