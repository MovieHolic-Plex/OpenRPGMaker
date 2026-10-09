#!/usr/bin/env python3
"""Kit contract for the shared beodeul_city tileset (spec: tiledata/beodeul-kits/SPEC.md).

  python3 scripts/content/beodeul-kits/contract.py check            report violations, change nothing
  python3 scripts/content/beodeul-kits/contract.py apply            retrofit tall-object footprints into src/assets/beodeulCityTileset.json
  python3 scripts/content/beodeul-kits/contract.py check --json     machine-readable

Footprint rule (walk-behind): a tall soft object (tree, bush, lamp, statue, column, signpost) blocks ONLY the cells where it touches
the ground — the bottom row, and only cells whose lower half is really painted. Every cell above it is walkable and drawn over the
player (priority "upper"), so a character can walk behind a trunk and is hidden by the canopy.
Passability is per tile in the sheet and tiles are shared between kits and the town map (identical pixels = one tile), so a tile is
opened unless it is a foot cell of some tall object. Opened tile ids are listed in the JSON key `footprintOpened`; beodeulCity.ts copies them
into existing projects (cells below the picks tail are otherwise not synced).
"""
import json, os, re, sys
from PIL import Image
ROOT=os.path.abspath(os.path.join(os.path.dirname(__file__),'..','..','..'));T=16
_S=os.environ.get('BEODEUL_PACK_SCRATCH')
JSON_PATH=f'{_S}/beodeulCityTileset.json' if _S else f'{ROOT}/src/assets/beodeulCityTileset.json';SHEET=f'{_S}/beodeul-city-chipset.png' if _S else f'{ROOT}/public/assets/beodeul-city/beodeul-city-chipset.png'
SOFT=re.compile(r'^bd-(tree-|prop-(lamp_|statue|column)|mpart-(bush|lamp-post|cypress-tub|shrub-tub)|out-signpost|pick-[a-z-]+-(fir|pine|alpine|lamp|lantern-post|lamppost|cypress|hunter-post|column))')
SKIP=re.compile(r'(fallen|broken|chimney|bonfire|campfire|firewood)')
MARK='걷기 규칙: '
RULE_TEXT=MARK+'맨 아랫줄(땅에 닿는 칸)만 막힌다. 그 위 칸(수관·등·꼭대기)은 지나갈 수 있고 캐릭터를 가린다 — 뒤로 걸어 지나갈 자리를 남긴다.'
def is_soft(k):return bool(SOFT.search(k['id'])) and not SKIP.search(k['id']) and k['height']>=2 or (k['id'].startswith('bd-tree-') and k['height']>=2)
def load():
    ts=json.load(open(JSON_PATH));sheet=Image.open(SHEET).convert('RGBA');return ts,sheet
def cell(sheet,n,per):return sheet.crop((n%per*T,n//per*T,n%per*T+T,n//per*T+T))
def foot_cells(ts,sheet,k):
    """Bottom-row columns that are actually painted in their lower half (the ground contact)."""
    per=ts['tilesPerRow'];r=k['rows'][-1];out=[]
    for x in range(k['width']):
        n=(r.get('upperTiles') or [-1]*k['width'])[x]
        if n<0:n=(r.get('tiles') or [-1]*k['width'])[x]
        if n<0:continue
        a=cell(sheet,n,per).getchannel('A').crop((0,8,16,16));solid=sum(1 for v in a.getdata() if v>128)
        if solid>=14:out.append(x)
    return out
def tiles_of(k,x=None,y=None):
    s=set()
    for yy,r in enumerate(k['rows']):
        if y is not None and yy!=y:continue
        for key in('tiles','upperTiles'):
            for xx,n in enumerate(r.get(key) or []):
                if n>=0 and (x is None or xx==x):s.add(n)
    return s
def analyse(ts,sheet):
    kits=ts['structureKits'];soft=[k for k in kits if is_soft(k)];soft_ids={k['id'] for k in soft}
    keep=set()                       # tiles that must stay blocked: a foot cell of any tall object
    # (identical pixels share one tile, so a canopy tile that also appears inside a big scene kit — harbour, cathedral — is the same leaves there.)
    per_kit={}
    for k in soft:
        feet=foot_cells(ts,sheet,k);foot=set()
        for x in feet:foot|=tiles_of(k,x=x,y=k['height']-1)
        keep|=foot
        per_kit[k['id']]=dict(feet=feet,foot=foot,all=tiles_of(k))
    opened=sorted(set().union(*[v['all']-v['foot'] for v in per_kit.values()])-keep)
    return per_kit,opened,keep
def is_blocked(ts,n):return not any(ts['passability'][n].values())
def check(ts,sheet):
    per_kit,opened,keep=analyse(ts,sheet);rep=dict(violations=[],missingMeta=[],soft=len(per_kit),toOpen=len(opened))
    for k in ts['structureKits']:
        ai=k.get('ai') or {}
        miss=[f for f in('description','placementRules','role','tags') if not ai.get(f)]
        if miss:rep['missingMeta'].append((k['id'],miss))
    for kid,v in per_kit.items():
        stuck=[n for n in sorted(v['all']-v['foot']) if is_blocked(ts,n) and n in opened]
        if stuck:rep['violations'].append((kid,f'{len(stuck)} cells above the ground row block walking'))
    return rep,per_kit,opened
def apply(ts,sheet):
    rep,per_kit,opened=check(ts,sheet);changed=0
    for n in opened:
        if is_blocked(ts,n):ts['passability'][n]=dict(up=True,down=True,left=True,right=True);changed+=1
        ts['priority'][n]='upper'
    for k in ts['structureKits']:
        if k['id'] in per_kit:
            ai=k.setdefault('ai',{});rules=ai.get('placementRules') or ''
            if MARK not in rules:ai['placementRules']=(rules+' · ' if rules else '')+RULE_TEXT;changed+=1
    ts['footprintOpened']=opened
    return changed
def main():
    mode=sys.argv[1] if len(sys.argv)>1 else 'check';ts,sheet=load()
    if mode=='check':
        rep,per_kit,opened=check(ts,sheet)
        if '--json' in sys.argv:print(json.dumps(rep,ensure_ascii=False,indent=1));return
        print(f"soft tall kits {rep['soft']}; tiles to open {rep['toOpen']}; violations {len(rep['violations'])}; kits missing ai meta {len(rep['missingMeta'])}")
        for v in rep['violations'][:50]:print(' ',v)
        for kid,v in list(per_kit.items())[:200]:print(f"  {kid:48s} {len(v['feet'])}/{ts['structureKits'][[k['id'] for k in ts['structureKits']].index(kid)]['width']} foot cells")
    elif mode=='apply':
        n=apply(ts,sheet)
        open(JSON_PATH,'w',encoding='utf8').write(json.dumps(ts,ensure_ascii=False,separators=(',',':'))+'\n')
        print('changed',n,'opened',len(ts['footprintOpened']))
if __name__=='__main__':main()
