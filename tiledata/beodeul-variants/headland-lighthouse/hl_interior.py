# 등대 안쪽 3개 층 — 3/4 재작업: 둥근 탑 안쪽(타원 바닥 + 뒤쪽 휘어진 벽면 2칸 + 벽 윗띠).
# 바닥·가구 조각은 interior 의 것, 벽/띠는 _common-4/rround.py 가 그린다. 세 층을 가로로 나란히 한 장에.
import os, sys
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, '..', '_common-4'))
import numpy as np
from PIL import Image
import c4, interior
from interior import SIZE
import rround

RW, RH = 16, 14
SPX, SPY = 9, 5          # 나선 계단 왼위 칸 (세 층 같은 자리 — 위아래로 이어진다)


def stair_extra(sp):
    return (sp, SPX * 16 - 1, SPY * 16 - 2, 'spiral', (SPX, SPY, SPX + 2, SPY + 2))


def _build(floor, wall, exit_col, wobj, fobj, extra, rugs=(), lits=(), block=()):
    im, walk, _ = rround.round_room(floor=floor, wall=wall, exit_col=exit_col, objs=fobj, wallobjs=wobj,
                                    extra=extra, rugs=rugs, lits=lits, block=block)
    return im, walk


def floor1(sp):
    wobj = [('win', 4, 1), ('win', 11, 1), ('sconce', 6, 1), ('sconce', 9, 1), ('shelf.wall', 7, 1)]
    fobj = [('barrels', 4, 5), ('crates', 3, 7), ('sacks', 6, 4), ('pots', 7, 4),
            ('cauldron', 12, 7), ('table.sq', 4, 9), ('candles', 4, 9), ('stool', 3, 10), ('stool', 6, 10),
            ('chest', 12, 9), ('plant', 4, 11), ('mat', 8, 12)]
    return _build('flag', 'stone', 8, wobj, fobj, [stair_extra(sp)],
                  rugs=[(6, 7, 3, 3)], lits=[(4, 3, 'flag'), (11, 3, 'flag')])


def floor2(sp):
    wobj = [('win', 3, 1), ('sconce', 5, 1), ('fireplace', 6, 1), ('sconce', 9, 1), ('painting', 10, 1), ('win', 12, 1)]
    fobj = [('bookshelf', 4, 4), ('bed.single', 3, 6), ('chest', 3, 8),
            ('table.sq', 5, 9), ('chair.r', 4, 9), ('chair.l', 7, 9), ('candles', 6, 9),
            ('pots', 12, 9), ('plant', 4, 11), ('stool', 11, 8)]
    return _build('wood', 'stone', None, wobj, fobj, [stair_extra(sp)],
                  rugs=[(5, 7, 4, 2)], lits=[(3, 3, 'wood')], block=[(6, 3, 8, 3)])


def floor3(sp, lens, tele):
    wobj = [('win', 4, 1), ('sconce', 6, 1), ('win', 8, 1), ('sconce', 10, 1), ('win', 12, 1)]
    fobj = [('table.long', 5, 10), ('stool', 4, 10), ('candles', 5, 10), ('sacks', 12, 9), ('plant', 3, 6)]
    ex = [stair_extra(sp),
          (lens, 88, 68, 'lens', (5, 5, 7, 7)),
          (tele, 48, 120, 'telescope', (3, 8, 4, 9))]
    return _build('flag', 'stone', None, wobj, fobj, ex)


def build_all(P=None):
    sp_up = c4.spiral_stair(up=True); sp_dn = c4.spiral_stair(up=False)
    lens = c4.lamp_lens(); tele = c4.telescope()
    if P is not None:
        P.add('spiral-stair-up', sp_up, '돌 우물 위 나선 계단(오르는 쪽) — 밟판 10장, 중앙 기둥 (50x50)')
        P.add('spiral-stair-down', sp_dn, '나선 계단(내려가는 쪽)')
        P.add('lamp-lens', lens, '등대 등방 프레넬 렌즈 — 받침·유리 동체·붉은 돔 (40x58)')
        P.add('telescope', tele, '삼각대 놋쇠 망원경 (32x40)')
    ims, walks = [], []
    for im, w in (floor1(sp_up), floor2(sp_up), floor3(sp_dn, lens, tele)):
        ims.append(im); walks.append(w)
    strip = Image.new('RGBA', (RW * 16 * 3, RH * 16), (12, 8, 18, 255))
    for i, im in enumerate(ims): strip.paste(im, (i * RW * 16, 0))
    return strip, ims, walks


if __name__ == '__main__':
    strip, ims, walks = build_all()
    strip.save(os.path.join(HERE, '..', '_out-4', 'hl_int.png')); print(strip.size)
