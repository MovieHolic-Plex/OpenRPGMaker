# 마법사의 탑 안쪽 3개 층 — 3/4 재작업: 둥근 탑 안쪽(타원 바닥 + 휘어진 회반죽·돌 벽면 2칸 + 벽 윗띠).
# 1층 서재 / 2층 연금실 / 3층 천문대. 바닥·가구 조각은 interior, 벽/띠는 _common-4/rround.py, 손 도트 조각은 wt_pieces.
import os, sys
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, '..', '_common-4'))
import numpy as np
from PIL import Image
import c4, interior
import rround
import wt_pieces as WP

RW, RH = 16, 14
SPX, SPY = 9, 5          # 나선 계단 왼위 칸 (세 층 같은 자리)


def stair_extra(sp):
    return (sp, SPX * 16 - 1, SPY * 16 - 2, 'spiral', (SPX, SPY, SPX + 2, SPY + 2))


def sprite_at(img, cx, foot_cell_y, name, w_cells):
    x = cx * 16 + (w_cells * 16 - img.width) // 2
    y = foot_cell_y * 16 - img.height
    return (img, x, y, name, (cx, foot_cell_y - 1, cx + w_cells - 1, foot_cell_y - 1))


def _build(floor, wall, exit_col, wobj, fobj, extra, rugs=(), lits=(), block=()):
    im, walk, _ = rround.round_room(floor=floor, wall=wall, exit_col=exit_col, objs=fobj, wallobjs=wobj,
                                    extra=extra, rugs=rugs, lits=lits, block=block)
    return im, walk


def floor1(sp):        # 서재 — 회반죽 벽, 나무 바닥
    wobj = [('win', 4, 1), ('win', 11, 1), ('sconce', 6, 1), ('sconce', 9, 1), ('painting', 7, 1)]
    fobj = [('bookshelf', 4, 4), ('bookshelf', 6, 4), ('chest', 3, 8), ('table.long', 4, 9), ('candles', 5, 9),
            ('chair.u', 5, 8), ('stool', 12, 9), ('plant', 12, 7), ('mat', 8, 12)]
    ex = [stair_extra(sp), sprite_at(WP.globe(), 11, 10, 'globe', 1)]
    return _build('wood', 'plaster', 8, wobj, fobj, ex, rugs=[(5, 9, 4, 3)], lits=[(4, 3, 'wood'), (11, 3, 'wood')])


def floor2(sp):        # 연금실 — 돌 벽, 깃돌 바닥
    wobj = [('win', 4, 1), ('sconce', 6, 1), ('shelf.wall', 7, 1), ('herbs', 9, 1), ('sconce', 11, 1)]
    ath = WP.athanor()
    fobj = [('stove', 3, 5), ('cauldron', 6, 6), ('table.long', 4, 9), ('candles', 5, 9), ('pots', 7, 9),
            ('barrels', 12, 7), ('sacks', 11, 10), ('stool', 7, 11), ('chest', 12, 10), ('plant', 3, 10)]
    ex = [stair_extra(sp), sprite_at(ath, 6, 5, 'athanor', 2)]
    return _build('flag', 'stone', None, wobj, fobj, ex, lits=[(3, 3, 'flag')])


def floor3(sp, tele):        # 천문대 — 돌 벽, 깃돌 바닥
    wobj = [('win', 4, 1), ('win', 6, 1), ('win', 11, 1), ('sconce', 7, 1), ('sconce', 10, 1)]
    star = WP.starmap()
    fobj = [('table.sq', 4, 6), ('candles', 5, 6), ('crate', 12, 9), ('plant', 3, 9), ('stool', 7, 11)]
    ex = [stair_extra(sp), (star, 8 * 16, 1 * 16 + 14, 'starmap', None),
          sprite_at(tele, 6, 9, 'telescope', 2), sprite_at(WP.orrery(), 12, 7, 'orrery', 2)]
    return _build('flag', 'stone', None, wobj, fobj, ex)


def build_all(P=None):
    sp_up = c4.spiral_stair(up=True); sp_dn = c4.spiral_stair(up=False)
    tele = c4.telescope()
    if P is not None:
        for nm, f, note in WP.all_pieces(): P.add(nm, f(), note)
        P.add('telescope', tele, '삼각대 놋쇠 망원경 (32x40) — 3층 천문대')
        P.add('spiral-stair-up', sp_up, '나선 계단(오르는 쪽)')
        P.add('spiral-stair-down', sp_dn, '나선 계단(내려가는 쪽)')
    ims, walks = [], []
    for im, w in (floor1(sp_up), floor2(sp_up), floor3(sp_dn, tele)):
        ims.append(im); walks.append(w)
    strip = Image.new('RGBA', (RW * 16 * 3, RH * 16), (12, 8, 18, 255))
    for i, im in enumerate(ims): strip.paste(im, (i * RW * 16, 0))
    return strip, ims, walks


if __name__ == '__main__':
    strip, ims, walks = build_all()
    strip.resize((strip.width * 2, strip.height * 2), Image.NEAREST).save(os.path.join(HERE, '..', '_out-4', 'wt_int.png')); print(strip.size)
