"""building-kit 투영 안내도 — 박공 정면(gable-front) 투영을 회색 평면 도형으로 그린다(하네스가 그린 구조 안내).

사용자 판정(2026-10-22): 「집이 이 각도로 보여야 한다 — 지금은 전혀 아니다」. 사용자가 보여 준 참고 그림은 제3자 그림이라
저장소·샌드박스에 넣지 않는다. 그 대신 이 파일이 **우리 문법과 같은 기하**로 구조만 그린다 — 화풍 기준이 아니다.

  projection-gable-front  박공 정면 한 채(5칸, 물매 2행, 사면 4행, 1층): 뒤 꼭대기 ^ → 용마루 세로선 → 왼쪽 밝은 사면 ·
                          오른쪽 어두운 사면 → 앞 박공 삼각 벽 → 벽 띠
  projection-l-combo      ㄱ자: 용마루가 정면과 나란한 2층 본채(뒤) + 앞 박공 정면 날개(3칸, 사면 2행) — 날개 지붕이 본채 지붕에 박히는
                          ^ 선이 골(valley) · 본채 지붕 위 굴뚝
  projection-wing-depth   ㅜ자 이음(깊이 땅 문법 r7, 사용자 판정 2026-10-22 「한 채로 안 보인다」): 앞 날개(depth 0) 바로 뒤에
                          본채(depth 1 — 날개 뒤 끝 = 본채 앞벽)가 한 칸 높이 서고, 날개 지붕이 본채 처마 위로 올라가 본채 지붕
                          속 V자 골에서 만난다. 날개와 본채 사이에 땅이 없고, 그림자는 날개 오른쪽 본채 벽에만 진다.
  projection-valley-widths 날개 골 조각 v4·v5·v6(날개 폭 4~6칸, 2행 = g4·g5 물매) — ^ 골 선 위로 본채 지붕이 비친다

16px 칸 격자 위에 무채색(R=G=B)만 쓴다. 4배 그림 오른쪽에 회색 견본과 영어 이름표(기본 글꼴에 한글이 없다)를 단다.
`python3 projection.py [--out <폴더>]` 또는 `npm run harness -- building-kit projection`.
"""
import argparse
import os
import sys

import numpy as np
from PIL import Image, ImageDraw

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)

import dot  # noqa: E402

T = dot.T
SCALE = 4
NAMES = ('gable-front', 'l-combo', 'wing-depth', 'valley-widths')
VALLEY_WIDTHS = (4, 5, 6)

BG = 58
GRID = 66
TONE = {
    'ridge': 248,
    'slope_l': 206,
    'slope_r': 118,
    'edge': 36,
    'valley': 20,
    'gable': 172,
    'wall': 148,
    'beam': 96,
    'door': 54,
    'window': 84,
    'hip_top': 182,
    'hip_l': 214,
    'hip_r': 104,
    'hip_ridge': 236,
    'chimney': 132,
    'chimney_top': 224,
    'yard': 112,
}
SHADOW_GREY, SHADOW_K = 14, 88 / 255.0   # 버들항 그림자 (12,14,20,α88) 의 무채색 근사
LEGEND = {
    'gable-front': (('ridge', 'ridge: 2px vertical line, front apex -> back apex'), ('slope_l', 'left slope (lit, upper-left light)'),
                    ('slope_r', 'right slope (shade)'), ('edge', 'back end ^ / gable verge'),
                    ('gable', 'front gable wall (faces south)'), ('wall', 'front wall band')),
    'l-combo': (('hip_top', 'main roof, ridge parallel to front (behind)'), ('hip_ridge', 'main ridge'),
                ('ridge', 'wing ridge (recedes north)'), ('slope_l', 'wing left slope (lit)'), ('slope_r', 'wing right slope (shade)'),
                ('valley', 'valley ^ = wing pixels over main roof'), ('chimney', 'chimney standing on the roof')),
    'wing-depth': (('hip_top', 'main block, depth = wing depth + 1 (wing back edge = main front wall)'),
                   ('wall', 'main wall: bottom 1 row above wing bottom, touches the wing'),
                   ('valley', 'valley V: wing roof runs up INTO the main roof (no back gable)'),
                   ('ridge', 'front wing (depth 0, door), ridge recedes north'),
                   ('shadow', 'wing shadow: on the main wall only, right of wing'),
                   ('yard', 'open ground beside the wing only (never between)')),
    'valley-widths': (('valley', 'v4 / v5 / v6: wing valley, width 4-6 cells, 2 rows (= g4/g5 pitch)'),
                      ('hip_top', 'main roof shows through above the V'),
                      ('ridge', 'wing ridge 2px at the centre, apex = top row'),
                      ('slope_l', 'left slope (lit)'), ('slope_r', 'right slope (shade)')),
}


