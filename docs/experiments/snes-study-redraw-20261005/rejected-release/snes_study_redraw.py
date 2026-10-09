"""Written pixel rows for the second hero-magic redraw after viewing SNES FF6.

Only decode the explicitly written palette symbols and placements. No masks,
procedural shapes, tracing, rescaling of cels, or generated intermediate frames.
"""
import json
from pathlib import Path
from PIL import Image

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]
REVIEW = ROOT / 'docs/experiments/snes-study-redraw-20261005'


def piece(x, y, block):
    return {'x': x, 'y': y, 'rows': block.strip('\n').splitlines()}


FIRE = {'a': '#541e32', 'b': '#a52c38', 'c': '#df482e', 'd': '#f97830',
        'e': '#ffb844', 'f': '#ffdf78', 'g': '#fff0af', 'h': '#fffbe7',
        's': '#493241', 't': '#71505b'}
ICE = {'a': '#223655', 'b': '#315f90', 'c': '#428dc1', 'd': '#65c5e1',
       'e': '#a3e7ed', 'f': '#d9fcf6', 'g': '#f6ffff', 'v': '#6579b1',
       'w': '#9eabe0'}
BOLT = {'a': '#20316b', 'b': '#3861ba', 'c': '#71b5eb', 'd': '#d3edff',
        'e': '#b48431', 'f': '#ffce55', 'g': '#fff0a0', 'h': '#ffffff'}
PEARL = {'a': '#234378', 'b': '#497db1', 'c': '#83b7d4', 'd': '#b7d7e8',
         'e': '#e6edf4', 'f': '#ffffff', 'v': '#667bb1', 'w': '#aab8d9'}
DRAGON = {'a': '#211f2d', 'b': '#413e47', 'c': '#625a5c', 'd': '#8d7b69',
          'e': '#c2ab87', 'f': '#ede4bc', 'g': '#756044', 'h': '#d3b884',
          'i': '#294763', 'j': '#376e8c', 'k': '#5e9aa7', 'l': '#8dc8c4',
          'm': '#cae9d9', 'n': '#f8d978', 'o': '#9b4d49'}

# White-hot core bends left while two cooler tongues peel away to the right.
FIRE_PEAK = piece(9, 4, """
.......................b
......................bc
.....................bcd
.....................cde
............b.......cdef
...........bc.......cdef
..........bcd......cdefe
..........cde.....bcdefc
.........cdef.....cdefdb
.........cdef....cdefec
....b....cdefe...cdefec
....bc...cdefe..cdefec
.....cd..cdefgc.cdefec
.....cde.cdefgc.cdefc
.....cdefcdefgecdefec.......b
......cdefdefgecdefec......bc
......cdefeefggdefec......bcd
.......defefgggdefec.....bcde
.......defgghhfgfec.....bcdef
......cdefgghhhgfed....bcdefe
.....bcdefgghhhhgfec..bcdefec
.....cdeffgghhhhgfedc.cdefec
....bcdeffghhhhhgfedccdefec
....cdeffgghhhhhggfedddefec
....cdefgghhhhhhhgfedddefc
...bcdefgghhhhhhhgffedddec
..bcdeffghhhhhhhhggffeddec
..cdeffgghhhhhhhhhggffedec
.bcdeffgghhhhhhhhhggffedec
.bcdeffggghhhhhhhhggffedec
.cdeeffggggghhhhhgggffedec
.bcdeefffggggghhgggfffeedc
..bcdeeffffgggggggfffeedcc
..bbcdeeffffgggggfffeedccb
...bbcdeeeffffggfffeeccbb
....bbcdddeefffffeedccbb
......bbccdddeeeeeddcbb
.........bbcccccccbb
""")

# Asymmetric crystal: broad illuminated face, dark right facet and two roots.
ICE_PEAK = piece(11, 5, """
................g
...............gf
..............gfe
.............gfed
............gfeed
...........gfeedd
..........gfeeedd
.........gfeeeedd
.........gfeeeddc
.........gfeeeddc........f
.........gfeeeddc.......fe
.........gfeeeddc......fed
....f....gfeeeddc.....fedd
...fe....gfeeeddc....feedd
..fed....gfeeeddc...feedcc
.fedd....gfeeeddc..feedcca
gfedd....gfeeeddc.feedccab
gfedd....gfeeeddcfeedccab
gfeedd...gfeeeddfeedccabb
gfeeedd..gfeeeddfeedccabb
gfeeeedd.gfeeeddfeedccabb
.gfeeeddcgfeeddcfeedccabb
.gfeeeddcgfeedccfeedccabb
..gfeedddgfeedccfeedccabb
..gfeedddgfeedccfeedccabb
...gfeedggfeedccfeedccab
...gfeedggfeedccfeedccab
....gfeedgfeedccfeedccab
....gfeedgfeedccfeedccab
.....gfeedfeedccfeedcab
.....gfeedfeedccfeedcab
......gfeedfedccfeedab
.......gfeedfedcfeedab
.......vgfeefedcfeeab
........vgfeefdcfeab
.........vgfeeddfab
.......b..vgfeedab..a
.....bc....vgfeab...ab
....bcd.....veab...abc
...bcdde.....ab...abcd
..bcddeef....ab..abcde
...bcddeef...a..abcde
.....bcddef....abcde
.......bcde...abcd
.........bc..abc
............ab
""")

# Two hand-chosen bent paths. The hot path and blue branch join at the foot.
BOLT_PEAK = piece(7, 0, """
............................bghb
...........................bfhgc
..........................bfhgc
.........................bfhgc
.........................bfhgc
........................bfhgc
.......................bfhgc
......................bfhgc
.....................bfhgc
.....................bfhgc
....................bfhgc
...................bfhgc
..................bfhgc
.................bfhgc
................bfhgcccc
...............bfhhhgggfc
...............bcggghhhgc
................ccccfhgc
...................bfhgc........b
..................bfhgc........bc
.................bfhgc........bcd
................bfhgc.......bcdd
...............bfhgc.......bcdd
..............bfhgc.......bcdd
.............bfhgc.......bcdd
............bfhgc......bcdd
...........bfhgc.....bcddd
..........bfhgc.....bcddd
.........bfhgc......bcdd
........bfhgc......bcdd
.......bfhgc......bcdd
......bfhgc......bcdd
.....bfhgc......bcdd
....bfhgc.....bcddd
....bfhgc....bcddd
....bfhhhgggggcdd
....bcgggghhhgcdd
......ccccfhgcdd
..........fhgcd
.........bfhgc
........bfhgc
.......bfhgc
......bfhgc
.....bfhgc
.....bfhgc
......fhgc
.......fhgc
........fhgc
.........fhgc
........bfhgc
.......bfhhgc
.......fhhhgf
.....bfghhhgfc
...bcdfghhhgfdcb
.bccdfghhhhgfddccb
..bcccdfgggfddccb
......bccddccb
""")

