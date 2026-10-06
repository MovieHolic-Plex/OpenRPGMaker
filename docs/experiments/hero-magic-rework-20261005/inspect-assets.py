"""Inspect source grids, packed PNGs and legacy entrypoint output without installation."""
import importlib, io, json, sys, tempfile
from hashlib import sha256
from pathlib import Path
from PIL import Image

ROOT=Path(__file__).resolve().parents[3]
SOURCE=ROOT/'scripts/asset-gen/pixel-fx'
sys.path.insert(0,str(SOURCE))
import snes_study_redraw as authored, lib_mage, lib_scout

report=[]
for key,(size,palette,anchor,cels) in authored.all_sequences().items():
    source=SOURCE/'hand-authored'/f'{key}.study.px.json'
    doc=json.loads(source.read_text())
    expected=Image.new('RGBA',(size*len(cels),size))
    for index,(phase,duration,pieces) in enumerate(cels):
        rows=authored.decode(size,palette,pieces)
        assert rows==doc['frames'][index]['rows']
        assert duration==doc['frames'][index]['durationMs']
        assert phase==doc['frames'][index]['phase']
        for y,row in enumerate(rows):
            for x,symbol in enumerate(row):
                if symbol!='.':
                    color=palette[symbol]
                    expected.putpixel((index*size+x,y),tuple(int(color[k:k+2],16) for k in (1,3,5))+(255,))
    asset=ROOT/'public/assets/generated/pixel-fx'/f'{key}.png'
    actual=Image.open(asset).convert('RGBA')
    assert actual.size==expected.size and actual.tobytes()==expected.tobytes(),key
    encoded=io.BytesIO();expected.save(encoded,format='PNG')
    assert encoded.getvalue()==asset.read_bytes(),key
    colors=set(actual.getdata())
    assert {p[3] for p in colors}<={0,255}
    assert len({p[:3] for p in colors if p[3]})<=16
    if key in ('cleric_holy_field','monk_dragon_wave'):
        for index in range(len(cels)):
            aux=Image.open(asset.with_name(f'{key}-f{index}.png')).convert('RGBA')
            assert aux.tobytes()==actual.crop((index*size,0,(index+1)*size,size)).tobytes()
    report.append({'key':key,'size':list(actual.size),'frames':len(cels),
      'opaqueColors':len({p[:3] for p in colors if p[3]}),
      'binaryAlpha':True,'sourceAndPngMatch':True,'pngBytesReproduced':True,
      'assetSha256':sha256(asset.read_bytes()).hexdigest()})

wrappers=[]
with tempfile.TemporaryDirectory(prefix='hero-fx-entrypoints-') as temp:
    lib_mage.OUT=Path(temp)
    for key in ('mage_fire_burst','mage_blizzard','mage_chain_bolt'):
        mod=importlib.import_module(key)
        target=lib_mage.build(key,mod.FRAME,mod.FRAMES,mod.PAL,mod.draw)
        assert Image.open(target).convert('RGBA').tobytes()==Image.open(ROOT/'public/assets/generated/pixel-fx'/f'{key}.png').convert('RGBA').tobytes()
        wrappers.append(key)
    for key in ('monk_dragon_aura','monk_dragon_hit'):
        mod=importlib.import_module(key)
        frames=lib_scout.render(vars(mod))
        sheet=Image.new('RGBA',(mod.SIZE*len(frames),mod.SIZE))
        for i,frame in enumerate(frames):sheet.paste(frame,(i*mod.SIZE,0))
        assert sheet.tobytes()==Image.open(ROOT/'public/assets/generated/pixel-fx'/f'{key}.png').convert('RGBA').tobytes()
        wrappers.append(key)

out=ROOT/'verify-shots/hero-magic-rework-20261005/assets.json'
out.write_text(json.dumps({'layers':report,'entrypointRgbaMatches':wrappers},ensure_ascii=False,indent=2)+'\n')
print(json.dumps({'layers':len(report),'entrypoints':len(wrappers),'opaqueColorRange':[min(r['opaqueColors'] for r in report),max(r['opaqueColors'] for r in report)],'out':str(out)}))
