# r59 round 3: regular saw-cut panel grid (lines at chars 4,12,20,28 = px 16,48,80,112), interior merges/splits per layout.
import string
G=[0,4,12,20,28,32]
def build(extra_v=(), extra_h=(), merges=()):
    # base panels: col groups (28..3 wrap),(4..11),(12..19),(20..27)
    lab=[[None]*32 for _ in range(32)]
    def grp(v): return 0 if v<4 or v>=28 else 1 if v<12 else 2 if v<20 else 3
    pid={}
    for y in range(32):
        for x in range(32):
            lab[y][x]=(grp(x),grp(y))
    # splits: (axis, at, xrange, yrange) -> sub id
    for (at,(x0,x1),(y0,y1)) in extra_v:
        for y in range(y0,y1):
            for x in range(x0,x1):
                lab[y][x]=lab[y][x]+(('v',at,x>=at),)
    for (at,(x0,x1),(y0,y1)) in extra_h:
        for y in range(y0,y1):
            for x in range(x0,x1):
                lab[y][x]=lab[y][x]+(('h',at,y>=at),)
    for (a,b) in merges:   # merge panel b into a (group coords)
        for y in range(32):
            for x in range(32):
                if lab[y][x]==b: lab[y][x]=a
    letters=iter(string.ascii_letters)
    m={}
    rows=[]
    for y in range(32):
        r=''
        for x in range(32):
            k=(lab[y][x], x>=28 and lab[y][x][0]==0, y>=28 and lab[y][x][1]==0)
            if k not in m: m[k]=next(letters)
            r+=m[k]
        rows.append(r)
    return rows
A=build(extra_h=((24,(12,20),(20,28)),))                      # one panel with a mid score line
D=build(merges=(((1,2),(1,3)),((2,1),(3,1))))                  # a tall and a long panel
E=build(extra_v=((8,(4,12),(4,12)),), extra_h=((16,(20,28),(12,20)),), merges=(((2,2),(2,3)),))
for n,R in (('a',A),('d',D),('e',E)):
    print("SLAB_LAYOUTS['%s'] = ["%n)
    for i in range(0,32,2): print("    '%s', '%s',"%(R[i],R[i+1]))
    print(']')