ORB = piece(0, 0, """
.....bbbbb
...bccdddcb
..bcdffffedb
.bcdefffffedb
.bcefffffffecb
bcdeffffffffdb
bcdeffffffffdb
bcdeeffffffedb
.bcdeeefffedcb
.bccddeeeedccb
..bbccdddccbb
....bbcccbb
......bbb
""")
HOLY_PEAK = piece(8, 14, """
.....................f
....................fff
.....................f
............c..................c
...........cde....ccc..........cd
...........def..cddedcc.......de
..........def.cdeffffedc.....def
..........efcdefffffffdc....def
.......ccdddefffffffffedcc..ef
.....cddeeeffffffffffffedcdef
....cdefffffffffffffffffffec
...cdefffffffffffffffffffffdc
..cdeffffffffffffffffffffffedc
..cdefffffffffffffffffffffffdc
.cdeffffffffffffffffffffffffedc
.cdeffffffffffffffffffffffffedc
.cdefffffffffffffffffffffffffdc
cdeffffffffffffffffffffffffffedc
cdeffffffffffffffffffffffffffedc
.cdefffffffffffffffffffffffffdc
.cdeffffffffffffffffffffffffedc
..cdefffffffffffffffffffffffdc
..ccdeffffffffffffffffffffedcc
...ccdefffffffffffffffffffedcc
....ccddeffffffffffffffffedcc
.....ccddeefffffffffffffedcc
......cccdddeeffffffffedccc
........ccccdddeeeeeedccc
..........ccccddddddccc
..............cccccc
""")

# Far wing: rigid bone along the rising edge, curved web cutouts underneath.








