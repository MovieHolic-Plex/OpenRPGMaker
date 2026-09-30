# 10 interiors, v3: several rooms per building, staggered walls, things ON tables, animated hearths/tanks.
# plan: '#' solid, '.' inside. Two rows under any solid are wall face. A gap in an E-W partition is a doorway;
# a gap in an N-S partition must be 3 rows (2 face + 1 walkable).
import sys; sys.path.insert(0,'tiledata/hand-interior/v5')
from surf import *
import room3
def o(n):
    f=OBJ[n][1](); f.id=n; return f
R={}
R['pharmacy']=dict(name='약국 — 가게·조제실·약사 방',floor='plank',wall='plaster',plan=[
"##################",
"#......#.........#",
"#......#.........#",
"#......#.........#",
"#......#.........#",
"#......#.........#",
"###.######.#######",
"#................#",
"#................#",
"#................#",
"#................#",
"#................#",
"#................#",
"#................#",
"########..########",
"########..########"],items=[
 # 조제실 (north-west): drawers, a work table with the still and mortar, a cauldron in the corner
 (o('apothecary drawers'),1,3),(o('apothecary drawers'),2,3),(plain_worktable(),4,3,[('flask',0.15,1),('mortar',0.45,1),('herbbundle',0.72,0.6),('papers',0.85,1)]),
 (o('cabinet:jar+jarb+jarg'),6,3),(o('stool'),4,4),(o('cauldron'),1,5),(o('basket:herb'),2,5),(o('hang:herb'),3,1),(o('hang:mushroom'),4,1),
 # 약사 방 (north-east): bed, nightstand with candle and book, desk with papers under the window
 (o('bed green'),8,3),(nightstand(),9,3,[('candle',0.3,1),('book',0.75,1)]),(o('wardrobe'),11,3),(o('picture'),9,1),
 (plain_desk(),13,3,[('papers',0.15,1),('inkwell',0.35,0.8),('bookstack',0.62,1),('lamp',0.9,1)]),(o('chair N'),13,4),(o('window'),14,1),(o('coat rack'),16,3),(o('potted fern'),8,5),
 # 가게: shelves behind the counter, keeper walks in from the workroom door, customers from the street door
 (o('herb drying rack'),1,9),(o('herb drying rack'),2,9),(o('cabinet:potion+potionb+potiong'),5,9),(o('cabinet:vial+flask'),6,9),(o('apothecary drawers'),7,9),(o('cabinet:jar+jarb+jarg'),8,9),
 (o('hang:herb'),12,7),(o('hang:flower'),13,7),(o('picture'),15,7),
 (plain_counter(5),4,11,[('scale',0.12,1),('mortar',0.35,1),('smallflask',0.52,1),('cashbox',0.72,1),('bell',0.92,1)]),
 (tea_table(),14,10,[('teapot',0.35,1),('cup',0.75,1)]),(o('chair E'),13,10),(o('chair W'),15,10),(o('potted flowering'),16,9),
 (o('display potion'),1,12),(o('basket:flower'),1,13),(o('basket:herb'),2,13),(o('tall vase teal'),16,13),(o('doormat'),8,13)],lights=[(14,1)])
R['fish']=dict(name='생선가게 — 가게·손질터·냉장실',floor='flag',wall='stone',plan=[
"####################",
"#......#############",
"#......#############",
"#......#############",
"#......#############",
"#......#...........#",
"###.####...........#",
"#..................#",
"#..................#",
"#..................#",
"#..................#",
"#..................#",
"#..................#",
"#########..#########",
"#########..#########"],items=[
 # 냉장실 (north-west, cold, no window)
 (o('barrel:fish'),1,3),(o('crate:fish+ice'),2,3),(ice_chest(['fish','fishr','fish']),4,3),(o('barrel:squid'),6,3),(o('crate:crab'),1,5),(o('crate:shell'),5,5),(o('crate:fishg'),6,5),
 (o('hang:fish'),1,1),(o('hang:fishr'),4,1),
 # 손질터 (east, higher wall): gutting table with board and knife, block, water, tank for live fish
 (o('water jar'),8,7),(o('fish tank'),10,7),(plain_worktable('pine'),13,7,[('board',0.3,1),('knife',0.32,0.5),('fish',0.7,1),('fishr',0.62,0.55)]),(o('chopping block'),16,7),(o('quench barrel'),17,7),(o('barrel'),18,7),
 (o('fishing net'),8,5),(o('fishing net'),9,5),(o('hang:fishr'),12,5),(o('window'),16,5),
 # 가게: the iced chests are the counter; keeper stands behind them (from the cold room)
 (ice_chest(['fish','fishg','fishr']),2,10),(ice_chest(['squid','crab','shell']),4,10),(plain_counter(2),6,10,[('scale',0.3,1),('cashbox',0.8,1)]),
 (o('crate:squid'),13,11),(o('crate:fish'),12,11),(o('crate:fishr'),13,10),(o('barrel:fish'),8,11),(o('notice board'),10,5),(o('bench 2'),15,9),(o('barrel:crab'),16,11),(o('basket:shell'),17,11),(o('basket:fish'),18,12),(o('doormat'),9,12)],lights=[(16,5)])
