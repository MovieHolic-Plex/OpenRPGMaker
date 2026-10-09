# rain-ruin-town — 비 내리는 수직 폐허 도시, 아랫길 광장(밤비 색조). 그림 함수 = src-rain-ruin-town 복사본.
# 원경: 비구름 덮인 밤하늘 띠 · 언덕 숲 실루엣 · 윗단 옹벽(이끼 낀 젖은 마름돌)과 그 가운데 정면 돌계단 · 윗단의 무너진 옛 극장·폐가.
# 뒷줄(아랫길): 바깥 계단 집 · 높은 박공 집 · 시계탑 · 가게 집. 바닥: 젖은 큰 판석(하늘빛 맺힘) + 집 앞 젖은 자갈 + 가장자리 웅덩이.
# 비 줄기는 그리지 않는다(원 장소와 같다 — 런타임 오버레이 몫).
import os, sys
sys.dont_write_bytecode = True
HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, HERE); sys.path.insert(0, os.path.join(HERE, 'src-rain-ruin-town'))
import numpy as np
from PIL import Image
from scipy import ndimage as ndi
import bgcommon as B
import rr_build as RB, rr_props as RP, rr_ground as RG
from rr_base import night, glow, drip_stains, moss_foot, sheen_top, H as RH, ST, night_arr
from rv_base import hash2, tnoise

TOP = 124          # 윗단 바닥 윗줄
WALL = 131         # 옹벽 앞면 시작
HB = 186           # 아랫길 뒷줄 밑줄

def upper_tier(im):
    """윗단 바닥(젖은 판석 7줄) + 옹벽 앞면(face_day → 밤) + 가운데 정면 계단."""
    w, h = 640, HB - TOP
    face = Image.new('RGBA', (w, h)); p = face.load()
    for y in range(h):
        for x in range(w):
            Y = y + TOP
            if Y < WALL: c = RG.face_day(x, 3)                  # 윗단 바닥은 아래에서 다시 칠한다
            else:
                fy = Y - WALL; c = RG.face_day(x, fy)
                if fy < 3: c = ST[5] if fy == 0 else (ST[4] if fy == 1 else ST[1])     # 갓돌
                elif fy < 6: c = tuple(int(v * 0.62) for v in c[:3])
            p[x, y] = tuple(c[:3]) + (255,)
    # 정면 돌계단(x 300..348): 디딤판 윗면 밝음 + 계단 코 그늘 + 양옆 볼 벽
    sx0, sx1 = 296, 344
    for y in range(WALL - TOP, h):
        k = (y - (WALL - TOP)) % 5
        for x in range(sx0, sx1):
            if x in (sx0, sx0 + 1, sx1 - 2, sx1 - 1): c = ST[4] if x <= sx0 + 1 else ST[2]
            else: c = ST[6] if k == 0 else (ST[5] if k < 3 else (ST[3] if k == 3 else ST[2]))
            if RH(x, y, 41) > 0.93 and k in (1, 2): c = ST[4]
            p[x, y] = tuple(c[:3]) + (255,)
    face = night(face); p = face.load()
    drip_stains(p, w, h, 0, sx0, WALL - TOP + 3, h - 2, 5, 0.22, 0.3)
    drip_stains(p, w, h, sx1, w, WALL - TOP + 3, h - 2, 6, 0.22, 0.3)
    moss_foot(p, w, h, 0, sx0, h - 1, 7, 8, 0.5); moss_foot(p, w, h, sx1, w, h - 1, 8, 8, 0.5)
    sheen_top(p, w, h, [(x, WALL - TOP) for x in range(w) if RH(x, 3) < 0.5], 1, 0.6)
    # 윗단 바닥 젖은 판석
    X, Y = np.meshgrid(np.arange(w), np.arange(WALL - TOP))
    fl, _ = RG.wet_flag(X, Y + 3, 71)
    a = np.array(face); a[:WALL - TOP, :, :3] = np.clip(np.rint(fl), 0, 255).astype(np.uint8)
    im.alpha_composite(Image.fromarray(a, 'RGBA'), (0, TOP))

def puddles(rgb, X, Y, spots):
    """웅덩이: 들쭉날쭉한 타원 마스크의 가장자리 깊이(m) → puddle_shader(원 장소와 같은 규칙)."""
    for k, (cx, cy, rx, ry) in enumerate(spots):
        d = ((X - cx) / rx) ** 2 + ((Y - cy) / ry) ** 2
        ins = d < 1 + (tnoise(640, rgb.shape[0], 8, 90 + k) - 0.5) * 0.6
        if not ins.any(): continue
        m = ndi.distance_transform_edt(ins) - 1.0
        prgb, al = RG.puddle_shader(X, Y, np.where(ins, m, -1), 0, 81 + k)
        rgb = np.where((al & ins)[..., None], prgb, rgb)
    return rgb