# Revision of the peak after opening it: replace the thin S-shaped trunk and
# tube-like legs with a broad shoulder, hanging breast and bent thighs.
# Final key pose: turn the mass toward the viewer, bring the arms to the chest,
# and put both wing joints on the back. Individual armour and throat plates are
# written in the rows rather than automatic outlines of a filled silhouette.
NEAR_WING = piece(61, 4, """
......................................................f
....................................................fee
..................................................feedb
................................................feedkjb
..............................................feedkkjib
............................................feedlkkjjib
..........................................feedlkkkjjjib
........................................feedlkkkjjjjib
......................................feedlkkkjjjjjib
....................................feedlkkkjjjjjjib
..................................feedlkkkjjjjjjjib
................................feedlkkkjjjjjjjjib
..............................feedlkkkjjjjjjjjjib
............................feedlkkkjjjjjjjjjjib
...........................feedlkkkjjjjjjjjjjjib
..........................feedlkkkjjjjjjjjjjjjib
.........................feedlkkkjjjjjjjjjjjjjib
........................feedlkkkjjjjjjjjjjjjjjib
.......................feedlkkkjjjjjjjjjjjjjjjib
......................feedlkkkjjjjjjjjjjjjjjjjib
.....................feedlkkkccddeedccjjjjjjjjjib
....................feedlkkcdelllkkkddcjjjjjjjjjib
...................feedlkkcdllkkkjjjjjddcjjjjjjjjib
..................feedlkkcdlkkkjjjjjjjjjddcjjjjjjjjb
.................feedlkkcdlkkkjjjjjjjjjjjjjddcjjjjjjb
................feedlkkcdlkkkjjjjjjjjjjjjjjjjddcjjjjb
...............feedlkkcdlkkkjjjjjjjjjjjjjjjjjjjddcjjb
..............feedlkkcdlkkkjjjjjjjjjjjjjjjjjjjjjddcb
.............feedlkkcdlkkkjjjjjjjjjjjjjjjjjjjjjjdcb
............feedlkkcdlkkkjjjjjjjjjjjjjjjjjjjiiiidb
...........feedlkkcdlkkkjjjjjjjjjjjjjjjjjiiii...db
..........feedlkkcdlkkkjjjjjjjjjjjjjjjiiii......b
.........feedlkkcdlkkkjjjjjjjjjjjjjiiii
........feedlkkcdlkkkjjjjjjjjjjjiiiii
.......feedlkkcdlkkkjjjjjjjjjiiiii
......feedlkkcdlkkkjjjjjjjiiiii
.....feedlkkcdlkkkjjjjjiiiii
....feedlkkcdlkkkjjjjjii
...feedlkkcdlkkkjjjjjjjii
..feedlkkcdlkkkjjjjjjjjjdb
.feedlkkcdlkkkjjjjjjjjjjddcb
feedlkkcdlkkkjjjjjjjjjjjjddcb
eedlkkcdlkkkjjjjjjjjjjjjjjdcb
edlkkcdlkkkjjjjjjjjjjjjjjjdb
dlkkcdlkkkjjjjjjjjjjjjjjiidb
lkkcdlkkkjjjjjjjjjjjjiiii.db
kkcdlkkkjjjjjjjjjjiiii....b
kcdlkkkjjjjjjjjiiii
cdlkkkjjjjjjiiii
dlkkkjjjjjiii
lkkkjjjjiii
kkkjjjiii
kkjjiii
kjiii
jii
ib
""")
FAR_WING = piece(13, 14, """
f
ef
def
bddef
biddef
bjjddef
bjjjddef
.bjjjjddef
..bjjjjddef
...bjjjjddef
....bjjjjddef
.....bjjjjddef
......bjjjjddef
.......bjjjjddef
........bjjjjddef
.........bjjjjddef
..........bjjjjddef
...........bjjjjddef
............bjjjjddef
.............bjjjjddef
..............bjjjjddef
...............bjjjjddef
................bjjjjddef
.................bjjjjddef
..................bjjjjddef
...................bjjjjddef
....................bjjjjddef
.....................bjjjjddef
......................bjjjjddef
.......................bjjjjddef
........................bjjjjddef
.........................bjjjjddef
..........................bjjjjddef
...........................bjjjjddef
............................bjjjjddef
.............................bjjjjddef
..............................bjjjjddef
...............................bjjjjddef
................................bjjjjddef
""")
TORSO = piece(47, 55, """
............aabbbbaa
.........aabbcdddddcba
.......abbcddeeedddecba
......abcdeffeedccddeedba
.....abcdeffedccdddeeedcba
....abcdeffedcddeeedddeedba
...abcdeffedcdeffeedccdeedba
..abcdeffedcdeffedcdddeedcba
.abcdeffedcdeffedcdeeeeddcba
abcdeffedcdeffedcdeffedccdcba
abcdeffedcdeffedcdeffedcddcba
abcdeffedcdeffedcdeffedcddcba
abcdeffedcddeedcdeffedcdeedcba
abcdeffedcbbccdcdeffedcdeedcba
abcdeffedcghhhgcdeffedcdeedcba
abcdeffedcghhhgcdeffedcdddcba
.abcdeffedcgggcdeffedcdddcba
.abcdeffedghhhgcdeffedcdddcba
..abcdeffedghhhgcdeedcdeedcba
..abcdeffedcgggcdeedcdeedcba
...abcdeffedghhhgcedcdeedcba
...abcdeffedghhhgcdcdeedcba
....abcdeffedcgggcdeedcba
....abcdeffedghhhgcdeedcba
.....abcdeffedghhgcdedcba
.....abcdeffedcgggcdddcba
......abcdeffedghhgdddcba
......abcdeffedghhgdddcba
.......abcdeffedcgcddcba
.......abcdeffedcdddcba
........abcdeffeeeddcba
.........abcdeeeeddcba
..........abcddddccba
...........abbcccba
............aabba
""")
FORELEG = piece(22, 64, """
.......................abbbba
....................aabbcddcba
.................aabbcdeeedcba
..............aabbcdeeedcba
...........aabbcdeeedcba
........aabbcdeeedcba
......abbcdeeedcba
.....abcdeeedcba
....abcdeeedcba
...abcdeeedcba
..abcdeeedcba
.abcdeeeeedcba
abcdeedededcba
acdefecdeedcba
afeca.acdefeca
.aa....afeca
........aa
""")
ARM_RIGHT = piece(69, 62, """
aabbbba
abbcdddcba
abcdeeedcba
abcdeeeedcba
.abcdeeeedcba
..abcdeeeedcba
...abcdeeeedcba
....abcdeeeedcba
.....abcdeeeedcba
......abcdeeeedcba
.......abcdeeeedcba
........abcdeeeedcba
.........abcdeeeedcba
..........abcdeeeedcba
...........abcdeeeedcba
..........abcdeedededcba
.........acdefecdeedcba
.........afeca.acdefeca
..........aa....afeca
.................aa
""")
HINDLEG = piece(64, 80, """
....aabbbbaa
..abbcdddddcba
.abcdeeeeedddcba
abcdeeeeeeddddcba
abcdeffeeeedddcba
abcdeffeeddddcba
abcdeffeedddcba
.abcdeffeedddcba
..abcdeffeedddcba
...abcdeffeedddcba
....abcdeffeedddcba
.....abcdeffeedddcba
......abcdeffeedddcba
.......abcdeffeedddcba
........abcdeffeedddcba
.........abcdeffeedddcba
.........abcdeffeedddcba
........abcdeffeedddcba
.......abcdeffeedddcba
......abcdeffeedddcba
.....abcdeffeedddcba
....abcdeffeedddcba
...abcdeffeedddcba
..abcdeffeedddcba
.abcdeffeedddcba
abcdeffeedddcba
abcdeeeeeedddcba
abcdeedeeedeedcba
acdeedcadeedcadeedcba
acfeca.acfeca.acfeca
.afea...afea...afea
..aa.....aa.....aa
""")
LEG_LEFT = piece(36, 81, """
.........abbbbba
.......abbcddddcba
.....abbcdeeeedddcba
....abcdeeeeeedddcba
...abcdeffeeedddcba
..abcdeffeeedddcba
.abcdeffeeedddcba
abcdeffeeedddcba
abcdeffeeedddcba
abcdeffeeedddcba
.abcdeffeeedddcba
..abcdeffeeedddcba
...abcdeffeeedddcba
....abcdeffeeedddcba
.....abcdeffeeedddcba
......abcdeffeeedddcba
.......abcdeffeeedddcba
.......abcdeffeeedddcba
......abcdeffeeedddcba
.....abcdeffeeedddcba
....abcdeffeeedddcba
...abcdeffeeedddcba
..abcdeffeeedddcba
.abcdeffeeedddcba
abcdeffeeedddcba
abcdeeeeeedddcba
abcdeedeeedeedcba
acdeedcadeedcadeedcba
acfeca.acfeca.acfeca
.afea...afea...afea
..aa.....aa.....aa
""")
TAIL = piece(75, 74, """
abcddcba
abcdeedcba
.abcdeedcba
..abcdeedcba
...abcdeedcba
....abcdeedcba
.....abcdeedcba
......abcdeedcba
.......abcdeedcba
........abcdeedcba
.........abcdeedcba
..........abcdeedcba
...........abcdeedcba
............abcdeedcba
.............abcdeedcba
..............abcdeedcba
...............abcdeedcba
................abcdeedcba
.................abcdeedcba
.................abcdeedcba
.................abcdeedcba
................abcdeedcba
...............abcdeedcba
..............abcdeedcba
.............abcdeedcba
............abcdeedcba
..........aabcdeedcba
........aabbcdeedcba
.....aabbccdeedcba
...aabbccdeedcba
.aabbccdeedcba
abbccdeedcba
abccdddcba
.abcccba
..aaaa
""")
NECK = piece(43, 43, """
.....aabbbbbbaa
...aabbcdddddcba
.aabbcdeeeedddcba
abbcdeffeeeddddcba
abcdeffeeedcdeedcba
abcdeffeeedcdeeedcba
abcdeffeeedcdeeeedcba
abcdeffeeedcdeeeedcba
.abcdeffeeedcdeeeedcba
..abcdeffeeedcdeeeedcba
...abcdeffeeedcdeeeedcba
....abcdeffeeedcdeeeedcba
.....abcdeffeeedcdeeeedcba
......abcdeffeeedcdeeeedcba
.......abcdeffeeedcdeeeedcba
........abcdeffeeedcdeeeedcba
.........abcdeffeeedcdeeeedcba
..........abcdeffeeedcdeeeedcba
...........abcdeffeeedcdeeeedcba
............abcdeffeeedcdeeeedcba
""")
HEAD = piece(29, 27, """
...............................f
..............................fe
.............................fed
............................fedb
...........................fedba
.....................a....fedba
....................afeaafedba
..................abcfefedba
................abbcdffedcba
..............abbcdeffedddcba
............abbcdeffedcdeedcba
..........abbcdeffeedccdeddcba
........abbcdeffeedcdccdedddcba
......abbcdeffeedcbnnaacdedddcba
....abbcdeffeedcbnaaaccdedddcba
..abbcdeffeeedccbbbccddeedddcba
.abcdeffeeedccbbccddeeddddcba
abcdefeeedcccbbccddeeedddcba
abcdeedcccbbbaaaccddeeedddcba
abccccbbbba....f.cdeeedddcba
.abbbbaa.....f...cdeeedddcba
..aaaa..........acdeeedddcba
..............aacdeeedddcba
.............acffedeeedddcba
..............acffedeeedcba
...............acdeeeedcba
................abbcccbba
..................aaaa
""")
ARMOUR = piece(51, 56, """
..........cdeedc
.........cdeffedc
.......cdeffeedcc
.....cdeffedccdeedc
....cdeffedcdeffedc
...cdeffedcdeffedc
..cdeffedccdeedcc
.cdeffedccdeedc
.cdeffedcdeffedc
..cdeedccdeffedc
...cccdccdeedcc
.....cdeedccdc
....cdeffedccdeedc
...cdeffedcdeffedc
...cdeffedcdeffedc
....cdeedccdeedcc
.....ccdcccdcc
......cdeedc
.....cdeffedc
.....cdeffedc
......cdeedc
.......ccc
""")
DRAGON_BODY = [FAR_WING, TAIL, NEAR_WING, HINDLEG, LEG_LEFT, TORSO, NECK, ARMOUR, FORELEG, ARM_RIGHT, HEAD]


