"""Fail-closed prepublication gate, with two fresh vision-only critics.
No manually authored verdicts or forced passes. Human approval remains separate.
"""
from pathlib import Path
import hashlib,hmac,io,json,os,secrets,shutil,sqlite3,subprocess,time
from functools import lru_cache
from threading import Thread,Semaphore
from PIL import Image,ImageDraw
from native_author import ROOT,native,render_native
SOURCE=ROOT/'harness-data/beodeul-building-review'
RULES=SOURCE/'gate-rules.json'
ANCHORS=[ROOT/'public/assets/beodeul-architecture'/f'{n}.png' for n in ['cream','brick','stone','ochre','church','cabin-native']]
# Log-material candidates are compared with the original log cabin; every other candidate keeps the plaster reference.
def reference_key(item):return 'arch:cabin-native' if item.get('material')=='log' else 'arch:cream'

def digest(raw):return hashlib.sha256(raw).hexdigest()
def canonical(value):return json.dumps(value,ensure_ascii=False,sort_keys=True,separators=(',',':')).encode()
def write(path,value):path.parent.mkdir(parents=True,exist_ok=True);path.write_text(json.dumps(value,ensure_ascii=False,indent=2)+'\n')
def files_profile():
    paths=[RULES,SOURCE/'negative/user-rejected-style.png',ROOT/'public/assets/beodeul-warm-trees/tree-03a8f7.png',ROOT/'public/assets/beodeul-warm-trees/tree-03a8f7-shadow.png',SOURCE/'deleted-round-1.json',ROOT/'public/assets/beodeul-city/beodeul-city-chipset.png',ROOT/'src/assets/beodeulCityTileset.json',*ANCHORS,Path(__file__),Path(__file__).with_name('queue.py'),Path(__file__).with_name('native_author.py')]
    return profile_cached(tuple((str(p),p.stat().st_mtime_ns,p.stat().st_size) for p in paths))
@lru_cache(maxsize=8)
def profile_cached(files):return digest(canonical([(os.path.relpath(p,ROOT),digest(Path(p).read_bytes())) for p,_,_ in files]))  # checkout-independent: relative to ROOT
def key(data):
    path=data/'gate-secret'
    if not path.exists():
        fd=os.open(path,os.O_CREAT|os.O_EXCL|os.O_WRONLY,0o600)
        with os.fdopen(fd,'wb') as f:f.write(secrets.token_bytes(32))
    return path.read_bytes()
def recipe(id):return next(i for i in json.loads((SOURCE/'seed.json').read_text())['candidates'] if i['id']==id)
def receipt_path(data,id,sha):return data/'gate-receipts'/id/(sha+'.json')
def verify_receipt(data,id,sha,location='items'):
    try:
        r=json.loads(receipt_path(data,id,sha).read_text());signature=r.pop('signature')
        if not hmac.compare_digest(signature,hmac.new(key(data),canonical(r),'sha256').hexdigest()):return False
        if r['sha']!=sha or r['id']!=id or r['profile']!=files_profile() or r['recipe']!=digest(canonical(recipe(id))):return False
        if not r['passed'] or not r['calibrationPassed']:return False
        for role in ['texture','structure']:
            result=r['reviews'][role]
            if result['verdict']!='PASS':return False
            if digest(Path(r['reportFiles'][role]['path']).read_bytes())!=r['reportFiles'][role]['sha']:return False
            if digest(Path(r['reportFiles'][role]['logPath']).read_bytes())!=r['reportFiles'][role]['logSha']:return False
            for batch in r['reportFiles'][role].get('batches',[]):
                if digest(Path(batch['path']).read_bytes())!=batch['sha']:return False
                if digest(Path(batch['logPath']).read_bytes())!=batch['logSha']:return False
        for evidence in r['reviewImages']:
            if digest(Path(evidence['path']).read_bytes())!=evidence['sha']:return False
        return all(digest((data/location/id/(sha+suffix)).read_bytes())==expected for suffix,expected in r['assets'].items())
    except (OSError,ValueError,KeyError,TypeError,StopIteration):return False

