# beodeul-port — 버들항 로마풍 항구 앞 광장. 원경: 하늘 띠·구름·건너편 곶, 먼 바다에 돛배(돛대), 부두 돌 가장자리.
# 뒷줄: 버들항 붉은 기와 반목조 집(원본 조각 화소 그대로) 왼쪽·오른쪽 덩이, 가운데는 바다로 트임. 바닥: 버들항 포룸 트래버틴 판석.
import os, sys
sys.dont_write_bytecode = True
HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, HERE); sys.path.insert(0, os.path.join(HERE, 'src-beodeul'))
import numpy as np
from PIL import Image
import bgcommon as B
import bd_ground as G

SP = os.path.join(HERE, 'src-beodeul', 'sprites')
def S(n): return Image.open(os.path.join(SP, n + '.png')).convert('RGBA')

HZ = 120          # 바다 수평선
QY = 176          # 부두 앞 가장자리(뒷줄 집 밑줄)

def make():
    im = B.new()
    B.sky(im, [(34, '#5f9bcc'), (70, '#79b0da'), (98, '#97c6e4'), (HZ, '#b9dcec')])
    for (cx, cy, w, h, s) in ((96, 40, 70, 13, 1), (300, 26, 54, 10, 2), (512, 52, 84, 15, 3), (430, 18, 36, 7, 4), (205, 74, 40, 8, 5)):
        B.cloud(im, cx, cy, w, h, s)
    # 건너편 곶(왼쪽·오른쪽 끝) — 먼 산은 푸른 회색 한 단
    B.ridge(im, HZ + 1, 16, ('#6f9aa8', '#8db4be', '#5d8794'), 11, 0, 230, step=3)
    B.ridge(im, HZ + 1, 22, ('#6f9aa8', '#8db4be', '#5d8794'), 12, 430, 640, step=3)
    # 바다: 버들항 물 그림(애니 0프레임) 가로 띠를 이어 붙인다
    wat = np.array(S('water_crop'))
    band = wat[:48, :640, :3]
    sea = np.concatenate([band] * 2, 0)[:QY - HZ]
    arr = np.array(im); arr[HZ:QY, :, :3] = sea; im.paste(Image.fromarray(arr, 'RGBA'))
    # 먼 바다 수평선 위 1줄 밝은 띠(빛 반사)
    px = im.load()
    # 먼 바다: 수평선 쪽 세 줄 띠를 한 단씩 밝게(거리감), 띠 경계는 계단
    for (y0, y1, col) in ((HZ, HZ + 3, (126, 176, 186)), (HZ + 3, HZ + 7, (74, 134, 144)), (HZ + 7, HZ + 12, (44, 102, 110))):
        for x in range(640):
            for y in range(y0, y1 + ((x // 9) % 2)):
                r, g, b, _ = px[x, y]
                if y < y1 or (r + g + b) > 120: px[x, y] = col + (255,)
    for x in range(640):
        if (x // 7) % 3 != 0: px[x, HZ] = (170, 212, 220, 255)
    # 돛배·고깃배(원본 화소)
    B.paste(im, S('boat_ship_0'), 236, QY - 2)
    B.paste(im, S('boat_rowboat_0'), 372, QY - 1)
    B.paste(im, S('boat_rowboat_0'), 196, QY - 3, flip=True)
    # 부두 돌 가장자리: 버들항 회색 판석 + 바다 쪽 어두운 갓돌 줄
    quay = G.field(G.tex_flag, 640, 12, 0, 3)
    arr = np.array(im); arr[QY:QY + 12, :, :3] = quay
    arr[QY, :, :3] = G.ST[1][:3]; arr[QY + 1, :, :3] = G.ST[5][:3]
    # 광장 바닥(트래버틴) y QY+12 ..
    plaza = G.field(G.tex_travertine, 640, 360 - QY - 12, 5, 7)
    arr[QY + 12:, :, :3] = plaza
    arr[QY + 11, :, :3] = G.ST[3][:3]
    # 집 앞 회색 판석 길(폭 26) + 트래버틴과 만나는 연석 2줄(버들항 paving5 연석 규칙)
    street = G.field(G.tex_flag, 640, 26, 0, 40)
    arr[QY + 12:QY + 38, :, :3] = street
    for x in range(640):
        arr[QY + 38, x, :3] = G.ST[1][:3]
        arr[QY + 39, x, :3] = (G.ST[5] if (x // 6) % 2 else G.ST[4])[:3]
        arr[QY + 40, x, :3] = (G.ST[5] if (x // 6) % 2 else G.ST[4])[:3]
    im.paste(Image.fromarray(arr, 'RGBA'))
    for bx in (232, 300, 372, 404):
        B.paste(im, S('mooring_bollard'), bx, QY + 12)
    # 뒷줄 집: 왼쪽 덩이 / 오른쪽 덩이(가운데 바다로 트임)
    left = [('h104_1', -36), ('h102_1', 88), ('h101_2', 166)]
    right = [('h107_1', 440), ('inn', 548)]
    for n, x in left + right:
        spr = S(n); B.cast_shadow(im, spr, x, QY + 12, dx=-4, depth=6)
    for n, x in left + right:
        B.paste(im, S(n), x, QY + 12)
    B.paste(im, S('cypress'), 210, QY + 12)
    B.paste(im, S('tree_round'), 402, QY + 14)
    # 가장자리 소품(가운데 아래는 비운다)
    B.paste(im, S('lamp_double'), 70, 262); B.paste(im, S('lamp_double'), 578, 262)
    B.paste(im, S('stall_veg'), 2, 238)
    B.paste(im, S('fish_crates'), 14, 300); B.paste(im, S('fish_barrel'), 50, 304); B.paste(im, S('crate_fish'), 36, 322)
    B.paste(im, S('net_rack'), 596, 234); B.paste(im, S('goods_pile'), 600, 314); B.paste(im, S('anchor_display'), 566, 336)
    B.paste(im, S('planter_round'), 112, 214); B.paste(im, S('planter_round'), 520, 214)
    B.paste(im, S('tree_planter'), 84, 226); B.paste(im, S('tree_planter'), 540, 226)
    B.paste(im, S('tree_small'), 600, 296); B.paste(im, S('bench_wood'), 2, 338)
    return im

if __name__ == '__main__':
    out = sys.argv[1] if len(sys.argv) > 1 else os.path.join(HERE, 'beodeul-port.png')
    B.finish(make()).save(out); print(out, B.check(out))