def placed(p, x, y):
    """A manually selected placement of an unchanged authored piece."""
    return {**p, 'x': x, 'y': y}


FIRE_SEED = piece(21, 39, """
.........c
........cde
.......cdef
.....ccdefedc
....cdeffgfedc
...cdeffghgfedc
..cdeffghhhgfedc
.bcdeffghhhhgfedc
.bcdeffghhhhgfedc
bcdeffgghhhggfedcb
bcdeffggggggffedcb
.bcdeeffggggffedcb
..bcdeeffffffedcb
...bcdeeeffeedcb
....bbccdddccb
......bbbbbb
""")
FIRE_RISE = piece(16, 22, """
...............c
..............cd
.............cde
............cdef
...........cdefe
..........cdefe
.........cdefge
.........cdefge.....c
........cdefgge....cde
.......cdefggge...cdef
.......cdefghge..cdefe
......cdefghhggecdefe
..c...cdefghhhgecdefe
.cde..cdefghhhgfdefec
.cdef.cdefghhhhgfdefec
..cdefcdefghhhhgfdefec
..cdeffdefghhhhhgfdefc
...cdefffghhhhhhggfdec
...cdeffgghhhhhhggfdec
..cdeffgghhhhhhhggffedc
.cdeffgghhhhhhhhhggffedc
bcdeffgghhhhhhhhhggffedc
bcdeffgghhhhhhhhhggffedc
bcdeffggghhhhhhhgggffedc
bcdeeffggghhhhhgggffedc
.bcdeeffgggggggggffedc
..bcdeefffggggggffedcc
...bcdeefffffffffedcc
....bcdeeeeffffeedccb
.....bbccddeeeeddccb
.......bbccccccbb
""")
FIRE_FORK = piece(7, 7, """
...........................c
..........................cd
.........................cde
........................cdef
.......................cdefe
......................cdefe
.....................cdefge
....................cdefgge
...................cdefggge
..........c........cdefggge
.........cd.......cdefgggge
........cde......cdefggggfe
.......cdef......cdefggggfe
......cdefe.....cdefghgggfe
.....cdefe......cdefghhggfe
.....cdefe.....cdefghhhggfe
.....cdefge....cdefghhhggfe
.....cdefgge...cdefghhhhggfe
......cdefgge.cdefghhhhhggfe
......cdefgggecdefghhhhhggfe
.......cdefgggdefghhhhhhggfe......c
.......cdefgggdefghhhhhhhggfe....cd
........cdefggdefghhhhhhhggfe...cde
........cdefggdefghhhhhhhhggfec.cdef
.........cdefgdefghhhhhhhhggfecddef
.........cdefgdefghhhhhhhhggfedcdefe
........cdefggdefghhhhhhhhhggfeddefe
.......cdefgggdefghhhhhhhhhggfeddefe
......cdefggggdefghhhhhhhhhhggfedefc
.....cdefgggggdefghhhhhhhhhhggfedefc
....cdefggggggdefghhhhhhhhhhggfedefc
...cdefgggggggdefghhhhhhhhhhggffedec
..cdefggggggggdefghhhhhhhhhhggffedec
.bcdefggggggggdefghhhhhhhhhhggffedec
.bcdefgggggggggffghhhhhhhhhgggffedec
..bcdeffgggggggggghhhhhhhhggggffedec
..bcdeeffgggggggggghhhhhgggggfffeedc
...bcdeeeffgggggggggggggggggfffeedc
....bcdeeefffggggggggggggggfffeedcc
.....bcdeeeffffggggggggggffffeedccb
......bcdeeefffffggggggfffffeedccb
.......bcdeeefffffffffffffeedccb
........bcdeeeeffffffffffeedccb
.........bbcdeeeeeffffeeeddccbb
...........bbccdddeeeeddccbb
..............bbccccccbb
""")
FIRE_TEAR = piece(9, 9, """
......................cde
.....................cdefe
....................cdefec
...................cdefgec
..................cdefggec
........c........cdefggfec
.......cde.......cdefggfec
......cdefe......cdefggfec
.....cdefge......cdefggfec
.....cdefgge......cdefgfec
......cdefgfec.....cdefec
.......cdefec.......cc
.........cc

.....cde
....cdefe........cde
...cdefgfe......cdefe
...cdefggfe....cdefgfe
....cdefggfe..cdefgggfe
.....cdefggfecdefggggfe
......cdefgggdefggggggfe
......cdefgggdefggggggfe.......cd
......cdefgggdefggggggfe......cde
.....cdefggggdefggggggfec....cdef
....cdefgggggdefggggggggfec.cdefe
...cdefggggggdefggghhgggfedcdefe
..cdefgggggggdefgghhhhggfeddefe
.bcdefgggggggdefghhhhhgggffedec
.bcdeffggggggdefghhhhhgggffedec
.bcdeffgggggggffghhhhhgggffedec
.bcdeeffggggggggghhhhggggffedec
..bcdeeffggggggggghhggggfffeedc
...bcdeeeffggggggggggggfffeedc
....bcdeeefffgggggggggffeedcc
.....bcdeeeffffgggggfffeedcc
......bcdeeefffffffffeedccb
.......bbcdeeeffffeeeddccbb
.........bbccddeeeeddccbb
............bbccccbb
""")
FIRE_FALL = piece(10, 25, """
.........cd.............c
........cde............cde
........cdef...........cdef
.........cdec...........cde
..........cc.............c

..cd....................cd
.cdef..................cdef
.cdefe................cdefe
..cdefe..............cdefe
...cdefe.....cde....cdefe
....cdefe...cdefe..cdefe
....cdefge.cdefggecdefe
....cdefggedefggggdefec
....cdefgggdefgggggdefec
...cdefggggdefggggggdefec
..cdefgggggdefgggggggdefec
..cdefgggggdefgggggggffedec
..cdeffggggggggggggggffedec
..cdeeffgggggggggggggffedec
...cdeeffgggggggggggffedec
....cdeeefffgggggggffedcc
.....bcdeeefffffffeedcc
......bcdeeeeeeeeedccb
........bbccdddccbb
..........bbbbbb
""")
FIRE_CINDERS = piece(14, 37, """
...bcd................cd
...cde................de
....cd.................c

................c
...............cde
.bc...........cdef........bc
.cd............cde.......cd
..b.............c........b

......bcde......bcde
.....bcddcb....bcddcb
....bbccddccbbccddccb
.....bbccccccccccbb
.......bbbbb.bbbb
""")

