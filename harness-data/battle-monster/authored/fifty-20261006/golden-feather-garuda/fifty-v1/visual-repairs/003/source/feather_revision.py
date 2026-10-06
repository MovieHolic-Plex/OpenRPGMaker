"""Literal row edits for the six current visual findings.

Read the preserved pre-revision grids. Each declaration belongs to one frame.
No shapes, frame transforms, shading generation or coordinate propagation.
Trailing dots only erase explicitly replaced portions of the old artwork.
"""
from pathlib import Path
R = Path(__file__).parent
frames = {}
for kind in ('poses', 'actions'):
    for p in (R/'before-feather-revision'/kind).glob('*.pxgrid'):
        frames[p.stem] = [list(s) for s in p.read_text().splitlines()]

def rows(name, y, width, text):
    for dy, line in enumerate(text.strip().splitlines()):
        x, pixels = line.split(' ', 1)
        x = int(x)
        if len(pixels) > width:
            raise ValueError((name, y+dy, len(pixels), width))
        frames[name][y+dy][x:x+width] = list(pixels.ljust(width, '.'))

# Upper wing: three thick primaries with rounded stepped tips, overlapping
# brown undersides and broad gold faces. Each grows back into the shoulder.
rows('idle_a', 9, 60, '''
5 ..................XXX
5 .................XhkkX
5 ................XhhkkX
5 ................XhhkkkX
5 ...............XohhhkkkX
5 ...............XohhhhkkX
5 ...............XgohhhhkkX
5 ..............XgohhhhhkkkX
5 ..............XgohhhhhhkkkX
5 .............XbgohhhhhhhkkkX
5 .............XbgohhhhhhhhkkkX
5 ........XXX..XbgohhhhhhhhhkkkX
5 .......XhkkX.XbgohhhhhhhhhhkkkX
5 ......XhhkkkXXbgohhhhhhhhhhhkkkX
5 ......XohhkkkXbgohhhhhhhhhhhhkkkX
5 .....XgohhhkkkXbgohhhhhhhhhhhhkkkX
5 .....XgohhhhkkkXbgohhhhhhhhhhhhkkkX
5 .....XbgohhhhkkkXbgohhhhhhhhhhhhkkkX
5 ......XbgohhhhkkkXbgohhhhhhhhhhhhkkkX
5 ......XbgohhhhhkkkXbgohhhhhhhhhhhhkkkX
5 .......XbgohhhhhkkkXbgohhhhhhhhhhhhkkkX
5 ........XbgohhhhhkkkXbgohhhhhhhhhhhhkkkX
5 ....XXX.XbgohhhhhhkkkXbgohhhhhhhhhhhhkkkX
5 ...XhkkXXbgohhhhhhhkkkXbgohhhhhhhhhhhhkkkX
5 ..XhhkkkXbgohhhhhhhhkkkXbgohhhhhhhhhhhhkkkX
5 ..XohhkkkXbgohhhhhhhhkkkXbgohhhhoohhhhhhkkkX
5 ..XgohhkkkXbgohhhhhhhhkkkXbgohhhooohhhhhhkkkX
5 ...XgohhkkkXbgohhhhohhhkkkXbgohhoooohhhhhhkkkX
5 ...XbgohhkkkXbgohhhooohhhkkkXbgohhoooohhhhhhkkX
5 ....XbgohhkkkXbgohhooooohhhkkkXbgohhooooohhhhhhX
5 .....XbgohhkkkXbgohhooooohhhkkkXbgohhooooohhhhhX
5 ......XbgohhkkkXbgohhooooohhhkkkXbgohhooooohhhhkX
5 .......XbgohhkkkXbgohhoooooohhhkkkXbgohhoooohhhhkX
5 ........XbgohhkkkXbgohhoooooohhhkkkXbgohhoooohhhhkX
5 .........XbgohhkkkXbgohhoooooohhhkkkXbgohhooohhhhhX
5 ..........XbgohhkkkXbgohhoooooohhhkkkXbgohhoohhhhhX
5 ...........XbgohhhkkkXbgohhoooooohhhkkkXbgohhhhhhhX
5 ............XbgohhhkkkXbgohhoooooohhhkkkXbgohhhhhhkX
5 .............XbgohhhkkkXbgohhoooooohhhkkkXbgohhhhkkX
5 ..............XbgohhhkkkXbgohhoooooohhhkkkXbgohhkkkX
5 ...............XbgohhhkkkXbgohhooooohhhhkkkXbgohhkkX
5 ................XbgohhhkkkXbgohhoooohhhhkkkXbgohhkX
5 .................XbgohhhkkkXbgohhoohhhhhkkkXbgohhhX
5 ..................XsbgohhhkkXbgohhhhhhhhkkXbgohhhX
5 ...................XsbgohhhhkkbgohhhhhhhhhbgohhhhX
5 .....................XsbgohhhhkgohhhhhhhhhgohhhhX
5 .......................XsbgohhhhohhhhhhhhhohhhhhhX
5 .........................XsbgohhohhhhhhhhhhhhhhhhX
5 ...........................XsbgohhhhhhhhhhhhhhhhhX
5 .............................XsbgohhhhhhhhhhhhhhhhX
5 ...............................XsbgohhhhhhhhhhhhhhX
5 .................................XsbgohhhhhhhhhhhhhX
5 ...................................XsbgohhhhhhhhhhX
5 .....................................XsbgohhhhhhhhX
5 .......................................XsbgohhhhhhX
''')
# Near wing: a wide feather fan, without a silver band or a hand-like elbow.
rows('idle_a', 59, 52, '''
12 ..............................................Xgohhh
12 ............................................Xgohhhkk
12 ..........................................Xgohhhhkkk
12 ........................................Xgohhhhhkkkh
12 ......................................Xgohhhhhhkkkhh
12 ....................................Xgohhhhhhhkkkhhh
12 ..................................Xgohhhhhhhhkkkhhhh
12 ................................Xgohhhhhhhhhkkkhhhhh
12 ..............................XgohhhhhhhhhhkkkhhhhhX
12 ............................XgohhhhhhhhhhhkkkhhhhoX
12 ..........................XgohhhhhhhhhhhhkkkhhhhoX
12 ........................XgohhhhhhhhhhhhhkkkhhhhoX
12 ......................XgohhhhhhhhhhhhhhkkkhhhhoX
12 ....................XgohhhhhhhhhhhhhhhkkkhhhhoX
12 ..................XgohhhhhhhhhhhhhhhhkkkhhhhoX
12 ................XgohhhhhhhhhhhhhhhhhkkkhhhhoX
12 ..............XgohhhhhhhhhhhhhhhhhhkkkhhhhoX
12 .............XgohhhhhhhhhhhhhhhhhhkkkhhhhoX
12 ............XgohhhhhhhhhhhhhhhhhhkkkhhhhoX
12 ...........XgohhhhhhhhhhhhhhhhhhkkkhhhhoX
12 ..........XgohhhhkkkkhhhhhhhhhkkkhhhhooX
12 .........XgohhhhkkkkhhhhhhhhkkkhhhhooX
12 ........XgohhhhkkkhhhhhhhohkkkhhhhooX
12 .......XgohhhhkkkhhhhhhhoohkkhhhhooX
12 .......XgohhhkkkhhhhhhhooohkhhhhooX
12 .......XgohhkkkhhhhhhhooohkhhhhooX
12 ........XohkkkhhhhhhhooohkhhhhooX
12 ........XohkkhhhhhhooohkhhhhhhoX
12 .........XohkhhhhhooohkhhhhhhoX
12 .........XgohhhhooohkhhhhhhhoX
12 ..........XgohhooohkhhhhhhhoX
12 ..........XgohhhXbgohhhhhooX
12 ...........XohhXbgohhhhhoX
12 ............XXXbgohhhhhoX
12 ...............XgohhhooX
12 ...............XohhhoX
12 ................XhhkX
12 .................XX.XgohhhhX
12 .....................XohhhkX
12 ......................XhhkkX
12 .......................XhkX
12 ........................XX
''')
# Three broad tail plumes, separate dark overlap seams and three distinct ends.
rows('idle_a', 96, 55, '''
5 ...XXX
5 ..XhhkkXXX
5 .XohhhhkkkXXX
5 XgohhhhhhkkkkXXX
5 XgohhhhhhhhhkkkkXXX............................gggggggg
5 .XgohhhhhhhhhhkkkkXXX.........................ggggggggg
5 ..XgohhhhhhhhhhkkkXgohhhhkkkXXX..............gggggggggg
5 ...XgohhhhhhhhhhkkXgohhhhhhkkkkXXX..........ggggggggggg
5 ....XgohhhhhhhhhhkXbgohhhhhhhhkkkkXXX.....Xgohhhhhhgggg
5 .....XgohhhhhhhhhhkXbgohhhhhhhhhhkkkXXX..Xgohhhhhhhgggg
5 ......XgohhhhhohhhhkXbgohhhhhhhhhhhkkkXXXgohhhhhhhhgggg
5 .......XgohhhhoohhhhkXbgohhhhhohhhhhhkkXgohhhhhhhhooggg
5 ........XgohhhoooohhhkXbgohhhooohhhhhhkXgohhhhhoooogggX
5 .........XgohhhoooohhhkXbgohhooooohhhhkXgohhhooooogggX
5 ..........XgohhhoooohhkXbgohhooooohhhhkXgohhooooogggX
5 ...........XgohhhoooohkXbgohhoooooohhhkXgohhoooogggX
5 ............XgohhhoooohXbgohhooooooohhkXgohhoooggX
5 .............XgohhhoooX.XbgohhoooooohhXgohhooggX
5 ..............XgohhoX...XbgohhooooohhXgohhoggX
5 ...............XohhX.....XbgohhooohhX.XohhogX
5 ................XhkX......XbgohhohhX..XhhkX
5 .................XX........XgohhhhX....XXX
5 ............................XohhkX
5 .............................XkkX
5 ..............................XX
5 .
5 .
5 .
''')

