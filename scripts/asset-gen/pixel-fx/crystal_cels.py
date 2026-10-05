"""Three authored facet cuts and authored debris placements, no rotated polygons."""
def p(x,y,rows):return {'x':x,'y':y,'rows':rows.strip('\n').splitlines()}
def at(part,x,y):return {'x':x,'y':y,'rows':part['rows']}

PAL={'a':'#182b57','b':'#284d86','c':'#337bae','d':'#56bad2',
     'e':'#a3e9ed','f':'#e4fff6','g':'#ffffff','h':'#6577b3'}

TALL=p(0,0,"""
......g
.....gfe
....gfeed
...gffeeec
..gffffeedc
.gffffeeedcb
gfffgeeeedcba
gffgeeeeddcba
gfgeeeedddcba
gfeeeedddccba
geeeedddcccba
geeedddccccba
feedddccccba
eedddccccba
eddccccba
ddcccba
ccba
ba
""")
SQUARE=p(0,0,"""
.....fg
...efffg
..effffedc
.effffeedcba
effffeeeddcba
fffgeeeeddcba
ffgeeeeddcba
fgeeeeddccba
geeeeddcccba
feedddccchba
.eddcccchba
..dcccchba
...cchba
....ba
""")
SLANT=p(0,0,"""
...........fg
.........efffg
.......effffedca
.....effffeeedcba
...effffeeeedccba
.effffeeeeedcccba
effffeeeedccccba
ffgeeeedccccba
fgeeeedcccba
geeeeddcba
eeddccba
dccba
ba
""")
SMALL=p(0,0,"""
...fg
..effdc
.effedca
effedcba
feedccba
eddccba
dccba
ba
""")
SEED=p(18,46,"""
........f
.......efd
.......fdcb
........cb
..f...............g
.efc.............fed
effcb...........edcb
.dcba............cba
""")
MIST=p(9,47,"""
....cd..............de
..bcdddc...........cdeedc
.bcdddccb.........bcdeeddcb
bcddcccba.........bcdddccba
.bccba.............bccba
""")

def sequence():
 return 64,PAL,'allTargets',[
  ('서리가 모임',80,[SEED,MIST]),
  ('결정이 돋음',80,[at(TALL,21,33),at(SMALL,9,39),at(SLANT,32,39)]),
  ('결정이 뒤엉킴',100,[at(SQUARE,5,32),at(TALL,20,13),at(SLANT,39,21),at(SQUARE,29,34),at(SMALL,10,50),at(TALL,43,42)]),
  ('파쇄',60,[at(SQUARE,1,23),at(TALL,18,8),at(SLANT,42,14),at(SQUARE,28,31),at(SMALL,5,43),at(TALL,48,38)]),
  ('파편이 퍼짐',60,[at(SMALL,2,25),at(TALL,16,4),at(SLANT,44,11),at(SQUARE,29,34),at(SMALL,6,47),at(SMALL,51,43)]),
  ('파편 낙하',80,[at(SMALL,3,35),at(SMALL,17,26),at(SLANT,43,27),at(SMALL,31,42),at(SMALL,8,52),at(SMALL,53,50)]),
  ('서리 잔광',80,[at(SMALL,9,53),at(SMALL,46,54),MIST]),
  ('소멸',60,[])]
