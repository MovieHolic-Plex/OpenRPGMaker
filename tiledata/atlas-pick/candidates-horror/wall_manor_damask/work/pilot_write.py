#!/usr/bin/env python3
"""호러 2판 파일럿(감독자) — 기본 한 벌 핵심 다섯 조각의 pilot-A.pxg 를 쓴다. 색을 계산하지 않는다: 줄마다 재료 글자·단 글자를 손으로 정한 것을
반복(무늬 16/32px 주기)·붙이기만 한다. 굽기: python3 scripts/content/atlas-pick/horror_check.py <폴더>/pilot-A.pxg
  python3 tiledata/atlas-pick/candidates-horror/wall_manor_damask/work/pilot_write.py"""
import os
H = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))

def emit(slug, w, h, mats, mrows, trows, note, tile=False):
    assert len(mrows) == h and len(trows) == h, (slug, len(mrows), len(trows))
    for r in mrows + trows: assert len(r) == w, (slug, r, len(r))
    L = [f'// {slug} pilot-A (감독자 파일럿, 2판 기본 한 벌)', f'@size {w} {h}', '@cell 16', '@palette palette.pal']
    if tile: L.append('@tile')
    L.append('@layer main')
    L += [f'@mat {k} {v} 0' for k, v in mats.items()]
    L += ['@mblock 0 0'] + mrows + ['@tblock 0 0'] + trows
    d = os.path.join(H, slug)
    open(os.path.join(d, 'pilot-A.pxg'), 'w').write('\n'.join(L) + '\n')
    open(os.path.join(d, 'pilot-A.note'), 'w').write(note + '\n')

# ── 저택 벽면: 몰딩 3 · 벽지 18 · 징두리 7 · 걸레받이 3 (+ 벽지 밑 1) ─────────────────────────────
MOTIF = ['...a...', '..aaa..', '.aa.aa.', 'aa.b.aa', '.a.b.a.', 'aa.b.aa', '.aa.aa.', '..aaa..', '...a...']
DOT = ['.a.', 'aba', '.a.']
def wall():
    m = [['p'] * 32 for _ in range(32)]; t = [['5'] * 32 for _ in range(32)]
    def put(y, x, mat, tone):
        m[y][x % 32] = mat; t[y][x % 32] = tone
    for x in range(32):
        for y, tone in ((0, '1'), (1, '5'), (2, '3')): put(y, x, 'm', tone)          # 몰딩
        put(3, x, 'p', '3')                                                            # 몰딩 밑 그늘
        put(21, x, 'p', '4')                                                           # 벽지 밑단
        for y, tone in ((22, '5'), (23, '4'), (24, '2')): put(y, x, 'm', tone)       # 징두리 윗 띠
        u = x % 16
        for y in range(25, 29):                                                        # 징두리 판(16px 패널, 왼위 빛 → 들어간 면 위·왼 그늘)
            if u == 0: tone = '4'
            elif u == 15: tone = '2'
            elif y == 25: tone = '2'
            elif y == 28: tone = '4'
            elif u == 1: tone = '2'
            elif u == 14: tone = '4'
            else: tone = '3'
            put(y, x, 'm', tone)
        for y, tone in ((29, '5'), (30, '2'), (31, '1')): put(y, x, 'm', tone)       # 걸레받이
    for y in range(4, 21): put(y, 31, 'p', '4')                                      # 벽지 이음(32px)
    for ox, oy in ((4, 5), (20, 12)):                                                  # 다마스크(반 칸 엇갈림)
        for j, row in enumerate(MOTIF):
            for i, c in enumerate(row):
                if c != '.': put(oy + j, ox + i, 'd', '5' if c == 'a' else '4')
    for ox, oy in ((14, 16), (30, 8)):
        for j, row in enumerate(DOT):
            for i, c in enumerate(row):
                if c != '.': put(oy + j, ox + i, 'd', '5' if c == 'a' else '4')
    emit('wall_manor_damask', 32, 32, {'p': 'paper', 'd': 'damask', 'm': 'mahog'}, [''.join(r) for r in m], [''.join(r) for r in t],
         '파일럿 A(v5 식구): 몰딩 3줄 → 밝은 벽지(paper 5) + 자주 다마스크 반 칸 엇갈림 → 징두리 윗 띠 + 16px 들어간 패널 → 걸레받이 3줄. 벽면이 방에서 가장 밝은 넓은 면')

