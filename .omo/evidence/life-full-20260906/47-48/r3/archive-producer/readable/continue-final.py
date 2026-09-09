"""Continue after fixing unused import introduced by r3 probe relocation.
No product changes, test reruns, receipt replacement, or deadline changes.
"""
import receipt as r
import json,hashlib
freeze=json.loads((r.E/'final-source.json').read_text())
assert r.hashes()==freeze
(r.E/'final-artifacts-corrected.json').write_text(json.dumps({p.name:hashlib.sha256(p.read_bytes()).hexdigest() for p in r.E.iterdir() if p.suffix in ['.py','.mjs','.mts']},indent=2))
for name,seconds,argv in json.loads((r.E/'final-commands.json').read_text()):
    if name=='diagnostics':name='diagnostics-final'
    assert r.hashes()==freeze,'Source changed before '+name
    result=r.run(name,argv,seconds=seconds,heavy=True,build=name=='build')
    assert r.hashes()==freeze,'Source changed after '+name
    assert result==0, name+' failed with direct exit '+str(result)
(r.E/'FINAL-VALIDATORS-PASSED.json').write_text(json.dumps({'all_passed':True,'source_unchanged':True,'manifest_owners_exact':True,'probe_diagnostic_fix':'Removed unused fileURLToPath import left after replacing relative root lookup; first failure retained.'},indent=2))
