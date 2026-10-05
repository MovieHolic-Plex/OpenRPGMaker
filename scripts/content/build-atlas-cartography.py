#!/usr/bin/env python3
"""Original 32px terrain. Landmark pixels come ONLY from accepted harness records.

Terrain is code native pixel art; no RTP terrain is copied or recoloured.
Run from the repository root. Deterministic source for the shared sheet and dictionary.
"""
import json, math, random, hashlib
from pathlib import Path
from PIL import Image, ImageDraw

root = Path(__file__).resolve().parents[2]
out = root / 'public/assets/atlas-cartography'
out.mkdir(parents=True, exist_ok=True)
source = root / 'tiledata/atlas-cartography'
source.mkdir(parents=True, exist_ok=True)
tiles = []
labels = []
def tile(label):
    im = Image.new('RGBA', (32,32)); tiles.append(im); labels.append(label)
    return ImageDraw.Draw(im)
def grass(d, variant=0):
    d.rectangle((0,0,31,31), fill=['#97b87a','#99b97b','#96b679','#98b77a'][variant%4])
    rng=random.Random(variant+51)
    for _ in range(7):
        x,y=rng.randrange(32),rng.randrange(32)
        d.line((x,y,x+1,y), fill=rng.choice(['#aac68d','#7ea56a','#8eb276']))
for n in range(4): grass(tile('草地 '+str(n)), n)
for name,color in [('土路','#d1bb83'),('砂地','#decd97'),('雪地','#d7e2d4'),('花草','#91b679')]:
    d=tile(name);d.rectangle((0,0,31,31),fill=color)
    rng=random.Random(len(tiles))
    for _ in range(10):
        x,y=rng.randrange(30),rng.randrange(30);d.point((x,y),fill='#c7b580' if name=='土路' else '#abc28c')
    if name=='花草':
        for x,y in [(6,9),(23,20),(12,27)]: d.line((x,y,x,y+3),fill='#5f8d55');d.rectangle((x-1,y-1,x+1,y+1),fill='#f3ddb0')
# water edge bitmask: N/E/S/W are neighbouring land. Collision remains solid.
for mask in range(16):
    d=tile('水岸 '+str(mask));d.rectangle((0,0,31,31),fill='#588eab')
    for x,y in [(4,8),(19,24)]:d.line((x,y,x+8,y),fill='#71adc0');d.line((x+2,y+1,x+5,y+1),fill='#6aa3b8')
    edges=[(0,0,31,4),(27,0,31,31),(0,27,31,31),(0,0,4,31)]
    for bit,r in enumerate(edges):
        if mask&(1<<bit):
            d.rectangle(r,fill='#c9c68e')
            inset=[(0,5,31,6),(25,0,26,31),(0,25,31,26),(5,0,6,31)][bit]
            d.rectangle(inset,fill='#94c0c7')
# raised stone: N/E/S/W neighbouring floor. Solid; bright lip + stratified front.
for mask in range(16):
    d=tile('岩壁 '+str(mask));d.rectangle((0,0,31,31),fill='#8a9681')
    d.polygon([(0,0),(31,0),(31,18),(25,21),(8,19),(0,23)],fill='#acb49a')
    if mask&4:
        d.line((1,24,9,24,14,26,30,25),fill='#6c796d',width=2)
        d.line((3,29,14,28,24,30),fill='#69756a')
    else:
        d.rectangle((0,0,31,31),fill='#acb49a')
        d.line((8,12,12,11,18,12),fill='#bfc3a7')
    if mask&4:d.line((0,18,8,16,23,17,31,14),fill='#d3d2ad',width=2)
    if mask&8:d.line((1,0,1,20),fill='#cfceb0',width=2)
    if mask&2:d.line((30,0,30,20),fill='#6b7d6a',width=2)
