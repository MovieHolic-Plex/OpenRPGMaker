# 전투 배경 4 — 신도의 탑 꼭대기 의식실(cultist-tower). src/cultist-tower/ 복사본의 그림 함수를 부른다.
#   원경(뒤벽): 교단 돌 벽 앞면(dlib.face_px 'cult' — 그을음·걸레받이), 가운데 검붉은 둥근 창(crimson_window), 보라 휘장(cult_tapestry) 넷,
#              보라 벽등(sconce_purple)·탈(wall_mask), 벽 앞 높은 제단(high_altar)
#   바닥: 의식실 판석(ritual_floor) + 바닥에 새긴 큰 마법진(magic_circle 을 3/4 시점 타원으로 늘인 복사본, 빛 테는 반투명)
#   가장자리: 수정 화로(brazier_big 의 불 대신 보라 수정 덩이를 꽂은 복사본) 둘, 보라 불 화로·해골 촛대·제기 항아리·바닥 초
import os, sys, random
ME = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, ME)
sys.path.insert(0, os.path.join(ME, 'src', 'cultist-tower'))
from bglib import *
from bglib import _h
from ct_kit import *
from ct_kit import _hash
import ct_in1 as A, ct_in2 as B

S = BG('cultist-tower')
HZ = 88

# ---- 바닥·뒤벽
S.fill(ritual_floor, y0=HZ)
S.fill(lambda X, Y: dlib.face_px('cult', X + 4000, Y, HZ, 3, False, False), y1=HZ)
p = S.img.load()
for x in range(W1): p[x, HZ] = mul(p[x, HZ][:3], .6) + (255,); p[x, HZ + 1] = mul(p[x, HZ + 1][:3], .8) + (255,)

# ---- 마법진(3/4 타원): magic_circle 과 같은 고리·점 띠·나선·작은 원 여섯·가운데 눈, 세로만 K 배로 눌러 그린다
def magic_circle_34(W=208, K=0.42, a_mul=.72):
    sc = W / 112.0
    H = int(W * K) + 4; im = new(W, H); pp = im.load()
    cx, cy = W / 2, H / 2
    def put(x, y, c, a=255):
        if 0 <= x < W and 0 <= y < H: pp[x, y] = tuple(c) + (int(a * a_mul) if a < 255 else 255,)
    def dist(x, y): return math.hypot(x + .5 - cx, (y + .5 - cy) / K) / sc
    for y in range(H):
        for x in range(W):
            d = dist(x, y)
            if abs(d - 52) < 1.1 / sc ** .5: put(x, y, PF[3] if (x + y) % 3 else PF[4], 230)
            elif abs(d - 49.5) < .8: put(x, y, CRIM[2], 255)
            elif abs(d - 40) < .9: put(x, y, PF[2], 220)
            elif abs(d - 37.5) < .7: put(x, y, CRIM[1], 255)
            elif abs(d - 22) < .9: put(x, y, PF[3], 220)
            elif 40 < d < 49:
                a = math.atan2((y + .5 - cy) / K, x + .5 - cx)
                f = (a + math.pi) / (2 * math.pi) * 64
                if abs(d - 44.5) < 1.2 and int(f) % 2 == 0 and abs(f % 1 - .5) < .3: put(x, y, PF[2], 230)
    for k in range(3):
        for t in range(0, 700):
            a = k * 2 * math.pi / 3 + t / 700 * math.pi * 1.6
            r = (37 - t / 700 * 14) * sc
            x = int(cx + r * math.cos(a)); y = int(cy + r * math.sin(a) * K)
            put(x, y, CRIM[2]); put(x + 1, y, CRIM[1])
            if t % 50 == 0: put(x, y - 1, PF[3], 200)
    for k in range(6):
        a = k * math.pi / 3 + math.pi / 6
        ox = cx + 52 * sc * math.cos(a); oy = cy + 52 * sc * math.sin(a) * K
        for y in range(int(oy) - 4, int(oy) + 5):
            for x in range(int(ox) - 7, int(ox) + 8):
                dd = math.hypot(x + .5 - ox, (y + .5 - oy) / K)
                if dd < 4.6: put(x, y, CRIM[1])
                elif dd < 6.2: put(x, y, PF[3], 230)
    cv = Cv(W, H)
    eye_emblem(cv, int(cx), int(cy) - 1, 13, PF[4], CRIM[3], VIO[0])
    e = np.array(cv.im); e[..., 3] = (e[..., 3] * .8).astype(np.uint8)
    im.alpha_composite(Image.fromarray(e, 'RGBA'))
    return im
MC = magic_circle_34()

