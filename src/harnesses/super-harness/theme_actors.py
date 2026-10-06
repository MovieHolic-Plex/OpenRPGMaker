"""Collect draft actor pixels through the native harness, never infer approval."""
import hashlib
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys


def sha(path): return hashlib.sha256(Path(path).read_bytes()).hexdigest()
def read(path): return json.loads(Path(path).read_text())


def inspect(order_file, actions_file, root):
    """Runs in a fresh process so the two harnesses' `harness` modules cannot mix."""
    sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'charset-actor'))
    import harness as H
    import chr as C
    from PIL import Image
    order, actions = read(order_file), read(actions_file)
    root = Path(root).resolve()
    data = Path(order['data']).resolve()
    if not data.is_relative_to(root): raise ValueError('격리 인물 저장 경로 필요')
    manifest_file = Path(order['manifest']).resolve()
    if not manifest_file.is_relative_to(data) or sha(manifest_file) != order['manifestSha256']:
        raise ValueError('인물 주문 원본 해시 변경')
    manifest = read(manifest_file)
    planned = {r['actor']:r for r in actions['orders']}
    actors=[]
    for row in manifest['characters']:
        w=(manifest_file.parent/(row['key']+'__gpt-r1')).resolve()
        if not w.is_relative_to(data): raise ValueError('인물 원본이 격리 경로 밖입니다.')
        gate=H.current_gate(w)
        if not gate['ok'] or not H.human_ready(w,gate): raise ValueError(row['key']+': 걷기 납품 미완료')
        action=planned[row['key']]
        folder=Path(action['out']).resolve()
        if not folder.is_relative_to(data): raise ValueError('행동 원본이 격리 경로 밖입니다.')
        proof=read(folder/'receipt.json')
        action_contract=read(action['request'])
        if (action_contract.get('theme') != manifest.get('theme')
                or set(c.upper() for c in action_contract['palette']) != set(c.upper() for c in manifest['productionContract']['palette'])):
            raise ValueError(row['key']+': 행동과 걷기의 전용 테마 계약 불일치')
        if (not proof.get('ok') or proof.get('scope')!='action-poses' or proof['producer']['exitCode']!=0
                or proof['sourceSha256']!=sha(w/'out.chr.txt')
                or proof['contractSha256']!=sha(action['request'])
                or proof['pixelSourceSha256']!=sha(folder/'actions.px.json')):
            raise ValueError(row['key']+': 행동 납품 해시/기술 검사 불일치')
        expected=[f"{p['id']}-{k}" for p in action_contract['poses'] for k in range(p['frames'])]
        if [f['id'] for f in proof['frames']]!=expected:
            raise ValueError(row['key']+': 주문한 행동 프레임 누락')
        for ref in proof['sources']:
            if sha(ref['path'])!=ref['sha256']: raise ValueError('행동 근거 파일 변경: '+ref['path'])
        palette,_,frames=C.load(w/'out.chr.txt')
        allowed={v.upper() for v in manifest['productionContract']['palette']}
        used={('#%02X%02X%02X'%p[:3]) for frame in frames.values()
              for p in C.frame_rgba(palette,frame).getdata() if p[3]}
        if not used<=allowed: raise ValueError(row['key']+': 테마 팔레트 밖 걷기 색상')
        native=[]
        paths=[manifest_file,w/'out.chr.txt',w/'published.json',w/'model-frames.json',
               w/'views/gate.json',w/'views/motion.json',w/'views/sheet_rgba.png',
               w/'views/sheet_x8.png',folder/'receipt.json']
        for ref in proof['sources']:
            p=Path(ref['path']).resolve()
            if not p.is_relative_to(root):
                # Preserve generation-time tool bytes as evidence, not game art.
                target=data/'tool-evidence'/ref['sha256']/p.name
                target.parent.mkdir(parents=True,exist_ok=True)
                if not target.exists(): shutil.copy2(p,target)
                p=target
            paths.append(p)
        for p in dict.fromkeys(paths): native.append(dict(path=str(p.relative_to(root)),sha256=sha(p)))
        sheets=[dict(path=str(p.relative_to(root)),sha256=sha(p))
                for p in [w/'views/sheet_rgba.png',folder/'views/sheet.png']]
        fw, fh = action_contract['canvas']
        for sheet, size in zip(sheets, [(72,128),(fw*len(proof['frames']),fh)]):
            with Image.open(root/sheet['path']) as image:
                if image.size != size: raise ValueError(row['key']+': native 프레임 시트 크기 불일치')
                image.verify()
        action_frames = [dict(frame, rect=[index * fw, 0, fw, fh], anchor=action_contract['origin'])
                         for index, frame in enumerate(proof['frames'])]
        actors.append(dict(id=row['key'],title=row['name'],machineReady=True,sources=native,
                           sheets=sheets,frame=[24,32],actionFrame=read(action['request'])['canvas'],
                           walkAnchor=[12,31],actions=action_frames,
                           preview=dict(path=str((w/'views/sheet_x8.png').relative_to(root)),sha256=sha(w/'views/sheet_x8.png'))))
    actor_ids = {a['id'] for a in actors}
    requirements = manifest['productionContract'].get('requirementActors', {a['id']:[a['id']] for a in actors})
    if (not isinstance(requirements, dict) or not requirements
            or any(not isinstance(key,str) or not key or not isinstance(ids,list) or not ids
                   or any(not isinstance(a,str) or a not in actor_ids for a in ids)
                   for key,ids in requirements.items())
            or {a for ids in requirements.values() for a in ids} != actor_ids):
        raise ValueError('기획 재료와 제작 인물의 완전한 연결 목록이 필요합니다.')
    return dict(version=1,harness='charset-actor',scope='theme-actors',theme=manifest['theme'],
                requirementActors=requirements,
                actors=actors,independentSceneReview=False,humanDecision=None)