ICE_SEED = piece(19, 42, """
...........f
..........fe
.........fed
........fedd
...f...feedc
..fe..feedcb
.fed.feedcbb.....e
gfedfeedcbb.....ed
gfeedfeedcb....edc
.gfeedfeedcb..edcb
..gfeedfeedcbedcb
...gfeedfeededcb
....vgfeededcb
.....vgfedccb
.......vbbbb
""")
ICE_GROW = piece(14, 23, """
................g
...............gf
..............gfe
.............gfed
............gfeed
...........gfeedd
..........gfeeedd
..........gfeeedd......f
..........gfeeedd.....fe
..........gfeeedd....fed
..........gfeeedd...fedd
....f.....gfeeedd..feedc
...fe.....gfeeedd.feedcb
..fed.....gfeeeddfeedcbb
.gfed.....gfeeeddfeedcbb
gfeed.....gfeeeddfeedcbb
gfeeed....gfeeeddfeedcbb
.gfeeedd..gfeeeddfeedcbb
..gfeeedd.gfeeeddfeedcbb
...gfeeeddgfeeeddfeedcbb
....gfeedggfeeddfeedcbb
.....gfeedgfeeddfeedcbb
......gfeedfeedcfeedcbb
.......gfeedfedcfeedcb
........gfeedfedfeedcb
.........gfeedfedfeedcb
..........gfeedfdfedcb
...........vgfeedfedb
............vgfeeddb
.............vgfedb
..............vbbb
""")
ICE_SPLIT = piece(10, 7, """
...................g
..................gf
.................gfe
................gfed
...............gfeed
..............gfeedd
.............gfeeedd
............gfeeedd
............gfeeedd........f
............gfeeedd.......fe
............gfeeedd......fed
............gfeeedd.....fedd
.....f......gfeeedd....feedc
....fe......gfeeedd...feedcb
...fed......gfeeaad..feedcbb
..gfed......gfea.dd.feedcbb
.gfeed......gfea.ddfeedcbb
gfeeed......gfea.dfeedcbbb
gfeeedd.....gfea.dfeedcbbb
gfeeedda....gfea.dfeedcbbb
.gfeeedd.a..gfea.dfeedcbbb
..gfeeedd.a.gfea.dfeedcbbb
...gfeedda.agfea.dfeedcbbb
....gfeeddaagfea.dfeedcbbb
.....gfeedgagfea.dfeedcbbb
......gfeedagfea.dfeedcbbb
.......gfeedgfea.dfeedcbbb
........gfeedfea.dfeedcbb
.........gfeedaa.dfeedcbb
..........gfeed.adfeedcb
...........vgfea.dfeedcb
............vgfeadfeedcb
.............vgfeddfeedb
..............vgfedfeedb
...............vgfdfedb
................vgeedb
.................vedb
..................ab
...........c............c
..........de...........de
.........def..........def
........cdefd........cdefd
.......bcdefdc......bcdefdc
........bcdefdc....bcdefdc
.........bcdefdc..bcdefdc
...........bcdefccdefdc
.............bccccccb
""")
ICE_SHATTER = piece(5, 13, """
.......................gf
......................gfe
.....................gfed
....................gfeed
...................gfeedc
..................gfeedcb
........f.........gfeedcb
.......fe.........gfeedcb
......fed.........gfeedcb........f
.....feedc........gfeedcb.......fe
....gfeedcb.......gfeedcb......fed
....gfeedcb........vgfdb......fedc
.....gfeedcb........vbb......fedcb
......gfeedcb...............fedcbb
.......vgfedb..............fedcbbb
........vbbb..............fedcbbb
..........................vgdcbb
...........................vbbb

...........f
..........fe...........gf
.........fed..........gfe
........feedc........gfed
.......gfeedcb.......gfed
.......gfeedcb.......gfed
........vgfedb.......vgdb
.........vbbb.........vb

.....de...........fg...........de
....defd.........fged.........defd
...cdefdc........fgdc........cdefdc
....cdefdc........vb........cdefdc
.....bcddcb................bcddcb
.......bbb.....bddddb........bbb
..............bcdeedcb
...............bcccb
""")
ICE_SHARDS = piece(5, 25, """
..gf
.gfe
gfed.........................gf
gfed........................gfe
vgdb.......................gfed
.vb.......................gfedc
..........................vgdb
...........................vb

..........gf
.........gfe........gf
........gfed.......gfe
........vgdb......gfed
.........vb.......vgdb
...................vb

..de................................de
.defd..............................defd
cdefdc............................cdefdc
.bcdb..............................bcdb
..bb................................bb

...........bcd........bcd
..........bcddcb....bcddcb
...........bbcccbbbbcccbb
.............bbbbbbbb
""")
ICE_MELT = piece(8, 46, """
....d........................d
...de.......................de
....c........................c

..........c.........c
.........de........de
..........c.........c
.....bbcddcbb...bbcddcbb
......bbccbbbbbbbccbb
.........bbbbbbbb
""")

