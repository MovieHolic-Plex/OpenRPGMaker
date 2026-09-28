# v4 ground: the chipset's own grass tiles mixed by clustered noise instead of one lawn tile everywhere.
#   base lawn (chipset 0,128) / light meadow (304,304) / dark shade grass (112,2144) under and near trees /
#   small yellow-flower grass (112,608) / worn olive grass (centre of 16,1776) along street curbs and yard gates.
# Patch edges are dithered per pixel (clustered, never salt-and-pepper per cell).
import numpy as np
from PIL import Image, ImageFilter
import pz
def tex(x,y,w=16,h=16): return np.array(pz.chip(x,y,w,h).convert('RGB')).astype(np.uint8)
def tiled(t,W,H):
    ry=-(-H//t.shape[0]); rx=-(-W//t.shape[1]); return np.tile(t,(ry,rx,1))[:H,:W]
def smooth(W,H,sc,seed):
    r=np.random.RandomState(seed).rand(H//sc+3,W//sc+3)
    im=Image.fromarray((r*255).astype(np.uint8)).resize(((W//sc+3)*sc,(H//sc+3)*sc),Image.BICUBIC)
    return np.array(im)[:H,:W].astype(float)/255
TEX={'lawn':(0,128),'meadow':(304,304),'shade':(112,2144),'flower':(112,608)}
def render(W,H,trees_px,road_mask,seed=4):
    # W,H in px; trees_px = [(x,y,w,h)] canopy boxes; road_mask = HxW bool of paved pixels (streets, squares)
    L={k:tiled(tex(*v),W,H) for k,v in TEX.items()}
    wc=tex(16,1776)[4:12,4:12]; L['worn']=tiled(wc,W,H)
    dither=np.random.RandomState(seed).rand(H,W)*0.10-0.05
    out=L['lawn'].copy(); lab=np.zeros((H,W),np.uint8)
    n1=smooth(W,H,72,seed)*0.7+smooth(W,H,24,seed+1)*0.3
    m=(n1+dither)>0.60; out[m]=L['meadow'][m]; lab[m]=1
    tm=Image.new('L',(W,H),0)
    for x,y,w,h in trees_px: tm.paste(255,(max(0,x),max(0,y+h//3),min(W,x+w),min(H,y+h+6)))
    tb=np.array(tm.filter(ImageFilter.GaussianBlur(9))).astype(float)/255
    n2=smooth(W,H,40,seed+2)
    m=((tb*0.8+n2*0.35+dither)>0.62)|((n2+dither)>0.83); out[m]=L['shade'][m]; lab[m]=2
    n3=smooth(W,H,20,seed+3)*0.65+smooth(W,H,56,seed+4)*0.35
    m=((n3+dither)>0.70)&(lab!=2); out[m]=L['flower'][m]; lab[m]=3
    rm=Image.fromarray((road_mask*255).astype(np.uint8)).filter(ImageFilter.MaxFilter(7))
    near=(np.array(rm)>0)&(~road_mask)
    n4=smooth(W,H,12,seed+5)
    m=near&((n4+dither)>0.52); out[m]=L['worn'][m]; lab[m]=4
    return Image.fromarray(out).convert('RGBA'), lab
