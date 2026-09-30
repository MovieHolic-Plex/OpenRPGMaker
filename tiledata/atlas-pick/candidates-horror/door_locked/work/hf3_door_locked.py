import sys, os
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, '..', '..', 'door_wood', 'work'))
from hf3_lib import *
import hf3_door_wood as W
S = 'door_locked'

def chain_lock(cv, cy, lx, hi=5, mid=4, lo=3, dk=1, shadow_r='mahog', shadow_t=0, ramp='tin'):
    """가로 사슬 두 줄(cy, cy+1)과 사슬에 걸린 자물쇠(x=lx..lx+3, 몸 4줄)."""
    pat0 = [hi, hi, mid, None, hi, hi, mid, None, hi, hi]
    pat1 = [lo, None, lo, mid, lo, None, lo, mid, lo, None]
    for i in range(10):
        if pat0[i] is not None: cv.px(3 + i, cy, ramp, pat0[i])
        if pat1[i] is not None: cv.px(3 + i, cy + 1, ramp, pat1[i])
    # 걸쇠(사슬 아래로)
    cv.px(lx + 1, cy + 2, ramp, hi); cv.px(lx + 3, cy + 2, ramp, lo)
    y = cy + 3
    cv.rect(lx, y, lx + 3, y + 3, ramp, mid)
    cv.hl(y, lx, lx + 3, ramp, hi); cv.vl(lx, y, y + 3, ramp, hi)
    cv.vl(lx + 3, y + 1, y + 3, ramp, lo); cv.hl(y + 3, lx + 1, lx + 3, ramp, lo)
    cv.px(lx + 2, y + 1, ramp, dk); cv.px(lx + 2, y + 2, ramp, dk)
    cv.hl(y + 4, lx + 1, lx + 4, shadow_r, shadow_t)

def A():
    cv, _ = W.A(); chain_lock(cv, 18, 5)
    return cv, '잠긴 문 A — door_wood A 와 같은 문(틀·패널·손잡이 그대로), 가로 사슬 두 줄(쇠 5·4·3단)과 사슬에 걸린 쇠 자물쇠(열쇠구멍 1단). 사슬이 문짝(3단)보다 두 단 이상 밝아 어둠에서도 읽힌다.'

def B():
    cv, _ = W.B(); chain_lock(cv, 18, 5, hi=6, mid=5, lo=3, dk=0, shadow_t=0)
    return cv, '잠긴 문 B — door_wood B(짙은 문짝·밝은 틀) 위에 가장 밝은 쇠 6단 사슬과 큼직한 자물쇠. 문짝 1단 대 사슬 6단 — 어두운 방에서 사슬이 먼저 보인다.'

def C():
    cv, _ = W.C(); chain_lock(cv, 14, 4, hi=5, mid=4, lo=2, dk=0, shadow_r='rot', shadow_t=0)
    return cv, '잠긴 문 C — door_wood C(세로 판자·쇠 띠 경첩·고리 손잡이) 위에 사슬과 자물쇠. 경첩과 겹치지 않게 사슬을 위 경첩·고리 사이(y14~15)에 둔다.'

if __name__ == '__main__':
    for n, f in zip('ABC', (A, B, C)):
        cv, note = f(); cv.emit(S, 'hf3-' + n, note)
