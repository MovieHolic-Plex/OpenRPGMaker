# 대나무 숲 계곡(bamboo-valley, 장르 wuxia) 공용 바탕.
# 버들항 파이프라인 → 미래 폐허 톤 캔버스(fr_base·fr_mat) → 동양풍 성(eastern-castle: ek_base 의 KAWARA·SHU·TAKE·INK·KAYA 램프,
# ek_wave5 의 MIZU·KOKE·AKI·SOIL 램프와 불규칙 가장자리 edges()·막돌 cobble()) 를 그대로 불러 쓴다(다른 폴더 파일은 읽기만).
# 장르 규격: tiledata/beodeul-kits/genres/wuxia.md (회청 기와 + 주칠 기둥 + 회색 석재 + 먹빛 원경, 대나무 = TAKE).
# 이 장소에 처음 나오는 재질만 같은 7단 램프 규칙(0 = 색 윤곽, 1~6 = 밝기)으로 더한다:
#   kare  마른 대나무 잎(누런 올리브 → 볏짚 빛: 대숲 바닥에 쌓인 잎)
#   kasumi 안개(밝은 회청 — 디더 한 겹 단색 덩이로만 쓴다, 반투명·그라데이션 금지)
#   sei   푸른 이끼 바위 물때(개울 바위 젖은 면, 청록 회색)
# 결정적(같은 입력 = 같은 그림). 생성 이미지·트레이싱 없음. 3/4 시점(윗면 + 앞면, 옆면 없음), 빛 왼쪽 위, 1칸 = 16px.
import os, sys
sys.dont_write_bytecode = True
_HERE = os.path.dirname(os.path.abspath(__file__))
VAR = os.path.abspath(os.path.join(_HERE, '..'))
EK = os.path.join(VAR, 'eastern-castle')
sys.path.insert(0, EK)
import numpy as np
from PIL import Image
from ek_base import *                                       # noqa  TC·clamp·hash2·_hash·chip_tones·jroof·pad16·flip·shadow_under·leaf_tex …
from ek_base import _hash
import ek_wave5 as W5                                       # MIZU·KOKE·AKI·SOIL 램프 등록 + edges·cobble
from ek_wave5 import edges, cobble, MIZUa, KOKEa, AKIa, SOILa, LEAFa, STa_, X16, Y16, _cell
import fr_mat

HERE = _HERE
ROOT = os.path.abspath(os.path.join(VAR, '..', '..'))


def _r(*cs): return [hx(c) for c in cs]
KARE   = _r('#1a1608', '#36301a', '#544a26', '#746636', '#94844a', '#b4a464', '#d6c890')   # 마른 대나무 잎
KASUMI = _r('#5a6670', '#7a8690', '#98a4ac', '#b0bac0', '#c4ccd0', '#d6dcde', '#e6eaea')   # 안개(밝은 회청)
SEI    = _r('#0a1614', '#162a28', '#22403a', '#30564c', '#46705e', '#628a74', '#8aaa92')   # 젖은 바위 물때
NEWB = {'kare': KARE, 'kasumi': KASUMI, 'sei': SEI}
for n in NEWB:
    if n not in fr_mat.MID:
        fr_mat.MATS.append(n); fr_mat.MID[n] = len(fr_mat.MATS) - 1
_lut = np.zeros((len(fr_mat.MATS), 7, 3), np.uint8)
_lut[:fr_mat.LUT.shape[0]] = fr_mat.LUT
for n, r in NEWB.items():
    for k in range(7): _lut[fr_mat.MID[n], k] = r[k]
fr_mat.LUT = _lut
RAMP.update(NEWB)
KAREa = np.array(KARE, int); KASa = np.array(KASUMI, int); SEIa = np.array(SEI, int)
TAKEa = np.array(TAKE, int); INKa = np.array(INK, int)
