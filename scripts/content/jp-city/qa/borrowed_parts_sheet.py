#!/usr/bin/env python3
"""jp_city 「시골이 빌려 쓰는 부품」 전후 비교 그림 — 같은 장면 조각(비녜트)을 두 시트(전·후)로 그려 버들항 기준 크롭과 나란히 놓는다.

  python3 scripts/content/jp-city/qa/borrowed_parts_sheet.py --before <루트> --after <루트> --out DIR [--only poles,lane,...]

루트 = 저장소 체크아웃 또는 preview_bake.sh 의 미리보기 루트(public/assets/jp-city/jp-city-chipset.png + src/assets/jpCityTileset.json).
DIR/<이름>-x1.png(전|후 1배) · <이름>-x4.png(전|후 4배) · <이름>-ref-x4.png(버들항 같은 배율) · <이름>-after-x1.png(판정자용 후 1배) 를 쓴다.
비녜트: poles(나무·콘크리트 전봇대 + 전선 kit 를 실제 놓는 규칙대로) · lane(생활도로 오토타일 T자) · canal(수로 굽이) ·
hedge(생울타리 선) · car(주차 승용차 kit) · train(통근 열차 A B A B + 선로) · station(さくら駅 작은 역사).
"""
import argparse, json, os, sys
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..', '..', '..'))
BEODEUL = os.path.join(ROOT, 'tiledata', 'beodeul-city', 'render', 'city6.png')
# 버들항 기준 크롭(1600×1600 city6 의 px 상자) — 재료가 가장 가까운 곳
REF_BOX = {'canal': (480, 520, 800, 720), 'lane': (860, 880, 1100, 1040), 'hedge': (0, 560, 240, 760), 'poles': (480, 520, 800, 720),
           'car': (560, 1360, 900, 1560), 'train': (560, 1360, 900, 1560), 'station': (860, 880, 1100, 1040)}
GRASS = (88, 128, 64, 255)


