"""직각 지붕 덮어쓰기(공용) — 오너 2026-11-12: «이 에디터는 시야각이 직교해야하므로 sengoku_edo se-machiya-a 이런 식의 직각 지붕이어야».
사다리꼴(우진각·옆 물매) 지붕을 Claude Fable 5.2 medium 한 방으로 다시 그린 건물 그림을 코드 그림 위에 덮는다. 벽·문·기단은 옛 화소 그대로, 지붕 줄만 새 그림.

  tiledata/<칩셋 폴더>/fable-roofs/<조각 id>.png   그 조각의 그림 전체(코드 그림과 같은 크기)
  tiledata/<칩셋 폴더>/fable-roofs/index.json      조각 id → {box: 지붕 상자 [x0,y0,x1,y1], oldSha: 덮기 전 코드 그림의 화소 해시}

- 코드 그림이 바뀌어 oldSha 가 달라지면 멈춘다(덮어쓴 그림이 옛 벽을 품고 있다 — 지붕을 다시 그리거나 index.json 에서 지운다).
- 굽기 출구: waived(img, kind) = object-gate refusal(context=bundle) 이 None(오너 면제 묶음 fable-redraw-roofs-<칩셋>-2026-11-12 이나 판정 통과).
  면제는 통과가 아니다: «3/4 관문 미통과 — 오너 면제». 한 화소라도 바꾸면 면제가 풀린다.
"""
import json, os, sys
import numpy as np
from PIL import Image

ROOT = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', '..'))
sys.path.insert(0, os.path.join(ROOT, 'src', 'harnesses', '_core'))
_INDEX = {}


def _dir(chipset_dir):
    return os.path.join(ROOT, 'tiledata', chipset_dir, 'fable-roofs')


def index(chipset_dir):
    if chipset_dir not in _INDEX:
        p = os.path.join(_dir(chipset_dir), 'index.json')
        _INDEX[chipset_dir] = json.load(open(p, encoding='utf-8')) if os.path.exists(p) else {}
    return _INDEX[chipset_dir]


def has(chipset_dir, piece_id):
    return piece_id in index(chipset_dir)


def apply(chipset_dir, piece_id, arr):
    """arr(H×W×4 uint8, 코드 그림) → 덮어쓴 그림(없으면 arr 그대로)."""
    meta = index(chipset_dir).get(piece_id)
    if meta is None: return arr
    import object_gate as OG
    old = Image.fromarray(np.asarray(arr, np.uint8), 'RGBA')
    sha = OG.pixel_sha256(old)
    if sha != meta['oldSha']:
        raise SystemExit('fable-roofs: %s 의 코드 그림이 바뀌었다(%s != %s) — 덮어쓴 지붕을 다시 그리거나 index.json 에서 지워라' % (piece_id, sha[:12], meta['oldSha'][:12]))
    new = Image.open(os.path.join(_dir(chipset_dir), piece_id + '.png')).convert('RGBA')
    if new.size != old.size:
        raise SystemExit('fable-roofs: %s 크기 %s != 코드 그림 %s' % (piece_id, new.size, old.size))
    return np.array(new)


def waived(img, kind):
    """오너 면제(또는 판정 통과)로 bundle 출구를 지나는가. img = PIL Image 나 경로."""
    import object_gate as OG
    return OG.refusal(img, kind=kind, context='bundle') is None
