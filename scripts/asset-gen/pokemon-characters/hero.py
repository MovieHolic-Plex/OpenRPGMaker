"""Original 16x32 hero: explicit native clusters and separately authored gait poses."""
from pixels import Pixels

PALETTE={
 'o':'303340','h':'483934','H':'71544b',
 'r':'9f4248','R':'df6256','a':'f49470',
 'w':'eee4c8','v':'a7b6b1','s':'f0c29b','t':'cf9879',
 'p':'628fa4','q':'365366','b':'a87948','g':'d7b46b','d':'253343'
}
# An x coordinate and row text are authored together. No implicit centering.
HEAD={
 'down':[(4,'oooooooo'),(3,'orRRRRrrro'),(2,'orRaaRRRRrro'),
         (2,'oRRRRRRRRrro'),(2,'ohrrRRRRrrho'),(1,'ohhrwwwwwwrhho'),
         (2,'ohstssssstho'),(2,'otsossssosto'),(3,'otssssssto'),(4,'otssssto')],
 'up':[(4,'oooooooo'),(3,'orRRRRrrro'),(2,'orRaaRRRRrro'),
       (2,'oRRRRRRRRrro'),(2,'ohrrrrrrrrho'),(1,'ohhrrwwrrrhhho'),
       (2,'ohHHHhhhhHho'),(3,'ohHHhhhhho'),(4,'ohHHhhho'),(4,'ohhtthho')],
 'right':[(4,'ooooooo'),(3,'orRRRRrro'),(2,'orRaaRRRrro'),
          (2,'oRRRRRRRRrro'),(2,'ohrrrrrRRrrro'),(2,'ohHhrrwwwwro'),
          (3,'ohHhtsssto'),(4,'ohtssosto'),(5,'otssssto'),(5,'ohtttqo')],
 'left':[(5,'ooooooo'),(4,'orrRRRRro'),(3,'orrRRRaaRro'),
         (2,'orrRRRRRRRRo'),(1,'orrrRRrrrrrho'),(2,'orwwwwrrhHho'),
         (3,'otsssthHho'),(3,'otsosstho'),(3,'otssssto'),(4,'oqtttho')]
}
# Six-row torso/hip poses. Arms belong to shoulder clusters; no generated lines.
BODY={
 'down':{
  1:[(3,'ovqpwwpqvo'),(2,'owqppwwppqwo'),(2,'osqppwwppqso'),(2,'ottppwwpptto'),(3,'oqppppppqo'),(4,'oqqddqqo')],
  0:[(3,'ovqpwwpqvo'),(2,'owqppwwppqwo'),(2,'osqppwwppqto'),(3,'otppwwpptso'),(3,'oqppppppqo'),(3,'oqqddqqqo')],
  2:[(3,'ovqpwwpqvo'),(2,'owqppwwppqwo'),(2,'otqppwwppqso'),(2,'ostppwwppto'),(3,'oqppppppqo'),(4,'oqqqddqqo')]},
 'up':{
  1:[(3,'ovqhwwhqvo'),(2,'ovqggggbbqvo'),(2,'osqggggbbqso'),(2,'ottggRRbbtto'),(3,'oqgbbrrbqo'),(4,'oqqddqqo')],
  0:[(3,'ovqhwwhqvo'),(2,'ovqggggbbqvo'),(2,'osqggggbbqto'),(3,'otggRRbbtso'),(3,'oqgbbrrbqo'),(4,'oqqqddqqo')],
  2:[(3,'ovqhwwhqvo'),(2,'ovqggggbbqvo'),(2,'otqggggbbqso'),(2,'ostggRRbbto'),(3,'oqgbbrrbqo'),(3,'oqqddqqqo')]},
 'right':{
  1:[(4,'ogqwvpqvo'),(3,'ogggbqppqvo'),(2,'ogggbqppqso'),(2,'ogRRbqpttto'),(3,'obrrbqqqqo'),(5,'oqqddqo')],
  0:[(4,'ogqwvpqvo'),(3,'ogggbqppqvo'),(2,'ogggbqpvsqo'),(2,'ogRRbqttppo'),(3,'obrrbqqqqo'),(5,'oqddqqo')],
  2:[(4,'ogqwvpqvo'),(3,'ogggbqppqvo'),(2,'ogggbqppvso'),(2,'ogRRbqpttso'),(3,'obrrbqqtto'),(4,'oqqddqqo')]},
 'left':{
  1:[(3,'ovqpvwqgo'),(2,'ovqppqbgggo'),(3,'osqppqbgggo'),(3,'otttpqbRRgo'),(3,'oqqqqbrrbo'),(4,'oqddqqo')],
  0:[(3,'ovqpvwqgo'),(2,'ovqppqbgggo'),(3,'oqsvpqbgggo'),(3,'oppttqbRRgo'),(3,'oqqqqbrrbo'),(4,'oqqddqo')],
  2:[(3,'ovqpvwqgo'),(2,'ovqppqbgggo'),(3,'osvppqbgggo'),(3,'osttpqbRRgo'),(3,'ottqqbrrbo'),(4,'oqqddqqo')]}
}
# Four rows, explicitly different front/rear and near/far legs and shoe contacts.
LEGS={
 'down':{
  1:[(4,'oqd..dqo'),(3,'orhd..dhro'),(3,'oodd..ddoo')],
  0:[(3,'oqq...ddo'),(3,'oqdd..ddo'),(3,'orho..doo'),(3,'oodo')],
  2:[(4,'odd...qqo'),(4,'odd..ddqo'),(4,'ood..ohro'),(9,'odoo')]},
 'up':{
  1:[(4,'oqd..dqo'),(3,'orhd..dhro'),(3,'oodd..ddoo')],
  0:[(4,'odd...qqo'),(4,'odd..ddqo'),(4,'ood..ohro'),(9,'odoo')],
  2:[(3,'oqq...ddo'),(3,'oqdd..ddo'),(3,'orho..doo'),(3,'oodo')]},
 'right':{
  1:[(5,'oqddqo'),(5,'ohdqrhro'),(5,'ood.oooo')],
  0:[(5,'oddqqqdo'),(4,'odd..qqdo'),(3,'ohdo..qrRro'),(10,'oooo')],
  2:[(5,'oqddqdo'),(4,'oqq..ddo'),(3,'orRro..dho'),(3,'oooo')]},
 'left':{
  1:[(5,'oqddqo'),(3,'orhrqdho'),(3,'oooo.doo')],
  0:[(3,'odqqqddo'),(3,'odqq..ddo'),(2,'orRrq..odho'),(2,'oooo')],
  2:[(4,'odqddqo'),(4,'odd..qqo'),(3,'ohd..orRro'),(9,'oooo')]}
}

def render(direction,phase):
 assert direction in HEAD and phase in [0,1,2]
 canvas=Pixels((16,32),PALETTE)
 # Final authored coordinates, not resampled source art. Each step has a torso,
 # arm, leg and foot pose. The head stays fixed; foot reach supplies the motion.
 top=12
 for start,rows in [(top,HEAD[direction]),(top+10,BODY[direction][phase]),(top+16,LEGS[direction][phase])]:
  for y,(x,text) in enumerate(rows):
   assert 0<=x and x+len(text)<=16,(direction,phase,start+y,x,text)
   canvas.stamp(x,start+y,[text])
 return canvas.image