BOLT_FIRST = piece(21, 0, """
.................bcd
................bcd
...............bcd
..............bcd
.............bcd
............bcd
...........bcd
..........bcd
.........bcd
.........bcddddd
..........bccdddb
.............bcd
............bcd
...........bcd
..........bcd
.........bcd
........bcd
.......bcd
......bcd
.....bcd
....bcd
...bcd
..bcd
.bcd
bcd
bcdddddd
.bccdddb
....bcd
...bcd
..bcd
.bcd
bcd
bcd
.bcd
..bcd
...bcd
....bcd
.....bcd
......bcd
.......bcd
........bcd
.........bcd
..........bcd
...........bcd
............bcd
.............bcd
..............bcd
...............bcd
................bcd
.................bcd
................bcd
...............bcd
..............bcd
.............bcd
............bcdd
...........bcdddb
............bccb
""")
BOLT_SECOND = piece(6, 0, """
..........cfhgc
...........cfhgc
............cfhgc
.............cfhgc
..............cfhgc
...............cfhgc
................cfhgc
.................cfhgc
..................cfhgc
...................cfhgc
...................cfhgc
..................cfhgc
.................cfhgc
................cfhgc
...............cfhgc
..............cfhgc
.............cfhgc
............cfhgc
...........cfhgc
..........cfhhhggggfc
..........ccgggghhhgc
..............cccfhgc
................cfhgc
...............cfhgc
..............cfhgc
.............cfhgc
............cfhgc
...........cfhgc
..........cfhgc
.........cfhgc
........cfhgc
.......cfhgc
......cfhgc
.....cfhgc
....cfhgc
...cfhgc
..cfhgc
.cfhgc
cfhgc
cfhgc
.cfhgc
..cfhgc
...cfhgc
....cfhgc
.....cfhgc
......cfhgc
.......cfhgc
........cfhgc
.........cfhgc
..........cfhgc
...........cfhgc
............cfhgc
.............cfhgc
............cfhhgc
..........cfghhhgfc
........ccfggggggfcc
..........cccccccc
""")
BOLT_RESIDUE = piece(7, 10, """
..............bc
.............bcd
............bcd
...........bcd
..........bcd
.........bc

........................bc
.......................bcd
......................bcd
.....................bcd
....................bc

......bc
.....bcd
....bcd
...bcd
..bc

...................bc
..................bcd
.................bcd
................bc

.......bc
......bcd
.....bcd
....bc

........................bc
.......................bcd
......................bc

................bc
...............bcd
..............bc

.......bc....bc
......bcd...bcd
......bcdddddb
.......bcccb
""")
BOLT_EMBERS = piece(13, 40, """
......bc
.....bcd...............bc
......bc..............bcd
.......................bc

............bc
...........bcd
............bc

..bc.....................bc
.bcd....................bcd
..bc.....................bc

...........bccb
..........bcddcb
...........bccb
""")

HOLY_BREAK = piece(8, 17, """
............ccd.............d
...........cdefc...........def
..........cdeffc.........cdefc
..........cdeffc.........cdefc
...........cdefc..........cdec
............cc............cc
...................cdddc
.................cdefffedc
...............cdeffffffedc
......cdddc...cdeffffffffedc
.....cdeffedc.cdeffffffffedc
....cdefffedc.cdeffffffffedc
....cdefffedc..cdeffffffedc
.....cdeffedc...cdeffffedc
......cdddc......cdeeedc
.................ccdcc

.....cddc..................cddc
....cdefc.................cdefc
....cdefc.................cdefc
.....cdc...................cdc

................cddc
...............cdefc
................cdc
""")
HOLY_AFTER = piece(11, 30, """
......d......................d
.....def....................def
......d......................d

...............d
..............def
...............d

.d...........................d
def.........................def
.d...........................d

..............d
.............def
..............d
""")

