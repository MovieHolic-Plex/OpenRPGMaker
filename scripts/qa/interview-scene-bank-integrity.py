import hashlib,json,itertools
from pathlib import Path
from PIL import Image
# This enumerates actual fixed-choice coverage and audits published bytes/receipts; it does not judge visual quality.
root=Path(__file__).resolve().parents[2]
manifest=json.loads((root/'src/editor/interviewSceneBank.json').read_text())
ledger=json.loads((root/'harness-data/interview-scene-bank/ledger.json').read_text())
seed=json.loads((root/'harness-data/interview-scene-bank/seed.json').read_text())
catalog=json.loads((root/'src/editor/projectInterviewScenes.json').read_text())
planned_keys={'opening'}
for genre in catalog['genres']:
 planned_keys.add(genre['id'])
 options=[[option['id'] for option in question['options']] for question in genre['questions']]
 for depth in range(1,len(options)+1):
  planned_keys.update('--'.join((genre['id'],*choices)) for choices in itertools.product(*options[:depth]))
assert len(planned_keys)==manifest['planned']==seed['expectedScenes']
assert set(manifest['scenes'])<=planned_keys,'Published background does not correspond to an actual fixed-choice prefix'
for key in manifest['scenes']:
 parts=key.split('--')
 for depth in range(1,len(parts)):
  assert '--'.join(parts[:depth]) in manifest['scenes'],f'Published path has an unpublished ancestor: {key}'
rows=[];hashes=set()
for key,scene in manifest['scenes'].items():
 image=root/'public'/scene['url'].lstrip('/');raw=image.read_bytes();digest=hashlib.sha256(raw).hexdigest()
 assert digest==scene['sha256'] and digest not in hashes,key
 hashes.add(digest)
 c=ledger['entries'][key][-1];r=c['review']
 assert c['sha256']==digest and c['promptSha256']==scene['promptSha256'],key
 request=root/'harness-data/interview-scene-bank/requests'/f"{c['generationPromptSha256']}.txt"
 assert hashlib.sha256(request.read_bytes()).hexdigest()==c['generationPromptSha256'],key
 contract=c.get('requestContract')
 if contract:
  assert contract['version']==1 and contract['kind']=='native-edit' and contract['specPromptSha256']==c['promptSha256'],key
  source=next((s for s in ledger['entries'][key] if s['sha256']==contract['sourceSha256']),None)
  assert source is not None and source['promptSha256']==c['promptSha256'],key
  archived=root/'harness-data/interview-scene-bank/edit-sources'/f"{source['sha256']}.png"
  original_request=root/'harness-data/interview-scene-bank/requests'/f"{source['generationPromptSha256']}.txt"
  assert hashlib.sha256(archived.read_bytes()).hexdigest()==source['sha256'],key
  assert hashlib.sha256(original_request.read_bytes()).hexdigest()==source['generationPromptSha256'],key
  own=request.read_text()
  assert own.startswith('Use case: precise-object-edit. Image 1 is the EXACT SAME KEY pixel-art scene to EDIT,'),key
  assert f"Target SHA256={source['sha256']}." in own and f'SCENE ID: {key}. This identifier is metadata; never draw it.' in own,key
 assert r['sourceSha256']==digest and r['promptSha256']==c['promptSha256'] and not r['findings'],key
 assert all(r['checks'][k] is True for k in seed['visualChecks']) and c['gate']['ok'] is True,key
 with Image.open(image) as img:
  assert img.format=='PNG' and abs(img.width/img.height-seed['aspectRatio'])<=seed['aspectTolerance'],key
  img.load()
  if 'A' in img.getbands():assert img.getchannel('A').getextrema()==(255,255),key
  rows.append({'key':key,'sha256':digest,'generationPromptSha256':c['generationPromptSha256'],'width':img.width,'height':img.height})
missing_keys=sorted(planned_keys-set(manifest['scenes']))
report={'scope':'Every currently published background; remaining planned keys are explicitly incomplete','planned':manifest['planned'],'published':len(rows),'remaining':len(missing_keys),'styleVersion':manifest['styleVersion'],'catalogSignature':manifest['catalogSignature'],'allPublishedIntegrityChecksPassed':True,'complete':not missing_keys,'missingSceneKeys':missing_keys,'images':rows}
out=root/'verify-shots/interview-scene-bank-v2/published-integrity-proof.json';out.write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
print(json.dumps({k:v for k,v in report.items() if k not in ('images','missingSceneKeys')}))
