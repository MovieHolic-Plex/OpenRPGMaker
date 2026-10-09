# ruined-village — 폐허 마을 앞 빈 광장. 원경: 흐린 낮 하늘 띠·구름·마른 언덕. 뒷줄: 무너진 폐가·불탄 교회(폐허 마을 그림 함수 복사본 src-ruined-village).
# 바닥: 버들항 잔디가 덩이째 누렇게 마른 풀밭 + 잡초 흙길(집 앞) + 금 간 포석 광장(가장자리 풀에 묻힘). 가장자리: 고목·우물·뒤집힌 수레·휜 가로등.
import os, sys
sys.dont_write_bytecode = True
HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, HERE); sys.path.insert(0, os.path.join(HERE, 'src-ruined-village'))
import numpy as np
from PIL import Image
from scipy import ndimage as ndi
import bgcommon as B
import rv_build as RB, rv_props as RP, rv_ground as RG
from rv_base import hash2, tnoise
import ground as BG          # 버들항 잔디(city_v6 ground.render) — 읽기만

HB = 182                     # 뒷줄 밑줄
GY = 168                     # 바닥 시작

def lawn_field():
    h = 360 - GY
    lawn, _ = BG.render(640, h, [], np.zeros((h, 640), bool), seed=9)
    rgb = np.array(lawn.convert('RGB')).astype(int)
    X, Y = np.meshgrid(np.arange(640), np.arange(h))
    # 마른 풀 덩이: 덩이 노이즈 + 화소 디더(가장자리 2화소) — 원 장소의 ground-drygrass 와 같은 _dry 규칙
    n = tnoise(640, h, 40, 81) * 0.7 + tnoise(640, h, 14, 82) * 0.3
    k = np.clip((n - 0.38) * 3.2 + (hash2(X, Y, 85) - 0.5) * 0.5, 0, 1) * 0.8
    k = np.where(k > 0.25, np.maximum(k, 0.55), 0)
    rgb = RG._dry(rgb, k)
    stub = (hash2(X, Y, 83) > 0.988) & (k > 0)
    rgb = np.where(stub[..., None], np.array(RG.HAYA[6]), rgb)
    rgb = np.where(np.roll(stub, 1, 0)[..., None], np.array(RG.HAYA[2]), rgb)
    return rgb, X, Y