def collect(data,cid):
    folder=Path(data)/'concepts'/cid; root=Path(data)/'art-worktrees'/cid
    order=folder/'art-actors.json'; actions=folder/'art-actor-actions.json'
    if not order.exists() or not actions.exists(): return None
    actor_data=Path(read(order)['data']).resolve()
    if not actor_data.is_relative_to(root.resolve()): raise ValueError('격리 인물 데이터 경로 오류')
    env=dict(os.environ,CHR_HARNESS_DATA=str(actor_data),OPRN_SHARED_CONTENT_SQLITE=str(actor_data/'shared-content.sqlite'))
    process=subprocess.run([sys.executable,__file__,'--inspect',str(order),str(actions),str(root)],
                           env=env,capture_output=True,text=True)
    if process.returncode:
        (folder/'art-actors-status.json').write_text(json.dumps(dict(ready=False,error=process.stderr[-1500:]),ensure_ascii=False))
        return None
    receipt=json.loads(process.stdout)
    fingerprint=hashlib.sha256(json.dumps(receipt,sort_keys=True).encode()).hexdigest()
    path=actor_data/'receipts'/(fingerprint+'.json');path.parent.mkdir(parents=True,exist_ok=True)
    path.write_text(json.dumps(receipt,ensure_ascii=False,indent=2))
    images=[r for a in receipt['actors'] for r in a['sheets']]
    batch=dict(harness='charset-actor',items=[a['id'] for a in receipt['actors']],
               receipt=dict(path=str(path.relative_to(root)),sha256=sha(path)),images=images,
               selection='전용 인물 걷기·행동 초안 · 공간 시각 검수와 최종 Allow 전')
    (folder/'art-actors-status.json').write_text(json.dumps(dict(ready=True,complete=False,receipt=batch['receipt']),ensure_ascii=False))
    sheets = {a['id']:a['sheets'] for a in receipt['actors']}
    return dict(batch=batch,coverage={rid:[r for actor in ids for r in sheets[actor]]
                                    for rid,ids in receipt['requirementActors'].items()},theme=receipt['theme'])


