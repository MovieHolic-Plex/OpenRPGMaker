import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'door_wood', 'work'))
from hf3_lib import *
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'window_night', 'work'))
from hf3_window_night import frame
S = 'window_curtain'

def drape(cv, hi, mid, lo, dk, gap=7, rod=(5, 4, 2), lit=3):
    """x4..11,y4..11 유리 자리에 커튼 두 폭. 왼 폭 x4..gap-1, 오른 폭 gap+1..11, 가운데 1px 틈(달빛)."""
    for y in range(4, 12):
        cv.px(gap, y, 'moon', lit if y % 2 == 0 else lit - 1)
    for y in range(5, 12):
        # 왼 폭: 주름 x4(그늘) x5(밝음) x6(중간)
        cv.px(4, y, 'velv', lo); cv.px(5, y, 'velv', hi); cv.px(6, y, 'velv', mid)
        cv.px(8, y, 'velv', mid); cv.px(9, y, 'velv', hi); cv.px(10, y, 'velv', lo); cv.px(11, y, 'velv', dk)
    cv.px(6, 11, 'velv', lo); cv.px(8, 11, 'velv', lo)
    # 봉
    for x in range(4, 12): cv.px(x, 4, 'tarn', rod[0] if x < 8 else rod[1])
    cv.px(3, 4, 'tarn', rod[0]); cv.px(12, 4, 'tarn', rod[2])

def A():
    cv = Cv(16, 16)
    frame(cv, 'mahog', 1, 5, 3, 2, 4, 3, 5, 2)
    drape(cv, 3, 2, 1, 0)
    return cv, '커튼 창 A — window_night A 와 같은 틀, 벨벳 두 폭이 닫혀 가운데 1px 틈으로만 달빛(moon), 세로 주름(밝음 3·중간 2·그늘 1), 위 놋 커튼 봉. 벨벳은 옅은 붉은 기 없이 4단 이하.'

def B():
    cv = Cv(16, 16)
    frame(cv, 'mahog', 0, 6, 5, 3, 6, 5, 6, 3)
    drape(cv, 4, 2, 0, 0, rod=(5, 4, 3), lit=5)
    return cv, '커튼 창 B — window_night B 와 같은 밝은 틀, 벨벳 주름 밝은 줄 4단·그늘 0단으로 폭 대비를 키우고 틈의 달빛은 moon 5단. 어두운 방에서 틈 한 줄과 틀선이 읽힌다.'

def C():
    cv = Cv(16, 16)
    frame(cv, 'rot', 0, 5, 4, 2, 3, 3, 5, 2)
    drape(cv, 3, 2, 1, 0, rod=(4, 3, 1))
    # 아래로 처진 레이스 자락(주름 밑단에 톱니) + 술
    cv.px(4, 11, 'velv', 0); cv.px(7, 11, 'moon', 2)
    for (x, y) in [(5, 10), (9, 10)]: cv.px(x, y, 'velv', 4)
    cv.px(4, 8, 'tarn', 3); cv.px(4, 9, 'tarn', 2)
    return cv, '커튼 창 C — window_night C 의 rot 틀 + 무거운 벨벳 두 폭, 왼 폭에 놋 묶음 끈(술) 하나, 가운데 틈 달빛, 봉 놋 4~1단.'

if __name__ == '__main__':
    for n, f in zip('ABC', (A, B, C)):
        cv, note = f(); cv.emit(S, 'hf3-' + n, note)
