#!/usr/bin/env python3
"""숲 r3 잔 램프 설계 — 버들항 숲 실측(SPEC.md 4절: 거의 같은 초록 수백 색으로 결을 낸다)을 jp 계약 안에서 흉내 낸다.

종마다 20단 곡선을 기준색 사이 보간으로 만든다. 계약 한 램프는 10단이 한도라 짝·홀 단을 두 하위 램프 `<id>1`·`<id>2` 로 나눈다.
두 램프의 휘도가 엇갈리므로 합치면 다시 20단이 된다. 그리는 쪽(forest_r3.py)은 palette-contract.json 의 ramps 에서 두 램프를 읽어 합친다.

  python3 forest_r3_palette.py          # paletteContract.ts 에 붙일 subRamps 줄을 찍는다(설계 기록용)
"""
import sys

# (재료, 하위 id 접두, 한글, 기준색 어두운→밝은, 단 수, 채도 상한, 쓰임)
FINE = [
    ('pine_bamboo', 'keyaki_a', '느티 잎(청록 계열)', [(10, 30, 28), (17, 56, 36), (24, 80, 43), (32, 101, 47), (44, 121, 52), (66, 140, 58), (92, 158, 64)], 20, 0.42,
     '느티나무·잡목 수관(짙은 청록 그루). 잎 덩이마다 왼쪽 위 밝게, 이웃 단은 1~2단 차로 결을 낸다.'),
    ('pine_bamboo', 'keyaki_b', '느티 잎(황록 계열)', [(18, 40, 24), (36, 74, 28), (58, 104, 32), (80, 130, 38), (104, 154, 46), (128, 176, 60), (150, 192, 78)], 20, 0.45,
     '느티나무·잡목 수관(황록 그루). 청록 그루와 번갈아 세워 겹친 수관을 가른다.'),
    ('pine_bamboo', 'sugi', '삼나무 잎', [(8, 24, 24), (13, 40, 34), (19, 57, 43), (27, 74, 52), (38, 92, 60), (54, 110, 68), (76, 128, 80)], 20, 0.30,
     '삼나무 원뿔 수관. 층마다 아래 그늘, 왼쪽 빛.'),
    ('pine_bamboo', 'pine', '소나무 잎', [(12, 28, 22), (20, 44, 30), (30, 60, 38), (42, 78, 46), (58, 96, 54), (78, 114, 62), (100, 132, 74)], 20, 0.25,
     '소나무 구름 잎판. 잎판 윗면만 밝다.'),
    ('pine_bamboo', 'bamboo_leaf', '대 잎', [(22, 46, 26), (38, 70, 32), (56, 96, 40), (76, 122, 48), (100, 146, 58), (126, 168, 72), (150, 186, 92)], 20, 0.36,
     '대나무 깃털 잎. 잎은 2~4px 비스듬한 획.'),
    ('sakura_petal', 'fine', '벚꽃 잔 결', [(52, 30, 40), (84, 50, 62), (120, 74, 88), (158, 104, 118), (196, 140, 152), (224, 178, 186), (244, 216, 218)], 20, 0.24,
     '벚나무 꽃 수관. 그늘은 자줏빛, 빛은 흰빛 분홍.'),
    ('autumn_maple', 'fine', '단풍 잔 결', [(40, 14, 16), (70, 22, 24), (104, 32, 30), (138, 48, 38), (166, 74, 50), (190, 104, 66), (212, 138, 94)], 20, 0.50,
     '단풍 수관. 그늘은 검붉게, 빛은 주황으로.'),
]
SMALL = [
    ('pine_bamboo', 'leafhi', '잎 반짝임', [(150, 196, 96), (172, 210, 116), (196, 224, 142)], 3, 0.45, '활엽 잎 덩이 윗면 한두 점.'),
    ('pine_bamboo', 'shade', '숲 그늘 점', [(16, 30, 22), (24, 42, 28), (34, 56, 34)], 3, 0.20, '줄기 밑·수관 그늘 점(체커 두 단).'),
    ('pine_bamboo', 'floor', '숲 바닥', [(12, 22, 18), (18, 30, 22), (24, 38, 26), (32, 48, 30), (42, 58, 34), (54, 70, 40)], 6, 0.20, '수관 밑 숲 바닥(2층). 낙엽 점은 줄기색 1~2단.'),
    ('pine_bamboo', 'culm2', '대 줄기 잔 결', [(34, 64, 40), (52, 88, 50), (74, 112, 60), (100, 136, 72), (130, 160, 92), (164, 186, 118), (196, 210, 150)], 7, 0.30, '대나무 줄기. 마디는 한 단 밝게, 그늘 면 0~1단.'),
    ('aged_cedar', 'bark2', '느티 줄기', [(36, 24, 16), (52, 36, 22), (72, 54, 32), (96, 72, 38), (124, 92, 48), (148, 112, 58), (168, 132, 76)], 7, 0.36, '느티·벚·단풍 줄기·뿌리. 왼쪽 빛.'),
    ('aged_cedar', 'sugibark', '삼나무 줄기', [(40, 18, 14), (62, 28, 20), (88, 42, 28), (114, 58, 38), (138, 78, 52), (160, 100, 70)], 6, 0.40, '삼나무 적갈색 곧은 줄기.'),
    ('aged_cedar', 'sakurabark', '벚 줄기', [(34, 26, 30), (50, 38, 42), (68, 52, 54), (88, 70, 70), (110, 92, 90), (132, 114, 108)], 6, 0.12, '벚나무 짙은 회갈 줄기·가로 껍질 띠.'),
]


def lerp_curve(anchors, n):
    out = []
    for i in range(n):
        t = i / (n - 1) * (len(anchors) - 1)
        k = min(int(t), len(anchors) - 2)
        f = t - k
        a, b = anchors[k], anchors[k + 1]
        out.append(tuple(round(a[j] + (b[j] - a[j]) * f) for j in range(3)))
    return out


def luma(c):
    return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]


def fix_monotone(cs):
    out = [cs[0]]
    for c in cs[1:]:
        c = list(c)
        while luma(c) <= luma(out[-1]):
            c[1] += 1
        out.append(tuple(c))
    return out


def hx(c):
    return '#%02x%02x%02x' % c


def chroma(c):
    return (max(c) - min(c)) / 255


def ramps():
    """{(재료, 하위 id): [색…]} — 20단은 1·2 로 나눈 뒤의 이름으로."""
    out = {}
    for mat, sid, ko, anchors, n, cap, use in FINE:
        cs = fix_monotone(lerp_curve(anchors, n))
        cap = round(max(chroma(c) for c in cs) + 0.005, 2)
        assert cap <= 0.5, (sid, cap)
        out[(mat, sid + '1', ko + ' 짝단', cap, use)] = cs[0::2]
        out[(mat, sid + '2', ko + ' 홀단', cap, use)] = cs[1::2]
    for mat, sid, ko, anchors, n, cap, use in SMALL:
        cs = fix_monotone(lerp_curve(anchors, n))
        cap = round(max(chroma(c) for c in cs) + 0.005, 2)
        assert cap <= 0.5, (sid, cap)
        out[(mat, sid, ko, cap, use)] = cs
    return out


if __name__ == '__main__':
    by = {}
    for (mat, sid, ko, cap, use), cs in ramps().items():
        by.setdefault(mat, []).append('          { id: "%s", ko: "%s", steps: [%s], chromaCap: %s, use: "%s" },' % (sid, ko, ', '.join('"%s"' % hx(c) for c in cs), cap, use))
    for mat, lines in by.items():
        print('// ' + mat); print('\n'.join(lines))
    sys.exit(0)
