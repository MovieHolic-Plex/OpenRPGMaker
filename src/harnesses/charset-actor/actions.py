"""Native, hand-authored action cels attached to an existing actor's walk source.

These are action overlays/sprites, not replacement walking CharSets. Mechanical
checks preserve identity/anchors; independent scene review and selection remain.
"""
import argparse
import hashlib
import importlib.util
import json
from pathlib import Path
import shutil
import sys
from types import SimpleNamespace

from PIL import Image
import chr as C
import harness as H

ROOT = Path(__file__).resolve().parents[3]
GRID = ROOT / 'assistant-skills/pixel-dot-authoring/scripts/pixelgrid.py'
spec = importlib.util.spec_from_file_location('action_pixelgrid', GRID)
grid = importlib.util.module_from_spec(spec)
spec.loader.exec_module(grid)


def sha(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def read(path):
    return json.loads(Path(path).read_text())


def contract(path):
    request = read(path)
    source = Path(request['source']['path']).resolve(strict=True)
    if not source.is_relative_to(H.DATA.resolve()) or source.name != 'out.chr.txt':
        raise ValueError('현재 캐릭터 하네스 저장소의 원본 격자 필요')
    if sha(source) != request['source']['sha256']:
        raise ValueError('행동 주문의 인물 원본 해시 변경')
    gate = H.current_gate(source.parent)
    if not gate['ok'] or not H.human_ready(source.parent, gate):
        raise ValueError('현재 걷기 원본의 기술 검사·12프레임 납품이 필요합니다.')
    canvas, origin = request['canvas'], request['origin']
    if (len(canvas) != 2 or any(type(v) is not int or not 32 <= v <= 128 for v in canvas)
            or len(origin) != 2 or any(type(v) is not int for v in origin)
            or not 12 <= origin[0] <= canvas[0]-12 or not 31 <= origin[1] < canvas[1]):
        raise ValueError('24×32 원본과 발 앵커를 담는 행동 캔버스 필요')
    poses = request['poses']
    if not isinstance(poses, list) or not 1 <= len(poses) <= 16:
        raise ValueError('행동 목록 1~16개 필요')
    ids = set()
    for pose in poses:
        if (not isinstance(pose.get('id'), str) or not pose['id'] or pose['id'] in ids
                or pose.get('direction') not in C.DIRS
                or type(pose.get('frames')) is not int or not 2 <= pose['frames'] <= 8
                or type(pose.get('durationMs')) is not int or not 50 <= pose['durationMs'] <= 1000
                or pose['durationMs'] % 10 or len(pose.get('description', '')) < 20):
            raise ValueError('행동별 고유 ID·방향·프레임 수·시간·구체 지시 필요')
        ids.add(pose['id'])
    colors = request['palette']
    if not isinstance(colors, list) or not 1 <= len(colors) <= 64:
        raise ValueError('명시한 행동 팔레트 필요')
    for color in colors:
        if not isinstance(color, str) or not __import__('re').fullmatch('#[0-9a-fA-F]{6}', color):
            raise ValueError('행동 팔레트는 #RRGGBB 목록이어야 합니다.')
    return request, source, gate


def check(request_path, output):
    request, source, gate = contract(request_path)
    output = Path(output)
    document, digest = grid.load(output / 'actions.px.json')
    if [document['width'], document['height']] != request['canvas']:
        raise ValueError('행동 캔버스가 주문과 다릅니다.')
    allowed = {c.upper() for c in request['palette']}
    if any(c.upper() not in allowed for c in document['palette'].values()):
        raise ValueError('전용 팔레트 밖의 행동 색상')
    expected = [(pose, k) for pose in request['poses'] for k in range(pose['frames'])]
    if [f['id'] for f in document['frames']] != [f"{p['id']}-{k}" for p,k in expected]:
        raise ValueError('행동 프레임 ID/순서/개수 불일치')
    palette, _, frames = C.load(source)
    ox, oy = request['origin'][0]-12, request['origin'][1]-31
    results, errors = [], []
    for frame, (pose, index) in zip(document['frames'], expected):
        if frame.get('anchor') != request['origin'] or frame['durationMs'] != pose['durationMs']:
            raise ValueError('행동 프레임의 접지 원점/시간 변경')
        image = Image.new('RGBA', tuple(request['canvas']))
        image.putdata(grid.pixels(document, frame))
        original = C.frame_rgba(palette, frames[(pose['direction'], 1)])
        bounds = original.getbbox()
        # Same head and boots: authors change the arms/props/torso directly.
        head_end = min(bounds[1]+12, bounds[3]-6)
        locked = [(0, bounds[1], 24, head_end), (0, bounds[3]-3, 24, 32)]
        for x0,y0,x1,y1 in locked:
            if image.crop((ox+x0,oy+y0,ox+x1,oy+y1)).tobytes() != original.crop((x0,y0,x1,y1)).tobytes():
                errors.append(frame['id'] + ': 원본 머리/발 위치·화소 변경')
        baseline = Image.new('RGBA', image.size); baseline.paste(original,(ox,oy))
        changed = sum(a != b for a,b in zip(image.getdata(),baseline.getdata()))
        if changed < 4: errors.append(frame['id'] + ': 정지 복사만 있고 행동 픽셀 미저작')
        box = image.getbbox()
        if not box or box[0] == 0 or box[1] == 0 or box[2] == image.width or box[3] == image.height:
            errors.append(frame['id'] + ': 빈 그림 또는 프레임 경계 잘림 위험')
        results.append(dict(id=frame['id'], direction=pose['direction'], changedPixels=changed,
                            anchor=frame['anchor'], durationMs=frame['durationMs']))
    grid.render(SimpleNamespace(source=str(output/'actions.px.json'), out=str(output/'views'), scale=6))
    report = dict(version=1, harness='charset-actor', scope='action-poses', ok=not errors,
                  contractSha256=sha(request_path), sourceSha256=sha(source), pixelSourceSha256=digest,
                  sourceBinding=H.binding(gate), frames=results, errors=errors,
                  independentSceneReview=False, humanDecision=None)
    H.write_json_atomic(output/'check.json',report)
    if errors: raise ValueError('; '.join(errors))
    return report


def produce(request_path, output, repairs):
    output = Path(output).resolve()
    key = hashlib.sha256(str(output).encode()).hexdigest()[:24]
    with H.data_lock('actions-' + key):
        return _produce(request_path, output, repairs)


def _produce(request_path, output, repairs):
    request_path, output = Path(request_path).resolve(), Path(output).resolve()
    request, source, _ = contract(request_path)
    if not output.is_relative_to(H.DATA.resolve()): raise ValueError('격리 캐릭터 저장소 안의 출력 폴더 필요')
    output.mkdir(parents=True, exist_ok=True)
    sealed = output/'request.json'
    if sealed.exists() and sealed.read_bytes() != request_path.read_bytes():
        raise ValueError('기존 행동 주문을 덮어쓸 수 없습니다.')
    if not sealed.exists(): shutil.copy2(request_path,sealed)
    if (output/'receipt.json').exists(): raise ValueError('이미 납품된 행동입니다. 현재 영수증을 수집하세요.')
    for attempt in range(repairs+1):
        archive = output/'attempts'/str(attempt+1)
        archive.mkdir(parents=True,exist_ok=True)
        if (archive/'producer.json').exists(): raise ValueError('기존 행동 시도 기록을 덮어쓸 수 없습니다.')
        for name in ('actions.px.json','check.json'):
            if (output/name).exists(): shutil.copy2(output/name,archive/('before-'+name))
        prompt = (H.HERE/'action-worker.md').read_text()
        prompt = prompt.replace('{REQUEST}',str(sealed)).replace('{SOURCE}',str(source))
        prompt = prompt.replace('{OUTPUT}',str(output)).replace('{TOOL}',str(H.HERE/'actions.py'))
        prompt = prompt.replace('{GRID}',str(GRID)).replace('{FORMAT}',str(ROOT/'assistant-skills/pixel-dot-authoring/references/pixel-source.md'))
        if (output/'check.json').exists(): prompt += '\n이전 기계 검사: '+json.dumps(read(output/'check.json'),ensure_ascii=False)
        if (output/'failure.json').exists(): prompt += '\n이번에 고칠 실행 오류: '+json.dumps(read(output/'failure.json'),ensure_ascii=False)
        (archive/'prompt.md').write_text(prompt)
        proc = H._spawn('gpt', output, archive/'prompt.md', archive/'worker.log')
        meta = dict(pid=proc.pid,started=H.now(),model=H.ENGINES['gpt'],attempt=attempt+1)
        H.write_json_atomic(archive/'producer.json',meta)
        code = proc.wait()
        H.write_json_atomic(archive/'producer.json',dict(meta,exitCode=code,ended=H.now()))
        if code: raise RuntimeError(f'행동 모델 종료 {code}; {archive}/worker.log 확인')
        try:
            report=check(sealed,output)
        except (OSError, ValueError, KeyError, TypeError) as error:
            H.write_json_atomic(output/'failure.json',dict(attempt=attempt+1,error=str(error)))
            if attempt == repairs: raise
            continue
        refs=[]
        for path in [sealed,source,output/'actions.px.json',output/'check.json',archive/'producer.json',
                     output/'views/sheet.png',output/'views/report.json',output/'views/checker.gif',
                     Path(__file__).resolve(),GRID,H.HERE/'action-worker.md']:
            refs.append(dict(path=str(path),sha256=sha(path)))
        H.write_json_atomic(output/'receipt.json',dict(report,sources=refs,producer=dict(meta,exitCode=code),
            sheet=dict(path=str(output/'views/sheet.png'),sha256=sha(output/'views/sheet.png'))))
        (output/'failure.json').unlink(missing_ok=True)
        return


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('command',choices=['produce','check'])
    parser.add_argument('request',type=Path)
    parser.add_argument('--out',type=Path,required=True)
    parser.add_argument('--repairs',type=int,choices=range(3),default=2)
    args=parser.parse_args()
    if args.command=='check':
        print(json.dumps(check(args.request,args.out),ensure_ascii=False))
    else: produce(args.request,args.out,args.repairs)


if __name__=='__main__': main()