# ── 저택 마루: 널 4px × 8, 판마다 단 하나, 이음은 다섯 판에만, 결은 길게 한 단 ────────────────────
def floor():
    base = [4, 3, 4, 3, 4, 4, 3, 4]
    joints = {0: 21, 2: 7, 3: 28, 5: 14, 6: 2}
    grain = {0: (2, 3, 14), 1: (1, 20, 29), 3: (2, 5, 19), 4: (1, 12, 27), 6: (1, 16, 25), 7: (2, 22, 35)}
    t = [['0'] * 32 for _ in range(32)]
    for k, b in enumerate(base):
        for r in range(4):
            for x in range(32): t[k * 4 + r][x] = str(b) if r < 3 else '2'
        if k in grain:
            r, x0, x1 = grain[k]
            for x in range(x0, x1 + 1): t[k * 4 + r][x % 32] = str(b - 1)
        if k in joints:
            j = joints[k]
            for r in range(3): t[k * 4 + r][j] = '2'
            t[k * 4][(j + 1) % 32] = str(b + 1); t[k * 4][(j + 2) % 32] = str(b + 1)
    t[9][26], t[9][27], t[10][26], t[10][27] = '3', '2', '2', '3'                      # 옹이 하나(판 2)
    emit('floor_manor_plank', 32, 32, {'w': 'vdwood'}, ['w' * 32] * 32, [''.join(r) for r in t],
         '파일럿 A(v5 짙은 마루 결): 가로 널 4px 여덟, 판 단 3·4 번갈이(고르지 않게), 틈 한 단 어둡게, 이음은 다섯 판에만(이음 오른쪽 2px 밝게), 결 여섯 줄 10~15px 한 단, 옹이 하나. 사방 이어짐', tile=True)

# ── 나무 문: 위 2px 비움, 문틀 3px(왼 밝게·오른 어둡게), 문짝 패널 둘, 놋쇠 손잡이 ─────────────────
def door():
    m = [['.'] * 16 for _ in range(32)]; t = [['.'] * 16 for _ in range(32)]
    def put(y, x, mat, tone): m[y][x] = mat; t[y][x] = tone
    for x in range(16): put(2, x, 'm', '1')
    for x in range(16): put(3, x, 'm', '5' if 0 < x < 15 else '1')
    for x in range(16): put(4, x, 'm', {0: '1', 1: '5', 14: '3', 15: '1'}.get(x, '4'))
    for y in range(5, 32):
        for x, tone in ((0, '1'), (1, '5'), (2, '3'), (13, '4'), (14, '3'), (15, '1')): put(y, x, 'm', tone)
        for x in range(3, 13):
            if y == 5: tone = '2'                     # 인방 그늘
            elif y == 31: tone = '1'                  # 문 밑 틈
            elif y == 30: tone = '2'
            elif x == 3: tone = '4'
            elif x == 12: tone = '2'
            else: tone = '3'
            put(y, x, 'm', tone)
    for (y0, y1) in ((8, 15), (18, 27)):             # 패널: 들어간 면 — 위·왼 그늘, 아래·오른 밝음
        for y in range(y0, y1 + 1):
            for x in range(5, 10):
                if y == y0 or x == 5: tone = '2'
                elif y == y1 or x == 9: tone = '4'
                else: tone = '3'
                put(y, x, 'm', tone)
    for (y, x, tone) in ((11, 7, '4'), (12, 7, '4'), (22, 7, '2'), (23, 7, '2'), (24, 7, '2')): put(y, x, 'm', tone)   # 결 한두 줄
    for (y, x, tone) in ((20, 10, '5'), (20, 11, '4'), (21, 10, '3'), (21, 11, '2')): put(y, x, 't', tone)             # 손잡이
    emit('door_wood', 16, 32, {'m': 'mahog', 't': 'tarn'}, [''.join(r) for r in m], [''.join(r) for r in t],
         '파일럿 A: 벽면 두 줄 문 — 위 2px 벽 보임, 문틀 3px(왼 테 밝게·오른 어둡게) + 인방, 문짝 들어간 패널 둘, 놋쇠 손잡이 2×2, 문 밑 틈 짙게. 벽지보다 두 단 어두워 문이 먼저 읽힘')