# The two authored 32px wave tiles are assembled into a 128px background cel.
# Repeated tiles are layout, not independently drawn full-field pixels.
# Explicit corrected tile edges (32 symbols per row).
WAVE_A = piece(0, 0, """
aaaaaabbbbbbaaaaaaaabbbbbbaaaaaa
aaaabbcccccbbaaaabbcccccbbaaaaaa
aaabcccbbcccbbaaabcccbbcccbbaaaa
aabccbbabbcccbaabccbbabbcccbaaaa
abccbaaaabbccbabbccbaaaabbccbaaa
bccbaaaaaabccbbccbaaaaaabccbaaaa
bccbaaaaaabccbbccbaaaaaabccbaaaa
abccbaaaaabbccbabbccbaaaaabbccba
aabccbaaaabbccbaabccbaaaabbccbaa
aaabccbbabbcccbaaabccbbabbcccbaa
aaaabcccbbcccbbaaaabcccbbcccbbaa
aaaaabbcccccbbaaaaaabbcccccbbaaa
aaaaaaabbbbbbaaaaaaaabbbbbbaaaaa
aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa
aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa
aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa
aaaaaaabbbbbbaaaaaaaabbbbbbaaaaa
aaaaabbcccccbbaaaaaabbcccccbbaaa
aaaabcccbbcccbbaaaabcccbbcccbbaa
aaabccbbabbcccbaaabccbbabbcccbaa
aabccbaaaabbccbaabccbaaaabbccbaa
abccbaaaaabbccbabbccbaaaaabbccba
bccbaaaaaabccbbccbaaaaaabccbaaaa
bccbaaaaaabccbbccbaaaaaabccbaaaa
abccbaaaabbccbabbccbaaaabbccbaaa
aabccbbabbcccbaabccbbabbcccbaaaa
aaabcccbbcccbbaaabcccbbcccbbaaaa
aaaabbcccccbbaaaabbcccccbbaaaaaa
aaaaaabbbbbbaaaaaaaabbbbbbaaaaaa
aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa
aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa
aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa
""")
WAVE_B = piece(0, 0, """
aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa
aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa
aaaaaaaabbbbbbaaaaaaaabbbbbbaaaa
aaaaaabbcccccbbaaaabbcccccbbaaaa
aaaabcccbbcccbbaaabcccbbcccbbaaa
aaabccbbabbcccbaabccbbabbcccbaaa
aabccbaaaabbccbabbccbaaaabbccbaa
aabccbaaaaaabccbbccbaaaaaabccbaa
aabccbaaaaaabccbbccbaaaaaabccbaa
aabccbaaaaabbccbabbccbaaaaabbccb
aaaabccbaaaabbccbaabccbaaaabbccb
aaaaabccbbabbcccbaaabccbbabbcccb
aaaaaabcccbbcccbbaaaabcccbbcccbb
aaaaaaabbcccccbbaaaaaabbcccccbba
aaaaaaaabbbbbbaaaaaaaabbbbbbaaaa
aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa
aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa
aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa
aaaaaaaaabbbbbbaaaaaaaabbbbbbaaa
aaaaaaabbcccccbbaaaaaabbcccccbba
aaaaaabcccbbcccbbaaaabcccbbcccbb
aaaaabccbbabbcccbaaabccbbabbcccb
aaaabccbaaaabbccbaabccbaaaabbccb
aabccbaaaaabbccbabbccbaaaaabbccb
aabccbaaaaaabccbbccbaaaaaabccbaa
aabccbaaaaaabccbbccbaaaaaabccbaa
aabccbaaaabbccbabbccbaaaabbccbaa
aaabccbbabbcccbaabccbbabbcccbaaa
aaaabcccbbcccbbaaabcccbbcccbbaaa
aaaaaabbcccccbbaaaabbcccccbbaaaa
aaaaaaaabbbbbbaaaaaaaabbbbbbaaaa
aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa
""")
WAVE_PLACES = [(0,0),(32,0),(64,0),(96,0),(0,32),(32,32),(64,32),(96,32),
               (0,64),(32,64),(64,64),(96,64),(0,96),(32,96),(64,96),(96,96)]


def sequences():
    # Every changing silhouette is separately written above. Unchanged peak
    # exposures deliberately reuse the cel and are labelled as held poses.
    return {
      'mage_fire_burst': (64, FIRE, 'target', [
        ('붙는 불',60,[FIRE_SEED]),('솟는 갈래',60,[FIRE_RISE]),
        ('큰 화염',80,[placed(FIRE_PEAK,9,17)]),('갈래 전개',80,[FIRE_FORK]),
        ('갈라지는 화염',60,[FIRE_TEAR]),('내려앉는 불',60,[FIRE_FALL]),
        ('잔불',80,[FIRE_CINDERS]),('소멸',60,[])]),
      'mage_blizzard': (64, ICE, 'target', [
        ('발밑 결빙',80,[ICE_SEED]),('결정 성장',80,[ICE_GROW]),
        ('결정 최고점',100,[placed(ICE_PEAK,11,10)]),('균열',60,[ICE_SPLIT]),
        ('파쇄',60,[ICE_SHATTER]),('떨어지는 조각',80,[ICE_SHARDS]),
        ('녹는 잔광',80,[ICE_MELT]),('소멸',60,[])]),
      'mage_chain_bolt': (64, BOLT, 'target', [
        ('유도 전류',40,[BOLT_FIRST]),('낙뢰',60,[BOLT_PEAK]),
        ('끊긴 전류',40,[BOLT_RESIDUE]),('두 번째 낙뢰',60,[BOLT_SECOND]),
        ('잔전류',60,[BOLT_RESIDUE]),('발밑 방전',80,[BOLT_EMBERS]),('소멸',60,[])]),
      'cleric_holy_hit': (64, PEARL, 'target', [
        ('접촉',60,[placed(ORB,25,28)]),('큰 착탄',80,[HOLY_PEAK]),
        ('최고점 유지',80,[HOLY_PEAK]),('빛의 붕괴',60,[HOLY_BREAK]),
        ('잔광',80,[HOLY_AFTER]),('소멸',60,[])]),
      'monk_dragon_aura': (128, DRAGON, 'screen', [('소환체 유지',1400,DRAGON_BODY)]),
      'cleric_holy_field': (128, {'a':'#101b43','b':'#183367','c':'#24568a'}, 'screen', [
        ('물결 A',160,[placed(WAVE_A,x,y) for x,y in WAVE_PLACES]),
        ('물결 B',160,[placed(WAVE_B,x,y) for x,y in WAVE_PLACES])]),
    }


