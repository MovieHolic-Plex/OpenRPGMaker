#!/usr/bin/env python3
"""실내 3/4 증명 그림(modern-style-bible.md 11절). 벽에 붙은 키 큰 가구 4종 — 옷장·책장·벽난로·사물함.
v5 손 도트 실내 칩셋 화풍(검은 윤곽 · 6단 나무 램프 · 돌 램프)으로, 옛 조각과 새 조각을 나란히 찍는다.
  python3 scripts/content/atlas-pick/view34_interior_proof.py [옛 v5 아틀라스 PNG] [interior-meta.json]
옛 조각 원본은 branch agent/atlas-interior 의 tiledata/hand-interior/v5/interior-atlas.png (git show 로 꺼낸다).
없으면 이미 저장된 interior-old-*.png 를 쓴다. 출력: tiledata/atlas-pick/style-demo-view34/interior-*.png
계약(11-2): 벽 붙은 키 큰 가구 = 윗면 T 5~6px(벽 쪽으로 보이는 좁은 면) + 앞면 F(나머지). 옆면은 없다.
  윗면은 밝고(빛 왼쪽 위) 앞 모서리에 1px 하이라이트, 앞면 위에는 처마 그림자 2px, 문·칸은 오목(안쪽 윗 그림자)."""
import os, sys
import numpy as np
from PIL import Image, ImageDraw
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import BASE

OUT = os.path.join(BASE, 'style-demo-view34')
OLD_ATLAS_XY = {'wardrobe': (448, 304, 16, 32), 'bookshelf': (336, 304, 16, 48), 'fireplace': (192, 352, 32, 32)}

# v5 나무 램프(어둠→밝음) · 돌 램프 · 강철 램프(사물함용, 같은 명도 간격)
WD = dict(k=0x000000, w0=0x411e05, w1=0x63310b, w2=0x6d3b15, w3=0x9a5435, w4=0x9e684b, w5=0xb77246, w6=0xd59147, gold=0xffe070, gold2=0x8a6010)
ST = dict(s0=0x140c0c, s1=0x363540, s2=0x4e4a52, s3=0x606278, s4=0x758090, s5=0x909fb2, s6=0x68646a)
SL = dict(l0=0x1d2c33, l1=0x2c3a40, l2=0x4a5b68, l3=0x6a7f8e, l4=0x8aa0b2, l5=0xb5c8d6)
BK = [0xc30014, 0xffebd7, 0xa5010a, 0x419d39, 0x8894a0, 0xd59147]

class C:
    def __init__(s, w, h): s.w, s.h, s.a = w, h, np.zeros((h, w, 4), np.uint8)
    def P(s, x, y, c):
        if 0 <= x < s.w and 0 <= y < s.h: s.a[y, x] = ((c >> 16) & 255, (c >> 8) & 255, c & 255, 255)
    def R(s, x, y, w, h, c):
        for j in range(h):
            for i in range(w): s.P(x + i, y + j, c)
    def img(s): return Image.fromarray(s.a, 'RGBA')

def top_face(c, x, y, w, t, hi, mid, lo, edge):
    """윗면 t 줄: 뒤(맨 위) 줄 = lo(벽 그늘), 가운데 = mid, 앞 모서리 = edge 하이라이트. 왼쪽 열은 hi(빛)."""
    c.R(x, y, w, t, mid)
    c.R(x, y, w, 1, lo)
    c.R(x, y + t - 1, w, 1, edge)
    c.R(x, y + 1, 1, t - 1, hi)
    return y + t

def cornice(c, x, y, w, face, edge, shadow, sh_h=2):
    """처마(앞면 위 띠 2줄) + 그 밑 그림자 sh_h 줄."""
    c.R(x, y, w, 1, edge); c.R(x, y + 1, w, 1, face)
    c.R(x, y + 2, w, sh_h, shadow)
    return y + 2 + sh_h

