#!/usr/bin/env python3
"""hf2 벽면 아홉 장(다마스크·줄무늬·판벽 × A·B·C). 몰딩 y0~2 · 그늘 y3 · 벽 y4~20 · 단 y21 · 징두리 띠 y22~24 · 판 y25~28 · 걸레받이 y29~31 — 세 벽 모두 같다.
  python3 tiledata/atlas-pick/candidates-horror/wall_manor_damask/work/hf2_walls.py"""
import os, sys
sys.path.insert(0, os.path.dirname(__file__))
from hf2_lib import Cv

M = 'm'; P = 'p'; D = 'd'; V = 'v'; T = 't'

# ───────────── 틀(몰딩·징두리·걸레받이) ─────────────
def frame_A(c, face):
    """v5 식구(파일럿과 같은 명암 구조): 몰딩 1·5·3 → 그늘 → 벽 → 단 → 띠 5·4·2 → 들어간 패널 → 걸레받이 5·2·1"""
    for x in range(32):
        for y, tn in ((0, 1), (1, 5), (2, 3)): c.put(x, y, M, tn)
        c.put(x, 3, *face['shade'])
        c.put(x, 21, *face['hem'])
        for y, tn in ((22, 5), (23, 4), (24, 2)): c.put(x, y, M, tn)
        u = x % 16
        for y in range(25, 29):
            if u == 0: tn = 4
            elif u == 15: tn = 2
            elif y == 25: tn = 2
            elif y == 28: tn = 4
            elif u == 1: tn = 2
            elif u == 14: tn = 4
            else: tn = 3
            c.put(x, y, M, tn)
        for y, tn in ((29, 5), (30, 2), (31, 1)): c.put(x, y, M, tn)

def frame_B(c, face):
    """어둠에서 읽히게: 몰딩·걸레받이는 한 줄 밝은 선 + 깊은 줄, 징두리는 크고 어두운 한 면 + 위 끝 밝은 선"""
    for x in range(32):
        for y, tn in ((0, 2), (1, 6), (2, 3)): c.put(x, y, M, tn)
        c.put(x, 3, *face['shade'])
        c.put(x, 21, *face['hem'])
        for y, tn in ((22, 5), (23, 2), (24, 1)): c.put(x, y, M, tn)
        u = x % 16
        for y in range(25, 29):
            if u == 0: tn = 1
            elif u == 1: tn = 3
            elif y == 28: tn = 1
            else: tn = 2
            c.put(x, y, M, tn)
        for y, tn in ((29, 4), (30, 2), (31, 0)): c.put(x, y, M, tn)

