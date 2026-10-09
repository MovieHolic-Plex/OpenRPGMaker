# 산중 무림 문파(wuxia-sect-mountain) 공용 바탕 — 장르 규격 tiledata/beodeul-kits/genres/wuxia.md.
# 버들항 파이프라인(city_v6 팔레트·pz.fin 윤곽·칩셋 타일·ground.render·water6)과 eastern-castle 의 톤 캔버스(ek_base:
# KAWARA 회청 기와·SHU 주칠·INK 먹·jroof 처마)·웨이브 5 재질(ek_wave5: MIZU 물·KOKE 이끼·AKI 낙엽·SOIL 흙·edges 가장자리)을
# 읽기만 해서 불러 쓴다(다른 폴더 파일은 고치지 않는다, __pycache__ 도 쓰지 않는다).
# 이 장소에 처음 나오는 재질만 같은 7단 램프 규칙(0 = 색 윤곽, 1~6 = 밝기, 그림자는 보랏빛으로 식고 빛은 데운다)으로 더한다:
#   gran  산 화강암(mountain-fortress 산 바위 MR 램프 — 버들항 돌보다 푸르스름한 회색)
#   bronze 청동(종·향로: 녹청 그늘 + 놋빛)        mist  안개(희뿌연 청백, 반투명으로 쓴다)
#   ginkgo 은행잎 노랑                            pine  소나무 짙은 잎(칩셋 잎보다 푸르고 어둡다)
# 결정적(같은 입력 = 같은 그림). 생성 이미지·트레이싱 없음. 3/4 시점(윗면 + 앞면, 옆면 없음), 빛 왼쪽 위, 1칸 = 16px.
import os, sys
sys.dont_write_bytecode = True
HERE = os.path.dirname(os.path.abspath(__file__))
VAR = os.path.abspath(os.path.join(HERE, '..'))
sys.path.insert(0, os.path.join(VAR, 'eastern-castle'))
sys.path.insert(0, HERE)
import numpy as np
from PIL import Image
from ek_base import *                                   # noqa  (TC·KAWARA·SHU·INK·jroof·plaster_wall·board_wall·ishigaki_k·chip_tones …)
from ek_base import _hash
import ek_base as EB
import ek_wave5 as W5                                   # noqa  (MIZU·KOKE·AKI·SOIL 재질 등록 + edges·cobble)
from ek_wave5 import edges, cobble, MIZUa, KOKEa, AKIa, SOILa, LEAFa, STa_, X16, Y16, _cell
import fr_mat
HERE = os.path.dirname(os.path.abspath(__file__))   # ek_base 의 HERE 를 덮는다

def _r(*cs): return [hx(c) for c in cs]
GRAN   = _r('#1a1d24', '#2c3038', '#43474c', '#5d605f', '#7e7f7a', '#a2a199', '#c7c4b8')   # 산 화강암(mountain-fortress MR)
BRONZE = _r('#0e1612', '#1c2c24', '#2c4436', '#3e5c44', '#6a7a48', '#a49450', '#dccc84')   # 청동(녹청 그늘 → 놋빛)
MIST   = _r('#5c6670', '#7a848e', '#98a2aa', '#b4bcc2', '#ccd2d6', '#e0e4e6', '#f2f4f4')   # 안개(반투명)
GINKGO = _r('#2e1e06', '#5a3c08', '#8a640e', '#b88e18', '#dcb22a', '#f0d248', '#faec90')   # 은행잎
PINE   = _r('#06100e', '#0c1e18', '#143022', '#1e442c', '#2c5a34', '#447640', '#6a9450')   # 소나무 잎
NEWW = {'gran': GRAN, 'bronze': BRONZE, 'mist': MIST, 'ginkgo': GINKGO, 'pine': PINE}
for n in NEWW:
    if n not in fr_mat.MID:
        fr_mat.MATS.append(n); fr_mat.MID[n] = len(fr_mat.MATS) - 1
_lut = np.zeros((len(fr_mat.MATS), 7, 3), np.uint8)
_lut[:fr_mat.LUT.shape[0]] = fr_mat.LUT
for n, r in NEWW.items():
    for k in range(7): _lut[fr_mat.MID[n], k] = r[k]
fr_mat.LUT = _lut
EB.RAMP.update(NEWW)
RAMP = EB.RAMP
GRANa = np.array(GRAN, int); MISTa = np.array(MIST, int); GINKa = np.array(GINKGO, int); PINEa = np.array(PINE, int)
KAWa = np.array(KAWARA, int); SHUa = np.array(SHU, int); INKa = np.array(INK, int); WDa = np.array(WD, int); PLa = np.array(PL, int)
