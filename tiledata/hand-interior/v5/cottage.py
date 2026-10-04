import sys; sys.path.insert(0,'tiledata/hand-interior/v5')
import palette; palette.apply()
import room2 as room, kit as f
from PIL import Image
# cottage: living room (west), bedroom alcove behind a stub partition (north-east), kitchen under its own wall (south-east)
# rule: a passage through a thick wall needs 3 rows (2 wall-face rows above + 1 floor row) or the wall must stop short
P=["#####################",
   "#.........##........#",
   "#.........##........#",
   "#.........##........#",
   "#...................#",
   "#...................#",
   "#...................#",
   "#.......#############",
   "#...................#",
   "#...................#",
   "#...................#",
   "#...................#",
   "#######..############",
   "#######..############"]
items=[(f.stairs_up(3,"wood"),1,3),(f.fireplace(),5,3),(f.window(),4,1),(f.clock(),9,3),(f.picture(),8,1),
 (f.bed('red'),12,3),(f.window(),15,1),(f.cupboard(),18,3),(f.wardrobe(),19,3),(f.picture(),17,1),(f.chest(),13,3),(f.plant(),19,6),
 (f.rug(3,2),4,5),(f.table(2,1),3,9),(f.chair('s'),3,8),(f.chair('s'),4,8),(f.chair('n'),3,10),(f.chair('n'),4,10),(f.pot(),1,11),(f.barrel(),1,10),
 (f.stove(),9,10),(f.counter(3,['bread','mug']),11,10),(f.shelf_pots(),10,8),(f.shelf_pots(),13,8),(f.bottles(),16,8),
 (f.barrel(),15,10),(f.sack(),16,10),(f.crate(),19,11),(f.stairs_down(),19,10),(f.table(2,1),13,11)]
items=[t for t in items if not (t[1]==19 and t[2]==11)]
im=room.compose(P,'plank','plaster',items,zones=[(9,7,20,11,'flag',None)],lights=[(4,1),(15,1)])
im.save('tiledata/hand-interior/v5/cottage.png'); im.resize((im.width*3,im.height*3),Image.NEAREST).save('tiledata/hand-interior/v5/cottage3.png')