# Root correction after inspecting the first rendered fan: a broad gold
# shoulder must join the upper three primaries, not a detached fan.
rows('idle_a', 44, 18, '''
50 hhhhhhhX
50 hhhhhhhhX
50 hhhhhhhhkX
50 hhhhhhhhkkX
50 hhhhhhhhkkhkX..Xjj
50 hhhhhhhhkkhhkXhjww
50 hhhhhhhhkkhhhhhXjw
50 hhhhhhhhkkhhhhhXww
50 hhhhhhhhhhhhhhhXww
50 hhhhhhhhhhhhhhhXww
50 ggoohhhhhhhhhhhXww
50 bggoohhhhhhhhhhXjj
50 sbggoohhhhhhhhhXii
50 XsbggoohhhhhhhhXvv
50 .Xsbggoohhhjjjjiiv
''')
rows('idle_a', 59, 10, '''
60 gohhhkkhji
60 gohhhkkhji
60 ohhhhkkhji
60 hhhhhkhhji
60 hhhhkhhhji
60 hhhkhhhhji
60 hhkhhhhgoX
60 hkhhhhgoX.
60 khhhhgoX..
60 hhhhgoX...
60 hhhgoX....
60 hhgoX.....
60 hgoX......
60 goX.......
60 oX........
60 X.........
60 .
60 .
''')
# The third near primary ends above the tail, with its own broad gold face.
rows('idle_a', 81, 40, '''
18 ...XgohhhhkkkkhhhhhhhhhkkkhhhhgoX
18 ..XgohhhhkkkhhhhhohhhhhkkkhhhgoX
18 .XgohhhhkkkhhhhhoohhhhhkkhhhgoX
18 .XgohhhkkkhhhhhooohhhhhkhhhgoX
18 .XgohhkkkhhhhhooohhhhhkhhhgoX
18 ..XohkkkhhhhhooohhhhhhkhhgoX
18 ..XohkkhhhhooohhhhhhhhkhgoX
18 ...XohkhhooohhhhhhhhhhkhgoX
18 ...XgohhhooXbgohhhhhhhhgoX
18 ....XgohhoXbgohhhhhhhhgoX
18 .....XohhXbgohhhXbgohhgoX
18 ......XXXbgohhhXbgohhgoX
18 .........XgohhkXgohhhgoX
18 ..........XhhkX.XohhkX
18 ...........XXX...XkkX
''')
rows('idle_a', 100, 29, '''
32 kkkXXsbggoohhhhhhhhhhgggggggg
32 hkkkXXsbggoohhhhhhhhhgggggggg
32 hhkkkXgohhhhkkkXXsbgohggggggg
32 hhhkkXgohhhhhhkkkXsbgohgggggg
''')

def ink(name, y, text):
    for dy, line in enumerate(text.strip().splitlines()):
        x, pixels = line.split(' ', 1)
        x = int(x)
        frames[name][y+dy][x:x+len(pixels)] = list(pixels)

# Restore the chest along its curved authored boundary; do not propagate a
# rectangle into the intended open air between wing and chest.
ink('idle_a', 72, '''
58 Xbgohhhhhhhh
57 Xbgohhhhhhhhh
56 Xbgohhhhhhhhhh
55 Xbgohhhhhhhhhhh
54 Xbgohhhhhhhhhhhh
54 bgohhhhhhhhhhhhh
54 bgohhhhhhhhhhhhh
54 bgohhhhhhhhhhhhh
54 bgohhhhhhhhhhhhh
54 bgohhhhhhhhhhhhh
54 bgohhhhhhhhhhhhh
54 bgohhhhhhhhhhhhh
54 bgohhhhhhhhhhhhh
54 bgohhhhhhhhohhhh
54 bgohhhhhhhooohhh
54 bgohhhhhhooooohh
54 bgohhhhhhooooohh
54 bgohhhhhoooooohh
54 bgohhhhhoooooohh
54 bgohhhhooogooohh
54 bgohhhhooogooohh
54 bgohhhhooogooohh
54 bgohhhhooogooohh
54 Xbgohhhhooogoooh
''')
ink('idle_a', 124, '''
52 .....
''')

rows('idle_b', 9, 60, '''
5 ..................XXX
5 .................XhkkX
5 ................XhhkkX
5 ................XhhkkkX
5 ...............XohhhkkkX
5 ...............XohhhhkkX
5 ...............XgohhhhkkX
5 ..............XgohhhhhkkkX
5 ..............XgohhhhhhkkkX
5 .............XbgohhhhhhhkkkX
5 .............XbgohhhhhhhhkkkX
5 ........XXX..XbgohhhhhhhhhkkkX
5 .......XhkkX.XbgohhhhhhhhhhkkkX
5 ......XhhkkkXXbgohhhhhhhhhhhkkkX
5 ......XohhkkkXbgohhhhhhhhhhhhkkkX
5 .....XgohhhkkkXbgohhhhhhhhhhhhkkkX
5 .....XgohhhhkkkXbgohhhhhhhhhhhhkkkX
5 .....XbgohhhhkkkXbgohhhhhhhhhhhhkkkX
5 ......XbgohhhhkkkXbgohhhhhhhhhhhhkkkX
5 ......XbgohhhhhkkkXbgohhhhhhhhhhhhkkkX
5 .......XbgohhhhhkkkXbgohhhhhhhhhhhhkkkX
5 ........XbgohhhhhkkkXbgohhhhhhhhhhhhkkkX
5 ....XXX.XbgohhhhhhkkkXbgohhhhhhhhhhhhkkkX
5 ...XhkkXXbgohhhhhhhkkkXbgohhhhhhhhhhhhkkkX
5 ..XhhkkkXbgohhhhhhhhkkkXbgohhhhhhhhhhhhkkkX
5 ..XohhkkkXbgohhhhhhhhkkkXbgohhhhoohhhhhhkkkX
5 ..XgohhkkkXbgohhhhhhhhkkkXbgohhhooohhhhhhkkkX
5 ...XgohhkkkXbgohhhhohhhkkkXbgohhoooohhhhhhkkkX
5 ...XbgohhkkkXbgohhhooohhhkkkXbgohhoooohhhhhhkkX
5 ....XbgohhkkkXbgohhooooohhhkkkXbgohhooooohhhhhhX
5 .....XbgohhkkkXbgohhooooohhhkkkXbgohhooooohhhhhX
5 ......XbgohhkkkXbgohhooooohhhkkkXbgohhooooohhhhkX
5 .......XbgohhkkkXbgohhoooooohhhkkkXbgohhoooohhhhkX
5 ........XbgohhkkkXbgohhoooooohhhkkkXbgohhoooohhhhkX
5 .........XbgohhkkkXbgohhoooooohhhkkkXbgohhooohhhhhX
5 ..........XbgohhkkkXbgohhoooooohhhkkkXbgohhoohhhhhX
5 ...........XbgohhhkkkXbgohhoooooohhhkkkXbgohhhhhhhX
5 ............XbgohhhkkkXbgohhoooooohhhkkkXbgohhhhhhkX
5 .............XbgohhhkkkXbgohhoooooohhhkkkXbgohhhhkkX
5 ..............XbgohhhkkkXbgohhoooooohhhkkkXbgohhkkkX
5 ...............XbgohhhkkkXbgohhooooohhhhkkkXbgohhkkX
5 ................XbgohhhkkkXbgohhoooohhhhkkkXbgohhkX
5 .................XbgohhhkkkXbgohhoohhhhhkkkXbgohhhX
5 ..................XsbgohhhkkXbgohhhhhhhhkkXbgohhhX
5 ...................XsbgohhhhkkbgohhhhhhhhhbgohhhhX
5 .....................XsbgohhhhkgohhhhhhhhhgohhhhX
5 .......................XsbgohhhhohhhhhhhhhohhhhhhX
5 .........................XsbgohhohhhhhhhhhhhhhhhhX
5 ...........................XsbgohhhhhhhhhhhhhhhhhX
5 .............................XsbgohhhhhhhhhhhhhhhhX
5 ...............................XsbgohhhhhhhhhhhhhhX
5 .................................XsbgohhhhhhhhhhhhhX
5 ...................................XsbgohhhhhhhhhhX
5 .....................................XsbgohhhhhhhhX
5 .......................................XsbgohhhhhhX
''')
rows('idle_b', 44, 18, '''
50 hhhhhhhX
50 hhhhhhhhX
50 hhhhhhhhkX
50 hhhhhhhhkkX
50 hhhhhhhhkkhkX..Xjj
50 hhhhhhhhkkhhkXhjww
50 hhhhhhhhkkhhhhhXjw
50 hhhhhhhhkkhhhhhXww
50 hhhhhhhhhhhhhhhXww
50 hhhhhhhhhhhhhhhXww
50 ggoohhhhhhhhhhhXww
50 bggoohhhhhhhhhhXjj
50 sbggoohhhhhhhhhXii
50 XsbggoohhhhhhhhXvv
50 .Xsbggoohhhjjjjiiv
''')
rows('idle_b', 59, 46, '''
24 ..................................Xgohhhhkkhji
24 ................................Xgohhhhhkkhji
24 ..............................Xgohhhhhhkkkhji
24 ............................Xgohhhhhhhkkkhhji
24 ..........................Xgohhhhhhhhkkkhhhji
24 ........................Xgohhhhhhhhhkkkhhhhji
24 ......................XgohhhhhhhhhhkkkhhhhhX
24 ....................XgohhhhhhhhhhhkkkhhhhgoX
24 ..................XgohhhhhhhhhhhhkkkhhhhgoX
24 ................XgohhhhhhhhhhhhhkkkhhhhgoX
24 ..............XgohhhhhhhhhhhhhhkkkhhhhgoX
24 ............XgohhhhhhhhhhhhhhhkkkhhhhgoX
24 ..........XgohhhhhhhhhhhhhhhhkkkhhhhgoX
24 ........XgohhhhhhhhhhhhhhhhhkkkhhhhgoX
24 ......XgohhhhhhhhhhhhhhhhhhkkkhhhhgoX
24 ....XgohhhhhhhhhhhhhhhhhhhkkkhhhhgoX
24 ..XgohhhhhhhhhhhhhhhhhhhhkkkhhhhgoX
24 .XgohhhhhhhhhhhhhhhhhhhhkkkhhhhgoX
24 XgohhhhhhhhhhhhhhhhhhhhkkkhhhhgoX
24 gohhhhhhhhhhhhhhhhhhhhkkkhhhhgoX
24 ohhhhhkkkkhhhhhhhhhhhkkkhhhhgoX
24 hhhhhkkkkhhhhhhhhhhhkkkhhhhgoX
24 hhhhkkkkhhhhhhhhhkkkhhhhgoX
24 hhhkkkhhhhhohhhhhkkkhhhgoX
24 hhkkkhhhhhoohhhhhkkhhhgoX
24 hkkkhhhhhooohhhhhkhhhgoX
24 kkkhhhhooohhhhhhhkhhgoX
24 kkhhhhooohhhhhhhhkhgoX
24 khhhooohhhhhhhhhhkhgoX
24 ohhooXbgohhhhhhhhhgoX
24 ohhoXbgohhhhhhhhgoX
24 ohhXbgohhhXbgohhgoX
24 XXXbgohhhXbgohhgoX
24 ...XgohhkXgohhhgoX
24 ....XhhkX.XohhkX
24 .....XXX...XkkX
24 ............XX
''')

