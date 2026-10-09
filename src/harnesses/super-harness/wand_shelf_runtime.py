"""Bind independently reviewed native shelf vacancies to real actor events.

Only crop/copy reviewed sheets. A lifted box and its original stock never appear
at the same time; returning restores the exact original sheet and actor state.
"""
from copy import deepcopy
from pathlib import Path
import json
from PIL import Image

from native_runtime_prepare import choice, condition, graphic, page, require, sha, switch, wire


def bind_manifest(manifest, receipt_path):
    """Freeze the explicit native handoff without promoting the room's verdict."""
    result = deepcopy(manifest)
    receipt_path = Path(receipt_path).resolve()
    receipt = json.loads(receipt_path.read_text())
    require(receipt['contextVerdict']['verdict'] == 'PASS', 'Shelf contact/lift context is not approved')
    require(receipt['nativeVerdict']['verdict'] == 'PASS', 'Native vacancy is not approved')
    candidate = Path(receipt['candidate']).resolve()
    require(sha(candidate.read_bytes()) == receipt['candidateSha256'], 'Vacancy pixels changed')
    require(receipt['contextVerdict']['candidateSha256'] == receipt['candidateSha256'], 'Context verdict is stale')
    scope = receipt_path.parent
    evidence_path, source_path = scope / 'context-evidence.json', scope / 'input-manifest.json'
    require(sha(evidence_path.read_bytes()) == receipt['contextEvidenceSha256'], 'Context evidence changed')
    verdict_path = Path(receipt['contextVerdictFile']).resolve()
    require(sha(verdict_path.read_bytes()) == receipt['contextVerdictSha256'], 'Context verdict changed')
    require(json.loads(verdict_path.read_text()) == receipt['contextVerdict'], 'Receipt verdict differs from independent verdict')
    rows = receipt['contextVerdict']['perActorSide']
    require({(q['actor'], q['side']) for q in rows} == {
        (actor, side) for actor in ('elder-wandmaker', 'trial-student') for side in ('west', 'east')}
        and len(rows) == 4 and all(q['verdict'] == 'PASS' for q in rows), 'Every actor and side needs independent PASS')
    evidence = json.loads(evidence_path.read_text())
    source = json.loads(source_path.read_text())
    require(sha(source_path.read_bytes()) == receipt['sourceManifestSha256'], 'Vacancy source manifest changed')
    require(evidence['candidateSha256'] == receipt['candidateSha256'] and evidence['changesOutsideMask'] == 0,
            'Vacancy changes do not match the contact evidence')
    original = str((Path(source['artworkRoot']) / source['shelf']).resolve())
    require(original in manifest['files'], 'Vacancy original is absent from this scene')
    require(source['sources'][source['shelf']]['sha256'] == manifest['files'][original]['sha256'], 'Vacancy source sheet differs')
    before, after = Image.open(original).convert('RGBA'), Image.open(candidate).convert('RGBA')
    require(before.size == after.size, 'Vacancy sheet dimensions changed')
    changed = []
    for y in range(before.height):
        for x in range(before.width):
            if before.getpixel((x, y)) != after.getpixel((x, y)):
                require(34 <= y < 39 and (2 <= x < 14 or 18 <= x < 30), 'Pixels outside the reviewed box sockets changed')
                changed.append((x, y))
    require(bool(changed) and len(changed) == evidence['changedPixels'], 'Vacancy pixel audit differs')
    require(str((Path(source['artworkRoot']) / source['actors']).resolve()) == manifest['actors'],
            'Vacancy actors differ from this scene')
    for path in [receipt_path, candidate, source_path, evidence_path, verdict_path]:
        data = path.read_bytes()
        result['files'][str(path)] = {'sha256': sha(data), 'bytes': len(data)}
    require(len(evidence['proofs']) == 16, 'Four contact frames per actor/side required')
    for proof in evidence['proofs']:
        path = Path(proof['file']).resolve()
        data = path.read_bytes()
        require(sha(data) == proof['sha256'], 'Shelf context image changed')
        result['files'][str(path)] = {'sha256': sha(data), 'bytes': len(data)}
    result['vacancy'] = {'receipt': str(receipt_path), 'candidate': str(candidate), 'original': original,
                         'evidence': str(evidence_path)}
    result.pop('inputFingerprint')
    result['inputFingerprint'] = sha(wire(result))
    return result


