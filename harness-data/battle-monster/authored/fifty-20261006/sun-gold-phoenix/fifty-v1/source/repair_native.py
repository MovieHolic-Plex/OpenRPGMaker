"""Chosen native ASCII rows for the six requested repairs.

Reads the preserved draft, writes these literal spans, and saves full 128px rows.
Padding is transparent canvas only. No silhouette or shading is calculated.
"""
from pathlib import Path
import shutil
from literal_clusters import ink
from pose_clusters import DASH_HEAD, SICK_HEAD, SICK_B_FACE, STUN_HEAD, STUN_B_NECK
from action_clusters import CAST_HEAD

ROOT = Path(__file__).resolve().parent
ORIGINAL = ROOT / 'original-before-repair'

# y, x, right boundary (exclusive), then one explicitly chosen row per y.
CHEST = (66, 74, 96, '''
aaovvoaagggvrsk
aovvoagghhggvrsk
ovvoagghhhhggovrsk
vvoagghhhhhgggovrsk
voagghhhhhggggaovrsk
oaagghhhhggggaaovvrsk
oaagghhhggggaaovvvrsrk
voaagggggggaaovvvvrsrk
vvoaagggggaaovvvvvrrsk
vvvoaaggaaovvvvvvvrrsk
vvvvoaaovvvvvvvvvvrrsk
vvvvvoovvvvvvvvvvvrrsk
vvvoagggggggovvvvvrrsk
vvoagghhhggggaovvvrrsk
voagghhhhggggaaovvrrsk
oaagghhhgggggaaovvrrsk
oaagghhggggaaovvvrrsk
voaaggggggaaovvvvrrsk
vvoaaggggaaovvvvrrsk
vvvoaggaaovvvvvrrsk
vvvvoaaovvvvvvvrrsk
vvvvvovvvvvvvvvrrsk
vvvoagggggaovvvrrsk
vvoagghhggggaovrrsk
voagghhhgggaaovrrsk
oaagghhgggaaovrrsk
oaagggggaaovvrrsk
voaagggaaovvrrsk
vvoaggaovvvrrsk
vvvoaaovvvrrsk
vvvvovvvvrrsk
vvvoaagovrrsk
vvoaggaovrsk
voagggovrsk
oaaggovrsk
oaagovrskcbk
oaagvrskb dcck
oagvrskkbddcck
agvrskkbddcck
gvrskkbddcck
'''.replace('b d', 'bd'))

# Hooked upper beak: a long bright ridge curls into a dark underside.
IDLE_HOOK = (33, 94, 115, '''
aaaggkk
aaaagggggkk
ggghhhhhggggaak
ghhhhhhhhgggaaak
aaaaaaggggggaagk
kkkkkk..kaaggagk
.........kaggak
..........kagk
..........kak
..........kk
''')
LOW_HOOK = (44, 95, 115, '''
aaaagggkk
aggghhhhggggaak
ggghhhhhhgggaaak
aaaaagggggggaagk
kkkkkk..kaaggagk
.........kaggak
..........kagk
..........kak
..........kk
''')
DASH_HOOK = (57, 103, 125, '''
ggggaaaaagkk
ggghhhhhggggaak
ghhhhhhhhgggaaak
aaaaaaggggggaagk
kkkkkk..kaaggagk
.........kaggak
..........kagk
..........kak
..........kk
''')
SICK_HOOK = (56, 98, 119, '''
ggggaaaagkk
ggghhhhggggaak
gghhhhhhgggaaak
aaaagggggggaagk
kkkkkk..kaaggagk
.........kaggak
..........kagk
..........kak
..........kk
''')
STUN_HOOK = (69, 98, 120, '''
aaaagkk
ghhhhggggaak
hhhhhhgggaaak
aaaagggggaagk
kkkk..kaagagk
.......kagak
........kagk
........kak
........kk
''')
DEAD_HOOK = (114, 103, 123, '''
ggggghhhgkk
gghhhhhggggaak
aaaagggggggaagk
kkkkkkkkkaagagk
..........kagak
...........kagk
...........kak
...........kk
''')

