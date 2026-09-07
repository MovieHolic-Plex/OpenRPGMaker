#!/usr/bin/env python3
"""Portable public-subset integrity/safety verifier, NOT full forensic or product QA.

Reads only PUBLIC-MANIFEST.json and its explicit public files. Never opens live
sessions, private-retained originals, Git metadata, or product source paths.
The manifest's own SHA-256 is reported for external comparison, not self-trust.
"""
import gzip
import hashlib
import json
import re
from pathlib import Path, PurePosixPath

REASONING_TYPES = {'thinking', 'reasoning', 'redacted_thinking'}
PRIVATE_KEYS = {'thinkingSignature', 'encrypted_content', 'reasoning_content', 'thinking'}
CREDENTIAL_PATTERNS = {
    'private-key': r'-----BEGIN (?:[A-Z0-9 ]+ )?PRIVATE KEY-----',
    'provider-key': r'\b(?:sk|rk|pk)-(?:live-)?[A-Za-z0-9_-]{20,}\b',
    'github-token': r'\bgh[pousr]_[A-Za-z0-9]{20,}\b',
    'slack-token': r'\bxox[baprs]-[0-9A-Za-z-]{20,}\b',
    'google-key': r'\bAIza[0-9A-Za-z_-]{30,}\b',
    'jwt': r'\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b',
    'credential-url': r'\b(?:postgres(?:ql)?|mysql|mongodb(?:\+srv)?):\/\/[^/\s:@]+:[^@\s/]+@',
    'credential-assignment': r'''(?i)\b(?:api[_-]?key|client[_-]?secret|access[_-]?token|password|secret[_-]?key|service[_-]?role[_-]?key)\s*[:=]\s*["'][A-Za-z0-9_./+=-]{16,}["']''',
    'authorization': r'(?i)\bauthorization["\s]*[:=]\s*["\s]*(?:bearer|basic)\s+[A-Za-z0-9_./+=-]{16,}',
}


def sha(data):
    return hashlib.sha256(data).hexdigest()


def payload(raw, name):
    return gzip.decompress(raw) if name.endswith('.gz') else raw


def inspect_payload(data, name):
    """Return category/pointer only. Never log payloads or matched secret text."""
    text = data.decode('utf-8')
    try:
        root = json.loads(text)
    except ValueError:
        root = None
        if name.endswith(('.jsonl', '.jsonl.gz')):
            root = [json.loads(line) for line in text.splitlines() if line.strip()]
    findings = []

    def visit(value, pointer='$', depth=0):
        if depth > 100:
            raise ValueError('Structured nesting exceeds inspection bound: ' + name)
        if isinstance(value, dict):
            if value.get('type') in REASONING_TYPES:
                findings.append({'category': 'private-reasoning-type', 'pointer': pointer + '.type'})
            for key, child in value.items():
                if key in PRIVATE_KEYS and child:
                    findings.append({'category': 'private-reasoning-field', 'pointer': pointer + '.' + key})
                visit(child, pointer + '.' + key, depth + 1)
        elif isinstance(value, list):
            for index, child in enumerate(value):
                visit(child, pointer + '[%d]' % index, depth + 1)
        elif isinstance(value, str) and value.lstrip()[:1] in ('{', '['):
            try:
                nested = json.loads(value)
            except ValueError:
                return
            visit(nested, pointer + '<decoded-json>', depth + 1)
    visit(root)
    # Recognize structured blocks, not ordinary prose words or code comments.
    if re.search(r'<(thinking|reasoning|analysis)>[\s\S]*?</\1>', text):
        findings.append({'category': 'embedded-private-block', 'pointer': '$text'})
    for category, pattern in CREDENTIAL_PATTERNS.items():
        if re.search(pattern, text):
            findings.append({'category': 'credential-candidate:' + category, 'pointer': '$text'})
    block_count = 0
    if isinstance(root, dict) and isinstance(root.get('message'), dict):
        content = root['message'].get('content', [])
        if isinstance(content, list):
            block_count = sum(isinstance(part, dict) and part.get('type') in REASONING_TYPES for part in content)
    return findings, block_count


def safe_path(root, relative):
    path = PurePosixPath(relative)
    if path.is_absolute() or '..' in path.parts or str(path) != relative:
        raise ValueError('Noncanonical public relative path')
    full = root.joinpath(*path.parts)
    cursor = full
    while cursor != root:
        if cursor.is_symlink():
            raise ValueError('Public subset cannot contain symlinks: ' + relative)
        cursor = cursor.parent
    return full


def main():
    root = Path(__file__).resolve().parent
    manifest_path = root / 'PUBLIC-MANIFEST.json'
    manifest_bytes = manifest_path.read_bytes()
    findings, _ = inspect_payload(manifest_bytes, manifest_path.name)
    if findings:
        raise ValueError('Public manifest failed safety inspection; payload not printed')
    manifest = json.loads(manifest_bytes)
    if manifest['format_version'] != 1:
        raise ValueError('Unsupported public manifest format')
    entries = manifest['public_files']
    names = [row['path'] for row in entries]
    if len(names) != len(set(names)) or names != sorted(names):
        raise ValueError('Public list must be unique and sorted')
    private_names = {row['path'] for row in manifest['private_retained']}
    if private_names.intersection(names):
        raise ValueError('Private original appeared in public subset')
    for row in entries:
        raw = safe_path(root, row['path']).read_bytes()
        if len(raw) != row['bytes'] or sha(raw) != row['sha256']:
            raise ValueError('Public byte/hash mismatch: ' + row['path'])
        decoded = payload(raw, row['path'])
        if len(decoded) != row['decoded_bytes'] or sha(decoded) != row['decoded_sha256']:
            raise ValueError('Public decoded byte/hash mismatch: ' + row['path'])
        findings, _ = inspect_payload(decoded, row['path'])
        if findings:
            raise ValueError('Public payload failed safety inspection: ' + row['path'])
    expected = sorted(manifest['repository_relative_root'] + '/' + name for name in names + ['PUBLIC-MANIFEST.json'])
    stage = (root / 'PUBLIC-stage-list.txt').read_text().splitlines()
    if stage != expected:
        raise ValueError('Public stage list differs from exact manifest subset')
    print(json.dumps({
        'verification': 'portable public-subset hash/decoding/safety check only; not full forensic or product QA',
        'public_files_verified': len(entries),
        'stage_paths_verified': len(stage),
        'private_originals_excluded': len(private_names),
        'private_or_live_sources_opened': False,
        'payload_reasoning_findings': 0,
        'recognized_credential_candidates': 0,
        'manifest_sha256': sha(manifest_bytes),
        'stage_list_sha256': sha((root / 'PUBLIC-stage-list.txt').read_bytes()),
        'limits': [
            'Trust the manifest hash via an independent receipt; a manifest cannot authenticate itself.',
            'Credential recognition is bounded pattern/structure inspection, not proof against arbitrary encoded secrets.',
            'Full forensic provenance requires the privately retained original records and authorized live source records.',
            'Original partial-evidence gaps and no-product-approval verdict remain unchanged.'
        ]
    }, indent=2))


if __name__ == '__main__':
    main()