R['bakery']=dict(name='빵집 — 가게·찻자리·굽는 방·창고',floor='plank',wall='plaster',plan=[
"####################",
"#........#.........#",
"#........#.........#",
"#........#.........#",
"#........#.........#",
"#........#.........#",
"#####.#######.######",
"#..................#",
"#..................#",
"#..................#",
"#..................#",
"#..................#",
"#..................#",
"#########..#########",
"#########..#########"],items=[
 # 굽는 방
 (o('bread oven'),1,3),(o('firewood pile'),3,3),(o('dough table'),5,3),(o('sack:grain'),7,3),(o('sack:grain'),8,3),(o('water jar'),8,5),(o('sack:grain'),1,5),
 (o('hanging pans'),4,1),(o('shelf:jar+jarb+jarg'),7,1),
 # 창고 + 위층 계단
 (o('stairs up wood'),10,3),(o('sack:grain'),15,3),(o('sack:grain'),16,3),(o('sack:grain'),15,4),(o('barrel'),17,3),(o('crate'),18,3),(o('crate'),18,4),(o('window'),16,1),
 # 가게: bread cabinets behind, counter + cake case, café tables on the east side
 (o('cabinet:loaf'),1,9),(o('cabinet:bun'),2,9),(o('cabinet:pie'),3,9),(o('cabinet:loaf'),7,9),(o('picture'),7,7),
 (o('cake display case'),1,11),(plain_counter(4),3,11,[('breadplate',0.15,1),('basket' if False else 'bun',0.4,1),('cashbox',0.65,1),('bell',0.9,1)]),(o('crate:loaf'),7,11),(o('crate:baguette'),8,11),
 (o('chair S'),12,9),(o('chair S'),13,9),(plain_table(2,1),12,10,[('cup',0.2,0.9),('breadplate',0.45,1),('teapot',0.75,1)]),(o('chair N'),12,11),(o('chair N'),13,11),
 (o('chair E'),15,10),(side_table(),16,10,[('cup',0.3,1),('pie' if False else 'bun',0.7,1)]),(o('chair W'),17,10),
 (o('potted flowering'),18,9),(o('basket:bun'),18,12),(o('doormat'),9,12)],lights=[(16,1)])
R['butcher']=dict(name='정육점 — 가게·냉장 창고',floor='flag',wall='stone',plan=[
"#################",
"#.........#.....#",
"#.........#.....#",
"#.........#.....#",
"#.........#.....#",
"#...............#",
"#...............#",
"#...............#",
"#.........#.....#",
"#.........#.....#",
"#.........#.....#",
"#.........#.....#",
"####..###########",
"####..###########"],items=[
 (o('meat hooks'),1,3),(plain_worktable(),3,3,[('board',0.25,1),('knife',0.27,0.5),('steak' if 'steak' in G else 'ham',0.6,1),('sausage',0.85,0.9)]),(o('chopping block'),5,4),
 (o('hang:sausage'),6,1),(o('hang:ham'),7,1),(o('window'),8,1),(o('cabinet:cheese'),9,3),
 (plain_counter(4),2,6,[('scale',0.15,1),('ham',0.45,1),('cashbox',0.75,1)]),(ice_chest(['steak','ham','sausage']),6,6),
 (o('basket:egg'),1,10),(o('basket:onion'),1,11),(o('crate:potato'),8,10),(o('crate:onion'),8,11),(o('potted fern'),9,9),
 # 냉장 창고 (east) through the 3-row opening
 (o('hang:ham'),11,1),(o('hang:ham'),12,1),(o('hang:sausage'),13,1),(o('barrel'),11,3),(ice_chest(['ham','steak','ham']),12,3),(o('crate'),15,3),
 (o('barrel'),11,11),(o('sack:grain'),15,10),(o('crate'),15,11),(o('crate'),14,11)],lights=[(8,1)])
