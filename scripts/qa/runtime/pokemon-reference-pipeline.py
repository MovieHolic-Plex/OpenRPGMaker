#!/usr/bin/env python3
"""Bind canonical save receipt, standalone export and actual player frames to original art."""
from pathlib import Path
from PIL import Image
import argparse, base64, io, json, hashlib
from importlib.util import spec_from_file_location, module_from_spec

def main():
 p=argparse.ArgumentParser();p.add_argument('--private',type=Path,required=True);p.add_argument('--out',type=Path,required=True);a=p.parse_args();b=a.private
 spec=spec_from_file_location('fidelity',Path(__file__).with_name('pokemon-reference-fidelity.py'));f=module_from_spec(spec);spec.loader.exec_module(f)
 receipt=json.loads((b/'canonical/canonical-receipt.json').read_text());assert receipt['reloadedThroughFreshConnection']
 raw=(b/'canonical/canonical-reloaded.json').read_bytes();assert hashlib.sha256(raw).hexdigest()==receipt['sha256'];canonical=json.loads(raw)
 asset='oprn_emerald_field_cast_1';asset_sha=canonical['assets']['uploaded'][asset]['ref']['sha256']
 assert any(x['id']==asset and x['sha256']==asset_sha for x in receipt['mediaByteReloads'])
 record={'pass':True,'projectId':receipt['projectId'],'projectDir':receipt['projectDir'],'revision':receipt['revision'],'canonicalSha256':receipt['sha256'],'assetSha256':asset_sha,'canonicalFreshConnectionReload':True,'sourceSha256':f.SOURCE_SHA,'stages':[]}
 canonical_pixels=f.clean(Image.open(b/'prepared/new-cast-1.png')).tobytes()
 def check_cast(stage,data,byte_identity=True):
  observed_sha=hashlib.sha256(data).hexdigest()
  if byte_identity:assert observed_sha==asset_sha,stage+' differs from reloaded canonical'
  im=f.clean(Image.open(io.BytesIO(data)));assert im.size==(288,256)
  assert im.tobytes()==canonical_pixels,stage+' changes decoded canonical cast pixels'
  sheet=Image.new('RGBA',(48,128))
  for row in range(4):
   for col in range(3):
    cell=im.crop((col*24,row*32,(col+1)*24,(row+1)*32))
    assert not any(px[3] for gutter in [cell.crop((0,0,4,32)),cell.crop((20,0,24,32))] for px in gutter.get_flattened_data())
    sheet.paste(cell.crop((4,0,20,32)),(col*16,row*32))
  poses=f.evaluate(sheet);assert all(x['pass'] for x in poses)
  record['stages'].append({'stage':stage,'assetSha256':observed_sha,'canonicalCastPixelsExact':True,'canonicalBytesExact':observed_sha==asset_sha,'minimumExactRatio':min(x['exactRatio'] for x in poses),'poses':poses})
 check_cast('prepared cast bound to fresh canonical media reload',(b/'prepared/new-cast-1.png').read_bytes())
 shared=f.ROOT/'public/assets/emerald-monster/cast/cast-1.png';check_cast('shared cast',shared.read_bytes(),byte_identity=False)
 exported=json.loads((b/'export/project.json').read_text());url=exported['assets']['uploaded'][asset]['dataUrl'];check_cast('shipping export',base64.b64decode(url.split(',',1)[1]))
 qa=json.loads((b/'runtime-qa/record.json').read_text());assert len(qa['checks'])==39 and all(x['pass'] for x in qa['checks']) and not qa['errors'] and not qa['requestsFailed']
 sheet=Image.new('RGBA',(48,128));samples=[]
 for row,direction in enumerate(['up','right','down','left']):
  for col in range(3):
   file=b/f'runtime-qa/walking-{direction}-phase-{col}.png';cell=f.clean(Image.open(file));assert cell.size==(24,32)
   assert not any(px[3] for gutter in [cell.crop((0,0,4,32)),cell.crop((20,0,24,32))] for px in gutter.get_flattened_data())
   sheet.paste(cell.crop((4,0,20,32)),(col*16,row*32));samples.append({'file':file.name,'sha256':f.sha(file)})
 poses=f.evaluate(sheet);assert all(x['pass'] for x in poses)
 record['stages'].append({'stage':'actual compiled player twelve texture-frame samples','minimumExactRatio':min(x['exactRatio'] for x in poses),'poses':poses,'samples':samples,'scope':'Actual selected runtime texture pixels plus separately measured gait/scale/camera checks; background and screenshot enlargement excluded.'})
 record['standaloneChecks']=39;record['scope']='Walking sprite identity at native pixels. GIF preview130ms; runtime uses its existing movement clock. Not whole-game or battle-portrait identity.'
 a.out.mkdir(parents=True,exist_ok=True);(a.out/'pipeline-fidelity.json').write_text(json.dumps(record,indent=2)+'\n');print(json.dumps({'pass':True,'stages':[(s['stage'],s['minimumExactRatio']) for s in record['stages']],'revision':receipt['revision']}))
if __name__=='__main__':main()
