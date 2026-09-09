"""Bounded forensic decoder. Never executes recorded commands, patches, or probes."""
import ast
import gzip
import hashlib
import json
from pathlib import Path

D = Path(__file__).resolve().parent
TASKS = Path('/home/main/.herdr/worktrees/rpg-zzu/wish-html/.omo/senpi-task')
P = Path('/home/main/z-project/rpg-zzu-life-full-spatial-rights')
BASE = Path('/home/main/z-project/rpg-zzu-life-full-p4/.omo/evidence/life-full-20260906')
manifest = []
sessions = []
index = []


def sha(data):
    return hashlib.sha256(data).hexdigest()


def archive(rel, data, **provenance):
    dest = D / (rel + '.gz')
    dest.parent.mkdir(parents=True, exist_ok=True)
    assert not dest.exists(), dest
    dest.write_bytes(gzip.compress(data, mtime=0))
    assert gzip.decompress(dest.read_bytes()) == data
    row = dict(artifact=str(dest.relative_to(D)), bytes=len(data), sha256=sha(data), compressed_sha256=sha(dest.read_bytes()), **provenance)
    manifest.append(row)
    return row


def copy(path, rel, kind):
    data = path.read_bytes()
    row = archive(rel, data, source=str(path), source_offset=0, source_length=len(data), kind=kind)
    assert path.read_bytes() == data
    return row


# Existing evidence directories only, not a checkout or credential archive.
for label, root in [
    ('post-loss-r2', P / '.omo/evidence/life-full-20260906/47-48/r2'),
    ('verifier-first', Path(str(P) + '-verify/.omo/evidence/life-full-20260906/47-48-verification')),
    ('verifier-r2', Path(str(P) + '-verify-r2/.omo/evidence/life-full-20260906/47-48-verification')),
]:
    for path in sorted(root.iterdir()):
        assert path.is_file() and not path.is_symlink()
        copy(path, 'existing/' + label + '/' + path.name,
             'post-loss receipt, not pre-loss original' if label == 'post-loss-r2' else 'surviving independent verifier evidence; producer-summary copies retain their original/ post-loss distinction')

for name in ['VERIFY.md', 'recovery-rights.mts', 'recovery-rights-state.json', 'recovery-rights.stdout', 'recovery-rights.stderr', 'recovery-rights.exit', 'recovery-rights-cleanup.txt', 'recovery-rights-clone-error.mts', 'recovery-rights-clone-error.stdout', 'recovery-rights-clone-error.stderr', 'recovery-rights-clone-error.exit', 'run-checks.sh', 'commands.txt']:
    copy(BASE / 'placement-parent-astra' / name, 'existing/parent-original/' + name, 'historical parent original, not r2 evidence')

