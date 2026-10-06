"""Apply individually authored ASCII clusters to this candidate only.

Every block is a literal selection of pixels. Padding denotes explicitly
transparent remainder of the selected rectangle, not a silhouette operation.
No coordinate transfer between poses, body transforms, or automatic fills.
"""
from pathlib import Path
import shutil

ROOT = Path(__file__).resolve().parent
BEFORE = ROOT / 'before-claws-horns-repair'
POSES = ['idle_a','idle_b','idle_c','windup','move','attack','recover','hit','dead']
ACTIONS = ['skill_a','skill_b','skill_c','poison_a','poison_b','stun_a','stun_b','sleep_a','sleep_b']

# x, y, exclusive right edge, literal consecutive native rows.
HORNS = {
'idle_a': (52,13,78, '''.
.
..OOO
..OPPOO.........OOO
...OPPPQO.......OPPOO
.....OPPQO.......OPPQO
.......OPPQO......OPPQO
........OPPQO.....OPPQO
........OPPQO....OPPQO
........OQQO.....OQQO'''),
'idle_b': (52,13,78, '''.
.
..OOO
..OPPOO.........OOO
...OPPPQO.......OPPOO
.....OPPQO.......OPPQO
.......OPPQO......OPPQO
........OPPQO.....OPPQO
........OPPQO....OPPQO
........OQQO.....OQQO'''),
'idle_c': (52,13,78, '''.
.
..OOO
..OPPOO.........OOO
...OPPPQO.......OPPOO
.....OPPQO.......OPPQO
.......OPPQO......OPPQO
........OPPQO.....OPPQO
........OPPQO....OPPQO
........OQQO.....OQQO'''),
'windup': (32,20,60, '''.
.
..OOO............OOO
..OPPOO..........OPPOO
...OPPPQO..........OPPQO
.....OPPQO..........OPPQO
......OPPQO.........OPPQO
.......OPPQO.......OPPQO
.......OQQOOOOOOOOOQQO'''),
'move': (62,34,90, '''.
.
..OOO.............OOO
..OPPOO...........OPPOO
...OPPPQO...........OPPQO
.....OPPQO...........OPPQO
......OPPQO..........OPPQO
.......OPPQO........OPPQO
.......OQQOOOOOOOOOOQQO'''),
'attack': (62,42,90, '''.
.
..OOO.............OOO
..OPPOO...........OPPOO
...OPPPQO...........OPPQO
.....OPPQO...........OPPQO
......OPPQO..........OPPQO
.......OPPQO........OPPQO
.......OQQOOOOOOOOOOQQO'''),
'recover': (50,26,78, '''.
.
..OOO............OOO
..OPPOO..........OPPOO
...OPPPQO..........OPPQO
.....OPPQO..........OPPQO
......OPPQO.........OPPQO
.......OPPQO.......OPPQO
.......OQQOOOOOOOOOQQO'''),
'hit': (31,33,60, '''.
.
..OOO..............OOO
..OPPOO............OPPOO
...OPPPQO............OPPQO
.....OPPQO............OPPQO
......OPPQO...........OPPQO
.......OPPQO.........OPPQO
.......OQQOOOOOOOOOOOQQO'''),
'dead': (68,78,96, '''.
..OOO.........OOO
..OPPOO.......OPPOO
...OPPPQO.......OPPQO
.....OPPQO.......OPPQO
......OPPQO......OPPQO
......OPPQO.....OPPQO
......OQQOOOOOOOOOQQO'''),
'skill_a': (51,25,79, '''.
.
..OOO.............OOO
..OPPOO...........OPPOO
...OPPPQO...........OPPQO
.....OPPQO...........OPPQO
......OPPQO..........OPPQO
.......OPPQO........OPPQO
.......OQQOOOOOOOOOOQQO'''),
'skill_b': (39,32,67, '''.
.
..OOO.............OOO
..OPPOO...........OPPOO
...OPPPQO...........OPPQO
.....OPPQO...........OPPQO
......OPPQO..........OPPQO
.......OPPQO........OPPQO
.......OQQOOOOOOOOOOQQO'''),
'skill_c': (49,32,77, '''.
.
..OOO.............OOO
..OPPOO...........OPPOO
...OPPPQO...........OPPQO
.....OPPQO...........OPPQO
......OPPQO..........OPPQO
.......OPPQO........OPPQO
.......OQQOOOOOOOOOOQQO'''),
'poison_a': (47,46,75, '''.
.
..OOO.............OOO
..OPPOO...........OPPOO
...OPPPQO...........OPPQO
.....OPPQO...........OPPQO
......OPPQO..........OPPQO
.......OPPQO........OPPQO
.......OQQOOOOOOOOOOQQO'''),
'poison_b': (46,47,74, '''.
.
..OOO.............OOO
..OPPOO...........OPPOO
...OPPPQO...........OPPQO
.....OPPQO...........OPPQO
......OPPQO..........OPPQO
.......OPPQO........OPPQO
.......OQQOOOOOOOOOOQQO'''),
'stun_a': (49,57,77, '''.
.
..OOO.............OOO
..OPPOO...........OPPOO
...OPPPQO...........OPPQO
.....OPPQO...........OPPQO
......OPPQO..........OPPQO
.......OPPQO........OPPQO
.......OQQOOOOOOOOOOQQO'''),
'stun_b': (49,57,77, '''.
.
..OOO.............OOO
..OPPOO...........OPPOO
...OPPPQO...........OPPQO
.....OPPQO...........OPPQO
......OPPQO..........OPPQO
.......OPPQO........OPPQO
.......OQQOOOOOOOOOOQQO'''),
'sleep_a': (57,54,85, '''.
.
..OOO.............OOO
..OPPOO...........OPPOO
...OPPPQO...........OPPQO
.....OPPQO...........OPPQO
......OPPQO..........OPPQO
.......OPPQO........OPPQO
.......OQQOOOOOOOOOOQQO'''),
'sleep_b': (57,54,85, '''.
.
..OOO.............OOO
..OPPOO...........OPPOO
...OPPPQO...........OPPQO
.....OPPQO...........OPPQO
......OPPQO..........OPPQO
.......OPPQO........OPPQO
.......OQQOOOOOOOOOOQQO''')
}

