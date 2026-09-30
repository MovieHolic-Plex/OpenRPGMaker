# 10 new interiors + the 3 earlier ones re-dressed. One wall material per building (user: wood + brick mixed looks wrong);
# zones only change the FLOOR.
import sys; sys.path.insert(0,'/tmp/j8v5')
import objs3 as O, kit, room2
from PIL import Image
def o(n): return O.OBJ[n][1]()
def box(W,H,door):
    rows=['#'*W]+['#'+'.'*(W-2)+'#' for _ in range(H-3)]
    d=['#'*door+'..'+'#'*(W-door-2)]*2
    return rows+d
R={}
C=kit.counter
R['pharmacy']=dict(name='약국',plan=box(14,11,6),floor='plank',wall='plaster',items=[
 (o('apothecary drawers'),1,3),(o('apothecary drawers'),2,3),(o('apothecary drawers'),3,3),(o('cabinet:potion+potionb+potiong'),4,3),(o('alembic'),5,3),(o('cauldron'),7,3),
 (o('herb drying rack'),9,3),(o('herb drying rack'),10,3),(o('cabinet:vial+flask'),12,3),
 (o('shelf:potion+potionb+potiong'),5,1),(o('shelf:vial+flask'),6,1),(o('hang:herb'),7,1),(o('hang:mushroom'),8,1),(o('window'),11,1),
 (o('balance scale'),8,4),(o('mortar and pestle'),11,4),(C(5,['scale','book','mug']),3,5),(o('cabinet:jar+jarb+jarg'),12,4) if False else (o('potted fern'),12,5),
 (o('display potion'),1,6),(o('basket:herb'),1,7),(o('round rug'),5,7),(o('tea table'),10,7),(o('chair E'),9,7),(o('chair W'),11,7),
 (o('basket:flower'),12,8),(o('basket:mushroom'),1,8),(o('tall vase teal'),12,7) if False else (o('potted flowering'),2,8)],lights=[(11,1)])
R['fish']=dict(name='생선가게',plan=box(15,11,7),floor='flag',wall='stone',items=[
 (o('fish tank'),1,3),(o('barrel:fish'),3,3),(o('barrel:squid'),4,3),(o('chopping block'),6,4),(o('crate:fish+ice'),9,3),(o('crate:fishr'),10,3),(o('water jar'),13,3),(o('barrel:shell'),12,3),
 (o('hang:fish'),5,1),(o('hang:fishr'),6,1),(o('fishing net'),7,1),(o('fishing net'),8,1),(o('window'),11,1),
 (o('fish ice chest'),2,5),(o('fish ice chest'),4,5),(C(2,['scale']),6,5),(o('fish ice chest'),8,5),
 (o('crate:squid'),1,7),(o('crate:crab'),2,7),(o('crate:fishg'),1,8),(o('barrel:crab'),12,6),(o('basket:fish'),13,6),(o('basket:shell'),13,7),(o('crate:fish'),12,8),(o('crate:shell'),13,8),
 (o('fish ice chest'),9,7),(o('barrel'),4,8)],lights=[(11,1)])
R['bakery']=dict(name='빵집',plan=box(15,11,7),floor='plank',wall='plaster',items=[
 (o('bread oven'),1,3),(o('cabinet:loaf'),3,3),(o('cabinet:bun'),4,3),(o('cabinet:pie'),5,3),(o('dough table'),7,3),(o('sack:grain'),10,3),(o('sack:flour'),11,3),(o('water jar'),13,3),(o('sack:grain'),10,4),
 (o('hanging pans'),9,1),(o('picture'),7,1),(o('window'),12,1),(o('shelf:jar+jarb+jarg'),6,1),
 (o('cake display case'),2,5),(C(3,['bread','bread']),4,5),(o('basket:loaf'),8,5),
 (o('crate:loaf'),1,7),(o('crate:baguette'),1,8),(o('crate:bun'),2,8),(o('basket:bun'),10,6),(o('basket:pie'),11,6),(o('basket:cake'),10,8) if False else (o('crate:pie'),13,6),
 (o('roundtable'),11,8),(o('chair E'),10,8),(o('chair W'),12,8),(o('potted flowering'),13,8),(o('runner'),7,7) if False else (o('rug red'),4,7) if False else (o('doormat'),7,8)],lights=[(12,1)])
