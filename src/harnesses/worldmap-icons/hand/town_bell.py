"""fantasy/town_bell 손수정 (감독, 2026-10-02) — 원래 아이콘의 화소·색만 떼어 정면 3/4 로 다시 조립한다.

원래: 둥근 탑이 왼쪽, 집 넷 중 셋이 오른쪽에 갈색 옆면(검수 SIDE). 고친 것:
- 탑은 원래 화소 그대로 가운데로 옮기고, 창에 종을 단다(이름이 town_bell).
- 집은 원래 지붕 줄무늬(밝은 마루·짙은 기와 줄·붉은 면)와 벽·창·문 색으로 **정면만** 다시 찍는다 — 옆면·사선 밑변 없음, 좌우 대칭.
- 덤불은 원래 덤불 화소를 그대로 쓴다. 그림자는 발밑 한 줄(오른쪽으로 끌지 않는다).
출력: 인자 폴더의 cand.png (48×48, 키색 바탕).
"""
import sys
from pathlib import Path
from PIL import Image

KEY, SHD = (255, 103, 139), (254, 103, 139)
ORIG = Path.home() / '.local/share/oprn/worldmap-icon-harness/items/fantasy/town_bell/icon.png'
C = {k: tuple(int(v[i:i + 2], 16) for i in (1, 3, 5)) for k, v in dict(
    a='#111618', b='#1d2c33', i='#351803', k='#e87c4a', l='#690907', p='#d2432d', q='#931d10', u='#63310b',
    v='#b77246', w='#6d3b15', x='#6fb1ff', y='#086bba', z='#9a5435', A='#411e05', C='#d59147',
    D='#065298', E='#208ef8', F='#766e60', G='#e1d7c1', H='#d8cbac', I='#b9ab9d', g='#515567').items()}

# 정면 집 15×12 — 우진각 지붕 7줄(마루가 좁고 처마로 갈수록 넓어지는 윗면, 좌우 대칭) + 벽 4줄(남쪽 정면).
RED = [
    '...iiiiiiiii...',
    '..ikkkkkkkkki..',
    '.ipllpllpllppi.',
    '.ipppppppppppi.',
    'ipllpllpllpllpi',
    'ipppppppppppppi',
    'iqqqqqqqqqqqqqi',
    '.izxyzAAAzxyzi.',
    '.izyyzAaAzyyzi.',
    '.izzzzAaAzzzzi.',
    '.iwwwwAaAwwwwi.',
    '..iiiiiiiiiii..',
]
BLUE_MAP = {'i': 'b', 'k': 'x', 'l': 'D', 'p': 'E', 'q': 'D', 'z': 'G', 'w': 'I', 'A': 'F', 'a': 'a'}
BLUE = [''.join(BLUE_MAP.get(ch, ch) for ch in r) for r in RED]


