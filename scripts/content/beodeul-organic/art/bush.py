"""Bushes: hand-placed leaf clusters (positions and tone levels chosen by hand, back to front).
Lit top/left edges end in the light tone (no outline); only lower-right edge gets the darkest tone."""
WD = {"5":"#94b353","4":"#497f3c","3":"#296535","2":"#104c2f","1":"#063328","o":"#071d1b","g":"#0c2222","s":"s","S":"S"}
BR = {"5":"#8cbf5f","4":"#418640","3":"#226b39","2":"#0a5134","1":"#08372c","o":"#071f1d","g":"#071d1b","s":"s","S":"S",
      "r":"#9e2514","R":"#61160d","h":"#dd2912"}
TH = dict(WD, t="#6f4725", T="#452a17")
# leaf cluster shapes (L light rim, M mid, D dark core / underside)
CL = {
 "A": ["..LL.LL.", ".LMMLMML", "LMMMMMMD", "MMMMMMDD", "MMMMMDDD", ".MMDDDD.", "..DDD..."],
 "B": [".LLL...", "LMMML..", "LMMMMLL", "MMMMMMD", "MMMMDDD", ".MDDDD.", "..DD..."],
 "a": [".LL..", "LMML.", "MMMDD", ".MDD.", "..D.."],
 "b": ["..LL.", ".LMM.", "LMMD.", "MMDD.", ".DD.."],
 "c": [".L.L.", "LMLM.", "MMMDD", "MDDD.", ".D..."],
 "d": ["LL..", "MMLL", "MDMD", ".DD."],
}
LV = [("5","4","3"), ("4","3","2"), ("3","2","1"), ("2","1","o")]

def paint(W, H, stamps, ground=True, base_lo=None):
    g = [["."]*W for _ in range(H)]
    for (x, y, sh, lv) in stamps:
        L, M, D = LV[lv]
        shape = CL[sh]
        for j, row in enumerate(shape):
            for i, ch in enumerate(row):
                if ch == ".": continue
                X, Y = x+i, y+j
                # pixel just below/right of this lobe's lower-right D edge in earlier paint -> gap
                for ax, ay in ((1,1),(0,1)):
                    nx, ny = X+ax, Y+ay
                    inside = 0 <= ny-y < len(shape) and 0 <= nx-x < len(shape[ny-y]) and shape[ny-y][nx-x] != "."
                    if ch == "D" and not inside and 0 <= nx < W and 0 <= ny < H and g[ny][nx] not in ".o":
                        g[ny][nx] = "1" if g[ny][nx] in "345" else "o"
        for j, row in enumerate(CL[sh]):
            for i, ch in enumerate(row):
                if ch == "." : continue
                X, Y = x+i, y+j
                if 0 <= X < W and 0 <= Y < H:
                    g[Y][X] = {"L":L,"M":M,"D":D}[ch]
    # dark edge only on right / bottom sides
    out = [r[:] for r in g]
    for Y in range(H):
        for X in range(W):
            if g[Y][X] == ".": continue
            right = X+1 >= W or g[Y][X+1] == "."
            below = Y+1 >= H or g[Y+1][X] == "."
            if (below and Y > H*0.45) or (right and X > W*0.55):
                out[Y][X] = "o" if out[Y][X] not in "5" else "2"
    if ground:
        for X in range(W):
            col = [Y for Y in range(H) if out[Y][X] != "."]
            if not col: continue
            b = max(col)
            if b+1 < H and X > W*0.2: out[b+1][X] = "S" if X > W*0.4 else "s"
            if b+2 < H and X > W*0.5: out[b+2][X] = "s"
    return out

def fin(g): return ["".join(r) for r in g]

# bush-s: low clump of three big lobes
bs = paint(16, 16, [
 (5,4,"B",0), (1,7,"B",0), (8,6,"A",1), (3,9,"A",2), (9,9,"B",3)])
# bush-m: big woodland bush, two humps, notched top
bm = paint(32, 32, [
 (6,8,"A",0),(15,9,"B",0),(21,11,"A",1),
 (2,13,"B",0),(10,13,"A",1),(17,14,"A",1),(24,15,"B",2),
 (1,18,"A",1),(8,18,"B",2),(14,19,"A",2),(21,19,"A",2),(26,20,"B",3),
 (3,22,"A",3),(10,23,"B",3),(16,23,"A",3),(22,23,"A",3)])
# bush-berry: brighter, tall rounded-lumpy bush with berries in shade
bb = paint(32, 32, [
 (12,6,"B",0),(6,9,"A",0),(17,8,"A",0),
 (3,13,"B",0),(11,12,"A",1),(19,13,"B",1),(24,14,"A",2),
 (5,17,"A",1),(13,17,"B",2),(20,18,"A",2),
 (3,21,"B",2),(9,21,"A",3),(16,22,"A",3),(23,21,"B",3)])
for (x,y) in [(10,15),(17,13),(22,18),(7,20),(14,21),(19,20),(25,19),(11,25),(18,25)]:
    if bb[y][x] in "123" and bb[y][x+1] in "123":
        bb[y][x] = "r"; bb[y][x+1] = "R"
# shrub-tall: wide skirt at base, tiers narrowing up, tip leaning
st = paint(16, 32, [
 (5,4,"d",0),(4,6,"B",0),(7,9,"d",1),
 (2,10,"B",0),(7,12,"A",1),
 (1,15,"A",1),(6,17,"B",2),
 (0,20,"B",1),(5,21,"A",2),(9,22,"B",3),(2,24,"A",3)])
# bramble: low tangled thicket, arching thorny canes poking out, gaps between clumps
br = paint(32, 16, [
 (1,7,"B",1),(8,8,"A",2),(14,6,"B",1),(21,7,"A",2),(26,8,"d",2),
 (4,10,"d",3),(17,10,"d",3),(24,10,"d",3),(28,10,"d",3)])
for pts in ([(4,6),(5,5),(6,4),(7,4),(8,5)], [(12,6),(13,5),(14,4),(15,3),(16,3),(17,4)],
            [(22,6),(23,5),(24,4),(25,4),(26,5),(27,6),(28,7)], [(29,10),(30,9),(30,8)], [(0,9),(1,8)]):
    for i,(x,y) in enumerate(pts):
        br[y][x] = "t" if i % 2 == 0 else "T"
        if br[y-1][x] == "." and i % 3 == 1: br[y-1][x] = "T"
for (x,y) in [(9,9),(18,8),(26,9),(14,11)]: br[y][x] = "t"

ART = {"bush-s":(fin(bs),WD),"bush-m":(fin(bm),WD),"bush-berry":(fin(bb),BR),"shrub-tall":(fin(st),WD),"bramble":(fin(br),TH)}
