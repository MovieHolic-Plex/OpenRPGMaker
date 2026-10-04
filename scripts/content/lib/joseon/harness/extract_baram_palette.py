import numpy as np, json
from PIL import Image, ImageDraw
from sklearn.cluster import KMeans
B='/home/main/third-party-assets/baram/'
R={ # name: (file, box)
 'giwa_gray':('village',(75,58,215,100)),
 'roof_teal':('village',(226,195,370,235)),
 'roof_teal2':('gate',(110,125,430,235)),
 'roof_brown':('village',(425,62,540,100)),
 'red_wall':('village',(75,345,165,380)),
 'stone_wall':('gate',(110,300,440,430)),
 'stone_dark':('gate',(20,190,100,300)),
 'road_stone':('gate',(205,40,340,100)),
 'ground_olive':('village',(280,100,340,150)),
 'thatch':('thatch',(70,45,300,130)),
 'thatch2':('thatch2',(45,35,290,120)),
 'clay_cap':('thatch',(20,28,46,300)),
 'rubble':('thatch',(60,42,390,72)),
 'dirt':('thatch',(140,190,380,320)),
 'dirt2':('thatch2',(5,150,60,250)),
 'grass':('thatch',(0,375,200,400)),
 'plaster':('thatch',(85,142,140,185)),
 'wood_post':('thatch',(62,135,82,205)),
}
out={}
for k,(f,b) in R.items():
    im=Image.open(B+f+'.png').convert('RGB').crop(b)
    a=np.array(im).reshape(-1,3)
    km=KMeans(7,n_init=4,random_state=0).fit(a)
    cs=km.cluster_centers_.astype(int)
    cnt=np.bincount(km.labels_,minlength=7)
    order=np.argsort(cs@[0.3,0.59,0.11])
    out[k]=[(tuple(int(v) for v in cs[i]),int(cnt[i])) for i in order]
json.dump(out,open('regions.json','w'))
# swatch sheet
W=80; H=22
sh=Image.new('RGB',(W*7+150,H*len(out)),(30,30,30)); d=ImageDraw.Draw(sh)
for r,(k,v) in enumerate(out.items()):
    d.text((4,r*H+5),k,fill=(255,255,255))
    for i,(c,n) in enumerate(v):
        d.rectangle([150+i*W,r*H,150+(i+1)*W-2,r*H+H-2],fill=c)
sh.save('swatch.png'); print(sh.size)
