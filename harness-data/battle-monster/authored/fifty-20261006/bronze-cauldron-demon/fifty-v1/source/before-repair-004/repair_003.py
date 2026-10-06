"""Hand-selected native ASCII runs for recoil, fallen rim and charge core.

No transforms or geometry. Blocks replace explicitly named row regions;
the final files retain all 128 literal rows. Unchanged anatomy stays intact.
"""
from pathlib import Path
import hashlib
import json
import shutil

ROOT = Path(__file__).resolve().parent


def runs(path, edits):
    rows = [list(r) for r in path.read_text().splitlines()]
    for x, y, pixels in edits:
        rows[y][x:x + len(pixels)] = pixels
    path.write_text('\n'.join(''.join(r) for r in rows) + '\n')


def block(path, x, y, width, literal):
    edits = []
    for dy, line in enumerate(literal.strip('\n').splitlines()):
        if len(line) > width:
            raise ValueError((path.name, y + dy, len(line), width))
        edits.append((x, y + dy, line.ljust(width, '.')))
    runs(path, edits)


def apply():
    hit = ROOT / 'poses/hit.pxgrid'
    # Recoil lip: its far-left crown rises, its heavy near-right lip drops.
    # Each row also explicitly clears the former horizontal lip/shoulder.
    block(hit, 22, 28, 84, '''
....................OOOOOOOOOOOOO
................OOOOggYYYYYYYYYggOOOO
............OOOOgYYWWWWYYYYYYYYYYYYggOO
..........OOgYYWWWWYYggggggggYYYYYYYYYgOO
........OOgYYWWWYYggGGOOOOOOGGggYYYYYYYYgOO
.......OgYWWWWYYgGGOODDDDDDDDOOGGggYYYYYYYgOO
......OgYWWWYYgGOODDDSSSSSSDDDDDOOGGggYYYYYYgOO
.....OgYWWWYYgGODDSSSSBBBBBSSSSDDDDOGGggYYYYYYgOO
....OgYWWWYYgGODSSBBLLLLLBBBBSSSSDDDDOGGggYYYYYYgO
...OgYWWWYYgGODSSBLLHHLLLLBBBBBSSSSDDDOGGggYYYYYYgO
..OgYWWWYYgGODSSBLLHHHLLLLLBBBBBSSSSDDDOGGggYYYYYYgO
..OgYWWWYYgGODSSBBLLHHLLLLLLBBBBBSSSSDDDOGGggYYYYYYgO
.OgYWWWYYgGODSSBBLLLLLLLLLLLBBBBBSSSSDDDOGGggYYYYYYgO
.OgYWWWYYgGODSSBBBLLLLLLLLLLBBBBBBSSSSDDDOGGggYYYYYYgO
.OgYWWWYYgGODSSBBBBLLLLLLLLBBBBBBBSSSSDDDOGGggYYYYYYgO
.OgYWWWYYgGODSSBBBBBLLLLLLBBBBBBBBSSSSDDDOGGggYYYYYYgO
.OgYWWWYYgGGODDSSBBBBBBBBBBBBBBBBSSSSSDDDOGGggYYYYYYgO
.OgYWWWYYggGGOODDSSSBBBBBBBBBBBBSSSSSSDDDOGGggYYYYYYgO
..OgYWWWYYYggGGOODDDSSSSSSSSSSSSSSSSDDDOGGggYYYYYYgO
..OgYWWWWYYYYggGGGOODDDSSSSSSSSSSDDDDOOGGggYYYYYYgO
...OgYWWWWYYYYYggGGGOOODDDDDDDDDDDOOGGggYYYYYYYYgO
....OgYWWWWYYYYYYgggGGGOOOOOOOOOOOGGggYYYYYYYYYYgO
.....OgYWWWWYYYYYYYYggggGGGGGGGGgggYYYYYYYYYYYgGO
......OgYWWWWWYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYggGO
.......OgYWWWWWWYYYYYYYYYYYYYYYYYYYYYYYYYYggGDO
.......OgYWWWWWWWWYYYYYYYYYYYYYYYYYYYYYYggGDDO
........OgYWWWWWWYYYYYYYYYYYYYYYYYYYYYggGDDDDO
........OgYYYYYYYYYYYYYYYYYYYYYYYYYYggGDDDDDDOO
.........OGggggYYYYYYYYYYYYYYYYYYYYggGDDDDDDDDDOO
.........OLHHHHLLLgggggggggggggggggGDDDDDDDDDDDOO
........OLHHTTHHHLLLLLLLLBBBBBBBBSSSSSSDDDDDDDDDDDO
.......OBLHHTTTHHHLLLLLLLLBBBBBBBBSSSSSSDDDDDDDDDDDO
......OBLLHHTTTHHHLLLLLLLLLBBBBBBBBSSSSSSDDDDDDDDDDDO
.....OBLLLHHTTTHHHLLLLLLLLLBBBBBBBBBSSSSSSDDDDDDDDDDDO
.....OBLLLHHTTHHHHLLLLLLLLLBBBBBBBBBBSSSSSSDDDDDDDDDDO
.....OBLLLHHTHHHHHLLLLLLLLLBBBBBBBBBBSSSSSSDDDDDDDDDDO
.....OBLLLHHHHHHHHLLLLLLLLLBBBBBBBBBBSSSSSSDDDDDDDDDDO
.....OBLLLHHHHHHHLLLLLLLLLLBBBBBBBBBBSSSSSSDDDDDDDDDDO
''')
    # The existing left handle is given a shorter shoulder overlap under the
    # recoiling lip. Open handle space is explicit and remains intentional.
    block(hit, 12, 49, 22, '''
.........OOOOOOOOOO
......OOOgYYYYYggGOOO
....OOgYWWYYggGGDDDO
...OgYWWYgGGDDDDDDDO
..OgYWWYgGDOOOOODDDDO
.OgYWWYgGDO.....ODDDDO
.OgYWWYgGDO....ODDDDDO
OgYWWYgGDO....ODDDDDDO
OgYWWYgGDO...ODDDDDDO
OgYWWYgGDO..ODDDDDDO
OgYWWYgGDO.ODDDDDDO
OgYWWYgGDOODDDDDDO
OgYWWYgGGODDDDDDO
.OgYWWYggGDDDDDO
.OgYWWWYggGDDDO
..OgYWWYYYggGOO
...OgYYYYYggGO
....OGgggGGDO
.....ODDDDDO
......OOOOO
''')
    # Actual enlarged PNG exposed a remnant of the old handle outside the
    # newly picked curve. Remove this specific doubled contour only.
    runs(hit, [
        (10,57,'..'), (10,58,'..'), (10,59,'..'), (10,60,'..'),
        (10,61,'..'), (10,62,'..'), (10,63,'..'), (10,64,'..'),
        (10,65,'..'), (10,66,'..'),
    ])
    # Upper trunk planes tilt with the lip; the lower torso retains its cast
    # bronze mass. These are separately picked light/side-plane clusters.
    runs(hit, [
        (27,66,'OBLLLHHHHHHHLLLLLLLLLLBBBBBBBBBBSSSSSS'),
        (27,67,'OBLLLHHHHHHLLLLLLLLLLLBBBBBBBBBBSSSSSS'),
        (27,68,'OBLLLHHHHHHLLLLLLLLLLBBBBBBBBBBBSSSSSS'),
        (27,69,'OBLLLHHHHHLLLLLLLLLLLBBBBBBBBBBBSSSSSS'),
        (27,70,'OBLLLHHHHHLLLLLLLLLLBBBBBBBBBBBBSSSSSS'),
        (27,71,'OBLLLHHHHLLLLLLLLLLLBBBBBBBBBBBBSSSSSS'),
        (27,72,'OBLLLHHHHLLLLLLLLLLBBBBBBBBBBBBBSSSSSS'),
        (27,73,'OBLLLHHHLLLLLLLLLLLBBBBBBBBBBBBBSSSSSS'),
        (27,74,'OBLLLHHHLLLLLLLLLLBBBBBBBBBBBBBBSSSSSS'),
        (27,75,'OBLLLHHLLLLLLLLLLLBBBBBBBBBBBBBBSSSSSS'),
        (27,76,'OBLLLHHLLLLLLLLLLBBBBBBBBBBBBBBBSSSSSS'),
        (27,77,'OBLLLHLLLLLLLLLLLBBBBBBBBBBBBBBBSSSSSS'),
        # Closed pained brows are lower on the right side of the leaned face.
        (57,66,'SSggggggggSSSSSSSSSSSSSSSSSSSSSS'),
        (57,67,'SSSggYYYYgSSSSSSSSSSSSSSSSSSSSSS'),
        (57,68,'SSSSggYYgSSSSSSSSSSSSSSggggggSSS'),
        (57,69,'SSSSSgggSSSSSSSSSSSSSSSgYYYYgSSS'),
        (57,70,'SSSSSSSSSSSSSSSSSSSSSSSSgYYgSSSS'),
        (57,71,'SSSSSSSSSSSSSSSSSSSSSSSSSgggSSSS'),
        (57,72,'SSSSSSSSSSSSgSSSSSSSSSSSSSSSSSSS'),
    ])
    # Receiving handle folds IN: shoulder -> compact elbow -> palm beside
    # cheek. Upper green knuckles and gold wrist are separately legible.
    block(hit, 85, 61, 22, '''
DDDO
DDDO
DDDO
DDDO
DDDO
SSDO
SSDO
SSDO
SSDO
SSDO
SSDO
SSDO
SSDO
SSDO
SSDO
SSDO
SSDO
SSDO
SSDO
SSDO
SSDO
SSDO
SSDO
DDDO
DDDO
DDDO
DDDO
DDO
DO
''')
    runs(hit, [
        (85,64,'SBBSSDDOO'),
        (85,65,'SBLBBSSDDOO'),
        (85,66,'BBLLBBSSDDO'),
        (85,67,'BBLBBSSDDDO'),
        (87,68,'SSSgYYYYggGO'),
        (88,69,'SSgYWWYYggGDO'),
        (89,70,'DgYWWYgGDDDO'),
        (89,71,'DgYWWgGDDDO'),
        (88,72,'OgYWWgGDDDO'),
        (87,73,'OgYWWgGDDDO'),
        (86,74,'OgYWWgGDDDO'),
        (84,75,'OgYWWYgGDDDO'),
        (83,76,'OgYYgGDDDO'),
        (82,77,'OGggGDDDO'),
        (80,78,'OOBBBBSSDDO'),
        (78,79,'OBLLHHLLBBSDO'),
        (77,80,'OBLHTHHLLBBSDO'),
        (77,81,'OBLHHLLBBODSDO'),
        (77,82,'OBLLLLBBODBSDO'),
        (78,83,'OBLLBBBODBSDO'),
        (79,84,'OBBBSSSSDDDO'),
        (80,85,'ODDDDDDDDO'),
        (81,86,'OOOOOOOO'),
    ])
    # Replace the right hip and bent shin individually; weight settles lower
    # while the support heel still bears at exactly y=124.
    block(hit, 77, 94, 28, '''
OSBBSSDDO
OSBLLBBSSDO
.OSBLLBBSSDO
..OSBLHLBBSSDO
...OSBLHHLBBSSDO
....OSBLHHLBBSSDO
.....OSBLLLBBSSDDO
.....OSBLLLBBSSDDO
....OSBLLLBBSSDDDO
...OSBLLLBBSSDDDO
...OBLLLBBSSDDDO
....OBLLLBBSSDDDO
.....OBLLLBBSSDDDO
......OBLLLBBSSDDDO
.......OBLLBBSSDDDO
........OBLLBBSSDDO
.........OBLLBBSSDDO
..........OBLLBBSSDDO
..........OBLLBBSSDDO
..........OBLBBSSDDDO
..........OBLBBSSDDDO
.........OBLBBSSDDDDO
.........OBLBBSSDDDDO
........OBLBBSSDDDDDO
.......OBLBBSSDDDDDDO
......OBLBBBSSDDDDDDO
.....OBLBBBBSSDDDDDDO
....OBBBBBBSSDDDDDDDO
...OBBBBBBSSSDDDDDDDO
...ODDDDDDDDDDDDDDDDO
....OOOOOOOOOOOOOOOO
''')
    block(hit, 32, 104, 25, '''
..........OBLLBBSSDOSSSSS
.........OBLHLBBSSDOSSSSS
........OBLHHLBBSSDOSSSSS
.......OBLHHLBBBSSDOSSSSS
......OBLHHLBBSSDDODDDDD
.....OBLHHLBBBSSDDOOOOOO
....OBLHHLBBSSDDO
...OBLHHLBBSSDDO
..OBLHLBBBSSDDO
.OBLHLBBSSDDDO
.OBLLBBBSSDDDO
..OBLLBBSSDDDO
...OBLBBBSSDDDO
...OBLBBBSSDDDDO
..OBLBBSSDDDDDO
..OBLBBSSDDDDDO
.OBLBBSSDDDDDDO
OBBBBSSDDDDDDDO
OBBBSSDDDDDDDDO
ODDDDDDDDDDDDDO
.OOOOOOOOOOOOO
''')

    dead = ROOT / 'poses/dead.pxgrid'
    # Full local right-end replacement. The leaned rim is an open tilted
    # aperture, rather than the former tall L. Near lip is brighter/thicker;
    # far lip is thinner, the interior stays O/D/S with a small green plane.
    block(dead, 80, 76, 43, '''
................OOOOOO
.............OOOgYYYYgOO
............OgYWWYYYYggOO
...........OgYWWYgGGggYYgOO
..........OgYWWYgGDOOGgYYgGO
.........OgYWWYgGDDDOOGgYYgGO
........OgYWWYgGDDDDDOOGgYYgGO
.......OgYWWYgGDDSSDDDOOGgYYgGO
......OgYWWYgGDDSSSSDDDOOGgYYgGO
.....OgYWWYgGDDSSSSSDDDOOGgYYgGO
OO..OgYWWYgGDDSSBBSSDDDOOGgYYgGO
DDOOgYWWYgGDDSSBBBSSDDDOOGgYYgGO
DDDOgYWWYgGDDSSBBBSSDDDOOGgYYgGO
DDOgYWWYgGDDSSBBBBSSDDDOOGgYYgGO
DDOgYWWYgGDDSSBBBBSSDDDOOGgYYgGO
DDOgYWWYgGDDSSBBBSSDDDDOOGgYYgGO
DDOgYWWYgGDDSSBBBSSDDDDOOGgYYgGO
DDOgYWWYgGDDSSBBSSDDDDDOOGgYYgGO
DDOgYWWYgGDDSSSSSSDDDDDOOGgYYgGO
DDOgYWWYgGDDSSSSSDDDDDOOGgYYgGO
DDOgYWWYgGDDSSSSDDDDDOOGgYYgGO
DDOgYWWYgGDDSSSDDDDDOOGgYYgGO
DDDOgYWWYgGDDSSDDDDOOGgYYgGO
DDDDOgYWWYgGDDDDDDOOGgYYgGO
DDDDDOgYWWYgGDDDDDOOGgYYgGO
DDDDDDOgYWWYYgGDOOOGgYYgGO
DDDDDDDOgYWWYYggGGGggYYgGO
DDDDDDDDOgYWWYYYYYYYYYgGO
DDDDDDDDDOgYWWYYYYYYYgGO
DDDDDDDDDDOGgggggggGGDO
DDDDDDDDDDDOODDDDDDDOO
DDDDDDDDDDDO..OOOOOO
DDDDDDDDDDDO
DDDDDDDDDDDO
DDDDDDDDDDDO
DDDDDDDDDDDO
DDDDDDDDDO
DDDDDDDDDO
DDDDDDDDO
DDDDDDDO
DDDDDO
DDO
O
.
.
''')
    # Collapsed handle attaches below the near lip at a visible green mount.
    # Its empty interior separates it from the mouth. Wrist receives the
    # lower gold return; three green knuckle lobes lie along the floor.
    runs(dead, [
        (88,106,'SSBBSSDDO'),
        (88,107,'SBBLBBSSDO'),
        (88,108,'BBLLBBSSDO'),
        (89,109,'BBLBBSSDDOO'),
        (90,110,'SSBBSSgYYYYYggOOOO'),
        (91,111,'SSSSgYWWWWYYYYYYgOO'),
        (93,112,'OgYWWYYggGGggYYYgGO'),
        (94,113,'OgYYgGDO...OGgYYgGO'),
        (94,114,'OgYgGDO.....OgYYgGO'),
        (94,115,'OgYgGDO.....OgYYgGO'),
        (94,116,'OgYYgGDO...OgYYgGO'),
        (95,117,'OgYWWYYgggYYgGDO'),
        (96,118,'OgYYYYYYgGDBBSSOO'),
        (97,119,'OGgggGDBLLHHLLBBSDOO'),
        (98,120,'ODDDDBLHTHHLBBODBSDO'),
        (99,121,'OBLHHLLBBBODBSDDO'),
        (99,122,'OBLLLBBBSSSSDDDO'),
        (100,123,'ODDDDDDDDDDDDO'),
        (101,124,'OOOOOOOOOOOO'),
    ])

    charge = ROOT / 'actions/skill_a.pxgrid'
    # Restore the explicit former cavity/lip under the orange preparatory
    # flame. Nothing outside this named patch is altered.
    block(charge, 46, 24, 35, '''
...................................
...................................
...................................
...................................
...................................
...................................
...................................
...................................
.OOOOOOOOOOOOOOOOOOOOO.............
OggYYYYYYYYYYYYYYYYggOOOO..........
WWWWWWYYYYYYYYYYYYYYYYYggOOO.......
YYYggggggggggggggYYYYYYYYYYggOO....
GGOOOOOOOOOOOOOOGGggYYYYYYYYYYgOO..
ODDDDDDDDDDDDDDDDOOGGggYYYYYYYYgOO.
SSSSSSSSSSSSSSSSDDDDOOGggYYYYYYYgO.
SBBBBBBBBSSSSSSSSSSDDDDOGggYYYYYYgO
BBLLLLBBBSSSSSSSSSSSDDDOGggYYYYYYgO
LLLLLLLLBBBBSSSSSSSSSDDDOGgYYYYYYYg
LLLLLLLLLLBBBBSSSSSSSSDDOGgYYYYYYYg
LLLLLLLLLLBBBBSSSSSSSSDDOGgYYYYYYYg
LLLLLLLLLBBBBBSSSSSSSSDDOGgYYYYYYYg
LLLLLLBBBBBBSSSSSSSSDDDOGgYYYYYYYgO
LLLLBBBBBBSSSSSSSSDDDOGgYYYYYYYYgO.
BBBBBBBSSSSSSSSSSDDOGgYYYYYYYYYYgO.
SSSSSSSSSSSSSSDDDOGggYYYYYYYYYYgGO.
''')
    # Compact, blunt pale core seated in the aperture; restrained gold edge.
    # The foreground lip at y49..55 remains fully visible, without flame.
    runs(charge, [
        (59,37,'gYYYYg'),
        (57,38,'gYYWWWWYYg'),
        (56,39,'gYWWWWTWWWYg'),
        (55,40,'gYWWWTWTWWWYg'),
        (55,41,'gYWWTTTTWWWYg'),
        (55,42,'gYWWTTTWWWWYg'),
        (56,43,'gYWWWWWWWWYg'),
        (57,44,'gYYWWWWWYYg'),
        (58,45,'gYYYYYYYg'),
        (59,46,'GGggggGG'),
    ])


def snapshot():
    out = ROOT / 'before-repair-003'
    if out.exists():
        return
    out.mkdir()
    hashes = {}
    for folder in ('poses', 'actions'):
        (out / folder).mkdir()
        for path in sorted((ROOT / folder).glob('*.pxgrid')):
            rel = path.relative_to(ROOT)
            shutil.copy2(path, out / rel)
            hashes[str(rel)] = hashlib.sha256(path.read_bytes()).hexdigest()
    for name in ('palette.json', 'AUTHORING.md', 'TIMING.md', 'author.py',
                 'repair_002.py', 'render.py', 'render_repair.py'):
        shutil.copy2(ROOT / name, out / name)
    hashes['palette.json'] = hashlib.sha256((ROOT / 'palette.json').read_bytes()).hexdigest()
    (out / 'source-hashes.json').write_text(json.dumps(hashes, indent=2) + '\n')


if __name__ == '__main__':
    snapshot()
    apply()