LIMBS = {
'idle_a': [(64,89,102, '''HWWWWHHHHMMTTSSODSTMMOO
HWWWWHHHHMMTTSSODSTMMMTO
HWWWWHHHHMMTTSSODSTMMTSSO
OHWWWWHHHMMTTSSODSTMMTSSO
OHWWWWHHHMMTTSSODSTMMTSSO
OHWWWWHHMMTTSSO.ODSTMMTO
MOOHHMMOOTTTSSDO..ODSTMMTO
MOHWWWHHMMTSSDO...ODSTHMMOO
MOHWWWWHMMTTSSDO.ODSTHHMMPPO
MMOHWWWWHMMTTSSDOODSTHHMPQOQO
HMMOHWWWWHMMTSSDO.ODSTMPQO.OQO
MMTTOHWWWWHMMTSDO..ODSDOO...OO
MTSSOOHWWWHMMTDO....OQO
TSSDOOHWWWHMTO......O
SDO...OHWWWHMMOO
DO.....OHWWWHMMPPO
.......OHWWHMPQOQO
........OHHMPQO.OQO
.........OMTDO...OO
..........OQO
...........O
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
.''')],
'idle_b': [(64,89,102, '''HWWWWHHHHMMTTSSODSTMMOO
HWWWWHHHHMMTTSSODSTMMMTO
HWWWWHHHHMMTTSSODSTMMTSSO
OHWWWWHHHMMTTSSODSTMMTSSO
OHWWWWHHHMMTTSSODSTMMTSSO
OHWWWWHHMMTTSSO.ODSTMMTO
MOOHHMMOOTTTSSDO..ODSTMMTO
MOHWWWHHMMTSSDO...ODSTHMMOO
MOHWWWWHMMTTSSDO.ODSTHHMMPPO
MMOHWWWWHMMTTSSDOODSTHHMPQOQO
HMMOHWWWWHMMTSSDO.ODSTMPQO.OQO
MMTTOHWWWWHMMTSDO..ODSDOO...OO
MTSSOOHWWWHMMTDO....OQO
TSSDOOHWWWHMTO......O
SDO...OHWWWHMMOO
DO.....OHWWWHMMPPO
.......OHWWHMPQOQO
........OHHMPQO.OQO
.........OMTDO...OO
..........OQO
...........O
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
.''')],
'idle_c': [(64,89,102, '''HWWWWHHHHMMTTSSODSTMMOO
HWWWWHHHHMMTTSSODSTMMMTO
HWWWWHHHHMMTTSSODSTMMTSSO
OHWWWWHHHMMTTSSODSTMMTSSO
OHWWWWHHHMMTTSSODSTMMTSSO
OHWWWWHHMMTTSSO.ODSTMMTO
MOOHHMMOOTTTSSDO..ODSTMMTO
MOHWWWHHMMTSSDO...ODSTHMMOO
MOHWWWWHMMTTSSDO.ODSTHHMMPPO
MMOHWWWWHMMTTSSDOODSTHHMPQOQO
HMMOHWWWWHMMTSSDO.ODSTMPQO.OQO
MMTTOHWWWWHMMTSDO..ODSDOO...OO
MTSSOOHWWWHMMTDO....OQO
TSSDOOHWWWHMTO......O
SDO...OHWWWHMMOO
DO.....OHWWWHMMPPO
.......OHWWHMPQOQO
........OHHMPQO.OQO
.........OMTDO...OO
..........OQO
...........O
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
.''')],
'windup': [(64,82,100, '''MOOHHMMOO..ODSTHHPPO
OHWWWHHMMTO.ODSTHMPQO
OHWWWWHMMTTO.ODSQO.QO
HWWWWHMMTTSSO.OQO..OO
WWWWHMMTTSSDO..O
WWWWHMMTTSDO
WWWWHMMTSDO
WWWWHMMTDO
WWWWHMMOO
HWWWHMMPPO
HWWWHMPQOQO
HWWMTPQO.OQO
HMMTSDOO...OO
OHMMTDO
MOOQO
HMOO
HMMO
HMMTO''')],
'move': [(73,85,110, '''MOOHHMMOODSTMTSSO
OHWWWHHMMTODSTHMMOO
OHWWWWHMMTTOODSTHMPPO
MOHWWWWHMMTSSODSTMPQOQO
MMOHWWWWHMMTSSOODSQO.OQO
MMTOHWWWWHMMTSDO.OO...OO
MMTSOHWWWWHMMTDO
MMTSSOHWWWWHMTO
MTTSSDOHWWWWHMMOO
TSSDDOOHWWWHHMMPPO
DDO....OHWWWHMPQOQO
O.......OHHMTPQO.OQO
.........OMTSDOO...OO
..........OQO
...........O
.
.
.
.
.
.''')],
'attack': [(75,87,114, '''TOOHHMMOODSTMMTSO
OHWWWHHMMTODSTMMTSSO
OHWWWWHMMTTOODSTHMMOO
TOHWWWWHMMTSSODSTHHMPPO
TSOHWWWWHMMTSSODSTMTPQOQO
TTSOHWWWWHMMTSDOODSQO.OQO
TSSDOHWWWWHMMTDO.OO...OO
SDDOOHWWWWHHMOO
O....OHWWWWWWHMTO
.....OHWWWWWHHMMPPO
......OHWWWHHMMPQOQO
.......OHWHMMTPQO.OQO
........OHMMTSDOO...OO
.........OHPQO
..........OQO
...........O
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
.''')],
'recover': [(73,81,100, '''MOOHHMMOODSTMMTO
OHWWWHHMMTODSTHMMOO
OHWWWWHMMTTOODSTHMPPO
MOHWWWWHMMTSSODSTMPQOQO
MTOHWWWWHMMTSDOODSQO.OQO
MTSOHWWWWHMMTDO.OO...OO
TSSOHWWWWHMTO
TSSDOHWWWHMMOO
MTSSOOHWWWHMMPPO
MMTSSOOHWWMPQOQO
SDO...OHMMTPQO.OQO
O....OHMMTSDOO...OO
O...OHMMTDO
O...OQO
O....O
O
.
.''')],
'hit': [(68,84,92, '''OOHHMMOO
OHWWWHHMMTO
OHWWWWHMMTTO
OHWWWWHMMTSSO
SOHWWWWHMMTSDO
SDOHWWWWHMMTDO
SSDOHWWWHMMOO
TSSDOHWWWHMMPPO
TSSDOHHWWHMPQOQO
TTSSDOMHMTPQO.OQO
TTSSDOOHMTSDOO...OO
TTSSDO.OQO
TTSSDO..O
TSSDDO
SSDDO
DOO
OO''')],
'dead': [(69,110,110, '''MMTTSSMMOO......ODSTHHMMOO
OOHHHHHMMTO......ODSTHMPPO
HWWWHHHMMTTO......ODSMTPQOQO
WWWWWHHMMTTSSO.....ODSQO.OQO
WWWWWHHMMTTSDO......OO...OO
WWWWHHHMMTTDO
WWWHHHMMTTDO
WWHHHMMTTSSO
HHHHHMMTSSDO
HHHHHMMTSDO
OHWWWHMMOO
.OHWWWHMMPPO
..OHWHMMPQOQO
...OHMTPQO.OQO
....OOOOO...OO''')],
'skill_a': [(73,80,102, '''MOOHHMMOODSTMMTO
OHWWWHHMMTODSTHMMOO
OHWWWWHMMTTOODSTHMPPO
MOHWWWWHMMTSSODSTMPQOQO
MTOHWWWWHMMTSDOODSQO.OQO
MTSOHWWWWHMMTDO.OO...OO
MTSSOHWWWWHMTO
TTSSDOHWWWHMMOO
TSSDDOHWWWHMMPPO
SSDDO.OHWWHMPQOQO
TSSO..OHMMTPQO.OQO
TSSO..OHMTSDOO...OO
O....OHMTDO
O.....OQO
O......O
O
O''')],
'skill_b': [(71,86,96, '''OOHHMMOO
OHWWWHHMMTO
OHWWWWHMMTTO
OHWWWWHMMTSSO
DOHWWWWHMMTSDO
SDOHWWWWHMMTDO
SDOHWWWWHMTO
SDOOHWWWHMMOO
DDO.OHWWWHMMPPO
DO...OHWWHMPQOQO
O.....OHMMTPQO.OQO
.......OMTSDOO...OO
SO......OQO
O........O
.
.
.
.
.''')],
'skill_c': [(73,82,100, '''MOOHHMMOODSTMMTO
OHWWWHHMMTODSTHMMOO
OHWWWWHMMTTOODSTHMPPO
MOHWWWWHMMTSSODSTMPQOQO
MTOHWWWWHMMTSDOODSQO.OQO
TSSOHWWWWHMMTDO.OO...OO
TSSDOHWWWWHMTO
SDDOOHWWWHMMOO
TSSO.OHWWWHMMPPO
TSSO..OHWWHMPQOQO
O....OHMMTPQO.OQO
O...OHMTSDOO...OO
O...OHMTDO
O....OQO
O.....O
O
.''')],
# Sick near paw still cups the jaw. Three curved tips replace the paddle.
'poison_a': [(73,77,94, '''OO...OOHHMMOO
....OHWWWHMMPPO
DO.OHWWWHHMPQOQO
DOOHWWWWHMMPQO.OQO
DOHWWWWHMMTSDOO...OO
DOHWWWHMMTTSSO
DDOHHHHMMTTSSO
DDOHMMTTTSSDDO
DOHMMTTTSSDDO
OHMMTTTSSDDO'''), (67,96,93, '''OHWWWWHMMTTSSDO
MOHWWWWHMMTTSDO
MMOHWWWWHMMTDO
MMMOHWWWHMMOO
MMTTOHWWWHMMPPO
TTTSOHWWHMPQOQO
SDDOOHMMTPQO.OQO
DDO..OMTSDOO...OO
......OQO
.......O
.
.''')],
'poison_b': [(73,79,94, '''DO...OOHHMMOO
DO..OHWWWHMMPPO
DDOOHWWWHHMPQOQO
DDOHWWWWHMMPQO.OQO
DOHWWWWHMMTSDOO...OO
DOHWWWHMMTTSSO
DDOHHHHMMTTSSO
DOOHMMTTTSSDDO
OOHMMTTTSSDDO
OHMMTTTSSDDO'''), (64,97,93, '''OHWWWWHMMTTSSDO
OHWWWWHMMTTSDO
HOHWWWWHMMTDO
HMOHWWWHMMOO
MMMOHWWWHMMPPO
TTTSOHWWHMPQOQO
SSDOOHMMTPQO.OQO
O....OMTSDOO...OO
......OQO
.......O
.
.
.''')],
'stun_a': [(66,98,99, '''SOOHHHMMOO
OHWWWHHMMTO
HWWWWHHMMTTO
HWWWWHHMMTTSSO
OHWWWHHMMTTSDO
TOHWWWHHMMTTDO
MTOHWWWHHMMTO
MMTOHWWWHHMMOO
MMTTOHWWWHHMMPPO
MMTTTOHWWHHMMPQOQO
MMTTTSOHWHMMTPQO.OQO
MTTTSSDOHMTSDOO...OO
TTTSSDDOOQO
SDDO.....O
DDO
.
.
.
.
.
.''')],
'stun_b': [(66,98,99, '''SOOHHHMMOO
OHWWWHHMMTO
HWWWWHHMMTTO
HWWWWHHMMTTSSO
OHWWWHHMMTTSDO
TOHWWWHHMMTTDO
MTOHWWWHHMMTO
MMTOHWWWHHMMOO
MMTTOHWWWHHMMPPO
MMTTTOHWWHHMMPQOQO
MMTTTSOHWHMMTPQO.OQO
MTTTSSDOHMTSDOO...OO
TTTSSDDOOQO
SDDO.....O
DDO
.
.
.
.
.
.''')],
'sleep_a': [(76,92,99, '''DSTMMTO
...ODSTMMOO
O.ODSTMMMTO
OODSTMMTSSO
OODSTMMTO
O.ODSTHMMOO
O..ODSTHHMMPPO
O...ODSTHMPQOQO
O....ODSMTPQO.OQO
O.....ODSDOO...OO
O......OQO
........O'''), (63,101,99, '''HOOHHHMMOOSSSO
OHWWWHHMMTOSSO
HWWWWHHMMTTOSO
WWWWHHMMTTSSOO
WWWWHHMMTTSDO
WWWWHHMMTTDO
HWWWHHMMTDO
OHWWWHHMMOO
MOHWWWHHMMPPO
MTOHWWWHHMMPQOQO
TTSOHWWHMMTPQO.OQO
TSSSOHMMTSDOO...OO
...OHMTDO
....OQO
.....O
.
.
.
.
.
.
.
.
.''')],
'sleep_b': [(76,92,99, '''DSTMMTO
...ODSTMMOO
O.ODSTMMMTO
SODSTMMTSSO
SODSTMMTO
SOODSTHMMOO
SO.ODSTHHMMPPO
SO..ODSTHMPQOQO
SO...ODSMTPQO.OQO
O.....ODSDOO...OO
O......OQO
........O'''), (63,101,99, '''HOOHHHMMOOSSSO
OHWWWHHMMTOSSO
HWWWWHHMMTTOSO
WWWWHHMMTTSSOO
WWWWHHMMTTSDO
WWWWHHMMTTDO
WWWWHHMMTDO
HWWWHHMMTO
OHWWWHHMMOO
MOHWWWHHMMPPO
MTOHWWWHHMMPQOQO
TTSOHWWHMMTPQO.OQO
TSSOHMMTSDOO...OO
....OHMTDO
.....OQO
......O
.
.
.
.
.
.
.
.''')]
}

