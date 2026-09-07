"""NEW r3 final-byte runner. Stop on any real failure; no retry-to-green."""
import receipt as r
import json,hashlib,gzip
B=r.P/'.omo/evidence/life-full-20260906/51'
m=json.loads((B/'SOURCE-MANIFEST.json').read_text())
for f in m['files']:
    p=f['source'].split('/rpg-zzu-life-full-spatial-rights/')[1]
    assert hashlib.sha256((r.W/p).read_bytes()).hexdigest()==f['sha256']
freeze=r.hashes();(r.E/'final-source.json').write_text(json.dumps(freeze,indent=2))
artifacts={p.name:hashlib.sha256(p.read_bytes()).hexdigest() for p in r.E.iterdir() if p.suffix in ['.py','.mjs','.mts']}
(r.E/'final-artifacts.json').write_text(json.dumps(artifacts,indent=2))
for name,seconds,argv in json.loads((r.E/'final-commands.json').read_text()):
    assert r.hashes()==freeze,'Source changed before '+name
    result=r.run(name,argv,seconds=seconds,heavy=True,build=name=='build')
    assert r.hashes()==freeze,'Source changed after '+name
    assert result==0, name+' failed with direct exit '+str(result)
(r.E/'FINAL-VALIDATORS-PASSED.json').write_text(json.dumps({'all_passed':True,'source_unchanged':True,'manifest_owners_exact':True},indent=2))
