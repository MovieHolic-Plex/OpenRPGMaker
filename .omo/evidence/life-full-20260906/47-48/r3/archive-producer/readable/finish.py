import receipt as r
import subprocess,json,hashlib,pathlib,datetime
sha=subprocess.check_output(['git','rev-parse','HEAD'],cwd=r.W,text=True).strip()
assert sha=='b87c9822f431ece4674e97a9d9cd15d1956be327'
assert subprocess.check_output(['git','status','--porcelain'],cwd=r.W)==b''
assert subprocess.check_output(['git','rev-parse','HEAD^'],cwd=r.W,text=True).strip()=='b5c679efc6c5e575f7a1afb65dfa86939aade325'
assert r.hashes()==json.loads((r.E/'final-source.json').read_text())
for p in r.E.glob('*.cleanup.json'):
    c=json.loads(p.read_text());assert c['scratch_removed'] and not pathlib.Path(c['scratch']).exists()
assert not (r.W/'dist').exists() and not (r.W/'dist').is_symlink()
passes={n:int((r.E/(n+'.exit')).read_text()) for n in ['characterization','diagnostics-probe-final','tests','public-rights-final','typecheck','build','wiki-check','diff-check','wrapper-adversarial','certification','commit','committed-identity']}
assert all(v==0 for v in passes.values())
assert int((r.E/'red.exit').read_text())==1
result={'status':'SUCCESS','task_id':'st_01a079b9','attempt':'NEW r3','commit_sha':sha,'sha':sha,'branch':'agent/life-full-spatial-rights-r3','base_sha':'b5c679efc6c5e575f7a1afb65dfa86939aade325','worktree':str(r.W),'evidence':str(r.E),'summary':'SUMMARY.md','summary_sha256':hashlib.sha256((r.E/'SUMMARY.md').read_bytes()).hexdigest(),'source_frozen':True,'clean_worktree':True,'manifest_sources_exact':True,'fresh_characterization':{'files':2,'passed':75,'exit':0},'fresh_red':{'revision':'preserved final 22-case test, not historical original RED','failed':17,'passed':5,'exit':1},'final_tests':{'files':18,'passed':355,'executions':1,'exit':0},'public_probe':{'exit':0,'captures':24,'state':'public-state.json','imports':'import-resolution.json'},'successful_receipts':passes,'preserved_attempt_failures':{'diagnostics':1,'public-rights':1,'public-rights-external-config':1},'intentional_wrapper_exits':{'interrupted_inner':-15,'interrupted_wrapper':241,'failure_stub':7},'cleanup':{'owned_scratch_removed':True,'owned_dist_removed':True,'evidence_retained':True,'worktree_retained':True,'shared_cache_deleted':False,'server_started':False},'pending':['independent parent verification','whole task12','Grok lifeFieldInteraction45','native/visual verification','Phase4 approval','overall goal approval'],'completed_utc':datetime.datetime.now(datetime.timezone.utc).isoformat()}
(r.E/'DONE.json').write_text(json.dumps(result,indent=2)+'\n')
(r.E/'FINAL-VALIDATORS-PASSED.json').write_text(json.dumps({'all_required_validators_passed':True,'product_bytes_unchanged':True,'commit_sha':sha,'success_receipts':passes,'previous_failed_adaptations_retained':True},indent=2)+'\n')
# Hash all stable artifacts, excluding receipts currently being written by this command.
manifest={p.name:{'bytes':p.stat().st_size,'sha256':hashlib.sha256(p.read_bytes()).hexdigest()} for p in r.E.iterdir() if p.is_file() and not p.name.startswith('handoff.') and p.name!='EVIDENCE-MANIFEST.json'}
(r.E/'EVIDENCE-MANIFEST.json').write_text(json.dumps(manifest,indent=2)+'\n')
print(json.dumps(result,indent=2))