rows('idle_c', 9, 60, '''
5 ..................XXX
5 .................XhkkX
5 ................XhhkkX
5 ................XhhkkkX
5 ...............XohhhkkkX
5 ...............XohhhhkkX
5 ...............XgohhhhkkX
5 ..............XgohhhhhkkkX
5 ..............XgohhhhhhkkkX
5 .............XbgohhhhhhhkkkX
5 .............XbgohhhhhhhhkkkX
5 ........XXX..XbgohhhhhhhhhkkkX
5 .......XhkkX.XbgohhhhhhhhhhkkkX
5 ......XhhkkkXXbgohhhhhhhhhhhkkkX
5 ......XohhkkkXbgohhhhhhhhhhhhkkkX
5 .....XgohhhkkkXbgohhhhhhhhhhhhkkkX
5 .....XgohhhhkkkXbgohhhhhhhhhhhhkkkX
5 .....XbgohhhhkkkXbgohhhhhhhhhhhhkkkX
5 ......XbgohhhhkkkXbgohhhhhhhhhhhhkkkX
5 ......XbgohhhhhkkkXbgohhhhhhhhhhhhkkkX
5 .......XbgohhhhhkkkXbgohhhhhhhhhhhhkkkX
5 ........XbgohhhhhkkkXbgohhhhhhhhhhhhkkkX
5 ....XXX.XbgohhhhhhkkkXbgohhhhhhhhhhhhkkkX
5 ...XhkkXXbgohhhhhhhkkkXbgohhhhhhhhhhhhkkkX
5 ..XhhkkkXbgohhhhhhhhkkkXbgohhhhhhhhhhhhkkkX
5 ..XohhkkkXbgohhhhhhhhkkkXbgohhhhoohhhhhhkkkX
5 ..XgohhkkkXbgohhhhhhhhkkkXbgohhhooohhhhhhkkkX
5 ...XgohhkkkXbgohhhhohhhkkkXbgohhoooohhhhhhkkkX
5 ...XbgohhkkkXbgohhhooohhhkkkXbgohhoooohhhhhhkkX
5 ....XbgohhkkkXbgohhooooohhhkkkXbgohhooooohhhhhhX
5 .....XbgohhkkkXbgohhooooohhhkkkXbgohhooooohhhhhX
5 ......XbgohhkkkXbgohhooooohhhkkkXbgohhooooohhhhkX
5 .......XbgohhkkkXbgohhoooooohhhkkkXbgohhoooohhhhkX
5 ........XbgohhkkkXbgohhoooooohhhkkkXbgohhoooohhhhkX
5 .........XbgohhkkkXbgohhoooooohhhkkkXbgohhooohhhhhX
5 ..........XbgohhkkkXbgohhoooooohhhkkkXbgohhoohhhhhX
5 ...........XbgohhhkkkXbgohhoooooohhhkkkXbgohhhhhhhX
5 ............XbgohhhkkkXbgohhoooooohhhkkkXbgohhhhhhkX
5 .............XbgohhhkkkXbgohhoooooohhhkkkXbgohhhhkkX
5 ..............XbgohhhkkkXbgohhoooooohhhkkkXbgohhkkkX
5 ...............XbgohhhkkkXbgohhooooohhhhkkkXbgohhkkX
5 ................XbgohhhkkkXbgohhoooohhhhkkkXbgohhkX
5 .................XbgohhhkkkXbgohhoohhhhhkkkXbgohhhX
5 ..................XsbgohhhkkXbgohhhhhhhhkkXbgohhhX
5 ...................XsbgohhhhkkbgohhhhhhhhhbgohhhhX
5 .....................XsbgohhhhkgohhhhhhhhhgohhhhX
5 .......................XsbgohhhhohhhhhhhhhohhhhhhX
5 .........................XsbgohhohhhhhhhhhhhhhhhhX
5 ...........................XsbgohhhhhhhhhhhhhhhhhX
5 .............................XsbgohhhhhhhhhhhhhhhhX
5 ...............................XsbgohhhhhhhhhhhhhhX
5 .................................XsbgohhhhhhhhhhhhhX
5 ...................................XsbgohhhhhhhhhhX
5 .....................................XsbgohhhhhhhhX
5 .......................................XsbgohhhhhhX
''')
rows('idle_c', 44, 18, '''
50 hhhhhhhX
50 hhhhhhhhX
50 hhhhhhhhkX
50 hhhhhhhhkkX
50 hhhhhhhhkkhkX..Xjj
50 hhhhhhhhkkhhkXhjww
50 hhhhhhhhkkhhhhhXjw
50 hhhhhhhhkkhhhhhXww
50 hhhhhhhhhhhhhhhXww
50 hhhhhhhhhhhhhhhXww
50 ggoohhhhhhhhhhhXww
50 bggoohhhhhhhhhhXjj
50 sbggoohhhhhhhhhXii
50 XsbggoohhhhhhhhXvv
50 .Xsbggoohhhjjjjiiv
''')
rows('idle_c', 59, 58, '''
12 ..............................................Xgohhhhkkhji
12 ............................................Xgohhhhhkkhji
12 ..........................................Xgohhhhhhkkkhji
12 ........................................Xgohhhhhhhkkkhhji
12 ......................................Xgohhhhhhhhkkkhhhji
12 ....................................Xgohhhhhhhhhkkkhhhhji
12 ..................................XgohhhhhhhhhhkkkhhhhhX
12 ................................XgohhhhhhhhhhhkkkhhhhgoX
12 ..............................XgohhhhhhhhhhhhkkkhhhhgoX
12 ............................XgohhhhhhhhhhhhhkkkhhhhgoX
12 ..........................XgohhhhhhhhhhhhhhkkkhhhhgoX
12 ........................XgohhhhhhhhhhhhhhhkkkhhhhgoX
12 ......................XgohhhhhhhhhhhhhhhhkkkhhhhgoX
12 ....................XgohhhhhhhhhhhhhhhhhkkkhhhhgoX
12 ..................XgohhhhhhhhhhhhhhhhhhkkkhhhhgoX
12 ................XgohhhhhhhhhhhhhhhhhhhkkkhhhhgoX
12 ..............XgohhhhhhhhhhhhhhhhhhhhkkkhhhhgoX
12 .............XgohhhhhhhhhhhhhhhhhhhhkkkhhhhgoX
12 ............XgohhhhhhhhhhhhhhhhhhhhkkkhhhhgoX
12 ...........XgohhhhhhhhhhhhhhhhhhhhhkkkhhhhgoX
12 ..........XgohhhhhkkkkhhhhhhhhhhhkkkhhhhgoX
12 .........XgohhhhkkkkhhhhhhhhhhhkkkhhhhgoX
12 ........XgohhhhkkkkhhhhhhhhhkkkhhhhgoX
12 .......XgohhhhkkkhhhhhohhhhhkkkhhhgoX
12 .......XgohhhkkkhhhhhoohhhhhkkhhhgoX
12 .......XgohhkkkhhhhhooohhhhhkhhhgoX
12 ........XohkkkhhhhooohhhhhhhkhhgoX
12 ........XohkkhhhhooohhhhhhhhkhgoX
12 .........XohkhhhooohhhhhhhhhkhgoX
12 .........XgohhooXbgohhhhhhhhhgoX
12 ..........XgohhoXbgohhhhhhhhgoX
12 ...........XohhXbgohhhXbgohhgoX
12 ............XXXbgohhhXbgohhgoX
12 ...............XgohhkXgohhhgoX
12 ................XhhkX.XohhkX
12 .................XXX...XkkX
12 ........................XX
''')
# Each chest is repaired at its own boundary after the feather fans.
ink('idle_b', 72, '''
58 Xbgohhhhhhhhhhoo
57 Xbgohhhhhhhhhhhoo
56 Xbgohhhhhhhhhhhhoo
55 Xbgohhhhhhhhhhhhhoo
54 Xbgohhhhhhhhhhhhhooo
54 bgohhhhhhhhhhhhhhhhh
54 bgohhhhhhhhhhhhhhhhh
54 bgohhhhhhhhhhhhhhhhh
54 bgohhhhhhhhhhhhhhhhh
54 bgohhhhhhhhhhhhhhhhh
54 bgohhhhhhhhhhhhhhhhh
54 bgohhhhhhhhhhhhhhhhh
54 bgohhhhhhhhhhhhhhhhh
54 bgohhhhhhhhohhhhhhhh
54 bgohhhhhhhooohhhhhhh
54 bgohhhhhhooooohhhhhh
54 bgohhhhhhooooohhhhhh
54 bgohhhhhoooooohhhhhh
54 bgohhhhhoooooohhhhhh
54 bgohhhhooogooohhhhhh
54 bgohhhhooogooohhhhhh
54 bgohhhhooogooohhhhhh
54 bgohhhhooogooohhhhhh
54 Xbgohhhhooogooohhhhh
''')
rows('idle_b', 76, 12, '''
12 ............
12 ............
12 ............
12 ............
12 ............
12 ............
12 ............
12 ............
12 ............
12 ............
12 ............
12 ............
12 ............
12 ............
12 ............
12 ............
12 ............
12 ............
12 ............
12 ............
''')
ink('idle_c', 72, '''
58 Xbgohhhhhhhhhhoo
57 Xbgohhhhhhhhhhhoo
56 Xbgohhhhhhhhhhhhoo
55 Xbgohhhhhhhhhhhhhoo
54 Xbgohhhhhhhhhhhhhooo
54 bgohhhhhhhhhhhhhhooo
54 bgohhhhhhhhhhhhhhooo
54 bgohhhhhhhhhhhhhhooo
54 bgohhhhhhhhhhhhhhooo
54 bgohhhhhhhhhhhhhhooo
54 bgohhhhhhhhhhhhhhooo
54 bgohhhhhhhhhhhhhhooo
54 bgohhhhhhhhhhhhhhooo
54 bgohhhhhhhhohhhhhooo
54 bgohhhhhhhooohhhhooo
54 bgohhhhhhooooohhhhooo
54 bgohhhhhhooooohhhhooo
54 bgohhhhhoooooohhhhooo
54 bgohhhhhoooooohhhhooo
54 bgohhhhooogooohhhhooo
54 bgohhhhooogooohhhhooo
54 bgohhhhooogooohhhhooo
54 bgohhhhooogooohhhhooo
54 Xbgohhhhooogooohhhoo
''')