R['smithy']=dict(name='대장간 — 작업장·가게·대장장이 방',floor='flag',wall='stone',plan=[
"####################",
"#..........#.......#",
"#..........#.......#",
"#..........#.......#",
"#..........#.......#",
"#..........#.......#",
"#..........####.####",
"#..........#.......#",
"#..................#",
"#..................#",
"#..................#",
"#..........#.......#",
"#..........#.......#",
"##############..####",
"##############..####"],items=[
 (o('forge'),2,3),(o('firewood pile'),1,3),(o('anvil'),3,5),(o('quench barrel'),5,5),(o('grindstone'),7,4),(o('weapon barrel'),10,3),(o('crate'),10,4),
 (o('tool wall'),5,1),(o('tool wall'),6,1),(o('shelf:ingot+ingotg'),7,1),(o('window'),9,1),
 (plain_worktable(),1,8,[('tongs',0.2,1),('horseshoe',0.45,1),('ingot',0.7,1),('hammer',0.9,1)]),(o('barrel'),1,11),(o('crate'),2,11),(o('crate'),2,12),(o('stool'),4,9),(plain_worktable('dwood'),6,8,[('dagger',0.3,1),('hammer',0.7,1)]),(o('stool'),6,9),(o('armor stand'),9,8),(o('weapon barrel'),8,11),(o('crate'),9,12),
 # 가게 (south-east)
 (o('weapon rack'),12,7),(o('weapon rack'),13,7),(o('shield'),14,7),(o('shield'),16,7),(o('weapon rack'),17,7),
 (o('weapon barrel'),12,9),(plain_counter(3),15,10,[('dagger',0.2,1),('cashbox',0.6,1),('bell',0.9,1)]),(o('armor stand'),18,12),(o('armor stand'),17,12),(o('weapon barrel'),12,12),
 # 대장장이 방 (north-east)
 (o('bed green'),12,3),(nightstand(),13,3,[('candle',0.5,1)]),(o('chest'),14,3),(o('window'),16,1),(o('coat rack'),18,3),(o('chair E'),16,4),(side_table(),17,4,[('beer',0.35,1),('breadplate',0.75,1)])],lights=[(9,1),(16,1)])
R['chapel']=dict(name='예배당 — 회중석·제단·제의실',floor='check',wall='stone',plan=[
"###################",
"#####.........#...#",
"#####.........#...#",
"#####.........#...#",
"#####.........#...#",
"#####.........##.##",
"#.................#",
"#.................#",
"#.................#",
"#.................#",
"#.................#",
"#.................#",
"#.................#",
"#.................#",
"#.................#",
"#.................#",
"########...########",
"########...########"],items=[
 (altar(),8,3,[('candle',0.1,1),('openbook',0.5,0.9),('candle',0.9,1)]),(o('candelabra'),6,3),(o('candelabra'),11,3),(o('pipe organ'),12,3),(o('lectern'),6,5),
 (o('stained glass'),7,1),(o('stained glass'),10,1),(o('banner red'),5,1),
 (o('stained glass'),2,6),(o('banner blue'),4,6),(o('stained glass'),16,6),(o('banner red'),14,6),
 (o('runner'),9,6),(o('runner'),9,9),(o('runner'),9,12),
 (o('pew'),3,8),(o('pew'),5,8),(o('pew'),12,8),(o('pew'),14,8),(o('pew'),3,10),(o('pew'),5,10),(o('pew'),12,10),(o('pew'),14,10),(o('pew'),3,12),(o('pew'),5,12),(o('pew'),12,12),(o('pew'),14,12),
 (o('candelabra'),1,8),(o('candelabra'),17,8),(o('holy water font'),7,14),(o('holy water font'),11,14),(o('potted fern'),1,15),(o('potted fern'),17,15),
 # 제의실
 (o('wardrobe'),15,3),(o('chest'),17,3),(o('candle'),17,4),(o('coat rack'),15,4)],lights=[(7,1),(10,1)])