owned = {}
for suffix in ['64', '67', '72', '82']:
    task = 'st_01a079' + suffix
    metadata = TASKS / 'tasks' / (task + '.json')
    meta = json.loads(metadata.read_bytes())
    assert meta['parent_session_id'] == '01a0727b-398a-7481-b557-b198013542c1'
    assert meta['spawn_spec']['cwd'] == str(TASKS.parent.parent)
    assert meta['created_at'].startswith('2026-09-07T01:')
    copy(metadata, 'owned/' + task + '/task.json', 'exact owned task metadata')
    copy(TASKS / 'logs' / (task + '.jsonl'), 'owned/' + task + '/lifecycle.jsonl', 'exact owned task lifecycle log')
    paths = list((TASKS / 'children' / task / 'sessions' / task).glob('2026-09-07T01-*_' + task[3:] + '-*.jsonl'))
    assert len(paths) == 1, paths
    path = paths[0]
    data = path.read_bytes()
    lines = data.splitlines(keepends=True)
    header = json.loads(lines[0])
    assert header['cwd'] == meta['spawn_spec']['cwd']
    assert header['id'].startswith(task[3:] + '-')
    sessions.append(dict(task=task, path=str(path), bytes=len(data), sha256=sha(data), session=header,
                         created_at=meta['created_at'], terminal_at=meta['terminal_at'], lines=len(lines)))
    events = []
    offset = 0
    calls = {}
    for n, line in enumerate(lines, 1):
        event = json.loads(line)
        events.append((n, offset, line, event))
        offset += len(line)
        for part in event.get('message', {}).get('content', []):
            if isinstance(part, dict) and part.get('type') == 'toolCall':
                calls[part['id']] = (n, part)
    owned[suffix] = (path, events, calls)
    # All tool calls/results indexed; only evidence-relevant records archived.
    selected_ids = set()
    for callid, (n, call) in calls.items():
        name = call['name']
        args = call['arguments']
        relevant = name in ['bash', 'write', 'lsp_diagnostics'] or (name == 'read' and '/.omo/evidence/' in args.get('path', ''))
        # Discard broad discovery/history listings, not execution evidence.
        if suffix == '64' and n in [5, 7, 10, 17]: relevant = False
        if suffix == '72' and n == 7: relevant = False
        if suffix == '82' and 'worktree list' in args.get('command', ''): relevant = False
        if relevant: selected_ids.add(callid)
    for n, offset, line, event in events:
        message = event.get('message', {})
        parts = message.get('content', [])
        callparts = [(k, part) for k, part in enumerate(parts) if isinstance(part, dict) and part.get('type') == 'toolCall']
        resultid = message.get('toolCallId')
        keep = n == 1 or any(part['id'] in selected_ids for _, part in callparts) or resultid in selected_ids
        provenance = dict(source=str(path), source_line=n, source_offset=offset, source_length=len(line), event_id=event.get('id'), timestamp=event.get('timestamp'), source_event_sha256=sha(line))
        for k, part in callparts:
            index.append(dict(task=task, line=n, event=event.get('id'), tool=part['name'], call_id=part['id'], archived=part['id'] in selected_ids, argument_keys=list(part['arguments']), command_preview=part['arguments'].get('command', part['arguments'].get('path', part['arguments'].get('filePath', '')))[:180]))
        if not keep: continue
        archive('owned/' + task + '/events/%03d-%s.json' % (n, event.get('id', 'header')), line, kind='exact original JSONL event bytes (including original LF)', **provenance)
        for k, part in callparts:
            if part['id'] not in selected_ids: continue
            args = part['arguments']
            for field in ['command', 'content']:
                if field in args:
                    archive('owned/' + task + '/decoded/%03d-call-%d-%s.txt' % (n, k, field), args[field].encode(), kind='original recorded argument decoded from JSON string, never executed', json_pointer='/message/content/%d/arguments/%s' % (k, field), call_id=part['id'], **provenance)
        if resultid in selected_ids:
            for k, part in enumerate(parts):
                if isinstance(part, dict) and part.get('type') == 'text':
                    archive('owned/' + task + '/decoded/%03d-result-%d.txt' % (n, k), part['text'].encode(), kind='exact recorded tool-result text; may contain tails/head/grep excerpts, not necessarily complete command stdout', json_pointer='/message/content/%d/text' % k, call_id=resultid, **provenance)
    assert path.read_bytes() == data

# Decode original file-creation literals from recorded Python arguments; no eval/exec.
for n in [47, 84]:
    path, events, calls = owned['72']
    _, offset, raw, event = events[n - 1]
    call = next(p for p in event['message']['content'] if p.get('type') == 'toolCall')
    command = call['arguments']['command']
    body = command.split("<<'PY'\n", 1)[1].split('\nPY', 1)[0]
    tree = ast.parse(body)
    for node in tree.body:
        if not isinstance(node, ast.Assign) or len(node.targets) != 1: continue
        target = node.targets[0]
        original = None
        if n == 47 and isinstance(target, ast.Name) and target.id == 'content':
            original = 'test/spatialRecoveryRights.test.ts'
        if n == 84 and isinstance(target, ast.Subscript) and isinstance(target.value, ast.Name) and target.value.id == 'files':
            original = ast.literal_eval(target.slice)
        if original is None: continue
        content = ast.literal_eval(node.value)
        # Recorded producer builds Add File via splitlines(), each line gets LF.
        output = ('\n'.join(content.splitlines()) + '\n').encode()
        archive('recovered-created/r2-line%d/' % n + Path(original).name, output,
                kind='original Add File bytes decoded from recorded literal and recorded splitlines/LF patch builder; not new authored reconstruction',
                original_path=str(P / original), source=str(path), source_line=n, source_offset=offset, source_length=len(raw), event_id=event['id'], source_event_sha256=sha(raw), python_literal_line=node.lineno,
                derivation='JSON decode command; AST literal_eval only; recorded splitlines + LF Add File semantics; never execute recorded code')

