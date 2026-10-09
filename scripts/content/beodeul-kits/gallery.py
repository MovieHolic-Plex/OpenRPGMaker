#!/usr/bin/env python3
"""Render every kit of the shared beodeul_city tileset (lower under upper, on its own grass) as galleries, optionally with
the walk/blocked overlay. Evidence for the kit spec (spec.md) and the JRPG coverage table.

  python3 scripts/content/beodeul-kits/gallery.py --out /tmp/gal [--pass] [--prefix bd-pick-snowfield] [--cols 8]
"""
import argparse, json, os, sys
from PIL import Image, ImageDraw
ROOT=os.path.abspath(os.path.join(os.path.dirname(__file__),'..','..','..'))
T=16
def load(tileset=None):
    ts=json.load(open(tileset or f'{ROOT}/src/assets/beodeulCityTileset.json'))
    sheet=Image.open(f'{ROOT}/public/assets/beodeul-city/beodeul-city-chipset.png').convert('RGBA')
    return ts,sheet
def cell(sheet,n,per=128):
    return sheet.crop((n%per*T,n//per*T,n%per*T+T,n//per*T+T))
def render_kit(ts,sheet,kit,bg=(84,160,52,255),overlay=False):
    w,h=kit['width'],kit['height'];per=ts['tilesPerRow']
    im=Image.new('RGBA',(w*T,h*T),bg);ov=Image.new('RGBA',im.size,(0,0,0,0));d=ImageDraw.Draw(ov)
    for y,r in enumerate(kit['rows']):
        for x in range(w):
            for key in ('tiles','upperTiles'):
                n=(r.get(key) or [-1]*w)[x]
                if n is not None and n>=0:
                    im.alpha_composite(cell(sheet,n,per),(x*T,y*T))
            if overlay:
                ns=[n for key in('tiles','upperTiles') for n in [(r.get(key) or [-1]*w)[x]] if n>=0]
                if ns and any(not any(ts['passability'][n].values()) for n in ns):d.rectangle((x*T,y*T,x*T+T-1,y*T+T-1),fill=(220,40,40,110),outline=(255,90,90,220))
                elif ns:d.rectangle((x*T,y*T,x*T+T-1,y*T+T-1),outline=(255,255,255,50))
    im.alpha_composite(ov);return im
def sheetpage(imgs,labels,cols,scale=2,pad=10):
    cw=max(i.width for i in imgs)*scale+pad;ch=max(i.height for i in imgs)*scale+pad+12
    rows=(len(imgs)+cols-1)//cols;board=Image.new('RGBA',(cols*cw,rows*ch),(30,32,36,255));d=ImageDraw.Draw(board)
    for k,(im,l) in enumerate(zip(imgs,labels)):
        x=k%cols*cw+pad//2;y=k//cols*ch+pad//2
        board.alpha_composite(im.resize((im.width*scale,im.height*scale),Image.NEAREST),(x,y));d.text((x,y+im.height*scale+1),l[-30:],fill=(200,200,210,255))
    return board
def main():
    ap=argparse.ArgumentParser();ap.add_argument('--out',required=True);ap.add_argument('--prefix',action='append');ap.add_argument('--pass',dest='ov',action='store_true')
    ap.add_argument('--cols',type=int,default=8);ap.add_argument('--scale',type=int,default=2);ap.add_argument('--tileset');ap.add_argument('--name',default='gallery');a=ap.parse_args()
    ts,sheet=load(a.tileset);kits=[k for k in ts['structureKits'] if not a.prefix or any(k['id'].startswith(p) for p in a.prefix)]
    kits=[k for k in kits if k['width']*k['height']<=60]
    imgs=[render_kit(ts,sheet,k,overlay=a.ov) for k in kits];os.makedirs(a.out,exist_ok=True)
    out=f'{a.out}/{a.name}.png';sheetpage(imgs,[k['id'] for k in kits],a.cols,a.scale).convert('RGB').save(out);print(out,len(kits))
if __name__=='__main__':main()