rows('idle_b', 96, 55, '''
5 ...XXX
5 ..XhhkkXXX
5 .XohhhhkkkXXX
5 XgohhhhhhkkkkXXX
5 XgohhhhhhhhhkkkkXXX......kkkXXsbggoohhhhhhhhhhgggggggg
5 .XgohhhhhhhhhhkkkkXXX....hkkkXXsbggoohhhhhhhhhgggggggg
5 ..XgohhhhhhhhhhkkkXgohhhhkkkXXsbgohhhhhhhhhhggggggggg
5 ...XgohhhhhhhhhhkkXgohhhhhhkkkkXXXsbgohhhhhggggggggggg
5 ....XgohhhhhhhhhhkXbgohhhhhhhhkkkkXXXbgohhhhhhgggggggg
5 .....XgohhhhhhhhhhkXbgohhhhhhhhhhkkkXXXgohhhhhhhhggggg
5 ......XgohhhhhohhhhkXbgohhhhhhhhhhhkkkXXXgohhhhhhhhgggg
5 .......XgohhhhoohhhhkXbgohhhhhohhhhhhkkXgohhhhhhhhooggg
5 ........XgohhhoooohhhkXbgohhhooohhhhhhkXgohhhhhoooogggX
5 .........XgohhhoooohhhkXbgohhooooohhhhkXgohhhooooogggX
5 ..........XgohhhoooohhkXbgohhooooohhhhkXgohhooooogggX
5 ...........XgohhhoooohkXbgohhoooooohhhkXgohhoooogggX
5 ............XgohhhoooohXbgohhooooooohhkXgohhoooggX
5 .............XgohhhoooX.XbgohhoooooohhXgohhooggX
5 ..............XgohhoX...XbgohhooooohhXgohhoggX
5 ...............XohhX.....XbgohhooohhX.XohhogX
5 ................XhkX......XbgohhohhX..XhhkX
5 .................XX........XgohhhhX....XXX
5 ............................XohhkX
5 .............................XkkX
5 ..............................XX
5 .
5 .
5 .
''')
ink('idle_b', 124, '''
52 .....
''')
rows('idle_c', 96, 55, '''
5 ...XXX
5 ..XhhkkXXX
5 .XohhhhkkkXXX
5 XgohhhhhhkkkkXXX
5 XgohhhhhhhhhkkkkXXX......kkkXXsbggoohhhhhhhhhhgggggggg
5 .XgohhhhhhhhhhkkkkXXX....hkkkXXsbggoohhhhhhhhhgggggggg
5 ..XgohhhhhhhhhhkkkXgohhhhkkkXXsbgohhhhhhhhhhggggggggg
5 ...XgohhhhhhhhhhkkXgohhhhhhkkkkXXXsbgohhhhhggggggggggg
5 ....XgohhhhhhhhhhkXbgohhhhhhhhkkkkXXXbgohhhhhhgggggggg
5 .....XgohhhhhhhhhhkXbgohhhhhhhhhhkkkXXXgohhhhhhhhggggg
5 ......XgohhhhhohhhhkXbgohhhhhhhhhhhkkkXXXgohhhhhhhhgggg
5 .......XgohhhhoohhhhkXbgohhhhhohhhhhhkkXgohhhhhhhhooggg
5 ........XgohhhoooohhhkXbgohhhooohhhhhhkXgohhhhhoooogggX
5 .........XgohhhoooohhhkXbgohhooooohhhhkXgohhhooooogggX
5 ..........XgohhhoooohhkXbgohhooooohhhhkXgohhooooogggX
5 ...........XgohhhoooohkXbgohhoooooohhhkXgohhoooogggX
5 ............XgohhhoooohXbgohhooooooohhkXgohhoooggX
5 .............XgohhhoooX.XbgohhoooooohhXgohhooggX
5 ..............XgohhoX...XbgohhooooohhXgohhoggX
5 ...............XohhX.....XbgohhooohhX.XohhogX
5 ................XhkX......XbgohhohhX..XhhkX
5 .................XX........XgohhhhX....XXX
5 ............................XohhkX
5 .............................XkkX
5 ..............................XX
5 .
5 .
5 .
''')
ink('idle_c', 124, '''
52 .....
''')

# Gathered pose: chest below the white throat tapers continuously down.
ink('windup', 65, '''
73 ijhooovvX
73 jhooohhvX
73 hooohhhvX
73 ooohhhhgvX
73 oohhhhhggvX
73 ohhhhhhgggX
73 hhhhhhhgggX
73 hhhhhhooggX
73 hhhhhhooggX
73 hhhhhhooggX
''')
# Hooked closed beaks retain a dark lower edge against white neck feathers.
rows('sleep_a', 74, 17, '''
83 hohhhjjwjX
83 hohhjjwwwjiX
83 hojjtjjwwjiiX
83 hojtXtjwwjiitX
83 jjtXXtjwjiivttX
83 jtX..XtjjiivttX
83 tX...XtiivvttX
83 X....XtiivttX
83 ....XtjivttX
83 ...XtjivttX
''')
rows('sleep_b', 75, 17, '''
83 hohhhhjjwjX
83 hohhhjjwwwjiX
83 hojjttjjwwjiiX
83 hojtXXtjwwjiitX
83 jjtX.XtjwjiivttX
83 jtX..XtjjiivttX
83 tX...XtiivvttX
83 X....XtiivttX
83 ....XtjivttX
83 ...XtjivttX
''')

# Recovery folds the same three upper primaries a few pixels lower.
rows('recover', 9, 60, '''
5 .
5 .
5 .
5 .
5 .
5 .....................XXX
5 ....................XhkkX
5 ...................XhhkkX
5 ...................XhhkkkX
5 ..................XohhhkkkX
5 ..................XohhhhkkX
5 ..................XgohhhhkkX
5 .................XgohhhhhkkkX
5 .................XgohhhhhhkkkX
5 ...........XXX..XbgohhhhhhhkkkX
5 ..........XhkkX.XbgohhhhhhhhkkkX
5 .........XhhkkkXXbgohhhhhhhhhkkkX
5 .........XohhkkkXbgohhhhhhhhhhkkkX
5 ........XgohhhkkkXbgohhhhhhhhhhkkkX
5 ........XgohhhhkkkXbgohhhhhhhhhhkkkX
5 ........XbgohhhhkkkXbgohhhhhhhhhhkkkX
5 .........XbgohhhhkkkXbgohhhhhhhhhhkkkX
5 ....XXX..XbgohhhhhkkkXbgohhhhhhhhhhkkkX
5 ...XhkkX..XbgohhhhhkkkXbgohhhhhhhhhhkkkX
5 ..XhhkkkX..XbgohhhhhkkkXbgohhhhhhhhhhkkkX
5 ..XohhkkkX.XbgohhhhhhkkkXbgohhhhohhhhhkkkX
5 ..XgohhkkkXXbgohhhhhhhkkkXbgohhhoohhhhhkkkX
5 ...XgohhkkkXbgohhhhhhhhkkkXbgohhooohhhhhkkkX
5 ...XbgohhkkkXbgohhhhohhhkkkXbgohhoooohhhhhkkX
5 ....XbgohhkkkXbgohhhooohhhkkkXbgohhoooohhhhhX
5 .....XbgohhkkkXbgohhooooohhhkkkXbgohhoooohhhhX
5 ......XbgohhkkkXbgohhooooohhhkkkXbgohhoooohhhkX
5 .......XbgohhkkkXbgohhooooohhhkkkXbgohhoooohhhkX
5 ........XbgohhkkkXbgohhoooooohhhkkkXbgohhooohhhkX
5 .........XbgohhkkkXbgohhoooooohhhkkkXbgohhoohhhhX
5 ..........XbgohhkkkXbgohhoooooohhhkkkXbgohhhhhhhX
5 ...........XbgohhhkkkXbgohhoooooohhhkkkXbgohhhhhX
5 ............XbgohhhkkkXbgohhoooooohhhkkkXbgohhhhhX
5 .............XbgohhhkkkXbgohhoooooohhhkkkXbgohhhhX
5 ..............XbgohhhkkkXbgohhoooooohhhkkkXbgohhhhX
5 ...............XbgohhhkkkXbgohhooooohhhhkkkXbgohhhX
5 ................XbgohhhkkkXbgohhoooohhhhkkkXbgohhhX
5 .................XbgohhhkkkXbgohhoohhhhhkkkXbgohhhX
5 ..................XsbgohhhkkXbgohhhhhhhhkkXbgohhhX
5 ...................XsbgohhhhkkbgohhhhhhhhhbgohhhhX
5 .....................XsbgohhhhkgohhhhhhhhhgohhhhX
5 .......................XsbgohhhhohhhhhhhhhohhhhhhX
5 .........................XsbgohhohhhhhhhhhhhhhhhhX
5 ...........................XsbgohhhhhhhhhhhhhhhhhX
5 .............................XsbgohhhhhhhhhhhhhhhhX
5 ...............................XsbgohhhhhhhhhhhhhhX
5 .................................XsbgohhhhhhhhhhhhhX
5 ...................................XsbgohhhhhhhhhhX
5 .....................................XsbgohhhhhhhhX
5 .......................................XsbgohhhhhhX
''')
rows('recover', 44, 18, '''
50 hhhhhhhX
50 hhhhhhhhX
50 hhhhhhhhkX
50 hhhhhhhhkkX
50 hhhhhhhhkkhkX..Xjj
50 hhhhhhhhkkhhkXhjww
50 hhhhhhhhkkhhhhhXjw
50 hhhhhhhhkkhhhhhXww
50 hhhhhhhhhhhhhhhXww
50 hhhhhhhhhhhhhhhXww
50 ggoohhhhhhhhhhhXww
50 bggoohhhhhhhhhhXjj
50 sbggoohhhhhhhhhXii
50 XsbggoohhhhhhhhXvv
50 .Xsbggoohhhjjjjiiv
''')
rows('recover', 59, 58, '''
12 ..............................................Xgohhhhkkhji
12 ............................................Xgohhhhhkkhji
12 ..........................................Xgohhhhhhkkkhji
12 ........................................Xgohhhhhhhkkkhhji
12 ......................................Xgohhhhhhhhkkkhhhji
12 ....................................Xgohhhhhhhhhkkkhhhhji
12 ..................................XgohhhhhhhhhhkkkhhhhhX
12 ................................XgohhhhhhhhhhhkkkhhhhgoX
12 ..............................XgohhhhhhhhhhhhkkkhhhhgoX
12 ............................XgohhhhhhhhhhhhhkkkhhhhgoX
12 ..........................XgohhhhhhhhhhhhhhkkkhhhhgoX
12 ........................XgohhhhhhhhhhhhhhhkkkhhhhgoX
12 ......................XgohhhhhhhhhhhhhhhhkkkhhhhgoX
12 ....................XgohhhhhhhhhhhhhhhhhkkkhhhhgoX
12 ..................XgohhhhhhhhhhhhhhhhhhkkkhhhhgoX
12 ................XgohhhhhhhhhhhhhhhhhhhkkkhhhhgoX
12 ..............XgohhhhhhhhhhhhhhhhhhhhkkkhhhhgoX
12 .............XgohhhhhhhhhhhhhhhhhhhhkkkhhhhgoX
12 ............XgohhhhhhhhhhhhhhhhhhhhkkkhhhhgoX
12 ...........XgohhhhhhhhhhhhhhhhhhhhhkkkhhhhgoX
12 ..........XgohhhhhkkkkhhhhhhhhhhhkkkhhhhgoX
12 .........XgohhhhkkkkhhhhhhhhhhhkkkhhhhgoX
12 ........XgohhhhkkkkhhhhhhhhhkkkhhhhgoX
12 ........XgohhhkkkhhhhhohhhhhkkkhhhgoX
12 ........XgohhkkkhhhhhoohhhhhkkhhhgoX
12 ........XgohhkkhhhhhooohhhhhkhhhgoX
12 .........XohkkhhhhooohhhhhhhkhhgoX
12 .........XohkhhhhooohhhhhhhhkhgoX
12 ..........XohhhhooohhhhhhhhhkhgoX
12 ..........XgohhoXbgohhhhhhhhhgoX
12 ...........XohhoXbgohhhhhhhhgoX
12 ............XhhXbgohhhXbgohhgoX
12 .............XXbgohhhXbgohhgoX
12 ...............XgohhkXgohhhgoX
12 ................XhhkX.XohhkX
12 .................XXX...XkkX
12 ........................XX
''')
ink('recover', 72, '''
58 Xbgohhhhhhhhhhoo
57 Xbgohhhhhhhhhhhoo
56 Xbgohhhhhhhhhhhhoo
55 Xbgohhhhhhhhhhhhhoo
54 Xbgohhhhhhhhhhhhhooo
54 bgohhhhhhhhhhhhhhooo
54 bgohhhhhhhhhhhhhhooo
54 bgohhhhhhhhhhhhhhooo
54 bgohhhhhhhhhhhhhhooo
54 bgohhhhhhhhhhhhhhooo
54 bgohhhhhhhhhhhhhhooo
54 bgohhhhhhhhhhhhhhooo
54 bgohhhhhhhhhhhhhhooo
54 bgohhhhhhhhohhhhhooo
54 bgohhhhhhhooohhhhooo
54 bgohhhhhhooooohhhhooo
54 bgohhhhhhooooohhhhooo
54 bgohhhhhoooooohhhhooo
54 bgohhhhhoooooohhhhooo
54 bgohhhhooogooohhhhooo
54 bgohhhhooogooohhhhooo
54 bgohhhhooogooohhhhooo
54 bgohhhhooogooohhhhooo
54 Xbgohhhhooogooohhhoo
''')

