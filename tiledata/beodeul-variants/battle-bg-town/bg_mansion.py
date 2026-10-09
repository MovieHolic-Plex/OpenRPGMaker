# mansion-art-city — 귀족 저택·예술 도시 앞 벽돌 광장. 그림 함수 = src-mansion-art-city 복사본(mc_build·mc_props·mc_ground).
# 원경: 맑은 낮 하늘 띠·구름·먼 정원 나무 줄. 뒷줄: 가운데 대칭 귀족 저택 정면(현관 기둥·박공), 왼쪽 화랑·작업실 집, 오른쪽 거리 집·화방.
# 저택 앞 자갈 앞마당 + 다듬은 회양목 생울타리 줄(가운데 대문 자리만 트임). 바닥: 테라코타 벽돌 바구니 짜임. 가장자리: 원뿔 정원수·꽃 항아리·뮤즈 석상·금 가로등·이젤.
import os, sys
sys.dont_write_bytecode = True
HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, HERE); sys.path.insert(0, os.path.join(HERE, 'src-mansion-art-city'))
import numpy as np
from PIL import Image
import bgcommon as B
import mc_build as MB, mc_props as MP, mc_ground as MG
from mc_base import I

HB = 182           # 뒷줄 밑줄
GV = 22            # 자갈 앞마당 깊이

def field(fn, w, h, ox=0, oy=0):
    out = np.zeros((h, w, 3), np.uint8)
    for y in range(h):
        for x in range(w): out[y, x] = fn(x + ox, y + oy)[:3]
    return out

def hedge_row(sheet, n):
    """회양목 오토타일(위1·오른2·아래4·왼8)로 가로 한 줄: 왼 끝 2, 가운데 10, 오른 끝 8."""
    row = Image.new('RGBA', (n * 16, 16))
    for i in range(n):
        m = 2 if i == 0 else (8 if i == n - 1 else 10)
        row.alpha_composite(MG.atile(sheet, m), (i * 16, 0))
    return row

def make():
    im = B.new()
    B.sky(im, [(36, '#5f9bcc'), (74, '#79b0da'), (110, '#97c6e4'), (HB, '#b9dcec')])
    for (cx, cy, w, h, s) in ((70, 34, 70, 12, 81), (560, 22, 80, 14, 82), (330, 10, 44, 8, 83), (470, 56, 40, 8, 84)):
        B.cloud(im, cx, cy, w, h, s)
    # 먼 정원 나무 줄(버들항 잎 램프 어두운 단)
    B.ridge(im, HB - 20, 26, ('#3f7a2c', '#58a035', '#205030'), 91, step=4, period=(60, 27, 11))
    # 바닥: 벽돌 바구니 짜임(전투 바닥) + 저택 앞 자갈 앞마당
    h = 360 - HB
    g = field(MG.brick_px, 640, h, 0, 3)
    gv = field(MG.gravel_px, 640, GV, 0, 0)
    g[:GV] = gv
    # 벽돌 길은 띠(폭 72)로, 그 앞은 깎은 줄무늬 저택 잔디(mc_ground.lawn_px) — 경계는 벽돌 테 + 잔디 쪽 그늘 한 줄
    R0, R1 = GV + 18, GV + 90
    lawn = field(MG.lawn_px, 640, h - R1, 0, 0)
    g[R1:] = lawn
    g[GV + 2:R0] = field(MG.lawn_px, 640, R0 - GV - 2, 0, 40)
    # 자갈 ↔ 벽돌 경계: 벽돌 쪽 테두리 벽돌 한 줄(진한 줄눈 + 밝은 모)
    import roman
    g[GV, :] = roman.TC[2]; g[GV + 1, :] = roman.TC[5]
    for yy, c in ((R0, roman.TC[2]), (R0 + 1, roman.TC[5]), (R1 - 2, roman.TC[5]), (R1 - 1, roman.TC[2])): g[yy, :] = c
    g[R1] = (g[R1].astype(int) * 0.7).astype(np.uint8)
    a = np.array(im); a[HB:, :, :3] = g; im.paste(Image.fromarray(a, 'RGBA'))
    # 뒷줄 건물
    man = I(MB.mansion())
    row = [(I(MB.gallery()), -44, HB), (I(MB.townhouse(4, 3, 1, 2, 'atelier')), 108, HB),
           (man, 320 - man.width // 2, HB + 8),
           (I(MB.townhouse(5, 2, 2, 1, 'house')), 460, HB), (I(MB.townhouse(5, 2, 2, 3, 'shop')), 540, HB), (I(MB.townhouse(4, 3, 1, 2, 'atelier')), 616, HB)]
    TS = os.path.join(HERE, 'src-beodeul', 'sprites')
    for (n, x, yb) in (('tree_tall', 160, HB - 2), ('tree_round', 92, HB - 6), ('tree_round', 444, HB - 4), ('tree_tall', 590, HB - 4), ('cypress', 452, HB)):
        B.paste(im, Image.open(os.path.join(TS, n + '.png')), x, yb)
    for spr, x, yb in row: B.cast_shadow(im, spr, x, yb, dx=-4, depth=6)
    for spr, x, yb in row: B.paste(im, spr, x, yb)
    # 생울타리 줄(저택 앞 대문 자리는 트임) + 대문 기둥
    hs = MG.autotile_hedge()
    B.paste(im, hedge_row(hs, 14), 0, HB + GV + 2)
    B.paste(im, hedge_row(hs, 13), 432, HB + GV + 2)
    B.paste(im, MB.gate_pier(), 214, HB + GV + 4); B.paste(im, MB.gate_pier(), 410, HB + GV + 4)
    B.paste(im, MP.urn_flowers(), 196, HB + GV); B.paste(im, MP.urn_flowers(), 428, HB + GV)
    # 가장자리 소품
    B.paste(im, MP.topiary('cone'), 8, 262); B.paste(im, MP.topiary('spiral'), 616, 262)
    B.paste(im, MP.statue_muse(), 50, 290); B.paste(im, MP.lamp_gilt_double(), 580, 300)
    B.paste(im, MP.topiary('ball'), 100, 236); B.paste(im, MP.topiary('ball'), 562, 236)
    B.paste(im, MP.easel_set(), 4, 338); B.paste(im, MP.poster_column(), 616, 338); B.paste(im, MP.urn_flowers(), 92, 330); B.paste(im, MP.bench_marble(), 548, 338)
    return im

if __name__ == '__main__':
    out = sys.argv[1] if len(sys.argv) > 1 else os.path.join(HERE, 'mansion-art-city.png')
    B.finish(make()).save(out); print(out, B.check(out))
