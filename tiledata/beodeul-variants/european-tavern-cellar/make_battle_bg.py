# 전투 배경 — 선술집 지하 석실(european-tavern-cellar). WAVE-BRIEF-3 A 절: 640x360, 불투명, 색 <= 96,
# 배틀러 자리(x 120~560, y 190~330)에 키 큰 물체·밝은 점 금지, 맨 아래 20px 은 HUD 가림, 블러·안티앨리어싱 금지.
# 원경: 둥근 궁륭 천장(쐐기돌 갈빗대) 셋 칸 + 돌기둥 둘, 뒤 벽(지도 벽 앞면 함수 그대로)에 포도주 선반·통 더미·가운데 위층으로 오르는 계단 아치·벽 촛대.
# 바닥: 지도와 같은 막돌 판석. 가장자리: 왼쪽 세운 통 넷·자루, 오른쪽 꼭지 단 술통·눕힌 통·물통.
#   python3 make_battle_bg.py   → battle-bg.png, check-overlay.png, _qa/battle-compare.png
import os, sys
HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, HERE)
sys.path.insert(1, os.path.join(HERE, '..', 'battle-bg-dungeon'))
import numpy as np
from PIL import Image, ImageDraw
import bgkit as K                                    # 화면 조립·마감 도구(읽기만)
from tc_base import *
from tc_base import _hash, flag_px, ashlar_px
import tc_parts as TP
S = TP.S

HZ = 172                                             # 벽 밑선(지평선)
a = K.canvas(VOIDC[0])

# ---- 바닥: 지도와 같은 판석(칸 단위 주기 표본), 벽 밑 그늘 띠, 앞으로 올수록 한 단 밝다가 맨 아래 HUD 자리는 어둡게
for y in range(HZ, K.H):
    for x in range(K.W):
        c = flag_px(x % 48, (y - HZ) % 48)
        if y < HZ + 6: c = mul(c, .55 + .07 * (y - HZ))
        if y > 340: c = mul(c, .7)
        a[y, x] = c

# ---- 뒤 벽: 지도 벽 앞면(tc_cellar/tc_damp) 함수를 그대로, 높이 HZ-40
WALL0 = 40
for y in range(WALL0, HZ):
    for x in range(K.W):
        damp = x < 200
        c = ashlar_px(x, y - WALL0, HZ - WALL0, damp=damp)
        if y < WALL0 + 3: c = (TRIM[3], mul(c, .62), mul(c, .78))[y - WALL0]
        if y >= HZ - 3: c = (mul(c, .76), mul(c, .5), SHADE)[y - (HZ - 3)]
        a[y, x] = c