# Cast: individually authored large blades, not parallel 1px light rays.
# Primary one: broad barbed gold vane around a bright shaft.
rows('skill_b', 5, 49, '''
75 ..............................................kX
75 ..........................................khkkX
75 ......................................khhkkwkX
75 ..................................khhkkkwwkhX
75 ...............................khhhkkkwwwkhX
75 ...........................khhkkhkkwwwwkhX
75 .......................khhkkhhkwwwwkkhhX
75 ....................khhkkhhkkwwwwkkhhhX
75 ................khhkkhhkkwwwwkkhhhhoX
75 ............khhkkhhkkwwwwkkhhhhhoX
75 .........khhkkhhkkwwwwkkhhhhhhoX
75 ......khhkkhhkkwwwwkkhhhhhhoX
75 ...khhkkhhkkwwwwkkhhhhhoX
75 .khhkkhhkkwwwwkkhhhhhoX
75 khhkkhhkkwwwwkkhhhoX
75 kwwwwwwwwwwkkhhhoX
75 kwwwwwwkkhhhhhgoX
75 hkkwkkhhhhhgggX
75 ohkkhhhhhgggX
75 gohhhhggggX
75 gohggggX
75 gohggX
75 gohhX
''')
# A real second primary projects from the folded golden wing. Its short
# dark underside is distinct from the outer wing edge.
rows('skill_b', 32, 25, '''
58 hhoooooggggggggggggoX
58 hoooooggggggggggggoX
58 oooooggggggggggggoX
58 ooooggggggggggggoX
58 oooggggggggggggoX..XhkX
58 ooggggggggggggoX.XhhkkX
58 oggggggggggggoXXohhhkkkX
58 ggggggggggggohhhhhhkkwwk
58 gggggggggggohhhhhhhkkwwk
58 ggggggggggohhhhhhhhkkwwk
58 gggggggggohhhhhhhhhhkkkX
58 ggggggggohhhhoooohhhhkkX
58 gggggggohhhhoooooohhhkX
58 ggggggohhhhooooooohhhX
58 gggggohhhhoooooooohhX
58 ggohhhhhhoooooooohhX
58 gohhhhhhhooooooohhX
''')
# Middle blade from that primary's tip at (80,40), with a wider, split vane.
rows('skill_b', 27, 42, '''
82 ......................................kX
82 ..................................khkkX
82 ..............................khhkkwkX
82 ..........................khhkkkwwkhX
82 .......................khhhkkkwwwkhX
82 ...................khhkkhhkwwwwkhX
82 ...............khhkkhhkkwwwwkkhhX
82 ...........khhkkhhkkwwwwkkhhhX
82 .......khhkkhhkkwwwwkkhhhhX
82 ....khhkkhhkkwwwwkkhhhhhX
82 .khhkkhhkkwwwwkkhhhhhoX
82 khhkkhhkkwwwwkkhhhhhoX
82 kwwwwwwwwwwkkhhhhhoX
82 kwwwwwwkkhhhhhhhoX
82 hkkwkkhhhhhgggX
82 ohkkhhhhgggX
82 gohhhhggX
82 gohhggX
82 XgggX
82 .XX
''')
# Third blade: shorter, stronger downward vane from the near wing tip.
rows('skill_b', 58, 17, '''
107 ..............kX
107 ............khkX
107 ..........khkwkX
107 ........khkkwwkX
107 ......khhkkwwkhX
107 ....khhkkwwkhhX
107 ..khhkkwwwkhhX
107 khhkkwwwkkhhX
107 hhkkwwwkkhhhX
107 hkkwwwkkhhhoX
107 kkwwwkkhhhoX
107 kwwwkkhhhhX
107 wwwkkhhhhX
107 wwkkhhhoX
107 wkkhhhoX
107 kkhhgoX
107 hhhgoX
107 hhgoX
107 hgoX
107 goX
107 X
''')
ink('skill_b', 68, '''
98 hkkkhhkkkh
98 hkkhhhhkkw
98 hkkhhhhkww
98 hkkhhhkkww
98 hkkhhkkwww
98 hkkhkkwwwk
98 hkkkwwwwkk
98 ohkkwwwkkh
98 gohhkkkhhh
98 XgohhhhggX
98 .XgohhggX
98 ..XgggX
98 ...XXX
''')

# Sleep beak revision after the first PNG: replace the overly large interior
# notch with solid silver/shadow material and a short hooked lower tip.
rows('sleep_a', 74, 17, '''
83 hohhhjjwjX
83 hohhjjwwwwjiX
83 hojjwwwwwwwjiX
83 hojwwwwwjjwwjitX
83 jjwwwjjttjjwwiitX
83 jwwwjjttXXjiitX
83 wwwwjjiivtjiitX
83 wwjjjiivttXtjtX
83 jjiiivvttX.XtX
83 jiivvttX....X
83 jivttX
83 ivttX
''')
rows('sleep_b', 75, 17, '''
83 hohhhhjjwjX
83 hohhhjjwwwjiX
83 hojjjwwwwwwjiX
83 hojwwwwjjjwwjitX
83 jjwwjjjttjjwwiitX
83 jwwwjjttXXjiitX
83 wwwjjjiivtjiitX
83 wjjjiiivttXtjtX
83 jjiiivvttX.XtX
83 jiivvttX....X
83 jivttX
83 ivttX
''')

