# make_ancient_forest.py 의 전역에서 exec 로 실행되는 땅 그리기 블록 (공터가 확정된 뒤 다시 부른다)
# ================================================================== 땅 그리기 (주기 48 표본 + 흔들린 경계, 길은 화소 단위로 부드럽게)
Hp, Wp = H_ * 16, W_ * 16
PY, PX = np.mgrid[0:Hp, 0:Wp]
def vn_img(sc, seed): return np.array([[vnoise(x, y, sc, seed) for x in range(Wp)] for y in range(Hp)])
def up(m): return np.repeat(np.repeat(m, 16, 0), 16, 1).astype(float)
wob = vn_img(9.0, 71) - .5
wob2 = vn_img(3.0, 72) - .5
def soft_f(cell_mask, sigma=5.5, amp=.16):
    return ndi.gaussian_filter(up(cell_mask), sigma) + wob * amp + wob2 * amp * .5
def soft_mask(cell_mask, sigma=5.5, th=.5, amp=.16): return soft_f(cell_mask, sigma, amp) > th
_BAY = np.array([[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]]) / 16.0
BAYER = _BAY[PY % 4, PX % 4]
pf = soft_f(path & ~water, 5.5, .20)
# 길 가장자리: 흙↔이끼를 4x4 디더로 풀어 계단형 윤곽을 없앤다 (띠 폭 약 ±.10)
pathpx = (pf > .5 + (BAYER - .5) * .22) & ~up(court).astype(bool)
path_core = pf > .62
gladepx = soft_mask(glade_cell, 7.0, .5, .35)
dn = vn_img(11.0, 73) * .62 + vn_img(4.0, 74) * .38
deeppx = (dn > .56) & ~gladepx
courtpx = up(court).astype(bool)
waterpx = up(water).astype(float)
wmask = ndi.gaussian_filter(waterpx, 2.0) + wob * .5 > .5
tones = {k: np.array(B.floor_sample(k).convert('RGB')) for k in ('moss', 'deep', 'loam', 'flag', 'glade')}
def tile(k): return tones[k][PY % 48, PX % 48]
ground = tile('moss').copy()
ground[deeppx] = tile('deep')[deeppx]
ground[gladepx] = tile('glade')[gladepx]
_lo = tile('loam').astype(float); _mu = _lo.reshape(-1, 3).mean(0)
_lo = _mu + (_lo - _mu) * .62            # 길 안쪽 무늬를 눌러 조각조각 보이지 않게
ground[pathpx] = _lo[pathpx].astype(np.uint8)
# 길 바깥 이끼는 밟힌 듯 흙빛을 살짝 섞는다 (경계 번짐)
_halo = (pf > .34) & ~pathpx & ~up(court).astype(bool)
ground[_halo] = (ground[_halo] * .78 + _lo[_halo] * .22).astype(np.uint8)
ground[courtpx] = tile('flag')[courtpx]
# 맵 크기 저주파 밝기 변화: 48px 반복이 보이지 않게 ±4%
lum = 1 + (vn_img(40.0, 75) - .5) * .12
ground = np.clip(ground * lum[..., None], 0, 255).astype(np.uint8)
WAT = [(8, 38, 44), (14, 62, 66), (24, 98, 94), (46, 140, 126), (110, 196, 176), (200, 240, 224)]
wn = vn_img(3.4, 61 + 0)  # 물결
wn = np.array([[vnoise(x * .8, y * 2.2, 3.4, 61) for x in range(Wp)] for y in range(Hp)])
widx = np.where(wn < .5, 2, 3)
wh = np.array([[_hash(x // 3, y, 62) for x in range(Wp)] for y in range(Hp)])
widx = np.where(wh > .90, 4, widx); widx = np.where(wh > .98, 5, widx)
ground[wmask] = np.array(WAT, np.uint8)[widx][wmask]
edge = wmask & ~ndi.binary_erosion(wmask, iterations=1)
ground[edge] = np.array(WAT[1], np.uint8)
wet = ndi.binary_dilation(wmask, iterations=2) & ~wmask
ground[wet] = (ground[wet] * .8).astype(np.uint8)
base_img = Image.fromarray(ground, 'RGB').convert('RGBA')
water = water | (ndi.zoom(wmask.astype(np.uint8), 1 / 16.0, order=0) > 0) & False

