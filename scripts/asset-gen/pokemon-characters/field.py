"""192 native frames; integer clusters and separate planted/swing legs."""
from pixels import Pixels
from cast import HEADS,palette

FRONT={
'vest':['.osso.','opwwpo','oppppo','oppppo','oppppo','obggbo','oppppo'],
'jacket':['.osso.','oawwao','oaaaao','oaaaao','oaaaao','obbbbo','oppppo'],
'coat':['.osso.','owavwo','owaawo','owaawo','owbawo','owawwo','owawwo'],
'apron':['.osso.','oawwao','oavvao','oawwao','oawwao','oawwao','oabbbo'],
'dress':['.osso.','oavvao','oaaaao','oaaaao','oaaaao','obbbbo','oaaaao'],
'tunic':['.osso.','owagwo','oaaaao','obaaao','oaaaao','obggbo','oaaaao'],
'overalls':['.osso.','owwwwo','opwwpo','oppgpo','oppppo','oppppo','oppppo'],
'uniform':['.osso.','ovwwvo','oaagao','oaaaao','oaaaao','obbbbo','oppppo'],
}
BACK={
'vest':['.ohho.','oppppo','opggpo','opggpo','opggpo','opggpo','oppppo'],
'jacket':['.ohho.','oaaaao','obaaao','oaaaao','oaaaao','obbbbo','oppppo'],
'coat':['.ohho.','owwwwo','ovwwvo','ovwwvo','ovwwvo','ovwwvo','ovwwvo'],
'apron':['.ohho.','oaawao','oabbao','oaaaao','oavvao','oaaaao','oabbbo'],
'dress':['.ohho.','oaaaao','obaaao','oaaaao','oaaaao','obbbbo','oaaaao'],
'tunic':['.ohho.','oaaaao','obaaao','obaaao','obaaao','obggbo','oaaaao'],
'overalls':['.ohho.','owwwwo','opwwpo','opwwpo','oppppo','oppppo','oppppo'],
'uniform':['.ohho.','oaaaao','obaaao','oaaaao','oaaaao','obbbbo','oppppo'],
}
SIDE={
'vest':['.osso.','ogppo.','ogppo.','ogppo.','ogppo.','ogppo.','.oppo.'],
'jacket':['.osso.','oaaao.','obaao.','oaaao.','oaaao.','obbbo.','.oppo.'],
'coat':['.osso.','owwvo.','owwvo.','owavo.','owwvo.','owwvo.','ovvvo.'],
'apron':['.osso.','oawwo.','oawvo.','oawwo.','oawwo.','oawwo.','.abbo.'],
'dress':['.osso.','oaaao.','obaao.','oaaao.','oaaao.','obbbo.','oaaao.'],
'tunic':['.osso.','oaaao.','obago.','obaao.','obaao.','obggo.','oaaao.'],
'overalls':['.osso.','owpwo.','owppo.','opgpo.','opppo.','opppo.','.oppo.'],
'uniform':['.osso.','oaaao.','oabao.','oaaao.','oaaao.','obbbo.','.oppo.'],
}

def leg(c, points, shade, shorts):
    c.poly(points,'o')
    # Inner integer leg path occupies one column; two-color shoe is authored below.
    p0,p1,p2,p3=points
    c.line([(p0[0]+1,p0[1]),(p1[0],p1[1]),(p2[0]-1,p2[1])],shade)
    if shorts:c.dot(p1[0],p1[1],'s' if shade=='p' else 't')


def front_legs(c,role,phase,back=False):
    skin=role.outfit not in ['overalls','uniform','jacket','tunic','coat']
    if phase==1:
        for x,shade in [(5,'p'),(9,'q')]:
            c.rect((x,25,x+2,29),'o');c.rect((x+1,25,x+1,29),'s' if skin else shade)
            c.rect((x,29,x+2,30),'o');c.line([(x,29),(x+1,29)],'r')
    else:
        near,far=(5,9) if phase==0 else (9,5)
        sign=-1 if near==5 else 1
        c.poly([(far,25),(far+2,25),(far+2-sign,28),(far-sign,29),(far-sign-1,28)],'o')
        c.line([(far+1,25),(far+1-sign,27),(far-sign,28)],'t' if skin else 'q')
        c.line([(far-sign-1,28),(far-sign+1,28)],'r')
        c.poly([(near,25),(near+2,25),(near+2+sign,29),(near+2+sign,30),(near+sign-1,30),(near+sign,28)],'o')
        c.line([(near+1,25),(near+1,27),(near+1+sign,29)],'s' if skin else 'p')
        c.line([(near+sign,29),(near+2+sign,29)],'r')