# Charge uses the same three real feather tips as the idle, with white cores
# embedded in the first and second tips and the near fan's last primary.
rows('skill_a', 6, 60, '''
5 ...................kkk
5 ..................khwwk
5 .................khwwwk
5 .................kwwwwkX
5 .................khwwwkkX
5 ................XhhwwkkX
5 ................XhhkkkX
5 ...............XohhhkkkX
5 ...............XohhhhkkX
5 ...............XgohhhhkkX
5 ..............XgohhhhhkkkX
5 ..............XgohhhhhhkkkX
5 .............XbgohhhhhhhkkkX
5 ..........kk.XbgohhhhhhhhkkkX
5 ........khwwkXbgohhhhhhhhhkkkX
5 .......khwwwkXbgohhhhhhhhhhkkkX
5 ......XhhwwkkXXbgohhhhhhhhhhhkkkX
5 ......XohhkkkXbgohhhhhhhhhhhhkkkX
5 .....XgohhhkkkXbgohhhhhhhhhhhhkkkX
5 .....XgohhhhkkkXbgohhhhhhhhhhhhkkkX
5 .....XbgohhhhkkkXbgohhhhhhhhhhhhkkkX
5 ......XbgohhhhkkkXbgohhhhhhhhhhhhkkkX
5 ......XbgohhhhhkkkXbgohhhhhhhhhhhhkkkX
5 .......XbgohhhhhkkkXbgohhhhhhhhhhhhkkkX
5 ........XbgohhhhhkkkXbgohhhhhhhhhhhhkkkX
5 ....XXX.XbgohhhhhhkkkXbgohhhhhhhhhhhhkkkX
5 ...XhkkXXbgohhhhhhhkkkXbgohhhhhhhhhhhhkkkX
5 ..XhhkkkXbgohhhhhhhhkkkXbgohhhhhhhhhhhhkkkX
5 ..XohhkkkXbgohhhhhhhhkkkXbgohhhhoohhhhhhkkkX
5 ..XgohhkkkXbgohhhhhhhhkkkXbgohhhooohhhhhhkkkX
5 ...XgohhkkkXbgohhhhohhhkkkXbgohhoooohhhhhhkkkX
5 ...XbgohhkkkXbgohhhooohhhkkkXbgohhoooohhhhhhkkX
5 ....XbgohhkkkXbgohhooooohhhkkkXbgohhooooohhhhhhX
5 .....XbgohhkkkXbgohhooooohhhkkkXbgohhooooohhhhhX
5 ......XbgohhkkkXbgohhooooohhhkkkXbgohhooooohhhhkX
5 .......XbgohhkkkXbgohhoooooohhhkkkXbgohhoooohhhhkX
5 ........XbgohhkkkXbgohhoooooohhhkkkXbgohhoooohhhhkX
5 .........XbgohhkkkXbgohhoooooohhhkkkXbgohhooohhhhhX
5 ..........XbgohhkkkXbgohhoooooohhhkkkXbgohhoohhhhhX
5 ...........XbgohhhkkkXbgohhoooooohhhkkkXbgohhhhhhhX
5 ............XbgohhhkkkXbgohhoooooohhhkkkXbgohhhhhhkX
5 .............XbgohhhkkkXbgohhoooooohhhkkkXbgohhhhkkX
5 ..............XbgohhhkkkXbgohhoooooohhhkkkXbgohhkkkX
5 ...............XbgohhhkkkXbgohhooooohhhhkkkXbgohhkkX
5 ................XbgohhhkkkXbgohhoooohhhhkkkXbgohhkX
5 .................XbgohhhkkkXbgohhoohhhhhkkkXbgohhhX
5 ..................XsbgohhhkkXbgohhhhhhhhkkXbgohhhX
5 ...................XsbgohhhhkkbgohhhhhhhhhbgohhhhX
5 .....................XsbgohhhhkgohhhhhhhhhgohhhhX
5 .......................XsbgohhhhohhhhhhhhhohhhhhhX
5 .........................XsbgohhohhhhhhhhhhhhhhhhX
5 ...........................XsbgohhhhhhhhhhhhhhhhhX
5 .............................XsbgohhhhhhhhhhhhhhhhX
5 ...............................XsbgohhhhhhhhhhhhhhX
5 .................................XsbgohhhhhhhhhhhhhX
5 ...................................XsbgohhhhhhhhhhX
5 .....................................XsbgohhhhhhhhX
5 .......................................XsbgohhhhhhX
''')
rows('skill_a', 44, 18, '''
50 hhhhhhhX
50 hhhhhhhhX
50 hhhhhhhhkX
50 hhhhhhhhkkX
50 hhhhhhhhkkhkX..Xjj
50 hhhhhhhhkkhhkXhjww
50 hhhhhhhhkkhhhhhXjw
50 hhhhhhhhkkhhhhhXww
50 hhhhhhhhhhhhhhhXww
50 hhhhhhhhhhhhhhhXww
50 ggoohhhhhhhhhhhXww
50 bggoohhhhhhhhhhXjj
50 sbggoohhhhhhhhhXii
50 XsbggoohhhhhhhhXvv
50 .Xsbggoohhhjjjjiiv
''')
rows('skill_a', 59, 58, '''
12 ..............................................Xgohhhhkkhji
12 ............................................Xgohhhhhkkhji
12 ..........................................Xgohhhhhhkkkhji
12 ........................................Xgohhhhhhhkkkhhji
12 ......................................Xgohhhhhhhhkkkhhhji
12 ....................................Xgohhhhhhhhhkkkhhhhji
12 ..................................XgohhhhhhhhhhkkkhhhhhX
12 ................................XgohhhhhhhhhhhkkkhhhhgoX
12 ..............................XgohhhhhhhhhhhhkkkhhhhgoX
12 ............................XgohhhhhhhhhhhhhkkkhhhhgoX
12 ..........................XgohhhhhhhhhhhhhhkkkhhhhgoX
12 ........................XgohhhhhhhhhhhhhhhkkkhhhhgoX
12 ......................XgohhhhhhhhhhhhhhhhkkkhhhhgoX
12 ....................XgohhhhhhhhhhhhhhhhhkkkhhhhgoX
12 ..................XgohhhhhhhhhhhhhhhhhhkkkhhhhgoX
12 ................XgohhhhhhhhhhhhhhhhhhhkkkhhhhgoX
12 ..............XgohhhhhhhhhhhhhhhhhhhhkkkhhhhgoX
12 .............XgohhhhhhhhhhhhhhhhhhhhkkkhhhhgoX
12 ............XgohhhhhhhhhhhhhhhhhhhhkkkhhhhgoX
12 ...........XgohhhhhhhhhhhhhhhhhhhhhkkkhhhhgoX
12 ..........XgohhhhhkkkkhhhhhhhhhhhkkkhhhhgoX
12 .........XgohhhhkkkkhhhhhhhhhhhkkkhhhhgoX
12 ........XgohhhhkkkkhhhhhhhhhkkkhhhhgoX
12 ........XgohhhkkkhhhhhohhhhhkkkhhhgoX
12 ........XgohhkkkhhhhhoohhhhhkkhhhgoX
12 ........XgohhkkhhhhhooohhhhhkhhhgoX
12 .........XohkkhhhhooohhhhhhhkhhgoX
12 .........XohkhhhhooohhhhhhhhkhgoX
12 ..........XohhhhooohhhhhhhhhkhgoX
12 ..........XgohhoXbgohhhhhhhhhgoX
12 ...........XohhoXbgohhhhhhhhgoX
12 ............XhhXbgohhhXbgohhgoX
12 .............XXbgohhhXbgohhgoX
12 ...............XgohhkXgohhhgoX
12 ................XhhkX.XohhkX
12 .................XXX..khwwkX
12 ......................khwwkX
12 .......................kkkX
''')
ink('skill_a', 72, '''
58 Xbgohhhhhhhhhhoo
57 Xbgohhhhhhhhhhhoo
56 Xbgohhhhhhhhhhhhoo
55 Xbgohhhhhhhhhhhhhoo
54 Xbgohhhhhhhhhhhhhooo
54 bgohhhhhhhhhhhhhhooo
54 bgohhhhhhhhhhhhhhooo
54 bgohhhhhhhhhhhhhhooo
54 bgohhhhhhhhhhhhhhooo
54 bgohhhhhhhhhhhhhhooo
54 bgohhhhhhhhhhhhhhooo
54 bgohhhhhhhhhhhhhhooo
54 bgohhhhhhhhhhhhhhooo
54 bgohhhhhhhhohhhhhooo
54 bgohhhhhhhooohhhhooo
54 bgohhhhhhooooohhhhooo
54 bgohhhhhhooooohhhhooo
54 bgohhhhhoooooohhhhooo
54 bgohhhhhoooooohhhhooo
54 bgohhhhooogooohhhhooo
54 bgohhhhooogooohhhhooo
54 bgohhhhooogooohhhhooo
54 bgohhhhooogooohhhhooo
54 Xbgohhhhooogooohhhoo
''')

rows('skill_c', 9, 60, '''
5 .
5 .
5 .
5 .
5 .
5 .....................XXX
5 ....................XhkkX
5 ...................XhhkkX
5 ...................XhhkkkX
5 ..................XohhhkkkX
5 ..................XohhhhkkX
5 ..................XgohhhhkkX
5 .................XgohhhhhkkkX
5 .................XgohhhhhhkkkX
5 ...........XXX..XbgohhhhhhhkkkX
5 ..........XhkkX.XbgohhhhhhhhkkkX
5 .........XhhkkkXXbgohhhhhhhhhkkkX
5 .........XohhkkkXbgohhhhhhhhhhkkkX
5 ........XgohhhkkkXbgohhhhhhhhhhkkkX
5 ........XgohhhhkkkXbgohhhhhhhhhhkkkX
5 ........XbgohhhhkkkXbgohhhhhhhhhhkkkX
5 .........XbgohhhhkkkXbgohhhhhhhhhhkkkX
5 ....XXX..XbgohhhhhkkkXbgohhhhhhhhhhkkkX
5 ...XhkkX..XbgohhhhhkkkXbgohhhhhhhhhhkkkX
5 ..XhhkkkX..XbgohhhhhkkkXbgohhhhhhhhhhkkkX
5 ..XohhkkkX.XbgohhhhhhkkkXbgohhhhohhhhhkkkX
5 ..XgohhkkkXXbgohhhhhhhkkkXbgohhhoohhhhhkkkX
5 ...XgohhkkkXbgohhhhhhhhkkkXbgohhooohhhhhkkkX
5 ...XbgohhkkkXbgohhhhohhhkkkXbgohhoooohhhhhkkX
5 ....XbgohhkkkXbgohhhooohhhkkkXbgohhoooohhhhhX
5 .....XbgohhkkkXbgohhooooohhhkkkXbgohhoooohhhhX
5 ......XbgohhkkkXbgohhooooohhhkkkXbgohhoooohhhkX
5 .......XbgohhkkkXbgohhooooohhhkkkXbgohhoooohhhkX
5 ........XbgohhkkkXbgohhoooooohhhkkkXbgohhooohhhkX
5 .........XbgohhkkkXbgohhoooooohhhkkkXbgohhoohhhhX
5 ..........XbgohhkkkXbgohhoooooohhhkkkXbgohhhhhhhX
5 ...........XbgohhhkkkXbgohhoooooohhhkkkXbgohhhhhX
5 ............XbgohhhkkkXbgohhoooooohhhkkkXbgohhhhhX
5 .............XbgohhhkkkXbgohhoooooohhhkkkXbgohhhhX
5 ..............XbgohhhkkkXbgohhoooooohhhkkkXbgohhhhX
5 ...............XbgohhhkkkXbgohhooooohhhhkkkXbgohhhX
5 ................XbgohhhkkkXbgohhoooohhhhkkkXbgohhhX
5 .................XbgohhhkkkXbgohhoohhhhhkkkXbgohhhX
5 ..................XsbgohhhkkXbgohhhhhhhhkkXbgohhhX
5 ...................XsbgohhhhkkbgohhhhhhhhhbgohhhhX
5 .....................XsbgohhhhkgohhhhhhhhhgohhhhX
5 .......................XsbgohhhhohhhhhhhhhohhhhhhX
5 .........................XsbgohhohhhhhhhhhhhhhhhhX
5 ...........................XsbgohhhhhhhhhhhhhhhhhX
5 .............................XsbgohhhhhhhhhhhhhhhhX
5 ...............................XsbgohhhhhhhhhhhhhhX
5 .................................XsbgohhhhhhhhhhhhhX
5 ...................................XsbgohhhhhhhhhhX
5 .....................................XsbgohhhhhhhhX
5 .......................................XsbgohhhhhhX
''')
rows('skill_c', 44, 18, '''
50 hhhhhhhX
50 hhhhhhhhX
50 hhhhhhhhkX
50 hhhhhhhhkkX
50 hhhhhhhhkkhkX..Xjj
50 hhhhhhhhkkhhkXhjww
50 hhhhhhhhkkhhhhhXjw
50 hhhhhhhhkkhhhhhXww
50 hhhhhhhhhhhhhhhXww
50 hhhhhhhhhhhhhhhXww
50 ggoohhhhhhhhhhhXww
50 bggoohhhhhhhhhhXjj
50 sbggoohhhhhhhhhXii
50 XsbggoohhhhhhhhXvv
50 .Xsbggoohhhjjjjiiv
''')
rows('skill_c', 59, 58, '''
12 ..............................................Xgohhhhkkhji
12 ............................................Xgohhhhhkkhji
12 ..........................................Xgohhhhhhkkkhji
12 ........................................Xgohhhhhhhkkkhhji
12 ......................................Xgohhhhhhhhkkkhhhji
12 ....................................Xgohhhhhhhhhkkkhhhhji
12 ..................................XgohhhhhhhhhhkkkhhhhhX
12 ................................XgohhhhhhhhhhhkkkhhhhgoX
12 ..............................XgohhhhhhhhhhhhkkkhhhhgoX
12 ............................XgohhhhhhhhhhhhhkkkhhhhgoX
12 ..........................XgohhhhhhhhhhhhhhkkkhhhhgoX
12 ........................XgohhhhhhhhhhhhhhhkkkhhhhgoX
12 ......................XgohhhhhhhhhhhhhhhhkkkhhhhgoX
12 ....................XgohhhhhhhhhhhhhhhhhkkkhhhhgoX
12 ..................XgohhhhhhhhhhhhhhhhhhkkkhhhhgoX
12 ................XgohhhhhhhhhhhhhhhhhhhkkkhhhhgoX
12 ..............XgohhhhhhhhhhhhhhhhhhhhkkkhhhhgoX
12 .............XgohhhhhhhhhhhhhhhhhhhhkkkhhhhgoX
12 ............XgohhhhhhhhhhhhhhhhhhhhkkkhhhhgoX
12 ...........XgohhhhhhhhhhhhhhhhhhhhhkkkhhhhgoX
12 ..........XgohhhhhkkkkhhhhhhhhhhhkkkhhhhgoX
12 .........XgohhhhkkkkhhhhhhhhhhhkkkhhhhgoX
12 ........XgohhhhkkkkhhhhhhhhhkkkhhhhgoX
12 ........XgohhhkkkhhhhhohhhhhkkkhhhgoX
12 ........XgohhkkkhhhhhoohhhhhkkhhhgoX
12 ........XgohhkkhhhhhooohhhhhkhhhgoX
12 .........XohkkhhhhooohhhhhhhkhhgoX
12 .........XohkhhhhooohhhhhhhhkhgoX
12 ..........XohhhhooohhhhhhhhhkhgoX
12 ..........XgohhoXbgohhhhhhhhhgoX
12 ...........XohhoXbgohhhhhhhhgoX
12 ............XhhXbgohhhXbgohhgoX
12 .............XXbgohhhXbgohhgoX
12 ...............XgohhkXgohhhgoX
12 ................XhhkX.XohhkX
12 .................XXX...XkkX
12 ........................XX
''')
ink('skill_c', 72, '''
58 Xbgohhhhhhhhhhoo
57 Xbgohhhhhhhhhhhoo
56 Xbgohhhhhhhhhhhhoo
55 Xbgohhhhhhhhhhhhhoo
54 Xbgohhhhhhhhhhhhhooo
54 bgohhhhhhhhhhhhhhooo
54 bgohhhhhhhhhhhhhhooo
54 bgohhhhhhhhhhhhhhooo
54 bgohhhhhhhhhhhhhhooo
54 bgohhhhhhhhhhhhhhooo
54 bgohhhhhhhhhhhhhhooo
54 bgohhhhhhhhhhhhhhooo
54 bgohhhhhhhhhhhhhhooo
54 bgohhhhhhhhohhhhhooo
54 bgohhhhhhhooohhhhooo
54 bgohhhhhhooooohhhhooo
54 bgohhhhhhooooohhhhooo
54 bgohhhhhoooooohhhhooo
54 bgohhhhhoooooohhhhooo
54 bgohhhhooogooohhhhooo
54 bgohhhhooogooohhhhooo
54 bgohhhhooogooohhhhooo
54 bgohhhhooogooohhhhooo
54 Xbgohhhhooogooohhhoo
''')

