"""Serialize hand-selected ASCII rows. No drawing or pose transforms."""
from pathlib import Path
import json
from PIL import Image

ROOT = Path(__file__).parent
PALETTE = {
    'o':'#17252F', 's':'#304453', 'b':'#506A7B', 'c':'#829BA7',
    'h':'#B9CDD0', 'j':'#144C50', 'k':'#247A75', 'l':'#53B6A0',
    'm':'#A4DFC0', 'g':'#765338', 'G':'#BE893E', 'Y':'#EBC16B',
    'w':'#FAE4AE', 'e':'#EE8560', 'n':'#253F66', 'v':'#795A9A',
    'P':'#C69CCB', 'E':'#E7FBF3'
}

def rows(block):
    return [(int(y), int(x), pixels) for y,x,pixels in
            (line.split() for line in block.strip().splitlines())]

def paint(canvas, block, width=None):
    for y,x,pixels in rows(block):
        if width is not None:
            pixels = pixels.ljust(width, '.')
        assert 0 <= x and x+len(pixels) <= 96, (y,x,len(pixels))
        canvas[y][x:x+len(pixels)] = pixels
    return canvas

def fresh(block):
    return paint([list('.'*96) for _ in range(96)], block)

def write(name, canvas, action=False):
    dest=ROOT/('actions' if action else 'poses')/(name+'.pxgrid')
    dest.write_text('\n'.join(''.join(row) for row in canvas)+'\n')

def png(canvas, name):
    im=Image.new('RGBA',(96,96))
    colors={k:tuple(bytes.fromhex(v[1:]))+(255,) for k,v in PALETTE.items()}
    im.putdata([colors.get(p,(0,0,0,0)) for row in canvas for p in row])
    im.save(ROOT/'progress'/f'{name}.png')
    im.resize((384,384),Image.Resampling.NEAREST).save(ROOT/'progress'/f'{name}-4x.png')

