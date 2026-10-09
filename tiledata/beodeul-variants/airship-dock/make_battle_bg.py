# 비행선 정박 부두 — 전투 배경 한 장(640×360, 낮·맑음) + check-overlay.png. 다시 돌리면 같은 그림.
# 틀(띠·붙이기·색 줄이기)은 battle-bg-sky-machine/bb_common 을 읽기만 하고, 그림은 이 장소 조각(parts/)·바닥 함수 그대로.
#   위 = 하늘 띠 4단 + 손으로 찍은 뭉게구름, 멀리 왼쪽 계류 탑에 매인 화물 비행선, 오른쪽 짐 기중기·급수탑
#   지평선 = 고원 끝 바위 턱 + 무쇠 난간, 그 너머 아래로 구름 바다
#   바닥 = 부두 널(ground-dock-planks 결) + 가장자리 빗물 웅덩이·석탄 가루, 가장자리 물체 = 상자 더미·통·가스등
import os, sys, math, random
OUT = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, OUT)
sys.path.insert(0, os.path.join(OUT, '..', 'battle-bg-sky-machine'))
import bb_common as BB
from ad_base import *
import ad_ground as G, ad_auto as AU
from PIL import ImageDraw

def part(n): return Image.open(os.path.join(OUT, 'parts', n + '.png')).convert('RGBA')

def puff_layer(cover, seed, step=12, rmin=5, rmax=18):
    puffs = SKM._puffs(BB.W, 200, cover, seed, step=step, rmin=rmin, rmax=rmax)
    tone, pid = SKM.paint_puffs(BB.W, 200, puffs, CL)
    a = np.zeros((200, BB.W, 4), np.uint8); m = tone >= 0
    a[m, :3] = np.array(CL, np.uint8)[np.clip(tone[m], 0, 6)]; a[m, 3] = 255
    return Image.fromarray(a, 'RGBA')

