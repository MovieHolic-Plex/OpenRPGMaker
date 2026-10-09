# 증기 도시 전투 배경(640x360, 낮·맑음) — WAVE-BRIEF-3 A 절. 그림은 이 장소 조각 그대로(sc_build·sc_props·sc_ground).
# 원경: 매연 낀 황회 하늘 띠 5단 + 손 도트 증기 덩이, 굴뚝·지붕 실루엣 두 겹(먼 창 불빛 점), 오른쪽 뒤로 솟은 시계탑.
# 뒷줄(지평선 y≈185): 벽돌 줄집·가게(놋쇠 관), 왼쪽 보일러 집·굴뚝. 바닥: 벽돌 보도 2줄 + 연석 + 젖은 검은 자갈 차도(sc_ground.compose),
# 가장자리에만 가스등·소화전·석탄 마차·기름통, 기름 번짐·증기 고인 물 덩이(오토타일). 가운데 아래(x120~560, y190~330)는 비운다.
import os, sys
sys.dont_write_bytecode = True
HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, HERE)
sys.path.insert(0, os.path.join(HERE, '..', 'battle-bg-town'))
import numpy as np
from PIL import Image, ImageDraw
import bgcommon as B                                           # 하늘 띠·구름·능선·붙이기·96색 마무리(읽기만)
from sc_base import *
import sc_build as SB, sc_props as SP, sc_ground as SG, sc_auto as SA, sc_meta as M
from ec_base import cell_of
HERE = os.path.dirname(os.path.abspath(__file__))

HB = 185


def skyline(im, ybase, amp, face, top, seed, lit=0.0):
    """지붕·굴뚝 실루엣: 4~7px 단 계단 지붕 + 드문 굴뚝 기둥(2~4px) + 먼 창 불빛 점."""
    px = im.load(); x = 0; rng = np.random.RandomState(seed)
    while x < 640:
        w = 18 + int(rng.rand() * 30); h = int(amp * (.45 + .55 * rng.rand()))
        gable = rng.rand() < .5
        for xx in range(x, min(640, x + w)):
            hh = h - (abs(xx - x - w / 2) * .6 if gable else 0)
            y0 = int(ybase - hh)
            for y in range(max(0, y0), ybase): px[xx, y] = face
            if 0 <= y0 < 360: px[xx, y0] = top
        if rng.rand() < .55:
            cx = x + 3 + int(rng.rand() * (w - 6)); ch = 8 + int(rng.rand() * 14)
            for xx in range(cx, cx + 3):
                for y in range(int(ybase - h - ch), int(ybase - h + 2)):
                    if 0 <= y < 360 and xx < 640: px[xx, y] = face
            for xx in range(cx - 1, min(640, cx + 4)): px[xx, int(ybase - h - ch)] = top
        if lit:
            for k in range(int(w * lit)):
                lx = x + 2 + int(rng.rand() * (w - 4)); ly = int(ybase - 4 - rng.rand() * (h - 8))
                if 0 <= ly < 360 and lx < 640: px[lx, ly] = hx('#c88a3a') + (255,)
        x += w


