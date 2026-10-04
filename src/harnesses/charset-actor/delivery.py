"""제작 기준 후보의 납품 증거. 픽셀 미감은 심사하지 않는다."""
import hashlib
import json
from functools import lru_cache
from pathlib import Path

from PIL import Image, ImageChops
import audit
import chr as C
import harness as H
import recipes as R
import motion as M

VERSION = 1
ARTIFACTS = ('sheet.png', 'sheet_rgba.png', 'alpha_sheet.png', 'alpha.png',
             'walk_checker.gif', 'walk_white.gif', 'walk_black.gif', 'walk.gif', 'stroll.gif')


@lru_cache(maxsize=4096)
def _digest(path, mtime, ctime, size):
    return R.sha(path)


def digest(path):
    stat = Path(path).stat()
    return _digest(str(Path(path).resolve()), stat.st_mtime_ns, stat.st_ctime_ns, stat.st_size)


def fresh(w, gate):
    try:
        w = Path(w)
        meta = json.loads((w / 'meta.json').read_text())
        proof = json.loads((w / 'delivery.json').read_text())
        root = H.run_dir(meta['run'])
        return (proof['version'] == VERSION and gate['ok'] and proof['inspected'] == H.binding(gate)
                and proof['recipe'] == meta['recipe']
                and digest(root / 'recipe' / 'recipe.json') == meta['recipe']['sha256']
                and digest(w / 'base.chr.txt') == proof['baseGridSha256']
                and digest(w / 'desc.json') == proof['descriptionSha256']
                and digest(w / 'model-frames.json') == proof['frameAuthorSha256']
                and M.fresh(w, gate)
                and (meta.get('motionPolicy') is None or
                     (proof.get('motionPolicy') == meta['motionPolicy']
                      and digest(w / 'views/motion.json') == proof['motionSha256']))
                and set(proof['artifacts']) == set(ARTIFACTS)
                and all(digest(w / 'views' / name) == value for name, value in proof['artifacts'].items()))
    except (OSError, ValueError, KeyError, TypeError):
        return False


def publish(w, gate):
    w = Path(w)
    meta = json.loads((w / 'meta.json').read_text())
    root = H.run_dir(meta['run'])
    recipe = R.verify_run(root, check_tools=True)
    if meta['recipe'] != dict(id=recipe['id'], sha256=R.sha(root / 'recipe' / 'recipe.json')):
        raise ValueError('작업자 제작 기준 binding이 다릅니다')
    motion = H.check_motion(w, gate)
    if not gate['ok'] or not H.model_frames_fresh(w, gate) or not H.views_fresh(w, gate) or not H.alpha_views_fresh(w, gate):
        raise ValueError('12프레임/투명/렌더 납품 미완료: ' + '; '.join(gate['fails']))
    desc = json.loads((w / 'desc.json').read_text())
    attrs = desc.get('attributes', {})
    if (not isinstance(desc.get('label'), str) or not desc['label'].strip()
            or any(not isinstance(attrs.get(key), str) or not attrs[key].strip() for key in ('kind', 'age', 'hair', 'clothing'))):
        raise ValueError('그린 외형의 설명(label/kind/age/hair/clothing)이 필요합니다')
    pal, _, frames = C.load(w / 'out.chr.txt')
    roundtrip = audit.roundtrip(pal, frames, w / 'views')
    if (roundtrip['keyedPngMismatchPixels'] or set(roundtrip['diagnosticGifMismatchedSteps']) != {'checker', 'white', 'black'}
            or any(roundtrip['diagnosticGifMismatchedSteps'].values())):
        raise ValueError('출하 PNG/세 배경 GIF 재읽기 불일치')
    expected_sheet = C.sheet_rgba(pal, frames)
    actual_sheet = Image.open(w / 'views' / 'sheet_rgba.png').convert('RGBA')
    if actual_sheet.size != expected_sheet.size or actual_sheet.tobytes() != expected_sheet.tobytes():
        raise ValueError('RGBA 시트가 저작 픽셀과 다릅니다')
    for direction in C.DIRS:
        if len({C.frame_rgba(pal, frames[direction, step]).tobytes() for step in range(3)}) != 3:
            raise ValueError(f'{direction}: 정지·좌우 걸음 3장이 서로 달라야 합니다')
    with Image.open(w / 'views' / 'walk.gif') as gif:
        timeline, end = [], 0
        for index in range(gif.n_frames):
            gif.seek(index)
            end += gif.info.get('duration', 170)
            timeline.append((end, gif.convert('RGB').copy()))
        if end != 680 or gif.info.get('loop') != 0:
            raise ValueError('걷기 GIF의 네 단계 시간/반복이 다릅니다')
        for index, step in enumerate((0, 1, 2, 1)):
            bg = C._bg(120, 40, H.LAWN)
            for di, direction in enumerate(C.DIRS):
                bg.alpha_composite(C.frame_rgba(pal, frames[direction, step]), (di * 32, 4))
            actual = next(frame for end, frame in timeline if end > index * 170)
            if ImageChops.difference(actual, C.up(bg.convert('RGB'), 4)).getbbox():
                raise ValueError('잔디 GIF가 저작 픽셀과 다릅니다')
    rgba_hash = hashlib.sha256(C.sheet_rgba(pal, frames).tobytes()).hexdigest()
    with H.data_lock('delivery-' + root.name):
        for other in root.glob('*__gpt-r1'):
            if other.resolve() == w.resolve() or not (other / 'delivery.json').is_file():
                continue
            if json.loads((other / 'delivery.json').read_text())['rgbaSha256'] == rgba_hash:
                raise ValueError('이미 만든 후보와 모든 픽셀이 같습니다. 다른 변주가 필요합니다.')
        proof = dict(version=VERSION, at=H.now(), inspected=H.binding(gate), recipe=meta['recipe'],
                     baseGridSha256=R.sha(w / 'base.chr.txt'),
                     rgbaSha256=rgba_hash, descriptionSha256=R.sha(w / 'desc.json'),
                     frameAuthorSha256=R.sha(w / 'model-frames.json'), roundtrip=roundtrip,
                     artifacts={name: R.sha(w / 'views' / name) for name in ARTIFACTS})
        if motion is not None:
            proof.update(motionPolicy=M.VERSION, motionSha256=R.sha(w / 'views/motion.json'))
        H.write_json_atomic(w / 'delivery.json', proof)
        H.write_json_atomic(w / 'published.json', H.binding(gate))
    return proof
