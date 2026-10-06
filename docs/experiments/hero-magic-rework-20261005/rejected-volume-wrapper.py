"""Explicitly chosen native pixel rows after rejection of the study redraw.

The decoder may place these pieces; it must not invent outlines or shading.
The dragon is an original crouched, three-quarter creature with a curled tail.
"""
from pathlib import Path
from PIL import Image


def piece(x, y, rows):
    return {'x': x, 'y': y, 'rows': rows.strip('\n').splitlines()}


DRAGON = {'a':'#171b29','b':'#303441','c':'#494c59','d':'#6d737e',
          'e':'#9aa69f','f':'#d0d4b6','g':'#f5e5b6','h':'#94705a',
          'i':'#c49f72','j':'#18364a','k':'#26596b','l':'#38899c',
          'm':'#79c6cb','n':'#caeece','o':'#ec784c','p':'#fff9dc'}

# Far wing: a bent upper spar and three distinctly recessed web arcs.
FAR_WING = piece(5, 17, """
..ca
..decba
...efdcba
....efedcbba
.....efedddcbaa
......efeddddccbaa
.......efedddddccba
........efeddddddcba
.........efeddddddcba
..........efeddddddcba
...........efeddddccdcba
............efedddclkdccba
.............efedclllkddcba
..............efedlllkkddccba
...............efedllkkkdddcba
...............cfeedlkkkccddcba
..............cmlfeedlkkcbccddcba
.............cmlklfeedlkcbccdddcba
............cmlkkklfedlkcbcbdddcba
...........cmlkkkkklfedlkcbcbddcba
..........cmlkkkkkkklfedlkbcbddcba
.........cmlkkkkkkkjjlfedlkbcdddcba
.........clkkkkkkjjjjklfedlbcddddcba
..........clkkkjjjjjjklffedlcddddcba
...........clkjjjjjjjklffedlcddddccba
............cljjjjjjjklffedlcdddddcba
.............cjjjjjjjjkllfedlcdddddcba
..............bjjjjjjjjklfedlcdddddcba
...............bjjjjjjjklfedlcddddcba
................bjjjjjjklfeedlcdddba
.................bjjjjjjkllfeedlcddba
..................bjjjjjjkllfeedlccba
...................bjjjjjjkllfeedlcba
....................bjjjjjjkllfedlcba
.....................bjjjjjjklfedlcba
......................bjjjjjklfedlcba
.......................bjjjjklfedlcba
........................bjjjklfedlcba
.........................bjjklfedlcba
..........................bjkledlcba
...........................bklldcba
............................bccba
""")

# Near wing: thick elbow, long wrist, separately lit fingers over recessed membrane.
NEAR_WING = piece(63, 3, """
..........................................................fg
.......................................................efgdc
....................................................defggdca
.................................................cdefggedcba
..............................................bcdefggeedcba
...........................................bcdeffgeeedccba
........................................bcdeffgeeedddccba
.....................................bcdeffgeeedddddccba
..................................bcdeffgeeedddccccddcba
...............................bcdeffgeeedddcclmkkcddcba
............................bcdeffgeeedddcclmmllkkcddcba
.........................bcdeffgeeedddcclmmlllkkkcddcba
......................bcdeffgeeedddcclmmlllkkkkcddcba
....................bcdeffgeeedddcclmmlllkkkkkcddcba
..................bcdeffgeeedddcclmmlllkkkkkkcddcba
.................bcdeffgeeedddcclmmlllkkkkkkkcddcba
................bcdeffgeeedddcclmmlllkkkkkkkjcddcba
...............bcdeffgeeedddcclmmlllkkkkkkjjcddcba
..............bcdeffgeeedddcclmmllkkkkkkjjjcddcba
.............bcdeffgeeedddcclmmlkkkkkkjjjjcddcba
............bcdeffgeeedddcclmlkkkkkjjjjjcddcba
...........bcdeffgeeedddcclmlkkkkkjjjjjcddcba
..........bcdeffgeeedddcclmlkkkkjjjjjjcddcba
.........bcdeffgeeedddcclmlkkkkjjjjjjcddcba
........bcdeffgeeedddcclmlkkkklmnnmllccddcba
.......bcdeffgeeedddcclmlkkklmnnmlllkkccddcba
......bcdeffgeeedddcclmlkklmnnmlllkkkkccddcba
.....bcdeffgeeedddcclmlklmnnmlllkkkkkkccddcba
....bcdeffgeeedddcclmllmnnmlllkkkkkkkkccddcba
...bcdeffgeeedddcclmlmnnmlllkkkkkkkkkkccddcba
..bcdeffgeeedddcclmmnnmlllkkkkkkkkkkjjkccddcba
.bcdeffgeeedddcclmnnmlllkkkkkkkkkkjjjjjkccddcba
bcdeffgeeedddcclnnmlllkkkkkkkkkkjjjjjjjkkccddcba
bcdeffgeeedddcclnmlllkkkkkkkkkjjjjjjjjkkkccddcba
bcdeffgeeedddcclmlllkkkkkkkjjjjjjjjjjkkkccddcba
bcdeffgeeedddccllllkkkkkkjjjjjjjjjjjjkkccddcba
.bcdeffgeeedddcllllkkkkjjjjjjjjjjjjjkkccddcba
..bcdeffgeeedddclllkkkjjjjjjjjjjjjjjkkcddcba
...bcdeffgeeedddcllkkjjjjjjjjjjjjjjkkcddcba
....bcdeffgeeedddclkkjjjjjjjjjjjjkkkcddcba
.....bcdeffgeeedddclkjjjjjjjjjjkkkkcddcba
......bcdeffgeeedddcljjjjjjjjjkkkkcddcba
.......bcdeffgeeedddcjjjjjjjkkkkkcddcba
........bcdeffgeeedddcjjjjkkkkkkcddcba
.........bcdeffgeeedddcjkkkkkkkcddcba
..........bcdeffgeeedddcjjkkkkcddcba
...........bcdeffgeeedddcjjjkcddcba
............bcdeffgeeedddcjjcddcba
.............bcdeffgeeedddccddcba
..............bcdeffgeeedddccba
...............bcdeffgeeedddcba
................bcdeffgeeedddcba
.................bcdeffgeeedddcba
..................bcdeffgeeedddcba
...................bcdeffgeeedddcba
....................bcdeffgeeedddcba
.....................bcdeffgeeedddcba
......................bcdeffgeeedddcba
.......................bcdeffgeeedcba
........................bcdeffgeedcba
.........................bcdeffedcba
..........................bcdeedcba
...........................bccdcba
""")

