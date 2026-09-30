#!/usr/bin/env python3
"""호러 세트 후보 검사 — 공통 check_candidate.py 를 그대로 부르되, 공통 쪽이 호러를 알기 전까지 필요한 두 가지만 이 프로세스 안에서 덧댄다.
  python3 scripts/content/atlas-pick/horror_check.py tiledata/atlas-pick/candidates-horror/<slug>/h1-A.pxg
  python3 scripts/content/atlas-pick/horror_check.py --worker h1          # 그 작업자 후보 전부 (--set 을 안 주면 horror)
덧대는 것(파일은 고치지 않는다):
  1. sets.json 에 horror 항목이 없으면 메모리에서만 더한다(items=jobs-horror.json, candidates=candidates-horror, baseline 없음).
  2. 작업자 이름 규칙 WORKER_RE 에 h1… 를 더한다.
공통 쪽(sets.json·common.WORKER_RE)에 호러가 들어가면 이 파일은 그냥 check_candidate.py 와 같게 돈다."""
import os, re, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import common
import check_candidate

HORROR_SET = {'id': 'horror', 'name': '호러', 'items': 'jobs-horror.json', 'candidates': 'candidates-horror', 'baseline': None, 'palette': 'horror.pal',
              'about': '쯔꾸르 인디 호러(낡은 저택·폐병원·폐교 복도·밤 묘지·연출) 16px 조각. v5 실내 칩셋 식구. 현재판 없음 — 후보끼리 고른다. 절차 WORKER-HORROR.md.'}

_orig = common.list_sets
def list_sets():
    s = _orig()
    return s if any(m.get('id') == 'horror' for m in s) else s + [HORROR_SET]
common.list_sets = list_sets

if not check_candidate.WORKER_RE.match('h1-A.pxg'):
    check_candidate.WORKER_RE = re.compile(r'^(j[0-9]{1,2}|m[0-9]{1,2}|h[0-9]{1,2}|pilot)-([A-Z])\.pxg$')

if __name__ == '__main__':
    if '--set' not in sys.argv:
        sys.argv[1:1] = ['--set', 'horror']
    check_candidate.main()
