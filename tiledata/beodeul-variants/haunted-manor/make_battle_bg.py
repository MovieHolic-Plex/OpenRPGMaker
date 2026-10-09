# 전투 배경 — 폐가 저택 연회장(haunted-manor). WAVE-BRIEF-3 A 절 규약: 640×360, 불투명, 색 ≤ 96, 낮·맑음 하나(실내라 촛불 밝기 하나).
# 원경(위 ~45%): 들보 천장 띠 → 바랜 다마스크 벽지와 판벽(hm_kit 'manor' 앞면을 높게 늘린 벽) — 가운데 무너진 층계참 아치와
#   부서진 큰 계단, 양옆 판자 친 창(해진 커튼)·빈 액자·벽 촛대, 왼쪽 벽난로, 오른쪽 괘종시계.
# 바닥(아래 ~50%): 바랜 대리석 바둑판(hm_checker) + 가운데 낡은 카펫 띠(autotile-carpet-worn) + 가장자리 먼지·거미줄·물 얼룩 덩이.
# 가장자리 물체: 왼쪽 앞 = 해진 날개 의자·켜진 촛대·덮개 의자, 오른쪽 앞 = 덮개 소파·까마귀 흉상·꺼진 촛대(배틀러 자리 x120~560, y190~330 밖).
# 그림 함수는 이 폴더의 hm_* 조각을 그대로 쓰고, 화면 조립·마감은 battle-bg-dungeon/bgkit.py(읽기만)를 쓴다.
#   python3 make_battle_bg.py → battle-bg.png, check-overlay.png, _qa/bg-qa.txt
import os, sys
_BG_DIR = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, _BG_DIR)
sys.path.insert(0, os.path.join(_BG_DIR, '..', 'battle-bg-dungeon'))
import numpy as np
from PIL import Image, ImageDraw
import bgkit as K
from hm_kit import *
from hm_kit import _hash
import hm_art1 as A1, hm_art2 as A2, hm_auto as AU
from gc_ext import autotile_mask, atile_img
HERE = _BG_DIR
assert HERE.endswith('haunted-manor')

HZ = 172                  # 벽 밑선(지평선)
CEIL = 18                 # 천장 들보 띠 아래선


GAL = 86                  # 위층 회랑 바닥 턱 윗선
BAND = 8