# ── 밤 창: 위 2px 비움, 나무 틀, 짙은 유리 + 달빛 반사, 십자 창살, 창턱 ─────────────────────────
def window():
    m = [['.'] * 16 for _ in range(16)]; t = [['.'] * 16 for _ in range(16)]
    def put(y, x, mat, tone): m[y][x] = mat; t[y][x] = tone
    for x in range(2, 14): put(2, x, 'm', '1')
    for x in range(2, 14): put(3, x, 'm', '5' if 2 < x < 13 else '1')
    for y in range(4, 12):
        put(y, 2, 'm', '1'); put(y, 3, 'm', '5'); put(y, 12, 'm', '3'); put(y, 13, 'm', '1')
        for x in range(4, 12): put(y, x, 'g', '3' if y == 4 else ('2' if y < 7 else '1'))
    for x in range(2, 14): put(12, x, 'm', '3' if 2 < x < 13 else '1')
    for x in range(1, 15): put(13, x, 'm', '5'); put(14, x, 'm', '2')
    for y in range(4, 12): put(y, 7, 'm', '3')
    for x in range(4, 12): put(7, x, 'm', '3')
    put(7, 7, 'm', '4')
    for (y, x, tone) in ((5, 5, '4'), (5, 6, '3'), (6, 5, '3'), (9, 9, '3'), (9, 10, '2')): put(y, x, 'o', tone)          # 달빛 반사
    emit('window_night', 16, 16, {'m': 'mahog', 'g': 'murk', 'o': 'moon'}, [''.join(r) for r in m], [''.join(r) for r in t],
         '파일럿 A: 벽면 윗줄 작은 창 — 위 2px 비움, 마호가니 틀(왼·위 밝게), 짙은 탁한 유리(위가 조금 밝고 아래로 어두움) + 왼위 달빛 반사 두 덩이, 1px 십자 창살, 창턱 밝은 윗면')

# ── 천장 윗면 자동 타일(4×3): 속 = vblack 1, 방 쪽 테 = 마호가니 3~4px ────────────────────────────
# 속 덩이(한 색이면 EasyRPG 빈 칸과 같아진다 — 한 단 밝은 작은 덩이 몇 개, 8px 사분면마다 하나 이상)
SPECK = {(3, 4), (4, 4), (5, 4), (4, 5), (11, 2), (11, 3), (12, 3), (10, 3), (6, 10), (7, 10), (6, 11), (13, 9), (14, 9), (13, 10), (15, 10),
         (9, 13), (10, 13), (9, 14), (2, 13), (1, 13), (2, 12), (8, 6), (9, 6), (9, 7), (0, 8), (1, 8), (14, 1), (15, 1), (14, 14), (5, 15), (6, 15), (12, 12)}
N_ = ['1', '5', '4']; W_ = ['1', '5', '4']; E_ = ['1', '3', '4']; S_ = ['1', '2', '5', '6']   # 거리 0(방에 닿는 끝)부터
def ceil():
    m = [['.'] * 64 for _ in range(48)]; t = [['.'] * 64 for _ in range(48)]
    def cell(cx, cy, sides, inner=None):
        for y in range(16):
            for x in range(16):
                cand = []                              # (거리, 단) — 가까운 변이 이긴다, 같으면 어두운 단
                if 'N' in sides and y < 3: cand.append((y, N_[y]))
                if 'S' in sides and y > 11: cand.append((15 - y, S_[15 - y]))
                if 'W' in sides and x < 3: cand.append((x, W_[x]))
                if 'E' in sides and x > 12: cand.append((15 - x, E_[15 - x]))
                if inner:                               # 안쪽 모서리: 꺾이는 선 — 더 먼 쪽 거리의 선 위에 있다
                    for (vx, vy) in inner:
                        dx = x if vx == 'W' else 15 - x; dy = y if vy == 'N' else 15 - y
                        vs = W_ if vx == 'W' else E_; hs = N_ if vy == 'N' else S_
                        if dx < len(vs) and dy < len(hs):
                            if dx > dy: cand.append((dx, vs[dx]))
                            elif dy > dx: cand.append((dy, hs[dy]))
                            else: cand.append((dx, min(vs[dx], hs[dy])))
                X, Y = cx * 16 + x, cy * 16 + y
                if cand:
                    d0 = min(c[0] for c in cand); tone = min(c[1] for c in cand if c[0] == d0)
                    m[Y][X] = 'm'; t[Y][X] = tone
                else:
                    m[Y][X] = 'k'; t[Y][X] = '2' if (x, y) in SPECK else '1'
    grid = {(0, 0): 'NW', (1, 0): 'N', (2, 0): 'NE', (0, 1): 'W', (1, 1): '', (2, 1): 'E', (0, 2): 'SW', (1, 2): 'S', (2, 2): 'SE'}
    for (cx, cy), s in grid.items(): cell(cx, cy, s)
    cell(3, 0, '', inner=[('W', 'N'), ('E', 'N'), ('W', 'S'), ('E', 'S')])
    emit('ceil_black', 64, 48, {'k': 'vblack', 'm': 'mahog'}, [''.join(r) for r in m], [''.join(r) for r in t],
         '파일럿 A: 천장 윗면 자동 타일 — 속 vblack 1 한 색(조용하게), 방 쪽 테: 아래 변(벽면 위 끝) 4px 밝은 입술 6·5 + 어두운 밑줄, 위·왼 변 3px(끝 1·밝은 5·4), 오른 변 3px 어둡게(1·3·4). 안쪽 모서리는 두 변 테가 꺾여 만나게')