def new_wardrobe():
    c = C(16, 32); T = 6
    c.R(0, 0, 16, 32, 0)                                  # 투명 유지: 아래에서 칠한 곳만 남는다
    c.a[:] = 0
    c.R(0, 1, 1, 30, WD['k']); c.R(15, 1, 1, 30, WD['k'])
    top_face(c, 1, 0, 14, T, WD['w6'], WD['w5'], WD['w3'], WD['w6'])
    for (gx, gy) in ((4, 2), (5, 2), (10, 3), (11, 3)): c.P(gx, gy, WD['w4'])
    y = cornice(c, 0, T, 16, WD['w4'], WD['w5'], WD['w1'])      # y 6~7 처마, 8~9 그림자
    c.R(0, T, 1, 4, WD['k']); c.R(15, T, 1, 4, WD['k'])
    # 두 짝 문(오목 판): 문틀 → 안쪽 판
    for dx in (1, 8):
        c.R(dx, y, 7, 19, WD['w4'])
        c.R(dx, y, 1, 19, WD['w5']); c.R(dx, y, 7, 1, WD['w5'])               # 왼·위 빛
        c.R(dx + 6, y, 1, 19, WD['w2']); c.R(dx, y + 18, 7, 1, WD['w2'])      # 오른·아래 그늘
        c.R(dx + 1, y + 2, 5, 15, WD['w2'])                                   # 오목 판 바닥
        c.R(dx + 1, y + 2, 5, 1, WD['w0']); c.R(dx + 1, y + 2, 1, 15, WD['w1'])  # 안쪽 윗·왼 그림자 = 깊이
        c.R(dx + 2, y + 3, 3, 13, WD['w3']); c.R(dx + 5, y + 3, 1, 13, WD['w4'])
        c.R(dx + 1, y + 16, 5, 1, WD['w5'])                                   # 판 아래 턱 윗면
    c.R(7, y, 1, 19, WD['w0'])                            # 문 사이 틈
    for gy in (y + 8, y + 9): c.P(6, gy, WD['gold']); c.P(9, gy, WD['gold'])
    c.P(6, y + 10, WD['gold2']); c.P(9, y + 10, WD['gold2'])
    yb = y + 19                                           # 받침(플린스): 윗면 1줄 + 앞면 2줄
    c.R(0, yb, 16, 1, WD['w5']); c.R(0, yb + 1, 16, 2, WD['w1']); c.R(0, yb + 3, 16, 1, WD['w0'])
    c.R(0, yb, 1, 4, WD['k']); c.R(15, yb, 1, 4, WD['k'])
    c.R(0, 31, 16, 1, WD['k'])
    return c

def new_bookshelf():
    c = C(16, 48); T = 6
    c.R(0, 0, 1, 47, WD['k']); c.R(15, 0, 1, 47, WD['k'])
    top_face(c, 1, 0, 14, T, WD['w6'], WD['w5'], WD['w3'], WD['w6'])
    for (gx, gy) in ((5, 2), (6, 2), (10, 3)): c.P(gx, gy, WD['w4'])
    y = cornice(c, 0, T, 16, WD['w4'], WD['w5'], WD['w1'])      # y 6~9
    c.R(0, T, 1, 4, WD['k']); c.R(15, T, 1, 4, WD['k'])
    ch = 9                                                # 칸 높이
    fills = [[(1, 0), (0, 1), (2, 0)], [(3, 0), (1, 1), (0, 2), (5, 3)], [(4, 0), (2, 1), (3, 2)]]
    for s in range(3):
        top = y + s * 12
        # 옆 기둥 2px(왼 빛, 오른 그늘) + 칸 안쪽 오목
        c.R(1, top, 2, 12, WD['w4']); c.R(1, top, 1, 12, WD['w5']); c.R(13, top, 2, 12, WD['w3']); c.R(14, top, 1, 12, WD['w1'])
        c.R(3, top, 10, ch, 0x000000)                     # 칸 속(어둠)
        c.R(3, top, 10, 2, 0x140805)                      # 윗 그림자 2줄
        c.R(3, top + 2, 1, ch - 2, 0x1d0e04)              # 왼 안쪽 그늘
        # 책: 폭 2~3, 키가 들쭉날쭉. 왼 줄 밝게, 오른 줄 어둡게, 등 띠 1줄
        plan = [[(1, 3), (0, 2), (2, 2), (5, 3)], [(3, 2), (4, 2), (0, 3), (1, 2), (2, 1)], [(4, 3), (2, 2), (5, 2), (3, 3)]][s]
        x = 3 + (1 if s == 1 else 0)
        for k, w in plan:
            col = BK[k]; hh = ch - 2 - ((x * 3 + s) % 3 == 0) - (1 if w == 3 else 0)
            lit = tuple(min(255, int(((col >> sh) & 255) * 1.25 + 24)) for sh in (16, 8, 0)); lit = (lit[0] << 16) | (lit[1] << 8) | lit[2]
            drk = tuple(int(((col >> sh) & 255) * 0.62) for sh in (16, 8, 0)); drk = (drk[0] << 16) | (drk[1] << 8) | drk[2]
            if x + w > 13: break
            c.R(x, top + ch - hh, w, hh, col); c.R(x, top + ch - hh, 1, hh, lit); c.R(x + w - 1, top + ch - hh, 1, hh, drk)
            c.R(x, top + ch - hh + 2, w, 1, drk); c.R(x, top + ch - 3, w, 1, drk)
            x += w
        # 선반 널: 윗면 1 + 앞면 2 + 아래 그림자 1
        c.R(1, top + ch, 14, 1, WD['w6']); c.R(1, top + ch + 1, 14, 2, WD['w3']); c.R(1, top + ch + 3 - 0, 14, 0, 0)
        c.R(1, top + ch + 1, 14, 1, WD['w4'])
        c.R(0, top, 1, 12, WD['k'])
    yb = y + 36
    c.R(0, yb, 16, 1, WD['w5']); c.R(0, yb + 1, 16, 2, WD['w1']); c.R(0, yb + 3, 16, 1, WD['w0'])
    c.R(0, yb, 1, 4, WD['k']); c.R(15, yb, 1, 4, WD['k'])
    c.R(0, 47, 16, 1, WD['k'])
    return c

