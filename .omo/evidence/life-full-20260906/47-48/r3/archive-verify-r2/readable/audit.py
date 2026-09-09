from pathlib import Path
import subprocess,json,hashlib,gzip,os
import run as r
E=r.E;P=E.parent/'producer';W=r.W
head=r.identity();assert head['head']=='b87c9822f431ece4674e97a9d9cd15d1956be327' and head['status']==''
base='b5c679efc6c5e575f7a1afb65dfa86939aade325'
assert subprocess.check_output(['git','rev-parse','HEAD^'],cwd=W).decode().strip()==base
owners=subprocess.check_output(['git','diff','HEAD^','HEAD','--name-only'],cwd=W).decode().splitlines()
(E/'committed.diff').write_bytes(subprocess.check_output(['git','diff','HEAD^','HEAD'],cwd=W))
source={p:hashlib.sha256((W/p).read_bytes()).hexdigest() for p in owners}
for p,h in source.items():assert hashlib.sha256(subprocess.check_output(['git','show','HEAD:'+p],cwd=W)).hexdigest()==h
baseline=json.loads((P/'characterization.inputs.json').read_text());red=json.loads((P/'red.inputs.json').read_text())
for phase,data in [('baseline',baseline),('RED',red)]:
    for p in owners:
        if p=='test/spatialRecoveryRights.test.ts':continue
        assert data[p]==hashlib.sha256(subprocess.check_output(['git','show',base+':'+p],cwd=W)).hexdigest(),(phase,p)
assert red['test/spatialRecoveryRights.test.ts']==source['test/spatialRecoveryRights.test.ts']
rows=[];streams=[]
for name,expected in [('characterization',0),('red',1),('tests',0),('diagnostics-probe-final',0),('typecheck',0),('build',0),('public-rights-final',0),('wrapper-adversarial',0),('wrapper-interrupted',-15),('wrapper-failure',7),('wrapper-lock-release',0)]:
    exit=int((P/(name+'.exit')).read_text());assert exit==expected
    before=json.loads((P/(name+'.inputs.json')).read_text());after=json.loads((P/(name+'.after.json')).read_text());assert before==after
    if name not in ['characterization','red']:
        for p,h in source.items():assert before[p]==h,(name,p)
    clean=json.loads((P/(name+'.cleanup.json')).read_text());assert clean['scratch_removed'];assert not Path(clean['scratch']).exists()
    row={'name':name,'exit':exit,'cleanup':clean,'artifacts':{}}
    for suffix in ['command.json','stdout','stderr','exit','cleanup.json']:
        path=P/(name+'.'+suffix);data=path.read_bytes();row['artifacts'][suffix]={'path':str(path),'bytes':len(data),'sha256':hashlib.sha256(data).hexdigest()}
        if suffix in ['stdout','stderr','exit'] and name not in ['red','build']:
            streams.append('\n### '+str(path)+'\n'+data.decode())
    rows.append(row)
assert not (W/'dist').exists()
first=json.loads((E/'tests.before.json').read_text());assert first==head
for path in E.glob('*.cleanup.json'):
    data=json.loads(path.read_text())
    if 'identity_unchanged' in data:assert data['identity_unchanged'] and data['removed'],path
state=E/'public-state.json';data=state.read_bytes();payload=json.loads(data);z=E/'public-state.final.json.gz';z.write_bytes(gzip.compress(data));assert gzip.decompress(z.read_bytes())==data;state.unlink()
(E/'state-index.json').write_text(json.dumps({'archive':str(z),'raw_bytes':len(data),'raw_sha256':hashlib.sha256(data).hexdigest(),'capture_labels':[c['label'] for c in payload['captures']],'final_basic':payload['final'],'final_slots':payload['slots']},indent=2))
(E/'producer-stream-review.txt').write_text(''.join(streams))
(E/'audit.json').write_text(json.dumps(dict(head=head['head'],base=base,status=head['status'],owners=source,producer=rows,all_final_sources_equal=True,baseline_and_red_base_equal=True,independent_identity_unchanged=True,model=os.environ.get('PI_MODEL'),public_captures=len(payload['captures']),own_scratch_remaining=[str(p) for p in E.glob('scratch-*')],old_verifier_untouched=True,build_rerun=False),indent=2))
print(json.dumps(dict(audit='passed',model=os.environ.get('PI_MODEL'),public_captures=len(payload['captures']),raw_bytes=len(data),source_owners=len(owners))))
