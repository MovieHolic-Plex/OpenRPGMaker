"""Explicit authored rows for the forward sword hand and split-tip scarlet cut.

Only this candidate's skill_b is written. No masks, geometry, automatic filling,
frame transforms, or reference-image sampling. Final output is full literal rows.
"""
from pathlib import Path
import hashlib
import json

ROOT = Path(__file__).resolve().parent

# These are complete character rows with only transparent trailing padding omitted.
# The preserved face/hair/lower body stay at this pose's original coordinates.
BODY = {
    28: '............KhHHHK....HHK..KsSK',
    29: '............KhHHHK....HK..KWFsWK',
    30: '.............KhHHHK......KLrrWGgrRK',
    31: '.............KhHHHK.....KLLrrrWGrrrRK',
    32: '.............KhHHHK....KLLrrrrrGrrLLLLKK',
    33: '..............KhHHHK...KLrrrrrGrrrLLLrrrKK',
    34: '..............KhHHHK...KLrRRrrGrrrrLrrrrrgFFFsD',
    35: '...............KhHHK....KrRRKrGrrrrRRrrrGSSssDK',
    36: '...............KHHHK....KrRRKrrGrrrRKrRRKKKK',
    37: '................KHHK.....KrRKrrrGrrrRK',
}

# Explicitly selected transparent strings remove the old bow-shaped effect and
# horizontal blade. Each row's cut is chosen so it does not erase the character.
ERASE = [
    (3, 48, '................'), (4, 48, '................'),
    (5, 48, '................'), (6, 48, '................'),
    (7, 48, '................'), (8, 48, '................'),
    (9, 48, '................'), (10, 48, '................'),
    (11, 48, '................'), (12, 48, '................'),
    (13, 48, '................'), (14, 48, '................'),
    (15, 48, '................'), (16, 48, '................'),
    (17, 48, '................'), (18, 48, '................'),
    (19, 48, '................'), (20, 48, '................'),
    (21, 48, '................'), (22, 48, '................'),
    (23, 48, '................'), (24, 48, '................'),
    (25, 48, '................'), (26, 48, '................'),
    (27, 48, '................'),
    (38, 48, '................'), (39, 48, '................'),
    (40, 48, '................'), (41, 48, '................'),
    (42, 48, '................'), (43, 48, '................'),
    (44, 48, '................'), (45, 48, '................'),
    (46, 48, '................'), (47, 47, '.................'),
    (48, 46, '..................'), (49, 45, '...................'),
    (50, 44, '....................'), (51, 44, '....................'),
]

# y, x, literal cluster. Blade is a long diagonal above the forward fist.
BLADE = [
    (12, 54, 'W'), (13, 53, 'WM'), (14, 53, 'WMm'),
    (15, 52, 'WMm'), (16, 52, 'WMm'),
    (17, 51, 'WMm'), (18, 51, 'WMm'),
    (19, 50, 'WMm'), (20, 50, 'WMm'),
    (21, 49, 'WMm'), (22, 49, 'WMm'),
    (23, 48, 'WMm'), (24, 48, 'WMm'),
    (25, 47, 'WMm'), (26, 47, 'WMm'),
    (27, 46, 'WMm'), (28, 46, 'WMm'),
    (29, 45, 'WMm'), (30, 45, 'WMm'),
    (31, 44, 'WMm'), (32, 44, 'gGm'),
    (33, 42, 'GgGG'), (34, 45, 'D'), (35, 44, 'DK'),
]

# Common source is the real tip (54,12), scarlet core (55,12).
# Two unequal hooks travel forward/up and forward/down, with open space between
# their outer portions. They neither rejoin nor wrap around the sword hand.
RELEASE = [
    (3, 61, 'L'), (4, 60, 'rEL'), (5, 59, 'rEEL'),
    (6, 57, 'rLEEEL'), (7, 56, 'rLEEEL'), (8, 55, 'rLEEEL'),
    (9, 55, 'rEEEL'), (10, 55, 'EEL'), (11, 55, 'EL'),
    (12, 55, 'E'),
    (13, 55, 'EL'), (14, 56, 'EEL'), (15, 57, 'rEEL'),
    (16, 57, 'rEEEL'), (17, 57, 'rEEEEL'), (18, 57, 'rLEEEL'),
    (19, 58, 'rLEEL'), (20, 59, 'rEEL'), (21, 59, 'rEEL'),
    (22, 60, 'rEL'), (23, 60, 'rEL'), (24, 61, 'EL'),
    (25, 61, 'L'), (26, 60, 'Lr'), (27, 59, 'r'),
]

