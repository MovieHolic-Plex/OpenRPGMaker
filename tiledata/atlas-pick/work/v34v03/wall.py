import sys; sys.path.insert(0,'/home/main/.t3/worktrees/rpg-zzu/t3code-8b4b09de-jp-pick/tiledata/atlas-pick/work/v34v03')
from lib import *

def tall(c,x0,x1,y0,yb,R,o,lit,hi,sh,fb,edge=None,dark=None,tstep=3):
    """벽 붙이 키 큰 가구 틀. y0 = 윗면 뒤 윤곽 행, yb = 마지막 몸통 행. 윗면 T = 윤곽+밝은 3행+앞모서리 하이라이트(t=5), 처마 그림자 2행, 앞면 F."""
    w=x1-x0+1
    edge = edge if edge is not None else fb+1
    dark = dark if dark is not None else fb-1
    c.hl(x0+1,y0,w-2,(R,o))                        # 뒤 가장자리 선
    c.rect(x0,y0+1,w,3,(R,lit)); c.px(x0,y0+1,(R,o)); c.px(x1,y0+1,(R,o))
    c.hl(x0,y0+4,w,(R,hi))                          # 앞 가장자리 하이라이트
    c.hl(x0,y0+5,w,(R,sh)); c.hl(x0,y0+6,w,(R,sh))  # 처마 그림자
    c.rect(x0,y0+7,w,yb-y0-6,(R,fb))               # 앞면 (들어감)
    c.vl(x0,y0+7,yb-y0-6,(R,edge)); c.vl(x1,y0+7,yb-y0-6,(R,dark))
    c.hl(x0,yb,w,(R,dark))
    return y0+7
