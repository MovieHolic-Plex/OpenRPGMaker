"""theme-climate-r1 — 기후 테마 던전 부족분(2026-10-23): 피라미드·얼음굴·늪·숲.

테마마다 모듈 하나(theme_climate_<테마>.py)가 행 문자열 손 도트로 그리고, 이 파일은 모아서 하네스 판 규약(WAVE·CANDIDATES·NOTES)으로 낸다.
모든 항목이 줄 공통(시드 common) — 후보 키 A1·A2.
각 테마 모듈은 FNS = {항목: {'A1': fn, 'A2': fn}} 와 NOTES_BY_ITEM = {항목: {'A1': 설명, 'A2': 설명}} 를 낸다.
fn() → (후보 그림 Cv, meta). meta: kind(objects|object|tile|autotile) · parts · vignette(장면, 사람 Actor1 포함) · anim(장면 목록, 움직임) ·
extras([(이름, Cv, 배율)] — 오토타일 몸통 6×6·불규칙 시험 지도 등) · autotiles(오토타일 관문용).
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import importlib  # noqa: E402
import traceback  # noqa: E402

WAVE = 'theme_climate'
THEMES = []
for _name in ('theme_climate_desert', 'theme_climate_ice', 'theme_climate_swamp', 'theme_climate_forest'):
    try:   # 한 테마 모듈이 고치는 중에 깨져도 나머지 테마는 그린다(빠진 항목은 validate 가 잡는다)
        THEMES.append(importlib.import_module(_name))
    except Exception:  # noqa: BLE001
        print(f'[theme-climate] {_name} 모듈 오류 — 건너뜀\n' + traceback.format_exc(limit=3), file=sys.stderr)


def _noted(fn, note):
    def g_():
        cv, meta = fn()
        meta['note'] = '줄 공통 — ' + note
        return cv, meta
    return g_


CANDIDATES = {}
NOTES = {}
for _m in THEMES:
    for _item, _c in _m.FNS.items():
        CANDIDATES[_item] = {k: _noted(fn, _m.NOTES_BY_ITEM[_item][k]) for k, fn in _c.items()}