R['butcher']=dict(name='정육점',plan=box(13,11,6),floor='flag',wall='stone',items=[
 (o('meat hooks'),1,3),(o('chopping block'),3,4),(o('fish ice chest'),5,3),(o('table:steak+ham'),8,3),(o('cabinet:cheese'),10,3),(o('barrel'),11,3),
 (o('hang:sausage'),5,1),(o('hang:ham'),6,1),(o('hang:sausage'),7,1),(o('window'),10,1),
 (C(4,['scale']),4,5),(o('hang:onion'),3,1),
 (o('basket:egg'),1,7),(o('basket:onion'),1,8),(o('crate:potato'),11,7),(o('crate:onion'),11,8),(o('crate:cabbage'),10,8),(o('potted fern'),11,5),(o('barrel'),1,6)],lights=[(10,1)])
R['smithy']=dict(name='대장간',plan=box(15,11,7),floor='flag',wall='stone',items=[
 (o('forge'),2,3),(o('firewood pile'),1,3),(o('anvil'),3,5),(o('quench barrel'),2,5),(o('grindstone'),5,4),
 (o('tool wall'),5,1),(o('tool wall'),6,1),(o('shelf:ingot+ingotg'),7,1),(o('weapon rack'),8,1),(o('weapon rack'),9,1),(o('shield'),10,1),(o('window'),12,1),
 (o('armor stand'),10,3),(o('armor stand'),11,3),(o('weapon barrel'),12,3),(o('chest'),13,3),
 (C(4,['scale']),8,6),(o('weapon barrel'),1,8),(o('crate'),2,8),(o('barrel'),1,7),(o('royal chest'),13,8),(o('weapon barrel'),13,6),(o('armor stand'),12,7) if False else (o('crate'),12,8)],lights=[(12,1)])
R['chapel']=dict(name='예배당',plan=box(16,13,7),floor='check',wall='stone',items=[
 (o('altar'),7,3),(o('candelabra'),5,3),(o('candelabra'),10,3),(o('pipe organ'),13,3),(o('lectern'),6,5),
 (o('stained glass'),2,1),(o('stained glass'),4,1),(o('stained glass'),11,1),(o('banner red'),1,1),(o('banner blue'),14,1) if False else (o('banner blue'),6,1),
 (o('runner'),7,6),(o('runner'),8,6),(o('runner'),7,9) if False else (o('pew'),1,6),(o('pew'),3,6),(o('pew'),10,6),(o('pew'),12,6),(o('pew'),1,8),(o('pew'),3,8),(o('pew'),10,8),(o('pew'),12,8),
 (o('holy water font'),5,10),(o('holy water font'),10,10),(o('potted fern'),1,10),(o('potted fern'),14,10),(o('candle'),1,4),(o('candle'),14,5)],lights=[(2,1),(4,1),(11,1)])
R['library']=dict(name='서재',plan=box(14,11,6),floor='dplank',wall='plaster',items=[
 (o('bookshelf 3w'),1,3),(o('bookshelf 2w'),4,3),(o('scroll rack'),6,3),(o('bookshelf 2w'),9,3),(o('globe'),11,3),(o('telescope'),12,3),
 (o('wall sconce'),7,1),(o('wall map'),8,1),(o('window'),11,1),(o('wall clock'),12,1),
 (o('purple rug'),6,5),(o('writing desk'),6,5),(o('chair N'),6,6),(o('candle'),8,5) if False else (o('chest'),8,6),
 (o('round rug'),1,6),(o('armchair'),1,6),(o('tea table'),2,7),(o('armchair'),3,6),(o('spellbook stand'),11,5),(o('crystal ball'),12,5),
 (o('bookshelf 1w'),12,7) if False else (o('potted sapling'),12,8),(o('cabinet:book+bookb+bookg'),1,8) if False else (o('scroll rack'),1,8) if False else (o('potted fern'),1,8)],lights=[(11,1)])
