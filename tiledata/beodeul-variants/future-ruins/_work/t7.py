import sys; sys.path.insert(0,'.'); sys.path.insert(0,'_work')
from fr_struct import *
from board import board
items=[('span',overpass_span()),('pier',overpass_pier()),('fallen',deck_fallen()),('gate',factory_gate()),('tall',ruin_block(4,3,.6,seed=1,tank=True)),('low',ruin_block(3,3,.45,seed=2,tank=True)),('drub',dome_rubble())]
board(items,'_work/t7.png',scale=3,cols=4)