R['library']=dict(name='학자의 집 — 서가·서재·침실',floor='dplank',wall='plaster',plan=[
"####################",
"#.......#..........#",
"#.......#..........#",
"#.......#..........#",
"#.......#..........#",
"#.......#####..#####",
"#..................#",
"#..................#",
"#..................#",
"#..................#",
"#..................#",
"####..##############",
"####..##############"],items=[
 (o('bookshelf 3w'),1,3),(o('bookshelf 3w'),4,3),(o('scroll rack'),7,3),
 (o('round rug'),1,6),(o('armchair'),1,6),(side_table(),2,7,[('lamp',0.3,1),('openbook',0.75,1)]),(o('armchair'),3,6),(o('globe'),6,6),(o('chest'),1,10),(o('potted fern'),7,10),
 # 침실 (north-east)
 (o('bed blue'),9,3),(nightstand(),10,3,[('candle',0.3,1),('book',0.75,1)]),(o('wardrobe'),12,3),(dresser(),15,3,[('vase',0.5,1)]),(o('window'),16,1),(o('coat rack'),18,3),(o('picture'),9,1),
 # 서재 (south-east)
 (o('bookshelf 2w'),9,8),(o('purple rug'),13,9),(plain_desk(),13,8,[('papers',0.12,1),('inkwell',0.3,0.8),('openbook',0.55,1),('bookstack',0.78,1),('lamp',0.95,1)]),(o('chair N'),13,9),
 (o('wall clock'),12,6),(o('wall map'),14,6),(o('window'),16,6),(o('telescope'),17,8),(o('spellbook stand'),18,9),(o('crystal ball'),18,10),(o('globe'),11,10)],lights=[(16,1),(16,6)])
R['tailor']=dict(name='재단사 — 가게·탈의실·작업실',floor='plank',wall='plaster',plan=[
"##################",
"#.....#..........#",
"#.....#..........#",
"#.....#..........#",
"#.....#..........#",
"#.....#..........#",
"###.#####..#######",
"#................#",
"#................#",
"#................#",
"#................#",
"#................#",
"#######..#########",
"#######..#########"],items=[
 (o('tailor mirror'),1,3),(o('coat rack'),5,3),(o('bench 2'),1,5),(o('picture'),2,1),
 (o('loom'),7,3),(o('spinning wheel'),9,3),(o('shelf:yarn+yarnb+yarny'),12,1),(o('window'),14,1),(o('fabric bolt rack'),13,3),(o('fabric bolt rack'),14,3),
 (plain_worktable('wood'),15,4,[('clothfold',0.2,1),('scissors',0.5,1),('spools',0.8,1)]),(o('chair N'),15,5),(o('basket:yarn+yarnb+yarny'),12,5),(o('basket:wool'),13,5),(o('mannequin'),16,3),
 (o('cabinet:bolt+boltg+boltr'),1,9),(o('fabric bolt rack'),2,9),(o('mannequin'),5,9),(o('mannequin'),6,9),(o('mannequin'),12,9),(o('banner green'),14,7),(o('picture'),16,7),
 (o('green rug'),3,10),(o('armchair'),1,11),(plain_counter(3),13,11,[('clothfold',0.2,1),('scissors',0.5,1),('cashbox',0.85,1)]),(o('potted flowering'),16,9)],lights=[(14,1)])