def make():
    im = B.new()
    B.sky(im, [(30, '#6e6658'), (64, '#837a66'), (98, '#9a8f74'), (130, '#ae a284'.replace(' ', '')), (HB, '#bfb392')])
    for (cx, cy, w, h, s) in ((96, 34, 84, 14, 81), (330, 18, 60, 10, 82), (520, 44, 72, 12, 83), (210, 60, 44, 8, 84)):
        B.cloud(im, cx, cy, w, h, s, ('#e4e0d4', '#c8c2b2', '#a29a86'))
    skyline(im, HB - 40, 34, hx('#7a7066') + (255,), hx('#8c8276') + (255,), 91)
    skyline(im, HB - 26, 40, hx('#5c5450') + (255,), hx('#70665e') + (255,), 92, lit=.08)
    # 시계탑(오른쪽 뒤, 아랫부분은 줄집·바닥에 가린다) + 큰 굴뚝 둘(왼쪽 뒤)
    B.paste(im, SB.clock_tower(3), 560, 224)              # 꼭대기 장식 = 화면 위 끝, 받침 아래는 지평선 뒤
    B.paste(im, SB.brick_chimney(4, 128), 150, HB - 30); B.paste(im, SB.brick_chimney(7, 112), 214, HB - 34)
    for (x, y, s) in ((146, 26, 1), (210, 44, 2), (470, 30, 3)):
        im.alpha_composite(steam_cloud(40, 30, s + 50, 255), (x - 4, max(0, y - 20)))
    # 바닥: 원 장소 compose — 0줄 벽돌 보도(연석), 1~4줄 젖은 자갈 차도, 5줄~ 시계탑 광장 판석(아래 60% 가 한 재질로 단조롭지 않게)
    Wc, Hc = 40, 12
    Mk = {k: np.zeros((Hc, Wc), bool) for k in SG.LAYERS}; Mk['walk'][0:1, :] = True; Mk['plaza'][5:, :] = True   # 보도 → 차도 3줄 → 광장 판석
    g = np.array(SG.compose(Wc, Hc, Mk, seed=4).convert('RGB'))
    a = np.array(im); a[HB:, :, :3] = g[:360 - HB, :640]; im.paste(Image.fromarray(a, 'RGBA'))
    # 오토타일 덩이(가장자리만): 기름 번짐(왼쪽 앞), 증기 고인 물(오른쪽 앞)
    for (name, cells_, ox, oy) in (('autotile-oil-slick', [".XX.", "XXXX", ".XXX", "..X."], 0, 15),
                                   ('autotile-steam-puddle', [".XXX", "XXXX", ".XX."], 36, 17)):
        sh = SA.SHEETS[name]()
        cs = {(i, j) for j, r in enumerate(cells_) for i, c in enumerate(r) if c == 'X'}
        for (i, j) in cs:
            n = (1 if (i, j - 1) in cs else 0) | (2 if (i + 1, j) in cs else 0) | (4 if (i, j + 1) in cs else 0) | (8 if (i - 1, j) in cs else 0)
            im.alpha_composite(cell_of(sh, n), ((ox + i) * 16 - 8, HB - 16 + (oy - 12 + j) * 16 + 4 * 16 - 64))
    # 뒷줄: 보일러 집(왼쪽) + 벽돌 줄집·가게(가운데·오른쪽, 시계탑 앞은 낮은 가게)
    row = [(SB.boiler_house(5), -34)]
    x = 94
    for n in ('house_brick_3', 'shop_awning_red_4', 'house_mansard_verd_4', 'house_brick_balcony_5', 'shop_awning_verd_3', 'house_brick_copper_4'):
        row.append((M.house(n), x)); x += M.house(n).width
    row.append((M.house('house_brick_3').transpose(Image.FLIP_LEFT_RIGHT), x)); x += 48
    for spr, xx in row: B.cast_shadow(im, spr, xx, HB, dx=-4, depth=6)
    for spr, xx in row: B.paste(im, spr, xx, HB)
    # 가장자리 소품(가운데 아래 비움)
    B.paste(im, SP.gas_lamp(), 70, 246); B.paste(im, SP.gas_lamp(), 578, 246)
    B.paste(im, SP.steam_hydrant(), 100, 232); B.paste(im, SP.pillar_box(), 600, 236)
    B.paste(im, SP.coal_cart(2), 2, 330); B.paste(im, SP.coal_sacks(3), 46, 338)
    B.paste(im, SP.oil_barrels(4), 590, 330); B.paste(im, SP.crates_brass(5), 560, 340)
    B.paste(im, SP.steam_vent(6), 16, 264); B.paste(im, SP.standpipe(7), 616, 300)
    return im


ENEMY = [(150, 196), (100, 250), (176, 282)]
ALLY = [(410, 196), (466, 226), (420, 262), (480, 290)]


def check_overlay(bg_path, out):
    bg = Image.open(bg_path).convert('RGBA')
    ov = Image.new('RGBA', bg.size, (0, 0, 0, 0)); d = ImageDraw.Draw(ov)
    for (x, y) in ENEMY: d.rectangle((x, y, x + 47, y + 47), fill=(230, 40, 40, 110), outline=(255, 90, 90, 255))
    for (x, y) in ALLY: d.rectangle((x, y, x + 47, y + 47), fill=(40, 120, 240, 110), outline=(110, 170, 255, 255))
    d.rectangle((120, 190, 560, 330), outline=(255, 230, 60, 255))
    d.line((0, 165, 639, 165), fill=(255, 255, 255, 120)); d.line((0, 185, 639, 185), fill=(255, 255, 255, 120))
    d.rectangle((0, 340, 639, 359), fill=(0, 0, 0, 150))
    bg.alpha_composite(ov); bg.convert('RGB').save(out)


def compare(bg_path, out):
    """[전투 배경 | 같은 장소 맵 렌더 1x 크롭(북쪽 줄집 + 큰 길)] 2배."""
    a = Image.open(bg_path).convert('RGB'); b = Image.open(os.path.join(HERE, 'render-1x.png')).convert('RGB').crop((0, 0, 640, 360))
    o = Image.new('RGB', (640 * 2 * 2 + 30, 360 * 2 + 30), (28, 28, 34)); d = ImageDraw.Draw(o)
    d.text((10, 6), 'battle-bg.png', fill=(230, 230, 230)); d.text((640 * 2 + 20, 6), 'render-1x.png crop (same place)', fill=(230, 230, 230))
    o.paste(a.resize((1280, 720), Image.NEAREST), (10, 22)); o.paste(b.resize((1280, 720), Image.NEAREST), (1300, 22))
    o.save(out)


if __name__ == '__main__':
    out = os.path.join(HERE, 'battle-bg.png')
    B.finish(make()).save(out); print(out, B.check(out))
    check_overlay(out, os.path.join(HERE, 'check-overlay.png'))
    compare(out, os.path.join(HERE, 'compare-battle.png'))
