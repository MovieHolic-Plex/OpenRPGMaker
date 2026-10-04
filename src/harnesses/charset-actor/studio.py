"""자유 저작 → GIF 대기열 → 사람이 남긴 칩 다운로드. 모델 점수는 사용하지 않는다."""
import argparse
import base64
import hashlib
import io
import json
import shutil
import subprocess
import sys
import tempfile
import uuid
import zipfile
from pathlib import Path
from datetime import datetime

from PIL import Image
import harness as H
import chr as C


def run_root(run):
    if not isinstance(run, str) or not run or Path(run).name != run or run in ('.', '..'):
        raise ValueError('잘못된 실행 이름')
    root = H.run_dir(run)
    if not (root / 'manifest.json').is_file():
        raise ValueError('실행을 찾을 수 없습니다')
    return root


def launch(root, par=4, batch_size=2):
    with (root / 'production.log').open('a') as log:
        child = subprocess.Popen([sys.executable, str(H.HERE / 'bulk.py'), str(root / 'manifest.json'),
                                  '--par', str(par), '--batch-size', str(batch_size)],
                                 stdin=subprocess.DEVNULL, stdout=log, stderr=subprocess.STDOUT, start_new_session=True)
    H.write_json_atomic(root / 'driver.json', dict(pid=child.pid, started=H.now(), run=root.name))
    return dict(run=root.name, pid=child.pid)


def runs(items=None):
    items = H._items() if items is None else items
    result = []
    for file in sorted((H.DATA / 'runs').glob('*/manifest.json'), reverse=True):
        manifest = json.loads(file.read_text())
        if manifest.get('reviewMode') != 'human':
            continue
        root = file.parent
        driver = json.loads((root / 'driver.json').read_text()) if (root / 'driver.json').exists() else {}
        state = json.loads((root / 'production-state.json').read_text()) if (root / 'production-state.json').exists() else {}
        alive = H._alive(driver.get('pid'))
        rows = [it for it in items if it['run'] == root.name]
        ready = [it for it in rows if it['status'] == 'done']
        decisions = H._decisions()
        kept = sum(H.effective_decision(root / it['dir'], decisions.get(it['id']), it['gate']) == 'accept' for it in ready)
        rejected = sum(decisions.get(it['id'], {}).get('decision') == 'reject' for it in ready)
        phase = ('pausing' if (root / 'pause-request.json').exists() else 'running') if alive else state.get('phase', 'interrupted')
        result.append(dict(run=root.name, planned=len(manifest['characters']), ready=len(ready), kept=kept,
                           rejected=rejected, awaiting=len(ready)-kept-rejected, phase=phase, error=state.get('error'),
                           blocked=sum((p / 'views' / 'gate.json').exists() and not H.current_gate(p)['ok']
                                       for p in root.glob('*__*') if (p / 'out.chr.txt').exists())))
    return result


def create(options):
    with H.data_lock('studio'):
        return _create(options)


