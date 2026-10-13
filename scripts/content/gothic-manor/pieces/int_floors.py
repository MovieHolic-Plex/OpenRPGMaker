"""실내 바닥(16 주기) · 러너 · 깔개 · 덧그림(얼룩·거미줄)."""
import os, sys, math
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
from gmlib import REG, Cv, K, run_module   # noqa: E402
from gmdraw import *                         # noqa: E402,F403

MODULE = 'int_floors'


def _floor(id, name, space, desc, tags, fn, variants=('a', 'b')):
    for v in variants:
        @REG.piece(f'{id}-{v}', f'{name} {v.upper()}', 1, 1, ['F'], 'surfaces', space, role='terrain', repeat=True, kind='terrain',
                   tags=tags, desc=desc, rules='방 바닥으로 이어 칠한다(16 주기, 이음새 없음). A·B 를 섞어 깔면 반복이 덜 보인다.')
        def _f(c, v=v):
            fn(c, 0 if v == 'a' else 1)


def parquet(c, v):
    """헤링본 오크 마루: 2×8 널 쪽을 지그재그로."""
    for y in range(16):
        for x in range(16):
            u = (x + y) % 16; w = (x - y) % 16
            a = (u // 4) % 2 == 0
            k = (u if a else w) % 8
            idx = ((u // 4) * 3 + (w // 8) + v * 5) % 4
            t = (4, 3, 4, 5)[idx]
            if k == 7: t = 2
            if k == 0: t = min(6, t + 1)
            c.P(x, y, K('wood', t))


def marble(c, v):
    """체크무늬 대리석(회청 점판·상아 8px) — 검정·흰 대비가 방을 다 먹지 않게 두 판의 명도 차를 줄였다(QA 1회 개선)."""
    for y in range(16):
        for x in range(16):
            dark = ((x // 8) + (y // 8)) % 2 == 1
            if dark:
                t = 2 if hsh(x, y, 5 + v) > .14 else 3
                if (2 * x + y + v * 5) % 13 == 0: t = 3                    # 흰 결
                col = K('stone', t)
            else:
                t = 4 if hsh(x, y, 6 + v) > .18 else 5
                if (x + 2 * y + v * 3) % 11 == 0: t = 3                    # 대리석 결
                col = K('bone', t)
            if x % 8 == 7 or y % 8 == 7: col = K('bone', 3) if not dark else K('stone', 1)
            c.P(x, y, col)


def flag(c, v):
    """지하 판석: 흙빛 사암 판(벽의 회색 마름돌보다 밝고 따뜻하다 — 방 바닥이 벽과 한 덩이로 읽히지 않게) + 축축한 틈."""
    cuts = [(0, 0, 9, 7), (9, 0, 7, 7), (0, 7, 6, 9), (6, 7, 10, 9)] if v == 0 else [(0, 0, 6, 8), (6, 0, 10, 6), (0, 8, 10, 8), (10, 6, 6, 10)]
    for i, (x0, y0, w, h) in enumerate(cuts):
        base = (5, 4, 5, 4)[(i + v) % 4]
        for y in range(y0, y0 + h):
            for x in range(x0, x0 + w):
                t = base
                if y == y0 or x == x0: t = base + 1
                if y == y0 + h - 1 or x == x0 + w - 1: t = 2
                if hsh(x, y, 9 + v) < .05: t = base - 1
                c.P(x, y, K('dirt', t))


def tile(c, v):
    """부엌 테라코타 타일(8px)."""
    for y in range(16):
        for x in range(16):
            lx, ly = x % 8, y % 8
            k = ((x // 8) * 2 + (y // 8) + v) % 3
            t = (5, 4, 5)[k]                                   # 문질러 닦은 옅은 테라코타
            if lx == 7 or ly == 7: col = K('stone', 2)
            elif lx == 0 or ly == 0: col = K('brick', t + 1)
            else: col = K('brick', t if hsh(x, y, 13 + v) > .08 else t - 1)
            c.P(x, y, col)


def boards(c, v):
    """낡은 널마루(세로 널 4px, 엇갈린 이음·못)."""
    for y in range(16):
        for x in range(16):
            b = x // 4
            t = (3, 2, 3, 2)[(b + v) % 4]
            if x % 4 == 3: t = 1
            elif x % 4 == 0: t += 1
            if y == (b * 5 + v * 7) % 16: t = 1
            if hsh(x, y, 17 + v) < .04: t -= 1
            c.P(x, y, K('wood', t))
            if x % 4 == 1 and y == ((b * 5 + v * 7) % 16 + 2) % 16: c.P(x, y, K('iron', 4))


def carpet(c, v):
    """붉은 벨벳 융단(작은 금 꽃무늬)."""
    for y in range(16):
        for x in range(16):
            t = 2
            lx, ly = (x + v * 8) % 8, y % 8
            if (lx, ly) in ((3, 3), (4, 4), (3, 4), (4, 3)): c.P(x, y, K('gold', 3)); continue
            if (lx, ly) in ((3, 2), (5, 4), (3, 5), (2, 3)): t = 3
            if hsh(x, y, 21) < .08: t = 1
            c.P(x, y, K('velvet', t))


_floor('gm-fl-parquet', '헤링본 오크 마루', 'hall', '따뜻한 갈색 헤링본 오크 마루(널 쪽이 지그재그).', ['마루', '바닥', '저택'], parquet)
_floor('gm-fl-marble', '체크 대리석', 'hall', '검정·상아 체크무늬 대리석(8px 칸, 결).', ['대리석', '바닥', '홀'], marble)
_floor('gm-fl-flag', '지하 돌 판석', 'cellar', '축축한 회색 돌 판석(불규칙 판, 어두운 틈).', ['판석', '바닥', '지하'], flag)
_floor('gm-fl-tile', '부엌 테라코타 타일', 'kitchen', '옅은 테라코타 8px 타일과 회색 줄눈.', ['타일', '바닥', '부엌'], tile)
_floor('gm-fl-boards', '낡은 널마루', 'bedroom', '삐걱이는 어두운 세로 널마루(엇갈린 이음, 못).', ['널마루', '바닥', '침실'], boards)
_floor('gm-fl-carpet', '붉은 벨벳 융단 바닥', 'library', '벽에서 벽까지 깐 붉은 벨벳 융단(작은 금 꽃무늬).', ['융단', '바닥', '서재'], carpet)


def _runner_px(c, x, y, lx, ly, w, h, ends=''):
    """러너 화소: 가장자리 금 테 2px, 속 짙은 벨벳 무늬."""
    edge = lx <= 1 or lx >= w - 2 or ('n' in ends and ly <= 1) or ('s' in ends and ly >= h - 2)
    if edge:
        c.P(x, y, K('gold', 3 if (lx in (0, w - 1) or ('n' in ends and ly == 0) or ('s' in ends and ly == h - 1)) else 4))
    else:
        t = 2 if ((lx + ly) % 6) else 3
        c.P(x, y, K('velvet', t))


@REG.piece('gm-runner-ns', '복도 러너(남북)', 2, 1, ['ff'], 'surfaces', 'hall', role='terrain', repeat=True, kind='flat',
           tags=['러너', '깔개'], desc='금 테 두른 짙은 벨벳 복도 러너(2칸 폭, 남북으로 이어짐).', rules='주 출입구 축을 따라 세로로 이어 칠한다.')
def _rns(c):
    for y in range(16):
        for x in range(2, 30): _runner_px(c, x, y, x - 2, y, 28, 16)


@REG.piece('gm-runner-ew', '복도 러너(동서)', 1, 2, ['f', 'f'], 'surfaces', 'hall', role='terrain', repeat=True, kind='flat',
           tags=['러너', '깔개'], desc='금 테 두른 짙은 벨벳 러너(동서).', rules='동서 복도에 가로로 이어 칠한다.')
def _rew(c):
    for y in range(2, 30):
        for x in range(16): _runner_px(c, x, y, y - 2, x, 28, 16)


for end in ('n', 's'):
    @REG.piece(f'gm-runner-{end}-end', f'복도 러너 {"북" if end == "n" else "남"}쪽 끝(술 장식)', 2, 1, ['ff'], 'surfaces', 'hall', role='terrain', kind='flat',
               tags=['러너', '깔개'], desc='러너 끝: 금 테가 닫히고 술이 달렸다.', rules='러너 줄의 끝 칸.')
    def _re(c, end=end):
        for y in range(16):
            ly = y if end == 's' else 15 - y
            if ly > 12: continue
            for x in range(2, 30): _runner_px(c, x, y, x - 2, ly if end == 's' else 12 - ly, 28, 13, ends=('s' if end == 's' else 'n'))
        for x in range(3, 29, 2):
            yy = 13 if end == 's' else 2
            c.P(x, yy, K('gold', 4)); c.P(x, yy + (1 if end == 's' else -1), K('gold', 2))


@REG.piece('gm-rug-persian', '빛바랜 페르시아 깔개', 3, 2, ['fff', 'fff'], 'surfaces', 'library', role='terrain', kind='flat',
           tags=['깔개', '융단'], desc='금빛 테두리에 붉은·남색 메달리온 무늬 큰 깔개(3×2), 귀퉁이 술.', rules='벽난로 앞·응접 탁자 밑에.')
def _rug(c):
    W, H = 48, 32
    for y in range(2, 30):
        for x in range(1, 47):
            lx, ly = x - 1, y - 2
            if lx < 2 or lx > 43 or ly < 2 or ly > 25: col = K('gold', 3 if (lx + ly) % 2 else 2)
            elif lx < 5 or lx > 40 or ly < 5 or ly > 22: col = K('slate', 2 if (lx // 2 + ly // 2) % 2 else 3)
            else:
                d = abs(lx - 22) / 18 + abs(ly - 13.5) / 9
                col = K('velvet', 2)
                if d < .55: col = K('slate', 3)
                if d < .3: col = K('gold', 3)
                if abs(d - .8) < .07: col = K('gold', 2)
                if hsh(x, y, 31) < .06: col = K('velvet', 1)
            c.P(x, y, col)
    for x in range(2, 46, 2): c.P(x, 1, K('bone', 4)); c.P(x, 30, K('bone', 4))


@REG.piece('gm-ov-stain', '바닥 검붉은 얼룩', 1, 1, ['f'], 'surfaces', 'shared', role='terrain', kind='flat',
           tags=['얼룩', '덧그림', '공포'], desc='바닥에 스민 검붉은 오래된 얼룩(덧그림).', rules='방에 한두 개. 공포 단서 자리.')
def _stain(c):
    for y in range(16):
        for x in range(16):
            d = math.hypot((x - 8) / 6, (y - 9) / 4) + hsh(x // 2, y // 2, 3) * .35
            if d < .7: c.P(x, y, K('velvet', 1))
            elif d < .95: c.P(x, y, K('velvet', 0))
    for (x, y) in ((2, 4), (13, 13), (12, 3)): c.P(x, y, K('velvet', 1))


@REG.piece('gm-ov-dust', '먼지·깨진 판자 조각', 1, 1, ['f'], 'surfaces', 'shared', role='terrain', kind='flat',
           tags=['먼지', '덧그림', '폐허'], desc='먼지 더께와 부서진 판자 조각·종이 몇 장(덧그림).', rules='버려진 방 구석·벽 밑.')
def _dust(c):
    for k in range(18): c.P(int(hsh(k, 1, 4) * 16), int(hsh(k, 2, 4) * 16), K('fog', 0))
    c.line(2, 11, 8, 9, K('wood', 2)); c.line(2, 12, 8, 10, K('wood', 4))
    c.R(10, 4, 4, 3, K('paper', 4)); c.HL(10, 4, 4, K('paper', 5)); c.P(11, 5, K('paper', 2))


@REG.piece('gm-ov-cobweb', '구석 거미줄', 1, 1, ['f'], 'surfaces', 'shared', role='terrain', kind='flat',
           tags=['거미줄', '덧그림', '공포'], desc='방 구석에 쳐진 희뿌연 거미줄(왼쪽 위 모서리 기준).', rules='북벽 바로 아래 서쪽 구석 바닥 칸에.')
def _web(c):
    for k in range(5):
        a = k * math.pi / 8
        for r in range(16):
            x, y = int(math.cos(a) * r), int(math.sin(a) * r)
            if 0 <= x < 16 and 0 <= y < 16 and (r % 2 == 0 or r < 4): c.P(x, y, K('fog', 3))
    for r in (4, 8, 12):
        for k in range(20):
            a = k * (math.pi / 2) / 20
            c.P(int(math.cos(a) * r), int(math.sin(a) * r), K('fog', 2))


if __name__ == '__main__':
    sys.exit(1 if run_module(MODULE) else 0)
