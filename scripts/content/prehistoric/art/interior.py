#!/usr/bin/env python3
"""prehistoric 실내 — 동굴 거처·동굴 벽화 회랑·족장 집·무당 천막 안.

바닥: 동굴 바닥(돌+흙) 두 가지, 움집 바닥(다진 흙 + 짚), 짚 바닥. 깔개: 털 깔개·갈대 자리(위층 덧그림).
벽면(방 북쪽 두 줄): 동굴 바위(rock) · 엮은 욋가지 흙벽(wattle) · 가죽 천막 안(hide). 줄마다 -u(윗줄) · -d(아랫줄),
끝 칸 -l·-r(방 동서 끝에서 벽이 돌아 들어가는 그늘). 벽화(동굴 바위 벽면에 그린 손바닥·나선·점·매머드·사슴·들소 — 추상 실루엣, 글자 없음).
천장: 방 밖 바위 윗면(ceil) + 바닥 쪽으로 테가 보이는 가장자리 일곱 가지(n·e·w·ne·nw·ew·new = 그 방향에 열린 칸이 있다).
가구: 화덕(냄비, 3프레임)·털 잠자리·짚 잠자리·족장 자리·무당 제단·돌 탁자·그루터기 걸상·돌 등잔(3프레임)·석순·해골 선반·
안료 그릇·석기 작업대, 벽걸이: 말린 약초·나무 탈·사슴뿔·물감 칠한 가죽.

  python3 interior.py
"""
import os, sys, math, json
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from pelt import pelt  # noqa: E402
from topview import slab  # noqa: E402
from px import C, rnd, h32, NT, MI, save
from kit import Reg, contact, OUT
from shapes import seeds, near2, rock_px, lit, tusk_arc
import terrain as T
from props import flame, stone_ring, post, beam, bone, skull_small

R = Reg('interior')
ANIM = []


def done(c):
    c.outline(bottom=('ink', 1))


# ═══════════════════════ 바닥 ═══════════════════════
def p_cave(lx, ly, s=31):
    """동굴 바닥: 바깥 흙보다 한 단 어두운 다진 흙에 잔돌이 드문드문(칸마다 같은 자리에 판을 박으면 물방울 무늬 바둑판이 됐다 — QA 1차)."""
    n = T.sm(lx, ly, s)
    t = 2 + (1 if n > 0.8 else 0) - (1 if n < 0.18 else 0)
    if rnd(lx, ly, s + 9) < 0.06: return ('dirt', 3)
    if rnd(lx, ly, s + 2) < 0.022: return ('stone', 3)
    if rnd(lx - 1, ly, s + 2) < 0.022: return ('stone', 2)
    if rnd(lx, ly - 1, s + 2) < 0.022: return ('dirt', 0)
    if rnd(lx, ly, s + 6) < 0.04: return ('dirt', t + 1)
    return ('dirt', max(1, t))


