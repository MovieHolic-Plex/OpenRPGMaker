import sys; sys.path.insert(0, '../../blackboard/work')
from s2lib import *

def planks_h(c, tones, seam, joints, grain, ph=4):
    """가로 널: 각 널 = ph줄. 위 줄들은 tones(위->아래), 마지막 줄은 seam. joints[i]=i번째 널의 세로 이음 x."""
    for i in range(16 // ph):
        y = i * ph
        for k, t in enumerate(tones): c.hl(0, y + k, 16, t)
        c.hl(0, y + ph - 1, 16, seam)
        jx = joints[i]
        for k in range(ph - 1): c.put(jx, y + k, seam)
        for (gx, gk, gc) in grain[i]: c.put(gx, y + gk, gc)

def cf(tag):
    c = C(16, 16, 'a')
    R = 'cfloor'
    if tag == 'A':
        L = {'a': (R, 4), 'b': (R, 5), 'c': (R, 3), 'd': (R, 2)}
        planks_h(c, ['b', 'a', 'a'], 'd', [5, 13, 9, 2],
                 [[(10, 1, 'c'), (11, 1, 'c'), (2, 2, 'c')], [(3, 1, 'c'), (4, 1, 'c'), (9, 2, 'c')],
                  [(2, 1, 'c'), (14, 2, 'c'), (15, 2, 'c')], [(7, 1, 'c'), (8, 1, 'c'), (12, 2, 'c')]], 4)
        c.put(6, 0, 'a'); c.put(7, 0, 'a')  # 이음 뒤 결 끊기
    if tag == 'B':
        L = {'a': (R, 4), 'b': (R, 5), 'h': (R, 6), 'c': (R, 3), 'd': (R, 1), 'e': (R, 2)}
        planks_h(c, ['h', 'b', 'a'], 'd', [5, 13, 9, 2],
                 [[(10, 1, 'a'), (11, 2, 'c'), (2, 2, 'c')], [(3, 2, 'c'), (4, 2, 'c'), (9, 1, 'a')],
                  [(2, 2, 'c'), (14, 1, 'a'), (15, 2, 'c')], [(7, 2, 'c'), (8, 1, 'a'), (12, 2, 'c')]], 4)
        # 널 아래 그림자 한 줄(이음 위)
        for i in range(4):
            for x in range(16):
                if c.get(x, i * 4 + 2) in 'ab': c.put(x, i * 4 + 2, 'c' if (x + i) % 5 else 'a')
    if tag == 'C':
        # 바구니 짜기: 8x8 블록, 4px 널 두 장씩, 가로/세로 번갈아
        L = {'a': (R, 4), 'b': (R, 5), 'c': (R, 3), 'd': (R, 2), 'h': (R, 6)}
        for by in range(2):
            for bx in range(2):
                horiz = (bx + by) % 2 == 0
                x0, y0 = bx * 8, by * 8
                for k in range(2):
                    if horiz:
                        y = y0 + k * 4
                        c.hl(x0, y, 8, 'h' if False else 'b'); c.hl(x0, y + 1, 8, 'a'); c.hl(x0, y + 2, 8, 'a'); c.hl(x0, y + 3, 8, 'd')
                        c.put(x0 + 7, y, 'd'); c.put(x0 + 7, y + 1, 'd'); c.put(x0 + 7, y + 2, 'd'); c.put(x0 + 2 + k * 3, y + 1, 'c')
                    else:
                        x = x0 + k * 4
                        c.vl(x, y0, 8, 'b'); c.vl(x + 1, y0, 8, 'a'); c.vl(x + 2, y0, 8, 'a'); c.vl(x + 3, y0, 8, 'd')
                        c.put(x, y0 + 7, 'd'); c.put(x + 1, y0 + 7, 'd'); c.put(x + 2, y0 + 7, 'd'); c.put(x + 1, y0 + 2 + k * 3, 'c')
    return c, L

def gf(tag):
    c = C(16, 16, 'a')
    R = 'gym'
    if tag == 'A':
        L = {'a': (R, 4), 'b': (R, 5), 'h': (R, 6), 'c': (R, 3), 'd': (R, 2)}
        planks_h(c, ['b', 'a', 'a'], 'c', [3, 11, 7, 14],
                 [[(8, 1, 'c')], [(1, 2, 'c'), (2, 2, 'c')], [(12, 1, 'c')], [(5, 2, 'c'), (6, 2, 'c')]], 4)
        for i in range(4):  # 바니시 광
            for x in range(2, 8): c.put(x + i * 3 % 8, i * 4, 'h')
    if tag == 'B':
        L = {'a': (R, 4), 'b': (R, 5), 'h': (R, 6), 'c': (R, 3), 'd': (R, 2)}
        planks_h(c, ['h', 'b', 'a'], 'd', [3, 11, 7, 14],
                 [[(8, 2, 'c')], [(1, 2, 'c'), (2, 2, 'c')], [(12, 2, 'c')], [(5, 2, 'c'), (6, 2, 'c')]], 4)
        for i in range(4):
            for x in range(16):
                if (x + i * 5) % 16 in (0, 1, 2, 3, 4, 5): c.put(x, i * 4 + 1, 'h')
    if tag == 'C':
        # 폭 넓은 널 2장(8px 높이), 엇갈린 이음, 잔 결 세 줄
        L = {'a': (R, 4), 'b': (R, 5), 'h': (R, 6), 'c': (R, 3), 'd': (R, 2)}
        for i in range(2):
            y = i * 8
            c.hl(0, y, 16, 'h'); 
            for k in range(1, 7): c.hl(0, y + k, 16, 'b' if k % 2 else 'a')
            c.hl(0, y + 7, 16, 'd')
            jx = 4 if i == 0 else 12
            for k in range(7): c.put(jx, y + k, 'd')
            for gx in ((9, 1, 2), (1, 3, 4), (13, 5, 6)) if False else ():
                pass
            c.hl(6 + i * 4, y + 3, 4, 'c'); c.hl(1 + i * 9, y + 5, 3, 'c')
        c.hl(0, 0, 16, 'h')
    return c, L

def tf(tag):
    c = C(16, 16, 'a')
    R = 'stile'
    if tag == 'A':
        L = {'a': (R, 5), 'h': (R, 6), 'g': (R, 3), 'k': (R, 4)}
        for ty in range(2):
            for tx in range(2):
                x0, y0 = tx * 8, ty * 8
                base = 'k' if (tx, ty) == (1, 0) else 'a'
                c.rect(x0, y0, 7, 7, base)
                c.hl(x0, y0, 7, 'h' if base == 'a' else 'a'); c.vl(x0, y0, 7, 'h' if base == 'a' else 'a')
                c.vl(x0 + 7, y0, 8, 'g'); c.hl(x0, y0 + 7, 8, 'g')
    if tag == 'B':
        L = {'a': (R, 5), 'h': (R, 6), 'g': (R, 2), 'k': (R, 4), 's': (R, 3), 'd': (R, 1)}
        for ty in range(2):
            for tx in range(2):
                x0, y0 = tx * 8, ty * 8
                dark = (tx, ty) == (1, 0)
                f, hi, lo = ('k', 'a', 's') if dark else ('a', 'h', 'k')
                c.rect(x0, y0, 7, 7, f)
                c.hl(x0, y0, 7, hi); c.vl(x0, y0, 7, hi)
                c.hl(x0 + 1, y0 + 6, 6, lo); c.vl(x0 + 6, y0 + 1, 6, lo)
                c.vl(x0 + 7, y0, 8, 'g'); c.hl(x0, y0 + 7, 8, 'g')
        c.put(3, 3, 'h'); c.put(4, 3, 'h'); c.put(11, 11, 'h')
    if tag == 'C':
        # 4px 모자이크 체크
        L = {'a': (R, 5), 'k': (R, 4), 'h': (R, 6), 'g': (R, 3)}
        for ty in range(4):
            for tx in range(4):
                x0, y0 = tx * 4, ty * 4
                f = 'a' if (tx + ty) % 2 == 0 else 'k'
                if (tx, ty) == (2, 1): f = 'k' if f == 'a' else f
                c.rect(x0, y0, 3, 3, f)
                c.hl(x0, y0, 3, 'h' if f == 'a' else 'a'); 
                c.vl(x0 + 3, y0, 4, 'g'); c.hl(x0, y0 + 3, 4, 'g')
    return c, L

def gl(tag):
    c = C(16, 16, '.')
    if tag == 'A':
        L = {'h': ('vwhite', 6), 'm': ('vwhite', 5), 'l': ('vwhite', 3)}
        c.hl(0, 7, 16, 'h'); c.hl(0, 8, 16, 'm')
        c.put(4, 7, 'm'); c.put(11, 8, 'l'); c.put(12, 8, 'l')
    if tag == 'B':
        L = {'h': ('vwhite', 6), 'm': ('vwhite', 5), 'l': ('vwhite', 3)}
        c.hl(0, 7, 16, 'h'); c.hl(0, 8, 16, 'l'); c.hl(0, 9, 16, '-')
        c.hl(0, 6, 16, '%') if False else None
        for x in (3, 4, 5, 6): c.put(x, 7, 'h')
        c.put(10, 8, 'm'); c.put(11, 8, 'm')
    if tag == 'C':
        L = {'h': ('vgreen', 5), 'm': ('vgreen', 4), 'l': ('vgreen', 2), 'w': ('vwhite', 6)}
        for x in range(16):
            if x % 8 < 6:
                c.put(x, 7, 'h'); c.put(x, 8, 'm')
        for x in (0, 8): c.put(x, 8, 'l')
        c.put(1, 7, 'w'); c.put(9, 7, 'w')
    return c, L

def cw(tag):
    c = C(16, 32, 'a')
    P, D, K = 'vpine', 'vdwood', 'cream'
    if tag == 'A':
        L = {'a': (K, 4), 'b': (K, 5), 'c': (K, 3), 'p6': (P, 6), 'p5': (P, 5), 'p4': (P, 4), 'p3': (P, 3), 'p2': (P, 2), 'd5': (D, 5), 'd4': (D, 4), 'd2': (D, 2), 'd1': (D, 1)}
        L = {'a': (K, 4), 'b': (K, 5), 'c': (K, 3), 'A': (P, 6), 'B': (P, 5), 'D': (P, 4), 'E': (P, 3), 'F': (P, 2), 'G': (D, 5), 'H': (D, 4), 'I': (D, 3), 'J': (D, 2)}
        for y in range(0, 17): c.hl(0, y, 16, 'a')
        for (x, y) in ((3, 3), (11, 6), (7, 11), (14, 13), (1, 9)): c.put(x, y, 'b')
        for (x, y) in ((12, 2), (5, 8), (9, 14)): c.put(x, y, 'c')
        c.hl(0, 17, 16, 'A'); c.hl(0, 18, 16, 'B'); c.hl(0, 19, 16, 'E')
        for y in range(20, 29):
            for px in (0, 8):
                c.put(px, y, 'E'); c.put(px + 1, y, 'B')
                for k in range(2, 7): c.put(px + k, y, 'D')
                c.put(px + 7, y, 'E')
            c.put(4, y, 'E') if y in (22, 25) else None
            c.put(12, y, 'E') if y in (21, 26) else None
        c.hl(0, 28, 16, 'F')
        c.hl(0, 29, 16, 'G'); c.hl(0, 30, 16, 'H'); c.hl(0, 31, 16, 'J')
    if tag == 'B':
        L = {'a': (K, 4), 'b': (K, 5), 'c': (K, 3), 'A': (P, 6), 'B': (P, 5), 'D': (P, 4), 'E': (P, 3), 'F': (P, 2), 'G': (D, 5), 'H': (D, 4), 'I': (D, 3), 'J': (D, 2), 'K': (D, 1)}
        for y in range(0, 17): c.hl(0, y, 16, 'a')
        for y in (14, 15, 16): c.hl(0, y, 16, 'c')
        for (x, y) in ((3, 3), (11, 6), (7, 9)): c.put(x, y, 'b')
        c.hl(0, 15, 16, 'A') if False else None
        c.hl(0, 17, 16, 'A'); c.hl(0, 18, 16, 'B'); c.hl(0, 19, 16, 'D')
        c.hl(0, 20, 16, 'K'); c.hl(0, 21, 16, 'J')  # 처마 밑 짙은 그늘
        for y in range(22, 29):
            for px in (0, 8):
                c.vl(px, y, 1, 'J'); c.put(px + 1, y, 'B'); 
                for k in range(2, 6): c.put(px + k, y, 'D')
                c.put(px + 6, y, 'E'); c.put(px + 7, y, 'J')
        c.hl(0, 22, 16, 'I'); 
        for px in (0, 8): c.hl(px + 1, 22, 6, 'B')
        c.hl(0, 28, 16, 'F')
        c.hl(0, 29, 16, 'G'); c.hl(0, 30, 16, 'H'); c.hl(0, 31, 16, 'K')
    if tag == 'C':
        # 낮은 크림 위 + 높은 가로판 징두리(초록 리놀 색 판)
        L = {'a': (K, 4), 'b': (K, 5), 'c': (K, 3), 'A': (D, 5), 'B': (D, 4), 'D': (D, 3), 'E': (D, 2), 'F': (D, 1), 'g': ('lino', 4), 'h': ('lino', 5), 'i': ('lino', 3), 'j': ('lino', 2)}
        for y in range(0, 12): c.hl(0, y, 16, 'a')
        for (x, y) in ((3, 3), (11, 6), (7, 9)): c.put(x, y, 'b')
        c.put(13, 2, 'c'); c.put(6, 7, 'c')
        c.hl(0, 12, 16, 'A'); c.hl(0, 13, 16, 'B'); c.hl(0, 14, 16, 'E')
        for k, y in enumerate(range(15, 28, 3)):  # 가로 널 3줄 높이
            c.hl(0, y, 16, 'h'); c.hl(0, y + 1, 16, 'g'); c.hl(0, y + 2, 16, 'i')
            jx = (3, 11, 7, 1, 13)[k]
            for yy in range(y, y + 3): c.put(jx, yy, 'j')
        c.hl(0, 27, 16, 'j') if False else None
        c.hl(0, 28, 16, 'D'); c.hl(0, 29, 16, 'B'); c.hl(0, 30, 16, 'B') if False else None
        c.hl(0, 30, 16, 'D'); c.hl(0, 31, 16, 'F')
    return c, L

NOTE = {
 'classroom_floor': {'A': '가로 널 4장(윗줄 밝게·이음 어둡게), 널마다 세로 이음 엇갈림·결 점. 사방 이음 맞춤',
                     'B': '널 위쪽 밝은 줄·아래 어두운 줄로 볼록하게, 이음 더 짙게. 사방 이음 맞춤',
                     'C': '바구니 짜기 마루 — 8칸 블록에 가로·세로 널 번갈아, 사방 이음 맞춤'},
 'gym_floor': {'A': '밝은 단풍 가로 널, 가는 이음, 널마다 바니시 광 점선. 교실 마루보다 밝고 노랗다',
               'B': '널 윗줄 광을 길게, 이음 짙게. 바니시 광 강조',
               'C': '폭 넓은 널 둘, 엇갈린 이음, 잔 결. 농구 코트풍 넓은 마루'},
 'tile_floor': {'A': '8px 흰 타일 넷·회색 줄눈 1px, 한 장만 한 단 어둡게. 윗·왼쪽 밝은 줄',
                'B': '타일마다 윗·왼 밝은 줄과 아래·오른 어두운 줄로 볼록, 한 장 어둡게, 광 점',
                'C': '4px 모자이크 타일 체크무늬, 줄눈 1px, 한 장 어둡게'},
 'gym_line': {'A': '흰 2px 가로선, 윗줄 밝고 아랫줄 한 단 낮게, 닳은 점 둘',
              'B': '흰선 아래에 반투명 접지 그림자 한 줄 -, 윗줄 광 강조',
              'C': '초록 점선(6칸 선 2칸 틈) — 3점 라인 등 보조선 실루엣'},
 'classroom_wall': {'A': '위 크림 회벽 + 나무 징두리(세로 널 8px 둘), 위 걸레받이 얇은 몰딩. 아래 3줄 = 걸레받이',
                    'B': '징두리 위 몰딩 그늘 4줄, 널마다 안쪽 볼록(오른쪽 어둡게), 크림 아래쪽 그늘',
                    'C': '크림 벽 낮게(12줄) + 가로 널 초록 징두리 높이 올림. 걸레받이 어둡게'},
}
if __name__ == '__main__':
    ps = []
    for slug, fn in (('classroom_floor', cf), ('gym_floor', gf), ('tile_floor', tf), ('gym_line', gl), ('classroom_wall', cw)):
        for t in 'ABC':
            c, L = fn(t)
            ps.append(save(slug, t, c, L, NOTE[slug][t]))
    check(ps)