# ── 카펫 러너 자동 타일(4×3): 바탕 벨벳 + 테(바깥 술 1 · 금 2 · 안 그늘 1), 바깥 모서리 화소는 투명(둥글게) ──────────
RN = [('v', '1'), ('t', '5'), ('t', '3'), ('v', '2')]; RW = RN; RE = [('v', '1'), ('t', '3'), ('t', '2'), ('v', '2')]; RS = RE
RMOTIF = {(8, 6): '5', (7, 7): '4', (8, 7): '5', (9, 7): '4', (6, 8): '4', (7, 8): '5', (9, 8): '5', (10, 8): '4', (7, 9): '4', (8, 9): '5', (9, 9): '4',
          (8, 10): '5', (2, 2): '4', (13, 13): '4', (2, 13): '4', (13, 2): '4'}
def runner():
    m = [['.'] * 64 for _ in range(48)]; t = [['.'] * 64 for _ in range(48)]
    def cell(cx, cy, sides, inner=None):
        for y in range(16):
            for x in range(16):
                cand = []
                if 'N' in sides and y < 4: cand.append((y, RN[y]))
                if 'S' in sides and y > 11: cand.append((15 - y, RS[15 - y]))
                if 'W' in sides and x < 4: cand.append((x, RW[x]))
                if 'E' in sides and x > 11: cand.append((15 - x, RE[15 - x]))
                if inner:
                    for (vx, vy) in inner:
                        dx = x if vx == 'W' else 15 - x; dy = y if vy == 'N' else 15 - y
                        vs = RW if vx == 'W' else RE; hs = RN if vy == 'N' else RS
                        if dx < 4 and dy < 4:
                            if dx > dy: cand.append((dx, vs[dx]))
                            elif dy > dx: cand.append((dy, hs[dy]))
                            else: cand.append((dx, min(vs[dx], hs[dy], key=lambda c: c[1])))
                X, Y = cx * 16 + x, cy * 16 + y
                corner = sum(1 for sd, ok in (('N', y == 0), ('S', y == 15), ('W', x == 0), ('E', x == 15)) if sd in sides and ok) >= 2
                if corner: continue                                     # 바깥 모서리 화소는 투명
                if cand:
                    d0 = min(c[0] for c in cand); mat, tone = min((c[1] for c in cand if c[0] == d0), key=lambda c: c[1])
                else:
                    mat, tone = 'v', RMOTIF.get((x, y), '3')
                m[Y][X] = mat; t[Y][X] = tone
    grid = {(0, 0): 'NW', (1, 0): 'N', (2, 0): 'NE', (0, 1): 'W', (1, 1): '', (2, 1): 'E', (0, 2): 'SW', (1, 2): 'S', (2, 2): 'SE'}
    for (cx, cy), sd in grid.items(): cell(cx, cy, sd)
    cell(3, 0, '', inner=[('W', 'N'), ('E', 'N'), ('W', 'S'), ('E', 'S')])
    emit('carpet_runner', 64, 48, {'v': 'velv', 't': 'tarn'}, [''.join(r) for r in m], [''.join(r) for r in t],
         '파일럿 A: 카펫 러너 자동 타일 — 짙은 벨벳(velv 3) 바탕 + 칸 가운데 작은 마름모(4·5)·귀퉁이 점, 테 4px(바깥 술 1 · 금 2줄 · 안 그늘), 위·왼 금 밝게 아래·오른 어둡게, 바깥 모서리 화소 투명')

if __name__ == '__main__':
    wall(); floor(); door(); window(); ceil(); runner(); print('ok')