R['tavern']=dict(name='선술집 — 홀·바·부엌·위층 계단',floor='plank',wall='log',plan=[
"######################",
"#.......#............#",
"#.......#............#",
"#.......#............#",
"#.......#............#",
"#.......#............#",
"###.#####............#",
"#....................#",
"#....................#",
"#....................#",
"#....................#",
"#....................#",
"#....................#",
"#....................#",
"##########..##########",
"##########..##########"],items=[
 # 부엌
 (o('stove'),1,3),(o('kitchen sink'),2,3),(plain_worktable('pine'),4,3,[('board',0.2,1),('knife',0.22,0.5),('bowl',0.55,1),('breadplate',0.85,1)]),(o('water jar'),6,3),(o('firewood pile'),7,3),
 (o('hanging pans'),4,1),(o('dish rack'),5,1),(o('sack:grain'),1,5),(o('barrel'),7,5),
 # 바
 (o('keg rack'),1,9),(o('bottles'),4,7),(o('bottles'),5,7),(o('shelf:bottle+bottler+bottley'),6,7),(o('cabinet:bottle+bottler+bottley'),6,9),
 (plain_counter(6),1,11,[('beer',0.08,1),('wineglass',0.25,1),('beer',0.42,1),('breadplate',0.62,1),('mug',0.8,1),('cashbox',0.95,1)]),
 (o('bar stool'),1,12),(o('bar stool'),3,12),(o('bar stool'),5,12),
 # 홀
 (o('stairs up wood'),9,3),(o('piano'),13,3),(o('stool'),13,4),(o('firewood pile'),16,3),(o('fireplace'),17,3),(o('fur rug'),16,5),(o('armchair'),16,5),(o('armchair'),18,5),
 (o('lute'),12,1),(o('dart board'),15,1),(o('deer trophy'),17,1),(o('window'),20,1),
 (o('chair S'),9,7),(o('chair S'),10,7),(plain_table(2,1),9,8,[('beer',0.15,1),('fishplate',0.45,1),('breadplate',0.75,1),('beer',0.92,0.8)]),(o('chair N'),9,9),(o('chair N'),10,9),
 (o('chair E'),13,8),(side_table(),14,8,[('beer',0.3,1),('cards',0.7,1)]),(o('chair W'),15,8),
 (o('bench 2'),17,9),(plain_table(2,1),17,10,[('soup',0.25,1),('beer',0.55,1),('breadplate',0.85,1)]),(o('bench 2'),17,11),
 (o('chair E'),12,12),(side_table(),13,12,[('dice',0.4,1),('beer',0.8,1)]),(o('chair W'),14,12),
 (o('barrel'),20,12),(o('barrel'),20,13),(o('doormat'),10,13)],lights=[(20,1)])
R['manor']=dict(name='저택 — 침실·욕실·거실',floor='dplank',wall='plaster',plan=[
"####################",
"#..........#.......#",
"#..........#.......#",
"#..........#.......#",
"#..........#.......#",
"#..........#.......#",
"#..........###.#####",
"#..................#",
"#..................#",
"#..................#",
"#..................#",
"#..................#",
"#..................#",
"#####..#############",
"#####..#############"],items=[
 (o('wardrobe'),1,3),(o('curtained window'),2,1),(nightstand(),3,3,[('lamp',0.35,1),('book',0.8,1)]),(o('canopy bed'),4,3),(nightstand(),6,3,[('candle',0.3,1),('vase',0.7,1)]),
 (o('curtained window'),7,1),(dresser(),8,3,[('vase',0.3,1),('bottler' if 'bottler' in G else 'bottle',0.75,1)]),(o('vanity mirror'),9,3),(o('tall vase red'),10,3),
 (o('purple rug'),4,6),(o('chest'),4,5) if False else (o('royal chest'),5,5),
 (o('armchair'),1,8),(tea_table(),2,8,[('teapot',0.35,1),('cup',0.75,1)]),(o('armchair'),3,8),(o('cradle'),9,6),(plain_desk(),6,9,[('papers',0.2,1),('inkwell',0.4,0.8),('candle',0.8,1)]),(o('chair N'),6,10),(o('tall vase blue'),1,12),(o('potted flowering'),10,12),
 # 욕실
 (o('bathtub'),12,3),(o('washbasin'),15,3),(o('coat rack'),17,3),(o('water jar'),18,4),(o('potted fern'),18,5),(o('wall sconce'),13,1),
 # 거실
 (o('bookshelf 2w'),12,9),(o('picture'),16,7),(o('fireplace'),17,9),(o('sofa'),14,10),(tea_table(),14,11,[('teapot',0.3,1),('cup',0.7,1)]),(o('armchair'),16,11),(o('round rug'),13,11) if False else (o('candelabra'),12,11)],lights=[(2,1),(7,1)])
def render_all(keys=None):
    import os
    for k in keys or R:
        r=R[k]; f0=room3.animate(r,f'tiledata/hand-interior/v5/v3_{k}.webp',2)
        room3.compose(r['plan'],r['floor'],r['wall'],r['items'],(),r.get('lights',())).save(f'tiledata/hand-interior/v5/v3_{k}.png')
if __name__=='__main__':
    render_all(sys.argv[1:] or None)
