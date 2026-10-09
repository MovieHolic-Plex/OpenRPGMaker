# 전투 배경 2 — 극장 무대(opera-stage). src/opera-stage/ 복사본의 그림 함수를 부른다.
#   원경(뒤벽): 무대 뒤 검은 가림막 주름(drape_face) + 맨 위 붉은 주름 띠(valance_swag) + 가운데 배경 그림판(backdrop_landscape 를 넓게 늘인 복사본)
#   바닥: 짙은 무대 널(stage_px), 맨 앞 무대 턱과 각광(footlight) 한 줄(HUD 가림 띠 안)
#   가장자리: 양옆 걷힌 붉은 막(drape_tied), 뒤쪽 그림판 나무·성(tree_flat·castle_flat), 무대 조명등·소품 궤짝·밧줄 사리
import os, sys, random
ME = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, ME)
sys.path.insert(0, os.path.join(ME, 'src', 'opera-stage'))
from bglib import *
from bglib import _h
from os_kit import *
from os_kit import _hash
import os_stage as A1, os_back as A3

S = BG('opera-stage')
HZ = 86                                     # 뒤벽 아랫변

# ---- 바닥: 무대 널
S.fill(stage_px, y0=HZ)
# ---- 뒤벽: 검은 가림막(주름) — 벽 높이 HZ
S.fill(lambda X, Y: drape_face(X, Y, HZ), y1=HZ)
p = S.img.load()
for x in range(W1):                                   # 벽 밑 그늘 두 줄(맵 벽 앞면 규약: 맨 아래 DK, 그 위 반 밝기)
    p[x, HZ - 1] = DK + (255,); p[x, HZ - 2] = mul(p[x, HZ - 2][:3], .5) + (255,)
    p[x, HZ] = mul(p[x, HZ][:3], .62) + (255,)