TAIL = piece(78, 71, """
............................................ca
...........................................dga
..........................................dfga
.........................................defgca
........................................cdeffca
........................................cdeffca
.......................................bcdeffca
.......................................bcdeffca
......................................bcdeffca
......................................bcdefeca
.....................................bcdeefeca
....................................bcdeedfca
...................................bccdeedfca
..................................bcdddeedcba
.................................bcdeedeedcba
................................bcdeedeedccba
...............................bcdeefeddccba
..............................bcdeefedddcba
.............................bcdeefedddccba
...........................bbcdeffedddccba
.........................bbcdeffeddccdcba
.......................bbcddeffeddccdcba
....................bbcddeeffeddccdccba
................bbccdddeeffeddccddcba
............bbccdddddeeffeddccdddcba
.........bbccddeedddeeffeddccdddcba
......bbccddeeffedddeffeddccddddcba
....bbccddeefffedddeffeddccddddcba
..bbccddeeffgfedddeffeddccdddcba
.bccddeeffgfedddeffeddccdddcba
bccddeffgfedddeffeddccdddcba
bccdeffgfedddeffeddccdddcba
bccdefffedddeffeddccdddcba
.bccdeeeddddeffeddccddcba
..bccdddddddeffeddccdcba
...bbccddddeffeddccdcba
.....bbccddeffeddccba
........bbccddddccba
...........bbbccba
""")

FAR_LEG = piece(78, 81, """
......bbccba
....bcddedccba
...cdefffeddccba
..cdeffffedddccba
.cdefffedcdddcccba
cdeffedcccddddccba
cdeffedcccddddccba
cdeffedcccdddcccba
cdeffedcccddcccba
cdeffedccddcccba
.cdeffedddcccba
..cdeffeddcccba
...cdeffeddccba
....cdeffeddcba
.....cdeffeddcba
......cdeffeddcba
.......cdeffeddcba
........cdeffeddcba
.........cdeffeddcba
..........cdeffeddcba
..........cdeffeddcba
.........bcdeffeddcba
........bcdeffeddcba
.......bcdeffeddcba
......bcdeffeddcba
.....bcdeffeddccba
....bcdeffeddcccba
...bcdeffeddccccba
..bcdeffeddccddddccba
.bcdeffeddcdddeeeeddccba
bcdeffeddcdddefffedddccba
bcdeffeddccddefffedddcccba
.bccddddccddefffedddddccba
..bbccdccddefffeddccdeffgca
.....ccddeffedccb...cdefgca
.....cdeffedcba......cdefga
.....cdefedcba........cdefa
......cdefdca..........cda
.......cedca...........a
........cca
""")

