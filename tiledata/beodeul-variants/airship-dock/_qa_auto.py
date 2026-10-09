# 오토타일 시험 그림(check-autotile.png) 만들기 — make 에서도 부른다.
from ad_auto import *
import ad_ground as G
def bg(fn): return lambda x, y: G.cell_of_ground(fn, x % 3, y % 3)
def check(path):
    rows = [('cloud-cliff on highland grass', cliff_sheet(), bg(G.grass_px)),
            ('coal-dust on cliff rock', coal_sheet(), bg(G.rock_px)),
            ('plank-puddle on dock planks', puddle_sheet(), bg(G.plank_px)),
            ('iron-railing on cliff rock', railing_sheet(), bg(G.rock_px))]
    AB.check_sheet(path, rows, scale=2)
if __name__ == '__main__': check('_qa/check-autotile.png')