R['tailor']=dict(name='재단사',plan=box(14,11,6),floor='plank',wall='plaster',items=[
 (o('fabric bolt rack'),1,3),(o('fabric bolt rack'),2,3),(o('mannequin'),3,3),(o('loom'),5,3),(o('spinning wheel'),8,3),(o('cabinet:bolt+boltg+boltr'),10,3),(o('tailor mirror'),12,3),
 (o('shelf:yarn+yarnb+yarny'),4,1),(o('shelf:bolt+boltg+boltr'),5,1),(o('window'),10,1),(o('picture'),7,1),
 (o('sewing table'),7,5),(o('chair N'),8,6),(C(3,['book']),2,5),(o('mannequin'),11,5),(o('mannequin'),12,5),
 (o('basket:yarn+yarnb+yarny'),1,7),(o('basket:wool'),1,8),(o('green rug'),9,7),(o('potted flowering'),12,8),(o('armchair'),10,7)],lights=[(10,1)])
R['tavern']=dict(name='선술집',plan=box(18,12,8),floor='plank',wall='log',items=[
 (o('keg rack'),1,3),(o('keg rack'),3,3),(o('piano'),8,3),(o('firewood pile'),14,3),(o('fireplace'),15,3),
 (o('bottles'),5,1),(o('bottles'),6,1),(o('shelf:bottle+bottler+bottley'),7,1),(o('dart board'),11,1),(o('lute'),12,1),(o('deer trophy'),10,1),(o('window'),13,1),
 (C(6,['mug','mug','bread','mug']),1,5),(o('bar stool'),1,6),(o('bar stool'),3,6),(o('bar stool'),5,6),
 (o('fur rug'),13,5),(o('armchair'),13,5),(o('armchair'),15,5),
 (o('table:mug+bottle'),8,6),(o('bench 2'),8,5),(o('bench 2'),8,7),(o('roundtable'),12,8),(o('stool'),11,8),(o('stool'),13,8),
 (o('table 2x1'),2,8),(o('chair S'),2,7) if False else (o('bench 2'),2,9),(o('barrel'),16,9),(o('barrel'),16,8),(o('crate'),1,9) if False else (o('potted fern'),6,9)],lights=[(13,1)])
R['manor']=dict(name='저택 침실',plan=box(15,11,7),floor='dplank',wall='plaster',items=[
 (o('vanity mirror'),1,3),(o('wardrobe'),2,3),(o('wardrobe'),3,3),(o('nightstand lamp'),5,3),(o('canopy bed'),6,3),(o('nightstand lamp'),8,3),
 (o('royal chest'),10,3),(o('tall vase red'),11,3),(o('washbasin'),13,3),
 (o('curtained window'),10,1),(o('curtained window'),12,1),(o('picture'),2,1) if False else (o('wall sconce'),9,1),
 (o('round rug'),1,6),(o('armchair'),1,6),(o('tea table'),2,7),(o('armchair'),3,6),(o('runner'),7,5) if False else (o('purple rug'),6,6),
 (o('sofa'),10,6),(o('tea table'),10,7),(o('tea table'),11,7) if False else (o('cradle'),13,6),(o('potted flowering'),13,8),(o('tall vase blue'),1,8),(o('bathtub'),10,8) if False else (o('chest'),4,8)],lights=[(10,1),(12,1)])
def render(key,scale=3):
    r=R[key]; im=room2.compose(r['plan'],r['floor'],r['wall'],r['items'],zones=r.get('zones',()),lights=r.get('lights',()))
    im.save(f'/tmp/j8v5/room_{key}.png'); im.resize((im.width*scale,im.height*scale),Image.NEAREST).save(f'/tmp/j8v5/room_{key}3.png'); return im
if __name__=='__main__':
    for k in (sys.argv[1:] or R): render(k)