# Continuous rear/front curves instead of the two sharp neck reversals.
HIT_NECK = (43, 60, 88, '''
.krvvoooaaaaaaaaaagggkkkkkk
krvvooooaaaaaaaagk
krvvooooaaaaaaaagk
krvvoooooaaaaaaagk
krvvooooooaaaaaagk
krvvoooooooaaaagk
krvvoooooooaaaagk
gkrvvoooooooaaagk
agkrvvooooooaaaagk
oagkrvvooooooaaagk
voagkrvvoooooaaagk
vvoagkrvvooooaaaagk
vvvoagkrvvoooaaaagk
vvvvoagkrvvooaaaagk
vvvvvoakrvvooaaaagk
vvvvvoakrvvooaaaagk
vvvvvoakrvvooaaaagk
vvvvvoakrvvooaaagk
vvvvvakrvvoooaaagk
vvvvoakrvvooaaaagk
vvvvoakrvvoaaaagk
vvvoakrvvoaaaagk
vvoakrvvoaaaagkvvvrrssk
voakrvvoaaaagkvvvvvrrss
oakrvvoaaaagkvvvvvvvrrs
akrvvoaaaagkovvvvvvvrrs
krvvoaaaagkvoooaaavvvrrs
''')
HIT_HOOK = (39, 87, 108, '''
hhggggaaaagkk
ggghhhhggggaak
gghhhhhhgggaaak
aaaagggggggaagk
kkkkkk..kaaggagk
.........kaggak
..........kagk
..........kak
..........kk
''')

# Contact neck leans forward/down. The forehead, cheek and throat are new
# literal runs, with a broader low thrust than the upright travel frame.
ATTACK_HEAD = (36, 77, 126, '''
.
.
.
.
.
.
.
.
.
....................kk
...................kagk
..................kaagk
.................krahgk
................kroaghk
...............krvoaghk...kk
..............krvvoaghk.kagk
.............krvvoaagkkaghk
............krvvoaaaggaghk
...........krvvoaaaaggggk
..........krvvooaaaagggk
.........krvvooooaaaggk
........krvvoooooaaagkk
.......krvvoooooaaagghggkk
......krvvoooooaaaagghhhggaakk
.....krvvooooooaaaagghhhhgggaaak
....krvvoooooooaaagghhhhgkkgggaaak
...krvvooooooooaaagghhhgkeekggggaaak
..krvvoooooooooaaagghhggekehkgggggaaakk
.krvvooooooooooaaaggggggeeekgggghhhgggggkk
krvvoooooooooooaaaggggggggggghhhhhhhggggaak
rvvooooooooooaaaaagggggggggaaaagghhhhhgggaak
vvoooooooooaaaaaaggggggaaaaaggggggggggaaagk
vooooooooaaaaaaggggaaaaaggggggaaaakkkagggak
oooooooaaaaaaaggggaaaagggggaaakkkkk..kaagak
oooooaaaaaaaaggggaaaggggaaakkk........kagk
oooaaaaaaaaggggaaaagggaaak.............kak
ooaaaaaaaggggaaaagggaaak...............kk
oaaaaaaaggggaaaagggaaak
aaaaaaaggggaaaaggaaak
aaaaaaggggaaaggaaak
aaaaaggggaaaggaaak
aaaaggggaaaggaaak
aaaggggaaaggaaak
aaggggaaaggaaak
aggggaaaggaaak
ggggaaaggaaak
gggaaaggaaak
''')
ATTACK_THROAT = (65, 72, 79, '''
...krvv
..krvvo
.krvvoo
krvvooo
rvvoooo
vvooooo
voooooo
ooooooo
ooooooo
ooooooa
oooooaa
ooooaaa
oooaaaa
ooaaaaa
oaaaaaa
aaaaaaa
aaaaaag
''')
KICK = (99, 85, 126, '''
vrskkcccbk
rskkddccccbk
skkbdddccccbk
kkbddddcccccbkk.................kkkk
kbddddddccccccbbkk...........kbdddk
kbddddddcccccccccbbkk......kbdddk
.kbddddddccccddddccccbkkkbbdddck
..kbbcccccccddddddddddddddcck
....kbbccccccdddbbbbccccccck
.......kbbccccccdddddddccccbbkk..kkkk
...........kbbcccddddddddddddccbbdddk
..............kbbddddddccccddddddck
...............kbddcckbbbcccccckkk
...............kbddck...kbdddk
................kbck....kddck
.................kk.....kbck
.........................kk
.
''')