# Preserve exact patch strings from literal assignments and shell single argument.
for suffix in ['64', '67', '72', '82']:
    path, events, calls = owned[suffix]
    for n, offset, raw, event in events:
        for k, call in enumerate(event.get('message', {}).get('content', [])):
            if not isinstance(call, dict) or call.get('type') != 'toolCall': continue
            command = call.get('arguments', {}).get('command', '')
            if '--codex-run-as-apply-patch' not in command: continue
            patch = None
            if "<<'PY'\n" in command:
                body = command.split("<<'PY'\n", 1)[1].split('\nPY', 1)[0]
                for node in ast.parse(body).body:
                    if isinstance(node, ast.Assign) and any(isinstance(t, ast.Name) and t.id == 'patch' for t in node.targets) and isinstance(node.value, ast.Constant):
                        candidate = ast.literal_eval(node.value)
                        if candidate.endswith('*** End Patch'): patch = candidate
            else:
                marker = "--codex-run-as-apply-patch '"
                if marker in command:
                    patch = command.split(marker, 1)[1].rsplit("'", 1)[0]
            if patch is not None:
                archive('recorded-patches/st_01a079%s-line%d.patch' % (suffix, n), patch.encode(), kind='exact recorded native patch argument after literal decoding; not applied during recovery', source=str(path), source_line=n, source_offset=offset, source_length=len(raw), event_id=event['id'], source_event_sha256=sha(raw), call_id=call['id'])

# Original adoption stdout survives as a complete read result, not a guessed log.
path, events, _ = owned['64']
n, offset, raw, event = events[43]
text = event['message']['content'][0]['text']
archive('recovered-created/first/adopt.stdout', text.encode(), kind='complete original stdout recovered from recorded read result (no truncation marker)', original_path=str(P / '.omo/evidence/life-full-20260906/47-48/adopt.stdout'), source=str(path), source_line=n, source_offset=offset, source_length=len(raw), event_id=event['id'], source_event_sha256=sha(raw), json_pointer='/message/content/0/text')

# Only owned relevant byte ranges from the two explicitly referenced bash archives.
for suffix, source, mode in [('64', '/tmp/pi-bash-bebe323a0dfcd380.log', 'parent-listed-originals'), ('82', '/tmp/pi-bash-6a6360f675c36595.log', 'before-unrelated-worktree-list')]:
    path = Path(source)
    data = path.read_bytes()
    if mode == 'before-unrelated-worktree-list':
        end = data.index(b'\nworktree ')
        ranges = [(0, end)]
    else:
        ranges = []
        offset = 0
        for line in data.splitlines(keepends=True):
            if b'/placement-parent-astra/' in line: ranges.append((offset, offset + len(line)))
            offset += len(line)
    for k, (start, end) in enumerate(ranges):
        archive('original-tool-archive/st_01a079%s-range%d.txt' % (suffix, k), data[start:end], kind='exact byte-range excerpt of explicitly referenced original bash output; unrelated listing not archived', source=source, source_offset=start, source_length=end-start, whole_source_sha256=sha(data), whole_source_bytes=len(data))
    assert path.read_bytes() == data

(D / 'PROVENANCE.json').write_text(json.dumps(dict(format_version=1, note='All .gz artifacts losslessly decode to the sha256/bytes specified. Session offsets are zero-based byte offsets; lines are one-based. Decoded JSON arguments/results identify their enclosing original event and JSON pointer. No source commands were executed.', sessions=sessions, artifacts=manifest), indent=2) + '\n')
(D / 'SESSION-INDEX.json').write_text(json.dumps(index, indent=2) + '\n')
print(json.dumps(dict(archived_artifacts=len(manifest), original_decoded_bytes=sum(r['bytes'] for r in manifest), compressed_bytes=sum((D/r['artifact']).stat().st_size for r in manifest), sessions=sessions), indent=2))
