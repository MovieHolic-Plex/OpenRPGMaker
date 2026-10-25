"""building-kit 마감 샌드박스 도구 — 마감 에이전트의 finish_draw.py 가 쓰는 유일한 라이브러리.

pixels.txt(글자 하나 = 화소 하나, legend.json 범례)를 격자로 읽고, 좌표·행 문자열로 고친 뒤 finished.png 로 쓴다.
  load()                 → 격자(list[list[str]]) — pixels.txt 의 새 사본
  L(ramp, tone)          → 그 램프·단의 글자(tone 음수는 뒤에서부터)
  put(px, x, y, ch)      → 화소 하나. 투명('.')·그림자('~') 자리와 그 글자는 받지 않는다(윤곽 보존)
  row(px, x, y, s)       → (x, y) 부터 오른쪽으로 문자열 s. 공백 ' ' 은 그 화소를 그대로 둔다
  block(px, x, y, rows)  → row 를 아래로 여러 줄
  get(px, x, y)          → 지금 글자 · names(ch) → 그 글자의 램프·단 이름들
  save(px)               → finished.png · finished.txt · preview/finished-4x.png · preview/compare.png

save 는 조립이 얹은 앞 질량 그림자(shade.png 자리)를 같은 식으로 다시 얹는다 — 그림자 밑 벽도 글자로 고친다.
이 라이브러리에는 참고 그림의 화소를 돌려주는 함수가 없다(트레이스 금지). 참고 그림은 Read 로 눈으로만 본다.
"""
import json
import os

import numpy as np
from PIL import Image

ROOT = os.path.dirname(os.path.abspath(__file__))
GROUND = (98, 140, 72, 255)
SCALE = 4
_LEG = {}


def _legend():
    if not _LEG:
        _LEG.update(json.load(open(os.path.join(ROOT, 'legend.json'), encoding='utf-8')))
    return _LEG


def _regions():
    return json.load(open(os.path.join(ROOT, 'regions.json'), encoding='utf-8'))


def load():
    rows = open(os.path.join(ROOT, 'pixels.txt'), encoding='utf-8').read().splitlines()
    return [list(r) for r in rows]


def L(ramp, tone):
    chars = _legend()['ramps'][ramp]
    return chars[tone]


def names(ch):
    return list(_legend()['chars'][ch]['names'])


def get(px, x, y):
    return px[y][x]


def put(px, x, y, ch):
    leg = _legend()
    if not (0 <= y < len(px) and 0 <= x < len(px[0])):
        raise IndexError(f'({x}, {y}) 는 그림 밖이다({len(px[0])}×{len(px)})')
    if ch not in leg['chars']:
        raise KeyError(f'범례에 없는 글자 {ch!r} — L(램프, 단) 으로 고른다')
    if px[y][x] in ('.', '~'):
        raise ValueError(f'({x}, {y}) 는 투명/그림자 자리다 — 윤곽(알파)은 바꿀 수 없다')
    px[y][x] = ch


def row(px, x, y, s):
    for i, ch in enumerate(s):
        if ch != ' ':
            put(px, x + i, y, ch)


def block(px, x, y, rows):
    for j, s in enumerate(rows):
        row(px, x, y + j, s)


def _shade(rgb, leg):
    k = leg['shadow']['alpha'] / 255.0
    return np.round(np.asarray(rgb, float) * (1 - k) + np.array(leg['shadow']['rgb'], float) * k).astype(np.uint8)


def render(px):
    """격자 → RGBA 이미지(그림자 다시 얹음). check.py 도 같은 식을 쓴다."""
    leg = _legend()
    h, w = len(px), len(px[0])
    a = np.zeros((h, w, 4), np.uint8)
    sh = leg['shadow']
    for y in range(h):
        for x in range(w):
            ch = px[y][x]
            if ch == '.':
                continue
            if ch == '~':
                a[y, x, :3] = sh['rgb']
                a[y, x, 3] = sh['alpha']
                continue
            hx = leg['chars'][ch]['hex']
            a[y, x, :3] = [int(hx[i:i + 2], 16) for i in (1, 3, 5)]
            a[y, x, 3] = 255
    shade = np.array(Image.open(os.path.join(ROOT, 'shade.png')).convert('L')) > 0
    sel = shade & (a[:, :, 3] == 255)
    if sel.any():
        a[sel, :3] = _shade(a[sel, :3], leg)
    return Image.fromarray(a, 'RGBA')


def _on_ground(im):
    g = Image.new('RGBA', im.size, GROUND)
    g.alpha_composite(im.convert('RGBA'))
    return g


def compare_row(images, k=SCALE, gap=16):
    """그림들을 같은 배율로 풀 땅 위에 바닥을 맞춰 나란히(detail-cmp 형식)."""
    big = [_on_ground(im).resize((im.width * k, im.height * k), Image.NEAREST) for im in images]
    W = sum(b.width for b in big) + gap * (len(big) + 1)
    H = max(b.height for b in big) + gap * 2
    out = Image.new('RGBA', (W, H), (30, 28, 26, 255))
    x = gap
    for b in big:
        out.alpha_composite(b, (x, H - gap - b.height))
        x += b.width + gap
    return out.convert('RGB')


def save(px):
    w = len(px[0])
    for r in px:
        if len(r) != w:
            raise ValueError('행 길이가 서로 다르다 — 격자 모양은 바꿀 수 없다')
    im = render(px)
    im.save(os.path.join(ROOT, 'finished.png'))
    open(os.path.join(ROOT, 'finished.txt'), 'w', encoding='utf-8').write('\n'.join(''.join(r) for r in px) + '\n')
    prev = os.path.join(ROOT, 'preview')
    os.makedirs(prev, exist_ok=True)
    im.resize((im.width * SCALE, im.height * SCALE), Image.NEAREST).save(os.path.join(prev, 'finished-4x.png'))
    reg = _regions()
    imgs = []
    ref = reg.get('compareRef')
    if ref and os.path.exists(os.path.join(ROOT, ref)):
        imgs.append(Image.open(os.path.join(ROOT, ref)).convert('RGBA'))
    imgs += [Image.open(os.path.join(ROOT, 'base.png')).convert('RGBA'), im]
    compare_row(imgs).save(os.path.join(prev, 'compare.png'))
    log = os.path.join(prev, 'iterations.jsonl')
    n = sum(1 for _ in open(log, encoding='utf-8')) if os.path.exists(log) else 0
    import hashlib
    with open(log, 'a', encoding='utf-8') as f:
        f.write(json.dumps({'n': n + 1, 'sha256': hashlib.sha256(np.array(im).tobytes()).hexdigest()}) + '\n')
    return im