def make():
    im = B.new()
    B.sky(im, [(40, '#7f9fb8'), (82, '#95b2c6'), (118, '#acc5d2'), (GY, '#c2d4da')])
    cc = ('#eef2f2', '#cdd7dc', '#9fafba')
    for (cx, cy, w, h, s) in ((90, 34, 76, 14, 21), (330, 22, 60, 11, 22), (540, 46, 90, 16, 23), (220, 66, 44, 8, 24), (470, 12, 40, 8, 25)):
        B.cloud(im, cx, cy, w, h, s, cc)
    # 마른 언덕 두 겹(먼 것은 푸른 회녹, 가까운 것은 마른 올리브)
    B.ridge(im, GY + 2, 40, ('#7f9a8a', '#97ae9c', '#71897b'), 31, step=4, period=(150, 61, 23))
    B.ridge(im, GY + 2, 22, ('#6f7a40', '#8a9450', '#5e6836'), 32, step=3, period=(90, 37, 17))
    rgb, X, Y = lawn_field()
    h = rgb.shape[0]
    # 잡초 흙길: 집 앞 띠(들쭉날쭉한 위·아래 가장자리) — 버들항 흙길 칸 + 잡초(ground_weedydirt 규칙)
    dirt = RG._tile(RG.DIRT, X, Y).copy()
    weed = (hash2(X // 3, Y // 2, 74) > 0.93) & (hash2(X, Y, 75) > 0.3)
    dirt = np.where(weed[..., None], RG.LAWN_[(hash2(X, Y, 76) * 4).astype(int) + 1], dirt)
    yy = Y + GY
    top = HB - 4 + (tnoise(640, h, 9, 61) * 4).astype(int)
    bot = HB + 18 + (tnoise(640, h, 11, 62) * 6).astype(int)
    road = (yy >= top) & (yy < bot)
    edge = road & ((yy - top < 2) | (bot - yy <= 2)) & (hash2(X, Y, 63) > 0.5)
    rgb = np.where((road & ~edge)[..., None], dirt, rgb)
    # 금 간 포석 광장: 들쭉날쭉한 타원(가장자리 풀에 묻힘) — pave_shader 의 m(가장자리 깊이, 화소)
    # 광장: 위 가장자리(y≈206)는 들쭉날쭉, 아래·옆은 화면 밖으로 이어진다. 양옆 끝은 풀이 먹어 들어간다(원 장소 광장의 동·남서쪽처럼)
    topy = 206 - GY + (tnoise(640, h, 16, 64)[0] * 10).astype(int)
    inside = Y >= topy[None, :]
    side = (X < 150 - 0.55 * Y + (tnoise(640, h, 16, 66) * 36).astype(int)) | (X > 490 + 0.55 * Y - (tnoise(640, h, 16, 67) * 36).astype(int))   # 앞으로 갈수록 넓어지는 광장
    inside &= ~side
    holes = (tnoise(640, h, 16, 65) > 0.86) & ((X < 150) | (X > 500) | (Y > 300 - GY))     # 판석을 뚫은 풀 섬은 가장자리 쪽에만
    inside &= ~holes
    m = ndi.distance_transform_edt(inside) - 1.0 - ndi.distance_transform_edt(~inside)
    prgb, pm = RG.pave_shader(X, Y, m, 15, 71)
    rgb = np.where(pm[..., None], prgb, rgb)
    # 큰 금 몇 가닥(계단꼴 1화소, ST[2])
    crack = (RG._cracks(X, Y, 77, per=640) | RG._cracks(X, Y, 78, per=640) | RG._cracks(X + 211, Y + 37, 79, per=640)) & inside & (m > 3)
    rgb = np.where(crack[..., None], np.array(RG.STA[2]), rgb)
    B.put_ground(im, rgb.astype(np.uint8), GY)
    # 뒷줄
    row = [('gable_ruin_log', -18, 1), ('ruin_house_a', 40, 0), ('gable_ruin_a', 140, 0), ('church_ruin', 228, 0),
           ('burnt_house', 400, 0), ('gable_ruin_stone', 488, 0), ('ruin_house_b', 556, 0)]
    sprites = [(getattr(RB, n)(), x, f) for n, x, f in row]
    trees = [(RP.dead_tree_large(), 108, HB - 4, 0), (RP.dead_tree_crooked(), 384, HB - 6, 1), (RP.dead_tree_crooked(), 206, HB - 2, 0)]
    for spr, x, yb, f in trees: B.paste(im, spr, x, yb, flip=bool(f))
    for spr, x, f in sprites: B.cast_shadow(im, spr if not f else spr.transpose(Image.FLIP_LEFT_RIGHT), x, HB, dx=-4, depth=6)
    for spr, x, f in sprites: B.paste(im, spr, x, HB, flip=bool(f))
    B.paste(im, RP.rubble_church(), 352, HB + 6); B.paste(im, RP.tile_debris(), 120, HB + 8); B.paste(im, RP.beams_charred(), 300, HB + 10) if hasattr(RP, 'beams_charred') else None
    B.paste(im, RP.fence_fallen(), 448, HB + 10); B.paste(im, RP.fence_fallen(), 470, HB + 12, flip=True)
    # 가장자리(왼쪽·오른쪽)만
    B.paste(im, RP.dead_tree_large(), -6, 300); B.paste(im, RP.lamppost_bent(), 92, 236)
    B.paste(im, RP.cart_overturned(), 18, 338); B.paste(im, RP.barrel_tipped(), 70, 330)
    B.paste(im, RP.well_dry(), 586, 262); B.paste(im, RP.crow_post(), 566, 226); B.paste(im, RP.notice_torn(), 604, 214)
    B.paste(im, RP.dead_tree_crooked(), 596, 338, flip=True); B.paste(im, RP.crate_broken(), 560, 338); B.paste(im, RP.stump_burnt(), 30, 268)
    for (x, y, n) in ((8, 222, 'drygrass_b'), (100, 280, 'drygrass_a'), (60, 250, 'dead_bush'), (548, 300, 'drygrass_b'), (612, 300, 'drygrass_a'),
                      (180, 214, 'drygrass_a'), (470, 222, 'drygrass_b'), (140, 336, 'drygrass_a'), (520, 340, 'drygrass_a'), (300, 214, 'crows_ground')):
        B.paste(im, getattr(RP, n)(), x, y)
    return im

if __name__ == '__main__':
    out = sys.argv[1] if len(sys.argv) > 1 else os.path.join(HERE, 'ruined-village.png')
    B.finish(make()).save(out); print(out, B.check(out))
