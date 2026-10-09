#!/usr/bin/env python3
"""월드맵 3판 「바람들 결」 시드 생성기.

1단계(baseline): 2판 소스 .pxg 를 worldmap3.pal 로 재지정해 v3-A.pxg 로 복사.
  램프 이름이 worldmap.pal 과 같으므로 한 줄(@palette)만 바뀌어도 바람들 v3 색이 된다.
2단계(restyle): 슬러그별 함수가 v3-A.pxg 를 다시 그린다(질감·잉크 테두리·물결).
"""
import re, sys, pathlib

ROOT = pathlib.Path(__file__).resolve().parents[3]
CAND = ROOT / 'tiledata/atlas-pick/candidates-worldmap'

# 2판 최신 소스(사용자 픽이 있으면 픽, 없으면 마지막 wvN-A)
SRC = {
    'coast_grass': 'wv1-C', 'sea_deep': 'wv1-B', 'shoal': 'wv1-B',
    'plains_base': 'wv2-A', 'forest': 'wv5-A', 'conifer': 'wv5-A',
    'mountain': 'wv3-A', 'hills': 'wv2-A', 'river': 'wv2-A', 'road': 'wv2-A',
    'bridge_h': 'wv2-A', 'bridge_v': 'wv2-A', 'desert': 'wv6-A',
    'town': 'wv7-A', 'castle': 'wv8-A', 'cave': 'wv8-A', 'port': 'wv7-A',
    'trees_scatter': 'wv5-A', 'plains_scatter': 'wv2-A',
}
PAL_LINE = '@palette ../../palette/worldmap3.pal'


def baseline(slug):
    src = CAND / slug / f'{SRC[slug]}.pxg'
    txt = src.read_text(encoding='utf-8')
    txt = re.sub(r'^@palette .*$', PAL_LINE, txt, flags=re.M)
    txt = re.sub(r'^// .*$', f'// {slug} v3-A (baseline: {SRC[slug]} 재색)', txt, count=1, flags=re.M)
    return txt


# ---------------------------------------------------------------- 2단계: 바람들 결로 다시 칠하기
import random


def _parse(txt):
    """헤더 줄(@mblock 까지)과 글자 행을 나눈다."""
    lines = txt.split('\n')
    i = next(k for k, l in enumerate(lines) if l.startswith('@mblock'))
    head, rows = lines[:i + 1], [l for l in lines[i + 1:] if l != '']
    return head, [list(r) for r in rows]


def _emit(head, rows):
    return '\n'.join(head + [''.join(r) for r in rows]) + '\n'


def _remap_mats(head, table):
    """@mat <글자> <램프> <번호> 줄의 (램프, 번호)를 글자별로 바꾼다."""
    out = []
    for l in head:
        m = re.match(r'@mat (\w) (\w+) (\d+)', l)
        if m and m.group(1) in table:
            ramp, idx = table[m.group(1)]
            l = f'@mat {m.group(1)} {ramp} {idx}'
        out.append(l)
    return out


def _add_mat(head, letter, ramp, idx):
    k = max(i for i, l in enumerate(head) if l.startswith('@mat'))
    return head[:k + 1] + [f'@mat {letter} {ramp} {idx}'] + head[k + 1:]


def _flecks(rows, base, letter, period=16, margin=2, seed=1):
    """물 바탕 글자 base 위에 2~4px 가로 반짝임(letter)을 16px 주기로 뿌린다.

    가장자리(base 가 아닌 글자에서 margin 이내)는 건드리지 않아 물가 판정이 그대로다.
    """
    H, W = len(rows), len(rows[0])
    rng = random.Random(seed)
    pattern = []
    for ty in range(0, period, 5):
        for tx in range(0, period, 8):
            pattern.append(((tx + rng.randrange(0, 4)) % period, (ty + rng.randrange(0, 3)) % period, rng.choice([2, 3, 3, 4])))
    def ok(x, y):
        for dy in range(-margin, margin + 1):
            for dx in range(-margin, margin + 1):
                yy, xx = y + dy, x + dx
                if not (0 <= yy < H and 0 <= xx < W) or rows[yy][xx] != base:
                    return False
        return True
    marks = []
    for y in range(H):
        for x in range(W):
            for (px, py, ln) in pattern:
                if (x - px) % period < ln and (y - py) % period == 0 and ok(x, y):
                    marks.append((x, y))
    for x, y in marks:
        rows[y][x] = letter


