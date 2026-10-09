# 등불 수향 마을 전투 배경 battle-bg.png (640x360, 낮·맑음) + check-overlay.png. 다시 돌리면 같은 그림.   python3 make_battle_bg.py
# 원경(y 0~165): 청회 하늘 띠 4단 + 손 구름 + 먹빛 봉우리 두 겹(wuxia 규격 4) → 운하 건너 흰 벽 민가 줄(마두벽)·아치 돌다리·버드나무.
# 지평선(165~186): 운하 물 띠 + 막돌 둑. 바닥(186~340): 이 장소의 화강암 판석(ground-flagstone 결) + 젖은 판 덩이.
# 가장자리: 왼쪽 버드나무·물독, 오른쪽 홍등 기둥·술독·분재. 가운데 아래(120~560, 190~330)는 비운다.
import os, sys
sys.dont_write_bytecode = True
HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, HERE); sys.path.insert(0, os.path.join(HERE, 'src-battle-bg-town'))
import numpy as np
from PIL import Image, ImageDraw
import bgcommon as BG
import lr_ground as LG, lr_build as B, lr_props as P
from lr_base import hash2

BANK = 172        # 둑 갓돌 윗줄(뒷줄 집 밑)
WAT0, WAT1 = 176, 186
GY = 186


def make():
    im = BG.new()
    BG.sky(im, [(38, '#8db3c9'), (78, '#a2c2d4'), (118, '#b8d1de'), (WAT0, '#cadde6')])
    for (cx, cy, w, h, sd) in ((96, 34, 70, 12, 201), (520, 28, 84, 14, 202), (330, 16, 40, 8, 203), (420, 62, 44, 9, 204)):
        BG.cloud(im, cx, cy, w, h, sd, cols=('#f4f8fa', '#dbe6ec', '#aebfcb'))
    BG.ridge(im, 150, 92, ('#8697a3', '#9eadb7', '#77898f'), 311, step=3, period=(150, 61, 23))          # 먼 먹빛 봉우리
    BG.ridge(im, 156, 52, ('#5f707a', '#73848d', '#53636c'), 312, step=3, period=(90, 37, 15))           # 가까운 봉우리
    # 운하 건너 뒷줄: 흰 벽 민가 + 버드나무 + 아치 돌다리
    row = [('h', B.house_white(5, 2, 51), -20), ('w', P.willow(51), 54), ('h', B.house_white(4, 1, 52), 98), ('h', B.house_white(4, 1, 56), 262), ('h', B.house_white(6, 2, 53), 330),
           ('w', P.willow(52, flip_=True), 424), ('h', B.house_white(5, 1, 54), 468), ('h', B.house_white(4, 2, 55), 556)]
    for kind, spr, x in row:
        if kind == 'h': BG.paste(im, spr, x, BANK + 2)
    br = B.arch_bridge(7)
    BG.paste(im, br.crop((0, 0, br.width, 74)), 168, WAT1 + 2)
    # 물 띠 + 둑
    arr = np.array(im)
    Y, X = np.mgrid[0:WAT1 - WAT0, 0:640]
    canal = LG.autotile_canal()
    c15 = np.array(canal.crop((15 % 4 * 16, 15 // 4 * 16, 15 % 4 * 16 + 16, 15 // 4 * 16 + 16)).convert('RGB'))
    wat = np.tile(c15, (2, 40, 1))[:WAT1 - WAT0, :640]
    keep = arr[WAT0:WAT1, :, 3].copy()
    region = arr[WAT0:WAT1, :, :3]
    bridge_cols = np.zeros(640, bool); bridge_cols[168:168 + br.width] = True
    sel = ~bridge_cols[None, :].repeat(WAT1 - WAT0, 0)
    region[sel] = wat[sel]
    arr[WAT0:WAT0 + 2, ~bridge_cols, :3] = (arr[WAT0:WAT0 + 2, ~bridge_cols, :3].astype(int) * .55).astype(np.uint8)   # 둑 밑 물 그늘
    # 뒷 둑 갓돌(집 밑 줄)
    for y in range(BANK + 2, WAT0):
        for x in range(640):
            if bridge_cols[x]: continue
            k = 5 if y == BANK + 2 else (4 if (x // 11 + y) % 9 else 2)
            arr[y, x, :3] = LG.GRANa[k]
    im = Image.fromarray(arr, 'RGBA')
    for kind, spr, x in row:
        if kind == 'w': BG.paste(im, spr, x, BANK + 2)
    BG.paste(im, br.crop((0, 0, br.width, 74)), 168, WAT1 + 2)
    # 바닥: 화강암 판석(이 장소 결) + 앞 둑 연석 줄 + 젖은 판 덩이
    Yg, Xg = np.mgrid[0:360 - GY, 0:640]
    T, lxo, ly, wo = LG.slab_k(Xg, Yg + 2, 16, LG.SLAB_SEED, tone48=True)
    T = np.where(T > 1, np.clip(T + 1, 1, 5), T)                                  # 낮 햇빛에 한 단 밝게(줄눈은 그대로)
    rgb = LG.GRANa[T]
    # 양쪽 아래 구석 = 풀 둔덕(이 장소 ground-grass 결) + 판석 끝 연석
    gr = np.array(LG.ground_grass().convert('RGB')).astype(int)
    grass = np.tile(gr, (4, 14, 1))[:360 - GY, :640]
    edgeL = 92 + 18 * np.sin(Yg / 13.0) - (Yg - 90) * .55
    edgeR = 548 - 14 * np.sin(Yg / 11.0 + 1) + (Yg - 100) * .5
    gm = ((Xg < edgeL) & (Yg > 70)) | ((Xg > edgeR) & (Yg > 90))
    rgb = np.where(gm[..., None], grass, rgb)
    kerb = ~gm & (np.roll(gm, 1, 1) | np.roll(gm, -1, 1) | np.roll(gm, 1, 0) | np.roll(gm, 2, 1) | np.roll(gm, -2, 1))
    rgb = np.where(kerb[..., None], LG.GRANa[np.where(Yg % 6 == 0, 2, 5)], rgb)
    a = np.array(im); a[GY:, :, :3] = rgb
    a[GY:GY + 2, :, :3] = LG.GRANa[5]; a[GY + 2, :, :3] = LG.GRANa[2]
    im = Image.fromarray(a, 'RGBA')
    # 가장자리 물체
    for (spr, x, yb, fl) in ((P.willow(53), -8, 330, False), (P.willow(60, flip_=True), 590, 344, False), (P.water_jar(5), 70, 334, False), (P.water_jar(6, lid=False), 56, 342, False),
                             (P.lantern_post(54, h=4), 566, 300, False), (P.wine_jars(55), 584, 344, False), (P.potted_pine(56), 90, 300, False),
                             (P.lantern_post(57), 22, 236, False), (P.stone_lion(58, flip_=True), 612, 236, False), (P.reed_clump(59), 96, 200, False)):
        BG.cast_shadow(im, spr, x, yb)
        BG.paste(im, spr, x, yb, flip=fl)
    return im


def check_overlay(path):
    ENEMY = [(150, 196), (100, 250), (176, 282)]
    ALLY = [(410, 196), (466, 226), (420, 262), (480, 290)]
    bg = Image.open(path).convert('RGBA')
    ov = Image.new('RGBA', bg.size, (0, 0, 0, 0)); d = ImageDraw.Draw(ov)
    for (x, y) in ENEMY: d.rectangle((x, y, x + 47, y + 47), fill=(230, 40, 40, 110), outline=(255, 90, 90, 255))
    for (x, y) in ALLY: d.rectangle((x, y, x + 47, y + 47), fill=(40, 120, 240, 110), outline=(110, 170, 255, 255))
    d.rectangle((120, 190, 560, 330), outline=(255, 230, 60, 255))
    d.line((0, 165, 639, 165), fill=(255, 255, 255, 120)); d.line((0, 185, 639, 185), fill=(255, 255, 255, 120))
    d.rectangle((0, 340, 639, 359), fill=(0, 0, 0, 150))
    d.text((4, 3), 'lantern-river-town', fill=(255, 255, 255, 255))
    bg.alpha_composite(ov)
    bg.convert('RGB').save(os.path.join(HERE, 'check-overlay.png'))


if __name__ == '__main__':
    out = os.path.join(HERE, 'battle-bg.png')
    BG.finish(make()).save(out)
    print(out, BG.check(out))
    check_overlay(out)