def far(spr, k=0.84):
    """윗단(먼 쪽) 조각은 한 단 어둡게 — 비 안개 속 거리감(밝기 순위 유지)."""
    a = np.array(spr.convert('RGBA')).astype(np.float64); a[..., :3] *= k
    return Image.fromarray(np.rint(a).astype(np.uint8), 'RGBA')

def make():
    im = B.new()
    B.sky(im, [(30, '#121a30'), (64, '#18223c'), (96, '#1f2b48'), (TOP, '#273656')])
    cc = ('#4a5878', '#38456a', '#2a3554')
    for (cx, cy, w, h, s) in ((70, 26, 120, 16, 41), (250, 14, 110, 12, 42), (430, 30, 140, 18, 43), (600, 16, 90, 12, 44), (330, 58, 70, 10, 45), (150, 70, 80, 10, 46)):
        B.cloud(im, cx, cy, w, h, s, cc)
    # 언덕 위 숲(젖은 밤 잎) 실루엣 — 두 겹
    B.ridge(im, TOP + 2, 46, ('#16281f', '#22382b', '#102018'), 51, step=4, period=(120, 47, 19))
    B.ridge(im, TOP + 2, 22, ('#1c3226', '#294533', '#14261c'), 52, step=3, period=(70, 29, 13))
    upper_tier(im)
    # 윗단 건물(옹벽 위): 무너진 옛 극장 · 폐가 · 등
    up = [(RB.theatre_ruin(), 104), (RB.ruin_house(), 430)]
    for spr, x in up: B.paste(im, far(spr), x, WALL + 1)
    B.paste(im, far(RP.lamppost_lit(), 0.95), 286, WALL + 1); B.paste(im, far(RP.lamppost_lit(), 0.95), 346, WALL + 1)
    B.paste(im, far(RP.statue_weathered()), 380, WALL + 1); B.paste(im, far(RP.planter_cypress()), 260, WALL + 1)
    # 아랫길 바닥: 젖은 큰 판석 + 집 앞 젖은 자갈 띠
    h = 360 - HB
    X, Y = np.meshgrid(np.arange(640), np.arange(h))
    rgb = RG.bigflag(X, Y, 75)
    cob = RG.wet_cobble(X, Y, 73)
    band = Y < 16 + (tnoise(640, h, 16, 61) * 2).astype(int)
    rgb = np.where(band[..., None], cob, rgb)
    curb = (Y == 16) | (Y == 17)
    rgb = np.where(curb[..., None], np.array(night_arr(np.array(ST[4], float)))[None, None, :] * np.where(Y == 16, 0.6, 1.0)[..., None], rgb)
    rgb = puddles(rgb, X, Y, [(40, 70, 34, 7), (604, 96, 38, 8), (90, 150, 30, 6), (560, 30, 26, 5), (610, 150, 22, 5)])
    a = np.array(im); a[HB:, :, :3] = np.clip(np.rint(rgb), 0, 255).astype(np.uint8); im.paste(Image.fromarray(a, 'RGBA'))
    # 아랫길 뒷줄 집
    row = [(RB.stair_house(), -22), (RB.gable_tall(), 74), (RB.clock_tower(), 500), (RB.shop_house(), 548)]
    for spr, x in row: B.cast_shadow(im, spr, x, HB, dx=-4, depth=6, k=0.75, tint=(8, 10, 22))
    for spr, x in row: B.paste(im, spr, x, HB)
    B.paste(im, RP.rain_barrel(), 140, HB + 2); B.paste(im, RP.notice_column(), 470, HB + 4); B.paste(im, RP.bollard_stone(), 230, HB + 4); B.paste(im, RP.bollard_stone(), 404, HB + 4)
    # 가장자리 소품 + 등불 번짐(가장자리만)
    B.paste(im, RP.lamp_double_lit(), 78, 250); B.paste(im, RP.lamppost_lit(), 586, 262)
    B.paste(im, RP.barrels_wet(), 6, 300); B.paste(im, RP.crates_tarp(), 34, 338); B.paste(im, RP.umbrella_dropped(), 100, 330)
    B.paste(im, RP.cart_tarp(), 596, 330); B.paste(im, RP.bench_wet(), 540, 236); B.paste(im, RP.rubble_masonry(), 8, 228); B.paste(im, RP.slates_fallen(), 612, 214)
    B.paste(im, RP.leaves_wet(), 130, 300); B.paste(im, RP.moss_stones(), 520, 338)
    px = im.load()
    from rr_base import LIT
    for (cx, cy, r) in ((94, 252, 26), (594, 264, 20), (294, WALL + 3, 12), (354, WALL + 3, 12)):     # 등 밑 땅에 고인 노란 빛
        glow(px, 640, 360, cx, cy, r, k=0.42, col=LIT[3])
    return im

if __name__ == '__main__':
    out = sys.argv[1] if len(sys.argv) > 1 else os.path.join(HERE, 'rain-ruin-town.png')
    B.finish(make()).save(out); print(out, B.check(out))
