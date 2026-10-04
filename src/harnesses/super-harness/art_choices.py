"""Human chip choices: receipt-bound previews, durable SQLite selections, no installation."""
import hashlib
import json
from pathlib import Path

import store
import art_layout
import art_acceptance


def digest(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def read(path):
    return json.loads(Path(path).read_text())


def safe(root, rel):
    root = Path(root).resolve()
    path = (root / rel).resolve()
    if not path.is_relative_to(root) or not path.is_file():
        raise ValueError('후보 파일을 찾을 수 없습니다. 다시 준비해 주세요.')
    return path


def ref(root, path, label=''):
    path = Path(path).resolve()
    return {'path': str(path.relative_to(Path(root).resolve())), 'sha256': digest(path), 'label': label}


def verified(root, r):
    path = safe(root, r['path'])
    if digest(path) != r['sha256']:
        raise ValueError('그림 또는 검수 결과가 바뀌었습니다. 새 후보를 확인해 주세요.')
    return path


def fingerprint(candidate):
    return hashlib.sha256(json.dumps(candidate, sort_keys=True, ensure_ascii=False).encode()).hexdigest()


def prepare(data, cid):
    """Run after genuine native receipts exist. Only composes existing pixels; no model calls."""
    from art_preview import parking_scene, stair_context
    base = Path(data)
    root = base / 'art-worktrees' / cid
    concept = base / 'concepts' / cid
    result = read(concept / 'art-result.json')
    out = root / 'art-output' / 'choice-previews' / digest(concept / 'art-result.json')[:16]
    out.mkdir(parents=True, exist_ok=True)
    groups = []
    for batch in result.get('candidates', []):
        receipt_ref = batch['receipt']
        receipt_path = verified(root, receipt_ref)
        receipt = read(receipt_path)
        if receipt.get('harness') == 'modern-chipset' and receipt.get('contractSha256'):
            contract_path = safe(root, 'harness-data/modern-chipset-parking/parking-contract.json')
            if digest(contract_path) != receipt['contractSha256']:
                raise ValueError('주차장 부품 명세가 검수 이후 바뀌었습니다.')
            contract = read(contract_path)
            group = {'id': 'parking-kit', 'requiresContextReview': True, 'title': '주차장 칩 세트', 'description': '13품목을 함께 고릅니다. 모든 후보를 같은 작은 배치에 놓아 비교합니다.', 'candidates': []}
            for row in receipt['candidates']:
                letter = row['candidate']
                png = safe(root, str((receipt_path.parent / (letter + '.png')).relative_to(root)))
                if digest(png) != row['imageSha256']:
                    raise ValueError('검수한 주차장 그림과 현재 그림이 다릅니다.')
                previews = row.get('contextImages', [])
                for preview in previews: verified(root, preview)
                for opened in (() if previews else (False, True)):
                    dest = out / f'parking-{letter}-{int(opened)}.png'
                    parking_scene(png, contract, dest, opened)
                    previews.append(ref(root, dest, '문·차단기 열림' if opened else '문·차단기 닫힘'))
                review = row['independent']
                failures = [i.get('reasons', '') for i in review.get('items', []) if i.get('verdict') != 'PASS']
                groups_pass = {i.get('id', i.get('item')) for i in review.get('items', []) if i.get('verdict') == 'PASS'}
                required = {c['item'] for c in contract['components']}
                passed = (row['machine'].get('ok') is True and row['machine'].get('imageSha256') == digest(png)
                          and review.get('verdict') == 'PASS' and review.get('png_sha256') == digest(png) and required <= groups_pass)
                group['candidates'].append({'id': letter, 'title': f'후보 {letter}', 'passed': passed,
                    'summary': f'{len(required)}품목 그림 검수 통과' if passed else '수정 필요 · 선택할 수 없음',
                    'reasons': failures or row.get('issues', []),
                    'repairFixes': [{'category': 'asset', 'target': ', '.join(i.get('id', i.get('item', '')) for i in review.get('items', []) if i.get('verdict') != 'PASS'), 'problem': ' / '.join(failures), 'change': review['fix'], 'keep': '통과한 다른 품목과 원본 검수 기록'}] if review.get('fix') and not passed else [],
                    'sources': [receipt_ref, ref(root, contract_path), ref(root, png)] + row.get('contextSources', []),
                    'images': previews, 'sheet': ref(root, png, '전체 칩 시트'),
                    'caution': '실제 칩으로 조립한 비교용 예시입니다. 완성 맵·통행 검사 결과는 아닙니다.'})
            group['description'] = '같은 배치의 실제 조립 예시로 크기·접합·동선을 비교합니다.'
            groups.append(group)
        elif receipt.get('harness') == 'interior-props' and receipt.get('runs'):
            by_round = {(r['round'], r['letter']): r for r in receipt['runs']}
            specs = [('stairs', '남쪽 돌계단', [1]), ('iron-door', '철문 · 닫힘 + 열림', [2, 3]), ('wood-door', '나무문 · 닫힘 + 열림', [4, 5])]
            for gid, title, rounds in specs:
                group = {'id': gid, 'title': title, 'description': '열림·닫힘 그림을 같은 후보 묶음으로 고릅니다.' if len(rounds) > 1 else '방 안에서 크기와 계단 방향을 비교하세요.', 'candidates': []}
                for letter in ('A', 'B'):
                    sources, images, reasons, native_fixes = [receipt_ref], [], [], []
                    passed = True
                    for rid in rounds:
                        row = by_round[(rid, letter)]
                        png = safe(root, f'tiledata/hand-interior/pick/candidates/{row["item"].replace(" ", "_")}/h{rid}-{letter}.png')
                        original_ref = next(r for r in receipt['candidateImages'] if r['path'] == str(png.relative_to(root)))
                        verified(root, original_ref)
                        sources.append(original_ref)
                        review = json.loads(row['review'] or '{}')
                        ok = bool(row['ok']) and review.get('verdict') == 'PASS'
                        passed = passed and ok
                        if not ok:
                            reasons.append(review.get('reasons') or '그림 검수 미통과')
                            if review.get('fix'): native_fixes.append({'category': 'asset', 'target': row['item'], 'problem': reasons[-1], 'change': review['fix'], 'keep': '상대 상태 그림과 통과한 품목'})
                        if rid == 1:
                            context = safe(root, str((receipt_path.parent / 'data/rounds/h1/context.png').relative_to(root)))
                            dest = out / f'stairs-{letter}.png'
                            stair_context(context, png, dest)
                            sources.append(ref(root, context))
                            images.append(ref(root, dest, '방 안 크기 비교'))
                        else:
                            context = safe(root, str(Path(review['pack']) / 'ctx-cand.png'))
                            images.append(ref(root, context, '닫힘' if rid in (2, 4) else '열림'))
                    group['candidates'].append({'id': letter, 'title': f'후보 {letter}', 'passed': passed,
                        'summary': '개별 그림 검수 통과' if passed else '수정 필요 · 선택할 수 없음', 'reasons': reasons, 'repairFixes': native_fixes,
                        'sources': sources, 'images': images, 'sheet': sources[1],
                        'caution': '기존 검수 방에 놓은 크기·화풍 예시입니다. 계단 높이·통행 및 문 상태 연결은 별도 검증이 필요합니다.'})
                groups.append(group)
    generation = digest(concept / 'art-result.json')
    layout_file = concept / 'art-layout-input.json'
    phase = read(layout_file).get('layout', {}).get('phase', 'scene') if layout_file.is_file() else 'scene'
    for group in groups:
        for candidate in group['candidates']:
            candidate.update(generation=generation, phase=phase)
    manifest = {'version': 1, 'artResultSha256': generation, 'groups': groups}
    path = concept / 'art-choices.json'
    temporary = path.with_suffix('.tmp')
    temporary.write_text(json.dumps(manifest, ensure_ascii=False, indent=2))
    temporary.replace(path)
    return manifest


def selections(cid):
    with store._lock, store.connect() as con:
        return {r['group_id']: dict(r) for r in con.execute('SELECT * FROM art_selections WHERE concept=?', (cid,))}


def view(data, cid):
    c = store.concept(cid)
    if not c:
        raise ValueError('개념을 찾을 수 없습니다.')
    root = Path(data) / 'art-worktrees' / cid
    manifest = Path(data) / 'concepts' / cid / 'art-choices.json'
    document = read(manifest) if manifest.is_file() else {}
    groups = document.get('groups', [])
    result_file = Path(data) / 'concepts' / cid / 'art-result.json'
    current = result_file.is_file() and digest(result_file) == document.get('artResultSha256')
    # The manifest owns immutable image/receipt hashes. Preparation responses
    # can replace art-result.previous.json several times before a new drawing.
    previous_visible = (not current and c['stage'] in ('art', 'art-layout-review', 'art-context-review')
                        and bool(document.get('artResultSha256')))
    context_path = Path(data) / 'concepts' / cid / 'art-context-review.json'
    context_reviews = read(context_path).get('groups', {}) if context_path.is_file() else {}
    saved = selections(cid)
    feedback_file = Path(data) / 'concepts' / cid / 'art-feedback.json'
    feedback = read(feedback_file) if feedback_file.is_file() else {}
    count = 0
    output = []
    for group in groups:
        g = {k: group[k] for k in ('id', 'title', 'description')}
        g['candidates'] = []
        for candidate in group['candidates']:
            calibration = candidate.get('phase') == 'calibration'
            item = {k: candidate[k] for k in ('id', 'title', 'summary', 'reasons', 'caution')}
            candidate_token = fingerprint(candidate)
            context = context_reviews.get(group['id'], {}).get(candidate['id'], {})
            needs_context = group.get('requiresContextReview', False)
            context_ok = not needs_context
            if needs_context:
                matches = context.get('fingerprint') == candidate_token
                checks = context.get('checks', {})
                context_ok = (matches and context.get('gateVersion') == art_layout.VERSION and context.get('verdict') == 'PASS' and
                    all(isinstance(checks.get(k), dict) and checks[k].get('verdict') == 'PASS'
                        and len(str(checks[k].get('evidence', '')).strip()) >= 12
                        for k in art_layout.SCENE_CHECKS))
                if context_ok:
                    try:
                        art_acceptance.validate(context, art_acceptance.contract(Path(data) / 'concepts' / cid), art_layout.SCENE_CHECKS)
                    except (ValueError, KeyError, TypeError):
                        context_ok = False
                if not context_ok:
                    explanation = context.get('reasons', []) if matches else []
                    item['reasons'] = list(item['reasons']) + (explanation or ['조립한 공간의 정체성·축척·접합·동선·화풍 검수가 필요합니다.'])
                    item['summary'] = '부품 검수 통과 · 조립 예시 수정 필요' if candidate['passed'] else item['summary']
            token = fingerprint({'candidate': candidate, 'contextReview': context}) if needs_context else candidate_token
            valid = current or previous_visible
            try:
                for r in candidate['sources'] + candidate['images'] + [candidate['sheet']]: verified(root, r)
            except (ValueError, OSError, KeyError): valid = False
            item['ready'] = current and valid and candidate['passed'] and context_ok
            item.update(fingerprint=token, eligible=current and not calibration and valid and candidate['passed'] and context_ok and c['stage'] == 'art-review', stale=not valid)
            item['selected'] = current and not calibration and valid and candidate['passed'] and context_ok and saved.get(group['id'], {}).get('fingerprint') == token
            if previous_visible:
                item['summary'] = '이전 후보 · 새 표본 제작 중 (선택 불가)'
            if calibration:
                item['caution'] = '시점 확인용 표본입니다. 표본 합격 뒤 공간을 재조립하여 검수해야 선택할 수 있습니다.'
            if item['selected']: count += 1
            def image(r):
                return {'path': str((root / r['path']).relative_to(data)), 'v': r['sha256'], 'label': r.get('label', '')}
            item['images'] = [image(r) for r in candidate['images']] if valid else []
            item['sheet'] = image(candidate['sheet']) if valid else None
            g['candidates'].append(item)
        g['staleSelection'] = group['id'] in saved and not any(i['selected'] for i in g['candidates'])
        output.append(g)
    return {'id': cid, 'title': c['title'], 'stage': c['stage'], 'paused': store.setting('paused') == '1',
            'maxRevisions': feedback.get('limits', {}).get('maxRevisions', int(store.setting('max_art_revisions'))),
            'repairPolicy': feedback.get('policy', {}),
            'revision': c.get('art_revision', 0), 'status': c['status'], 'note': c.get('note', ''),
            'blocked': any(not any(i['ready'] or i['selected'] for i in g['candidates']) for g in output),
            'groups': output, 'selectedCount': count, 'total': len(groups), 'complete': bool(groups) and count == len(groups)}


def choose(data, cid, body, *, delegated=False):
    with store._lock:
        actor = '사람'
        authority = None
        if delegated:
            authorization = Path(data) / 'concepts' / cid / 'supervisor-authorization.json'
            authority = read(authorization)
            if authority.get('scope') != cid or authority.get('autonomousCandidateApproval') is not True:
                raise ValueError('이 개념에 대한 사용자 위임 승인 근거가 필요합니다.')
            actor = '사용자 위임 감독'
        state = view(data, cid)
        if state['stage'] != 'art-review': raise ValueError('현재는 칩 선택 단계가 아닙니다.')
        group = next((g for g in state['groups'] if g['id'] == body.get('group')), None)
        if body.get('action') == 'clear-art':
            if not group: raise ValueError('선택 항목을 찾을 수 없습니다.')
            with store.connect() as con:
                con.execute('DELETE FROM art_selections WHERE concept=? AND group_id=?', (cid, group['id']))
            store.log(cid, f'{actor} 선택 취소: {group["title"]}')
            store.update_concept(cid, note='칩 선택 필요')
            return view(data, cid)
        candidate = next((c for c in group['candidates'] if c['id'] == body.get('candidate')), None) if group else None
        if not candidate or not candidate['eligible']: raise ValueError('현재 검수를 통과한 후보만 선택할 수 있습니다.')
        if candidate['fingerprint'] != body.get('fingerprint'): raise ValueError('후보가 바뀌었습니다. 새로고침 후 다시 선택해 주세요.')
        # The native image/receipt references are durable input to public registration.
        raw = read(Path(data) / 'concepts' / cid / 'art-choices.json')
        chosen = next(c for g in raw['groups'] if g['id'] == group['id'] for c in g['candidates'] if c['id'] == candidate['id'])
        context_path = Path(data) / 'concepts' / cid / 'art-context-review.json'
        if context_path.is_file():
            chosen = dict(chosen, contextReview=read(context_path).get('groups', {}).get(group['id'], {}).get(candidate['id']))
        if authority is not None:
            chosen = dict(chosen, selectionActor={
                'kind': 'delegated-supervisor', 'authorization': authority,
                'authorizationSha256': digest(authorization),
            })
        with store.connect() as con:
            con.execute('INSERT OR REPLACE INTO art_selections VALUES(?,?,?,?,?,?)',
                        (cid, group['id'], candidate['id'], candidate['fingerprint'], json.dumps(chosen, ensure_ascii=False), store.now()))
        store.log(cid, f'{actor} 선택: {group["title"]} / {candidate["title"]} — 공용 등록 전')
        result = view(data, cid)
        store.update_concept(cid, note='칩 선택 완료 — 공용 등록·조립 연결 필요' if result['complete'] else f'칩 선택 {result["selectedCount"]}/{result["total"]}')
        return result


if __name__ == '__main__':
    import sys
    store.init()
    result = prepare(store.DATA, sys.argv[1])
    print(f'prepared {len(result["groups"])} choice groups')
