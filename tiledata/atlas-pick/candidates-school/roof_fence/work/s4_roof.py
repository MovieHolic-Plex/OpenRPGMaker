import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'school_gate', 'work'))
from s4_lib import C, write_item, shadow

# 옥상 철망 울타리 (16x32, 좌우 이음: 기둥 2px 이 왼쪽, 망은 절대 x 주기 4)
def fence(sty):
    c = C(16, 32)
    top = sty.get('top', 4); mesh = sty.get('mesh', 3); dk = sty.get('dk', 1); post = sty.get('post', 3)
    # 망: 마름모 (x+y)%4==0 와 (x-y)%4==0 대각선 1px
    for y in range(4, 28):
        for x in range(2, 16):
            if (x + y) % 4 == 0 or (x - y) % 4 == 0:
                c.px(x, y, 'fence', mesh if (x + y) % 8 < 4 else mesh - 1)
    # 위/아래 레일 (3줄 굵기: 밝음/중간/그늘)
    c.hl(0, 1, 16, 'fence', top + 1); c.hl(0, 2, 16, 'fence', top); c.hl(0, 3, 16, 'fence', dk + 1)
    c.hl(0, 28, 16, 'fence', top); c.hl(0, 29, 16, 'fence', dk + 1); c.hl(0, 30, 16, 'fence', dk)
    # 기둥 (왼쪽 2px): 밝은 줄 + 어두운 줄
    c.vl(0, 1, 30, 'fence', post + 1); c.vl(1, 1, 30, 'fence', post - 1 if post > 1 else 1)
    c.px(0, 1, 'fence', top + 1); c.px(0, 30, 'fence', dk)
    return c

def fence_A():
    c = fence({}); 
    # 바닥 그림자 없음: 레일이 바닥 앞. 한 줄 접지 그림자는 y31 반투명(모서리는 비움)
    for x in range(2, 14): c.px(x, 31, '-')
    return c
def fence_B():
    c = fence({'top': 5, 'mesh': 2, 'dk': 0, 'post': 4})
    for x in range(1, 15): c.px(x, 31, '~')
    # 점선 그림자 대신 기둥 하이라이트
    c.vl(0, 4, 24, 'fence', 5)
    return c
def fence_C():
    c = fence({'top': 3, 'mesh': 3, 'dk': 1, 'post': 3})
    # 위쪽 안쪽으로 꺾인 팔: 윗 레일 위에 2px 얹음, 오른쪽으로 사선 (y0 는 비워 모서리 유지)
    c.px(0, 0, 'fence', 4); c.px(1, 0, 'fence', 5)
    c.px(2, 0, 'fence', 5); c.px(3, 0, 'fence', 4); c.px(4, 0, 'fence', 3)
    c.px(2, 1, 'fence', 5)
    # 팔 아래 가시 없이 매듭 3개
    for x in (5, 9, 13): c.px(x, 2, 'fence', 5)
    for x in range(2, 14): c.px(x, 31, '-')
    return c

# 옥상 바닥 16x16 불투명 이음 (fence 램프 위주 + mconc 벗겨진 곳)
def floor(sty):
    c = C(16, 16)
    base = sty.get('base', 3)
    for y in range(16):
        for x in range(16): c.px(x, y, 'fence', base)
    # 손으로 놓은 얼룩(단 ±1)
    lite = [(2,3),(3,3),(9,2),(10,2),(12,5),(5,8),(6,8),(7,8),(13,11),(2,12),(3,12),(10,13)]
    darkp = [(6,1),(14,3),(1,6),(9,6),(4,10),(11,9),(7,13),(14,14),(0,9)]
    for x, y in lite: c.px(x, y, 'fence', base + 1)
    for x, y in darkp: c.px(x, y, 'fence', base - 1)
    # 배수 이음: 가로줄 한 줄 (y=0 , 위쪽 이웃과 연속) 
    for x in range(16): c.px(x, 0, 'fence', base - 1 if x % 5 else base - 2)
    return c

def floor_A():
    c = floor({})
    # 벗겨진 곳: 콘크리트 덩이 (가장자리에서 떨어짐)
    for (x, y, t) in [(9,7,4),(10,7,4),(11,7,3),(9,8,3),(10,8,4),(11,8,3),(10,9,2),(11,9,3)]: c.px(x, y, 'mconc', t)
    for (x, y, t) in [(3,4,3),(4,4,4),(3,5,3),(4,5,2)]: c.px(x, y, 'mconc', t)
    return c
def floor_B():
    c = floor({'base': 3})
    for (x, y, t) in [(8,6,5),(9,6,5),(10,6,4),(11,6,3),(8,7,5),(9,7,5),(10,7,5),(11,7,4),(8,8,4),(9,8,4),(10,8,3),(11,8,2),(9,9,3),(10,9,2)]: c.px(x, y, 'mconc', t)
    for (x, y, t) in [(3,3,5),(4,3,5),(3,4,4),(4,4,3),(3,5,2)]: c.px(x, y, 'mconc', t)
    # 벗겨진 곳 가장자리 짙게
    for (x, y) in [(7,6),(7,7),(8,9),(12,7),(12,8),(2,4),(5,4),(5,3)]: c.px(x, y, 'fence', 0)
    return c
def floor_C():
    c = C(16, 16)
    # 8x8 판 이음: 판마다 밝기 다름, 이음 1px
    for by in range(2):
        for bx in range(2):
            t = 3 if (bx + by) % 2 == 0 else 4
            for y in range(8):
                for x in range(8):
                    c.px(bx*8 + x, by*8 + y, 'fence', t)
            c.hl(bx*8, by*8, 8, 'fence', 1); c.vl(bx*8, by*8, 8, 'fence', 1)
            c.hl(bx*8 + 1, by*8 + 1, 7, 'fence', t + 1); c.vl(bx*8 + 1, by*8 + 1, 7, 'fence', t + 1)
    # 볼트 4개
    for (x, y) in [(3,3),(11,3),(3,11),(11,11)]: c.px(x, y, 'fence', 5); c.px(x+1, y+1, 'fence', 1)
    # 떨어진 모서리 조각
    for (x, y, t) in [(12,12,3),(13,12,4),(12,13,3),(13,13,2),(14,13,2)]: c.px(x, y, 'mconc', t)
    return c

if __name__ == '__main__':
    write_item(fence_A(), 'roof_fence', 'A', '옥상 철망 울타리: 왼쪽 기둥 2px, 위·아래 레일, 마름모 망(절대 x 주기 4로 좌우 이음), 초록 fence 램프')
    write_item(fence_B(), 'roof_fence', 'B', '같은 울타리 명암 강화: 기둥 하이라이트, 어두운 망, 밝은 레일, 바닥 반투명 그림자 한 줄')
    write_item(fence_C(), 'roof_fence', 'C', '재해석: 기둥 위에서 안쪽으로 꺾인 팔, 윗 레일에 매듭 셋')
    write_item(floor_A(), 'roof_floor', 'A', '옥상 방수 바닥: fence 램프 바탕에 얼룩, 위아래 배수 이음 줄, 벗겨진 콘크리트 두 곳(가장자리에서 떨어짐)')
    write_item(floor_B(), 'roof_floor', 'B', '벗겨진 곳 대비를 키운 명암 — 콘크리트 덩이가 크고 밝고 가장자리 짙게')
    write_item(floor_C(), 'roof_floor', 'C', '재해석: 8x8 판 이음 체크 패턴, 볼트 4개, 떨어진 모서리 조각')
