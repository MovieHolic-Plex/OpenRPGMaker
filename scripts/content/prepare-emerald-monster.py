#!/usr/bin/env python3
"""Publish seven original coordinate-authored atlases and exact-index assembly samples.
No project/database access. Structural definitions stay owned by monsterKitSheets.
"""
import sys,json,re,hashlib,importlib,contextlib,io
from pathlib import Path
from PIL import Image,ImageChops
ROOT=Path(__file__).resolve().parents[2]
H=ROOT/'src/harnesses/tileset-authoring'
sys.path[:0]=[str(H),str(H/'recipes'),str(H/'lib')]
import harness,emerald_monster
THEMES=['overworld','wild','coast','climate','rooms','dungeon','gyms']

def load(theme):
    s=json.loads((ROOT/'harness-data/tileset-authoring'/theme/'seed.json').read_text())
    if s.get('extends'):s=harness._merge(load(s['extends']),{k:v for k,v in s.items() if k!='extends'})
    return s

def render(m,sheet):
    im=Image.new('RGBA',(m['width']*16,m['height']*16),(0,0,0,255))
    for layer in ('lower','upper'):
        for n,t in enumerate(m[layer]):
            if t<0:continue
            assert t < sheet.height//16*16
            im.alpha_composite(sheet.crop((t%16*16,t//16*16,t%16*16+16,t//16*16+16)),(n%m['width']*16,n//m['width']*16))
    return im

def main():
    only=sys.argv[1] if len(sys.argv)>1 else None
    source=json.loads((ROOT/'tiledata/emerald-monster/source-references.json').read_text())
    assert not only or only in THEMES, 'Unknown theme'
    manifest=[]; refs={}; proofs=[]
    if only:
        manifest=[x for x in json.loads((ROOT/'src/assets/emeraldMonsterKitIndex.json').read_text()) if x['theme']!='emerald-monster-'+only]
        refs=json.loads((ROOT/'src/assets/emeraldMonsterReferences.json').read_text());refs.pop('tex_emerald_monster_'+only,None)
        proofs=[x for x in json.loads((ROOT/'tiledata/emerald-monster/preservation-manifest.json').read_text()) if x['theme']!=only]
    output=ROOT/'public/assets/emerald-monster/tiles';output.mkdir(parents=True,exist_ok=True)
    for th in THEMES:
        if only and only!=th:continue
        seed=load('emerald-monster-'+th)
        # Capture original native enumeration before any style change. Dynamic bow
        # frame detection must not shift later tiles when calm water changes pixels.
        recipe=importlib.import_module('monster_'+th)
        saved=emerald_monster.mo.pick_by_gate
        emerald_monster.mo.pick_by_gate=emerald_monster.select_native_seed
        try:
            with contextlib.redirect_stdout(io.StringIO()):ledger=recipe.build(load('monster-'+th))
        finally:emerald_monster.mo.pick_by_gate=saved
        with contextlib.redirect_stdout(io.StringIO()):drawn=emerald_monster.build(seed)
        sh=type(ledger)(ledger.cols);sh.tiles=list(ledger.tiles)
        sh.ids=dict(ledger.ids);sh.anim=ledger.anim;sh.sections=ledger.sections
        for name,i in ledger.ids.items():
            if name in drawn.ids:sh.tiles[i]=drawn.tiles[drawn.ids[name]]
            else:
                # A ship water sliver can become visually constant across frames.
                # Preserve its original four reserved slots and use its calm f0.
                match=re.fullmatch(r'sh_bow_(\d+)_(\d+)_f[123]',name)
                assert match,('native tile disappeared',th,name)
                base=f'sh_bow.{match[1]}.{match[2]}'
                sh.tiles[i]=drawn.tiles[drawn.ids[base]]
        sheet=sh.image()
        original=json.loads((ROOT/'src/assets/monsterKit'/('monster-'+th+'.json')).read_text())
        oldsheet=Image.open(ROOT/'public/assets/monster-kit'/('monster-'+th+'.png')).convert('RGBA')
        assert len(sh.tiles)==original['count'],(th,len(sh.tiles),original['count'])
        assert sheet.size==oldsheet.size,(th,sheet.size,oldsheet.size)
        olddict=next(d['markdown'] for c in source[th] for d in c['documents'] if d['id'].endswith('-dict'))
        names={name:int(i) for i,name in re.findall(r'^(\d+) (\S+) —',olddict,re.M)}
        mismatches=[(name,i,sh.ids.get(name)) for name,i in names.items() if sh.ids.get(name)!=i]
        assert not mismatches,(th,mismatches[:8])
        for n in range(original['count']):
            box=(n%16*16,n//16*16,n%16*16+16,n//16*16+16)
            a,b=oldsheet.crop(box),sheet.crop(box)
            assert not a.getbbox() or b.getbbox(),('tile became empty',th,n)
            assert a.getchannel('A').getextrema()!=(255,255) or b.getchannel('A').getextrema()==(255,255),('opaque backing lost',th,n)
        sheet.save(output/(th+'.png'))
        newId='emerald_monster_'+th;tex='tex_'+newId
        manifest.append(dict(theme='emerald-monster-'+th,id=newId,sourceTextureKey='tex_monster_'+th,textureKey=tex,name='에메랄드 몬스터 · '+th,path='assets/emerald-monster/tiles/'+th+'.png',count=original['count'],tilesPerRow=16,tileSize=16))
        categories=json.loads(json.dumps(source[th])); samples=ROOT/'public/assets/emerald-monster/references'/th;samples.mkdir(parents=True,exist_ok=True)
        transformed=[]
        for cat in categories:
            oldcat=cat['id'];cat['id']='emerald-'+oldcat;cat['name']='Emerald · '+cat['name']
            cat['description']='원본 번호·통행·킷 보존. Emerald 원본 도트 변형. '+cat['description']
            for doc in cat['documents']:
                olddoc=doc['id'];doc['id']='emerald-'+olddoc
                for raw in re.findall(r'```json\n(.*?)```',doc['markdown'],re.S):
                    m=json.loads(raw)
                    if isinstance(m,dict) and all(k in m for k in ('width','height','lower','upper')):
                        assert len(m['lower'])==len(m['upper'])==m['width']*m['height']
                        sample=olddoc.split('-ex-',1)[-1];im=render(m,sheet);im.save(samples/(sample+'.png'))
                        before=render(m,oldsheet)
                        pair=Image.new('RGBA',(im.width*2+8,im.height),(220,220,220,255));pair.alpha_composite(before,(0,0));pair.alpha_composite(im,(im.width+8,0));pair.save(samples/(sample+'-before-after.png'))
                        transformed.append(sample)
                doc['markdown']=doc['markdown'].replace('monster_'+th,newId).replace('tex_monster_'+th,tex).replace('public/assets/monster-kit/monster-'+th+'.png','public/'+manifest[-1]['path'])
                doc['markdown']=doc['markdown'].replace('monster-'+th+'-', 'emerald-monster-'+th+'-')
                doc['markdown']='> Emerald 변형: 조립 번호는 원본과 동일합니다. 노란 풀/그물 물결을 차분한 민트 풀/짧은 수평 물결로 바꾸고 수관 덩이·지붕 기와를 다시 저작했습니다. 사막·눈·재·용암·리그 테마는 보존합니다.\n\n'+doc['markdown']
            for img in cat['images']:
                sample=img['name'].removesuffix('.png')
                if sample in transformed:img['dataUrl']='/assets/emerald-monster/references/'+th+'/'+sample+'.png'
                else:img['caption']='원본 조립 오류 진단 그림(원본 색). 동일 번호·통행을 공유하는 Emerald 변형에도 적용. '+img['caption']
        categories.insert(0,dict(id='emerald-assembly-'+th,name='Emerald 조립과 판본',description='원본 도트 7종·안정 번호·층·입구·기후별 재료 계약',documents=[dict(id='emerald-assembly-'+th,name='Emerald 조립 안내',markdown=(ROOT/'tiledata/emerald-monster'/('assembly-'+th+'.md')).read_text())],images=[]))
        refs[tex]=categories
        changed=sum(a!=b for a,b in zip(sheet.getdata(),oldsheet.getdata()))
        proofs.append(dict(theme=th,count=original['count'],width=sheet.width,height=sheet.height,pixelBoundsChecked=original['count'],lostTiles=0,lostOpaqueBacking=0,namedIndicesChecked=len(names),nativeNamesChecked=len(ledger.ids),indexMismatches=0,changedPixels=changed,definitionSource='monsterKitSheets.generated.ts',preserved=['tileSize','tilesPerRow','count','passability','priority','terrain','tileMeta','animationStrips','autotileGroups','structureKits','ledgeDirections','slideTiles'],samples=transformed,sha256=hashlib.sha256((output/(th+'.png')).read_bytes()).hexdigest()))
        print(th,sheet.size,len(names),'indices preserved;',changed,'changed pixels;',len(transformed),'samples',flush=True)
    manifest.sort(key=lambda x:THEMES.index(x['theme'].removeprefix('emerald-monster-')))
    proofs.sort(key=lambda x:THEMES.index(x['theme']))
    (ROOT/'src/assets/emeraldMonsterKitIndex.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n')
    (ROOT/'src/assets/emeraldMonsterReferences.json').write_text(json.dumps(refs,ensure_ascii=False,separators=(',',':'))+'\n')
    (ROOT/'tiledata/emerald-monster/preservation-manifest.json').write_text(json.dumps(proofs,indent=2)+'\n')
if __name__=='__main__':main()