def _edge(x, w, h):
    """가운데 꼭대기(0)에서 양 끝(h-1)으로 내려가는 ^ 빗선의 행 — 조립 문법의 뒤 끝·앞 박공과 같은 모양."""
    d = abs(x + 0.5 - w / 2) / (w / 2)
    return int(round(d * (h - 1)))


def gable_front(cv, x0, y0, cols, pitch, depth, storeys, back='gable', band=0):
    """박공 정면 질량 하나를 (x0, y0) 칸에 그린다. band = 층 띠 행 수(층 사이마다). 반환: 질량 높이(칸)."""
    w, p = cols * T, pitch * T
    X0, Y0 = x0 * T, y0 * T
    c = w // 2
    body0, front0 = p, p + depth * T
    wall0 = front0 + p
    total = wall0 + storeys * 2 * T + band * T * max(0, storeys - 1)
    for x in range(w):
        e = _edge(x, w, p)
        side = 'slope_l' if x < c else 'slope_r'
        for y in range(total):
            if y < e:
                continue
            if y == e and y < body0:
                tone = 'valley' if back == 'valley' else 'edge'
            elif y < front0 + e:
                tone = 'ridge' if x in (c - 1, c) and y < front0 else side
            elif y < wall0 and y <= front0 + e + 1:
                tone = 'edge'
            elif y < wall0:
                tone = 'gable'
            else:
                tone = 'wall'
            cv[Y0 + y, X0 + x] = TONE[tone]
    for y in range(wall0, wall0 + 2):
        cv[Y0 + y, X0:X0 + w] = TONE['beam']
    for s in range(1, storeys):
        by = wall0 + s * 2 * T + (s - 1) * band * T
        cv[Y0 + by:Y0 + by + band * T, X0:X0 + w] = TONE['beam']
    door_x = X0 + c - 6
    cv[Y0 + total - 26:Y0 + total, door_x:door_x + 12] = TONE['door']
    return total // T


def ridge_side(cv, x0, y0, cols, roof_rows, storeys, band=0):
    """용마루가 정면과 나란한 모임지붕 질량(본채). band = 층 띠 행 수(층 사이마다). 반환: 질량 높이(칸)."""
    w, rh = cols * T, roof_rows * T
    X0, Y0 = x0 * T, y0 * T
    per = 2 * T + band * T
    total = rh + storeys * 2 * T + band * T * max(0, storeys - 1)
    hip = 2 * T
    for x in range(w):
        for y in range(total):
            if y < rh:
                cut = max(0, hip - x) if x < hip else max(0, x - (w - 1 - hip))
                ey = int(cut * (rh - 1) / hip)
                if y < ey:
                    continue
                if y < 3:
                    tone = 'hip_ridge'
                elif x < hip and y < rh - 4 and x < hip * (1 - y / rh) + 6:
                    tone = 'hip_l'
                elif x >= w - hip and y < rh - 4 and (w - 1 - x) < hip * (1 - y / rh) + 6:
                    tone = 'hip_r'
                else:
                    tone = 'hip_top' if y < rh - 4 else 'edge'
            elif (y - rh) % per < 2 or (y - rh) % per >= 2 * T:
                tone = 'beam'
            else:
                tone = 'wall'
            cv[Y0 + y, X0 + x] = TONE[tone]
    for s in range(storeys):
        for i in range(1, cols - 1, 2):
            wy = Y0 + rh + s * per + 8
            cv[wy:wy + 12, X0 + i * T + 4:X0 + i * T + 12] = TONE['window']
    return total // T


# 깊이 땅 문법(r7)의 박공 정면 비율 기준 — (이름, 폭, 물매 행, depth_rows, 층, 층 띠 행). 사용자 판정 2026-10-22
# 「박공 지붕이 너무 길다(머리가 길다)」: 오두막·날개 2행, 회관 3행. 물매 2행 = g4·b4·g5 조각 높이.
BAND_CONFIGS = (('cottage', 4, 2, 2, 1, 0), ('wing', 4, 2, 2, 1, 0), ('hall', 5, 2, 3, 2, 1))
ROOF_TONES = ('ridge', 'slope_l', 'slope_r', 'edge', 'valley', 'gable')


