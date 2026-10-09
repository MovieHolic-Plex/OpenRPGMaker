# 하늘 도시 바닥 이음 시험: python3 check_tiling.py
#   check-tiling.png  — 바닥마다 20×15칸 면 세 장: [옛 판 대표 칸으로 칠함(조수 시험 sc3 와 같은 방식) | 새 바탕 칸으로 칠함 | 새 바탕 + 자유 배치 조각 흩기]
#   check-autotile.png — 덩이 붓(구름 둑·구름 틈·구름 길·석재 섬 연석)을 5×5 덩이·나선·코 튀어나온 L자로 칠한 것
# 이음 규칙 자동 검사: 바탕 키트 = Q 3×3, 바닥 조각 테두리·바깥 줄눈 = Q, 덩이 붓 15번 칸 = Q. 흩은 면 휘도 자기상관(16·48·96px)을 찍는다.
import os, sys, io, subprocess, random, math
HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, HERE)
import numpy as np
from PIL import Image, ImageDraw, ImageFont
import sc_tiling as Z
from sc_base import T, new, at_cell, at_paint, _hash

ROOT = os.path.abspath(os.path.join(HERE, '..', '..', '..'))
OLD_REV = 'a50b9f6d3e'          # 보정 전(웨이브 2 첫 판)
def old_part(name):
    b = subprocess.run(['git', '-C', ROOT, 'show', '%s:tiledata/beodeul-variants/sky-city/parts/%s.png' % (OLD_REV, name)], capture_output=True).stdout
    return Image.open(io.BytesIO(b)).convert('RGBA')
def P(name): return Image.open(os.path.join(HERE, 'parts', name + '.png')).convert('RGBA')

FAM = [   # (제목, 옛 판 이름, 새 바탕 이름, Q, 흩을 조각)
    ('구름 바다(하늘)', 'ground-cloudsea', 'ground-cloudsea', Z.q_sky(), 'sky'),
    ('구름 융단', None, 'ground-cloudcarpet', Z.q_cloud(), 'carpet'),
    ('구름 길', 'ground-cloudpath', 'ground-cloudpath', Z.q_path(), 'path'),
    ('흰 대리석', 'ground-marble', 'ground-marble', Z.q_marble(), 'marble'),
]