if __name__ == '__main__':
    from design import BODY, HEAD, FORELEGS, FARFORE, TAIL, ORNAMENT
    ROOT.joinpath('palette.json').write_text(json.dumps(PALETTE,indent=2)+'\n')
    idle=fresh(BODY)
    paint(idle,TAIL)
    paint(idle,HEAD)
    paint(idle,FARFORE)
    paint(idle,FORELEGS)
    paint(idle,ORNAMENT)
    write('idle_a',idle)
    png(idle,'idle')
    from pose_rows import *
    from rest_rows import *
    from magic_rows import *
    from copy import deepcopy
    from refinements import *

    # Stable material patches are shared; anatomical changes are literal rows.
    paint(idle,CLOUD_IDLE)
    paint(idle,SHOULDER_SCALE)
    write('idle_a',idle)
    png(idle,'idle')
    frames={'idle_a':idle}
    for name, block in [('idle_b',IDLE_B),('idle_c',IDLE_C)]:
        canvas=deepcopy(idle)
        paint(canvas,block)
        paint(canvas,SHOULDER_SCALE)
        frames[name]=canvas
    wind=deepcopy(idle)
    paint(wind,WIND_HEAD,53)
    paint(wind,BRACE_SHOULDER)
    paint(wind,WIND_PAW,42)
    frames['windup']=wind
    move=deepcopy(idle)
    paint(move,LIFT_PAW,36)
    paint(move,LIFT_ERASE)
    paint(move,'''
40 66 ccbbbooobcccc
41 66 ccboeYobccccc
42 66 cccbbYoobcccc
43 46 jklmmmllkjgYYwhhccccbbbbbbcccccccsoo
44 47 jklmmmlljgYYwhhhccccccccccccccchhhhso
69 44 jklmmmlllkkjossbbccchhhso
70 44 jklmmmlmlkkjossbbccchhhso
71 45 jklmmmllkkj.ossbbccchhhso
''')
    frames['move']=move
    attack=deepcopy(idle)
    paint(attack,ATTACK_HEAD,53)
    paint(attack,ATTACK_SHOULDER)
    paint(attack,STOMP_PAW,42)
    frames['attack']=attack
    recover=deepcopy(idle)
    paint(recover,RECOVER)
    frames['recover']=recover
    hit=deepcopy(idle)
    paint(hit,HIT_HEAD,53)
    paint(hit,BRACE_SHOULDER)
    paint(hit,WIND_PAW,42)
    paint(hit,'''
63 13 osbbbbbbccccbbbbbbssssssssssbbssso
64 14 osbbbbbcccccbbbbbsssssssssssbbssso
65 15 osbbbbccchccbbbbssssssssssssbbssso
66 16 osbbbccchhhccbbsssssssssssscccbbso
67 17 osbbccchhhhccbssssssssssssccccbso
68 18 osbbccchhhccbbssssssssssscccccso
''')
    frames['hit']=hit
    dead=fresh(DEAD)
    paint(dead,DEAD_HEAD)
    paint(dead,DEAD_PAW)
    frames['dead']=dead

    charge=deepcopy(wind)
    paint(charge,CHARGE)
    paint(charge,CLOUD_CHARGE)
    paint(charge,'''
46 66 bbEYoobcccc
47 66 bbooobbccccc
63 42 jklmmmmllllkjossbbccchhhso
64 42 jklmmmllllkjjossbbccchhhso
65 42 jklmmmlmlkkjjossbbccchhhso
''')
    frames['skill_a']=charge
    cast=deepcopy(idle)
    paint(cast,CAST_HEAD,53)
    paint(cast,FARFORE)
    paint(cast,FORELEGS)
    paint(cast,'''
60 58 gGGYwYGGgo
61 57 gGYYwYYGGgo
62 57 gGYYmYGGGgo
63 57 gGYYlmYGGgo
64 58 gGGYlmYGGgo
65 59 ggGYmYGGgo
66 60 ggGYYGGgo
67 61 ogGGGgo
83 59 ogGGGGGGGGGgo
84 59 gGYYwYYYYGGGgo
85 59 gGYYwwYYGGGGgo
86 58 gGGGYYGGGGgggo
87 57 ogggGGgggggso
''')
    paint(cast,BOLT)
    paint(cast,CLOUD_CAST)
    frames['skill_b']=cast
    rem=deepcopy(recover)
    paint(rem,SKILL_RECOVER)
    paint(rem,RESIDUAL)
    paint(rem,CLOUD_RECOVER)
    frames['skill_c']=rem
    sick=deepcopy(idle)
    paint(sick,SICK_HEAD,53)
    paint(sick,SICK_SHOULDER)
    paint(sick,SICK_KNEES,33)
    paint(sick,POISON_A)
    frames['poison_a']=sick
    sick_b=deepcopy(idle)
    paint(sick_b,SICK_HEAD,53)
    paint(sick_b,SICK_SHOULDER)
    paint(sick_b,SICK_KNEES,33)
    paint(sick_b,POISON_B)
    frames['poison_b']=sick_b
    dazed=deepcopy(idle)
    paint(dazed,STUN_HEAD,53)
    paint(dazed,BRACE_SHOULDER)
    paint(dazed,WIND_PAW,42)
    paint(dazed,STARS_A)
    frames['stun_a']=dazed
    dazed_b=deepcopy(idle)
    paint(dazed_b,STUN_HEAD,53)
    paint(dazed_b,BRACE_SHOULDER)
    paint(dazed_b,WIND_PAW,42)
    paint(dazed_b,STUN_B_CHANGES)
    paint(dazed_b,STARS_B)
    frames['stun_b']=dazed_b
    asleep=fresh(SLEEP)
    paint(asleep,SLEEP_TAIL)
    paint(asleep,SLEEP_HEAD)
    paint(asleep,SLEEP_PAWS)
    paint(asleep,SLEEP_EYE)
    frames['sleep_a']=asleep
    asleep_b=deepcopy(asleep)
    paint(asleep_b,SLEEP_B)
    frames['sleep_b']=asleep_b
    for name,canvas in frames.items():
        if name not in {'dead','sleep_a','sleep_b'}:
            paint(canvas,HEAVY_HAUNCH)
            if name in {'idle_a','idle_b','idle_c','move','recover','skill_c'}:
                paint(canvas,LION_JAW)
        elif name == 'dead':
            paint(canvas,DEAD_SCALE)
            paint(canvas,CLOSED_DEAD_EYE)
        else:
            paint(canvas,REST_SCALE)
            paint(canvas,CLOSED_SLEEP_EYE)
    actions={'skill_a','skill_b','skill_c','poison_a','poison_b',
             'stun_a','stun_b','sleep_a','sleep_b'}
    for name, canvas in frames.items():
        write(name,canvas,name in actions)
        png(canvas,name)
    png(frames['idle_a'],'idle')