def gable_front_band():
    """기준 질량을 안내도 기하로 그려 가운데 열에서 지붕 톤 화소 / 질량 화소를 잔다.
    반환 {'ratios': {이름: 비율}, 'band': (최소, 최대)} — assemble A6(깊이 땅 문법) 박공 정면 밴드."""
    roof = {TONE[k] for k in ROOF_TONES}
    ratios = {}
    for name, cols, pitch, dr, storeys, band in BAND_CONFIGS:
        rows = 2 * pitch + dr + 2 * storeys + band * max(0, storeys - 1)
        cv = np.full(((rows + 2) * T, (cols + 2) * T), BG, np.uint8)
        gable_front(cv, 1, 1, cols, pitch, dr, storeys, band=band)
        col = cv[T:(rows + 1) * T, T + cols * T // 2 - 1]
        n_roof = int(sum(1 for v in col if int(v) in roof))
        ratios[name] = n_roof / len(col)
    return {'ratios': ratios, 'band': (min(ratios.values()), max(ratios.values()))}


def chimney(cv, x0, y0):
    X0, Y0 = x0 * T, y0 * T
    cv[Y0 + 4:Y0 + 2 * T, X0 + 4:X0 + 12] = TONE['chimney']
    cv[Y0:Y0 + 4, X0 + 3:X0 + 13] = TONE['chimney_top']


def render(name):
    """안내도 하나(1배, RGBA 무채색)."""
    if name == 'gable-front':
        cols, rows = 7, 12
        cv = np.full((rows * T, cols * T), BG, np.uint8)
        _grid(cv)
        h = 2 + 4 + 2 + 2
        gable_front(cv, 1, rows - 1 - h, 5, 2, 4, 1)
    elif name == 'l-combo':
        cols, rows = 9, 11
        cv = np.full((rows * T, cols * T), BG, np.uint8)
        _grid(cv)
        main_h = 3 + 4
        ground = rows - 1
        ridge_side(cv, 1, ground - main_h, 7, 3, 2)
        chimney(cv, 6, ground - main_h - 1)
        wing_h = 1 + 2 + 1 + 2
        gable_front(cv, 3, ground - wing_h, 3, 1, 2, 1, back='valley')
    elif name == 'wing-depth':
        cv = wing_depth()
    elif name == 'valley-widths':
        cv = valley_widths()
    else:
        raise KeyError(f'모르는 안내도 {name!r} — {", ".join(NAMES)}')
    rgb = np.repeat(cv[:, :, None], 3, axis=2)
    a = np.dstack([rgb, np.full(cv.shape, 255, np.uint8)])
    return Image.fromarray(a, 'RGBA')


WING_DEPTH = {'cols': 10, 'rows': 12, 'main_x': 1, 'main_cols': 8, 'main_roof': 3, 'main_storeys': 2, 'main_band': 1,
              'depth': 1, 'wing_x': 3, 'wing_cols': 4, 'pitch': 2, 'depth_rows': 2, 'eave_drop': 2}


def wing_depth(geo=None):
    """ㅜ자 이음 안내도(깊이 땅 문법 r7): 앞 날개(depth 0) 바로 뒤에 본채(depth 1 — 날개 뒤 끝이 본채 앞벽)가 한 칸 높이 서고,
    날개 지붕이 본채 처마보다 올라가 본채 지붕 속 V자 골(valley)에서 만난다 — 위에서 보면 한 윤곽, 날개와 본채 사이에 땅이 없다.
    날개 그림자(빛은 왼쪽 위)는 날개 오른쪽 **본채 벽에만** 진다. 날개 옆 본채 벽 밑 한 줄만 땅(yard)이다. 반환: 무채색 uint8 배열."""
    g = dict(WING_DEPTH, **(geo or {}))
    cv = np.full((g['rows'] * T, g['cols'] * T), BG, np.uint8)
    _grid(cv)
    ground = g['rows'] - 1
    d = g['depth']
    walls = g['main_storeys'] * 2 + g['main_band'] * max(0, g['main_storeys'] - 1)
    main_h = g['main_roof'] + walls
    yard = np.zeros(cv.shape, bool)
    yard[(ground - d) * T:ground * T, g['main_x'] * T:(g['main_x'] + g['main_cols']) * T] = True
    cv[yard] = TONE['yard']
    ridge_side(cv, g['main_x'], ground - d - main_h, g['main_cols'], g['main_roof'], g['main_storeys'], g['main_band'])
    chimney(cv, g['main_x'] + g['main_cols'] - 2, ground - d - main_h - 1)
    main_wall = np.zeros(cv.shape, bool)
    main_wall[(ground - d - walls) * T:(ground - d) * T, g['main_x'] * T:(g['main_x'] + g['main_cols']) * T] = True
    wing_h = 2 * g['pitch'] + g['depth_rows'] + 2
    probe = np.full(cv.shape, 0, np.uint8)
    gable_front(probe, g['wing_x'], ground - wing_h, g['wing_cols'], g['pitch'], g['depth_rows'], 1, back='valley')
    wing = probe > 0
    gable_front(cv, g['wing_x'], ground - wing_h, g['wing_cols'], g['pitch'], g['depth_rows'], 1, back='valley')
    overlap = ground * T - max((ground - wing_h) * T, (ground - d - walls) * T)
    w = max(1, int(round(overlap / 3)))
    sh = np.zeros(cv.shape, bool)
    e = g['eave_drop']
    sh[e:, w:] = wing[:-e, :-w]
    sh &= ~wing & main_wall
    cv[sh] = np.round(cv[sh] * (1 - SHADOW_K) + SHADOW_GREY * SHADOW_K).astype(np.uint8)
    wing_depth.last = {'shadow': sh, 'wing': wing, 'yard': yard, 'main_wall': main_wall, 'w': w, 'ground': ground,
                       'main_eave': (ground - d - walls) * T, 'main_top': (ground - d - main_h) * T,
                       'wing_top': (ground - wing_h) * T, 'wing_eave': (ground - 2) * T}
    return cv


def valley_widths():
    """날개 골 조각 v4·v5·v6 — 본채 지붕 띠(hip_top) 위에 폭마다 하나씩, 2행(g4·g5 물매). ^ 골 선 위 귀퉁이로 본채 지붕이 비친다."""
    pitch = 2
    cols = 1 + sum(c + 1 for c in VALLEY_WIDTHS)
    rows = pitch + 2
    cv = np.full((rows * T, cols * T), BG, np.uint8)
    _grid(cv)
    x = 1
    for c in VALLEY_WIDTHS:
        cv[T // 2:(1 + pitch) * T, x * T:(x + c) * T] = TONE['hip_top']
        w, p = c * T, pitch * T
        mid = w // 2
        for px in range(w):
            e = _edge(px, w, p)
            for y in range(e, p):
                tone = 'valley' if y == e else ('ridge' if px in (mid - 1, mid) else ('slope_l' if px < mid else 'slope_r'))
                cv[T + y, x * T + px] = TONE[tone]
        x += c + 1
    return cv


def _grid(cv):
    cv[::T, :] = GRID
    cv[:, ::T] = GRID


def labelled(name, scale=SCALE):
    """4배 그림 + 오른쪽 견본·이름표(무채색)."""
    im = render(name)
    big = im.resize((im.width * scale, im.height * scale), Image.NEAREST)
    pad, sw, lh = 16, 28, 40
    legend = LEGEND[name]
    panel_w = 420
    out = Image.new('RGBA', (big.width + panel_w, max(big.height, pad * 2 + lh * len(legend))), (BG, BG, BG, 255))
    out.alpha_composite(big, (0, 0))
    d = ImageDraw.Draw(out)
    for i, (key, text) in enumerate(legend):
        y = pad + i * lh
        g = TONE[key] if key in TONE else int(round(TONE['wall'] * (1 - SHADOW_K) + SHADOW_GREY * SHADOW_K))
        d.rectangle([big.width + pad, y, big.width + pad + sw, y + sw], fill=(g, g, g, 255), outline=(200, 200, 200, 255))
        d.text((big.width + pad * 2 + sw, y + 8), text, fill=(232, 232, 232, 255))
    return out


def write_guides(out_dir):
    """projection-<이름>-1x.png · -4x.png 를 쓰고 경로 목록을 돌려준다."""
    os.makedirs(out_dir, exist_ok=True)
    paths = []
    for name in NAMES:
        p1 = os.path.join(out_dir, f'projection-{name}-1x.png')
        p4 = os.path.join(out_dir, f'projection-{name}-4x.png')
        render(name).save(p1)
        labelled(name).save(p4)
        paths += [p1, p4]
    return paths


def main(argv=None):
    ap = argparse.ArgumentParser(prog='projection.py')
    ap.add_argument('--out', default=os.path.join(dot.RUNS, '_projection'))
    a = ap.parse_args(argv)
    for p in write_guides(a.out):
        print(p)
    return 0


if __name__ == '__main__':
    sys.exit(main())
