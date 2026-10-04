import sys; sys.path.insert(0,'/tmp/j8v4')
import palette; palette.apply()
import room2 as room, kit as f
from PIL import Image
# inn: common room with the bar along the north wall (bottles on the wall behind it), the stair up in a side alcove,
# a kitchen behind a thick wall reached through a 3-row opening, the entrance vestibule at the bottom
P=["########################",
   "#..........###.........#",
   "#..........###.........#",
   "#..........###.........#",
   "#......................#",
   "#......................#",
   "#......................#",
   "#......................#",
   "#......................#",
   "#......................#",
   "###....................#",
   "###....................#",
   "###########...##########",
   "###########...##########"]
items=[(f.bottles(),2,1),(f.bottles(),3,1),(f.bottles(),5,1),(f.shelf_pots(),6,1),(f.bottles(),8,1),(f.barrel(),1,3),(f.barrel(),9,3),(f.barrel(),10,3),
 (f.counter(6,['mug','mug','bread','mug']),2,5),(f.stool(),3,6),(f.stool(),5,6),(f.stool(),7,6),
 (f.stairs_up(3),15,3),(f.fireplace(),20,3),(f.window(),18,1),(f.picture(),14,1),(f.clock(),22,3),
 (f.table(2,1),3,9),(f.bench(2),3,8),(f.bench(2),3,10),(f.roundtable(),9,8),(f.stool(),8,8),(f.stool(),10,8),
 (f.table(2,2,cloth=True),14,8),(f.chair('e'),13,8),(f.chair('w'),16,8),(f.chair('e'),13,9),(f.chair('w'),16,9),
 (f.roundtable(),20,7),(f.stool(),19,7),(f.stool(),21,7),(f.plant(),22,10),(f.plant(),4,11),(f.rug(3,2),18,5),
 (f.doormat(),12,13),(f.crate(),9,11),(f.sack(),10,11)]
im=room.compose(P,'plank','plaster',items,zones=[],lights=[(18,1)])
im.save('/tmp/j8v4/inn.png'); im.resize((im.width*3,im.height*3),Image.NEAREST).save('/tmp/j8v4/inn3.png')