def _create(options):
    count = int(options.get('count', 100))
    par = int(options.get('par', 4))
    batch_size = int(options.get('batchSize', 2))
    if not 1 <= count <= 500 or not 1 <= par <= 6 or not 1 <= batch_size <= 8:
        raise ValueError('개수 1~500, 동시 작업 1~6, 묶음 크기 1~8')
    if any(r['phase'] in ('running', 'pausing') for r in runs()):
        raise ValueError('진행 중인 자유 저작이 있습니다. 현재 작업을 마치거나 일시 정지하세요.')
    root = H.run_dir(datetime.now().strftime('%Y%m%d-%H%M%S') + '-free-' + uuid.uuid4().hex[:8])
    root.mkdir(parents=True)
    prompt = str(options.get('prompt') or '한국풍·판타지·현대·SF 등 여러 장르의 다양한 에디터용 인물. 콘셉트와 복식은 자유롭게 정한다.')[:4000]
    source = None
    if options.get('image') or options.get('reference'):
        if options.get('image'):
            raw = base64.b64decode(str(options['image']).split(',', 1)[-1], validate=True)
            original = Image.open(io.BytesIO(raw))
        else:
            original = Image.open(Path(options['reference']).expanduser())
        source = root / 'source-original.png'
        original.save(source)
        iid, slots, _ = H.ingest(source, '자유 저작 참고')
        bases = [f'input:{iid}:{slot}' for slot in slots]
    else:
        bases = [f'{sheet}:{slot}' for sheet in H.BASE_SHEETS for slot in range(8)]
    # 원본부터 결손이 있는 칸을 새로운 후보의 몸체 기준으로 쓰지 않는다.
    bases = [b for b in bases if C.gate(*H.base_of(b), H.base_of(b), strength='free')['ok']]
    if not bases:
        raise ValueError('머리/투명 결손 없는 캐릭터 칸을 찾을 수 없습니다')
    characters = [dict(key=f'free-{root.name[-8:]}-{i+1:03d}', name=f'자유 캐릭터 {i+1:03d}',
                       base=bases[i % len(bases)], brief=prompt, strength='free', reviewMode='human',
                       source='upload' if source else 'rtp', genre='자유', role='', gender='', age='') for i in range(count)]
    manifest = dict(run=root.name, reviewMode='human', characters=characters, genres=['자유'],
                    sourceOriginal=str(source) if source else None)
    H.write_json_atomic(root / 'manifest.json', manifest)
    return dict(launch(root, par, batch_size), count=count)


def control(run, resume):
    with H.data_lock('studio'):
        return _control(run, resume)


def _control(run, resume):
    root = run_root(run)
    if json.loads((root / 'manifest.json').read_text()).get('reviewMode') != 'human':
        raise ValueError('자유 저작 실행만 제어할 수 있습니다')
    driver = json.loads((root / 'driver.json').read_text()) if (root / 'driver.json').exists() else {}
    if resume:
        if H._alive(driver.get('pid')):
            raise ValueError('현재 묶음이 끝날 때까지 기다려 주세요')
        if any(r['run'] != run and r['phase'] in ('running', 'pausing') for r in runs()):
            raise ValueError('다른 자유 저작이 진행 중입니다')
        (root / 'pause-request.json').unlink(missing_ok=True)
        layout = json.loads((root / 'production.json').read_text())
        return launch(root, batch_size=layout['batchSize'])
    H.write_json_atomic(root / 'pause-request.json', dict(at=H.now()))
    return dict(run=run, phase='pausing')


