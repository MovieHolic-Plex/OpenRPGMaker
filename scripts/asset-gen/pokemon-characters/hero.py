"""Original native16x32 hero. Compact GBA proportions, drawn without raster input."""
from pixels import Pixels

PALETTE={
 'o':'202837', 'h':'383647', 'H':'565269',
 'r':'aa3e45', 'R':'ed6558', 'a':'ff9b70',
 'w':'fff0d0', 'v':'b3c6cc', 's':'f7c29b', 't':'dfa07e',
 'p':'4b78a0', 'q':'2b476a', 'b':'9c6743', 'g':'d5b16b', 'd':'46334b'
}
# Every row is authored on the final native grid. Centering adds transparency only.
def centered(rows,width=16):
    result=[]
    for row in rows:
        assert len(row)<=width,(row,width)
        x=(width-len(row))//2
        result.append('.'*x+row+'.'*(width-x-len(row)))
    return result

HEAD={
'down':centered([
 'oooooo', 'oorRRRrroo', 'orRaRRRRRrro', 'oRaaRRRRRrro',
 'oRRRRRRRRrro', 'orrrRRRRrrro', 'ohrrRRRRrrhho',
 'ohhrrwwwrrhho',
 'ostsssssssstso',
 'otsossssosto',
 'ottsossssostto',
 'ottsstssstto',
 'ootsssstoo']),
'up':centered([
 'oooooo', 'oorRRRrroo', 'orRaRRRRRrro', 'oRaaRRRRRrro',
 'oRRRRRRRRrro', 'orrrRRRRrrro', 'ohrrrrrrrrhho',
 'ohrrrwwrrrhho',
 'ohHHHhhhhhho',
 'ohHHhhhhhho',
 'ohhhhhhho',
 'ohhtssthho',
 'ohtsstho']),
'right':[
 '.....oooooo.....', '...oorRRRrroo...', '..orRaRRRRRrro..',
 '..oRaaRRRRRrro..', '..oRRRRRRRRrro..', '..orrrRRRRrrro..',
 '..ohrrRRRRRrrro.', '..ohhhrrwwwrro..',
 '..ohHHhtssssso..', '...ohHhtsssoso..',
 '....ohttsssoso..', '.....ohtsssto...', '......otsto.....']}
assert all(len(row)==16 for rows in HEAD.values() for row in rows)
# Keep the two dark eye columns vertical, independent of cheek-row width.
assert all(HEAD['down'][y][x]=='o' for y in [9,10] for x in [5,10])
HEAD['left']=[row[::-1] for row in HEAD['right']]
BODY={
'down':centered([
 'oqvsssvqo',
 'owqppwwppqwo',
 'osvqpwwpqvso',
 'ottqppwppqtto',
 'oqhhhqqhhqo']),
'up':centered([
 'ovqsssqvo',
 'owqggbbgqwo',
 'osqgRRbbqvso',
 'ottgrrbbqtto',
 'oqhbbbbhhqo']),
'right':[
 '.....oqssvqo....',
 '....oggbopwpo...',
 '...obgRboqvqo...',
 '....obrrqssto...',
 '.....ohhqqho....']}
assert all(len(row)==16 for rows in BODY.values() for row in rows)
BODY['left']=[row[::-1] for row in BODY['right']]
# Three native rows join dressed hips directly to small toe/heel shoes.
LEGS={
'down':{
 1:centered(['oqss..ssqo','orrd..drro','owd....dwo']),
 0:centered(['oqss...sqo','orrd..ddro','owdd....']),2:[]},
'right':{
 1:centered(['oqstqo','odroRro','owd.owo']),
 0:centered(['ott..so','orr..do','.....dwo']),
 2:centered(['os..tto','od..rro','owd.....'])}}
LEGS['down'][2]=[row[::-1] for row in LEGS['down'][0]]
LEGS['up']=LEGS['down']
LEGS['left']={phase:[row[::-1] for row in rows] for phase,rows in LEGS['right'].items()}

def render(direction,phase):
    assert direction in HEAD and phase in [0,1,2]
    c=Pixels((16,32),PALETTE)
    bob=0 if phase==1 else 1
    c.stamp(0,28,LEGS[direction][phase])
    c.stamp(0,23+bob,BODY[direction])
    if direction in ['up','down'] and phase!=1:
        # Elbow stays on the shoulder; opposite wrist swings a single native row.
        near=11 if phase==0 else 3
        c.rect((near,25+bob,near+1,27+bob),'o')
        c.dot(near,25+bob,'v')
        c.dot(near,26+bob,'s');c.dot(near,27+bob,'t')
        far=3 if phase==0 else 11
        c.dot(far,25+bob,'s');c.dot(far,26+bob,'t')
    elif direction in ['right','left'] and phase!=1:
        points=[(10,25+bob),(8,26+bob)] if phase==0 else [(10,25+bob),(12,26+bob)]
        if direction=='left':points=[(15-x,y) for x,y in points]
        c.line(points,'o',2);c.line(points,'s');c.dot(*points[0],'v');c.dot(*points[-1],'t')
    c.stamp(0,10+bob,HEAD[direction])
    return c.image
