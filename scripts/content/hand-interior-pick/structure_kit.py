"""Native interior-props compound terrain/structure contract. Never draws assets.

A flat transport canvas carries several individually specified parts. Its atlas
footprint is not a map footprint; masks and origins belong to each part.
"""
import json, os
from pathlib import Path
import numpy as np
from PIL import Image
from common import ROOT, CAND, CONTENT_ROOT, objects_by_id, slug


def contract(o):
    return o.get('structuralKit')


def check(a, o, res):
    kit = contract(o); errors = []; reports = []
    for p in kit['parts']:
        x,y,w,h = p['rect']; b = a[y:y+h,x:x+w]
        if b.shape[:2] != (h,w) or not (b[...,3] > 0).any():
            errors.append('kit: missing/outside part '+p['id']); continue
        if len(p['walk']) != h//16 or any(len(row)!=w//16 or set(row)-set('.X') for row in p['walk']):
            errors.append('kit: invalid walk mask '+p['id'])
        r = {'id':p['id'],'rect':p['rect'],'walk':p['walk'],'layer':p['layer']}
        if p.get('surfaceMasks'):
            for key, rows in p['surfaceMasks'].items():
                if len(rows) != h or any(len(row) != w or set(row)-set('01') for row in rows):
                    errors.append('kit: invalid 2D mask '+p['id']+' '+key); continue
                mask = np.array([[c == '1' for c in row] for row in rows])
                pixels = int(mask.sum())
                r[key+'MaskPixels'] = pixels
                if not pixels: continue
                cover = float((b[...,3][mask] == 255).mean())
                r[key+'Cover'] = cover
                if key != 'occlusion' and cover < 0.5:
                    errors.append('kit: '+p['id']+' '+key+' 2D coverage <50%')
        else:
            for key in ('top','front'):
                if p.get(key) is None: continue
                y0,y1=p[key]
                cover=float((b[y0:y1+1,:,3]==255).mean())
                r[key+'Cover']=cover
                if y0<0 or y1>=h or y1<y0 or cover<0.5:
                    errors.append(f"kit: {p['id']} {key} band missing (<50% coverage)")
        if p.get('repeat'):
            if not (b[...,3]==255).all():errors.append('kit: water must fill every terrain pixel')
            seams=[float(np.abs(b[:,0,:3].astype(float)-b[:,-1,:3]).mean()),float(np.abs(b[0,:,:3].astype(float)-b[-1,:,:3]).mean())]
            r['edgeMeanDelta']=seams
            if max(seams)>24:errors.append('kit: repeat edge color discontinuity '+p['id'])
        if p['id'].startswith('door_') and (b[16:32,:,3]>0).any():
            errors.append('kit: doorway one-cell east/west clearance is occluded '+p['id'])
        reports.append(r)
    res['structuralParts']=reports
    return errors


def scene_contract(o):
    return json.loads((Path(ROOT)/contract(o)['scene']).read_text())


