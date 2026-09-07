"""Restore only verified manifest owners with native apply_patch, never reset."""
import receipt as r
import gzip,json,hashlib,difflib,subprocess,sys
B=r.P/'.omo/evidence/life-full-20260906/51'
m=json.loads((B/'SOURCE-MANIFEST.json').read_text())
mode=sys.argv[1]
patch=['*** Begin Patch\n'];results=[]
for f in m['files']:
    compressed=(B/f['artifact']).read_bytes();after=gzip.decompress(compressed)
    assert hashlib.sha256(compressed).hexdigest()==f['compressed_sha256']
    assert hashlib.sha256(after).hexdigest()==f['sha256'] and len(after)==f['bytes']
    rel=f['source'].split('/rpg-zzu-life-full-spatial-rights/')[1]
    if (rel=='test/spatialRecoveryRights.test.ts') != (mode=='red'): continue
    p=r.W/rel
    if p.exists():
        before=p.read_bytes()
        base=subprocess.check_output(['git','show',m['base_sha']+':'+rel],cwd=r.W)
        assert before==base,'Unrelated or unexpected edits: '+rel
        hunks=list(difflib.unified_diff(before.decode().splitlines(True),after.decode().splitlines(True),n=3))[2:]
        patch.append('*** Update File: '+rel+'\n')
        for line in hunks:patch.append('@@\n' if line.startswith('@@') else line)
    else:
        assert rel=='test/spatialRecoveryRights.test.ts'
        patch.append('*** Add File: '+rel+'\n');patch.extend('+'+line for line in after.decode().splitlines(True))
    results.append({'path':rel,'expected':f['sha256']})
patch.append('*** End Patch\n');text=''.join(patch)
(r.E/(mode+'.patch')).write_text(text)
exe='/home/main/.npm-global/lib/node_modules/@openai/codex/node_modules/@openai/codex-linux-x64/vendor/x86_64-unknown-linux-musl/bin/codex'
assert r.run('apply-'+mode,[exe,'--codex-run-as-apply-patch',text])==0
for f in results:
    f['actual']=hashlib.sha256((r.W/f['path']).read_bytes()).hexdigest();assert f['actual']==f['expected']
(r.E/(mode+'-restored.json')).write_text(json.dumps(results,indent=2))