def build():
    img = BB.canvas()
    BB.bands(img, 0, 176, [SK[2], SK[3], SK[4], SK[5]], cuts=[40, 84, 124])
    # 높은 뭉게구름 셋(손으로 찍은 덩이, 가운데 위는 비운다)
    def hi(X, Y):
        v = 0.0
        for (cx, cy, rx, ry) in ((96, 34, 70, 18), (300, 22, 44, 10), (560, 48, 80, 20)):
            v = max(v, 1 - ((X - cx) / rx) ** 2 - ((Y - cy) / ry) ** 2)
        return v
    img.alpha_composite(puff_layer(hi, 31, step=11, rmin=5, rmax=14), (0, 0))
    # 지평선 아래 구름 바다(낭떠러지 너머 저 아래)
    def sea(X, Y): return 1.0 if 132 < Y < 200 else 0.0
    sl = puff_layer(sea, 37, step=10, rmin=6, rmax=16)
    img.alpha_composite(sl.crop((0, 0, BB.W, 182)), (0, 0))
    # 원경 왼쪽: 계류 탑 + 매인 비행선(옅게), 오른쪽: 기중기·급수탑
    air = BB.haze(part('airship_moored'), SK[4], .18, 24)
    mast = BB.haze(part('mooring_mast'), SK[4], .18, 14)
    BB.paste(img, mast, 18, 182)
    BB.paste(img, air, 18 + 40, 182 - 144 + 10 - 34 + 112)
    BB.paste(img, BB.haze(part('water_tank'), SK[4], .12, 12), 600, 184)
    BB.paste(img, BB.haze(part('cargo_crane'), SK[4], .12, 18), 548, 186)
    BB.paste(img, BB.haze(part('windsock'), SK[4], .15, 8), 480, 182)
    # 고원 끝: 바위 턱 줄 + 무쇠 난간(곧은 칸 반복, 가운데 한 군데 끊김)
    BB.tile_floor(img, 176, 190, lambda X, Y: G.rock_px(X, Y + 7))
    for x in range(0, BB.W, 2): img.putpixel((x, 176), ST[5] + (255,)); img.putpixel((x + 1, 176), ST[4] + (255,))
    rail = AU.railing_sheet()
    straight = rail.crop((10 % 4 * 16, 10 // 4 * 16, 10 % 4 * 16 + 16, 10 // 4 * 16 + 16))
    end_r = rail.crop((8 % 4 * 16, 8 // 4 * 16, 8 % 4 * 16 + 16, 8 // 4 * 16 + 16))
    end_l = rail.crop((2 % 4 * 16, 2 // 4 * 16, 2 % 4 * 16 + 16, 2 // 4 * 16 + 16))
    for x in range(0, BB.W, 16):
        if 288 <= x < 336: continue
        t = end_r if x == 272 else (end_l if x == 336 else straight)
        img.alpha_composite(t, (x, 172))
    # 전투 바닥: 부두 널(1x, 칩셋 널 결) + 가장자리 바위
    BB.tile_floor(img, 190, 360, lambda X, Y: G.plank_px(X, Y))
    BB.tile_floor(img, 188, 192, lambda X, Y: G.rock_px(X, Y + 21))
    for x in range(BB.W): img.putpixel((x, 191), ST[2] + (255,))
    a = np.array(img).astype(np.float32)                                   # 먼 널은 공기빛을 조금(띠 셋, 그라데이션 아님)
    for (y0, y1, t) in ((192, 210, .22), (210, 232, .12), (232, 256, .05)):
        a[y0:y1, :, :3] = a[y0:y1, :, :3] * (1 - t) + np.array(SK[5], np.float32) * t
    img = Image.fromarray(a.clip(0, 255).astype(np.uint8), 'RGBA')
    # 바닥 덩이(가장자리에만): 빗물 웅덩이 왼쪽 아래, 석탄 가루 오른쪽 아래
    pud = AU.puddle_sheet(); coal = AU.coal_sheet()
    for (sh, rows, ox, oy) in ((pud, ["XXX..", "XXXX.", ".XXX."], 8, 262), (coal, [".XXX", "XXXX", "XXX."], 572, 214)):
        st = AB.stamp(sh, rows, lambda x, y: Image.new('RGBA', (16, 16)))
        img.alpha_composite(st, (ox, oy))
    # 가장자리 물체(배틀러 자리 x 120~560, y 190~330 밖)
    BB.paste(img, part('crate_stack'), 0, 346)
    BB.paste(img, part('barrel_pair'), 50, 334)
    BB.paste(img, part('gas_lamp'), 98, 288)
    BB.paste(img, part('sack_pile'), 46, 300)
    BB.paste(img, part('crate_pair'), 600, 344)
    BB.paste(img, part('coal_heap'), 566, 340)
    BB.paste(img, part('gas_lamp'), 600, 270)
    BB.paste(img, part('bollard'), 584, 288)
    BB.shade_rows(img, 340, 360, .72)
    return img

if __name__ == '__main__':
    img = build()
    n, m = BB.finish(img, os.path.join(OUT, 'battle-bg.png'))
    # check-overlay: 가짜 전투원(적 3 왼쪽, 아군 4 오른쪽 아래, 48×48 반투명) + 배틀러 자리 + HUD
    bg = Image.open(os.path.join(OUT, 'battle-bg.png')).convert('RGBA')
    ov = Image.new('RGBA', bg.size, (0, 0, 0, 0)); d = ImageDraw.Draw(ov)
    d.rectangle((120, 190, 560, 330), outline=(255, 255, 255, 140)); d.rectangle((0, 340, 640, 360), fill=(0, 0, 0, 120))
    for (x, y) in ((140, 196), (214, 228), (150, 272)): d.rectangle((x, y, x + 47, y + 47), fill=(230, 60, 60, 110), outline=(255, 120, 120, 230))
    for (x, y) in ((392, 200), (432, 232), (470, 262), (506, 290)): d.rectangle((x, y, x + 47, y + 47), fill=(60, 120, 240, 110), outline=(140, 180, 255, 230))
    bg.alpha_composite(ov); bg.convert('RGB').save(os.path.join(OUT, 'check-overlay.png'))
    print('battle-bg colors', n, '->', m)
