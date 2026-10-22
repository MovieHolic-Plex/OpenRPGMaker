"""building-kit 투영 안내도 — 박공 정면(gable-front) 투영을 회색 평면 도형으로 그린다(하네스가 그린 구조 안내).

사용자 판정(2026-10-22): 「집이 이 각도로 보여야 한다 — 지금은 전혀 아니다」. 사용자가 보여 준 참고 그림은 제3자 그림이라
저장소·샌드박스에 넣지 않는다. 그 대신 이 파일이 **우리 문법과 같은 기하**로 구조만 그린다 — 화풍 기준이 아니다.

  projection-gable-front  박공 정면 한 채(5칸, 물매 2행, 사면 4행, 1층): 뒤 꼭대기 ^ → 용마루 세로선 → 왼쪽 밝은 사면 ·
                          오른쪽 어두운 사면 → 앞 박공 삼각 벽 → 벽 띠
  projection-l-combo      ㄱ자: 용마루가 정면과 나란한 2층 본채(뒤) + 앞 박공 정면 날개(3칸, 사면 2행) — 날개 지붕이 본채 지붕에 박히는
                          ^ 선이 골(valley) · 본채 지붕 위 굴뚝

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
NAMES = ('gable-front', 'l-combo')

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
}
LEGEND = {
    'gable-front': (('ridge', 'ridge: 2px vertical line, front apex -> back apex'), ('slope_l', 'left slope (lit, upper-left light)'),
                    ('slope_r', 'right slope (shade)'), ('edge', 'back end ^ / gable verge'),
                    ('gable', 'front gable wall (faces south)'), ('wall', 'front wall band')),
    'l-combo': (('hip_top', 'main roof, ridge parallel to front (behind)'), ('hip_ridge', 'main ridge'),
                ('ridge', 'wing ridge (recedes north)'), ('slope_l', 'wing left slope (lit)'), ('slope_r', 'wing right slope (shade)'),
                ('valley', 'valley ^ = wing pixels over main roof'), ('chimney', 'chimney standing on the roof')),
}


def _edge(x, w, h):
    """가운데 꼭대기(0)에서 양 끝(h-1)으로 내려가는 ^ 빗선의 행 — 조립 문법의 뒤 끝·앞 박공과 같은 모양."""
    d = abs(x + 0.5 - w / 2) / (w / 2)
    return int(round(d * (h - 1)))


def gable_front(cv, x0, y0, cols, pitch, depth, storeys, back='gable'):
    """박공 정면 질량 하나를 (x0, y0) 칸에 그린다. 반환: 질량 높이(칸)."""
    w, p = cols * T, pitch * T
    X0, Y0 = x0 * T, y0 * T
    c = w // 2
    body0, front0 = p, p + depth * T
    wall0 = front0 + p
    total = wall0 + storeys * 2 * T
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
    door_x = X0 + c - 6
    cv[Y0 + total - 26:Y0 + total, door_x:door_x + 12] = TONE['door']
    return total // T


def ridge_side(cv, x0, y0, cols, roof_rows, storeys):
    """용마루가 정면과 나란한 모임지붕 질량(본채). 반환: 질량 높이(칸)."""
    w, rh = cols * T, roof_rows * T
    X0, Y0 = x0 * T, y0 * T
    total = rh + storeys * 2 * T
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
            elif (y - rh) % (2 * T) < 2:
                tone = 'beam'
            else:
                tone = 'wall'
            cv[Y0 + y, X0 + x] = TONE[tone]
    for s in range(storeys):
        for i in range(1, cols - 1, 2):
            wy = Y0 + rh + s * 2 * T + 8
            cv[wy:wy + 12, X0 + i * T + 4:X0 + i * T + 12] = TONE['window']
    return total // T


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
    else:
        raise KeyError(f'모르는 안내도 {name!r} — {", ".join(NAMES)}')
    rgb = np.repeat(cv[:, :, None], 3, axis=2)
    a = np.dstack([rgb, np.full(cv.shape, 255, np.uint8)])
    return Image.fromarray(a, 'RGBA')


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
        g = TONE[key]
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