# ---- 배경 그림판(넓게): backdrop_landscape 의 그리기 순서·색을 그대로, 크기만 W×H 로
def backdrop_wide(W=224, H=60):
    cv = Cv(W, H)
    sky_t = [(120, 156, 206), (150, 180, 220), (186, 200, 220), (226, 206, 180), (238, 186, 150)]
    for y in range(3, H - 3):
        for x in range(2, W - 2):
            t = (y - 3) / (H * .54)
            i = clamp(int(t * 5 + (.5 if (x // 3 + y) % 2 else 0) * .6), 0, 4)
            c = sky_t[i]
            if vnoise(x * .4, y * 1.6, 9, 971) > .7 and y < 25: c = mix(c, (246, 240, 232), .6)
            cv.px(x, y, c)
    sx, sy = (int(W * .72), 18)
    for y in range(3, 36):
        for x in range(sx - 20, sx + 20):
            d = math.hypot(x + .5 - sx, (y + .5 - sy))
            if d < 7.5: cv.px(x, y, (250, 236, 170))
            elif d < 9 and (x + y) % 2 == 0: cv.px(x, y, (246, 214, 150))
    def ridge(base, amp, sc, sd):
        return lambda x: base - amp * (vnoise(x, 0, sc, sd) * .7 + vnoise(x, 0, sc / 3.0, sd + 1) * .3)
    fl = H - 3
    layers = [(ridge(fl - 18, 20, 36, 974), [(132, 112, 156), (150, 128, 170), (112, 96, 140)]),
              (ridge(fl - 10, 14, 28, 975), [(86, 124, 132), (104, 142, 140), (70, 104, 116)]),
              (ridge(fl - 4, 9, 22, 976), [GRN[3], GRN[4], GRN[2]])]
    for (rf, pal) in layers:
        for x in range(2, W - 2):
            top = rf(x)
            for y in range(int(top), fl):
                c = pal[0]
                if y < top + 2: c = pal[1]
                if (x * 3 + y * 5) % 11 == 0: c = pal[2]
                cv.px(x, y, c)
    for i in range(100):                                                       # 강
        t = i / 100.0; x = 20 + t * (W - 40); y = fl - 1 - t * 8 + 3 * math.sin(t * 9)
        for dx in range(-2, 3): cv.px(int(x + dx), int(y), (150, 190, 214))
        cv.px(int(x), int(y) - 1, (196, 222, 236))
    for (tx, ty, r) in ((16, fl - 9, 5), (30, fl - 7, 6), (66, fl - 8, 4), (118, fl - 6, 5), (132, fl - 8, 4), (196, fl - 9, 6), (210, fl - 7, 4)):
        for y in range(ty, ty + 7): cv.px(tx, y, (92, 60, 40)); cv.px(tx + 1, y, (70, 44, 30))
        for y in range(ty - r, ty + r):
            for x in range(tx - r, tx + r + 2):
                if math.hypot(x + .5 - tx - .5, y + .5 - ty) < r:
                    c = GRN[2] if x > tx else GRN[3]
                    if math.hypot(x + 1.5 - tx, y + 1.5 - ty + 1) < r * .5: c = GRN[4]
                    cv.px(x, y, c)
    for y in range(3, H - 3):
        for x in (2, 3, W - 4, W - 3):
            if cv.p[x, y][3]: cv.px(x, y, mul(cv.p[x, y][:3], .82))
    for x in range(0, W):
        for y, k in ((0, 5), (1, 4), (2, 2), (H - 3, 4), (H - 2, 3), (H - 1, 1)): cv.px(x, y, WD[k])
    for x in (0, W - 1):
        for y in range(H): cv.px(x, y, WD[2])
    return fin(cv, .8)

BD = backdrop_wide()
S.put(BD, 48, HZ - 6, shadow=False, sorty=0)
# 그림판 거는 줄(위 막대에서 천장으로)
for rx in (60, 160, 260):
    S.overlay(Image.new('RGBA', (1, HZ - 6 - 60 - 12), ROPE[3] + (255,)), rx, 12)
# 맨 위 붉은 주름 띠
SW = A1.valance_swag()
for x in range(0, W1, 48): S.overlay(SW, x, 0)

# ---- 뒤쪽 그림판 세트(벽 앞, 그림판 아래 모서리)
S.put(A1.tree_flat(), 22, HZ + 6, sorty=30)
S.put(A1.castle_flat(), 262, HZ + 8, sorty=30)
S.put(A1.set_rock(), 46, HZ + 12, sorty=31)
# ---- 양옆 걷힌 막(무대 틀)
DR = A1.drape_tied()
S.put(DR, -6, 134, sorty=200)
S.put(DR, W1 - 32 + 6, 134, sorty=200, flip=True)
# ---- 가장자리 소품
S.put(A1.stage_lamp(), 30, 150, sorty=150)
S.put(A1.stage_lamp(), 276, 152, sorty=150, flip=True)
S.put(A3.prop_crate(), 6, 160); S.put(A3.prop_crate(), 14, 150)
S.put(A3.rope_coil(), 300, 162, shadow=False)
S.put(A3.sandbag_pile(), 290, 172, shadow=False)

img = S.compose()
# 조명 웅덩이(반투명, 세트 앞) — 배틀러 자리 밖 뒤쪽 양 끝에만
LP = A1.light_pool()
img.alpha_composite(LP, (20, HZ + 6)); img.alpha_composite(LP, (252, HZ + 8))
# 무대 맨 앞 턱(어두운 앞판) + 각광 한 줄 — 아래 HUD 띠 안
for x in range(W1):
    for y in range(170, H1):
        img.putpixel((x, y), (EBN[1] if y == 170 else (GLT[3] if y == 171 else mul(EBN[2], .7))) + (255,))
FLT = A1.footlight()
for fx in range(4, W1, 22): img.alpha_composite(FLT, (fx, 162))
S.img = img
if __name__ == '__main__':
    S.save(ME)
