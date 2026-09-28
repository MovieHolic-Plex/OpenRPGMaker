// 자체 생성 원화의 네 단을 도트 배경으로 분리한다. Python 3 + Pillow 필요.
// 재현: node scripts/asset-gen/gen-battle-scenery.mjs
// 최초 원화 반입: --source-dir <plains.png 등 원화 다섯 장이 있는 폴더>
// 원화는 image_gen으로 생성하며 프롬프트는 자산 폴더 prompts.json에 보존한다.
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../../', import.meta.url));
const result = spawnSync('python3', ['-c', String.raw`
from PIL import Image, ImageFilter
from pathlib import Path
import sys, json, hashlib
root=Path(sys.argv[1]); args=sys.argv[2:]
if args and (len(args)!=2 or args[0]!='--source-dir'):
    raise SystemExit('usage: gen-battle-scenery.mjs [--source-dir DIR]')
source_dir=Path(args[1]) if args else None
base=root/'public/assets/generated/battle-scenery'
biomes=['plains','forest','cave','snow','desert']; layers=['sky','far','mid','ground']
NEAREST=Image.Resampling.NEAREST

def palette(im, colors=48):
    # 알파를 양자화 색과 분리해서 완전 투명/불투명만 보존한다.
    alpha=im.getchannel('A').point(lambda a:255 if a>=224 else 0)
    rgb=im.convert('RGB'); rgb.paste((0,0,0),(0,0),alpha.point(lambda a:255-a))
    out=rgb.quantize(colors=colors,method=Image.Quantize.MEDIANCUT,dither=Image.Dither.NONE).convert('RGBA')
    out.putalpha(alpha)
    return out

def clean(im):
    data=[]
    for r,g,b,a in im.getdata():
        # 원화의 키색 및 자동 투명화 가장자리의 고채도 잔여색을 제거한다.
        key=(r>150 and b>150 and g<110)
        fringe=max(r,g,b)>170 and min(r,g,b)<45 and max(r,g,b)-min(r,g,b)>150
        data.append((r,g,b,255 if a>=224 and not key and not fringe else 0))
    im.putdata(data)
    # 한 도트 침식으로 흐린 경계와 단 사이의 가는 선을 걷는다.
    im.putalpha(im.getchannel('A').filter(ImageFilter.MinFilter(3)))
    return im

def seam(im):
    # 출력 32px = 논리 16도트. 양 끝의 같은 위치를 교차 혼합한 뒤 재양자화.
    original=im.copy(); p=im.load(); q=original.load()
    for y in range(180):
        for x in range(16):
            weight=(1-x/15)*0.5
            left=q[x,y]; right=q[319-x,y]
            for dest,a,b in [(x,left,right),(319-x,right,left)]:
                alpha=255 if a[3]*(1-weight)+b[3]*weight>=127 else 0
                rgb=tuple(round(a[c]*(1-weight)+b[c]*weight) for c in range(3))
                p[dest,y]=(*rgb,alpha)
    return im

report={}
for biome in biomes:
    folder=base/biome; folder.mkdir(parents=True,exist_ok=True)
    source=folder/'source.png'
    if source_dir:
        raw=Image.open(source_dir/(biome+'.png')).convert('RGBA')
        atlas=Image.new('RGBA',(320,720))
        for i in range(4):
            # 네 단의 경계선이 레이어 위아래에 섞이지 않도록 4px씩 제외.
            panel=raw.crop((0,round(raw.height*i/4)+4,raw.width,round(raw.height*(i+1)/4)-4)).resize((320,180),NEAREST)
            atlas.paste(panel,(0,i*180))
        # 이미 양자화한 색은 다시 축소하지 않고 인덱스 PNG로 무손실 저장.
        atlas=palette(atlas,128)
        colors=list(dict.fromkeys(atlas.getdata())); indices={c:i for i,c in enumerate(colors)}
        indexed=Image.new('P',atlas.size); indexed.putdata([indices[c] for c in atlas.getdata()])
        indexed.putpalette([v for c in colors for v in c[:3]]+[0]*(768-len(colors)*3))
        indexed.save(source,optimize=True,transparency=bytes(c[3] for c in colors))
    atlas=Image.open(source).convert('RGBA')
    composite=Image.new('RGBA',(640,360)); report[biome]={}
    for i,name in enumerate(layers):
        im=atlas.crop((0,i*180,320,(i+1)*180))
        if name=='sky':
            # 생성기의 자동 배경 제거가 하늘에 남긴 구멍은 같은 열의 가까운 하늘로 복원.
            for x in range(320):
                valid=[y for y in range(180) if im.getpixel((x,y))[3]>=224]
                assert valid, '하늘 원화에 불투명 열이 필요하다'
                for y in range(180):
                    if im.getpixel((x,y))[3]<224:
                        nearest=min(valid,key=lambda yy:abs(yy-y))
                        im.putpixel((x,y),im.getpixel((x,nearest)))
            im.putalpha(255)
        else:
            im=clean(im)
            # 잔여 단 구분선은 투명 영역에 포함한다.
            if name=='far':
                im.paste((0,0,0,0),(0,0,320,48))
                # 능선이 지평선(y=160) 뒤에서 보이도록 먼 경관을 위로 이동.
                shifted=Image.new('RGBA',(320,180)); shifted.paste(im,(0,-44))
                shifted.paste(im.crop((0,179,320,180)).resize((320,44)),(0,136))
                im=shifted
            elif name=='mid':
                # 소품의 밑동은 바닥 뒤에 숨고 중앙 전투 공간은 비워 둔다.
                resized=im.resize((320,122),NEAREST)
                im=Image.new('RGBA',(320,180)); im.paste(resized,(0,0))
                im.paste((0,0,0,0),(96,0,224,180))
            else:
                # 중앙의 실제 바닥 시작점을 찾아 계약 지평선(80도트)에 맞춘다.
                starts=[]
                for x in range(100,220):
                    for y in range(40,130):
                        if all(im.getpixel((x,k))[3]==255 for k in range(y,min(y+8,180))):
                            starts.append(y); break
                start=sorted(starts)[len(starts)//2] if starts else 80
                ground=im.crop((0,start,320,180)).resize((320,100),NEAREST)
                # 지평선 아래 구멍은 해당 열의 가까운 불투명 땅 색으로 채운다.
                for x in range(320):
                    last=ground.getpixel((x,99))[:3]
                    for y in range(99,-1,-1):
                        px=ground.getpixel((x,y))
                        if px[3]: last=px[:3]
                        ground.putpixel((x,y),(*last,255))
                im=Image.new('RGBA',(320,180)); im.paste(ground,(0,80))
        if name in ['sky','far']: im=seam(im)
        im=palette(im).resize((640,360),NEAREST)
        path=folder/(name+'.png'); im.save(path,optimize=True)
        composite=Image.alpha_composite(composite,im)
        # 파일 계약을 재로드로 검증한다.
        check=Image.open(path).convert('RGBA'); pixels=list(check.getdata())
        assert check.size==(640,360)
        assert set(check.getchannel('A').getdata()) <= {0,255}
        assert len(set(p[:3] for p in pixels if p[3]))<=48
        assert check.resize((320,180),NEAREST).resize((640,360),NEAREST).tobytes()==check.tobytes()
        assert path.stat().st_size<200*1024
        if name in ['sky','far']: assert check.crop((0,0,1,360)).tobytes()==check.crop((639,0,640,360)).tobytes()
        if name=='ground': assert check.getchannel('A').crop((0,160,640,360)).getextrema()==(255,255)
        report[biome][name]={'bytes':path.stat().st_size,'colors':len(set(p[:3] for p in pixels if p[3])),'sha256':hashlib.sha256(path.read_bytes()).hexdigest()}
    composite.save(folder/'preview.png',optimize=True)
    report[biome]['preview']={'bytes':(folder/'preview.png').stat().st_size}
    report[biome]['source']={'bytes':source.stat().st_size}
(base/'manifest.json').write_text(json.dumps(report,indent=2)+'\n')
print(json.dumps(report,indent=2))
`, root, ...process.argv.slice(2)], { cwd: root, stdio: 'inherit' });
if (result.error) throw result.error;
process.exit(result.status ?? 1);