def restyle_river(txt):
    head, rows = _parse(txt)
    # 강도 바람들 물색(wsea) 으로: 어두운 점 c → wsea 1, 몸 d → wsea 2, 흰 물결 e → wsea 5, 둑 윗줄 f → wsea 3
    head = _remap_mats(head, {'c': ('wsea', 1), 'd': ('wsea', 2), 'e': ('wsea', 5), 'f': ('wsea', 3)})
    return _emit(head, rows)


def restyle_shoal(txt):
    head, rows = _parse(txt)
    # 얕은 바다 위 노란 알갱이(모래 e,f)를 물빛 반짝임으로
    head = _remap_mats(head, {'e': ('wsea', 5), 'f': ('wsea', 4)})
    return _emit(head, rows)


def restyle_water(base, ramp, hi_idx):
    def f(txt):
        head, rows = _parse(txt)
        # 지금 가장 많이 쓰이는 물 글자를 바탕으로 잡는다
        from collections import Counter
        cnt = Counter(ch for r in rows for ch in r if ch != '.')
        mats = {m.group(1): (m.group(2), int(m.group(3))) for l in head for m in [re.match(r'@mat (\w) (\w+) (\d+)', l)] if m}
        cand = [(n, ch) for ch, n in cnt.items() if mats[ch][0] == ramp]
        body = max(cand)[1]
        head = _add_mat(head, 'z', ramp, hi_idx)
        _flecks(rows, body, 'z', seed=7)
        return _emit(head, rows)
    return f


def restyle_plains(txt):
    """바람들 v3 풀: 바탕 wgrass 3, 짙은 뭉치 2, 풀잎 4, 16px 주기. 세 칸은 평균 밝기를 맞춘다."""
    head, _ = _parse(txt)
    head = [l for l in head if not l.startswith('@mat')]
    k = next(i for i, l in enumerate(head) if l.startswith('@mblock'))
    head = head[:k] + ['@mat a wgrass 2', '@mat b wgrass 3', '@mat c wgrass 4', '@mat d wgrass 1'] + head[k:]
    tufts = [
        [(1, 0, 'c'), (3, 0, 'c'), (0, 1, 'a'), (1, 1, 'a'), (2, 1, 'a'), (3, 1, 'a'), (4, 1, 'a'), (1, 2, 'a'), (2, 2, 'd'), (3, 2, 'a')],
        [(2, 0, 'c'), (1, 1, 'a'), (2, 1, 'a'), (3, 1, 'a'), (0, 2, 'a'), (1, 2, 'd'), (2, 2, 'a'), (3, 2, 'a')],
        [(0, 0, 'c'), (2, 0, 'c'), (4, 0, 'c'), (1, 1, 'a'), (2, 1, 'a'), (3, 1, 'a'), (2, 2, 'a')],
    ]
    rows = [['b'] * 48 for _ in range(16)]
    for cell in range(3):
        rng = random.Random(100 + cell)
        # 2x2 격자에 뭉치 하나씩(약간 흔들어), 세 칸 모두 같은 개수
        for gy in range(3):
            for gx in range(3):
                bx = gx * 5 + rng.randrange(0, 2) + (2 if gy % 2 else 0)
                by = gy * 5 + rng.randrange(0, 2)
                for dx, dy, ch in tufts[(gx + gy + cell) % 3]:
                    rows[(by + dy) % 16][cell * 16 + (bx + dx) % 16] = ch
        # 밝은 알갱이 · 짙은 알갱이
        for _ in range(7):
            rows[rng.randrange(16)][cell * 16 + rng.randrange(16)] = 'c'
        for _ in range(5):
            rows[rng.randrange(16)][cell * 16 + rng.randrange(16)] = 'a'
    return _emit(head, rows)


def restyle_town(txt):
    head, rows = _parse(txt)
    # 성벽 안 바닥: 어두운 갈색 사각형 대신 밝은 흙길 색(바람들 흙 2단)
    head = _remap_mats(head, {'g': ('wdirt', 2)})
    return _emit(head, rows)


RESTYLE = {
    'town': restyle_town,
    'river': restyle_river,
    'shoal': restyle_shoal,
    'coast_grass': restyle_water(None, 'wsea', 3),
    'sea_deep': restyle_water(None, 'wdeep', 3),
    'plains_base': restyle_plains,
}


def main():
    slugs = [a for a in sys.argv[1:] if not a.startswith('-')] or list(SRC)
    for s in slugs:
        out = CAND / s / 'v3-A.pxg'
        txt = baseline(s)
        if s in RESTYLE and '--baseline' not in sys.argv:
            txt = RESTYLE[s](txt)
        out.write_text(txt, encoding='utf-8')
        print('wrote', out.relative_to(ROOT))


if __name__ == '__main__':
    main()
