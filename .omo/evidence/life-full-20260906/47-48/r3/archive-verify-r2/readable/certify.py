import run as r
import hashlib,json,re,gzip,pathlib,subprocess
E=r.E;W=r.W
manifest=json.loads((E.parents[2]/'51/SOURCE-MANIFEST.json').read_text())
for row in manifest['files']:
    relative=row['source'].split('/rpg-zzu-life-full-spatial-rights/')[1]
    assert hashlib.sha256((W/relative).read_bytes()).hexdigest()==row['sha256']
imports=[]
for value in re.findall(r"from ['\"]([^'\"]+)['\"]",(E/'independent-rights.mts').read_text()):
    if value.startswith('node:'):continue
    p=pathlib.Path(value+'.ts');assert str(p).startswith(str(W)+'/src/') and p.is_file()
    imports.append(dict(declaration=value,realpath=str(p.resolve()),sha256=hashlib.sha256(p.read_bytes()).hexdigest()))
(E/'import-resolution.json').write_text(json.dumps(dict(project=imports,alias=str(W/'src'),dependencies=str((W/'node_modules').resolve())),indent=2))
for name in ['tests','typecheck','diagnostics-final','public-rights','public-rights-final','lock-released']:
    assert int((E/(name+'.exit')).read_text())==0
for name in ['public-state.first.json.gz','public-state.final.json.gz']:
    decoded=gzip.decompress((E/name).read_bytes());json.loads(decoded)
state=json.loads(gzip.decompress((E/'public-state.final.json.gz').read_bytes()))
assert len(state['captures'])==99
before=json.loads((E/'tests.before.json').read_text());after=r.identity();assert before==after
assert int((E/'interrupted.exit').read_text())==-15
assert int((E/'misleading-failure.exit').read_text())==7
assert not (E/'owned-ready.fifo').exists()
assert not (W/'dist').exists()
assert len(manifest['files'])==9
print(json.dumps(dict(verdict='confirmed',scope='plan47/48 nonvisual correction only',head=after['head'],preserved_sources=9,independent_captures=99,full_identity_unchanged=True,source_status=after['status'],imports=imports),indent=2))