def human_allowed(data,id,sha):
    """The latest human decision for this exact picture hash is Allow or Deny (hash-bound, append-only log).
    Name kept; a human Deny also keeps its picture on the screen so the decision stays visible and undoable."""
    try:
        with sqlite3.connect(data/'review.sqlite') as c:
            last=c.execute('select decision from decisions where item=? and sha=? order by seq desc limit 1',(id,sha)).fetchone()
        return bool(last) and last[0] in ('allow','deny')
    except sqlite3.Error:return False
def exempt(data,id,sha,location='items'):
    """User decision 2026-10-07: a picture a human already allowed is not re-gated after tooling moves.
    Bound to the same picture hash and to intact asset files; a changed picture needs the full gate again."""
    try:
        if not human_allowed(data,id,sha):return False
        return digest((data/location/id/(sha+'.png')).read_bytes())==sha and all((data/location/id/(sha+s)).exists() for s in ('-scene.png','.pixels.json'))
    except OSError:return False
def admitted(data,id,sha,location='items'):return verify_receipt(data,id,sha,location) or exempt(data,id,sha,location)

def plate(candidate,reference,context=None):
    w=max(1000,(candidate.width+reference.width+48)*3);h=max(candidate.height,reference.height)*3+72
    p=Image.new('RGB',(w,h),'#25362a');d=ImageDraw.Draw(p)
    d.text((16,8),'CANDIDATE (3x nearest)',fill='white');d.text((candidate.width*3+48,8),'ORIGINAL BEODEUL REFERENCE (3x nearest)',fill='white')
    p.paste(candidate.resize((candidate.width*3,candidate.height*3),Image.Resampling.NEAREST),(16,28),candidate.resize((candidate.width*3,candidate.height*3),Image.Resampling.NEAREST))
    ref=reference.resize((reference.width*3,reference.height*3),Image.Resampling.NEAREST);p.paste(ref,(candidate.width*3+48,28),ref)
    if context is not None:
        combined=Image.new('RGB',(max(w,context.width*2),h+context.height*2+28),'#25362a');combined.paste(p,(0,0));combined.paste(context.resize((context.width*2,context.height*2),Image.Resampling.NEAREST),(0,h+20));return combined
    return p

def structure_plate(candidate):
    # Count doors and inspect joins on ONE isolated building. Adjacent reference
    # houses in texture plates must not be mistaken for parts of the candidate.
    scale=4
    p=Image.new('RGB',(max(600,candidate.width*scale+32),candidate.height*scale+56),'#25362a')
    ImageDraw.Draw(p).text((16,8),'ONE CANDIDATE - 4x nearest, full silhouette',fill='white')
    enlarged=candidate.resize((candidate.width*scale,candidate.height*scale),Image.Resampling.NEAREST)
    p.paste(enlarged,(16,32),enlarged)
    return p

def strict_contract(item,file):
    expected=recipe(item['id'])
    if any(item.get(k)!=v for k,v in expected.items()):raise ValueError('STALE_DRAFT_RECIPE '+item['id'])
    raw=file.read_bytes();image=Image.open(file).convert('RGBA')
    if image.size!=(item['width'],item['height']) or image.width%16 or image.height%16:raise ValueError('SIZE '+item['id'])
    if image.tobytes()!=render_native(item).tobytes():raise ValueError('SOURCE_PIXELS '+item['id'])
    removed=json.loads((SOURCE/'deleted-round-1.json').read_text())['removed']
    if digest(raw) in {r['sha'] for r in removed}:raise ValueError('USER_REJECTED '+item['id'])
    if image.getbbox() is None or image.getbbox()[3]<=image.height-16:raise ValueError('EMPTY_BOTTOM_TILE_ROW '+item['id'])
    e=item['entrance'];assert e['x']>=0 and e['y']>=0 and e['x']+e['w']<=image.width and e['y']+e['h']<=image.height
    assert image.crop((e['x'],e['y'],e['x']+e['w'],e['y']+e['h'])).getbbox()
    # Every painted pixel must come from the chosen original components at 1:1;
    # a newly flattened shader/grid cannot quietly substitute itself here.
    colors=set()
    for part in item['components']:colors.update(native(part['source']).getdata())
    assert all(pixel in colors or pixel[3]==0 for pixel in image.getdata()),'NATIVE_PALETTE '+item['id']
    return image

