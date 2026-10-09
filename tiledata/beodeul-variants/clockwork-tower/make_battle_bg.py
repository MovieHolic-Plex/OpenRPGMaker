# 시계탑 내부 전투 배경 battle-bg.png (640×360, WAVE-BRIEF-3 A 절) + check-overlay.png.
# 구도: 위 = 참나무 들보 천장 띠 · 벽돌 벽 앞면(구리관·놋쇠 몰딩)에 박힌 거대한 문자판 뒷면(가운데 위)과 큰 벽 톱니 넷, 늘어진 추·진자 막대.
# 지평선 y≈178 = 벽 밑(참나무 징두리). 아래 = 참나무 널 바닥(ck_base.oak_plank 48 주기) + 뒤 끝 놋쇠 가루 띠.
# 가장자리 = 왼쪽 탈진기·톱니 기관 끝·기름통, 오른쪽 구리 보일러·탱크·태엽 드럼·고철 더미. 배틀러 자리(x 120~560, y 190~330)는 바닥만.
# 틀(띠·붙이기·색 줄이기)은 battle-bg-sky-machine/bb_common.py 를 읽기만 한다. 같은 입력 = 같은 그림.
import os, sys
OUT = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, OUT)
from ck_base import *
import ck_props1 as P1, ck_props2 as P2, ck_props3 as P3, ck_auto as AU
from mf_factory import gear_face
sys.path.insert(0, os.path.join(OUT, '..', 'battle-bg-sky-machine'))
import bb_common as BB
from PIL import ImageDraw
W, H = 640, 360
CEIL = 26; HZ = 178


def build():
    img = BB.canvas((12, 9, 14))
    edge = ck_ceiling((False, False, True, False, False, False, False, False), 0)
    full = ck_ceiling((False,) * 8, 0)
    for x in range(0, W, 16):
        img.alpha_composite(full, (x, CEIL - 32)); img.alpha_composite(edge, (x, CEIL - 16))
    Hw = HZ - CEIL; p = img.load()
    for y in range(Hw):
        for x in range(W):
            sty = 'ck_pipe' if (x // 160) % 2 == 0 else 'ck_brick'
            c = dlib.face_px('ck_brick', x + 4000, y, Hw, 3 + (x // 16) % 6, False, False)
            p[x, CEIL + y] = tuple(c[:3]) + (255,)
    # 벽 앞 구리관 두 줄(가로, 이음 테 16px) — 문자판 뒤로 지나간다
    tc = TC(W, Hw, 3); tc.a[:] = 0
    pipe_h(tc, 0, W, 40, 8, 'rust', step=32); pipe_h(tc, 0, W, 54, 4, 'brass', step=16, flange=False)
    for (cx, cy, r, n, mat, ph) in ((92, 70, 40, 22, 'brass', .1), (150, 34, 16, 14, 'steel', .4), (548, 72, 38, 22, 'brass', .6),
                                    (496, 36, 14, 12, 'steel', .2), (214, 92, 12, 12, 'brass', .3), (430, 94, 11, 10, 'brass', .5)):
        gear_face(tc, cx, cy, r, n, mat, ph, spokes=5 if r > 20 else 3, hub_mat='steel' if mat == 'brass' else 'brass')
    img.alpha_composite(tc.fin(.6), (0, CEIL))
    dial = P1.clock_dial(r=58)
    img.alpha_composite(dial, (320 - dial.width // 2, CEIL + 4))
    for (x, y) in ((250, CEIL + 2), (376, CEIL + 2)):
        img.alpha_composite(P2.counterweights(), (x, y)); img.alpha_composite(P2.chain_hang(), (x + 10, y + 30))
    for x in (40, 196, 444, 600): img.alpha_composite(P2.wall_lamp(), (x, CEIL + 98))
    # 바닥: 참나무 널 + 뒤 끝 놋쇠 가루(오토타일 가로 띠 = 동·서 이웃 칸)
    BB.tile_image(img, oak_plank(), HZ, H)
    dust = AU.autotile_dust()
    for x in range(0, W, 16):
        img.alpha_composite(dust.crop((10 % 4 * 16, 10 // 4 * 16, 10 % 4 * 16 + 16, 10 // 4 * 16 + 16)), (x, HZ))
    oil = AU.autotile_oil()
    for (x, y, n) in ((16, 300, 6), (32, 300, 12), (592, 286, 2), (608, 286, 8)):
        img.alpha_composite(oil.crop((n % 4 * 16, n // 4 * 16, n % 4 * 16 + 16, n // 4 * 16 + 16)), (x, y))
    # 벽 앞 뒤 끝 기계(발이 HZ+10 근처, 배틀러 자리 위쪽 끝까지만)
    BB.paste(img, P1.escapement(), 4, HZ + 18)
    BB.paste(img, P1.gear_train(), 70, HZ + 12)
    BB.paste(img, P2.axle_column(), 210, HZ + 10)
    BB.paste(img, P2.axle_column(), 414, HZ + 10)
    BB.paste(img, P2.copper_boiler(), 540, HZ + 14)
    BB.paste(img, P3.copper_tank(), 600, HZ + 18)
    BB.paste(img, P1.winding_drum(), 474, HZ + 10)
    # 앞 가장자리(배틀러 자리 밖)
    BB.paste(img, P3.oil_barrel(), 14, 264); BB.paste(img, P3.oil_barrel(), 30, 270); BB.paste(img, P3.gear_crate(), 70, 268)
    BB.paste(img, P3.cog_pile(), 4, 346); BB.paste(img, P3.broken_gear(), 40, 346)
    BB.paste(img, P3.gear_shelf(), 590, 262); BB.paste(img, P3.toolbox(), 572, 268)
    BB.paste(img, P3.cog_pile(), 604, 346); BB.paste(img, P3.oil_can(), 580, 340)
    BB.shade_rows(img, H - 20, H, .72)
    return img


def check_overlay(path_bg, path_out):
    bg = Image.open(path_bg).convert('RGBA')
    ov = Image.new('RGBA', bg.size, (0, 0, 0, 0)); d = ImageDraw.Draw(ov)
    d.rectangle((120, 190, 560, 330), outline=(255, 255, 255, 140))
    d.rectangle((0, H - 20, W, H), fill=(0, 0, 0, 120))
    for (x, y) in ((140, 196), (214, 228), (150, 272)): d.rectangle((x, y, x + 47, y + 47), fill=(230, 60, 60, 110), outline=(255, 120, 120, 230))
    for (x, y) in ((392, 200), (432, 232), (470, 262), (506, 290)): d.rectangle((x, y, x + 47, y + 47), fill=(60, 120, 240, 110), outline=(140, 180, 255, 230))
    bg.alpha_composite(ov); bg.convert('RGB').save(path_out)


if __name__ == '__main__':
    out = os.path.join(OUT, 'battle-bg.png')
    print('colors', BB.finish(build(), out))
    check_overlay(out, os.path.join(OUT, 'check-overlay.png'))