class Sheet:
    def __init__(s, root):
        s.d = json.load(open(os.path.join(root, 'src/assets/jpCityTileset.json'), encoding='utf-8'))
        s.sh = Image.open(os.path.join(root, 'public/assets/jp-city/jp-city-chipset.png')).convert('RGBA')
        s.cols = s.sh.width // 16
        s.kits = {k['id']: k for k in s.d['structureKits']}
        s.auto = {a['id']: a for a in s.d['autotileGroups']}
        s.cache = {}

    def tile(s, t):
        if t not in s.cache:
            s.cache[t] = s.sh.crop(((t % s.cols) * 16, (t // s.cols) * 16, (t % s.cols) * 16 + 16, (t // s.cols) * 16 + 16))
        return s.cache[t]


def _hash(x, y):
    n = (x * 374761393) ^ (y * 668265263) ^ 0x2f6b1d
    n &= 0xffffffff; n = ((n ^ (n >> 13)) * 1274126177) & 0xffffffff
    return (n ^ (n >> 16)) & 0xffffffff


class Canvas:
    """칸 격자 장면: 1층(바닥) → 2층 → 3층(키트 위층) → 4층(전선) 순서로 합성."""
    def __init__(s, S, w, h):
        s.S, s.w, s.h = S, w, h
        s.low = [[None] * w for _ in range(h)]; s.mid = [[None] * w for _ in range(h)]; s.up = [[None] * w for _ in range(h)]; s.top = [[None] * w for _ in range(h)]

    def fill_auto(s, aid, mask_rows, layer='low'):
        """mask_rows: 문자열 줄('#' = 이 재료). 8방(아래층)·4방(선) 오토타일을 맵 밖=같은 재료 규칙까지 엔진처럼 고른다."""
        a = s.S.auto[aid]; H = len(mask_rows); W = len(mask_rows[0])
        out = bool(a.get('outsideConnects') or a.get('edgeConnects'))
        n8 = a.get('neighborhood') == 8
        def on(x, y):
            if not (0 <= x < W and 0 <= y < H): return out
            return mask_rows[y][x] == '#'
        grid = s.low if layer == 'low' else s.up
        tiers = [t for t in (a.get('interiorVariants') or []) if t]
        for y in range(H):
            for x in range(W):
                if mask_rows[y][x] != '#': continue
                m = (on(x, y - 1) and 1) | (on(x + 1, y) and 2) | (on(x, y + 1) and 4) | (on(x - 1, y) and 8)
                if n8:
                    m |= (on(x + 1, y - 1) and 16) | (on(x + 1, y + 1) and 32) | (on(x - 1, y + 1) and 64) | (on(x - 1, y - 1) and 128)
                t = a['variantMap'][str(m)]
                if n8 and m == 255 and tiers:
                    depth = 2
                    for dy in range(-2, 3):
                        for dx in range(-2, 3):
                            if not on(x + dx, y + dy): depth = min(depth, max(abs(dx), abs(dy)) - 1)
                    if depth > 0:
                        tier = tiers[min(depth - 1, len(tiers) - 1)]; t = tier[_hash(x, y) % len(tier)]
                if 0 <= y < s.h and 0 <= x < s.w: grid[y][x] = t

    def kit(s, kid, x, y, layer=3):
        k = s.S.kits[kid]
        for j, row in enumerate(k['rows']):
            for i in range(k['width']):
                lo, up = row['tiles'][i], row['upperTiles'][i]
                X, Y = x + i, y + j
                if not (0 <= X < s.w and 0 <= Y < s.h): continue
                if lo is not None and lo >= 0: s.low[Y][X] = lo
                if up is not None and up >= 0:
                    (s.top if layer == 4 else s.mid if layer == 2 else s.up)[Y][X] = up

    def img(s, bg=GRASS):
        im = Image.new('RGBA', (s.w * 16, s.h * 16), bg)
        for g in (s.low, s.mid, s.up, s.top):
            for y in range(s.h):
                for x in range(s.w):
                    if g[y][x] is not None: im.alpha_composite(s.S.tile(g[y][x]), (x * 16, y * 16))
        return im


def lawn(c, W, H):
    c.fill_auto('jp-lawn-dirt', ['#' * W] * H)


def v_poles(S):
    """시골 장면처럼: 풀밭 + 아래 생활도로, 나무 전봇대 줄(간격 8칸, jp-wire-8 를 왼쪽 키트 x+3 에 4층) + 콘크리트 전봇대 한 쌍."""
    W, H = 26, 12
    c = Canvas(S, W, H); lawn(c, W, H)
    c.fill_auto('jp-lane-road', ['.' * W] * 9 + ['#' * W] * 3)
    for x in (0, 8, 16):
        c.kit('jp-pole-wood', x, 1, 4)
    for x in (0, 8):
        c.kit('jp-wire-8', x + 3, 1, 4)
    c.kit('jp-pole', 22, 0, 4)
    return c.img()


def v_lane(S):
    W, H = 18, 10
    c = Canvas(S, W, H); lawn(c, W, H)
    rows = ['......###.........', '......###.........', '......###.........', '......###.........',
            '##################', '##################', '##################', '......###.........', '......###.........', '......###.........']
    c.fill_auto('jp-lane-road', rows)
    return c.img()


def v_canal(S):
    W, H = 16, 10
    c = Canvas(S, W, H)
    c.fill_auto('jp-sidewalk-curb', ['#' * W] * H)
    rows = ['................', '................', '################', '################', '################',
            '..........######', '..........######', '..........######', '..........######', '..........######']
    c.fill_auto('jp-water-canal', rows)
    return c.img()


def v_hedge(S):
    W, H = 20, 9
    c = Canvas(S, W, H); lawn(c, W, H)
    c.fill_auto('jp-plaza-pave', ['.' * W] * 6 + ['#' * W] * 3)
    rows = ['....................', '.##################.', '.#.......#..........', '.#.......#..........', '.#.......#..........', '.##########.........',
            '....................', '....................', '....................']
    c.fill_auto('jp-hedge', rows, layer='up')
    return c.img()


def v_car(S):
    W, H = 18, 7
    c = Canvas(S, W, H); lawn(c, W, H)
    c.fill_auto('jp-lane-road', ['#' * W] * H)
    ids = [k for k in ('jp-prop-car-white', 'jp-prop-car-silver', 'jp-prop-car-red', 'jp-prop-car-white-r', 'jp-prop-car-blue-r', 'jp-prop-car-taxi') if k in S.kits]
    for i, kid in enumerate(ids[:6]):
        c.kit(kid, 1 + (i % 3) * 6, 0 if i < 3 else 3)
    return c.img()


def v_train(S):
    W, H = 18, 7
    c = Canvas(S, W, H); lawn(c, W, H)
    for x in range(0, W):
        if 'jp-rail-h' in S.kits: c.kit('jp-rail-h', x, 2, 2)   # 선로는 2층(장면 합성처럼 열차 밑에 남는다)
    for i, kid in enumerate(('jp-train-car-a', 'jp-train-car-b', 'jp-train-car-a', 'jp-train-car-b')):
        c.kit(kid, 1 + i * 4, 2)
    for x in (1, 5, 9, 13):
        if 'jp-rail-wire' in S.kits: c.kit('jp-rail-wire', x, 1, 4)
    return c.img()


def v_station(S):
    W, H = 16, 8
    c = Canvas(S, W, H)
    c.fill_auto('jp-plaza-pave', ['#' * W] * H)
    c.kit('jp-bldg-station-small', 1, 0)
    return c.img()


VIGNETTES = dict(poles=v_poles, lane=v_lane, canal=v_canal, hedge=v_hedge, car=v_car, train=v_train, station=v_station)


def side_by_side(a, b, scale, gap=8, bg=(32, 32, 36, 255)):
    a = a.resize((a.width * scale, a.height * scale), Image.NEAREST); b = b.resize((b.width * scale, b.height * scale), Image.NEAREST)
    im = Image.new('RGBA', (a.width + b.width + gap, max(a.height, b.height)), bg)
    im.alpha_composite(a, (0, 0)); im.alpha_composite(b, (a.width + gap, 0))
    return im


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--before', required=True); ap.add_argument('--after', required=True); ap.add_argument('--out', required=True)
    ap.add_argument('--only', default='')
    a = ap.parse_args()
    os.makedirs(a.out, exist_ok=True)
    B, A = Sheet(a.before), Sheet(a.after)
    bd = Image.open(BEODEUL).convert('RGBA') if os.path.exists(BEODEUL) else None
    names = [n for n in VIGNETTES if not a.only or n in a.only.split(',')]
    for n in names:
        try:
            ib = VIGNETTES[n](B)
        except KeyError as e:
            ib = Image.new('RGBA', (64, 64), (0, 0, 0, 255)); print(n, 'before missing', e, file=sys.stderr)
        ia = VIGNETTES[n](A)
        side_by_side(ib, ia, 1).save(os.path.join(a.out, f'{n}-x1.png'))
        side_by_side(ib, ia, 4).save(os.path.join(a.out, f'{n}-x4.png'))
        ia.save(os.path.join(a.out, f'{n}-after-x1.png')); ib.save(os.path.join(a.out, f'{n}-before-x1.png'))
        if bd is not None:
            r = bd.crop(REF_BOX[n]); r.resize((r.width * 4, r.height * 4), Image.NEAREST).save(os.path.join(a.out, f'{n}-ref-x4.png'))
            r.save(os.path.join(a.out, f'{n}-ref-x1.png'))
        print(n, ia.size)


if __name__ == '__main__':
    main()