# Explicit open upper/lower jaws, compact mouth core and forked fire roots.
# Upper and lower tongues retain different arcs and torn distal ends.
CAST = (34, 91, 126, '''
..............................r
.............................rv
.............................rvo
............................rvoa
...........................rvoag
..........................rvoagh
.........................rvvoaghg
........................rvvvoaghga
.......................rvvvoaghhgao
aaaakk................rvvvoaghhggao
gggggaakk...........rvvvoagghhggaor
gghhhhggggaak......rvvvoaagghhggaor
gghhhhhgggaagk....rvvvoaaagghhggaor
srkkgggggaagk....rvvoaaagghhhggaor
ssragghfffhggaaagghhhhhhhhhggaor
srraaghffffhhgggghhhhhhhgggaor
ggggaaghfffhhggggaaagghhggaor
ghhhhggaagghhggaaovvvoaghhggaor
ghhhhggggaaaggggkk.vvvoaagghhggaor
ggggggaaaggggakk..rvvvoaaagghhggaor
aaaggggggggakk...rvvvoaaaagghhggaor
ggggaaakkkkk....rvvvoaaaaagghhggaor
kkkkkk..........rvvvoaaaaagghhggaor
.................rvvvoaaaagghhggaor
..................rvvvoaaagghhggaor
...................rvvvoaagghhggaor
....................rvvvoagghhggaor
.....................rvvvoaghhggaor
.....................rvvvoaghhggaor
......................rvvoaghhggaor
......................rvvoaghhggaor
.......................rvvvoaghhgga
.......................rvvvoaghhgga
........................rvvvoaghgga
........................rvvvoaghgga
.........................rvvvoagga
.........................rvvvoagga
..........................rvvvoaga
..........................rvvvoaga
...........................rvvvoag
...........................rvvvoag
............................rvvvoag
............................rvvvoag
............................rvvvoag
............................rvvvoag
............................rvvvoag
............................rvvvoag
............................rvvvoag
............................rvvvoag
.............................rvvvva
..............................rvvvv
...............................rvvv
..............................rvv
.............................rvva
............................rvvaag
...........................rvvaagg
..........................rvvaaggh
...........................rvvaagg
............................rvvaag
.............................rvva
..............................rvv
...............................rv
................................r
''')
CAST_NECK = (50, 84, 91, '''
aaaaooa
aaaaoaa
aaaoaaa
aaaoaaa
aaaoaaa
aaaoaaa
aaaoaaa
aaaoaaa
aaaoaaa
aaaoaaa
aaaoaag
aaoaagg
aoaaggg
oaagggg
aaggggg
aggggga
gggaakk
vvvrrsk
vvvvrrs
vvvvvrr
''')

# Sleeping neck curls forward into the shoulder; closed eye and downturned
# beak sit against the folded wing instead of pointing over it.
SLEEP = (49, 62, 108, '''
.
.
.
.
.
.
.
.
.
.
.
.
.
.
.
.
.
.
.
.
.
.
.
.
.kk
.kagk
.kragk
.krvagkk
.krvoaagkk
krvvvoaagggkk
krvvooaaaggggkk
krvvoooaaagggggkk
krvvooooaaagghhgggkk
rvvooooooaaagghhhgggakk
vvoooooooaaagghhhgggaak
vooooooaaagghhgggak
vooooooaaagghhhgggak
vooooooaaagghhhgggak
vooooooaaagghhhggggak
voooooaaaagghhgkkgggak
vooooaaaaagghgkeeegggak
voooaaaaaagggggggggggak
vooaaaaaaggggggghgggagk
voaaaaaaaggggggghhggagk
voaaaaaaggggaaaaggggagk
voaaaaaggggaaakggggagk
rvoaaaggggaak.kgggagk
srvoaaggaak..kggagk
ssrvoaggaak..kgaagk
sssrvoaagk...kagak
ssssrvoak....kagk
sssssrrkk.....kk
''')
SLEEP_B = (82, 62, 108, '''
rvvoooooaaaagghhhgggakk
vvooooooaaaagghhhgggaak
voooooaaaagghhgggak
voooooaaaagghhhgggak
voooooaaaagghhhgggak
voooooaaaagghhhggggak
''')

HAUNCH = (101, 80, 96, '''
rkbbcccbk
rkbbdddcck
skkbdddcck
rkbbdddcck
rrskkbdddcck
''')
CAST_CURVE = (53, 84, 108, '''
aaaoaaaaggggggaaak
aaoaaaagggggggaak
aaoaaaagggggaak
aaoaaaaagggak
aaoaaaagggak
aaoaaagggak
aaoaagggak
aoaagggak
oaagggak
aagggak
agggak
gggak
ggak
gak
kvoagggvrsk
voaggggvrsk
oagghgggvrsk
agghhgggovrsk
agghhhggovrsk
agghhhggovrsk
aagghggovvrsk
oaagggovvrrsk
voaagovvvrrsk
vvoaovvvvrrsk
vvvovvvvvrrsk
vvovvvvvvrrsk
vovvvvvvvrrsk
ovvvvvvvvrrsk
''')
FIRE_TEAR = (65, 112, 126, '''
.....rvoaghhga
.....rvvoaghga
......rvoaghga
......rvoaghga
......rvoaggga
.......rvoagga
.......rvoagga
........rvoaga
........rvoaga
.........rvoag
.........rvoag
.........rvoag
........rvoag
.......rvoag
......rvvoag
.....rvvoaag
....rvvoaag
...rvvoaag
..rvvoaag
.rvvoaag
rvvoaag
rvvoag
rvoag
rvoag
rvoa
.rva
..rv
...r
.
.
.
''')


def block(rows, spec):
    y, x, end, lines = spec
    for offset, ink in enumerate(lines.strip('\n').splitlines()):
        if len(ink) > end - x:
            raise ValueError((y + offset, x, end, ink, len(ink)))
        rows[y + offset][x:end] = list(ink.ljust(end - x, '.'))


