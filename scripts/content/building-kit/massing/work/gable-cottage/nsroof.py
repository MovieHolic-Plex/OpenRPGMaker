"""남북 박공 지붕(감독 메모 ㉚, 버들항 bd-house-h124_0 규약) — 이 폴더 전용 사본.

앞(남) 박공 삼각벽 뒤로 지붕이 오각형 실루엣으로 화면 위로 물러나 꼭짓점에서 닫힌다.
기와는 용마루와 나란한 세로 열: 왼 사면 밝은 열(낱장 윗머리 노란 빛), 오른 사면 어두운 열, 가운데 용마루 세로 선,
사선 처마 끝은 어두운 테. 난수·잡음 없음 — 낱장 변화는 손으로 쓴 표(P['var'])를 열·줄 번호로 읽는다.
"""
import common

# 낱장 변화 기호: 0 보통 · 1 새 기와(밝음) · 2 묵은 기와(어두움) · 3 이끼 · 4 이 빠짐(아래 그늘이 두 줄) · 5 빛 긴 낱장
DEFAULT = dict(
    tw=7,            # 왼 사면 낱장 열 너비(틈 2화소 포함)
    th=4,            # 줄 높이
    tw2=4,           # 오른 사면 낱장 열 너비
    th2=4,
    lit=('L', 'σ', 'ρ', 'π', '#', '?'),       # 빛, 약한 빛, 몸, 아랫몸, 줄 그늘, 열 틈
    shade=('π', 'ν', '=', '?', '@', '@'),     # 윗머리, 약한 윗머리, 몸, 아랫몸, 줄 그늘, 열 틈
    hl=[(1, 4), (2, 3), (1, 3), (2, 4), (1, 4), (0, 3), (2, 3)],   # 빛 시작·길이(손 순서)
    var=['0010200004001', '2000013000200', '0105000020010', '0002000100004', '3000100002001', '0020004000100',
         '1000020010000', '0004000200105', '0200100000020', '0001000403000', '1000200010000', '0030010000200'],
    shift=0,
    tmpl2=['ππ=@', 'ππ==', '=?=@', '@@=@'],
)

LIGHTER = {'ρ': 'σ', 'π': 'ρ', '#': '?', '?': '<', '=': '?', '@': '=', '!': '@', 'ν': 'π', 'σ': 'L'}
DARKER = {'ρ': 'π', 'π': '<', '?': '#', '<': '?', '=': '@', '@': '!', 'ν': '=', 'σ': 'ρ', 'L': 'σ'}


