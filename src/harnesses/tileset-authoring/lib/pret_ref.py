"""원작(FRLG·RSE) 맵 조립기 — 학습·대조용. pret 디컴파일 저장소에서 map.bin·metatiles·tiles·palettes 를 받아 ~/.cache/oprn-pret-ref 에 두고 PNG 로 그린다.
그림은 저장소에 넣지 않는다(저작권). 사용: python3 pret_ref.py fr PalletTown_Layout out.png  (fr=pokefirered, em=pokeemerald)"""
import struct,json,os,re,subprocess,sys
from PIL import Image
RAW={'fr':'https://raw.githubusercontent.com/pret/pokefirered/master/','em':'https://raw.githubusercontent.com/pret/pokeemerald/master/'}
NP={'fr':(7,640),'em':(6,512)}
def get(g,path):
    loc=os.path.expanduser(f'~/.cache/oprn-pret-ref/{g}/')+path.replace('/','_')
    if not os.path.exists(loc):
        os.makedirs(os.path.dirname(loc),exist_ok=True)
        subprocess.run(['curl','-s','-f','-o',loc,RAW[g]+path],check=True)
    return loc
def snake(n):
    n=n.replace('gTileset_','')
    s=re.sub(r'(?<=[a-z])(?=[A-Z0-9])|(?<=[0-9])(?=[A-Z])','_',n).lower()
    s=s.replace('i_d','id')
    return s
def pal(p):
    L=open(p).read().split('\n')[3:19]; return [tuple(map(int,l.split())) for l in L if l.strip()]
def tiles(p):
    im=Image.open(p); px=im.convert('P').load() if im.mode!='P' else im.load()
    w,h=im.size; out=[]
    for ty in range(h//8):
        for tx in range(w//8):
            out.append([[px[tx*8+x,ty*8+y]&15 for x in range(8)] for y in range(8)])
    return out
def load_ts(g,kind,name):
    base=f'data/tilesets/{kind}/{name}/'
    t=tiles(get(g,base+'tiles.png'))
    d=open(get(g,base+'metatiles.bin'),'rb').read()
    m=[struct.unpack('<8H',d[i:i+16]) for i in range(0,len(d),16)]
    pals=[]
    for i in range(16):
        try: pals.append(pal(get(g,base+f'palettes/{i:02d}.pal')))
        except Exception: pals.append(None)
    return t,m,pals
def layouts(g):
    loc=get(g,'data/layouts/layouts.json'); return {l['name']:l for l in json.load(open(loc))['layouts'] if l}
def render(g,lname,out,box=None):
    L=layouts(g)[lname]; npal,ntile=NP[g]
    pk=snake(L['primary_tileset']); sk=snake(L['secondary_tileset'])
    T1,M1,P1=load_ts(g,'primary',pk); T2,M2,P2=load_ts(g,'secondary',sk)
    PAL=[P1[i] for i in range(npal)]+[P2[i] for i in range(npal,16)]
    W,H=L['width'],L['height']
    d=open(get(g,L['blockdata_filepath']),'rb').read(); cells=struct.unpack('<%dH'%(len(d)//2),d)
    x0,y0,x1,y1=box or (0,0,W,H)
    im=Image.new('RGB',((x1-x0)*16,(y1-y0)*16),(0,0,0)); px=im.load()
    def tile(i):
        if i<ntile: return T1[i] if i<len(T1) else None
        j=i-ntile; return T2[j] if j<len(T2) else None
    def meta(i):
        if i<ntile: return M1[i] if i<len(M1) else None
        j=i-ntile; return M2[j] if j<len(M2) else None
    for cy in range(y0,y1):
        for cx in range(x0,x1):
            ent=meta(cells[cy*W+cx]&0x3FF)
            if not ent: continue
            for layer in (0,1):
                for k in range(4):
                    e=ent[layer*4+k]; t=tile(e&0x3FF)
                    if t is None: continue
                    hf=e&0x400; vf=e&0x800; p=(e>>12)&15
                    if PAL[p] is None: continue
                    for y in range(8):
                        for x in range(8):
                            c=t[7-y if vf else y][7-x if hf else x]
                            if c==0 and layer==1: continue
                            px[(cx-x0)*16+(k%2)*8+x,(cy-y0)*16+(k//2)*8+y]=PAL[p][c]
    im.save(out); return im.size
if __name__=='__main__':
    print(render(sys.argv[1],sys.argv[2],sys.argv[3]))
