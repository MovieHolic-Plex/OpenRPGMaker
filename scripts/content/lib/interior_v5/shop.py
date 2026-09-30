import sys; sys.path.insert(0,'/tmp/j8v5')
import palette; palette.apply()
import room2 as room, kit as f
from PIL import Image
# item & weapon shop: shelves on the north wall behind a counter that runs across the room with a gap for the keeper,
# a storeroom behind a partition (stairs down to the cellar), display cases on the customer side, a notch by the door
P=["###################",
   "#..........##.....#",
   "#..........##.....#",
   "#..........##.....#",
   "#.................#",
   "#.................#",
   "#.................#",
   "#.................#",
   "#.................#",
   "####..............#",
   "####..............#",
   "#########..########",
   "#########..########"]
items=[(f.bookshelf(2),1,3),(f.cupboard(),3,3),(f.bottles(),5,1),(f.bottles(),6,1),(f.shelf_pots(),7,1),(f.weapon_rack(),8,1),(f.weapon_rack(),9,1),(f.shield(),10,1),
 (f.barrel(),5,3),(f.crate(),6,3),(f.counter(6,['scale','book','mug']),1,6),(f.counter(3,[]),8,6),
 (f.window(),14,1),(f.crate(),13,3),(f.crate(),14,3),(f.sack(),16,3),(f.barrel(),17,3),(f.stairs_down(),15,5),(f.barrel(),13,4),
 (f.display('potion'),5,8),(f.display('apple'),7,8),(f.display('bread'),9,8),(f.plant(),17,10),(f.plant(),4,10),(f.stool(),12,8),(f.doormat(),9,12)]
im=room.compose(P,'flag','grey',items,zones=[(12,0,18,6,'plank',None)],lights=[(14,1)])
im.save('/tmp/j8v5/shop.png'); im.resize((im.width*3,im.height*3),Image.NEAREST).save('/tmp/j8v5/shop3.png')