def new_locker():
    c = C(16, 32); T = 5
    c.R(0, 1, 1, 30, SL['l0']); c.R(15, 1, 1, 30, SL['l0'])
    top_face(c, 1, 0, 14, T, SL['l5'], SL['l4'], SL['l2'], SL['l5'])
    c.R(4, 2, 8, 1, SL['l3'])                              # 윗면 모서리 접힘
    c.R(0, T, 16, 1, SL['l4']); c.R(0, T + 1, 16, 1, SL['l3']); c.R(0, T + 2, 16, 2, SL['l1'])   # 처마 띠 + 그림자
    y = T + 4
    c.R(1, y, 14, 21, SL['l3'])                            # 문
    c.R(1, y, 14, 1, SL['l4']); c.R(1, y, 1, 21, SL['l4'])           # 빛 모서리
    c.R(14, y, 1, 21, SL['l2']); c.R(1, y + 20, 14, 1, SL['l2'])     # 그늘 모서리
    c.R(2, y + 2, 12, 7, SL['l1'])                         # 환기창 오목(안쪽 윗 그림자)
    c.R(2, y + 2, 12, 1, SL['l0']); 
    for k in range(3): c.R(3, y + 3 + k * 2, 10, 1, SL['l3']); c.R(3, y + 4 + k * 2, 10, 1, SL['l1']) if k < 2 else None
    c.R(2, y + 10, 12, 1, SL['l4'])                        # 환기창 아래 턱 윗면
    c.R(11, y + 12, 2, 4, SL['l1']); c.R(11, y + 12, 2, 1, SL['l4']); c.R(11, y + 15, 2, 1, SL['l0'])   # 손잡이
    c.R(3, y + 13, 4, 3, SL['l4']); c.R(3, y + 13, 4, 1, SL['l5']); c.R(3, y + 15, 4, 1, SL['l2'])      # 번호판
    yb = y + 21
    c.R(0, yb, 16, 1, SL['l4']); c.R(0, yb + 1, 16, 2, SL['l1']); c.R(0, yb + 3, 16, 1, SL['l0'])
    c.R(0, yb, 1, 4, SL['l0']); c.R(15, yb, 1, 4, SL['l0'])
    return c

def stone_row(c, x, y, w, off, col, hi, lo):
    c.R(x, y, w, 4, col); c.R(x, y, w, 1, hi); c.R(x, y + 3, w, 1, lo)
    for vx in range(x + off, x + w, 9): c.R(vx, y, 1, 4, lo)

