"""One original hero, authored at16x32. No shared cast anatomy or raster sources."""
from pixels import Pixels

PALETTE={'o':'283b4a','h':'253954','H':'49657d','r':'b64045','R':'e85b4a','a':'ff9564','w':'f2edcf','v':'b9c4b6','s':'f3bb88','t':'c78064','p':'37617b','q':'24465f','b':'d5953f','g':'ecc36b','d':'775944'}
HEAD={
'down':[
'.....oooooo.....',
'...ooRRaRRRoo...',
'...oRRaRRRRrro..',
'...oRRwRRRrro...',
'..ohrrRRRrrhho..',
'..ohhssssshhho..',
'...htosssoth....',
'...otsssssto....',
'....otssssto....',
'.....otssto.....',
'......ssto......'],
'up':[
'.....oooooo.....',
'...ooRRaRRRoo...',
'...oRRaRRRRrro..',
'...oRRRRRRrro...',
'..ohrrrrrrhhho..',
'..ohHHhhhhhhho..',
'...oHHhhhhho....',
'....ohhhhho.....',
'.....ohhho......',
'......hh........',
'......oo........'],
'right':[
'.....ooooo......',
'....oRaaRRoo....',
'...oRRaRRRrro...',
'...oRRRRRRrrro..',
'....ohhhhrrro...',
'...ohHHsssto....',
'...ohhhssoso....',
'....ohtssssto...',
'.....otsssto....',
'......otsso.....',
'......ssto......']}
# Original asymmetric side details retain their mirrored attachment to the body.
HEAD['left']=[row[::-1] for row in HEAD['right']]
TORSO={
'down':['...ovwsswvo.....','..ovwppppwvo....','...oppppqqo.....','...oqpppqqo.....','....oqppqo......','....ohhhhho.....'],
'up':['...ovphhpvo.....','..ovpggggpvo....','..osgbbbbgso....','..otgRRRrgto....','...oprrrrpo.....','....ohhhhho.....'],
'right':['......ovso......','....obovwpo.....','...obgopwqo.....','...oggoqsto.....','...orRoqpto.....','....ohhhhho.....']}
TORSO['left']=[row[::-1] for row in TORSO['right']]

LEGS={
'down':{
 1:['.ss..tt.','.st..tt.','.st..tt.','.dd..dd.','odo..odo'],
 0:['.ss..tt.','.st...tt','.st.oddo','.dd.....','odo.....'],
 2:['.tt..ss.','tt...st.','oddo.st.','.....dd.','.....odo']},
'right':{
 1:['..ttss..','..ttss..','..ttst..','.dd..dd.','.odo.ddo'],
 0:['..ttss..','.tt..ss.','tt....ss','dd....dd','.....odo'],
 2:['..ss.tt.','.ss...tt','ss....tt','dd....dd','odo.....']}}
LEGS['up']=LEGS['down']
LEGS['left']={phase:[r[::-1] for r in rows] for phase,rows in LEGS['right'].items()}

def render(direction,phase):
    c=Pixels((16,32),PALETTE)
    bob=0 if phase==1 else 1
    # Legs are drawn individually, rear shadow and foreground skin trade support.
    c.stamp(4,26,LEGS[direction][phase])
    c.stamp(0,20+bob,TORSO[direction])
    # Each arm includes a shoulder sleeve, cuff and connected skin forearm.
    # Low forward hand belongs to the opposite side from the planted leg.
    if direction in ['up','down']:
        for side in [0,1]:
            x=2 if side==0 else 11
            forward=phase!=1 and ((phase==0)==(side==1))
            back=phase!=1 and not forward
            y=21+bob
            c.rect((x,y,x+1,y+1),'w')
            c.dot(x if side==0 else x+1,y+1,'v')
            if forward:
                c.rect((x,y+2,x+1,y+3),'s')
                c.line([(x+1,y+2),(x+1,y+3)],'t')
                c.dot(x if side==0 else x+1,y+4,'s')
            elif back:
                c.dot(x,y+2,'t');c.dot(x+1,y+2,'s')
            else:
                c.dot(x,y+2,'s');c.dot(x+1,y+2,'t')
                c.dot(x,y+3,'t')
    elif phase!=1:
        # Side arm swings from the same sleeve; the hand stays connected.
        left=direction=='left'
        points=[(8,23+bob),(10,24+bob),(11,24+bob)] if phase==0 else [(8,23+bob),(7,24+bob),(6,25+bob)]
        if left:points=[(15-x,y) for x,y in points]
        c.line(points,'o',2);c.line(points,'s');c.dot(*points[-1],'t')
    c.stamp(0,10+bob,HEAD[direction])
    return c.image