NEAR_LEG = piece(44, 84, """
...................bcddcba
................bcdefffedcba
..............bcdeffffgfedcba
............bcdeffffgffedccba
..........bcdefffggffedddccba
.........bcdefffggffeddddccba
........bcdeffggffeddcdddccba
.......bcdeffgffeddccdddccba
......bcdeffgffeddcccdddccba
.....bcdeffgffeddcccdddccba
....bcdeffgffeddcccdddccba
...bcdeffgffeddcccdddccba
..bcdeffgffeddcccdddccba
.bcdeffgffeddcccdddccba
bcdeffgffeddcccdddccba
bcdeffgffeddcccdddccba
bcdeffgffeddcccddccba
.bcdeffgffeddccddccba
..bcdeffgffeddccdccba
...bcdeffgffeddcccba
....bcdeffgffeddccba
.....bcdeffgffeddcba
......bcdeffgffeddcba
.......bcdeffgffeddcba
.......bcdeffgffeddcba
......bcdeffgffeddccba
.....bcdeffgffeddcccba
....bcdeffgffeddccccba
...bcdeffgffeddccddcba
..bcdeffgffeddcddedccba
.bcdeffgffeddccdeffeddccba
bcdeffgffeddccdefffeedddcba
bcdeffgffeddccdefffeedddccba
.bccdddddccddefffeedddccddcba
..bbccdccddefffeedccddeffgca
....cdeffgffedccb...cdeffgca
....cdeffgfedcba.....cdeffgca
....cdeffedcba........cdefga
.....cdefedca..........cdega
......cdefdca...........cda
.......cedca............a
........cca
""")

# Broad rib cage with overlapping irregular scales and a warm, recessed belly.
BODY = piece(52, 59, """
...............bcba
.............bcddcba
...........bcdeffedcba
.........bcdefffeddccba
.......bcdeffefedddccba
......bcdeffdcdefedddcba
.....bcdeffdccdeffeddcba
....bcdefffedcdeffeddccba
...bcdeffffeddcdeffeddccba
..bcdeffgfeedddcdeffeddccba
.bcdeffgffeeddddcdeffeddccba
bcdeffgffeeffeddcdeffedddccba
bcdeffgfeedcdeffedcdeffedddccba
bcdeffgfeedccdeffedddeffeddddccba
bcdeffgffeddccdeffeddcdeffedddccba
.bcdeffgfeddcccdeffeddcdeffedddccba
..bcdeffgffedcccddeffeddcdeffeddccba
...bcdeffgffedcccddefffedddeffeddccba
...bcdeffgffedcccdddefffedccdeffeddcba
...bcdefffgedhiiihhcdeffedcccdeffedcba
...bcdefffedhiiigihhcdeffedcccdeffedcba
....bcdeffedhiggggihhcdeffedcccdeffedcba
....bcdeffedhiggggihhcdeffedcccdeffedcba
.....bcdeffedhiiggihhcdeffedcccdeffedcba
.....bcdeffedhiiigihhcdeffedccdeffeddcba
......bcdeffedhiiihhcdeffedccdeffeddccba
......bcdeffedhiihhhcdeffedccdeffeddcba
.......bcdeffedhhhiicdeffedccdeffeddcba
.......bcdeffedhiiigicdeffedcdeffeddccba
........bcdeffedhiiggicdeffeddeffeddccba
........bcdeffedhiigicdeffeddeffedddcba
.........bcdeffedhiicdeffeddeffedddccba
.........bcdeffedhhcdeffeddeffedddccba
..........bcdeffedhcdeffeddeffeddccba
...........bcdeffedddeffeddeffedccba
............bcdeffeddeffedddeddccba
.............bcdeffeddeddcddccba
..............bcddeddccddccba
................bccddcccba
..................bccba
""")

NECK = piece(42, 46, """
...........bcddcba
.........bcdeffedcba
.......bcdefffeddccba
......bcdeffffeddccba
.....bcdeffgfeddcccba
....bcdeffgfedccddccba
...bcdeffgfedcccddccba
..bcdeffgfedcccddeccba
.bcdeffgfedcccddeffdcba
.bcdeffgfedcccdeffeddcba
.bcdeffgfedcccdeffeddccba
.bcdeffgfedcccddeffeddccba
..bcdeffgfedcccdddeffeddcba
...bcdeffgfedccccddeffeddccba
....bcdeffgfedcccdddeffeddccba
.....bcdeffgfedccccddeffeddccba
......bcdeffgfedcccddeffeddccba
.......bcdeffgfedcccdeffeddccba
........bcdeffgfedccdeffeddcba
.........bcdeffgfedcdeffeddcba
..........bcdeffgfeddeffeddcba
...........bcdeffgffeffeddcba
............bcdefffefeddccba
.............bcdefffeddccba
..............bcdeffeddccba
...............bcddeddccba
.................bccdccba
...................bbba
""")

