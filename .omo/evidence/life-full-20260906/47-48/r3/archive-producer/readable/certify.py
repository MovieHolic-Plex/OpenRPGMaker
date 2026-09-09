import receipt as r
import json,hashlib,gzip,subprocess
E=r.E
freeze=json.loads((E/'final-source.json').read_text());assert r.hashes()==freeze
required=['characterization','red','diagnostics-probe-final','tests','public-rights-final','typecheck','build','diff-check','wiki-check','wrapper-adversarial']
for name in required:
    expected=1 if name=='red' else 0
    assert int((E/(name+'.exit')).read_text())==expected,name
    for suffix in ['command.json','inputs.json','stdout','stderr','after.json','cleanup.json']: assert (E/(name+'.'+suffix)).exists(),name+'.'+suffix
    cleanup=json.loads((E/(name+'.cleanup.json')).read_text())
    assert cleanup['source_bytes_unchanged'] and cleanup['scratch_removed'],name
baseline=json.loads((E/'characterization.inputs.json').read_text());red=json.loads((E/'red.inputs.json').read_text())
assert {k:v for k,v in red.items() if k!='test/spatialRecoveryRights.test.ts'}==baseline
for name in ['diagnostics-probe-final','tests','public-rights-final','typecheck','build','diff-check']:
    assert json.loads((E/(name+'.inputs.json')).read_text())==freeze,name
manifest=json.loads((r.P/'.omo/evidence/life-full-20260906/51/SOURCE-MANIFEST.json').read_text())
owners=[f['source'].split('/rpg-zzu-life-full-spatial-rights/')[1] for f in manifest['files']]
for f,p in zip(manifest['files'],owners):assert hashlib.sha256((r.W/p).read_bytes()).hexdigest()==f['sha256']
allowed=set(owners+['openwiki/INDEX.md'])
changed=set(subprocess.check_output(['git','diff','--name-only'],cwd=r.W).decode().splitlines())|set(subprocess.check_output(['git','ls-files','--others','--exclude-standard'],cwd=r.W).decode().splitlines())
assert changed==allowed,(changed,allowed)
state=json.loads((E/'public-state.json').read_text());final=state['final'];assert final['gold']==90 and final['inventory'][state['itemId']]==10
claims=list(final['lifeRecovery']['claims'].values());assert len(claims)==1 and claims[0]['items']==[] and claims[0]['unresolved']['record']['paymentReceipt']['gold']==10
imports=json.loads((E/'import-resolution.json').read_text());assert imports['root']==str(r.W)
for f in imports['sources']:
    assert f['path'].startswith(str(r.W)+'/src/')
    assert hashlib.sha256(__import__('pathlib').Path(f['path']).read_bytes()).hexdigest()==f['sha256']
cleanup=[]
for p in E.glob('*.cleanup.json'):
    item=json.loads(p.read_text());assert item['scratch_removed'];assert not __import__('pathlib').Path(item['scratch']).exists();cleanup.append(p.name)
assert not (r.W/'dist').exists() and not (r.W/'dist').is_symlink()
artifacts={p.name:hashlib.sha256(p.read_bytes()).hexdigest() for p in E.iterdir() if p.suffix in ['.py','.mjs','.mts']}
(E/'final-executed-artifacts.json').write_text(json.dumps(artifacts,indent=2))
result={'status':'PASS','base':manifest['base_sha'],'owners':sorted(allowed),'nine_sources_match_preserved_manifest':True,'baseline_product_unchanged_for_red':True,'final_source_bytes_unchanged_across_validators':True,'source_root':str(r.W),'public_captures':len(state['captures']),'cleanup_receipts':cleanup,'dist_removed':True,'historical_results_reused_as_passes':False,'prior_failures_retained':['diagnostics','public-rights','public-rights-external-config'],'build_warnings_retained':True}
(E/'PRECOMMIT-CERTIFICATION.json').write_text(json.dumps(result,indent=2));print(json.dumps(result,indent=2))