# ---- 궁륭: 세 칸, 기둥 사이 둥근 쐐기돌 갈빗대. 갈빗대 위는 어둠.
PIL_X = [(196, 22), (422, 22)]
BAYS = [(-40, 196), (218, 422), (444, 680)]
for (x0, x1) in BAYS:
    for x in range(max(0, x0), min(K.W, x1)):
        t = (x - x0 + .5) / (x1 - x0)
        ya = int(round(WALL0 + 44 - 44 * math.sin(math.pi * t) ** .7))            # 갈빗대 아래 선
        for y in range(0, ya + 1):
            a[y, x] = VOIDC[0] if _hash(x, y, 7) < .9 else VOIDC[1]
        for y in range(max(0, ya - 6), ya + 1):                                    # 쐐기돌 띠(6px)
            d = ya - y
            k = 4 if ((x - x0) // 14) % 2 else 3
            if d == 6: k = 1
            elif d == 0: k = 2
            elif d == 5: k = 5
            a[y, x] = TRIM[k]
for (px_, w) in PIL_X:                                                             # 돌기둥(지도 돌기둥 결)
    for y in range(0, HZ + 4):
        for x in range(px_, px_ + w):
            k = cyl_k(x, px_, px_ + w) - 1
            if (y + 2) % 10 == 0: k -= 1
            if _hash(x, y, 9) < .05: k -= 1
            a[y, x] = TRIM[clamp(k, 1, 6)]
    for y in range(HZ - 6, HZ + 6):                                                # 받침 돌
        for x in range(px_ - 4, px_ + w + 4):
            k = 4 if y < HZ - 3 else (3 if x < px_ + w + 1 else 2)
            if y == HZ + 5: k = 1
            a[y, x] = TRIM[k]

# ---- 벽에 붙은 것(지도 조각을 1배로): 왼쪽 칸 포도주 선반 셋, 가운데 위층 계단 아치, 오른쪽 칸 통 더미·치즈 시렁
def put(name, x, ybot, dim=1.0, flip=False):
    K.paste_bl(a, S[name], x, ybot, dim=dim, flip=flip)
put('wine_rack', 14, HZ + 2); put('wine_rack_half', 50, HZ + 2); put('barrel_upright', 86, HZ + 4); put('wine_rack', 104, HZ + 2); put('wine_rack', 140, HZ + 2); put('bottle_crate', 174, HZ + 4)
put('stair_up', 304, HZ + 20)                                                     # 아래 1칸은 바닥 자리(지평선 아래 20px)
put('candle_sconce', 270, 112); put('candle_sconce', 354, 112)
put('candle_sconce', 168, 112); put('candle_sconce', 470, 112)
put('mug_sign', 288, 96)
put('cheese_rack', 452, HZ + 2); put('barrel_upright', 486, HZ + 4); put('barrel_stack', 506, HZ + 6); put('barrel_cluster', 560, HZ + 8); put('hanging_meat', 600, 116); put('dish_shelf', 236, 120); put('painting', 384, 112)
put('cobweb', 0, 64 + 16)

# ---- 앞 가장자리 물건(배틀러 자리 밖)
put('barrel_cluster', 6, 262); put('sack_pile', 38, 300); put('crate_stack', 72, 238); put('barrel_upright', 92, 330)
put('keg_tap', 574, 260); put('barrel_lying', 590, 300); put('bucket', 566, 330); put('crate', 604, 228)

# ---- 바닥 물 웅덩이(어두운 물, 배틀러 자리 밖 아래 가장자리)
for (cx, cy, rx, ry) in ((60, 330, 34, 9), (600, 346, 30, 7)):
    for y in range(cy - ry - 1, cy + ry + 2):
        for x in range(cx - rx - 1, cx + rx + 2):
            if not (0 <= x < K.W and 0 <= y < K.H): continue
            wob = 1 + .12 * math.sin(x * .3) + .08 * math.sin(y * .9 + x * .1)
            d = ((x - cx) / (rx * wob)) ** 2 + ((y - cy) / ry) ** 2
            if d > 1: continue
            c = PUD[1] if d > .78 else (PUD[2] if d > .55 else PUD[3])
            if d < .5 and y % 3 == 1 and _hash(x // 3, y, 41) > .8: c = PUD[5]
            a[y, x] = c

# ---- 촛불 빛 웅덩이(벽 위, 단계 3개 — 색 수를 늘리지 않게)
pal = K.palette_of(a, [AMBER[k] for k in range(7)] + [mix(c, AMBER[4], .2) for c in ASH] + [mix(c, AMBER[4], .35) for c in ASH])
for (cx, cy) in ((276, 104), (360, 104), (174, 104), (476, 104)):
    K.glow_steps(a, cx, cy, 40, AMBER[4], pal, steps=((1.0, .10), (.55, .18)))
K.glow_steps(a, 320, 70, 50, AMBER[4], pal, steps=((1.0, .08),))                   # 위층 계단에서 새는 빛

# ---- 맨 아래 HUD 가림 줄
a[340:, :] = (a[340:, :].astype(np.float32) * .55).astype(np.uint8)

ramps = [ASH, TRIM, FLAG, IRON, OAK, BARK, AMBER, FIRE, PUD, WINE, BOT, CHZ, SACK, LINEN, STRAW, MEAT, GAR, COP, CLAY]
res = K.finish(a, os.path.join(HERE, 'battle-bg.png'), maxc=96)
print(res)

# ---- check-overlay: 적 3(왼쪽) · 아군 4(오른쪽 아래) 48x48 반투명 표식
im = Image.open(os.path.join(HERE, 'battle-bg.png')).convert('RGBA')
ov = Image.new('RGBA', im.size, (0, 0, 0, 0)); d = ImageDraw.Draw(ov)
ENEMY = [(140, 196), (226, 236), (140, 276)]; ALLY = [(424, 196), (456, 230), (488, 262), (512, 282)]
for (x, y) in ENEMY: d.rectangle((x, y, x + 47, y + 47), fill=(230, 60, 60, 110), outline=(255, 120, 120, 255))
for (x, y) in ALLY: d.rectangle((x, y, x + 47, y + 47), fill=(60, 140, 230, 110), outline=(120, 180, 255, 255))
d.rectangle(K.SAFE, outline=(255, 255, 0, 200))
out = Image.alpha_composite(im, ov)
out.convert('RGB').save(os.path.join(HERE, 'check-overlay.png'))
arr = np.array(im.convert('RGB')).astype(np.float32)
x0, y0, x1, y1 = K.SAFE
reg = arr[y0:y1, x0:x1] @ np.array([.3, .59, .11])
print('safe median', float(np.median(reg)), 'bright px', int((reg > np.median(reg) + 70).sum()))
# 비교: 배경 | 같은 장소 맵 크롭(1x)
mp = Image.open(os.path.join(HERE, 'render-1x.png')).convert('RGB').crop((0, 0, 360, 360))
cmp_ = Image.new('RGB', (640 + 8 + 360, 360), (255, 0, 255)); cmp_.paste(im.convert('RGB'), (0, 0)); cmp_.paste(mp, (648, 0))
cmp_.resize((cmp_.width * 2, cmp_.height * 2), Image.NEAREST).save(os.path.join(HERE, '_qa', 'battle-compare.png'))