def p_hut(lx, ly, s=33):
    m, t = T.p_dirt(lx, ly, s)
    # 흩어진 짚 오라기(짧은 사선)
    for (x0, y0, d) in ((2, 3, 1), (10, 5, -1), (5, 11, 1), (13, 13, -1), (8, 8, 1)):
        for k in range(3):
            if (lx, ly) == (x0 + k * d, y0 + k // 2): return ('thatch', 4 if k == 0 else 3)
    return (m, t)


def p_straw(lx, ly, s=35):
    n = T.fbm(lx, ly, s)
    k = (lx + (ly // 2) * 3) % 5
    t = 3 + (1 if n > 0.6 else 0) - (1 if n < 0.32 else 0)
    if k == 0: t -= 1
    elif k == 2 and ly % 2 == 0: t += 1
    return ('thatch', max(1, min(5, t)))


for id_, nm, fn, s_, rl in (('floor-cave', '동굴 바닥(다진 흙 + 잔돌)', p_cave, 31, '동굴 거처·벽화 회랑 바닥.'),
                             ('floor-cave-b', '동굴 바닥(변주)', p_cave, 37, '동굴 바닥 사이 덩이로.'),
                             ('floor-hut', '움집 바닥(다진 흙 + 짚 오라기)', p_hut, 33, '움집·족장 집·무당 천막 안 바닥.'),
                             ('floor-straw', '짚 깐 바닥', p_straw, 35, '잠자리 둘레·창고 바닥.')):
    R.add(id_, nm, 1, 1, 'terrain', tags=['실내', '바닥'], rules=rl)(lambda c, fn=fn, s_=s_: c.F(0, 0, 16, 16, lambda wx, wy, i, j: fn(i, j, s_)))


@R.add('rug-fur', '털 깔개(짐승 가죽 모양)', 2, 2, 'flat', tags=['실내', '깔개', '털'], rules='화덕 앞·족장 자리 앞. 위층 덧그림.')
def _(c):
    pelt(c, 16, 16, 9.5, 8.6, 'hide', 3, s=3)
    for y in range(11, 21): c.P(16, y, 'hide', 2)                         # 등줄기(짙은 털)
    for (x, y) in ((12, 12), (20, 13), (11, 18), (21, 19), (14, 22), (18, 10)): c.P(x, y, 'hide', 2)   # 반점



@R.add('mat-reed', '갈대 자리', 2, 1, 'flat', tags=['실내', '깔개', '갈대'], rules='잠자리 앞·작업 자리. 위층 덧그림.')
def _(c):
    for y in range(2, 14):
        for x in range(1, 31):
            k = (x + (y // 2) % 2) % 3
            t = 4 if k == 0 else 3 if k == 1 else 2
            if y in (2, 13) or x in (1, 30): t = 1
            c.P(x, y, 'thatch', t)
    for x in range(1, 31, 5): c.VL(x, 2, 12, 'bark', 2)


# ═══════════════════════ 벽면 ═══════════════════════
def wall_rock(c, part, end=None, s=41):
    """동굴 바위 벽면: 윗줄 = 천장에서 내려오는 바위 이마(밝은 테 + 굵은 덩이), 아랫줄 = 바위 결 + 밑동 그늘.
    end 'l'/'r' = 방 끝에서 벽이 돌아 들어가 그늘진다."""
    sd = seeds(0, 0, 16, 32, 7, s)
    oy = 0 if part == 'u' else 16
    for y in range(16):
        for x in range(16):
            Y = y + oy
            u = (x + 0.5) / 16
            m, t = rock_px(x, Y, sd, 0.4, 'stone', base=3, cell=7, depth=Y / 40)
            if part == 'u' and y < 2: m, t = 'stone', 5 if y == 0 else 4
            if part == 'd' and y >= 13: t = max(1, t - (y - 12))
            if end == 'l' and x < 4: t = max(0, t - (4 - x))
            if end == 'r' and x > 11: t = max(0, t - (x - 11))
            c.P(x, y, m, t)


def wall_wattle(c, part, end=None, s=43):
    """엮은 욋가지 + 흙 바른 벽(움집 안): 윗줄은 이엉 처마 안쪽(짚 끝)과 들보, 아랫줄은 흙벽 + 엮음 결."""
    for y in range(16):
        for x in range(16):
            Y = y + (0 if part == 'u' else 16)
            if part == 'u' and y < 5:
                t = 2 + (1 if (x + y) % 3 == 0 else 0) - (1 if y == 4 else 0)
                c.P(x, y, 'thatch', t); continue
            if part == 'u' and y in (5, 6):
                c.P(x, y, 'bark', 4 if y == 5 else 2); continue
            weave = (x + (Y // 3) * 4) % 8
            t = 4 if weave < 4 else 3
            if Y % 3 == 2: t -= 1
            if rnd(x, Y, s) < 0.15: t = 3
            if part == 'd' and y >= 13: t = 2 if y == 13 else 1
            if end == 'l' and x < 4: t = max(1, t - (4 - x) // 2 - 1)
            if end == 'r' and x > 11: t = max(1, t - (x - 11) // 2 - 1)
            c.P(x, y, 'dirt', t)
        # 세운 기둥(칸 가운데)
    for y in range(7 if part == 'u' else 0, 16):
        c.P(7, y, 'bark', 4); c.P(8, y, 'bark', 3); c.P(9, y, 'bark', 1)


def wall_hide(c, part, end=None, s=45):
    """가죽 천막 안쪽 벽: 비스듬한 장대 사이로 팽팽한 가죽(위로 갈수록 좁아지는 판), 아랫줄 밑은 털 두른 단."""
    for y in range(16):
        for x in range(16):
            Y = y + (0 if part == 'u' else 16)
            k = x % 8
            t = 3 if k < 4 else 2
            if k == 0: t = 4
            if k == 7: t = 1
            if Y % 10 == 4 and k in (2, 5): t -= 1
            if part == 'd' and y >= 11:
                c.P(x, y, 'fur', 3 if y == 11 else 2 if (x + y) % 3 else 1); continue
            if end == 'l' and x < 4: t = max(0, t - 1)
            if end == 'r' and x > 11: t = max(0, t - 1)
            c.P(x, y, 'hide', t)
    for x in (0, 8):
        for y in range(16): c.P(x, y, 'bark', 3)


for wid, wn, fn in (('rock', '동굴 바위 벽면', wall_rock), ('wattle', '욋가지 흙벽', wall_wattle), ('hide', '가죽 천막 벽', wall_hide)):
    for part in ('u', 'd'):
        for end in (None, 'l', 'r'):
            i = 'wall-%s-%s%s' % (wid, part, '' if end is None else '-' + end)
            nm = '%s(%s줄%s)' % (wn, '윗' if part == 'u' else '아랫', '' if end is None else ', %s 끝' % ('서' if end == 'l' else '동'))
            R.add(i, nm, 1, 1, 'terrain', tags=['실내', '벽', wid], rules='방 북쪽 두 줄(윗줄 u, 아랫줄 d). 방 동서 끝 칸은 -l·-r.', wall=wid)(
                lambda c, fn=fn, part=part, end=end: fn(c, part, end))


# ═══════════════════════ 벽화(동굴 바위 벽면 위) ═══════════════════════
def paint_on(c, pix, mat='ochre', t=2):
    for (x, y) in pix:
        g = c.get(x, y)
        if g: c.P(x, y, mat, t if (x + y) % 5 else t + 1)


def sil(cx, cy, rows):
    """문자열 줄로 된 실루엣 → 좌표(가운데 정렬)."""
    out = []
    H = len(rows); W = max(len(r) for r in rows)
    for j, r in enumerate(rows):
        for i, ch in enumerate(r):
            if ch == '#': out.append((cx - W // 2 + i, cy - H // 2 + j))
    return out


HAND = ['..#.#..', '#.#.#.#', '#.#.#.#', '#######', '.#####.', '..###..', '..###..']
MAMMOTH = ['......#######.......', '....###########.....', '...#############....', '..###############...', '.################...', '##################..',
           '#.################..', '#..###############..', '#..###.#####..####..', '..###...###....###..', '..##....##.....##...']
DEER = ['.#.#..........', '..#...........', '.###..........', '..##########..', '..##########..', '...#########..', '...#.#....#.#.', '...#.#....#.#.']
BISON = ['....########....', '..############..', '.##############.', '###############.', '.##############.', '..#.##....##.#..', '..#..#....#..#..']
SPIRAL = ['..#####..', '.#.....#.', '#..###..#', '#.#...#.#', '#.#.#.#.#', '#.#..##.#', '#..#....#', '.#..####.', '..#......']


def painting(c, part, art, which):
    """두 줄(u·d) 벽면에 걸친 벽화 한 칸 폭(16) 또는 두 칸 폭(32, which = 0 왼쪽 / 1 오른쪽)."""
    wall_rock(c, part, s=41)
    oy = 0 if part == 'u' else 16
    ox = which * 16
    pix = []
    if art == 'hands':
        pix = [(x, y) for (x, y) in sil(5, 12, HAND)] + [(x, y) for (x, y) in sil(11, 20, HAND)]
        col = [('ochre', 2), ('bone', 3)]
        for k, p in enumerate((sil(5, 12, HAND), sil(11, 21, HAND))):
            m, t = col[k]
            for (x, y) in p:
                if c.get(x, y - oy) is not None and 0 <= y - oy < 16: c.P(x, y - oy, m, t if (x + y) % 4 else t + 1)
        return
    if art == 'spiral':
        for (x, y) in sil(8, 15, SPIRAL):
            if 0 <= y - oy < 16: c.P(x, y - oy, 'bone', 3 if (x + y) % 3 else 4)
        for (x, y) in ((3, 22), (13, 23), (4, 26), (12, 8), (2, 10)):
            if 0 <= y - oy < 16: c.P(x, y - oy, 'ochre', 3); c.P(x + 1, y - oy, 'ochre', 2)
        return
    if art == 'dots':
        for k in range(12):
            x = 3 + (k % 4) * 3 + (k // 4) % 2; y = 9 + (k // 4) * 5
            if 0 <= y - oy < 16: c.P(x, y - oy, 'ochre', 2); c.P(x + 1, y - oy, 'ochre', 3); c.P(x, y - oy + 1, 'ochre', 1)
        return
    shape = {'mammoth': MAMMOTH, 'deer': DEER, 'bison': BISON}[art]
    cx = 16 if art != 'deer' else 16
    pts = sil(cx, 16, shape)
    mat, t = ('ochre', 2) if art != 'deer' else ('ochre', 4)
    if art == 'bison': mat, t = ('ochre', 1)
    for (x, y) in pts:
        X, Y = x - ox, y - oy
        if 0 <= X < 16 and 0 <= Y < 16: c.P(X, Y, mat, t if (x * 3 + y) % 7 else t + 1)
    if art == 'mammoth':
        for (x, y) in ((1, 21), (0, 22), (0, 23), (1, 24)):          # 엄니(흰 물감)
            X, Y = x + 6 - ox, y - oy
            if 0 <= X < 16 and 0 <= Y < 16: c.P(X, Y, 'bone', 4)


for art, nm, wide in (('hands', '손바닥 벽화', 1), ('spiral', '나선 벽화', 1), ('dots', '점 무늬 벽화', 1),
                      ('mammoth', '매머드 벽화', 2), ('deer', '사슴 벽화', 2), ('bison', '들소 벽화', 2)):
    for which in range(wide):
        for part in ('u', 'd'):
            i = 'paint-%s%s-%s' % (art, '' if wide == 1 else '-%d' % which, part)
            R.add(i, '%s(%s%s줄)' % (nm, '' if wide == 1 else ('왼쪽 칸 ' if which == 0 else '오른쪽 칸 '), '윗' if part == 'u' else '아랫'),
                  1, 1, 'terrain', tags=['실내', '벽화', '동굴'], rules='동굴 바위 벽면(wall-rock) 자리에 같은 줄로 바꿔 놓는다. 두 칸 폭 벽화는 왼쪽·오른쪽 칸을 나란히.',
                  wall='rock')(lambda c, art=art, part=part, which=which: painting(c, part, art, which))


# ═══════════════════════ 천장(방 밖 바위 윗면) ═══════════════════════
CEIL_KEYS = ['', 'n', 'e', 'w', 'ne', 'nw', 'ew', 'new']


def ceiling(c, key, s=47):
    """방 밖 바위 덩어리 윗면(어두운 바위). key 의 방향(n·e·w)에 열린 칸(바닥·벽)이 있으면 그쪽 가장자리에 밝은 테 + 먹 선."""
    sd = seeds(0, 0, 16, 16, 6, s)
    for y in range(16):
        for x in range(16):
            (sx, sy, k), d1, d2 = near2(x, y, sd)
            t = 2 + (k % 2)
            if d2 - d1 < 0.9: t = 1
            elif (x + 0.5 - sx) + (y + 0.5 - sy) < -2: t += 1
            c.P(x, y, 'basalt', t)
    if 'n' in key:
        for x in range(16):
            c.P(x, 0, 'ink', 1); c.P(x, 1, 'basalt', 5); c.P(x, 2, 'basalt', 4); c.P(x, 3, 'basalt', 1)
    if 'w' in key:
        for y in range(16):
            c.P(0, y, 'ink', 1); c.P(1, y, 'basalt', 4); c.P(2, y, 'basalt', 1)
    if 'e' in key:
        for y in range(16):
            c.P(15, y, 'ink', 1); c.P(14, y, 'basalt', 4); c.P(13, y, 'basalt', 1)


for key in CEIL_KEYS:
    i = 'ceil' if not key else 'ceil-' + key
    R.add(i, '천장 바위' + ('' if not key else '(%s 쪽 가장자리)' % key), 1, 1, 'terrain', tags=['실내', '천장'],
          rules='방 밖 칸 전부. 막힘. 이웃(북·동·서)에 바닥이 있으면 그 방향 가장자리 조각.')(lambda c, key=key: ceiling(c, key))


# ═══════════════════════ 가구 ═══════════════════════
def hearth(c, f=0):
    """화덕(2×2): 큰 돌 테 아가리 속이 위에서 훤히 보인다 — 재·숯·엇갈린 장작·작은 불꽃. 뒤쪽 테 위 돌 셋에 작은 흙 냄비(아가리가 보인다)."""
    cx, cy = 16, 19
    stone_ring(c, cx, cy, 14.5, 10, s=9, inner=lambda x, y, dx, dy: ('basalt', 1 if dy < -0.35 else 2) if rnd(x, y, 3) > 0.3 else ('ash', 1) if rnd(x, y, 5) > 0.5 else ('fire', 1 + (rnd(x, y, 4) > 0.55)))
    for (dx0, dy0, dx1, dy1) in ((-6, 3, 5, -1), (-5, -1, 6, 3)):
        c.line(cx + dx0, cy + dy0, cx + dx1, cy + dy1, 'bark', 3); c.line(cx + dx0, cy + dy0 + 1, cx + dx1, cy + dy1 + 1, 'bark', 1)
        c.P(cx + dx0, cy + dy0, 'basalt', 1); c.P(cx + dx1, cy + dy1, 'fire', 3)
    flame(c, cx - 1, cy + 2, 7, 2.6, f=f, s=1); flame(c, cx + 3, cy + 2, 5, 1.8, f=f + 1, s=2)
    # 뒤 테 위 작은 냄비(아가리 타원 속 끓는 국)
    px_, py_ = 25, 9
    for y in range(py_, py_ + 6):
        for x in range(px_ - 4, px_ + 5):
            dx = (x + 0.5 - px_) / 4.2; dy = (y + 0.5 - py_ - 2.5) / 3.4
            if dx * dx + dy * dy <= 1: c.P(x, y, 'ochre', 3 if dx < 0 else 2)
    c.ell(px_, py_, 3.6, 2.2, lambda x, y, dx, dy, d: ('ochre', 4) if d > 0.55 else ('dirt', 3 + ((x + f) % 3 == 0)))
    for k in range(3):
        y = py_ - 3 - k * 2 - (f % 2)
        c.ell(px_ - 1 + k + (f % 2), y, 1.3, 1, lambda x, yy, dx, dy, d: ('smoke', 4 if dx < 0 else 3))
    done(c)


ids = []
for fr in range(3):
    i = 'hearth' if fr == 0 else 'hearth-f%d' % fr
    R.add(i, '화덕(큰 돌 테 + 숯불 + 뒤 테 위 작은 냄비)' + ('' if fr == 0 else ' (프레임 %d)' % (fr + 1)), 2, 2, 'container', tags=['실내', '불', '화덕', '요리'],
          rules='방 가운데 또는 벽에서 두 칸 띄워. 둘레 한 칸을 비우고 털 깔개·걸상을 둘러 둔다.')(lambda c, fr=fr: hearth(c, fr))
    ids.append(i)
ANIM.append(('hearth', '화덕', ids, 6))


def lamp(c, f=0):
    # 돌 등잔: 오목한 돌 그릇(아가리 안 기름이 보인다) + 심지 불
    c.ell(8, 11, 6, 3.4, lambda x, y, dx, dy, d: ('stone', 5 if dy < -0.2 else 4) if d > 0.5 else ('ochre', 1) if dy > -0.4 else ('stone', 2))
    for x in range(3, 14): c.P(x, 14, 'stone', 3 if x < 8 else 2); c.P(x, 15, 'stone', 1)
    flame(c, 8, 10, 6, 1.8, f=f, s=3)
    done(c)


ids = []
for fr in range(3):
    i = 'lamp' if fr == 0 else 'lamp-f%d' % fr
    R.add(i, '돌 등잔' + ('' if fr == 0 else ' (프레임 %d)' % (fr + 1)), 1, 1, 'container', tags=['실내', '불', '등잔', '동굴'],
          rules='벽화 앞·제단 곁·바위 턱.')(lambda c, fr=fr: lamp(c, fr))
    ids.append(i)
ANIM.append(('lamp', '돌 등잔', ids, 6))


@R.add('fur-bed', '털 잠자리(고사리 단 위 털가죽 두 겹 + 가죽 베개)', 2, 2, 'low_furniture', tags=['실내', '잠자리', '털'], rules='벽(북쪽) 곁이나 방 구석. 옆 한 칸을 비운다.')
def _(c):
    # 마른 고사리 단 위에 털가죽을 두세 겹 쌓은 낮은 잠자리: 밑 짙은 털가죽(가장자리가 술로 비어져 나옴) → 위 밝은 가죽(비스듬히) → 머리맡 말아 둔 가죽 베개.
    # 앞(남쪽)은 쌓인 가죽 두께가 둥글게 두 줄 보인다(상자처럼 곧은 앞판 없음).
    for y in range(7, 29):
        for x in range(0, 32):
            dx = (x + 0.5 - 16) / 15.8; dy = (y + 0.5 - 18) / 10.5
            d = dx * dx + dy * dy
            if d > 1 or (d > 0.86 and h32(x, y, 21) % 2): continue
            c.P(x, y, 'fern', 3 if (x * 3 + y) % 4 == 0 else 2)
    pelt(c, 16, 15.5, 12.5, 8.6, 'fur', 3, s=7)
    # 두께: 밑 가죽 아래 테두리 두 줄
    for x in range(3, 29):
        ys = [y for y in range(c.h) if c.get(x, y) and c.get(x, y)[0] == 'fur']
        if not ys: continue
        yb = max(ys)
        if yb + 2 < 30: c.P(x, yb + 1, 'fur', 1); c.P(x, yb + 2, 'fur', 0)
    top = C(32, 32)
    pelt(top, 17.5, 17.5, 8.6, 6.2, 'hide', 4, s=13)
    for y in range(32):
        for x in range(32):
            g = top.get(x, y)
            if g: c.P(x, y, *g)
    for y in range(7, 12):
        for x in range(9, 24):
            dy = (y + 0.5 - 9.5) / 2.5; dx = (x + 0.5 - 16.5) / 7.5
            if dx * dx + dy * dy > 1: continue
            c.P(x, y, 'hide', 5 if dy < -0.35 else 4 if dy < 0.4 else 2)
    c.HL(12, 9, 2, 'hide', 3); c.HL(19, 10, 2, 'hide', 3)
    c.outline(bottom=('ink', 1))



@R.add('straw-bed', '짚 잠자리', 2, 1, 'low_furniture', tags=['실내', '잠자리', '짚'], rules='움집 안 벽 곁.')
def _(c):
    for y in range(2, 14):
        for x in range(1, 31):
            dx = (x + 0.5 - 16) / 15; dy = (y + 0.5 - 7) / 5.5
            if dx * dx * dx * dx + dy * dy * dy * dy > 1: continue
            k = (x + (y // 2) * 3) % 4
            t = 4 if y < 8 else 3
            if k == 0: t -= 1
            if y > 10: t = 2
            c.P(x, y, 'thatch', t)
    c.ell(7, 6, 4, 2.4, lambda x, y, dx, dy, d: ('hide', 5 if dy < 0 else 3))
    done(c)


@R.add('chief-seat', '족장 자리(낮은 돌 단 + 털 + 엄니 등받이)', 2, 2, 'seat', tags=['실내', '족장', '자리'], rules='족장 집 북쪽 벽 가운데. 앞 두 칸을 비운다.')
def _(c):
    # 등 뒤 양쪽에서 휘어 오른 엄니 두 개 → 넓은 돌 단 윗면(밝게, 위에서 보인다) → 낮은 앞면 5줄. 털가죽이 앞으로 흘러내린다.
    tusk_arc(c, 9, 20, 6, 16, 180, 285, width=3)
    tusk_arc(c, 23, 20, 6, 16, 360, 255, width=3)
    for y in range(11, 30):
        for x in range(2, 30):
            if y < 24:
                if min(x - 2, 29 - x) + (y - 11) < 1: continue
                t = 6 if y == 11 else 5 if x < 14 else 4
                if (x * 5 + y * 3) % 13 == 0: t -= 1
            else:
                t = 3 if x < 12 else 2
                if y == 29: t = 1
            c.P(x, y, 'stone', t)
    for y in range(12, 27):
        for x in range(8, 24):
            dx = (x + 0.5 - 16) / 8; dy = (y + 0.5 - 18) / 7
            if dx * dx + dy * dy * (1.4 if dy < 0 else 0.8) > 1: continue
            d = dx * dx + dy * dy * (1.4 if dy < 0 else 0.8)
            if d > 0.62:
                c.P(x, y, 'fur', 3 if (x + y) % 3 else 2); continue
            t = 5 if dx + dy < -0.4 else 4 if dx < 0.3 else 3
            if y >= 24: t = 2 if (x % 3) else 1
            c.P(x, y, 'hide', t)
    skull_small(c, 16, 6)
    done(c)


@R.add('shaman-altar', '무당 제단(머리뼈·물감 그릇·깃털)', 2, 1, 'low_furniture', tags=['실내', '무당', '제단'], rules='무당 천막·동굴 깊은 곳 북쪽 벽 앞.')
def _(c):
    for y in range(4, 15):
        for x in range(1, 31):
            if y < 10: t = 6 if y == 4 else 5 if x < 16 else 4
            else: t = 3 if x < 12 else 2 if y < 14 else 1
            c.P(x, y, 'stone', t)
    skull_small(c, 8, 4)
    c.ell(18, 6, 3, 1.6, lambda x, y, dx, dy, d: ('ochre', 4) if d > 0.5 else ('feather', 2))
    c.ell(25, 7, 2.6, 1.4, lambda x, y, dx, dy, d: ('bone', 4) if d > 0.5 else ('ink', 1))
    for j in range(5): c.P(13, 1 + j, 'feather', 3 - j // 3); c.P(14, 2 + j, 'feather', 2)
    done(c)


@R.add('stone-table', '돌 탁자(넓은 돌판)', 2, 1, 'low_furniture', tags=['실내', '탁자', '돌'], rules='방 가운데·화덕 곁. 둘레 한 칸 비움.')
def _(c):
    # 넓은 돌판(위에서 보이는 울퉁불퉁한 윗면 + 앞 두께) + 앞 받침돌 둘
    for x0 in (5, 22):
        for y in range(9, 15):
            for x in range(x0, x0 + 5): c.P(x, y, 'stone', 3 if x < x0 + 2 else 2 if y < 14 else 1)
    slab(c, 16, 6, 15, 4.6, 3, mat='stone', s=21, rough=0.08)
    c.ell(10, 5, 2.5, 1.4, lambda x, y, dx, dy, d: ('ochre', 4) if d > 0.5 else ('bloom', 1))
    bone(c, 18, 5, 24, 4, t=4, th=1)
    done(c)


@R.add('stump-stool', '그루터기 걸상', 1, 1, 'seat', tags=['실내', '걸상'], rules='화덕·탁자 둘레.')
def _(c):
    for y in range(6, 15):
        for x in range(3, 13):
            u = (x - 3 + 0.5) / 10
            c.P(x, y, 'bark', max(0, min(5, 3 + lit(u) - (1 if (x + y) % 4 == 0 else 0))))
    c.ell(8, 6, 5, 2.8, lambda x, y, dx, dy, d: ('thatch', 4) if 0.15 < d < 0.55 else ('thatch', 3) if d <= 0.15 else ('thatch', 5) if dy < 0 else ('bark', 4))
    done(c)


@R.add('skull-shelf', '머리뼈 바위 턱(두 단)', 2, 2, 'tall_furniture', tags=['실내', '무당', '선반', '동굴'], rules='벽(북쪽) 앞.')
def _(c):
    # 벽 앞에 쌓은 바위 턱 두 단: 단마다 넓은 판돌(윗면이 위에서 보인다) 뒤쪽에 머리뼈를 얹고 앞쪽 윗면은 비워 둔다. 단 사이는 거친 바위 받침.
    sd = seeds(0, 0, 32, 32, 8, 53)
    for y in range(8, 31):
        for x in range(3, 29):
            if (x < 6 or x > 25) and y < 14: continue
            u = (x + 0.5) / 32
            m, t = rock_px(x, y, sd, u, 'stone', base=3, cell=8, depth=0.3)
            c.P(x, y, m, max(1, t - 1))
    slab(c, 16, 18.5, 14.5, 4.2, 3, mat='stone', s=31, rough=0.08)
    slab(c, 16, 6, 11.5, 3.6, 3, mat='stone', s=33, rough=0.08)
    for (cx, cy) in ((10, 4), (16, 3), (22, 4), (11, 16), (20, 16)):
        skull_small(c, cx, cy)
    done(c)


@R.add('pigment-pots', '물감 그릇(붉은·흰·검은)', 1, 1, 'container', tags=['실내', '물감', '벽화'], rules='벽화 앞 바닥.')
def _(c):
    for (cx, cy, m, t) in ((5, 7, 'ochre', 2), (11, 6, 'bone', 4), (8, 12, 'tar', 2)):
        c.ell(cx, cy, 3.6, 2.6, lambda x, y, dx, dy, d, m=m, t=t: ('stone', 5 if dy < 0 else 4) if d > 0.45 else (m, t))
        c.HL(cx - 3, cy + 2, 7, 'stone', 2)
    c.line(12, 10, 15, 14, 'bark', 4)
    done(c)


@R.add('knap-bench', '석기 작업대(그루터기 + 부싯돌 날)', 2, 1, 'low_furniture', tags=['실내', '작업', '석기'], rules='움집·동굴 입구 곁 밝은 자리.')
def _(c):
    for y in range(3, 15):
        for x in range(2, 30):
            if y < 9:
                t = 5 if y == 3 else 4
                if 6 < x < 26 and (x + y) % 6 == 0: t = 3
            else:
                t = 3 if x < 12 else 2
                if y == 14: t = 1
            c.P(x, y, 'bark', t)
    for (x, y) in ((7, 5), (12, 6), (18, 4), (23, 6)):
        c.P(x, y, 'basalt', 5); c.P(x + 1, y, 'basalt', 3); c.P(x, y + 1, 'basalt', 2)
    for (x, y) in ((4, 15), (9, 15), (26, 15), (14, 15)): c.P(x, y, 'stone', 4)
    done(c)


@R.add('stalagmite', '석순', 1, 2, 'organic', tags=['실내', '동굴', '석순'], rules='동굴 벽 곁·구석. 길을 막지 않는다.')
def _(c):
    for (cx, top, w) in ((7, 3, 6), (11, 14, 4), (4, 18, 3)):
        for y in range(top, 31):
            k = (y - top) / max(1, 30 - top)
            half = 0.6 + k * w / 2
            for x in range(int(cx - half), int(cx + half) + 1):
                u = (x - (cx - half) + 0.5) / (2 * half + 1)
                t = 4 + lit(u)
                if (y - top) % 5 == 0: t -= 1
                c.P(x, y, 'stone', max(1, min(6, t)))
        c.P(cx, top, 'stone', 6)
    done(c)


# ── 벽걸이 ──
@R.add('herbs-wall', '말린 약초 다발(벽걸이)', 1, 1, 'wall_mounted', tags=['실내', '벽걸이', '약초'], rules='벽면 아랫줄 위.')
def _(c):
    c.HL(1, 3, 14, 'bark', 4); c.HL(1, 4, 14, 'bark', 2)
    for k, x in enumerate((3, 7, 11)):
        for y in range(5, 14 - k % 2):
            for i in range(-1, 2):
                if y > 6 and abs(i) == 1 and (y + k) % 2: continue
                c.P(x + i, y, 'grass' if k != 1 else 'thatch', 4 if i < 0 else 3 if i == 0 else 2)
        c.HL(x - 1, 5, 3, 'thatch', 2)


@R.add('mask-wall', '나무 탈(추상, 벽걸이)', 1, 1, 'wall_mounted', tags=['실내', '벽걸이', '탈', '주술'], rules='무당 천막·족장 집 벽면.')
def _(c):
    c.ell(8, 8, 5.5, 7, lambda x, y, dx, dy, d: ('bark', 4 if dx + dy < -0.4 else 3 if dx < 0.3 else 2))
    for (x, y) in ((5, 6), (10, 6)):
        c.HL(x, y, 2, 'ink', 0); c.HL(x, y - 1, 2, 'bone', 4)
    c.HL(6, 11, 5, 'ink', 1)
    for y in range(3, 14, 3): c.P(8, y, 'ochre', 3)
    c.HL(3, 4, 2, 'feather', 3); c.HL(11, 4, 2, 'feather', 2)
    c.outline(bottom=None)


@R.add('antler-wall', '사슴뿔(벽걸이)', 1, 1, 'wall_mounted', tags=['실내', '벽걸이', '뿔'], rules='족장 집·사냥꾼 움집 벽면.')
def _(c):
    c.ell(8, 11, 2.6, 2.4, lambda x, y, dx, dy, d: ('bark', 4 if dx < 0 else 2))
    for d in (-1, 1):
        pts = [(8 + d * 2, 10), (8 + d * 5, 6), (8 + d * 6, 2)]
        for a, b in zip(pts, pts[1:]): c.line(a[0], a[1], b[0], b[1], 'bone', 4 if d < 0 else 3)
        c.line(8 + d * 4, 7, 8 + d * 3, 3, 'bone', 4 if d < 0 else 3)
        c.line(8 + d * 6, 4, 8 + d * 7, 2, 'bone', 5)


@R.add('hide-wall', '물감 칠한 가죽(벽걸이)', 1, 2, 'wall_mounted', tags=['실내', '벽걸이', '가죽'], rules='벽면 두 줄에 걸쳐 건다.')
def _(c):
    pts = [(3, 4), (8, 2), (13, 4), (14, 14), (13, 26), (8, 29), (3, 26), (2, 14)]
    c.poly(pts, lambda x, y: ('hide', 4 if x < 7 else 3 if x < 11 else 2))
    c.HL(2, 2, 13, 'bark', 4); c.HL(2, 3, 13, 'bark', 2)
    for (x, y) in sil(8, 15, ['..###..', '.#####.', '###.###', '.#####.', '..#.#..']): c.P(x, y, 'ochre', 2)
    for y in range(20, 26, 2): c.HL(5, y, 6, 'ink', 2)


# ═══════════════════════ 조립 표본(관문용) ═══════════════════════
def room_swatch(wall='rock', paint=True, seq=None, pillar=False):
    """작은 방 한 장(10×7 칸): 천장 테두리 + 북쪽 벽 두 줄(끝 칸 포함, 벽화 넣음) + 바닥. 벽·천장 조각이 화소 그대로 들어간다."""
    W, H = 10, 7
    grid = [['ceil'] * W for _ in range(H)]
    floor = 'floor-cave' if wall == 'rock' else 'floor-hut'
    for y in range(3, H - 1):
        for x in range(1, W - 1): grid[y][x] = floor if (x + y) % 5 else (floor + '-b' if wall == 'rock' else 'floor-straw')
    for x in range(1, W - 1):
        e = '-l' if x == 1 else '-r' if x == W - 2 else ''
        grid[1][x] = 'wall-%s-u%s' % (wall, e); grid[2][x] = 'wall-%s-d%s' % (wall, e)
    if wall == 'rock' and paint:
        seq = seq or [('hands', 0), ('mammoth', 2), ('spiral', 0), ('deer', 2)]
        x = 2
        for art, wide in seq:
            if wide == 0:
                if x < W - 2: grid[1][x] = 'paint-%s-u' % art; grid[2][x] = 'paint-%s-d' % art; x += 1
            else:
                if x + 1 < W - 2:
                    for k in range(2): grid[1][x + k] = 'paint-%s-%d-u' % (art, k); grid[2][x + k] = 'paint-%s-%d-d' % (art, k)
                    x += 2
    # 남쪽 출입구 틈 · 바닥에서 솟은 바위 기둥(천장과 같은 덩어리)
    grid[H - 1][4] = floor; grid[H - 1][5] = floor
    if pillar:
        grid[4][7] = 'ceil'; grid[5][7] = 'ceil'
    # 천장 가장자리 열쇠
    def open_(x, y): return 0 <= x < W and 0 <= y < H and grid[y][x] != 'ceil' and not grid[y][x].startswith('ceil')
    for y in range(H):
        for x in range(W):
            if not grid[y][x].startswith('ceil'): continue
            k = ('n' if open_(x, y - 1) else '') + ('e' if open_(x + 1, y) else '') + ('w' if open_(x - 1, y) else '')
            grid[y][x] = 'ceil' + ('-' + k if k else '')
    return grid


def swatch_img(grid):
    H, W = len(grid), len(grid[0])
    c = C(W * 16, H * 16); places = []
    for y in range(H):
        for x in range(W):
            it = R.by[grid[y][x]]
            c.paste(R.render(it), x * 16, y * 16)
            places.append(dict(id=grid[y][x], x=x * 16, y=y * 16))
    return c, places


SWATCHES = {
    'cave-gallery': dict(wall='rock', paint=True, name='prehistoric cave dwelling interior room with painted cave wall (abstract hand prints, spiral, animal silhouettes)'),
    'cave-pillar': dict(wall='rock', paint=True, seq=[('dots', 0), ('bison', 2)], pillar=True,
                        name='prehistoric cave interior room with a rock pillar, painted wall (dot pattern, bison silhouette)'),
    'hut-wattle': dict(wall='wattle', paint=False, name='prehistoric round hut interior room, woven wattle-and-daub wall'),
    'hut-hide': dict(wall='hide', paint=False, name='prehistoric hide tent interior room, stretched hide wall'),
}


def export_swatches():
    d = os.path.join(OUT, 'interior', '_gate_assembled'); os.makedirs(d, exist_ok=True)
    man, rows = {}, []
    for sid, sw in SWATCHES.items():
        g = room_swatch(sw['wall'], sw['paint'], sw.get('seq'), sw.get('pillar', False))
        c, places = swatch_img(g)
        png = os.path.join(d, 'ph-room-%s.png' % sid); save(c, png)
        man[sid] = dict(png=os.path.relpath(png, os.path.join(OUT, '..', '..')), parts=places)
        rows.append(dict(png=os.path.basename(png), kind='terrain', name=sw['name'], label='prehistoric/ph-room-' + sid))
    json.dump(man, open(os.path.join(d, 'manifest.json'), 'w'), ensure_ascii=False, indent=1)
    with open(os.path.join(d, 'items.jsonl'), 'w') as f:
        for r in rows: f.write(json.dumps(r, ensure_ascii=False) + '\n')
    return man


if __name__ == '__main__':
    rows = R.export()
    d = os.path.join(OUT, 'interior', '_gate')
    man = export_swatches()
    covered = {p['id'] for m in man.values() for p in m['parts']}
    with open(os.path.join(d, 'items.jsonl'), 'w') as f:
        for r in rows:
            if r['png'][3:-4] not in covered: f.write(json.dumps(r, ensure_ascii=False) + '\n')
    ims = [(it['id'], R.render(it).img()) for it in R.items if '-f' not in it['id'] and not it['id'].startswith(('wall-', 'paint-', 'ceil'))]
    for sid in man:
        sw = SWATCHES[sid]
        ims.append(('room-' + sid, swatch_img(room_swatch(sw['wall'], sw['paint'], sw.get('seq'), sw.get('pillar', False)))[0].img()))
    contact(ims, os.path.join(OUT, 'interior', 'preview.png'), z=3, W=1900, bg=(90, 70, 60))
    print(len(R.items), 'interior; uncovered walls/ceil:', sorted(i['id'] for i in R.items if i['id'].startswith(('wall-', 'paint-', 'ceil')) and i['id'] not in covered))
