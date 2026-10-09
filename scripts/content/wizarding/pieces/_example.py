"""API 견본(굽기에서 제외: 이름이 _ 로 시작). 새 모듈은 이 모양을 따른다.
  python3 scripts/content/wizarding/pieces/_example.py   → 검사 + tiledata/wizarding/review/_example.png
"""
import os, sys
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
from wzlib import REG, Cv, K, OL, OL2, run_module   # noqa: E402

MODULE = '_example'


@REG.piece('wz-ex-stool', '오크 둥근 의자', 1, 1, ['S'], 'furniture', 'shared',
           desc='오크 둥근 의자 1칸. 좌면 높이 9px.', rules='탁자 앞 바닥에 놓는다.', tags=['의자'])
def _stool(c):
    c.R(5, 9, 2, 6, K('wood', 2)); c.R(10, 9, 2, 6, K('wood', 1))          # 다리
    c.ellipse(8, 7, 5.5, 3, K('wood', 3)); c.ellipse(8, 6, 5, 2.5, K('wood', 4))
    c.HL(5, 5, 3, K('wood', 5))
    c.outline()


@REG.piece('wz-ex-candle', '황동 촛대(불꽃 4프레임)', 1, 1, ['S'], 'effects', 'shared',
           desc='황동 촛대 위 촛불 4프레임.', frames=4, fps=6, tags=['촛불'])
def _candle(c, f):
    c.R(6, 13, 5, 2, K('brass', 2)); c.HL(6, 13, 5, K('brass', 4))
    c.R(7, 7, 3, 6, K('linen', 3)); c.VL(7, 7, 6, K('linen', 4))
    h = (4, 5, 4, 3)[f]; dx = (0, 0, 1, 0)[f]
    c.R(8 + dx, 7 - h, 1, h, K('fire', 2)); c.P(8 + dx, 7 - h, K('fire', 3)); c.P(8, 6, K('fire', 4))
    c.outline()


@REG.autotile('wz-ex-flag', '마른 석재 포석', 'surfaces', 'shared', desc='성채 실내 포석(바깥은 오크 바닥).')
def _flag():
    p = Cv(48, 48); p.planks(0, 0, 48, 48, 'wood', 3)
    p.stone_blocks(3, 3, 42, 42, 'stone', 3, seed=4)
    p.outline_rect(2, 2, 44, 44, K('stone', 0))
    ic = Cv(16, 16); ic.stone_blocks(0, 0, 16, 16, 'stone', 3, seed=4)
    for x, y in ((0, 0), (15, 0), (0, 15), (15, 15)): ic.R(x - 1 if x else 0, y - 1 if y else 0, 2, 2, K('wood', 3))
    return p, ic


@REG.character('wz-ex-student', '견본 학생', 'shared', desc='API 견본.')
def _student(c, d, f):
    bob = 1 if f != 1 else 0
    c.R(7, 12 + bob, 10, 16, K('night', 1))
    c.R(8, 4 + bob, 8, 8, K('skin', 3) if d != 'up' else K('hair_dark', 2))
    c.R(8, 3 + bob, 8, 3, K('hair_dark', 2))
    c.R(8 + (f - 1) * 2, 28, 3, 3, OL2); c.R(13 - (f - 1) * 2, 28, 3, 3, OL2)
    c.outline()


REG.example('wz-ex-room', '견본 방', 'shared', 6, 5, 'wz-ex-flag', [('wz-ex-stool', 2, 2), ('wz-ex-candle', 4, 1)])

if __name__ == '__main__':
    sys.exit(1 if run_module(MODULE) else 0)