rows('recover', 96, 55, '''
5 ...XXX
5 ..XhhkkXXX
5 .XohhhhkkkXXX
5 XgohhhhhhkkkkXXX
5 XgohhhhhhhhhkkkkXXX......kkkXXsbggoohhhhhhhhhhgggggggg
5 .XgohhhhhhhhhhkkkkXXX....hkkkXXsbggoohhhhhhhhhgggggggg
5 ..XgohhhhhhhhhhkkkXgohhhhkkkXXsbgohhhhhhhhhhggggggggg
5 ...XgohhhhhhhhhhkkXgohhhhhhkkkkXXXsbgohhhhhggggggggggg
5 ....XgohhhhhhhhhhkXbgohhhhhhhhkkkkXXXbgohhhhhhgggggggg
5 .....XgohhhhhhhhhhkXbgohhhhhhhhhhkkkXXXgohhhhhhhhggggg
5 ......XgohhhhhohhhhkXbgohhhhhhhhhhhkkkXXXgohhhhhhhhgggg
5 .......XgohhhhoohhhhkXbgohhhhhohhhhhhkkXgohhhhhhhhooggg
5 ........XgohhhoooohhhkXbgohhhooohhhhhhkXgohhhhhoooogggX
5 .........XgohhhoooohhhkXbgohhooooohhhhkXgohhhooooogggX
5 ..........XgohhhoooohhkXbgohhooooohhhhkXgohhooooogggX
5 ...........XgohhhoooohkXbgohhoooooohhhkXgohhoooogggX
5 ............XgohhhoooohXbgohhooooooohhkXgohhoooggX
5 .............XgohhhoooX.XbgohhoooooohhXgohhooggX
5 ..............XgohhoX...XbgohhooooohhXgohhoggX
5 ...............XohhX.....XbgohhooohhX.XohhogX
5 ................XhkX......XbgohhohhX..XhhkX
5 .................XX........XgohhhhX....XXX
5 ............................XohhkX
5 .............................XkkX
5 ..............................XX
5 .
5 .
5 .
''')
ink('recover', 124, '''
52 .....
''')
rows('skill_a', 96, 55, '''
5 ...XXX
5 ..XhhkkXXX
5 .XohhhhkkkXXX
5 XgohhhhhhkkkkXXX
5 XgohhhhhhhhhkkkkXXX......kkkXXsbggoohhhhhhhhhhgggggggg
5 .XgohhhhhhhhhhkkkkXXX....hkkkXXsbggoohhhhhhhhhgggggggg
5 ..XgohhhhhhhhhhkkkXgohhhhkkkXXsbgohhhhhhhhhhggggggggg
5 ...XgohhhhhhhhhhkkXgohhhhhhkkkkXXXsbgohhhhhggggggggggg
5 ....XgohhhhhhhhhhkXbgohhhhhhhhkkkkXXXbgohhhhhhgggggggg
5 .....XgohhhhhhhhhhkXbgohhhhhhhhhhkkkXXXgohhhhhhhhggggg
5 ......XgohhhhhohhhhkXbgohhhhhhhhhhhkkkXXXgohhhhhhhhgggg
5 .......XgohhhhoohhhhkXbgohhhhhohhhhhhkkXgohhhhhhhhooggg
5 ........XgohhhoooohhhkXbgohhhooohhhhhhkXgohhhhhoooogggX
5 .........XgohhhoooohhhkXbgohhooooohhhhkXgohhhooooogggX
5 ..........XgohhhoooohhkXbgohhooooohhhhkXgohhooooogggX
5 ...........XgohhhoooohkXbgohhoooooohhhkXgohhoooogggX
5 ............XgohhhoooohXbgohhooooooohhkXgohhoooggX
5 .............XgohhhoooX.XbgohhoooooohhXgohhooggX
5 ..............XgohhoX...XbgohhooooohhXgohhoggX
5 ...............XohhX.....XbgohhooohhX.XohhogX
5 ................XhkX......XbgohhohhX..XhhkX
5 .................XX........XgohhhhX....XXX
5 ............................XohhkX
5 .............................XkkX
5 ..............................XX
5 .
5 .
5 .
''')
ink('skill_a', 124, '''
52 .....
''')
rows('skill_c', 96, 55, '''
5 ...XXX
5 ..XhhkkXXX
5 .XohhhhkkkXXX
5 XgohhhhhhkkkkXXX
5 XgohhhhhhhhhkkkkXXX......kkkXXsbggoohhhhhhhhhhgggggggg
5 .XgohhhhhhhhhhkkkkXXX....hkkkXXsbggoohhhhhhhhhgggggggg
5 ..XgohhhhhhhhhhkkkXgohhhhkkkXXsbgohhhhhhhhhhggggggggg
5 ...XgohhhhhhhhhhkkXgohhhhhhkkkkXXXsbgohhhhhggggggggggg
5 ....XgohhhhhhhhhhkXbgohhhhhhhhkkkkXXXbgohhhhhhgggggggg
5 .....XgohhhhhhhhhhkXbgohhhhhhhhhhkkkXXXgohhhhhhhhggggg
5 ......XgohhhhhohhhhkXbgohhhhhhhhhhhkkkXXXgohhhhhhhhgggg
5 .......XgohhhhoohhhhkXbgohhhhhohhhhhhkkXgohhhhhhhhooggg
5 ........XgohhhoooohhhkXbgohhhooohhhhhhkXgohhhhhoooogggX
5 .........XgohhhoooohhhkXbgohhooooohhhhkXgohhhooooogggX
5 ..........XgohhhoooohhkXbgohhooooohhhhkXgohhooooogggX
5 ...........XgohhhoooohkXbgohhoooooohhhkXgohhoooogggX
5 ............XgohhhoooohXbgohhooooooohhkXgohhoooggX
5 .............XgohhhoooX.XbgohhoooooohhXgohhooggX
5 ..............XgohhoX...XbgohhooooohhXgohhoggX
5 ...............XohhX.....XbgohhooohhX.XohhogX
5 ................XhkX......XbgohhohhX..XhhkX
5 .................XX........XgohhhhX....XXX
5 ............................XohhkX
5 .............................XkkX
5 ..............................XX
5 .
5 .
5 .
''')
ink('skill_c', 124, '''
52 .....
''')

# Broken upper/lower remnants follow the newly broadened blade directions.
rows('skill_c', 5, 23, '''
102 ....................kX
102 ..................khkX
102 ................khkwX
102 ..............khkwwX
102 ............khkwwhX
102 ..........khkwwhX
102 .......khkwwhX
102 .....khkwwhX
102 ...khkwwhX
102 .khkwwhX
102 khkwwX
102 .kkX
102 ..X
102 .
102 .
''')
# Clear old top remnant outside the new contour, using exact replacement rows.
rows('skill_c', 20, 23, '''
102 .
102 .
102 .
102 .
102 .
102 .
102 .
102 .
102 .
102 .
102 .
102 .
''')
rows('skill_c', 56, 21, '''
104 .
104 .
104 .
104 .
104 .................khX
104 ...............khwkX
104 .............khwwkX
104 ...........khwwhkX
104 .........khwwhkX
104 .......khwwhkX
104 .....khwwhkX
104 ...khwwhkX
104 .khwwhkX
104 khwwhkX
104 khwwkX
104 .kkX
104 .
104 .
104 .
104 .
104 .
104 .
''')
# Missing branches interrupt the afterimages instead of keeping solid rays.
ink('skill_c', 10, '''
117 ..
117 ..
''')
ink('skill_c', 14, '''
105 ..
''')
ink('skill_c', 65, '''
115 ..
115 ..
''')

