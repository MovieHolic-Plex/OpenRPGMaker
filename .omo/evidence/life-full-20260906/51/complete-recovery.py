"""Complete deterministic recorded-literal decoding; does not run original tools."""
import ast
import gzip
import hashlib
import json
from pathlib import Path
D = Path(__file__).resolve().parent
M = json.loads((D / 'PROVENANCE.json').read_bytes())


def add(rel, data, **proof):
    dest = D / (rel + '.gz')
    assert not dest.exists()
    dest.parent.mkdir(parents=True, exist_ok=True)
    dest.write_bytes(gzip.compress(data, mtime=0))
    assert gzip.decompress(dest.read_bytes()) == data
    M['artifacts'].append(dict(artifact=str(dest.relative_to(D)), bytes=len(data), sha256=hashlib.sha256(data).hexdigest(), compressed_sha256=hashlib.sha256(dest.read_bytes()).hexdigest(), **proof))


def decoded(name):
    return gzip.decompress((D/name).read_bytes())


# Original first summary: three independent recorded/copy byte sources match.
summary = decoded('existing/verifier-first/producer-summary.txt.gz')
rows = [r for r in M['artifacts'] if r['artifact'].startswith('owned/st_01a07964/decoded/048-call-') and r['artifact'].endswith('-content.txt.gz')]
assert len(rows) == 1
assert decoded(rows[0]['artifact']) == summary
add('recovered-created/first/SUMMARY.md', summary, kind='original first blocked summary; byte-identical independent verifier copy and recorded write argument', sources=['existing/verifier-first/producer-summary.txt.gz', rows[0]['artifact']])

# Extract exact Add File payload in original JOURNAL patch, not a new narrative.
journal_patch = decoded('recorded-patches/st_01a07972-line43.patch.gz').decode()
lines = journal_patch.splitlines()
assert lines[1] == '*** Add File: .omo/evidence/life-full-20260906/47-48/r2/JOURNAL.md'
assert all(line.startswith('+') for line in lines[2:-1])
add('recovered-created/r2-line43/JOURNAL.md', ('\n'.join(line[1:] for line in lines[2:-1])+'\n').encode(), kind='original Add File content decoded from recorded native patch argument', sources=['recorded-patches/st_01a07972-line43.patch.gz'])

# Exact RED native patch argument was built from a literal in the recorded call.
# Decode the same bounded builder (not subprocess.run).
for n in [47, 80, 84]:
    session = next(s for s in M['sessions'] if s['task'] == 'st_01a07972')
    raw = Path(session['path']).read_bytes().splitlines(keepends=True)[n-1]
    event = json.loads(raw)
    call = next(p for p in event['message']['content'] if p.get('type') == 'toolCall')
    body = call['arguments']['command'].split("<<'PY'\n",1)[1].split('\nPY',1)[0]
    tree = ast.parse(body)
    if n == 84:
        contents = {}
        for node in tree.body:
            if isinstance(node,ast.Assign) and isinstance(node.targets[0],ast.Subscript):
                contents[ast.literal_eval(node.targets[0].slice)] = ast.literal_eval(node.value)
        patch = '*** Begin Patch\n'
        for path, content in contents.items():
            patch += '*** Add File: '+path+'\n'+''.join('+'+line+'\n' for line in content.splitlines())
        patch += '*** End Patch'
    else:
        # Keep the full original builder argument as the authoritative evidence;
        # only inspect its literal assignment and machine-generated expression.
        content = next(ast.literal_eval(node.value) for node in tree.body if isinstance(node,ast.Assign) and isinstance(node.targets[0],ast.Name) and node.targets[0].id=='content')
        expr = next(node.value for node in tree.body if isinstance(node,ast.Assign) and isinstance(node.targets[0],ast.Name) and node.targets[0].id=='patch')
        # Explicitly bounded expression decoder for this recorded string builder.
        def value(node, env):
            if isinstance(node,ast.Constant): return node.value
            if isinstance(node,ast.Name): return env[node.id]
            if isinstance(node,ast.BinOp) and isinstance(node.op,ast.Add): return value(node.left,env)+value(node.right,env)
            if isinstance(node,ast.Call) and isinstance(node.func,ast.Attribute):
                receiver=value(node.func.value,env)
                if node.func.attr=='splitlines' and not node.args: return receiver.splitlines()
                if node.func.attr=='join' and len(node.args)==1: return receiver.join(value(node.args[0],env))
            if isinstance(node,ast.GeneratorExp) and len(node.generators)==1:
                gen=node.generators[0]
                assert isinstance(gen.target,ast.Name) and not gen.ifs and not gen.is_async
                return [value(node.elt,{**env,gen.target.id:item}) for item in value(gen.iter,env)]
            raise ValueError(ast.dump(node))
        patch = value(expr, {'content':content})
    add('recorded-patches/st_01a07972-line%d-built.patch'%n, patch.encode(), kind='exact native patch argument deterministically decoded from recorded literal and string builder; builder never executed', source=session['path'], source_line=n, event_id=event['id'], source_event_sha256=hashlib.sha256(raw).hexdigest(), source_offset=sum(len(l) for l in Path(session['path']).read_bytes().splitlines(keepends=True)[:n-1]), source_length=len(raw), call_id=call['id'], derivation='AST literals and whitelisted string operations only')

# Final probe bytes are a deterministic replay of two exact original recorded
# patches. Distinguish from a directly captured final on-disk script/hash.
probe = decoded('recovered-created/r2-line84/public-rights.mts.gz').decode()
patch = decoded('recorded-patches/st_01a07972-line88.patch.gz').decode()
section = patch.split('*** Update File: .omo/evidence/life-full-20260906/47-48/r2/public-rights.mts\n',1)[1].split('*** End Patch',1)[0]
for hunk in section.split('@@\n')[1:]:
    before = ''.join(line[1:]+'\n' for line in hunk.splitlines() if line.startswith(('-', ' ')))
    after = ''.join(line[1:]+'\n' for line in hunk.splitlines() if line.startswith(('+', ' ')))
    assert before and probe.count(before)==1
    probe = probe.replace(before,after,1)
add('recovered-created/r2-final-recorded-patches/public-rights.mts', probe.encode(), kind='original script recovered by deterministic replay of recorded Add File and Update File arguments; not a newly authored reconstruction; no surviving final on-disk script hash', sources=['recorded-patches/st_01a07972-line84-built.patch.gz','recorded-patches/st_01a07972-line88.patch.gz'], derivation='exact unique before/after hunk substitution in memory only; no probe execution')
(D/'PROVENANCE.json').write_text(json.dumps(M,indent=2)+'\n')
(D/'RECOVERED-SCRIPT-NOTES.json').write_text(json.dumps(dict(first_summary_write_equals_independent_copy=True, final_probe_kind='decoded original patch history, not new reconstruction or rerun; final disk-byte hash receipt unavailable', final_probe_bytes=len(probe.encode()), final_probe_sha256=hashlib.sha256(probe.encode()).hexdigest(), original_tests='r2-line47 test file is original 19-case RED revision, NOT current final test file', artifacts=len(M['artifacts'])),indent=2)+'\n')
print((D/'RECOVERED-SCRIPT-NOTES.json').read_text())
