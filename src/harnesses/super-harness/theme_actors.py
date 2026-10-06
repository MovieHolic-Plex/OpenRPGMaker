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
        for sheet in sheets:
            with Image.open(root/sheet['path']) as image: image.verify()
        actors.append(dict(id=row['key'],title=row['name'],machineReady=True,sources=native,
                           sheets=sheets,frame=[24,32],actionFrame=read(action['request'])['canvas'],
                           actions=proof['frames'],preview=dict(path=str((w/'views/sheet_x8.png').relative_to(root)),sha256=sha(w/'views/sheet_x8.png'))))
    return dict(version=1,harness='charset-actor',scope='theme-actors',theme=manifest['theme'],
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
    return dict(batch=batch,coverage={a['id']:a['sheets'] for a in receipt['actors']},theme=receipt['theme'])


if __name__=='__main__':
    if len(sys.argv)!=5 or sys.argv[1]!='--inspect': raise SystemExit('internal native inspection only')
    print(json.dumps(inspect(*sys.argv[2:]),ensure_ascii=False))