def failed_axis(entry,axis,minimum):return entry['verdict']=='FAIL' and next(s['score'] for s in entry['scores'] if s['axis']==axis)<minimum

def schema(samples):
    entry={'type':'object','additionalProperties':False,'required':['id','sha','verdict','scores','issues','observations'], 'properties':{
      'id':{'type':'string','enum':[s['id'] for s in samples]},'sha':{'type':'string','enum':[s['sha'] for s in samples]},'verdict':{'type':'string','enum':['PASS','FAIL']},
      'scores':{'type':'array','items':{'type':'object','additionalProperties':False,'required':['axis','score'],'properties':{'axis':{'type':'string'},'score':{'type':'integer','minimum':0,'maximum':100}}}},
      'issues':{'type':'array','items':{'type':'object','additionalProperties':False,'required':['code','x','y','reason'],'properties':{'code':{'type':'string'},'x':{'type':'integer'},'y':{'type':'integer'},'reason':{'type':'string'}}}},'observations':{'type':'string'}}}
    return {'type':'object','additionalProperties':False,'required':['items'],'properties':{'items':{'type':'array','items':entry}}}

def judge(data,role,samples,profile,run_dir):
    # Keep actual reviews bounded as the human queue grows. Every batch repeats
    # the blind controls and must independently calibrate; scores are never averaged.
    if len(samples)>7:
        candidates=[s for s in samples if not s['id'].startswith('sample-')]
        controls=[s for s in samples if s['id'].startswith('sample-')]
        entries={};reports=[];logs=[];rules=json.loads(RULES.read_text())
        tasks=[]
        for start in range(0,len(candidates),5):
            batch_dir=run_dir/f'{role}-batch-{start//5+1}'
            batch_dir.mkdir(parents=True,exist_ok=True)
            shutil.copyfile(run_dir/'original-reference-sheet.png',batch_dir/'original-reference-sheet.png')
            tasks.append((start,batch_dir))
        # Private batch folders and read-only critics; no concurrent content edits.
        # Collect in order and require EVERY independent blind calibration.
        slots=Semaphore(4);completed={};errors={}
        def review_batch(index,start,batch_dir):
            with slots:
                try:completed[index]=judge(data,role,candidates[start:start+5]+controls,profile,batch_dir)
                except BaseException as error:errors[index]=error
        workers=[Thread(target=review_batch,args=(index,start,batch_dir)) for index,(start,batch_dir) in enumerate(tasks)]
        for worker in workers:worker.start()
        for worker in workers:worker.join()
        if errors:raise errors[min(errors)]
        reviewed_batches=[completed[index] for index in range(len(tasks))]
        for (start,batch_dir),(reviewed,report) in zip(tasks,reviewed_batches):
            print(f'Visual QA {role}: batch {start//5+1}, {len(candidates[start:start+5])} candidates + blind probes',flush=True)
            if role=='texture':
                minimum=rules['minimumTextureScore']
                calibrated=failed_axis(reviewed['sample-11'],'roof_grain',minimum) and failed_axis(reviewed['sample-11'],'wall_grain',minimum)
            else:
                minimum=rules['minimumStructureScore']
                calibrated=failed_axis(reviewed['sample-12'],'roof_joints',minimum) and failed_axis(reviewed['sample-13'],'single_door',minimum)
            if not calibrated:raise RuntimeError('CALIBRATION_FAILURE '+role+' batch '+str(start//5+1))
            reports.append(report)
            logs.append(f"BATCH {start//5+1} REPORT {report['path']} SHA256 {report['sha']}\n"+Path(report['logPath']).read_text())
            for id,entry in reviewed.items():
                if id not in entries:entries[id]=entry
        folder=run_dir/role;folder.mkdir(parents=True,exist_ok=True)
        report_path=folder/'verdict.json';log_path=folder/'engine.log'
        write(report_path,{'items':[entries[s['id']] for s in samples]})
        log_path.write_text('\n'.join(logs))
        return entries,{'path':str(report_path.resolve()),'sha':digest(report_path.read_bytes()),'logPath':str(log_path.resolve()),'logSha':digest(log_path.read_bytes()),'exitCode':0,'batches':reports}
    # Resume only authenticated actual model output for identical role, code,
    # reference and candidate images. Completed FAILs are retained too.
    inputs={'profile':profile,'role':role,'reference':digest((run_dir/'original-reference-sheet.png').read_bytes()),'samples':[{k:s[k] for k in ['id','sha','width','height']}|{'plate':digest(s['plate'].read_bytes())} for s in samples]}
    checkpoint=data/'vision-checkpoints'/(digest(canonical(inputs))+'.json')
    if checkpoint.exists():
        cached=json.loads(checkpoint.read_text());signature=cached.pop('signature')
        if not hmac.compare_digest(signature,hmac.new(key(data),canonical(cached),'sha256').hexdigest()) or cached['inputs']!=inputs:raise RuntimeError('CHECKPOINT_TAMPERED')
        report=cached['report']
        if digest(Path(report['path']).read_bytes())!=report['sha'] or digest(Path(report['logPath']).read_bytes())!=report['logSha']:raise RuntimeError('CHECKPOINT_EVIDENCE_TAMPERED')
        print(f'Visual QA {role}: resumed sealed {len(samples)}-sample model result',flush=True)
        return cached['entries'],report
    folder=run_dir/role;folder.mkdir(parents=True,exist_ok=True)
    schema_path=folder/'schema.json';write(schema_path,schema(samples));report=folder/'verdict.json';report.unlink(missing_ok=True)
    rules=json.loads(RULES.read_text());axes=rules['requiredTextureAxes'] if role=='texture' else rules['requiredStructureAxes'];minimum=rules['minimumTextureScore'] if role=='texture' else rules['minimumStructureScore']
    prompt=f'''You are an independent adversarial pixel-art Visual QA gate, role={role}. Your job is to stop unsuitable art before human review. You did NOT author it. Inspect the attached actual pixel images. Do not run commands, edit files, author art, or trust claims of success. The FIRST attached image is the ORIGINAL REFERENCE SHEET, not a sample to score: it includes original plaster/brick/stone, blue church roofing and the original log cabin (the standard for log-material candidates, whose RIGHT picture is that cabin; judge log roof and wall grain against it, not against tiles or plaster). All images use native pixels and nearest-neighbor enlargement; do not judge UI text. For each following sample the LEFT picture is the candidate and the RIGHT picture is an original Beodeul reference. Context rows show the candidate next to the existing house and warm tree at identical native scale. The reference anchors define the established style, NOT merely a palette.
The user rejected flat sparse manufactured roofing, thick boxed walls, coarse repeated grids, missing rounded tile relief, loss of fine plaster/stone grain, and a graphic/toy style that looks unrelated to the original. Require granular original-looking shingles with highlights following a real roof plane, original dot scale and texture density, original-sized outlines, and compatible contrast/light. Do not forgive mismatch because it is pixel art. New shapes/colors are allowed IF the rendering style fits. Perspective is 3/4 top view with roof top visible; a side wall is NOT required. One visible functional entry into the enclosed building body, consistent wall material per building, no floating roof, broken/cut edges, implausible joints, duplicated upstairs doors, or props concealing entry. Role differences allow a church larger than a small house; do not impose identical dimensions. Timber framing and plaster constitute one coherent facade concept. Multiple non-door windows are fine. Church/window/stained glass is not automatically a second door. Structural judging must use visible pixels, not entrance metadata. Count doors and open room entrances, not open-air space: an outdoor courtyard or passage between separate wings does not itself enter an enclosed room merely because a roof bridge spans above it. Distinguish visible outdoor ground between wings from a thresholded opening in an enclosing wall. Still reject any second wooden door or actual room entrance, including one on a rear facade or raised wing. This distinction applies to every sample, not an exemption for any candidate.
Judge these axes only: {axes}. Each gets an honest 0-100 score. A score >= {minimum} means you cannot find a material violation under close inspection, not that it is merely recognizable. Any material defect means FAIL, even if other axes pass. PASS requires every listed axis >= {minimum} and zero issues. Do not manufacture failures on clean originals, but don't excuse defects inherited from an original. For FAIL provide concrete code, approximate x/y in the candidate's NATIVE pixel coordinates and why it fails. For every result state what you actually observed, including the roof/wall texture. Echo id and sha exactly. Do not aim for ten passes: inspect and reject independently. You must evaluate ALL samples, not just first/last. Final output must match the JSON schema.
Samples in attached image order:\n'''+json.dumps([{k:s[k] for k in ['id','sha','width','height']} for s in samples],ensure_ascii=False)
    if role=='structure':
        prompt=prompt.replace('For each following sample the LEFT picture is the candidate and the RIGHT picture is an original Beodeul reference. Context rows show the candidate next to the existing house and warm tree at identical native scale.','Each following image contains exactly ONE candidate at 4x nearest-neighbor scale. There is no adjacent reference house or context row in these images. Inspect the entire facade, including doors on rear sections and forward wings. Count full-height wooden panels with a knob that reach their section\'s foundation as doors, even when their ground lines differ. Windows have glazing and/or a sill. Do not assume a rear door is a window because a foreground door is present.')
    (folder/'prompt.txt').write_text(prompt)
    work=folder/'vision-work';work.mkdir(exist_ok=True)
    cmd=[shutil.which('codex') or 'codex','exec','--skip-git-repo-check','--ephemeral','-s','read-only','-C',str(work.resolve()),'--output-schema',str(schema_path.resolve()),'-o',str(report.resolve())]
    cmd+=['-i',str((run_dir/'original-reference-sheet.png').resolve())]
    for sample in samples:cmd+=['-i',str(sample['plate'].resolve())]
    cmd+=['-']
    log=folder/'engine.log'
    with log.open('w') as output:
        result=subprocess.run(cmd,input=prompt.encode(),stdout=output,stderr=subprocess.STDOUT,timeout=1200)
    if result.returncode!=0 or not report.exists():raise RuntimeError(f'{role} vision engine failed; publication stays blocked. Log {log}')
    verdict=json.loads(report.read_text());entries=verdict.get('items',[])
    if len(entries)!=len(samples) or len({e['id'] for e in entries})!=len(samples):raise ValueError('INCOMPLETE_VISUAL_QA '+role)
    byid={e['id']:e for e in entries}
    for sample in samples:
        e=byid[sample['id']]
        if e['sha']!=sample['sha']:raise ValueError('STALE_VQA '+sample['id'])
        scores={s['axis']:s['score'] for s in e['scores']}
        if any(type(v) is not int or not 0<=v<=100 for v in scores.values()):raise ValueError('INVALID_SCORE '+sample['id'])
        if set(scores)!=set(axes) or len(e['scores'])!=len(axes):raise ValueError('MISSING_AXES '+sample['id'])
        if e['verdict']=='FAIL' and not e['issues']:raise ValueError('UNEXPLAINED_FAILURE '+sample['id'])
        if e['verdict']=='PASS' and (e['issues'] or any(v<minimum for v in scores.values())):raise ValueError('CONTRADICTORY_PASS '+sample['id'])
    reference={'path':str(report.resolve()),'sha':digest(report.read_bytes()),'logPath':str(log.resolve()),'logSha':digest(log.read_bytes()),'exitCode':0}
    current_inputs={'profile':files_profile(),'role':role,'reference':digest((run_dir/'original-reference-sheet.png').read_bytes()),'samples':[{k:s[k] for k in ['id','sha','width','height']}|{'plate':digest(s['plate'].read_bytes())} for s in samples]}
    if inputs!=current_inputs:raise RuntimeError('CHECKPOINT_INPUTS_CHANGED_DURING_REVIEW')
    cached={'inputs':inputs,'entries':byid,'report':reference}
    cached['signature']=hmac.new(key(data),canonical(cached),'sha256').hexdigest();write(checkpoint,cached)
    return byid,reference

def run_gate(data):
    profile=files_profile();rules=json.loads(RULES.read_text())
    with sqlite3.connect(data/'review.sqlite') as c:rows=list(c.execute('select id,sha,meta from drafts order by position'))
    target={i['id'] for i in json.loads((SOURCE/'seed.json').read_text())['candidates']};rows=[r for r in rows if r[0] in target]
    if len({r[1] for r in rows})!=len(rows):raise ValueError('DUPLICATE_CANDIDATE_PIXELS')
    if len(rows)!=len(target) or not rows:raise ValueError('Build all drafts first; missing candidates cannot publish.')
    folder=data/'visualqa'/profile/(time.strftime('%Y%m%dT%H%M%SZ',time.gmtime())+'-'+secrets.token_hex(4));folder.mkdir(parents=True,exist_ok=True);samples=[]
    sheet=Image.new('RGB',(1300,560),'#8dae59');draw=ImageDraw.Draw(sheet);x=20
    for path in ANCHORS:
        im=Image.open(path).convert('RGBA');big=im.resize((im.width*2,im.height*2),Image.Resampling.NEAREST)
        sheet.paste(big,(x,520-big.height),big);draw.text((x,535),path.stem+' ORIGINAL',fill='#22312a');x+=big.width+24
    sheet.save(folder/'original-reference-sheet.png')
    for id,sha,meta in rows:
        item=json.loads(meta);file=data/'staging'/id/(sha+'.png');assert digest(file.read_bytes())==sha
        image=strict_contract(item,file);context=Image.open(data/'staging'/id/(sha+'-scene.png')).convert('RGBA')
        picture=folder/(id+'-plate.png');plate(image,native(reference_key(item)),context).save(picture)
        structure_picture=folder/(id+'-structure.png');structure_plate(image).save(structure_picture)
        samples.append(dict(id=id,sha=sha,width=image.width,height=image.height,plate=picture,structurePlate=structure_picture,item=item,recipeSha=digest(canonical(recipe(id)))))
    # Blind negative probes prove the critic can detect the failure class the user just rejected.
    old=Image.open(SOURCE/'negative/user-rejected-style.png').convert('RGBA');oldfile=folder/'probe-a.png';plate(old,native('arch:cream')).save(oldfile)
    style_probe=dict(id='sample-11',sha=digest((SOURCE/'negative/user-rejected-style.png').read_bytes()),width=old.width,height=old.height,plate=oldfile)
    normal=native('bd-house-h120_0');gap=Image.new('RGBA',(normal.width,normal.height+16));gap.paste(normal.crop((0,0,normal.width,64)),(0,0));gap.paste(normal.crop((0,64,normal.width,normal.height)),(0,80));gapfile=folder/'probe-b.png';plate(gap,native('arch:cream')).save(gapfile)
    doors=native('bd-house-h109_1');doorfile=folder/'probe-c.png';plate(doors,native('arch:cream')).save(doorfile)
    structure_probes=[dict(id='sample-12',sha=digest(gap.tobytes()),width=gap.width,height=gap.height,plate=gapfile),dict(id='sample-13',sha=digest(doors.tobytes()),width=doors.width,height=doors.height,plate=doorfile)]
    gap_structure=folder/'probe-b-structure.png';structure_plate(gap).save(gap_structure)
    doors_structure=folder/'probe-c-structure.png';structure_plate(doors).save(doors_structure)
    structure_probes[0]['plate']=gap_structure;structure_probes[1]['plate']=doors_structure
    shared_images=[folder/'original-reference-sheet.png',oldfile,gapfile,doorfile,gap_structure,doors_structure]
    for sample in samples:
        sample['reviewImages']=[{'path':str(p.resolve()),'sha':digest(p.read_bytes())} for p in [sample['plate'],sample['structurePlate'],*shared_images]]
        sample['assets']={suffix:digest((data/'staging'/sample['id']/(sample['sha']+suffix)).read_bytes()) for suffix in ['.png','-scene.png','.pixels.json']}
    # Separate fresh processes; no manually authored judgments.
    print(f'Visual QA texture critic running: {len(samples)} drafts + blind failed-style probe',flush=True)
    texture,tf=judge(data,'texture',samples+[style_probe],profile,folder)
    if not (failed_axis(texture['sample-11'],'roof_grain',rules['minimumTextureScore']) and failed_axis(texture['sample-11'],'wall_grain',rules['minimumTextureScore'])):raise RuntimeError('CALIBRATION_FAILURE texture: failed-style probe was not correctly rejected.')
    texture_failed=[s['id'] for s in samples if texture[s['id']]['verdict']!='PASS' and not exempt(data,s['id'],s['sha'],'staging')]
    if texture_failed:
        write(ROOT/'verify-shots/beodeul-building-review/visualqa-rejected.json',{'profile':profile,'stage':'texture','failed':texture_failed,'reviews':texture,'published':False})
        raise RuntimeError('TEXTURE_QA_REJECTED '+str(texture_failed))
    print(f'Visual QA structure critic running: {len(samples)} drafts + floating-roof/double-door probes',flush=True)
    structure,sf=judge(data,'structure',[{**s,'plate':s['structurePlate']} for s in samples]+structure_probes,profile,folder)
    calibrated=failed_axis(texture['sample-11'],'roof_grain',rules['minimumTextureScore']) and failed_axis(texture['sample-11'],'wall_grain',rules['minimumTextureScore']) and failed_axis(structure['sample-12'],'roof_joints',rules['minimumStructureScore']) and failed_axis(structure['sample-13'],'single_door',rules['minimumStructureScore'])
    if not calibrated:raise RuntimeError('CALIBRATION_FAILURE: critic admitted a known defect. No candidate published.')
    if profile!=files_profile() or any(s['recipeSha']!=digest(canonical(recipe(s['id']))) for s in samples):raise RuntimeError('Inputs changed during review. All verdicts invalid.')
    if any(digest(Path(e['path']).read_bytes())!=e['sha'] for sample in samples for e in sample['reviewImages']):raise RuntimeError('Review images changed during inspection.')
    results=[]
    for sample in samples:
        id,sha=sample['id'],sample['sha'];reviews={'texture':texture[id],'structure':structure[id]};passed=all(r['verdict']=='PASS' for r in reviews.values())
        record={'id':id,'sha':sha,'profile':profile,'recipe':sample['recipeSha'],'assets':sample['assets'],'reviewImages':sample['reviewImages'],'reviews':reviews,'reportFiles':{'texture':tf,'structure':sf},'calibrationPassed':True,'passed':passed}
        record['signature']=hmac.new(key(data),canonical(record),'sha256').hexdigest();write(receipt_path(data,id,sha),record)
        results.append({'id':id,'sha':sha,'passed':passed,'exemptHumanAllowed':(not passed) and exempt(data,id,sha,'staging'),'texture':texture[id],'structure':structure[id]})
    proof={'profile':profile,'calibrationPassed':True,'calibration':{'rejectedStyle':texture['sample-11'],'floatingRoof':structure['sample-12'],'duplicateDoor':structure['sample-13']},'results':results};write(ROOT/'verify-shots/beodeul-building-review/visualqa-proof.json',proof)
    blocking=[r['id'] for r in results if not r['passed'] and not r['exemptHumanAllowed']]
    print(json.dumps({'visualQAPassed':sum(r['passed'] for r in results),'failed':[r['id'] for r in results if not r['passed']],'exemptHumanAllowed':[r['id'] for r in results if r['exemptHumanAllowed']],'published':False}),flush=True)
    if blocking:raise RuntimeError('VISUAL_QA_REJECTED '+str(blocking))
    return proof

def publish(data):
    with sqlite3.connect(data/'review.sqlite') as c:
        rows=list(c.execute('select id,position,sha,meta from drafts order by position'))
        ids={i['id'] for i in json.loads((SOURCE/'seed.json').read_text())['candidates']};rows=[r for r in rows if r[0] in ids]
        failed=[id for id,_,sha,_ in rows if not admitted(data,id,sha,location='staging')]
        if len(rows)!=len(ids) or failed:raise ValueError('PUBLICATION_BLOCKED missing/failed/stale gate: '+str(failed))
        for id,pos,sha,meta in rows:
            src=data/'staging'/id;target=data/'items'/id;target.mkdir(exist_ok=True,parents=True)
            for suffix in ['.png','-scene.png','.pixels.json']:shutil.copyfile(src/(sha+suffix),target/(sha+suffix))
            item=json.loads(meta);item['qaPassed']=True;item['qaProfile']=files_profile()
            if not verify_receipt(data,id,sha,location='staging'):item['qaExemptHumanAllowed']=True
            c.execute('insert into candidates values(?,?,?,?) on conflict(id) do update set position=excluded.position,sha=excluded.sha,meta=excluded.meta',(id,pos,sha,json.dumps(item,ensure_ascii=False)))
        c.commit()
    shutil.copyfile(ROOT/'verify-shots/beodeul-building-review/staging-native.png',ROOT/'verify-shots/beodeul-building-review/candidates-native.png')
    print(json.dumps({'published':len(rows),'humanDecision':'pending'}),flush=True)
