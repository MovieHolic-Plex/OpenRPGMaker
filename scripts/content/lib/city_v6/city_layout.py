# 버들항 (100x100): a three-level river town. Level 2 = castle hill (north-west) and the temple mount (east),
# level 1 = the middle town, level 0 = the harbour town by the lake (south). The river rises on the castle hill,
# drops twice (two waterfalls) and reaches the lake. Stairs connect the levels.
W,H=100,100
def grid(v): return [[v]*W for _ in range(H)]
def fill(g,x0,x1,y0,y1,v=True):
    for y in range(max(0,y0),min(H,y1+1)):
        for x in range(max(0,x0),min(W,x1+1)): g[y][x]=v
def segs(spec):   # [(x0,x1,value)] -> per-x list
    out=[None]*W
    for x0,x1,v in spec:
        for x in range(x0,x1+1): out[x]=v
    return out
E=grid(1)
e2=segs([(0,6,27),(7,12,28),(13,19,29),(20,26,26),(27,32,25),(33,36,26),(37,41,25),(42,49,27),(50,55,28),(56,57,10)])
for x in range(0,58):
    for y in range(0,e2[x]+1): E[y][x]=2
e1=segs([(0,9,58),(10,15,57),(16,27,59),(28,35,61),(36,46,60),(47,50,61),(51,55,60),(56,58,61),(59,66,62),(67,73,60),(74,86,57),(87,99,58)])
for x in range(W):
    for y in range(e1[x]+1,H): E[y][x]=0
# castle rock (level 3) on the hill: the keep stands on it, its face looks down on the castle court
cr=segs([(2,8,12),(9,14,13),(15,21,12)])
for x in range(2,22):
    for y in range(1,cr[x]+1): E[y][x]=3
em=segs([(80,85,22),(86,91,24),(92,97,22)])            # temple mount
for x in range(80,98):
    for y in range(3,em[x]+1): E[y][x]=2
STAIRS=[(11,14,2),(23,27,2),(44,28,2),(88,25,2),(56,62,3),(12,58,2),(70,61,2)]
FALLS=[(33,27,4),(47,62,4)]
lake=grid(False)
shore=segs([(10,17,93),(18,23,90),(24,32,88),(33,46,87),(47,50,90),(51,62,87),(63,72,88),(73,80,90),(81,88,93)])
for x in range(W):
    if shore[x] is not None:
        for y in range(shore[x],H): lake[y][x]=True
river=grid(False)
fill(river,33,36,0,28); fill(river,33,36,29,41); fill(river,33,50,38,41); fill(river,47,50,38,63); fill(river,47,50,64,90)
pond=grid(False)
fill(pond,3,9,81,85); fill(pond,4,8,80,80); fill(pond,4,8,86,86)
def masonry_at(x,y):
    if E[y-1][x]==3: return True                                          # the castle rock is walled
    if E[y-1][x]==2 and 80<=x<=97: return True                           # temple mount terrace wall
    if y>=55 and 26<=x<=76: return True                                   # the middle town's quay wall
    return False