FINAL_ROWS = """................................................................
................................................................
................................................................
.............................................................L..
............................................................rEL.
...........................................................rEEL.
.........................................................rLEEEL.
........................................................rLEEEL..
..........................KKKKKKKKKK...................rLEEEL...
........................KhhhhHHHHHHHKK.................rEEEL....
.......................KhhhhhHHHHHHHHHK................EEL......
......................KhhhHHHHHHHHHHHHK................EL.......
.....................KHHHHHHHHHHHHHHHHK...............WE........
....................KHHHKHHHHHHHHHHHHHK..............WMEL.......
...................KrLGKHHHHHhhhHHHHHHK..............WMmEEL.....
..................KrrGKHHHHhHHHFSSSHHHK.............WMm..rEEL...
..................KrRKHHHHHHHFFSSSSSHHK.............WMm..rEEEL..
..................KRRKHHHKHHHFFSSSSSSSK............WMm...rEEEEL.
..............rL.KHHKHHHKHsSFKKSSSKKSK.............WMm...rLEEEL.
.............rL..KhHKHHHKsSSFFSSSSSSSSK...........WMm.....rLEEL.
.............rR.KhhHKHHKsSSFSSKSSSKSSK............WMm......rEEL.
............rR..KhhHKHHKsSSFSSSSSSSSSSK..........WMm.......rEEL.
............r...KHHHKHHKssSFFSSSSSsSSK...........WMm........rEL.
...........Rr..KHHHKHHHKssSSSSSSSSsK............WMm.........rEL.
.............KhhHHKKHHHHKssSSSSSSSK.............WMm..........EL.
.............KhHHHK.HHHHHKsssSSssK.............WMm...........L..
............KhhHHK...HHHHHKKssssK..............WMm..........Lr..
............KhHHHK....HHHK.KssSK..............WMm..........r....
............KhHHHK....HHK..KsSK...............WMm...............
............KhHHHK....HK..KWFsWK.............WMm................
.............KhHHHK......KLrrWGgrRK..........WMm................
.............KhHHHK.....KLLrrrWGrrrRK.......WMm.................
.............KhHHHK....KLLrrrrrGrrLLLLKK....gGm.................
..............KhHHHK...KLrrrrrGrrrLLLrrrKKGgGG..................
..............KhHHHK...KLrRRrrGrrrrLrrrrrgFFFDD.................
...............KhHHK....KrRRKrGrrrrRRrrrGSSsDKK.................
...............KHHHK....KrRRKrrGrrrRKrRRKKKK....................
................KHHK.....KrRKrrrGrrrRK..........................
................KHHK.....KLrKrrrGrrrRK..........................
.................KHHK....KLrrKrrrGrrrRK.........................
..................KHK....KLrrrKrrrGrrrRK........................
..................KK....KgFFSKgGGGGGGDK.........................
........................KSSsKKGgGGGDDDK.........................
.......................KSSsKDKKHHhhHHHHKK.......................
.......................KKKKDKKhHHHHHhhhHHK......................
........................KHKKhHHHHHHHhhhHHHK.....................
.......................KHKKhHHHHHKHHhhhHHK......................
......................KHK.KhHHHK.KHhhhHK........................
.....................KHK.KhHHHK.KhhhHHK.........................
....................KHK.KhHHHK.KhhHHK...........................
....................KK..KhHHHK.KhhHHK...........................
........................KhHHK...KhHHK...........................
.......................KhHHK....KhHHK...........................
......................KhHHK.....KhHHK...........................
.....................KhHHK......KhHHK...........................
....................KhHHK.......KhHHK...........................
...................KhhHK........KhhHK...........................
..................KGGDK.........KGGDK...........................
..................KhHHK.........KhHHHK..........................
.................KhHHHHK........KhHHHHHK........................
.................KKKKKKK........KKKKKKKK........................
................................................................
................................................................
................................................................""".splitlines()

def write_skill_contact():
    path = ROOT / 'actions' / 'skill_b.pxgrid'
    path.write_text('\n'.join(FINAL_ROWS) + '\n')

if __name__ == '__main__':
    history = ROOT / 'history'
    original = ROOT / 'actions' / 'skill_b.pxgrid'
    snapshot = history / 'skill_b-before-contact.pxgrid'
    if not snapshot.exists():
        snapshot.write_bytes(original.read_bytes())
        (history / 'skill_b-before-contact.png').write_bytes(
            (ROOT / 'preview' / 'skill_b.png').read_bytes())
        art = [ROOT / 'palette.json', *sorted((ROOT / 'poses').glob('*.pxgrid')),
               *sorted((ROOT / 'actions').glob('*.pxgrid'))]
        (history / 'before-contact-hashes.json').write_text(json.dumps({
            str(f.relative_to(ROOT)): hashlib.sha256(f.read_bytes()).hexdigest()
            for f in art}, indent=2) + '\n')
    write_skill_contact()
