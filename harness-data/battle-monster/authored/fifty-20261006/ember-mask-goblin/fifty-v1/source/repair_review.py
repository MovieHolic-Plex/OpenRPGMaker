"""Explicit native row patches for the three supplied review observations.

Each string writes its dots too. No geometry, transforms, inferred fill or
cross-frame propagation. Final pxgrid files remain full 96 x 96 literal rows.
"""
from pathlib import Path
import shutil

ROOT = Path(__file__).resolve().parent
ARCHIVE = ROOT / 'history' / 'before-review-repair'
if not ARCHIVE.exists():
    ARCHIVE.mkdir()
    for name in ['poses', 'actions']:
        shutil.copytree(ROOT / name, ARCHIVE / name)
    for name in ['palette.json', 'AUTHORING.md', 'TIMING.md']:
        shutil.copy2(ROOT / name, ARCHIVE / name)

def patch(folder, name, edits):
    path = ROOT / folder / (name + '.pxgrid')
    rows = [list(row) for row in path.read_text().splitlines()]
    for x, y, text in edits:
        for dy, line in enumerate(text.strip('\n').splitlines()):
            rows[y + dy][x:x + len(line)] = list(line)
    path.write_text('\n'.join(''.join(row) for row in rows) + '\n')

# Rear fist no longer competes with the striking hand. Restore visible ash
# boundary where the old raised fist occluded it; lower this arm from its
# existing shoulder to a small resting fist beside the vest.
patch('poses', 'windup', [
    (12, 44, '........obbaamwcccbbbaaao'),
    (12, 45, '.........obbaao'),
    (12, 46, '.........obbbba'),
    (12, 47, '.........obbbbba'),
    (12, 48, '.........obbbbba'),
    (12, 49, '.........obbbbaa'),
    (12, 50, '..........obbaa'),
    (12, 51, '...........oaa'),
    (12, 52, '.............'),
    (12, 53, '..............'),
    (12, 54, '.................orttts'),
    (12, 55, '................ortttss'),
    (12, 56, '...............ortttssro'),
    (12, 57, '..............ortttssro.'),
    (12, 58, '.............ortttssro.'),
    (12, 59, '............ortttssro...'),
    (12, 60, '...........ortttssro....'),
    (12, 61, '..........orttfftsro....'),
    (12, 62, '..........ortffffsro...'),
    (12, 63, '..........orrtttssro...'),
    (12, 64, '...........orrsssro....'),
    (12, 65, '............oooooo....'),
    # Right shoulder -> upper arm -> low elbow -> rising forearm -> fist.
    # Deliberate open space inside the folded elbow, outside the vest.
    (69, 44, '''
....ooooo
...orttssro
..orttffssro
.orttffffssro
'''),
    (54, 48, '''
uvrssttssro....ortttffttssro
uvrsstttssro...orrtttttssro.
vrssttttssro....orrtttssro..
vrssttttssro.....orrsssro...
vvrsttttssro.....ortssro...
vvorsttttssro...orttssro...
vvvorsttttssro.ortttssro...
vvvoorsttttssrortttssro....
vvvvorsttttttttttssro.....
'''),
    # Remove old abdominal fist and draw the lower elbow over the restored
    # cloth edge; no whole torso or leg displacement.
    (48, 57, '''
uuuuuuvvvvoorrttttttttssro......
uuuuuuvvvvo.orrttttttssro.......
uuuuuuvvvvo..orrttttssro........
uuuuuuvvvvo...orrssssro.........
uuuuuuvvvvo....oooooo...........
uuuuuuvvvvo....................
uuuuuuvvvvo....................
uuuuuvvvvvo....................
uuuuvvvvvvo....................
uuuvvvvvvvo....................
'''),
    # Actual PNG exposed a remnant of the former belly fist at x41..47.
    # Choose cloth pixels explicitly in this pose, rather than filling holes.
    (41, 58, '''
uuuuuuuuuuuuu
uuuuuuuuuuuuu
uuuuuuuuuuuuu
uuuuuuuuuuuuu
uuuuuuuuuuuuu
uuuuuuuuuuuuv
uuuuuuuuuuvvv
uuvvvvvvvvvvv
vvvvvvvvvvvvv
'''),
])