def wall(a):
    """천장 들보 띠 → 위층 회랑 벽(멀다, 한 단 어둡게) → 회랑 바닥 턱(검은 참나무 들보 띠) → 아래층 벽(벽지 + 판벽).
    hm_kit 'manor' 앞면 함수를 벽 높이 그대로 부른다. 가장자리로 갈수록 3단 어둡게(방 구석 그늘)."""
    for y in range(0, CEIL):
        for x in range(K.W):
            c = GW[2] if (x // 24 + y // 6) % 2 else GW[1]
            if y in (CEIL - 3, CEIL - 2): c = GW[4] if y == CEIL - 3 else GW[3]
            if y < 6: c = OUTL if (x + y) % 5 else (16, 14, 22)
            if (x % 48) in (0, 1) and y >= 6: c = GW[3]                         # 들보 끝 마구리
            a[y, x] = c
    for y in range(CEIL, GAL):
        for x in range(K.W): a[y, x] = mul(dlib.face_px('manor', x + 2000, y - CEIL, GAL - CEIL, 5, False, False), .8)
    for y in range(GAL, GAL + BAND):                                            # 회랑 바닥 턱(들보 윗면 + 앞 두께)
        for x in range(K.W):
            d = y - GAL
            c = GW[5] if d == 0 else (GW[4] if d < 3 else (GW[3] if d < 6 else (GW[2] if d == 6 else OUTL)))
            if d < 3 and _hash(x, y, 77) < .08: c = DU[3]
            a[y, x] = c
    for y in range(GAL + BAND, HZ):
        for x in range(K.W): a[y, x] = dlib.face_px('manor', x + 4000, y - GAL - BAND, HZ - GAL - BAND, 3, False, False)
    for x in range(K.W):
        d = min(x, K.W - 1 - x)
        k = .72 if d < 36 else (.84 if d < 90 else 1.0)
        if k < 1: a[CEIL:HZ, x] = (a[CEIL:HZ, x].astype(np.float32) * k).astype(np.uint8)
    a[HZ - 1, :] = OUTL


def back_props(a):
    P = K.paste_bl
    # 위층 회랑: 판자 친 창·빈 액자(멀다, 어둡게), 회랑 난간(부서진 난간 오토타일 가로 칸), 가운데는 무너져 끊겼다
    for x in (96, 200, 408, 512): P(a, A1.window_boarded(x), x, GAL - 2, dim=.78)
    for x in (152, 456): P(a, A1.portrait_empty(x), x, GAL - 26, dim=.8)
    for x in (264, 360): P(a, A1.portrait_oval(x), x, GAL - 30, dim=.8)
    bn = AU.autotile_banister()
    for x in range(0, K.W, 16):
        if 272 <= x < 368: continue                                             # 무너진 자리
        n = 2 + 8
        if x == 256: n = 8
        if x == 368: n = 2
        K.paste(a, atile_img(bn, n), x, GAL - 12, dim=.95)
    for (x, y, L) in ((276, GAL + 2, 7), (356, GAL + 1, 6)):                    # 부러져 늘어진 회랑 널 끝
        for i in range(L): a[y + i, x - i // 2] = GW[4]; a[y + i, x - i // 2 + 1] = GW[2]
    # 아래층: 가운데 부서진 큰 계단(발치가 지평선), 양옆 벽난로·괘종시계·벽 탁자·벽 촛대
    P(a, A1.grand_stair_broken(), 288, HZ + 2)
    P(a, A1.fireplace(), 152, HZ + 4)
    P(a, A1.grandfather_clock(), 456, HZ + 2)
    P(a, A1.console_table(), 488, HZ + 2)
    for x in (232, 392): P(a, A1.sconce_manor(lit=True), x, HZ - 40)
    for x in (72, 560): P(a, A1.window_boarded(x + 1), x, HZ - 4)
    for x in (96, 520): P(a, A2.cobweb_hanging(x), x, CEIL + 30)
    P(a, A2.cobweb_wall(0), 0, CEIL + 32)
    P(a, A2.cobweb_wall(1), K.W - 32, CEIL + 32)


def floor(a):
    s = SAMPLES['hm_checker']; sa = np.array(s.convert('RGB'))
    for y in range(HZ, K.H):
        for x in range(K.W):
            a[y, x] = sa[(y - HZ) % 48, x % 48]
    # 벽 밑 그늘 띠(두 단)
    K.shade_rows(a, HZ, HZ + 4, .62); K.shade_rows(a, HZ + 4, HZ + 10, .82)
    # 가운데 카펫 띠: 계단 발치(x 304~336)에서 앞으로 — 3칸 폭(48px), 오토타일 칸 그대로
    cp = AU.autotile_carpet()
    cells = {(x, y) for x in range(19, 21) for y in range(0, 12)}
    for (cx, cy) in cells:
        t = atile_img(cp, autotile_mask(cells, cx, cy))
        K.paste(a, t, cx * 16, HZ + cy * 16, cut=128, dim=.82)
    # 땅 덩이: 먼지·거미줄·물 얼룩을 양쪽 가장자리·뒤쪽에
    def lay(sheet, rows, x0, y0, dim=1.0):
        cells = {(i, j) for j, r in enumerate(rows) for i, ch in enumerate(r) if ch == '#'}
        im = new(16 * max(len(r) for r in rows), 16 * len(rows))
        for (i, j) in cells: im.alpha_composite(atile_img(sheet, autotile_mask(cells, i, j)), (i * 16, j * 16))
        base = Image.fromarray(a[y0:y0 + im.height, x0:x0 + im.width].copy()).convert('RGBA')
        base.alpha_composite(im.crop((0, 0, base.width, base.height)))
        a[y0:y0 + base.height, x0:x0 + base.width] = np.array(base.convert('RGB'))
    lay(AU.autotile_dust(), ["  ###  ", " ######", "#######", " ####  "], 0, HZ + 74)
    lay(AU.autotile_cobweb(), ["####", "### ", "##  ", "#   "], 0, HZ + 2)
    lay(AU.autotile_cobweb(), ["####", " ###", "  ##"], K.W - 64, HZ + 2)
    lay(AU.autotile_mildew(), [" ###  ", "######", " #### "], K.W - 96, HZ + 92)
    lay(AU.autotile_dust(), ["#####"], 136, HZ + 2)
    lay(AU.autotile_dust(), ["####"], 432, HZ + 2)


def front_props(a):
    P = K.paste_bl
    # 왼쪽 앞(배틀러 자리 왼쪽 밖): 해진 날개 의자·켜진 촛대·덮개 의자·떨어진 액자
    P(a, A2.armchair_torn(), 20, 262)
    P(a, A1.candelabra(lit=True), 70, 236)
    P(a, A2.chair_sheeted(), 8, 330)
    P(a, A1.portrait_fallen(), 56, 300)
    P(a, A1.plaster_debris(), 96, 318)
    # 오른쪽 앞: 덮개 소파·까마귀 흉상·꺼진 촛대·깨진 꽃병
    P(a, A2.sofa_sheeted(), 584, 270)
    P(a, A1.raven_bust(), 600, 338)
    P(a, A1.candelabra(lit=False), 572, 236)
    P(a, A1.vase_broken(), 566, 312)
    P(a, A1.chair_toppled(), 618, 300)
    # 뒤쪽(지평선 바로 밑, 배틀러 자리 위): 쓰러진 의자·회반죽 부스러기만 낮게
    P(a, A1.chair_toppled(), 220, HZ + 16)
    P(a, A1.plaster_debris(), 410, HZ + 18)


def build(out):
    a = K.canvas()
    wall(a); back_props(a); floor(a); front_props(a)
    # 빛 웅덩이는 넣지 않는다(벽지·바닥 위에 갈색 얼룩처럼 보였다) — 촛불 불꽃 화소만 밝다.
    a[K.H - 20:, :] = (a[K.H - 20:, :].astype(np.float32) * .55).astype(np.uint8)   # 맨 아래 20px: 하단 HUD 가 덮는다
    return K.finish(a, out, maxc=96)


def overlay(src, out):
    im = Image.open(src).convert('RGBA'); ov = Image.new('RGBA', im.size, (0, 0, 0, 0)); d = ImageDraw.Draw(ov)
    x0, y0, x1, y1 = K.SAFE
    d.rectangle((x0, y0, x1, y1), outline=(255, 255, 0, 200))
    for (x, y) in ((150, 210), (220, 250), (150, 280)): d.rectangle((x, y, x + 47, y + 47), fill=(230, 60, 60, 110), outline=(255, 90, 90, 230))
    for (x, y) in ((430, 205), (480, 235), (430, 265), (480, 290)): d.rectangle((x, y, x + 47, y + 47), fill=(60, 140, 230, 110), outline=(90, 170, 255, 230))
    d.rectangle((0, K.H - 20, K.W - 1, K.H - 1), fill=(0, 0, 0, 120))
    im.alpha_composite(ov); im.convert('RGB').save(out)


if __name__ == '__main__':
    out = os.path.join(HERE, 'battle-bg.png')
    r = build(out)
    overlay(out, os.path.join(HERE, 'check-overlay.png'))
    a = np.array(Image.open(out).convert('RGB'))
    base = float(a[200:320, 140:540].mean()) + 70
    os.makedirs(os.path.join(HERE, '_qa'), exist_ok=True)
    line = 'battle-bg.png %s colors=%d ok=%s bright_in_safe=%d' % (str(a.shape[1::-1]), r['colors'], r['ok'], K.safe_report(a, base))
    open(os.path.join(HERE, '_qa', 'bg-qa.txt'), 'w').write(line + '\n')
    print(line)
