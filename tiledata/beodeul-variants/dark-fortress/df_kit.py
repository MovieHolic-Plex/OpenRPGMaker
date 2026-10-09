# 마왕성(dark-fortress) 공용: graveyard-crypt 의 gc_kit/gc_ext/gc_map/gc_page 를 그대로 가져다 쓰고, 검은 돌·붉은 천·용암 재료를 더한다.
import os, sys
HERE0 = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE0, '..', 'graveyard-crypt'))
from gc_kit import *
from gc_kit import _hash, _pn1
import gc_ext, gc_map, gc_page
from gc_ext import SAMPLES, mk_floor, flagp, face_sample, ceiling_sample, autotile_mask, atile_img
from gc_map import KMap, foot
import dlib
HERE = HERE0
# 검은 돌: 보라 윤곽 → 어두운 보라 → 밝은 보라회색 (버들항 돌 램프를 보라 쪽으로 옮김)
OB = [(18, 14, 26), (30, 26, 40), (46, 42, 60), (66, 60, 84), (94, 88, 116), (126, 120, 148), (164, 158, 184)]
BLK = OB
RDK = [(34, 8, 18), (74, 14, 28), (122, 22, 34), (168, 34, 40), (212, 56, 48), (240, 100, 70), (252, 160, 110)]       # 붉은 천
LAV = [(60, 8, 6), (130, 22, 8), (206, 56, 12), (240, 112, 20), (252, 176, 40), (255, 228, 120)]                      # 용암
GLD = GD
def rcol(k): return RDK[clamp(k, 0, 6)]