def export_kept(run='all'):
    if run != 'all':
        if not isinstance(run, str) or Path(run).name != run or run in ('.', '..') or not H.run_dir(run).is_dir():
            raise ValueError('실행을 찾을 수 없습니다')
    decisions = H._decisions()
    selected = []
    for it in H._items():
        if run != 'all' and it['run'] != run:
            continue
        w = H.run_dir(it['run']) / it['dir']
        gate = H.current_gate(w) if (w / 'out.chr.txt').exists() else None
        rec = decisions.get(it['id'])
        if it['status'] != 'done' or H.effective_decision(w, rec, gate) != 'accept' or not H.quality(w, 'accept', gate)['eligible']:
            continue
        raw = (w / 'out.chr.txt').read_bytes()
        if hashlib.sha256(raw).hexdigest() != gate['sourceSha256']:
            raise ValueError('선택한 그림이 변경되었습니다. 다시 확인해 주세요.')
        pal, _, frames = C.parse(raw.decode('utf-8'))
        selected.append((it, w, raw, C.sheet_rgba(pal, frames), rec))
    if not selected:
        raise ValueError('남긴 캐릭터가 없습니다')
    downloads = H.DATA / 'downloads'; downloads.mkdir(parents=True, exist_ok=True)
    name = datetime.now().strftime('characters-kept-%Y%m%d-%H%M%S-') + uuid.uuid4().hex[:8] + '.zip'
    with tempfile.TemporaryDirectory(prefix='kept-', dir=downloads) as temp:
        out = Path(temp)
        (out / 'charsets').mkdir(); (out / 'transparent').mkdir(); (out / 'grids').mkdir(); (out / 'gifs').mkdir()
        catalog = []
        for offset in range(0, len(selected), 8):
            group = selected[offset:offset+8]
            sheet = Image.new('RGBA', (288, 256))
            filename = f'Kept{offset//8+1:02d}.png'
            for slot, (it, w, raw, sprite, rec) in enumerate(group):
                sheet.paste(sprite, (slot%4*72, slot//4*128))
                key = hashlib.sha256(it['id'].encode()).hexdigest()[:16]
                (out / 'grids' / f'{key}.chr.txt').write_bytes(raw)
                shutil.copy(w / 'views' / 'walk.gif', out / 'gifs' / f'{key}.gif')
                catalog.append(dict(id=it['id'], name=it['desc'].get('label') if it['desc'] else it['name'],
                                    charset=f'charsets/{filename}', characterIndex=slot, description=it['desc'],
                                    sourceBase=it['base'], acceptance=rec))
            sheet.save(out / 'transparent' / filename)
            bg = Image.new('RGBA', sheet.size, C.KEY+(255,)); bg.alpha_composite(sheet)
            bg.convert('RGB').save(out / 'charsets' / filename)
            reopened = Image.open(out / 'charsets' / filename).convert('RGB')
            restored = Image.new('RGBA', sheet.size)
            restored.putdata([(0,0,0,0) if all(abs(rgb[i]-C.KEY[i]) <= 8 for i in range(3)) else (*rgb,255) for rgb in reopened.getdata()])
            if restored.tobytes() != sheet.tobytes():
                raise ValueError('에디터 색 키 재읽기 불일치')
        if any(not it['base'].startswith('input:') for it, *_ in selected):
            credits = out / 'licenses' / 'easyrpg'; credits.mkdir(parents=True)
            for file in ('AUTHORS.md', 'COPYING'):
                shutil.copy(H.RTP / file, credits / file)
        sources = out / 'sources'; sources.mkdir()
        for it, *_ in selected:
            if it['base'].startswith('input:'):
                iid = it['base'].split(':')[1]
                shutil.copy(H.INPUTS / f'{iid}.png', sources / f'{iid}.png')
                info = json.loads((H.INPUTS / f'{iid}.json').read_text())
                original = Path(info['src'])
                if original.is_file():
                    shutil.copy(original, sources / f'{iid}-original.png')
        H.write_json_atomic(out / 'characters.json', dict(count=len(catalog), characters=catalog))
        (out / 'README.md').write_text('사람이 GIF를 보고 남긴 캐릭터만 포함합니다.\ncharsets/의 288×256 PNG를 에디터에 올립니다. 한 시트 8명, 각 24×32 × 3걸음 × 4방향.\n투명 색 키 #009392, RGBA는 transparent/, GIF는 gifs/. 원본과 선택 해시는 characters.json에 기록했습니다.\n작업자 설명은 그림을 그린 AI의 설명이며 독립 시각 심사 점수가 아닙니다. 프로젝트에는 자동 설치하지 않습니다.\n', encoding='utf-8')
        temp_zip = downloads / ('.' + name)
        try:
            with zipfile.ZipFile(temp_zip, 'w', zipfile.ZIP_DEFLATED) as archive:
                for file in sorted(out.rglob('*')):
                    if file.is_file():
                        archive.write(file, file.relative_to(out))
            temp_zip.rename(downloads / name)
        finally:
            temp_zip.unlink(missing_ok=True)
    return dict(count=len(selected), url='/downloads/'+name)


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--count', type=int, default=100)
    parser.add_argument('--prompt', default='')
    parser.add_argument('--reference', type=Path)
    parser.add_argument('--par', type=int, default=4)
    parser.add_argument('--batch-size', type=int, default=2)
    args = parser.parse_args()
    print(json.dumps(create(dict(count=args.count, prompt=args.prompt, reference=args.reference,
                                 par=args.par, batchSize=args.batch_size)), ensure_ascii=False))
