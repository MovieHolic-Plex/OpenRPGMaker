"""Contact sheets for identity review; never changes source assets or metadata."""
import json, sys, hashlib, textwrap
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

root = Path(sys.argv[1])
data = json.loads((root / 'inventory.json').read_text())
dest = root / 'visual'
dest.mkdir(exist_ok=True)
font = ImageFont.truetype('/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc', 13)
small = ImageFont.truetype('/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc', 11)
bg = (34, 38, 46)
pages = []
faces = {row['id']: row for row in data['faces']}
walk = {row['id']: row for row in data['walkSources']}
semantic = {(row['textureKey'], row['characterIndex']): row for row in data['charset']}
portraits = {(row['setId'], row['mode'], row['expression']): row for row in data['portraits']}
expressions = ['base','smile','happy','content','surprised','embarrassed','doubtful','serious','annoyed','angry','sad','crying','worried','determined','shy','wink']

def opened(row):
    return Image.open(row['file']).convert('RGBA') if row and row.get('file') else None

def paste(canvas, im, box, trim=True):
    if im is None: return
    if trim:
        bounds = im.getchannel('A').getbbox()
        if bounds: im = im.crop(bounds)
    x,y,w,h = box
    scale = min(w/im.width,h/im.height)
    if scale >= 1: scale = max(1, int(scale))
    im = im.resize((max(1,int(im.width*scale)),max(1,int(im.height*scale))),Image.Resampling.NEAREST)
    canvas.paste(im, (x+(w-im.width)//2,y+(h-im.height)//2), im)

def words(canvas, text, x,y,width, f=font, colour=(238,238,238)):
    draw = ImageDraw.Draw(canvas); line=''
    for char in text:
        if char=='\n' or draw.textlength(line+char,font=f)>width:
            draw.text((x,y),line,font=f,fill=colour);y+=17;line='' if char=='\n' else char
        else:line+=char
    draw.text((x,y),line,font=f,fill=colour)
    return y+17

def save(name, tiles, cols, per):
    for start in range(0,len(tiles),per):
        group=tiles[start:start+per];w,h=group[0].size
        sheet=Image.new('RGB',(cols*w,((len(group)+cols-1)//cols)*h),bg)
        for i,tile in enumerate(group):sheet.paste(tile,((i%cols)*w,(i//cols)*h))
        file=dest/f'{name}-{start//per+1:02d}.png';sheet.save(file)
        pages.append({'file':str(file),'group':name,'first':start,'count':len(group),'sha256':hashlib.sha256(file.read_bytes()).hexdigest()})

tiles=[]
for face in data['reviewed']['faces']:
    tile=Image.new('RGB',(300,245),bg)
    paste(tile,opened(faces.get(face['resourceId'])),(4,4,100,100),False)
    stem=None
    for source in json.loads(Path('scripts/shared-face-expression-sources.json').read_text()):
        if face['resourceId']==f"easyrpg-faceset-{source['baseSheet'].lower()}-{source['baseCell']:02d}":stem='shared-'+source['stem'];break
    if stem:
        paste(tile,opened(faces.get(stem+'-00')),(108,4,88,100),False)
        paste(tile,opened(portraits.get((stem,'full','base'))),(198,4,96,112))
    y=words(tile,face['resourceId'],4,118,292,small)
    y=words(tile,face['label'],4,y,292)
    words(tile,' / '.join(f'{k}:{v}' for k,v in face['attributes'].items()),4,y,292,small)
    tiles.append(tile)
save('faces-core',tiles,3,12)

tiles=[]
for row in data['reviewed']['mappings']:
    if row['status']!='mapped':continue
    tile=Image.new('RGB',(340,295),bg);index=row['characterIndex'];source=opened(walk.get(row['textureKey']))
    if source:
        x=(index%4)*72+24;y=(index//4)*128+64
        paste(tile,source.crop((x,y,x+24,y+32)),(4,4,80,110),False)
    face=faces.get(row['faceResourceId']);paste(tile,opened(face),(92,4,110,110),False)
    canonical=semantic.get((row['textureKey'],index),{})
    y=words(tile,row['textureKey'].replace('tex_easyrpg_charset_','')+f'#{index} / '+row['quality'],4,118,332,small)
    y=words(tile,'현재: '+canonical.get('label','이름 없음'),4,y,332)
    y=words(tile,'대응표: '+row['label'],4,y,332)
    y=words(tile,'속성: '+' / '.join(f'{k}:{v}' for k,v in row['attributes'].items()),4,y,332,small)
    face_meta=next((f for f in data['reviewed']['faces'] if f['resourceId']==row['faceResourceId']),{})
    words(tile,'얼굴: '+face_meta.get('label','')+' / '+str(face_meta.get('attributes',{})),4,y,332,small)
    tiles.append(tile)
save('pairs',tiles,3,12)

for source in json.loads(Path('scripts/shared-face-expression-sources.json').read_text()):
    stem='shared-'+source['stem'];sheet=Image.new('RGB',(1120,760),bg)
    words(sheet,stem+' / '+source['name'],8,4,1100)
    for i,expression in enumerate(expressions):
        x=(i%4)*280;y=36+(i//4)*180
        words(sheet,f'{i:02d} {expression}',x+4,y,270,small)
        paste(sheet,opened(faces.get(f'{stem}-{i:02d}')),(x+4,y+24,60,80),False)
        paste(sheet,opened(portraits.get((stem,'bust',expression))),(x+68,y+24,96,144))
        paste(sheet,opened(portraits.get((stem,'full',expression))),(x+170,y+24,106,144))
    file=dest/f"expressions-{source['stem']}.png";sheet.save(file)
    pages.append({'file':str(file),'group':'expressions','setId':stem,'count':48,'sha256':hashlib.sha256(file.read_bytes()).hexdigest()})

tiles=[]
for row in data['monsters']:
    tile=Image.new('RGB',(300,285),bg);paste(tile,opened(row),(4,4,292,132))
    y=words(tile,row['resourceId'],4,140,292,small)
    y=words(tile,row['name'],4,y,292)
    y=words(tile,' / '.join(row['tags']),4,y,292,small)
    words(tile,row['description'],4,y,292,small)
    tiles.append(tile)
save('monsters',tiles,3,12)

tiles=[]
for row in data['battlers']:
    tile=Image.new('RGB',(300,210),bg)
    source=opened(row)
    if source:paste(tile,source.crop((0,0,48,48)),(4,4,115,120))
    key='tex_easyrpg_charset_'+row['characterResourceId'].replace('easyrpg-charset-','');index=row['characterIndex'];source=opened(walk.get(key))
    if source:
        x=index%4*72+24;y=index//4*128+64
        paste(tile,source.crop((x,y,x+24,y+32)),(150,4,80,110),False)
    y=words(tile,row['resourceId'],4,128,292,small);words(tile,row['label'],4,y,292)
    tiles.append(tile)
save('battlers',tiles,3,15)

for kind in ['monster','charset','faceset']:
    tiles=[]
    for row in data['projectUploads']:
        if row['kind']!=kind: continue
        tile=Image.new('RGB',(300,230),bg)
        paste(tile,opened(row),(4,4,292,158))
        y=words(tile,row['id'],4,166,292,small)
        words(tile,row['name'],4,y,292)
        tiles.append(tile)
    if tiles: save('private-'+kind,tiles,4,24)

(root/'visual-pages.json').write_text(json.dumps(pages,ensure_ascii=False,indent=2)+'\n')
print(json.dumps({'pages':len(pages),'groups':{g:sum(p['group']==g for p in pages) for g in sorted({p['group'] for p in pages})}}))