def apply():
    # Keep the draft's full native rows for a reviewable before/after record.
    if not ORIGINAL.exists():
        ORIGINAL.mkdir()
        shutil.copy2(ROOT / 'palette.json', ORIGINAL / 'palette.json')
        for folder in ['poses', 'actions']:
            shutil.copytree(ROOT / folder, ORIGINAL / folder)
    frames = {p.stem: [list(r) for r in p.read_text().splitlines()]
              for p in ORIGINAL.glob('*/*.pxgrid')}
    # The chest is the same anatomy. Restore the draft's literal foreground
    # neck runs at their original coordinates after drawing its curved surface.
    for name in ['idle_a', 'idle_b', 'idle_c', 'windup', 'recover', 'hit', 'skill_c',
                 'move', 'attack', 'poison_a', 'poison_b', 'skill_b', 'stun_a', 'stun_b']:
        block(frames[name], CHEST)
    ink(frames['move'], DASH_HEAD)
    for name in ['poison_a','poison_b']:
        ink(frames[name], SICK_HEAD)
    ink(frames['poison_b'], SICK_B_FACE)
    for name in ['stun_a','stun_b']:
        ink(frames[name], STUN_HEAD)
    ink(frames['stun_b'], STUN_B_NECK)
    ink(frames['skill_b'], CAST_HEAD)
    block(frames['skill_a'], (66, 78, 99, '''
voaagggvrsk
voagghhggvrsk
voagghhhhggovrsk
oagghhhhhgggovrsk
agghhhhhggggaovrsk
agghhhhggggaaovvrsk
agghhhggggaaovvvrsrk
oaagggggggaaovvvrsrk
voaagggggaaovvvvrrsk
vvoaaggaaovvvvvvrrsk
vvvoaaovvvvvvvvvrrsk
vvvvoovvvvvvvvvrrsk
voagggggggovvvvrrsk
oagghhhggggaovvrrsk
agghhhhggggaaovrrsk
agghhhgggggaaovrrsk
agghhggggaaovvvrrsk
oaaggggggaaovvvrrsk
voaaggggaaovvvrrsk
vvoaggaaovvvvrrsk
vvvoaaovvvvvvrrsk
vvvvovvvvvvvvrrsk
'''))
    block(frames['skill_a'], (88, 74, 96, '\n'.join(CHEST[3].strip().splitlines()[22:])))
    for name in ['idle_a', 'idle_b', 'idle_c', 'skill_a']:
        block(frames[name], IDLE_HOOK)
    for name in ['windup', 'recover', 'skill_c']:
        block(frames[name], LOW_HOOK)
    block(frames['move'], DASH_HOOK)
    for name in ['poison_a', 'poison_b']:
        block(frames[name], SICK_HOOK)
    for name in ['stun_a', 'stun_b']:
        block(frames[name], STUN_HOOK)
    block(frames['dead'], DEAD_HOOK)
    block(frames['hit'], HIT_NECK)
    block(frames['hit'], HIT_HOOK)
    block(frames['hit'], (65, 74, 96, '''
aggggovrsk
aaggggovrsk
oaaggggovrsk
voaaggggovrsk
vvoaaggggovrsk
voagghhhhhggggaovrsk
'''))
    block(frames['attack'], ATTACK_HEAD)
    block(frames['attack'], ATTACK_THROAT)
    block(frames['attack'], (45, 75, 77, '.\n.\n.'))
    block(frames['attack'], (62, 73, 77, '.\n.\n.'))
    block(frames['attack'], KICK)
    block(frames['skill_b'], CAST_NECK)
    block(frames['skill_b'], CAST)
    block(frames['skill_b'], CAST_CURVE)
    block(frames['skill_b'], (47, 91, 126, '''
ksssrrragghfffhggaaagghhhhhgggaor
ksssrragghffffhhggaagghhhhhggaor
kssrrragghffffhhgggaagghhhggaor
oaaggggagghfffhhggggaagghhggaor
oaagghhhhgggghhgggaaovvoaghhggaor
'''))
    block(frames['skill_b'], FIRE_TEAR)
    for name in ['idle_a','idle_b','idle_c','windup','recover','hit',
                 'skill_a','skill_c','poison_a','poison_b','stun_a','stun_b','move','skill_b']:
        block(frames[name], HAUNCH)
    for name in ['sleep_a', 'sleep_b']:
        block(frames[name], SLEEP)
    # Explicit local breathing rows only; forehead/beak rest in the same place.
    block(frames['sleep_b'], SLEEP_B)
    for p in ORIGINAL.glob('*/*.pxgrid'):
        (ROOT / p.parent.name / p.name).write_text(
            '\n'.join(''.join(r) for r in frames[p.stem]) + '\n')


if __name__ == '__main__':
    apply()
