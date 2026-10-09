# 고원 절벽과 하늘 다리(highland-cliff-bridge, 장르 natural-forest-cliff) 공용 바탕.
# 버들항 파이프라인 → 미래 폐허 톤 캔버스(fr_base·fr_mat) → 동양풍 성(ek_base·ek_wave5) → 대나무 숲 계곡(bv_base) 을 그대로 불러 쓴다
# (다른 폴더 파일은 읽기만). 풀 = 버들항 ground.render 칩셋 풀, 흙 = 칩셋 흙(16,224) 램프 SOIL, 잎 = 칩셋 잎 램프 LEAF7, 돌 = 버들항 돌 ST.
# 이 장소에 처음 나오는 재질만 같은 7단 램프 규칙(0 = 색 윤곽, 1~6 = 밝기, 그림자는 보랏빛으로 식고 빛은 데운다)으로 더한다:
#   dan    주황·갈색 절벽 바위(층진 비늘 돌, 세로 결 주름)
#   sora   하늘(푸른 보랏빛 — 단색 바탕 + 옅은 가로 결, 그라데이션 금지)
#   kumo   구름(흰빛 → 푸른 그늘)
#   nuren  마른 고원 풀(누런 올리브: 얼룩진 풀 덩이)
#   nuri   비바람에 바랜 회색 널판(다리)
#   sage   활엽 큰 나무·전나무 잎(회녹색, 풀보다 차갑고 탁하다)
#   michi  밟아 다진 맨땅 길(누런 흙)
# 풀 바탕·맨땅 색은 장르 규격(tiledata/beodeul-kits/genres/natural-forest-cliff.md: nfgrass·nfdirt)을 natural-forest-clearing 과 같은 값으로 쓴다.
# 결정적(같은 입력 = 같은 그림). 생성 이미지·트레이싱 없음. 3/4 시점(윗면 + 앞면, 옆면 없음), 빛 왼쪽 위, 1칸 = 16px.
import os, sys
sys.dont_write_bytecode = True
_HERE = os.path.dirname(os.path.abspath(__file__))
VAR = os.path.abspath(os.path.join(_HERE, '..'))
sys.path.insert(0, os.path.join(VAR, 'bamboo-valley'))
import numpy as np
from PIL import Image
from bv_base import *                                         # noqa  TC·RAMP·hash2·edges·cobble·_cell·sheet_from_cells·cell_of·Parts·pad16·flip …
from bv_base import _hash, _cell
import fr_mat

HERE = _HERE


def _r(*cs): return [hx(c) for c in cs]
DAN   = _r('#1c0c08', '#40200e', '#663414', '#8e4c1c', '#b26a28', '#d08c3a', '#e8b25e')   # 주황·갈색 절벽 바위
SORA  = _r('#1c2450', '#2e3c7c', '#3e52a0', '#5068bc', '#647cca', '#8aa2dc', '#bccaee')   # 하늘
KUMO  = _r('#46548a', '#7282b4', '#98a8d4', '#b8c6e6', '#d2dcf2', '#e6ecf8', '#f8fbff')   # 구름
NUREN = _r('#181a08', '#323612', '#4c541c', '#687226', '#848e32', '#a2a846', '#c4c46c')   # 마른 고원 풀(누런 올리브)
MICHI = _r('#3a2a14', '#5a4422', '#7a6034', '#987c48', '#ae925c', '#c4aa74', '#dac492')   # 밟아 다진 맨땅 길 = 장르 규격 nfdirt
NFGRASS = _r('#1e2a0c', '#354c12', '#4d6222', '#677a34', '#84964a', '#a2b062', '#c0ca7e')   # 올리브 풀 = 장르 규격 nfgrass(숲 마당과 같은 값)
NURI  = _r('#121216', '#28282c', '#403e40', '#5a5654', '#76716a', '#948d84', '#b6aea2')   # 바랜 회색 널판
SAGE  = _r('#0c1812', '#1a2e22', '#2c4432', '#425c40', '#5c7652', '#7c9468', '#a8bc8c')   # 활엽수·전나무 잎(회녹색)
NEWH = {'nfgrass': NFGRASS, 'sage': SAGE, 'dan': DAN, 'sora': SORA, 'kumo': KUMO, 'nuren': NUREN, 'nuri': NURI, 'michi': MICHI}
for n in NEWH:
    if n not in fr_mat.MID:
        fr_mat.MATS.append(n); fr_mat.MID[n] = len(fr_mat.MATS) - 1
_lut = np.zeros((len(fr_mat.MATS), 7, 3), np.uint8)
_lut[:fr_mat.LUT.shape[0]] = fr_mat.LUT
for n, r in NEWH.items():
    for k in range(7): _lut[fr_mat.MID[n], k] = r[k]
fr_mat.LUT = _lut
RAMP.update(NEWH)
DANa = np.array(DAN, int); SORAa = np.array(SORA, int); KUMOa = np.array(KUMO, int)
NURENa = np.array(NUREN, int); NURIa = np.array(NURI, int); MICHIa = np.array(MICHI, int); SAGEa = np.array(SAGE, int); GRa = np.array(NFGRASS, int)
