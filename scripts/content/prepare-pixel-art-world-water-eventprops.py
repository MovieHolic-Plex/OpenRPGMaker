"""Water-only metadata from exact user originals. Never writes pixel assets into Git."""
import hashlib,json,sys
from pathlib import Path
from PIL import Image
ROOT=Path(__file__).resolve().parents[2]
def build_water_packs(downloads):
    deps=json.loads((ROOT/'tiledata/pixel-art-world/sewer-water-dependencies.json').read_text());packs=[];audit=[]
    for source in deps['sources']:
        name=source['filename'];path=Path(downloads)/'by-source/sozai/chara'/name
        assert hashlib.sha256(path.read_bytes()).hexdigest()==source['sha256'],name+' edition mismatch'
        image=Image.open(path).convert('RGBA');assert image.size==(source['width'],source['height'])
        small=name=='SC-Water01.png';fw,fh=(32,192)if small else(96,160);frames=[];composites=[];variants=[]
        lengths=[3,4,6]if small else[5]
        for length in lengths:
            start=len(frames)
            for phase in range(4):
                rows=[0,1]+[2]*(length-3)+[3]if small else None
                parts=[{'sourceRect':[phase*32,row*32,32,32],'destination':[0,y*32]}for y,row in enumerate(rows)]if small else[{'sourceRect':[phase*96,0,96,160],'destination':[0,0]}]
                h=length*32;frame=Image.new('RGBA',(fw,h))
                for part in parts:
                    x,y,w,hh=part['sourceRect'];frame.alpha_composite(image.crop((x,y,x+w,y+hh)),tuple(part['destination']))
                alpha=frame.getchannel('A');bbox=alpha.getbbox();assert bbox
                index=len(frames);frames.append({'index':index,'sourceRect':[phase*(32 if small else 96),0,32 if small else 96,128 if small else 160],'sourceAnchor':[16,128]if small else[48,160],'alphaBounds':list(bbox),'nonTransparentPixels':sum(alpha.histogram()[1:]),'pixelSha256':hashlib.sha256(frame.tobytes()).hexdigest(),'atlasOffset':[0,fh-h]})
                composites.append({'index':index,'width':fw,'height':h,'phase':phase,'sourceRows':rows,'parts':parts})
            for kind in['static','loop']:
                variants.append({'id':f'length-{length}-{kind}','name':f'{length}칸 완성 물줄기 · '+('정지 위상0'if kind=='static'else'4위상 반복'),'kind':kind,'direction':'south-facing-wall','parts':[{'x':0,'y':0,'frames':[start]if kind=='static'else list(range(start,start+4))}],'frameTimingMs':120,'timingProvenance':'editor-example-not-author-rate'})
        if not small:assert not image.crop((0,160,384,640)).getchannel('A').getbbox(),'Blank rows changed'
        pack={'id':'paw-eventprop-water01'if small else'paw-eventprop-water02','name':'Pixel Art World · '+('길이 조절 작은 배수 물줄기'if small else'큰 배수 물줄기'),'filename':name,'sourcePage':deps['sourcePage'],'downloadUrl':source['url'],'sha256':source['sha256'],'termsUrl':'https://yms.main.jp/dotartworld/page1/rule.html','width':image.width,'height':image.height,'frameWidth':fw,'frameHeight':fh,'atlasColumns':4,'frames':frames,'frameComposites':composites,'variants':variants,'placement':'wall-outlet-to-water-surface','notes':[
            '정면 벽 배수구+물기둥+물보라 전체를 한 이벤트 프레임으로 조립한다. 실물 sourceParts를 phase마다 동기화한 한 그림이므로 여러 이벤트의 위상차가 없다. 바닥중앙 anchor와 투명 위쪽 패딩을 보존하며 scale1이다.',
            '120ms는 예시 속도다. 제작자 FPS/실제 물리 속도가 아니다. static은 첫 위상 고정, loop는 명시한4프레임만 setEventGraphicPattern/wait으로 순환한다.',
            'frameComposites가 있는 항목은 frames.sourceRect를 직접 복사하지 않는다. sourceRect는 원본 한 위상의 포함 영역이고 frameComposites.parts가 실제 합성 순서다. destination 좌표는 패딩 전 완성 프레임, atlasOffset은192px 또는160px 공통 프레임 내부의 바닥 정렬 패딩이다.',
            '32px 행0/1은 배수구+아랫입술, 행2만 반복 물기둥, 행3은 물보라. 길이3/4/6의 행배열은[0,1,3]/[0,1,2,3]/[0,1,2,2,2,3]. 행1을 반복하면 중간에 배수구가 생기므로 금지.'if small else'원본384×640 중 첫160px에96×160 완성 물줄기4개만 있다. 아래480px는 완전투명이다. 빈12프레임을 등록하지 않으며640px높이 프레임으로 잘못 잡아 밑동을480px 내리지 않는다.',
            '그림 상단 배수구는 정면 벽, 하단 물보라는 차단 수로 수면에 맞춘다. 머리/물보라를 별도 가구로 중복 배치하지 않는다. 통행·수영·수위·유량 제어·실내 전이는 자동 생성하지 않는다. ST-Sewer-01.png 표본은 별도 사용자 PNG가 있어야 렌더된다.'
        ],'rights':{'profile':'yms-general','runtimeImportAllowed':True,'sharedProjectDefaultsAllowed':True,'redistributeArt':False,'credit':'Pixel Art World / ドット絵世界 · yms','checkedAt':'2026-09-24','reason':'Official sewer page has no RPG Maker-only marker; source/derived art remains user-local.'}}
        packs.append(pack);audit.append({'filename':name,'sha256':source['sha256'],'source_page':deps['sourcePage'],'download_url':source['url'],'packId':pack['id'],'status':'supported','variants':len(variants),'frames':len(frames)})
    return {'packs':packs,'sources':audit}
if __name__=='__main__':
    water=build_water_packs(Path(sys.argv[1]))
    for name in['tiledata/pixel-art-world/eventprops.json','src/assets/pixelArtWorldEventProps.json']:
        path=ROOT/name;data=json.loads(path.read_text());ids={p['id']for p in water['packs']};names={p['filename']for p in water['packs']}
        data['packs']=[p for p in data['packs']if p['id']not in ids]+water['packs'];data['sources']=[p for p in data['sources']if p['filename']not in names]+water['sources'];path.write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n')
    print('Prepared water metadata:2 originals,16 complete frames,8 static/loop variants; no pixel files written.')
