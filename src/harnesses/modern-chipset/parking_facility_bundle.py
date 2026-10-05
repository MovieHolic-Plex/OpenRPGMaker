"""Publish the exact allowed whole parking demo through the native modern_city baker."""
import json
from pathlib import Path
import shutil
from PIL import Image
import bake_lib as BL
from parking_bundle import read,write,sha,fingerprint

MANIFEST=Path('tiledata/modern-city/parking-facility/manifest.json')
KIT='mc-parking-facility'


def stage(root,data,cid):
    import sys,os
    os.environ['SUPER_HARNESS_DATA']=str(data)
    sys.path.insert(0,str(root/'src/harnesses/super-harness'))
    import art_choices,art_acceptance,art_layout
    if Path(art_choices.store.DATA).resolve()!=Path(data).resolve():raise ValueError('선택 저장소와 게시 데이터 경로가 다릅니다.')
    view=art_choices.view(data,cid)
    if not view['complete'] or not view['demo']:raise ValueError('현재 전체 데모의 검수·Allow가 필요합니다.')
    selected=art_choices.selections(cid)['space-demo'];chosen=json.loads(selected['source_json'])
    work=Path(data)/'art-worktrees'/cid;folder=Path(data)/'concepts'/cid
    for r in chosen['sources']+[chosen['sheet']]:art_choices.verified(work,r)
    acceptance=folder/'art-acceptance.json'
    art_acceptance.validate(chosen['contextReview'],{'sha256':sha(acceptance),'contract':read(acceptance)},art_layout.SCENE_CHECKS)
    request=read(folder/'art-execution.json');contract_path=work/request['data']/'parking-contract.json';c=read(contract_path)
    if c['scope']!='parking-facility-v1' or chosen['contextReview'].get('facilityVerdict')!='COMPLETE':raise ValueError('전체 시설 PASS 필요')
    receipt_path=next(art_choices.verified(work,r) for r in chosen['sources'] if r['path'].endswith('harness-receipt.json'))
    receipt=read(receipt_path);letter=chosen['components']['parking-kit']
    native=next(r for r in receipt['candidates'] if r['candidate']==letter)
    scene_path=art_choices.verified(work,chosen['sheet'])
    if native['imageSha256']!=sha(scene_path) or receipt['contractSha256']!=sha(contract_path) or native['independent'].get('facilityVerdict')!='PASS':raise ValueError('선택과 native 검수의 그림/명세 불일치')
    out=root/MANIFEST.parent;out.mkdir(parents=True,exist_ok=True);refs={}
    for name,source in {'scene.png':scene_path,'environment.png':receipt_path.parent/(letter+'-base.png'),'contract.json':contract_path,'receipt.json':receipt_path,'acceptance.json':acceptance}.items():
        shutil.copy2(source,out/name);refs[name]={'path':str((out/name).relative_to(root)),'sha256':sha(out/name)}
    upper=Image.new('RGBA',tuple(c['canvas'])); kits=read(art_choices.verified(work,c['inventory']['kits']))['structureKits'];sheet=Image.open(art_choices.verified(work,c['inventory']['sheet'])).convert('RGBA')
    for p in sorted(c['vehicles']+c['sharedProps'],key=lambda p:p['depth']):
        if 'path' in p:asset=Image.open(art_choices.verified(work,p)).convert('RGBA')
        else:
            kit=next(k for k in kits if k['id']==p['kit']);asset=Image.new('RGBA',(kit['width']*16,kit['height']*16))
            for y,row in enumerate(kit['rows']):
                for layer in ['tiles','upperTiles']:
                    for x,tile in enumerate(row.get(layer,[])):
                        if tile>=0:asset.alpha_composite(sheet.crop((tile%48*16,tile//48*16,tile%48*16+16,tile//48*16+16)),(x*16,y*16))
        upper.alpha_composite(asset,tuple(p['origin']))
    upper.save(out/'upper.png');refs['upper.png']={'path':str((out/'upper.png').relative_to(root)),'sha256':sha(out/'upper.png')}
    joined=Image.open(out/'environment.png').convert('RGBA');joined.alpha_composite(upper)
    if not BL.same_image(joined,Image.open(scene_path)):raise ValueError('공용 2층 분해가 승인 화소를 바꿉니다.')
    write(out/'selection.json',{'fingerprint':selected['fingerprint'],'chosen':chosen,'selectedAt':selected['selected_at']})
    refs['selection.json']={'path':str((out/'selection.json').relative_to(root)),'sha256':sha(out/'selection.json')}
    write(root/MANIFEST,{'version':1,'concept':cid,'kit':KIT,'sources':refs})
    return refs


def load(root,make_item):
    root=Path(root)
    if not (root/MANIFEST).exists():return []
    refs=read(root/MANIFEST)['sources']
    for ref in refs.values():
        p=(root/ref['path']).resolve()
        if not p.is_relative_to(root.resolve()) or sha(p)!=ref['sha256']:raise ValueError('시설 게시 원본 해시 변경')
    proof=read(root/refs['selection.json']['path']);chosen=proof['chosen'];candidate={k:v for k,v in chosen.items() if k not in ('contextReview','selectionActor')}
    if fingerprint({'candidate':candidate,'contextReview':chosen['contextReview']})!=proof['fingerprint'] or chosen['contextReview']['verdict']!='PASS' or chosen['sheet']['sha256']!=refs['scene.png']['sha256']:raise ValueError('시설 선택 해시/판정 불일치')
    import sys
    sys.path.insert(0,str(root/'src/harnesses/super-harness'))
    import art_acceptance,art_layout
    context=chosen['contextReview']
    if (candidate.get('phase')!='scene' or not candidate.get('passed')
            or context.get('fingerprint')!=fingerprint(candidate)
            or context.get('facilityVerdict')!='COMPLETE'
            or context.get('acceptanceSha256')!=refs['acceptance.json']['sha256']):raise ValueError('현재 시설 승인 조건 불일치')
    art_acceptance.validate(context,{'sha256':refs['acceptance.json']['sha256'],
        'contract':read(root/refs['acceptance.json']['path'])},art_layout.SCENE_CHECKS)
    if not any(ref.get('sha256')==refs['receipt.json']['sha256'] for ref in candidate['sources']):raise ValueError('선택된 native 검수 근거 불일치')
    receipt=read(root/refs['receipt.json']['path'])
    native=next(row for row in receipt['candidates'] if row['candidate']==candidate['components']['parking-kit'])
    if (receipt['contractSha256']!=refs['contract.json']['sha256'] or native['imageSha256']!=refs['scene.png']['sha256']
            or native['independent'].get('verdict')!='PASS' or native['independent'].get('facilityVerdict')!='PASS'):raise ValueError('native 시설 PASS 근거 불일치')
    c=read(root/refs['contract.json']['path']);base=Image.open(root/refs['environment.png']['path']).convert('RGBA');upper=Image.open(root/refs['upper.png']['path']).convert('RGBA');scene=Image.open(root/refs['scene.png']['path']).convert('RGBA')
    joined=base.copy();joined.alpha_composite(upper)
    if not BL.same_image(joined,scene):raise ValueError('시설 두 층 재조립 불일치')
    boxes=list(c['walls'].values())+c['columns']+[p['top'] for p in c['wheelStops']]
    # The far-left outside column is solid except at the entrance opening.
    ex,ey,ew,eh=c['entranceRamp'];boxes += [[0,0,16,ey],[0,ey+eh,16,c['canvas'][1]-ey-eh]]
    ground=[p['footprint'] for p in c['vehicles']]
    ground += [[p['origin'][0],p['depth']-16,32,16] for p in c['sharedProps']]
    def hits(x,y,rects):return any(x*16<l+w and (x+1)*16>l and y*16<t+h and (y+1)*16>t for l,t,w,h in rects)
    grid=[[(im,'solidfloor' if hits(x,y,boxes) else 'floor') for x,im in enumerate(row)] for y,row in enumerate(BL.cut(base))]
    overlay=[[(None,None) if BL.empty(im) else (im,'solid' if hits(x,y,ground) else 'star') for x,im in enumerate(row)] for y,row in enumerate(BL.cut(upper))]
    return [make_item(id=KIT,kind='scene',cat='parking',name='지하 주차장 · 12면 완성 데모',ko='지하 주차장',layer='lower',grid=grid,upperGrid=overlay,expected=scene,group='parking-facility',gname='지하 주차장 · 시설',grole='terrain',gdesc='현재 Allow한 시설 그림의 두 층 키트.',grules='원본 크기 전체 키트. 바닥·벽과 차량 위층을 함께 배치.',tmeta_role='terrain',tags=['modern-city','parking','approved-facility'],desc='12면/6대. 보행용 정적 시설. 차량 운전·문/차단기 상태 변화는 포함하지 않는다.',rules='벽·차량 발 줄은 막힘. 차체 윗줄은 솟은 칸. 입구와 두 통로를 유지.',parts=[],repeatability='fixed',meta=dict(kind='scene',source=refs['scene.png'],door=None,anchor=dict(dx=0,dy=0,note='승인 그림 왼쪽 위'),access=[],selectionFingerprint=proof['fingerprint']))]


def references(root):
    root=Path(root);definition=read(root/'src/assets/modernCityTileset.json')
    kit=next(k for k in definition['structureKits'] if k['id']==KIT)
    dest=root/'public/assets/modern-city/parking-facility.png';shutil.copy2(root/MANIFEST.parent/'scene.png',dest)
    md='# 지하 주차장 12면 · 승인 데모\n\n원본 448×288, 28×18칸. 아래층은 환경, 위층은 차량/차단기. 벽/차량 발은 막힘, 솟은 차체는 ★.\n서측 입구와 두 차로/보행로를 연결한다. 키트 전체를 원점에 찍고 회전/확대하지 않는다. 차량 운전/출입문 개폐 기능은 없다.\n\n## 전체 2층 배열\n```json\n'+json.dumps(kit,ensure_ascii=False)+'\n```\n\n원본 사전: contract.json의 픽셀 좌표를 16으로 나눈다. vehicles.footprint와 walls/columns/wheelStops는 장애물 근거다. manifest.json은 native·독립 검수·사용자 선택 해시를 보존한다.\n\n정상: 두 층 전체 배치. 오류: upperTiles를 지우면 차량이 사라진다. 차체를 아래층에 합치면 사람과의 가림이 깨진다. 막힘과 ★를 서로 바꾸지 않는다.\n'
    contract=read(root/MANIFEST.parent/'contract.json')
    md+='\n## 원본 픽셀 좌표 사전\n```json\n'+json.dumps({key:contract[key] for key in ('walls','columns','vehicles','sharedProps','wheelStops','entranceRamp','aisles','walkways','southConnector')},ensure_ascii=False,indent=2)+'\n```\n'
    scene=Image.open(root/MANIFEST.parent/'scene.png').convert('RGBA')
    environment=Image.open(root/MANIFEST.parent/'environment.png').convert('RGBA')
    compare=Image.new('RGBA',(scene.width*2,scene.height))
    compare.alpha_composite(scene,(0,0));compare.alpha_composite(environment,(scene.width,0))
    compare.save(root/'public/assets/modern-city/parking-facility-layers.png')
    md+='\n## 정상/오류 비교\n왼쪽 정상(두 층), 오른쪽 오류(위층 누락). 오른쪽은 차량 6대와 차단봉이 사라진다.\n![정상과 위층 누락](/assets/modern-city/parking-facility-layers.png)\n'
    write(root/MANIFEST.parent/'recipe.json',dict(id=KIT,name='지하 주차장 · 12면',tilesetId=definition['id'],width=kit['width'],height=kit['height'],rows=kit['rows'],start=[3,16],targets=[[0,16],[3,2],[3,8],[15,2],[15,8],[26,15]],blocked=[[0,0],[2,0],[9,3],[22,7],[13,5],[27,8]]))
    (root/MANIFEST.parent/'assembly.md').write_text(md)
    return dict(id='mc-parking-facility',name='지하 주차장 · 12면',description='Allow한 시설 데모의 원본·층별 배열·통행 계약.',documents=[dict(id='mc-parking-facility-assembly',name='전체 배열·원본 좌표·정상/오류',markdown=md)],images=[dict(id='mc-parking-facility',name='승인된 전체 공간',caption='원본 1배, 12면/6대.',dataUrl='/assets/modern-city/parking-facility.png'),dict(id='mc-parking-facility-layers',name='정상/위층 누락',caption='왼쪽 정상, 오른쪽 upperTiles 누락 오류.',dataUrl='/assets/modern-city/parking-facility-layers.png')])