# ---- 수정 화로: brazier_big 의 돌 받침·쇠 그릇을 그대로 두고 불 대신 보라 수정 덩이(면마다 밝기, 빛 왼쪽 위) + 작은 불
def crystal(cv, cx, ybot, h, w, tilt=0):
    for y in range(ybot - h, ybot + 1):
        f = (y - (ybot - h)) / max(1, h)
        hw = max(.5, w * min(1, f * 2.2))
        mid = cx + tilt * (1 - f) * 2
        for x in range(int(mid - hw), int(mid + hw) + 1):
            k = 5 if x < mid - .5 else (3 if x > mid + .5 else 4)
            if f < .18: k += 1
            if x == int(mid - hw) or x == int(mid + hw): k -= 1
            cv.px(x, y, (VIO + [PF[4]])[clamp(k + 1, 1, 7)] if k >= 5 else VIO[clamp(k + 1, 1, 6)])
    cv.px(int(cx + tilt * 2) - 1, ybot - h + 2, PF[5])
def crystal_brazier(seed=0):
    W, H = 32, 40; cv = Cv(W, H)
    oy = 8
    stone_box(cv, 9, 22 + oy, 23, 32 + oy, 3, CS, seed)
    for y in range(17 + oy, 23 + oy):
        hw = 13 - (y - 17 - oy)
        for x in range(16 - hw, 16 + hw): cv.px(x, y, IR[clamp(cyl_k(x, 16 - hw, 16 + hw) - 1, 1, 5)])
    for x in range(4, 29, 4): cv.px(x, 19 + oy, CRIM[3])
    topell(cv, 16, 16.5 + oy, 13, 2.6, IR, 5, 3, seed)
    crystal(cv, 16, 17 + oy, 20, 3.4, 0); crystal(cv, 10, 17 + oy, 12, 2.4, -1); crystal(cv, 22, 17 + oy, 14, 2.6, 1)
    flame(cv, 6, 15 + oy, 5, PF, seed + 2, 2); flame(cv, 26, 15 + oy, 6, PF, seed + 3, 2)
    return shadow_under(fin(cv, .55), 16, H - 1, 9, 1.4, 70)

# ---- 뒤벽 장식
S.overlay(B.crimson_window(), 136, 6)
for tx in (30, 82, 206, 258): S.overlay(A.cult_tapestry(tx), tx, 18)
for sx in (66, 122, 186, 242): S.overlay(A.sconce_purple(), sx, 34)
S.overlay(A.wall_mask(), 6, 30); S.overlay(A.wall_mask(red=True), 298, 30)
S.overlay(A.chains_wall(), 12, 50); S.overlay(A.chains_wall(), 292, 50)
S.put(B.high_altar(), 128, HZ + 6, sorty=40)
S.put(A.ritual_urn(small=True), 108, HZ + 6, sorty=40); S.put(A.ritual_urn(small=True), 196, HZ + 6, sorty=40)

# ---- 바닥 마법진(장식, 가장 아래)
S.objs.append((-1, 160 - MC.width // 2, 134 - MC.height // 2, MC, False))

# ---- 가장자리
CB = crystal_brazier()
S.put(CB, 6, 122); S.put(CB, 284, 124)
S.put(A.brazier_purple(), 44, HZ + 10); S.put(A.brazier_purple(), 262, HZ + 10)
S.put(A.skull_candelabra(), 22, 160); S.put(A.skull_candelabra(), 296, 164)
S.put(B.floor_candles(), 4, 172, shadow=False); S.put(B.floor_candles(), 302, 150, shadow=False)
S.put(B.scroll_heap(), 36, 172, shadow=False)
S.put(A.kneel_cushion(), 40, 140, shadow=False); S.put(A.kneel_cushion(), 266, 142, shadow=False)
img = S.compose()
# 화로·창 빛무리(반투명) — 가장자리·뒤벽에만
def glow(size, col, a=60):
    im = Image.new('RGBA', (size, size)); pp = im.load()
    for y in range(size):
        for x in range(size):
            d = math.hypot(x + .5 - size / 2, y + .5 - size / 2) / (size / 2)
            if d < 1:
                al = int(a * (1 - d) ** 1.6)
                if al > 0: pp[x, y] = tuple(col) + (al,)
    return im
GC = PF[3]
for gx, gy, sz in ((22, 98, 40), (300, 100, 40), (52, 88, 26), (270, 88, 26), (160, 28, 44)):
    img.alpha_composite(glow(sz, GC, 54), (gx - sz // 2, gy - sz // 2))
S.img = img
if __name__ == '__main__':
    S.save(ME)