def context(o, slot=None):
    """Composite only native submitted parts and existing bundled tiles.
    Absent native assets stay void and are listed in the scene manifest.
    """
    s=scene_contract(o);g=s['diagram'];W=len(g[0]);H=len(g)
    spec=json.loads((Path(ROOT)/'src/assets/handInteriorSpec.json').read_text())
    atlas=Image.open(Path(ROOT)/'public/assets/atlas-interior/interior-chipset.png').convert('RGBA')
    def tile(n):return atlas.crop(((n%48)*16,(n//48)*16,(n%48+1)*16,(n//48+1)*16))
    im=Image.new('RGBA',(W*16,H*16),(16,14,18,255))
    wet=spec['floors']['wetstone']; wall=spec['walls']['dungeonw']
    for y,row in enumerate(g):
        for x,ch in enumerate(row):
            if ch not in '#SWBC':
                n=wet['tiles'][((y%wet['rows'])*wet['cols']+x%wet['cols'])*4]
                im.alpha_composite(tile(n),(x*16,y*16))
    # Scene reservation and composition share one explicit placement table.
    found={};missing=[]
    for i,parts in s['parts'].items():
        image=slot if i==o['id'] and slot is not None else None
        if image is None:
            d=Path(CAND)/slug(i)
            files=list(d.glob('h*-A.png'))
            if files:image=Image.open(max(files,key=lambda p:p.stat().st_mtime_ns)).convert('RGBA')
        if image is None:missing.append(i);continue
        for p in parts:
            x,y,w,h=p['rect'];found[(i,p['id'])]=image.crop((x,y,x+w,y+h))
    # Fill water below bridges before all structural overlays.
    water=found.get(('sewer_shallow_effluent','water'))
    if water:
        for y,row in enumerate(g):
            for x,ch in enumerate(row):
                if ch in 'WBC':
                    dx=(x-s['waterOrigin'][0])%4;dy=(y-s['waterOrigin'][1])%2
                    im.alpha_composite(water.crop((dx*16,dy*16,(dx+1)*16,(dy+1)*16)),(x*16,y*16))
    for entry in s['placements']:
        x,y=entry['origin'];key=entry['part'];item=entry.get('item')
        if item:
            image=found.get((item,key))
            if image is not None:
                dx,dy=entry.get('renderOffset',[0,0])
                if entry.get('clipToStructure'):
                    overlay=Image.new('RGBA',im.size)
                    overlay.alpha_composite(image,(x*16+dx,y*16+dy))
                    alpha=np.array(overlay.getchannel('A'))
                    allowed=np.repeat(np.repeat(np.array([[c=='S' for c in row] for row in g]),16,axis=0),16,axis=1)
                    alpha[~allowed]=0
                    overlay.putalpha(Image.fromarray(alpha))
                    im.alpha_composite(overlay)
                else:
                    im.alpha_composite(image,(x*16+dx,y*16+dy))
        elif key=='dark':
            im.alpha_composite(tile(spec['ceilings']['dark'][1]),(x*16,y*16))
        elif key=='dungeonw':
            row=0 if entry['role']=='top' else 1
            im.alpha_composite(tile(wall['tiles'][(row*wall['cols']+x%wall['cols'])*2]),(x*16,y*16))
    gx,gy=s['builtinPlacements']['drain grate']
    for dx,dy,n,layer in spec['objects']['drain grate']['cells']:
        im.alpha_composite(tile(n),((gx+dx)*16,(gy+dy)*16))
    return im, 'sewer native structure scene; missing=' + ','.join(missing)


def review_gate(o,v):
    """Independent observations mandatory for every actual part."""
    if v.get('verdict')!='PASS':return
    reasons=[];obs=v.get('parts',{})
    for p in contract(o)['parts']:
        r=obs.get(p['id'],{})
        if r.get('verdict')!='PASS' or len(str(r.get('evidence','')))<20:
            reasons.append(p['id']+': independent part evidence absent/failing')
        if p.get('surfaceMasks'):
            for key, rows in p['surfaceMasks'].items():
                minimum=sum(row.count('1') for row in rows)
                if not minimum: continue
                observed=r.get(key+'Pixels')
                if not isinstance(observed,int) or isinstance(observed,bool) or observed < minimum:
                    reasons.append(p['id']+': '+key+' 2D pixels too small/unmeasured')
        else:
            for key in ('top','front'):
                if p.get(key) is not None:
                    rows=r.get(key+'Rows')
                    if not isinstance(rows,int) or rows<p[key][1]-p[key][0]+1:
                        reasons.append(p['id']+': '+key+' projected surface too small/unmeasured')
    for key in ('repeat','joins','circulation','projection','style','assembly'):
        r=v.get('checks',{}).get(key,{})
        if r.get('verdict')!='PASS' or len(str(r.get('evidence','')))<20:reasons.append(key+': independent evidence absent/failing')
    if reasons:
        v.update(verdict='FAIL',codes=sorted(set(v.get('codes',[])+['KIT'])),reasons='; '.join(reasons)+' '+str(v.get('reasons','')),fix='Measure and repair each missing surface/join before a new authorized round.')
