import sys; sys.path.insert(0,'.'); sys.path.insert(0,'_work')
from fr_struct import *
from board import board
items=[('tank',storage_tank()),('bill',billboard_frame()),('wall',ruin_wall(3,1)),('wall4',ruin_wall(4,5))]
board(items,'_work/t8.png',scale=4,cols=4)