# In the forward stride the old rear fist still outweighed the strike hand.
# Lower that rear arm with its own elbow/forearm, retain the broad pushing
# thigh and feet, and give the right wrist a readable anticipatory fist.
patch('poses', 'move', [
    # The old fist's top outline extended left of the real ash underside.
    # Actual enlarged PNG: erase these six authored obsolete outline pixels.
    (25, 48, '......'),
    (20, 49, '..................'),
    (20, 50, '.................'),
    (20, 51, '................o'),
    (20, 52, '...............'),
    (20, 53, '...............'),
    (20, 54, '.............orttt'),
    (20, 55, '............ortttsv'),
    (20, 56, '...........ortttssv'),
    (20, 57, '..........ortttssro'),
    (20, 58, '.........ortttssrov'),
    (20, 59, '........ortttssro.o'),
    (20, 60, '.......ortttssro..o'),
    (20, 61, '......orttfftsro..ov'),
    (20, 62, '.....orttffffsro.ovv'),
    (20, 63, '.....orrtttssro.vvv'),
    (20, 64, '......orrsssro..ovv'),
    (20, 65, '.......oooooo...ovv'),
    # Removing the old raised rear fist exposed a missing ash support.
    # Separately authored ash lip and cloth strap, joining the actual shoulder.
    (42, 42, 'aao'),
    (42, 43, 'aavvo'),
    (42, 44, 'ovhuuvo'),
    (42, 45, 'ovhuuvo'),
    (42, 46, 'ovhuuv'),
    (62, 51, '''
ssstttssro....
rsstttssro....
orstttssro....
orstttssro....
ortttffttssro.
orttfffftssro.
orrttffttssro.
.orrttttssro..
..orrsssro....
...oooooo.....
'''),
])

# Neck is red tissue between the collapsed shoulder and mask, not a dark
# contact seam. The curved wooden underside/jaw keeps a separate dark edge.
patch('poses', 'dead', [
    (51, 77, 'stttron'),
    (51, 78, 'sttttron'),
    (51, 79, 'stttssron'),
    (51, 80, 'sttsssron'),
    (51, 81, 'sstssron'),
    (51, 82, 'sstssron'),
    (52, 83, 'stssron'),
    (53, 84, 'sssron'),
    (54, 85, 'ssron'),
])

# Lifted chin: new asymmetric horn planes, higher right brow, upward opening
# mouth, foreshortened lower jaw. Ash/vest/limbs and flying coals are retained.
# The mask is redrawn as clusters; no rotated or translated mask copy.
patch('actions', 'skill_c', [
    (39, 5, '''
.............oo................
............offo...............
...........ofpfo...............
..........ofppfo...............
..........ofpnfo...............
.........ofpnnfo...............
........ofpnnnwo...............
........ofnnnmwo...............
.......ofnnnmmwo...............
.......ofnnmmmwo...............
.......onnmmmmwo...............
........oonmmwwo...............
.......oooonnmmwooo............
.....oonnnnnnnnnnnmoo..........
....onnnnppnnnnnnnmmmwoo.......
...onnnnpppnnnnnmmmmmmwwo......
..onnnnnnnnnnnmmmmmmmmmmwo.....
.onnnnnnnnnnmmmmmmmmmmmwwwo....
.onhhnnnnnnmmmwwwwmmwwwwwwo....
onnnhhnnnnmmmweeeewweeeewwo....
onnnnnnnnmmmweeepemwepeewwo....
onnnnnnnmmmmweeeeemweeeewwo....
onnnnnnnmmmmwweeewmweeeewwo....
onnnnnnmmmmmmwweeemweeeemwo....
onnnnnmmmmmmmmmweewweeenpwo....
onnnnnmmmmmmmmmmweeewnpppwo....
onnnnmmmmmmmmmmmmweeppfewwo....
aonnnmmmmmmmmmmmweeefeeewwo....
oonnnmmmmmmmmmmmmweffewmmwo....
mmonnnmmmmmmmmmmmweeewmmmwo....
nnmonnnmmmnmmmmmmmmwwwmmwwo....
pmwonnnnmmmnnmmmmmmmmmmwwo.....
nmwoonnnnnmmmmmmmmmwwwwo.......
mworrttssroonnmmmmwwo..........
'''),
    (44, 39, '''
orrttttssro.oooooo.........
ortttttsssro..............
orttttssssro..............
ortttssssro...............
vhhhuuurssssro............
hhhuuuuuvrssssssro........
'''),
    # Remove two orange remnants of the old lowered jaw at the neck edge.
    (42, 39, 'orttttttssro.oooooo'),
    (42, 40, 'ortttttsssro'),
])

if __name__ == '__main__':
    print('Explicit patches saved to windup, move, dead and skill_c; other grids preserved.')
