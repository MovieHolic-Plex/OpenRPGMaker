W,H=32,32
g=[['.']*W for _ in range(H)]
def R(x0,y0,x1,y1,c):
    for y in range(y0,y1+1):
        for x in range(x0,x1+1): g[y][x]=c
# materials
mats={'c':'wood 1','d':'wood 2','e':'wood 3','f':'wood 4','g':'wood 5','h':'wood 6','i':'wood 7',
'j':'red 4','k':'yellow 4','l':'red 2','m':'dwood 2','n':'straw 3','o':'straw 5','p':'straw 4','q':'linen 5','r':'linen 3','s':'yellow 3','t':'red 5','u':'straw 6'}
# --- rear posts (face), rows 8..13
for x0 in (2,26):
    R(x0,8,x0+3,13,'c')
    R(x0+1,9,x0+2,13,'f')
    g[9][x0+1]='h';g[9][x0+2]='h'   # cap top
    R(x0+1,10,x0+1,13,'g')
    R(x0+2,10,x0+2,13,'e')
# --- rear beam (heddle bar) rows 10..12 between posts
R(6,10,25,10,'c')
R(6,11,25,11,'h')
R(6,12,25,12,'f')
R(6,13,25,13,'e')
R(6,14,25,14,'c')
# heddle strings hanging (linen) rows 15-16 from beam
# --- side rails (top surfaces) rows 14..24
for x0,l,d in ((2,'h','g'),(26,'g','f')):
    R(x0,14,x0+3,24,'c')
    R(x0+1,14,x0+1,24,l)
    R(x0+2,14,x0+2,24,d)
# --- warp plate rows 15..23, cols 6..25
R(6,15,25,15,'d')           # shadow under rear beam
for y in range(16,24):
    for x in range(6,26):
        g[y][x]='n' if x%2==0 else 'o'
# heddle strings hanging from beam: darker pair of lines
for x in range(7,25,3):
    g[16][x]='q'; g[17][x]='q'
# cloth (woven) rows 19..23: weft bands + stripes
for y in range(19,24):
    for x in range(6,26):
        base='j' if (y%2==1) else 't'
        if x%8 in (2,3): base='s' if y%2==1 else 'k'
        g[y][x]=base
for x in range(6,26): g[19][x]='l' if x%2==0 else 'j'
# shuttle on the cloth
R(13,21,17,21,'i'); g[21][12]='h'; g[21][18]='h'
# --- front beam rows 24..27
R(2,24,29,24,'c')
R(3,24,28,24,'h')
R(2,25,29,25,'c')
R(3,25,28,25,'g')
R(3,26,28,26,'f')
R(3,27,28,27,'e')
R(2,26,2,27,'c'); R(29,26,29,27,'c')
R(3,28,28,28,'c')
# --- short front legs rows 28..31
for x0 in (3,25):
    R(x0,28,x0+3,31,'c')
    R(x0+1,28,x0+1,30,'g')
    R(x0+2,28,x0+2,30,'e')
open('w106-A.pxg','w').write('')
lines=['@size 32 32','@cell 16','@palette palette.pal']
lines+=['@mat %s %s'%(k,v) for k,v in mats.items()]
lines.append('@mblock 0 0')
lines+=[''.join(r) for r in g]
open('w106-A.pxg','w').write('\n'.join(lines)+'\n')
