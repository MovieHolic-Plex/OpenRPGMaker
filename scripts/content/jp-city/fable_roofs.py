"""직각 지붕 덮어쓰기 — 오너 2026-11-12: «이 에디터는 시야각이 직교해야하므로 sengoku_edo se-machiya-a 이런 식의 직각 지붕이어야».
사다리꼴(우진각·옆 물매) 지붕을 Claude Fable 5.2 medium 한 방으로 다시 그린 건물 그림을 코드 그림 위에 덮는다. 벽·문·기단은 옛 화소 그대로, 지붕 줄만 새 그림.

  tiledata/jp-city/fable-roofs/<키트 id>.png   그 키트의 위층 그림 전체(코드 그림과 같은 크기)
  tiledata/jp-city/fable-roofs/index.json      키트 id → {box: 지붕 상자 [x0,y0,x1,y1], oldSha: 덮기 전 코드 그림의 화소 해시}

- 코드 그림이 바뀌어 oldSha 가 달라지면 굽기를 멈춘다(덮어쓴 그림이 옛 벽을 품고 있다 — 지붕을 다시 그리거나 덮어쓰기를 지운다).
- 출구 규칙: object-gate refusal(kind=structure, context=bundle) 이 None 일 때만 쓴다 = 오너 면제 묶음(fable-redraw-roofs-jp-city-2026-11-12)이나 판정 통과.
  면제는 통과가 아니다: «3/4 관문 미통과 — 오너 면제». 한 화소라도 바꾸면 면제가 풀리고 굽기가 멈춘다.
"""
import json, os, sys
import numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..', '..'))
DIR = os.path.join(ROOT, 'tiledata', 'jp-city', 'fable-roofs')
sys.path.insert(0, os.path.join(ROOT, 'src', 'harnesses', '_core'))
_INDEX = None
USED = []


def index():
    global _INDEX
    if _INDEX is None:
        p = os.path.join(DIR, 'index.json')
        _INDEX = json.load(open(p, encoding='utf-8')) if os.path.exists(p) else {}
    return _INDEX


def apply(kit_id, arr):
    """arr(H×W×4 uint8, 코드 그림) → 덮어쓴 그림(없으면 arr 그대로)."""
    meta = index().get(kit_id)
    if meta is None: return arr
    import object_gate as OG
    old = Image.fromarray(np.asarray(arr, np.uint8), 'RGBA')
    sha = OG.pixel_sha256(old)
    if sha != meta['oldSha']:
        raise SystemExit('fable-roofs: %s 의 코드 그림이 바뀌었다(%s != %s) — 덮어쓴 지붕을 다시 그리거나 index.json 에서 지워라' % (kit_id, sha[:12], meta['oldSha'][:12]))
    new = Image.open(os.path.join(DIR, kit_id + '.png')).convert('RGBA')
    if new.size != old.size:
        raise SystemExit('fable-roofs: %s 크기 %s != 코드 그림 %s' % (kit_id, new.size, old.size))
    why = OG.refusal(new, kind='structure', context='bundle')
    if why is not None:
        raise SystemExit('fable-roofs: %s 는 관문 출구를 못 지난다 — %s' % (kit_id, why))
    if kit_id not in USED: USED.append(kit_id)
    return np.array(new)