def runtime_pack(root, receipt_file, destination):
    """Prepare exact native runtime images. This is neither selection nor installation."""
    sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'charset-actor'))
    import chr as C
    from PIL import Image
    root = Path(root).resolve()
    receipt_file, destination = Path(receipt_file).resolve(), Path(destination).resolve()
    if not receipt_file.is_relative_to(root) or not destination.is_relative_to(root):
        raise ValueError('Runtime preparation must stay inside its art worktree')
    receipt = read(receipt_file)
    if receipt.get('scope') != 'theme-actors' or not receipt.get('actors'):
        raise ValueError('A native theme actor receipt is required')
    def verified(ref):
        path = (root / ref['path']).resolve()
        if not path.is_relative_to(root) or sha(path) != ref['sha256']:
            raise ValueError('Native actor source changed: ' + ref['path'])
        return path
    # Verify the entire delivery before emitting any derived runtime files.
    for actor in receipt['actors']:
        if not actor.get('machineReady') or len(actor['sheets']) != 2:
            raise ValueError('Walking and action delivery must both be complete')
        for ref in actor['sources'] + actor['sheets']: verified(ref)
    destination.mkdir(parents=True, exist_ok=True)
    actors, assets, sprites = [], {}, {}
    for actor in receipt['actors']:
        source_walk, source_action = map(verified, actor['sheets'])
        key = hashlib.sha256(json.dumps(dict(actor=actor['id'], sheets=actor['sheets']), sort_keys=True).encode()).hexdigest()[:24]
        walk_id, action_id = 'shared_charset_actor_' + key, 'shared_actor_action_' + key
        walk, action = destination / (walk_id + '.png'), destination / (action_id + '.png')
        with Image.open(source_walk) as original:
            sheet = C.pack_single_actor(original)
            sheet.save(walk)
            with Image.open(walk) as reread:
                if reread.convert('RGBA').tobytes() != sheet.tobytes():
                    raise ValueError('Packed PNG readback changed native pixels')
        shutil.copyfile(source_action, action)
        if sha(action) != actor['sheets'][1]['sha256']: raise ValueError('Action copy changed')
        frames = actor['actions']; fw, fh = actor['actionFrame']
        anchors = {tuple(f['anchor']) for f in frames}
        if len(anchors) != 1: raise ValueError('One runtime sheet must have a consistent ground anchor')
        with Image.open(action) as image:
            if image.size != (fw * len(frames), fh): raise ValueError('Action dimensions changed')
        for identifier, path, kind, width, height, frame_width, frame_height, count, anchor in [
            (walk_id, walk, 'charset', 288, 256, 24, 32, 96, actor['walkAnchor']),
            (action_id, action, 'sprite', fw * len(frames), fh, fw, fh, len(frames), next(iter(anchors))),
        ]:
            assets[identifier] = dict(id=identifier, name=actor['title'], kind=kind,
                file=dict(path=str(path.relative_to(root)), sha256=sha(path)),
                meta=dict(width=width, height=height, frameWidth=frame_width, frameHeight=frame_height, frames=count))
            sprites[identifier] = dict(id=identifier, image=dict(type='uploaded', id=identifier),
                frameWidth=frame_width, frameHeight=frame_height, frames=count, anchor=dict(x=anchor[0], y=anchor[1]))
        actors.append(dict(id=actor['id'], title=actor['title'], walk=walk_id, action=action_id,
            characterIndex=0, actions=frames, sources=actor['sheets'],
            idleFrames=dict(up=1, right=13, down=25, left=37)))
    output = dict(version=1, status='prepared-not-approved', canonicalReload=False, publicRegistered=False,
        receipt=dict(path=str(receipt_file.relative_to(root)), sha256=sha(receipt_file)),
        theme=receipt.get('theme'), actors=actors, assets=assets, sprites=sprites)
    (destination / 'runtime-assets.json').write_text(json.dumps(output, ensure_ascii=False, indent=2))
    return output


if __name__=='__main__':
    if len(sys.argv) != 5 or sys.argv[1] not in ('--inspect', '--runtime-pack'):
        raise SystemExit('--inspect ORDER ACTIONS ROOT | --runtime-pack ROOT RECEIPT DESTINATION')
    function = inspect if sys.argv[1] == '--inspect' else runtime_pack
    print(json.dumps(function(*sys.argv[2:]), ensure_ascii=False))
