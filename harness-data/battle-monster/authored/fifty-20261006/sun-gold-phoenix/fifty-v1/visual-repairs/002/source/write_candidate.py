"""Writes final full literal rows from hand-authored spans and explicit patches.
Only blank initialization and copying of these fixed strings are used for artwork.
Run from any directory: python /absolute/source/write_candidate.py
"""
from pathlib import Path
import json
from action_clusters import *
ROOT=Path(__file__).resolve().parent

def save(name,g,folder='poses'):
    for b in SEAM_REPAIRS.get(name,[]): ink(g,b)
    (ROOT/folder).mkdir(exist_ok=True)
    (ROOT/folder/f'{name}.pxgrid').write_text('\n'.join(''.join(row) for row in g)+'\n')

def patches(g,blocks):
    for b in blocks: ink(g,b)
    return g

(ROOT/'palette.json').write_text(json.dumps(PALETTE,indent=2)+'\n')
save('idle_a',idle())
save('idle_b',patches(idle(),IDLE_B_PATCHES))
save('idle_c',patches(idle(),IDLE_C_PATCHES))
save('windup',build(head=WINDUP_HEAD,wing=WINDUP_WING))
save('move',patches(build(head=DASH_HEAD,wing=OPEN_WING,legs=STEP_LEGS,spread=True),FAN_TIPS))
save('attack',patches(build(head=DASH_HEAD,wing=OPEN_WING,legs=KICK_LEGS,spread=True),FAN_TIPS+[ATTACK_FACE,(123,'''44 kbdddddk..kbdddddk
44 kkkkkkk...kkkkkkk
''')]))
save('recover',build(head=WINDUP_HEAD,wing=WING))
save('hit',build(head=HIT_HEAD,wing=WINDUP_WING))
save('dead',patches(dead(),[DEAD_JOIN]))
save('sleep_a',sleep(),'actions')
save('sleep_b',patches(sleep(),SLEEP_BREATH_LOCAL),'actions')
save('poison_a',patches(build(head=SICK_HEAD,wing=WINDUP_WING),[SICK_WING_PATCH]+POISON_A_FX),'actions')
save('poison_b',patches(build(head=SICK_HEAD,wing=WINDUP_WING),[SICK_WING_PATCH,SICK_B_FACE,(88,'''45 kroaagovvvvrrssskk
46 kroaagovvvrrssskk
47 kroaagovvrrssskk
48 kroaagovrrssskk
49 kraagorrssskk
50 kraagrrsskk
''')]+POISON_B_FX),'actions')
save('stun_a',patches(build(head=STUN_HEAD,wing=WING),STUN_STARS_A),'actions')
save('stun_b',patches(build(head=STUN_HEAD,wing=WING),[STUN_B_NECK,STUN_B_SHOULDER]+STUN_STARS_B),'actions')
save('skill_a',skill_prep(),'actions')
save('skill_b',skill_cast(),'actions')
save('skill_c',skill_recover(),'actions')
# The current candidate includes the explicitly authored repair rows.
# Their draft input is preserved inside source/original-before-repair.
from repair_native import apply as apply_native_repairs
apply_native_repairs()
