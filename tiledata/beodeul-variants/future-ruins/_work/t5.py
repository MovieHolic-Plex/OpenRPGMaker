import sys; sys.path.insert(0,'.'); sys.path.insert(0,'_work')
from fr_props import *
from board import board
items=[('pole',power_pole()),('sign_on',sign_blink(True)),('drums',toxic_drums()),('container',container()),
 ('car',car_wreck()),('vent',vent_fan()),('girder',girder_pile()),('rubble',rubble_conc()),('elbow',pipe_elbow())]
board(items,'_work/t5.png',scale=5,cols=5)
