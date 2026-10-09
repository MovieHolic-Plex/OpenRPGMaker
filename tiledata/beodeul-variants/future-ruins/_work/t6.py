import sys; sys.path.insert(0,'.'); sys.path.insert(0,'_work')
from fr_mech import *
from board import board
items=[('hulk',robot_hulk()),('arm',robot_arm()),('machine',rust_machine()),('sentry',sentry_wreck())]
board(items,'_work/t6.png',scale=4,cols=4)