# The same plate-like upper contour was visible in hit and poison. These are
# three shorter drooping primaries at each pose's actual shoulder position.
rows('hit', 25, 55, '''
5 ..............................XXX
5 .............................XhkkX
5 .............................XhhkkX
5 ............................XohhhkkX
5 ............................XgohhhkkX
5 ...........................XbgohhhhkkX
5 ......................XXX..XbgohhhhhkkX
5 .....................XhkkX.XbgohhhhhhkkX
5 ....................XhhkkXXbgohhhhhhhkkX
5 ....................XohhkkXbgohhhhhhhhkkX
5 ...................XgohhhkkXbgohhhhhhhhkkX
5 ...................XbgohhhkkXbgohhhhhhhhkkX
5 ..............XXX..XbgohhhhkkXbgohhhhhhhhkkX
5 .............XhkkX..XbgohhhhkkXbgohhhhohhhhkkX
5 ............XhhkkkX..XbgohhhhkkXbgohhhhoohhhkkX
5 ............XohhkkkX.XbgohhhhhkkXbgohhhhooohhkkX
5 ............XgohhkkkXXbgohhhhhkkXbgohhhoooohhkkX
5 .............XgohhkkkXbgohhhhhhkkXbgohhhoooohhkkX
5 ..............XbgohhkkXbgohhhhhhkkXbgohhhooohhhkkX
5 ...............XbgohhkkXbgohhhhhhkkXbgohhooohhhkkX
5 ................XbgohhkkXbgohhhhhhkkXbgohhoohhhkkX
5 .................XbgohhkkXbgohhhhhhkkXbgohhhhhhhkkX
5 ..................XbgohhkkXbgohhhhhhkkXbgohhhhhhhX
5 ...................XsbgohhkkXbgohhhhhkkXbgohhhhhX
5 ....................XsbgohhkkXbgohhhhhkkXbgohhhhhX
5 .....................XsbgohhkkbgohhhhhhhbgohhhhhX
5 ......................XsbgohhhhkgohhhhhhhgohhhhhX
5 ........................XsbgohhhhohhhhhhhhhhhhhhX
5 ..........................XsbgohhhhhhhhhhhhhhhhhX
5 ............................XsbgohhhhhhhhhhhhhhhX
5 ..............................XsbgohhhhhhhhhhhhhX
''')
rows('poison_a', 25, 55, '''
5 ..............................XXX
5 .............................XhkkX
5 .............................XhhkkX
5 ............................XohhhkkX
5 ............................XgohhhkkX
5 ...........................XbgohhhhkkX
5 ......................XXX..XbgohhhhhkkX
5 .....................XhkkX.XbgohhhhhhkkX
5 ....................XhhkkXXbgohhhhhhhkkX
5 ....................XohhkkXbgohhhhhhhhkkX
5 ...................XgohhhkkXbgohhhhhhhhkkX
5 ...................XbgohhhkkXbgohhhhhhhhkkX
5 ..............XXX..XbgohhhhkkXbgohhhhhhhhkkX
5 .............XhkkX..XbgohhhhkkXbgohhhhohhhhkkX
5 ............XhhkkkX..XbgohhhhkkXbgohhhhoohhhkkX
5 ............XohhkkkX.XbgohhhhhkkXbgohhhhooohhkkX
5 ............XgohhkkkXXbgohhhhhkkXbgohhhoooohhkkX
5 .............XgohhkkkXbgohhhhhhkkXbgohhhoooohhkkX
5 ..............XbgohhkkXbgohhhhhhkkXbgohhhooohhhkkX
5 ...............XbgohhkkXbgohhhhhhkkXbgohhooohhhkkX
5 ................XbgohhkkXbgohhhhhhkkXbgohhoohhhkkX
5 .................XbgohhkkXbgohhhhhhkkXbgohhhhhhhkkX
5 ..................XbgohhkkXbgohhhhhhkkXbgohhhhhhhX
5 ...................XsbgohhkkXbgohhhhhkkXbgohhhhhX
5 ....................XsbgohhkkXbgohhhhhkkXbgohhhhhX
5 .....................XsbgohhkkbgohhhhhhhbgohhhhhX
5 ......................XsbgohhhhkgohhhhhhhgohhhhhX
5 ........................XsbgohhhhohhhhhhhhhhhhhhX
5 ..........................XsbgohhhhhhhhhhhhhhhhhX
5 ............................XsbgohhhhhhhhhhhhhhhX
5 ..............................XsbgohhhhhhhhhhhhhX
''')
rows('poison_b', 25, 55, '''
5 ..............................XXX
5 .............................XhkkX
5 .............................XhhkkX
5 ............................XohhhkkX
5 ............................XgohhhkkX
5 ...........................XbgohhhhkkX
5 ......................XXX..XbgohhhhhkkX
5 .....................XhkkX.XbgohhhhhhkkX
5 ....................XhhkkXXbgohhhhhhhkkX
5 ....................XohhkkXbgohhhhhhhhkkX
5 ...................XgohhhkkXbgohhhhhhhhkkX
5 ...................XbgohhhkkXbgohhhhhhhhkkX
5 ..............XXX..XbgohhhhkkXbgohhhhhhhhkkX
5 .............XhkkX..XbgohhhhkkXbgohhhhohhhhkkX
5 ............XhhkkkX..XbgohhhhkkXbgohhhhoohhhkkX
5 ............XohhkkkX.XbgohhhhhkkXbgohhhhooohhkkX
5 ............XgohhkkkXXbgohhhhhkkXbgohhhoooohhkkX
5 .............XgohhkkkXbgohhhhhhkkXbgohhhoooohhkkX
5 ..............XbgohhkkXbgohhhhhhkkXbgohhhooohhhkkX
5 ...............XbgohhkkXbgohhhhhhkkXbgohhooohhhkkX
5 ................XbgohhkkXbgohhhhhhkkXbgohhoohhhkkX
5 .................XbgohhkkXbgohhhhhhkkXbgohhhhhhhkkX
5 ..................XbgohhkkXbgohhhhhhkkXbgohhhhhhhX
5 ...................XsbgohhkkXbgohhhhhkkXbgohhhhhX
5 ....................XsbgohhkkXbgohhhhhkkXbgohhhhhX
5 .....................XsbgohhkkbgohhhhhhhbgohhhhhX
5 ......................XsbgohhhhkgohhhhhhhgohhhhhX
5 ........................XsbgohhhhohhhhhhhhhhhhhhX
5 ..........................XsbgohhhhhhhhhhhhhhhhhX
5 ............................XsbgohhhhhhhhhhhhhhhX
5 ..............................XsbgohhhhhhhhhhhhhX
''')
rows('move', 39, 26, '''
5 XXX..XbgohhhhhhhhhXbgohhhh
5 XhkX..XbgohhhhhhhhhXbgohhh
5 XhhkkX.XbgohhhhhhoooXbgohh
5 XohhkkX.XbgohhhhooooXbgohh
5 XgohhkkX.XbgohhoooooXbgohh
5 .XgohhkkX.XbgohhoooooXbgoh
5 ..XgohhkkX.XbgohhoooooXbgo
5 ...XgohhkkX.XbgohhoooooXbg
5 ....XgohhkkX.XbgohhooooXbg
5 .....XgohhkkX.XbgohhooohXb
5 ......XgohhkkX.XbgohhoohXb
5 .......XgohhkkX.XbgohhhhhX
5 ........XgohhkkX.XbgohhhhX
5 .........XgohhkkX.XbgohhhX
5 ..........XgohhkkX.XbgohhX
5 ...........XgohhkkX.XbgohX
5 ............XgohhkkX.XbgoX
5 .............XgohhkkX.XbgX
5 ..............XgohhkkX.XbX
5 ...............XgohhkkX.XX
5 ................XgohhkkX.X
5 .................XsbgohkXX
''')
rows('attack', 39, 26, '''
5 XXX..XbgohhhhhhhhhXbgohhhh
5 XhkX..XbgohhhhhhhhhXbgohhh
5 XhhkkX.XbgohhhhhhoooXbgohh
5 XohhkkX.XbgohhhhooooXbgohh
5 XgohhkkX.XbgohhoooooXbgohh
5 .XgohhkkX.XbgohhoooooXbgoh
5 ..XgohhkkX.XbgohhoooooXbgo
5 ...XgohhkkX.XbgohhoooooXbg
5 ....XgohhkkX.XbgohhooooXbg
5 .....XgohhkkX.XbgohhooohXb
5 ......XgohhkkX.XbgohhoohXb
5 .......XgohhkkX.XbgohhhhhX
5 ........XgohhkkX.XbgohhhhX
5 .........XgohhkkX.XbgohhhX
5 ..........XgohhkkX.XbgohhX
5 ...........XgohhkkX.XbgohX
5 ............XgohhkkX.XbgoX
5 .............XgohhkkX.XbgX
5 ..............XgohhkkX.XbX
5 ...............XgohhkkX.XX
5 ................XgohhkkX.X
5 .................XsbgohkXX
''')

# After comparing dark/light/checker, round the drooped primaries back into
# their actual gold shoulder, removing the squared gap left by the old plate.
ink('hit', 46, '''
54 kkX...
53 hhkkX...
53 hhhkkX..
53 hhhkkhkX
53 hhhhkkhhh
53 hhhhhhhhhh
53 gohhhhhhhhh
53 bgohhhhhhhh
53 sbgohhhhhhh
53 Xsbgohhhhhhh
''')
ink('poison_a', 46, '''
54 kkX...
53 hhkkX...
53 hhhkkX..
53 hhhkkhkX
53 hhhhkkhhh
53 hhhhhhhhhh
53 gohhhhhhhhh
53 bgohhhhhhhh
53 sbgohhhhhhh
53 Xsbgohhhhhhh
''')
ink('poison_b', 46, '''
54 kkX...
53 hhkkX...
53 hhhkkX..
53 hhhkkhkX
53 hhhhkkhhh
53 hhhhhhhhhh
53 gohhhhhhhhh
53 bgohhhhhhhh
53 sbgohhhhhhh
53 Xsbgohhhhhhh
''')

# End the throat silver at the neck root. Feather shafts below are gold.
ink('hit', 65, '''
55 hhkkhhhhgo
54 hhkkhhhhgoo
53 hhhkkhhgooh
52 hhkkhhgooh
51 hhkkhgooh
50 hhkkhooh
49 hhkkhoh
48 hhkkhh
47 kkhh
46 kkh
45 kkh
44 kkh
43 kkh
42 kkh
41 kkh
40 kkh
40 kh
39 h
''')
ink('poison_a', 65, '''
55 hhkkhhhhgo
54 hhkkhhhhgoo
53 hhhkkhhgooh
52 hhkkhhgooh
51 hhkkhgooh
50 hhkkhooh
49 hhkkhoh
48 hhkkhh
47 kkhh
46 kkh
''')
ink('poison_b', 65, '''
55 hhkkhhhhgo
54 hhkkhhhhgoo
53 hhhkkhhgooh
52 hhkkhhgooh
51 hhkkhgooh
50 hhkkhooh
49 hhkkhoh
48 hhkkhh
47 kkhh
46 kkh
''')

def save():
    for name, grid in frames.items():
        kind = 'actions' if name.startswith(('skill', 'poison', 'stun', 'sleep')) else 'poses'
        (R/kind/(name+'.pxgrid')).write_text('\n'.join(''.join(r) for r in grid)+'\n')

if __name__ == '__main__':
    save()