FAR_ARM = piece(27, 62, """
....................bcdddcba
..................bcdeffedcba
................bcdefffedcba
..............bcdefffedcba
............bcdefffedcba
..........bcdeffeddcba
........bcdeffeddcba
......bcdeffeddcba
....bcdeffeddcba
...bcdeffeddcba
..bcdeffeddcba
.bcdeffeddccba
bcdeffeddccdcba
bcdeffedccdddcba
.bcddeddcddedcba
..cdeeedcdeffdcba
.cdeffedcdeffdcba
cdeffedcdeffdcba
cdefedcdeffdcba
.cdeedcdeffdcba
..cddccdeffdcba
...bcdeffedcba
..cdefedcba
.cdefgdca
.cdefgca
..cdefga
...cdefa
....cca
""")

NEAR_ARM = piece(80, 65, """
.bcddcba
bcdeffedcba
bcdefffeddcba
bcdeffffeddccba
.bcdeffffeddccba
..bcdefffeddcccba
...bcdefffedccddcba
....bcdefffedcdddcba
.....bcdefffedddedcba
......bcdefffedddedcba
.......bcdefffeddddcba
........bcdefffedddcba
........bcdefffedddcba
.......bcdeffedddccba
......bcdeffedddccba
.....bcdeffedddccba
....bcdeffedddccba
...bcdeffedddccba
..bcdeffedddccba
.bcdeffedddccba
bcdeffedddcccba
bcdeffedddccddcba
bcdeffedccddeddcba
.bcdeffedcdeffedcba
..bcdeffedcdeffedcba
...bcdeffedcdeffedcba
....bcdeffedcdeffedcba
.....bcdeffedcdeffedcba
......bcdeffedcdeffedcba
.......bcdeffedcdeffedcba
........bcdeffedcdeffedcba
.........bcdeffedccdeffgca
..........bcdeffedc..cdefgca
...........bcdeffedca.cdefga
............bcdeffgca.cdefa
.............cdeffgca..cca
..............cdefga
...............cdefa
................cca
""")

# Horned head: short rear crown, hooked snout, eyebrow, red eye and open toothed jaw.
HEAD = piece(22, 29, """
...................................ga
..................................fga
.................................efga
................................defca
...............................cdefca
..............................cdeffca
.............................cdeffca
............................cdeffca
.......................f...cdeffca
......................fg..cdeffca
......................egbcdeffca
.....................defbcdeffca
....................cdefcdeffedca
...................cdeffdeffeddcba
..................cdefffedffedddcba
.................cdefffedcffeddddcba
................cdefffedccffedddddcba
..............bcdefffedccdffeddddddccba
............bcdefffedccdffeddddddcccba
.........bbcdefffedccdeffedddddccdccba
......bbcdeffffedccdeffedddcddcdedcba
....bcdefffffeedccdeffedcddcdeffedcba
...cdeffgfffedccdeffedccddeffedddccba
..cdeffgfedccdeffedccdeffedddddccba
.cdeffgffeedcdeffedcboofeddddddccba
cdeffgffffeeddeffedbaoopfedddddccba
cdeffgfffeeeddeffedbaaafedddddccba
bcdeffffeeedddeffedccdeffedddddccba
.bcdeffeeddddddeffedcdeffeddddccba
..bccdeeddddddcdeffedcdeffedddccba
...bbccddddddccdeffedcdeffeddccba
.....abbbccddccdeffedcdeffeddcba
......apabbbccdeffedcdeffeddcba
.......bpapbbcdeffedcdeffedcba
........bpappbcdeffedcdeffedcba
.........bpapapbcdeffeddeffedcba
..........bbapappbcdeffeffedcba
............bbpapbcdeffeffedcba
..............bpcdeffeffedcba
...............cdefffefedcba
................cdeffedccba
.................bcddccba
...................bccba
""")

from dragon_volume_cels import PAL as DRAGON, BODY_PIECES as DRAGON_BODY


def dragon_sequence():
    return 128,DRAGON,'screen',[('원화 유지',1400,DRAGON_BODY)]


if __name__ == '__main__':
    # Draft render: only read and place authored rows, nearest scale for inspection.
    out=Path(__file__).resolve().parents[3]/'docs/experiments/hero-magic-rework-20261005'
    out.mkdir(parents=True,exist_ok=True)
    im=Image.new('RGBA',(128,128))
    for p in DRAGON_BODY:
        for dy,row in enumerate(p['rows']):
            assert p['y']+dy<128
            assert p['x']+len(row)<=128,(p['x'],dy,len(row))
            for dx,s in enumerate(row):
                if s=='.':continue
                color=DRAGON[s];im.putpixel((p['x']+dx,p['y']+dy),tuple(int(color[i:i+2],16) for i in (1,3,5))+(255,))
    im.save(out/'summon.png')
    im.resize((512,512),Image.Resampling.NEAREST).save(out/'summon-4x.png')
