"""월드맵 키트 위치 — 정본은 공개 저장소 oprn-worldmap-kit 하나다(2026-10-20).

찾는 순서:
  1. OPRN_WORLDMAP_KIT 환경 변수(키트 폴더 = <체크아웃>/tiledata/worldmap-kit)
  2. 같은 저장소 안 tiledata/worldmap-kit — 공개 저장소에서 하네스를 돌릴 때
  3. <저장소>/.worldmap-kit/tiledata/worldmap-kit — 편집기 저장소에서 `npm run worldmap-kit:sync` 가 고정 커밋으로 받아 둔 곳
"""
import os
from pathlib import Path

SYNC_HINT = '월드맵 키트가 없다 — 편집기 저장소에서 `npm run worldmap-kit:sync` 를 먼저 돌리거나 OPRN_WORLDMAP_KIT 을 키트 폴더로 지정하라.'


def kit_dir(root: Path) -> Path:
    env = os.environ.get('OPRN_WORLDMAP_KIT')
    if env:
        kit = Path(env).expanduser().resolve()
    elif (root / 'tiledata' / 'worldmap-kit' / 'kit' / 'build_world.py').is_file():
        kit = root / 'tiledata' / 'worldmap-kit'
    else:
        kit = root / '.worldmap-kit' / 'tiledata' / 'worldmap-kit'
    if not (kit / 'kit' / 'build_world.py').is_file():
        raise SystemExit(f'{SYNC_HINT} (찾은 곳: {kit})')
    return kit


def kit_asset(root: Path, rel: str) -> Path:
    """키트 체크아웃이 가진 공용 그림(EasyRPG World 원본 등). 편집기 저장소에는 없다(2026-10-07 저작권 정리)."""
    own = root / rel
    return own if own.is_file() else kit_dir(root).parents[1] / rel