def center_cell(im):
    w, h = im.width // T, im.height // T
    return im.crop((w // 2 * T, h // 2 * T, w // 2 * T + T, h // 2 * T + T))

def fill(cell, w=20, h=15):
    return Z.tile_q(cell, w, h)

def sizes_of(names):
    out = []
    for n in names:
        im = P(n); out.append((n, im.width // T, im.height // T))
    return out

def scattered(kind, w=20, h=15, seed=3):
    """문서대로 깐 면: 바탕 칸을 칠하고 자유 배치 조각을 흩는다(격자 블록 없음)."""
    fam = {f[4]: f for f in FAM}[kind]
    o = fill(center_cell(P(fam[2])), w, h)
    mask = [[True] * w for _ in range(h)]
    if kind == 'sky':
        big = sizes_of([n for (n, a, b, sd) in Z.CLUMPS if a * b >= 8]); small = sizes_of([n for (n, a, b, sd) in Z.CLUMPS if a * b < 8])
        r = random.Random(seed); used = [[False] * w for _ in range(h)]; picks = []
        zone = [[Z.vnoise(x * .85 + y * .3 + seed * 7, y * 1.3, 9, 91) > .5 for x in range(w)] for y in range(h)]
        for (n, x, y) in Z.scatter_big_first(zone, big + small, seed, fill=.6, hop=.3):
            picks.append((n, x, y))
        rest = [[not zone[y][x] for x in range(w)] for y in range(h)]
        picks += Z.scatter_cells(rest, small, seed + 1, fill=.04, gap=3)
        for (n, x, y) in Z.scatter_cells(rest, sizes_of(['sky_streak_a', 'sky_streak_b']), seed + 2, fill=.02, gap=3): picks.append((n, x, y))
    elif kind == 'carpet':
        picks = Z.scatter_big_first(mask, sizes_of([n for (n, a, b, sd) in Z.BILLOWS]), seed, fill=.35, hop=.85)
    elif kind == 'path':
        picks = Z.scatter_cells(mask, sizes_of([n for (n, a, b, sd) in Z.PATCHES_PATH]), seed, fill=.3, gap=1)
    else:
        ms = sizes_of([n for (n, k, sd) in Z.PATCHES_MARBLE if n != 'marble_inlay'])
        picks = Z.scatter_cells(mask, ms * 3 + sizes_of(['marble_inlay']), seed, fill=.55)
    for (n, x, y) in sorted(picks, key=lambda q: (q[2], q[1])):
        o.alpha_composite(P(n), (x * T, y * T))
    return o

def lattice(im):
    """휘도 자기상관(16·48·96px 가로 이동). 블록 격자가 있으면 그 주기 값이 크다."""
    g = np.array(im.convert('L')).astype(float); g -= g.mean()
    out = {}
    for k in (16, 48, 96):
        a, b = g[:, :-k], g[:, k:]
        den = math.sqrt((a * a).sum() * (b * b).sum()) or 1
        out[k] = (a * b).sum() / den
    return out

def verify():
    bad = []
    for (title, _, base, q, _k) in FAM:
        qa = np.array(Z.tile_q(q, 3, 3))
        if not np.array_equal(np.array(P(base)), qa): bad.append('%s 바탕이 Q 3×3 이 아니다' % base)
    for (n, w, h, sd) in Z.PATCHES_PATH:
        a = np.array(P(n)); qa = np.array(Z.tile_q(Z.q_path(), w, h))
        pm = np.zeros(a.shape[:2], bool); pm[:2] = pm[-2:] = True; pm[:, :2] = pm[:, -2:] = True
        if not np.array_equal(a[pm], qa[pm]): bad.append('%s 테두리가 Q 가 아니다' % n)
    for (n, k, sd) in Z.PATCHES_MARBLE:
        a = np.array(P(n)); h, w = a.shape[0] // T, a.shape[1] // T; qa = np.array(Z.tile_q(Z.q_marble(), w, h))
        for edge in (a[-1, :] == qa[-1, :], a[:, -1] == qa[:, -1]):           # 바깥 줄눈(오른쪽·아래)은 Q 와 같다
            if not edge.all(): bad.append('%s 바깥 줄눈이 Q 와 다르다' % n); break
    for (n, q) in (('autotile-cloudbank', Z.q_cloud()), ('autotile-cloudgap', Z.q_sky()), ('autotile-cloudpath', Z.q_path()), ('autotile-cloudfringe', Z.q_cloud())):
        if not np.array_equal(np.array(at_cell(P(n), 15)), np.array(q)): bad.append('%s 15번 칸이 Q 가 아니다' % n)
    return bad

def main():
    import math as _m
    bad = verify()
    print('이음 규칙:', '모두 통과' if not bad else bad)
    try: F = ImageFont.truetype('/usr/share/fonts/truetype/nanum/NanumSquare_acR.ttf', 15)
    except Exception: F = None
    rows = []
    for (title, oldname, base, q, kind) in FAM:
        old = fill(center_cell(old_part(oldname))) if oldname else None
        sc = scattered(kind); big = scattered(kind, 48, 36, 11)
        print('%-10s 흩은 면 자기상관 %s  (48×36 면 %s)' % (kind, {k: round(v, 2) for k, v in lattice(sc).items()}, {k: round(v, 2) for k, v in lattice(big).items()}))
        rows.append((title, old, fill(center_cell(P(base))), sc))
    S = 2; pw, ph = 20 * T * S, 15 * T * S; lab = 24; gap = 12
    sheet = Image.new('RGBA', (pw * 3 + gap * 4, (ph + lab + gap) * len(rows) + 30), (22, 22, 30, 255)); d = ImageDraw.Draw(sheet)
    d.text((gap, 6), '바닥을 20×15칸 면으로 깐 시험(2배).  왼쪽: 옛 판 대표 칸으로 칠함(조수 시험 방식)  ·  가운데: 새 바탕 칸으로 칠함  ·  오른쪽: 새 바탕 + 자유 배치 조각을 칸 단위로 흩음(6칸 격자 없음)', fill=(230, 230, 230, 255), font=F)
    for i, (title, old, cfill, mix_) in enumerate(rows):
        y = 30 + i * (ph + lab + gap)
        for j, (cap, im) in enumerate((('옛 판 · ' + title, old), ('새 바탕 칸 · ' + title, cfill), ('새 바탕 + 조각 흩기 · ' + title, mix_))):
            x = gap + j * (pw + gap)
            d.text((x, y + 3), cap if im is not None else cap + ' (옛 판 없음 — 새 재질)', fill=(230, 230, 230, 255), font=F)
            if im is not None: sheet.alpha_composite(im.resize((pw, ph), Image.NEAREST), (x, y + lab))
    sheet.save(os.path.join(HERE, 'check-tiling.png'))
    big = scattered('sky', 48, 36, 11)
    big.resize((big.width * 2, big.height * 2), Image.NEAREST).save(os.path.join(HERE, '_qa', 'sky-48x36.png'))
    # 덩이 붓
    M = [["......", ".####.", ".####.", ".####.", ".####.", "......"],
         ["........", "..###...", ".#####..", ".##.###.", ".##..##.", "..####..", "........"],
         [".........", ".####....", ".#####...", ".########", "..#######", "....##...", "........."]]
    sea = lambda w, h: scattered('sky', w, h, 5)
    car = lambda w, h: Z.tile_q(Z.q_cloud(), w, h)
    mar = lambda w, h: Z.tile_q(Z.q_marble(), w, h)
    def stone_under(w, h):
        im = sea(w, h)
        return im
    sets = [('구름 둑(autotile-cloudbank) — 하늘 위(속 칸 위에 cloud_billow 를 얹기 전)', P('autotile-cloudbank'), lambda w, h: Z.tile_q(Z.q_sky(), w, h)),
            ('구름 번짐(autotile-cloudfringe) — 하늘 위', P('autotile-cloudfringe'), lambda w, h: Z.tile_q(Z.q_sky(), w, h)),
            ('구름 틈(autotile-cloudgap) — 구름 융단 위', P('autotile-cloudgap'), car),
            ('구름 길(autotile-cloudpath) — 구름 융단 위', P('autotile-cloudpath'), car)]
    blocks = []
    for (cap, sh, under) in sets:
        blocks.append((cap, Z.check_autotile(sh, under, M)))
    # 석재 섬: 구름 바다 위에 대리석 키트로 섬 모양 + 연석 붓 + 남쪽 단면(끝 조각) — 섬 하나
    rowsS = ["..........", "..#####...", ".########.", ".########.", ".#######..", "..........", "..........", "..........", ".........."]
    mk = [[c == '#' for c in r] for r in rowsS]; Hh, Ww = len(rowsS), len(rowsS[0])
    bg = Z.tile_q(Z.q_sky(), Ww, Hh); mf = Z.marble_field(mk, 7, fill=.55)
    isl = new(Ww * T, Hh * T)
    for y in range(Hh):
        for x in range(Ww):
            if mk[y][x]: isl.alpha_composite(mf.crop((x * T, y * T, x * T + T, y * T + T)), (x * T, y * T))
    at_paint(isl, P('autotile-islandrim-stone'), mk)
    fs, fw, fe = P('face_island_stone'), P('face_stone_end_w'), P('face_stone_end_e')
    for x in range(Ww):
        ys = [y for y in range(Hh) if mk[y][x] and (y + 1 >= Hh or not mk[y + 1][x])]
        for y in ys:
            westend = not (x > 0 and mk[y][x - 1] and not mk[y + 1][x - 1])
            eastend = not (x < Ww - 1 and mk[y][x + 1] and not mk[y + 1][x + 1])
            piece = fw if westend else (fe if eastend else fs.crop(((x % 3) * T, 0, (x % 3) * T + T, 48)))
            bg.alpha_composite(piece, (x * T, (y + 1) * T))
    bg.alpha_composite(isl)
    blocks.append(('석재 섬 — 대리석 바탕 + 연석 붓(둥근 모서리) + 마름돌 단면(양끝 조각)', bg))
    # 구름 둑 + 속 칸 아래층 구름 융단 + 뭉게(문서대로 깐 구름 덩이 지대)
    rowsB = ["............", "...####.....", "..#######...", ".##########.", ".#########..", "..#######...", "....###.....", "............"]
    mb_ = [[c == '#' for c in r] for r in rowsB]; Hb, Wb = len(rowsB), len(rowsB[0])
    inner = [[mb_[y][x] and all(0 <= x + dx < Wb and 0 <= y + dy < Hb and mb_[y + dy][x + dx] for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1))) for x in range(Wb)] for y in range(Hb)]
    bgb = Z.tile_q(Z.q_sky(), Wb, Hb)
    for y in range(Hb):
        for x in range(Wb):
            if inner[y][x]: bgb.paste(Z.q_cloud(), (x * T, y * T))
    up = new(Wb * T, Hb * T); at_paint(up, P('autotile-cloudbank'), mb_)
    picks = Z.scatter_big_first(inner, sizes_of([n for (n, a, b, sd) in Z.BILLOWS]), 7, fill=.7, hop=.85)
    for (n, x, y) in picks:
        w_, h_ = P(n).width // T, P(n).height // T
        up.paste((0, 0, 0, 0), (x * T, y * T, (x + w_) * T, (y + h_) * T))
    bgb.alpha_composite(up)
    for (n, x, y) in sorted(picks, key=lambda q: (q[2], q[1])): bgb.alpha_composite(P(n), (x * T, y * T))
    blocks.append(('구름 덩이 지대 — 구름 둑 붓 + 속 칸 아래층 구름 융단 + cloud_billow 흩기(문서 순서)', bgb))
    S2 = 3
    W2 = max(b.width for _, b in blocks) * S2 + 24; H2 = sum(b.height * S2 + 30 for _, b in blocks) + 10
    sh2 = Image.new('RGBA', (W2, H2), (22, 22, 30, 255)); d2 = ImageDraw.Draw(sh2); y = 6
    for cap, b in blocks:
        d2.text((12, y), cap, fill=(230, 230, 230, 255), font=F)
        sh2.alpha_composite(b.resize((b.width * S2, b.height * S2), Image.NEAREST), (12, y + 22)); y += b.height * S2 + 30
    sh2.save(os.path.join(HERE, 'check-autotile.png'))
    return bad

if __name__ == '__main__':
    sys.exit(1 if main() else 0)