def side_legs(c,role,phase,left):
    skin=role.outfit in ['dress','apron','vest']
    if phase==1:
        c.poly([(7,25),(9,25),(9,29),(11,29),(11,30),(7,30)],'o')
        c.line([(8,26),(8,29)],'t' if skin else 'q');c.line([(9,29),(10,29)],'r')
        c.poly([(6,25),(8,25),(8,29),(9,29),(9,30),(5,30),(5,29),(6,28)],'o')
        c.line([(7,26),(7,29)],'s' if skin else 'p');c.line([(6,29),(8,29)],'r')
    else:
        # Foot stays on the ground during the near stance; the far foot is lifted.
        forward=phase==0
        if left:forward=not forward
        if forward:
            c.poly([(7,25),(9,25),(8,27),(6,29),(3,29),(3,28),(5,27)],'o')
            c.line([(8,25),(7,27),(5,28)],'t' if skin else 'q');c.line([(3,28),(5,28)],'r')
            c.poly([(6,25),(8,25),(10,27),(11,29),(13,29),(13,30),(9,30),(8,28),(6,27)],'o')
            c.line([(7,25),(8,27),(10,29)],'s' if skin else 'p');c.line([(10,29),(12,29)],'r')
        else:
            c.poly([(7,25),(9,25),(10,27),(12,28),(12,29),(9,29),(8,27)],'o')
            c.line([(8,25),(9,27),(10,28)],'t' if skin else 'q');c.line([(10,28),(11,28)],'r')
            c.poly([(6,25),(8,25),(7,27),(6,29),(7,29),(7,30),(3,30),(3,29),(5,27)],'o')
            c.line([(7,25),(6,27),(5,29)],'s' if skin else 'p');c.line([(4,29),(6,29)],'r')


def arms(c,role,direction,phase):
    sleeve='w' if role.outfit in ['vest','apron','overalls','coat'] else 'a'
    if direction in ['up','down']:
        # Shoulder anchors are fixed; swing is below the neck and outside torso core.
        for left in [True,False]:
            x=2 if left else 12
            y=22 if phase==1 else 21 if (phase==0)==left else 23
            c.rect((x,y,x+1,y+2),'o');c.dot(x+1 if left else x,y,sleeve)
            c.dot(x+1 if left else x,y+1,'v' if sleeve=='w' else 'b')
            c.dot(x+1 if left else x,y+2,'s')
    else:
        left=direction=='left'
        if phase==1:points=[(7,21),(8,22),(8,24)]
        elif (phase==0)!=left:points=[(7,21),(9,22),(10,23)]
        else:points=[(7,21),(6,22),(5,24)]
        c.line(points,'o',3);c.line(points[:2],sleeve)
        c.dot(points[-1][0],points[-1][1],'s')


def render(role,direction,phase):
    c=Pixels((16,32),palette(role))
    if direction in ['up','down']:front_legs(c,role,phase,direction=='up')
    else:side_legs(c,role,phase,direction=='left')
    if direction=='down':rows=FRONT[role.outfit]
    elif direction=='up':rows=BACK[role.outfit]
    else:
        rows=SIDE[role.outfit]
        if direction=='left':rows=[r[::-1] for r in rows]

    if direction in ['up','down']:
        # Wider six-pixel cloth core and eight-pixel shoulders, drawn natively.
        rows=[r[:3]+r[2:4]+r[3:] for r in rows]
        c.stamp(4,19,rows)
    else:c.stamp(5,19,rows)
    if role.outfit in ['dress','coat']:
        c.line([(4,25),(4,27),(11,27),(11,25)],'o')
        c.rect((5,25,10,26),'w' if role.outfit=='coat' else 'a')
        c.line([(5,27),(10,27)],'v' if role.outfit=='coat' else 'b')
    arms(c,role,direction,phase)
    if direction=='up' and role.name in ['hero','explorer','ranger','hiker']:
        c.rect((6,20,9,24),'o');c.rect((7,21,8,23),'g');c.dot(7,21,'w')
        if role.name=='hero':c.line([(7,23),(8,23)],'a')
    if role.name=='merchant' and direction in ['up','down']:
        c.rect((10,24,12,26),'o');c.rect((11,24,11,25),'g')
    if role.name=='company_agent' and direction=='down':c.dot(9,21,'g')
    if role.name=='worker' and direction=='down':c.line([(9,24),(10,24)],'g')
    c.stamp(3,10,HEADS[role.head][direction])
    return c.image
