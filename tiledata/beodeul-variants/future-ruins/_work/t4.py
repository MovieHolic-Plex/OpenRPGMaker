import sys; sys.path.insert(0,'.'); sys.path.insert(0,'_work')
from fr_props import *
from board import board
items=[('pole',power_pole()),('pole_lean',power_pole(seed=2,lean=.12,broken=True)),('sign_on',sign_blink(True)),('sign_off',sign_blink(False)),
 ('signal_on',signal_post(True)),('signal_off',signal_post(False)),('drums',toxic_drums()),('drum',drum_single()),('container',container()),
 ('car',car_wreck()),('barrier',jersey_barrier()),('barrier_b',jersey_barrier(True)),('lamp',streetlamp_bent()),('pipe_run',pipe_run()),
 ('elbow',pipe_elbow()),('vent',vent_fan()),('fvent',floor_vent()),('manhole',manhole()),('rubble',rubble_conc()),('rubble_s',rubble_small()),
 ('girder',girder_pile()),('reel',cable_reel()),('fence',fence_chain()),('shards',glass_shards()),('oil',oil_stain()),('weeds',weeds_sick()),('droop',cable_droop())]
board(items,'_work/t4.png',scale=3,cols=7)