# Inspection follow-up: near horn gets a short recurved crown, rather than
# a long diagonal. Each position is specified independently at its own root.
# Sleep distal tips are retained alongside the overlapping near-arm rows.
FINISH = {
'idle_a': [(52,13,65, '''.
.
.
.....OOO
.....OPPOO
......OPPPQO
........OPPQO
.........OPQO
........OPPQO
........OQQO''')],
'idle_b': [(52,13,65, '''.
.
.
.....OOO
.....OPPOO
......OPPPQO
........OPPQO
.........OPQO
........OPPQO
........OQQO''')],
'idle_c': [(52,13,65, '''.
.
.
.....OOO
.....OPPOO
......OPPPQO
........OPPQO
.........OPQO
........OPPQO
........OQQO''')],
'windup': [(32,20,44, '''.
.
....OOO
....OPPOO
.....OPPPQO
.......OPPQO
........OPQO
.......OPPQO
.......OQQOO''')],
'move': [(62,34,74, '''.
.
....OOO
....OPPOO
.....OPPPQO
.......OPPQO
........OPQO
.......OPPQO
.......OQQOO''')],
'attack': [(62,42,74, '''.
.
....OOO
....OPPOO
.....OPPPQO
.......OPPQO
........OPQO
.......OPPQO
.......OQQOO''')],
'recover': [(50,26,62, '''.
.
....OOO
....OPPOO
.....OPPPQO
.......OPPQO
........OPQO
.......OPPQO
.......OQQOO''')],
'hit': [(31,33,43, '''.
.
....OOO
....OPPOO
.....OPPPQO
.......OPPQO
........OPQO
.......OPPQO
.......OQQOO''')],
'dead': [(68,78,80, '''.
...OOO
...OPPOO
....OPPPQO
......OPPQO
.......OPQO
......OPPQO
......OQQOOO''')],
'skill_a': [(51,25,63, '''.
.
....OOO
....OPPOO
.....OPPPQO
.......OPPQO
........OPQO
.......OPPQO
.......OQQOO''')],
'skill_b': [(39,32,51, '''.
.
....OOO
....OPPOO
.....OPPPQO
.......OPPQO
........OPQO
.......OPPQO
.......OQQOO''')],
'skill_c': [(49,32,61, '''.
.
....OOO
....OPPOO
.....OPPPQO
.......OPPQO
........OPQO
.......OPPQO
.......OQQOO''')],
'poison_a': [(47,46,59, '''.
.
....OOO
....OPPOO
.....OPPPQO
.......OPPQO
........OPQO
.......OPPQO
.......OQQOO''')],
'poison_b': [(46,47,58, '''.
.
....OOO
....OPPOO
.....OPPPQO
.......OPPQO
........OPQO
.......OPPQO
.......OQQOO''')],
'stun_a': [(49,57,61, '''.
.
....OOO
....OPPOO
.....OPPPQO
.......OPPQO
........OPQO
.......OPPQO
.......OQQOO''')],
'stun_b': [(49,57,61, '''.
.
....OOO
....OPPOO
.....OPPPQO
.......OPPQO
........OPQO
.......OPPQO
.......OQQOO''')],
'sleep_a': [(57,54,69, '''.
.
....OOO
....OPPOO
.....OPPPQO
.......OPPQO
........OPQO
.......OPPQO
.......OQQOO'''), (63,101,99, '''HOOHHHMMOOSSSO.....ODSDOO...OO
OHWWWHHMMTOSSO......OQO
HWWWWHHMMTTOSO.......O''')],
'sleep_b': [(57,54,69, '''.
.
....OOO
....OPPOO
.....OPPPQO
.......OPPQO
........OPQO
.......OPPQO
.......OQQOO'''), (63,101,99, '''HOOHHHMMOOSSSO.....ODSDOO...OO
OHWWWHHMMTOSSO......OQO
HWWWWHHMMTTOSO.......O''')]
}

def main():
    BEFORE.mkdir(exist_ok=True)
    for folder, names in [('poses', POSES), ('actions', ACTIONS)]:
        (BEFORE/folder).mkdir(exist_ok=True)
        for name in names:
            path = ROOT/folder/(name+'.pxgrid')
            old = BEFORE/folder/path.name
            if not old.exists():
                shutil.copy2(path, old)
            rows = old.read_text().splitlines()
            for x,y,right,literal in [HORNS[name]] + LIMBS[name] + FINISH[name]:
                for dy,pixels in enumerate(literal.splitlines()):
                    if len(pixels)>right-x or y+dy>124:
                        raise ValueError((name,x,y+dy,pixels))
                    rows[y+dy] = rows[y+dy][:x]+pixels.ljust(right-x,'.')+rows[y+dy][right:]
            path.write_text('\n'.join(rows)+'\n')
    for name in ['palette.json','AUTHORING.md','TIMING.md']:
        if not (BEFORE/name).exists():
            shutil.copy2(ROOT/name, BEFORE/name)

if __name__ == '__main__':
    main()
