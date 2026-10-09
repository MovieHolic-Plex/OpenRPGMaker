"""Deterministic recovery of a fully approved collect-existing prop execution.

Preserves native verdicts and drawing history. No artwork, verdict or choice is
authored here; only the current completed rows and their existing pixels move on.
"""
import json
from pathlib import Path
import re
import sqlite3

from PIL import Image

import art_choices
import art_execution
import art_layout


def collect_existing(root, request, snapshot, coverage):
    root = Path(root).resolve()
    if request.get('harness') != 'interior-props' or request.get('resumeMode') != 'collect-existing':
        raise ValueError('Only approved collect-existing prop executions are supported')
    art_layout.require_completed(root, request, snapshot)
    errors = art_execution.native_errors(root, request)
    if errors: raise ValueError('; '.join(errors))
    content = art_execution.prop_content_root(root, request)
    if content is None: raise ValueError('Approved content root required')
    database = root / request['data'] / 'harness.sqlite'
    with sqlite3.connect(database.as_uri()+'?mode=ro', uri=True) as db:
        db.row_factory = sqlite3.Row
        rows = [dict(r) for r in db.execute('SELECT runs.*, rounds.item, rounds.root, rounds.base '
            'FROM runs JOIN rounds ON runs.round=rounds.id ORDER BY rounds.id,runs.id')]
    # A repair of the same native item replaces its earlier candidate, keeping
    # that row as history. Different items remain separate required materials.
    latest = {(row['item'], row['letter']): row for row in rows}
    bound = {(ref['path'], ref['sha256']) for ref in snapshot['layout']['sources']}
    refs, current, unbound = [], [], []
    for row in latest.values():
        slug = re.sub(r'[^A-Za-z0-9]+', '_', row['item']).strip('_')
        name = f"h{row['round']}-{row['letter']}"
        png = content / 'tiledata/hand-interior/pick/candidates' / slug / (name+'.png')
        png = art_choices.safe(root, str(png))
        ref = art_choices.ref(root, png)
        # For collect-existing every PNG already exists before approval. Refuse
        # to infer provenance from a filename or import unrelated prior work.
        if (ref['path'], ref['sha256']) not in bound:
            unbound.append(dict(item=row['item'], candidate=name, image=ref))
            continue  # It may already have a separate fresh drawing receipt.
        with Image.open(png) as image: image.verify()
        review = json.loads(row['review']) if isinstance(row['review'], str) else row['review']
        if row['status'] != 'done' or review.get('verdict') not in ('PASS', 'FAIL', 'HARD'):
            raise ValueError('Native inspection is incomplete: '+name)
        refs.append(ref); current.append(row)
    available = {ref['sha256']: ref for ref in refs}
    mapped = {}
    for requirement, originals in coverage.items():
        mapped_refs = []
        for original in originals:
            art_choices.verified(root, original)
            if original['sha256'] in available:
                ref = available[original['sha256']]
                if ref not in mapped_refs: mapped_refs.append(ref)
        if mapped_refs: mapped[requirement] = mapped_refs
    if not mapped: raise ValueError('No verified requirement maps to current native pixels')
    receipt = dict(version=1, harness='interior-props', collectionMode='collect-existing',
        layoutFingerprint=snapshot['fingerprint'], database=art_choices.ref(root, database),
        runs=current, supersededRuns=[r for r in rows if r not in latest.values()], candidateImages=refs,
        excludedUnboundCandidates=unbound,
        note='Existing native inspection delivery. Original timestamps, attempts and verdicts preserved. No new drawing or approval.')
    key = art_choices.fingerprint(receipt)
    destination = root / request['data'] / 'collections' / key / 'receipt.json'
    destination.parent.mkdir(parents=True, exist_ok=True)
    destination.write_text(json.dumps(receipt, ensure_ascii=False, indent=2))
    return dict(candidates=[dict(harness='interior-props', items=sorted(mapped),
        receipt=art_choices.ref(root, destination), images=refs,
        selection='Completed native rows recovered; whole-space demo and independent review still required')],
        themeCoverage=mapped, remaining=['Whole-space assembly and independent review', 'Selection and canonical installation'])