def frame_C(c, face):
    """재료·무늬: 구슬 몰딩(밝음·어둠 번갈이) · 금 선(tarn) · 틀+판(결) 징두리 · 홈 판 걸레받이"""
    for x in range(32):
        c.put(x, 0, M, 1); c.put(x, 1, M, 5 if x % 2 == 0 else 4); c.put(x, 2, M, 2 if x % 2 == 0 else 3)
        c.put(x, 3, *face['shade'])
        c.put(x, 21, *face['hem'])
        c.put(x, 22, T, 4); c.put(x, 23, M, 4); c.put(x, 24, M, 2)
        u = x % 16
        for y in range(25, 29):
            if u in (0, 15): tn = 1                               # 문틀 세로 홈
            elif u == 1 or y == 25: tn = 2 if u != 1 else 5       # 왼·위 밝은 모따기
            elif u == 14 or y == 28: tn = 2
            else:                                                 # 판 속 결: 가로 결 한 줄씩
                tn = 4 if (y == 26 and (u * 3 + y) % 7 < 4) or (y == 27 and (u + 3) % 5 == 0) else 3
            c.put(x, y, M, tn)
        c.put(x, 29, M, 5)
        c.put(x, 30, M, 3 if (x // 4) % 2 == 0 else 2)
        c.put(x, 31, M, 1)

FR = {'A': frame_A, 'B': frame_B, 'C': frame_C}
FACE = {  # 그늘 줄(y3) · 단(y21)
    'A': dict(shade=(P, 3), hem=(P, 4)),
    'B': dict(shade=(P, 2), hem=(P, 4)),
    'C': dict(shade=(P, 2), hem=(P, 3)),
}

# ───────────── 다마스크 ─────────────
FLEUR = ['....a....',
         '...aba...',
         '..aabaa..',
         '.a.aba.a.',
         'aba.b.aba',
         '.aabbbaa.',
         '...aba...',
         '..a.b.a..',
         '.....a...']
LOZ = ['..a..', '.aba.', 'abcba', '.aba.', '..a..']
DOT = ['.a.', 'aba', '.a.']

def damask_A(c):
    cm = {'a': (D, 5), 'b': (D, 4)}
    for ox, oy in ((4, 5), (20, 5)): c.stamp(FLEUR, ox, oy, cm)          # 위 줄
    for ox, oy in ((12, 12), (28, 12)): c.stamp(FLEUR, ox - 4, oy, cm) if False else None
    # 반 칸 엇갈린 아래 줄은 작은 마름모 + 점(큰 무늬와 다른 크기로 리듬)
    for ox, oy in ((12, 13), (28, 13)): c.stamp(LOZ, ox - 2, oy, {'a': (D, 4), 'b': (D, 5), 'c': (D, 5)})
    for ox, oy in ((14, 6), (30, 6), (4, 15), (20, 15)): c.stamp(DOT, ox - 1, oy, {'a': (D, 4), 'b': (D, 5)})
    for y in range(4, 21): c.put(31, y, P, 4)                            # 벽지 이음

def damask_B(c):
    """벽지 한 장을 크게(paper 6), 무늬는 성기게 — 큰 마름모 사슬 하나만, 이음 한 줄"""
    big = ['......a......',
           '.....aba.....',
           '....aabaa....',
           '...aabbbaa...',
           '..aabbbbbaa..',
           '...aabbbaa...',
           '....aabaa....',
           '.....aba.....',
           '......a......']
    c.stamp(big, 2, 6, {'a': (D, 2), 'b': (D, 3)})
    c.stamp(big, 18, 6, {'a': (D, 2), 'b': (D, 3)})
    for ox in (14, 30): c.stamp(['a', 'a', 'a'], ox, 10, {'a': (D, 2)})       # 마름모 사이 작은 점 세로 세 개
    for y in range(4, 21): c.put(31, y, P, 5)

def damask_C(c):
    """동화 어두운 색: 바탕 paper 4, 마름모 격자(damask 2 선 · 교차점에 4꽃잎) — 16px 주기 대각선 사슬"""
    for y in range(4, 21):
        for x in range(32):
            a = (x + y) % 16; b = (x - y) % 16
            if a == 0 or b == 0: c.put(x, y, D, 3)
    # 교차점: 대각선이 만나는 곳(x+y≡0, x-y≡0 mod 16 → x≡0 or 8 mod ... ) 에 작은 꽃
    for y in range(4, 21):
        for x in range(32):
            if (x + y) % 16 == 0 and (x - y) % 16 == 0:
                for dx, dy, tn in ((0, 0, 5), (1, 0, 4), (-1, 0, 4), (0, 1, 4), (0, -1, 4)): c.put(x + dx, y + dy, D, tn)
    for x in range(32):                                                       # 격자 칸 가운데 점(paper 밝게)
        for y in range(4, 21):
            if (x % 16 == 0 and (y - 4) % 16 == 4) : c.put(x, y, P, 5)
    for y in range(4, 21): c.put(31, y, P, 3)

# ───────────── 줄무늬 ─────────────
def stripe_cols(pat):
    return [pat[x % len(pat)] for x in range(32)]

def stripe_A(c):
    """폭 5·2·3·2·4(섞임): 크림(paper 5) 넓은 줄 · paper 4 줄 · 포도주(velv) 가는 줄"""
    pat = 'pppppwwqqqrrwwqq'   # 16px 주기 → 표기: p=paper5 넓게, q=paper4, w=velv 가는, r=paper5 좁게
    tone = {'p': (P, 5), 'q': (P, 4), 'w': (V, 4), 'r': (P, 5)}
    cols = stripe_cols(pat)
    for y in range(4, 21):
        for x in range(32): c.put(x, y, *tone[cols[x]])
    for y in range(4, 21): c.put(31, y, P, 3)

def stripe_B(c):
    """굵은 대비: paper 6 넓은 줄 + 짙은 포도주 줄(velv 2), 줄 가장자리에 밝은 한 화소(가는 선)"""
    pat = 'pppppwwwpppppwww'[:16]
    pat = 'ppppppwwwppppwww'   # 6 · 3 · 4 · 3
    for y in range(4, 21):
        for x in range(32):
            k = pat[x % 16]
            if k == 'p': c.put(x, y, P, 6)
            else:
                edge = pat[(x - 1) % 16] == 'p'
                c.put(x, y, V, 3 if edge else 2)
    for y in range(4, 21): c.put(31, y, P, 5)

def stripe_C(c):
    """재료: 포도주 줄에 작은 꽃 덩굴(damask) · 크림 줄엔 가는 실선 — 벨벳 줄과 비단 줄"""
    pat = 'ppppppwwwwwppppp'    # p 6 · w 5 · p 5
    for y in range(4, 21):
        for x in range(32):
            k = pat[x % 16]
            if k == 'p': c.put(x, y, P, 4 if (x % 16) in (0, 5) else 5)
            else: c.put(x, y, V, 3)
    for x0 in (6,):                                                          # 벨벳 줄 속 덩굴: 마름모 이음
        for base in (0, 16):
            for y in range(5, 20):
                k = (y - 5) % 6
                xs = {0: [8], 1: [7, 9], 2: [8], 3: [8], 4: [8], 5: [8]}[k]
                for xx in xs: c.put(base + xx, y, D, 5 if k in (1,) else 4)
            for y in range(5, 20, 6): c.put(base + 8, y, D, 5)
    for x in range(32):                                                      # 벨벳 줄 가장자리 실선
        if pat[x % 16] == 'w' and pat[(x - 1) % 16] == 'p': 
            for y in range(4, 21): c.put(x, y, V, 4)
        if pat[x % 16] == 'w' and pat[(x + 1) % 16] == 'p':
            for y in range(4, 21): c.put(x, y, V, 2)
    for y in range(4, 21): c.put(31, y, P, 3)

# ───────────── 판벽(위까지 나무) ─────────────
def panel_A(c):
    """v5 식구: 세로 널 4px(단 4·5 번갈이), 틈 한 단 어둡게, 널 끝 이음 없이 길게. 가로 띠 두 줄(y4~5 위 · y19~20 아래)"""
    for y in range(4, 21):
        for x in range(32):
            k = x % 4; pl = (x // 4) % 2
            tn = (5 if pl == 0 else 4)
            if k == 3: tn = 2
            elif k == 0 and y > 5: tn = tn                                    # 그대로
            c.put(x, y, M, tn)
    for x in range(32):                                                      # 가로 띠(널 위에 얹힌 각목)
        c.put(x, 4, M, 6); c.put(x, 5, M, 4); c.put(x, 6, M, 2)
        c.put(x, 19, M, 6); c.put(x, 20, M, 4); c.put(x, 21, M, 2)
    for (x, y) in ((3, 11), (11, 13), (19, 9), (27, 12)): c.put(x, y, M, 3); c.put(x + 1, y, M, 3)
    for x in (2, 6, 10, 14, 18, 22, 26, 30): c.put(x, 4, T, 3)              # 못 머리(윗 띠)

def panel_B(c):
    """어둠에서 읽히게: 널 널찍 8px 넷 · 틈 깊게 · 띠 밝은 한 줄 · 못 없음"""
    for y in range(4, 21):
        for x in range(32):
            k = x % 8
            tn = 5 if k not in (0, 7) else (6 if k == 1 else 5)
            if k == 0: tn = 6
            elif k == 7: tn = 3
            elif k == 1: tn = 5
            else: tn = 4 if (k in (2, 3)) else 5
            c.put(x, y, M, tn)
    for x in range(32):
        if x % 8 == 7: 
            for y in range(4, 21): c.put(x, y, M, 2)
    for x in range(32):
        c.put(x, 5, M, 6); c.put(x, 6, M, 3)
        c.put(x, 20, M, 6); c.put(x, 21, M, 2)
    for y in range(4, 21): c.put(31, y, M, 1)

def panel_C(c):
    """재료·무늬: 16px 홈 판 (테두리 모따기 + 안쪽 결), 위·아래 가로 띠에 놋쇠 못, 결은 세로로"""
    for y in range(4, 21):
        for x in range(32):
            u = x % 16; v = y - 6
            if 7 <= y <= 18:
                if u in (0, 15) or y in (7, 18): tn = 1                          # 홈
                elif u == 1 or y == 8: tn = 6 if u == 1 and y >= 8 else 5       # 모따기 밝음
                elif u == 14 or y == 17: tn = 3
                else:
                    tn = 4
                    if (x * 7 + y * 3) % 11 == 0 and y % 3 != 0: tn = 3           # 결 알갱이
                    if u in (5, 10) and (y % 5) in (2, 3): tn = 5                 # 세로 결 줄
            else:
                tn = 4
            c.put(x, y, M, tn)
    for x in range(32):
        c.put(x, 4, M, 6); c.put(x, 5, M, 4); c.put(x, 6, M, 2)
        c.put(x, 19, M, 4); c.put(x, 20, M, 3)
    for x in (4, 12, 20, 28): c.put(x, 5, T, 5)
    for y in range(4, 21): c.put(31, y, M, 2)

FACES = {'wall_manor_damask': {'A': damask_A, 'B': damask_B, 'C': damask_C},
         'wall_manor_stripe': {'A': stripe_A, 'B': stripe_B, 'C': stripe_C},
         'wall_wood_panel': {'A': panel_A, 'B': panel_B, 'C': panel_C}}
BASE = {'wall_manor_damask': (P, {'A': 5, 'B': 6, 'C': 4}), 'wall_manor_stripe': (P, {'A': 5, 'B': 6, 'C': 5}),
        'wall_wood_panel': (M, {'A': 5, 'B': 5, 'C': 4})}
NOTES = {
 ('wall_manor_damask', 'A'): 'A(v5 식구): 몰딩 1·5·3 → 크림 벽지(paper 5) + 자주 다마스크(위 줄 큰 꽃 · 아래 줄 작은 마름모, 반 칸 엇갈림) → 단 → 들어간 패널 징두리 → 걸레받이. 벽면이 방에서 가장 밝은 큰 면',
 ('wall_manor_damask', 'B'): 'B(어둠에서 읽힘): 벽지 paper 6 한 장을 크게, 무늬는 성긴 큰 마름모 둘뿐, 징두리는 짙은 한 면 + 위 끝 밝은 한 줄, 몰딩·걸레받이 날카로운 한 줄',
 ('wall_manor_damask', 'C'): 'C(동화 재료): 벽지 paper 4 위에 damask 대각 마름모 격자 + 교차점 4꽃잎, 구슬 몰딩·금 선·홈 판 징두리·홈 걸레받이',
 ('wall_manor_stripe', 'A'): 'A(v5 식구): 크림 줄 폭 5·2·3·2·4 섞임, paper 4 · 포도주 가는 줄. 몰딩·징두리·걸레받이는 다마스크 A 와 같은 높이',
 ('wall_manor_stripe', 'B'): 'B(어둠에서 읽힘): paper 6 넓은 줄 6px vs 짙은 포도주 줄(velv 2) 3~4px, 줄 가장자리 밝은 화소. 대비가 커서 어두운 판에서도 세로 리듬이 읽힘',
 ('wall_manor_stripe', 'C'): 'C(벨벳 줄+비단 줄): 포도주 벨벳 줄 속에 덩굴 마름모, 크림 줄엔 가는 실 결, 벨벳 줄 가장자리 한 단 밝음/어둠',
 ('wall_wood_panel', 'A'): 'A(v5 식구): 세로 널 4px 단 5·4 번갈이 · 틈 2 · 가로 띠 위/아래 각목(6·4·2) · 못 머리 tarn',
 ('wall_wood_panel', 'B'): 'B(어둠에서 읽힘): 널 8px 넓게, 틈 깊게, 가로 띠 한 줄 밝게(6), 못·결 없음 — 큰 면 위주',
 ('wall_wood_panel', 'C'): 'C(패널 몰딩): 16px 홈 판(모따기 밝은 왼·위, 어두운 오른·아래) 안에 세로 결 줄과 알갱이, 위 띠에 놋쇠 못',
}
MATS = {'wall_manor_damask': {'p': 'paper', 'd': 'damask', 'm': 'mahog', 't': 'tarn'},
        'wall_manor_stripe': {'p': 'paper', 'v': 'velv', 'd': 'damask', 'm': 'mahog', 't': 'tarn'},
        'wall_wood_panel': {'m': 'mahog', 'p': 'paper', 't': 'tarn'}}

def build(slug, v):
    mat, tones = BASE[slug]
    c = Cv(32, 32, (mat, tones[v]))
    FACES[slug][v](c)
    FR[v](c, FACE[v])
    # 판벽은 몰딩 그늘 줄이 나무여야 한다
    if slug == 'wall_wood_panel':
        for x in range(32): c.put(x, 3, M, {'A': 2, 'B': 2, 'C': 2}[v])
        for x in range(32):
            if v == 'A': c.put(x, 21, M, 2)
            elif v == 'B': c.put(x, 21, M, 2)
            else: c.put(x, 21, M, 3)
    # 쓰이지 않는 재료는 뺀다(@mat 는 남겨도 되지만 깔끔하게)
    used = {ch for r in c.m for ch in r} - {'.'}
    mats = {k: val for k, val in MATS[slug].items() if k in used}
    c.emit(slug, f'hf2-{v}', mats, NOTES[(slug, v)])

if __name__ == '__main__':
    for slug in FACES:
        for v in 'ABC': build(slug, v)
    print('ok')
