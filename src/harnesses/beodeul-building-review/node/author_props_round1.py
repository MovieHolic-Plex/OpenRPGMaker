"""Round 1 of the Beodeul props/trees review: the existing non-building kits (exported as-is) and two NEW fence families
drawn per-cell from the N/E/S/W neighbour mask (wood post-and-rail, low stone wall) plus a wood gate.

Everything is drawn in the Beodeul sheet's own colours (sampled from bd-out-fence-run / bd-mpart-low-wall). Output goes to
harness-data/beodeul-props-review/round1/ (committed) with a manifest for import_candidates.py. Not signed.
"""
import json, re, sys
from pathlib import Path
from PIL import Image

ROOT=Path(__file__).resolve().parents[4]
OUT=ROOT/'harness-data/beodeul-props-review/round1';OUT.mkdir(parents=True,exist_ok=True);(OUT/'scenes').mkdir(exist_ok=True)
N,E,S,W=1,2,4,8
atlas=Image.open(ROOT/'public/assets/beodeul-city/beodeul-city-chipset.png').convert('RGBA')
def tile(n):return atlas.crop((n%128*16,n//128*16,n%128*16+16,n//128*16+16))
GRASS=tile(737)

# ---------- palettes (all sampled from the sheet's own fence / low wall) ----------
WD={0:(30,21,10),1:(61,34,12),2:(84,55,25),3:(113,77,41),4:(136,90,38)}
ST={0:(43,57,52),1:(89,91,88),2:(146,148,145),3:(196,198,195),4:(222,224,221)}

def put(im,x,y,c):
    if 0<=x<im.width and 0<=y<im.height:im.putpixel((x,y),c+(255,))
def rect(im,x0,y0,x1,y1,c):
    for y in range(y0,y1+1):
        for x in range(x0,x1+1):put(im,x,y,c)

# ---------- wood post-and-rail ----------
def wood_cell(mask):
    im=Image.new('RGBA',(16,16))
    # rails first (posts overlap them). E/W rails: two bars, top row lit, bottom row dark.
    def hrail(x0,x1):
        for y0 in (6,10):
            rect(im,x0,y0,x1,y0,WD[3]);rect(im,x0,y0+1,x1,y0+1,WD[1]);rect(im,x0,y0+2,x1,y0+2,WD[0])
    if mask&W:hrail(0,7)
    if mask&E:hrail(8,15)
    # N: the rails run away from the viewer — only their narrow lit top faces show; S: they come toward us — front ends
    if mask&N:
        for x0 in (6,8):rect(im,x0,0,x0+1,6,WD[3] if x0==6 else WD[2])
        rect(im,6,0,9,0,WD[1])
    if mask&S:
        rect(im,6,9,9,15,WD[2]);rect(im,6,9,6,15,WD[3]);rect(im,9,9,9,15,WD[1]);rect(im,7,12,8,12,WD[0])
    # post: 4px wide, lit left, dark right, light cap, dark foot
    rect(im,6,5,9,13,WD[2]);rect(im,6,5,6,13,WD[3]);rect(im,9,5,9,13,WD[1]);rect(im,7,5,8,5,WD[4]);rect(im,6,4,9,4,WD[3])
    rect(im,6,3,9,3,WD[0]) if False else None
    rect(im,6,14,9,14,WD[0]);put(im,6,4,WD[1]);put(im,9,4,WD[1])
    return im

# ---------- low stone wall ----------
def stone_cell(mask):
    """Low wall: a lit top face (5 rows) and a 7-row brick front, like bd-mpart-low-wall, drawn per neighbour mask."""
    top=set()
    def box(x0,y0,x1,y1):
        for y in range(y0,y1+1):
            for x in range(x0,x1+1):top.add((x,y))
    box(5,4,10,8)
    if mask&N:box(5,0,10,3)
    if mask&S:box(5,9,10,15)
    if mask&E:box(11,4,15,8)
    if mask&W:box(0,4,4,8)
    im=Image.new('RGBA',(16,16))
    H=7
    for x in range(16):
        ys=sorted(y for (xx,y) in top if xx==x)
        runs=[]
        for y in ys:
            if runs and runs[-1][1]==y-1:runs[-1][1]=y
            else:runs.append([y,y])
        for a,b in runs:
            for k in range(1,H+1):
                y=b+k
                if y>15:break
                if k==1:c=ST[1]                       # shadow right under the lip
                elif k==H:c=ST[0]                     # dark base
                elif k==4:c=ST[1]                     # mortar course
                else:
                    off=0 if k<4 else 3               # staggered courses
                    c=ST[1] if (x+off)%6==0 else (ST[2] if k in (2,5) else ST[2])
                    if k in (3,6):c=ST[1] if (x+off)%6==0 else ST[1] if False else ST[2]
                put(im,x,y,c)
    for (x,y) in top:
        c=ST[3]
        if (x,y-1) not in top:c=ST[4]                       # lit north edge
        elif (x-1,y) not in top:c=ST[4] if y%2==0 else ST[3]  # lit west edge
        elif (x+1,y) not in top:c=ST[2]                     # shaded east edge
        put(im,x,y,c)
    for (x,y) in top:                                       # dark rim on the open sides of the top face
        if (x,y-1) not in top and y>0:put(im,x,y-1,ST[0])
        if (x-1,y) not in top and x>0:put(im,x-1,y,ST[0])
        if (x+1,y) not in top and x<15:put(im,x+1,y,ST[0])
    return im

def gate_wood():
    im=Image.new('RGBA',(32,16))
    for ox,m in ((0,W|E),(16,W|E)):
        cell=wood_cell(m);im.alpha_composite(cell,(ox,0))
    # remove the middle post and bar: the leaf spans the opening between two posts
    cleared=Image.new('RGBA',(8,16));im.paste(cleared,(12,0))
    rect(im,12,5,19,13,(0,0,0));
    for x in range(12,20):
        for y in range(5,14):im.putpixel((x,y),(0,0,0,0))
    # posts at 6..9 (left) and 22..25 (right) are drawn; leaf between x=10..21
    left=wood_cell(E);right=wood_cell(W)
    im=Image.new('RGBA',(32,16));im.alpha_composite(wood_cell(E),(0,0));im.alpha_composite(wood_cell(W),(16,0))
    # re-cut: leaf region between the posts, redraw a closed gate: two bars + a diagonal brace + a latch
    for x in range(10,22):
        for y in range(5,14):im.putpixel((x,y),(0,0,0,0))
    for y0 in (6,10):
        rect(im,10,y0,21,y0,WD[3]);rect(im,10,y0+1,21,y0+1,WD[2]);rect(im,10,y0+2,21,y0+2,WD[0])
    for k in range(12):
        x=10+k;y=11-int(k*5/11);put(im,x,y,WD[4]);put(im,x,y+1,WD[1])
    rect(im,15,8,16,9,WD[4]);put(im,15,8,WD[3])  # latch block
    return im

def sheet(cell_fn):
    sh=Image.new('RGBA',(64,64))
    for m in range(16):sh.alpha_composite(cell_fn(m),(m%4*16,m//4*16))
    return sh

def assemble(cells,grid,cw,ch,pad=2):
    """grid rows of '.'/'#' (fence cells) -> picture on grass; masks from neighbours."""
    w=max(map(len,grid));grid=[r.ljust(w,'.') for r in grid];h=len(grid);bg=Image.new('RGBA',((w+2*pad)*16,(h+2*pad)*16))
    for y in range(bg.height//16):
        for x in range(bg.width//16):bg.paste(GRASS,(x*16,y*16))
    for y in range(h):
        for x in range(w):
            if grid[y][x]=='.':continue
            if grid[y][x]=='G':continue
            m=0
            for (dx,dy,b) in ((0,-1,N),(1,0,E),(0,1,S),(-1,0,W)):
                nx,ny=x+dx,y+dy
                if 0<=nx<w and 0<=ny<h and grid[ny][nx] in '#G':m|=b
            bg.alpha_composite(cells(m),((x+pad)*16,(y+pad)*16))
    return bg

PEN=['#########','#.......#','#.......#','#...#####','#...#',  '#####']  # placeholder replaced below
PEN=['############',
     '#..........#',
     '#..........#',
     '#....#######',
     '#....#',
     '######']

def scene_for(cells,gate=None):
    bg=assemble(cells,PEN,16,16)
    return bg

def dump(im,name):im.save(OUT/name);return OUT/name

items=[]
def add(id_,name,role,image,desc,scene=None,**extra):
    row={'id':id_,'name':name,'role':role,'image':str(image.relative_to(OUT)),'description':desc,**extra}
    if scene:row['scene']=str(scene.relative_to(OUT))
    items.append(row)

# --- new: fence families ---
w=sheet(wood_cell);s=sheet(stone_cell)
wp=dump(w,'fence-wood-set.png');sp=dump(s,'fence-stone-set.png')
wscene=dump(assemble(wood_cell,PEN,16,16),'scenes/fence-wood-set.png');sscene=dump(assemble(stone_cell,PEN,16,16),'scenes/fence-stone-set.png')
add('p1-fence-wood','나무 울타리 16칸 세트','울타리',wp,'기둥-가로대 울타리. 칸마다 위·오른쪽·아래·왼쪽 이웃 여부(16가지)로 골라 놓는다. 칸 순서: 4×4, 번호 = 위1+오른쪽2+아래4+왼쪽8.',wscene,kind='autotile',cell=16)
add('p1-fence-stone','낮은 돌담 16칸 세트','울타리',sp,'낮은 돌담. 위 윗면+앞면 벽돌, 이웃 여부 16가지. 칸 순서·번호는 나무 울타리와 같다.',sscene,kind='autotile',cell=16)
gp=dump(gate_wood(),'gate-wood.png')
gscene=dump(assemble(lambda m:wood_cell(m),['#####'],16,16),'scenes/gate-wood.png')
# gate scene: fence run with the gate in the middle
g=assemble(wood_cell,['##...##'],16,16)
g.alpha_composite(gate_wood(),((2+2)*16,2*16));gscene=dump(g,'scenes/gate-wood.png')
add('p1-gate-wood','나무 울타리 문 (2×1)','울타리',gp,'닫힌 울타리 문. 양옆은 나무 울타리의 동서(좌우) 연결 칸과 이어진다.',gscene,kind='prop')

# --- existing non-building kits, exported as-is ---
d=json.load(open(ROOT/'src/assets/beodeulCityTileset.json'))
skip_mpart=re.compile(r'bay-|dormer|door-bay|gable|ivy|porch|roof|stairs|tower|chimney')
skip_out=re.compile(r'cabin|log|plank|roof|gable|house|longhouse|ridge|chimney|ivy|woodshed')
for k in d['structureKits']:
    m=re.match(r'(bd-[a-z]+)-(.*)',k['id'])
    if not m or m.group(1) not in ('bd-prop','bd-tree','bd-mpart','bd-out'):continue
    g,nm=m.groups()
    if g=='bd-mpart' and skip_mpart.search(nm):continue
    if g=='bd-out' and skip_out.search(nm):continue
    if k['width']*k['height']>=20 or nm.startswith('well-plaza') or nm=='sand-patch':continue  # 광장·모래밭 같은 대형은 여러 타일 조합으로 만든다 — 단품 심사에서 제외(사용자 2026-10-07)
    im=Image.new('RGBA',(k['width']*16,k['height']*16))
    for key in ('tiles','upperTiles'):
        for y,row in enumerate(k['rows']):
            for x,n in enumerate(row.get(key,[])):
                if n>=0:im.alpha_composite(tile(n),(x*16,y*16))
    p=dump(im,f"existing-{k['id']}.png")
    role={'bd-prop':'소품','bd-tree':'나무','bd-mpart':'정원·부품','bd-out':'야외'}[g]
    add('e-'+k['id'][3:],k.get('name') or nm,role,p,f"기존 키트 {k['id']} ({k['width']}×{k['height']}칸). 사람이 허용/거절한 적 없는 기존 그림.",kind='existing',sourceKit=k['id'],cell=16)
(OUT/'manifest.json').write_text(json.dumps({'candidates':items},ensure_ascii=False,indent=1)+'\n')
print(len(items),'candidates;',3,'new')