ORBIT_PLACES = [
  [(10,0),(36,3),(23,10)],[(8,4),(38,6),(24,13)],[(10,8),(36,9),(22,17)],
  [(14,12),(31,12),(18,21)],[(21,15),(24,16),(13,24)],[(29,18),(17,19),(9,27)],
  [(35,21),(11,23),(11,30)],[(38,24),(8,27),(17,33)],[(35,27),(11,30),(24,35)],
  [(29,30),(17,32),(31,36)],[(22,32),(24,33),(35,37)],[(15,34),(30,34),(32,38)],
]
# These are the authored front/back assignments for each orbit phase.
ORBIT_FRONT = [(0,2),(0,2),(0,2),(2,),(1,2),(1,2),(1,2),(1,),(0,1),(0,1),(0,1),(0,)]


def all_sequences():
    result = sequences()
    front, back = [], []
    for index, (positions, front_ids) in enumerate(zip(ORBIT_PLACES, ORBIT_FRONT)):
        front.append(('구슬 전면',90,[placed(ORB,*xy) for i,xy in enumerate(positions) if i in front_ids]))
        back.append(('구슬 후면',90,[placed(ORB,*xy) for i,xy in enumerate(positions) if i not in front_ids]))
    result['cleric_holy_orbs_front'] = (64,PEARL,'target',front)
    result['cleric_holy_orbs_back'] = (64,PEARL,'target',back)
    result['monk_dragon_hit'] = (64,PEARL,'target',[
      ('접촉',60,[placed(ORB,8,25),placed(ORB,36,33)]),
      ('파동 착탄',80,[HOLY_PEAK]),('갈라지는 빛',60,[HOLY_BREAK]),
      ('두 번째 착탄',80,[placed(HOLY_PEAK,8,22)]),('잔광',80,[HOLY_AFTER]),('소멸',60,[])])
    result['monk_dragon_wave'] = (128,{'a':'#102649','b':'#164372','c':'#2276a0'},'screen',[
      ('푸른 파동 A',160,[placed(WAVE_A,x,y) for x,y in WAVE_PLACES]),
      ('푸른 파동 B',160,[placed(WAVE_B,x,y) for x,y in WAVE_PLACES])])
    return result


def decode(size, palette, pieces):
    grid = [['.'] * size for _ in range(size)]
    for p in pieces:
        for dy, row in enumerate(p['rows']):
            assert p['y'] + dy < size, (p['y'], dy, size)
            assert p['x'] + len(row) <= size, (p['x'], len(row), size)
            for dx, symbol in enumerate(row):
                assert symbol == '.' or symbol in palette, symbol
                if symbol != '.':
                    grid[p['y'] + dy][p['x'] + dx] = symbol
    return [''.join(row) for row in grid]


def write(key, size, palette, cels, anchor='target'):
    doc = {'version': 1, 'width': size, 'height': size, 'maxColors': 16,
           'palette': palette, 'frames': []}
    for index, (phase, duration, pieces) in enumerate(cels):
        doc['frames'].append({'id': f'f{index:02}', 'phase': phase,
          'durationMs': duration, 'anchor': [size // 2, size // 2 if anchor == 'screen' else size - 8],
          'rows': decode(size, palette, pieces)})
    path = HERE / 'hand-authored' / f'{key}.study.px.json'
    path.write_text(json.dumps(doc, ensure_ascii=False, indent=2) + '\n')
    return path


def build():
    """Mechanical PNG packing and metadata; artwork is not edited here."""
    from hashlib import sha256
    REVIEW.mkdir(parents=True, exist_ok=True)
    before = REVIEW / 'before'
    before.mkdir(exist_ok=True)
    out = ROOT / 'public/assets/generated/pixel-fx'
    manifest = []
    for key, (size, palette, anchor, cels) in all_sequences().items():
        target = out / f'{key}.png'
        if target.exists() and not (before / target.name).exists():
            (before / target.name).write_bytes(target.read_bytes())
        source = write(key, size, palette, cels, anchor)
        doc = json.loads(source.read_text())
        sheet = Image.new('RGBA', (size * len(cels), size))
        for frame, cel in enumerate(doc['frames']):
            for y, row in enumerate(cel['rows']):
                for x, symbol in enumerate(row):
                    if symbol != '.':
                        rgb = palette[symbol]
                        sheet.putpixel((frame * size + x, y), tuple(int(rgb[k:k+2], 16) for k in (1, 3, 5)) + (255,))
        sheet.save(target)
        if key in ('cleric_holy_field', 'monk_dragon_wave'):
            for index in range(len(cels)):
                sheet.crop((index*size,0,(index+1)*size,size)).save(out / f'{key}-f{index}.png')
        manifest.append({'key':key, 'size':size, 'frames':len(cels),
          'durationsMs':[cel['durationMs'] for cel in doc['frames']],
          'sourceSha256':sha256(source.read_bytes()).hexdigest(),
          'assetSha256':sha256(target.read_bytes()).hexdigest(),
          'reviewStatus':'awaiting-user-review'})
    (REVIEW / 'manifest.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n')
    print(f'Packed {len(manifest)} authored layer sheets')


if __name__ == '__main__':
    import sys
    if '--install' in sys.argv:
        build()
    REVIEW.mkdir(parents=True, exist_ok=True)
    peaks = [('fire', 64, FIRE, [FIRE_PEAK]), ('ice', 64, ICE, [ICE_PEAK]),
             ('thunder', 64, BOLT, [BOLT_PEAK]), ('holy', 64, PEARL, [HOLY_PEAK]),
             ('summon', 128, DRAGON, DRAGON_BODY)]
    for name, size, palette, pieces in peaks:
        path = write(name + '_peak', size, palette, [('impact', 120, pieces)], 'screen' if size == 128 else 'target')
        rows = json.loads(path.read_text())['frames'][0]['rows']
        im = Image.new('RGBA', (size, size))
        for y, row in enumerate(rows):
            for x, symbol in enumerate(row):
                if symbol != '.':
                    rgb = palette[symbol]
                    im.putpixel((x, y), tuple(int(rgb[k:k+2], 16) for k in (1, 3, 5)) + (255,))
        im.save(REVIEW / (name + '-peak.png'))
        canvas = Image.new('RGBA', (size * 4, size * 4), '#151f36')
        canvas.alpha_composite(im.resize(canvas.size, Image.Resampling.NEAREST))
        canvas.save(REVIEW / (name + '-peak-4x.png'))