for n,name in enumerate(['広葉樹','針葉樹','草むら','岩','遺跡床','石壁','木橋','洞窟背景','洞窟床','洞窟壁','梯子','水晶','紅葉','浅瀬','石畳','草崖']):
    d=tile(name)
    if n in [7,8,9,10,11,15]:d.rectangle((0,0,31,31),fill='#142b35')
    else:grass(d, n)
    if n in [0,1,12]:
        d.ellipse((4,20,29,31),fill='#597955');d.rectangle((14,17,18,29),fill='#795f45')
        if n==1:
            d.polygon([(16,1),(4,22),(28,22)],fill='#35685b');d.polygon([(16,1),(7,16),(18,14)],fill='#648e71');d.line((16,4,11,12),fill='#86ad80',width=2)
        else:
            pal=['#3c7058','#53875c','#79a565'] if n==0 else ['#936b53','#c08c58','#d8ad68']
            d.ellipse((3,5,28,25),fill=pal[0]);d.ellipse((5,2,24,20),fill=pal[1]);d.ellipse((7,3,19,14),fill=pal[2]);d.rectangle((12,6,15,7),fill='#b0c989' if n==0 else '#e8c88d')
    elif n==2:
        for x in range(3,30,5): d.line((x,24,x-2,18),fill='#568557',width=2);d.line((x,22,x+1,15),fill='#6c995f')
    elif n==3:
        d.ellipse((5,17,27,28),fill='#66816a');d.polygon([(6,22),(8,10),(18,6),(25,12),(27,23)],fill='#9fa98f');d.polygon([(8,10),(18,6),(18,18),(6,22)],fill='#c5c5a6');d.line((19,10,23,20),fill='#7b8e7b')
    elif n==10:
        d.rectangle((0,0,31,31),fill='#142b35')
        d.rectangle((9,0,11,31),fill='#bca57b');d.rectangle((22,0,24,31),fill='#bca57b')
        for y in range(2,32,7):d.rectangle((10,y,23,y+2),fill='#d2bf90')
    elif n==15:
        d.rectangle((0,0,31,31),fill='#a38c63');d.rectangle((0,0,31,6),fill='#90b277');d.line((0,0,31,0),fill='#c2cf92',width=2)
        d.line((1,17,10,16,20,19,30,18),fill='#877a59');d.line((7,28,18,26,28,28),fill='#c0a77a')
    elif n in [4,5,8,9,14]:
        base=['#94a99e','#577576','#354e56','#597276','#82988c','#b5b8a0'][[4,5,8,9,10,14].index(n)]
        d.rectangle((0,0,31,31),fill=base)
        for yy in range(0,32,8):
            d.line((0,yy,31,yy),fill='#3d595f' if n!=14 else '#919d89')
            for xx in range((yy//8%2)*8,32,16):d.line((xx,yy,xx,yy+8),fill='#3d595f' if n!=14 else '#919d89')
        if n==10:d.rectangle((0,0,31,4),fill='#b8bda0');d.rectangle((0,28,31,31),fill='#183b43')
    elif n==6:
        d.rectangle((0,0,31,31),fill='#aa8d61')
        for x in range(0,32,8):d.line((x,0,x,31),fill='#6c7058');d.line((x+2,2,x+2,29),fill='#c3ac7d')
    elif n==11:
        for x,y in [(7,22),(17,27),(24,20)]:d.polygon([(x,y),(x-3,y-10),(x+1,y-16),(x+4,y-7)],fill='#7bc0bb');d.line((x+1,y-13,x+1,y-2),fill='#cee2cc')
    elif n==13:d.rectangle((0,0,31,31),fill='#83b7b9');d.line((4,9,15,9),fill='#b8d4c1');d.line((18,25,28,25),fill='#b8d4c1')
while len(tiles)<64:
    idx=len(tiles);d=tile(['山頂','山肌','森床','丘草','乾草','岩地','苔床','空'][idx-56])
    d.rectangle((0,0,31,31),fill={56:'#a4b79b',57:'#a4b79b',58:'#719565',59:'#a6bc7d',60:'#b6ba7c',61:'#a3ac94',62:'#537467',63:'#aac9cb'}[idx])
    if idx in [56,57]:
        d.polygon([(0,29),(15,2),(31,29)],fill='#7e9386');d.polygon([(0,29),(15,2),(16,29)],fill='#bcc5a9')
        if idx==56:d.polygon([(9,12),(15,2),(21,12),(16,9)],fill='#e9e8cf')
    elif idx!=63:
        for x,y in [(5,7),(18,23),(26,11)]:d.line((x,y,x+2,y),fill='#91ab7a')

# Reuse seven HUMAN approved fantasy landmarks. Preserve original pixels with nearest 2x only.
selected=json.loads((root/'tiledata/worldmap-kit/selected/selected.json').read_text())['icons']
names=['촌락','큰 마을','항구 마을','대성','덩굴 유적 동굴','거대한 탑','관문 요새','고대 돌원']
icons=[]
for prefix in names:
    a=next(i for i in selected if i['theme']=='fantasy' and i['name'].startswith(prefix))
    assert a['decision'] in ['accept','pick']
    file=root/'tiledata/worldmap-kit/selected'/a['source'];raw=file.read_bytes()
    assert hashlib.sha256(raw).hexdigest()==a['sha256']
    im=Image.open(file).convert('RGBA').resize((a['width']*32,a['height']*32),Image.Resampling.NEAREST)
    rows=[]
    for y in range(a['height']):
        row=[]
        for x in range(a['width']):row.append(len(tiles));labels.append(a['name']);tiles.append(im.crop((x*32,y*32,x*32+32,y*32+32)))
        rows.append(row)
    (out/'icons').mkdir(exist_ok=True)
    (out/'icons'/f'{len(icons)}.png').write_bytes(raw)
    icons.append({'name':a['name'],'width':a['width'],'height':a['height'],'rows':rows,'source':a['source'],'sha256':a['sha256'],'decisionId':a['decisionId']})
sheet=Image.new('RGBA',(256,math.ceil(len(tiles)/8)*32))
for i,t in enumerate(tiles):sheet.paste(t,((i%8)*32,(i//8)*32))
sheet.save(out/'chipset.png')
data={'count':len(tiles),'tileSize':32,'tilesPerRow':8,'labels':labels,'icons':icons}
(root/'src/assets/atlasCartographySheet.json').write_text(json.dumps(data,ensure_ascii=False))
(source/'sheet.json').write_text(json.dumps(data,ensure_ascii=False,indent=2))
(out/'ATTRIBUTION.md').write_text('# Atlas cartography\n\nTerrain: original code native pixel artwork, source scripts/content/build-atlas-cartography.py.\nLandmarks: existing human approved worldmap-icons harness artwork; nearest 2x, no added pixels. Source hashes and decisions: tiledata/atlas-cartography/sheet.json. Their original attribution remains public/assets/worldmap-icons/ATTRIBUTION.md.\n')
md = '# 새 지도 지형 32px\n\n8열. 지형0–63, 승인 아이콘64–135. 지형은 새 코드 도트 원본이다.\n\n'
md += '|번호|x,y(px)|뜻|통행|층|\n|---|---|---|---|---|\n'
for i,label in enumerate(labels):
    blocked = 8 <= i < 40 or i in [40,41,43,45,49,55,56,57]
    md += f'|{i}|{i%8*32},{i//8*32}|{label}|'+('★' if i>=64 else '×' if blocked else '○')+'|'+('3' if i>=64 else '1')+'|\n'
md += '\n## 순서와 통행\n\n지형 분류 → 물/절벽 사방 비트 → 실제 길/다리 → 승인 아이콘 전체 배열 → 이벤트 → canMove → 정본 저장·재로드. 물8–23, 절벽24–39는 북1·동2·남4·서8의 이웃이 다른 지형일 때 합산한다. 대각선은 합산하지 않는다. 물 칸은 ×, 실제 다리46은 ○. 그림만 다리를 덧씌우는 것은 오류다. 56/57은 막힌 산봉우리,61은 통행 가능한 고원 바닥이다.\n\n'
md += '## 방과 코스\n\n47 빈 공간은 ○,49 벽은 ×. 아래 두 줄은49, 착지 줄은 height−3. 실제 방과 지도 윤곽은 atlasRoomAir가 같은 원본이다. roomShape(0–9)는 저장된 모양 번호라 다른 방을 지워도 변하지 않는다. 50은 통행 가능한 사다리이며 저작기가 프로젝트 지형 기록의 climbable 태그를 연결한다. 코스는63 하늘·55 풀 절벽 발판을 쓰고 실제 sideView 점프로 오른다. 새 방은 기존 같은40×20 빈 사각형을 반복하지 않는다.\n\n'
md += '## 아이콘 전체 배열\n\n'
for i,a in enumerate(icons):
    md += f"### {i}: {a['name']}\n\n원본 SHA256 {a['sha256']}. 승인 {a['decisionId']}. 최근접2배만 적용, 픽셀 추가 없음.\n\n```json\n{json.dumps(a['rows'])}\n```\n\n"
md += '## 정상과 오류\n\n정상: 이어지는 강과 호수가 실제 물 타일이며 막힌다. 다리는 실제46번이라 걷는다. 아이콘은3층 전체 배열을 찍고 아래 지형을 보존한다. 지형은 강·산·숲의 군집이고 길은 실제 이어지는 굴곡이다. 방 지도와 충돌은 같은 윤곽이다. 오류: 이름만 호수인 숲길, 그림만 다리이고 막힌 바닥, 지도만 다른 모양인 같은 방, 아이콘 한 칸만 잘라 쓰기. inspect_worldmap_structure가 실제 문/착지/관문 도달성을 검사한다. 정상 그림은 함께 배포하는6종 정본 PNG에서, 칸의 실제 모양은 원본 시트에서 확인한다.\n'
(source/'README.md').write_text(md)
refs=[{'id':'atlas-cartography-assembly-v2','name':'새 지도 지형32px · 사전/배치/통행','description':'새 지형 원본과 승인 아이콘의 공용 조립 지침',
    'documents':[{'id':'assembly','name':'좌표 사전·전체 배열·실행 순서·정상/오류','markdown':md}],
    'images':[{'id':'sheet','name':'원본136칸','caption':'8열×17줄,32px. 0–63새 지형,64–135사람 승인 아이콘.','dataUrl':'/assets/atlas-cartography/chipset.png'}]}]
(root/'src/assets/atlasCartographyReferences.json').write_text(json.dumps(refs,ensure_ascii=False))
print(f'{len(tiles)} shared 32px cells; accepted landmarks only')