def ns_roof(c, x0, x1, apex, shoulder, eave, P=None):
    """오각형 지붕을 깔고 inside(x,y) 함수를 돌려준다. 용마루 = 가운데 두 화소(rl, rl+1)."""
    P = dict(DEFAULT, **(P or {}))
    W = x1 - x0 + 1
    half = W / 2.0
    ctr = x0 + half
    rl = x0 + W // 2 - 1

    def hw(y):
        if y >= shoulder:
            return half
        return half * (y - apex + 1) / (shoulder - apex + 1)

    def inside(x, y):
        return apex <= y <= eave and abs(x + 0.5 - ctr) <= hw(y)

    tw, th, tw2, th2 = P['tw'], P['th'], P['tw2'], P['th2']
    Lb, Ls, Lm, Ll, Lr, Lg = P['lit']
    Sb, Ss, Sm, Sl, Sr, Sg = P['shade']
    var, hl, sh = P['var'], P['hl'], P['shift']
    n_rows = (eave - apex) // th + 1
    for y in range(apex, eave + 1):
        k = (y - apex) // th
        r = (y - apex) % th
        low = k >= n_rows * 2 // 3          # 처마 쪽 1/3 은 빛이 한 단 약하다
        for x in range(x0, x1 + 1):
            if not inside(x, y):
                continue
            if x <= rl - 1:                   # 왼 사면(빛) — 용마루 쪽에서 바깥으로 열을 센다
                d = rl - 1 - x
                col = d // tw
                u = tw - 1 - (d % tw)         # 0 = 열 왼끝(빛), tw-1 = 용마루 쪽 틈
                kk = (y - apex + (col % 2) * (th // 2)) // th   # 이웃 열은 반 줄 어긋난다(세로 열이 읽히게)
                rr = (y - apex + (col % 2) * (th // 2)) % th
                v = var[(kk + sh) % len(var)][(col + sh) % len(var[0])]
                hs, hn = hl[(kk * 3 + col + sh) % len(hl)]
                body, lowc, b = Lm, Ll, (Ls if low else Lb)
                if v == '1':
                    body = LIGHTER[body]
                elif v == '2':
                    body, lowc, b = Ll, DARKER[Ll], Ls
                elif v == '5':
                    hn += 1
                if u >= tw - 2:
                    ch = Lg if (u == tw - 1 or rr == th - 1) else Lr
                elif rr == th - 1 or (v == '4' and rr == th - 2 and u > 0):
                    ch = Lr
                elif rr == 0 and hs <= u < hs + hn:
                    ch = b
                elif rr == 1 and hs + 1 <= u < hs + hn - 1:
                    ch = Ls if b == Lb else body
                elif rr == th - 2:
                    ch = lowc
                else:
                    ch = body
                if v == '3' and rr >= th - 2 and u <= 1:
                    ch = 'O' if rr == th - 2 else 'M'
            elif x >= rl + 2:                 # 오른 사면(그늘)
                d = x - (rl + 2)
                col = d // tw2
                u = d % tw2
                kk = (y - apex + (col % 2) * (th2 // 2)) // th2
                rr = (y - apex + (col % 2) * (th2 // 2)) % th2
                v = var[(kk + sh + 5) % len(var)][(col * 2 + sh) % len(var[0])]
                ch = P['tmpl2'][rr][u]
                if ch == 'π' and low:
                    ch = Ss
                if v == '1':
                    ch = LIGHTER.get(ch, ch)
                elif v == '2' and ch in ('π', '=', 'ν'):
                    ch = DARKER.get(ch, ch)
                elif v == '4' and rr == th2 - 2 and u < tw2 - 1:
                    ch = Sr
                if v == '3' and rr >= th2 - 2 and u <= 1:
                    ch = 'M' if rr == th2 - 1 else 'N'
            else:
                continue
            c.put(x, y, ch)
    # 용마루: 얇은 두 화소(왼 붉은 마룻기와 · 오른 짙은 그늘) — 굵은 판 금지
    for y in range(apex, eave + 1):
        if not inside(rl, y):
            continue
        c.put(rl, y, '<' if (y + sh) % 3 else '*')
        c.put(rl + 1, y, '7' if (y + sh) % 4 else '6')
    # 사선 처마 끝 · 옆 처마 테(재질 어두운 단): 왼 갈색 + 안쪽 밝은 마구리, 오른 짙은 갈색
    for y in range(apex, eave + 1):
        xs = [x for x in range(x0, x1 + 1) if inside(x, y)]
        if not xs:
            continue
        l, r = xs[0], xs[-1]
        c.put(l, y, '-')
        c.put(r, y, '|' if y % 4 else '-')
        if r - l > 4:
            c.put(l + 1, y, 'β' if y < shoulder else ('β' if y % 5 else 'η'))
            c.put(r - 1, y, '-' if y % 3 else '_')
        # 사선 계단을 한 화소 메워 매끈하게(윗줄보다 2화소 이상 넓어지면)
        if apex < y < shoulder:
            pl = [x for x in range(x0, x1 + 1) if inside(x, y - 1)]
            if pl and pl[0] - l >= 2:
                c.put(l + 1, y - 0, 'β')
    c.put(rl, apex, '-')
    c.put(rl + 1, apex, '|')
    return inside, rl


def gable(c, gx0, gx1, gpeak, gb, ox=0, oy=0, board=2, post=True, attic=None, beam_rows=2):
    """앞 박공 삼각벽: 박공널(왼 밝음 · 오른 어두움) + 널 밑 그늘 + 회벽 점묘 + 가운데 동자 기둥 + 다락창.
    gb = 삼각벽 밑변 줄. 그 아래 beam_rows 줄 도리. 돌려줌: in_gable."""
    half = (gx1 - gx0 + 1) / 2.0
    gctr = gx0 + half

    def gw(y):
        return half * (y - gpeak + 1) / (gb - gpeak + 1)

    def in_g(x, y):
        return gpeak <= y <= gb and abs(x + 0.5 - gctr) <= gw(y)

    for y in range(gpeak, gb + 1):
        for x in range(gx0, gx1 + 1):
            if not in_g(x, y):
                continue
            d = gw(y) - abs(x + 0.5 - gctr)
            left = x + 0.5 < gctr
            if d < 1:
                ch = '-' if left else '_'
            elif d < 2:
                ch = 'η' if left else 'ε'
            elif d < board + 1:
                ch = 'ε' if left else 'β'
            elif d < board + 2:
                ch = 'x' if left else 'w'
            elif d < board + 3:
                ch = 'z' if left else 'y'
            else:
                m = common.PLASTER_DOTS[(y + oy) % len(common.PLASTER_DOTS)]
                k = m[(x + ox) % len(m)]
                ch = '3' if k == '.' else k
            c.put(x, y, ch)
    gc = int(gctr) - 1
    if post:
        for y in range(gpeak + board + 1, gb + 1):
            if attic and attic[1] - 1 <= y <= attic[1] + attic[3]:
                continue
            c.put(gc, y, 'ε')
            c.put(gc + 1, y, 'β')
    c.put(gc, gpeak, 'ξ')
    c.put(gc + 1, gpeak, 'η')
    if attic:
        ax, ay, aw, ah = attic
        for j in range(ah):
            for i in range(aw):
                edge = i in (0, aw - 1) or j in (0, ah - 1)
                if edge:
                    ch = 'η' if (i == 0 or j == 0) else 'β'
                elif i == aw // 2:
                    ch = 'ε'
                elif j == 1:
                    ch = 'D'
                else:
                    ch = 'A' if j < ah - 2 else 'B'
                c.put(ax + i, ay + j, ch)
        c.put(ax + 1, ay + 1, 'F')
        c.put(ax + aw // 2 + 1, ay + 2, '^')
        for i in range(-1, aw + 1):
            c.put(ax + i, ay + ah, 'm' if i < aw // 2 else 'h')
    return in_g