def attach(pack, frozen, actors, actor_proofs, operations, map_id):
    data = frozen.manifest.get('vacancy')
    if not data:
        return None
    proof = frozen.read(data['evidence'])
    events = {e['id']: e for e in pack.events}
    affected = {'west': [], 'east': []}
    for operation in operations:
        if operation['source'] != data['original'] or 0 not in operation['presentStates']:
            continue
        if operation['screenTL'][0] not in (16, 144):
            continue
        rect = operation['rect']
        original = frozen.crop(data['original'], rect)
        vacant = frozen.crop(data['candidate'], rect)
        if original[0].tobytes() == vacant[0].tobytes():
            continue
        side = 'west' if operation['screenTL'][0] == 16 else 'east'
        evt = events[operation['eventId']]
        flag = 'wand_shelf_empty_' + side
        pack.add_switch(flag)
        sprite = pack.sheet(side + '-vacant-shelf', [vacant], operation['cell'], operation['worldTL'])
        evt['pages'].append(page(evt['id'] + '_vacant', graphic(sprite), conditions=[condition(flag)], priority='same'))
        affected[side].append(evt['id'])
    require(all(affected.values()), 'Scene has no bound box sockets on both sides')
    bindings = []
    for side in ('west', 'east'):
        options = []
        for actor in actors['actors']:
            role = 'elder' if actor['id'] == 'elder-wandmaker' else 'student'
            event_id = 'wand_' + role
            evidence = {q['state']: q for q in proof['proofs'] if q['actor'] == actor['id'] and q['side'] == side}
            require(set(evidence) == {'before', 'contact', 'lift-1', 'lift-2'}, 'Incomplete actor contact sequence')
            contact = evidence['contact']
            cell = [2 if side == 'west' else 8, 5]
            at = contact['worldTL']
            action_path = frozen.source(actors['assets'][actor['action']]['file'])
            indices = [12, 13, 14] if side == 'west' else [15, 16, 17]
            frames = []
            for index, state in zip(indices, ('contact', 'lift-1', 'lift-2')):
                frame = actor['actions'][index]
                require(frame['rect'] == evidence[state]['actorRectXYWH'], 'Actor pose differs from reviewed contact')
                crop = frozen.crop(action_path, frame['rect'])
                require(sha(crop[0].tobytes()) == evidence[state]['actorCropRgbaSha256'], 'Reviewed actor pixels changed')
                frames.append(crop)
            sprite = pack.sheet(role + '-' + side + '-shelf-contact', frames, cell, at, [24, 31])
            active = 'wand_shelf_' + role + '_' + side
            pack.add_switch(active)
            events[event_id]['pages'].append(page(active, graphic(sprite), conditions=[condition(active)], priority='same', solid=True))
            def move(xy):
                return {'kind': 'moveEvent', 'eventId': event_id, 'route': {'moves': [
                    {'kind': 'npcTransfer', 'mapId': map_id, 'x': xy[0], 'y': xy[1]}], 'repeat': False, 'wait': True}}
            def pattern(n):
                return {'kind': 'setEventGraphicPattern', 'eventId': event_id, 'pattern': n}
            empty = 'wand_shelf_empty_' + side
            commands = [switch('wand_scene_' + str(i), False) for i in range(1, 4)]
            commands += [switch('wand_state_applied_' + str(i), False) for i in range(4)]
            commands += [{'kind': 'wait', 'ms': 100}, switch('wand_actor_busy', True), move(cell), switch(active, True), pattern(0), {'kind': 'wait', 'ms': 200},
                        switch(empty, True), pattern(1), {'kind': 'wait', 'ms': 200}, pattern(2), {'kind': 'wait', 'ms': 800},
                        pattern(1), {'kind': 'wait', 'ms': 200}, pattern(0), switch(empty, False), {'kind': 'wait', 'ms': 200}]
            states = next(a['nativeStatePlacements'] for a in actor_proofs if a['eventId'] == event_id)
            restore = [move(states[0]['cell'])]
            for state in range(1, 4):
                restore = [{'kind': 'fork', 'condition': condition('wand_scene_' + str(state)),
                            'then': [move(states[state]['cell'])], 'else': restore}]
            commands += restore + [switch(active, False), switch('wand_actor_busy', False)]
            options.append(('주인에게 꺼내 달라고 하기' if role == 'elder' else '학생이 꺼내 보기', commands))
            bindings.append({'actor': actor['id'], 'side': side, 'eventId': event_id, 'cell': cell,
                             'screenSole': contact['soleScreen'], 'frames': indices, 'source': action_path,
                             'vacancyEvents': affected[side], 'restoresOriginal': True})
        shelf = events['wand_shelf_' + side]
        shelf['y'] = 6  # User stands one cell south of the actor's contact position.
        shelf['pages'][0]['commands'] = [choice(options, '상자를 꺼내 보고 제자리에 돌려놓습니다')]
        # Facing the visible shelf must open the same action as the floor prompt.
        for op in operations:
            if op['source'] == data['original'] and op['cell'] == [1 if side == 'west' else 9, 6]:
                for pg in events[op['eventId']]['pages']:
                    pg['commands'] = deepcopy(shelf['pages'][0]['commands'])
    return {'status': 'bound-awaiting-runtime-review', 'receipt': data['receipt'], 'bindings': bindings,
            'runtimePassed': False, 'publicRegistered': False, 'canonicalReload': False}