def main(out):
    src = Image.open(ORIG).convert('RGBA')
    sp = src.load()
    im = Image.new('RGB', (48, 48), KEY)
    px = im.load()

    def put(x, y, c):
        if 0 <= x < 48 and 0 <= y < 48:
            px[x, y] = c

    def shadow(x0, x1, y):
        for x in range(x0, x1 + 1):
            if px[x, y] == KEY:
                put(x, y, SHD)

    def blit(x0, y0, sx0, sy0, w, h, keep=lambda c: True):
        for yy in range(h):
            for xx in range(w):
                c = sp[sx0 + xx, sy0 + yy]
                if c[3] and c[:3] != (0, 0, 0) and keep(c[:3]):
                    put(x0 + xx, y0 + yy, c[:3])

    def house(rows, x0, y0, chimney=False):
        for yy, r in enumerate(rows):
            for xx, ch in enumerate(r):
                if ch != '.':
                    put(x0 + xx, y0 + yy, C[ch])
        if chimney:   # 원래 붉은 집의 굴뚝(acca/agga)
            for yy, r in enumerate(['acca', 'agga', 'agga']):
                for xx, ch in enumerate(r):
                    put(x0 + 9 + xx, y0 - 2 + yy, C[ch] if ch != 'c' else (0x78, 0x73, 0x9c))
        shadow(x0 + 2, x0 + 12, y0 + 12)

    bush_ok = lambda c: c not in (C['q'], C['p'], C['l'], C['i'], C['u'], C['w'], C['v'], C['z'], C['k'])   # 덤불 칸에 낀 지붕 화소는 버린다
    GREEN = {(0x40, 0xa8, 0x37), (0x3d, 0x88, 0x2b), (0x21, 0x82, 0x38), (0x77, 0xac, 0x40), (0x13, 0x52, 0x2e), (0xf1, 0xa0, 0xf3), (0xd0, 0x68, 0xed)}
    tower_ok = lambda c: c not in (C['i'], C['k'], C['l'], C['p'], C['q'], C['u']) and c not in GREEN
    # 뒤쪽 덤불 둘(원래 오른쪽 덤불 39..47 × 6..13)
    blit(3, 1, 39, 6, 9, 8, bush_ok)
    blit(36, 1, 39, 6, 9, 8, bush_ok)
    # 탑: 원래 3..17 × 3..34 → 가운데(x16)로
    blit(16, 1, 3, 3, 15, 31, tower_ok)
    shadow(18, 30, 32)
    # 탑 명암을 좌우 대칭으로: 원래는 왼쪽 밝음 → 오른쪽 어두움 그라데이션이라 오른쪽 띠가 옆면으로 읽혔다(검수 SIDE).
    # 열마다 「원래 그 열의 기본 단」과의 차이를 지키며 새 기본 단(가운데 밝고 양 끝 어두움)으로 옮긴다.
    RAMP = [(0x36, 0x35, 0x40), (0x49, 0x3f, 0x59), (0x51, 0x55, 0x67), (0x66, 0x64, 0x8b), (0x78, 0x73, 0x9c), (0x8f, 0x8c, 0xb5)]
    OLD = [5, 5, 5, 4, 4, 3, 3, 2, 2, 1, 1, 0, 0]          # 원래 몸통 열 x4..16 의 기본 단
    NEW = [1, 2, 3, 4, 5, 5, 5, 5, 5, 4, 3, 2, 1]
    for k in range(13):
        x = 17 + k
        for y in range(12, 33):          # 꼭대기 타원(위 11줄)은 원래 명암 그대로
            c = px[x, y]
            if c in RAMP:
                t = RAMP.index(c) - OLD[k] + NEW[k]
                px[x, y] = RAMP[max(0, min(5, t))]
    # 종: 원래 창(9..10 × 19..21)을 아치 창으로 넓히고 금빛 종을 단다
    tx, ty = 16 - 3, 1 - 3
    for (x, y, ch) in [(9, 17, 'a'), (10, 17, 'a'), (8, 18, 'a'), (11, 18, 'a'), (8, 19, 'a'), (11, 19, 'a'),
                       (8, 20, 'a'), (11, 20, 'a'), (8, 21, 'a'), (11, 21, 'a'),
                       (9, 18, 'C'), (10, 18, 'C'), (9, 19, 'C'), (10, 19, 'u'), (9, 20, 'C'), (10, 20, 'C'), (9, 21, 'A'), (10, 21, 'A')]:
        put(x + tx, y + ty, C[ch])
    # 집 넷 — 위 둘은 탑 몸통 옆, 아래 둘은 앞줄
    house(RED, 0, 10, chimney=True)
    house(BLUE, 33, 10)
    house(BLUE, 0, 33)
    house(RED, 33, 33, chimney=True)
    # 앞 덤불 — 탑 문 앞
    blit(19, 36, 39, 6, 9, 8, bush_ok)
    shadow(20, 27, 44)
    im.save(Path(out) / 'cand.png')


if __name__ == '__main__':
    main(sys.argv[1])