def new_fireplace(old):
    c = C(32, 32); T = 6
    # 굴뚝 몸통 돌(앞면) 전체 먼저
    c.R(0, 0, 32, 32, 0); c.a[:] = 0
    # 벽난로 선반(맨틀) 윗면 T=6, 옆으로 1칸씩 튀어나오지 않고 몸통 폭 그대로(칸 경계 유지)
    top_face(c, 0, 0, 32, T, WD['w6'], WD['w5'], WD['w3'], WD['w6'])
    for (gx, gy) in ((5, 2), (6, 2), (20, 3), (21, 3), (26, 2)): c.P(gx, gy, WD['w4'])
    c.R(0, T, 32, 1, WD['w5']); c.R(0, T + 1, 32, 1, WD['w4']); c.R(0, T + 2, 32, 1, WD['w3']); c.R(0, T + 3, 32, 2, WD['w1'])   # 앞면 3 + 그림자 2
    y0 = T + 5                                                   # 돌 시작 y=11
    c.R(0, y0, 32, 16, ST['s3'])
    for r in range(4):
        stone_row(c, 0, y0 + r * 4, 32, 4 + (r % 2) * 5, ST['s4'] if r % 2 else ST['s3'], ST['s5'], ST['s1'])
    c.R(0, y0, 32, 1, ST['s1']); c.R(0, y0 + 1, 32, 1, ST['s2'])   # 선반 밑 그림자(돌 위)
    c.R(0, T, 1, 26, ST['s1']); c.R(31, T, 1, 26, ST['s1'])
    # 화실(불 넣는 곳): 입구 x 8~23, 안은 어둠 + 좌우 안벽(오목) + 위 아치 안쪽 그림자
    fx, fw, fy, fh = 8, 16, y0 + 3, 13
    c.R(fx, fy, fw, fh, ST['s0'])
    c.R(fx, fy, fw, 3, 0x000000)                                     # 위 안쪽 그림자(깊이)
    c.R(fx, fy + 3, 2, fh - 3, 0x1d1010)                              # 왼 안벽 = 빛 받는 안쪽 면 아님(그늘)
    c.R(fx - 1, fy, 1, fh, ST['s1']); c.R(fx + fw, fy, 1, fh, ST['s2'])   # 문설주 안 모서리
    c.R(fx - 1, fy - 1, fw + 2, 1, ST['s5'])                          # 상인방 윗면 하이라이트
    # 불: 옛 조각의 불 그림 이식(같은 좌표)
    for j in range(15, 27):
        for i in range(10, 22):
            p = old.a[j, i]
            if p[3] and p[0] > 0x60 and (p[0] > p[2] + 0x30): c.a[j, i] = p            # 불꽃 픽셀만(따뜻한 색)
    # 장작 받침
    c.R(fx + 3, fy + fh - 3, fw - 6, 2, WD['w1']); c.R(fx + 3, fy + fh - 3, fw - 6, 1, WD['w2'])
    # 화덕 바닥(hearth): 바닥에 튀어나온 돌판 — 윗면 3 + 앞면 2
    hy = 27
    c.R(0, hy, 32, 1, ST['s0'])
    c.R(0, hy, 32, 3, ST['s5']); c.R(0, hy, 32, 1, ST['s4']); c.R(0, hy + 2, 32, 1, ST['s5'])
    c.R(0, hy + 3, 32, 2, ST['s3']); c.R(0, hy + 4, 32, 1, ST['s2'])
    c.R(0, hy, 1, 5, ST['s1']); c.R(31, hy, 1, 5, ST['s1'])
    c.R(0, 31, 32, 1, ST['s1'])
    return c

def crop_old(atlas, key):
    x, y, w, h = OLD_ATLAS_XY[key]; return atlas.crop((x, y, x + w, y + h))

def main():
    os.makedirs(OUT, exist_ok=True)
    atlas_p = sys.argv[1] if len(sys.argv) > 1 else None
    olds = {}
    for k in OLD_ATLAS_XY:
        p = os.path.join(OUT, f'interior-old-{k}.png')
        if atlas_p and os.path.exists(atlas_p):
            im = crop_old(Image.open(atlas_p).convert('RGBA'), k); im.save(p)
        olds[k] = Image.open(p).convert('RGBA')
    oldf = C(32, 32); oldf.a[:] = np.array(olds['fireplace'])
    new = {'wardrobe': new_wardrobe(), 'bookshelf': new_bookshelf(), 'fireplace': new_fireplace(oldf), 'locker': new_locker()}
    for k, c in new.items(): c.img().save(os.path.join(OUT, f'interior-new-{k}.png'))
    print('ok', {k: (c.w, c.h) for k, c in new.items()})

if __name__ == '__main__': main()
